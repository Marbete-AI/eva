import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import type { Server } from "http";
import { health } from "./routes/health.js";
import { chat } from "./routes/chat.js";
import { attachSessionHandler } from "./routes/session.js";
import { smartcarRoutes } from "./routes/smartcar.js";

const app = new Hono();

// CORS — allow Expo dev server and local WS clients
app.use(
  "*",
  cors({
    origin: ["http://localhost:8081", "exp://localhost:8081"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  })
);

// HTTP routes
app.route("/", health);
app.route("/", chat);
app.route("/", smartcarRoutes);

// 404
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Error handler
app.onError((err, c) => {
  console.error("[server] Unhandled error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const port = parseInt(process.env["PORT"] ?? "8787", 10);
const adasMockUrl = process.env["ADAS_MOCK_WS_URL"] ?? "ws://localhost:3001";

console.log(`[eva-server] Starting on port ${port}`);
console.log(
  `[eva-server] Reasoning: ${process.env["REASONING_MODEL_PROVIDER"] ?? "anthropic"} / ${process.env["REASONING_MODEL_NAME"] ?? "claude-sonnet-4-5"}`
);

const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`[eva-server] Ready at http://localhost:${port}`);
  console.log(`[eva-server] Health:   GET  http://localhost:${port}/health`);
  console.log(`[eva-server] Chat:     POST http://localhost:${port}/chat`);
  console.log(`[eva-server] Session:  WS   ws://localhost:${port}/session`);
}) as Server;

// Attach WebSocket session handler to the raw HTTP server
attachSessionHandler(server, adasMockUrl);

export default app;
