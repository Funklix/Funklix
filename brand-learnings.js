(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.FunklixBrandLearnings = api;
}(typeof globalThis !== 'undefined' ? globalThis : window, function (root) {
  'use strict';
  const COPY = {
    subtitle:['Build reusable Brand knowledge from confirmed experience.','Bestätigtes Markenwissen aus Erfahrungen aufbauen.'],
    add:['Add learning','Learning hinzufügen'], review:['Needs review','Prüfung erforderlich'], approved:['Approved','Bestätigt'],
    rejected:['Rejected','Abgelehnt'], archived:['Archived','Archiviert'], all:['All','Alle'], active:['Review and approved','Prüfung und bestätigte Learnings'],
    empty:['No learnings yet. Add a proposal to build confirmed Brand knowledge.','Noch keine Learnings. Mit einem Vorschlag bestätigtes Markenwissen aufbauen.'],
    emptyFilter:['No learnings in this view.','Keine Learnings in dieser Ansicht.'], manual:['Manual','Manuell'], observation:['Campaign observation','Kampagnenbeobachtung'], sourceUnavailable:['Source unavailable','Quelle nicht verfügbar'],
    statement:['Learning statement','Learning-Aussage'], evidence:['Evidence / context (optional)','Belege / Kontext (optional)'],
    save:['Save proposal','Vorschlag speichern'], cancel:['Cancel','Abbrechen'], edit:['Edit','Bearbeiten'],
    update:['Propose update','Aktualisierung vorschlagen'], approve:['Approve learning','Learning bestätigen'],
    reject:['Reject','Ablehnen'], archive:['Archive','Archivieren'], history:['History','Verlauf'],
    consequence:['It becomes reusable Brand knowledge.','Es wird zu wiederverwendbarem Markenwissen.'],
    archiveConsequence:['It remains in history and will no longer count as active Brand knowledge.','Es bleibt im Verlauf und zählt nicht mehr als aktives Markenwissen.'],
    rejectConsequence:['This proposal remains in history and will not become active Brand knowledge.','Dieser Vorschlag bleibt im Verlauf und wird nicht zu aktivem Markenwissen.'],
    successor:['Proposed update to an approved learning','Vorgeschlagene Aktualisierung eines bestätigten Learnings'],
    prior:['View original learning','Ursprüngliches Learning anzeigen'], inactive:['Inactive Brand knowledge','Inaktives Markenwissen'],
    saved:['Learning saved.','Learning gespeichert.'], loading:['Loading learnings…','Learnings werden geladen…'],
    retry:['Retry','Erneut versuchen'], reload:['Load current learning','Aktuelles Learning laden'],
    current:['Current saved statement','Aktuell gespeicherte Aussage'], newer:['Your text is retained. Review the current statement before saving again.','Dein Text bleibt erhalten. Prüfe die aktuelle Aussage vor dem erneuten Speichern.'],
    readonly:['You can view Learnings. Your access is read-only.','Du kannst Learnings ansehen. Dein Zugriff ist schreibgeschützt.'],
    discard:['Discard unsaved changes?','Ungespeicherte Änderungen verwerfen?'], discardAction:['Discard changes','Änderungen verwerfen'],
    keep:['Keep editing','Weiter bearbeiten'], more:['Next page','Nächste Seite'], first:['First page','Erste Seite'],
    member:['Brand member','Markenmitglied'], proposed:['Proposed','Vorgeschlagen'], proposal_edited:['Proposal edited','Vorschlag bearbeitet'],
    successor_proposed:['Update proposed','Aktualisierung vorgeschlagen'], superseded:['Superseded by an approved update','Durch bestätigte Aktualisierung ersetzt'],
    DUPLICATE_PROPOSAL:['An identical proposal already needs review.','Ein identischer Vorschlag wartet bereits auf Prüfung.'],
    DUPLICATE_APPROVED_LEARNING:['This learning is already approved.','Dieses Learning ist bereits bestätigt.'],
    STALE_LEARNING_REVISION:['This learning changed. Load the current version; your unsaved text is retained.','Dieses Learning wurde geändert. Lade die aktuelle Version; dein ungespeicherter Text bleibt erhalten.'],
    STALE_BRAND_REVISION:['The Brand changed. Load the current Brand context and try again.','Die Marke wurde geändert. Lade den aktuellen Markenkontext und versuche es erneut.'],
    INVALID_STATEMENT:['Enter a learning of 1–2000 characters and context of up to 4000 characters.','Gib eine Aussage mit 1–2000 Zeichen und Kontext mit bis zu 4000 Zeichen ein.'],
    INVALID_REQUEST:['Check your inputs and try again.','Prüfe deine Eingaben und versuche es erneut.'],
    INVALID_LIFECYCLE_TRANSITION:['This action is no longer available for this learning.','Diese Aktion ist für dieses Learning nicht mehr verfügbar.'],
    AUTHENTICATION_REQUIRED:['Sign in to view Learnings.','Melde dich an, um Learnings anzusehen.'],
    IDENTITY_INVALID:['Your account cannot access Learnings.','Dein Konto kann nicht auf Learnings zugreifen.'],
    BRAND_UNAVAILABLE:['This Brand is unavailable.','Diese Marke ist nicht verfügbar.'],
    BRAND_ACCESS_DENIED:['Your Brand access does not allow this action.','Dein Markenzugriff erlaubt diese Aktion nicht.'],
    LEARNING_UNAVAILABLE:['This learning is unavailable.','Dieses Learning ist nicht verfügbar.'],
    SCHEMA_UNAVAILABLE:['Learnings are temporarily unavailable. The rest of your Brand Profile remains available.','Learnings sind vorübergehend nicht verfügbar. Der Rest deines Markenprofils bleibt verfügbar.'],
    DATABASE_UNAVAILABLE:['Learnings could not be loaded or saved. Retry safely.','Learnings konnten nicht geladen oder gespeichert werden. Versuche es erneut.'],
    INTERNAL_ERROR:['The action could not be confirmed. Your inputs are retained.','Die Aktion konnte nicht bestätigt werden. Deine Eingaben bleiben erhalten.']
  };
  const normalized = value => String(value || '').normalize('NFKC').replace(/\s+/gu,' ').trim();
  function create(options) {
    const doc = options.document || root.document, fetchImpl = options.fetchImpl || root.fetch.bind(root);
    let host, alive = true, loaded = false, busy = false, data = null, error = '', filter = 'active', offset = 0, dialog = null;
    const advisor = root.FunklixLearningAdvisor?.create({ ...options, connected:() => !!host?.isConnected, reload:() => load() });
    const t = key => (COPY[key] || COPY.INTERNAL_ERROR)[options.language() === 'de' ? 1 : 0];
    const node = (tag, text, parent) => { const el = doc.createElement(tag); if (text) el.textContent = text; parent?.append(el); return el; };
    function button(key, parent, action) {
      const el = node('button', t(key), parent); el.type = 'button'; el.className = 'fk-btn fk-btn-secondary'; el.dataset.learningAction = key;
      el.disabled = busy; el.addEventListener('click', action); return el;
    }
    function date(value) { return new Intl.DateTimeFormat(options.language() === 'de' ? 'de-DE':'en-GB', { dateStyle:'medium', timeStyle:'short' }).format(new Date(value)); }
    const person = value => value === 'Brand member' ? t('member') : value;
    async function request(method = 'GET', body) {
      const controller = new root.AbortController(), timer = root.setTimeout(() => controller.abort(), 12000);
      try {
        const status = filter === 'active' ? 'all' : filter;
        const response = await fetchImpl(`/api/brands/${options.brand.id}/learnings?status=${status}&offset=${offset}`, {
          method, credentials:'same-origin', cache:'no-store', signal:controller.signal,
          headers:{ Accept:'application/json', ...(body ? {'Content-Type':'application/json'} : {}) }, ...(body ? { body:JSON.stringify(body) } : {}) });
        const result = await response.json().catch(() => null);
        if (!alive || !options.current()) return null;
        if (!response.ok) { const code = result?.error?.code; throw Object.assign(new Error(), { code:COPY[code] ? code:'INTERNAL_ERROR' }); }
        if (result?.contract !== 'brand_learnings_v1' || result.brand?.id !== options.brand.id || !Array.isArray(result.learnings)) throw new Error();
        if (method !== 'GET' && root.CustomEvent) root.dispatchEvent?.(new root.CustomEvent('funklix:brand-learnings-changed', { detail: { brandId: options.brand.id } }));
        return result;
      } finally { root.clearTimeout(timer); }
    }
    async function load() {
      if (busy || !alive || !options.current()) return;
      busy = true; error = ''; render();
      try { const result = await request(); if (result) { data = result; loaded = true; } }
      catch (e) { error = COPY[e.code] ? e.code : 'DATABASE_UNAVAILABLE'; }
      finally { busy = false; if (alive) render(); }
    }
    function focusOrigin(origin, id) {
      if (origin?.isConnected) origin.focus();
      else (host?.querySelector(`[data-learning-id="${id}"] button`) || host?.querySelector('button') || host)?.focus();
    }
    function open(row, action) {
      if (busy || dialog || !data?.can_write) return;
      const origin = doc.activeElement;
      dialog = node('dialog'); dialog.className = 'brand-learning-dialog'; dialog.setAttribute('aria-label', t(action === 'create' ? 'add' : action));
      doc.body.append(dialog);
      const heading = node('h2', t(action === 'create' ? 'add' : action), dialog);
      node('p', data.brand.name, dialog);
      let statement, evidence, pending = false, stale = false, expected = row?.revision, confirmation = false;
      const editing = ['create','edit','update'].includes(action);
      const base = { statement:normalized(row?.statement), evidence:normalized(row?.evidence_summary) };
      if (editing) {
        const field = (key, value, max) => { const label = node('label','',dialog); node('span',t(key),label); const el = node('textarea','',label); el.value = value || ''; el.rows = key === 'statement' ? 4:3; el.maxLength = max; el.dataset.learningField = key; el.required = key === 'statement'; return el; };
        statement = field('statement',row?.statement,8000); evidence = field('evidence',row?.evidence_summary,16000);
        if (action === 'update') node('p',t('successor'),dialog);
      } else { node('blockquote',row.statement,dialog); node('p',t(row.source_type === 'campaign_observation' ? 'observation':'manual'),dialog); node('p',t(action === 'approve' ? 'consequence' : action === 'archive' ? 'archiveConsequence':'rejectConsequence'),dialog); }
      const feedback = node('p','',dialog); feedback.setAttribute('role','status'); feedback.setAttribute('aria-live','polite');
      feedback.id='brand-learning-dialog-feedback';
      if (editing) { statement.setAttribute('aria-describedby',feedback.id); evidence.setAttribute('aria-describedby',feedback.id); }
      const currentStatement = node('p','',dialog);
      const actions = node('div','',dialog); actions.className = 'learning-actions';
      function close() { const old = dialog; dialog = null; old.close(); old.remove(); focusOrigin(origin, row?.id); }
      const dirty = () => editing && (normalized(statement.value) !== base.statement || normalized(evidence.value) !== base.evidence);
      function cancel() {
        if (pending) return;
        if (!dirty()) { close(); return; }
        if (confirmation) return;
        confirmation = true;
        const discard = node('div','',dialog); discard.className = 'learning-discard'; node('p',t('discard'),discard);
        button('keep',discard,() => { confirmation = false; discard.remove(); statement.focus(); });
        button('discardAction',discard,close).focus();
      }
      const save = button(editing ? 'save':action,actions,async () => {
        if (pending || stale) return;
        if (editing && (!normalized(statement.value) || Array.from(normalized(statement.value)).length > 2000 || Array.from(normalized(evidence.value)).length > 4000)) { feedback.textContent=t('INVALID_STATEMENT'); statement.focus(); return; }
        pending = true; save.disabled = cancelButton.disabled = true; feedback.textContent = t('loading');
        try {
          const body = action === 'create' ? { expected_brand_revision:data.brand.revision, statement:statement.value, evidence_summary:evidence.value }
            : { action:action === 'update' ? 'edit':action, learning_id:row.id, expected_revision:expected,
              ...(editing ? { statement:statement.value, evidence_summary:evidence.value }: {}) };
          const result = await request(action === 'create' ? 'POST':'PATCH', body);
          if (!result) return;
          data = result; loaded = true; error = ''; render(); close();
          const live = host?.querySelector('[data-learning-feedback]'); if (live) live.textContent=t('saved');
        } catch (e) {
          const code = COPY[e.code] ? e.code:'INTERNAL_ERROR'; feedback.textContent=t(code);
          stale = ['STALE_LEARNING_REVISION','STALE_BRAND_REVISION'].includes(code);
          if (['IDENTITY_INVALID','BRAND_ACCESS_DENIED','BRAND_UNAVAILABLE','AUTHENTICATION_REQUIRED'].includes(code)) {
            data.can_write = false; if (statement) statement.disabled = evidence.disabled = true; stale = true; render();
          }
          if (stale && !actions.querySelector('[data-learning-action="reload"]')) button('reload',actions,async () => {
            try {
              const result = await request(); if (!result) return; data = result; render();
              if (action !== 'create') {
                const current = result.learnings.find(l => l.id === row.id);
                if (!current || current.status !== row.status) { feedback.textContent=t('INVALID_LIFECYCLE_TRANSITION'); return; }
                expected = current.revision; currentStatement.textContent=`${t('current')}: ${current.statement}`;
                // A review must show the exact current statement, never a stale confirmation.
                if (!editing) { row = current; dialog.querySelector('blockquote').textContent=current.statement; }
              }
              stale = !result.can_write; save.disabled = stale; feedback.textContent=t('newer');
            } catch (failure) { feedback.textContent=t(COPY[failure.code] ? failure.code:'DATABASE_UNAVAILABLE'); }
          });
        } finally { pending = false; if (dialog) { save.disabled = stale; cancelButton.disabled = false; } }
      });
      save.className='fk-btn fk-btn-primary';
      const cancelButton = button('cancel',actions,cancel);
      dialog.addEventListener('cancel',event => { event.preventDefault(); cancel(); });
      dialog.addEventListener('keydown',event => {
        if (event.key !== 'Tab') return;
        const focusable = [...dialog.querySelectorAll('button,textarea')].filter(el => !el.disabled);
        const first=focusable[0], last=focusable.at(-1);
        if ((event.shiftKey && doc.activeElement === first) || (!event.shiftKey && doc.activeElement === last)) { event.preventDefault(); (event.shiftKey ? last:first)?.focus(); }
      });
      dialog.showModal(); (statement || cancelButton).focus(); heading.tabIndex=-1;
    }
    function render() {
      if (!host || !alive) return;
      host.replaceChildren(); host.className='brand-learnings'; host.tabIndex=-1;
      node('p',t('subtitle'),host);
      const feedback=node('p',error ? t(error):busy ? t('loading'):'',host); feedback.dataset.learningFeedback='true'; feedback.setAttribute('role','status'); feedback.setAttribute('aria-live','polite');
      if (error) { button('retry',host,load); return; }
      if (!data) return;
      const overview=node('div','',host); overview.className='learning-overview';
      for (const status of ['proposed','approved','archived']) node('span',`${t(status === 'proposed' ? 'review':status)}: ${data.counts[status] || 0}`,overview);
      if (data.can_write) {
        button('add',host,() => open(null,'create'));
        if (advisor && options.workspaceId) {
          const find = node('button',root.FunklixLearningAdvisor.COPY.find[options.language()==='de'?1:0],host);
          find.type='button'; find.className='fk-btn fk-btn-secondary'; find.dataset.learningAdvisorOpen='true';
          find.addEventListener('click',() => void advisor.open());
        }
      } else node('p',t('readonly'),host);
      const filters=node('div','',host); filters.className='learning-actions';
      for (const value of ['active','proposed','approved','rejected','archived','all']) {
        const b=button(value === 'proposed' ? 'review':value,filters,() => { filter=value; offset=0; void load(); }); b.setAttribute('aria-pressed',String(filter === value));
      }
      const rows=data.learnings.filter(row => filter !== 'active' || ['proposed','approved'].includes(row.status));
      if (!rows.length) node('p',t(Object.values(data.counts).some(Boolean) ? 'emptyFilter':'empty'),host);
      for (const row of rows) {
        const card=node('article','',host); card.className=`learning-card learning-${row.status}`; card.dataset.learningId=row.id;
        const title=node('h4',row.statement,card); title.id=`learning-title-${row.id}`; card.setAttribute('aria-labelledby',title.id);
        node('p',t(row.status === 'proposed' ? 'review':row.status),card);
        node('p',`${t(row.source_type === 'campaign_observation' ? 'observation':'manual')} · ${person(row.proposer)} · ${date(row.created_at)}`,card);
        if (row.source_type === 'campaign_observation') node('p',row.source_context?.available ? `${row.source_context.board_name} · ${row.source_context.node_title}` : t('sourceUnavailable'),card);
        if (row.updated_at !== row.created_at) node('p',date(row.updated_at),card);
        if (row.reviewed_at) node('p',`${person(row.reviewer)} · ${date(row.reviewed_at)}`,card);
        if (row.evidence_summary) node('p',row.evidence_summary,card);
        if (row.supersedes_learning_id) { node('p',t('successor'),card); button('prior',card,async () => {
          filter='all'; offset=0; await load(); const prior=host.querySelector(`[data-learning-id="${row.supersedes_learning_id}"]`); if (prior) { prior.tabIndex=-1; prior.focus(); }
        }); }
        if (['rejected','archived'].includes(row.status)) node('p',t('inactive'),card);
        const details=node('details','',card); node('summary',t('history'),details);
        for (const e of row.history || []) { const item=node('section','',details); node('p',`${t(e.event_type)} · ${person(e.actor)} · ${date(e.created_at)} · ${e.revision}`,item); node('p',e.statement,item); if(e.evidence_summary)node('p',e.evidence_summary,item); }
        if (data.can_write) { const actions=node('div','',card); actions.className='learning-actions';
          for (const action of row.status === 'proposed' ? ['edit','approve','reject']:row.status === 'approved' ? ['update','archive']:[]) {
            const control=button(action,actions,() => open(row,action)); control.setAttribute('aria-label',`${t(action)}: ${row.statement}`);
          }
        }
      }
      if (offset) button('first',host,() => { offset=0; void load(); });
      if (data.has_more) button('more',host,() => { offset+=50; void load(); });
    }
    return { attach(parent) { host=parent; render(); if (!loaded && !busy && !error) void load(); },
      invalidate() { alive=false; advisor?.invalidate(); if (dialog) { dialog.close(); dialog.remove(); dialog=null; } host=null; data=null; }, load };
  }
  return Object.freeze({ create, normalized, COPY });
}));
