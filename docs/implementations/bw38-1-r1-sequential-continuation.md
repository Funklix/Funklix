# BW-38.1-R1 — Sequential continuation across native Canvas exits

Base: main `b19c450` (merged PR #835). Targeted client correction only.

## Reproduction and rejected predicate

Production Chromium shell/controllers, signed production proposal/scope handlers,
fictional SQL transport and the existing Appics two-post fixture reproduce:
Instagram → Prepare → explicit Create → Canvas/Inspector → Home → AI Brain → X
Prepare. Before the correction, the first node is consumed and the conversation
remains, but Prepare becomes `stale`, with:

> Instagram Post → Social Media Posting · Created locally, not saved yet · 1 remaining · Source context changed

The specific rejected predicate in `aiBrainContentSourceCurrent` is
`(continuation?.context || source.context) === current.context`. The context
contains Canvas selection. `resetAdaptiveCanvasView` clears selection on every
native Board exit; `setActiveView` previously advanced the continuation context
only for a **direct** Board → AI Brain exit. Home/List/Insights/Content Workspace
exits performed the same authorized reset without its allowance. The next source
check permanently set `contentProposalInvalid`. This occurs before any autosave;
autosave timing is not the sole cause.

The unchanged main passes the direct Board → AI Brain path. The fictional replay
reproduces the exact reported status through intermediate navigation; it does not
establish the navigation history or deployed version of the live Appics session.

## Narrow correction

Apply the existing guarded selection-reset allowance to every actual Board exit
owned by `setActiveView`, instead of only a direct exit to AI Brain. Before reset,
the source must still pass all existing checks and the selected node must be the
last independently consumed native insertion. After reset, the complete persisted
snapshot must still match and both selection owners must be empty. Only then is
the continuation's local context advanced. Original answer/question/source binding,
completion records, expected saved scope and authorization checksum are unchanged.

No arbitrary Canvas baseline is captured. Manual deselection before exit, unrelated
Inspector/Canvas edits, undo, partial insertion, source changes, different account,
Board/load generation, Workspace/catalog/association changes and remote revisions
continue to fail existing checks. No server access or revision predicate changed.
Canonical Brand permissions remain independent. Social remains deterministic;
Content retains explicit preparation with `store:false`.

Before: Instagram created → Home → Brain → X rejected. After: Instagram created →
Home (or another native view) → Brain → X Prepare → explicit Create → Save → Reload
retains two independent native Social Media Posting Drafts. The successful source
is immutable, and the first asset is never recreated.

## Local and saved state

Created cards remain disabled and labelled Created. Remaining cards explicitly
show Available after the first creation. Local completion remains “not saved yet”
until the existing save owner acknowledges its exact submitted snapshot/revision.
While saving, Add to Canvas remains visible but disabled with an explanation that
continuation resumes when saving finishes. No pending request is called successful.
Failures, conflicts and lost acknowledgements retain existing fail-closed behavior.
There are no persistence/history/autosave owner changes.

## Validation and delivery

The existing `check:bw38.1` suite now uses actual Create clicks for the uninterrupted
Instagram/X pair. Added populated-Board cases cover Board → Home/List/Insights/
Content Workspace → Brain with immediate local, pending autosave and confirmed
save states, then independent second creation and save/reload. Original source
identity is compared before/after. Negative cases reject arbitrary selection and
Inspector edits before exit. Existing signed-scope, remote mutation/revocation,
identity, conflict/failure/lost-ack, duplicate-click, undo, insertion recovery,
EN/DE, theme, mobile and keyboard cases remain. An additional sequential native
Content pair uses the production handler with mocked Responses transport and
asserts exactly two explicit `store:false` preparations.

Runtime Boot Safety already runs `check:bw38.1` in both PostgreSQL 17.6/18.4 jobs;
no workflow or check was removed. Actual final CI and review results belong to the
PR delivery report, rather than being inferred from the test definition.

Changed files: `app.js`, `scripts/check-bw38-1-sequential-assets.js`,
`scripts/check-bw28-3-1-insights-runtime-rendering.js`, this document. The older
Insights VM fixture now initializes the real `aiBrain.messages` owner instead of
the obsolete `turns` field; its immutability and rendering assertions are unchanged.
No migrations, node schemas, dependencies, inference expansion, deployment or merge.
