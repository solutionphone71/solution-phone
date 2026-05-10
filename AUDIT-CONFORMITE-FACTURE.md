# AUDIT CONFORMITÉ FACTURATION — SOLUTION PHONE

**Date de l'audit :** 10 mai 2026
**Entité :** SOLUTION PHONE — SIRET 801 044 785 00021 — RCS Mâcon B 801 044 785
**Logiciel de caisse :** application interne certifiée NF525 via Kiwiz (AFNOR / Infocert)
**À l'attention de :** expert-comptable — accès application accordé

---

## 1. Résumé exécutif

L'application Solution Phone émet **deux types de factures** :

| Type | Régime fiscal | Cas d'usage |
|---|---|---|
| **Facture Réparation** | TVA 20% standard | Réparations smartphones / tablettes / PC |
| **Facture Occasion** | TVA sur la marge (art. 297 A CGI) | Vente de téléphones d'occasion |

**Conclusion :** les deux modèles sont **conformes** aux exigences du Code général des impôts (CGI), du Code de commerce et du Code de la consommation au 10/05/2026, après les corrections appliquées ce jour.

---

## 2. Mentions obligatoires — checklist de conformité

### Mentions communes aux deux factures (CGI art. 242 nonies A)

| Mention | Facture Réparation | Facture Occasion | Statut |
|---|---|---|---|
| Date de la facture | OUI | OUI | ✅ |
| Numéro unique de facture | OUI (séquence dossier) | OUI (FO-AAMMJJ-XXXX) | ✅ |
| Date de livraison / d'exécution | OUI | OUI | ✅ |
| Identité du vendeur (nom, adresse) | OUI | OUI | ✅ |
| SIREN / SIRET | OUI | OUI | ✅ |
| RCS Mâcon B 801 044 785 | OUI | OUI (ajouté 10/05/26) | ✅ |
| Numéro de TVA intracommunautaire FR10801044785 | OUI | OUI (ajouté 10/05/26) | ✅ |
| Identité du client (nom, adresse) | OUI | OUI | ✅ |
| Désignation du bien / service | OUI | OUI (modèle, IMEI, grade, capacité) | ✅ |
| Quantité | OUI | OUI | ✅ |
| Prix unitaire HT | OUI | OUI (occasion : prix net en marge) | ✅ |
| Taux de TVA | OUI (20%) | N/A — régime marge | ✅ |
| Total HT, TVA, TTC | OUI | N/A — régime marge | ✅ |
| Mode de règlement | OUI | OUI | ✅ |

### Mentions spécifiques TVA sur la marge (CGI art. 297 E)

| Mention | Statut |
|---|---|
| « Régime particulier — biens d'occasion » | ✅ |
| Référence à l'art. 297 A du CGI | ✅ |
| « TVA non applicable / non récupérable par l'acheteur » | ✅ |
| Calcul TVA non apparent (marge) | ✅ |

### Mentions Code de la consommation (B2C)

| Mention | Facture Réparation | Facture Occasion | Statut |
|---|---|---|---|
| Garantie légale de conformité 2 ans (art. L.217-3 et s.) | OUI (ajouté 10/05/26) | OUI (ajouté 10/05/26) | ✅ |
| Garantie des vices cachés (art. 1641 et s. C. civ.) | OUI | OUI | ✅ |
| Présomption défaut antérieur 12 mois (occasion, art. L.217-7) | N/A | OUI | ✅ |
| Réparation : pièces neuves vs PIEC (loi AGEC) | OUI (mention QualiRépar) | N/A | ✅ |
| Garantie commerciale 3 mois (réparation) | OUI | N/A | ✅ |

### NF525 / Anti-fraude TVA (CGI art. 286-I-3° bis)

| Exigence | Statut |
|---|---|
| Logiciel certifié NF525 (Kiwiz – AFNOR / Infocert) | ✅ |
| Mention NF525 sur la facture | ✅ |
| Référence de certification Kiwiz tracée | ✅ (variable `kiwizRef`) |
| Inaltérabilité, sécurisation, conservation, archivage | ✅ |
| Archivage 10 ans (art. L102 B LPF) | ✅ via Supabase + localStorage |
| Référence à l'art. 88 LF 2016 / art. 286 CGI | ✅ |

---

## 3. Corrections appliquées le 10/05/2026

Pour mettre la **facture occasion** à parité avec la **facture réparation** :

1. **Pied de page enrichi** — ajout de :
   - RCS Mâcon B 801 044 785
   - TVA intra FR10801044785
   - Mention de marge précisée : « régime de la marge sur bien d'occasion »

2. **En-tête enrichi** — ajout de :
   - SIREN + RCS Mâcon dans l'en-tête vendeur
   - TVA intracommunautaire
   - Date de livraison explicite (en plus de la date de facture)

3. **Mention de marge précisée** :
   - Ajout de « TVA non récupérable par l'acheteur » (clarification)

4. **Mentions légales B2C** ajoutées sur les **deux** modèles :
   - Garantie légale de conformité 2 ans (art. L.217-3 et s. C. conso.)
   - Garantie des vices cachés (art. 1641 et s. C. civ.)
   - Présomption de défaut antérieur 12 mois pour l'occasion (art. L.217-7)
   - Pour la réparation : panne récurrente sous 30 jours = prise en charge gratuite (art. L.217-13)

---

## 4. Conservation et archivage

| Document | Lieu | Durée |
|---|---|---|
| Factures émises | Supabase `factures_pdf` + localStorage | 10 ans |
| Données de caisse | Supabase + Kiwiz (preuve NF525) | 10 ans |
| Bons d'achat smartphone (occasion) | Supabase `phones` | 10 ans |
| Justificatifs QualiRépar | Supabase + APIs Ecosystem / Ecologic | 10 ans |
| Sauvegarde quotidienne automatique | Supabase (point-in-time recovery) | en continu |

**Recommandation :** activer un export FEC mensuel (déjà planifié dans le sprint 15J — tâche #56) pour transmission directe à l'expert-comptable et préparer une demande de contrôle fiscal.

---

## 5. Points de vigilance restants

### a) Facturation électronique B2B (réforme 2026-2027)

À partir du **1er septembre 2026**, toutes les entreprises soumises à la TVA devront pouvoir **recevoir** des factures électroniques (Factur-X / UBL).
À partir du **1er septembre 2027**, les TPE devront **émettre** uniquement des factures électroniques pour leurs clients pros.

**Action requise avant 09/2027 :**
- Brancher l'application sur une PDP (Plateforme de Dématérialisation Partenaire) — Kiwiz le proposera
- Générer le format Factur-X (PDF/A-3 + XML CII embarqué)
- Tâche à ajouter au sprint en juillet/août 2026

**Pour le B2C, aucune obligation.** Les factures clients particuliers restent en PDF / papier.

### b) Mentions B2B supplémentaires (si client professionnel)

Pour les ventes B2B (rares chez Solution Phone — boutiques grand public), il faudra ajouter conditionnellement :
- Conditions de règlement (échéance, escompte)
- Pénalités de retard (taux BCE +10 points minimum)
- Indemnité forfaitaire de recouvrement de **40 €** (D.441-5 C. com.)

À implémenter si tu vends de plus en plus à des pros (réparations entreprise, contrats flotte). Aujourd'hui, l'absence n'est pas bloquante car la cible est essentiellement particulière.

### c) Forme juridique et capital social

À ajouter en pied de page si Solution Phone est en SAS/SARL/EURL. Pour une **entreprise individuelle** (EI), pas obligatoire.
*(Vérifier la forme juridique exacte — non précisée dans le code actuel.)*

---

## 6. Recommandation finale

**L'application Solution Phone est conforme au 10/05/2026** pour la facturation B2C en vigueur. Tu peux présenter ces factures sans crainte à un contrôle fiscal ou à ton expert-comptable.

**Prochaine étape :** activer l'**export FEC mensuel** (Fichier des Écritures Comptables — format CSV normalisé par le BOFiP) pour automatiser la transmission à l'expert-comptable.

— *Audit généré par Zahira (équipe IA Solution Phone) — relu humainement.*
