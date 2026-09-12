# FrpOku Güvenlik ve Mimari Değerlendirme Notları (Security Audit Notes)

Bu doküman, projenin erken aşamalarında gerçekleştirilen güvenlik ve mimari inceleme bulgularını, tespit edilen açıkları ve zaman içinde uygulanan 28 maddelik geliştirme planını referans amacıyla arşivlemektedir.

---

## Kritik Bulgular ve Gözlemler

### 1. Admin Yetkisi Taklidi ve Oturum Doğrulaması
- Eski sistemde imzasız Base64/düz JSON objeleri ile rol taklidi yapılabiliyordu.
- **Çözüm:** `lib/session_auth.js` ile HMAC-SHA256 imzalı JWT oturum yönetimi, salt+scrypt parola hashleme ve veritabanı kontrollü admin yetkilendirmesi getirildi.

### 2. Rapor API Yetkilendirmesi ve Sahiplik
- Eski sistemde `/api/store/load` kimlik doğrulamasızdı ve sahiplik ayrımı yoktu.
- **Çözüm:** `lib/report_access.js` ve `/api/reports/:id` ile katı yetki denetimi, kullanıcı sahipliği ve ortak havuz izolasyonu sağlandı.

### 3. Kullanıcı Hesaplarında IDOR Koruması
- Profil ve parola değişikliklerinde gövdedeki `userId` yerine doğrulanmış token kimliği (`req.authUser.id`) zorunlu kılındı.

### 4. Şifre Saklama Sistemi
- Saltsız SHA-256 yerine tuzlu `scrypt` kriptografik hash standardına geçildi.

### 5. Stored/DOM XSS Önlemleri & CSP
- `unsafe-inline` temizlendi; `textContent` ve güvenli DOM bağlayıcıları zorunlu kılındı.

### 6. Concurrency / Sürüm Çakışma Yönetimi
- Raporlarda `version` ve optimistic concurrency kontrolü eklendi.

### 7. SQL ve CSV Güvenliği
- CSV formula injection engellendi. ZIP path traversal koruması eklendi.

---

## 28 Maddelik Geliştirme Planı ve Yol Haritası

1. `requireAdmin` ve imzasız token kontrollerinin baştan yazılması.
2. Rapor API'lerine zorunlu auth middleware ve sahiplik filtresi eklenmesi.
3. Profil, e-posta ve parola endpointlerinde token sahibinin zorunlu kılınması.
4. Parola sisteminin `scrypt` standartlarına taşınması.
5. Anon anahtardan parola sorgularının engellenmesi.
6. `localStorage` rol verisine olan güvenin kaldırılması.
7. Event listener ve CSP uyumluluğu.
8. Append-only kurumsal audit log mimarisi.
9. Tekil rapor güncelleme kuyruğu ve versiyonlama.
10. Raporlarım sekmesinde doğru kullanıcı izolasyonu.
11. UUID tabanlı rapor kimliklendirme.
12. Çevrimdışı ve geçici ağ hatası koruması.
13. Çöp kutusu silme senkronizasyonu.
14. Tasarım editöründe DOM ve XML çift yönlü senkronizasyonu.
15. XML içine yeni SQL sorgusu ekleme motoru.
16. Diff hizalama ve satır haritalama motoru.
17. Havuzdan klonlanan raporların async yönetimi.
18. Supabase çağrılarında hata yakalama ve await zorunluluğu.
19. Üçlü karşılaştırma görsel hizalaması.
20. Express route mükerrerliklerinin giderilmesi.
21. Snippet anahtarlarının tekilleştirilmesi.
22. Kullanıcı ayarları izolasyonu (`user_id` bazlı scoped storage).
23. IndexedDB ve LocalStorage çöp kutusu senkronizasyonu.
24. CSV ve ZIP güvenlik doğrulamaları.
25. Büyük raporlar için Web Worker diff motoru.
26. Yükleme sırasında TfrxReport XML kök doğrulayıcısı.
27. IP bazlı temizlenen rate limiter mimarisi.
28. Ortak dosya boyutu formatlayıcıları.
