import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage } from "../types";

// ─── Audio helpers (used for direct API path only) ───────────────────────────

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function buildAudioBuffer(data: Uint8Array, ctx: AudioContext): AudioBuffer {
  const dataInt16 = new Int16Array(data.buffer);
  const buffer = ctx.createBuffer(1, dataInt16.length, 24000);
  const channelData = buffer.getChannelData(0);
  for (let i = 0; i < dataInt16.length; i++) {
    channelData[i] = dataInt16[i] / 32768.0;
  }
  return buffer;
}

// ─── Core API caller ──────────────────────────────────────────────────────────
// Tries the Vercel proxy first (free tier, key stays server-side).
// If the proxy returns 429 (quota exceeded), throws a QuotaError so the UI
// can prompt the user for their own key.
// If the user has supplied their own key, skips the proxy entirely.

export class QuotaError extends Error {
  constructor() {
    super("QUOTA_EXCEEDED");
    this.name = "QuotaError";
  }
}

async function callProxy(endpoint: string, body: object): Promise<Response> {
  const res = await fetch(`/api/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (res.status === 429) throw new QuotaError();
  if (!res.ok) throw new Error(`Proxy error: ${res.statusText}`);
  return res;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const generateImage = async (
  prompt: string,
  userApiKey?: string
): Promise<string> => {
  // Pollinations.ai is free with no API key — build the URL directly
  // userApiKey is ignored for images since no key is needed
  const encoded = encodeURIComponent(
    `children's storybook illustration, whimsical, colorful, cartoon style: ${prompt}`
  );
  return `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true&seed=${Date.now()}`;
};

export const generateSpeech = async (
  text: string,
  userApiKey?: string
): Promise<AudioBuffer> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 24000,
  });

  let base64Audio: string;

  if (userApiKey) {
    // Direct path
    const ai = new GoogleGenAI({ apiKey: userApiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Read this in a friendly, gentle storyteller voice: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } },
      },
    });
    base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? "";
  } else {
    // Proxy path
    const res = await callProxy("generate-speech", { text });
    const data = await res.json();
    base64Audio = data.audioData;
  }

  if (!base64Audio) throw new Error("No audio data received");
  return buildAudioBuffer(decode(base64Audio), ctx);
};

export const getChatResponse = async (
  history: ChatMessage[],
  userApiKey?: string
): Promise<string> => {
  if (userApiKey) {
    // Direct path — reconstruct conversation with full history
    const ai = new GoogleGenAI({ apiKey: userApiKey });
    const contents = history.map((msg) => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents,
      config: {
        systemInstruction:
          "You are a friendly and curious robot friend for a young child. Keep your answers simple, encouraging, and short. Use fun emojis. Your name is Sparky.",
      },
    });
    return response.text;
  }

  // Proxy path
  const res = await callProxy("chat", { history });
  const data = await res.json();
  return data.text;
};