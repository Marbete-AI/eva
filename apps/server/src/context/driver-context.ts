import { v4 as uuidv4 } from "uuid";
import type {
  DriverContext,
  SessionMode,
  InterpretedMetrics,
  AdasSignalFrame,
} from "@eva/types";
import { createDefaultDriverContext } from "@eva/types";
import { interpretSignals } from "../interpreters/signal-interpreter.js";

/**
 * Live driver context manager.
 * Maintains the current DriverContext for a session and the latest
 * interpreted ADAS metrics.
 *
 * In EVA-1, one context per server process (single driver dev mode).
 * In EVA-2, one context per WebSocket session.
 */
export class DriverContextManager {
  private context: DriverContext;
  private latestMetrics: InterpretedMetrics | null = null;
  private sessionStartTime: Date;

  constructor(driverId?: string, sessionId?: string) {
    const resolvedSessionId = sessionId ?? uuidv4();
    const resolvedDriverId = driverId ?? uuidv4();
    this.context = createDefaultDriverContext(resolvedDriverId, resolvedSessionId);
    this.sessionStartTime = new Date();
  }

  getContext(): DriverContext {
    // Update session duration on every read
    const durationMin = Math.round(
      (Date.now() - this.sessionStartTime.getTime()) / 60000
    );
    this.context = {
      ...this.context,
      driver: {
        ...this.context.driver,
        sessionDurationMin: durationMin,
      },
    };
    return this.context;
  }

  getLatestMetrics(): InterpretedMetrics | null {
    return this.latestMetrics;
  }

  /**
   * Called by the ADAS signal subscriber when a new frame arrives.
   * Runs the deterministic interpreter and updates context.driver.fatigueRisk.
   */
  onAdasFrame(frame: AdasSignalFrame): void {
    this.context = { ...this.context, adas: frame };
    this.latestMetrics = interpretSignals(frame);

    // Update driver fatigue risk from interpreter output
    const risk = this.latestMetrics.fatigueRisk;
    const fatigueRisk =
      risk >= 0.7 ? "high" : risk >= 0.35 ? "medium" : "low";
    this.context = {
      ...this.context,
      driver: { ...this.context.driver, fatigueRisk },
    };
  }

  setMode(mode: SessionMode): void {
    this.context = { ...this.context, mode };
  }

  setLastUtterance(transcript: string): void {
    this.context = {
      ...this.context,
      driver: {
        ...this.context.driver,
        lastUtterance: transcript,
        lastInteractionAt: new Date().toISOString(),
      },
    };
  }
}

// Singleton for dev mode (one driver, one server process)
let devContext: DriverContextManager | null = null;

export function getDevContextManager(): DriverContextManager {
  if (!devContext) {
    devContext = new DriverContextManager("dev-driver");
  }
  return devContext;
}
