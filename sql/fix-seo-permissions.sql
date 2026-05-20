-- /sql/fix-seo-permissions.sql
-- Fix permissions Léo · 20 mai 2026
--
-- Diagnostic + correction des permissions sur les 6 tables Léo

-- ─── 1. Re-seed des mots-clés (idempotent) ─────────────────────────
INSERT INTO seo_keywords (keyword, priority) VALUES
  ('magasin de telephone macon', 1),
  ('reparation telephone macon', 1),
  ('reparation iphone macon', 1),
  ('reparation samsung macon', 2),
  ('reparation ecran iphone macon', 2),
  ('reparation batterie iphone macon', 2),
  ('telephone occasion macon', 2),
  ('telephone reconditionne macon', 2),
  ('iphone macon', 3),
  ('samsung macon', 3),
  ('rachat telephone macon', 3),
  ('solution phone macon', 1),
  ('qualirepar macon', 4),
  ('accessoire telephone macon', 4),
  ('coque iphone macon', 5)
ON CONFLICT (keyword) DO UPDATE SET active = true, priority = EXCLUDED.priority;

-- ─── 2. Force désactivation RLS sur les 6 tables Léo ───────────────
ALTER TABLE IF EXISTS seo_audits        DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gbp_posts         DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS keyword_rankings  DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seo_keywords      DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_requests   DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS seo_config        DISABLE ROW LEVEL SECURITY;

-- ─── 3. Grants explicites pour les rôles Supabase ──────────────────
GRANT ALL ON seo_audits        TO anon, authenticated, service_role;
GRANT ALL ON gbp_posts         TO anon, authenticated, service_role;
GRANT ALL ON keyword_rankings  TO anon, authenticated, service_role;
GRANT ALL ON seo_keywords      TO anon, authenticated, service_role;
GRANT ALL ON review_requests   TO anon, authenticated, service_role;
GRANT ALL ON seo_config        TO anon, authenticated, service_role;

-- Pareil pour les séquences (sinon les INSERT planteront)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ─── 4. Vérification ───────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM seo_keywords WHERE active = true) AS keywords_actifs,
  (SELECT COUNT(*) FROM seo_keywords) AS keywords_total,
  (SELECT COUNT(*) FROM seo_config) AS config_rows,
  (SELECT COUNT(*) FROM seo_audits) AS audits_done;

-- ─── 5. Liste des mots-clés (pour vérif visuelle) ──────────────────
SELECT id, keyword, priority, active FROM seo_keywords ORDER BY priority, keyword;
