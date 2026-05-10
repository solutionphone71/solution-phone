// /api/roulette.js — Endpoint serveur pour la roulette cadeaux client
// Solution Phone · Audit sécurité 10/05/2026
//
// Sert toutes les opérations de roulette.html SANS exposer
// les clés Supabase et Brevo au navigateur client.
//
// Actions :
//   GET  /api/roulette?action=config         → renvoie la config (lots, lien Google)
//   GET  /api/roulette?action=check&phone=X  → vérifie si le téléphone a déjà joué
//   POST /api/roulette?action=save           → enregistre une participation (body: {phone, prize})
//   POST /api/roulette?action=email          → envoie les 2 emails Brevo (body: {email, prize, html, phone})

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const SHOP_EMAIL = process.env.SHOP_EMAIL || 'solution.phone71@gmail.com';

const ALLOWED_ORIGINS = [
  'https://solution-phone.fr',
  'https://www.solution-phone.fr',
  'https://solution-phone.vercel.app',
  'http://localhost:3000'
];

function setCors(req, res) {
  const origin = req.headers.origin || '';
  // La roulette est en page publique : on accepte * mais on filtre par action
  // (config / check sont lecture publique ; save / email valident d'autres infos serveur)
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : 'https://solution-phone.fr';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function supaQuery(path, init = {}) {
  const url = `${SUPA_URL}/rest/v1/${path}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
    ...(init.headers || {})
  };
  return fetch(url, { ...init, headers });
}

function isPhoneDigits(s) {
  return typeof s === 'string' && /^[0-9]{10,12}$/.test(s);
}
function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export default async function handler(req, res) {
  setCors(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'Supabase non configuré' });
  }

  const action = req.query.action || '';

  try {
    // ── GET config ─────────────────────────────────────────────
    if (action === 'config' && req.method === 'GET') {
      const r = await supaQuery('roulette_config?id=eq.1');
      const data = await r.json();
      if (Array.isArray(data) && data[0]) {
        return res.status(200).json({
          googleUrl: data[0].google_url || '',
          prizes: data[0].prizes || []
        });
      }
      return res.status(200).json({ googleUrl: '', prizes: [] });
    }

    // ── GET check phone ───────────────────────────────────────
    if (action === 'check' && req.method === 'GET') {
      const phone = (req.query.phone || '').replace(/\D/g, '');
      if (!isPhoneDigits(phone)) {
        return res.status(400).json({ error: 'Téléphone invalide' });
      }
      const r = await supaQuery(`roulette_participations?telephone=eq.${phone}&select=id,lot_gagne`);
      const data = await r.json();
      return res.status(200).json({ alreadyPlayed: Array.isArray(data) && data.length > 0, data: data || [] });
    }

    // ── POST save participation ───────────────────────────────
    if (action === 'save' && req.method === 'POST') {
      const { phone, prize } = req.body || {};
      const cleanPhone = (phone || '').toString().replace(/\D/g, '');
      if (!isPhoneDigits(cleanPhone)) {
        return res.status(400).json({ error: 'Téléphone invalide' });
      }
      if (!prize || typeof prize !== 'string' || prize.length > 200) {
        return res.status(400).json({ error: 'Lot invalide' });
      }
      const r = await supaQuery('roulette_participations', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({
          telephone: cleanPhone,
          lot_gagne: prize,
          date_participation: new Date().toISOString()
        })
      });
      if (!r.ok) {
        const txt = await r.text();
        return res.status(r.status).json({ error: 'Supabase ' + r.status, detail: txt.substring(0, 200) });
      }
      return res.status(200).json({ success: true });
    }

    // ── POST envoi email Brevo ────────────────────────────────
    if (action === 'email' && req.method === 'POST') {
      if (!BREVO_API_KEY) return res.status(500).json({ error: 'BREVO_API_KEY non configurée' });
      const { email, prize, html, phone } = req.body || {};
      if (!isEmail(email)) return res.status(400).json({ error: 'Email invalide' });
      if (!prize || typeof prize !== 'string' || prize.length > 200) {
        return res.status(400).json({ error: 'Lot invalide' });
      }
      if (!html || typeof html !== 'string' || html.length > 50000) {
        return res.status(400).json({ error: 'Contenu email invalide' });
      }

      // 1) Email au client
      const r1 = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:  { name: 'Solution Phone Roue', email: SHOP_EMAIL },
          to:      [{ email }],
          subject: '🎡 Votre cadeau Solution Phone — ' + prize,
          htmlContent: html
        })
      });

      // 2) Notification interne boutique
      const cleanPhone = (phone || '').toString().replace(/\D/g, '').substring(0, 12);
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:  { name: 'Roue Cadeaux', email: SHOP_EMAIL },
          to:      [{ email: SHOP_EMAIL, name: 'Solution Phone' }],
          subject: '🎁 Nouveau gain roue — ' + prize,
          htmlContent: `<p>Nouveau gagnant à la roue !</p>
            <p><strong>Lot :</strong> ${prize.replace(/</g,'&lt;')}</p>
            <p><strong>Email client :</strong> ${email.replace(/</g,'&lt;')}</p>
            <p><strong>Téléphone :</strong> ${cleanPhone || 'non renseigné'}</p>
            <p><strong>Date :</strong> ${new Date().toLocaleString('fr-FR')}</p>`
        })
      });

      return res.status(200).json({ success: r1.ok });
    }

    return res.status(400).json({ error: 'Action inconnue. Utilise ?action=config|check|save|email' });
  } catch (err) {
    console.error('[/api/roulette]', err);
    return res.status(500).json({ error: err.message || 'Erreur serveur' });
  }
}
