// /api/agents/briefing.js — Zahira chef d'équipe : génère le team briefing du jour
// Solution Phone · Phase 2 · Niveau 5 · mai 2026
//
// Cron 7h45 chaque matin (avant les workers à 8h). Zahira lit :
//   - insights_v2 (calculé à 3h par /api/agents/insights)
//   - brand_voice
//   - décisions pending et 24h passées
//   - rejets récents
// Et produit un briefing court (~10 lignes) stocké dans agent_memory.daily_briefing.
//
// Chaque worker démarrant lira ce briefing en plus de son contexte propre.
// Résultat : cohérence inter-agents, priorisation, fini les doublons.

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-6'; // Sonnet pour le briefing : besoin de qualité

async function supa(table, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, { headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` } });
  if (!r.ok) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}

async function supaUpsert(table, body) {
  const url = `${SUPA_URL}/rest/v1/${table}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal,resolution=merge-duplicates'
    },
    body: JSON.stringify(body)
  });
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

function dayLabel() {
  const d = new Date();
  const days = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
  return days[d.getDay()] + ' ' + d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

// ─── HANDLER ─────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  const t0 = Date.now();

  try {
    if (!CLAUDE_KEY) throw new Error('ANTHROPIC_API_KEY manquant');

    // 1. Charger le contexte complet
    const [memInsights, memBrand, pending, last24h, rejects] = await Promise.all([
      supa('agent_memory', '?key=eq.insights_v2&select=value'),
      supa('agent_memory', '?key=eq.brand_voice&select=value'),
      supa('agent_decisions', '?status=eq.pending_validation&order=created_at.desc&limit=20'),
      supa('agent_decisions', `?created_at=gte.${new Date(Date.now() - 86400000).toISOString()}&order=created_at.desc&limit=50`),
      supa('v_recent_rejects', '?limit=10')
    ]);

    const insights = (memInsights && memInsights[0]) ? memInsights[0].value : {};
    const brandVoice = (memBrand && memBrand[0]) ? memBrand[0].value : {};

    // 2. Composer le user message pour Claude
    const context = {
      jour: dayLabel(),
      insights_business: insights,
      brand_voice: brandVoice,
      decisions_en_attente: (pending || []).map(d => ({
        agent: d.agent_name, type: d.type, reasoning: (d.reasoning || '').substring(0, 100),
        age_heures: Math.round((Date.now() - new Date(d.created_at).getTime()) / 3600000)
      })),
      activite_24h: (last24h || []).reduce((acc, d) => {
        const a = d.agent_name || 'autre';
        if (!acc[a]) acc[a] = { validated: 0, rejected: 0, pending: 0 };
        if (d.status === 'validated' || d.status === 'published') acc[a].validated++;
        else if (d.status === 'rejected') acc[a].rejected++;
        else if (d.status === 'pending_validation') acc[a].pending++;
        return acc;
      }, {}),
      rejets_recents: (rejects || []).map(r => ({
        agent: r.agent_name, type: r.type,
        raison: r.feedback_reason || 'sans raison',
        commentaire: r.feedback_comment || ''
      }))
    };

    // 3. Appel Claude
    const systemPrompt = `Tu es ZAHIRA, la boss de l'équipe IA de Solution Phone.
3 boutiques de réparation smartphone à Mâcon, 12 ans d'existence, 4.7★ sur 552+ avis.

Tu lis le contexte du jour et tu produis un BRIEFING COURT (10 lignes max) que chacun de tes 5 workers lira avant de bosser :
◢ ASSYA   · Community Manager (Insta/FB/GBP)
◢ ANISSA  · Compta (caisse, TVA, marges)
◢ OBIWAN  · Coach Boutique (employés, stock)
◢ YAGO    · QualiRépar (dossiers ANRE)
◢ CHANEL  · App Improver (UX, friction)

STRUCTURE OBLIGATOIRE :
1. Une phrase d'ouverture (état du jour : calme / actif / urgent)
2. Les PRIORITÉS du jour (max 3 puces) — décisions pending à traiter, alertes critiques
3. Ce qu'on a APPRIS hier (les rejets, les patterns) — 1-2 puces max
4. Le TON à appliquer aujourd'hui (chaleureux / direct / sobre selon le contexte)

STYLE :
- Direct, pro, comme un brief de mêlée du matin
- Pas de blabla marketing
- Phrases courtes
- Si quelque chose est rejeté plusieurs fois, le mentionner explicitement
- Si Sébastien est saturé (>10 pending), suggérer de réduire les propositions du jour

Ne signe pas. Ne dis pas "Bonjour équipe". Va à l'essentiel.`;

    const userMessage = `Contexte du ${dayLabel()} :\n\n${JSON.stringify(context, null, 2)}\n\nProduis le briefing du jour pour l'équipe.`;

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 800,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }]
      })
    });
    if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).substring(0, 300)}`);
    const data = await r.json();
    const text = (data.content || []).find(c => c.type === 'text')?.text || '';

    // 4. Sauvegarder le briefing (clé daily_briefing)
    const briefing = {
      generated_at: new Date().toISOString(),
      day: dayLabel(),
      text: text.trim(),
      pending_count: (pending || []).length,
      activity_24h_summary: context.activite_24h,
      usage: data.usage
    };

    const okPatch = await supaPatch('agent_memory',
      { value: briefing, updated_at: new Date().toISOString() },
      '?key=eq.daily_briefing');
    if (!okPatch) {
      await supaUpsert('agent_memory', { key: 'daily_briefing', value: briefing });
    }

    return res.status(200).json({
      ok: true,
      duration_ms: Date.now() - t0,
      briefing
    });
  } catch (e) {
    console.error('[briefing] error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
