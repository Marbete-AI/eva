import { getSupabaseClient } from "../supabase-client.js";
import { storeMemory } from "../store.js";
import { PROMOTION_THRESHOLDS, type MemoryCategory } from "./categories.js";
import type { ExtractedCandidate } from "./extract.js";
import {
  checkRejectionBank,
  reviveRejectedCandidate,
} from "./rejection-bank.js";
import {
  queueConfirmation,
  generateConfirmationQuestion,
} from "./confirmation-queue.js";

/**
 * Write a candidate to memory_candidates and check if it should be
 * immediately promoted to Tier 2 (memory_chunks).
 *
 * Promotion rules:
 *   A. Direct high-confidence statement — promote immediately
 *   B. Repeated observation — check evidence_count against threshold
 *
 * Also:
 *   - Checks rejection bank before writing. If a rejected match exists:
 *     - If new confidence >= 0.6: revive as new candidate with suggest_confirmation = true
 *     - If new confidence < 0.6: skip writing entirely
 *   - Queues confirmation question when suggest_confirmation = true
 *
 * Returns the candidate ID (or null if Supabase not configured).
 */
export async function writeCandidateAndMaybePromote(opts: {
  userId: string;
  sessionId: string;
  candidate: ExtractedCandidate;
  sourceType: string;
  sourceIds: Record<string, string | null>;
  contextSnapshot: Record<string, unknown>;
  extractorVersion: string;
}): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { userId, sessionId, candidate, sourceType, sourceIds, contextSnapshot, extractorVersion } = opts;
  const threshold = PROMOTION_THRESHOLDS[candidate.category as MemoryCategory];

  // Check rejection bank — don't re-ask things the driver already said no to
  const rejection = await checkRejectionBank({
    userId,
    category: candidate.category,
    content: candidate.content,
  });

  if (rejection) {
    if (candidate.confidence >= 0.6) {
      // Strong new evidence overrides previous rejection — revive
      const revivedId = await reviveRejectedCandidate({
        userId,
        sessionId,
        rejectedCandidateId: rejection.id,
        newEvidence: candidate,
        sourceIds,
        contextSnapshot,
        extractorVersion,
      });

      if (revivedId) {
        // Queue confirmation for the revived candidate
        const question = generateConfirmationQuestion(candidate.category, candidate.content);
        await queueConfirmation({
          userId,
          sessionId,
          candidateId: revivedId,
          questionText: question,
        });
      }

      return revivedId;
    } else {
      // Weak evidence + prior rejection = skip silently
      console.log(
        `[promote] Skipped "${candidate.content}" — matches rejection bank (confidence too low to revive)`
      );
      return null;
    }
  }

  // A. Direct high-confidence — promote immediately without writing candidate first
  if (candidate.confidence >= threshold.directConfidence && !threshold.requireMultipleSessions) {
    const memoryId = await storeMemory({
      userId,
      content: candidate.content,
      source: "conversation",
      weight: candidate.confidence >= 0.9 ? 2.0 : 1.5,
    });

    // Still write the candidate row for audit trail and analyser visibility
    const { data, error } = await supabase
      .from("memory_candidates")
      .insert({
        user_id: userId,
        session_id: sessionId,
        category: candidate.category,
        content: candidate.content,
        confidence: candidate.confidence,
        status: "confirmed",
        evidence_count: 1,
        evidence_quote: candidate.evidenceQuote,
        evidence_quotes: [candidate.evidenceQuote],
        source_type: sourceType,
        source_ids: sourceIds,
        context_snapshot: contextSnapshot,
        extraction_metadata: {
          extractor_version: extractorVersion,
          extraction_rationale: candidate.extractionRationale,
        },
        suggest_confirmation: false,
        promoted_at: new Date().toISOString(),
        promoted_memory_id: memoryId,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[promote] Failed to write promoted candidate:", error.message);
      return null;
    }

    console.log(
      `[promote] Auto-promoted "${candidate.content}" (${candidate.category}, confidence ${candidate.confidence})`
    );
    return data.id as string;
  }

  // B. Check for existing candidates with same category + similar content
  // Increment evidence_count if found; create new row (duplicate) otherwise
  const { data: existing } = await supabase
    .from("memory_candidates")
    .select("id, evidence_count, evidence_quotes")
    .eq("user_id", userId)
    .eq("category", candidate.category)
    .eq("content", candidate.content)
    .in("status", ["candidate", "pending_confirmation"])
    .limit(1)
    .single();

  let candidateId: string;

  if (existing) {
    // Increment existing candidate
    const newCount = (existing.evidence_count as number) + 1;
    const newQuotes = [...((existing.evidence_quotes as string[]) ?? []), candidate.evidenceQuote];

    const { data: updated, error } = await supabase
      .from("memory_candidates")
      .update({
        evidence_count: newCount,
        evidence_quotes: newQuotes,
        last_seen_at: new Date().toISOString(),
        confidence: Math.min(0.99, Math.max(candidate.confidence, (existing as { confidence?: number }).confidence ?? 0)),
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    if (error || !updated) {
      console.error("[promote] Failed to update candidate:", error?.message);
      return null;
    }

    candidateId = updated.id as string;
    console.log(`[promote] Updated candidate "${candidate.content}" (count: ${newCount})`);

    // Check if repetition threshold reached
    await checkAndPromoteByRepetition(userId, candidateId, candidate.category as MemoryCategory, newCount, candidate.content);
  } else {
    // New candidate row (duplicates intentional — analyser merges later)
    const { data: inserted, error } = await supabase
      .from("memory_candidates")
      .insert({
        user_id: userId,
        session_id: sessionId,
        category: candidate.category,
        content: candidate.content,
        confidence: candidate.confidence,
        status: candidate.suggestConfirmation ? "pending_confirmation" : "candidate",
        evidence_count: 1,
        evidence_quote: candidate.evidenceQuote,
        evidence_quotes: [candidate.evidenceQuote],
        source_type: sourceType,
        source_ids: sourceIds,
        context_snapshot: contextSnapshot,
        extraction_metadata: {
          extractor_version: extractorVersion,
          extraction_rationale: candidate.extractionRationale,
        },
        suggest_confirmation: candidate.suggestConfirmation,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      console.error("[promote] Failed to insert candidate:", error?.message);
      return null;
    }

    candidateId = inserted.id as string;
    console.log(
      `[promote] New candidate "${candidate.content}" (${candidate.category}, confidence ${candidate.confidence}, confirm: ${candidate.suggestConfirmation})`
    );

    // Queue a confirmation question if needed
    if (candidate.suggestConfirmation) {
      const question = generateConfirmationQuestion(candidate.category, candidate.content);
      await queueConfirmation({
        userId,
        sessionId,
        candidateId,
        questionText: question,
      });
    }
  }

  return candidateId;
}

/**
 * Check if a candidate has reached its repetition threshold and promote if so.
 * Only promotes if the threshold doesn't require multiple sessions,
 * or if session count check passes (simplified for now — full session tracking in Tier 3).
 */
async function checkAndPromoteByRepetition(
  userId: string,
  candidateId: string,
  category: MemoryCategory,
  evidenceCount: number,
  content: string
): Promise<void> {
  const threshold = PROMOTION_THRESHOLDS[category];

  if (evidenceCount < threshold.observationCount) return;
  if (threshold.requireMultipleSessions) {
    // Simplified: for now skip multi-session check — Tier 3 analyser handles this
    return;
  }

  const supabase = getSupabaseClient();
  if (!supabase) return;

  const memoryId = await storeMemory({
    userId,
    content,
    source: "conversation",
    weight: 1.2,
  });

  await supabase
    .from("memory_candidates")
    .update({
      status: "confirmed",
      promoted_at: new Date().toISOString(),
      promoted_memory_id: memoryId,
    })
    .eq("id", candidateId);

  console.log(
    `[promote] Repetition threshold met — promoted "${content}" (${category}, count: ${evidenceCount})`
  );
}
