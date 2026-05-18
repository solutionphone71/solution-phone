# SOLUTION PHONE — MASTER VISUAL PROMPT

> Prompt canonique injecté **AVANT** chaque génération visuelle (gpt-image-1 / Imagen / Nano Banana).
> Cible : verrouiller le style "Solution Phone" sur 100% des sorties IA.
> Tous les `base_prompt` de la table `visual_templates` doivent commencer par ce bloc.

---

## ✦ MASTER PROMPT v1 (mai 2026)

```
BRAND: Solution Phone — premium smartphone repair shop in Mâcon, France, since 2014.

OVERALL STYLE: Apple keynote × Tesla × Bang & Olufsen × Aesop.
Cinematic, premium, minimalist, modern tech high-end.
NEVER cheap. NEVER discount-shop. NEVER gaming RGB.
NEVER cartoonish. NEVER busy. NEVER "stock photo" generic.

STRICT COLOR PALETTE (60/30/10):
- 60% deep matte black backdrop (#0D0D0D)
- 30% pure white (#FFFFFF) for typography and breathing space
- 10% signature red (#E10600) used ONLY as accents: glow, CTA, logo, frame highlights.
No other colors permitted (exception: QualiRépar blue #0066CC when the QualiRépar label is shown).

LIGHTING:
- Dramatic side lighting (key light at 45°)
- Subtle red rim-light on product edges
- Soft cinematic falloff
- Sharp specular highlights on glass and metal
- Volumetric haze allowed but very discreet

COMPOSITION:
- Ultra minimalist
- Generous negative space
- Product hero front-and-center or rule of thirds
- One dominant message, one clear CTA
- Clean hierarchy: title → subtitle → CTA → trust signals
- Mobile-first readability

TYPOGRAPHY (when text appears in the image):
- Montserrat Extra Bold (800) for titles, slogans, CTAs, prices
- Montserrat Regular (400) for body text
- Heavy weight contrast: HUGE titles vs small details
- All caps for hero phrases. Sentence case for descriptions.
- White text on black backdrop; red used for emphasized words

MATERIALS:
- Matte black backgrounds with subtle micro-texture (carbon fiber, anodized metal, brushed aluminum)
- Premium glass with crisp reflections
- Chrome / silver metallic finishes on logo or trim elements

QUALITY:
- 8K perceived detail
- Professional studio photography
- Shallow depth of field (f/2.8 to f/4)
- Cinematic color grade: deep blacks, controlled highlights, slight red push in shadows
- No motion blur unless explicitly requested

ABSOLUTELY FORBIDDEN:
- Watermarks, signatures, fake brand logos (Apple, Samsung, etc. unless explicitly referenced)
- Rainbow gradients, RGB lighting, neon excess
- 3D cartoon effects, low-poly aesthetics
- Cheap retail / discount shop typography (Impact, Comic Sans, Bebas variants)
- Cluttered backgrounds with random props
- Generic stock-photo "happy customer" imagery
- Lens flares applied as a filter
- Over-saturated colors
- Emojis baked into the image

REQUIRED BRAND ELEMENTS (when relevant):
- The "S" logo: red rounded square (#E10600) with a stylized chrome/silver "S" inside, premium app-icon style
- Address line "21 Rue Gambetta, 71000 Mâcon" in Montserrat Regular when contact info is shown
- Phone "03 85 33 06 89"
- Site "solution-phone.fr"
- Trust signals: "Depuis 2014" · "+590 avis Google" · "90% des réparations en -1h"
- Garanties (à choisir selon le contexte du visuel) :
  • Réparation : "GARANTIE 6 MOIS"
  • Smartphone reconditionné : "GARANTIE 12 MOIS"
  • Smartphone neuf : "GARANTIE 24 MOIS"
```

---

## ✦ COMMENT L'UTILISER

### 1. Dans Supabase (`visual_templates.base_prompt`)

Chaque template doit commencer par ce master prompt, suivi du brief spécifique :

```
{MASTER_PROMPT}

SPECIFIC SHOT:
[Description de la composition demandée pour CE template]

VARIABLES:
- modele: {modele}
- prix: {prix}
- ... etc
```

### 2. Pour l'image-to-image (`reference_asset_ids`)

Pour verrouiller encore plus le style, on passe **2-3 images de référence** issues du kit de marque :

- 1 référence "ambiance" (ex: atelier microscope avec iPhone fissuré + glow rouge)
- 1 référence "logo" (logo officiel "S")
- 1 référence "typographie" (un visuel "La qualité, notre engagement")

`gpt-image-1` (via `/v1/images/edits`) imitera leur palette, lumière et grain. Le rendu reste cohérent même si le prompt change.

---

## ✦ MÉTRIQUES DE RÉUSSITE

Un visuel est considéré "on-brand" si :

- ✅ Palette respectée (test rapide : dominantes noir + rouge + blanc, rien d'autre saturé)
- ✅ Aucun mot mal orthographié dans l'image
- ✅ Typographie en Montserrat (ou très proche : sans-serif geometric bold)
- ✅ Hiérarchie claire : un titre dominant
- ✅ Aucun élément cheap / aucune saturation excessive
- ✅ Lisible sur écran mobile de 4 pouces

Sinon : reject + feedback dans `agent_decisions.feedback_reason`.

---

## ✦ ITÉRATIONS

Ce master prompt est **vivant**. Chaque fois qu'on valide ou rejette un visuel, on note la raison. Tous les 30 jours on revoit le prompt pour corriger les dérives (ex: si l'IA continue de produire trop de glow, on durcit "subtle red glow ONLY at low intensity").

**Prochain check :** 18 juin 2026.
