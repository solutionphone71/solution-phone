-- /sql/historique-reparations-indexes.sql
-- Solution Phone · Sprint 15J · J11 · mai 2026
--
-- Index pour rendre les recherches dans historique_reparations rapides
-- même avec 10 000+ lignes Phonilab importées.
-- À exécuter dans Supabase SQL Editor.

-- Index sur date_rep DESC : pour le boot rapide (500 plus récentes)
CREATE INDEX IF NOT EXISTS idx_hist_rep_date ON historique_reparations(date_rep DESC);

-- Index sur numero : pour skip doublons à l'import (10 000 lookups au lieu de 10 000 × 10 000 = 100M)
CREATE INDEX IF NOT EXISTS idx_hist_rep_numero ON historique_reparations(numero);

-- Index GIN trigramme sur client_nom : pour les recherches ilike rapides
-- (gère "DUPONT", "dupont", "Dup", "Mr Dupont" → tous matchent rapidement)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_hist_rep_client_nom_trgm
  ON historique_reparations USING gin (client_nom gin_trgm_ops);

-- Index sur client_tel : recherches par téléphone instantanées
CREATE INDEX IF NOT EXISTS idx_hist_rep_client_tel ON historique_reparations(client_tel);

-- Index sur client_email pour les recherches par email
CREATE INDEX IF NOT EXISTS idx_hist_rep_client_email ON historique_reparations(client_email);

-- Optionnel : index sur source pour distinguer phonilab vs app rapidement
CREATE INDEX IF NOT EXISTS idx_hist_rep_source ON historique_reparations(source);

COMMENT ON INDEX idx_hist_rep_date IS 'Boot rapide : tri par date desc';
COMMENT ON INDEX idx_hist_rep_numero IS 'Skip doublons à l import (uniqueness check)';
COMMENT ON INDEX idx_hist_rep_client_nom_trgm IS 'Recherche fuzzy par nom client (ilike)';
COMMENT ON INDEX idx_hist_rep_client_tel IS 'Recherche par téléphone client';
