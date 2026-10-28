'use strict';
const assert=require('node:assert/strict'), {chromium}=require('playwright-core');
const appics=require('node:fs').readFileSync('scripts/fixtures/bw37-1c3b-r1-appics-response.txt','utf8');
const first="Here's a LinkedIn post you can use:\r\nYour first sketch doesn't need to be perfect. It needs a place to begin. Share the experiment behind your next idea with a community that values the process. Join our next workshop.";
const second='Hier ist ein konkreter LinkedIn-Beitrag:\nDeine erste Skizze muss nicht perfekt sein. Sie braucht einen Anfang. Teile das Experiment hinter deiner nächsten Idee mit einer Gemeinschaft, die deinen eigenen Weg schätzt. Melde dich zum Workshop an.';
async function main(){
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox'],timeout:30000});
 try{
  const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
  let answer=first,proposalCalls=0,scopeCalls=0,scopeStatus=200,hold=null,proposalHold=null,saves=0,saveHold=null,sequence=0;
  const requests=[];
  await p.route('**/api/ai-brain/advice',route=>route.fulfill({json:{answer,assumptions:[],disclaimer:'Fictional fixture',context:{response_language:route.request().postDataJSON().response_language,reference_resolution:'none'}}}));
  await p.route('**/api/ai-brain/propose-node',async route=>{
   proposalCalls++;const body=route.request().postDataJSON();requests.push(body);
   if(proposalHold){const h=proposalHold;proposalHold=null;h.started();await h.wait;}
   return route.fulfill({json:{action:'propose_content_node',scope_revision:'a'.repeat(64),node_proposal:{proposal_id:'ux-'+(++sequence),source_turn_id:body.source_turn_id,node_type:'Content',title:body.source_answer.includes('#MyAppicsStory')?(body.source_answer.includes('Instagram')?'Instagram Post':'X Post'):'First sketch',body:body.source_answer.includes('#MyAppicsStory')?body.source_answer.trim():'Share your first sketch with the creative community.',rationale:'Separate explanation, never body copy.'},context:{board_id:body.board_id,response_language:body.response_language,content_language:body.content_language}}}).catch(()=>{});
  });
  await p.route('**/api/ai-brain/content-scope',async route=>{
   scopeCalls++;const body=route.request().postDataJSON();assert.equal(body.scope_revision,'a'.repeat(64));assert.equal(Object.keys(body).length,3);
   if(hold){const h=hold;hold=null;h.started();await h.wait;}
   return route.fulfill({status:scopeStatus,json:scopeStatus===200?{scope_revision:'a'.repeat(64)}:{code:'proposal_context_changed'}}).catch(()=>{});
  });
  await p.route('**/api/boards/*',async route=>{
   if(route.request().method()!=='PUT')return route.fallback();
   saves++;const body=route.request().postDataJSON();f.r.db.boards[0].canvas_json=body.canvas_json;f.r.db.boards[0].updated_at=new Date().toISOString();
   if(saveHold){const h=saveHold;saveHold=null;h.started();await h.wait;}
   return route.fulfill({json:{id:f.r.db.boards[0].id,updated_at:f.r.db.boards[0].updated_at}});
  });
  const boot=async()=>{await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');});};
  const ask=async()=>{await p.locator('#ai-brain-question').fill('Write a reusable LinkedIn post');await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
  const open=async()=>{await p.locator('[data-ai-brain-prepare]').last().click();await p.locator('[data-ai-brain-prepare-confirm]').waitFor();};
  const ready=async()=>{await open();await p.locator('[data-ai-brain-prepare-confirm]').click();await p.locator('[data-ai-brain-create]').waitFor();};
  const snapshot=()=>p.evaluate(()=>({nodes:JSON.stringify(state.nodes),edges:JSON.stringify(state.edges),history:JSON.stringify(state.history),dirty:state.isDirty,brand:JSON.stringify(state.brandCore)}));
  // Replay the live answer through both independent selections and the actual
  // editable preview/Create owner. All provider transport remains mocked.
  for(const fixture of require('./fixtures/bw37-1c3b-r2-appics-markdown'))for(const index of [0,1]){
   answer=fixture;await boot();await ask();const original=await snapshot(),paid=proposalCalls,reads=scopeCalls;
   const sources=await p.evaluate(()=>aiBrainContentAssets(state.aiBrain.messages.at(-1)).map(a=>a.text));assert.equal(sources.length,2);
   await open();const choice=p.locator('[data-ai-brain-source]');
   assert.deepEqual(await choice.locator('strong').allTextContents(),['Instagram Post','X Post']);
   for(const selected of ['0','1',String(index)])await choice.locator(`input[value="${selected}"]`).check();
   assert.equal(proposalCalls,paid);assert.equal(scopeCalls,reads);assert.deepEqual(await snapshot(),original);
   assert(await p.evaluate(()=>{const t=state.aiBrain.messages.at(-1);return aiBrainContentSelectionCurrent(t,t.proposal.selection);}));
   assert.equal(await p.locator('[data-ai-brain-excerpt]').textContent(),sources[index]);
   await p.locator('[data-ai-brain-destination]').selectOption('Content');
   await p.locator('[data-ai-brain-prepare-confirm]').click();await p.locator('[data-ai-brain-create]').waitFor();
   assert.equal(proposalCalls,paid+1);assert.equal(requests.at(-1).source_answer,sources[index]);assert.deepEqual(await snapshot(),original);
   assert.equal(await p.locator('[data-ai-brain-edit=title]').inputValue(),index===0?'Instagram Post':'X Post');
   // Existing proposal validation canonicalizes CRLF for editable Content only.
   // The exact excerpt and outbound source above must remain byte-for-byte.
   assert.equal(await p.locator('[data-ai-brain-edit=body]').inputValue(),sources[index].replace(/\r\n?/g,'\n').trim());
   const count=await p.evaluate(()=>state.nodes.length),history=await p.evaluate(()=>state.history.length);
   await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id),applyAiBrainNodeProposal(state.aiBrain.messages.at(-1).id)]));
   assert.equal(await p.evaluate(()=>state.nodes.length),count+1);assert.equal(await p.evaluate(()=>state.history.length),history+1);
   assert.equal(await p.evaluate(()=>state.nodes.at(-1).type),'Content');assert.equal(await p.evaluate(()=>state.nodes.at(-1).content),sources[index].replace(/\r\n?/g,'\n').trim());
   assert.equal(proposalCalls,paid+1);assert.equal(scopeCalls,reads+1);
   await p.evaluate(()=>{clearAutosaveTimer();el.undoButton.click();clearAutosaveTimer();});assert.equal(await p.evaluate(()=>state.nodes.length),count);
  }
  console.log('PASS R1 both Appics selections: exact isolated source, zero-call selection, one-call preparation, editable preview, explicit one-node Create, duplicate protection and undo');
  scopeCalls=0;
  await boot();answer=first+'\n\n'+second;await ask();const before=await snapshot(),n=proposalCalls;
  await p.locator('#ai-brain-question').fill('Keep this newer composer draft');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(4,9));await p.locator('#ai-brain-mode').selectOption('find_gaps');
  await open();assert.equal(proposalCalls,n);assert.equal(scopeCalls,0);assert(await p.locator('[data-ai-brain-prepare-confirm]').isDisabled());
  const select=p.locator('[data-ai-brain-source]');assert.equal(await select.locator('input[type=radio]').count(),2);
  await select.locator('input[value="0"]').check();assert.equal(await p.locator('[data-ai-brain-excerpt]').textContent(),first+'\n\n');assert.equal(proposalCalls,n);
  await select.locator('input[value="1"]').check();assert.equal(await p.locator('[data-ai-brain-excerpt]').textContent(),second);assert.equal(proposalCalls,n);assert.deepEqual(await snapshot(),before);
  assert((await p.locator('.ai-brain-node-preview').innerText()).includes('Autumn Launch'));assert((await p.locator('.ai-brain-node-preview').innerText()).includes('AI-generated suggestion'));
  await p.locator('[data-ai-brain-prepare-confirm]').click();await p.locator('[data-ai-brain-create]').waitFor();assert.equal(proposalCalls,n+1);assert.equal(requests.at(-1).source_answer,second);assert.deepEqual(await snapshot(),before);
  const title=p.locator('[data-ai-brain-edit=title]'),body=p.locator('[data-ai-brain-edit=body]'),create=p.locator('[data-ai-brain-create]');
  for(const invalid of ['', ' ', 'x'.repeat(121), 'bad\u0001title']){await title.fill(invalid);assert(await create.isDisabled());}
  await title.fill('x'.repeat(120));assert(await create.isEnabled());
  for(const invalid of ['', ' ', 'x'.repeat(4001), 'bad\u0001body']){await body.fill(invalid);assert(await create.isDisabled());}
  await body.fill('x'.repeat(4000));assert(await create.isEnabled());
  await title.fill('Activity');await body.fill('Draft');
  for(const locale of ['de','en']){await p.evaluate(locale=>{state.uiLanguage=language.setUiLanguage(locale);refreshInterfaceLanguage();},locale);assert.equal(await title.inputValue(),'Activity');assert.equal(await body.inputValue(),'Draft');assert.equal(await p.locator('[data-ai-brain-excerpt]').textContent(),second);assert.equal(await title.getAttribute('data-user-content'),'true');assert.equal(await body.getAttribute('data-user-content'),'true');assert.equal(await p.locator('[data-ai-brain-excerpt]').getAttribute('data-user-content'),'true');}
  const editedTitle='<img src=x onerror=alert(1)>',editedBody='<script>window.__executed=true</script>\nA human reviewed invitation.';
  await title.fill(editedTitle);await body.fill(editedBody);assert.equal(proposalCalls,n+1);
  assert.equal(await p.locator('.ai-brain-node-preview script,.ai-brain-node-preview img').count(),0);assert.equal(await p.evaluate(()=>window.__executed),undefined);
  await p.evaluate(()=>renderAiBrain());assert.equal(await title.inputValue(),editedTitle);assert.equal(await body.inputValue(),editedBody);
  await p.locator('[data-ai-brain-cancel]').focus();await p.keyboard.press('Escape');assert.equal(await create.count(),0);assert.deepEqual(await snapshot(),before);
  assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this newer composer draft');assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd]),[4,9]);assert.equal(await p.locator('#ai-brain-mode').inputValue(),'find_gaps');
  // Real scroll owner remains anchored during source review/cancel and navigation.
  await p.evaluate(()=>{const t=state.aiBrain.messages[0];state.aiBrain.messages=Array.from({length:12},(_,i)=>({...t,id:'history-'+i,contentProposalSource:null})).concat(t);renderAiBrain();const e=el.aiBrainSummary.querySelector('.ai-brain-transcript');e.scrollTop=0;e.dispatchEvent(new Event('scroll'));});
  const top=await p.locator('.ai-brain-transcript').evaluate(e=>e.scrollTop);await p.evaluate(()=>openAiBrainContentReview(state.aiBrain.messages.at(-1).id));await p.locator('[data-ai-brain-source] input[value="0"]').check();await p.locator('[data-ai-brain-prepare-confirm]').evaluate(n=>n.click());await create.waitFor();assert.equal(await p.locator('.ai-brain-transcript').evaluate(e=>e.scrollTop),top,'preparation preserves the retained scroll anchor');await p.locator('[data-ai-brain-cancel]').evaluate(n=>n.click());assert.equal(await p.locator('.ai-brain-transcript').evaluate(e=>e.scrollTop),top);
  await open();await p.evaluate(()=>{setActiveView('board');setActiveView('ai_brain');});assert.equal(await p.locator('[data-ai-brain-prepare-confirm]').count(),0);assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this newer composer draft');
  // Escape cancels the active explicit preparation; late provider completion
  // cannot reopen its preview or retry the paid request.
  answer=first;await boot();await ask();await open();const original=await snapshot(),callsBefore=proposalCalls;
  let startProposal,releaseProposal;const proposalWait=new Promise(r=>releaseProposal=r),proposalBegun=new Promise(r=>startProposal=r);proposalHold={wait:proposalWait,started:startProposal};
  await p.locator('[data-ai-brain-prepare-confirm]').click();await proposalBegun;await p.keyboard.press('Escape');releaseProposal();
  await p.waitForFunction(()=>state.aiBrain.messages[0].proposal.status==='cancelled');assert.equal(proposalCalls,callsBefore+1);assert.equal(await create.count(),0);assert.deepEqual(await snapshot(),original);
  // Failure at the consequential read boundary inserts nothing; no provider retry.
  answer=first;await boot();await ask();await ready();const denied=await snapshot(),paid=proposalCalls;
  scopeStatus=403;await create.click();await p.waitForFunction(()=>state.aiBrain.messages[0].proposal.status==='stale');assert.deepEqual(await snapshot(),denied);assert.equal(proposalCalls,paid);scopeStatus=200;
  // Changes/cancel/navigation while the remote authorization read is pending.
  for(const mutate of [()=>state.user={...state.user},()=>state.lastKnownUpdatedAt='2020-01-01',()=>state.workspaceCatalog.generation++,()=>state.boardBrandAssociation.generation++,()=>state.aiBrain.messages[0].answer+='changed',()=>setActiveView('board'),()=>cancelAiBrainNodeProposal(state.aiBrain.messages[0].id)]){
   await boot();await ask();await ready();const previous=await snapshot();let started,release;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r);hold={wait,started};
   const applying=p.evaluate(()=>applyAiBrainNodeProposal(state.aiBrain.messages[0].id));await begun;await p.evaluate(mutate);release();await applying;assert.deepEqual(await snapshot(),previous);
  }
  // Source staleness cannot revive when the old revision is put back.
  await boot();await ask();await open();await p.evaluate(()=>{const old=state.lastKnownUpdatedAt;state.lastKnownUpdatedAt='2020-01-01';renderAiBrain();state.lastKnownUpdatedAt=old;renderAiBrain();});
  const count=proposalCalls;await p.evaluate(()=>requestAiBrainNodeProposal(state.aiBrain.messages[0].id));assert.equal(proposalCalls,count);assert.equal(await create.count(),0);
  // Native modal geometry/focus under the production shell, including short
  // mobile viewports, both locales/themes and an expanded exact original span.
  for(const locale of ['en','de'])for(const theme of ['light','dark'])for(const width of [320,375,1440]){
   answer=appics;await p.setViewportSize({width,height:width<500?640:900});await boot();await ask();
   await p.evaluate(({locale,theme})=>{state.uiLanguage=language.setUiLanguage(locale);window.FunklixTheme.setPreference(theme);renderAiBrain();},{locale,theme});
   const paid=proposalCalls,reads=scopeCalls;await p.locator('[data-ai-brain-prepare]').focus();await p.keyboard.press('Enter');
   const modal=p.getByRole('dialog'),cards=modal.locator('input[type=radio]'),footer=modal.locator('.ai-brain-proposal-actions');
   assert.equal(await modal.count(),1);assert.equal(await modal.evaluate(n=>n.matches(':modal')),true);
   assert.equal(await cards.count(),2);assert.equal(await modal.locator('details').getAttribute('open'),null);
   assert.equal(await modal.locator('[data-ai-brain-excerpt]').isVisible(),false);
   await cards.first().focus();await p.keyboard.press('Space');await p.keyboard.press('ArrowDown');
   assert.equal(await cards.last().isChecked(),true);assert.equal(await cards.first().isChecked(),false);
   assert.equal(proposalCalls,paid);assert.equal(scopeCalls,reads);
   assert.equal(await modal.locator('[data-ai-brain-excerpt]').textContent(),await p.evaluate(()=>state.aiBrain.messages.at(-1).proposal.selection.text));
   assert.equal(await modal.locator('legend').textContent(),locale==='de'?'Wähle einen Inhalt':'Choose one content asset');
   // The top layer receives hit testing even where the composer/Jump lie below.
   const geometry=()=>modal.evaluate(n=>{const r=n.getBoundingClientRect(),a=n.querySelector('.ai-brain-proposal-actions').getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&a.top>=r.top&&a.bottom<=r.bottom;});
   assert(await geometry());
   await modal.locator('summary').click();
   const footerBefore=await footer.boundingBox();
   await modal.locator('.ai-brain-content-scroll').evaluate(n=>{n.scrollTop=n.scrollHeight;});
   const footerAfter=await footer.boundingBox();assert.deepEqual(footerAfter,footerBefore);assert(await geometry());
   assert(await modal.evaluate(n=>{const b=n.querySelector('[data-ai-brain-prepare-confirm]').getBoundingClientRect();return n.contains(document.elementFromPoint(b.x+b.width/2,b.y+b.height/2));}));
   assert(await modal.locator('.ai-brain-content-scroll').evaluate(n=>n.scrollHeight>n.clientHeight),'expanded source scrolls inside the dialog');
   const pageTop=await p.evaluate(()=>document.scrollingElement.scrollTop);
   await modal.locator('.ai-brain-content-scroll').hover();await p.mouse.wheel(0,1000);
   assert.equal(await p.evaluate(()=>document.scrollingElement.scrollTop),pageTop);
   await modal.locator('[data-ai-brain-prepare-confirm]').focus();await p.keyboard.press('Tab');assert(await modal.evaluate(n=>n.contains(document.activeElement)));
   await p.keyboard.press('Shift+Tab');assert(await modal.evaluate(n=>n.contains(document.activeElement)));
   await p.keyboard.press('Escape');assert.equal(await modal.count(),0);assert(await p.locator('[data-ai-brain-prepare]').evaluate(n=>n===document.activeElement));
   assert.equal(proposalCalls,paid);
   await open();await cards.first().check();await p.locator('[data-ai-brain-destination]').selectOption('Content');await p.locator('[data-ai-brain-prepare-confirm]').click();await create.waitFor();
   assert.equal(proposalCalls,paid+1);assert(await geometry());
   assert.equal(await modal.locator('details').getAttribute('open'),null);
   await p.keyboard.press('Escape');assert.equal(await create.count(),0);
  }
  console.log('PASS compact modal EN/DE, light/dark, 320/375/1440, short viewports, cards/arrow keys, exact expandable source, contained scrolling, fixed actions, top-layer hit testing, focus trap/restoration and one explicit inference');
  answer=first;await p.setViewportSize({width:1440,height:1100});
  answer=first+'\n<img src=x onerror=alert(1)>';await boot();await ask();await ready();assert.equal(await p.locator('.ai-brain-node-preview img').count(),0);
  await title.fill(editedTitle);await body.fill(editedBody);const nodes=await p.evaluate(()=>state.nodes.length),history=await p.evaluate(()=>state.history.length),paidBefore=proposalCalls;
  let startedSave,releaseSave;const saveWait=new Promise(r=>releaseSave=r),saveBegun=new Promise(r=>startedSave=r);saveHold={wait:saveWait,started:startedSave};
  await p.evaluate(()=>Promise.all([applyAiBrainNodeProposal(state.aiBrain.messages[0].id),applyAiBrainNodeProposal(state.aiBrain.messages[0].id)]));
  assert.equal(proposalCalls,paidBefore);assert.equal(await p.evaluate(()=>state.nodes.length),nodes+1);assert.equal(await p.evaluate(()=>state.history.length),history+1);assert.equal(await p.evaluate(()=>state.edges.length),0);
  assert.equal(await p.evaluate(()=>state.nodes.at(-1).title),editedTitle);assert.equal(await p.evaluate(()=>state.nodes.at(-1).content),editedBody);assert.equal(await p.evaluate(()=>state.nodes.at(-1).status),'Draft');assert(await p.evaluate(()=>state.isDirty));
  await p.waitForFunction(()=>state.selectedPrimary===state.nodes.at(-1).id);assert.equal(await p.evaluate(()=>document.activeElement===el.inputs.title),true);
  const saving=p.evaluate(()=>saveBoardToServer('manual'));await saveBegun;assert(await p.evaluate(()=>state.isDirty),'insertion/pending save is not confirmed persistence');releaseSave();await saving;await p.waitForFunction(()=>!state.isDirty);assert(saves>=1);
  await boot();assert.equal(await p.evaluate(()=>state.nodes.filter(n=>n.title==='<img src=x onerror=alert(1)>').length),1);assert.equal(await p.evaluate(()=>state.nodes.at(-1).content),editedBody);assert.equal(await p.evaluate(()=>window.__executed),undefined);
  assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await p.close();
  console.log('PASS real shell Content source selection/cost, exact excerpts, edit limits/inert rendering, keyboard/Escape/return/scroll/themes/mobile, fresh remote Create/cancel/races, one node/history, Inspector and save/reload');
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
