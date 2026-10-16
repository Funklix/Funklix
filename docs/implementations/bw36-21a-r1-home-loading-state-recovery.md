# BW-36.21A-R1 — Home loading state recovery

## Baseline and root cause

Based on latest merged `main`, `d7146f8e415c1c6d149be36ac53a3c4a1b8d84b1`, including PR #781. Read the [BW-36.21 audit](../audits/bw36-21-start-screen-intelligence-and-insights-audit.md), [Phase A implementation](bw36-21a-home-foundation.md), and the [unresolved P2 review finding](https://github.com/Funklix/Funklix/pull/781#discussion_r4292494270).

Home renders Board actions and its loading explanation from `isBoardLoading || initialServerLoadInFlight`. Navigation to Home during a Board request therefore correctly disables Board actions. Previously the loader explicitly refreshed Home only on success, before its final cleanup cleared `initialServerLoadInFlight`. Failure and invalid-payload returns skipped that direct refresh. The lifecycle therefore depended on other presentation hooks to reflect completion; the success-only refresh itself still observed the in-flight flag.

**Reproduction qualification:** tracing and running the new browser matrix against unchanged main exposed an existing indirect synchronization path: final `renderBoardBrandAssociation()` calls `renderWorkspaceSidebar()`, which calls `homeFoundationController.sync()`. Unchanged main passes these integrated scenarios through that path. The review finding correctly identifies the missing direct completion notification, but this work does not claim a standalone reproduction of stuck Home under the current full shell. The targeted correction makes synchronization an explicit responsibility of the loading lifecycle, independent of incidental sidebar rendering.

## Minimal correction

Move the existing success-only `refreshDashboardIfVisible()` into the loader's existing generation-guarded `finally`, after all load/hydration flags are cleared and existing toolbar/association synchronization completes. It reads current context through the existing controller; it does not render a captured Board response. A stale generation cannot clear the newer load or synchronize Home from its completion.

Root boot independently clears `isBoardLoading` after selecting Home. Synchronize Home inside that existing no-in-flight guard too, so the initial Home render cannot retain boot's loading state.

No changes to Home models, authorization, request generation, identity checks, response validation, Canvas application, storage, autosave, error handling, polling, navigation or hydration semantics.

## Loading-state completion inventory

| Location/path | Existing completion behavior | Home synchronization |
| --- | --- | --- |
| `loadBoardFromUrlIfPresent`: successful hydration | `applyCampaignState` clears `isBoardLoading`; `initialServerLoadInFlight` remains true until final cleanup | Final cleanup now refreshes after both flags are false. |
| HTTP/network rejection, JSON parse failure, transport timeout/termination | Catch preserves existing error/Canvas cleanup, then finally clears all loading flags | Same guarded final refresh. No new timeout policy or cancellation mechanism. |
| Invalid response ID or Brand association | Early false return, then finally | Same guarded final refresh. |
| Invalid `canvas_json` | Existing status message and false return, then finally | Same guarded final refresh. |
| Obsolete generation | Existing stale response return/catch; finally fails generation guard | Cannot clear a newer request's flags or refresh from stale completion. |
| Changed account or route with current generation | Existing identity/route checks reject hydration; finally releases its loading flags | Controller reads current identity/catalog/view; no old response is supplied to Home. |
| Profile leave refusal / no Board ID | Return before loading starts | No loading flag changed; no additional completion hook needed. |
| `bootApp` | Clears boot loading only when no server load remains in flight | Refresh within the existing guard after clearing. |
| `applyCampaignState` outside URL hydration | Clears the existing loading flag as part of applying Canvas state | Existing callers retain their rendering/navigation lifecycle; no new hook inside Canvas application. URL hydration remains busy through `initialServerLoadInFlight`. |

These are all assignments clearing `state.isBoardLoading` in `app.js`; no new state variable, background request, save or completion mechanism is introduced. Requests that remain pending remain disabled. A timed-out or aborted request recovers when the existing fetch rejects.

## Regression evidence

The existing `npm run check:bw36.21a` suite now exercises the production browser loader and Home controller through deferred mocked network responses. It asserts disabled actions and accurate loading text while pending, then enabled actions and removed loading text immediately after awaiting completion, without an unrelated manual refresh.

Added cases cover HTTP 503, invalid association, mismatched Board ID, invalid Canvas, malformed JSON, transport timeout and abort, successful load, retry after each outcome, root boot recovery, Home navigation during loading, failure after Home becomes visible, rapid Board switching, stale successes and failures while a newer load is pending, and older responses arriving after the newer load completes. The final current Board/Canvas snapshot must remain unchanged by stale completion. Existing dirty Canvas, direct route/reload/Back, access/privacy, metadata, layout and localization assertions remain intact. Global transport assertions require zero inference requests and zero Board/Brand/Canvas mutation requests.

The expanded focused suite passes against the final implementation. The same browser matrix also passes against unchanged main through the indirect sidebar synchronization described above; it is preservation evidence, not proof that these scenarios reproduced the review finding.

| Validation | Result |
| --- | --- |
| Final focused `npm run check:bw36.21a` | PASS, including immediate action/text assertions, timeout and abort recovery, retries and stale completion. |
| Board lifecycle regressions | PASS: `check-bw5-board-brand-isolation-regression.js`, `check-bw5-board-brand-resolution-state.js`, `check-bw18-board-access-roles.js`, `check-bw19-private-public-board-sharing.js`. |
| Complete Runtime Boot Safety | **180/180 executable check blocks PASS**, including root/Canvas, authorization, autosave, Campaign V3, responsibilities, adaptive density, Learning provenance, mocked Advisor/Advice, Home, localization and browser globals. |
| JavaScript syntax / whitespace | PASS: `node --check app.js`, `node --check scripts/check-bw36-21a-home-foundation.js`, `git diff --check`. |

Ran every executable validation block from `.github/workflows/runtime-boot-safety.yml` with per-block exit-code capture; no block failed. Dependency setup used `npm install --ignore-scripts --no-package-lock` with a workspace cache. Browser setup was already satisfied by installed `/usr/bin/chromium`; no replacement browser download was required. The final strengthened Home suite was also rerun independently after settling optional metadata and adding transport-abort coverage.

## Delivery constraints

No production SQL, production database access, paid AI requests, deployment commands or merge operations. Database regression suites use disposable fixtures; browser and provider transport use mocks. Existing Runtime Boot Safety already runs the expanded Home suite, so no workflow or package changes are needed.
