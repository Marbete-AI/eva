/**
 * COVESA VSS signal path catalogue for EVA-1 ADAS mock.
 * Full VSS spec: https://github.com/COVESA/vehicle_signal_specification
 *
 * Only the ~15 paths needed for the four initial scenarios are defined here.
 * Expand as new scenarios are added.
 */
export declare const VSS: {
    readonly SPEED: "Vehicle.Speed";
    readonly ACCELERATION_LONGITUDINAL: "Vehicle.Acceleration.Longitudinal";
    readonly ACCELERATION_LATERAL: "Vehicle.Acceleration.Lateral";
    readonly ANGULAR_VELOCITY_YAW: "Vehicle.AngularVelocity.Yaw";
    readonly STEERING_ANGLE: "Vehicle.Chassis.SteeringWheel.Angle";
    readonly BRAKE_PEDAL_PCT: "Vehicle.Chassis.Brake.PedalPosition";
    readonly EMERGENCY_BRAKING: "Vehicle.Chassis.Brake.IsDriverEmergencyBrakingDetected";
    readonly EBA_ENGAGED: "Vehicle.ADAS.EBA.IsEngaged";
    readonly LDW_WARNING: "Vehicle.ADAS.LaneDepartureDetection.IsWarning";
    readonly LDW_ENABLED: "Vehicle.ADAS.LaneDepartureDetection.IsEnabled";
    readonly OBSTACLE_FRONT_CENTER: "Vehicle.ADAS.ObstacleDetection.FrontCenter.Distance";
    readonly OBSTACLE_FRONT_LEFT: "Vehicle.ADAS.ObstacleDetection.FrontLeft.Distance";
    readonly OBSTACLE_FRONT_RIGHT: "Vehicle.ADAS.ObstacleDetection.FrontRight.Distance";
    readonly OBSTACLE_REAR_CENTER: "Vehicle.ADAS.ObstacleDetection.RearCenter.Distance";
    readonly OBSTACLE_REAR_LEFT: "Vehicle.ADAS.ObstacleDetection.RearLeft.Distance";
    readonly OBSTACLE_REAR_RIGHT: "Vehicle.ADAS.ObstacleDetection.RearRight.Distance";
    readonly TURN_SIGNAL_LEFT: "Vehicle.Body.Lights.DirectionIndicator.Left.IsSignaling";
    readonly TURN_SIGNAL_RIGHT: "Vehicle.Body.Lights.DirectionIndicator.Right.IsSignaling";
    readonly VEHICLE_WIDTH_MM: "Vehicle.WidthIncludingMirrors";
};
export type VssPath = typeof VSS[keyof typeof VSS];
//# sourceMappingURL=signals.d.ts.map