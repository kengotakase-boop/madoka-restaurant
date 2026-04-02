const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/recipe', async (req, res) => {
  const { dishName } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'No API key' });
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: '料理レシピの専門家です。必ずJSON形式のみで回答。{"ingredients":["材料1 分量"],"steps":["手順1"]}',
        messages: [{ role: 'user', content: dishName + 'の家庭料理レシピ（4人分）をJSONで。' }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find(c => c.type === 'text')?.text || '{}';
    const recipe = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json(recipe);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));
