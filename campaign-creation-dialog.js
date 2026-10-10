(function(root){
  'use strict';
  const COPY={
    en:{title:'Create campaign',description:'Start your campaign in this project. Your saved Brand information is already available.',workspace:'Workspace',project:'Project',brand:'Brand',idea:'Campaign goal or idea',context:'Additional context (optional)',cancel:'Cancel',pending:'Creating campaign…',open:'Open campaign',reload:'Reload campaign',
      VALIDATION:'Enter a campaign goal or idea.',BOARD_MISSING:'Open a project before creating a campaign.',BRAND_MISSING:'Assign a Brand to this project before creating a campaign.',PERMISSION_DENIED:'You need editing access to this project.',AUTHENTICATION_REQUIRED:'Sign in again to create a campaign.',CONFLICT:'The project context changed. Close this dialog and reopen the project.',STALE_REVISION:'The project changed. Reopen it to use the latest version.',DIRTY:'Save your project changes before creating a campaign.',NETWORK:'The server could not be reached. Retry with your entries.',SAVE_FAILED:'The campaign could not be saved. Retry with your entries.',OUTCOME_UNKNOWN:'The result is not confirmed. Retry safely to recover the same campaign.',RESPONSE_INVALID:'The result could not be confirmed. Retry safely.',OPEN_FAILED:'Your campaign was created, but could not be opened. Try opening it again.',projects:'Open projects',assign:'Assign Brand'},
    de:{title:'Kampagne erstellen',description:'Starte deine Kampagne in diesem Projekt. Deine gespeicherten Markeninformationen stehen bereits bereit.',workspace:'Workspace',project:'Projekt',brand:'Marke',idea:'Kampagnenziel oder Idee',context:'Zusätzlicher Kontext (optional)',cancel:'Abbrechen',pending:'Kampagne wird erstellt…',open:'Kampagne öffnen',reload:'Kampagne neu laden',
      VALIDATION:'Gib ein Kampagnenziel oder eine Idee ein.',BOARD_MISSING:'Öffne ein Projekt, bevor du eine Kampagne erstellst.',BRAND_MISSING:'Weise diesem Projekt zuerst eine Marke zu.',PERMISSION_DENIED:'Du benötigst Bearbeitungsrechte für dieses Projekt.',AUTHENTICATION_REQUIRED:'Melde dich erneut an, um eine Kampagne zu erstellen.',CONFLICT:'Der Projektkontext hat sich geändert. Schließe diesen Dialog und öffne das Projekt erneut.',STALE_REVISION:'Das Projekt hat sich geändert. Öffne es erneut, um die aktuelle Version zu verwenden.',DIRTY:'Speichere deine Projektänderungen, bevor du eine Kampagne erstellst.',NETWORK:'Der Server ist nicht erreichbar. Versuche es mit deinen Eingaben erneut.',SAVE_FAILED:'Die Kampagne konnte nicht gespeichert werden. Versuche es mit deinen Eingaben erneut.',OUTCOME_UNKNOWN:'Das Ergebnis ist nicht bestätigt. Wiederhole den Vorgang sicher, um dieselbe Kampagne wiederherzustellen.',RESPONSE_INVALID:'Das Ergebnis konnte nicht bestätigt werden. Versuche es sicher erneut.',OPEN_FAILED:'Deine Kampagne wurde erstellt, konnte aber nicht geöffnet werden. Versuche das Öffnen erneut.',projects:'Projekte öffnen',assign:'Marke zuweisen'}
  };
  const copy=lang=>COPY[lang==='de'?'de':'en'];
  function mount({context,language='en',submit,normalize,counts,onClose=()=>{}}){
    const doc=root.document,t=copy(language),de=language==='de',origin=doc.activeElement;
    let pending=false,closed=false,step=1;
    const dialog=doc.createElement('dialog');dialog.id='campaign-creation-dialog';dialog.className='campaign-creation-dialog';dialog.setAttribute('aria-labelledby','campaign-creation-title');dialog.setAttribute('aria-label',t.title);
    const add=(tag,text,parent)=>{const n=doc.createElement(tag);if(text)n.textContent=text;(parent||modal).append(n);return n;};
    const modal=doc.createElement('div');modal.className='campaign-builder-modal';dialog.append(modal);
    add('h2',t.title).id='campaign-creation-title';add('p',t.description).id='campaign-creation-description';
    const summary=add('section');summary.className='campaign-creation-context';
    add('p',`${t.workspace}: ${context.workspace.name}`,summary);add('p',`${t.project}: ${context.board.name}`,summary);
    const brand=add('div',null,summary),logo=add('span',null,brand);root.FunklixBrandLogo.render(logo,context.brand,{label:t.brand});add('span',`${t.brand}: ${context.brand.name}`,brand);
    const heading=add('h3',de?'Schritt 1: Kampagnenbrief':'Step 1: Campaign brief');heading.id='campaign-creation-step';
    const form=add('form');form.noValidate=true;
    const brief=add('section',null,form),structure=add('section',null,form);structure.hidden=true;
    const label=add('label',t.idea,brief),idea=add('textarea',null,brief);idea.className='fk-textarea';idea.id='campaign-creation-idea';idea.rows=3;idea.maxLength=2000;idea.required=true;label.htmlFor=idea.id;
    const optional=add('label',t.context,brief),notes=add('textarea',null,brief);notes.className='fk-textarea';notes.id='campaign-creation-context';notes.rows=2;notes.maxLength=4000;optional.htmlFor=notes.id;
    const field=(name,id,tag='input')=>{const label=add('label',name,structure),n=add(tag,null,structure);n.id=id;label.htmlFor=id;n.className=tag==='select'?'fk-select':'fk-input';return n;};
    const channel=field(de?'Kanal':'Channel','campaign-v3-channel','select');
    for(const name of ['LinkedIn','Facebook','X','Instagram','TikTok','Mixed']){const option=add('option',name,channel);option.value=name;}
    const defaults=normalize({postsPerVariation:3});
    const variations=field(de?'Kampagnenvarianten':'Campaign Variations','campaign-v3-variations');variations.type='number';variations.min=1;variations.max=10;variations.value=defaults.variationCount;
    const posts=field(de?'Posts je Variante':'Posts per Variation','campaign-v3-posts');posts.type='number';posts.min=1;posts.max=20;posts.value=defaults.postsPerVariation;
    const landing=field('Landing Page','campaign-v3-include-landing');landing.type='checkbox';landing.checked=true;
    const email=field('Email Campaign','campaign-v3-include-email');email.type='checkbox';email.checked=true;
    const estimate=add('p',null,structure);estimate.id='campaign-creation-estimate';estimate.setAttribute('aria-live','polite');
    const setup=()=>normalize({variationCount:variations.value,postsPerVariation:posts.value,channel:channel.value,includeLandingPage:landing.checked,includeEmailCampaign:email.checked});
    const update=()=>{const value=setup(),c=counts(value);const names={Idea:de?'Idee':'Idea','Campaign Variation':de?'Varianten':'Variations',Content:de?'Inhalte':'Content pieces','Social Media Posting':de?'Social Posts':'Social posts','Landing Page':'Landing Page','Email Campaign':'Email Campaign'};estimate.textContent=Object.entries(c).filter(([,n])=>n).map(([type,n])=>`${type==='Social Media Posting'?`${value.variationCount} × ${value.postsPerVariation} = `:''}${n} ${names[type]}`).join(' · ')+` · ${de?'Assets insgesamt':'Total assets'}: ${Object.values(c).reduce((a,b)=>a+b,0)}`;};
    structure.addEventListener('input',update);structure.addEventListener('change',update);update();
    const status=add('p',null,form);status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.id='campaign-creation-status';
    const actions=add('div',null,form);actions.className='campaign-creation-actions';
    const button=(text,kind,type='button')=>{const b=add('button',text,actions);b.type=type;b.className=`fk-btn fk-btn-${kind}`;return b;};
    const cancel=button(t.cancel,'secondary'),back=button(de?'Zurück':'Back','secondary'),confirm=button(de?'Weiter':'Continue','primary','submit');back.hidden=true;
    const showStep=n=>{step=n;brief.hidden=n!==1;structure.hidden=n!==2;back.hidden=n!==2;heading.textContent=n===1?(de?'Schritt 1: Kampagnenbrief':'Step 1: Campaign brief'):(de?'Schritt 2: Kampagnenstruktur':'Step 2: Campaign structure');confirm.textContent=n===1?(de?'Weiter':'Continue'):(de?'Kampagne generieren':'Generate Campaign');status.textContent='';(n===1?idea:channel).focus();};
    const close=()=>{if(dialog.dataset.campaignV3Busy==='true'||closed)return;closed=true;dialog.close();dialog.remove();origin?.isConnected&&origin.focus();onClose();};
    cancel.addEventListener('click',close);back.addEventListener('click',()=>showStep(1));dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
    dialog.addEventListener('keydown',e=>{if(e.key!=='Tab')return;const controls=[...dialog.querySelectorAll('input,textarea,select,button,a[href]')].filter(n=>!n.disabled&&n.getClientRects().length);const first=controls[0],last=controls.at(-1);if(e.shiftKey&&doc.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&doc.activeElement===last){e.preventDefault();first?.focus();}});
    form.addEventListener('submit',e=>{
      e.preventDefault();if(pending||closed)return;
      if(!idea.value.trim()){status.textContent=t.VALIDATION;idea.focus();return;}
      if(step===1){showStep(2);return;}
      if(!variations.checkValidity()||!posts.checkValidity()){status.textContent=de?'Wähle 1–10 Varianten und 1–20 Posts je Variante.':'Choose 1–10 variations and 1–20 posts per variation.';return;}
      pending=true;dialog.dataset.campaignV3Busy='true';[...form.elements].forEach(n=>n.disabled=true);
      submit({campaignIdea:idea.value.trim(),additionalContext:notes.value.trim(),...setup()});
    });
    doc.body.append(dialog);dialog.showModal();idea.focus();return {dialog,close,suspendAutosave:false};
  }
  root.FunklixCampaignCreationDialog=Object.freeze({mount,copy});
}(typeof globalThis!=='undefined'?globalThis:window));
