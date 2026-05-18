// /api/render/compose.js — Compositing HTML overlay sur image IA
// Solution Phone · Route B · 18 mai 2026 (v2 — .js sans JSX)
//
// L'IA gpt-image-1 a généré l'ambiance (fond + smartphone hero).
// Cet endpoint SUPERPOSE en pixel-perfect via Satori (@vercel/og) :
//   - le logo Solution Phone
//   - les textes exacts (modèle, prix, adresse, téléphone)
//   - les bullet lists (engagements)
//   - les bandeaux rouges
//
// Format des éléments : objets purs `{ type, props: { style, children } }`
// — c'est ce que Satori comprend nativement, pas besoin de JSX/React.
//
// USAGE :
//   GET  /api/render/compose?job_id=1               → renvoie la PNG directement
//   GET  /api/render/compose?job_id=1&upload=true   → upload Storage + update visual_jobs

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

const LOGO_URL = `${SUPA_URL}/storage/v1/object/public/visual_assets/kit/logo-officiel.jpg`;

const FONT_800 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-ExtraBold.ttf';
const FONT_700 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-Bold.ttf';
const FONT_400 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-Regular.ttf';

// Helper : crée un nœud Satori sans JSX
function el(type, style, children) {
  return { type, props: { style: style || {}, children: children === undefined ? null : children } };
}

async function safeLoadFont(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch { return null; }
}

// Construit la composition complète pour le template new_phone_carre
function buildComposition(aiImageUrl, vars) {
  const children = [];

  // Layer 0 — Image IA en fond
  children.push(el('img', {
    src: aiImageUrl,
    width: 1080, height: 1080,
    position: 'absolute', top: 0, left: 0
  }));

  // Layer 1 — Voile noir gauche (lisibilité texte)
  children.push(el('div', {
    position: 'absolute', top: 0, left: 0, width: 580, height: 1080,
    background: 'linear-gradient(90deg, rgba(13,13,13,0.85) 0%, rgba(13,13,13,0.55) 70%, rgba(13,13,13,0) 100%)'
  }));

  // Layer 2 — Logo Solution Phone
  children.push(el('img', {
    src: LOGO_URL,
    width: 140, height: 140,
    position: 'absolute', top: 60, left: 60, borderRadius: 22
  }));

  // Layer 3 — Badge "NOUVEAU EN STOCK"
  children.push(el('div', {
    position: 'absolute', top: 90, right: 60,
    padding: '12px 28px',
    background: '#E10600',
    color: '#FFFFFF',
    fontSize: 26, fontWeight: 800,
    borderRadius: 40,
    letterSpacing: 1,
    display: 'flex'
  }, 'NOUVEAU EN STOCK'));

  // Layer 4 — Modèle
  children.push(el('div', {
    position: 'absolute', top: 280, left: 60,
    maxWidth: 520,
    color: '#FFFFFF',
    fontSize: 78, fontWeight: 800,
    lineHeight: 1,
    display: 'flex'
  }, vars.modele || 'iPhone'));

  // Layer 5 — Prix
  children.push(el('div', {
    position: 'absolute', top: 400, left: 60,
    color: '#E10600',
    fontSize: 150, fontWeight: 800,
    lineHeight: 1,
    display: 'flex'
  }, `${vars.prix || 0} €`));

  // Layer 6 — Bullet list engagements
  const items = [
    `GRADE ${vars.grade || 'A'}`,
    `BATTERIE ${vars.batterie != null ? vars.batterie : 92}%`,
    'ÉTAT EXCELLENT',
    'GARANTIE 6 MOIS',
    'PIÈCES TESTÉES'
  ];
  const bulletChildren = items.map(text =>
    el('div', { display: 'flex', alignItems: 'center', gap: 14 }, [
      el('div', { width: 12, height: 12, borderRadius: 6, background: '#E10600' }),
      el('div', { color: '#FFFFFF', fontSize: 26, fontWeight: 700, letterSpacing: 1, display: 'flex' }, text)
    ])
  );
  children.push(el('div', {
    position: 'absolute', top: 620, left: 60,
    display: 'flex', flexDirection: 'column', gap: 14
  }, bulletChildren));

  // Layer 7 — Bandeau rouge
  children.push(el('div', {
    position: 'absolute', bottom: 60, left: 0, width: 1080, height: 44,
    background: '#E10600',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: 18, fontWeight: 800,
    letterSpacing: 3
  }, 'RÉPARATION · ACCESSOIRES · ACHAT · REVENTE'));

  // Layer 8 — Adresse / téléphone
  children.push(el('div', {
    position: 'absolute', bottom: 22, left: 0, width: 1080,
    display: 'flex', justifyContent: 'center',
    color: '#FFFFFF',
    fontSize: 18, fontWeight: 400,
    letterSpacing: 1
  }, '21 RUE GAMBETTA — 71000 MÂCON — 03 85 33 06 89'));

  // Container racine
  return el('div', {
    width: 1080, height: 1080,
    position: 'relative',
    display: 'flex',
    fontFamily: 'Montserrat'
  }, children);
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    let job_id = url.searchParams.get('job_id');
    let shouldUpload = url.searchParams.get('upload') === 'true';

    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      job_id = job_id || body.job_id;
      shouldUpload = shouldUpload || !!body.upload;
    }

    if (!job_id) {
      return new Response(JSON.stringify({ error: 'job_id requis' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // 1. Lecture du job
    const jobRes = await fetch(`${SUPA_URL}/rest/v1/visual_jobs?id=eq.${job_id}&select=*`, {
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    });
    const jobs = await jobRes.json();
    if (!Array.isArray(jobs) || !jobs[0]) {
      return new Response(JSON.stringify({ error: 'Job introuvable' }), {
        status: 404, headers: { 'Content-Type': 'application/json' }
      });
    }
    const job = jobs[0];
    const aiImageUrl = job.image_url;
    if (!aiImageUrl) {
      return new Response(JSON.stringify({ error: 'image_url manquante (IA pas encore générée)' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }
    const vars = job.brief?.variables || {};

    // 2. Charger les polices Montserrat (fallback gracieux)
    const [f800, f700, f400] = await Promise.all([
      safeLoadFont(FONT_800),
      safeLoadFont(FONT_700),
      safeLoadFont(FONT_400)
    ]);
    const fonts = [];
    if (f400) fonts.push({ name: 'Montserrat', data: f400, weight: 400, style: 'normal' });
    if (f700) fonts.push({ name: 'Montserrat', data: f700, weight: 700, style: 'normal' });
    if (f800) fonts.push({ name: 'Montserrat', data: f800, weight: 800, style: 'normal' });

    // 3. Composition + rendu PNG
    const element = buildComposition(aiImageUrl, vars);
    const renderOptions = { width: 1080, height: 1080 };
    if (fonts.length > 0) renderOptions.fonts = fonts;
    const imageResponse = new ImageResponse(element, renderOptions);

    // 4. Optionnel : upload Storage + maj visual_jobs
    if (shouldUpload) {
      const pngBuffer = await imageResponse.arrayBuffer();
      const today = new Date().toISOString().slice(0, 10);
      const path = `composed/${today}/job-${job_id}.png`;
      const uploadRes = await fetch(`${SUPA_URL}/storage/v1/object/social_media/${path}`, {
        method: 'POST',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'image/png',
          'x-upsert': 'true'
        },
        body: pngBuffer
      });
      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        return new Response(JSON.stringify({ error: `Upload ${uploadRes.status}: ${t.slice(0, 200)}` }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }
      const composedUrl = `${SUPA_URL}/storage/v1/object/public/social_media/${path}`;
      await fetch(`${SUPA_URL}/rest/v1/visual_jobs?id=eq.${job_id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPA_KEY,
          Authorization: `Bearer ${SUPA_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal'
        },
        body: JSON.stringify({ composed_image_url: composedUrl })
      }).catch(() => {});
      return new Response(JSON.stringify({
        ok: true,
        job_id: Number(job_id),
        composed_image_url: composedUrl,
        ai_image_url: aiImageUrl
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    return imageResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e), stack: String(e.stack || '').slice(0, 500) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
