(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BrandWriteContract = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const CONTRACT = 'canonical-brand-write/v1';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const OPERATIONS = ['profile_edit', 'advanced_edit', 'accept_dna', 'accept_avatar', 'domain_accept', 'domain_fill', 'initialize'];
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const clone = v => JSON.parse(JSON.stringify(v));
  function fail(code = 'INVALID_WRITE_CONTRACT') { const e = new Error(code); e.code = code; throw e; }
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (object(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
    return JSON.stringify(v);
  }
  const equal = (a, b) => stable(a) === stable(b);
  const empty = v => v === null || typeof v === 'string' && !v.trim() || Array.isArray(v) && !v.length || object(v) && !Object.keys(v).length;
  function inspect(value, depth = 0) {
    if (depth > 32 || value === undefined || typeof value === 'number' && !Number.isFinite(value)) fail();
    if (value && typeof value === 'object') for (const k of Object.keys(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(k)) fail();
      inspect(value[k], depth + 1);
    }
  }
  function parts(path) {
    if (typeof path !== 'string' || !path.startsWith('/') || path.length > 2048 || /~(?![01])/u.test(path)) fail();
    const p = path.slice(1).split('/').map(k => k.replace(/~1/g, '/').replace(/~0/g, '~'));
    if (p.length > 32 || p.some(k => !k || ['__proto__', 'constructor', 'prototype'].includes(k))) fail();
    if (!(p.length === 1 && p[0] === 'name') && !(p.length > 1 && p[0] === 'brand_core' && p[1] !== '_creation')) fail();
    return p;
  }
  const escape = k => k.replace(/~/g, '~0').replace(/\//g, '~1');
  function normalize(input) {
    if (!object(input) || input.contract !== CONTRACT) fail('WRITE_CONTRACT_REQUIRED');
    if (Object.keys(input).some(k => !['contract','workspace_id','expected_revision','mutation_id','operation','changes','source'].includes(k))) fail();
    if (input.workspace_id !== null && !UUID.test(input.workspace_id || '') || !UUID.test(input.mutation_id || '')
      || typeof input.expected_revision !== 'string' || !/^[1-9][0-9]*$/.test(input.expected_revision)
      || BigInt(input.expected_revision) >= BigInt(Number.MAX_SAFE_INTEGER) || !OPERATIONS.includes(input.operation)
      || !Array.isArray(input.changes) || input.changes.length > 256) fail();
    if (input.operation === 'initialize' ? !object(input.source) || !UUID.test(input.source.board_id || '') || !object(input.source.snapshot) || Object.keys(input.source).some(k => !['board_id','snapshot'].includes(k)) : Object.hasOwn(input, 'source')) fail();
    const seen = [];
    for (const c of input.changes) {
      if (!object(c) || Object.keys(c).some(k => !['path','action','expected','value'].includes(k))) fail();
      parts(c.path);
      if (!['add','replace','clear','remove','fill_empty'].includes(c.action) || !object(c.expected)
        || typeof c.expected.exists !== 'boolean' || Object.keys(c.expected).some(k => !['exists','value'].includes(k))
        || c.expected.exists !== Object.hasOwn(c.expected, 'value') || (c.action !== 'remove') !== Object.hasOwn(c, 'value')) fail();
      if (seen.some(p => p === c.path || p.startsWith(c.path + '/') || c.path.startsWith(p + '/'))) fail();
      seen.push(c.path); inspect(c);
    }
    inspect(input);
    if ((typeof Buffer !== 'undefined' ? Buffer.byteLength(JSON.stringify(input)) : new TextEncoder().encode(JSON.stringify(input)).length) > 1024 * 1024) fail('WRITE_TOO_LARGE');
    return clone(input);
  }
  // Omitted keys never become removals. Arrays remain exact atomic values.
  function diff(before, draft, prefix = '', changes = []) {
    for (const key of Object.keys(draft)) {
      if (!prefix && !['name','brand_core'].includes(key) || prefix === '/brand_core' && key === '_creation') continue;
      const path = prefix + '/' + escape(key), exists = Object.hasOwn(before, key), old = before[key], value = draft[key];
      if (exists && equal(old, value)) continue;
      if (object(value) && object(old)) diff(old, value, path, changes);
      else changes.push({ path, action: !exists ? 'add' : empty(value) ? 'clear' : 'replace', expected: exists ? { exists: true, value: clone(old) } : { exists: false }, value: clone(value) });
    }
    return changes;
  }
  function command(brand, draft, workspaceId, operation = 'profile_edit', mutationId) {
    return normalize({ contract: CONTRACT, workspace_id: workspaceId, expected_revision: String(brand.revision),
      mutation_id: mutationId || globalThis.crypto.randomUUID(), operation,
      changes: diff({ name: brand.name, brand_core: brand.brand_core }, draft) });
  }
  function apply(brand, command) {
    const result = clone({ name: brand.name, brand_core: brand.brand_core });
    for (const c of normalize(command).changes) {
      const p = parts(c.path), k = p.pop(); let parent = result;
      for (const part of p) { if (!object(parent[part])) fail('PATH_TYPE_MISMATCH'); parent = parent[part]; }
      const exists = Object.hasOwn(parent, k);
      if (exists !== c.expected.exists || exists && !equal(parent[k], c.expected.value)) fail('STALE_FIELD');
      if (c.action === 'add' && exists || c.action === 'fill_empty' && exists && !empty(parent[k]) || ['replace','clear','remove'].includes(c.action) && !exists) fail();
      if (c.action === 'remove') delete parent[k]; else parent[k] = clone(c.value);
    }
    return result;
  }
  function destructive(c) {
    if (['clear','remove'].includes(c.action)) return true;
    if (!c.expected.exists || equal(c.expected.value, c.value) || empty(c.expected.value)) return false;
    if (Array.isArray(c.expected.value) && Array.isArray(c.value) && c.value.length >= c.expected.value.length && c.expected.value.every((v,i) => equal(v,c.value[i]))) return false;
    return empty(c.value) || typeof c.expected.value !== typeof c.value || Array.isArray(c.value)
      || object(c.expected.value) || /(?:approved|status|type|image|url|asset|logo)/i.test(c.path);
  }
  // The pending holder belongs to one captured account/Brand/Workspace session.
  async function submit({ fetchImpl, brandId, command, pending, current = () => true, confirmReview = globalThis.confirm?.bind(globalThis) }) {
    const signature = stable(command);
    if (pending?.command && stable({ ...pending.command, mutation_id: command.mutation_id }) === signature) command = pending.command;
    else if (pending) { pending.command = command; pending.token = null; }
    let token = pending?.token;
    if (!token && command.changes.some(destructive)) {
      const response = await fetchImpl(`/api/brands/${brandId}/write-preview`, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(command) });
      if (!current()) throw new Error('CONTEXT_CHANGED');
      const preview = await response.json();
      if (!response.ok) return { response, payload: preview };
      const details = preview.changes.map(c => c.path + '\n' + JSON.stringify(c.expected) + '\n→ ' + (c.action === 'remove' ? '(remove)' : JSON.stringify(c.value))).join('\n\n');
      if (!confirmReview || !await confirmReview('Review these Brand changes:\n\n' + details)) throw new Error('REVIEW_CANCELLED');
      if (!current()) throw new Error('CONTEXT_CHANGED');
      token = preview.review_token; if (pending) pending.token = token;
    }
    if (!current()) throw new Error('CONTEXT_CHANGED');
    const response = await fetchImpl(`/api/brands/${brandId}`, { method: 'PUT', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(token ? { 'X-Brand-Review': token } : {}) }, body: JSON.stringify(command) });
    const payload = await response.json().catch(() => null);
    if (!response.ok && payload?.code === 'INVALID_REVIEW' && pending) pending.token = null;
    if (response.ok && pending) { pending.command = null; pending.token = null; }
    return { response, payload };
  }
  async function submitLogo({fetchImpl,brandId,input,current=()=>true,confirmReview=globalThis.confirm?.bind(globalThis)}) {
    let token;
    const preview=await fetchImpl(`/api/brands/${brandId}/write-preview`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
    const payload=await preview.json();
    if(!current())throw new Error('CONTEXT_CHANGED');
    if(!preview.ok)return {response:preview,payload};
    if(payload.changes?.[0]?.expected.exists) {
      if(!confirmReview || !await confirmReview('Review logo change: '+JSON.stringify(payload.changes[0])))throw new Error('REVIEW_CANCELLED');
      token=payload.review_token;
    }
    if(!current())throw new Error('CONTEXT_CHANGED');
    const response=await fetchImpl(`/api/brands/${brandId}/logo`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(token?{'X-Brand-Review':token}:{})},body:JSON.stringify(input)});
    return {response,payload:await response.json().catch(()=>null)};
  }
  return { CONTRACT, UUID, object, equal, empty, stable, parts, diff, normalize, command, apply, destructive, submit, submitLogo };
});
