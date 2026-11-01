'use strict';
// Labels belong to this inference only. Neither a title nor a numeric ID suffix
// is identity. Only nodes present in the authorized persisted Canvas are mapped.
const scope = require('./_ai-brain-proposal-scope');
const { canonicalType } = require('./_ai-brain-social-evidence');
const POLICY = 'When discussing an existing Canvas node, use its exact label from workingCanvas.nodeReferences (for example Node #2), in English and German. These are request-local reference labels, not persisted IDs or visible Canvas numbers. For node citations, these labels replace raw persisted IDs. Only use supplied labels; never derive labels from IDs, titles, metrics or history. Keep normal natural-language advice; do not generate cards, schemas or reference metadata.';
function mapping(nodes, data) {
  if (!data?.authorized) return [];
  const saved = data.authorized.board.canvas_json.nodes;
  return nodes.flatMap((node, index) => saved.filter(item => item.id === node.id && canonicalType(item.type) === node.type).length === 1
    ? [{ label: `Node #${index + 1}`, nodeId: node.id }] : []);
}
function resolve(answer, entries, data) {
  const mentions = new Set(Array.from(answer.matchAll(/(?<![\p{L}\p{N}_])Node #[1-9]\d*(?![\p{L}\p{N}_-]|\.\d)/gu), match => match[0]));
  return entries.filter(entry => mentions.has(entry.label)).map(entry => ({ ...entry, scopeRevision: scope.revision(data.authorized) }));
}
module.exports = { POLICY, mapping, resolve };
