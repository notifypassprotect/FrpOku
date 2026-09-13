-- FrpOku şema bütünlüğü ve servis-köprüsü güvenlik sertleştirmesi.
-- Mevcut verileri silmez; tekrar çalıştırılabilir.

begin;

-- Eski kurulumlarda CREATE TABLE IF NOT EXISTS tarafından eklenmeyen alanlar.
alter table public.app_users add column if not exists is_frozen boolean not null default false;
alter table public.app_users add column if not exists password_changed_at timestamptz;
alter table public.app_users add column if not exists last_seen timestamptz default now();
alter table public.app_users add column if not exists is_online boolean not null default false;
alter table public.app_users add column if not exists recovery_keys jsonb not null default '[]'::jsonb;
alter table public.app_users add column if not exists previous_password_hashes jsonb not null default '[]'::jsonb;
alter table public.app_users add column if not exists email_chat_digest boolean not null default true;
alter table public.app_users add column if not exists avatar text;

alter table public.reports add column if not exists is_public boolean;
alter table public.reports add column if not exists owner_name text;
alter table public.reports add column if not exists owner_username text;
alter table public.reports add column if not exists owner_department text;
alter table public.reports add column if not exists shared_at timestamptz;
alter table public.reports add column if not exists note_html text;
alter table public.reports add column if not exists note_attachments jsonb;
alter table public.reports add column if not exists version bigint;

update public.reports
set is_public=case
  when lower(coalesce(data->>'is_public', data->>'isPublic', data->>'in_pool', data->>'inPool', 'false')) in ('true','1') then true
  else false
end
where is_public is null;
update public.reports set owner_name=coalesce(data->>'ownerName', data->>'owner_name', '') where owner_name is null;
update public.reports set owner_username=coalesce(data->>'ownerUsername', data->>'owner_username', '') where owner_username is null;
update public.reports set owner_department=coalesce(data->>'ownerDepartment', data->>'owner_department', '') where owner_department is null;
update public.reports set note_html=coalesce(data->>'noteHtml', data->>'note_html', '') where note_html is null;
update public.reports set note_attachments=coalesce(data->'attachments', data->'noteAttachments', data->'note_attachments', '[]'::jsonb) where note_attachments is null;
update public.reports set version=case when coalesce(data->>'version','') ~ '^[1-9][0-9]*$' then (data->>'version')::bigint else 1 end where version is null;

alter table public.reports alter column is_public set default false;
alter table public.reports alter column is_public set not null;
alter table public.reports alter column owner_name set default '';
alter table public.reports alter column owner_name set not null;
alter table public.reports alter column owner_username set default '';
alter table public.reports alter column owner_username set not null;
alter table public.reports alter column owner_department set default '';
alter table public.reports alter column owner_department set not null;
alter table public.reports alter column note_html set default '';
alter table public.reports alter column note_html set not null;
alter table public.reports alter column note_attachments set default '[]'::jsonb;
alter table public.reports alter column note_attachments set not null;
alter table public.reports alter column version set default 1;
alter table public.reports alter column version set not null;

alter table public.chat_messages add column if not exists group_id text;
alter table public.chat_messages add column if not exists sender_name text;
alter table public.chat_messages add column if not exists sender_username text;
alter table public.chat_messages add column if not exists sender_avatar text;
alter table public.chat_messages add column if not exists is_nudge boolean not null default false;

-- Yeni kayıtların gönderen ve hedef bütünlüğünü koru. NOT VALID mevcut eski
-- satırları engellemez; yeni ve güncellenen satırlarda kuralı hemen uygular.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='chat_messages_sender_required'
      and conrelid='public.chat_messages'::regclass
  ) then
    alter table public.chat_messages add constraint chat_messages_sender_required check (sender_id is not null) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='chat_messages_exactly_one_target'
      and conrelid='public.chat_messages'::regclass
  ) then
    alter table public.chat_messages add constraint chat_messages_exactly_one_target check (num_nonnulls(receiver_id, room_id, group_id)=1) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='chat_messages_text_length'
      and conrelid='public.chat_messages'::regclass
  ) then
    alter table public.chat_messages add constraint chat_messages_text_length check (char_length(text)<=1000) not valid;
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname='user_settings_user_fk'
      and conrelid='public.user_settings'::regclass
  ) then
    alter table public.user_settings add constraint user_settings_user_fk foreign key (id) references public.app_users(id) on delete cascade not valid;
  end if;
end $$;

-- Uygulamanın gerçek sorgu desenlerine uygun bileşik indeksler.
create index if not exists reports_user_active_updated_idx on public.reports (user_id, is_deleted, updated_at desc);
create index if not exists reports_public_active_updated_idx on public.reports (updated_at desc) where is_public=true and is_deleted=false;
create index if not exists chat_messages_receiver_sender_created_idx on public.chat_messages (receiver_id, sender_id, created_at desc);
create index if not exists chat_messages_room_created_idx on public.chat_messages (room_id, created_at desc) where room_id is not null;
create index if not exists chat_messages_group_created_idx on public.chat_messages (group_id, created_at desc) where group_id is not null;
create index if not exists app_users_presence_idx on public.app_users (is_online, last_seen desc);

-- Tarayıcı Supabase erişimi kapalıdır; veritabanına yalnızca Render servis-role
-- köprüsü erişir. Sonradan eklenen tabloları da aynı güvenlik modeline al.
alter table public.chat_messages enable row level security;
alter table public.chat_rooms enable row level security;
revoke all on public.chat_messages from anon, authenticated;
revoke all on public.chat_rooms from anon, authenticated;
grant all on public.chat_messages to service_role;
grant all on public.chat_rooms to service_role;

commit;
