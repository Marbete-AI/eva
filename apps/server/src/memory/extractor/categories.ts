/**
 * Memory category definitions.
 * Used by the extractor prompt and the promotion engine.
 * Add new categories here — the schema accepts any text value.
 */

export const MEMORY_CATEGORIES = [
  "identity",
  "preference_routing",
  "preference_audio",
  "preference_communication",
  "preference_climate",
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
  identity:                    { directConfidence: 0.80, observationCount: 1,  requireMultipleSessions: false },
  preference_routing:          { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_audio:            { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_communication:    { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  preference_climate:          { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  routine:                     { directConfidence: 0.80, observationCount: 3,  requireMultipleSessions: true  },
  relationship:                { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  emotional_state:             { directConfidence: 0.70, observationCount: 3,  requireMultipleSessions: true  },
  behavioural_driving:         { directConfidence: 0.90, observationCount: 5,  requireMultipleSessions: true  },
  behavioural_interaction:     { directConfidence: 0.80, observationCount: 3,  requireMultipleSessions: false },
  vehicle_state_pattern:       { directConfidence: 0.75, observationCount: 2,  requireMultipleSessions: false },
  health:                      { directConfidence: 0.75, observationCount: 1,  requireMultipleSessions: false },
};
