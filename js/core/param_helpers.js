function extractParams(sql) {
  if (typeof window.extractParamsFromSql === 'function') {
    return window.extractParamsFromSql(sql);
  }
  return [];
}

/**
 * Parametre tipini isim ve SQL bağlamına göre zeki olarak tespit eder.
 * @param {string} sql - SQL sorgusu
 * @param {string} paramName - Parametre adı (örn: :doktor_id, :t1)
 * @returns {'tarih' | 'sayı' | 'metin'}
 */
function detectParamType(sql, paramName) {
  const rawName = String(paramName || '').replace(/^:/, '').trim();
  const name = rawName.toUpperCase();
  if (!name) return 'metin';

  // 1. ÖNCELİK: Kesin ID / Kod / Sayı Belirteçleri (Tarih ASLA Olamaz)
  const isIdOrCode = /^(?:.*_)?(?:ID|NO|NUM|KOD|CODE|SIRA|ADET|MIKTAR|COUNT|SAYI|TUTAR|FIYAT|BEDEL|ORAN|YUZDE|YAS|DURUM|TIP|TIPI|TUR|TURU)$/.test(name) ||
                     /^(?:DOKTOR|BRANS|POLIKLINIK|HASTA|SERVIS|BOLUM|KURUM|KULLANICI|PERSONEL|KLINIK|ODANO|YATAK|SUBE|DEPO|AMBAR|PROTOKOL|TAKIP)(?:_ID|_NO|_KOD|_CODE)?$/.test(name);
  if (isIdOrCode) {
    return 'sayı';
  }

  // 2. ÖNCELİK: Kesin Tarih Parametreleri
  const isDateName = (
    name === 'T1' || name === 'T2' || name === 'T3' || name === 'T4' || name === 'T5' || name === 'T6' ||
    name === 'BASTARIH' || name === 'BITTARIH' || name === 'BAS_TARIH' || name === 'BIT_TARIH' ||
    name === 'BASTARIHI' || name === 'BITTARIHI' || name === 'BASLANGIC_TARIHI' || name === 'BITIS_TARIHI' ||
    name === 'BASLANGIC' || name === 'BITIS' || name === 'START_DATE' || name === 'END_DATE' ||
    name === 'DATE1' || name === 'DATE2' || name === 'ILK_TARIH' || name === 'SON_TARIH' ||
    name === 'RAPOR_TARIHI' || name === 'ISLEM_TARIHI' || name === 'KAYIT_TARIHI' || name === 'GIRIS_TARIHI' ||
    name === 'CIKIS_TARIHI' || name === 'DOGUM_TARIHI' || name === 'DONEM_BASI' || name === 'DONEM_SONU' ||
    name === 'SEVK_TARIHI' || name === 'FATURA_TARIHI' || name === 'TARIH' || name === 'TARIH1' || name === 'TARIH2'
  );

  if (isDateName) {
    return 'tarih';
  }

  // Eğer isminde TARIH, DATE, ZAMAN, TIME, DONEM geçiyor ve sonunda _ID, _NO, _KOD yoksa tarihtir
  if (/(?:TARIH|DATE|ZAMAN|TIME|DONEM)/.test(name) && !/(?:_ID|_NO|_KOD|_CODE)$/.test(name)) {
    return 'tarih';
  }

  // 3. ÖNCELİK: Metin / Açıklama Belirteçleri
  const isTextName = /^(?:.*_)?(?:AD|ADI|NAME|SOYAD|METIN|TEXT|ACIKLAMA|NOTE|DESC|SEARCH|ARA|FILTRE|BASLIK|TCKN|BARKOD|IP|STR|UNVAN|NOT)$/.test(name);
  if (isTextName) {
    return 'metin';
  }

  // 4. SQL İçindeki Doğrudan Bağlam Analizi (Sadece bu parametreye sarılmış fonksiyonlar)
  if (sql) {
    const escapedParam = rawName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const rxDateWrap = new RegExp(`(?:TO_DATE|TRUNC)\\s*\\(\\s*:${escapedParam}\\b`, 'i');
    if (rxDateWrap.test(sql)) {
      return 'tarih';
    }

    const rxDateCompare = new RegExp(`(?:TARIH|DATE|ZAMAN)\\s*(?:>=|<=|=|>|<|BETWEEN)\\s*:${escapedParam}\\b`, 'i');
    if (rxDateCompare.test(sql)) {
      return 'tarih';
    }
  }

  // 5. Varsayılan
  return 'metin';
}

window.extractParams = extractParams;
window.detectParamType = detectParamType;