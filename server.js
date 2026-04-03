const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const DATA_DIR = '/data';
const HERO_PATH = path.join(DATA_DIR, 'hero.txt');
const DISHES_PATH = path.join(DATA_DIR, 'dishes.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}

app.get('/api/dishes', (req, res) => {
  try {
    if (fs.existsSync(DISHES_PATH)) {
      const data = fs.readFileSync(DISHES_PATH, 'utf8');
      res.json(JSON.parse(data));
    } else { res.json([]); }
  } catch(e) { res.json([]); }
});

app.post('/api/dishes', (req, res) => {
  try {
    const dishes = req.body;
    if (!Array.isArray(dishes)) return res.status(400).json({ error: 'Invalid data' });
    fs.writeFileSync(DISHES_PATH, JSON.stringify(dishes), 'utf8');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/hero', (req, res) => {
  try {
    if (fs.existsSync(HERO_PATH)) {
      const image = fs.readFileSync(HERO_PATH, 'utf8');
      res.json({ image });
    } else { res.json({ image: null }); }
  } catch(e) { res.json({ image: null }); }
});

app.post('/api/hero', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: 'No image data' });
  try {
    fs.writeFileSync(HERO_PATH, image, 'utf8');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

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
        messages: [{ role: 'user', content: dishName + 'の家庭料理レシピ（2人前）をJSONで。' }],
      }),
    });
    const data = await response.json();
    const text = data.content?.find(c => c.type === 'text')?.text || '{}';
    const recipe = JSON.parse(text.replace(/```json|```/g, '').trim());
    res.json(recipe);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log('Server running on port ' + PORT));