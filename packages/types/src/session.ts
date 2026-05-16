import { z } from "zod";
import { VehicleStateSchema } from "./vehicle.js";
import { AdasSignalFrameSchema } from "./signals.js";
import { DriverStateSchema, AsrModeSchema, PersonaSchema } from "./driver.js";
import { EnvironmentStateSchema } from "./environment.js";
import { MemoryChunkSchema } from "./memory.js";

/** Current operating mode for the session */
export const SessionModeSchema = z.enum([
  "driving",
  "meeting",
  "fatigue",
  "navigation",
]);
export type SessionMode = z.infer<typeof SessionModeSchema>;

/**
 * The central live context object.
 * One per driver session. Updated continuously from all signal sources.
 * This is what the reasoning loop receives on every trigger.
 */
export const DriverContextSchema = z.object({
  // Identity
  driverId: z.string(),
  sessionId: z.string(),
  persona: PersonaSchema,
  asrMode: AsrModeSchema,

  // Live state
  vehicle: VehicleStateSchema.nullable(),
  adas: AdasSignalFrameSchema.nullable(),
  driver: DriverStateSchema,
  environment: EnvironmentStateSchema,

  // Retrieved memory (injected into system prompt)
  memory: z.array(MemoryChunkSchema),

  // Session mode
  mode: SessionModeSchema,

  // ISO 8601
  sessionStartedAt: z.string().datetime(),
});

export type DriverContext = z.infer<typeof DriverContextSchema>;

/** Default context for a new session */
export function createDefaultDriverContext(
  driverId: string,
  sessionId: string
): DriverContext {
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
