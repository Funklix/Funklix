'use strict';
// Shared provider-free Home browser fixture. Default B2 setup is unchanged.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { runtime, W, B, D, EMAIL, clone } = require('./bw36-13r5-local-runtime');
const ROOT = path.resolve(__dirname, '../..'), Y = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', W2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const payload = (id = B, counts = {proposed:73,approved:121}) => ({contract:'brand_learnings_v1',brand:{id},counts,can_write:true,learnings:[],has_more:false,offset:0});
module.exports = browser => {
  async function fixture({viewer=false, hidden=false, noBrand=false, root=false, noWorkspace=false, empty=false, analyzed=false, manyBoards=false}={}) {
    const r=runtime();r.db.boards[0].name='Autumn Launch';
    r.db.brands[0].name='Canvas Brand X';r.db.brands.push({...clone(r.db.brands[0]),id:Y,name:'Selected Brand Y'});
    r.db.boards[0].canvas_json.nodes = [
      ['mine','Idea','Draft',EMAIL],['other','Content','In Review','teammate@example.test'],['changes','Social Media Posting','Needs Changes',EMAIL.toUpperCase()],
      ['approved','Landing Page','Approved',EMAIL],['published','Email Campaign','Published',EMAIL],['unassigned','Idea','Draft',''],['unsupported','Post-it','Draft',EMAIL]
    ].map(([id,type,status,ownerEmail])=>({id,type,status,ownerEmail,title:'Node '+id,content:'Fixture',position:{x:10,y:10},images:[],tags:[],postits:[],variants:[],reactions:{},social:{platform:'',caption:'',hashtags:[]},landingPage:{cta:'',trust:''}}));
    if(empty)r.db.boards[0].canvas_json.nodes=[];
    r.db.boards[0].canvas_json.nodes.push(...(empty?[]:[{...r.db.boards[0].canvas_json.nodes[0],id:'landing',type:'Landing Page',title:'Campaign destination',landingPage:{cta:'',trust:''},audience:'Audience B'}]));
    if (manyBoards) for (let i=1;i<10;i++) r.db.boards.push({...clone(r.db.boards[0]),id:`cccccccc-cccc-4ccc-8ccc-${String(i).padStart(12,'0')}`,name:'Saved campaign '+i,brand_id:i<5?Y:i<8?B:null,updated_at:i===9?null:`2026-10-${String(19-i).padStart(2,'0')}T10:00:00.000Z`});
    const c=r.catalog();c.request_id='0123456789abcdef01234567';
    for(const w of c.workspaces){w.avatar_url=null;w.locale='en';for(const x of [...w.brands,...w.boards])delete x.workspace_id;}
    if(noBrand){r.db.boards[0].brand_id=null;c.workspaces[0].brands=[];c.workspaces[0].boards[0].brand_id=null;}
    if(hidden){c.workspaces[0].brands=c.workspaces[0].brands.filter(b=>b.id!==B);c.workspaces[0].boards[0].brand_id=null;}
    c.workspaces.push({id:W2,name:'Second Workspace',role:'viewer',revision:1,avatar_url:null,locale:'en',brands:[],boards:[]});
    if(noWorkspace)c.workspaces=[];
    const f={r,c,reads:[],writes:[],errors:[],results:new Map([[B,payload()],[Y,payload(Y,{proposed:9,approved:4})]]),status:200,holds:[]};
    const page=await browser.newPage({viewport:{width:1440,height:1100}});f.page=page;page.setDefaultTimeout(15000);
    page.on('pageerror',e=>f.errors.push(e.message));
    await page.route('**/*',async route=>{
      const q=route.request(),u=new URL(q.url()),method=q.method();assert.equal(u.hostname,'localhost','All transport must be local; no providers');
      assert(!(u.pathname.startsWith('/api/') && /\/(?:generate|ai-brain|analytics|learning-advisor)/.test(u.pathname)),'Home must not invoke AI or analytics endpoints: '+u.pathname);
      if(u.pathname.startsWith('/api/')&&method!=='GET'&&!u.pathname.includes('/presence/'))f.writes.push({path:u.pathname,method});
      if(u.pathname==='/api/auth/session')return route.fulfill({json:{user:{email:EMAIL,name:'Alex'}}});
      if(u.pathname==='/api/workspaces')return route.fulfill({json:f.c});
      if(/\/learnings$/.test(u.pathname)){
        assert.equal(method,'GET','Home cannot mutate Learnings');const id=u.pathname.split('/')[3];
        assert.equal(u.search,'?status=all&offset=0','One bounded page, no pagination scan');f.reads.push(id);
        const body=clone(f.results.get(id)),status=f.status,hold=f.holds.shift();
        if(hold){hold.started.resolve();await hold.release.promise;}
        return route.fulfill({status,json:body||{error:{code:'BRAND_UNAVAILABLE'}}}).catch(()=>{});
      }
      if(u.pathname==='/api/boards')return route.fulfill({json:{boards:r.db.boards}});
      if(/\/editors|\/sharing/.test(u.pathname))return route.fulfill({json:{people:[],editors:[]}});
      if(u.pathname==='/api/boards/'+D){if(f.boardHold){const hold=f.boardHold;f.boardHold=null;hold.started.resolve();await hold.release.promise;}assert.equal(method,'GET','Rendering cannot autosave');const board=clone(r.db.boards[0]);board.access={role:viewer?'viewer':'owner',canView:true,canEdit:!viewer,canViewBoardBrandCore:!viewer,canViewPresence:false};if(hidden){board.brand_id=null;board.brand_visibility='hidden';}return route.fulfill({json:board});}
      if(u.pathname.startsWith('/api/brands')){const out=await r.request(method,u.pathname,q.postDataJSON());return route.fulfill({status:out.statusCode,json:out.body});}
      if(u.pathname.startsWith('/api/'))return route.fulfill({json:{members:[],editors:[],viewers:[],boards:[]}});
      const file=path.join(ROOT,u.pathname==='/'||u.pathname.startsWith('/boards/')?'index.html':u.pathname.slice(1));
      return route.fulfill({contentType:file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.png')?'image/png':'application/javascript',body:fs.existsSync(file)?fs.readFileSync(file):''});
    });
    await page.goto('http://localhost'+(root||noWorkspace?'/':'/boards/'+D));
    await page.waitForFunction(()=>state.workspaceCatalog.status==='ready'&&!state.isBoardLoading&&!state.isBoardHydrating&&state.activeView);
    await page.evaluate(()=>{clearAutosaveTimer();stopPresenceLite();stopBoardRefreshPolling();setSidebarCollapsed(false);setActiveView('home');});
    if(analyzed && !root && !noWorkspace) await page.evaluate(()=>{setActiveView('insights');setActiveView('home');});
    if (!root && !noWorkspace && !empty) await page.waitForFunction(()=>homeCampaignInsights()?.status==='ready');
    f.close=async()=>{assert.deepEqual(f.errors,[]);assert.deepEqual(f.writes,[]);await page.close();};
    return f;
  }
  return fixture;
};
