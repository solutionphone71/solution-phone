-- ═══════════════════════════════════════════════════════════════════
-- FIX juillet 2026 — table factures_atelier bloquée par RLS
-- Symptôme : les factures de l'onglet « Atelier » (caisse rapide)
-- n'étaient JAMAIS enregistrées en base :
--   « new row violates row-level security policy for table factures_atelier »
-- La table a été créée avec RLS activé mais sans aucune policy.
--
-- À exécuter dans Supabase → SQL Editor (une seule fois).
-- ═══════════════════════════════════════════════════════════════════

alter table public.factures_atelier enable row level security;

drop policy if exists "factures_atelier_all" on public.factures_atelier;

create policy "factures_atelier_all"
  on public.factures_atelier
  for all
  using (true)
  with check (true);
