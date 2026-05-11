// /api/render/gpt-image.js — Rendu visuel via OpenAI GPT-Image-1
// Solution Phone · Intégration ChatGPT (studio de rendu) · mai 2026
//
// Appelle l'API OpenAI Images pour générer un visuel premium à partir d'un brief
// fourni par Assya. Upload le résultat dans Supabase Storage bucket `social_media`.
// Met à jour le coût dans ai_budget.
//
// Workflow attendu :
//   1. /api/visual/process-queue appelle cet endpoint avec un job_id
//   2. On charge le job + template depuis Supabase
//   3. On assemble le prompt final avec interpolation des variables
//   4. On appelle OpenAI Images API (image-to-image si références)
//   5. On upload le résultat dans Storage
//   6. On met à jour visual_jobs (status=ready, image_url, cost_eur)
//   7. On incrémente ai_budget
//   8. On met à jour agent_decision (payload.image_url, status=pending_validation)

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const OPENAI_KEY = process.env.OPENAI_API_KEY;

// Tarifs GPT-Image-1 (mai 2026)
const OPENAI_PRICES_EUR = {
  '1024x1024_low':    0.011,
  '1024x1024_medium': 0.042,
  '1024x1024_high':   0.167,
  '1024x1536_low':    0.016,
  '1024x1536_medium': 0.063,
  '1024x1536_high':   0.250,
  '1536x1024_low':    0.016,
  '1536x1024_medium': 0.063,
  '1536x1024_high':   0.250
};

const FORMAT_MAP = {
  '1080x1080': '1024x1024',    // post carré
  '1080x1920': '1024x1536',    // story / reel vertical
  '1080x1566': '1024x1536',    // post portrait
  '1080x566':  '1536x1024',    // post paysage
  '1080x1350': '1024x1536'     // reel/story portrait
};

// ─── HELPERS SUPABASE ──────────────────────────────────────────

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
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${txt.substring(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function supaUploadImage(buffer, path, contentType = 'image/png') {
  const url = `${SUPA_URL}/storage/v1/object/social_media/${path}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Upload Storage ${r.status}: ${t.substring(0, 300)}`);
  }
  // URL publique
  return `${SUPA_URL}/storage/v1/object/public/social_media/${path}`;
}

// ─── BUDGET CHECK ─────────────────────────────────────────────

async function checkBudget(model, estimatedCostEur) {
  try {
    const capsRow = await supa('agent_memory', 'GET', null, '?key=eq.ai_budget_caps&select=value');
    const caps = (capsRow && capsRow[0]) ? capsRow[0].value : null;
    if (!caps || !caps.stop_on_cap) return { ok: true };

    const today = new Date().toISOString().slice(0, 10);
    const budget = await supa('ai_budget', 'GET', null,
      `?day=eq.${today}&select=model,cost_eur`);
    if (!Array.isArray(budget)) return { ok: true };

    const totalToday = budget.reduce((s, b) => s + Number(b.cost_eur || 0), 0);
    const modelToday = budget.find(b => b.model === model)?.cost_eur || 0;

    if (totalToday + estimatedCostEur > caps.daily_total_cap_eur) {
      return { ok: false, reason: `Cap quotidien total ${caps.daily_total_cap_eur}€ dépassé (actuel: ${totalToday.toFixed(2)}€)` };
    }
    const modelCap = caps.per_model_cap_eur?.[model];
    if (modelCap && Number(modelToday) + estimatedCostEur > modelCap) {
      return { ok: false, reason: `Cap ${model} ${modelCap}€ dépassé (actuel: ${Number(modelToday).toFixed(2)}€)` };
    }
    return { ok: true };
  } catch (e) {
    console.warn('[budget] check failed:', e.message);
    return { ok: true }; // fail-open : pas bloquer en cas d'erreur de lecture
  }
}

async function trackBudget(model, costEur, requests = 1) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const existing = await supa('ai_budget', 'GET', null,
      `?day=eq.${today}&model=eq.${encodeURIComponent(model)}&select=id,cost_eur,requests_count`);
    if (existing && existing[0]) {
      await supa('ai_budget', 'PATCH',
        { cost_eur: Number(existing[0].cost_eur) + costEur, requests_count: existing[0].requests_count + requests },
        `?id=eq.${existing[0].id}`);
    } else {
      await supa('ai_budget', 'POST', { day: today, model, cost_eur: costEur, requests_count: requests });
    }
  } catch (e) {
    console.warn('[budget] track failed:', e.message);
  }
}

// ─── PROMPT BUILDER ───────────────────────────────────────────

function buildPrompt(template, variables) {
  let prompt = template.base_prompt || '';
  // Interpolation : remplace {variable} par la valeur
  Object.keys(variables || {}).forEach(k => {
    const value = variables[k] != null ? String(variables[k]) : '';
    prompt = prompt.replace(new RegExp(`\\{${k}\\}`, 'g'), value);
  });
  return prompt;
}

// ─── OPENAI CALL ──────────────────────────────────────────────

async function callOpenAI(prompt, openAiSize, quality = 'medium', referenceImageUrls = []) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY manquant');

  // Cas 1 : avec références → image-to-image via /v1/images/edits
  // Cas 2 : sans référence → /v1/images/generations
  const endpoint = referenceImageUrls.length > 0
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  let body, headers;
  if (referenceImageUrls.length > 0) {
    // multipart/form-data pour /images/edits
    const formData = new FormData();
    formData.append('model', 'gpt-image-1');
    formData.append('prompt', prompt);
    formData.append('size', openAiSize);
    formData.append('quality', quality);
    formData.append('n', '1');
    // Charger les images référence
    for (let i = 0; i < referenceImageUrls.length && i < 4; i++) {
      try {
        const imgRes = await fetch(referenceImageUrls[i]);
        const imgBuf = await imgRes.arrayBuffer();
        formData.append('image[]', new Blob([imgBuf], { type: 'image/png' }), `ref-${i}.png`);
      } catch (e) {
        console.warn(`[openai] référence ${i} non chargée:`, e.message);
      }
    }
    body = formData;
    headers = { 'Authorization': `Bearer ${OPENAI_KEY}` };
  } else {
    body = JSON.stringify({
      model: 'gpt-image-1',
      prompt,
      size: openAiSize,
      quality,
      n: 1
    });
    headers = {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  const r = await fetch(endpoint, { method: 'POST', headers, body });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`OpenAI ${r.status}: ${t.substring(0, 500)}`);
  }
  const data = await r.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI : pas de b64_json dans la réponse');
  return Buffer.from(b64, 'base64');
}

// ─── HANDLER ──────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { job_id, quality = 'medium' } = req.body || {};
  if (!job_id) return res.status(400).json({ error: 'job_id requis' });

  const t0 = Date.now();
  let job;

  try {
    // 1. Récupère le job
    const jobs = await supa('visual_jobs', 'GET', null, `?id=eq.${job_id}&select=*`);
    if (!jobs || !jobs[0]) throw new Error('Job introuvable');
    job = jobs[0];

    if (job.status === 'ready') {
      return res.status(200).json({ ok: true, already_ready: true, image_url: job.image_url });
    }
    if (job.status === 'processing') {
      return res.status(409).json({ ok: false, error: 'Job déjà en cours' });
    }

    // 2. Récupère le template
    const templates = await supa('visual_templates', 'GET', null, `?id=eq.${job.template_id}&select=*`);
    if (!templates || !templates[0]) throw new Error('Template introuvable');
    const template = templates[0];

    // 3. Récupère les références (visual_assets)
    let referenceUrls = [];
    if (Array.isArray(template.reference_asset_ids) && template.reference_asset_ids.length > 0) {
      const refs = await supa('visual_assets', 'GET', null,
        `?id=in.(${template.reference_asset_ids.join(',')})&active=eq.true&select=file_url`);
      if (Array.isArray(refs)) referenceUrls = refs.map(r => r.file_url).filter(Boolean);
    }

    // 4. Marque processing
    await supa('visual_jobs', 'PATCH', { status: 'processing' }, `?id=eq.${job_id}`);

    // 5. Assemble le prompt
    const variables = job.brief?.variables || {};
    const promptBuilt = buildPrompt(template, variables);

    // 6. Map format vers taille OpenAI
    const format = job.brief?.format || template.format || '1080x1080';
    const openAiSize = FORMAT_MAP[format] || '1024x1024';

    // 7. Check budget
    const priceKey = `${openAiSize}_${quality}`;
    const estimatedCost = OPENAI_PRICES_EUR[priceKey] || 0.05;
    const budgetCheck = await checkBudget('gpt-image-1', estimatedCost);
    if (!budgetCheck.ok) {
      await supa('visual_jobs', 'PATCH',
        { status: 'failed', error_msg: 'Budget cap : ' + budgetCheck.reason },
        `?id=eq.${job_id}`);
      throw new Error(budgetCheck.reason);
    }

    // 8. Appel OpenAI
    const imageBuffer = await callOpenAI(promptBuilt, openAiSize, quality, referenceUrls);

    // 9. Upload Storage
    const today = new Date().toISOString().slice(0, 10);
    const fileName = `${today}/job-${job_id}.png`;
    const imageUrl = await supaUploadImage(imageBuffer, fileName);

    // 10. Update job ready
    const renderDuration = Date.now() - t0;
    await supa('visual_jobs', 'PATCH', {
      status: 'ready',
      prompt_built: promptBuilt,
      reference_urls: referenceUrls,
      image_url: imageUrl,
      image_path: `social_media/${fileName}`,
      render_duration_ms: renderDuration,
      cost_eur: estimatedCost,
      processed_at: new Date().toISOString()
    }, `?id=eq.${job_id}`);

    // 11. Budget tracking
    await trackBudget('gpt-image-1', estimatedCost);

    // 12. Update agent_decision : ajout image_url + passe en pending_validation
    if (job.decision_id) {
      const decisions = await supa('agent_decisions', 'GET', null,
        `?id=eq.${job.decision_id}&select=payload`);
      const dec = decisions?.[0];
      const newPayload = { ...(dec?.payload || {}), image_url: imageUrl, image_path: fileName };
      await supa('agent_decisions', 'PATCH',
        { payload: newPayload, status: 'pending_validation' },
        `?id=eq.${job.decision_id}`);
    }

    // 13. Increment template usage
    await supa('visual_templates', 'PATCH',
      { last_used_at: new Date().toISOString() },
      `?id=eq.${template.id}`);

    return res.status(200).json({
      ok: true,
      job_id,
      image_url: imageUrl,
      duration_ms: renderDuration,
      cost_eur: estimatedCost
    });
  } catch (e) {
    console.error('[gpt-image] error:', e);
    if (job?.id) {
      const retries = (job.retries || 0) + 1;
      await supa('visual_jobs', 'PATCH', {
        status: retries >= 3 ? 'failed' : 'queued',
        error_msg: String(e.message || e).substring(0, 500),
        retries
      }, `?id=eq.${job.id}`).catch(() => {});
    }
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
