# Setup Meta Tokens · Solution Phone

**Objectif** — connecter ton compte Instagram + page Facebook à Solution Phone pour que les décisions validées par **ASSYA** publient vraiment sur Insta et FB.

⏱ **Durée totale** : ~30 minutes (la première fois — après c'est figé pour 2 mois).

---

## Pré-requis

- ✅ Page Facebook **Solution Phone** existe (oui)
- ✅ Compte Instagram **Solution Phone** existe (oui)
- ✅ Le compte IG est en mode **Business** ou **Creator** (à vérifier dans l'app Insta → Paramètres → Compte → Passer à un compte pro si pas déjà fait)
- ✅ Le compte IG est **lié à la page Facebook** (Insta App → Paramètres → Compte → Comptes liés → Facebook)

Si l'un des deux derniers points n'est pas fait, fais-le maintenant — sinon Meta refusera l'accès.

---

## Étape 1 · Créer ton App Meta Developer (5 min)

1. Va sur **https://developers.facebook.com/apps**
2. Connecte-toi avec ton compte Facebook (celui admin de la page Solution Phone)
3. Clique **Create App**
4. Type : choisis **Business** → Next
5. Nom de l'app : `Solution Phone Publisher`
6. Email de contact : `sebastien.cannard@gmail.com`
7. Business portfolio : sélectionne ton portfolio Solution Phone (ou laisse "No business portfolio")
8. **Create app**

→ Tu arrives sur le dashboard de l'app.

---

## Étape 2 · Ajouter les produits Instagram + Facebook (3 min)

Dans le menu de gauche du dashboard de ton app Meta :

1. Clique **Add Product**
2. Cherche **Instagram** → clique **Set up**
3. Retour en arrière → cherche **Facebook Login for Business** → **Set up**

Tu auras maintenant 2 produits installés sur ton app.

---

## Étape 3 · Récupérer ton Page Access Token (10 min)

C'est l'étape la plus tordue de Meta. Suis exactement.

### 3.1 — Token court (1h de validité)

1. Va sur **https://developers.facebook.com/tools/explorer**
2. En haut à droite, dans **Meta App**, sélectionne `Solution Phone Publisher`
3. Dans **User or Page**, sélectionne **Get Page Access Token** → choisis ta page **Solution Phone**
4. Dans **Permissions**, ajoute (clique "Add permission") :
   - `pages_show_list`
   - `pages_read_engagement`
   - `pages_manage_posts`
   - `instagram_basic`
   - `instagram_content_publish`
   - `instagram_manage_comments`
   - `business_management`
5. Clique **Generate Access Token**
6. Une popup Facebook s'ouvre → autorise toutes les permissions
7. Le token apparaît dans le champ — **copie-le** (il est long, commence par `EAA...`)

⚠️ Ce token est valide **1h seulement**. On va l'allonger à l'étape suivante.

### 3.2 — Convertir en long-lived (2 mois)

Ouvre cet URL dans ton navigateur (remplace `TON_TOKEN_COURT` et `APP_ID`/`APP_SECRET`) :

```
https://graph.facebook.com/v21.0/oauth/access_token?
  grant_type=fb_exchange_token&
  client_id=APP_ID&
  client_secret=APP_SECRET&
  fb_exchange_token=TON_TOKEN_COURT
```

Pour récupérer `APP_ID` et `APP_SECRET` :
- Dashboard Meta → ton app → **Settings → Basic**
- App ID : visible
- App Secret : clique **Show** + entre ton mot de passe

L'URL te renverra un JSON :
```json
{ "access_token": "EAA....très-long...", "token_type": "bearer", "expires_in": 5184000 }
```

→ **Copie le `access_token`** — c'est ton **long-lived user token** (60 jours).

### 3.3 — Convertir en page token permanent

Ouvre cet URL avec le token long-lived que tu viens d'avoir :

```
https://graph.facebook.com/v21.0/me/accounts?access_token=TON_LONG_LIVED_TOKEN
```

Tu auras un JSON avec un tableau `data` où chaque entrée représente une de tes pages :
```json
{
  "data": [
    {
      "access_token": "EAAxxx...",
      "category": "Service local",
      "name": "Solution Phone",
      "id": "1234567890..."
    }
  ]
}
```

→ **Copie le `access_token` de la page Solution Phone.** Celui-là **n'expire jamais** (sauf si tu changes ton mot de passe FB ou révoque l'app).

C'est ton **`META_PAGE_TOKEN`**.

---

## Étape 4 · Récupérer META_FB_PAGE_ID (instant)

Tu l'as déjà dans le JSON précédent — c'est le `id` de l'objet ta page Solution Phone (ex: `1234567890987654`).

C'est ton **`META_FB_PAGE_ID`**.

---

## Étape 5 · Récupérer META_IG_USER_ID (2 min)

Avec ton `META_PAGE_TOKEN`, ouvre cette URL :

```
https://graph.facebook.com/v21.0/META_FB_PAGE_ID?fields=instagram_business_account&access_token=META_PAGE_TOKEN
```

Réponse :
```json
{
  "instagram_business_account": { "id": "17841..." },
  "id": "1234567890..."
}
```

→ Le `id` à l'intérieur de `instagram_business_account` est ton **`META_IG_USER_ID`**.

---

## Étape 6 · Ajouter les 3 vars dans Vercel (3 min)

1. Va sur **https://vercel.com/dashboard** → projet `solution-phone`
2. **Settings → Environment Variables**
3. Ajoute les 3 vars (Production + Preview + Development à chaque fois) :

| Key | Value |
|-----|-------|
| `META_PAGE_TOKEN`  | (le long token de l'étape 3.3, jamais expiré) |
| `META_FB_PAGE_ID`  | (l'ID page de l'étape 4) |
| `META_IG_USER_ID`  | (l'ID Insta Business de l'étape 5) |

4. Clique **Save** pour chaque var
5. **Deployments → ⋮ sur le dernier deploy → Redeploy** (pour que les nouvelles vars soient lues)

---

## Étape 7 · Tester en vrai (5 min)

Une fois Vercel redéployé :

1. Va sur **app.solution-phone.fr** → ◢ Autopilot
2. Clique **▶ Lancer un run manuel** (l'équipe Zahira propose des décisions)
3. Sur une décision d'**ASSYA** type `post` → clique **Publier maintenant**
4. → ça appelle `/api/autopilot/execute` qui appelle `publishInstagram` + `publishFacebook`

**Si ça marche :**
- Toast vert "✅ Décision validée"
- Va sur Instagram + Facebook → ton post est en ligne 🎉
- Dans la table `social_posts` côté Supabase → 1 nouvelle ligne avec `ig_post_id` et `fb_post_id` remplis

**Si ça plante :**
- Console F12 → onglet Network → trouve l'appel `/api/autopilot/execute` → regarde la response
- Tu verras un message du genre `"Meta IG exception: ..."` ou `"Meta container failed: ..."`
- Les causes habituelles :
  - Compte IG pas en mode Business
  - Compte IG pas lié à la page FB
  - Permission manquante dans le token (refais l'étape 3 avec toutes les permissions)
  - L'URL de l'image dans `payload.media_url` n'est pas accessible publiquement (Meta refuse les URLs privées)

---

## Étape 8 · Renouveler les tokens (rappel 60 jours)

⚠️ Le `META_PAGE_TOKEN` issu d'un long-lived user token **expire au bout de 60 jours**.

→ Mets-toi un rappel dans ton calendrier : **"Renouveler Meta token Solution Phone"** tous les 50 jours.

Pour renouveler : refais juste les étapes 3.1 → 3.3, copie le nouveau token dans Vercel, redeploy. 5 minutes.

(Plus tard on peut automatiser le renouvellement via une route Vercel, mais ça vaut pas le coup pour 2 ans avant que ça pose problème.)

---

## Récap : 3 vars à mettre dans Vercel

```
META_PAGE_TOKEN  = EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx (token de page, ~60j)
META_FB_PAGE_ID  = 1234567890123456 (id de la page FB Solution Phone)
META_IG_USER_ID  = 17841234567890123 (id du compte IG Business)
```

Une fois ces 3 vars en place + redeploy, **Solution Phone publie pour de vrai sur Insta + FB** dès que tu valides une décision d'Assya.

---

## Bonus : si tu veux vérifier rapidement que ton token marche

Dans la console F12 d'app.solution-phone.fr, après redeploy :

```js
fetch('/api/autopilot/execute?decision_id=TEST', {method:'POST'})
  .then(r=>r.json()).then(console.log);
```

Tu auras une erreur `"Décision introuvable"` (normal, l'id TEST n'existe pas) — mais si tu vois cette erreur, ça veut dire que les variables sont bien lues.

Si tu vois `"Meta non configuré"`, c'est qu'une des 3 vars n'est pas dans Vercel ou que tu n'as pas redeployé.
