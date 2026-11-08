#!/usr/bin/env node
"use strict";
const fs=require("fs"),vm=require("vm"),assert=require("assert");
const source=fs.readFileSync("app.js","utf8");
function functionSource(name){const start=source.indexOf(`function ${name}(`);assert(start>=0,`production function ${name}`);let brace=source.indexOf("{",start),depth=0,quote=null,escape=false;for(let i=brace;i<source.length;i++){const c=source[i];if(quote){if(escape)escape=false;else if(c==="\\")escape=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"){quote=c;continue;}if(c==="{")depth++;if(c==="}"&&--depth===0)return source.slice(start,i+1);}throw Error(`unterminated ${name}`);}
class Element{constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.dataset={};this.style={values:{},setProperty:(k,v)=>this.style.values[k]=v};this.className="";this._text="";this.listeners={};this.classList={toggle:(c,on)=>{const s=new Set(this.className.split(/\s+/).filter(Boolean));on?s.add(c):s.delete(c);this.className=[...s].join(" ");},contains:c=>this.className.split(/\s+/).includes(c)};}append(...xs){xs.filter(Boolean).forEach(x=>this.children.push(x));}appendChild(x){this.append(x);return x;}replaceChildren(...xs){this.children=xs;}set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(x=>x.textContent).join("");}set id(v){this.attributes.id=v;}get id(){return this.attributes.id||"";}setAttribute(k,v){this.attributes[k]=String(v);if(k.startsWith("data-"))this.dataset[k.slice(5).replace(/-([a-z])/g,(_,c)=>c.toUpperCase())]=String(v);}addEventListener(k,fn){this.listeners[k]=fn;}scrollIntoView(){}all(){return [this,...this.children.flatMap(x=>x.all())];}querySelectorAll(sel){if(sel.includes(" ")){const [a,b]=sel.split(/\s+/,2);return this.querySelectorAll(a).flatMap(x=>x.querySelectorAll(b));}return this.all().filter((x,i)=>i&&matches(x,sel));}querySelector(sel){return this.querySelectorAll(sel)[0]||null;}}
function matches(x,sel){if(sel.startsWith("#"))return x.id===sel.slice(1);if(sel.startsWith("."))return x.className.split(/\s+/).includes(sel.slice(1));if(sel.startsWith("[data-finding-id="))return x.dataset.findingId===sel.match(/['"]([^'"]+)/)?.[1];return x.tagName===sel.toUpperCase();}
const document={createElement:t=>new Element(t)};
const fixture=Array.from({length:30},(_,i)=>({id:`node-${i+1}`,type:i%6===0?"Landing Page":i%3===0?"Social Media Posting":"Content",title:i===0?'<img src=x onerror="boom">':`Campaign node ${i+1}`,content:`Safe content ${i}`,audience:i%4?"Executive":"Leader",tone:i%5?"Professional":"Direct",funnelStage:["Awareness","Interest","Consideration","Conversion","Retention"][i%5],social:i%3===0?{platform:i%2?"Instagram":"LinkedIn",preview:i%6?"Learn more":""}:undefined,landingPage:i%6===0?{cta:i?"Start now":"",trust:i%12?"Customer proof":""}:undefined}));
function harness(overrides={}){const cards=new Element("div"),noop=new Element("div");const state={activeView:"board",nodes:fixture.map(n=>structuredClone(n)),edges:[],brandCore:{},currentBoardId:"board-1",currentBoardName:"Runtime Board",boardLoadGeneration:7,boardLoadState:"ready",isBoardLoading:false,isDirty:false,boardAccess:{canView:true,canEdit:true,reason:"member"},user:{email:"editor@example.com"},publicBoardToken:null,uiLanguage:"en",appMode:"campaign",aiBrain:{messages:[]},...overrides};const el={insightsCards:cards,insightsView:noop,aiBrainView:noop,dashboardView:noop,canvas:noop,boardListView:noop,calendarView:noop,boardsLibraryView:noop,brandCoreWorkspace:noop,homeNavButton:noop,campaignCanvasNavButton:noop,boardsNavButton:noop,brandCoreButton:noop,aiBrainNavButton:noop,insightsNavButton:noop,canvasTopbar:noop,inspectorPanel:noop,cycleViewButton:noop};let brainRenders=0;const sandbox={brandProfilePage:null,state,el,document,console,Intl,Date,Set,Map,Object,Array,Number,String,JSON,structuredClone,uiText:s=>state.uiLanguage==="de"?`DE:${s}`:s,renderCompactContextBar(){},renderBrandBoardContextNotice(){},renderAiBrain:()=>brainRenders++,showInsightsFindingOnCanvas(){},askAiBrainAboutFinding(){},renderDashboardHero(){},renderDashboardContinueWorking(){},renderDashboardBrandEvolution(){},renderDashboardSuggestedOpportunities(){},renderDashboardTodaysFocus(){},updateListView(){},renderCalendarView(){},renderBrandCoreTiles(){},renderBrandCoreEditor(){},renderCampaignCanvasFromStateIfNeeded(){}};vm.createContext(sandbox);sandbox.INSIGHTS_SEVERITY_RANK={critical:0,important:1,opportunity:2,information:3};sandbox.INSIGHTS_CATEGORY_RANK={structure:0,funnel:1,strategy:2,content:3};vm.runInContext(["analyzeCampaign","currentInsightsIdentity","currentInsightsCanvasIdentity","buildInsightsFindings","captureInsightsDiagnostic","isCurrentInsightsSnapshot","isValidInsightsDiagnostic","captureInsightsReferenceOrigin","insightsNodeSupportsStage","renderInsightsSurface","calculateInsightsDiagnostic","renderCampaignIntelligence","setActiveView"].map(functionSource).join("\n"),sandbox,{filename:"app.js-production-insights-runtime"});return {sandbox,state,cards,get brainRenders(){return brainRenders;}};}
const byClass=(h,c)=>h.cards.querySelectorAll(`.${c}`),byId=(h,id)=>h.cards.querySelector(`#${id}`);
function render(overrides={}){const h=harness(overrides),before=JSON.stringify(h.state.nodes);assert.doesNotThrow(()=>h.sandbox.setActiveView("insights"));assert.equal(JSON.stringify(h.state.nodes),before,"Canvas is immutable");assert.equal(h.state.isDirty,false,"render does not dirty Canvas");return h;}
let h=render();
assert(byClass(h,"insights-page-header").length&&byId(h,"insights-overview-title"));assert(byClass(h,"insights-readiness")[0].textContent.length>0&&byClass(h,"insights-readiness-ring")[0].textContent.includes("/100"));assert(byClass(h,"insights-attention-list").length);assert(byClass(h,"insights-journey-summary").length&&byClass(h,"insights-channels").length);assert(byId(h,"insights-journey-title")&&byClass(h,"insights-campaign-journey")[0].children.length===5);assert(byId(h,"insights-opportunities-title")&&byClass(h,"insights-finding").length);assert(h.cards.all().some(x=>x.textContent==="Show on Canvas")&&h.cards.all().some(x=>x.textContent==="Ask AI Brain"));assert(byId(h,"canvas-diagnostics-title")&&byClass(h,"insights-diagnostic-group").length===4);assert(byClass(h,"status-strong").length&&byClass(h,"status-needs-attention").length);assert(h.cards.textContent.includes("Good foundation")&&h.cards.textContent.includes("CTA variation"));const details=byClass(h,"insights-collapsed-disclosure");assert.equal(details.length,2);assert(details.every(x=>!x.attributes.open));
const order=["insights-page-header","insights-overview","insights-journey-section","insights-opportunities","insights-diagnostics","insights-disclosure-section"].map(c=>h.cards.all().findIndex(x=>x.className.split(/\s+/).includes(c)));assert(order.every((v,i)=>v>=0&&(!i||v>order[i-1])));assert.equal(h.brainRenders,1,"no transcript turn is created");
// Optional projections and authorization variants.
h=render();h.state.insightsDiagnosticSnapshot.findings=[];h.sandbox.renderInsightsSurface();assert(byClass(h,"insights-attention-empty").length);
h=render();h.state.insightsDiagnosticSnapshot.analysis.platformDistribution.counts={};h.sandbox.renderInsightsSurface();assert(byClass(h,"insights-channel-empty").length);
h=render();h.state.insightsDiagnosticSnapshot.analysis.funnel.coveredStages=["Awareness"];h.sandbox.renderInsightsSurface();assert.equal(byClass(h,"insights-campaign-journey")[0].children.length,5);
h=render();h.state.insightsDiagnosticSnapshot={...h.state.insightsDiagnosticSnapshot,findings:h.state.insightsDiagnosticSnapshot.findings.map(f=>({...f,affectedNodeIds:undefined}))};h.sandbox.renderInsightsSurface();assert(byClass(h,"insights-finding").every(f=>!f.all().some(x=>x.tagName==="BUTTON"&&x.textContent==="Show on Canvas")),"Findings without affected IDs never get navigation actions; Journey sources are independent");
h=render({publicBoardToken:"public",boardAccess:{canView:true,canEdit:false,reason:"public"}});assert(!h.cards.all().some(x=>x.textContent==="Ask AI Brain"));
h=render({uiLanguage:"de"});assert(h.cards.textContent.includes("DE:Executive health overview"));
for(const theme of ["light","dark"]){h=render({resolvedTheme:theme});assert(byClass(h,"insights-boundary").length);}
// Invalid core data yields a complete localized failure surface, never a partial old root.
h=render();h.state.insightsDiagnosticSnapshot.analysis.healthScore=NaN;h.sandbox.renderInsightsSurface();assert(byClass(h,"insights-diagnostic-state").length&&byId(h,"insights-methodology-title"));
// Refresh and Board generation/switch lifecycle remain complete/current.
h=render();h.cards.querySelector(".insights-refresh").listeners.click();assert(byId(h,"insights-methodology-title"));const old=h.state.insightsDiagnosticSnapshot;h.state.currentBoardId="board-2";h.state.boardLoadGeneration++;assert.equal(h.sandbox.isCurrentInsightsSnapshot(old),false);
// Hostile authored strings stay text, not elements.
h=render();assert(h.cards.textContent.includes('<img src=x onerror="boom">')&&!h.cards.querySelector("img"));
// Runtime test itself guards the unchanged avatar implementation contract.
assert(source.includes("captureAiBrainAdvisorIdentity")&&source.includes("createAiBrainAdvisorAvatar(turn.advisorIdentity)")&&source.includes('image.addEventListener("error"'));
// No production side-effect boundary used by this path.
assert(!/fetch\(|saveCampaignCanvasState\(|scheduleAutosave\(|localStorage\.setItem/.test(functionSource("renderInsightsSurface")));
console.log("BW-28.3.1 production Insights runtime rendering checks passed (46 contracts).");

// BW-44 acceptance: preserve the authoritative producers and handoff exactly.
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('analyzeCampaign')).digest('hex'), '628dd9d9f3dcd52bac2d17289ee0c377b7f5b5ade357837b792f011df4bde217', 'BW-45.2 authorizes only canonical derived-stage membership');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('calculateInsightsDiagnostic')).digest('hex'), '4509a8cd6060e198906ac941b680288005d404aa1ec01361676013a52cbaae38', 'BW-44 preserves calculateInsightsDiagnostic byte-for-byte');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('captureInsightsDiagnostic')).digest('hex'), '0875e97f27d160be5d9fec0ca065ed0a28f9cfb67fe8199923b204942a719048', 'BW-44 preserves captureInsightsDiagnostic byte-for-byte');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('currentInsightsIdentity')).digest('hex'), '9bcf9e1dd51cf39f9d677154bbb8dfcb0395256f4efdf27ff1faea6589bedcf0', 'BW-44 preserves currentInsightsIdentity byte-for-byte');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('currentInsightsCanvasIdentity')).digest('hex'), '4c1a2fe9aaf560452e8b1a8317384590262110b14624665454db9038f1f77a45', 'BW-44 preserves currentInsightsCanvasIdentity byte-for-byte');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('buildInsightsFindings')).digest('hex'), '28e1b35c3aaa37c0b7b1751972d7014b01d5ad73372918005476fdfd6f531563', 'BW-45.1 authorizes only the nullish Landing Page CTA fallback');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('isCurrentInsightsSnapshot')).digest('hex'), '02327c0bd1a2b2b62558cb3d6441340823debcb418dbddb5c436a0ae2721f311', 'BW-44 preserves isCurrentInsightsSnapshot byte-for-byte');
assert.equal(require('node:crypto').createHash('sha256').update(functionSource('askAiBrainAboutFinding')).digest('hex'), '628b0d10ef79ff7fd2458fd93d44faed048b09f8b8fbce641fc19532b05859c7', 'BW-44 preserves askAiBrainAboutFinding byte-for-byte');

const minimal = (id, type='Idea', extra={}) => ({id,type,title:'Same title',content:'Fictional',landingPage:{cta:'',trust:''},social:{preview:'',cta:'',platform:'LinkedIn'},...extra});
const contrasts = [
  ['no labels / no eligible CTA or trust node', [minimal('idea')], [60,20,90,90,35,0]],
  ['one audience', [minimal('a','Idea',{audience:'Teams'})], [60,20,90,90,35,0]],
  ['multiple audience / case-only tones', [minimal('a','Idea',{audience:'Teams',tone:'Clear'}),minimal('b','Idea',{audience:'Founders',tone:'clear'}),minimal('c','Idea',{tone:'CLEAR'})], [45,20,55,50,35,0]],
  ['one CTA', [minimal('a','Landing Page',{landingPage:{cta:'Join',trust:''}})], [60,20,90,90,35,100]],
  ['repeated CTA', [minimal('a','Landing Page',{landingPage:{cta:'Join',trust:''}}),minimal('b','Landing Page',{landingPage:{cta:'JOIN',trust:''}})], [60,20,90,90,35,50]],
  ['two CTA values / one populated trust among two', [minimal('a','Landing Page',{landingPage:{cta:'Join',trust:'Fictional evidence'}}),minimal('b','Landing Page',{landingPage:{cta:'Read',trust:''}})], [80,20,90,90,80,100]],
  ['whitespace CTA', [minimal('a','Landing Page',{landingPage:{cta:'   ',trust:''}})], [60,20,90,90,35,100]],
  ['native social CTA only', [minimal('a','Social Media Posting',{social:{cta:'Join',preview:'',platform:'LinkedIn'}})], [60,20,90,90,35,0]],
  ['recognized social preview', [minimal('a','Social Media Posting',{social:{cta:'',preview:'Join',platform:'LinkedIn'}})], [60,20,90,90,35,100]],
  ['custom stage remains unnormalized', [minimal('a','Idea',{funnelStage:'Custom'})], [60,20,90,90,35,0]],
  ['same channel posts', [minimal('a','Social Media Posting',{social:{preview:'Join',platform:'LinkedIn'}}),minimal('b','Social Media Posting',{social:{preview:'Read',platform:'LinkedIn'}})], [70,20,90,90,35,100]]
];
for (const [name,nodes,scores] of contrasts) {
  h=render({nodes});const snapshot=h.state.insightsDiagnosticSnapshot;const before=JSON.stringify(snapshot);
  const analysis=snapshot.analysis;
  assert.deepEqual([analysis.healthScore,analysis.funnel.confidence,analysis.icp.consistencyScore,analysis.tone.consistencyScore,analysis.trust.score,analysis.cta.qualityScore],scores,name);
  h.sandbox.renderInsightsSurface();assert.equal(JSON.stringify(snapshot),before,'Rendering leaves every finding and analysis value unchanged: '+name);
  assert.deepEqual(byClass(h,'insights-finding').map(n=>n.dataset.findingId),Array.from(snapshot.findings,f=>f.code),'Complete engine order: '+name);
  assert(byClass(h,'insights-finding').every(n=>n.querySelector('.insights-observation')&&n.querySelector('.insights-why')&&n.querySelector('.insights-next-step')&&n.querySelector('.insights-verification')),name);
  assert.equal(byClass(h,'insights-calculation').length,6);
  if (!nodes.some(n=>n.type==='Landing Page')) assert(!byClass(h,'insights-finding').find(n=>n.dataset.findingId==='TRUST_PROOF_MISSING').querySelector('.insights-node-reference'));
  const retention=byClass(h,'insights-campaign-journey')[0].children[4];assert.equal(retention.querySelectorAll('.insights-node-reference').length,0,'No fabricated Retention destination');
  if (name.startsWith('no labels')) {assert(h.cards.textContent.includes('No analyzer-recognized CTA values are present.'));assert(!h.cards.textContent.includes('Calls to action are present'));}
  assert(!h.cards.textContent.includes('Most campaign content follows a similar tone'));
}
h=render({nodes:Array.from({length:9},(_,i)=>minimal('id-'+i,'Content',{audience:i%2?'A':'B'}))});
const audience=byClass(h,'insights-finding').find(n=>n.dataset.findingId==='ICP_VARIATION');
assert.equal(audience.querySelectorAll('.insights-node-reference').length,9,'All source IDs remain accessible beyond three-item preview');
assert(audience.querySelector('.insights-more-sources'));
h=render({nodes:[minimal('duplicate','Content',{audience:'A'}),minimal('duplicate','Content',{audience:'B'})]});
assert.equal(byClass(h,'insights-node-reference').length,0,'Duplicate IDs never become destinations');
console.log('PASS BW-44 renderer contrasts, unchanged producer bytes, complete findings/order, actual source fields, no fabricated destinations and no snapshot mutation');

// Checked identity claims never include public local navigation; decoration stays silent.
h=render({publicBoardToken:"public",boardAccess:{canView:true,canEdit:false,reason:"public"}});assert(h.cards.textContent.includes("Public links use local Canvas navigation."));
assert(byClass(h,"insights-severity-icon").every(n=>n.attributes["aria-hidden"]==="true"));

// BW-45.1: absent optional Landing Page CTA restores the full production path.
const ctaScores = a => [a.healthScore,a.funnel.confidence,a.icp.consistencyScore,a.tone.consistencyScore,a.trust.score,a.cta.qualityScore];
const optionalCtas = [
  ['no landingPage object', {}],
  ['null landingPage object', {landingPage:null}],
  ['empty landingPage object', {landingPage:{}}],
  ['missing cta property', {landingPage:{trust:''}}],
  ['undefined cta', {landingPage:{cta:undefined,trust:''}}],
  ['null cta', {landingPage:{cta:null,trust:''}}],
  ['empty cta', {landingPage:{cta:'',trust:''}}],
  ['whitespace cta', {landingPage:{cta:'   ',trust:''}}],
  ['valid cta', {landingPage:{cta:'Join',trust:''}}]
];
for (const [name,fields] of optionalCtas) for (const mixed of [false,true]) {
  const lp={id:'actual-landing-id',type:'Landing Page',title:'Same title',...fields};
  const nodes=mixed ? [lp,minimal('actual-social-id','Social Media Posting',{social:{preview:'Read',cta:'Join',platform:'LinkedIn'}})] : [lp];
  const before=structuredClone(nodes),test=harness({nodes}),calls=[];
  const forbidden=name=>(...args)=>{calls.push(name);throw Error('Unexpected side effect: '+name);};
  for (const boundary of ['fetch','saveCampaignCanvasState','scheduleAutosave','createNode','reviewNode','generateCampaign']) test.sandbox[boundary]=forbidden(boundary);
  test.sandbox.localStorage={setItem:forbidden('localStorage.setItem')};
  test.sandbox.setActiveView('insights');
  const snapshot=test.state.insightsDiagnosticSnapshot;
  assert(snapshot?.analysis,'Available analysis: '+name);
  assert.deepEqual(JSON.parse(JSON.stringify(snapshot.analysis)),JSON.parse(JSON.stringify(test.sandbox.analyzeCampaign(nodes,[],{}))),'Original analyzer result: '+name);
  assert.deepEqual(ctaScores(snapshot.analysis),[mixed && ['valid cta','whitespace cta'].includes(name)?75:mixed?65:60,mixed?40:20,90,90,35,mixed||['whitespace cta','valid cta'].includes(name)?100:0],name);
  const missing=snapshot.findings.find(f=>f.code==='CTA_MISSING');
  if(name==='valid cta') assert.equal(missing,undefined);
  else {assert(missing,name);assert.equal(missing.severity,'important');assert.deepEqual(Array.from(missing.affectedNodeIds),['actual-landing-id']);}
  for(const section of ['insights-overview-title','insights-journey-title','insights-opportunities-title','canvas-diagnostics-title','insights-methodology-title']) assert(byId(test,section),name+': '+section);
  assert.equal(byClass(test,'insights-calculation').length,6);
  const analysisBefore=JSON.stringify(snapshot.analysis);
  test.cards.querySelector('.insights-refresh').listeners.click();
  assert.equal(JSON.stringify(test.state.insightsDiagnosticSnapshot.analysis),analysisBefore,'Refresh parity: '+name);
  assert.deepEqual(nodes,before,'No field is filled, normalized or changed: '+name);
  assert.equal(test.state.isDirty,false);assert.deepEqual(test.state.aiBrain.messages,[]);assert.deepEqual(calls,[]);
}
// Social preview still wins, including whitespace; native fallback is unchanged.
for(const [preview,cta,missing,score] of [['Read','Join',false,100],['   ','Join',true,100],['','Join',false,0],['','',true,0]]) {
  const test=render({nodes:[minimal('social','Social Media Posting',{social:{preview,cta}})]});
  assert.equal(!!test.state.insightsDiagnosticSnapshot.findings.find(f=>f.code==='CTA_MISSING'),missing);
  assert.equal(test.state.insightsDiagnosticSnapshot.analysis.cta.qualityScore,score);
}
// Unrelated malformed values still fail closed; no coercion to positive evidence.
for(const value of [42,{},[],false,0]) {
  const nodes=[minimal('malformed','Landing Page',{landingPage:{cta:value,trust:''}})],before=structuredClone(nodes),test=render({nodes});
  assert.equal(test.state.insightsDiagnosticSnapshot.analysis,null,'Malformed CTA remains unavailable: '+JSON.stringify(value));
  assert(byClass(test,'insights-diagnostic-state').length);assert.deepEqual(nodes,before);
}
const malformedAudience=render({nodes:[minimal('malformed-audience','Idea',{audience:42})]});
assert.equal(malformedAudience.state.insightsDiagnosticSnapshot.analysis,null);
assert.equal(render({nodes:[]}).state.insightsDiagnosticSnapshot,null,'Empty Canvas contract');
console.log('PASS BW-45.1 optional Landing Page CTA, exact IDs, scores, rendering/refresh, immutability, zero side effects, Social precedence and malformed-input controls');

// BW-45.2: run the actual shared analyzer, snapshot, finding builder and renderer.
const canonical = ['Awareness','Interest','Consideration','Conversion','Retention'];
const explicit = stage => minimal('stage-'+stage,'Email Campaign',{funnelStage:stage});
const funnelCases = [
  ['empty',[],[],55],
  ['inferred Idea',[minimal('idea')],['Awareness'],60],
  ['inferred Content',[minimal('content','Content')],['Interest'],60],
  ['inferred Landing Page',[minimal('lp','Landing Page')],['Conversion'],60],
  ['all canonical',canonical.map(explicit),canonical,80],
  ['all plus Custom',[...canonical.map(explicit),explicit('Custom')],canonical,80],
  ['Custom only',[explicit('Custom')],[],55],
  ['repeated',[explicit('Retention'),{...explicit('Retention'),id:'second'}],['Retention'],60],
  ['mixed explicit and inferred',[explicit('Retention'),minimal('content','Content')],['Retention','Interest'],65],
  ['Custom on inferred type',[minimal('idea','Idea',{funnelStage:'Custom'})],['Awareness'],60],
  ['empty and missing',[minimal('idea','Idea',{funnelStage:''}),minimal('content','Content')],['Awareness','Interest'],65],
  ['case and whitespace remain exact',['awareness',' Awareness','Awareness ','RETENTION',' ','custom'].map(explicit),[],55],
  // Existing explicit roles and independent type/goal/CTA roles accumulate.
  ['explicit canonical with inferred type',[minimal('idea','Idea',{funnelStage:'Retention'})],['Retention','Awareness'],65],
  ['Custom with goal',[minimal('goal','Email Campaign',{funnelStage:'Custom',goal:'Conversion'})],['Conversion'],60],
  ['Custom with CTA',[minimal('cta','Email Campaign',{funnelStage:'Custom',landingPage:{cta:'Join',trust:''}})],['Conversion'],60]
];
for (const [name,nodes,expected,readiness] of funnelCases) {
  const test=harness({nodes}), before=structuredClone(nodes), calls=[];
  for(const boundary of ['fetch','saveCampaignCanvasState','scheduleAutosave','createNode','generateCampaign']) test.sandbox[boundary]=()=>{calls.push(boundary);throw Error(boundary);};
  const a=test.sandbox.analyzeCampaign(nodes,[],{}), f=a.funnel;
  assert.deepEqual(Array.from(f.coveredStages),expected,name);
  assert.deepEqual(Array.from(f.missingStages),canonical.filter(s=>!expected.includes(s)),name);
  assert.equal(f.confidence,expected.length*20,name);assert.equal(a.healthScore,readiness,name);
  assert.equal(f.coveredStages.length+f.missingStages.length,5);
  assert.equal(new Set([...f.coveredStages,...f.missingStages]).size,5);
  for(const stage of canonical) assert.equal(nodes.some(n=>!!test.sandbox.insightsNodeSupportsStage(n,stage)),expected.includes(stage),'Journey source consistency: '+name+' / '+stage);
  test.sandbox.setActiveView('insights');
  if(nodes.length) {
    const snapshot=test.state.insightsDiagnosticSnapshot;
    assert.equal(snapshot.canvasState,'loaded_saved');assert.equal(snapshot.analysis.funnel.confidence,f.confidence);
    const finding=snapshot.findings.find(f=>f.code==='FUNNEL_STAGE_GAPS');
    if(expected.length===5) assert.equal(finding,undefined);
    else {
      assert.deepEqual(Array.from(finding.missingElements),canonical.filter(s=>!expected.includes(s)));
      assert.deepEqual(Array.from(finding.currentValues),expected);
      assert.deepEqual(Array.from(finding.affectedNodeIds),[],'Missing stages have no fabricated sources');
      assert.equal(finding.severity,5-expected.length>=3?'important':'opportunity');
      assert.equal(finding.evidence[0],`Covered stages: ${expected.join(', ') || 'none'}.`);
    }
    assert(byClass(test,'insights-journey-summary')[0].textContent.includes(`${expected.length} stages covered · ${5-expected.length} stages missing`));
    const items=byClass(test,'insights-campaign-journey')[0].children;
    canonical.forEach((stage,i)=>assert.equal(items[i].className,expected.includes(stage)?'is-covered':'is-missing'));
    test.state.isDirty=true;test.cards.querySelector('.insights-refresh').listeners.click();
    assert.equal(test.state.insightsDiagnosticSnapshot.canvasState,'live_unsaved');
    assert.deepEqual(test.state.insightsDiagnosticSnapshot.analysis,a);
  }
  assert.deepEqual(nodes,before,name+' preserves every stored field');assert.deepEqual(calls,[]);
}
// Every subset, duplicates and an extra unknown satisfy the partition invariants.
for(let mask=0;mask<32;mask++) {
  const nodes=canonical.filter((_,i)=>mask&(1<<i)).flatMap((stage,i)=>[explicit(stage),{...explicit(stage),id:'duplicate-stage-'+i}]);
  nodes.push(explicit('Custom'));
  const test=harness({nodes}),a=test.sandbox.analyzeCampaign(nodes,[],{}),f=a.funnel;
  assert.equal(f.coveredStages.length+f.missingStages.length,5);assert(f.confidence>=0&&f.confidence<=100);
  assert.equal(new Set(f.coveredStages).size,f.coveredStages.length);
  assert(f.coveredStages.every(s=>canonical.includes(s)&&!f.missingStages.includes(s)));
  const withoutCustom=test.sandbox.analyzeCampaign(nodes.slice(0,-1),[],{});
  assert.deepEqual(a,withoutCustom,'Custom cannot change any valid canonical result');
}
const lifecycle=harness({nodes:[explicit('Custom')]});lifecycle.sandbox.setActiveView('insights');
const stale=lifecycle.state.insightsDiagnosticSnapshot;
lifecycle.state.nodes[0].funnelStage='Retention';lifecycle.state.isDirty=true;
assert.equal(lifecycle.sandbox.isCurrentInsightsSnapshot(stale),false);
lifecycle.cards.querySelector('.insights-refresh').listeners.click();
assert.equal(lifecycle.state.insightsDiagnosticSnapshot.analysis.funnel.confidence,20);
lifecycle.state.currentBoardId='other-board';lifecycle.state.boardLoadGeneration++;lifecycle.state.nodes=canonical.map(explicit);
assert.equal(lifecycle.sandbox.isCurrentInsightsSnapshot(stale),false);
lifecycle.sandbox.calculateInsightsDiagnostic();lifecycle.sandbox.renderInsightsSurface();
assert.equal(lifecycle.state.insightsDiagnosticSnapshot.analysis.funnel.confidence,100);
console.log('PASS BW-45.2 canonical fixtures, all 32 subsets, readiness, findings, Journey/source parity, saved/live, edit/Refresh, Board switch and custom-data preservation');
