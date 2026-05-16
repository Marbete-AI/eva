import { z } from "zod";

export const WeatherSnapshotSchema = z.object({
  condition: z.string(),
  temperatureCelsius: z.number(),
  precipitationMmPerHour: z.number().min(0),
  windSpeedKmh: z.number().min(0),
  visibilityKm: z.number().min(0),
  fetchedAt: z.string().datetime(),
});

export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;

export const TrafficSnapshotSchema = z.object({
  summary: z.string(),
  incidents: z.array(
    z.object({
      description: z.string(),
      severity: z.enum(["low", "medium", "high"]),
      location: z.string(),
    })
  ),
  fetchedAt: z.string().datetime(),
});

export type TrafficSnapshot = z.infer<typeof TrafficSnapshotSchema>;

export const EnvironmentStateSchema = z.object({
  weather: WeatherSnapshotSchema.nullable(),
  traffic: TrafficSnapshotSchema.nullable(),
});

export type EnvironmentState = z.infer<typeof EnvironmentStateSchema>;
