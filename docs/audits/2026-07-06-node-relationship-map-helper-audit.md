# Node Relationship Map Helper Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Node Relationship Intelligence PR A implementation audit |
| Scope | Passive read-only relationship map helper for existing Campaign Canvas nodes and edges |
| Runtime behavior changes | None; helper reads existing state only |
| Files changed | `app.js`, `docs/audits/2026-07-06-node-relationship-map-helper-audit.md` |

## Summary

This PR implements Node Relationship Intelligence PR A: a passive relationship map helper that reads the existing Canvas graph and returns a normalized, deterministic snapshot of relationships.

The helper does not create semantic dependency behavior. Edges remain graph relationships only. It does not change node data, edge data, Canvas rendering, save/load, autosave, routing, Dashboard behavior, AI Brain behavior, APIs, storage, UI, or diagnostics beyond a manual debug function.

## Documents Read

- `docs/audits/2026-07-06-node-relationship-intelligence-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`

## Audit Findings

1. The runtime already stores Canvas graph state in `state.nodes` and `state.edges`.
2. The dominant runtime edge shape remains `[fromId, toId]`.
3. Some read code already tolerates object edge shapes, but core Canvas behavior still assumes array edges.
4. A safe first implementation can read the graph and return relationship metadata without mutating state or altering existing consumers.
5. Exposing a manual debug function is consistent with existing `window.debug*` helper patterns and avoids UI/runtime behavior changes.

## Helper Location

The helper was added in `app.js` near existing Dashboard graph helper code, before `getDashboardEdgeSource()`, `getDashboardEdgeTarget()`, and the Dashboard downstream-count helper.

This keeps graph-reading code close to the current read-only Dashboard relationship usage without changing Dashboard behavior.

## Helper Shape

### `getNodeRelationshipMap()`

Returns an object with:

- `nodesById`: object keyed by node ID. Values are shallow copies of current nodes so the helper itself does not expose the exact top-level node objects.
- `outgoingByNodeId`: object keyed by node ID, with arrays of direct downstream node IDs.
- `incomingByNodeId`: object keyed by node ID, with arrays of direct upstream node IDs.
- `roots`: node IDs with no valid incoming edges.
- `leaves`: node IDs with no valid outgoing edges.
- `nodeCount`: count of current nodes with IDs.
- `edgeCount`: count of valid normalized edges whose endpoints both exist.
- `hasCycles`: boolean from lightweight DFS over valid graph edges.
- `invalidEdges`: array of invalid edge records whose source or target is missing or whose referenced endpoint node is absent.

### Convenience helpers

- `getNodeDownstreamCount(nodeId)`: returns direct outgoing count for a node from the relationship map.
- `getNodeUpstreamCount(nodeId)`: returns direct incoming count for a node from the relationship map.

### Manual debug exposure

The helper is exposed as:

```js
window.debugNodeRelationshipMap = getNodeRelationshipMap;
```

This is manual debug-only access. It does not render UI, write state, persist data, or alter Canvas behavior.

## Edge Normalization

The helper accepts these conservative edge shapes:

1. `[fromId, toId]`
2. `{ from, to }`
3. `{ fromId, toId }`
4. `{ source, target }`

Normalization returns a read-only interpretation of source and target values for relationship-map construction. It does not rewrite `state.edges`, add IDs, add metadata, or migrate old payloads.

Unsupported or incomplete edge shapes are retained in `invalidEdges` when they cannot resolve to valid existing source and target nodes.

## No Mutation Guarantee

The helper only reads `state.nodes` and `state.edges`.

It does not:

- push, splice, filter, sort, or assign back to `state.nodes`
- push, splice, filter, sort, or assign back to `state.edges`
- call save/load/autosave functions
- call Canvas rendering functions
- call Dashboard rendering functions
- write local storage
- call APIs
- mutate node statuses
- mutate ownership fields
- create relationship metadata

Returned relationship arrays are newly constructed arrays. `nodesById` contains shallow node copies to avoid top-level mutation of runtime node objects through the helper result.

## Invalid Edge Handling

If an edge references a missing node, the helper includes an entry in `invalidEdges` and excludes that edge from `edgeCount`, incoming maps, outgoing maps, roots/leaves impact, and cycle detection.

Invalid edges are never removed or repaired by this PR.

Each invalid edge entry includes:

- `index`
- `source`
- `target`
- `reason`
- original `edge`

## Cycle Detection Decision

This PR includes lightweight cycle detection using depth-first traversal over valid normalized edges.

The algorithm is intentionally small and local:

- It checks valid relationships only.
- It uses `visiting` and `visited` sets.
- It returns a boolean `hasCycles`.
- It does not enumerate cycles, alter edges, or block Canvas behavior.

Future PRs may add richer cycle reporting if diagnostics or graph UI require it.

## Future Consumers

Future read-only consumers can use this helper as the foundation for:

- Dashboard Mission Insight
- Today’s Focus prioritization
- Campaign Health v2
- Suggested Opportunities
- AI Brain read-only Canvas context
- Funnel Simulator architecture
- Collaboration/Event Log architecture
- Insights / Learning Loop planning

Those consumers should be introduced in separate PRs and should preserve the rule that edge direction is a graph hint, not a confirmed dependency contract.

## Runtime Confirmation

This PR does not:

- change node data
- change edge data
- change Canvas rendering
- change save/load
- change autosave
- change routing
- change Dashboard
- change AI Brain
- add APIs
- add storage
- add UI
- infer performance
- infer real dependency intent
- create semantic dependencies

It adds passive read-only helper code and a documentation audit only.

## Manual QA

Recommended manual QA:

1. Open a board with connected nodes.
2. Call `window.debugNodeRelationshipMap()` in the browser console.
3. Confirm `nodeCount` matches the current Canvas node count.
4. Confirm `edgeCount` matches valid current Canvas connections.
5. Confirm `roots` and `leaves` look plausible for the visible graph.
6. Move nodes and confirm Canvas rendering remains unchanged.
7. Connect nodes and confirm Canvas behavior remains unchanged.
8. Delete nodes and confirm Canvas behavior remains unchanged.
9. Confirm invalid edges, if present, are reported but not removed.
