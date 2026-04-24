// api/proxy-ecologic.js — Proxy Vercel pour Ecologic GesCo QualiRépar

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With, X-Api-Key, ApiKey');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const url = new URL(req.url, 'https://app.solution-phone.fr');
    const path = url.pathname.replace('/api/proxy-ecologic', '').replace('/proxy-ecologic', '') || '/';
    const targetUrl = `https://apiecologic.e-reparateur.eco/api/v1/ecosupport${path}${url.search}`;

    const headers = {
      'Accept': req.headers['accept'] || 'application/json',
      'Content-Type': req.headers['content-type'] || 'application/json',
    };

    // Récupérer la clé API de toutes les sources possibles
    const apiKey = req.headers['apikey']
      || req.headers['x-api-key']
      || req.headers['api-key']
      || url.searchParams.get('ApiKey')
      || url.searchParams.get('apiKey')
      || url.searchParams.get('api_key')
      || (req.headers['authorization'] || '').replace('Bearer ', '');

    if (apiKey) {
      // Envoyer dans TOUS les formats possibles vers Ecologic
      headers['ApiKey'] = apiKey;
      headers['X-Api-Key'] = apiKey;
      headers['api-key'] = apiKey;
      headers['Authorization'] = apiKey;
    }

    let body = undefined;
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    console.log('[proxy-ecologic] →', req.method, targetUrl);
    console.log('[proxy-ecologic] Headers envoyés:', JSON.stringify(headers));

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
