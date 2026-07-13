# Corrected Knowledge Module Phase 5 Runtime Regression Audit — Duplicate `app.js` Declaration

## Summary

This audit supersedes the previous adapter-focused root-cause conclusion. The actual browser console evidence from the failed deployed Phase 5 PR reported:

```text
Uncaught SyntaxError: Identifier 'BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS' has already been declared
at app.js:4848
```

That `app.js` syntax error is the evidenced primary root cause of the observed boot failure. Because a duplicate lexical declaration is a parse-time failure, the browser never executed `app.js`; auth, board loading, Brand context, Canvas boot, and event binding therefore appeared broken even though those systems were not themselves the failing code.

The previously documented CommonJS/browser adapter concern remains a secondary unproven boot-safety risk. It should not be treated as the cause of the failed deployed PR unless a separate console trace shows an adapter exception.

## Corrected Root Cause

The failed deployed `app.js` contained two top-level lexical declarations for the same identifier:

```js
const BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS = Object.freeze([...]);
```

Duplicate `const` declarations in the same script/global lexical scope are a fatal SyntaxError. The browser rejects the whole script before any top-level statements, event bindings, or `bootApp()` registration can run.

## Duplicate Declaration Locations

### First declaration

The first declaration was the existing Missing Knowledge allowlist introduced by the Brand Workspace / Knowledge Module foundation work. In the reverted/current source shape, the surviving declaration appears near the Missing Knowledge helper block:

```js
const BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS = Object.freeze([
  "founder_story",
  "market_research",
  "business_plan",
  "pitch_deck",
  "whitepaper"
]);
```

This declaration was intended to support registry-backed Missing Knowledge helpers and contextual Brand Workspace prompts.

### Second declaration

The browser-reported second declaration was at `app.js:4848` in the failed deployed artifact. The current reverted repository no longer contains the duplicate second declaration, but the console error proves the deployed script did.

The most likely mechanism is that Phase 5 added or preserved a second copy of the same five-module allowlist while introducing optional `moduleType` metadata and duplicate-prevention helpers. That duplicate likely entered through one of these paths:

1. A copied Missing Knowledge helper block from an earlier local implementation.
2. A conflict-resolution merge that retained both old and new helper blocks.
3. A fresh Phase 5 allowlist added despite the existing registry-backed Missing Knowledge constant.

Because both declarations were top-level `const` declarations in `app.js`, they ended up in the same lexical scope and caused the fatal parse error.

## Which Change Introduced Each Declaration

- The original declaration came from the Brand Workspace / Missing Knowledge runtime foundation, where the five canonical Missing Knowledge module IDs were centralized for contextual prompts.
- The duplicate declaration was introduced by the failed Phase 5 merged/deployed artifact while adding optional `moduleType` metadata or duplicate-prevention logic for the same five canonical modules.

The Phase 5 prompt asked for supported canonical types and validation. That likely caused a second hardcoded list to be generated instead of reusing the existing `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` constant and registry helpers.

## Why This Prevented All of `app.js` From Executing

A duplicate top-level `const` declaration is a SyntaxError during script parsing. Unlike a runtime exception inside a function, parse failure prevents the entire script from evaluating.

Consequences:

1. Google sign-in click binding is never registered.
2. Auth session loading is never started.
3. `bootApp()` is never registered or called.
4. Board route detection and board hydration never run.
5. Brand Brain / Brand Core state loading never runs.
6. Canvas render calls never run.
7. Global event delegation, autosave, presence, polling, and save/load listeners never bind.

This directly explains the observed symptoms:

- user appeared signed out,
- Sign in with Google button did not respond,
- active Board context was missing,
- Brand context was missing,
- Canvas was empty,
- app boot appeared partially completed.

## Why the Previous Audit Was Incomplete

The prior audit identified a real-looking boot-safety risk in `knowledge-module-runtime-adapter.js`: an adapter script loaded before `app.js` contains CommonJS compatibility code that should be hardened.

However, the prior audit did not have the actual browser console output. With the concrete deployed error now known, the adapter concern must be downgraded to secondary/unproven. The primary evidenced failure was the duplicate `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` declaration in `app.js`.

## Why Tests Missed It

A correctly run `node --check app.js` against the exact deployed `app.js` should catch duplicate top-level lexical declarations. Therefore, the reported passing check and the browser SyntaxError imply a test/deploy mismatch.

Likely explanations:

1. `node --check` ran before final conflict resolution introduced the duplicate.
2. CI checked a feature branch commit, while Vercel deployed a merge commit with a duplicate declaration.
3. The assistant/test report described local checks from a different working tree than the deployed artifact.
4. A generated, cached, or manually merged `app.js` differed from the file that was checked.
5. `git status --short` / final diff review did not verify the exact merge commit deployed by Vercel.

`node --check` is necessary but not sufficient for browser boot assurance. It must be run against the exact artifact/commit that deploys, and it does not prove that scripts load in HTML order or that `bootApp()` is reached.

## Secondary Risks

The standalone adapter CommonJS guard remains an independent secondary risk:

```js
if (typeof require === "function") {
  // CommonJS require paths...
}
```

In a browser-like environment where `require` exists but `module.exports` is absent, this pattern can still be unsafe. It was not the evidenced fatal error for the failed Phase 5 deployment, but it should be hardened in a boot-safety PR.

Other console warnings from content scripts or Ethereum provider extensions should be treated as environmental noise unless they are tied to a Funklix stack trace.

## Safe Fix Recommendation

The smallest safe future correction should be split from the Phase 5 feature retry.

### PR A — Boot safety correction only

Scope:

1. Ensure `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` is declared exactly once in `app.js`.
2. Remove any duplicate hardcoded five-module allowlist added by Phase 5.
3. Reuse the existing registry-backed Missing Knowledge helpers rather than adding another canonical list.
4. Optionally harden the adapter CommonJS guard as a separate boot-safety fix if inspection confirms the risk remains.
5. Add a browser script-load smoke test or equivalent that loads scripts in `index.html` order and verifies `/app.js` reaches a boot sentinel.
6. Add a supplemental static check for duplicate top-level declarations of critical constants.

Non-goals:

- Do not reintroduce optional `moduleType` metadata.
- Do not change auth.
- Do not change routing.
- Do not change save/load.
- Do not change UI.

### PR B — Fresh Phase 5 retry

Only after PR A is verified:

1. Reattempt optional `moduleType` metadata with a fresh minimal diff.
2. Reuse the single existing Missing Knowledge module list / registry helpers.
3. Confirm `node --check app.js` runs on the exact merge/deploy artifact.
4. Confirm browser-load smoke reaches the app boot sentinel.

## Testing Gap and Recommended Coverage

`node --check` alone is insufficient because it does not verify browser script order, browser globals, event binding, or `bootApp()` execution.

Recommended minimal coverage without adding dependencies:

1. A static duplicate declaration check for known critical top-level constants, including `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS`.
2. A dependency-free script-order smoke using Node's `vm` module to execute `campaign-v3.js`, registry, identity, adapter, and `app.js` in the order listed by `index.html`, with browser globals stubbed enough to detect parse/load failures.
3. A boot sentinel in the smoke harness proving `app.js` evaluation reached the bottom of the file or registered `bootApp()`.
4. A separate harness case where `window.require` exists but `module.exports` does not, to detect browser/CommonJS conflicts.

If jsdom or Playwright is already installed in the project, they may provide stronger assurance, but this audit does not recommend adding new dependencies solely for this fix.

## Runtime Confirmation

This audit PR is documentation-only. It does not modify:

- `app.js`,
- `index.html`,
- `knowledge-module-registry.js`,
- `knowledge-module-identity.js`,
- `knowledge-module-runtime-adapter.js`,
- auth,
- routing,
- APIs,
- save/load,
- autosave,
- Brand Workspace,
- Canvas,
- Boards,
- Dashboard,
- AI Brain,
- Insights,
- persistence,
- event handlers.

## Manual QA Plan for the Corrective PR

1. Open the deployed app with DevTools console open.
2. Confirm no `Identifier 'BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS' has already been declared` error appears.
3. Confirm `/app.js` executes to the boot sentinel or bottom-of-file marker.
4. Confirm Google Sign in button responds.
5. Confirm auth session request is made.
6. Confirm existing board URL loads board context.
7. Confirm Brand context loads.
8. Confirm Canvas renders existing nodes.
9. Confirm Brand Workspace opens.
10. Confirm Boards library opens.
11. Confirm no Knowledge Module adapter exception appears.
12. Confirm extension/content-script warnings are not treated as Funklix regressions unless they include a Funklix stack trace.
