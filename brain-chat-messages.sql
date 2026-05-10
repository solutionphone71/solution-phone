-- ════════════════════════════════════════════════════════════════
-- BRAIN CHAT MESSAGES · Historique conversation Sébastien ↔ Zahira
-- ════════════════════════════════════════════════════════════════
-- À exécuter dans Supabase SQL Editor.
-- Stocke chaque message du chat principal pour permettre l'historique
-- groupé par date.
-- ════════════════════════════════════════════════════════════════

create table if not exists brain_chat_messages (
  id uuid primary key default gen_random_uuid(),
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  metadata jsonb default '{}'::jsonb,
  cost_eur numeric(10,4) default 0,
  tokens_in int default 0,
  tokens_out int default 0,
  created_at timestamptz default now()
);

-- Index pour récupérer rapidement par date desc
create index if not exists brain_chat_messages_created_at_idx
  on brain_chat_messages(created_at desc);

-- RLS désactivée (cohérent avec les autres tables agent_*)
alter table brain_chat_messages disable row level security;

-- Vérification
select count(*) as total_messages from brain_chat_messages;
