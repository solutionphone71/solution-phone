-- /sql/visuals-init.sql
-- Solution Phone · Intégration GPT-Image-1 (ChatGPT) · mai 2026
--
-- 4 tables :
--   visual_assets     : kit de marque (logo, mascotte, photos référence)
--   visual_templates  : templates de composition (5 de départ)
--   visual_jobs       : queue de génération asynchrone
--   ai_budget         : compteur quotidien Claude + OpenAI (garde-fou)
--
-- + RLS Storage pour bucket social_media (lecture publique, écriture API)
-- + Seed des 5 templates initiaux
-- À exécuter dans Supabase SQL Editor.

-- ════════════════════════════════════════════════════════════════
-- 1. visual_assets — kit de marque
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS visual_assets (
  id           BIGSERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,                -- 'logo' | 'tampon' | 'mascotte' | 'photo_boutique' | 'photo_produit' | 'reference_template'
  name         TEXT NOT NULL,                -- 'Logo SP carré HD'
  file_url     TEXT NOT NULL,                -- URL publique Supabase Storage
  storage_path TEXT NOT NULL,                -- 'visual_assets/logo-sp-hd.png'
  ai_reference BOOLEAN DEFAULT FALSE,        -- true = à passer en input image-to-image à GPT-Image-1
  width        INT,
  height       INT,
  size_bytes   INT,
  description  TEXT,                         -- "Logo principal noir + S rouge, fond transparent"
  tags         TEXT[],                       -- ['logo', 'branding', 'rouge']
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visual_assets_kind ON visual_assets(kind) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_visual_assets_ai_ref ON visual_assets(ai_reference) WHERE ai_reference = TRUE;
COMMENT ON TABLE visual_assets IS 'Kit de marque Solution Phone — référence visuelle pour GPT-Image-1 (image-to-image)';

-- ════════════════════════════════════════════════════════════════
-- 2. visual_templates — templates de composition validés
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS visual_templates (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL UNIQUE,    -- 'new_phone_carre'
  kind                TEXT NOT NULL,           -- 'post' | 'story' | 'reel' | 'carrousel'
  format              TEXT NOT NULL,           -- '1080x1080' | '1080x1920' | '1080x566' | '1080x1350'
  trigger_event       TEXT,                    -- 'new_phone' | 'promo' | 'avis_5_etoiles' | 'cloture_repair' | 'stock_alerte' | 'manual'
  description         TEXT,                    -- Pour l'UI : "Annonce d'un smartphone occasion ajouté en stock"
  base_prompt         TEXT NOT NULL,           -- Prompt OpenAI structuré avec {variables}
  reference_asset_ids BIGINT[],                -- IDs visual_assets à passer en image-to-image
  variables_schema    JSONB,                   -- { modele: 'string', prix: 'number', grade: 'string', ... }
  validation_count    INT DEFAULT 0,           -- nb de fois validé par Sébastien
  rejection_count     INT DEFAULT 0,
  last_used_at        TIMESTAMPTZ,
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_visual_templates_trigger ON visual_templates(trigger_event) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_visual_templates_kind ON visual_templates(kind) WHERE active = TRUE;
COMMENT ON TABLE visual_templates IS 'Templates de composition visuelle Assya/GPT-Image-1 — un template par type d''événement business';

-- ════════════════════════════════════════════════════════════════
-- 3. visual_jobs — queue de génération asynchrone
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS visual_jobs (
  id                 BIGSERIAL PRIMARY KEY,
  decision_id        UUID REFERENCES agent_decisions(id) ON DELETE CASCADE,
  template_id        BIGINT REFERENCES visual_templates(id),
  status             TEXT DEFAULT 'queued',         -- 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled'
  brief              JSONB NOT NULL,                -- { variables, format, kind, special_instructions }
  prompt_built       TEXT,                          -- Prompt OpenAI final assemblé
  reference_urls     TEXT[],                        -- URLs des assets passés en input
  image_url          TEXT,                          -- URL de l'image générée (publique Storage)
  image_path         TEXT,                          -- 'social_media/2026-05-12/job-123.png'
  render_duration_ms INT,
  cost_eur           NUMERIC(8,4),
  error_msg          TEXT,
  retries            INT DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  processed_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_visual_jobs_status
  ON visual_jobs(status, created_at)
  WHERE status IN ('queued', 'processing');
CREATE INDEX IF NOT EXISTS idx_visual_jobs_decision ON visual_jobs(decision_id);
COMMENT ON TABLE visual_jobs IS 'Queue de génération visuelle GPT-Image-1 — processée par cron /api/visual/process-queue toutes les 15 min';

-- ════════════════════════════════════════════════════════════════
-- 4. ai_budget — compteur quotidien (garde-fou financier)
-- ════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ai_budget (
  id              BIGSERIAL PRIMARY KEY,
  day             DATE NOT NULL,
  model           TEXT NOT NULL,            -- 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'gpt-image-1'
  requests_count  INT DEFAULT 0,
  input_tokens    BIGINT DEFAULT 0,
  output_tokens   BIGINT DEFAULT 0,
  cost_eur        NUMERIC(10,4) DEFAULT 0,
  UNIQUE (day, model)
);
CREATE INDEX IF NOT EXISTS idx_ai_budget_day ON ai_budget(day DESC);
COMMENT ON TABLE ai_budget IS 'Compteur quotidien des coûts IA — utilisé pour bloquer si dépassement du cap fixé dans agent_memory.ai_budget_caps';

-- ════════════════════════════════════════════════════════════════
-- Vue helper : budget du jour avec totaux
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE VIEW v_ai_budget_today AS
SELECT
  day,
  SUM(cost_eur) AS total_cost_eur,
  SUM(requests_count) AS total_requests,
  jsonb_object_agg(model, jsonb_build_object(
    'requests', requests_count,
    'cost_eur', cost_eur
  )) AS by_model
FROM ai_budget
WHERE day = CURRENT_DATE
GROUP BY day;

-- ════════════════════════════════════════════════════════════════
-- ÉTAPE MANUELLE : créer le bucket Storage "social_media" (public)
-- ════════════════════════════════════════════════════════════════
-- Va dans Supabase Dashboard → Storage → New bucket
--   - Name: social_media
--   - Public bucket: OUI (les visuels Insta doivent être publics)
--   - File size limit: 10 MB
--   - Allowed MIME types: image/png, image/jpeg, image/webp

-- ════════════════════════════════════════════════════════════════
-- POLITIQUES RLS Storage pour bucket social_media
-- ════════════════════════════════════════════════════════════════
DO $$
BEGIN
  DROP POLICY IF EXISTS "social_media_anon_insert" ON storage.objects;
  DROP POLICY IF EXISTS "social_media_anon_select" ON storage.objects;
  DROP POLICY IF EXISTS "social_media_anon_delete" ON storage.objects;
  DROP POLICY IF EXISTS "social_media_anon_update" ON storage.objects;
  DROP POLICY IF EXISTS "visual_assets_anon_insert" ON storage.objects;
  DROP POLICY IF EXISTS "visual_assets_anon_select" ON storage.objects;
  DROP POLICY IF EXISTS "visual_assets_anon_delete" ON storage.objects;
  DROP POLICY IF EXISTS "visual_assets_anon_update" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Bucket social_media (visuels Insta/FB générés — lecture publique pour Meta API)
CREATE POLICY "social_media_anon_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'social_media');
CREATE POLICY "social_media_anon_select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'social_media');
CREATE POLICY "social_media_anon_update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'social_media') WITH CHECK (bucket_id = 'social_media');
CREATE POLICY "social_media_anon_delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'social_media');

-- Bucket visual_assets (kit de marque — privé mais lisible par l'API)
CREATE POLICY "visual_assets_anon_insert"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'visual_assets');
CREATE POLICY "visual_assets_anon_select"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'visual_assets');
CREATE POLICY "visual_assets_anon_update"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'visual_assets') WITH CHECK (bucket_id = 'visual_assets');
CREATE POLICY "visual_assets_anon_delete"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'visual_assets');

-- ════════════════════════════════════════════════════════════════
-- SEED : 5 templates initiaux (à exécuter UNE FOIS)
-- ════════════════════════════════════════════════════════════════
INSERT INTO visual_templates (name, kind, format, trigger_event, description, base_prompt, variables_schema)
VALUES
-- Template 1 : new_phone (carré 1080x1080)
('new_phone_carre', 'post', '1080x1080', 'new_phone',
'Annonce d''un smartphone occasion ajouté en stock — format Instagram feed carré',
'Compose un visuel Instagram premium 1080x1080 pour Solution Phone (boutique de réparation/vente smartphones à Mâcon). Style obligatoire : fond noir profond, accents rouge vif (#c0392b et #FF3B45), typographie épaisse style Rajdhani Bold. Composition : logo "S" rouge Solution Phone en haut à gauche, badge rouge "NOUVEAU EN STOCK !" sous le logo, modèle "{modele}" en très grosse typo blanche au centre-gauche, prix "{prix}€" gigantesque rouge sous le modèle. Liste de 5 caractéristiques avec puces rondes rouges : "GRADE {grade}", "BATTERIE {batterie}%", "ÉTAT EXCELLENT", "GARANTIE 12 MOIS", "PIÈCES TESTÉES". À droite, photo réaliste premium du smartphone {modele} couleur {couleur} en perspective 3/4, posé sur un cercle rouge avec rayonnement lumineux et ombre portée prononcée. En bas : footer 3 colonnes "PAIEMENT SÉCURISÉ · LIVRAISON RAPIDE · SERVICE CLIENT 7/7", puis bandeau rouge "RÉPARATION • ACCESSOIRES • ACHAT • REVENTE". Style global : premium, Apple-meets-Tesla, cyberpunk subtil. Aucune faute d''orthographe. Pas d''emoji.',
'{"modele": "string", "prix": "number", "grade": "string", "batterie": "number", "couleur": "string"}'::jsonb),

-- Template 2 : promo
('promo_carre', 'post', '1080x1080', 'promo',
'Annonce d''une promo ou réduction — format carré',
'Compose un visuel Instagram premium 1080x1080 pour Solution Phone. Style identique au template "new_phone_carre" : fond noir, accents rouge vif, typo Rajdhani Bold. Composition centrée sur la promo : grand badge rouge en haut "PROMO -{reduction}€" ou "{type_promo}", titre central "{titre}" en blanc gros, sous-titre "{sous_titre}" en gris clair, CTA bas "DISPONIBLE EN BOUTIQUE". Mascotte robot Assya à droite (regard vers texte) si présente dans les références. Footer bandeau rouge "RÉPARATION • ACCESSOIRES • ACHAT • REVENTE". Premium, pas cheap.',
'{"titre": "string", "sous_titre": "string", "reduction": "number", "type_promo": "string"}'::jsonb),

-- Template 3 : avis_5_etoiles
('avis_5_etoiles_carre', 'post', '1080x1080', 'avis_5_etoiles',
'Repost d''un avis client 5 étoiles — format carré',
'Compose un visuel Instagram premium 1080x1080 pour Solution Phone. Style fond noir + accents rouge. Composition : badge "5 ÉTOILES" en haut avec 5 étoiles dorées/jaunes, photo de profil ronde du client (utiliser placeholder gris si pas de photo) avec son prénom "{auteur}" sous-titre "{date_relative}". Citation centrale en gros guillemets blancs : "{commentaire}". Signature bas "L''équipe Solution Phone vous remercie". Logo SP en bas à droite. Style témoignage premium, sobre, élégant. Pas de marketing creux.',
'{"auteur": "string", "commentaire": "string", "date_relative": "string"}'::jsonb),

-- Template 4 : cloture_repair (avant/après)
('cloture_repair_carre', 'post', '1080x1080', 'cloture_repair',
'Avant/après d''une réparation cloturée — format carré split-screen',
'Compose un visuel Instagram premium 1080x1080 pour Solution Phone — format avant/après. Split-screen vertical : à gauche photo du téléphone {modele} avec écran cassé/fissuré (style dramatique sombre), label rouge "AVANT" en haut. À droite même téléphone réparé écran neuf brillant, label vert "APRÈS" en haut. Au milieu un séparateur fin rouge. En bas : "TRANSFORMATION RÉUSSIE" en gros + "{description_panne} → Réparé en 30 min" en sous-titre. Badge QualiRépar -25€ si éligible. Fond noir, accents rouge. Footer "RÉPARATION • ACCESSOIRES • ACHAT • REVENTE".',
'{"modele": "string", "description_panne": "string", "qualirepar_eligible": "boolean"}'::jsonb),

-- Template 5 : stock_alerte (urgence)
('stock_alerte_carre', 'post', '1080x1080', 'stock_alerte',
'Alerte stock faible pour pousser à l''achat — format carré',
'Compose un visuel Instagram premium 1080x1080 pour Solution Phone. Style urgence : fond noir avec gradient rouge subtil, accents rouge vif néon. Composition : grand badge "DERNIERS EXEMPLAIRES" en haut, modèle "{modele} {stockage}" en très grand au centre, "PLUS QUE {stock} EN STOCK" en rouge néon, prix "{prix}€" gigantesque sous le titre. Photo du téléphone à droite avec effet "spotlight" qui souligne l''urgence. CTA bas "RÉSERVE LE TIEN MAINTENANT" + lien boutique. Mascotte Assya optionnelle. Footer "RÉPARATION • ACCESSOIRES • ACHAT • REVENTE".',
'{"modele": "string", "stockage": "string", "stock": "number", "prix": "number"}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- ════════════════════════════════════════════════════════════════
-- SEED : configuration budget par défaut dans agent_memory
-- ════════════════════════════════════════════════════════════════
INSERT INTO agent_memory (key, value)
VALUES ('ai_budget_caps', '{
  "daily_total_cap_eur": 5.00,
  "per_model_cap_eur": {
    "claude-sonnet-4-6": 2.00,
    "claude-haiku-4-5": 0.50,
    "gpt-image-1": 2.00
  },
  "alert_email": "sebastien.cannard@gmail.com",
  "alert_threshold_pct": 80,
  "stop_on_cap": true
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
