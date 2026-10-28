'use strict';
const assert=require('node:assert/strict'), {chromium}=require('playwright-core');
const social=require('../ai-brain-social-proposal');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
  p.on('pageerror',error=>console.error('PAGE ERROR',error.stack));
  let answer,conversions=0,paid=0,reads=0,hold=null,saves=0;
  const requests=[];
  process.env.AUTH_SECRET='bw38-fictional-session';
  const acl=require('./fixtures/bw37-1c3a-proposal-runtime').fixture();
  const board=f.r.db.boards[0];
  Object.assign(acl.board,{id:board.id,owner_email:board.owner_email,brand_id:board.brand_id,workspace_id:board.workspace_id,updated_at:board.updated_at});
  acl.user.email=board.owner_email;acl.identity.canonical_email=board.owner_email;
  acl.workspace.id=board.workspace_id;acl.association={id:board.brand_id,workspace_id:board.workspace_id};
  let saveStatus=200,saveHold=null,proposalHold=null,advice=0,lostSave=false;
  const initialCanvas=JSON.parse(JSON.stringify(board.canvas_json));
  const originalFetch=global.fetch;global.fetch=async()=>{paid++;throw Error('No provider call is permitted');};

  await p.route('**/api/ai-brain/advice',r=>{advice++;return r.fulfill({json:{answer,assumptions:[],disclaimer:'Fictional fixture',context:{response_language:r.request().postDataJSON().response_language,reference_resolution:'none'}}});});
  await p.route('**/api/ai-brain/propose-node',async route=>{
   const body=route.request().postDataJSON();requests.push(body);conversions++;
   if(proposalHold){const h=proposalHold;proposalHold=null;h.started();await h.wait;}
   const res=await acl.invoke(body);await route.fulfill({status:res.statusCode,json:res.body}).catch(()=>{});
  });
  await p.route('**/api/ai-brain/content-scope',async route=>{
   reads++;if(hold){const h=hold;hold=null;h.started();await h.wait;}
   const res=await acl.invoke(route.request().postDataJSON(),'POST',acl.scopeHandler);
   await route.fulfill({status:res.statusCode,json:res.body}).catch(()=>{});
  });
  await p.route('**/api/boards/*',async route=>{
   if(route.request().method()!=='PUT')return route.fallback();saves++;
   const body=route.request().postDataJSON();
   if(saveHold){const h=saveHold;saveHold=null;h.started();await h.wait;}
   if(saveStatus!==200)return route.fulfill({status:saveStatus,json:{error:'Fictional save failure'}});
   assert.equal(body.lastKnownUpdatedAt,acl.board.updated_at,'Save must use current server revision');
   board.canvas_json=body.canvas_json;board.updated_at=new Date(Date.parse(board.updated_at)+1000).toISOString();acl.board.updated_at=board.updated_at;
   if(lostSave)return route.fulfill({status:500,json:{error:'Fictional lost acknowledgement after commit'}});
   return route.fulfill({json:{id:board.id,updated_at:board.updated_at}});
  });
  const boot=async()=>{await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');});};
  const ask=async()=>{await p.locator('#ai-brain-question').fill('Write posts for #MyAppicsStory');await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
  const open=async()=>{await p.locator('[data-ai-brain-prepare]').last().click();await p.locator('[data-ai-brain-prepare-confirm]').waitFor();};
  const prepare=async()=>{await p.locator('[data-ai-brain-prepare-confirm]').click();await p.locator('[data-ai-brain-create]').waitFor();};
  const choose=async i=>p.locator(`[data-ai-brain-source] input[value="${i}"]`).check();
  answer=require('./fixtures/bw37-1c3b-r2-appics-markdown')[0];
  await boot();await ask();
  assert.equal(await p.evaluate(()=>aiBrainContentAssets(state.aiBrain.messages.at(-1)).length),2);
  assert.equal(await p.evaluate(()=>state.nodes.length),0);
  const initialHistory=await p.evaluate(()=>state.history.length);
  await open();await choose(0);await prepare();
  await p.locator('[data-ai-brain-edit=title]').fill('Edited Instagram');
  await p.locator('[data-ai-brain-edit=caption]').fill('Isolated Instagram caption');
  await p.locator('[data-ai-brain-edit=preview]').fill('Instagram CTA');
  await p.locator('[data-ai-brain-edit=hashtags]').fill('#InstagramOnly');
  await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]));
  await p.waitForFunction(()=>state.selectedPrimary===state.nodes.at(-1)?.id && state.nodes.length===1);
  await p.evaluate(()=>{clearAutosaveTimer();setActiveView('ai_brain');});
  const result=await p.evaluate(()=>{const t=state.aiBrain.messages.at(-1);return {nodes:state.nodes.length,candidates:aiBrainContentAssets(t).length,status:t.proposal.status,sourceCurrent:aiBrainContentSourceCurrent(t),actions:document.querySelectorAll('[data-ai-brain-prepare]').length};});
  console.log('AFTER FIRST' ,JSON.stringify(result));
  assert.deepEqual(result,{nodes:1,candidates:2,status:'applied',sourceCurrent:true,actions:1});
  assert((await p.locator('[data-ai-brain-progress]').textContent()).includes('1 available'));
  await open();assert(await p.locator('[data-ai-brain-source] input[value="0"]').isDisabled());
  await choose(1);const exact=await p.locator('[data-ai-brain-excerpt]').textContent();await prepare();
  await p.locator('[data-ai-brain-edit=caption]').fill('Edited X caption');
  await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]));
  await p.waitForFunction(()=>state.nodes.length===2&&state.selectedPrimary===state.nodes.at(-1).id);
  await p.evaluate(()=>{clearAutosaveTimer();setActiveView('ai_brain');});
  assert.equal(requests.at(-1).source_answer,exact);assert.match(requests.at(-1).continuation_revision,/^[a-f0-9]{64}$/);
  const nodes=await p.evaluate(()=>state.nodes);assert.deepEqual(nodes.map(n=>n.type),[social.TYPE,social.TYPE]);
  assert.deepEqual(nodes.map(n=>n.social.platform),['Instagram','X / Twitter']);assert.equal(nodes[1].social.caption,'Edited X caption');assert.notEqual(nodes[0].social.caption,nodes[1].social.caption);
  assert.deepEqual(nodes[0].social,{platform:'Instagram',caption:'Isolated Instagram caption',preview:'Instagram CTA',hashtags:['#InstagramOnly'],scheduledAt:''});
  assert.deepEqual(nodes[1].social,{platform:'X / Twitter',caption:'Edited X caption',preview:'Sign up now and start owning your story!',hashtags:['#MyAppicsStory','#CreativeFreedom','#ContentOwnership','#CensorshipFree'],scheduledAt:''});
  assert.deepEqual(nodes.map(n=>n.title),['Edited Instagram','X Post']);
  assert.deepEqual(nodes.map(n=>n.content),['Isolated Instagram caption','Edited X caption']);
  assert.equal(await p.evaluate(()=>state.edges.length),0);
  assert(nodes.every(n=>n.status==='Draft'&&n.images.length===0&&!n.planningSchedule&&!n.approvalFingerprint));
  assert.equal(await p.evaluate(()=>state.history.length),initialHistory+2);assert.equal(await p.evaluate(()=>state.activityFeed.filter(a=>a.type==='node_created').length),2);
  assert.equal(advice,1);assert.equal(await p.locator('[data-ai-brain-prepare]').count(),0);assert.equal(paid,0);assert.equal(conversions,2);
  await p.evaluate(()=>saveBoardToServer('manual'));await p.waitForFunction(()=>!state.isDirty);
  await boot();assert.deepEqual(await p.evaluate(()=>state.nodes.map(n=>n.social)),nodes.map(n=>n.social));
  assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),0);
  console.log('PASS uninterrupted Instagram → Create → Brain → X → Create → Save → Reload; two isolated native Social Drafts, zero inference');
  const fresh=async()=>{board.canvas_json=JSON.parse(JSON.stringify(initialCanvas));acl.membership={role:'member',status:'accepted'};acl.identity.revision='1';acl.identity.id='44444444-4444-4444-8444-444444444444';acl.workspace.revision='1';saveStatus=200;lostSave=false;await boot();await ask();};
  const create=async index=>{
    await open();await choose(index);await prepare();
    const n=await p.evaluate(()=>state.nodes.length),h=await p.evaluate(()=>state.history.length);
    await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]));
    await p.waitForFunction(n=>state.nodes.length===n+1&&state.activeView==='board'&&state.selectedPrimary===state.nodes.at(-1).id,n);
    assert.equal(await p.evaluate(()=>state.history.length),h+1);
    await p.evaluate(()=>{clearAutosaveTimer();setActiveView('ai_brain');});
  };
  const first=async()=>{await fresh();await create(0);assert(await p.evaluate(()=>aiBrainContentSourceCurrent(state.aiBrain.messages.at(-1))));};
  // Both automatic and manual acknowledgements carry only the submitted snapshot.
  for(const trigger of ['autosave','manual']) {
    await first();const original=await p.evaluate(()=>state.aiBrain.messages.at(-1).contentProposalSource);
    assert((await p.locator('[data-ai-brain-progress]').textContent()).includes('not saved yet'));
    await p.evaluate(trigger=>saveBoardToServer(trigger),trigger);
    assert(await p.evaluate(()=>aiBrainContentSourceCurrent(state.aiBrain.messages.at(-1))));
    assert.deepEqual(await p.evaluate(()=>state.aiBrain.messages.at(-1).contentProposalSource),original);
    assert((await p.locator('[data-ai-brain-progress]').textContent()).includes('Saved'));
    await create(1);assert.equal(await p.evaluate(()=>state.nodes.length),2);
  }
  console.log('PASS continuation before/after manual save and autosave; immutable original source; per-item local/saved completion');
  // Pending and failed save cannot claim persistence or issue an overlapping Create.
  await first();let start,release;const begun=new Promise(r=>start=r),wait=new Promise(r=>release=r);saveHold={started:start,wait};
  const pending=p.evaluate(()=>saveBoardToServer('autosave'));await begun;
  await p.evaluate(()=>openAiBrainContentReview(state.aiBrain.messages.at(-1).id));assert.equal(await p.locator('dialog[open]').count(),0);
  saveStatus=500;release();await pending;
  assert((await p.locator('[data-ai-brain-progress]').textContent()).includes('not saved yet'));await create(1);
  assert.equal(await p.evaluate(()=>state.nodes.length),2);
  await first();saveStatus=409;await p.evaluate(()=>{showBoardConflictModal=async()=> 'cancel';});await p.evaluate(()=>saveBoardToServer('manual'));
  assert(await p.evaluate(()=>!state.aiBrain.messages.length || state.aiBrain.messages.at(-1).contentProposalInvalid));
  await first();lostSave=true;assert.equal(await p.evaluate(()=>saveBoardToServer('manual')),false);
  assert((await p.locator('[data-ai-brain-progress]').textContent()).includes('not saved yet'));
  await open();await p.locator('[data-ai-brain-prepare-confirm]').click();await p.waitForFunction(()=>state.aiBrain.messages.at(-1).proposal.status==='stale');
  assert.equal(await p.evaluate(()=>state.nodes.length),1);assert.equal(board.canvas_json.nodes.length,1);
  console.log('PASS pending/failed save recovery, save-conflict and lost-acknowledgement rejection without duplicate insertion');
  // A prepared preview survives an own save, with exact edits and no new Prepare.
  await first();await open();await prepare();await p.locator('[data-ai-brain-edit=caption]').fill('Retained across own autosave');
  const preparedCalls=conversions;await p.evaluate(()=>saveBoardToServer('autosave'));
  assert.equal(await p.locator('[data-ai-brain-edit=caption]').inputValue(),'Retained across own autosave');
  await p.locator('[data-ai-brain-create]').click();await p.waitForFunction(()=>state.nodes.length===2);
  assert.equal(await p.evaluate(()=>state.nodes.at(-1).social.caption),'Retained across own autosave');assert.equal(conversions,preparedCalls);
  console.log('PASS prepared preview and edits survive confirmed own autosave with fresh server checksum and no inference');
  // Codex P2: autosave may begin while Create authorization is already pending.
  await first();await open();await prepare();await p.locator('[data-ai-brain-edit=caption]').fill('Keep edited X during overlapping autosave');
  let checkStarted,checkRelease,saveStarted,saveRelease;
  const checkBegun=new Promise(r=>checkStarted=r),checkWait=new Promise(r=>checkRelease=r);
  const saveBegun=new Promise(r=>saveStarted=r),saveWait=new Promise(r=>saveRelease=r);
  hold={started:checkStarted,wait:checkWait};
  const checking=p.evaluate(()=>applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id));await checkBegun;
  saveHold={started:saveStarted,wait:saveWait};
  const overlappingSave=p.evaluate(()=>saveBoardToServer('autosave'));await saveBegun;
  checkRelease();await checking;
  assert.equal(await p.evaluate(()=>state.nodes.length),1);assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).proposal.status),'ready');
  assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).contentProposalInvalid),false);
  assert.equal(await p.locator('[data-ai-brain-edit=caption]').inputValue(),'Keep edited X during overlapping autosave');
  assert(await p.locator('[data-ai-brain-create]').isDisabled());
  saveRelease();await overlappingSave;assert(!(await p.locator('[data-ai-brain-create]').isDisabled()));
  await p.locator('[data-ai-brain-create]').click();await p.waitForFunction(()=>state.nodes.length===2);
  assert.equal(await p.evaluate(()=>state.nodes.at(-1).social.caption),'Keep edited X during overlapping autosave');
  console.log('PASS Codex P2: autosave overlapping successful Create preflight defers insertion, retains exact edits and requires another explicit Create');

  // Revalidate protected pending work after awaits, not only on entry.
  for(const boundary of ['Prepare','Create'])for(const mutation of ['account','source','canvas','revoke']) {
    await first();await open();if(boundary==='Create')await prepare();
    let started,release;const begun=new Promise(r=>started=r),wait=new Promise(r=>release=r);
    if(boundary==='Prepare')proposalHold={started,wait};else hold={started,wait};
    const running=p.evaluate(boundary=>boundary==='Prepare'?requestAiBrainNodeProposal(state.aiBrain.messages.at(-1).id):applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),boundary);
    await begun;
    if(mutation==='revoke')acl.membership=null;
    else await p.evaluate(mutation=>{if(mutation==='account')state.user={...state.user};if(mutation==='source')state.aiBrain.messages.at(-1).answer+='changed during await';if(mutation==='canvas')state.nodes[0].content+='changed during await';},mutation);
    release();await running;assert.equal(await p.evaluate(()=>state.nodes.length),1);
    assert(await p.evaluate(()=>!state.aiBrain.messages.length||state.aiBrain.messages.at(-1).proposal.status!=='ready'));
  }
  await first();let savedStart,savedRelease;const savedBegun=new Promise(r=>savedStart=r),savedWait=new Promise(r=>savedRelease=r);saveHold={started:savedStart,wait:savedWait};
  const saving=p.evaluate(()=>saveBoardToServer('autosave'));await savedBegun;
  await p.evaluate(()=>{state.nodes[0].content+='unrelated edit during save';markUnsaved();clearAutosaveTimer();});savedRelease();await saving;
  assert(await p.evaluate(()=>state.isDirty));assert(!await p.evaluate(()=>aiBrainContentSourceCurrent(state.aiBrain.messages.at(-1))));
  console.log('PASS account/source/Canvas/revocation during Prepare/Create awaits and unrelated edit during save acknowledgement');

  // Every local/source/account/scope change remains stale after the first insertion.
  for(const mutate of [
    ()=>state.user={...state.user},()=>state.currentBoardId='different',()=>state.boardLoadGeneration++,
    ()=>state.workspaceCatalog.generation++,()=>state.workspaceCatalog.activeWorkspaceId='different',
    ()=>state.boardBrandAssociation.generation++,()=>state.boardBrandAssociation.brandId=null,
    ()=>state.aiBrain.messages.at(-1).answer+='changed',()=>state.aiBrain.messages.at(-1).question+='changed',
    ()=>state.nodes[0].content+='unrelated',()=>{state.nodes.push({...state.nodes[0],id:'unrelated'});state.edges.push([state.nodes[0].id,'unrelated']);},
    ()=>state.lastKnownUpdatedAt='2020-01-01T00:00:00Z',()=>state.brandCore.valueProposition='unrelated'
  ]) {
    await first();const calls=conversions;
    await p.evaluate(mutate);
    // The mutation may itself add unrelated native data. Opening must add none.
    const n=await p.evaluate(()=>state.nodes.length);
    await p.evaluate(()=>openAiBrainContentReview(state.aiBrain.messages.at(-1).id));
    assert.equal(conversions,calls);assert.equal(await p.evaluate(()=>state.nodes.length),n);
    assert(await p.evaluate(()=>!state.aiBrain.messages.length || state.aiBrain.messages.at(-1).contentProposalInvalid));
    if(await p.evaluate(()=>state.aiBrain.messages.length))assert(!(await p.locator('[data-ai-brain-progress]').textContent()).includes(' available'));
  }
  console.log('PASS same-email account replacement, source/Board/load/Workspace/catalog/association/revision and unrelated local edit rejection');
  // Real signed server scope checks reject changes even across an acknowledged own save.
  for(const mutate of [()=>acl.identity.id='55555555-5555-4555-8555-555555555555',()=>acl.identity.revision='2',()=>acl.membership=null,()=>acl.workspace.revision='2',()=>acl.board.updated_at='2027-01-01T00:00:00.000Z']) {
    await first();await p.evaluate(()=>saveBoardToServer('manual'));mutate();await open();await p.locator('[data-ai-brain-prepare-confirm]').click();
    await p.waitForFunction(()=>['failed','stale'].includes(state.aiBrain.messages.at(-1).proposal.status));
    assert.equal(await p.evaluate(()=>state.nodes.length),1);
    acl.board.updated_at=board.updated_at;
  }
  console.log('PASS server identity replacement/revision, revoked Workspace access, Workspace revision and remote edit rejection');
  // Undo consumes the source permanently and cannot silently turn into recreation.
  await first();await p.evaluate(()=>{el.undoButton.click();clearAutosaveTimer();setActiveView('ai_brain');});
  assert.equal(await p.evaluate(()=>state.nodes.length),0);assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).contentCompleted.length),1);
  await p.evaluate(()=>openAiBrainContentReview(state.aiBrain.messages.at(-1).id));assert.equal(await p.locator('dialog[open]').count(),0);
  // Failed insertion can be retried; unknown partial insertion cannot duplicate.
  for(const partial of [false,true]) {
    await first();await open();await prepare();
    await p.evaluate(async partial=>{const old=createNode;createNode=options=>{if(partial)old(options);throw Error('fictional renderer failure');};try{await Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]);}finally{createNode=old;clearAutosaveTimer();}},partial);
    assert.equal(await p.evaluate(()=>state.nodes.length),partial?2:1);
    assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).contentCompleted.length),partial?2:1);
    assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).proposal.status),partial?'applied':'failed');
  }
  console.log('PASS consumed-item undo, duplicate-click prevention, pre-insertion failure and partial insertion');
  // Keyboard return, cancel/back, card switching and compact completion at all sizes/themes.
  for(const width of [320,375,1440])for(const theme of ['light','dark']) {
    await p.setViewportSize({width,height:640});await first();
    await p.evaluate(theme=>{window.FunklixTheme.setPreference(theme);state.uiLanguage=language.setUiLanguage('de');renderAiBrain();},theme);
    await p.locator('#ai-brain-question').fill('Keep this composer draft');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(5,9));
    await open();assert(await p.locator('[data-ai-brain-source] input[value="0"]').isDisabled());
    const box=await p.locator('dialog[open]').boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.height<=640);
    await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
    assert(await p.locator('[data-ai-brain-prepare]').evaluate(n=>n===document.activeElement));
    assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this composer draft');
    await create(1);
  }
  assert.equal(paid,0);assert(advice>0&&saves>0);global.fetch=originalFetch;
  assert.deepEqual(f.errors,[]);await p.close();
  console.log('PASS EN/DE, Light/Dark, 320/375/desktop, modal keyboard/Escape/focus/composer; real signed server scope, zero inference');

 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
