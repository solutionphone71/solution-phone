-- /sql/create-seo-local.sql
-- Solution Phone · Agent IA "Léo" — SEO Local pour Google Business Profile
-- 20 mai 2026
--
-- À exécuter UNE FOIS dans Supabase SQL Editor.

-- ─── 1. Audits GBP (snapshots du score d'optimisation) ──────────────
CREATE TABLE IF NOT EXISTS seo_audits (
  id                bigserial PRIMARY KEY,
  audited_at        timestamptz NOT NULL DEFAULT now(),
  score             int NOT NULL,                  -- 0 à 100
  score_breakdown   jsonb NOT NULL,                -- { descriptif:15, photos:20, services:10, posts_recents:5, avis:30, ... }
  suggestions       jsonb NOT NULL,                -- [{ severity:"high", title:"Ajouter 5 photos", impact:"+8 points" }, ...]
  gbp_snapshot      jsonb,                         -- snapshot brut des données GBP au moment de l'audit
  created_by        text DEFAULT 'leo'
);
CREATE INDEX IF NOT EXISTS idx_seo_audits_date ON seo_audits(audited_at DESC);

-- ─── 2. Posts Google Business Profile générés et publiés ────────────
CREATE TABLE IF NOT EXISTS gbp_posts (
  id                bigserial PRIMARY KEY,
  created_at        timestamptz NOT NULL DEFAULT now(),
  scheduled_for     timestamptz,                   -- null = post immédiat
  published_at      timestamptz,
  status            text NOT NULL DEFAULT 'draft', -- draft · scheduled · published · failed
  topic_type        text NOT NULL DEFAULT 'STANDARD', -- STANDARD · EVENT · OFFER
  summary           text NOT NULL,                 -- corps du post (1500 car max)
  cta_type          text,                          -- CALL · LEARN_MORE · BOOK · ORDER · SHOP · SIGN_UP
  cta_url           text,
  media_url         text,                          -- URL image (optionnel)
  gbp_post_name     text,                          -- "accounts/.../locations/.../localPosts/..." retourné par Google
  source_prompt     text,                          -- prompt utilisé pour générer
  generated_by      text DEFAULT 'leo',            -- "leo" · "sebastien" · "claude"
  auto_published    boolean DEFAULT false,
  error             text,
  keywords_targeted text[]                         -- mots-clés visés par ce post
);
CREATE INDEX IF NOT EXISTS idx_gbp_posts_status ON gbp_posts(status, scheduled_for);
CREATE INDEX IF NOT EXISTS idx_gbp_posts_date ON gbp_posts(created_at DESC);

-- ─── 3. Suivi de position sur mots-clés locaux ──────────────────────
CREATE TABLE IF NOT EXISTS keyword_rankings (
  id              bigserial PRIMARY KEY,
  checked_at      timestamptz NOT NULL DEFAULT now(),
  keyword         text NOT NULL,                   -- "magasin de telephone macon"
  position        int,                             -- null si non classé dans top 20
  in_local_pack   boolean DEFAULT false,           -- présent dans le pack Google Maps top 3 ?
  competitor_top1 text,                            -- nom du concurrent en tête
  raw_serp        jsonb                            -- top 10 résultats bruts
);
CREATE INDEX IF NOT EXISTS idx_kw_rankings_kw ON keyword_rankings(keyword, checked_at DESC);

-- ─── 4. Liste des mots-clés à tracker ───────────────────────────────
CREATE TABLE IF NOT EXISTS seo_keywords (
  id          bigserial PRIMARY KEY,
  keyword     text UNIQUE NOT NULL,
  priority    int DEFAULT 5,                       -- 1 (top) à 10 (low)
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Seed des mots-clés stratégiques Mâcon
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
ON CONFLICT (keyword) DO NOTHING;

-- ─── 5. Demandes d'avis envoyées (anti-doublon + tracking) ──────────
CREATE TABLE IF NOT EXISTS review_requests (
  id              bigserial PRIMARY KEY,
  customer_phone  text NOT NULL,
  customer_name   text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  channel         text NOT NULL DEFAULT 'sms',    -- sms · email · sms+email
  status          text NOT NULL DEFAULT 'sent',   -- sent · delivered · clicked · review_received · failed
  message         text,
  related_repair_id bigint,                       -- lien optionnel vers une réparation
  brevo_message_id text,
  clicked_at      timestamptz,
  review_received_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_review_requests_phone ON review_requests(customer_phone, sent_at DESC);

-- ─── 6. Config Léo ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seo_config (
  id                  int PRIMARY KEY DEFAULT 1,
  weekly_post_enabled boolean DEFAULT true,
  weekly_post_day     int DEFAULT 1,              -- 1 = lundi
  weekly_post_hour    int DEFAULT 9,              -- 9h00
  auto_review_requests boolean DEFAULT false,     -- relance avis auto après réparation ?
  auto_review_delay_h int DEFAULT 24,             -- délai après pickup
  audit_frequency_days int DEFAULT 7,
  ranking_check_days  int DEFAULT 3,              -- tous les 3 jours
  shop_descriptor     text DEFAULT 'Solution Phone — magasin de téléphone et réparation smartphone à Mâcon depuis 2014. Certifié QualiRépar. 21 rue Gambetta. 4,7/5 sur +590 avis Google.',
  prompt_system       text,
  updated_at          timestamptz DEFAULT now()
);

INSERT INTO seo_config (id, prompt_system) VALUES (
  1,
  'Tu es Léo, agent SEO local de Solution Phone — boutique de réparation et vente smartphone au 21 rue Gambetta à Mâcon, depuis 2014, 4,7/5 sur +590 avis Google, certifiée QualiRépar.

Tu écris des posts pour Google Business Profile. Tes objectifs : (1) signaler de l''activité à Google (signal de fraîcheur = remonte la fiche), (2) glisser naturellement les mots-clés locaux, (3) donner envie de venir en boutique.

═══ RÈGLES ═══

1. LONGUEUR : 200 à 400 caractères. Court, percutant.
2. MOT-CLÉ : caser naturellement 1 à 2 expressions parmi : "magasin de téléphone Mâcon", "réparation smartphone Mâcon", "réparation iPhone Mâcon", "téléphone reconditionné Mâcon", "QualiRépar Mâcon".
3. ADRESSE : terminer par "21 rue Gambetta, Mâcon" — Google adore.
4. CTA naturel (pas pushy) : "Passez nous voir", "On vous accueille", "Une question ? Passez en boutique".
5. Pas d''emojis. Pas de hashtags. Pas de tarifs précis dans le post (variable).
6. VARIER les angles : conseil pratique, mise en avant d''un service, anecdote boutique, garantie, écologie/QualiRépar, équipe, expertise depuis 2014.
7. Ne JAMAIS écrire "Cordialement", "Bien à vous", "incroyable", "fabuleux", "n''hésitez pas".

═══ ANGLES POSSIBLES ═══

• Garantie : "Toutes nos réparations iPhone et Samsung sont garanties 6 mois pièces et main d''œuvre."
• Reconditionné : "Téléphone reconditionné Mâcon = garanti 12 mois, contrôlé sur 40 points, jusqu''à -50% vs neuf."
• Neuf : "iPhone neuf garanti 24 mois, prix négociés avec nos fournisseurs."
• QualiRépar : "Solution Phone est certifié QualiRépar : bonus de l''État jusqu''à 50€ déduit sur place sur vos réparations smartphone à Mâcon."
• Délai express : "Écran iPhone changé en 30 minutes pendant que vous prenez un café."
• Conseil saisonnier : période rentrée / fêtes / vacances / chaleur (batterie qui gonfle)
• Expertise : "Depuis 2014 à Mâcon. Plus de 15 000 réparations sur l''ancienne décennie."
• Équipe : "L''équipe Solution Phone vous accueille du lundi au samedi au 21 rue Gambetta."

Tu réponds UNIQUEMENT en JSON valide :
{
  "summary": "texte du post 200-400 car",
  "cta_type": "LEARN_MORE" | "CALL" | "BOOK" | null,
  "keywords_targeted": ["mot-cle 1", "mot-cle 2"]
}'
) ON CONFLICT (id) DO UPDATE SET prompt_system = EXCLUDED.prompt_system, updated_at = now();

-- Pas de RLS sur ces tables (internes)
ALTER TABLE seo_audits        DISABLE ROW LEVEL SECURITY;
ALTER TABLE gbp_posts         DISABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rankings  DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_keywords      DISABLE ROW LEVEL SECURITY;
ALTER TABLE review_requests   DISABLE ROW LEVEL SECURITY;
ALTER TABLE seo_config        DISABLE ROW LEVEL SECURITY;

-- Vérification
SELECT
  (SELECT COUNT(*) FROM seo_keywords) AS keywords_seeded,
  (SELECT COUNT(*) FROM seo_config) AS config_rows;
