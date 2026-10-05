(function (root) {
  'use strict';

  const STRINGS = Object.freeze({
    en: { workspace:'Workspace', switchWorkspace:'Switch workspace', chooseWorkspace:'Choose a workspace', noWorkspace:'No workspace available', unavailable:'Workspace unavailable', brand:'Brand', chooseBrand:'Choose a Brand', noBrands:'No brands in this workspace', noBrandAssigned:'No Brand assigned', profile:'Brand Profile', openProfile:'Open profile', readOnly:'Your access is read-only', loading:'Loading workspaces…', actions:'Workspace actions', rename:'Rename workspace', workspaceName:'Workspace name', saveName:'Save name', cancel:'Cancel', renamed:'Workspace renamed', enterName:'Enter a workspace name', tooLong:'This name is too long', changed:'The workspace changed. Refresh and try again.', denied:'You do not have permission to rename this workspace.', renameFailed:'The workspace could not be renamed. Try again.', oneBrand:'1 Brand', manyBrands:'{count} Brands', noBrandCount:'No Brands' },
    de: { workspace:'Workspace', switchWorkspace:'Workspace wechseln', chooseWorkspace:'Workspace auswählen', noWorkspace:'Kein Workspace verfügbar', unavailable:'Workspace nicht verfügbar', brand:'Marke', chooseBrand:'Marke auswählen', noBrands:'Keine Marken in diesem Workspace', noBrandAssigned:'Keine Marke zugewiesen', profile:'Markenprofil', openProfile:'Profil öffnen', readOnly:'Dein Zugriff ist schreibgeschützt', loading:'Workspaces werden geladen…', actions:'Workspace-Aktionen', rename:'Workspace umbenennen', workspaceName:'Workspace-Name', saveName:'Namen speichern', cancel:'Abbrechen', renamed:'Workspace umbenannt', enterName:'Gib einen Workspace-Namen ein', tooLong:'Dieser Name ist zu lang', changed:'Der Workspace wurde geändert. Aktualisiere die Ansicht und versuche es erneut.', denied:'Du darfst diesen Workspace nicht umbenennen.', renameFailed:'Der Workspace konnte nicht umbenannt werden. Versuche es erneut.', oneBrand:'1 Marke', manyBrands:'{count} Marken', noBrandCount:'Keine Marken' }
  });
  function words(value) { return Array.from(String(value || '').trim().normalize('NFC').split(/\s+/).filter(Boolean).map((part) => Array.from(part)[0] || '').join('')).slice(0, 2).join('').toLocaleUpperCase() || '•'; }
  function workspace(catalog, id) { return (catalog?.workspaces || []).find((item) => item.id === id) || null; }
  function board(catalog, id) { return (catalog?.workspaces || []).flatMap((item) => item.boards).find((item) => item.id === id) || null; }
  function brand(catalog, id) { return (catalog?.workspaces || []).flatMap((item) => item.brands).find((item) => item.id === id) || null; }
  function derive(catalog, context = {}) {
    const workspaces = catalog?.workspaces || [];
    const activeBoard = board(catalog, context.boardId);
    const selectedWorkspaceId = workspace(catalog, context.activeWorkspaceId)?.id || null;
    const activeWorkspaceId = activeBoard?.workspace_id || brand(catalog, context.brandId)?.workspace_id || selectedWorkspaceId || (workspaces.length === 1 ? workspaces[0].id : null);
    const activeWorkspace = workspace(catalog, activeWorkspaceId);
    const brands = activeWorkspace?.brands || [];
    const boardBrand = activeBoard && activeBoard.workspace_id === activeWorkspaceId ? activeBoard.brand_id : undefined;
    let brandId = boardBrand === null ? null : (brand(catalog, boardBrand)?.id || (brands.some((item) => item.id === context.brandId) ? context.brandId : null));
    if (boardBrand === undefined && brands.length === 1) brandId = brands[0].id;
    return Object.freeze({ activeWorkspaceId, activeBrandId: brandId, unbrandedBoard: boardBrand === null, workspaces, workspace: activeWorkspace, brands, brand: brands.find((item) => item.id === brandId) || null });
  }
  function filterBoards(allBoards, catalog, workspaceId) {
    if (!workspaceId) return allBoards;
    const allowed = new Set(workspace(catalog, workspaceId)?.boards.map((item) => item.id) || []);
    return allBoards.filter((item) => allowed.has(item.id));
  }
  function safeAvatar(url) { return typeof url === 'string' && /^(?:data:image\/(?:png|jpeg|webp|gif);base64,|\/)/i.test(url) ? url : null; }
  function canRename(item) { return ['owner','admin'].includes(item.role); }
  function brandCountLabel(count, language = 'en') { const copy=STRINGS[language==='de'?'de':'en']; return count===0?copy.noBrandCount:count===1?copy.oneBrand:copy.manyBrands.replace('{count}',String(count)); }

  function placement(rect, viewport, menuHeight, compact = false, mobile = false, preferredWidth) {
    const gap=6, edge=8;
    if (mobile) return { left:edge, top:Math.max(edge,rect.top-gap-menuHeight), width:Math.max(0,viewport.width-edge*2), side:'sheet' };
    const available=Math.max(0,viewport.width-edge*2);
    const width=Math.min(preferredWidth || (compact?280:Math.max(220,rect.width)),compact?340:320,available);
    if (compact) return { left:Math.max(edge,Math.min(viewport.width-width-edge,rect.right+gap)), top:Math.max(edge,Math.min(rect.top,viewport.height-menuHeight-edge)), width, side:'right' };
    const below=viewport.height-rect.bottom-gap, above=rect.top-gap;
    const opensAbove=below<Math.min(menuHeight,240)&&above>below;
    return { left:Math.max(edge,Math.min(rect.left,viewport.width-width-edge)), top:opensAbove?Math.max(edge,rect.top-menuHeight-gap):Math.min(viewport.height-menuHeight-edge,rect.bottom+gap), width, side:opensAbove?'above':'below' };
  }

  function create(options) {
    // BW-36.10R1 lifecycle equivalence: openNow()&&mode===nextMode; if(openNow())close(false).
    const doc=options.document||root.document; const host=doc.getElementById('workspace-context');
    if(!host)return null;
    const ids=['workspace-context-trigger','workspace-context-manage','workspace-context-chevron','workspace-brand-trigger','workspace-context-popover','workspace-context-options','workspace-context-status','brand-selector-popover','brand-selector-options','brand-selector-status','workspace-context-name','workspace-context-access','workspace-context-avatar','workspace-brand-name','workspace-brand-avatar','workspace-brand-chevron'];
    const nodes=Object.fromEntries(ids.map(id=>[id,doc.getElementById(id)]));
    let model=derive(null),surface=null,returnFocus=null,search=null,pending=false,dialog=null,menu=null;
    const language=()=>options.language?.()==='de'?'de':'en';
    const t=key=>STRINGS[language()][key];
    const activeSurface=()=>surface && !surface.hidden ? surface : null;
    const viewport=()=>({width:root.visualViewport?.width||root.innerWidth||doc.documentElement.clientWidth,height:root.visualViewport?.height||root.innerHeight||doc.documentElement.clientHeight});
    function avatar(node,item){if(item?.logo_url&&root.FunklixBrandLogo){root.FunklixBrandLogo.render(node,item,{label:language()==='de'?'Markenlogo':'Brand logo'});return;}node.replaceChildren();const url=safeAvatar(item?.avatar_url);if(url){const image=doc.createElement('img');image.src=url;image.alt='';image.addEventListener('error',()=>node.replaceChildren(doc.createTextNode(words(item?.name))));node.append(image);}else node.textContent=words(item?.name);}
    function position(element,trigger,width,compact=false){
      if(!element||element.hidden||!trigger?.isConnected)return;
      const view=viewport(),mobile=view.width<768,measured=Math.min(element.scrollHeight||120,Math.max(80,view.height-16));
      const next=placement(trigger.getBoundingClientRect(),view,measured,compact,mobile,width);
      element.style.left=`${next.left}px`;element.style.top=`${next.top}px`;element.style.setProperty('--workspace-menu-width',`${next.width}px`);element.dataset.placement=next.side;
    }
    function updatePosition(){if(!activeSurface())return;position(surface,returnFocus,surface===menu?220:surface===dialog?320:undefined,surface===menu||surface===dialog);}
    function removeTransient(){search?.remove();search=null;menu?.remove();menu=null;dialog?.remove();dialog=null;}
    function close(restore=true){
      const open=activeSurface(); if(!open)return;
      if(open===nodes['workspace-context-popover']||open===nodes['brand-selector-popover'])open.hidden=true;else open.remove();
      nodes['workspace-context-trigger'].setAttribute('aria-expanded','false');nodes['workspace-brand-trigger'].setAttribute('aria-expanded','false');nodes['workspace-context-manage'].setAttribute('aria-expanded','false');
      const target=returnFocus;surface=null;removeTransient();if(restore&&returnFocus?.isConnected)returnFocus.focus();
    }
    function option(item,selected,kind){
      const button=doc.createElement('button');button.type='button';button.className='workspace-context-option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(selected));button.dataset[kind+'Id']=item.id;button.title=item.name;
      const icon=doc.createElement('span');icon.className=`workspace-context-avatar${kind==='brand'?' workspace-brand-avatar':''}`;avatar(icon,item);
      const label=doc.createElement('span');label.className='workspace-context-option-copy';const strong=doc.createElement('strong');strong.textContent=item.name;label.append(strong);
      if(kind==='workspace'){const small=doc.createElement('small');small.textContent=brandCountLabel(item.brands?.length||0,language());if(item.role==='viewer'||item.role==='member')small.title=t('readOnly');label.append(small);}
      const check=doc.createElement('span');check.className='workspace-context-check';check.setAttribute('aria-hidden','true');check.textContent=selected?'✓':'';button.append(icon,label,check);return button;
    }
    function visibleOptions(container){return [...container.querySelectorAll('[role="option"]')].filter(item=>!item.hidden);}
    function openSelector(kind,trigger){
      if(kind==='workspace'&&model.workspaces.length<=1)return;
      if(kind==='brand'&&(model.brands.length<=1||model.unbrandedBoard))return;
      const popover=kind==='workspace'?nodes['workspace-context-popover']:nodes['brand-selector-popover'];
      if(activeSurface()===popover){close();return;} if(activeSurface())close(false);
      surface=popover;returnFocus=trigger;if(kind==='workspace')doc.body.append(nodes['workspace-context-popover']);else doc.body.append(nodes['brand-selector-popover']);popover.hidden=false;trigger.setAttribute('aria-expanded','true');
      const container=kind==='workspace'?nodes['workspace-context-options']:nodes['brand-selector-options'];const status=kind==='workspace'?nodes['workspace-context-status']:nodes['brand-selector-status'];
      container.replaceChildren();const values=kind==='workspace'?model.workspaces:model.brands;values.forEach(item=>container.append(option(item,item.id===(kind==='workspace'?model.activeWorkspaceId:model.activeBrandId),kind)));status.textContent=values.length?'':(kind==='workspace'?t('noWorkspace'):t('noBrands'));
      if(values.length>8){search=doc.createElement('input');search.type='search';search.className='workspace-context-search';search.placeholder=kind==='workspace'?t('chooseWorkspace'):t('chooseBrand');search.setAttribute('aria-label',search.placeholder);search.addEventListener('input',()=>{const query=search.value.trim().toLocaleLowerCase();[...container.children].forEach(item=>{item.hidden=!item.title.toLocaleLowerCase().includes(query);});});popover.prepend(search);}
      position(popover,trigger);(search||container.querySelector('[aria-selected="true"]')||container.querySelector('button')||container).focus();
    }
    function openManagement(){
      if(!model.workspace||!canRename(model.workspace))return;
      if(activeSurface()===menu){close();return;} if(activeSurface())close(false);
      menu=doc.createElement('div');menu.id='workspace-context-menu';menu.className='workspace-context-menu';menu.setAttribute('role','menu');menu.setAttribute('aria-label',t('actions'));
      const rename=doc.createElement('button');rename.type='button';rename.className='workspace-context-menu-item';rename.setAttribute('role','menuitem');rename.textContent=t('rename');menu.append(rename);doc.body.append(menu);
      surface=menu;returnFocus=nodes['workspace-context-manage'];returnFocus.setAttribute('aria-expanded','true');position(menu,returnFocus,220,true);rename.focus();rename.addEventListener('click',()=>openRename(model.workspace,returnFocus));
    }
    function openRename(item,origin){
      if(activeSurface())close(false);
      dialog=doc.createElement('form');dialog.id='workspace-rename-dialog';dialog.className='workspace-rename-dialog workspace-rename-editor';dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-labelledby','workspace-rename-title');
      const title=doc.createElement('h2');title.id='workspace-rename-title';title.textContent=t('rename');
      const label=doc.createElement('label');label.textContent=t('workspaceName');const input=doc.createElement('input');input.name='workspace-name';input.value=item.name;input.maxLength=160;input.autocomplete='off';label.append(input);
      const status=doc.createElement('p');status.className='workspace-rename-status';status.setAttribute('role','status');status.hidden=true;
      const actions=doc.createElement('div');actions.className='workspace-rename-actions';const cancel=doc.createElement('button');cancel.type='button';cancel.className='fk-btn fk-btn-ghost';cancel.textContent=t('cancel');const save=doc.createElement('button');save.type='submit';save.className='fk-btn fk-btn-primary';save.textContent=t('saveName');actions.append(cancel,save);dialog.append(title,label,status,actions);doc.body.append(dialog);
      surface=dialog;returnFocus=origin;position(dialog,origin,320,true);input.focus();input.select();
      const dismiss=()=>{if(pending)return;close(false);origin.focus();};cancel.addEventListener('click',dismiss);
      dialog.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();dismiss();}if(event.key==='Tab'){const target=event.shiftKey?(doc.activeElement===input?save:null):(doc.activeElement===save?input:null);if(target){event.preventDefault();target.focus();}}});
      dialog.addEventListener('submit',async event=>{event.preventDefault();if(pending)return;const checked=root.FunklixWorkspaceName?.validateWorkspaceName(input.value);if(!checked?.ok){status.hidden=false;status.textContent=checked?.reason==='too_long'?t('tooLong'):t('enterName');return;}pending=true;save.disabled=true;cancel.disabled=true;try{await options.onRename?.(item,input.value);pending=false;close(false);origin.focus();}catch(error){pending=false;save.disabled=false;cancel.disabled=false;status.hidden=false;status.textContent=error?.code==='WORKSPACE_CHANGED'?t('changed'):['PERMISSION_DENIED','MEMBERSHIP_REQUIRED'].includes(error?.code)?t('denied'):error?.code==='INVALID_WORKSPACE_NAME'?t('enterName'):t('renameFailed');input.focus();}});
    }
    function render(input={}){
      model=derive(input.catalog,{activeWorkspaceId:input.activeWorkspaceId,boardId:input.boardId,brandId:input.brandId});host.dataset.status=input.status||'idle';
      const workspaceName=input.status==='loading'?t('loading'):input.status==='error'?t('unavailable'):model.workspace?.name||(model.workspaces.length?t('chooseWorkspace'):t('noWorkspace'));nodes['workspace-context-name'].textContent=workspaceName;nodes['workspace-context-name'].title=workspaceName;avatar(nodes['workspace-context-avatar'],model.workspace);
      const readOnly=['viewer','member'].includes(model.workspace?.role);nodes['workspace-context-access'].hidden=!readOnly;nodes['workspace-context-access'].textContent=readOnly?t('readOnly'):'';
      const multipleWorkspaces=model.workspaces.length>1;nodes['workspace-context-chevron'].hidden=!multipleWorkspaces;nodes['workspace-context-trigger'].disabled=!multipleWorkspaces;nodes['workspace-context-trigger'].setAttribute('aria-label',multipleWorkspaces?t('chooseWorkspace'):workspaceName);
      const canManage=model.workspace?canRename(model.workspace):false;nodes['workspace-context-manage'].hidden=!canManage;nodes['workspace-context-manage'].setAttribute('aria-label',t('actions'));nodes['workspace-context-manage'].title=t('actions');
      const brandName=model.unbrandedBoard?t('noBrandAssigned'):model.brand?.name||(model.brands.length?t('chooseBrand'):t('noBrands'));nodes['workspace-brand-name'].textContent=brandName;nodes['workspace-brand-name'].title=brandName;avatar(nodes['workspace-brand-avatar'],model.brand);
      const multipleBrands=model.brands.length>1&&!model.unbrandedBoard;nodes['workspace-brand-chevron'].hidden=!multipleBrands;nodes['workspace-brand-trigger'].disabled=!multipleBrands;nodes['workspace-brand-trigger'].setAttribute('aria-label',multipleBrands?t('chooseBrand'):brandName);host.hidden=input.signedIn===false;if(activeSurface())close(false);return model;
    }
    function selectFrom(event,kind){const target=event.target.closest('[role="option"]');if(!target)return;if(kind==='workspace')Promise.resolve(options.onWorkspace?.(target.dataset.workspaceId)).then(accepted=>{if(accepted!==false)close();});else{options.onBrand?.(target.dataset.brandId);close();}}
    function keyboard(event,container){const items=visibleOptions(container),index=items.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}if(event.key==='Enter'||event.key===' '){event.preventDefault();doc.activeElement?.click();}}
    nodes['workspace-context-trigger'].addEventListener('click',()=>openSelector('workspace',nodes['workspace-context-trigger']));nodes['workspace-context-manage'].addEventListener('click',openManagement);nodes['workspace-brand-trigger'].addEventListener('click',()=>openSelector('brand',nodes['workspace-brand-trigger']));
    nodes['workspace-context-options'].addEventListener('click',event=>selectFrom(event,'workspace'));nodes['brand-selector-options'].addEventListener('click',event=>selectFrom(event,'brand'));nodes['workspace-context-options'].addEventListener('keydown',event=>keyboard(event,nodes['workspace-context-options']));nodes['brand-selector-options'].addEventListener('keydown',event=>keyboard(event,nodes['brand-selector-options']));
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&activeSurface()){event.preventDefault();close();}});doc.addEventListener('pointerdown',event=>{if(activeSurface()&&!surface.contains(event.target)&&!host.contains(event.target))close();});doc.addEventListener('scroll',updatePosition,true);root.addEventListener?.('resize',updatePosition);root.visualViewport?.addEventListener?.('resize',updatePosition);root.ResizeObserver&&new root.ResizeObserver(updatePosition).observe(host);
    return Object.freeze({render,close,openBrand:()=>openSelector('brand',nodes['workspace-brand-trigger']),getModel:()=>model,updatePosition});
  }
  root.FunklixWorkspaceSidebar=Object.freeze({STRINGS,words,derive,filterBoards,safeAvatar,brandCountLabel,placement,create});
}(typeof globalThis!=='undefined'?globalThis:window));
