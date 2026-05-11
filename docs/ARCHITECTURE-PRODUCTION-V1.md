# Solution Phone — Architecture Production v1

> Spécification officielle de l'OS IA métier Solution Phone.
> Document de référence pour toute évolution future.
> **Validé Sébastien · mai 2026**

---

## 0. Principes directeurs

1. **Pas de refonte massive**. L'architecture actuelle marche, est performante, et peut absorber la croissance. On consolide, on ne reconstruit pas.
2. **Hiérarchie claire des agents IA**. Un cerveau (Zahira), des spécialistes, un exécutant visuel (ChatGPT GPT-Image-1) sans pouvoir stratégique.
3. **Mémoire partagée 6 niveaux**. Aucun agent ne démarre vierge. Tous lisent la même base.
4. **Workflow asynchrone propre**. Génération visuelle ≠ blocage utilisateur.
5. **Budget contrôlé**. Compteurs quotidiens avec stop automatique si dépassement.
6. **Audit complet**. Toute action sensible loggée. Backups quotidiens. Rollback possible.

---

## 1. Architecture production

### 1.1 Vue d'ensemble (couches)

```
┌─────────────────────────────────────────────────────────────────┐
│  CLIENT — Browser SPA monolithe (index.html ~1.4 Mo)            │
│  → Mâcon, 3 boutiques, ordis Mac + iPad + iPhone                │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTPS
┌────────────────────────────▼────────────────────────────────────┐
│  EDGE — Vercel CDN + Cloudflare-like                            │
│  → Cache statique, headers cache-control, rewrites              │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│  COMPUTE — Vercel Serverless Functions (Node.js 20)             │
│  /api/agents/*  /api/brain/*  /api/render/*  /api/backup        │
│  /api/supabase  /api/claude   /api/proxy-*    /api/google-*     │
└──────┬────────────┬────────────┬───────────┬───────────┬────────┘
       │            │            │           │           │
   ┌───▼───┐    ┌───▼────┐   ┌───▼───┐  ┌────▼────┐ ┌────▼─────┐
   │Claude │    │ OpenAI │   │  Meta │  │  Brevo  │ │ Pennylane│
   │ API   │    │GPTImg-1│   │ Graph │  │SMS/Email│ │  Compta  │
   │Sonnet │    │  GPT-5 │   │  API  │  └─────────┘ └──────────┘
   │  4.6  │    │ images │   │IG + FB│
   └───────┘    └────────┘   └───────┘
       │
       │   ┌─────────────┐  ┌──────────┐  ┌────────────┐
       └──→│   Kiwiz     │  │ Ecosystem│  │ Ecologic   │
           │   NF525     │  │QualiRépar│  │QualiRépar  │
           └─────────────┘  └──────────┘  └────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  STORAGE — Supabase Postgres 15 + Supabase Storage              │
│  - Tables métier (50+)                                          │
│  - Tables IA (agent_memory, agent_runs, agent_decisions, ...)   │
│  - Tables visuelles (visual_assets, visual_jobs, ...)           │
│  - Buckets : backups, social_media, visual_assets, pdfs         │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Stack technique définitive

| Couche | Techno | Pourquoi |
|--------|--------|----------|
| Frontend | HTML/CSS/JS vanilla monolithe | Vélocité solo, pas de toolchain, 1.4 Mo OK |
| Hosting | Vercel Pro | Edge + serverless + crons intégrés |
| Database | Supabase Postgres 15 | Row-level security, Realtime, JSONB |
| Storage | Supabase Storage | Buckets privés, RLS, intégré avec DB |
| IA stratégie | Anthropic Claude Sonnet 4.6 + Haiku 4.5 | Meilleur raisonnement, brand voice cohérent |
| IA rendu image | OpenAI GPT-Image-1 | Meilleur sur compositions visuelles + texte |
| Réseaux sociaux | Meta Graph API v18+ | Officielle, stable, Insta+FB |
| Avis Google | Google Business Profile API | Lecture + réponses publiées |
| Comptabilité | Pennylane API | Export FEC automatique |
| Caisse NF525 | Kiwiz API | Certification fiscale |
| QualiRépar | Ecosystem + Ecologic APIs | Bonus écologique État |
| Email/SMS | Brevo | Transactionnel + marketing |
| Auth admin | Code patron (localStorage 5min) | Simple, suffisant pour solo |

---

## 2. Structure Supabase

### 2.1 Tables par domaine

#### Métier (~25 tables existantes)
```
clients, phones, phones_neufs, factures, factures_pdf,
reparations, bons_depot, bons_commande, historique_reparations,
caisse, cloture_journee, depenses, salaries, neufs_accessoires,
police, mobilax, commandes, devis, settings, reports_mois,
ventes_neufs_access, ecrans_prix, batteries_prix, prix_reparation_android,
clients_en_attente
```

#### IA / Agents (~6 tables existantes + 3 à créer)
```
agent_memory          ✅ existe   - Mémoire partagée (key/value JSONB)
agent_runs            ✅ existe   - Logs des runs d'agents
agent_decisions       ✅ existe   - Propositions IA + statut + feedback
brain_chat_messages   ✅ existe   - Historique conversation Zahira
brain_briefings       ✅ existe   - Briefings matinaux historiques
brain_suggestions     ✅ existe   - Suggestions UX
brain_kpi_snapshots   ✅ existe   - Snapshots KPI quotidiens
brain_usage_events    ✅ existe   - Tracking usage
visual_assets         ⏳ à créer  - Kit de marque (logo, mascotte, photos)
visual_jobs           ⏳ à créer  - Queue de génération GPT-Image-1
visual_templates      ⏳ à créer  - Templates de composition validés
ai_budget             ⏳ à créer  - Compteur quotidien Claude+OpenAI
```

#### Social / Marketing (~10 tables existantes)
```
social_posts, social_media, social_logs, avis_requests,
dm_responses, social_weekly_stats, social_automations,
calendrier_editorial, roulette_config, roulette_participations,
mes_avis_google, google_reviews, google_reviews_config
```

#### Infrastructure (3 tables existantes)
```
audit_log             ✅ existe   - Journal d'audit (J14)
backups_meta          ✅ existe   - Métadonnées backups quotidiens
pennylane_sync        ✅ existe   - Sync compta
```

### 2.2 Buckets Supabase Storage

| Bucket | Privé | Limite | MIME | Usage |
|--------|-------|--------|------|-------|
| `backups` | ✅ | 50 Mo | application/gzip | Backups quotidiens auto (J14) |
| `social_media` | ❌ public | 10 Mo | image/* | Visuels Insta/FB générés |
| `visual_assets` | ✅ | 20 Mo | image/* | Kit de marque (logo, mascotte, photos ref) |
| `pdfs` | ✅ | 5 Mo | application/pdf | Factures PDF natives |

---

## 3. Système mémoire partagée

### 3.1 Les 6 niveaux

| N° | Type | Source | Mise à jour | Stocké dans | Lu par |
|----|------|--------|-------------|-------------|--------|
| **N1** | Décisions récentes | `agent_decisions` | À chaque action | view `v_recent_decisions` | Tous les agents |
| **N2** | Brand voice | Sébastien | Manuel via UI | `agent_memory.brand_voice` | Tous |
| **N3** | Rejets avec raison | `agent_decisions.feedback_*` | À chaque rejet | view `v_recent_rejects` | Tous |
| **N4** | Insights business | Calcul cron | Quotidien 3h | `agent_memory.insights_v2` | Tous |
| **N5** | Briefing du jour | Zahira | Quotidien 7h45 | `agent_memory.daily_briefing` | Tous |
| **N6** | Library visuels validés | Historique decisions | Continu | `visual_templates` | Assya + GPT-Image-1 |

### 3.2 Injection dans le system prompt

Tous les agents reçoivent un `system` prompt structuré ainsi :

```
## BRIEFING ZAHIRA — [date]
[texte du briefing du jour]

## INSIGHTS BUSINESS
• Top vendus 30j: iPhone 13(8), Samsung S22(5)...
• Stock faible: iPhone 11 Pro
• 3 QualiRépar éligibles non envoyés

## BRAND VOICE
• Ton: Direct, chaleureux, sans bullshit
• Emojis max: 2
• Hashtags favoris: #solutionphone #macon...
• Mots interdits: incroyable, fabuleux...
• Signature: L'équipe Solution Phone

## DERNIERS REJETS DE SÉBASTIEN — APPRENDS DE TES ERREURS
1. [REJETÉ — ton creux] "Découvrez ce magnifique iPhone..."
2. [REJETÉ — déjà fait] "Notre offre QualiRépar..."

## TES 10 DERNIÈRES PROPOSITIONS DU MÊME TYPE
1. [validated] post — Annonce iPhone 13...
2. [rejected] post — Annonce Samsung...

---

[prompt spécifique de l'agent]
```

---

## 4. Tables SQL agents — schéma à créer

### 4.1 `visual_assets` (kit de marque)

```sql
CREATE TABLE IF NOT EXISTS visual_assets (
  id           BIGSERIAL PRIMARY KEY,
  kind         TEXT NOT NULL,              -- 'logo' | 'tampon' | 'mascotte' | 'photo_boutique' | 'photo_produit' | 'reference_template'
  name         TEXT NOT NULL,              -- 'Logo SP carré HD'
  file_url     TEXT NOT NULL,              -- URL Supabase Storage
  storage_path TEXT NOT NULL,              -- visual_assets/logo-sp-hd.png
  ai_reference BOOLEAN DEFAULT FALSE,      -- true = à passer en input image-to-image à GPT-Image-1
  width        INT,
  height       INT,
  size_bytes   INT,
  description  TEXT,                       -- "Logo principal noir + S rouge, fond transparent"
  active       BOOLEAN DEFAULT TRUE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_visual_assets_kind ON visual_assets(kind) WHERE active = TRUE;
```

### 4.2 `visual_templates` (templates de composition)

```sql
CREATE TABLE IF NOT EXISTS visual_templates (
  id                  BIGSERIAL PRIMARY KEY,
  name                TEXT NOT NULL,           -- 'new_phone_carre'
  kind                TEXT NOT NULL,           -- 'post' | 'story' | 'reel' | 'carrousel'
  format              TEXT NOT NULL,           -- '1080x1080' | '1080x1920' | '1080x566' | '1080x1350'
  trigger_event       TEXT,                    -- 'new_phone' | 'promo' | 'avis_5_etoiles' | 'cloture_repair'
  base_prompt         TEXT NOT NULL,           -- Prompt OpenAI structuré avec {variables}
  reference_asset_ids BIGINT[],                -- IDs de visual_assets à passer en image-to-image
  variables_schema    JSONB,                   -- { modele: 'string', prix: 'number', grade: 'string', ... }
  validation_count    INT DEFAULT 0,           -- nb de fois validé par Sébastien
  rejection_count     INT DEFAULT 0,
  active              BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_visual_templates_trigger ON visual_templates(trigger_event) WHERE active = TRUE;
```

### 4.3 `visual_jobs` (queue de génération)

```sql
CREATE TABLE IF NOT EXISTS visual_jobs (
  id            BIGSERIAL PRIMARY KEY,
  decision_id   BIGINT REFERENCES agent_decisions(id) ON DELETE CASCADE,
  template_id   BIGINT REFERENCES visual_templates(id),
  status        TEXT DEFAULT 'queued',        -- 'queued' | 'processing' | 'ready' | 'failed' | 'cancelled'
  brief         JSONB NOT NULL,               -- { variables, format, kind, special_instructions }
  prompt_built  TEXT,                         -- Prompt OpenAI final assemblé
  reference_urls TEXT[],                      -- URLs des assets passés en input
  image_url     TEXT,                         -- URL de l'image générée (Storage)
  image_path    TEXT,                         -- social_media/2026-05-12/job-123.png
  render_duration_ms INT,
  cost_eur      NUMERIC(8,4),
  error_msg     TEXT,
  retries       INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  processed_at  TIMESTAMPTZ
);
CREATE INDEX idx_visual_jobs_status ON visual_jobs(status, created_at) WHERE status IN ('queued', 'processing');
CREATE INDEX idx_visual_jobs_decision ON visual_jobs(decision_id);
```

### 4.4 `ai_budget` (garde-fou financier)

```sql
CREATE TABLE IF NOT EXISTS ai_budget (
  id              BIGSERIAL PRIMARY KEY,
  day             DATE NOT NULL,
  model           TEXT NOT NULL,            -- 'claude-sonnet-4-6' | 'claude-haiku-4-5' | 'gpt-image-1' | 'gpt-5'
  requests_count  INT DEFAULT 0,
  input_tokens    BIGINT DEFAULT 0,
  output_tokens   BIGINT DEFAULT 0,
  cost_eur        NUMERIC(10,4) DEFAULT 0,
  UNIQUE (day, model)
);
CREATE INDEX idx_ai_budget_day ON ai_budget(day DESC);
```

Configuration des seuils dans `agent_memory.ai_budget_caps` :
```json
{
  "daily_total_cap_eur": 5.00,
  "per_model_cap_eur": {
    "claude-sonnet-4-6": 2.00,
    "gpt-image-1": 2.00
  },
  "alert_email": "sebastien.cannard@gmail.com",
  "stop_on_cap": true
}
```

---

## 5. Système de jobs / cron

### 5.1 Vue d'ensemble

| Heure | Endpoint | Rôle | Modèle |
|-------|----------|------|--------|
| `0 2 * * *` | `/api/backup` | Backup Supabase + Storage | - |
| `0 3 * * *` | `/api/agents/insights` | Calcul insights N4 | - |
| `45 7 * * *` | `/api/agents/briefing` | Briefing Zahira N5 | Claude Sonnet |
| `0 8 * * *` | `/api/agents/zahira?type=morning` | Orchestration matin | Claude Sonnet |
| `5 8 * * *` | `/api/brain/morning-run` | Brain run | Claude Sonnet |
| `0 9 * * *` | `/api/cron-reviews` | Fetch + traite avis Google | Claude Haiku |
| `*/15 * * * *` | `/api/visual/process-queue` | **NOUVEAU** Génération visuelle batch | GPT-Image-1 |
| `0 19 * * *` | `/api/agents/zahira?type=evening` | Orchestration soir | Claude Sonnet |
| `0 18 * * 0` | `/api/agents/zahira?type=weekly` | Bilan hebdo dimanche | Claude Sonnet |
| `0 0 * * *` | `/api/ai/budget-reset` | **NOUVEAU** Reset compteurs jour | - |
| `0 23 * * *` | `/api/ai/budget-alert` | **NOUVEAU** Alerte si > 80% du cap | - |

### 5.2 Pattern triggers temps réel

En complément des crons, **3 triggers IA temps réel** déjà actifs (J15) :

```
Événement frontend → POST /api/agents/trigger { kind, data }
                            ↓
                  Claude Haiku 4.5 + Tool Use
                            ↓
                  Insert agent_decision
                            ↓
                  [Si visuel requis]
                            ↓
                  Insert visual_job (status=queued)
                            ↓
                  Cron /api/visual/process-queue (15 min plus tard)
                            ↓
                  Update decision.payload.image_url
                            ↓
                  Notif "🎨 Visuel prêt à valider"
```

---

## 6. Pipeline Meta API

### 6.1 Endpoints existants

- Tokens stockés dans Vercel env : `META_PAGE_TOKEN`, `IG_USER_ID`, `META_FB_PAGE_ID`
- Publication via `/api/autopilot/execute.js` qui appelle Meta Graph API v18+

### 6.2 Workflow publication

```
Sébastien clique "✅ Valider & Publier" dans Autopilot
        ↓
agent_decision.status = 'validated'
        ↓
/api/autopilot/execute.js
        ↓
1. Récupère image_url depuis visual_jobs
2. Récupère caption + hashtags depuis payload
3. POST https://graph.facebook.com/v18.0/{IG_USER_ID}/media
      { image_url, caption }
   → retourne creation_id
4. POST https://graph.facebook.com/v18.0/{IG_USER_ID}/media_publish
      { creation_id }
   → retourne post_id
5. POST https://graph.facebook.com/v18.0/{META_FB_PAGE_ID}/photos
      (publication Facebook simultanée)
6. Update agent_decision.status = 'published'
7. Insert social_posts row (tracking)
```

### 6.3 Types de publication supportés

| Type | Endpoint Meta | Format | Statut |
|------|---------------|--------|--------|
| Post Instagram feed | `/{ig_user_id}/media` + media_publish | image_url | ✅ existant |
| Story Instagram | `/{ig_user_id}/media?media_type=STORIES` | image_url | ✅ existant |
| Reel | `/{ig_user_id}/media?media_type=REELS` | video_url | ⏳ à coder |
| Carrousel | `/{ig_user_id}/media?media_type=CAROUSEL` + children | 2-10 images | ⏳ à coder |
| Post Facebook | `/{fb_page_id}/photos` | url + caption | ✅ existant |

### 6.4 Lecture insights

Cron hebdo dimanche soir : `GET /{ig_user_id}/insights?metric=impressions,reach,profile_views,follower_count&period=week` → stockage dans `social_weekly_stats` → exploité par Assya pour ajuster son contenu.

---

## 7. Système de génération visuelle automatisée

### 7.1 Workflow détaillé

```
[1] TRIGGER (ex: ajout phone)
     ↓
[2] ASSYA (Claude) appelée via /api/agents/trigger
     - Lit mémoire (briefing, insights, brand_voice, rejets, decisions récentes)
     - Choisit le template approprié (visual_templates WHERE trigger_event='new_phone')
     - Produit le brief : caption, hashtags, variables ({modele, prix, grade, batterie, ...})
     - Insert agent_decision (status=pending_generation)
     - Insert visual_job (status=queued, brief, template_id)
     ↓
[3] Sébastien voit dans Autopilot : "🎨 Visuel en cours de génération..."
     ↓
[4] CRON /api/visual/process-queue (toutes les 15 min)
     - SELECT * FROM visual_jobs WHERE status='queued' LIMIT 5 ORDER BY created_at
     - Pour chaque job :
       a. Récupère template (visual_templates)
       b. Récupère assets de référence (visual_assets WHERE id IN reference_asset_ids)
       c. Assemble le prompt final avec interpolation des variables
       d. Appel OpenAI Images API :
          POST https://api.openai.com/v1/images/generations
          {
            model: 'gpt-image-1',
            prompt: '...',
            size: '1024x1024' (mapping depuis format),
            n: 1,
            quality: 'high',
            input_images: [...references]   // image-to-image
          }
       e. Récupère l'image base64
       f. Upload Supabase Storage bucket social_media/YYYY-MM-DD/{job_id}.png
       g. Update visual_jobs (status=ready, image_url, render_duration_ms, cost_eur)
       h. Update ai_budget (incrémente cost_eur)
       i. Update agent_decision (payload.image_url, status=pending_validation)
     - Si erreur → retries++ (max 3), puis status=failed
     ↓
[5] Autopilot rafraîchit, montre l'image prête + boutons :
     [✅ Valider & Publier]  [🔄 Regénérer]  [✏️ Éditer brief]  [❌ Rejeter]
     ↓
[6] Sébastien valide → /api/autopilot/execute.js publie sur Meta
```

### 7.2 Mapping format → résolution OpenAI

```js
const FORMAT_MAP = {
  '1080x1080': '1024x1024',    // post carré
  '1080x1920': '1024x1536',    // story / reel vertical
  '1080x1566': '1024x1536',    // post portrait
  '1080x566':  '1536x1024',    // post paysage
  '1080x1350': '1024x1536'     // reel/story portrait
};
// Upscale post-traitement si nécessaire via Sharp (sharp.resize)
```

### 7.3 Coût estimé

| Volume mensuel | Coût Claude (Assya) | Coût GPT-Image-1 | Total /mois |
|----------------|---------------------|-------------------|-------------|
| 30 visuels (1/jour) | ~1 € | ~1.20 € | **2.20 €** |
| 90 visuels (3/jour) | ~3 € | ~3.60 € | **6.60 €** |
| 150 visuels (5/jour) | ~5 € | ~6 € | **11 €** |
| 300 visuels (10/jour) | ~10 € | ~12 € | **22 €** |

Garde-fou via `ai_budget` : si dépassement quotidien, stop automatique + email alerte. Sécurité contre boucle infinie.

---

## 8. Plan migration progressif

### Pas de refonte React/Next.js — voici pourquoi

Une migration vers React/Next.js coûterait **4-6 mois de dev solo** pendant lesquels Solution Phone ne pourrait rien faire bouger côté business. Le gain (architecture "moderne") est purement cosmétique tant que :
- Sébastien reste seul à coder
- L'app charge en < 2s
- Les features sont ajoutables en < 1h
- Aucun problème de scaling utilisateur

Donc on **consolide** l'existant sans rebâtir.

### Étape 1 — Court terme (mai-juin 2026) — EN COURS

**Objectif** : finaliser l'intégration ChatGPT + stabilité production.

- [ ] Onboarding GPT-Image-1 (4h dev)
- [ ] Création tables `visual_assets`, `visual_templates`, `visual_jobs`, `ai_budget`
- [ ] Upload kit de marque dans `visual_assets`
- [ ] 5 templates de départ : new_phone, promo, avis_5_etoiles, cloture_repair, stock_alerte
- [ ] Endpoint `/api/visual/process-queue` + cron 15 min
- [ ] UI Autopilot avec preview image + boutons regénérer
- [ ] Budget cap quotidien + email alerte
- [ ] **OBSERVATION TERRAIN 2-4 SEMAINES** avant Étape 2

### Étape 2 — Moyen terme (juillet 2026)

**Objectif** : robustesse + monitoring.

- [ ] Endpoint `/api/health` (vérifie crons, tables, quotas)
- [ ] Tests Vitest sur 15 endpoints critiques
- [ ] Dashboard santé dans Paramètres (cron status, latences, erreurs)
- [ ] Auto-publication sécurisée pour cas évidents (confidence > 0.95)
- [ ] Alertes SMS Brevo en cas d'anomalie critique (CA chute, stock 0, etc.)

### Étape 3 — Long terme (Q4 2026)

**Objectif** : si l'app dépasse les limites du monolithe.

**Déclencheurs** :
- Embauche d'un dev junior → besoin de structurer
- index.html dépasse 3 Mo (perf dégradée)
- Plus de 5 incidents prod par mois (besoin de tests + CI)
- Besoin de multi-tenant (vendre à d'autres réparateurs)

**Si déclencheur** : extraction progressive vers SvelteKit ou Astro page par page, **pas big bang**. Garde l'architecture API actuelle inchangée.

**Sans déclencheur** : on reste sur le monolithe, c'est OK.

---

## Annexe A — Variables d'environnement requises

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbG...

# Anthropic (Claude)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (GPT-Image-1) — NOUVEAU
OPENAI_API_KEY=sk-proj-...

# Meta (Instagram + Facebook)
META_PAGE_TOKEN=EAAH...
IG_USER_ID=17841...
META_FB_PAGE_ID=10231...

# Brevo (SMS + Email)
BREVO_API_KEY=xkeysib-...

# Google Business Profile
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=...

# Ecosystem / Ecologic (QualiRépar) — credentials gérés via /Paramètres
ECOLOGIC_API_KEY=...

# Kiwiz (NF525)
# → credentials gérés via /Paramètres

# Pennylane (compta)
PENNYLANE_API_TOKEN=...

# Sécurité
CRON_SECRET=... (généré aléatoire, partagé avec Vercel cron)
APP_SECRET=... (pour scripts admin)
ENCRYPTION_KEY=... (chiffrement tokens stockés)

# Mode
MOCK_MODE=false
```

## Annexe B — Conventions de code

- Endpoints API : `kebab-case.js`, jamais `camelCase.js`
- Tables SQL : `snake_case`, JSONB pour structures variables
- Variables JS : `camelCase`
- Constants : `UPPER_SNAKE_CASE`
- IDs UUID v4 si nouvelle table, BIGSERIAL si existante par compatibilité
- Tous les endpoints sensibles : `import { handleAuth } from '../_auth.js';` en première ligne
- Tous les endpoints écrivant dans agent_decisions : utilisent le système mémoire (loadMemory + buildMemoryBlock)

## Annexe C — Ordre d'exécution Phase ChatGPT

1. **Sébastien** : ouvrir compte OpenAI, ajouter `OPENAI_API_KEY` dans Vercel env
2. **Sébastien** : préparer kit de marque (5-10 fichiers : logo HD, mascotte Assya, tampon, photos boutique HD, photos produit fond transparent)
3. **Sébastien** : compléter l'entretien d'embauche de ChatGPT (7 tests grille)
4. **Si embauche validée** :
   - Run SQL `sql/visuals-init.sql` (créer tables visual_*)
   - Run SQL pour seed 5 templates de départ
   - Upload kit de marque dans `visual_assets` via UI
   - Code endpoint `/api/render/gpt-image.js`
   - Code endpoint `/api/visual/process-queue.js` + cron
   - Adapter Assya pour produire des briefs structurés avec template_id
   - Adapter Autopilot UI avec preview image + boutons regénérer
   - Adapter execute.js pour récupérer image_url depuis visual_jobs
   - Budget cap + alerte

---

**Document v1 — mai 2026**
**Prochaine révision** : après 2 semaines d'observation Phase 1+2 mémoire IA + intégration ChatGPT.
