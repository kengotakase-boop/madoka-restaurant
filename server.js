const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();

const DATA_DIR = path.join(__dirname, 'data');
const HERO_PATH = path.join(DATA_DIR, 'hero.txt');
const DISHES_PATH = path.join(DATA_DIR, 'dishes.json');

app.use(express.json({limit: '50mb'}));
app.use(express.static(__dirname));

// GET /api/dishes
app.get('/api/dishes', (req, res) => {
  try {
    if (fs.existsSync(DISHES_PATH)) {
      const data = fs.readFileSync(DISHES_PATH, 'utf8');
      res.json(JSON.parse(data));
    } else {
      res.json([]);
    }
  } catch(e) {
    res.json([]);
  }
});

// POST /api/dishes
app.post('/api/dishes', (req, res) => {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, {recursive: true});
    fs.writeFileSync(DISHES_PATH, JSON.stringify(req.body));
    res.json({ok: true});
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// GET /api/hero
app.get('/api/hero', (req, res) => {
  try {
    if (fs.existsSync(HERO_PATH)) {
      const image = fs.readFileSync(HERO_PATH, 'utf8');
      res.json({image});
    } else {
      res.json({image: null});
    }
  } catch(e) {
    res.json({image: null});
  }
});

// POST /api/hero (image=null or empty resets hero)
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

// POST /api/recipe
app.post('/api/recipe', async (req, res) => {
  const { dishName } = req.body;
  if (!dishName) return res.status(400).json({error: 'No dish name'});
  try {
    const https = require('https');
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({error: 'No API key'});
    const prompt = dishName + ' \u306e\u30ec\u30b7\u30d4\u3092JSON\u5f62\u5f0f\u3067\u8fd4\u3057\u3066\u304f\u3060\u3055\u3044\u3002\u5f62\u5f0f: {"ingredients":["..."],"steps":["..."]}';
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{role: 'user', content: prompt}]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      }
    };
    const apiReq = https.request(options, (apiRes) => {
      let data = '';
      apiRes.on('data', chunk => data += chunk);
      apiRes.on('end', () => {
        try {
          const result = JSON.parse(data);
          const text = result.content[0].text;
          const clean = text.replace(/```json|```/g, '').trim();
          res.json(JSON.parse(clean));
        } catch(e) {
          res.status(500).json({error: 'Parse error'});
        }
      });
    });
    apiReq.on('error', e => res.status(500).json({error: e.message}));
    apiReq.write(body);
    apiReq.end();
  } catch(e) {
    res.status(500).json({error: e.message});
  }
});

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Server running on port ' + PORT));
