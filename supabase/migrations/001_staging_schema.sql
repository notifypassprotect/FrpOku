-- FrpOku staging başlangıç şeması.
-- Tarayıcı erişimi kapalıdır; mevcut staging uygulaması bu tablolara yalnızca
-- Render sunucusundaki SUPABASE_SERVICE_ROLE_KEY üzerinden erişir.

create table if not exists public.app_users
(
    id text primary key,
    username text not null unique,
    password_hash text not null,
    email text unique,
    full_name text,
    phone text,
    department text,
    role text not null default 'user' check (role in ('user','admin')),
    is_active boolean not null default false,
    avatar text,
    created_at timestamptz not null default now(),
    last_login timestamptz
);

create unique index if not exists app_users_username_lower_uidx on public.app_users (lower(username));
create unique index if not exists app_users_email_lower_uidx on public.app_users (lower(email)) where email is not null;

create table if not exists public.reports
(
    id text primary key,
    name text not null,
    user_id text not null default 'public',
    file_size bigint not null default 0,
    category text not null default '',
    tags jsonb not null default '[]'::jsonb,
    user_note text not null default '',
    is_favorite boolean not null default false,
    is_pinned boolean not null default false,
    is_deleted boolean not null default false,
    is_public boolean not null default false,
    owner_name text not null default '',
    owner_username text not null default '',
    owner_department text not null default '',
    shared_at timestamptz,
    deleted_at timestamptz,
    sql_count integer not null default 0,
    memo_count integer not null default 0,
    dataset_count integer not null default 0,
    page_count integer not null default 1,
    has_script boolean not null default false,
    data jsonb not null default '{}'::jsonb,
    version bigint not null default 1,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists reports_user_id_idx on public.reports (user_id);
create index if not exists reports_public_idx on public.reports (is_public) where is_deleted = false;
create index if not exists reports_deleted_idx on public.reports (is_deleted, deleted_at);

create table if not exists public.categories
(
    id text primary key,
    name text not null,
    color text not null default '#3b82f6',
    icon text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.snippets
(
    id text primary key,
    title text not null,
    sql text not null default '',
    report_name text,
    category text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists public.user_settings
(
    id text primary key,
    theme text not null default 'light',
    preferences jsonb not null default '{}'::jsonb,
    recent_reports jsonb not null default '[]'::jsonb,
    custom_tags jsonb not null default '[]'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.app_users enable row level security;
alter table public.reports enable row level security;
alter table public.categories enable row level security;
alter table public.snippets enable row level security;
alter table public.user_settings enable row level security;

revoke all on public.app_users from anon, authenticated;
revoke all on public.reports from anon, authenticated;
revoke all on public.categories from anon, authenticated;
revoke all on public.snippets from anon, authenticated;
revoke all on public.user_settings from anon, authenticated;
