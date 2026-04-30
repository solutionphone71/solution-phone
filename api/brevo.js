// /api/brevo.js — Proxy Brevo (email + SMS) pour Solution Phone
// Protege la cle API Brevo cote serveur

const BREVO_KEY = process.env.BREVO_API_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  // type = "email" ou "sms"
  const { type } = req.query;

  let brevoUrl;
  if (type === 'sms') {
    brevoUrl = 'https://api.brevo.com/v3/transactionalSMS/sms';
  } else if (type === 'email') {
    brevoUrl = 'https://api.brevo.com/v3/smtp/email';
  } else {
    return res.status(400).json({ error: 'Parametre "type" requis (email ou sms)' });
  }

  // Utiliser la cle d'env ou celle fournie par le client (migration progressive)
  const apiKey = BREVO_KEY || req.headers['x-brevo-key'];
  if (!apiKey) return res.status(500).json({ error: 'Cle Brevo non configuree' });

  try {
    const response = await fetch(brevoUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json'
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.text();
    res.status(response.status);
    res.setHeader('Content-Type', 'application/json');
    return res.send(data);
  } catch (e) {
    console.error('Proxy Brevo error:', e);
    return res.status(500).json({ error: 'Erreur proxy Brevo' });
  }
}
