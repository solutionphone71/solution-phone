-- /sql/reset-test-job.sql
-- Diagnostic + reset du job test pour relancer avec le nouveau maxDuration=60s

-- ─── A. Voir l'état actuel du job ────────────────────────────────────
SELECT
  id, status, retries,
  COALESCE(error_msg, '∅ pas d''erreur') AS error,
  processed_at,
  EXTRACT(EPOCH FROM (NOW() - created_at))::int AS age_seconds
FROM visual_jobs
ORDER BY id DESC
LIMIT 5;

-- ─── B. Reset du job 1 (et tout job orphelin en 'processing') ───────
UPDATE visual_jobs
SET status      = 'queued',
    retries     = 0,
    error_msg   = NULL,
    processed_at = NULL
WHERE id = 1
   OR status = 'processing';

-- ─── C. Confirmation ────────────────────────────────────────────────
SELECT id, status, retries, 'remis à queued' AS action
FROM visual_jobs
WHERE id = 1;
