# Passive Brand Session Placeholder Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 4 audit |
| Scope | Passive Active Brand readiness diagnostics |
| Runtime behavior changes | None intended |
| Files changed | `app.js`, `docs/audits/2026-06-27-passive-brand-session-placeholder-audit.md` |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-session-foundation-audit.md`
- `docs/constitution/engineering-constitution.md`

## Audit Findings Before Implementation

Runtime Alignment PR 3 introduced a passive Session container:

```js
state.session = {
  workspaceId: null,
  brandId: null,
  boardId: null,
  source: "initial",
  isInitialized: false
}
```

The current runtime can mirror legacy Board context into `session.boardId`, but it still does not have a canonical Workspace runtime or canonical Active Brand runtime.

PR 4 should therefore not create a Brand. It should only make that absence explicit in diagnostics so future Brand migration work can proceed safely.

## Current Brand Core / Brand Brain Runtime State

The current runtime has Brand Core / Brand Brain state and storage helpers:

- `state.brandCore` stores Brand Core / Brand Brain fields in memory.
- `BRAND_CORE_STORAGE_KEY` is `brandBrainState`.
- `brandBrainStorageKey()` scopes the local-storage key by Board ID when a Board exists, otherwise it falls back to the global Brand Brain key.
- Board load can hydrate `state.brandCore` from a Board's `brand_core_snapshot`.
- `saveBrandBrainState()` stores the current Brand Brain state in local storage and can mark the Board dirty.

This is not the same thing as a canonical Active Brand runtime.

Brand Core / Brand Brain currently behaves as knowledge/configuration state. It does not provide a durable `brandId`, Brand record, Brand ownership model, Brand switcher, Brand registry, or Brand-owned Board association.

## Whether Any Canonical Brand ID Exists

No canonical Brand ID exists in the current runtime.

Observed runtime signals:

- `state.session.brandId` is `null`.
- No active Brand object exists in `state`.
- No Brand registry or Brand switcher exists in runtime state.
- Board data is not yet attached to a canonical Brand ID.
- Brand Core fields and Brand Brain local-storage keys do not equal Brand identity.

## Why Not Infer Brand Automatically

The runtime should not infer Brand from existing data because that would create hidden ownership rules that may be wrong.

Rejected inference paths:

- Do not infer Brand from Board title.
- Do not infer Brand from Brand Core fields.
- Do not infer Brand from Brand Brain local storage.
- Do not infer Brand from Brand DNA or avatar fields.
- Do not infer Brand from Campaign content.
- Do not infer Brand from user email or workspace assumptions.

Inferring a fake Brand would risk binding unrelated Boards or local caches to the wrong future Brand, weakening the Workspace → Brand → Board architecture.

## Why `brandId` Remains Null

`brandId` remains `null` because no canonical Brand runtime exists yet.

This is intentional. A future Active Brand implementation should introduce Brand records, Brand selection, Brand-owned Board association, migration/recovery behavior, and permissions deliberately rather than silently deriving identity from current local or Board-scoped knowledge.

## Implementation Boundary

The implementation was limited to passive diagnostics:

1. Add a comment near `state.session.brandId` explaining that Active Brand runtime is intentionally not implemented yet.
2. Add `getPassiveBrandSessionReadiness()`.
3. Extend Runtime Alignment Diagnostics with `brandSession`.
4. Add an architecture warning in diagnostics only.

No behavior reads from `brandSession`, and no runtime logic was migrated.

## Passive Brand Diagnostics Added

Runtime Alignment Diagnostics now include:

```js
brandSession: {
  exists: false,
  brandId: null,
  source: "not-implemented",
  reason: "no-canonical-brand-runtime"
}
```

The diagnostic may also include evidence that Brand Core / Brand Brain data exists, but that evidence is explicitly not treated as canonical Brand identity.

## Runtime Confirmation

This PR does not change:

- Startup behavior.
- Autosave behavior.
- Routing behavior.
- Board loading behavior.
- Save/load behavior.
- Board data shape.
- API behavior.
- Dashboard behavior.
- Brand Core behavior.
- AI Brain behavior.
- Campaign Canvas behavior.
- Campaign Generator behavior.
- Campaign V3 behavior.
- UI.
- CSS.

This PR does not:

- Create fake Brand IDs.
- Infer Brand from Board title.
- Infer Brand from Brand Core fields.
- Create localStorage Brand records.
- Attach Boards to Brands.
- Migrate existing Boards.
- Write `brandId` to save/load payloads.

## Blast Radius

Low.

Touched runtime area:

- `app.js` diagnostics only.

The diagnostic helper reads existing Brand Core / Brand Brain signals for evidence, but does not write or mutate Brand data.

## Future Migration Path Toward Brand-Owned Boards

A safe future migration should proceed in separate audited PRs:

1. Add passive Workspace readiness diagnostics.
2. Introduce canonical Brand records and an Active Brand resolver.
3. Keep existing Boards unmodified until Brand identity is explicit.
4. Add a migration/backfill plan for existing Boards.
5. Add nullable `brandId` to Boards only after Brand records exist.
6. Backfill existing Boards to an explicit user-confirmed or default Brand.
7. Require new Boards to be created inside an Active Brand.
8. Only then migrate Dashboard, AI Brain, Insights, Simulation, and Content Workspace to Active Brand reads.

## Manual QA Checklist

1. Open root `/`.
   - Diagnostics show `session.brandId: null`.
   - Diagnostics show `brandSession.exists: false`.
   - Diagnostics show `brandSession.source: "not-implemented"`.
   - Diagnostics show `brandSession.reason: "no-canonical-brand-runtime"`.
2. Open `/boards/:id`.
   - Diagnostics show `session.boardId` mirrors the Board ID.
   - Diagnostics show `session.brandId: null`.
   - Diagnostics show Brand session remains not implemented.
3. Generate a campaign.
   - Campaign generation behavior is unchanged.
4. Open / edit Brand Core.
   - Brand Core behavior is unchanged.
   - Brand Core fields are not promoted to Brand identity.
5. Open AI Brain.
   - AI Brain behavior is unchanged.

## Decision

Proceed with passive Brand session readiness diagnostics only.

Do not create, infer, store, migrate, attach, or route by Brand ID in this PR.
