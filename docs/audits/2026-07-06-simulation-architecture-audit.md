# Simulation Architecture Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Product architecture audit |
| Scope | Canonical Simulation conceptual architecture |
| Runtime behavior changes | None |
| Files changed | `docs/product/simulation-architecture.md`, `docs/audits/2026-07-06-simulation-architecture-audit.md` |

## Summary

This audit supports the creation of `docs/product/simulation-architecture.md`, the canonical conceptual architecture for Simulation in Funklix.

Simulation is needed as a first-class product capability because Funklix is evolving into a Marketing Operating System where teams and AI need to test journeys, personas, offers, scenarios, and campaign readiness against Brand context and Marketing Knowledge Graph truth before and after execution.

This PR is documentation-only. It performs no runtime work.

## Documents Read

- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/marketing-knowledge-graph.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-07-06-node-relationship-intelligence-audit.md`

## Why Simulation Architecture Is Needed

Funklix already has architecture for Workspace, Brand, Brand Consciousness, Product Intelligence, Product Knowledge ownership, the Marketing Knowledge Graph, Runtime Alignment, and Node Relationship Intelligence.

What was missing is a canonical conceptual layer for Simulation.

Without a Simulation Architecture, future work could blur AI generation, analytics, graph reading, persona role-play, Dashboard summaries, and Brand learning into one ambiguous capability. The architecture prevents that drift by defining Simulation as temporary, interpretive scenario reasoning over Brand context and graph truth.

## Relationship to Marketing Knowledge Graph

Simulation reasons over the Marketing Knowledge Graph.

It never invents graph truth.

The graph provides nodes, relationships, campaign paths, decision points, statuses, assets, evidence, and outcomes when available. Simulation may produce observations, questions, risks, alternative paths, missing assets, or untested assumptions, but those outputs do not become graph truth without governed review.

## Relationship to Brand

Brand owns simulations because Brand is the active marketing context and owner of marketing intelligence.

Simulation must be scoped to one active Brand. It should use Brand Core, Brand Consciousness, ICP, personas, positioning, voice, and learning as context. It must not blend simulation context across unrelated Brands.

## Relationship to AI Brain

AI Brain facilitates simulation.

AI Brain may frame scenarios, ask questions, explain friction, compare alternatives, and summarize simulation outputs. It does not replace the graph, own simulation state, overwrite graph truth, or convert simulation outputs into Brand learning without human validation.

## Relationship to Mission Control

Mission Control summarizes reality.

It may eventually show simulation status, unresolved assumptions, launch-readiness concerns, or validated learning, but it must not present simulation hypotheses as actual campaign state, analytics, or confirmed Brand truth.

## Relationship to Relationship Intelligence

Relationship Intelligence is deterministic graph reading.

Simulation may consume relationship context such as upstream/downstream nodes, roots, leaves, campaign paths, blocked paths, and unlocks. Simulation should not create semantic relationships or infer hard dependencies from visual edges unless future governed graph semantics support that.

## Relationship to Funnel Simulator

Funnel Simulator is a future product expression of Simulation.

It should simulate customer movement through Campaign Paths and Journeys using Brand context, ICP, Persona, objectives, constraints, and graph structure. It should not be a standalone black-box score or isolated page reviewer disconnected from the graph.

## Relationship to Runtime Alignment

Runtime Alignment Readiness identifies that current runtime ownership still needs stronger Workspace, Active Brand, Board, and Brand-scoped product surface alignment.

This architecture document does not change runtime alignment. It clarifies the target conceptual model so future Simulation implementation can preserve ownership boundaries: Workspace administers, Brand owns intelligence and simulations, graph truth remains separate from simulation outputs, and runtime changes should be incremental.

## Graph Intelligence vs Generative Intelligence

The architecture explicitly separates Graph Intelligence from Generative Intelligence.

Graph Intelligence is deterministic. It reads product-owned structure such as nodes, relationships, paths, roots, leaves, status, and explicit graph state.

Generative Intelligence is interpretive. It may explain possible meaning, persona reactions, objections, friction, alternatives, and questions.

This separation is fundamental because Simulation must be able to combine deterministic graph truth with interpretive reasoning without allowing interpretation to overwrite product truth. If this boundary is lost, AI could invent graph state, Dashboard could summarize speculation as reality, and Insights could confuse hypotheses with evidence.

## Why Runtime Work Is Intentionally Deferred

Runtime work is intentionally deferred because this PR defines concepts only.

It does not:

- modify `app.js`
- modify `campaign-v3.js`
- modify `index.html`
- modify `styles.css`
- add implementation
- add prompts
- discuss LLM APIs
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
- create simulation sessions
- create simulator UI
- infer performance

The conceptual architecture should be stable before any implementation begins.

## Future Implementation Implications

Future Simulation implementation should use this document before adding product behavior.

Implications include:

1. Simulation should be scoped to one active Brand.
2. Simulation should consume Marketing Knowledge Graph truth without rewriting it.
3. Simulation Sessions should be temporary unless explicitly saved as reviewed artifacts.
4. Simulation outputs should remain observations, questions, risks, alternatives, missing assets, assumptions, or opportunities until reviewed.
5. Funnel Simulator should simulate Journey traversal through Campaign Paths.
6. AI Brain should facilitate simulation without owning graph truth.
7. Brand Avatar should participate in simulation without owning simulation state.
8. Mission Control should label simulation hypotheses distinctly from real campaign state.
9. Insights should compare reality against previous simulations while preserving provenance.
10. Validated outcomes should improve future simulations only through governed learning.
11. Graph Intelligence should remain deterministic.
12. Generative Intelligence should remain interpretive.
13. Runtime changes should be incremental and should protect Canvas rendering, save/load, autosave, Board ownership, and Brand ownership boundaries.

## Runtime Confirmation

This is a documentation-only architecture PR.

No application runtime files were changed.
