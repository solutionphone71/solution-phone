// /api/brain/chat.js — Assistant Claude conversationnel
// Solution Phone Brain · Phase Vision A · mai 2026
//
// Endpoint qui prend une question Sébastien + lit le contexte business
// et renvoie une réponse intelligente.
//
// POST /api/brain/chat
// Body: { message: "...", history: [{role, content}] }

import { handleAuth } from '../_auth.js';

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
  return `Tu es ZAHIRA, cheffe de cabinet IA de Sébastien, gérant de Solution Phone (Mâcon, 12 ans, 4.7★ Google, 552 avis, 3 boutiques, 5 employés).

TON IDENTITÉ
Tu es la cheffe de l'équipe IA. Tu orchestres 5 agents qui bossent pour Sébastien :
- ASSYA · Community Manager (Insta, FB, Google reviews)
- YAGO · QualiRépar (dossiers ANRE, bonus)
- ANISSA · Compta (Pennylane, TVA, marges)
- OBIWAN · Coach Boutique (stock, équipe, tempo)
- CHANEL · App Improver (UX, features)

Tu parles à Sébastien directement. Quand il te demande quelque chose, tu peux soit répondre toi-même, soit indiquer que tu vas demander à un de tes agents.

CONTEXTE TEMPS RÉEL (snapshot)
- Caisses ce mois : ${ctx.caisses_count_month || 0}
- Caisses hier : ${ctx.caisses_count_yesterday || 0}
- CA estimé mois : ${(ctx.ca_month_estimate || 0).toFixed(0)} €
- Stock smartphones : ${ctx.stock_count || 0}
- Décisions équipe en attente : ${ctx.pending_decisions_count || 0}

CE QUE TU PEUX FAIRE
- Donner des analyses (CA, marges, tendances)
- Suggérer des actions
- Briefer un agent ("je dis à Assya de préparer 3 posts")
- Aider à formuler un post / SMS / email
- Donner des conseils stratégiques

CE QUE TU NE PEUX PAS ENCORE
- Créer/modifier directement des données opérationnelles (caisse, factures) — bientôt
- Publier directement (validation 1-clic obligatoire)

STYLE
- Direct, court (2-4 phrases en moyenne)
- ${brand.tone || 'Pro, calme, chaleureux sans familiarité'}
- Pas de "Bien sûr Sébastien", pas d'introduction inutile
- Utilise les chiffres exacts du contexte
- Si tu ne sais pas, dis-le franchement
- Tu peux tutoyer Sébastien, vous êtes une équipe

FORMAT
Markdown léger autorisé (gras, listes courtes). Pas de h1/h2.`;
}

// ─── Persistence (best-effort, ne casse pas le chat si la table n'existe pas) ───
async function saveMessage(role, content, metadata) {
  try {
    await supaQuery('brain_chat_messages', 'POST', {
      role,
      content,
      metadata: metadata || {}
    });
  } catch(e) {
    // Silent fail : la table n'existe peut-être pas encore (SQL migration pas exécutée)
    console.warn('[chat] saveMessage failed:', e.message);
  }
}

async function loadRecentHistory(limit) {
  try {
    const rows = await supaQuery('brain_chat_messages', 'GET', null,
      `?order=created_at.desc&limit=${limit || 10}&select=role,content,created_at`);
    if (!Array.isArray(rows)) return [];
    // Reverse so oldest first
    return rows.reverse().map(r => ({ role: r.role, content: r.content }));
  } catch(e) {
    return [];
  }
}

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
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

    // Sauver le message utilisateur (best-effort)
    saveMessage('user', message, { source: 'home' });

    // Charger l'historique récent depuis la DB (10 derniers messages)
    let messages = await loadRecentHistory(10);

    // Si pas d'historique en DB, on prend ce que le client envoie en fallback
    if (!messages.length && Array.isArray(history)) {
      messages = history.slice(-6)
        .filter(h => h.role && h.content && (h.role === 'user' || h.role === 'assistant'))
        .map(h => ({ role: h.role, content: h.content }));
    }

    // Ajouter le message courant si pas déjà inclus
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== message) {
      messages.push({ role: 'user', content: message });
    }

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

    // Sauver la réponse Zahira (best-effort)
    saveMessage('assistant', reply, {
      source: 'home',
      cost_eur: Number(cost.toFixed(4)),
      tokens_in: usage.input_tokens,
      tokens_out: usage.output_tokens
    });

    // Log léger
    try {
      await supaQuery('social_logs', 'POST', {
        level: 'auto', source: 'agent',
        message: `Chat Zahira : "${message.substring(0,80)}"`,
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
