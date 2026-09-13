-- Sohbet mesajlarını Render yeniden başlatmalarından bağımsız ve eksiksiz saklar.

alter table public.chat_messages
  add column if not exists group_id text,
  add column if not exists sender_name text,
  add column if not exists sender_username text,
  add column if not exists sender_avatar text,
  add column if not exists is_nudge boolean not null default false;

create index if not exists idx_chat_messages_group
  on public.chat_messages (group_id, created_at desc);

create index if not exists idx_chat_messages_direct
  on public.chat_messages (sender_id, receiver_id, created_at desc);
