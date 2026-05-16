import type { InterpretedMetrics, ReasoningTrigger } from "@eva/types";

/**
 * Threshold definitions for proactive triggers.
 * When a derived metric crosses a threshold, the reasoning loop fires
 * without the driver saying anything.
 *
 * Thresholds are conservative — we want EVA to speak up when it matters,
 * not on every minor fluctuation. Each threshold has a cooldown so EVA
 * doesn't repeat itself every signal frame.
 */

export interface ThresholdDef {
  metric: keyof InterpretedMetrics;
  direction: "above" | "below";
  value: number;
  /** Minimum ms between triggers for the same metric */
  cooldownMs: number;
}

export const THRESHOLDS: ThresholdDef[] = [
  // Harsh braking — fire immediately, short cooldown (safety-critical)
  {
    metric: "harshBrakingScore",
    direction: "above",
    value: 0.5,
    cooldownMs: 8000,
  },
  // Fatigue — fire when risk is high, longer cooldown (don't nag)
  {
    metric: "fatigueRisk",
    direction: "above",
    value: 0.65,
    cooldownMs: 120000, // 2 minutes
  },
  // Lateral instability — lane departure territory
  {
    metric: "lateralStabilityScore",
    direction: "below",
    value: 0.3,
    cooldownMs: 15000,
  },
  // Forward clearance dangerously low
  {
    metric: "forwardClearanceMeters",
    direction: "below",
    value: 10,
    cooldownMs: 5000,
  },
  // Overtake in progress (high likelihood)
  {
    metric: "overtakeLikelihood",
    direction: "above",
    value: 0.65,
    cooldownMs: 20000,
  },
  // Gap does not fit (negative margin)
  {
    metric: "gapFitMarginMeters",
    direction: "below",
    value: 0,
    cooldownMs: 10000,
  },
];

/**
 * Checks interpreted metrics against thresholds.
 * Returns any triggers that should fire, respecting cooldowns.
 */
export function checkThresholds(
  metrics: InterpretedMetrics,
  lastFiredAt: Map<string, number>
): ReasoningTrigger[] {
  const now = Date.now();
  const triggers: ReasoningTrigger[] = [];

  for (const def of THRESHOLDS) {
    const value = metrics[def.metric];

    // Skip null values (e.g. gapFitMarginMeters when data unavailable)
    if (value === null || value === undefined) continue;

    const numValue = value as number;
    const crossed =
      def.direction === "above"
        ? numValue > def.value
        : numValue < def.value;

    if (!crossed) continue;

    // Check cooldown
    const lastFired = lastFiredAt.get(def.metric) ?? 0;
    if (now - lastFired < def.cooldownMs) continue;

    // Fire — record time and build trigger
    lastFiredAt.set(def.metric, now);

    triggers.push({
      type: "signal_threshold",
      metric: def.metric,
      value: numValue,
      threshold: def.value,
      direction: def.direction,
      timestamp: new Date().toISOString(),
    });
  }

  return triggers;
}
