// api/proxy-ecosystem.js — Proxy Vercel pour Ecosystem QualiRépar

const ENVS = {
  sandbox: 'https://sandbox-api-reparateurs.ecosystem.eco',
  ppr:     'https://ppr-api-reparateurs.ecosystem.eco',
  prod:    'https://prod-api-reparateurs.ecosystem.eco',
};

// CORS restreint aux domaines Solution Phone (appels same-origin → ne casse rien).
const ALLOWED_ORIGINS = [
  'https://app.solution-phone.fr',
  'https://solution-phone.fr',
  'https://www.solution-phone.fr',
];
function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin',
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
}

// Les modes debug/test ne sont accessibles que si un token secret est fourni
// (?key=) ET qu'il correspond à la variable Vercel DEBUG_TOKEN. Sans variable
// configurée, ces modes restent désactivés en production.
function debugAllowed(req) {
  const token = process.env.DEBUG_TOKEN;
  return !!token && req.query.key === token;
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Mode dépôt S3 : le navigateur n'arrive pas toujours à PUT directement vers le
  // bucket S3 d'Ecosystem (CORS / réseau). On reçoit {url, contentType, dataB64}
  // et on effectue le PUT côté serveur (pas de CORS serveur→serveur).
  if (req.method === 'POST' && req.query.s3put === '1') {
    try {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const { url, contentType, dataB64 } = payload;
      if (!url || !dataB64) {
        return res.status(400).json({ ok: false, error: 'url et dataB64 requis' });
      }
      const buf = Buffer.from(dataB64, 'base64');
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 25000);
      const put = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': contentType || 'application/octet-stream' },
        body: buf,
        signal: controller.signal,
      });
      clearTimeout(t);
      const txt = await put.text().catch(() => '');
      console.log('[proxy-ecosystem] s3put', put.status, (txt || '').substring(0, 200));
      return res.status(200).json({ ok: put.ok, status: put.status, body: (txt || '').substring(0, 300) });
    } catch (e) {
      console.error('[proxy-ecosystem] s3put error', e.message);
      return res.status(200).json({ ok: false, status: 0, error: e.message });
    }
  }

  // Mode debug: GET /api/proxy-ecosystem?debug=1&key=<DEBUG_TOKEN>
  if (req.query.debug === '1') {
    if (!debugAllowed(req)) return res.status(404).end();
    return res.status(200).json({
      debug: true,
      version: '2026-05-05-v6-prod',
      envs: ENVS,
      reqUrl: req.url,
      query: req.query,
      method: req.method,
      headers: Object.keys(req.headers),
    });
  }

  // Mode test: GET /api/proxy-ecosystem?test=1 — teste /login sur tous les envs
  // (payload aligné avec l'app: {username, password} et path /login en minuscules)
  if (req.query.test === '1') {
    if (!debugAllowed(req)) return res.status(404).end();
    const id = req.query.id || '501710';
    const pw = req.query.pw || '';
    const results = {};
    for (const [envName, baseUrl] of Object.entries(ENVS)) {
      try {
        const r = await fetch(`${baseUrl}/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ username: id, password: pw }),
        });
        results[envName] = { status: r.status, body: await r.text(), url: `${baseUrl}/login` };
      } catch (e) {
        results[envName] = { error: e.message, url: `${baseUrl}/login` };
      }
    }
    return res.status(200).json({ test: true, version: '2026-05-05-v6-prod', results });
  }

  try {
    // Path cible via query param ?p=/Login
    const path = req.query.p || '/';
    const env = req.query.env || 'prod';
    const baseUrl = ENVS[env] || ENVS.prod;
    const targetUrl = `${baseUrl}${path}`;

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
    res.setHeader('X-Debug-Env', env);
    res.setHeader('X-Debug-Version', '2026-05-05-v6-prod');
    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecosystem] Error:', error.message, error.cause || '');
    res.status(502).json({
      error: 'Proxy error',
      message: error.message,
      detail: error.cause ? String(error.cause) : 'Impossible de joindre le serveur Ecosystem',
      targetUrl: `${ENVS[req.query.env] || ENVS.prod}${req.query.p || '/'}`
    });
  }
}
