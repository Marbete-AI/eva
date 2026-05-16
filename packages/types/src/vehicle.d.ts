import { z } from "zod";
/**
 * Vehicle state from SmartCar (or mock).
 * Matches SmartCar's documented signal catalog.
 */
export declare const VehicleStateSchema: z.ZodObject<{
    vehicleId: z.ZodString;
    /** State of charge, 0–100 % */
    batteryPercent: z.ZodNullable<z.ZodNumber>;
    /** Estimated range in km */
    rangeKm: z.ZodNullable<z.ZodNumber>;
    /** Current speed in km/h */
    speedKmh: z.ZodNullable<z.ZodNumber>;
    location: z.ZodNullable<z.ZodObject<{
        lat: z.ZodNumber;
        lon: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        lat: number;
        lon: number;
    }, {
        lat: number;
        lon: number;
    }>>;
    /** Total odometer in km */
    odometer: z.ZodNullable<z.ZodNumber>;
    /** OEM drive mode string, e.g. "SPORT", "ECO", "NORMAL" */
    driveMode: z.ZodNullable<z.ZodString>;
    /** ISO 8601 timestamp of last SmartCar read */
    lastReadAt: z.ZodString;
    /** Vehicle width including mirrors in mm — used for gap estimation */
    widthMm: z.ZodNullable<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    vehicleId: string;
    batteryPercent: number | null;
    rangeKm: number | null;
    speedKmh: number | null;
    location: {
        lat: number;
        lon: number;
    } | null;
    odometer: number | null;
    driveMode: string | null;
    lastReadAt: string;
    widthMm: number | null;
}, {
    vehicleId: string;
    batteryPercent: number | null;
    rangeKm: number | null;
    speedKmh: number | null;
    location: {
        lat: number;
        lon: number;
    } | null;
    odometer: number | null;
    driveMode: string | null;
    lastReadAt: string;
    widthMm: number | null;
}>;
export type VehicleState = z.infer<typeof VehicleStateSchema>;
//# sourceMappingURL=vehicle.d.ts.map