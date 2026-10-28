(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FunklixSocialProposal = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const TYPE = 'Social Media Posting';
  const platforms = Object.freeze(['LinkedIn', 'Facebook', 'X / Twitter', 'Instagram', 'TikTok']);
  const limits = Object.freeze({ title: 120, platform: 20, caption: 4000, preview: 1000, hashtags: 1000 });
  const keys = ['node_type', 'title', 'platform', 'caption', 'preview', 'hashtags'];
  function clean(value, max, multiline) {
    if (typeof value !== 'string') return null;
    const text = value.replace(/\r\n?/g, '\n').trim();
    return text.length <= max && !(multiline ? /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/ : /[\u0000-\u001f\u007f]/).test(text) ? text : null;
  }
  function validate(value, complete = false) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== keys.length || !keys.every(k => Object.prototype.hasOwnProperty.call(value, k)) || value.node_type !== TYPE) return null;
    const result = { node_type: TYPE };
    for (const field of keys.slice(1)) {
      result[field] = clean(value[field], limits[field], field !== 'title' && field !== 'platform');
      if (result[field] === null) return null;
    }
    if (!result.title || (result.platform && !platforms.includes(result.platform)) || (complete && (!result.platform || !result.caption))) return null;
    return result;
  }
  function extract(source) {
    if (typeof source !== 'string' || !source.trim() || source.length > 12000) return null;
    const lines = source.replace(/\r\n?/g, '\n').split('\n');
    const heading = (lines.find(line => line.trim()) || '').replace(/^\s*#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
    const found = platforms.filter(p => (p === 'X / Twitter' ? /(?:^|\W)(?:X|Twitter)(?:\W|$)/i : new RegExp('\\b' + p + '\\b', 'i')).test(heading));
    const result = { node_type: TYPE, title: heading.slice(0, limits.title) || TYPE, platform: found.length === 1 ? found[0] : '', caption: '', preview: '', hashtags: '' };
    let field = null;
    const seen = new Set();
    for (const line of lines.slice(1)) {
      const plain = line.replace(/^\s*#{1,6}\s*/, '').replace(/\*\*/g, '').trim();
      const label = /^(Caption|Tweet|Post(?: copy)?|Bildunterschrift|Beitrag|Text|CTA|Call to action|Handlungsaufforderung|Hashtags?)\s*:\s*(.*)$/i.exec(plain);
      const headingLabel = /^(Caption|Tweet|Post copy|Bildunterschrift|Beitrag|Text|CTA|Call to action|Handlungsaufforderung|Hashtags?)$/i.exec(plain);
      if (label || headingLabel) {
        const key = (label || headingLabel)[1].toLowerCase();
        field = /^hashtag/.test(key) ? 'hashtags' : /^(cta|call to action|handlungsaufforderung)$/.test(key) ? 'preview' : 'caption';
        if (seen.has(field)) return null; // Ambiguous labelled fields require Content/manual review.
        seen.add(field); result[field] = label ? label[2] : ''; continue;
      }
      if (/^\s*---+\s*$/.test(line)) continue;
      if (/^\s*#{1,6}\s/.test(line) || /^\s*\*\*[^*]+:\*\*/.test(line)) { field = null; continue; }
      if (field) result[field] += '\n' + line;
    }
    return validate(result);
  }
  function recommend(source) {
    const result = extract(source);
    return result && ['Instagram', 'X / Twitter'].includes(result.platform) ? TYPE : 'Content';
  }
  return Object.freeze({ TYPE, platforms, limits, validate, extract, recommend });
});
