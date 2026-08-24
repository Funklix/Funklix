'use strict';
const LIMITS = Object.freeze({ nodes: 200, edges: 400, bytes: 350000, id: 160, short: 1000, content: 8000 });
const NODE_TYPES = new Set(['Idea', 'Campaign Variation', 'Content', 'Social Media Posting', 'Landing Page', 'Email Campaign', 'Visual Concept', 'Image Brief']);
const NODE_KEYS = new Set(['id', 'type', 'title', 'content', 'status', 'funnelStage', 'audience', 'tone', 'cta', 'channel', 'social', 'landingPage']);
const SOCIAL_KEYS = new Set(['caption', 'hashtags', 'platform', 'preview', 'cta']);
const LANDING_KEYS = new Set(['headerClaim', 'problem', 'solution', 'trust', 'cta']);
const EDGE_KEYS = new Set(['id', 'source', 'target', 'type']);
function object(value) { return !!value && typeof value === 'object' && !Array.isArray(value); }
function keysOnly(value, allowed) { return object(value) && Object.keys(value).every((key) => allowed.has(key)); }
function boundedString(value, max, required = false) { if (value === undefined) return required ? null : ''; if (typeof value !== 'string' || value.length > max) return null; const result = value.trim(); return required && !result ? null : result; }
function failure(classification, status, detail) { return { ok: false, classification, status, detail }; }
function validateCanvasContext(canvas, selectedNodeId) {
  if (!object(canvas) || !keysOnly(canvas, new Set(['nodes', 'edges'])) || !Array.isArray(canvas.nodes) || !Array.isArray(canvas.edges)) return failure('malformed_canvas', 400, 'canvas_shape');
  if (canvas.nodes.length > LIMITS.nodes || canvas.edges.length > LIMITS.edges) return failure('canvas_too_large', 413, 'count');
  const nodes = []; const ids = new Set();
  for (const input of canvas.nodes) {
    if (!keysOnly(input, NODE_KEYS)) return failure('unsupported_canvas', 400, 'node_shape');
    const id = boundedString(input.id, LIMITS.id, true); const rawType = boundedString(input.type, 80, true); const type = rawType === 'Social Media Post' ? 'Social Media Posting' : rawType;
    if (!id || !type || !NODE_TYPES.has(type)) return failure('unsupported_canvas', 400, 'node_canonical');
    if (ids.has(id)) return failure('unsupported_canvas', 400, 'duplicate_node_id'); ids.add(id);
    const node = { id, type };
    for (const key of ['title', 'status', 'funnelStage', 'audience', 'tone', 'cta', 'channel']) { const value = boundedString(input[key], LIMITS.short); if (value === null) return failure('canvas_too_large', 413, 'node_string'); if (value) node[key] = value; }
    const content = boundedString(input.content, LIMITS.content); if (content === null) return failure('canvas_too_large', 413, 'node_content'); if (content) node.content = content;
    for (const [key, allowed] of [['social', SOCIAL_KEYS], ['landingPage', LANDING_KEYS]]) {
      if (input[key] === undefined) continue;
      if (!keysOnly(input[key], allowed)) return failure('unsupported_canvas', 400, `${key}_shape`);
      const nested = {};
      for (const nestedKey of Object.keys(input[key])) {
        if (nestedKey === 'hashtags') { if (!Array.isArray(input[key][nestedKey]) || input[key][nestedKey].length > 20) return failure('unsupported_canvas', 400, 'hashtags_shape'); const values = input[key][nestedKey].map((item) => boundedString(item, 100, true)); if (values.some((value) => !value)) return failure('unsupported_canvas', 400, 'hashtags_value'); nested[nestedKey] = values; }
        else { const value = boundedString(input[key][nestedKey], 3000); if (value === null) return failure('canvas_too_large', 413, 'nested_string'); if (value) nested[nestedKey] = value; }
      }
      node[key] = nested;
    }
    nodes.push(node);
  }
  const edges = [];
  for (const input of canvas.edges) {
    if (!keysOnly(input, EDGE_KEYS)) return failure('unsupported_canvas', 400, 'edge_shape');
    const source = boundedString(input.source, LIMITS.id, true); const target = boundedString(input.target, LIMITS.id, true);
    if (!source || !target) return failure('malformed_canvas', 400, 'edge_endpoint');
    if (!ids.has(source) || !ids.has(target)) return failure('stale_canvas', 409, 'edge_reference');
    const edge = { source, target };
    for (const key of ['id', 'type']) { const value = boundedString(input[key], key === 'id' ? LIMITS.id : 100); if (value === null) return failure('canvas_too_large', 413, 'edge_string'); if (value) edge[key] = value; }
    edges.push(edge);
  }
  if (selectedNodeId !== null && (!boundedString(selectedNodeId, LIMITS.id, true) || !ids.has(selectedNodeId))) return failure('invalid_selected_node', 409, 'selected_node');
  return { ok: true, nodes, edges };
}
module.exports = { LIMITS, validateCanvasContext };
