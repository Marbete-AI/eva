import type { VssSignal } from "@eva/types";
/**
 * SCENARIO: Highway Overtake
 *
 * Driver overtakes a slower vehicle on a dual carriageway.
 * No turn signal used (typical real-world behaviour).
 * LLM must infer the manoeuvre from raw kinematics and obstacle data.
 *
 * Sequence:
 *   0–1s    Following slower vehicle at 85 km/h, 28m gap
 *   1–2s    Driver decides to overtake, accelerates
 *   2–3s    Lane change left — lateral accel spike, yaw rate increases
 *   3–5s    Running parallel to slow vehicle, clear of it
 *   5–6s    Lane change right to return — lateral accel right
 *   6–7s    Normal cruise resumed at 105 km/h
 */
interface StepSignals {
    delayMs: number;
    signals: Array<Omit<VssSignal, "timestamp" | "source" | "confidence">>;
}
export declare const overtakeScenario: StepSignals[];
export {};
//# sourceMappingURL=overtake.d.ts.map