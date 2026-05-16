import type { VssSignal } from "@eva/types";
import { VSS } from "../signals.js";

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

export const fatigueProxyScenario: StepSignals[] = [
  // t=0: Fresh driver, alert. Small precise steering corrections.
  {
    delayMs: 0,
    signals: [
      { path: VSS.SPEED, value: 112, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: 2, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 1.1, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.08, unit: "m/s2" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 72, unit: "m" },
    ],
  },
  // t=5min: Still alert, minor variation
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 111, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: 4, unit: "degrees" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.14, unit: "m/s2" },
    ],
  },
  // t=10min: Slight wandering begins
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 113, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: -8, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 2.8, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.32, unit: "m/s2" },
    ],
  },
  // t=15min: Correction over-shoot pattern emerging
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 110, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: 14, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 4.2, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.51, unit: "m/s2" },
      { path: VSS.LDW_WARNING, value: false, unit: "boolean" },
    ],
  },
  // t=20min: Speed variation — micro-sleep indicators starting
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 106, unit: "km/h" }, // unexplained deceleration
      { path: VSS.STEERING_ANGLE, value: -18, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 6.1, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.72, unit: "m/s2" },
      { path: VSS.LDW_WARNING, value: true, unit: "boolean" },
    ],
  },
  // t=25min: LDW firing again — corrective over-steer
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 108, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: 22, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 8.4, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.94, unit: "m/s2" },
      { path: VSS.LDW_WARNING, value: true, unit: "boolean" },
    ],
  },
  // t=30min: High variance — SDLP proxy clearly elevated
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 103, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: -24, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 10.2, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 1.18, unit: "m/s2" },
      { path: VSS.LDW_WARNING, value: true, unit: "boolean" },
    ],
  },
  // t=35min: Strong fatigue indicators
  {
    delayMs: 3000,
    signals: [
      { path: VSS.SPEED, value: 100, unit: "km/h" },
      { path: VSS.STEERING_ANGLE, value: 31, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 13.5, unit: "deg/s" },
      { path: VSS.ACCELERATION_LATERAL, value: 1.45, unit: "m/s2" },
      { path: VSS.LDW_WARNING, value: true, unit: "boolean" },
    ],
  },
];
