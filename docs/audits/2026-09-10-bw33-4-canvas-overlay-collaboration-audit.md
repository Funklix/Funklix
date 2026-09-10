# BW-33.4 Canvas overlay, comments, AI Review, and collaboration presentation audit

**Date:** 2026-09-10
**Scope:** merged production sources (`index.html`, `styles.css`, `app.js`, `canvas-density.js`, `content-workspace.js`), existing non-mutating regression scripts, and no implementation changes
**Decision:** **GO for Phase A only. NO-GO for retiring either full comment or full AI Review Canvas presentation until the Inspector gaps in this audit are closed and production-shaped interaction coverage exists.**

## 1. Executive conclusion

The proposed direction is sound, but the current implementation does **not** have an Inspector comment surface and does **not** have a complete Inspector AI Review surface. “Comments” are not an independent service-backed thread model: they are `node.postits`, saved inside the Board Canvas document. AI Review has two representations: the authoritative review result is formatted into a special `source: "ai_review"` Post-it, while only an Apply Fix preview lives transiently in the Inspector. Comments and AI Review therefore share the Post-it record/presentation pipeline, not a distinct open-state model or API.

The safest first implementation is a deliberately additive **Phase A1 — node selection plus explicit Inspector route/focus state**:

1. introduce one local route such as `{ nodeId, section: "comments" | "ai-review", returnFocus }`;
2. make the existing comment badge and a new/derived AI Review indicator select the exact node, force the Inspector open, and focus an appropriately labelled section;
3. clear the route on Board-load generation changes or missing nodes, but retain it across density changes;
4. leave every Post-it, AI Review card, listener, API call, and persistence path untouched.

This is **GO** because it is additive and establishes ownership before anything is hidden. Comment overlay retirement is currently **NO-GO**: no Inspector thread UI exists. AI Review overlay retirement is currently **NO-GO**: the Inspector has only suggested-fix loading/error/apply/dismiss, not the review summary, details, retry, replies, resolve/reopen, or review history.

The highest-risk boundary is that ordinary comments, resolved threads, replies, and AI Review output are all spatial `.postit` children recreated inside a node. Hiding/removing “comment overlays” indiscriminately would also hide the only full collaboration UI, AI Review action origins, and potentially user-authored Post-its. Migration must discriminate by intent/record (`source === "ai_review"` versus ordinary records), not merely by `.postit` class.

## 2. Terminology and architectural facts

* A **Board node** is a persisted object in `state.nodes`; a rendered `.node[data-id]` is its replaceable DOM view.
* A **comment/Post-it record** is an object in `node.postits`. There is no separate comment API, thread collection, or stable comment DOM ID.
* A **Canvas comment thread** is a `.postit` subtree rendered inside its owning node. It is visually floating but is not a portal, modal, or detached panel.
* An **AI Review** is requested from `/api/review-node`; its response becomes an AI-authored Post-it. “Apply Fix” calls `/api/apply-review-fix`; that fix preview is transient local application state and appears in the Inspector.
* **Selection** is `state.selectedIds` plus `state.selectedPrimary`. “Active node” has no separate authoritative variable. `state.contextNodeId` is only the context-menu target and can compete conceptually with selection.
* **Open comment thread** is only `state.commentThreadsOpenedByNode` plus node CSS classes. It does not hide other threads; `openNodeCommentThread` adds `.comments-open`, highlights, records seen state, and scrolls the first Post-it. Thus multiple full Post-it sets are normally visible and multiple nodes can be marked opened.
* **Density** is presentation-only: `canvas-density.js` stores `tendra.canvasDensity.v1` and applies `data-tendra-canvas-density` to `#canvas`. It does not render nodes or own Board state.

## 3. Surface inventory, DOM/event ownership, and lifecycle

### 3.1 Node-bound Canvas surfaces

| Surface | Renderer/update | Open / close and event owner | DOM contract and binding | Lifecycle and focus |
|---|---|---|---|---|
| Comment counter/badge | `updateNodeCommentBadge(node,nodeEl)`, called by `updateNodeCard` | A listener is attached directly when the button is first created. Click stops propagation, creates a blank Post-it if none exists, then calls `openNodeCommentThread(node.id)`. There is no explicit close action. | Dynamic `button.node-comment-badge` inside `.actions` (or node fallback); no ID/data attribute. Node association is the closure plus ancestor `.node[data-id]`; no Board binding. | Survives in-place `updateNodeCard`, but not node removal/recreation. It is keyboard reachable as a native button, titled but lacks a node-specific accessible name. Density does not recreate it. Board hydration recreates it with nodes. |
| Full ordinary thread/Post-it | `renderPostits`; template `#postit-template` | Direct listeners are installed on color, textarea, Resolve/Reopen, delete, Reply/Send, and pointer drag every render. No thread close. | Each clone is `article.postit` positioned inside the owner `.node[data-id]`; the record ID is **not** put on DOM. Children: `.postit-user`, `.postit-time`, `.postit-color`, `.postit-resolve`, `.postit-delete`, `.postit-text`, dynamic `.postit-avatar`, `.postit-replies`, `.postit-reply`, `.postit-reply-button`, `.postit-reply-editor`, `.postit-reply-input`. | All `.postit` children are removed and rebuilt by `renderPostits`. Focused Post-it editing suppresses that call via `nodeHasActivePostitEditor`; otherwise rerender destroys focus/listeners. No focus entry/return contract and no Escape close. Density leaves it in place. Board switch removes its node. |
| Resolved thread | `renderPostits` | Resolve/Reopen direct button listener toggles `note.resolved`; resolved UI still has Reopen. | Same `.postit.is-resolved`; `.postit-text` is removed and replaced by `.postit-resolved-summary`. Replies are summarized as hidden. | Recreated after toggle. Resolution metadata is persisted, but resolved body/history is not readable in the collapsed Canvas result except the summary. |
| Replies | `renderPostits` | `.postit-reply-button` creates an editor; Send is a direct listener. No cancel/Escape. | Nested in owning Post-it; association exists only by closure to `node` and `note`. | Editor is DOM-only and lost on rerender, density-independent, and lost on Board switch. Draft text is DOM-only. |
| AI Review Post-it/body | `addAiReviewPostitToNode`, then `renderPostits`; `parseAiReviewText` and `renderAiReviewCard` | Review is triggered by `#review-node-btn`/other wired Review actions. Accordion uses native `details`; Apply Fix has a direct listener. Resolve, delete, reply, color and drag share ordinary Post-it handlers. No full-body close. | `.postit.ai-review-postit` inside node; `.ai-review-card`, heading/score, four `.ai-review-section-*` detail blocks, `.ai-review-improvement-row`, `.ai-review-apply-fix`. Record identity is `source: ai_review`/AI author fields, not DOM data. | Rebuilt with the Post-it. Accordion expanded state is DOM-only and lost. Apply Fix transfers to Inspector. Review-request loading exists only on the triggering button/save-status, not as persisted per-node state. |
| Owner/assignment chip | `updateNodeOwnerChip`; Inspector `populateOwnerSelect` | Chip has no action. Inspector select owns assignment changes through form listeners. | `.node-owner-chip` in the node template; no ID/data binding beyond owning node. Avatar classes are shared with owner displays. | Updated in place; hidden when unassigned; recreated with node. Tooltip is `title` only. |
| Node collaboration presence | `renderNodePresenceBadges` / clear helpers | Avatar click/follow controls are direct listeners; presence polling and Canvas input/focus listeners publish selection/edit/cursor. | Dynamic `.node-presence-overlay` under a node, containing `.node-presence-avatar`/`.node-presence-extra`; node binding comes from placement and presence records (`selectedNodeId`, `editingNodeId`, `hoveredNodeId`). | Recomputed from `state.presenceViewers`; presentation is ephemeral. Board lifecycle/polling controls it. Not persisted in Board. Buttons can be keyboard accessible, but no managed focus after rerender. |
| Node actions/AI toolbar, role/status badges | node renderer plus `updateNodeCard` | Predominantly direct listeners on dynamic controls. | Inside node/zoom layer; role attributes/classes and ancestor `data-id` provide association. | Recreated with nodes. Compact CSS hides `.node-ai-toolbar` and content descendants; status/comment/owner/presence are not part of that hide selector. |

### 3.2 Canvas-wide, viewport, and stable-detail surfaces

| Surface | Owner and binding | Position/stack/lifecycle | Accessibility/event observations |
|---|---|---|---|
| Inspector | Static `aside#inspector-panel`; `fillInspector`, `renderInspectorAiWorkspace`, `synchronizeAppShell`, `closeInspector` | App-shell column at ≥1024px and overlay below it. Bound only to `state.selectedPrimary`; `data-inspector-open/mode` live on `.app-shell`. Static DOM remains and is hidden/inert rather than removed. | `aria-label`, `aria-hidden`, `inert`, close button, Escape in overlay mode, and return to selected `.node[data-id]` or Canvas exist. There is no section route, heading focus, or comment/AI Review full-detail announcement. This legacy DOM **must remain**. |
| Board activity panel | Static activity DOM; `renderActivityFeed`, activity toggle | Shell surface, not node-attached. State is Board-serialized `activityFeed`; unread seen-time is localStorage and user/Board scoped. | Activity can route comment entries through `openNodeCommentThread`; this dependency must be rerouted, not deleted. Unread is visual text/class; no proven live announcement. |
| Global presence strip | Static `#presence-lite`, `#presence-avatars`, `#presence-count`; `renderPresenceLite` | Navigation/toolbar surface. Buttons are recreated; not zoomed. | Buttons have titles/ARIA labels and can open the follow menu. Count is not explicitly live. |
| Follow menu | `openCollaboratorFollowMenu` creates `.collab-follow-menu[role=menu]` in `document.body` | Fixed viewport coordinates, z-index 1200; removed and recreated. Outside pointer closes. | Items are native buttons, but focus is not moved into menu or restored; no arrow-key/Escape menu semantics beyond global removal. |
| Follow indicator/focus pulse/cursors | `renderFollowModeIndicator`, `pulseCollaboratorFocus`, `renderCollaboratorCursors` | Indicator is body-level fixed z-index 1100. Cursor layer is Canvas-level overlay z-index 30, coordinates multiplied by zoom. Pulse is transient. | Stop is a button; cursor/focus pulse is visual only. |
| Context menu | Static `#context-menu`; Canvas `contextmenu`, document click, item listeners | `position: fixed`, client coordinates, z-index 40. Hides with `.hidden`; must remain because listeners and stable element references depend on it. | No declared menu role/focus transfer/Escape close; pointer-owned. `state.contextNodeId` is distinct from selection. |
| Filters/utilities popovers | Dynamic body children `#floating-filters-popover` and `#floating-utilities-popover`, `.floating-filter-popover` | Fixed/viewport-coordinate body portals, z-index 1200; each recreated, removed on outside click. Density choice lives here. Both can compete with other body portals, though opening logic only toggles its own type. | Delegation occurs on each popover root (`button[data-filter-*]`, `[data-canvas-density-choice]`, `[data-utility-action]`). No role on container, focus transfer/return, or Escape handler. |
| Share toast/editor popover | Dynamic body `#share-link-toast.share-link-toast[role=status][aria-live=polite]` | Fixed, anchor-clamped, z-index 90; timer/outside pointer removes it. | Proper status/live semantics for feedback, but interactive editor variant behaves like a popover without managed focus. |
| Tooltips | Native `title` attributes on comment, owner, avatar, time, and many buttons | Browser-managed; no shared tooltip DOM or z-index. | Pointer discovery is stronger than screen-reader/node association; do not treat as equivalent to an Inspector description. |
| Notifications | `setSaveStatus` stable status plus share toast, `.cw-feedback` fixed bottom-right z-index 30, transient pulses | Not node-bound. Several independent systems can coexist. | Share/CW feedback has live status in relevant render paths; AI Review loading/error is not consistently live. |
| Dialogs/overlays | Native static dialogs (settings, comparison, workspace detail, disconnect) plus dynamic fixed overlays for import/type-picker/lightbox/creation/confirmation and Content Workspace dialog | True blockers use fixed backdrops from about z-index 10,000 upward; lightbox layers reach 20,000+. These correctly outrank Canvas content, but several implementations are separate systems. | Some use `role=dialog`, `aria-modal`, labelled headings, return focus and Escape; others use native dialog. Preserve true confirmations as dialogs. Audit any phase-specific dialog independently rather than applying Post-it rules. |
| Legacy review/collaboration panel | No separate legacy floating review panel was found. The AI Review Post-it is the floating legacy detail surface; activity/presence are separate stable systems. | N/A | Do not invent a common overlay manager where none exists. |

## 4. State ownership map and competing sources

| Concern | Authoritative state | Secondary/transient state | Duplication/risk |
|---|---|---|---|
| Selected/active node | local `selectedIds`, `selectedPrimary` | `.selected` CSS, Inspector snapshot/dismissed ID, `contextNodeId`, presence-selected ID sent to server | Selection is canonical for Inspector, but context-menu and activity routes can open node content without first guaranteeing selection. |
| Active comment thread | local `commentThreadsOpenedByNode` | `.comments-open`, `.comments-highlighted`; localStorage seen map | The Set is not cleared by `applyCampaignState`; IDs can survive Board switching and collide with reused IDs. DOM class does not govern visibility. |
| Draft comment/reply | new blank record is immediately inserted into `node.postits`; its text changes mutate node | reply editor text is DOM-only until Send | A blank top-level “draft” is already persisted; reply draft is disposable. Inspector migration must explicitly match this behavior or improve it in a separately approved change. |
| Comment/resolved state | `node.postits[]`, note `resolved`, resolver identity/time, replies | local seen timestamps in `funklix.commentSeen.<board>.<user>` | No comment API/record store. UI language calls Post-its comments. |
| AI Review open/closed | no app-level full-review open flag | native `details.open`, node always renders AI Post-it | Accordion state disappears on rerender. There is no Inspector review-route state. |
| AI Review loading/error | triggering button text/disabled and global save status for `/api/review-node` | `aiReviewFixPreviews[nodeId].status` for `/api/apply-review-fix` | Two request lifecycles are different. Only fix preview is node-keyed; neither has Board ID/generation guards in its state. |
| Collaboration | server presence endpoint response in `presenceViewers`; local timers/edit/cursor/follow fields | rendered avatars/cursors/menus | Ephemeral, poll-based; not Board document data. Node ownership (`ownerEmail/name/avatar`) is separate durable Board node data. |
| Post-it | `node.postits`, `postitCounter` | DOM editing/focus, textarea height, accordion state | Comments and AI Review reuse Post-it storage and renderer. |
| Inspector section/tab | none | visibility of `#ai-workspace-section`; scroll position | Missing route is the prerequisite for Phase A. Inspector dismissal is node keyed, not section keyed. |
| Popover/dialog | mostly DOM existence/open attribute | a few explicit variables (`activeLightbox`, request/lifecycle structures) | No unified overlay registry; multiple surfaces can coexist. |
| Density | `TendraOnePresentation.canvasDensity` session value and localStorage | `#canvas[data-tendra-canvas-density]` | Correctly independent of Board/selection; should remain so. |

### Board-switch correction required in Phase A

`applyCampaignState` clears selection and recreates nodes, which closes the Inspector through synchronization, but it does not clear `commentThreadsOpenedByNode` or `aiReviewFixPreviews`. A new section-route must carry `{boardId, boardLoadGeneration, nodeId}` and be invalidated at Board-load start/apply. Phase A should also clear those existing node-keyed transient maps on Board switch (without altering persisted records); otherwise same-ID nodes can inherit “opened” or fix-preview state.

## 5. Persistence and collaboration boundary

| Operation | Dirty/autosave/revision | API/event boundary | Approval / Content Workspace / publishing |
|---|---|---|---|
| Add ordinary Post-it | `saveCampaignCanvasState()` writes the serialized Canvas to browser storage; normal Board saving/autosave later writes `canvas_json`. Activity is appended. | No comment API. Activity is embedded in Board Canvas state, not a separate activity service. Presence polling later exposes changed Board state to collaborators. | Comments/AI are explicitly excluded from the Content Workspace material approval fingerprint; comment presentation should not invalidate approval. No direct publishing eligibility change. |
| Edit text/color/drag/delete/reply/resolve/reopen | Mutates `node.postits`; handlers call local Canvas save (and activities where implemented). Board revision changes when the Board document is server-saved, not through a comment endpoint. | No dedicated collaboration event; Board refresh/merge and presence are separate. Resolve logs `comment_resolved`; reopen currently logs `comment_added`, which is semantically lossy. | Must remain outside material fingerprint and publishing eligibility. |
| Assign owner | Mutates durable node ownership via Inspector/form path and Board persistence; status/activity UI can expose it. | Presence supplies candidate identity but is not authoritative ownership. | Owner is projected in Content Workspace and may affect workflow filtering, but presentation relocation does not alter it. |
| Run AI Review | `/api/review-node` request; result is converted to an AI Post-it then local Canvas save/activity. | AI request plus later Board persistence; no separate review store. | AI Review is advisory and fingerprint-independent. Content Workspace only projects whether AI Review is present; it remains separate from human approval/readiness. |
| Apply AI recommendation | `/api/apply-review-fix`, transient preview, then mutates `node.content`, logs node update, saves | This is a material content mutation and normal Board synchronization follows. | **Does** change approval fingerprint and can invalidate current approval/readiness/publishing eligibility because node content changes. This is the highest persistence-sensitive AI action. Moving its button must retain the same apply function and stale/read-only checks, and should add Board-generation guards. |
| Presence/follow | no dirty state/autosave/revision | presence ping/poll only | No approval or Content Workspace mutation. |
| Seen/unread | no Board dirty state | browser localStorage scoped by Board and user | No shared collaboration or approval effect. |
| Density/Inspector route | no Board dirty state | browser presentation preference/local application state | No revision, fingerprint, Content Workspace, or publishing effect. |

Moving rendering and event entry points to the Inspector does **not inherently change persistence or collaboration**. Safety requires handlers to keep mutating the same `node.postits`/node content and calling the same save/activity/API functions. Introducing a comment API or moving records out of `canvas_json` is explicitly out of scope.

## 6. Density, node-role, and indicator behavior

The density CSS applies identically by node role: Compact hides `.content`, expansion content, image strip, tags, A/B tests, social preview, compact summary, and the node AI toolbar. It does **not** hide `.postit`, `.node-comment-badge`, `.node-owner-chip`, or node-presence overlays. Standard clamps `.content` and hides image/A-B detail; Detailed is the unmodified renderer. Consequently:

* every role retains the comment badge if `updateNodeCard` created it;
* every role retains full ordinary and AI Review Post-its in all three modes;
* Compact hides the AI action toolbar that can originate a review while leaving completed AI Review Post-its and Apply Fix controls visible;
* there is no dedicated compact AI Review badge/state—only the AI Review Post-it/comment count and perhaps generic status;
* comment status is duplicated by the badge, full Post-it(s), activity feed, and list/Content Workspace projections;
* current badge click does not first select the node or focus/open Inspector; it only opens/highlights the Post-it set;
* density switching only changes an attribute and redraws connections; it does not close/remove Post-its, clear `.comments-open`, reset accordions, or route Inspector state;
* Post-its do not inherit the Compact hidden-descendant selector, so they remain large and defeat Compact’s density benefit;
* connection redraw accounts for node geometry, not collision boxes of Post-its. Open/full Post-its are not routing obstacles.

This proves the reported stale-origin pattern: Compact can hide the node AI toolbar while its AI Review Post-it remains. It does not currently hide the comment badge, so the ordinary comment origin remains visible.

## 7. Positioning, collision, and stacking-context map

### 7.1 Coordinate spaces

1. `#canvas` is the scrolling/clipping viewport.
2. `.canvas-scroll-surface` establishes the very large Board extent.
3. `#zoom-layer` is absolutely positioned at the origin with `transform: scale(state.zoom)` and top-left transform origin. Nodes, node-contained Post-its, node presence, and connection SVG participate in this Board/zoom space.
4. A Post-it has absolute `left/top` relative to the positioned node; it scales with zoom and moves with Canvas scroll/pan. Its coordinates are local to the node. It can extend outside node bounds and overlap adjacent nodes, handles, and links. Node overflow permits the intended spatial spill.
5. Cursor presence uses a Canvas overlay with Board coordinates converted by zoom; it moves with the viewport but is visually above nodes.
6. Context menu is fixed to viewport client coordinates though stored context point is Board-relative.
7. filter/utilities/follow/share surfaces are body-level, viewport-coordinate pseudo-portals and do not scale/pan.
8. Inspector is app-shell-contained: desktop column or narrow viewport overlay; it neither scales nor pans.
9. dialogs/lightboxes are viewport-fixed blockers above the shell.

### 7.2 Effective stack order

From low to high (values with different stacking contexts remain context-dependent):

* Canvas connection/content base: roughly z-index 1–3.
* comment badge: z-index 5; node presence: 8; selected/expanded node rules reach 9.
* collaborator cursor layer: 30; context menu: 40; shell/nav surfaces commonly 50–80; share toast: 90.
* follow indicator: 1100; floating filters/utilities and follow menu: 1200.
* blocking overlays/dialogs: 9999–13,000; lightbox content/backdrop: about 20,000/20,001.

Post-its have no independent high z-index in their base rule and inherit their node’s stacking order. Therefore selecting/raising one node can raise all its Post-its over another node; two nodes’ Post-its cannot be globally interleaved by thread priority. Node presence and badges can cover Post-it/header areas. Body-level menus outrank Canvas content and can overlap the Inspector/navigation. True dialogs correctly dominate all of them.

### 7.3 Collision findings

* Multiple Post-its and multiple AI Review Post-its can exist per node and across nodes simultaneously; there is no collision avoidance or single-open invariant.
* Post-it `left/top` is unbounded; drag does not prove edge clamping. It can create practical horizontal/vertical Board overflow and obscure the owner node.
* `.postit-text` is vertically resizable, but the Post-it itself has no independent resize model/handles or persisted width/height. User resize height is DOM-only and can be lost on rerender.
* Post-its intercept pointer input. Their textarea/scroll-body is specially exempted from Canvas wheel handling; other parts can compete with node drag/pan/selection, though direct handlers stop some propagation.
* Links do not route around Post-its; handles may be covered and no redraw can solve collision because Post-it geometry is not an edge-routing input.
* Narrow mode turns Inspector into an overlay, increasing the chance of covering the selected node. Return focus exists on close, but indicator-to-section focus does not.
* Body popovers clamp some left/top coordinates but do not share collision management and can overlap each other, navigation, Inspector, or narrow viewport edges.

## 8. Inspector capability matrix

Legend: **Yes** complete today; **Partial** exists only through another surface or for Apply Fix; **No** absent.

| Capability | Canvas today | Inspector today | Required before retirement |
|---|---:|---:|---|
| View full ordinary thread | Yes | **No** | Render selected node’s Post-it records with stable record keys. |
| Add comment | Yes | **No** | Reuse `addPostitToNode`; do not create a second store/API. |
| Reply | Yes | **No** | Extract/reuse reply mutation and activity/save behavior. |
| Edit | Yes, top-level text | **No** | Preserve edit permissions, immediate-save semantics, identity/timestamps. No reply edit exists, so do not invent it in cleanup. |
| Delete | Yes, top-level | **No** | Reuse deletion semantics; no reply delete exists. |
| Resolve / reopen | Yes | **No** | Reuse toggle and resolution metadata/activity; expose state text, not color alone. |
| Author / timestamp | Yes | **No** | Render author name/avatar and machine-readable time. |
| Unresolved count | Badge | **No** | Add labelled count/heading. |
| Resolved history/body | Partial: summary, body hidden | **No** | Add explicit resolved-history disclosure with replies/body; do not discard records. |
| Read AI summary/detail/strengths/recommendations/rewrite | Yes, AI Post-it | **No** | Reuse `parseAiReviewText`/review-card primitives in selected-node Inspector section. |
| Trigger/regenerate AI Review | Inspector has `#review-node-btn` | **Partial** | Trigger exists; label result destination and retain request handler. There is no distinct “regenerate” history policy. |
| Retry failed review | Trigger can be pressed again after failure | **Partial** | Add node-bound error and Retry action with live status; current failure is global save text only. |
| Review loading/error | Trigger button + save status | **Partial** | Inspector section needs `aria-live`/`role=status|alert`, node ID/generation guard, and disabled/retry lifecycle. |
| Act on recommendation | Yes, Apply Fix in AI Post-it | **Partial** | Inspector shows only the resulting suggested-fix preview after action begins. Move/copy the originating recommendation actions first. Reuse `/api/apply-review-fix`, apply/dismiss. |
| Suggested-fix current/suggested/explanation | Handoff from Post-it | **Yes** | Already complete in `#ai-workspace-section` for loading, error/dismiss, ready/apply/dismiss; error lacks retry. |
| Navigate back to node | Node already spatial owner | **Partial** | Inspector close returns focus to selected node; add “Show/focus on Canvas” and return to originating indicator. |

No ordinary comment function is complete in the Inspector today. The complete AI subset is only the suggested-fix preview lifecycle (except retry), plus the Review Node trigger. Before hiding Canvas detail, the Inspector must gain all missing functions listed above.

## 9. Post-it preservation audit

Post-its are first-class **spatial annotations attached to nodes**, not independent graph nodes:

* **Create:** context/selected-node action or first badge click calls `addPostitToNode`, requiring signed-in comment identity.
* **Edit:** textarea updates note text/timestamps and saves; user-authored emoji text is preserved.
* **Drag:** `enablePostitDrag` changes note-local `x/y` and saves. Dragging is direct Canvas behavior.
* **Resize:** only textarea vertical resizing is supported; no persisted Post-it dimensions. Do not claim full object resize support.
* **Delete:** top-level note delete exists. Reply delete/edit is unsupported.
* **Comments:** in this code, Post-its *are* the comment records and can contain replies. There are no comments on Post-its separate from replies.
* **Identity:** author name/email/avatar and created/updated timestamps; replies carry identity. Identity is required for creation/reply.
* **Resolve:** supported with resolver identity/time; Reopen supported. Resolved body/replies become summarized/hidden on Canvas.
* **Color:** user color picker persists `note.color`; default playful yellow. AI Review uses blue and distinct source/author markers.
* **Selection:** no independent selected-Post-it application state. Interaction occurs inside the selected or unselected owning node; clicking a Post-it does not guarantee node selection.
* **Connections:** Post-its cannot own edges/handles. Their parent node can connect; Post-it geometry is ignored by edge routing.
* **Persistence/collaboration:** embedded in serialized node/Board Canvas state; local save then normal Board autosave/revision/refresh behavior. No separate comment realtime channel.
* **Density:** always visible in all modes; Compact does not shrink/hide it. This preserves access but creates overload.
* **Dark Mode:** explicit warm Post-it palette, contrast/focus/resolved rules, and a separate AI Review shell already exist and have deterministic contrast checks.
* **Layering:** node-local absolute object, unbounded collision, no independent z-index.

Recommendation: preserve user-authored Post-its as spatial Canvas objects in all densities. Bounded Phase D polish may clamp drag to reasonable Board bounds, add an accessible drag/position alternative, keep headers/actions readable, avoid handles, improve selected/edited outlines, retain warm user colors in Dark Mode, and optionally collapse **thread chrome** without moving the authored Post-it’s primary text. Do not convert user Post-its into Inspector-only comments. Product clarification will be required to distinguish deliberately spatial Post-its from “full comment threads,” because today they are the same record/type.

## 10. Emoji inventory and preservation rule

| Class | Examples/areas | Recommendation |
|---|---|---|
| Functional emoji | `💬` comment count, `🤖` AI Review, `🧠` Generate Next Step, `🔍` Review Node, `✨` Improve, `🔄` Regenerate, `🖼` image badge, `★` favorite | Preserve text and meaning. Add accessible labels where emoji is the only cue; mark duplicate decorative glyph spans `aria-hidden` when the button already has a name. |
| Navigation/presentation emoji | navigation/workspace and node-role icon strings produced by existing templates/language data | Preserve unless a verified duplicate accessible announcement exists. Density cleanup is not an icon redesign. |
| User-authored emoji | Post-it textarea explicitly invites emojis; node/comment/reply text may contain arbitrary Unicode | Preserve byte/content semantics through Inspector rendering and edits. Never normalize/remove. |
| Reaction data | Simulator/content reaction copy and outcome indicators; no dedicated Post-it reaction model was found | Preserve stored/generated data. Do not misclassify it as decorative clutter. |
| Decorative emoji | illustrative icon+text combinations in actions/empty states | Retain playful character; only deduplicate screen-reader speech with markup, not visual removal. |
| Collaboration | avatars/initials and status text rather than a dedicated reaction emoji system | Preserve identity; do not replace it with ambiguous color/emoji alone. |

No cleanup phase should remove emojis merely to conventionalize the UI.

## 11. Accessibility findings and required contract

### Current strengths

* Comment/Resolve/Reply/AI actions are native buttons; textareas and native `details/summary` are keyboard-operable.
* Hidden Inspector is `inert` and `aria-hidden`; narrow overlay closes on Escape and returns focus to the selected node or Canvas.
* share feedback has `role=status`/`aria-live=polite`; several true dialogs are labelled/modal.
* Dark Mode supplies explicit focus and non-color styling for key Post-it/AI surfaces.

### Gaps

* Comment badge accessible name is only `💬 N` plus a generic `title`; it does not name the owning node or announce unread/resolved meaning reliably.
* Opening a thread does not focus it, announce it, or preserve a return target. There is no close/Escape concept.
* Post-it DOM lacks stable record IDs/data attributes and programmatic association with node heading/Inspector context.
* Reply drafts have no Cancel/Escape and are destroyed on rerender; resolved body/history is removed from the DOM presentation.
* AI review request loading/error is global/button text, not an Inspector live region; Apply Fix error has no retry.
* Follow/menu/popover code does not transfer/contain/restore focus or implement menu keyboard navigation.
* Context menu is pointer-first and lacks proven menu semantics.
* unread badges/dots and collaborator cursor/focus pulses are partly visual/color-only; presence count is not live.
* zoom-scaled Post-it controls may become too small; narrow Inspector can obscure its origin.

### Target focus contract

On indicator activation: capture the activating element and Board generation; call the canonical select routine; force the Inspector open; update the explicit section route; scroll the section with reduced-motion awareness; focus a section heading (`tabindex=-1`) or first relevant control; announce “Comments/AI Review for [node title], N unresolved.” On close/back: if the captured indicator remains connected and belongs to the same Board/node, return focus there; otherwise return to `.node[data-id]`, then Canvas. Escape closes only the narrow overlay Inspector (existing behavior); desktop section navigation should provide an explicit Back to Canvas control rather than unexpectedly closing the column.

## 12. Target architecture, proven constraints

### Canvas node contract

* retain a compact comment count, unread/unresolved attention state, a compact AI Review state, useful presence, owner, role/status, and functional emojis;
* every indicator carries/derives node ID and invokes one canonical `openInspectorSection(nodeId, section, origin)` path;
* no full AI Review body floats over a node after Phase C;
* ordinary collaboration detail moves to Inspector only after the product explicitly separates “thread chrome” from preserved spatial user Post-its;
* indicators remain available in Compact, Standard, and Detailed.

### Inspector contract

* static `#inspector-panel` remains the stable detail root;
* selected node is the sole displayed owner; section route is checked against Board ID/load generation/node existence;
* Comments renders all unresolved and resolved records and supports current mutations against `node.postits`;
* AI Review renders stored AI Post-it results, full request loading/error/retry, recommendations, and existing Apply Fix preview/actions;
* mutations reuse current API/save/activity/read-only boundaries;
* headings, counts, loading/errors, and focus are accessible.

### Canvas/global contract

* spatial user Post-its remain editable/drag-enabled;
* dialogs remain only for blocking confirmations; toasts/status stay bounded;
* presence stays ephemeral and ownership stays durable;
* density remains presentation-only and never clears selection/Inspector route.

Comments and AI Review share Post-it storage/rendering and some presentation helpers. They do not share request state: ordinary comments have none, review generation uses `/api/review-node`, and Apply Fix uses a separate transient preview/API.

## 13. Required visual-state matrix

| State | Expected target presentation |
|---|---|
| No node selected | No node-bound Inspector detail; Inspector hidden/inert; no stale section. Canvas indicators/Post-its remain. |
| Normal node selected | Clear selected outline and node identity in Inspector; no unrelated detail. |
| No comments | comment indicator remains an accessible “Add/open comments for [node]” entry with zero state; empty Inspector section can add. |
| Unresolved comments | count and non-color attention state on node; Inspector opens unresolved first with Resolve actions. |
| Resolved comments | quiet resolved/history affordance; no false unresolved alert; full history/reopen in Inspector. |
| Active collaborators | bounded node presence plus global presence; names/status accessible; no covering handles. |
| Completed AI Review | compact robot/state badge; full summary/detail only in Inspector; stored AI record preserved. |
| AI Review loading | node-bound busy state and Inspector live status; trigger disabled; stale result guarded by Board generation. |
| AI Review failure | labelled Inspector alert plus Retry; Canvas badge conveys failure without color alone. |
| Review recommendations | count/attention indicator; recommendations/actions in Inspector; Apply Fix retains preview/confirmation semantics. |
| Post-it selected | remain spatial with visible owning-node/annotation focus; no forced conversion into Inspector detail. |
| Post-it editing | editor, color, resolve/delete/reply remain reachable; rerender suppression prevents draft loss. |
| Compact | only node indicators plus preserved spatial Post-its; no full AI body/thread chrome. |
| Standard | same indicator/Inspector behavior; modest node content; no alternate state source. |
| Detailed | same indicator/Inspector behavior; richer node content but no duplicate full review body. |
| Light Mode | current playful color families and sufficient contrast/focus. |
| Dark Mode | current warm Post-it and dark AI tokens retained; no color-only states. |
| Narrow viewport | Inspector overlay avoids permanent width loss; heading receives focus; close returns to indicator/node; surfaces fit viewport. |
| Inspector open | exactly one selected-node context and explicit active section. |
| Inspector collapsed | supported today as “dismissed for selected node,” not a persistent collapsed rail; indicators force reopen for routed detail. |
| Board switch | increment generation, clear selection, section/origin, opened-thread Set, fix previews, popovers/menus tied to old Board; hydrate new Board before density marker. |
| Density switch with detail open | retain selection, Inspector route, scroll/focus where feasible; update only Canvas marker/menu and redraw links; no stale Canvas body. |

## 14. Regression coverage and gaps

### Existing deterministic coverage

* `check-browser-script-integrity.js`: browser script ordering/parsing/integrity; relevant baseline, not interaction coverage.
* `check-bw27-4-canvas-component-polish.js`: Post-it template, drag, textarea resize, resolve toggle, colors, AI Review Post-it/card, Apply Fix endpoint, persistence fixtures, Dark Mode contrast fixtures.
* `check-bw27-6-canvas-dark-mode-controls.js`: Post-it/AI distinction, replies/resolution, 44px controls, node/Post-it drag, save call, Canvas dimensions, scoped Dark Mode controls.
* `check-bw30-1-app-shell-inspector-layout.js`: Inspector support per view, desktop column/narrow overlay, inert/ARIA state, stale selection, close/focus return, Escape, responsive breakpoint, Dark/Light contract.
* `check-bw31-2-content-review-workflow.js`: human editorial resolve/reopen transitions (not comment Resolve/Reopen), fingerprint independence of comments/AI, Content Workspace synchronization, dialog accessibility/theme/responsive behavior.
* `check-bw33-3r1-canvas-density.js`: preference fallback, all modes, post-hydration Board/generation guard, presentation isolation, stylesheet scoping, no dirty/history/Inspector mutation.
* Board association/isolation/loading scripts cover broader Board boundaries, but not open node-detail cleanup.

### Missing production-shaped coverage

There is no dedicated comment/collaboration/AI Review/Inspector integration regression. Existing checks are mainly source-contract and VM fixtures, not a rendered browser geometry/focus flow. Missing:

1. full add/edit/delete/reply/resolve/reopen comment round-trip in rendered Inspector;
2. comment identity/avatar/timestamp and resolved-history rendering;
3. AI Review trigger → loading → success/failure/retry → recommendation → Apply Fix with stale Board guard;
4. selected-node ownership when clicking every badge/activity item/list entry;
5. Inspector section routing, focus entry, announcement, Escape, and focus return;
6. density switch while comment/AI detail is open;
7. Board switch during review/fix request and with open detail; clearing same-ID stale state;
8. multiple simultaneous Post-it/AI/menu collisions;
9. actual browser bounding boxes, clipping, horizontal/vertical overflow, handle/link interception, and real stacking contexts;
10. narrow/mobile viewport with Inspector, keyboard, zoom, and popovers;
11. Post-it preservation in all densities after overlay retirement;
12. collaboration polling/cursor/follow menu keyboard semantics and node association;
13. rendered Light/Dark screenshots or computed-style contrast for the final architecture;
14. connection behavior with large/open spatial annotations.

These gaps must be added as focused regressions during their implementation phases; this audit does not manufacture passing tests that do not exist.

## 15. Smallest safe implementation phases

### Phase A1 — selection and Inspector routing (**recommended first; GO**)

* Add Board-generation-scoped local section route and origin reference.
* Canonically select the node before opening Comments/AI Review.
* Force/open Inspector and focus a labelled placeholder or existing AI Workspace section.
* Preserve all current Canvas presentation and handlers.
* Clear transient routes, opened-thread state, and fix previews on Board switch; retain route across density switch.
* Add rendered tests for selection, focus, density, Board switch, narrow layout.

This is safer than the originally proposed Phase A as one broad change because the comments section does not exist. A1 establishes routing with no presentation retirement.

### Phase A2 — complete Inspector comment capability

* Add selected-node Comments section using extracted shared record mutation functions.
* Provide view/add/edit/delete/reply/resolve/reopen, authors/times/counts/history/read-only behavior.
* Keep spatial Post-its unchanged and verify persistence/activity/unread behavior.

### Phase A3 — complete Inspector AI Review capability

* Render stored AI Review Post-it records using shared parsing/detail components.
* Add node-bound request loading/error/retry and recommendation actions.
* Preserve existing suggested-fix preview; add request Board/generation guards.

### Phase B — retire only full Canvas comment-thread chrome

* Do **not** hide all `.postit` elements.
* After product-level distinction is encoded, stop `openNodeCommentThread` from being the primary detail route.
* Keep legacy `#postit-template`, `.postit` record rendering, `renderPostits`, and mutation helpers while spatial user Post-its require them. If thread-only legacy subtrees are visually hidden, retain them until no direct listener/activity route depends on them.
* Route activity comment items to the Inspector.

### Phase C — retire Canvas AI Review body

* Make AI Review records indicator-only on Canvas while leaving their persisted AI Post-it records untouched.
* Route robot badge directly to Inspector AI Review.
* Preserve review trigger, retry, recommendations, Apply Fix preview/apply/dismiss, activity, and approval invalidation after material fixes.
* Only after no runtime path queries its DOM may `.ai-review-card` Canvas creation be removed.

### Phase D — Post-it and collaboration polish

* Retain spatial Post-its, colors, emojis, edit/drag/reply/resolve.
* Bound collision/readability/focus/Dark Mode improvements; avoid handles and improve narrow behavior.
* Improve presence/follow menu focus and layering without mixing durable owner data with ephemeral presence.

Separate phases materially reduce risk. In particular, Phase B and C should not be combined because AI Review depends on ordinary Post-it records but has separate requests/actions.

## 16. Legacy DOM and code that must remain through migration

* Static `#inspector-panel`, form controls, `#ai-workspace-section`, and `#ai-workspace-body`: stable references/listeners and responsive focus lifecycle depend on them.
* `#postit-template` and its child classes: user-authored spatial Post-its still require them; Dark Mode regressions explicitly enforce them.
* `.node-comment-badge` during all phases: approved compact count/unresolved entry point.
* `.node-owner-chip`, presence roots/overlays, activity panel, and `#context-menu`: distinct features with existing listener ownership.
* AI Review persisted Post-it records and parsing/mutation functions even after Canvas body retirement; presentation may hide/skip body, storage may not be deleted.
* Existing dynamic popover IDs/selectors until their event owners are replaced; hiding a body popover instead of removing it could leave document listeners/state active, so keep current removal lifecycle.

There is no need to preserve every generated `.ai-review-card` DOM node forever: it is recreated and has direct listeners, not stable identity. It may stop being created on Canvas only after Inspector equivalents and event extraction land. Conversely, removing `#postit-template` would break first-class Post-its and is prohibited.

## 17. Explicit required conclusions

* **Exact first phase:** Phase A1, additive selected-node/Inspector section routing, focus, and Board-generation cleanup; no visual removal.
* **Surfaces safe to become indicator-only eventually:** node-bound ordinary thread detail *only after spatial Post-it/thread distinction and Inspector parity*; AI Review summary/detail/recommendations after Inspector parity. Comment count/unresolved/unread, AI state, useful presence/owner, and Post-its remain.
* **Legacy DOM that remains:** Inspector roots/AI Workspace, Post-it template/classes/rendering for spatial notes, comment badge, presence/activity/context-menu roots, and persisted AI Post-it records.
* **Inspector complete today:** selected-node basic editing/owner/images/actions/context; Review Node trigger; suggested-fix loading/error display, current/suggested text, explanation, Apply and Dismiss; responsive open/close/inert and close focus return.
* **Missing before hiding:** all full comment operations/history; full stored AI review reading; node-bound review loading/error/retry; originating recommendation actions; section routing/heading focus/live announcements; robust stale Board guards.
* **Shared state:** comments and AI Review share Post-it storage/renderer; request/loading state is separate. They share more than presentation, so CSS-only retirement is unsafe.
* **Persistence/collaboration:** presentation movement does not change boundaries if current node mutation/save/activity/API functions remain. Apply Fix remains a material content change; density/route/seen/presence remain non-material.
* **Selected-node guarantee:** a single canonical route validates Board ID, generation and node ID, then updates `selectedIds`/`selectedPrimary`, selection classes, Inspector content and explicit section before focusing.
* **Focus:** capture indicator; focus labelled section heading/first action; announce context; return to connected same-node indicator, else selected node, else Canvas.
* **Density:** section route and selection survive; only Canvas marker/menu/link redraw change. No rerender or stale hidden origin.
* **Board switch:** invalidate route/request context; clear selection, opened-thread Set, fix-preview map and old popovers; then hydrate and apply density post-hydration.
* **Post-its/emojis:** user-authored spatial Post-its, their colors/edit/drag/replies/resolution, and all functional/user emoji remain. Phase D is bounded polish only.
* **Highest risk:** shared `node.postits` data and `renderPostits` event ownership across comments, AI Review, and spatial Post-its, compounded by missing Inspector parity and unguarded transient AI fix state.
* **Phase A decision:** **GO for A1.** **NO-GO for any Phase A interpretation that hides/removes Canvas detail or claims the current Inspector is authoritative for comments/full AI Review.**

## 18. Audit validation commands

The audit should be validated with existing, non-mutating commands. Relevant expected gaps are recorded above rather than reported as passing coverage. The intended command set is:

```sh
node --check app.js
node --check canvas-density.js
node --check content-workspace.js
node scripts/check-browser-script-integrity.js
node scripts/check-bw27-4-canvas-component-polish.js
node scripts/check-bw30-1-app-shell-inspector-layout.js
node scripts/check-bw31-2-content-review-workflow.js
node scripts/check-bw27-6-canvas-dark-mode-controls.js
node scripts/check-bw33-3r1-canvas-density.js
node scripts/check-bw5-board-brand-isolation-regression.js
git diff --check
git diff --cached --check
```

No existing command can honestly be described as a complete production-shaped overlay collision, simultaneous overlay, comment Inspector, AI Review Inspector, keyboard focus-routing, or real stacking/layout regression.
