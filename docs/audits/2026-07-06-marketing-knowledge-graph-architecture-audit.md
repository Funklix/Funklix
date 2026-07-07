# Marketing Knowledge Graph Architecture Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Product architecture audit |
| Scope | Canonical Marketing Knowledge Graph conceptual architecture |
| Runtime behavior changes | None |
| Files changed | `docs/product/marketing-knowledge-graph.md`, `docs/audits/2026-07-06-marketing-knowledge-graph-architecture-audit.md` |

## Summary

This audit supports the creation of `docs/product/marketing-knowledge-graph.md`, the canonical conceptual architecture for the Marketing Knowledge Graph.

The document is needed because Funklix now has foundational architecture for Workspace, Brand Consciousness, Product Intelligence, Product Knowledge ownership, runtime alignment, and Node Relationship Intelligence, but it does not yet have a single canonical language for the graph that connects those concepts.

This PR is documentation-only. It performs no runtime work.

## Documents Read

- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-07-06-node-relationship-intelligence-audit.md`
- `docs/audits/2026-07-06-node-relationship-map-helper-audit.md`

## Why This Document Is Needed

Funklix is evolving from a Campaign Canvas into a Marketing Operating System. Existing architecture defines ownership and product surfaces, while recent Node Relationship Intelligence work defines how current runtime graph relationships can be read safely.

What was missing is the conceptual layer that explains what the graph is.

Without a canonical Marketing Knowledge Graph document, future product work could treat Canvas nodes as visual blocks, Dashboard cards as independent summaries, AI Brain as the reasoning source of truth, or Insights as detached observations. The graph architecture prevents that drift by defining the graph as the shared marketing context that product surfaces read, summarize, simulate, reason over, and learn from.

## Relationship to Workspace

Workspace administers Brands. It owns membership, roles, billing, settings, integrations, and administrative boundaries.

The Marketing Knowledge Graph does not belong to Workspace directly. Workspace can control access to Brands and Boards, but it should not own campaign meaning, Brand truth, graph context, AI memory, or learning.

## Relationship to Brand

Brand owns the Marketing Knowledge Graph.

This aligns with the existing architecture that Brand is the primary working context and Brand Consciousness is the persistent intelligence container. The graph becomes one of the main ways Brand knowledge is expressed through campaigns, nodes, relationships, paths, outcomes, and learning.

## Relationship to Node Relationship Intelligence

Node Relationship Intelligence is the first graph-reading capability. It can identify roots, leaves, upstream/downstream relationships, blocked paths, unlock potential, and campaign paths from current graph structures.

The Marketing Knowledge Graph architecture is broader. It defines why those relationships matter, how they fit into Brand intelligence, and how future semantic relationships can evolve beyond current runtime edges.

Current runtime edges remain implementation details. Semantic relationships come later.

## Relationship to Dashboard / Mission Control

Mission Control should summarize the graph, not become its own source of truth.

Dashboard cards such as Campaign Health, Today’s Focus, Suggested Opportunities, and Mission Insight should eventually derive from graph structure, node status, evidence, outcomes, and Brand context. They should route users back to the owning graph objects instead of duplicating or inventing graph truth.

## Relationship to AI Brain

AI Brain reasons over the graph.

It should use graph context to understand campaign structure, decisions, bottlenecks, unlocks, paths, assets, Brand constraints, and evidence. It should not replace the graph or become the source of truth for relationships, approvals, Brand knowledge, analytics, or decisions.

## Relationship to Funnel Simulator

Funnel Simulator needs Campaign Paths and Journeys.

The Marketing Knowledge Graph provides the conceptual structure for simulating customer movement through connected campaign objects. Future simulator work should evaluate paths, decision points, objections, proof, offers, and conversion movement through the graph rather than scoring isolated assets without context.

## Relationship to Runtime Alignment

Runtime Alignment Readiness identified that current runtime ownership is partially aligned at the Canvas and Node level, but still needs stronger Workspace, Active Brand, Board, and autosave ownership alignment.

This architecture document does not change runtime alignment. It clarifies the target conceptual model so future runtime migrations can preserve ownership boundaries: Workspace administers, Brand owns intelligence, Boards contain campaign work, Canvas presents graph interaction, and graph objects carry marketing meaning.

## Why No Runtime Work Was Performed

No runtime work was performed because this PR defines concepts only.

It does not:

- modify `app.js`
- modify `campaign-v3.js`
- modify `index.html`
- modify `styles.css`
- add helper functions
- add APIs
- add database changes
- add storage
- change Canvas behavior
- change save/load
- change autosave
- change Dashboard
- change AI Brain
- change Brand Core
- infer performance
- create semantic relationships

The architecture must be stable before implementation expands.

## Future Implementation Implications

Future implementation should use this document before adding graph-related features.

Implications include:

1. Relationship Intelligence should remain read-only until semantic relationship types are explicitly designed.
2. Campaign Health should derive from graph structure, node status, evidence, and outcomes rather than arbitrary scoring.
3. Mission Control should summarize graph truth without owning it.
4. AI Brain should consume graph context without becoming graph storage.
5. Brand Avatar should use graph position to make feedback contextual without inventing relationships.
6. Funnel Simulator should simulate Journeys through Campaign Paths.
7. Insights should observe outcomes mapped to graph objects.
8. Learning Loop flows should require governed review before Brand Consciousness changes.
9. Analytics, deployment, experiments, variants, confidence, weighted relationships, and optimization should be incremental extensions.
10. Runtime migrations must continue to protect Canvas rendering, save/load, autosave, Board ownership, and Brand ownership boundaries.

## Runtime Confirmation

This is a documentation-only architecture PR.

No application runtime files were changed.
