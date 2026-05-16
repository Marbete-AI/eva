import { z } from "zod";

/**
 * A single COVESA VSS-style signal envelope.
 * Raw values only — no event labels ever reach the LLM.
 * Schema: https://github.com/COVESA/vehicle_signal_specification
 */
export const VssSignalSchema = z.object({
  /** COVESA VSS signal path, e.g. "Vehicle.Acceleration.Longitudinal" */
  path: z.string(),
  /** Raw numeric or boolean value */
  value: z.union([z.number(), z.boolean(), z.string()]),
  /** SI unit string, e.g. "m/s2", "km/h", "degrees", "%" */
  unit: z.string(),
  /** ISO 8601 timestamp */
  timestamp: z.string().datetime(),
  /** Data source identifier */
  source: z.enum(["adas_mock", "smartcar", "oem_adas", "phone_sensor"]),
  /** 0.0 – 1.0 confidence from source */
  confidence: z.number().min(0).max(1),
});

export type VssSignal = z.infer<typeof VssSignalSchema>;

/**
 * A bundled snapshot of all ADAS-relevant VSS signals at a point in time.
 * This is what the signal interpreter receives — never the scenario label.
 */
export const AdasSignalFrameSchema = z.object({
  frameId: z.string(),
  sessionId: z.string(),
  capturedAt: z.string().datetime(),
  signals: z.array(VssSignalSchema),
});

export type AdasSignalFrame = z.infer<typeof AdasSignalFrameSchema>;
