#!/usr/bin/env node
'use strict';
// Actual application boot and existing Home fixture. Every request is intercepted;
// providers/AI endpoints and writes fail the fixture before leaving the browser.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { heroContinuation, model } = require('../home-foundation');
const { W, B, D } = require('./fixtures/bw36-13r5-local-runtime');
const Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const out = path.resolve(process.env.BW22B1_EVIDENCE || 'work/bw36-22b1-visuals'); fs.mkdirSync(out, {recursive:true});
let passed = 0; const groups = [], geometry = [];
async function check(name, run) { await run(); passed++; groups.push(name); console.log('PASS ' + name); }
const home = p => p.locator('#home-foundation');
const action = (p, key) => home(p).locator('[data-home-action="' + key + '"]');
const refresh = p => p.evaluate(() => { refreshDashboardIfVisible(); clearAutosaveTimer(); });
const ready = p => p.waitForFunction(() => document.querySelector('[data-home-module=brand] dl'));
const snapshot = p => p.evaluate(() => JSON.stringify({nodes:state.nodes, edges:state.edges, core:state.brandCore,
  dirty:state.isDirty, saved:state.lastSavedSnapshot, association:state.boardBrandAssociation, revision:state.lastKnownUpdatedAt}));
(async () => {
  await check('continuation: matching current, selected ordering, foreign-current fallback, viewer and unauthorized/unknown dates', () => {
    const account = {email:'test@example.test'};
    const context = {account, identity:account.email, status:'ready', workspaceId:W, brandId:B, boardId:D, openBoard:{canEdit:true,brandId:B},
      catalog:{workspaces:[{id:W, brands:[{id:B},{id:Y}], boards:[{id:D,name:'Current',brand_id:B},
        {id:'newer',name:'Newer',brand_id:B}, {id:'other',name:'Other',brand_id:Y,role:'viewer'}]}]}};
    const dates = [{id:D,updated_at:'2026-10-01T10:00:00Z'},{id:'newer',updated_at:'2026-10-18T10:00:00Z'},{id:'other',updated_at:'invalid'}];
    const before = JSON.stringify([context,dates]);
    assert.equal(heroContinuation(context,dates).id,D);
    assert.equal(model(context,dates).boards[0].id,'newer','Detailed order is not changed by current preference');
    assert.equal(heroContinuation({...context,brandId:Y},dates).id,'other');
    assert.equal(heroContinuation({...context,brandId:'no-connected'},dates).id,D);
    assert.equal(heroContinuation({...context,openBoard:null},dates).id,'newer');
    assert.equal(heroContinuation({...context,loading:true},dates).id,'newer');
    assert.equal(heroContinuation({...context,openBoard:{canEdit:true,brandId:Y}},dates).id,'newer','Current preference uses hydrated association');
    assert.equal(heroContinuation({...context,brandId:'no-connected',openBoard:{canEdit:true,brandId:'hidden'}},dates).brand,null);
    assert.equal(heroContinuation({...context,brandId:Y},dates).savedAt,undefined);
    for (const patch of [{account:null},{identity:'other'},{status:'loading'},{publicToken:'public'},{workspaceId:'unknown'}])
      assert.equal(heroContinuation({...context,...patch},dates),null);
    assert.equal(JSON.stringify([context,dates]),before);
  });
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium', args:['--no-sandbox']});
  const fixture = require('./fixtures/home-browser')(browser);
  try {
    await check('first-screen hierarchy, one H1, full detailed Home and all legacy static IDs preserved', async () => {
      const f = await fixture(), p = f.page; await ready(p);
      assert.deepEqual(await home(p).evaluate(e => [...e.children].map(n => n.className)),
        ['home-hero','home-living','home-details-heading','','home-next-moves','home-continue','home-intelligence','home-board-intelligence','home-brands']);
      assert.equal(await home(p).locator('h1').count(),1);
      assert.equal(await p.evaluate(() => { const ids = [...document.querySelectorAll('[id]')].map(n=>n.id); return ids.length-new Set(ids).size; }),0);
      for (const id of ['dashboard-title','dashboard-continue-working','dashboard-hero-avatar','home-continue-title','home-next-title',
        'home-intelligence-title','home-responsibilities-title','home-insights-title','home-brain-title','home-brands-title']) assert.equal(await p.locator('#'+id).count(),1,id);
      assert.equal(await p.locator('.home-board-card').count(),1); assert.equal(await p.locator('.home-brand-card').count(),2);
      await f.close();
    });
    await check('Workspace/Brand orientation, generic greeting, saved identity and timestamp with no recency/progress invention', async () => {
      const f = await fixture(), p = f.page; await ready(p);
      assert((await p.locator('.home-hero').innerText()).includes('Local Workspace'));
      assert.equal(await p.locator('#home-workspace-select').inputValue(),W); assert.equal(await p.locator('#home-brand-select').inputValue(),B);
      assert.equal(await p.locator('.home-living h1').innerText(),'Welcome back.');
      const copy = await p.locator('.home-living').innerText();
      assert(copy.includes('Autumn Launch')); assert(copy.includes('Last saved modification'));
      assert.equal(await p.locator('.home-living-continue time').getAttribute('datetime'),f.r.db.boards[0].updated_at);
      assert(!/Alex|Felix|last opened|last visited|strategy|\d+%|of 4 steps|approved today|All systems go|AI found/i.test(copy));
      assert.equal(await p.locator('.home-living [role=progressbar], .home-living progress').count(),0);
      await action(p,'living-board').focus(); await p.keyboard.press('Enter'); assert.equal(await p.evaluate(()=>state.activeView),'board'); await f.close();
    });
    await check('confirmed missing Avatar stays honest and static; contextual bubble stays truthful across runtime changes', async () => {
      const f = await fixture(), p = f.page; await ready(p);
      await p.locator('[data-avatar-state=ready]').waitFor();
      const bubble = await p.locator('.home-avatar-message').innerText(); assert(bubble.includes('73 Learning proposals'));
      assert((await p.locator('.home-avatar-slot').innerText()).includes('Bring your Brand to life.'));
      assert.equal(await p.locator('.home-avatar-stage img, .home-avatar-stage canvas, .home-avatar-stage svg').count(),0);
      assert.equal(await p.locator('.home-avatar-bubble').getAttribute('aria-live'),null);
      assert.equal(await p.locator('.home-avatar-art').getAttribute('aria-hidden'),'true');
      await p.evaluate(()=>{state.nodes[0].title='Changed';refreshDashboardIfVisible();});
      assert.equal(await p.locator('.home-avatar-message').innerText(),bubble);
      assert(await p.evaluate(()=>{const e=document.querySelector('.home-avatar-stage');return [e,...e.querySelectorAll('*')].every(n=>getComputedStyle(n).animationName==='none');}));
      await f.close();
    });
    await check('selected Brand/current Board mismatch chooses connected continuation without relabeling Brain or mutating Canvas', async () => {
      const f = await fixture({manyBoards:true}), p = f.page; await ready(p); const before = await snapshot(p);
      await p.locator('#home-brand-select').selectOption(Y); await ready(p);
      assert.equal(await snapshot(p),before);
      assert((await p.locator('.home-living-subtitle').innerText()).includes('Selected Brand Y'));
      assert((await p.locator('.home-living-continue').innerText()).includes('Saved campaign 1'));
      assert((await p.locator('.home-living-continue').innerText()).includes('Selected Brand Y'));
      assert((await p.locator('.home-avatar-entry').innerText()).includes('Autumn Launch · Canvas Brand X'));
      assert(!(await action(p,'stage-brain').innerText()).includes('Selected Brand Y'));
      assert((await p.locator('[data-home-context]').innerText()).includes('Selected Brand Y'));
      assert((await p.locator('[data-home-context]').innerText()).includes('Canvas Brand X'));
      assert((await action(p,'quick-learnings').innerText()).includes('Selected Brand Y'));
      await p.setViewportSize({width:1440,height:900}); await p.emulateMedia({reducedMotion:'reduce'});
      await p.evaluate(()=>{FunklixTheme.setPreference('light');setSidebarCollapsed(true);refreshDashboardIfVisible();});
      await p.locator('.home-hero').evaluate(e=>e.scrollIntoView({block:'start'}));
      await p.screenshot({path:path.join(out,'mismatch-1440-light-en.png')});
      await f.close();
    });
    await check('explicit foreign-current fallback, hidden association and unassigned scope remain distinguishable', async () => {
      const f = await fixture(), p = f.page; await ready(p); await p.locator('#home-brand-select').selectOption(Y); await ready(p);
      assert((await p.locator('.home-living-continue').innerText()).includes('No connected Board available. Continue your open Board.'));
      assert((await p.locator('.home-living-continue').innerText()).includes('Canvas Brand X')); await f.close();
      for (const hidden of [true,false]) {
        const g = await fixture({hidden,noBrand:!hidden});
        assert((await g.page.locator('.home-living-continue').innerText()).includes(hidden?'No visible Brand association':'No Brand connected'));
        assert(!(await g.page.locator('.home-living').innerText()).includes('Canvas Brand X')); await g.close();
      }
    });
    await check('Brain stage and emoji shortcut use existing keyboard destination, preserve draft and never infer', async () => {
      for (const origin of ['stage-brain','quick-brain']) {
        const f = await fixture(), p = f.page; await ready(p); const before = await snapshot(p);
        assert.deepEqual(await p.locator('.home-quick-icon').allTextContents(),['🧠','📊','📚','👥']);
        await p.evaluate(()=>{el.aiBrainNavButton.click();const q=document.querySelector('#ai-brain-question');q.value='Preserved question draft';q.dispatchEvent(new Event('input',{bubbles:true}));el.homeNavButton.click();});
        await action(p,origin).focus(); await p.keyboard.press('Enter'); await p.waitForFunction(()=>state.activeView==='ai_brain');
        assert.equal(await p.locator('#ai-brain-question').inputValue(),'Preserved question draft');
        await p.waitForFunction(()=>document.activeElement?.id==='ai-brain-question'); assert.equal(await snapshot(p),before); await f.close();
      }
    });
    await check('Insights shortcut uses current Board destination with no inference or Canvas mutation', async () => {
      const f = await fixture(), p = f.page; await ready(p); const before = await snapshot(p);
      await action(p,'quick-insights').press('Space'); assert.equal(await p.evaluate(()=>state.activeView),'insights'); assert.equal(await snapshot(p),before); await f.close();
    });
    await check('Learnings shortcut opens existing selected-Brand Profile section', async () => {
      const f = await fixture(), p = f.page; await ready(p); await p.locator('#home-brand-select').selectOption(Y); await ready(p);
      await action(p,'quick-learnings').press('Enter'); await p.waitForFunction(()=>state.activeView==='brand-profile');
      assert.equal(await p.evaluate(()=>canonicalBrandDetail.brandId),Y);
      assert.equal(await p.evaluate(()=>canonicalBrandDetail.initialSection),'Brand Learnings'); await f.close();
    });
    await check('responsibilities shortcut opens existing manager and restores origin after redraw', async () => {
      const f = await fixture(), p = f.page; await ready(p); const before = await snapshot(p);
      await action(p,'quick-responsibilities').press('Enter');
      await p.locator('#campaign-responsibilities').waitFor({state:'visible'});
      await p.waitForFunction(()=>document.getElementById('campaign-responsibilities')?.getAttribute('aria-busy')==='false');
      await refresh(p); await p.keyboard.press('Escape');
      await p.waitForFunction(()=>document.activeElement?.dataset.homeAction==='quick-responsibilities');
      assert.equal(await snapshot(p),before); await f.close();
    });
    await check('viewer and unavailable Learning access give honest keyboard-discoverable alternatives and block activation', async () => {
      const f = await fixture({viewer:true}), p = f.page; await ready(p);
      assert.equal(await action(p,'quick-brain').getAttribute('aria-disabled'),'true'); assert.equal(await action(p,'stage-brain').count(),0);
      assert((await action(p,'living-board').innerText()).includes('View Board'));
      assert((await p.locator('.home-avatar-context').innerText()).includes('read-only'));
      await action(p,'quick-brain').press('Enter'); assert.equal(await p.evaluate(()=>state.activeView),'home');
      for (const status of [403,500]) {
        f.status=status; await p.evaluate(()=>window.dispatchEvent(new Event('funklix:brand-learnings-changed')));
        await p.waitForFunction(()=>document.querySelector('[data-home-action=learnings-retry]'));
        assert.equal(await action(p,'quick-learnings').getAttribute('aria-disabled'),'true');
        await action(p,'quick-learnings').press('Space'); assert.equal(await p.evaluate(()=>state.activeView),'home');
      }
      await f.close();
    });
    await check('no Workspace/no Brands/no Boards, loading/error/logout/account replacement and Workspace switching retire identities', async () => {
      const no = await fixture({noWorkspace:true}); assert.equal(await no.page.locator('.home-living').count(),0);
      assert((await home(no.page).innerText()).includes('Your first Workspace starts here')); await no.close();
      const f = await fixture(), p = f.page; await ready(p);
      await p.locator('#home-workspace-select').selectOption('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      await p.waitForFunction(()=>state.workspaceCatalog.activeWorkspaceId==='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
      assert((await p.locator('.home-living-subtitle').innerText()).includes('A little space for your next idea.'));
      assert(!(await p.locator('.home-living').innerText()).includes('Autumn Launch'));
      assert.equal(await action(p,'quick-brain').getAttribute('aria-disabled'),'true');
      await p.locator('#home-workspace-select').selectOption(W); await p.locator('#home-brand-select').selectOption(B); await ready(p);
      // Workspace switching correctly retires the previous loaded Board. Use the
      // available Brand shortcut to exercise account-object capture after return.
      await p.evaluate(()=>{window.retiredLiving=document.querySelector('[data-home-action=quick-learnings]');state.user={...state.user};window.retiredLiving.click();});
      assert.equal(await p.evaluate(()=>state.activeView),'home'); await ready(p);
      for (const status of ['loading','error']) {
        await p.evaluate(status=>{state.workspaceCatalog.status=status;refreshDashboardIfVisible();},status);
        assert.equal(await p.locator('.home-living').count(),0); assert(!(await home(p).innerText()).includes('Autumn Launch'));
      }
      await p.evaluate(()=>{state.user=null;refreshDashboardIfVisible();});
      assert((await home(p).innerText()).includes('Sign in')); assert(!(await home(p).innerText()).includes('Canvas Brand X')); await f.close();
      const root = await fixture({root:true}), q=root.page; await q.locator('#home-workspace-select').selectOption(W);
      assert.equal(await action(q,'quick-brain').getAttribute('aria-disabled'),'true'); assert.equal(await action(q,'stage-brain').count(),0); await root.close();
    });
    await check('forged/stale hero and quick actions reject changed Board generation, loading and lost access', async () => {
      const f = await fixture(), p=f.page; await ready(p);
      for (const key of ['stage-brain','quick-brain','quick-insights','quick-learnings','quick-responsibilities','living-board']) {
        await p.evaluate(key=>{const b=document.querySelector('[data-home-action="'+key+'"]');const forged=b.cloneNode(true);b.replaceWith(forged);forged.click();},key);
        assert.equal(await p.evaluate(()=>state.activeView),'home'); await refresh(p);
      }
      await p.evaluate(()=>{state.boardLoadGeneration++;document.querySelector('[data-home-action=stage-brain]').click();});
      assert.equal(await p.evaluate(()=>state.activeView),'home');
      await p.evaluate(()=>{state.isBoardLoading=true;refreshDashboardIfVisible();});
      assert.equal(await action(p,'stage-brain').count(),0); assert.equal(await action(p,'quick-insights').getAttribute('aria-disabled'),'true');
      await f.close();
    });
    await check('repeated render introduces no additional reads, writes or Canvas changes after the selected canonical read', async () => {
      const f = await fixture(), p=f.page; await ready(p); await p.locator('.home-living-continue time').waitFor(); await p.locator('[data-avatar-state=ready]').waitFor(); const before=await snapshot(p);
      const requests=f.requests.filter(x=>!x.path.includes('/presence/'));
      for(let i=0;i<4;i++) await refresh(p);
      assert.deepEqual(f.requests.filter(x=>!x.path.includes('/presence/')),requests); assert.equal(await snapshot(p),before);
      assert.equal(f.requests.filter(x=>/^\/api\/brands\/[^/]+$/.test(x.path)).length,1);
      assert.equal(f.requests.filter(x=>x.path==='/api/boards/'+D).length,1,'No hero Board hydration'); await f.close();
    });
    await check('Chromium Light reference matrix, Dark/system readability, geometry, keyboard, reduced motion and fixed-control clearance', async () => {
      const f=await fixture(), p=f.page; await ready(p);
      for (const [width,height,theme,language,collapsed] of [
        [1600,900,'light','en',true],[1440,900,'light','en',true],[1280,800,'light','en',false],[1024,768,'light','en',false],
        [375,812,'light','en',true],[320,740,'light','de',false],[1440,900,'dark','de',false],[1440,900,'system','en',true],
        [375,812,'system','de',false]]) {
        await p.setViewportSize({width,height}); await p.emulateMedia({colorScheme:theme==='system'?(width===375?'dark':'light'):theme,reducedMotion:'reduce'});
        await p.evaluate(({theme,language,collapsed})=>{FunklixTheme.setPreference(theme);setSidebarCollapsed(collapsed);state.uiLanguage=FunklixLanguage.setUiLanguage(language);refreshDashboardIfVisible();},{theme,language,collapsed});
        await p.locator('.home-hero').evaluate(e=>e.scrollIntoView({block:'start'}));
        const g=await p.evaluate(()=>{
          const rect=s=>{const r=document.querySelector(s).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
          const h=document.querySelector('#home-foundation');
          return {orientation:rect('.home-hero'),living:rect('.home-living'),stage:rect('.home-avatar-stage'),slot:rect('.home-avatar-slot'),
            bubble:rect('.home-avatar-bubble'),continue:rect('.home-living-continue'),quick:rect('.home-quick-actions'),details:rect('.home-details-heading'),
            scrollViewport:rect('#dashboard-view'),documentWidth:document.documentElement.scrollWidth,homeWidth:h.scrollWidth,
            wide:[...h.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().left < -1||e.getBoundingClientRect().right>innerWidth+1).map(e=>e.className)};
        });
        assert.equal(g.documentWidth,width); assert.deepEqual(g.wide,[]); assert(g.homeWidth<=g.living.width+1);
        assert(g.details.y>=g.living.bottom+24); assert(g.bubble.bottom<=g.slot.y+3);
        if(width>=1440){assert(g.stage.x>g.continue.right);assert(g.quick.bottom<=height+1,JSON.stringify(g));assert(g.slot.width>=250);assert(g.continue.bottom<height);}
        else if(width<=1024) assert(g.stage.y>=g.continue.bottom);
        assert.equal(await p.locator('.home-living h1').innerText(),language==='de'?'Willkommen zurück.':'Welcome back.');
        assert((await p.locator('.home-avatar-message').innerText()).includes(language==='de'?'73 Learning-Vorschläge':'73 Learning proposals'));
        const contrast = await p.evaluate(()=>{
          const canvas=document.createElement('canvas'), ctx=canvas.getContext('2d');
          const luminance=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const rgb=[...ctx.getImageData(0,0,1,1).data].slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
          const ratio=(a,b)=>{a=luminance(a);b=luminance(b);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
          const dark=document.documentElement.dataset.theme==='dark';
          return ['.home-avatar-placeholder-note','.home-avatar-bubble','.home-quick-copy > span','[data-home-action=stage-brain]','[data-home-action=living-board]'].map(selector=>{
            const e=document.querySelector(selector),s=getComputedStyle(e);
            const background=selector.includes('home-avatar-placeholder')?(dark?getComputedStyle(e.parentElement).backgroundColor:'#e4dcff'):
              selector.includes('home-quick')?getComputedStyle(e.closest('button')).backgroundColor:s.backgroundColor;
            return {selector,ratio:ratio(s.color,background)};
          });
        });
        assert(contrast.every(c=>c.ratio>=4.5),JSON.stringify(contrast)); g.contrast=contrast;
        const file=`living-${width}-${theme}-${language}.png`; await p.screenshot({path:path.join(out,file)});
        if(width<=375 && theme==='light') {
          await p.locator('.home-avatar-stage').evaluate(e=>e.scrollIntoView({block:'start'}));
          await p.screenshot({path:path.join(out,`stage-${width}-${language}.png`)});
        }
        if(width===1440 && theme!=='system') {
          await p.locator('.home-details-heading').evaluate(e=>e.scrollIntoView({block:'start'}));
          await p.screenshot({path:path.join(out,`details-${theme}-${language}.png`)});
        }
        const control=action(p,'quick-insights'); await control.focus(); await refresh(p);
        assert.equal(await p.evaluate(()=>document.activeElement?.dataset.homeAction),'quick-insights');
        assert.equal(await p.evaluate(()=>getComputedStyle(document.querySelector('#home-foundation [data-home-action="quick-insights"]')).outlineWidth),'3px');
        for(const selector of ['[data-home-action=quick-insights]', '.home-brand-card button']) {
          const result = await p.evaluate(selector => {
            const targets = [...document.querySelectorAll('#home-foundation ' + selector)], e = targets.at(-1);
            e.focus(); e.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
            const a = e.getBoundingClientRect();
            return { focused: document.activeElement === e, covered: [...document.querySelectorAll('.sidebar,.sidebar > .workspace-context')].filter(x=>getComputedStyle(x).position==='fixed').some(x=>{const b=x.getBoundingClientRect();return a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}) };
          }, selector);
          assert.deepEqual(result, { focused: true, covered: false }, 'Fixed shell covers focus');
        }

        if(width<768)assert(await p.locator('#dashboard-view').evaluate(e=>{const d=e.getBoundingClientRect();return [...document.querySelectorAll('.sidebar,.sidebar > .workspace-context')].filter(x=>getComputedStyle(x).position==='fixed').every(x=>d.bottom<=x.getBoundingClientRect().top); }));
        const targets=await home(p).locator('button,select').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect().height));
        assert(targets.every(h=>h>=44)); geometry.push({width,height,theme,language,collapsed,file,...g});
      }
      await p.setViewportSize({width:320,height:740}); await p.evaluate(()=>{state.workspaceCatalog.value=structuredClone(state.workspaceCatalog.value);const w=state.workspaceCatalog.value.workspaces[0];w.name='Langer Workspace '.repeat(8);w.brands[0].name='Langer Markenname '.repeat(8);w.boards[0].name='Langer Kampagnenname '.repeat(8);document.documentElement.style.fontSize='200%';refreshDashboardIfVisible();});
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth),320);
      await p.emulateMedia({forcedColors:'active'}); await action(p,'quick-brain').focus();
      assert.equal(await action(p,'quick-brain').evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
      await f.close();
    });
    fs.writeFileSync(path.join(out,'geometry.json'),JSON.stringify(geometry,null,2));
    fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify({passed,groups},null,2)); console.log(`${passed} BW-36.22B1 groups passed`);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e); if (process.env.GITHUB_ACTIONS === 'true') console.error('::error title=B1 Living Workspace regression::' + String(e.stack || e).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')); process.exitCode = 1;});
