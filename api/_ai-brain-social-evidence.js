'use strict';

// Request-local source matching. A matching quote attests source text only;
// observation and explanation remain AI interpretation, never measured results.
const scope = require('./_ai-brain-proposal-scope');
const { createHash } = require('node:crypto');
const FIELDS = ['cta', 'social.cta', 'social.caption', 'social.preview', 'content', 'goal'];
const at = (node, field) => field.split('.').reduce((value, key) => value?.[key], node);
const canonicalType = type => type === 'Social Media Post' ? 'Social Media Posting' : type;
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const keys = (value, names) => object(value) && Object.keys(value).length === names.length && names.every(key => Object.hasOwn(value, key));
const string = (value, max) => typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const POLICY = 'This turn explicitly analyzes CTA clarity on existing Social Media Posting nodes. Return only one JSON object with exactly answer (natural conversational text, nonempty, <=12000 characters) and findings (array, max 3). Each finding has exactly title (concise observation <=120 characters), explanation (AI strategic interpretation <=600 characters), evidence (1 or 2 objects with exactly nodeId, field, quote). First evidence must be positive copy from cta/social.cta/social.caption/social.preview/content; optional second evidence is a relevant goal on the same node. Copy each quote exactly from evidence.nodes[id].fields[field].quote, including the full bounded prefix. Never invent or supply metadata, URLs, provenance or scores. Only use indexed Social Media Posting nodes; the server separately checks persisted identity. Check all supplied CTA fields and caption/content for counterevidence. Do not infer missing CTA from empty fields, preview presence or diagnostics. Do not return absence/count/performance claims as findings. CTA clarity is interpretation, not a verified fact. Missing goals remain unknown. If reliable positive evidence is insufficient, explain the limitation conversationally in answer and return findings: []. Coverage is partial; omitted/truncated copy never proves absence. No code fences, repair request or extra action.';
// Keep the existing acceptance contract. Failure categories contain no source copy.
function inspect(data) {
  const result = (reason, raw = '', envelope = null) => ({ reason, envelope, diagnostic: {
    providerStatus: ['completed', 'incomplete', 'failed', 'cancelled', 'queued', 'in_progress'].includes(data?.status) ? data.status : 'unknown',
    incompleteReason: ['max_output_tokens', 'content_filter'].includes(data?.incomplete_details?.reason) ? data.incomplete_details.reason : data?.incomplete_details ? 'unknown' : null,
    // Responses uses status/incomplete_details; never infer completion from usage.
    outputTokens: Number.isSafeInteger(data?.usage?.output_tokens) && data.usage.output_tokens >= 0 ? data.usage.output_tokens : null,
    outputCharacters: raw.length
  } });
  if (!object(data) || (data.output !== undefined && !Array.isArray(data.output))) return result('envelope');
  if ((data.output || []).some(item => !object(item) || (item.content !== undefined && (!Array.isArray(item.content) || item.content.some(part => !object(part)))))) return result('envelope');
  if ((data.status && data.status !== 'completed') || data.incomplete_details
    || (data.output || []).some(item => item.status && item.status !== 'completed')) return result('incomplete');
  if ((data.output || []).some(item => (item.content || []).some(part => part.type === 'refusal'))) return result('refusal');
  // An empty convenience aggregate must not hide populated assistant blocks.
  // Nonempty aggregates remain authoritative; malformed text is never repaired.
  const raw = typeof data.output_text === 'string' && data.output_text.length ? data.output_text : (data.output || [])
    .filter(item => item?.type === 'message' && item.role === 'assistant')
    .flatMap(item => item.content || []).filter(part => part.type === 'output_text' && typeof part.text === 'string').map(part => part.text).join('');
  // Parse every text block without clipping, salvaging or repairing partial JSON.
  if (!raw.trim()) return result('empty', raw);
  if (raw.length > 24000) return result('size', raw);
  let value; try { value = JSON.parse(raw); } catch { return result('json', raw); }
  if (!keys(value, ['answer', 'findings']) || !string(value.answer, 12000) || !Array.isArray(value.findings) || value.findings.length > 3) return result('schema', raw);
  for (const finding of value.findings) {
    if (!keys(finding, ['title', 'explanation', 'evidence']) || !string(finding.title, 120) || !string(finding.explanation, 600)
      || !Array.isArray(finding.evidence) || !finding.evidence.length || finding.evidence.length > 2) return result('schema', raw);
    if (finding.evidence.some(item => !keys(item, ['nodeId', 'field', 'quote']) || !string(item.nodeId, 160)
      || !string(item.field, 80) || !string(item.quote, 180))) return result('schema', raw);
  }
  return result(null, raw, value);
}
function parse(data) { return inspect(data).envelope; }

function savedNodes(data) {
  const nodes = data.authorized.board.canvas_json.nodes;
  return new Map(nodes.map(node => [node.id, node]));
}
function referenceRevision(authorized, nodeId) {
  const value = JSON.parse(authorized.fingerprint);
  const node = value.board.canvas_json?.nodes?.find(node => node?.id === nodeId);
  delete value.board.canvas_json;
  // Only the selected node's allowlisted saved baseline enters this digest.
  // No hidden fields, other nodes, canonical Core or Learnings are reference data.
  value.source = node ? { id: node.id, type: canonicalType(node.type), title: node.title,
    fields: Object.fromEntries(FIELDS.map(field => [field, at(node, field) ?? null])) } : null;
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
function resolve({ envelope, evidence, nodes, data }) {
  const persisted = savedNodes(data);
  const findings = [];
  for (const candidate of envelope.findings) {
    // Conservative MVP guard for obvious absence/quantification/measurement
    // claims. This is not semantic verification of the remaining interpretation.
    if (/[0-9%]|\b(missing|lack|lacks|without|no cta|fehlt|fehlen|keine|ohne|performance|conversion rate|click-through|klickrate|roi)\b/iu.test(candidate.title + ' ' + candidate.explanation)) continue;
    const id = candidate.evidence[0].nodeId, node = nodes.find(item => item.id === id);
    const saved = persisted.get(id), indexed = evidence.nodes.find(item => item.id === id);
    if (!node || node.type !== 'Social Media Posting' || canonicalType(saved?.type) !== node.type || !indexed
      || candidate.evidence[0].field === 'goal' || (candidate.evidence.length === 2 && candidate.evidence[1].field !== 'goal')) continue;
    const sources = [];
    for (const item of candidate.evidence) {
      const source = indexed.fields[item.field];
      if (!FIELDS.includes(item.field) || item.nodeId !== id || !source || source.quote !== item.quote) break;
      const working = at(node, item.field), baseline = at(saved, item.field);
      // Validation trims ordinary copy; goal intentionally preserves whitespace.
      // Compare the FULL supplied value with the FULL saved value, not prefixes.
      const state = item.field === 'goal' ? data.sources.find(goal => goal.nodeId === id)?.state
        : typeof baseline === 'string' && baseline.trim() === working ? 'saved' : 'working';
      if (!state) break;
      sources.push({ field: item.field, quote: source.quote, excerpted: source.excerpted, state });
    }
    if (sources.length !== candidate.evidence.length) continue;
    findings.push({ id: `social-${findings.length + 1}`, kind: 'interpretation', sourceCheck: 'matched', observation: candidate.title, interpretation: candidate.explanation,
      nodeId: id, type: node.type, nodeTitle: node.title || '', evidence: sources,
      reference: { nodeId: id, scopeRevision: referenceRevision(data.authorized, id) } });
  }
  const social = nodes.filter(node => node.type === 'Social Media Posting');
  return { findings, evidenceContext: { boardId: data.authorized.board.id, boardRevision: scope.publicScope(data.authorized.board).updated_at,
    omittedFindings: envelope.findings.length - findings.length,
    suppliedSocial: social.length, indexedSocial: evidence.nodes.filter(node => node.type === 'Social Media Posting'
      && canonicalType(persisted.get(node.id)?.type) === node.type && FIELDS.some(field => field !== 'goal' && node.fields[field])).length } };
}
module.exports = { POLICY, parse, inspect, resolve, canonicalType, referenceRevision };
