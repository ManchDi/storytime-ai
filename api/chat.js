import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { history } = req.body;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return res.status(400).json({ error: 'history is required' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Serverless functions are stateless, so we reconstruct the conversation
    // from the full history on every call instead of maintaining a Chat session
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }],
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents,
      config: {
        systemInstruction:
          'You are a friendly and curious robot friend for a young child. Keep your answers simple, encouraging, and short. Use fun emojis. Your name is Sparky.',
      },
    });

    res.status(200).json({ text: response.text });
  } catch (error) {
    const status = error?.status === 429 ? 429 : 500;
    res.status(status).json({ error: error.message || 'Chat failed' });
  }
};
