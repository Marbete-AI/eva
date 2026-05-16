import { getSupabaseClient } from "../supabase-client.js";

export interface PendingConfirmation {
  id: string;
  candidateId: string;
  category: string;
  content: string;
  suggestedQuestion: string;
}

/**
 * Returns all pending confirmation questions for a user that have not
 * yet been asked or answered, and have not expired.
 *
 * Used by the system prompt builder — Claude sees these and decides
 * when to naturally include a confirmation question.
 */
export async function getPendingConfirmations(
  userId: string,
  limit = 3
): Promise<PendingConfirmation[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("memory_confirmations")
    .select(`
      id,
      candidate_id,
      question_text,
      memory_candidates!inner(category, content)
    `)
    .eq("user_id", userId)
    .eq("outcome", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("asked_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  return data.map(row => {
    const candidates = row.memory_candidates as Array<{ category: string; content: string }> | { category: string; content: string };
    const candidate = Array.isArray(candidates) ? candidates[0] : candidates;
    return {
      id: row.id as string,
      candidateId: row.candidate_id as string,
      category: candidate?.category ?? "",
      content: candidate?.content ?? "",
      suggestedQuestion: row.question_text as string,
    };
  });
}

/**
 * Queue a new confirmation question for a candidate.
 * Only queued if no existing pending confirmation for the same candidate.
 * Called by the promote step when suggest_confirmation = true.
 */
export async function queueConfirmation(opts: {
  userId: string;
  sessionId: string;
  candidateId: string;
  questionText: string;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  // Check no existing pending confirmation for this candidate
  const { data: existing } = await supabase
    .from("memory_confirmations")
    .select("id")
    .eq("candidate_id", opts.candidateId)
    .eq("outcome", "pending")
    .limit(1)
    .single();

  if (existing) return; // Already queued

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("memory_confirmations").insert({
    user_id: opts.userId,
    session_id: opts.sessionId,
    candidate_id: opts.candidateId,
    question_text: opts.questionText,
    outcome: "pending",
    expires_at: expiresAt,
  });

  console.log(`[confirmation-queue] Queued confirmation for candidate ${opts.candidateId}`);
}

/**
 * Record the outcome of a confirmation question.
 * Called when the driver answers (accepted/rejected) or when the session ends (unanswered).
 */
export async function recordConfirmationOutcome(opts: {
  confirmationId: string;
  outcome: "accepted" | "rejected" | "unanswered";
  driverResponse?: string;
  answeredInMessageId?: string | null;
}): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  await supabase
    .from("memory_confirmations")
    .update({
      outcome: opts.outcome,
      driver_response: opts.driverResponse ?? null,
      answered_in_message_id: opts.answeredInMessageId ?? null,
      answered_at: new Date().toISOString(),
    })
    .eq("id", opts.confirmationId);

  // If accepted — promote the candidate to Tier 2
  if (opts.outcome === "accepted") {
    const { data: confirmation } = await supabase
      .from("memory_confirmations")
      .select("candidate_id")
      .eq("id", opts.confirmationId)
      .single();

    if (confirmation) {
      await promoteConfirmedCandidate(confirmation.candidate_id as string);
    }
  }

  // If rejected — update candidate status and set rejection TTL
  if (opts.outcome === "rejected") {
    const { data: confirmation } = await supabase
      .from("memory_confirmations")
      .select("candidate_id")
      .eq("id", opts.confirmationId)
      .single();

    if (confirmation) {
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase
        .from("memory_candidates")
        .update({
          status: "rejected",
          rejection_expires_at: expiresAt,
        })
        .eq("id", confirmation.candidate_id as string);

      console.log(
        `[confirmation-queue] Candidate ${confirmation.candidate_id} rejected — expires ${expiresAt}`
      );
    }
  }
}

/**
 * Generate a natural, discreet confirmation question for a candidate.
 * Returns phrasing that does not sound robotic.
 */
export function generateConfirmationQuestion(category: string, content: string): string {
  // Strip "Driver " prefix from content for natural phrasing
  const fact = content.replace(/^Driver['s]* /i, "").replace(/^Driver /i, "");

  const templates: Record<string, string[]> = {
    identity: [
      `Good to know — should I keep that in mind for future drives?`,
    ],
    preference_routing: [
      `Should I factor that in when suggesting routes going forward?`,
      `Want me to keep that in mind for future trips?`,
    ],
    preference_audio: [
      `Is that generally what you prefer — want me to remember it?`,
    ],
    preference_communication: [
      `Want me to keep that in mind going forward?`,
    ],
    preference_climate: [
      `Should I remember that for future drives?`,
    ],
    routine: [
      `Is that a regular thing for you — want me to keep it in mind?`,
    ],
    relationship: [
      `Should I hold onto that for future drives?`,
    ],
    health: [
      `Want me to keep that as a note going forward?`,
    ],
    vehicle_state_pattern: [
      `Is that typically how you manage it — should I keep it in mind?`,
    ],
    emotional_state: [
      `Should I factor that in when suggesting routes today?`,
    ],
    behavioural_driving: [
      `Want me to keep that in mind going forward?`,
    ],
    behavioural_interaction: [
      `Should I adjust how I respond based on that?`,
    ],
  };

  const options = templates[category] ?? [
    `Should I remember that for future drives?`,
    `Want me to keep that in mind going forward?`,
  ];

  return options[Math.floor(Math.random() * options.length)] ?? options[0]!;
}

async function promoteConfirmedCandidate(candidateId: string): Promise<void> {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data: candidate } = await supabase
    .from("memory_candidates")
    .select("user_id, content, category")
    .eq("id", candidateId)
    .single();

  if (!candidate) return;

  const { storeMemory } = await import("../store.js");
  const memoryId = await storeMemory({
    userId: candidate.user_id as string,
    content: candidate.content as string,
    source: "explicit_preference",
    weight: 1.8, // Driver-confirmed — high weight
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
    `[confirmation-queue] Driver confirmed "${candidate.content}" — promoted to Tier 2`
  );
}
