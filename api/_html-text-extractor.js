const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 50000;
const EXCLUDED = new Set(['title', 'script', 'style', 'noscript', 'template', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'frame', 'object', 'embed', 'canvas', 'svg', 'nav', 'footer', 'aside']);
const BLOCKS = new Set(['address', 'article', 'blockquote', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'p', 'section', 'td', 'th', 'tr']);

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
  });
}

function readTag(html, start) {
  let quote = '';
  for (let i = start + 1; i < html.length; i += 1) {
    const char = html[i];
    if (quote) { if (char === quote) quote = ''; }
    else if (char === '"' || char === "'") quote = char;
    else if (char === '>') return { raw: html.slice(start + 1, i), end: i + 1 };
  }
  return { raw: html.slice(start + 1), end: html.length };
}

function normalizeLines(parts) {
  return parts.join('').replace(/\r/g, '').split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

function extractHtmlText(html, { maxTextLength = MAX_TEXT_LENGTH, maxTitleLength = MAX_TITLE_LENGTH } = {}) {
  const source = String(html || '');
  const parts = [];
  const titleParts = [];
  const stack = [];
  let excludedDepth = 0;
  let inTitle = false;
  let index = 0;
  while (index < source.length) {
    if (source.startsWith('<!--', index)) { const end = source.indexOf('-->', index + 4); index = end < 0 ? source.length : end + 3; continue; }
    if (source[index] !== '<') {
      const end = source.indexOf('<', index);
      const text = decodeEntities(source.slice(index, end < 0 ? source.length : end));
      if (!excludedDepth) parts.push(text);
      if (inTitle) titleParts.push(text);
      index = end < 0 ? source.length : end;
      continue;
    }
    const tag = readTag(source, index); index = tag.end;
    if (/^!|^\?/.test(tag.raw.trim())) continue;
    const closing = /^\s*\//.test(tag.raw);
    const name = tag.raw.match(/^\s*\/?\s*([a-zA-Z][\w:-]*)/)?.[1]?.toLowerCase();
    if (!name) continue;
    if (closing) {
      const position = stack.map((entry) => entry.name).lastIndexOf(name);
      if (position >= 0) {
        const removed = stack.splice(position);
        removed.forEach((entry) => { if (entry.excluded) excludedDepth -= 1; });
      }
      if (name === 'title') inTitle = false;
      if (!excludedDepth && BLOCKS.has(name)) parts.push('\n');
      continue;
    }
    const attrs = tag.raw.slice(tag.raw.indexOf(name) + name.length);
    const hidden = /(?:^|\s)(?:hidden(?:\s|=|$)|aria-hidden\s*=\s*(["'])?true\1|style\s*=\s*(["'])[^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*\2)/i.test(attrs);
    const excluded = EXCLUDED.has(name) || hidden || excludedDepth > 0;
    const selfClosing = /\/\s*$/.test(tag.raw) || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(name);
    if (!excludedDepth && BLOCKS.has(name)) parts.push('\n');
    if (name === 'title') inTitle = true;
    if (!selfClosing) { stack.push({ name, excluded }); if (excluded) excludedDepth += 1; }
  }
  const fullText = normalizeLines(parts);
  if (!fullText) { const error = new Error('No readable webpage text was found.'); error.code = 'empty_content'; throw error; }
  const truncated = fullText.length > maxTextLength;
  return {
    title: normalizeLines(titleParts).slice(0, maxTitleLength).trim(),
    text: truncated ? fullText.slice(0, maxTextLength).trimEnd() : fullText,
    truncated
  };
}

module.exports = { extractHtmlText, MAX_TITLE_LENGTH, MAX_TEXT_LENGTH };
