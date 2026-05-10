-- /sql/cloture-journee.sql
-- Solution Phone · Sprint 15J · J10 · mai 2026
--
-- Table de clôture de journée (les 2 Z dissociés sauvegardés au format JSON)
-- À exécuter dans Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS cloture_journee (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL,
  heure TEXT,
  -- Z Principal (TVA 20% : réparations + accessoires + tél. neufs)
  z_principal JSONB,         -- { nb, total, cb, especes, cheque, virement }
  -- Z Occasion (TVA marge : smartphones reconditionnés Art.297A)
  z_occasion  JSONB,         -- { nb, total, cb, especes, cheque, virement, reprises, netEncaisse }
  -- Compté + écart espèces (tiroir-caisse physique)
  theorique_especes NUMERIC(10,2),
  compte_especes    NUMERIC(10,2),
  ecart_especes     NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloture_journee_date ON cloture_journee(date DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cloture_journee_unique_date ON cloture_journee(date);

COMMENT ON TABLE cloture_journee IS 'Clôture quotidienne — Z Principal (TVA 20%) + Z Occasion (TVA marge) dissociés + écart espèces';
