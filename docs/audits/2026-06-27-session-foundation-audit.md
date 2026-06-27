# Session Foundation Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 3 audit |
| Scope | Passive runtime session foundation |
| Runtime behavior changes | None intended |
| Files changed | `app.js`, `docs/audits/2026-06-27-session-foundation-audit.md` |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/product/product-intelligence-architecture.md`
- `docs/audits/2026-06-27-runtime-alignment-passive-diagnostics-audit.md`
- `docs/audits/2026-06-27-root-startup-guard-audit.md`
- `docs/constitution/engineering-constitution.md`

## Architecture Principle Implemented

Every future runtime action should happen inside one Session.

The future hierarchy is:

```text
Workspace
↓
Active Brand
↓
Active Board
```

Runtime Alignment PR 3 prepares for that hierarchy by adding a passive session container beside the legacy runtime state. The new session object is not used to drive behavior yet.

## Current Runtime State Model

The current runtime still relies on legacy state and URL-derived ownership signals:

- `state.currentBoardId` is the primary in-memory Board marker.
- `getBoardIdFromPath()` can infer Board context from `/boards/:id`.
- Board load/save, share, presence, activity, Brand Brain scoping, and autosave still read `state.currentBoardId` or URL-derived Board ID.
- Workspace is not implemented as runtime state.
- Active Brand is not implemented as runtime state.

This model remains unchanged in this PR.

## CurrentBoardId Usage

`currentBoardId` remains fully functional and unchanged. It is still the legacy runtime source that existing systems use.

This PR does not rename, remove, replace, or migrate `currentBoardId`.

The new session object mirrors `currentBoardId` where safe so future PRs can observe the intended Session hierarchy without changing existing behavior.

## Future Session Model

The passive session model added in this PR is:

```js
state.session = {
  workspaceId: null,
  brandId: null,
  boardId: null,
  source: "initial",
  isInitialized: false
}
```

Meaning:

- `workspaceId` remains `null` because Workspace runtime is not implemented yet.
- `brandId` remains `null` because Active Brand runtime is not implemented yet.
- `boardId` mirrors the current legacy Board ID when available.
- `source` describes the passive synchronization point.
- `isInitialized` confirms the passive session container has been synchronized at least once.

## Why Passive Synchronization Is Safest

Passive synchronization is safest because it avoids replacing working systems while making the target architecture observable.

This PR:

- Does not change startup decisions.
- Does not change Board loading.
- Does not change save/load behavior.
- Does not change autosave behavior.
- Does not change routing.
- Does not change Campaign Canvas rendering.
- Does not change Dashboard behavior.
- Does not change APIs.

The session object is a mirror, not an authority.

## Implementation Boundary

The implementation was limited to:

1. Adding `state.session` beside existing legacy state.
2. Adding `syncRuntimeSessionFromLegacy(source)`.
3. Calling passive synchronization after safe legacy Board ID assignment points.
4. Extending Runtime Alignment Diagnostics with canonical Session fields.
5. Clearly distinguishing `legacyRuntime` from `sessionRuntime` in diagnostics.

No existing code path was switched to read from `state.session`.

## Diagnostics Added

Runtime Alignment Diagnostics now report:

```text
session.workspaceId
session.brandId
session.boardId
session.source
session.isInitialized
legacyRuntime.currentBoardId
legacyRuntime.pathBoardId
legacyRuntime.activeView
sessionRuntime.workspaceId
sessionRuntime.brandId
sessionRuntime.boardId
sessionRuntime.source
sessionRuntime.isInitialized
sessionRuntime.mirrorsLegacyBoardId
```

Expected values today:

- `session.workspaceId = null`
- `session.brandId = null`
- `session.boardId = state.currentBoardId || getBoardIdFromPath() || null`
- `sessionRuntime.mirrorsLegacyBoardId = true`

## Blast Radius

Low.

Touched runtime area:

- `app.js` state and diagnostics only.

Unaffected protected areas:

- Startup behavior.
- Autosave behavior.
- Routing.
- Board loading behavior.
- Save/load behavior.
- Campaign Canvas rendering.
- Dashboard behavior.
- Campaign Generator behavior.
- Campaign V3 behavior.
- APIs.
- Authentication/session behavior.
- CSS.
- HTML.

## Migration Path

The intended migration path remains staged:

1. Observe legacy and session runtime diagnostics together.
2. Confirm `session.boardId` reliably mirrors `currentBoardId` across root, Board load, generated campaign, duplicate, save-as-new, and save flows.
3. Add passive Workspace session shape in a later PR.
4. Add passive Active Brand session shape in a later PR.
5. Attach Boards to Brand in a later PR.
6. Only after those steps, consider switching individual reads from legacy state to `state.session` in small audited PRs.

## Runtime Confirmation

This PR does not change:

- Startup behavior.
- Autosave behavior.
- Routing behavior.
- Board loading behavior.
- Save/load behavior.
- Campaign Canvas behavior.
- Dashboard behavior.
- Campaign Generator behavior.
- Campaign V3 behavior.
- APIs.
- Authentication behavior.
- UI or CSS.

## Manual QA Checklist

1. Open root `/`.
   - Verify diagnostics include `session.workspaceId: null`.
   - Verify diagnostics include `session.brandId: null`.
   - Verify diagnostics include `session.boardId: null`.
   - Verify `legacyRuntime.currentBoardId` remains `null`.
2. Open `/boards/:id`.
   - Verify the Board opens exactly as before.
   - Verify `legacyRuntime.currentBoardId` is populated.
   - Verify `session.boardId` mirrors it.
   - Verify `sessionRuntime.mirrorsLegacyBoardId: true`.
3. Generate a campaign.
   - Verify generation behavior is unchanged.
   - Verify Workspace and Brand remain `null`.
4. Move a node inside a real Board.
   - Verify current Board editing and autosave behavior are unchanged.
   - Verify diagnostics still show matching legacy/session Board IDs.

## Decision

Proceed with passive session foundation only.

Do not migrate existing logic to `state.session` in this PR. Future PRs should use diagnostics to prove the mirror is stable before any behavior reads from Session Runtime.
