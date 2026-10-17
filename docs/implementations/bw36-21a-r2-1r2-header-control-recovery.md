# BW-36.21A-R2.1R2 — Landing header control recovery

Date: 2026-10-17 (Europe/Berlin).
Base: latest merged `main`, `03fb873f0620480475a8610abd52960023e3d1cf`, including PR #785.

## Confirmed review scenario

The [unresolved P2 Codex finding on #785](https://github.com/Funklix/Funklix/pull/785#discussion_r4296336463) describes a real shared-control lifecycle gap. Header generation captures the original node. Deleting it calls `fillInspector(null)` and disables the shared button, but the old `finally` requires `mutation.current()` to restore the label. Deletion invalidates that predicate, leaving `Generating...` on the button. Selecting another Landing Page re-enables the same control with the stale label.

## Scoped correction

A single header-control owner stores the operation's existing validity predicate. Inspector action refresh releases an invalid owner and restores the current localized idle label immediately, then derives enabled state from selection, editability and any live header operation. A live operation stays disabled across Inspector refreshes. Generation success, failure feedback and final cleanup require control ownership as well as the existing mutation guards; an older response cannot reset either a pending or completed newer request. The click handler also rejects duplicate starts while a valid owner exists.

The original `beginPendingNodeMutation` token remains held until the actual request settles, even after node deletion. Its account object/email, Board ID/load generation, exact node identity and editability guards still protect every successful Canvas mutation and failure feedback. Normal Workspace switching remains blocked until pending work settles. Retirement still clears the Inspector and header label through its existing path.

No AI prompts, request payloads, generated content, Canvas serialization/persistence, autosave policy, server endpoints, SQL or unrelated UI changed. No paid AI requests, production SQL, deployment or merge operations were performed.

## Validation

The existing Workspace lifecycle browser suite is expanded with sixteen deferred-response groups. They cover normal header success/failure, Inspector refresh during generation, deletion with no selection, selecting a new Landing Page, and a new request settling before or after the deleted node's old success/failure. Assertions check immediate/final label and disabled state, operation-token settlement, unchanged deleted-node data, no stale render/Inspector/save-status/persistence calls, no stale Canvas content or autosave timer, and no later writes after the autosave window. Two additional groups revoke and restore editability before starting a newer request on the same node; the old success/failure must remain retired even if its original identity predicate becomes true again. Four locale cases switch through the real UI language handler while a request is pending, then exercise normal success/failure or deletion and reselection, asserting the German idle label and enabled state. Existing tests retain Workspace-switch blocking, forced retirement with overlapping node IDs, late success/failure, newer-request ownership, account replacement, Board generation and node replacement coverage. All transport is intercepted locally.

- `npm run check:bw36.21ar2.1`: **PASS, 96/96 browser groups** on the final implementation, including all existing lifecycle and pending-mutation regressions plus sixteen new header-control groups.
- Regression reproduction against the unmodified PR #785 `app.js`: **expected failure**, reporting actual `Generating...` versus expected `Generate Header Visual` immediately after deletion.
- An initial new-test render observation included `createNode`'s independent 30ms visibility repair. The fixture now waits for its existing 30ms/280ms creation callbacks before observing deferred-response effects; no mutation, autosave or ownership assertion was weakened. Both response orders and both outcomes pass in the final full run.
- Final `node --check` for application and lifecycle test, browser-script integrity (44 classic scripts), and `git diff --check`: **PASS**.
- Complete local Runtime Boot Safety: **PASS, 181/181 validation run blocks**, including the final 96-group lifecycle run. Executed every validation block from `.github/workflows/runtime-boot-safety.yml`; dependency installation and system Chromium setup were handled separately. Includes existing Canvas/root lifecycle, access, dirty/autosave, Workspace, Brand, Campaign V3, responsibilities, adaptive density, learning, localization and browser-global regressions. Database checks used disposable PostgreSQL/PGlite and providers were mocked. No workflow, dependency or existing assertion changes were required. GitHub CI and automated review status are reported on the PR.

## Codex feedback on this PR

The [P2 locale finding on #786](https://github.com/Funklix/Funklix/pull/786#discussion_r4300301360) correctly identified that request-time label capture could restore the previous interface language after invalidation. Both invalidation and completion now call `uiText("Generate Header Visual")` at cleanup time. The owner no longer stores a label; the validity predicate and ownership checks remain unchanged. Four additional deferred-response browser cases cover the real language-switch event and both generation outcomes. The new deletion/reselection test reproduces the previous commit’s incorrect English label versus expected `Header-Bild erstellen`. The focused four-case locale run, complete final 96-group lifecycle run, existing `check:bw25.2` localization regression, script integrity and syntax/diff checks all pass.

## Remaining limitation

Invalidating the control does not cancel server generation. A request that never settles retains the existing Workspace-exit hold. This patch adds no cancellation or timeout contract.
