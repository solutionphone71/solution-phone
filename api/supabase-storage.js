// /api/supabase-storage.js — Proxy Supabase Storage pour uploads d'images
// Protege la cle Supabase cote serveur

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-upsert');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST uniquement' });

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
    const response = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': `Bearer ${SUPA_KEY}`,
        'Content-Type': req.headers['content-type'] || 'image/jpeg',
        'x-upsert': 'true'
      },
      body: Buffer.from(req.body)
    });

    if (response.ok) {
      const publicUrl = `${SUPA_URL}/storage/v1/object/public/${bucket}/${fileName}`;
      return res.status(200).json({ url: publicUrl });
    } else {
      const errText = await response.text();
      return res.status(response.status).send(errText);
    }
  } catch (e) {
    console.error('Proxy Storage error:', e);
    return res.status(500).json({ error: 'Erreur proxy Storage' });
  }
}
