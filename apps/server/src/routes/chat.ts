import { Hono } from "hono";
import { z } from "zod";
import { runReasoningLoop } from "../agent/loop.js";
import { getDevContextManager } from "../context/driver-context.js";
import { createOrGetUser } from "../memory/user.js";
import { createSessionRecord } from "../memory/session-record.js";

const chat = new Hono();

const ChatRequestSchema = z.object({
  message: z.string().min(1).max(4000),
});

/**
 * POST /chat — development shim for text-based testing.
 * Uses the singleton dev context manager.
 *
 * Ensures user + session rows exist in Supabase on first call (idempotent).
 * The production path is WS /session — this shim is for dev/testing only.
 */

// Track whether the dev session has been initialised in Supabase
// so we don't upsert on every single request — just the first one.
let devSessionInitialised = false;

chat.post("/chat", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = ChatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      400
    );
  }

  const { message } = parsed.data;
  const ctxManager = getDevContextManager();
  const context = ctxManager.getContext();

  // Ensure user + session rows exist (once per server process lifetime)
  if (!devSessionInitialised) {
    await createOrGetUser(context.driverId);
    await createSessionRecord(
      context.sessionId,
      context.driverId,
      context.mode,
      context.persona
    );
    devSessionInitialised = true;
  }

  ctxManager.setLastUtterance(message);
  const metrics = ctxManager.getLatestMetrics();

  try {
    const result = await runReasoningLoop({
      trigger: {
        type: "voice",
        transcript: message,
        asrConfidence: 1.0,
        timestamp: new Date().toISOString(),
      },
      context,
      metrics,
      onModeChange: (mode) => ctxManager.setMode(mode),
    });

    return c.json({
      response: result.text,
      requestId: result.requestId,
      sessionId: context.sessionId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[chat] Error:", msg);
    return c.json({ error: "Reasoning failed", details: msg }, 500);
  }
});

export { chat };
