import { z } from "zod";
export declare const WeatherSnapshotSchema: z.ZodObject<{
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
}>;
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;
export declare const TrafficSnapshotSchema: z.ZodObject<{
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
}>;
export type TrafficSnapshot = z.infer<typeof TrafficSnapshotSchema>;
export declare const EnvironmentStateSchema: z.ZodObject<{
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
export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;
//# sourceMappingURL=environment.d.ts.map