// /api/visual/library-upload.js — Upload manuel dans la bibliothèque
// Solution Phone · 19 mai 2026
//
// Permet à Sebastien d'importer ses propres visuels (Canva, photos boutique,
// archives, etc.) directement dans la bibliothèque du Cockpit Assya.
//
// POST /api/visual/library-upload
// Body : {
//   image_base64: "data:image/png;base64,..." | base64 brut,
//   format_hint: "1080x1080" | "1080x1920" | etc. (optionnel),
//   label: "Nom du visuel" (optionnel — pour identification dans la bibliothèque)
// }
//
// Effet :
//   1. Upload dans Supabase Storage bucket social_media/library/{date}/...
//   2. Insère une row dans visual_jobs avec status='ready' (apparaît immédiatement
//      dans la bibliothèque du Cockpit)
//   3. Retourne { ok, image_url, job_id }

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

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
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${text.substring(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

async function uploadToStorage(base64, path) {
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(stripped, 'base64');
  const url = `${SUPA_URL}/storage/v1/object/social_media/${path}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'image/png',
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Upload Storage ${res.status}: ${t.substring(0, 200)}`);
  }
  return `${SUPA_URL}/storage/v1/object/public/social_media/${path}`;
}

// Detecte un format hint à partir de dimensions (si fournies côté client)
function normalizeFormat(hint, width, height){
  if (hint) return hint;
  if (!width || !height) return '1080x1080';
  const ratio = height / width;
  if (Math.abs(ratio - 1) < 0.1) return '1080x1080';
  if (ratio >= 1.7) return '1080x1920';     // 9:16
  if (ratio >= 1.2) return '1080x1350';      // 4:5
  if (ratio <= 0.6) return '1200x628';       // paysage 16:9 ~
  return `${width}x${height}`;
}

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const t0 = Date.now();
  try {
    const { image_base64, format_hint, width, height, label } = req.body || {};
    if (!image_base64) return res.status(400).json({ error: 'image_base64 requis' });

    // 1. Upload Storage
    const date = new Date().toISOString().slice(0, 10);
    const filename = `library/${date}/upload-${Date.now()}.png`;
    const publicUrl = await uploadToStorage(image_base64, filename);

    const format = normalizeFormat(format_hint, width, height);

    // 2. Insert visual_jobs (status=ready → apparaît dans la bibliothèque)
    const inserted = await supa('visual_jobs', 'POST', {
      status: 'ready',
      image_url: publicUrl,
      image_path: `social_media/${filename}`,
      brief: {
        format: format,
        kind: 'manual_upload',
        source: 'library_upload',
        label: label || null,
        uploaded_at: new Date().toISOString()
      },
      processed_at: new Date().toISOString(),
      cost_eur: 0
    });

    const jobId = inserted?.[0]?.id;

    return res.status(200).json({
      ok: true,
      image_url: publicUrl,
      job_id: jobId,
      format: format,
      duration_ms: Date.now() - t0
    });
  } catch (e) {
    console.error('[library-upload]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
