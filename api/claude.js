// /api/claude.js — Proxy Anthropic Claude pour Solution Phone
// Remplace le rewrite Vercel actuel + protege la cle API

const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, anthropic-version');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const apiKey = CLAUDE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Cle Anthropic non configuree' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': req.headers['anthropic-version'] || '2023-06-01'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(data);
  } catch (e) {
    console.error('Proxy Claude error:', e);
    return res.status(500).json({ error: 'Erreur proxy Claude' });
  }
}
