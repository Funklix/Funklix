# Active Context Consumers Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 8 audit |
| Scope | Identify safe first consumers for `getActiveContext()` |
| Runtime changes | None |
| Implementation status | Audit only; no code changes |
| Created file | `docs/audits/2026-06-27-active-context-consumers-audit.md` |

## Documents Read

- `docs/audits/2026-06-27-active-context-resolver-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/constitution/engineering-constitution.md`

## Executive Summary

`getActiveContext()` is the correct long-term read model for answering: "Where am I working right now?"

However, most current consumers of Board ID, route Board ID, active view, and diagnostic startup/canvas state are behavior-sensitive. They control persistence, board loading, routing, collaboration, permissions, Brand Brain scoping, generation, and UI navigation. Replacing those reads too early would risk changing runtime behavior before Workspace, Brand, and Board ownership are canonical.

The safest first consumer category is **diagnostics and developer-only read paths**. Runtime Alignment Diagnostics already use `getActiveContext()` safely. The next implementation PR should keep expansion limited to diagnostics/debug-only usage and should not change autosave, save/load, board loading, routing, Dashboard CTA behavior, Campaign Generator, AI Brain, Brand Core, or Insights.

## Audit Method

This audit inspected current runtime reads for:

- `state.currentBoardId`
- `getBoardIdFromPath()`
- `state.activeView`
- `state.runtimeDiagnostics` startup, canvas, Board, and local-draft fields

The audit then classified each read into one of three categories:

1. **Safe passive read replacement**: can read `getActiveContext()` without changing product behavior.
2. **Behavior-sensitive, defer**: may be a future resolver consumer, but only after tests and ownership migrations are in place.
3. **Must never migrate yet**: should not use resolver output as authority until canonical Workspace, Brand, Board, and autosave ownership are implemented.

## Current Context Source Map

The current runtime context is not stored in one authoritative object. It is assembled from multiple legacy and diagnostic sources.

| Source | Current role | Risk if consumed inconsistently |
|---|---|---|
| `state.currentBoardId` | Primary practical Board owner marker for loaded/saved Boards. | Divergence from URL or passive session can cause wrong save/load target. |
| `getBoardIdFromPath()` | Route-derived Board context for `/boards/:id`. | Treating path as equivalent to loaded Board can affect startup and permissions. |
| `state.session.boardId` | Passive mirror of legacy Board context. | Not authoritative yet; should not replace save/load decisions. |
| `state.session.workspaceId` | Future Workspace placeholder; currently `null`. | Any non-null inference would be invented. |
| `state.session.brandId` | Future Brand placeholder; currently `null`. | Any inferred Brand would violate architecture rules. |
| `state.activeView` | Current visible product surface. | Changing reads can affect view switching and UI rendering. |
| `state.runtimeDiagnostics.startupBranch` | Passive startup branch label. | Diagnostic only; should not drive startup. |
| `state.runtimeDiagnostics.canvasSource` | Passive Canvas source label. | Diagnostic only; should not drive save/load. |
| `state.runtimeDiagnostics.localDraft` | Passive local draft presence/restoration metadata. | Diagnostic only; should not restore, delete, or migrate drafts. |
| `state.nodes` / `state.edges` | Canvas loaded/editable state. | Behavior-sensitive for autosave, generation, rendering, empty states. |

## Usage Map

| Area | Current context reads observed | Purpose | Classification | Recommendation |
|---|---|---|---|---|
| Runtime Alignment Diagnostics | `state.runtimeDiagnostics`, `state.session`, `state.currentBoardId`, `getBoardIdFromPath()`, `state.activeView`, nodes/edges. | Build developer-facing ownership and startup diagnostics. | Safe passive read replacement. | Continue using `getActiveContext()` here first. |
| Developer debug hooks | `window.debugRuntimeAlignmentDiagnostics`. | Manual QA of context state. | Safe passive read replacement. | Safest next consumer could expose or log resolver output directly. |
| Dashboard static CTAs | Dashboard click delegation calls view/nav actions such as Create Campaign, Boards, Brand, and AI Brain. | Navigate to existing surfaces. | Behavior-sensitive, defer. | Do not change CTA routing. A future diagnostics-only read is acceptable, but not behavior. |
| Active view switching | `state.activeView`, `setActiveView(view)`, UI class toggles. | Controls visible Dashboard, Canvas, list, calendar, Boards, Brand Core, AI Brain, Insights. | Behavior-sensitive, defer. | Do not replace active view authority with resolver yet. |
| Autosave scheduling | `state.currentBoardId || getBoardIdFromPath()`, dirty flags, nodes/edges. | Decide whether autosave should save and what Board may be updated/created. | Must never migrate yet. | Do not use resolver as autosave authority until autosave is update-only and Board ownership is canonical. |
| Save to server | `state.currentBoardId`, path Board ID, `getBoardIdFromPath()`. | Choose PUT vs POST and endpoint. | Must never migrate yet. | Do not change; this is the highest-risk consumer. |
| Save as new / duplicate | `state.currentBoardId`, path Board ID, new returned IDs. | Create new Boards and update legacy current Board state. | Must never migrate yet. | Keep legacy writes authoritative until migration PRs explicitly address creation flows. |
| Board URL load | `state.currentBoardId || getBoardIdFromPath()`. | Load `/api/boards/:id`, hydrate Canvas, Brand snapshot, permissions, polling. | Must never migrate yet. | Do not change board load ownership in a consumer cleanup PR. |
| Root startup | `getBoardIdFromPath()`, localStorage draft detection, runtimeDiagnostics. | Decide Home vs Board route and guarded local-draft behavior. | Must never migrate yet. | Startup was recently guarded; do not disturb it. |
| Board access/share/editors | `state.currentBoardId || getBoardIdFromPath()`. | Show share state, load editors, claim/duplicate controls, permission management. | Behavior-sensitive, defer. | Can read resolver later after Board ownership tests exist. |
| Presence / collaboration / polling | `state.currentBoardId || getBoardIdFromPath()`. | Scope presence, refresh polling, conflict awareness, activity visibility. | Behavior-sensitive, defer. | Defer because stale context could poll or write to wrong Board. |
| Activity/comments | Board ID fallback to `local` and active view refreshes. | Scope comments/activity and update list views. | Behavior-sensitive, defer. | Do not change until local-vs-board activity ownership is clarified. |
| Board library / My Boards | active view and Board navigation state. | Load lists, open Boards, update list UI. | Behavior-sensitive, defer. | Defer until resolver is tested in list/open flows. |
| Brand Core / Brand Brain storage | `getCurrentBrandBrainBoardId()`, `brandBrainStorageKey()`, `state.currentBoardId`, route Board ID. | Scope Brand Brain localStorage and Board snapshots. | Must never migrate yet. | Do not replace until canonical Brand records exist. |
| AI Brain | `state.brandCore`, nodes/edges, active view rendering. | Summarize campaign intelligence and suggestions. | Behavior-sensitive, defer. | Wait for Brand-owned AI context; do not infer Brand. |
| Insights | `state.brandCore`, nodes/edges, active view rendering. | Campaign analysis and suggestions. | Behavior-sensitive, defer. | Wait for Brand/Board context model and tests. |
| Campaign Generator / V3 | `state.brandCore`, generated Canvas state, diagnostics source label. | Generate nodes and mutate Canvas. | Behavior-sensitive, defer. | Do not make generator context-aware until generated campaign ownership is specified. |
| Image / content generation | `state.currentBoardId || getBoardIdFromPath()`, `state.brandCore`. | Send Board/Brand Brain context to APIs. | Behavior-sensitive, defer. | Wait for Brand Core/Brand Brain ownership migration. |
| API handlers | Request body `boardId` and `brandBrainData`; server Board APIs. | Generate or persist data based on client payload/API route. | Must never migrate yet. | Client resolver should not leak into API contracts in this PR family. |

## Safe Passive Consumers

The following consumers are safe because they do not alter user-visible behavior or persistence decisions:

1. **Runtime Alignment Diagnostics**
   - Already the primary safe consumer.
   - Can continue to include `activeContext` and compare it with legacy/session fields.

2. **Developer-only debug output**
   - A future implementation PR may add a read-only debug helper such as `window.debugActiveContext()` if it follows existing debug patterns.
   - This must return the resolver result only and must not mutate state.

3. **Audit-only or test-only context snapshots**
   - Manual QA can call diagnostics after root boot, Board load, generated campaign, and node movement.
   - Automated tests may later assert resolver output without replacing production behavior.

4. **Non-authoritative console warnings**
   - Architecture-alignment warnings in diagnostics may compare resolver output to legacy state.
   - Warnings must never block saves, loads, routing, generation, or Canvas editing.

## Deferred Consumers

These areas may eventually read `getActiveContext()`, but only after the resolver is covered by tests and the corresponding ownership layer is stable.

### Dashboard Static CTAs

Dashboard CTAs currently delegate to existing navigation and creation flows. They are not merely passive displays; they can open Boards, Brand Core, AI Brain, or campaign creation. The Dashboard should not use resolver output to decide routing yet.

Future safe use:

- Read `getActiveContext()` for non-authoritative diagnostics when a CTA is clicked.
- Later, after Active Brand exists, use resolver output to choose Brand-scoped Dashboard summaries.

Do not do yet:

- Change CTA destination based on `boardId`, `brandId`, or `activeView`.
- Disable or enable CTA behavior based on resolver output.

### Board Access, Share, Editors, Presence, and Polling

These consumers are Board-scoped and user/permission-sensitive. They should not migrate in a passive consumer PR because resolver output is not yet authoritative and Workspace/Brand ownership is not implemented.

Future safe use:

- Read resolver output alongside existing Board ID and log mismatches.

Do not do yet:

- Use resolver output as the Board ID for fetches, editor mutations, polling, or presence updates.

### Campaign Generator

Campaign Generator and Campaign V3 create or mutate Canvas state. Generated campaigns can be anonymous/generated before Board ownership is clarified. Resolver adoption here could accidentally redefine generated campaign ownership.

Future safe use:

- Include resolver output in diagnostic logs after generation.

Do not do yet:

- Use resolver output to decide whether generation is allowed.
- Use resolver Brand fields to infer Brand context.

### AI Brain and Insights

AI Brain and Insights are intended to become Brand-owned surfaces, but current runtime uses local `state.brandCore` and current Canvas state. Because `brandId` is intentionally null, resolver adoption would not add a true Brand owner yet.

Future safe use:

- Use resolver output for passive context banners/logs after Active Brand exists.

Do not do yet:

- Treat `boardId` as Brand ID.
- Infer Brand from Board title or Brand Core fields.
- Scope AI/Insights behavior based on placeholder null Brand data.

## Consumers That Must Not Migrate Yet

The following areas should not consume resolver output as authority until explicit future architecture PRs are completed:

1. **Autosave**
   - Autosave is the most dangerous early consumer because it can create or update Boards.
   - Resolver output must not decide POST vs PUT or whether a Canvas is saveable yet.

2. **Save/load**
   - `saveBoardToServer()` currently chooses endpoint and method from legacy Board ID sources.
   - `loadBoardFromUrlIfPresent()` hydrates server state and permissions.
   - These flows require targeted migration, not passive cleanup.

3. **Startup/routing**
   - Root startup and `/boards/:id` loading were recently stabilized.
   - Do not change startup branch decisions as part of consumer adoption.

4. **Brand Brain storage keys**
   - Brand Brain currently uses Board-scoped/localStorage keys.
   - Moving to resolver before canonical Brand records exist could lock incorrect storage scopes into the product.

5. **API contracts**
   - API payloads currently receive `boardId` and `brandBrainData` from client code.
   - Resolver adoption should not change payload shape or server ownership assumptions yet.

## Specific Evaluation Matrix

| Surface | Safe now? | Reason |
|---|---:|---|
| Dashboard static CTAs | No, except diagnostics/log-only | CTAs route users and can trigger campaign creation. |
| Diagnostics | Yes | Passive, developer-facing, already using resolver. |
| Autosave | No | Persistence authority and Board creation risk. |
| Save/load | No | Determines API endpoint, method, conflict handling, and Board hydration. |
| Board load | No | Hydrates Canvas, Brand snapshot, access, presence, and polling. |
| Campaign Generator | No | Mutates Canvas and creates generated campaign state. |
| AI Brain | Not yet | Needs canonical Brand context first. |
| Brand Core | Not yet | Brand Core/Brain storage is not canonical Brand-owned yet. |
| Insights | Not yet | Should become Brand-scoped but currently depends on Canvas and Brand Core state. |

## Recommended First Consumer PR

Recommended next implementation PR:

```text
Runtime Alignment PR 8A: Active Context Diagnostics Consumer Hardening
```

Purpose:

- Keep `getActiveContext()` consumption limited to diagnostics/debug-only paths.
- Optionally add a dedicated read-only developer helper such as `window.debugActiveContext()` if consistent with existing debug patterns.
- Add diagnostic mismatch checks comparing resolver output with legacy `state.currentBoardId`, path Board ID, and passive `state.session.boardId`.
- Do not change product behavior, UI, routing, autosave, save/load, Board loading, generation, or Brand/AI/Insights behavior.

Architecture layer:

- Passive runtime observability.
- No Workspace, Brand, Board, or Canvas ownership migration.

Files likely affected:

- `app.js`
- `docs/audits/2026-06-27-active-context-diagnostics-consumer-hardening-audit.md` or equivalent audit file

Expected outcome:

- The resolver becomes easier to validate in manual QA.
- Reviewers gain confidence before any behavior-sensitive consumer migrates.
- No runtime authority changes.

Dependencies:

- Existing `getActiveContext()` helper.
- Existing Runtime Alignment Diagnostics.

## Later PR Sequence

1. **PR 8A: Diagnostics Consumer Hardening**
   - Debug-only resolver consumption and mismatch reporting.
   - Lowest risk.

2. **PR 8B: Active Context Test Coverage**
   - Tests or scripted checks for root, Board route, generated campaign, and real Board edit contexts.
   - No product behavior change.

3. **PR 8C: Dashboard Passive Context Read**
   - Dashboard may read context for non-authoritative display/logging only.
   - No CTA behavior changes.

4. **PR 8D: Board Access Read-Only Comparison**
   - Compare resolver Board ID with existing Board access IDs in logs.
   - No fetch endpoint changes.

5. **Future Brand PRs**
   - Introduce canonical Brand records.
   - Associate Boards to Brands.
   - Only then allow Brand Core, AI Brain, Insights, Dashboard, and Simulation to use active Brand context.

6. **Future Autosave/Save PRs**
   - Only after Board ownership is canonical and autosave is update-only should persistence use Active Context as authority.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Treating resolver as authoritative too early | Wrong Board could be loaded/saved or anonymous Canvas could be misclassified. | Keep first consumers diagnostics-only. |
| Inferring Brand from Board or Brand Core | Violates architecture and creates fake ownership. | Keep `brandId` null until canonical Brand exists. |
| Changing autosave via resolver | Could reintroduce duplicate Board creation or block valid saves. | Defer autosave migration to dedicated PR. |
| Changing Dashboard CTA behavior | Could alter navigation and user workflows. | No CTA behavior changes in first consumer PR. |
| Migrating API payloads prematurely | Server/client contract drift. | Do not touch API payloads. |
| Replacing active view reads | UI view switching regressions. | Keep `state.activeView` authoritative. |

## Blast Radius

### For this audit

None. Documentation only.

### For the recommended first consumer PR

Low if limited to diagnostics/debug-only code.

Potentially affected file:

- `app.js`

Unaffected areas should include:

- startup
- routing
- autosave
- save/load
- Board loading
- Dashboard CTA behavior
- Campaign Canvas rendering
- Campaign Generator
- Campaign V3
- Brand Core
- AI Brain
- Insights
- APIs
- authentication
- CSS/UI

## What Not To Do

- Do not use `getActiveContext()` to choose save endpoints yet.
- Do not use `getActiveContext()` to decide whether autosave can create or update a Board.
- Do not replace `state.currentBoardId` mutations.
- Do not replace `getBoardIdFromPath()` in startup or Board loading.
- Do not infer `brandId` from Board title, Brand Core, Brand Brain, user email, or localStorage.
- Do not change Dashboard CTA routing.
- Do not change Campaign Generator or Campaign V3 behavior.
- Do not change API payloads or database schema.

## Decision

Proceed with audit-only planning now.

The first real consumer of `getActiveContext()` should remain diagnostics/debug-only. Behavior-sensitive consumers should be deferred until there is test coverage and until canonical Workspace, Brand, Board, and autosave ownership migrations are explicitly implemented.

## Runtime Confirmation

No runtime files were modified for this audit.

This audit does not change:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- APIs
- routing
- authentication
- autosave
- Dashboard
- Campaign Canvas
- Boards
- AI Brain
- Brand Core
- Insights
- Simulation
