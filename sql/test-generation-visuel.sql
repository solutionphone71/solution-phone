-- /sql/test-generation-visuel.sql
-- Solution Phone · Test de bout-en-bout du pipeline visuel
-- À exécuter UNE FOIS dans Supabase SQL Editor pour créer 1 job test.
--
-- Ce SQL :
--   1. Crée 1 visual_job test pour le template "new_phone_carre"
--      avec un faux iPhone 13 (variables réalistes)
--   2. Ne crée aucune décision (decision_id NULL) — donc pas de pollution
--   3. Retourne l'id du job créé
--
-- Étape suivante : ouvrir https://app.solution-phone.fr/api/visual/process-queue
-- dans ton navigateur — le cron va lancer la génération.

INSERT INTO visual_jobs (template_id, status, brief)
SELECT
  id,
  'queued',
  jsonb_build_object(
    'variables', jsonb_build_object(
      'modele',   'iPhone 13',
      'prix',     349,
      'grade',    'A',
      'batterie', 92,
      'couleur',  'Noir'
    ),
    'format', '1080x1080',
    'kind',   'new_phone',
    'source', 'test_manuel_first_generation'
  )
FROM visual_templates
WHERE name = 'new_phone_carre'
RETURNING id AS job_id, template_id, status, created_at;
