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

  // Hero choice is independent of the detailed list/filter. Catalog membership
  // still authorizes identity; current-work preference requires full hydration.
  function heroContinuation(context, metadata = []) {
    const m = model(context, metadata);
    const saved = !context.loading && context.openBoard && m.boards.find(b => b.id === context.boardId);
    // Hydrated association can be newer than catalog membership. Resolve only
    // against visible catalog Brands, never against the Board's Core/snapshot.
    const current = saved && { ...saved, brand: m.workspace.brands.find(b => b.id === context.openBoard.brandId) || null,
      unassigned: context.openBoard.unassigned === true };
    return (current && m.brand && current.brand?.id === m.brand.id ? current : null)
      || m.boards.find(b => m.brand && (b.id === current?.id ? current.brand?.id : b.brand?.id) === m.brand.id) || current || m.boards[0] || null;
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
    const boardActionContexts = new WeakMap();
    const actionScopes = new WeakMap();
    let expanded = false, expansionIdentity = '', renderScope = null;
    function placed(label, action, id, placement) {
      const b = button(label, placement + '-' + action, id);
      boardActionContexts.set(b, { scope: renderScope, key: renderScope.campaign?.key });
      return b;
    }
    function overlayRects() {
      return Array.from(doc.querySelectorAll('.sidebar, .sidebar > .workspace-context'))
        .filter(e => root.getComputedStyle(e).position === 'fixed' && e.getClientRects().length)
        .map(e => e.getBoundingClientRect()).filter(r => r.width && r.height);
    }
    function updateClearance() {
      const occupied = overlayRects();
      const clearance = Math.max(24, ...occupied.map(r => root.innerHeight - r.top + 16));
      const dashboard = host.closest('#dashboard-view');
      if (!dashboard) return;
      dashboard.style.setProperty('--home-overlay-clearance', clearance + 'px');
      // Keep Home's scroll viewport above both the mobile nav and floating
      // context controls. Bottom padding alone cannot protect middle rows.
      if (occupied.length) {
        const top = dashboard.getBoundingClientRect().top;
        dashboard.style.setProperty('--home-scroll-height', Math.max(160, Math.min(...occupied.map(r => r.top)) - top - 12) + 'px');
      } else dashboard.style.removeProperty('--home-scroll-height');
    }
    function clearFocusedOverlay(event) {
      if (!host.contains(event.target)) return;
      updateClearance();
      root.requestAnimationFrame(() => {
        if (!event.target.isConnected || doc.activeElement !== event.target) return;
        const box = event.target.getBoundingClientRect();
        if (overlayRects().some(r => box.right > r.left && box.left < r.right && box.bottom > r.top && box.top < r.bottom)) {
          event.target.scrollIntoView({ block: 'center', inline: 'nearest' });
        }
      });
    }
    host.addEventListener('focusin', clearFocusedOverlay);
    root.addEventListener('resize', updateClearance);
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
      actionScopes.set(element, renderScope);
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
    function boardIntelligence(c, m) {
      const grid = node('div', 'home-board-intelligence');
      const available = Boolean(!c.loading && c.openBoard && m.workspace.boards.some(b => b.id === c.boardId));
      const brand = available && m.workspace.brands.find(b => b.id === c.openBoard.brandId);
      function control(label, action, id = '') {
        const b = button(label, action, id); boardActionContexts.set(b, { scope: c, key: c.campaign?.key }); return b;
      }
      function card(module, title) {
        const section = node('section', 'home-intelligence-card'); section.dataset.homeModule = module;
        const heading = node('h2', '', t(title)); heading.id = 'home-' + module + '-title';
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading, node('p', 'home-note', t('Current Board')));
        if (available) section.append(node('h3', '', c.openBoard.name + ' · '
          + (brand?.name || t(c.openBoard.unassigned ? 'No Brand connected' : 'No visible Brand association'))));
        return section;
      }
      const insights = card('insights', 'Campaign Insights');
      const states = {
        analyzing: 'Analyzing the current Canvas structure…',
        empty: 'This Canvas is empty. Add campaign content to make deterministic diagnostics available.',
        missing: 'No diagnostic snapshot is available. Open Insights to inspect the current Canvas.',
        stale: 'The diagnostic snapshot is out of date. Open Insights to refresh it for this Canvas.',
        error: 'Canvas diagnostics could not be calculated. No diagnostic result is shown.',
        none: 'No applicable structural findings in this snapshot. This does not measure campaign results.'
      };
      if (!available) {
        insights.append(node('p', 'home-note', t(c.loading ? 'Board is loading. Canvas diagnostics will appear when the authorized Canvas is ready.'
          : c.boardId ? 'Board access could not be confirmed. Open an authorized Board to continue.' : 'Open a Board to see Campaign Insights.')));
        insights.append(button('Browse Boards', 'boards'));
      } else {
        const diagnostic = c.campaign;
        const status = node('p', 'home-note', t(states[diagnostic?.status] || (!diagnostic ? states.missing : 'Deterministic checks of the current Canvas structure.')));
        status.setAttribute('role', 'status'); insights.append(status);
        if (['ready', 'none'].includes(diagnostic?.status)) {
          const source = node('p', 'home-note', t(diagnostic.source === 'live_unsaved' ? 'Live Canvas · includes unsaved changes' : 'Based on the currently loaded saved Canvas'));
          const time = node('time', '', new Intl.DateTimeFormat(c.language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(diagnostic.analyzedAt)));
          time.dateTime = diagnostic.analyzedAt; source.append(' · ' + t('Analyzed') + ' ', time); insights.append(source);
          const list = node('ul', 'home-insights-list');
          // Presentation preview only; the complete engine and Insights stay intact.
          for (const finding of diagnostic.findings.slice(0, 3)) {
            const row = node('li'); row.dataset.findingCode = finding.code; row.dataset.severity = finding.severity;
            row.append(node('span', 'home-finding-severity', t(finding.severity[0].toUpperCase() + finding.severity.slice(1))),
              node('h4', '', t(finding.title)), node('p', '', t(finding.description)));
            if (finding.nodeId) {
              const open = control('Show on Canvas', 'insight-node', finding.code);
              open.setAttribute('aria-label', t('Show on Canvas') + ': ' + t(finding.title)); row.append(open);
            }
            list.append(row);
          }
          insights.append(list);
        }
        insights.append(control('View all Insights', 'insights'));
      }
      const brain = card('brain', 'AI Brain');
      brain.classList.add('home-brain-card');
      brain.append(node('p', '', t('Explore campaign structure, audience and next steps with your current Board.')));
      if (available && c.openBoard.canEdit === true) {
        brain.append(node('p', 'home-note', t('Available to authenticated Board editors. Advice uses independently authorized Brand knowledge where available.')),
          node('p', 'home-note', t('Opens AI Brain. An answer is generated only when you submit a question.')));
        const ask = control('Ask AI Brain', 'brain'); ask.className = 'fk-btn fk-btn-primary'; brain.append(ask);
      } else {
        brain.append(node('p', 'home-note', t(c.loading ? 'AI Brain will be available after Board loading finishes.'
          : available ? 'AI Brain requires editable Board access. This Board is read-only.'
          : c.boardId ? 'Board access could not be confirmed. Open an authorized Board to continue.' : 'Open a saved Board with edit access to use AI Brain.')));
        brain.append(button('Browse Boards', 'boards'));
      }
      grid.append(insights, brain); return grid;
    }
    function nextMoves(c, m) {
      const section = node('section', 'home-next-moves');
      section.setAttribute('aria-labelledby', 'home-next-title');
      const title = node('h2', '', t('Your Next Moves')); title.id = 'home-next-title'; section.append(title);
      const list = node('ul', 'home-next-list');
      function add(source, label, action) {
        const row = node('li'); row.dataset.nextSource = source;
        row.append(action || node('span', 'home-note', label));
        if (action) action.textContent = label;
        list.append(row);
      }
      if (m.brand && learningStatus === 'ready' && learning?.canWrite && learning.proposed > 0) {
        const phrase = learning.proposed === 1 ? '{count} Learning awaiting review · {brand}' : '{count} Learnings awaiting review · {brand}';
        add('learning', t(phrase).replace('{count}', learning.proposed).replace('{brand}', m.brand.name), placed('', 'learnings', m.brand.id, 'next'));
      }
      const responsibilities = m.workspace.boards.some(b => b.id === c.boardId) ? responsibilitySummary(c) : null;
      if (responsibilities?.mine > 0) {
        const phrase = responsibilities.mine === 1 ? '{count} responsibility assigned to you · {board}' : '{count} responsibilities assigned to you · {board}';
        add('responsibilities', t(phrase).replace('{count}', responsibilities.mine).replace('{board}', c.openBoard.name), placed('', 'responsibilities', '', 'next'));
      }
      const finding = !c.loading && c.openBoard && m.workspace.boards.some(b => b.id === c.boardId)
        && c.campaign?.status === 'ready' && c.campaign.key && c.campaign.findings[0];
      if (finding) add('insights', t(finding.severity[0].toUpperCase() + finding.severity.slice(1)) + ' · ' + t(finding.title) + ' · ' + c.openBoard.name,
        placed('', 'insights', finding.code, 'next'));
      if (!list.children.length) {
        // Fallback uses the existing unfiltered, Brand-centered model ordering.
        const first = model(c, rows).boards[0];
        if (first) add('continuation', t('Continue') + ': ' + first.name, placed('Continue', 'board', first.id, 'next'));
        else add('browse', t('Browse Boards'), placed('Browse Boards', 'boards', '', 'next'));
      }
      section.append(list);
      const unavailable = [];
      if (m.brand && (learningStatus !== 'ready' || learning?.proposed === null)) unavailable.push(['Brand Learning availability', 'home-intelligence-title']);
      if (c.boardId && !responsibilities) unavailable.push(['Responsibility availability', 'home-responsibilities-title']);
      if (c.boardId && !['ready', 'none', 'empty'].includes(c.campaign?.status)) unavailable.push(['Campaign Insights availability', 'home-insights-title']);
      if (unavailable.length) {
        const note = node('p', 'home-note'); note.append(t('Some information is unavailable. See details:') + ' ');
        for (const [label, id] of unavailable) {
          const link = node('a', '', t(label)); link.href = '#' + id; link.dataset.homeFocus = 'next-detail:' + id;
          link.addEventListener('click', event => {
            event.preventDefault();
            if (!sameScope(c, context()) || !host.contains(link)) { sync(); return; }
            const heading = host.querySelector('#' + id);
            if (heading) { heading.tabIndex = -1; heading.focus(); heading.scrollIntoView({ block: 'center' }); }
          });
          note.append(link, ' ');
        }
        section.append(note);
      }
      return section;
    }
    function livingWorkspace(c, m) {
      function arrow() {
        const mark = node('span', 'home-living-arrow', '→'); mark.setAttribute('aria-hidden', 'true'); return mark;
      }
      const living = node('section', 'home-living'); living.setAttribute('aria-labelledby', 'home-living-title');
      const working = node('div', 'home-living-work');
      const greeting = node('div', 'home-living-greeting');
      const title = node('h1', '', t('Welcome back.')); title.id = 'home-living-title';
      greeting.append(node('span', 'home-eyebrow', t('YOUR CREATIVE WORKSPACE')), title,
        node('p', 'home-living-subtitle', t(m.brand ? 'A little space for your next idea with {brand}.' : 'A little space for your next idea.')
          .replace('{brand}', m.brand?.name || '')));
      const continuation = node('section', 'home-living-continue'); continuation.setAttribute('aria-labelledby', 'home-living-continue-title');
      const heading = node('h2', '', t('Continue where you left off')); heading.id = 'home-living-continue-title'; continuation.append(heading);
      const candidate = heroContinuation(c, rows);
      if (candidate) {
        const current = candidate.id === c.boardId && !!c.openBoard && !c.loading;
        const viewer = current ? c.openBoard.canEdit !== true : candidate.role === 'viewer';
        const info = node('div', 'home-living-board');
        info.append(identity(candidate.brand || { name: candidate.name }));
        const copy = node('div'); copy.append(node('h3', '', candidate.name),
          node('p', 'home-living-scope', candidate.brand?.name || t(candidate.unassigned ? 'No Brand connected' : 'No visible Brand association')),
          node('span', 'home-living-kind', t(viewer ? 'View-only Board' : current ? 'Currently open' : 'Saved Board')));
        info.append(copy); continuation.append(info);
        // Explain foreign-current and nonconnected fallbacks beside the action.
        if (m.brand && candidate.brand?.id !== m.brand.id) continuation.append(node('p', 'home-note',
          t(current ? 'No connected Board available. Continue your open Board.' : 'No connected Board available. Open an available saved Board.')));
        const footer = node('div', 'home-living-resume');
        const saved = node('p', 'home-living-saved');
        if (candidate.savedAt) {
          const time = node('time', '', new Intl.DateTimeFormat(c.language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(candidate.time)));
          time.dateTime = candidate.savedAt; saved.append(node('span', '', t('Last saved modification')), time);
        } else saved.textContent = t(status === 'loading' ? 'Loading saved modification times…' : 'Modification time unavailable');
        const label = viewer ? 'View Board' : current ? 'Continue open Board' : 'Open saved Board';
        const resume = placed(label, 'board', candidate.id, 'living'); resume.className = 'fk-btn fk-btn-primary';
        resume.setAttribute('aria-label', t(label) + ': ' + candidate.name); resume.disabled = !!c.loading;
        resume.append(arrow()); footer.append(saved, resume); continuation.append(footer);
      } else {
        continuation.append(node('p', 'home-note', t(c.loading ? 'A Board is loading. Please wait before opening another.' : 'Saved Boards available to you in this Workspace will appear here.')),
          placed('Browse Boards', 'boards', '', 'living'));
      }
      working.append(greeting, continuation);

      const stage = node('div', 'home-avatar-stage');
      const art = node('div', 'home-avatar-art'); art.setAttribute('aria-hidden', 'true');
      art.append(node('span', 'home-avatar-orbit'), node('span', 'home-avatar-orbit home-avatar-orbit-back'),
        node('span', 'home-avatar-spark home-avatar-spark-one', '✦'), node('span', 'home-avatar-spark home-avatar-spark-two', '✧'),
        node('span', 'home-avatar-spark home-avatar-spark-three', '∿'));
      const bubble = node('p', 'home-avatar-bubble', t('Ready to explore your next idea?'));
      // B1 deliberately has no canonical detail read or logo-as-Avatar fallback.
      // This square slot can later contain one accepted image, object-fit:contain.
      const slot = node('div', 'home-avatar-slot'); slot.dataset.avatarState = 'placeholder';
      const abstract = node('span', 'home-avatar-neutral'); abstract.setAttribute('aria-hidden', 'true'); abstract.append(node('span', '', '✦'));
      slot.append(abstract, node('span', 'home-avatar-placeholder', t('Brand Avatar')), node('span', 'home-avatar-placeholder-note', t('Visual placeholder')));
      const entry = node('div', 'home-avatar-entry');
      const available = !!(!c.loading && c.openBoard && m.workspace.boards.some(b => b.id === c.boardId));
      const boardBrand = available && m.workspace.brands.find(b => b.id === c.openBoard.brandId);
      const boardScope = available ? c.openBoard.name + ' · ' + (boardBrand?.name || t(c.openBoard.unassigned ? 'No Brand connected' : 'No visible Brand association')) : '';
      const canBrain = available && c.openBoard.canEdit === true;
      const brain = placed(canBrain ? 'Open AI Brain for {board}' : 'Browse Boards', canBrain ? 'brain' : 'boards', '', 'stage');
      if (canBrain) brain.textContent = t('Open AI Brain for {board}').replace('{board}', c.openBoard.name);
      brain.className = 'fk-btn fk-btn-primary'; brain.append(arrow());
      const scope = node('p', 'home-avatar-context'); scope.id = 'home-avatar-context';
      scope.textContent = available ? t(m.brand && m.brand.id !== boardBrand?.id
        ? 'Selected Brand: {selected}. AI Brain uses the open Board: {board}.' : 'AI Brain uses the open Board: {board}.')
        .replace(/\{(selected|board)\}/g, (_, key) => key === 'selected' ? m.brand?.name || '' : boardScope)
        : t(c.loading ? 'AI Brain will be available after Board loading finishes.' : 'Open a saved Board with edit access to use AI Brain.');
      if (available && !canBrain) scope.append(' ' + t('AI Brain requires editable Board access. This Board is read-only.'));
      brain.setAttribute('aria-describedby', scope.id); entry.append(brain, scope);
      stage.append(art, bubble, slot, entry); living.append(working, stage);

      const shortcuts = node('section', 'home-quick-actions'); shortcuts.setAttribute('aria-labelledby', 'home-quick-title');
      const quickTitle = node('h2', '', t('Quick actions')); quickTitle.id = 'home-quick-title'; shortcuts.append(quickTitle);
      const list = node('ul', 'home-quick-list');
      const responsibilities = available && responsibilitySummary(c);
      const learningReady = !!(m.brand && learningStatus === 'ready');
      const entries = [
        ['🧠', 'AI Brain', 'brain', '', canBrain, canBrain ? boardScope : t(available ? 'AI Brain requires editable Board access. This Board is read-only.' : 'Open a saved Board with edit access to use AI Brain.'), 'brain'],
        ['📊', 'Campaign Insights', 'insights', '', available, available ? boardScope : t('Open a Board to see Campaign Insights.'), 'insights'],
        ['📚', 'Brand Learnings', 'learnings', m.brand?.id || '', learningReady, learningReady ? m.brand.name
          : t(m.brand ? learningStatus === 'denied' ? 'Brand Learning access could not be confirmed.' : learningStatus === 'error' ? 'Brand Learnings unavailable. Try again.' : 'Checking Brand Learning access…' : 'Select a Brand to see its Learning review availability.'), 'learnings'],
        ['👥', 'Team Responsibilities', 'responsibilities', '', !!responsibilities, responsibilities ? boardScope : t('Open a Board to see its responsibilities.'), 'responsibilities']
      ];
      for (const [emoji, label, action, id, enabled, description, tone] of entries) {
        const item = node('li'); const control = placed('', action, id, 'quick'); control.className = 'home-quick-action'; control.dataset.tone = tone;
        const icon = node('span', 'home-quick-icon', emoji); icon.setAttribute('aria-hidden', 'true');
        const copy = node('span', 'home-quick-copy'); copy.append(node('strong', '', t(label)), node('span', '', description));
        const arrow = node('span', 'home-quick-arrow', '›'); arrow.setAttribute('aria-hidden', 'true');
        // Keep unavailable destinations keyboard discoverable, with an honest
        // explanation. Activation remains blocked independently of CSS.
        if (!enabled) control.setAttribute('aria-disabled', 'true');
        control.append(icon, copy, arrow); item.append(control); list.append(item);
      }
      shortcuts.append(list); living.append(shortcuts); return living;
    }
    function draw() {
      updateClearance();
      const c = context(), m = model(c, rows, filter);
      renderScope = c;
      const collectionIdentity = JSON.stringify([c.identity, c.workspaceId, c.brandId, filter, m.workspace?.boards.map(b => [b.id, b.brand_id, b.role])]);
      if (collectionIdentity !== expansionIdentity) { expanded = false; expansionIdentity = collectionIdentity; }
      const focused = host.contains(doc.activeElement) ? doc.activeElement.dataset.homeFocus : null;
      const focusedContext = host.contains(doc.activeElement) ? doc.activeElement.dataset.contextAction : null;
      host.replaceChildren(); host.setAttribute('aria-busy', String(status === 'loading' || ['idle', 'loading', 'refreshing'].includes(c.status) && !!c.account));
      const hero = node('header', 'home-hero');
      const copy = node('div', 'home-hero-copy');
      copy.append(node('span', 'home-eyebrow', t('Workspace')),
        node('p', 'home-workspace-name', m.workspace?.name || t('A home for your next idea.')));
      hero.append(copy);
      if (m.workspace) hero.prepend(identity(m.workspace, true));
      host.append(hero);
      if (!c.account?.email || c.publicToken) {
        copy.append(node('h1', '', t('Welcome back.')));
        host.append(message('Welcome to Tendra One', 'Sign in to see your Workspaces and saved Boards.', button('Sign in', 'signin'))); return;
      }
      if (!m.ready) {
        copy.append(node('h1', '', t('Welcome back.')));
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
        if (sameScope(c, context()) && model(context()).ready) void actions.workspace(id);
      });
      if (c.catalog.workspaces.length) { nav.append(label, select, button('Create Workspace', 'workspace-create')); hero.append(nav); }
      if (!m.workspace) {
        copy.append(node('h1', '', t('Welcome back.')));
        host.append(message(c.catalog.workspaces.length ? 'Choose your working context' : 'Your first Workspace starts here',
          c.catalog.workspaces.length ? 'Choose a Workspace to see the Brands and Boards available to you.' : 'Create a Workspace to bring your Brands and campaign work together.',
          c.catalog.workspaces.length ? null : button('Create Workspace', 'workspace-create'))); return;
      }
      const brandControls = node('div', 'home-brand-controls');
      const brandLabel = node('label', '', t('Selected Brand')); brandLabel.htmlFor = 'home-brand-select';
      const brandSelect = node('select'); brandSelect.id = 'home-brand-select'; brandSelect.dataset.homeFocus = 'header-brand-select';
      const emptyBrand = node('option', '', t('Choose a Brand to continue.')); emptyBrand.value = ''; emptyBrand.disabled = true; brandSelect.append(emptyBrand);
      for (const brand of m.workspace.brands) { const option = node('option', '', brand.name); option.value = brand.id; brandSelect.append(option); }
      brandSelect.value = m.brand?.id || '';
      brandSelect.addEventListener('change', () => {
        const id = brandSelect.value, current = context(), currentModel = model(current);
        brandSelect.value = currentModel.brand?.id || '';
        if (sameScope(c, current) && currentModel.workspace?.brands.some(b => b.id === id)) actions.brand(id);
      });
      if (m.brand && m.brand.name.length > 30) brandLabel.append(node('span', 'home-selected-brand', ': ' + m.brand.name));
      brandControls.append(brandLabel, brandSelect);
      if (m.brand) brandControls.append(placed('Brand Profile', 'profile', m.brand.id, 'header'));
      if (['owner', 'admin'].includes(m.workspace.role)) brandControls.append(placed('Manage Brands', 'brands', '', 'header'));
      hero.append(brandControls);
      host.append(livingWorkspace(c, m));
      const details = node('div', 'home-details-heading');
      const detailsTitle = node('h2', '', t('Workspace details')); detailsTitle.id = 'home-details-title'; details.append(detailsTitle); host.append(details);
      if (c.openBoard && !c.loading && m.workspace.boards.some(b => b.id === c.boardId)) {
        const open = node('div', 'home-open-board');
        const brand = m.workspace.brands.find(b => b.id === c.openBoard.brandId);
        open.append(node('p', '', t('Currently open') + ': ' + c.openBoard.name + ' · ' + (brand?.name || t(c.openBoard.unassigned ? 'No Brand connected' : 'No visible Brand association'))));
        const resume = placed(c.openBoard.canEdit === false ? 'Continue viewing the open Board' : 'Continue', 'board', c.boardId, 'header'); resume.className = 'fk-btn fk-btn-primary';
        open.append(resume); details.append(open);
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
      const contextNotice = node('aside'); contextNotice.dataset.homeContext = 'true';
      renderContextNotice(contextNotice, c, t, { continue: () => { if (sameScope(c, context()) && context().openBoard) actions.board(c.boardId); }, boards: () => { if (sameScope(c, context())) actions.brandBoards(); }, profile: brand => { if (sameScope(c, context())) actions.profile(brand); } });
      // Home already identifies the Board in its header. Keep its notice identity
      // in the same concise sentence; the separately owned Canvas notice is intact.
      if (!contextNotice.hidden) {
        const boardIdentity = contextNotice.querySelector(':scope > span');
        const noticeCopy = contextNotice.querySelector('p');
        noticeCopy.append(' · ', boardIdentity);
      }
      host.append(contextNotice, nextMoves(c, m));
      const section = node('section', 'home-continue'); section.setAttribute('aria-labelledby', 'home-continue-title');
      const top = node('div', 'home-section-heading'); const h2 = node('h2', '', t('Continue Working')); h2.id = 'home-continue-title';
      const controls = node('div', 'home-actions'); controls.append(button('Browse Boards', 'boards'));
      if (m.canCreate) { const add = button('Create project', 'create'); add.className = 'fk-btn fk-btn-primary'; controls.append(add); }
      top.append(h2, controls); section.append(top);
      if (m.brand) {
        const filters = node('div', 'home-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', t('Filter Boards'));
        const all = button('All visible Boards', 'all'), selected = button(m.brand.name, 'filtered');
        selected.textContent = m.brand.name;
        all.setAttribute('aria-pressed', String(filter === 'all')); selected.setAttribute('aria-pressed', String(filter === 'brand')); filters.append(all, selected); top.insertBefore(filters, controls);
      }
      let notice = status === 'loading' ? 'Loading saved modification times…' : status === 'error'
        ? 'Saved modification times are unavailable. Your authorized Board links are still available.'
        : 'Ordered by saved modification time where available. The Board collection may be incomplete; this is not a history of your visits.';
      const note = node('p', 'home-note', t(notice)); note.setAttribute('role', 'status'); section.append(note);
      if (status === 'error') section.append(button('Retry modification times', 'metadata'));
      if (!m.boards.length) section.append(node('p', 'home-note', t('Showing {visible} of {total} available Boards').replace('{visible}', '0').replace('{total}', '0')), message(filter === 'brand' ? 'No saved Boards for this Brand' : 'A fresh canvas for your next campaign',
        'Saved Boards available to you in this Workspace will appear here.', m.canCreate ? button('Create project', 'create') : button('Browse Boards', 'boards')));
      else {
        const list = node('ul', 'home-board-list');
        let group = null;
        for (const board of (expanded ? m.boards : m.boards.slice(0, 6))) {
          if (m.brand && board.group !== group) {
            group = board.group;
            const heading = node('li', 'home-board-group-heading');
            heading.setAttribute('role', 'presentation');
            heading.append(node('h3', '', t(group === 'connected' ? 'Connected Boards' : group === 'other' ? 'Other Boards' : 'Boards without a visible Brand')));
            list.append(heading);
          }
          const card = node('li', 'home-board-card'); card.classList.toggle('is-current', board.active);
          const mark = node('div', 'home-board-mark'); mark.append(identity(board.brand || { name: board.name }));
          card.append(mark, node('h3', '', board.name));
          if (board.active) card.append(node('span', 'home-eyebrow', t('Currently open')));
          const distinction = board.group === 'connected' ? 'Connected Board' : board.group === 'other' ? 'Other Brand Board' : '';
          const relationship = node('p', 'home-board-brand', board.brand?.name || t(board.unassigned ? 'No Brand connected' : 'No visible Brand association'));
          if (distinction) { relationship.prepend(node('span', 'home-board-group', t(distinction) + ' · ')); }
          card.append(relationship);
          const saved = node('p', 'home-board-date');
          if (board.savedAt) { const time = node('time', '', new Intl.DateTimeFormat(c.language === 'de' ? 'de-DE' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(board.time))); time.dateTime = board.savedAt; saved.append(t('Last edited') + ' ', time); }
          else saved.textContent = t('Modification time unavailable');
          card.append(saved);
          if (board.role === 'viewer') card.append(node('span', 'home-note', t('View-only Board')));
          const open = button(board.active ? 'Continue' : 'Open Board', 'board', board.id);
          open.classList.add('home-board-open'); open.setAttribute('aria-label', `${t(board.active ? 'Continue' : 'Open Board')}: ${board.name}`);
          open.disabled = Boolean(c.loading); card.append(open); list.append(card);
        }
        list.id = 'home-board-preview'; section.append(list);
        const preview = node('div', 'home-preview-controls');
        preview.append(node('p', 'home-note', t('Showing {visible} of {total} available Boards').replace('{visible}', Math.min(m.boards.length, expanded ? m.boards.length : 6)).replace('{total}', m.boards.length)));
        if (m.boards.length > 6) {
          const toggle = button(expanded ? 'Show less' : 'Show all visible Boards', 'expand');
          toggle.setAttribute('aria-expanded', String(expanded)); toggle.setAttribute('aria-controls', list.id); preview.append(toggle);
        }
        section.append(preview);
      }
      if (c.loading) section.append(node('p', 'home-note', t('A Board is loading. Please wait before opening another.')));
      host.append(section, intelligence(c, m), boardIntelligence(c, m), orientation);
      if (focused) {
        const restored = Array.from(host.querySelectorAll('[data-home-focus]')).find(e => e.dataset.homeFocus === focused);
        (restored || (focused.startsWith('board:') ? host.querySelector('[data-home-action=expand]') : null))?.focus({ preventScroll: true });
      }
      if (focusedContext) contextNotice.querySelector(`[data-context-action="${focusedContext}"]`)?.focus({ preventScroll: true });
    }
    function invalidateLearnings() { learningRequest?.controller.abort(); learningRequest = null; learning = null; learningStatus = 'idle'; }
    function invalidate() { request?.controller.abort(); request = null; rows = []; status = 'idle'; invalidateLearnings(); }
    function sync() {
      if (disposed) return;
      const next = context();
      if (!scope || !sameScope(scope, next)) { invalidate(); filter = 'all'; expanded = false; scope = next; }
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
      const key = JSON.stringify([c.openBoard, c.responsibilities, c.campaign, c.loading]);
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
      const target = event.target.closest('[data-home-action]'); if (!target || target.disabled || target.getAttribute('aria-disabled') === 'true') return;
      const c = context(), m = model(c, rows, filter), rawAction = target.dataset.homeAction, action = rawAction.replace(/^(next|header|living|stage|quick)-/, ''), id = target.dataset.homeId;
      const capturedScope = actionScopes.get(target);
      if (!capturedScope || !sameScope(capturedScope, c)) { sync(); return; }
      if (rawAction === 'next-learnings' && !(learningStatus === 'ready' && learning?.canWrite && learning.proposed > 0)) { sync(); return; }
      if (rawAction === 'next-responsibilities' && !(m.workspace?.boards.some(b => b.id === c.boardId) && responsibilitySummary(c)?.mine > 0)) { sync(); return; }
      if (!sameScope(scope, c)) { sync(); return; }
      if (action === 'signin') actions.signin();
      else if (action === 'retry') actions.retry();
      else if (m.ready && action === 'workspace-create') actions.workspaceCreate(target);
      else if (m.workspace) {
        if (['insights', 'insight-node', 'brain'].includes(action)) {
          const captured = boardActionContexts.get(target);
          if (!captured || !sameScope(captured.scope, c) || c.loading || !c.openBoard
            || !m.workspace.boards.some(b => b.id === c.boardId)) { sync(); return; }
          if (action === 'insights' && (rawAction !== 'next-insights' || c.campaign?.status === 'ready' && captured.key === c.campaign.key && c.campaign.findings[0]?.code === id)) actions.insights();
          else if (action === 'brain' && c.openBoard.canEdit === true) actions.brain();
          else if (action === 'insight-node' && c.campaign?.status === 'ready' && captured.key === c.campaign.key
            && c.campaign.findings.some(f => f.code === id && f.nodeId)) actions.insightNode(id);
          else sync();
        }
        else if (action === 'learnings-retry') { invalidateLearnings(); void loadLearnings(); }
        else if (action === 'learnings' && m.brand?.id === id && learningStatus === 'ready') actions.learnings({ ...m.brand, workspace_id: m.workspace.id, section: 'Brand Learnings' });
        else if (action === 'responsibility-node' && /^[\w.:-]+$/.test(id) && responsibilitySummary(c)?.items.some(n => n.id === id)) actions.node(id);
        else if (action === 'responsibilities' && responsibilitySummary(c)) actions.responsibilities(() => Array.from(host.querySelectorAll('[data-home-action]')).find(e => e.dataset.homeAction === rawAction));
        else if (action === 'expand') { expanded = !expanded; draw(); host.querySelector('[data-home-action=expand]')?.focus({ preventScroll: true }); }
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
    return Object.freeze({ sync, dispose() { disposed = true; invalidate(); host.removeEventListener('focusin', clearFocusedOverlay); root.removeEventListener('resize', updateClearance); root.clearInterval(runtimeTimer); root.removeEventListener?.('focus', refreshLearnings); root.removeEventListener?.('funklix:brand-learnings-changed', refreshLearnings); doc.removeEventListener('visibilitychange', resume); host.replaceChildren(); } });
  }
  root.FunklixHomeFoundation = Object.freeze({ model, heroContinuation, sameScope, learningSummary, responsibilitySummary, renderContextNotice, create });
  if (typeof module === 'object' && module.exports) module.exports = root.FunklixHomeFoundation;
}(typeof globalThis !== 'undefined' ? globalThis : window));
