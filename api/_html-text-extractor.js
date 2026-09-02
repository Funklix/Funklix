const MAX_TITLE_LENGTH = 300;
const MAX_TEXT_LENGTH = 50000;
const MAX_PARSED_NODES = 100000;
const MAX_SECTIONS = 60;
const MAX_METADATA = 20;
const MAX_ASSETS = 24;
const MAX_PROVIDER_CONTEXT = 16000;
const EXCLUDED = new Set(['title', 'script', 'style', 'noscript', 'template', 'form', 'input', 'button', 'select', 'textarea', 'iframe', 'frame', 'object', 'embed', 'canvas', 'svg']);
const BLOCKS = new Set(['address', 'article', 'blockquote', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'li', 'main', 'nav', 'p', 'section', 'td', 'th', 'tr', 'footer']);

function decodeEntities(text) {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return text.replace(/&(#(?:x[\da-f]+|\d+)|[a-z]+);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const hex = entity[1]?.toLowerCase() === 'x';
    const value = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
    return Number.isFinite(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : match;
  });
}

function attribute(raw, name) {
  const match = raw.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:(["'])((?:.(?!\\1))*.?)\\1|([^\\s>]+))`, 'i'));
  return decodeEntities(match?.[2] || match?.[3] || '').replace(/\s+/g, ' ').trim();
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

function stableBound(units, maxLength) {
  const kept = []; let size = 0;
  for (const unit of units) {
    const value = String(unit || '').replace(/\s+/g, ' ').trim();
    if (!value || kept.includes(value)) continue;
    const extra = value.length + (kept.length ? 1 : 0);
    if (size + extra > maxLength) break;
    kept.push(value); size += extra;
  }
  return { text: kept.join('\n'), truncated: kept.length < units.filter((unit) => String(unit || '').trim()).length };
}

function extractBrandProjection(html, options = {}) {
  const limits = {
    maxTextLength: options.maxTextLength ?? MAX_TEXT_LENGTH,
    maxTitleLength: options.maxTitleLength ?? MAX_TITLE_LENGTH,
    maxParsedNodes: options.maxParsedNodes ?? MAX_PARSED_NODES,
    maxSections: options.maxSections ?? MAX_SECTIONS,
    maxMetadata: options.maxMetadata ?? MAX_METADATA,
    maxAssets: options.maxAssets ?? MAX_ASSETS,
    maxProviderContext: options.maxProviderContext ?? MAX_PROVIDER_CONTEXT
  };
  const source = String(html || ''); const units = []; const titleParts = []; const metadata = []; const assets = [];
  const stack = []; let excludedDepth = 0; let inTitle = false; let index = 0; let nodes = 0; let buffer = '';
  const flush = () => { const value = decodeEntities(buffer).replace(/\s+/g, ' ').trim(); buffer = ''; if (value && units.length < limits.maxSections * 4) units.push(value); };
  while (index < source.length) {
    if (source.startsWith('<!--', index)) { const end = source.indexOf('-->', index + 4); index = end < 0 ? source.length : end + 3; continue; }
    if (source[index] !== '<') { const end = source.indexOf('<', index); const text = source.slice(index, end < 0 ? source.length : end); if (!excludedDepth) buffer += ` ${text}`; if (inTitle) titleParts.push(text); index = end < 0 ? source.length : end; continue; }
    const tag = readTag(source, index); index = tag.end; nodes += 1;
    if (nodes > limits.maxParsedNodes) { const error = new Error('The webpage is too complex to import safely.'); error.code = 'parse_limit'; throw error; }
    if (/^!|^\?/.test(tag.raw.trim())) continue;
    const closing = /^\s*\//.test(tag.raw); const name = tag.raw.match(/^\s*\/?\s*([a-zA-Z][\w:-]*)/)?.[1]?.toLowerCase(); if (!name) continue;
    if (closing) {
      if (BLOCKS.has(name) && !excludedDepth) flush();
      const position = stack.map((entry) => entry.name).lastIndexOf(name);
      if (position >= 0) stack.splice(position).forEach((entry) => { if (entry.excluded) excludedDepth -= 1; });
      if (name === 'title') inTitle = false; continue;
    }
    const hidden = /(?:^|\s)(?:hidden(?:\s|=|$)|aria-hidden\s*=\s*(["'])?true\1|style\s*=\s*(["'])[^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)[^"']*\2)/i.test(tag.raw);
    const noisy = /(?:cookie|consent|modal|popup|tracking|analytics)/i.test(`${attribute(tag.raw, 'id')} ${attribute(tag.raw, 'class')}`);
    const excluded = EXCLUDED.has(name) || hidden || noisy || excludedDepth > 0;
    if (BLOCKS.has(name) && !excludedDepth) flush();
    if (name === 'title') inTitle = true;
    if (name === 'meta' && metadata.length < limits.maxMetadata) { const key = attribute(tag.raw, 'name') || attribute(tag.raw, 'property'); const content = attribute(tag.raw, 'content'); if (key && content && /description|og:title|og:description|twitter:title|twitter:description/i.test(key)) metadata.push(`${key}: ${content}`); }
    if (name === 'link' && /(?:^|\s)(canonical|icon|apple-touch-icon)(?:\s|$)/i.test(attribute(tag.raw, 'rel')) && assets.length < limits.maxAssets) assets.push({ type: 'link', rel: attribute(tag.raw, 'rel'), url: attribute(tag.raw, 'href') });
    if (name === 'img' && assets.length < limits.maxAssets) { const src = attribute(tag.raw, 'src'); const alt = attribute(tag.raw, 'alt'); if (src && !/^data:/i.test(src) && (alt || /logo|brand/i.test(src))) assets.push({ type: 'image', url: src, alt }); }
    const selfClosing = /\/\s*$/.test(tag.raw) || ['br', 'hr', 'img', 'input', 'meta', 'link'].includes(name);
    if (!selfClosing) { stack.push({ name, excluded }); if (excluded) excludedDepth += 1; }
  }
  flush();
  const bounded = stableBound(units, limits.maxTextLength);
  if (!bounded.text) { const error = new Error('No readable webpage text was found.'); error.code = 'empty_content'; throw error; }
  const sections = bounded.text.split('\n').slice(0, limits.maxSections);
  const context = stableBound([...metadata, ...sections], limits.maxProviderContext);
  return { title: stableBound(titleParts, limits.maxTitleLength).text, text: sections.join('\n'), sections, metadata, assets, providerContext: context.text, truncated: bounded.truncated || sections.length < bounded.text.split('\n').length || context.truncated, parsedNodes: nodes };
}

function extractHtmlText(html, options) { const value = extractBrandProjection(html, options); return { title: value.title, text: value.text, truncated: value.truncated }; }

module.exports = { extractHtmlText, extractBrandProjection, stableBound, MAX_TITLE_LENGTH, MAX_TEXT_LENGTH, MAX_PARSED_NODES, MAX_SECTIONS, MAX_METADATA, MAX_ASSETS, MAX_PROVIDER_CONTEXT };
