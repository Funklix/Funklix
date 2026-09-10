# BW-33.1 — Tendra One rebrand, unified interface and Canvas simplification audit

**Date:** 2026-09-10

**Status:** Documentation-only; ready for product review

**Evidence base:** repository at the audit date plus the two supplied visual references
**Non-goal:** this document changes no runtime behavior, product copy, assets, schema, configuration, test, or publishing integration.

## 1. Executive summary

Tendra One can safely adopt the supplied visual direction, but **not by replacing the current shell or Canvas markup wholesale**. The repository is a stateful, mostly single-page application in which `index.html` creates hundreds of stable elements, `app.js` caches and mutates those elements, and a large, source-order-sensitive stylesheet styles both static and runtime-generated markup. The central architectural risk is therefore loss of event ownership or render state when a visual redesign replaces DOM nodes, IDs, classes, or hidden-state semantics.

The safe strategy is additive and phased:

1. acquire approved production brand assets and decisions;
2. alias a new semantic Tendra token layer onto the existing variables and safely rename only visible copy/metadata;
3. restyle shared controls and then the existing shell without replacing its structure;
4. add **Compact**, **Standard**, and **Detailed** Canvas projections as presentation-only render choices;
5. clean up one product area at a time;
6. build the public site only after routing, OAuth, cookie, CSP, and canonical-URL decisions;
7. keep Company LinkedIn work paused until its stated prerequisites exist.

The Inspector should become the authoritative complete editor. Canvas modes must project the same canonical node object, never change serialized fields, fingerprints, planning state, IDs, positions, edges, or approval eligibility. The lowest-risk preference is a **per-user, per-browser local preference**, initially global across Boards, in a new namespaced/versioned UI key. It must default to Standard when absent or invalid and must never be included in `canvas_json`.

**Go/no-go for Phase 1: conditional GO.** Begin only after the logo master/variants, exact wordmark casing, tagline decision (or explicit decision to omit it in-app), product naming matrix, font licenses, favicon/app-icon design, and public/app URL plan are approved. Token scaffolding and a reference inventory can proceed; visible replacement must wait for those decisions.

## 2. Method, evidence, and limits

The audit inspected `index.html`, `styles.css`, `app.js`, `content-workspace.js`, `language.js`, theme scripts, API/auth/board/social modules, `vercel.json`, `package.json`, README/documentation, and existing integrity checks. Static searches covered names, metadata/assets, IDs/selectors, storage, cookies, environment variables, URLs, SQL identifiers, renderers, listeners, inline styles, breakpoints, motion, z-index, and theme tokens.

No supplied concept was treated as a functional specification. The screenshots do not prove that favorites, annotations, metrics, alternate navigation, or actions exist. Findings marked “unclear” require runtime/browser or product confirmation. No provider publishing recommendation is made; existing LinkedIn foundations are preservation boundaries.

## 3. Current architecture and DOM dependency findings

### 3.1 Runtime shape

- `index.html` is the static composition root: sidebar/navigation, toolbar/auth/access cluster, Dashboard, Canvas layers, Boards/List/Calendar, Content Workspace host, Insights, simulator, AI Brain, Brand Core, Inspector, templates, context menus, and scheduling overlay.
- `app.js` owns global application state, caches the static DOM in its `el` map, binds most listeners, renders Canvas nodes/edges and multiple product areas, mutates the Inspector, loads/saves local and server Board state, and coordinates autosave/access/auth/collaboration.
- `content-workspace.js` is a separate projection/renderer. It replaces the workspace host’s `innerHTML`, then binds card/filter/review/calendar/publishing controls. Its dialogs are dynamically appended and own focus trapping/return.
- `language.js` provides the browser global consumed by `app.js`; language updates can therefore invalidate visible text assumptions without changing IDs.
- `theme-bootstrap.js` applies theme before full app boot; `theme.js` persists and reacts to system preference. This ordering is required to avoid flash and theme drift.
- `styles.css` is a single, 7,792-line cascade containing foundation tokens followed by many historical/component-specific rules and repeated dark/mobile/reduced-motion blocks.
- Boards persist canonical state in `canvas_json`; server APIs impose access and optimistic-save boundaries. Approval and social publishing read canonical node material and fingerprints rather than a view model.

### 3.2 Stable DOM contract map

The table groups related IDs/selectors with the same lifecycle. “Create” means static markup or dynamic renderer; “read/write/listener” names the owner. Every listed static ID should be treated as an integration API until a browser-level dependency test proves otherwise.

| Area / stable contract | Created by | Read / written by | Listener owner | CSS dependency | Lifecycle | Structural safety |
|---|---|---|---|---|---|---|
| Shell `#left-sidebar`, `#sidebar-toggle-btn`, `.app-shell` | `index.html` | `app.js` toggles state/classes | `app.js` | shell grid/sidebar rules and 1024/1300px queries | boot; responsive changes | **Unsafe to replace**; safe to restyle in place |
| Primary nav `#home-nav-btn`, `#boards-nav-btn`, `#campaign-canvas-nav-btn`, `#content-workspace-nav-btn`, `#brand-core-nav-btn`, `#ai-brain-nav-btn`, `#insights-nav-btn`, `#funnel-simulator-nav-btn` | `index.html` | `app.js` active/hidden state and programmatic `.click()` transitions | `app.js` | `.nav-item`, active/hidden rules | persistent shell; area switch | IDs, buttons, and click ownership unsafe; icon/text styling safe |
| Top bar `#canvas-topbar`, create/add/undo/search/filter/utility/theme buttons | `index.html` | `app.js` enablement, counts, labels, menu state | `app.js` | toolbar/control/popover rules | Canvas area; access/state dependent | preserve IDs and button semantics; visual regrouping is medium risk |
| Auth/access `#auth-panel`, `#google-signin-btn`, `#auth-user`, avatar/name/email/signout; access/presence/share IDs | `index.html` | `app.js` auth, access and polling renderers | `app.js` | auth/access/chip/popover rules | async session + Board access | restyle only before auth/access regression |
| Canvas host `#canvas`, `#canvas-scroll-surface`, `#zoom-layer` | `index.html` | `app.js` measures scroll/viewport and transforms zoom layer | `app.js` pointer/scroll/zoom | canvas sizing/grid/overflow/transform rules | area mount, Board render, zoom, resize | **Critical; do not replace or reorder casually** |
| Connections `#links` and edge/path selectors | `index.html` SVG | `app.js` creates/updates/removes paths and endpoints | `app.js` edge interactions | SVG/path hover/selected/theme rules | after node layout, movement, zoom, expand | **Critical geometry contract**; color/stroke tokenization safe |
| Nodes `.node`, `[data-id]`, handles/actions plus `#node-template` | template + `app.js` cloning/rendering | `app.js` content, selection, positions, dimensions, classes | `app.js` pointer, click, input/actions | extensive role/state/selection/card rules | Board render and most state transitions | retain identity/data attributes/handles; inner visual projection can be changed incrementally |
| Post-its `#postit-template` and post-it selectors | template + `app.js` | `app.js` | `app.js` | post-it rules | Canvas render/edit | preserve separate behavior; do not force node-detail modes onto it without evidence |
| Context menu `#context-menu` and context actions | `index.html` | `app.js` positions/toggles/writes | `app.js` | fixed overlay, hidden and z-index rules | contextual transient | restyle; retain mount and hidden/focus behavior |
| Canvas zoom controls `#zoom-out-btn`, `#zoom-label`, `#zoom-in-btn` | `index.html` | `app.js` | `app.js` | fixed controls/mobile rules | Canvas visible | styling safe; hit targets and labels required |
| Inspector `#inspector-panel`, close/meta, `#node-form`, all `#node-*`, landing/social/image/planning/action IDs | `index.html` | `app.js` `fillInspector` and conditional-field render/mutation paths | `app.js` form/input/action handlers | desktop third column, mobile overlay, field groups | selection; role/status/access changes | **Critical editor contract**; restyle and regroup visually before moving DOM |
| Content Workspace `#content-workspace-view`, `#content-workspace-surface` | `index.html` | `app.js` mounts; `content-workspace.js` replaces host HTML | both modules | `.cw-*` rules | every workspace refresh/filter/action | host ID critical; card markup owned by renderer; avoid duplicate binding after rerender |
| Boards/List/Calendar hosts and controls | `index.html` | `app.js` renderers | `app.js` | board/list/calendar rules | view switch/load/filter | preserve hosts and controls; card internals can be restyled |
| Brand Core `#brand-core-workspace`, `#brand-core-canvas`, editor IDs; brand dialogs/switcher IDs | `index.html` + dynamic `app.js` markup | `app.js` | `app.js` | `.bc-*`, brand-workspace/dialog rules | brand/Board load, edit, recovery | high state/recovery risk; one bounded phase only |
| AI Brain `#ai-brain-view`, `#ai-brain-summary`, dynamic form/result/proposal IDs | static + `app.js` | `app.js` | `app.js` | `.ai-brain-*` rules | navigation and async turns | preserve proposal/transition lifecycle; cosmetics safe |
| Insights `#insights-view`, `#insights-cards`, dynamic methodology IDs | static + `app.js` | `app.js` | `app.js` | `.insights-*` rules | current snapshot/Board changes | read-only but Canvas focus handoff is functional dependency |
| Settings `#settings-dialog` and language/theme/social controls | `index.html` | `app.js`, theme/language/social modules | `app.js` | native dialog + settings rules | open/close; async social state | preserve native dialog, IDs, close/focus and controls |
| Dynamic dialogs (`.cw-dialog-backdrop`, reset/brand/create/share/lightbox overlays) | `app.js` / `content-workspace.js` | creating module | creating module | overlapping dialog/overlay rules | transient; often generation guarded | do not centralize markup until focus, stale-action and ownership tests exist |
| Toasts/feedback (`#share-link-toast`, `.cw-feedback`, status/live regions) | dynamic/static | respective renderer | respective renderer | toast/status/z-index rules | transient async | style safely; never remove live-region semantics |
| Mobile nav/Inspector/shell selectors | existing markup | `app.js` class/visibility handling | `app.js` | many 1023/900/768/720/640/560px queries | viewport dependent | source-order conflicts likely; browser matrix mandatory |

### 3.3 Specific hazards

1. **Large ID surface:** static markup declares about 310 IDs while `app.js` references about 355 distinct IDs, including dynamically created controls. Recreating “cleaner” markup would silently null cached references or detach listeners.
2. **Programmatic navigation:** AI Brain and Insights flows invoke the Canvas navigation button and then wait for layout before selection/focus. A new router or nav abstraction could break this ordering.
3. **Renderer/listener ownership:** `content-workspace.js` writes `host.innerHTML` and immediately calls `bind`; `app.js` also controls mount context and navigation. Persistent listeners on replaced descendants or an extra render pass can duplicate actions.
4. **Duplicate dynamic IDs:** `app.js` queries some IDs that appear in multiple generated templates/lifecycles (for example image lightbox, floating filters/utilities, custom Brand Core content). Uniqueness diagnostics exist, signaling known fragility rather than permission to rename.
5. **Inline runtime style:** static HTML has no inline `style` attributes, but `app.js` emits some inline styles and also writes element styles for geometry/positioning. These are functional for node/edge/overlay layout and must not be overwritten by broad CSS.
6. **Global/source-order cascade:** 465 distinct hex colors, legacy and `--fk-*` aliases, 51 `!important` uses, and repeated selectors/theme blocks mean a late “brand override” can win unexpectedly across unrelated areas.
7. **Hidden-state conflicts:** native `hidden`, `.hidden`, area-specific `is-*` classes, responsive rules, dialog open state, and inline positioning coexist. New display declarations must not override `[hidden]` or modal/mobile states.
8. **Geometry coupling:** node size, zoom transform, scroll surface, SVG paths, saved positions, focus reveal and minimap-like overview assumptions are coupled. Presentation modes must trigger endpoint recalculation without serializing derived dimensions.
9. **Async lifecycle guards:** Board load generations, access generations, save guards, approval action generations, and AI request lifecycles prevent stale writes. Visual components must preserve those owner modules and not add parallel mutation paths.
10. **CSS breakpoint fragmentation:** queries include 1400, 1300, 1180, 1023/1024, 980, 900, 860, 800, 768/767, 720, 700, 640, 600, 560, 480 and 360px. Consolidation is desirable but unsafe as an early cosmetic task.

## 4. Branding reference interpretation

### 4.1 What the identity permits

The connected three-part symbol expresses multiple contributors joining around a shared center. The lowercase wordmark, bright neutral field, soft violet/lavender/pink/peach dimensional gradients, and overlapping atmospheric forms communicate an intelligent but human collaboration system. In product UI this supports connection lines, presence, selected states and restrained ambient surfaces—not decorative saturation on every control.

Reference palette (recorded exactly, not yet adopted):

| Brand role | Reference value | Proposed semantic use |
|---|---:|---|
| Deep Focus | `#4F46E5` | primary action, focused/selected emphasis, key connection |
| Creative Energy | `#A78BFA` | secondary emphasis, AI/collaboration accent, gradient midpoint |
| Human Warmth | `#F8B4C4` | collaborative/presence warmth and selected soft surface |
| Open Possibility | `#FFD1A8` | planning/attention warmth, ambient highlight; not warning by default |
| Clear Thinking | `#F8F9FB` | light application/background neutral |

The identity board is not production artwork. Its raster rendition must not be cropped, traced, or shipped.

### 4.2 Unresolved brand decisions

The board contains both **“Many perspectives. One shared intelligence.”** and **“Intelligence through connection.”** This is an explicit inconsistency. Neither is selected or rewritten here. Approval must decide: canonical tagline, permitted contexts, punctuation/capitalization, localized treatment, and whether the app shell omits taglines.

Other required decisions are: legal/product/company name; lowercase wordmark versus sentence-case UI text; whether “Campaign Canvas” remains the feature name; migration period/co-branding; icon center treatment on dark surfaces; final color masters and gradient recipes; monochrome rules; typography family and licenses; motion rules; domain/canonical URL; and whether user-visible historical diagnostics/support exports retain “Funklix.”

## 5. Current design-system inventory

### 5.1 Foundations found

| Category | Current reality | Classification / concern |
|---|---|---|
| Color tokens | legacy `--bg`, `--panel`, `--text`, `--muted`, `--primary`, `--border`; broader `--fk-color-*` for app/page/nav/canvas/surface/elevation/text/border/action/status/roles/connections/comments/review/scrollbar | Useful semantic base, but alias overlap and hundreds of hard-coded hex/RGB values undermine it |
| Brand/action colors | current blues/purples such as `#5368ff`, `#7d5cff`, `#6950ef`; gradients vary by component | Close in hue, not a controlled Tendra palette |
| Status colors | success, warning, danger and information plus soft/subtle variants | Must remain semantically distinct from pink/peach brand accents and pass text/icon contrast |
| Typography | `Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif`; no font stylesheet/link in document head | Inter is requested but not bundled or externally loaded, so actual face depends on local availability; no network/license load cost today |
| Type scale | token sizes from xs upward, but many component-specific `px`/`rem` declarations; “medium” token maps to weight 700 and “bold” to 900 | naming/weight mismatch and inconsistent density |
| Spacing | `--fk-space-1/2/3/4/5/6/8` = 4/8/12/16/20/24/32px | coherent core, with hard-coded gaps/padding remaining |
| Radius | sm 8, md 10, lg 16, xl 22, pill 999px | coherent, but hard-coded component radii coexist |
| Border | semantic default/control/strong/divider and width tokens plus legacy border | consolidate through aliases; do not global-search replace |
| Shadows | sm/md/lg plus component-specific and glow shadows | dimensional basis exists; current variants are inconsistent |
| Controls | `.fk-btn` variants and shared field styling coexist with raw buttons/selects in generated views | styling unification safe only selector-by-selector; disabled/loading/focus parity incomplete |
| Cards/panels | tokenized base plus separate Canvas, dashboard, Content Workspace, Insights, simulator and Brand Core systems | similar concepts render with different borders, shadows and padding |
| Dialogs/menus | native settings/brand dialogs plus custom overlay dialogs, popovers and menus | focus/escape/return ownership differs; visual unification must not imply behavioral rewrite |
| Focus | token/focus shadow and several explicit `:focus-visible` rules | coverage is incomplete; some outline removal/specific selectors need browser audit |
| Hover/active/selected | numerous component selectors and role-specific node states | duplicated; mouse-only hover must not be the sole state signal |
| Disabled/loading | surface/text-disabled and skeleton tokens exist; component-specific disabled rules and text statuses vary | audit every control; do not reduce opacity below legibility |
| Feedback | success/warning/danger/info, live regions, toasts, inline errors and warning cards | semantic mapping exists but is inconsistent in icon/text/color redundancy |
| Z-index | tokens exist, but raw values range from 1 through 20,001 (`9999`, `10000`, `12000`, `13000`, `20000`, `20001`) | no dependable layer architecture; normalize only with overlay regression coverage |
| Breakpoints | many overlapping width queries (see §3.3) | source order is functional; do not consolidate in Phase 1 |
| Motion | fast/normal/slow tokens plus component transitions; multiple reduced-motion blocks and forced-colors handling | retain and centralize later; all new ambience must honor reduced motion |
| Themes | explicit light/dark semantic values and premium dark-mode checks exist | strong starting point, but later hard-coded light surfaces and local overrides can bypass tokens |

### 5.2 Proposed application token architecture (not implementation)

Use primitives only inside semantic tokens; components consume semantic tokens. During migration, new `--to-*` semantics should alias existing `--fk-*` variables, then components move incrementally—never rename all variables in one commit.

```text
primitive.brand.focus / creative / warmth / possibility / clear
primitive.neutral.0…1000
semantic.bg.app / bg.canvas / surface.panel / surface.card / surface.elevated
semantic.surface.hover / selected / disabled / ai / collaboration
semantic.text.primary / secondary / muted / inverse / link / disabled
semantic.border.subtle / default / strong / interactive
semantic.action.primary.{rest,hover,active,disabled}
semantic.focus.ring / selection.node / selection.text
semantic.status.{success,warning,error,info}.{fg,bg,border,icon}
semantic.connection.{default,hover,selected,muted}
semantic.role.{idea,variation,content,social,landing,email,visual}.{fg,bg,border}
semantic.presence.1…8
effect.gradient.brand / effect.gradient.ambient / effect.glow.focus
effect.shadow.{surface,elevated,dialog,node-selected}
component.* only where geometry cannot be semantic
```

Light theme: `Clear Thinking` can seed the app background, while cards remain visibly elevated whites/tints; Deep Focus owns action and focus; Creative Energy/Warmth/Possibility appear in selected, collaborative and ambient contexts. Dark theme: use violet-navy neutrals (not black), stepped luminance surfaces, softly tinted borders, and reduced-alpha brand gradients. Brand peach is not automatically “warning,” pink is not automatically “error,” and violet is not the only focus cue.

Connections should use a legible neutral-violet default, stronger Deep Focus selection, and distinct hover/focus thickness or dash in addition to color. Node-role colors remain category semantics but should be recalibrated into the Tendra family rather than collapsed into one gradient. Presence colors need pairwise distinguishability and initials/tooltips; never encode collaborator identity by color alone.

Atmospheric overlapping forms belong on authentication, empty/marketing states, and restrained shell ambience. They must not sit behind dense Canvas text, distort contrast, intercept input, or animate when reduced motion is requested.

## 6. Dark Mode findings

Dark Mode already has dedicated theme variables and several rounds of regression checks. It is not a blank-slate inversion. The future Tendra theme should preserve that contract and tune values by role:

- app/canvas: deep violet-navy rather than `#000`; canvas grid/edge visible but subordinate;
- panel/card/elevated: at least three distinguishable surface steps, lightly violet-tinted;
- primary text: softened near-white, secondary/muted text still meeting contrast for its size;
- violet/lavender: primary/focus/selected/AI emphasis with restrained glow;
- pink/peach: small collaboration, planning and ambient accents—not large low-contrast text;
- borders: subtle/default/strong levels visible in both modes;
- node selection: border + ring + optional glow, not glow alone;
- connection lines: theme-specific stroke and selected thickness;
- badges/status: semantic foreground/background/border triples, with label/icon;
- images/brand gradients: avoid forced inversion and protect adjacent text with solid/tinted surfaces.

Accessibility gates should target WCAG 2.2 AA: 4.5:1 normal text, 3:1 large text and meaningful UI graphics/control boundaries, clearly visible focus, and no information conveyed only by hue. Exact ratios must be measured from final composited colors—including alpha gradients—not inferred from hex values. Dark-mode browser screenshots must cover default, hover, focus, selected, disabled, loading, success, warning and error states.

## 7. Typography audit and recommendation

The document declares no external font resource. CSS requests Inter with system fallbacks, so users without locally installed Inter see the platform stack. This is performant and readable but does not guarantee the identity-board typography.

Recommended system:

- **Marketing display:** select an approved licensed brand display face only for public-site hero/headings; self-host a tightly subset WOFF2 if licensing permits, with fallback and metric overrides.
- **Application headings/body/labels/controls/nodes:** one highly legible UI sans. Inter may remain if it is deliberately self-hosted/licensed; otherwise use the existing native stack. Avoid a network dependency for core app boot.
- **Weights:** 400 body, 500 controls/metadata, 600–700 headings/emphasis; avoid routine 900 weight at small sizes.
- **Node titles:** 600–700 with a mode-dependent two-line cap; previews 400–500, never compressed below readable size.
- **Data/diagnostics/IDs:** system monospace only where character distinction matters; ordinary metrics remain tabular-numeral UI sans.
- **Localization:** verify German expansion, accented glyph coverage, line breaking and font fallback before adoption.

Approval must verify commercial/web/app embedding rights, self-host permission, file size/subsetting, privacy implications of any external font CDN, and layout shift. The reference image alone does not identify or license a typeface.

## 8. Product-name migration inventory

| Reference / examples | Actual location/use | Category | Recommendation |
|---|---|---|---|
| `<title>Campaign Canvas — Visual Planning`, sidebar/heading “Campaign Canvas,” empty/help strings | `index.html`, `language.js`, `app.js`, Content Workspace copy | safe user-facing rename **after terminology approval** | Rename product context to Tendra One while retaining “Campaign Canvas” as feature if approved; update EN/DE together |
| Visible “Funklix” failure/help/disclosure text | `app.js`, `content-workspace.js` | safe user-facing rename | Include all error/loading/recovery/AI/help states, not only shell |
| README/docs “Campaign Canvas”, “Funklix” | `README.md`, `docs/**`, script assertions | internal/historical documentation | Do not bulk-edit; update active docs later while preserving dated audits and test fixtures as history |
| Console prefixes/build labels (`[Funklix …]`, “Campaign Canvas build”) and request headers such as `x-funklix-request-id` | `app.js`, API diagnostics, checks | compatibility-sensitive/unclear | User-visible console naming can be separately reviewed; header names and support contracts remain unchanged until versioned migration evidence exists |
| Browser globals `FunklixLanguage`, `FunklixTheme`, `FunklixContentWorkspace`, simulator globals | JS modules and consumers | internal identifier that should remain | No cosmetic rename; changing breaks load order/global integration and checks |
| `campaignCanvasState`; `funklix.themePreference.v1`; activity/comment/brand preference prefixes | localStorage/theme modules | compatibility-sensitive | Keep keys. If a new UI-mode key is added, use a new versioned key; migrate old keys only with fallback/rollback plan |
| `funklix_session`, `funklix_oauth_state`, `funklix_oauth_return_to` | auth cookies | compatibility-sensitive / migration-required if renamed | Keep throughout app rebrand. Cookie rename requires dual-read/dual-clear, session continuity, OAuth and deployment migration |
| `https://funklix.local` / `.invalid` URL bases | safe relative-return parsing/API URL parsing | internal identifier that should remain | These are sentinel origins, not public branding; do not rename without security review |
| API route names and payload fields (`canvas_json`, `board_id`, approval fingerprints) | client/server contracts | internal/compatibility-sensitive | Keep stable; no cosmetic API migration |
| Database tables/columns (`boards`, `brands`, social tables, `canvas_json`) | API SQL/schema | internal identifier that should remain | Do not rename; brand has no bearing on stable persistence vocabulary |
| Environment variables (`POSTGRES_URL`, auth/session, Google, LinkedIn, OpenAI, Blob/Vercel, debug/model variables) | server/API modules | internal identifier that should remain | No brand rename; deployment secrets/contracts are operational interfaces |
| Default Board names “Campaign Canvas …/Copy” | `app.js` | unclear | Decide whether feature-name continuity makes these correct; migration of existing user-authored names is **not** implied |
| `#funklix` sample hashtag and provider user-agent | campaign fixture/social adapter | compatibility-sensitive/unclear | Do not silently alter fixture/canonical content or provider diagnostics; separate product decision and tests |
| Favicon/logo/app icon/manifest/social metadata | no favicon/manifest/apple icon/OG/Twitter metadata or app logo links found in current head; logo imagery in Brand Core is customer data | migration-required asset surface | Add only approved production package; never confuse customer Brand Core logos with Tendra product logo |
| Public URLs/canonical metadata | no canonical/OG/Twitter app metadata found; Vercel routes APIs and SPA root | unclear/migration-required | decide architecture first; inventory deployed URLs and OAuth registrations outside repository |
| Email templates | no product email template surface found | unclear | confirm external auth/provider transactional templates before Phase 1 release |

Authentication UI is embedded in the top bar rather than a distinct branded login page. Loading/empty/error text is distributed across `index.html`, `app.js`, `content-workspace.js`, and localized strings. Search must include generated strings and both languages during implementation.

## 9. Canvas density inventory

Real canonical roles include Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign, Visual Concept and Image Brief; Post-its use separate behavior. Content Workspace calculates readiness from role-specific fields, and approval/publishing uses material fingerprints.

| Node element / real field or projection | Classification | Compact | Standard | Detailed / Inspector boundary |
|---|---|---|---|---|
| Role/type (`type`) and role accent | essential visual scanning | label/accent | label/accent | label/accent; editable in Inspector |
| Status (`status`) | essential visual scanning | concise badge | badge | badge plus transition controls only in Inspector/workflow UI |
| Readiness (derived issues/capabilities) | conditional alert | only actionable blocker/warning icon + name | concise level when relevant | issue summary on card; complete reasons/actions in Inspector/Workspace |
| Title (`title`) | essential | 1–2 lines | 2 lines | up to 3 lines; full edit Inspector |
| Generic content (`content`) | useful context | omit, or one line only when no more critical row | 2–3 line preview | bounded preview; full editable body Inspector |
| Platform (`social.platform` or `channel`) | useful context / critical for social | one metadata item for Social role | show for Social | show; full publishing fields Inspector |
| Owner (`owner`) | useful collaboration context | avatar/initial only if actionable/multiple collaborators | compact avatar/name | owner and history; edit Inspector |
| Dates/planning (`planningSchedule`, local date/time/zone) | useful / conditional alert | next date only when scheduled/overdue/invalid | concise schedule row | bounded plan state; full controls/disclosure Inspector/Workspace |
| Content format (`contentFormat`) | useful context | omit except critical role discriminator | short chip where relevant | show; edit Inspector |
| Images/uploads/generated visuals | useful/context-heavy | thumbnail only when essential to identify visual node; otherwise omit | one bounded thumbnail | one bounded preview/count; full gallery/handling Inspector |
| Review state, approval fingerprint/staleness | status + conditional alert | status; stale/action-required alert only | status plus concise review marker | review summary; canonical transition/approval UI remains owned by Inspector/Workspace |
| AI Review (summary, strengths, improvements, rewrite) | inspector-only except state | small “AI Review available/action needed” indicator | score/state only if present | bounded summary at most; complete review Inspector |
| Comments | useful collaboration | unread/action-required count only | count + recent participant stack | count/recent state; full thread in authoritative collaboration surface |
| Reactions | decorative/useful context | omit | aggregate count only if currently supported | bounded aggregate; full interaction where currently owned |
| Attachments | useful/inspector-only | action-required icon/count only | count | count/preview; complete handling Inspector |
| Connection controls/handles | interaction control | essential handles, discoverable target | same | same; never remove for aesthetics |
| Badges | often redundant | role/status plus alert only | deduplicated limited set | grouped, bounded set |
| Node action buttons and overflow menu | interaction control | overflow + essential connection only | same, optional primary contextual action | bounded actions; destructive/edit controls remain accessible |
| Metadata (audience, goal, channel, funnel stage, tone, variants) | useful or inspector-only | at most one critical row selected by role | max 2–3 concise chips/row | structured summary; complete editing Inspector |
| Warnings/errors | conditional alert | always show if action required, text available on focus/activation | concise message/icon | concise message plus route to full resolution |
| Publishing state | conditional/status | only delivered/blocked/stale where relevant | concise state | details/link in Content Workspace/Inspector; no provider invention |
| Planning state | useful/conditional | scheduled/invalid only | schedule summary | complete planning in current owner surfaces |
| Decorative image/gradient/role ornament | decorative | omit | restrained | restrained; cannot displace information |

### 9.1 Exact predetermined modes

**Compact (structure):** minimum 44px interactive target envelope and smallest stable content height; role label/accent, status, concise title, connection handles, overflow/menu access, selection/focus treatment. One short row only, chosen deterministically: actionable warning > scheduled date > social platform > one-line content preview. Unread comment count or owner avatar may share this row only if space and accessible names remain adequate. No image, AI Review body, reaction detail, attachment list, approval detail, full metadata, or expanded content.

**Standard (default work):** role, status, title, 2–3-line preview; up to one bounded image thumbnail for visual/social/landing content; one metadata row selected by role (platform/format/channel/funnel stage); readiness only when not Ready; limited owner/unread-comments indicators; schedule state when present; connection handles and overflow. AI Review may show existence/score state, never full strengths/improvements/rewrite. This is the recommended default.

**Detailed (review projection):** everything in Standard; a bounded content excerpt; one bounded image preview/count; role-relevant metadata (maximum two structured rows); readiness/review/approval-staleness summary; AI Review summary/score; limited comments/participants/reaction/attachment counts; planning/publishing summary. It remains capped—no textarea, complete thread, complete AI analysis, all images, transition form, scheduling form, or Inspector-equivalent action stack on the node.

Each role uses existing data only: Landing Page can summarize claim/CTA and image; Social can summarize platform/caption/visual; Email can summarize subject/preview/body; Content/Idea/Variation can summarize content plus audience/goal/channel/stage/tone where present; Visual Concept/Image Brief can prioritize visual/prompt/format. Unsupported/missing fields are omitted, not fabricated.

### 9.2 Presentation safety and persistence

Create a pure projection `node + mode + permissions + transient UI state -> view`, with no mutation. Mode must never enter Board serialization, API payloads, approval material/fingerprint, planning schedule, autosave dirty comparison, undo history, or collaboration events. Node IDs, authored `x/y`, edges and canonical dimensions remain unchanged. Prefer CSS clamping and derived runtime measurement; if geometry changes, recalculate rendered connection endpoints after layout without saving dimensions.

**Recommended persistence:** per user, per browser, global across Boards in a new versioned localStorage UI key (illustratively `tendraOne.canvasPresentation.v1`; final namespace requires approval). Store only `compact|standard|detailed`; validate and fall back to Standard. Do not reuse `campaignCanvasState`, do not store per Board, do not sync through Board APIs, and do not trigger autosave. Session-only is safer but frustrating; Board-level persistence incorrectly turns a personal density preference into shared canonical content. A future account preference may supersede local storage through an explicit, separately tested migration.

Effects and boundaries:

- **Canvas:** only node projection changes; Post-its excluded initially.
- **Content Workspace cards:** initially unaffected because they already serve a distinct review/library task; later may consume shared density tokens, not the Canvas preference, unless research proves value.
- **Inspector:** unaffected and always complete; selection opens the same canonical node.
- **Zoom/minimap:** no semantic zoom or automatic mode switching in v1; mode independent of zoom. Recalculate geometry after mode changes.
- **Saved positions/dimensions:** positions unchanged; no derived height persisted. If current data contains authored size, preserve it and document precedence before implementation.
- **Connections:** handles remain, hit targets remain, endpoints recomputed after layout and during zoom/move.
- **Mobile:** default Standard may be too dense; do not silently change stored preference. Render responsive clamps and use full-height/bottom-sheet Inspector behavior already compatible with focus and close semantics.
- **Focus/keyboard:** selected/focused node remains focused across rerender; mode control is keyboard-operable and announced; handles/actions are not removed from tab order without replacement.
- **Print/export:** no print/export implementation was found in inspected UI; treat as unclear and confirm before relying on it. If later present, define a separate deterministic export projection rather than reading user preference.

## 10. Inspector findings

### 10.1 Existing authoritative fields and actions

The Inspector currently exposes type, status, title, owner, generic content, image prompt/uploads/list, content format, audience, goal, channel, funnel stage, tone, variants; social platform/caption/hashtags; Landing Page visual prompt/header claim/problem/solution/trust/CTA; generated image/posting visual; improve/next-step/review/regenerate actions; add-to-posting-calendar metadata; full-pack generation; disconnect/propagate/delete actions; connected context; and a node preview. Fields are conditionally displayed by role and access.

Content Workspace separately owns readiness calculation and review/approval dialogs, calendar planning and current LinkedIn-oriented publishing projection. Comments/collaboration and AI Review also have node/render paths outside the base form. This means “Inspector authoritative” should mean the complete detail/edit doorway, not immediate relocation of every workflow into one monolith.

### 10.2 Gaps and duplication

- Node cards can display content, role/status, ownership/collaboration, review/AI state, media, planning and metadata that duplicate Inspector/Workspace projections.
- Readiness reasons and approval-stale state are workflow-derived and should be visible from Inspector, but their canonical calculation/transition owners must not be duplicated.
- Comments/reactions/attachments and AI Review need clear sections/links in the Inspector if nodes become sparse; inventory exact current interaction controls in a live browser before moving any markup.
- Publishing details remain in Content Workspace/social foundations; the Inspector may summarize and route, not create a second publish mutation path.
- Direct field edits already trigger state/save behavior through `app.js`. New section components must reuse those handlers rather than writing directly to node objects.

### 10.3 Recommended information hierarchy

1. **Header:** role, title, status/readiness, owner, close; selection identity and unsaved/read-only state.
2. **Content:** generic content; role-specific Landing Page, Social, Email, Visual fields; images and prompts; preview.
3. **Publishing:** platform/caption/hashtags/content format and current destination/state summaries only where supported; link to owned workflow.
4. **Review:** readiness issues, review state, approval/staleness, existing transition actions, AI Review results/actions.
5. **Planning:** schedule summary and existing calendar action; audience, goal, channel, funnel stage, tone, variants where justified.
6. **Ownership & collaboration:** owner, comments, participant/unread state, reactions/attachments only if currently supported.
7. **Connections:** connected context, disconnect and propagation controls.
8. **Advanced metadata / destructive actions:** stable identifiers/read-only diagnostic data if already exposed, then delete. Do not invent fields.

Sections can use accessible headings/disclosures, but collapsing a section must not suppress errors or remove controls from assistive technology incorrectly. Mutation, autosave, permission, status-transition and approval owners stay unchanged.

## 11. Unified interface area audit

| Area | Current pattern / inconsistencies | Dependencies / structural risk | Safe opportunity | Change category | Phase |
|---|---|---|---|---|---|
| Campaign Canvas | bespoke node cards, SVG edges, floating controls, toolbar, context menus | highest: geometry, selection, zoom, drag, edges, autosave | tokens, states, then bounded mode projections | cosmetic then interaction simplification | 4 |
| Content Workspace | independent `.cw-*` cards, filters, tabs, dialogs, calendar | renderer replaces host HTML; approval generations/focus trap | tokens and shared controls; preserve renderer ownership | cosmetic | 5, bounded |
| Boards | library/list/card controls differ from Canvas cards | Board load/create/access and navigation | shared card/button/status styling | cosmetic | 5, bounded |
| Brand Core | canvas/editor cards, nested dynamic dialogs/recovery | canonical snapshot, restore/refresh/isolation, async generation | surfaces/typography only first | cosmetic; structural cleanup later | 5, bounded |
| AI Brain | conversation/advisor/proposals use unique states | async request/proposal and Canvas handoff | branded AI surface/avatar/state styling | cosmetic | 5, bounded |
| Insights | read-only cards/disclosures with Canvas focus handoff | snapshot validity/navigation | shared data cards/status hierarchy | cosmetic | 5, bounded |
| Settings | native dialog, cards and social controls | theme/language/auth/social async state | shared form/dialog/status styling | cosmetic | 2 then 5 |
| Authentication | toolbar sign-in/user state, not a dedicated screen | Google redirects/cookies/return path | icon/logo/copy styling in place | cosmetic; public auth routing later | 1/6 |
| Dialogs | native and custom backdrops, varying actions/focus | each owner implements lifecycle | visual primitives first; behavior stays local | cosmetic | 2 |
| Menus/popovers | multiple positioning and hidden patterns | click-outside, anchor, z-index | shared colors/radius/focus only | cosmetic | 2 |
| Notifications/errors | live regions, toasts, inline statuses vary | async feedback and a11y announcements | semantic status palette/icons/text | cosmetic | 2 |
| Empty/loading states | distributed static/dynamic localized content | Board/access/request lifecycle | shared illustration surface and skeleton/status tokens | cosmetic | 2/area phase |
| Shell/mobile | grid sidebar + Inspector column/overlay and many breakpoints | cached IDs and responsive hidden rules | restyle existing DOM, defer nav hierarchy | cosmetic first; nav restructuring separate | 3 |

Navigation restructuring, shell restyling, interaction simplification and functional change must be separate commits/flags. In particular, the reference’s sidebar grouping/favorites must not be bundled into a color update.

## 12. Exploratory reference-screen gap analysis

| Reference element | Real equivalent | Exists today | Visually reusable | Functionally compatible | Invented/unsupported | Safe adaptation | Risk |
|---|---|---:|---:|---:|---:|---|---|
| Tendra logo/wordmark | no product logo asset surface found | no | yes, with production assets | yes | screenshot asset itself unsupported | place approved asset in existing shell without replacing controls | low after approval |
| Workspace/brand switcher | brand switcher + Board-brand association | yes | yes | partly | concept naming/layout differs | restyle current disclosure/menu and preserve IDs | medium |
| Home, Boards, Campaign Canvas, Content Workspace, Brand Core, AI Brain, Insights | current primary nav | yes | yes | yes | concept may omit simulator/settings nuances | use visual treatment, retain all real destinations | medium |
| Favorites section/items | no equivalent found | no | visually only | no | **yes** | do not implement; requires product/data specification | high |
| “Compare Brand Cores” / “Change Board Brand” | existing comparison/association controls | yes | yes | yes | no | style current controls; keep recovery/isolation paths | medium |
| Marketing headline/tagline above Canvas | current toolbar/area, no equivalent hero | no | visual inspiration | not proven | **yes as app function/layout** | do not add to working Canvas; consider public landing page | medium |
| Search | node search input/count | yes | yes | yes | no | restyle existing control | low |
| Theme icon/menu | quick theme control + Settings preference | yes | yes | yes | no | retain accessible label/menu/state | low |
| Notifications | activity toggle/feed | yes | yes | partly | bell semantics may differ | restyle current activity control, do not invent notification service | medium |
| Account block | auth user/avatar/name/email/sign-out | yes | yes | yes | reference actions unknown | restyle only | low |
| Create campaign/Add node/Filters/Utilities | current buttons/popovers | yes | yes | yes | concept contents may differ | preserve action and popover owners | medium |
| “Your Board”/presence/copy link/overflow | access chip, presence, share/copy controls | yes | yes | partly | exact badge/menu contents differ | retain real access semantics and actions | medium |
| Simplified role/status/title cards | current Canvas nodes | yes | yes | yes via mode projection | no | implement Compact/Standard after pure projection tests | high |
| Rich AI Review accordions/score on cards | AI Review exists, exact concept composition differs | partly | partly | only bounded summary | some shown metrics/details may be invented | keep full detail Inspector; show existing score/state only | high |
| Reactions/attachment/comment counts | collaboration/comments exist; exact reactions/attachments require runtime confirmation | partly/unclear | partly | unclear | concept numbers/content unsupported | inventory live renderer; no fabricated values/actions | high |
| Sticky notes and handwritten annotations | Post-its exist; freehand annotation not evidenced | partly | Post-it styling yes | annotations no | handwritten arrows/text **unsupported** | retain Post-its; do not create annotation tool | high |
| Minimap | no explicit supported minimap found in inspected static contract; concept shows overview | unclear/no | yes | unproven | likely unsupported | do not implement until renderer evidence/product spec | high |
| Inspector tabs Content/Settings/Connections | current Inspector fields/connected context, not same tab architecture | partly | yes | regrouping possible, tab behavior not existing | exact tabs unsupported | first use headings/disclosures; tabs require separate a11y/behavior work | high |
| “Save Changes”/Cancel footer | current direct field mutation/autosave model | no equivalent transaction | visually reusable only | **no** | explicit commit transaction is unsupported | do not add; would alter autosave and mutation semantics | critical |
| Card metrics, favorite stars, campaign health annotations | scattered real diagnostics; concept specifics not canonical | unclear | visual only | no | **yes** | do not implement without named source/formula | high |
| Concept removal/omission of existing controls | all preservation-boundary functions | n/a | no | no | unsupported removal | keep every real feature accessible | critical |

Conclusion: adapt palette, typography hierarchy, whitespace, bounded cards, surface depth and connection emphasis. Do **not** copy its information architecture or apparent capabilities.

## 13. Accessibility findings and gates

- Measure composited light/dark contrast for every semantic token and role badge; gradients require worst-point testing.
- Preserve/native-enable `:focus-visible` on nodes, handles, toolbar, menus, cards, fields and theme controls. Selected and focused must remain distinguishable.
- Keep keyboard reachability for node selection/editing, mode selection, connection affordances, menus, dialogs and close/escape actions; restore focus after dynamic rerenders.
- Dynamic custom dialogs already implement some trapping; native and custom dialogs need a shared test matrix for initial focus, Tab loop, Escape, background inertness and return focus—not an early rewrite.
- Announce status/readiness/save/loading/error/success with meaningful text and appropriate live-region urgency. Do not use color, glow, score, avatar, or position alone.
- Compact mode must preserve at least 44×44 CSS-pixel practical targets (or sufficient target spacing under the applicable WCAG criterion) for essential controls; tiny connection dots need an enlarged invisible hit area and accessible names.
- Node selection must expose `aria-selected`/equivalent state in its composite context, a stable accessible name (role, title, status), and clear multi-select behavior.
- Theme controls must report current preference and resolved theme; icon-only moon/sun controls need names independent of visual glyph.
- Respect `prefers-reduced-motion`; disable ambient drift, large zoom transitions and nonessential glow animation. Preserve functional progress indicators in a nonanimated form.
- Zoom must not be the only way to read content; browser text zoom/reflow and Canvas zoom must be independently testable. Never scale focus rings/hit targets into unusability.
- Mobile Inspector must have a visible title/close, contained focus, non-obscured fields/actions, safe-area spacing and return focus to the selected node.
- Screen reader testing must include generated Content Workspace cards, error/empty states, readiness and status changes, menus/popovers, connection actions and owner/presence labels.
- Validate forced-colors mode and image/high-contrast fallbacks; brand gradients cannot be required to perceive structure.

## 14. Landing-page routing analysis for `tendra-one.app`

Repository evidence: a Vercel deployment serves the SPA/root and `/api` functions; Google callback URIs are derived from the request origin and fixed callback path; safe return paths are relative; session/OAuth cookies use `Path=/`, `SameSite=Lax`, and production `Secure`; LinkedIn uses an explicit `LINKEDIN_REDIRECT_URI`; social OAuth currently constrains return to `/`; no canonical/OG/Twitter/PWA metadata is present in the app head.

| Option | Benefits | Repository implications / risks | Decision status |
|---|---|---|---|
| Public root, app under `/app` | one origin/cookie/CORS simplicity; clear public canonical | SPA routing/base-path work; current relative/root navigation and social return-path `/` assumptions; Google return handling; Vercel rewrites; all existing root links | feasible but high migration evidence required; not selected |
| `app.tendra-one.app` + public apex | clean separation and independent deploy cadence | OAuth origins/redirect registrations, cookie host-only behavior, CSP/connect-src, CORS, login handoff, canonical URLs, public/app link migration | strong conceptual separation; not selected |
| Separate public deployment | isolates marketing risk and assets | same cross-origin auth/CORS/CSP concerns if different origin; operational ownership and preview environments | plausible; repository alone cannot choose |
| Existing root with public/authenticated conditional routing | preserves one URL and login entry | boot/auth loading flash, crawlers/SEO, current app-at-root assumptions, logout destination, deep links, public cache/privacy boundaries | highest coupling to stateful app; not selected |

Before selection, document current production/preview origins and links, Google authorized origins/callbacks, LinkedIn registered redirect URI, cookie/domain strategy, desired deep links/logout, CORS policy, CSP directives, Vercel rewrite/redirect behavior, public caching, analytics/consent, and legal ownership. LinkedIn redirect changes are configuration-sensitive; provider publishing remains paused.

The later public page scope is: Tendra One introduction; approved value proposition; Campaign Canvas explanation; collaboration and AI Brain positioning; authentic product preview; trust/security and privacy/legal links; and login into the authenticated app. Add canonical URL, description, OG/Twitter metadata and approved social image. Do not expose Board/app data during public rendering.

## 15. Production asset requirements

Current product consumption points are essentially absent: no favicon link, Apple touch icon, web manifest/PWA icons, canonical/social image, or dedicated Tendra/Funklix product logo was found in the document head. Existing Brand Core logo upload/display is **customer-brand content**, not an application-brand slot, and must remain separate.

The production package must later include:

1. primary horizontal wordmark SVG with outlined/approved font handling and viewBox;
2. stacked SVG only if approved responsive/marketing placements justify it;
3. icon-only SVG with safe-area/minimum-size rules;
4. true monochrome SVG (not grayscale filter);
5. light-surface and dark-surface variants with documented center/contrast treatment;
6. transparent PNG fallbacks at approved 1×/2× presentation sizes;
7. multi-size favicon (`.ico` and/or SVG plus 16/32 PNG where required);
8. 180×180 Apple touch icon with intentional opaque background;
9. PWA icons only if/when a manifest is intentionally added: 192×192 and 512×512, plus maskable variants with safe zone;
10. social preview image, normally 1200×630, with approved tagline/copy and safe crop;
11. source masters, color profiles, optimization rules, accessible text alternative guidance, minimum clear space and minimum size;
12. license/ownership record and named approval owner.

SVGs must be sanitized, optimized without destructive rasterization, and tested under CSP. The supplied identity board is only a visual reference and must never be used as a production extraction source.

## 16. Staged implementation roadmap

### Phase 1 — Brand foundation (risk: **medium**, conditional GO)

- **Scope:** approved production assets; approved user-facing naming matrix; favicon/head/social metadata; semantic Tendra token aliases and theme values; no layout change.
- **Likely files:** `index.html`, `styles.css`, `language.js`, narrowly scoped visible strings in `app.js`/`content-workspace.js`, new approved asset files; possibly metadata/manifest only if explicitly approved.
- **Dependencies:** decisions in §§4/18, asset/license delivery, URL/canonical decision for metadata, complete visible-string inventory.
- **Excluded:** DOM restructuring, internal globals/storage/cookies/API/DB/env renames, Canvas modes, landing routing, LinkedIn provider work.
- **Rollback:** one brand-foundation commit or small ordered commits; tokens alias existing variables so reverting restores current skin.
- **Regression:** boot, auth/session, all navigation, Board load/save/autosave/restore, language, both themes, all statuses, asset 404/CSP, no canonical data diff.
- **Manual:** logo sizes/backgrounds, translated names, favicon/browser tabs, light/dark/forced colors, loading/errors/mobile.

### Phase 2 — Shared component styling (risk: **medium**)

- **Scope:** typography scale, buttons, form controls, badges, cards, menus, dialogs, focus/hover/disabled/loading/success/warning/error, theme parity.
- **Likely files:** `styles.css`; minimal class additions in `index.html` or renderer strings only when a selector cannot safely target current markup.
- **Dependencies:** Phase 1 tokens; state catalog and visual baselines.
- **Excluded:** listener centralization, dialog implementation replacement, navigation/layout, data/workflow change.
- **Rollback:** component family by component family, without deleting legacy rules until verified.
- **Regression:** keyboard/focus/dialog/menu tests plus all theme checks and representative generated runtime states.
- **Manual:** mouse/keyboard/touch, async disabled/loading, long German copy, browser zoom, high contrast.

### Phase 3 — Application shell (risk: **medium-high**)

- **Scope:** restyle existing navigation, toolbar, sidebar, account/access/presence areas and responsive shell; preserve IDs, element types and owners.
- **Likely files:** shell sections of `styles.css`; narrowly `index.html` only for nonfunctional wrappers/classes if proven necessary.
- **Dependencies:** Phases 1–2; DOM contract test; breakpoint screenshots.
- **Excluded:** new router, renamed IDs, removed destinations, invented favorites, changed auth/share semantics, Canvas internals.
- **Rollback:** shell-only commit behind unchanged markup.
- **Regression:** every nav destination, programmatic AI/Insights Canvas handoff, sidebar collapse, toolbar/popovers, auth/access/presence, Inspector column, all widths.
- **Manual:** desktop/tablet/mobile, keyboard order, scroll containment, read-only/public/owner states.

### Phase 4 — Canvas presentation modes (risk: **high**)

- **Scope:** pure Compact/Standard/Detailed node projections, UI selector, local UI preference, bounded node content, complete Inspector, derived endpoint recalculation.
- **Likely files:** `app.js`, `styles.css`, `index.html` for a mode control; a new focused pure module/check may be justified in the implementation ticket.
- **Dependencies:** canonical field matrix, geometry baseline, preference namespace approval, browser interaction harness.
- **Excluded:** canonical schema/serialization/dimensions, semantic zoom, Post-it redesign, Content Workspace density coupling, Inspector mutation rewrite.
- **Rollback:** remove selector/projection and fall back to unchanged Standard renderer; preference is ignorable.
- **Regression:** serialized before/after equality; dirty/autosave silence on mode change; node IDs/positions/edges; creation/edit/move/connect/expand/collapse/zoom/search/filter/utilities; selection/focus/mobile; approval fingerprint/readiness/planning equality.
- **Manual:** dense real Boards in all modes/themes/zooms, connection endpoints, long/localized content, images/comments/AI states, reload/Board switch.

### Phase 5 — Area-by-area cleanup (risk: **medium per area; high if bundled**)

- **Scope:** one ticket/rollback per Content Workspace, Boards, Brand Core, AI Brain, Insights and Settings, applying shared tokens/components and explicit local usability fixes.
- **Likely files:** `styles.css`, then the single owning renderer (`content-workspace.js`, `app.js`, or static host markup) and its existing focused checks.
- **Dependencies:** Phases 1–3; per-area inventory and screenshots.
- **Excluded:** cross-area renderer rewrite, new capabilities, simultaneous workflow/navigation changes.
- **Rollback:** one bounded area commit/deployment at a time.
- **Regression:** owner area’s complete lifecycle plus Board/access/theme/language/mobile smoke tests.
- **Manual:** empty/loading/error/read-only/permission/stale/conflict states, not only happy path.

### Phase 6 — Public Tendra One site (risk: **high until architecture selected**)

- **Scope:** separate public experience, approved copy/preview, trust/legal, metadata and login handoff under chosen route/deployment architecture.
- **Likely files:** indeterminate until architecture decision; could be a separate project/deployment. Existing `vercel.json`, auth callbacks and app entry may be affected.
- **Dependencies:** routing decision, domains/DNS, OAuth registrations, cookies/CORS/CSP, canonical/social/legal approval.
- **Excluded:** app shell redesign, auth protocol invention, Board data exposure, LinkedIn publishing.
- **Rollback:** deployment/route boundary that restores current app root and callbacks.
- **Regression:** public SEO/metadata/CSP, login/logout/return, sessions, deep links, Google callback, LinkedIn connection callback, preview/prod origins.
- **Manual:** logged-in/out, expired session, mobile, no-script/basic failure, legal links and social unfurl.

### Phase 7 — Company LinkedIn integration (risk: **critical; NO-GO / paused**)

- **Scope when prerequisites exist:** Company Page destinations, organization permissions, image publishing and explicit personal-publishing policy.
- **Likely files:** social connector services/adapters/routes/schema/settings/Content Workspace and dedicated checks; exact list requires a new audit.
- **Dependencies:** Community Management API approval/prerequisites, provider policy, organization scopes/test account, security/privacy review.
- **Excluded now:** all provider publishing changes in BW-33.1 and Phases 1–6.
- **Rollback:** provider capability flag/adapter/schema migration boundary; never couple to visual rollout.
- **Regression/manual:** provider contract, permissions, tokens, idempotency, ambiguous outcomes, stale approval, destination policy, images, recovery. Defined later.

## 17. Regression strategy for future implementation

### 17.1 Required automated and browser coverage

1. **Boot/integrity:** parse all browser scripts; no missing/duplicate critical DOM IDs; no console exceptions; theme bootstrap precedes paint/app.
2. **Authentication/session:** signed out/in/out, callback return, expired/error state, session continuity across rebrand.
3. **Boards/access:** load, create, owner/editor/viewer/public projection, claim/duplicate/share, save, conflict, autosave, last-saved, dirty guard, restore/recovery.
4. **Canvas:** render representative all-role Board; create/edit/delete; drag/move; connect/disconnect/propagate; expand/collapse; zoom/scroll/reveal; search/filter/utilities; undo/reset; Post-its.
5. **Presentation invariant:** switching/reloading every mode yields byte-equivalent canonical serialization, fingerprints, readiness, planning and edges; no save request or dirty transition caused by preference.
6. **Inspector:** selection/focus, every role-specific field, conditional sections, images, AI actions, status/read-only enforcement, autosave triggers and destructive confirmation.
7. **Content Workspace:** library/filter/search/readiness, review and approval transitions/stale recovery, comments/collaboration projection, calendar planning/rescheduling, focus handoff, publishing projection without live provider calls.
8. **Brand Core/AI Brain/Insights/Settings:** generation/recovery/restore boundaries, conversation proposal handoff, snapshot diagnostics/focus, social connection projection, language/theme controls.
9. **Localization/themes:** English/German (and every supported locale), system/light/dark preference/reload, all semantic states and long strings.
10. **Responsive/a11y:** representative desktop, 1024-ish, tablet, 768/720/640/560 and narrow mobile widths; keyboard-only, screen reader smoke, browser zoom, reduced motion and forced colors.
11. **Social preservation:** settings/read connection state, OAuth result projection, approval fingerprint and publishing eligibility foundations; no Company integration or live publish required.

### 17.2 Visual regression

Static component snapshots are insufficient. Capture the **real `index.html`, complete `styles.css` cascade, actual browser runtime and representative stateful Boards**. Baselines need both themes and viewport matrix for shell, each node role/mode/state, edges at multiple zooms, Inspector, Content Workspace, Boards, Brand Core, AI Brain, Insights, Settings, auth, dialogs/menus/toasts and loading/empty/error/read-only states. Include focus/hover/disabled screenshots where tooling supports deterministic input.

Pixel diffs must be paired with structural assertions because a visually similar screenshot can hide detached listeners, wrong focus, dirty state or changed serialization. Use deterministic fixtures and mask only truly nondeterministic timestamps/avatars.

## 18. Explicit preservation boundaries

All future work remains no-op with respect to authentication/sessions; Board ownership/access/load/save/autosave/conflict/restore; canonical `canvas_json`; IDs/positions/edges; node creation/edit/movement/connections/expand/collapse/zoom/navigation/search/filters/utilities; Inspector data and mutation owners; Content Workspace; review/approval/fingerprints/readiness; comments/collaboration/Post-its/AI Review; Brand Core/AI Brain/Insights; social connection projection and LinkedIn foundations; language; themes; responsive/mobile; diagnostics and recovery.

Specifically prohibited by this audit: cosmetic renaming of stable globals, storage/cookie/API/DB/env identifiers; changing existing Board names/content/hashtags; deriving production assets from the supplied raster; implementing concept-only favorites, annotations, metrics, minimap, tabs or transactional Save Changes; deleting or hiding current capability; storing view mode in Board data; altering approval/publishing material; and resuming LinkedIn provider publishing.

## 19. Open decisions requiring user approval

1. Canonical tagline: one of the two supplied versions, context-specific use, or no in-app tagline.
2. Exact legal/company/product naming and lowercase wordmark versus UI casing.
3. Whether “Campaign Canvas” remains the named central feature and how “Funklix” history/support copy is handled.
4. Approved logo masters, variants, icon-center treatment, clear space/minimum size and animation prohibition/permission.
5. Final accessible light/dark color recipes, gradients, node-role mapping and status separation.
6. Product and marketing fonts, weights, licenses, hosting and localization coverage.
7. Public/app domain architecture, canonical URL, authenticated deep-link/logout behavior and migration of existing links.
8. Whether a manifest/PWA identity is actually desired.
9. Final Canvas mode labels, Standard default, mode-control placement and new preference-key namespace.
10. Whether Detailed mode includes existing AI Review score, comment/reaction/attachment counts, and which are confirmed supported in the live product.
11. Whether any existing authored node dimensions are canonical and how they take precedence over derived mode height.
12. Owner for privacy/legal/trust claims and social-preview copy/assets.
13. Explicit continuation of Company LinkedIn pause until Community Management API prerequisites and policy are approved.

## 20. Recommended first implementation

Create a tightly bounded **Phase 1 brand-foundation ticket** after decisions 1–6 are approved. First deliver production asset masters and a naming matrix; then add semantic token aliases and theme contrast fixtures; then replace only approved visible name/metadata/asset consumption points. Preserve the existing DOM, storage, globals, cookies, routes, schemas and workflows. Ship no Canvas layout or node-density change in that phase.

### Go/no-go decision

**Conditional GO for Phase 1 foundation work; NO-GO for visible production rollout until the listed branding, asset, typography and URL decisions are signed off.** The exploratory redesign is safely adaptable as a visual language and density target, not as drop-in markup or a feature specification.

---

**Audit conclusion:** stability depends on preserving DOM/event ownership and canonical Board semantics. A reversible token-and-projection approach can produce Tendra One’s coherent, dimensional Light and Dark experiences while retaining all working capability.
