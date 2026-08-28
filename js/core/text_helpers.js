function countLines(text) {
  if (!text) return 0;
  return String(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').length;
}

/**
 * Türkçe duyarlı küçük harfe dönüştürücü
 */
function trLower(str) {
  if (!str) return '';
  return String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
}

/**
 * Türkçe duyarlı büyük harfe dönüştürücü
 */
function trUpper(str) {
  if (!str) return '';
  return String(str)
    .replace(/i/g, 'İ')
    .replace(/ı/g, 'I')
    .toLocaleUpperCase('tr-TR');
}

/**
 * Türkçe arama normalizasyonu (Hem tam hem esnek ASCII arama için)
 * @param {string} str - Aranacak veya kaynak metin
 * @param {boolean} fuzzy - Türkçe harfleri ASCII muadillerine eşle (ç->c, ğ->g, ı/i->i, ö->o, ş->s, ü->u)
 */
function trNormalize(str, fuzzy = false) {
  if (!str) return '';
  let s = String(str)
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLocaleLowerCase('tr-TR');
  if (fuzzy) {
    s = s
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
  }
  return s;
}

/**
 * Bozulmuş / Çift kodlanmış (Mojibake) Türkçe karakterleri otomatik onarır
 */
function fixTurkishMojibake(str) {
  if (!str || typeof str !== 'string') return str || '';
  
  // Yaygın UTF-8 / Windows-1254 / ISO-8859-9 karışımı bozulmalar
  return str
    .replace(/Ã§/g, 'ç')
    .replace(/Ã‡/g, 'Ç')
    .replace(/ÄŸ/g, 'ğ')
    .replace(/Äž/g, 'Ğ')
    .replace(/Ä±/g, 'ı')
    .replace(/Ä°/g, 'İ')
    .replace(/Ã¶/g, 'ö')
    .replace(/Ã–/g, 'Ö')
    .replace(/ÅŸ/g, 'ş')
    .replace(/Åž/g, 'Ş')
    .replace(/Ã¼/g, 'ü')
    .replace(/Ãœ/g, 'Ü')
    .replace(/â€™/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€/g, '"')
    .replace(/Ã¢/g, 'â')
    .replace(/Ã®/g, 'î')
    .replace(/Ã»/g, 'û');
}

/**
 * Tüm tarayıcı ve güvenlik bağlamlarında (HTTP/HTTPS/Iframe) çalışan pano kopyalayıcı
 * @param {string} text - Kopyalanacak metin
 * @returns {Promise<boolean>}
 */
async function copyTextToClipboard(text) {
  if (!text) return false;

  // 1. Standart Modern Clipboard API
  if (navigator && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      // Güvenlik izin hatası varsa fallback'e geç
    }
  }

  // 2. Güvenli Eski Usul execCommand Fallback
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    textArea.style.opacity = '0';
    textArea.setAttribute('readonly', '');
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Panoya kopyalama başarısız oldu:', err);
    return false;
  }
}

/**
 * RegExp metinlerini güvenli escape eder (ReDoS & RegExp Injection Koruması)
 */
function escapeRegex(str) {
  if (!str) return '';
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.countLines           = countLines;
window.trLower              = trLower;
window.trUpper              = trUpper;
window.trNormalize          = trNormalize;
window.fixTurkishMojibake   = fixTurkishMojibake;
window.copyTextToClipboard  = copyTextToClipboard;
window.escapeRegex          = escapeRegex;