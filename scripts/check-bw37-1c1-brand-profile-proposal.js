'use strict';
// Fictional data, actual destination/controller and protected owner handlers.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { chromium } = require('playwright-core');
const { runtime } = require('./fixtures/bw36-23-brand-knowledge-runtime');
const app = fs.readFileSync('app.js', 'utf8');
const answer = 'Proposed Value Proposition: Independent makers explore new formats together, with room for their own creative choices.';
const german = 'Vorgeschlagenes Nutzenversprechen: Kreative erkunden gemeinsam neue Formate und behalten Raum für eigene Entscheidungen.';
const question = 'Suggest a replacement Value Proposition for the Brand Profile';
function eligibility() {
  const c = {}; vm.runInNewContext(app.slice(app.indexOf('function aiBrainValueProposition'), app.indexOf('function aiBrainBrandSourceCurrent')), c);
  for (const adviceMode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) {
    for (const text of [answer, german]) assert(c.aiBrainValueProposition({status:'success',question,answer:text,adviceMode}));
    for (const text of ['', 'Campaign concept: #MyAppicsStory', answer+'\n'+german, answer+'\nBrand DNA: Creator', 'Value Proposition: Unlabelled', answer+'\nOption B: Other', 'Proposed Value Proposition: '+ 'x'.repeat(2001), 'Proposed Value Proposition: Guaranteed growth of 50 percent']) assert.equal(c.aiBrainValueProposition({status:'success',question,answer:text,adviceMode}), null);
  }
  for (const status of ['pending','failed']) assert.equal(c.aiBrainValueProposition({status,question,answer}),null);
  assert.equal(c.aiBrainValueProposition({status:'success',question:'Draft a campaign hashtag',answer}),null);
  assert.equal(c.aiBrainValueProposition({status:'success',question:'Suggest a Value Proposition for this campaign',answer}),null);
  assert.equal(c.aiBrainValueProposition({status:'success',question,answer,referenceResolution:'clarification'}),null);
  console.log('PASS bounded explicit EN/DE proposal selection, all modes, mixed/ambiguous/claim/oversize negatives');
}
const input = f => ({path:'/brand_core/valueProposition',value:'A considered new positioning proposal.',revision:1,expected:{exists:false},revalidate:async()=>true});
async function controllers() {
  for (const old of [undefined, null, '', 'Old exact text']) {
    const f=runtime(),s=f.session, original=f.brand.brand_core;
    // Recreate the actual session with each canonical representation.
    const profile=require('../brand-profile-setup'), brand=f.brand;
    if(old!==undefined)brand.brand_core.valueProposition=old;
    let stored=structuredClone(brand),puts=[];
    const session=profile.createSession({brand,getContext:()=>f.context,validateBrand:b=>b?.id===brand.id,onSave(){},fetchImpl:async(url,init={})=>{
      if(init.method==='PUT'){const cmd=JSON.parse(init.body);puts.push(cmd);stored={...stored,...require('../brand-write-contract').apply(stored,cmd),revision:2};}
      return {ok:true,status:200,json:async()=>structuredClone(stored)};
    }});
    const proposal={...input(f),expected:old===undefined?{exists:false}:{exists:true,value:old}};
    assert(await session.stageValueProposition(proposal));assert.equal(puts.length,0);assert(session.contentDirty());assert.equal(session.state.brand.revision,1);
    assert.equal(await session.stageValueProposition(proposal),false,'Cannot silently stage twice over a draft');
    assert(await session.save());assert.equal(puts.length,1);assert.equal(puts[0].operation,'profile_edit');assert.equal(puts[0].contract,'canonical-brand-write/v1');assert.equal(puts[0].expected_revision,'1');
    assert.deepEqual(puts[0].changes,[{path:proposal.path,action:old===undefined?'add':'replace',expected:proposal.expected,value:proposal.value}]);assert(!Object.hasOwn(puts[0],'source'));
    const core=structuredClone(stored.brand_core);delete core.valueProposition;assert.deepEqual(core,original);assert(!session.contentDirty());
  }
  for(const mutate of [f=>f.session.state.core.brandCore='Manual',f=>f.session.state.pending='Busy',f=>f.session.state.deferred=true,f=>f.session.state.syncRequired=true,f=>f.session.state.readOnly=true,f=>f.context.account={},f=>f.context.brandId='other',f=>f.context.workspaceId='other',f=>f.context.generation++]) {
    const f=runtime();mutate(f);assert.equal(await f.session.stageValueProposition(input(f)),false);assert.equal(f.requests.length,0);
  }
  for(const patch of [{path:'/brand_core/brandDNA'},{value:''},{value:'x'.repeat(2001)},{expected:{exists:true,value:null}},{revision:2},{revalidate:async()=>false}]) {
    const f=runtime();assert.equal(await f.session.stageValueProposition({...input(f),...patch}),false);assert.equal(f.requests.filter(r=>r.method==='PUT').length,0);
  }
  const lost=runtime();assert(await lost.session.stageValueProposition(input(lost)));lost.loseResponse();assert.equal(await lost.session.save(),false);assert(await lost.session.save());
  const puts=lost.requests.filter(r=>r.method==='PUT');assert.deepEqual(puts[0].input,puts[1].input);assert.equal(lost.receipts.size,1);
  const revoked=runtime();let allowed=true;assert(await revoked.session.stageValueProposition({...input(revoked),revalidate:async()=>allowed}));allowed=false;assert.equal(await revoked.session.save(),false);assert.equal(revoked.requests.filter(r=>r.method==='PUT').length,0);assert(revoked.session.contentDirty());
  console.log('PASS actual Profile staging/explicit one-field save, exact null/absent/blank baseline, preserved knowledge, blocked drafts/scope, revoked source, lost reply exact retry');
}
async function browserChecks() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
    let calls=0;
    await p.route('**/api/ai-brain/advice',route=>{calls++;const b=route.request().postDataJSON();return route.fulfill({json:{answer:b.response_language==='de'?german:answer,context:{response_language:b.response_language},disclaimer:'Proposal only.'}});});
    await p.evaluate(()=>setActiveView('ai_brain'));
    const submit=async()=>{await p.locator('#ai-brain-question').fill(question);await p.locator('#ai-brain-form [type=submit]').click();await p.waitForSelector('[data-ai-brand-proposal]');};
    await submit();
    await p.locator('#ai-brain-question').fill('Keep this new draft');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(2,7,'backward'));
    const before=JSON.stringify(f.r.db.brands),snapshot=await p.evaluate(()=>JSON.stringify(state.brandCore));
    // Sidebar Y must not retarget the Board's canonical Brand X.
    await p.evaluate(()=>{state.session.brandId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';renderAiBrain();});
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    assert((await p.locator('[data-ai-brand-current]').textContent()).includes('Canvas Brand X'));
    await p.locator('#ai-brand-proposal-value').fill('An edited suggestion with <script>inert text</script>.');
    assert.equal(f.writes.length,0);assert.equal(JSON.stringify(f.r.db.brands),before);assert.equal(calls,1);
    await p.keyboard.press('Escape');assert.equal(await p.locator('#ai-brand-proposal-dialog').count(),0);assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this new draft');
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    await p.locator('#ai-brand-proposal-value').fill('An edited proposal for independent makers.');
    await p.locator('[data-ai-brand-stage]').click();await p.waitForSelector('[data-ai-brand-return]');
    assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');assert(await p.evaluate(()=>brandProfileController.contentDirty()));
    assert.equal(f.writes.length,0);assert.equal(JSON.stringify(f.r.db.brands),before);assert.equal(calls,1);
    await p.locator('[data-ai-brand-return]').click();await p.waitForSelector('#brand-leave-dialog');await p.locator('[data-keep-editing]').click();
    assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');
    assert(await p.evaluate(()=>brandProfileController.save()));assert.equal(f.writes.filter(r=>r.method==='PUT').length,1);
    await p.locator('[data-ai-brand-return]').click();await p.waitForSelector('#ai-brain-question');
    assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this new draft');assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd,n.selectionDirection]),[2,7,'backward']);
    assert.equal(await p.evaluate(()=>JSON.stringify(state.brandCore)),snapshot);assert.equal(calls,1);assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    // New authorized source; EN/DE and responsive modal keyboard boundaries.
    for(const language of ['en','de']) for(const width of [1440,375,320]) for(const theme of ['light','dark']) {
      await p.evaluate(({language,theme})=>{state.uiLanguage=language;window.FunklixTheme.setPreference(theme);invalidateAiBrainRequest();renderAiBrain();},{language,theme});await p.setViewportSize({width,height:850});
      await submit();await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
      assert(await p.locator('#ai-brand-proposal-dialog').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      await p.keyboard.press('Tab');assert(await p.locator('#ai-brand-proposal-dialog').evaluate(n=>n.contains(document.activeElement)));
      if(width===320 && language==='de' && theme==='dark') {
        if(process.env.BW37_C1_VISUALS)await p.screenshot({path:'work/c1-preview-mobile-dark.png'});
        await p.evaluate(()=>document.documentElement.style.zoom='2');
        assert(await p.locator('#ai-brand-proposal-dialog').evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}),'Preview fits at 200% zoom');
        if(process.env.BW37_C1_VISUALS)await p.screenshot({path:'work/c1-preview-mobile-dark-zoom.png'});
        await p.evaluate(()=>document.documentElement.style.zoom='');
      }
      await p.keyboard.press('Escape');
    }
    // Real shell rejects source/account/Canvas/catalog and independent role changes.
    for (const status of [401,403,404,503,200]) {
      await p.evaluate(()=>{state.uiLanguage='en';invalidateAiBrainRequest();renderAiBrain();});await submit();
      const denied=route=>route.fulfill({status,json:status===200?{id:'malformed'}:{code:'UNAVAILABLE'}});
      await p.route('**/api/brands/22222222-2222-4222-8222-222222222222',denied);
      await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
      assert.equal(await p.locator('[data-ai-brand-current]').textContent(),'');assert(await p.locator('[data-ai-brand-stage]').isDisabled());
      await p.keyboard.press('Escape');await p.unroute('**/api/brands/22222222-2222-4222-8222-222222222222',denied);
    }
    for (const role of [null,'viewer']) {
      await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();
      const brand=f.r.db.brands[0],owner=brand.owner_email;brand.owner_email='other@example.test';f.r.db.brandRole=role;
      await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
      assert.equal(await p.locator('[data-ai-brand-current]').textContent(),'');await p.keyboard.press('Escape');brand.owner_email=owner;f.r.db.brandRole=null;
    }
    await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    f.r.db.brands[0].revision++;f.r.db.brands[0].brand_core.valueProposition='Changed concurrently';
    const writesBefore=f.writes.length;await p.locator('[data-ai-brand-stage]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
    assert.equal(f.writes.length,writesBefore);await p.keyboard.press('Escape');
    // An expired association and fresh Workspace membership cannot be replaced by sidebar Y.
    await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();
    const association=f.c.workspaces[0].boards[0].brand_id;f.c.workspaces[0].boards[0].brand_id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
    assert.equal(await p.locator('[data-ai-brand-current]').textContent(),'');await p.keyboard.press('Escape');f.c.workspaces[0].boards[0].brand_id=association;
    // Change canonical truth at the final staging revalidation, after Profile mounted.
    await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();let reads=0;
    const race=route=>{if(route.request().method()==='GET'&&++reads===6){f.r.db.brands[0].revision++;f.r.db.brands[0].brand_core.valueProposition='Changed at final staging check';}return route.fallback();};
    await p.route('**/api/brands/22222222-2222-4222-8222-222222222222',race);
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    const prior=f.writes.length;await p.locator('[data-ai-brand-stage]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
    assert(reads>=6);assert.equal(f.writes.length,prior);assert.equal(await p.evaluate(()=>brandProfileController.contentDirty()),false);
    await p.keyboard.press('Escape');await p.unroute('**/api/brands/22222222-2222-4222-8222-222222222222',race);
    assert.equal(await p.evaluate(()=>JSON.stringify({view:state.activeView,preview:!!document.querySelector('#ai-brand-proposal-dialog'),profile:el.brandWorkspaceDetail.open,returnView:brandProfilePage?.returnView})),JSON.stringify({view:'ai_brain',preview:false,profile:false}));
    await p.evaluate(()=>{state.uiLanguage='en';invalidateAiBrainRequest();renderAiBrain();});await submit();
    await p.evaluate(()=>{state.nodes.push({id:'changed',type:'Idea',title:'Changed'});renderAiBrain();});assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    await p.locator('#ai-brain-question').fill('Protected account draft');
    await p.evaluate(()=>{state.user={...state.user};renderAiBrain();});assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);assert.equal(await p.locator('#ai-brain-question').inputValue(),'');assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),0);
    assert.deepEqual(f.errors,[]);
    console.log('PASS real shell sidebar Y/Board X, current/proposed editable preview, zero-write staging, separate protected Save, leave guard, draft/caret/source return, snapshot isolation, EN/DE mobile/themes keyboard');
  } finally {await browser.close();}
}
async function ownerBoundaries() {
  const {runtime:ownerRuntime,B,W,EMAIL}=require('./fixtures/bw36-13r5-local-runtime');
  const profile=require('../brand-profile-setup'),contract=require('../brand-write-contract');
  async function fixture() {
    const r=ownerRuntime(),brand=(await r.request('GET','/api/brands/'+B)).body,context={account:{email:EMAIL},generation:1,brandId:B,workspaceId:W,authorized:true};
    const f={r,context,status:null,malformed:false,puts:[],onPut:null};
    f.session=profile.createSession({brand,getContext:()=>context,validateBrand:b=>b?.id===B&&Number.isSafeInteger(b.revision),onSave(){},fetchImpl:async(url,init={})=>{
      if(init.method==='PUT') {f.puts.push(JSON.parse(init.body));if(f.onPut)await f.onPut();if(f.status)return {ok:false,status:f.status,json:async()=>({code:'UNAVAILABLE'})};if(f.malformed)return {ok:true,status:200,json:async()=>({id:B})};}
      const res=await r.request(init.method||'GET',url,init.body&&JSON.parse(init.body));return {ok:res.statusCode<300,status:res.statusCode,json:async()=>res.body};
    }});
    f.stage=()=>f.session.stageValueProposition({path:'/brand_core/valueProposition',value:'A reviewed proposal for independent makers.',revision:1,expected:{exists:true,value:brand.brand_core.valueProposition},revalidate:async()=>true});
    return f;
  }
  for(const status of [409,401,403,404,503,'malformed']) {
    const f=await fixture();assert(await f.stage());const before=structuredClone(f.r.db.brands);if(status==='malformed')f.malformed=true;else f.status=status;
    assert.equal(await f.session.save(),false);assert(f.session.contentDirty());assert.equal(JSON.stringify(f.r.db.brands),JSON.stringify(before));assert.equal(f.puts.length,1);
  }
  for(const mutate of [r=>{r.db.brands[0].owner_email='someone@example.test';r.db.brandRole=null;},r=>{r.db.brands[0].owner_email='someone@example.test';r.db.brandRole='viewer';},r=>r.db.membershipStatus='revoked',r=>r.db.identityStatus='disabled']) {
    const f=await fixture();assert(await f.stage());mutate(f.r);const before=structuredClone(f.r.db.brands);assert.equal(await f.session.save(),false);assert.equal(JSON.stringify(f.r.db.brands),JSON.stringify(before));assert.equal(f.r.db.history.length,0);
  }
  const conflict=await fixture();assert(await conflict.stage());conflict.r.db.brands[0].revision++;conflict.r.db.brands[0].brand_core.valueProposition='Concurrent canonical value';
  assert.equal(await conflict.session.save(),false);assert(await conflict.session.reload());const attempts=conflict.puts.length;assert.equal(await conflict.session.save(),false);assert.equal(conflict.puts.length,attempts,'Reload cannot silently approve a changed comparison');
  const newer=await fixture();assert(await newer.stage());newer.onPut=async()=>{newer.session.state.core.valueProposition='A newer edit while Save is pending';};assert(await newer.session.save());assert(newer.session.contentDirty());assert.equal(newer.session.state.core.valueProposition,'A newer edit while Save is pending');
  const anonymous=ownerRuntime(),command=contract.command(anonymous.db.brands[0],{brand_core:{valueProposition:'Bypassed suggestion'}},W);
  assert.equal((await anonymous.request('PUT','/api/brands/'+B,command,null)).statusCode,401);assert.equal(anonymous.db.history.length,0);
  console.log('PASS actual signed-session Brand handlers and protected service: Board-only/viewer/anonymous, revoked membership/identity, 401/403/404/409/503/malformed, conflict reload blocks silent rebase, newer edits survive');
}
async function conversationReturn() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;let calls=0;
    await p.route('**/api/ai-brain/advice',route=>{calls++;return route.fulfill({json:{answer:'Proposed Value Proposition: '+ 'Independent makers explore new formats together with room for their creative choices. '.repeat(15),context:{response_language:'en',approved_learnings:{items:[{ref:'L1',statement:'Fictional approved workshop note.'}]}},disclaimer:'Proposal only.'}});});
    await p.evaluate(()=>setActiveView('ai_brain'));await p.locator('#ai-brain-mode').selectOption('evaluate_options');
    for(let i=0;i<8;i++) {
      await p.locator('#ai-brain-question').fill(question);await p.locator('#ai-brain-form [type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');
    }
    await p.locator('#ai-brain-question').fill('A later unsent question');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(3,9,'backward'));
    await p.evaluate(()=>{const n=document.querySelector('#ai-brain-transcript');n.scrollTop=0;n.querySelector('details').open=true;});
    await p.locator('[data-ai-brand-proposal]').first().click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    const saved=await p.evaluate(()=>({scroll:el.aiBrainSummary.aiBrainScroll.top,mode:state.aiBrain.adviceMode,turns:state.aiBrain.messages.length}));
    await p.locator('[data-ai-brand-stage]').click();await p.waitForSelector('[data-ai-brand-return]');assert.equal(f.writes.length,0);assert.equal(calls,8);
    assert(await p.evaluate(()=>brandProfileController.save()));await p.locator('[data-ai-brand-return]').click();
    const restored=await p.evaluate(()=>({scroll:document.querySelector('#ai-brain-transcript').scrollTop,mode:state.aiBrain.adviceMode,turns:state.aiBrain.messages.length,disclosure:document.querySelector('.ai-brain-learning-context').open}));
    assert.equal(restored.mode,saved.mode);assert.equal(restored.turns,saved.turns);assert(restored.disclosure);assert(Math.abs(restored.scroll-saved.scroll)<3);assert.equal(calls,8);
    assert.equal(await p.locator('#ai-brain-question').inputValue(),'A later unsent question');
    // Source text itself changing invalidates a formerly successful turn.
    await p.evaluate(()=>{state.aiBrain.messages[0].answer+=' Changed';renderAiBrain();});assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    assert.deepEqual(f.errors,[]);
    console.log('PASS real long conversation Return preserves mode, transcript, unsent draft/caret, Learning disclosure and scroll anchor without inference');
  } finally {await browser.close();}
}
(async()=>{eligibility();await controllers();await ownerBoundaries();await browserChecks();await conversationReturn();})().catch(e=>{console.error(e);process.exitCode=1;});
