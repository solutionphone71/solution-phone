-- /sql/audit-log.sql
-- Solution Phone · Sprint 15J · J14 · mai 2026
--
-- Journal d'audit : trace toutes les actions sensibles (qui a fait quoi, quand).
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  user_email   TEXT,                  -- email patron / salarié connecté
  user_role    TEXT,                  -- 'patron' | 'employe'
  action       TEXT NOT NULL,         -- 'create' | 'update' | 'delete' | 'cloture' | 'export' | 'backup'
  table_name   TEXT NOT NULL,         -- ex: 'factures', 'phones', 'reparations', 'cloture_journee'
  record_id    TEXT,                  -- id de la ligne touchée (string pour BIGINT ou UUID)
  before_data  JSONB,                 -- état avant (nullable pour create)
  after_data   JSONB,                 -- état après (nullable pour delete)
  ip           TEXT,
  user_agent   TEXT,
  context      TEXT,                  -- info libre : "Z journée", "Suppression facture annulée"
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour navigation rapide
CREATE INDEX IF NOT EXISTS idx_audit_log_created  ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_table    ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_log_user     ON audit_log(user_email);
CREATE INDEX IF NOT EXISTS idx_audit_log_action   ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_record   ON audit_log(table_name, record_id);

COMMENT ON TABLE audit_log IS 'Journal d audit : trace les actions sensibles (créations, modifs, suppressions, clôtures, exports, backups)';

-- ════════════════════════════════════════════════════════════════
-- Table backups_meta : meta des fichiers de backup
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS backups_meta (
  id           BIGSERIAL PRIMARY KEY,
  file_name    TEXT NOT NULL,         -- ex: '2026-05-11.json.gz'
  storage_path TEXT NOT NULL,         -- chemin Supabase Storage
  size_bytes   BIGINT,
  tables       TEXT[],                -- liste des tables sauvegardées
  rows_total   INT,                   -- total de lignes
  status       TEXT DEFAULT 'ok',     -- 'ok' | 'error'
  error_msg    TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backups_meta_created ON backups_meta(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_backups_meta_filename ON backups_meta(file_name);

COMMENT ON TABLE backups_meta IS 'Métadonnées des backups quotidiens Solution Phone (fichier réel dans bucket Supabase Storage : backups/)';

-- ════════════════════════════════════════════════════════════════
-- ÉTAPE MANUELLE (1 fois) : créer le bucket Storage "backups"
-- ════════════════════════════════════════════════════════════════
-- Va dans Supabase Dashboard → Storage → New bucket
--   - Name: backups
--   - Public bucket: NON (privé)
--   - File size limit: 50 MB
--   - Allowed MIME types: application/gzip
-- Le cron /api/backup uploadera automatiquement chaque nuit à 2h.
