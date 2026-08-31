# FrpOku e-posta bildirimleri

E-posta gönderimi varsayılan olarak kapalıdır. Google App Password ve gönderen adresi Render ortam değişkenlerine eklendikten sonra `MAIL_ENABLED=true` yapılarak etkinleştirilir.

## Olay matrisi

| Olay | Alıcı | Öneri | Durum |
|---|---|---|---|
| Kayıt başvurusu alındı | Kullanıcı | Gönder | Planlandı |
| Yeni kayıt onay bekliyor | Adminler | Gönder veya günlük özet | Planlandı |
| Hesap onaylandı | Kullanıcı | Gönder | Uygulandı |
| Hesap reddedildi | Kullanıcı | Gönder; isteğe bağlı gerekçe | Planlandı |
| Hesap donduruldu/açıldı | Kullanıcı | Gönder | Planlandı |
| Rol değiştirildi | Kullanıcı | Gönder | Planlandı |
| Kullanıcı parolasını değiştirdi | Kullanıcı | Güvenlik bildirimi gönder | Planlandı |
| Admin parola sıfırladı | Kullanıcı | Parolayı yazmadan güvenlik bildirimi gönder | Planlandı |
| E-posta adresi değiştirildi | Eski ve yeni adres | Her iki adrese güvenlik bildirimi gönder | Planlandı |
| Yeni cihazdan giriş | Kullanıcı | Opsiyonel | Daha sonra değerlendirilecek |
| Rapor eklendi/düzenlendi/silindi | Kullanıcı | Gönderme; gereksiz yoğunluk oluşturur | Gönderilmeyecek |
| Toplu dışa aktarma/paylaşım | İşlemi yapan kullanıcı | Opsiyonel güvenlik bildirimi | Daha sonra değerlendirilecek |

## Ortam değişkenleri

- `MAIL_ENABLED`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `APP_BASE_URL`

Secret değerleri GitHub'a veya `render.yaml` içine yazılmaz. Render Blueprint içindeki `sync: false` alanları ilk kurulumda Dashboard üzerinden girilir.

## Davranış

- E-posta gönderimi başarısız olursa kullanıcı onayı geri alınmaz.
- Başarı/başarısızlık audit loguna durum koduyla yazılır.
- SMTP hata mesajı API cevabında veya istemciye gösterilmez.
- Parola, App Password, service-role key veya oturum tokenı e-posta içeriğine eklenmez.
