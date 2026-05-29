-- ════════════════════════════════════════════════════════════════
-- SETUP CP & SALARIÉS — Solution Phone (v2 — compat. table existante)
-- À exécuter dans Supabase SQL Editor (supabase.com → SQL Editor)
-- ════════════════════════════════════════════════════════════════
-- Ce script :
-- 1. Crée la table `settings` si elle n'existe pas
-- 2. Ajoute la colonne `updated_at` si elle manque
-- 3. Insère/Met à jour les 4 salariés actuels avec leurs CP de mai 2026
-- ════════════════════════════════════════════════════════════════

-- 1. CRÉATION TABLE settings (si absente)
CREATE TABLE IF NOT EXISTS public.settings (
  id    SERIAL PRIMARY KEY,
  key   TEXT NOT NULL UNIQUE,
  value TEXT
);

-- 2. AJOUT colonne updated_at si manquante
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Index pour accélérer les requêtes par clé
CREATE INDEX IF NOT EXISTS idx_settings_key ON public.settings(key);

-- 4. Trigger pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION update_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_settings_updated_at ON public.settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON public.settings
  FOR EACH ROW EXECUTE FUNCTION update_settings_updated_at();

-- ════════════════════════════════════════════════════════════════
-- 5. INSERTION / MISE À JOUR DES SALARIÉS AVEC CP DE MAI 2026
-- (Evan ANGOSTO retiré — n'est plus dans l'entreprise)
-- ════════════════════════════════════════════════════════════════

INSERT INTO public.settings (key, value)
VALUES (
  'salaries_data',
  '[
    {
      "prenom":"Nawfel","nom":"CRANCE","secu":"1 03 12 71 270 162 01","matricule":"00006",
      "dateEntree":"2024-11-01","type":"cdi","categorie":"Employé",
      "niveau":"Echelon Niveau 3 — Vendeur","salaire":"1823.07","anciennete":"3","pas":"0",
      "adresse":"96 Rue Jules Ferry","cp":"01750","ville":"Saint Laurent sur Saône","iban":"",
      "apprentiPct":"0","paies":{},
      "cpSoldeN1":9,
      "cpHistorique":[
        {"date":"2026-04-30","jours":21,"mois":"2026-04","motif":"Cumul CP pris avant intégration"},
        {"date":"2026-05-15","jours":1,"mois":"2026-05","motif":"CP mai"},
        {"date":"2026-05-27","jours":1,"mois":"2026-05","motif":"CP mai"}
      ]
    },
    {
      "prenom":"Rahim","nom":"HASSANI","secu":"1 05 12 98 511 033 27","matricule":"00007",
      "dateEntree":"2025-10-01","type":"cdi","categorie":"Employé",
      "niveau":"Echelon Niveau 3 — Vendeur","salaire":"1823.07","anciennete":"3","pas":"0",
      "adresse":"4 Rue de Bretagne","cp":"71000","ville":"Mâcon","iban":"",
      "apprentiPct":"0","paies":{},
      "cpSoldeN1":0,
      "cpHistorique":[
        {"date":"2026-05-28","jours":1,"mois":"2026-05","motif":"CP mai (jeudi)"},
        {"date":"2026-05-29","jours":1,"mois":"2026-05","motif":"CP mai (vendredi - jour de repos permuté)"},
        {"date":"2026-05-30","jours":1,"mois":"2026-05","motif":"CP mai (samedi)"}
      ]
    },
    {
      "prenom":"Raphaël","nom":"JOUIN","secu":"1 06 01 78 646 471 25","matricule":"00009",
      "dateEntree":"2024-08-01","type":"apprenti","categorie":"Apprenti",
      "niveau":"Apprenti Vendeur","salaire":"929.77","anciennete":"1","pas":"0",
      "adresse":"47 Impasse de la Grisière","cp":"71118","ville":"Saint Martin Belle Roche","iban":"",
      "apprentiPct":"51","paies":{},
      "cpSoldeN1":12,
      "cpHistorique":[
        {"date":"2026-04-30","jours":22,"mois":"2026-04","motif":"Cumul CP pris avant intégration"},
        {"date":"2026-05-15","jours":1,"mois":"2026-05","motif":"CP mai"},
        {"date":"2026-05-26","jours":1,"mois":"2026-05","motif":"CP mai"}
      ]
    },
    {
      "prenom":"Martin","nom":"CHAVET","secu":"1 08 10 01 451 206 20","matricule":"00010",
      "dateEntree":"2024-09-01","type":"apprenti","categorie":"Apprenti",
      "niveau":"Apprenti","salaire":"711.00","anciennete":"1","pas":"0",
      "adresse":"189 Chemin des Rollets","cp":"01140","ville":"Illiat","iban":"",
      "apprentiPct":"39","paies":{},
      "cpSoldeN1":16,
      "cpHistorique":[
        {"date":"2026-04-30","jours":26,"mois":"2026-04","motif":"Cumul CP pris avant intégration"},
        {"date":"2026-05-08","jours":1,"mois":"2026-05","motif":"CP mai (à supprimer si boutique fermée le 8 mai)"},
        {"date":"2026-05-15","jours":1,"mois":"2026-05","motif":"CP mai"}
      ]
    }
  ]'
)
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value;
  -- (updated_at est mis à jour automatiquement par le trigger)

-- ════════════════════════════════════════════════════════════════
-- 6. VÉRIFICATION
-- ════════════════════════════════════════════════════════════════

SELECT
  key,
  LEFT(value, 100) || '...' AS aperçu_json,
  updated_at
FROM public.settings
WHERE key = 'salaries_data';

-- ✅ Devrait afficher 1 ligne avec un aperçu du JSON des 4 salariés
-- ════════════════════════════════════════════════════════════════
-- ✅ FIN DU SCRIPT
-- ════════════════════════════════════════════════════════════════
