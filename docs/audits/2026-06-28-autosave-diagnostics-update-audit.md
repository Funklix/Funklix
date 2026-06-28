# Autosave Diagnostics Update Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Runtime Alignment PR 14C audit |
| Scope | Runtime Alignment Diagnostics for autosave update-only behavior |
| Runtime behavior changes | None; diagnostics/readability only |
| Files changed | `app.js`, `docs/audits/2026-06-28-autosave-diagnostics-update-audit.md` |

## Documents Read

- `docs/audits/2026-06-28-autosave-update-only-guard-audit.md`
- `docs/audits/2026-06-28-autosave-create-update-separation-audit.md`
- `docs/audits/2026-06-27-runtime-alignment-passive-diagnostics-audit.md`
- `docs/constitution/engineering-constitution.md`

## Goal

Make Runtime Alignment Diagnostics reflect the PR 14B autosave update-only guard so QA and future migration work can verify that autosave will not implicitly create Boards.

This PR does not change autosave behavior. It only updates diagnostic reporting and stores passive last-blocked metadata when the existing PR 14B guard fires.

## Audit Findings

### 1. Current diagnostic mismatch

After PR 14B, autosave no longer creates Boards when no existing Board ID exists. However, diagnostics still had legacy language that could imply create behavior in some states.

That mismatch made it harder to verify the new architecture rule:

```text
Autosave updates only.
Boards are created explicitly.
```

### 2. Required diagnostic modes

Autosave diagnostics should now report:

| Runtime state | Diagnostic mode | `wouldCreateBoard` |
|---|---|---|
| Existing Board ID exists | `update-existing-board` | `false` |
| No Board ID exists and autosave is update-only blocked | `blocked-no-board` | `false` |
| Board is read-only | `blocked-read-only` | `false` |

### 3. Passive metadata only

When the PR 14B guard blocks an autosave attempt, it is safe to store passive metadata in `state.runtimeDiagnostics.lastBlockedAutosave` because that object is already diagnostic/read-only support data.

The metadata is not used as behavior authority.

## Implementation Summary

### `getRuntimeAutosaveDiagnostics()`

Updated autosave diagnostics to:

- return `mode: "update-existing-board"` when `resolveExistingBoardId()` finds a Board ID
- return `mode: "blocked-read-only"` when board access is read-only
- return `mode: "blocked-no-board"` when no Board ID exists
- always return `wouldCreateBoard: false`
- include `reason: "autosave-update-only"` when no Board ID exists
- include `lastBlockedAutosave` metadata if the guard has fired in the current session

### PR 14B console warning alignment

Aligned the existing autosave guard warning with the diagnostic shape by storing:

- `mode: "blocked-no-board"`
- `reason: "autosave-update-only"`
- `trigger`
- `at`
- `hasNodes`
- `hasEdges`
- `canvasSource`

in `state.runtimeDiagnostics.lastBlockedAutosave` before logging.

## Behavior Unchanged

This PR does not:

- change autosave scheduling
- change autosave guard behavior
- change save behavior
- change routing
- call new endpoints
- change APIs
- change Dashboard
- change Canvas rendering
- change Campaign V3
- change manual save behavior
- change explicit Board creation flows

## Manual QA Checklist

1. Root `/` with no Board:
   - Runtime Alignment Diagnostics show `autosave.mode: "blocked-no-board"`.
   - Runtime Alignment Diagnostics show `autosave.wouldCreateBoard: false`.
   - Runtime Alignment Diagnostics show `autosave.reason: "autosave-update-only"`.
2. Existing `/boards/:id`:
   - Runtime Alignment Diagnostics show `autosave.mode: "update-existing-board"`.
   - Runtime Alignment Diagnostics show `autosave.wouldCreateBoard: false`.
3. Trigger an autosave attempt without a Board:
   - Console warning still appears.
   - `state.runtimeDiagnostics.lastBlockedAutosave.reason` is `"autosave-update-only"`.
   - No Board is created from autosave alone.

## Risks

### Diagnostic wording drift

Future changes should keep diagnostic names aligned with actual save behavior. If autosave behavior changes again, diagnostics should be updated in the same PR.

### Misusing diagnostic state as authority

`lastBlockedAutosave` is passive metadata only. Future PRs should not use it to decide whether a save may proceed.

## Rollback Plan

Rollback is simple:

1. Restore `getRuntimeAutosaveDiagnostics()` to its previous diagnostic modes.
2. Remove the `state.runtimeDiagnostics.lastBlockedAutosave` assignment from the PR 14B guard.
3. Remove this audit file.

No schema, API, routing, Canvas, Dashboard, Campaign V3, Brand, Workspace, save payload, or autosave behavior changes are involved.

## Decision

Proceed with diagnostic-only alignment so Runtime Alignment Diagnostics now show the true post-PR-14B autosave state: autosave can update an existing Board but will not create one.
