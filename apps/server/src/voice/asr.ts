import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env["OPENAI_API_KEY"] ?? "",
});

export interface TranscriptResult {
  transcript: string;
  confidence: number;
  durationMs: number;
}

/**
 * Transcribe audio using OpenAI Whisper (gpt-4o-audio-preview / whisper-1).
 *
 * Takes a Buffer of audio data (PCM16 or common formats), returns transcript.
 *
 * For EVA-1 PTT: driver holds button, audio is recorded on device, sent as
 * a complete chunk when button is released. This is the simplest viable ASR
 * path and sufficient for all text + PTT use cases.
 *
 * gpt-4o-realtime (streaming, sub-second latency) is the Week 5 upgrade
 * for open-mic VAD mode. For PTT, Whisper transcription is fast enough
 * (~300-500ms) and significantly cheaper.
 *
 * Audio format: the mobile app sends PCM16 16kHz mono, which Whisper accepts.
 * The server receives it as a base64-encoded string over the WS connection.
 */
export async function transcribeAudio(
  audioBase64: string,
  mimeType: string = "audio/wav"
): Promise<TranscriptResult> {
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.warn("[asr] OPENAI_API_KEY not set — returning empty transcript");
    return { transcript: "", confidence: 0, durationMs: 0 };
  }

  const startMs = Date.now();

  try {
    // Decode base64 audio to Buffer
    const audioBuffer = Buffer.from(audioBase64, "base64");

    // Create a File-like object for the OpenAI SDK
    const audioFile = new File([audioBuffer], "audio.wav", { type: mimeType });

    const response = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
      language: "en",
      response_format: "verbose_json",
    });

    const durationMs = Date.now() - startMs;

    console.log(
      `[asr] Transcribed in ${durationMs}ms: "${response.text.slice(0, 60)}${response.text.length > 60 ? "..." : ""}"`
    );

    return {
      transcript: response.text.trim(),
      confidence: 0.9, // Whisper doesn't return per-utterance confidence
      durationMs,
    };
  } catch (err) {
    console.error("[asr] Transcription failed:", err);
    return { transcript: "", confidence: 0, durationMs: Date.now() - startMs };
  }
}
