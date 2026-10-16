# BW-36.21A-R2.1R1 — Pending AI mutation protection

Date: 2026-10-16 (Europe/Berlin).
Base: latest merged `main`, `ab70fc36aae9c0b3c7d543cb8e58adb8a32fca00`, including PR #784. The fetched base tree was also verified against `c8ab0147fb7b33ed2067017e44c9cf73d7a432e7`.

## Finding and audit

Read the [R2 navigation audit](../audits/bw36-21a-r2-workspace-and-brand-navigation-audit.md), [R2.1 implementation report](bw36-21a-r2-1-safe-workspace-switching.md), and [unresolved P1 on #784](https://github.com/Funklix/Funklix/pull/784#discussion_r4295927570). The P1 correctly identifies social-card regeneration and landing-header image generation as asynchronous node writers missing from `workspaceExitOperations`. Their responses could mutate a captured outgoing node, render by its ID into an incoming Board, fill the Inspector and save the current Canvas.

The asynchronous Canvas audit covered request producers, their callers, post-response mutations and error/finally paths in `app.js`, plus the AI Brain, learning and content-workspace boundaries.

| Path | Finding / protection |
| --- | --- |
| Social-card Regenerate Caption, CTA, Hashtags | Confirmed untracked. Now hold Workspace exit and reject stale success/error/finally UI effects before updating the captured node, card, Inspector or Canvas persistence. |
| Landing-header image generation | Confirmed untracked. Same hold and identity check after the fully decoded response. A stale failure cannot change the incoming save status or generation button. |
| `createSuggestedNodeFromAnalysis` | Additional untracked path. Creates a node before awaiting Content refinement, three social refinements, or five landing refinements; formerly continued with fallback, edges, selection, Inspector, Canvas render and save after retirement. Now holds the complete operation and checks identity after every refinement; stale failures skip fallback and subsequent stages. Existing valid-context fallback remains. |
| `refreshFacebookWorkspaceSnapshot` | Additional asynchronous reconciliation risk: the existing freshness check followed node reconciliation. Now checks refresh generation, Board generation/ID and account after settings refresh and before every reconciliation; also requires the original node object. Its existing render freshness check remains. This read can safely settle after exit; no write is cancelled. |
| Inline refinement, platform regeneration, full content pack, next-step generation, AI review, content image and posting visual generation | Already held by R2.1 across their actual awaited mutation bodies, including multistage work and cleanup. Retained. Added delayed-response coverage for these existing boundaries, alongside existing preview/refinement tests. |
| AI review-fix preview / Improve dialog | Existing operation holds span the real response and final Inspector/preview effects. R2.1 removes inactive dialogs on retirement. Retained. |
| Campaign creation / progressive generation | Existing campaign controller and operation holds; protected Campaign V3 implementation unchanged. |
| AI Brain proposals/advice, Learning Advisor/proposals | Existing request, Board/account or context freshness owners. Retirement invalidates outgoing owners; these workflows remain unchanged. |
| Approval, posting schedules, publication and engagement | Existing schedule queues, approval saving/verifying states, publication operation hold and publishing/engagement lifecycle identities. Facebook refresh above was the additional gap. |
| Brand/strategy/document/Founder Story/domain/logo/avatar/DNA operations and Board load/save/association/responsibilities | Existing R2.1 holds, busy flags and/or captured request generations. No new owners or behavior changes. |
| Clipboard operations and synchronous image attachment | Clipboard completion only updates its captured button; no Canvas persistence. Local image attachment has no awaited server completion. No new hold required. |

## Targeted correction

`beginPendingNodeMutation` adds one unique token to the existing operation set and captures the account object/email, Board ID/load generation and exact node object. `current()` also checks editability. Node ID equality alone cannot authorize completion after hydration or replacement. An unrelated catalog refresh does not retire an otherwise valid Board operation. `finish()` removes only that operation's token, even after failure or retirement.

The three newly covered AI callers own this token through their original asynchronous bodies. Normal Workspace switching reports the existing pending-operation feedback and requires retry after settlement; it does not cancel or discard server work. Other lifecycle retirement, account replacement, Board reload or node replacement causes the caller to ignore its completion. Social/header failures now use existing save-status feedback and release their hold instead of escaping as unhandled event-handler rejections. Board retirement restores the header button label itself, so a stale completion need not touch shared controls; a newer header request retains its own loading state and output.

No AI request body, prompt, model, provider, successful output transformation, endpoint, Canvas serializer or dirty/autosave policy changes. Workspace creation, independent Brand selection, UI design, database/schema and server authorization remain outside scope. R2.1's dirty confirmation, Save/Discard/Cancel, access revalidation, polling retirement and update-only autosave remain authoritative.

## Regression evidence

- `npm run check:bw36.21ar2.1`: **PASS, 80 browser groups** (the original 31 R2.1 groups plus 49 new groups). No existing assertion removed. The final catalog/account/Board identity and Facebook subset also passed all seven groups; the newer-header ownership case passed independently.
- Complete local Runtime Boot Safety: **181/181 workflow validation steps pass**, including Canvas, access, dirty/autosave, campaign, Brand, Learning and runtime regressions. Extracted every validation `run` block from `.github/workflows/runtime-boot-safety.yml`; dependency/Chromium setup was performed separately. Used system Chromium, disposable PostgreSQL/PGlite and mocked providers.
- Four first-pass checks were rerun: the Facebook source check passed after retaining its existing generation-expression contract inside the stronger guard; BW-36.16/R1 poll-count assertions and BW-36.18 transient cursor-presence snapshot passed unchanged in isolation after concurrent browser load ended. No assertion, polling behavior or production logic was weakened to accommodate these timing failures.
- Final `node --check app.js`, `node --check scripts/check-bw36-21a-r2-1-safe-workspace-switching.js`, and `git diff --check`: **PASS**. The workflow already runs the extended suite through its existing R2.1 check; no workflow or dependency changes required. PR checks provide the remote CI result.

The deferred-response browser tests use real application event handlers and intercepted local transport. They exercise all three social actions, landing-header generation, Content/social/landing analysis suggestions, every later landing suggestion stage, failures, valid-context output/fallback, blocked pending exit and cancelled/discarded decisions. They also force the retirement boundary and open another Board through the real loader with overlapping node IDs, observe mutation/render/persistence functions after incoming hydration settles, and assert no stale calls, content change, follow-up AI request or autosave. Additional identity cases replace the account, Board generation or node object. Existing R2.1 and Canvas tests remain intact.

No paid AI calls, production SQL, production data writes or merge are performed.

## Remaining risks

Operation holds deliberately require a retry after a pending generation settles. A request that never settles continues to hold Workspace exit, consistent with R2.1; this patch introduces no timeout/cancellation contract and makes no claim that aborting a browser request stops server work. Captured identity discards obsolete client output, but cannot undo generation already performed on the server. The previously tracked operations continue using their existing R2.1 Workspace-exit holds and independent lifecycle owners; this patch does not redesign general route/logout concurrency. New asynchronous Canvas producers must join the existing hold or enforce equivalent completion identity before mutation, including error and finally paths.
