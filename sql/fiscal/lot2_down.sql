-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 2 — ROLLBACK (DOWN)
-- Supprime les fonctions d'écriture et les colonnes TVA sur marge.
-- ⚠️ NE PAS exécuter si des ventes/paiements réels ont déjà été enregistrés
--    via le Lot 2 (les colonnes marge contiennent alors des données utiles).
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fiscal_record_sale(jsonb);
DROP FUNCTION IF EXISTS public.fiscal_record_payment(jsonb);
DROP FUNCTION IF EXISTS public.fiscal_verify_chain(text);

ALTER TABLE fiscal_cashier.fiscal_sale_lines
  DROP COLUMN IF EXISTS vat_regime,
  DROP COLUMN IF EXISTS purchase_price_ttc,
  DROP COLUMN IF EXISTS margin_ht,
  DROP COLUMN IF EXISTS margin_tva;

ALTER TABLE fiscal_cashier.fiscal_sales
  DROP COLUMN IF EXISTS has_margin;

COMMIT;
-- ============================================================================
