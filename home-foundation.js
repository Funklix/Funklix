(function (root) {
  'use strict';

  // Read-only composition. Catalog identities authorize presentation; opening a
  // Board still goes through the application's existing navigation and loader.
  function model(context, metadata = [], filter = 'all') {
    const catalog = context.catalog;
    const ready = Boolean(context.account?.email && !context.publicToken && context.status === 'ready'
      && context.identity === context.account.email.trim().toLowerCase());
    const workspace = ready ? catalog?.workspaces.find(w => w.id === context.workspaceId) : null;
    const brand = workspace?.brands.find(b => b.id === context.brandId) || null;
    const dates = new Map();
    for (const item of metadata) {
      // Never use Canvas/default timestamps, collection names or associations.
      const time = typeof item?.updated_at === 'string' && item.updated_at.trim() ? Date.parse(item.updated_at) : NaN;
      if (typeof item?.id === 'string' && Number.isFinite(time)) dates.set(item.id, { time, savedAt: item.updated_at });
    }
    const boards = (workspace?.boards || []).filter(b => filter !== 'brand' || (brand && b.brand_id === brand.id))
      .map((board, index) => ({ ...board, brand: workspace.brands.find(b => b.id === board.brand_id) || null,
        active: board.id === context.boardId, index, ...dates.get(board.id) }))
      .sort((a, b) => Number(b.active) - Number(a.active) || (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index);
    return { ready, workspace, brand, boards, partial: boards.some(b => !b.savedAt),
      canCreate: Boolean(workspace && (['owner', 'admin'].includes(workspace.role)
        || workspace.brands.some(b => ['owner', 'admin', 'editor'].includes(b.role)))) };
  }

  function sameScope(a, b) {
    return a.account === b.account && a.catalog === b.catalog && a.identity === b.identity && a.status === b.status
      && a.generation === b.generation && a.workspaceId === b.workspaceId && a.brandId === b.brandId
      && a.boardId === b.boardId && a.boardGeneration === b.boardGeneration && a.view === b.view
      && a.publicToken === b.publicToken;
  }

  function create({ host, context, text: t = s => s, actions, fetchImpl = root.fetch.bind(root) }) {
    let scope = null, request = null, rows = [], status = 'idle', filter = 'all', disposed = false;
    const doc = host.ownerDocument;
    function node(tag, className, value) {
      const element = doc.createElement(tag);
      if (className) element.className = className;
      if (value != null) element.textContent = value;
      return element;
    }
    function button(label, action, id = '') {
      const element = node('button', 'fk-btn fk-btn-secondary', t(label));
      element.type = 'button'; element.dataset.homeAction = action; element.dataset.homeId = id;
      element.dataset.homeFocus = action + ':' + id;
      return element;
    }
    function identity(item, workspace = false) {
      const avatar = node('span', 'home-identity'); avatar.setAttribute('aria-hidden', 'true');
      if (!workspace && root.FunklixBrandLogo) root.FunklixBrandLogo.render(avatar, item);
      else {
        avatar.textContent = root.FunklixBrandLogo?.initials(item.name) || Array.from(item.name || 'W')[0];
        if (typeof item.avatar_url === 'string' && /^https?:\/\//i.test(item.avatar_url)) {
          const image = node('img'); image.alt = ''; image.referrerPolicy = 'no-referrer';
          image.addEventListener('error', () => image.remove(), { once: true }); image.src = item.avatar_url; avatar.append(image);
        }
      }
      return avatar;
    }
    function message(title, description, action) {
      const box = node('div', 'home-empty'); box.append(node('h3', '', t(title)), node('p', '', t(description)));
      if (action) box.append(action); return box;
    }
    function draw() {
      const c = context(), m = model(c, rows, filter);
      const focused = host.contains(doc.activeElement) ? doc.activeElement.dataset.homeFocus : null;
      host.replaceChildren(); host.setAttribute('aria-busy', String(status === 'loading' || ['idle', 'loading', 'refreshing'].includes(c.status) && !!c.account));
      const hero = node('header', 'home-hero');
      const copy = node('div', 'home-hero-copy');
      copy.append(node('span', 'home-eyebrow', t('YOUR CREATIVE WORKSPACE')),
        node('h1', '', m.workspace?.name || t('A home for your next idea.')),
        node('p', 'home-intro', t('Find your Brand. Pick up a Board. Make something that matters.')));
      hero.append(copy);
      if (m.workspace) hero.prepend(identity(m.workspace, true));
      host.append(hero);
      if (!c.account?.email || c.publicToken) {
        host.append(message('Welcome to Tendra One', 'Sign in to see your Workspaces and saved Boards.', button('Sign in', 'signin'))); return;
      }
      if (!m.ready) {
        const pending = ['idle', 'loading', 'refreshing'].includes(c.status);
        host.append(message(pending ? 'Finding your Workspace…' : 'Workspace catalog unavailable', pending
          ? 'Your accessible Brands and Boards will appear here.' : 'Your access could not be confirmed. Try again to load your Workspace.', pending ? null : button('Retry', 'retry'))); return;
      }
      const nav = node('div', 'home-context');
      const label = node('label', '', t('Workspace')); label.htmlFor = 'home-workspace-select';
      const select = node('select'); select.id = 'home-workspace-select'; select.dataset.homeFocus = 'workspace';
      const placeholder = node('option', '', t('Choose a Workspace')); placeholder.value = ''; placeholder.disabled = true; select.append(placeholder);
      for (const w of c.catalog.workspaces) { const option = node('option', '', w.name); option.value = w.id; select.append(option); }
      select.value = m.workspace?.id || '';
      select.addEventListener('change', () => {
        const id = select.value;
        // Keep the confirmed context visible while leave/access checks run.
        select.value = model(context()).workspace?.id || '';
        if (model(context()).ready) void actions.workspace(id);
      });
      if (c.catalog.workspaces.length) { nav.append(label, select, button('Create Workspace', 'workspace-create')); host.append(nav); }
      if (!m.workspace) {
        host.append(message(c.catalog.workspaces.length ? 'Choose your working context' : 'Your first Workspace starts here',
          c.catalog.workspaces.length ? 'Choose a Workspace to see the Brands and Boards available to you.' : 'Create a Workspace to bring your Brands and campaign work together.',
          c.catalog.workspaces.length ? null : button('Create Workspace', 'workspace-create'))); return;
      }
      const orientation = node('section', 'home-brands'); orientation.setAttribute('aria-labelledby', 'home-brands-title');
      const heading = node('div', 'home-section-heading'); const title = node('h2', '', t('Brands in your Workspace')); title.id = 'home-brands-title';
      heading.append(title, node('p', '', `${m.workspace.brands.length} ${t('Brands visible to you')} · ${m.workspace.boards.length} ${t('Boards visible to you')}`));
      orientation.append(heading);
      if (!m.workspace.brands.length) orientation.append(message('Room for your first Brand', 'Only Brands you can access appear here.',
        ['owner', 'admin'].includes(m.workspace.role) ? button('Manage Brands', 'brands') : null));
      else {
        const list = node('ul', 'home-brand-list');
        for (const brand of m.workspace.brands) {
          const item = node('li', 'home-brand-card'); item.classList.toggle('is-selected', brand.id === m.brand?.id);
          const pick = button(brand.name, 'brand', brand.id); pick.className = 'home-brand-pick';
          pick.textContent = brand.name;
          pick.setAttribute('aria-pressed', String(brand.id === m.brand?.id));
          pick.prepend(identity(brand));
          const profile = button('Brand Profile', 'profile', brand.id); profile.setAttribute('aria-label', `${t('Brand Profile')}: ${brand.name}`);
          item.append(pick, profile); list.append(item);
        }
        orientation.append(list);
        orientation.append(node('p', 'home-note', t(c.boardId ? 'Select a Brand for navigation. The open Board keeps its saved Brand association.' : 'Select a Brand for context, or explore all visible Boards below.')));
      }
      host.append(orientation);
      const section = node('section', 'home-continue'); section.setAttribute('aria-labelledby', 'home-continue-title');
      const top = node('div', 'home-section-heading'); const h2 = node('h2', '', t('Continue Working')); h2.id = 'home-continue-title';
      const controls = node('div', 'home-actions'); controls.append(button('Browse Boards', 'boards'));
      if (m.canCreate) { const add = button('Create project', 'create'); add.className = 'fk-btn fk-btn-primary'; controls.append(add); }
      top.append(h2, controls); section.append(top);
      if (m.brand) {
        const filters = node('div', 'home-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', t('Filter Boards'));
        const all = button('All visible Boards', 'all'), selected = button(m.brand.name, 'filtered');
        selected.textContent = m.brand.name;
        all.setAttribute('aria-pressed', String(filter === 'all')); selected.setAttribute('aria-pressed', String(filter === 'brand')); filters.append(all, selected); section.append(filters);
      }
      let notice = status === 'loading' ? 'Loading saved modification times…' : status === 'error'
        ? 'Saved modification times are unavailable. Your authorized Board links are still available.'
        : 'Ordered by saved modification time where available. The Board collection may be incomplete; this is not a history of your visits.';
      const note = node('p', 'home-note', t(notice)); note.setAttribute('role', 'status'); section.append(note);
      if (status === 'error') section.append(button('Retry modification times', 'metadata'));
      if (!m.boards.length) section.append(message(filter === 'brand' ? 'No saved Boards for this Brand' : 'A fresh canvas for your next campaign',
        'Saved Boards available to you in this Workspace will appear here.', m.canCreate ? button('Create project', 'create') : button('Browse Boards', 'boards')));
      else {
        const list = node('ul', 'home-board-list');
        for (const board of m.boards) {
          const card = node('li', 'home-board-card'); card.classList.toggle('is-current', board.active);
          const mark = node('div', 'home-board-mark'); mark.append(identity(board.brand || { name: board.name }));
          mark.append(node('span', 'home-eyebrow', t(board.active ? 'CURRENT BOARD' : 'SAVED BOARD'))); card.append(mark);
          card.append(node('h3', '', board.name));
          card.append(node('p', 'home-board-brand', board.brand?.name || t('No visible Brand association')));
          const saved = node('p', 'home-board-date');
          if (board.savedAt) { const time = node('time', '', new Intl.DateTimeFormat(c.language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(board.time))); time.dateTime = board.savedAt; saved.append(t('Last edited') + ' ', time); }
          else saved.textContent = t('Modification time unavailable');
          card.append(saved);
          if (board.role === 'viewer') card.append(node('span', 'home-note', t('View-only Board')));
          const open = button(board.active ? 'Continue' : 'Open Board', 'board', board.id);
          open.classList.add('home-board-open'); open.setAttribute('aria-label', `${t(board.active ? 'Continue' : 'Open Board')}: ${board.name}`);
          open.disabled = Boolean(c.loading); card.append(open); list.append(card);
        }
        section.append(list);
      }
      if (c.loading) section.append(node('p', 'home-note', t('A Board is loading. Please wait before opening another.')));
      host.append(section);
      if (focused) Array.from(host.querySelectorAll('[data-home-focus]')).find(e => e.dataset.homeFocus === focused)?.focus({ preventScroll: true });
    }
    function invalidate() { request?.controller.abort(); request = null; rows = []; status = 'idle'; }
    function sync() {
      if (disposed) return;
      const next = context();
      if (!scope || !sameScope(scope, next)) { invalidate(); filter = 'all'; scope = next; }
      if (next.view !== 'home') { host.replaceChildren(); return; }
      draw();
      if (model(next).workspace && status === 'idle') void load();
    }
    async function load() {
      const current = context();
      if (!model(current).workspace || current.view !== 'home' || request) return;
      const token = { controller: new AbortController(), context: current }; request = token; status = 'loading'; draw();
      try {
        const response = await fetchImpl('/api/boards', { credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: token.controller.signal });
        if (request !== token || !sameScope(current, context())) return;
        if ([401, 403].includes(response.status)) { invalidate(); host.replaceChildren(); actions.accessLost(); return; }
        const payload = await response.json();
        if (request !== token || !sameScope(current, context())) return;
        if (!response.ok || !Array.isArray(payload?.boards)) throw new Error('Board metadata unavailable');
        // Retain only permitted IDs and valid saved dates, never collection Core,
        // names, ownership, Canvas JSON or hidden Brand display projections.
        const allowed = new Set(model(current).workspace.boards.map(b => b.id));
        rows = payload.boards.filter(b => allowed.has(b?.id)).map(b => ({ id: b.id, updated_at: b.updated_at })); status = 'ready';
      } catch (error) {
        if (request !== token || !sameScope(current, context()) || error.name === 'AbortError') return;
        rows = []; status = 'error';
      } finally { if (request === token) { request = null; if (sameScope(current, context())) draw(); } }
    }
    host.addEventListener('click', event => {
      const target = event.target.closest('[data-home-action]'); if (!target || target.disabled) return;
      const c = context(), m = model(c, rows, filter), action = target.dataset.homeAction, id = target.dataset.homeId;
      if (!sameScope(scope, c)) { sync(); return; }
      if (action === 'signin') actions.signin();
      else if (action === 'retry') actions.retry();
      else if (m.ready && action === 'workspace-create') actions.workspaceCreate(target);
      else if (m.workspace) {
        if (action === 'metadata') { status = 'idle'; void load(); }
        else if (action === 'brand' && m.workspace.brands.some(b => b.id === id)) actions.brand(id);
        else if (action === 'profile') { const brand = m.workspace.brands.find(b => b.id === id); if (brand) actions.profile(brand); }
        else if (action === 'board' && !c.loading && m.workspace.boards.some(b => b.id === id)) actions.board(id);
        else if (action === 'all' || action === 'filtered') { filter = action === 'all' ? 'all' : 'brand'; draw(); }
        else if (action === 'create' && m.canCreate) actions.create();
        else if (action === 'boards') actions.boards();
        else if (action === 'brands') actions.brands();
      }
    });
    return Object.freeze({ sync, dispose() { disposed = true; invalidate(); host.replaceChildren(); } });
  }
  root.FunklixHomeFoundation = Object.freeze({ model, sameScope, create });
  if (typeof module === 'object' && module.exports) module.exports = root.FunklixHomeFoundation;
}(typeof globalThis !== 'undefined' ? globalThis : window));
