// api/proxy-ecologic.js — Proxy Vercel pour Ecologic GesCo QualiRépar
// La clé API est injectée côté serveur

const ECOLOGIC_API_KEY = '8121d135-4635-412d-b7ab-3b4dd61cbdb8';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, 'https://app.solution-phone.fr');

    // ── Extraire le sous-chemin (ex: /printbrandlist, /CreateClaim) ──
    // Méthode 1 : depuis url.pathname
    let path = url.pathname
      .replace('/api/proxy-ecologic', '')
      .replace('/proxy-ecologic', '');

    // Méthode 2 : depuis req.query.path (Vercel rewrite capture :path*)
    if (!path || path === '/') {
      if (req.query && req.query.path) {
        const captured = Array.isArray(req.query.path)
          ? req.query.path.join('/')
          : req.query.path;
        if (captured) path = '/' + captured;
      }
    }

    path = path || '/';

    // ── Diagnostic : GET /proxy-ecologic/__test renvoie les infos de debug ──
    if (path === '/__test') {
      return res.status(200).json({
        ok: true,
        reqUrl: req.url,
        reqQueryPath: req.query?.path || null,
        extractedPath: path,
        keyPresent: !!ECOLOGIC_API_KEY,
        keyFirst4: ECOLOGIC_API_KEY ? ECOLOGIC_API_KEY.substring(0, 4) + '...' : null,
        timestamp: new Date().toISOString()
      });
    }

    // ── Construire l'URL cible Ecologic ──
    const qs = new URLSearchParams(url.search);
    // Supprimer le param "path" injecté par Vercel rewrite
    qs.delete('path');
    // Ajouter la clé API
    qs.set('ApiKey', ECOLOGIC_API_KEY);

    const targetUrl = `https://apiecologic.e-reparateur.eco/api/v1/ecosupport${path}?${qs.toString()}`;

    // ── Headers (pas de Content-Type sur GET pour éviter les rejets) ──
    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
      'ApiKey': ECOLOGIC_API_KEY,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('[proxy-ecologic] req.url:', req.url);
    console.log('[proxy-ecologic] req.query.path:', req.query?.path);
    console.log('[proxy-ecologic] extracted path:', path);
    console.log('[proxy-ecologic] →', req.method, targetUrl.replace(ECOLOGIC_API_KEY, '***'));

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
    });

    const responseText = await response.text();
    console.log('[proxy-ecologic] ← status:', response.status, 'body:', responseText.substring(0, 300));

    // Ajouter des headers de debug (visibles dans DevTools)
    res.setHeader('X-Eco-Path', path);
    res.setHeader('X-Eco-Status', String(response.status));

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecologic] Error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
