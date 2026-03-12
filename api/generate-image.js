import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: `Generate a children's storybook illustration: ${prompt}`,
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    const imagePart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart?.inlineData) {
      throw new Error('No image returned from API');
    }

    res.status(200).json({ imageBytes: imagePart.inlineData.data });
  } catch (error) {
    console.error('Image generation error:', JSON.stringify(error, null, 2));
    console.error('Error message:', error.message);
    const status = error?.status === 429 ? 429 : 500;
    res.status(status).json({ error: error.message || 'Image generation failed' });
  }
};