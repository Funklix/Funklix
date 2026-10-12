(function(root) {
  'use strict';
  const COPY = {
    propose:['Propose Brand Learning','Markenwissen vorschlagen'], brand:['Receiving Brand','Empfangende Marke'], board:['Source Board','Quell-Board'], node:['Selected Node','Ausgewählter Knoten'],
    pending:['Save as pending','Zur Prüfung speichern'], fresh:['Validate source again','Quelle erneut prüfen'],
    saved:['This Learning awaits human review in Brand Profile.','Dieses Learning wartet im Markenprofil auf menschliche Prüfung.'],
    open:['Open Brand Learnings','Marken-Learnings öffnen'],
    changed:['The Board, account or selection changed. Your text is retained; cancel to return to the Canvas.','Board, Konto oder Auswahl wurde geändert. Dein Text bleibt erhalten; brich ab, um zum Canvas zurückzukehren.'],
    STALE_SOURCE:['The saved source changed. Your text is retained. Validate the source again and explicitly resubmit.','Die gespeicherte Quelle wurde geändert. Dein Text bleibt erhalten. Prüfe die Quelle erneut und sende den Vorschlag ausdrücklich noch einmal.'],
    SOURCE_UNAVAILABLE:['Source unavailable','Quelle nicht verfügbar'], SOURCE_ACCESS_DENIED:['Source unavailable','Quelle nicht verfügbar'], INVALID_SOURCE:['Source unavailable','Quelle nicht verfügbar']
  };
  function create(options) {
    const doc=options.document || root.document;
    let dialog=null, opening=false, origin=null, context=null, controls=null;
    const t=k => (COPY[k] || root.FunklixBrandLearnings.COPY[k] || root.FunklixBrandLearnings.COPY.INTERNAL_ERROR)[options.language()==='de'?1:0];
    const el=(tag,text,parent) => { const n=doc.createElement(tag); if(text)n.textContent=text; parent?.append(n);return n; };
    const button=(key,parent,fn) => {const b=el('button',t(key),parent);b.type='button';b.className='fk-btn fk-btn-secondary';b.dataset.proposalAction=key;b.addEventListener('click',fn);return b;};
    const current=() => options.context()?.key === context?.key;
    async function request(url,method='GET',body) {
      const controller=new root.AbortController(), timer=root.setTimeout(()=>controller.abort(),12000);
      try {
        const response=await (options.fetchImpl || root.fetch.bind(root))(url,{method,credentials:'same-origin',cache:'no-store',signal:controller.signal,
          headers:{Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
        const result=await response.json().catch(()=>null);
        if(!current())throw Object.assign(new Error(),{code:'changed'});
        if(!response.ok)throw Object.assign(new Error(),{code:result?.error?.code || 'INTERNAL_ERROR'});
        return result;
      } finally {root.clearTimeout(timer);}
    }
    async function preview(source) {
      const result=await request(`/api/brands/${context.brandId}/learning-source?${new URLSearchParams(source)}`);
      if(result?.contract!=='brand_learning_source_v1' || result.brand?.id!==context.brandId || result.source?.board_id!==context.boardId || result.source?.node_id!==context.nodeId)throw new Error();
      return result;
    }
    function close() {const old=dialog;dialog=null;controls=null;old?.close();old?.remove();if(origin?.isConnected)origin.focus();else options.focus?.();}
    function sync() {
      if(dialog && !current()) {controls.save.disabled=true;controls.refresh.disabled=true;controls.feedback.textContent=t('changed');}
    }
    async function open() {
      if(dialog || opening || !options.context())return;
      opening=true;context=options.context();origin=doc.activeElement;
      dialog=el('dialog');dialog.className='brand-learning-dialog';dialog.dataset.canvasLearningProposal='true';dialog.setAttribute('aria-label',t('propose'));doc.body.append(dialog);
      el('h2',t('propose'),dialog);
      const labels=el('div','',dialog), feedback=el('p',t('loading'),dialog);feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
      let data=null,pending=false,stale=true,confirmation=false;
      const field=(key,max) => {const label=el('label','',dialog);el('span',t(key),label);const n=el('textarea','',label);n.rows=key==='statement'?4:3;n.maxLength=max;n.dataset.proposalField=key;n.required=key==='statement';return n;};
      const statement=field('statement',8000),evidence=field('evidence',16000);statement.disabled=evidence.disabled=true;
      const actions=el('div','',dialog);actions.className='learning-actions';
      function showSource(result) {data=result;labels.replaceChildren();for(const [key,value] of [['brand',data.brand.name],['board',data.board_name],['node',data.node_title]])el('p',`${t(key)}: ${value}`,labels);stale=false;save.disabled=false;statement.disabled=evidence.disabled=false;feedback.textContent='';}
      function cancel() {
        if(pending)return;
        if(!statement.value && !evidence.value) {close();return;}
        if(confirmation)return;confirmation=true;
        const discard=el('div','',dialog);discard.className='learning-discard';el('p',t('discard'),discard);
        button('keep',discard,()=>{confirmation=false;discard.remove();statement.focus();});button('discardAction',discard,close).focus();
      }
      const save=button('pending',actions,async()=>{
        if(pending || stale || !current())return;
        const normalize=root.FunklixBrandLearnings.normalized;
        if(!normalize(statement.value) || Array.from(normalize(statement.value)).length>2000 || Array.from(normalize(evidence.value)).length>4000) {feedback.textContent=t('INVALID_STATEMENT');statement.focus();return;}
        pending=true;save.disabled=cancelButton.disabled=refresh.disabled=true;
        try {
          const result=await request(`/api/brands/${context.brandId}/learnings`,'POST',{statement:statement.value,evidence_summary:evidence.value,expected_brand_revision:data.brand.revision,source:data.source});
          if(result?.contract!=='brand_learnings_v1' || result.learning?.status!=='proposed')throw new Error();
          stale=true;statement.disabled=evidence.disabled=true;feedback.textContent=t('saved');save.hidden=refresh.hidden=true;
          button('open',actions,()=>{const brandId=context.brandId;close();options.openBrand(brandId);});
          // Saved content no longer has unsaved dirty state.
          statement.value=evidence.value='';
        } catch(error) {
          feedback.textContent=t(error.code || 'INTERNAL_ERROR');
          if(['STALE_SOURCE','STALE_BRAND_REVISION','SOURCE_UNAVAILABLE','SOURCE_ACCESS_DENIED','BRAND_ACCESS_DENIED','BRAND_UNAVAILABLE','IDENTITY_INVALID','AUTHENTICATION_REQUIRED','changed'].includes(error.code))stale=true;
        } finally {pending=false;if(dialog){save.disabled=stale || !current();cancelButton.disabled=false;refresh.disabled=!current();}}
      });save.className='fk-btn fk-btn-primary';save.disabled=true;
      const refresh=button('fresh',actions,async()=>{
        if(pending || !current())return;
        pending=true;save.disabled=refresh.disabled=cancelButton.disabled=true;
        try {
          const board=await request(`/api/boards/${context.boardId}`);
          if(board.id!==context.boardId || board.brand_id!==context.brandId || !board.updated_at)throw Object.assign(new Error(),{code:'SOURCE_UNAVAILABLE'});
          showSource(await preview({board_id:context.boardId,node_id:context.nodeId,expected_board_updated_at:board.updated_at}));
        } catch(error){stale=true;feedback.textContent=t(error.code || 'INTERNAL_ERROR');}
        finally {pending=false;if(dialog){save.disabled=stale || !current();refresh.disabled=!current();cancelButton.disabled=false;}}
      });
      const cancelButton=button('cancel',actions,cancel);controls={save,refresh,feedback};
      dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
      dialog.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancel();return;}
        if(event.key!=='Tab')return;
        const focusable=[...dialog.querySelectorAll('button,textarea')].filter(n=>!n.disabled&&!n.hidden&&n.getClientRects().length);
        const first=focusable[0],last=focusable.at(-1);
        if((event.shiftKey&&doc.activeElement===first)||(!event.shiftKey&&doc.activeElement===last)){event.preventDefault();(event.shiftKey?last:first)?.focus();}
      });
      dialog.showModal();cancelButton.focus();
      try {showSource(await preview({board_id:context.boardId,node_id:context.nodeId,expected_board_updated_at:context.updatedAt}));statement.focus();}
      catch(error){if(dialog)feedback.textContent=t(error.code || 'INTERNAL_ERROR');}
      finally {opening=false;}
    }
    return {open,sync};
  }
  root.FunklixCanvasLearningProposal=Object.freeze({create,COPY});
}(typeof globalThis!=='undefined'?globalThis:window));
