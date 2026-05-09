// /api/brain/morning-run.js — Briefing matinal Solution Phone Brain
// Cron Vercel : 0 8 * * * (chaque matin à 8h)
//
// Workflow :
//   1. Collecte gros contexte business (caisses, KPIs, avis, posts perf, météo)
//   2. Appelle Claude Sonnet pour composer un briefing markdown
//   3. Stocke dans brain_briefings
//   4. Envoie email via Resend (si configuré)
//   5. Optionnel : push iPhone (à venir)
//   6. Lance aussi un run agent (autopilot/run) pour les décisions du jour

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
const RESEND_KEY = process.env.RESEND_API_KEY;
const NOTIF_EMAIL = process.env.NOTIF_EMAIL || 'sebastien.cannard@gmail.com';

const CLAUDE_MODEL = 'claude-sonnet-4-6';

async function supaQuery(table, method, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}`);
  return text ? JSON.parse(text) : null;
}

async function collectBriefingContext() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24*3600*1000);
  const weekAgo = new Date(today.getTime() - 7*24*3600*1000);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const todayStr = today.toISOString().split('T')[0];

  const ctx = { today: today.toISOString() };

  // Mémoire agent
  try {
    const memRows = await supaQuery('agent_memory', 'GET', null, '');
    ctx.memory = {};
    (memRows||[]).forEach(m => { ctx.memory[m.key] = m.value; });
  } catch (e) { ctx.memory = {}; }

  // Caisses HIER
  try {
    ctx.caisses_yesterday = await supaQuery('caisse', 'GET', null,
      `?created_at=gte.${yesterday.toISOString()}&created_at=lt.${today.toISOString()}&order=created_at.desc&limit=30`);
  } catch (e) { ctx.caisses_yesterday = []; }

  // Caisses MOIS EN COURS
  try {
    ctx.caisses_month = await supaQuery('caisse', 'GET', null,
      `?created_at=gte.${monthStart.toISOString()}&select=id,created_at,libelle,prix&order=created_at.desc&limit=200`);
  } catch (e) { ctx.caisses_month = []; }

  // Posts publiés 7j
  try {
    ctx.posts_7d = await supaQuery('social_posts', 'GET', null,
      `?status=eq.published&published_at=gte.${weekAgo.toISOString()}&order=published_at.desc&limit=15`);
  } catch (e) { ctx.posts_7d = []; }

  // Décisions en attente
  try {
    ctx.pending_decisions = await supaQuery('agent_decisions', 'GET', null,
      '?status=eq.pending_validation&order=created_at.desc&limit=10');
  } catch (e) { ctx.pending_decisions = []; }

  // Stock phones
  try {
    ctx.stock_count = await supaQuery('phones', 'GET', null,
      '?select=id,modele,prix&order=created_at.desc&limit=30');
  } catch (e) { ctx.stock_count = []; }

  // Calendrier 30 jours à venir
  try {
    const in30 = new Date(today.getTime() + 30*24*3600*1000).toISOString().split('T')[0];
    ctx.upcoming_planning = await supaQuery('calendrier_editorial', 'GET', null,
      `?date=gte.${todayStr}&date=lte.${in30}&order=date.asc&limit=15`);
  } catch (e) { ctx.upcoming_planning = []; }

  // Pennylane sync (si dispo)
  try {
    ctx.pennylane = await supaQuery('pennylane_sync', 'GET', null,
      '?order=fetched_at.desc&limit=5');
  } catch (e) { ctx.pennylane = []; }

  // Snapshot KPIs (J-1 et J-7)
  try {
    ctx.kpi_yesterday = await supaQuery('brain_kpi_snapshots', 'GET', null,
      `?date_snap=eq.${yesterdayStr}`);
  } catch (e) { ctx.kpi_yesterday = []; }

  // Météo Mâcon (cache)
  ctx.meteo = (ctx.memory && ctx.memory.last_meteo) || {};

  // Date / contexte
  ctx.today_fr = new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(today);
  ctx.yesterday_fr = new Intl.DateTimeFormat('fr-FR',{weekday:'long',day:'numeric',month:'long'}).format(yesterday);

  return ctx;
}

function buildBriefingSystemPrompt(memory) {
  const brand = memory.brand_voice || {};
  return `Tu es l'assistant business de Sébastien Cannard, gérant de Solution Phone (Mâcon).
Tu rédiges chaque matin son briefing exécutif en français.

VOIX
Direct, encourageant, comme un coach business qui connaît bien la boîte.
Pas de jargon. Pas de blabla. Concret, chiffré quand possible.
${brand.tone || ''}

FORMAT DU BRIEFING (markdown strict)
# ◢ SOLUTION PHONE · BRIEFING DU [date]

Salut Sébastien.

## HIER · [date]
- Bullets : CA, nombre de répas/ventes, faits marquants
- Sois précis avec les chiffres réels du contexte

## CE QUI A BIEN MARCHÉ
- 1-3 bullets : wins concrets observés

## CE QUI PEUT PROGRESSER
1. Action concrète #1 + suggestion
2. Action concrète #2 + suggestion (max 3)

## COMPTA
- État trésorerie / marges / échéances si data dispo
- Si Pennylane vide : "Sync Pennylane à activer pour analyses détaillées"

## TON AGENDA AUJOURD'HUI
- N décisions à valider dans Autopilot
- Posts en queue / actions en attente

---
☕ Bonne journée.

INSTRUCTIONS
- Max 600 mots
- Utilise les chiffres EXACTS du contexte fourni
- Si données manquantes, dis-le honnêtement (pas inventer)
- Pas de superlatifs creux ("incroyable", "fantastique")
- Encourageant mais sans condescendance`;
}

function buildBriefingUserMessage(ctx) {
  const totalCaYesterday = (ctx.caisses_yesterday||[]).reduce((s,c)=>s+(parseFloat(c.prix||c.total||0)||0),0);
  const totalCaMonth = (ctx.caisses_month||[]).reduce((s,c)=>s+(parseFloat(c.prix||c.total||0)||0),0);

  return `CONTEXTE — ${ctx.today_fr}

═══ HIER (${ctx.yesterday_fr}) ═══
Caisses clôturées : ${(ctx.caisses_yesterday||[]).length}
CA estimé : ${totalCaYesterday.toFixed(2)} €
Détail :
${JSON.stringify((ctx.caisses_yesterday||[]).slice(0,8), null, 2)}

═══ MOIS EN COURS ═══
Caisses : ${(ctx.caisses_month||[]).length}
CA estimé : ${totalCaMonth.toFixed(2)} €

═══ STOCK ═══
${(ctx.stock_count||[]).length} smartphones en stock

═══ POSTS RÉCENTS (7j) ═══
${(ctx.posts_7d||[]).length} publié(s)

═══ EN QUEUE ═══
${(ctx.pending_decisions||[]).length} décisions à valider dans Autopilot

═══ PLANNING 30J ═══
${(ctx.upcoming_planning||[]).length} contenus planifiés

═══ COMPTA (Pennylane) ═══
${(ctx.pennylane||[]).length} sync disponible(s)

INSTRUCTION
Rédige le briefing matinal au format markdown demandé. Sois concis, concret, encourageant.`;
}

async function callClaude(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CLAUDE_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }]
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Claude ${res.status}: ${JSON.stringify(data).substring(0,200)}`);
  return {
    text: (data.content && data.content[0] && data.content[0].text) || '',
    usage: data.usage || {}
  };
}

function calcCost(usage) {
  const input = (usage.input_tokens||0)/1e6;
  const output = (usage.output_tokens||0)/1e6;
  return Number(((input * 3.0 + output * 15.0) * 0.93).toFixed(4));
}

function mdToHtml(md) {
  let html = md
    .replace(/^# (.+)$/gm, '<h1 style="font-family:Georgia,serif;font-size:24px;color:#0a0a14;margin:0 0 16px;">$1</h1>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:13px;letter-spacing:0.1em;color:#475569;text-transform:uppercase;margin:20px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#FF0033;">$1</strong>')
    .replace(/^- (.+)$/gm, '<li style="margin-bottom:6px;">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="padding-left:20px;margin:8px 0;">$&</ul>')
    .replace(/^---$/gm, '<hr style="border:0;border-top:1px solid #e2e8f0;margin:24px 0;">')
    .replace(/\n\n/g, '<br><br>');
  return `<div style="font-family:-apple-system,Inter,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#0a0a14;line-height:1.6;">${html}</div>`;
}

async function sendBriefingEmail(toEmail, markdown) {
  if (!RESEND_KEY) return { sent: false, reason: 'RESEND_API_KEY non configurée' };
  try {
    const html = mdToHtml(markdown);
    const today = new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long'});
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${RESEND_KEY}` },
      body: JSON.stringify({
        from: 'Solution Phone <briefing@solution-phone.fr>',
        to: [toEmail],
        subject: `◢ Briefing du ${today}`,
        html: html
      })
    });
    const data = await res.json();
    if (res.ok) return { sent: true, id: data.id };
    return { sent: false, reason: `Resend ${res.status}: ${JSON.stringify(data).substring(0,200)}` };
  } catch (e) {
    return { sent: false, reason: 'Resend exception: ' + e.message };
  }
}

// ──────────────────────────────────────────────────────────
// HANDLER
// ──────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!CLAUDE_KEY || !SUPA_URL) {
    return res.status(500).json({ error: 'Variables ENV manquantes' });
  }

  const isCron = req.headers['x-vercel-cron'] === '1';
  const force = req.query.force === '1';
  const today = new Date().toISOString().split('T')[0];

  try {
    // Vérifier qu'on n'a pas déjà un briefing aujourd'hui (sauf force)
    if (!force) {
      const existing = await supaQuery('brain_briefings', 'GET', null,
        `?date_brief=eq.${today}&type=eq.morning`);
      if (existing && existing.length) {
        return res.status(200).json({
          skipped: 'Briefing du jour déjà généré',
          briefing_id: existing[0].id
        });
      }
    }

    // 1. Collecte contexte
    const ctx = await collectBriefingContext();

    // 2. Appel Claude
    const systemPrompt = buildBriefingSystemPrompt(ctx.memory);
    const userMessage = buildBriefingUserMessage(ctx);
    const startMs = Date.now();
    const { text: briefingMd, usage } = await callClaude(systemPrompt, userMessage);
    const cost = calcCost(usage);

    // 3. Stocker dans brain_briefings
    const inserted = await supaQuery('brain_briefings', 'POST', {
      date_brief: today,
      type: 'morning',
      content_md: briefingMd,
      content_html: mdToHtml(briefingMd),
      actions_pending: (ctx.pending_decisions || []).length,
      cost_eur: cost,
      generated_by: 'meta_agent'
    });
    const briefingId = inserted && inserted[0] && inserted[0].id;

    // 4. Email Resend
    const emailRes = await sendBriefingEmail(NOTIF_EMAIL, briefingMd);
    if (emailRes.sent && briefingId) {
      await supaQuery('brain_briefings', 'PATCH', {
        delivery_email_sent: true,
        delivery_email_at: new Date().toISOString()
      }, `?id=eq.${briefingId}`);
    }

    // 5. Log
    try {
      await supaQuery('social_logs', 'POST', {
        level: 'auto', source: 'brain',
        message: `Briefing matinal généré · ${cost}€ · email=${emailRes.sent}`,
        metadata: { briefing_id: briefingId }
      });
    } catch(e){}

    return res.status(200).json({
      success: true,
      briefing_id: briefingId,
      cost_eur: cost,
      duration_ms: Date.now() - startMs,
      email: emailRes
    });

  } catch (err) {
    console.error('Morning run error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
