# Save Path Readability Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | Runtime Alignment PR 14A audit |
| Scope | Save/autosave naming and readability only |
| Runtime behavior changes | None intended |
| Files changed | `app.js`, `docs/audits/2026-06-28-save-path-readability-audit.md` |

## Documents Read

- `docs/audits/2026-06-28-autosave-create-update-separation-audit.md`
- `docs/runtime/runtime-alignment-readiness.md`
- `docs/constitution/engineering-constitution.md`

## Goal

Prepare the save architecture for future create/update separation without changing runtime behavior.

This PR does **not** split POST/PUT yet, does **not** add an autosave guard, and does **not** change save, autosave, routing, APIs, Board ownership, or diagnostics behavior.

## Helper Map Before

| Concern | Before PR 14A |
|---|---|
| Existing Board ID lookup | Repeated inline reads of `state.currentBoardId || getBoardIdFromPath()`, plus one inline `/boards/:id` pathname parse inside `saveBoardToServer()`. |
| Persistence target | `saveBoardToServer()` locally computed `currentBoardId`, `isUpdate`, `endpoint`, and `method`. |
| Autosave debug Board ID | Inline `state.currentBoardId || getBoardIdFromPath()` reads. |
| Passive session Board mirror | Inline `state.currentBoardId || getBoardIdFromPath() || null`. |
| Autosave diagnostics Board ID | Inline `state.currentBoardId || getBoardIdFromPath()`. |

## Helper Map After

| Concern | After PR 14A |
|---|---|
| Existing Board ID lookup | `resolveExistingBoardId()` returns the current legacy Board ID source: `state.currentBoardId || getBoardIdFromPath()`. |
| Persistence target | `resolveBoardPersistenceTarget()` returns `{ boardId, isUpdate, endpoint, method }` using the same create/update decision currently used by `saveBoardToServer()`. |
| Autosave debug Board ID | Reads `resolveExistingBoardId()`. |
| Passive session Board mirror | Reads `resolveExistingBoardId()`. |
| Autosave diagnostics Board ID | Reads `resolveExistingBoardId()`. |

## Behavior Unchanged

The helpers are readability wrappers only.

They do not:

- change the source of Board ID authority
- block autosave
- change POST vs PUT semantics
- split create/update execution
- change payload shape
- change save status copy
- change conflict handling
- change routing
- change APIs
- change Board ownership
- change diagnostics fields or meaning

`saveBoardToServer()` still chooses `PUT /api/boards/:id` when a Board ID exists and `POST /api/boards` when no Board ID exists.

That behavior remains intentionally unchanged so PR 14B can be reviewed as the first true behavior change.

## Future Insertion Point for Autosave Guard

The future PR 14B insertion point is immediately after `resolveBoardPersistenceTarget()` is called inside `saveBoardToServer()` and before the endpoint is used.

Recommended future guard shape:

```text
const persistenceTarget = resolveBoardPersistenceTarget();
if (trigger === "autosave" && !persistenceTarget.boardId) {
  // Keep dirty state.
  // Do not POST.
  // Set recoverable non-saved status.
  // Update diagnostics.
  return false;
}
```

This keeps the future change small and focused because PR 14A gives the autosave guard a single readable target object to inspect.

## Risks

### 1. Accidental behavior change through helper semantics

The helper must not infer Workspace, Brand, or Board ownership. It must only preserve the legacy Board ID sources.

### 2. Premature reliance on Active Context

This PR intentionally does not use `getActiveContext()` as save authority. Active Context remains a read-only diagnostic/read-model until stronger ownership invariants are implemented.

### 3. False sense of safety

This PR does not fix autosave-created Boards. The implicit POST behavior remains until PR 14B adds an autosave-only guard.

## Runtime Confirmation

This PR changes naming/readability only.

It does not change:

- autosave behavior
- save behavior
- create behavior
- update behavior
- routing
- APIs
- Board ownership
- conflict handling
- save/load payloads
- Dashboard
- Campaign Canvas rendering
- Campaign V3
- Brand Core
- AI Brain
- Insights
- Simulation

## Manual QA Checklist

1. Manual Save on an existing Board still updates the Board.
2. Autosave on an existing Board still updates the Board.
3. Existing explicit Board creation still works through the Boards create flow.
4. Duplicate Board still creates a copy.
5. Conflict save-as-new still creates a new Board only through explicit conflict action.
6. Runtime diagnostics still report the same save/autosave ownership states.

## Decision

PR 14A is safe if it remains limited to helper naming/readability. The next behavior-changing PR should be PR 14B: add the autosave update-only guard at the `resolveBoardPersistenceTarget()` insertion point.
