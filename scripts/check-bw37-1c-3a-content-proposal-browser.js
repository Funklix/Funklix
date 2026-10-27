'use strict';
const assert = require('node:assert/strict');
const {chromium}=require('playwright-core');
const answer='Content concept: A creative invitation\nAudience: Independent creators\nMessage: Share the story behind your work.\nPurpose: Invite the community to participate.';
async function main() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],timeout:30000});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
    let calls=0,adviceCalls=0,hold=null,status=200,html=false,mode='valid',counter=0;
    await p.route('**/api/ai-brain/advice',route=>{adviceCalls++;return route.fulfill({json:{answer,assumptions:[],disclaimer:'Fictional',context:{response_language:route.request().postDataJSON().response_language,reference_resolution:'none'}}});});
    await p.route('**/api/ai-brain/propose-node',async route=>{
      calls++;const body=route.request().postDataJSON();
      assert.equal(body.source_answer,answer);assert.equal(body.expected_scope.updated_at,f.r.db.boards[0].updated_at);
      assert.equal(body.expected_scope.brand_id,f.r.db.boards[0].brand_id);assert.equal(body.expected_scope.workspace_id,f.r.db.boards[0].workspace_id);
      if(hold){const h=hold;hold=null;h.started();await h.wait;}
      if(html)return route.fulfill({status:404,contentType:'text/html',body:'<html>INTERNAL_SECRET</html>'});
      if(status!==200)return route.fulfill({status,json:{code:status===409?'proposal_context_changed':'proposal_provider_failed',error:'INTERNAL_SECRET'}});
      const node_proposal={proposal_id:'proposal-'+(++counter),source_turn_id:body.source_turn_id,node_type:'Content',title:'Creative invitation',body:'Share the story behind your work.',rationale:'A focused asset.'};
      if(mode==='bad')node_proposal.extra=true;
      await route.fulfill({json:{action:'propose_content_node',node_proposal,context:{board_id:body.board_id,response_language:body.response_language,content_language:body.content_language}}}).catch(()=>{});
    });
    const boot=async()=>{await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');state.isDirty=false;});};
    const ask=async()=>{await p.locator('#ai-brain-question').fill('Suggest a reusable content idea.');await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
    const prepare=async()=>{await p.evaluate(()=>requestAiBrainNodeProposal(state.aiBrain.messages[0].id));};
    const ready=async()=>{await prepare();await p.waitForFunction(()=>state.aiBrain.messages[0]?.proposal?.status==='ready');};
    const snapshot=()=>p.evaluate(()=>({nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),history:JSON.stringify(state.history),dirty:state.isDirty,core:JSON.stringify(state.brandCore)}));
    await boot();await ask();
    await p.locator('#ai-brain-question').fill('My newer draft');await p.locator('#ai-brain-mode').selectOption('find_gaps');
    await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(3,8));
    const before=await snapshot();
    for(const theme of ['light','dark'])for(const width of [320,375,1440]) {
      await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      const n=calls;await p.locator('[data-ai-brain-prepare]').focus();await p.keyboard.press('Enter');
      await p.locator('[data-ai-brain-create]').waitFor();assert.equal(calls,n+1);assert.deepEqual(await snapshot(),before);
      assert.equal(await p.locator('[data-ai-brain-cancel]').evaluate(n=>n===document.activeElement),true);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.keyboard.press('Enter');assert.equal(await p.locator('[data-ai-brain-create]').count(),0);assert.deepEqual(await snapshot(),before);
      assert.equal(await p.locator('#ai-brain-question').inputValue(),'My newer draft');assert.equal(await p.locator('#ai-brain-mode').inputValue(),'find_gaps');
      assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd]),[3,8]);
    }
    assert.equal(adviceCalls,1);assert.deepEqual(f.writes,[]);
    // Sidebar choice has no authority. Board-only editors and null associations
    // are permitted without finding a readable canonical Brand in the catalog.
    for(const mutate of [()=>{state.session.brandId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';},()=>{state.workspaceCatalog.value.workspaces[0].brands=[];state.boardAccess.reason='editor';}]) {
      await boot();await p.evaluate(mutate);await ask();await ready();await p.evaluate(()=>cancelAiBrainNodeProposal(state.aiBrain.messages[0].id));
    }
    // Real source and controller checks at all three boundaries, including fields
    // omitted/truncated by the Advice projection and same-email account objects.
    const mutations=[()=>state.user={...state.user},()=>state.user=null,()=>state.aiBrain.messages[0].answer+='Changed',()=>state.aiBrain.messages[0].question+='Changed',()=>state.boardLoadGeneration++,()=>state.currentBoardId='other',()=>state.lastKnownUpdatedAt='2020-01-01',()=>state.boardBrandAssociation.brandId=null,()=>state.boardBrandAssociation.workspaceId=null,()=>state.boardBrandAssociation.generation++,()=>state.workspaceCatalog.generation++,()=>state.workspaceCatalog.activeWorkspaceId='other',()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);state.workspaceCatalog.value.workspaces[0].revision++;},()=>state.selectedPrimary='other',()=>state.boardAccess.canEdit=false,()=>state.nodes.push({id:'new',type:'Content',title:'Local',content:'New',position:{x:9,y:9}})];
    for(const mutate of mutations) {
      await boot();await ask();const n=calls;await p.evaluate(mutate);await prepare();assert.equal(calls,n,String(mutate));assert.equal(await p.locator('[data-ai-brain-create]').count(),0);assert.deepEqual(f.writes,[]);
      await boot();await ask();await ready();const n2=calls;await p.evaluate(mutate);const after=await snapshot();await p.evaluate(()=>applyAiBrainNodeProposal(state.aiBrain.messages[0]?.id));assert.equal(calls,n2);assert.deepEqual(await snapshot(),after);assert.equal(await p.locator('[data-ai-brain-create]').count(),0);
      await boot();await ask();let started,release;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r);hold={wait,started};
      const pending=prepare();await begun;await p.evaluate(mutate);release();await pending;assert.equal(await p.locator('[data-ai-brain-create]').count(),0);
    }
    for(const change of [()=>state.nodes[0].position.x++,()=>state.nodes[0].imagePrompt='Changed native prompt',()=>state.nodes[0].content+='Tail beyond the bounded projection']) {
      await boot();await p.evaluate(()=>{createNode({type:'Content',position:{x:10,y:10},initial:{title:'Existing',content:'x'.repeat(5000)}});clearAutosaveTimer();});await ask();
      const n=calls;await p.evaluate(change);await prepare();assert.equal(calls,n,'native fields outside the Advice projection remain source-bound');
    }
    // A cancelled request cannot overwrite a later explicit retry, even when its
    // failure arrives after the new proposal is ready.
    await boot();await ask();let releaseOld,startOld;const oldWait=new Promise(r=>releaseOld=r),oldStarted=new Promise(r=>startOld=r);hold={wait:oldWait,started:startOld};
    const oldRequest=prepare();await oldStarted;await p.evaluate(()=>cancelAiBrainNodeProposal(state.aiBrain.messages[0].id));await ready();
    const newId=await p.evaluate(()=>state.aiBrain.messages[0].proposal.data.proposal_id);status=502;releaseOld();await oldRequest;status=200;
    assert.equal(await p.evaluate(()=>state.aiBrain.messages[0].proposal.data.proposal_id),newId);
    // Delayed failure from an invalidated account must not revive protected state.
    await boot();await ask();await p.evaluate(()=>state.user={...state.user});await p.evaluate(()=>renderAiBrain());assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),0);assert(!(await p.locator('#ai-brain-summary').innerText()).includes(answer));
    for(const failure of [401,403,404,409,413,502,503,504]) {
      await boot();await ask();status=failure;const n=calls;await prepare();assert.equal(calls,n+1);assert.equal(await p.locator('[data-ai-brain-create]').count(),0);assert(!(await p.locator('#ai-brain-summary').innerText()).includes('INTERNAL_SECRET'));status=200;await ready();await p.evaluate(()=>cancelAiBrainNodeProposal(state.aiBrain.messages[0].id));
    }
    await boot();await ask();html=true;await prepare();assert.equal(await p.locator('[data-ai-brain-create]').count(),0);html=false;mode='bad';await prepare();assert.equal(await p.locator('[data-ai-brain-create]').count(),0);mode='valid';
    // Existing explicit creation owner: one snapshot/node, no edges, duplicate
    // protection, undo, local persistence and partial-insertion recovery.
    await boot();await ask();await ready();
    const nodeCount=await p.evaluate(()=>state.nodes.length),historyCount=await p.evaluate(()=>state.history.length),n=calls;
    await p.evaluate(()=>{clearAutosaveTimer();const old=scheduleAutosave;scheduleAutosave=()=>{};try{applyAiBrainNodeProposal(state.aiBrain.messages[0].id);applyAiBrainNodeProposal(state.aiBrain.messages[0].id);}finally{scheduleAutosave=old;clearAutosaveTimer();}});
    assert.equal(calls,n);assert.equal(await p.evaluate(()=>state.nodes.length),nodeCount+1);assert.equal(await p.evaluate(()=>state.history.length),historyCount+1);
    assert.equal(await p.evaluate(()=>state.edges.length),0);assert.equal(await p.evaluate(()=>state.nodes.at(-1).type),'Content');assert.equal(await p.evaluate(()=>state.nodes.at(-1).status),'Draft');assert(await p.evaluate(()=>state.isDirty));
    assert((await p.evaluate(()=>JSON.stringify(serializeState()))).includes('Share the story behind your work.'));
    await p.waitForFunction(()=>state.selectedPrimary===state.nodes.at(-1).id);assert.equal(await p.evaluate(()=>document.activeElement===el.inputs.title),true);
    await p.evaluate(()=>{clearAutosaveTimer();el.undoButton.click();clearAutosaveTimer();});assert.equal(await p.evaluate(()=>state.nodes.length),nodeCount);
    for(const partial of [false,true]) {
      await boot();await ask();await ready();
      await p.evaluate(partial=>{const old=createNode,autosave=scheduleAutosave;createNode=options=>{if(partial)old(options);throw Error('fictional renderer failure');};scheduleAutosave=()=>{};try{applyAiBrainNodeProposal(state.aiBrain.messages[0].id);applyAiBrainNodeProposal(state.aiBrain.messages[0].id);}finally{createNode=old;scheduleAutosave=autosave;clearAutosaveTimer();}},partial);
      assert.equal(await p.evaluate(()=>state.nodes.length),partial?1:0);assert.equal(await p.evaluate(()=>state.aiBrain.messages[0].proposal.status),partial?'applied':'failed');
    }
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await p.close();
    console.log('PASS Content real shell Prepare/Preview/Cancel/Create, exact-source/account/Board/Workspace/Canvas races at dispatch/reply/create, safe errors/explicit retry, responsive themes/keyboard/drafts, one-node undo/duplicate/partial-insertion recovery');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
