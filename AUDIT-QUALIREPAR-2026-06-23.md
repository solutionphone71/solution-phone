# Audit & améliorations QualiRépar — 23 juin 2026

Revue de la partie QualiRépar (proxies éco-organismes + workflow facture/bonus).
Voici ce qui a été corrigé, et ce qu'il te reste à faire côté Vercel.

---

## ✅ Corrections appliquées

### 1. Clé API Ecologic en clair dans le code (sécurité — important)
La clé `8121d135-…` était écrite en dur dans `api/proxy-ecologic.js` **et**
`api/qualirepar-health.js`. Combinée au CORS ouvert à tous (`*`), n'importe quel
site web pouvait appeler ton proxy depuis un navigateur et consommer ta clé.

**Fait** : les deux fichiers lisent maintenant `process.env.ECOLOGIC_API_KEY`,
avec la valeur actuelle en repli pour ne rien casser pendant la migration.

### 2. CORS verrouillé sur les domaines Solution Phone
`proxy-ecologic` et `proxy-ecosystem` autorisaient toutes les origines (`*`).
Comme l'app appelle ces proxies en *same-origin*, le `*` n'apportait rien et
ouvrait la porte à un usage par un site tiers.

**Fait** : CORS restreint à `app.solution-phone.fr`, `solution-phone.fr` et
`www.solution-phone.fr`. Aucun impact sur l'app.

### 3. Endpoints de debug ouverts au public (sécurité)
`proxy-ecosystem` exposait :
- `?debug=1` → révélait la config interne (URLs des environnements, en-têtes).
- `?test=1&id=…&pw=…` → testait des couples login/mot de passe Ecosystem sur les
  3 environnements. Un endpoint de test de mots de passe ouvert à tous.

**Fait** : les deux modes sont désormais protégés par un token secret
(`?key=<DEBUG_TOKEN>`). Sans variable `DEBUG_TOKEN` configurée, ils renvoient 404.

### 4. Bug d'incohérence du bonus (25 € vs 30 €)
Le montant du bonus est majoré à **30 €** quand une pièce issue de l'économie
circulaire (PIEC) est utilisée, **25 €** sinon. Mais l'envoi **SMS** déduisait
toujours 25 € en dur, et le mail affichait « -25 € » même pour un dossier à 30 €.

**Fait** : le SMS et le texte du mail utilisent maintenant le bon montant
(`piec ? 30 : 25`), comme le reste de l'app.

---

## ⚠️ À faire de ton côté (5 min, dans Vercel)

1. **Vercel → Projet → Settings → Environment Variables**, ajouter :
   - `ECOLOGIC_API_KEY` = `8121d135-4635-412d-b7ab-3b4dd61cbdb8`
   - `DEBUG_TOKEN` = (une chaîne secrète au choix, ex. un mot de passe long) —
     seulement si tu veux pouvoir réutiliser `?debug=1` / `?test=1`.
2. **Redéployer** (push ou « Redeploy »).
3. Une fois la variable active, **supprimer la valeur en clair** dans
   `api/proxy-ecologic.js` et `api/qualirepar-health.js` (remplacer
   `process.env.ECOLOGIC_API_KEY || '8121d135-…'` par juste
   `process.env.ECOLOGIC_API_KEY`).
4. Comme la clé a vécu dans l'historique Git public, **demander à Ecologic de la
   régénérer** est la seule façon de la rendre vraiment sûre.

---

## 🚑 Corrections envoi Ecologic (bloquant prod — 23/06 après-midi)

Suite à ton test réel : le dossier partait à Ecologic « avec des erreurs »
sans que l'app te prévienne. Trois causes traitées.

### 5. Panne / code IRIS manquant → dossier refusé en silence
Si la panne n'était pas sélectionnée, l'app envoyait quand même avec des codes
IRIS bidons (`symptom: XX1`, `section: XX`). Ecologic créait le dossier puis le
marquait en erreur — invisible côté app.

**Fait** : l'envoi est désormais **bloqué** si la panne n'est pas reconnue. Message
clair + focus automatique sur le sélecteur de panne. Plus aucun envoi avec des
codes IRIS invalides.

### 6. Erreurs de validation post-envoi maintenant affichées
Quand Ecologic renvoie des `ValidationErrors`, l'app affichait un minuscule texte
orange facile à rater.

**Fait** : bandeau orange bien visible « Dossier Ecologic INCOMPLET — à compléter :
… » + notification, avec lien direct vers le portail Ecologic.

### 7. IMEI mal lu par la photo (OCR) → détection par clé de contrôle
Un IMEI a un 15ᵉ chiffre calculé (algorithme de Luhn). Quand l'IA lisait mal un
chiffre, l'app affichait quand même « ✅ IMEI lu » et l'envoyait tel quel.

**Fait** :
- La saisie IMEI vérifie maintenant la clé de contrôle, pas seulement « 15 chiffres ».
- Après l'OCR, si la clé est fausse → avertissement orange « un chiffre est sûrement
  mal lu, vérifiez/reprenez la photo » au lieu d'un faux ✅.
- L'envoi Ecologic exige 15 chiffres et **demande confirmation** si la clé Luhn
  échoue (« Envoyer quand même ? »).

---

## 💡 Pistes pour plus tard (non urgent)

- **Dédupliquer le montant du bonus** : la règle `piec ? 30 : 25` est répétée
  ~15 fois dans `index.html` (`_qrBonus`, `_kiwizBonus`, `_caisseBonus`,
  `_emailBonus`, `_smsBonus`…). Une seule fonction `bonusQR(piec)` éviterait
  qu'un oubli recrée l'incohérence corrigée ci-dessus.
- **Mot de passe Ecosystem** : encore saisi côté navigateur et stocké en
  `localStorage` (`sp_eco_pass`). Idéalement déplacé côté serveur via une env var
  `ECOSYSTEM_PASSWORD`, comme déjà noté en TODO dans le code (ligne ~19839).
- **`workflows/qualirepar.html`** est marqué « DRAFT — NE PAS UTILISER » et
  n'intègre pas les éco-organismes. À supprimer ou à finir pour éviter toute
  confusion avec le vrai parcours dans `index.html`.

---

*Fichiers modifiés : `api/proxy-ecologic.js`, `api/proxy-ecosystem.js`,
`api/qualirepar-health.js`, `index.html` (fonctions envoi SMS + mail).*
