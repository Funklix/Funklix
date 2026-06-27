# Product Knowledge Model Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Topic | Canonical ownership model for Funklix product knowledge |
| Current behavior | Funklix has Constitutions and a Product Intelligence Architecture that define the product vision and object system, but it does not yet have a canonical model for where knowledge lives, who owns it, who may modify it, and which surfaces are read-only. |
| Goal | Create a documentation-only Product Knowledge Model that defines ownership, read/write boundaries, learning responsibilities, anti-patterns, and golden rules for major product objects. |

## Files reviewed

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/product/product-intelligence-architecture.md`

## Why this document is needed

- The Product Intelligence Architecture defines what Funklix is as a system.
- Future work also needs a canonical source for where knowledge lives and who can modify it.
- Without a knowledge ownership model, future Dashboard, AI Brain, Insights, Wizard, Memory, Agents, Integrations, and Content Library work could duplicate knowledge or create competing sources of truth.
- Clear ownership is required for persistent Brand Intelligence, safe AI behavior, and compounding learning.

## Scope decision

This task should create only:

- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-product-knowledge-model-audit.md`

No runtime implementation is appropriate because this is foundational product architecture, not feature work.

## Runtime impact

None. This is documentation-only.

The work must not modify:

- `app.js`
- `index.html`
- `styles.css`
- API files
- Campaign Canvas rendering
- Campaign V3
- Save/load/autosave
- Routing/authentication
- UI behavior

## Recommendation

Use the Product Knowledge Model as the default ownership reference for major product work. Feature specs, audits, and ADRs should cite it before changing Brand Brain, Knowledge, Campaigns, Dashboard, AI Brain, Insights, Simulation, Team, Assets, Brand Avatar, Archetype, or future Content Library behavior.

## Decision

Create the Product Knowledge Model and keep the change documentation-only.
