(function (root, factory) {
  'use strict';
  const contract = factory();
  if (typeof module === 'object' && module.exports) module.exports = contract;
  if (root) root.FunklixApprovalMaterialV2 = contract;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSION = 'v2';
  const ROLE = 'Social Media Posting';
  const INCLUDED_FIELDS = Object.freeze(['role', 'platform', 'title', 'content', 'social.caption', 'social.cta', 'social.hashtags', 'images', 'variants', 'cta', 'audience', 'tone']);
  const EXCLUDED_FIELDS = Object.freeze(['status', 'approvedContentFingerprint', 'approvalMetadata', 'readiness', 'coordinates', 'dimensions', 'selection', 'layout', 'comments', 'postits', 'aiReview', 'planningSchedule', 'activity', 'updatedAt', 'createdAt', 'providerDeliveryState']);
  const FORMAT = /^v2-[0-9a-f]{64}$/;

  // Text is NFC, uses LF line endings, and loses outer (not paragraph-internal) whitespace.
  function scalar(value) { return value == null ? '' : String(value).replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').normalize('NFC').trim(); }
  function array(value, mapper = scalar) { return (Array.isArray(value) ? value : value == null || value === '' ? [] : [value]).map(mapper).filter(item => item !== ''); }
  function ordered(value) {
    if (Array.isArray(value)) return value.map(ordered);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).sort().reduce((out, key) => { if (value[key] !== undefined) out[key] = ordered(value[key]); return out; }, {});
  }
  function approvedObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return ordered(Object.keys(value).reduce((out, key) => {
      const item = value[key];
      if (item == null) out[key] = '';
      else if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean') out[key] = typeof item === 'string' ? scalar(item) : item;
      return out;
    }, {}));
  }
  function project(node) {
    const social = node?.social && typeof node.social === 'object' ? node.social : {};
    const role = scalar(node?.type || node?.role);
    if (role !== ROLE) throw new TypeError('Unsupported approval material role');
    return ordered({
      role: ROLE,
      platform: scalar(social.platform || node?.channel).toLowerCase(),
      title: scalar(node?.title),
      content: scalar(node?.content),
      social: { caption: scalar(social.caption), cta: scalar(social.cta), hashtags: array(social.hashtags) },
      images: array(node?.images, approvedObject), variants: array(node?.variants, approvedObject),
      cta: scalar(node?.cta), audience: scalar(node?.audience), tone: scalar(node?.tone)
    });
  }
  function serialize(node) { return JSON.stringify(project(node)); }
  function bytes(value) { return new TextEncoder().encode(value); }
  async function fingerprint(node) {
    if (!globalThis.crypto?.subtle) throw new Error('Web Crypto SHA-256 is unavailable');
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes(serialize(node)));
    return `v2-${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  function fingerprintSync(node) {
    if (typeof require !== 'function') throw new Error('Synchronous SHA-256 is server-only');
    return `v2-${require('crypto').createHash('sha256').update(serialize(node), 'utf8').digest('hex')}`;
  }
  function isFingerprint(value) { return typeof value === 'string' && FORMAT.test(value); }
  return Object.freeze({ VERSION, ROLE, INCLUDED_FIELDS, EXCLUDED_FIELDS, scalar, array, ordered, project, serialize, fingerprint, fingerprintSync, isFingerprint });
}));
