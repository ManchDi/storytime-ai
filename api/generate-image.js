export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const fullPrompt = `children's storybook illustration, whimsical, colorful, cartoon style: ${prompt}`;
    
    const response = await fetch(
      'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inputs: fullPrompt,
          parameters: { width: 512, height: 512 }
        }),
      }
    );

    if (response.status === 429) {
      return res.status(429).json({ error: 'Quota exceeded' });
    }

    if (!response.ok) {
      const error = await response.text();
      console.error('HuggingFace error:', error);
      return res.status(500).json({ error: 'Image generation failed' });
    }

    // Response is raw image bytes
    const imageBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(imageBuffer).toString('base64');
    res.status(200).json({ imageBytes: base64, mimeType: 'image/jpeg' });

  } catch (error) {
    console.error('Image generation error:', error.message);
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
}