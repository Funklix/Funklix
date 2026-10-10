(function(root){
  'use strict';
  const COPY={
    en:{title:'Create campaign',description:'Start your campaign in this project. Your saved Brand information is already available.',workspace:'Workspace',project:'Project',brand:'Brand',idea:'Campaign goal or idea',context:'Additional context (optional)',cancel:'Cancel',pending:'Creating campaign…',open:'Open campaign',reload:'Reload campaign',
      VALIDATION:'Enter a campaign goal or idea.',BOARD_MISSING:'Open a project before creating a campaign.',BRAND_MISSING:'Assign a Brand to this project before creating a campaign.',PERMISSION_DENIED:'You need editing access to this project.',AUTHENTICATION_REQUIRED:'Sign in again to create a campaign.',CONFLICT:'The project context changed. Close this dialog and reopen the project.',STALE_REVISION:'The project changed. Reopen it to use the latest version.',DIRTY:'Save your project changes before creating a campaign.',NETWORK:'The server could not be reached. Retry with your entries.',SAVE_FAILED:'The campaign could not be saved. Retry with your entries.',OUTCOME_UNKNOWN:'The result is not confirmed. Retry safely to recover the same campaign.',RESPONSE_INVALID:'The result could not be confirmed. Retry safely.',OPEN_FAILED:'Your campaign was created, but could not be opened. Try opening it again.',projects:'Open projects',assign:'Assign Brand'},
    de:{title:'Kampagne erstellen',description:'Starte deine Kampagne in diesem Projekt. Deine gespeicherten Markeninformationen stehen bereits bereit.',workspace:'Workspace',project:'Projekt',brand:'Marke',idea:'Kampagnenziel oder Idee',context:'Zusätzlicher Kontext (optional)',cancel:'Abbrechen',pending:'Kampagne wird erstellt…',open:'Kampagne öffnen',reload:'Kampagne neu laden',
      VALIDATION:'Gib ein Kampagnenziel oder eine Idee ein.',BOARD_MISSING:'Öffne ein Projekt, bevor du eine Kampagne erstellst.',BRAND_MISSING:'Weise diesem Projekt zuerst eine Marke zu.',PERMISSION_DENIED:'Du benötigst Bearbeitungsrechte für dieses Projekt.',AUTHENTICATION_REQUIRED:'Melde dich erneut an, um eine Kampagne zu erstellen.',CONFLICT:'Der Projektkontext hat sich geändert. Schließe diesen Dialog und öffne das Projekt erneut.',STALE_REVISION:'Das Projekt hat sich geändert. Öffne es erneut, um die aktuelle Version zu verwenden.',DIRTY:'Speichere deine Projektänderungen, bevor du eine Kampagne erstellst.',NETWORK:'Der Server ist nicht erreichbar. Versuche es mit deinen Eingaben erneut.',SAVE_FAILED:'Die Kampagne konnte nicht gespeichert werden. Versuche es mit deinen Eingaben erneut.',OUTCOME_UNKNOWN:'Das Ergebnis ist nicht bestätigt. Wiederhole den Vorgang sicher, um dieselbe Kampagne wiederherzustellen.',RESPONSE_INVALID:'Das Ergebnis konnte nicht bestätigt werden. Versuche es sicher erneut.',OPEN_FAILED:'Deine Kampagne wurde erstellt, konnte aber nicht geöffnet werden. Versuche das Öffnen erneut.',projects:'Projekte öffnen',assign:'Marke zuweisen'}
  };
  const copy=lang=>COPY[lang==='de'?'de':'en'];
  function mount({context,language='en',submit,onClose=()=>{}}){
    const doc=root.document,t=copy(language),origin=doc.activeElement;
    let pending=false,closed=false,command=null;
    const dialog=doc.createElement('dialog');dialog.id='campaign-creation-dialog';dialog.className='campaign-creation-dialog';dialog.setAttribute('aria-labelledby','campaign-creation-title');dialog.setAttribute('aria-describedby','campaign-creation-description');
    const add=(tag,text,parent=dialog)=>{const n=doc.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;};
    add('h2',t.title).id='campaign-creation-title';add('p',t.description).id='campaign-creation-description';
    const summary=add('section');summary.className='campaign-creation-context';
    add('p',`${t.workspace}: ${context.workspace.name}`,summary);add('p',`${t.project}: ${context.board.name}`,summary);
    const brand=add('div',null,summary),logo=add('span',null,brand);root.FunklixBrandLogo.render(logo,context.brand,{label:t.brand});add('span',`${t.brand}: ${context.brand.name}`,brand);
    const form=add('form');form.noValidate=true;
    const label=add('label',t.idea,form),idea=add('textarea',null,form);idea.id='campaign-creation-idea';idea.rows=3;idea.maxLength=2000;idea.required=true;label.htmlFor=idea.id;
    const optional=add('label',t.context,form),notes=add('textarea',null,form);notes.id='campaign-creation-context';notes.rows=2;notes.maxLength=4000;optional.htmlFor=notes.id;
    const status=add('p',null,form);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.id='campaign-creation-status';
    const actions=add('div',null,form);actions.className='campaign-creation-actions';
    const recovery=add('a',t.reload,actions);recovery.hidden=true;recovery.className='campaign-creation-recovery';
    const cancel=add('button',t.cancel,actions);cancel.type='button';const confirm=add('button',t.title,actions);confirm.type='submit';confirm.className='fk-btn-primary';
    const close=()=>{if(pending||closed)return;closed=true;dialog.close();dialog.remove();origin?.isConnected&&origin.focus();onClose();};
    cancel.addEventListener('click',close);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key!=='Tab')return;const controls=[idea,notes,recovery,cancel,confirm].filter(n=>!n.disabled&&!n.hidden);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus();}});
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(pending||closed)return;
      try{
        command=command||root.FunklixCampaignCreation.request({contract:root.FunklixCampaignCreation.CONTRACT,request_id:root.crypto.randomUUID(),board_id:context.board.id,workspace_id:context.workspace.id,brand_id:context.brand.id,board_revision:context.board.updated_at,idea:idea.value,context:notes.value});
        pending=true;dialog.setAttribute('aria-busy','true');[idea,notes,cancel,confirm].forEach(n=>n.disabled=true);confirm.textContent=t.pending;status.textContent=t.pending;
        await submit(command);pending=false;close();
      }catch(error){
        if(closed)return;pending=false;dialog.setAttribute('aria-busy','false');status.textContent=t[error.code]||t.SAVE_FAILED;
        const blocked=['CONFLICT','STALE_REVISION','PERMISSION_DENIED','AUTHENTICATION_REQUIRED','BOARD_MISSING','BRAND_MISSING','DIRTY'].includes(error.code);
        if(error.code==='VALIDATION')command=null;
        if(error.code==='OPEN_FAILED'&&error.outcome?.next_route){recovery.href=error.outcome.next_route;recovery.hidden=false;}
        idea.disabled=notes.disabled=!!command;cancel.disabled=false;confirm.disabled=blocked;confirm.textContent=error.code==='OPEN_FAILED'?t.open:t.title;
      }
    });
    doc.body.append(dialog);dialog.showModal();idea.focus();return {dialog,close};
  }
  root.FunklixCampaignCreationDialog=Object.freeze({mount,copy});
}(typeof globalThis!=='undefined'?globalThis:window));
