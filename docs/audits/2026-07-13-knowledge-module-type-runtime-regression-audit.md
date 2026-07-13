# Critical Runtime Regression Audit — Auth and App Boot Failure

> **Superseded root-cause note (2026-07-13):** Actual browser console evidence from the failed deployed PR reported `Uncaught SyntaxError: Identifier 'BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS' has already been declared` at `app.js:4848`. That duplicate `app.js` lexical declaration is the evidenced primary root cause of the auth/app boot failure. The CommonJS/browser adapter issue documented below remains a secondary boot-safety risk only, not the authoritative cause of that deployed incident. See `docs/audits/2026-07-13-knowledge-module-phase5-actual-regression-audit.md`.

## Summary

The severe runtime symptoms are consistent with a top-level JavaScript exception before `app.js` executes. Because `index.html` loads `knowledge-module-runtime-adapter.js` before `app.js`, any unhandled exception in the adapter prevents the main app script from loading and therefore prevents auth binding, session loading, board hydration, canvas rendering, and Brand Workspace initialization.

The first unsafe line in the reverted Knowledge Module foundation chain is the unconditional CommonJS identity import inside the runtime adapter:

```js
commonJsIdentity = require("./knowledge-module-identity");
```

This line is gated only by `typeof require === "function"`, not by a true CommonJS/module environment check. In browser runtimes or preview harnesses where a `require` function exists but local CommonJS module resolution is not available, the line throws before `window.KnowledgeModuleRuntimeAdapter` is exported and before `/app.js` loads.

This explains why the page appears partially booted: static HTML and earlier scripts may load, but the main app script never reaches its top-level event binding or `bootApp()` call.

## Root Cause

`knowledge-module-runtime-adapter.js` mixed browser script execution with a Node/CommonJS import assumption.

The adapter does this at top level:

```js
if (typeof require === "function") {
  try {
    commonJsRegistry = require("./knowledge-module-registry");
  } catch (_error) {
    commonJsRegistry = null;
  }
  commonJsIdentity = require("./knowledge-module-identity");
}
```

The registry import is protected by a catch, but the identity import is not. More importantly, the condition checks only for a `require` function. That is not equivalent to being in a Node/CommonJS runtime.

Safe browser globals already exist:

- `knowledge-module-registry.js` exports `window.KnowledgeModuleRegistry`.
- `knowledge-module-identity.js` exports `window.KnowledgeModuleIdentity`.
- The runtime adapter's own `getRegistryApi()` / `getIdentityApi()` can read those browser globals.

Therefore the adapter does not need to execute CommonJS `require(...)` in browser script mode at all.

## First Failing Browser Line

The first failing line is:

```js
commonJsIdentity = require("./knowledge-module-identity");
```

It appears before any adapter functions are exported. If it throws, browser execution stops inside `knowledge-module-runtime-adapter.js` and the following `/app.js` script tag does not execute.

## Why Static Checks Missed It

`node --check` only parses JavaScript syntax. It does not execute browser script tags, does not emulate HTML load order, and does not test browser global/CommonJS interactions.

Even executing the adapter in Node can pass because Node can resolve `require("./knowledge-module-identity")`. The failure is environment-specific: browser script execution with a `require` function present but without Node-style relative module resolution.

This makes the regression invisible to syntax checks and most Node-only smoke tests.

## Script Load Order Findings

`index.html` loads scripts in this order:

1. `/campaign-v3.js`
2. `/knowledge-module-registry.js`
3. `/knowledge-module-identity.js`
4. `/knowledge-module-runtime-adapter.js`
5. `/app.js`

The registry and identity browser exports are available before the adapter script. However, the adapter attempts CommonJS loading before relying on those globals. If that top-level require fails, `/app.js` is not reached.

## Browser Export Findings

### Registry

`knowledge-module-registry.js` safely exports to the browser with:

```js
if (typeof window !== "undefined") {
  window.KnowledgeModuleRegistry = KnowledgeModuleRegistry;
}
```

Its CommonJS export is guarded with `typeof module !== "undefined" && module.exports`.

### Identity

`knowledge-module-identity.js` safely exports to the browser with:

```js
if (typeof window !== "undefined") {
  window.KnowledgeModuleIdentity = KnowledgeModuleIdentity;
}
```

Its CommonJS export is also guarded with `typeof module !== "undefined" && module.exports`.

### Runtime Adapter

The runtime adapter exports to the browser safely after its definitions, but the unsafe top-level identity `require(...)` can prevent the file from reaching that export block.

## Affected Boot Chain

If `knowledge-module-runtime-adapter.js` throws before `/app.js`, the following app code never runs:

1. Top-level event bindings, including Google sign-in click binding.
2. `bootApp()` registration/execution.
3. `loadSessionUser()` inside `bootApp()`.
4. Board route detection and `loadBoardFromUrlIfPresent()`.
5. Brand Brain state loading.
6. Canvas render calls.
7. Brand Core render calls.
8. Autosave, presence, polling, and event delegation setup.

This matches the observed symptoms:

- user appears signed out,
- Sign in with Google does not respond,
- active board and brand context are missing,
- canvas renders empty,
- app boot appears partially completed.

## Why the Phase 5 Change Surfaced the Regression

The Phase 5 change increased use of Knowledge Module helpers and made the Knowledge Module script chain more central to boot confidence, but the boot-breaking dependency boundary is in the adapter's top-level CommonJS/browser compatibility logic.

The module type implementation itself can be reverted, but the unsafe adapter import remains the critical pattern to fix before reintroducing any runtime adoption work.

## Safe Fix Recommendation

Smallest safe correction:

1. Do not reapply Phase 5 `moduleType` behavior yet.
2. First harden the standalone Knowledge Module scripts so browser script execution cannot throw before `app.js`.
3. In `knowledge-module-runtime-adapter.js`, only use CommonJS `require(...)` when a real CommonJS module environment is present:

```js
const isCommonJs = typeof module !== "undefined" && Boolean(module.exports) && typeof require === "function";
if (isCommonJs) {
  commonJsRegistry = require("./knowledge-module-registry");
  commonJsIdentity = require("./knowledge-module-identity");
}
```

4. In browser mode, rely only on `window.KnowledgeModuleRegistry` and `window.KnowledgeModuleIdentity`, which are already loaded before the adapter.
5. Add a browser-load smoke test or HTML-order smoke that executes the files in script-tag order with `window` defined and no CommonJS `module.exports`.
6. Add a second smoke case where a non-CommonJS `require` function exists to confirm the adapter does not call it in browser mode.

Do not change auth, routing, save/load, UI, or module type persistence as part of this boot fix.

## Runtime Confirmation

This audit PR is documentation-only. It does not modify:

- auth,
- routing,
- save/load,
- Board APIs,
- Brand Workspace UI,
- Canvas,
- Knowledge Module runtime files,
- script load order,
- persistence,
- DOM IDs,
- event handlers.

## Manual QA Plan for the Future Fix

After applying the standalone boot hardening fix in a separate PR:

1. Open the app in a normal browser session.
2. Confirm no console error occurs before `/app.js` loads.
3. Confirm Google Sign in button responds.
4. Confirm `/api/auth/session` is requested by `bootApp()`.
5. Confirm signed-in state renders when a session exists.
6. Open an existing board URL.
7. Confirm board context loads.
8. Confirm Brand context loads.
9. Confirm Canvas renders existing nodes.
10. Confirm Brand Workspace opens.
11. Confirm Boards library opens.
12. Confirm no Knowledge Module adapter exception appears in console.
13. Repeat in a browser/dev harness where `window.require` is defined but `module.exports` is not.
14. Confirm the adapter does not invoke that browser `require`.
15. Run syntax checks and browser-load smoke checks before reintroducing Phase 5 behavior.

## Rollback Guidance

If a similar boot failure occurs again, immediately remove or disable standalone scripts loaded before `/app.js` until the page reaches `bootApp()`. Any script loaded before `app.js` must be treated as boot-critical and must not perform environment-sensitive top-level work that can throw in browser mode.
