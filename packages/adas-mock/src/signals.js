/**
 * COVESA VSS signal path catalogue for EVA-1 ADAS mock.
 * Full VSS spec: https://github.com/COVESA/vehicle_signal_specification
 *
 * Only the ~15 paths needed for the four initial scenarios are defined here.
 * Expand as new scenarios are added.
 */
export const VSS = {
    // Motion
    SPEED: "Vehicle.Speed", // km/h, 0–300
    ACCELERATION_LONGITUDINAL: "Vehicle.Acceleration.Longitudinal", // m/s², -20 to +10
    ACCELERATION_LATERAL: "Vehicle.Acceleration.Lateral", // m/s², -15 to +15
    ANGULAR_VELOCITY_YAW: "Vehicle.AngularVelocity.Yaw", // deg/s, -180 to +180
    // Chassis
    STEERING_ANGLE: "Vehicle.Chassis.SteeringWheel.Angle", // degrees, -780 to +780
    BRAKE_PEDAL_PCT: "Vehicle.Chassis.Brake.PedalPosition", // %, 0–100
    EMERGENCY_BRAKING: "Vehicle.Chassis.Brake.IsDriverEmergencyBrakingDetected", // boolean
    // ADAS safety systems
    EBA_ENGAGED: "Vehicle.ADAS.EBA.IsEngaged", // boolean
    LDW_WARNING: "Vehicle.ADAS.LaneDepartureDetection.IsWarning", // boolean
    LDW_ENABLED: "Vehicle.ADAS.LaneDepartureDetection.IsEnabled", // boolean
    // Obstacle detection — metres, 0–250 front / 0–8 side
    OBSTACLE_FRONT_CENTER: "Vehicle.ADAS.ObstacleDetection.FrontCenter.Distance",
    OBSTACLE_FRONT_LEFT: "Vehicle.ADAS.ObstacleDetection.FrontLeft.Distance",
    OBSTACLE_FRONT_RIGHT: "Vehicle.ADAS.ObstacleDetection.FrontRight.Distance",
    OBSTACLE_REAR_CENTER: "Vehicle.ADAS.ObstacleDetection.RearCenter.Distance",
    OBSTACLE_REAR_LEFT: "Vehicle.ADAS.ObstacleDetection.RearLeft.Distance",
    OBSTACLE_REAR_RIGHT: "Vehicle.ADAS.ObstacleDetection.RearRight.Distance",
    // Indicators
    TURN_SIGNAL_LEFT: "Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling", // boolean
    TURN_SIGNAL_RIGHT: "Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling", // boolean
    // Vehicle attributes (static or slow-changing)
    VEHICLE_WIDTH_MM: "Vehicle.WidthIncludingMirrors", // mm, typical 1800–2400
};
//# sourceMappingURL=signals.js.map