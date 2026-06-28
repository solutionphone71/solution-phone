// api/fiscal.js — Endpoint serveur ISOLÉ de la Caisse Sécurisée (Lot 2).
// Appelle UNIQUEMENT les fonctions SECURITY DEFINER du ledger fiscal via la
// clé secrète dédiée (SUPABASE_FISCAL_KEY) — jamais exposée au navigateur.
// Le proxy /api/supabase (clé publishable) n'a et n'aura JAMAIS accès au ledger.

const SUPABASE_URL = process.env.SUPABASE_URL;
const FISCAL_KEY   = process.env.SUPABASE_FISCAL_KEY;

const ALLOWED_ORIGINS = [
  'https://app.solution-phone.fr',
  'https://solution-phone.fr',
  'https://www.solution-phone.fr',
];

// Actions autorisées → fonction PostgreSQL (schéma public, exposée à service_role).
const FUNCS = {
  record_sale:    'fiscal_record_sale',
  record_payment: 'fiscal_record_payment',
  verify_chain:   'fiscal_verify_chain',
};

function applyCors(req, res) {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin',
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req, res) {
  applyCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')    return res.status(405).json({ ok:false, error:'method_not_allowed' });
  if (!SUPABASE_URL || !FISCAL_KEY) {
    return res.status(500).json({ ok:false, error:'config', message:'SUPABASE_URL ou SUPABASE_FISCAL_KEY manquant' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const fn = FUNCS[body.action];
    if (!fn) return res.status(400).json({ ok:false, error:'action_inconnue' });

    const payload = body.payload || {};

    // Rôle : 2 codes (patron / equipe). La fonction SQL revérifie de toute façon.
    if (body.action !== 'verify_chain') {
      if (!['patron','equipe'].includes(payload.actor_role)) {
        return res.status(403).json({ ok:false, error:'role_invalide' });
      }
    }

    const args = body.action === 'verify_chain'
      ? { p_store: payload.store_id || 'SP-MACON-01' }
      : { p: payload };

    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': FISCAL_KEY,
        'Authorization': 'Bearer ' + FISCAL_KEY,
      },
      body: JSON.stringify(args),
    });
    const txt = await r.text();
    res.setHeader('Content-Type', 'application/json');
    return res.status(r.status).send(txt);

  } catch (e) {
    console.error('[api/fiscal] error', e.message);
    return res.status(500).json({ ok:false, error:'fiscal_proxy_error', message:e.message });
  }
}
