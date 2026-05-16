import type { VssSignal } from "@eva/types";
/**
 * SCENARIO: Late / Harsh Braking
 *
 * Internal state machine knows this is "late braking".
 * The signal stream emits only raw VSS values — no labels.
 * The reasoning LLM must infer what is happening from the numbers.
 *
 * Sequence:
 *   0–2s   Normal highway cruise at 110 km/h, clear road ahead
 *   2–3s   Lead vehicle suddenly appears close (front obstacle drops to 18m)
 *   3–4s   Driver applies hard brake — decel > 0.7g, brake pedal > 80%
 *   4–5s   EBA engages, speed reduces rapidly
 *   5–7s   Stabilises, speed settles at ~60 km/h, normal following distance
 */
interface StepSignals {
    delayMs: number;
    signals: Array<Omit<VssSignal, "timestamp" | "source" | "confidence">>;
}
export declare const lateBrakingScenario: StepSignals[];
export {};
//# sourceMappingURL=late-braking.d.ts.map