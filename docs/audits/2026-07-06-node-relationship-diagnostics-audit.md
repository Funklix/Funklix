# Node Relationship Diagnostics Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Node Relationship Intelligence PR B implementation audit |
| Scope | Debug-only relationship diagnostics for the passive Canvas relationship map |
| Runtime behavior changes | None; diagnostics read existing state only |
| Files changed | `app.js`, `docs/audits/2026-07-06-node-relationship-diagnostics-audit.md` |

## Summary

This PR implements Node Relationship Intelligence PR B: Relationship Diagnostics.

The change makes the passive relationship map observable through debug diagnostics only. It reuses the existing `getNodeRelationshipMap()` helper and reports lightweight graph counts without changing Canvas behavior, node data, edge data, save/load, autosave, Dashboard UI, AI Brain, APIs, storage, or graph state.

## Documents Read

- `docs/audits/2026-07-06-node-relationship-intelligence-audit.md`
- `docs/audits/2026-07-06-node-relationship-map-helper-audit.md`
- `docs/product/marketing-knowledge-graph.md`
- `docs/product/simulation-architecture.md`
- `docs/constitution/engineering-constitution.md`
- `app.js`

## Audit Findings

1. PR A already introduced a passive `getNodeRelationshipMap()` helper that normalizes existing edge shapes and reports roots, leaves, cycles, valid edge count, and invalid edges.
2. Existing runtime alignment diagnostics are already exposed manually through `window.debugRuntimeAlignmentDiagnostics()`.
3. The safest PR B implementation is to reuse the relationship map and add summary counts to runtime diagnostics without adding visible UI.
4. Diagnostics must remain Graph Intelligence only: deterministic counts from current graph state, not semantic dependency inference or performance interpretation.
5. Future product surfaces should not consume these debug diagnostics directly as product UI; they are an observability bridge for future implementation audits.

## Diagnostics Shape

A new read-only helper, `getNodeRelationshipDiagnostics()`, returns:

- `nodeCount`: number of current nodes with IDs from the relationship map.
- `edgeCount`: number of valid normalized graph edges whose endpoints exist.
- `rootCount`: number of nodes with no valid incoming edges.
- `leafCount`: number of nodes with no valid outgoing edges.
- `invalidEdgeCount`: number of edges that could not resolve to existing source/target nodes.
- `hasCycles`: boolean reported by the passive relationship map.
- `isolatedNodeCount`: number of nodes with no valid incoming or outgoing edges.

The diagnostic object is included in `buildRuntimeAlignmentDiagnostics()` under `relationshipGraph`.

## Relationship Map Reuse

The diagnostics helper calls `getNodeRelationshipMap()` and derives counts from its returned data.

It does not duplicate edge normalization rules, rewrite graph state, create semantic relationship metadata, or inspect Canvas DOM rendering.

## Debug Exposure

Relationship diagnostics are observable through:

```js
window.debugRuntimeAlignmentDiagnostics()
```

The returned object includes:

```js
relationshipGraph: {
  nodeCount,
  edgeCount,
  rootCount,
  leafCount,
  invalidEdgeCount,
  hasCycles,
  isolatedNodeCount
}
```

A direct debug helper is also exposed as:

```js
window.debugNodeRelationshipDiagnostics()
```

The full relationship map remains available through the existing PR A manual helper:

```js
window.debugNodeRelationshipMap()
```

## No Behavior Changes

This PR does not:

- change Canvas rendering
- change node data
- change edge data
- change save/load
- change autosave
- change routing
- change Dashboard UI
- change AI Brain
- add APIs
- add storage
- add visible UI
- infer semantic dependency intent
- infer performance
- modify graph state

## No Semantic Inference

The diagnostics report counts only.

They do not infer:

- real dependencies
- conversion quality
- campaign quality
- user intent
- deployment readiness
- performance
- offer strength
- persona fit
- simulation outcomes

Current edges remain graph relationships, not confirmed semantic dependencies.

## Future Consumers

These diagnostics can support future implementation planning for:

- Campaign Health v2
- Mission Insight
- Funnel Simulator
- AI Brain v2

Future product consumers should use dedicated product helpers, not debug diagnostics, when moving from observability to user-facing behavior.

## Runtime Confirmation

Relationship diagnostics are debug-only and read-only. They reuse the existing passive relationship map and expose summary counts for manual inspection.

No product behavior changed.

## Manual QA

Recommended manual QA:

1. Open a connected board.
2. Call `window.debugRuntimeAlignmentDiagnostics()`.
3. Confirm the returned object includes `relationshipGraph`.
4. Confirm `relationshipGraph.nodeCount`, `edgeCount`, `rootCount`, `leafCount`, `invalidEdgeCount`, `hasCycles`, and `isolatedNodeCount` look plausible.
5. Call `window.debugNodeRelationshipMap()`.
6. Confirm full relationship-map counts match the current board.
7. Move, connect, and delete nodes.
8. Confirm Canvas behavior remains unchanged.
