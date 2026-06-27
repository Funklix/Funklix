# Canonical Brand Records Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 6 audit |
| Scope | Canonical Brand record architecture planning |
| Runtime changes | None |
| Files changed | `docs/audits/2026-06-27-canonical-brand-records-audit.md` only |
| Decision | Do not implement in this PR; use this audit to plan canonical Brand record work |

## Documents Read

- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-board-to-brand-association-audit.md`
- `docs/audits/2026-06-27-passive-brand-session-placeholder-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/engineering-constitution.md`

## Executive Summary

Canonical Brand records are the missing identity layer between Workspace administration and Brand-owned marketing intelligence.

The current runtime has Brand Core / Brand Brain state, Board-scoped Brand Brain snapshots, Board APIs, user ownership, and editor sharing. It does not yet have a durable Brand record, Brand ID, Brand registry, Brand switcher, or Brand-owned Board association.

This audit recommends introducing a future `brands` table / Brand object as the identity and owner container for Brand Consciousness. Brand Core and Brand Brain should live inside or under that Brand, but they are not the Brand record itself.

No runtime, API, database, UI, save/load, or migration changes were made.

## 1. Current State

### Current database / API patterns

The current persistence layer uses a small set of Vercel-style API route modules under `api/` and a PostgreSQL pool in `api/_boards-storage.js`.

Current Board persistence is defined through:

- `api/_boards-storage.js`
- `api/boards/index.js`
- `api/boards/[id].js`
- `api/_board-access.js`
- Board editor routes under `api/boards/[id]/editors/*`
- Board presence route under `api/boards/presence/[id].js`

Existing database style:

- tables use snake_case columns
- `boards.id` is UUID
- timestamps use `created_at` and `updated_at`
- owner fields use `owner_id`, `owner_email`, `owner_name`, `owner_avatar`
- creator fields use `created_by`
- Board content fields include `canvas_json` and `brand_core_snapshot`

Existing API payloads primarily expose snake_case persisted fields such as `canvas_json`, `brand_core_snapshot`, `owner_email`, and `created_by`.

### Current Brand runtime state

Current Brand-related runtime state is not a canonical Brand identity model.

Current pieces:

- `state.brandCore`
- `BRAND_CORE_STORAGE_KEY = "brandBrainState"`
- `brandBrainStorageKey()`
- `saveBrandBrainState()`
- `loadBrandBrainState()`
- `brand_core_snapshot` on Boards
- Brand Brain context helpers used by AI APIs
- passive `state.session.brandId = null`
- passive `brandSession.exists = false`

There is no canonical Brand record today.

### Current Brand absence

There is currently no:

- `brands` table
- Brand API route
- active Brand resolver
- Brand registry
- Brand switcher
- Brand permissions model
- Brand-owned Board list
- `boards.brand_id`
- durable `brandId` in client runtime

## 2. Where Canonical Brands Should Live

Canonical Brand records should live in the server database as first-class rows in a future `brands` table.

Recommended ownership direction:

```text
Workspace
↓
Brand record
↓
Brand Core / Brand Brain / Knowledge / Boards / AI Brain / Insights / Simulation
```

The Brand record should be the durable identity and ownership container. It should not be a loose local-storage object, a Board snapshot, a Canvas metadata field, or a value inferred from Brand Core content.

## 3. Recommended Brand Record Model

Recommended future table:

```sql
CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NULL,
  owner_id TEXT NULL,
  owner_email TEXT NULL,
  name TEXT NOT NULL,
  slug TEXT NULL,
  avatar_url TEXT NULL,
  icon TEXT NULL,
  color TEXT NULL,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ NULL
);
```

This is a recommended model only. It is not implemented in this PR.

### Required fields

#### `id`

Primary canonical Brand ID. Future `boards.brand_id`, `state.session.brandId`, AI context, Dashboard reads, Insights, Simulation, and Content Workspace should reference this ID.

#### `workspace_id`

The target architecture says Workspace owns Brand records. If a Workspace table exists when Brands are implemented, `workspace_id` should reference it.

If Workspace does not exist yet, use a temporary owner/user fallback rather than blocking all Brand work. See Workspace Dependency Recommendation below.

#### `owner_id` / `owner_email` fallback

If Workspace is not implemented, temporary owner fields can preserve access and support a single-user fallback. These should be treated as transitional administration fields, not Brand intelligence.

#### `name`

Human-readable Brand name. This is identity metadata, not positioning or Brand Brain truth.

#### `slug` or `key`

Optional stable URL/display key. Prefer `slug` if future URLs need readable Brand paths. Avoid relying on slug as the primary key.

#### `avatar_url`, `icon`, `color`

Optional presentation metadata for Brand switchers, Dashboard headers, and navigation. Keep this light. Rich avatar generation and archetype data belong in Brand Core / Brand Brain, not necessarily on the Brand record.

#### `created_by`

Creator identity. Follow existing backend style where Board rows use `created_by`.

#### `created_at` / `updated_at`

Standard timestamps consistent with existing Board persistence.

#### `archived_at`

Optional soft-archive timestamp. Prefer archiving before hard deletion because Brands own compounding knowledge and linked Boards.

## 4. Minimum Brand Fields

Minimum safe v1 Brand record:

```text
id
workspace_id NULL initially if Workspace is absent
owner_id / owner_email fallback if Workspace is absent
name
slug optional
avatar_url / icon / color optional
created_by
created_at
updated_at
archived_at optional
```

Do not include full Brand Core or Brand Brain JSON in the Brand identity row unless a future schema audit explicitly chooses that storage approach.

## 5. Brand Core / Brand Brain Relationship

### Brand record

The Brand record is the identity / owner container.

It answers:

- What Brand is active?
- Which Workspace/user administers it?
- Which Boards belong to it?
- Which Brand-scoped surfaces should load?
- How should the Brand appear in switchers and navigation?

### Brand Core

Brand Core is the editing surface for Brand knowledge.

It should contain editable strategic fields such as:

- mission / core narrative
- tone of voice
- messaging pillars
- value proposition
- personas / ICP
- content guidelines
- do's and don'ts
- brand voice examples
- keywords
- brand assets metadata
- Brand DNA / archetype / avatar details
- custom knowledge tiles

Brand Core should not be the Brand record itself.

### Brand Brain

Brand Brain is the structured knowledge/intelligence system inside the Brand.

It should own approved strategic truth and compounding learning. It may store richer structured knowledge than the Brand record and provide context to Dashboard, AI Brain, Campaign Canvas, Insights, Simulation, and Content Workspace.

### Current `brand_core_snapshot`

`brand_core_snapshot` is a Board compatibility snapshot. It should not become canonical Brand identity.

Future migration should treat Board snapshots as:

- recovery evidence
- import candidates
- historical Board context
- possible source material for explicit user-approved Brand Core migration

But not as automatic Brand identity.

## 6. What Should Remain in Brand Core vs Brand Record

### Keep in Brand record

- ID
- Workspace/admin owner reference
- display name
- slug/key
- lightweight icon/avatar/color
- archive state
- timestamps
- creator/admin metadata

### Keep in Brand Core / Brand Brain

- positioning
- voice
- tone
- messaging pillars
- ICP/personas
- founder story
- archetype/Brand DNA
- avatar prompt/details beyond simple display avatar
- research
- strategic decisions
- approved learning
- campaign history summaries
- knowledge provenance
- AI memory/recommendation outcomes after governance

### Do not duplicate across both without clear rules

Avoid storing strategic truth in both the Brand record and Brand Core. If a value is needed for display, store a lightweight display copy or derived summary only when a future audit defines update rules.

## 7. Workspace Dependency Recommendation

Workspace Architecture says Workspace owns Brand records.

Target model:

```text
workspaces.id
↓
brands.workspace_id
↓
boards.brand_id
```

However, the current runtime does not yet have Workspace records. Blocking Brand records until full Workspace implementation may slow migration too much.

Recommendation:

1. Design Brand records with nullable `workspace_id` from the start.
2. If Workspace records exist first, require `workspace_id` for new Brands.
3. If Workspace records do not exist yet, allow a transitional owner/user fallback using `owner_id` / `owner_email`.
4. Later migrate owner-backed Brands into Workspaces when Workspace runtime is implemented.
5. Never store marketing knowledge directly on Workspace.

A single-user workspace fallback is acceptable if explicitly documented as transitional and if it does not make Workspace own marketing knowledge.

## 8. Legacy Users: First Brand Strategy

Legacy users need a first Brand without losing access to Boards.

Recommended staged approach:

1. Create no automatic Brand during this audit.
2. In a future Brand records PR, create a clear onboarding or migration path.
3. Offer a personal default Brand only after user confirmation or onboarding establishes a single-brand workspace.
4. For existing multi-board users, show an explicit migration wizard before assigning Boards.
5. Preserve all legacy Boards as accessible even when no Brand assignment exists.

Avoid silent first-Brand creation from Board titles, Brand Core fields, or local storage snapshots.

## 9. Legacy Boards Before Assignment

Legacy Boards should remain accessible even before Brand assignment.

Recommended state:

```text
boards.brand_id = NULL
legacy_assignment_state = unassigned
```

Implementation options:

- Use nullable `boards.brand_id` plus query logic that still includes unassigned Boards for their owners/editors.
- Later add a dedicated assignment/migration status if needed.
- Avoid hiding unassigned Boards from My Boards.
- Avoid requiring Active Brand to open an existing legacy Board until migration UX exists.

Legacy Boards should not be treated as belonging to a random default Brand without user visibility.

## 10. Brand Switcher Future Listing

A future Brand switcher should list Brand records, not Brand Core snapshots.

Minimum read model:

```text
GET /api/brands
→ id, name, slug, avatar_url/icon/color, updated_at, archived_at, counts/summaries if safe
```

Future behavior:

- User enters Workspace.
- User selects active Brand.
- `state.session.brandId` is set from the selected Brand record.
- Dashboard, Boards, AI Brain, Insights, Simulation, and Content Workspace read inside that Brand.
- Board listing can filter by `boards.brand_id = activeBrandId` while still offering a legacy/unassigned view.

Do not build the Brand switcher from Board names or Brand Brain local storage.

## 11. API Impact

Future API additions likely include:

### Brand routes

- `GET /api/brands`
- `POST /api/brands`
- `GET /api/brands/:id`
- `PATCH /api/brands/:id`
- possibly `POST /api/brands/:id/archive`

### Board route changes after Brand exists

- `POST /api/boards` eventually requires or accepts `brand_id` when Active Brand is available.
- `GET /api/boards` eventually supports filtering by `brand_id`.
- `GET /api/boards/:id` eventually returns `brand_id`.
- Board move/reassignment should be a dedicated route or explicit PATCH operation with permission checks, not an accidental side effect of save.

### AI / Brand Brain routes

Existing AI routes pass `brandBrainData` and `boardId`. Future routes should eventually accept or resolve `brandId` so Brand Brain context comes from canonical Brand knowledge rather than Board snapshots alone.

## 12. DB / Schema Impact

Future DB changes likely include:

### New table

- `brands`

### Future indexes

- `brands(workspace_id)`
- `brands(owner_email)` for transitional owner-backed access if Workspace is absent
- `brands(slug)` or `(workspace_id, slug)` if slug is used
- `brands(archived_at)` only if list/archive queries require it

### Later Board association

- `boards.brand_id UUID NULL`
- index `boards(brand_id)`
- eventual foreign key `boards.brand_id REFERENCES brands(id)`
- eventual non-null requirement after migration

### Future Brand Brain storage

A later audit should decide whether Brand Brain is:

- JSONB on a `brand_brain` table keyed by `brand_id`
- versioned rows keyed by `brand_id`
- separate Knowledge / Memory tables keyed by `brand_id`

Do not overload the Brand identity record with the entire Brand Brain unless a future audit chooses that deliberately.

## 13. Client Runtime Impact

Future Brand records will eventually affect:

- `state.session.brandId`
- `brandSession` diagnostics
- startup resolver
- active Brand selection
- Brand switcher
- Dashboard / Mission Control
- Board listing
- Board creation
- duplicate/import behavior
- Brand Core save/load
- Brand Brain context for AI APIs
- Insights and Simulation scopes
- local storage keys

First client PR should be passive:

- fetch/list Brands only after API exists
- set `state.session.brandId` only from a real Brand record
- do not infer from existing state
- keep legacy Boards accessible

## 14. Risks

- Creating fake Brands from Board or Brand Core data.
- Treating Brand Core as the Brand record.
- Treating Brand Brain as a profile row rather than knowledge inside Brand.
- Blocking legacy Board access before migration.
- Creating Brands without Workspace/permission clarity.
- Building a Brand switcher from Board snapshots.
- Moving Boards between Brands without explicit permission checks.
- Making `boards.brand_id` non-null before migration.
- Adding Brand APIs that duplicate Board permissions incorrectly.
- Hiding agency/multi-client complexity behind a single default Brand.

## 15. Recommended PR Sequence

### PR 6A: Canonical Brand records audit

This PR. Documentation only.

### PR 6B: Brand schema design doc / API contract

Define exact Brand route contracts and database constraints before implementation.

Files: docs only.

Risk: low.

### PR 6C: Add `brands` table nullable Workspace owner fallback

Add a `brands` table with `workspace_id` nullable and owner fallback fields. Do not connect Boards yet.

Files likely affected:

- `api/_boards-storage.js` or a new shared storage module
- possibly new `api/_brands-storage.js`

Risk: medium.

### PR 6D: Add passive Brand API list/create

Add Brand APIs without changing startup or Board behavior.

Files likely affected:

- `api/brands/index.js`
- `api/brands/[id].js`

Risk: medium.

### PR 6E: Passive client Brand diagnostics

Fetch/list Brands and show them only in diagnostics or a developer-safe path. Do not change UI or routing yet.

Risk: medium.

### PR 6F: Active Brand selection model

Introduce a real Active Brand resolver and set `state.session.brandId` from a Brand record.

Risk: medium-high.

### PR 6G: Board-to-Brand association field

Add nullable `boards.brand_id` after Brand records exist.

Risk: medium-high.

### PR 6H: Legacy migration wizard / assignment flow

Allow users to assign legacy Boards to Brands explicitly.

Risk: high.

### PR 6I: Require Active Brand for new Boards

Only after migration paths exist, require new Boards to be created inside an Active Brand.

Risk: high.

## 16. What Not To Do

Do not:

- create fake Brand IDs
- infer Brand from Board title
- infer Brand from Brand Core fields
- infer Brand from Brand Brain local storage
- infer Brand from Brand DNA/avatar fields
- attach Boards to a default Brand silently
- hide legacy Boards before assignment
- make `boards.brand_id` required before migration
- put the whole Brand Brain on the Brand identity record without a separate storage audit
- build Brand switcher from Board snapshots
- change APIs, schema, UI, routing, save/load, or runtime behavior in this audit

## Runtime Confirmation

No runtime files were changed.

This audit did not modify:

- `app.js`
- APIs
- database/schema
- UI
- routing
- save/load
- autosave
- Dashboard
- Brand Core
- AI Brain
- Campaign Canvas
- Campaign Generator
- Campaign V3
- local storage behavior
