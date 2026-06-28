# Passive Board Ownership Diagnostics Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Runtime Alignment PR 15 audit |
| Scope | Passive diagnostics for Board → Brand ownership readiness |
| Runtime behavior changes | None; diagnostics only |
| Files changed | `app.js`, `docs/audits/2026-06-28-passive-board-ownership-diagnostics-audit.md` |

## Documents Read

- `docs/audits/2026-06-27-board-to-brand-association-audit.md`
- `docs/audits/2026-06-27-canonical-brand-records-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/constitution/engineering-constitution.md`

## Goal

Add passive diagnostics that report whether the currently loaded Board has canonical Brand ownership.

This PR does not implement Brand records, Board-to-Brand association, schema changes, API changes, save/load changes, routing changes, UI changes, or behavior changes.

## Audit Findings

### 1. Current Board ownership state

The current runtime has Board identity and user/editor ownership signals, but it does not have canonical Brand ownership.

Available Board context today includes:

- `state.currentBoardId`
- `/boards/:id`
- `state.session.boardId`
- `state.currentBoardName`
- `state.boardAccess`
- owner/editor metadata

Current Board payloads do not include a canonical `brand_id` / `brandId` field.

### 2. Future ownership direction

The Board-to-Brand audit recommends future `boards.brand_id` on the backend and `brandId` in client runtime only after canonical Brand records exist.

Until then, diagnostics must not infer Brand from:

- Board title
- Brand Core fields
- Brand Brain snapshots
- user email
- owner metadata
- Canvas content

### 3. Safe diagnostic shape

The passive diagnostic shape is:

```js
boardOwnership: {
  hasBrandOwner: false,
  brandId: null,
  source: "not-implemented",
  reason: "boards-have-no-canonical-brand-field"
}
```

If a future/unknown payload already contains `brand_id` or `brandId`, diagnostics may report it passively:

```js
boardOwnership: {
  hasBrandOwner: true,
  brandId: "...",
  source: "board-load-response",
  reason: "brand-field-present-passive-only",
  field: "brand_id",
  trustedForBehavior: false
}
```

The key safety rule is that a detected field is never used for behavior in this PR.

## Implementation Summary

### Helpers added

- `readPassiveBrandIdFromBoardPayload(boardPayload)` reads only explicit `brandId` / `brand_id` fields.
- `buildPassiveBoardOwnershipDiagnostics(boardPayload, source)` builds the passive diagnostic object.
- `setPassiveBoardOwnershipDiagnostics(boardPayload, source)` stores the passive diagnostic object in `state.runtimeDiagnostics.boardOwnership`.
- `getPassiveBoardOwnershipDiagnostics()` reads the current diagnostic object for Runtime Alignment Diagnostics.

### Passive update points

Diagnostics are updated from currently available Board responses only:

- Board load response.
- Save-as-new response.
- Duplicate Board response.
- Save/update response.

No payload shape is changed. No field is added to requests. No schema is changed.

### Runtime Alignment Diagnostics

`buildRuntimeAlignmentDiagnostics()` now includes:

```js
boardOwnership: getPassiveBoardOwnershipDiagnostics()
```

This lets `window.debugRuntimeAlignmentDiagnostics()` show whether the current Board has canonical Brand ownership information.

## Behavior Unchanged Confirmation

This PR does not:

- add `brand_id` to API payloads
- change database/schema
- change Board save/load behavior
- change Board creation behavior
- infer Brand from Board title
- infer Brand from Brand Core
- attach Boards to Brands
- create Brands
- change UI
- change Dashboard
- change Autosave
- change Canvas
- change routing

## Risks

### 1. Treating future fields as trusted too early

If a future payload includes `brand_id` / `brandId`, this PR reports it but marks it `trustedForBehavior: false`. Future behavior must wait until canonical Brand records, migration, and access rules exist.

### 2. Confusing Brand Core with Brand owner

Brand Core and Brand Brain snapshots are not Brand records. The helper intentionally ignores those fields.

### 3. Diagnostic drift

When a real `brand_id` column and API response are implemented, this diagnostic should be updated in the same PR to reflect canonical confidence and migration states.

## Rollback Plan

Rollback is low risk:

1. Remove the Board ownership helper functions.
2. Remove `boardOwnership` from Runtime Alignment Diagnostics.
3. Remove passive update calls from Board response handlers.
4. Remove this audit file.

No schema, API, routing, save/load, Dashboard, Canvas, Autosave, Brand, or Workspace behavior depends on this diagnostic.

## Manual QA Checklist

1. Root diagnostics:
   - `boardOwnership.hasBrandOwner` is `false`.
   - `boardOwnership.brandId` is `null`.
2. `/boards/:id` diagnostics with current payloads:
   - Board loads normally.
   - `boardOwnership.hasBrandOwner` is `false`.
   - `boardOwnership.reason` is `"boards-have-no-canonical-brand-field"`.
3. Autosave behavior is unchanged.
4. Board load/save behavior is unchanged.

## Decision

Proceed with passive Board ownership diagnostics only.

Do not implement Brand records, Board-to-Brand association, schema changes, API changes, migrations, UI, routing, Dashboard, Canvas, or Autosave changes in this PR.
