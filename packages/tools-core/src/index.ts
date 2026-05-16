/**
 * Shared tool definitions for EVA.
 * Tool names are defined as constants so they're consistent
 * across server implementations and test mocks.
 */

export const EVA_TOOLS = {
  GET_VEHICLE_STATE: "get_vehicle_state",
  GET_ADAS_SIGNALS: "get_adas_signals",
  GET_WEATHER: "get_weather",
  GET_ROUTE: "get_route",
  RETRIEVE_MEMORY: "retrieve_memory",
  STORE_FEEDBACK: "store_feedback",
  DISPATCH_HAVMCO: "dispatch_havmco",
  SET_MODE: "set_mode",
  INITIATE_CALL: "initiate_call",
  ASK_GEMINI: "ask_gemini", // Week 3+
} as const;

export type EvaToolName = typeof EVA_TOOLS[keyof typeof EVA_TOOLS];
