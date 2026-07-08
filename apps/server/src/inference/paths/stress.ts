import type { Inference, InferencePathDef, SiloSnapshot } from "@eva/types";

/**
 * Stress detection path — v1.
 *
 * Works without ADAS (normal participant car). ADAS harsh-braking data
 * is additive and sharpens confidence when present.
 *
 * Evidence sources (weight):
 *   silo1.harshBraking       (0.30) — ADAS, when available
 *   silo1.lateralInstability (0.10) — ADAS, when available
 *   silo2.frustrationMarkers (0.40) — "come on", "ugh", "not again"
 *   silo2.terseness          (0.15) — short sustained replies
 *
 * Emission threshold: 0.35.
 * Decay half-life: 10 minutes (stress can resolve quickly with breathing room).
 */
export const stressPath: InferencePathDef = {
  id: "stress-detection",
  version: "v1",
  emitsState: "stressed",

  run(snapshot: SiloSnapshot): Inference | null {
    const evidence: Inference["evidence"] = [];
    let confidence = 0;

    // ── Silo 1: harsh braking (optional ADAS) ─────────────────────────────
    if (snapshot.adas && snapshot.adas.harshBrakingScore >= 0.5) {
      const contribution = Math.min(0.3, snapshot.adas.harshBrakingScore * 0.3);
      confidence += contribution;
      evidence.push({
        source: "silo1.harshBrakingScore",
        value: snapshot.adas.harshBrakingScore,
        detail: `Harsh braking score ${snapshot.adas.harshBrakingScore}`,
      });
    }

    // ── Silo 1: lateral instability (optional ADAS) ───────────────────────
    if (snapshot.adas && snapshot.adas.lateralStabilityScore < 0.5) {
      confidence += 0.1;
      evidence.push({
        source: "silo1.lateralStabilityScore",
        value: snapshot.adas.lateralStabilityScore,
        detail: `Lateral stability low (${snapshot.adas.lateralStabilityScore})`,
      });
    }

    // ── Silo 2: frustration markers ────────────────────────────────────────
    if (snapshot.driverInput.frustrationMarkers.length > 0) {
      // More markers = more confidence, capped
      const contribution = Math.min(
        0.4,
        0.25 + snapshot.driverInput.frustrationMarkers.length * 0.08
      );
      confidence += contribution;
      evidence.push({
        source: "silo2.frustrationMarkers",
        value: snapshot.driverInput.frustrationMarkers.join(", "),
        detail: `Frustration language: "${snapshot.driverInput.frustrationMarkers.join('", "')}"`,
      });
    }

    // ── Silo 2: terseness (sustained short replies) ────────────────────────
    if (
      snapshot.driverInput.meanMessageLength !== null &&
      snapshot.driverInput.meanMessageLength <= 4 &&
      snapshot.driverInput.messageCount >= 3
    ) {
      confidence += 0.15;
      evidence.push({
        source: "silo2.terseness",
        value: snapshot.driverInput.meanMessageLength,
        detail: `Mean message length ${snapshot.driverInput.meanMessageLength} words over ${snapshot.driverInput.messageCount} messages (terse)`,
      });
    }

    confidence = Math.min(1, Math.round(confidence * 100) / 100);

    if (confidence < 0.35) return null;

    // Decay: 10-minute half-life
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return {
      type: "driver_state",
      state: "stressed",
      confidence,
      evidence,
      pathId: this.id,
      pathVersion: this.version,
      expiresAt,
    };
  },
};
