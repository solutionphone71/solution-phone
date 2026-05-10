// /api/upload-media.js — Upload photo/vidéo vers Supabase Storage
// Solution Phone · Module 1 · mai 2026
//
// Le client envoie un fichier en base64 (JSON), on l'upload vers
// le bucket 'media' Supabase, on retourne l'URL publique.
//
// POST /api/upload-media
// Body: { filename: "photo.jpg", contentType: "image/jpeg", data: "base64...", folder: "phones" }
// Returns: { success: true, url: "https://...supabase.co/storage/v1/object/public/media/phones/..." }

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  const { filename, contentType, data, folder = 'misc' } = req.body || {};

  if (!filename || !contentType || !data) {
    return res.status(400).json({ error: 'filename, contentType et data (base64) requis' });
  }

  // Limiter les types acceptés
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
  if (!allowed.includes(contentType)) {
    return res.status(400).json({ error: `Type non autorisé: ${contentType}` });
  }

  try {
    // Décoder le base64
    const base64Data = data.replace(/^data:[^;]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Limite 50 Mo
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(413).json({ error: 'Fichier trop gros (max 50 Mo)' });
    }

    // Path sécurisé : folder/timestamp_filename
    const safeFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_').substring(0, 80);
    const safeFolder = folder.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 30);
    const timestamp = Date.now();
    const path = `${safeFolder}/${timestamp}_${safeFilename}`;

    // Upload vers Supabase Storage
    const uploadUrl = `${SUPA_URL}/storage/v1/object/media/${path}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(uploadRes.status).json({
        success: false,
        error: `Supabase Storage ${uploadRes.status}: ${errText.substring(0, 300)}`
      });
    }

    // URL publique
    const publicUrl = `${SUPA_URL}/storage/v1/object/public/media/${path}`;

    return res.status(200).json({
      success: true,
      url: publicUrl,
      path,
      size: buffer.length,
      contentType
    });

  } catch (err) {
    console.error('Upload error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// Vercel : augmenter le body limit pour les uploads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '60mb'
    }
  }
};
