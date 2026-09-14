const DANGEROUS_BLOCKS = /<(script|style|iframe|object|embed|link|meta|base|form|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const DANGEROUS_TAGS = /<\/?(script|style|iframe|object|embed|link|meta|base|form|svg|math)\b[^>]*>/gi;
const ATTRIBUTE_PATTERN = /\s+([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;

function decodeEntities(value) {
  return String(value || '')
    .replace(/&#(\d+);?/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);?/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&colon;?/gi, ':')
    .replace(/&tab;?/gi, '\t')
    .replace(/&newline;?/gi, '\n');
}

function unsafeUrl(value) {
  const normalized = decodeEntities(value).replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  return /^(javascript|vbscript|data:text\/html):/.test(normalized);
}

function sanitizeTag(tag) {
  const closing = /^<\s*\//.test(tag);
  if (closing) return tag;
  const nameMatch = tag.match(/^<\s*([^\s/>]+)/);
  if (!nameMatch) return '';
  const tagName = nameMatch[1];
  const selfClosing = /\/\s*>$/.test(tag);
  const attributes = [];
  const source = tag.slice(nameMatch[0].length, tag.length - (selfClosing ? 2 : 1));

  for (const match of source.matchAll(ATTRIBUTE_PATTERN)) {
    const name = match[1];
    const lowerName = name.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (lowerName.startsWith('on') || ['srcdoc', 'xmlns', 'formaction'].includes(lowerName)) continue;
    if (value === undefined) {
      attributes.push(name);
      continue;
    }
    if (['href', 'src', 'xlink:href', 'action'].includes(lowerName) && unsafeUrl(value)) continue;
    if (lowerName === 'style' && /(expression\s*\(|url\s*\(|behavior\s*:|@import|-moz-binding)/i.test(decodeEntities(value))) continue;
    const escaped = String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    attributes.push(`${name}="${escaped}"`);
  }

  return `<${tagName}${attributes.length ? ' ' + attributes.join(' ') : ''}${selfClosing ? ' /' : ''}>`;
}

function sanitizeRichHtml(value, maxLength = 500000) {
  let html = String(value || '').slice(0, maxLength);
  let previous;
  do {
    previous = html;
    html = html.replace(DANGEROUS_BLOCKS, '');
  } while (html !== previous);
  html = html.replace(DANGEROUS_TAGS, '');
  return html.replace(/<[^>]*>/g, sanitizeTag);
}

module.exports = { sanitizeRichHtml, unsafeUrl };
