-- Şifre değişikliği sonrasında eski oturum belirteçlerini geçersiz kılmak için kullanılır.
alter table public.app_users add column if not exists password_changed_at timestamptz;
