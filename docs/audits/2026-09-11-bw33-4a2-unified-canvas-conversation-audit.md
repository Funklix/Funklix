# BW-33.4A2 unified Canvas conversation model audit

**Date:** 2026-09-11
**Scope:** documentation-only investigation of the merged BW-33.4A1 implementation and its Canvas, Board, collaboration, localization, approval, and publishing boundaries
**Decision:** **GO** for B1, B2, B3, and B4 as separate, sequential changes; **NO-GO** for implementation in this audit, for a generic Inspector conversation destination, and for a new unified persistence schema.

## 1. Executive conclusion and corrected product model

The product has two node-associated, first-class spatial conversation surfaces—not a third generic node-comment surface:

1. A normal node may have **at most one human Post-it**. Its authored root message is one human contribution and its `replies` are further human contributions.
2. A node may also have an **AI Review Canvas surface**. Its generated review body is not a human contribution. Human responses to it are contributions.
3. The node speech-bubble badge means **the number of eligible human contributions in open discussions associated with this node**. It never means Post-it objects, generated reviews, unread items, or all-time items.
4. Resolving a surface excludes all of that surface's eligible contributions from the open count while preserving recognizable, readable, reachable history; reopening restores them.

The current storage is less clean than the product vocabulary. Both ordinary Post-its and AI Reviews are records in `node.postits`; AI Review records are discriminated by `source: "ai_review"` (with legacy AI-author fallbacks), and both reuse the same `replies` shape, renderer, and mutation handlers (`app.js:14532-14730`, `app.js:15354-15377`). This is a **shared envelope with typed records**, not a fully unified conversation domain. The generated review is stored as formatted text in the AI Post-it root, while human AI Review responses are currently the same reply payload used by ordinary Post-its. No separate `node.aiReview` write is performed by review generation.

BW-33.4A1 incorrectly routes the badge into an Inspector summary and adds an “Open AI Review in Inspector” button even though the complete conversation remains on Canvas. The smallest safe correction is to remove those two routes and their presentation-only support while retaining the useful lifecycle lessons (Board identity/generation validation, reduced-motion handling, and focus restoration) in the future Canvas focus controller.

**First implementation:** B1—introduce a pure count selector and correct badge semantics, then remove only A1's misleading routes. Do not combine B1 with movement, visual redesign, or emoji work.

## 2. Sources and investigation method

The audit traced:

* merged A1 commit `080a8f5` and current `app.js`, `index.html`, `styles.css`, `language.js`, `canvas-density.js`, and `content-workspace.js`;
* the prior BW-33.4 audit and A1 regression (`docs/audits/2026-09-10-bw33-4-canvas-overlay-collaboration-audit.md`, `scripts/check-bw33-4a1-inspector-indicator-routing.js`);
* Board serialization/hydration/autosave, remote whole-Board merge, activity, access, dark mode, density, approval fingerprints, and publication regressions.

Important limitation: source behavior is authoritative for this audit, but it does **not** enforce every approved product invariant. Those mismatches are explicitly called out rather than normalized away in documentation.

## 3. Current authoritative data model

### 3.1 Board authority and storage boundary

`state.nodes` is the live model. `serializeState()` maps every node through `sanitizeNodeForPersistence()` and includes nodes, edges, counters, zoom, activity, schema version, and metadata (`app.js:5735-5752`). `sanitizeNodeForPersistence()` shallow-copies unknown node fields, so `postits` and all nested data survive (`app.js:4921-4945`). The browser draft is `campaignCanvasState` in local storage; `saveBoardToServer()` persists the Canvas document as Board `canvas_json`. Hydration runs schema defaults and sanitization, then recreates node DOM (`app.js:8125-8188`, `app.js:8388-8484`).

There is no comment endpoint, comment table, AI Review table, per-comment revision, tombstone ledger, or event-sourced conversation authority. Collaboration reconciles whole sanitized nodes from a newer Board snapshot; it skips actively edited nodes and otherwise patches/re-renders them (`app.js:2695-2760`). Board `updated_at`/save conflict behavior is the effective shared revision boundary. Duplicate network events are therefore not contribution records and must never be counted.

### 3.2 Ordinary Post-it record

Current newly-created shape (`createCommentPayload`, `addPostitToNode`) is conceptually:

```js
{
  id: "postit-<counter>",             // Post-it identity
  authorName, authorEmail, authorAvatar,
  user: authorName,                    // legacy alias
  time: "<display time>",             // legacy/display field
  createdAt: "<ISO timestamp>",
  updatedAt: "<ISO timestamp>",
  text: "",                            // authoritative root message text
  resolved: false,                     // whole-surface resolution
  replies: [],                         // human reply records
  color: "#ffe082",
  x, y                                 // offsets in parent-node local Board units
}
```

Parentage is membership in `node.postits`; there is no stored `nodeId` on the note. The root and replies **do not share exactly one shape**: they share identity/author/time/text/resolution-compatible helper fields, but the root also owns color, coordinates, its nested `replies`, and whole-surface resolution metadata. A new reply is `{ id, ...createCommentPayload(text) }`, so it currently also receives redundant `resolved:false` and `replies:[]`, though the renderer does not offer individual reply resolution (`app.js:1583-1596`, `app.js:14707-14719`).

`ensureCommentIdentity()` mutates records during rendering to backfill author aliases, timestamps, and arrays (`app.js:1570-1580`). Consequently even a presentation render can change the live object before the next save. B1's selector must not call this helper; use non-mutating normalization locally.

**Identity and timestamps:** note IDs use a persisted Board counter; reply IDs use timestamp plus random suffix. Author helpers fall back through modern and legacy fields. `createdAt` is authoritative where valid; `updatedAt || createdAt || time` is current activity recency. Resolving adds `resolvedByName`, `resolvedByEmail`, `resolvedByAvatar`, and ISO `resolvedAt`; reopening leaves that metadata in place and changes `updatedAt` (`app.js:14572-14604`).

**Deletion:** deleting a Post-it physically filters the record from `node.postits`. There is no `deleted`, `deletedAt`, or tombstone. Replies have no delete UI or mutation path. Thus deleted top-level data is absent and contributes zero; future reply deletion must use its established/approved authoritative mutation when one exists, not an invented display flag.

**One-Post-it invariant:** it is **not currently enforced globally**. Badge activation creates only when `node.postits` is empty, which wrongly treats an AI Review as an ordinary Post-it. The context-menu Add Post-It path appends without checking for an existing ordinary note, and AI Review generation also appends. Multiple ordinary and multiple AI records can therefore exist in legacy/current data (`app.js:13182-13201`, `app.js:17256-17276`, `app.js:15354-15377`). B1 must count valid persisted data defensively and separately add a narrowly scoped ordinary-Post-it lookup/creation guard; it must not delete duplicates. A product-data reconciliation/migration needs a separate decision.

**Empty draft:** `addPostitToNode` immediately persists a record whose `text` is empty and logs `comment_added`. The textarea's German phrase is a true hard-coded HTML `placeholder`, not default content (`index.html:837-846`). Empty/whitespace root text contributes zero. Existing Boards may contain authored strings resembling placeholders; no source evidence marks them as generated defaults.

### 3.3 AI Review record

`/api/review-node` returns generated review data. `formatAiReviewComment()` flattens score, summary, strengths, improvements, and suggested rewrite into text. `addAiReviewPostitToNode()` stores:

```js
{
  id: "postit-<counter>",
  authorName: "AI Review",
  authorEmail: "ai@funklix.local",
  authorAvatar: "<approved Brand avatar or empty>",
  user: "AI Review",
  time, createdAt, updatedAt,
  source: "ai_review",                 // authoritative modern discriminator
  text: "<formatted generated review>",
  color: "#e9f1ff",
  resolved: false,
  replies: [],                         // human AI Review comments/replies
  x, y
}
```

The rendered review is recognized by `source`, then legacy AI email/name fallbacks. The generated text is parsed back into a review card; the generated root is never counted. Human comments and further replies are represented only as a flat `note.replies` list. There is no nested reply-to-comment relationship, parent reply ID, separate comment renderer, or separate AI Review comment API. Accordingly “AI Review comments and replies” are one flat sequence under the review today and use the **same reply mutation system** as the Post-it.

AI Review resolution also uses the same whole-Post-it `note.resolved` toggle. There is no separately supported review-discussion status and no individual AI comment resolution. Applying a suggested fix is different: `/api/apply-review-fix` creates transient Inspector preview state, and accepting it mutates node content. It is not conversation mutation.

### 3.4 Shared versus separate—definitive answer

| Concern | Current truth |
|---|---|
| Storage collection | Shared `node.postits[]` envelope |
| Root payload | Different meaning/author: human root vs generated AI text |
| Reply payload | Shared `createCommentPayload`-derived flat records |
| Renderer | Shared outer Post-it renderer; AI root body has a separate parsed card renderer |
| Mutation API | Shared in-memory reply/resolve/delete handlers and whole-Board save; review generation/apply-fix use separate AI APIs |
| Resolution | Same stored note-level boolean today; product semantics must remain independently per record/surface |
| Individual comment resolution | Unsupported |
| Collaboration revision | Whole Board `updated_at`, not comment revisions |

Do not replace this with a new common schema in B1–B4. First introduce read-only classifiers/selectors and preserve established mutation ownership.

## 4. Deterministic open-contribution count

### 4.1 Pure selector contract

`getOpenConversationCountForNode(node)` must be deterministic, synchronous, side-effect-free, tolerant of malformed legacy input, and derived only from the current authoritative node snapshot. It must neither normalize/mutate records nor inspect DOM, unread local storage, activity entries, selection, density, Inspector routes, or asynchronous request state.

Conceptual algorithm:

```js
function getOpenConversationCountForNode(node) {
  if (!node || !Array.isArray(node.postits)) return 0;
  let count = 0;
  for (const note of node.postits) {
    if (!note || typeof note !== "object" || note.deleted === true || note.resolved === true) continue;
    const ai = note.source === "ai_review"
      || note.authorEmail === "ai@funklix.local"
      || note.authorName === "AI Review"; // legacy-compatible classifier
    if (!ai && typeof note.text === "string" && note.text.trim()) count += 1;
    const seen = new Set();
    for (const reply of Array.isArray(note.replies) ? note.replies : []) {
      if (!reply || typeof reply !== "object" || reply.deleted === true) continue;
      if (reply.resolved === true) continue; // defensive only; no individual UI today
      if (typeof reply.text !== "string" || !reply.text.trim()) continue;
      const key = typeof reply.id === "string" && reply.id.trim() ? `id:${reply.id}` : null;
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      count += 1;
    }
  }
  return count;
}
```

The legacy AI classifier must be centralized with rendering to prevent count/render disagreement. Unknown records default to ordinary human roots only when they have non-empty text and are not positively AI-authored. This preserves older human Post-its. Duplicate top-level IDs should likewise count once per identity in the production selector; records without IDs count by occurrence because content-based deduplication could collapse legitimate equal messages. The sample above abbreviates that second top-level `seen` set for readability.

### 4.2 Case matrix

| Case | Count/result |
|---|---:|
| no Post-it, no AI Review | 0 |
| empty/whitespace Post-it draft | 0 |
| open human Post-it root only | 1 |
| open root + N non-empty human replies | 1 + N |
| resolved Post-it | 0 for root and every reply; record remains history |
| reopened Post-it | root/replies become eligible again |
| AI Review without human replies | 0 |
| AI Review + one human response | 1 |
| AI Review + multiple flat comments/replies | number of valid human response records |
| resolved AI Review | 0 for all human replies; generated review remains 0 |
| reopened AI Review | valid human replies become eligible again; generated review remains 0 |
| both surfaces | sum of independently open, eligible human contributions |
| deleted Post-it | absent (or defensive `deleted:true`) = 0 |
| deleted reply | currently unsupported; absent/defensive deleted flag = 0 |
| malformed arrays/items/text | ignore invalid items; never throw or mutate |
| duplicate collaboration snapshot/event | count deduplicated records in current node, never activity events |
| authoritative Board reload | recompute from hydrated node, yielding the same count |
| stale async result | reject before insertion using Board ID + load generation + node existence; selector sees only accepted current state |

**Required example:** open human Post-it root `1` + three open Post-it replies `3` + generated AI Review `0` + two open human AI Review responses `2` = **badge count 6**. If the Post-it is resolved, its root and three replies contribute `0` but remain reachable history; the open AI responses still contribute `2`.

### 4.3 Optimistic and failed writes

Safest behavior is **do not count DOM-only drafts and do not add a new optimistic layer**. Existing top-level creation inserts an authoritative local Board record immediately, but its empty text remains zero; typing non-empty text makes it count from current local state. Replies are not inserted until Send validates non-empty text, so unsent drafts remain zero. Once inserted, a local reply counts and is pending whole-Board persistence under the existing local-first model; show existing save/conflict state rather than a false “server-confirmed” implication. If a future dedicated write API is introduced, count a pending contribution only if it has a stable local identity and remains in the authoritative local Board mutation queue; remove/rollback it on terminal failure. Never count a failed detached request.

## 5. Badge semantics and localized copy

The badge is always the node's **open human contribution count**. Unread/recent may remain a separate visual state, but must not alter the number.

| State | Visual/behavior recommendation |
|---|---|
| zero and no history | speech bubble with no numeric count; activating creates the one ordinary Post-it (subject to edit access) |
| one | `💬 1`; singular accessible text |
| multiple | `💬 N`; plural accessible text |
| resolved history only | bubble plus subdued resolved-history indicator, numeric open count omitted/0; activation reaches history, never creates over it blindly |
| Post-it only | focus Post-it |
| AI Review only | focus AI Review |
| both open | focus most recent first; repeated activation cycles deterministically |

Recommended strings:

* English accessible name: **“1 open comment on {title}”** / **“{count} open comments on {title}”**. Tooltip: **“Open comment”** / **“Open {count} comments”**. Zero-create: **“Add a comment to {title}”**. Resolved only: **“View resolved comments on {title}”**.
* German accessible name: **„1 offener Kommentar zu {title}“** / **„{count} offene Kommentare zu {title}“**. Tooltip: **„Kommentar öffnen“** / **„{count} offene Kommentare öffnen“**. Zero-create: **„Kommentar zu {title} hinzufügen“**. Resolved only: **„Erledigte Kommentare zu {title} anzeigen“**.

Do not say “Post-it objects,” “records,” “AI reply array,” or “unresolved Post-its.” The badge currently calculates open **records**, adds all replies only to a separate total, and routes to Inspector (`app.js:13206-13218`); all three semantics require B1 correction. List-view discussion counts should adopt the same selector or be explicitly labelled as a different total to avoid divergence (`app.js:13259-13266`).

## 6. Canvas-first focus architecture

### 6.1 Existing coordinate and ownership facts

* Board coordinates are unscaled logical units. Nodes use `node.position`; Post-it `x/y` are local offsets inside the positioned node.
* `#canvas` owns viewport scrolling. `#zoom-layer` owns one `transform: scale(state.zoom)` with origin `0 0` (`app.js:4550-4554`). Client-to-Board conversion adds Canvas scroll and divides by zoom (`app.js:4326-4331`).
* User zoom is `state.zoom`, clamped by `setZoom` to **0.4–2.0**. That function redraws links and currently saves Canvas state (`app.js:9649-9669`).
* A rendered surface's safest bounds are its `.postit.getBoundingClientRect()` relative to `canvas.getBoundingClientRect()`. Add `data-postit-id` and `data-conversation-kind="postit|ai-review"` during render for stable targeting; do not infer from DOM order.
* `focusNodeInCanvas` centers a node, selects it, and may pulse it. `openNodeCommentThread` merely marks seen, highlights **all** Post-its on the node, and calls `scrollIntoView` on the first one (`app.js:13155-13173`). It cannot satisfy exact-surface navigation.

### 6.2 Proposed presentation-only controller

Add a Canvas conversation focus controller with transient state:

```js
{ boardId, loadGeneration, nodeId, targets: [{ noteId, kind, activityAt }], index, timer, returnFocus }
```

Flow:

1. Resolve the current node and classify valid ordinary/AI records from current state. If no conversation record exists, invoke the established one-ordinary-Post-it creation path. If resolved-only history exists, choose the newest resolved surface rather than create a duplicate.
2. Build targets with open human contributions. Sort descending by latest valid contribution timestamp (`reply.createdAt`, then note `updatedAt/createdAt`), with stable `note.id` tie-break. One target focuses directly. Both kinds focus most recent; repeated activation within the same Board/node/unchanged target set advances cyclically. Multiple legacy records remain deterministic.
3. Select the parent node via the existing selection path, but do not move it. After render, re-resolve `.node[data-id] .postit[data-postit-id]`; abort if Board ID/generation, node, or record changed.
4. Determine readability from the target DOM rect and a padded Canvas viewport. Preserve zoom if the whole target is visible and its effective body text is readable. Otherwise choose the smallest moderate increase needed, recommended target range **0.8–1.15**, still clamped to the application's absolute **0.4–2.0** bounds. Never zoom out merely to fit a very large review; pan and allow its existing internal/body reading behavior.
5. Navigation zoom must use a new presentation-only primitive that applies zoom/scroll without `saveCampaignCanvasState()`. Reuse `applyCanvasZoom`, `updateCanvasScrollSurfaceSize`, `drawLinks`, cursor render, and viewport-presence notification. This prevents focus from changing Board revision/autosave/history.
6. Center/clamp scroll on the target rect after zoom. Use `scrollTo`; do not change `node.position`, `note.x/y`, resize, hydrate, or reload.
7. Add `.conversation-focus-target` only to the exact Post-it. Highlight for about 1.4 seconds; cancel the previous timer/class before the next target. Under `prefers-reduced-motion: reduce`, use `behavior:"auto"` and a persistent-for-duration outline/background contrast change without animation.
8. Focus a stable surface heading/control or the Post-it article with `tabindex="-1"` for keyboard activation, using `preventScroll`; pointer activation may leave focus on the badge. Announce target kind and ordinal in a Canvas live region.

Connections must be redrawn only when zoom changes; pan alone does not change Board geometry. Collaboration cursors must be rerendered and viewport presence republished after zoom or pan. Existing Post-it drag division by `state.zoom` and resize behavior remain untouched.

**Lifecycle:** clear cycling state, highlight class/timer, and pending animation frames at Board-load start and `applyCampaignState`; clear when its node is deleted; validate after remote merge; cancel when target is gone/resolved if it no longer matches the requested class. Density changes do not alter identity and should retain the route after remeasurement. Stale AI results must carry captured `{boardId, loadGeneration,nodeId}` before insertion. Navigation never rehydrates.

## 7. BW-33.4A1 Inspector correction

| A1 addition | Classification | Smallest safe correction |
|---|---|---|
| `#inspector-comments-section`, heading, summary | misleading presentation; removable new code | remove section and element bindings |
| “Show comments on Canvas” button/listener | redundant detour; removable new code | remove; badge goes directly to exact Canvas surface |
| `#inspector-route-status` live region | harmless compatibility DOM but A1-only | remove with A1 route; add a Canvas-owned live region only in B2 |
| `openInspectorSection` and `renderInspectorSectionRoute` | useful lifecycle ideas, wrong destination, removable code | remove calls/functions; transplant identity/generation validation patterns into B2 rather than retaining dead API |
| `state.inspectorSectionRoute` / initiating control | useful focus-return pattern, A1-only state | remove A1 state/cleanup; B2 owns separate Canvas focus state |
| `.inspector-route-arrival` CSS/reduced-motion rule | useful pattern attached to misleading target | remove A1 selector/keyframes; implement exact-surface highlight in B2 |
| “Open AI Review in Inspector” dynamic control | misleading presentation; removable new code | remove button only; preserve AI Review card and Apply Fix actions |
| `#inspector-ai-review-heading` | required by genuine existing AI Workspace/fix preview | retain |
| AI fix-preview Inspector workflow | required existing workflow | retain untouched; it is not a full AI Review Inspector |
| selection and `restoreInspectorFocus` fallback | required existing Inspector workflow | retain generic selection/focus behavior; remove route-origin branch only if no other caller remains |
| A1 language strings | removable new code | remove only now-unused A1 keys after usage check |

B1 must update or replace the history-dependent A1 regression because it currently asserts the incorrect product route. Do not remove established Canvas Post-it/AI Review rendering, resolve/reply/delete/drag/color actions, activity routing, or the legitimate AI fix preview.

## 8. Post-it visual and interaction audit

The Post-it is currently an absolutely positioned 180px warm note (AI Review 320px) with 8px padding, rounded border, and shadow. It has a compact author/avatar/time row, native color input, Resolve/Reopen, close/delete, vertically resizable textarea, nested reply list/editor, and drag from non-interactive regions (`styles.css:2736-2815`, `styles.css:3006-3029`; `app.js:14735-14761`). Resolved rendering compresses the card and replaces/removes the root body with a summary that says replies are hidden. This does not meet the approved **readable** resolved-history requirement; a future disclosure/expand mechanism is needed, without restoring it to the open count.

Typography is inconsistent by omission: root/body/buttons mostly inherit the global Inter stack, while textarea sizes are imperatively varied to `0.96rem`, `0.82rem`, or `0.7rem`; reply input explicitly sets `0.72rem`. No Post-it-specific Tendra typography token exists. The established root token is `--fk-font-family: Inter...`; the “Tendra One system” is the application design system/brand, not a font family presently loaded in source. B3 should set `font-family:var(--fk-font-family)` on `.postit` and `font:inherit` on its textarea/input/buttons, then use bounded semantic sizes/line heights instead of text-length-dependent inline shrinking. Preserve emoji-capable system fallbacks.

Bounded B3 refresh:

* keep the warm sticky-note silhouette, color customization, slight playful elevation, strong edge, and AI Review's cool distinct surface—never turn it into a generic white SaaS card;
* improve 8px-grid spacing, author/time truncation, reply indentation/divider, focus rings, button labels/hit targets, textarea contrast, resize affordance, and resolved-history disclosure;
* preserve close/delete semantics and require an accessible label for the `✕`; preserve drag exclusion for textarea/input/button and coordinate math;
* keep Light Mode user colors readable; retain the dedicated dark warm-note variables and cool AI Review variables (`styles.css:7327-7406`), testing color input and custom colors for contrast;
* density currently hides/scales node content only, not Post-its. Compact/Standard/Detailed must keep conversations readable and interactive; density must not truncate replies, change counts, or alter positions;
* no Post-it-specific responsive rule exists. At narrow Canvas viewports, focus should pan rather than reflow Board coordinates; controls may wrap within the card without moving the card.

## 9. Placeholder localization and migration

The root composer uses a hard-coded actual placeholder: `Kommentar (auch mit Emojis 😊)` (`index.html:845`). It is not inserted content and is not currently localized by `language.js`. Reply placeholder `Write a reply...` is dynamically hard-coded English (`app.js:14700`). Neither should be counted.

B3 should set the root placeholder at render through `uiText`:

* English: **Drop a thought, question, or wild idea…**
* German: **Gedanke, Frage oder wilde Idee …**

Add reply equivalents through localization as well. Do not write placeholders into `note.text`, do not save after changing language, and do not rewrite any non-empty record. Safest legacy strategy is display-only: empty/null text shows localized placeholder; all persisted non-empty strings—including exact old placeholder-looking phrases—remain authored content unless a future migration can prove provenance through a dedicated marker. No such marker exists today, so automatic text migration is **NO-GO**.

## 10. Emoji infrastructure and bounded picker

Existing emoji support is a five-item context-menu **reaction shortcut**, not a composer picker: 🔥, 👍, 👀, ✅, 💩 increment `node.reactions[emoji]` (`index.html:561-566`, `app.js:17301-17314`). Reaction pills and Unicode storage already preserve emoji as ordinary strings. Functional/user-visible emoji also include 💬 badges, 🤖/AI affordances, node action emoji, activity/status symbols, and any Unicode already authored in node, Post-it, reply, review, caption, or reaction text. All must remain unchanged.

No emoji-picker dependency, general insertion utility, or accessible palette was found. Reuse the bounded popover/menu interaction ideas already present, not the reaction mutation. B4 should implement a small in-repo Unicode palette:

* compact button adjacent to root and reply composers, localized accessible name “Insert emoji” / “Emoji einfügen”;
* `role="dialog"` or labelled palette with roving tabindex/grid arrow navigation, Enter/Space insertion, Escape/outside-click close, and focus return;
* snapshot `selectionStart/selectionEnd`, insert Unicode with `setRangeText` (fallback string slicing), restore caret after the inserted code units, dispatch the normal `input` path, and preserve surrounding text;
* use the same utility for editable human root and reply textarea, never generated read-only review text;
* stop propagation/pointer handling so palette use cannot start node/Post-it drag, Canvas pan/zoom, context menu, or resize;
* theme with existing surface/focus tokens, remain above the Post-it but below blocking dialogs, and clear on rerender/Board switch;
* no schema change: resulting emoji remain Unicode inside `text`; no large dependency is justified.

The placeholder must stop promising emojis in B3 even if B4 ships later.

## 11. Persistence, activity, collaboration, and safety matrix

| Operation | May mutate | Must not mutate |
|---|---|---|
| count/badge render | DOM presentation only | node/Post-it/review, activity, Board revision, autosave/history, approval/publishing |
| focus/pan/conditional zoom/highlight | transient viewport/focus/cycle state; cursor viewport presence | node/note coordinates, Board zoom persistence, hydration, activity, material |
| add root/reply | current `node.postits`, timestamps/author, activity, local draft/dirty/autosave, eventual Board revision | approval fingerprint solely because comment changed; publishing material |
| resolve/reopen | only selected note status/metadata, activity, save lifecycle | other surface resolution |
| delete | established record removal and save lifecycle | unrelated records/surface |
| generate review | AI API result inserted through established AI Review path, activity/save | human count for generated body |
| apply review fix | node material through existing preview/apply path | bypass of stale/access/approval checks |

Current comment handlers call `saveCampaignCanvasState()` directly, which writes local state but does not itself call `markUnsaved`; eventual server autosave behavior must be verified carefully in B1 rather than silently changed. Activity records include comment/reply/resolve/AI review types, but they are audit/display facts, never counting authority. Reopen currently logs `comment_added` rather than a distinct reopen event; correct separately if activity semantics are expanded.

Remote merge may replace a non-actively-edited node from the authoritative Board snapshot. After create/reply/resolve/reopen/deletion, every affected render path must call the one selector; collaboration merge and hydration must also recompute through normal node rendering. IDs deduplicate current records, not activity. Board ID/load generation guards prevent stale review/focus results from crossing Boards. Node deletion and Board switch must clear transient target/cycle/highlight state.

Comment/Post-it/review data is deliberately excluded from the material approval fingerprint by existing regressions; presentation/count changes must preserve that. Applying an AI fix changes node content and therefore can change approval/publishing eligibility. B1–B4 must not touch that path.

## 12. Regression inventory and gaps

### Existing relevant checks

Existing scripts cover browser parse/static contracts, private Board access roles/sharing, Canvas lifecycle/density, broad Post-it/dark-mode presence, A1 Inspector routing, collaboration presentation, autosave/Board persistence, Content Workspace material fingerprints, approval, and publishing. `check-bw33-4a1-inspector-indicator-routing.js` proves A1 routing is non-mutating but encodes the now-rejected destination and must be replaced, not treated as future truth.

### Required new coverage

No focused existing regression proves the following approved contract end to end:

* human root plus multiple replies, AI human responses, and combined count 6;
* empty/malformed/duplicate/deleted contribution exclusion;
* independent Post-it/AI resolution, resolved exclusion, visible/readable history, reopen restoration;
* count after create, typing, reply, deletion, hydration, whole-Board collaboration merge, conflict/reload, and stale AI result rejection;
* enforcement of one ordinary Post-it per normal node without blocking an AI Review;
* most-recent selection, timestamp tie-break, repeated cycling, resolved-only access, conditional zoom, exact highlight/focus, and stale target cleanup;
* no Board save/history/coordinate mutation from count/navigation and correct link/cursor updates after viewport changes;
* reduced-motion focus/highlight behavior;
* localized root/reply placeholders without authored-text migration;
* emoji selection/caret insertion/surrounding-text preservation, keyboard/Escape/outside/focus, drag/pan/zoom isolation, and Unicode persistence/reload;
* consistent Post-it typography, Light/Dark contrast, density modes, narrow viewport, resize, drag, resolve, close/delete, and reply hierarchy;
* removal of all A1-only comments/AI routes while retaining AI fix preview, generic Inspector behavior, Canvas conversations, activity routing, and existing private Board access.

Each phase needs source-contract tests plus a production-shaped DOM/browser lifecycle test. Tests should fixture legacy malformed/duplicate records rather than “repairing” them first.

## 13. Phased implementation plan and gates

### B1 — correct count and A1 cleanup: **GO**

1. Centralize non-mutating ordinary/AI classifiers and the pure count selector.
2. Use it for Canvas badge and reconcile list-view semantics.
3. Correct English/German count labels and zero/resolved-only behavior.
4. Remove only A1 generic Comments section, return-to-Canvas button, AI Review Inspector button, route state/functions/styles/strings/tests.
5. Preserve AI fix preview, Canvas conversations, activity links, access gates, and all mutations.
6. Add count, lifecycle, data-safety, and private Board regressions.

Separate a small B1a follow-up if enforcing the one-ordinary-Post-it creation invariant cannot be done without deciding how to present existing duplicates. Counting must ship defensively regardless; never delete legacy records.

### B2 — Canvas conversation focus: **GO after B1**

Implement stable DOM identities, target selection/cycling, exact rect measurement, conditional presentation-only zoom/pan, focus/live announcement, highlight, reduced motion, and lifecycle cleanup. Split into B2a (target identity/selection) and B2b (viewport/focus/highlight) if browser coverage cannot land atomically. **NO-GO** for calling current persistence-owning `setZoom`, rehydrating, or mutating coordinates.

### B3 — Post-it polish and localization: **GO after B1; may run independently of B2 only with conflict coordination**

Adopt explicit design-system typography inheritance, remove inline length-based shrinking, localize root/reply placeholders, improve hierarchy/contrast/hit targets/resolved disclosure, and test themes/densities/responsive behavior. Preserve sticky-note identity, colors, emojis, drag, resize, and mutations. Do not combine with B2 because both touch renderer/CSS and would obscure interaction regressions.

### B4 — emoji insertion: **GO after B3**

Add the bounded accessible Unicode palette and shared caret insertion utility without storage changes. Keep separate because focus/outside-click/Canvas gesture risks deserve isolated testing. **NO-GO** for a large dependency, reaction-count reuse, custom emoji data, or generated-review editing.

## 14. Long-term roadmap boundary (recorded, not immediate)

Do not mix B1–B4 with a Home Conversations/Activity surface, cross-Board summaries, unread/assigned state, deep links that load a Board and focus an exact surface, or AI consumption/learning from discussions. Those require explicit permissions, consent, privacy, retention, attribution, and memory governance. Temporary conversational context must remain distinct from durable Brand Brain memory; resolution is not consent to train, remember, publish, or promote content.

## 15. Required decisions recap

* **Exact model:** one ordinary human Post-it at most plus an optional AI Review Canvas surface per normal node; both can contain human contributions; there is no generic node-comment destination.
* **Count:** non-empty human Post-it root + every valid human reply under each open ordinary/AI surface; never generated AI content or resolved/deleted/empty/system content.
* **Shapes:** root and replies are related but not identical; AI human responses reuse the reply mutation shape/system.
* **Resolution/history:** resolution is currently whole-note and independent per record; resolved contributions count zero. Current collapsed summary is recognizable but not fully readable, so B3 must add non-counting history disclosure.
* **Badge meaning:** open human contributions associated with the node, independent of unread state and storage objects.
* **A1 cleanup:** remove the generic Comments summary/return route and fake AI Review Inspector route; preserve genuine AI fix preview and all Canvas workflows.
* **Focus:** Board-generation-guarded presentation controller, stable surface IDs, DOM-rect measurement, Canvas scroll plus conditional non-persisting zoom, exact temporary highlight, no coordinate mutation/reload.
* **Placeholder:** localized actual placeholder only; never rewrite non-empty stored text without provenance.
* **Emoji:** reuse lightweight popover/focus patterns and Unicode insertion, not reaction mutation or a new schema/dependency.
* **Typography:** explicit existing design-system font inheritance and semantic sizing; preserve emoji fallbacks and sticky visual character.
* **Preservation:** all authored/functional emoji, Post-it movement, resize, color, replies, resolution, AI Review, activity, access, persistence, approval, and publishing boundaries remain intact.
* **First phase:** B1.
* **Gates:** B1 **GO**; B2 **GO after B1**; B3 **GO after B1**; B4 **GO after B3**. Implementation during this audit is **NO-GO**.
