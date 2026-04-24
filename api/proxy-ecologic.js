// api/proxy-ecologic.js — Proxy Vercel pour Ecologic GesCo QualiRépar
// La clé API est injectée côté serveur via env var ECOLOGIC_API_KEY

const ECOLOGIC_API_KEY = process.env.ECOLOGIC_API_KEY || '';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (!ECOLOGIC_API_KEY) {
    console.error('[proxy-ecologic] ECOLOGIC_API_KEY manquante dans les variables Vercel');
    return res.status(500).json({ error: 'Config serveur: ECOLOGIC_API_KEY manquante' });
  }

  try {
    const url = new URL(req.url, 'https://app.solution-phone.fr');
    const path = url.pathname.replace('/api/proxy-ecologic', '').replace('/proxy-ecologic', '') || '/';

    // Ajouter ApiKey au query string pour Ecologic
    const qs = new URLSearchParams(url.search);
    qs.set('ApiKey', ECOLOGIC_API_KEY);
    const targetUrl = `https://apiecologic.e-reparateur.eco/api/v1/ecosupport${path}?${qs.toString()}`;

    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
      'ApiKey': ECOLOGIC_API_KEY,
    };

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('[proxy-ecologic] →', req.method, targetUrl.replace(ECOLOGIC_API_KEY, '***'));

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseText = await response.text();
    console.log('[proxy-ecologic] ← status:', response.status, 'body:', responseText.substring(0, 300));
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecologic] Error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
