import { z } from "zod";
/**
 * A single COVESA VSS-style signal envelope.
 * Raw values only — no event labels ever reach the LLM.
 * Schema: https://github.com/COVESA/vehicle_signal_specification
 */
export declare const VssSignalSchema: z.ZodObject<{
    /** COVESA VSS signal path, e.g. "Vehicle.Acceleration.Longitudinal" */
    path: z.ZodString;
    /** Raw numeric or boolean value */
    value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
    /** SI unit string, e.g. "m/s2", "km/h", "degrees", "%" */
    unit: z.ZodString;
    /** ISO 8601 timestamp */
    timestamp: z.ZodString;
    /** Data source identifier */
    source: z.ZodEnum<["adas_mock", "smartcar", "oem_adas", "phone_sensor"]>;
    /** 0.0 – 1.0 confidence from source */
    confidence: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    timestamp: string;
    path: string;
    value: string | number | boolean;
    unit: string;
    source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
    confidence: number;
}, {
    timestamp: string;
    path: string;
    value: string | number | boolean;
    unit: string;
    source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
    confidence: number;
}>;
export type VssSignal = z.infer<typeof VssSignalSchema>;
/**
 * A bundled snapshot of all ADAS-relevant VSS signals at a point in time.
 * This is what the signal interpreter receives — never the scenario label.
 */
export declare const AdasSignalFrameSchema: z.ZodObject<{
    frameId: z.ZodString;
    sessionId: z.ZodString;
    capturedAt: z.ZodString;
    signals: z.ZodArray<z.ZodObject<{
        /** COVESA VSS signal path, e.g. "Vehicle.Acceleration.Longitudinal" */
        path: z.ZodString;
        /** Raw numeric or boolean value */
        value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
        /** SI unit string, e.g. "m/s2", "km/h", "degrees", "%" */
        unit: z.ZodString;
        /** ISO 8601 timestamp */
        timestamp: z.ZodString;
        /** Data source identifier */
        source: z.ZodEnum<["adas_mock", "smartcar", "oem_adas", "phone_sensor"]>;
        /** 0.0 – 1.0 confidence from source */
        confidence: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        timestamp: string;
        path: string;
        value: string | number | boolean;
        unit: string;
        source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
        confidence: number;
    }, {
        timestamp: string;
        path: string;
        value: string | number | boolean;
        unit: string;
        source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
        confidence: number;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    frameId: string;
    sessionId: string;
    capturedAt: string;
    signals: {
        timestamp: string;
        path: string;
        value: string | number | boolean;
        unit: string;
        source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
        confidence: number;
    }[];
}, {
    frameId: string;
    sessionId: string;
    capturedAt: string;
    signals: {
        timestamp: string;
        path: string;
        value: string | number | boolean;
        unit: string;
        source: "adas_mock" | "smartcar" | "oem_adas" | "phone_sensor";
        confidence: number;
    }[];
}>;
export type AdasSignalFrame = z.infer<typeof AdasSignalFrameSchema>;
//# sourceMappingURL=signals.d.ts.map