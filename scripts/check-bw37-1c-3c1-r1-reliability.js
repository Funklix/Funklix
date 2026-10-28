'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const question = 'Write two distinct social posts for #MyAppicsStory: one Instagram post and one X post.';
const full = fs.readFileSync('scripts/fixtures/bw37-1c3b-r1-appics-response.txt', 'utf8').trim();
const split = full.indexOf('##### X Post');
const instagram = full.slice(0, split), x = full.slice(split);
const message = (...texts) => ({type:'message', role:'assistant', content:texts.map(text=>({type:'output_text',text}))});
async function main() {
  const api = await require('./fixtures/bw36-20-database').fixture();
  const answers = [];
  try {
    for (const payload of [
      {output:[{type:'reasoning',summary:[{text:'private reasoning must not leak'}]},message(instagram,x)]},
      {output:[message(instagram),{type:'function_call',arguments:'not advice'},message(x)]},
      {output_text:full,output:[message('Do not duplicate the aggregate')]},
      {output:[message(instagram)]}
    ]) {
      api.calls.length=0; api.providerResponse=payload;
      const result=await api.invoke({question,conversation_history:[{user:'Plan #MyAppicsStory',assistant:'We can draft distinct platform posts.'}]});
      assert.equal(result.statusCode,200); assert.equal(api.calls.length,1); assert.equal(api.calls[0].store,false);
      assert.equal(api.calls[0].input.at(-1).content,question);
      assert(api.calls[0].input.some(m=>m.content==='We can draft distinct platform posts.'));
      assert.equal(api.calls[0].max_output_tokens,4096);
      assert.equal(result.body.answer,answers.length===3?instagram.trim():full);
      answers.push(result.body.answer);
    }
    console.log('PASS actual Advice handler: ordered multiple text blocks/messages, aggregate precedence, no reasoning/tools, complete and genuinely incomplete output, history/question, store:false and one call');
  } finally {await api.pg.close();}
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({empty:true}),p=f.page;
    let answer,requests=0;
    await p.route('**/api/ai-brain/advice',r=>{requests++;return r.fulfill({json:{answer,assumptions:[],disclaimer:'Fictional fixture',context:{response_language:'en',reference_resolution:'none'}}});});
    for (const [i,value] of answers.entries()) {
      answer=value; await p.reload();
      await p.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating);
      await p.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();state.uiLanguage=language.setUiLanguage('en');setAppMode('canvas');setActiveView('ai_brain');});
      await p.locator('#ai-brain-question').fill(question);await p.locator('#ai-brain-form button[type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');
      const count=i===3?1:2;
      const captured=await p.evaluate(()=>{const t=state.aiBrain.messages.at(-1);return {answer:t.answer,bound:t.contentProposalSource.answer,current:aiBrainContentSourceCurrent(t),assets:aiBrainContentAssets(t)};});
      assert.equal(captured.answer,value);assert.equal(captured.bound,value);assert(captured.current);assert.equal(captured.assets.length,count);
      for (const a of captured.assets) assert.equal(a.text,value.slice(a.start,a.end));
      assert.equal(await p.locator('[data-ai-brain-prepare]').count(),1);
      assert(await p.locator('.is-advisor').last().evaluate(n=>{const a=n.querySelector('.ai-brain-response-actions');return !!a&&!!(n.querySelector('.ai-brain-formatted-answer').compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING);}));
      await p.locator('[data-ai-brain-prepare]').click();
      assert.equal(await p.locator('[data-ai-brain-source] input').count(),count);
      assert.equal(await p.locator('.ai-brain-content-summary').count(),0);
      assert.equal(await p.locator('[data-ai-brain-excerpt]:visible').count(),0);
      for (let j=0;j<count;j++) {
        await p.locator(`[data-ai-brain-source] input[value="${j}"]`).check();
        assert.equal(await p.locator('[data-ai-brain-excerpt]').textContent(),captured.assets[j].text);
        const selected=await p.evaluate(()=>state.aiBrain.messages.at(-1).proposal.selection);
        assert.deepEqual(selected,captured.assets[j]);
        assert.equal(await p.locator('[data-ai-brain-destination]').inputValue(),'Social Media Posting');
        assert(!/\*\*|#####/.test(await p.locator('.ai-brain-content-card span').nth(j).textContent()));
      }
      await p.keyboard.press('Escape');
      assert.equal(await p.locator('dialog[open]').count(),0);
      if (count===1) assert(!captured.assets.some(a=>a.text.includes('##### X Post')),'never manufacture X from the request');
    }
    assert.equal(requests,4);
    // Presentation variants: all eligible routes share the footer; only one Add action.
    await p.evaluate(()=>{
      window.savedRoutes=[aiBrainCampaignBrief,aiBrainCampaignSourceCurrent,aiBrainValueProposition,aiBrainBrandSourceCurrent];
      aiBrainCampaignSourceCurrent=aiBrainBrandSourceCurrent=()=>true;
    });
    for (const campaign of [false,true]) for (const brand of [false,true]) {
      await p.evaluate(({campaign,brand})=>{aiBrainCampaignBrief=()=>campaign?{}:null;aiBrainValueProposition=()=>brand?'Proposed value':null;renderAiBrain();},{campaign,brand});
      const actions=p.locator('.ai-brain-response-actions');
      assert.equal(await actions.locator('[data-ai-brain-prepare]').count(),1);
      assert.equal(await actions.locator('[data-ai-brain-campaign]').count(),Number(campaign));
      assert.equal(await actions.locator('[data-ai-brand-proposal]').count(),Number(brand));
      assert.equal(await actions.locator('details').count(),Number(campaign&&brand));
    }
    await p.evaluate(()=>{[aiBrainCampaignBrief,aiBrainCampaignSourceCurrent,aiBrainValueProposition,aiBrainBrandSourceCurrent]=window.savedRoutes;renderAiBrain();});
    for (const width of [320,375,1440]) for (const theme of ['light','dark']) {
      await p.setViewportSize({width,height:640});
      await p.evaluate(theme=>{window.FunklixTheme.setPreference(theme);renderAiBrain();},theme);
      const action=p.locator('[data-ai-brain-prepare]');await action.scrollIntoViewIfNeeded();await action.focus();
      assert(await action.evaluate(n=>n===document.activeElement));await p.keyboard.press('Enter');
      assert(await p.evaluate(()=>!!document.activeElement.closest('dialog[open]')));
      assert.equal(await p.locator('.ai-brain-content-summary').count(),0);
      const box=await p.locator('dialog[open]').boundingBox();assert(box.x>=0&&box.x+box.width<=width&&box.height<=640);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      if (process.env.BW37_RELIABILITY_SCREENSHOTS && width===375) {
        fs.mkdirSync(process.env.BW37_RELIABILITY_SCREENSHOTS,{recursive:true});
        await p.screenshot({path:process.env.BW37_RELIABILITY_SCREENSHOTS+'/'+theme+'-dialog.png'});
      }
      await p.keyboard.press('Escape');assert(await action.evaluate(n=>n===document.activeElement));
      await action.scrollIntoViewIfNeeded();
      assert(await action.evaluate(n=>{const a=n.getBoundingClientRect(),t=n.closest('.ai-brain-transcript').getBoundingClientRect();return a.top>=t.top-1&&a.bottom<=t.bottom+1;}));
      if (process.env.BW37_RELIABILITY_SCREENSHOTS && width===375) await p.screenshot({path:process.env.BW37_RELIABILITY_SCREENSHOTS+'/'+theme+'-actions.png'});
    }
    const preview=await p.evaluate(()=>aiBrainContentPlainPreview('**Caption:** Keep __your story__ and `your voice`. [Join](https://example.invalid) #MyAppicsStory <img src=x onerror=alert(1)>'));
    assert.equal(preview,'Caption: Keep your story and your voice. Join #MyAppicsStory <img src=x onerror=alert(1)>');
    assert.deepEqual(f.errors,[]);await p.close();
    console.log('PASS handler answers through browser state/source binding/extraction/selection/cards; incomplete output stays one asset; exact isolation, concise inert plain preview, footer combinations and cancellation');
  } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
