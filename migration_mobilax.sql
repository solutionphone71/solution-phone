-- ════════════════════════════════════════════════════════════════
-- TABLE MOBILAX — Sous-traitance Mobilax
-- À exécuter dans le SQL Editor de Supabase
-- ════════════════════════════════════════════════════════════════
-- IMPORTANT : les colonnes en camelCase sont entre guillemets car le
-- code JS envoie les données directement sans transformation
-- (lockType, lockValue, schemaImage, dateRetour).

CREATE TABLE IF NOT EXISTS public.mobilax (
  id            BIGINT PRIMARY KEY,
  numero        TEXT,
  date          DATE,
  nom           TEXT,
  tel           TEXT,
  modele        TEXT,
  panne         TEXT,
  devis20       BOOLEAN DEFAULT TRUE,
  prix          TEXT,
  "lockType"    TEXT,
  "lockValue"   TEXT,
  "schemaImage" TEXT,
  obs           TEXT,
  statut        TEXT DEFAULT 'en_cours',
  "dateRetour"  DATE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Index utiles pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_mobilax_statut ON public.mobilax(statut);
CREATE INDEX IF NOT EXISTS idx_mobilax_date   ON public.mobilax(date DESC);
CREATE INDEX IF NOT EXISTS idx_mobilax_numero ON public.mobilax(numero);

-- Row Level Security (à adapter selon ta config — ici policy permissive
-- comme les autres tables de l'app puisque l'accès passe par le proxy
-- Vercel qui détient la clé service_role)
ALTER TABLE public.mobilax ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all via proxy" ON public.mobilax;
CREATE POLICY "Allow all via proxy" ON public.mobilax
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════
-- Vérification : doit retourner 16 colonnes
-- ════════════════════════════════════════════════════════════════
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'mobilax' AND table_schema = 'public'
ORDER BY ordinal_position;
