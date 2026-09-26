# BW-36 contextual shell, Funnel Simulator, and Brand workspace audit

> **Audit status:** documentation only. Repository inspection was read-only apart from this file. Labels used below are **Verified behavior**, **Verified cause**, **Product interpretation**, **Recommendation**, and **Unresolved**. A source-string check is evidence of implementation structure, not browser/runtime proof.

# 1. Executive summary

Three symptoms share one design problem: the interface does not consistently express *which object the user is acting on*. First, one `#canvas-topbar` contains graph commands, account controls, Board access, presence, and sharing, and remains rendered for almost every view. Second, the Funnel Simulator's mobile journey controls create a themed sticky bottom surface whose lifetime and containing scrollport are implicit. Third, a locally selected Brand, a Board's authoritative `brand_id`, the shared `brands.brand_core`, and `boards.brand_core_snapshot` are all exposed with implementation vocabulary.

* **Verified behavior:** `setActiveView()` hides the top bar only for Home; Brand mode separately hides it. Boards, list/calendar, Content, AI Brain, Insights, and Funnel Simulator therefore retain the complete Canvas toolbar (`app.js:16940-16961`, `app.js:17371`).
* **Verified technical cause:** there is one globally mounted toolbar in `index.html`, not duplicated shells or stale route state. Visibility is controlled by the `hidden` class while child controls remain the same (`index.html:341-400`; `styles.css:3221-3223`).
* **Verified technical cause (artifact owner):** the only Funnel step surface anchored to the viewport edge is `.journey-nav`, created by the Persona Journey renderer and changed at `max-width:768px` to `position:sticky; bottom:4px; padding:8px; background:var(--fk-color-surface-elevated)`. It contains Back/Continue navigation. The surrounding `.board-list-view` is the scroll owner. Thus the reported themed rectangle is the journey navigation surface, not a global footer or overlay (`persona-journey-simulator.js:render navigation`; `styles.css:1516-1521,1576-1580,7687,7690`). Its color necessarily follows theme tokens. Source inspection does **not** verify the reported large painted height at a particular production viewport; that sizing remains a browser reproduction item.
* **Verified model:** “Workspace selection” is an in-memory/localStorage preference over actual Brand records; it is not a Workspace database record. A Board separately stores authoritative `brand_id` and its own Brand Core snapshot. New branded Boards copy the current shared Core; later canonical edits do not silently rewrite Boards (`app.js:2929-3042`; `api/_brands-storage.js:12-40`; `api/_boards-storage.js:48-105`; `api/boards/index.js:150-179`).
* **Product interpretation:** graph tools, identity, Brand scope, and Board scope have been collapsed into one visual layer. “Canonical” describes persistence authority, not a user goal.
* **Recommendation:** use four headers: full Canvas; compact Board-context; Brand-context; account/library. Rename shared canonical data **Brand Profile / Markenprofil** and a Board copy **Campaign Brand Snapshot / Kampagnen-Markenstand**. Keep synchronization explicit and revision-checked.
* **Safest order:** contextual shell; narrow Funnel sticky-control repair; copy/terminology; comparison redesign; only then optional compatibility cleanup.
* **Unresolved:** production breakpoint/zoom reproduction of the artifact; prevalence of unbranded/diverged Boards; downstream consumers not explicitly proven below; and whether “Workspace” has a future entity beyond Brand selection.

# 2. Evidence and scope

## Repository evidence

* Inspected branch `work` at commit `2d66f5fd43656678478c928bbbe0569bb8a172db` before this audit commit.
* Primary files: `index.html`, `styles.css`, `app.js`, `funnel-simulator.js`, `persona-journey-simulator.js`, `content-workspace.js`, `content-calendar-architecture.js`, and `language.js`.
* Persistence/access files: `api/_brands-storage.js`, `api/_boards-storage.js`, `api/_brand-access.js`, `api/_board-access.js`, `api/_board-serializer.js`, `api/_brand-brain-context.js`, `api/_ai-brain-canvas-context.js`, `api/_funnel-simulator.js`, `api/brands/index.js`, `api/brands/[id].js`, `api/brands/[id]/members.js`, `api/boards/index.js`, and `api/boards/[id].js`.
* Contract evidence: BW-1/2/3/10/11/12/13/18/19/20/26/27/28/29/30/31 scripts. These are static/unit regression evidence, never substituted for live visual proof.

## Owners and boundaries

| Concern | Verified owner |
|---|---|
| Primary DOM | Static sidebar/views/topbar in `index.html:120-400,590-651`; simulator descendants in the two simulator modules |
| Shell CSS | `styles.css:1123-1157,1509-1527,1576-1580,8168-8263` plus early toolbar CSS in `index.html:14-63` |
| View state | `state.activeView`, `state.appMode`, `setActiveView()`, and `synchronizeAppShell()` in `app.js:97,16880-16961` |
| Board state | `state.currentBoardId`, `currentBoardName`, `boardAccess`, `authoritativeBoardBrandCore`, and load generation in `app.js` |
| Brand selection | `ephemeralBrandSwitcherSelection` plus hashed per-email localStorage key in `app.js:2929-3042` |
| Shared Brand persistence | `brands` and `brand_members` in `api/_brands-storage.js:12-40` |
| Campaign persistence | `boards.brand_id`, snapshot/provenance/one backup, and `board_editors` in `api/_boards-storage.js:48-139` |
| Permissions | capability projections from `_brand-access.js` and `_board-access.js`; routes recheck rather than trusting UI |

Routes/views are button/state driven rather than URL routes: Home=`home`, Boards=`boards_library`, Canvas=`board`, legacy list=`list`, legacy calendar=`calendar`, Content=`content_workspace` (including its Calendar tab), Brand Core=`brand-core`/brand mode, AI Brain=`ai_brain`, Insights=`insights`, Funnel=`funnel_simulator`; Settings is a dialog. The Board ID may also be read from the path, but section navigation is `activeView` driven.

No browser screenshot was supplied as a repository asset and no authenticated browser/data environment was used. The user's black/white bottom-rectangle observation is considered user evidence; source inspection verifies its unique sticky candidate and token behavior, not pixel dimensions. No secrets, payloads, personal data, or real Board content were inspected.

## Explicit non-goals

No code or visual fix; no HTML/CSS/route/test/workflow/dependency/schema change; no migration; no Brand Core mutation; no Board reassignment; no provider, AI, publication, approval, scheduling, or network request; and no production-data read/write. Provider isolation remains unchanged.

# 3. Current application-section inventory

“Full” means the single Canvas toolbar: Create campaign, Add node, Undo, search, Filters, Utilities, zoom, access, presence, sharing, theme, and account.

| Destination (identifier) | Current shell | Scope B/Brand/Workspace; no Board? | Current/relevant versus irrelevant actions | Identity/context | Responsive owner and permission dependency |
|---|---|---|---|---|---|
| Home (`home`) | Topbar hidden | no/no/selected preference; yes | none; Canvas actions correctly absent | sidebar Brand selector; no topbar identity | `setActiveView`; auth affects catalog |
| Boards (`boards_library`) | Full | library may filter Brand; yes | create/open Board relevant; node/search/filter/undo/zoom/share irrelevant | toolbar identity; sidebar selection; no chosen Board required | library CSS; list auth and Brand membership |
| Canvas (`board`) | Full | yes/association/selection incidental; no meaningful Canvas without Board | all graph commands relevant; share/presence/access relevant | identity + Board access; Brand association in sidebar | toolbar media rules; Board view/edit/share capabilities |
| Legacy Board list (`list`) | Full | Board library-ish; yes | list actions relevant; graph controls irrelevant | identity plus potentially stale Board badges | generic `.board-list-view`; Board access |
| Legacy Calendar (`calendar`) | Full | yes/no direct/selection incidental; generally no | calendar controls relevant; graph controls irrelevant | full toolbar | generic view; edit for schedule-like actions |
| Content Workspace (`content_workspace`, Library tab) | Full | yes/Board snapshot/selection incidental; renders no-Board state | refresh/review relevant; graph controls irrelevant | toolbar identity/access plus Content's own Board state | `content-workspace.js`; `canView/canEdit`, public read-only |
| Content Calendar (same view, `calendarState.mode=calendar`) | Full | yes/Board snapshot/incidental; empty state without Board | calendar plan/export relevant; graph controls irrelevant | same | Content responsive sheets/portal; editor mutation gates |
| Brand Core (`brand-core`) | hidden via Brand mode | Board snapshot primarily; Board required for shown editor | Brand Core edit/reset relevant | sidebar shared Brand and Board association cards | Brand workspace CSS; Board edit for local Core |
| AI Brain (`ai_brain`) | Full | yes; uses Board Canvas/snapshot; unavailable without Board | ask/advice actions relevant; graph toolbar irrelevant | own Board context plus duplicated full toolbar | view renderer; authenticated editor for new advice |
| Insights (`insights`) | Full | yes; no-Board unavailable state | refresh/show-on-Canvas/ask Brain relevant; graph toolbar irrelevant | own Canvas provenance plus toolbar | `styles.css:7615-7634`; view/edit gates actions |
| Funnel Simulator (`funnel_simulator`) | Full | yes for journey; assumption mode can render context without it | simulator reset/navigation/run/handoff relevant; graph toolbar irrelevant | simulator context plus toolbar | simulator CSS/modules; journey run requires authenticated editor |
| Settings (`#settings-dialog`) | modal over current shell | account/global; yes | language/theme/connections relevant; all graph actions irrelevant behind modal | no dedicated identity header | dialog CSS; auth/provider configuration varies |

There is no separately navigable top-level Content Calendar button: it is a tab owned by Content Workspace. The additional live primary destinations are the legacy List and Calendar views exposed by the view switcher hooks; they should follow compact Board context until removed.

# 4. Canvas toolbar ownership

## Trace

The sole render owner is static `#canvas-topbar > .canvas-toolbar` (`index.html:342-400`). `el.canvasTopbar` is cached once (`app.js:236`); it is not mounted/unmounted per section. `setActiveView()` toggles all content views, then only `classList.toggle("hidden", isHome)` for the topbar when not in Brand mode (`app.js:16940-16961`). Brand-mode synchronization separately toggles it (`app.js:17371`). Therefore it is **globally mounted and insufficiently contextualized**. It is not duplicated, merely conditionally styled, or driven by stale route state.

Bindings include campaign creation, node insertion, undo history, `node-search-input`, filter/tools menus, zoom, save status, theme menu, auth, Board access, presence, claim/share, and copy link. Dependencies span `nodes`, selection/history/filter/zoom, `currentBoardId/name`, `boardAccess`, authenticated user, presence, public token, dirty/save state, and theme preference. The toolbar participates in Canvas viewport calculations (`app.js:5657-5664`), making ownership changes layout-sensitive.

| Control | Classification | Outside Canvas decision |
|---|---|---|
| Create campaign | Board-level initiation (currently placed with graph tools) | Boards only as page action; not every header |
| Add node, Undo, node search, Filters, Utilities, zoom/save status | Canvas-only | hide outside Canvas |
| access/owner/read-only chip | Board-contextual | compact read-only indicator only |
| presence/collaborators, claim, Copy Link | collaboration/share | Canvas; share in Board context menu where needed |
| Google sign-in/avatar/name/email/sign-out | global account | retain through common account component |
| theme | global appearance | retain globally, preferably account menu plus quick icon |
| view switcher/legacy hidden hooks | obsolete/duplicate compatibility | do not expose in new headers |

Responsive behavior is split between inline `index.html:14-63` and `styles.css:8168-8263`; below 1200px rows collapse, and small screens permit a tall scrollable topbar. Theme surfaces come from `html[data-theme] .topbar` and dark nav tokens (`styles.css:7220,7282`). This further proves the full object persists rather than becoming semantically contextual.

# 5. Recommended contextual-header matrix

| Section | Type | Left / center / right | Permitted actions; hidden actions | No Board / mobile |
|---|---|---|---|---|
| Home | D Account/library | Tendra One / none / account menu + theme | none; hide all Canvas | welcome/library state; 44px avatar menu |
| Boards | D | “Boards” + selected Brand filter / search-filter / account | Create campaign; hide graph/share/access | show “All Brands” or selected Brand; stack search |
| Canvas | A Full Canvas | Board name/access / search + graph tools / share, presence, account | current complete graph set | disabled empty Canvas with Open Boards CTA; two compact rows/drawer |
| Legacy List | B | Board name/access / list context / account | list-only actions; hide graph | no-Board empty; overflow menu |
| Legacy Calendar | B | Board name/access / date context / account | calendar navigation only | no-Board empty; compact date controls |
| Content Library | B | Board name + optional Brand / Content tabs / account | Refresh/review page actions max two | “No campaign selected—Open Boards”; tabs scroll |
| Content Calendar | B | same / date + Content tabs / account | Auto-plan/export when authorized | same; actions in page toolbar/sheet |
| Brand Core | C Brand | active Brand Profile / none / account | switch Brand, edit when permitted; no graph | show Choose Brand; Board snapshot only as secondary Campaign Brand settings link |
| AI Brain | B | Board name + Brand / conversation status / account | New conversation if later needed | explicit select-campaign state; truncate title |
| Insights | B | Board name / snapshot freshness / account | Refresh; hide graph | select campaign; one action overflow |
| Funnel Simulator | B | Board name + Brand / mode switch if useful / account | Reset inside page; no graph | assumption mode labeled unscoped; journey asks for Board |
| Settings | D | Settings / none / close + account identity | settings only | fully usable; modal/full-screen mobile |

This is the final matrix: A is Canvas only; B is Board-dependent product work; C is shared Brand knowledge; D is account/library. Section actions belong primarily in the page, not a universal command bar.

# 6. Compact header content hierarchy

1. Left: semantic section label, then active Board/campaign as the strongest context; optional Brand on a muted second line only where it disambiguates.
2. Center: no generic controls. Reserve for a section's one compact mode/status item.
3. Right: read-only/access icon+text, theme icon, Google avatar opening one account menu. Desktop menu shows name and email; mobile shows avatar only until opened. Sign out belongs in that menu, not permanently visible.
4. Use one-line ellipsis with accessible full name; at 200% zoom allow the context block to wrap, never shrink controls below 44px. Breadcrumbs are not justified in this shallow navigation.

Decisions: Copy Link stays directly visible only on Canvas; elsewhere put Share/Copy Link in an explicit Board context menu if the section has a collaboration use case. Collaborator count stays Canvas-only. Ownership badge becomes a low-weight access state (“Owner”, “Can edit”, “View only”) in Board headers. Theme is global. When no Board is open, say “No campaign selected” and link to Boards without rendering fake Board controls. Boards shows selected Brand filter but no active Board. Brand Core shows the active Brand as primary; if the open Board differs, show a non-alarming secondary note in Campaign Brand settings, never merge the two names.

# 7. Header state and lifecycle risks

Board open/switch/close, Brand/Workspace switch, route changes, auth, access role, resize/mobile navigation, portals, and theme must all feed one render decision. **Recommended boundary:** `AppShellHeader`, owned beside `setActiveView()`; **single decision source:** a pure `deriveHeaderModel({activeView, appMode, currentBoardId/name, boardAccess, selectedBrand, boardBrand, user, theme})`. Child headers render from that model and dispatch existing actions.

Risks and guards:

* stale Board/Brand names: key model to Board load generation and validated Brand catalog;
* old full toolbar invisibly mounted: render exactly one header variant, not CSS-hide its children;
* duplicate auth controls/listeners: reuse a single account component and delegated bindings;
* wrong-section Board commands: action allowlist in the derived model;
* disappearing identity: D fallback for every unknown/no-Board view;
* variable header height/content shift: stable minimum block and per-breakpoint layout contract;
* lost Board state: header selection must never call Board close/save;
* stale access: rerender after authoritative access response and disable immediately during transitions;
* portal z-index: menus use the established transient layer and clean up on view/auth change;
* responsive regressions: test 320px, tablet, desktop, 200% zoom, orientation, keyboard, both themes.

# 8. Funnel Simulator artifact root-cause analysis

## Ownership trace

Static owner is `#funnel-simulator-view.board-list-view > #funnel-simulator-surface` (`index.html:625-626`). `renderFunnelSimulator()` chooses assumption Funnel or Persona Journey; the latter creates `.journey-simulator-shell`, `.journey-panel`, and `.journey-nav`. The navigation owns Back/Continue. The active view is a flex child and scroll owner through `.board-list-view` plus non-Canvas shell overflow rules (`styles.css:1509-1527,1576-1580`).

| Finding | Classification | Evidence and explanation |
|---|---|---|
| `.journey-nav` is bottom artifact owner | **Verified structural owner / likely visual match** | Only simulator step element with bottom anchoring; at `max-width:768px`, sticky at `bottom:4px`, padded, themed elevated background (`styles.css:7687,7690`). It contains Continue in the journey renderer. |
| Theme changes rectangle | **Verified** | background is `var(--fk-color-surface-elevated)`; dark-mode tokens and a later dark selector also theme journey surfaces (`styles.css:7272-7284,7689`). |
| It is intended local action surface | **Verified** | DOM class is navigation; not empty footer/backdrop. It is generated only while a journey step renders. |
| It can overlap lower content | **Verified CSS capability** | sticky participates in the `.board-list-view` scrollport and paints above preceding content; no matching bottom scroll-padding/reserved space exists. |
| It covers Continue | **Likely interpretation, not source-proven** | Continue is its child, so the surface cannot z-cover its own child absent a production/browser issue. The report may mean the large surface conceals nearby content or clipping makes its child unreachable. Reproduce with computed layout before changing code. |
| Large height/full width | **Hypothesis** | flex/grid stretch, zoom, browser sticky calculation, or a production revision could magnify it; no explicit height/min-height/pseudo-element/fixed inset exists on `.journey-nav` in this commit. |
| `.journey-run-footer` | **Ruled out for Continue** | another sticky surface at review/run, but it contains Run, not Continue; later mobile rule makes it static (`styles.css:7703,7711`). |
| global toolbar/footer, overlay, drawer, pseudo-element, hidden retained element | **Ruled out by inspected source** | no simulator bottom fixed overlay/footer, relevant pseudo-element, or dimension-retaining hidden node; `.hidden` is `display:none`. |
| all breakpoints | **Ruled out** | `.journey-nav` becomes sticky only at `max-width:768px`; otherwise it is in flow. |

There is no z-index declaration on `.journey-nav`; the sticky box paints in normal stacking order. `.journey-summary` is the only explicitly layered sticky (`z-index:4`, top). Content is not removed, but can be painted beneath the bottom sticky box while scrolling. The exact production painted-height calculation is **unresolved** until browser DevTools records the computed box, containing block, zoom, viewport, and applied stylesheet revision.

**Narrow repair:** keep `.journey-nav` normal in-flow at every breakpoint (remove only its mobile sticky positioning/background/padding override, retaining flex/buttons), and add ordinary bottom padding to the simulator shell for safe-area spacing. Do not touch global shell overflow, simulator data, or run footer.

# 9. Funnel Simulator intended bottom-action behavior

Choose a **normal in-flow Continue action**. A wizard is short enough that persistent obstruction is worse than saved scrolling.

* Desktop/compact desktop/tablet: Back and Continue follow step content, right aligned; no persistent footer.
* Mobile: stacked or equal-width 44px controls, in flow, `padding-bottom:max(16px, env(safe-area-inset-bottom))`; never fixed/sticky.
* Scroll: one owner (`#funnel-simulator-view`); focus on a newly rendered step heading with `preventScroll` discipline; no covered content.
* Themes: transparent page background; buttons/tokens carry affordance, no empty theme-colored slab.
* Keyboard/focus: DOM order Back then Continue; disabled reason associated; focus ring visible; Enter must not bypass validation.
* Reduced motion: existing rule remains; no animated relocation.

Bounded sticky and local sticky were rejected because the reported failure is specifically obstruction. “No footer until needed” is effectively achieved because navigation renders with a step; the recommended navigation is in-flow.

# 10. Current Workspace model

## Technical model

There is no `workspaces` table in the inspected model. The switcher loads authorized `brands` summaries and stores `{v, brandId}` in localStorage under a SHA-256-of-normalized-email key; in memory it stores ID/name plus `restored` (`app.js:2929-3003`). “Restored” means recovered from that local browser preference after catalog validation, not restored data or a recovered Brand. Selection is user-keyed on that browser/profile, not server-global, session-only, or Board-specific.

Boards filtering uses catalog-resolved selected Brand ID; the Board list API supports branded and `brand_id IS NULL` scope (BW-10 contract). Unbranded Boards remain explicitly available rather than being adopted. Opening a Board whose association differs does not change the selected Brand; Board authority remains separate.

Roles are Brand owner/admin/editor/viewer through `brand_members`; catalog GET returns authorized rows (`api/brands/index.js:21-38`). Empty states include no Brand selected/catalog empty/loading/error; actions include selecting/creating/viewing/editing/deleting a Brand. The current copy calls this “Workspace,” “Canonical Brand,” and “Restored Workspace selection.”

## Plain product language

Today “Workspace” is just a remembered **Brand filter/context**, not a separately stored container. A campaign can belong to a different Brand because the filter does not rewrite campaign ownership. The UI makes that safe separation sound like two competing truths.

# 11. Current Brand association model

`boards.brand_id` is a nullable foreign key to `brands.id` with `ON DELETE SET NULL` (`api/_boards-storage.js:18-23,80,105`). New branded Boards validate Brand capability and copy Brand Core (`api/boards/index.js:150-179`). Reassignment is an isolated PATCH; it requires Board `canChangeBrandAssociation` and target `canEditCanonicalBrand`, updates only `brand_id`, clears provenance/backup fields, and **does not replace `brand_core_snapshot`** (`api/boards/[id].js:203-229`). Canvas/campaign data therefore remains.

The association is authoritative for canonical lookup/sync and Brand-scoped library grouping. It does not itself prove changes to existing generated content, exports, collaboration, or Board permissions; Board ACL remains separate. Generation/AI paths that use the Board snapshot continue using that snapshot after reassignment. Downstream use by Content/Insights is mostly Board/Canvas, not proven to branch on `brand_id`; Funnel journey projects personas from the Board Core supplied by app context.

Thus “Board association is authoritative and separate from Workspace Brand selection” is technically correct. It is confusing because “authoritative” lacks an object and “Workspace Brand” sounds like a higher authority. Say: **“This campaign uses {Brand}. Changing your Brand filter does not change this campaign.”**

# 12. Current Brand Core authority model

| Representation | Storage/schema/owner | Mutation and permissions | Readers / authority role |
|---|---|---|---|
| Shared canonical Core | `brands.brand_core` JSONB object, `revision`, timestamps | Brand PUT with expected revision; `canEditCanonicalBrand` | Brand detail; new Board copy; comparison/sync; shared source of truth |
| Board-local Core/snapshot | `boards.brand_core_snapshot` JSONB nullable | normal Board PUT from editor; explicit canonical refresh | Canvas generation, AI Brain, journey context; campaign source of truth |
| Provenance | Board source revision/update/copied timestamps | server on create/refresh; cleared on reassociation | comparison/safety; metadata, not content |
| One-step backup | Board backup JSONB + provenance + backup timestamp | server swaps on refresh/restore | rollback only; not normal reader |
| Restored Brand data | no data representation | localStorage only restores selected Brand ID | filter/context only; not a Core |
| “Brand Core snapshot” runtime | `state.authoritativeBoardBrandCore` loaded from server | invalidated with Board generation; never authority beyond response | safe comparison/write preconditions |
| Generation-time context | serialized Board `brand_core_snapshot` | read through authorized Board | existing Board generation; snapshot/fallback behavior is route-specific |
| AI Brain context | authorized Board snapshot plus optional canonical context flag | read-only request route | advice; route contracts prohibit client-supplied Core |
| Funnel persona context | Board Core projected into groups in Persona Journey | read-only until provider run | target group/persona selection |
| Legacy compatibility | nullable/missing snapshot/provenance and runtime additive schema | no automatic backfill | guarded fallback/invalid states, not a new truth |

Hierarchy: `brands.brand_core (shared, revisioned)` → explicit copy at Board creation/refresh → `boards.brand_core_snapshot (campaign truth)` → runtime projections. Manual Board edits may diverge. Canonical updates do not push. Backup is recovery only.

# 13. Exact meaning of “Canonical Brand Core”

Canonical means the single revisioned Brand-level JSON object shared across campaigns. It exists to reuse Brand knowledge without silently mutating campaigns. It contains flexible Brand Core fields such as personas, tone, and value proposition. A newly created associated Board receives a copy; existing Boards do not immediately change. It is not proven that *all* future systems read it directly: existing campaign systems generally consume their Board snapshot.

A Board copy is created on associated Board creation and deliberately refreshed only through the guarded operation. It may differ for historical stability, campaign-specific adaptation, offline edits, or because the shared Profile advanced. Campaign→shared risks overwriting reusable truth; shared→campaign risks replacing intentional campaign differences. Both require explicit comparison, authorization, revision/freshness confirmation, and recovery.

Users do not need “canonical.” Final terms: **Brand Profile** for `brands.brand_core`; **Campaign Brand Snapshot** for `boards.brand_core_snapshot`. “Master” implies hierarchy, “Shared” is descriptive but less goal-oriented, “Foundation/Source” is vague, and “Campaign Brand Settings” hides snapshot semantics.

# 14. Compare Brand Cores analysis

Entry is the sidebar Current Board Brand card (`index.html:169-210`). Required state is an open authorized Board, associated Brand, saved authoritative Board snapshot, and loaded Brand. `loadBoardBrandCoreComparison()` obtains server objects; comparison recursively canonicalizes JSON and produces canonical-only, Board-only, and differing values. Paths are root `$` plus property/array notation; equal means canonical JSON equality, missing means only one object has that path, different means both do but values differ (`app.js:3715-4094`).

Direction is not merged: initialize copies the last saved Board snapshot into an **empty** shared Core; refresh replaces the entire Board snapshot from shared Core. Refresh requires editor access, validated provenance, matching Board timestamp/Brand/revision, backs up the prior snapshot, and supports a one-step restore (`api/boards/[id].js:40-110`). Initialization is additionally guarded against non-empty canonical data. Comparison/view may be broader than mutation, while public/restricted serializers redact sensitive fields.

Safety is materially good (server authorization, concurrency, exact operations, backup for shared→Board). Labels are not: JSON paths, raw JSON, “initialize,” “canonical,” and direction hidden at the end force users to decode implementation. Campaign→shared initialization has no equivalent documented one-step Brand rollback/audit history; its confirmation says Boards remain unchanged, but recovery is unresolved. Localization is incomplete because hard-coded English is present. Dialog semantics/focus exist, but raw wrapping and dense groups are weak on mobile and screen readers.

# 15. Recommended simplified mental model

Adopt exactly this model:

* **Brand Profile:** reusable, shared, revisioned Brand knowledge—positioning, value proposition, audiences/personas, tone, and other attributes.
* **Campaign Brand Snapshot:** the stable copy currently used by one campaign Board.

This accurately maps to `brands.brand_core` and `boards.brand_core_snapshot`. New campaigns can start from the current Profile; existing campaigns remain stable; differences are permitted; synchronization is deliberate and never continuous. “Campaign” is the user term for Board in this explanation, while Canvas remains its graph surface.

# 16. Recommended Workspace and Brand Core information architecture

1. Rename the current “Workspace” switcher **Brand**; its job is top-level Brand/account filtering, not a Workspace entity.
2. **Brand Profile** is the one Brand-level review/edit destination.
3. **Campaigns** lists Boards associated with that Brand plus a deliberate “Unassigned” scope.
4. **Campaign Brand settings** lives in Board settings/context and shows associated Brand, snapshot date/source revision, difference status, compare, and explicit sync.

Move the current Board Brand card out of the global sidebar into **Board settings**, reachable from the compact Board header context menu. Keep only a one-line Brand context under the campaign title. This prevents a Board mutation control from competing with the global Brand filter.

# 17. Recommended terminology and copy

| Current | Final English | Final German |
|---|---|---|
| Workspace | Brand | Marke |
| Current Board Brand | Campaign Brand | Kampagnenmarke |
| Canonical Brand | Brand | Marke |
| Canonical Brand Core | Brand Profile | Markenprofil |
| Board Brand Core | Campaign Brand Snapshot | Kampagnen-Markenstand |
| Compare Brand Cores | Compare with Brand Profile | Mit Markenprofil vergleichen |
| Initialize Canonical Brand Core from this Board | Create Brand Profile from this campaign | Markenprofil aus dieser Kampagne erstellen |
| Update Board Brand Core from Canonical | Apply Brand Profile to this campaign | Markenprofil auf diese Kampagne anwenden |
| Change Board Brand | Change campaign Brand | Marke der Kampagne ändern |
| Brand · Restored | Brand selection restored | Markenauswahl wiederhergestellt |
| Workspace selection | Brand filter | Markenfilter |
| Board association is authoritative and separate from Workspace Brand selection. | This campaign uses {Brand}. Changing the Brand filter does not change this campaign. | Diese Kampagne verwendet {Brand}. Eine Änderung des Markenfilters ändert die Kampagne nicht. |
| Different | Differences found | Unterschiede gefunden |
| Matches | Up to date | Aktuell |
| Restore previous Board Brand Core | Restore previous campaign snapshot | Vorherigen Kampagnen-Markenstand wiederherstellen |

Confirmation copy, shared→campaign: **“Replace this campaign’s Brand Snapshot with Brand Profile revision {n}? {count} fields will change. Existing generated content and nodes will not be rewritten. You can restore the previous snapshot once.”** German: **„Kampagnen-Markenstand durch Markenprofil Revision {n} ersetzen? {count} Felder ändern sich. Bereits erstellte Inhalte und Nodes werden nicht umgeschrieben. Der vorherige Stand kann einmal wiederhergestellt werden.“**

Campaign→shared: **“Create/replace the Brand Profile from this campaign? This changes shared Brand knowledge for permitted future uses; other campaigns remain unchanged.”** German: **„Markenprofil aus dieser Kampagne erstellen/ersetzen? Dadurch ändert sich das gemeinsam verwendete Markenwissen für zulässige zukünftige Verwendungen; andere Kampagnen bleiben unverändert.“** In the current implementation only “create” is safe when the Profile is empty; do not expose “replace” until a guarded route exists.

# 18. Recommended comparison UX

Summary states: **Up to date**, **Differences found ({n})**, **No Brand Profile**, **No Campaign Brand Snapshot**. Group mapped paths into Positioning, Audience & personas, Value proposition, Voice, and Other Brand attributes. Each row names the field and presents “Brand Profile” versus “This campaign,” with text+icon states Changed/Missing here/Missing in Profile. Raw `$.*` paths belong only in a collapsed “Technical details” diagnostic disclosure.

Safe actions are Cancel; **Create Brand Profile from this campaign** only when shared Core is empty; **Apply Brand Profile to this campaign** with affected field count; and one-step restore when the server advertises it. Do not offer field-level sync now: current architecture replaces whole JSON objects, so selectors would falsely imply safe merge semantics.

Reuse capability gates; viewers see comparison without mutation buttons and a “View only” explanation. Before confirmation refetch/revalidate both revisions and Board timestamp; 409 returns to comparison rather than retrying silently. Brand-side history/rollback is a prerequisite for any non-empty campaign→Profile replacement. Use a real dialog heading, focus trap/return, live status, semantic definition list/table, 44px targets, stacked mobile columns, and no color-only meaning.

# 19. Product consequences of synchronization

## Campaign → Brand Profile

Verified initialization changes `brands.brand_core`/revision and leaves all Boards unchanged. Consequently new Boards created later from that Brand see it. Existing Boards, nodes, generated content, exports, approvals, schedules, and publications do not auto-change. Direct future readers of the shared Profile can see it after their next authorized read. Whether AI Brain, Insights, generation, or Funnel uses shared data directly outside creation is route-specific/unresolved; do not promise an immediate effect.

## Brand Profile → Campaign

Verified refresh replaces this Board's snapshot, records provenance, retains exactly one backup, and updates Board timestamp. Existing Canvas nodes/content do not regenerate. New generation and AI routes proven to read Board snapshot can use the new context on subsequent requests. Persona Journey's target groups are projected from supplied Board Core and therefore update on rerender/reload. Content and Insights are primarily Canvas projections; no automatic content/metric rewrite is proven. Exports serialize existing content/plans and do not become rewritten merely from Core replacement. Every UI confirmation must state these boundaries.

# 20. Authorization and collaboration

| Operation | Current boundary / recommended UX |
|---|---|
| switch Brand filter | authenticated user may select only catalog-visible Brands; selector disabled/loading otherwise |
| associate Board | `canChangeBrandAssociation` plus target `canEditCanonicalBrand`; viewers/public hidden or read-only |
| edit shared Profile | `canEditCanonicalBrand`; viewer sees values and role explanation |
| initialize/update shared from Board | capability and server freshness checks; only eligible empty Core today |
| apply shared to Board | Board edit plus Brand edit capability currently required; disabled with reason |
| compare/view | authorized Board + Brand visibility; redact for public token/restricted shapes |

Owner/admin/editor/viewer capability details must come from server projections, not role-name assumptions. Board editors and Brand editors are separate memberships. Public-token users must not receive Brand IDs/Core snapshots. Cross-Brand reassignment must validate both objects. On stale role changes, disable optimistically, re-fetch, and treat 403/404 as access changed without leaking existence.

# 21. Data safety and migration impact

The proposed shell, terminology, information architecture, and comparison presentation require **no database migration**. Phase 1–3 are render/projection/copy changes. Phase 4 may need API response shaping (human-readable diff metadata, history) but can initially reuse existing endpoints. Do not backfill provenance or snapshots merely for copy.

Preserve `brands`, `brand_members`, `boards.brand_id`, nullable Board snapshot, source revision/timestamps, one backup slot, Board ACL, public redaction, optimistic concurrency, and legacy nullable fallbacks. A compatibility reader remains needed for old Boards lacking provenance. Rollback is UI deployment rollback; data mutations retain current endpoint semantics. Removal of legacy fields requires measured usage, explicit migration evidence, backup/export, and a separate proposal.

# 22. Responsive and visual direction

Use Tendra One tokens, quiet page backgrounds, one compact context line, and progressive disclosure. The Brand selector is a compact combobox/menu with “All Brands” and “Unassigned,” not stacked cards. Header context remains visible but truncates; account details open from avatar. Brand Profile uses grouped readable cards; Campaign Brand settings is one small summary card. Comparison uses stacked two-column values on desktop and labeled sequential values on mobile.

Drawers/sheets must portal intentionally, trap/restore focus, and clean up on view changes. Empty states explain the next safe action. Difference states use icon+text+border, not color alone. Both themes use semantic surface tokens. All controls remain at least 44px, layout reflows at 200% zoom, raw JSON is diagnostic-only, and repeated “Brand/Core/Canonical” headings are removed.

# 23. Recommended implementation phases

## Phase 1: Contextual shell

* Likely files: `index.html`, `app.js`, `styles.css`, language catalog, shell regression scripts.
* Change: one header model and A/B/C/D render variants; full toolbar Canvas-only.
* Preserve: `activeView`, open Board, auth, access, action handlers, Canvas viewport math, provider isolation.
* Accept/test: section matrix at routes/breakpoints/themes/zoom; no duplicate DOM IDs/listeners/account controls; Board survives navigation.
* Deploy/rollback: self-contained UI deploy/feature flag; revert header renderer/styles only. No migration.

## Phase 2: Funnel artifact repair

* Likely files: `styles.css` and journey visual regression; no simulator API.
* Change: make `.journey-nav` in-flow; safe-area padding; preserve validation/actions.
* Accept/test: computed position static/relative, Continue reachable, no overlap at 320/768/desktop, both themes/zoom/keyboard.
* Deploy/rollback: isolated CSS release/revert. No migration.

## Phase 3: Workspace and Brand terminology

* Likely files: `index.html`, `app.js`, `language.js`, docs/copy checks.
* Change: Brand filter/Profile/Campaign Snapshot copy; relocate association summary to Board settings.
* Preserve: selection key/value, Board association, all API payloads and permissions.
* Accept/test: EN/DE coverage, first-use comprehension, no “canonical” primary copy, no mutations from filter selection.
* Deploy/rollback: copy/layout bundle; revert without data impact. No migration.

## Phase 4: Brand Profile and campaign snapshot UX

* Likely files: comparison renderer in `app.js`, dialog HTML/CSS/language; possibly additive response projection/tests.
* Change: grouped human diff, explicit direction, confirmations/freshness/rollback display.
* Preserve: full-object semantics, revision checks, one-step Board recovery, authorization/redaction.
* Accept/test: equal/missing/different, stale 409, roles/public token, focus/mobile/200%, exact affected count; no silent sync.
* Deploy/rollback: UI first against compatible endpoints; any additive API independently reversible. No schema migration initially.

## Phase 5: Optional technical cleanup

* Likely files only after telemetry: storage/API compatibility fields and versioned migrations.
* Change: remove proven-unused legacy state—not product behavior by default.
* Preserve: snapshots/history/rollback/export; acceptance requires usage evidence and restore rehearsal.
* Deploy/rollback: separate migration with compatibility window and rollback SQL. Migration conclusion today: **not justified**.

# 24. Acceptance criteria

## Contextual header

* Full toolbar DOM/actions appear only when `activeView=board` Canvas is visible.
* Every non-Canvas Board section shows current campaign and account identity; no-Board sections show no irrelevant Board commands.
* Home/Boards/Settings use account/library; Brand Profile uses Brand context.
* Route changes preserve active Board; one account control exists; role/auth/theme updates rerender safely.
* Stable at 320px through wide desktop, 200% zoom, keyboard, and light/dark.

## Funnel

* No unexplained bottom rectangle; `.journey-nav` is in flow at all widths.
* Continue is visible/reachable, with no content overlap or horizontal overflow.
* Safe-area padding works; focus remains visible; light/dark surfaces match; reduced motion is honored.

## Brand

* In usability validation a first-time user identifies selected Brand and campaign Brand without help.
* No unexplained “canonical” or raw JSON path appears in primary UI.
* Direction, exact impact, unchanged existing content, and rollback availability appear before sync.
* No silent sync; viewer/public cannot mutate; server concurrency and source-of-truth protections remain.

# 25. Risks and unresolved questions

Production/product evidence is required for:

1. whether “Workspace” equals Brand for every persisted concept or a future Workspace entity exists;
2. whether campaigns intentionally use a Brand different from the selected filter;
3. frequency and value of unbranded Boards;
4. frequency/shape of Profile–snapshot divergence;
5. real use of either synchronization direction and failure/409 rates;
6. whether existing Boards should always remain historical snapshots;
7. every AI Brain path's choice of shared Profile, Board snapshot, or both;
8. confirmation that Funnel Persona Journey always receives Board rather than shared personas;
9. whether Insights uses Brand context beyond Canvas text;
10. whether reassignment has any indirect permission/business effect outside the verified ACL code;
11. whether a canonical public Brand URL is planned (none verified);
12. whether compare/update operations have durable audit history (none verified here);
13. whether safe field-level sync/merge is supported (current full-object operation says no);
14. browser reproduction of the reported artifact: viewport, 200% zoom, journey step, computed `.journey-nav` dimensions/containing block, CSS revision, and screenshot;
15. whether “Continue” refers to Persona Journey navigation or a different production revision.

# 26. Final recommendation

Implement a single shell-owned header decision: full toolbar only for Canvas; compact Board header for List/Calendar/Content/AI Brain/Insights/Funnel; Brand header for Brand Profile; account/library header for Home/Boards/Settings. Repair Funnel narrowly by making the mobile `.journey-nav` normal in-flow with safe-area spacing, after one DevTools reproduction confirms its anomalous height. Present shared `brands.brand_core` as **Brand Profile / Markenprofil** and Board `brand_core_snapshot` as **Campaign Brand Snapshot / Kampagnen-Markenstand**, with Brand association in Board settings and explicit whole-snapshot sync. No database migration is required for the recommended simplification. Start with Phase 1 because it fixes the context hierarchy without changing data or application semantics; ship the isolated Funnel CSS repair next.

This audit applies no fixes, data mutations, provider requests, AI requests, publication actions, Board reassignment, or Brand Core synchronization.
