#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { W, B, D, EMAIL } = require('./fixtures/bw36-13r5-local-runtime');
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const out = path.resolve(process.env.BW22_EVIDENCE || 'work/bw36-22a-visuals'); fs.mkdirSync(out,{recursive:true});
let passed=0; const results=[];
async function check(name, run) { await run(); passed++;results.push(name);console.log('PASS '+name); }
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  const fixture=require('./fixtures/home-browser')(browser);
  const home=p=>p.locator('#home-foundation'), next=p=>p.locator('.home-next-moves'), cards=p=>p.locator('.home-board-card');
  const action=(p,a)=>home(p).locator('[data-home-action="'+a+'"]');
  const refresh=p=>p.evaluate(()=>{refreshDashboardIfVisible();clearAutosaveTimer();});
  const ready=p=>p.waitForFunction(()=>document.querySelector('.home-next-moves [data-next-source=learning]'));
  const snapshot=p=>p.evaluate(()=>JSON.stringify({nodes:state.nodes,edges:state.edges,core:state.brandCore,dirty:state.isDirty,saved:state.lastSavedSnapshot,association:state.boardBrandAssociation,revision:state.lastKnownUpdatedAt}));
  try {
    await check('DOM order, unique IDs, compact selectors and guarded header continuation',async()=>{
      const f=await fixture(),p=f.page;await ready(p);
      assert.deepEqual(await home(p).evaluate(e=>[...e.children].map(n=>n.className)),['home-hero','home-living','home-details-heading','','home-next-moves','home-continue','home-intelligence','home-board-intelligence','home-brands']);
      assert.equal(await p.locator('#home-workspace-select').count(),1);assert.equal(await p.locator('#home-brand-select').count(),1);
      assert.equal(await p.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(n=>n.id);return ids.length-new Set(ids).size;}),0);
      assert((await p.locator('.home-hero').innerText()).includes('Local Workspace'));
      assert((await p.locator('.home-details-heading').innerText()).includes('Autumn Launch'));
      await action(p,'header-board').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>state.activeView),'board');await f.close();
    });
    await check('Brand preference, mismatch actions, Profile and all Brand exploration remain independent of Board association',async()=>{
      const f=await fixture(),p=f.page;await ready(p);const before=await snapshot(p);
      await p.locator('#home-brand-select').selectOption(Y);await ready(p);
      assert.equal(await p.evaluate(()=>state.session.brandId),Y);assert.equal(await snapshot(p),before);
      assert((await p.locator('[data-home-context]').innerText()).includes('Selected Brand Y'));
      assert((await p.locator('[data-home-context]').innerText()).includes('Canvas Brand X'));
      assert((await next(p).innerText()).includes('9 Learnings'));assert((await next(p).innerText()).includes('Autumn Launch'));
      assert.equal(await p.locator('.home-brand-card').count(),2);
      await action(p,'header-profile').focus();await p.keyboard.press('Space');await p.waitForFunction(()=>state.activeView==='brand-profile');
      assert.equal(await p.evaluate(()=>state.currentBoardId),D);await f.close();
    });
    await check('fixed Learning, assigned-to-me, engine finding order; summaries reuse requests and current evidence',async()=>{
      const f=await fixture(),p=f.page;await ready(p);const before=await snapshot(p),reads=f.reads.length;
      assert.deepEqual(await next(p).locator('[data-next-source]').evaluateAll(es=>es.map(e=>e.dataset.nextSource)),['learning','responsibilities','insights']);
      const campaign=await p.evaluate(()=>homeCampaignInsights());
      assert((await next(p).innerText()).includes(campaign.findings[0].title));assert((await next(p).innerText()).includes('3 responsibilities'));
      for(let i=0;i<3;i++)await refresh(p);
      assert.equal(f.reads.length,reads);assert.equal(await snapshot(p),before);
      await action(p,'next-insights').focus();await p.keyboard.press('Enter');assert.equal(await p.evaluate(()=>state.activeView),'insights');await f.close();
    });
    await check('unknown, denied, malformed, zero and read-only Learning sources never become review recommendations',async()=>{
      const f=await fixture(),p=f.page;await ready(p);
      for(const value of [{counts:{proposed:0,approved:1},can_write:true},{counts:{proposed:4},can_write:false},{counts:{proposed:'4'},can_write:true}]){
        Object.assign(f.results.get(B),value);await p.evaluate(()=>window.dispatchEvent(new Event('funklix:brand-learnings-changed')));
        await p.waitForFunction(()=>document.querySelector('[data-home-module=brand] dl'));
        assert.equal(await action(p,'next-learnings').count(),0);
      }
      f.status=403;await p.evaluate(()=>window.dispatchEvent(new Event('funklix:brand-learnings-changed')));await p.waitForFunction(()=>document.querySelector('[data-home-action=learnings-retry]'));
      assert.equal(await action(p,'next-learnings').count(),0);assert((await next(p).innerText()).includes('Some information is unavailable'));
      assert.equal(await next(p).locator('a[href="#home-intelligence-title"]').count(),1);await f.close();
    });
    await check('responsibility matching, completed and duplicate exclusions; diagnostic staleness removes summary',async()=>{
      const f=await fixture(),p=f.page;await ready(p);
      await p.evaluate(()=>{for(const n of state.nodes)n.ownerEmail='someone@example.test';refreshDashboardIfVisible();});
      assert.equal(await action(p,'next-responsibilities').count(),0);
      await p.evaluate(()=>{state.nodes[0].ownerEmail=state.user.email.toUpperCase();state.nodes[0].status='Approved';refreshDashboardIfVisible();});
      assert.equal(await action(p,'next-responsibilities').count(),0);
      await p.evaluate(()=>{state.nodes[0].status='Draft';state.nodes.push({...state.nodes[0]});refreshDashboardIfVisible();});
      assert.equal(await action(p,'next-responsibilities').count(),0);
      await p.evaluate(()=>{cancelHomeInsightsRequest();window.requestIdleCallback=()=>123;window.cancelIdleCallback=()=>{};state.nodes[0].content+=' changed';refreshDashboardIfVisible();});
      assert.equal(await action(p,'next-insights').count(),0);assert((await next(p).innerText()).includes('Campaign Insights availability'));await f.close();
    });
    await check('six authorized cards, reversible expansion, exact model grouping/order, partial metadata and current highlighting',async()=>{
      const f=await fixture({manyBoards:true}),p=f.page;await ready(p);await p.locator('.home-board-date time').first().waitFor();
      const all=await p.evaluate(metadata=>FunklixHomeFoundation.model({...brandBoardNavigationContext(),account:state.user,identity:state.workspaceCatalog.identity,catalog:state.workspaceCatalog.value,status:'ready',boardId:state.currentBoardId},metadata).boards.map(b=>b.id),f.r.db.boards.map(b=>({id:b.id,updated_at:b.updated_at})));
      const ids=()=>cards(p).locator('[data-home-action=board]').evaluateAll(es=>es.map(e=>e.dataset.homeId));
      const preview=await ids();assert.equal(preview.length,6);assert((await p.locator('.home-preview-controls').innerText()).includes('6 of 10'));
      await action(p,'expand').focus();await p.keyboard.press('Enter');const expanded=await ids();assert.equal(expanded.length,10);assert.deepEqual(expanded.slice(0,6),preview);
      assert.equal(new Set(expanded).size,10);assert.deepEqual(expanded,all);assert.equal(await cards(p).filter({has:p.locator('[data-home-id="'+D+'"]')}).getAttribute('class'),'home-board-card is-current');
      assert((await home(p).innerText()).includes('Modification time unavailable'));assert((await home(p).innerText()).includes('not a history of your visits'));
      await action(p,'expand').press('Space');assert.equal(await cards(p).count(),6);assert.equal(await p.evaluate(()=>document.activeElement.dataset.homeAction),'expand');
      await action(p,'expand').click();await p.locator('#home-brand-select').selectOption(Y);assert.equal(await cards(p).count(),6);assert.equal(await action(p,'expand').getAttribute('aria-expanded'),'false');
      const connected=await cards(p).first().innerText();assert(connected.includes('Selected Brand Y'));
      await action(p,'expand').click();await p.evaluate(()=>{state.user={...state.user};refreshDashboardIfVisible();});assert.equal(await cards(p).count(),6);
      await action(p,'expand').click();await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);state.workspaceCatalog.value.workspaces[0].boards.pop();refreshDashboardIfVisible();});assert.equal(await cards(p).count(),6);await f.close();
    });
    await check('fallback is existing first authorized Board; no Board/empty Canvas has no fabricated task; hidden association stays distinct',async()=>{
      const f=await fixture({root:true}),p=f.page;await p.locator('#home-workspace-select').selectOption(W);await p.locator('#home-brand-select').selectOption(B);await ready(p);
      f.results.get(B).counts={};await p.evaluate(()=>window.dispatchEvent(new Event('funklix:brand-learnings-changed')));
      await p.waitForFunction(()=>document.querySelector('[data-next-source=continuation]'));
      assert.equal(await action(p,'next-board').getAttribute('data-home-id'),D);assert.equal(await action(p,'header-board').count(),0);
      await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);state.workspaceCatalog.value.workspaces[0].boards=[];refreshDashboardIfVisible();});assert.equal(await action(p,'next-boards').count(),1);await f.close();
      for(const hidden of [true,false]){const g=await fixture({hidden,noBrand:!hidden});assert((await home(g.page).innerText()).includes(hidden?'No visible Brand association':'No Brand connected'));await g.close();}
    });
    await check('captured scope rejects forged/stale Next Moves and current evidence; navigation makes no writes',async()=>{
      const f=await fixture(),p=f.page;await ready(p);
      await p.evaluate(()=>{const old=document.querySelector('[data-home-action=next-insights]');const copy=old.cloneNode(true);old.replaceWith(copy);copy.click();});assert.equal(await p.evaluate(()=>state.activeView),'home');
      await refresh(p);
      await p.evaluate(()=>{state.nodes[0].content+=' stale';document.querySelector('[data-home-action=next-insights]').click();});assert.equal(await p.evaluate(()=>state.activeView),'home');
      await p.evaluate(()=>{state.user={...state.user};document.querySelector('[data-home-action=next-learnings]').click();});assert.equal(await p.evaluate(()=>state.activeView),'home');await f.close();
    });
    await check('focus survives async redraw; selector labels and keyboard reading order',async()=>{
      const f=await fixture(),p=f.page;await ready(p);
      await action(p,'next-responsibilities').focus();await refresh(p);assert.equal(await p.evaluate(()=>document.activeElement.dataset.homeAction),'next-responsibilities');
      await p.locator('#home-brand-select').focus();await refresh(p);assert.equal(await p.evaluate(()=>document.activeElement.id),'home-brand-select');
      assert((await p.locator('label[for=home-brand-select]').innerText()).startsWith('Selected Brand'));assert.equal(await p.locator('label[for=home-workspace-select]').innerText(),'Workspace');
      const positions=await home(p).evaluate(e=>['.home-hero','.home-living','.home-details-heading','.home-next-moves','.home-continue','.home-intelligence','.home-board-intelligence','.home-brands'].map(s=>e.querySelector(s).getBoundingClientRect().top));
      assert(positions.every((v,i)=>!i||v>positions[i-1]));await f.close();
    });
    await check('mobile scroll clip is immediate and every Home action remains reachable across repeated shell changes', async()=>{
      const f=await fixture({manyBoards:true}),p=f.page;await ready(p);
      await p.locator('#home-brand-select').selectOption(Y);await ready(p);
      await action(p,'expand').click();assert.equal(await cards(p).count(),10);
      const before=await snapshot(p);
      await require('./fixtures/home-mobile-geometry')(p,out);
      assert.equal(await snapshot(p),before,'Mobile geometry changes never mutate the Board');await f.close();
    });
    const geometry=[];
    await check('Chromium visual matrix, full labels, theme/system, fixed overlay/focus geometry and continuation',async()=>{
      const f=await fixture({manyBoards:true}),p=f.page;await ready(p);await p.locator('#home-brand-select').selectOption(Y);await ready(p);
      for(const [width,height,theme,language,collapsed] of [[1920,1080,'light','en',false],[1440,900,'light','en',false],[1440,900,'dark','de',true],[1280,800,'system','de',false],[1024,768,'dark','en',false],[768,1024,'system','en',true],[375,812,'light','en',true],[375,812,'dark','de',false],[320,740,'light','en',false],[320,740,'dark','de',true]]){
        await p.setViewportSize({width,height});await p.emulateMedia({colorScheme:theme==='system'?(width===768?'light':'dark'):theme,reducedMotion:'reduce'});
        await p.evaluate(({theme,language,collapsed})=>{FunklixTheme.setPreference(theme);setSidebarCollapsed(collapsed);FunklixLanguage.setUiLanguage(language);state.uiLanguage=language;refreshDashboardIfVisible();},{theme,language,collapsed});
        await p.locator('.home-hero').evaluate(e=>e.scrollIntoView({block:'start'}));
        const rects=await p.evaluate(()=>{
          const r=s=>{const x=document.querySelector(s).getBoundingClientRect();return {x:x.x,y:x.y,width:x.width,height:x.height,bottom:x.bottom,right:x.right};};
          return {hero:r('.home-hero'),living:r('.home-living'),heroOpen:r('[data-home-action=living-board]'),details:r('.home-details-heading'),next:r('.home-next-moves'),continuation:r('.home-continue'),firstOpen:r('.home-board-open'),bodyWidth:document.documentElement.scrollWidth,homeWidth:document.getElementById('home-foundation').scrollWidth,overlay:r('.sidebar > .workspace-context')};
        });
        assert.equal(rects.bodyWidth,width);assert(rects.hero.right<=width+1);assert(rects.hero.width>200);
        // B1 inserts the approved Living Workspace before every detailed module.
        // Keep the actionable first-viewport gate on its real saved continuation;
        // the exact detail order, preview and navigation assertions remain above.
        if(width===1440&&language==='en'){assert(rects.heroOpen.y<=600,JSON.stringify(rects));assert(rects.details.y>=rects.living.bottom,JSON.stringify(rects));}
        if(width<768){const bounds=await p.locator('#dashboard-view').boundingBox();assert(bounds.y+bounds.height<=rects.overlay.y+1,'Home scroll viewport overlaps fixed context controls '+JSON.stringify({width,height,theme,language,collapsed,bounds,overlay:rects.overlay}));}
        const file=`home-${width}-${theme}-${language}.png`;await p.screenshot({path:path.join(out,file)});
        await action(p,'expand').click();assert.equal(await cards(p).count(),10);
        const last=cards(p).last().locator('button');await last.focus();await last.scrollIntoViewIfNeeded();await p.waitForTimeout(40);
        const collision=await last.evaluate(e=>{const a=e.getBoundingClientRect();return [...document.querySelectorAll('.sidebar,.sidebar > .workspace-context')].filter(x=>getComputedStyle(x).position==='fixed').some(x=>{const b=x.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;});});assert.equal(collision,false,'focused card covered '+width);
        rects.focusTarget=await last.boundingBox();rects.focusCollisions=collision;rects.scrollViewport=await p.locator('#dashboard-view').boundingBox();
        if(width===1440||width===375)await p.screenshot({path:path.join(out,`expanded-${width}-${theme}-${language}.png`)});
        await action(p,'expand').click();geometry.push({width,height,theme,language,collapsed,file,...rects});
      }
      // Stress enlargement and user-authored names without fixed heights.
      await p.setViewportSize({width:320,height:740});await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);const w=state.workspaceCatalog.value.workspaces[0];w.name='Long Workspace name '.repeat(8);w.brands[0].name='Langer Markenname '.repeat(8);w.boards[0].name='Long campaign title '.repeat(8);document.documentElement.style.fontSize='200%';refreshDashboardIfVisible();});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),320);
      await p.emulateMedia({forcedColors:'active'});await p.keyboard.press('Tab');await action(p,'header-board').focus();
      assert.equal(await action(p,'header-board').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
      fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(geometry,null,2));await f.close();
      const current=await fixture();await current.page.screenshot({path:path.join(out,'current-board.png')});await current.close();
      const no=await fixture({root:true});await no.page.locator('#home-workspace-select').selectOption(W);await no.page.screenshot({path:path.join(out,'no-board.png')});await no.close();
    });
    fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed,groups:results},null,2));console.log(`${passed} BW-36.22A groups passed`);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);if(process.env.GITHUB_ACTIONS==='true')console.error('::error title=Compact Home regression::'+String(e.stack||e).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A'));process.exitCode=1;});
