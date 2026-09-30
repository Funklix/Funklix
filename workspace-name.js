(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FunklixWorkspaceName = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function () {
  'use strict';
  const MAX_LENGTH = 160;
  const CONTROL = /[\u0000-\u001f\u007f-\u009f]/u;
  const INVISIBLE = /[\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff\ufff9-\ufffb]/gu;
  function validateWorkspaceName(value) {
    if (typeof value !== 'string' || CONTROL.test(value)) return { ok: false, code: 'INVALID_WORKSPACE_NAME', reason: 'empty' };
    const name = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
    if (!name || !name.replace(INVISIBLE, '').trim() || !/[\p{L}\p{N}\p{Emoji_Presentation}]/u.test(name)) return { ok: false, code: 'INVALID_WORKSPACE_NAME', reason: 'empty' };
    if (Array.from(name).length > MAX_LENGTH) return { ok: false, code: 'INVALID_WORKSPACE_NAME', reason: 'too_long' };
    return { ok: true, name };
  }
  return Object.freeze({ MAX_LENGTH, validateWorkspaceName });
}));
