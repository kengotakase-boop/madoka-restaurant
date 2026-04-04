const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

const DATA_DIR = '/data';
const HERO_PATH = path.join(DATA_DIR, 'hero.txt');
const DISHES_PATH = path.join(DATA_DIR, 'dishes.json');

if (!fs.existsSync(DATA_DIR)) {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch(e) {}
}

// --- Hero API ---
app.get('/api/hero', (req, res) => {
  try {
    if (fs.existsSync(HERO_PATH)) {
      const image = fs.readFileSync(HERO_PATH, 'utf8');
      res.json({ image });
    } else {
      res.json({ image: null });
    }
  } catch(e) { res.json({ image: null }); }
});

app.post('/api/hero', (req, res) => {
  const { image } = req.body;
  if (!image) {
    try { if (fs.existsSync(HERO_PATH)) fs.unlinkSync(HERO_PATH); } catch(e) {}
    return res.json({ok: true, reset: true});
  }
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(HERO_PATH, image);
    res.json({ok: true});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

app.delete('/api/hero', (req, res) => {
  try {
    if (fs.existsSync(HERO_PATH)) fs.unlinkSync(HERO_PATH);
    res.json({ok: true});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});
  try {
    fs.writeFileSync(HERO_PATH, image, 'utf8');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- Dishes API ---
app.get('/api/dishes', (req, res) => {
  try {
    if (fs.existsSync(DISHES_PATH)) {
      const data = fs.readFileSync(DISHES_PATH, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch(e) { res.json([]); }
});

app.post('/api/dishes', (req, res) => {
  const dishes = req.body;
  if (!Array.isArray(dishes)) return res.status(400).json({ error: 'Invalid data' });
  try {
    fs.writeFileSync(DISHES_PATH, JSON.stringify(dishes), 'utf8');
    res.json({ ok: true });
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// --- Recipe AI API ---
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
        system: '\u6599\u7406\u30ec\u30b7\u30d4\u306e\u5c02\u9580\u5bb6\u3067\u3059\u3002\u5fc5\u305aJSON\u5f62\u5f0f\u306e\u307f\u3067\u56de\u7b54\u3002{"ingredients":["\u6750\u6599\u0031 \u5206\u91cf"],"steps":["\u624b\u9806\u0031"]}',
        messages: [{ role: 'user', content: dishName + '\u306e\u5bb6\u5ead\u6599\u7406\u30ec\u30b7\u30d4\uff08\u0032\u4eba\u524d\uff09\u3092JSON\u3067\u3002' }],
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
