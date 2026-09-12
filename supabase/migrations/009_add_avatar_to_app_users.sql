-- 009_add_avatar_to_app_users.sql
-- Kullanıcı profili için özel fotoğraf ve hazır emoji avatar desteği.

alter table if exists public.app_users 
  add column if not exists avatar text;
