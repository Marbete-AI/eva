import { VSS } from "../signals.js";
export const lateBrakingScenario = [
    // t=0: Normal cruise
    {
        delayMs: 0,
        signals: [
            { path: VSS.SPEED, value: 110, unit: "km/h" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: 0.1, unit: "m/s2" },
            { path: VSS.ACCELERATION_LATERAL, value: 0.05, unit: "m/s2" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 0, unit: "%" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 95, unit: "m" },
            { path: VSS.EBA_ENGAGED, value: false, unit: "boolean" },
            { path: VSS.EMERGENCY_BRAKING, value: false, unit: "boolean" },
        ],
    },
    // t=500ms: Lead car slows — gap closing
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 108, unit: "km/h" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 42, unit: "m" },
        ],
    },
    // t=1000ms: Gap closing fast
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 106, unit: "km/h" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 22, unit: "m" },
        ],
    },
    // t=1500ms: Driver sees it — brake application begins
    {
        delayMs: 500,
        signals: [
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 18, unit: "m" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 35, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: -2.1, unit: "m/s2" },
        ],
    },
    // t=2000ms: Hard braking — decel > 0.7g (6.9 m/s²) = emergency threshold
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 98, unit: "km/h" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 88, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: -7.2, unit: "m/s2" },
            { path: VSS.EBA_ENGAGED, value: true, unit: "boolean" },
            { path: VSS.EMERGENCY_BRAKING, value: true, unit: "boolean" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 14, unit: "m" },
        ],
    },
    // t=2500ms: Peak deceleration
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 78, unit: "km/h" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 92, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: -8.1, unit: "m/s2" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 12, unit: "m" },
        ],
    },
    // t=3000ms: Braking easing, speed dropping
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 68, unit: "km/h" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 55, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: -4.2, unit: "m/s2" },
            { path: VSS.EBA_ENGAGED, value: false, unit: "boolean" },
            { path: VSS.EMERGENCY_BRAKING, value: false, unit: "boolean" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 14, unit: "m" },
        ],
    },
    // t=3500ms: Stabilising
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 62, unit: "km/h" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 15, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: -1.1, unit: "m/s2" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 18, unit: "m" },
        ],
    },
    // t=4000ms: Normal following resumed
    {
        delayMs: 500,
        signals: [
            { path: VSS.SPEED, value: 60, unit: "km/h" },
            { path: VSS.BRAKE_PEDAL_PCT, value: 0, unit: "%" },
            { path: VSS.ACCELERATION_LONGITUDINAL, value: 0.0, unit: "m/s2" },
            { path: VSS.OBSTACLE_FRONT_CENTER, value: 24, unit: "m" },
        ],
    },
];
//# sourceMappingURL=late-braking.js.map