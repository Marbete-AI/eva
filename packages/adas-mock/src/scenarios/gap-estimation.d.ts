import type { VssSignal } from "@eva/types";
/**
 * SCENARIO: Gap / Clearance Estimation
 * Use case: "Can I fit through that gap?"
 *
 * Simulates approaching a narrow section (roadworks, parked vehicles, tight lane).
 * The signal_interpreter derives gapFitMarginMeters from:
 *   obstacle_front_left.distance + obstacle_front_right.distance - vehicle_width_mm / 1000
 *
 * Three sub-scenarios presented in sequence:
 *   A) Comfortable gap — fits with margin
 *   B) Tight gap — fits but marginal (< 0.3m per side)
 *   C) Does not fit — negative margin
 *
 * Vehicle width assumed: 2050mm (including mirrors, typical SUV).
 * LLM never sees this labelling. It sees distances and vehicle width.
 */
interface StepSignals {
    delayMs: number;
    signals: Array<Omit<VssSignal, "timestamp" | "source" | "confidence">>;
}
export declare const gapEstimationScenario: StepSignals[];
export {};
//# sourceMappingURL=gap-estimation.d.ts.map