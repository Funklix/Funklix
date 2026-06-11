(function campaignV3Module(root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.CampaignGeneratorV3 = factory();
}(typeof globalThis !== "undefined" ? globalThis : this, function createCampaignV3() {
  const CAMPAIGN_V3_NODE_TYPES = [
    "Idea",
    "Campaign Variation",
    "Content",
    "Social Media Posting",
    "Landing Page",
    "Email Campaign"
  ];

  const CAMPAIGN_V3_DIAGNOSTICS = {
    OK: "CAMPAIGN_V3_OK",
    MISSING_IDEA: "CAMPAIGN_V3_MISSING_IDEA",
    WRONG_VARIATION_COUNT: "CAMPAIGN_V3_WRONG_VARIATION_COUNT",
    WRONG_CONTENT_COUNT: "CAMPAIGN_V3_WRONG_CONTENT_COUNT",
    WRONG_SOCIAL_COUNT: "CAMPAIGN_V3_WRONG_SOCIAL_COUNT",
    WRONG_LANDING_COUNT: "CAMPAIGN_V3_WRONG_LANDING_COUNT",
    WRONG_EMAIL_COUNT: "CAMPAIGN_V3_WRONG_EMAIL_COUNT",
    INVALID_NODE_TYPE: "CAMPAIGN_V3_INVALID_NODE_TYPE",
    DUPLICATE_NODE: "CAMPAIGN_V3_DUPLICATE_NODE",
    INVALID_EDGE_REFERENCE: "CAMPAIGN_V3_INVALID_EDGE_REFERENCE",
    LAYOUT_FAILED: "CAMPAIGN_V3_LAYOUT_FAILED",
    COMMIT_OK: "CAMPAIGN_V3_COMMIT_OK",
    COMMIT_MISSING_NODE: "CAMPAIGN_V3_COMMIT_MISSING_NODE",
    COMMIT_DUPLICATE_NODE: "CAMPAIGN_V3_COMMIT_DUPLICATE_NODE",
    COMMIT_EDGE_MISSING_SOURCE: "CAMPAIGN_V3_COMMIT_EDGE_MISSING_SOURCE",
    COMMIT_EDGE_MISSING_TARGET: "CAMPAIGN_V3_COMMIT_EDGE_MISSING_TARGET",
    COMMIT_ADAPTER_ERROR: "CAMPAIGN_V3_COMMIT_ADAPTER_ERROR"
  };

  const CAMPAIGN_V3_COLUMNS = {
    idea: 0,
    variation: 360,
    content: 720,
    social: 1080,
    landing: 1440,
    email: 1800
  };
  const CAMPAIGN_V3_ROW_GAP = 260;
  const CAMPAIGN_V3_ITEM_GAP = 176;

  function normalizeCampaignV3Setup(setup = {}) {
    const clamp = (value, fallback, min, max) => {
      const parsed = Number.parseInt(value, 10);
      if (!Number.isFinite(parsed)) return fallback;
      return Math.max(min, Math.min(max, parsed));
    };
    const channel = ["LinkedIn", "X", "Instagram", "TikTok", "Mixed"].includes(setup.channel) ? setup.channel : "LinkedIn";
    return {
      variationCount: clamp(setup.variationCount, 3, 1, 10),
      postsPerVariation: clamp(setup.postsPerVariation, 5, 1, 20),
      includeLandingPage: setup.includeLandingPage !== false,
      includeEmailCampaign: setup.includeEmailCampaign !== false,
      channel
    };
  }

  function campaignV3Diagnostic(code, message, details = {}) {
    return { code, message, details };
  }

  function emptyCampaignV3Groups() {
    return CAMPAIGN_V3_NODE_TYPES.reduce((groups, type) => {
      groups[type] = [];
      return groups;
    }, {});
  }

  function normalizeCampaignV3Node(node = {}, index = 0) {
    const type = String(node.type || "").trim();
    return {
      tempId: String(node.tempId || `campaign-v3-node-${index}`),
      type,
      title: String(node.title || type || `Campaign Node ${index + 1}`),
      description: String(node.description || ""),
      content: String(node.content || ""),
      metadata: node.metadata && typeof node.metadata === "object" ? { ...node.metadata } : {},
      social: node.social && typeof node.social === "object" ? { ...node.social } : {},
      landingPage: node.landingPage && typeof node.landingPage === "object" ? { ...node.landingPage } : {},
      imagePrompt: String(node.imagePrompt || "")
    };
  }

  function expectedCampaignV3Counts(setup) {
    return {
      "Idea": 1,
      "Campaign Variation": setup.variationCount,
      "Content": setup.variationCount,
      "Social Media Posting": setup.variationCount * setup.postsPerVariation,
      "Landing Page": setup.includeLandingPage ? 1 : 0,
      "Email Campaign": setup.includeEmailCampaign ? 1 : 0
    };
  }

  function countDiagnosticForType(type) {
    if (type === "Campaign Variation") return CAMPAIGN_V3_DIAGNOSTICS.WRONG_VARIATION_COUNT;
    if (type === "Content") return CAMPAIGN_V3_DIAGNOSTICS.WRONG_CONTENT_COUNT;
    if (type === "Social Media Posting") return CAMPAIGN_V3_DIAGNOSTICS.WRONG_SOCIAL_COUNT;
    if (type === "Landing Page") return CAMPAIGN_V3_DIAGNOSTICS.WRONG_LANDING_COUNT;
    if (type === "Email Campaign") return CAMPAIGN_V3_DIAGNOSTICS.WRONG_EMAIL_COUNT;
    return CAMPAIGN_V3_DIAGNOSTICS.MISSING_IDEA;
  }

  function buildCampaignV3PlanFromNodes(nodes = [], setup = {}) {
    const normalizedSetup = normalizeCampaignV3Setup(setup);
    const diagnostics = [];
    const groups = emptyCampaignV3Groups();
    const seenTempIds = new Set();

    const normalizedNodes = (Array.isArray(nodes) ? nodes : []).map(normalizeCampaignV3Node);
    normalizedNodes.forEach((node, index) => {
      if (!CAMPAIGN_V3_NODE_TYPES.includes(node.type)) {
        diagnostics.push(campaignV3Diagnostic(
          CAMPAIGN_V3_DIAGNOSTICS.INVALID_NODE_TYPE,
          `Node ${index + 1} has unsupported type ${node.type || "(empty)"}.`,
          { index, tempId: node.tempId, type: node.type }
        ));
        return;
      }
      if (seenTempIds.has(node.tempId)) {
        diagnostics.push(campaignV3Diagnostic(
          CAMPAIGN_V3_DIAGNOSTICS.DUPLICATE_NODE,
          `Duplicate campaign V3 tempId ${node.tempId}.`,
          { index, tempId: node.tempId }
        ));
      }
      seenTempIds.add(node.tempId);
      groups[node.type].push(node);
    });

    const expectedCounts = expectedCampaignV3Counts(normalizedSetup);
    Object.entries(expectedCounts).forEach(([type, expected]) => {
      const actual = groups[type].length;
      if (actual !== expected) {
        diagnostics.push(campaignV3Diagnostic(
          countDiagnosticForType(type),
          `Expected ${expected} ${type} node${expected === 1 ? "" : "s"}; received ${actual}.`,
          { type, expected, actual }
        ));
      }
    });

    if (diagnostics.length > 0) return { ok: false, plan: null, diagnostics, setup: normalizedSetup };

    const idea = groups.Idea[0];
    const landing = normalizedSetup.includeLandingPage ? groups["Landing Page"][0] : null;
    const email = normalizedSetup.includeEmailCampaign ? groups["Email Campaign"][0] : null;
    const lanes = [];
    for (let laneIndex = 0; laneIndex < normalizedSetup.variationCount; laneIndex += 1) {
      const socialStart = laneIndex * normalizedSetup.postsPerVariation;
      lanes.push({
        laneId: `campaign-v3-lane-${laneIndex + 1}`,
        variation: groups["Campaign Variation"][laneIndex],
        content: groups.Content[laneIndex],
        socials: groups["Social Media Posting"].slice(socialStart, socialStart + normalizedSetup.postsPerVariation)
      });
    }

    return {
      ok: true,
      plan: { idea, lanes, landing, email },
      diagnostics: [campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.OK, "Campaign V3 plan built successfully.")],
      setup: normalizedSetup
    };
  }

  function buildCampaignV3Edges(plan) {
    if (!plan?.idea || !Array.isArray(plan?.lanes)) return [];
    const edges = [];
    plan.lanes.forEach((lane) => {
      edges.push({ fromTempId: plan.idea.tempId, toTempId: lane.variation.tempId, type: "idea_to_variation", laneId: lane.laneId });
      edges.push({ fromTempId: lane.variation.tempId, toTempId: lane.content.tempId, type: "variation_to_content", laneId: lane.laneId });
      lane.socials.forEach((social) => {
        edges.push({ fromTempId: lane.content.tempId, toTempId: social.tempId, type: "content_to_social", laneId: lane.laneId });
        if (plan.landing) edges.push({ fromTempId: social.tempId, toTempId: plan.landing.tempId, type: "social_to_landing", laneId: lane.laneId });
        else if (plan.email) edges.push({ fromTempId: social.tempId, toTempId: plan.email.tempId, type: "social_to_email", laneId: lane.laneId });
      });
    });
    if (plan.landing && plan.email) edges.push({ fromTempId: plan.landing.tempId, toTempId: plan.email.tempId, type: "landing_to_email", laneId: "campaign-v3-funnel" });
    return edges;
  }

  function campaignV3PlanNodes(plan) {
    if (!plan?.idea || !Array.isArray(plan?.lanes)) return [];
    return [
      plan.idea,
      ...plan.lanes.flatMap((lane) => [
        lane.variation,
        lane.content,
        ...lane.socials
      ]),
      ...(plan.landing ? [plan.landing] : []),
      ...(plan.email ? [plan.email] : [])
    ];
  }

  function validateCampaignV3EdgeReferences(plan, edges) {
    const validIds = new Set(campaignV3PlanNodes(plan).map((node) => node.tempId));
    const diagnostics = [];
    edges.forEach((edge, index) => {
      if (!validIds.has(edge.fromTempId) || !validIds.has(edge.toTempId)) {
        diagnostics.push(campaignV3Diagnostic(
          CAMPAIGN_V3_DIAGNOSTICS.INVALID_EDGE_REFERENCE,
          `Edge ${index + 1} references a missing tempId.`,
          { index, edge }
        ));
      }
    });
    return diagnostics;
  }

  function layoutCampaignV3Plan(plan, setup = {}, origin = { x: 0, y: 0 }) {
    const normalizedSetup = normalizeCampaignV3Setup(setup);
    const edges = buildCampaignV3Edges(plan);
    const diagnostics = validateCampaignV3EdgeReferences(plan, edges);
    const positionedNodes = [];
    const originX = Number.isFinite(origin.x) ? origin.x : 0;
    const originY = Number.isFinite(origin.y) ? origin.y : 0;
    const rowHeight = Math.max(CAMPAIGN_V3_ROW_GAP, normalizedSetup.postsPerVariation * CAMPAIGN_V3_ITEM_GAP + 80);

    if (!plan?.idea || !Array.isArray(plan?.lanes)) {
      diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.LAYOUT_FAILED, "Campaign V3 layout requires a plan with idea and lanes."));
      return { ok: false, positionedNodes, edges, diagnostics };
    }

    const socialClusterHeight = Math.max(0, (normalizedSetup.postsPerVariation - 1) * CAMPAIGN_V3_ITEM_GAP);
    const funnelCenterY = originY + Math.max(0, ((plan.lanes.length - 1) * rowHeight + socialClusterHeight) / 2);
    positionedNodes.push({ ...plan.idea, laneId: "idea", column: "idea", x: originX + CAMPAIGN_V3_COLUMNS.idea, y: funnelCenterY });

    plan.lanes.forEach((lane, laneIndex) => {
      const rowY = originY + laneIndex * rowHeight;
      positionedNodes.push({ ...lane.variation, laneId: lane.laneId, column: "variation", x: originX + CAMPAIGN_V3_COLUMNS.variation, y: rowY });
      positionedNodes.push({ ...lane.content, laneId: lane.laneId, column: "content", x: originX + CAMPAIGN_V3_COLUMNS.content, y: rowY });
      lane.socials.forEach((social, socialIndex) => {
        positionedNodes.push({ ...social, laneId: lane.laneId, column: "social", x: originX + CAMPAIGN_V3_COLUMNS.social, y: rowY + socialIndex * CAMPAIGN_V3_ITEM_GAP });
      });
    });

    if (plan.landing) positionedNodes.push({ ...plan.landing, laneId: "campaign-v3-funnel", column: "landing", x: originX + CAMPAIGN_V3_COLUMNS.landing, y: funnelCenterY });
    if (plan.email) positionedNodes.push({ ...plan.email, laneId: "campaign-v3-funnel", column: "email", x: originX + CAMPAIGN_V3_COLUMNS.email, y: funnelCenterY });

    const invalidPosition = positionedNodes.find((node) => !Number.isFinite(node.x) || !Number.isFinite(node.y));
    if (invalidPosition) {
      diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.LAYOUT_FAILED, "Campaign V3 layout produced a non-finite position.", { tempId: invalidPosition.tempId }));
    }

    return { ok: diagnostics.length === 0, positionedNodes, edges, diagnostics: diagnostics.length ? diagnostics : [campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.OK, "Campaign V3 layout completed successfully.")] };
  }

  function createCampaignV3FakeCanvasAdapter() {
    let nodeCounter = 1;
    let edgeCounter = 1;
    const adapter = {
      committedNodes: [],
      committedEdges: [],
      unsavedCallCount: 0,
      activityLog: [],
      createNode(payload = {}, position = {}) {
        const node = {
          id: `fake-node-${nodeCounter++}`,
          tempId: payload.tempId,
          type: payload.type,
          title: payload.title || payload.type || "Campaign Node",
          x: position.x,
          y: position.y,
          payload: { ...payload }
        };
        adapter.committedNodes.push(node);
        adapter.activityLog.push({ action: "createNode", tempId: node.tempId, nodeId: node.id });
        return node;
      },
      createEdge(sourceNodeId, targetNodeId, edge = {}) {
        const committedEdge = {
          id: `fake-edge-${edgeCounter++}`,
          sourceNodeId,
          targetNodeId,
          sourceTempId: edge.fromTempId,
          targetTempId: edge.toTempId,
          type: edge.type,
          laneId: edge.laneId
        };
        adapter.committedEdges.push(committedEdge);
        adapter.activityLog.push({ action: "createEdge", sourceNodeId, targetNodeId, sourceTempId: edge.fromTempId, targetTempId: edge.toTempId });
        return committedEdge;
      },
      markUnsaved() {
        adapter.unsavedCallCount += 1;
        adapter.activityLog.push({ action: "markUnsaved" });
      }
    };
    return adapter;
  }

  function commitCampaignV3PlanToCanvas(layoutResult = {}, adapter = null) {
    const diagnostics = [];
    const createdNodes = [];
    const createdEdges = [];
    const tempIdToNodeId = new Map();
    const positionedNodes = Array.isArray(layoutResult.positionedNodes) ? layoutResult.positionedNodes : [];
    const edges = Array.isArray(layoutResult.edges) ? layoutResult.edges : [];

    if (!adapter || typeof adapter.createNode !== "function" || typeof adapter.createEdge !== "function" || typeof adapter.markUnsaved !== "function") {
      diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_ADAPTER_ERROR, "Campaign V3 commit requires createNode, createEdge, and markUnsaved adapter methods."));
      return { ok: false, createdNodes, createdEdges, tempIdToNodeId: {}, diagnostics };
    }

    positionedNodes.forEach((node) => {
      if (!node?.tempId) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_MISSING_NODE, "Positioned node is missing a tempId.", { node }));
        return;
      }
      if (tempIdToNodeId.has(node.tempId)) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_DUPLICATE_NODE, `Duplicate positioned node tempId ${node.tempId}.`, { tempId: node.tempId }));
        return;
      }
      try {
        const created = adapter.createNode(node, { x: node.x, y: node.y });
        if (!created?.id) {
          diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_ADAPTER_ERROR, "Adapter createNode did not return a node id.", { tempId: node.tempId }));
          return;
        }
        tempIdToNodeId.set(node.tempId, created.id);
        createdNodes.push(created);
      } catch (error) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_ADAPTER_ERROR, error?.message || "Adapter createNode failed.", { tempId: node.tempId }));
      }
    });

    edges.forEach((edge) => {
      const sourceNodeId = tempIdToNodeId.get(edge.fromTempId);
      const targetNodeId = tempIdToNodeId.get(edge.toTempId);
      if (!sourceNodeId) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_EDGE_MISSING_SOURCE, "Campaign V3 edge source was not committed before edge creation.", { edge }));
        return;
      }
      if (!targetNodeId) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_EDGE_MISSING_TARGET, "Campaign V3 edge target was not committed before edge creation.", { edge }));
        return;
      }
      try {
        const createdEdge = adapter.createEdge(sourceNodeId, targetNodeId, edge);
        createdEdges.push(createdEdge);
      } catch (error) {
        diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_ADAPTER_ERROR, error?.message || "Adapter createEdge failed.", { edge }));
      }
    });

    try {
      adapter.markUnsaved();
    } catch (error) {
      diagnostics.push(campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_ADAPTER_ERROR, error?.message || "Adapter markUnsaved failed."));
    }

    return {
      ok: diagnostics.length === 0,
      createdNodes,
      createdEdges,
      tempIdToNodeId: Object.fromEntries(tempIdToNodeId),
      diagnostics: diagnostics.length ? diagnostics : [campaignV3Diagnostic(CAMPAIGN_V3_DIAGNOSTICS.COMMIT_OK, "Campaign V3 fake canvas commit completed successfully.")]
    };
  }

  function createCampaignV3MockNode(type, laneIndex = 0, itemIndex = 0, overrides = {}) {
    const slug = type.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const suffix = type === "Idea" ? "root" : `${laneIndex + 1}-${itemIndex + 1}`;
    return {
      tempId: overrides.tempId || `mock-${slug}-${suffix}`,
      type,
      title: overrides.title || `${type} ${suffix}`,
      description: overrides.description || `${type} description ${suffix}`,
      content: overrides.content || `${type} content ${suffix}`,
      metadata: { channel: overrides.channel || "LinkedIn", funnelStage: type },
      social: type === "Social Media Posting" ? { platform: overrides.channel || "LinkedIn", caption: `Caption ${suffix}`, hashtags: "#funklix" } : {},
      landingPage: type === "Landing Page" ? { headerVisualPrompt: "Hero visual", headerClaim: `Claim ${suffix}`, problem: "Problem", solution: "Solution", trust: "Trust", cta: "CTA" } : {},
      imagePrompt: `${type} image prompt ${suffix}`,
      ...overrides
    };
  }

  function createCampaignV3MockNodes(setup = {}, order = "perfect") {
    const normalizedSetup = normalizeCampaignV3Setup(setup);
    const idea = createCampaignV3MockNode("Idea");
    const lanes = Array.from({ length: normalizedSetup.variationCount }, (_, laneIndex) => ({
      variation: createCampaignV3MockNode("Campaign Variation", laneIndex),
      content: createCampaignV3MockNode("Content", laneIndex),
      socials: Array.from({ length: normalizedSetup.postsPerVariation }, (_, socialIndex) => createCampaignV3MockNode("Social Media Posting", laneIndex, socialIndex))
    }));
    const landing = normalizedSetup.includeLandingPage ? createCampaignV3MockNode("Landing Page", 0, 0, { tempId: "mock-landing-page-campaign", title: "Landing Page Campaign" }) : null;
    const email = normalizedSetup.includeEmailCampaign ? createCampaignV3MockNode("Email Campaign", 0, 0, { tempId: "mock-email-campaign-campaign", title: "Email Campaign Campaign" }) : null;

    if (order === "grouped") {
      return [
        idea,
        ...lanes.map((lane) => lane.variation),
        ...lanes.map((lane) => lane.content),
        ...lanes.flatMap((lane) => lane.socials),
        ...(landing ? [landing] : []),
        ...(email ? [email] : [])
      ];
    }

    const perfect = [
      idea,
      ...lanes.flatMap((lane) => [lane.variation, lane.content, ...lane.socials]),
      ...(landing ? [landing] : []),
      ...(email ? [email] : [])
    ];

    if (order === "shuffled") {
      const [first, ...rest] = perfect;
      return [first, ...rest.map((node, index) => ({ node, key: (index * 7) % Math.max(1, rest.length) })).sort((a, b) => a.key - b.key).map((item) => item.node)];
    }

    return perfect;
  }

  function createCampaignV3MockCase(name, setup, order = "perfect", mutate = null, expectedOk = true, expectedCodes = [CAMPAIGN_V3_DIAGNOSTICS.OK]) {
    const nodes = createCampaignV3MockNodes(setup, order);
    const mutatedNodes = typeof mutate === "function" ? mutate(nodes) : nodes;
    return { name, setup: normalizeCampaignV3Setup(setup), nodes: mutatedNodes, expectedOk, expectedCodes };
  }

  function campaignV3MockCases() {
    const defaultSetup = { variationCount: 3, postsPerVariation: 3, includeLandingPage: true, includeEmailCampaign: true, channel: "LinkedIn" };
    return [
      createCampaignV3MockCase("perfect-order", defaultSetup, "perfect"),
      createCampaignV3MockCase("grouped-by-type", defaultSetup, "grouped"),
      createCampaignV3MockCase("shuffled-order", defaultSetup, "shuffled"),
      createCampaignV3MockCase("one-variation-one-post", { ...defaultSetup, variationCount: 1, postsPerVariation: 1 }, "perfect"),
      createCampaignV3MockCase("three-variations-three-posts", defaultSetup, "perfect"),
      createCampaignV3MockCase("ten-variations-twenty-posts", { ...defaultSetup, variationCount: 10, postsPerVariation: 20 }, "grouped"),
      createCampaignV3MockCase("landing-disabled", { ...defaultSetup, includeLandingPage: false }, "grouped"),
      createCampaignV3MockCase("email-disabled", { ...defaultSetup, includeEmailCampaign: false }, "grouped"),
      createCampaignV3MockCase("landing-and-email-disabled", { ...defaultSetup, includeLandingPage: false, includeEmailCampaign: false }, "grouped"),
      createCampaignV3MockCase("missing-email", defaultSetup, "grouped", (nodes) => nodes.filter((node, index) => !(node.type === "Email Campaign" && index === nodes.findIndex((candidate) => candidate.type === "Email Campaign"))), false, [CAMPAIGN_V3_DIAGNOSTICS.WRONG_EMAIL_COUNT]),
      createCampaignV3MockCase("missing-social-post", defaultSetup, "grouped", (nodes) => nodes.filter((node, index) => !(node.type === "Social Media Posting" && index === nodes.findIndex((candidate) => candidate.type === "Social Media Posting"))), false, [CAMPAIGN_V3_DIAGNOSTICS.WRONG_SOCIAL_COUNT]),
      createCampaignV3MockCase("extra-landing-page", defaultSetup, "grouped", (nodes) => [...nodes, createCampaignV3MockNode("Landing Page", 98, 0, { tempId: "mock-extra-landing" })], false, [CAMPAIGN_V3_DIAGNOSTICS.WRONG_LANDING_COUNT]),
      createCampaignV3MockCase("invalid-node-type", defaultSetup, "grouped", (nodes) => [{ ...nodes[0], type: "Invalid Campaign Node" }, ...nodes.slice(1)], false, [CAMPAIGN_V3_DIAGNOSTICS.INVALID_NODE_TYPE, CAMPAIGN_V3_DIAGNOSTICS.MISSING_IDEA]),
      createCampaignV3MockCase("correct-total-wrong-type-distribution", defaultSetup, "grouped", (nodes) => {
        const socialIndex = nodes.findIndex((node) => node.type === "Social Media Posting");
        const next = [...nodes];
        next[socialIndex] = createCampaignV3MockNode("Content", 77, 0, { tempId: "mock-extra-content-for-wrong-distribution" });
        return next;
      }, false, [CAMPAIGN_V3_DIAGNOSTICS.WRONG_CONTENT_COUNT, CAMPAIGN_V3_DIAGNOSTICS.WRONG_SOCIAL_COUNT])
    ];
  }

  return {
    CAMPAIGN_V3_NODE_TYPES,
    CAMPAIGN_V3_DIAGNOSTICS,
    CAMPAIGN_V3_COLUMNS,
    normalizeCampaignV3Setup,
    buildCampaignV3PlanFromNodes,
    buildCampaignV3Edges,
    layoutCampaignV3Plan,
    campaignV3PlanNodes,
    validateCampaignV3EdgeReferences,
    createCampaignV3FakeCanvasAdapter,
    commitCampaignV3PlanToCanvas,
    createCampaignV3MockNode,
    createCampaignV3MockNodes,
    campaignV3MockCases
  };
}));
