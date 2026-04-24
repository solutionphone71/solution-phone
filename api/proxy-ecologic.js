// api/proxy-ecologic.js — Proxy Vercel pour Ecologic QualiRépar
// Supporte les 2 APIs : ancienne (ecologic-france.com) + nouvelle (e-reparateur.eco)

const ECOLOGIC_API_KEY = '8121d135-4635-412d-b7ab-3b4dd61cbdb8';

// Ancien endpoint (fonctionnait au 27/03/2026)
const OLD_API = 'https://www.ecologic-france.com/admin/ajax/_actions.php';
// Nouveau endpoint GesCo (ne reconnait pas la clé actuellement)
const NEW_API = 'https://apiecologic.e-reparateur.eco/api/v1/ecosupport';

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

    // ── Diagnostic : teste les 2 endpoints ──
    if (path === '/__testlive') {
      const results = {};
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

      // Test 1: ANCIEN endpoint — ecologic-france.com avec Bearer token
      try {
        const r1 = await fetch(OLD_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + ECOLOGIC_API_KEY,
            'User-Agent': ua
          },
          body: JSON.stringify({ action: 'PrintBrandList' })
        });
        const t1 = await r1.text();
        results.oldApi_bearer = { status: r1.status, body: t1.substring(0, 400) };
      } catch(e) { results.oldApi_bearer = { error: e.message }; }

      // Test 2: ANCIEN endpoint — avec x-api-key
      try {
        const r2 = await fetch(OLD_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ECOLOGIC_API_KEY,
            'User-Agent': ua
          },
          body: JSON.stringify({ action: 'PrintBrandList' })
        });
        const t2 = await r2.text();
        results.oldApi_xapikey = { status: r2.status, body: t2.substring(0, 400) };
      } catch(e) { results.oldApi_xapikey = { error: e.message }; }

      // Test 3: NOUVEAU endpoint — query string
      try {
        const r3 = await fetch(NEW_API + '/PrintBrandList?ApiKey=' + ECOLOGIC_API_KEY, {
          method: 'GET',
          headers: { 'Accept': 'application/json', 'User-Agent': ua }
        });
        const t3 = await r3.text();
        results.newApi_querystring = { status: r3.status, body: t3.substring(0, 400) };
      } catch(e) { results.newApi_querystring = { error: e.message }; }

      return res.status(200).json({ tests: results });
    }

    // ── Proxy normal : appel vers la nouvelle API GesCo ──
    const qs = new URLSearchParams(url.search);
    qs.delete('path');
    qs.set('ApiKey', ECOLOGIC_API_KEY);
    const targetUrl = `${NEW_API}${path}?${qs.toString()}`;

    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
      'ApiKey': ECOLOGIC_API_KEY,
      'Authorization': 'Bearer ' + ECOLOGIC_API_KEY,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      headers['Content-Type'] = req.headers['content-type'] || 'application/json';
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('[proxy-ecologic] →', req.method, targetUrl.replace(ECOLOGIC_API_KEY, '***'));

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
