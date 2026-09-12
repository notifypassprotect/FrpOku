-- 006_chat_messages.sql
-- Kurumsal Gerçek Zamanlı Sohbet ve Mesajlaşma Tablosu

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.app_users(id) on delete cascade,
  receiver_id uuid references public.app_users(id) on delete cascade,
  room_id text,
  text text not null default '',
  attachment jsonb default null,
  voice jsonb default null,
  reactions jsonb default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Hızlı sorgulamalar için indeksler
create index if not exists idx_chat_messages_sender on public.chat_messages (sender_id);
create index if not exists idx_chat_messages_receiver on public.chat_messages (receiver_id);
create index if not exists idx_chat_messages_room on public.chat_messages (room_id);
create index if not exists idx_chat_messages_created on public.chat_messages (created_at desc);
create index if not exists idx_chat_messages_unread on public.chat_messages (receiver_id, is_read) where is_read = false;
