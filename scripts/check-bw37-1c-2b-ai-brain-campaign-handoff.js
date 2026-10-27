'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const {chromium} = require('playwright-core');
const v3 = require('../campaign-v3');
const {fixture:campaignFixture} = require('./check-bw36-14r1-restore-complete-campaign-v3');
const {B,D,clone} = require('./fixtures/bw36-13r5-local-runtime');
const answer = 'Launch #MyAppicsStory, a community campaign that invites creators to share the personal stories behind their creative work. The goal is to build community participation among independent creators.\n\nThe key message is “Your creative story belongs here”. Invite short stories and highlight the creative process, with permission from participants.\n\nSuggested channels: Instagram and TikTok.';
const german = 'Die Kampagnenidee #MeineAppicsStory richtet sich an kreative Menschen in unserer Gemeinschaft. Ziel ist es, die Teilnahme zu stärken und persönliche Geschichten zu teilen.\n\nDie Botschaft lautet „Deine kreative Geschichte gehört hierher“.\n\nKanäle: Instagram und TikTok.';
const source = fs.readFileSync('app.js','utf8'), context = {};
vm.runInNewContext(source.slice(source.indexOf('function aiBrainCampaignBrief('),source.indexOf('function aiBrainCampaignSourceCurrent(')),context);
const select = (text, extra={}) => context.aiBrainCampaignBrief({status:'success',answer:text,...extra});
function extraction() {
  for(const text of [answer,german,'Campaign concept: “New beginnings”\n\nLaunch a product campaign targeting existing customers to invite product discovery.\n\nKey message: Explore a simpler way to work.']) assert(select(text),text);
  assert.deepEqual(JSON.parse(JSON.stringify(select(answer))),{campaignIdea:answer.split('\n\n')[0],additionalContext:answer.split('\n\n').slice(1).join('\n\n'),channel:'Mixed'});
  assert.equal(select(answer.replace('Instagram and TikTok','Instagram')).channel,'Instagram');
  assert(!Object.hasOwn(select(answer.replace('Suggested channels: Instagram and TikTok.', 'Suggested channels: Avoid Instagram; use TikTok.')),'channel'));
  assert.equal(select(answer+'\n\nAnother campaign could target customers to build awareness.'),null);
  assert(!Object.hasOwn(select(answer.split('\n\n').slice(0,2).join('\n\n')),'channel'));
  for(const text of ['', 'Thank you!', 'Campaign concept: #MyAppicsStory', 'Discuss the Brand and its audience.', 'Proposed Value Proposition: Creators build a community together.', 'Campaign diagnostics: build stronger targeting for customers in your launch.', 'Your product launch lacks a clear message for customers. Build awareness across channels.', 'Your launch strategy should build a strong community among creators and increase awareness across channels.', 'Proposed Value Proposition: Launch a new community for creators to build awareness of their stories.', 'Maybe create a campaign?', 'Launch a campaign to increase awareness.', 'Option A: Campaign for creators to build a community.\n\nOption B: Launch another campaign.', answer+'x'.repeat(12000), answer.replace('Launch','No campaign: Launch'), answer.replace('The goal','Is the goal?')]) assert.equal(select(text),null,text);
  for(const status of ['failed','pending']) assert.equal(select(answer,{status}),null);
  assert.equal(select(answer,{referenceResolution:'clarification'}),null);
  for(const adviceMode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) assert(select(answer,{adviceMode}));
  const hostile=answer.replace('personal stories','<img src=x onerror=alert(1)> stories');assert(select(hostile).campaignIdea.includes('<img'));
  console.log('PASS bounded EN/DE natural/heading concepts, exact supported fields, modes, ambiguity/missing/failed/clarification negatives; text remains untrusted data');
}
async function browsers() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
    let adviceAnswer=answer,adviceCalls=0,generationCalls=0,saveCalls=0,failGeneration=false,holdCatalog=null,loseSaveResponse=false,changeOnGenerate=false;
    const campaign=campaignFixture();campaign.db.boards=clone(f.r.db.boards);
    await p.route('**/api/ai-brain/advice', async route=>{adviceCalls++;const body=route.request().postDataJSON();await route.fulfill({json:{answer:adviceAnswer,assumptions:[],disclaimer:'Fictional proposal',context:{response_language:body.response_language,reference_resolution:'none',canonicalBrandCore:true}}});});
    await p.route('**/api/workspaces',async route=>{if(holdCatalog){const hold=holdCatalog;holdCatalog=null;hold.started();await hold.wait;}await route.fulfill({json:f.c});});
    await p.route(/\/api\/boards\?scope=brand&brand_id=/,route=>route.fulfill({json:{boards:f.r.db.boards.map(b=>({...b,access_role:'owner'}))}}));
    await p.route('**/api/generate-campaign',async route=>{generationCalls++;if(changeOnGenerate){changeOnGenerate=false;f.c.workspaces[0].revision++;}if(failGeneration)return route.fulfill({status:503,json:{error:'Mock failure'}});await route.fulfill({json:{nodes:v3.createCampaignV3MockNodes(route.request().postDataJSON(),'grouped')}});});
    await p.route('**/api/refine-node',async route=>{const n=route.request().postDataJSON().currentContent;await route.fulfill({json:{title:n.title,content:n.content||'A specific campaign story with a clear creative invitation.',caption:n.caption||''}});});
    await p.route('**/api/campaigns',async route=>{saveCalls++;const out=await campaign.call(route.request().postDataJSON());await route.fulfill({status:out.statusCode,json:loseSaveResponse&&out.statusCode<300?{}:out.body});});
    const baseline=clone(f.c),dialog=p.locator('#campaign-creation-dialog'),cta=p.locator('[data-ai-brain-campaign]');
    const boot=async()=>{
      f.c=clone(baseline);await p.reload();await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);
      await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');state.isDirty=false;});
    };
    const ask=async()=>{await p.locator('#ai-brain-question').fill('Suggest a concrete community campaign.');await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
    await boot();await ask();assert.equal(await cta.count(),1);
    await p.locator('#ai-brain-question').fill('My unfinished follow-up');await p.locator('#ai-brain-mode').selectOption('find_gaps');
    await p.evaluate(()=>{document.querySelector('#ai-brain-question').setSelectionRange(3,8);document.querySelector('#ai-brain-transcript').scrollTop=0;state.session.brandId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';});
    const before=await p.evaluate(()=>({nodes:JSON.stringify(state.nodes),core:JSON.stringify(state.brandCore),draft:document.querySelector('#ai-brain-question').value,scroll:document.querySelector('#ai-brain-transcript').scrollTop}));
    for(const theme of ['light','dark']) for(const width of [320,375,1440]) {
      await p.setViewportSize({width,height:900});await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);
      await p.evaluate(async()=>{await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);const t=document.querySelector('#ai-brain-transcript');t.scrollTop=0;t.dispatchEvent(new Event('scroll'));document.querySelector('[data-ai-brain-campaign]').focus({preventScroll:true});});
      await p.keyboard.press('Enter');await dialog.waitFor();
      assert.equal(await dialog.locator('#campaign-creation-idea').inputValue(),answer.split('\n\n')[0]);
      assert.equal(await dialog.locator('#campaign-creation-context').inputValue(),answer.split('\n\n').slice(1).join('\n\n'));
      assert.equal(await dialog.locator('#campaign-v3-channel').inputValue(),'Mixed');
      assert((await dialog.innerText()).includes('Canvas Brand X'));assert(!(await dialog.innerText()).includes('Selected Brand Y'));
      assert.equal(await p.evaluate(()=>document.activeElement.id),'campaign-creation-idea');
      assert(await dialog.locator('#campaign-creation-idea').isEditable());
      await dialog.locator('#campaign-creation-idea').fill('An edited campaign idea');await dialog.getByRole('button',{name:'Continue',exact:true}).click();
      await dialog.locator('#campaign-v3-channel').selectOption('LinkedIn');await dialog.getByRole('button',{name:'Back',exact:true}).click();assert.equal(await dialog.locator('#campaign-creation-idea').inputValue(),'An edited campaign idea');
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await p.keyboard.press('Escape');assert.equal(await dialog.count(),0);
      assert.equal(await p.evaluate(()=>document.activeElement.dataset.aiBrainCampaign),'turn-1');
      assert.deepEqual(await p.evaluate(()=>({nodes:JSON.stringify(state.nodes),core:JSON.stringify(state.brandCore),draft:document.querySelector('#ai-brain-question').value,scroll:document.querySelector('#ai-brain-transcript').scrollTop})),before);
      assert.equal(await p.locator('#ai-brain-mode').inputValue(),'find_gaps');
    }
    assert.equal(adviceCalls,1);assert.equal(generationCalls,0);assert.equal(saveCalls,0);assert.deepEqual(f.writes,[]);
    // User drafts survive while focus belongs to the compact action and native modal.
    assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd]),[3,8]);
    await p.setViewportSize({width:1440,height:900});
    await p.evaluate(()=>state.uiLanguage=language.setUiLanguage('de'));adviceAnswer=german;
    await ask();await cta.last().click();await dialog.waitFor();assert.equal(await dialog.locator('#campaign-creation-idea').inputValue(),german.split('\n\n')[0]);await p.keyboard.press('Escape');
    for(const text of ['General strategy: focus on community and listen to your customers.', 'Your product launch lacks a clear message for customers. Build awareness across channels.', 'Proposed Value Proposition: Creators build a community together.', 'Campaign concept: #MyAppicsStory']) {
      await boot();adviceAnswer=text;await ask();assert.equal(await cta.count(),0);
    }
    adviceAnswer=answer;
    await boot();await ask();const oldRevision=f.r.db.boards[0].updated_at;
    f.r.db.boards[0].updated_at='2026-10-25T00:00:00.000Z';await cta.click();await p.locator('#campaign-creation-feedback').waitFor();assert.equal(await dialog.count(),0);f.r.db.boards[0].updated_at=oldRevision;
    // Each changed local identity/source is rejected by the real handler, with no inference/write.
    for(const mutate of [()=>state.user={...state.user},()=>state.user.email='other@example.test',()=>state.currentBoardId='other',()=>state.boardLoadGeneration++,()=>state.workspaceCatalog.activeWorkspaceId='other',()=>state.workspaceCatalog.generation++,()=>state.workspaceCatalog.status='refreshing',()=>state.boardBrandAssociation.brandId='other',()=>state.aiBrain.messages[0].answer+='Changed',()=>state.boardAccess.canEdit=false,()=>state.publicBoardToken='public',()=>state.user=null,()=>state.lastKnownUpdatedAt='2020-01-01T00:00:00Z']) {
      await boot();await ask();await p.evaluate(mutate);await p.evaluate(()=>openAiBrainCampaign(state.aiBrain.messages[0].id));assert.equal(await dialog.count(),0);
    }
    // Fresh remote catalog checks: revoked Board access, association and canonical/source revision.
    for(const mutate of [c=>c.workspaces[0].boards[0].role='viewer',c=>c.workspaces[0].boards[0].brand_id=null,c=>c.workspaces[0].brands=[],c=>c.workspaces[0].brands[0].revision++,c=>c.workspaces[0].revision++,c=>c.workspaces=[]]) {
      await boot();await ask();mutate(f.c);await cta.click();await p.locator('#campaign-creation-feedback').waitFor();assert.equal(await dialog.count(),0);
    }
    for(const flag of ['isDirty','isSaving']) {
      await boot();await ask();await p.evaluate(key=>state[key]=true,flag);await cta.click();await p.locator('#campaign-creation-feedback').waitFor();assert.equal(await dialog.count(),0);
    }
    await boot();await ask();let release,started;const wait=new Promise(r=>release=r),ready=new Promise(r=>started=r);holdCatalog={wait,started};
    await cta.click();await ready;await p.evaluate(()=>state.workspaceCatalog.generation++);release();await p.locator('#campaign-creation-feedback').waitFor();assert.equal(await dialog.count(),0);
    // A Board editor with independent Brand read access may use Creator; no canonical edit is required.
    await boot();f.c.workspaces[0].brands[0].role='viewer';await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);state.workspaceCatalog.value.workspaces[0].brands[0].role='viewer';});await ask();await cta.click();await dialog.waitFor();await p.keyboard.press('Escape');
    // A Board-only editor whose association is hidden retains the existing fail-closed Creator entry.
    await boot();f.c.workspaces[0].brands=[];f.c.workspaces[0].boards[0].brand_id=null;await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);state.workspaceCatalog.value.workspaces[0].brands=[];state.workspaceCatalog.value.workspaces[0].boards[0].brand_id=null;});await ask();assert.equal(await cta.count(),0,JSON.stringify(await p.evaluate(()=>({catalog:state.workspaceCatalog.value,turns:state.aiBrain.messages.map(t=>({id:t.id,current:aiBrainCampaignSourceCurrent(t)})),html:document.querySelector('[data-ai-brain-campaign]')?.outerHTML}))));
    assert.equal(generationCalls,0);assert.equal(saveCalls,0);assert.deepEqual(f.writes,[]);
    await boot();await ask();await cta.click();await dialog.waitFor();await p.evaluate(()=>{state.user={...state.user};renderAiBrain();});assert.equal(await dialog.count(),0);assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),0);
    // A remote revocation between editing and explicit Generate rejects before the provider.
    await boot();await ask();await cta.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Continue',exact:true}).click();f.c.workspaces[0].boards[0].role='viewer';await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();await p.locator('#campaign-creation-feedback').waitFor();assert.equal(generationCalls,0);
    console.log('PASS actual Advice success/render/CTA, editable Creator initialization, EN/DE/themes/mobile/keyboard/focus/caret/scroll, zero-write/call cancel, source/local/remote races and independent roles');
    // Automated review P2: a known source rejection before the first save must
    // roll back provisional nodes and permit Close, preserving the conversation.
    await boot();await ask();await p.locator('#ai-brain-question').fill('A draft retained after rejection');
    await cta.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Continue',exact:true}).click();
    await dialog.locator('#campaign-v3-variations').fill('1');await dialog.locator('#campaign-v3-posts').fill('1');
    changeOnGenerate=true;await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();await dialog.locator('#campaign-v3-error-close').waitFor();
    assert(await dialog.locator('#campaign-v3-error-close').isEnabled());assert.equal(saveCalls,0);assert.equal(await p.evaluate(()=>state.nodes.length),0);
    await dialog.locator('#campaign-v3-error-close').click();assert.equal(await dialog.count(),0);assert.equal(await p.evaluate(()=>state.activeView),'ai_brain');assert.equal(await p.locator('#ai-brain-question').inputValue(),'A draft retained after rejection');assert.equal(await cta.count(),0);
    const generationStart=generationCalls;
    // Execute the unchanged production V3 workflow and real signed transactional owner.
    await boot();await ask();await cta.click();await dialog.waitFor();await dialog.getByRole('button',{name:'Continue',exact:true}).click();
    await dialog.locator('#campaign-v3-variations').fill('1');await dialog.locator('#campaign-v3-posts').fill('1');
    failGeneration=true;await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();await dialog.locator('#campaign-v3-error-retry').waitFor();assert.equal(saveCalls,0);assert.equal(await p.evaluate(()=>state.nodes.length),0);
    failGeneration=false;campaign.options.saveFail=true;await dialog.locator('#campaign-v3-error-retry').click();await dialog.getByText('Campaign generated, but not saved yet.',{exact:true}).waitFor();assert.equal(generationCalls,generationStart+2);assert.equal(campaign.writes(),0);
    campaign.options.saveFail=false;await dialog.locator('#campaign-v3-error-retry').click();await dialog.locator('#campaign-v3-reveal').waitFor();assert.equal(generationCalls,generationStart+2);assert.equal(saveCalls,2);assert.equal(campaign.writes(),1);
    await dialog.locator('#campaign-v3-reveal').click();assert.equal(await dialog.count(),0);await p.evaluate(()=>{setActiveView('ai_brain');renderAiBrain();});assert.equal(await cta.count(),0);assert.equal(await p.evaluate(()=>state.aiBrain.messages[0].campaignCreated),true);
    assert.equal(await p.evaluate(()=>state.aiBrain.messages.length),1);assert.equal(campaign.db.boards.length,1);assert.equal(campaign.db.brands[0].brand_core.brandCore,'Original positioning');
    // A committed response lost before confirmation must replay Save without requiring
    // the source's pre-commit Board revision or generating a duplicate campaign.
    f.r.db.boards=clone(campaign.db.boards);await ask();await cta.click();await dialog.waitFor();
    await dialog.getByRole('button',{name:'Continue',exact:true}).click();await dialog.locator('#campaign-v3-variations').fill('1');await dialog.locator('#campaign-v3-posts').fill('1');
    loseSaveResponse=true;await dialog.getByRole('button',{name:'Generate Campaign',exact:true}).click();await dialog.getByText('Campaign generated, but not saved yet.',{exact:true}).waitFor();
    assert.equal(campaign.writes(),2);const generated=generationCalls,sent=saveCalls;loseSaveResponse=false;
    await dialog.locator('#campaign-v3-error-retry').click();await dialog.locator('#campaign-v3-reveal').waitFor();assert.equal(generationCalls,generated);assert.equal(saveCalls,sent+1);assert.equal(campaign.writes(),2);
    await dialog.locator('#campaign-v3-reveal').click();
    assert.deepEqual(f.errors,[]);await p.close();
    console.log('PASS Brain-origin explicit V3 generation, failure rollback, AI retry, save-only retry, signed transactional commit, reveal and consumed source prevents duplicate campaign');
  } finally {await browser.close();}
}
(async()=>{extraction();await browsers();})().catch(e=>{console.error(e);process.exitCode=1;});
