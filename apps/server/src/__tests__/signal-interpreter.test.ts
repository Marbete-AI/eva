import { describe, it, expect } from "@jest/globals";
import {
  deriveHarshBrakingScore,
  deriveFatigueRisk,
  deriveLateralStabilityScore,
  deriveForwardClearanceMeters,
  deriveOvertakeLikelihood,
  deriveGapFitMarginMeters,
  interpretSignals,
} from "@eva/signal-interpreter";
import type { VssSignal, AdasSignalFrame } from "@eva/types";
import { VSS } from "@eva/adas-mock";

function makeSignal(
  path: string,
  value: number | boolean,
  unit: string
): VssSignal {
  return {
    path,
    value,
    unit,
    timestamp: new Date().toISOString(),
    source: "adas_mock",
    confidence: 1.0,
  };
}

function makeFrame(signals: VssSignal[]): AdasSignalFrame {
  return {
    frameId: "test-frame",
    sessionId: "test-session",
    capturedAt: new Date().toISOString(),
    signals,
  };
}

// ── Harsh braking ─────────────────────────────────────────────────────────────

describe("deriveHarshBrakingScore", () => {
  it("returns 0 with no braking", () => {
    const signals = [makeSignal(VSS.ACCELERATION_LONGITUDINAL, 0.1, "m/s2")];
    expect(deriveHarshBrakingScore(signals)).toBe(0);
  });

  it("returns < 0.5 for mild braking (< 3.9 m/s²)", () => {
    const signals = [makeSignal(VSS.ACCELERATION_LONGITUDINAL, -2.0, "m/s2")];
    expect(deriveHarshBrakingScore(signals)).toBeLessThan(0.5);
  });

  it("returns >= 0.5 for harsh braking (>= 3.9 m/s²)", () => {
    const signals = [makeSignal(VSS.ACCELERATION_LONGITUDINAL, -4.5, "m/s2")];
    expect(deriveHarshBrakingScore(signals)).toBeGreaterThanOrEqual(0.5);
  });

  it("returns 1.0 when EBA is engaged", () => {
    const signals = [makeSignal(VSS.EBA_ENGAGED, true, "boolean")];
    expect(deriveHarshBrakingScore(signals)).toBe(1.0);
  });

  it("returns 1.0 when emergency braking detected", () => {
    const signals = [makeSignal(VSS.EMERGENCY_BRAKING, true, "boolean")];
    expect(deriveHarshBrakingScore(signals)).toBe(1.0);
  });

  it("returns 0 with no signals", () => {
    expect(deriveHarshBrakingScore([])).toBe(0);
  });
});

// ── Fatigue risk ──────────────────────────────────────────────────────────────

describe("deriveFatigueRisk", () => {
  it("returns low score with calm lateral accel", () => {
    const signals = [makeSignal(VSS.ACCELERATION_LATERAL, 0.05, "m/s2")];
    expect(deriveFatigueRisk(signals)).toBeLessThan(0.2);
  });

  it("returns elevated score with high lateral accel", () => {
    const signals = [makeSignal(VSS.ACCELERATION_LATERAL, 1.4, "m/s2")];
    expect(deriveFatigueRisk(signals)).toBeGreaterThanOrEqual(0.5);
  });

  it("adds to score when LDW warning is active", () => {
    const withLdw = [
      makeSignal(VSS.ACCELERATION_LATERAL, 0.5, "m/s2"),
      makeSignal(VSS.LDW_WARNING, true, "boolean"),
    ];
    const withoutLdw = [makeSignal(VSS.ACCELERATION_LATERAL, 0.5, "m/s2")];
    expect(deriveFatigueRisk(withLdw)).toBeGreaterThan(deriveFatigueRisk(withoutLdw));
  });

  it("returns 0 with no signals", () => {
    expect(deriveFatigueRisk([])).toBe(0);
  });
});

// ── Lateral stability ─────────────────────────────────────────────────────────

describe("deriveLateralStabilityScore", () => {
  it("returns high stability score with calm signals", () => {
    const signals = [
      makeSignal(VSS.ANGULAR_VELOCITY_YAW, 1.2, "deg/s"),
      makeSignal(VSS.ACCELERATION_LATERAL, 0.08, "m/s2"),
    ];
    expect(deriveLateralStabilityScore(signals)).toBeGreaterThan(0.8);
  });

  it("returns low stability when LDW warning fires", () => {
    const signals = [makeSignal(VSS.LDW_WARNING, true, "boolean")];
    expect(deriveLateralStabilityScore(signals)).toBe(0.1);
  });

  it("returns reduced stability with high yaw rate", () => {
    const unstable = [makeSignal(VSS.ANGULAR_VELOCITY_YAW, 18, "deg/s")];
    const stable = [makeSignal(VSS.ANGULAR_VELOCITY_YAW, 1.5, "deg/s")];
    expect(deriveLateralStabilityScore(unstable)).toBeLessThan(
      deriveLateralStabilityScore(stable)
    );
  });
});

// ── Forward clearance ─────────────────────────────────────────────────────────

describe("deriveForwardClearanceMeters", () => {
  it("returns obstacle distance when available", () => {
    const signals = [makeSignal(VSS.OBSTACLE_FRONT_CENTER, 45, "m")];
    expect(deriveForwardClearanceMeters(signals)).toBe(45);
  });

  it("returns null when no front obstacle signal", () => {
    expect(deriveForwardClearanceMeters([])).toBeNull();
  });
});

// ── Overtake likelihood ────────────────────────────────────────────────────────

describe("deriveOvertakeLikelihood", () => {
  it("returns 0 at low speed regardless of lateral movement", () => {
    const signals = [
      makeSignal(VSS.SPEED, 20, "km/h"),
      makeSignal(VSS.ACCELERATION_LATERAL, 3.0, "m/s2"),
      makeSignal(VSS.ANGULAR_VELOCITY_YAW, 18, "deg/s"),
    ];
    expect(deriveOvertakeLikelihood(signals)).toBe(0);
  });

  it("returns high likelihood during characteristic overtake kinematics", () => {
    const signals = [
      makeSignal(VSS.SPEED, 95, "km/h"),
      makeSignal(VSS.ACCELERATION_LATERAL, 2.8, "m/s2"),
      makeSignal(VSS.ANGULAR_VELOCITY_YAW, 18.4, "deg/s"),
      makeSignal(VSS.TURN_SIGNAL_LEFT, false, "boolean"),
      makeSignal(VSS.TURN_SIGNAL_RIGHT, false, "boolean"),
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 2.1, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 6.0, "m"),
    ];
    expect(deriveOvertakeLikelihood(signals)).toBeGreaterThan(0.6);
  });

  it("returns 0 with no signals", () => {
    expect(deriveOvertakeLikelihood([])).toBe(0);
  });
});

// ── Gap fit margin ─────────────────────────────────────────────────────────────

describe("deriveGapFitMarginMeters", () => {
  it("returns positive margin when gap exceeds vehicle width", () => {
    // Vehicle width 2050mm = 2.05m. Left 2.8m + right 2.6m = 5.4m gap. Margin = 3.35m
    const signals = [
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 2.8, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 2.6, "m"),
      makeSignal(VSS.VEHICLE_WIDTH_MM, 2050, "mm"),
    ];
    expect(deriveGapFitMarginMeters(signals)).toBeCloseTo(3.35, 1);
  });

  it("returns negative margin when gap is smaller than vehicle width", () => {
    // Vehicle width 2050mm. Left 0.8m + right 0.7m = 1.5m gap. Margin = -0.55m
    const signals = [
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 0.8, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 0.7, "m"),
      makeSignal(VSS.VEHICLE_WIDTH_MM, 2050, "mm"),
    ];
    expect(deriveGapFitMarginMeters(signals)).toBeCloseTo(-0.55, 1);
  });

  it("returns null when vehicle width is missing", () => {
    const signals = [
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 2.0, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 2.0, "m"),
    ];
    expect(deriveGapFitMarginMeters(signals)).toBeNull();
  });

  it("returns null when obstacle data is missing", () => {
    const signals = [makeSignal(VSS.VEHICLE_WIDTH_MM, 2050, "mm")];
    expect(deriveGapFitMarginMeters(signals)).toBeNull();
  });
});

// ── Full frame interpretation ──────────────────────────────────────────────────

describe("interpretSignals", () => {
  it("returns all six metrics for a well-populated frame", () => {
    const frame = makeFrame([
      makeSignal(VSS.SPEED, 95, "km/h"),
      makeSignal(VSS.ACCELERATION_LONGITUDINAL, -4.5, "m/s2"),
      makeSignal(VSS.ACCELERATION_LATERAL, 0.1, "m/s2"),
      makeSignal(VSS.ANGULAR_VELOCITY_YAW, 2.0, "deg/s"),
      makeSignal(VSS.OBSTACLE_FRONT_CENTER, 35, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 3.0, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 3.0, "m"),
      makeSignal(VSS.VEHICLE_WIDTH_MM, 2050, "mm"),
    ]);

    const metrics = interpretSignals(frame);
    expect(metrics.harshBrakingScore).toBeGreaterThanOrEqual(0.5);
    expect(metrics.fatigueRisk).toBeGreaterThanOrEqual(0);
    expect(metrics.lateralStabilityScore).toBeGreaterThan(0);
    expect(metrics.forwardClearanceMeters).toBe(35);
    expect(metrics.gapFitMarginMeters).toBeCloseTo(3.95, 1);
    expect(metrics.computedAt).toBeTruthy();
  });

  it("returns null gap margin when vehicle width unavailable", () => {
    const frame = makeFrame([
      makeSignal(VSS.OBSTACLE_FRONT_LEFT, 2.0, "m"),
      makeSignal(VSS.OBSTACLE_FRONT_RIGHT, 2.0, "m"),
    ]);
    expect(interpretSignals(frame).gapFitMarginMeters).toBeNull();
  });
});
