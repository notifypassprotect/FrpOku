# FrpOku Kapsamlı İyileştirme ve Geliştirme Planı

Bu belge, FrpOku sistemi üzerinde tespit edilen 13 maddelik hata, performans, tasarım ve işlevsellik taleplerine ilişkin kök neden analizlerini ve adım adım uygulama planını içerir.

---

## 📌 Genel Bakış ve Mimari

```
                                  UYGULAMA MİMARİSİ
                                  
 [ 1. Havuz & Liste Düzeltmeleri ] ──► İskelet Tablo HTML Onarımı + Arka Plan Senkronizasyonu
 [ 2. SQL Doğrulama & Parametre ]  ──► Yanıltıcı Hata Kontrolü + Parametre Analitiği (Top 10)
 [ 3. Zaman Çizelgesi & Sayımlar ] ──► Gerçek Ay/Grup Sayımı + Storage Tab SQL Sorgu Sayısı
 [ 4. Zengin Not Düzenleyici ]     ──► Backend 500 Hatası Düzeltmesi + Blok Silme + Açık Kalma
 [ 5. Gösterge Paneli (Dashboard) ]──► Hızlı Açılış (Önbellek) + 4 Yeni Derinlemesine Analiz
 [ 6. Retro Win95 Arayüz Modu ]    ──► Arayüz Tercihi: 3D Kabartmalı, Klasik İş İstasyonu Stili
 [ 7. Denetim Günlüğü (Audit Log) ]──► GUID Çözümleme + Toplu İşlem Rapor İsimleri + Zengin Detay
 [ 8. Yeni Tema: Obsidian Gold ]   ──► Derin Obsidyen Siyahı ve Parlak Altın Vurgulu Lüks Tema
```

---

## 1. Ortak Rapor Havuz Görünümü & İskelet Yükleme Onarımı

### Mevcut Durum & Sorun
* "Ortak Rapor Havuzu" sekmesine tıklandığında veya ilk açılışta havuzda rapor yokken, tablonun en sol sütununda birbirine girmiş, daracık bir iskelet yükleyici görünmektedir.
* Bulut sunucusu (`refreshFromCloud`) yanıt verene kadar arayüz donuk kalmakta ve kullanıcı uzun süre beklemektedir.

### Kök Neden
* `js/list/renderers/table_renderer.js` içindeki `renderSkeletonTable` fonksiyonu bir `<div class="report-table-wrap">` bloğu üretmekte ve `list.js` bunu doğrudan `<tbody>` etiketine (`#tableBody`) enjekte etmektedir.
* HTML standardına göre `<tbody>` içine doğrudan `<div>` yerleştirilemez; tarayıcı div'i ilk sütuna sıkıştırarak bozuk bir görünüm oluşturur.
* `list.js` içerisindeki `await FrpStore.refreshFromCloud()` çağrısı tüm listeyi bloke ederek çalıştığı için Render uyanırken veya ağ yavaşken donma hissi yaratmaktadır.

### Yapılacak İşlemler
1. `table_renderer.js` içindeki `renderSkeletonTable` fonksiyonunu geçerli `<tr>` ve sütun sayısı kadar `<td>` üretecek şekilde güncellemek.
2. Havuz sekmesine geçildiğinde yerel önbellek verisini hemen çizmek; henüz rapor yoksa temiz bir boş durum (`"Ortak havuzda henüz paylaşılan bir rapor bulunmuyor"`) göstermek.
3. Bulut senkronizasyonunu arayüzü kilitlemeyen arka plan (non-blocking) moduna almak ve tamamlandığında tabloyu akıcı biçimde güncellemek.

---

## 2. SQL Doğrulama (Syntax Check) Yanıltıcı Hata Analizi (False-Positive)

### Mevcut Durum & Sorun
* SQL editöründe veya listelemede, sözdizimi geçerli ve çalışan bazı karmaşık SQL ifadeleri hata gibi kırmızıyla işaretlenebilmektedir (örneğin daha önce düzeltilen `COUNT(DISTINCT ...)` gibi).

### İncelenen ve Önlenen Kalıplar
* **CTE Yapıları (`WITH cte AS (...) SELECT ...`):** Başlangıçtaki WITH bloğunun parantezleri ve virgülleri parser tarafından eksik tablo veya askıda kalan sözcük gibi algılanabiliyordu.
* **Oracle Outer Join Operatörü (`(+)`):** `WHERE a.ID = b.ID(+)` gibi eski tip Oracle birleştirmelerinde parantez açma/kapatma sayacı bozulabiliyordu.
* **String Birleştirme Operatörü (`||`):** `AD || ' ' || SOYAD` ifadelerindeki çift dikey çizgi bazı tokenizer adımlarında tanımsız operatör uyarısı tetikleyebiliyordu.
* **Pencereli Fonksiyonlar (Window Functions):** `SUM(t.tutar) OVER(PARTITION BY t.yil ORDER BY t.tarih)` gibi analitik SQL fonksiyonlarında virgül kontrolü yanlış hata üretebiliyordu.

### Yapılacak İşlemler
* `js/core/highlight.js` ve `js/analytics/syntax_check.js` içerisindeki regex ve durum makinelerine yukarıdaki kalıpları tanıyan istisnalar eklemek ve false-positive oluşmasını kesin olarak engellemek.

---

## 3. Rapor İsimlerindeki Renklerin Anlamı (Renk & Durum Rehberi)

### Mevcut Durum & Sorun
* Rapor listesinde yeşil, mavi, kırmızı veya mor renkli başlıklar, rozetler ve etiketler yer almakta, ancak kullanıcının bu renklerin ne anlama geldiğini görebileceği bir kılavuz bulunmamaktadır.

### Yapılacak İşlemler
1. Rapor listesinin üst araç çubuğuna (arama kutusu veya görünüm butonlarının hemen yanına) şık bir **"ℹ️ Renk & Durum Rehberi"** butonu eklemek.
2. Tıklandığında açılan bilgilendirme popover/modal penceresiyle sistemin renk dilini netleştirmek:
   * 🔴 **Kırmızı:** SQL Güvenlik Riski (`DROP`, `TRUNCATE`, `ALTER` içeren raporlar) veya Hata Notu.
   * 🟢 **Yeşil:** Ortak Rapor Havuzunda Onaylı / Paylaşılan Raporlar.
   * 🔵 **Mavi:** Standart Rapor ve SQL Sorgu Sayısı Rozeti.
   * 🟣 **Mor / Turuncu:** Kullanıcı Kategorileri veya Not Eklenmiş Raporlar.

---

## 4. Zaman Çizelgesi (Timeline) Rapor Sayısı Düzeltmesi

### Mevcut Durum & Sorun
* Zaman çizelgesi moduna geçildiğinde ay gruplarının başlığında toplam rapor sayısı yerine sabit `(50 rapor)` yazmaktadır (örneğin Ekim 2026 başlığı altında 50 rapor yazıyor, oysa toplamda 1.780 rapor var).

### Kök Neden
* `js/list/list.js` içindeki sayfalama mekanizması (`visible = sorted.slice(...)`) sadece o sayfadaki 50 kaydı `renderTimeline` fonksiyonuna aktarmakta, fonksiyon da o 50 kaydın uzunluğunu başlığa basmaktadır.

### Yapılacak İşlemler
* `timeline_renderer.js` fonksiyonuna filtrelenmiş tam listeyi (`allFiles`) veya grup bazlı gerçek toplamları aktarmak.
* Ay başlığında gerçek toplamı gösterecek şekilde formatlamak:
  `Ekim 2026 (Bu sayfada: 50 · Toplam: 1.780 rapor)`.

---

## 5. Retro / Windows 95 Arayüz Modu (Tema Değil, Tam Arayüz Özelliği)

### Mevcut Durum & Talep
* Sistem şu an modern ve yuvarlatılmış (flat/card) bir tasarıma sahip.
* Ayarlar menüsünden açılıp kapatılabilen, sistemi 90'ların klasik iş istasyonuna (Windows 95 tarzı) dönüştüren özel bir arayüz modu talep edilmektedir.
* **Kritik:** Bu bir renk teması (theme) olmayıp, tüm butonların, listelerin, pencerelerin, inputların ve kaydırma çubuklarının fiziksel görünümünü değiştiren bağımsız bir sistem tercihidir.

### Yapılacak İşlemler
1. **Ayarlar -> Görünüm** sekmesine bağımsız bir **"Arayüz Çalışma Stili"** seçeneği eklemek:
   * *Modern Enterprise (Varsayılan)*
   * *Retro Klasik (Windows 95 İş İstasyonu)*
2. Seçim yapıldığında `<html>` etiketine `data-ui-mode="retro-win95"` atanması ve tercihin saklanması.
3. **Win95 Görsel Özellikleri (CSS):**
   * Tüm butonlara otantik 3D kabartmalı kenarlıklar (`border: 2px solid; border-color: #dfdfdf #404040 #404040 #dfdfdf;`), tıklandığında basılan ters kenarlık efekti.
   * Düz, köşesiz hatlar (`border-radius: 0 !important;`) ve klasik Windows sistem grisi (`#c0c0c0` / `#d4d0c8`).
   * Metin kutuları, tablolar ve seçim kutularına klasik içe gömülü (sunken/inset) kenarlıklar (`#808080 #dfdfdf #dfdfdf #808080`).
   * Dialog pencerelerine klasik lacivert (`#000080` gradient) başlık çubuğu, beyaz kalın yazı ve sağ üst köşede kare `[X]` kapatma butonu.
   * Klasik Windows 95 kare basamaklı kaydırma çubukları (scrollbars).

---

## 6. Depolama Tabındaki "8 SQL Sorgusu" Hatasının Giderilmesi

### Mevcut Durum & Sorun
* Ayarlar -> Depolama ekranında "1.780 Kayıtlı Rapor" görünmesine rağmen "SQL Sorgusu: 8" yazmaktadır.

### Kök Neden
* `js/store/store_main.js:1947` satırındaki `getStats()` fonksiyonu sadece `Array.isArray(f.queries) ? f.queries.length : 0` hesaplaması yapmaktadır.
* 1.780 rapor bellekte tutulurken SQL metinleri performans nedeniyle doğrudan `f.queries` içinde değil; özet alanlarda (`f.stats.sqlCount`, `f.sql_count`, `f.sqlCount`, `f.queryNames`) tutulur. `f.queries` dizisi sadece açık olan 8 raporda bulunduğu için sayı 8 olarak hesaplanmaktadır.

### Yapılacak İşlemler
* `getStats()` fonksiyonunu `f.stats?.sqlCount || f.sql_count || f.sqlCount || f.queryNames?.length || f.queries?.length || 0` kontrolüyle güncellemek ve 1.780 raporun tüm sorgularını doğru toplamla göstermek.

---

## 7. Denetim Günlüğü (Audit Log) Detaylarının Netleştirilmesi

### Mevcut Durum & Sorun
* Denetim Günlüğü tablosunda "Hedef / Rapor" sütununda sadece `1 Rapor`, `5 Rapor` veya `9a46b3bd-e780-474b-...` şeklinde ham GUID değerleri görünmektedir.
* "Detay" butonuna tıklandığında da raporun gerçek adı veya yapılan değişikliğin içeriği net anlaşılmamaktadır.

### Yapılacak İşlemler
1. **GUID ve ID Çözümleme:** Log tablosu çizilirken ve detay modalı açılırken, hedef alanındaki GUID veya ID sistemdeki rapor adı (`meta.reportName` / `name`) ile otomatik eşleştirilerek gerçek rapor adı gösterilecek.
2. **Toplu İşlemlerde İsim Listesi:** `5 Rapor` gibi toplu silme veya havuza ekleme işlemlerinde, işlem gören raporların isimleri log detayında liste olarak sunulacak.
3. **Zenginleştirilmiş Detay Penceresi:** Detay penceresine işlem türü, işlem yapılan alanlar (SQL düzenleme, not güncelleme vb.), kullanıcı rolü ve tek tıkla ilgili rapora gitme butonu eklenecek.

---

## 8. SQL Parametre Analitiği Düzeltmesi ve Top 10 Genişletmesi

### Mevcut Durum & Sorun
* Gösterge panelinde "SQL Parametre Kullanım Analitiği (Top 2)" olarak kalmakta ve doğru çalışmamaktadır. Kullanıcı bunun **Top 10** olmasını talep etmektedir.

### Kök Neden
* `dashboard_app.js:93` sadece `file.queries` dizisini taramaktadır. Oysa özet raporlarda sorgu metinleri olmadığında parametreler boş dönmektedir. Sistemde `param_usage.js` modülünde `file.paramNames` desteği bulunmasına rağmen dashboard bunu kullanmamaktadır.

### Yapılacak İşlemler
1. `dashboard_app.js` içerisine `param_usage.js` motorunu tam bağlamak (hem `file.queries` hem de `file.paramNames` taranacak).
2. Başlığı ve tabloyu **Top 10** (`SQL Parametre Kullanım Analitiği - Top 10`) olarak güncellemek.
3. Tabloda parametre adı, kullanım adedi, bağımlı rapor sayısı ve o parametreye tıklandığında rapor listesinde hızlı arama yapma bağlantısını sunmak.

---

## 9. Dashboard Performansı (Hızlı Açılış) ve Yeni Analitikler

### Hızlı Açılış Optimizasyonu
* 1.780 raporda tüm istatistiklerin tek bir döngüde senkron hesaplanması açılışı yavaşlatmaktadır.
* İlk açılışta önbellekteki temel KPI'lar (Toplam Rapor, SQL, Boyut) anında (50ms altında) ekrana basılacak; ağır grafik ve tablo analizleri arka planda `requestAnimationFrame` ile akıcı şekilde render edilecektir.

### Eklenecek Yeni Analitik Kartları
1. **Rapor Karmaşıklık Dağılımı:**
   * Statik Raporlar (0 SQL), Basit (1-3 SQL), Orta Düzey (4-8 SQL) ve İleri Düzey/Kompleks (9+ SQL) oran çubuğu.
2. **Departman & Kategori Bazlı Rapor Dağılımı:**
   * Hangi departmanın kaç rapor yüklediğini ve kategori yoğunluğunu gösteren dağılım.
3. **SQL Sorgu Tipleri Analizi:**
   * Sorgulardaki SELECT, JOIN, GROUP BY ve alt sorgu kullanım yoğunlukları.
4. **En Ağır ve Kapsamlı Raporlar (Top 5):**
   * Dosya boyutu ve sorgu karmaşıklığı en yüksek 5 kritik raporun listesi.

---

## 10. Zengin Not Düzenleyicide PDF & Resim Görüntüleme Hatası

### Kök Neden (Kesin Olarak Tespit Edildi)
* `server/routes/report_notes.js:183` satırında:
  ```js
  res.setHeader('Content-Disposition', `inline; filename="${displayName}"; filename*=UTF-8''${encodeURIComponent(displayName)}`);
  ```
  kodunda **`displayName` değişkeni tanımlanmamıştır (undefined)!**
* Kullanıcı bir PDF veya resmi önizlemek ya da düzenlemek istediğinde sunucu `ReferenceError: displayName is not defined` hatasıyla çökmekte ve **HTTP 500 Hatası** döndürmektedir. Bu nedenle hiçbir resim ve PDF görüntülenememekte ve düzenlenememektedir.

### Yapılacak İşlemler
1. `server/routes/report_notes.js` içindeki `displayName` hatasını `filename` ile düzelterek HTTP 500 çökmesini gidermek.
2. Resimlerin işaretleme aracıyla (`image_annotator.js`) açılmasını ve PDF önizleyicisinin sorunsuz çalışmasını doğrulamak.

---

## 11. Not Düzenleyicide Blok Kalıntıları ve İzlerin Silinememesi

### Mevcut Durum & Sorun
* Not içerisine eklenen Vurgu Kutusu (Callout), Bilgi Notu, Görev Listesi (Todo List) ve SQL Kod Blokları silinmek istendiğinde, metin silinse bile arkada boş renkli kutular ve div izleri kalmakta, tamamen temizlenememektedir.

### Kök Neden
* `contenteditable` editöründe kullanıcı metni sildiğinde tarayıcı taşıyıcı kart div'ini (`.note-callout`, `.note-todo-card`, `.note-sql-card`) korumaktadır ve bu blokları kaldırmak için bir buton bulunmamaktadır.

### Yapılacak İşlemler
1. Her blok kartının sağ üst köşesine hover durumunda beliren **"Bloğu Kaldır" (`✕`)** butonu eklemek.
2. Editörde Backspace tuşuna basıldığında eğer kartın içi boşalmışsa kapsayıcı bloğu tamamen DOM'dan kaldıran akıllı klavye dinleyicisi eklemek.

---

## 12. Not Kaydet / Sil İşleminden Sonra Pencerenin Kapanmaması

### Mevcut Durum & Sorun
* Kullanıcı "Notu Kaydet" veya "Notu Sil" dediğinde pencere anında kapanmakta, kullanıcı not üzerinde çalışmaya devam edememektedir.

### Kök Neden
* `js/list/rich_note_editor.js:1916` satırında işlem tamamlanınca doğrudan `close(true);` çağrılmaktadır.

### Yapılacak İşlemler
* `close(true);` otomatik çağrısını kaldırmak.
* Pencereyi açık tutarak alt barda ve durum alanında yeşil bir onay rozeti (`✓ Değişiklikler başarıyla kaydedildi` / `✓ Not temizlendi`) göstermek.
* Pencerenin sadece kullanıcı "Kapat" butonuna veya ESC tuşuna bastığında kapanmasını sağlamak.

---

## 13. Ekstra Yeni Tema: "Obsidian Gold" (Lüks Altın & Derin Obsidyen)

### Tasarım & Entegrasyon
* Koyu temaları seven kullanıcılar için özel olarak tasarlanmış, derin siyah kömür/obsidyen zemin (`#0a0d14`), şık altın/amber vurgular (`#f59e0b` / `#fbbf24`), yüksek kontrastlı modern tipografi ve zarif kenarlıklar.
* `themes.js` ve `themes.css` içerisine 14. tema olarak entegre edilecek; Liste, Detay, Gösterge Paneli ve Ayarlar sayfalarında eşzamanlı çalışacaktır.

---

## 🧪 Doğrulama ve Test Adımları

1. **Birim Testleri:** `node --test test/*.test.js` koşturularak mevcut 29+ testin yeşil kaldığı doğrulanacak.
2. **Yeni Testler:**
   * PDF/resim eki HTTP 200 testi (artık 500 vermediğini doğrulayan rota testi).
   * Storage tab SQL sorgusu sayısı hesaplama testi.
   * Zaman çizelgesi gerçek sayı hesaplama testi.
   * Blok kaldırma ve arayüz modu geçiş testleri.
3. **Canlı Doğrulama:** Render Staging ortamına commit & push yapılarak tüm akış test edilecek.
