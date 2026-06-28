# Board-to-Brand Association Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 5 audit |
| Scope | Board-to-Brand / Board-to-Brand Consciousness architecture planning |
| Runtime changes | None |
| Files changed | `docs/audits/2026-06-27-board-to-brand-association-audit.md` only |
| Decision | Do not implement in this PR; use this audit to plan future Board-to-Brand association work |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-session-foundation-audit.md`
- `docs/audits/2026-06-27-passive-brand-session-placeholder-audit.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`
- `docs/constitution/engineering-constitution.md`

## Executive Summary

The approved architecture requires every Board to belong to exactly one Brand / Brand Consciousness. The current runtime and API do not have that association yet.

Today, a Board is primarily owned by a user or shared with editors. It stores:

- Board metadata.
- Campaign Canvas JSON.
- A Board-scoped Brand Brain snapshot.
- Owner/editor permissions.

That is enough for current save/load and collaboration, but it is not enough for the future Workspace → Brand → Board hierarchy. Brand ownership should eventually be represented as a first-class Board column and runtime field, not inferred from titles, Brand Core fields, user email, or Board snapshots.

This audit recommends adding a future `brand_id` column to the server `boards` table and exposing it to client code as `brandId` only after canonical Brand records exist. Existing Boards must remain accessible and migration must be explicit, reversible where possible, and safe for users with legacy Boards.

No runtime changes were made in this audit.

## 1. Current Board Model Summary

### Database / storage model

The current `boards` table is created in `api/_boards-storage.js` with core columns:

- `id`
- `name`
- `canvas_json`
- `brand_core_snapshot`
- `order_index`
- `created_at`
- `updated_at`

It is later extended with ownership and identity columns:

- `owner_id`
- `owner_email`
- `owner_name`
- `owner_avatar`
- `created_by`

The collaboration model uses a separate `board_editors` table with:

- `board_id`
- `email`
- `role`
- `created_at`
- `created_by`
- `name`
- `avatar`

There is currently no `brand_id`, `brandId`, `brand_consciousness_id`, or Brand-owned Board registry.

### Client runtime model

The client primarily identifies a Board through:

- `state.currentBoardId`
- `/boards/:id` parsed by `getBoardIdFromPath()`
- passive `state.session.boardId` mirror
- `state.boardAccess`
- `state.boardsLibrary`
- `state.currentBoardName`
- `state.lastKnownUpdatedAt`

`state.session.brandId` intentionally remains `null` because there is no canonical Active Brand runtime yet.

## 2. Current Persistence Flow

### Create Board

Board creation currently happens through `POST /api/boards`.

Client callers include:

- `createNewBoardFlow()` — posts a blank Canvas and default Brand Core snapshot after the user enters a Board name.
- `duplicateCurrentBoard()` — posts current serialized Canvas and current Brand Core snapshot with a copy name.
- `saveBoardAsNew()` — posts a new Board after conflict resolution.
- `saveBoardToServer()` — can still post when no current Board ID exists, although earlier root startup guarding reduces one path into anonymous local Canvas autosave.

The POST payload currently contains:

```js
{
  name,
  canvas_json,
  brand_core_snapshot
}
```

The server inserts those fields plus owner identity into `boards`.

### Update Board

Board updates use `PUT /api/boards/:id`.

The PUT payload currently contains:

```js
{
  name,
  canvas_json,
  brand_core_snapshot,
  lastKnownUpdatedAt
}
```

The server updates `name`, `canvas_json`, `brand_core_snapshot`, and `updated_at` after access and conflict checks.

### Patch Board

`PATCH /api/boards/:id` currently handles:

- claiming an unowned Board
- renaming
- ordering via `order_index`

It does not handle Brand association.

### Delete Board

`DELETE /api/boards/:id` deletes the Board after owner permission checks.

## 3. Current Load / Hydration Payloads

### Load one Board

`GET /api/boards/:id` returns columns defined by `BOARD_COLUMNS`:

```text
id, name, canvas_json, brand_core_snapshot, created_at, updated_at, order_index,
owner_id, owner_email, owner_name, owner_avatar, created_by
```

The client hydrates:

- `state.currentBoardId`
- `state.currentBoardName`
- `state.lastKnownUpdatedAt`
- `state.brandCore` from `brand_core_snapshot`
- Canvas from `canvas_json`
- access state from the returned `access`

There is no Brand ID in the load payload.

### List Boards

`GET /api/boards` returns Boards visible to the current user:

- owned Boards
- Boards where the user is an editor
- unowned Boards

The returned fields include Board metadata, owner identity, timestamps, order index, and an `access_role` computed as `owner`, `editor`, `unowned`, or `non_owner`.

There is no Brand filtering or Brand association in listing.

## 4. Current Permission / Ownership Flow

The current permission model is Board-user based:

- A user is an owner if their normalized email or user ID matches `owner_email` / `owner_id`.
- A user is an editor if a matching row exists in `board_editors`.
- A Board can be `unowned` if `owner_email` and `owner_id` are empty.
- Owners can rename, delete, and manage permissions.
- Owners and editors can edit.
- Unowned Boards can be claimed by a signed-in user.

This model answers: "Which user can access this Board?"

It does not answer: "Which Brand owns this Board?"

Future Brand ownership should not replace user permissions. The target model should be additive:

```text
Workspace owns administration and members
Brand owns marketing intelligence
Board belongs to one Brand
Board still has user/editor access rules
```

## 5. Current Board Listing / My Boards

The Board library currently lists Boards by user ownership/editor access/unowned status and sorts by role priority, `order_index`, and `updated_at`.

Current labels and chips are user-access oriented, such as:

- Your Board
- Editor
- Shared
- Open
- Copy

There is no Brand grouping, Brand filter, active Brand selector, or Brand-scoped Board list.

Future Board listing should first support Brand ID pass-through before changing UI grouping. Do not change My Boards into Brand Boards until Active Brand is implemented and migration is safe.

## 6. Duplicate / Copy Board Behavior

`duplicateCurrentBoard()` creates a new Board by posting:

- copy name
- `serializeState()` Canvas payload
- `serializeBrandCoreSnapshot()`

The duplicate becomes a new Board owned by the current user and navigates to `/boards/:id`.

Future Brand association rule:

- If the source Board has a Brand, duplicate should default to the same Brand.
- If the source Board is legacy/unassigned, duplicate should either remain unassigned legacy or prompt/select a Brand depending on the migration phase.
- Do not infer Brand from the duplicated Brand Core snapshot.

## 7. Campaign V3 Generated Board Creation

Campaign V3 does not appear to create server Boards directly. It generates campaign content/nodes into the current Canvas/runtime flow. Persistence still happens through the existing Board save/create/update paths.

Future Brand rule:

- Campaign V3 should not assign Brand ownership directly.
- It should rely on the active Session / Active Brand / Active Board once those concepts become authoritative.
- If no active Board exists, campaign generation should eventually require a Board creation/import flow that already knows the active Brand.

## 8. `brand_core_snapshot` / Brand Brain / LocalStorage Interactions

The current Board model stores `brand_core_snapshot` on each Board. The client also stores Brand Brain state in local storage through `brandBrainStorageKey()`:

- Board-scoped key when a Board ID exists.
- Global key when no Board ID exists.

`brand_core_snapshot` is useful for compatibility and Board hydration, but it is not Brand ownership.

Important distinction:

```text
brand_core_snapshot = Board-scoped knowledge snapshot / compatibility payload
brand_id = future canonical owner reference to a Brand
```

Future migration should avoid treating `brand_core_snapshot` as proof of Brand identity. Multiple Boards can share similar Brand Core fields without belonging to the same Brand, and one Brand can evolve after a Board snapshot was created.

## 9. Where Brand ID Should Eventually Belong

The Brand owner reference should eventually live on the Board record itself.

Recommended future model:

```text
boards.brand_id UUID NULL initially, later NOT NULL after migration
```

Rationale:

- Board belongs to exactly one Brand.
- Board listing and access checks will need efficient Brand filtering.
- Board load should return the Brand owner reference without parsing metadata JSON.
- Database constraints can eventually enforce valid Brand ownership.
- It keeps Brand ownership separate from `canvas_json` and `brand_core_snapshot`.

Do not store Brand ownership inside:

- `canvas_json`
- `brand_core_snapshot`
- Board name/title
- nested metadata JSON
- local storage only

## 10. Naming Recommendation

Use both naming styles according to layer conventions:

### Database / API field

Recommend `brand_id`.

Reason:

- Existing persisted/API fields use snake_case: `canvas_json`, `brand_core_snapshot`, `owner_email`, `owner_avatar`, `order_index`, `created_by`.
- A SQL column named `brand_id` matches current backend style.
- It is concise and maps to the product-level `Brand` entity established by Workspace Architecture.

### Client/session field

Continue using `brandId` in client state.

Reason:

- Existing client state uses camelCase: `currentBoardId`, `currentBoardName`, `lastKnownUpdatedAt`, `boardAccess`, `brandCore`.
- `state.session.brandId` already exists as the passive placeholder.

### Why not `brandConsciousnessId`?

`Brand Consciousness` is the conceptual intelligence container, but Workspace Architecture defines `Brand` as the runtime product entity users operate inside. `brand_id` is shorter, clearer, and better aligned with future Workspace → Brand → Board URLs and data access.

### Why not nested metadata?

Nested metadata is harder to query, harder to constrain, easier to accidentally fork, and weaker for permission checks, listing filters, and migrations.

## 11. Legacy Board Migration Options

Existing Boards have no Brand owner. They must remain accessible.

Possible strategies:

### Option A: Personal default Brand

Create a default Brand for each user/workspace and assign legacy Boards to it.

Pros:

- Smoothest for single-user accounts.
- Gives every legacy Board a Brand quickly.
- Enables Brand-scoped Dashboard and Board listing sooner.

Cons:

- Can silently group unrelated legacy Boards into one Brand.
- Risky for agencies or users who created Boards for multiple clients.

### Option B: Unassigned legacy Brand

Create an explicit system Brand such as `Legacy / Unassigned` per Workspace or user.

Pros:

- Preserves access without pretending the Brand is known.
- Honest migration state.
- Users can later move Boards into real Brands.

Cons:

- Requires UI and copy to explain the state.
- Dashboard/AI/Insights must avoid treating Unassigned as a true Brand Consciousness.

### Option C: Migration wizard

Prompt users to assign existing Boards to Brands or create new Brands.

Pros:

- Most accurate.
- Best for agencies and multi-brand workspaces.
- Avoids silent incorrect ownership.

Cons:

- More product and UI work.
- Requires recovery and partial-migration handling.

### Option D: Automatic Brand creation from Brand Core

Infer/create Brands from Board snapshots.

Pros:

- Fast to automate.

Cons:

- Violates current architecture principles.
- Can create duplicates or wrong associations.
- Should not be used as the primary migration path.

### Recommendation

Use a hybrid of Option B and Option C:

1. Introduce explicit `Unassigned Legacy` state for existing Boards.
2. Keep Boards accessible.
3. Provide a later migration wizard to move Boards into real Brands.
4. Optionally offer a personal default Brand for single-brand users, but only with clear confirmation.

Do not silently auto-create Brands from Brand Core data.

## 12. Fallback Strategy Recommendation

Recommended fallback order:

1. **Unassigned legacy state** for all pre-existing Boards.
2. **Explicit user assignment** through a migration wizard.
3. **Personal default Brand** only when the user confirms or when onboarding establishes the Workspace is single-brand.
4. **Automatic Brand creation** should be avoided unless a future audit proves it is safe and reversible.

This preserves access while avoiding wrong Brand ownership.

## 13. API / Database Impact

Future implementation will likely affect:

### Database

- `api/_boards-storage.js`
  - Add `brand_id UUID` nullable first.
  - Add an index on `boards(brand_id)`.
  - Later add a foreign key to a future `brands` table.
  - Later make `brand_id` non-null after migration.

### API create / update / load

- `api/boards/index.js`
  - POST should eventually accept `brand_id` only after Active Brand exists.
  - GET should eventually filter by active Brand or include Brand metadata.

- `api/boards/[id].js`
  - `BOARD_COLUMNS` should include `brand_id` after the column exists.
  - GET should return `brand_id`.
  - PUT should not casually change `brand_id`; moving a Board between Brands should be a dedicated operation.
  - PATCH may eventually support a governed move/reassign route, but avoid overloading rename/order patch too early.

### Access / permissions

- `api/_board-access.js`
  - Access checks may need Workspace/Brand permissions in addition to Board owner/editor checks.
  - Initial PR should preserve existing owner/editor behavior.

### Editor APIs and presence

- `api/boards/[id]/editors/*`
- `api/boards/presence/[id].js`

These are Board-ID based and may not need immediate Brand changes, but future checks may need to verify Brand/Workspace access.

## 14. Client Runtime Impact

Future implementation will likely affect:

- `state.session.brandId`
- `state.session.boardId`
- `state.currentBoardId` compatibility
- `loadBoardFromUrlIfPresent()`
- `saveBoardToServer()`
- `createNewBoardFlow()`
- `duplicateCurrentBoard()`
- `saveBoardAsNew()`
- `loadBoardsLibrary()` / `renderBoardsLibrary()`
- `brandBrainStorageKey()`
- Dashboard / Mission Control read model
- AI Brain context
- Insights context
- Campaign generation entry points

Early implementation should not switch all of these at once. First pass should add pass-through fields and diagnostics only.

## 15. Safest Future Implementation PR Split

### PR 5A: Brand model and API planning doc / schema audit

Purpose: define future `brands` table/API and Brand identity fields without changing runtime.

Risk: low.

### PR 5B: Add nullable `brand_id` column only

Purpose: add `boards.brand_id` nullable and indexed; do not require or populate it yet.

Files likely affected:

- `api/_boards-storage.js`

Risk: medium-low.

Expected outcome: database can hold Board-to-Brand association when ready.

### PR 5C: Return `brand_id` passively

Purpose: include `brand_id` in Board GET/list responses and client diagnostics without changing behavior.

Files likely affected:

- `api/boards/[id].js`
- `api/boards/index.js`
- `app.js` diagnostics only

Risk: medium-low.

### PR 5D: Introduce canonical Brand records

Purpose: create Brand records and Active Brand resolver, still without forcing all Boards into Brands.

Files likely affected:

- new Brand APIs/schema
- auth/session/workspace context
- app session diagnostics

Risk: medium-high.

### PR 5E: Legacy Board migration state

Purpose: mark existing Boards as unassigned legacy or associate them through an explicit migration state.

Risk: high.

### PR 5F: Board creation inside Active Brand

Purpose: require explicit Active Brand for new Board creation after Active Brand exists.

Files likely affected:

- `createNewBoardFlow()`
- `api/boards/index.js`
- session resolver

Risk: high.

### PR 5G: Duplicate / import Brand association rules

Purpose: define whether duplicated/imported Boards keep source Brand, prompt for Brand, or remain unassigned legacy.

Risk: medium-high.

### PR 5H: Brand-scoped Board listing

Purpose: show Boards for active Brand, while preserving legacy access and migration paths.

Risk: high.

## Risks

- Incorrectly grouping unrelated Boards under one Brand.
- Inferring Brand from Board title or Brand Core fields.
- Breaking access to existing Boards.
- Hiding unassigned legacy Boards from users.
- Making `brand_core_snapshot` the Brand owner by accident.
- Changing save/load payloads before API/database support exists.
- Making Board moves between Brands too easy without permission checks.
- Breaking shared/editor Boards that span users during migration.
- Introducing Brand requirements before Workspace/permissions are ready.
- Overloading the Dashboard or AI Brain with Brand assumptions before Board ownership is stable.

## Blast Radius

Future Board-to-Brand implementation will have high blast radius because it touches:

- database schema
- Board APIs
- Board access checks
- Board list queries
- Board creation/duplicate/import flows
- client session state
- save/load compatibility
- Brand Brain scoping
- Dashboard reads
- AI Brain context
- Insights and Simulation context
- migration and recovery UX

This audit intentionally makes no runtime changes.

## What Not To Do

Do not:

- infer Brand from Board title
- infer Brand from Brand Core fields
- infer Brand from Brand Brain local storage
- infer Brand from campaign content
- silently attach Boards to random Brands
- silently create one Brand per Board without user visibility
- store Brand ownership only inside `canvas_json`
- store Brand ownership only inside `brand_core_snapshot`
- make `brand_core_snapshot` canonical Brand truth
- require `brand_id` before legacy Board migration exists
- hide legacy Boards that do not yet have a Brand
- change save/load payloads before schema/API support exists
- mix Board-to-Brand migration with Dashboard, AI Brain, Insights, or UI redesign work

## Final Recommendation

Use `boards.brand_id` as the future persisted association and expose it to client runtime as `brandId` only after canonical Brand records exist.

Start with nullable, passive, observable support. Keep existing Boards accessible. Treat all existing Boards as legacy/unassigned until users or a governed migration assigns them to a real Brand.

Do not infer Brand ownership from current Board data.

## Runtime Confirmation

No runtime files were changed.

This audit did not modify:

- `app.js`
- APIs
- database/schema
- save/load
- UI
- Dashboard
- Campaign Canvas
- Campaign Generator
- Campaign V3
- routing
- authentication
- local storage behavior
