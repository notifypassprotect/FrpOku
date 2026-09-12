-- Kimlik kurtarma ve e-posta tercihleri için eksik kullanıcı alanları.
-- Tekrar çalıştırılması güvenlidir.

alter table public.app_users add column if not exists recovery_keys jsonb not null default '[]'::jsonb;
alter table public.app_users add column if not exists previous_password_hashes jsonb not null default '[]'::jsonb;
alter table public.app_users add column if not exists email_chat_digest boolean not null default true;

update public.app_users set recovery_keys='[]'::jsonb where recovery_keys is null;
update public.app_users set previous_password_hashes='[]'::jsonb where previous_password_hashes is null;
update public.app_users set email_chat_digest=true where email_chat_digest is null;

comment on column public.app_users.recovery_keys is 'Tek kullanımlık acil erişim anahtarlarının SHA-256 özetleri';
comment on column public.app_users.previous_password_hashes is 'Son parola özetleri; parola tekrarını engellemek için kullanılır';
comment on column public.app_users.email_chat_digest is 'Okunmamış sohbet e-posta bildirim tercihi';
