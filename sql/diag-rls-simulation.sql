-- /sql/diag-rls-simulation.sql
-- Simule exactement ce que fait Vercel quand le cron lit visual_jobs.
-- 3 tests : anon, authenticated, service_role.

-- ── TEST 1 : Lecture avec le rôle "anon" (clé publique sb_publishable_) ──
SET ROLE anon;
SELECT 'TEST 1 — Rôle anon' AS test, COUNT(*) AS jobs_visibles
FROM visual_jobs WHERE status = 'queued';
RESET ROLE;

-- ── TEST 2 : Lecture avec le rôle "authenticated" (utilisateur connecté) ──
SET ROLE authenticated;
SELECT 'TEST 2 — Rôle authenticated' AS test, COUNT(*) AS jobs_visibles
FROM visual_jobs WHERE status = 'queued';
RESET ROLE;

-- ── TEST 3 : Lecture avec le rôle "service_role" (clé sb_secret_) ──
SET ROLE service_role;
SELECT 'TEST 3 — Rôle service_role' AS test, COUNT(*) AS jobs_visibles
FROM visual_jobs WHERE status = 'queued';
RESET ROLE;

-- ── TEST 4 : Vérifie l'état RLS de la table ──
SELECT
  'TEST 4 — RLS status' AS test,
  CASE WHEN c.relrowsecurity THEN '🔒 RLS ACTIVÉ' ELSE '🔓 RLS désactivé' END AS rls_status,
  (SELECT COUNT(*) FROM pg_policy WHERE polrelid = c.oid) AS nb_policies
FROM pg_class c
WHERE c.relname = 'visual_jobs';
