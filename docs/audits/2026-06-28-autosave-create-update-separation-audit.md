# Autosave Create/Update Path Separation Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Runtime Alignment PR 14 audit |
| Scope | Board save/autosave create-vs-update behavior |
| Runtime changes | None |
| Decision | Do not implement in this PR; separate create and update paths before making autosave update-only |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`
- `docs/audits/2026-06-27-root-startup-guard-audit.md`
- `docs/audits/2026-06-27-active-context-resolver-audit.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/constitution/engineering-constitution.md`

## Architecture Principle

Autosave updates only.

Boards are created explicitly.

The current runtime is close enough to implement this in small steps, but it should not be patched casually because save/load, autosave, conflict handling, board ownership, sharing, and local draft recovery all depend on the same Board identity assumptions.

## Current Save Map

### 1. `saveBoardToServer(trigger = "manual")`

`saveBoardToServer()` is the main shared save path for both manual save and autosave.

Current behavior:

1. Builds a serialized Canvas payload.
2. Builds a default payload name using `Campaign Canvas <timestamp>`.
3. Determines a Board ID from `state.currentBoardId`, the `/boards/:id` path, or `getBoardIdFromPath()`.
4. If a Board ID exists, sends `PUT /api/boards/:id`.
5. If no Board ID exists, sends `POST /api/boards`.
6. If the response returns a Board ID, stores it in `state.currentBoardId`, updates the passive session, and may push `/boards/:id` after create.

This means `saveBoardToServer("autosave")` and `saveBoardToServer("manual")` currently share the same implicit create behavior.

### 2. `saveBoardAsNew(payload)`

`saveBoardAsNew()` is an explicit create path used during the conflict modal's save-as-new branch.

Current behavior:

- Requires a signed-in user.
- Sends `POST /api/boards`.
- Sets `state.currentBoardId` from the returned Board ID.
- Pushes `/boards/:id`.
- Refreshes snapshot and save status.

This is an explicit creation path and should remain allowed, but its naming and UX should stay clearly distinct from autosave.

### 3. `duplicateCurrentBoard()`

`duplicateCurrentBoard()` is an explicit duplicate path.

Current behavior:

- Requires a signed-in user.
- Builds a copy name from the current Board.
- Sends `POST /api/boards` with current Canvas and Brand Core snapshot.
- Sets `state.currentBoardId` from the returned Board ID.
- Pushes `/boards/:id`.

This is an explicit creation path and should remain allowed.

### 4. `createNewBoardFlow()`

`createNewBoardFlow()` is an explicit Board creation path from the Boards UI.

Current behavior:

- Requires a signed-in user.
- Prompts for a Board name.
- Sends `POST /api/boards` with `blankCanvasState()` and `defaultBrandCoreState()`.
- Redirects to `/boards/:id`.

This should remain allowed.

### 5. `saveCampaignCanvasState()`

`saveCampaignCanvasState()` writes serialized Canvas state to localStorage under `campaignCanvasState`.

This is not a server Board save, but it is relevant because legacy local drafts can contain Canvas data without a server Board owner. Root startup is now guarded from automatically hydrating this draft, but the key still exists and explicit restore remains possible.

### 6. Board library metadata operations

Board library actions use other server methods:

- Rename: `PATCH /api/boards/:id`.
- Reorder: `PATCH /api/boards/:id`.
- Claim: `PATCH /api/boards/:id`.
- Delete: `DELETE /api/boards/:id`.
- Presence: `POST /api/boards/presence/:id`.
- Share editors: editor endpoints under `/api/boards/:id/editors`.

These are not Canvas autosave paths, but they depend on stable Board IDs and should not be mixed into autosave separation.

## Current Autosave Trigger Map

Autosave is snapshot-driven:

1. `startAutosaveWatcher()` calls `detectDirtyFromSnapshot()` every second.
2. `detectDirtyFromSnapshot()` compares `buildLastSavedSnapshot()` against `state.lastSavedSnapshot`.
3. When snapshots differ, `markUnsaved()` sets dirty state and calls `scheduleAutosave()`.
4. `scheduleAutosave()` waits three seconds after guards pass.
5. The timer calls `saveBoardToServer("autosave")`.

Current autosave guards block saves when:

- Board loading or hydration is in progress.
- Initial server load is in flight.
- A conflict modal is open.
- Autosave is paused until the next change.
- Board access is read-only.
- A save is already in progress.

Current autosave guards do **not** require a Board ID. The Board ID check is deferred to `saveBoardToServer()`, which chooses PUT or POST.

## Current Create Paths

### Allowed explicit create paths

These paths should remain allowed in the target architecture:

1. `createNewBoardFlow()` → `POST /api/boards`.
2. `duplicateCurrentBoard()` → `POST /api/boards`.
3. `saveBoardAsNew(payload)` → `POST /api/boards` after an explicit conflict-modal decision.
4. Future Import Board flow → `POST /api/boards` only from an explicit import/recovery action.
5. Future Create Campaign flow → create a Board explicitly before or during campaign generation, depending on final product design.

### Unsafe implicit create path

The unsafe path is:

```text
Canvas becomes dirty
↓
markUnsaved()
↓
scheduleAutosave()
↓
saveBoardToServer("autosave")
↓
no currentBoardId/path Board ID exists
↓
POST /api/boards
↓
new timestamp-named Board is created
```

The root startup guard reduces one entry into this state by not hydrating `localStorage.campaignCanvasState` on `/`, but it does not remove the implicit create behavior from `saveBoardToServer()` itself.

### Manual save implicit create path

Manual save also calls `saveBoardToServer("manual")` and therefore currently shares the same create-if-no-ID behavior.

This is less dangerous than autosave because it involves a user action, but it is still ambiguous because the Save button does not clearly mean "Create New Board" when no active Board exists.

## Current Update Paths

The canonical update path is:

```text
saveBoardToServer(trigger)
↓
Board ID exists in state or URL
↓
PUT /api/boards/:id
↓
server checks access and optional lastKnownUpdatedAt conflict
↓
boards row updated
```

The API already has a clear update endpoint:

- `PUT /api/boards/:id` updates an existing Board.
- It requires `canvas_json`.
- It checks Board access.
- It supports conflict detection with `lastKnownUpdatedAt`.
- It returns the updated Board and access information.

This means the server already supports update-only autosave. The main risk is on the client path that allows autosave to fall through to `POST /api/boards` when no ID exists.

## Current API / Database Map

### `POST /api/boards`

`api/boards/index.js` supports Board creation.

Important behavior:

- Requires authentication.
- Requires `canvas_json`.
- Uses a timestamp fallback name when `name` is blank.
- Inserts `name`, `canvas_json`, `brand_core_snapshot`, owner fields, and created metadata.

This endpoint is correct for explicit Board creation. It should not be reachable from autosave.

### `PUT /api/boards/:id`

`api/boards/[id].js` supports Board updates.

Important behavior:

- Requires `canvas_json`.
- Checks access through `getBoardAccess()`.
- Rejects forbidden writes.
- Supports conflict detection.
- Updates `canvas_json`, `brand_core_snapshot`, and `updated_at`.

This endpoint should be the only endpoint autosave uses.

### Current `boards` table

The current table stores:

- `id`
- `name`
- `canvas_json`
- `brand_core_snapshot`
- `order_index`
- `created_at`
- `updated_at`
- owner metadata columns

No schema change is required for update-only autosave.

## Active Context / Session Usage

The runtime now has three Board identity sources:

1. `state.currentBoardId` — legacy authority.
2. `getBoardIdFromPath()` — URL-derived Board ID.
3. `getActiveContext().boardId` / `state.session.boardId` — passive mirror/read model.

For the smallest safe implementation, autosave should still use the legacy Board ID sources first because those are already authoritative in save/load flows.

`getActiveContext()` can be used only for diagnostics in the first implementation, not as the save authority. A later PR can migrate autosave authority after Board ownership and session invariants are stronger.

## Unsafe Create Paths

| Path | Current behavior | Risk |
|---|---|---|
| `saveBoardToServer("autosave")` with no Board ID | Sends `POST /api/boards` | Highest risk; silent duplicate/timestamp Boards. |
| `saveBoardToServer("manual")` with no Board ID | Sends `POST /api/boards` | Medium risk; user clicked Save, but Save did not explicitly say Create Board. |
| Conflict modal `save_new` | Calls `saveBoardAsNew(payload)` | Allowed if the user explicitly chose save-as-new. |
| Local draft explicit restore followed by edit | Can still become dirty without Board ID if restore path is exposed/used | Must be handled by future draft recovery/import design. |
| Generated campaign without Board ID | Can populate Canvas and become dirty before a Board exists | Should eventually require explicit Board creation or save-as-new semantics. |

## Recommended Minimal Fix

The smallest safe behavior-changing PR should **not** rewrite save/load. It should introduce a Board-update-only helper and guard autosave before any POST can occur.

### Minimal implementation target

1. Add a helper that resolves the current existing Board ID for updates:

```text
getCurrentBoardIdForUpdate()
```

It should return `state.currentBoardId || getBoardIdFromPath() || null` and should not create or infer anything.

2. Split the update operation from the create operation:

```text
updateExistingBoardOnServer(boardId, payload, trigger)
createBoardOnServer(payload, source)
```

The split can be internal at first, but autosave must only call the update helper.

3. Add an autosave-only guard:

```text
if (trigger === "autosave" && !currentBoardId) {
  clear autosave timer
  keep dirty state
  set non-destructive status such as "Draft not attached to a board"
  update diagnostics
  return false
}
```

4. Keep explicit creation paths using `POST /api/boards`:

- `createNewBoardFlow()`.
- `duplicateCurrentBoard()`.
- `saveBoardAsNew()`.
- Future import/recovery flow.

5. Do **not** delete localStorage drafts and do **not** auto-import them.

### Why this is safest

- It changes only the autosave create risk first.
- It preserves explicit create flows.
- It does not require schema changes.
- It does not require Workspace/Brand implementation.
- It keeps conflict handling on existing Board updates.
- It leaves manual save semantics available for a follow-up PR if product wants a separate "Save as Board" UX.

## Recommended Future PR Sequence

### PR 14A: Save path naming and tests/documentation

**Purpose:** Rename or wrap save helpers internally so create and update intent is visible.

**Likely files:**

- `app.js`
- optional audit/test docs

**Expected outcome:** Engineers can identify update-only and create-capable paths without changing behavior.

**Risk:** Low if implemented as wrappers and comments only.

### PR 14B: Autosave update-only guard

**Purpose:** Prevent `saveBoardToServer("autosave")` from POSTing when no Board ID exists.

**Likely files:**

- `app.js`
- audit doc

**Expected outcome:** Autosave never creates a new Board.

**Risk:** Medium. Must preserve dirty state and avoid data loss when a user is in an anonymous/generated/local-draft Canvas.

### PR 14C: Diagnostics update for blocked autosave

**Purpose:** Extend Runtime Alignment Diagnostics with an autosave blocked state.

**Likely files:**

- `app.js`
- audit doc

**Expected outcome:** Diagnostics distinguish `update-existing-board`, `blocked-no-board`, `idle-no-editable-canvas`, `blocked-read-only`, and explicit create-capable flows.

**Risk:** Low if diagnostics remain read-only.

### PR 14D: Manual save intent separation

**Purpose:** Decide whether manual Save without a Board ID should be blocked, renamed, or converted into explicit "Create Board" / "Save As Board" UX.

**Likely files:**

- `app.js`
- `index.html` if button copy or modal changes are needed
- `styles.css` if modal/empty state copy changes are needed

**Expected outcome:** Manual save no longer silently means create Board unless the UI says so explicitly.

**Risk:** Medium because this affects user expectations and recovery from generated/local draft sessions.

### PR 14E: Local draft recovery/import flow

**Purpose:** Treat `localStorage.campaignCanvasState` as a recoverable/importable draft, not an editable active Canvas.

**Likely files:**

- `app.js`
- `index.html`
- `styles.css`
- possibly docs/audits

**Expected outcome:** Legacy users can recover drafts explicitly without autosave creating surprise Boards.

**Risk:** Medium-high because it touches startup, localStorage, and user recovery semantics.

### PR 14F: Generated campaign Board ownership decision

**Purpose:** Ensure generated campaigns either start inside an existing Board or explicitly create/select a Board before editing/autosave.

**Likely files:**

- `app.js`
- Campaign generation UI files/sections
- possible API docs depending on product decision

**Expected outcome:** Generated campaigns cannot become anonymous editable sessions by accident.

**Risk:** High if bundled with other changes; should be isolated.

## Risks and Regression Areas

### 1. Data loss perception

If autosave is blocked without clear status, users may believe edits are saved. A future implementation must preserve dirty state and explain that the draft is not attached to a Board.

### 2. Generated campaign flow

If generation creates nodes without an active Board, autosave update-only will no-op. That is correct architecturally, but the product needs an explicit creation/recovery path so generated work is not stranded.

### 3. Conflict resolution

Conflict save-as-new is an explicit create path and should not be accidentally blocked by an autosave-only guard.

### 4. Manual save ambiguity

Manual Save currently shares implicit create behavior. If autosave is fixed first but manual Save remains create-capable, the product still needs copy/UX clarity.

### 5. Local draft recovery

The root guard prevents automatic hydration, but explicit restore/local draft flows can still create anonymous Canvas state. Update-only autosave must account for this and leave data recoverable.

### 6. Board sharing and read-only access

Read-only guards must continue to block saves. Do not bypass `boardAccess.canEdit` when splitting helpers.

### 7. Stale route/state mismatch

`state.currentBoardId` and URL Board ID can diverge. A future helper should be conservative and emit diagnostics when the two differ.

## What Not To Do

- Do not make autosave call `POST /api/boards` under any fallback condition.
- Do not infer Board ownership from Canvas content.
- Do not create a Board because nodes exist.
- Do not delete `localStorage.campaignCanvasState` as part of autosave separation.
- Do not silently convert local drafts into Boards.
- Do not change API schema for this fix.
- Do not replace `currentBoardId` authority with `getActiveContext()` in the first autosave fix.
- Do not bundle Brand ownership, Workspace, import recovery, generated campaign ownership, and autosave update-only into one PR.

## Runtime Confirmation

This PR is an audit only.

No runtime files were modified.

No code was changed in:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- APIs
- routing
- authentication
- save/load
- autosave
- Dashboard
- Campaign Canvas
- Boards
- Brand Core
- AI Brain
- Insights
- Simulation

## Final Recommendation

The next implementation should be PR 14B only after PR 14A naming/readability is accepted or skipped as unnecessary.

The smallest safe runtime change is:

```text
When trigger === "autosave" and no existing Board ID is available,
do not POST.
Keep dirty state.
Set a recoverable non-saved status.
Record diagnostics.
Return false.
```

That change directly satisfies the principle:

```text
Autosave updates only.
Boards are created explicitly.
```
