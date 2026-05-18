-- /sql/seed-test-jobs-simple.sql
-- Solution Phone · Seed minimal de 4 jobs de test
-- Pas de refonte de prompts — on teste les templates v1 tels quels.

-- Job QualiRépar (pas de variables)
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', '{}'::jsonb,
    'format', '1080x1080',
    'kind', 'manual',
    'source', 'test_prod_qualirepar'
  )
FROM visual_templates WHERE name = 'qualirepar_carre';

-- Job Hydrogel (pas de variables)
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', '{}'::jsonb,
    'format', '1080x1080',
    'kind', 'manual',
    'source', 'test_prod_hydrogel'
  )
FROM visual_templates WHERE name = 'hydrogel_carre';

-- Job Avis 5 étoiles
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', jsonb_build_object(
      'auteur',        'Sophie M.',
      'commentaire',   'Ecran iPhone 13 change en 30 min, prix tres correct, equipe au top. Je recommande sans hesiter.',
      'date_relative', 'il y a 2 jours'
    ),
    'format', '1080x1080',
    'kind', 'avis_5_etoiles',
    'source', 'test_prod_avis'
  )
FROM visual_templates WHERE name = 'avis_5_etoiles_carre';

-- Job Cloture réparation (iPhone 14 + QualiRépar)
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', jsonb_build_object(
      'modele',              'iPhone 14',
      'description_panne',   'Ecran casse remplace - garantie 6 mois',
      'qualirepar_eligible', true
    ),
    'format', '1080x1080',
    'kind', 'cloture_repair',
    'source', 'test_prod_cloture'
  )
FROM visual_templates WHERE name = 'cloture_repair_carre';

-- Confirmation : liste des jobs en queue
SELECT
  vj.id AS job_id,
  vt.name AS template,
  vj.status,
  vj.brief->>'source' AS source
FROM visual_jobs vj
LEFT JOIN visual_templates vt ON vt.id = vj.template_id
WHERE vj.status = 'queued'
ORDER BY vj.id;
