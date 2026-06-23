// api/proxy-ecologic.js — Proxy Vercel pour Ecologic GesCo QualiRépar
// Doc officielle : header "api_key" (minuscule + underscore)
//
// SÉCURITÉ : la clé API vient de Vercel → Settings → Environment Variables →
// ECOLOGIC_API_KEY (scope Production + Preview, vérifié le 23/06/2026).
// Ne JAMAIS remettre la valeur en clair ici.

const ECOLOGIC_API_KEY = process.env.ECOLOGIC_API_KEY;
const ECOLOGIC_API_BASE = 'https://apiecologic.e-reparateur.eco/api/v1/ecosupport';

// CORS : on n'autorise que les domaines Solution Phone (les appels du proxy
// sont same-origin, donc ça ne casse rien et ça empêche un site tiers
// d'utiliser ce proxy — et donc la clé API — depuis le navigateur).
const ALLOWED_ORIGINS = [
  'https://app.solution-phone.fr',
  'https://solution-phone.fr',
  'https://www.solution-phone.fr',
];
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGINS[0]);
  }
  res.setHeader('Vary', 'Origin');
}

export default async function handler(req, res) {
  applyCors(req, res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, 'https://app.solution-phone.fr');

    // Extraire le sous-chemin
    let path = url.pathname
      .replace('/api/proxy-ecologic', '')
      .replace('/proxy-ecologic', '');
    if (!path || path === '/') {
      if (req.query && req.query.path) {
        const captured = Array.isArray(req.query.path)
          ? req.query.path.join('/')
          : req.query.path;
        if (captured) path = '/' + captured;
      }
    }
    path = path || '/';

    // Query string (sans le "path" injecté par Vercel)
    const qs = new URLSearchParams(url.search);
    qs.delete('path');
    const qsStr = qs.toString();
    const targetUrl = `${ECOLOGIC_API_BASE}${path}${qsStr ? '?' + qsStr : ''}`;

    // Headers — clé dans "api_key" (doc officielle Ecologic)
    const headers = {
      'Accept': 'application/json',
      'api_key': ECOLOGIC_API_KEY,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('[proxy-ecologic] →', req.method, targetUrl);

    const response = await fetch(targetUrl, { method: req.method, headers, body });
    const responseText = await response.text();
    console.log('[proxy-ecologic] ← status:', response.status, 'body:', responseText.substring(0, 300));

    res.setHeader('Content-Type', response.headers.get('content-type') || 'application/json');
    res.status(response.status).send(responseText);

  } catch (error) {
    console.error('[proxy-ecologic] Error:', error.message);
    res.status(500).json({ error: 'Proxy error', message: error.message });
  }
}
