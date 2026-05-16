import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import type { AdasSignalFrame } from "@eva/types";
import { runScenario, type ScenarioName } from "./scenario-runner.js";

export interface MockServerOptions {
  port: number;
  scenario: ScenarioName;
  loop?: boolean;
}

/**
 * WebSocket server that streams raw ADAS signal frames to all connected clients.
 * No scenario labels are ever sent — only raw VSS signal values.
 */
export function createMockServer(options: MockServerOptions): {
  start: () => void;
  stop: () => void;
} {
  const { port, scenario, loop = true } = options;
  const wss = new WebSocketServer({ port });
  const sessionId = uuidv4();
  let stopScenario: (() => void) | null = null;

  function broadcast(frame: AdasSignalFrame): void {
    const payload = JSON.stringify(frame);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  }

  return {
    start() {
      wss.on("connection", (ws) => {
        console.log(`[adas-mock] Client connected. Scenario: ${scenario}`);
        ws.on("close", () => {
          console.log("[adas-mock] Client disconnected.");
        });
      });

      stopScenario = runScenario(sessionId, scenario, broadcast, loop);

      console.log(`[adas-mock] Server running on ws://localhost:${port}`);
      console.log(`[adas-mock] Scenario: ${scenario} | Loop: ${loop}`);
      console.log("[adas-mock] Emitting raw VSS signals only — no event labels.");
    },

    stop() {
      stopScenario?.();
      wss.close();
      console.log("[adas-mock] Server stopped.");
    },
  };
}
