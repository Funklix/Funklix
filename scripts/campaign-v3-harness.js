#!/usr/bin/env node
const assert = require("assert");
const {
  CAMPAIGN_V3_DIAGNOSTICS,
  CAMPAIGN_V3_COLUMNS,
  buildCampaignV3PlanFromNodes,
  buildCampaignV3Edges,
  layoutCampaignV3Plan,
  campaignV3PlanNodes,
  campaignV3MockCases
} = require("../campaign-v3");

function edgeKey(edge) {
  return `${edge.fromTempId}->${edge.toTempId}`;
}

function nodeTypeById(plan) {
  return new Map(campaignV3PlanNodes(plan).map((node) => [node.tempId, node.type]));
}

function assertValidPlan(caseDef, result) {
  assert.strictEqual(result.ok, true, `${caseDef.name} should build successfully`);
  assert.ok(result.plan, `${caseDef.name} should return a plan`);
  assert.strictEqual(result.plan.lanes.length, caseDef.setup.variationCount, `${caseDef.name} lane count`);
  result.plan.lanes.forEach((lane, laneIndex) => {
    assert.ok(lane.variation, `${caseDef.name} lane ${laneIndex + 1} variation`);
    assert.ok(lane.content, `${caseDef.name} lane ${laneIndex + 1} content`);
    assert.strictEqual(lane.socials.length, caseDef.setup.postsPerVariation, `${caseDef.name} lane ${laneIndex + 1} social count`);
    assert.strictEqual(Boolean(lane.landing), caseDef.setup.includeLandingPage, `${caseDef.name} lane ${laneIndex + 1} landing toggle`);
    assert.strictEqual(Boolean(lane.email), caseDef.setup.includeEmailCampaign, `${caseDef.name} lane ${laneIndex + 1} email toggle`);
  });

  const planNodes = campaignV3PlanNodes(result.plan);
  const ids = planNodes.map((node) => node.tempId);
  assert.strictEqual(new Set(ids).size, ids.length, `${caseDef.name} should not duplicate tempIds`);

  const edges = buildCampaignV3Edges(result.plan);
  const edgeIds = new Set(edges.map(edgeKey));
  assert.strictEqual(edgeIds.size, edges.length, `${caseDef.name} should not duplicate edges`);
  const typeById = nodeTypeById(result.plan);
  edges.forEach((edge) => {
    assert.ok(typeById.has(edge.fromTempId), `${caseDef.name} edge from tempId exists`);
    assert.ok(typeById.has(edge.toTempId), `${caseDef.name} edge to tempId exists`);
    assert.notStrictEqual(`${typeById.get(edge.fromTempId)}→${typeById.get(edge.toTempId)}`, "Campaign Variation→Email Campaign", `${caseDef.name} should not connect Variation → Email`);
    assert.notStrictEqual(`${typeById.get(edge.fromTempId)}→${typeById.get(edge.toTempId)}`, "Content→Email Campaign", `${caseDef.name} should not connect Content → Email`);
  });

  result.plan.lanes.forEach((lane) => {
    lane.socials.forEach((social) => {
      if (lane.landing) assert.ok(edgeIds.has(`${social.tempId}->${lane.landing.tempId}`), `${caseDef.name} social connects to same-lane landing`);
      else if (lane.email) assert.ok(edgeIds.has(`${social.tempId}->${lane.email.tempId}`), `${caseDef.name} social connects to same-lane email`);
    });
    if (lane.landing && lane.email) assert.ok(edgeIds.has(`${lane.landing.tempId}->${lane.email.tempId}`), `${caseDef.name} landing connects to same-lane email`);
  });

  const layout = layoutCampaignV3Plan(result.plan, caseDef.setup, { x: 100, y: 200 });
  assert.strictEqual(layout.ok, true, `${caseDef.name} layout should succeed`);
  layout.positionedNodes.forEach((node) => {
    assert.ok(Number.isFinite(node.x), `${caseDef.name} ${node.tempId} x is finite`);
    assert.ok(Number.isFinite(node.y), `${caseDef.name} ${node.tempId} y is finite`);
  });
  const columnX = new Map(layout.positionedNodes.map((node) => [node.column, node.x]));
  assert.strictEqual(columnX.get("idea"), 100 + CAMPAIGN_V3_COLUMNS.idea, `${caseDef.name} idea column`);
  assert.ok(columnX.get("variation") > columnX.get("idea"), `${caseDef.name} variation after idea`);
  assert.ok(columnX.get("content") > columnX.get("variation"), `${caseDef.name} content after variation`);
  assert.ok(columnX.get("social") > columnX.get("content"), `${caseDef.name} social after content`);
  if (caseDef.setup.includeLandingPage) assert.ok(columnX.get("landing") > columnX.get("social"), `${caseDef.name} landing after social`);
  if (caseDef.setup.includeEmailCampaign) {
    const previous = caseDef.setup.includeLandingPage ? columnX.get("landing") : columnX.get("social");
    assert.ok(columnX.get("email") > previous, `${caseDef.name} email after previous funnel column`);
  }
}

function assertInvalidPlan(caseDef, result) {
  assert.strictEqual(result.ok, false, `${caseDef.name} should fail`);
  const codes = new Set(result.diagnostics.map((diagnostic) => diagnostic.code));
  caseDef.expectedCodes.forEach((code) => {
    assert.ok(codes.has(code), `${caseDef.name} should include diagnostic ${code}; received ${[...codes].join(", ")}`);
  });
}

function runCampaignV3Harness() {
  const cases = campaignV3MockCases();
  const results = [];
  cases.forEach((caseDef) => {
    const result = buildCampaignV3PlanFromNodes(caseDef.nodes, caseDef.setup);
    if (caseDef.expectedOk) assertValidPlan(caseDef, result);
    else assertInvalidPlan(caseDef, result);
    results.push({ name: caseDef.name, ok: result.ok, diagnostics: result.diagnostics.map((diagnostic) => diagnostic.code) });
  });
  return results;
}

if (require.main === module) {
  const results = runCampaignV3Harness();
  results.forEach((result) => {
    const status = result.ok ? "PASS" : "EXPECTED_FAIL";
    console.log(`[${status}] ${result.name}: ${result.diagnostics.join(", ") || CAMPAIGN_V3_DIAGNOSTICS.OK}`);
  });
  console.log(`Campaign V3 harness completed ${results.length} mock cases.`);
}

module.exports = { runCampaignV3Harness };
