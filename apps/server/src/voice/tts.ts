/**
 * ElevenLabs TTS — converts EVA's text response to audio.
 *
 * Returns base64-encoded MP3 audio that the mobile app plays via
 * react-native-sound.
 *
 * Voice selection is configurable per persona via environment variables.
 * If an env var is not set, the hardcoded default is used.
 *
 *   ELEVENLABS_VOICE_COPILOT          — Co-pilot persona voice ID
 *   ELEVENLABS_VOICE_QUIET_COMPANION  — Quiet Companion persona voice ID
 *   ELEVENLABS_VOICE_MEETING_MODE     — Meeting Mode persona voice ID
 *
 * Using ElevenLabs Turbo v2.5 — lowest latency, lowest cost per character.
 * Model is also configurable via ELEVENLABS_MODEL_ID.
 */

const ELEVENLABS_BASE = "https://api.elevenlabs.io/v1";

// Default voice IDs — overridden by env vars at runtime
const DEFAULT_VOICE_IDS: Record<string, string> = {
  copilot:         "2vbhUP8zyKg4dEZaTWGn",
  quiet_companion: "NcJuO1kJ19MefFnxN1Ls",
  meeting_mode:    "oW8bn5YtBB89X2nJ0DT9",
};

function getVoiceId(persona: string): string {
  // Allow per-persona override via env vars
  const envKey = `ELEVENLABS_VOICE_${persona.toUpperCase()}`;
  const fromEnv = process.env[envKey];
  if (fromEnv?.trim()) return fromEnv.trim();

  return DEFAULT_VOICE_IDS[persona] ?? DEFAULT_VOICE_IDS["copilot"]!;
}

const MODEL_ID = process.env["ELEVENLABS_MODEL_ID"] ?? "eleven_turbo_v2_5";

const VOICE_SETTINGS = {
  stability: 0.5,
  similarity_boost: 0.75,
  style: 0.0,
  use_speaker_boost: true,
};

export interface TTSResult {
  audioBase64: string; // Base64-encoded MP3
  durationMs: number;  // How long the TTS call took
  characters: number;  // Character count — for billing monitoring
}

export async function synthesiseSpeech(
  text: string,
  persona: string = "copilot"
): Promise<TTSResult | null> {
  const apiKey = process.env["ELEVENLABS_API_KEY"];
  if (!apiKey) {
    console.warn("[tts] ELEVENLABS_API_KEY not set — skipping TTS");
    return null;
  }

  if (!text.trim()) return null;

  const voiceId = getVoiceId(persona);
  const startMs = Date.now();

  try {
    const response = await fetch(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          model_id: MODEL_ID,
          voice_settings: VOICE_SETTINGS,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[tts] ElevenLabs error ${response.status}: ${errorText}`);
      return null;
    }

    const audioBuffer = await response.arrayBuffer();
    const audioBase64 = Buffer.from(audioBuffer).toString("base64");
    const durationMs = Date.now() - startMs;
    const characters = text.length;

    console.log(
      `[tts] Synthesised ${characters} chars in ${durationMs}ms ` +
      `(persona=${persona} voice=${voiceId} model=${MODEL_ID})`
    );

    return { audioBase64, durationMs, characters };
  } catch (err) {
    console.error("[tts] Synthesis failed:", err);
    return null;
  }
}
