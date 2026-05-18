-- /sql/brand-attach-references.sql
-- Solution Phone · Étape finale — rattacher les visual_assets aux templates
-- À exécuter UNE FOIS dans Supabase SQL Editor, APRÈS :
--   1. Avoir lancé scripts/upload-brand-assets.js (les 13 rows visual_assets existent)
--   2. Avoir exécuté sql/brand-update-2026-05.sql (les templates ont les bons base_prompt)
--
-- Effet : chaque template visuel sera désormais nourri d'images de référence
-- spécifiques. gpt-image-1 les recevra en image-to-image et imitera leur style.

-- ══════════════════════════════════════════════════════════════════
-- Template "new_phone_carre" — annonce smartphone occasion ajouté
-- Références : logo + ambiance atelier + héros carré
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Atelier microscope iPhone fissuré (ambiance)'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'new_phone_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "promo_carre" — promotion / réduction
-- Références : logo + héros carré (charte typographique forte)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'promo_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "avis_5_etoiles_carre" — repost avis Google 5★
-- Références : logo + héros carré (lay-out éditorial premium)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'avis_5_etoiles_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "cloture_repair_carre" — avant/après réparation
-- Références : logo + ambiance atelier + photo technicien
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Atelier microscope iPhone fissuré (ambiance)'),
  (SELECT id FROM visual_assets WHERE name = 'Technicien atelier QualiRépar (photo)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'cloture_repair_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "stock_alerte_carre" — derniers exemplaires
-- Références : logo + héros carré
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'stock_alerte_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "qualirepar_carre" — label QualiRépar -25€
-- Références : logo + photo technicien + visuel QualiRépar carré
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Technicien atelier QualiRépar (photo)'),
  (SELECT id FROM visual_assets WHERE name = 'QualiRépar labellisé (carré 1080)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'qualirepar_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "hydrogel_carre" — gamme protection écran
-- Références : logo + visuel hydrogel
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Hydrogel — Protection écran (vertical)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'hydrogel_carre';

-- ══════════════════════════════════════════════════════════════════
-- Template "story_vertical" — Story Insta 9:16
-- Références : logo + héros vertical (format proche)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (vertical)')
]::bigint[],
    updated_at = NOW()
WHERE name = 'story_vertical';


-- ══════════════════════════════════════════════════════════════════
-- VÉRIFICATION FINALE — lance cette requête pour voir l'état
-- ══════════════════════════════════════════════════════════════════
-- Cette SELECT te montre chaque template avec le nb de références branchées.
-- Tu dois voir 8 lignes, toutes avec nb_refs >= 2.
SELECT
  t.name,
  t.kind,
  t.format,
  array_length(t.reference_asset_ids, 1) AS nb_refs,
  t.trigger_event
FROM visual_templates t
WHERE t.active = TRUE
ORDER BY t.name;
