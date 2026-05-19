import { generateText } from "ai";
import { getSupabaseClient } from "../supabase-client.js";
import { storeMemory } from "../store.js";
import { createReasoningModel, getReasoningConfig } from "../../providers/reasoning/index.js";

export interface AnalyserInput {
  userId: string;
  sessionId: string;
}

/**
 * Session-end pattern analyser (Tier 3).
 *
 * Runs after every session close. Looks across:
 *   - Last 100 message turns for the user (cross-session)
 *   - Tier 1 candidates (all statuses)
 *   - Feedback events
 *   - ADAS events (interpreted metrics)
 *
 * Detects cross-modal patterns that cannot be seen in a single session.
 * Promotes high-confidence patterns to Tier 2 (memory_chunks).
 *
 * Fire-and-forget — called from session stop(), never blocks anything.
 * Non-fatal if Supabase or model not configured.
 */
export async function runSessionAnalyser(input: AnalyserInput): Promise<void> {
  const { userId, sessionId } = input;
  const supabase = getSupabaseClient();
  if (!supabase) return;

  try {
    // Gather evidence across all signal sources
    const [messageHistory, candidates, feedbackEvents, adasSummary] =
      await Promise.all([
        getRecentMessageHistory(userId),
        getRecentCandidates(userId),
        getRecentFeedback(userId),
        getAdasSummary(userId),
      ]);

    if (
      messageHistory.length === 0 &&
      candidates.length === 0 &&
      feedbackEvents.length === 0
    ) {
      return; // Not enough data yet
    }

    // Run the pattern detection model
    const patterns = await detectPatterns({
      userId,
      messageHistory,
      candidates,
      feedbackEvents,
      adasSummary,
    });

    if (patterns.length === 0) return;

    console.log(
      `[analyser] Detected ${patterns.length} pattern(s) for user ${userId}`
    );

    // Write patterns and promote high-confidence ones to Tier 2
    for (const pattern of patterns) {
      await writePatternAndMaybePromote(userId, sessionId, pattern);
    }
  } catch (err) {
    console.error(`[analyser] Session analysis failed for ${userId}:`, err);
  }
}

// ── Data gathering ────────────────────────────────────────────────────────────

async function getRecentMessageHistory(
  userId: string
): Promise<Array<{ role: string; content: string; sessionId: string }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("messages")
    .select("role, content, session_id, sessions!inner(user_id)")
    .eq("sessions.user_id", userId)
    .in("role", ["user", "assistant"])
    .order("timestamp", { ascending: false })
    .limit(100);

  if (error || !data) return [];

  return data.map(r => ({
    role: r.role as string,
    content: (r.content as string).slice(0, 300), // Truncate for analyser context
    sessionId: r.session_id as string,
  }));
}

async function getRecentCandidates(
  userId: string
): Promise<Array<{ category: string; content: string; confidence: number; status: string; evidenceCount: number }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("memory_candidates")
    .select("category, content, confidence, status, evidence_count")
    .eq("user_id", userId)
    .not("status", "eq", "expired")
    .order("last_seen_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map(r => ({
    category: r.category as string,
    content: r.content as string,
    confidence: r.confidence as number,
    status: r.status as string,
    evidenceCount: r.evidence_count as number,
  }));
}

async function getRecentFeedback(
  userId: string
): Promise<Array<{ type: string; value: string | null }>> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("feedback")
    .select("type, value, sessions!inner(user_id)")
    .eq("sessions.user_id", userId)
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data.map(r => ({ type: r.type as string, value: r.value as string | null }));
}

async function getAdasSummary(userId: string): Promise<string> {
  const supabase = getSupabaseClient();
  if (!supabase) return "";

  const { data, error } = await supabase
    .from("adas_events")
    .select("interpreted_metrics, sessions!inner(user_id)")
    .eq("sessions.user_id", userId)
    .not("interpreted_metrics", "is", null)
    .order("timestamp", { ascending: false })
    .limit(50);

  if (error || !data || data.length === 0) return "";

  // Compute averages across recent ADAS events
  interface Metrics { harsh_braking_score?: number; fatigue_risk?: number; lateral_stability_score?: number }
  const metrics = data
    .map(r => r.interpreted_metrics as Metrics)
    .filter(Boolean);

  if (metrics.length === 0) return "";

  const avg = (key: keyof Metrics) => {
    const vals = metrics.map(m => m[key]).filter((v): v is number => v !== undefined);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2) : "unknown";
  };

  return `Avg harsh braking: ${avg("harsh_braking_score")}, avg fatigue risk: ${avg("fatigue_risk")}, avg lateral stability: ${avg("lateral_stability_score")} (over ${metrics.length} events)`;
}

// ── Pattern detection ─────────────────────────────────────────────────────────

interface DetectedPattern {
  patternType: string;
  description: string;
  confidence: number;
  evidence: unknown[];
}

async function detectPatterns(input: {
  userId: string;
  messageHistory: Array<{ role: string; content: string; sessionId: string }>;
  candidates: Array<{ category: string; content: string; confidence: number; status: string; evidenceCount: number }>;
  feedbackEvents: Array<{ type: string; value: string | null }>;
  adasSummary: string;
}): Promise<DetectedPattern[]> {
  const config = getReasoningConfig();
  const model = createReasoningModel(config);

  const systemPrompt = `<task>
You are a behavioural pattern analyser for EVA, an in-cabin AI co-pilot.

Given evidence from a driver's sessions, identify cross-session behavioural patterns.
These are patterns that could not be seen in a single session — they require multiple
data points across time.

Return ONLY a JSON array. Return [] if no patterns are clearly evident.

For each pattern found, return:
- patternType: dot-separated identifier (e.g. "routine.morning_commute", "driving_style.harsh_braker",
  "interaction.prefers_brief_responses", "range_anxiety.below_30_percent",
  "audio.weekday_radio_preference")
- description: one sentence suitable for memory_chunks (will be used in EVA's context)
- confidence: 0.0–1.0 (only return patterns with confidence >= 0.6)
- evidence: array of 1–3 brief evidence snippets that support this pattern

Be conservative — only return patterns you can clearly support with the evidence.
Do not invent patterns. Do not return obvious single-session facts.
Return ONLY valid JSON — no prose, no markdown, no code fences.
</task>`;

  const userPrompt = `<evidence>
<message_history count="${input.messageHistory.length}">
${input.messageHistory
  .slice(0, 30) // Limit to most recent 30 for the analyser prompt
  .map(m => `[${m.role}]: ${m.content}`)
  .join("\n")}
</message_history>

<memory_candidates count="${input.candidates.length}">
${input.candidates
  .map(c => `[${c.category}] "${c.content}" — confidence: ${c.confidence}, status: ${c.status}, seen: ${c.evidenceCount}x`)
  .join("\n")}
</memory_candidates>

<feedback count="${input.feedbackEvents.length}">
${input.feedbackEvents
  .map(f => `${f.type}${f.value ? `: "${f.value}"` : ""}`)
  .join("\n")}
</feedback>

<adas_summary>
${input.adasSummary || "No ADAS data available."}
</adas_summary>
</evidence>

Identify behavioural patterns visible across this evidence.`;

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });

    // Strip markdown code fences if the model wraps its response in them
    const raw = result.text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(isValidPattern) as DetectedPattern[];
  } catch (err) {
    console.error("[analyser] Pattern detection failed:", err);
    return [];
  }
}

function isValidPattern(p: unknown): p is DetectedPattern {
  if (typeof p !== "object" || p === null) return false;
  const obj = p as Record<string, unknown>;
  return (
    typeof obj["patternType"] === "string" &&
    typeof obj["description"] === "string" &&
    typeof obj["confidence"] === "number" &&
    obj["confidence"] >= 0.6 &&
    Array.isArray(obj["evidence"])
  );
}

// ── Writing + promotion ───────────────────────────────────────────────────────

const PATTERN_PROMOTION_THRESHOLD = 0.8;

async function writePatternAndMaybePromote(
  userId: string,
  sessionId: string,
  pattern: DetectedPattern
): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Check if this pattern already exists — update confidence + evidence_count
  const { data: existing } = await supabase
    .from("behavioural_patterns")
    .select("id, confidence, evidence_count, session_count")
    .eq("user_id", userId)
    .eq("pattern_type", pattern.patternType)
    .single();

  let patternId: string;

  if (existing) {
    const newConfidence = Math.min(
      0.99,
      (existing.confidence as number) * 0.7 + pattern.confidence * 0.3
    );
    const newCount = (existing.evidence_count as number) + 1;
    const newSessionCount = (existing.session_count as number) + 1;

    const { data: updated } = await supabase
      .from("behavioural_patterns")
      .update({
        confidence: newConfidence,
        evidence_count: newCount,
        session_count: newSessionCount,
        last_updated_at: new Date().toISOString(),
        evidence: pattern.evidence,
        description: pattern.description, // Update description with latest
      })
      .eq("id", existing.id)
      .select("id")
      .single();

    patternId = (updated?.id ?? existing.id) as string;
    console.log(
      `[analyser] Updated pattern "${pattern.patternType}" (confidence: ${newConfidence.toFixed(2)}, sessions: ${newSessionCount})`
    );
  } else {
    const { data: inserted } = await supabase
      .from("behavioural_patterns")
      .insert({
        user_id: userId,
        pattern_type: pattern.patternType,
        description: pattern.description,
        evidence: pattern.evidence,
        confidence: pattern.confidence,
        session_count: 1,
        evidence_count: 1,
      })
      .select("id")
      .single();

    if (!inserted) return;
    patternId = inserted.id as string;
    console.log(
      `[analyser] New pattern "${pattern.patternType}" (confidence: ${pattern.confidence.toFixed(2)})`
    );
  }

  // Promote to Tier 2 if confidence is high enough
  const finalConfidence = existing
    ? Math.min(0.99, (existing.confidence as number) * 0.7 + pattern.confidence * 0.3)
    : pattern.confidence;

  if (finalConfidence >= PATTERN_PROMOTION_THRESHOLD) {
    const memoryId = await storeMemory({
      userId,
      content: pattern.description,
      source: "adas_event",
      weight: finalConfidence * 1.5,
    });

    await supabase
      .from("behavioural_patterns")
      .update({
        promoted_at: new Date().toISOString(),
        promoted_memory_id: memoryId,
      })
      .eq("id", patternId);

    console.log(
      `[analyser] Promoted pattern "${pattern.patternType}" to Tier 2 (confidence: ${finalConfidence.toFixed(2)})`
    );
  }
}
