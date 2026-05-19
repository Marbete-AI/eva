/**
 * @eva/signal-interpreter
 *
 * Deterministic VSS signal interpreter.
 * Pure functions — no LLM, no async, no I/O, no side effects.
 * Zero dependency on AI SDKs or network libraries.
 *
 * Edge-deployable: can be compiled to WebAssembly and run on a vehicle ECU,
 * head unit (QNX, Linux, AUTOSAR), or any compute with zero connectivity.
 *
 * The reasoning LLM receives InterpretedMetrics — not raw signals or labels.
 * This is the architectural firewall between deterministic physics-based
 * reasoning and probabilistic language model reasoning.
 *
 * All thresholds from published automotive safety literature:
 *   - Harsh braking: Euro NCAP AEB test protocol
 *   - SDLP fatigue proxy: Williamson et al. (2001)
 *   - Gap estimation: derived from obstacle sensor geometry
 *
 * OEM integration: swap the VSS signal paths below for your OEM's signal
 * namespace. The metric derivation logic does not change.
 */

import type { AdasSignalFrame, InterpretedMetrics, VssSignal } from "@eva/types";

// ── VSS signal paths ──────────────────────────────────────────────────────────
// COVESA Vehicle Signal Specification paths.
// OEM integration point: replace these with your OEM's equivalent signal paths.

const VSS = {
  SPEED:                    "Vehicle.Speed",
  ACCELERATION_LONGITUDINAL:"Vehicle.Acceleration.Longitudinal",
  ACCELERATION_LATERAL:     "Vehicle.Acceleration.Lateral",
  ANGULAR_VELOCITY_YAW:     "Vehicle.AngularVelocity.Yaw",
  STEERING_ANGLE:           "Vehicle.Chassis.SteeringWheel.Angle",
  EMERGENCY_BRAKING:        "Vehicle.Chassis.Brake.IsDriverEmergencyBrakingDetected",
  EBA_ENGAGED:              "Vehicle.ADAS.EBA.IsEngaged",
  LDW_WARNING:              "Vehicle.ADAS.LaneDepartureDetection.IsWarning",
  OBSTACLE_FRONT_CENTER:    "Vehicle.ADAS.ObstacleDetection.FrontCenter.Distance",
  OBSTACLE_FRONT_LEFT:      "Vehicle.ADAS.ObstacleDetection.FrontLeft.Distance",
  OBSTACLE_FRONT_RIGHT:     "Vehicle.ADAS.ObstacleDetection.FrontRight.Distance",
  TURN_SIGNAL_LEFT:         "Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling",
  TURN_SIGNAL_RIGHT:        "Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling",
  VEHICLE_WIDTH_MM:         "Vehicle.WidthIncludingMirrors",
} as const;

// ── Signal extraction helpers ─────────────────────────────────────────────────

function getNumericSignal(signals: VssSignal[], path: string): number | undefined {
  const sig = signals.find(s => s.path === path);
  if (!sig) return undefined;
  return typeof sig.value === "number" ? sig.value : undefined;
}

function getBooleanSignal(signals: VssSignal[], path: string): boolean | undefined {
  const sig = signals.find(s => s.path === path);
  if (!sig) return undefined;
  return typeof sig.value === "boolean" ? sig.value : undefined;
}

// ── Metric derivations ────────────────────────────────────────────────────────

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

  const absDecel = Math.max(0, -decel);
  if (absDecel >= 10)  return 1.0;
  if (absDecel >= 6.9) return 0.8 + ((absDecel - 6.9) / (10 - 6.9)) * 0.2;
  if (absDecel >= 3.9) return 0.5 + ((absDecel - 3.9) / (6.9 - 3.9)) * 0.3;
  if (absDecel >= 1.5) return 0.1 + ((absDecel - 1.5) / (3.9 - 1.5)) * 0.4;
  return absDecel / 1.5 * 0.1;
}

/**
 * Fatigue risk: 0.0 – 1.0
 * SDLP proxy — lateral acceleration magnitude as proxy for steering variance.
 * Williamson et al. threshold: 0.21m SDLP ≈ 0.9+ m/s² lateral accel at highway speed.
 */
export function deriveFatigueRisk(signals: VssSignal[]): number {
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const ldwWarning = getBooleanSignal(signals, VSS.LDW_WARNING);
  const steeringAngle = getNumericSignal(signals, VSS.STEERING_ANGLE);

  let score = 0;

  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    if (absLateral >= 1.2)      score = Math.min(1, score + 0.5);
    else if (absLateral >= 0.7) score = Math.min(1, score + 0.3);
    else if (absLateral >= 0.3) score = Math.min(1, score + 0.1);
  }

  if (steeringAngle !== undefined) {
    const absAngle = Math.abs(steeringAngle);
    if (absAngle >= 25)      score = Math.min(1, score + 0.4);
    else if (absAngle >= 15) score = Math.min(1, score + 0.2);
  }

  if (ldwWarning === true) score = Math.min(1, score + 0.3);

  return Math.round(score * 100) / 100;
}

/**
 * Lateral stability score: 0.0 – 1.0
 * Low = unstable / lane departure risk. High = stable lane keeping.
 */
export function deriveLateralStabilityScore(signals: VssSignal[]): number {
  const yawRate = getNumericSignal(signals, VSS.ANGULAR_VELOCITY_YAW);
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const ldwWarning = getBooleanSignal(signals, VSS.LDW_WARNING);

  if (ldwWarning === true) return 0.1;

  let instabilityScore = 0;

  if (yawRate !== undefined) {
    const absYaw = Math.abs(yawRate);
    if (absYaw >= 15)      instabilityScore += 0.5;
    else if (absYaw >= 8)  instabilityScore += 0.3;
    else if (absYaw >= 4)  instabilityScore += 0.1;
  }

  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    if (absLateral >= 2.5)      instabilityScore += 0.4;
    else if (absLateral >= 1.2) instabilityScore += 0.2;
    else if (absLateral >= 0.5) instabilityScore += 0.05;
  }

  return Math.max(0, Math.round((1 - Math.min(1, instabilityScore)) * 100) / 100);
}

/**
 * Forward clearance in metres. Null if no front obstacle data.
 */
export function deriveForwardClearanceMeters(signals: VssSignal[]): number | null {
  return getNumericSignal(signals, VSS.OBSTACLE_FRONT_CENTER) ?? null;
}

/**
 * Overtake likelihood: 0.0 – 1.0
 * Derived from lateral accel spike, yaw rate, adjacent clearance, turn signal absence.
 */
export function deriveOvertakeLikelihood(signals: VssSignal[]): number {
  const lateralAccel = getNumericSignal(signals, VSS.ACCELERATION_LATERAL);
  const yawRate = getNumericSignal(signals, VSS.ANGULAR_VELOCITY_YAW);
  const turnLeft = getBooleanSignal(signals, VSS.TURN_SIGNAL_LEFT);
  const turnRight = getBooleanSignal(signals, VSS.TURN_SIGNAL_RIGHT);
  const frontLeft = getNumericSignal(signals, VSS.OBSTACLE_FRONT_LEFT);
  const frontRight = getNumericSignal(signals, VSS.OBSTACLE_FRONT_RIGHT);
  const speed = getNumericSignal(signals, VSS.SPEED);

  if (speed !== undefined && speed < 40) return 0;

  let score = 0;

  if (lateralAccel !== undefined) {
    const absLateral = Math.abs(lateralAccel);
    if (absLateral >= 2.5)      score += 0.4;
    else if (absLateral >= 1.5) score += 0.25;
  }

  if (yawRate !== undefined) {
    const absYaw = Math.abs(yawRate);
    if (absYaw >= 12)     score += 0.3;
    else if (absYaw >= 6) score += 0.15;
  }

  const noSignal = turnLeft !== true && turnRight !== true;
  if (noSignal && score > 0) score += 0.2;

  if (frontLeft !== undefined && frontRight !== undefined) {
    const oneSideClear = frontLeft > 4 || frontRight > 4;
    const oneSideOccupied = frontLeft < 2.5 || frontRight < 2.5;
    if (oneSideClear && oneSideOccupied) score += 0.2;
  }

  return Math.min(1, Math.round(score * 100) / 100);
}

/**
 * Gap fit margin in metres.
 * Positive = fits. Negative = does not fit. Null if width or obstacle data missing.
 */
export function deriveGapFitMarginMeters(signals: VssSignal[]): number | null {
  const frontLeft = getNumericSignal(signals, VSS.OBSTACLE_FRONT_LEFT);
  const frontRight = getNumericSignal(signals, VSS.OBSTACLE_FRONT_RIGHT);
  const vehicleWidthMm = getNumericSignal(signals, VSS.VEHICLE_WIDTH_MM);

  if (frontLeft === undefined || frontRight === undefined || vehicleWidthMm === undefined) {
    return null;
  }

  const margin = (frontLeft + frontRight) - (vehicleWidthMm / 1000);
  return Math.round(margin * 100) / 100;
}

// ── Main entry point ──────────────────────────────────────────────────────────

/**
 * Interpret a full AdasSignalFrame into derived metrics.
 * This is the only function the reasoning layer should call for ADAS data.
 *
 * OEM integration: connect your OEM ADAS ECU stream to this function.
 * The output (InterpretedMetrics) feeds the EVA reasoning loop unchanged.
 */
export function interpretSignals(frame: AdasSignalFrame): InterpretedMetrics {
  const { signals } = frame;
  return {
    harshBrakingScore:     deriveHarshBrakingScore(signals),
    fatigueRisk:           deriveFatigueRisk(signals),
    lateralStabilityScore: deriveLateralStabilityScore(signals),
    forwardClearanceMeters:deriveForwardClearanceMeters(signals),
    overtakeLikelihood:    deriveOvertakeLikelihood(signals),
    gapFitMarginMeters:    deriveGapFitMarginMeters(signals),
    computedAt:            new Date().toISOString(),
  };
}
