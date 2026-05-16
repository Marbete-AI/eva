import { z } from "zod";
import { tool } from "ai";
import type { ToolCallContext } from "@eva/types";

const OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5";

interface OWMResponse {
  weather: Array<{ description: string }>;
  main: { temp: number };
  rain?: { "1h"?: number };
  snow?: { "1h"?: number };
  wind: { speed: number };
  visibility: number;
  name: string;
}

interface OWMGeoResponse {
  lat: number;
  lon: number;
  name: string;
}

/**
 * Tool: get_weather
 * Real OpenWeather API integration.
 * Falls back to stub if OPENWEATHER_API_KEY is not set.
 */
export function makeGetWeatherTool(ctx: ToolCallContext) {
  return tool({
    description:
      "Get current weather conditions for a location. Use when the driver asks about weather, or when calculating range/charge estimates where weather affects energy consumption.",
    parameters: z.object({
      location: z
        .string()
        .describe("City name, postcode, or 'current' to use vehicle GPS location"),
    }),
    execute: async ({ location }) => {
      console.log(`[tool:get_weather] location="${location}" session=${ctx.sessionId}`);

      const apiKey = process.env["OPENWEATHER_API_KEY"];
      if (!apiKey) {
        console.warn("[tool:get_weather] OPENWEATHER_API_KEY not set — returning stub");
        return stubWeather(location);
      }

      try {
        // Geocode the location name to lat/lon first
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(location)}&limit=1&appid=${apiKey}`;
        const geoRes = await fetch(geoUrl);
        const geoData = (await geoRes.json()) as OWMGeoResponse[];

        if (!geoData.length) {
          return { ok: false, source: "openweather", error: `Location not found: ${location}` };
        }

        const { lat, lon } = geoData[0]!;

        // Fetch current weather
        const wxUrl = `${OPENWEATHER_BASE}/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}`;
        const wxRes = await fetch(wxUrl);
        const wx = (await wxRes.json()) as OWMResponse;

        const precipMm =
          (wx.rain?.["1h"] ?? 0) + (wx.snow?.["1h"] ?? 0);

        return {
          ok: true,
          source: "openweather",
          dataFreshAt: new Date().toISOString(),
          data: {
            condition: wx.weather[0]?.description ?? "unknown",
            temperatureCelsius: Math.round(wx.main.temp * 10) / 10,
            precipitationMmPerHour: precipMm,
            windSpeedKmh: Math.round(wx.wind.speed * 3.6 * 10) / 10,
            visibilityKm: Math.round((wx.visibility / 1000) * 10) / 10,
            locationName: wx.name,
            fetchedAt: new Date().toISOString(),
          },
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[tool:get_weather] API error: ${msg}`);
        return { ok: false, source: "openweather", error: msg };
      }
    },
  });
}

function stubWeather(location: string) {
  return {
    ok: true,
    source: "openweather_stub",
    dataFreshAt: new Date().toISOString(),
    data: {
      condition: "Partly cloudy",
      temperatureCelsius: 12,
      precipitationMmPerHour: 0,
      windSpeedKmh: 18,
      visibilityKm: 12,
      locationName: location,
      fetchedAt: new Date().toISOString(),
    },
  };
}
