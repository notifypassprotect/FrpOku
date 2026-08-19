/**
 * FrpOku - Akıllı Otomatik Etiketleme & Versiyonlama Modülü
 */

(function () {
  'use strict';

  const TAG_RULES = [
    { tag: 'Fatura', rx: /\b(FATURA|INVOICE|TAHSILAT|VEZNE|KASA|MAKBUZ|ODEME|BEYAN|HAKEDIS)\b/i },
    { tag: 'Randevu', rx: /\b(RANDEVU|APPOINTMENT|SLOT|GUN_SURE|ISTISNA|RANDEVULU|RANDEVUSUZ)\b/i },
    { tag: 'Hasta', rx: /\b(HASTA|PATIENT|KABUL|POLIKLINIK|PROTOKOL|TCKN|KIMLIK|MUSAHEDE)\b/i },
    { tag: 'Görüntüleme', rx: /\b(USG|ULTRASON|RADYOLOJI|RONTGEN|EMAR|MR|BT|TOMOGRAFI|GORUNTULEME|PET|MAMO)\b/i },
    { tag: 'Laboratuvar', rx: /\b(LAB|LABORATUVAR|TETKIK|TEST|SONUC|BIYOKIMYA|MIKROBIYOLOJI|PATOLOJI|KAN)\b/i },
    { tag: 'Stok', rx: /\b(STOK|ILAC|DEPO|MALZEME|HAREKET|TRANSFER|ECZANE|FARMA|DEMIRBAS|SARF)\b/i },
    { tag: 'Ameliyat', rx: /\b(AMELIYAT|OPERASYON|SEANS|ANESTEZI|CERRAHI|PATOLOJI|TRIAGE)\b/i },
    { tag: 'Analiz', rx: /\b(ISTATISTIK|RAPOR|OZET|GRAFIK|TREND|KARSILES|KARSILES_TIRMA|PERFORMANS)\b/i },
    { tag: 'Gösterge', rx: /\b(GÖSTERGE|GOSTERGE|SDS|ANALITIK|VERI_TOPLAMA|HEDEF|KPI|SAGLIK_NET)\b/i },
    { tag: 'Personel', rx: /\b(PERSONEL|DOKTOR|HEMSIRE|MAAS|MESAI|NOBET|KADRO|DOKTOR_ID)\b/i },
    { tag: 'Acil Servis', rx: /\b(ACIL|EMERGENCY|TRIYAJ|TRIAGE|AMBULANS|BEKLEME_SURESI)\b/i },
    { tag: 'Yoğun Bakım', rx: /\b(YOGUN_BAKIM|YOGUNBAKIM|ICU|VENTILATOR|YATAK)\b/i },
    { tag: 'Yatış / Sevk', rx: /\b(YATIS|TABURCU|SEVK|DEVIR|ODAK|YATAK_DOLULUK)\b/i }
  ];

  function generateAutoTags(parsedData, fileName) {
    const tags = new Set();
    const queriesText = Array.isArray(parsedData.queries) 
      ? parsedData.queries.map(q => (q.sql || '') + ' ' + (q.name || '')).join(' ') 
      : '';
    const textToScan = ((fileName || '') + ' ' + (parsedData.meta?.reportName || '') + ' ' + queriesText).toUpperCase();

    TAG_RULES.forEach(r => {
      if (r.rx.test(textToScan)) tags.add(r.tag);
    });

    const cleanFileName = (fileName || '').trim();
    const cleanReportName = (parsedData.meta?.reportName || '').trim();
    const isSypg = /SYPG/i.test(cleanFileName) || /SYPG/i.test(cleanReportName) || /\bSYPG/i.test(textToScan);
    const isIndicator = isSypg || /^(?:HSTN|\d+(?:\.\d+)+)/i.test(cleanFileName) || /^(?:HSTN|\d+(?:\.\d+)+)/i.test(cleanReportName);

    if (isSypg) tags.add('Gören');
    if (isIndicator) tags.add('Gösterge');
    if (/BARKOD|BRKD/i.test(textToScan)) tags.add('Barkod');

    return [...tags];
  }

  function bumpVersionFilename(filename, incCount = 1) {
    const count = parseInt(incCount, 10) || 1;
    const dotIdx = filename.lastIndexOf('.');
    const ext = dotIdx >= 0 ? filename.slice(dotIdx) : '';
    const baseName = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;

    const match = baseName.match(/^(.*?)([-_])(\d+)$/);
    if (match) {
      const prefix = match[1];
      const sep = match[2];
      const currentVer = parseInt(match[3], 10);
      const newVer = currentVer + count;
      return `${prefix}${sep}${newVer}${ext}`;
    } else {
      return `${baseName}-${count}${ext}`;
    }
  }

  window.FrpTags = {
    generateAutoTags,
    bumpVersionFilename
  };
})();
