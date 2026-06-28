-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 1 (fondations DB & droits)
-- Migration UP — réversible (voir lot1_down.sql) — versionnée
-- À exécuter dans Supabase → SQL Editor (rôle propriétaire/postgres).
-- N'altère AUCUNE table existante. Crée un schéma isolé "fiscal_cashier".
-- Aucune donnée existante n'est touchée. Idempotent (IF NOT EXISTS).
-- ============================================================================
-- ⚠️ Préparation d'audit / architecture alignée ISCA. Aucune prétention de
--    conformité légale sans audit externe.
-- ============================================================================

BEGIN;

-- 0) Extensions ---------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- digest() SHA-256 + gen_random_uuid()

-- 1) Schéma isolé -------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS fiscal_cashier;

-- ISOLATION : personne d'autre que le propriétaire/service ne touche ce schéma.
REVOKE ALL ON SCHEMA fiscal_cashier FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA fiscal_cashier FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON SCHEMA fiscal_cashier FROM authenticated';
  END IF;
END $$;

-- 2) Fonction de hash (chaînage cryptographique, calculé EN BASE) -------------
CREATE OR REPLACE FUNCTION fiscal_cashier.compute_hash(payload text, prev_hash text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT encode(digest(coalesce(prev_hash,'GENESIS') || '|' || coalesce(payload,''), 'sha256'), 'hex');
$$;

-- 3) Numérotation séquentielle atomique (par magasin + type + exercice) -------
CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_sequences (
  store_id     text    NOT NULL,
  doc_type     text    NOT NULL,
  year         int     NOT NULL,
  last_value   bigint  NOT NULL DEFAULT 0,
  PRIMARY KEY (store_id, doc_type, year)
);

-- Renvoie le prochain numéro atomiquement (verrou de ligne -> pas de doublon)
CREATE OR REPLACE FUNCTION fiscal_cashier.next_seq(p_store text, p_type text, p_year int)
RETURNS bigint LANGUAGE plpgsql AS $$
DECLARE v bigint;
BEGIN
  INSERT INTO fiscal_cashier.fiscal_sequences(store_id, doc_type, year, last_value)
    VALUES (p_store, p_type, p_year, 0)
    ON CONFLICT (store_id, doc_type, year) DO NOTHING;
  UPDATE fiscal_cashier.fiscal_sequences
    SET last_value = last_value + 1
    WHERE store_id=p_store AND doc_type=p_type AND year=p_year
    RETURNING last_value INTO v;
  RETURN v;
END $$;

-- 4) Trigger générique d'IMMUABILITÉ -----------------------------------------
-- Bloque tout UPDATE/DELETE dès qu'une écriture est finalisée (immutable_at).
CREATE OR REPLACE FUNCTION fiscal_cashier.prevent_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.immutable_at IS NOT NULL THEN
      RAISE EXCEPTION 'FISCAL_IMMUTABLE: suppression interdite (écriture finalisée %, table %)', OLD.id, TG_TABLE_NAME
        USING ERRCODE='check_violation';
    END IF;
    RETURN OLD;
  ELSE -- UPDATE
    IF OLD.immutable_at IS NOT NULL THEN
      RAISE EXCEPTION 'FISCAL_IMMUTABLE: modification interdite (écriture finalisée %, table %)', OLD.id, TG_TABLE_NAME
        USING ERRCODE='check_violation';
    END IF;
    RETURN NEW;
  END IF;
END $$;

-- Helper local pour attacher le trigger + activer la RLS deny-all sur une table
-- (exécuté inline ci-dessous pour chaque table).

-- 5) TABLES FISCALES (vides) --------------------------------------------------
-- Colonnes d'intégrité communes : seq, previous_hash, current_hash,
-- immutable_at, server_created_at (UTC). store_id défaut mono-magasin.

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL DEFAULT 'SP-MACON-01',
  session_number bigint,
  opened_at timestamptz, opened_by text,
  opening_float numeric(12,2),
  closed_at timestamptz, closed_by text,
  expected_cash_amount numeric(12,2),
  actual_cash_amount numeric(12,2),
  discrepancy_amount numeric(12,2),
  closure_status text DEFAULT 'open',
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number bigint,
  store_id text NOT NULL DEFAULT 'SP-MACON-01',
  customer_id text, repair_id text,
  source_document_type text, source_document_id text,
  sale_type text,                          -- accessoire/réparation/téléphone/acompte/solde/autre
  total_ht numeric(12,2), total_tva numeric(12,2), total_ttc numeric(12,2),
  status text NOT NULL DEFAULT 'brouillon',-- brouillon/finalisée/annulée/corrigée
  finalized_at timestamptz, finalized_by text,
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_sale_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid REFERENCES fiscal_cashier.fiscal_sales(id),
  line_number int,
  product_or_service_reference text, label text,
  quantity numeric(12,3), unit_price_ht numeric(12,2), vat_rate numeric(5,2),
  total_ht numeric(12,2), total_tva numeric(12,2), total_ttc numeric(12,2),
  qualirepar_bonus_amount numeric(12,2),
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number bigint,
  sale_id uuid REFERENCES fiscal_cashier.fiscal_sales(id),
  store_id text NOT NULL DEFAULT 'SP-MACON-01',
  payment_type text,   -- card/cash/cheque/bank_transfer/payment_link/voucher/
                       -- qualirepar_receivable/qualirepar_settlement/refund/credit_note/adjustment
  amount numeric(12,2), currency text DEFAULT 'EUR',
  payment_provider_reference text, terminal_reference text, bank_reference text,
  qualirepar_case_id text,
  recorded_at timestamptz, recorded_by text,
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_number bigint,
  related_sale_id uuid REFERENCES fiscal_cashier.fiscal_sales(id),
  related_payment_id uuid REFERENCES fiscal_cashier.fiscal_payments(id),
  adjustment_type text,  -- cancellation/credit_note/refund/correction/qualirepar_reversal/accounting_regularization
  reason_code text, reason_text text,
  approved_by text, amount numeric(12,2),
  created_by text,
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_daily_closures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id text NOT NULL DEFAULT 'SP-MACON-01',
  business_date date,
  closure_number bigint,
  sales_total_ttc numeric(12,2), sales_total_ht numeric(12,2),
  vat_breakdown jsonb, payment_breakdown jsonb,
  refunds_total numeric(12,2), credits_total numeric(12,2),
  qualirepar_receivables_total numeric(12,2), qualirepar_settlements_total numeric(12,2),
  expected_cash numeric(12,2), declared_cash numeric(12,2), cash_difference numeric(12,2),
  closed_by text, closed_at timestamptz,
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  report_pdf_storage_path text, export_storage_path text,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id bigint,
  actor_user_id text, actor_role text, store_id text,
  event_type text, entity_type text, entity_id text,
  before_snapshot jsonb, after_snapshot jsonb,
  request_id text, ip_or_device_identifier text,
  previous_hash text, current_hash text,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()  -- horloge serveur uniquement
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_archives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_period_start date, archive_period_end date,
  archive_type text,            -- mensuel/annuel/exceptionnel
  generated_at timestamptz, generated_by text,
  content_hash text, manifest_hash text,
  immutable_storage_path text,
  verification_status text, verified_at timestamptz,
  immutable_at timestamptz,
  server_created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_version_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_module_version text, database_migration_version text,
  source_commit_hash text, deployed_at timestamptz DEFAULT now(), deployed_by text,
  changelog text, impact_assessment text, audit_required boolean DEFAULT false,
  archived_documentation_path text
);

-- Scaffold rôles applicatifs (l'auth réelle = Supabase Auth, ajoutée plus tard)
CREATE TABLE IF NOT EXISTS fiscal_cashier.fiscal_user_roles (
  user_id text PRIMARY KEY,
  role text NOT NULL,    -- vendeur/technicien/responsable/admin_op/comptable_ro/auditeur_ro/admin_tech
  store_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6) Attacher le trigger d'immuabilité aux tables fiscalisées -----------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'fiscal_cash_sessions','fiscal_sales','fiscal_sale_lines','fiscal_payments',
    'fiscal_adjustments','fiscal_daily_closures','fiscal_audit_log','fiscal_archives'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_immutable ON fiscal_cashier.%I', t);
    EXECUTE format(
      'CREATE TRIGGER trg_immutable BEFORE UPDATE OR DELETE ON fiscal_cashier.%I
       FOR EACH ROW EXECUTE FUNCTION fiscal_cashier.prevent_mutation()', t);
  END LOOP;
END $$;

-- 7) RLS deny-all sur tout le schéma (aucune policy permissive = tout refusé
--    pour anon/authenticated ; service_role/propriétaire conservent l'accès) --
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='fiscal_cashier' LOOP
    EXECUTE format('ALTER TABLE fiscal_cashier.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE fiscal_cashier.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- 8) Enregistrer la version --------------------------------------------------
INSERT INTO fiscal_cashier.fiscal_version_registry
  (fiscal_module_version, database_migration_version, changelog, audit_required)
VALUES
  ('CAISSE SÉCURISÉE v1.0', 'lot1_2026', 'Lot 1 — fondations : schéma isolé, tables append-only, hash, séquences, triggers immuabilité, RLS deny-all', true);

COMMIT;

-- ============================================================================
-- FIN LOT 1 UP. Lancez ensuite lot1_tests.sql pour vérifier les blocages.
-- Rollback : lot1_down.sql
-- ============================================================================
