-- /sql/diag-cron-zero-jobs.sql
-- Solution Phone · Diagnostic — pourquoi process-queue renvoie 0 jobs ?

-- ── 1. RLS activé sur les tables visuelles ? ─────────────────────
SELECT
  tablename,
  rowsecurity AS rls_enabled,
  '⚠️ Si TRUE et pas de policy pour anon → cron ne voit rien' AS hint
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('visual_jobs','visual_assets','visual_templates','agent_decisions','agent_memory')
ORDER BY tablename;

-- ── 2. Policies existantes sur ces tables ────────────────────────
SELECT
  tablename,
  policyname,
  cmd AS operation,
  roles,
  LEFT(qual::text, 80) AS condition_preview
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('visual_jobs','visual_assets','visual_templates')
ORDER BY tablename, policyname;

-- ── 3. Le job test existe-t-il et son contenu ? ─────────────────
SELECT
  id, status, template_id, decision_id,
  brief->>'kind' AS kind,
  brief->>'source' AS source,
  created_at
FROM visual_jobs
ORDER BY id DESC
LIMIT 5;

-- ── 4. Combien de jobs en status='queued' au total ? ────────────
SELECT
  status,
  COUNT(*) AS nb
FROM visual_jobs
GROUP BY status;
