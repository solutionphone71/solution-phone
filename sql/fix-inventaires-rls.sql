-- /sql/fix-inventaires-rls.sql
-- Fix RLS bloquante sur tables inventaires
-- Erreur visée : "new row violates row-level security policy for table inventaires"
--
-- À exécuter dans Supabase SQL Editor

-- ─── 1. Force désactivation RLS ────────────────────────────────────
ALTER TABLE IF EXISTS inventaires       DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventaire_items  DISABLE ROW LEVEL SECURITY;

-- ─── 2. Supprime toute policy qui pourrait être en place ───────────
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('inventaires', 'inventaire_items') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
  END LOOP;
END $$;

-- ─── 3. Grants explicites pour TOUS les rôles ──────────────────────
GRANT ALL ON inventaires      TO anon, authenticated, service_role, postgres;
GRANT ALL ON inventaire_items TO anon, authenticated, service_role, postgres;

-- Séquences (sinon les INSERT plantent sur le bigserial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE inventaires_id_seq      TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON SEQUENCE inventaire_items_id_seq TO anon, authenticated, service_role;

-- ─── 4. Vérification ───────────────────────────────────────────────
SELECT
  schemaname,
  tablename,
  rowsecurity AS "rls_enabled",
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) AS "nb_policies"
FROM pg_tables t
WHERE tablename IN ('inventaires', 'inventaire_items')
ORDER BY tablename;

-- Devrait afficher : rls_enabled = false, nb_policies = 0
