# FrpOku staging deployment

## 1. Supabase

1. Boş bir staging Supabase projesi oluşturun.
2. SQL Editor içinde `supabase/migrations/001_staging_schema.sql` dosyasını çalıştırın.
3. Project URL ve service-role key değerlerini yalnızca Render secret alanlarında saklayın.
4. `ENABLE_BROWSER_SUPABASE=false` bırakın. Bu sürümde tarayıcı Supabase'e doğrudan bağlanmaz.

## 2. Render Blueprint

1. Render Dashboard içinde **New > Blueprint** seçin.
2. `notifypassprotect/FrpOku` reposunu ve `staging` dalını bağlayın.
3. Render, kökteki `render.yaml` dosyasını okuyarak `frpoku-staging` Web Service'ini hazırlar.
4. `sync: false` işaretli değerleri Dashboard üzerinden girin.

Gerekli staging değerleri:

- `APP_BASE_URL`: Render'ın oluşturduğu HTTPS adresi
- `STAGING_ACCESS_USER` / `STAGING_ACCESS_PASSWORD`: site geneli geçici koruma
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`: yalnızca staging projesi
- `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` / `BOOTSTRAP_ADMIN_EMAIL`

`SUPABASE_ANON_KEY` bu aşamada boş bırakılabilir. `MAIL_ENABLED=false` olarak kalır.

## 3. İlk doğrulama

- `/api/health` Render tarafından `200` dönmelidir.
- Ana sayfa kimlik bilgisi olmadan `401`, doğru staging bilgisiyle `200` dönmelidir.
- `/render.yaml`, `/server.js`, `/package.json`, `/supabase/` ve `/test/` yolları yayınlanmamalıdır.
- Bootstrap admin ile giriş yapılabilmelidir.
- Sahte JSON admin header'ı `403` dönmelidir.

## 4. Mail etkinleştirme

Google App Password hazır olduğunda Render Environment bölümünde:

- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `APP_BASE_URL`
- `MAIL_ENABLED=true`

değerlerini kaydedip servisi yeniden deploy edin. Admin kullanıcı yönetimi penceresindeki **E-posta Altyapısı** sekmesinden test maili gönderin.

Secret değerleri GitHub'a, dokümana, commit mesajına veya destek kayıtlarına eklenmez.
