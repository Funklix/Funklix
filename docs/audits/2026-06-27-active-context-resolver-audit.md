# Active Context Resolver Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 7 audit |
| Scope | Passive read-only Active Context Resolver |
| Runtime behavior changes | None intended |
| Files changed | `app.js`, `docs/audits/2026-06-27-active-context-resolver-audit.md` |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/audits/2026-06-27-session-foundation-audit.md`
- `docs/audits/2026-06-27-passive-brand-session-placeholder-audit.md`
- `docs/constitution/engineering-constitution.md`

## Architecture Principle

Every runtime action happens inside one Active Context.

Future hierarchy:

```text
Workspace
↓
Active Brand
↓
Active Board
```

This PR introduces a passive read-only resolver for the current context. It does not make the context authoritative yet and does not switch product behavior to use it.

## Current Context Sources

The current runtime context is spread across multiple sources:

- `state.session.workspaceId`
- `state.session.brandId`
- `state.session.boardId`
- `state.currentBoardId`
- `/boards/:id` from `getBoardIdFromPath()`
- `state.activeView`
- `state.runtimeDiagnostics.startupBranch`
- `state.runtimeDiagnostics.canvasSource`
- `state.nodes` and `state.edges`

Each source answers part of the question: "Where am I working right now?"

Before this PR, Runtime Alignment Diagnostics rebuilt those values inline. Other future systems would likely repeat the same reads unless a central helper exists.

## Problems With Duplicated Context Reads

Duplicated context reads create risk because different systems can answer context questions differently.

Examples:

- Dashboard may check active view and Board ID.
- Autosave may check `currentBoardId` and route Board ID.
- AI Brain may check Board ID and Brand Brain data.
- Insights may later need Brand ID, Board ID, and active surface.
- Simulation may need Brand ID, Board ID, Canvas state, and active scenario.
- Content Workspace may need Brand ID and Asset scope.

If each surface builds context independently, the product can drift into multiple competing definitions of active Workspace, Brand, Board, and Canvas.

## Why a Read-Only Resolver Is Safer

A read-only resolver is safer because it centralizes observation without changing authority.

`getActiveContext()` only reads existing runtime/session/diagnostic state. It does not:

- mutate `state.session`
- set `currentBoardId`
- change startup decisions
- change autosave decisions
- change routing
- load data
- save data
- infer Brand
- create Workspace, Brand, or Board records

This makes it safe for diagnostics now and for future migration planning later.

## Resolver Structure

The new helper is:

```js
getActiveContext()
```

It returns:

```js
{
  workspaceId,
  brandId,
  boardId,
  activeView,
  startupSource,
  boardBacked,
  sessionInitialized,
  canvasLoaded,
  anonymousCanvas
}
```

Field meanings:

- `workspaceId` reads `state.session.workspaceId` and remains `null` until Workspace runtime exists.
- `brandId` reads `state.session.brandId` and remains `null` until Active Brand runtime exists.
- `boardId` reads `state.session.boardId`, then `state.currentBoardId`, then `/boards/:id` as fallback.
- `activeView` reads `state.activeView`.
- `startupSource` reads `state.runtimeDiagnostics.startupBranch`.
- `boardBacked` is true when a Board ID is available.
- `sessionInitialized` reads `state.session.isInitialized`.
- `canvasLoaded` is true when Canvas source is not empty/default or nodes/edges exist.
- `anonymousCanvas` is true when Canvas appears loaded but no Board backs it.

The resolver does not invent values and does not infer Brand.

## Diagnostics Refactor

Runtime Alignment Diagnostics now call `getActiveContext()` and include the returned object as `activeContext`.

Diagnostics still include existing detailed sections such as:

- `currentUser`
- `session`
- `brandSession`
- `legacyRuntime`
- `sessionRuntime`
- `workspace`
- `brand`
- `board`
- `canvas`
- `autosave`
- `startup`
- `localDraft`
- `view`

But the shared values for Board-backed status, anonymous Canvas, active view, startup source, and session context now come from the central resolver where safe.

## Blast Radius

Low.

Touched runtime area:

- `app.js` helper and diagnostics only.

Unaffected areas:

- startup behavior
- autosave behavior
- routing behavior
- Dashboard behavior
- Campaign Canvas behavior
- save/load behavior
- Board loading behavior
- Campaign Generator behavior
- Campaign V3 behavior
- APIs
- authentication
- UI
- CSS

## Migration Path

Recommended future migration path:

1. Keep `getActiveContext()` read-only while diagnostics stabilize.
2. Use it only in diagnostics and developer-safe logs first.
3. Add tests around root, Board URL, generated campaign, and real-board editing contexts before behavior uses it.
4. Later allow Dashboard to read from the resolver for passive display routing.
5. Later allow AI Brain, Insights, Simulation, and Content Workspace to use the resolver for Brand/Board context after Active Brand exists.
6. Only after owners are canonical should autosave or save/load behavior rely on resolver output.

## Future Users of the Resolver

### Dashboard

Dashboard can eventually use Active Context to know which Brand/Board summaries are safe to read.

### Autosave

Autosave can eventually use Active Context to confirm a Board owner exists before saving, but this PR does not change autosave.

### AI Brain

AI Brain can eventually use Active Context to resolve Brand Brain and Board context without duplicating state reads.

### Insights

Insights can eventually use Active Context to scope observations to one Brand and optional Board.

### Simulation

Simulation can eventually use Active Context to run scenarios inside one Brand and optional Campaign context.

### Content Workspace

Content Workspace can eventually use Active Context to scope reusable assets to one Brand.

## Runtime Confirmation

This PR does not change:

- startup behavior
- routing behavior
- autosave behavior
- Dashboard behavior
- Campaign Canvas behavior
- save/load behavior
- Board loading behavior
- Campaign Generator behavior
- Campaign V3 behavior
- APIs
- authentication behavior
- UI
- CSS

## Manual QA Checklist

1. Open root `/`.
   - Call `window.debugRuntimeAlignmentDiagnostics()`.
   - Confirm `activeContext.activeView` is `home`.
   - Confirm `activeContext.boardBacked` is false.
   - Confirm `activeContext.anonymousCanvas` is false when root local draft is guarded and no Canvas is loaded.
2. Open `/boards/:id`.
   - Confirm `activeContext.boardId` is populated.
   - Confirm `activeContext.boardBacked` is true.
   - Confirm `activeContext.canvasLoaded` is true after Board hydration.
3. Generate a campaign.
   - Confirm generation behavior is unchanged.
   - Confirm diagnostics still include `activeContext`.
4. Move a node inside a real Board.
   - Confirm editing, save status, and autosave behavior are unchanged.
5. Confirm Runtime Alignment Diagnostics use the resolver by checking the `activeContext` object in the logged payload.

## Decision

Proceed with a passive read-only Active Context Resolver only.

Do not migrate product behavior to the resolver in this PR.
