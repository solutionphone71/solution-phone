-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 2 (ledger & encaissements) — UP
-- Réversible (voir lot2_down.sql) — versionné — à lancer dans Supabase SQL Editor.
-- Ajoute la TVA sur marge (téléphones d'occasion) + 2 fonctions d'écriture
-- immuables et chaînées : fiscal_record_sale / fiscal_record_payment.
-- Les fonctions sont en schéma public (appelables par /api/fiscal via la clé
-- secrète), mais écrivent UNIQUEMENT dans le schéma isolé fiscal_cashier.
-- ============================================================================
-- ⚠️ Préparation d'audit / architecture alignée ISCA. Pas de prétention de
--    conformité légale sans audit externe.
-- ============================================================================

BEGIN;

-- 1) Colonnes TVA sur marge (occasion) sur les lignes de vente ---------------
ALTER TABLE fiscal_cashier.fiscal_sale_lines
  ADD COLUMN IF NOT EXISTS vat_regime         text NOT NULL DEFAULT 'normal', -- 'normal' (TVA 20%) | 'marge' (occasion)
  ADD COLUMN IF NOT EXISTS purchase_price_ttc numeric(12,2),                  -- prix d'achat (occasion) pour calculer la marge
  ADD COLUMN IF NOT EXISTS margin_ht          numeric(12,2),
  ADD COLUMN IF NOT EXISTS margin_tva         numeric(12,2);

-- Drapeau au niveau vente (pour les agrégations / clôture Z)
ALTER TABLE fiscal_cashier.fiscal_sales
  ADD COLUMN IF NOT EXISTS has_margin boolean NOT NULL DEFAULT false;

-- 2) Enregistrement d'une VENTE ----------------------------------------------
-- p (jsonb) attendu :
-- {
--   "store_id":"SP-MACON-01", "actor_user_id":"...", "actor_role":"patron|equipe",
--   "sale_type":"accessoire|telephone_neuf|telephone_occasion|reparation|mixte",
--   "customer_id":null, "repair_id":null,
--   "source_document_type":"facture", "source_document_id":"REP-2026-021",
--   "lines":[
--     {"ref":"...","label":"Coque","quantity":1,"unit_price_ttc":19.90,"vat_regime":"normal"},
--     {"ref":"...","label":"iPhone 12 occasion","quantity":1,"unit_price_ttc":300,"vat_regime":"marge","purchase_price_ttc":200}
--   ]
-- }
CREATE OR REPLACE FUNCTION public.fiscal_record_sale(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fiscal_cashier, public, extensions
AS $$
DECLARE
  v_store text := coalesce(p->>'store_id','SP-MACON-01');
  v_role  text := coalesce(p->>'actor_role','');
  v_year  int  := extract(year from now())::int;
  v_seq   bigint;
  v_prev  text;
  v_hash  text;
  v_sale  uuid := gen_random_uuid();
  v_ttc   numeric(12,2) := 0;
  v_tva   numeric(12,2) := 0;
  v_ht    numeric(12,2) := 0;
  v_margin boolean := false;
  v_payload text;
  line jsonb;
  l_no int := 0;
  l_qty numeric; l_unit numeric; l_regime text; l_purch numeric;
  l_ttc numeric; l_ht numeric; l_tva numeric; l_mttc numeric;
BEGIN
  IF v_role NOT IN ('patron','equipe') THEN
    RAISE EXCEPTION 'FISCAL: role non autorise (%)', v_role USING ERRCODE='check_violation';
  END IF;
  IF p->'lines' IS NULL OR jsonb_typeof(p->'lines') <> 'array' OR jsonb_array_length(p->'lines') = 0 THEN
    RAISE EXCEPTION 'FISCAL: aucune ligne de vente' USING ERRCODE='check_violation';
  END IF;

  v_seq := fiscal_cashier.next_seq(v_store,'FAC',v_year);

  -- hash précédent = current_hash de la dernière vente du magasin
  SELECT current_hash INTO v_prev
  FROM fiscal_cashier.fiscal_sales
  WHERE store_id = v_store AND current_hash IS NOT NULL
  ORDER BY server_created_at DESC, sale_number DESC NULLS LAST
  LIMIT 1;

  -- En-tête (immutable_at NULL le temps d'agréger, puis on fige)
  INSERT INTO fiscal_cashier.fiscal_sales(
    id, sale_number, store_id, customer_id, repair_id,
    source_document_type, source_document_id, sale_type, status,
    finalized_at, finalized_by, server_created_at
  ) VALUES (
    v_sale, v_seq, v_store, p->>'customer_id', p->>'repair_id',
    p->>'source_document_type', p->>'source_document_id', coalesce(p->>'sale_type','autre'), 'brouillon',
    now(), p->>'actor_user_id', now()
  );

  -- Lignes
  FOR line IN SELECT * FROM jsonb_array_elements(p->'lines') LOOP
    l_no    := l_no + 1;
    l_qty   := coalesce((line->>'quantity')::numeric, 1);
    l_unit  := coalesce((line->>'unit_price_ttc')::numeric, 0);
    l_regime:= coalesce(line->>'vat_regime','normal');
    l_purch := coalesce((line->>'purchase_price_ttc')::numeric, 0);
    l_ttc   := round(l_qty * l_unit, 2);

    IF l_regime = 'marge' THEN
      -- TVA sur marge : TVA = (vente TTC - achat TTC) / 1.20 * 0.20, jamais négative
      l_mttc := greatest(l_ttc - round(l_qty * l_purch, 2), 0);
      l_tva  := round(l_mttc / 1.20 * 0.20, 2);
      l_ht   := round(l_ttc - l_tva, 2);
      v_margin := true;
      INSERT INTO fiscal_cashier.fiscal_sale_lines(
        sale_id, line_number, product_or_service_reference, label, quantity,
        unit_price_ht, vat_rate, total_ht, total_tva, total_ttc,
        qualirepar_bonus_amount, vat_regime, purchase_price_ttc, margin_ht, margin_tva,
        immutable_at, server_created_at
      ) VALUES (
        v_sale, l_no, line->>'ref', line->>'label', l_qty,
        NULL, NULL, l_ht, l_tva, l_ttc,
        (line->>'qualirepar_bonus_amount')::numeric, 'marge', round(l_purch,2),
        round(l_mttc - l_tva, 2), l_tva,
        now(), now()
      );
    ELSE
      -- TVA normale 20 %
      l_ht  := round(l_ttc / 1.20, 2);
      l_tva := round(l_ttc - l_ht, 2);
      INSERT INTO fiscal_cashier.fiscal_sale_lines(
        sale_id, line_number, product_or_service_reference, label, quantity,
        unit_price_ht, vat_rate, total_ht, total_tva, total_ttc,
        qualirepar_bonus_amount, vat_regime, immutable_at, server_created_at
      ) VALUES (
        v_sale, l_no, line->>'ref', line->>'label', l_qty,
        round(l_unit/1.20,2), 20, l_ht, l_tva, l_ttc,
        (line->>'qualirepar_bonus_amount')::numeric, 'normal', now(), now()
      );
    END IF;

    v_ttc := v_ttc + l_ttc;
    v_tva := v_tva + l_tva;
    v_ht  := v_ht  + l_ht;
  END LOOP;

  -- Hash chaîné sur les champs essentiels
  v_payload := concat_ws('|', v_sale::text, v_seq::text, v_store,
                 to_char(v_ttc,'FM999999990.00'), to_char(v_tva,'FM999999990.00'),
                 coalesce(p->>'sale_type','autre'), coalesce(p->>'actor_user_id',''),
                 to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.US'));
  v_hash := fiscal_cashier.compute_hash(v_payload, v_prev);

  -- Finalisation : on fige (immutable_at) en une seule UPDATE (OLD.immutable_at est NULL → autorisé)
  UPDATE fiscal_cashier.fiscal_sales
     SET total_ht=v_ht, total_tva=v_tva, total_ttc=v_ttc, has_margin=v_margin,
         status='finalisée', previous_hash=v_prev, current_hash=v_hash, immutable_at=now()
   WHERE id=v_sale;

  -- Journal d'audit (append-only)
  INSERT INTO fiscal_cashier.fiscal_audit_log(
    actor_user_id, actor_role, store_id, event_type, entity_type, entity_id,
    after_snapshot, current_hash, immutable_at, server_created_at
  ) VALUES (
    p->>'actor_user_id', v_role, v_store, 'record_sale', 'fiscal_sales', v_sale::text,
    jsonb_build_object('sale_number',v_seq,'total_ttc',v_ttc,'total_tva',v_tva,'has_margin',v_margin),
    v_hash, now(), now()
  );

  RETURN jsonb_build_object(
    'ok', true, 'sale_id', v_sale, 'sale_number', v_seq,
    'total_ht', v_ht, 'total_tva', v_tva, 'total_ttc', v_ttc,
    'has_margin', v_margin, 'current_hash', v_hash
  );
END $$;

-- 3) Enregistrement d'un PAIEMENT --------------------------------------------
-- p (jsonb) : { store_id, actor_user_id, actor_role, sale_id, payment_type,
--   amount, currency, terminal_reference, bank_reference, qualirepar_case_id }
CREATE OR REPLACE FUNCTION public.fiscal_record_payment(p jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fiscal_cashier, public, extensions
AS $$
DECLARE
  v_store text := coalesce(p->>'store_id','SP-MACON-01');
  v_role  text := coalesce(p->>'actor_role','');
  v_year  int  := extract(year from now())::int;
  v_seq   bigint;
  v_prev  text;
  v_hash  text;
  v_pay   uuid := gen_random_uuid();
  v_amount numeric(12,2) := coalesce((p->>'amount')::numeric,0);
  v_payload text;
BEGIN
  IF v_role NOT IN ('patron','equipe') THEN
    RAISE EXCEPTION 'FISCAL: role non autorise (%)', v_role USING ERRCODE='check_violation';
  END IF;

  v_seq := fiscal_cashier.next_seq(v_store,'PAY',v_year);

  SELECT current_hash INTO v_prev
  FROM fiscal_cashier.fiscal_payments
  WHERE store_id = v_store AND current_hash IS NOT NULL
  ORDER BY server_created_at DESC, payment_number DESC NULLS LAST
  LIMIT 1;

  v_payload := concat_ws('|', v_pay::text, v_seq::text, v_store,
                 coalesce(p->>'payment_type',''), to_char(v_amount,'FM999999990.00'),
                 coalesce(p->>'sale_id',''), coalesce(p->>'actor_user_id',''),
                 to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS.US'));
  v_hash := fiscal_cashier.compute_hash(v_payload, v_prev);

  INSERT INTO fiscal_cashier.fiscal_payments(
    id, payment_number, sale_id, store_id, payment_type, amount, currency,
    payment_provider_reference, terminal_reference, bank_reference, qualirepar_case_id,
    recorded_at, recorded_by, previous_hash, current_hash, immutable_at, server_created_at
  ) VALUES (
    v_pay, v_seq, nullif(p->>'sale_id','')::uuid, v_store, p->>'payment_type', v_amount,
    coalesce(p->>'currency','EUR'),
    p->>'payment_provider_reference', p->>'terminal_reference', p->>'bank_reference', p->>'qualirepar_case_id',
    now(), p->>'actor_user_id', v_prev, v_hash, now(), now()
  );

  INSERT INTO fiscal_cashier.fiscal_audit_log(
    actor_user_id, actor_role, store_id, event_type, entity_type, entity_id,
    after_snapshot, current_hash, immutable_at, server_created_at
  ) VALUES (
    p->>'actor_user_id', v_role, v_store, 'record_payment', 'fiscal_payments', v_pay::text,
    jsonb_build_object('payment_number',v_seq,'amount',v_amount,'type',p->>'payment_type'),
    v_hash, now(), now()
  );

  RETURN jsonb_build_object('ok', true, 'payment_id', v_pay, 'payment_number', v_seq, 'current_hash', v_hash);
END $$;

-- 4) Vérification d'intégrité de la chaîne (lecture seule) --------------------
CREATE OR REPLACE FUNCTION public.fiscal_verify_chain(p_store text DEFAULT 'SP-MACON-01')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = fiscal_cashier, public, extensions
AS $$
DECLARE
  r record; v_prev text := NULL; v_recalc text; v_bad int := 0; v_n int := 0;
BEGIN
  FOR r IN
    SELECT id, sale_number, store_id, total_ttc, total_tva, sale_type, finalized_by,
           server_created_at, previous_hash, current_hash
    FROM fiscal_cashier.fiscal_sales
    WHERE store_id=p_store AND current_hash IS NOT NULL
    ORDER BY server_created_at ASC, sale_number ASC
  LOOP
    v_n := v_n + 1;
    v_recalc := fiscal_cashier.compute_hash(
      concat_ws('|', r.id::text, r.sale_number::text, r.store_id,
        to_char(r.total_ttc,'FM999999990.00'), to_char(r.total_tva,'FM999999990.00'),
        coalesce(r.sale_type,'autre'), coalesce(r.finalized_by,''),
        to_char(r.server_created_at,'YYYY-MM-DD"T"HH24:MI:SS.US')),
      v_prev);
    IF v_recalc <> r.current_hash THEN v_bad := v_bad + 1; END IF;
    v_prev := r.current_hash;
  END LOOP;
  RETURN jsonb_build_object('store', p_store, 'ventes', v_n, 'alterations_detectees', v_bad,
                            'chaine_valide', (v_bad = 0));
END $$;

-- 5) Droits : seules les fonctions sont exposées, et uniquement à service_role
REVOKE ALL ON FUNCTION public.fiscal_record_sale(jsonb)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscal_record_payment(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fiscal_verify_chain(text)    FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_record_sale(jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_record_payment(jsonb) FROM anon';
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_verify_chain(text) FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_record_sale(jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_record_payment(jsonb) FROM authenticated';
    EXECUTE 'REVOKE ALL ON FUNCTION public.fiscal_verify_chain(text) FROM authenticated';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fiscal_record_sale(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fiscal_record_payment(jsonb) TO service_role';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.fiscal_verify_chain(text) TO service_role';
  END IF;
END $$;

-- 6) Version
INSERT INTO fiscal_cashier.fiscal_version_registry
  (fiscal_module_version, database_migration_version, changelog, audit_required)
VALUES
  ('CAISSE SECURISEE v1.0','lot2_2026',
   'Lot 2 — ledger : TVA sur marge (occasion) + fonctions record_sale/record_payment immuables et chainees + verify_chain',
   true);

COMMIT;

-- ============================================================================
-- FIN LOT 2 UP. Lancez lot2_tests.sql pour vérifier (TVA normale + marge + chaîne).
-- Rollback : lot2_down.sql
-- ============================================================================
