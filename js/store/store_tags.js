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

  /**
   * Bir raporun gerçek bir barkod raporu olup olmadığını kesin olarak tespit eder.
   * SQL sorguları içerisindeki kolon adları (TETKIK_BARKOD vb.) KESİNLİKLE dikkate alınmaz.
   * Şartlar:
   * 1. Dosya adı veya rapor başlığında 'BARKOD', 'BARCODE' veya 'BRKD' geçmeli.
   * 2. Rapor sayfalarının isimlerinde (büyük, küçük, baş harfi büyük) 'argox', 'zebra', 'beiyang', 'godex', 'barkod' geçmeli.
   * 3. Rapor içeriğinde (MasterData, Memo, XML) 'A20,22,423,231,1,1' gibi barkod yazıcı dili (PPLA/PPLB/EPL/ZPL/TSPL) komutları olmalı.
   * 4. Raporda TfrxBarCodeView gibi FastReport barkod bileşeni bulunmalı.
   */
  function isBarcodeReport(parsedData, fileName) {
    if (!parsedData && !fileName) return false;

    const fn = String(fileName || '').trim();
    const rn = String(parsedData?.meta?.reportName || parsedData?.name || '').trim();

    // 1. Kural: Dosya adı veya rapor başlığı kontrolü
    if (/\b(?:BARKOD|BARCODE|BRKD)\b/i.test(fn) || /[-_.]barkod[-_.]/i.test(fn) || /barkod/i.test(fn) || /barkod/i.test(rn) || /barcode/i.test(rn)) {
      return true;
    }

    // 2. Kural: Rapor sayfalarının (TfrxReportPage vb.) isimlerinde argox, zebra, beiyang, godex, barkod
    const pageNames = [];
    if (Array.isArray(parsedData?.pages)) {
      parsedData.pages.forEach(p => {
        if (p.name) pageNames.push(p.name);
        if (p.title) pageNames.push(p.title);
        if (p.pageName) pageNames.push(p.pageName);
      });
    }
    if (Array.isArray(parsedData?.dialogPages)) {
      parsedData.dialogPages.forEach(p => {
        if (p.name) pageNames.push(p.name);
      });
    }
    const pagesText = pageNames.join(' ');
    if (/\b(argox|zebra|beiyang|godex|barkod|barcode)\b/i.test(pagesText)) {
      return true;
    }

    // 3. Kural: MasterData / Memo / XML içerisinde barkod yazıcı dili komutları
    const rawXml = typeof parsedData?.rawXml === 'string' ? parsedData.rawXml : '';
    const memos = Array.isArray(parsedData?.memos) ? parsedData.memos.map(m => typeof m === 'string' ? m : (m.text || '')).join('\n') : '';
    const contentToScan = rawXml + '\n' + memos;

    if (contentToScan.length > 0) {
      // EPL/PPLB: A<x>,<y>,<rotation>,<font>,<h_mul>,<v_mul>,<sub_type>,... (Örn: A20,22,423,231,1,1)
      if (/\bA\d+,\s*\d+,\s*\d+,\s*\d+/i.test(contentToScan) || /\bB\d+,\s*\d+,\s*\d+,\s*\d+/i.test(contentToScan)) {
        return true;
      }
      // Zebra ZPL: ^XA ... ^XZ veya ^FO\d+,\d+\^B
      if (/\^XA[\s\S]*?\^XZ/i.test(contentToScan) || /\^FO\d+,\s*\d+\^B/i.test(contentToScan) || /\^BY\d+/i.test(contentToScan)) {
        return true;
      }
      // TSPL / Godex / Beiyang komutları
      if (/\b(?:BARCODE|BAR|CODE128|EAN13)\s+\d+,\s*\d+/i.test(contentToScan)) {
        return true;
      }
      // XML içinde sayfa adı tanımları: <TfrxReportPage Name="Zebra"...> veya <TfrxReportPage Name="Argox"...>
      if (/<TfrxReportPage[^>]*\bName=["']?[^"'>]*(argox|zebra|beiyang|godex|barkod)[^"'>]*["']?/i.test(rawXml)) {
        return true;
      }
      // 4. Kural: FastReport yerel barkod bileşeni
      if (/<TfrxBarCodeView\b/i.test(rawXml) || /\bTfrxBarCodeView\b/i.test(rawXml)) {
        return true;
      }
    }

    // Bileşen ağacı (tree) içinde TfrxBarCodeView var mı?
    if (Array.isArray(parsedData?.tree)) {
      const hasBarcodeComp = (nodes) => {
        if (!Array.isArray(nodes)) return false;
        return nodes.some(n => {
          if (n?.type === 'TfrxBarCodeView' || /barcode/i.test(n?.type || '')) return true;
          if (Array.isArray(n?.children) && hasBarcodeComp(n.children)) return true;
          return false;
        });
      };
      if (hasBarcodeComp(parsedData.tree)) return true;
    }

    return false;
  }

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

    if (isSypg) tags.add('SYPG');
    if (isIndicator) tags.add('Gösterge');
    if (isBarcodeReport(parsedData, fileName)) tags.add('Barkod');

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
    isBarcodeReport,
    bumpVersionFilename,
    TAG_RULES
  };
})();
