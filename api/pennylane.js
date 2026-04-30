// /api/pennylane.js — Proxy Pennylane pour Solution Phone
// Protege la cle API comptabilite cote serveur

const PENNYLANE_KEY = process.env.PENNYLANE_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = PENNYLANE_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Cle Pennylane non configuree' });

  // Endpoint autorise
  const { endpoint } = req.query;
  const ALLOWED = ['customer_invoices', 'suppliers', 'categories'];
  if (!endpoint || !ALLOWED.includes(endpoint)) {
    return res.status(400).json({ error: 'Endpoint non autorise' });
  }

  const url = `https://app.pennylane.com/api/external/v1/${endpoint}`;

  try {
    const response = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
    });

    const data = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(data);
  } catch (e) {
    console.error('Proxy Pennylane error:', e);
    return res.status(500).json({ error: 'Erreur proxy Pennylane' });
  }
}
