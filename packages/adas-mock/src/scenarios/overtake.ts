import type { VssSignal } from "@eva/types";
import { VSS } from "../signals.js";

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

export const overtakeScenario: StepSignals[] = [
  // t=0: Following slower vehicle
  {
    delayMs: 0,
    signals: [
      { path: VSS.SPEED, value: 85, unit: "km/h" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: 0.2, unit: "m/s2" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.1, unit: "m/s2" },
      { path: VSS.STEERING_ANGLE, value: 2, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 1.2, unit: "deg/s" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 28, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 6.2, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 6.1, unit: "m" },
      { path: VSS.OBSTACLE_REAR_LEFT, value: 45, unit: "m" },
      { path: VSS.TURN_SIGNAL_LEFT, value: false, unit: "boolean" },
      { path: VSS.TURN_SIGNAL_RIGHT, value: false, unit: "boolean" },
    ],
  },
  // t=600ms: Decision to overtake — acceleration begins
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 89, unit: "km/h" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: 1.8, unit: "m/s2" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 26, unit: "m" },
      { path: VSS.OBSTACLE_REAR_LEFT, value: 52, unit: "m" },
    ],
  },
  // t=1200ms: Lane change left — yaw rate and lateral accel spike, no signal
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 94, unit: "km/h" },
      { path: VSS.ACCELERATION_LATERAL, value: 2.8, unit: "m/s2" },
      { path: VSS.STEERING_ANGLE, value: -42, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 18.4, unit: "deg/s" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 2.1, unit: "m" },
      { path: VSS.TURN_SIGNAL_LEFT, value: false, unit: "boolean" },
    ],
  },
  // t=1800ms: Mid lane change, now beside slow vehicle
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 98, unit: "km/h" },
      { path: VSS.ACCELERATION_LATERAL, value: 1.4, unit: "m/s2" },
      { path: VSS.STEERING_ANGLE, value: -8, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 6.2, unit: "deg/s" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 110, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 1.8, unit: "m" }, // slow vehicle to the right
      { path: VSS.OBSTACLE_REAR_RIGHT, value: 2.4, unit: "m" },
    ],
  },
  // t=2400ms: Parallel, accelerating past
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 103, unit: "km/h" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: 2.1, unit: "m/s2" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.3, unit: "m/s2" },
      { path: VSS.STEERING_ANGLE, value: -4, unit: "degrees" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 3.2, unit: "m" },
      { path: VSS.OBSTACLE_REAR_RIGHT, value: 8, unit: "m" },
    ],
  },
  // t=3000ms: Clear ahead — lane change right to return
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 105, unit: "km/h" },
      { path: VSS.ACCELERATION_LATERAL, value: -2.2, unit: "m/s2" }, // right lateral
      { path: VSS.STEERING_ANGLE, value: 38, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: -14.8, unit: "deg/s" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 35, unit: "m" }, // overtaken vehicle now behind
      { path: VSS.OBSTACLE_REAR_RIGHT, value: 18, unit: "m" },
      { path: VSS.TURN_SIGNAL_RIGHT, value: false, unit: "boolean" },
    ],
  },
  // t=3600ms: Lane change complete, cruise resumed
  {
    delayMs: 600,
    signals: [
      { path: VSS.SPEED, value: 105, unit: "km/h" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: 0.1, unit: "m/s2" },
      { path: VSS.ACCELERATION_LATERAL, value: 0.1, unit: "m/s2" },
      { path: VSS.STEERING_ANGLE, value: 3, unit: "degrees" },
      { path: VSS.ANGULAR_VELOCITY_YAW, value: 1.5, unit: "deg/s" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 88, unit: "m" },
      { path: VSS.OBSTACLE_REAR_RIGHT, value: 42, unit: "m" },
    ],
  },
];
