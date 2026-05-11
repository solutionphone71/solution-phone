-- /sql/ia-memoire.sql
-- Solution Phone · Phase 1 Mémoire IA · mai 2026
--
-- Objectif : passer les agents IA de "exécutants amnésiques" à "équipe qui apprend".
-- 3 niveaux activés :
--   N1 · Mémoire courte des rejets (lecture des 10 dernières décisions)
--   N2 · Brand voice explicite (préférences éditoriales partagées)
--   N3 · Apprentissage par feedback (raisons de rejet → adaptation)
-- À exécuter dans Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════
-- N3 · Colonne feedback_reason sur agent_decisions
-- (raison du rejet : "trop_long" | "ton_creux" | "deja_fait"
--   | "non_pertinent" | "mauvais_timing" | "autre")
-- ════════════════════════════════════════════════════════════════
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS feedback_reason TEXT;
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS feedback_comment TEXT;
ALTER TABLE agent_decisions ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_agent_decisions_agent_type_status
  ON agent_decisions(agent_name, type, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_decisions_feedback
  ON agent_decisions(feedback_reason)
  WHERE feedback_reason IS NOT NULL;

COMMENT ON COLUMN agent_decisions.feedback_reason IS 'Pourquoi Sébastien a rejeté : trop_long | ton_creux | deja_fait | non_pertinent | mauvais_timing | autre';
COMMENT ON COLUMN agent_decisions.feedback_comment IS 'Commentaire libre du patron (optionnel)';

-- ════════════════════════════════════════════════════════════════
-- N2 · Brand voice par défaut (Sébastien peut éditer via /Paramètres)
-- Structure JSONB pour souplesse maximale.
-- ════════════════════════════════════════════════════════════════
INSERT INTO agent_memory (key, value)
VALUES ('brand_voice', '{
  "ton": "Direct, chaleureux, sans bullshit. Comme un voisin pro qui connaît son métier.",
  "tutoiement": "Vouvoiement par défaut. Tutoiement uniquement si le client tutoie d''abord.",
  "signature_posts": "Solution Phone Mâcon",
  "signature_avis": "L''équipe Solution Phone",
  "signature_sms": "Sébastien — Solution Phone",
  "emoji_max": 2,
  "longueur_post_lignes": "3-5",
  "longueur_avis_phrases": "2-3",
  "hashtags_favoris": ["solutionphone", "macon", "smartphone", "reparation", "qualirepar"],
  "hashtags_evites": ["bestoftheday", "instaday", "follow4follow"],
  "mots_evites": ["incroyable", "fabuleux", "génial", "magnifique", "extraordinaire", "n''hésitez pas"],
  "tournures_evitees": ["Bonjour cher client", "Nous sommes ravis", "C''est avec plaisir"],
  "valeurs": "Service rapide, prix juste, transparent, label QualiRépar, écologie (reconditionné), 3 boutiques Mâcon depuis 2014",
  "USP": "QualiRépar -25€ immédiat · Garantie 6 mois répa / 1 an reconditionné / 2 ans neuf · 4.7★ sur 552+ avis"
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- N3 · Vue helper : décisions rejetées récentes avec raison
-- (utilisée par les triggers IA pour ne pas répéter les erreurs)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_recent_rejects AS
SELECT
  agent_name,
  type,
  reasoning,
  payload,
  feedback_reason,
  feedback_comment,
  created_at,
  feedback_at
FROM agent_decisions
WHERE status IN ('rejected', 'expired')
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;

COMMENT ON VIEW v_recent_rejects IS 'Décisions rejetées ou expirées des 30 derniers jours — utilisées par les triggers IA pour adapter leur comportement';

-- ════════════════════════════════════════════════════════════════
-- N1 · Vue helper : décisions récentes par agent (toutes statuts)
-- (pour éviter les répétitions même si pas explicitement rejetées)
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_recent_decisions AS
SELECT
  id,
  agent_name,
  type,
  status,
  reasoning,
  payload,
  feedback_reason,
  created_at
FROM agent_decisions
WHERE created_at > NOW() - INTERVAL '14 days'
ORDER BY created_at DESC;

COMMENT ON VIEW v_recent_decisions IS 'Décisions des 14 derniers jours pour mémoire courte des agents';
