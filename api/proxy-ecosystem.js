// api/proxy-ecosystem.js — Proxy Vercel pour Ecosystem QualiRépar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, 'https://app.solution-phone.fr');
    const path = url.pathname.replace('/api/proxy-ecosystem', '').replace('/proxy-ecosystem', '') || '/';
    const targetUrl = `https://api-reparateurs.ecosystem.eco${path}${url.search}`;

    console.log('[proxy-ecosystem] →', req.method, targetUrl);

    const headers = {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'SolutionPhone/1.0',
    };

    if (req.headers['authorization']) {
      headers['Authorization'] = req.headers['authorization'];
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    console.log('[proxy-ecosystem] ←', response.status, responseText.substring(0, 200));

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecosystem] Error:', error.message, error.cause || '');
    res.status(502).json({
      error: 'Proxy error',
      message: error.message,
      detail: error.cause ? String(error.cause) : 'Impossible de joindre le serveur Ecosystem'
    });
  }
}
