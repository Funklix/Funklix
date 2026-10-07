(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FunklixBrandProfileSetup = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const object = value => !!value && typeof value === 'object' && !Array.isArray(value);
  const SECTIONS = ['Brand Basics', 'Foundation', 'Audience', 'Voice & Messaging', 'Offers & Proof', 'Review'];
  const FIELDS = Object.freeze({
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
  function createSession(options) {
    const { getContext, fetchImpl = root.fetch.bind(root), validateBrand, onSave, onLogo } = options;
    const captured = getContext();
    let alive = true, flight = null;
    const state = {
      brand: options.brand, name: options.brand.name, core: clone(options.brand.brand_core),
      website: options.website || options.brand.brand_core?.brandAssets?.domain || options.brand.brand_core?.website || '',
      section: 0, message: '', analysis: 'Not analyzed', logo: options.brand.logo_url ? 'Logo saved' : 'No logo yet. Initials are shown.',
      proposals: {}, candidate: null, file: null, fileData: null, pending: '', dirty: !!options.website,
      readOnly: options.brand.access?.canEditCanonicalBrand !== true || !['owner','admin','editor'].includes(options.brand.access?.role)
    };
    for (const [key, [, , type]] of Object.entries(FIELDS)) {
      if (!Object.hasOwn(state.core, key)) state.core[key] = type === 'text' ? '' : type === 'rules' ? { dos: [], donts: [] } : type === 'examples' ? { good: '', avoid: '' } : [];
    }
    let notify = () => {};
    function current() {
      const live = getContext();
      return alive && live.account === captured.account && live.generation === captured.generation
        && live.brandId === captured.brandId && live.workspaceId === captured.workspaceId && live.authorized !== false;
    }
    function changed() { if (current()) notify(); }
    function errorText(response, fallback) {
      if (response.status === 409) return 'This Brand changed elsewhere. Your inputs are retained. Reload latest before retrying.';
      if ([401, 403, 404].includes(response.status)) { state.readOnly = true; return 'Your access is no longer available. Your inputs are retained.'; }
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
        finally { flight = null; if (current()) { state.pending = ''; changed(); } }
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
        state.analysis = 'Analyzing website…'; state.message = '';
        const result = await jsonRequest('/api/analyze-brand-domain', 'POST', { domainUrl: domain, brandId: state.brand.id });
        if (!result) return false;
        if (!result.response.ok) {
          const code = result.payload?.error?.code;
          state.analysis = code === 'empty_content' ? 'No usable information found' : 'Analysis failed';
          const fallback = ['invalid_url','unsupported_scheme','credentials_not_allowed','invalid_host','port_not_allowed','unsafe_destination'].includes(code) ? 'Enter a valid public HTTPS website.'
            : code === 'empty_content' ? 'No usable information found. You can fill in your Brand Profile manually.' : 'Website analysis failed. Retry or continue manually.';
          state.message = errorText(result.response, fallback); return false;
        }
        const suggestions = filteredSuggestions(result.payload?.suggestions);
        if (!Object.values(suggestions).some(meaningful)) { state.proposals = {}; state.analysis = 'No usable information found'; state.message = 'No usable information found. You can fill in your Brand Profile manually.'; }
        else {
          state.proposals = suggestions; state.analysis = 'Review website suggestions'; state.section = 5;
          // Filling an empty local draft is never a save or a replacement of confirmed data.
          if (!Object.keys(FIELDS).some(key => meaningful(state.core[key]))) {
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
        const core = clone(state.core);
        if (object(core.brandAssets) || domain) core.brandAssets = { ...(object(core.brandAssets) ? core.brandAssets : {}), domain };
        const revision = state.brand.revision;
        const result = await jsonRequest(`/api/brands/${state.brand.id}`, 'PUT', { name, brand_core: core, revision });
        if (!result) return false;
        if (!result.response.ok) { state.message = errorText(result.response, 'The save was not confirmed. Your inputs are retained. Retry safely.'); return false; }
        const brand = result.payload;
        if (!validateBrand(brand, state.brand.id) || brand.revision !== revision + 1 || brand.name !== name
          || stable(brand.brand_core) !== stable(core)) { state.message = 'The save response could not be verified. Your inputs are retained.'; return false; }
        state.brand = brand; state.name = name; state.core = clone(core); state.dirty = false;
        state.message = 'Brand Profile saved';
        onSave(brand); return true;
      });
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
            : errorText(result.response, 'Logo upload failed. Your file is retained. Retry the upload.');
          return false;
        }
        const logo = result.payload?.logo;
        if (result.payload?.contract !== 'brand_logo_v1' || result.payload.request_id !== requestId || !logo
          || logo.logo_revision !== revision + 1 || logo.logo_url !== `/api/brands/${state.brand.id}/logo?revision=${logo.logo_revision}`) {
          state.message = 'The logo save could not be verified. Retry or reload the latest Brand.'; return false;
        }
        state.brand = { ...state.brand, ...logo, logo_source: logo.source };
        state.logo = 'Logo saved'; state.message = 'Logo saved'; state.candidate = null;
        state.file = null; state.fileData = null; onLogo(state.brand.id, logo); return true;
      });
    }
    function upload() {
      if (!state.fileData) { state.message = 'Choose a logo file first.'; changed(); return Promise.resolve(false); }
      return logoMutation('upload', { image_base64: state.fileData.base64, mime_type: state.fileData.mime });
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
      state.file = file; state.fileData = null; state.pending = 'Reading logo…'; changed();
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
        state.brand = brand; state.readOnly = brand.access.canEditCanonicalBrand !== true || !['owner','admin','editor'].includes(brand.access.role);
        state.message = 'Latest Brand loaded. Your unsaved inputs are retained; review them before saving.';
        onSave(brand); return true;
      });
    }
    return { state, current, analyze, save, upload, useLogo, chooseFile, applyProposal, reload,
      subscribe(fn) { notify = fn; }, invalidate() { alive = false; state.file = null; state.fileData = null; state.candidate = null; state.proposals = {}; state.core = {}; state.website = ''; state.name = ''; },
      dirty() { return state.dirty; }, busy() { return !!state.pending; } };
  }

  function mount(container, options) {
    const session = createSession(options), s = session.state, doc = container.ownerDocument;
    let fileInput = null;
    const t = key => root.FunklixLanguage.t(key, options.language());
    function node(tag, text, parent) { const n = doc.createElement(tag); if (text) n.textContent = text; if (parent) parent.append(n); return n; }
    function button(key, parent, action, id = key) {
      const b = node('button', t(key), parent); b.type = 'button'; b.dataset.profileKey = id;
      if (key === 'Continue to project' || (key === 'Confirm and save Brand Profile' && s.section !== 5)) b.className = 'fk-btn fk-btn-primary';
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
      else if (object(value)) { Object.entries(value).forEach(([key, item]) => { if (meaningful(item)) { const line = node('div', '', parent); if (['name', 'note', 'description', 'benefit', 'evidence', 'good', 'avoid', 'dos', 'donts'].includes(key)) node('strong', t({ name: 'Name', note: 'Description', description: 'Description', benefit: 'Benefit', evidence: 'Evidence', good: 'Good example', avoid: 'Avoid', dos: 'Do', donts: 'Avoid' }[key]), line); readable(item, line); } }); }
      else if (meaningful(value)) node('p', String(value), parent);
    }
    function fields(section, parent) {
      let count = 0;
      for (const [key, [group, label, type]] of Object.entries(FIELDS)) {
        if (group !== section) continue;
        count++;
        if (type === 'personas') {
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
      const modules = section === 'Foundation' ? ['mission', 'vision', 'values'] : section === 'Audience' ? ['audience', 'icp'] : section === 'Offers & Proof' ? ['product_knowledge', 'business_plan', 'pitch_deck', 'whitepaper'] : [];
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
      const upload = button('Upload logo', parent, () => { void session.upload(); }); upload.disabled ||= !s.fileData;
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
        logo(section);
      } else if (s.section === 5) {
        const list = node('ul', '', section);
        for (const key of SECTIONS.slice(0, 5)) {
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
      } else fields(SECTIONS[s.section], section);
      const feedback = node('p', t(s.pending || s.message), container); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
      const actions = node('div', '', container); actions.className = 'profile-actions';
      if (!s.readOnly) {
        button('Confirm and save Brand Profile', actions, () => { void session.save(); });
        button('Reload latest Brand', actions, () => { void session.reload(); });
      }
      if (s.section === 5) button(options.hasProject() ? 'Continue to project' : 'Back', actions, async () => {
        if (s.dirty && !s.readOnly && !await session.save()) return;
        if (!session.current()) return;
        s.returning = true; render();
        try { await options.onContinue(); } finally { s.returning = false; if (session.current()) render(); }
      });
      button('Advanced options', actions, () => options.onAdvanced(session));
      if (focused) [...container.querySelectorAll('[data-profile-key]')].find(n => n.dataset.profileKey === focused)?.focus();
    }
    session.subscribe(render); render();
    return { ...session, render, invalidate() { session.invalidate(); options.onBusy?.(false); } };
  }
  return Object.freeze({ SECTIONS, FIELDS, meaningful, website, filteredSuggestions, validCandidate, createSession, mount });
}));
