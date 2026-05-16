"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DriverContextSchema = exports.SessionModeSchema = void 0;
exports.createDefaultDriverContext = createDefaultDriverContext;
const zod_1 = require("zod");
const vehicle_js_1 = require("./vehicle.js");
const signals_js_1 = require("./signals.js");
const driver_js_1 = require("./driver.js");
const environment_js_1 = require("./environment.js");
const memory_js_1 = require("./memory.js");
/** Current operating mode for the session */
exports.SessionModeSchema = zod_1.z.enum([
    "driving",
    "meeting",
    "fatigue",
    "navigation",
]);
/**
 * The central live context object.
 * One per driver session. Updated continuously from all signal sources.
 * This is what the reasoning loop receives on every trigger.
 */
exports.DriverContextSchema = zod_1.z.object({
    // Identity
    driverId: zod_1.z.string(),
    sessionId: zod_1.z.string(),
    persona: driver_js_1.PersonaSchema,
    asrMode: driver_js_1.AsrModeSchema,
    // Live state
    vehicle: vehicle_js_1.VehicleStateSchema.nullable(),
    adas: signals_js_1.AdasSignalFrameSchema.nullable(),
    driver: driver_js_1.DriverStateSchema,
    environment: environment_js_1.EnvironmentStateSchema,
    // Retrieved memory (injected into system prompt)
    memory: zod_1.z.array(memory_js_1.MemoryChunkSchema),
    // Session mode
    mode: exports.SessionModeSchema,
    // ISO 8601
    sessionStartedAt: zod_1.z.string().datetime(),
});
/** Default context for a new session */
function createDefaultDriverContext(driverId, sessionId) {
    const now = new Date().toISOString();
    return {
        driverId,
        sessionId,
        persona: "copilot",
        asrMode: "ptt",
        vehicle: null,
        adas: null,
        driver: {
            fatigueRisk: "low",
            lastUtterance: null,
            sessionDurationMin: 0,
            lastInteractionAt: null,
        },
        environment: {
            weather: null,
            traffic: null,
        },
        memory: [],
        mode: "driving",
        sessionStartedAt: now,
    };
}
//# sourceMappingURL=session.js.map