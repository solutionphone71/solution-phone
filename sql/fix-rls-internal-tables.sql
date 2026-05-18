-- /sql/fix-rls-internal-tables.sql
-- Solution Phone · Correctif RLS · 18 mai 2026
--
-- Diagnostic : RLS est activé sur visual_jobs (et probablement sur les autres
-- tables internes) sans AUCUNE policy → tout est bloqué pour anon/authenticated.
-- Résultat : le cron Vercel /api/visual/process-queue ne voit aucun job
-- alors qu'on en a créé un.
--
-- Solution : désactiver RLS sur les tables OPÉRATIONNELLES (utilisées
-- uniquement par le backend Vercel, jamais exposées directement aux
-- utilisateurs finaux). Ces tables n'ont pas besoin de RLS car :
--   - Elles ne contiennent pas de PII utilisateur final
--   - Elles ne sont jamais lues depuis le browser des clients
--   - Seuls les endpoints serveurs (api/*.js) y accèdent
--
-- Sécurité : la sécurité de ces tables repose désormais sur le secret de
-- la clé SUPABASE_KEY dans Vercel — non exposée publiquement.

-- ── Tables agents / décisions / mémoire IA ────────────────────────
ALTER TABLE agent_decisions DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory    DISABLE ROW LEVEL SECURITY;

-- ── Tables pipeline visuel ────────────────────────────────────────
ALTER TABLE visual_jobs      DISABLE ROW LEVEL SECURITY;
ALTER TABLE visual_templates DISABLE ROW LEVEL SECURITY;
ALTER TABLE visual_assets    DISABLE ROW LEVEL SECURITY;

-- ── Tables sociales (publications Insta/FB) ────────────────────────
ALTER TABLE social_posts DISABLE ROW LEVEL SECURITY;
ALTER TABLE social_logs  DISABLE ROW LEVEL SECURITY;

-- ── Compteur budget IA ─────────────────────────────────────────────
ALTER TABLE ai_budget DISABLE ROW LEVEL SECURITY;

-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION
-- ══════════════════════════════════════════════════════════════════
SELECT
  tablename,
  CASE WHEN rowsecurity THEN '🔒 ACTIVÉ' ELSE '✅ désactivé' END AS rls
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'agent_decisions','agent_runs','agent_memory',
    'visual_jobs','visual_templates','visual_assets',
    'social_posts','social_logs','ai_budget'
  )
ORDER BY tablename;
