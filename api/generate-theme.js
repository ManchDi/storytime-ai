import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { childName, previousThemes } = req.body;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const avoidClause = previousThemes?.length > 0
      ? `Do NOT suggest any of these themes: ${previousThemes.join(', ')}.`
      : '';

    const nameContext = childName
      ? `The story is for a child named ${childName}.`
      : 'The story is for a young child.';

    const prompt = `You are a creative children's book author. ${nameContext}
Suggest ONE unique, imaginative story theme for a children's storybook.
${avoidClause}

The theme should be:
- 1-2 sentences max
- Whimsical and age-appropriate
- Specific enough to inspire a story (not just "a dragon" but "a dragon who is scared of fire and dreams of becoming a baker")
- Original and fun

Respond with ONLY the theme text. No labels, no quotation marks, no explanation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ parts: [{ text: prompt }] }],
    });

    res.status(200).json({ theme: response.text.trim() });
  } catch (error) {
    console.error('Theme generation error:', error.message);
    const status = error?.status === 429 ? 429 : 500;
    res.status(status).json({ error: error.message || 'Theme generation failed' });
  }
}