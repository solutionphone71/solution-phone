# Récap session du 10 mai 2026 · à pusher

## Ce qui a été fait pendant que tu bougeais

### ✅ 1. Aria retiré (proprement)
- Le script `aria-agent.js` n'est plus chargé (commenté dans `index.html`)
- L'omnibar Aria est remplacée par un bandeau propre avec :
  - Bouton **◢ Zahira** (rouge, gradient) qui pointe vers `/home.html`
  - Bouton **🧠** brain chat (conservé)
- Bug critique du `<script>` cassé → **fixé** (la balise est rééquilibrée)
- Fichier `aria-agent.js` reste sur disque en backup, peut être supprimé plus tard

### ✅ 2. Nouvelle home Zahira créée (`/home.html`)
La home Apple v3.5 dark mode avec :
- Photo Zahira (84px) avec ring rouge glow pulsant
- Hero "Bonjour Sébastien" en Fraunces 30px
- Synthèse dynamique calculée depuis `agent_decisions` réelles
- 5 KPI chips connectés à Supabase (CA jour, Avis Google, Stock, Queue, QualiRépar mois)
- Composer connecté à `/api/brain/chat`
- 4 cartes opérations 3D (QualiRépar, Vente, Achat, Accessoires) qui pointent vers les ancres `/#xxx` de l'app classique
- Roster équipe IA avec **vrais avatars** (anissa, assya, yago, obiwan, chanel) lus depuis `/images/*.png`
- Tab bar bottom 5 onglets (Accueil actif, Tickets, Clients, Analytics, Plus)

### ✅ 3. Refactor `/api/brain/chat.js`
- Nouveau system prompt : Zahira parle en tant que cheffe de cabinet IA
- Sauvegarde automatique de chaque message (user + assistant) dans `brain_chat_messages` (best-effort, ne casse pas si table absente)
- Lecture historique depuis DB (10 derniers messages) au lieu du client
- Persona Zahira centrée sur Solution Phone, ton direct calme

### ✅ 4. Whitelist API étendue
Ajouté à `/api/supabase.js` :
- `brain_chat_messages` (historique chat)
- `mes_avis_google` (KPI avis sur la home)

---

## Ce que toi tu dois faire (dans cet ordre)

### Étape 1 — Push (1 min)
1. Ouvre **GitHub Desktop**
2. Tu verras les fichiers modifiés/créés :
   - `index.html` (retrait Aria + bouton Zahira)
   - `home.html` (NEW · nouvelle home)
   - `api/brain/chat.js` (persona Zahira + persistence)
   - `api/supabase.js` (whitelist élargie)
   - `brain-chat-messages.sql` (NEW · migration SQL)
   - Mockups dans `autopilot/` (référence)
3. Commit message suggéré : `feat: home Zahira + retrait Aria + persona chat`
4. **Push origin**
5. Vercel redéploie automatiquement (1-2 min)

### Étape 2 — SQL Supabase (30 sec)
1. Ouvre **Supabase SQL Editor**
2. Colle ce SQL et clique **Run** :

```sql
create table if not exists brain_chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  cost_eur numeric(10,4) default 0,
  tokens_in int default 0,
  tokens_out int default 0,
  created_at timestamptz default now()
);

create index if not exists brain_chat_messages_created_at_idx
  on brain_chat_messages(created_at desc);

alter table brain_chat_messages disable row level security;
```

(C'est aussi dans le fichier `brain-chat-messages.sql` à la racine du repo si tu préfères ouvrir ce fichier)

### Étape 3 — Tester (5 min)
1. Va sur **`app.solution-phone.fr`** + Ctrl+Shift+R
2. Vérifie que l'app classique fonctionne normalement (caisse, stock, etc.)
3. Clique sur le bouton rouge **◢ Zahira** en haut à droite → tu arrives sur `/home.html`
4. Tu vois :
   - Photo Zahira pulser en rouge
   - "Bonjour Sébastien"
   - Une synthèse dynamique selon les vraies décisions en attente
   - Les 5 KPIs réels (CA jour, etc.)
   - Les 4 grandes cartes opérations colorées
   - Les 5 avatars de l'équipe IA dans leurs anneaux colorés
5. Tape un message dans le composer ("Quel est le CA du mois ?") → Zahira répond
6. Vérifie dans Supabase → table `brain_chat_messages` → tu dois voir 2 lignes (user + assistant) après chaque échange

---

## Si ça plante

**Si la home `/home.html` ne s'affiche pas** : vérifie l'URL exacte. Vercel peut nécessiter un redeploy manuel après ajout de fichier (rare).

**Si les avatars ne s'affichent pas** : vérifie que les fichiers `images/anissa.png`, `images/assya.png`, etc. sont bien pushés sur GitHub. Si pas le cas, GitHub Desktop a peut-être ignoré le dossier — vérifier `.gitignore`.

**Si le chat Zahira répond "erreur"** : ouvre console F12, regarde la response de `/api/brain/chat`. Si erreur SQL sur `brain_chat_messages` → exécute le SQL ci-dessus.

**Si les KPIs sont à "—"** : c'est que `/api/supabase` retourne 403 sur une table. Console F12, regarde les requêtes. Si `mes_avis_google` est en 403 → re-vérifie que le push de `api/supabase.js` est bien passé.

**Si l'app classique est cassée** : revert le commit (GitHub Desktop → History → click commit → Revert). Tout revient comme avant.

---

## Prochaine étape (quand tu auras testé tout ça)

- **Configurer Meta tokens** (META_PAGE_TOKEN, META_IG_USER_ID, META_FB_PAGE_ID) — guide dans `meta-tokens-setup.md`
- Une fois fait, Assya publiera vraiment sur Insta + FB depuis ses propositions

---

## Tâches restantes (pour plus tard)

- **MVP relance intelligente** (réseaux dormants) — on en reparle
- **Génération logo 3D Solution Phone** (prompt déjà fourni)
- **Pennylane integration** (Anissa va vraiment lire les factures à justifier)
- **Workflows opérations boutique** (les 4 grandes cartes ouvrent des vrais workflows ultra-rapides)

---

Bonne reprise. Si quoi que ce soit pète, dis-le-moi et je fix.
