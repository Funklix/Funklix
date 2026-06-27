# Brand Consciousness Architecture Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Product Architecture / Ownership Model |
| Type | Documentation audit |
| Runtime changes | None |
| Output | `docs/product/brand-consciousness-architecture.md` |

## Why this document is needed

Funklix already defines Brand Brain, Knowledge, Campaigns, Campaign Canvas, Nodes, Dashboard, AI Brain, Insights, Simulation, Boards, and Teams as product objects. The Board Session & Autosave Architecture Audit also identified a core ownership risk: Canvas and Board state can become ambiguous when an editable session exists without a clearly owned Board.

A higher-level architecture document is needed to answer the foundational product question:

> What is the primary entity inside Funklix?

The answer is not Board, Campaign, or Canvas. The answer is Brand Consciousness.

Without this concept, future implementation can accidentally make Boards the center of the product, make AI memory global, allow Campaign Canvas to exist without Brand context, or scatter Brand knowledge across Campaigns, Nodes, Assets, and local sessions.

## Documents read

Constitutions:

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`

Product:

- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/dashboard-2.0-product-spec.md`

Audits:

- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`

Optional product document status:

- `docs/product/dashboard-2.0-implementation-spec.md` was requested if present, but it is not present in the current working tree.

## Relationship to Product Knowledge Model

The Product Knowledge Model defines ownership for current product objects such as Brand Brain, Knowledge, Campaign, Campaign Canvas, Node, Dashboard, AI Brain, Insights, Simulation, Team, and Assets.

Brand Consciousness Architecture sits one level above that model.

It does not replace the Product Knowledge Model. It clarifies the highest-level container that organizes those objects:

- Brand Brain becomes part of Brand Consciousness.
- Knowledge becomes part of Brand Consciousness.
- AI memory and future AI personality belong to Brand Consciousness.
- Campaign Boards belong to one Brand Consciousness.
- Campaign Canvas and Nodes live inside Campaign Boards.
- Dashboard summarizes the active Brand Consciousness.
- Insights and Simulation feed accepted learning back into Brand Consciousness.

This provides a clearer root ownership model for future features.

## Relationship to Board Lifecycle

The Board Session & Autosave Architecture Audit found that the current implementation can allow Campaign Canvas to exist without a clear owning Board, and that editing can create timestamp-named boards through autosave when no `currentBoardId` exists.

Brand Consciousness Architecture extends that conclusion upward:

- Campaign Canvas should not exist without an owning Board.
- A Board should not exist without one owning Brand Consciousness.
- Autosave should not create Boards implicitly.
- Board creation should happen in explicit flows under a Brand Consciousness.
- Startup should resolve a Brand Consciousness and Board state clearly before editing.

This turns the board lifecycle issue from a save/load bug into an ownership architecture problem.

## Why no runtime implementation was performed

No runtime implementation was performed because this PR is documentation-only.

The task explicitly forbids modifications to:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- APIs
- routing
- save/load
- autosave
- authentication
- Campaign Canvas
- Dashboard
- AI Brain
- Insights
- Simulation

This audit and the Brand Consciousness Architecture document are planning artifacts only. They define future direction and do not change current behavior.

## Future implementation implications

Future implementation should use Brand Consciousness as the root product ownership model before introducing or modifying:

- Board creation
- Board sessions
- Autosave
- Dashboard Mission Control
- AI Brain memory
- Knowledge ingestion
- Insights learning loops
- Simulation memory
- Asset libraries
- Multi-brand workspaces
- Agency workflows
- Ownership transfer
- Enterprise permissions
- White-label handoff

Likely future implementation questions include:

1. How is the active Brand Consciousness selected at startup?
2. Can a Workspace have a default Brand Consciousness?
3. How are Boards created under a Brand Consciousness?
4. How is local storage scoped by Brand Consciousness and Board?
5. How are AI Brain conversations isolated by Brand Consciousness?
6. How does Dashboard switch between Brands in an agency Workspace?
7. How is Brand Consciousness transferred from an agency to a client Workspace?
8. What permissions govern Brand Consciousness vs Board collaboration?
9. Which Assets are campaign-specific and which are reusable Brand assets?
10. How does accepted learning update Brand Consciousness without silent drift?

## Runtime confirmation

No runtime files were changed.

Created documentation only:

- `docs/product/brand-consciousness-architecture.md`
- `docs/audits/2026-06-27-brand-consciousness-architecture-audit.md`

## Audit decision

Proceed with the Brand Consciousness Architecture as a canonical product architecture foundation. Future implementation should treat Brand Consciousness as the primary entity inside Funklix and should reject feature designs that make Boards, Campaigns, Canvas, or global AI memory the root intelligence container.
