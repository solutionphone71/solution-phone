// /api/backup.js — Backup automatique quotidien Supabase → Supabase Storage
// Solution Phone · Sprint 15J · J14 · mai 2026
//
// Appelé par cron Vercel chaque nuit à 2h du matin (cf vercel.json).
// Peut aussi être déclenché manuellement depuis l'app (bouton "Backup maintenant" en Paramètres).
//
// Workflow :
//   1. Fetch toutes les tables critiques de Supabase
//   2. Bundle dans un seul JSON
//   3. Gzip
//   4. Upload vers bucket Supabase Storage `backups` (chemin: YYYY-MM-DD.json.gz)
//   5. Insert ligne dans `backups_meta`
//   6. Supprime les backups > 30 jours
//
// Tables sauvegardées : voir TABLES ci-dessous.

import { gzipSync } from 'node:zlib';
import { handleAuth } from './_auth.js';

const SUPA_URL = process.env.SUPABASE_URL;
const SUPA_KEY = process.env.SUPABASE_KEY;

// Tables critiques à sauvegarder (TOUT ce qui est business)
const TABLES = [
  'clients',
  'factures',
  'factures_pdf',
  'phones',
  'phones_neufs',
  'reparations',
  'bons_depot',
  'bons_commande',
  'historique_reparations',
  'cloture_journee',
  'caisse',
  'depenses',
  'salaries',
  'neufs_accessoires',
  'police',
  'mobilax',
  'commandes',
  'devis',
  'settings',
  'reports_mois',
  'audit_log'
];

const RETENTION_DAYS = 30;
const BUCKET = 'backups';

async function fetchTable(table) {
  // Limite à 50 000 lignes (suffit pour Solution Phone — environ 15 000 max actuellement)
  const url = `${SUPA_URL}/rest/v1/${table}?select=*&limit=50000`;
  const r = await fetch(url, {
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`
    }
  });
  if (!r.ok) {
    const txt = await r.text();
    console.warn(`[backup] table ${table} skipped:`, r.status, txt.substring(0, 200));
    return { rows: [], skipped: true, error: r.status + ' ' + txt.substring(0, 200) };
  }
  const rows = await r.json();
  return { rows, skipped: false };
}

async function uploadToStorage(fileName, buffer) {
  const url = `${SUPA_URL}/storage/v1/object/${BUCKET}/${fileName}`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/gzip',
      'x-upsert': 'true'
    },
    body: buffer
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`Upload failed ${r.status}: ${txt.substring(0, 300)}`);
  }
  return await r.json();
}

async function insertMeta(meta) {
  const url = `${SUPA_URL}/rest/v1/backups_meta`;
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SUPA_KEY,
      Authorization: `Bearer ${SUPA_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation,resolution=merge-duplicates'
    },
    body: JSON.stringify(meta)
  });
  if (!r.ok) {
    const txt = await r.text();
    console.warn('[backup] insertMeta failed:', r.status, txt.substring(0, 200));
  }
}

async function pruneOldBackups() {
  // Récupère les meta de plus de RETENTION_DAYS
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 3600 * 1000).toISOString();
  const url = `${SUPA_URL}/rest/v1/backups_meta?created_at=lt.${cutoff}&select=id,file_name`;
  const r = await fetch(url, {
    headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
  });
  if (!r.ok) return { pruned: 0 };
  const old = await r.json();
  let pruned = 0;
  for (const b of old) {
    // Supprime fichier dans Storage
    await fetch(`${SUPA_URL}/storage/v1/object/${BUCKET}/${b.file_name}`, {
      method: 'DELETE',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    }).catch(() => {});
    // Supprime ligne meta
    await fetch(`${SUPA_URL}/rest/v1/backups_meta?id=eq.${b.id}`, {
      method: 'DELETE',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}` }
    }).catch(() => {});
    pruned++;
  }
  return { pruned };
}

export default async function handler(req, res) {
  if (handleAuth(req, res)) return;

  if (!SUPA_URL || !SUPA_KEY) {
    return res.status(500).json({ error: 'SUPABASE_URL ou SUPABASE_KEY manquant' });
  }

  const t0 = Date.now();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const fileName = `${today}.json.gz`;

  try {
    // 1. Fetch toutes les tables en parallèle
    console.log('[backup] start —', TABLES.length, 'tables');
    const results = await Promise.all(TABLES.map(t => fetchTable(t).then(r => [t, r])));

    // 2. Bundle dans un objet
    const bundle = {
      version: 1,
      generated_at: new Date().toISOString(),
      shop: 'Solution Phone Mâcon',
      tables: {}
    };
    let totalRows = 0;
    const tablesOk = [];
    const tablesSkipped = [];
    for (const [name, r] of results) {
      if (r.skipped) {
        tablesSkipped.push(name);
        bundle.tables[name] = { skipped: true, error: r.error };
      } else {
        bundle.tables[name] = r.rows;
        totalRows += r.rows.length;
        tablesOk.push(name);
      }
    }

    // 3. JSON + gzip
    const json = JSON.stringify(bundle);
    const gz = gzipSync(Buffer.from(json, 'utf-8'));
    const sizeBytes = gz.length;
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    // 4. Upload Storage
    await uploadToStorage(fileName, gz);

    // 5. Meta
    await insertMeta({
      file_name: fileName,
      storage_path: `${BUCKET}/${fileName}`,
      size_bytes: sizeBytes,
      tables: tablesOk,
      rows_total: totalRows,
      status: 'ok'
    });

    // 6. Prune anciens
    const prune = await pruneOldBackups();

    const dur = Math.round((Date.now() - t0) / 1000);
    console.log(`[backup] OK ${fileName} — ${sizeMB} Mo, ${totalRows} lignes, ${tablesOk.length} tables, prune ${prune.pruned}, ${dur}s`);

    return res.status(200).json({
      ok: true,
      file: fileName,
      size_mb: Number(sizeMB),
      rows: totalRows,
      tables_ok: tablesOk,
      tables_skipped: tablesSkipped,
      pruned: prune.pruned,
      duration_s: dur
    });
  } catch (e) {
    console.error('[backup] error:', e);
    // Trace l'erreur dans backups_meta pour visibilité
    await insertMeta({
      file_name: fileName + '.error',
      storage_path: '',
      status: 'error',
      error_msg: String(e.message || e).substring(0, 500)
    }).catch(() => {});
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
}
