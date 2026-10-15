(function(root) {
  'use strict';
  const COPY = {
    saved: ['Save and open a Board before using Learn.', 'Speichere und öffne ein Board, um Learn zu nutzen.'],
    loading: ['Wait for the current Board and Workspace to finish loading.', 'Warte, bis das aktuelle Board und der Workspace geladen sind.'],
    stale: ['Reload the saved Board to resolve its current Brand context.', 'Lade das gespeicherte Board neu, um den aktuellen Markenkontext zu laden.'],
    brand: ['Associate this saved Board with a Brand before using Learn.', 'Verknüpfe dieses gespeicherte Board mit einer Marke, um Learn zu nutzen.'],
    workspace: ['The associated Brand and Workspace are unavailable for this account.', 'Die zugehörige Marke und der Workspace sind für dieses Konto nicht verfügbar.'],
    access: ['Learn requires Brand editing permission and access to this saved Board.', 'Learn erfordert Bearbeitungsrechte für die Marke und Zugriff auf dieses gespeicherte Board.'],
    unavailable: ['The Learning Advisor is temporarily unavailable. Try again.', 'Der Learning-Berater ist vorübergehend nicht verfügbar. Versuche es erneut.']
  };
  function mount({getState, language}) {
    const doc=root.document, anchor=doc.getElementById('canvas-compact-view-btn');
    if(!anchor||doc.getElementById('canvas-learn-btn'))return;
    const button=doc.createElement('button');button.id='canvas-learn-btn';button.type='button';
    button.className='utility-muted fk-btn fk-btn-secondary';button.setAttribute('aria-label','Learn');
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-describedby','canvas-learn-status');
    // Match the toolbar's inline SVG system; the visible label is Learn in EN/DE.
    button.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z"/><path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6Z"/></svg><span>Learn</span>';
    anchor.after(button);
    const status=doc.createElement('span');status.id='canvas-learn-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.hidden=true;button.after(status);
    let advisor=null,pending=false;
    button.addEventListener('click',async()=>{
      if(pending)return;
      status.hidden=true;status.textContent='';
      const s=getState(),account=s.user,boardId=s.currentBoardId,association=s.boardBrandAssociation;
      const workspace=s.workspaceCatalog.value?.workspaces.find(w=>w.brands.some(b=>b.id===association.brandId));
      const brand=workspace?.brands.find(b=>b.id===association.brandId);
      const reason=!boardId?'saved':s.isBoardLoading||['loading','refreshing'].includes(s.workspaceCatalog.status)||association.status==='loading'?'loading':
        association.boardId!==boardId||association.status==='load-error'?'stale':!association.brandId?'brand':
        !workspace||!brand||s.workspaceCatalog.status!=='ready'?'workspace':
        !account?.email||s.publicBoardToken||s.boardAccess?.canView!==true||!['owner','admin','editor'].includes(brand.role)?'access':
        !root.FunklixLearningAdvisor?'unavailable':null;
      const message=key=>{status.textContent=COPY[key][language()==='de'?1:0];status.hidden=false;};
      if(reason){message(reason);return;}
      // Capture lifecycle generations as well as IDs: switching away and back must
      // not revive a request from an earlier Board or account session.
      const context=()=>JSON.stringify([s.user?.email,s.currentBoardId,s.boardLoadGeneration,s.boardBrandAssociation.brandId,s.boardBrandAssociation.boardId,
        s.boardBrandAssociation.generation,s.workspaceCatalog.activeWorkspaceId,s.workspaceCatalog.generation,language()]);
      const captured=context();
      const current=()=>s.user===account&&context()===captured&&!s.isBoardLoading&&!s.publicBoardToken&&s.boardAccess?.canView===true&&
        s.workspaceCatalog.status==='ready'&&s.workspaceCatalog.value?.workspaces.some(w=>w.id===workspace.id&&w.brands.some(b=>b.id===brand.id&&['owner','admin','editor'].includes(b.role)));
      advisor?.invalidate();
      advisor=root.FunklixLearningAdvisor.create({brand,workspaceId:workspace.id,language,current,connected:()=>button.isConnected});
      pending=true;button.setAttribute('aria-busy','true');button.setAttribute('aria-disabled','true');
      try{await advisor.open({boardId,returnFocus:button});}
      catch{if(current())message('unavailable');}
      finally{pending=false;button.removeAttribute('aria-busy');button.removeAttribute('aria-disabled');}
    });
  }
  root.FunklixCanvasLearningAdvisor=Object.freeze({mount});
})(globalThis);
