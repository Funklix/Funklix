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
      // Never use Canvas/default timestamps, collection names or Brand IDs.
      const time = typeof item?.updated_at === 'string' && item.updated_at.trim() ? Date.parse(item.updated_at) : NaN;
      if (typeof item?.id === 'string') dates.set(item.id, {
        ...(Number.isFinite(time) ? { time, savedAt: item.updated_at } : {}),
        unassigned: item.unassigned === true
      });
    }
    const boards = (workspace?.boards || []).filter(b => filter !== 'brand' || (brand && b.brand_id === brand.id))
      .map((board, index) => ({ ...board, brand: workspace.brands.find(b => b.id === board.brand_id) || null,
        active: board.id === context.boardId, index, ...dates.get(board.id) }))
      .map(board => ({ ...board, group: !brand ? 'neutral' : board.brand?.id === brand.id ? 'connected' : board.brand ? 'other' : 'unassociated' }))
      .sort((a, b) => (brand ? ['connected', 'other', 'unassociated'].indexOf(a.group) - ['connected', 'other', 'unassociated'].indexOf(b.group) : 0)
        || (b.time ?? -Infinity) - (a.time ?? -Infinity) || a.index - b.index);
    return { ready, workspace, brand, boards, partial: boards.some(b => !b.savedAt),
      canCreate: Boolean(workspace && (['owner', 'admin'].includes(workspace.role)
        || workspace.brands.some(b => ['owner', 'admin', 'editor'].includes(b.role)))) };
  }

  // Both surfaces consume the same access-safe projection. No association or
  // canonical Core is inferred from navigation preference or collection data.
  function renderContextNotice(host, context, t, actions) {
    const m = model(context), open = context.openBoard;
    const boardBrand = m.workspace?.brands.find(b => b.id === open?.brandId);
    const visible = Boolean(m.brand && open && (!boardBrand || boardBrand.id !== m.brand.id));
    const focus = host.contains(host.ownerDocument.activeElement) ? host.ownerDocument.activeElement.dataset.contextAction : null;
    host.hidden = !visible; host.replaceChildren();
    if (!visible) return;
    host.className = 'brand-board-context-notice';
    const p = host.ownerDocument.createElement('p'); p.setAttribute('role', 'status');
    const template = boardBrand ? 'Viewing {selected}. Your open Campaign Canvas belongs to {brand}.'
      : open.unassigned ? 'Viewing {selected}. Your open Campaign Canvas has no Brand connected.'
      : 'Viewing {selected}. The Brand association of your open Campaign Canvas is not available.';
    p.textContent = t(template).replace(/\{(selected|brand)\}/g, (_, key) => key === 'selected' ? m.brand.name : boardBrand?.name || '');
    const board = host.ownerDocument.createElement('span'); board.textContent = `${t('Currently open')}: ${open.name}`;
    const controls = host.ownerDocument.createElement('div');
    for (const [label, key] of [[open.canEdit === false ? 'Continue viewing the open Board' : 'Continue editing the open Board', 'continue'], ['Open Boards for selected Brand', 'boards'], ['Open selected Brand Profile', 'profile']]) {
      const button = host.ownerDocument.createElement('button'); button.type = 'button'; button.className = 'fk-btn fk-btn-secondary';
      button.textContent = t(label); button.dataset.contextAction = key;
      button.addEventListener('click', () => actions[key](m.brand)); controls.append(button);
    }
    host.append(p, board, controls);
    if (focus) host.querySelector(`[data-context-action="${focus}"]`)?.focus({ preventScroll: true });
  }

  function sameScope(a, b) {
    return a.account === b.account && a.catalog === b.catalog && a.identity === b.identity && a.status === b.status
      && a.generation === b.generation && a.workspaceId === b.workspaceId && a.brandId === b.brandId
      && a.boardId === b.boardId && a.boardGeneration === b.boardGeneration && a.view === b.view
      && a.publicToken === b.publicToken;
  }

  // The existing library endpoint independently checks active application identity
  // and Brand ACL. Its aggregate counts cover all pages, not just these rows.
  function learningSummary(payload, brandId) {
    if (payload?.contract !== 'brand_learnings_v1' || payload.brand?.id !== brandId
      || !Array.isArray(payload.learnings) || typeof payload.can_write !== 'boolean'
      || !payload.counts || typeof payload.counts !== 'object' || Array.isArray(payload.counts)) return null;
    // GROUP BY omits statuses with no rows; a present, valid aggregate is sparse.
    const count = key => !Object.hasOwn(payload.counts, key) ? 0
      : Number.isSafeInteger(payload.counts[key]) && payload.counts[key] >= 0 ? payload.counts[key] : null;
    return { proposed: count('proposed'), approved: count('approved'), canWrite: payload.can_write };
  }

  function responsibilitySummary(context) {
    const m = model(context), runtime = context.responsibilities;
    if (!m.workspace || context.loading || !context.openBoard || !runtime
      || runtime.boardId !== context.boardId || runtime.generation !== context.boardGeneration) return null;
    const email = value => typeof value === 'string' ? value.trim().toLowerCase() : '';
    const mine = email(context.account.email);
    const seen = new Set(), duplicates = new Set();
    for (const n of runtime.nodes) { if (seen.has(n.id)) duplicates.add(n.id); seen.add(n.id); }
    const items = runtime.nodes.filter(n => n.id && !duplicates.has(n.id) && n.assigned && !n.complete);
    return { items, mine: items.filter(n => email(n.ownerEmail) && email(n.ownerEmail) === mine).length,
      canEdit: context.openBoard.canEdit === true, dirty: runtime.dirty,
      brand: m.workspace.brands.find(b => b.id === context.openBoard.brandId) || null };
  }

  function create({ host, context, text: t = s => s, actions, fetchImpl = root.fetch.bind(root) }) {
    let scope = null, request = null, rows = [], status = 'idle', filter = 'all', disposed = false;
    let learningRequest = null, learning = null, learningStatus = 'idle', runtimeKey = '';
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
    function intelligence(c, m) {
      const grid = node('div', 'home-intelligence');
      const brandCard = node('section', 'home-intelligence-card'); brandCard.dataset.homeModule = 'brand';
      const title = node('h2', '', t('Brand Intelligence')); title.id = 'home-intelligence-title';
      brandCard.setAttribute('aria-labelledby', title.id); brandCard.append(title);
      brandCard.append(node('p', 'home-note', t('Selected Brand')));
      if (!m.brand) brandCard.append(node('p', '', t('Select a Brand to see its Learning review availability.')));
      else if (learningStatus !== 'ready') {
        // Do not show identity/availability from a Board or a failed Learning read.
        const notice = node('p', 'home-note', t(learningStatus === 'denied' ? 'Brand Learning access could not be confirmed.'
          : learningStatus === 'error' ? 'Brand Learnings unavailable. Try again.' : 'Checking Brand Learning access…'));
        notice.setAttribute('role', 'status'); brandCard.append(notice);
        const retry = ['error', 'denied'].includes(learningStatus);
        const control = button(retry ? 'Retry Brand Learnings' : 'Checking Brand Learning access…', retry ? 'learnings-retry' : 'learnings', m.brand.id);
        control.dataset.homeFocus = 'learnings:' + m.brand.id;
        // Keep the native focus target mounted while counts are reauthorized.
        // Delegation below accepts navigation only after a successful read.
        if (!retry) control.setAttribute('aria-disabled', 'true');
        brandCard.append(control);
      } else {
        const name = node('div', 'home-module-identity'); name.append(identity(m.brand), node('h3', '', m.brand.name)); brandCard.append(name);
        const counts = node('dl', 'home-module-counts');
        for (const [label, value] of [['Awaiting Review', learning.proposed], ['Approved Knowledge', learning.approved]]) {
          const group = node('div'); group.append(node('dt', '', t(label)), node('dd', '', value === null ? t('Unavailable') : String(value))); counts.append(group);
        }
        brandCard.append(counts);
        if (learning.proposed === 0) brandCard.append(node('p', 'home-note', t('No proposals awaiting review.')));
        brandCard.append(node('p', 'home-note', t('Approved Learnings are human-reviewed supplementary Brand knowledge.')));
        brandCard.append(node('p', 'home-note', t(learning.canWrite ? 'Human review is available in Brand Profile.' : 'You can view Learnings. Your access is read-only.')));
        brandCard.append(button(learning.canWrite ? 'Review Brand Learnings' : 'View Brand Learnings', 'learnings', m.brand.id));
      }
      const boardCard = node('section', 'home-intelligence-card'); boardCard.dataset.homeModule = 'responsibilities';
      const heading = node('h2', '', t('Team Responsibilities')); heading.id = 'home-responsibilities-title';
      boardCard.setAttribute('aria-labelledby', heading.id); boardCard.append(heading, node('p', 'home-note', t('Current Board')));
      const summary = responsibilitySummary(c);
      if (!summary) {
        boardCard.append(node('p', '', t(c.loading ? 'Responsibilities will appear when Board loading finishes.' : 'Open a Board to see its responsibilities.')));
        boardCard.append(button('Browse Boards', 'boards'));
      } else {
        boardCard.append(node('h3', '', t('Responsibilities in {board}').replace('{board}', c.openBoard.name)
          + ' · ' + (summary.brand?.name || t(c.openBoard.unassigned ? 'No Brand connected' : 'No visible Brand association'))));
        boardCard.append(node('p', 'home-note', t(summary.dirty ? 'Live Canvas · includes unsaved changes' : 'Current loaded Canvas')));
        if (!summary.canEdit) boardCard.append(node('p', 'home-note', t('View-only Board')));
        const counts = node('dl', 'home-module-counts');
        for (const [label, value] of [['Assigned to You', summary.mine], ['Incomplete Responsibilities', summary.items.length]]) {
          const group = node('div'); group.append(node('dt', '', t(label)), node('dd', '', String(value))); counts.append(group);
        }
        boardCard.append(counts);
        if (!summary.items.length) boardCard.append(node('p', 'home-note', t('No incomplete assigned nodes in this Board.')));
        const list = node('ul', 'home-responsibility-list');
        // Stable Canvas ordering; no invented priority or urgency ranking.
        for (const item of summary.items.slice(0, 3)) {
          const row = node('li'), label = item.title || t(item.type);
          if (/^[\w.:-]+$/.test(item.id)) {
            const open = button('', 'responsibility-node', item.id); open.className = 'home-responsibility-open'; open.textContent = label;
            open.setAttribute('aria-label', `${t('Show on Canvas')}: ${label}`); row.append(open);
          } else row.append(node('strong', '', label));
          row.append(node('span', 'home-note', t(item.status)));
          list.append(row);
        }
        boardCard.append(list, button('Open Responsibilities', 'responsibilities'));
      }
      grid.append(brandCard, boardCard); return grid;
    }
    function draw() {
      const c = context(), m = model(c, rows, filter);
      const focused = host.contains(doc.activeElement) ? doc.activeElement.dataset.homeFocus : null;
      const focusedContext = host.contains(doc.activeElement) ? doc.activeElement.dataset.contextAction : null;
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
      const contextNotice = node('aside'); contextNotice.dataset.homeContext = 'true';
      renderContextNotice(contextNotice, c, t, { continue: () => actions.board(c.boardId), boards: actions.brandBoards, profile: actions.profile });
      host.append(contextNotice, intelligence(c, m));
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
        let group = null;
        for (const board of m.boards) {
          if (m.brand && board.group !== group) {
            group = board.group;
            const heading = node('li', 'home-board-group-heading');
            heading.setAttribute('role', 'presentation');
            heading.append(node('h3', '', t(group === 'connected' ? 'Connected Boards' : group === 'other' ? 'Other Boards' : 'Boards without a visible Brand')));
            list.append(heading);
          }
          const card = node('li', 'home-board-card'); card.classList.toggle('is-current', board.active);
          const mark = node('div', 'home-board-mark'); mark.append(identity(board.brand || { name: board.name }));
          mark.append(node('span', 'home-eyebrow', t(board.active ? 'Currently open' : 'SAVED BOARD'))); card.append(mark);
          card.append(node('h3', '', board.name));
          const distinction = board.group === 'connected' ? 'Connected Board' : board.group === 'other' ? 'Other Brand Board' : '';
          if (distinction) card.append(node('span', 'home-board-group', t(distinction)));
          card.append(node('p', 'home-board-brand', board.brand?.name || t(board.unassigned ? 'No Brand connected' : 'No visible Brand association')));
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
      if (focusedContext) contextNotice.querySelector(`[data-context-action="${focusedContext}"]`)?.focus({ preventScroll: true });
    }
    function invalidateLearnings() { learningRequest?.controller.abort(); learningRequest = null; learning = null; learningStatus = 'idle'; }
    function invalidate() { request?.controller.abort(); request = null; rows = []; status = 'idle'; invalidateLearnings(); }
    function sync() {
      if (disposed) return;
      const next = context();
      if (!scope || !sameScope(scope, next)) { invalidate(); filter = 'all'; scope = next; }
      if (next.view !== 'home') { host.replaceChildren(); return; }
      draw();
      if (model(next).workspace && status === 'idle') void load();
      if (model(next).brand && learningStatus === 'idle') void loadLearnings();
    }
    async function loadLearnings() {
      const current = context(), brand = model(current).brand;
      if (!brand || current.view !== 'home' || learningRequest || disposed) return;
      const token = { controller: new AbortController() }; learningRequest = token;
      learning = null; learningStatus = 'loading'; draw();
      const timer = root.setTimeout(() => token.controller.abort(), 12000);
      try {
        // One bounded page only. Never fetch successive pages to compute counts.
        const response = await fetchImpl(`/api/brands/${encodeURIComponent(brand.id)}/learnings?status=all&offset=0`, {
          credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: token.controller.signal });
        if (learningRequest !== token || !sameScope(current, context())) return;
        if ([401, 403, 404].includes(response.status)) { learningStatus = 'denied'; return; }
        const payload = await response.json();
        if (learningRequest !== token || !sameScope(current, context())) return;
        const summary = response.ok && learningSummary(payload, brand.id);
        if (!summary) throw new Error('Learning summary unavailable');
        learning = summary; learningStatus = 'ready';
      } catch (_) {
        if (learningRequest === token && sameScope(current, context())) { learning = null; learningStatus = 'error'; }
      } finally {
        root.clearTimeout(timer);
        if (learningRequest === token) { learningRequest = null; if (sameScope(current, context())) draw(); }
      }
    }
    function refreshLearnings(event) {
      const c = context();
      if (disposed || c.view !== 'home' || doc.visibilityState === 'hidden'
        || (event?.detail?.brandId && event.detail.brandId !== c.brandId)) return;
      invalidateLearnings(); sync();
    }
    root.addEventListener?.('focus', refreshLearnings);
    root.addEventListener?.('funklix:brand-learnings-changed', refreshLearnings);
    const resume = () => { if (doc.visibilityState === 'visible') refreshLearnings(); };
    doc.addEventListener('visibilitychange', resume);
    // Local presentation only: observe replacement/deletion, permission and dirty
    // runtime changes even when another existing editor does not emit a Home event.
    // This does not fetch, serialize for saving, or mutate Canvas state.
    const runtimeTimer = root.setInterval(() => {
      const c = context();
      if (c.view !== 'home') return;
      const key = JSON.stringify([c.openBoard, c.responsibilities, c.loading]);
      if (!scope || !sameScope(scope, c) || key !== runtimeKey) { runtimeKey = key; sync(); }
    }, 1000);
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
        rows = payload.boards.filter(b => allowed.has(b?.id)).map(b => ({ id: b.id, updated_at: b.updated_at,
          unassigned: b.brand_visibility !== 'hidden' && Object.hasOwn(b, 'brand_id') && b.brand_id === null })); status = 'ready';
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
        if (action === 'learnings-retry') { invalidateLearnings(); void loadLearnings(); }
        else if (action === 'learnings' && m.brand?.id === id && learningStatus === 'ready') actions.learnings({ ...m.brand, workspace_id: m.workspace.id, section: 'Brand Learnings' });
        else if (action === 'responsibility-node' && /^[\w.:-]+$/.test(id) && responsibilitySummary(c)?.items.some(n => n.id === id)) actions.node(id);
        else if (action === 'responsibilities' && responsibilitySummary(c)) actions.responsibilities(() => host.querySelector('[data-home-action="responsibilities"]'));
        else if (action === 'metadata') { status = 'idle'; void load(); }
        else if (action === 'brand' && m.workspace.brands.some(b => b.id === id)) actions.brand(id);
        else if (action === 'profile') { const brand = m.workspace.brands.find(b => b.id === id); if (brand) actions.profile(brand); }
        else if (action === 'board' && !c.loading && m.workspace.boards.some(b => b.id === id)) actions.board(id);
        else if (action === 'all' || action === 'filtered') { filter = action === 'all' ? 'all' : 'brand'; draw(); }
        else if (action === 'create' && m.canCreate) actions.create();
        else if (action === 'boards') actions.boards();
        else if (action === 'brands') actions.brands();
      }
    });
    return Object.freeze({ sync, dispose() { disposed = true; invalidate(); root.clearInterval(runtimeTimer); root.removeEventListener?.('focus', refreshLearnings); root.removeEventListener?.('funklix:brand-learnings-changed', refreshLearnings); doc.removeEventListener('visibilitychange', resume); host.replaceChildren(); } });
  }
  root.FunklixHomeFoundation = Object.freeze({ model, sameScope, learningSummary, responsibilitySummary, renderContextNotice, create });
  if (typeof module === 'object' && module.exports) module.exports = root.FunklixHomeFoundation;
}(typeof globalThis !== 'undefined' ? globalThis : window));
