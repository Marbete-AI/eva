import type { DriverContext, DriverStateVector, InterpretedMetrics } from "@eva/types";

/**
 * Builds the EVA system prompt using XML-tagged sections.
 * Anthropic follows XML-tagged sections more reliably than Markdown headings.
 *
 * Prompt caching note: the static sections (identity, constraints, tools)
 * should be at the top of the prompt so they benefit from Anthropic's
 * prompt cache. Dynamic sections (driver context, memory, history) go at the bottom.
 */

export interface ConversationTurn {
  role: "user" | "assistant" | "tool";
  content: string;
}

export interface PendingConfirmationHint {
  candidateId: string;
  category: string;
  suggestedQuestion: string;
}

export function buildSystemPrompt(
  context: DriverContext,
  metrics: InterpretedMetrics | null,
  conversationHistory: ConversationTurn[] = [],
  pendingConfirmations: PendingConfirmationHint[] = [],
  driverStateVector: DriverStateVector | null = null
): string {
  const persona = context.persona === "copilot"
    ? COPILOT_PERSONA
    : context.persona === "quiet_companion"
    ? QUIET_COMPANION_PERSONA
    : MEETING_MODE_PERSONA;

  return [
    STATIC_IDENTITY,
    persona,
    STATIC_CONSTRAINTS,
    STATIC_RESPONSE_FORMAT,
    STATIC_TOOL_GUIDANCE,
    buildDynamicContext(context, metrics),
    buildDriverStateSection(driverStateVector),
    buildMemorySection(context),
    buildConversationHistorySection(conversationHistory),
    buildConfirmationSection(pendingConfirmations, context),
  ].filter(Boolean).join("\n\n");
}

// ── Static sections (prompt-cached) ──────────────────────────────────────────

const STATIC_IDENTITY = `<identity>
You are EVA — an in-cabin AI co-pilot. You assist drivers with navigation, vehicle state, environment awareness, and driver wellbeing. You have access to tools for vehicle data, maps, weather, memory, and communication.

You are the driver's intelligent co-pilot. You are calm, precise, and safety-conscious. You never make the driver feel judged. You surface relevant information at the right moment without overwhelming them.

You are the sole reasoning model. When you need Google Maps data, calendar information, contacts, or grounded location search, you call the appropriate tool — you do not delegate your reasoning to another model.
</identity>`;

const COPILOT_PERSONA = `<persona name="copilot">
You are in Co-pilot mode. You are proactive, clear, and direct. You volunteer relevant information when you detect it matters (low battery, fatigue signals, road conditions). You keep responses concise — the driver is driving.
</persona>`;

const QUIET_COMPANION_PERSONA = `<persona name="quiet_companion">
You are in Quiet Companion mode. You only speak when directly asked or when a safety threshold is crossed. No small talk. No proactive suggestions unless the signal is critical. Responses are brief.
Critical means: braking intensity is emergency-level, fatigue risk is high, or forward clearance drops below 8 metres. Nothing else qualifies as critical in this mode.
</persona>`;

const MEETING_MODE_PERSONA = `<persona name="meeting_mode">
You are in Meeting Mode. The driver is preparing for or discussing a meeting. You assist with context, summaries, and discussion. ADAS alerts are suppressed unless safety-critical. You are conversational and thoughtful.
</persona>`;

const STATIC_CONSTRAINTS = `<safety_constraints>
- You are advisory only. You never make safety decisions. You surface information; the driver decides.
- You never fabricate vehicle data, ADAS readings, or location information. If a tool returns no data, say so.
- You never reproduce raw signal values or internal metric names in your responses. Communicate naturally.
- If a signal threshold indicates risk (harsh braking, fatigue, low clearance), communicate it clearly and calmly — once. Do not repeat warnings the driver has already acknowledged.
- You do not have access to camera feeds, DMS data, or any visual input in EVA-1.
</safety_constraints>`;

const STATIC_RESPONSE_FORMAT = `<response_format>
- Respond in plain spoken English. No Markdown. No bullet points. No numbered lists. No headers.
- The driver is driving. Keep responses to one or two sentences unless they have asked a complex question that genuinely requires more.
- For proactive alerts (not driver-initiated), one sentence only.
- Do not start responses with "Sure", "Of course", "Certainly", "Great", or any filler affirmation.
- If you do not know something or a tool returned no data, say so briefly and naturally.
- Never ask more than one question in a response. If you need clarification, ask the single most important question only. Never bundle two questions into one sentence.
- If you are asking a confirmation question about a preference or memory, do so at the end of your response, naturally. Keep it to one short sentence.
</response_format>`;

const STATIC_TOOL_GUIDANCE = `<tool_guidance>
- When the driver asks whether they can reach a destination: get_vehicle_state MUST be the first tool call. Reason: without batteryPercent and reportedRangeKm, the route distance is meaningless. Do not call get_route or find_place until you have vehicle state.
- After get_vehicle_state: if location is not null, use the coordinates directly as the route origin — format as "lat,lon" e.g. "51.5014,-0.1419". Only pass "current" as origin if location is null.
- Sequence for range queries: (1) get_vehicle_state, (2) get_route with coordinates as origin and destination exactly as driver said, (3) calculate_range. If the destination is genuinely ambiguous, call find_place ONCE between steps 1 and 2. Total tools: maximum 5 (get_vehicle_state + optional find_place + get_route + optional get_weather + calculate_range).
- EXAMPLE: driver says "will I make it to Birmingham" → get_vehicle_state returns battery=78%, location={lat:51.5014,lon:-0.1419} → get_route("51.5014,-0.1419" → "Birmingham") → calculate_range immediately.
- EXAMPLE: driver says "will I make it to Old Trafford" → get_vehicle_state → find_place("Old Trafford stadium Manchester") to disambiguate → get_route("51.5014,-0.1419" → resolved address) → calculate_range immediately.
- NEVER call get_route before get_vehicle_state. NEVER call get_route more than once per range query. Once get_route returns any distance result, call calculate_range immediately.
- calculate_range requires batteryPercent and reportedRangeKm from get_vehicle_state, and routeDistanceKm and elevationGainM from get_route. If elevationGainM=0 that is fine — use it.
- If calculate_range returns verdict "borderline" or "no", tell the driver clearly and calmly. Never say they can make it when the verdict is borderline or no.
- If calculate_range returns verdict "yes" with estimatedArrivalPercent below 15, warn that they will arrive with very little charge.
- After calculate_range returns verdict "borderline" or "no", offer to find a charging stop. Ask: "Want me to find a charging stop on the way?"
- When the driver accepts a charging stop suggestion, call find_place with a query like "EV charging station near [midpoint city]", then call open_navigation to send the result to their phone.
- When the driver asks to navigate somewhere and open_navigation has not already been called, confirm first unless they explicitly said "navigate to" or "take me to".
- When calling get_route, check driver_memory for routing preferences and mention them naturally if relevant.
- When calling retrieve_memory, use a specific query — not generic. "routing preference" not "preferences".
- Use geocode when you need to reverse-geocode the vehicle's coordinates to find where the driver currently is. Use find_place for POI search, destination disambiguation, and charging stop search.
</tool_guidance>`;

// ── Dynamic sections (not cached — change per turn) ───────────────────────────

function buildDynamicContext(
  context: DriverContext,
  metrics: InterpretedMetrics | null
): string {
  const { vehicle, driver, environment, mode } = context;

  const vehicleSection = vehicle
    ? `<vehicle_state>
  Battery: ${vehicle.batteryPercent !== null ? `${vehicle.batteryPercent}%` : "unknown"}
  Range: ${vehicle.rangeKm !== null ? `${vehicle.rangeKm} km` : "unknown"}
  Speed: ${vehicle.speedKmh !== null ? `${vehicle.speedKmh} km/h` : "unknown"}
  Drive mode: ${vehicle.driveMode ?? "unknown"}
  Location available: ${vehicle.location !== null ? "yes" : "no"}
</vehicle_state>`
    : `<vehicle_state>No vehicle data available yet.</vehicle_state>`;

  const metricsSection = metrics
    ? `<driving_metrics>
  Braking intensity: ${formatBrakingIntensity(metrics.harshBrakingScore)}
  Fatigue signal: ${formatFatigueRisk(metrics.fatigueRisk)}
  Lateral stability: ${formatStability(metrics.lateralStabilityScore)}
  Forward clearance: ${metrics.forwardClearanceMeters !== null ? `${metrics.forwardClearanceMeters}m` : "unknown"}
  Overtake in progress: ${metrics.overtakeLikelihood > 0.6 ? "likely" : metrics.overtakeLikelihood > 0.3 ? "possible" : "no"}
  Gap fit margin: ${metrics.gapFitMarginMeters !== null ? `${metrics.gapFitMarginMeters > 0 ? "+" : ""}${metrics.gapFitMarginMeters}m` : "unknown"}
</driving_metrics>`
    : "";

  const envSection =
    environment.weather || environment.traffic
      ? `<environment>
  ${environment.weather ? `Weather: ${environment.weather.condition}, ${environment.weather.temperatureCelsius}°C` : ""}
  ${environment.traffic ? `Traffic: ${environment.traffic.summary}` : ""}
</environment>`
      : "";

  const sessionSection = `<session>
  Mode: ${mode}
  Session duration: ${driver.sessionDurationMin} minutes
  Fatigue risk level: ${driver.fatigueRisk}
</session>`;

  return [vehicleSection, metricsSection, envSection, sessionSection]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Driver state section — output of the Active Inference Engine.
 * States above 0.35 confidence are surfaced as natural language hints.
 * The LLM reads these as context, not hard instructions — the persona
 * and response format rules decide how state changes behaviour.
 */
function buildDriverStateSection(
  stateVector: DriverStateVector | null
): string {
  if (!stateVector) return "";

  const active = (Object.entries(stateVector) as Array<[string, number]>)
    .filter(([state, conf]) => conf >= 0.35 && state !== "calm")
    .sort((a, b) => b[1] - a[1]);

  if (active.length === 0) return "";

  const lines = active
    .map(([state, conf]) => `${state.replace(/_/g, " ")} (${Math.round(conf * 100)}% confidence)`)
    .join(", ");

  const behaviouralHints: string[] = [];
  for (const [state] of active) {
    switch (state) {
      case "fatigued":
        behaviouralHints.push(
          "The driver may be tired. Be attentive without being alarmist. If natural, gently suggest a rest stop or a check-in. Keep responses calm and clear."
        );
        break;
      case "stressed":
        behaviouralHints.push(
          "The driver appears under pressure. Be direct and solution-focused. No small talk, no long explanations. Offer concrete help."
        );
        break;
      case "distracted":
        behaviouralHints.push(
          "The driver's attention seems divided. Keep responses minimal. Defer non-urgent topics."
        );
        break;
      case "late_for_event":
        behaviouralHints.push(
          "The driver is likely running late. Maximum brevity. Prioritise speed and actionable information."
        );
        break;
    }
  }

  return `<driver_state>
The driver currently appears: ${lines}.
${behaviouralHints.join("\n")}
This is inferred context, not stated by the driver. Do not announce that you have detected their state — adapt naturally.
</driver_state>`;
}

function buildMemorySection(context: DriverContext): string {
  if (context.memory.length === 0) return "";

  const chunks = context.memory
    .map((m) => `  - ${m.content}`)
    .join("\n");

  return `<driver_memory>
The following are confirmed facts and preferences about this driver from previous sessions.
Apply them naturally — do not quote them back. Use them to personalise your responses.
${chunks}
</driver_memory>`;
}

function buildConversationHistorySection(history: ConversationTurn[]): string {
  if (history.length === 0) return "";

  const turns = history
    .filter(t => t.role === "user" || t.role === "assistant")
    .map(t => `  <turn role="${t.role === "assistant" ? "eva" : "driver"}">${t.content}</turn>`)
    .join("\n");

  return `<conversation_history>
Recent conversation turns from this session (oldest first, most recent last):
${turns}
</conversation_history>`;
}

function buildConfirmationSection(
  confirmations: PendingConfirmationHint[],
  context: DriverContext
): string {
  if (confirmations.length === 0) return "";

  // Never ask during safety-critical modes
  if (context.mode === "fatigue") return "";

  // Quiet Companion: only ask if the topic naturally comes up — don't insert unprompted
  // We still include the section so Claude is aware, but instruct appropriately
  const quietMode = context.persona === "quiet_companion";

  const items = confirmations
    .slice(0, 1) // Max one confirmation per response
    .map(c => `  - [category: ${c.category}] Suggested: "${c.suggestedQuestion}"`)
    .join("\n");

  return `<pending_confirmations>
${quietMode
    ? "You are in Quiet Companion mode. Only ask a confirmation question if the driver has already been talking about the topic. Do not introduce it unprompted."
    : "At a natural point at the end of your response — only if you are not mid-task and there is no safety event — you may ask ONE of the following confirmation questions. Keep it brief and natural. Do not ask if the driver is stressed, rushing, or mid-manoeuvre."}
${items}
</pending_confirmations>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBrakingIntensity(score: number): string {
  if (score >= 0.8) return "emergency";
  if (score >= 0.5) return "harsh";
  if (score >= 0.1) return "moderate";
  return "normal";
}

function formatFatigueRisk(risk: number): string {
  if (risk >= 0.7) return "high";
  if (risk >= 0.35) return "medium";
  return "low";
}

function formatStability(score: number): string {
  if (score >= 0.8) return "stable";
  if (score >= 0.5) return "moderate";
  return "unstable";
}
