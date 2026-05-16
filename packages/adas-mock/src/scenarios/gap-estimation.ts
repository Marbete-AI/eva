import type { VssSignal } from "@eva/types";
import { VSS } from "../signals.js";

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

export const gapEstimationScenario: StepSignals[] = [
  // Approaching — slow speed, forward clearance reading begins
  {
    delayMs: 0,
    signals: [
      { path: VSS.SPEED, value: 22, unit: "km/h" },
      { path: VSS.VEHICLE_WIDTH_MM, value: 2050, unit: "mm" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 18, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 5.8, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 5.6, unit: "m" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: -0.4, unit: "m/s2" },
    ],
  },
  // Sub-scenario A: Comfortable gap — left 2.8m, right 2.6m, vehicle 2.05m wide
  // Available gap = 2.8 + 2.6 = 5.4m. Vehicle needs 2.05m. Margin = +3.35m.
  {
    delayMs: 1200,
    signals: [
      { path: VSS.SPEED, value: 15, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 9, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 2.8, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 2.6, unit: "m" },
    ],
  },
  // Gap opens out — back to clear road
  {
    delayMs: 2000,
    signals: [
      { path: VSS.SPEED, value: 18, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 22, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 5.2, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 5.0, unit: "m" },
    ],
  },
  // Sub-scenario B: Tight gap — left 1.2m, right 1.1m. Available = 2.3m. Vehicle 2.05m. Margin = +0.25m.
  {
    delayMs: 2000,
    signals: [
      { path: VSS.SPEED, value: 8, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 5, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 1.2, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 1.1, unit: "m" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: -0.6, unit: "m/s2" },
    ],
  },
  // Through and clear
  {
    delayMs: 2500,
    signals: [
      { path: VSS.SPEED, value: 12, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 4.1, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 3.8, unit: "m" },
    ],
  },
  // Sub-scenario C: Does not fit — left 0.8m, right 0.7m. Available = 1.5m. Vehicle 2.05m. Margin = -0.55m.
  {
    delayMs: 2000,
    signals: [
      { path: VSS.SPEED, value: 4, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 3.5, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 0.8, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 0.7, unit: "m" },
      { path: VSS.ACCELERATION_LONGITUDINAL, value: -0.9, unit: "m/s2" },
    ],
  },
  // Driver stops
  {
    delayMs: 1500,
    signals: [
      { path: VSS.SPEED, value: 0, unit: "km/h" },
      { path: VSS.OBSTACLE_FRONT_CENTER, value: 2.8, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_LEFT, value: 0.75, unit: "m" },
      { path: VSS.OBSTACLE_FRONT_RIGHT, value: 0.65, unit: "m" },
    ],
  },
];
