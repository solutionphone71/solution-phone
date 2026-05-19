// /api/visual/library-delete.js — Suppression d'un visuel de la bibliothèque
// Solution Phone · 19 mai 2026
//
// Supprime un visuel à 3 niveaux :
//   1. Supabase Storage (le fichier .png lui-même)
//   2. visual_jobs (la trace de la génération / upload)
//   3. social_posts (l'historique de publication local — ne touche PAS Insta/FB)
//
// POST /api/visual/library-delete
// Body : { image_url: "https://..." }  ou  { job_id: 42 }
//
// Réponse : {
//   ok: bool,
//   deleted: { storage, visual_jobs, social_posts },  // booleans par étape
//   url, path
// }

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
      Prefer: method === 'GET' ? '' : 'return=minimal'
    },
    body: body ? JSON.stringify(body) : null
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Supabase ${method} ${table} ${r.status}: ${text.substring(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

// Extrait le path Storage à partir d'une URL publique Supabase Storage
// Ex: https://xxx.supabase.co/storage/v1/object/public/social_media/library/2026-05-19/upload-1.png
//   → path = library/2026-05-19/upload-1.png  (bucket = social_media)
function extractPath(url) {
  if (!url) return null;
  const match = url.match(/\/storage\/v1\/object\/(?:public\/)?([^/]+)\/(.+)$/);
  if (!match) return null;
  return { bucket: match[1], path: match[2] };
}

async function deleteFromStorage(bucket, path) {
  const url = `${SUPA_URL}/storage/v1/object/${bucket}/${path}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  });
  // 200, 204 ou 404 = on considère OK (déjà supprimé)
  return res.ok || res.status === 404;
}

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ error: 'POST/DELETE only' });

  try {
    const { image_url, job_id } = req.body || {};
    if (!image_url && !job_id) return res.status(400).json({ error: 'image_url ou job_id requis' });

    let url = image_url;

    // Si job_id fourni mais pas d'URL, on lit la row pour récupérer l'URL
    if (job_id && !url) {
      const rows = await fetch(`${SUPA_URL}/rest/v1/visual_jobs?id=eq.${job_id}&select=image_url`, {
        headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
      }).then(r => r.json());
      url = rows?.[0]?.image_url;
    }

    const result = {
      url: url,
      deleted: { storage: false, visual_jobs: false, social_posts: false }
    };

    // 1. Storage delete
    if (url) {
      const parsed = extractPath(url);
      if (parsed) {
        try {
          result.deleted.storage = await deleteFromStorage(parsed.bucket, parsed.path);
          result.path = `${parsed.bucket}/${parsed.path}`;
        } catch (e) {
          result.storage_error = e.message;
        }
      }
    }

    // 2. Supprime les rows visual_jobs qui pointent vers cette URL
    if (url) {
      try {
        await supa('visual_jobs', 'DELETE', null, `?image_url=eq.${encodeURIComponent(url)}`);
        result.deleted.visual_jobs = true;
      } catch (e) {
        result.visual_jobs_error = e.message;
      }
    } else if (job_id) {
      try {
        await supa('visual_jobs', 'DELETE', null, `?id=eq.${job_id}`);
        result.deleted.visual_jobs = true;
      } catch (e) {
        result.visual_jobs_error = e.message;
      }
    }

    // 3. Supprime les rows social_posts qui référencent cette image dans media_urls
    //    (PostgREST contient operator @cs (contains) sur les arrays)
    if (url) {
      try {
        // media_urls @> ARRAY[url]
        await supa('social_posts', 'DELETE', null, `?media_urls=cs.{${encodeURIComponent('"'+url+'"')}}`);
        result.deleted.social_posts = true;
      } catch (e) {
        result.social_posts_error = e.message;
      }
    }

    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    console.error('[library-delete]', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
