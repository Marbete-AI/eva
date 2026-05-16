import { generateText } from "ai";
import { createReasoningModel, getReasoningConfig } from "../../providers/reasoning/index.js";
import { MEMORY_CATEGORIES, type MemoryCategory } from "./categories.js";

export interface ExtractedCandidate {
  category: MemoryCategory;
  content: string;           // Normalised, third-person: "Driver's name is Jas"
  confidence: number;        // 0.0–1.0
  evidenceQuote: string;     // Verbatim phrase that triggered this
  suggestConfirmation: boolean;
  extractionRationale: string; // Short explanation — not chain-of-thought
}

export interface ExtractionInput {
  userMessage: string;
  assistantResponse: string;
  sessionContext: {
    mode: string;
    persona: string;
    sessionDurationMin: number;
    drivingMetrics?: string;
  };
}

const EXTRACTOR_PROMPT_VERSION = "1.1.0";

/**
 * Strip markdown code fences from model output before JSON.parse.
 * Claude sometimes wraps JSON in ```json ... ``` even when told not to.
 */
function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```json\s*/im, "")
    .replace(/^```\s*/im, "")
    .replace(/```\s*$/im, "")
    .trim();
}

/**
 * Runs the passive memory extractor on a single conversation turn.
 * Returns extracted candidates — empty array if nothing significant found.
 *
 * Runs ASYNC after the response has been sent to the driver.
 * Does not block the driver-facing response path.
 *
 * Uses the same reasoning model as the main agent (Sonnet).
 * Context is minimal — only the current turn + small session context.
 */
export async function extractCandidatesFromTurn(
  input: ExtractionInput
): Promise<ExtractedCandidate[]> {
  const config = getReasoningConfig();
  const model = createReasoningModel(config);

  const categoriesFormatted = MEMORY_CATEGORIES.join(" | ");

  const systemPrompt = `<task>
You are a passive memory classifier for EVA, an in-cabin AI co-pilot.

Your job: given a single conversation turn between a driver and EVA, identify every
potentially significant fact about the driver that should be stored for future sessions.

Be aggressive — if in doubt, extract it. The rejection/confirmation system handles
false positives. Missing important information is worse than over-extracting.

Categories available: ${categoriesFormatted}

For each observation found, return a JSON object with:
- category: one of the categories above
- content: normalised third-person statement ("Driver's name is Jas", "Driver prefers fast routes")
  For preference_routing: capture the driving implication, not just the literal words.
  "Can't be bothered to change gears" → "Driver prefers automatic-friendly routes with minimal stops and gear changes"
  "Hate motorways" → "Driver avoids motorways"
  "Like scenic routes" → "Driver prefers scenic routes over fastest routes"
- confidence: 0.0 to 1.0
  - 0.9+: direct explicit first-person statement ("my name is...", "I always...", "I hate...")
  - 0.7-0.89: strong implication or clear preference expressed indirectly
  - 0.5-0.69: reasonable inference — worth asking to confirm
  - below 0.5: do not extract
- evidenceQuote: the exact words from the driver's message that triggered this
- suggestConfirmation: true if confidence is 0.5-0.74 (ask the driver), false if 0.75+
- extractionRationale: one sentence explaining why this was extracted

TEMPORAL QUALIFIER RULE:
If the driver's statement contains temporal qualifiers ("soon", "today", "this trip",
"right now", "will be", "at the moment", "tonight", "this time", "on this journey"),
lower your confidence by 0.2 and prefer emotional_state over preference_* categories —
UNLESS the statement uses clear habitual language ("always", "never", "usually", "hate",
"love", "prefer", "tend to", "can't stand", "don't like").

Example — temporal, lower confidence:
  "I will be travelling soon and can't be bothered to change gears"
  → emotional_state, content: "Driver wants minimal gear changes for upcoming trip",
    confidence: 0.55, suggestConfirmation: true
  NOT preference_routing at 0.85.

Example — habitual, full confidence:
  "I always avoid motorways"
  → preference_routing, confidence: 0.90, suggestConfirmation: false

Return a JSON array. Return [] if nothing significant (confidence >= 0.5) is found.
Return ONLY valid JSON — no prose, no markdown, no code fences.

Do NOT extract:
- Questions ("will I make it to...") unless they reveal a preference or fact
- Transient states unless they are patterns ("I'm tired" is emotional_state only if repeated)
- Things EVA said — only what the DRIVER said
- Internal reasoning or speculation
</task>`;

  const userPrompt = `<session_context>
Mode: ${input.sessionContext.mode}
Session duration: ${input.sessionContext.sessionDurationMin} minutes
${input.sessionContext.drivingMetrics ? `Driving metrics: ${input.sessionContext.drivingMetrics}` : ""}
</session_context>

<turn>
DRIVER: ${input.userMessage}
EVA: ${input.assistantResponse}
</turn>

Extract all significant facts about the driver from this turn.`;

  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      prompt: userPrompt,
      maxTokens: 1024,
    });

    const parsed = JSON.parse(stripMarkdownFences(result.text)) as unknown[];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidCandidate)
      .map(c => ({
        category: c.category as MemoryCategory,
        content: c.content,
        confidence: c.confidence,
        evidenceQuote: c.evidenceQuote,
        suggestConfirmation: c.suggestConfirmation,
        extractionRationale: c.extractionRationale,
      }));
  } catch (err) {
    console.error("[extractor] Failed to parse extraction result:", err);
    return [];
  }
}

function isValidCandidate(c: unknown): c is {
  category: string;
  content: string;
  confidence: number;
  evidenceQuote: string;
  suggestConfirmation: boolean;
  extractionRationale: string;
} {
  if (typeof c !== "object" || c === null) return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj["category"] === "string" &&
    MEMORY_CATEGORIES.includes(obj["category"] as MemoryCategory) &&
    typeof obj["content"] === "string" &&
    typeof obj["confidence"] === "number" &&
    obj["confidence"] >= 0.5 &&
    typeof obj["evidenceQuote"] === "string" &&
    typeof obj["suggestConfirmation"] === "boolean" &&
    typeof obj["extractionRationale"] === "string"
  );
}

export { EXTRACTOR_PROMPT_VERSION };
