# Node Relationship Intelligence Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Runtime/product architecture audit |
| Scope | Node Relationship Intelligence foundation for Campaign Canvas |
| Runtime behavior changes | None |
| Files changed | `docs/audits/2026-07-06-node-relationship-intelligence-audit.md` |

## Summary

Node Relationship Intelligence should begin as a read-only interpretation layer over the existing Campaign Canvas graph. The current runtime already stores nodes in `state.nodes` and edges in `state.edges`, renders visual connections from those edges, and uses edge direction in limited places such as inheritance, connected context, Mission Insight downstream counts, and network animation. However, the current edge model is still primarily a Canvas relationship model, not a fully governed dependency system.

The safe foundation is to document relationship semantics before implementation. Future helpers should read the graph, normalize current edge shapes conservatively, expose deterministic relationship maps, and avoid writing node data, edge data, storage payloads, Dashboard state, AI memory, or analytics conclusions.

## Documents Read

- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-06-28-dashboard-todays-focus-audit.md`
- `docs/audits/2026-07-06-dashboard-campaign-health-card-audit.md`
- `docs/audits/2026-07-06-dashboard-campaign-health-refinement-audit.md`
- `docs/audits/2026-07-06-dashboard-mission-insight-audit.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`

## Audit Findings

1. Campaign Canvas already has a graph-shaped runtime model: `state.nodes` and `state.edges` are initialized as arrays and persisted inside the serialized canvas state.
2. The current edge storage shape is predominantly a two-item array: `[fromId, toId]`.
3. Some helper code already tolerates object edge shapes with `source` and `target`, but core creation, deletion, rendering, and root detection assume array edges.
4. Edges are directional in implementation because creation calls `addEdge(fromId, toId)`, rendering draws from source to target, inherited fields flow from source to target, and connected context treats incoming edges as parents and outgoing edges as children.
5. Edge direction should not yet be treated as a guaranteed business dependency because users can create visual links freely and existing payloads do not store explicit relationship type, dependency intent, or confidence.
6. Nodes already contain enough metadata for first-pass read-only relationship intelligence: title, type, status, owner fields, content, goal, audience, channel, funnel stage, tone, and optional timestamps.
7. Dashboard already reads nodes and edges in read-only ways for Today’s Focus, Campaign Health, Suggested Opportunities, and Mission Insight. Node Relationship Intelligence should strengthen those deterministic reads without becoming AI or analytics.
8. The first implementation PR should be helper-only and should not change Canvas rendering, save/load, autosave, node creation, node deletion, edge creation, edge deletion, Dashboard copy, AI Brain behavior, APIs, storage, or diagnostics.

## Current Node/Edge Model

### Runtime storage

The runtime owns Canvas graph state in memory:

```text
state.nodes = []
state.edges = []
```

`serializeState()` persists nodes, edges, counters, zoom, activity, schema version, and canvas metadata. `applyCampaignState()` hydrates nodes and edges from a loaded board/local payload, sanitizes nodes, renders nodes, and redraws links.

### Available node fields

Observed current node fields include:

- `id`: generated as `node-${state.nodeCounter++}` for runtime-created nodes.
- `title`: created as an empty string and later edited/generated.
- `type`: one of the Canvas node types such as `Idea`, `Campaign Variation`, `Content`, `Social Media Posting`, `Landing Page`, `Email Campaign`, `Visual Concept`, or `Image Brief`.
- `status`: defaults to `Draft` and normalizes through the existing node status model.
- `owner`: no single `owner` object is present in the core node shape today; ownership is represented through `ownerEmail`, `ownerName`, and `ownerAvatar` when assigned.
- `content`: created as an empty string and used as general node body text.
- `goal`: created as an empty string and inherited from a source node when missing.
- `audience`: created as an empty string and inherited from a source node when missing.
- `channel`: created as an empty string and inherited from a source node when missing.
- `updatedAt`: not part of the default `createNode()` shape; Dashboard timestamp fallback code checks `updatedAt`, `modifiedAt`, `createdAt`, and `time` when present on loaded or generated nodes.

Additional useful fields already present include `funnelStage`, `tone`, `images`, `social`, `landingPage`, `postits`, `position`, `compact`, `reactions`, `tags`, `variants`, and generation/loading cleanup fields removed by persistence sanitization.

### Available edge/connection fields

Observed current edge fields include:

- `source`: not stored as a named field in the dominant runtime edge shape; the source is array index `0` in `[fromId, toId]`.
- `target`: not stored as a named field in the dominant runtime edge shape; the target is array index `1` in `[fromId, toId]`.
- `id`: no edge ID is created by `addEdge()` today.
- Relationship metadata: no explicit relationship type, dependency label, confidence, blocker reason, ordering, createdBy, createdAt, or updatedAt is stored on edges today.

Some read paths support object-style edges with `source` / `target` as a compatibility measure, but the write path pushes arrays.

### Current Canvas rendering use of edges

Canvas rendering uses `state.edges` to draw SVG paths between node bottom-center points. For each `[from, to]` edge, `drawLinks()` locates the source and target node DOM positions, draws a curved path, applies a reveal class when either endpoint was just connected, and attaches a click handler that removes the edge when the board is editable.

The renderer treats edges as visual directed links for path coordinates, but the SVG path itself does not currently render arrowheads or relationship labels. Users experience edges primarily as visible connections between campaign nodes.

### Creation, connection, disconnection, deletion, and persistence

- Nodes are created through `createNode()`, which builds the default node object, pushes it into `state.nodes`, renders the card, selects it, updates list/empty state, draws links, records activity, saves local canvas state, and returns the node.
- When `createNode()` receives a `parentId`, it reads the parent, positions the new node near the parent, inherits missing audience/goal/channel values, may inherit social images, and calls `addEdge(parent.id, node.id)`.
- New connected nodes can also be created from connector handles. The connector flow creates a node at the dropped position and then calls `addEdge(fromId, newNode.id)`.
- Existing nodes can be connected with the link handle. The runtime starts an active connection from a source node and calls `addEdge(fromId, toId)` when the pointer/click lands on another node.
- `addEdge()` prevents read-only edits, rejects empty/self edges, prevents duplicate exact `[fromId, toId]` edges, pushes `[fromId, toId]`, records activity, applies inherited source metadata to the target, marks endpoints as recently connected for presentation, updates cards, and redraws links.
- Edges are disconnected by clicking the rendered SVG path when editable. The handler splices the edge from `state.edges`, records activity, redraws links, updates node cards, saves canvas state, and marks unsaved.
- Nodes are deleted through `removeNode()`, which removes the node from `state.nodes`, revokes image object URLs, filters out all edges whose source or target equals the deleted node ID, removes the DOM card, updates selection/inspector/list/empty state, redraws links, records activity, and saves local canvas state.
- Persistence stores edges exactly as part of `serializeState()` and hydrates them through `applyCampaignState()` without adding relationship metadata.

### Is edge direction semantically meaningful today?

Edge direction is partially meaningful but not authoritative enough for hard dependency logic.

Direction is meaningful in these runtime behaviors:

- Source-to-target creation naming: `addEdge(fromId, toId)`.
- Parent/child connected context: incoming edges are parent nodes and outgoing edges are child nodes.
- Field inheritance: audience, goal, channel, and sometimes images flow from source to target.
- Network animation: root detection and traversal follow `[from, to]`.
- Dashboard Mission Insight: direct downstream count uses existing edge direction for focus-node copy.

Direction is not yet fully semantic because:

- No edge metadata distinguishes visual grouping from dependency, sequence, unlock, variant, reference, or funnel progression.
- No edge confirmation workflow captures user intent.
- No migration has validated old board edge direction.
- The current Canvas UI does not expose relationship labels or dependency meaning.

Future logic may use direction as a conservative hint, but must phrase conclusions as graph relationships unless and until explicit dependency metadata exists.

## Relationship Concepts

These concepts are safe as read-only graph concepts over the current Canvas model:

- **Upstream nodes**: nodes with direct or transitive paths into a selected node. In the current edge shape, upstream means nodes that can reach `nodeId` through `[source, target]` edges.
- **Downstream nodes**: nodes directly or transitively reachable from a selected node by following outgoing edges.
- **Root nodes**: nodes with no incoming edges. These are candidate campaign starting points, not guaranteed strategic roots.
- **Leaf nodes**: nodes with no outgoing edges. These are candidate terminal assets or endpoint ideas, not guaranteed final deliverables.
- **Direct dependencies**: direct upstream nodes for a selected node. This term should be used carefully because current edges may be visual rather than dependency-confirmed.
- **Downstream assets**: downstream nodes whose type suggests execution/output, such as Content, Social Media Posting, Landing Page, Email Campaign, Visual Concept, or Image Brief. This should remain type-based, not performance-based.
- **Blocked paths**: paths where an incomplete or attention-needed upstream node precedes downstream work. In the first implementation, “blocked” should mean status-derived risk only, not a hard workflow lock.
- **Unlock potential**: the count or description of incomplete downstream nodes that could benefit if an upstream node moves forward. This is an attention signal, not an ROI forecast.
- **Campaign paths**: ordered paths from root nodes through connected downstream nodes. Paths should be deterministic graph paths, not inferred funnels unless node types/stages support that wording.

## Status-Aware Logic

Status-aware relationship logic should use the existing status model only:

- `Approved` / `Published` = complete.
- `In Review` = waiting for review.
- `Draft` = unfinished.
- `Needs Changes` = needs attention.

Recommended first-pass status behavior:

1. A path is **complete** only when every node in the path is `Approved` or `Published`.
2. A path is **waiting for review** when the first incomplete upstream blocker is `In Review` and no earlier node needs changes.
3. A path **needs attention** when any upstream node in the path is `Needs Changes`.
4. A path is **unfinished** when the earliest incomplete upstream node is `Draft`.
5. Unknown or missing statuses should normalize through the existing runtime status helper where available; otherwise they should be treated conservatively as `Draft` for planning copy.
6. Status logic must not mutate statuses, create tasks, assign owners, or block editing.

## Future Helper Candidates

The first helper candidates should be deterministic, read-only, and side-effect free:

### `getNodeRelationshipMap()`

Returns a normalized relationship map for the current Canvas:

- node ID
- direct upstream IDs
- direct downstream IDs
- transitive upstream IDs
- transitive downstream IDs
- root/leaf booleans
- normalized node status
- optional path summaries

It should support current array edges first and tolerate object edges only as compatibility.

### `getNodeDownstreamCount(nodeId)`

Returns the number of unique direct downstream nodes for a node. A later option may expose transitive count, but the first version should be explicit about directness.

### `getNodeUpstreamCount(nodeId)`

Returns the number of unique direct upstream nodes for a node.

### `getRootCampaignNodes()`

Returns nodes with no incoming edges, sorted deterministically by current node order. It should not claim they are strategic campaign objectives unless their type/fields support that wording.

### `getLeafAssetNodes()`

Returns nodes with no outgoing edges, optionally filtered or labeled by asset-like node type. It should not claim deployment readiness.

### `getBlockedPaths()`

Returns graph paths where incomplete upstream statuses may be holding downstream work at risk. First implementation should use language like “attention paths” or “status-blocked paths” unless product copy is reviewed.

### `getNextUnlockNode()`

Returns a single node candidate whose completion or review would unlock the most downstream unfinished nodes. Tie-breakers should be deterministic: Needs Changes before In Review before Draft, then higher downstream count, then current node order.

## Product Areas Unlocked

### Dashboard Mission Insight

Relationship maps can make Mission Insight explain why today’s priority matters: direct downstream assets, root-to-leaf path position, status attention, and next unlock potential. It should remain deterministic and short.

### Today’s Focus

Today’s Focus can prioritize incomplete nodes that sit upstream of multiple unfinished downstream nodes, while preserving assignment-aware ordering from the existing audit. It should not invent tasks.

### Campaign Health v2

Campaign Health can evolve from status/type totals into graph-aware readiness: path completion, root coverage, leaf assets, review bottlenecks, and status-risk paths. This should remain read-only and should not become a persisted health model initially.

### Suggested Opportunities

Suggested Opportunities can recommend relationship-aware actions such as “review the upstream draft before expanding assets” or “connect isolated content to a campaign path.” It must avoid performance and conversion claims.

### Funnel Simulator with ICP

A relationship map can provide safe campaign path context to a future simulator: root idea, downstream content, landing page, email/social sequence, and audience/goal/channel fields. This audit does not implement simulation behavior.

### AI Brain v2

AI Brain can receive read-only Canvas relationship context so it understands which nodes are upstream/downstream and where status attention exists. It should not write relationships, create memory, or treat visual edges as confirmed dependency truth without metadata.

### Brand Avatar feedback

Brand Avatar feedback can eventually reference where a node sits in the campaign path: upstream strategy, mid-funnel asset, endpoint asset, or isolated node. Feedback should remain brand/contextual rather than performance-inferred.

### Real-time collaboration

Relationship context can help collaborators understand who is editing an upstream blocker or downstream asset. This should be audit-only until collaboration/event semantics are defined.

### Team Activity

Activity can eventually summarize graph-relevant events: node connected, node disconnected, upstream status changed, path progressed. Current activity already records node and edge events, but no new event log behavior should be added in the first helper PR.

### Insights / Learning Loop

Insights can later compare graph structure to outcomes after explicit analytics and learning ownership exists. Until then, graph intelligence should not become learning, analytics, or Brand truth.

## What Not To Infer Yet

Node Relationship Intelligence must not infer:

- Performance.
- Conversion quality.
- User intent beyond existing node and edge fields.
- Real dependencies when edge direction is unclear or unlabeled.
- Deployment readiness without deployment data.
- Asset quality without review/simulation/analytics evidence.
- Brand truth changes.
- Campaign outcome likelihood.
- Team accountability beyond explicit owner fields.
- Cross-board or cross-brand relationships.

## Risks

1. **Treating visual edges as semantic dependencies too early**: current edges may represent visual grouping, generation flow, sequence, inspiration, or dependency. Product copy must remain conservative.
2. **Breaking Canvas rendering**: core rendering assumes array edges. Any normalization helper must not rewrite `state.edges`.
3. **Changing save/load payloads**: adding edge IDs or metadata prematurely would affect board compatibility and autosave payloads.
4. **Adding writes too early**: relationship intelligence should first be derived in memory only.
5. **Confusing graph intelligence with AI**: first helpers should be deterministic graph utilities, not model-generated reasoning.
6. **Over-prioritizing graph centrality**: a highly connected node is not automatically the most valuable marketing asset.
7. **Overstating blocked paths**: status-derived blockage should be framed as “may be blocking” or “attention needed,” not as enforced workflow state.
8. **Cycle handling**: user-created edges may create cycles. Helpers must avoid infinite traversal and report cycles conservatively if needed.
9. **Old board compatibility**: older boards may contain unexpected edge shapes or missing node IDs. Helpers should ignore invalid edges rather than mutate payloads.

## Recommended PR Sequence

### PR A: Passive relationship map helper only

Add a side-effect-free helper that normalizes current edges into direct upstream/downstream maps, root nodes, leaf nodes, and basic path data. No UI, diagnostics, persistence, or Dashboard changes.

### PR B: Diagnostics for relationship map

Add developer-facing diagnostics that expose map counts and invalid edge detection without changing user-facing behavior.

### PR C: Mission Insight uses relationship map more clearly

Replace ad hoc downstream counting with the relationship map and improve deterministic copy while keeping Dashboard read-only.

### PR D: Campaign Health v2 status from relationship map

Add graph-aware health indicators such as path progress and status attention paths. Do not persist health.

### PR E: AI Brain read-only canvas relationship context

Allow AI Brain prompts to read summarized relationship context. No AI writes to nodes, edges, Brand Brain, or storage.

### PR F: Funnel Simulator architecture audit

Audit how campaign paths, ICP fields, and node content should feed future simulation without creating runtime simulation behavior.

### PR G: Collaboration/Event Log architecture audit

Audit how relationship changes should appear in real-time collaboration, activity, and future event logs before adding new event semantics.

## Acceptance Criteria for Future First Implementation PR

The first implementation PR should satisfy all of the following:

- Adds only read-only helper code.
- Does not modify `state.nodes` or `state.edges`.
- Does not modify node creation, connection, disconnection, deletion, rendering, dragging, inspector behavior, save/load, autosave, Dashboard, AI Brain, Brand Core, APIs, storage, or diagnostics.
- Supports `[sourceId, targetId]` edges as the primary shape.
- Safely tolerates object-style edge compatibility without rewriting existing payloads.
- Ignores invalid edges whose endpoints are missing.
- Handles cycles without infinite loops.
- Uses deterministic sorting based on current node order.
- Uses existing statuses only.
- Includes tests or checks appropriate to the repo’s current test surface.
- Documents that edge direction is a conservative graph hint, not a confirmed dependency contract.

## Runtime Confirmation

This audit PR does not:

- modify `app.js`
- modify `index.html`
- modify `styles.css`
- add helpers
- change Canvas rendering
- change node data
- change edge data
- change save/load
- change autosave
- change Dashboard
- change AI Brain
- change Brand Core
- add APIs
- add AI
- add storage
- add diagnostics
- implement runtime behavior

It creates documentation only.
