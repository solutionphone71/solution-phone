// /api/supabase-storage.js — Proxy Supabase Storage pour uploads d'images
// Lit le body en raw stream (sans body parser) pour préserver les octets binaires

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

export const config = {
  api: { bodyParser: false }
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-upsert');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

  if (!SUPA_URL || !SUPA_KEY) {
    console.error('[supabase-storage] ENV manquant: SUPABASE_URL/KEY');
    return res.status(500).json({ error: 'Config serveur incomplète (SUPABASE_URL/KEY manquants)' });
  }

  const { bucket, fileName } = req.query;
  if (!bucket || !fileName) {
    return res.status(400).json({ error: 'Parametres bucket et fileName requis' });
  }

  // Buckets autorises
  const ALLOWED_BUCKETS = ['photos', 'phones', 'reparations', 'phone-photos'];
  if (!ALLOWED_BUCKETS.includes(bucket)) {
    return res.status(403).json({ error: 'Bucket non autorise: ' + bucket });
  }

  try {
    const bodyBuf = await readRawBody(req);
    if (!bodyBuf || !bodyBuf.length) {
      return res.status(400).json({ error: 'Body vide' });
    }
    console.log('[supabase-storage] Upload', bucket, fileName, bodyBuf.length, 'bytes');

    const response = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': req.headers['content-type'] || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: bodyBuf
    });

    if (response.ok) {
      const publicUrl = `${SUPA_URL}/storage/v1/object/public/${bucket}/${fileName}`;
      console.log('[supabase-storage] OK →', publicUrl);
      return res.status(200).json({ url: publicUrl });
    } else {
      const errText = await response.text();
      console.error('[supabase-storage] Supabase refuse', response.status, errText);
      return res.status(response.status).json({ error: 'Supabase: ' + errText });
    }
  } catch (e) {
    console.error('[supabase-storage] Exception', e);
    return res.status(500).json({ error: 'Erreur proxy Storage: ' + e.message });
  }
}
