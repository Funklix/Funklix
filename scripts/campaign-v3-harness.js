#!/usr/bin/env node
const assert = require("assert");
const {
  CAMPAIGN_V3_DIAGNOSTICS,
  CAMPAIGN_V3_COLUMNS,
  buildCampaignV3PlanFromNodes,
  buildCampaignV3Edges,
  layoutCampaignV3Plan,
  campaignV3PlanNodes,
  createCampaignV3FakeCanvasAdapter,
  commitCampaignV3PlanToCanvas,
  campaignV3MockCases
} = require("../campaign-v3");

function edgeKey(edge) {
  return `${edge.fromTempId}->${edge.toTempId}`;
}

function nodeTypeById(plan) {
  return new Map(campaignV3PlanNodes(plan).map((node) => [node.tempId, node.type]));
}

function assertApproximatelyEqual(actual, expected, message, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: expected ${expected}, received ${actual}`);
}

function assertValidPlan(caseDef, result) {
  assert.strictEqual(result.ok, true, `${caseDef.name} should build successfully`);
  assert.ok(result.plan, `${caseDef.name} should return a plan`);
  assert.strictEqual(result.plan.lanes.length, caseDef.setup.variationCount, `${caseDef.name} lane count`);
  result.plan.lanes.forEach((lane, laneIndex) => {
    assert.ok(lane.variation, `${caseDef.name} lane ${laneIndex + 1} variation`);
    assert.ok(lane.content, `${caseDef.name} lane ${laneIndex + 1} content`);
    assert.strictEqual(lane.socials.length, caseDef.setup.postsPerVariation, `${caseDef.name} lane ${laneIndex + 1} social count`);
    assert.strictEqual(lane.landing, undefined, `${caseDef.name} lane ${laneIndex + 1} should not own a landing page`);
    assert.strictEqual(lane.email, undefined, `${caseDef.name} lane ${laneIndex + 1} should not own an email campaign`);
  });
  assert.strictEqual(Boolean(result.plan.landing), caseDef.setup.includeLandingPage, `${caseDef.name} campaign-level landing toggle`);
  assert.strictEqual(Boolean(result.plan.email), caseDef.setup.includeEmailCampaign, `${caseDef.name} campaign-level email toggle`);

  const planNodes = campaignV3PlanNodes(result.plan);
  assert.strictEqual(planNodes.filter((node) => node.type === "Campaign Variation").length, caseDef.setup.variationCount, `${caseDef.name} variation count`);
  assert.strictEqual(planNodes.filter((node) => node.type === "Content").length, caseDef.setup.variationCount, `${caseDef.name} content count`);
  assert.strictEqual(planNodes.filter((node) => node.type === "Social Media Posting").length, caseDef.setup.variationCount * caseDef.setup.postsPerVariation, `${caseDef.name} social count`);
  assert.strictEqual(planNodes.filter((node) => node.type === "Landing Page").length, caseDef.setup.includeLandingPage ? 1 : 0, `${caseDef.name} campaign landing count`);
  assert.strictEqual(planNodes.filter((node) => node.type === "Email Campaign").length, caseDef.setup.includeEmailCampaign ? 1 : 0, `${caseDef.name} campaign email count`);
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
      if (result.plan.landing) assert.ok(edgeIds.has(`${social.tempId}->${result.plan.landing.tempId}`), `${caseDef.name} social connects to campaign landing`);
      else if (result.plan.email) assert.ok(edgeIds.has(`${social.tempId}->${result.plan.email.tempId}`), `${caseDef.name} social connects to campaign email`);
    });
  });
  if (result.plan.landing && result.plan.email) assert.ok(edgeIds.has(`${result.plan.landing.tempId}->${result.plan.email.tempId}`), `${caseDef.name} landing connects to campaign email`);

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
  const ideaNode = layout.positionedNodes.find((node) => node.column === "idea");
  const landingNode = layout.positionedNodes.find((node) => node.column === "landing");
  const emailNode = layout.positionedNodes.find((node) => node.column === "email");
  const socialNodes = layout.positionedNodes.filter((node) => node.column === "social");
  const socialYs = socialNodes.map((node) => node.y);
  const campaignCenterY = (Math.min(...socialYs) + Math.max(...socialYs)) / 2;
  assertApproximatelyEqual(ideaNode.y, campaignCenterY, `${caseDef.name} idea centered against social cluster`);
  if (landingNode) assertApproximatelyEqual(landingNode.y, campaignCenterY, `${caseDef.name} landing centered against social cluster`);
  if (emailNode) assertApproximatelyEqual(emailNode.y, landingNode ? landingNode.y : campaignCenterY, `${caseDef.name} email aligned with landing/campaign center`);

  result.plan.lanes.forEach((lane, laneIndex) => {
    const laneSocialNodes = lane.socials.map((social) => layout.positionedNodes.find((node) => node.tempId === social.tempId));
    laneSocialNodes.forEach((socialNode, socialIndex) => {
      assert.ok(socialNode, `${caseDef.name} lane ${laneIndex + 1} social ${socialIndex + 1} positioned`);
      if (socialIndex > 0) assert.ok(socialNode.y > laneSocialNodes[socialIndex - 1].y, `${caseDef.name} lane ${laneIndex + 1} socials preserve vertical order`);
    });
    const laneCenterY = (laneSocialNodes[0].y + laneSocialNodes[laneSocialNodes.length - 1].y) / 2;
    const variationNode = layout.positionedNodes.find((node) => node.tempId === lane.variation.tempId);
    const contentNode = layout.positionedNodes.find((node) => node.tempId === lane.content.tempId);
    assertApproximatelyEqual(variationNode.y, laneCenterY, `${caseDef.name} lane ${laneIndex + 1} variation centered on social stack`);
    assertApproximatelyEqual(contentNode.y, laneCenterY, `${caseDef.name} lane ${laneIndex + 1} content centered on social stack`);
    if (laneIndex > 0) {
      const previousLane = result.plan.lanes[laneIndex - 1];
      const previousSocialNodes = previousLane.socials.map((social) => layout.positionedNodes.find((node) => node.tempId === social.tempId));
      const previousMaxY = Math.max(...previousSocialNodes.map((node) => node.y));
      const currentMinY = Math.min(...laneSocialNodes.map((node) => node.y));
      assert.ok(currentMinY > previousMaxY, `${caseDef.name} lane ${laneIndex + 1} social group separated from previous lane`);
    }
  });

  const adapter = createCampaignV3FakeCanvasAdapter();
  const commit = commitCampaignV3PlanToCanvas(layout, adapter);
  assert.strictEqual(commit.ok, true, `${caseDef.name} fake commit should succeed`);
  assert.ok(commit.diagnostics.some((diagnostic) => diagnostic.code === CAMPAIGN_V3_DIAGNOSTICS.COMMIT_OK), `${caseDef.name} commit diagnostics should include OK`);
  assert.strictEqual(adapter.committedNodes.length, layout.positionedNodes.length, `${caseDef.name} committed node count`);
  assert.strictEqual(adapter.committedEdges.length, layout.edges.length, `${caseDef.name} committed edge count`);
  assert.strictEqual(commit.createdNodes.length, layout.positionedNodes.length, `${caseDef.name} returned created node count`);
  assert.strictEqual(commit.createdEdges.length, layout.edges.length, `${caseDef.name} returned created edge count`);
  assert.strictEqual(Object.keys(commit.tempIdToNodeId).length, layout.positionedNodes.length, `${caseDef.name} tempId mapping count`);
  assert.strictEqual(new Set(Object.keys(commit.tempIdToNodeId)).size, layout.positionedNodes.length, `${caseDef.name} unique tempId mappings`);
  assert.ok(adapter.unsavedCallCount >= 1, `${caseDef.name} markUnsaved called`);

  const createdNodeIds = new Set(adapter.committedNodes.map((node) => node.id));
  adapter.committedEdges.forEach((edge) => {
    assert.ok(createdNodeIds.has(edge.sourceNodeId), `${caseDef.name} committed edge source id exists`);
    assert.ok(createdNodeIds.has(edge.targetNodeId), `${caseDef.name} committed edge target id exists`);
  });

  const creationOrder = new Map();
  adapter.activityLog.forEach((entry, index) => {
    if (entry.action === "createNode") creationOrder.set(entry.nodeId, index);
  });
  adapter.activityLog
    .filter((entry) => entry.action === "createEdge")
    .forEach((entry) => {
      const edgeOrder = adapter.activityLog.indexOf(entry);
      assert.ok(creationOrder.get(entry.sourceNodeId) < edgeOrder, `${caseDef.name} edge source created first`);
      assert.ok(creationOrder.get(entry.targetNodeId) < edgeOrder, `${caseDef.name} edge target created first`);
    });
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
    else {
      assertInvalidPlan(caseDef, result);
      assert.strictEqual(result.plan, null, `${caseDef.name} should not produce a committable plan`);
    }
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
