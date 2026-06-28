# Autosave Update-Only Guard Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Runtime Alignment PR 14B audit |
| Scope | Prevent autosave from implicitly creating Boards |
| Runtime behavior change | Autosave no longer POSTs when no existing Board ID is available |
| Files changed | `app.js`, `docs/audits/2026-06-28-autosave-update-only-guard-audit.md` |

## Documents Read

- `docs/audits/2026-06-28-autosave-create-update-separation-audit.md`
- `docs/audits/2026-06-28-save-path-readability-audit.md`
- `docs/audits/2026-06-27-root-startup-guard-audit.md`
- `docs/constitution/engineering-constitution.md`

## Architecture Principle

Autosave updates only.

Boards are created explicitly.

## Audit Findings

### 1. Exact guard insertion point

PR 14A introduced `resolveBoardPersistenceTarget()` inside `saveBoardToServer(trigger)` before endpoint and method usage.

The guard belongs immediately after:

```text
const persistenceTarget = resolveBoardPersistenceTarget();
const currentBoardId = persistenceTarget.boardId;
const isUpdate = persistenceTarget.isUpdate;
```

and before any endpoint is used.

That is the smallest safe insertion point because it can inspect whether the save target has an existing Board ID before `POST /api/boards` is possible.

### 2. Behavior before PR 14B

Before this PR:

1. Autosave called `saveBoardToServer("autosave")`.
2. `saveBoardToServer()` resolved a persistence target.
3. If no Board ID existed, the target became `POST /api/boards`.
4. Autosave could create a timestamp-named Board.

This violated the target architecture because editing/autosave could create a Board implicitly.

### 3. Behavior after PR 14B

After this PR:

1. Autosave still calls `saveBoardToServer("autosave")`.
2. `saveBoardToServer()` resolves the same persistence target.
3. If the trigger is `autosave` and no existing Board ID exists, the function returns early.
4. No endpoint is called.
5. No `POST /api/boards` occurs.
6. Dirty state is preserved for recovery/manual action.
7. Save status becomes `Unsaved local changes`.
8. A clear console warning is logged with reason `autosave-update-only`.

Existing Board autosave is unchanged: when a Board ID exists, autosave continues to use the existing `PUT /api/boards/:id` path.

## Explicit Create Flows Preserved

This PR does not change explicit Board creation flows:

- `createNewBoardFlow()` still creates Boards through the existing Boards flow.
- `duplicateCurrentBoard()` still creates Board copies.
- `saveBoardAsNew()` still creates a new Board after an explicit conflict-modal choice.
- Future import paths remain unaffected because no import path is modified by this PR.

Manual save behavior is also intentionally unchanged for this PR. The guard applies only when `trigger === "autosave"`.

## Dirty State and Local Draft Behavior

The guard does not clear `state.isDirty`.

The guard does not refresh the last-saved snapshot.

The guard does not delete or rewrite `localStorage.campaignCanvasState`.

The guard does not call local draft recovery or import logic.

This means anonymous/generated/local Canvas work remains recoverable in runtime while autosave is prevented from silently creating a Board.

## Diagnostics and Logging

The guard logs:

```text
[Funklix Save Guard] Autosave skipped without an existing board id
```

with diagnostic fields:

- `trigger`
- `reason: "autosave-update-only"`
- `currentBoardId`
- `hasNodes`
- `hasEdges`
- `canvasSource`

This is console-only. It does not alter the Runtime Alignment Diagnostics payload shape in this PR.

## Risks

### 1. User perception of saving

A user in an anonymous Canvas state may see `Unsaved local changes` rather than `Saved`. This is intentional because no Board owns the Canvas. A future recovery/import UI should explain the next action.

### 2. Generated campaign without Board owner

If a generated campaign populates Canvas without an existing Board ID, autosave will no longer create a Board. That preserves architecture but may require future explicit Board creation UX for generated campaigns.

### 3. Manual Save still create-capable

Manual save still follows existing behavior and can create a Board when no ID exists. That is intentionally deferred because this PR is scoped to autosave only.

### 4. Dirty state remains true

The guard preserves dirty state. This avoids false saved status, but it means the save status can remain pending/local until the user takes an explicit action.

## Rollback Plan

Rollback is simple:

1. Remove the `trigger === "autosave" && !currentBoardId` guard from `saveBoardToServer()`.
2. Remove this audit file.

No schema, API, localStorage, routing, Dashboard, Canvas rendering, Campaign V3, Brand, Workspace, or Board ownership changes are involved.

## Runtime Confirmation

This PR only changes autosave behavior when no existing Board ID exists.

It does not change:

- root startup
- `/boards/:id` loading
- manual save behavior
- explicit create flows
- localStorage keys or draft contents
- APIs
- board payloads
- Dashboard
- Canvas rendering
- Campaign V3
- Brand runtime
- Workspace runtime

## Manual QA Checklist

1. Open root `/`.
   - Home opens.
   - No Board is created by autosave.
2. Open existing `/boards/:id`.
   - Move a node.
   - Autosave still updates the existing Board.
3. Create a new Board from Boards.
   - Explicit creation still creates a Board.
4. Duplicate a Board.
   - Duplicate still creates a copy.
5. Generate a campaign.
   - Generation behavior is unchanged unless it already explicitly creates a Board.
6. Confirm no timestamp Board appears from autosave alone.

## Decision

Proceed with the autosave update-only guard as the smallest safe behavior change.

Do not change manual save semantics, explicit create flows, root startup, localStorage recovery, APIs, Dashboard, Canvas rendering, Campaign V3, Brand runtime, or Workspace runtime in this PR.
