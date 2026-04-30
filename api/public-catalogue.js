// api/public-catalogue.js
// Endpoint public read-only qui expose le catalogue de prix Solution Phone
// Consommé par : Claude Design (web capture), n8n, widgets externes, etc.
// Ne jamais exposer de données sensibles ici — seulement marque/modèle/prix publics

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY
);

const BONUS_QUALIREPAR = 25;

// Types de réparation éligibles au bonus QualiRépar (programme État)
const ELIGIBLE_TYPES = ['ecran', 'écran', 'batterie', 'connecteur', 'caméra', 'camera', 'haut-parleur', 'micro'];

function isEligible(typeReparation) {
  if (!typeReparation) return false;
  const normalized = String(typeReparation).toLowerCase();
  return ELIGIBLE_TYPES.some(t => normalized.includes(t));
}

function computeNetPrice(prixPublic, eligible) {
  const prix = Number(prixPublic) || 0;
  if (eligible && prix > BONUS_QUALIREPAR) {
    return prix - BONUS_QUALIREPAR;
  }
  return prix;
}

export default async function handler(req, res) {
  // ============ CORS ============
  // Ouvert car endpoint public read-only avec données non sensibles
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // ============ FETCH SUPABASE ============
    // Les deux tables utilisées par l'ERP Solution Phone
    const [iphoneRes, androidRes] = await Promise.all([
      supabase.from('ecransPrix').select('*'),
      supabase.from('prix_reparation_android').select('*'),
    ]);

    if (iphoneRes.error) throw new Error(`ecransPrix: ${iphoneRes.error.message}`);
    if (androidRes.error) throw new Error(`prix_reparation_android: ${androidRes.error.message}`);

    // ============ NORMALISATION ============
    // ⚠️ À AJUSTER selon le schéma exact de tes tables Supabase.
    // Les noms de colonnes ci-dessous sont des hypothèses. Adapte aux vrais.
    const catalogue = [];

    // --- iPhone (table ecransPrix) ---
    // Hypothèse : colonnes { modele, prix_ecran, prix_batterie, prix_connecteur, prix_camera }
    for (const row of iphoneRes.data || []) {
      const modele = row.modele || row.iphone || row.nom || 'iPhone';

      if (row.prix_ecran) {
        catalogue.push({
          marque: 'Apple',
          modele,
          type_reparation: 'Écran',
          categorie: 'Écran',
          prix_public: Number(row.prix_ecran),
          eligible_qualirepar: true,
          prix_net_client: computeNetPrice(row.prix_ecran, true),
        });
      }
      if (row.prix_batterie) {
        catalogue.push({
          marque: 'Apple',
          modele,
          type_reparation: 'Batterie',
          categorie: 'Batterie',
          prix_public: Number(row.prix_batterie),
          eligible_qualirepar: true,
          prix_net_client: computeNetPrice(row.prix_batterie, true),
        });
      }
      if (row.prix_connecteur) {
        catalogue.push({
          marque: 'Apple',
          modele,
          type_reparation: 'Connecteur de charge',
          categorie: 'Connecteur',
          prix_public: Number(row.prix_connecteur),
          eligible_qualirepar: true,
          prix_net_client: computeNetPrice(row.prix_connecteur, true),
        });
      }
      if (row.prix_camera) {
        catalogue.push({
          marque: 'Apple',
          modele,
          type_reparation: 'Caméra arrière',
          categorie: 'Caméra',
          prix_public: Number(row.prix_camera),
          eligible_qualirepar: true,
          prix_net_client: computeNetPrice(row.prix_camera, true),
        });
      }
      if (row.prix_vitre_arriere) {
        catalogue.push({
          marque: 'Apple',
          modele,
          type_reparation: 'Vitre arrière',
          categorie: 'Cosmétique',
          prix_public: Number(row.prix_vitre_arriere),
          eligible_qualirepar: false,
          prix_net_client: Number(row.prix_vitre_arriere),
        });
      }
    }

    // --- Android (table prix_reparation_android) ---
    // Hypothèse : colonnes { marque, modele, type_reparation, prix }
    for (const row of androidRes.data || []) {
      const type = row.type_reparation || row.type;
      const eligible = isEligible(type);
      const prix = Number(row.prix) || 0;

      catalogue.push({
        marque: row.marque || 'Android',
        modele: row.modele || row.nom,
        type_reparation: type,
        categorie: row.categorie || type,
        prix_public: prix,
        eligible_qualirepar: eligible,
        prix_net_client: computeNetPrice(prix, eligible),
      });
    }

    // ============ FILTRE OPTIONNEL ============
    let filtered = catalogue;
    const { brand, type } = req.query;
    if (brand) {
      filtered = filtered.filter(
        item => item.marque.toLowerCase() === String(brand).toLowerCase()
      );
    }
    if (type) {
      filtered = filtered.filter(
        item => String(item.categorie).toLowerCase().includes(String(type).toLowerCase())
      );
    }

    // ============ CACHE ============
    // 10 min de cache CDN, 20 min de stale-while-revalidate
    // → les prix ne changent pas toutes les minutes, pas besoin de hammer Supabase
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

    // ============ FORMAT DE SORTIE ============
    if (req.query.format === 'html') {
      // Version lisible humain pour Claude Design via web capture
      return res.status(200).send(renderHTML(filtered));
    }

    // Version JSON par défaut
    return res.status(200).json({
      meta: {
        source: 'Solution Phone ERP · Supabase',
        shop: {
          name: 'Solution Phone',
          address: '21 Rue Gambetta, 71000 Mâcon',
          phone: '03 85 33 06 89',
          whatsapp: '07 83 92 18 84',
          website: 'https://solution-phone.fr',
        },
        qualirepar: {
          certified: true,
          bonus_amount: BONUS_QUALIREPAR,
          currency: 'EUR',
          eligible_types: ELIGIBLE_TYPES,
        },
        generated_at: new Date().toISOString(),
        total_items: filtered.length,
      },
      items: filtered,
    });
  } catch (error) {
    console.error('[public-catalogue] error:', error);
    return res.status(500).json({
      error: 'Unable to fetch catalogue',
      message: error.message,
    });
  }
}

// ============ RENDU HTML POUR WEB CAPTURE ============
function renderHTML(items) {
  const rows = items
    .map(
      i => `<tr>
    <td>${escapeHtml(i.marque)}</td>
    <td>${escapeHtml(i.modele)}</td>
    <td>${escapeHtml(i.type_reparation)}</td>
    <td>${i.prix_public} €</td>
    <td>${i.eligible_qualirepar ? 'OUI' : 'NON'}</td>
    <td><strong>${i.prix_net_client} €</strong></td>
  </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Solution Phone — Catalogue tarifs</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; padding: 2rem; max-width: 1000px; margin: auto; color: #111; }
  h1 { margin-bottom: 0.25rem; }
  .sub { color: #666; margin-bottom: 2rem; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #111; color: #fff; padding: 0.75rem; text-align: left; font-size: 0.85rem; }
  td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #eee; font-size: 0.9rem; }
  tr:hover { background: #fafafa; }
  strong { color: #e8001c; }
</style>
</head>
<body>
<h1>Solution Phone · Catalogue tarifs</h1>
<p class="sub">21 Rue Gambetta, Mâcon · Source unique de vérité · Bonus QualiRépar −25€ déduit automatiquement</p>
<table>
<thead><tr>
  <th>Marque</th><th>Modèle</th><th>Réparation</th><th>Prix public</th><th>Éligible</th><th>Prix client</th>
</tr></thead>
<tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
