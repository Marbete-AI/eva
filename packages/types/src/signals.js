"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdasSignalFrameSchema = exports.VssSignalSchema = void 0;
const zod_1 = require("zod");
/**
 * A single COVESA VSS-style signal envelope.
 * Raw values only — no event labels ever reach the LLM.
 * Schema: https://github.com/COVESA/vehicle_signal_specification
 */
exports.VssSignalSchema = zod_1.z.object({
    /** COVESA VSS signal path, e.g. "Vehicle.Acceleration.Longitudinal" */
    path: zod_1.z.string(),
    /** Raw numeric or boolean value */
    value: zod_1.z.union([zod_1.z.number(), zod_1.z.boolean(), zod_1.z.string()]),
    /** SI unit string, e.g. "m/s2", "km/h", "degrees", "%" */
    unit: zod_1.z.string(),
    /** ISO 8601 timestamp */
    timestamp: zod_1.z.string().datetime(),
    /** Data source identifier */
    source: zod_1.z.enum(["adas_mock", "smartcar", "oem_adas", "phone_sensor"]),
    /** 0.0 – 1.0 confidence from source */
    confidence: zod_1.z.number().min(0).max(1),
});
/**
 * A bundled snapshot of all ADAS-relevant VSS signals at a point in time.
 * This is what the signal interpreter receives — never the scenario label.
 */
exports.AdasSignalFrameSchema = zod_1.z.object({
    frameId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    capturedAt: zod_1.z.string().datetime(),
    signals: zod_1.z.array(exports.VssSignalSchema),
});
//# sourceMappingURL=signals.js.map