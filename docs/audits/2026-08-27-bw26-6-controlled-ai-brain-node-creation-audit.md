# BW-26.6 audit — controlled Canvas node creation from AI Brain

**Date:** 2026-08-27
**Scope:** implementation audit only; no production behavior, prompt, API contract, DOM, Canvas state, or persistence changes
**Evidence baseline:** `a6b1f00` (merged BW-26.5). References are `file:line-region` and function/state names on that baseline.
**Labels:** **Confirmed** means directly observed in code/tests; **Inferred** means a consequence not explicitly guaranteed; **Recommendation** is future design; **Open** requires a product or implementation decision.

## Executive summary

- **Confirmed:** AI Brain is a deliberately isolated, ephemeral read-only client lifecycle. `state.aiBrain` contains only request/transcript state; `requestAiBrainAdvice()` sends projected context and only replaces turn fields; neither it nor `renderAiBrain()` calls Canvas mutation, dirty, save, generation, repair, storage, or autosave functions (`app.js:151, 5212-5375`). The server authenticates, re-authorizes the submitted Board, validates a bounded Canvas projection and history, and returns only `{answer, context, disclaimer}` (`api/ai-brain/advice.js:10-17,59-166`).
- **Confirmed:** `createNode()` is the lowest-risk existing creation primitive, but not a transaction or strict schema boundary. It checks edit access, generates the ID, defaults/clamps/creates/renders/selects, optionally connects a parent, logs activity, and calls local persistence (`app.js:9461-9548`). It does **not** validate `type` against `NODE_TYPES`, does not take title/body, and does not itself push an undo snapshot. Callers commonly mutate its returned object afterward. Therefore no fully safe canonical controlled-action function currently exists.
- **Recommendation:** V1 should deliberately request conversion of one successful conversation turn through a separate **proposal-only endpoint/request mode** (approach C/B), return one strictly validated optional proposal, and keep it in memory on that turn. Do not parse Markdown. Preview inline in the AI Brain turn, then use a focused modal for the complete confirmation. The server validates shape; the browser repeats validation and alone performs exactly one mutation.
- **Recommendation:** allow only `Content` in V1. It has the smallest specialized schema and downstream side-effect surface. Do not initially allow strategic nodes, social posts, landing pages, email, visual/image nodes, edges, generation, diagnostics application, or campaign repair.
- **Recommendation:** after confirmation, re-check live user/edit access/Board identity/context token; atomically claim the proposal; generate a fresh browser node ID via the existing counter; derive defaults and bounded placement in the browser; push one history snapshot; call `createNode({type: "Content", position})`; assign validated text; update the card; and invoke the existing ordinary-edit lifecycle once. A small wrapper is required because raw `createNode()` saves before post-creation field assignment and lacks strict type validation.
- **Go/no-go:** implementation is **GO only** after strict schemas/limits, one-role scope, ephemeral lifecycle, staleness token, idempotent application, authorization checks at request/render/confirm/apply, and a one-snapshot/one-dirty transition are specified and tested. It is **NO-GO** if proposals are parsed from Markdown, provider IDs/Board/coordinates/metadata are accepted, ordinary advice gains mutation capability, or existing read-only assertions are removed rather than narrowed.

## 1. Current read-only architecture

### Client lifecycle

| Concern | Confirmed implementation |
|---|---|
| Panel/navigation | Static hooks are `#ai-brain-nav-btn`, `#ai-brain-view`, and `#ai-brain-summary` (`index.html`, asserted by `scripts/check-bw26-read-only-ai-brain.js:18`). `setActiveView("ai_brain")` and `renderCampaignIntelligence()` lead to `renderAiBrain()` (`app.js:16054-16077,17014-17016`). |
| State | `state.aiBrain = {status, messages, requestId, controller, identity, error}`; no Canvas or proposal reference (`app.js:151`). Turn runtime fields are `id`, `question`, `status`, `responseLanguage`, then `answer`, `assumptions`, `meta`, or `errorCode` (`app.js:5355-5374`). |
| Eligibility/disclosure | `renderAiBrain()` offers the form only when authenticated, Board-backed, and `boardAccess.canEdit === true`; otherwise it says advice is unavailable. It displays Board, node count, selected node, saved/unsaved context, “Read-only,” and “No changes will be made” (`app.js:5344-5351`). |
| Submit/turn identity | Submit captures `responseLanguage` once from `uiLanguage`, creates an `AbortController`, monotonically increments `requestId`, captures `aiBrainIdentity()`, full request-context identity, selected ID, projection, and bounded history, and writes one pending turn (`app.js:5355-5362`). Header `X-AI-Brain-Generation` carries request identity; it is diagnostic rather than authorization (`api/ai-brain/advice.js:88`). |
| Pending/success/failure | Pending disables another request. Success requires matching request ID, protected identity, unchanged context identity, HTTP success, and matching response-language identity before updating only the turn. Failure retains the turn with an error code; abort/stale completion returns without applying (`app.js:5359-5374`). There is no explicit displayed `aborted`/`stale` status: abort is silent and context staleness becomes `failed/changed`. |
| Retry | Retry is rendered only for failed turns. It reuses the question/turn ID, resets that turn to pending, captures **current** language/context, and excludes that failed turn from history (`app.js:5321-5324,5355-5360`). Thus Retry replaces, not appends, the failed attempt. |
| History | `aiBrainConversationHistory()` selects only prior successful question/answer pairs, excludes the retried turn, takes the newest bounded set, and reports truncation (`app.js:5244-5256`). Server limits are four exchanges, 2,000 user chars, 12,000 assistant chars, 28,000 total; exact two-key objects only (`api/_ai-brain-conversation.js:3,12-31`). |
| Formatting | User questions and assumptions use `textContent`; `renderAiBrainFormattedAnswer()` constructs an allowlisted Markdown DOM without `innerHTML` for model text (`app.js:5250-5306,5315-5339`; `scripts/check-bw26-2-safe-brain-response-formatting.js:21-48`). HTML-like text remains literal. |
| Language | Request language is captured from interface language per turn; successful turn disclosure reads `turn.responseLanguage`, preserving older responses (`app.js:5217-5221,5332,5358,5367-5370`). `campaignLanguage` is absent from this lifecycle, as BW-26.5 asserts. |
| Invalidation/clearing | `invalidateAiBrainRequest()` aborts, increments generation, and clears messages. `renderAiBrain()` invalidates on protected identity mismatch; Board/session/access/selection/Canvas identity is also checked before accepting a response (`app.js:5212-5224,5257-5261,5344-5346,5364-5365`). Board load/reset paths clear Canvas and the identity mismatch clears transcript; tests assert abort plus `messages: []`. |

`aiBrainIdentity()` binds user email, current Board ID, access reason, and Board load generation (`app.js:5212-5215`). `aiBrainRequestContextIdentity()` additionally binds editability, selection, a serialized material node projection, and edges (`app.js:5222-5224`). **Inferred limitation:** it is a comparison string, not a cryptographic revision, and Brand Core details are not visibly included in the client request-context string; server context is freshly loaded for every request.

### Server lifecycle and response validation

`advice.js` rejects methods, oversized bodies, unknown request keys, missing required keys, unauthenticated users, malformed IDs/questions/languages/selected IDs/history, missing Boards, and non-edit access before provider invocation (`api/ai-brain/advice.js:10-17,59-90`). It loads authorized Board Brand Core and, only when authorized, Canonical Brand Core; validates the client Canvas projection; calculates deterministic diagnostics; and constructs the provider context (`api/ai-brain/advice.js:79-107`). Historical messages are explicitly untrusted instructions, current context overrides factual claims, and the provider is told never to edit/apply/save or emit HTML/links (`api/ai-brain/advice.js:46-56`). Output is bounded to 12,000 characters, non-empty, and checked for per-turn language before the fixed JSON response (`api/ai-brain/advice.js:15-17,137-161`).

### Exact read-only guarantees and protected tests

The boundary is structural, not merely textual: `requestAiBrainAdvice()` updates only `state.aiBrain`; projected context excludes application-only position/images; route code has no Board write; provider prompt prohibits claims; UI states read-only; and server re-authorizes edit access. Tests:

- `check-bw26-read-only-ai-brain.js`: auth/access/context provenance, prompt prohibition, unsaved/selected disclosure, invalidation, and no `saveCampaignCanvasState` in the lifecycle.
- `check-bw26-1-real-canvas-context-and-turn-lifecycle.js`: projection, pending/failed/retry/stale/abort clearing, pre-provider validation, no lifecycle save.
- `check-bw26-2-safe-brain-response-formatting.js`: DOM allowlist, literal injection payloads, language capture, ephemeral clearing, retry de-duplication, and absence of mutation/storage/generation/repair calls.
- `check-bw26-3-bounded-conversation-memory.js`: bounded exact history, current-context authority, successful-only history, no storage.
- `check-bw26-4-reference-resolution.js`: English/German reference recognition, message ordering, exact ordinal retention, clarification.
- `check-bw26-5-response-language-adherence.js`: language instruction/output check, mixed-language handling, captured identity, Retry, campaign-language separation, and no mutation/storage/review calls.

**Future assertion change:** only the broad substring assertions that prohibit every mutation anywhere in a future expanded AI Brain section must be scoped to ordinary advice/proposal/preview functions. They must remain and be supplemented with the sole confirmed-application boundary; never delete the read-only cases.

## 2. Existing Canvas node-creation paths

### Inventory

| Path | Entry and mechanism | Lifecycle/risk |
|---|---|---|
| Toolbar picker | `#add-node-btn` → `openTypePicker()` → `createNode({type})` (`app.js:16169-16175`). | Browser ID/default grid; no explicit snapshot at this call site. Edit controls are disabled in read-only mode and `createNode` checks access. |
| Canvas context menu | `#add-context-node` → picker → `createNode({type})` (`app.js:16399-16404`). | Despite captured context point, creation uses default grid; same lifecycle. |
| Connector spawn | `renderNode()` connector handle → picker/ghost → `createNode({type,position})` then `addEdge(from,new)` (`app.js:15507-15564`). | Placement from pointer is clamped by `createNode`; edge added separately; parent inheritance is not used. |
| Drag/drop image | Canvas drop → `createNode({type:"Content", position, images})` (`app.js:16881-16892`). | Browser object URLs/UUID image IDs; not suitable for provider data. |
| Initial campaign setup | `createCampaignSetup()` calls `createNode()` nine times and `addEdge()` (`app.js:9587-9620`). | Multi-node/multi-edge operation; repeatedly invokes local save. Exclude from BW-26.6. |
| Deterministic Insights suggestion | `createSuggestedNodeFromAnalysis()` creates one node, mutates strategy fields, may call several AI refinement routes, then may add an edge (`app.js:5118-5190`). | Asynchronous downstream generation; unsafe for V1 controlled action and explicitly out of scope. |
| Campaign V3 application | campaign normalization/order/position → `createNode()` loop (`app.js:10062-10379`); adapter `campaignV3CanvasAdapter.createNode()` delegates then populates many fields and audits (`app.js:11714-11778`). | Bulk, specialized schema, logs, edges, repair/generation coupling. Not reusable for one controlled node. |
| “Next step” generation | Node action requests `/api/generate-next-step`, then `createNode({type,parentId,position})`, assigns generated fields and updates UI (`app.js:15033-15078`). | Async generated content and automatic parent edge/inheritance; different trust and action model. |
| Content → social derivative | `createSocialFromContentNode()` calls `createNode("Social Media Posting")` then copies content/image fields (`app.js:14557-14572`). | Specialized generated derivative; no proposal validation. |
| Connector/card legacy child action | Card handlers call `createNode()` for child types around `app.js:15551-15559`; other legacy calls are at `app.js:16402,16887`. | All converge on `createNode`; inspect each caller when implementation lands. |
| Collaboration remote merge | Presence/refresh merge directly `state.nodes.push(remoteNode); renderNode(remoteNode)` (`app.js:2700-2740`). | Not local creation; server-origin synchronization deliberately bypasses ID/default/dirty behavior. |
| Restore/load/local draft/server hydration | `applyCampaignState()` replaces `state.nodes` with `sanitizeNodeForPersistence()` output and renders all (`app.js:7918-7951`); related load paths also replace arrays (`app.js:4791-4811,8180-8225`). | Restoration, not action creation. It accepts broad legacy node objects and normalizes status/images/owner/runtime flags; no strict unknown-key rejection. |
| Board duplication | `duplicateCurrentBoard()`/`saveBoardAsNew()` duplicate the serialized Board, not a node (`app.js:1408-1497`). | No standalone node duplication path found. |
| Import/templates/modal/inspector | **Confirmed search result:** no generic Canvas import/template node creator or inspector/modal “new node” path was found. Inspector edits selected nodes; type picker is an overlay. | Do not claim these exist. Re-audit if later baseline adds them. |

Direct local `state.nodes.push` occurs in `createNode()`; remote collaboration is the other push. Array replacement occurs in undo/load/reset/hydration. Campaign repair produces a normalized plan and applies through the campaign adapter rather than secretly writing from the advice route.

### `createNode()` behavior

- Authorization: blocks only when `boardAccess.canEdit === false` (`app.js:9462-9466`); final controlled action should require strict `=== true`, authenticated user, non-public mode, and current Board.
- ID: `node-${state.nodeCounter++}`; browser-generated and monotonic within restored state (`app.js:9478`). No server ID and no collision re-check.
- Accepted input: `{type, parentId, position, images}`. Type is not checked against `NODE_TYPES`; parent resolves only by current ID (`app.js:9461-9475`).
- Defaults/schema: complete defaults in `app.js:9477-9501`; parent inherits audience/goal/channel and social images (`app.js:9454-9459,9503-9507`).
- Placement: parent offset or `defaultGridPosition()`, then `clampNodePosition()` bounds x 40–12000/y 40–8000 (`app.js:4450-4470,9430-9475`). It has no collision search despite overlap constants at `app.js:21-24`.
- Mutation/render/selection: push, render, optional edge, single-select, inspector/list/empty/links, activity, viewport/zoom effects (`app.js:9509-9548`). Rendering is synchronous; animation/timeouts and autosave are asynchronous.
- Dirty/save: `saveCampaignCanvasState()` serializes to localStorage and misleadingly sets “Saved”; `detectDirtyFromSnapshot()` notices divergence at its one-second interval, calls `markUnsaved()`, and schedules a three-second autosave (`app.js:4827-4884,5495-5514`). `createNode()` itself does not call `markUnsaved()`.
- Undo: `pushHistorySnapshot()` retains five snapshots; `restoreLastSnapshot()` restores and marks unsaved (`app.js:4780-4811`). **Confirmed gap:** `createNode()` does not push a snapshot. Some edit gestures call snapshots elsewhere, so ordinary toolbar creation is not demonstrably undoable from this function alone.
- Logging: `console.log` plus `appendActivity("node_created", {node})`; no dedicated analytics event observed (`app.js:9537-9547`).

**Conclusion:** reuse `createNode()` behind a narrow controlled wrapper, not directly from an ordinary response and not after a broad refactor. The wrapper must prevalidate, snapshot, claim idempotency, and account for post-create content persistence. A future small option such as initial validated fields/suppress-intermediate-persist may be safer than mutating the returned object after its save, but must preserve existing callers by default.

## 3. Canonical node schema and validation

### Runtime/persisted shape

There is no central strict node schema. The baseline object is created in `createNode()` and persistence is permissive spreading (`sanitizeNodeForPersistence`, `app.js:4909-4933`). Unknown fields survive. The table distinguishes defaults from later optional extensions.

| Field | Status/source | Notes |
|---|---|---|
| `id` | Required runtime/persisted; browser | `node-${nodeCounter++}`. AI must never supply. |
| `type` | Required in practice; browser action | Eight UI types in `NODE_TYPES`; no enforcement in `createNode`. There is no separate node `role` field. Proposal should name this `node_type`, not ambiguous `role`. |
| `title`, `content` | Default `""`; persisted | Inspector/card primary text. No general max/normalizer identified. Must add proposal-specific bounds. |
| `status` | Default `Draft`; persisted | Enum: Draft, In Review, Needs Changes, Approved, Published (`app.js:53-61`); normalized by `normalizeNodeStatus()`. Provider must not control in V1. |
| `position` | Required rendering object `{x,y}`; browser | Derived/clamped after confirmation. Dimensions are not persisted on baseline nodes; card constants are 285×200. |
| `compact` | Default false; persisted | Collapsed/card presentation state; browser default only. |
| `tags`, `variants` | Default arrays | General content metadata. No provider control. |
| `contentFormat` | Default `1:1` | Generated/visual formatting; browser default. |
| `audience`, `goal`, `channel`, `funnelStage`, `tone` | Default strings | Strategy/campaign fields, optionally inherited from parent. V1 proposal should not set them. |
| `images`, `favoriteImageId`, `imagePrompt` | Default array/null/string | Image records have id/url/name/createdAt/source; sanitized at persistence. Never accept from proposal. |
| `social` | Default object | `platform`, `caption`, `hashtags`, `preview`, `scheduledAt`; later calendar fields may be added. Specialized to Social nodes. |
| `landingPage` | Default object | `headerVisualPrompt`, `headerClaim`, `problem`, `solution`, `trust`, `cta`. Specialized. |
| `reactions`, `postits` | Default object/array | Collaboration/user identity and post-it data; never provider-controlled. |
| `justConnectedAt` | Default null | Runtime/relationship visual marker; browser-derived. |
| owner fields | Optional persisted | `ownerEmail`, `ownerName`, `ownerAvatar`, normalized during persistence. Identity/auth data; never provider-controlled. |
| generated/runtime fields | Optional/transient | Generation flags/errors are explicitly deleted by sanitizer; campaign adapter adds descriptions, subtype-specific fields, and generated content (`app.js:11714-11778`). |
| timestamps/provenance | Mostly nested assets/comments/campaign data | Base node has no `createdAt`/`updatedAt`/AI provenance fields. Do not invent persisted proposal provenance in V1. Activity entries may record creation separately. |
| parent/ownership | No persisted `parentId` on base node | Parenthood is represented by `edges`; `parentId` is action input only. Suggested parent must be re-resolved and edge creation is excluded from V1. |

### Strict V1 proposal allowlist

**Recommendation (one proposal only):**

```json
{
  "proposal_id": "opaque server nonce, max 80",
  "source_turn_id": "client turn identity echoed/validated, max 80",
  "node_type": "Content",
  "title": "plain text, trimmed, 1..120 characters",
  "body": "plain text, normalized CRLF to LF, 1..4000 characters",
  "rationale": "plain text, trimmed, 0..500 characters"
}
```

These numeric limits are **recommendations**, not existing Canvas limits. Exact-key validation must reject arrays, accessors/non-plain objects, `__proto__`, `prototype`, `constructor`, unknown keys, duplicate IDs in the current in-memory lifecycle, invalid Unicode/control characters (permit newline/tab in body), and values outside bounds. Keep content as text; Markdown may be previewed only through the safe formatter, while the node stores literal content according to existing editor semantics.

Exclude `id`, `board_id`, account/access, Brand Core, `position`, dimensions, status, compact/dirty/save flags, parent/edges for V1, images/URLs, metadata, ownership, generation flags, executable HTML/event handlers, and hidden instructions. `suggested_parent_id` is rejected for V1 because Content has no required parent and accepting it expands edge/staleness scope. `source_turn_id` is system-owned linkage, not provider authority. The server should generate `proposal_id`; browser must never turn it into the node ID.

## 4. Node roles and product meaning

`NODE_TYPES` is the authoritative UI inventory (`app.js:2-10`); the campaign generator separately recognizes ordinary campaign types (`app.js:9770-9782`).

| Type | Meaning/normal fields and relationships | Normal creation/downstream effects | V1 |
|---|---|---|---|
| Idea | Campaign root/strategy; title/content, strategy fields; normally precedes Variation. | Picker/setup/generator; diagnostics and generation topology. | No: strategic root changes campaign meaning. |
| Campaign Variation | Distinct campaign angle; title and body required by campaign quality checks; normally Idea → Variation → Content. | Setup/generator/Insights; quality/repair diagnostics. | No: strategic and topology-sensitive. |
| **Content** | General content/brief; title/content; may connect Variation → Content → Social. | Picker/drop/generator; minimal specialized fields, though diagnostics count it. | **Yes, only type.** No edge/parent in V1. |
| Social Media Posting | Platform caption/CTA/hashtags/schedule; normally after Content. | Picker/derivative/generator; calendar, visual generation and social diagnostics. | No: specialized nested schema and side effects. |
| Landing Page | Structured claim/problem/solution/trust/CTA and visual prompt. | Setup/generator/next step; conversion diagnostics/repair. | No: body cannot safely map to complete required structure. |
| Email Campaign | Email asset; campaign fields and generated copy. | Setup/generator/next step. | No: specialized fields/quality expectations. |
| Visual Concept | Creative concept for visual work. | UI picker/next-step ecosystem. | No: downstream image workflow risk. |
| Image Brief | Prompt/brief for image generation. | UI picker/image workflow. | No: prompt and asset workflow risk. |

Trade-offs: Content-only is least expressive but provides one stable title/body mapping and no mandatory edge. Content plus strategic nodes adds diagnostic/topology semantics and parent questions. All ordinary user types requires per-type nested schemas, language/length rules, generation/calendar safety, and substantially larger tests. A narrower “unconnected Content brief” is the safest actual architecture-supported V1.

## 5. Structured provider response architecture

| Approach | Assessment |
|---|---|
| A. Optional proposal on every answer | Compatible-looking but weak intent separation: retries can replace proposals, every chat becomes schema-capable, output schema/language complexity rises, and UI may suggest mutation unexpectedly. Not recommended for V1. |
| B. Separate deliberate “Propose node” request | Strong intent, schema reliability, easy authorization/idempotency, and ordinary endpoint stays unchanged. Requires a new request and endpoint/mode. Good. |
| C. Advice then user-triggered conversion | Best UX semantics; technically implement as B against an explicitly selected successful turn plus bounded history/current context. **Recommended.** |
| D. Browser parses Markdown | **Reject.** Markdown is prose, locale-dependent, retry-variable, injection-prone, and cannot reject unknown/hidden fields reliably. It also couples formatting to mutation. |
| E. Dedicated server endpoint creates/validates | A dedicated endpoint should **validate/produce advice only**, never create. Server creation would violate the provider/client mutation boundary and ordinary Canvas lifecycle. |

**Recommended contract:** keep `/api/ai-brain/advice` unchanged. A later narrowly named proposal endpoint accepts exact keys such as current `board_id`, `source_turn_id`, selected successful answer/question or bounded conversation reference, current sanitized Canvas/context identity, and explicit response/content languages. It repeats session/Board edit authorization and current Board/Brand loading. It calls the provider with strict structured output, parses into a null-prototype/exact-key object, bounds and normalizes it, generates the opaque proposal ID server-side, and returns `{node_proposal, context}` only. It never calls Board storage.

The browser repeats exact validation. `rationale`/system UI follows captured `uiLanguage`; node `title/body` follows captured `campaignLanguage` unless the deliberate request explicitly selects another supported content language. Existing quoted content remains verbatim. Normal advice and its response contract remain untouched.

## 6. Proposal lifecycle

**Recommendation:** extend each successful in-memory turn with `proposal: null | {status,data,contextToken,error}`; add a small in-memory `appliedProposalIds` set or terminal turn status. Neither belongs in conversation history. State machine:

`none → requesting → proposed → previewed → confirming → applying → applied`; side exits are `cancelled`, `invalid`, `stale`, `failed`. “Requesting” is preferable to overloading AI Brain’s ordinary `loading` status.

- Proposal links to the exact system-owned `source_turn_id`, captured Board ID/load generation/user/access identity, captured UI/campaign language, selected-node ID, and a browser-owned context token.
- Rendering/reopening the AI Brain view preserves it only while the page-level `state.aiBrain` remains. Refresh loses it. Closing the view does not; Board/account/access identity invalidation and transcript clearing do. No storage, URL, cookie, Board/Brand JSON, or database marker.
- Cancel terminally removes/marks proposal without mutation. Retry of the source turn invalidates its proposal before the request. A second proposal request replaces the old proposal only after successful validation; old controls become inert.
- Confirmation atomically changes `previewed/confirming → applying` before any mutation and disables/removes controls. Terminal `applied` plus the in-memory ID set prevents rerender/back/forward/double click. A failed pre-mutation validation becomes `invalid/stale/failed`; a post-mutation UI/save failure must remain consumed because retrying creation is less safe than reporting recovery.
- Proposal text must not be placed in `aiBrainConversationHistory()`; only the normal successful answer remains conversational memory.

## 7. Preview and confirmation UX

**Recommendation:** show a compact, non-actionable “Proposal available” card inline on the source turn with one **Preview node** button only when the structure is valid and access/context remain valid. Open a dedicated accessible modal for complete preview and final confirmation. Inline preserves provenance; a modal provides deliberate focus, full content, explicit Cancel/Create, and avoids repurposing the mutation-heavy inspector or adding fragile permanent side-panel DOM. Reuse the existing confirmation-overlay pattern, but use new IDs/data attributes; do not remove/rename legacy IDs (`app.js:8414,17670`).

Preview shows type, full title/body (scrollable, no truncation), rationale, destination “Current Board, unconnected Content node,” current/stale context status, and “A new local ID and position will be assigned; normal save lifecycle begins after creation.” Cancel is the default; Create requires pointer/Space activation and never form-submit/Enter. Use `role="dialog"`, `aria-modal`, labelled title/description, focus trap, initial focus on Cancel/close, Escape cancel, restore focus, and disabled Create while applying/invalid. Public Viewer/read-only renders no actionable proposal; access loss disables and closes/invalidates it.

### Required system-owned strings

| Key | English | German |
|---|---|---|
| available | Proposal available | Knotenvorschlag verfügbar |
| preview | Preview node | Knoten als Vorschau anzeigen |
| create | Create node | Knoten erstellen |
| cancel | Cancel | Abbrechen |
| expired | This proposal has expired. Request a new one. | Dieser Vorschlag ist abgelaufen. Fordere einen neuen an. |
| board changed | The Board changed. This proposal cannot be used. | Das Board wurde gewechselt. Dieser Vorschlag kann nicht verwendet werden. |
| access lost | Edit access was lost. No node was created. | Der Bearbeitungszugriff ist nicht mehr verfügbar. Es wurde kein Knoten erstellt. |
| invalid | This node proposal is invalid. | Dieser Knotenvorschlag ist ungültig. |
| created | Node created. | Knoten erstellt. |
| failed | Node creation failed. No retry was applied automatically. | Die Knotenerstellung ist fehlgeschlagen. Es wurde kein automatischer neuer Versuch ausgeführt. |
| applied | This proposal was already applied. | Dieser Vorschlag wurde bereits angewendet. |
| stale Canvas | The Canvas changed. Request a fresh proposal. | Der Canvas hat sich geändert. Fordere einen neuen Vorschlag an. |
| destination | Creates one unconnected Content node on the current Board. | Erstellt einen nicht verbundenen Content-Knoten im aktuellen Board. |

Keep these in `language.js` dictionaries if consistent with project localization; proposal content itself is not a dictionary string.

## 8. Authorization and identity

Existing AI Brain requires session user and server `getBoardAccess(...).access.canEdit`; client display uses `state.user`, `state.currentBoardId`, and `state.boardAccess.canEdit` (`api/ai-brain/advice.js:63-84`; `app.js:5344-5358`). Canvas controls use `applyBoardAccessUi()` and `createNode()` blocks explicit read-only (`app.js:690-745,9461-9466`). Public access is represented by `publicBoardToken` plus non-edit Board access (`app.js:170-176`).

Required future checks:

1. **Proposal request:** authenticated user, current Board ID from live state, strict edit access client-side; server independently resolves that ID and `canEdit`. Never accept Board/account/auth in provider output.
2. **Render:** exact captured user/Board/load-generation/access identity still equals live identity; owner/editor only. Viewer/Public Viewer gets no confirm control.
3. **Confirmation:** repeat live `state.user?.email`, current Board equality, `boardAccess.canEdit === true`, no `publicBoardToken`, no load/hydration/conflict transition, and proposal/context validity.
4. **Final mutation:** repeat immediately in the synchronous wrapper before claiming/mutating. Use `state.currentBoardId`/resolved persistence target only. Never use stale conversation or provider Board identity.

Board/account switch, Board load generation, access change, or selected Brand/protected-context change aborts proposal requests and clears proposals with transcript invalidation. If server access changes after proposal generation, final local checks protect known state; **open:** there is no synchronous server round trip immediately before local mutation. The safest design re-authorizes through a lightweight server validation immediately before enabling confirmation or accepts that autosave is the final authoritative rejection and must roll back. Prefer re-authorization for access-loss correctness.

## 9. Canvas staleness

Confirmed available signals are Board `updated_at`/`lastKnownUpdatedAt`, `boardLoadGeneration`, `isDirty`, serialized snapshot, node/edge topology, selection, and `aiBrainRequestContextIdentity()`; there is no explicit local Canvas revision counter or hash (`app.js:83-116,5212-5224,5495-5509`). Server validates the submitted projection against Board identity/context but does not compare it to persisted Canvas JSON in this advice route.

**Recommendation:** capture a deterministic browser context token at proposal request from current Board ID, `boardLoadGeneration`, user/access identity, selected node, `serializeState()` material Canvas (or the same bounded projection plus edges), and relevant Brand provenance/revision. Do not persist it and do not expose it as provider-controlled content. At preview/confirm/apply recompute; any mismatch is terminal `stale` and requires regeneration. This is conservative and deterministic.

Board switch/account/access/Brand change always rejects. Canvas edits after generation reject rather than warning. Missing selected/parent rejects if referenced; V1 has no parent, so a deleted selected node still invalidates through the token. Role allowlist changes reject. An older source turn may propose only through a new explicit request using current context; once newer Canvas/identity exists, old proposal controls are stale.

## 10. Placement strategy

Provider supplies no coordinates. Existing options: default grid uses node count (`app.js:9433-9440`), parent offset (`app.js:9467-9475`), viewport center helpers exist (`app.js:4430-4470`), and all `createNode` positions are clamped. Default grid is deterministic but can overlap moved nodes; parent placement adds edge/relationship scope; viewport center respects pan/zoom but can overlap; there is no general collision resolver wired into `createNode` despite overlap constants.

**Recommendation:** for unconnected V1 Content, begin from the current viewport center offset to card top-left, then scan browser-owned grid offsets (right/down in `NODE_WIDTH + NODE_OVERLAP_MARGIN` / `NODE_HEIGHT + margin` steps) against current node rectangles, cap attempts, and pass the result through `clampNodePosition()`. Fall back to `defaultGridPosition()` plus the same scan. This works in Board coordinates via `visibleBoardBounds()`, stays bounded, does not move existing nodes, and avoids obvious overlap. Do not auto-connect to selection.

## 11. Exact mutation boundary

Recommended future synchronous core (names illustrative):

1. `validateApplicableAiBrainProposal(turn, liveState)` exact-validates proposal, terminal status, context, current user/Board/edit/public access, one allowed type, and title/body limits.
2. Atomically set `status="applying"`, add proposal ID to an in-memory claimed set, disable confirmation.
3. Calculate browser-owned bounded placement.
4. `pushHistorySnapshot()` exactly once immediately before mutation.
5. Call `createNode({type:"Content", position})`; it generates the only final node ID, creates/renders/selects/logs.
6. Assign validated `title` and `content` to the returned node and `updateNodeCard(node)`/`fillInspector(node)`. Because `createNode()` currently saves too early, the implementation must ensure only the fully populated object enters the intended dirty/local-save lifecycle—prefer a backward-compatible initialization option rather than a second ad-hoc mutation/save.
7. Mark proposal `applied`, retain consumed ID in memory, close preview, focus/select created node.

Do not call campaign generation, campaign adapter, Insights suggestion, repair, AI Review, `addEdge`, or specialized generators. Creation is locally synchronous; DOM animation and autosave are async.

Failure rules: before array mutation, restore proposal to `failed/invalid/stale` but keep UI non-applicable until deliberate regeneration. If `createNode` returns null, no node and no dirty transition; discard the just-pushed snapshot if safe. If a node entered `state.nodes`, never automatically retry. A render exception after push requires removing exactly that ID and restoring the pre-mutation snapshot, then marking failed; this rollback must avoid logging/saving partial state. Autosave failure does **not** delete the node: keep dirty state and existing save-failure/retry UX. Activity/render failure must be surfaced and tested; provider request must never be retried as an application.

## 12. Dirty state, autosave, and persistence

`serializeState()` sanitizes nodes and includes nodes, edges, counters, zoom, metadata and activity (`app.js:5495-5509`). `saveCampaignCanvasState()` immediately writes that payload to `localStorage`, renders intelligence, and sets “Saved” (`app.js:5511-5514`). Separately, a one-second snapshot watcher calls `markUnsaved()` once on divergence; `scheduleAutosave()` de-duplicates timers and fires after three seconds if still dirty and eligible (`app.js:4827-4884`). `saveBoardToServer()` blocks loads/hydration, overlap, read-only, and no-Board autosave; builds `{canvas_json, brand_core_snapshot}`; resolves current persistence target; uses optimistic `lastKnownUpdatedAt`; handles 409 conflict choices; and on success clears dirty/refreshes snapshot/access (`app.js:7949-8100`). Failure leaves unsaved state/status; overlapping saves are skipped.

`markUnsaved()` is the normal dirty transition and clears the conflict pause on change (near `app.js:5514-5525`). Board load applies state, clears dirty/timer, and refreshes snapshot (`app.js:7918-7951`). Board switching/load generation invalidates context; unload behavior should be rechecked in browser implementation, but this audit does not claim a guaranteed flush.

**Recommendation:** proposal/request/preview/cancel touch only `state.aiBrain`, so no serialization, localStorage, dirty, autosave, Board/Brand JSON, or DB write. Confirmed application should look like one manual edit: one history snapshot, one complete node mutation, one `markUnsaved()` transition/scheduled timer, then normal server payload/authorization. Existing `createNode()` localStorage behavior means “no persistence before confirmation” is satisfied, but a later wrapper must prevent an intermediate blank-node local write after confirmation. Do not add proposal/applied markers to serialization.

## 13. Undo, cancellation, duplicate prevention

Undo exists but is shallow: five JSON snapshots, no redo stack, and the delegated Undo button invokes `restoreLastSnapshot()` (`app.js:4780-4811,17167-17171`). Since ordinary `createNode()` does not snapshot, controlled V1 must explicitly snapshot once immediately before the confirmed mutation. Undo removes the created node by restoring the prior graph/counters and marks unsaved. **No redo support was found.**

Cancel closes/invalidates without snapshot/mutation. Duplicate prevention uses all of: terminal state check, synchronously claimed ID before mutation, disabled/removed button, event listener bound once, no Enter submit, in-memory consumed-ID set, source-turn/proposal identity equality, and stale context validation. Retry invalidates proposals. Refresh/back-forward cannot reapply because proposal state is not persisted. Rerender reads terminal state, not merely button state.

## 14. Security and prompt injection

Treat the provider and all history as untrusted. Server protections: exact request/output keys, plain-object checks, one-object cardinality, enum/length/control-character normalization, generated proposal nonce, current authorization/context, structured provider output, no provider Board/identity/coordinates/edges/metadata, and never pass raw hidden/system fields back. Reject links/URLs for V1 if product does not need them; otherwise store as literal text only.

Browser repeats every shape/enum/length/unknown-key check using own-property access and null-prototype reconstruction; checks nonce uniqueness/source turn/current identity/staleness; derives type mapping, defaults, node ID, position and ownership; and creates exactly one node. Do not spread raw provider objects into node/state (prototype pollution). Render preview title/body/rationale through `textContent` or existing safe formatter; node card already uses controlled DOM paths, but injection tests must cover `<script>`, `onerror`, `javascript:`, Markdown links/images, fake system instructions, and oversized Unicode.

History instructions cannot grant authority: current prompt already declares history untrusted (`api/ai-brain/advice.js:48`). Server must never expose raw Brand Core in proposal output or accept provider attempts to alter Board. Parent spoofing and arbitrary edges are eliminated in V1. Duplicate proposal IDs are rejected per in-memory lifecycle; final node ID is always locally generated.

## 15. Language behavior

Confirmed current separation: `uiLanguage` and `campaignLanguage` are distinct state fields and selectors (`app.js:67-68,16152-16159`); advice captures only UI language per turn (`app.js:5358`), and BW-26.5 ensures campaign language is absent.

**Recommendation:** capture both at deliberate proposal request. System chrome, validation, rationale, and errors use captured/current `uiLanguage` consistently; proposed node title/body use `campaignLanguage`. Permit another content language only through an explicit, system-owned selection/request—not provider inference—and carry it as validated request context, not node metadata. Cross-language history remains reference material; it does not override either captured language. Quoted customer/brand copy remains unchanged. Existing responses and proposals retain their captured content; changing language affects the next proposal request, while an outstanding proposal remains content-stable but system chrome may rerender in current UI language.

Required English/German messages are specified in section 7. Do not collapse the language selectors.

## 16. Persistence boundaries

Proposal state, preview state, consumed IDs, source linkage, and context tokens are page-memory only. They must not enter `localStorage` (`campaignCanvasState` or Brand keys), sessionStorage, cookies, URL/history state, `serializeState()`, Brand JSON, Board JSON, server database, activity feed, analytics, or presence. Only the confirmed ordinary node and ordinary `node_created` activity may enter normal Canvas persistence. Closing the view retains page memory; Board/account/access invalidation and refresh destroy it.

## 17. Test inventory and future regression specification

Relevant existing tests are BW-26 through BW-26.5 listed in section 1. Canvas/persistence/access coverage also includes `scripts/check-browser-script-integrity.js`, `check-bw18-board-access-roles.js`, `check-bw19-private-public-board-sharing.js`, `check-bw5-board-brand-isolation-regression.js`, `check-bw5-board-brand-association.js`, and campaign harness/check scripts. **Confirmed limitation:** no dedicated current regression proves toolbar `createNode` produces one undo entry/dirty transition/autosave; BW-26.6 must add focused instrumentation rather than infer it.

Create `scripts/check-bw26-6-controlled-ai-brain-node-creation.js` and add a package script plus Runtime Boot Safety ordering after BW-26.5. Minimum cases:

1. Ordinary chat cannot mutate nodes/edges/counters/selection/history/dirty/storage/save calls.
2. Valid structured proposal alone cannot mutate.
3. Opening/rerendering preview cannot mutate.
4. Cancel/Escape cannot mutate or save.
5. Explicit confirmation creates exactly one Content node with exact validated text.
6. Double click, Enter, repeated handler and second confirmation create no duplicate.
7. Provider `id` is rejected; final ID comes from live counter.
8. Provider Board/account/access keys are rejected and never select persistence target.
9. Unknown type/role rejected.
10. Unknown top-level/nested fields and prototype keys rejected.
11. Title/body/rationale limits and control characters rejected/normalized as specified.
12. HTML/Markdown/URL/event/script injection remains inert in preview/card.
13. Authenticated owner and editor may request/confirm.
14. Viewer and Public Viewer cannot request/preview-confirm/apply.
15. Board switch aborts request and invalidates/clears proposal.
16. Account switch invalidates/clears.
17. Access loss at preview and immediately before mutation rejects.
18. Any material Canvas change deterministically expires proposal.
19. Missing selected/reference node rejects safely; V1 never creates a parent edge.
20. Placement ignores provider coordinates, uses current viewport, avoids obvious overlap, and clamps bounds at zoom/pan extremes.
21. Exactly one history snapshot and dirty false→true transition.
22. Exactly normal one scheduled autosave; save failure remains dirty.
23. No localStorage/server save before confirmation.
24. Advice Retry/proposal Retry invalidates old proposal and never duplicates proposal/node.
25. UI/rationale language vs campaign content language separation; quoted content unchanged; old turn language retained.
26. Conversation history remains bounded, successful-only, proposal-free, and ephemeral.
27. All BW-26 through BW-26.5 checks remain, with read-only assertions scoped—not removed.
28. Campaign generation, campaign adapter, repair, AI Review, Insights apply and refine routes are never invoked.
29. Exactly one `state.nodes` insertion; zero edges; no secondary mutation route.
30. Success/cancel/pre-mutation failure/post-insertion rollback cleanup: controller/listeners/modal/focus/claimed state/timers.

Also assert one undo removes the node and no redo is advertised; serialization contains the node but no proposal fields; Board save uses current authorized ID; server and browser both reject malformed contracts. Static substring tests should be supplemented with a DOM/state harness because idempotency and dirty counts are behavioral.

## 18. Blast radius for the later implementation

| File | Why/size | Main risk and protection |
|---|---|---|
| `app.js` | Medium: ephemeral proposal state/lifecycle, validator, preview handlers, context token, placement, confirmation wrapper. | Highest legacy DOM/Canvas risk; BW-26–26.5, browser integrity, new behavioral regression. Avoid moving existing functions/IDs. |
| `api/ai-brain/propose-node.js` (new, recommended) | Medium: deliberate endpoint, auth/context/provider structured-output and validation. | Provider/schema/security/language; unit exports and BW-26.6 malformed/auth tests. |
| `api/ai-brain/advice.js` | **Should not change** for V1 architecture. | Preserves ordinary response schema/prompt/read-only guarantees and all BW-26 tests. |
| `api/_ai-brain-conversation.js` | Prefer no change; reuse bounded validation if needed. | Reference/memory regressions protected by BW-26.3/.4. Proposal must not enter history. |
| `api/_ai-brain-node-proposal.js` (new, optional helper) | Small/medium strict schema/constants shared by endpoint tests (browser must still independently validate). | Unknown keys/prototype/limits. |
| `index.html` | Small: ideally no static IDs if modal/card is created safely; possibly an inert template/portal only. | Runtime Boot Safety and legacy ID dependencies; never rename/remove IDs. |
| `styles.css` | Small/medium proposal card/modal, bounds, focus, responsive styles. | Overflow/accessibility/mobile; formatting test patterns and browser verification. |
| `language.js` | Small: English/German system strings only. | UI/campaign separation; BW-21/BW-23/BW-26.5 plus new language cases. |
| `scripts/check-bw26-6-controlled-ai-brain-node-creation.js` | Large focused regression. | Must behaviorally test exact-one mutation, not only strings. |
| `package.json` | Tiny new check script. | CI invocation/order. |
| Runtime Boot Safety workflow (locate current `.github/workflows/*`) | Tiny command after BW-26.5. | Ordering/boot gate; existing BW tests assert order. |

Files that should **not** need changes: `_ai-brain-canvas-context.js`, `_ai-brain-diagnostics.js`, Board/Brand storage/serializer/access implementations, Canvas server routes, campaign generation/repair/review endpoints, `campaign-v3.js`, node rendering architecture, autosave/save payload code, and database schema/migrations. `createNode()` may need only a narrowly backward-compatible initialization option; do not broadly refactor rendering/schema/autosave.

## 19. Recommended implementation phases

### Phase A — strict read-only contract

Add the separate deliberate proposal endpoint/helper, exact schemas/limits/languages, auth/current context, one `Content` proposal, server nonce, no writes. Add server unit/security cases. Leave advice endpoint/prompt/schema unchanged.

### Phase B — read-only proposal and preview

Add ephemeral per-turn lifecycle, explicit prepare action, inline availability, accessible full modal, cancel/stale/invalidation/focus behavior, bilingual chrome. Prove zero Canvas/storage/save mutation.

### Phase C — explicit bounded mutation

Add duplicate claim, repeated live validation, context token, browser-owned placement, one history snapshot, one-node wrapper, fresh ID, no edge/generation. Add rollback semantics.

### Phase D — ordinary lifecycle integration

Ensure complete node fields are present before one dirty/local serialization lifecycle, selection/render/activity match manual UX, one autosave is scheduled, undo removes it, save failure remains recoverable. Avoid autosave refactor.

### Phase E — regression/authenticated verification

Add all 30 BW-26.6 cases, retain BW-26–26.5, integrity/runtime workflow checks, then authenticated owner/editor/viewer/Public Viewer browser verification on a disposable Board. Verify Board/account/access/Canvas/language transitions and normal autosave. Browser verification is future work and was not performed by this audit.

Do not add multi-node/edges, arbitrary roles, node editing, campaign/repair/Insights integration, general Canvas refactor, or proposal persistence.

## 20. Open questions

1. Should V1 node body be literal plain text or permit the Canvas editor’s existing Markdown semantics? Security recommendation is literal text until rendering behavior is explicitly tested.
2. What product-approved title/body limits should replace the proposed 120/4,000 values?
3. Is immediate server re-authorization before final local mutation required, or is live client access plus authoritative autosave rejection acceptable? This audit recommends re-authorization.
4. Should `createNode()` gain a backward-compatible `initial` payload/suppress-intermediate-save option, or should a dedicated wrapper construct the canonical default object? Prefer the smallest option after behavioral tests expose call counts.
5. Is an unconnected Content node acceptable product meaning? If not, parent/edge support must be a later separately audited expansion.
6. Should rationale follow captured request UI language or current UI language after a switch? Recommendation: proposal rationale is captured content; chrome follows current UI language.
7. Does activity feed persistence count as the desired ordinary node lifecycle? This audit assumes yes only after confirmation.

## 21. Final recommendation and go/no-go criteria

Implement later as a **deliberate, separate, advice-only proposal request** tied to one successful turn and current authorized context; validate twice; preview completely; confirm in a modal; create one unconnected `Content` node through a narrow wrapper around existing defaults/rendering; use fresh browser ID and bounded browser placement; snapshot once; and then enter ordinary dirty/autosave/persistence behavior. Ordinary AI Brain advice remains byte-for-byte contract-compatible and read-only.

### GO when all are true

- Exact one-object server/browser schemas, limits, unknown-key/prototype rejection, one-role allowlist, and inert rendering are implemented.
- Proposal lifecycle is memory-only, source-linked, Board/account/access/Brand/Canvas-stale aware, and idempotently consumed.
- Owner/editor/public access checks run at request, render, confirm and mutation; current Board identity is authoritative.
- Complete preview and accessible explicit confirmation exist; Cancel/Enter/double click are safe.
- Final path generates ID/placement/defaults locally, inserts exactly one node/no edge, takes one undo snapshot, and triggers one normal dirty/autosave lifecycle.
- All existing BW-26–26.5 checks and the 30-case BW-26.6 regression pass; authenticated browser verification is completed in the implementation package.

### NO-GO if any are true

- Markdown/prose parsing is the contract; provider can control node/Board/account/coordinates/edges/metadata; or server/provider writes Canvas.
- Ordinary response, proposal generation, preview, or cancellation can mutate/save.
- More than Content, parent edges, generation/repair/review, or persisted proposal state is included without a new audit.
- Stale/access-lost/double confirmation can reach mutation, or partial failure can create a second node.
- Existing read-only, memory, formatting, reference, language, authorization, Public Viewer, dirty/autosave, or boot-safety coverage is weakened.

**Audit disposition:** architecture is feasible with a narrow staged implementation; production implementation is intentionally not part of BW-26.6 audit.
