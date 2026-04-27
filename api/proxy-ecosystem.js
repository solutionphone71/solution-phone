// api/proxy-ecosystem.js — Proxy Vercel pour Ecosystem QualiRépar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Mode debug: GET /api/proxy-ecosystem?debug=1
  if (req.query.debug === '1') {
    return res.status(200).json({
      debug: true,
      version: '2026-04-27-v3',
      reqUrl: req.url,
      query: req.query,
      method: req.method,
      headers: Object.keys(req.headers),
    });
  }

  try {
    // Path cible via query param ?p=/Login
    const path = req.query.p || '/';
    const targetUrl = `https://ppr-api-reparateurs.ecosystem.eco${path}`;

    console.log('[proxy-ecosystem] →', req.method, targetUrl, '| query:', JSON.stringify(req.query));

    const headers = { 'Accept': 'application/json' };

    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    } else if (req.method === 'POST' || req.method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

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
    console.log('[proxy-ecosystem] ←', response.status, responseText.substring(0, 300));

    // Ajouter un header debug pour voir l'URL réelle
    res.setHeader('X-Debug-Target', targetUrl);
    res.setHeader('X-Debug-Version', '2026-04-27-v3');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecosystem] Error:', error.message, error.cause || '');
    res.status(502).json({
      error: 'Proxy error',
      message: error.message,
      detail: error.cause ? String(error.cause) : 'Impossible de joindre le serveur Ecosystem',
      targetUrl: `https://ppr-api-reparateurs.ecosystem.eco${req.query.p || '/'}`
    });
  }
}
