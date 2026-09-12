-- 005_rich_notes_and_presence.sql
-- 1. Kullanıcıların anlık çevrimiçi / çevrimdışı ve son görülme (ör. "9d önce") takibi:
alter table public.app_users add column if not exists last_seen timestamptz default now();
alter table public.app_users add column if not exists is_online boolean not null default false;

-- 2. Raporlarda Word benzeri zengin not HTML'i ve ekler (PNG, JPG, PDF dokümanları):
alter table public.reports add column if not exists note_html text default '';
alter table public.reports add column if not exists note_attachments jsonb default '[]'::jsonb;

-- 3. Hızlı sorgulama için indeksler:
create index if not exists idx_app_users_last_seen on public.app_users (last_seen desc);
create index if not exists idx_app_users_is_online on public.app_users (is_online);
