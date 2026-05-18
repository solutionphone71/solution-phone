// /api/render/compose.jsx — Compositing HTML overlay sur image IA
// Solution Phone · Route B · 18 mai 2026
//
// L'IA gpt-image-1 a généré l'ambiance (fond + smartphone hero).
// Cet endpoint y SUPERPOSE en pixel-perfect :
//   - le logo Solution Phone (PNG net)
//   - les textes exacts (modèle, prix, adresse, téléphone)
//   - les bullet lists (engagements)
//   - les bandeaux rouges
//
// Tech : @vercel/og (Satori) en Edge runtime → rendu HTML→PNG ultra rapide.
//
// USAGE :
//   GET  /api/render/compose?job_id=1     → renvoie la PNG composée directement
//   POST /api/render/compose { job_id: 1, upload: true }
//        → compose + upload Storage + update visual_jobs.composed_image_url
//
// V1 : un seul layout supporté (new_phone_carre). Layouts suivants = même pattern.

import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

// Logo officiel Solution Phone (uploadé dans Supabase Storage 'visual_assets')
const LOGO_URL = `${SUPA_URL}/storage/v1/object/public/visual_assets/kit/logo-officiel.jpg`;

// Polices Montserrat — JSDelivr (mirror stable de Google Fonts)
const FONT_MONTSERRAT_800 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-ExtraBold.ttf';
const FONT_MONTSERRAT_700 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-Bold.ttf';
const FONT_MONTSERRAT_400 = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/montserrat/static/Montserrat-Regular.ttf';

async function safeLoadFont(url) {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.arrayBuffer();
  } catch { return null; }
}

// ─── Layout par défaut : new_phone_carre ──────────────────────────
// (En v2 on lira depuis brand/layouts/*.json à la place)

function interpolate(str, vars) {
  return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? vars[k] : ''));
}

// ─── Composant principal du visuel composé ────────────────────────

function ComposedVisual({ aiImageUrl, vars }) {
  return (
    <div style={{
      width: '1080px',
      height: '1080px',
      position: 'relative',
      display: 'flex',
      fontFamily: 'Montserrat'
    }}>
      {/* Layer 0 — Image IA en arrière-plan */}
      <img
        src={aiImageUrl}
        width="1080"
        height="1080"
        style={{ position: 'absolute', top: 0, left: 0 }}
      />

      {/* Layer 1 — Voile noir gauche pour la zone texte (assure la lisibilité) */}
      <div style={{
        position: 'absolute', top: 0, left: 0, width: 580, height: 1080,
        background: 'linear-gradient(90deg, rgba(13,13,13,0.85) 0%, rgba(13,13,13,0.55) 70%, rgba(13,13,13,0) 100%)'
      }} />

      {/* Layer 2 — Logo Solution Phone */}
      <img
        src={LOGO_URL}
        width="140"
        height="140"
        style={{ position: 'absolute', top: 60, left: 60, borderRadius: 22 }}
      />

      {/* Layer 3 — Badge "NOUVEAU EN STOCK" */}
      <div style={{
        position: 'absolute', top: 90, right: 60,
        padding: '12px 28px',
        background: '#E10600',
        color: '#FFFFFF',
        fontSize: 26,
        fontWeight: 800,
        borderRadius: 40,
        letterSpacing: 1
      }}>NOUVEAU EN STOCK</div>

      {/* Layer 4 — Modèle */}
      <div style={{
        position: 'absolute', top: 280, left: 60,
        maxWidth: 520,
        color: '#FFFFFF',
        fontSize: 78,
        fontWeight: 800,
        lineHeight: 1
      }}>{vars.modele || 'iPhone'}</div>

      {/* Layer 5 — Prix */}
      <div style={{
        position: 'absolute', top: 400, left: 60,
        color: '#E10600',
        fontSize: 150,
        fontWeight: 800,
        lineHeight: 1
      }}>{vars.prix || 0} €</div>

      {/* Layer 6 — Bullet list engagements */}
      <div style={{
        position: 'absolute', top: 620, left: 60,
        display: 'flex', flexDirection: 'column',
        gap: 14
      }}>
        {[
          `GRADE ${vars.grade || 'A'}`,
          `BATTERIE ${vars.batterie ?? 92}%`,
          'ÉTAT EXCELLENT',
          'GARANTIE 6 MOIS',
          'PIÈCES TESTÉES'
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 12, height: 12, borderRadius: 6, background: '#E10600' }} />
            <div style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 700, letterSpacing: 1 }}>{item}</div>
          </div>
        ))}
      </div>

      {/* Layer 7 — Bandeau rouge */}
      <div style={{
        position: 'absolute', bottom: 60, left: 0, width: 1080,
        height: 44,
        background: '#E10600',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 800,
        letterSpacing: 3
      }}>RÉPARATION · ACCESSOIRES · ACHAT · REVENTE</div>

      {/* Layer 8 — Adresse / téléphone */}
      <div style={{
        position: 'absolute', bottom: 22, left: 0, width: 1080,
        display: 'flex', justifyContent: 'center',
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: 400,
        letterSpacing: 1
      }}>21 RUE GAMBETTA — 71000 MÂCON — 03 85 33 06 89</div>
    </div>
  );
}

// ─── Handler ──────────────────────────────────────────────────────

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

    // 1. Lecture du job dans Supabase
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
      return new Response(JSON.stringify({ error: 'image_url manquante sur ce job (génération IA pas encore faite)' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    const vars = job.brief?.variables || {};

    // 2. Charger les polices Montserrat (fallback gracieux si CDN down)
    const [font800, font700, font400] = await Promise.all([
      safeLoadFont(FONT_MONTSERRAT_800),
      safeLoadFont(FONT_MONTSERRAT_700),
      safeLoadFont(FONT_MONTSERRAT_400)
    ]);

    const fonts = [];
    if (font400) fonts.push({ name: 'Montserrat', data: font400, weight: 400, style: 'normal' });
    if (font700) fonts.push({ name: 'Montserrat', data: font700, weight: 700, style: 'normal' });
    if (font800) fonts.push({ name: 'Montserrat', data: font800, weight: 800, style: 'normal' });

    // 3. Rendu HTML→PNG via @vercel/og
    const renderOptions = { width: 1080, height: 1080 };
    if (fonts.length > 0) renderOptions.fonts = fonts;

    const imageResponse = new ImageResponse(
      <ComposedVisual aiImageUrl={aiImageUrl} vars={vars} />,
      renderOptions
    );

    // 4. Si upload demandé : push dans Supabase Storage + update visual_jobs
    if (shouldUpload) {
      const pngBuffer = await imageResponse.arrayBuffer();
      const today = new Date().toISOString().slice(0, 10);
      const path = `composed/${today}/job-${job_id}.png`;
      const uploadUrl = `${SUPA_URL}/storage/v1/object/social_media/${path}`;
      const uploadRes = await fetch(uploadUrl, {
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
        return new Response(JSON.stringify({ error: `Upload échec: ${uploadRes.status} ${t.slice(0, 200)}` }), {
          status: 500, headers: { 'Content-Type': 'application/json' }
        });
      }
      const composedUrl = `${SUPA_URL}/storage/v1/object/public/social_media/${path}`;

      // Met à jour visual_jobs avec la nouvelle URL composée
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

    // Pas d'upload : on renvoie directement la PNG
    return imageResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e.message || e) }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
