import type { VssSignal } from "@eva/types";
/**
 * SCENARIO: Fatigue Proxy (camera-free)
 *
 * Simulates deteriorating driver alertness over a long monotonous highway drive.
 * Camera-based DMS is EVA-2. EVA-1 uses the SDLP proxy:
 *   - Increasing micro-corrections in steering wheel angle (Standard Lane Deviation Proxy)
 *   - Slow wandering lateral acceleration
 *   - Occasional speed variation without cause
 *   - Long session duration
 *
 * The LLM does NOT see "fatigue". It sees steering variance increasing,
 * small unexpected lateral movements, and session time growing.
 * The signal_interpreter derives fatigueRisk from these.
 *
 * Sequence: 8 snapshots representing ~40 minutes of monotonous driving.
 * Timestamps are relative — in real use the mock server applies real wall-clock delays.
 */
interface StepSignals {
    delayMs: number;
    signals: Array<Omit<VssSignal, "timestamp" | "source" | "confidence">>;
}
export declare const fatigueProxyScenario: StepSignals[];
export {};
//# sourceMappingURL=fatigue-proxy.d.ts.map