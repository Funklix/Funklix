(function(root){
  'use strict';
  const COPY={
    en:{title:'Create project',project:'Project',brand:'Brand',context:'Active Workspace',name:'Project name',description:'Your Project becomes the campaign Board.',continue:'Continue',back:'Back',cancel:'Cancel',create:'Create project',newBrand:'Create a new Brand',brandName:'Brand name',readOnly:'Read only',pending:'Creating project…',open:'Open project',setup:'This new Brand Profile belongs to your created Project. Edit the reusable Brand here; guided setup comes later.',toProject:'Continue to project',
      validation:'Enter a valid name and choose an available Brand.',authentication:'Sign in again to create a project.',permission:'You do not have permission for this Workspace or Brand.',not_found:'This Workspace or Brand is no longer available.',conflict:'The context or request changed. Review your selection.',network:'The database is temporarily unavailable. Retry safely.',outcome_unknown:'The result is not confirmed. Retry with the same command to recover it safely.',integrity:'The response could not be confirmed. Retry the same command.',internal:'The project could not be confirmed. Retry safely.',openFailed:'The project was created but could not be opened. Retry opening it.'},
    de:{title:'Projekt erstellen',project:'Projekt',brand:'Marke',context:'Aktiver Workspace',name:'Projektname',description:'Dein Projekt wird zum Kampagnen-Board.',continue:'Weiter',back:'Zurück',cancel:'Abbrechen',create:'Projekt erstellen',newBrand:'Neue Marke erstellen',brandName:'Markenname',readOnly:'Nur Lesen',pending:'Projekt wird erstellt…',open:'Projekt öffnen',setup:'Dieses neue Markenprofil gehört zu deinem erstellten Projekt. Bearbeite hier die gemeinsame Marke; die geführte Einrichtung folgt später.',toProject:'Weiter zum Projekt',
      validation:'Gib einen gültigen Namen ein und wähle eine verfügbare Marke.',authentication:'Melde dich erneut an, um ein Projekt zu erstellen.',permission:'Du hast keine Berechtigung für diesen Workspace oder diese Marke.',not_found:'Dieser Workspace oder diese Marke ist nicht mehr verfügbar.',conflict:'Der Kontext oder die Anfrage hat sich geändert. Prüfe deine Auswahl.',network:'Die Datenbank ist vorübergehend nicht verfügbar. Versuche es sicher erneut.',outcome_unknown:'Das Ergebnis ist nicht bestätigt. Wiederhole denselben Befehl, um es sicher wiederherzustellen.',integrity:'Die Antwort konnte nicht bestätigt werden. Wiederhole denselben Befehl.',internal:'Das Projekt konnte nicht bestätigt werden. Versuche es sicher erneut.',openFailed:'Das Projekt wurde erstellt, konnte aber nicht geöffnet werden. Versuche das Öffnen erneut.'}
  };
  const localized=(key,language)=>root.FunklixLanguage?.t?.(key,language)||key;
  const copy=language=>({...COPY[language==='de'?'de':'en'],newBrand:localized('Start with a new Brand',language),setup:localized('These details help shape your future campaigns.',language)});
  function message(code,language){return code==='OPEN_FAILED'?copy(language).openFailed:copy(language)[root.FunklixProjectCommand.CATEGORIES[code]||'internal'];}
  function mount({document:doc=root.document,workspace,language='en',submit,requestId,onClose=()=>{}}){
    const t=copy(language),origin=doc.activeElement;
    let step=1,pending=false,choice=null,command=null,closed=false,setupWebsite='';
    const dialog=doc.createElement('dialog');dialog.className='project-dialog';dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','project-dialog-title');dialog.setAttribute('aria-describedby','project-dialog-description');
    function node(tag,text,parent=dialog){const n=doc.createElement(tag);if(text)n.textContent=text;parent.append(n);return n;}
    const heading=node('h2',t.title);heading.id='project-dialog-title';
    const steps=node('ol');steps.className='project-steps';steps.setAttribute('aria-label',language==='de'?'Schritte':'Steps');const stepLabels=[t.project,t.brand,t.create].map(text=>node('li',text,steps));
    const description=node('p',t.description);description.id='project-dialog-description';
    const context=node('p',`${t.context}: ${workspace.name}`);context.className='project-context';
    const form=node('form');form.noValidate=true;
    const first=node('section',null,form),second=node('section',null,form);second.hidden=true;
    const nameLabel=node('label',t.name,first),projectName=node('input',null,first);projectName.id='project-name';projectName.name='project_name';projectName.maxLength=160;nameLabel.htmlFor=projectName.id;
    const cards=node('div',null,second);cards.className='project-brand-cards';cards.setAttribute('role','radiogroup');cards.setAttribute('aria-label',t.brand);
    const radios=[], allowed=new Map(),brandViews=new Map();
    function card(brand,isNew=false){
      const button=node('button',null,cards);button.type='button';button.className='project-brand-card';button.setAttribute('role','radio');button.setAttribute('aria-checked','false');button.tabIndex=radios.length? -1:0;
      button.disabled=isNew?!['owner','admin'].includes(workspace.role):!['owner','admin','editor'].includes(brand.role);
      allowed.set(button,!button.disabled);
      const logo=node('span',null,button);logo.className='project-brand-logo';
      if(isNew)logo.textContent='+';
      else if(root.FunklixBrandLogo)root.FunklixBrandLogo.render(logo,brand);
      else logo.textContent=Array.from(brand.name.trim()).slice(0,2).join('').toLocaleUpperCase();
      const label=node('span',isNew?t.newBrand:brand.name,button);label.className='project-brand-label';
      if(!isNew)brandViews.set(brand.id,{brand,logo,label,radio:button});
      const selection=node('small',localized('Choose',language),button);selection.className='project-brand-selection';
      if(button.disabled)node('small',t.readOnly,button);
      button.addEventListener('click',()=>{if(pending||command||button.disabled)return;choice=isNew?{new_name:''}:{existing_id:brand.id};radios.forEach(r=>{r.setAttribute('aria-checked',String(r===button));r.tabIndex=r===button?0:-1;const marker=r.querySelector?.('.project-brand-selection');if(marker)marker.textContent=localized(r===button?'Selected':'Choose',language);});brandLabel.hidden=brandName.hidden=websiteLabel.hidden=websiteInput.hidden=!isNew;status.textContent='';if(isNew)brandName.focus();});
      button.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const available=radios.filter(r=>!r.disabled);let index=available.indexOf(button);index=event.key==='Home'?0:event.key==='End'?available.length-1:(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+available.length)%available.length;available[index]?.focus();available[index]?.click();});
      radios.push(button);
    }
    workspace.brands.forEach(brand=>card(brand));card(null,true);radios.forEach(r=>r.tabIndex=-1);const firstAvailable=radios.find(r=>!r.disabled);if(firstAvailable)firstAvailable.tabIndex=0;
    const brandLabel=node('label',t.brandName,second),brandName=node('input',null,second);brandName.id='project-brand-name';brandName.maxLength=160;brandLabel.htmlFor=brandName.id;brandName.hidden=brandLabel.hidden=true;
    const websiteLabel=node('label',localized('Website (optional)',language),second),websiteInput=node('input',null,second);websiteInput.id='project-brand-website';websiteInput.maxLength=2048;websiteLabel.htmlFor=websiteInput.id;websiteLabel.hidden=websiteInput.hidden=true;
    const status=node('p',null,form);status.className='project-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
    const actions=node('div',null,form);actions.className='project-actions';
    const back=node('button',t.back,actions);back.type='button';back.hidden=true;
    const cancel=node('button',t.cancel,actions);cancel.type='button';
    const confirm=node('button',t.continue,actions);confirm.type='submit';confirm.className='fk-btn-primary';
    function render(){first.hidden=step!==1;second.hidden=step!==2;back.hidden=step!==2;confirm.textContent=pending?t.pending:step===1?t.continue:t.create;stepLabels.forEach((label,index)=>label.setAttribute('aria-current',index+1===(pending?3:step)?'step':'false'));}
    function close(){if(pending||closed)return;closed=true;dialog.close();dialog.remove();if(origin?.isConnected&&!doc.querySelector?.('dialog[open]'))origin.focus();onClose();}
    function busy(value){pending=value;dialog.setAttribute('aria-busy',String(value));[back,cancel,confirm].forEach(n=>n.disabled=value);projectName.disabled=brandName.disabled=websiteInput.disabled=value||!!command;radios.forEach(n=>{n.disabled=value||!!command||!allowed.get(n);});render();}
    cancel.addEventListener('click',close);
    dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
    back.addEventListener('click',()=>{if(pending||command)return;step=1;render();projectName.focus();});
    form.addEventListener('submit',async event=>{
      event.preventDefault();if(pending)return;
      try{
        root.FunklixProjectCommand.name(projectName.value);
        if(step===1){step=2;render();(radios.find(r=>!r.disabled)||cancel).focus();return;}
        if(!command){if(!choice)throw root.FunklixProjectCommand.error('REQUEST_INVALID');if(!choice.existing_id&&websiteInput.value.trim()){try{setupWebsite=root.FunklixBrandProfileSetup.website(websiteInput.value);}catch{status.textContent=localized('Enter a valid public HTTPS website.',language);return;}}command=root.FunklixProjectCommand.build(workspace.id,projectName.value,choice.existing_id?choice:{new_name:brandName.value},requestId());}
        busy(true);status.textContent=t.pending;
        await submit(command,{website:setupWebsite});if(closed)return;pending=false;close();
      }catch(error){if(closed)return;if(!['OUTCOME_UNKNOWN','RESPONSE_INVALID','DATABASE_UNAVAILABLE','SCHEMA_UNAVAILABLE','INTERNAL_ERROR','OPEN_FAILED'].includes(error.code))command=null;status.textContent=message(error.code,language);busy(false);if(command){confirm.textContent=error.code==='OPEN_FAILED'?t.open:t.create;back.disabled=true;}}
    });
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();close();}
      if(event.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button,input')].filter(n=>!n.disabled&&!n.hidden&&!n.closest('section[hidden]'));
      const firstControl=controls[0],last=controls[controls.length-1];
      if(event.shiftKey&&doc.activeElement===firstControl){event.preventDefault();last?.focus();}
      else if(!event.shiftKey&&doc.activeElement===last){event.preventDefault();firstControl?.focus();}
    });
    doc.body.append(dialog);render();dialog.showModal();projectName.focus();
    return {dialog,removeBrand(id){if(closed)return;const view=brandViews.get(id);if(!view)return;view.radio.remove();allowed.delete(view.radio);const radioIndex=radios.indexOf(view.radio);if(radioIndex>=0)radios.splice(radioIndex,1);const index=workspace.brands.findIndex(b=>b.id===id);if(index>=0)workspace={...workspace,brands:workspace.brands.filter(b=>b.id!==id)};if(choice?.existing_id===id){choice=null;command=null;}brandViews.delete(id);render();},reconcileBrand(id,projection){const view=brandViews.get(id);if(closed||!view)return;view.brand={...view.brand,...projection};view.label.textContent=view.brand.name;root.FunklixBrandLogo?.render(view.logo,view.brand);},invalidate(){closed=true;dialog.close();dialog.remove();onClose();}};
  }
  root.FunklixProjectDialog=Object.freeze({mount,copy,message});
}(typeof globalThis!=='undefined'?globalThis:window));
