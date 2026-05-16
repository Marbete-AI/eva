import type { AdasSignalFrame } from "@eva/types";
export type ScenarioName = "late_braking" | "overtake" | "fatigue_proxy" | "gap_estimation";
export declare function isValidScenario(name: string): name is ScenarioName;
export type FrameCallback = (frame: AdasSignalFrame) => void;
/**
 * Runs a scenario, emitting AdasSignalFrames at the correct timing.
 * The scenario label is NEVER included in the emitted frames.
 * Only raw VSS signal values are emitted.
 *
 * @param sessionId  The current session ID
 * @param scenario   Which scenario to run
 * @param onFrame    Called with each frame as it fires
 * @param loop       Whether to loop continuously (default: false)
 * @returns          A stop function
 */
export declare function runScenario(sessionId: string, scenario: ScenarioName, onFrame: FrameCallback, loop?: boolean): () => void;
//# sourceMappingURL=scenario-runner.d.ts.map