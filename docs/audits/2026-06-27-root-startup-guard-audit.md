# Root Startup Guard Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 2 audit |
| Scope | Root startup guard for local canvas cache/draft |
| Runtime behavior change | Root `/` no longer hydrates `localStorage.campaignCanvasState` into editable Canvas runtime state |
| Files changed | `app.js`, `docs/audits/2026-06-27-root-startup-guard-audit.md` |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-runtime-alignment-passive-diagnostics-audit.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`
- `docs/constitution/engineering-constitution.md`

## Audit Findings Before Implementation

Runtime Alignment PR 1 diagnostics exposed the unsafe root startup state:

```text
startup.branch = "root-localStorage"
canvas.source = "localStorage campaignCanvasState"
board.currentBoardId = null
board.isBoardBacked = false
autosave.mode = "would-create-board"
autosave.wouldCreateBoard = true
view.activeView = "home"
```

That confirmed the board/session audit finding: root `/` can restore `localStorage.campaignCanvasState` into memory even though Home/Mission Control is visible and no Board owns the Canvas state.

The smallest safe behavior change is to stop root `/` from hydrating the global local-storage Canvas cache into editable runtime state. This does not delete local storage, does not add recovery UI, does not change autosave internals, and does not alter `/boards/:id` loading.

## 1. Root-localStorage Startup Branch Located

`bootApp()` determines whether the URL contains a Board ID with `getBoardIdFromPath()`. Before this PR, the no-board branch called `loadCampaignCanvasState()`, which read the global `campaignCanvasState` key and applied it to runtime `state.nodes` / `state.edges`.

The guarded branch now detects whether that local draft/cache exists, records it in diagnostics, and leaves it un-restored on root `/`.

## 2. LocalStorage Restore Path Located

`loadCampaignCanvasState()` remains the local-storage restore path. It still reads `localStorage.campaignCanvasState` and applies it when explicitly called. This PR does not remove the function and does not delete or rewrite the storage key.

The minimal behavior change is that root startup no longer calls `loadCampaignCanvasState()` when no Board ID exists.

## 3. `/boards/:id` Path Confirmed Unchanged

The `/boards/:id` path still:

1. Sets `state.currentBoardId` from the path.
2. Resets Brand Brain for board hydration.
3. Calls `loadBoardFromUrlIfPresent()`.
4. Applies the server Board's Canvas payload.
5. Sets the active view to `board`.

No board loading payload, API endpoint, route, or save/load behavior was changed.

## 4. Generated Campaign Path Confirmed Unchanged

Campaign generation still creates nodes through the existing generation flow and marks the Canvas source as `generated campaign` for diagnostics. No Campaign Generator or Campaign V3 behavior was changed.

## 5. Autosave Behavior Confirmed Unchanged

Autosave internals were not modified. The autosave watcher, dirty detection, save scheduling, and `saveBoardToServer()` semantics remain unchanged.

Only the diagnostic description changed: when root `/` has no editable anonymous Canvas in memory, diagnostics report `autosave.wouldCreateBoard: false` because there is no Canvas content to autosave into a new Board.

## 6. Diagnostics Update Required

Diagnostics now include a `localDraft` object:

```text
localDraft.exists = true | false
localDraft.restored = false
localDraft.reason = "root-startup-guard" | "none"
```

Root with a stored `campaignCanvasState` should report:

```text
startup.branch = "root-localStorage-guarded"
canvas.source = "empty/default state"
canvas.hasNodes = false
canvas.isAnonymousEditable = false
autosave.mode = "idle-no-editable-canvas"
autosave.wouldCreateBoard = false
localDraft.exists = true
localDraft.restored = false
localDraft.reason = "root-startup-guard"
```

Root without a stored `campaignCanvasState` should report:

```text
startup.branch = "root-home"
localDraft.exists = false
localDraft.restored = false
localDraft.reason = "none"
```

## 7. Exact Minimal Change

The exact minimal change was:

1. Detect `localStorage.campaignCanvasState` during `bootApp()`.
2. On root `/`, record draft/cache presence in diagnostics.
3. Do not call `loadCampaignCanvasState()` in the no-board startup branch.
4. Keep `/boards/:id` loading unchanged.
5. Keep local storage untouched.
6. Keep autosave internals untouched.
7. Update passive diagnostics so root describes the guarded state clearly.

## Behavior Unchanged Outside Root Guard

This PR does not change:

- `/boards/:id` loading.
- Save/load payloads.
- Autosave internals.
- Board creation logic.
- Local storage keys or deletion behavior.
- Recovery UI.
- Dashboard layout.
- Campaign Canvas rendering.
- Campaign Generator behavior.
- Campaign V3 behavior.
- Authentication/session behavior.
- APIs.
- Workspace or Brand implementation.

## Risks

### No recovery UI yet

Users with a local `campaignCanvasState` cache will not see it restored on root `/`. The cache is preserved, but there is not yet a recovery UI. This is intentional for PR 2 because recovery UI would be a separate product/design/runtime change.

### Manual calls still can restore local storage

`window.loadCampaignCanvasState` remains available because removing it would exceed the requested scope and could break existing debug/manual flows. The root startup path is guarded; the restore function itself is not removed.

### Canvas remains accessible from navigation

This PR does not block users from opening Campaign Canvas without a Board through existing navigation. It only prevents root startup from preloading anonymous local Canvas state. A full anonymous Canvas guard belongs to a future PR after recovery/import design.

## Manual QA Checklist

1. Open root `/` with `localStorage.campaignCanvasState` present.
   - Mission Control/Home opens.
   - Canvas runtime is not hydrated from local storage.
   - Diagnostics show `startup.branch: "root-localStorage-guarded"`.
   - Diagnostics show `localDraft.exists: true` and `localDraft.restored: false`.
   - Diagnostics show `canvas.hasNodes: false` unless a real board/generation was loaded.
   - Diagnostics show `canvas.isAnonymousEditable: false`.
   - Diagnostics show `autosave.wouldCreateBoard: false`.
2. Open `/boards/:id`.
   - Board opens exactly as before.
   - Diagnostics show board-backed state.
3. Generate a campaign.
   - Campaign generation behavior is unchanged.
4. Move a node inside a real Board.
   - Existing real-board editing, save status, and autosave behavior are unchanged.

## Decision

Proceed with the root startup guard only.

Do not delete local storage, add recovery UI, change autosave internals, or implement Workspace/Brand context in this PR.
