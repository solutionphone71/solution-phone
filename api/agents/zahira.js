// /api/agents/zahira.js — Multi-agent orchestrateur
// Solution Phone · Phase 3 · mai 2026
//
// ZAHIRA (la boss) coordonne 5 workers en parallèle :
//   ◢ ASSYA   · Community Manager  (réseaux sociaux)
//   ◢ ANISSA  · Compta             (caisse, TVA, marges)
//   ◢ OBIWAN  · Coach Boutique     (employés, stock, tempo)
//   ◢ YAGO    · QualiRépar         (dossiers ANRE, bonus)
//   ◢ CHANEL  · App Improver       (UX, friction, features)
//
// Workflow :
//   1. Zahira lit le contexte business partagé
//   2. Dispatche en parallèle aux 5 workers (Promise.all)
//   3. Chaque worker propose 0-N décisions (Tool Use forcé)
//   4. Zahira insère les décisions dans agent_decisions
//   5. Log dans agent_runs (avec metadata par agent)
//
// Modes :
//   GET /api/agents/zahira?type=morning|evening|weekly|manual  → full team
//   GET /api/agents/zahira?agent=assya                         → un seul worker (test)

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 3000;

// Tarifs (mai 2026)
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;
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
  if (method === 'POST' || method === 'PATCH') headers['Prefer'] = 'return=representation';
  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${method} ${table} ${res.status}: ${text.substring(0,200)}`);
  return text ? JSON.parse(text) : null;
}

function nowIso() { return new Date().toISOString(); }

function calcCost(usage) {
  if (!usage) return 0;
  const inputCost = (usage.input_tokens || 0) / 1_000_000 * PRICE_INPUT_PER_M;
  const outputCost = (usage.output_tokens || 0) / 1_000_000 * PRICE_OUTPUT_PER_M;
  return (inputCost + outputCost) * EUR_PER_USD;
}

// ──────────────────────────────────────────────────────────
// SCHEMA TOOL · propose_decisions (commun à tous les agents)
// ──────────────────────────────────────────────────────────

const TOOL_PROPOSE = {
  name: 'propose_decisions',
  description: 'Propose 0 à N décisions à présenter à Sébastien pour validation 1-clic.',
  input_schema: {
    type: 'object',
    required: ['thoughts', 'decisions'],
    properties: {
      thoughts: {
        type: 'string',
        description: 'Tes observations en 1-3 phrases courtes. Ce que tu vois dans le contexte.'
      },
      decisions: {
        type: 'array',
        description: 'Liste des décisions proposées (0 si rien à proposer).',
        items: {
          type: 'object',
          required: ['type', 'reasoning', 'confidence', 'payload'],
          properties: {
            type: {
              type: 'string',
              enum: [
                'post', 'reel', 'story',
                'sms', 'reply_review', 'reply_dm',
                'alert', 'report', 'challenge',
                'qualirepar_dossier', 'feature_idea',
                'noop'
              ],
              description: 'Type de décision'
            },
            reasoning: { type: 'string', description: 'Pourquoi cette décision en 1-2 phrases' },
            confidence: { type: 'number', minimum: 0, maximum: 1, description: '0=incertain, 1=très sûr' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Niveau de priorité' },
            payload: { type: 'object', description: 'Contenu spécifique (caption, montant, message…)' }
          }
        }
      }
    }
  }
};

// ──────────────────────────────────────────────────────────
// APPEL CLAUDE AVEC TOOL USE FORCÉ
// ──────────────────────────────────────────────────────────

async function claudeWithTools(systemPrompt, userMessage) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
      messages: [{ role: 'user', content: userMessage }],
      tools: [TOOL_PROPOSE],
      tool_choice: { type: 'tool', name: 'propose_decisions' }
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Claude ${res.status}: ${JSON.stringify(data).substring(0, 300)}`);
  }

  const toolUse = (data.content || []).find(b => b.type === 'tool_use');
  if (!toolUse) throw new Error('Claude n\'a pas utilisé propose_decisions');

  return {
    thoughts: toolUse.input?.thoughts || '',
    decisions: toolUse.input?.decisions || [],
    usage: data.usage,
    cost_eur: calcCost(data.usage)
  };
}

// ──────────────────────────────────────────────────────────
// ÉQUIPE · 5 AGENTS WORKERS
// ──────────────────────────────────────────────────────────

const AGENTS = {
  assya: {
    role: 'Community Manager',
    label: '◢ ASSYA',
    tagline: 'L\'éclair des réseaux',
    systemPrompt: `Tu es ASSYA, Community Manager de Solution Phone.
Solution Phone : 3 boutiques à Mâcon (71), 12 ans d'existence, 4.7★ sur 550+ avis Google, vendeur/réparateur smartphones reconditionnés.

TON RÔLE : proposer du contenu social media (Insta, Facebook, Google Business Profile).

STYLE ÉDITORIAL v26 — OBLIGATOIRE :
- Ton premium, sobre, jamais cheap
- Brackets ◢ ◣ pour titres
- Phrases courtes, percutantes
- "// TECH UNIT_01" comme tag éditorial possible
- Pas d'emoji excessif (max 1 par post)
- Hashtags Mâcon : #SolutionPhone #Macon #ReparationTelephone #SmartphoneReconditionne

TYPES À PROPOSER : post, reel, story, reply_review, reply_dm, repost (via type=post avec source).

RÈGLES :
- Si zéro post depuis 3+ jours → propose au moins 1 post
- Si avis 5★ récent non reposté → propose un repost
- Max 3 décisions par run
- Si rien à proposer → 1 décision type=noop

Sois concise. Réfléchis comme un pro du social media premium.`,
    contextBuilder: (shared) => ({
      derniers_posts: shared.posts.slice(0, 5).map(p => ({
        type: p.type,
        caption: (p.caption || '').substring(0, 100),
        platforms: p.platforms,
        published_at: p.published_at
      })),
      jours_depuis_dernier_post: shared.posts[0]?.published_at
        ? Math.floor((Date.now() - new Date(shared.posts[0].published_at)) / 86400000)
        : 999,
      avis_5_etoiles_recents: (shared.avis || [])
        .filter(a => (a.note || a.rating) === 5)
        .slice(0, 3)
        .map(a => ({ auteur: a.auteur || a.author, texte: (a.texte || a.text || '').substring(0, 200), date: a.date }))
    })
  },

  anissa: {
    role: 'Compta',
    label: '◢ ANISSA',
    tagline: 'La sentinelle des chiffres',
    systemPrompt: `Tu es ANISSA, sentinelle comptable de Solution Phone.

TON RÔLE : surveiller la santé financière, détecter anomalies, proposer alertes/rapports.

STYLE : factuel, précis, chiffré. Pas de fioriture, pas d'emoji. Que des constats objectifs.

TYPES À PROPOSER : alert (anomalie caisse, TVA), report (synthèse), noop (RAS).

RÈGLES :
- Si CA des 7 derniers jours < 50% du CA des 7 jours précédents → alert urgency=high
- Si écart inhabituel sur 1 jour (>2x ou <50% de la médiane) → alert urgency=medium
- Le 1er du mois → propose un report mensuel
- Max 2 décisions par run
- Si tout est normal → 1 décision type=noop avec reasoning="Caisse stable, rien à signaler"`,
    contextBuilder: (shared) => {
      const caisse = shared.caisse30j || [];
      const total30 = caisse.reduce((s, c) => s + Number(c.total_jour || c.total || 0), 0);
      const last7 = caisse.slice(0, 7);
      const prev7 = caisse.slice(7, 14);
      const ca7 = last7.reduce((s, c) => s + Number(c.total_jour || c.total || 0), 0);
      const caPrev7 = prev7.reduce((s, c) => s + Number(c.total_jour || c.total || 0), 0);
      return {
        ca_7j: Math.round(ca7),
        ca_7j_precedents: Math.round(caPrev7),
        ca_30j: Math.round(total30),
        nb_jours_caisse: caisse.length,
        derniers_jours: caisse.slice(0, 7).map(c => ({ date: c.date, total: c.total_jour || c.total }))
      };
    }
  },

  obiwan: {
    role: 'Coach Boutique',
    label: '◢ OBIWAN',
    tagline: 'Le sage maître Jedi',
    systemPrompt: `Tu es OBIWAN, coach des 3 boutiques Solution Phone (Mâcon).

TON RÔLE : surveiller stock + perfs employés, proposer challenges, alertes stock critique.

STYLE : sage, encourageant, motivant. Jamais agressif. Court et clair.

TYPES À PROPOSER : challenge (objectif hebdo équipe), alert (stock critique), noop.

RÈGLES :
- Si stock d'un modèle phare = 0 ou < seuil critique → alert urgency=high
- Le lundi matin → propose 1 challenge hebdo (ex: "Cette semaine, cap sur les batteries iPhone 12-14")
- Max 2 décisions par run
- Si rien à signaler → noop`,
    contextBuilder: (shared) => ({
      nb_articles_stock: (shared.stock || []).length,
      stock_critique: (shared.stock || [])
        .filter(s => Number(s.quantite || s.quantity || 0) <= 1)
        .slice(0, 10)
        .map(s => ({ nom: s.nom || s.name, quantite: s.quantite || s.quantity })),
      ca_7j: (shared.caisse30j || []).slice(0, 7).reduce((s, c) => s + Number(c.total_jour || c.total || 0), 0),
      jour_semaine: shared.weekday
    })
  },

  yago: {
    role: 'QualiRépar',
    label: '◢ YAGO',
    tagline: 'Le forgeron',
    systemPrompt: `Tu es YAGO, expert QualiRépar de Solution Phone.

TON RÔLE : détecter les réparations éligibles au bonus ANRE, monter les dossiers, proposer des posts mettant en avant les bonus.

CONTEXTE BONUS QualiRépar (2026) :
- Batterie : 25€ remboursés
- Écran : 25-50€ selon modèle
- Carte mère / connecteur : 25-50€
- Le client n'avance rien, c'est Solution Phone qui se fait rembourser par l'ANRE

STYLE : précis, factuel, montants en €. Concret.

TYPES À PROPOSER : qualirepar_dossier (dossier à monter), post (mettre en avant un bonus), noop.

RÈGLES :
- Si réparation éligible non encore en dossier → propose qualirepar_dossier
- 1-2x par semaine → propose un post éducatif sur le bonus (type=post, reasoning expliqué à Assya)
- Max 2 décisions par run
- Si rien d'urgent → noop`,
    contextBuilder: (shared) => ({
      reparations_recentes_potentiellement_eligibles: (shared.caisse30j || [])
        .filter(c => /batterie|écran|ecran|connecteur|carte mère|carte mere/i.test(JSON.stringify(c).toLowerCase()))
        .slice(0, 8)
        .map(c => ({ date: c.date, total: c.total_jour || c.total })),
      total_reparations_30j: (shared.caisse30j || []).length
    })
  },

  chanel: {
    role: 'App Improver',
    label: '◢ CHANEL',
    tagline: 'L\'œil affûté du luxe',
    systemPrompt: `Tu es CHANEL, observatrice premium de l'app Solution Phone (app.solution-phone.fr).

TON RÔLE : détecter friction UI/UX, anomalies, proposer features qui élèvent l'app.

STYLE : élégante, exigeante, jamais complaisante. Observe avec précision.

TYPES À PROPOSER : feature_idea (nouvelle feature), alert (bug détecté), noop.

RÈGLES :
- Tu ne proposes une idée que si elle a un vrai impact business ou UX mesurable
- Pas de feature gadget
- Max 1 décision par run (sois sélective)
- Si rien de pertinent cette semaine → noop avec reasoning="Rien d'urgent, l'app tourne bien"`,
    contextBuilder: (shared) => ({
      derniers_runs: (shared.runs || []).slice(0, 3).map(r => ({
        type: r.type, status: r.status, started_at: r.started_at
      })),
      nb_decisions_pending: shared.nbPending || 0,
      jour_semaine: shared.weekday
    })
  }
};

// ──────────────────────────────────────────────────────────
// CONTEXTE PARTAGÉ (collecté 1 fois, utilisé par tous)
// ──────────────────────────────────────────────────────────

async function buildSharedContext(triggerType) {
  const today = new Date();

  const safe = async (fn) => { try { return await fn(); } catch (e) { return null; } };

  const [posts, avis, caisse30j, stock, runs, pendingDecisions] = await Promise.all([
    safe(() => supaQuery('social_posts', 'GET', null, '?order=published_at.desc&limit=10')),
    safe(() => supaQuery('mes_avis_google', 'GET', null, '?order=date.desc&limit=20')),
    safe(() => supaQuery('caisse', 'GET', null, '?order=date.desc&limit=30')),
    safe(() => supaQuery('stock', 'GET', null, '?limit=200')),
    safe(() => supaQuery('agent_runs', 'GET', null, '?order=started_at.desc&limit=5')),
    safe(() => supaQuery('agent_decisions', 'GET', null, '?status=eq.pending&select=id'))
  ]);

  return {
    triggerType,
    now: today.toISOString(),
    weekday: today.toLocaleDateString('fr-FR', { weekday: 'long' }),
    posts: posts || [],
    avis: avis || [],
    caisse30j: caisse30j || [],
    stock: stock || [],
    runs: runs || [],
    nbPending: (pendingDecisions || []).length
  };
}

// ──────────────────────────────────────────────────────────
// EXÉCUTION D'UN AGENT WORKER
// ──────────────────────────────────────────────────────────

async function runWorker(agentName, shared) {
  const agent = AGENTS[agentName];
  if (!agent) throw new Error(`Agent inconnu: ${agentName}`);

  const agentContext = agent.contextBuilder(shared);
  const userMessage = `Contexte du jour (${shared.weekday}, déclencheur=${shared.triggerType}) :\n\n${JSON.stringify(agentContext, null, 2)}\n\nPropose tes décisions via l'outil propose_decisions.`;

  const startedAt = Date.now();
  try {
    const result = await claudeWithTools(agent.systemPrompt, userMessage);
    return {
      agent: agentName,
      label: agent.label,
      role: agent.role,
      success: true,
      thoughts: result.thoughts,
      decisions: result.decisions,
      usage: result.usage,
      cost_eur: result.cost_eur,
      duration_ms: Date.now() - startedAt
    };
  } catch (err) {
    return {
      agent: agentName,
      label: agent.label,
      role: agent.role,
      success: false,
      error: err.message,
      decisions: [],
      duration_ms: Date.now() - startedAt
    };
  }
}

// ──────────────────────────────────────────────────────────
// ZAHIRA · ORCHESTRATEUR
// ──────────────────────────────────────────────────────────

async function runZahira(triggerType) {
  const startedAt = nowIso();
  const debugErrors = [];

  // 1. Créer le run (schéma compatible avec run.js existant : type + trigger + status + started_at)
  let runId = null;
  try {
    const runRow = await supaQuery('agent_runs', 'POST', {
      type: triggerType,
      trigger: `zahira_${triggerType}`,
      status: 'running',
      started_at: startedAt
    });
    runId = runRow?.[0]?.id;
    if (!runId) debugErrors.push({ step: 'create_run', error: 'INSERT returned no id', row: runRow });
  } catch (e) {
    debugErrors.push({ step: 'create_run', error: e.message });
  }

  // 2. Collecter le contexte partagé (1 seule fois)
  const shared = await buildSharedContext(triggerType);

  // 3. Dispatcher aux 5 workers en parallèle
  const workerResults = await Promise.all(
    Object.keys(AGENTS).map(name => runWorker(name, shared))
  );

  // 4. Insérer les décisions
  const allDecisions = [];
  for (const result of workerResults) {
    if (!result.success) continue;
    for (const dec of result.decisions || []) {
      if (dec.type === 'noop') continue; // on n'insère pas les noop dans la queue
      try {
        const inserted = await supaQuery('agent_decisions', 'POST', {
          run_id: runId,
          agent_name: result.agent,
          type: dec.type,
          status: 'pending_validation',
          reasoning: dec.reasoning,
          confidence: dec.confidence ?? 0.7,
          payload: dec.payload || {}
        });
        if (inserted && inserted[0]) {
          allDecisions.push({ ...dec, id: inserted[0].id, agent: result.agent, label: result.label });
        } else {
          debugErrors.push({ step: 'insert_decision', agent: result.agent, error: 'INSERT returned empty', row: inserted });
        }
      } catch (e) {
        debugErrors.push({ step: 'insert_decision', agent: result.agent, type: dec.type, error: e.message });
      }
    }
  }

  // 5. Calcul des totaux
  const totalCost = workerResults.reduce((s, r) => s + (r.cost_eur || 0), 0);
  const totalTokensIn = workerResults.reduce((s, r) => s + (r.usage?.input_tokens || 0), 0);
  const totalTokensOut = workerResults.reduce((s, r) => s + (r.usage?.output_tokens || 0), 0);

  // 6. Mettre à jour le run (schéma minimal pour matcher la table existante)
  const finishedAt = nowIso();
  if (runId) {
    try {
      await supaQuery('agent_runs', 'PATCH', {
        status: 'success',
        finished_at: finishedAt,
        decisions_count: allDecisions.length,
        cost_eur: Number(totalCost.toFixed(4)),
        tokens_in: totalTokensIn,
        tokens_out: totalTokensOut
      }, `?id=eq.${runId}`);
    } catch (e) {
      debugErrors.push({ step: 'patch_run', error: e.message });
    }
  }

  return {
    success: true,
    run_id: runId,
    trigger: triggerType,
    started_at: startedAt,
    finished_at: finishedAt,
    cost_eur: Number(totalCost.toFixed(4)),
    tokens_in: totalTokensIn,
    tokens_out: totalTokensOut,
    workers: workerResults.map(r => ({
      agent: r.agent,
      label: r.label,
      role: r.role,
      success: r.success,
      thoughts: r.thoughts,
      n_decisions: (r.decisions || []).filter(d => d.type !== 'noop').length,
      duration_ms: r.duration_ms,
      cost_eur: r.cost_eur,
      error: r.error
    })),
    decisions: allDecisions,
    debug_errors: debugErrors  // ← visibilité totale sur les échecs SQL
  };
}

// ──────────────────────────────────────────────────────────
// HANDLER
// ──────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const triggerType = (req.query.type || 'manual').toString();
  const onlyAgent = (req.query.agent || '').toString().toLowerCase();

  try {
    // Mode test : un seul worker
    if (onlyAgent) {
      if (!AGENTS[onlyAgent]) {
        return res.status(400).json({
          error: `Agent inconnu: ${onlyAgent}`,
          available: Object.keys(AGENTS)
        });
      }
      const shared = await buildSharedContext(triggerType);
      const result = await runWorker(onlyAgent, shared);
      return res.status(200).json(result);
    }

    // Mode normal : Zahira orchestre toute l'équipe
    const result = await runZahira(triggerType);
    return res.status(200).json(result);

  } catch (err) {
    console.error('Zahira fatal error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
