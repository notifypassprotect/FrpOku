-- Staging için hesap dondurma (is_frozen) desteği.
-- Bu sütun app_users tablosuna eklenir; varsayılan değeri false'tur.

alter table public.app_users add column if not exists is_frozen boolean not null default false;
