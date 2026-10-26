'use strict';
// Fictional data, actual destination/controller and protected owner handlers.
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const { chromium } = require('playwright-core');
const { runtime } = require('./fixtures/bw36-23-brand-knowledge-runtime');
const app = fs.readFileSync('app.js', 'utf8');
const answer = 'Proposed Value Proposition: Independent makers explore new formats together, with room for their own creative choices.';
const german = 'Vorgeschlagenes Nutzenversprechen: Kreative erkunden gemeinsam neue Formate und behalten Raum für eigene Entscheidungen.';
const question = 'Suggest a replacement Value Proposition for the Brand Profile';

// Exact live Appics DEMO 2 reproduction; reason bodies were supplied as ellipses.
const appicsQuestion = 'Please suggest one specific replacement for our current Brand Value Proposition, using the approved positioning and audience information. Give me the exact proposed wording and briefly explain why it would be stronger.';
const appicsValue = 'Unlock your creativity and earn real rewards on a decentralized platform that values your unique voice. With Appics, you can share your passions freely and transform social media into a source of income, empowering you to thrive in a community that celebrates individuality and creativity.';
const appicsAnswer = `**Proposed Brand Value Proposition:**

"${appicsValue}"

**Reasons for Strength:**

1. **Emphasis on Empowerment:** ...
2. **Focus on Individuality:** ...
3. **Clarity on Benefits:** ...`;

const appicsNaturalAnswer = `**Proposed Brand Value Proposition:**

“${appicsValue}”

**Reasons for Strength:**

1. **Emphasis on Empowerment:** Appics connects creative expression with tangible rewards.
   People can share the passions that matter to them.

2) **Focus on Individuality:** The wording emphasizes a distinctive voice and a supportive community.
   It connects the audience benefit to the platform positioning.

3. **Clarity on Benefits:** The proposal describes both expression and rewards.

Overall, this makes the audience benefit easier to understand.`;

// Verbatim failing reply supplied during R2. Explanation is separate from the
// candidate even without a blank separator, and quotes in reasons are not values.
const appicsReportedValue = 'Transform Your Passion into Profit: Join APPICS to Monetize Your Creativity in a Decentralized Community.';
const appicsReportedAnswer = `Proposed Value Proposition:
"${appicsReportedValue}"
Explanation:
This proposed wording enhances the original value proposition by emphasizing not just the earning potential but also the personal connection to creativity. It incorporates the following strengths:
1. Emotional Connection: The phrase "Transform Your Passion" resonates with the target audience of content creators, making the offering feel personal and aspirational.
2. Clear Call to Action: Using “Join APPICS” actively invites the audience to participate, creating a sense of belonging and community.
3. Decentralization Highlight: Explicitly stating "in a Decentralized Community" reinforces the unique selling point of APPICS compared to traditional social media platforms, emphasizing user empowerment and community engagement.
This adjustment aligns well with the brand's focus on empowerment, creativity, and the decentralized nature of the platform, making it more compelling to the audience.`;

function eligibility() {
  const c = {}; vm.runInNewContext(app.slice(app.indexOf('function aiBrainValueProposition'), app.indexOf('function aiBrainBrandSourceCurrent')), c);
  const select = (text, q = appicsQuestion) => c.aiBrainValueProposition({status:'success',question:q,answer:text});
  assert.equal(select(appicsReportedAnswer)?.value, appicsReportedValue);
  assert.equal(select(appicsReportedAnswer)?.excerpt, appicsReportedAnswer);
  assert.equal(select(appicsReportedAnswer.replace(/\n2\./, '\n2)').replace(/\n/g,'\r\n'))?.value, appicsReportedValue);
  for (const extra of ['Proposed Value Proposition: Another choice.', 'Mission: Another field.', 'Alternative wording: Another choice.', '"A second possible replacement."', '2) "A second possible replacement."']) {
    assert.equal(select(appicsReportedAnswer+'\n'+extra),null,extra);
  }
  assert.equal(select(appicsReportedAnswer.replace('"'+appicsReportedValue+'"\n','')),null);
  assert.equal(select(appicsAnswer)?.value, appicsValue);
  assert.equal(select(appicsNaturalAnswer)?.value, appicsValue);
  assert.equal(select(appicsNaturalAnswer)?.excerpt, appicsNaturalAnswer);
  const naturalGerman = '**Vorgeschlagenes neues Nutzenversprechen:**\n\n„Kreative teilen ihre Ideen in einer Gemeinschaft, die ihre eigene Stimme schätzt.“\n\n**Gründe für die Stärke:**\n\n1. **Klarheit:** Der Nutzen steht im Mittelpunkt.\n   Die Zielgruppe wird direkt angesprochen.\n\n2) **Gemeinschaft:** Eigene Ideen bleiben erkennbar.\n\n3. **Fokus:** Die Formulierung bleibt verständlich.\n\nInsgesamt, wird der Nutzen deutlicher.';
  assert.equal(select(naturalGerman)?.value, 'Kreative teilen ihre Ideen in einer Gemeinschaft, die ihre eigene Stimme schätzt.');
  assert.equal(select('Vorgeschlagenes Nutzenversprechen:\n„Kreative teilen ihre Ideen gemeinsam.“\nErklärung:\nDiese Formulierung stärkt den Nutzen.\n1. Klarheit: Die Aussage „Ideen gemeinsam“ spricht die Zielgruppe an.\n2) Gemeinschaft: Die eigene Stimme bleibt sichtbar.\nDie Formulierung passt zur Marke.')?.value,'Kreative teilen ihre Ideen gemeinsam.');
  assert.equal(select(appicsNaturalAnswer.replace('2)', '4)')), null);
  assert.equal(select(appicsNaturalAnswer + '\nMission: A different field.'), null);
  assert.equal(select(appicsNaturalAnswer + '\nSuggested Brand Value Proposition: Another value.'), null);
  assert.equal(select(appicsAnswer)?.path, '/brand_core/valueProposition');
  assert.equal(select(appicsAnswer)?.excerpt, appicsAnswer);
  for (const label of ['Proposed Value Proposition', 'Proposed replacement Value Proposition', 'Suggested Value Proposition', 'Proposed Brand Value Proposition', 'Proposed replacement Brand Value Proposition', 'Suggested Brand Value Proposition', 'Vorgeschlagenes Nutzenversprechen', 'Vorgeschlagenes neues Nutzenversprechen']) {
    for (const heading of [label + ':', `**${label}:**`, `**${label}**:`]) {
      for (const quoted of [appicsValue, `"${appicsValue}"`, `“${appicsValue}”`, `„${appicsValue}“`]) {
        for (const gap of [' ', '\n', '\n\n']) assert.equal(select(heading + gap + quoted)?.value, appicsValue);
      }
    }
  }
  for (const suffix of ['Rationale: Clearer audience benefit.', 'Begründung: Klarer Nutzen.', 'Assumption: Audience priorities stay the same.', 'Annahme: Die Zielgruppe bleibt gleich.']) {
    assert.equal(select(answer + '\n\n' + suffix)?.value, answer.split(': ')[1]);
  }
  assert.equal(select(appicsAnswer.replace(/\n/g, '\r\n'))?.value, appicsValue);
  assert.equal(select('**Vorgeschlagenes Nutzenversprechen:**\n\n„Kreative entdecken gemeinsam neue Möglichkeiten.“\n\n**Gründe für die Stärke:**\n\n1. **Klarheit:** Direkter Nutzen.')?.value, 'Kreative entdecken gemeinsam neue Möglichkeiten.');
  for (const text of [
    appicsAnswer + '\n\nProposed Value Proposition: Another choice.',
    appicsAnswer.replace('2. **Focus on Individuality:** ...', '2. **Proposed Brand Value Proposition:** A competing proposal.'),
    appicsAnswer.replace('2. **Focus on Individuality:** ...', '2. Brand DNA: Unrelated field.'),
    appicsAnswer.replace('2. **Focus on Individuality:** ...', '2. Option B: Another proposal.'),
    appicsAnswer.replace('2. **Focus on Individuality:** ...', '2. "Another proposal."'),
    appicsAnswer.replace('**Reasons for Strength:**', '**Other suggestions:**'),
    appicsAnswer.replace('**Proposed Brand Value Proposition:**', '**Proposed Brand Value Proposition:'),
    appicsAnswer.replace(`"${appicsValue}"`, `"${appicsValue}`),
    appicsAnswer.replace(`"${appicsValue}"`, `"${appicsValue}" or "Another choice."`),
    appicsAnswer.replace(`"${appicsValue}"`, 'Guaranteed proven growth of 50 percent.'),
    appicsAnswer.replace(`"${appicsValue}"`, 'Maybe this could work?'),
    'Strategy discussion: ' + appicsValue,
    ...['\"\"','\" \"','“ ”','„ “'].map(value=>'Proposed Brand Value Proposition: '+value),
    'Proposed Brand Value Proposition: Brand DNA: Creator',
    'Proposed Brand Value Proposition: Option A: One choice. Option B: Another choice.',
    '**Proposed Brand Value Proposition:**\n\n' + appicsValue + '\nA second paragraph.',
    'Proposed Brand Value Proposition: A clear choice.\n\nRationale: Suggested Brand Value Proposition: A different choice.'
  ]) assert.equal(select(text), null, text);
  // An explanation cannot stand in for missing proposed wording (Codex P2).
  for (const explanation of ['Rationale: Clearer audience benefit.', 'Begründung: Klarer Nutzen.', 'Assumption: Audience priorities stay the same.', 'Annahme: Die Zielgruppe bleibt gleich.', 'Reasons for Strength:', 'Gründe für die Stärke:', 'Explanation:', 'Erklärung:', 'Erläuterung:']) {
    for (const label of ['Proposed Value Proposition:', '**Proposed Brand Value Proposition:**', 'Vorgeschlagenes Nutzenversprechen:']) {
      for (const gap of [' ', '\n', '\n\n']) assert.equal(select(label + gap + explanation),null,'Missing value before '+explanation);
    }
  }
  assert.equal(select(appicsAnswer, 'Discuss our audience and brand strategy'), null);
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
    const f=runtime();
    // Recreate the actual session with each canonical representation.
    const profile=require('../brand-profile-setup'), brand=f.brand;
    // Existing URL representation and legacy website placement are not AI intent.
    if(old===null)brand.brand_core.brandAssets={domain:'https://example.test',future:'retained'};
    if(old==='')brand.brand_core.website='https://legacy.example.test';
    if(old!==undefined)brand.brand_core.valueProposition=old;
    let stored=structuredClone(brand),puts=[];
    const session=profile.createSession({brand,getContext:()=>f.context,validateBrand:b=>b?.id===brand.id,onSave(){},fetchImpl:async(url,init={})=>{
      if(init.method==='PUT'){const cmd=JSON.parse(init.body);puts.push(cmd);stored={...stored,...require('../brand-write-contract').apply(stored,cmd),revision:2};}
      return {ok:true,status:200,json:async()=>structuredClone(stored)};
    }});
    const beforeCore=structuredClone(brand.brand_core);delete beforeCore.valueProposition;
    const proposal={...input(f),expected:old===undefined?{exists:false}:{exists:true,value:old}};
    if(typeof old==='string'&&old.trim())assert.equal(await session.stageValueProposition({...proposal,value:old}),false);
    assert(await session.stageValueProposition(proposal));assert.equal(puts.length,0);assert(session.contentDirty());assert.equal(session.state.brand.revision,1);
    assert.equal(await session.stageValueProposition(proposal),false,'Cannot silently stage twice over a draft');
    assert(await session.save());assert.equal(puts.length,1);assert.equal(puts[0].operation,'profile_edit');assert.equal(puts[0].contract,'canonical-brand-write/v1');assert.equal(puts[0].expected_revision,'1');
    assert.deepEqual(puts[0].changes,[{path:proposal.path,action:old===undefined?'add':'replace',expected:proposal.expected,value:proposal.value}]);assert(!Object.hasOwn(puts[0],'source'));
    const core=structuredClone(stored.brand_core);delete core.valueProposition;assert.deepEqual(core,beforeCore);assert(!session.contentDirty());
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
function prepareAppicsBoard(r) {
  const template = r.db.boards[0].canvas_json.nodes[0];
  r.db.boards[0].name = 'Appics DEMO 2';
  r.db.boards[0].canvas_json.nodes = Array.from({length:36}, (_,i)=>({...structuredClone(template), id:'appics-'+i, title:'Appics idea '+i}));
  r.db.brands[0].owner_email = 'independent-owner@example.test';
  r.db.brandRole = 'editor';
  r.db.brands[0].brand_core.valueProposition = 'A place for creators to share their passions.';
}
async function catalogLifecycle() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({prepare:prepareAppicsBoard}),p=f.page;
    // Execute the production catalog SQL/ACL/projection against real SQL, then
    // pass that response through the actual browser loader and renderer.
    const {PGlite}=require('@electric-sql/pglite');
    const {loadWorkspaceCatalog}=require('../api/_workspace-catalog');
    const {W,B,D,EMAIL}=require('./fixtures/bw36-13r5-local-runtime');
    const pg=new PGlite();
    await pg.exec(`CREATE TABLE workspaces(id uuid,name text,avatar_url text,locale text,revision bigint,status text);
      CREATE TABLE workspace_memberships(workspace_id uuid,identity_id uuid,role text,status text);
      CREATE TABLE brands(id uuid,workspace_id uuid,name text,revision bigint,owner_email text,logo_object_path text,logo_mime_type text,logo_source text,logo_revision bigint);
      CREATE TABLE brand_members(brand_id uuid,email text,role text);
      CREATE TABLE boards(id uuid,workspace_id uuid,brand_id uuid,name text,owner_email text);
      CREATE TABLE board_editors(board_id uuid,email text,role text);`);
    const I='44444444-4444-4444-8444-444444444444';
    await pg.query("INSERT INTO workspaces VALUES ($1,'Appics Workspace',null,'en',1,'active')",[W]);
    await pg.query("INSERT INTO workspace_memberships VALUES ($1,$2,'owner','accepted')",[W,I]);
    await pg.query("INSERT INTO brands VALUES ($1,$2,'Appics',1,'independent-owner@example.test',null,null,null,0)",[B,W]);
    await pg.query("INSERT INTO boards VALUES ($1,$2,$3,'Appics DEMO 2',$4)",[D,W,B,EMAIL]);
    await pg.query("INSERT INTO brand_members VALUES ($1,$2,'editor')",[B,EMAIL]);
    const project = async role => {
      await pg.query('UPDATE brand_members SET role=$1',[role]);
      return {contract:'workspace_catalog_v1',request_id:f.c.request_id,
        workspaces:await loadWorkspaceCatalog({db:pg,identityId:I,canonicalEmail:EMAIL})};
    };
    let release, held, role='editor', calls=0;
    await p.route('**/api/workspaces',async route=>{if(held)await held;return route.fulfill({json:await project(role)});});
    await p.route('**/api/ai-brain/advice',route=>{calls++;return route.fulfill({json:{answer:appicsNaturalAnswer,context:{response_language:'en',canvasNodes:36},disclaimer:'Proposal only.'}});});
    await p.evaluate(()=>setActiveView('ai_brain'));
    const submit = async () => {await p.locator('#ai-brain-question').fill(appicsQuestion);await p.locator('#ai-brain-form [type=submit]').click();await p.waitForFunction(()=>state.aiBrain.status==='success');};
    for(const initial of [false,true]) {
      held=new Promise(r=>release=r);
      await p.evaluate(initial=>{invalidateAiBrainRequest();if(initial)clearWorkspaceCatalog();void retryWorkspaceCatalog();},initial);
      await submit();
      assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0,'Pending metadata cannot authorize an action');
      assert(await p.evaluate(()=>!!aiBrainValueProposition(state.aiBrain.messages.at(-1))),'Content is independently eligible');
      await p.locator('#ai-brain-question').fill('Preserve a newer question');
      release();held=null;
      await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
      await p.waitForSelector('[data-ai-brand-proposal]');
      assert.equal(await p.locator('[data-ai-brand-proposal]').innerText(),'Suggest Brand Update');
      if (process.env.BW37_C1_EVIDENCE_DIR && initial) {
        const dir=process.env.BW37_C1_EVIDENCE_DIR;fs.mkdirSync(dir,{recursive:true});
        await p.locator('[data-ai-brand-proposal]').scrollIntoViewIfNeeded();
        await p.screenshot({path:dir+'/appics-36-nodes-action.png',fullPage:true});
        fs.writeFileSync(dir+'/appics-render-evidence.json',JSON.stringify(await p.evaluate(()=>({
          nodes:state.nodes.length,board:state.currentBoardName,catalogStatus:state.workspaceCatalog.status,
          brandRole:state.workspaceCatalog.value.workspaces[0].brands[0].role,
          candidate:aiBrainValueProposition(state.aiBrain.messages.at(-1)).value,
          sourceCurrent:aiBrainBrandSourceCurrent(state.aiBrain.messages.at(-1)),
          button:document.querySelector('[data-ai-brand-proposal]').textContent
        })),null,2));
      }
      assert.equal(await p.locator('#ai-brain-question').inputValue(),'Preserve a newer question');
      await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
      assert.equal(await p.locator('#ai-brand-proposal-value').inputValue(),appicsValue);
      await p.keyboard.press('Escape');
    }
    let adviceRelease;
    const adviceHeld=new Promise(r=>adviceRelease=r);
    const slowAdvice=async route=>{calls++;await adviceHeld;return route.fulfill({json:{answer:appicsAnswer,context:{response_language:'en'},disclaimer:'Proposal only.'}});};
    await p.route('**/api/ai-brain/advice',slowAdvice);
    held=new Promise(r=>release=r);
    await p.evaluate(()=>{invalidateAiBrainRequest();clearWorkspaceCatalog();void retryWorkspaceCatalog();});
    await p.locator('#ai-brain-question').fill(appicsQuestion);await p.locator('#ai-brain-form [type=submit]').click();
    release();held=null;await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
    assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    adviceRelease();await p.waitForSelector('[data-ai-brand-proposal]');
    await p.unroute('**/api/ai-brain/advice',slowAdvice);
    // A newer refresh must not rebase a previously captured successful source.
    await p.evaluate(()=>{void retryWorkspaceCatalog();});
    await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
    assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    for(const denied of [null,'viewer']) {
      role=denied;held=new Promise(r=>release=r);
      await p.evaluate(()=>{invalidateAiBrainRequest();void retryWorkspaceCatalog();});await submit();release();held=null;
      await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
      assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0,'Missing/viewer Brand authority fails closed');
      assert.equal(await p.locator('[data-ai-brand-current]').count(),0);
    }
    // A Board association change during loading cannot acquire a new target.
    role='editor';held=new Promise(r=>release=r);
    await p.evaluate(()=>{invalidateAiBrainRequest();void retryWorkspaceCatalog();});await submit();
    await p.evaluate(()=>{state.boardBrandAssociation.brandId=null;});release();held=null;
    await p.waitForFunction(()=>state.workspaceCatalog.status==='ready');
    assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    assert.equal(calls,6);assert.equal(f.writes.length,0);assert.deepEqual(f.errors,[]);await pg.close();
    console.log('PASS 36-node Appics editor: production catalog SQL/ACL/projection/load/render, late refresh and first-load action visible automatically; pending/absent/viewer/stale generation/changed association hidden; composer retained; zero writes/extra inference');
  } finally {await browser.close();}
}
async function browserChecks() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const f=await require('./fixtures/home-browser')(browser)({prepare:prepareAppicsBoard}),p=f.page;
    assert.equal(await p.evaluate(()=>state.nodes.length),36);
    assert.equal(await p.evaluate(()=>state.workspaceCatalog.value.workspaces[0].brands[0].role),'editor');
    let calls=0, live=true;
    await p.route('**/api/ai-brain/advice',route=>{calls++;const b=route.request().postDataJSON();return route.fulfill({json:{answer:live?appicsReportedAnswer:b.response_language==='de'?german:answer,context:{response_language:b.response_language},disclaimer:'Proposal only.'}});});
    await p.evaluate(()=>setActiveView('ai_brain'));
    const submit=async()=>{await p.locator('#ai-brain-question').fill(live?appicsQuestion:question);await p.locator('#ai-brain-form [type=submit]').click();await p.waitForSelector('[data-ai-brand-proposal]');};
    await submit();
    for (const role of [null,'viewer']) {
      await p.evaluate(role=>{const catalog=structuredClone(state.workspaceCatalog.value);catalog.workspaces[0].brands.find(b=>b.id===state.boardBrandAssociation.brandId).role=role;state.workspaceCatalog.value=catalog;renderAiBrain();},role);
      assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0,'Board edit alone cannot expose Brand action');
    }
    await p.evaluate(()=>{const catalog=structuredClone(state.workspaceCatalog.value);catalog.workspaces[0].brands.find(b=>b.id===state.boardBrandAssociation.brandId).role='owner';state.workspaceCatalog.value=catalog;renderAiBrain();});
    assert.equal(await p.locator('[data-ai-brand-proposal]').count(),1);
    await p.locator('#ai-brain-question').fill('Keep this new draft');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(2,7,'backward'));
    const before=JSON.stringify(f.r.db.brands),snapshot=await p.evaluate(()=>JSON.stringify(state.brandCore));
    // Sidebar Y must not retarget the Board's canonical Brand X.
    await p.evaluate(()=>{state.session.brandId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';renderAiBrain();});
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    assert((await p.locator('[data-ai-brand-current]').textContent()).includes('Canvas Brand X'));
    assert((await p.locator('[data-ai-brand-current]').textContent()).includes(f.r.db.brands[0].brand_core.valueProposition),'Preview shows the exact independently read canonical value');
    assert.equal(await p.locator('#ai-brand-proposal-value').inputValue(),appicsReportedValue);
    assert(!(await p.locator('#ai-brand-proposal-value').inputValue()).includes('Reasons for Strength'));
    await p.locator('#ai-brand-proposal-value').fill('An edited suggestion with <script>inert text</script>.');
    assert.equal(f.writes.length,0);assert.equal(JSON.stringify(f.r.db.brands),before);assert.equal(calls,1);
    await p.keyboard.press('Escape');assert.equal(await p.locator('#ai-brand-proposal-dialog').count(),0);assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this new draft');
    await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    await p.locator('#ai-brand-proposal-value').fill('An edited proposal for independent makers.');
    await p.locator('[data-ai-brand-stage]').click();await p.waitForSelector('[data-ai-brand-return]');
    assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');assert(await p.evaluate(()=>brandProfileController.contentDirty()));
    assert.equal(await p.evaluate(()=>brandProfileController.state.core.valueProposition),'An edited proposal for independent makers.');
    assert.equal(f.writes.length,0);assert.equal(JSON.stringify(f.r.db.brands),before);assert.equal(calls,1);
    assert(await p.evaluate(()=>brandProfileController.reload()));
    assert(await p.evaluate(()=>brandProfileController.contentDirty()));
    assert.equal(await p.evaluate(()=>state.aiBrain.messages.at(-1).brandProposalInvalid),false,'An unchanged canonical reload must preserve the staged comparison');
    assert.equal(f.writes.length,0);
    await p.locator('[data-ai-brand-return]').click();await p.waitForSelector('#brand-leave-dialog');await p.locator('[data-keep-editing]').click();
    assert.equal(await p.evaluate(()=>state.activeView),'brand-profile');
    await p.locator('[data-profile-key="Confirm and save Brand Profile"]').click();
    await p.waitForFunction(()=>!brandProfileController.contentDirty()&&!brandProfileController.busy());
    assert.equal(f.writes.filter(r=>r.method==='PUT').length,1);
    assert.equal(f.r.db.brands[0].brand_core.valueProposition,'An edited proposal for independent makers.');
    const savedBrands=JSON.parse(before);savedBrands[0].brand_core.valueProposition='An edited proposal for independent makers.';
    assert.deepEqual(f.r.db.brands.map(b=>b.brand_core),savedBrands.map(b=>b.brand_core),'Separate Save changes only the proposed canonical field');
    await p.locator('[data-ai-brand-return]').click();await p.waitForSelector('#ai-brain-question');
    assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this new draft');assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd,n.selectionDirection]),[2,7,'backward']);
    assert.equal(await p.evaluate(()=>JSON.stringify(state.brandCore)),snapshot);assert.equal(calls,1);assert.equal(await p.locator('[data-ai-brand-proposal]').count(),0);
    live=false;
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
      await p.locator('#ai-brain-question').fill('Keep this permission-check draft');await p.locator('#ai-brain-question').evaluate(n=>n.setSelectionRange(2,7,'backward'));
      const denied=route=>route.fulfill({status,json:status===200?{id:'malformed'}:{code:'UNAVAILABLE'}});
      await p.route('**/api/brands/22222222-2222-4222-8222-222222222222',denied);
      await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
      assert.equal(await p.locator('[data-ai-brand-current]').textContent(),'');assert(await p.locator('[data-ai-brand-stage]').isDisabled());
      await p.keyboard.press('Escape');assert.equal(await p.locator('#ai-brain-question').inputValue(),'Keep this permission-check draft');assert.deepEqual(await p.locator('#ai-brain-question').evaluate(n=>[n.selectionStart,n.selectionEnd,n.selectionDirection]),[2,7,'backward']);await p.unroute('**/api/brands/22222222-2222-4222-8222-222222222222',denied);
    }
    for (const role of [null,'viewer']) {
      await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();
      const brand=f.r.db.brands[0],owner=brand.owner_email;brand.owner_email='other@example.test';f.r.db.brandRole=role;
      await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
      assert.equal(await p.locator('[data-ai-brand-current]').textContent(),'');await p.keyboard.press('Escape');brand.owner_email=owner;f.r.db.brandRole='editor';
    }
    await p.evaluate(()=>{invalidateAiBrainRequest();renderAiBrain();});await submit();await p.locator('[data-ai-brand-proposal]').click();await p.waitForFunction(()=>!document.querySelector('[data-ai-brand-stage]')?.disabled);
    f.r.db.brands[0].revision++;f.r.db.brands[0].brand_core.valueProposition='Changed concurrently';
    const writesBefore=f.writes.length;await p.locator('[data-ai-brand-stage]').click();await p.waitForFunction(()=>document.querySelector('#ai-brand-proposal-dialog [role=status]')?.textContent.includes('changed'));
    await p.locator('#ai-brand-proposal-value').fill('A retained edit after the comparison became stale.');assert(await p.locator('[data-ai-brand-stage]').isDisabled(),'Editing cannot revive a stale comparison');
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
(async()=>{eligibility();await controllers();await ownerBoundaries();await catalogLifecycle();await browserChecks();await conversationReturn();})().catch(e=>{console.error(e);process.exitCode=1;});
