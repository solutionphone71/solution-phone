// api/proxy-kiwiz.js — Proxy Vercel pour Kiwiz NF525
// Résout le problème CORS + 405 Method Not Allowed des rewrites simples

export default async function handler(req, res) {
  // Headers CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://app.solution-phone.fr');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');

  // Preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Reconstruire le chemin Kiwiz depuis l'URL
    const url = new URL(req.url, 'https://app.solution-phone.fr');
    const kiwizPath = url.pathname.replace('/api/proxy-kiwiz', '').replace('/proxy-kiwiz', '') || '/';
    const kiwizUrl = `https://api.kiwiz.io${kiwizPath}${url.search}`;

    // Construire les headers à transmettre
    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
    };

    // Content-Type selon la requête
    if (req.headers['content-type']) {
      headers['Content-Type'] = req.headers['content-type'];
    } else if (req.method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    // Body
    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      if (typeof req.body === 'string') {
        body = req.body;
      } else if (req.body && typeof req.body === 'object') {
        // Si x-www-form-urlencoded
        if (headers['Content-Type']?.includes('x-www-form-urlencoded')) {
          body = new URLSearchParams(req.body).toString();
        } else {
          body = JSON.stringify(req.body);
        }
      }
    }

    const response = await fetch(kiwizUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || 'application/json';

    res.setHeader('Content-Type', contentType);
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-kiwiz] Error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
