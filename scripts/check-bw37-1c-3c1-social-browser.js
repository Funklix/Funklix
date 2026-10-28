'use strict';
const assert=require('node:assert/strict'), {chromium}=require('playwright-core');
const social=require('../ai-brain-social-proposal');
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try {
  const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
  let answer,conversions=0,paid=0,reads=0,seq=0,deny=false,hold=null,saves=0;
  const requests=[];
  await p.route('**/api/ai-brain/advice',r=>r.fulfill({json:{answer,assumptions:[],disclaimer:'Fictional fixture',context:{response_language:r.request().postDataJSON().response_language,reference_resolution:'none'}}}));
  await p.route('**/api/ai-brain/propose-node',r=>{
   const b=r.request().postDataJSON();requests.push(b);conversions++;
   if(b.action==='propose_social_node')return r.fulfill({json:{action:b.action,scope_revision:'a'.repeat(64),node_proposal:{proposal_id:'social-'+(++seq),source_turn_id:b.source_turn_id,...social.extract(b.source_answer)},context:{board_id:b.board_id,response_language:b.response_language,content_language:b.content_language}}});
   paid++;return r.fulfill({json:{action:b.action,scope_revision:'a'.repeat(64),node_proposal:{proposal_id:'content-'+(++seq),source_turn_id:b.source_turn_id,node_type:'Content',title:'Reusable story',body:b.source_answer},context:{board_id:b.board_id,response_language:b.response_language,content_language:b.content_language}}});
  });
  await p.route('**/api/ai-brain/content-scope',async r=>{reads++;if(hold){const h=hold;hold=null;h.started();await h.wait;}return r.fulfill({status:deny?403:200,json:deny?{code:'proposal_forbidden'}:{scope_revision:'a'.repeat(64)}}).catch(()=>{});});
  await p.route('**/api/boards/*',async r=>{if(r.request().method()!=='PUT')return r.fallback();saves++;const b=r.request().postDataJSON();f.r.db.boards[0].canvas_json=b.canvas_json;f.r.db.boards[0].updated_at=new Date().toISOString();return r.fulfill({json:{id:f.r.db.boards[0].id,updated_at:f.r.db.boards[0].updated_at}});});
  const boot=async()=>{await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');});};
  const ask=async()=>{await p.locator('#ai-brain-question').fill('Write posts for #MyAppicsStory');await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
  const open=async()=>{await p.locator('[data-ai-brain-prepare]').last().click();await p.locator('[data-ai-brain-prepare-confirm]').waitFor();};
  const prepare=async()=>{await p.locator('[data-ai-brain-prepare-confirm]').click();await p.locator('[data-ai-brain-create]').waitFor();};
  const choose=async i=>p.locator(`[data-ai-brain-source] input[value="${i}"]`).check();
  const snapshot=()=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,history:state.history,dirty:state.isDirty}));
  for(const source of require('./fixtures/bw37-1c3b-r2-appics-markdown'))for(const i of [0,1]){
   answer=source;await boot();await ask();const before=await snapshot(),calls=conversions,remote=reads;
   await open();await choose(0);await choose(1);await choose(i);
   assert.equal(await p.locator('[data-ai-brain-destination]').inputValue(),social.TYPE);assert.equal(conversions,calls);assert.equal(reads,remote);
   const selected=await p.locator('[data-ai-brain-excerpt]').textContent(),expected=social.extract(selected);
   assert((await p.locator('[data-ai-brain-cost]').textContent()).includes('without an AI request'));
   await prepare();assert.equal(conversions,calls+1);assert.equal(paid,0);assert.equal(requests.at(-1).source_answer,selected);assert.equal(await snapshot(),before);
   for(const field of ['platform','caption','preview','hashtags'])assert.equal(await p.locator(`[data-ai-brain-edit=${field}]`).inputValue(),expected[field]);
   await p.locator('[data-ai-brain-edit=title]').fill('Edited '+i);await p.locator('[data-ai-brain-edit=caption]').fill(expected.caption+'\nMy edit');
   await p.locator('[data-ai-brain-edit=preview]').fill('My CTA');await p.locator('[data-ai-brain-edit=hashtags]').fill('#MyAppicsStory #Edited');
   const count=await p.evaluate(()=>state.nodes.length),history=await p.evaluate(()=>state.history.length);
   await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]));
   await p.waitForFunction(()=>state.selectedPrimary===state.nodes.at(-1).id);
   const node=await p.evaluate(()=>state.nodes.at(-1));assert.equal(node.type,social.TYPE);assert.equal(node.channel,expected.platform);assert.equal(node.title,'Edited '+i);
   assert.deepEqual(node.social,{platform:expected.platform,caption:expected.caption+'\nMy edit',preview:'My CTA',hashtags:['#MyAppicsStory','#Edited'],scheduledAt:''});
   assert.equal(node.content,node.social.caption);assert.equal(node.status,'Draft');assert.equal(node.images.length,0);assert(!node.planningSchedule);assert(!node.approvalFingerprint);
   assert.equal(await p.evaluate(()=>state.nodes.length),count+1);assert.equal(await p.evaluate(()=>state.history.length),history+1);assert.equal(reads,remote+1);assert.equal(conversions,calls+1);
   assert.equal(await p.locator(`[data-id="${node.id}"] .social-caption`).textContent(),node.social.caption);
   assert.equal(await p.evaluate(()=>el.inputs.caption.value),node.social.caption);assert.equal(await p.evaluate(()=>el.inputs.preview.value),'My CTA');
   if(i===1)assert(await p.locator(`[data-id="${node.id}"] .social-char-count`).evaluate(n=>n.classList.contains('warning')));
   await p.evaluate(()=>saveBoardToServer('manual'));await p.waitForFunction(()=>!state.isDirty);
   await p.evaluate(()=>{clearAutosaveTimer();el.undoButton.click();clearAutosaveTimer();});assert.equal(await p.evaluate(()=>state.nodes.length),count);
   // Native Canvas currently exposes undo only. Reload the saved server snapshot.
   await boot();
   const reloaded=await p.evaluate(id=>state.nodes.find(n=>n.id===id),node.id);assert.equal(reloaded.type,social.TYPE);assert.deepEqual(reloaded.social,node.social);assert.equal(reloaded.channel,node.channel);assert.equal(reloaded.content,node.content);
  }
  console.log('PASS Appics Instagram/X, all format variants, exact fields/edits, native cards/Inspector/character warnings, Draft, no images/approval/schedule, single history/undo/autosave/save/reload; zero inference');
  // Partial fields remain blank and editable; explicit platform selection is required.
  answer='##### Instagram Post\n\n**Caption:** A concrete story from our creative community. Share the process behind your first sketch and invite someone to tell their story.';
  await boot();await ask();await open();await prepare();assert.equal(await p.locator('[data-ai-brain-edit=preview]').inputValue(),'');assert.equal(await p.locator('[data-ai-brain-edit=hashtags]').inputValue(),'');
  await p.locator('[data-ai-brain-edit=caption]').fill('');assert(await p.locator('[data-ai-brain-create]').isDisabled());
  await p.locator('[data-ai-brain-edit=caption]').fill('<img src=x onerror="window.socialXss=true">');assert.equal(await p.evaluate(()=>window.socialXss),undefined);
  await p.locator('[data-ai-brain-edit=platform]').selectOption('');assert(await p.locator('[data-ai-brain-create]').isDisabled());
  await p.locator('[data-ai-brain-edit=platform]').selectOption('X / Twitter');assert(!(await p.locator('[data-ai-brain-create]').isDisabled()));
  await p.locator('[data-ai-brain-edit=caption]').fill('a'.repeat(4001));assert(await p.locator('[data-ai-brain-create]').isDisabled());
  await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
  for(const heading of ['Social Media Post','Social Media Post — Instagram / X']) {
   answer=answer.replace(/^##### [^\n]+/, '##### '+heading);await boot();await ask();await open();
   assert.equal(await p.locator('[data-ai-brain-destination]').inputValue(),'Content');
   await p.locator('[data-ai-brain-destination]').selectOption(social.TYPE);await prepare();
   assert.equal(await p.locator('[data-ai-brain-edit=platform]').inputValue(),'');assert(await p.locator('[data-ai-brain-create]').isDisabled());
   await p.locator('[data-ai-brain-edit=platform]').selectOption('Instagram');assert(!(await p.locator('[data-ai-brain-create]').isDisabled()));await p.keyboard.press('Escape');
  }
  answer=answer.replace(/^##### [^\n]+/,'##### Instagram Post');
  // Content remains an explicit supported destination for an Instagram asset.
  await boot();await ask();await open();await p.locator('[data-ai-brain-destination]').selectOption('Content');assert((await p.locator('[data-ai-brain-cost]').textContent()).includes('one AI request'));await prepare();assert.equal(paid,1);assert.equal(await p.locator('[data-ai-brain-edit=body]').count(),1);
  console.log('PASS partial optional fields, required caption/platform, safe rendering, field bounds, cancel and explicit Content fallback');
  for(const mutate of [()=>state.user={...state.user},()=>state.currentBoardId='other',()=>state.boardLoadGeneration++,()=>state.workspaceCatalog.generation++,()=>state.aiBrain.messages.at(-1).answer+='changed']){
   await boot();await ask();await open();const calls=conversions;await p.evaluate(mutate);await p.evaluate(()=>requestAiBrainNodeProposal(state.aiBrain.messages.at(-1).id));assert.equal(conversions,calls);
   await boot();await ask();await open();await prepare();const before=await snapshot();await p.evaluate(mutate);await p.evaluate(()=>applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id));assert.equal(await snapshot(),before);
  }
  await boot();await ask();await open();await prepare();const before=await snapshot();deny=true;await p.locator('[data-ai-brain-create]').click();await p.waitForFunction(()=>state.aiBrain.messages.at(-1).proposal.status==='stale');assert.equal(await snapshot(),before);deny=false;
  await boot();await ask();await open();await prepare();let started,release;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r);hold={wait,started};const count=await p.evaluate(()=>state.nodes.length);const applying=p.evaluate(()=>applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id));await begun;await p.evaluate(()=>state.user={...state.user});release();await applying;assert.equal(await p.evaluate(()=>state.nodes.length),count);
  console.log('PASS stale account/Board/load/Workspace/source before Prepare/Create, remote revocation and changes during authorization await');
  for(const partial of [false,true]) {
   await boot();await ask();await open();await prepare();const count=await p.evaluate(()=>state.nodes.length),history=await p.evaluate(()=>state.history.length);
   await p.evaluate(async partial=>{const old=createNode;createNode=options=>{if(partial)old(options);throw Error('fictional renderer failure');};try{await Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]);}finally{createNode=old;clearAutosaveTimer();}},partial);
   assert.equal(await p.evaluate(()=>state.nodes.length),count+(partial?1:0));assert.equal(await p.evaluate(()=>state.history.length),history+(partial?1:0));
   assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).proposal.status),partial?'applied':'failed');
   if(partial)assert.equal(await p.evaluate(()=>state.nodes.at(-1).social.platform),'Instagram');
  }
  console.log('PASS native Social pre-insertion rollback and partial-insertion recovery with duplicate protection');
  for(const width of [320,375,1440])for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:640});await boot();await p.evaluate(t=>{window.FunklixTheme.setPreference(t);state.uiLanguage=language.setUiLanguage('de');},theme);await ask();await open();
   const box=await p.locator('dialog[open]').boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.height<=640);
   await prepare();await p.locator('[data-ai-brain-edit=platform]').focus();await p.keyboard.press('Tab');assert(await p.evaluate(()=>!!document.activeElement.closest('dialog[open]')));await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
  }
  assert(saves>=6);assert.deepEqual(f.errors,[]);await p.close();console.log('PASS EN/DE, desktop/mobile, light/dark, keyboard focus and Escape');
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
