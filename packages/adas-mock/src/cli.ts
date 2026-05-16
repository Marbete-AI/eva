#!/usr/bin/env node
/**
 * CLI entrypoint for the ADAS mock server.
 * Usage: pnpm --filter @eva/adas-mock start -- --scenario late_braking [--port 3001] [--no-loop]
 */

import { createMockServer } from "./server.js";
import { isValidScenario, type ScenarioName } from "./scenario-runner.js";

const args = process.argv.slice(2);

function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const scenarioArg = getArg("--scenario") ?? "late_braking";
const portArg = getArg("--port") ?? "3001";
const noLoop = args.includes("--no-loop");

if (!isValidScenario(scenarioArg)) {
  console.error(
    `[adas-mock] Unknown scenario: "${scenarioArg}". ` +
      `Valid options: late_braking, overtake, fatigue_proxy, gap_estimation`
  );
  process.exit(1);
}

const port = parseInt(portArg, 10);
if (isNaN(port)) {
  console.error(`[adas-mock] Invalid port: "${portArg}"`);
  process.exit(1);
}

const server = createMockServer({
  port,
  scenario: scenarioArg as ScenarioName,
  loop: !noLoop,
});

server.start();

process.on("SIGINT", () => {
  console.log("\n[adas-mock] Shutting down...");
  server.stop();
  process.exit(0);
});
