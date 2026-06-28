-- ============================================================================
-- CAISSE SÉCURISÉE v1.0 — LOT 1 — ROLLBACK (DOWN)
-- Annule intégralement le Lot 1. Le schéma "fiscal_cashier" étant ISOLÉ et
-- VIDE en Lot 1, sa suppression n'impacte AUCUNE autre table ni donnée.
-- À exécuter dans Supabase → SQL Editor.
-- ============================================================================
-- ⚠️ NE PAS exécuter si des écritures fiscales réelles ont déjà été créées
--    (Lots 2+). Le DROP supprimerait des données fiscales. En Lot 1 le schéma
--    est vide : rollback sûr.
-- ============================================================================

BEGIN;

-- Supprime le schéma et tout son contenu (tables, fonctions, triggers, séquences).
DROP SCHEMA IF EXISTS fiscal_cashier CASCADE;

-- L'extension pgcrypto est volontairement CONSERVÉE (peut être utilisée ailleurs).
-- Pour la retirer manuellement si vous êtes certain qu'elle n'est utilisée nulle part :
--   DROP EXTENSION IF EXISTS pgcrypto;

COMMIT;

-- ============================================================================
-- Rollback terminé. Vérification : le schéma ne doit plus exister.
--   SELECT schema_name FROM information_schema.schemata WHERE schema_name='fiscal_cashier';
--   -> 0 ligne attendue.
-- ============================================================================
