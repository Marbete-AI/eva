import type { DriverInputSignals } from "@eva/types";

/**
 * Silo 2 — Driver input text signals.
 *
 * Deterministic extraction of state-relevant signals from recent driver
 * messages. Pure functions, no ML, no network. This is what runs in a
 * normal participant car where text/voice transcripts are the richest
 * available signal source.
 *
 * The fine-tuned GPT-4o mini replaces/augments this later with learned
 * extraction — but these rules are the auditable baseline, and the
 * comparison benchmark for the mini.
 */

// Hedge words — indicators of uncertainty / cognitive load
const HEDGE_WORDS = [
  "um", "uh", "erm", "hmm",
  "maybe", "perhaps", "possibly",
  "kind of", "sort of", "i think", "i guess", "not sure",
];

// Frustration markers — indicators of stress
const FRUSTRATION_MARKERS = [
  "come on", "for god's sake", "for gods sake", "ffs", "ugh", "argh",
  "seriously", "why is", "not again", "hurry", "so slow", "ridiculous",
  "stupid", "hate this", "sick of",
];

// Explicit fatigue mentions
const FATIGUE_MENTIONS = [
  "tired", "exhausted", "knackered", "sleepy", "shattered", "drained",
  "can't focus", "cant focus", "long day", "need a break", "need coffee",
  "worn out", "drowsy",
];

/**
 * Analyse the last N driver messages for state-relevant text signals.
 *
 * @param driverMessages — most recent driver utterances, newest last.
 *   Pass an empty array when no messages yet (signals return null/empty).
 */
export function extractDriverInputSignals(
  driverMessages: string[]
): DriverInputSignals {
  if (driverMessages.length === 0) {
    return {
      meanMessageLength: null,
      hedgeDensity: null,
      frustrationMarkers: [],
      fatigueMentions: [],
      messageCount: 0,
    };
  }

  const joined = driverMessages.join(" ").toLowerCase();
  const totalWords = joined.split(/\s+/).filter(Boolean).length;

  // Mean message length in words
  const meanMessageLength =
    Math.round(
      (driverMessages.reduce(
        (sum, m) => sum + m.split(/\s+/).filter(Boolean).length,
        0
      ) /
        driverMessages.length) *
        10
    ) / 10;

  // Hedge density per 100 words
  let hedgeCount = 0;
  for (const hedge of HEDGE_WORDS) {
    hedgeCount += countOccurrences(joined, hedge);
  }
  const hedgeDensity =
    totalWords > 0 ? Math.round((hedgeCount / totalWords) * 100 * 10) / 10 : null;

  // Frustration markers found
  const frustrationMarkers = FRUSTRATION_MARKERS.filter(m =>
    joined.includes(m)
  );

  // Fatigue mentions found
  const fatigueMentions = FATIGUE_MENTIONS.filter(m => joined.includes(m));

  return {
    meanMessageLength,
    hedgeDensity,
    frustrationMarkers,
    fatigueMentions,
    messageCount: driverMessages.length,
  };
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count++;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}
