import { z } from "zod";

/**
 * Vehicle state from SmartCar (or mock).
 * Matches SmartCar's documented signal catalog.
 */
export const VehicleStateSchema = z.object({
  vehicleId: z.string(),
  /** State of charge, 0–100 % */
  batteryPercent: z.number().min(0).max(100).nullable(),
  /** Estimated range in km */
  rangeKm: z.number().min(0).nullable(),
  /** Current speed in km/h */
  speedKmh: z.number().min(0).nullable(),
  location: z
    .object({
      lat: z.number(),
      lon: z.number(),
    })
    .nullable(),
  /** Total odometer in km */
  odometer: z.number().min(0).nullable(),
  /** OEM drive mode string, e.g. "SPORT", "ECO", "NORMAL" */
  driveMode: z.string().nullable(),
  /** ISO 8601 timestamp of last SmartCar read */
  lastReadAt: z.string().datetime(),
  /** Vehicle width including mirrors in mm — used for gap estimation */
  widthMm: z.number().positive().nullable(),
});

export type VehicleState = z.infer<typeof VehicleStateSchema>;
