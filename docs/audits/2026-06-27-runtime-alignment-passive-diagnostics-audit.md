# Runtime Alignment Passive Diagnostics Audit

| Field | Value |
|---|---|
| Date | 2026-06-27 |
| Type | Runtime Alignment PR 1 audit |
| Scope | Passive ownership diagnostics only |
| Runtime behavior changes | None intended |
| Files changed | `app.js`, `docs/audits/2026-06-27-runtime-alignment-passive-diagnostics-audit.md` |

## Documents Read

- `docs/runtime/runtime-alignment-readiness.md`
- `docs/product/workspace-architecture.md`
- `docs/product/brand-consciousness-architecture.md`
- `docs/product/product-knowledge-model.md`
- `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md`
- `docs/constitution/engineering-constitution.md`

## Audit Findings Before Implementation

Runtime Alignment PR 1 is the first implementation step recommended by the readiness roadmap: expose passive ownership diagnostics before changing startup, autosave, routing, board creation, or Campaign Canvas behavior.

The current runtime has practical Board and Canvas ownership signals, but Workspace and Active Brand do not yet exist as canonical runtime concepts. The safest useful diagnostic is therefore explicit about what exists and what is missing:

- User/session can be inferred from the existing `state.user` object.
- Workspace is reported as `exists: false` and `mode: "not-implemented"` because no active Workspace runtime context exists yet.
- Brand is reported as `exists: false` and `mode: "not-implemented"` because no active Brand runtime context exists yet.
- Board context can be inferred from `state.currentBoardId` or `/boards/:id`.
- Canvas source can be passively marked from existing load/generation paths.
- Autosave mode can be described from existing save semantics without changing those semantics.
- Startup branch can be recorded without changing `bootApp()` decisions.

## Exact Replacement / Implementation Boundary

The implementation was limited to passive diagnostics in `app.js`:

1. Add a small `state.runtimeDiagnostics` object for diagnostic metadata only.
2. Add helper functions that build and log a structured diagnostic object.
3. Mark the observed canvas source in existing load/generation branches.
4. Log diagnostics after boot completes.
5. Expose `window.debugRuntimeAlignmentDiagnostics` for manual QA, matching existing debug-window patterns.

No runtime flow was blocked, redirected, migrated, or rewritten.

## Diagnostics Added

The console log name is:

```text
[Runtime Alignment Diagnostics]
```

The structured object includes:

- `session.exists`
- `session.userEmail`
- `workspace.exists`
- `workspace.mode`
- `brand.exists`
- `brand.mode`
- `board.currentBoardId`
- `board.boardAccess`
- `board.isBoardBacked`
- `board.source`
- `canvas.hasNodes`
- `canvas.nodeCount`
- `canvas.edgeCount`
- `canvas.source`
- `canvas.isBoardBacked`
- `canvas.isAnonymousEditable`
- `autosave.mode`
- `autosave.wouldCreateBoard`
- `startup.branch`
- `startup.pathBoardId`
- `view.activeView`

## Behavior Unchanged Confirmation

This PR does not change:

- `bootApp()` branch decisions.
- Startup route selection.
- `currentBoardId` semantics.
- Board creation behavior.
- Autosave behavior.
- Save/load behavior.
- Local storage keys or payloads.
- Campaign Canvas rendering.
- Campaign V3 behavior.
- Dashboard behavior.
- Routing.
- APIs.
- CSS or HTML.

The diagnostics are observational. They do not block anonymous Canvas sessions, do not migrate local storage, do not claim Boards, and do not alter autosave decisions.

## Risks

### Console noise

The boot diagnostic adds one structured console log per app boot. This is intentional for PR 1 and should remain reviewable. If future environments require quieter behavior, the log can later be gated behind a debug flag in a separate PR.

### Source labeling is best-effort

`canvas.source` is diagnostic metadata, not canonical state. It reflects observed load/generation branches and should not be used for behavior decisions until a future ownership model is implemented.

### Autosave mode is descriptive

`autosave.mode` describes what the current save semantics would do. It does not change or prevent the behavior.

## Blast Radius

Low.

Touched runtime area:

- `app.js` diagnostics only.

Unaffected protected areas:

- Campaign Canvas rendering.
- Campaign V3.
- Dashboard UI.
- Routing.
- Autosave decisions.
- Board creation.
- Save/load payloads.
- APIs.
- CSS.
- HTML.

## Manual QA Checklist

- Open root app and confirm the console includes `[Runtime Alignment Diagnostics]` with `startup.branch` set to either `root-localStorage` or `root-empty/default`.
- Open `/boards/:id` and confirm diagnostics show `board.isBoardBacked: true`, `canvas.isBoardBacked: true`, and `startup.pathBoardId` populated.
- Generate a campaign and confirm a new diagnostic log has `reason: "generated-campaign"` and `canvas.source: "generated campaign"`.
- Move a node and verify Canvas behavior, save status behavior, and autosave behavior are unchanged.
- Confirm diagnostics explain whether the current Canvas is board-backed or anonymous/local-only.

## Decision

Proceed with passive diagnostics only.

Do not use these diagnostics as behavior gates in this PR. Future PRs should first review captured diagnostics across root, board URL, generated campaign, and edited Canvas flows before changing ownership, startup, or autosave behavior.
