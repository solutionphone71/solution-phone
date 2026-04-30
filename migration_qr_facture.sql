-- Ajouter les colonnes facture et qr_envoi dans bons_depot
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE bons_depot ADD COLUMN IF NOT EXISTS facture JSONB DEFAULT NULL;
ALTER TABLE bons_depot ADD COLUMN IF NOT EXISTS qr_envoi JSONB DEFAULT NULL;

-- Vérification
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'bons_depot' AND column_name IN ('facture', 'qr_envoi');
