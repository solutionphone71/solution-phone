-- /sql/add-composed-url-column.sql
-- Solution Phone · Ajoute composed_image_url à visual_jobs
-- Stocke l'URL de l'image FINALE composée (IA + overlay HTML)
ALTER TABLE visual_jobs
  ADD COLUMN IF NOT EXISTS composed_image_url TEXT;

COMMENT ON COLUMN visual_jobs.composed_image_url IS 'URL Supabase Storage de l''image finale (IA ambiance + overlay HTML pixel-perfect via @vercel/og)';
