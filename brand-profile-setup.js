(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FunklixBrandProfileSetup = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const SECTIONS = ['Overview', 'Brand DNA', 'Audience', 'Voice & Messaging', 'Offers & Proof', 'Brand Assets', 'Brand Avatar', 'Team and permissions', 'Campaign Sync', 'Review'];
  const FIELDS = Object.freeze({
    brandAssets: ['Brand Basics', 'Brand assets', 'assets'],
    brandCore: ['Foundation', 'Brand description', 'text'],
    valueProposition: ['Foundation', 'Value Proposition', 'text'],
    personas: ['Audience', 'Personas', 'personas'],
    toneOfVoice: ['Voice & Messaging', 'Tone of Voice', 'list'],
    messagingPillars: ['Voice & Messaging', 'Key messages', 'list'],
    contentGuidelines: ['Voice & Messaging', 'Content guidelines', 'list'],
    keywords: ['Voice & Messaging', 'Keywords', 'list'],
    dosAndDonts: ['Voice & Messaging', 'Communication guidelines', 'rules'],
    brandVoiceExamples: ['Voice & Messaging', 'Voice examples', 'examples']
  });
  function meaningful(value) {
    if (typeof value === 'string') return !!value.trim();
    if (Array.isArray(value)) return value.some(meaningful);
    return object(value) && Object.values(value).some(meaningful);
  }
  function website(value) {
    const text = String(value || '').trim();
    if (!text || text.length > 2048) throw new Error('website');
    let url;
    try { url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); } catch { throw new Error('website'); }
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443')
      || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.)/i.test(url.hostname)) throw new Error('website');
    url.hash = '';
    return url.href;
  }
  function filteredSuggestions(raw) {
    if (!object(raw)) return {};
    const result = {};
    for (const [key, [, , type]] of Object.entries(FIELDS)) {
      const value = raw[key];
      if (type === 'assets' && object(value)) {
        const assets = {};
        for (const part of ['colors', 'references']) if (Array.isArray(value[part]) && value[part].length <= 100 && value[part].every(item => typeof item === 'string' && item.length <= 5000)) assets[part] = value[part].slice();
        if (typeof value.typography === 'string' && value.typography.length <= 5000) assets.typography = value.typography;
        // Domain comes from the user's website. Logos use their separate private boundary.
        if (Object.keys(assets).length) result[key] = assets;
      }
      if (type === 'text' && typeof value === 'string' && value.length <= 50000) result[key] = value;
      if (type === 'list' && Array.isArray(value) && value.length <= 100 && value.every(item => typeof item === 'string' && item.length <= 5000)) result[key] = value.slice();
      if (type === 'personas' && Array.isArray(value) && value.length <= 100 && value.every(item => object(item) && typeof item.name === 'string' && typeof item.note === 'string')) result[key] = value.map(item => ({ name: item.name.slice(0, 500), note: item.note.slice(0, 5000) }));
      if (type === 'rules' && object(value) && ['dos','donts'].every(k => Array.isArray(value[k]) && value[k].length <= 100 && value[k].every(item => typeof item === 'string' && item.length <= 5000))) result[key] = { dos: value.dos.slice(), donts: value.donts.slice() };
      if (type === 'examples' && object(value) && ['good','avoid'].every(k => typeof value[k] === 'string' && value[k].length <= 50000)) result[key] = { good: value.good, avoid: value.avoid };
    }
    return result;
  }
  function validCandidate(value) {
    return value?.status === 'candidate_found' && ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(value.mime_type)
      && typeof value.image_base64 === 'string' && value.image_base64.length > 0 && value.image_base64.length <= 2 * 1024 * 1024 * 1.4 + 16
      && /^[A-Za-z0-9+/]+={0,2}$/.test(value.image_base64) && /^[a-f0-9]{64}$/.test(value.image_sha256 || '')
      && typeof value.candidate_url === 'string' && value.candidate_url.startsWith('https://');
  }
  // Resolve only within the already authorized Workspace catalog. A Board never
  // falls back to a different Brand, including when its association is unavailable.
  function resolveEntry(input) {
    const workspaces = input.catalog?.workspaces || [];
    if (!input.signedIn || input.publicToken || input.status !== 'ready') return { kind: 'empty', brands: [] };
    if (input.boardId) {
      const workspace = workspaces.find(w => w.boards.some(b => b.id === input.boardId));
      const board = workspace?.boards.find(b => b.id === input.boardId);
      const brand = input.boardAuthorized && workspace?.brands.find(b => b.id === board?.brand_id);
      return brand ? { kind: 'brand', brand, workspace } : { kind: 'empty', brands: [] };
    }
    const workspace = workspaces.find(w => w.id === input.workspaceId) || (workspaces.length === 1 ? workspaces[0] : null);
    const brands = workspace?.brands || [];
    const brand = brands.find(b => b.id === input.brandId) || (brands.length === 1 ? brands[0] : null);
    return brand ? { kind: 'brand', brand, workspace } : { kind: brands.length > 1 ? 'choice' : 'empty', brands, workspace };
  }
  function createSession(options) {
    const { getContext, fetchImpl = root.fetch.bind(root), validateBrand, onSave, onLogo } = options;
    const captured = getContext();
    let alive = true, flight = null;
    const state = {
      brand: options.brand, name: options.brand.name, core: clone(options.brand.brand_core),
      website: options.website || options.brand.brand_core?.brandAssets?.domain || options.brand.brand_core?.website || '',
      section: 0, message: '', analysis: 'Not analyzed', logo: options.brand.logo_url ? 'Logo saved' : 'No logo yet. Initials are shown.',
      proposals: clone(options.pendingData?.proposals || {}), candidate: clone(options.pendingData?.candidate || null),
      dnaPreflight: null, dnaDraft: null, avatarDraft: null, avatarDirection: '', file: options.pendingData?.file || null, fileData: options.pendingData?.fileData || null, pending: '', dirty: !!options.website, deferred: false,
      readOnly: options.brand.access?.canEditCanonicalBrand !== true || !['owner','admin','editor'].includes(options.brand.access?.role)
    };
    for (const [key, [, , type]] of Object.entries(FIELDS)) {
      if (type === 'assets') continue;
      if (!Object.hasOwn(state.core, key)) state.core[key] = type === 'text' ? '' : type === 'rules' ? { dos: [], donts: [] } : type === 'examples' ? { good: '', avoid: '' } : [];
    }
    let baseline = stable({ name: state.name.trim(), website: String(options.brand.brand_core?.brandAssets?.domain || options.brand.brand_core?.website || '').trim(), core: state.core });
    function draftSignature() { return stable({ name: state.name.trim(), website: state.website.trim(), core: state.core }); }
    function contentDirty() { return draftSignature() !== baseline; }
    let notify = () => {};
    function current() {
      const live = getContext();
      return alive && live.account === captured.account && live.generation === captured.generation
        && live.brandId === captured.brandId && live.workspaceId === captured.workspaceId && live.authorized !== false;
    }
    function changed() { if (current()) { try { notify(); } catch { state.message = state.dirty ? 'The view could not be updated. Your inputs are retained.' : 'Brand Profile saved. Refresh the view if the update is not visible everywhere yet.'; } } }
    function errorText(response, fallback, payload) {
      if (response.status === 409) return 'This Brand changed elsewhere. Your inputs are retained. Reload latest before retrying.';
      if (response.status === 401) { state.readOnly = true; return 'Your session expired. Sign in again. Your inputs are retained.'; }
      if (response.status === 403) { state.readOnly = true; return 'You do not have permission to change this Brand. Your inputs are retained.'; }
      if (response.status === 404) { state.readOnly = true; return 'This Brand or workspace is no longer available. Your inputs are retained.'; }
      const code = payload?.error?.code || payload?.code;
      if (code === 'STORAGE_UNAVAILABLE') return 'Logo storage is temporarily unavailable. Your Brand information can still be saved.';
      if (['UNSUPPORTED_FILE', 'FILE_TOO_LARGE'].includes(code)) return 'Choose PNG, JPEG, WebP or GIF, up to 2 MB.';
      if (code === 'DATABASE_UNAVAILABLE') return 'The database is temporarily unavailable. Your inputs are retained. Try again.';
      return fallback;
    }
    function run(kind, operation) {
      if (!current()) { state.message = 'Workspace or Brand context is no longer available.'; notify(); return Promise.resolve(false); }
      if (state.readOnly) return Promise.resolve(false);
      if (flight) return flight;
      if (state.pending || state.returning) return Promise.resolve(false);
      state.pending = kind; changed();
      flight = (async () => {
        try { return await operation(); }
        catch { if (current()) { if (kind === 'Analyzing website…') state.analysis = 'Analysis failed'; state.message = kind === 'Analyzing website…' ? 'Website analysis failed. Retry or continue manually.' : kind === 'Uploading logo…' ? 'Logo upload failed. Your file is retained. Retry the upload.' : 'The save was not confirmed. Your inputs are retained. Retry safely.'; } return false; }
        finally { flight = null; state.pending = ''; if (!current()) refreshContext(); changed(); }
      })();
      return flight;
    }
    async function jsonRequest(url, method, body) {
      const response = await fetchImpl(url, { method, credentials: 'same-origin', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!current()) return null;
      const payload = await response.json().catch(() => null);
      if (!current()) return null;
      return { response, payload };
    }
    function applyProposal(key) {
      if (!current() || state.readOnly || state.pending || !Object.hasOwn(state.proposals, key)) return;
      state.core[key] = object(state.core[key]) && object(state.proposals[key]) ? { ...clone(state.core[key]), ...clone(state.proposals[key]) } : clone(state.proposals[key]); delete state.proposals[key]; state.dirty = true; changed();
    }
    function analyze() {
      return run('Analyzing website…', async () => {
        let domain;
        try { domain = website(state.website); } catch { state.message = 'Enter a valid public HTTPS website.'; return false; }
        state.deferred = false; state.analysis = 'Analyzing website…'; state.message = '';
        const result = await jsonRequest('/api/analyze-brand-domain', 'POST', { domainUrl: domain, brandId: state.brand.id });
        if (!result) return false;
        if (!result.response.ok) {
          const code = result.payload?.error?.code;
          state.analysis = code === 'empty_content' ? 'No usable information found' : 'Analysis failed';
          const fallback = ['invalid_url','unsupported_scheme','credentials_not_allowed','invalid_host','port_not_allowed','unsafe_destination'].includes(code) ? 'Enter a valid public HTTPS website.'
            : code === 'empty_content' ? 'No usable information found. You can fill in your Brand Profile manually.' : 'Website analysis failed. Retry or continue manually.';
          state.message = errorText(result.response, fallback, result.payload); return false;
        }
        const suggestions = filteredSuggestions(result.payload?.suggestions);
        if (!Object.values(suggestions).some(meaningful)) { state.proposals = {}; state.analysis = 'No usable information found'; state.message = 'No usable information found. You can fill in your Brand Profile manually.'; }
        else {
          state.proposals = suggestions; state.analysis = 'Review website suggestions'; state.section = 9;
          // Filling an empty local draft is never a save or a replacement of confirmed data.
          if (!Object.keys(FIELDS).some(key => key !== 'brandAssets' && meaningful(state.core[key]))) {
            Object.assign(state.core, clone(suggestions)); state.proposals = {}; state.dirty = true;
          }
        }
        state.candidate = validCandidate(result.payload?.logoDiscovery) ? clone(result.payload.logoDiscovery) : null;
        state.logo = state.candidate ? state.brand.logo_source === 'uploaded' ? 'Your uploaded logo has priority. It was kept.' : 'Review the suggested logo' : 'No suitable logo found. Upload your own logo.';
        return true;
      });
    }
    function save() {
      return run('Saving Brand Profile…', async () => {
        const name = state.name.trim();
        if (!name || name.length > 160) { state.message = 'Enter a Brand name between 1 and 160 characters.'; return false; }
        let domain = '';
        if (state.website.trim()) { try { domain = website(state.website); } catch { state.message = 'Enter a valid public HTTPS website.'; return false; } }
        const submitted = draftSignature();
        const core = clone(state.core);
        if (object(core.brandAssets) || domain) core.brandAssets = { ...(object(core.brandAssets) ? core.brandAssets : {}), domain };
        const revision = state.brand.revision;
        const result = await jsonRequest(`/api/brands/${state.brand.id}`, 'PUT', { name, brand_core: core, revision });
        if (!result) return false;
        if (!result.response.ok) { state.message = errorText(result.response, 'The save was not confirmed. Your inputs are retained. Retry safely.', result.payload); return false; }
        if (!validateBrand(result.payload, state.brand.id)) { state.message = 'The save response could not be verified. Your inputs are retained.'; return false; }
        const brand = await verifyBrand();
        if (!brand || !validateBrand(brand, state.brand.id) || brand.revision !== revision + 1 || brand.name !== name
          || stable(brand.brand_core) !== stable(core)) { state.message = 'The save response could not be verified. Your inputs are retained.'; return false; }
        state.brand = brand;
        // Inputs may change during an in-flight save. Clear only the submitted draft.
        if (draftSignature() === submitted) { state.name = brand.name; state.core = clone(brand.brand_core); state.website = domain; baseline = draftSignature(); }
        state.dirty = contentDirty();
        state.message = state.dirty ? 'Brand Profile saved. Your newer edits are retained.' : 'Brand Profile saved';
        // Confirmation is authoritative. A later projection failure cannot undo it.
        try { await onSave(brand); }
        catch { state.message = 'Brand Profile saved. Refresh the view if the update is not visible everywhere yet.'; }
        return true;
      });
    }
    async function verifyBrand() {
      const controller = new root.AbortController();
      const timeout = root.setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetchImpl(`/api/brands/${state.brand.id}`, { signal: controller.signal, credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' } });
        const brand = await response.json().catch(() => null);
        return current() && response.ok && validateBrand(brand, state.brand.id) ? brand : null;
      } finally { root.clearTimeout(timeout); }
    }
    function stable(value) {
      if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
      if (object(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
      return JSON.stringify(value);
    }
    function logoMutation(action, extra) {
      return run('Uploading logo…', async () => {
        const revision = state.brand.logo_revision || 0;
        const requestId = options.requestId();
        const result = await jsonRequest(`/api/brands/${state.brand.id}/logo`, 'POST', { contract: 'brand_logo_v1', action, expected_revision: revision, request_id: requestId, workspace_id: captured.workspaceId, ...extra });
        if (!result) return false;
        if (!result.response.ok) {
          state.logo = 'Logo upload failed';
          state.message = result.payload?.error?.code === 'UPLOADED_LOGO_PRESERVED' ? 'Your uploaded logo has priority. It was kept.'
            : result.payload?.error?.code === 'CANDIDATE_CHANGED' ? 'The suggested logo changed. Analyze the website again before confirming.'
            : errorText(result.response, 'Logo upload failed. Your file is retained. Retry the upload.', result.payload);
          return false;
        }
        const logo = result.payload?.logo;
        if (result.payload?.contract !== 'brand_logo_v1' || result.payload.request_id !== requestId || !logo
          || logo.logo_revision !== revision + 1 || (action === 'remove' ? logo.logo_url !== null : logo.logo_url !== `/api/brands/${state.brand.id}/logo?revision=${logo.logo_revision}`)) {
          state.message = 'The logo save could not be verified. Retry or reload the latest Brand.'; return false;
        }
        const confirmed = await verifyBrand();
        if (!confirmed || confirmed.logo_revision !== logo.logo_revision || confirmed.logo_url !== logo.logo_url) {
          state.message = 'The logo save could not be verified. Retry or reload the latest Brand.'; return false;
        }
        state.brand = confirmed;
        state.logo = action === 'remove' ? 'No logo yet. Initials are shown.' : 'Logo saved'; state.message = action === 'remove' ? 'Logo removed' : 'Logo saved'; if (action === 'discover') state.candidate = null;
        state.file = null; state.fileData = null; state.candidate = null;
        try { await onLogo(state.brand.id, logo); }
        catch { state.message = 'Logo saved. Refresh the view if the update is not visible everywhere yet.'; }
        return true;
      });
    }
    function upload() {
      if (!state.fileData) { state.message = 'Choose a logo file first.'; changed(); return Promise.resolve(false); }
      return logoMutation('upload', { image_base64: state.fileData.base64, mime_type: state.fileData.mime });
    }
    function removeLogo() {
      if (!state.brand.logo_url || !current() || state.readOnly) return Promise.resolve(false);
      return logoMutation('remove', {});
    }
    function useLogo() {
      const candidate = state.candidate;
      if (!candidate) return Promise.resolve(false);
      let domain;
      try { domain = website(state.website); } catch { state.message = 'Enter a valid public HTTPS website.'; changed(); return Promise.resolve(false); }
      return logoMutation('discover', { website: domain, candidate_url: candidate.candidate_url, image_sha256: candidate.image_sha256 });
    }
    async function chooseFile(file, read = file => new Promise((resolve, reject) => {
      const reader = new root.FileReader(); reader.onerror = reject; reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.readAsDataURL(file);
    })) {
      if (!current() || state.readOnly || state.pending) return false;
      if (!file || !['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 2 * 1024 * 1024) {
        state.message = 'Choose PNG, JPEG, WebP or GIF, up to 2 MB.'; changed(); return false;
      }
      state.deferred = false; state.file = file; state.fileData = null; state.pending = 'Reading logo…'; changed();
      try {
        const base64 = await read(file);
        if (!current() || state.file !== file) return false;
        state.fileData = { mime: file.type, base64 }; state.message = 'Logo preview ready. Choose Upload logo to save it.'; return true;
      } catch { if (current()) state.message = 'The file could not be read. Choose the file again.'; return false; }
      finally { if (current()) { state.pending = ''; changed(); } }
    }
    async function reload() {
      return run('Loading Brand Profile…', async () => {
        const response = await fetchImpl(`/api/brands/${state.brand.id}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
        if (!current()) return false;
        const brand = await response.json().catch(() => null);
        if (!current()) return false;
        if (!response.ok || !validateBrand(brand, state.brand.id)) { state.message = errorText(response, 'Brand Profile could not be loaded. Retry.'); return false; }
        // Keep the unsaved draft for deliberate review against the latest revision.
        state.brand = brand; baseline = stable({ name: brand.name.trim(), website: String(brand.brand_core?.brandAssets?.domain || brand.brand_core?.website || '').trim(), core: brand.brand_core }); state.dirty = contentDirty(); state.readOnly = brand.access.canEditCanonicalBrand !== true || !['owner','admin','editor'].includes(brand.access.role);
        state.message = 'Latest Brand loaded. Your unsaved inputs are retained; review them before saving.';
        try { await onSave(brand); } catch { state.message = 'Latest Brand loaded. Refresh the view if the update is not visible everywhere yet.'; }
        return true;
      });
    }
    function requestDna() {
      if (!current() || state.readOnly || state.pending) return;
      if (contentDirty()) { state.message = 'Save Brand Profile before generating DNA.'; changed(); return; }
      state.dnaPreflight = options.dnaPreflight?.(state.core) || { status: 'usable' };
      if (state.dnaPreflight.status === 'usable') return generateDna();
      state.message = 'Review your Founder Story'; changed();
    }
    function generateDna() {
      return run('Generating Brand DNA…', async () => {
        if (contentDirty()) { state.message = 'Save Brand Profile before generating DNA.'; return false; }
        const result = await jsonRequest('/api/discover-brand-dna', 'POST', { brandId: state.brand.id, revision: state.brand.revision,
          brandBrainData: clone(state.core), refineGuidance: '', ...(options.founderContext?.(state.core, state.dnaPreflight) ? { founderStoryContext: options.founderContext(state.core, state.dnaPreflight) } : {}) });
        if (!result?.response.ok || !result.payload?.primaryArchetype || !result.payload?.secondaryArchetype) {
          state.message = result ? errorText(result.response, 'Brand DNA generation failed. Retry safely.', result.payload) : 'Brand DNA generation failed. Retry safely.'; return false;
        }
        state.dnaPreflight = null; state.dnaDraft = clone(result.payload); state.message = 'Review generated Brand DNA'; return true;
      });
    }
    async function acceptDna() {
      if (!current() || state.readOnly || state.pending || !state.dnaDraft) return false;
      const previous = clone(state.core.brandDNA || {});
      // A new strategy never silently replaces an accepted avatar or unknown fields.
      state.core.brandDNA = { ...previous, ...clone(state.dnaDraft), avatar: previous.avatar, userApproved: true };
      if (!previous.avatar) delete state.core.brandDNA.avatar;
      state.dirty = true;
      const saved = await save(); if (saved) state.dnaDraft = null; changed(); return saved;
    }
    function generateAvatar() {
      return run('Generating Brand Avatar…', async () => {
        if (contentDirty() || state.brand.brand_core?.brandDNA?.userApproved !== true) { state.message = 'Save and confirm Brand DNA before generating an avatar.'; return false; }
        const result = await jsonRequest('/api/generate-brand-avatar', 'POST', { brandId: state.brand.id, revision: state.brand.revision,
          brandBrainData: clone(state.brand.brand_core), brandDNA: clone(state.brand.brand_core.brandDNA), optionalUserDirection: state.avatarDirection });
        if (!result?.response.ok || !/^https:\/\//.test(result.payload?.imageUrl || '')) {
          state.message = result ? errorText(result.response, 'Avatar generation failed. Retry safely.', result.payload) : 'Avatar generation failed. Retry safely.'; return false;
        }
        state.avatarDraft = { ...clone(result.payload), userApproved: false }; state.message = 'Review generated Brand Avatar'; return true;
      });
    }
    async function acceptAvatar() {
      if (!current() || state.readOnly || state.pending || !state.avatarDraft) return false;
      state.core.brandDNA = { ...state.core.brandDNA, avatar: { ...state.core.brandDNA?.avatar, ...clone(state.avatarDraft), userApproved: true } };
      state.dirty = true;
      const saved = await save(); if (saved) { state.avatarDraft = null; state.avatarDirection = ''; } changed(); return saved;
    }
    function discard() {
      state.name = state.brand.name; state.core = clone(state.brand.brand_core); state.website = state.core.brandAssets?.domain || state.core.website || '';
      baseline = draftSignature(); state.dirty = false; state.file = null; state.fileData = null; state.candidate = null; state.proposals = {}; state.dnaDraft = null; state.avatarDraft = null; state.avatarDirection = ''; state.dnaPreflight = null;
    }
    function refreshContext() {
      const live = getContext();
      if (!alive || flight || live.account !== captured.account || live.brandId !== captured.brandId || live.workspaceId !== captured.workspaceId || live.authorized !== true) return false;
      captured.generation = live.generation;
      return true;
    }
    return { state, current, refreshContext, analyze, save, upload, removeLogo, useLogo, chooseFile, applyProposal, reload,
      discard, requestDna, generateDna, acceptDna, generateAvatar, acceptAvatar, contentDirty,
      subscribe(fn) { notify = fn; }, invalidate() { alive = false; state.file = null; state.fileData = null; state.candidate = null; state.proposals = {}; state.dnaDraft = null; state.avatarDraft = null; state.avatarDirection = ''; state.core = {}; state.website = ''; state.name = ''; },
      dirty() { return contentDirty() || (!state.deferred && !!(state.file || state.candidate || state.dnaDraft || state.avatarDraft || state.avatarDirection || Object.keys(state.proposals).length)); }, busy() { return !!state.pending; } };
  }

  function mount(container, options) {
    const session = createSession(options), s = session.state, doc = container.ownerDocument;
    let fileInput = null;
    const t = key => root.FunklixLanguage.t(key, options.language());
    function node(tag, text, parent) { const n = doc.createElement(tag); if (text) n.textContent = text; if (parent) parent.append(n); return n; }
    function button(key, parent, action, id = key) {
      const b = node('button', t(key), parent); b.type = 'button'; b.dataset.profileKey = id;
      if (key === 'Save Brand Profile and continue' || (key === 'Confirm and save Brand Profile' && s.section !== 9)) b.className = 'fk-btn fk-btn-primary';
      b.disabled = !!s.pending || !!s.returning; b.addEventListener('click', action); return b;
    }
    function textField(label, value, parent, update, multiline = false, id = label) {
      const wrap = node('label', '', parent); node('span', t(label), wrap);
      const input = node(multiline ? 'textarea' : 'input', '', wrap); input.value = value || ''; input.dataset.profileKey = id;
      if (multiline) input.rows = 4;
      input.disabled = s.readOnly || !!s.pending || !!s.returning;
      input.addEventListener('input', () => { update(input.value); s.dirty = true; }); return input;
    }
    function readable(value, parent) {
      if (Array.isArray(value)) { const list = node('ul', '', parent); value.forEach(item => readable(item, node('li', '', list))); }
      else if (object(value)) { Object.entries(value).forEach(([key, item]) => { if (meaningful(item)) { const line = node('div', '', parent); node('strong', t({ name: 'Name', note: 'Description', description: 'Description', benefit: 'Benefit', evidence: 'Evidence', good: 'Good example', avoid: 'Avoid', dos: 'Do', donts: 'Avoid', toneSignals: 'Tone signals', missionSignals: 'Mission signals', audienceSignals: 'Audience signals', messagingSignals: 'Messaging signals', visualSignals: 'Visual signals' }[key] || key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ')), line); readable(item, line); } }); }
      else if (meaningful(value)) node('p', String(value), parent);
    }
    function fields(section, parent) {
      let count = 0;
      for (const [key, [group, label, type]] of Object.entries(FIELDS)) {
        if (group !== section) continue;
        count++;
        if (type === 'assets') {
          for (const part of ['colors', 'typography', 'references']) {
            const assets = object(s.core[key]) ? s.core[key] : {};
            const value = assets[part];
            if (value !== undefined && (part === 'typography' ? typeof value !== 'string' : !Array.isArray(value) || value.some(item => typeof item !== 'string'))) { readable(value, parent); continue; }
            textField({ colors: 'Colors', typography: 'Typography', references: 'References' }[part], part === 'typography' ? value : (value || []).join('\n'), parent, text => {
              if (!object(s.core[key])) s.core[key] = {};
              s.core[key][part] = part === 'typography' ? text : text.split('\n').map(line => line.trim()).filter(Boolean);
            }, true, `brandAssets-${part}`);
          }
        } else if (type === 'personas') {
          node('h4', t(label), parent);
          if (!Array.isArray(s.core[key])) { readable(s.core[key], parent); continue; }
          s.core[key].forEach((persona, index) => {
            const card = node('section', '', parent); card.className = 'profile-persona';
            if (object(persona)) {
              textField('Name', persona.name, card, value => { persona.name = value; }, false, `persona-${index}-name`);
              textField('Description', persona.note || persona.description, card, value => { persona[Object.hasOwn(persona, 'description') && !Object.hasOwn(persona, 'note') ? 'description' : 'note'] = value; }, true, `persona-${index}-note`);
              const rest = { ...persona }; delete rest.name; delete rest.note; delete rest.description; readable(rest, card);
            } else readable(persona, card);
          });
          if (!s.readOnly) button('Add audience', parent, () => { s.core[key].push({ name: '', note: '' }); s.dirty = true; render(); });
        } else if (type === 'rules' || type === 'examples') {
          node('h4', t(label), parent);
          if (!object(s.core[key])) { readable(s.core[key], parent); continue; }
          for (const part of type === 'rules' ? ['dos','donts'] : ['good','avoid']) {
            const value = s.core[key]?.[part];
            if ((type === 'rules' && value !== undefined && (!Array.isArray(value) || value.some(item => typeof item !== 'string'))) || (type === 'examples' && value !== undefined && typeof value !== 'string')) { readable(value, parent); continue; }
            textField({ dos: 'Do', donts: 'Avoid', good: 'Good example', avoid: 'Avoid' }[part], type === 'rules' ? (value || []).join('\n') : value, parent, text => {
              if (!object(s.core[key])) s.core[key] = {};
              s.core[key][part] = type === 'rules' ? text.split('\n').map(line => line.trim()).filter(Boolean) : text;
            }, true, `${key}-${part}`);
          }
        } else if ((type === 'list' && (!Array.isArray(s.core[key]) || s.core[key].some(item => typeof item !== 'string'))) || (type === 'text' && typeof s.core[key] !== 'string')) {
          node('h4', t(label), parent); readable(s.core[key], parent);
        } else textField(label, type === 'list' ? (s.core[key] || []).join('\n') : s.core[key], parent, value => { s.core[key] = type === 'list' ? value.split('\n').map(line => line.trim()).filter(Boolean) : value; }, true);
      }
      const modules = section === 'Foundation' ? ['mission', 'vision', 'values', 'founder_story'] : section === 'Audience' ? ['audience', 'icp'] : section === 'Offers & Proof' ? ['product_knowledge', 'business_plan', 'pitch_deck', 'whitepaper'] : [];
      for (const type of modules) {
        const definition = options.moduleDefinition(type);
        if (!definition) continue;
        const tile = s.core.customTiles?.find(tile => tile.moduleType === type);
        if (section === 'Foundation') {
          count++;
          textField(definition.label, tile?.content || '', parent, value => {
            let target = s.core.customTiles?.find(tile => tile.moduleType === type);
            if (!target && value.trim()) { target = options.createTile(type); (s.core.customTiles ||= []).push(target); }
            if (target) target.content = value;
          }, true);
        } else if (tile && meaningful(tile.content)) { count++; node('h4', t(definition.label), parent); readable(tile.content, parent); }
      }
      if (section === 'Offers & Proof') for (const [key, label] of [['offers', 'Offers'], ['proof', 'Proof']]) if (meaningful(s.core[key])) { count++; node('h4', t(label), parent); readable(s.core[key], parent); }
      if (section === 'Offers & Proof' && meaningful(s.core.valueProposition)) { count++; node('h4', t('Value Proposition'), parent); readable(s.core.valueProposition, parent); }
      if (!count) node('p', t('No information in this section yet. Existing knowledge modules remain available in advanced options.'), parent);
    }
    function logo(parent) {
      const status = node('p', t(s.logo), parent); status.setAttribute('role', 'status');
      if (s.readOnly) return;
      if (!fileInput) {
        fileInput = node('input'); fileInput.type = 'file'; fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif'; fileInput.dataset.profileKey = 'file';
        fileInput.addEventListener('change', () => { void session.chooseFile(fileInput.files?.[0]); });
      }
      fileInput.disabled = !!s.pending || !!s.returning;
      if (!s.file) fileInput.value = '';
      node('label', t('Choose logo file'), parent).append(fileInput);
      if (s.file) node('p', s.file.name, parent);
      if (s.fileData) { const img = node('img', '', parent); img.className = 'profile-logo-candidate'; img.alt = t('Local logo preview'); img.src = `data:${s.fileData.mime};base64,${s.fileData.base64}`; }
      const upload = button(s.brand.logo_url ? 'Change logo' : 'Upload logo', parent, () => { void session.upload(); }); upload.disabled ||= !s.fileData;
      if (s.brand.logo_url) button('Remove logo', parent, () => { void session.removeLogo(); });
      if (s.candidate) {
        const img = node('img', '', parent); img.className = 'profile-logo-candidate'; img.alt = t('Suggested logo'); img.src = `data:${s.candidate.mime_type};base64,${s.candidate.image_base64}`;
        const use = button('Use this logo', parent, () => { void session.useLogo(); }); use.disabled ||= s.brand.logo_source === 'uploaded';
      }
    }
    function render() {
      const focused = doc.activeElement?.dataset?.profileKey;
      options.onBusy?.(!!s.pending || !!s.returning);
      container.replaceChildren(); container.classList.add('guided-brand-profile'); container.setAttribute('aria-busy', String(!!s.pending));
      const header = node('section', '', container); header.className = 'profile-header';
      const mark = node('div', '', header); mark.className = 'profile-logo'; root.FunklixBrandLogo.render(mark, s.brand, { label: t('Brand logo') });
      const identity = node('div', '', header); node('h3', s.brand.name, identity);
      node('p', s.website || t('No website yet'), identity);
      node('p', t(meaningful(s.core.brandCore) && meaningful(s.core.personas) ? 'Good foundation' : 'Ready to complete'), identity);
      if (s.readOnly) node('p', t('Your access is read-only'), container);
      const nav = node('nav', '', container); nav.setAttribute('aria-label', t('Brand Profile sections'));
      SECTIONS.forEach((key, index) => { const b = button(key, nav, () => { s.section = index; render(); container.querySelector('h3[data-section-title]')?.focus(); }); b.setAttribute('aria-current', s.section === index ? 'step' : 'false'); });
      const section = node('section', '', container); section.className = 'profile-section';
      const title = node('h3', t(SECTIONS[s.section]), section); title.tabIndex = -1; title.dataset.sectionTitle = 'true';
      if (s.section === 0) {
        textField('Brand name', s.name, section, value => { s.name = value; });
        textField('Website', s.website, section, value => { s.website = value; s.proposals = {}; s.candidate = null; s.analysis = 'Not analyzed'; });
        if (!s.readOnly) button('Analyze website', section, () => { void session.analyze(); });
        fields('Foundation', section);
      } else if (s.section === 9) {
        const list = node('ul', '', section);
        for (const key of ['Brand Basics', 'Foundation', 'Audience', 'Voice & Messaging', 'Offers & Proof']) {
          const complete = key === 'Brand Basics' ? !!s.name.trim() && !!s.website.trim()
            : key === 'Offers & Proof' ? meaningful(s.core.valueProposition) || s.core.customTiles?.some(tile => ['product_knowledge','business_plan','pitch_deck','whitepaper'].includes(tile.moduleType) && meaningful(tile.content))
            : Object.entries(FIELDS).filter(([, [group]]) => group === key).some(([field]) => meaningful(s.core[field]));
          node('li', `${t(key)}: ${t(complete ? 'Provided' : 'Can be completed')}`, list);
        }
        node('p', `${t('Website analysis')}: ${t(s.analysis)}`, section); logo(section);
        for (const [key, value] of Object.entries(s.proposals)) {
          const proposal = node('section', '', section); proposal.className = 'profile-proposal'; node('h4', t(FIELDS[key][1]), proposal);
          node('p', t('Current value'), proposal); readable(s.core[key], proposal);
          node('p', t('Website suggestion'), proposal); readable(value, proposal);
          if (!s.readOnly) button('Use suggestion', proposal, () => session.applyProposal(key), `proposal-${key}`);
        }
      } else if (s.section === 1) {
        const dna = s.dnaDraft || s.core.brandDNA || {};
        if (options.renderDna) options.renderDna(section, dna);
        for (const key of ['primaryArchetype', 'secondaryArchetype', 'personality', 'positioning', 'reasoning', 'recommendedVoice', 'recommendedVisualDirection']) {
          const value = s.core.brandDNA?.[key];
          if (value !== undefined && typeof value !== 'string') { node('h4', t({ primaryArchetype: 'Primary archetype', secondaryArchetype: 'Secondary archetype', personality: 'Brand personality', positioning: 'Positioning', reasoning: 'Reasoning', recommendedVoice: 'Recommended voice', recommendedVisualDirection: 'Recommended visual direction' }[key]), section); readable(value, section); continue; }
          textField({ primaryArchetype: 'Primary archetype', secondaryArchetype: 'Secondary archetype', personality: 'Brand personality', positioning: 'Positioning', reasoning: 'Reasoning', recommendedVoice: 'Recommended voice', recommendedVisualDirection: 'Recommended visual direction' }[key], value, section, text => { (s.core.brandDNA ||= {})[key] = text; }, true, `dna-${key}`);
        }
        if (s.core.brandDNA?.signals) { node('h4', t('Brand signals'), section); readable(s.core.brandDNA.signals, section); }
        for (const [key, label] of [['personality', 'Brand personality'], ['positioning', 'Positioning'], ['audiences', 'Audience']]) if (meaningful(s.core[key])) { node('h4', t(label), section); readable(s.core[key], section); }
        fields('Foundation', section);
        if (!s.readOnly) {
          button('Generate Brand DNA', section, () => { void session.requestDna(); });
          if (s.dnaPreflight && s.dnaPreflight.status !== 'usable') {
            node('p', t('Your Founder Story helps explain your Brand DNA. Review it first or continue with the available information.'), section);
            button('Continue anyway', section, () => { void session.generateDna(); });
            const definition = options.moduleDefinition('founder_story');
            if (definition) textField('Founder Story', s.core.customTiles?.find(tile => tile.moduleType === 'founder_story')?.content || '', section, value => {
              let tile = s.core.customTiles?.find(tile => tile.moduleType === 'founder_story');
              if (!tile) { tile = options.createTile('founder_story'); (s.core.customTiles ||= []).push(tile); } tile.content = value;
            }, true);
          }
          if (s.dnaDraft) button('Save Brand DNA', section, () => { void session.acceptDna(); });
        }
      } else if (s.section === 5) { logo(section); fields('Brand Basics', section);
      } else if (s.section === 6) {
        const accepted = s.core.brandDNA?.avatar;
        node('p', t('The Brand Avatar is your generated Brand advisor. The Brand Logo identifies your company.'), section);
        for (const [avatar, label] of [[accepted, 'Saved Brand Avatar'], [s.avatarDraft, 'Review generated Brand Avatar']]) {
          if (!avatar?.imageUrl || !/^(https:\/\/|\/)/.test(avatar.imageUrl)) continue;
          node('h4', t(label), section);
          const img = node('img', '', section); img.className = 'profile-brand-avatar'; img.alt = t('Brand Avatar'); img.src = avatar.imageUrl;
          img.addEventListener('error', () => { img.remove(); node('p', t('Brand Avatar unavailable. Retry safely.'), section); }, { once: true });
          if (avatar.prompt) { const details = node('details', '', section); node('summary', t('Avatar direction'), details); node('p', avatar.prompt, details); }
        }
        if (!accepted?.imageUrl) node('p', t('No Brand Avatar yet.'), section);
        if (!s.readOnly) {
          textField('Avatar direction', s.avatarDirection, section, value => { s.avatarDirection = value; }, true);
          button(accepted?.imageUrl ? 'Regenerate Avatar' : 'Generate Avatar', section, () => { void session.generateAvatar(); });
          if (s.avatarDraft) button('Save Avatar', section, () => { void session.acceptAvatar(); });
        }
      } else if (s.section === 7) { options.renderTeam?.(section, s.brand);
        if (!s.brand.access.canManageBrandMembers) node('p', t('Your access is read-only'), section);
      } else if (s.section === 8) {
        node('p', t('Campaign snapshots change only after an explicit campaign update.'), section);
        if (options.hasSnapshot?.()) button('Campaign Brand Snapshot', section, () => options.onSnapshot());
      } else fields(SECTIONS[s.section], section);
      const feedback = node('p', t(s.pending || s.message), container); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
      const actions = node('div', '', container); actions.className = 'profile-actions';
      if (!s.readOnly) {
        button('Confirm and save Brand Profile', actions, () => { void session.save(); });
        button('Reload latest Brand', actions, () => { void session.reload(); });
      }
      if (options.hasProject() || s.section === 9) button(options.hasProject() ? 'Save Brand Profile and continue' : 'Back', actions, async () => {
        if (options.hasProject() && !s.readOnly) {
          if (!await session.save()) return;
          // Optional unuploaded files/suggestions stay in the account's memory cache.
          s.deferred = true;
        }
        if (!session.current()) return;
        s.returning = true; render();
        try { await options.onContinue(); } finally { s.returning = false; if (session.current()) render(); }
      });
      if (options.hasSnapshot?.()) button('Campaign Brand Snapshot', actions, () => options.onSnapshot());
      button('Advanced options', actions, () => options.onAdvanced(session));
      if (focused) [...container.querySelectorAll('[data-profile-key]')].find(n => n.dataset.profileKey === focused)?.focus();
    }
    session.subscribe(render); render();
    return { ...session, render, invalidate() { session.invalidate(); options.onBusy?.(false); } };
  }
  function leaveDialog({ document: doc = root.document, language, save, proceed }) {
    const existing = doc.getElementById('brand-leave-dialog');
    if (existing) { existing.querySelector('[data-keep-editing]')?.focus(); return; }
    const t = key => root.FunklixLanguage.t(key, language());
    const origin = doc.activeElement, dialog = doc.createElement('dialog');
    dialog.id = 'brand-leave-dialog'; dialog.className = 'brand-leave-dialog';
    dialog.setAttribute('aria-labelledby', 'brand-leave-title');
    const title = doc.createElement('h2'); title.id = 'brand-leave-title'; title.textContent = t('Save changes before leaving?');
    const status = doc.createElement('p'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    const actions = doc.createElement('div'); actions.className = 'brand-leave-actions';
    const primary = doc.createElement('button'), keep = doc.createElement('button'), discard = doc.createElement('button');
    primary.type = keep.type = discard.type = 'button';
    primary.className = 'fk-btn fk-btn-primary'; primary.textContent = t('Save and continue');
    keep.className = 'fk-btn fk-btn-secondary'; keep.textContent = t('Keep editing'); keep.dataset.keepEditing = 'true';
    discard.className = 'fk-btn fk-btn-ghost brand-leave-discard'; discard.textContent = t('Discard changes');
    actions.append(primary, keep, discard); dialog.append(title, status, actions); doc.body.append(dialog);
    let pending = false;
    const close = restore => { dialog.close(); dialog.remove(); if (restore && origin?.isConnected) origin.focus(); };
    keep.addEventListener('click', () => { if (!pending) close(true); });
    discard.addEventListener('click', () => { if (!pending) { close(false); proceed('discard'); } });
    primary.addEventListener('click', async () => {
      if (pending) return;
      pending = true; primary.disabled = discard.disabled = keep.disabled = true;
      try { if (await save()) { close(false); proceed('save'); return; } }
      catch { /* preserve the profile and show bounded feedback */ }
      status.textContent = t('The save was not confirmed. Your inputs are retained. Retry safely.');
      pending = false; primary.disabled = discard.disabled = keep.disabled = false; keep.focus();
    });
    dialog.addEventListener('cancel', event => { event.preventDefault(); if (!pending) close(true); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const buttons = [primary, keep, discard].filter(button => !button.disabled);
      const next = event.shiftKey && doc.activeElement === buttons[0] ? buttons.at(-1) : !event.shiftKey && doc.activeElement === buttons.at(-1) ? buttons[0] : null;
      if (next) { event.preventDefault(); next.focus(); }
    });
    dialog.showModal(); keep.focus();
  }
  return Object.freeze({ SECTIONS, FIELDS, resolveEntry, meaningful, website, filteredSuggestions, validCandidate, createSession, mount, leaveDialog });
}));
