(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FunklixCampaignResponsibilities = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';
  const types = ['Idea', 'Campaign Variation', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign'];
  const email = value => String(value || '').trim().toLowerCase();
  function structure(nodes, edges) {
    const children = (node, type) => nodes.filter(n => n.type === type && edges.some(e => e[0] === node.id && e[1] === n.id));
    const seen = new Set();
    const take = n => { seen.add(n.id); return n; };
    const variation = n => ({ node: take(n), contents: children(n, 'Content').map(c => ({ node: take(c), posts: children(c, 'Social Media Posting').map(take) })) });
    const campaigns = nodes.filter(n => n.type === 'Idea').map(idea => {
      const variations = children(idea, 'Campaign Variation').map(variation);
      const posts = variations.flatMap(v => v.contents.flatMap(c => c.posts));
      const landing = nodes.filter(n => n.type === 'Landing Page' && posts.some(p => children(p, 'Landing Page').includes(n)));
      const mail = nodes.filter(n => n.type === 'Email Campaign' && landing.some(l => children(l, 'Email Campaign').includes(n)));
      return { idea: take(idea), variations, shared: [...landing, ...mail].map(take) };
    });
    const variations = nodes.filter(n => n.type === 'Campaign Variation' && !seen.has(n.id)).map(variation);
    return { campaigns, variations, others: nodes.filter(n => types.includes(n.type) && !seen.has(n.id)) };
  }
  const variationNodes = v => [v.node, ...v.contents.flatMap(c => [c.node, ...c.posts])];
  function candidates(ids, nodes, replace = false) {
    return nodes.filter(n => ids.includes(n.id) && (replace || !email(n.ownerEmail)));
  }
  function mount(adapter) {
    const existing = document.getElementById('campaign-responsibilities');
    if (existing) { existing.focus(); return existing; }
    const t = adapter.text, format = (s, n) => t(s).replace('{count}', String(n));
    const previous = adapter.returnFocus || document.activeElement;
    const dialog = document.createElement('dialog'); dialog.id = 'campaign-responsibilities'; dialog.className = 'campaign-responsibilities';
    dialog.setAttribute('aria-labelledby', 'campaign-responsibilities-title');
    const node = (tag, text, className = '') => { const el = document.createElement(tag); if (text) el.textContent = text; el.className = className; return el; };
    const button = (text, action, primary = false) => {
      const el = node('button', t(text), `fk-btn ${primary ? 'fk-btn-primary' : 'fk-btn-secondary'}`); el.type = 'button'; el.addEventListener('click', action); return el;
    };
    const heading = node('h2', t('Campaign responsibilities')); heading.id = 'campaign-responsibilities-title';
    const header = node('div', '', 'responsibility-header');
    const close = button('Close', () => { if (busy) return; dialog.close(); });
    header.append(heading, close);
    const help = node('p', t('Only people who can edit this project can be assigned'), 'responsibility-help');
    const live = node('p', '', 'responsibility-live'); live.setAttribute('role', 'status'); live.setAttribute('aria-live', 'polite');
    const actions = node('div', '', 'responsibility-actions');
    const content = node('div', '', 'responsibility-content');
    const picker = node('section', '', 'responsibility-picker'); picker.hidden = true;
    const pickerTitle = node('h3', t('Responsible')); pickerTitle.id = 'responsibility-picker-title';
    picker.setAttribute('aria-labelledby', pickerTitle.id);
    dialog.append(header, help, live, actions, picker, content); document.body.append(dialog);
    let busy = false, selection = null;
    const announce = text => { live.textContent = t(text); };
    const setBusy = value => { busy = value; dialog.setAttribute('aria-busy', String(value)); close.disabled = value; };
    function personDisplay(person, label) {
      const wrap = node('span', '', 'responsibility-person');
      const avatar = node('span', '', 'responsibility-avatar');
      if (person?.avatar && /^(https?:|\/)/.test(person.avatar)) { const img = node('img'); img.src = person.avatar; img.alt = ''; avatar.append(img); }
      else avatar.textContent = (person?.name || label || '?').split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
      wrap.append(avatar, node('span', label)); return wrap;
    }
    function owner(nodeData) {
      const person = adapter.people().find(p => email(p.email) === email(nodeData.ownerEmail));
      if (!nodeData.ownerEmail) return personDisplay(null, t('Unassigned'));
      return personDisplay(person || { name: nodeData.ownerName, avatar: nodeData.ownerAvatar }, person?.name || nodeData.ownerName || nodeData.ownerEmail);
    }
    function row(n) {
      const el = node('div', '', 'responsibility-row'); el.dataset.responsibilityNode = n.id;
      const title = node('div', '', 'responsibility-title');
      title.append(node('span', t(n.type), 'responsibility-type'), node('strong', n.title || t(n.type)), node('span', t(n.status || 'Draft'), 'responsibility-status'));
      const current = owner(n); current.dataset.responsibilityOwner = email(n.ownerEmail);
      const assign = button('Assign', () => choose([n.id], true)); assign.disabled = busy || !adapter.canEdit();
      assign.setAttribute('aria-label', `${t('Assign')}: ${n.title || t(n.type)}`);
      el.append(title, current, assign); return el;
    }
    function renderVariation(v, host) {
      const section = node('section', '', 'responsibility-variation');
      const action = button('Assign variation', () => choose(variationNodes(v).map(n => n.id), false)); action.disabled = busy || !adapter.canEdit();
      section.append(row(v.node), action);
      v.contents.forEach(c => { const group = node('div', '', 'responsibility-children'); group.append(row(c.node)); const posts = node('div', '', 'responsibility-children'); c.posts.forEach(p => posts.append(row(p))); group.append(posts); section.append(group); });
      host.append(section);
    }
    function render() {
      content.replaceChildren(); actions.replaceChildren();
      const all = adapter.nodes().filter(n => types.includes(n.type));
      const count = all.filter(n => !email(n.ownerEmail)).length;
      const bulk = button('Assign all unassigned', () => choose(all.map(n => n.id), false)); bulk.disabled = busy || !count || !adapter.canEdit();
      bulk.append(node('span', ` (${count})`)); actions.append(bulk);
      if (adapter.canManage()) {
        const invite = button('Add team member', () => inviteForm()); invite.disabled = busy; actions.append(invite);
      }
      const groups = structure(adapter.nodes(), adapter.edges());
      groups.campaigns.forEach(c => {
        const campaign = node('section', '', 'responsibility-campaign'); campaign.append(node('h3', t('Campaign idea')), row(c.idea));
        c.variations.forEach(v => renderVariation(v, campaign));
        if (c.shared.length) { campaign.append(node('h3', t('Shared funnel assets'))); c.shared.forEach(n => campaign.append(row(n))); }
        content.append(campaign);
      });
      groups.variations.forEach(v => renderVariation(v, content));
      if (groups.others.length) { content.append(node('h3', t('Other assets'))); groups.others.forEach(n => content.append(row(n))); }
    }
    function inviteForm() {
      if (!adapter.canManage() || busy) return;
      picker.hidden = false; picker.replaceChildren(pickerTitle);
      const form = node('form'); const label = node('label', t('Email')); const input = node('input'); input.type = 'email'; input.required = true; input.autocomplete = 'email'; label.append(input);
      const submit = button('Add team member', () => {}); submit.type = 'submit';
      form.append(label, submit, button('Cancel', () => { picker.hidden = true; actions.querySelector('button')?.focus(); }));
      form.addEventListener('submit', async event => { event.preventDefault(); if (busy || !form.reportValidity()) return; setBusy(true); submit.disabled = true; announce('Saving'); try { await adapter.invite(input.value, input); await adapter.loadPeople(); picker.hidden = true; announce('Team member added'); } catch { announce('Not saved'); } finally { setBusy(false); render(); submit.disabled = false; } });
      picker.append(form); input.focus();
    }
    function choose(ids, single, preselected = '') {
      if (busy || !adapter.canEdit() || adapter.pending()) return;
      selection = { ids, single, email: preselected }; picker.hidden = false; picker.replaceChildren(pickerTitle);
      const existing = adapter.nodes().filter(n => ids.includes(n.id) && email(n.ownerEmail)).length;
      const count = candidates(ids, adapter.nodes(), single).length;
      picker.append(node('p', format('{count} assets will be assigned.', count)));
      if (!single && existing) picker.append(node('p', format('{count} assets already have a responsible person.', existing)));
      const people = node('div', '', 'responsibility-people');
      if (!adapter.people().length) { picker.append(node('p', t('No editable team members available')), node('p', t('Invite an editor before assigning work'))); }
      adapter.people().forEach(p => {
        const select = button(p.name || p.email, () => { selection.email = p.email; people.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.email === p.email))); apply.disabled = false; if (replace) replace.disabled = false; });
        select.replaceChildren(personDisplay(p, p.name || p.email), node('small', t(['owner','brand_owner'].includes(p.role) ? 'Owner' : p.role === 'brand_admin' ? 'Admin' : 'Editor')));
        select.dataset.email = p.email; select.setAttribute('aria-pressed', String(p.email === preselected)); people.append(select);
      });
      const apply = button(single ? 'Assign' : 'Assign unassigned only', () => commit(false), true); apply.disabled = !preselected;
      let replace = null;
      picker.append(people, apply);
      if (!single && existing) { replace = button('Replace all assignments', () => commit(true)); replace.disabled = !preselected; picker.append(replace); }
      if (single) picker.append(button('Remove responsibility', () => { selection.email = ''; commit(true); }));
      picker.append(button('Cancel', () => { picker.hidden = true; content.querySelector('button')?.focus(); }));
      picker.querySelector('button')?.focus();
    }
    async function commit(replace) {
      if (busy || !selection || !adapter.canEdit()) return;
      const affected = candidates(selection.ids, adapter.nodes(), selection.single || replace);
      if (!affected.length) { picker.hidden = true; return; }
      setBusy(true); picker.querySelectorAll('button').forEach(b => b.disabled = true); announce('Saving');
      try { const save = adapter.assign(affected.map(n => n.id), selection.email); render(); await save; saved(); }
      catch (error) { failure(error); }
      finally { setBusy(false); render(); }
    }
    function saved() { picker.hidden = true; announce('Saved'); close.focus(); }
    function failure(error) {
      picker.hidden = false; picker.replaceChildren(pickerTitle);
      const conflict = error.code === 'CONFLICT', confirmed = adapter.confirmed();
      announce(confirmed ? 'Saved. Reload this project to refresh the display.' : conflict ? 'This project changed. Load the latest version and confirm your selection again.' : 'Not saved');
      if (conflict || confirmed) {
        picker.append(button('Load latest project', async () => {
          setBusy(true); const remembered = selection;
          try { await adapter.reload(); picker.hidden = true; setBusy(false); render(); if (conflict && remembered) { choose(remembered.ids, remembered.single, remembered.email); announce('Review your selection and confirm again.'); } else saved(); }
          catch { announce(confirmed ? 'Saved. Reload this project to refresh the display.' : 'Not saved'); }
          finally { setBusy(false); render(); }
        }));
      } else picker.append(button('Retry', async () => {
        if (busy) return; setBusy(true); announce('Saving');
        try { await adapter.retry(); saved(); } catch (e) { failure(e); } finally { setBusy(false); render(); }
      }));
    }
    dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
    dialog.addEventListener('close', () => { dialog.remove(); if (previous?.isConnected) previous.focus(); });
    dialog.addEventListener('keydown', event => {
      if (event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll('button,input,[tabindex="0"]')].filter(n => !n.disabled && n.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    render(); dialog.showModal(); close.focus();
    if (adapter.pending()) { selection = adapter.selection(); failure({ code: adapter.conflict() ? 'CONFLICT' : '' }); }
    else { setBusy(true); announce('Loading team'); adapter.loadPeople().then(() => announce('')).catch(() => announce('No editable team members available')).finally(() => { setBusy(false); render(); }); }
    return dialog;
  }
  return { structure, variationNodes, candidates, mount };
});
