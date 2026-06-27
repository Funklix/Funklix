# Board Session & Autosave Architecture Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Area | Campaign Canvas / Boards / Autosave |
| Type | Architecture audit only |
| Runtime changes | None |
| Decision | Do not implement in this PR; use this audit to plan a future board-session architecture fix |

## Documents read

- `docs/product/product-intelligence-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/constitution/engineering-constitution.md`

`docs/product/dashboard-2.0-implementation-spec.md` was requested but is not present in the current working tree. This audit therefore uses the available product ownership and engineering documents plus direct source inspection of the current board/session implementation.

## Executive summary

The current implementation supports two different Campaign Canvas modes:

1. **Board-backed mode** — a `/boards/:id` URL or `state.currentBoardId` identifies a server board. Saves use `PUT /api/boards/:id`.
2. **Local anonymous canvas/session mode** — no board ID exists, but canvas state can still be restored from `localStorage.campaignCanvasState`. Edits can become dirty and autosave can attempt `POST /api/boards`, creating a new board with a timestamp fallback name.

That second mode explains the observed behavior: a user can open Funklix on `/`, see a canvas restored from local storage that looks like the last edited board, edit it, and trigger autosave. Because there is no active board ID, `saveBoardToServer()` treats the save as a create operation and posts a new board named `Campaign Canvas <ISO timestamp>` unless the payload already has a name.

The safest future architecture should remove anonymous editable canvas sessions from Campaign Canvas. There should always be exactly one active board before editing is possible.

## 1. How `bootApp()` decides what to open

`bootApp()` does the following:

1. Sets board loading state.
2. Loads the auth session.
3. Reads a board ID from the URL using `getBoardIdFromPath()`.
4. Assigns that value to `state.currentBoardId`.
5. Initializes the share panel using the current board ID.
6. If a board ID exists, loads the server board through `loadBoardFromUrlIfPresent()`.
7. If no board ID exists, loads Brand Brain from local storage and calls `loadCampaignCanvasState()`.
8. Renders the canvas and sets the active view to `board` for `/boards/:id`, otherwise `home`.
9. Starts the autosave watcher, presence, and board refresh polling.

Important finding: root startup (`/`) still loads local canvas state even though the active view becomes Home. This means the Campaign Canvas can be hydrated with prior local data before a user explicitly opens or creates a board.

## 2. How the active board is determined

The active board is determined by:

- `state.currentBoardId`.
- The `/boards/:id` URL parsed by `getBoardIdFromPath()`.
- Fallback checks that use `state.currentBoardId || getBoardIdFromPath()` across save, load, presence, activity, brand-brain scoping, sharing, and polling.

This creates a soft active-board model rather than a single authoritative active-board session. Many systems can infer board identity from either memory state or the URL.

## 3. Where `currentBoardId` is created, stored, and updated

`currentBoardId` is initialized in the top-level app state as `null`.

It is updated in these paths:

- Startup: `bootApp()` sets `state.currentBoardId = boardIdFromPath`.
- Server board load: `loadBoardFromUrlIfPresent()` sets it to the URL board ID, then to the returned server ID.
- Normal save: `saveBoardToServer()` sets it to the returned board ID after `POST` or `PUT`.
- Save-as-new conflict flow: `saveBoardAsNew()` sets it to the newly created ID and pushes `/boards/:id`.
- Duplicate flow: `duplicateCurrentBoard()` sets it to the new copy ID and pushes `/boards/:id`.
- Create board flow: `createNewBoardFlow()` does not set it directly; it posts a blank board and then navigates to `/boards/:id`.

The core issue is that `currentBoardId` can remain null while a populated canvas exists from local storage.

## 4. How autosave works

Autosave is snapshot-driven:

1. `refreshLastSavedSnapshot()` stores a snapshot of `serializeState()` plus `serializeBrandCoreSnapshot()`.
2. `startAutosaveWatcher()` runs `detectDirtyFromSnapshot()` every second.
3. If the current snapshot differs from `state.lastSavedSnapshot`, `markUnsaved()` sets `state.isDirty = true`, clears `autosavePausedUntilChange`, sets status to `Unsaved changes`, and calls `scheduleAutosave()`.
4. `scheduleAutosave()` waits three seconds, then calls `saveBoardToServer('autosave')` if dirty and not blocked by loading, saving, conflict, read-only access, or paused state.

Autosave does not require a board ID. If no board ID exists, `saveBoardToServer()` creates a board.

## 5. How localStorage interacts with boards

The global canvas local-storage key is `campaignCanvasState`.

Current behavior:

- `saveCampaignCanvasState()` writes serialized canvas state to `localStorage.campaignCanvasState` and sets status to `Saved`.
- `loadCampaignCanvasState()` reads `localStorage.campaignCanvasState` and applies it as a canvas state.
- `loadBoardFromUrlIfPresent()` saves the loaded server board's normalized canvas state back to the same global `campaignCanvasState` key.
- Collaborative remote merge paths can also write current serialized state back to the same key.
- Brand Brain local storage is board-scoped when a board ID exists, but falls back to a global key when no board ID exists.
- Activity/comment seen keys use `state.currentBoardId || getBoardIdFromPath() || "local"`, so anonymous local sessions have a `local` awareness scope.

This global `campaignCanvasState` key is the bridge between a real board and a local anonymous session. After loading a board, the same board data is copied into global local storage. Later opening `/` with no board ID can restore that data without board ownership.

## 6. When a board is automatically created

A board can be created through intended flows:

- `createNewBoardFlow()` posts a blank board with an explicit user-provided name.
- `duplicateCurrentBoard()` posts a copy with a duplicate name.
- `saveBoardAsNew()` posts a new board during conflict resolution.

A board can also be created through the current autosave/manual save path:

- `saveBoardToServer()` builds a payload with fallback name `Campaign Canvas <ISO timestamp>`.
- It determines `currentBoardId` from state or URL.
- If there is no current board ID, it uses `POST /api/boards`.
- The API also applies a timestamp fallback name if the incoming name is empty.

This means ordinary editing can become board creation whenever the canvas is dirty and no active board ID is present.

## 7. Why editing can create a new board

Editing can create a new board because the implementation allows this sequence:

```text
Open /
  ↓
bootApp() finds no /boards/:id
  ↓
state.currentBoardId = null
  ↓
loadCampaignCanvasState() restores global localStorage.campaignCanvasState
  ↓
User edits or a snapshot difference is detected
  ↓
markUnsaved() schedules autosave
  ↓
saveBoardToServer('autosave') sees no currentBoardId
  ↓
POST /api/boards with name "Campaign Canvas <timestamp>"
  ↓
state.currentBoardId is set to new ID and URL is pushed to /boards/:id
```

The user may believe they are editing an existing board because the visual canvas came from a previously loaded board, but the board ID was not restored with it.

## 8. Whether Campaign Canvas can exist without an owning board

Yes, in the current implementation Campaign Canvas can exist without an owning board.

Evidence:

- Root startup loads `localStorage.campaignCanvasState` when no board ID exists.
- The app state allows `currentBoardId: null`.
- Save logic treats no board ID as create-new rather than blocking editing.
- Activity awareness explicitly has a `local` fallback key.
- Brand Brain has a global fallback storage key when no board ID exists.

This indicates the canvas still supports a temporary/local session model.

## 9. Whether this originated from a temporary canvas/session model

Likely yes.

The evidence strongly suggests the board system was added on top of an older local Canvas model:

- `campaignCanvasState` is a global localStorage key, not board-scoped.
- `saveCampaignCanvasState()` still treats local persistence as "Saved" even when no server board is involved.
- `loadCampaignCanvasState()` can hydrate the canvas with no board ID.
- Server-loaded boards are copied into the same local key, preserving backward compatibility but blurring ownership.
- `withBoardSchemaDefaults()` explicitly normalizes older board/state payloads.
- `saveBoardToServer()` supports both update and create based solely on whether a board ID exists.

## 10. Dependency map

### Save / load

- `saveCampaignCanvasState()` writes local global canvas state.
- `loadCampaignCanvasState()` restores local global canvas state.
- `saveBoardToServer()` saves to server and creates a board if no active ID exists.
- `loadBoardFromUrlIfPresent()` loads server board data and writes it into local storage.
- `createNewBoardFlow()`, `duplicateCurrentBoard()`, and `saveBoardAsNew()` all create server boards.

### Board ownership

- Board ownership is server-side and exposed through `owner_email`, owner metadata, and access roles.
- `setSharePanelState()` stores owner metadata in app state and updates sharing UI.
- Claiming an unowned board is supported via `PATCH /api/boards/:id`.
- The board list includes unowned boards for signed-in users, which preserves anonymous/shared legacy behavior.

### Sharing and URLs

- Board URLs are `/boards/:id`.
- The share link is generated from the active board ID.
- `saveBoardToServer()` pushes `/boards/:id` after creating a new board.
- `saveBoardAsNew()` and `duplicateCurrentBoard()` also push `/boards/:id`.

### Activity feed

- Activity feed is serialized into canvas state.
- Activity seen/comment seen local-storage keys are scoped by board ID, URL board ID, or `local` fallback.
- A local session can therefore have activity awareness separate from a real board.

### Collaboration and presence

- Presence and board refresh polling require board ID and signed-in user in key paths.
- Without board ID, presence clears viewers and does not ping.
- Remote board polling uses `state.currentBoardId || getBoardIdFromPath()`.

### Autosave

- Dirty detection is snapshot-based and board-agnostic.
- Autosave schedules after dirty detection and calls server save.
- Server save chooses POST vs PUT based on board ID presence.
- This is the main path that allows editing to create a board.

### Restore flow

- Undo/restore calls `markUnsaved()`.
- Startup restore from local storage applies local state, refreshes last saved snapshot, and marks board loading complete.
- Server load also writes board state into local storage, creating the later root-session ambiguity.

## Existing lifecycle diagram

```text
Startup
  ↓
bootApp()
  ↓
getBoardIdFromPath()
  ├─ If /boards/:id
  │    ↓
  │    state.currentBoardId = id
  │    ↓
  │    loadBoardFromUrlIfPresent()
  │    ↓
  │    GET /api/boards/:id
  │    ↓
  │    applyCampaignState(server canvas)
  │    ↓
  │    localStorage.campaignCanvasState = server canvas
  │    ↓
  │    active view = board
  │
  └─ If no board ID
       ↓
       state.currentBoardId = null
       ↓
       loadCampaignCanvasState()
       ↓
       applyCampaignState(localStorage.campaignCanvasState)
       ↓
       active view = home
       ↓
       later user opens/edits canvas
       ↓
       dirty snapshot detected
       ↓
       autosave fires
       ↓
       saveBoardToServer()
       ↓
       no board ID → POST /api/boards
       ↓
       timestamp-named board created
```

## Recommended target lifecycle

```text
Startup
  ↓
resolveActiveBoardSession()
  ├─ If /boards/:id exists
  │    ↓
  │    Load that board
  │    ↓
  │    Active board = loaded board
  │
  ├─ Else if user has a selected/recent board preference
  │    ↓
  │    Redirect/open that explicit board OR show Home with no editable canvas
  │
  └─ Else
       ↓
       Show Home / board picker / create campaign prompt
       ↓
       No editable Campaign Canvas until board is explicitly created/opened

Editing
  ↓
Require activeBoardId
  ↓
Autosave PUT /api/boards/:id only
  ↓
Never POST from edit/autosave

Board creation
  ↓
Only Create Campaign / Duplicate Board / Import Board may POST /api/boards
```

## Recommended future architecture

1. Introduce a single active board session contract.
   - `activeBoardId` must exist for Campaign Canvas editing.
   - URL and app state should be reconciled once during startup.
   - If they disagree, choose a deterministic source and document it.

2. Remove anonymous editable canvas mode.
   - Root Home may show Dashboard or board picker.
   - Campaign Canvas should be read-only/unavailable until a board is opened or created.

3. Make autosave update-only.
   - Autosave should require `activeBoardId`.
   - If no active board exists, autosave should not POST.
   - Manual edit flows should not create boards implicitly.

4. Scope local storage by board or demote it to cache.
   - Replace global `campaignCanvasState` with `campaignCanvasState:<boardId>` if local cache remains needed.
   - Do not hydrate an editable canvas from a global local key when no board ID exists.
   - If migration is needed, treat old global state as recoverable/importable draft, not an active board.

5. Restrict board creation to explicit flows.
   - Create Campaign / Create Board.
   - Duplicate Board.
   - Import Board.
   - Conflict "save as new" should be reviewed carefully: it is explicit but should clearly create a named duplicate/copy, not a timestamp surprise.

6. Make startup board state explicit.
   - `/boards/:id` loads that board.
   - `/` loads Home/Dashboard, not an editable anonymous canvas.
   - A recent-board convenience should route/open a real board, not restore local canvas state silently.

## Risks

- Removing local anonymous canvas behavior could strand unsaved local drafts unless migration/recovery is designed.
- Some users may rely on root `/` restoring prior local canvas work.
- Board-scoped local cache migration must avoid overwriting server boards with stale local data.
- Presence, activity seen state, comments, and Brand Brain storage currently have local fallbacks that must be audited during implementation.
- Save conflict "save new" creates a board and must remain explicit and understandable if retained.
- Changing startup behavior touches Home, Canvas, save/load, URL routing expectations, and board library entry points.
- Any change to autosave must preserve protection against data loss and remote overwrite conflicts.

## Blast radius for future implementation

Expected files/modules that would need review or modification in a future implementation PR:

- `app.js`
  - `bootApp()`
  - `getBoardIdFromPath()` usage
  - `state.currentBoardId`
  - `loadCampaignCanvasState()`
  - `saveCampaignCanvasState()`
  - `saveBoardToServer()`
  - `markUnsaved()` / autosave watcher
  - `loadBoardFromUrlIfPresent()`
  - `createNewBoardFlow()`
  - `duplicateCurrentBoard()`
  - `saveBoardAsNew()`
  - Brand Brain storage scoping
  - activity/comment seen scoping
  - presence and board refresh polling
- `api/boards/index.js`
  - POST create behavior and naming fallback.
- `api/boards/[id].js`
  - PUT/PATCH ownership and conflict behavior.
- `api/boards/presence/[id].js`
  - Presence assumptions around board identity.
- `api/_board-access.js`
  - Access/ownership role assumptions.
- `index.html`
  - Any future UI for board picker, unavailable canvas state, or draft recovery.
- `styles.css`
  - Any future visual state for no-active-board canvas/home recovery UI.

## Final recommendation

Do not patch autosave in isolation. The safest future PR sequence is:

1. Add a board-session resolver audit/ADR or lightweight module spec.
2. Add explicit no-active-board UI state on Home/Canvas without changing persistence.
3. Change autosave so it refuses to POST when no active board ID exists.
4. Add migration/recovery for legacy `localStorage.campaignCanvasState` as an explicit draft import, not silent startup hydration.
5. Scope local canvas cache by board ID or remove it as canonical state.
6. Restrict board creation paths to Create Campaign/Create Board, Duplicate Board, and Import Board.

The desired target architecture is correct: exactly one active board, no editable Campaign Canvas without an owning board, autosave always updates one board, and editing never creates a board.
