import { z } from "zod";
/** Current operating mode for the session */
export declare const SessionModeSchema: z.ZodEnum<["driving", "meeting", "fatigue", "navigation"]>;
export type SessionMode = z.infer<typeof SessionModeSchema>;
/**
 * The central live context object.
 * One per driver session. Updated continuously from all signal sources.
 * This is what the reasoning loop receives on every trigger.
 */
export declare const DriverContextSchema: z.ZodObject<{
    driverId: z.ZodString;
    sessionId: z.ZodString;
    persona: z.ZodEnum<["copilot", "quiet_companion", "meeting_mode"]>;
    asrMode: z.ZodEnum<["ptt", "wake_word", "vad"]>;
    vehicle: z.ZodNullable<z.ZodObject<{
        vehicleId: z.ZodString;
        batteryPercent: z.ZodNullable<z.ZodNumber>;
        rangeKm: z.ZodNullable<z.ZodNumber>;
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
        odometer: z.ZodNullable<z.ZodNumber>;
        driveMode: z.ZodNullable<z.ZodString>;
        lastReadAt: z.ZodString;
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
    }>>;
    adas: z.ZodNullable<z.ZodObject<{
        frameId: z.ZodString;
        sessionId: z.ZodString;
        capturedAt: z.ZodString;
        signals: z.ZodArray<z.ZodObject<{
            path: z.ZodString;
            value: z.ZodUnion<[z.ZodNumber, z.ZodBoolean, z.ZodString]>;
            unit: z.ZodString;
            timestamp: z.ZodString;
            source: z.ZodEnum<["adas_mock", "smartcar", "oem_adas", "phone_sensor"]>;
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
    }>>;
    driver: z.ZodObject<{
        fatigueRisk: z.ZodEnum<["low", "medium", "high"]>;
        lastUtterance: z.ZodNullable<z.ZodString>;
        sessionDurationMin: z.ZodNumber;
        lastInteractionAt: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        fatigueRisk: "low" | "medium" | "high";
        lastUtterance: string | null;
        sessionDurationMin: number;
        lastInteractionAt: string | null;
    }, {
        fatigueRisk: "low" | "medium" | "high";
        lastUtterance: string | null;
        sessionDurationMin: number;
        lastInteractionAt: string | null;
    }>;
    environment: z.ZodObject<{
        weather: z.ZodNullable<z.ZodObject<{
            condition: z.ZodString;
            temperatureCelsius: z.ZodNumber;
            precipitationMmPerHour: z.ZodNumber;
            windSpeedKmh: z.ZodNumber;
            visibilityKm: z.ZodNumber;
            fetchedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        }, {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        }>>;
        traffic: z.ZodNullable<z.ZodObject<{
            summary: z.ZodString;
            incidents: z.ZodArray<z.ZodObject<{
                description: z.ZodString;
                severity: z.ZodEnum<["low", "medium", "high"]>;
                location: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }, {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }>, "many">;
            fetchedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        }, {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        }>>;
    }, "strip", z.ZodTypeAny, {
        weather: {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        } | null;
        traffic: {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        } | null;
    }, {
        weather: {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        } | null;
        traffic: {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        } | null;
    }>;
    memory: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        content: z.ZodString;
        source: z.ZodEnum<["conversation", "feedback", "adas_event", "explicit_preference"]>;
        weight: z.ZodNumber;
        createdAt: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
        id: string;
        content: string;
        weight: number;
        createdAt: string;
    }, {
        source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
        id: string;
        content: string;
        weight: number;
        createdAt: string;
    }>, "many">;
    mode: z.ZodEnum<["driving", "meeting", "fatigue", "navigation"]>;
    sessionStartedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    sessionId: string;
    driverId: string;
    persona: "copilot" | "quiet_companion" | "meeting_mode";
    asrMode: "ptt" | "wake_word" | "vad";
    vehicle: {
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
    } | null;
    adas: {
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
    } | null;
    driver: {
        fatigueRisk: "low" | "medium" | "high";
        lastUtterance: string | null;
        sessionDurationMin: number;
        lastInteractionAt: string | null;
    };
    environment: {
        weather: {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        } | null;
        traffic: {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        } | null;
    };
    memory: {
        source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
        id: string;
        content: string;
        weight: number;
        createdAt: string;
    }[];
    mode: "driving" | "meeting" | "fatigue" | "navigation";
    sessionStartedAt: string;
}, {
    sessionId: string;
    driverId: string;
    persona: "copilot" | "quiet_companion" | "meeting_mode";
    asrMode: "ptt" | "wake_word" | "vad";
    vehicle: {
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
    } | null;
    adas: {
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
    } | null;
    driver: {
        fatigueRisk: "low" | "medium" | "high";
        lastUtterance: string | null;
        sessionDurationMin: number;
        lastInteractionAt: string | null;
    };
    environment: {
        weather: {
            condition: string;
            temperatureCelsius: number;
            precipitationMmPerHour: number;
            windSpeedKmh: number;
            visibilityKm: number;
            fetchedAt: string;
        } | null;
        traffic: {
            fetchedAt: string;
            summary: string;
            incidents: {
                location: string;
                description: string;
                severity: "low" | "medium" | "high";
            }[];
        } | null;
    };
    memory: {
        source: "conversation" | "feedback" | "adas_event" | "explicit_preference";
        id: string;
        content: string;
        weight: number;
        createdAt: string;
    }[];
    mode: "driving" | "meeting" | "fatigue" | "navigation";
    sessionStartedAt: string;
}>;
export type DriverContext = z.infer<typeof DriverContextSchema>;
/** Default context for a new session */
export declare function createDefaultDriverContext(driverId: string, sessionId: string): DriverContext;
//# sourceMappingURL=session.d.ts.map