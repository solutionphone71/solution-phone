-- ════════════════════════════════════════════════════════════════
-- SUPABASE STORAGE · Bucket 'media' pour photos/vidéos uploadées
-- ════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase SQL Editor.
-- Crée un bucket public où Sébastien peut uploader des photos/vidéos
-- depuis l'app, et qui sont ensuite utilisables comme URL publique
-- dans les templates de publication.
-- ════════════════════════════════════════════════════════════════

-- Créer le bucket 'media' (public pour que les URLs soient accessibles par Insta/FB)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  52428800,  -- 50 MB max par fichier
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = excluded.allowed_mime_types;

-- Politique : autoriser tout le monde à lire (URLs publiques pour Insta/FB)
drop policy if exists "Public read access for media" on storage.objects;
create policy "Public read access for media"
on storage.objects for select
using (bucket_id = 'media');

-- Politique : autoriser uploads anonymes (l'app utilise la clé anon)
drop policy if exists "Anyone can upload to media" on storage.objects;
create policy "Anyone can upload to media"
on storage.objects for insert
with check (bucket_id = 'media');

-- Politique : autoriser updates/deletes (pour remplacer/nettoyer)
drop policy if exists "Anyone can update media" on storage.objects;
create policy "Anyone can update media"
on storage.objects for update
using (bucket_id = 'media');

drop policy if exists "Anyone can delete media" on storage.objects;
create policy "Anyone can delete media"
on storage.objects for delete
using (bucket_id = 'media');

-- Vérification
select id, name, public, file_size_limit from storage.buckets where id = 'media';
