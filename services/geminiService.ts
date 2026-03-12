import { GoogleGenAI, Modality } from "@google/genai";
import { ChatMessage, StoryConfig } from "../types";

// ─── Audio helpers ────────────────────────────────────────────────────────────

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

// ─── Quota error ──────────────────────────────────────────────────────────────

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

// ─── Theme generation ─────────────────────────────────────────────────────────

export const generateTheme = async (
  childName: string,
  previousThemes: string[]
): Promise<string> => {
  const res = await callProxy('generate-theme', { childName, previousThemes });
  const data = await res.json();
  return data.theme;
};

// ─── Story generation ─────────────────────────────────────────────────────────

export const generateStoryPage = async (
  config: StoryConfig,
  pageIndex: number,
  previousPages: string[]
): Promise<{ text: string; imagePrompt: string }> => {
  const res = await callProxy("generate-story", {
    childName: config.childName,
    theme: config.theme,
    pageCount: config.pageCount,
    includeChild: config.includeChild,
    pageIndex,
    previousPages,
  });
  return res.json();
};

// ─── Image generation ─────────────────────────────────────────────────────────

export const generateImage = async (prompt: string): Promise<string> => {
  const res = await callProxy("generate-image", { prompt });
  const { imageBytes, mimeType } = await res.json();
  return `data:${mimeType};base64,${imageBytes}`;
};

// ─── Speech generation ────────────────────────────────────────────────────────

export const generateSpeech = async (
  text: string,
  userApiKey?: string
): Promise<AudioBuffer> => {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({
    sampleRate: 24000,
  });

  let base64Audio: string;

  if (userApiKey) {
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
    const res = await callProxy("generate-speech", { text });
    const data = await res.json();
    base64Audio = data.audioData;
  }

  if (!base64Audio) throw new Error("No audio data received");
  return buildAudioBuffer(decode(base64Audio), ctx);
};

// ─── Chat ─────────────────────────────────────────────────────────────────────

export const getChatResponse = async (
  history: ChatMessage[],
  userApiKey?: string
): Promise<string> => {
  if (userApiKey) {
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

  const res = await callProxy("chat", { history });
  const data = await res.json();
  return data.text;
};