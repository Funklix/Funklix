'use strict';

const STAGES = Object.freeze(['Awareness', 'Interest', 'Consideration', 'Conversion', 'Retention']);
const ELIGIBLE_ROLES = new Set(['Idea', 'Campaign Variation', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign', 'Visual Concept']);
const BANDS = Object.freeze({ very_low: [10, 30], low: [25, 45], moderate: [45, 65], high: [65, 85], very_high: [80, 95] });
const LIMITS = Object.freeze({ groups: 3, personas: 6, personasPerGroup: 2, stages: 5, nodesPerStage: 2, nodes: 8, reactions: 60, bodyBytes: 65536, outputBytes: 98304 });
const BODY_KEYS = new Set(['board_id', 'response_language', 'board_revision', 'canvas_context', 'configuration', 'client_run_id', 'configuration_fingerprint', 'stage_mapping_version']);
const CANVAS_KEYS = new Set(['revision', 'saved_state', 'nodes', 'edges']);
const CONFIG_KEYS = new Set(['target_groups', 'stages']);
const GROUP_KEYS = { brand_core: new Set(['kind', 'source_id']), custom: new Set(['kind', 'client_id', 'name', 'description']) };
const STAGE_KEYS = new Set(['stage', 'mode', 'node_ids']);

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
function projectTargetGroups(brandCore, revision = '0') {
  const personas = Array.isArray(brandCore?.personas) ? brandCore.personas : [];
  const projected = [];
  personas.forEach((entry, index) => {
    const source = typeof entry === 'string' ? { name: entry } : entry;
    if (!plain(source)) return;
    const name = text(source.name || source.category, 80, true);
    if (!name) return;
    const description = text(source.description || source.note || '', 500) || '';
    projected.push({ source_id: `board-persona:${digest(revision)}:${index}`, source: 'board_brand_core', name, description, needs: list(source.needs, 5, 120), motivations: list(source.motivations, 5, 120), additional_context: [] });
  });
  return projected;
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
function validateRequest(body) {
  if (!keys(body, BODY_KEYS) || Object.keys(body).length !== BODY_KEYS.size) return { ok: false, code: 'invalid_request' };
  if (!text(body.board_id, 80, true) || !['en', 'de'].includes(body.response_language) || !['string', 'number'].includes(typeof body.board_revision)
    || body.stage_mapping_version !== 'bw28-v1' || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.client_run_id || '') || !text(body.configuration_fingerprint, 128, true)
    || !keys(body.canvas_context, CANVAS_KEYS) || !['saved', 'unsaved'].includes(body.canvas_context.saved_state) || !['string', 'number'].includes(typeof body.canvas_context.revision)
    || !Array.isArray(body.canvas_context.nodes) || !Array.isArray(body.canvas_context.edges) || !keys(body.configuration, CONFIG_KEYS)) return { ok: false, code: 'invalid_request' };
  const groups = body.configuration.target_groups; const stages = body.configuration.stages;
  if (!Array.isArray(groups) || groups.length < 1 || groups.length > LIMITS.groups || !Array.isArray(stages) || stages.length < 1 || stages.length > LIMITS.stages) return { ok: false, code: 'invalid_request' };
  let custom = 0; const groupIds = new Set();
  for (const group of groups) {
    if (!plain(group) || !GROUP_KEYS[group.kind] || !keys(group, GROUP_KEYS[group.kind]) || Object.keys(group).length !== GROUP_KEYS[group.kind].size) return { ok: false, code: 'invalid_request' };
    const id = group.kind === 'brand_core' ? text(group.source_id, 120, true) : text(group.client_id, 40, true);
    if (!id || groupIds.has(id)) return { ok: false, code: 'invalid_request' }; groupIds.add(id);
    if (group.kind === 'custom' && (++custom > 1 || group.client_id !== 'custom-1' || !text(group.name, 80, true) || text(group.description, 500, true) === null)) return { ok: false, code: 'invalid_request' };
  }
  const nodeIds = new Set(); let previous = -1;
  for (const stage of stages) {
    if (!keys(stage, STAGE_KEYS) || Object.keys(stage).length !== STAGE_KEYS.size || !STAGES.includes(stage.stage) || STAGES.indexOf(stage.stage) <= previous || !['assets', 'explicit_gap'].includes(stage.mode) || !Array.isArray(stage.node_ids)) return { ok: false, code: 'invalid_request' };
    previous = STAGES.indexOf(stage.stage);
    if ((stage.mode === 'assets' && (stage.node_ids.length < 1 || stage.node_ids.length > LIMITS.nodesPerStage)) || (stage.mode === 'explicit_gap' && stage.node_ids.length)) return { ok: false, code: 'invalid_request' };
    for (const idValue of stage.node_ids) { const id = text(idValue, 160, true); if (!id || nodeIds.has(id)) return { ok: false, code: 'invalid_request' }; nodeIds.add(id); }
  }
  if (nodeIds.size > LIMITS.nodes) return { ok: false, code: 'invalid_request' };
  return { ok: true };
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

module.exports = { STAGES, ELIGIBLE_ROLES, BANDS, LIMITS, text, digest, projectTargetGroups, mapNodeStage, projectNode, validateRequest, aggregateRanges };
