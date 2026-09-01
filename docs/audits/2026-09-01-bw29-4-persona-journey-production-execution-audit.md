# BW-29.4 — Persona Journey production execution audit

**Date:** 2026-09-01
**Scope:** Documentation-only production-path audit
**Observed deployment symptom:** `Simulation error: invalid_request · invalid_request · Request UNKNOWN`

## 1. Executive conclusion

The repository proves that the browser *attempts* a `POST` to `/api/funnel-simulator/run` after its local preflight succeeds. It does **not** contain a production network capture, platform log, or response body, so it cannot prove the deployed HTTP status, content type, route resolution, handler entry, authentication, Board access, configuration evaluation, or provider invocation for the observed run. In particular, **the provider was not demonstrably reached**.

The most important finding is that `Request UNKNOWN` does **not**, by itself, prove that the endpoint diagnostic envelope was never created. The endpoint creates `requestId` at handler entry and includes it in every response produced through `reply()` (`api/funnel-simulator/run.js:14-19`). However, the browser preserves the parsed response object only for the special `configuration_invalid`/no-issues branch. For ordinary non-2xx JSON such as `{ code: "invalid_request", requestId: "AB12CD34" }`, it throws a new error containing only `code`; the catch block consequently sees no response and substitutes `UNKNOWN` (`persona-journey-simulator.js:47`). Thus the exact displayed symptom is fully compatible with the handler having run, contract validation having returned HTTP 400 JSON, and the browser having discarded the server request ID. It is also compatible with a non-JSON/platform response, because unconditional `response.json()` throws before any status or body metadata is retained.

The highest-probability application-level explanation is therefore: the deployed request reached the handler, `validateRequest(req.body)` rejected the production body, `reply()` returned structured `invalid_request`, and the client discarded that envelope. The highest-priority alternative is rejection outside the handler (route/runtime/import/body limit/platform error) followed by failed JSON parsing. These alternatives cannot be separated from the screenshot text alone.

The current regressions are contract and in-process handler tests, **not deployed-route end-to-end tests**. They directly pass an already parsed fixture to the CommonJS handler, replace authentication and Board access through `require.cache`, deliberately prevent `pg` from loading, and mock provider transport. They do not exercise DNS/TLS, Vercel route discovery, serverless module boot with the real storage graph, platform body parsing/limits, cookies over HTTP, response headers/content type, or browser fallback parsing.

The product idea is **not inherently too complex**: choose audience, stages, and assets; make one bounded provider call; render a journey. The implementation is overcomplicated by accidental complexity: duplicate client/server projections, multiple identities and snapshots, full Canvas submission, strict exact-key schemas, parallel readiness logic, legacy output compatibility, and mocks that bypass production boundaries.

**Single next implementation step with the highest diagnostic value:** in one focused corrective PR, add a safe client request ID plus first-line server request ID/phase echo, and make the browser retain HTTP status, content type, and raw response category before parsing. Deploy that diagnostic without changing resolution or provider logic. One real run will distinguish “handler never entered” from every in-handler outcome.

## 2. Exact observed production evidence

### Known

- Review displayed Content Creators from Board Brand Core, two synthetic Personas, four ordered stages (Awareness through Conversion), four ready assets, no Retention, and an enabled Run button.
- The UI displayed `invalid_request · invalid_request · Request UNKNOWN` and the generic instruction to review a highlighted configuration item, although no item was highlighted.
- Source code calls the nested route using `fetch('/api/funnel-simulator/run', ...)`.
- `vercel.json` rewrites only `/boards` and `/boards/:id`; it neither rewrites nor blocks `/api/funnel-simulator/run`.
- Other repository endpoints use nested `api` directories and CommonJS default handler exports, so this route is structurally consistent with the repository.

### Not captured and therefore unknown

No supplied artifact records a Network-panel request, deployed function log, or platform log. Consequently the exact on-wire URL origin, serialized bytes, status, response content type, response body category (JSON/HTML/text/empty/framework-generated), redirect chain, timing, handler entry, or provider call is unknown. The source answers what the browser is designed to do; it does not establish what the deployed run actually did.

### What the visible string proves

It proves only that the client catch block ended with `session.error === "invalid_request"`, found no retained `e.response.requestId`, and inserted `UNKNOWN`. It does **not** prove route failure, pre-handler failure, or provider invocation. The duplicated classification occurs because both fallback fields default independently to the same error code. The generic prose is keyed from `session.error` and is not evidence that actionable `issues` were received.

## 3. Complete production request lifecycle

“ID exists” distinguishes the proposed client ID from the current server ID. Today there is no client request ID; the server ID first exists inside the handler.

| Boundary | Exact function and file | Expected input → output | Possible rejection / current safe result | ID exists? |
|---|---|---|---|---|
| Run control | `renderReview()` in `persona-journey-simulator.js` | Valid Review state → enabled button calling `runSimulation` | Disabled for invalid selection or incomplete assets; no request | No |
| Browser event | button callback → `runSimulation()` in `persona-journey-simulator.js` | click + session/options → local validation | Returns if invalid/already running; `access_changed`, `brand_context_changed`, `selected_node_missing`, `stage_mapping_changed`, or `selected_node_incomplete` locally | No server ID |
| Request builder | `buildRequest()` in `persona-journey-simulator.js` | current Board/run context + selection → plain request object | Property access may throw; no explicit builder error category | No server ID; `client_run_id` is simulation identity, not diagnostic ID |
| Serialization | `JSON.stringify(body)` in `runSimulation()` | request object → UTF-8 JSON string | Circular/BigInt/getter failure throws; caught as `provider_failed`; undefined object fields disappear | No |
| Fetch | global `fetch()` in `runSimulation()` | relative URL + POST options → `Response` | network/CORS/abort/redirect/runtime failure; metadata is not retained | No |
| Route resolution | deployment platform | `/api/funnel-simulator/run` → serverless function | 404/405/413/500/502/504, redirect, boot failure, framework page | No application ID |
| Platform parsing | Vercel Node request adapter (inferred from layout) | JSON request bytes → `req.body` | malformed/oversize/unsupported content may be rejected before handler; exact deployed behavior unobserved | No application ID |
| Module boot | CommonJS loader for `api/funnel-simulator/run.js` | deployed bundle/dependencies/env → exported handler | missing `pg`, incompatible runtime, bundle/import/module initialization exception | No |
| Handler entry | exported `handler()` in `api/funnel-simulator/run.js` | `req`, `res` → creates `id` | none before first statements once invoked | **Yes, server ID** |
| Method/body size | `handler()` lines 17-18 | POST + parsed body → continue | 405 `method_not_allowed`; 413 `payload_too_large`, both JSON envelope | Yes |
| Contract | `validateRequest()` in `api/_funnel-simulator-contract.js` | strict plain parsed body → `{ok}` | 400 `invalid_request`, JSON envelope, phase `request_schema` | Yes |
| Authentication | `getSessionUser()` in `api/_auth-session.js` | cookies/header request → safe user | 401 `authentication_required` | Yes |
| Board access/load | `getBoardAccess()` in `api/_board-access.js` via `_boards-storage.js` | Board ID + user → Board/access | thrown/missing Board → 404 `board_changed`; non-editor/public → 403 `access_changed` | Yes |
| Canvas parsing | `validateCanvasContext()` in `api/_ai-brain-canvas-context.js` | submitted nodes/edges → normalized Canvas | mapped reply; note `stale_context` is absent from `SAFE_CODES` and is reduced to `configuration_invalid` | Yes |
| Authorized context | `validateCanvasContext()` for saved `board.canvas_json` | stored Canvas → normalized authoritative Canvas | 409 `canvas_context_changed` | Yes |
| Target groups | `projectTargetGroups()` then `evaluateConfiguration()` in `_funnel-simulator-contract.js` | Brand Core + references → resolved groups | actionable 409 `configuration_invalid`, usually `target_group_unresolved` classification | Yes |
| Stages/nodes/readiness | `evaluateConfiguration()`, `mapNodeStage()`, `projectNode()`, `assetReadiness()` | ordered stage records + nodes → runnable evaluation/node map | actionable configuration issue: missing, incomplete, mapping, order/mode/selection | Yes |
| Provider preflight | handler line 32 | `OPENAI_API_KEY` → continue | 503 `simulation_unavailable` | Yes |
| Provider request | `callProvider()` in `api/_funnel-simulator.js` | groups/nodes/stages/language → one OpenAI Responses request | fetch error/timeout → `provider_unavailable`; 4xx → `provider_rejected`; 5xx → unavailable | Yes |
| Provider parsing | `response.json()`, `outputText()`, `JSON.parse()` in `_funnel-simulator.js` | provider response → candidate object | `response_invalid` | Yes |
| Provider validation | `validateProviderOutput()` | exact compact object → validated result | 502 `response_language_mismatch` or `response_invalid` | Yes (one compatibility branch calls `reply()` without `base`, producing a new ID rather than preserving the original) |
| Endpoint response | `reply()` or success `res.status().json()` | safe envelope/result → HTTP JSON | platform may still replace response on crash/timeout | Yes for application responses |
| Browser parsing | unconditional `response.json()` in `runSimulation()` | `Response` → parsed value | HTML/text/empty/malformed JSON throws; status/content type/body lost | Only if parsed and subsequently preserved |
| UI transition | non-2xx branches/catch in `runSimulation()`, then `renderReview()` | parsed result/error → configured/failed/prepared state | non-actionable server envelope is discarded; generic configuration prose; `UNKNOWN` substituted | Often lost |

## 4. Route and deployment audit

### Route contract

- **URL:** the source uses relative `/api/funnel-simulator/run`; on the deployed origin this resolves to that origin and path.
- **Method:** `POST`.
- **Deployment:** `vercel.json` has only Board SPA rewrites. Vercel-style filesystem routing is strongly indicated by the repository, but no deployment manifest/output was supplied. Nested routes demonstrably exist in source (`api/documents/processing/run.js`, `api/boards/[id]/editors/index.js`) and are relied upon elsewhere.
- **Module/export:** `package.json` has no `type`, so `.js` is CommonJS. The route uses `require()` and `module.exports = async function handler`, matching authenticated routes `api/boards/index.js` and `api/brands/[id].js`.
- **Headers/body:** client sends `Content-Type: application/json`; it does not send `Accept`. It does not set `credentials`, so Fetch defaults to `same-origin` and sends same-origin cookies. The handler assumes `req.body` is already parsed and does not parse strings or streams.
- **Size:** application limit is 65,536 bytes, computed by re-stringifying parsed `req.body`. Full Canvas nodes and edges make size unbounded at the builder. A platform limit can reject before the handler; the application check cannot diagnose that. Conversely, a string body is re-stringified and then rejected by `validateRequest`.
- **CORS:** same-origin relative fetch normally avoids CORS. A redirect to another origin could change that; no capture exists.

### Comparison with authenticated routes

| Property | Funnel `api/funnel-simulator/run.js` | Boards `api/boards/index.js` | Brand `api/brands/[id].js` |
|---|---|---|---|
| Format/export | CommonJS, exported async handler | Same | Same |
| Nested filesystem route | two path segments | nested `boards/index` | dynamic nested route |
| Authentication | `getSessionUser(req)` after request validation | same helper, branch-dependent | same helper before DB work |
| Storage | transitive `_board-access` → `_boards-storage` → `pg` | imports `_boards-storage` directly | imports `_brands-storage` → `pg` |
| Parsed body assumption | yes | yes for POST | yes for PUT |
| Import-time DB object | `Pool` created transitively | `Pool` created directly | `Pool` created transitively |
| Response API | `res.status().json()` | same | same |

The nested path and handler style are therefore not anomalous. This lowers—but does not eliminate—the likelihood of unsupported nesting/export mismatch. “Other routes work” would also show that CommonJS, `pg`, and the broad serverless layout can boot, but it would not prove this function's bundle or exact path works.

### Pre-handler response possibilities

A platform can produce redirect/404 (route not found), 405 (platform method policy), 413 (platform request limit), 500/502 (module boot or infrastructure), or 504 (timeout) before application JSON exists. HTML, text, or empty bodies cause `response.json()` to throw. Even a platform JSON body is collapsed unless it happens to contain the fields the client expects. All such failures currently converge on a generic catch category (usually `provider_failed`, or the thrown parser's missing code); an application `invalid_request` converges specifically to the observed duplicated `invalid_request` while losing metadata.

### Meaning of `Request UNKNOWN`

It establishes that the catch block did not retain a recognized `requestId`. It does **not** establish why. Three paths suffice:

1. no handler envelope existed (route/platform/import rejection);
2. an envelope existed but JSON parsing failed/replacement occurred;
3. an envelope parsed successfully, but the non-2xx branch threw only `{code}` and discarded it—the exact behavior for endpoint `invalid_request`.

## 5. Actual browser request audit

### Fetch options

```text
URL:         /api/funnel-simulator/run
method:      POST
credentials: omitted (Fetch default: same-origin)
headers:     Content-Type: application/json
Accept:      omitted (browser default, typically */*)
signal:      session AbortController signal
body:        JSON.stringify(buildRequest(...))
```

### Exact serialized contract

Top-level keys, in builder insertion order:

1. `board_id`
2. `response_language` (`en` or `de`; this is interface/run language)
3. `board_revision` (still sent, although endpoint no longer compares it)
4. `canvas_context`
5. `configuration`
6. `client_run_id`
7. `configuration_fingerprint`
8. `stage_mapping_version` (`bw28-v1`)

Nested keys:

- `canvas_context`: `revision`, `saved_state`, `nodes`, `edges`.
- `configuration`: `target_groups`, `stages`.
- Brand Core target group: exactly `kind`, `source_id`.
- Custom target group: exactly `kind`, `client_id`, `name`, `description`.
- Stage: exactly `stage`, `mode`, `node_ids`.

The client sends the **entire current Canvas node and edge arrays**, including full selected and unselected asset content and client display/storage fields. The request has no client-side byte bound. The server request schema allows arbitrary node/edge members because it validates the outer arrays here and delegates Canvas normalization later, but its strict top-level/config/group/stage key checks reject any unknown keys. Full Canvas transmission is unnecessary for saved Boards because the endpoint subsequently loads and uses `board.canvas_json`; it is currently used for unsaved state.

The builder constructs ordinary object/array wrappers, but inserts `current.canvasContext.nodes` and `.edges` by reference. Therefore functions and `undefined` properties disappear during JSON serialization; `Set`/`Map` become `{}`; Dates use `toJSON`; prototype-bearing objects serialize enumerable properties; BigInt and circular references throw; getters/toJSON can execute or throw. No DOM object is intentionally inserted, but nothing in the builder deep-projects nodes to prevent one. `JSON.stringify` is inside `try`, so errors are caught, but mislabeled by the generic error fallback.

### Sanitized expected JSON for the observed four-stage setup

This illustrates the exact shape, not captured production bytes. Private content is replaced with neutral placeholders; real `nodes` contain considerably more fields/content.

```json
{
  "board_id": "00000000-0000-4000-8000-000000000001",
  "response_language": "en",
  "board_revision": "2026-09-01T00:00:00.000Z",
  "canvas_context": {
    "revision": "sanitized-canvas-revision",
    "saved_state": "saved",
    "nodes": [
      { "id": "asset-awareness", "type": "Content", "title": "Awareness asset", "content": "[sanitized]", "campaignStage": "Awareness" },
      { "id": "asset-interest", "type": "Content", "title": "Interest asset", "content": "[sanitized]", "campaignStage": "Interest" },
      { "id": "asset-consideration", "type": "Campaign Variation", "title": "Consideration asset", "content": "[sanitized]", "campaignStage": "Consideration" },
      { "id": "asset-conversion", "type": "Landing Page", "title": "Conversion asset", "content": "[sanitized]", "campaignStage": "Conversion" }
    ],
    "edges": []
  },
  "configuration": {
    "target_groups": [
      { "kind": "brand_core", "source_id": "board-persona:0123456789abcdef" }
    ],
    "stages": [
      { "stage": "Awareness", "mode": "assets", "node_ids": ["asset-awareness"] },
      { "stage": "Interest", "mode": "assets", "node_ids": ["asset-interest"] },
      { "stage": "Consideration", "mode": "assets", "node_ids": ["asset-consideration"] },
      { "stage": "Conversion", "mode": "assets", "node_ids": ["asset-conversion"] }
    ]
  },
  "client_run_id": "123e4567-e89b-42d3-a456-426614174000",
  "configuration_fingerprint": "0123456789abcdef",
  "stage_mapping_version": "bw28-v1"
}
```

The validator additionally requires a nonempty string/number Board revision and Canvas revision, valid language/version, UUID-shaped run ID, fingerprint text, 1–3 exact target group records, 2–5 strictly canonical ordered stages, assets/gap consistency, no duplicate node IDs, at most two nodes per stage/eight total, and exact allowed outer keys. It returns only `{ok:false, code:'invalid_request'}` without a field path. Hence any deployed context difference (for example an undefined revision that disappears, a non-UUID run fallback, or an added client field) becomes non-actionable `invalid_request` before authentication.

## 6. Response parsing and fallback audit

The client executes `await response.json()` immediately and exactly once. It does not inspect `response.status`, `response.headers.get('content-type')`, `response.redirected`, or a text fallback. The body is not consumed twice.

| Response | Current result |
|---|---|
| Valid success JSON, 2xx | client strict result validation, then render |
| Valid JSON error with actionable blocking `issues` | preserves `code`, `classification`, camel-case `requestId`; returns to affected step and focuses node/panel |
| Valid JSON `configuration_invalid` without issues | throws with attached response; catch preserves envelope and reports `execution_contract_mismatch` as primary error |
| Any other valid JSON non-2xx, including endpoint `invalid_request` | throws with only `data.code`; loses classification, requestId, diagnostics, status, content type |
| HTML/plain text/empty/malformed body at any status | `response.json()` throws; status/content type/body lost |
| 404/405/413/500/502/504 JSON | treated according to above; there is no status-based classification |
| Network failure | generic catch; no response metadata |
| Abort | silently returns, potentially leaving lifecycle presentation dependent on surrounding state |

Server/client field spelling agrees on `requestId`; there is no current `request_id` mismatch in the HTTP envelope (snake case appears only in logs). `classification`, `code`, and `issues` are at the top level and the actionable branch reads them there. The bug is selective retention, not nesting. A genuine provider code is preserved as `session.error`, but its server envelope is discarded in the usual non-issue branch. Unexpected platform responses are not reliably called configuration errors internally, but `errorMessage()` falls back to the same configuration instruction, making them *look* like configuration failures.

Nothing is highlighted because highlighting/focus requires at least one `blocking === true` issue. The generic prose is rendered even when `session.issues` is empty, so its assertion is false.

### Correct future fallback classification model (definition only)

Classification must use observed transport facts first, then a trusted application envelope:

| Classification | Exact trigger |
|---|---|
| `route_unavailable` | same-origin 404/405/redirected route response with no server request ID, or network route resolution failure |
| `request_rejected` | 400/405/422 framework/application rejection not matching configuration issues; malformed request/body/content type |
| `authentication_failed` | trusted handler envelope/HTTP 401 |
| `access_denied` | trusted handler envelope/HTTP 403 (404 masking may remain intentionally opaque) |
| `payload_too_large` | HTTP 413, whether platform or application |
| `configuration_invalid` | trusted actionable configuration issues after authentication/access/context resolution |
| `provider_unavailable` | trusted phase at/after `provider_called`, safe 5xx/unavailable category |
| `provider_request_rejected` | trusted provider 4xx category; never infer from browser-to-endpoint 4xx |
| `provider_response_invalid` | trusted phase after response receipt and compact validation failure |
| `request_timeout` | browser abort timeout, platform 504, or trusted endpoint timeout |
| `unexpected_server_response` | non-JSON, empty, incompatible JSON, unexpected content type/status, or unclassified 5xx |

Never infer a provider classification without a server ID and phase proving the provider boundary was reached.

## 7. Import graph and import-time risks

```text
api/funnel-simulator/run.js
├─ ../_auth-session
│  └─ node:crypto
├─ ../_board-access
│  └─ ./_boards-storage
│     └─ pg (Pool constructed at module scope with POSTGRES_URL)
├─ ../_ai-brain-canvas-context
├─ ../_funnel-simulator-contract
├─ ../_funnel-simulator
│  └─ ./_funnel-simulator-contract (cached)
└─ node:crypto
```

There is no provider SDK import: provider transport uses the Node global `fetch`. `OPENAI_API_KEY` and `OPENAI_FUNNEL_SIMULATOR_MODEL` are read only during handler/provider execution, not module load. `AUTH_SECRET`/`SESSION_SECRET` are read when authentication functions execute. `POSTGRES_URL` is read during module loading to construct `new Pool(...)`; construction is an initialization side effect even though a connection normally occurs later.

| Import/boundary | Clean CI availability | Production availability | BW regressions | Actually executed there | Can fail before handler ID? |
|---|---|---|---|---|---|
| Node `crypto`, Buffer, AbortController | expected on supported Node | expected, runtime version unrecorded | real | yes | low; incompatible runtime could |
| `_auth-session` | repository file | bundled file | **mocked** for handler tests | real module may be resolved before cache replacement, but exported behavior replaced | real syntax/import failure yes; secrets read later |
| `_board-access` | repository file | bundled file | **mocked in cache** | no real access logic in route tests | yes through its imports |
| `_boards-storage` | repository file | bundled plus `pg` dependency | deliberately bypassed; loader throws if `pg` is requested | no | yes: missing/bundling/module initialization; DB connection failures usually later |
| `pg` | declared dependency, installed in current tree | deployment install required | explicitly prohibited in BW-29.3/3.4/3.5 route tests | no | yes if absent/incompatible |
| Canvas context helper | repository file | bundled | real | yes | syntax/module side effects could |
| simulator contract | repository file | bundled | real | yes | syntax/module initialization could |
| simulator/provider helper | repository file; no SDK | bundled; requires global fetch at call time | real validator; transport mocked | module yes, real network no | import failure yes; fetch absence only at invocation |
| environment secrets | fixtures set provider key | deployment configuration unknown | fake key/session/access | only fake runtime branches | `POSTGRES_URL` feeds Pool at load; other variables do not throw at load in audited code |

The regressions explicitly bypass the import/runtime boundary production executes: they seed `require.cache` for `_board-access` before requiring the route and assert that `pg` is never loaded. This proves isolation of the fixture, not production storage boot. CommonJS cache mocking also means the real authentication/access/storage dependency graph and initialization order are not tested.

## 8. Test-realism matrix

| Regression | Production code actually executed | Mocks/substitutions | Real route/export loaded? | Serialized browser body? | HTTP/platform boundary? | Failure classes it cannot detect |
|---|---|---|---|---|---|---|
| BW-29.3 | client/contract/provider validators; CommonJS route invoked in process | auth/access cache, Board fixture, `callProvider`; `pg` blocked | yes / called directly | fixture is validated; not transported | no; pre-parsed `req.body`, fake `res` | routing, boot with storage, cookies, parser/limits, headers/content type, network, deployment env, real DB/provider |
| BW-29.3.2 | contract functions; mostly source-string assertions | no route execution | source read only | constructed fixture only | no | all route/runtime/transport failures |
| BW-29.3.3 | provider helper and validators; source assertions | global provider `fetch` fixture | no handler invocation | `buildRequest` presence asserted, not transported | no | endpoint routing/auth/storage/body parsing/client response parsing |
| BW-29.3.4 | real builder, validator, handler, client result validator | auth/access cache, stored Board, global provider fetch; `pg` blocked | yes / direct call | yes, but passed as object (not JSON bytes through parser) | no | platform route/parser/size/content type/cookies; import/storage/DB/provider network; browser error parsing |
| BW-29.3.5 | same plus JSON stringify/parse parity and error envelopes | same cache mocks and provider fixture; `pg` blocked | yes / direct call | yes, local stringify/parse | no | deployed route and boot, platform parsing, auth cookie, real access/DB/provider, response headers/non-JSON/status fallback |

Authentication, Board access, storage, and provider transport are never real together in these regressions. Response objects expose only `status()` and `json()`; no content type exists. Import-time storage failures are intentionally made impossible. BW-29.3.5 proves that *its fixture* serializes into a request accepted by the validator and that an in-process fixture can return 200. A fixture returning HTTP-like 200 does not prove that a deployed URL is discoverable, executable, authenticated, parsed, connected to storage, or able to return JSON over HTTP.

These are valuable deterministic contract tests. Calling them deployed-route E2E tests would be inaccurate.

## 9. Essential versus accidental complexity

### Essential product complexity

- select one or more target groups;
- select at least two ordered journey stages;
- select one usable asset for each non-gap stage;
- authorize the Board and resolve current content;
- make one bounded provider request;
- validate a strict but compact result; and
- render synthetic Personas and their journey with honest disclosure.

### Accidental implementation complexity

- client and server independently project Brand Core target groups and Canvas nodes;
- source IDs, configuration fingerprints, lifecycle identity, review identity, Board revision, Canvas revision, saved state, and run ID overlap without one diagnostic correlation ID;
- exact snapshot/content comparisons and multiple identity algorithms have evolved across regressions;
- client readiness and server readiness can disagree;
- the browser ships a large authoritative-looking Canvas projection that the saved path then replaces;
- strict exact-key request schemas enforce client display/lifecycle details beyond product requirements and return no failing path;
- a large strict provider schema plus a legacy compatibility validator creates two output architectures inside one endpoint;
- a broad allowlist/mapping/fallback vocabulary obscures transport versus configuration failures;
- regression-only cache mocks avoid the production storage/import boundary;
- persistence/revision/lifecycle details unrelated to one read-only saved-Board run enlarge the contract.

**Answer:** the feature is not too complex; its execution contract is. Complexity should be removed, not met with a second simulator architecture.

## 10. Most likely root-cause ranking with evidence

This is an evidence-weighted hypothesis ranking, not a production finding:

1. **Handler request-contract rejection followed by client envelope loss.** Exact endpoint code emits `invalid_request` at the strict schema boundary; exact client code then discards that response and yields `invalid_request · invalid_request · UNKNOWN`. The visible string matches this path precisely. Unknown production values/omitted fields and full Canvas serialization remain possible differences from the fixture.
2. **Non-JSON or otherwise unexpected platform response before/around handler execution.** Unconditional JSON parsing loses all metadata. This explains `UNKNOWN`, but by itself less directly explains why the primary code is specifically `invalid_request` unless the platform JSON/parser error supplies that code or another client path did.
3. **Platform body rejection/size or body representation mismatch.** Full Canvas is unbounded, application size checking occurs after platform parsing, and the handler assumes a parsed plain object. Could yield 413/platform output or handler schema rejection.
4. **Import-time storage/dependency failure.** Production loads `_board-access` → `_boards-storage` → `pg`, while regressions explicitly bypass it. Plausible pre-handler 500/502; less consistent with a specific `invalid_request` unless the platform response maps that way.
5. **Route/export/nested routing failure.** Possible without a capture, but reduced by matching CommonJS exports and many existing nested routes.
6. **Authentication/access/configuration failure after contract validation.** Authentication/access have distinct endpoint codes; actionable configuration normally includes issues and request ID. Client loss can still hide envelopes, but neither naturally produces the exact primary `invalid_request`.
7. **Provider or provider response failure.** There is no evidence the provider was called, and endpoint provider branches use distinct codes. This is least supported by the observed classification.

## 11. Missing evidence required for certainty

Capture one failing production run with:

- Network request final URL, method, redirect chain, request headers, cookie presence (not cookie values), and request byte size;
- exact sanitized top-level/nested key inventory and types after JSON serialization;
- response status, content type, content length, and body category plus sanitized safe envelope;
- deployed function invocation log and first/last safe phase correlated to a request ID;
- deployment build/function logs showing route inclusion, runtime version, dependency bundling, and import errors;
- safe authentication/access phase flags (never identity data);
- provider invocation status category and timeout/response-validation phase, without prompts/tokens/content;
- deployed commit SHA and deployment configuration/environment-presence booleans.

Without these, questions 4–14 have the honest answer “not determined by available evidence.”

## 12. Safe production diagnostic contract

The next PR should temporarily instrument, not redesign:

1. Browser creates a random, bounded opaque `clientRequestId` (for example 16 uppercase hex characters).
2. It sends `X-Funklix-Request-ID: <clientRequestId>` and retains it locally.
3. At the **first handler line**, endpoint creates a distinct `serverRequestId` before method/body/auth work.
4. Every application response echoes both IDs in headers and JSON where possible.
5. A single safe `phase` advances monotonically through:
   - `handler_entered`
   - `body_parsed`
   - `authenticated`
   - `access_verified`
   - `context_loaded`
   - `configuration_resolved`
   - `provider_called`
   - `provider_response_received`
   - `response_validated`
   - `completed`
6. Browser records status, content type, redirected flag, body category (`json`, `html`, `text`, `empty`, `unreadable`), echoed client ID, server ID, safe code/classification, and phase **before** choosing UI copy.
7. Parsing reads the body once as bounded text, then parses JSON conditionally; raw content is not displayed or logged.
8. No prompts, Board content, asset content, tokens, cookies, emails, names, provider bodies, exception messages, stack traces, or secrets are exposed.

If no `serverRequestId` is returned, classify the failure as outside the application handler (or as an application response lost/replaced after handler execution); do not call it configuration/provider failure. Platform logs correlated by the client ID are needed to distinguish those two edge cases. A returned server ID proves handler entry; its last phase locates the boundary.

## 13. Smallest reliable target architecture

One architecture, one authority:

1. Browser submits Board ID, target-group references, ordered stage tokens/modes, and selected node IDs. For genuinely unsaved nodes, use an explicit, narrowly projected exception or require save before simulation; do not submit a duplicate full Canvas by default.
2. Endpoint authenticates and verifies edit access.
3. Endpoint loads the current authorized Brand Core and Canvas.
4. Endpoint resolves target-group and node IDs and derives titles/content/stages/readiness server-side.
5. Minimal product validation: at least one target group; at least two ordered stages; one eligible usable asset per non-gap stage.
6. Endpoint makes exactly one bounded provider request.
7. Endpoint validates one compact response contract.
8. Browser renders the result and never treats its projection as authoritative.

Board revision, Canvas snapshot, detailed asset content, readiness projections, and display fields should not cross the request boundary unless a documented product requirement requires optimistic concurrency or unsaved simulation. Current evidence does not show they are required for a saved read-only run.

## 14. Focused corrective implementation plan

Do not change all layers simultaneously.

### Diagnostic PR (first and only immediate step)

- Add the safe correlation/phase contract from section 12.
- Correct browser response capture so status/content type/body category and parsed envelopes survive every error branch.
- Add a deployed-route smoke probe or post-deploy check that uses a safe authenticated test Board; keep provider invocation optional/stubbed only in a dedicated deployment environment.
- Deploy, execute exactly one reproduction, and select one outcome below from evidence.

### Outcome-specific follow-up

- **A — Handler never executes:** fix only the proven route/export/import-time dependency/runtime/method/platform body-size cause. Confirm first-line server ID before touching validation.
- **B — Handler executes; body validation fails:** report the exact safe validation path; align serialization or simplify to references-only. Prefer removing duplicate Canvas/Brand projections.
- **C — Authentication/access fails:** correct same-origin credentials/session parsing or actual authorization lookup without weakening access control or revealing Board existence.
- **D — Configuration resolution fails:** resolve submitted references against current authorized server data and return exact actionable target-group/stage/node issues.
- **E — Provider fails:** preserve provider-specific safe category and Retry; do not label it configuration invalid.
- **F — Provider succeeds; response validation fails:** record only the safe rejected field/path and reduce/correct that compact schema; do not loosen unrelated request/auth logic.

## 15. Files likely affected by a future corrective PR

Depending on the proven outcome, the smallest likely set is:

- `persona-journey-simulator.js` — diagnostic header and lossless status/content-type/one-pass response classification;
- `api/funnel-simulator/run.js` — first-line ID, phase echo, and outcome-specific fix;
- `api/_funnel-simulator-contract.js` — only for proven Outcome B/D simplification;
- `api/_funnel-simulator.js` — only for proven Outcome E/F;
- deployment configuration or dependency metadata — only for proven Outcome A;
- one focused regression and, preferably, an actual deployed HTTP smoke check.

This audit changes none of them.

## 16. Files that must remain unchanged

For this BW-29.4 audit, all production code, tests, `package.json`, workflow files, and deployment configuration must remain unchanged. The sole changed file is this document. In the corrective PR, unrelated calculator/simulator architecture, persistence/autosave, Canvas mutation, AI Brain, language/theme, and unrelated API routes should remain unchanged.

## 17. Regression plan for the future corrective PR

1. Unit-test one-pass parsing for JSON, HTML, text, and empty bodies.
2. Matrix-test 404, 405, 400, 401, 403, 413, 500, 502, and 504 with status/content type retained.
3. Verify every parsed endpoint error retains `requestId`, phase, code, classification, and actionable issues.
4. Verify no-server-ID responses never become configuration/provider errors.
5. Serialize the actual production builder and assert byte size/key/type inventory.
6. Load the real route in a clean child process **without** `require.cache` substitutions, proving `pg` and all imports boot.
7. Exercise a local HTTP adapter with raw JSON bytes, cookie authentication, real parser behavior, and actual response headers—not a direct handler call alone.
8. Exercise authorized Board storage against an isolated database fixture; mock only external provider transport at that layer.
9. Test provider 4xx, 5xx, timeout, malformed JSON, and strict output rejection with phase transitions.
10. Add a post-deployment request that proves route resolution/handler entry and captures only safe diagnostics.
11. Retain existing BW-29.3–29.3.5 contract regressions, but label them accurately and do not treat fixture 200 as reachability proof.

## 18. Go/no-go criteria

### Go for an outcome-specific fix

- a production capture identifies final URL/method, status, content type, body category, and request byte size;
- either a server request ID proves handler entry and last safe phase, or platform logs prove failure before entry;
- deployed commit/runtime/route inclusion are known;
- the selected Outcome A–F is supported by one boundary-specific artifact;
- proposed changes touch only that failing boundary plus necessary diagnostics/tests.

### No-go

- only `Request UNKNOWN` and generic UI copy are available;
- provider failure is assumed without `provider_called` evidence;
- a fixture 200 is offered as deployment proof;
- the proposal simultaneously changes routing, auth, request schema, identity resolution, provider prompt/schema, and UI fallback;
- the proposal adds a second simulator path or weakens Board authorization;
- diagnostics expose private content or secrets.

## Final audit summary

- **Was the provider demonstrably reached?** No. Available evidence stops at the browser's fallback display.
- **What does `Request UNKNOWN` prove?** Only that the browser did not retain a server request ID. It does not prove that the handler never executed; current client code can discard a valid handler envelope.
- **Do current tests exercise the real deployed HTTP boundary?** No. They are source/contract/in-process tests with parsed bodies and mocked authentication, access/storage, and provider boundaries.
- **Is the feature itself too complex?** No. The product flow is small and coherent.
- **Which complexity is accidental?** Duplicate projections and identity/readiness implementations, full Canvas submission, strict exact schemas, legacy compatibility, broad fallbacks, and production-boundary-bypassing mocks.
- **Highest-value next step:** deploy the safe client/server correlation ID and phase/status/content-type diagnostic, with lossless browser fallback parsing, before implementing any functional fix.

**AUDIT READY FOR REVIEW**
