// /api/brain/chat.js — Assistant Claude conversationnel
// Solution Phone Brain · Phase Vision A · mai 2026
//
// Endpoint qui prend une question Sébastien + lit le contexte business
// et renvoie une réponse intelligente.
//
// POST /api/brain/chat
// Body: { message: "...", history: [{role, content}] }

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;
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
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function loadQuickContext() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24*3600*1000);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const ctx = {};

  try {
    const memRows = await supaQuery('agent_memory', 'GET', null, '?key=in.(brand_voice,kpis_baseline)');
    ctx.memory = {};
    (memRows||[]).forEach(m => { ctx.memory[m.key] = m.value; });
  } catch(e) { ctx.memory = {}; }

  // Mini-résumé : juste les volumes récents pour permettre à Claude d'avoir du contexte
  try {
    const caisses = await supaQuery('caisse', 'GET', null,
      `?created_at=gte.${monthStart.toISOString()}&select=id,created_at,libelle,prix&limit=200`);
    ctx.caisses_count_month = (caisses||[]).length;
    ctx.caisses_count_yesterday = (caisses||[]).filter(c => c.created_at >= yesterday.toISOString()).length;
    ctx.ca_month_estimate = (caisses||[]).reduce((s,c)=>s+(parseFloat(c.prix||0)||0),0);
  } catch(e) {}

  try {
    const stock = await supaQuery('phones', 'GET', null, '?select=id&limit=200');
    ctx.stock_count = (stock||[]).length;
  } catch(e) {}

  try {
    const pending = await supaQuery('agent_decisions', 'GET', null,
      '?status=eq.pending_validation&select=id&limit=100');
    ctx.pending_decisions_count = (pending||[]).length;
  } catch(e) {}

  return ctx;
}

function buildChatSystemPrompt(ctx) {
  const brand = (ctx.memory && ctx.memory.brand_voice) || {};
  return `Tu es l'assistant business de Sébastien, gérant de Solution Phone (Mâcon, 12 ans, 4.7★ Google).

CONTEXTE TEMPS RÉEL (snapshot)
- Caisses ce mois : ${ctx.caisses_count_month || 0}
- Caisses hier : ${ctx.caisses_count_yesterday || 0}
- CA estimé mois : ${(ctx.ca_month_estimate || 0).toFixed(0)} €
- Stock smartphones : ${ctx.stock_count || 0}
- Décisions Autopilot en attente : ${ctx.pending_decisions_count || 0}

TON RÔLE
Tu es accessible via la barre de recherche en haut de l'app.
Tu réponds aux questions de Sébastien sur son business.
Tu peux :
- Donner des analyses (CA, marges, tendances)
- Suggérer des actions
- Expliquer une fonctionnalité de l'app
- Aider à formuler un post / SMS / email
- Donner des conseils stratégiques

TU NE PEUX PAS ENCORE
- Créer/modifier directement des données (caisse, factures, etc.) — c'est en Phase suivante
- Publier des posts (Sébastien doit valider via Autopilot)

STYLE
- Direct, court (3-5 phrases sauf demande détail)
- ${brand.tone || 'Pro mais chaleureux'}
- Pas de blabla, pas de "Bien sûr je peux vous aider"
- Utilise les chiffres exacts du contexte
- Si tu ne sais pas, dis-le

FORMAT
Markdown léger autorisé (gras, listes courtes).
Pas de h1/h2 (c'est du chat).`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquante' });

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message requis' });
  }

  try {
    // Charger contexte business léger
    const ctx = await loadQuickContext();
    const systemPrompt = buildChatSystemPrompt(ctx);

    // Construire l'historique de conversation
    const messages = [];
    if (Array.isArray(history)) {
      history.slice(-6).forEach(h => {
        if (h.role && h.content && (h.role === 'user' || h.role === 'assistant')) {
          messages.push({ role: h.role, content: h.content });
        }
      });
    }
    messages.push({ role: 'user', content: message });

    // Appel Claude
    const startMs = Date.now();
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 1500,
        system: systemPrompt,
        messages: messages
      })
    });
    const data = await claudeRes.json();
    if (!claudeRes.ok) {
      return res.status(claudeRes.status).json({ error: data.error?.message || 'Claude error' });
    }

    const reply = (data.content && data.content[0] && data.content[0].text) || '';
    const usage = data.usage || {};
    const cost = ((usage.input_tokens||0)/1e6 * 3.0 + (usage.output_tokens||0)/1e6 * 15.0) * 0.93;

    // Log léger
    try {
      await supaQuery('social_logs', 'POST', {
        level: 'auto', source: 'agent',
        message: `Chat : "${message.substring(0,80)}"`,
        metadata: { tokens: usage, cost_eur: cost.toFixed(4) }
      });
    } catch(e) {}

    return res.status(200).json({
      success: true,
      reply: reply,
      cost_eur: Number(cost.toFixed(4)),
      duration_ms: Date.now() - startMs,
      tokens: usage
    });

  } catch (err) {
    console.error('Chat error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
