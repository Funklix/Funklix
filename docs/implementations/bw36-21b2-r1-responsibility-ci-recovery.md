# BW-36.21B2-R1 — Responsibility workspace continuity CI recovery

Existing PR: [#791](https://github.com/Funklix/Funklix/pull/791). Recovery stays on `codex/bw36-21b2-home-insights-brain`; no new PR or merge. Inspected PR head: `6d4e8383c2ee346d604b2c361649121ca91e3541`. Latest merged main: `e5b4dadf0b9ae517591d574a1c4161154d78e875`, confirmed by fetch. This is a CI recovery, not a new feature implementation.

## Failure and exact assertion

Retrieved the **complete decoded log** for Runtime Boot Safety [run 39168658860](https://github.com/Funklix/Funklix/actions/runs/39168658860), run number 584, [job 117796910836](https://github.com/Funklix/Funklix/actions/runs/39168658860/job/117796910836). The production-server section passed; `browserChecks` failed about 14.48 seconds later at original line 260:

```js
assert.equal(await dialog.getByRole('button', { name: 'Add team member', exact: true }).count(), 0);
```

**Actual 1** is one visible invitation button in the responsibility manager. **Expected 0** means none may be offered in the simulated editor, viewer or public-viewer contexts, all of which have `canManagePermissions:false`. This is a permission boundary assertion, not an incidental layout counter. It remains unchanged.

The full downloaded log is retained at `work/b2-r1/github-failure-job.log` (SHA-256 `2758646c5d1f3a77ed1ac1ca4ca286846e37afa1410951c467a382be494f5d69`). GitHub retains the original job log; local diagnostic/repeat/full-run logs remain under `work/b2-r1/`.

## Proven root cause

The fixture booted a signed-in **Board owner** and kept returning that owner's real serialized access from its mocked Board GET. Much later, the role loop changed only browser state with `applyBoardAccessFromServer({role,canView:true,canEdit:role==='editor',canManagePermissions:false})`.

Board loading starts the normal 12-second `startBoardRefreshPolling` interval. A refresh calls `pollBoardForRemoteChanges`, whose unchanged-timestamp branch still applies the returned access through `applyBoardAccessFromServer(data.access, 'pollBoardForRemoteChanges')`. Thus the fixture's owner response could replace the locally simulated editor/viewer capabilities between role setup and manager rendering. The manager correctly used `canManageBoardEditors()` and rendered the owner's invitation control. The test had two contradictory permission sources; its outcome depended on where the timer landed in the viewport/theme/keyboard sequence.

A controlled diagnostic run executed the real refresh function immediately after the original editor projection, without changing application code, response data or assertions. Both original PR and unchanged main produced:

```text
before refresh: reason=editor, canEdit=true, canManagePermissions=false
 after refresh: reason=owner,  canEdit=true, canManagePermissions=true
assertion: simulated role=editor, invitationCount=1
AssertionError: 1 !== 0
```

The diagnostic wrapper stopped the automatic interval only for this isolated experiment so one explicit call to the same production refresh function established the ordering without a sleep. The shipped correction does **not** stop the interval. Original uninstrumented standalone runs passed on both branches; those passes alone were not treated as evidence of safety. The forced ordering reproduces the CI assertion deterministically on both baselines and establishes the existing fixture race independently of incidental runner speed or browser version.

## Baseline comparison and interaction tracing

`git diff origin/main...6d4e838 -- scripts/check-bw36-15r1-responsibility-workspace-continuity.js campaign-responsibilities.js` is empty. Source-body comparisons additionally confirmed these ten functions are identical: `updateBoardAccessState`, `boardAccessFromServer`, `applyBoardAccessFromServer`, `loadResponsibilityPeople`, `openCampaignResponsibilities`, `startBoardRefreshPolling`, `pollBoardForRemoteChanges`, `loadBoardFromUrlIfPresent`, `selectSessionWorkspace` and `retireBoardForWorkspaceSwitch`.

The failing role checks run in **Board view**, before the test first opens Home. In that view the B2 `homeCampaignInsights` projection returns immediately and the Home presentation observer does not render Home. Neither Insights nor AI Brain navigation runs in the failing sequence. The responsibility manager and Board's server-authorized lifecycle remain the existing instances. B2 therefore did not introduce a new permission source or modify the competing refresh path.

The baseline worktree was detached at the main SHA, used the same dependencies, Node `v24.19.0`, system Chromium `151.0.7922.173`, fixture data and transport interception as the PR run, and had no tracked modifications. The corrected test was also compiled against that unchanged main application and passed. CI used a different installed browser build; the contradictory fixture state and controlled failure exist with identical local browser conditions on both branches.

## Smallest scoped correction

Only `scripts/check-bw36-15r1-responsibility-workspace-continuity.js` changes executable code:

1. Introduce a phase-local `simulatedAccess` projection. It is null throughout the real owner save/conflict/reflow checks, so their signed routes, PostgreSQL Date handling and serialized response contracts remain untouched.
2. During the existing role loop, mocked Board GET responses return the same access projection being tested in the browser. This models one consistent server/client role instead of an editor/viewer client connected to an owner-valued mock server.
3. Wait for any already-started refresh to finish **before** applying the next role. An earlier response can legitimately contain the previous projection; the condition wait drains it without an arbitrary delay.
4. Explicitly invoke the existing refresh path after role setup and wait for its in-flight state to settle. Assert that the resulting role/read/edit/manage capabilities exactly match the intended projection, and confirm that real Board reads occurred for editor and viewer. Public-viewer execution retains the existing refresh guard.
5. Run the unchanged zero-invitation assertion and unchanged editor-versus-viewer node-control assertions, then all existing toolbar, focus, Canvas topology, immutable content, revision, conflict, rollback, Brand isolation and no-unrelated-request checks.

The role loop was already a UI capability projection test, rather than a new signed-user login for each role. Its mock server now agrees with that intended projection. The separate production-server authorization tests still run actual access helpers and unchanged owner/editor/viewer denials. No production authorization behavior is patched to accommodate a synthetic role. No assertion is removed, no expected value is weakened, no test is disabled, and no sleep or global clock manipulation is introduced.

## Reproduction and validation evidence

| Scenario | PR application | Unchanged main application |
| --- | --- | --- |
| Original test, standalone, identical local conditions | PASS | PASS |
| Original assertion with explicit real refresh immediately after local editor projection | FAIL, owner permission restored, invitation count 1 | FAIL, same permission transition and count |
| Corrected fixture with explicit refresh and unchanged invitation assertion | PASS | PASS |

For the controlled negative reproduction, execute the original test through a diagnostic module wrapper, retaining its original filename/module paths and substituting an async role callback that calls `await pollBoardForRemoteChanges()` after `synchronizeResponsibilityToolbar()` and before opening the manager. Log `state.boardAccess` immediately before/after that call and retain the original invitation assertion. No application file or fixture response is changed. This reproduces the exact forbidden owner overwrite without an arbitrary sleep. The corrected committed test now permanently exercises that same refresh boundary with a consistent permission fixture.

Run the recovered check with `CHROMIUM_PATH=/usr/bin/chromium npm run check:bw36.15r1`, or omit the override to use the existing system/Playwright browser fallback. All transport is intercepted to localhost; production/provider/AI/storage destinations are rejected. Existing intended responsibility writes go only to disposable fixture state, and their exact request shape/response invariants remain asserted. There are no production writes, production SQL or paid AI calls.

The independent corrected check passed, followed by **5/5 consecutive standalone passes** (19.75s, 22.16s, 33.09s, 27.90s and 33.00s). Every run includes the real server portion and the full original Chromium sequence, with the explicit refresh boundary and unchanged zero-invitation expectation. These are measured execution times; no timing delay was added. The complete Runtime Boot Safety workflow remains unchanged and includes the recovered check, B2, B1, Workspace switching, Board/Canvas lifecycle, autosave, diagnostics and Learning suites. Its machine-readable local command/status evidence is retained in `work/b2-r1/runtime/validation.json`; the corresponding progress log is `work/b2-r1/runtime-progress.log`. The observed full local result is reported with the final GitHub result in the delivery message. GitHub CI and Codex review status for the pushed recovery commit are verified on the existing PR and reported in the delivery message; an older-commit review is not represented as a review of this correction.

## Changed files

- `scripts/check-bw36-15r1-responsibility-workspace-continuity.js`: consistent role-phase Board GET permissions, condition-based refresh synchronization and explicit refresh/capability regression checks.
- This implementation report.

All production application, Home/B1/B2 modules, Insights, AI Brain, Board loading, responsibility manager, Workspace lifecycle, server APIs, authorization, Canvas persistence/autosave and provider files remain unchanged by R1.
