import type { IncomingMessage } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { EvaSession } from "../session/session-manager.js";

/**
 * WebSocket session handler.
 * Attached directly to the Node.js HTTP server (not via Hono — Hono
 * doesn't natively handle WebSocket upgrades in Node mode).
 *
 * URL: ws://localhost:8787/session
 * Optional query param: ?driverId=xxx
 *
 * One EvaSession per connected client.
 */
export function attachSessionHandler(
  server: import("http").Server,
  adasMockUrl: string
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/session" });

  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const driverId = url.searchParams.get("driverId") ?? undefined;

    const session = new EvaSession(ws, driverId);
    // start() is async — awaits DB writes before sending session_started
    void session.start(adasMockUrl);

    ws.on("message", (data) => {
      session.handleClientMessage(data.toString());
    });

    ws.on("close", () => {
      session.stop();
    });

    ws.on("error", (err) => {
      console.error(`[ws] Client error: ${err.message}`);
      session.stop();
    });
  });

  console.log(`[eva-server] WebSocket session: ws://localhost/session`);
  return wss;
}
