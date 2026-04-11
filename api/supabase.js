// /api/supabase.js — Proxy Supabase pour Solution Phone
// Protege la cle Supabase cote serveur (Vercel Serverless Function)

const SUPA_URL = process.env.SUPABASE_URL;    // ex: https://kdvxcnjfrmvlnrymfyug.supabase.co
const SUPA_KEY = process.env.SUPABASE_KEY;    // votre cle anon/service

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Prefer');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extraire table et query depuis l'URL: /api/supabase?table=phones&query=?select=*
  const { table, query } = req.query;
  if (!table) return res.status(400).json({ error: 'Parametre "table" requis' });

  // Tables autorisees (securite: empecher l'acces a des tables sensibles)
  const ALLOWED_TABLES = [
    'phones', 'clients', 'clients_en_attente', 'factures', 'caisse', 'depenses',
    'reports_mois', 'ecrans_prix', 'batteries_prix', 'prix_reparation_android',
    'settings', 'commandes', 'devis', 'reparations', 'neufs_accessoires',
    'salaries', 'phonilab_import', 'police',
    'bons_depot', 'bons_commande', 'historique_reparations', 'ventes_neufs_access',
    'calendrier_editorial', 'roulette_config'
  ];
  if (!ALLOWED_TABLES.includes(table)) {
    return res.status(403).json({ error: 'Table non autorisee: ' + table });
  }

  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const method = req.method;

  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };

  // Transmettre le header Prefer (pour POST return=representation)
  if (req.headers['prefer']) {
    headers['Prefer'] = req.headers['prefer'];
  }

  try {
    const fetchOpts = { method, headers };
    var sentBody = null;
    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      sentBody = JSON.stringify(req.body);
      fetchOpts.body = sentBody;
    }

    const response = await fetch(url, fetchOpts);
    const text = await response.text();

    // Si erreur Supabase, ajouter le debug body dans la reponse
    if (!response.ok) {
      console.error('Supabase error:', response.status, text, 'Body sent:', sentBody);
      return res.status(response.status).json({
        supaError: text,
        debugBodySent: sentBody,
        debugUrl: url,
        debugMethod: method
      });
    }

    // Transmettre le status code Supabase
    res.status(response.status);

    // Transmettre les headers utiles
    const ct = response.headers.get('content-type');
    if (ct) res.setHeader('Content-Type', ct);
    const cr = response.headers.get('content-range');
    if (cr) res.setHeader('Content-Range', cr);

    return res.send(text);
  } catch (e) {
    console.error('Proxy Supabase error:', e);
    return res.status(500).json({ error: 'Erreur proxy Supabase', detail: e.message });
  }
}
