# Runtime Alignment Readiness

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Architecture readiness audit |
| Scope | Approved architecture compared with current runtime |
| Runtime changes | None |
| Decision | Use this document as the conservative migration roadmap before implementation |

## Executive Summary

The approved architecture now defines Funklix as a Workspace-led, Brand-centered product system. Workspace owns administration; Brand owns marketing intelligence; Dashboard, Brand Core, AI Brain, Insights, Boards, Content Workspace, and Simulation operate inside one active Brand; Boards own Campaign Canvas; Canvas owns Nodes; Nodes own Assets.

The current runtime is partially aligned at the Campaign Canvas and Node level, moderately aligned for board persistence, and weakly aligned at the Workspace, Active Brand, Brand-scoped AI, Insights, Simulation, Content Workspace, startup, and autosave layers.

The largest readiness gap is not rendering. It is ownership clarity. The runtime can hydrate a canvas from global local storage without an active board, and autosave can create a server board when `currentBoardId` is absent. That behavior conflicts with the approved hierarchy because a Canvas can effectively behave as an anonymous session instead of belonging to exactly one Board inside one active Brand.

This document does not recommend a rewrite. It recommends a sequence of small, reversible PRs that introduce explicit session ownership, then tighten board and autosave behavior only after the ownership path is observable and recoverable.

## Documents Reviewed

### Reviewed architecture and constitution documents

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/dashboard-2.0-product-spec.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`

### Missing requested document

- `docs/product/dashboard-2.0-implementation-spec.md` is not present in the current working tree. This readiness audit therefore treats `docs/product/dashboard-2.0-product-spec.md`, `docs/product/product-intelligence-architecture.md`, `docs/product/product-knowledge-model.md`, `docs/product/workspace-architecture.md`, and the board/session audit as the available Dashboard and ownership guidance.

## Approved Architecture Baseline

```text
Workspace
  ↓
Brand
  ↓
Dashboard
Brand Core
AI Brain
Insights
Boards
Content Workspace
Simulation
  ↓
Campaign Canvas
  ↓
Nodes
  ↓
Assets
```

The baseline rules used for this audit are:

1. Workspace owns administration, not marketing knowledge.
2. Brand is the primary working context.
3. Users operate inside one active Brand.
4. Dashboard always represents one active Brand.
5. Brand Core is the editing surface of the Brand.
6. Brand Brain is the structured knowledge system inside the Brand.
7. AI Brain reasons inside one Brand.
8. Insights belong to one Brand.
9. Simulation belongs to one Brand.
10. Boards belong to exactly one Brand.
11. Campaign Canvas belongs to exactly one Board.
12. Nodes belong to exactly one Canvas.
13. Assets belong to Nodes unless promoted through an explicit Brand-level asset model.
14. Autosave belongs to an existing owner; editing should not create a Board.

## Current Runtime Snapshot

The current runtime appears to be organized around a single front-end application state, board routes, local storage, and board APIs. It has strong Canvas editing primitives and meaningful Board save/load behavior, but it does not yet expose Workspace or active Brand as canonical runtime session objects.

Observed runtime characteristics:

- `state.currentBoardId` is the practical owner marker for board-backed work.
- A `/boards/:id` URL can establish board context.
- Root startup can hydrate local canvas state even when no board is active.
- Brand Brain / Brand Core state has local and board-scoped behavior, but not a canonical Brand-owned runtime model.
- Autosave is dirty-snapshot based and can save without requiring an existing board ID.
- Dashboard is a Home surface, not yet a Brand-scoped Mission Control implementation.
- AI Brain, Insights, Simulation, and Content Workspace are not yet consistently Brand-owned runtime domains.

## Layer-by-Layer Readiness

## 1. Workspace

### Current Runtime

Workspace is not a first-class runtime concept. Authentication exists, user ownership exists in API calls, and server board access appears user-aware, but there is no canonical active workspace session, workspace switcher, workspace ID on all product objects, workspace-level settings model, or workspace-owned member/role/billing/integration frame visible in the runtime.

### Target Runtime

Workspace should own administration: members, roles, permissions, billing, settings, integrations, Brand records, workspace audit, subscription limits, and workspace-level access controls. It should not own Brand knowledge or campaign intelligence.

### Missing Concepts

- Active workspace session.
- Workspace ID propagated through APIs and URLs.
- Workspace-scoped membership and roles.
- Workspace-owned Brand registry.
- Workspace-level settings and integrations.
- Workspace-level billing and subscription enforcement.

### Dependencies

Authentication, database schema, API authorization, board listing, future Brand listing, URL structure, organization settings, permissions, and any sharing/collaboration model.

### Risk

Without Workspace as an administrative owner, future multi-brand, agency, permissions, billing, and client handover features may attach to Boards or Brands inconsistently.

### Blast Radius

High. Introducing Workspace touches auth, APIs, data model, URL assumptions, board access, future Brand access, sharing, settings, and billing.

### Suggested Migration Order

Introduce Workspace as read-only context first, then attach Brands, then migrate permissions and billing into Workspace-level models.

### Recommended Future PR

Add an inert Workspace session resolver and API shape with no product behavior changes, then expose Workspace ID in diagnostics and server responses.

### Estimated Complexity

High.

## 2. Active Brand

### Current Runtime

There is no canonical active Brand session. Brand-related data exists through Brand Brain / Brand Core state, but the runtime does not require selecting a Brand before opening Dashboard, Boards, AI Brain, Insights, or Simulation.

### Target Runtime

Every user operates inside one active Brand after workspace resolution. Dashboard, Brand Core, AI Brain, Insights, Boards, Content Workspace, and Simulation should all derive context from that active Brand.

### Missing Implementation

- Active Brand ID in application state.
- Brand switcher / resolver behavior.
- Brand-scoped URLs or route context.
- Brand-owned board list filtering.
- Brand-scoped local storage and cache keys.
- Guardrails preventing Brandless work surfaces.

### Dependencies

Workspace Brand registry, Brand records, Brand Brain storage, Boards schema, startup flow, Dashboard data reads, AI Brain prompts/memory, Insights model, Simulation model, Content Workspace model.

### Risk

Without an active Brand, product surfaces may accidentally become global, board-owned, or local-only knowledge containers.

### Blast Radius

High, but can be reduced by adding active Brand as passive state before enforcing it.

### Suggested Migration Order

Add active Brand state and resolver, map existing local Brand Brain to a default Brand, then gate new Brand-aware surfaces behind that context.

### Recommended Future PR

Create a non-breaking active Brand session model with a default migrated Brand and no UI behavior change.

### Estimated Complexity

High.

## 3. Brand Brain

### Current Runtime

Brand Brain / Brand Core appears partially implemented through application state, local storage, and board snapshot behavior. It can be saved with board payloads and loaded with board state, but its ownership is ambiguous between global local storage, board-scoped local storage, and board snapshots.

### Target Runtime

Brand Brain should be the structured knowledge system inside one Brand. It should provide approved strategic truth to Dashboard, AI Brain, Campaign Canvas, Insights, Simulation, and Content Workspace. It should not be owned by a Board.

### Ownership

Current ownership is mixed. Target ownership is Brand-owned, with Boards reading from it and contributing accepted learning only through governed flows.

### Dependencies

Active Brand, Brand schema, knowledge model, board load/save compatibility, migration for existing board-embedded Brand snapshots, AI Brain prompts, Dashboard summaries.

### Migration Notes

The safest migration is to keep reading existing board/local snapshots for recovery while introducing Brand-owned canonical storage. Later PRs can migrate known Brand fields into Brand records and treat board snapshots as compatibility caches.

### Risk

If Brand Brain remains board-bound, every new Board can fork Brand truth and weaken AI consistency.

### Blast Radius

Medium-high. Brand Brain touches onboarding, Brand Core, board save/load, AI prompts, Dashboard, and future Insights/Simulation learning.

### Suggested Migration Order

Read-only Brand-owned canonical source first; compatibility import second; explicit approval workflows later.

### Recommended Future PR

Introduce Brand-owned Brand Brain persistence while preserving current local/board snapshot fallback.

### Estimated Complexity

Medium-high.

## 4. AI Brain

### Current Runtime

AI Brain exists as a product area and/or runtime surface, but it does not yet consistently reason inside a canonical active Brand. Any AI behavior that reads app state is currently constrained by what the front-end can provide, not by a durable Brand context contract.

### Target Runtime

AI Brain should be the strategic reasoning layer for one active Brand. It may own conversations, recommendations, critiques, proposed changes, and reasoning artifacts, but it should never own Brand truth or act globally.

### Gap

The runtime needs active Brand context, Brand Brain access, knowledge access, board/canvas context, retention rules, and accepted/rejected recommendation flows.

### Dependencies

Active Brand, Brand Brain canonical storage, Knowledge, AI API contracts, user permissions, board context, Insights and Simulation outputs.

### Risk

A global or session-only AI Brain can produce inconsistent advice and duplicate Brand memory outside the approved knowledge model.

### Blast Radius

Medium-high. AI prompts, state persistence, conversation storage, Brand Brain reads, and recommendation flows are affected.

### Suggested Migration Order

Scope AI Brain prompts and storage to active Brand before adding richer memory.

### Recommended Future PR

Add Brand context metadata to AI Brain requests/responses without changing AI behavior, then enforce Brand-scoped storage.

### Estimated Complexity

Medium-high.

## 5. Boards

### Current Runtime

Boards are the strongest server-backed ownership object in the current runtime. Board routes, board APIs, current board state, sharing, duplication, conflict checks, and save/load flows exist. However, Boards are not yet guaranteed to belong to exactly one Brand.

### Target Runtime

Every Board belongs to exactly one Brand. Boards own campaign-specific metadata, Campaign Canvas, campaign assets, activity, tasks, deployment state, and history. Boards do not own Brand identity.

### Current Ownership

Board ownership is currently user/server oriented and `currentBoardId` oriented. Brand ownership is not canonical.

### Gap

Boards need `brandId`, Brand-scoped listing, Brand-scoped authorization, and migration from existing unbranded boards.

### Dependencies

Workspace, active Brand, board schema/API, URL structure, save/load, sharing, presence, activity, and local storage migration.

### Risk

If Boards remain top-level owners, the product can drift back into board-centric architecture and fragment Brand intelligence.

### Blast Radius

High around APIs and save/load, but moderate if introduced as nullable metadata first.

### Suggested Migration Order

Add optional `brandId` to Boards, backfill default Brand, then require `brandId` for new Boards.

### Recommended Future PR

Add board-to-Brand association while preserving existing board URLs and access behavior.

### Estimated Complexity

Medium-high.

## 6. Campaign Canvas

### Current Runtime

Campaign Canvas is a mature runtime surface with serialized state, visual nodes, editing, inspector integration, and board save/load integration. The gap is not Canvas capability; it is that Canvas can be hydrated from local storage without an owning Board.

### Target Runtime

Campaign Canvas belongs to exactly one Board, which belongs to exactly one Brand. Canvas should not be editable without board ownership.

### Current Ownership

Canvas ownership is mixed between server Board payloads and global local storage recovery.

### Gap

The runtime needs an explicit board-bound canvas session and a safe recovery state for old local drafts that is not treated as editable canonical Canvas.

### Dependencies

Board session resolver, autosave, local storage migration, startup flow, save/load, conflict handling, and activity/presence.

### Risk

Anonymous editable Canvas sessions can create duplicate boards and user confusion.

### Blast Radius

High because Canvas is central and protected, but changes can be staged by adding guards before altering rendering.

### Suggested Migration Order

Detect unowned Canvas, show recovery/import choices, then block autosave creation from anonymous Canvas.

### Recommended Future PR

Add read-only draft recovery metadata for global local canvas state without changing Canvas editing yet.

### Estimated Complexity

High.

## 7. Nodes

### Current Runtime

Nodes are well represented inside Canvas serialization and editing. Node ownership currently follows whichever Canvas instance is active, whether board-backed or local.

### Target Runtime

Nodes belong to exactly one Canvas. Node assets, comments, tasks, owner fields, status, and history should derive from that Canvas and Board context.

### Current Ownership

Nodes are effectively Canvas-owned but inherit the Canvas ownership ambiguity when Canvas is local/anonymous.

### Gap

Node identity and task/activity/comment ownership should become explicitly Board/Canvas-scoped, especially before collaboration, tasks, or analytics mature.

### Dependencies

Campaign Canvas session ownership, board ID, node IDs, inspector, activity, comments, tasks, assets, collaboration/presence.

### Risk

If node-level features are added before ownership is fixed, tasks/activity/assets can fragment across local and board sessions.

### Blast Radius

Medium. Most risk comes from dependent features rather than node rendering itself.

### Suggested Migration Order

Fix Canvas ownership first; then scope node-dependent features to Board/Canvas IDs.

### Recommended Future PR

Document and enforce node references as `brandId + boardId + canvasId + nodeId` in future APIs.

### Estimated Complexity

Medium.

## 8. Autosave

### Current Runtime

Autosave is snapshot-driven and dirty-state based. It can call board save logic even when no active board ID exists. When no board ID exists, save behavior can create a Board through the create endpoint.

### Target Runtime

Autosave should always belong to one existing Board. Autosave should update only. Editing should never create a Board. Board creation should be limited to explicit Create Campaign, Duplicate Board, or Import Board flows.

### Current Behavior

Dirty snapshot detection schedules a save; save logic chooses create vs update based on the presence of a current board ID or route board ID.

### Gap

Autosave needs an active owner guard and the save service needs separate create/update paths so update-only autosave cannot POST new Boards.

### Dependencies

Board session resolver, startup flow, local storage recovery, conflict handling, activity feed, save status UI, board API endpoints.

### Risk

This is one of the clearest user-facing risks: duplicate timestamp boards and confusion about whether users are editing an existing Board.

### Blast Radius

High because autosave interacts with core editing trust, but the implementation can be small if create and update paths are separated carefully.

### Suggested Migration Order

Introduce telemetry/logging or visible guard state first, split save/create paths second, then make autosave update-only.

### Recommended Future PR

Refactor autosave to require `currentBoardId` and no-op with a recoverable draft state when absent.

### Estimated Complexity

Medium-high.

## 9. Startup Flow

### Current Runtime

Startup resolves authentication, reads board ID from URL, sets `currentBoardId`, loads server board when a board URL exists, or loads local Brand Brain and local Campaign Canvas when no board URL exists. It then sets the active view to Board for board URLs and Home otherwise.

### Target Runtime

Startup should resolve Workspace, active Brand, optional active Board, and active surface in that order. Root should open a safe Brand Dashboard or Brand selection state, not an editable anonymous Canvas session.

### Current Startup

Current startup is board-route oriented and local-recovery oriented, not Workspace/Brand-session oriented.

### Gap

Missing startup states include no Workspace, no Brand, Brand selected/no Board, Board selected, access denied, deleted Board, stale local draft, and import/recovery decisions.

### Dependencies

Auth, Workspace resolver, Brand resolver, board resolver, local storage migration, routing, Dashboard, Board loading, save/load.

### Risk

Startup ambiguity is the reason users can believe they are editing one thing while the runtime is preparing another.

### Blast Radius

High. Startup touches nearly every runtime surface.

### Suggested Migration Order

Add explicit resolver outputs without changing UI, then route root to active Brand Dashboard, then remove anonymous Canvas hydration from root.

### Recommended Future PR

Create a startup decision table and passive diagnostic object in code before changing boot behavior.

### Estimated Complexity

High.

## 10. Dashboard

### Current Runtime

Dashboard currently behaves as a Home surface with quick actions and summary cards. It is not yet a Brand-scoped Mission Control surface, and the requested implementation spec is absent from the tree.

### Target Runtime

Dashboard should represent one active Brand and answer, "What deserves my attention today?" It should read from Brand Brain, Boards, Insights, AI Brain, Simulation, Team activity, and Knowledge without owning canonical data.

### Current

Home/Dashboard routing exists. Brand-scoped data ownership does not.

### Gap

Dashboard needs active Brand context, safe placeholder-to-real data migration, Continue Working from active Brand boards, Brand Evolution from Brand Brain, and no fake analytics.

### Dependencies

Active Brand, Brand Brain, Boards, Insights, AI Brain summaries, Simulation outputs, Team activity, task/node ownership.

### Risk

Dashboard can become a global widget board or duplicate Insights/AI Brain if implemented before ownership contracts are stable.

### Blast Radius

Low for static layout, medium for real data, high if it starts calculating or storing canonical state.

### Suggested Migration Order

Static Brand-scoped shell first, read-only existing data second, cross-surface summaries only after owners are stable.

### Recommended Future PR

Implement Dashboard 2.0 only as a Brand-scoped static/read-only shell after active Brand is introduced.

### Estimated Complexity

Medium.

## 11. Insights

### Current Runtime

Insights is present as a product concept and may have placeholder or early UI behavior, but there is no clear Brand-owned analytics layer with durable observed facts, metrics, diagnostics, and accepted-learning flows.

### Target Runtime

Insights belongs to one Brand. It observes facts, metrics, diagnostics, signals, and trends. It does not decide strategy and does not directly rewrite Brand Brain.

### Gap

Missing pieces include Brand-scoped insight records, source provenance, campaign performance ingestion, validated learning states, and Dashboard-safe summaries.

### Dependencies

Active Brand, Boards, deployed campaign data, assets, integrations, performance sources, Brand Brain accepted-learning workflow, Dashboard.

### Risk

Fake analytics or unscoped insights would undermine trust and violate the Dashboard/Insights boundary.

### Blast Radius

Medium-high once connected to data sources; low while placeholder-only.

### Suggested Migration Order

Define read-only insight records and provenance before charts, recommendations, or Brand Brain learning.

### Recommended Future PR

Add Insights data contract and Brand-scoped placeholder state before analytics integrations.

### Estimated Complexity

Medium-high.

## 12. Simulation

### Current Runtime

Simulation is an approved product concept, but current runtime readiness appears minimal. There is not yet a clear Brand-scoped simulation memory, scenario ownership model, or accepted-learning path.

### Target Runtime

Simulation belongs to one Brand. It can run temporary scenarios using Brand Brain, Knowledge, Campaigns, Nodes, Assets, and AI prompts. Validated simulation learning may feed Brand Brain through explicit approval.

### Gap

Missing pieces include scenario records, Brand-scoped simulation memory, persona/audience context, result retention, and accepted-learning governance.

### Dependencies

Active Brand, Brand Brain, Knowledge, AI Brain, Campaign Canvas, Nodes, Insights, permissions, retention rules.

### Risk

Simulation can become a parallel AI memory store if it persists assumptions without governed acceptance.

### Blast Radius

Medium when introduced; currently low because runtime implementation is limited.

### Suggested Migration Order

Keep Simulation behind explicit Brand context and store scenario outputs separately from Brand Brain until accepted.

### Recommended Future PR

Create a Simulation ownership/data contract before adding runtime simulation surfaces.

### Estimated Complexity

Medium.

## 13. Content Workspace

### Current Runtime

Content Workspace does not appear to be a mature first-class runtime surface. Assets and generated content are primarily tied to nodes, campaigns, or board/canvas state.

### Target Runtime

Content Workspace should belong to one Brand and organize approved reusable content, templates, assets, publishing metadata, and examples. It should read Brand Brain and campaign performance without owning brand strategy.

### Gap

Missing pieces include Brand-scoped content records, asset provenance, promotion from node assets to reusable Brand assets, publishing/integration metadata, and usage history.

### Dependencies

Active Brand, Assets, Nodes, Boards, Insights, integrations, permissions, Content Library model, Brand Brain guardrails.

### Risk

If Content Workspace is added prematurely, it may duplicate Brand Brain, Assets, or Campaign history.

### Blast Radius

Medium. It can be implemented safely if introduced as a Brand-scoped read-only library first.

### Suggested Migration Order

Define asset promotion and provenance before building broad content management features.

### Recommended Future PR

Add a Content Workspace ownership specification and defer runtime implementation until Brand and Board ownership are stable.

### Estimated Complexity

Medium.

## Migration Roadmap

This roadmap is intentionally conservative. Each PR should preserve current behavior unless the PR's explicit purpose is to turn on a previously audited guard.

### PR 1: Runtime ownership inventory comments / diagnostics

- **Purpose:** Add non-invasive diagnostics or developer-only documentation in code identifying current Workspace, Brand, Board, Canvas, and autosave ownership assumptions.
- **Architecture Layer:** Cross-cutting readiness.
- **Files likely affected:** `app.js` only if implementation is approved later; docs if kept documentation-only.
- **Risk:** Low if diagnostic-only.
- **Expected Outcome:** Future PRs can measure ownership state before changing behavior.
- **Dependencies:** This readiness audit.

### PR 2: Passive Workspace session shape

- **Purpose:** Introduce a read-only Workspace context object after authentication without changing routes or UI.
- **Architecture Layer:** Workspace.
- **Files likely affected:** Auth/session helpers, API session endpoints, application state.
- **Risk:** Medium.
- **Expected Outcome:** Runtime can identify administrative owner without moving knowledge.
- **Dependencies:** Auth/session audit.

### PR 3: Passive Active Brand session shape

- **Purpose:** Introduce active Brand ID/state with a default migrated Brand, but do not yet enforce it on all surfaces.
- **Architecture Layer:** Active Brand.
- **Files likely affected:** App state, Brand APIs/schema, startup resolver, local storage keys.
- **Risk:** Medium-high.
- **Expected Outcome:** Product surfaces can begin reading a common Brand context.
- **Dependencies:** PR 2 or a temporary single-workspace assumption.

### PR 4: Brand-owned Brand Brain persistence

- **Purpose:** Make Brand Brain canonical under active Brand while preserving local and board snapshot fallback for recovery.
- **Architecture Layer:** Brand Brain.
- **Files likely affected:** Brand Core state, Brand Brain storage helpers, Board save/load compatibility, APIs/schema.
- **Risk:** Medium-high.
- **Expected Outcome:** Brand truth stops depending on Board snapshots as its canonical owner.
- **Dependencies:** PR 3.

### PR 5: Attach Boards to Brand

- **Purpose:** Add `brandId` to Boards, backfill existing Boards to a default Brand, and list Boards by active Brand.
- **Architecture Layer:** Boards.
- **Files likely affected:** Board APIs, database schema, board list, create/duplicate flows, tests.
- **Risk:** High.
- **Expected Outcome:** Boards belong to exactly one Brand without breaking existing board URLs.
- **Dependencies:** PR 3.

### PR 6: Startup resolver decision table

- **Purpose:** Centralize startup resolution into Workspace → Brand → Board → View states without changing behavior yet.
- **Architecture Layer:** Startup Flow.
- **Files likely affected:** `bootApp()`, route helpers, app state.
- **Risk:** Medium-high.
- **Expected Outcome:** Startup decisions become explicit and testable.
- **Dependencies:** PR 2, PR 3, PR 5 preferred.

### PR 7: Local canvas draft recovery model

- **Purpose:** Treat global local canvas state as a recoverable draft/import source, not as canonical editable Canvas.
- **Architecture Layer:** Campaign Canvas / Startup / Autosave.
- **Files likely affected:** Local storage helpers, startup flow, board import/create flows, user messaging.
- **Risk:** High.
- **Expected Outcome:** Old local state remains recoverable while anonymous editing is phased out safely.
- **Dependencies:** PR 6.

### PR 8: Split create and update board save paths

- **Purpose:** Separate explicit Board creation from Board update/autosave.
- **Architecture Layer:** Boards / Autosave.
- **Files likely affected:** Save helpers, create board flow, duplicate/import flows, Board APIs.
- **Risk:** High.
- **Expected Outcome:** Save semantics become clear before enforcing update-only autosave.
- **Dependencies:** PR 5, PR 6.

### PR 9: Make autosave update-only

- **Purpose:** Require an active Board ID for autosave and prevent autosave from posting new Boards.
- **Architecture Layer:** Autosave.
- **Files likely affected:** Autosave watcher, save helpers, save status UI, board conflict handling.
- **Risk:** High.
- **Expected Outcome:** Editing never creates a Board implicitly.
- **Dependencies:** PR 7, PR 8.

### PR 10: Board-bound Canvas enforcement

- **Purpose:** Prevent editable Campaign Canvas from existing without an owning Board.
- **Architecture Layer:** Campaign Canvas.
- **Files likely affected:** Startup flow, route guards, Canvas view activation, create/import flows.
- **Risk:** High.
- **Expected Outcome:** Campaign Canvas belongs to exactly one Board at runtime.
- **Dependencies:** PR 7, PR 9.

### PR 11: Node and asset reference normalization

- **Purpose:** Standardize future references as Brand → Board → Canvas → Node → Asset.
- **Architecture Layer:** Nodes / Assets.
- **Files likely affected:** Node models, asset helpers, inspector, comments/activity/task APIs if present.
- **Risk:** Medium.
- **Expected Outcome:** Node-dependent features can safely attach to ownership hierarchy.
- **Dependencies:** PR 10.

### PR 12: Brand-scoped Dashboard 2.0 read model

- **Purpose:** Make Dashboard read from active Brand and Brand-owned summaries without storing canonical data.
- **Architecture Layer:** Dashboard.
- **Files likely affected:** Dashboard markup/JS only after approved implementation, read-model helpers, Brand/Board summary APIs.
- **Risk:** Medium.
- **Expected Outcome:** Dashboard becomes Mission Control for one Brand, not a global home screen.
- **Dependencies:** PR 3, PR 4, PR 5.

### PR 13: Brand-scoped AI Brain context

- **Purpose:** Ensure AI Brain requests and persisted artifacts include active Brand context.
- **Architecture Layer:** AI Brain.
- **Files likely affected:** AI prompt builders, AI APIs, conversation/recommendation storage, Brand Brain read helpers.
- **Risk:** Medium-high.
- **Expected Outcome:** AI reasons inside one Brand and does not become global memory.
- **Dependencies:** PR 3, PR 4.

### PR 14: Brand-scoped Insights foundation

- **Purpose:** Add Insights records/provenance model before analytics UI or recommendations expand.
- **Architecture Layer:** Insights.
- **Files likely affected:** Insights APIs/schema, integration ingestion points, Dashboard read model.
- **Risk:** Medium-high.
- **Expected Outcome:** Insights observes Brand-scoped facts without writing strategy directly.
- **Dependencies:** PR 3, PR 5.

### PR 15: Brand-scoped Simulation foundation

- **Purpose:** Define simulation scenarios and retention under active Brand before runtime simulation expansion.
- **Architecture Layer:** Simulation.
- **Files likely affected:** Simulation APIs/schema, AI helpers, Brand Brain accepted-learning flow.
- **Risk:** Medium.
- **Expected Outcome:** Simulation outputs stay separate from Brand truth until accepted.
- **Dependencies:** PR 3, PR 4, PR 13 preferred.

### PR 16: Content Workspace asset provenance

- **Purpose:** Introduce Brand-scoped reusable content/asset library with provenance from Nodes and Campaigns.
- **Architecture Layer:** Content Workspace / Assets.
- **Files likely affected:** Asset storage, content APIs/schema, node asset promotion flows, permissions.
- **Risk:** Medium.
- **Expected Outcome:** Reusable content can exist without duplicating Brand Brain or Campaign history.
- **Dependencies:** PR 3, PR 11, PR 14 preferred.

### PR 17: Agency, handover, and enterprise permissions hardening

- **Purpose:** Expand Workspace/Brand permission and transfer behavior for agencies, clients, enterprise, and white-label tenants.
- **Architecture Layer:** Workspace / Brand / Permissions.
- **Files likely affected:** Auth, roles, membership, Brand transfer APIs, audit logs, billing.
- **Risk:** High.
- **Expected Outcome:** Multi-brand and client handover models are supported without moving marketing knowledge into Workspace.
- **Dependencies:** PR 2, PR 3, PR 5.

## Architecture Readiness Score

These are conservative readiness estimates based on observed runtime alignment with the approved architecture. They are not quality, performance, or user-value scores.

| Layer | Readiness | Rationale |
|---|---:|---|
| Workspace | 5% | Administration exists around auth/users, but Workspace is not a canonical runtime owner. |
| Active Brand | 10% | Brand data exists, but active Brand session is not canonical. |
| Brand Brain | 35% | Brand Brain/Core state exists, but ownership is mixed between local storage, Board snapshots, and future Brand ownership. |
| AI Brain | 25% | AI Brain concept/surface exists, but Brand-scoped reasoning contract is incomplete. |
| Boards | 55% | Board persistence, URLs, APIs, duplication, and save/load are relatively mature, but Brand ownership is missing. |
| Campaign Canvas | 65% | Canvas editing and serialization are strong, but anonymous/local ownership remains possible. |
| Nodes | 70% | Nodes are mature inside Canvas, but inherit Canvas ownership ambiguity. |
| Autosave | 20% | Autosave works mechanically, but owner requirements conflict with target architecture. |
| Startup Flow | 25% | Startup resolves auth and board URLs, but not Workspace → Brand → Board hierarchy. |
| Dashboard | 25% | Home/Dashboard exists, but Mission Control and active Brand data ownership are not aligned yet. |
| Insights | 20% | Product concept exists, but Brand-scoped observation layer is not mature. |
| Simulation | 5% | Mostly future architecture; little runtime readiness. |
| Content Workspace | 10% | Assets/content exist through campaigns/nodes, but no Brand-scoped content workspace is mature. |
| Overall Readiness | 28% | Strong Canvas/Node foundations offset by missing Workspace/Brand/session ownership and autosave/startup gaps. |

## Final Recommendation

The smallest safe next implementation PR should not touch Dashboard, Canvas rendering, AI behavior, or analytics. It should introduce a passive runtime ownership diagnostic or session decision table that reports Workspace, active Brand, active Board, Canvas ownership, and autosave owner state without changing behavior.

After that, the first behavior-changing PR should address board/session ambiguity by separating explicit Board creation from autosave update behavior, but only after active Brand and recovery states are designed and tested.
