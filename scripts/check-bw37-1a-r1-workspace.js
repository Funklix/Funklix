'use strict';
// Full production shell, disposable authorized Board fixture, intercepted Advice only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const open = require('./fixtures/home-browser');
const screenshots = process.env.BW37_SCREENSHOT_DIR;
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] });
  try {
    const f = await open(browser)(), page = f.page;
    let release, fail = false, answer = '## Recommendation\n\nStart with a focused community invitation.\n\n1. **Listen first.** Understand the audience.\n2. Invite a small group.\n\n<img src=x onerror=alert(1)>';
    const requests = [];
    await page.route('**/api/ai-brain/advice', async route => {
      const body = route.request().postDataJSON(); requests.push(body);
      await new Promise(resolve => { release = resolve; });
      await route.fulfill({status: fail ? 503 : 200, json: fail ? {error:'Unavailable'} : {answer,context:{response_language:body.response_language,advice_mode:body.advice_mode,canvasNodes:body.canvas_context.nodes.length},disclaimer:'Qualitative advice.'}}).catch(()=>{});
    });
    await page.evaluate(() => setActiveView('ai_brain'));
    const avatar = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" rx="20" fill="#7c63e6"/><circle cx="32" cy="24" r="12" fill="#f6d9bb"/><path d="M12 64v-9a20 20 0 0140 0v9" fill="#d9d3fa"/></svg>');
    await page.evaluate(avatar=>{state.brandCore={...state.brandCore,brandDNA:{...state.brandCore.brandDNA,userApproved:true,avatar:{userApproved:true,imageUrl:avatar}}};refreshLastSavedSnapshot();renderAiBrain();},avatar);
    assert.equal(await page.locator('.ai-brain-header .ai-brain-advisor-avatar img').getAttribute('src'),avatar);
    assert.equal(await page.locator('.ai-brain-empty').count(),1,'new conversation');
    const transcript = page.locator('.ai-brain-transcript'), question = page.locator('#ai-brain-question');
    const metrics = () => transcript.evaluate(n => ({top:n.scrollTop,height:n.clientHeight,max:n.scrollHeight-n.clientHeight}));
    const seed = () => page.evaluate(() => {
      state.aiBrain.identity = aiBrainIdentity();
      state.aiBrain.messages = Array.from({length:12}, (_,i) => ({id:'history-'+i,question:i?'How should we prioritize the next step?':'Where should our campaign begin?',status:'success',answer:'## A focused next step\n\n'+('Build on the Brand’s positioning and invite your audience to a useful conversation. Keep the offer clear and test the assumptions with a small group.\n\n').repeat(3)+'1. Listen to customers.\n2. Refine the invitation.\n3. Review the response.',responseLanguage:'en',advisorIdentity:captureAiBrainAdvisorIdentity(),approvedLearnings:{items:[{ref:'L1',statement:'Customers value a clear, personal invitation.'}],coverage:{partial:true}},meta:'Board Brand Core · Canvas context. Qualitative advice.'}));
      renderAiBrain();
    });
    await seed();
    if (screenshots) {
      fs.mkdirSync(screenshots,{recursive:true});
      for(const [width,theme] of [[1440,'light'],[1440,'dark'],[375,'light'],[320,'dark']]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(theme=>{window.FunklixTheme.setPreference(theme);renderAiBrain();const n=el.aiBrainSummary.querySelector('.ai-brain-transcript');const user=n.querySelector('.is-user:last-of-type')||Array.from(n.children).filter(x=>x.classList.contains('is-user')).at(-1);n.scrollTop+=user.getBoundingClientRect().top-n.getBoundingClientRect().top-12;n.dispatchEvent(new Event('scroll'));},theme);
        await page.screenshot({path:path.join(screenshots,`conversation-${width}-${theme}.png`)});
      }
    }
    if(process.env.BW37_CAPTURE_ONLY) { console.log('PASS real Chromium conversation captures'); return; }
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{window.FunklixTheme.setPreference('light');renderAiBrain();});
    assert((await transcript.boundingBox()).width > 900, 'desktop uses available workspace');
    const learning = page.locator('.ai-brain-learning-context').first();
    await learning.locator('summary').click();
    await page.evaluate(()=>renderAiBrain());assert(await learning.evaluate(n=>n.open),'Learning disclosure remains expanded');
    assert.equal(await learning.locator('li').textContent(),'Customers value a clear, personal invitation.');
    assert.equal(await page.locator('.ai-brain-message .ai-brain-advisor-avatar img').first().getAttribute('src'),avatar,'original approved Avatar in transcript');
    const domain = await page.evaluate(()=>JSON.stringify([state.nodes,state.edges,state.brandCore,state.boardBrandAssociation,state.isDirty]));
    const submit = async text => { release=null;await question.fill(text);await page.locator('#ai-brain-form [type=submit]').click();await page.waitForFunction(()=>state.aiBrain.status==='loading');assert(release); };
    const finish = async () => {release();await page.waitForFunction(()=>state.aiBrain.status!=='loading');};
    await submit('What should we do next?');
    assert(await page.locator('.is-loading').isVisible());
    const pending = await metrics();assert(pending.top>0);assert(pending.max-pending.top<3,'new question and pending at latest');
    const latestQuestion=await page.locator('.is-user').last().boundingBox(), bounds=await transcript.boundingBox();
    assert(latestQuestion.y>=bounds.y && latestQuestion.y+latestQuestion.height<=bounds.y+bounds.height,'new question visible');
    await finish();assert((await metrics()).top>0);
    assert.equal(await page.locator('.ai-brain-formatted-answer img').count(),0);
    console.log('PASS submission, pending and successful exchange stay visible; safe Markdown');
    // Read history while a lengthy response is outstanding, using a real wheel event.
    answer=('## Strategic recommendation\n\n'+('Use a small, contextual experiment to learn before committing the whole campaign.\n\n').repeat(18));
    await submit('Explain the trade-offs in detail');
    await transcript.hover();await page.mouse.wheel(0,-650);
    await page.waitForFunction(()=>{const n=document.querySelector('.ai-brain-transcript');return n.scrollHeight-n.clientHeight-n.scrollTop>300;});
    const reading=await metrics();await finish();
    assert(Math.abs((await metrics()).top-reading.top)<3,'response preserves history reading');
    await question.evaluate(n=>{n.focus();n.value='A draft for later';n.setSelectionRange(2,7,'backward');});
    await page.evaluate(()=>renderAiBrain());
    assert(Math.abs((await metrics()).top-reading.top)<3,'unrelated render preserves reading');
    assert.deepEqual(await question.evaluate(n=>[n.value,n===document.activeElement,n.selectionStart,n.selectionEnd,n.selectionDirection]),['A draft for later',true,2,7,'backward']);
    const jump=page.getByRole('button',{name:'Jump to latest',exact:true});await jump.focus();await page.keyboard.press('Enter');
    assert((await metrics()).max-(await metrics()).top<3);
    assert(await transcript.evaluate(n=>n===document.activeElement),'jump transfers keyboard focus to transcript');
    console.log('PASS intentional history reading, background render, draft/caret/focus and keyboard Jump to latest');
    // A long response begins at its exchange, and the remainder stays reachable.
    await submit('Give me the detailed recommendation');await finish();
    assert((await metrics()).top>0);assert(await jump.isVisible());
    await jump.click();assert((await metrics()).max-(await metrics()).top<3);
    fail=true;await submit('Try another recommendation');await finish();
    assert(await page.locator('[data-ai-brain-retry]').last().isVisible());
    fail=false;release=null;await page.locator('[data-ai-brain-retry]').last().click();await page.waitForFunction(()=>state.aiBrain.status==='loading');await finish();
    assert.equal(requests.at(-1).question,'Try another recommendation');
    console.log('PASS long responses, failure and retry reveal the active exchange');
    await transcript.evaluate(n=>{n.scrollTop=420;n.dispatchEvent(new Event('scroll'));});const saved=await metrics();
    await page.evaluate(()=>{setActiveView('home');renderAiBrain();setActiveView('ai_brain');});
    assert(Math.abs((await metrics()).top-saved.top)<3,'navigation restores reading');
    for(const width of [1280,768,375,320]) for(const theme of ['light','dark']) {
      await page.setViewportSize({width,height:812});await page.emulateMedia({reducedMotion:'reduce'});
      await page.evaluate(theme=>{window.FunklixTheme.setPreference(theme);state.uiLanguage=window.FunklixLanguage.setUiLanguage('de');refreshInterfaceLanguage();},theme);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no page overflow');
      assert(await transcript.evaluate(n=>n.scrollWidth<=n.clientWidth+1),'no transcript overflow');
      assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>{const r=n.getBoundingClientRect();return r.bottom<=innerHeight+1&&r.top>=0;}),'composer visible without outer scroll '+width+'/'+theme);
      assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>{const r=n.getBoundingClientRect();return n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'composer not covered by mobile workspace switcher');
      for(const mode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) await page.locator('#ai-brain-mode').selectOption(mode);
    }
    await page.evaluate(()=>{window.originalBoardName=state.currentBoardName;state.currentBoardName='LongBoardIdentity'.repeat(40);renderAiBrain();});
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'long Board identity wraps at 320px');
    assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight),'long context leaves composer reachable');
    await page.evaluate(()=>{state.currentBoardName=originalBoardName;renderAiBrain();});
    // Resize to the usable height of a mobile keyboard, while the draft remains focused.
    await question.focus();await page.setViewportSize({width:375,height:520});
    assert(await question.isVisible());
    assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>n.getBoundingClientRect().bottom<=innerHeight+1));
    await page.setViewportSize({width:375,height:812});
    await page.evaluate(()=>{Object.defineProperty(window.visualViewport,'height',{configurable:true,value:520});window.visualViewport.dispatchEvent(new Event('resize'));});
    await page.waitForFunction(()=>el.aiBrainView.getBoundingClientRect().bottom<=520);
    assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>n.getBoundingClientRect().bottom<450),'visual viewport keyboard leaves composer above mobile controls');
    await page.evaluate(()=>{delete window.visualViewport.height;window.visualViewport.dispatchEvent(new Event('resize'));});
    assert.equal(await page.evaluate(()=>JSON.stringify([state.nodes,state.edges,state.brandCore,state.boardBrandAssociation,state.isDirty])),domain);
    console.log('PASS navigation, responsive themes/language, five modes, reduced motion and keyboard-sized viewport; zero domain mutations');
    await page.setViewportSize({width:1440,height:900});
    await submit('Pending while navigating away');
    await page.evaluate(()=>{setActiveView('board');window.canvasScroll=[el.canvas.scrollTop,el.canvas.scrollLeft];});await finish();
    assert.deepEqual(await page.evaluate(()=>[el.canvas.scrollTop,el.canvas.scrollLeft]),await page.evaluate(()=>canvasScroll));
    await page.evaluate(()=>setActiveView('ai_brain'));
    await submit('Stale account request');
    await page.evaluate(()=>{state.user={...state.user,email:'replacement@example.test'};renderAiBrain();});await finish();
    assert.equal(await page.evaluate(()=>state.aiBrain.messages.length),0);assert.equal(await question.inputValue(),'');assert.equal((await metrics()).top,0);
    await page.evaluate(()=>{state.currentBoardId='replacement';state.boardLoadGeneration++;document.querySelector('#ai-brain-question').value='Old Board draft';invalidateAiBrainRequest();renderAiBrain();});
    assert.equal(await page.evaluate(()=>state.aiBrain.messages.length),0);assert.equal(await question.inputValue(),'','draft does not cross explicit invalidation');
    await page.setViewportSize({width:375,height:812});
    await page.evaluate(()=>{state.nodes=[];refreshLastSavedSnapshot();renderAiBrain();Object.defineProperty(window.visualViewport,'height',{configurable:true,value:520});window.visualViewport.dispatchEvent(new Event('resize'));});
    await page.waitForFunction(()=>el.aiBrainView.getBoundingClientRect().bottom<=520);
    assert(await page.locator('#ai-brain-form [type=submit]').evaluate(n=>n.getBoundingClientRect().bottom<450),'empty-Canvas keyboard composer remains reachable');
    assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);
    console.log('PASS unrelated Canvas unaffected, account/Board reset and stale response suppression');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
