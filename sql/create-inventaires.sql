-- /sql/create-inventaires.sql
-- Solution Phone · Module Inventaires comptables
-- 9 juin 2026

-- ─── Table en-tête inventaire ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventaires (
  id              bigserial PRIMARY KEY,
  date_inventaire date NOT NULL,
  nom             text NOT NULL,
  statut          text NOT NULL DEFAULT 'draft',    -- draft · validated · archived
  total_ht        numeric(12,2) DEFAULT 0,
  total_section1  numeric(12,2) DEFAULT 0,
  total_section2  numeric(12,2) DEFAULT 0,
  total_section3  numeric(12,2) DEFAULT 0,
  etabli_par      text,
  source_file     text,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventaires_date ON inventaires(date_inventaire DESC);

-- ─── Table lignes détaillées d'inventaire ─────────────────────────
CREATE TABLE IF NOT EXISTS inventaire_items (
  id              bigserial PRIMARY KEY,
  inventaire_id   bigint NOT NULL REFERENCES inventaires(id) ON DELETE CASCADE,
  section         int NOT NULL,                    -- 1=accessoires/pièces · 2=neufs · 3=occasion
  categorie       text NOT NULL,                   -- "Écrans iPhone", "Samsung", etc.
  designation     text NOT NULL,
  quantite        numeric(10,2) NOT NULL DEFAULT 0,
  pu_ht           numeric(12,2) NOT NULL DEFAULT 0,
  montant_ht      numeric(12,2) NOT NULL DEFAULT 0,
  order_index     int DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inv_items_inv ON inventaire_items(inventaire_id, section, order_index);

-- ─── RLS off (interne) + grants ───────────────────────────────────
ALTER TABLE inventaires      DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventaire_items DISABLE ROW LEVEL SECURITY;
GRANT ALL ON inventaires      TO anon, authenticated, service_role;
GRANT ALL ON inventaire_items TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ─── Vérification ─────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM inventaires)      AS nb_inventaires,
  (SELECT COUNT(*) FROM inventaire_items) AS nb_items;
