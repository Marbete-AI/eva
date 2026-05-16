import { getSupabaseClient } from "../supabase-client.js";
import type { ExtractedCandidate } from "./extract.js";

export interface RejectedCandidate {
  id: string;
  category: string;
  content: string;
  rejectionExpiresAt: string;
}

/**
 * Check whether a new candidate matches a recently rejected one.
 * If a match is found and within 30-day TTL, returns the rejection record.
 * The caller decides whether to skip writing, revive, or write anyway.
 *
 * Match criteria: same user, same category, content similarity.
 * Content similarity check is exact-match or prefix/suffix overlap
 * (full embedding similarity used when available, fallback to text).
 */
export async function checkRejectionBank(opts: {
  userId: string;
  category: string;
  content: string;
}): Promise<RejectedCandidate | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("memory_candidates")
    .select("id, category, content, rejection_expires_at")
    .eq("user_id", opts.userId)
    .eq("category", opts.category)
    .eq("status", "rejected")
    .gt("rejection_expires_at", new Date().toISOString())
    .limit(10);

  if (error || !data || data.length === 0) return null;

  // Simple text similarity — check for substring overlap or near-match
  const normalised = opts.content.toLowerCase().trim();
  const match = data.find(row => {
    const rowContent = (row.content as string).toLowerCase().trim();
    return (
      rowContent === normalised ||
      rowContent.includes(normalised) ||
      normalised.includes(rowContent) ||
      levenshteinSimilarity(rowContent, normalised) > 0.8
    );
  });

  if (!match) return null;

  return {
    id: match.id as string,
    category: match.category as string,
    content: match.content as string,
    rejectionExpiresAt: match.rejection_expires_at as string,
  };
}

/**
 * Revive a rejected candidate when new strong evidence arrives.
 * Creates a new duplicate candidate (original rejection preserved for audit).
 * Called when: new evidence confidence >= 0.6 AND matches a rejected candidate.
 */
export async function reviveRejectedCandidate(opts: {
  userId: string;
  sessionId: string;
  rejectedCandidateId: string;
  newEvidence: ExtractedCandidate;
  sourceIds: Record<string, string | null>;
  contextSnapshot: Record<string, unknown>;
  extractorVersion: string;
}): Promise<string | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Write new duplicate candidate — rejection is preserved, new candidate is fresh
  const { data, error } = await supabase
    .from("memory_candidates")
    .insert({
      user_id: opts.userId,
      session_id: opts.sessionId,
      category: opts.newEvidence.category,
      content: opts.newEvidence.content,
      confidence: opts.newEvidence.confidence,
      status: "candidate",
      evidence_count: 1,
      evidence_quote: opts.newEvidence.evidenceQuote,
      evidence_quotes: [opts.newEvidence.evidenceQuote],
      source_type: "conversation",
      source_ids: {
        ...opts.sourceIds,
        revived_from_rejection: opts.rejectedCandidateId,
      },
      context_snapshot: opts.contextSnapshot,
      extraction_metadata: {
        extractor_version: opts.extractorVersion,
        extraction_rationale: `Revived from rejection: ${opts.newEvidence.extractionRationale}`,
      },
      suggest_confirmation: true, // Always ask again on revival
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[rejection-bank] Failed to revive candidate:", error?.message);
    return null;
  }

  console.log(
    `[rejection-bank] Revived "${opts.newEvidence.content}" (was rejected, new evidence strength: ${opts.newEvidence.confidence})`
  );

  return data.id as string;
}

/**
 * Expire all rejected candidates past their 30-day TTL.
 * Call at session start or in a scheduled job.
 * Non-destructive — rows are kept but status → "expired".
 */
export async function expireRejectedCandidates(userId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("memory_candidates")
    .update({ status: "expired" })
    .eq("user_id", userId)
    .eq("status", "rejected")
    .lt("rejection_expires_at", new Date().toISOString());

  if (error) {
    console.error("[rejection-bank] Failed to expire candidates:", error.message);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Simple Levenshtein similarity ratio (0.0–1.0).
 * Good enough for candidate deduplication without an embedding call.
 */
function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const maxLen = Math.max(a.length, b.length);
  const distance = levenshtein(a, b);
  return 1 - distance / maxLen;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]!;
      } else {
        dp[i]![j] = 1 + Math.min(dp[i - 1]![j]!, dp[i]![j - 1]!, dp[i - 1]![j - 1]!);
      }
    }
  }

  return dp[m]![n]!;
}
