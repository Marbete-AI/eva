"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VehicleStateSchema = void 0;
const zod_1 = require("zod");
/**
 * Vehicle state from SmartCar (or mock).
 * Matches SmartCar's documented signal catalog.
 */
exports.VehicleStateSchema = zod_1.z.object({
    vehicleId: zod_1.z.string(),
    /** State of charge, 0–100 % */
    batteryPercent: zod_1.z.number().min(0).max(100).nullable(),
    /** Estimated range in km */
    rangeKm: zod_1.z.number().min(0).nullable(),
    /** Current speed in km/h */
    speedKmh: zod_1.z.number().min(0).nullable(),
    location: zod_1.z
        .object({
        lat: zod_1.z.number(),
        lon: zod_1.z.number(),
    })
        .nullable(),
    /** Total odometer in km */
    odometer: zod_1.z.number().min(0).nullable(),
    /** OEM drive mode string, e.g. "SPORT", "ECO", "NORMAL" */
    driveMode: zod_1.z.string().nullable(),
    /** ISO 8601 timestamp of last SmartCar read */
    lastReadAt: zod_1.z.string().datetime(),
    /** Vehicle width including mirrors in mm — used for gap estimation */
    widthMm: zod_1.z.number().positive().nullable(),
});
//# sourceMappingURL=vehicle.js.map