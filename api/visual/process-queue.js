// /api/visual/process-queue.js — Cron qui traite la queue de génération visuelle
// Solution Phone · Intégration ChatGPT (GPT-Image-1) · mai 2026
//
// Cron toutes les 15 min : récupère les visual_jobs avec status='queued',
// les processe en série (max 5 par run pour éviter les timeouts Vercel),
// en appelant /api/render/gpt-image pour chacun.
//
// Limites Vercel Serverless : 60s max par invocation → on traite 5 jobs max par run.

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const MAX_JOBS_PER_RUN = 5;

async function supa(table, method = 'GET', body = null, query = '') {
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
  const txt = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${txt.substring(0, 200)}`);
  return txt ? JSON.parse(txt) : null;
}

async function callRender(jobId, baseUrl) {
  const url = baseUrl + '/api/render/gpt-image';
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + (process.env.CRON_SECRET || '')
    },
    body: JSON.stringify({ job_id: jobId, quality: 'medium' })
  });
  const data = await r.json().catch(() => ({ ok: false, error: 'json parse' }));
  return { http_ok: r.ok, data };
}

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;

  const t0 = Date.now();
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'https://app.solution-phone.fr';

  try {
    // 1. Récupère les jobs en attente (max MAX_JOBS_PER_RUN)
    const jobs = await supa('visual_jobs', 'GET', null,
      `?status=eq.queued&order=created_at.asc&limit=${MAX_JOBS_PER_RUN}&select=id,decision_id,created_at,retries`);

    if (!Array.isArray(jobs) || jobs.length === 0) {
      return res.status(200).json({ ok: true, processed: 0, duration_ms: Date.now() - t0 });
    }

    const results = [];
    let okCount = 0, errCount = 0;

    // 2. Traite en série (pas en parallèle pour respecter le budget OpenAI + timeout Vercel)
    for (const job of jobs) {
      const jobStart = Date.now();
      try {
        const r = await callRender(job.id, baseUrl);
        if (r.http_ok && r.data?.ok) {
          okCount++;
          results.push({
            job_id: job.id, status: 'ok',
            image_url: r.data.image_url, cost_eur: r.data.cost_eur,
            duration_ms: Date.now() - jobStart
          });
        } else {
          errCount++;
          results.push({
            job_id: job.id, status: 'error',
            error: r.data?.error || 'unknown',
            duration_ms: Date.now() - jobStart
          });
        }
      } catch (e) {
        errCount++;
        results.push({ job_id: job.id, status: 'exception', error: String(e.message || e) });
      }

      // Stop net si on approche 50s (Vercel timeout 60s)
      if (Date.now() - t0 > 50000) {
        results.push({ stopped_early: true, remaining: jobs.length - results.length });
        break;
      }
    }

    return res.status(200).json({
      ok: true,
      processed: results.length,
      ok_count: okCount,
      err_count: errCount,
      duration_ms: Date.now() - t0,
      results
    });
  } catch (e) {
    console.error('[process-queue] error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
