// /api/visual/studio-publish.js — Upload + publication directe depuis le Studio Visuel
// Solution Phone · Plan B v2 · 19 mai 2026
//
// Reçoit une image générée par Sebastien (via ChatGPT/Gemini), l'upload dans
// Supabase Storage, et la publie sur Instagram + Facebook (selon les plateformes
// choisies) via Meta Graph API.
//
// POST /api/visual/studio-publish
// Body (JSON) : {
//   image_base64: "data:image/png;base64,iVBORw0KG..." | "iVBORw0KG...",
//   platforms:    { instagram: true, facebook: true },
//   caption:      "Texte du post (≤ 2200 car)",
//   source_template: "smartphone_stock",  // optionnel, pour metadata
//   source_variables: { modele:"iPhone 17e", prix:700, ... }  // optionnel
// }
//
// Response : {
//   ok: bool,
//   uploaded_url: "https://kdvxcnj.../studio/...png",
//   results: {
//     instagram: { success, ig_post_id?, error? },
//     facebook:  { success, fb_post_id?, error? }
//   },
//   social_post_id: id de la ligne créée dans social_posts
// }

import { handleAuth } from '../_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;
const META_PAGE_TOKEN = process.env.META_PAGE_TOKEN;
const META_IG_USER_ID = process.env.META_IG_USER_ID;
const META_FB_PAGE_ID = process.env.META_FB_PAGE_ID;

async function supa(table, method, body, query) {
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

// ─── Storage upload (base64 → bucket social_media) ────────────────

async function uploadToStorage(base64, fileName) {
  // Supporte "data:image/png;base64,XXXX" ou juste "XXXX"
  const stripped = base64.includes(',') ? base64.split(',')[1] : base64;
  const buffer = Buffer.from(stripped, 'base64');
  const path = `studio/${new Date().toISOString().slice(0, 10)}/${fileName}`;
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

// ─── Publication Instagram (Meta Graph API) — Feed OU Story ───────

async function publishInstagram(mediaUrl, caption, asStory = false) {
  if (!META_PAGE_TOKEN || !META_IG_USER_ID) {
    return { success: false, error: 'META_PAGE_TOKEN ou META_IG_USER_ID manquant' };
  }
  try {
    // 1. Container média — payload différent selon Feed vs Story
    const containerBody = {
      image_url: mediaUrl,
      access_token: META_PAGE_TOKEN
    };
    if (asStory) {
      containerBody.media_type = 'STORIES';
      // Pas de caption sur les Stories (Meta l'ignore de toute façon)
    } else {
      containerBody.caption = caption || '';
    }

    const containerRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(containerBody)
      }
    );
    const containerData = await containerRes.json();
    if (!containerData.id) {
      return { success: false, error: `Container failed (${asStory?'STORY':'FEED'}): ${JSON.stringify(containerData).substring(0, 200)}` };
    }

    // 2. Publish
    const publishRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_IG_USER_ID}/media_publish`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creation_id: containerData.id,
          access_token: META_PAGE_TOKEN
        })
      }
    );
    const publishData = await publishRes.json();
    if (publishData.id) return { success: true, ig_post_id: publishData.id, as_story: asStory };
    return { success: false, error: `Publish failed: ${JSON.stringify(publishData).substring(0, 200)}` };
  } catch (e) {
    return { success: false, error: 'Meta IG exception: ' + e.message };
  }
}

// ─── Publication Facebook Feed (Meta Graph API) ──────────────────

async function publishFacebook(mediaUrl, caption) {
  if (!META_PAGE_TOKEN || !META_FB_PAGE_ID) {
    return { success: false, error: 'META_PAGE_TOKEN ou META_FB_PAGE_ID manquant' };
  }
  try {
    // Pour FB Feed, on POST sur /{page-id}/photos avec url + message pour avoir une vraie image
    const res = await fetch(
      `https://graph.facebook.com/v21.0/${META_FB_PAGE_ID}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrl,
          caption: caption || '',
          access_token: META_PAGE_TOKEN
        })
      }
    );
    const data = await res.json();
    if (data.id || data.post_id) {
      return { success: true, fb_post_id: data.post_id || data.id };
    }
    return { success: false, error: `FB photos failed: ${JSON.stringify(data).substring(0, 200)}` };
  } catch (e) {
    return { success: false, error: 'Meta FB exception: ' + e.message };
  }
}

// ─── Publication Facebook Story (Meta Graph API) ─────────────────
//   Workflow Meta : 1) upload photo unpublished → photo_id
//                   2) POST /photo_stories?photo_id=X

async function publishFacebookStory(mediaUrl) {
  if (!META_PAGE_TOKEN || !META_FB_PAGE_ID) {
    return { success: false, error: 'META_PAGE_TOKEN ou META_FB_PAGE_ID manquant' };
  }
  try {
    // 1) Upload la photo sans la publier dans le Feed
    const upRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_FB_PAGE_ID}/photos`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: mediaUrl,
          published: false,
          access_token: META_PAGE_TOKEN
        })
      }
    );
    const upData = await upRes.json();
    if (!upData.id) {
      return { success: false, error: `FB story upload failed: ${JSON.stringify(upData).substring(0, 200)}` };
    }

    // 2) Crée la Story à partir de cette photo
    const stRes = await fetch(
      `https://graph.facebook.com/v21.0/${META_FB_PAGE_ID}/photo_stories?photo_id=${upData.id}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: META_PAGE_TOKEN })
      }
    );
    const stData = await stRes.json();
    if (stData.success === true || stData.post_id || stData.id) {
      return { success: true, fb_post_id: stData.post_id || stData.id || upData.id, as_story: true };
    }
    return { success: false, error: `FB story publish failed: ${JSON.stringify(stData).substring(0, 200)}` };
  } catch (e) {
    return { success: false, error: 'Meta FB Story exception: ' + e.message };
  }
}

// ─── Handler ──────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const t0 = Date.now();
  try {
    const { image_base64, image_url: reuseUrl, platforms = {}, caption = '', source_template, source_variables } = req.body || {};

    if (!image_base64 && !reuseUrl) return res.status(400).json({ error: 'image_base64 ou image_url requis' });
    // 4 cibles possibles : ig_feed (post Insta) · ig_story (Story Insta) · fb_feed (post Facebook) · fb_story (Story Facebook)
    const wantIGFeed  = !!platforms.instagram;       // legacy alias = feed
    const wantIGStory = !!platforms.instagram_story;
    const wantFBFeed  = !!platforms.facebook;
    const wantFBStory = !!platforms.facebook_story;
    if (!wantIGFeed && !wantIGStory && !wantFBFeed && !wantFBStory) {
      return res.status(400).json({ error: 'Sélectionne au moins une cible (Feed Insta, Story Insta, Feed Facebook ou Story Facebook)' });
    }

    // 1. Upload Storage SI nouveau base64. Sinon réutilise l'URL fournie.
    let uploadedUrl;
    if (reuseUrl) {
      uploadedUrl = reuseUrl;
    } else {
      const fileName = `studio-${Date.now()}.png`;
      uploadedUrl = await uploadToStorage(image_base64, fileName);
    }

    // 2. Publish en parallèle sur les cibles demandées
    const tasks = [];
    if (wantIGFeed)  tasks.push(publishInstagram(uploadedUrl, caption, false).then(r => ({ ig_feed: r })));
    if (wantIGStory) tasks.push(publishInstagram(uploadedUrl, '',      true ).then(r => ({ ig_story: r })));
    if (wantFBFeed)  tasks.push(publishFacebook(uploadedUrl, caption).then(r => ({ fb_feed: r })));
    if (wantFBStory) tasks.push(publishFacebookStory(uploadedUrl).then(r => ({ fb_story: r })));
    const settled = await Promise.all(tasks);
    const results = {};
    settled.forEach(r => Object.assign(results, r));

    const anySuccess = (results.ig_feed?.success || results.ig_story?.success || results.fb_feed?.success || results.fb_story?.success);

    // 3. Insert social_posts (historique)
    let socialPostId = null;
    try {
      const inserted = await supa('social_posts', 'POST', {
        type: (wantIGStory || wantFBStory) ? 'story' : 'post',
        status: anySuccess ? 'published' : 'failed',
        caption,
        media_urls: [uploadedUrl],
        platforms: { instagram: wantIGFeed, instagram_story: wantIGStory, facebook: wantFBFeed, facebook_story: wantFBStory },
        auto_published: false,
        published_at: new Date().toISOString(),
        ig_post_id: results.ig_feed?.ig_post_id || results.ig_story?.ig_post_id || null,
        fb_post_id: results.fb_feed?.fb_post_id || results.fb_story?.fb_post_id || null,
        source_data: {
          source: 'studio_visuel',
          template: source_template || null,
          variables: source_variables || null,
          results
        }
      });
      socialPostId = inserted?.[0]?.id;
    } catch (e) { /* silent */ }

    return res.status(200).json({
      ok: anySuccess,
      uploaded_url: uploadedUrl,
      results,
      social_post_id: socialPostId,
      duration_ms: Date.now() - t0
    });
  } catch (e) {
    console.error('[studio-publish]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
