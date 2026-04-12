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
    'salaries', 'phonilab_import', 'police', 'phones_neufs',
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
    if (method !== 'GET' && method !== 'HEAD' && req.body) {
      fetchOpts.body = JSON.stringify(req.body);
    }

    let response = await fetch(url, fetchOpts);
    let text = await response.text();

    // Auto-fix PGRST204 : colonne inconnue → retirer et reessayer
    if (!response.ok && method === 'POST' && text.includes('PGRST204')) {
      try {
        const err = JSON.parse(text);
        const match = err.message && err.message.match(/the '(\w+)' column/);
        if (match && req.body) {
          const badCol = match[1];
          const cleaned = { ...req.body };
          delete cleaned[badCol];
          console.log('PGRST204: retrait colonne "' + badCol + '", retry POST');
          const retryOpts = { method, headers, body: JSON.stringify(cleaned) };
          // Boucle pour retirer plusieurs colonnes si necessaire (max 10)
          let retryResp = await fetch(url, retryOpts);
          let retryText = await retryResp.text();
          let attempts = 0;
          while (!retryResp.ok && retryText.includes('PGRST204') && attempts < 10) {
            const err2 = JSON.parse(retryText);
            const match2 = err2.message && err2.message.match(/the '(\w+)' column/);
            if (!match2) break;
            delete cleaned[match2[1]];
            console.log('PGRST204: retrait colonne "' + match2[1] + '", retry POST');
            retryResp = await fetch(url, { method, headers, body: JSON.stringify(cleaned) });
            retryText = await retryResp.text();
            attempts++;
          }
          response = retryResp;
          text = retryText;
        }
      } catch(retryErr) {
        console.error('Auto-fix PGRST204 failed:', retryErr);
      }
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
