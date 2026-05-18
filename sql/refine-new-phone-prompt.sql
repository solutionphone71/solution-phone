-- /sql/refine-new-phone-prompt.sql
-- Solution Phone · Itération #2 du template new_phone_carre
-- 18 mai 2026 · raffinage anti-hallucination textes
--
-- Bugs constatés sur job-1.png (1ère génération) :
--   ❌ "BATTERIE 62%" au lieu de 92% → variable mal interprétée
--   ❌ "ETAI EXCELLENT" au lieu de "ÉTAT EXCELLENT" → faute IA
--   ❌ "GARANTIE 0 MOIS" au lieu de 12 → hallucination chiffre
--   ❌ Adresse hallucinée ("51 New Snccoss - 1.500 Blazes...") → invention IA
--
-- Stratégie de prompt engineering :
--   1. Bloc TEXT_STRINGS explicite, chaque ligne entre quotes, ordre figé
--   2. Instruction "DO NOT INVENT, DO NOT TRANSLATE, COPY CHARACTER BY CHARACTER"
--   3. Adresse réduite à une ligne ultra-simple sans accents
--   4. Moins de texte total = moins d'opportunités d'hallucination

UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\n══════════════════════════════════════════════════════════════════\nSPECIFIC SHOT — new_phone_carre v2\n══════════════════════════════════════════════════════════════════\n\nA premium Instagram square 1080x1080 announcing a refurbished smartphone in stock at Solution Phone Mâcon.\n\nLAYOUT (zones, no other text anywhere in image):\n\n- TOP LEFT : the red rounded square "S" Solution Phone logo only (no extra wordmark since the logo already contains it).\n- TOP RIGHT : a red pill badge containing ONLY this text in Montserrat Extra Bold white:\n    "NOUVEAU EN STOCK"\n- CENTER LEFT : the model name "{modele}" in HUGE white Montserrat Extra Bold, max 2 lines.\n- BELOW MODEL : the price in HUGE red Montserrat Extra Bold:\n    "{prix} €"\n- BELOW PRICE : exactly 5 bullet rows. Each row = small red dot + Montserrat Extra Bold white text. The 5 texts in this exact order:\n    1. "GRADE {grade}"\n    2. "BATTERIE {batterie}%"\n    3. "ETAT EXCELLENT"\n    4. "GARANTIE 12 MOIS"\n    5. "PIECES TESTEES"\n- CENTER RIGHT : photorealistic 3/4 perspective of an AUTHENTIC {modele} in {couleur} color, floating, subtle red glow halo behind, soft drop shadow below. SHOW the genuine manufacturer logo on the back of the device (Apple bitten apple for iPhones, Samsung wordmark for Galaxy, Xiaomi/Huawei/Oppo logo for those brands). Solution Phone sells AUTHENTIC refurbished smartphones — a logo-less device would suggest a counterfeit. The brand logo must appear ONLY on the device back, never elsewhere in the visual (no banner with Apple logo, no fake partnership badge).\n- BOTTOM : a thin red horizontal bar with this text centered, Montserrat Extra Bold white small caps:\n    "REPARATION · ACCESSOIRES · ACHAT · REVENTE"\n- BELOW THE RED BAR : a single line of Montserrat Regular white, smaller:\n    "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\n══════════════════════════════════════════════════════════════════\nCRITICAL TEXT RULES — read carefully\n══════════════════════════════════════════════════════════════════\n\n1. The image must contain ONLY the following text strings, character-for-character, no addition, no substitution, no translation, no abbreviation:\n     - "NOUVEAU EN STOCK"\n     - "{modele}"\n     - "{prix} €"\n     - "GRADE {grade}"\n     - "BATTERIE {batterie}%"\n     - "ETAT EXCELLENT"\n     - "GARANTIE 12 MOIS"\n     - "PIECES TESTEES"\n     - "REPARATION · ACCESSOIRES · ACHAT · REVENTE"\n     - "21 RUE GAMBETTA - 71000 MACON - 03 85 33 06 89"\n\n2. DO NOT invent any other text. DO NOT add a phone number, an address, a tagline, a URL, a hashtag, or any other characters that are not in the list above.\n\n3. DO NOT translate or paraphrase any of the above. Copy them exactly as written.\n\n4. DO NOT modify any digit. The battery percentage is "{batterie}", not any other number. The warranty for a refurbished smartphone is "12 MOIS", not "0 MOIS" or "6 MOIS" or any other duration.\n\n5. Spell-check ABSOLUTELY: the word is "ETAT" (E-T-A-T), never "ETAI" or "ETHAT".\n\n6. Avoid accents in baked image text (e.g. write "ETAT" not "ÉTAT", "REPARATION" not "RÉPARATION"). Accents tend to corrupt in image generation.\n\n══════════════════════════════════════════════════════════════════\nVARIABLES PROVIDED\n══════════════════════════════════════════════════════════════════\nmodele   = {modele}\nprix     = {prix}\ngrade    = {grade}\nbatterie = {batterie}\ncouleur  = {couleur}',
    updated_at = NOW()
WHERE name = 'new_phone_carre';


-- ── Reset du job 1 pour le rejouer avec le nouveau prompt ────────
UPDATE visual_jobs
SET status      = 'queued',
    retries     = 0,
    error_msg   = NULL,
    processed_at = NULL,
    image_url   = NULL,
    image_path  = NULL,
    prompt_built = NULL
WHERE id = 1;

-- ── Confirmation ─────────────────────────────────────────────────
SELECT 'Prompt mis à jour' AS action, name, LENGTH(base_prompt) AS prompt_chars
FROM visual_templates WHERE name='new_phone_carre';

SELECT 'Job remis en queue' AS action, id, status, retries
FROM visual_jobs WHERE id=1;
