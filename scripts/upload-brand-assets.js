// scripts/upload-brand-assets.js
// Solution Phone · Outil de seed du kit de marque
//
// Lit /brand/references/manifest.json + les fichiers image associés,
// les pousse dans le bucket Supabase Storage "visual_assets",
// et insère/actualise les rows correspondants dans la table visual_assets.
//
// USAGE (depuis la racine du repo) :
//   1. Place tes 15 visuels dans ./brand/references/ avec les noms du manifest
//   2. Vérifie que SUPABASE_URL et SUPABASE_SERVICE_KEY sont en env locales :
//        export SUPABASE_URL=https://xxxxx.supabase.co
//        export SUPABASE_SERVICE_KEY=eyJhbG... (clé SERVICE_ROLE, pas anon)
//   3. node scripts/upload-brand-assets.js
//
// REMARQUE : la SERVICE_ROLE_KEY est nécessaire pour bypass les RLS sur
// l'upload. Ne JAMAIS la commit. La récupérer dans Supabase Dashboard →
// Project Settings → API → service_role secret.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
const BUCKET = 'visual_assets';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_SERVICE_KEY manquant.');
  console.error('   export SUPABASE_URL=https://xxxxx.supabase.co');
  console.error('   export SUPABASE_SERVICE_KEY=eyJ... (service_role)');
  process.exit(1);
}

const MANIFEST_PATH = path.join(__dirname, '..', 'brand', 'references', 'manifest.json');
const REFERENCES_DIR = path.join(__dirname, '..', 'brand', 'references');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error(`❌ Manifest introuvable : ${MANIFEST_PATH}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
if (!Array.isArray(manifest.assets)) {
  console.error('❌ manifest.json doit contenir un tableau "assets".');
  process.exit(1);
}

// ── Helpers HTTP ────────────────────────────────────────────────────

async function supaRest(table, method, body, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query || ''}`;
  const headers = {
    apikey: SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };
  if (method !== 'GET') headers.Prefer = 'return=representation';
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Supabase ${method} ${table} ${res.status}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function uploadToStorage(buffer, storagePath, contentType) {
  const url = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Storage upload ${res.status}: ${t.slice(0, 300)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${storagePath}`;
}

function contentTypeFor(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'svg') return 'image/svg+xml';
  throw new Error(`Extension non supportée: ${ext}`);
}

// ── Pipeline principal ───────────────────────────────────────────────

(async function main() {
  console.log(`🎨 Solution Phone · upload du kit de marque (${manifest.assets.length} assets)`);
  console.log(`   bucket: ${BUCKET}`);
  console.log(`   source: ${REFERENCES_DIR}`);
  console.log('');

  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const asset of manifest.assets) {
    const localPath = path.join(REFERENCES_DIR, asset.filename);
    if (!fs.existsSync(localPath)) {
      console.warn(`⚠️  ${asset.filename} : fichier introuvable — skip`);
      skipped++;
      continue;
    }

    try {
      const buffer = fs.readFileSync(localPath);
      const contentType = contentTypeFor(asset.filename);
      const storagePath = `kit/${asset.filename}`;

      // 1. Upload Storage
      const publicUrl = await uploadToStorage(buffer, storagePath, contentType);

      // 2. Upsert visual_assets row
      const existing = await supaRest(
        'visual_assets',
        'GET',
        null,
        `?name=eq.${encodeURIComponent(asset.name)}&select=id`
      );

      const row = {
        kind: asset.kind,
        name: asset.name,
        file_url: publicUrl,
        storage_path: `${BUCKET}/${storagePath}`,
        ai_reference: !!asset.ai_reference,
        description: asset.description || null,
        tags: Array.isArray(asset.tags) ? asset.tags : [],
        size_bytes: buffer.length,
        active: true,
        updated_at: new Date().toISOString()
      };

      if (existing && existing.length > 0) {
        await supaRest(
          'visual_assets',
          'PATCH',
          row,
          `?id=eq.${existing[0].id}`
        );
        console.log(`✅ ${asset.filename}  (UPDATE, id=${existing[0].id})`);
      } else {
        const inserted = await supaRest('visual_assets', 'POST', row);
        const id = inserted?.[0]?.id;
        console.log(`✅ ${asset.filename}  (INSERT, id=${id})`);
      }
      ok++;
    } catch (e) {
      console.error(`❌ ${asset.filename} : ${e.message}`);
      failed++;
    }
  }

  console.log('');
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${ok} uploadés · ${skipped} skip · ${failed} erreurs`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

  if (failed > 0) process.exit(1);
})();
