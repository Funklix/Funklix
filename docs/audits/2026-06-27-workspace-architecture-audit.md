# Workspace Architecture Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Product Architecture / Workspace Ownership |
| Type | Documentation audit |
| Runtime changes | None |
| Output | `docs/product/workspace-architecture.md` |

## Requested documents reviewed

- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/dashboard-2.0-product-spec.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`

## Requested documents missing

- `docs/product/dashboard-2.0-implementation-spec.md` is not present in the current working tree.

This audit documents the missing file explicitly before proceeding, as requested.

## Why this document is needed

Funklix now has strong architecture documents for product intelligence, product knowledge ownership, Brand Consciousness, Dashboard direction, and Board session/autosave risk. However, those documents still leave one level above Brand undefined: Workspace.

A highest-level Workspace Architecture is needed because Workspace is the administrative container that owns members, roles, billing, settings, integrations, and Brand records. Without this document, future implementation could incorrectly place marketing knowledge, AI memory, Dashboard context, or Board ownership at the Workspace level.

Workspace Architecture defines the complete ownership hierarchy from Workspace downward and makes Brand the primary working context for users.

## Why Workspace Architecture sits above Brand Consciousness Architecture

Brand Consciousness Architecture defines the primary intelligence container of Funklix: the living identity and memory of a Brand.

Workspace Architecture sits above it because a Workspace may contain one or many Brands. Workspace owns the administrative frame around those Brands:

- Members
- Roles and permissions
- Billing
- Workspace settings
- Integrations administration
- Brand list
- Transfer/handover administration

Brand Consciousness remains the intelligence core, but Workspace Architecture defines how Brands are owned, selected, switched, permissioned, billed, transferred, and administered.

## Relationship to Product Knowledge Model

The Product Knowledge Model defines where product knowledge lives at the object level.

Workspace Architecture defines the top-level containment model for those objects:

```text
Workspace administration
↓
Brand marketing intelligence
↓
Board campaign work
↓
Canvas visual structure
↓
Node campaign objects
↓
Assets
```

This makes object ownership easier to place:

- Workspace owns administration, not marketing knowledge.
- Brand owns Brand Brain, Knowledge, AI Brain context, Dashboard context, Insights, Simulation memory, Boards, and Content Workspace context.
- Board owns campaign work state.
- Canvas owns visual campaign structure.
- Nodes own campaign units.
- Assets own output artifacts with provenance.

## Relationship to Product Intelligence Architecture

The Product Intelligence Architecture defines how Brand, AI, Campaigns, Knowledge, Insights, Simulation, Dashboard, and Teams work together as an intelligent system.

Workspace Architecture clarifies the scope in which that intelligence operates:

- AI is not Workspace-global; it reasons inside one active Brand.
- Dashboard is not Workspace-global; it summarizes one active Brand.
- Insights are not Workspace-global; they belong to one Brand unless future portfolio analytics explicitly aggregate them.
- Simulation is not Workspace-global; it tests one Brand context.
- Boards and Canvas are downstream of Brand, not peers of Workspace.

## Relationship to Dashboard 2.0

Dashboard 2.0 is Mission Control and should answer what deserves attention today.

Workspace Architecture clarifies that Dashboard always represents one active Brand. In a multi-brand Workspace, Dashboard must either show the current active Brand or help the user choose a Brand before presenting Brand-specific priorities.

Dashboard should never become a Workspace-global dashboard that blends unrelated Brands, Boards, AI memory, Insights, or campaign priorities.

## Relationship to the Board Session Audit

The Board Session & Autosave Architecture Audit identified that Campaign Canvas can currently be hydrated from local storage without a clearly owning Board, and that editing can create timestamp-named boards when no active board ID exists.

Workspace Architecture extends the target model:

```text
Workspace
↓
Active Brand
↓
Active Board
↓
Campaign Canvas
```

A Canvas should not be editable without both active Brand and active Board context. Root startup, session ownership, URL resolution, and local storage should eventually respect this hierarchy.

## Why this is documentation-only

This PR intentionally creates architecture documentation only.

No runtime implementation was performed because Workspace Architecture affects many future systems:

- Brand selection
- Session ownership
- URLs
- Routing
- Board ownership
- Autosave
- Dashboard context
- AI Brain memory
- Insights scoping
- Simulation scoping
- Permissions
- Billing
- Integrations
- Client handover

Changing those systems safely requires follow-up audits and focused implementation PRs.

## Why runtime implementation is deferred

Runtime implementation is deferred because the blast radius would be large. Implementing Workspace Architecture could eventually require changes to:

- App session boot
- Active Brand state
- URL structure
- Board creation
- Board loading
- Autosave ownership
- Local storage migration
- Dashboard routing/context
- AI Brain context scoping
- Insights data scoping
- Simulation memory scoping
- API data models
- Database schema
- Permission checks
- Billing and subscription logic

The correct first step is to establish the canonical architecture before changing runtime behavior.

## Runtime confirmation

No runtime files were changed.

This PR did not modify:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- Canvas
- Dashboard
- Boards
- Autosave
- Routing
- Authentication
- APIs
- Database behavior
- Brand logic
- AI Brain
- Insights
- Simulation

Created documentation only:

- `docs/product/workspace-architecture.md`
- `docs/audits/2026-06-27-workspace-architecture-audit.md`

## Audit decision

Proceed with Workspace Architecture as the highest-level product architecture document. Future product and engineering work should use it before deciding whether a feature belongs to Workspace administration, Brand intelligence, Board work, Canvas structure, Node content, or Assets.
