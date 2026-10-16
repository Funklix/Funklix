# BW-36.21A-R2.1 — Safe Workspace switching

Date: 2026-10-16 (Europe/Berlin). Scope: lifecycle/data-integrity repair only.
Base: merged `main` at `33a80b62f8791849f267ccbe9a931b72eccb07ec` (#783), verified through GitHub and `git fetch origin main`.

## Confirmed causes

The merged [R2 navigation audit](../audits/bw36-21a-r2-workspace-and-brand-navigation-audit.md) identified that `selectSessionWorkspace` only protected the Brand Profile. It cleared Board identity conditionally on catalog inclusion, retaining Canvas, permissions, association/snapshot, revision, collaboration and asynchronous load/save owners. An independently shared Board absent from the catalog did not exit at all. [The Home architecture audit](../audits/bw36-21-start-screen-intelligence-and-insights-audit.md) establishes the shell, direct-route, independent authorization and no-hydration Home boundaries retained here.

Inspection also confirmed that save status branches (including 409) ran before request invalidation; stale Board-load failures could overwrite current status; presence failure/finally lacked generation ownership. Successful saves previously captured the *current* Canvas as their saved baseline, including edits made after dispatch, and accepted incomplete acknowledgments. Those paths could make subsequent Workspace navigation unsafe even with a dirty-state guard.

## Existing owners and handling

| Owner | Behavior in this repair |
| --- | --- |
| `selectSessionWorkspace` | Remains the single Workspace-selection owner. Requires the authenticated account and its ready catalog; same-Workspace activation performs no leave/reset. Captures account object/email, Workspace, Board, route and catalog/load/save/association generations. Superseded attempts cannot commit. |
| `guardBrandProfileLeave`, `closeCanonicalBrandDetail` | Existing Profile busy and Save/Discard/Keep editing behavior remains. Resume closes over the original navigation attempt; successful Profile saves may reconcile the catalog projection without inventing a new attempt. Failed or conflicted Profile saves retain inputs. |
| `showUnsavedLeaveModal`, `detectDirtyFromSnapshot`, `buildLastSavedSnapshot` | Uses the existing dirty flag and snapshot watcher, including edits before its next timer tick. Workspace-specific Cancel/Discard copy explicitly says switching does not save. Cancel retains the Board and content. Save remains the existing Board action, followed by a deliberate retry. The reused modal supports Escape, focus return and trapped keyboard focus. A newer selection closes the superseded Workspace confirmation. |
| `loadBoardFromUrlIfPresent`, hydration flags | Loading/hydration blocks switching until settled. Retirement advances `boardLoadGeneration`; stale failures cannot update the new context's status. Existing direct-route loading and density ownership remain. |
| `saveBoardToServer`, `saveBoardAsNew` | Manual/autosave/conflict operations block exit. Retirement advances `latestSaveRequestId`. Every decoded status, including 401/409, is rejected if stale; the conflict decision is checked again after awaiting it. A successful acknowledgment requires Board identity and server timestamp; the baseline represents submitted content, so later edits stay dirty. Endpoint selection, serializer, optimistic revision and update-only autosave contracts stay unchanged. |
| `scheduleAutosave`, `clearAutosaveTimer` | Existing scheduling/eligibility remain. Retirement clears pending timers; the blank target context has an accurate clean snapshot and no Board edit capabilities. An autosave that starts during confirmation makes that attempt stale; it is not treated as a cancelled server write. |
| `submitBoardBrandAssociation`, comparison/refresh/restore/initialization | Existing submission/operation flags block exit. Snapshot write/initialization promises are held until completion. Retirement invalidates association/comparison owners and clears authoritative snapshot/provenance/backups. Navigation never issues an association or snapshot write. |
| Campaign creation, responsibilities | Existing `suspendAutosave`, project pending and responsibility hold/save/conflict/retry owners remain authoritative. A failed responsibility save continues blocking until its existing deliberate retry completes. Campaign V3 generation/creation implementations and protected hashes are unchanged; their existing stable controller and debug entry are guarded. |
| Presence/Board refresh | Stop existing polling, selection/cursor timers, follow state and badges. Presence completion/error/finally belongs to its captured account/generation and request context, allowing a new Board's ping while an old ping finishes. Refresh finalization cannot clear a newer generation's in-flight flag. |
| Other async Board producers | A local pending-operation set only holds Workspace exit until their original functions settle. It owns no navigation, content or dirty state and cancels no writes. This covers sharing/editor operations, duplicate/save-as-new, strategy/document/Founder Story/domain/logo/avatar/DNA operations, legacy campaign entry, node refinement/content/review/next-step/image/visual operations and publication. Posting schedule queues and approval-saving/verifying states also block exit. |
| AI Brain, project/library/Home/preview owners | Reuse AI abort/request invalidation, project invalidation, Brand preference/catalog request generations, Board generation, publishing/engagement generations and Home scope synchronization. Increment the outgoing library request object before replacing it, so captured references reject late results. Clear cached outgoing profile projections, previews and lists. |

These small operation holds surround the existing async bodies with `try/finally`; they do not reroute requests, add provider calls, replace their validation, or claim that aborting a browser request cancels a server write. Busy operations give a localized reason in the existing sidebar status and Home feedback and require a retry after settlement.

## Commit boundary, cleanup and authorization

After each asynchronous decision, the handler rechecks the captured account, original Workspace/Board/route and operation generations. It rejects content edited during confirmation or access verification. It reads the authenticated session and a fresh, fully validated `/api/workspaces` catalog through the existing catalog client. Accepted membership in an active Workspace is established by that existing server endpoint; stale client catalog membership alone is insufficient. Deleted, archived, revoked, malformed, denied or unavailable targets cannot commit a switch. A failed access read does not replace the outgoing catalog or reset the Board.

After explicit exit authorization, `retireBoardForWorkspaceSwitch` stops and invalidates the outgoing owners, closes Board-specific transient surfaces, resets connection/Inspector/adaptive presentation state, and uses `applyCampaignState(blankCanvasState(), ..., { memoryOnly: true })` for the existing safe Canvas reset. It additionally clears owner/access/sharing/public-token state, association and authoritative Brand Core, revisions/conflicts, history, filters, activity/discussions, responsibility roster, presence/cursors, approval/runtime projections, Brain messages, Brand caches and library rows. It removes only the unscoped local Canvas projection, preserving saved Boards and per-Board Brand storage. The empty baseline remains clean under the existing watcher; `resetCampaignCanvasState` is not used as the entire cleanup.

The share-panel reset runs before the final capability clear because its legacy ownership projection can otherwise restore `unowned` edit capability. The handler then adopts the fresh authorized target, retains the current release's neutral/singleton Brand selection rule, replaces the route with `/`, and opens Home through existing routing/rendering. It automatically opens no Board and imports no outgoing Canvas or Brand snapshot. Required DOM, IDs and bindings remain.

A shared Board absent from the catalog exits through exactly the same cleanup. Direct/shared/public Board routes still use the existing loader and serializer; Board access never adds a Workspace/Brand membership or expands the catalog. Existing server authorization, creation entitlement/UI, Brand selection and association write rules, Profile ownership, AI Brain/Advisor/Learnings behavior, database/schema and serializers are unchanged.

## Regression evidence

All requests use disposable local fixtures and interception. No production SQL/data, real provider generation, paid requests or deployment is used.

- `npm run check:bw36.21ar2.1`: 31 browser groups cover clean/dirty/local state, cancel/discard, confirmed/failed/offline/conflicted/malformed save, edits during a save, dirty Profile decisions, loading/hydration, stale save success/409/failure, autosave races, node preview cleanup/refinement, actual delayed association/campaign/responsibility requests and responsibility retry, late presence/refresh, independent shared routes/reload/Back, revoked/stale/unavailable targets, account/logout changes during decisions and catalog requests, rapid superseding selections, same-Workspace no-op, persistence immutability and cleared target capabilities/data.
- Existing BW-36.21A/R1 Home suite: all functional assertions retained; one explicit wait added for the now-asynchronous authorized Workspace commit. Covers Home/sidebar, metadata isolation, direct routes/reload/Back, dirty Canvas retention, rapid Board loads and load failure recovery.
- Complete local Runtime Boot Safety: **PASS, 181/181 workflow checks, zero failures**. The final focused suite was rerun after cleanup/feedback review: **PASS, 31/31 browser groups**. Existing Home/R1 browser checks and script integrity were also rerun successfully. Includes requested BW-36.9, BW-36.10, every workflow BW-36.13 regression, BW-36.14/R1, BW-36.15/R1, BW-36.21A/R1 and relevant Board/Canvas/Brand/access/snapshot suites.
- Syntax and `git diff --check`: pass.

Initial restricted sandbox runs could not launch Chromium or certain Git subprocess checks. Reruns use the environment's permitted network/subprocess execution; no test assertions were weakened. System Chromium is used locally; CI retains its existing Chromium installation step. Dependencies are installed with `--ignore-scripts --no-package-lock`; local scratch, logs and dependencies are not committed.

## Changed files

- `app.js`: guarded selection, lifecycle retirement, pending operation holds, stale response checks and acknowledged save baseline.
- `home-foundation.js`: keep confirmed selector value visible during async decisions/cancellation.
- `language.js`: English/German Workspace confirmation and blocking/error messages.
- `scripts/check-bw36-21a-r2-1-safe-workspace-switching.js`: local asynchronous browser regressions.
- `scripts/check-bw36-21a-home-foundation.js`: await authorized Workspace commit before existing assertions.
- `package.json`: focused regression command.
- `.github/workflows/runtime-boot-safety.yml`: run the new regression in the existing safety job.
- This implementation document.

## Remaining limitations

- Unsafe/uncancellable operations intentionally block the switch instead of moving their work to another Workspace. No timeout or browser abort can establish server-side cancellation. Existing failed responsibility operations require their existing save/retry resolution.
- Workspace switching requires online session/catalog verification. Offline users can cancel and retain their work; no cached membership is promoted into authority.
- Authorization is checked at the existing server read boundary; subsequent server membership changes remain subject to each destination/API's existing authorization checks. This repair does not introduce continuous membership subscription or change authorization rules.
- Canvas Save is intentionally outside the discard confirmation. A confirmed save can still leave later edits dirty; another deliberate save or explicit discard is required.
- New Workspace creation and independent Brand preference semantics remain separately scoped future work. No production/browser acceptance or rollout is claimed by local fixture tests.
