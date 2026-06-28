-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 2 — TESTS (auto-annulés par ROLLBACK)
-- Lance APRÈS lot2_up.sql. Vérifie : TVA 20% normale, TVA sur marge (occasion),
-- paiement, immuabilité, chaîne d'intégrité. Aucune donnée de test ne reste.
-- ============================================================================
BEGIN;

DO $$
DECLARE r1 jsonb; r2 jsonb; rp jsonb; sid uuid; v jsonb;
BEGIN
  -- TEST 1 — vente TVA normale 20% : 19,90 TTC → HT 16,58 / TVA 3,32
  r1 := public.fiscal_record_sale('{"actor_role":"patron","actor_user_id":"test","sale_type":"accessoire","lines":[{"label":"Coque","quantity":1,"unit_price_ttc":19.90,"vat_regime":"normal"}]}'::jsonb);
  RAISE NOTICE 'TEST1 normal -> ttc=% ht=% tva=%', r1->>'total_ttc', r1->>'total_ht', r1->>'total_tva';
  IF (r1->>'total_tva')::numeric <> 3.32 THEN RAISE EXCEPTION 'FAIL1 TVA normale = % (attendu 3.32)', r1->>'total_tva'; END IF;

  -- TEST 2 — vente TVA sur marge : vente 300 / achat 200 → marge 100 → TVA 16,67
  r2 := public.fiscal_record_sale('{"actor_role":"patron","actor_user_id":"test","sale_type":"telephone_occasion","lines":[{"label":"iPhone 12 occasion","quantity":1,"unit_price_ttc":300,"vat_regime":"marge","purchase_price_ttc":200}]}'::jsonb);
  RAISE NOTICE 'TEST2 marge -> ttc=% tva=% has_margin=%', r2->>'total_ttc', r2->>'total_tva', r2->>'has_margin';
  IF (r2->>'total_tva')::numeric <> 16.67 THEN RAISE EXCEPTION 'FAIL2 TVA marge = % (attendu 16.67)', r2->>'total_tva'; END IF;
  IF (r2->>'has_margin')::boolean <> true THEN RAISE EXCEPTION 'FAIL2 has_margin doit etre true'; END IF;

  -- TEST 3 — paiement lié à la vente d'occasion
  sid := (r2->>'sale_id')::uuid;
  rp := public.fiscal_record_payment(('{"actor_role":"patron","actor_user_id":"test","payment_type":"card","amount":300,"sale_id":"'||sid::text||'"}')::jsonb);
  RAISE NOTICE 'TEST3 paiement -> num=% hash=%', rp->>'payment_number', left(rp->>'current_hash',12);
  IF (rp->>'ok')::boolean <> true THEN RAISE EXCEPTION 'FAIL3 paiement'; END IF;

  -- TEST 4 — immuabilité : UPDATE d'une vente finalisée DOIT être bloqué
  BEGIN
    UPDATE fiscal_cashier.fiscal_sales SET total_ttc=999 WHERE id=sid;
    RAISE EXCEPTION 'FAIL4 UPDATE d''une vente finalisee a ete autorise';
  EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS4 UPDATE vente finalisee bloque'; END;

  -- TEST 5 — chaîne d'intégrité
  v := public.fiscal_verify_chain('SP-MACON-01');
  RAISE NOTICE 'TEST5 chaine -> %', v::text;
  IF (v->>'chaine_valide')::boolean <> true THEN RAISE EXCEPTION 'FAIL5 chaine invalide'; END IF;

  RAISE NOTICE '=========================================';
  RAISE NOTICE 'LOT 2 — TOUS LES TESTS : PASS';
  RAISE NOTICE '=========================================';
END $$;

-- Aperçu des lignes créées (TVA par régime)
SELECT label, vat_regime, total_ttc, total_ht, total_tva, purchase_price_ttc, margin_tva
FROM fiscal_cashier.fiscal_sale_lines
ORDER BY server_created_at;

ROLLBACK;
-- ============================================================================
-- Si vous voyez PASS1..PASS5 + "TOUS LES TESTS : PASS", le Lot 2 est bon.
-- (Le ROLLBACK a tout nettoyé : aucune vente de test ne reste.)
-- ============================================================================
