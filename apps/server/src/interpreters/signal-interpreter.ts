import type { AdasSignalFrame, InterpretedMetrics, VssSignal } from "@eva/types";
import { VSS } from "@eva/adas-mock";

/**
 * Deterministic signal interpreter.
 *
 * Pure functions — no LLM, no async, no I/O, no side effects.
 * Takes raw VSS signal frames, returns derived metrics.
 *
 * The reasoning LLM receives these metrics, not raw signals or scenario labels.
 * This is the architectural firewall between deterministic physics-based
 * reasoning and probabilistic language model reasoning.
 *
 * All thresholds are from published automotive safety literature:
 *   - Harsh braking: Euro NCAP AEB test protocol
 *   - SDLP fatigue proxy: Williamson et al. (2001)
 *   - Gap estimation: derived from obstacle sensor geometry
 */

// ── Signal extraction helpers ─────────────────────────────────────────────────

function getNumericSignal(
  signals: VssSignal[],
  path: string
): number | undefined {
  const sig = signals.find((s) => s.path === path);
  if (!sig) return undefined;
  return typeof sig.value === "number" ? sig.value : undefined;
}

function getBooleanSignal(
  signals: VssSignal[],
  path: string
): boolean | undefined {
  const sig = signals.find((s) => s.path === path);
  if (!sig) return undefined;
  return typeof sig.value === "boolean" ? sig.value : undefined;
}

// ── Individual metric derivations ─────────────────────────────────────────────

/**
 * Harsh braking score: 0.0 – 1.0
 * Based on longitudinal deceleration magnitude.
 * Thresholds:
 *   0.0  = 0 m/s² deceleration (no braking)
 *   0.5  = -3.9 m/s² (0.4g) — harsh braking threshold
 *   0.8  = -6.9 m/s² (0.7g) — emergency braking threshold
 *   1.0  = -10+ m/s² or EBA/emergency braking flag
 */
export function deriveHarshBrakingScore(signals: VssSignal[]): number {
  const decel = getNumericSignal(signals, VSS.ACCELERATION_LONGITUDINAL);
  const ebaEngaged = getBooleanSignal(signals, VSS.EBA_ENGAGED);
  const emergencyBraking = getBooleanSignal(signals, VSS.EMERGENCY_BRAKING);

  if (emergencyBraking === true || ebaEngaged === true) return 1.0;

  if (decel === undefined) return 0;

  // Only negative (deceleration) values are relevant
  const absDecel = Math.max(0, -decel);

  if (absDecel >= 10) return 1.0;
  if (absDecel >= 6.9) return 0.8 + ((absDecel - 6.9) / (10 - 6.9)) * 0.2;
  if (absDecel >= 3.9) return 0.5 + ((absDecel - 3.9) / (6.9 - 3.9)) * 0.3;
  if (absDecel >= 1.5) return 0.1 + ((absDecel - 1.5) / (3.9 - 1.5)) * 0.4;
  return absDecel / 1.5 * 0.1;
}

/**
 * Fatigue risk: 0.0 – 1.0
 * SDLP proxy — derived from lateral acceleration magnitude as a proxy
 * for steering wheel angle variance. Literature threshold: 0.21m SDLP
 * equates to roughly 0.9+ m/s² lateral acceleration variance at highway speed.
 *
 * Combined with LDW warning frequency signal.
 */
export function deriveFatigueRisk(signals: VssSignal[]): number {
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const ldwWarning = getBooleanSignal(signals, VSS.LDW_WARNING);
  const steeringAngle = getNumericSignal(signals, VSS.STEERING_ANGLE);

  let score = 0;

  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    // > 1.2 m/s² lateral variance = high fatigue signal
    if (absLateral >= 1.2) score = Math.min(1, score + 0.5);
    else if (absLateral >= 0.7) score = Math.min(1, score + 0.3);
    else if (absLateral >= 0.3) score = Math.min(1, score + 0.1);
  }

  if (steeringAngle !== undefined) {
    const absAngle = Math.abs(steeringAngle);
    // High absolute steering angle with slow speed = micro-correction pattern
    if (absAngle >= 25) score = Math.min(1, score + 0.4);
    else if (absAngle >= 15) score = Math.min(1, score + 0.2);
  }

  if (ldwWarning === true) {
    score = Math.min(1, score + 0.3);
  }

  return Math.round(score * 100) / 100;
}

/**
 * Lateral stability score: 0.0 – 1.0
 * Low score = unstable / lane departure risk.
 * High score = stable lane keeping.
 */
export function deriveLateralStabilityScore(signals: VssSignal[]): number {
  const yawRate = getNumericSignal(signals, VSS.ANGULAR_VELOCITY_YAW);
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const ldwWarning = getBooleanSignal(signals, VSS.LDW_WARNING);

  if (ldwWarning === true) return 0.1;

  let instabilityScore = 0;

  if (yawRate !== undefined) {
    const absYaw = Math.abs(yawRate);
    if (absYaw >= 15) instabilityScore += 0.5;
    else if (absYaw >= 8) instabilityScore += 0.3;
    else if (absYaw >= 4) instabilityScore += 0.1;
  }

  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    if (absLateral >= 2.5) instabilityScore += 0.4;
    else if (absLateral >= 1.2) instabilityScore += 0.2;
    else if (absLateral >= 0.5) instabilityScore += 0.05;
  }

  return Math.max(0, Math.round((1 - Math.min(1, instabilityScore)) * 100) / 100);
}

/**
 * Forward clearance in metres.
 * Null if no front obstacle data available.
 */
export function deriveForwardClearanceMeters(
  signals: VssSignal[]
): number | null {
  const frontCenter = getNumericSignal(signals, VSS.OBSTACLE_FRONT_CENTER);
  return frontCenter ?? null;
}

/**
 * Overtake likelihood: 0.0 – 1.0
 * Derived from lateral accel spike, yaw rate increase, adjacent lane clearance,
 * and absence of turn signal.
 */
export function deriveOvertakeLikelihood(signals: VssSignal[]): number {
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const yawRate = getNumericSignal(signals, VSS.ANGULAR_VELOCITY_YAW);
  const turnLeft = getBooleanSignal(signals, VSS.TURN_SIGNAL_LEFT);
  const turnRight = getBooleanSignal(signals, VSS.TURN_SIGNAL_RIGHT);
  const frontLeft = getNumericSignal(signals, VSS.OBSTACLE_FRONT_LEFT);
  const frontRight = getNumericSignal(signals, VSS.OBSTACLE_FRONT_RIGHT);
  const speed = getNumericSignal(signals, VSS.SPEED);

  // Must be moving at meaningful speed to be an overtake
  if (speed !== undefined && speed < 40) return 0;

  let score = 0;

  // Significant lateral movement without turn signal is the key signal
  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    if (absLateral >= 2.5) score += 0.4;
    else if (absLateral >= 1.5) score += 0.25;
  }

  if (yawRate !== undefined) {
    const absYaw = Math.abs(yawRate);
    if (absYaw >= 12) score += 0.3;
    else if (absYaw >= 6) score += 0.15;
  }

  // No turn signal used = characteristic overtake behaviour
  const noSignal = turnLeft !== true && turnRight !== true;
  if (noSignal && score > 0) score += 0.2;

  // Adjacent lane clear (moving into it) — one side clear, one occupied
  if (frontLeft !== undefined && frontRight !== undefined) {
    const oneSideClear = frontLeft > 4 || frontRight > 4;
    const oneSideOccupied = frontLeft < 2.5 || frontRight < 2.5;
    if (oneSideClear && oneSideOccupied) score += 0.2;
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * Gap fit margin in metres.
 * Positive = fits with that margin. Negative = does not fit.
 * Null if vehicle width or obstacle data unavailable.
 *
 * Formula: (leftObstacleDistance + rightObstacleDistance) - (vehicleWidthMm / 1000)
 */
export function deriveGapFitMarginMeters(
  signals: VssSignal[]
): number | null {
  const frontLeft = getNumericSignal(signals, VSS.OBSTACLE_FRONT_LEFT);
  const frontRight = getNumericSignal(signals, VSS.OBSTACLE_FRONT_RIGHT);
  const vehicleWidthMm = getNumericSignal(signals, VSS.VEHICLE_WIDTH_MM);

  if (
    frontLeft === undefined ||
    frontRight === undefined ||
    vehicleWidthMm === undefined
  ) {
    return null;
  }

  const availableGapM = frontLeft + frontRight;
  const vehicleWidthM = vehicleWidthMm / 1000;
  const margin = availableGapM - vehicleWidthM;

  return Math.round(margin * 100) / 100;
}

// ── Main interpreter ──────────────────────────────────────────────────────────

/**
 * Interpret a full AdasSignalFrame into derived metrics.
 * This is the only function the reasoning agent should call for ADAS data.
 */
export function interpretSignals(frame: AdasSignalFrame): InterpretedMetrics {
  const { signals } = frame;

  return {
    harshBrakingScore: deriveHarshBrakingScore(signals),
    fatigueRisk: deriveFatigueRisk(signals),
    lateralStabilityScore: deriveLateralStabilityScore(signals),
    forwardClearanceMeters: deriveForwardClearanceMeters(signals),
    overtakeLikelihood: deriveOvertakeLikelihood(signals),
    gapFitMarginMeters: deriveGapFitMarginMeters(signals),
    computedAt: new Date().toISOString(),
  };
}
