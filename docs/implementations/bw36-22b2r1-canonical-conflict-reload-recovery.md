# BW-36.22B2R1 — Canonical conflict reload recovery

Base: merged main `3569ce86a4173ccee7e866939820d50aa0353f1f`, including PR #798.

## Finding and root cause

The unresolved [P1 review on PR #798](https://github.com/Funklix/Funklix/pull/798#discussion_r4322634791) says **“Force conflict reloads to bypass the cached detail.”**

`canonical-brand-reader.js` owns one volatile canonical detail entry, keyed by account object, normalized identity, catalog object, catalog generation, Workspace, selected Brand, requested Brand and catalog revision. Ordinary reads reuse both pending and settled promises. Its existing `force` option only retires settled entries and temporarily exempts an accepted-save entry; it intentionally deduplicates pending Home refreshes.

`loadCanonicalBrandDetail()` previously used an ordinary read for initial opens, retries and the advanced editor's conflict button. After a PUT returned 409, the catalog revision could still describe the old revision, so another read reused the settled promise. The server's new data was never requested. Simply passing the existing reader `force` option would still reuse pending reads and the accepted-save exemption.

## Scoped correction

The Profile loader now accepts `{ force: true }`. The explicit conflict-reload and retry buttons use it, as does permission revalidation following a rejected member update. After the existing Workspace/Brand authorization gate, this path calls the shared reader's existing `retire()` before `read()`. Retirement aborts and removes its pending or settled entry, including an accepted-save entry. Every explicit Profile reload therefore starts a new canonical GET with the reader's existing `credentials: 'same-origin'`, `cache: 'no-store'`, timeout and response validator.

The shared reader architecture and its Home refresh semantics are unchanged. Ordinary Profile opens and setup-route opens still reuse the authorized Home request or settled response. Home retains its bounded scope, loading and deduplication behavior. Accepted Profile saves still publish their verified response through `reconcileConfirmedBrand()`, `reader.accept()` and the existing saved event; Home consumes that response without a redundant GET.

## Freshness, drafts and conflict decisions

- A new Profile request aborts its predecessor's Profile controller and advances `requestId`. Forced retirement separately invalidates the shared transport token; even a transport that ignores abort cannot return old headers or parsed JSON as current.
- Both success and failure application check the captured account, selected Brand, Workspace generation, active Workspace, catalog readiness, dialog lifecycle and Brand membership. The reader checks catalog identity before and after JSON. Identity checks prevent a late error from signing out a replacement account. A newer accepted canonical detail prevents an old rejected reload from overwriting that save's Profile state. A same-selection catalog refresh still exposes Retry when it invalidates a request; it does not leave the Profile stuck loading.
- Existing canonical ID, timestamps, access shape, minimum response revision and public-context restrictions remain in place. No authorization or PUT conflict condition changes.
- Reload retains the advanced editor's draft through overlapping requests and failed-load retries. Inputs and the draft's original expected revision remain unchanged. Reload never silently converts a stale write into permission to overwrite the server.
- Existing Save/Discard/Cancel decisions remain authoritative: a stale Save still conflicts; Cancel/Keep editing retains inputs; explicit Discard allows opening a new draft from the refreshed server baseline. The guided Profile's existing reload still refreshes untouched fields, retains local edits and requires a deliberate Save.
- The guided session's direct reload and verification GET paths were traced in `brand-profile-setup.js`; they do not use the settled shared promise. Their existing session lifecycle guards and rebase logic remain unchanged.

## Changed files

| File | Change |
| --- | --- |
| `app.js` | Explicit Profile freshness option, forced shared-entry retirement, draft retention and stale-success/failure guards; button and permission-revalidation call sites. |
| `scripts/check-bw36-22b2r1-canonical-conflict-reload.js` | Production-loader/reader regression matrix plus real Chromium advanced and guided Profile conflict flows using local intercepted transport. |
| `package.json` | Register `check:bw36.22b2r1`. |
| `.github/workflows/runtime-boot-safety.yml` | Run the new regression as part of Runtime Boot Safety. |
| This document | Root cause, semantics, scope and validation evidence. |

## Regression evidence

Reproduction against the merged-main loader:

```sh
git show origin/main:app.js > work/baseline-app.js
BW22B2R1_BASELINE=work/baseline-app.js node scripts/check-bw36-22b2r1-canonical-conflict-reload.js
```

The initial authorized read/deduplication group passes, then the conflict regression fails: **actual revision 1, expected revision 2** (`Conflict reload must GET newest canonical revision`). The same test with the corrected production loader passes.

`npm run check:bw36.22b2r1`: **9 groups PASS**:

1. Initial authorized GET and ordinary pending/settled Home/Profile deduplication.
2. Settled conflict cache bypass, newest server revision, repeated explicit reload, accepted-save cache bypass and retained expected revision.
3. Old in-flight headers/JSON after a newer forced reload, including ignored transport abort.
4. New accepted save superseding an old Profile reload.
5. Failed reload/retry and overlapping reload preserving the unsaved conflict draft.
6. Brand, Workspace, account object/identity, catalog object/generation and access changes during reload; stale success/error/401 ignored; actual current 401/403/404 handled.
7. Canonical identity/access/revision validation and denied-context request suppression.
8. Real canonical PUT 409, conflict-button fresh GET, newest revision, retained inputs, failed stale Save-and-continue, Cancel, Discard, deliberate reconciliation Save, Home Avatar refresh and repeated Home render without another canonical GET.
9. Guided Profile 409, reload/rebase, retained local input and deliberate successful Save.

Browser fixtures reject external hosts. The new flows permit only explicit canonical Brand PUTs, assert no Board/Canvas writes, and compare Canvas state before and after the conflict/reconciliation cycle. No image-generation or AI/provider request is made by the new regression.

Complete Runtime Boot Safety: **245/245 shell commands PASS across all 190 workflow check blocks, zero failures**. The complete check command list was read from `.github/workflows/runtime-boot-safety.yml` and executed sequentially, with each command's exit code retained locally in `work/runtime-r1/results.json` and individual logs in that directory. This includes:

| Coverage | Result |
| --- | --- |
| Canonical Brand detail/editing/foundation and access/revision boundaries | PASS |
| Profile setup, lifecycle, decisions/deletion, logo persistence and regression recovery | PASS |
| Workspace read/identity/lifecycle/navigation/continuity and Brand/Board consistency | PASS |
| Safe Workspace switching | PASS, 96 browser groups |
| Home foundation, Intelligence, insights/Brain, compact Home and Living Workspace/B1R1 | PASS; Home insights/Brain 30 groups |
| BW-36.22B2 shared canonical reader, real Avatar and personality | PASS, 8 groups |
| BW-36.22B2R1 conflict reload recovery | PASS, 9 groups |
| Remaining Runtime Boot Safety syntax, browser globals, campaign, learning, localization, publishing and other regressions | PASS |

Final application/script syntax, canonical detail/editing, browser-script integrity and `git diff --check` also pass. The main-loader baseline reproduction intentionally fails at revision 1 versus revision 2; it is separate from the passing complete workflow run. Declared dependencies were installed with `npm install --ignore-scripts --no-package-lock` using a workspace-local npm cache. Chromium is preinstalled at `/usr/bin/chromium`; local checks use that browser. All database tests use the repository's disposable/mocked fixtures; no production SQL is executed.
