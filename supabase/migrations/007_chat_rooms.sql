-- 007_chat_rooms.sql
-- Kurumsal Departman Odaları ve Kanal Üyelikleri

create table if not exists public.chat_rooms (
  id text primary key,
  name text not null,
  icon text default '📢',
  description text default '',
  is_all_users boolean not null default true,
  member_user_ids jsonb default '[]'::jsonb,
  created_by text references public.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Başlangıç varsayılan kurumsal odaları ekle (yoksa)
insert into public.chat_rooms (id, name, icon, description, is_all_users)
values 
  ('room_general', 'Genel Ekip Duyuruları', '📢', 'Tüm birimler ortak iletişim ve duyuru kanalı', true),
  ('room_ops', 'Operasyon & Saha', '⚙️', 'Raporlama ve saha operasyon koordinasyonu', true),
  ('room_finance', 'Muhasebe & Finans', '📊', 'Mali tablolar ve mutabakat kanalı', true)
on conflict (id) do nothing;
