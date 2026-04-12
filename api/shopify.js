// /api/shopify.js — Proxy Shopify Admin API pour Solution Phone
// Protège le token Shopify côté serveur (Vercel Serverless Function)
// Supporte : GET, POST, PUT, DELETE sur l'API Admin Shopify

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Store, X-Shopify-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── Récupérer store + token depuis les headers (envoyés par le frontend)
  const store = req.headers['x-shopify-store'];   // ex: solution-accessoires.myshopify.com
  const token = req.headers['x-shopify-token'];   // ex: shpat_xxxx

  if (!store || !token) {
    return res.status(400).json({ error: 'Headers X-Shopify-Store et X-Shopify-Token requis' });
  }

  // ── Endpoint Shopify à appeler
  const { endpoint } = req.query; // ex: products.json, products/123.json, inventory_levels/set.json
  if (!endpoint) {
    return res.status(400).json({ error: 'Paramètre "endpoint" requis (ex: products.json)' });
  }

  // Sécurité : seuls certains endpoints sont autorisés
  const ALLOWED_PREFIXES = [
    'products', 'inventory_levels', 'inventory_items',
    'locations', 'metafields', 'images', 'smart_collections',
    'custom_collections', 'collects', 'shop'
  ];
  const epBase = endpoint.split('/')[0].split('.')[0];
  if (!ALLOWED_PREFIXES.includes(epBase)) {
    return res.status(403).json({ error: 'Endpoint non autorisé: ' + endpoint });
  }

  // ── Construire l'URL Shopify Admin API (avec query params supplémentaires)
  const apiVersion = '2024-10';
  const { endpoint: _ep, ...extraParams } = req.query;
  let shopifyUrl = `https://${store}/admin/api/${apiVersion}/${endpoint}`;
  const extraQs = new URLSearchParams(extraParams).toString();
  if (extraQs) shopifyUrl += '?' + extraQs;

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'X-Shopify-Access-Token': token,
        'Content-Type': 'application/json',
      },
    };

    // Ajouter le body pour POST/PUT
    if (req.method === 'POST' || req.method === 'PUT') {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const shopifyRes = await fetch(shopifyUrl, fetchOptions);

    // Gérer les réponses Shopify
    const contentType = shopifyRes.headers.get('content-type') || '';

    if (shopifyRes.status === 204) {
      return res.status(204).end();
    }

    if (!contentType.includes('application/json')) {
      const text = await shopifyRes.text();
      return res.status(shopifyRes.status).json({ error: text });
    }

    const data = await shopifyRes.json();

    // Si Shopify renvoie une erreur
    if (!shopifyRes.ok) {
      return res.status(shopifyRes.status).json(data);
    }

    return res.status(200).json(data);

  } catch (err) {
    console.error('[Shopify Proxy Error]', err);
    return res.status(500).json({ error: 'Erreur proxy Shopify: ' + err.message });
  }
}
