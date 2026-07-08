/**
 * Memory category definitions.
 * Used by the extractor prompt, the promotion engine, and retrieval decay.
 * Add new categories here — the schema accepts any text value.
 */

export const MEMORY_CATEGORIES = [
  "identity",
  "preference_routing",
  "preference_audio",
  "preference_communication",
  "preference_climate",
  "preference_assumption_tolerance",
  "routine",
  "relationship",
  "emotional_state",
  "behavioural_driving",
  "behavioural_interaction",
  "vehicle_state_pattern",
  "health",
] as const;

export type MemoryCategory = typeof MEMORY_CATEGORIES[number];

/**
 * Promotion thresholds — aggressive, as per design decision.
 * Direct high-confidence statements promote immediately.
 * Patterns require repetition across sessions.
 */
export const PROMOTION_THRESHOLDS: Record<MemoryCategory, {
  directConfidence: number;  // Promote immediately if confidence >= this
  observationCount: number;  // Promote after N observations
  requireMultipleSessions: boolean;
}> = {
  identity:                        { directConfidence: 0.80, observationCount: 1,  requireMultipleSessions: false },
  preference_routing:              { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_audio:                { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_communication:        { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_climate:              { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_assumption_tolerance: { directConfidence: 0.80, observationCount: 3,  requireMultipleSessions: false },
  routine:                         { directConfidence: 0.80, observationCount: 3,  requireMultipleSessions: true  },
  relationship:                    { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  emotional_state:                 { directConfidence: 0.70, observationCount: 3,  requireMultipleSessions: true  },
  behavioural_driving:             { directConfidence: 0.90, observationCount: 5,  requireMultipleSessions: true  },
  behavioural_interaction:         { directConfidence: 0.80, observationCount: 3,  requireMultipleSessions: false },
  vehicle_state_pattern:           { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  health:                          { directConfidence: 0.75, observationCount: 1,  requireMultipleSessions: false },
};

/**
 * Retrieval decay parameters — real-world tuned.
 *
 * halfLifeDays: how fast the recency component of the retrieval score decays.
 *   A participant drives 2-4 times/week — a 7-day half-life made confirmed
 *   preferences nearly irrelevant within a month. Category-aware half-lives
 *   let facts persist while moods fade.
 *
 * recencyFloor: recency never decays below this — a confirmed memory is
 *   never fully invisible to retrieval, regardless of age.
 *
 * Decay is computed from last_reinforced_at (not created_at) — re-observing
 * or re-confirming a memory restarts its decay clock.
 */
export const DECAY_PARAMS: Record<MemoryCategory, {
  halfLifeDays: number;
  recencyFloor: number;
}> = {
  identity:                        { halfLifeDays: 365, recencyFloor: 0.60 }, // names don't expire
  preference_routing:              { halfLifeDays: 60,  recencyFloor: 0.25 },
  preference_audio:                { halfLifeDays: 60,  recencyFloor: 0.25 },
  preference_communication:        { halfLifeDays: 60,  recencyFloor: 0.25 },
  preference_climate:              { halfLifeDays: 60,  recencyFloor: 0.25 },
  preference_assumption_tolerance: { halfLifeDays: 45,  recencyFloor: 0.25 },
  routine:                         { halfLifeDays: 45,  recencyFloor: 0.20 }, // routines change with life
  relationship:                    { halfLifeDays: 180, recencyFloor: 0.40 }, // partner's name persists
  emotional_state:                 { halfLifeDays: 2,   recencyFloor: 0.00 }, // moods fade fast, fully
  behavioural_driving:             { halfLifeDays: 45,  recencyFloor: 0.20 },
  behavioural_interaction:         { halfLifeDays: 45,  recencyFloor: 0.20 },
  vehicle_state_pattern:           { halfLifeDays: 30,  recencyFloor: 0.15 },
  health:                          { halfLifeDays: 180, recencyFloor: 0.40 }, // health facts persist
};

/** Fallback decay for chunks with no category (pre-migration rows). */
export const DEFAULT_DECAY = { halfLifeDays: 30, recencyFloor: 0.15 };
