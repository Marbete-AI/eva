import { Hono } from "hono";

const health = new Hono();

health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "eva-server",
    version: "0.0.1",
    timestamp: new Date().toISOString(),
    reasoning: {
      provider: process.env["REASONING_MODEL_PROVIDER"] ?? "anthropic",
      model: process.env["REASONING_MODEL_NAME"] ?? "claude-sonnet-4-5",
    },
  });
});

export { health };
