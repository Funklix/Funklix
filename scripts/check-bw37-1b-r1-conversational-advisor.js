'use strict';
// Disposable fictional Brand/Board data and mocked providers only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium } = require('playwright-core');
const { advisorPersonality } = require('../api/_ai-brain-personality');
const app = fs.readFileSync('app.js', 'utf8');
const asset = 'Social post: Make room for your process\nCaption: Your next idea can start with a sketch, a sound or a conversation. Share the process you want to explore with the workshop community.\nCTA: Share your first sketch.';
const concept = 'Content concept: A week of unfinished ideas\nAudience: Independent makers trying a new format\nMessage: Show the choices behind your first sketch\nPurpose: Invite participation in the community workshop';
function deterministicChecks() {
  const c = {}; vm.runInNewContext(app.slice(app.indexOf('function aiBrainHasReusableContent'), app.indexOf('function canUseAiBrainProposal')), c);
  for (const answer of [asset, concept, '## Landing-page copy: Workshop\nHeadline: Make room for your next idea. Try a new format with other independent makers and share the choices behind your first experiment.\nCTA: Join the next workshop.', 'Content-Konzept: Eine Woche voller Skizzen\nZielgruppe: Selbstständige Kreative mit neuen Ideen\nBotschaft: Zeig die Entscheidungen hinter deiner ersten Skizze\nZiel: Zum gemeinsamen Workshop einladen']) {
    for (const adviceMode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) assert(c.aiBrainHasReusableContent({status:'success',answer,adviceMode}), answer);
  }
  for (const answer of ['', 'Thanks!', 'Which audience do you mean?', 'Review positioning before changing the tone.', '1. Define your audience\n2. Assign owners\n3. Write a social post', 'Social post: Consider trying one.', 'Content concept: Strategy\nAudience: Everyone\nPurpose: Grow', 'The existing social post has a useful CTA.', 'Social post: Diagnostic\nCaption: Too short\nCTA: No', 'x'.repeat(12001)]) assert(!c.aiBrainHasReusableContent({status:'success',answer}));
  for (const status of ['failed','pending']) assert(!c.aiBrainHasReusableContent({status,answer:asset}));
  assert(!c.aiBrainHasReusableContent({status:'success',answer:asset,referenceResolution:'clarification'}));
  const approved = {brandDNA:{userApproved:true,primaryArchetype:'Explorer',secondaryArchetype:'Creator',recommendedVoice:'Curious and specific'},toneOfVoice:['Open','Critical']};
  const style = advisorPersonality({canonical:{brand_core:approved},snapshot:{brandDNA:{userApproved:true,primaryArchetype:'Ruler'}}});
  assert.deepEqual(style.archetypes.map(a=>a.name),['Explorer','Creator']); assert.equal(style.source,'canonicalBrandCore'); assert.equal(style.voice,'Curious and specific');
  for (const userApproved of [undefined,false,'true']) assert.equal(advisorPersonality({snapshot:{brandDNA:{...approved.brandDNA,userApproved}}}),null);
  assert.equal(advisorPersonality({canonical:{brand_core:{brandDNA:{draft:approved.brandDNA}}},snapshot:approved}),null,'draft canonical DNA must not revive historical snapshot personality');
  assert.equal(advisorPersonality({snapshot:{brandDNA:{draft:approved.brandDNA,generated:approved.brandDNA}}}),null);
  assert.equal(advisorPersonality({snapshot:approved}).source,'boardBrandCore');
  assert.equal(advisorPersonality({snapshot:{brandDNA:{userApproved:true,primaryArchetype:'Unknown'}}}),null);
  console.log('PASS deterministic CTA EN/DE, all modes, ambiguity and approved-only personality precedence.');
}
async function apiChecks() {
  const f = await require('./fixtures/bw36-20-database').fixture();
  try {
    const core = {brandCore:'Workshop freedom',toneOfVoice:['Curious'],brandDNA:{userApproved:true,primaryArchetype:'Explorer',secondaryArchetype:'Creator',recommendedVoice:'Independent and thoughtful'}};
    await f.pg.query('UPDATE brands SET brand_core=$1::jsonb WHERE id=$2',[JSON.stringify(core),f.BRAND]);
    await f.pg.query('UPDATE boards SET brand_core_snapshot=$1::jsonb',[JSON.stringify({constraints:'Awareness only',brandDNA:{userApproved:true,primaryArchetype:'Ruler'}})]);
    for (const advice_mode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) for (const response_language of ['en','de']) {
      f.calls.length=0; f.answer=response_language==='de'?'Ich würde zuerst die Einladung schärfen. Für eine andere Empfehlung fehlen mir Belege.':'I would sharpen the invitation first. I need evidence before recommending a wider campaign.';
      const result=await f.invoke({advice_mode,response_language}); assert.equal(result.statusCode,200); assert.equal(f.calls.length,1); assert.equal(f.calls[0].store,false);
      const input=f.calls[0].input, policy=input[0].content, context=JSON.parse(input[1].content.split('\n').slice(1).join('\n'));
      assert.equal(context.advisorPersonality.source,'canonicalBrandCore'); assert.deepEqual(Array.from(context.advisorPersonality.archetypes,a=>a.name),['Explorer','Creator']); assert.equal(context.boardBrandCore.constraints,'Awareness only');
      for (const phrase of ['Prefer coherent conversational paragraphs','only when useful or explicitly requested','thoughtful marketing colleague','Never impersonate','critical judgment','untrusted style data','draft/generated archetypes','Never invent studies','uncertainty']) assert(policy.includes(phrase),phrase);
      assert(input.at(-2).content.includes(response_language==='de'?'German':'English')); assert.equal(result.body.answer,f.answer);
    }
    await f.pg.query('UPDATE brands SET brand_core=$1::jsonb WHERE id=$2',[JSON.stringify({brandDNA:{primaryArchetype:'Explorer',userApproved:false}}),f.BRAND]);
    f.calls.length=0; assert.equal((await f.invoke()).statusCode,200);
    assert.equal(JSON.parse(f.calls[0].input[1].content.split('\n').slice(1).join('\n')).advisorPersonality,null);
    await f.pg.exec('DELETE FROM brand_members'); f.calls.length=0; f.queries.length=0;
    assert.equal((await f.invoke()).statusCode,200);
    const context=JSON.parse(f.calls[0].input[1].content.split('\n').slice(1).join('\n'));
    assert.equal(context.canonicalBrandCore,null); assert.equal(context.advisorPersonality.source,'boardBrandCore');
    assert(!JSON.stringify(f.calls).includes('Independent and thoughtful')); assert(!f.queries.some(q=>q.sql.includes('FROM public.brand_learnings')));
    await f.reset(); f.onProvider=()=>f.pg.exec('DELETE FROM brand_members');
    assert.equal((await f.invoke()).statusCode,409); assert.equal(f.calls.length,1);
    console.log('PASS API all five modes EN/DE, natural instructions, approved archetypes, draft/missing/Board-only isolation, freshness and one inference.');
  } finally {await f.pg.close();}
}
async function browserChecks() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),page=f.page;
    const requests=[]; let release,status=200,answer=asset,network=false;
    await page.route('**/api/ai-brain/advice',async route=>{
      const body=route.request().postDataJSON();requests.push(body); await new Promise(resolve=>release=resolve);
      if(network)return route.abort('failed').catch(()=>{});
      return route.fulfill({status,json:status===200?{answer,context:{response_language:body.response_language},disclaimer:'Qualitative advice.'}:{error:'Unavailable',code:status===409?'advice_context_changed':'generic'}}).catch(()=>{});
    });
    await page.evaluate(()=>setActiveView('ai_brain'));
    const input=page.locator('#ai-brain-question');
    const submit=async text=>{release=null;await input.fill(text);await page.locator('#ai-brain-form [type=submit]').click();await page.waitForFunction(()=>state.aiBrain.status==='loading');assert(release);assert.equal(await input.inputValue(),'');assert(await input.evaluate(n=>n===document.activeElement),'submission retains keyboard focus in composer');assert.equal(await page.locator('.is-user .ai-brain-question').last().textContent(),text);};
    const finish=async()=>{release();await page.waitForFunction(()=>state.aiBrain.status!=='loading');};
    await input.fill('Unaccepted draft');
    await page.evaluate(()=>requestAiBrainAdvice(null,'missing-turn'));
    assert.equal(await input.inputValue(),'Unaccepted draft');assert.equal(requests.length,0);
    await page.locator('#ai-brain-mode').selectOption('explore_ideas');
    await submit('Draft a workshop invitation');
    await input.fill('A newer draft');await input.evaluate(n=>{n.focus();n.setSelectionRange(2,7,'backward');});
    await page.evaluate(()=>{setActiveView('home');setActiveView('ai_brain');renderAiBrain();});
    assert.equal(await input.inputValue(),'A newer draft');await finish();
    assert.equal(await input.inputValue(),'A newer draft');assert.deepEqual(await input.evaluate(n=>[n.selectionStart,n.selectionEnd,n.selectionDirection]),[2,7,'backward']);
    assert.equal(await page.locator('[data-ai-brain-prepare]').count(),1); assert.equal(requests.length,1);
    for (const failure of [503,409,'network']) {
      status=failure==='network'?200:failure;network=failure==='network';
      await submit('Keep this original '+failure);await finish();
      await input.fill('Do not erase my retry draft');await page.locator('#ai-brain-mode').selectOption('find_gaps');
      status=200;network=false;release=null;
      const count=await page.locator('.is-user').count();
      await page.locator('[data-ai-brain-retry]').last().click();await page.waitForFunction(()=>state.aiBrain.status==='loading');assert(release);
      assert.equal(requests.at(-1).question,'Keep this original '+failure);assert.equal(requests.at(-1).advice_mode,failure===503?'explore_ideas':'find_gaps');
      assert.equal(await input.inputValue(),'Do not erase my retry draft');assert.equal(await page.locator('.is-user').count(),count);await finish();assert.equal(await input.inputValue(),'Do not erase my retry draft');
    }
    // Aborted active requests settle as failed; an invalidated lifecycle discards late work.
    await submit('Abort this request');await page.evaluate(()=>state.aiBrain.controller.abort());await page.waitForFunction(()=>state.aiBrain.status==='error');release();
    assert.equal(await input.inputValue(),'');
    await submit('Stale Canvas');await input.fill('Current draft');await page.evaluate(()=>{state.nodes.push({id:'new',type:'Idea',title:'New context'});renderAiBrain();});await finish();
    assert.equal(await page.evaluate(()=>state.aiBrain.messages.at(-1).errorCode),'changed');assert.equal(await input.inputValue(),'Current draft');
    for (const answerText of ['A positioning review should start with the audience need.','Which audience do you mean?',concept]) {
      answer=answerText;await submit('Discuss the next direction');await finish();
      assert.equal(await page.locator('.is-advisor').last().locator('[data-ai-brain-prepare]').count(),answerText===concept?1:0);
    }
    // Direct handler invocation cannot prepare generic strategic advice either.
    const proposalRequests=[];
    await page.route('**/api/ai-brain/propose-node',async route=>{
      const body=route.request().postDataJSON();proposalRequests.push(body);
      return route.fulfill({json:{action:'propose_content_node',node_proposal:{proposal_id:'fixture-proposal',source_turn_id:body.source_turn_id,node_type:'Content',title:'Workshop invitation',body:'Share your first sketch with the workshop community.',rationale:'A reusable invitation'},context:{board_id:body.board_id,response_language:body.response_language,content_language:body.content_language}}});
    });
    await page.evaluate(()=>requestAiBrainNodeProposal(state.aiBrain.messages.at(-2).id));assert.equal(proposalRequests.length,0);
    // Creation may schedule the normal Canvas save; intercept it in this disposable fixture.
    await page.route('**/api/boards/*',route=>route.request().method()==='PUT'?route.fulfill({json:{id:f.r.db.boards[0].id,updated_at:new Date().toISOString()}}):route.fallback());
    const before=await page.evaluate(()=>state.nodes.length);
    await page.locator('[data-ai-brain-prepare]').last().click();await page.waitForSelector('.ai-brain-node-preview');
    assert.equal(proposalRequests.length,1);assert.equal(await page.evaluate(()=>state.nodes.length),before);
    assert(await page.locator('[data-ai-brain-cancel]').evaluate(n=>n===document.activeElement));
    await page.locator('[data-ai-brain-cancel]').click();assert.equal(await page.evaluate(()=>state.nodes.length),before);
    await page.locator('[data-ai-brain-prepare]').last().click();await page.waitForSelector('[data-ai-brain-create]');
    await page.locator('[data-ai-brain-create]').click();await page.waitForFunction(n=>state.nodes.length===n+1,before);
    await page.evaluate(()=>{clearAutosaveTimer();setActiveView('ai_brain');});
    assert.equal(await page.evaluate(()=>state.nodes.filter(n=>n.title==='Workshop invitation').length),1);
    for (const width of [1440,375,320]) for (const theme of ['light','dark']) {
      await page.setViewportSize({width,height:900});await page.evaluate(theme=>{window.FunklixTheme.setPreference(theme);renderAiBrain();},theme);
      assert(await input.isVisible());assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      await input.focus();await page.keyboard.type('Keyboard draft');await page.evaluate(()=>renderAiBrain());assert(await input.evaluate(n=>n===document.activeElement));
      assert.equal(await page.locator('#ai-brain-transcript').getAttribute('aria-live'),'polite');
    }
    await submit('Switching accounts');await page.evaluate(()=>{state.user={email:'replacement@example.invalid'};renderAiBrain();});release();await page.waitForTimeout(50);
    assert.equal(await page.evaluate(()=>state.aiBrain.messages.length),0);assert.equal(await input.inputValue(),'');
    await submit('Switching Boards');await page.evaluate(()=>{state.currentBoardId='replacement';state.boardLoadGeneration++;renderAiBrain();});release();await page.waitForTimeout(50);
    assert.equal(await page.evaluate(()=>state.aiBrain.messages.length),0);assert.equal(await input.inputValue(),'');
    assert.deepEqual(f.errors,[]);
    console.log('PASS real shell composer clear/new drafts/caret/navigation, 409/503/network/abort/retry, stale Canvas/account/Board, CTA + explicit preview/cancel/create, keyboard and desktop/mobile Light/Dark.');
  } finally {await browser.close();}
}
(async()=>{deterministicChecks();await apiChecks();await browserChecks();})().catch(error=>{console.error(error);process.exitCode=1;});
