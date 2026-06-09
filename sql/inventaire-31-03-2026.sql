-- /sql/inventaire-31-03-2026.sql
-- Solution Phone · Inventaire au 31 mars 2026
--
-- Extraction des smartphones d'occasion en stock à la date du 31/03/2026
-- = achetés avant ou le 31/03/2026 ET non vendus à cette date
--
-- À exécuter dans Supabase SQL Editor → Export CSV pour le comptable.

-- ════════════════════════════════════════════════════════════════════
-- REQUÊTE PRINCIPALE — Liste détaillée smartphones occasion au 31/03/2026
-- ════════════════════════════════════════════════════════════════════
SELECT
  id,
  modele,
  stockage AS "stockage_go",
  grade,
  couleur,
  batterie AS "batterie_pct",
  imei,
  type_achat,
  CASE
    WHEN type_achat = 'PARTICULIER' THEN vendeur_nom
    ELSE fournisseur
  END AS "vendeur_ou_fournisseur",
  date_achat,
  achat AS "prix_achat_eur",
  mode AS "mode_paiement"
FROM phones
WHERE
  -- Acheté avant ou le 31/03/2026
  date_achat <= '2026-03-31'
  -- Non vendu OU vendu après le 31/03/2026
  AND (
    date_vente IS NULL
    OR date_vente > '2026-03-31'
  )
  -- Exclure les phones en statut "VENDU" sans date_vente bizarre
  AND (etat IS NULL OR UPPER(etat) <> 'VENDU' OR date_vente > '2026-03-31')
ORDER BY modele, stockage, date_achat;

-- ════════════════════════════════════════════════════════════════════
-- RÉSUMÉ — Nombre et valeur totale du stock occasion au 31/03/2026
-- ════════════════════════════════════════════════════════════════════
SELECT
  COUNT(*) AS "nb_smartphones",
  SUM(achat) AS "valeur_totale_eur",
  ROUND(AVG(achat)::numeric, 2) AS "prix_moyen_eur",
  MIN(achat) AS "prix_min_eur",
  MAX(achat) AS "prix_max_eur"
FROM phones
WHERE
  date_achat <= '2026-03-31'
  AND (date_vente IS NULL OR date_vente > '2026-03-31')
  AND (etat IS NULL OR UPPER(etat) <> 'VENDU' OR date_vente > '2026-03-31');

-- ════════════════════════════════════════════════════════════════════
-- RÉPARTITION par modèle
-- ════════════════════════════════════════════════════════════════════
SELECT
  modele,
  COUNT(*) AS "nb",
  SUM(achat) AS "valeur_totale_eur",
  ROUND(AVG(achat)::numeric, 2) AS "prix_moyen_eur"
FROM phones
WHERE
  date_achat <= '2026-03-31'
  AND (date_vente IS NULL OR date_vente > '2026-03-31')
  AND (etat IS NULL OR UPPER(etat) <> 'VENDU' OR date_vente > '2026-03-31')
GROUP BY modele
ORDER BY SUM(achat) DESC;
