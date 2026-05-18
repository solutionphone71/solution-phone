-- /sql/production-templates-v2.sql
-- Solution Phone · 4 templates business en mode anti-hallucination v2
-- 18 mai 2026 · QualiRépar · Hydrogel · Avis 5★ · Cloture réparation
--
-- Même méthodologie que refine-new-phone-prompt.sql :
--   - Bloc REQUIRED TEXT STRINGS explicite
--   - Adresse simplifiée sans accents
--   - Interdiction d'inventer chiffres / textes
--   - Caps lock pour les mots qui doivent rester corrects
--
-- Plus création des 4 visual_jobs de test à la fin.

-- ══════════════════════════════════════════════════════════════════
-- 1. QUALIRÉPAR -25€
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\n══════════════════════════════════════════════════════════════════\nSPECIFIC SHOT — qualirepar_carre v2\n══════════════════════════════════════════════════════════════════\n\nA premium Instagram square 1080x1080 highlighting the QualiRépar label and the immediate -25€ discount at Solution Phone Mâcon.\n\nLAYOUT (50/50 split):\n\n- LEFT HALF : photorealistic medium-shot of a young technician wearing a black hoodie with the Solution Phone red "S" logo on chest, black nitrile gloves, holding a small precision screwdriver, repairing a disassembled smartphone on a blue QualiRépar repair mat. Microscope blurred in background. Atelier propre, lumière chaude latérale.\n\n- RIGHT HALF (dark backdrop) :\n   - TOP : Solution Phone red "S" logo (small)\n   - HUGE title in white Montserrat Extra Bold, 2 lines:\n        "REPARATEUR\n         LABELLISE"\n   - Below, in QualiRépar blue (#0066CC) Montserrat Extra Bold:\n        "QUALIREPAR"\n   - Below : a massive red rounded rectangle containing in white Montserrat Extra Bold:\n        "-25€ SUR VOTRE REPARATION"\n   - Below : 4 small icons + tiny Montserrat Regular white labels in a horizontal row:\n        "PIECES CERTIFIEES"  "REPARATION DE QUALITE"  "GARANTIE 6 MOIS"  "ECO-RESPONSABLE"\n\n- BOTTOM strip (full width) : a thin red bar with white Montserrat Regular small caps:\n        "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\n══════════════════════════════════════════════════════════════════\nREQUIRED TEXT STRINGS (copy character-for-character, do not invent any other text in image)\n══════════════════════════════════════════════════════════════════\n- "REPARATEUR LABELLISE"\n- "QUALIREPAR"\n- "-25€ SUR VOTRE REPARATION"\n- "PIECES CERTIFIEES"\n- "REPARATION DE QUALITE"\n- "GARANTIE 6 MOIS"\n- "ECO-RESPONSABLE"\n- "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\nABSOLUTE RULES:\n- No accents (write "REPARATEUR" not "RÉPARATEUR")\n- No other text in the image. No invented address, phone, URL or hashtag.\n- The discount is "-25€", never another number.\n- The warranty is "GARANTIE 6 MOIS", never another duration.\n- The QualiRépar logo color is blue (#0066CC), but blue must remain a tiny accent — palette stays 60% black / 30% white / 10% red.',
    updated_at = NOW()
WHERE name = 'qualirepar_carre';


-- ══════════════════════════════════════════════════════════════════
-- 2. HYDROGEL (gamme protection écran)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\n══════════════════════════════════════════════════════════════════\nSPECIFIC SHOT — hydrogel_carre v2\n══════════════════════════════════════════════════════════════════\n\nA premium Instagram square 1080x1080 for the Solution Phone hydrogel screen protection range.\n\nLAYOUT (top to bottom):\n\n- TOP : a small red pill badge with white Montserrat Extra Bold:\n        "PROTECTION ECRAN"\n- Below : two-word title arrangement\n        Word 1 in white Montserrat Extra Bold WITH a red strikethrough line across it: "VERRE TREMPE"\n        Word 2 directly underneath, MASSIVE Montserrat Extra Bold red: "HYDROGEL"\n- Below : a single line in Montserrat Regular white:\n        "Film auto-cicatrisant pose en 5 MIN"\n        (Make "5 MIN" pop in red)\n- CENTER : photorealistic close-up of a flexible transparent hydrogel film draping over a black smartphone, subtle red glow underneath the device, a few small abstract red shards floating around to suggest impact protection.\n- BOTTOM : 4 small product cards aligned in a row, each card:\n        Card 1: "CRYSTAL" (white Montserrat Extra Bold) — "25€" (red Montserrat Extra Bold)\n        Card 2: "OBSIDIAN" — "25€"\n        Card 3: "SAPHIR" — "15€"\n        Card 4: "ONYX" — "15€"\n- BOTTOM strip (full width) : thin red bar with white Montserrat Regular small caps:\n        "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\n══════════════════════════════════════════════════════════════════\nREQUIRED TEXT STRINGS (do not invent, do not translate, no accents)\n══════════════════════════════════════════════════════════════════\n- "PROTECTION ECRAN"\n- "VERRE TREMPE"\n- "HYDROGEL"\n- "Film auto-cicatrisant pose en 5 MIN"\n- "CRYSTAL", "25€"\n- "OBSIDIAN", "25€"\n- "SAPHIR", "15€"\n- "ONYX", "15€"\n- "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\nABSOLUTE RULES:\n- No accents anywhere ("POSE" not "POSÉ", "TREMPE" not "TREMPÉ")\n- Prices must be exactly 25€, 25€, 15€, 15€ — do not change a single digit\n- No invented hashtag, URL, phone number besides the one above',
    updated_at = NOW()
WHERE name = 'hydrogel_carre';


-- ══════════════════════════════════════════════════════════════════
-- 3. AVIS 5 ÉTOILES (repost avis Google)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\n══════════════════════════════════════════════════════════════════\nSPECIFIC SHOT — avis_5_etoiles_carre v2\n══════════════════════════════════════════════════════════════════\n\nA premium 1080x1080 Instagram square reposting a 5-star Google review for Solution Phone.\n\nLAYOUT (top to bottom):\n\n- TOP : a horizontal row of 5 large gold stars centered, then under it a small Montserrat Regular red label:\n        "AVIS GOOGLE 5 ETOILES"\n- CENTER : a large opening red quote mark, then the review comment as supplied in this exact wording, kept under 220 characters, in white Montserrat Regular italic, broken cleanly into 3-4 lines:\n        "{commentaire}"\n- BELOW QUOTE : a clean circular photo placeholder filled with a soft warm gray gradient (no fake face), 80px wide; to its right :\n        - Author in white Montserrat Extra Bold: "{auteur}"\n        - Subtle line below in Montserrat Regular light gray: "{date_relative}"\n- BOTTOM : Solution Phone red "S" logo (small) + thin red bar with white Montserrat Regular small caps:\n        "21 RUE GAMBETTA - 71000 MACON - solution-phone.fr"\n\n══════════════════════════════════════════════════════════════════\nREQUIRED TEXT STRINGS (do not invent, no accents)\n══════════════════════════════════════════════════════════════════\n- "AVIS GOOGLE 5 ETOILES"\n- "{commentaire}" (exact wording supplied)\n- "{auteur}" (exact name supplied)\n- "{date_relative}" (exact phrasing supplied)\n- "21 RUE GAMBETTA - 71000 MACON - solution-phone.fr"\n\nABSOLUTE RULES:\n- Quote text must be copied EXACTLY from variable, no paraphrase, no auto-correct\n- Do not add fake quotes around the customer name\n- Do not generate a fake profile picture of a person — use the gradient placeholder\n- Stars are gold (single accent), red is for quote mark only, palette stays disciplined',
    updated_at = NOW()
WHERE name = 'avis_5_etoiles_carre';


-- ══════════════════════════════════════════════════════════════════
-- 4. CLOTURE RÉPARATION (avant / après)
-- ══════════════════════════════════════════════════════════════════
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\n══════════════════════════════════════════════════════════════════\nSPECIFIC SHOT — cloture_repair_carre v2\n══════════════════════════════════════════════════════════════════\n\nA premium 1080x1080 Instagram square showing a before/after smartphone repair transformation for Solution Phone.\n\nLAYOUT:\n\n- VERTICAL SPLIT SCREEN with a thin red separator line in the middle\n- LEFT HALF (label "AVANT" in red Montserrat Extra Bold top-left) :\n   - Photorealistic shot of the {modele} smartphone with a heavily cracked, fractured screen, dramatic dark moody lighting, subtle red rim, broken glass spiderwebs visible\n- RIGHT HALF (label "APRES" in green Montserrat Extra Bold top-right) :\n   - The same {modele} smartphone, screen pristine and brilliant, soft red glow halo behind it, premium presentation\n- BOTTOM band (full width, black backdrop) :\n   - HUGE white Montserrat Extra Bold:\n        "REPARE EN MOINS D''1H"\n   - Subtitle in Montserrat Regular white smaller:\n        "{description_panne}"\n- IF qualirepar_eligible == true : a small blue QualiRépar badge "BONUS -25€" floating bottom-left\n- BOTTOM strip : thin red bar with white Montserrat Regular small caps:\n        "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\n══════════════════════════════════════════════════════════════════\nREQUIRED TEXT STRINGS (do not invent, no accents)\n══════════════════════════════════════════════════════════════════\n- "AVANT"\n- "APRES"\n- "REPARE EN MOINS D''1H"\n- "{description_panne}" (exact wording supplied)\n- if qualirepar_eligible: "BONUS -25€"\n- "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\nABSOLUTE RULES:\n- Spell "APRES" without accent, "REPARE" without accent\n- Do not invent a price, a duration, a percentage, or any number\n- Do not show a Solution Phone competitor logo\n- The cracked screen should look dramatic but not disgusting (avoid liquid, blood-like effects)',
    updated_at = NOW()
WHERE name = 'cloture_repair_carre';


-- ══════════════════════════════════════════════════════════════════
-- 5. SEED — 4 visual_jobs de test, un par template
-- ══════════════════════════════════════════════════════════════════

-- Job 2 : QualiRépar (pas de variables)
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', '{}'::jsonb,
    'format', '1080x1080',
    'kind', 'manual',
    'source', 'test_prod_qualirepar'
  )
FROM visual_templates WHERE name = 'qualirepar_carre';

-- Job 3 : Hydrogel (pas de variables)
INSERT INTO visual_jobs (template_id, status, brief)
SELECT id, 'queued',
  jsonb_build_object(
    'variables', '{}'::jsonb,
    'format', '1080x1080',
    'kind', 'manual',
    'source', 'test_prod_hydrogel'
  )
FROM visual_templates WHERE name = 'hydrogel_carre';

-- Job 4 : Avis 5 étoiles (avec un faux avis réaliste)
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

-- Job 5 : Cloture réparation (iPhone 14 écran cassé + QualiRépar)
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


-- ══════════════════════════════════════════════════════════════════
-- 6. CONFIRMATION
-- ══════════════════════════════════════════════════════════════════
SELECT
  id AS job_id,
  (SELECT name FROM visual_templates WHERE id = vj.template_id) AS template,
  status,
  brief->>'source' AS source
FROM visual_jobs vj
WHERE status = 'queued'
ORDER BY id;
