// /api/render/placid.js — Génération visuels via Placid API
// Solution Phone · Phase Visuel · mai 2026
//
// POST /api/render/placid
// Body: { template: 'price_card' | 'qualirepar' | 'trust' | 'review_quote',
//         layers: { layer_name: { text: "..." } } }
//
// Renvoie l'URL de l'image générée (Placid CDN).
//
// Templates IDs sont stockés dans agent_memory.placid_templates,
// éditables par Sébastien depuis l'onglet Config.

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const PLACID_KEY = process.env.PLACID_API_KEY;

const PLACID_API = 'https://api.placid.app/api/rest';
const POLL_MAX_ATTEMPTS = 30;
const POLL_INTERVAL_MS = 1000;

async function supaQuery(table, method, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}`);
  return text ? JSON.parse(text) : null;
}

async function loadTemplateMap() {
  // Récupère la map des templates depuis agent_memory.placid_templates
  // Format attendu : { price_card: "tpl_xxx", qualirepar: "tpl_yyy", ... }
  try {
    const rows = await supaQuery('agent_memory', 'GET', null, '?key=eq.placid_templates');
    if (rows && rows[0] && rows[0].value) return rows[0].value;
  } catch (e) {}
  return {};
}

async function placidPost(path, body) {
  const res = await fetch(`${PLACID_API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${PLACID_KEY}`
    },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

async function placidGet(url) {
  const res = await fetch(url, {
    headers: { 'Authorization': `Bearer ${PLACID_KEY}` }
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  if (!PLACID_KEY) {
    return res.status(500).json({ error: 'PLACID_API_KEY manquante. Ajouter dans Vercel ENV.' });
  }
  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'SUPABASE non configuré' });
  }

  const { template, layers, format } = req.body || {};
  if (!template) return res.status(400).json({ error: 'template requis (ex: price_card)' });
  if (!layers || typeof layers !== 'object') {
    return res.status(400).json({ error: 'layers requis (objet { layer_name: { text: "..." } })' });
  }

  try {
    // 1. Charger l'ID du template depuis Supabase
    const map = await loadTemplateMap();
    const templateId = map[template];
    if (!templateId) {
      return res.status(400).json({
        error: `Template "${template}" non configuré. Va dans Config Autopilot et ajoute son ID Placid.`,
        available_templates: Object.keys(map)
      });
    }

    // 2. Créer l'image
    const createBody = { layers };
    if (format) createBody.format = format;  // 'jpg' ou 'png'

    const create = await placidPost(`/templates/${templateId}/image`, createBody);
    if (!create.ok) {
      return res.status(create.status).json({
        error: 'Placid create failed',
        details: create.data
      });
    }

    let imageUrl = create.data.image_url;
    let placidId = create.data.id;
    let pollingUrl = create.data.polling_url || `${PLACID_API}/images/${placidId}`;

    // 3. Polling si nécessaire
    if (create.data.status !== 'finished' && create.data.status !== 'completed') {
      let attempts = 0;
      while (attempts < POLL_MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
        const poll = await placidGet(pollingUrl);
        if (!poll.ok) {
          return res.status(poll.status).json({ error: 'Placid poll failed', details: poll.data });
        }
        if (poll.data.status === 'finished' || poll.data.status === 'completed') {
          imageUrl = poll.data.image_url;
          break;
        }
        if (poll.data.status === 'error' || poll.data.status === 'failed') {
          return res.status(500).json({ error: 'Placid render failed', details: poll.data });
        }
        attempts++;
      }
      if (!imageUrl) {
        return res.status(504).json({ error: 'Placid timeout after ' + POLL_MAX_ATTEMPTS + 's' });
      }
    }

    // 4. Logger
    try {
      await supaQuery('social_logs', 'POST', {
        level: 'auto', source: 'placid',
        message: `Visuel généré · template=${template}`,
        metadata: { template, placid_id: placidId, url: imageUrl }
      });
    } catch(e) {}

    return res.status(200).json({
      success: true,
      url: imageUrl,
      placid_id: placidId,
      template
    });

  } catch (err) {
    console.error('Placid render error:', err);
    return res.status(500).json({ error: err.message });
  }
}
