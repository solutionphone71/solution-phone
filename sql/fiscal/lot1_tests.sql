-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 1 — TESTS
-- À lancer dans Supabase → SQL Editor APRÈS lot1_up.sql.
-- Tout est exécuté dans une transaction puis ANNULÉ (ROLLBACK) :
-- aucune donnée de test ne reste en base.
-- Lisez les messages NOTICE : chaque test doit afficher "PASS".
-- ============================================================================

BEGIN;

DO $$
DECLARE
  h1 text; h2 text;
  n1 bigint; n2 bigint;
  sid uuid;
  pid uuid;
BEGIN
  -- TEST 1 : la fonction de hash chaîne bien (prev différent => hash différent)
  h1 := fiscal_cashier.compute_hash('payload-A', 'GENESIS');
  h2 := fiscal_cashier.compute_hash('payload-A', h1);
  IF h1 IS NOT NULL AND h2 IS NOT NULL AND h1 <> h2 AND length(h1)=64 THEN
    RAISE NOTICE 'PASS 1 — hash SHA-256 chaîné OK';
  ELSE RAISE EXCEPTION 'FAIL 1 — hash incorrect'; END IF;

  -- TEST 2 : numérotation séquentielle atomique
  n1 := fiscal_cashier.next_seq('SP-MACON-01','FAC',2026);
  n2 := fiscal_cashier.next_seq('SP-MACON-01','FAC',2026);
  IF n2 = n1 + 1 THEN RAISE NOTICE 'PASS 2 — séquence atomique (% -> %)', n1, n2;
  ELSE RAISE EXCEPTION 'FAIL 2 — séquence non incrémentale'; END IF;

  -- TEST 3 : un brouillon (immutable_at NULL) est modifiable
  INSERT INTO fiscal_cashier.fiscal_sales(sale_type,total_ttc,status)
    VALUES ('test',10.00,'brouillon') RETURNING id INTO sid;
  UPDATE fiscal_cashier.fiscal_sales SET total_ttc=12.00 WHERE id=sid;
  RAISE NOTICE 'PASS 3 — brouillon modifiable avant finalisation';

  -- On finalise (devient immuable)
  UPDATE fiscal_cashier.fiscal_sales
    SET status='finalisée', finalized_at=now(), immutable_at=now() WHERE id=sid;

  -- TEST 4 : UPDATE sur écriture finalisée -> DOIT être bloqué
  BEGIN
    UPDATE fiscal_cashier.fiscal_sales SET total_ttc=999 WHERE id=sid;
    RAISE EXCEPTION 'FAIL 4 — UPDATE d''une écriture finalisée a été autorisé !';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 4 — UPDATE bloqué sur écriture finalisée';
  END;

  -- TEST 5 : DELETE sur écriture finalisée -> DOIT être bloqué
  BEGIN
    DELETE FROM fiscal_cashier.fiscal_sales WHERE id=sid;
    RAISE EXCEPTION 'FAIL 5 — DELETE d''une écriture finalisée a été autorisé !';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 5 — DELETE bloqué sur écriture finalisée';
  END;

  -- TEST 6 : un paiement (append-only) finalisé est bloqué aussi
  INSERT INTO fiscal_cashier.fiscal_payments(payment_type,amount,immutable_at)
    VALUES ('card',54.00,now()) RETURNING id INTO pid;
  BEGIN
    DELETE FROM fiscal_cashier.fiscal_payments WHERE id=pid;
    RAISE EXCEPTION 'FAIL 6 — DELETE paiement finalisé autorisé !';
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'PASS 6 — paiement finalisé inaltérable';
  END;

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'TOUS LES TESTS LOT 1 : PASS ✅';
  RAISE NOTICE '=========================================';
END $$;

-- TEST 7 (RLS) — note : dans le SQL Editor vous êtes "postgres" (bypass RLS).
-- Vérification que la RLS est bien ACTIVÉE + FORCÉE sur toutes les tables :
SELECT tablename,
       (SELECT relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='fiscal_cashier' AND c.relname=t.tablename) AS rls_active,
       (SELECT relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
         WHERE n.nspname='fiscal_cashier' AND c.relname=t.tablename) AS rls_forced
FROM pg_tables t WHERE schemaname='fiscal_cashier' ORDER BY tablename;
-- Attendu : rls_active = true ET rls_forced = true pour TOUTES les tables.

ROLLBACK;  -- annule toutes les écritures de test

-- ============================================================================
-- Si vous voyez "PASS 1..6" et que la requête RLS montre true/true partout,
-- le Lot 1 est opérationnel. (Le ROLLBACK a tout nettoyé.)
-- ============================================================================
