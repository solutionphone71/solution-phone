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
    // Lire le path depuis __path (passé par vercel.json rewrite)
    const url = new URL(req.url, 'https://app.solution-phone.fr');
    const params = new URLSearchParams(url.search);

    let path = '/';
    // 1) __path query param (vercel.json rewrite: ?__path=:path*)
    if (params.get('__path')) {
      path = '/' + params.get('__path');
    }
    // 2) Fallback: req.query.path (Vercel dynamic route)
    else if (req.query && req.query.__path) {
      const segments = Array.isArray(req.query.__path) ? req.query.__path.join('/') : req.query.__path;
      if (segments) path = '/' + segments;
    }
    // 3) Fallback: parser req.url
    else {
      const parsed = url.pathname.replace('/api/proxy-ecosystem', '').replace('/proxy-ecosystem', '');
      if (parsed && parsed !== '/') path = parsed;
    }

    // Reconstruire les query params (sans __path interne)
    params.delete('__path');
    params.delete('path');
    const qs = params.toString() ? '?' + params.toString() : '';

    // PPR = environnement test Ecosystem (confirmé par email avril 2026)
    const targetUrl = `https://ppr-api-reparateurs.ecosystem.eco${path}${qs}`;

    console.log('[proxy-ecosystem] →', req.method, targetUrl, '| req.url:', req.url, '| query.path:', req.query?.path);

    const headers = {
      'Accept': 'application/json',
    };

    // Transmettre Content-Type du client (important pour /Login)
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    } else if (req.method === 'POST' || req.method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

    // Transmettre le token d'authentification
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
