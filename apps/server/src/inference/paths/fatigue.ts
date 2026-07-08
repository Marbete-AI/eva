import type { Inference, InferencePathDef, SiloSnapshot } from "@eva/types";

/**
 * Fatigue detection path — v1.
 *
 * Designed for real participant cars where ADAS may not be available.
 * ADAS signals are ADDITIVE: the path produces useful inferences from
 * text + time + session duration alone, and sharpens when ADAS arrives.
 *
 * Evidence sources (weight):
 *   silo1.fatigueRisk        (0.35) — ADAS steering variance proxy, when available
 *   silo2.fatigueMentions    (0.40) — explicit driver mention ("I'm knackered")
 *   silo2.hedgeDensity       (0.10) — cognitive load indicator
 *   silo4.sessionDuration    (0.15) — >90 min continuous driving
 *   silo4.lateNight          (0.15) — 22:00-05:00 window
 *
 * Without ADAS the max achievable confidence is ~0.80 (mentions + duration
 * + late night). That is intentionally enough to trigger a gentle check-in
 * but the state locks higher only when the driver confirms.
 *
 * Emission threshold: 0.35 — below that, no inference is emitted.
 * Decay half-life: 30 minutes (fatigue resolves slowly).
 */
export const fatiguePath: InferencePathDef = {
  id: "fatigue-detection",
  version: "v1",
  emitsState: "fatigued",

  run(snapshot: SiloSnapshot): Inference | null {
    const evidence: Inference["evidence"] = [];
    let confidence = 0;

    // ── Silo 1: ADAS (optional) ────────────────────────────────────────────
    if (snapshot.adas && snapshot.adas.fatigueRisk > 0.3) {
      const contribution = Math.min(0.35, snapshot.adas.fatigueRisk * 0.35);
      confidence += contribution;
      evidence.push({
        source: "silo1.fatigueRisk",
        value: snapshot.adas.fatigueRisk,
        detail: `ADAS fatigue risk ${snapshot.adas.fatigueRisk} (steering variance proxy)`,
      });
    }

    // ── Silo 2: explicit fatigue mentions ──────────────────────────────────
    if (snapshot.driverInput.fatigueMentions.length > 0) {
      confidence += 0.4;
      evidence.push({
        source: "silo2.fatigueMentions",
        value: snapshot.driverInput.fatigueMentions.join(", "),
        detail: `Driver mentioned: "${snapshot.driverInput.fatigueMentions.join('", "')}"`,
      });
    }

    // ── Silo 2: hedge density (mild cognitive load signal) ─────────────────
    if (
      snapshot.driverInput.hedgeDensity !== null &&
      snapshot.driverInput.hedgeDensity >= 4 &&
      snapshot.driverInput.messageCount >= 2
    ) {
      confidence += 0.1;
      evidence.push({
        source: "silo2.hedgeDensity",
        value: snapshot.driverInput.hedgeDensity,
        detail: `Hedge density ${snapshot.driverInput.hedgeDensity} per 100 words (elevated)`,
      });
    }

    // ── Silo 4: session duration ───────────────────────────────────────────
    const duration = snapshot.environment.sessionDurationMin;
    if (duration >= 90) {
      confidence += 0.15;
      evidence.push({
        source: "silo4.sessionDuration",
        value: duration,
        detail: `${duration} minutes continuous driving`,
      });
    } else if (duration >= 60) {
      confidence += 0.08;
      evidence.push({
        source: "silo4.sessionDuration",
        value: duration,
        detail: `${duration} minutes driving (moderate)`,
      });
    }

    // ── Silo 4: late night ─────────────────────────────────────────────────
    if (snapshot.environment.isLateNight) {
      confidence += 0.15;
      evidence.push({
        source: "silo4.lateNight",
        value: snapshot.environment.timeOfDayHour,
        detail: `Late-night drive (${snapshot.environment.timeOfDayHour}:00)`,
      });
    }

    confidence = Math.min(1, Math.round(confidence * 100) / 100);

    // Emission threshold
    if (confidence < 0.35) return null;

    // Decay: 30-minute half-life
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    return {
      type: "driver_state",
      state: "fatigued",
      confidence,
      evidence,
      pathId: this.id,
      pathVersion: this.version,
      expiresAt,
    };
  },
};
