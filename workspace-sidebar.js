(function (root) {
  'use strict';

  const STRINGS = Object.freeze({
    en: { workspace:'Workspace', switchWorkspace:'Switch workspace', chooseWorkspace:'Choose a workspace', noWorkspace:'No workspace available', unavailable:'Workspace unavailable', brand:'Brand', chooseBrand:'Choose a brand', noBrands:'No brands in this workspace', noBrandAssigned:'No Brand assigned', profile:'Brand Profile', openProfile:'Open profile', readOnly:'Your access is read-only', loading:'Loading workspaces…' },
    de: { workspace:'Workspace', switchWorkspace:'Workspace wechseln', chooseWorkspace:'Workspace auswählen', noWorkspace:'Kein Workspace verfügbar', unavailable:'Workspace nicht verfügbar', brand:'Marke', chooseBrand:'Marke auswählen', noBrands:'Keine Marken in diesem Workspace', noBrandAssigned:'Keine Marke zugewiesen', profile:'Markenprofil', openProfile:'Profil öffnen', readOnly:'Dein Zugriff ist schreibgeschützt', loading:'Workspaces werden geladen…' }
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
    if (!workspaceId) return allBoards; // preserves the Board-only collaborator path
    const allowed = new Set(workspace(catalog, workspaceId)?.boards.map((item) => item.id) || []);
    return allBoards.filter((item) => allowed.has(item.id));
  }
  function safeAvatar(url) { return typeof url === 'string' && /^(?:data:image\/(?:png|jpeg|webp|gif);base64,|\/)/i.test(url) ? url : null; }

  function placement(rect, viewport, menuHeight, compact = false, mobile = false) {
    const gap=6, edge=8;
    if (mobile) return { left:edge, top:Math.max(edge,rect.top-gap-menuHeight), width:Math.max(0,viewport.width-edge*2), side:'sheet' };
    const width=compact?Math.min(280,viewport.width-rect.right-gap-edge):Math.min(Math.max(220,rect.width),320,viewport.width-edge*2);
    if (compact) return { left:Math.min(viewport.width-width-edge,rect.right+gap), top:Math.max(edge,Math.min(rect.top,viewport.height-menuHeight-edge)), width, side:'right' };
    const below=viewport.height-rect.bottom-gap, above=rect.top-gap;
    const opensAbove=below<Math.min(menuHeight,240)&&above>below;
    return { left:Math.max(edge,Math.min(rect.left,viewport.width-width-edge)), top:opensAbove?Math.max(edge,rect.top-menuHeight-gap):Math.min(viewport.height-menuHeight-edge,rect.bottom+gap), width, side:opensAbove?'above':'below' };
  }

  function create(options) {
    const doc=options.document||root.document; const host=doc.getElementById('workspace-context');
    if(!host)return null;
    const nodes=Object.fromEntries(['workspace-context-trigger','workspace-brand-trigger','workspace-context-popover','workspace-context-options','workspace-context-status','workspace-context-name','workspace-context-avatar','workspace-brand-name','workspace-brand-avatar','workspace-brand-chevron'].map(id=>[id,doc.getElementById(id)]));
    let model=derive(null),mode=null,returnFocus=null,search=null;
    const t=key=>STRINGS[options.language?.()==='de'?'de':'en'][key];
    const openNow=()=>mode!==null&&!nodes['workspace-context-popover'].hidden;
    function avatar(node,item){node.replaceChildren();const url=safeAvatar(item?.avatar_url);if(url){const image=doc.createElement('img');image.src=url;image.alt='';image.addEventListener('error',()=>node.replaceChildren(doc.createTextNode(words(item?.name))));node.append(image);}else node.textContent=words(item?.name);}
    function updatePosition(){
      if(!openNow())return; const trigger=returnFocus,rect=trigger.getBoundingClientRect();
      const viewport={width:root.visualViewport?.width||root.innerWidth||doc.documentElement.clientWidth,height:root.visualViewport?.height||root.innerHeight||doc.documentElement.clientHeight};
      const mobile=viewport.width<768,compact=!mobile&&(rect.width<100||doc.querySelector('.app-shell')?.classList.contains('sidebar-collapsed'));
      const popover=nodes['workspace-context-popover']; const measured=Math.min(popover.scrollHeight||320,mobile?Math.max(160,viewport.height-98):320);
      const next=placement(rect,viewport,measured,compact,mobile);
      popover.style.left=`${next.left}px`;popover.style.top=`${next.top}px`;popover.style.setProperty('--workspace-menu-width',`${next.width}px`);popover.dataset.placement=next.side;
    }
    function close(restore=true){if(!openNow())return;nodes['workspace-context-popover'].hidden=true;nodes['workspace-context-trigger'].setAttribute('aria-expanded','false');nodes['workspace-brand-trigger'].setAttribute('aria-expanded','false');mode=null;search?.remove();search=null;if(restore&&returnFocus?.isConnected)returnFocus.focus();}
    function option(item,selected,kind){const button=doc.createElement('button');button.type='button';button.className='workspace-context-option';button.setAttribute('role','option');button.setAttribute('aria-selected',String(selected));button.dataset[kind+'Id']=item.id;button.title=item.name;const icon=doc.createElement('span');icon.className='workspace-context-avatar';avatar(icon,item);const label=doc.createElement('span');label.className='workspace-context-option-copy';const strong=doc.createElement('strong');strong.textContent=item.name;label.append(strong);if(kind==='workspace'&&item.role==='viewer'){const small=doc.createElement('small');small.textContent=t('readOnly');label.append(small);}const check=doc.createElement('span');check.className='workspace-context-check';check.setAttribute('aria-hidden','true');check.textContent=selected?'✓':'';button.append(icon,label,check);return button;}
    function visibleOptions(){return [...nodes['workspace-context-options'].querySelectorAll('[role="option"]')].filter(item=>!item.hidden);}
    function open(nextMode,trigger){
      if(openNow()&&mode===nextMode){close();return;} if(openNow())close(false);
      mode=nextMode;returnFocus=trigger;doc.body.append(nodes['workspace-context-popover']);nodes['workspace-context-popover'].hidden=false;nodes['workspace-context-popover'].setAttribute('aria-label',nextMode==='workspace'?t('chooseWorkspace'):t('chooseBrand'));trigger.setAttribute('aria-expanded','true');nodes['workspace-context-options'].replaceChildren();
      const values=nextMode==='workspace'?model.workspaces:model.brands;values.forEach(item=>nodes['workspace-context-options'].append(option(item,item.id===(nextMode==='workspace'?model.activeWorkspaceId:model.activeBrandId),nextMode)));nodes['workspace-context-status'].textContent=values.length?'':(nextMode==='workspace'?t('noWorkspace'):t('noBrands'));
      if(values.length>8){search=doc.createElement('input');search.type='search';search.className='workspace-context-search';search.placeholder=nextMode==='workspace'?t('chooseWorkspace'):t('chooseBrand');search.setAttribute('aria-label',search.placeholder);search.addEventListener('input',()=>{const query=search.value.trim().toLocaleLowerCase();visibleOptions();[...nodes['workspace-context-options'].children].forEach(item=>{item.hidden=!item.title.toLocaleLowerCase().includes(query);});});nodes['workspace-context-popover'].prepend(search);}
      updatePosition();(search||nodes['workspace-context-options'].querySelector('[aria-selected="true"]')||nodes['workspace-context-options'].querySelector('button')||nodes['workspace-context-options']).focus();
    }
    function render(input={}){model=derive(input.catalog,{activeWorkspaceId:input.activeWorkspaceId,boardId:input.boardId,brandId:input.brandId});host.dataset.status=input.status||'idle';const workspaceName=input.status==='loading'?t('loading'):input.status==='error'?t('unavailable'):model.workspace?.name||(model.workspaces.length?t('chooseWorkspace'):t('noWorkspace'));nodes['workspace-context-name'].textContent=workspaceName;nodes['workspace-context-name'].title=workspaceName;avatar(nodes['workspace-context-avatar'],model.workspace);const brandName=model.unbrandedBoard?t('noBrandAssigned'):model.brand?.name||(model.brands.length?t('chooseBrand'):t('noBrands'));nodes['workspace-brand-name'].textContent=brandName;nodes['workspace-brand-name'].title=brandName;avatar(nodes['workspace-brand-avatar'],model.brand);const multiple=model.brands.length>1&&!model.unbrandedBoard;nodes['workspace-brand-chevron'].hidden=!multiple;nodes['workspace-brand-trigger'].disabled=!multiple;host.hidden=input.signedIn===false;if(mode)close(false);return model;}
    nodes['workspace-context-trigger'].addEventListener('click',()=>open('workspace',nodes['workspace-context-trigger']));nodes['workspace-brand-trigger'].addEventListener('click',()=>open('brand',nodes['workspace-brand-trigger']));
    nodes['workspace-context-options'].addEventListener('click',async event=>{const target=event.target.closest('[role="option"]');if(!target)return;if(mode==='workspace'){const accepted=await options.onWorkspace?.(target.dataset.workspaceId);if(accepted===false)return;}else options.onBrand?.(target.dataset.brandId);close();});
    nodes['workspace-context-options'].addEventListener('keydown',event=>{const items=visibleOptions(),index=items.indexOf(doc.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?items.length-1:(index+(event.key==='ArrowDown'?1:-1)+items.length)%items.length;items[next]?.focus();}if(event.key==='Enter'||event.key===' '){event.preventDefault();doc.activeElement?.click();}});
    doc.addEventListener('keydown',event=>{if(event.key==='Escape'&&openNow()){event.preventDefault();close();}});doc.addEventListener('pointerdown',event=>{if(openNow()&&!nodes['workspace-context-popover'].contains(event.target)&&!host.contains(event.target))close();});doc.addEventListener('scroll',updatePosition,true);root.addEventListener?.('resize',updatePosition);root.visualViewport?.addEventListener?.('resize',updatePosition);root.ResizeObserver&&new root.ResizeObserver(updatePosition).observe(host);
    return Object.freeze({render,close,openBrand:()=>open('brand',nodes['workspace-brand-trigger']),getModel:()=>model,updatePosition});
  }
  root.FunklixWorkspaceSidebar=Object.freeze({STRINGS,words,derive,filterBoards,safeAvatar,placement,create});
}(typeof globalThis!=='undefined'?globalThis:window));
