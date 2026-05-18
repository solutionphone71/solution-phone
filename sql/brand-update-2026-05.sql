-- /sql/brand-update-2026-05.sql
-- Solution Phone · Mise à jour officielle charte v1 · 18 mai 2026
--
-- Objectif : passer les templates de l'ancienne charte "Rajdhani Bold + #c0392b"
-- à la charte officielle "Montserrat Extra Bold + #E10600".
-- Et étendre agent_memory.brand_voice avec le bloc VISUEL (jusqu'ici purement textuel).
--
-- À exécuter UNE FOIS dans Supabase SQL Editor.

-- ══════════════════════════════════════════════════════════════════
-- 1. ÉTEND brand_voice avec le bloc visuel officiel
-- ══════════════════════════════════════════════════════════════════
UPDATE agent_memory
SET value = value || '{
  "visual_charter": {
    "version": "v1-2026-05-18",
    "colors": {
      "rouge_signature": "#E10600",
      "blanc_pur": "#FFFFFF",
      "noir_profond": "#0D0D0D",
      "qualirepar_bleu": "#0066CC",
      "ratio_60_30_10": "60% rouge · 30% blanc · 10% noir"
    },
    "typography": {
      "principale": "Montserrat Extra Bold (800)",
      "secondaire": "Montserrat Regular (400)",
      "interdites": ["Rajdhani", "Impact", "Comic Sans", "Bebas Neue"]
    },
    "style": "Apple × Tesla × B&O × Aesop · cinematic premium minimalist tech",
    "interdits_visuels": [
      "couleurs flashy hors charte",
      "dégradés rainbow",
      "gaming RGB",
      "design cheap",
      "effets 3D exagérés",
      "typographies cartoon",
      "glow excessif",
      "surcharge visuelle"
    ],
    "engagements": {
      "rapidite": "90% des réparations en moins d''1 heure",
      "garantie": "Garantie 6 mois pièces et main d''œuvre",
      "anciennete": "Depuis 2014 à Mâcon",
      "avis": "+590 avis Google · note 4,7/5",
      "sav": "SAV de qualité"
    },
    "promesse_premium": {
      "titre": "LE PRIX JUSTE GARANTI",
      "texte": "Si vous trouvez moins cher à qualité égale, nous remboursons la différence.",
      "mention_legale": "*Sur présentation d''un devis concurrent local avec qualité de pièce équivalente."
    },
    "contact": {
      "adresse": "21 Rue Gambetta, 71000 Mâcon",
      "tel": "03 85 33 06 89",
      "horaires": "Lundi au Samedi, 10h-19h",
      "site": "solution-phone.fr"
    }
  }
}'::jsonb,
    updated_at = NOW()
WHERE key = 'brand_voice';

-- Si la clé n'existait pas, on l'insère intégralement (cas d'install fraîche)
INSERT INTO agent_memory (key, value)
SELECT 'brand_voice', '{
  "ton": "Direct, chaleureux, sans bullshit. Comme un voisin pro qui connaît son métier.",
  "tutoiement": "Vouvoiement par défaut. Tutoiement uniquement si le client tutoie d''abord.",
  "signature_posts": "Solution Phone Mâcon",
  "signature_avis": "L''équipe Solution Phone",
  "signature_sms": "Sébastien — Solution Phone",
  "emoji_max": 2,
  "longueur_post_lignes": "3-5",
  "longueur_avis_phrases": "2-3",
  "visual_charter": {
    "version": "v1-2026-05-18",
    "colors": {
      "rouge_signature": "#E10600",
      "blanc_pur": "#FFFFFF",
      "noir_profond": "#0D0D0D",
      "qualirepar_bleu": "#0066CC"
    },
    "typography": {
      "principale": "Montserrat Extra Bold (800)",
      "secondaire": "Montserrat Regular (400)"
    }
  }
}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM agent_memory WHERE key = 'brand_voice');


-- ══════════════════════════════════════════════════════════════════
-- 2. STOCKE le master visual prompt en mémoire IA (réutilisable partout)
-- ══════════════════════════════════════════════════════════════════
INSERT INTO agent_memory (key, value)
VALUES ('master_visual_prompt', to_jsonb('
BRAND: Solution Phone — premium smartphone repair shop in Mâcon, France, since 2014.

OVERALL STYLE: Apple keynote × Tesla × Bang & Olufsen × Aesop. Cinematic, premium, minimalist, modern tech high-end. NEVER cheap. NEVER discount-shop. NEVER gaming RGB. NEVER cartoonish.

STRICT COLOR PALETTE (60/30/10):
- 60% deep matte black backdrop (#0D0D0D)
- 30% pure white (#FFFFFF) for typography and breathing
- 10% signature red (#E10600) used ONLY as accents: glow, CTA, logo, highlights
No other saturated colors. Exception: QualiRépar blue #0066CC only when label is shown.

LIGHTING: dramatic side lighting at 45 degrees, subtle red rim-light, soft cinematic falloff, sharp specular highlights on glass and metal.

COMPOSITION: ultra minimalist, generous negative space, product hero centered or rule-of-thirds, one dominant message + one clear CTA, mobile-first readability.

TYPOGRAPHY (when text in image): Montserrat Extra Bold 800 for titles/slogans/CTAs/prices. Montserrat Regular 400 for body. ALL CAPS for hero phrases. White text on black, red on key words.

MATERIALS: matte black backgrounds (carbon fiber, anodized metal), premium glass with crisp reflections, chrome/silver metallic finishes.

QUALITY: 8K perceived detail, professional studio photography, shallow depth of field f/2.8-f/4, cinematic grade with deep blacks and controlled highlights.

FORBIDDEN: watermarks, rainbow gradients, RGB neon, 3D cartoon, cheap retail typography, cluttered backgrounds, generic stock photos, lens flare filters, over-saturation, emojis in image.
'::text))
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();


-- ══════════════════════════════════════════════════════════════════
-- 3. CORRIGE les 5 templates initiaux : on remplace les base_prompt
--    pour utiliser le master prompt + la charte officielle
-- ══════════════════════════════════════════════════════════════════

-- Template 1 : new_phone (smartphone occasion ajouté)
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\nSPECIFIC SHOT:\nA premium Instagram square 1080x1080 visual announcing a refurbished smartphone now in stock at Solution Phone Mâcon.\n\nLAYOUT:\n- Top-left: Solution Phone red "S" logo (rounded square, chrome S inside) with small "SOLUTION PHONE" label\n- Top-center: a small red pill badge reading "NOUVEAU EN STOCK"\n- Center-left block: model name "{modele}" in HUGE white Montserrat Extra Bold, then price "{prix}€" gigantic red Montserrat Extra Bold below\n- Right side: photorealistic 3/4 perspective shot of the smartphone {modele} in {couleur} color, floating, resting on a subtle red glow ring, soft drop shadow underneath\n- Below the model name: 5 bullet rows with small red dots — "GRADE {grade}", "BATTERIE {batterie}%", "ÉTAT EXCELLENT", "GARANTIE 6 MOIS", "PIÈCES TESTÉES"\n- Footer: thin red bar with "RÉPARATION · ACCESSOIRES · ACHAT · REVENTE" in small white caps, address "21 Rue Gambetta, 71000 Mâcon" and "03 85 33 06 89" in Montserrat Regular\n\nVARIABLES TO USE: modele={modele}, prix={prix}, grade={grade}, batterie={batterie}, couleur={couleur}\n\nMOOD: Apple Store product launch, but Solution Phone branded. Subtle red glow only. No fake Apple/Samsung logos on the device — keep generic.',
    updated_at = NOW()
WHERE name = 'new_phone_carre';

-- Template 2 : promo générique
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 Instagram square for a Solution Phone promotion.\n\nLAYOUT:\n- Top: a red pill badge reading the promo headline ("PROMO -{reduction}€" or "{type_promo}") in Montserrat Extra Bold white\n- Center: main title "{titre}" in HUGE white Montserrat Extra Bold, all caps, taking 40% of canvas\n- Below: subtitle "{sous_titre}" in Montserrat Regular medium-gray\n- A subtle red glow originating from behind the central element\n- Mid-right: optional smartphone product visual or QualiRépar label if relevant\n- Bottom CTA: "DISPONIBLE EN BOUTIQUE" red pill button look\n- Footer line: address + phone in Montserrat Regular\n\nVARIABLES: titre={titre}, sous_titre={sous_titre}, reduction={reduction}, type_promo={type_promo}\n\nMOOD: Tesla announcement aesthetics meets local trust. Premium, never sale-y.',
    updated_at = NOW()
WHERE name = 'promo_carre';

-- Template 3 : avis 5 étoiles
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 Instagram square reposting a 5-star Google review for Solution Phone.\n\nLAYOUT:\n- Top: 5 gold stars in a horizontal row, small "AVIS GOOGLE" label in Montserrat Regular underneath\n- Center: large opening quote mark in red, then the review text "{commentaire}" in Montserrat Regular white, max 250 chars, line-broken cleanly\n- Bottom-left: a clean circle photo placeholder (warm gray gradient if no photo), then author name "{auteur}" in Montserrat Extra Bold white, and "{date_relative}" in Montserrat Regular gray\n- Bottom-right: small Solution Phone "S" logo\n- A very subtle red glow from below center to lift the quote\n\nVARIABLES: auteur={auteur}, commentaire={commentaire}, date_relative={date_relative}\n\nMOOD: editorial, testimonial, premium publication style. NO emoji, NO marketing fluff.',
    updated_at = NOW()
WHERE name = 'avis_5_etoiles_carre';

-- Template 4 : clôture réparation (avant/après)
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 Instagram square showing a before/after repair transformation for Solution Phone.\n\nLAYOUT:\n- Vertical split-screen with a thin red separator line\n- LEFT (AVANT): the {modele} smartphone with a dramatic cracked, fractured screen, dark moody lighting, small red label "AVANT" top-left in Montserrat Extra Bold\n- RIGHT (APRÈS): the same {modele} smartphone, screen pristine and brilliant, soft red glow halo behind it, small red label "APRÈS" top-right\n- Bottom band: "RÉPARÉ EN MOINS D''1H" in HUGE white Montserrat Extra Bold, then "{description_panne}" in Montserrat Regular\n- If qualirepar_eligible is true: small QualiRépar blue badge "BONUS -25€" bottom-left\n- Footer: address + phone in Montserrat Regular\n\nVARIABLES: modele={modele}, description_panne={description_panne}, qualirepar_eligible={qualirepar_eligible}\n\nMOOD: cinematic transformation reveal. The "AVANT" side must feel dramatic but not violent — Solution Phone fixes problems, never showcases pain.',
    updated_at = NOW()
WHERE name = 'cloture_repair_carre';

-- Template 5 : alerte stock (urgence calme)
UPDATE visual_templates
SET base_prompt = (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
  || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 Instagram square signaling low stock on a popular smartphone, urgency but premium tone.\n\nLAYOUT:\n- Top: red pill badge "DERNIERS EXEMPLAIRES" in Montserrat Extra Bold white\n- Center: model name "{modele} {stockage}" in HUGE white Montserrat Extra Bold\n- Below: "PLUS QUE {stock} EN STOCK" in red Montserrat Extra Bold mid-size\n- Right: photorealistic 3/4 perspective of the smartphone with a subtle red spotlight from above\n- Below model: gigantic price "{prix}€" in red\n- Bottom CTA: "RÉSERVE LE TIEN MAINTENANT" in white on red pill\n- Footer: address + phone\n\nVARIABLES: modele={modele}, stockage={stockage}, stock={stock}, prix={prix}\n\nMOOD: premium scarcity. Like a luxury watch boutique announcing the last pieces — never panicked, never aggressive.',
    updated_at = NOW()
WHERE name = 'stock_alerte_carre';


-- ══════════════════════════════════════════════════════════════════
-- 4. AJOUTE 3 nouveaux templates : QualiRépar · Hydrogel · Reel vertical
-- ══════════════════════════════════════════════════════════════════

INSERT INTO visual_templates (name, kind, format, trigger_event, description, base_prompt, variables_schema)
VALUES
('qualirepar_carre', 'post', '1080x1080', 'manual',
 'Mise en avant du label QualiRépar (-25€ bonus immédiat)',
 (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
   || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 visual highlighting Solution Phone QualiRépar label benefit.\n\nLAYOUT:\n- Left half: photorealistic shot of a young technician wearing black gloves and a Solution Phone black hoodie, focused on a disassembled smartphone on a blue QualiRépar repair mat, microscope blurred in background\n- Right half (dark): Solution Phone "S" logo top, then HUGE title "RÉPARATEUR LABELLISÉ" in white Montserrat Extra Bold, "QUALIRÉPAR" in QualiRépar blue (#0066CC), then a massive red rounded rectangle showing "-25€ SUR VOTRE RÉPARATION" in white Montserrat Extra Bold\n- Below: 4 small icons + labels in Montserrat Regular: "PIÈCES CERTIFIÉES", "RÉPARATION DE QUALITÉ", "GARANTIE 6 MOIS", "ÉCO-RESPONSABLE"\n- Footer: address + phone\n- Tiny mention legale Montserrat Regular: "Sur simple présentation de votre bonus QualiRépar"\n\nMOOD: editorial trust + government-certified credibility. The blue QualiRépar accent must not break the 60/30/10 ratio — only present in the badge and one accent.',
 '{}'::jsonb),

('hydrogel_carre', 'post', '1080x1080', 'manual',
 'Promotion du film hydrogel et de la gamme Crystal/Obsidian/Saphir/Onyx',
 (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
   || E'\n\nSPECIFIC SHOT:\nA premium 1080x1080 visual for Solution Phone hydrogel screen protection range.\n\nLAYOUT:\n- Top: small red pill "PROTECTION ÉCRAN"\n- Hero title: "VERRE TRÉMPÉ" struck through, then BIG "HYDROGEL" in white Montserrat Extra Bold with subtle shattered-glass effect around it (red shards, not aggressive)\n- Subtitle: "Film auto-cicatrisant posé en 5 MINUTES" — "5 MINUTES" in red\n- Center-right: photorealistic flowing hydrogel film over a smartphone with subtle red glow underneath\n- Bottom: 4 product cards (Crystal 25€, Obsidian 25€, Saphir 15€, Onyx 15€) each with name, price in HUGE red Montserrat Extra Bold, and 3 short bullet features\n- Footer: "POSÉ EN 5 MIN · GARANTIE 6 MOIS"\n\nMOOD: cosmetic-brand premium meets tech. Like an Apple Care Plus visual.',
 '{}'::jsonb),

('story_vertical', 'story', '1080x1920', 'manual',
 'Story Instagram verticale générique — adaptation du master prompt en 9:16',
 (SELECT value::text FROM agent_memory WHERE key = 'master_visual_prompt')
   || E'\n\nSPECIFIC SHOT:\nA 1080x1920 vertical Instagram Story for Solution Phone.\n\nLAYOUT (top to bottom):\n- Top 15%: Solution Phone "S" logo centered + small "SOLUTION PHONE" label\n- 15-50%: hero title "{titre}" in HUGE white Montserrat Extra Bold all caps, line-broken for impact\n- 50-70%: photorealistic product hero shot with subtle red rim glow\n- 70-85%: red pill CTA "{cta}" in Montserrat Extra Bold\n- Bottom 15%: address + phone in Montserrat Regular white, swipe-up zone reserved\n\nVARIABLES: titre={titre}, cta={cta}, sujet={sujet}\n\nMOOD: vertical Apple keynote slide. Maximum impact, single message, made for thumb-stop on mobile.',
 '{"titre": "string", "cta": "string", "sujet": "string"}'::jsonb)
ON CONFLICT (name) DO UPDATE SET
  base_prompt = EXCLUDED.base_prompt,
  description = EXCLUDED.description,
  updated_at = NOW();


-- ══════════════════════════════════════════════════════════════════
-- 5. CONTRÔLE — vérifie que tout est en place
-- ══════════════════════════════════════════════════════════════════
-- SELECT key, jsonb_pretty(value)::text FROM agent_memory WHERE key IN ('brand_voice', 'master_visual_prompt');
-- SELECT name, kind, format, trigger_event, LEFT(base_prompt, 120) || '...' AS prompt_preview FROM visual_templates ORDER BY name;
