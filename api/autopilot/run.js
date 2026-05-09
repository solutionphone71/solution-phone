// /api/autopilot/run.js — Agent IA Autopilot
// Solution Phone · Phase 2 chunk 2.1 · mai 2026
//
// Endpoint principal du cerveau agent.
// Modes :
//   GET/POST /api/autopilot/run?type=manual    → run manuel (depuis bouton UI)
//   GET/POST /api/autopilot/run?type=morning   → run matinal (cron Vercel 8h)
//   GET/POST /api/autopilot/run?type=evening   → run soir (cron Vercel 19h)
//
// Workflow :
//   1. Crée un agent_runs (status='running')
//   2. Collecte le contexte business (caisses, avis, stock, mémoire)
//   3. Appelle Claude Sonnet 4.5 avec prompt structuré
//   4. Parse la réponse en décisions JSON
//   5. Insert agent_decisions (status='pending_validation')
//   6. Met à jour agent_runs (status='success')
//
// Phase 2 chunk 2.1 : juste la PROPOSITION de décisions.
// L'EXECUTION (publish réel) viendra dans chunk 2.2.

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 4000;

// Tarifs Claude Sonnet 4.5 (mai 2025) — pour calcul coût
const PRICE_INPUT_PER_M = 3.0;        // $/M tokens input
const PRICE_OUTPUT_PER_M = 15.0;      // $/M tokens output
const PRICE_CACHED_PER_M = 0.30;      // $/M tokens cached read
const EUR_PER_USD = 0.93;

// ──────────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────────

async function supaQuery(table, method = 'GET', body = null, query = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': `Bearer ${SUPA_KEY}`,
    'Content-Type': 'application/json',
  };
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

function nowIso() { return new Date().toISOString(); }

// ──────────────────────────────────────────────────────────
// COLLECTE DE CONTEXTE
// ──────────────────────────────────────────────────────────

async function collectContext() {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 3600 * 1000);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 3600 * 1000);

  const ctx = { observed_at: today.toISOString() };

  // Mémoire de l'agent (brand_voice, do_not_post, kpis_baseline, etc.)
  try {
    const memoryRows = await supaQuery('agent_memory', 'GET', null, '');
    ctx.memory = {};
    (memoryRows || []).forEach(m => { ctx.memory[m.key] = m.value; });
  } catch (e) {
    ctx.memory = {};
    ctx.memory_error = e.message;
  }

  // Caisses des dernières 24h
  try {
    ctx.caisses_24h = await supaQuery(
      'caisse', 'GET', null,
      `?created_at=gte.${yesterday.toISOString()}&order=created_at.desc&limit=20`
    );
  } catch (e) { ctx.caisses_24h = []; ctx.caisses_error = e.message; }

  // Stock smartphones disponibles
  try {
    ctx.stock_phones = await supaQuery(
      'phones', 'GET', null,
      '?order=created_at.desc&limit=20'
    );
  } catch (e) { ctx.stock_phones = []; ctx.stock_error = e.message; }

  // Posts récemment publiés (pour éviter doublons)
  try {
    ctx.posts_7d = await supaQuery(
      'social_posts', 'GET', null,
      `?status=eq.published&published_at=gte.${weekAgo.toISOString()}&order=published_at.desc&limit=15`
    );
  } catch (e) { ctx.posts_7d = []; }

  // Décisions en attente (pour ne pas re-proposer)
  try {
    ctx.pending_decisions = await supaQuery(
      'agent_decisions', 'GET', null,
      '?status=eq.pending_validation&order=created_at.desc&limit=10'
    );
  } catch (e) { ctx.pending_decisions = []; }

  // Médias disponibles non utilisés depuis 7j
  try {
    ctx.fresh_media = await supaQuery(
      'social_media', 'GET', null,
      `?or=(used_count.eq.0,last_used_at.lt.${weekAgo.toISOString()})&order=uploaded_at.desc&limit=10`
    );
  } catch (e) { ctx.fresh_media = []; }

  // Date / contexte temporel
  const fr = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
  ctx.today_fr = fr.format(today);
  ctx.weekday = today.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  ctx.hour = today.getHours();

  return ctx;
}

// ──────────────────────────────────────────────────────────
// PROMPT BUILDER
// ──────────────────────────────────────────────────────────

function buildSystemPrompt(memory) {
  const brand = memory.brand_voice || {};
  const doNot = memory.do_not_post || {};
  const kpis = memory.kpis_baseline || {};

  return `Tu es l'agent CM autonome de Solution Phone, magasin de réparation smartphone à Mâcon, France.
Tu travailles depuis 2014 (12 ans), 3 boutiques, 5 employés, 4.7★ sur 550+ avis Google.
Tagline : "${brand.tagline || 'Rapides. Honnêtes. Précis.'}"

VOIX DE MARQUE
Ton : ${brand.tone || 'Direct, professionnel, chaleureux sans être familier.'}
Expressions à utiliser : ${(brand.expressions_a_utiliser || []).join(', ')}
Expressions à éviter : ${(brand.expressions_a_eviter || []).join(', ')}
Max emojis par post : ${brand.emoji_max_per_post || 2}
Hashtags signature : ${(brand.hashtags_signature || []).join(' ')}

INTERDICTIONS
Sujets bannis : ${(doNot.topics || []).join(', ')}
Claims interdits : ${(doNot.claims_interdits || []).join(', ')}

KPIs de référence
Note Google moyenne cible : ${kpis.google_avg_rating || 4.7}
Engagement IG cible : ${(kpis.ig_engagement_rate_target || 0.04) * 100}%

TON RÔLE
Chaque run, tu observes le contexte business (caisses récentes, stock, avis, etc.) et tu DÉCIDES quelles actions prendre.
Tu ne fais que PROPOSER des décisions. Sébastien valide ensuite par 1-clic.

RÈGLES POUR TES DÉCISIONS
- Tu dois APPELER l'outil 'propose_decisions' avec tes décisions structurées.
- Maximum 5 décisions par run, mais propose au moins 1 si tu vois quelque chose à faire.
- Confidence entre 0.5 et 0.95 (jamais 1.0).
- Évite les doublons avec posts_7d et pending_decisions.
- Pour les posts : payload doit contenir caption, platforms, media_hint.
- Pour les réponses aux avis : type 'reply_review' avec payload.review_id + payload.reply_text.
- Pour SMS : type 'sms' avec payload.client_phone, payload.client_name, payload.message.
- Si vraiment rien à faire, retourne decisions: [] avec thoughts qui explique pourquoi.

NE FAIS PAS DE TEXTE LIBRE. Appelle directement l'outil 'propose_decisions'.
`;
}

function buildUserMessage(ctx) {
  return `CONTEXTE BUSINESS — ${ctx.today_fr}
Heure : ${ctx.hour}h · Jour : ${ctx.weekday}

═══ CAISSES DES 24H ═══
${ctx.caisses_24h.length} caisse(s) clôturée(s) :
${JSON.stringify((ctx.caisses_24h || []).slice(0, 10), null, 2)}

═══ STOCK SMARTPHONES ═══
${(ctx.stock_phones || []).length} en stock :
${JSON.stringify((ctx.stock_phones || []).slice(0, 10), null, 2)}

═══ POSTS DERNIERS 7J ═══
${(ctx.posts_7d || []).length} déjà publiés :
${JSON.stringify((ctx.posts_7d || []).map(p => ({type: p.type, caption: (p.caption||'').substring(0,80)})), null, 2)}

═══ DÉCISIONS DÉJÀ EN ATTENTE ═══
${(ctx.pending_decisions || []).length} en queue (à NE PAS dupliquer) :
${JSON.stringify((ctx.pending_decisions || []).map(d => ({type: d.type, reasoning: d.reasoning})), null, 2)}

═══ MÉDIAS FRAIS ═══
${(ctx.fresh_media || []).length} non utilisés récemment :
${JSON.stringify((ctx.fresh_media || []).map(m => ({id: m.id, category: m.category, type: m.media_type})), null, 2)}

INSTRUCTION
Analyse ce contexte et propose 0 à 5 décisions concrètes pour aujourd'hui.
Réponds UNIQUEMENT en JSON strict (pas de markdown, pas de texte autour).`;
}

// ──────────────────────────────────────────────────────────
// PARSER
// ──────────────────────────────────────────────────────────

function parseClaudeResponse(claudeData) {
  if (!claudeData.content || !claudeData.content.length) {
    return { thoughts: '(réponse vide)', decisions: [] };
  }

  // Avec tool_use, Claude renvoie un bloc type='tool_use' avec input structuré
  const toolUse = claudeData.content.find(c => c.type === 'tool_use');
  if (toolUse && toolUse.input) {
    return {
      thoughts: toolUse.input.thoughts || '',
      decisions: Array.isArray(toolUse.input.decisions) ? toolUse.input.decisions : []
    };
  }

  // Fallback : essayer de parser le texte (au cas où Claude ne fait pas tool_use)
  const textBlock = claudeData.content.find(c => c.type === 'text');
  if (!textBlock) return { thoughts: '(pas de réponse exploitable)', decisions: [] };

  let text = (textBlock.text || '').trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    const parsed = JSON.parse(text);
    return {
      thoughts: parsed.thoughts || '',
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : []
    };
  } catch (e) {
    return {
      thoughts: '(parse error fallback) Raw: ' + text.substring(0, 200),
      decisions: []
    };
  }
}

function calcCost(usage) {
  if (!usage) return 0;
  const input = (usage.input_tokens || 0) / 1e6;
  const output = (usage.output_tokens || 0) / 1e6;
  const cached = (usage.cache_read_input_tokens || 0) / 1e6;
  const usd = input * PRICE_INPUT_PER_M
            + output * PRICE_OUTPUT_PER_M
            + cached * PRICE_CACHED_PER_M;
  return Number((usd * EUR_PER_USD).toFixed(4));
}

// ──────────────────────────────────────────────────────────
// HANDLER PRINCIPAL
// ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL/SUPABASE_KEY non configurées' });
  }
  if (!CLAUDE_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY non configurée' });
  }

  const runType = (req.query.type || 'manual').toLowerCase();
  const validTypes = ['manual', 'morning', 'evening', 'weekly'];
  if (!validTypes.includes(runType)) {
    return res.status(400).json({ error: `type invalide. Valides : ${validTypes.join(',')}` });
  }

  const startedAt = Date.now();
  let runId = null;
  let createdRun = null;

  try {
    // ─── 1. Vérifier que l'agent n'est pas en pause ───
    const statusRows = await supaQuery('agent_memory', 'GET', null, '?key=eq.agent_status');
    const agentStatus = (statusRows && statusRows[0] && statusRows[0].value) || { active: true };
    if (agentStatus.active === false && runType !== 'manual') {
      return res.status(200).json({
        success: false,
        skipped: 'agent paused',
        reason: agentStatus.paused_reason || 'unknown'
      });
    }

    // ─── 2. Créer agent_run ───
    const newRun = await supaQuery('agent_runs', 'POST', {
      type: runType,
      trigger: req.query.trigger || (runType === 'manual' ? 'sebastien_button' : `cron_${runType}`),
      status: 'running',
      started_at: nowIso()
    });
    createdRun = newRun && newRun[0];
    if (!createdRun) throw new Error('Impossible de créer agent_run');
    runId = createdRun.id;

    // ─── 3. Collecter le contexte ───
    const ctx = await collectContext();

    // ─── 4. Construire les prompts ───
    const systemPrompt = buildSystemPrompt(ctx.memory || {});
    const userMessage = buildUserMessage(ctx);

    // ─── 5. Appel Claude avec TOOL USE (force la structure JSON) ───
    const tool = {
      name: 'propose_decisions',
      description: 'Propose 0 à 5 décisions d\'actions concrètes pour le business Solution Phone aujourd\'hui',
      input_schema: {
        type: 'object',
        properties: {
          thoughts: {
            type: 'string',
            description: 'Ton raisonnement business en 2-4 phrases concrètes'
          },
          decisions: {
            type: 'array',
            maxItems: 5,
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['post', 'reel', 'sms', 'reply_review', 'noop']
                },
                reasoning: {
                  type: 'string',
                  description: 'Pourquoi cette action en 1 phrase'
                },
                confidence: {
                  type: 'number',
                  minimum: 0.5,
                  maximum: 0.95
                },
                payload: {
                  type: 'object',
                  properties: {
                    caption: { type: 'string' },
                    platforms: {
                      type: 'object',
                      properties: {
                        instagram: { type: 'boolean' },
                        facebook: { type: 'boolean' },
                        gbp: { type: 'boolean' }
                      }
                    },
                    media_hint: { type: 'string' },
                    client_phone: { type: 'string' },
                    client_name: { type: 'string' },
                    message: { type: 'string' },
                    review_id: { type: 'string' },
                    reply_text: { type: 'string' }
                  }
                }
              },
              required: ['type', 'reasoning', 'confidence']
            }
          }
        },
        required: ['thoughts', 'decisions']
      }
    };

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        tools: [tool],
        tool_choice: { type: 'tool', name: 'propose_decisions' },
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    const claudeData = await claudeRes.json();

    if (!claudeRes.ok) {
      throw new Error(`Claude ${claudeRes.status}: ${JSON.stringify(claudeData).substring(0, 300)}`);
    }

    // ─── 6. Parser les décisions ───
    const { thoughts, decisions } = parseClaudeResponse(claudeData);

    // ─── 7. Insérer agent_decisions ───
    let insertedCount = 0;
    for (const d of decisions) {
      try {
        await supaQuery('agent_decisions', 'POST', {
          run_id: runId,
          type: d.type || 'noop',
          reasoning: d.reasoning || '',
          confidence: typeof d.confidence === 'number' ? d.confidence : 0.5,
          status: 'pending_validation',
          payload: d.payload || {},
          source_data: { context_snapshot: { caisses: ctx.caisses_24h?.length || 0, stock: ctx.stock_phones?.length || 0 } }
        });
        insertedCount++;
      } catch (e) {
        console.error('Insert decision failed:', e.message);
      }
    }

    // ─── 8. Mettre à jour agent_run ───
    const usage = claudeData.usage || {};
    const cost = calcCost(usage);
    const durationMs = Date.now() - startedAt;

    await supaQuery('agent_runs', 'PATCH', {
      status: insertedCount > 0 ? 'success' : (decisions.length === 0 ? 'success' : 'partial'),
      thoughts: thoughts,
      context_observed: {
        caisses_24h_count: ctx.caisses_24h?.length || 0,
        stock_phones_count: ctx.stock_phones?.length || 0,
        posts_7d_count: ctx.posts_7d?.length || 0,
        pending_decisions_count: ctx.pending_decisions?.length || 0
      },
      decisions_count: decisions.length,
      decisions_pending: insertedCount,
      decisions_executed: 0,
      decisions_failed: decisions.length - insertedCount,
      cost_eur: cost,
      tokens_input: usage.input_tokens || 0,
      tokens_output: usage.output_tokens || 0,
      tokens_cached: usage.cache_read_input_tokens || 0,
      duration_ms: durationMs,
      completed_at: nowIso()
    }, `?id=eq.${runId}`);

    // ─── 9. Log ───
    await supaQuery('social_logs', 'POST', {
      level: 'auto',
      source: 'agent',
      message: `Run ${runType} OK · ${insertedCount} décision(s) · ${cost}€ · ${(durationMs/1000).toFixed(1)}s`,
      metadata: { run_id: runId, type: runType }
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      run_id: runId,
      type: runType,
      decisions_count: decisions.length,
      decisions_pending: insertedCount,
      cost_eur: cost,
      duration_ms: durationMs,
      thoughts: thoughts.substring(0, 500)
    });

  } catch (err) {
    console.error('Autopilot run error:', err);

    // Marquer le run comme failed
    if (runId) {
      try {
        await supaQuery('agent_runs', 'PATCH', {
          status: 'failed',
          error_log: err.message,
          duration_ms: Date.now() - startedAt,
          completed_at: nowIso()
        }, `?id=eq.${runId}`);

        await supaQuery('social_logs', 'POST', {
          level: 'err',
          source: 'agent',
          message: `Run ${runType} FAILED: ${err.message.substring(0, 200)}`,
          metadata: { run_id: runId }
        }).catch(() => {});
      } catch (e) { /* ignore */ }
    }

    return res.status(500).json({
      success: false,
      error: err.message,
      run_id: runId
    });
  }
}
