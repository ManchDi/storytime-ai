export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const fullPrompt = `children's storybook illustration, whimsical, colorful, cartoon style: ${prompt}`;

  try {
    const response = await fetch(
      'https://router.huggingface.co/hf-inference/models/stabilityai/stable-diffusion-2-1',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
          'x-wait-for-model': 'true',
        },
        body: JSON.stringify({ inputs: fullPrompt }),
      }
    );

    console.log('HF response status:', response.status);

    if (response.status === 429) {
      return res.status(429).json({ error: 'Quota exceeded' });
    }

    if (!response.ok) {
      const text = await response.text();
      console.error('HF error:', text);
      return res.status(500).json({ error: `HuggingFace error: ${text}` });
    }

    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    res.status(200).json({ imageBytes: base64, mimeType: 'image/png' });

  } catch (error) {
    console.error('Caught error:', error.message);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
}