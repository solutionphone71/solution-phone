# Kit de marque · Solution Phone — Mode d'emploi

Ce dossier contient les **références visuelles officielles** qui ancrent l'IA dans la charte Solution Phone. Quand `gpt-image-1` génère une image avec `ai_reference=true`, ces fichiers sont passés en *image-to-image* pour préserver le style.

---

## 📋 Procédure (à faire 1 fois)

### Étape 1 — Déposer les 15 visuels

Dans **ce dossier** (`/brand/references/`), dépose les 15 fichiers avec EXACTEMENT les noms listés dans `manifest.json`. Pour gagner du temps, voici la correspondance avec les visuels que tu m'as envoyés :

| Fichier attendu | Description rapide |
|---|---|
| `logo-officiel.png` | Le logo carré rouge avec S chrome (le 10ᵉ visuel envoyé) |
| `logo-officiel-fond-noir.png` | Variante avec texte SOLUTION PHONE sur fond noir |
| `hero-qualite-engagement-vertical.png` | Affiche verticale "La qualité notre engagement" rouge/blanc |
| `hero-qualite-engagement-carre.png` | Version carrée 1080 de la même affiche |
| `atelier-microscope-iphone.jpg` | Atelier sombre avec microscope + iPhone fissuré glow rouge |
| `technicien-qualirepar.jpg` | Photo technicien gants noirs sur tapis QualiRépar bleu |
| `qualirepar-labellise-carre.png` | "Solution Phone est labellisé QualiRépar" carré |
| `qualirepar-reparateur-vertical.png` | Affiche verticale Réparateur Labellisé -25€ |
| `qualirepar-bonus-25-carre.png` | Carré bonus QualiRépar avec technicien |
| `on-repare-tout-marques.png` | Affiche "ON RÉPARE TOUT" grille des marques |
| `prix-ecrans-iphone-tableau.png` | Tableau tarifs écrans iPhone |
| `hydrogel-protection-vertical.png` | Affiche Hydrogel avec gamme Crystal/Obsidian/Saphir/Onyx |
| `accessoires-grid-6.png` | Grille des 6 visuels Solution Accessoires |
| `site-evan-assistant.png` | Annonce site avec mascotte Evan |
| `site-stock-temps-reel.png` | Solution Accessoires stock temps réel |

> 💡 Renomme tes fichiers à ces noms exacts avant de les copier dans ce dossier — sinon le script ne les trouvera pas.

---

### Étape 2 — Créer le bucket `visual_assets` dans Supabase

(Si pas déjà fait par `visuals-init.sql`.)

1. Va dans **Supabase Dashboard → Storage → New bucket**
2. Name : `visual_assets`
3. Public bucket : **OUI** (lecture publique)
4. File size limit : `10 MB`
5. Allowed MIME types : `image/png, image/jpeg, image/webp`

---

### Étape 3 — Exporter tes clés Supabase en local

```bash
export SUPABASE_URL="https://xxxxxxxx.supabase.co"
export SUPABASE_SERVICE_KEY="eyJhbG...service_role..."
```

> ⚠️ La `service_role` est PRIVÉE. Ne la commit JAMAIS, ne la mets pas dans Vercel `OPENAI_API_KEY` etc. Elle reste sur ta machine, ici, juste pour ce seed.
> Tu la trouves dans Supabase Dashboard → Project Settings → API → **service_role secret** (clic sur Reveal).

---

### Étape 4 — Lancer le script

Depuis la racine du repo :

```bash
node scripts/upload-brand-assets.js
```

Sortie attendue :

```
🎨 Solution Phone · upload du kit de marque (15 assets)
   bucket: visual_assets
   source: /brand/references

✅ logo-officiel.png  (INSERT, id=1)
✅ hero-qualite-engagement-vertical.png  (INSERT, id=2)
✅ atelier-microscope-iphone.jpg  (INSERT, id=3)
...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  15 uploadés · 0 skip · 0 erreurs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

### Étape 5 — Brancher les références sur les templates

Une fois les `visual_assets.id` connus, on rattache les bonnes références aux templates dans Supabase SQL Editor :

```sql
-- Exemple : le template new_phone utilise le logo + l'atelier + l'affiche héros
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Atelier microscope iPhone fissuré (ambiance)'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[]
WHERE name = 'new_phone_carre';

-- Idem pour avis 5 étoiles, promo, qualirepar, hydrogel, etc.
UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Affiche héros — La qualité notre engagement (carré 1080)')
]::bigint[]
WHERE name = 'avis_5_etoiles_carre';

UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'QualiRépar labellisé (carré 1080)'),
  (SELECT id FROM visual_assets WHERE name = 'Technicien atelier QualiRépar (photo)')
]::bigint[]
WHERE name = 'qualirepar_carre';

UPDATE visual_templates
SET reference_asset_ids = ARRAY[
  (SELECT id FROM visual_assets WHERE name = 'Logo Solution Phone — officiel HD'),
  (SELECT id FROM visual_assets WHERE name = 'Hydrogel — Protection écran (vertical)')
]::bigint[]
WHERE name = 'hydrogel_carre';
```

---

## ✅ Une fois tout en place

À partir de là, chaque fois qu'**Assya** (ou un trigger business) crée un `visual_job`, le pipeline :

1. Charge le template + son `reference_asset_ids`
2. Récupère les images de référence du bucket `visual_assets`
3. Les passe à `gpt-image-1` via `/v1/images/edits` (image-to-image)
4. **Le rendu hérite automatiquement de ton ADN visuel** — palette, lumière, typographie, ambiance

→ Tu n'auras plus jamais besoin de retoucher manuellement un visuel généré par l'IA.
