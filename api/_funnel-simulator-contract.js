'use strict';

const STAGES = Object.freeze(['Awareness', 'Interest', 'Consideration', 'Conversion', 'Retention']);
const ELIGIBLE_ROLES = new Set(['Idea', 'Campaign Variation', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign', 'Visual Concept']);
const BANDS = Object.freeze({ very_low: [10, 30], low: [25, 45], moderate: [45, 65], high: [65, 85], very_high: [80, 95] });
const LIMITS = Object.freeze({ groups: 3, personas: 6, personasPerGroup: 2, stages: 5, nodesPerStage: 2, nodes: 8, reactions: 60, bodyBytes: 65536, outputBytes: 98304 });
const REQUEST_VERSION = 'persona_journey_run_v2';
const BODY_KEYS = new Set(['version', 'client_request_id', 'board_id', 'canvas_state', 'target_groups', 'stages', 'gaps', 'stage_assets', 'persona_count', 'response_language', 'unsaved_context']);
const TARGET_KEYS = new Set(['source', 'source_id']);
const ASSET_KEYS = new Set(['stage', 'node_id']);
const UNSAVED_KEYS = new Set(['version', 'nodes']);
const UNSAVED_NODE_KEYS = new Set(['id', 'type', 'stage', 'title', 'content', 'status', 'audience', 'tone', 'cta', 'channel', 'social', 'landingPage']);
const SOCIAL_KEYS = new Set(['caption', 'hashtags', 'platform', 'preview', 'cta']);
const LANDING_KEYS = new Set(['headerClaim', 'problem', 'solution', 'trust', 'cta']);

function plain(value) { return !!value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype; }
function keys(value, allowed) { return plain(value) && Object.keys(value).every((key) => allowed.has(key)); }
function text(value, max, required = false) {
  if (typeof value !== 'string') return required ? null : '';
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if ((required && !clean) || [...clean].length > max) return null;
  return clean;
}
function list(value, maxItems, itemMax) {
  const input = Array.isArray(value) ? value : (typeof value === 'string' ? [value] : []);
  return input.slice(0, maxItems).map((item) => text(item, itemMax, true)).filter(Boolean);
}
function digest(value) { let hash = 2166136261; for (const char of String(value)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619); return (hash >>> 0).toString(16).padStart(8, '0').repeat(2); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (plain(value)) return Object.keys(value).sort().reduce((result, key) => { result[key] = canonical(value[key]); return result; }, {});
  return value === undefined ? null : value;
}
function projectTargetGroups(brandCore, revision = '0') {
  const personas = Array.isArray(brandCore?.personas) ? brandCore.personas : [];
  const projected = [];
  personas.forEach((entry, index) => {
    const source = typeof entry === 'string' ? { name: entry } : entry;
    if (!plain(source)) return;
    const name = text(source.name || source.category, 80, true);
    if (!name) return;
    const description = text(source.description || source.note || '', 500) || '';
    const bounded = { name, description, needs: list(source.needs, 5, 120).sort(), motivations: list(source.motivations, 5, 120).sort() };
    projected.push({ source_id: `board-persona:${digest(JSON.stringify(canonical(bounded)))}`, source: 'board_brand_core', ...bounded, additional_context: [] });
  });
  return projected;
}
function targetGroupDigest(reference) { const match = /^board-persona:([0-9a-f]{16})(?::\d+)?$/i.exec(text(reference, 120) || ''); return match?.[1]?.toLowerCase() || null; }
function resolveTargetGroup(reference, available) {
  const exact = available.find((group) => group.source_id === reference); if (exact) return exact;
  const wanted = targetGroupDigest(reference); return wanted ? available.find((group) => targetGroupDigest(group.source_id) === wanted) || null : null;
}
function evaluateConfiguration(configuration, availableGroups, rawNodes) {
  const issues=[], normalizedTargetGroups=[], normalizedOrderedStages=[];
  for (const selected of configuration?.target_groups || []) {
    if (selected.kind === 'custom') normalizedTargetGroups.push({ id:selected.client_id, kind:'custom', name:text(selected.name,80,true), description:text(selected.description,500,true) });
    else { const group=resolveTargetGroup(selected.source_id,availableGroups); if(group) normalizedTargetGroups.push({...group,id:group.source_id}); else issues.push({code:'target_group_missing',affected_step:'target-groups',target_group_reference:text(selected.source_id,120)||'invalid',field:'source_id',message_key:'journey.issue.target_group_missing',blocking:true}); }
  }
  const rawMap=new Map((rawNodes||[]).map(node=>[text(node?.id,160),node])); const resolvedSelectedAssets=[], readinessResults=[]; let previous=-1;
  for (const stage of configuration?.stages || []) { const position=STAGES.indexOf(stage.stage); if(position<0||position<=previous){issues.push({code:'stage_order_invalid',affected_step:'stages',stage:text(stage.stage,40)||'invalid',field:'stage',blocking:true});continue;} previous=position; normalizedOrderedStages.push(stage);
    for(const id of stage.node_ids||[]){const raw=rawMap.get(id),projected=projectNode(raw);if(!projected){issues.push({code:'asset_missing',affected_step:'assets',stage:stage.stage,node_id:id,field:'node_id',blocking:true});continue;}if(projected.stage!==stage.stage){issues.push({code:'asset_stage_mismatch',affected_step:'assets',stage:stage.stage,node_id:id,field:'stage',blocking:true});continue;}const readiness=assetReadiness(raw);readinessResults.push({node_id:id,state:readiness.state});if(readiness.state==='incomplete'){issues.push({code:'asset_incomplete',affected_step:'assets',stage:stage.stage,node_id:id,field:'readiness',blocking:true});continue;}resolvedSelectedAssets.push(projected);}
  }
  return {isRunnable:issues.length===0&&normalizedTargetGroups.length>0&&normalizedOrderedStages.length>=2,normalizedTargetGroups,normalizedOrderedStages,resolvedSelectedAssets,readinessResults,actionableIssues:issues};
}
function mapNodeStage(node) {
  const explicit = text(node?.funnelStage, 40);
  if (STAGES.includes(explicit)) return explicit;
  const role = node?.type === 'Social Media Post' ? 'Social Media Posting' : text(node?.type, 60);
  if (role === 'Idea' || role === 'Social Media Posting') return 'Awareness';
  if (role === 'Content') return 'Interest';
  if (role === 'Landing Page' || /conversion/i.test(String(node?.conversionGoal || '')) || text(node?.landingPage?.cta, 300)) return 'Conversion';
  return null;
}
function projectNode(node) {
  const role = node?.type === 'Social Media Post' ? 'Social Media Posting' : text(node?.type, 60);
  const stage = mapNodeStage(node);
  const id = text(node?.id, 160, true);
  if (!id || !ELIGIBLE_ROLES.has(role) || !stage || node?.deleted === true || node?.temporary === true) return null;
  const previewSource = node.content || node.social?.caption || node.landingPage?.headerClaim || node.title || '';
  return { id, title: text(node.title || role, 120) || role, role, stage, platform: text(node.social?.platform || node.channel || '', 60) || '', status: text(node.status || '', 40) || '', preview: text(previewSource, 1200) || '' };
}
function assetReadiness(node) {
  const projected = projectNode(node);
  if (!projected) return { state: 'incomplete', issues: ['Invalid role or stage'] };
  const content = text(node?.content || '', 8000) || '';
  const socialCaption = text(node?.social?.caption || node?.social?.preview || '', 3000) || '';
  const platform = text(node?.social?.platform || node?.channel || '', 60) || '';
  const landing = [node?.landingPage?.headerClaim, node?.landingPage?.problem, node?.landingPage?.solution].map((part) => text(part || '', 3000) || '').filter(Boolean);
  const subject = text(node?.subject || node?.email?.subject || node?.title || '', 300) || '';
  const issues = [];
  if (projected.role === 'Social Media Posting') { if (!socialCaption && !content) issues.push('Missing caption'); if (!platform) issues.push('Missing platform'); }
  else if (projected.role === 'Landing Page') { if (!content && !landing.length) issues.push('Missing Landing Page content'); }
  else if (projected.role === 'Email Campaign') { if (!subject) issues.push('Missing subject'); if (!content) issues.push('Content is empty'); }
  else if (projected.role === 'Visual Concept') { if (!content) issues.push('Missing visual concept'); }
  else if (!content) issues.push('Content is empty');
  if (issues.length) return { state: 'incomplete', issues: issues.slice(0, 2) };
  const attention = [];
  const cta = text(node?.cta || node?.social?.cta || node?.landingPage?.cta || '', 300) || '';
  if (['Landing Page', 'Social Media Posting', 'Email Campaign'].includes(projected.role) && !cta) attention.push('No usable CTA');
  return { state: attention.length ? 'attention' : 'ready', issues: attention.slice(0, 2) };
}
function selectedContentProjection(groups, stages, nodeMap, savedState) {
  return canonical({
    saved_state: savedState,
    target_groups: groups.map(({ source_id, name, description, needs, motivations, kind, client_id }) => ({ source_id, client_id, kind, name, description, needs, motivations })).sort((a, b) => String(a.source_id || a.client_id).localeCompare(String(b.source_id || b.client_id))),
    stages: stages.map((stage) => ({ stage: stage.stage, mode: stage.mode, nodes: [...stage.node_ids].sort().map((id) => { const node = nodeMap.get(id); return node ? { ...node, readiness: assetReadiness(node) } : { id, missing: true }; }) }))
  });
}
function selectedContentIdentity(groups, stages, nodeMap, savedState) { return digest(JSON.stringify(selectedContentProjection(groups, stages, nodeMap, savedState))); }
function validateUnsavedContext(value, selectedAssets) {
  if (!keys(value, UNSAVED_KEYS) || Object.keys(value).length !== UNSAVED_KEYS.size || value.version !== 'persona_journey_unsaved_context_v1' || !Array.isArray(value.nodes) || value.nodes.length > LIMITS.nodes) return false;
  const expected = new Map(selectedAssets.map((asset) => [asset.node_id, asset.stage])); const ids = new Set();
  for (const node of value.nodes) {
    if (!keys(node, UNSAVED_NODE_KEYS) || !text(node.id, 160, true) || ids.has(node.id) || expected.get(node.id) !== node.stage || !STAGES.includes(node.stage) || !text(node.type, 80, true)) return false;
    ids.add(node.id);
    for (const key of ['title','status','audience','tone','cta','channel']) if (node[key] !== undefined && text(node[key], key === 'title' ? 120 : 1000) === null) return false;
    if (node.content !== undefined && text(node.content, 8000) === null) return false;
    for (const [key, allowed] of [['social', SOCIAL_KEYS], ['landingPage', LANDING_KEYS]]) if (node[key] !== undefined && (!keys(node[key], allowed) || Object.values(node[key]).some((entry) => Array.isArray(entry) ? entry.length > 20 || entry.some((item) => text(item,100,true) === null) : text(entry,3000) === null))) return false;
  }
  return ids.size === expected.size && [...expected.keys()].every((id) => ids.has(id));
}
function requestConfiguration(body) {
  const assetsByStage = new Map(body.stages.map((stage) => [stage, []]));
  body.stage_assets.forEach(({ stage, node_id }) => assetsByStage.get(stage).push(node_id));
  return { target_groups: body.target_groups.map(({ source_id }) => ({ kind: 'brand_core', source_id })), stages: body.stages.map((stage) => ({ stage, mode: body.gaps.includes(stage) ? 'explicit_gap' : 'assets', node_ids: assetsByStage.get(stage) })) };
}
function validateRequest(body) {
  if (!keys(body, BODY_KEYS) || body.version !== REQUEST_VERSION || !/^[A-Z0-9]{6,16}$/.test(body.client_request_id || '') || !text(body.board_id,80,true) || !['saved','unsaved'].includes(body.canvas_state) || !['en','de'].includes(body.response_language)) return { ok:false, code:'invalid_request' };
  const required = body.canvas_state === 'saved' ? BODY_KEYS.size - 1 : BODY_KEYS.size;
  if (Object.keys(body).length !== required || (body.canvas_state === 'saved' && Object.hasOwn(body,'unsaved_context')) || !Number.isInteger(body.persona_count) || body.persona_count < 2 || body.persona_count > LIMITS.personas) return { ok:false, code:'invalid_request' };
  if (!Array.isArray(body.target_groups) || body.target_groups.length < 1 || body.target_groups.length > LIMITS.groups || !Array.isArray(body.stages) || body.stages.length < 2 || body.stages.length > LIMITS.stages || !Array.isArray(body.gaps) || !Array.isArray(body.stage_assets)) return { ok:false, code:'invalid_request' };
  const groupIds=new Set(); for(const group of body.target_groups){if(!keys(group,TARGET_KEYS)||Object.keys(group).length!==2||group.source!=='board_brand_core'||!text(group.source_id,120,true)||groupIds.has(group.source_id))return{ok:false,code:'invalid_request'};groupIds.add(group.source_id);}
  let previous=-1;const stageSet=new Set();for(const stage of body.stages){const position=STAGES.indexOf(stage);if(position<=previous)return{ok:false,code:'invalid_request'};previous=position;stageSet.add(stage);}const gapSet=new Set();for(const gap of body.gaps){if(!stageSet.has(gap)||gapSet.has(gap))return{ok:false,code:'invalid_request'};gapSet.add(gap);}
  const nodeIds=new Set(),counts=new Map();for(const asset of body.stage_assets){if(!keys(asset,ASSET_KEYS)||Object.keys(asset).length!==2||!stageSet.has(asset.stage)||gapSet.has(asset.stage)||!text(asset.node_id,160,true)||nodeIds.has(asset.node_id))return{ok:false,code:'invalid_request'};nodeIds.add(asset.node_id);counts.set(asset.stage,(counts.get(asset.stage)||0)+1);if(counts.get(asset.stage)>LIMITS.nodesPerStage)return{ok:false,code:'invalid_request'};}
  if(nodeIds.size>LIMITS.nodes||body.stages.some(stage=>!gapSet.has(stage)&&!counts.has(stage))||body.persona_count!==body.target_groups.length*LIMITS.personasPerGroup)return{ok:false,code:'invalid_request'};
  if(body.canvas_state==='unsaved'&&!validateUnsavedContext(body.unsaved_context,body.stage_assets))return{ok:false,code:'invalid_request'};
  const configuration=requestConfiguration(body);
  // Internal compatibility view for evaluators; it is deliberately non-enumerable and never crosses JSON.
  if(Object.isExtensible(body))Object.defineProperty(body,'configuration',{value:configuration,configurable:true});
  return {ok:true,configuration};
}
function roundedRange(low, high) { return [Math.max(0, Math.floor(low / 5) * 5), Math.min(100, Math.ceil(high / 5) * 5)]; }
function aggregateRanges(journeys, selectedStages) {
  let entering = [100, 100]; let unreachable = false;
  return selectedStages.map((selected, stageIndex) => {
    if (unreachable) return { stage: selected.stage, entry: [0, 0], continuation: null, dropoff: null, band: null, status: 'unreachable' };
    if (selected.mode === 'explicit_gap') { unreachable = true; return { stage: selected.stage, entry: entering, continuation: [0, 0], dropoff: entering, band: 'very_low', status: 'explicit_gap' }; }
    const values = journeys.map((journey) => BANDS[journey.stages[stageIndex]?.continuation_band]).filter(Boolean);
    const lowRate = values.reduce((sum, value) => sum + value[0], 0) / values.length / 100; const highRate = values.reduce((sum, value) => sum + value[1], 0) / values.length / 100;
    const raw = [entering[0] * lowRate, entering[1] * highRate]; const continuation = roundedRange(raw[0], raw[1]);
    const midpoint = ((raw[0] + raw[1]) / 2) / Math.max(1, (entering[0] + entering[1]) / 2) * 100;
    const band = midpoint < 30 ? 'very_low' : midpoint < 45 ? 'low' : midpoint < 65 ? 'moderate' : midpoint < 80 ? 'high' : 'very_high';
    const dropoff = roundedRange(Math.max(0, entering[0] - continuation[1]), Math.max(0, entering[1] - continuation[0]));
    const result = { stage: selected.stage, entry: entering, continuation, dropoff, band, status: 'modeled' }; entering = continuation; return result;
  });
}

module.exports = { REQUEST_VERSION, STAGES, ELIGIBLE_ROLES, BANDS, LIMITS, text, digest, canonical, projectTargetGroups, targetGroupDigest, resolveTargetGroup, evaluateConfiguration, mapNodeStage, projectNode, assetReadiness, selectedContentProjection, selectedContentIdentity, validateUnsavedContext, requestConfiguration, validateRequest, aggregateRanges };
