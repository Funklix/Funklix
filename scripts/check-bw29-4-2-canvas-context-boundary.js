'use strict';
const assert=require('assert');
const legacyCanvas=require('../api/_ai-brain-canvas-context');
const contract=require('../api/_funnel-simulator-contract');
const client=require('../persona-journey-simulator');

const selected={id:'idea-1',type:'Idea',title:'Launch idea',content:'A complete launch message.',funnelStage:'Awareness'};
const displayOnlySocial={id:'social-legacy',type:'Social Media Posting',title:'Legacy post',content:'Post copy',funnelStage:'Awareness',social:{platform:'LinkedIn',caption:'Post copy',hashtags:'#Launch, #Brand'}};
const rejected=legacyCanvas.validateCanvasContext({nodes:[selected,displayOnlySocial],edges:[]},null);
assert.deepStrictEqual({ok:rejected.ok,status:rejected.status,classification:rejected.classification,detail:rejected.detail},{ok:false,status:400,classification:'unsupported_canvas',detail:'hashtags_shape'},'the deployed full-Canvas boundary rejects a legacy string-valued display hashtag projection');

const group=contract.projectTargetGroups({personas:[{name:'Creators',description:'Independent creators'}]})[0];
const current={language:'en',boardId:'board-1',savedState:'saved',canvasContext:{nodes:[selected,displayOnlySocial],edges:[]}};
const selection={groups:[group.source_id],stages:[{stage:'Awareness',mode:'assets'},{stage:'Interest',mode:'explicit_gap'}],assets:{Awareness:['idea-1']}};
const body=client.buildRequest(current,selection,'ABC123');
assert.strictEqual(body.version,'persona_journey_run_v2');
assert.strictEqual(body.canvas_state,'saved');
assert.ok(!Object.hasOwn(body,'canvas_context')&&!Object.hasOwn(body,'unsaved_context'),'saved requests contain references, not a Canvas snapshot');
assert.ok(!JSON.stringify(body).includes('hashtags')&&!JSON.stringify(body).includes('social-legacy'),'unselected/display-only Canvas data cannot cross the v2 boundary');
const validated=contract.validateRequest(body);assert.ok(validated.ok,'minimal saved request is valid');
const unsavedBody=client.buildRequest({...current,savedState:'unsaved'},selection,'ABC124');
assert.ok(contract.validateRequest(unsavedBody).ok,'dedicated bounded unsaved request is valid');
assert.deepStrictEqual(unsavedBody.unsaved_context.nodes.map(node=>node.id),['idea-1'],'unsaved context contains selected nodes only');
assert.ok(!JSON.stringify(unsavedBody).includes('edges')&&!JSON.stringify(unsavedBody).includes('social-legacy'),'unsaved context excludes edges and unrelated nodes');

(async()=>{
  const authPath=require.resolve('../api/_auth-session'),accessPath=require.resolve('../api/_board-access');
  const oldAuth=require.cache[authPath],oldAccess=require.cache[accessPath],oldKey=process.env.OPENAI_API_KEY;
  require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{getSessionUser:()=>({email:'editor@example.com'})}};
  require.cache[accessPath]={id:accessPath,filename:accessPath,loaded:true,exports:{getBoardAccess:async()=>({board:{id:'board-1',name:'Board',updated_at:'1',brand_core_snapshot:{personas:[{name:'Creators',description:'Independent creators'}]},canvas_json:{nodes:[selected,displayOnlySocial],edges:[]}},access:{canEdit:true,publicView:false}})}};
  delete process.env.OPENAI_API_KEY;delete require.cache[require.resolve('../api/funnel-simulator/run')];const handler=require('../api/funnel-simulator/run');
  let status,payload;try{await handler({method:'POST',headers:{'x-funklix-request-id':'ABC123'},body},{status(value){status=value;return this},json(value){payload=value;return value}})}finally{if(oldKey!==undefined)process.env.OPENAI_API_KEY=oldKey;if(oldAuth)require.cache[authPath]=oldAuth;else delete require.cache[authPath];if(oldAccess)require.cache[accessPath]=oldAccess;else delete require.cache[accessPath]}
  assert.strictEqual(status,503);assert.strictEqual(payload.phase,'configuration_resolved');assert.strictEqual(payload.classification,'provider_unavailable');
  console.log('BW-29.4.2 Canvas-context boundary checks passed (exact legacy rejection reproduced; saved v2 context resolved).');
})().catch(error=>{console.error(error);process.exitCode=1});
