# BW-33.3A — Canvas-density / existing-Board access regression audit

**Date:** 2026-09-10

**Scope:** documentation-only, local Git history, post-revert `6d8a272`

**Decision:** **NO-GO** for restoring BW-33.3; **GO** only for the isolated recovery design and browser gate specified below.

## Executive summary

The access presentation was misleading. BW-33.3 did not change an authentication endpoint,
Board endpoint, request URL, request headers, credential mode, server ownership comparison, or
Board persistence. Its first deterministic crossing of the Board lifecycle was the new statement
`applyCanvasDensity(state.canvasDensity)` at the start of `bootApp`, before `loadSessionUser()` and
before a route Board ID was assigned. Its access-breaking crossing was later: a successful
`GET /api/boards/:id` entered `applyCampaignState()`, whose `state.nodes.forEach(renderNode)` now
executed density-owned work inside `updateNodeCard()`. Any exception there escaped hydration into
the undifferentiated `catch` in `loadBoardFromUrlIfPresent()`, which cleared the hydrated client
state and displayed exactly the private/invalid-public-link message used for an HTTP denial.

The first density-owned statement on that failing renderer path was
`nodeEl.dataset.canvasDensity = state.canvasDensity` in `updateNodeCard`; the first new fallible
integration block was creation/insertion of `.node-critical-row`, followed by the new call across
the Content Workspace boundary (`globalThis.ContentWorkspace?.calculateReadiness?.(node)`). Local
history does **not** contain a browser exception stack or the production response record, so it
does not support inventing which expression in that block threw. It does establish the exact
first failure **boundary**: `applyCampaignState` → `renderNode` → `updateNodeCard`, after the Board
response and before `applyCampaignState` returned. This is the narrowest conclusion that is both
exact and evidence-based.

Accordingly: the server received the normal Board request with the path-resolved Board ID and the
browser's normal same-origin credentials; no changed client code could strip either. The historical
client had already parsed an OK response and started hydration when the density renderer could
fail. There is no evidence that the server rejected ownership. No write occurs on this path before
the failure, and the density implementation contained no Board write, so Board data was not
mutated. Revert removed both the premature boot hook and the renderer additions, allowing the same
successful response to finish hydration.

> Historical-object note: the task names `59753da191220fad6e0b829409813f79911ac59b`, but that object
> name is not present in this checkout's object database. The locally present BW-33.3 implementation
> is `783fda913254788d0832711bf086436dbeb89c73`, merged by `248ad2f`, and exactly reversed by
> `eb85612`. The audit uses that locally verifiable implementation and the merge/revert trees; it
> does not substitute remotely obtained material.

## Evidence method and historical diff inventory

The implementation diff (`783fda9^..783fda9`) contains 197 insertions and three deletions across
ten files. The revert is the inverse. Every changed file is accounted for here:

| File | Historical change | Runtime relevance |
|---|---|---|
| `canvas-density.js` | New 24-line IIFE module; restores `tendra.canvasDensity.v1`, validates three modes, exports `window.TendraCanvasDensity`. | Synchronous preference read during parser execution; no Board/network calls. |
| `index.html` | Added blocking `<script src="/canvas-density.js">` after `language.js` and before all feature modules and `app.js`. | Changed production script chain; a load/evaluation failure would not inherently stop later classic scripts, but an uncaught top-level error would be observable. |
| `app.js` | Captured the density global; added `state.canvasDensity`; added card dataset/critical-row work; added Utilities controls and events; added `applyCanvasDensity`; called it first in `bootApp`. | The only changes that enter boot and Board hydration. |
| `language.js` | Added density and critical-row German strings. | Data-only additions inside the existing module; no boot or identity change. |
| `styles.css` | Added density/critical-row/Utilities selectors. | Presentation only; selectors are scoped to `.node[data-canvas-density]`, `.node-critical-row`, or `.canvas-density-*`. |
| `package.json` | Added `check:bw33.3`. | Test command only. |
| `.github/workflows/runtime-boot-safety.yml` | Invoked `check:bw33.3` after BW-33.2R1. | CI only; did not alter application runtime. |
| `scripts/check-bw33-3-canvas-density.js` | New source/module assertions and memory-storage tests. | Did not execute the browser app boot or owner request. |
| `scripts/check-bw33-2r1-tendra-one-brand-foundation.js` | Relaxed the prohibition on Canvas-density text while retaining the Board-data prohibition. | Regression-source assertion only. |
| `docs/BW-33.3-canvas-density.md` | Added intended visibility/storage/geometry description. | Documentation only. |

No server file, authentication file, Board API file, schema, migration, deployment setting, or
cookie implementation changed.

## Production symptom timeline

1. Before BW-33.3, an authenticated owner could reopen existing private Boards.
2. BW-33.3 deployed. Google authentication completed and the authenticated shell rendered.
3. The user selected an existing Board, providing an ID through `/boards/:id`.
4. The client displayed the pre-existing private/ownership denial presentation.
5. No transfer, recreation, ownership edit, or Board-content edit occurred.
6. Reverting only BW-33.3 immediately restored all of the same Boards.

That A/B/revert sequence establishes causality at the BW-33.3 client delta. It does not, by
itself, establish a 401/403 response; the historical catch used the same message for every thrown
exception in fetch, JSON parsing, validation-adjacent work, Brand hydration, Canvas hydration, or
rendering.

## Exact root cause and first failing boundary

### First deterministic lifecycle violation

`bootApp()` set `state.isBoardLoading = true` and immediately invoked
`applyCanvasDensity(state.canvasDensity)`. At that instant:

- `loadSessionUser()` had not run;
- `state.user` was still null;
- `getBoardIdFromPath()` had not yet been assigned to `state.currentBoardId`;
- `state.session.isInitialized` was false;
- no server Board had been resolved or hydrated;
- nevertheless the function wrote Canvas DOM datasets, iterated `state.nodes`, and scheduled
  `drawLinks`.

This is the exact first deterministic boundary at which presentation density became part of main
application boot. With the initial empty `state.nodes`, it normally does not itself throw, which is
why a visible shell and authentication can survive.

### First access-breaking boundary

After the owner-scoped response was accepted, `loadBoardFromUrlIfPresent()` called
`applyCampaignState(normalizedCanvasState, ...)`. That function assigned incoming nodes and called
`state.nodes.forEach(renderNode)`. `renderNode()` appended each node and called
`updateNodeCard(node)`. BW-33.3 made `updateNodeCard` density-aware and added cross-module readiness
and new DOM insertion work. An exception from this synchronous renderer propagated through all
three functions into `loadBoardFromUrlIfPresent()`'s broad `catch`.

The catch did not distinguish HTTP denial from renderer failure. It stopped collaboration polling,
emptied nodes and edges, removed rendered nodes, reset Brand state, removed only the legacy local
Canvas draft, and emitted:

`This Board is private or the public link is no longer valid. Sign in or return to Home/Boards.`

Thus the exact defect is **density work was placed inside the transactional Board-hydration call
stack, and the loader collapsed its render exception into the access-denial UI**. The exact first
density statement encountered is the dataset assignment in `updateNodeCard`; the exact first
fallible density integration block is the critical-row insertion/readiness calculation. Without a
preserved production stack, selecting a more granular expression would be speculation rather than
root-cause audit.

## Complete Board-loading trace

| # | Phase | Current restored flow / historical result | Changed by BW-33.3? |
|---:|---|---|---|
| 1 | Session restoration | `bootApp` awaits `loadSessionUser()`, which fetches `/api/auth/session`. | Endpoint and parsing unchanged; density ran prematurely before it. |
| 2 | Authenticated identity | `data.user` becomes `state.user`; access and auth UI render. Production confirms this succeeded. | No identity logic changed. |
| 3 | Board list retrieval | `loadBoardsLibrary()` uses `/api/boards`; row data carries `data-open-board`. | No fetch, parsing, or row selector changed. |
| 4 | Selected ID resolution | Board button/path supplies `/boards/:id`; `getBoardIdFromPath()` decodes it. | No ID code or dataset changed. |
| 5 | Owner-scoped request | `loadBoardFromUrlIfPresent()` calls `fetch('/api/boards/${boardId}', ...)`. | No route code changed. |
| 6 | Headers/credentials | `boardReadHeaders()` sends `Accept: application/json` (or a public token only for a valid fragment). Fetch credentials remain browser default `same-origin`. | Unchanged. |
| 7 | Server authentication | Session cookie is processed by the Board API. | No server/auth file changed. |
| 8 | Owner comparison | Server-owned access projection evaluates the stored owner. | No server/ownership code changed. |
| 9 | Response classification | `response.ok` gates success; only a non-OK response is explicitly thrown as load failure. | Unchanged. |
| 10 | Response parsing | `await response.json()` parses the contract. | Unchanged. |
| 11 | Hydration | Brand state then Canvas state enter `applyCampaignState`. | **Changed:** renderer now performed density work. |
| 12 | Active Board assignment | `state.currentBoardId = data.id`; runtime session sync occurs before Canvas hydration. | Unchanged and reached before the inferred render failure. |
| 13 | Canvas rendering | `state.nodes.forEach(renderNode)` → `updateNodeCard`. | **Changed and first access-breaking boundary.** |
| 14 | Inspector initialization | Normal post-load boot later calls `fillInspector(null)`. | Not reached if hydration throws; no density edit. |
| 15 | Collaboration initialization | Presence/polling starts after successful hydration; catch stops it. | No protocol change; success initialization was skipped. |
| 16 | Error presentation | One broad catch presents private/link-invalid for all failures. | Message code unchanged, but density made a new renderer failure reach it. |

## Script and initialization trace

- All tags are classic, parser-blocking scripts at the end of `body`; order was `theme.js`,
  `language.js`, **new density module**, the feature modules including `content-workspace.js`, then
  `app.js`.
- `canvas-density.js` is an IIFE. `api`, `STORAGE_KEY`, `MODES`, `DEFAULT_MODE`, `valid`, `restore`,
  `mode`, and `setMode` are function-local. It introduces no global lexical binding.
- Its sole browser-global export is `window.TendraCanvasDensity`; no existing historical export has
  that name.
- Its only top-level side effect is a guarded `localStorage.getItem`. Parse/read failures return
  Compact. It does not touch DOM, session, Board state, or network.
- There are no duplicate global `const`, `let`, `class`, or function declarations with `app.js`.
  The module-local `STORAGE_KEY` and `mode` harmlessly shadow names in other IIFEs/scripts.
- The material sequencing error is in `app.js`, not the module wrapper: `bootApp` invoked density
  before session/Board initialization and `updateNodeCard` made it part of hydration.
- The new script did change the script-tag inventory. Any integrity policy enumerating exact scripts
  needed an update, but the historical integrity regression merely accepted its presence; no
  evidence shows an integrity rejection caused this incident.
- A density-module load failure would leave `canvasDensityPreference` undefined and app fallback
  Compact; a top-level evaluation error would be reported independently. Neither explains the
  Board-specific post-response symptom as well as the synchronous hydration boundary.

Yes: the implementation could leave enough UI to show a misleading denial. Static HTML and the
already-restored auth shell existed before Board hydration; the broad catch itself rendered the
message after discarding partial Canvas state.

## Storage analysis — `tendra.canvasDensity.v1`

The module performs only exact-key `getItem` and `setItem` operations. The value is a small JSON
object `{version:1, mode}` and malformed/missing values resolve in memory to Compact. Searches of
the current and historical relevant sources found no `localStorage.length`, `localStorage.key`,
`Object.keys(localStorage)`, broad `tendra.` prefix parser, generic storage event handler, or cleanup
loop that would consume it.

Consequently the key cannot be interpreted as:

- `campaignCanvasState`, a Board selection, or active Board ID;
- a Workspace/Brand selection (`funklix.workspace-brand.v1.<identity>` is exact/scoped);
- authenticated identity or session state;
- an autosave source;
- a cross-tab Board signal;
- a migration/cleanup target.

There was no `storage` event listener added. The module writes only when the user selects a density,
not during restore. The key is isolated from Board payload serialization. Storage is excluded as the
cause.

## State, global, and naming-collision analysis

| Candidate | Finding |
|---|---|
| `currentBoard`, `activeBoard`, `selectedBoard`, `boardOwner` | Not introduced. No collision. |
| `currentBoardId`, `currentUser`, `session`, `workspace` | Not introduced or reassigned by density. Existing state is merely encountered too early at boot. |
| `canvas`, `canvasState`, `node`, `nodes` | No new browser globals. Local callback `node` is ordinary function scope. `state.nodes` is iterated, not assigned, by `applyCanvasDensity`. |
| `mode`, `viewMode`, `density` | Module `mode` is IIFE-local. `state.canvasDensity` is a new, distinct property. Local `mode` in `applyCanvasDensity` is harmless. |
| `render`, `renderCanvas`, `drawLinks` | No declaration collision. Density newly schedules the existing `drawLinks`, including before Board resolution. |
| `loadBoard`, `openBoard`, `saveBoard` | Not declared or called by the module. |
| `STORAGE_KEY` | The density constant is factory-local; `app.js`'s global lexical constant remains `campaignCanvasState`. Harmless shadowing. |
| DOM IDs | None introduced. |
| CSS classes | `.canvas-density-control`, `.canvas-density-options`, `.node-critical-row` are new and specific. |
| Data attributes | `data-canvas-density` and `data-density-choice` are new. Neither is used by Board navigation. |
| Events | No custom event name or global handler added. Utilities gained local `click` and `keydown` handling. |
| Browser globals | Only `TendraCanvasDensity`; uniquely named, but future code should use one application namespace rather than another top-level name. |

The dangerous coupling is therefore lifecycle/call-stack ownership, not identifier collision.

## DOM and event ownership analysis

The Utilities popover gained a density group inside the same generated popover. Its click delegate
checks `button[data-density-choice]` before `button[data-utility-action]`, closes after a selection,
and returns. Keyboard handling is attached only to that popover. It neither stops propagation nor
captures pointer events outside the popover. Board rows continue to use `data-open-board`; density
uses `data-density-choice`. There is no selector overlap.

No Canvas overlay, routing link, Board-card DOM, modal, ownership dialog, authentication element,
loading overlay, z-index, or pointer-events rule changed. Density CSS requires either a `.node`
with `data-canvas-density`, `.node-critical-row`, or `.canvas-density-*`. It cannot match generic
`data-mode` or `data-id` elements, Board-library cards, navigation items, or dialogs. DOM click
interception is excluded.

## Renderer analysis

Compact was applied before an active Board existed. At cold boot `state.nodes` was empty, so the
iteration did not mutate Board state, but `requestAnimationFrame(drawLinks)` was unnecessarily
scheduled against an unresolved Canvas. During successful Board hydration, every `renderNode`
called the modified `updateNodeCard`; the critical-row logic queried approval state, called Content
Workspace readiness, computed schedule/platform priority, and mutated card DOM. That work was not
presentation-isolated because it executed inside the loader's try/catch transaction.

No density code assigns `currentBoardId`, `selectedPrimary`, nodes, edges, positions, lifecycle
generation, owner, or user. It does not reconcile selection. The observed state clearing is the
loader catch's recovery behavior after an exception, not density intentionally clearing identity.
The subsequent generic boot render/Inspector/collaboration initialization was skipped or operated
on the cleared state.

## Network-boundary result

A bounded production-shaped comparison derived from the unchanged fetch/loader contract gives:

| Category | Current post-revert | Historical BW-33.3 failing path |
|---|---|---|
| session | present | present (production-confirmed) |
| authenticated user ID match | owner-match category | same input category |
| requested Board ID | present, path-derived | present, same unchanged resolver |
| credentials mode | default same-origin | unchanged default same-origin |
| request route | `GET /api/boards/:id` | identical |
| HTTP category | 2xx fixture | no code evidence of non-2xx; successful-response path reaches new failure |
| response contract | JSON, valid ID/access/canvas | parsed JSON; no contract edit |
| server Board resolution | resolved | no server delta; resolved path required for hydration |
| server owner match | match | no ownership delta; no evidence of server rejection |
| hydration started | yes | yes |
| hydration completed | yes | no |
| first client exception phase | none | Canvas render (`applyCampaignState`/`renderNode`/`updateNodeCard`) |
| final UI category | Board visible | generic private/invalid-link fallback |

No content, tokens, cookie values, complete identifiers, or personal data are required for this
comparison. Because local history contains no captured production HAR/server log/exception stack,
the HTTP and owner categories for the actual historical request cannot be independently replayed;
the conclusion relies on unchanged request/server code plus the only newly introduced caught
failure path and the decisive revert result.

### Required answers

- **Did the server receive a Board request?** Yes; the failure boundary is after the unchanged
  `fetch` and response parse on the hydration path.
- **Correct ID and credentials?** Yes: the unchanged path resolver supplied the selected ID and
  default same-origin fetch supplied the authenticated cookie. BW-33.3 supplied neither override.
- **Did the server reject ownership?** No evidence of that, and no relevant server code changed;
  the causal changed path is post-response client rendering.
- **Was the UI authoritative?** No. It was a misleading fallback shared by HTTP, parse, hydration,
  and render failures.
- **Was Board data mutated?** No. The failing read/hydration path has no Board write; partial client
  state was cleared, and the legacy local draft key was removed, but authoritative Board data was
  untouched.
- **Why did revert restore access?** It removed density from premature boot and from
  `updateNodeCard`, so the accepted response could complete hydration without entering the added
  fallible renderer block.

## Why Runtime Boot Safety and `check:bw33.3` passed

`check:bw33.3` required the density module directly under Node with a synthetic memory store, then
searched source text for modes, ARIA text, translations, CSS selectors, role names, hooks, forbidden
strings, and workflow ordering. It did not execute `index.html`, `app.js`, `bootApp`, a browser
global environment, DOM rendering, session restoration, an owner-scoped fetch, response parsing,
Board hydration, reload, or collaboration. Its nodes were text references rather than an existing
authenticated Board. Storage was mocked, with no pre-existing application state.

Runtime Boot Safety merely ran that script. It validated that source contained the intended pieces,
not that those pieces shared a safe runtime lifecycle. Therefore both checks could pass while the
real loader caught a renderer exception and mislabeled it as access denial.

Specifically, the historical coverage had:

- source-text assertions: **yes**;
- synthetic/memory storage: **yes**;
- real authenticated existing private Board: **no**;
- actual script-tag execution order in a browser: **no**;
- real browser globals/DOM: **no**;
- owner-scoped request and cookie: **no**;
- response classification and hydration: **no**;
- application reload/deep link: **no**;
- production-domain behavior: **no**;
- meaningful pre-existing `localStorage`: **no**.

## Minimal missing regression

The smallest useful gate is one real-browser deep-link test:

1. Seed an **existing**, non-empty private Board owned by test identity A before page launch.
2. Seed unrelated legacy local Canvas state plus a valid density preference.
3. Establish A's real application session cookie through the normal test authentication boundary.
4. Load a fresh page at `/boards/<existing-id>` so actual script tags execute in production order.
5. Record only bounded categories: session present, ID present/match, credentials mode, route, HTTP
   class, JSON-contract class, owner-match class, hydration start/complete, first exception phase,
   and final UI class.
6. Assert exactly one owner-scoped GET, 2xx, matching response ID, server owner role, completed
   hydration, `state.currentBoardId`/runtime session still equal to the route Board, existing nodes
   rendered, Inspector safe, collaboration initialization attempted, and no private/access error.
7. Reload and repeat to exercise preference/session/local state restoration.
8. Inject a density exception and assert the Board still opens; density may be disabled/logged but
   the loader must not catch it as an access failure.

That test would enter the BW-33.3 renderer path and fail under the deployed implementation, while
passing after revert. An empty or newly created Board is insufficient because it can avoid rendering
existing nodes.

## Safe reimplementation recommendation (not implemented)

1. Keep density out of `bootApp` until session restoration, Board ID resolution, successful server
   classification, contract validation, `applyCampaignState`, active Board assignment, initial
   renderer completion, and Inspector/collaboration ownership are established.
2. Export under one application namespace, for example
   `window.Tendra = window.Tendra || {}; window.Tendra.canvasDensity = ...`; introduce no top-level
   global lexical bindings. A separate classic script is safe **only** if it is a side-effect-free
   namespaced library and its absence/failure cannot reject application boot.
3. Give the preference an exact, density-only key and schema. Never enumerate or parse generic
   `tendra.*`, Board, Workspace, auth, or autosave prefixes. Do not subscribe it to Board storage
   events.
4. Make the module pure with respect to network, Board/session state, ownership, selection,
   lifecycle generations, nodes, and persistence. It may validate a preference and decorate DOM
   already owned by the Canvas renderer—nothing more.
5. Apply density only from an explicit post-hydration renderer hook after a resolved active Board's
   first render commits. Do not call `renderNode`, `updateNodeCard`, `drawLinks`, or any Board loader
   from the preference module. If geometry needs recalculation, the established renderer should
   schedule it after its own commit.
6. Put density invocation behind failure isolation outside the Board loader's access/error catch.
   A density exception must degrade to Standard/Detailed presentation and must not clear Board state
   or alter the access message.
7. Split response errors from hydration/render errors. Only authoritative 401/403/404 response
   contracts may select ownership/private UI; parse, contract, hydration, and render exceptions need
   distinct bounded categories.
8. Require the real-browser existing-private-Board deep-link/reload test above before rollout.

## GO / NO-GO

**NO-GO:** do not restore, cherry-pick, or partially apply BW-33.3. Do not accept another density
implementation that runs before session/Board initialization, participates in the Board-loader
try/catch, calls rendering before successful hydration, shares generic storage logic, or is covered
only by source assertions.

**GO (future, separate task):** a namespaced, side-effect-free preference library plus an explicitly
post-hydration Canvas decoration hook, isolated from access classification and proven by a genuine
real-browser existing-owner-Board deep-link/reload regression. A separate script remains safe only
under those constraints; script separation alone is not isolation.
