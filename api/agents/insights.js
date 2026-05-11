// /api/agents/insights.js — Calcul des insights business (Phase 2 · Niveau 4)
// Solution Phone · mai 2026
//
// Cron nocturne (3h du matin, après backup) qui calcule des stats utiles
// pour les agents IA, stockées dans agent_memory.insights_v2.
//
// Insights calculés (sur 30 jours sauf indication) :
//   - phones_top_vendus           : 5 modèles les plus vendus
//   - phones_marge_moyenne        : marge moyenne € par modèle (top 10)
//   - phones_delai_vente_jours    : délai moyen de vente par modèle
//   - phones_stock_alerte         : modèles bientôt en rupture (stock < 2)
//   - agents_acceptance_rate     : % de décisions validées par agent (sur 30j)
//   - agents_pending_count       : nb de décisions en attente par agent
//   - avis_volume_30j            : nb d'avis Google reçus
//   - avis_5_etoiles_30j         : nb d'avis 5★ reçus
//   - qualirepar_eligibles_non_envoyes : nb de dossiers cloturés éligibles QR mais non envoyés
//   - repartition_paiement_30j   : % CB/Espèces/Chèque/Virement
//   - panier_moyen_30j           : panier moyen TTC
//   - seb_validation_hours       : créneaux préférés de validation du patron

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

async function supa(table, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function supaUpsert(table, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
  return r.ok;
}

async function supaPatch(table, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(body)
  });
  return r.ok;
}

function daysAgoIso(days) {
  return new Date(Date.now() - days * 86400000).toISOString();
}

function avg(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ─── INSIGHTS COMPUTERS ─────────────────────────────────────────

async function insightsPhones() {
  const phones = await supa('phones', '?select=modele,achat,vente,date_achat,date_vente,etat&limit=5000');
  if (!Array.isArray(phones)) return {};
  const since30 = daysAgoIso(30);

  // Phones vendus dans les 30 derniers jours
  const vendus = phones.filter(p => p.etat === 'VENDU' && p.date_vente && p.date_vente >= since30);

  // Top 5 modèles vendus
  const countByModel = {};
  vendus.forEach(p => {
    const m = (p.modele || 'autre').trim();
    countByModel[m] = (countByModel[m] || 0) + 1;
  });
  const top = Object.entries(countByModel)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([modele, qty]) => ({ modele, qty }));

  // Marge moyenne par modèle (top 10)
  const margeByModel = {};
  vendus.forEach(p => {
    const m = (p.modele || 'autre').trim();
    const marge = (Number(p.vente) || 0) - (Number(p.achat) || 0);
    if (!margeByModel[m]) margeByModel[m] = [];
    margeByModel[m].push(marge);
  });
  const margeMoyenne = Object.entries(margeByModel)
    .map(([modele, marges]) => ({ modele, marge_moyenne: Math.round(avg(marges)), n: marges.length }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  // Délai moyen de vente par modèle (jours entre achat et vente)
  const delaisByModel = {};
  vendus.forEach(p => {
    if (!p.date_achat || !p.date_vente) return;
    const days = (new Date(p.date_vente) - new Date(p.date_achat)) / 86400000;
    if (days < 0 || days > 365) return;
    const m = (p.modele || 'autre').trim();
    if (!delaisByModel[m]) delaisByModel[m] = [];
    delaisByModel[m].push(days);
  });
  const delaiVente = Object.entries(delaisByModel)
    .map(([modele, ds]) => ({ modele, delai_jours: Math.round(avg(ds) * 10) / 10, n: ds.length }))
    .filter(x => x.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, 10);

  // Stock alerte (modèles avec < 2 en stock disponible)
  const stockByModel = {};
  phones.filter(p => p.etat === 'DISPONIBLE').forEach(p => {
    const m = (p.modele || 'autre').trim();
    stockByModel[m] = (stockByModel[m] || 0) + 1;
  });
  // Modèles avec ventes récentes mais stock faible
  const stockAlerte = Object.entries(countByModel)
    .filter(([m, qty]) => qty >= 2 && (stockByModel[m] || 0) < 2)
    .map(([modele]) => ({ modele, stock: stockByModel[modele] || 0 }));

  return {
    phones_top_vendus_30j: top,
    phones_marge_moyenne: margeMoyenne,
    phones_delai_vente_jours: delaiVente,
    phones_stock_alerte: stockAlerte
  };
}

async function insightsAgents() {
  const since30 = daysAgoIso(30);
  const decisions = await supa('agent_decisions',
    `?select=agent_name,status,created_at,validated_at&created_at=gte.${since30}&limit=2000`);
  if (!Array.isArray(decisions)) return {};

  const byAgent = {};
  decisions.forEach(d => {
    const a = d.agent_name || 'autre';
    if (!byAgent[a]) byAgent[a] = { total: 0, validated: 0, rejected: 0, pending: 0, expired: 0 };
    byAgent[a].total++;
    if (d.status === 'validated' || d.status === 'published') byAgent[a].validated++;
    else if (d.status === 'rejected') byAgent[a].rejected++;
    else if (d.status === 'pending_validation') byAgent[a].pending++;
    else if (d.status === 'expired') byAgent[a].expired++;
  });

  const acceptanceRate = Object.entries(byAgent).map(([agent, stats]) => {
    const decided = stats.validated + stats.rejected;
    return {
      agent,
      acceptance_rate: decided > 0 ? Math.round((stats.validated / decided) * 100) / 100 : null,
      total_30j: stats.total,
      validated: stats.validated,
      rejected: stats.rejected,
      pending: stats.pending
    };
  });

  const pendingCount = Object.entries(byAgent)
    .map(([agent, stats]) => ({ agent, pending: stats.pending }))
    .filter(x => x.pending > 0);

  // Heures de validation préférées (où Sébastien valide le plus)
  const valHours = {};
  decisions.filter(d => d.validated_at).forEach(d => {
    const h = new Date(d.validated_at).getHours();
    valHours[h] = (valHours[h] || 0) + 1;
  });
  const validationHours = Object.entries(valHours)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([h, n]) => ({ heure: parseInt(h, 10), nb_validations: n }));

  return {
    agents_acceptance_rate: acceptanceRate,
    agents_pending_count: pendingCount,
    seb_validation_hours: validationHours
  };
}

async function insightsAvis() {
  const since30 = daysAgoIso(30);
  const avis = await supa('google_reviews',
    `?select=star_rating,create_time&create_time=gte.${since30}&limit=500`);
  if (!Array.isArray(avis)) return {};
  return {
    avis_volume_30j: avis.length,
    avis_5_etoiles_30j: avis.filter(a => a.star_rating === 5).length,
    avis_3_ou_moins_30j: avis.filter(a => a.star_rating <= 3).length
  };
}

async function insightsQualirepar() {
  const since30 = daysAgoIso(30);
  // Récupère bons_depot cloturés sans qr_envoi sur 30j
  const bons = await supa('bons_depot',
    `?select=id,statut,bonus_qr,qr_envoi,date_cloture&statut=eq.cloture&date_cloture=gte.${since30}&limit=500`);
  if (!Array.isArray(bons)) return {};
  const eligibles_non_envoyes = bons.filter(b => b.bonus_qr && !b.qr_envoi).length;
  return {
    qualirepar_eligibles_non_envoyes: eligibles_non_envoyes,
    qualirepar_dossiers_cloturer_30j: bons.length
  };
}

async function insightsCaisse() {
  const since30 = daysAgoIso(30).slice(0, 10);
  const caisse = await supa('caisse', `?select=date,ttc,cb,especes,cheque,virement&date=gte.${since30}&limit=60`);
  if (!Array.isArray(caisse) || !caisse.length) return {};
  const tot = caisse.reduce((s, c) => ({
    ttc: s.ttc + (Number(c.ttc) || 0),
    cb: s.cb + (Number(c.cb) || 0),
    especes: s.especes + (Number(c.especes) || 0),
    cheque: s.cheque + (Number(c.cheque) || 0),
    virement: s.virement + (Number(c.virement) || 0),
    n: s.n + 1
  }), { ttc: 0, cb: 0, especes: 0, cheque: 0, virement: 0, n: 0 });

  const total = tot.cb + tot.especes + tot.cheque + tot.virement;
  const pct = (v) => total > 0 ? Math.round((v / total) * 100) : 0;

  return {
    repartition_paiement_30j: {
      cb_pct: pct(tot.cb),
      especes_pct: pct(tot.especes),
      cheque_pct: pct(tot.cheque),
      virement_pct: pct(tot.virement)
    },
    ca_30j: Math.round(tot.ttc),
    ca_moyen_jour: tot.n > 0 ? Math.round(tot.ttc / tot.n) : 0,
    jours_actifs_30j: tot.n
  };
}

// ─── HANDLER ─────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;

  const t0 = Date.now();
  try {
    const [phones, agents, avis, qr, caisse] = await Promise.all([
      insightsPhones(),
      insightsAgents(),
      insightsAvis(),
      insightsQualirepar(),
      insightsCaisse()
    ]);

    const insights = {
      generated_at: new Date().toISOString(),
      window: '30 days',
      ...phones,
      ...agents,
      ...avis,
      ...qr,
      ...caisse
    };

    // Upsert dans agent_memory (clé = insights_v2)
    // On utilise PATCH puis POST en fallback (idiom upsert)
    const okPatch = await supaPatch('agent_memory',
      { value: insights, updated_at: new Date().toISOString() },
      '?key=eq.insights_v2');
    if (!okPatch) {
      await supaUpsert('agent_memory', { key: 'insights_v2', value: insights });
    }

    return res.status(200).json({
      ok: true,
      duration_ms: Date.now() - t0,
      insights
    });
  } catch (e) {
    console.error('[insights] error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
