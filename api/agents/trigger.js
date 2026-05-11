// /api/agents/trigger.js — Triggers IA temps réel
// Solution Phone · Sprint 15J · J15 · mai 2026
//
// Appelé par le front quand un événement business déclenche une action IA :
//   - kind="new_phone"     → Assya prépare un post Instagram (smartphone occasion ajouté en stock)
//   - kind="five_star_review" → Chanel prépare un remerciement personnalisé pour un avis 5★
//   - kind="cloture_repair"   → Anissa vérifie l'éligibilité QualiRépar de la répa cloturée
//
// Workflow :
//   1. Reçoit { kind, data } depuis le front
//   2. Appelle Claude avec un mini-prompt spécialisé (Tool Use → propose 1 décision)
//   3. Insère la décision dans agent_decisions (status=pending_validation)
//   4. Logge dans agent_runs
//   5. Retourne la décision au front pour notification immédiate

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'; // Haiku = rapide + économique pour les triggers
const MAX_TOKENS = 1500;

async function supa(table, method, body, query) {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body ? JSON.stringify(body) : null
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${t.substring(0,200)}`);
  return t ? JSON.parse(t) : null;
}

// ─── PROMPT GENERATORS ─────────────────────────────────────────

function promptNewPhone(p) {
  return `Tu es Assya, community manager de Solution Phone (3 boutiques à Mâcon, réparation smartphone + vente occasion certifiée).

Un nouveau smartphone d'occasion vient d'être ajouté en stock :
• Modèle : ${p.modele || '?'} ${p.stockage || ''} ${p.couleur ? '(' + p.couleur + ')' : ''}
• Grade : ${p.grade || '?'}
• Batterie : ${p.batterie ? p.batterie + '%' : '?'}
• Prix vente : ${p.vente || '?'} €
• IMEI : ${p.imei || '?'}

Prépare UN post Instagram court (3-5 lignes max + 5-7 hashtags) pour annoncer ce smartphone disponible.
Style : direct, accrocheur, vert/rouge si pertinent. Mentionne "garantie 1 an" (reconditionné) et "Solution Phone Mâcon".
Pas d'emoji excessif (max 2-3). Ton humain, pas marketing creux.

Utilise propose_social_post pour me donner la caption finale.`;
}

function promptFiveStar(r) {
  return `Tu es Chanel, gestionnaire communauté et UX chez Solution Phone (réparation smartphone à Mâcon).

Un nouvel avis 5★ Google vient d'être posté :
• Auteur : ${r.reviewer_name || r.author || 'Client'}
• Note : ${r.star_rating || 5}★
• Commentaire : "${(r.comment || r.text || '').substring(0, 500)}"
• Date : ${r.create_time || r.date || 'à l\'instant'}

Prépare une réponse personnalisée et chaleureuse (2-3 phrases max).
Règles :
- Remercier nommément
- Reprendre 1 élément précis du commentaire (si présent)
- Signer "L'équipe Solution Phone" — pas de nom de personne
- Pas de promo, pas de hashtags
- Ton humain, sincère, jamais ChatGPT-creux

Utilise propose_review_reply pour me donner la réponse finale.`;
}

function promptClotureRepair(rep) {
  return `Tu es Anissa, gestionnaire comptable et QualiRépar chez Solution Phone.

Une réparation vient d'être cloturée :
• Bon : ${rep.numero || '?'}
• Appareil : ${rep.appareil || rep.modele || '?'} (IMEI ${rep.imei || '?'})
• Date : ${rep.dateCloture || rep.date || '?'}
• Description : ${(rep.description || rep.panne || '').substring(0, 300)}
• Prix : ${rep.prix || '?'} €
• QualiRépar déjà déclenché : ${rep.qrEnvoi ? 'OUI' : 'NON'}

Analyse si cette réparation est éligible au bonus QualiRépar -25€ (smartphone, écran/batterie/connecteur, hors flagship neuf < 6 mois).
Si éligible ET pas encore déclenchée → propose une action "qualirepar_dossier".
Sinon → noop avec explication courte.

Utilise propose_action.`;
}

// ─── TOOLS ─────────────────────────────────────────────────────

const TOOLS = {
  new_phone: {
    name: 'propose_social_post',
    description: 'Propose un post Instagram pour annoncer le smartphone',
    input_schema: {
      type: 'object',
      required: ['caption', 'hashtags', 'platforms'],
      properties: {
        caption: { type: 'string', description: 'Texte du post (3-5 lignes)' },
        hashtags: { type: 'array', items: { type: 'string' }, description: '5-7 hashtags sans #' },
        platforms: { type: 'array', items: { type: 'string', enum: ['instagram', 'facebook'] } }
      }
    }
  },
  five_star_review: {
    name: 'propose_review_reply',
    description: 'Propose une réponse personnalisée à un avis 5★',
    input_schema: {
      type: 'object',
      required: ['reply'],
      properties: {
        reply: { type: 'string', description: 'Réponse 2-3 phrases max' },
        tone: { type: 'string', enum: ['chaleureux', 'professionnel', 'humour-leger'] }
      }
    }
  },
  cloture_repair: {
    name: 'propose_action',
    description: 'Propose action QualiRépar ou noop',
    input_schema: {
      type: 'object',
      required: ['action', 'reasoning'],
      properties: {
        action: { type: 'string', enum: ['qualirepar_dossier', 'noop'] },
        reasoning: { type: 'string', description: 'Pourquoi cette action' },
        eligible: { type: 'boolean' }
      }
    }
  }
};

const AGENT_MAP = {
  new_phone: 'assya',
  five_star_review: 'chanel',
  cloture_repair: 'anissa'
};

const TYPE_MAP = {
  new_phone: 'post',
  five_star_review: 'reply_review',
  cloture_repair: 'qualirepar_dossier'
};

// ─── HANDLER ───────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { kind, data } = req.body || {};
  if (!kind || !data) return res.status(400).json({ error: 'kind + data requis' });

  const tool = TOOLS[kind];
  if (!tool) return res.status(400).json({ error: 'kind inconnu : ' + kind });

  const t0 = Date.now();
  const agent = AGENT_MAP[kind];

  // Build prompt
  let prompt;
  if (kind === 'new_phone') prompt = promptNewPhone(data);
  else if (kind === 'five_star_review') prompt = promptFiveStar(data);
  else if (kind === 'cloture_repair') prompt = promptClotureRepair(data);

  try {
    if (!CLAUDE_KEY) throw new Error('ANTHROPIC_API_KEY manquant');

    // 1. Claude avec Tool Use forcé
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      throw new Error(`Claude ${claudeRes.status}: ${t.substring(0, 300)}`);
    }

    const claudeJson = await claudeRes.json();
    const toolBlock = (claudeJson.content || []).find(c => c.type === 'tool_use');
    if (!toolBlock) throw new Error('Aucun tool_use retourné par Claude');

    const payload = toolBlock.input || {};

    // 2. Pour cloture_repair, ne créer une décision que si action = qualirepar_dossier
    if (kind === 'cloture_repair' && payload.action === 'noop') {
      return res.status(200).json({ ok: true, skipped: true, reason: payload.reasoning });
    }

    // 3. Insert agent_decision (schéma : run_id, agent_name, type, status, reasoning, confidence, payload)
    const decision = {
      agent_name: agent,
      type: TYPE_MAP[kind],
      status: 'pending_validation',
      reasoning: payload.reasoning || (kind === 'new_phone'
        ? 'Smartphone occasion ajouté → annonce IG'
        : kind === 'five_star_review' ? 'Avis 5★ → réponse personnalisée'
        : 'Réparation cloturée → dossier QualiRépar'),
      confidence: 0.85,
      payload: { ...payload, _trigger: { kind, source: 'trigger', context: data } }
    };
    const inserted = await supa('agent_decisions', 'POST', decision);

    // 4. Logge dans agent_runs (best-effort)
    try {
      await supa('agent_runs', 'POST', {
        agent_name: agent,
        run_type: 'trigger_' + kind,
        status: 'success',
        decisions_count: 1,
        duration_ms: Date.now() - t0,
        metadata: { kind, claude_usage: claudeJson.usage }
      });
    } catch (e) { console.warn('[trigger] log run failed:', e.message); }

    return res.status(200).json({ ok: true, decision: inserted && inserted[0] });
  } catch (e) {
    console.error('[trigger] error:', e);
    try {
      await supa('agent_runs', 'POST', {
        agent_name: agent || 'system',
        run_type: 'trigger_' + kind,
        status: 'error',
        decisions_count: 0,
        duration_ms: Date.now() - t0,
        error_msg: String(e.message || e).substring(0, 500)
      });
    } catch(e2){}
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
