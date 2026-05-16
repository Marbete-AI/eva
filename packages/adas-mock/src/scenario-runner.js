import { v4 as uuidv4 } from "uuid";
import { lateBrakingScenario } from "./scenarios/late-braking.js";
import { overtakeScenario } from "./scenarios/overtake.js";
import { fatigueProxyScenario } from "./scenarios/fatigue-proxy.js";
import { gapEstimationScenario } from "./scenarios/gap-estimation.js";
const SCENARIOS = {
    late_braking: lateBrakingScenario,
    overtake: overtakeScenario,
    fatigue_proxy: fatigueProxyScenario,
    gap_estimation: gapEstimationScenario,
};
export function isValidScenario(name) {
    return name in SCENARIOS;
}
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
export function runScenario(sessionId, scenario, onFrame, loop = false) {
    const steps = SCENARIOS[scenario];
    let stopped = false;
    let timeoutHandle;
    async function run() {
        let stepIndex = 0;
        const runStep = () => {
            if (stopped)
                return;
            const step = steps[stepIndex];
            if (!step) {
                if (loop) {
                    stepIndex = 0;
                    timeoutHandle = setTimeout(runStep, 1000); // 1s gap between loops
                }
                return;
            }
            const frame = {
                frameId: uuidv4(),
                sessionId,
                capturedAt: new Date().toISOString(),
                signals: step.signals.map((s) => ({
                    ...s,
                    timestamp: new Date().toISOString(),
                    source: "adas_mock",
                    confidence: 0.92,
                })),
            };
            onFrame(frame);
            stepIndex++;
            const nextStep = steps[stepIndex];
            const delay = nextStep?.delayMs ?? 0;
            if (stepIndex < steps.length) {
                timeoutHandle = setTimeout(runStep, delay);
            }
            else if (loop) {
                stepIndex = 0;
                timeoutHandle = setTimeout(runStep, 1000);
            }
        };
        // Start with the first step's delay (usually 0)
        const firstDelay = steps[0]?.delayMs ?? 0;
        timeoutHandle = setTimeout(runStep, firstDelay);
    }
    void run();
    return () => {
        stopped = true;
        if (timeoutHandle !== undefined) {
            clearTimeout(timeoutHandle);
        }
    };
}
//# sourceMappingURL=scenario-runner.js.map