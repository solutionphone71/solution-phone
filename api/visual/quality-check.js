// /api/visual/quality-check.js — QC Vision automatique via Claude
// Solution Phone · Validation IA des visuels générés · mai 2026
//
// POST /api/visual/quality-check
// Body : { image_url: string, template_name: string, variables: object }
//   ou : { job_id: number }  (raccourci : on lit le job, l'image et les variables)
//
// Réponse : {
//   ok: bool,
//   passed: bool,        // true = visuel conforme, prêt à publier
//   score: 0..10,        // note globale du visuel
//   issues: [            // liste des défauts détectés
//     { severity: 'critical'|'major'|'minor', area: 'text'|'palette'|'layout'|'brand', detail: '...' }
//   ],
//   suggested_prompt_changes: [ '...', '...' ],   // ce que Claude propose de modifier dans le prompt
//   cost_eur: number,
//   duration_ms: number
// }
//
// Usage typique :
//   - À chaque fin de génération réussie (status=ready), process-queue appelle ce QC
//   - Si passed → décision passe en pending_validation (visible dans Autopilot UI)
//   - Si pas passed et retries < 2 → on remet le job en queued avec un prompt augmenté

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const CLAUDE_KEY = process.env.ANTHROPIC_API_KEY;

const CLAUDE_MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 1500;

// Tarifs Claude Sonnet 4-6 (mai 2026)
const PRICE_INPUT_PER_M = 3.0;
const PRICE_OUTPUT_PER_M = 15.0;
const EUR_PER_USD = 0.93;

// ─── Helpers Supabase ────────────────────────────────────────────

async function supa(table, method = 'GET', body = null, query = '') {
  const url = `${SUPA_URL}/rest/v1/${table}${query || ''}`;
  const r = await fetch(url, {
    method,
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: method === 'GET' ? '' : 'return=representation'
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${text.substring(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// ─── Fetch image as base64 (Claude needs base64 input) ──────────

async function imageToBase64(imageUrl) {
  const r = await fetch(imageUrl);
  if (!r.ok) throw new Error(`Image fetch ${r.status}: ${imageUrl}`);
  const buffer = await r.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  const contentType = r.headers.get('content-type') || 'image/png';
  return { base64, contentType };
}

// ─── Tool schema pour Claude (forcing structured output) ─────────

const QC_TOOL = {
  name: 'visual_quality_check',
  description: 'Évaluer la qualité d\'un visuel publicitaire Solution Phone.',
  input_schema: {
    type: 'object',
    required: ['passed', 'score', 'issues', 'reasoning'],
    properties: {
      passed: {
        type: 'boolean',
        description: 'true = le visuel respecte la charte et est prêt à publier. false = il y a au moins un défaut critique ou majeur.'
      },
      score: {
        type: 'number',
        description: 'Note globale 0 à 10. 10 = parfait. 8+ = publiable. 5-7 = à retravailler. <5 = à jeter.'
      },
      issues: {
        type: 'array',
        description: 'Liste des défauts détectés (vide si aucun défaut).',
        items: {
          type: 'object',
          required: ['severity', 'area', 'detail'],
          properties: {
            severity: { type: 'string', enum: ['critical', 'major', 'minor'] },
            area:     { type: 'string', enum: ['text', 'palette', 'layout', 'brand', 'product', 'typography'] },
            detail:   { type: 'string', description: 'Description en 1 phrase claire en français.' }
          }
        }
      },
      suggested_prompt_changes: {
        type: 'array',
        description: 'Si passed=false, propose 1 à 3 modifications spécifiques à apporter au prompt pour fixer les défauts.',
        items: { type: 'string' }
      },
      reasoning: {
        type: 'string',
        description: 'Ton raisonnement bref (1-2 phrases) pour expliquer la note.'
      }
    }
  }
};

// ─── Build the QC prompt with brand context + brief variables ────

function buildQcPrompt(templateName, variables) {
  const varsText = Object.keys(variables || {}).length > 0
    ? Object.entries(variables).map(([k, v]) => `  - ${k} : "${v}"`).join('\n')
    : '  (aucune variable spécifique pour ce template)';

  return `Tu es le Directeur Artistique officiel de Solution Phone (boutique réparation smartphone premium à Mâcon depuis 2014).

Ton rôle : juger en 5 secondes si le visuel ci-joint respecte la charte de marque et est prêt à être publié sur Instagram / Facebook.

CHARTE STRICTE :
- Palette 60/30/10 : 60% noir #0D0D0D, 30% blanc #FFFFFF, 10% rouge signature #E10600.
- Aucune autre couleur saturée tolérée (bleu QualiRépar #0066CC autorisé UNIQUEMENT pour le label QualiRépar).
- Typographie : Montserrat Extra Bold pour les titres, Montserrat Regular pour le texte.
- Style : Apple × Tesla × B&O. Premium, cinématique, minimaliste, jamais cheap.
- Adresse correcte : "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89".
- Téléphone : 03 85 33 06 89.
- Garantie : 6 mois (jamais 0, jamais 12, sauf reconditionné neuf = 12 mois).

TEMPLATE : ${templateName}

VARIABLES SUPPLIÉES (le texte de l'image DOIT contenir ces valeurs exactes) :
${varsText}

CRITÈRES DE JUGEMENT :
1. TEXTE : les valeurs des variables apparaissent-elles correctement et sans faute ? (severity: critical si une faute de frappe ou un chiffre faux ; major si manque ; minor si typo cosmétique)
2. PALETTE : respect 60/30/10 ? Aucune couleur étrangère ? (major si dérive notable)
3. ADRESSE / TÉLÉPHONE : si présents, sont-ils corrects ou inventés ? (critical si hallucinés)
4. BRAND : logo Solution Phone présent, lisible, pas déformé ? (critical si absent ou faux logo Apple/Samsung)
5. LAYOUT : hiérarchie claire, lisible mobile, respiration ? (minor si moyennement équilibré)
6. PRODUIT : si un smartphone est montré, ressemble-t-il à ce qui était demandé (modèle / couleur) ? (minor si écart cosmétique)

Appelle l'outil visual_quality_check pour rendre ton verdict structuré. Sois exigeant mais juste — on vise du publiable, pas de la perfection théorique.`;
}

// ─── Cost calc ────────────────────────────────────────────────────

function calcCost(usage) {
  if (!usage) return 0;
  const inputCost = (usage.input_tokens || 0) / 1_000_000 * PRICE_INPUT_PER_M;
  const outputCost = (usage.output_tokens || 0) / 1_000_000 * PRICE_OUTPUT_PER_M;
  return (inputCost + outputCost) * EUR_PER_USD;
}

// ─── Handler ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!CLAUDE_KEY) return res.status(500).json({ error: 'ANTHROPIC_API_KEY manquant' });

  const t0 = Date.now();
  let { image_url, template_name, variables, job_id } = req.body || {};

  try {
    // Si job_id fourni : on lit tout depuis Supabase
    if (job_id && (!image_url || !template_name)) {
      const jobs = await supa('visual_jobs', 'GET', null, `?id=eq.${job_id}&select=*`);
      if (!jobs || !jobs[0]) return res.status(404).json({ error: 'Job introuvable' });
      const job = jobs[0];
      image_url = image_url || job.image_url;
      variables = variables || job.brief?.variables || {};

      if (!template_name) {
        const tpl = await supa('visual_templates', 'GET', null, `?id=eq.${job.template_id}&select=name`);
        template_name = tpl?.[0]?.name || 'unknown';
      }
    }

    if (!image_url) return res.status(400).json({ error: 'image_url ou job_id requis' });
    if (!template_name) template_name = 'unknown';
    if (!variables) variables = {};

    // 1. Charger l'image en base64
    const { base64, contentType } = await imageToBase64(image_url);

    // 2. Construire le prompt
    const promptText = buildQcPrompt(template_name, variables);

    // 3. Appeler Claude avec vision + tool forcing
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
        tools: [QC_TOOL],
        tool_choice: { type: 'tool', name: 'visual_quality_check' },
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: contentType, data: base64 } },
            { type: 'text', text: promptText }
          ]
        }]
      })
    });

    if (!claudeRes.ok) {
      const t = await claudeRes.text();
      return res.status(500).json({ error: `Claude ${claudeRes.status}: ${t.substring(0, 500)}` });
    }

    const claudeJson = await claudeRes.json();
    const toolUse = claudeJson.content?.find(c => c.type === 'tool_use');
    if (!toolUse) {
      return res.status(500).json({ error: 'Claude n\'a pas appelé l\'outil QC', raw: claudeJson });
    }

    const verdict = toolUse.input;
    const cost = calcCost(claudeJson.usage);
    const duration = Date.now() - t0;

    // 4. Sauvegarder le verdict dans visual_jobs si on a un job_id
    if (job_id) {
      try {
        await supa('visual_jobs', 'PATCH', {
          qc_verdict: verdict,
          qc_score: verdict.score,
          qc_passed: verdict.passed,
          qc_cost_eur: cost,
          qc_at: new Date().toISOString()
        }, `?id=eq.${job_id}`);
      } catch (e) {
        // les colonnes qc_* n'existent peut-être pas encore — ignore
        console.warn('[QC] PATCH visual_jobs failed (colonnes manquantes ?):', e.message);
      }
    }

    return res.status(200).json({
      ok: true,
      passed: verdict.passed,
      score: verdict.score,
      issues: verdict.issues || [],
      suggested_prompt_changes: verdict.suggested_prompt_changes || [],
      reasoning: verdict.reasoning,
      cost_eur: cost,
      duration_ms: duration,
      template_name,
      job_id: job_id || null
    });
  } catch (e) {
    console.error('[QC] error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e), duration_ms: Date.now() - t0 });
  }
}
