-- Mesaj yanıtlarını/alıntılarını kalıcı olarak saklar.
alter table public.chat_messages
  add column if not exists reply_to jsonb default null;

