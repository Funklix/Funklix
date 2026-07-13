# Runtime Boot and Change-Scope Stabilization Audit — 2026-07-13

## Executive Summary

The current checkout was treated as the baseline because remote branch access is not required for this stabilization. The checkout is syntactically boot-safe: `app.js`, `campaign-v3.js`, `knowledge-module-registry.js`, `knowledge-module-identity.js`, and `knowledge-module-runtime-adapter.js` all pass `node --check` before this change. This PR adds dependency-free local and CI checks to prevent the duplicate top-level `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` declaration regression, verify browser script load order, smoke-test browser/CommonJS compatibility, and make accidental broad PR scope visible.

## Confirmed Browser Error

The reported production failure was:

```text
Uncaught SyntaxError: Identifier 'BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS' has already been declared
at app.js:4848
```

That browser syntax error would stop `app.js` before normal application boot.

## User-Visible Impact

When `app.js` cannot execute, auth initialization, Google Sign-In handlers, active Board context loading, active Brand context loading, Canvas rendering, event binding, and overall application boot can all fail together.

## Current Working Checkout

- Branch: `work`
- Baseline HEAD before this stabilization: `d94b2cc53681aac397a59a140b2ae01a30087979`
- Initial `git status --short`: only pre-existing untracked `node_modules/` was present.
- Initial `git diff --stat`: empty.

## Current Declaration Count

Current `app.js` contains exactly one top-level lexical declaration of `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS`, at line 4610 in the baseline checkout. The only other runtime occurrence is a reference in `getMissingKnowledgeModuleDefinitions()`. A documentation mention also exists in `docs/audits/2026-07-12-knowledge-module-runtime-adoption-pr1.md`.

## Available Commit / Revert Findings

Local history contains both failed/reverted sequences:

- `71dad54 feat: persist module types for canonical knowledge tiles` introduced a large Phase 5-style runtime change set, including extensive `app.js`, API, stylesheet, index, and Knowledge Module files.
- `259757b Merge pull request #510 ...` merged that branch.
- `79218ae Revert "Boards & Brand Workspace: UI migration, drag-reorder, Knowledge Module foundation, API PATCH fixes"` reverted the first failed deployment.
- `671cc1c docs: correct knowledge module phase 5 regression audit` was named as documentation correction but its local diff still contained the same broad runtime/API/UI/Knowledge Module changes.
- `f3d663d Merge pull request #512 ...` merged that contaminated branch.
- `61b968a Revert "Boards & Brand Workspace: list API display snapshot, boards UI/drag reorder, Brand Workspace features, knowledge module scaffolding"` reverted the later contaminated deployment.
- `d94b2cc Merge pull request #513 ...` is the current reverted baseline.

The second top-level declaration was present in the broad runtime changes carried by the Phase 5 implementation history and was reintroduced when the later documentation-labeled branch still contained old runtime files.

## Historical Information That Was Not Available Locally

No GitHub API, deployment logs, Vercel source commit metadata, or remote `origin/main` comparison was required or used. Exact production deployment commit metadata must be verified in GitHub/Vercel outside this local checkout.

## Contaminated Branch / PR Explanation

The local graph shows merge commits from reused Codex branches that carried prior runtime changes forward. A PR title or final commit message that sounds documentation-only is not sufficient evidence of PR scope; the complete file list and diff must be reviewed.

## Why a Documentation Task Reintroduced Runtime Code

The documentation correction commit `671cc1c` locally includes runtime files such as `app.js`, `api/boards/*`, `index.html`, `styles.css`, and Knowledge Module scripts. This is consistent with a reused or contaminated task branch where old unmerged/reverted runtime changes remained in the branch history and became part of a later PR.

## Why Previous Checks Were Insufficient

A documentation-only mental model did not inspect the full PR diff. There was no repository check that parsed `index.html` script order, syntax-checked all referenced classic browser scripts, counted top-level declarations of the known fatal identifier, or smoke-tested the Knowledge Module scripts in browser-like and CommonJS-like environments.

## Current Script Load Order

`index.html` currently loads local classic scripts in this order:

1. `/campaign-v3.js`
2. `/knowledge-module-registry.js`
3. `/knowledge-module-identity.js`
4. `/knowledge-module-runtime-adapter.js`
5. `/app.js`

Every referenced local script exists. The Knowledge Module registry loads before identity, identity before runtime adapter, and the adapter before `app.js`.

## Browser/CommonJS Findings

Before this stabilization, `knowledge-module-runtime-adapter.js` could call `require(...)` whenever a global `require` function existed, even if `module.exports` did not exist. That is unsafe in browser-extension-like environments where extensions may expose a global `require`. The adapter now only performs CommonJS `require(...)` when a real CommonJS module export object is present and `require` is a function. Browser globals remain the source of registry and identity APIs in normal browser execution.

## Integrity Checks Added

Added `scripts/check-browser-script-integrity.js`, a dependency-free Node script that:

- reads `index.html`;
- extracts local classic JavaScript scripts in document order;
- ignores external HTTP/HTTPS scripts and module scripts;
- verifies referenced local scripts exist;
- syntax-checks referenced local scripts with Node `vm.Script`;
- enforces Knowledge Module load order when the relevant scripts are present;
- detects more than one top-level lexical declaration of `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` in `app.js` while ignoring comments and string/template contents.

Parser limitation: the declaration detector is a lightweight scanner, not a full ECMAScript parser. It is intentionally scoped to the known top-level duplicate declaration regression.

Added `scripts/check-knowledge-module-browser-globals.js`, a dependency-free VM smoke test that executes the Knowledge Module scripts in normal browser-like, browser-extension-like, and CommonJS-like environments.

## CI Changes

Added `.github/workflows/runtime-boot-safety.yml`. It runs on pull requests and pushes to `main`, checks syntax for the runtime scripts, runs browser script integrity checks, and runs browser-global/CommonJS compatibility checks. It does not run `npm install` and adds no dependencies.

## Local Change-Scope Reporting

Added `scripts/report-change-scope.js`, a local-only scope report that prints current HEAD, branch, working-tree changed files, staged files, recent commits, and local diff stat. With `--docs-only`, it exits non-zero when tracked local changes outside `docs/` are present.

## Runtime Source Changes, if any

The only runtime source change is a minimal CommonJS guard correction in `knowledge-module-runtime-adapter.js`. No `app.js` feature logic, Brand Workspace UI, Boards UI, Canvas behavior, auth behavior, save/load behavior, APIs, or Phase 5 moduleType behavior was changed.

## Runtime Unchanged Confirmation

No Phase 5 behavior was implemented. No Founder Story behavior was added. No Knowledge Module product behavior was added. `app.js` was not edited.

## Risks

- Local Git history can explain available commits, but it cannot prove deployed production source commits without Vercel/GitHub verification.
- The declaration scanner is purpose-built and lightweight; it should not be treated as a general JavaScript parser.
- Manual Preview and Production QA are still required because these checks do not simulate full DOM boot or authentication flows.

## Rollback

Rollback is safe by reverting this stabilization commit. The added scripts, workflow, and documentation are isolated. The adapter guard can be reverted independently if necessary, but doing so would restore the browser-extension-like `require` risk.

## Manual QA

After Preview deployment:

1. Confirm the Vercel Preview source commit matches the PR HEAD.
2. Open Preview in an incognito browser window.
3. Open DevTools before reloading.
4. Confirm there are no red errors from `app.js`, `knowledge-module-registry.js`, `knowledge-module-identity.js`, `knowledge-module-runtime-adapter.js`, or `campaign-v3.js`.
5. Ignore unrelated extension errors unless they reference Funklix files.
6. Confirm Google Sign-In responds.
7. Confirm session/auth state loads.
8. Confirm signed-in user details load.
9. Confirm active Board context loads.
10. Confirm active Brand context loads.
11. Confirm Canvas nodes render.
12. Confirm Home opens.
13. Confirm Boards opens.
14. Confirm Brand Workspace opens.
15. Confirm AI Brain and Insights open.
16. Confirm no duplicate declaration error.
17. Confirm both safety scripts pass locally and in CI.
18. After merge, confirm the Production source commit matches the GitHub merge commit.
19. Confirm Production again in incognito.

## Requirements Before Retrying Phase 5

Do not retry Phase 5 until this stabilization PR is merged, boot-safety CI is green, Preview boots correctly, Production boots correctly, the future Codex task starts from current main, the full future PR file list is reviewed, the future Phase 5 PR contains no unrelated historical changes, and the final tested commit matches the deployed commit.
