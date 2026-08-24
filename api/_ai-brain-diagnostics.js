'use strict';

function text(value) { return typeof value === 'string' ? value.trim() : ''; }

function analyzeCanvas(nodes = [], edges = []) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const safeEdges = Array.isArray(edges) ? edges : [];
  const stages = ['Awareness', 'Interest', 'Consideration', 'Conversion', 'Retention'];
  const derived = safeNodes.flatMap((node) => {
    const values = [];
    if (text(node.funnelStage)) values.push(text(node.funnelStage));
    if (node.type === 'Idea' || node.type === 'Social Media Posting') values.push('Awareness');
    if (node.type === 'Content') values.push('Interest');
    if (node.type === 'Landing Page' || node.goal === 'Conversion' || text(node?.landingPage?.cta)) values.push('Conversion');
    return values;
  });
  const coveredStages = [...new Set(derived)];
  const missingStages = stages.filter((stage) => !coveredStages.includes(stage));
  const audiences = [...new Set(safeNodes.map((node) => text(node.audience)).filter(Boolean))];
  const tones = [...new Set(safeNodes.map((node) => text(node.tone)).filter(Boolean))];
  const ctas = safeNodes.map((node) => text(node?.landingPage?.cta) || text(node?.social?.preview)).filter(Boolean);
  const trustCount = safeNodes.filter((node) => node.type === 'Landing Page' && text(node?.landingPage?.trust)).length;
  return {
    version: 'bw25-canvas-diagnostics-v1',
    basis: 'deterministic_canvas_structure',
    nodeCount: safeNodes.length,
    edgeCount: safeEdges.length,
    coveredStages,
    missingStages,
    findings: [
      ...(ctas.length ? [] : [{ code: 'missing_cta', severity: 'warning', message: 'No CTA was detected in the current Canvas.' }]),
      ...(trustCount ? [] : [{ code: 'missing_landing_trust', severity: 'opportunity', message: 'No Landing Page trust content was detected.' }]),
      ...(audiences.length > 1 ? [{ code: 'multiple_audiences', severity: 'review', message: 'Audience wording varies across nodes.' }] : []),
      ...(tones.length > 2 ? [{ code: 'tone_variation', severity: 'review', message: 'More than two tone labels are used across nodes.' }] : []),
      ...(missingStages.length ? [{ code: 'stage_gaps', severity: 'opportunity', message: `Canvas stage gaps: ${missingStages.join(', ')}.` }] : [])
    ]
  };
}

module.exports = { analyzeCanvas };
