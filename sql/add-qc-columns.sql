-- /sql/add-qc-columns.sql
-- Solution Phone · Ajout colonnes Quality-Check sur visual_jobs
-- À exécuter UNE FOIS pour stocker les verdicts Claude vision.

ALTER TABLE visual_jobs
  ADD COLUMN IF NOT EXISTS qc_verdict  JSONB,
  ADD COLUMN IF NOT EXISTS qc_score    NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS qc_passed   BOOLEAN,
  ADD COLUMN IF NOT EXISTS qc_cost_eur NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS qc_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_visual_jobs_qc_passed
  ON visual_jobs(qc_passed) WHERE qc_passed IS NOT NULL;

COMMENT ON COLUMN visual_jobs.qc_verdict IS 'Verdict structuré Claude vision (issues, suggested_changes, reasoning)';
COMMENT ON COLUMN visual_jobs.qc_score   IS 'Note 0-10 du QC visuel automatique';
COMMENT ON COLUMN visual_jobs.qc_passed  IS 'true = visuel jugé publiable, false = à retravailler';
