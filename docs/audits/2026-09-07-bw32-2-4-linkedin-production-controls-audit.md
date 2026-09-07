# BW-32.2.4 — LinkedIn Settings production-controls audit

**Date:** 2026-09-07
**Scope:** documentation-only; repository tip `18c30e2`
**Production evidence available:** the reported labels and click outcomes in the task; no production origin, deployment response capture, browser trace, or database diagnostic was supplied.

## Executive finding

The checked-in browser implementation contains a concrete CSS/DOM defect that fully explains the reported *appearance* and both apparently inert controls without requiring two renderers. The renderer sets the native `hidden` property on Disconnect and Copy diagnostics, but the shared author rule `.fk-btn { display:inline-flex }` overrides the browser's user-agent `[hidden] { display:none }` rule. There is no general author-level `[hidden]` rule. Consequently, the real `<button>` elements remain painted when their `hidden` properties are true.

The sole current LinkedIn renderer/listener owner is `social-connections-settings.js`, initialized once by the last statement of `app.js`. Its `service_unavailable` replacement sets `disconnect.hidden=true`, but CSS still paints Disconnect. Its direct Disconnect listener then starts and immediately returns because the current projection has `disconnectAllowed:false`; no confirmation is supposed to open from that internal state. Copy diagnostics is likewise painted despite `copy.hidden=true`; its listener deliberately does nothing when its private diagnostic string is empty. Retry's direct listener calls `refresh()`, but `refresh()` first redraws the already-visible unavailable state and has no handler-entry/loading marker, so a repeated failure is visually indistinguishable from no click.

This is the **proven source-level cause** of the impossible-looking combination. It is not stale state merging, incomplete clearing, duplicate IDs, a second current renderer, an overlay, or DOM replacement. It is a CSS visibility override combined with guarded direct listeners and absent immediate feedback. Because no production URL or safe response metadata is available, it remains unproven that production delivered these exact bytes. The reported five-label signature is highly diagnostic of this checkout, but a signature is not an HTTP artifact proof.

The server's exact production database exception is also not recoverable from the repository or the UI. The authenticated GET collapses both (a) any statement in one multi-statement schema transaction and (b) the owner-scoped projection `SELECT` into the same `503 linkedin_storage_failed`. The client also produces identical unavailable text for transport, non-JSON, non-2xx, and invalid-contract failures. The remaining uncertainty is therefore explicitly bounded to the browser request/response boundary and, if the response really is the route's 503, to **schema initialization transaction versus owner-scoped projection SELECT**.

**Go/no-go: NO-GO until one missing production fact is collected.** The one user action is: **send the ordinary production page URL (with no query string)**. That permits read-only retrieval of the public HTML, scripts, and safe headers; it requires no browser-internals interpretation and discloses no secret.

## 1. Repository and evidence boundary

### 1.1 What is proven

- The current checkout has one static Social Connections section, one LinkedIn card, one Settings dialog, and one disconnect confirmation dialog.
- `index.html` has 310 `id` attributes and 310 unique values. There are no duplicate static IDs.
- The LinkedIn module and `app.js` parse successfully (see verification record below).
- Current source has exactly one LinkedIn renderer and one call site that initializes it.
- Current CSS defeats the native semantics of `hidden` for every `.fk-btn`, including the three LinkedIn action buttons.
- Current unit/fixture checks do not execute the production document and stylesheet in a browser.

### 1.2 What is not proven

- The production origin and therefore the status, content type, cache headers, ETag/deployment identifier, and response bytes of `/`, `/app.js`, `/social-connections-settings.js`, `/language.js`, and `/styles.css`.
- Whether production HTML and JavaScript came from the same deployment generation.
- Whether a production exception occurred before the final `LinkedInSettings.initialize(...)` call.
- Whether a production click event reached the element or listener, and whether Retry emitted a request.
- The production PostgreSQL error text or exact failing statement.

No HTTP request was attempted because the repository and task provide no concrete production origin. Network access alone cannot safely identify an application endpoint. No cookies, credentials, OAuth data, tokens, user data, or database targets were inspected.

## 2. Delivered-browser lifecycle reconstructed from the checkout

### 2.1 Document and classic-script order

All local scripts are ordinary parser-blocking **classic** scripts: none has `type="module"`, `defer`, or `async`. `/theme-bootstrap.js` is in `<head>`. At the end of `<body>`, exact order is:

1. `/theme.js`
2. `/language.js`
3. `/campaign-v3.js`
4. `/knowledge-module-registry.js`
5. `/knowledge-module-identity.js`
6. `/knowledge-module-runtime-adapter.js`
7. `/knowledge-module-dependency-engine.js`
8. `/brand-dna-generation-preflight.js`
9. `/funnel-simulator.js`
10. `/persona-journey-simulator.js`
11. `/content-workspace.js`
12. `/social-connections-settings.js`
13. `/app.js`

Thus the LinkedIn module is registered before `app.js`. Its UMD wrapper assigns `globalThis.LinkedInSettings` in a browser but does not initialize itself. `app.js` is its consumer.

Classic scripts execute in order. A throw in an earlier script terminates that script but does not by itself stop the browser loading later script tags. A parse/runtime exception in `app.js` before its last line does prevent the initialization call. Optional chaining also makes a missing `LinkedInSettings` silently skip initialization. The integrity checker parses every local classic script in isolation, but does not execute their shared production order or detect runtime exceptions.

### 2.2 Static DOM, application boot, and Settings opening

`index.html` permanently creates:

- host section `#social-connections-settings`;
- card `#linkedin-connection-card`;
- `#linkedin-connection-status`, `#linkedin-connection-detail`, and live region `#linkedin-connection-result`;
- action buttons `#linkedin-connect-button`, `#linkedin-disconnect-button`, and `#linkedin-copy-diagnostics`;
- Settings modal `#settings-dialog` and its open/close buttons;
- confirmation modal `#linkedin-disconnect-dialog`, `#linkedin-disconnect-cancel`, `#linkedin-disconnect-confirm`, and `#linkedin-disconnect-error`.

The initial HTML says “Not connected”; Connect is disabled and says “Setup required”; Disconnect and Copy diagnostics carry the native `hidden` attribute. The `.fk-btn` display rule nevertheless paints those last two (the core defect).

Near the end of `app.js`, application boot is scheduled with `DOMContentLoaded` when the document is still loading and is run immediately otherwise. Scheduling `bootApp()` occurs before LinkedIn initialization; initialization itself is synchronous and immediately starts its `refresh()`. It does not wait for Settings to open or for `bootApp()` to resolve.

`app.js` owns Settings opening. The `click` listener on `#settings-open-btn` synchronizes the language selects, clears language status, invokes `#settings-dialog.showModal()`, synchronizes the shell, and focuses `#settings-dialog-title`. Closing uses direct `cancel`/`close` listeners. Opening Settings does not create or replace the Social Connections DOM and does not trigger a LinkedIn refresh.

### 2.3 Projection request, validation, replacement, and render

The final `app.js` statement calls:

```text
globalThis.LinkedInSettings?.initialize({
  document,
  fetchImpl: fetch.bind(globalThis),
  location,
  history,
  translate: value => language?.t?.(value) || value
})
```

`initialize()` captures the permanent elements by ID. It returns `null` only when the card or Connect button is absent; other required elements are used unguarded and would cause initialization-time errors if absent. It installs listeners, parses bounded callback query fields, installs a `funklix-session-change` global listener, and invokes `refresh()`.

`refresh()`:

1. increments `loadVersion`;
2. calls `replace(service_unavailable)` as a loading/fail-closed projection;
3. requests `GET /api/social-connections` with `Accept: application/json`;
4. calls `response.json()` without first validating content type;
5. rejects non-2xx responses and any `linkedin` value that fails local discriminated validation;
6. ignores superseded replies using `loadVersion`;
7. atomically replaces its private projection and rerenders on success;
8. on any caught request/status/JSON/contract error, replaces with `service_unavailable`, then turns Connect into enabled Retry.

`replace()` clears private projection first; sets Disconnect hidden and enabled; sets Connect visible but disabled; clears status, detail, result, result state, diagnostic, and Copy visibility; freezes a shallow copy of a valid projection (or substitutes unavailable); then calls `render()`. This is complete state replacement for text/properties, not DOM-node replacement or object merging. No stale closure is created because listeners read the mutable private `projection` at click time.

`render()` is the only current state writer. It writes status/detail, Connect visibility/disabled/label, and Disconnect visibility. It never assigns `innerHTML` and never creates/replaces buttons.

### 2.4 Event ownership and later rerenders

All LinkedIn controls use **direct `addEventListener` bindings installed once at initialization**:

| Element | Event | Owner | Dispatch style |
|---|---|---|---|
| `#linkedin-connect-button` | `click` | LinkedIn module | direct; label comparison dispatches Retry versus connect |
| `#linkedin-disconnect-button` | `click` | LinkedIn module | direct; projection capability guard, then dialog open |
| `#linkedin-copy-diagnostics` | `click` | LinkedIn module | direct; clipboard write only when private diagnostic is nonempty |
| `#linkedin-disconnect-cancel` | `click` | LinkedIn module | direct close |
| `#linkedin-disconnect-confirm` | `click` | LinkedIn module | direct POST after capability/busy guard |
| `#linkedin-disconnect-dialog` | `cancel`, `keydown` | LinkedIn module | direct close/focus trap |
| global object | `funklix-session-change` | LinkedIn module | direct refresh |

There are no inline handlers, `data-action` dispatch, delegated host listener, or required public action globals. The public global exposes only `initialize` and `valid`.

Language changes call `refreshInterfaceLanguage()`, which rerenders Dashboard, Boards, Brand Core, AI Brain, and Activity and translates only those roots. `applyTranslations()` changes text/attributes in place; it does not use `innerHTML`. Social Connections is not among the translated roots. Settings reopen likewise does not replace the host. Accordingly, current repository code does not replace the LinkedIn elements after binding, and repeat opening does not rebind or duplicate listeners.

## 3. Browser artifact/deployment audit

### 3.1 What a production read-only retrieval must establish

Once the production page URL is supplied, retrieve only public unauthenticated resources and record for `/`, `/app.js`, `/social-connections-settings.js`, `/language.js`, and `/styles.css`:

- final URL (with query removed), response status, and content type;
- `Cache-Control`, `ETag`, `Last-Modified`, `Age`, and a safe platform deployment identifier if actually present;
- script URL/order and classic/module/defer/async attributes from HTML;
- SHA-256 digests of public response bodies (not body dumps);
- whether HTML references the LinkedIn module;
- whether the module contains all seven states, `replace`, `refresh`, direct listeners, and confirmation dialog usage;
- whether `app.js` contains the one matching `LinkedInSettings.initialize` call;
- whether CSS contains `.fk-btn { display:inline-flex }` and lacks a controlling `[hidden]` rule.

### 3.2 Cache/deployment contract found in the repository

The browser asset names are stable, unhashed paths. `vercel.json` defines only `/boards` rewrites and contains no headers/cache policy. There is no manifest tying `index.html` to content-addressed JavaScript. Therefore the repository does **not guarantee atomic HTML/JS compatibility** or document cache invalidation. Whether the hosting platform nevertheless deploys atomically is external and unproven. With unhashed filenames, different HTML and script generations are possible through intermediary/browser cache behavior; they are not proven to have occurred here.

### 3.3 Artifact inference, not proof

The reported exact labels “Temporarily unavailable,” “LinkedIn connection storage is temporarily unavailable,” and “Retry” exist together in the current module. Simultaneously visible Disconnect and Copy diagnostics follow deterministically from current HTML plus `.fk-btn { display:inline-flex }`. This strongly identifies the current architecture's visual failure, but cannot prove response status, headers, ETag, or exact deployed bytes. Those claims remain intentionally unmade.

## 4. Render/listener ownership and conflicts

| Element/state | Intended owner | Actual current writers | Listener owner | Replacement risk | Finding |
|---|---|---|---|---|---|
| `#social-connections-settings` | static document | `index.html` only | none | none found | one permanent host |
| LinkedIn card structure/IDs | static document | `index.html` only | module captures children | none found | no current dynamic card renderer |
| projection | server contract + module copy | route response; module `replace()` | n/a | response supersession guarded | no state merge |
| status/detail | module | static fallback, then module `render()` | n/a | text changes in place | one runtime writer |
| Connect/Retry | module | static fallback, `replace()`, `render()`, catch tail | module direct click | node stable | listener survives; label is dispatch state |
| Disconnect | module | static `hidden`; module `replace()`/`render()` | module direct click | node stable | CSS makes hidden button visible |
| Copy diagnostics | module | static `hidden`; `clearFeedback()`/`feedback()` | module direct click | node stable | CSS makes hidden button visible even with empty diagnostic |
| confirmation dialog | static document | module changes open/error/busy | module direct listeners | node stable | cannot open in unavailable projection due guard |
| Settings dialog | `app.js` | static document; `app.js` opens/closes | `app.js` | none | no social replacement |
| language refresh | `app.js`/language module | selected non-social roots | unrelated listeners | none | does not replace social nodes |

Historical commits before BW-32.2.3 did embed a separate LinkedIn renderer at the bottom of `app.js`, use the legacy response shape, and use native `confirm()`. The current `app.js` removed it and contains only the module call. A mixed cached generation remains possible but is not needed to explain the report and is not proven.

Repository-wide searches found no second current writer of these exact LinkedIn IDs. Static ID counting found no duplicates. No hidden fallback element overlaps the card: the problematic elements are the actual action buttons themselves. No Social Connections `innerHTML` mutation exists, so stale DOM attributes do not survive a replacement; rather, the current `hidden` attribute remains present but is visually overridden.

## 5. Impossible UI state: exact writer-by-writer proof

### 5.1 Permitted projection mapping

| State | Only permitted controls |
|---|---|
| `setup_required` | disabled setup explanation only |
| `service_unavailable` | enabled Retry and active diagnostics only |
| `not_connected` | Connect LinkedIn |
| `connected` | Reconnect and Disconnect |
| `connected_limited` | Reconnect and Disconnect; publishing disabled |
| `needs_attention` | only explicitly supported recovery actions |
| `disconnected` | Connect LinkedIn |

The current contracts make setup unavailable, unavailable, not-connected, connected, connected-limited, and disconnected flag combinations exact. `needs_attention` is less exact in both server and browser validators; the server currently emits Reconnect plus Disconnect with a connection ID. That is an explicitly implemented recovery projection, though a future exhaustive mapping should encode it just as strictly as the others.

### 5.2 Actual path producing all reported controls

1. Initialization or Retry enters `refresh()`.
2. `replace(service_unavailable)` writes the unavailable status/detail, sets Disconnect's `hidden` property true, clears diagnostic, and sets Copy's `hidden` true.
3. While the request is pending, or when request/parse/validation fails, the status remains unavailable.
4. The catch tail enables Connect and labels it Retry.
5. `.fk-btn { display:inline-flex }` overrides the user-agent hidden presentation for Connect, Disconnect, and Copy because all have class `fk-btn` and no author `[hidden]` override exists.

Therefore every visible control has an exact writer:

- unavailable title/detail: module `render()`;
- Retry label/enabled state: module `refresh()` catch tail;
- Disconnect element: static `index.html`; module correctly sets `hidden`, CSS incorrectly paints it;
- Copy diagnostics element: static `index.html`; module correctly sets `hidden`, CSS incorrectly paints it.

The violation is at CSS presentation, after the state mapping. It is **not** an invalid discriminated projection and **not** evidence that a Disconnect capability exists. It is also why three logic-focused corrections could pass while the visual contradiction persisted.

## 6. Actual clickability and first observable boundaries

### 6.1 DOM and CSS contract

- Retry, Disconnect, and Copy diagnostics are native `<button type="button">` elements with stable unique IDs. They are not form submitters.
- No action has `aria-disabled`. Retry is enabled in the error catch. Disconnect is explicitly reset to `disabled=false` even while hidden; Copy is not disabled.
- The Settings/card ancestry has no `inert` or hidden ancestor in the open modal.
- LinkedIn-specific CSS sets layout/minimum sizes only. No matching `pointer-events:none`, capture listener, `preventDefault`, or `stopPropagation` was found.
- Dialog backdrops are behind their own open modal and no overlapping in-card overlay is defined. Static analysis cannot prove production geometry, but repository CSS supplies no blocker.
- `.fk-btn` makes hidden actions painted and pointer-active. The bug is the opposite of a pointer-event block.
- Listeners are direct, installed once, and the nodes are not replaced. There is no duplicate initialization guard; current source has one call. If an external duplicate call occurred it would add duplicate listeners, but there is no second current call.
- A top-level exception anywhere in `app.js` before its final line would prevent all LinkedIn listener installation. The current integrity check cannot detect this runtime condition.

### 6.2 Retry boundaries

1. **Physical click reaches element:** reported user input proves only that the user actuated the visible control, not that the browser targeted it; no event trace exists.
2. **Handler begins:** unproven in production. In this checkout a successful event invokes the direct listener.
3. **Command dispatch:** in this checkout, exact translated-text equality with “Retry” calls `refresh()`.
4. **Request begins:** in this checkout, `fetchImpl('/api/social-connections')` follows immediately; unproven in production.
5. **Response arrives:** unproven.
6. **Projection refresh begins:** source-level behavior is proven, production execution is not.
7. **Visible feedback:** no handler-entry or loading marker exists. Unavailable is redrawn as unavailable, and a repeated failure ends identically.

**Last production boundary proven:** the unavailable rendering and the user's attempted physical click.
**First unproven boundary:** browser click-handler entry.
**First source-level UX failure:** boundary 7—there is no distinguishable immediate Retry feedback even if boundaries 2–6 execute.

### 6.3 Disconnect boundaries

1. **Physical click:** user actuation reported; targeting unproven.
2. **Handler begins:** unproven in production. In this checkout the directly bound listener can begin because CSS paints a real enabled button.
3. **Command dispatch:** deliberately does **not** begin in `service_unavailable`; the first line returns on `!projection.disconnectAllowed`.
4–7. Request, response, refresh, and feedback are consequently unreachable; confirmation-dialog `showModal()` is also skipped by the guard, before any request can occur.

Thus “no confirmation dialog” is exactly the current safe capability guard operating behind an erroneously visible control. The first visible failure is CSS exposing the forbidden action; it is not evidence that the handler is absent.

### 6.4 Copy diagnostics

The native button is erroneously visible. Its handler begins only if a click reaches it and calls clipboard only if private `diagnostic` is nonempty. Projection-fetch failures never populate that string, so the visible control does nothing. It cannot be used as the requested missing-fact collection method.

## 7. Server `service_unavailable` trace and bounded database uncertainty

### 7.1 Authenticated GET path

`GET /api/social-connections`:

1. creates a bounded server request ID;
2. reads the session and derives owner account ID;
3. sets JSON content type and `Cache-Control: no-store`;
4. rejects non-GET (405) and unauthenticated (401);
5. evaluates LinkedIn configuration; not-ready returns `setup_required`, not unavailable;
6. calls `createStorage().listConnectionProjection(owner)`;
7. storage validates owner, selects the established lazy pool, and awaits `ensureSocialConnectorSchema(pool)`;
8. schema initialization executes one multi-statement transaction: advisory lock, table/index creation, OAuth-attempt column/default/data/constraint upgrades, foreign key, and job/attempt/external-post DDL;
9. storage executes one owner-scoped projection query over `social_connected_accounts`, left joins token-secret metadata, and performs destination existence/active subqueries;
10. route chooses the first active LinkedIn row, else any LinkedIn row;
11. settings projection evaluates token presence/revocation/key version/expiry, destination presence/activity, identity, scopes, status, and constructs a validated state;
12. route serializes `{linkedin, others}`.

Credential **payload lookup/decryption does not occur** in this GET. Only secret existence, revoked state, and encryption-key version are read. Destination lookup is via two `EXISTS` subqueries. OAuth association is `last_oauth_attempt_id` carried from the connection row; the OAuth-attempt table is not joined. These distinctions matter when diagnosing the failing operation.

### 7.2 Collapse points

There is one route catch that converts all errors from `listConnectionProjection` into HTTP 503, projection `service_unavailable`, and safe code `linkedin_storage_failed`. Inside that call there are two candidate exception boundaries:

| Operation | Exception boundary | Current safe diagnostic | Retriable? | Mutates? | Can coexist with committed connection? | Real PostgreSQL in tests? |
|---|---|---|---|---|---|---|
| schema transaction (`SCHEMA_SQL`) | rejected `ensureSocialConnectorSchema`; cached promise resets | route request ID + generic storage code/phase | potentially; unknown by class | yes, transactional DDL/data normalization; rolls back on statement error | yes; a committed row may predate a failed later upgrade/permission attempt | no |
| owner-scoped projection SELECT | pool query rejection | same generic route diagnostic | potentially; unknown by class | no | yes | no |
| row-to-state projection/validation | inside route try | same generic route diagnostic | deterministic until data/config changes | no | yes, especially malformed/legacy row | no real DB; object fixtures only |
| JSON serialization/end | same route try in practical execution | same catch if thrown synchronously | unknown | no database mutation | yes | no |

The client additionally maps network rejection, non-JSON, non-2xx (including 401), and browser-contract rejection to the same unavailable text. Hence the visible text alone does not prove the server route returned `service_unavailable` at all.

### 7.3 Exact operation conclusion

**Exact production storage operation: not established.** If a safe HTTP capture confirms the route's `503 linkedin_storage_failed`, repository evidence bounds the failure to schema initialization, the owner projection SELECT, projection construction, or response construction. The database-operation subset is precisely **the schema transaction or owner-scoped projection SELECT**. Existing evidence cannot responsibly select one statement.

The minimal safe server diagnostic for recovery must contain only:

```json
{
  "serverRequestId": "bounded opaque id",
  "classification": "storage|contract|response",
  "phase": "schema_initialization|projection_query|projection_build|response",
  "operationCategory": "schema_ddl|schema_upgrade|connection_projection_read|none",
  "schemaVersion": "bounded integer or unknown",
  "committedStateCategory": "none|committed|committed_limited|inconsistent|unknown",
  "timestamp": "ISO-8601 UTC"
}
```

It must never include SQL text, connection information, row/user content, credentials, encrypted payloads, provider responses, OAuth codes/state, cookies, or tokens. Diagnosis must be read-only first. A repair must preserve committed connection, token provenance, and destination records.

## 8. Why BW-32.1 through BW-32.2.3 passed

| Check | Actual test class | What it covers | Critical omissions |
|---|---|---|---|
| BW-32.1 | Node unit + source-fragment assertions + fake storage seam | contracts, vault, adapter registry, static labels/counts | no browser, stylesheet cascade, production script order, HTTP, or PostgreSQL |
| BW-32.2 | Node adapter unit + source-fragment assertions | provider request construction, response validation, presence of IDs/global strings | no real document execution, controls, Settings, database, or deployment |
| BW-32.2.1 | in-process route helper with `require.cache` pool/auth fixtures + source fragments | callback outcome/redirect sanitization and expected strings | deliberately bypasses real auth/storage; no browser or database |
| BW-32.2.2 | mocked pool/object fixture + source fragments | committed-state classifier and migration text presence | no schema execution or upgraded PostgreSQL |
| BW-32.2.3 | minimal `EventTarget` DOM fixture + mocked fetch/pool | discriminated objects, direct click listeners, dialog boolean, one mocked POST | no HTML/CSS, real dialog, browser cascade, real script order, reopen/language, HTTP, or PostgreSQL |
| Browser script integrity | static HTML extraction + `vm.Script` parsing | local classic file existence/syntax; selected ordering | does not require LinkedIn order, execute scripts, boot app, instantiate DOM, load CSS, or detect runtime throws/cache skew |
| Runtime Boot Safety | CI command aggregation | runs the above and other Node checks | not a browser/deployed/database test |

Specifically, BW-32.2.3 creates hand-written `Element extends EventTarget` objects. Its `hidden` property is just a boolean and no CSS engine paints it. It dispatches clicks programmatically, models `showModal()` as `open=true`, and mocks all network/storage responses. It does not load `index.html`, `styles.css`, or `app.js`; does not execute production script order; does not use the real Settings dialog/host; does not open Settings twice or switch language; does not render/click Retry; does not test Copy diagnostics; does not detect duplicate IDs or node replacement; and does not detect an `app.js` boot exception. Calling it an end-to-end browser test would be incorrect.

No listed regression is a real browser test, deployed HTTP test, or real PostgreSQL test. No check exercises existing upgraded schema state, a real committed limited connection, stale cached assets, light/dark rendering, or mobile hit-testing. BW-32.2.3 passes because its fixture validates JavaScript capability guards while omitting the browser's CSS cascade—the exact failing boundary.

## 9. Evidence-based BW-32.2.5 recovery plan

The likely architecture is mostly appropriate but needs adjustment: the permanent host and sole module owner already exist; wholesale DOM rebuilding is unnecessary to fix this concrete defect. Direct listeners are safe only while the current permanent button nodes remain immutable. Delegation is preferable if recovery intentionally moves to complete host replacement.

### A. Browser control recovery

1. First prove deployed public artifacts from the supplied URL and record compatible HTML/module/app/CSS digests.
2. Restore native hidden semantics with one authoritative `[hidden]` presentation rule (or avoid setting an author `display` on hidden controls). Verify computed display and hit testing—not only the property.
3. Keep one permanent `#social-connections-settings` host and one LinkedIn module as sole projection renderer/listener owner. Remove any legacy renderer if deployed artifact inspection finds one.
4. Choose one internally consistent strategy:
   - keep permanent child buttons and the existing once-only direct listeners; or
   - replace the host's state markup completely and install exactly one delegated host click handler.
   Do not combine replaceable buttons with direct render-time bindings. The requested long-term exhaustive architecture favors the second option.
5. Encode an exhaustive state-to-controls table, including exact `needs_attention` recovery capabilities. Derive the entire visible action set from one validated projection. Never paint Disconnect in `service_unavailable`.
6. On Retry and Disconnect entry, synchronously render a localized “Loading…” or “Opening confirmation…” status and a safe non-secret handler-entry marker before any request. This makes boundary 2 observable. Do not dispatch based on translated `textContent`; use a stable action value.
7. Preserve native buttons, focus return/trap, live regions, 44px targets, light/dark contrast, mobile layout, and localized labels. Explicitly re-render dynamic social text after interface-language changes rather than relying on static `data-i18n` attributes.
8. Ensure one initialization call and surface a bounded boot diagnostic if the module is missing or initialization fails; do not let optional chaining make that failure silent.
9. Deploy HTML and JS/CSS compatibly: content-hashed assets or an atomic manifest, HTML revalidation, and an explicit compatibility/version marker.

### B. Storage recovery

1. Separately identify whether the public GET reaches the route and returns its bounded 503 envelope.
2. Add/observe the minimal safe diagnostic classification above in a controlled recovery—not raw exceptions.
3. Reproduce the identified phase against a production-like clone of the upgraded schema using the same role grants. Separate schema DDL/upgrade from the projection read so each has an observable bounded phase.
4. Repair only the proven statement, constraint/grant, or legacy-row contract. Do not delete a connection, revoke a token, rewrite provenance, clear OAuth attempts, or force reconnection without evidence.
5. Verify the committed category and token/destination provenance read-only before and after repair.

### C. Production-boundary regression

Add in BW-32.2.5—not this audit—a real-browser test that:

- loads real `index.html`, stylesheet, and every classic script in actual order;
- fails on uncaught boot exceptions and proves module initialization exactly once;
- opens the real Settings dialog and queries the actual permanent Social Connections host;
- renders every discriminated state and asserts both DOM `hidden` state **and computed visibility/hit testing**;
- verifies only Retry (and active diagnostics when available) in `service_unavailable`;
- clicks the real Retry element, observes handler-entry feedback, and observes one GET;
- renders a validated connected state, clicks real Disconnect, observes handler entry/dialog creation, confirms, and observes exactly one POST;
- detects duplicate IDs and listener duplication/node replacement;
- repeats after interface-language change and Settings close/reopen;
- covers keyboard and pointer interaction, Light/Dark Mode, desktop/mobile viewports;
- runs the GET projection against a production-like PostgreSQL fixture upgraded from the prior schema and containing a committed limited connection;
- includes an HTTP deployment-contract test that rejects incompatible HTML/app/module versions and stale unhashed combinations.

## 10. Go/no-go

**NO-GO until a missing production fact is collected.** Source evidence is sufficient to define the narrow browser correction and storage diagnostic work, but the task requires proof of the actual delivered HTML/JavaScript and the exact storage operation. Neither can be claimed without a production origin and safe read-only responses.

**Exactly one user action:** send the ordinary production page URL with no query string. Do not include cookies, credentials, OAuth codes/state, tokens, user content, or database information. The existing Copy diagnostics control is not requested because this audit proves it can be visibly exposed while its private diagnostic is empty and its click has no observable outcome.

After that single fact is supplied, a read-only artifact audit can distinguish current compatible bytes, cached-generation skew, and missing module initialization; the safe server request ID/phase contract can then bound the PostgreSQL diagnosis without exposing secrets.

## 11. Verification record

The required commands for this documentation-only audit are recorded in the delivery commit's final report. They were run without modifying production code, tests, package scripts, workflow, schema, or environment configuration. The only audit change is this file.
