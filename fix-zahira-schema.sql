-- ════════════════════════════════════════════════════════════════
-- FIX SCHÉMA ZAHIRA · ajoute les colonnes manquantes
-- ════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase SQL Editor.
-- Toutes les colonnes utilisent IF NOT EXISTS = safe, ne casse rien.
-- ════════════════════════════════════════════════════════════════

-- ─── agent_runs : colonnes pour le tracking multi-agent ───
alter table agent_runs
  add column if not exists decisions_count int default 0,
  add column if not exists cost_eur        numeric(10,4) default 0,
  add column if not exists tokens_in       int default 0,
  add column if not exists tokens_out      int default 0;

-- ─── agent_decisions : colonne agent_name pour identifier qui a proposé ───
alter table agent_decisions
  add column if not exists agent_name text;

-- ─── Vérification : liste les colonnes des deux tables ───
select 'agent_runs' as t, column_name, data_type
from information_schema.columns
where table_name = 'agent_runs'
order by ordinal_position;

select 'agent_decisions' as t, column_name, data_type
from information_schema.columns
where table_name = 'agent_decisions'
order by ordinal_position;
