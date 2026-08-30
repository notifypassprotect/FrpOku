-- Existing staging databases için kalıcı denetim günlüğü.
-- Uygulama bu tabloya yalnızca Render'daki service-role anahtarıyla erişir.

create table if not exists public.audit_logs
(
    id text primary key,
    occurred_at timestamptz not null default now(),
    user_id text not null,
    username text not null default '',
    full_name text not null default '',
    role text not null default 'user',
    action text not null,
    target text not null default '',
    details text not null default '',
    ip text not null default ''
);

create index if not exists audit_logs_occurred_at_idx on public.audit_logs (occurred_at desc);
create index if not exists audit_logs_user_id_idx on public.audit_logs (user_id);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;
revoke all on public.audit_logs from anon, authenticated;
