# BW-30 App Shell, Inspector Lifecycle, and Full-Screen Layout Audit

**Audit date:** 2026-09-02  
**Scope:** documentation and static/runtime-path inspection only; no implementation is included.  
**Decision:** **GO for a narrowly scoped implementation, subject to the go/no-go gates in section 19.**

## 1. Executive conclusion

The authoritative application shell is the direct `body > .app-shell` grid. It owns three desktop tracks: the navigation rail (`#left-sidebar`), the active-workspace column (`main.workspace-wrap`), and the Canvas Node Inspector (`#inspector-panel`). The toolbar is `#canvas-topbar`; the active view is whichever direct section inside `.workspace-wrap` does not have `.hidden`; the Canvas host is `#canvas`; and the Inspector host is the sibling `#inspector-panel`.

The root cause is exact and reproducible from source: `.app-shell` permanently declares `grid-template-columns: var(--sidebar-width) minmax(0, 1fr) 340px`, while `.app-shell.sidebar-collapsed` permanently declares the same third `340px` track. `setActiveView()` hides `#inspector-panel` only for `home`; every non-home campaign destination leaves it displayed. Even where another path adds `.hidden`, hiding the grid item does **not** redefine the explicit third grid track, so the empty 340px track remains. The Inspector itself also declares `width: 340px`. At `max-width: 1300px`, CSS changes the shell to two tracks and hides `.inspector`, which masks rather than models the lifecycle.

Three concerns are currently conflated but must become independent:

1. **Content state:** `state.selectedPrimary`/`state.selectedIds` plus `fillInspector(node)` populate or clear fields.
2. **Visibility state:** `.hidden`, `setActiveView()`, `setAppMode()`, and the `max-width:1300px` rule decide whether the Inspector paints.
3. **Layout-reservation state:** the shell's explicit third grid track reserves 340px regardless of content, selection, or the Inspector's `.hidden` state.

The lowest-risk correction is additive: retain all DOM and IDs, derive Inspector capability from `activeView`, add explicit open/mode state, reflect the normalized state as data attributes (or a single state class set) on `.app-shell`, and let one CSS rule own the shell columns. Only Campaign Canvas (`activeView === "board"`) should support the Node Inspector. Legacy List and Calendar are Canvas projections but do not currently need the Inspector; all other destinations must receive the complete workspace track. Selection may survive navigation, but it must never reserve layout outside Canvas.

## 2. Confirmed symptoms

| Symptom | Source confirmation | Finding |
|---|---|---|
| Inspector appears outside Canvas | `setActiveView()` toggles it only by `isHome`, not by `view === "board"` (`app.js:16277-16300`). | Confirmed for Boards, List, Calendar, Insights, Funnel Simulator, and AI Brain while `appMode !== "brand"`. |
| Empty Inspector space remains | Shell explicitly owns a third 340px track (`styles.css:290-300`); `.hidden` is only `display:none` (`styles.css:2071`). | Confirmed: item visibility and explicit track reservation are independent. |
| Pages are narrow/shifted | All workspace views live only in the middle grid track; Boards then adds `max-width:1120px`, and Simulator/Journey add their own 1180/980px caps. | Confirmed competing width systems. |
| Toolbar is inconsistent | One Canvas-labelled toolbar is shared by nearly every non-home campaign view and hidden only for Home/Brand mode. | Confirmed lifecycle mismatch. |
| Nested scrolling/clipping | `body` and `.app-shell` hide overflow; views independently establish auto/hidden scrolling, notably Boards and Brand Workspace. | Confirmed multiple ownership patterns. |
| Prior local CSS fixes did not fix shell ownership | Brand Workspace explicitly contains a later “restore page scroll” override, while Insights adds another view-specific scroll rule. | Confirmed cascade accretion. |

No evidence was found that Light/Dark theme code changes shell geometry. Theme rules change surfaces/colors; geometry remains in shared CSS.

## 3. DOM and shell hierarchy

### 3.1 Ownership

| Responsibility | Existing owner | Evidence and implications |
|---|---|---|
| Root viewport | `body` | Fixed to `height:100vh; overflow:hidden`; it intentionally does not page-scroll. |
| Application shell | `.app-shell` | Direct body child; grid/viewport owner. JS caches it as `el.appShell`. |
| Primary and expanded navigation | `aside#left-sidebar.sidebar` | Same element owns collapsed/expanded rail; `.app-shell.sidebar-collapsed` changes shell track and descendant presentation. |
| Top toolbar | `header#canvas-topbar.topbar` | First child of `main.workspace-wrap`; it is a flex-none sibling above the active view. |
| Active page slot | `main.workspace-wrap` | Flex column and middle shell track. `setActiveView()` applies `.hidden` to its section children. There is no separate view-router host. |
| Canvas | `section#canvas.canvas` | Canvas viewport and scroll owner; `#canvas-scroll-surface` and `#zoom-layer` provide the 20,000×30,000 board plane. |
| Inspector | `aside#inspector-panel.inspector` | Direct shell grid item, not a Canvas child; `.inspector-content` is its independent vertical scroller. |
| Modals/overlays | Native dialogs in sidebar; templates and body-level overlays after `.app-shell`; dynamic body children | Their fixed/dialog positioning should remain independent of content widths. |
| Floating controls | `.floating-zoom-control` inside `#canvas`; `#context-menu` inside `#canvas`; dynamic filter/utility popovers appended to `body` | Geometry depends on Canvas/toolbar client rects and viewport coordinates. |

### 3.2 Compact existing hierarchy

```text
body[.public-board-view]
├─ div.app-shell[.sidebar-collapsed]                  ← shell/grid owner
│  ├─ aside#left-sidebar.sidebar                     ← navigation/expanded rail
│  │  ├─ .sidebar-header > #sidebar-toggle-btn
│  │  ├─ .brand-switcher-shell
│  │  ├─ #board-brand-association
│  │  ├─ dialog#board-brand-core-comparison
│  │  ├─ dialog#brand-workspace-detail
│  │  ├─ nav > #home-nav-btn, #boards-nav-btn,
│  │  │         #campaign-canvas-nav-btn,
│  │  │         [Content Workspace button: no id/handler],
│  │  │         #brand-core-nav-btn, #ai-brain-nav-btn,
│  │  │         #insights-nav-btn, #funnel-simulator-nav-btn
│  │  ├─ section#activity-panel > #activity-feed
│  │  ├─ #settings-open-btn
│  │  └─ dialog#settings-dialog
│  ├─ main.workspace-wrap[.brand-mode]                ← active-view/width column
│  │  ├─ header#canvas-topbar.topbar
│  │  │  ├─ visible Canvas toolbar/action groups
│  │  │  └─ #legacy-toolbar-hooks[hidden]             ← established compatibility IDs
│  │  ├─ section#dashboard-view.dashboard-view
│  │  ├─ section#canvas.canvas                       ← Canvas viewport
│  │  │  ├─ #canvas-scroll-surface > #zoom-layer > #links/nodes
│  │  │  ├─ #context-menu
│  │  │  └─ .floating-zoom-control
│  │  ├─ section#boards-library-view
│  │  ├─ section#board-list-view                     ← legacy List
│  │  ├─ section#calendar-view                       ← legacy Calendar
│  │  ├─ section#insights-view > #insights-cards
│  │  ├─ section#funnel-simulator-view > #funnel-simulator-surface
│  │  ├─ section#ai-brain-view > #ai-brain-summary
│  │  └─ section#brand-core-workspace
│  │     └─ .brand-workspace-body
│  │        ├─ #brand-core-canvas
│  │        └─ aside.brand-core-side                 ← Brand editor, not Node Inspector
│  └─ aside#inspector-panel.inspector                 ← shell third grid item
│     └─ .inspector-content
│        ├─ h2 “Node Configuration” + #inspector-meta
│        └─ form#node-form > established field/action sections
├─ template#node-template
├─ template#postit-template
├─ #node-type-picker
└─ #posting-plan-overlay
```

IDs are broadly cached and bound in `app.js` and checked by regression scripts. This audit recommends retaining all of them. In particular, the hidden legacy toolbar is intentional compatibility infrastructure and must not be removed as part of BW-30.

## 4. Major-view inventory

“Reserved now” describes desktop widths above 1300px. “Main” means `main.workspace-wrap`; the shell still subtracts navigation and Inspector tracks.

| Destination / `activeView` | Host | Activation | Display / width owner / cap / padding | Inspector expected / visible now / reserved now | Current vertical scroll owner and nesting | Toolbar / responsive / risk |
|---|---|---|---|---|---|---|
| Dashboard / `home` | `#dashboard-view` | Home nav; root boot without board | View rules make it flex; `.mission-control` is `width:100%`, `max-width:1440px`, centered; view padding 28px | No / hidden / **yes, 340px** | `#dashboard-view` auto-scrolls within body/shell hidden viewport | Toolbar hidden. At ≤980 cards collapse. Empty right track makes “full” dashboard narrow. |
| My Boards / `boards_library` | `#boards-library-view` | Boards nav plus `loadBoardsLibrary()` | Flex column; `width:min(100%,1120px)`; centered; padding space-6 | No / **visible** / **yes** | Outer view is `overflow:hidden`; inner `.boards-library-panel` is `overflow-y:auto`; at ≤900 outer height becomes auto while body cannot scroll | Canvas toolbar visible and consumes height; fixed `calc(100vh - 150px)` risks gaps/clipping. |
| Campaign Canvas / `board` | `#canvas` | Canvas nav, boot `/boards/:id`, focus/handoff/search/actions | Flex fills Main; 14px padding; no cap; internal board is 20,000×30,000 | Yes / visible / yes | `#canvas` owns both axes; Inspector independently scrolls | Toolbar visible; at ≤1300 Inspector is forcibly absent. Correct wide-desktop case, but no explicit open/closed state. |
| Content Workspace | **No host** | Sidebar button has no ID and no listener | Not implemented; static nav affordance only | No / N/A / shell would reserve if later added naïvely | None | No active-view lifecycle exists. Treat future destination as full/contained, not as a current hidden view. |
| Board Brand Core / Brand Workspace / `brand-core` | `#brand-core-workspace` | Brand nav calls `setAppMode("brand")`, which calls `setActiveView("brand-core")` | Full Main; later rules replace old two-column root with one-column root; body creates content/editor columns; padding 18px | No / hidden / **yes, 340px** | Workspace root `overflow-y:auto`; wide sticky `.brand-core-side` also `overflow-y:auto` with max viewport height | Toolbar hidden. Existing nested editor scroll is defensible only as sticky subregion, but shell space remains. |
| AI Brain / `ai_brain` | `#ai-brain-view` | Nav, Insights handoff, Simulator handoff | `.board-list-view` base; generated `.ai-brain-wrap` caps at 980px and centers | No / **visible** / **yes** | Generic `.board-list-view` is auto-scroller; transcript also scrolls when bounded, creating possible nested scroll | Canvas toolbar visible. Inspector fields remain focusable/announced. |
| AI Insights / `insights` | `#insights-view` | Insights nav | Generic view; `#insights-cards` max-width 1180px and centered | No / **visible** / **yes** | `#insights-view` auto-scroll; cards explicitly `overflow:visible` | Canvas toolbar visible. View-specific scroll fix works but shell width remains lost. |
| Funnel Simulator / `funnel_simulator` | `#funnel-simulator-view` | Simulator nav | Generic view; `.simulator-shell` max 1180px, Journey later max 980px; responsive padding | No / **visible** / **yes** | Generic view auto-scroll; tables/rails/steps add horizontal scrolling; sticky journey footer can become a trap | Canvas toolbar visible. ≤800/768 modules stack; shell breakpoint hides Inspector only at ≤1300. |
| Settings | `dialog#settings-dialog` (not an `activeView`) | Settings button `showModal()` | Modal `min(560px, viewport-32px)`; at ≤600 becomes full-screen 100dvh | No / underlying state unchanged / underlying shell unchanged | Dialog scrolls itself (`overflow:auto`) | Navigation remains behind modal. This is an overlay, not a page-width mode. |
| Legacy List / `list` | `#board-list-view` | Hidden legacy toolbar view button/cycle | `.board-list-view`, flex fill, padding 18px, auto overflow | No (projection only) / **visible** / **yes** | View auto-scrolls | Toolbar and Canvas nav active. Inspector presence is accidental. |
| Legacy Calendar / `calendar` | `#calendar-view` | Hidden legacy toolbar view button/cycle | Same base; calendar grid may impose horizontal content pressure | No (projection only) / **visible** / **yes** | View auto-scrolls | Clicking a post returns to Canvas and fills Inspector. |
| Public Viewer | Usually `board` reached through `/boards/:id#public=…`; no separate host | Boot parses fragment token and applies public access/body class | Same view geometry as corresponding destination | Canvas-only, read-only / same erroneous lifecycle elsewhere / same reservation | Same as active view | CSS hides select edit/share actions; it does not hide Node Inspector or enforce board-only navigation. Form controls are disabled selectively, not comprehensively. |

The product request names “full-width” destinations. Here **full width** means the complete Main application width after the current navigation rail—not an unbounded line length. A contained child may still be centered for readability, but no Inspector shell track may exist.

## 5. Inspector dependency map

### 5.1 References and behavior

| File/function | Trigger | Reads | Writes | DOM dependency | Layout effect | Risk |
|---|---|---|---|---|---|---|
| `index.html:625-775` | Initial parse | N/A | Establishes static form | `#inspector-panel`, `.inspector-content`, `#node-form`, all field/action IDs | Creates third grid item | Moving/recreating breaks cached references, listeners, form state, language checks. |
| `styles.css:290-300` | Layout/collapse class | `--sidebar-width` | Grid tracks | `.app-shell[.sidebar-collapsed]` | Always reserves 340px on desktop | Primary defect. |
| `styles.css:337-354` | Cascade | N/A | Inspector dimensions/scroll | `.inspector`, `.inspector-content` | Fixed 340px item, 100vh; independent inner scroll | Width duplicated in item and grid; viewport height can compete with shell. |
| `styles.css:3186-3197` | Viewport ≤1300px | Media width | `display:none` | `.inspector` | Removes item and switches shell to two columns | Responsive behavior is implicit and cannot be opened as overlay. |
| `app.js` `el` cache (`221-300`) | Script evaluation | Document IDs | Cached references | Inspector root and every descendant | None directly | IDs are a compatibility contract. |
| `fillInspector()` (`14640-14737`) | Selection, board load/reset, mutations, language-adjacent renders | selected node/type/context/access | Values, text, `.hidden`, inline action display via helper | Form/meta/section IDs | **Content only**; does not open/close/root-layout | Null selection clears form but leaves root visible and width reserved. |
| `updateInspectorActionVisibility()` (`12950-12997`) | Every fill/selection/access update | `selectedIds`, `selectedPrimary`, node type, read-only | Inline `style.display`, disabled/title/text | Action button IDs | Descendant visibility only | Inline styles outrank stylesheet display rules on buttons; must not be mistaken for root state. |
| `refreshOpenInspectorLanguage()` (`14740+`) | UI language change | selected node/context | Inspector text/options | `#inspector-panel` descendants | None | Name implies “open,” but it does not test openness. |
| `setActiveView()` (`16277-16314`) | Navigation and handoffs | requested view, `appMode` | `activeView`, view `.hidden`, nav active classes, toolbar/Inspector `.hidden` | Every view, toolbar, Inspector | Hides Inspector only for Home | Central lifecycle defect. |
| `setAppMode()` (`16366-16380`) | Canvas/Brand switching | mode/current view | `appMode`, toolbar/Inspector `.hidden`, `.brand-mode`, active view | Main/toolbar/Inspector | Brand mode hides item but not explicit shell track | Competing writer can reverse `setActiveView` outcome. |
| `focusNodeInCanvas()` (`9595-9630`) | Show on Canvas, activity, dashboard/simulator handoff | node/active view/zoom | selection, Inspector content, Canvas scroll | Canvas, zoom node, Inspector fields | Navigates to board before selection | Must set/open Inspector deliberately in future contract, without geometry regression. |
| `showInsightsFindingOnCanvas()` (`5622-5628`) | Insights button | current diagnostic/node IDs | Delegates to focus | No direct Inspector root | Focus path fills Inspector | Current behavior incidentally shows root because it was never hidden on Insights. |
| Simulator mount callbacks (`16324-16363`) | “Show/Fix on Canvas” | node ID/runtime context | active view, selection, scroll | Simulator host + Canvas/Inspector through focus | Same as above | Double `setActiveView("board")` is harmless now but normalization must be idempotent. |
| AI Brain proposal completion (`5508-5521`) | Create-node success | new node | Canvas nav, selection, fill, focus | Canvas nav/input/Inspector | Intentionally focuses first Inspector input | Focus restoration/open behavior is part of compatibility. |
| Calendar click (`16250-16258`) / search Enter (`17050-17060`) | Node focus | node | view, selection, fill, scroll | Canvas/Inspector | Returns to Canvas | Must remain runtime tested. |
| `revealAiBrainCreatedNode()` (`5490-5504`) | AI-created node reveal | Canvas, toolbar, visible Inspector rect | Canvas scroll | `.hidden` state and bounding rects | Excludes Inspector overlap if visible | New docked/overlay modes must expose correct geometry. |
| Public access (`app.js:706,8341`; inline CSS `index.html:97`) | Shared token/access resolution | `publicBoardToken`, access reason | `body.public-board-view`, permissions/UI | Body/nav/actions | No Inspector lifecycle change | Read-only descendants may remain interactive or announced. |
| Language regression (`scripts/check-bw21-1-inspector-language-coverage.js`) | Test | Inspector HTML slice/keys | None | Static heading/descendant attributes | None | DOM relocation/renaming can break coverage extraction. |
| BW-26.6.2 regression | Test | reveal function strings | None | Inspector/toolbar geometry references | None | Preserve available-Canvas calculation semantics. |
| Theme/BW-27 regressions | Test | Inspector selectors and semantic tokens | None | Existing classes | Visual only | State selectors must work equally in Light/Dark. |

### 5.2 State separation finding

| Concern | Current authority | Current representation | Finding |
|---|---|---|---|
| Inspector content | `selectedPrimary`, `selectedIds`, `fillInspector()` | Form values, text, descendant `.hidden`, disabled and inline display | Reasonably centralized, but selection and content are not visibility. |
| Inspector visibility | Two writers (`setActiveView`, `setAppMode`) plus media query | Root `.hidden`/`display:none` | Not authoritative; no user open/close state, and non-home views show it. |
| Inspector reservation | CSS shell declarations | Explicit third 340px grid track | Completely independent of root visibility. This is why blank space survives. |

There is no Inspector open/close button, no `inspectorOpen` state, no root ARIA state, no transform-based panel lifecycle, and no conditional flex-basis. Opacity/visibility do not control the root. Inline styles control descendant actions only. The controlling combination is selected-node JavaScript for content, root classes/app mode/media `display` for visibility, and grid plus fixed width for reservation.

## 6. Active-view lifecycle

### 6.1 Canonical path

1. Navigation handlers call `setAppMode("canvas")` (or `"brand"`) and then `setActiveView(view)`; Canvas also renders from current state, Boards loads data, and other destinations render on entry.
2. `setActiveView(view)` writes `state.activeView` without validating the value.
3. It computes only `isHome` and `isBrandCore` capabilities.
4. It toggles `.hidden` independently on nine view hosts.
5. It updates nav active classes; List/Calendar intentionally light the Campaign Canvas nav.
6. If not in Brand mode, it hides both toolbar and Inspector only when Home is active. Consequently all other campaign views inherit both.
7. It updates the legacy cycle-view label and invokes view-specific render functions.

There is no postcondition asserting exactly one view is visible, no capability table, no scroll reset/restoration policy, and no normalized Inspector state.

### 6.2 Alternative view-changing paths

- Boot: `/boards/:id` selects `board`; root selects `home` after `fillInspector(null)`.
- `setAppMode("brand")` calls `setActiveView("brand-core")`; leaving Brand mode sends Brand Core to `board`.
- Legacy cycle/menu paths select `board`, `list`, or `calendar`.
- Node focus paths (`focusNodeInCanvas`, collaborator focus) enter `board`, often with `requestAnimationFrame` before scrolling.
- Dashboard actions delegate to existing nav buttons or enter Canvas/create flow.
- Insights “Show on Canvas” delegates to `focusNodeInCanvas`; “Ask AI Brain” directly enters `ai_brain` and focuses its composer.
- Funnel/Persona Simulator callbacks directly enter Canvas or AI Brain.
- Calendar node click and node-search Enter enter Canvas, select, fill, and reveal.
- AI Brain node creation clicks the Canvas nav, fills Inspector, reveals node, then focuses title/Inspector.
- Activity/history focus uses Canvas focus helpers. Undo/reset/delete/load may clear selection and call `fillInspector(null)` without changing visibility.
- Public Viewer is an access state layered over the same route/view lifecycle, not a separate `activeView`.

**Content Workspace is not a destination today:** its nav button has neither ID nor event binding and no host exists. **Settings is a native modal, not an active view.** These distinctions must be reflected in implementation tests rather than inventing nonexistent lifecycle values.

## 7. CSS Cascade and width-reservation root cause

### 7.1 Critical declarations in source order

Specificity uses `(IDs, classes/attributes/pseudo-classes, elements)`.

| Source / selector | Specificity / media / theme | Authoritative properties | Actual consequence / competition / inline override |
|---|---|---|---|
| `styles.css:280-288` `body` | `(0,0,1)` / all / shared | `height:100vh; overflow:hidden; max-width:none` | Body cannot rescue an overflowing view; descendants must scroll. No inline override found. |
| `:290-296` `.app-shell` | `(0,1,0)` / desktop / shared | grid; columns `sidebar, minmax(0,1fr), 340px`; `height:100vh; overflow:hidden` | **Creates permanent Inspector track.** |
| `:298-300` `.app-shell.sidebar-collapsed` | `(0,2,0)` / desktop / shared | collapsed sidebar, Main, `340px` | Later/higher specificity changes only left track; preserves defect. JS toggles class only. |
| `:302-306` `.sidebar,.inspector` | `(0,1,0)` | padding 18px | Inspector’s declared 340px includes padding due global border-box. |
| `:309-316` `.sidebar` | `(0,1,0)` | `overflow-y:auto; overflow-x:hidden` | Navigation independently scrolls and remains a shell track. |
| `:337-345` `.inspector` | `(0,1,0)` | `width:340px; height/max-height:100vh; overflow:hidden; display:flex` | Item matches track; root itself does not scroll. `.hidden` can override display, but not the parent track. |
| `:347-354` `.inspector-content` | `(0,1,0)` | flex child, `min-height:0; overflow-y:auto` | Correct independent Inspector scroll primitive. |
| `:1058-1063` `.workspace-wrap` | `(0,1,0)` | flex column; `min-width/min-height:0` | Correctly permits middle track to shrink; does not own scroll. |
| `:1065-1073`, `:3270-3273`, `:3312-3316`, `:7498` toolbar | class then later class and ID | flex/padding; later compact padding; themed surface; final `flex:0 0 auto; flex-shrink:0` | Toolbar never scrolls and consumes fixed vertical space. No height variable exists for view calculations. |
| `:1184-1197` `.brand-core-workspace` | `(0,1,0)` | old two-column layout, `height:100%; overflow:hidden` | Later migration rules override columns/scroll, evidence of cascade layering. |
| `:1442-1457` `.canvas,.board-list-view`; `.canvas` | `(0,1,0)` | flex fill/min-height 0; Canvas `overflow:auto`, padding 14px | Canvas is correct two-axis owner. |
| `:2071` `.hidden` | `(0,1,0)` | `display:none !important` | Beats normal and inline non-important root display. It removes the item but **not explicit grid track**. |
| `:2849-2860` `.board-list-view` | `(0,1,0)` | `overflow:auto; padding:18px` | Generic scroll/spacing applied to List, Calendar, Insights, Simulator, AI Brain. |
| `:3186-3197` media `.app-shell`; `.sidebar .nav-item,.inspector` | `.app-shell` `(0,1,0)`, Inspector `(0,1,0)` / ≤1300 | two shell columns; Inspector `display:none` | Source-later media rule removes track and panel. It also hides all nav items, then specifically restores Settings—an aggressive rail mode. |
| `:5390+` `#dashboard-view.dashboard-view`; `.mission-control` | ID+class / all | view flex, overflow auto; content max 1440px and centered | Dashboard’s intentional content cap is applied inside already reduced Main track. |
| `:6235-6250` Boards view | `(1,1,0)` / all | width cap 1120px, viewport-derived height, overflow hidden; `.hidden !important` | High-specificity local geometry; nested list scroll. At ≤900 height becomes auto/min-height. |
| `:6657-6665`, `:6911-6918` Brand root | class chain / later wins | one-column migration; later flex/auto height and `overflow-y:auto` | Later rule repairs clipping locally but cannot recover shell track. |
| `:6920-6956` Brand body/editor | classes / ≥1401 for sticky editor | internal columns; sticky editor max-height/auto scroll | Legitimate nested subregion, but breakpoint nearly coincides with shell breakpoint and can be hard to reason about. |
| `:7107-7110`, `:7161+`, `:7405-7410` theme scopes | attributes/classes / Dark/shared | colors/background/borders; Dark Inspector form surfaces | No width/display/grid override; theme is not root cause. |
| `:7498-7500` toolbar/Insights | ID selectors / all | toolbar non-shrink; Insights auto-scroll; cards visible overflow | Late view-specific correction establishes another scroll policy. |
| `:7520`, `:7560`, `:7591` Simulator/Journey shells | classes / all | 1180px then Journey 980px cap; centered padding | Multiple page caps create visual inconsistency, especially inside reserved shell width. |
| `:7155` reduced-motion media | global pseudo-elements | near-zero animations/transitions, auto scroll behavior | Good baseline; any overlay transition must remain covered. |

### 7.2 Precise empty-space mechanism

At a viewport wider than 1300px, the shell computes:

```text
[sidebar track] [workspace track: remaining width] [explicit Inspector track: 340px]
```

When `#inspector-panel.hidden` resolves to `display:none !important`, the grid item generates no box, but CSS Grid still sizes an **explicitly declared** third track to 340px. The Main remains assigned to column 2 by auto-placement established by DOM order and cannot span into column 3. There is no selector that changes the shell to two columns for Home, Brand, hidden Inspector, or any non-Canvas view. Thus the gap is exactly the third explicit `340px` track—not right padding, margin, flex-basis, opacity, visibility, or a transform. For Boards/Insights/etc., the Inspector is not hidden at all, so the 340px track contains the unrelated Inspector. At ≤1300px, the media query changes the template to two columns, which is why the symptom disappears abruptly rather than because state became correct.

## 8. Scroll ownership

### 8.1 Current and intended contract

| View | Current vertical chain | Current problem | Intended authoritative owner |
|---|---|---|---|
| Shell | `body hidden → .app-shell hidden → .workspace-wrap no overflow` | Any active view lacking an internal scroller clips. | Keep shell/body non-scrolling so nav/toolbar remain stable. Use `100dvh` with a safe fallback in implementation. |
| Dashboard | `#dashboard-view overflow:auto` | Correct owner, but test toolbar-hidden and scroll restoration. | `#dashboard-view` only. |
| Boards | view `overflow:hidden` → inner list `overflow-y:auto` | Header stays fixed, but fixed `calc(100vh - 150px)` guesses toolbar height; mobile switches outer to auto while body stays hidden. | Prefer `#boards-library-view` as sole page scroller; keep filters/header naturally in flow unless product explicitly requires sticky header. |
| Canvas | `#canvas overflow:auto` plus Inspector content auto | Correct specialized dual-pane pattern; enormous surface deliberately scrolls both axes. | `#canvas` for Canvas; `.inspector-content` as the one justified independent vertical exception. |
| List/Calendar | each `.board-list-view overflow:auto` | Reasonable, though legacy and Inspector/toolbar mismatch consume space. | Active view root only. Horizontal overflow may be local to calendar table/grid. |
| Insights | generic auto plus explicit `#insights-view overflow-y:auto`; cards visible | Same owner is declared twice, not two boxes; harmless but redundant. | `#insights-view` only; local horizontal disclosure/table scroll allowed. |
| AI Brain | view auto; transcript may also scroll in generated UI | Possible nested wheel/focus trap if both bounded. | `#ai-brain-view` page scroller; only transcript may be independently scrollable if composer must remain sticky, documented/tested as exception. |
| Funnel Simulator | view auto; horizontal tables, step rails, result rails; sticky controls | Mostly sound; horizontal scrollers are not vertical owners, but sticky controls can obscure last content. | `#funnel-simulator-view` vertical owner; local horizontal scrollers only. |
| Brand Workspace | root auto; ≥1401 sticky editor auto | Two vertical scrollers by design but editor max-height uses viewport rather than actual workspace below toolbar (toolbar hidden today). | Root owns page; sticky editor may independently scroll on wide desktop only, as an explicit exception with keyboard reachability. |
| Settings | native dialog auto over hidden page | Correct modal isolation. | `#settings-dialog`; background inert via native `showModal()`. |
| Public Viewer | Same as destination | No distinct scroll model. | Same view contract; read-only status must not change geometry. |

### 8.2 Required scroll rules

- Navigation remains independently scrollable because its content can exceed viewport height; this is shell chrome, not a page scroll owner.
- Toolbar remains flex-none and stationary above active page where the view contract includes it.
- Every active page root must have `min-height:0` and own its vertical scroll; inactive roots must be `display:none`.
- View entry should deliberately restore a per-view scroll position or reset to top. Current DOM persistence implicitly preserves `scrollTop`; define and test the chosen policy (recommended: preserve during same-board toggles, reset when identity changes).
- Inspector scroll position should be retained only for the same selected node/session; selection changes should reveal its heading/form start unless doing so would steal focus.
- Mobile overlays must lock only their background pane and must not introduce body scrolling beneath the fixed shell.
- Sticky/footer content needs bottom padding including `env(safe-area-inset-bottom)` so controls do not cover the last field.

## 9. Intended layout contract

### 9.1 Campaign Canvas

| State | Required behavior |
|---|---|
| No node selected | Canvas uses full Canvas allocation. Inspector may remain closed; content state shows the existing empty prompt only if explicitly opened. No selection must not itself reserve width. |
| Node selected | Preserve `selectedNodeId`; selection alone does not mandate layout. For compatibility, direct selection may open Inspector on wide desktop, but that policy must be explicit. |
| Inspector opened | On ≥1440, dock a useful 340px (or tokenized 340–380px) column. Inspector scrolls internally. Canvas remeasures visible width without changing world coordinates. |
| Inspector closed | Shell has no Inspector track; root is non-interactive/non-announced; selected node may remain selected. Focus returns to opener or selected Canvas node. |
| Focus from AI Insights | Enter Canvas, select/reveal/pulse node, open Inspector only if the product action promises configuration; reduced motion uses instant scrolling. |
| Focus from Funnel Simulator | Same normalized focus path and state; avoid two competing view/open writes. |
| Public Viewer | Canvas may expose a read-only Inspector as a complementary details region, but only on Canvas and only if all mutation controls are disabled/removed from accessibility flow. Default closed on smaller widths. |
| Narrow desktop (1024–1439) | Inspector is an overlay/drawer of usable width, not a squeezed permanent column; Canvas retains full track. |
| Tablet (768–1023) | Inspector is modal-like overlay/sheet with focus management and close affordance; no reserved track. |
| Mobile (<768) | Full-height/full-width or nearly full-width sheet using `100dvh`, safe areas, 44px controls; background Canvas inert while open. |

Leaving Canvas always closes **presentation** (`inspectorOpen=false` or normalized unsupported), removes its layout track, and makes descendants unfocusable/unannounced. It may preserve `selectedNodeId` for return. The Canvas is the only current view with Node Inspector capability. List/Calendar are data projections, not exceptions.

### 9.2 Non-Canvas destinations

Dashboard, Boards, Content Workspace (when implemented), Brand Workspace, AI Brain, AI Insights, Funnel Simulator, and Settings must not reserve an Inspector track. No evidence-backed exception exists. Settings remains a modal sized against the viewport. Brand Workspace’s `.brand-core-side` is its own domain editor and must not be confused with or governed by Node Inspector state.

### 9.3 Small content-width system

| Mode | Use | Max width | Horizontal padding | Toolbar | Inspector | Responsive |
|---|---|---|---|---|---|---|
| `canvas` | Campaign Canvas | None; fill available Main | Small fixed Canvas inset (existing 14px) | Canvas tools visible | Supported: docked wide, overlay below wide threshold | Preserve world coordinate/zoom; overlay must not shrink plane. |
| `full` | Dashboard and workspace compositions needing grids | None at page root; optional shared inner cap 1440–1600px | `clamp(16px,2.5vw,32px)` | Destination-aware title/actions | Never | Columns collapse at content breakpoints, not arbitrary page caps. |
| `contained` | Boards, Insights, Simulator, Brand workspace | One shared cap, recommended 1200px (Brand may opt into shared wide variant) | Same clamp token | Destination-aware | Never | Becomes 100%; do not stack nested viewport heights. |
| `reading` | AI Brain conversation/text-heavy settings content | 760–980px | Same clamp token | Destination-aware/sticky only if tested | Never | 100% on mobile; long German text wraps. |

Exact token values should be confirmed visually during implementation; the architectural requirement is a small named set, not per-page arbitrary 1120/1180/980/1440 values.

## 10. Recommended state model

```js
activeView: "home" | "board" | "boards_library" | "list" | "calendar" |
            "brand-core" | "ai_brain" | "insights" | "funnel_simulator"
selectedNodeId: string | null       // migrate/alias current selectedPrimary narrowly
inspectorSupported: activeView === "board" // derived, never independently persisted
inspectorOpen: boolean              // explicit user/product intent; presentation state
inspectorMode: "docked" | "overlay" // derived from responsive capability while open
```

`selectedIds` remains for multi-selection. Do not change node schema or persisted Canvas payload merely to rename `selectedPrimary`; a compatibility getter/normalizer is safer.

### Valid combinations

| Active view/support | Selected ID | Open request | Mode | Reservation |
|---|---:|---:|---|---:|
| Canvas / true | null or valid | false | derived but inactive | 0 |
| Canvas / true | null or valid | true | docked | Inspector track only on wide desktop |
| Canvas / true | null or valid | true | overlay | 0; overlay paints above Canvas |
| Any non-Canvas / false | null or preserved | false after normalization | inactive | 0 |
| Any non-Canvas / false | any stale `true` input | **invalid; normalize false** | inactive | 0 |

**Invariant:** Inspector layout space may be reserved only when `inspectorSupported && inspectorOpen && inspectorMode === "docked"`. Derive shell attributes in one function, for example `data-active-view`, `data-inspector-open`, and `data-inspector-mode`. Breakpoint changes may switch docked→overlay without clearing selection. Returning to Canvas may restore the prior user preference, but never by carrying an active grid track through another view.

## 11. Responsive behavior

| Width | Navigation | Toolbar/content | Inspector | Canvas/scroll/overlay | Safety and targets |
|---|---|---|---|---|---|
| ≥1440px | Expanded or user-collapsed rail; shell left track tokenized | Destination toolbar; full/contained mode uses complete Main | Docked only when Canvas supports it and open; useful 340–380px | Canvas scroll + independent Inspector scroll | No permanent empty track; ≥44px primary interactive targets; visible focus. |
| 1024–1439px | Compact/collapsible rail, but retain reachable labelled navigation (current ≤1300 hides all nav items and needs redesign validation) | Toolbar wraps or uses overflow menu without shrinking controls; content fills Main | Overlay drawer, recommended 360–420px bounded by viewport; never a narrow dock | Canvas remains full width; overlay background remains operable only if non-modal semantics are chosen deliberately | Close affordance, Escape, safe right inset; no hidden nav loss. |
| 768–1023px | Compact rail or explicit navigation drawer | One/two-row toolbar; contained modes 100% | Modal-like side sheet, no reservation | Canvas retains pan/zoom; lock Canvas interaction while modal-like sheet open | Focus trap if modal, ≥44px controls, `env(safe-area-inset-*)`. |
| <768px | Navigation drawer/bottom pattern; no permanently space-hungry rail | Destination title and essential actions; nonessential actions in menu; page padding 12–16px | Full-screen/bottom sheet using `100dvh`; default closed | One Canvas scroll surface; sheet independently scrolls only while open; no background scroll | 44×44px targets, safe areas, wrapping labels, no hover-only action, reduced motion. |

The current 1300px “hide Inspector and nav items” rule is a fallback, not the desired contract. Desktop Inspector must not be squeezed below usable form width; switch to overlay instead.

## 12. Accessibility

### Current findings

- `#inspector-panel` has no landmark label/role beyond semantic `aside`, no close control, no `aria-hidden` or `inert` lifecycle, and no open trigger state.
- When present on unrelated views, its many controls remain in sequential focus order and are announced. Null selection disables only some controls/actions; numerous inputs remain focusable.
- `.hidden { display:none!important }` correctly removes descendants when applied, but `setActiveView()` does not apply it outside Home and Brand mode.
- AI-created-node flow explicitly focuses the title input/Inspector; this established behavior needs preservation.
- Escape currently closes lightbox and various overlays, not the Inspector.
- Native Settings dialog provides modal semantics; a future mobile Inspector overlay must choose native dialog-like semantics or implement equivalent focus containment.
- Global reduced-motion CSS exists, and Insights already chooses instant focus scrolling under reduced-motion preference.

### Required contract

1. Docked Inspector is an `aside`/complementary region labelled by the existing “Node Configuration” heading; add an ID to the heading only if dependency review/test permits (do not rename existing IDs).
2. Opening from keyboard moves focus only when the action’s purpose is “open/configure”; simple Canvas selection should not unexpectedly steal focus.
3. Closing restores focus to the opener, selected node, or Canvas fallback in that order.
4. Escape closes an open Inspector overlay (after higher-priority nested modal/menu handling) and does not clear `selectedNodeId`.
5. Closed or unsupported Inspector must be `display:none` and/or `hidden`, `aria-hidden="true"`, and `inert` as defense in depth. Do not place `aria-hidden=true` around the currently focused element; move focus first.
6. A modal mobile sheet traps focus, exposes an accessible close button, marks/behaves as modal, and makes background Canvas inert. A non-modal wide overlay remains complementary and must not trap focus.
7. Opening/closing and focus-node scrolling honor `prefers-reduced-motion`.
8. German headings/button labels must wrap without overlapping close/actions; do not rely on fixed text widths.

## 13. Alternative approaches

| Approach | Benefits | Risks / cost | Decision |
|---|---|---|---|
| 1. Conditional shell class/data attributes | One authority; additive; preserves DOM/IDs; separates capability/open/mode; testable at runtime | Requires careful normalization across `setActiveView`, `setAppMode`, resize, and focus actions | **Recommended.** |
| 2. Per-view CSS overrides | Superficially small; no JS state addition | Repeats selectors, misses legacy/future paths, leaves selected/visible/reserved concerns split, increases specificity debt | Reject as architecture; temporary emergency patch only. |
| 3. DOM relocation/recreation | Could colocate Inspector under Canvas | Breaks cached references, listeners, focus/form state, regressions, and source-based language tests; unnecessary | Reject. |
| 4. Overlay-only Inspector | Eliminates track defect and simplifies breakpoint geometry | Wastes wide desktop space, covers nodes, complicates accessible modality and available-Canvas calculations | Do not use universally; use as responsive mode. |
| 5. Complete shell rewrite | Could unify toolbar/navigation/content | Highest blast radius across boot, Canvas geometry, legacy IDs, overlays, themes, and all BW-26–29 contracts | Reject for BW-30. |

## 14. Recommended implementation strategy

1. Introduce one capability map (`board: { inspector:true, widthMode:"canvas", toolbar:"canvas" }`, others false with named width modes). Include legacy List/Calendar explicitly; do not infer from nav active styling.
2. Add `inspectorOpen` UI state without changing persisted node/board data. Derive `inspectorSupported`; derive responsive `inspectorMode` from one `matchMedia` boundary or CSS/container capability.
3. Add one idempotent `syncShellPresentation()` called at the end of `setActiveView()`, from `setAppMode()`, after responsive mode changes, and from explicit Inspector open/close actions. It writes `.app-shell` data attributes/classes, root `hidden`/ARIA/inert, and opener ARIA state.
4. Make the shell grid declaration conditional: default two tracks; add the Inspector track only for supported+open+docked. Apply the same condition to expanded and collapsed sidebar variants. Tokenize Inspector width once so grid and panel cannot drift.
5. Preserve `#inspector-panel` exactly where it is and retain all descendants/IDs. Preserve `fillInspector()` as the content renderer; do not make it the visibility authority.
6. Normalize leaving Canvas to presentation closed/unsupported while retaining `selectedPrimary`/`selectedIds` under the chosen selection policy. On return, restore content then decide open state from explicit policy.
7. Make `#canvas-topbar` destination-aware separately; BW-30 should not broadly redesign controls, but it must avoid using Inspector visibility as a proxy for toolbar visibility.
8. Consolidate view scroll/width through named shell modes, removing only superseded declarations after runtime parity is proven. Avoid broad `app.js` refactoring.
9. Add a browser-capable runtime regression that performs transitions and measures computed grid tracks, bounding rectangles, overflow owners, focusability, and Canvas coordinates.
10. Register that future test in package scripts and Runtime Boot Safety only during implementation—not during this audit.

## 15. Blast-radius table

| Area | Likely failure mode | Safeguard | Required regression |
|---|---|---|---|
| Canvas initialization | Hidden/zero-size Canvas initializes or centers incorrectly | Keep boot order and existing render call; sync shell before measuring | Root boot and `/boards/:id` show expected view/size. |
| Node selection | Selection starts opening/closing unpredictably | Separate `selectedNodeId` from explicit open policy | Select one/multiple/none; navigate away/back. |
| Inspector field binding | Recreated/moved fields lose listeners/values | Retain DOM/IDs and `fillInspector()` | Edit every representative node type and verify state updates. |
| Autosave | Presentation changes mark board dirty or alter snapshots | Never include shell state in serialized Canvas; dispatch no form events during sync | Toggle Inspector/view and assert dirty/save counts unchanged. |
| Node ownership | Owner select refresh/focus breaks | Keep `populateOwnerSelect()` and access update flow intact | Editor/public owner field permissions and values. |
| Filters/utility popovers | Anchor coordinates shift/offscreen after track transition | Close or reposition on shell transition; continue viewport clamping | Open in docked/closed/sidebar modes and resize. |
| Add Node dialog/picker | Wrong stacking/focus return, background scroll | Preserve body-level overlay and z-index; define focus restoration | Keyboard open/select/cancel at all breakpoints. |
| Canvas transform/zoom | Track change alters world coordinates or centering | Recompute viewport only; never rewrite node positions/zoom | Compare positions, zoom, scroll-to-node before/after toggle. |
| Edge geometry | Resize leaves SVG edges stale | Trigger existing draw/resize path after layout settles | Screenshot/coordinate assertions for connected nodes. |
| Show on Canvas | Node hidden under overlay or Inspector remains closed unexpectedly | One normalized focus helper aware of mode and available rect | Insights and Simulator actions at every breakpoint/reduced motion. |
| AI Insights | Stale Inspector remains focusable; width remains lost | Capability false and computed two-track shell | Enter/leave, show node, Ask AI Brain. |
| Funnel Simulator | Journey session resets on shell sync; sticky controls clip | Do not remount merely for presentation changes | Configure/run state, Show/Fix Canvas, return with state. |
| AI Brain | Composer/transcript nested scrolling or proposal focus breaks | Preserve render identity; explicit focus contract | Handoff, answer/proposal, create node, focus Inspector. |
| Brand Workspace | Node Inspector state conflicts with `.brand-core-side` editor | Treat Brand editor as view-local; capability false | Select/edit Brand tile; sticky editor; return Canvas selection. |
| Content Workspace | Future view accidentally inherits Inspector | Require explicit capability entry defaulting false | When implemented, runtime full-width/no Inspector test. |
| Dashboard | Right gap remains; focus-node action wrong | Default two-track shell; reuse focus helper | Full width; all dashboard actions; selected node reveal. |
| Public Viewer | Mutation controls accessible; layout differs | Read-only capability contract; audit all controls, not only CSS-hidden buttons | Token route, keyboard tree, no mutation, Canvas details behavior. |
| Expanded sidebar/history/activity | Three-track selectors diverge or activity scroll clips | One shell template for each Inspector state; retain sidebar scroll | Expand/collapse with panel open/closed and long activity. |
| Mobile layout | Invisible Inspector focusables, background scroll, unusable narrow panel | Overlay/full sheet with inert/focus management and 100dvh safe areas | 767/768 and orientation/virtual-keyboard cases. |
| Light/Dark Mode | State selector works only in one theme; transparent gaps | Geometry selectors theme-neutral; retain semantic surface rules | Matrix all modes in both themes. |
| German wrapping | Toolbar/panel controls overflow | Flexible groups, wrap-safe labels, no fixed text width | German at all breakpoints and 200% zoom. |
| Dialogs/floating overlays | Wrong containing block/z-index after attribute changes | Do not add transforms to shell ancestors; preserve body-level positioning | Settings, sharing, lightbox, posting, filters, utilities, delete confirm. |
| Legacy List/Calendar | Hidden hooks stop switching or Inspector appears | Explicit capability entries; retain IDs/hooks | Cycle/menu to List/Calendar and return via item. |
| BW-26–BW-29.4.2 | Source/runtime contracts regress | Run existing checks unchanged before/after | Full named compatibility suite plus Runtime Boot Safety. |

## 16. Regression specification

The future `check:bw30` must use a real browser (or equivalent layout-capable harness); source-string checks alone cannot verify computed tracks, focusability, scrolling, or runtime transitions.

### 16.1 Structural and lifecycle assertions

- Snapshot/assert every established shell/view/Inspector ID remains unique and in place.
- Boot root and board URL; assert exactly one active view and normalized shell attributes.
- Exercise nav buttons, legacy cycle/menu, `setAppMode`, Dashboard actions, Insights handoffs, Simulator handoffs, search, Calendar item, activity/collaborator focus, and AI Brain node creation.
- Assert only Canvas supports Inspector. Dashboard, Boards, Content Workspace when available, Brand Workspace, AI Brain, AI Insights, Funnel Simulator, Settings background, List, and Calendar expose no Inspector track/focusables.
- Preserve selected-node identity across Canvas→each destination→Canvas without reserving width outside Canvas.
- Test invalid/stale selection and deleted node normalization.

### 16.2 Geometry and width assertions

- At representative widths 1600, 1440, 1439, 1301, 1300, 1024, 1023, 768, 767, 390: inspect `getComputedStyle(.app-shell).gridTemplateColumns`, root and view rectangles.
- Outside Canvas, assert shell has no third Inspector-width track and Main right edge reaches shell content edge.
- Assert full-width eligibility independently for Dashboard, Boards, Content Workspace, Brand Workspace, AI Brain, AI Insights, Funnel Simulator, and Settings; allow only named inner width-mode caps.
- Canvas closed: zero reserved Inspector width. Canvas open+docked: one tokenized track and nonzero usable Canvas. Canvas open+overlay: zero track and correctly positioned overlay.
- Expand/collapse sidebar with every Inspector mode; toolbar rectangle remains stable and controls do not overlap.
- Verify node world positions, zoom, SVG edge endpoints, and focus centering are unchanged after open/close and view transitions.

### 16.3 Scroll and overlay assertions

- For every view, enumerate ancestors’ computed `overflowY`, scrollHeight/clientHeight, and assert exactly one page vertical owner.
- Explicit exceptions: navigation; Canvas two-axis viewport; docked Inspector content; documented AI transcript or wide Brand editor only.
- Verify view scroll policy across switches and new board identity; ensure no clipped final content.
- Verify Inspector scroll independence, sticky controls, horizontal Simulator rails/tables, toolbar fixed behavior, and mobile background lock.
- Exercise filters, utilities, Add Node, posting planner, Settings, Brand dialogs, delete confirm, image lightbox, and share/menu positioning with sidebar/panel transitions.

### 16.4 Accessibility and visual matrix

- Keyboard-open/close Inspector; assert focus order, Escape, restoration, labelled region/dialog semantics, and close affordance.
- Use a focusability query plus Tab traversal to prove hidden/unsupported Inspector descendants cannot receive focus; verify accessibility-tree exclusion (`hidden`/`aria-hidden`/`inert`).
- For modal mobile overlay, assert focus containment and inert background; for docked mode, assert no inappropriate trap.
- Run Light/Dark × English/German × desktop/tablet/mobile × Inspector states. Test 200% zoom, long labels, safe-area emulation, reduced motion, and 44px touch targets.
- Capture targeted screenshots for Dashboard, Boards, every named non-Canvas destination, Canvas open/closed, Public Viewer, expanded/collapsed nav, and mobile overlay.

### 16.5 Data and compatibility assertions

- Record serialized board before/after layout-only actions; assert byte-equivalent node/edge/schema content, no autosave call, and unchanged dirty state.
- Exercise actual field editing to prove autosave still occurs once and ownership/access rules remain intact.
- Public Viewer: load shared token, assert read-only behavior, no editor-only AI actions, and Inspector availability only on Canvas under the chosen read-only details contract.
- Run complete Runtime Boot Safety and all BW-26 through BW-29.4.2 checks, especially BW-21.1 language coverage, BW-23 settings/language, BW-26.6.2 node transition/geometry, BW-27 theme/Canvas checks, BW-28.3.1 runtime Insights, and BW-29.4.2 Canvas-context boundary.

## 17. Expected implementation files

Likely minimal future scope:

- `index.html`: additive accessible close/opener/labels or non-breaking shell attributes only; retain all existing IDs and nodes.
- `styles.css`: authoritative conditional shell columns, named width modes, overlay breakpoints, scroll normalization, accessibility/safe-area rules.
- `app.js`: narrowly scoped state normalization and `syncShellPresentation()`, calls from existing lifecycle/focus paths; no broad router or selection rewrite.
- One new layout-capable regression script and, if the repository pattern requires, minimal fixtures/harness support.
- `package.json`: one future `check:bw30` registration only.
- Runtime Boot Safety workflow/registration: add the future check only after implementation exists and passes.

No view-specific module change should be needed unless runtime testing proves a Simulator callback or focus contract cannot be normalized from `app.js`.

## 18. Systems that remain unchanged

Unless a failing runtime regression proves direct necessity, BW-30 must not change:

- API endpoints/routes, database/storage, board serialization, local storage, authentication, permissions, public-token validation, or presence protocol.
- Campaign generation, AI provider contracts, AI Brain request/context contracts, Funnel/Persona Journey provider flow, or diagnostic schemas.
- Brand persistence, Canonical/Board Brand ownership boundaries, document/knowledge modules, or Canvas node schema.
- Autosave semantics, dirty tracking, history snapshots, node ownership, node/edge world coordinates, zoom persistence, and Canvas dimensions.
- Existing DOM IDs, hidden legacy toolbar hooks, node/post-it templates, established dialogs/overlays, and Inspector descendants.
- Theme tokens, language dictionaries, or unrelated visual polish.

The audit itself changes none of these systems and does not change `package.json`, tests, Runtime Boot Safety, production JavaScript, HTML, or CSS.

## 19. Go/no-go criteria

### Evidence gates now satisfied

- **Shell owner identified:** `body > .app-shell`.
- **Exact Inspector root identified:** `aside#inspector-panel.inspector`.
- **Exact reservation mechanism identified:** explicit desktop third grid track `340px`, duplicated in expanded/collapsed templates, independent of item display; Inspector item also fixed at 340px.
- **Active-view lifecycle identified:** `setActiveView()` plus `setAppMode()`, boot, legacy, focus, Dashboard, Insights, Simulator, Calendar/search, AI Brain, and public access paths.
- **Scroll owners identified:** per section 8, including justified Canvas Inspector exception.
- **Existing ID dependencies identified:** static form, `el` cache/listeners, translation, geometry, and regression scripts.
- **Minimal strategy identified:** capability-derived shell attributes plus explicit open/mode state and conditional columns.
- **Runtime regression coverage specified:** lifecycle, computed geometry, scrolling, focus, data integrity, responsive/theme/language/public matrices.

### Implementation-start gates

Implementation remains **NO-GO** until the team agrees on all of the following:

1. Whether wide-desktop node selection auto-opens Inspector and whether that preference restores on Canvas return.
2. Whether Public Viewer receives a read-only Inspector/details region or no Inspector at all.
3. The docked→overlay breakpoint and Inspector width token; it must not produce an unusably narrow permanent column.
4. The destination-aware toolbar policy (which existing Canvas controls appear on non-Canvas views).
5. Per-view scroll restoration/reset behavior and the limited nested-scroll exceptions.
6. The shared `full`/`contained`/`reading` maximum-width tokens.
7. A layout-capable runtime test environment capable of computed-style, bounding-rect, focus, and scroll assertions.

If any implementation cannot preserve established IDs, Canvas geometry/autosave, Public Viewer access behavior, and complete Runtime Boot Safety, it is a no-go and must return to design rather than add per-view overrides.

## 20. Final recommendation

Proceed with a small coherent shell-state implementation after the seven product/testing gates above are resolved. Make `.app-shell` the sole geometry authority; make `setActiveView()` plus one presentation synchronizer the lifecycle authority; keep `fillInspector()` solely responsible for content; and reserve a third grid track only for an open, docked Inspector on Campaign Canvas. Use overlay mode below the wide-desktop threshold, preserve selected-node identity independently, and make every non-Canvas destination consume the complete Main application width under one of four named content modes.

Do not fix BW-30 with another round of Dashboard/Boards/Insights/Simulator-specific width overrides. Do not relocate or recreate the Inspector, rewrite the shell, alter Canvas persistence/geometry, or remove legacy DOM. The defect is concentrated enough to solve additively, but only a runtime layout/focus regression can prove it is solved.

**AUDIT READY FOR REVIEW**
