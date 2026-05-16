"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnvironmentStateSchema = exports.TrafficSnapshotSchema = exports.WeatherSnapshotSchema = void 0;
const zod_1 = require("zod");
exports.WeatherSnapshotSchema = zod_1.z.object({
    condition: zod_1.z.string(),
    temperatureCelsius: zod_1.z.number(),
    precipitationMmPerHour: zod_1.z.number().min(0),
    windSpeedKmh: zod_1.z.number().min(0),
    visibilityKm: zod_1.z.number().min(0),
    fetchedAt: zod_1.z.string().datetime(),
});
exports.TrafficSnapshotSchema = zod_1.z.object({
    summary: zod_1.z.string(),
    incidents: zod_1.z.array(zod_1.z.object({
        description: zod_1.z.string(),
        severity: zod_1.z.enum(["low", "medium", "high"]),
        location: zod_1.z.string(),
    })),
    fetchedAt: zod_1.z.string().datetime(),
});
exports.EnvironmentStateSchema = zod_1.z.object({
    weather: exports.WeatherSnapshotSchema.nullable(),
    traffic: exports.TrafficSnapshotSchema.nullable(),
});
//# sourceMappingURL=environment.js.map