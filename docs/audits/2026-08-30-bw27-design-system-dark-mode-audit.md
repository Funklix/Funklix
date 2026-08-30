# BW-27 design-system cleanup and Dark Mode audit

**Audit date:** 2026-08-30  
**Repository baseline:** current worktree containing BW-26 through BW-26.6.2  
**Scope:** documentation and implementation planning only; no production behavior, styling, state, persistence, Canvas, AI, authentication, or DOM-ID changes

## Evidence vocabulary

- **Confirmed** means the repository directly demonstrates the behavior or structure at the cited file, selector, function, state field, constant, or test.
- **Inferred** means the conclusion follows from the static code but needs runtime/visual confirmation.
- **Recommendation** defines the future BW-27 implementation package; it is not current behavior.
- **Unresolved decision** means product or infrastructure confirmation is still required before implementation.

Line regions are approximate and refer to this audit's baseline. Because `app.js` and `styles.css` are large and actively maintained, selectors and function/constant names are the durable evidence anchors.

## 1. Executive summary

**Confirmed.** Funklix is a single-page, browser-rendered application whose visual layer is concentrated in `styles.css` (about 7,022 lines), supplemented by a large `<style>` block at the start of `index.html` (approximately lines 8-104), generated markup and 110 JavaScript `.style.*` writes in `app.js`, and native/browser controls. There are no other application CSS files. `index.html` loads `/styles.css` before its inline block, then loads `language.js` and the application scripts at the end of `<body>` (`index.html`, head and approximately lines 812-819).

**Confirmed.** A partial foundation exists at `styles.css:1-257`: legacy aliases (`--bg`, `--panel`, `--text`, `--muted`, `--primary`, `--border`) coexist with `--fk-*` colors, spacing, radii, shadows, typography, buttons, cards, fields, pills, and sections. It is not theme-complete: several names are raw aliases rather than semantic roles; `--fk-color-background` is consumed later without being declared in the opening inventory; and hundreds of hard-coded colors, shadows, borders, radii, and one-off component rules bypass it (`styles.css`, especially late feature blocks; `index.html` inline styles; `app.js` rendering functions).

**Confirmed.** No Light/Dark/System preference, root theme attribute, `prefers-color-scheme` listener, or Dark theme override exists. The only media preference currently handled is reduced motion (`styles.css`, `@media (prefers-reduced-motion: reduce)` near lines 2050 and 3834). Language preferences are local, global browser preferences in `language.js` (`STORAGE_KEY`, `restorePreferences`, `setUiLanguage`, and `setCampaignLanguage`, lines 8-12 and 124-156), while Board Canvas data uses the separate `campaignCanvasState` key (`app.js:27`). There is no confirmed account-preferences API.

**Recommendation.** Deliver BW-27 as one combined implementation PR: introduce semantic tokens and lossless Light aliases first; add a `light | dark | system` preference distinct from resolved `light | dark`; apply the resolved theme on `document.documentElement.dataset.theme`; bootstrap it before the stylesheet paints; then normalize shell, controls, Canvas, inspector, AI, overlays, and secondary views. Do not rewrite the stylesheet or alter IDs, markup ownership, Canvas geometry, or application behavior.

**Recommendation.** Dark Mode should use deep ink/slate-purple backgrounds rather than black, stepped surfaces, restrained off-white text, accessible violet actions, and theme-adjusted (not meaning-changed) Canvas role colors. The future implementation must validate actual color pairs against WCAG 2.2 AA: 4.5:1 ordinary text, 3:1 large text and meaningful control boundaries/focus indicators. Candidate values below are starting values, not preference-only final colors.

**Go assessment:** **GO for one combined implementation package**, subject to the criteria in section 25. No surface demonstrates enough exceptional risk to justify another audit or a chain of design PRs. Canvas inline role/status colors and the early boot/integrity boundary require staged work and regression guards inside that one PR.

## 2. Current styling architecture

### 2.1 Sources and cascade

| Source | Confirmed contents | Dependency / Dark Mode implication |
|---|---|---|
| `styles.css:1-257` | Root aliases, partial `--fk-*` foundation, reset/global body, reusable `.fk-btn`, `.fk-card`, `.fk-field`, `.fk-pill`, `.fk-section`. | Best insertion point for semantic primitives and theme maps. Preserve legacy aliases during migration. |
| `styles.css:258-7022` | Shell, sidebar, navigation, dialogs, dashboard, Canvas/nodes, inspector, collaboration, Brand Core, AI, generation, responsive and late corrective overrides. | The authoritative component stylesheet, but chronological feature blocks create late-file overrides and duplicates. Migrate by surface, not wholesale reorder. |
| `index.html:8-104` (approximately) | Inline toolbar, sharing, Boards, authentication, and related responsive CSS, including hard-coded colors and `!important`. | It loads after `styles.css`, so equal-specificity declarations win. Move rules into a clearly marked stylesheet layer during BW-27 only after integrity tests are updated; otherwise tokenize in place. |
| `index.html` body (approximately lines 107-811) | Application markup and stable IDs/templates; no `style` attributes were found. One inline SVG and one image are present. | Keep IDs and structural relationships. Add only theme setting markup/attributes required by BW-27. |
| `app.js` | Generated classes/markup and about 110 direct style-property writes. Key examples: Brand color swatches around `renderBrandCoreWorkspace`; node placement and transition near lines 9675-9690; edge/node styling around `updateNode`; Canvas post-its around `renderPostits`; landing preview styles around `appendLandingPreviewText`. | Geometry writes remain JS-owned. Replace only visual-color literals with semantic CSS classes/properties. Never move `left`, `top`, transforms, pointer-events, or Canvas timing to theme logic. |
| Native browser rendering | `<dialog>`, selects, text/date/time/color controls, editable regions, scrollbars, autofill, validation. | Set `color-scheme` from resolved theme and add targeted semantic styling; retain native behavior. |

**Confirmed.** Globals begin with `:root` at `styles.css:1`; `body` establishes Inter/system font, text, and background around lines 258-264. `.app` defines the three-column shell using sidebar variables and a 340px inspector around lines 268-279. `.sidebar`, `.workspace-wrap`, and `.inspector` then establish the primary layout.

**Confirmed.** The stylesheet contains 17 responsive/reduced-motion media blocks, 25 keyframe blocks, and z-index values ranging from local `1` to `20001`. Breakpoints include 560, 600, 640, 720, 860, 900, 980, 1180, 1300, and 1400px in `styles.css`; the inline toolbar adds 1200px in `index.html`. This is a breakpoint set, not one responsive scale.

**Confirmed.** There are 13 `!important` declarations in `styles.css`, including modal sizing, activity/search opacity, selected/AI-updated rings, `.bc-import-error`, and compatibility hiding. The inline HTML block also uses `!important` for `.hidden`, toolbar/view/filter visibility. Most are functional-state or late-override dependencies, not merely stylistic excess.

**Confirmed.** DOM hierarchy matters in selectors such as `.brand-workspace-detail > p`, `.brand-workspace-edit label`, `.node header`, `.postit header`, `.inspector-section label`, and media rules nested by surface. IDs matter in inline selectors such as `#canvas-topbar`, `#filters-popover[hidden]`, `#node-filter-chips`, and throughout JS's `document.getElementById` cache (`app.js`, `el` map around lines 170-350 and runtime boot inventory around lines 400-570).

**Inferred.** Some duplicated animation names (`node-editing-soft-pulse` and `node-editing-ring-pulse` appear twice around lines 1903 and 1979) and later feature corrections rely on source order. Consolidation without computed-style snapshots could change behavior.

### 2.2 Hard-coded value profile

Static inventory found 584 hex literals and 284 `rgb/rgba()` occurrences in `styles.css`, plus hard-coded colors in the `index.html` inline block and `app.js`. These counts include repeated and intentional role colors; they measure migration size, not 868 distinct defects.

- **Colors/borders:** toolbar popover and Boards rules (`index.html:33-89`); Canvas selection, status, AI review, Brand Core, Insights, generation, and late feature blocks (`styles.css`); node connectivity and post-it colors (`app.js`, `updateNode` and `renderPostits`).
- **Shadows:** foundation `--fk-shadow-*` exists, but nodes, overlays, AI focus rings, toasts, modals, and generated node connectivity use literal shadows (`styles.css`; `index.html:.share-link-toast`; `app.js:updateNode`).
- **Radii:** `--fk-radius-*` exists, but many components use literal 6/8/10/12/14/18/20/24px and pills. This produces near-but-not-identical cards and controls.
- **Typography:** `--fk-font-family` and sizes xs-lg exist, but `--fk-font-size-xl` is consumed in later rules without appearing in the opening inventory, weights labelled “medium” and “bold” map to unusually heavy 700 and 900, and many literal px/rem sizes occur.
- **Spacing:** a 4px-based `--fk-space-*` scale exists but layout blocks still use literal values extensively, especially the inline toolbar and mature Canvas code.
- **SVG/Canvas:** CSS styles SVG edge paths; JS sets path cursor/pointer events and node/post-it visual values. The SVG `#edges-layer` is inside Canvas markup (`index.html`, Canvas region approximately lines 501-528).

### 2.3 Existing theme support

**Confirmed.** There is no theme selector, `data-theme`, theme class, `matchMedia('(prefers-color-scheme: ...)')`, or Dark override in `index.html`, `styles.css`, `app.js`, or `language.js`. `:root` contains Light values only. Therefore current “dark-looking” Boards inline rules are isolated component styling, not partial theme architecture.

## 3. Existing token inventory and disposition

| Existing tokens | Nature | Disposition |
|---|---|---|
| `--bg`, `--panel`, `--text`, `--muted`, `--primary`, `--primary-soft`, `--border`, `--danger` (`styles.css:2-9`) | Legacy semantic-ish aliases | **Alias** to new semantics for one release; deprecate in comments; migrate consumers incrementally. Do not immediately remove. |
| `--fk-color-bg`, `surface`, `surface-muted`, `text`, `heading`, `muted`, `border` (`styles.css:14-20`) | Mixed raw/semantic aliases | **Retain names as compatibility aliases** mapped to new roles; prefer new `--fk-color-surface-*`, `--fk-color-text-*`, and border roles in migrated rules. |
| `--fk-color-primary`, `primary-2`, `primary-hover`, `primary-soft` (`styles.css:21-24`) | Brand aliases | **Retain primary**, rename/alias `primary-2` to a documented decorative brand accent, add active and text-on-primary. |
| success/warning/danger and soft pairs (`styles.css:25-30`) | Semantic state tokens | **Retain names as aliases**, add information and state foreground/on-solid tokens; validate each theme. |
| radius sm/md/lg/xl/pill (`styles.css:32-36`) | Useful primitive scale | **Retain**, document values and component mapping. |
| shadow sm/md/lg (`styles.css:38-40`) | Elevation scale tied to Light rgba | **Replace values per theme**, retain API; add overlay/focus separation if needed. |
| space 1-6, 8 (`styles.css:42-48`) | Useful primitive scale | **Retain and complete** with 0, 7, 10, 12 only when evidenced; avoid arbitrary proliferation. |
| font family, size xs-lg, weights (`styles.css:50-56`) | Incomplete typography primitives | **Retain family**, replace misleading weight names with numeric/semantic aliases; complete scale with line heights and title sizes. |
| sidebar widths (`styles.css:10-11`) | Layout/component tokens | **Retain** because shell geometry genuinely requires them; add inspector/panel widths as layout tokens, not theme colors. |
| undeclared usages such as `--fk-color-background` and `--fk-font-size-xl` | Token defects | **Resolve** to declared compatibility aliases before migrating dependent components. |

## 4. Complete UI surface inventory

The table groups tightly related controls but covers every requested user-facing category. “Current color” describes the source pattern rather than pretending one computed value applies to all states.

| Surface | Confirmed selectors/evidence | Current pattern / inconsistency | Dark risk and future treatment |
|---|---|---|---|
| Application shell | `.app`, `.workspace-wrap`, `body`; `#left-sidebar`, `#inspector-panel` (`styles.css:258-330`; `index.html:107,288,601`) | Legacy and `--fk-*` backgrounds/borders mixed; fixed grid widths. | High blast radius. Tokenize colors only; preserve grid geometry and collapse classes. |
| Left navigation | `.sidebar`, `.nav-item`, `.nav-item.active`, `.nav-item-child`, `.settings-nav-item`; emoji `data-icon` (`index.html:231-255`) | Gradient surface, soft purple active state, generic `.fk-btn` plus nav overrides. | Normalize active/hover/focus with selected/hover tokens; retain hierarchy and IDs. |
| Top toolbar/status/share | `.topbar`, `.canvas-toolbar*`, `.toolbar-group*`, `.status-block`, `.share-*`, `#canvas-topbar` (`index.html:8-58,289-367`) | Inline post-stylesheet rules, literal error/toast/presence colors, high specificity and z-index 120/140/999. | Very high cascade/overflow risk. Tokenize in place first; do not change grid or visibility rules. |
| Search, filters, tools, zoom | `#node-search-input`, `#filters-toggle-btn`, `.filter-popover`, `.filter-group`, `.toolbar-zoom`, `.tools-menu`/toolbar controls (`index.html:44-58,289-325`; `styles.css` toolbar blocks) | Search uses shared field partly; filter popover is inline hard-coded; icon/text buttons vary. | Ensure input surface and popover elevation; preserve `hidden`, menu anchoring, and event IDs. |
| Campaign creation | `#campaign-create-btn`/creation controls; `.campaign-builder-overlay`, `.campaign-v3-creation-modal`, `.campaign-loading-overlay` (`app.js`, `openCampaignV3*`, `showCampaignLoadingOverlay`, around lines 12330-12650) | Multiple generations of modal/button/loading visuals and animation systems. | High overlay/readability risk. Shared overlay/card/progress tokens; no generation lifecycle changes. |
| Canvas background/grid | `.canvas`, `.canvas-scroll-surface`, `.canvas-world`, background/grid rules; `#canvas` (`index.html:501-528`) | Light backdrop/grid literals and geometry coupled to scroll/world. | Theme background/grid only; preserve dimensions, transform origin, scroll and pointer behavior. |
| Nodes/roles/connectors | `.node`, `.node.selected`, `.connector-*`, `.node.is-compact`, `.node.search-*`; `NODE_TYPES`; `updateNode` around `app.js:13225-13242` | Role tone applied inline to type/border/shadow; disconnected state literal gray, opacity and grayscale; selection uses hard-coded ring. | Highest visual-semantic risk. Introduce role palettes as CSS vars set per node; preserve role identity, geometry, handlers, and class semantics. |
| Edges/labels/selection/drag | SVG edge selectors, `.campaign-link-reveal`, `.dragging`, `.selected`; path styles around `app.js:12780-12819` | CSS and JS share pointer/animation responsibilities. | Do not theme pointer events or geometry. Use `--fk-color-canvas-edge/selection`; verify labels and selection at all zooms. |
| Node badges/status/chips | `.node-status-chip`, `.list-status-chip`, `.tag`, `.variant`, `.social-status-badge`; render functions around `app.js:13061-13320` | Several pill systems with role/status colors and different radii/type sizes. | Map state semantics without removing text/icon cues; retain class/state logic. |
| Comments/post-its | `.postit`, `.postit-*`, `.node-comment-badge`; `#postit-template`; `renderPostits` around `app.js:14299-14498` | User-selectable `note.color` becomes inline background; dynamic font sizing; emoji/Unicode controls. | Cannot flatten user note colors. Add readable foreground/border algorithm or overlay treatment and retain persisted color meaning. |
| AI Review | `.ai-review-card`, `.ai-review-section-*`, `.ai-review-score`, `.ai-review-postit`; `renderAiReview*` around `app.js:13954-14299` | Feature-local state colors/card patterns and `primary-add` action. | Map score/state and card surfaces; ensure score is not color-only; do not change review/apply behavior. |
| Inspector/sections | `.inspector`, `.inspector-content`, `.inspector-section`, `#inspector-panel`; markup `index.html:601-778`; `updateInspector` | Some sections use `.fk-card`, others do not; many buttons are legacy classes; display toggled inline in JS. | Preserve 340px shell column, visibility writes, scroll and selection. Normalize header/section spacing and surfaces. |
| Forms | `.fk-field`, `.fk-select`, inspector inputs/textareas/selects, `[contenteditable]`, Brand forms, search, native date/time/color (`styles.css:176-205`; `index.html`) | Shared foundation coexists with broad/feature selectors and inconsistent heights, padding, focus, monospace JSON editor. | Establish one control anatomy; retain monospace where JSON requires it. Add placeholder/autofill/invalid/read-only/disabled and `color-scheme`. |
| Buttons/icon buttons | `.fk-btn-*`, `.primary-add`, `.secondary`, `.icon-btn`, `.connector-handle`, `.postit-*`, `.social-*`, toolbar buttons | Foundation variants coexist with older gray, green, transparent, emoji, and one-off classes. | Classify/multi-class rather than rename IDs. Minimum 44px target where practical; compact exceptions need 24px minimum spacing/accessible name. |
| Tooltips/popovers/dropdowns | `[title]`, `.filter-popover`, brand switcher `<details>`, share/team popovers, tools menu | Native titles and bespoke positioned surfaces; z-indices 30 through 9999. | Tokenize surface/border/shadow, retain anchors and stacking. Avoid tooltip-only essential information. |
| Modals/overlays | `<dialog>` settings/Brand comparison/detail; `.brand-confirm-modal`, `.node-type-picker`, campaign overlays | Native dialogs plus div overlays; literal backdrops; z-index 1100, 1200, 12000, 13000, 20000/20001. | Create semantic overlay/elevation map without changing DOM/modal lifecycle. Verify nested/competing layers. |
| Loading/empty/error/success/warning | `.campaign-loading-*`, `.ai-brain-*status`, `.ai-workspace-error`, `.bc-import-error`, dashboard/Boards empty nodes, status live regions | Text, cards, banners and colors are feature-local; some `!important`; loading animations vary. | Unify semantic state presentation and live-region behavior; keep copy/state ownership. |
| Ownership/sharing/auth | `.board-access-*`, `.share-*`, `.presence-*`, `.owner-avatar`, `.node-owner-*`, `.auth-*`; `renderOwnerAvatar` | Avatar sizes/containers and fallback colors vary. | Shared avatar shell sizes; stronger Brand/AI avatar prominence in hero/panel contexts, not every compact chip. |
| My Boards | `.boards-library-*`, `.board-row*`, `.boards-create-btn`, `.icon-btn` (`index.html:60-84,529-545`) | Inline block is already dark-translucent while surrounding app is Light; create action is green despite primary hierarchy. | Genuine disconnected panel. Map to theme surfaces; make create primary purple; keep destructive icons danger only. |
| Dashboard/start screen | `#dashboard-view`, `.mission-hero`, `.mission-card`, `.dashboard-*` (`index.html:372-500`; late `styles.css`) | Newer `fk-card` foundation mixed with feature gradients and one-off CTA patterns. | Tokenize decorative gradients separately; retain visual hierarchy and empty/loading logic. |
| Brand Workspace/Core/comparison | `.brand-workspace-*`, `.bc-*`, `.brand-core-comparison`, dialogs; `renderBrandCoreWorkspace` | Rounded card system but dense late CSS; JSON editor monospace; inline color swatches. | Preserve swatches as brand content; theme containers/text. Strengthen avatar container and standardize actions. |
| Settings/Language & Region | `.settings-dialog`, `.settings-category`, `.settings-field`; IDs and listeners (`index.html:255-285`; `app.js:16301-16320`) | Only language preferences; shared select partly used. | Add global Appearance section and `theme-preference-select`; do not mix with campaign language or Board state. |
| AI Brain/transcript/proposals | `#ai-brain-view`, `.ai-brain-*`, `.ai-brain-message`, `.ai-brain-proposal-*`; rendering/close functions in `app.js` BW-26 blocks | Dedicated panel, bubbles, Markdown, Advisor/avatar, proposal transitions; literal white/purple colors and high z-index layers. | Complete theme pass including formatted elements, disclosure, error/success, composer. Preserve safe formatter and close/transition classes. |
| AI Insights | `#insights-view`, `.insights-*`, `.insight-card`, score/diagnostic blocks (`index.html:558-561`; `styles.css` around lines 2400-2560; BW-25 checks) | Cards use independent score colors and hero treatment. | State/chart-ready semantic palette, text/icon score cues, no product merge with Brain. |
| Login/account | `.auth-panel`, `.auth-user`, `.auth-avatar`, sign-in/out IDs; session handling around `app.js:16403-16489` | Compact toolbar UI and fallback avatar; inline CSS hard codes border. | Theme all auth states from root; account switch must re-resolve preference. Do not restyle external provider pages. |
| Public Viewer | access role `public_viewer` handling in `app.js` (including no local Board write near line 8331); board access chips | Same shell with authorization-dependent controls. | Viewer local/system theme; never persist theme in Board/owner record. Verify hidden/disabled controls and readable ownership status. |
| Responsive/mobile | all `@media` blocks and inline 1200px toolbar rule | Many feature-specific breakpoints, fixed inspector/sidebar widths, long labels. | Theme does not redesign layout; normalize wrapping/min-width and test open panels, German, and 200% text. |

**Not present / unresolved.** No minimap, chart library, embedded widget, custom radio group, or confirmed external authentication widget is evidenced by the searched markup/styles. Native checkboxes, file inputs, slider/range, numeric/date controls should be re-inventoried during implementation because some may be generated conditionally in `app.js`. Print/export-specific styling was not found; the implementation must either document unchanged browser print behavior or add a Light print theme without changing export data.

## 5. Visual inconsistency inventory

| Finding | Classification | Evidence and future resolution |
|---|---|---|
| Gray/neutral actions vary between `.fk-btn-secondary`, `.fk-btn-ghost`, generic `button`, `.secondary`, inline `.icon-btn`, and numerous feature classes. | **Genuine inconsistency plus legacy dependency.** | `styles.css:.fk-btn*`; `index.html` toolbar/Boards/inspector; generated actions in `app.js`. Add canonical variants as extra classes; do not remove IDs/classes until tests prove no dependency. |
| `.boards-create-btn` is green while campaign/Brand creation generally uses purple primary. | **Genuine inconsistency**, not a success state. | `index.html:63-64` and `#boards-create-btn` around line 536. Future variant: primary. |
| Disabled buttons often appear like unfinished gray buttons because background/border/text and opacity are not consistently encoded. | **Genuine inconsistency.** | Shared `.fk-btn` foundation and feature overrides. Use semantic disabled surface/text/border plus cursor, retaining labels and state. |
| Active navigation uses purple-soft treatment while some selected chips/buttons use borders, translucent fills, or `aria-pressed` without one visual grammar. | **Intentional functional differences expressed inconsistently.** | `.nav-item.active`, `.node.selected`, filter chips, Board scopes. Share selected tokens but retain component geometry. |
| Font sizes and weights mix px/rem and 400/500/600/700/800/900; `--fk-font-weight-medium:700` and bold `900` misname weight intent. | **Genuine system inconsistency.** | `styles.css:50-56` and literal declarations throughout; inline toolbar uses 9/10/11/12/14/16px. Adopt semantic type roles with available system/Inter weights. |
| Cards range across no shadow, `--fk-shadow-*`, literal shadows, translucent backgrounds, and borders; radii vary by near-equivalent values. | **Genuine inconsistency with intentional elevation hierarchy.** | `.fk-card`, nodes, dashboard, Boards inline styles, AI blocks. Preserve elevation differences, reduce arbitrary values to surface/elevation roles. |
| Inspector sections alternate `.fk-card` and bare `.inspector-section`. | **Genuine disconnected-panel appearance plus legacy structure.** | `index.html:607-741`. Normalize visual section anatomy without inserting/removing wrappers or affecting scroll. |
| Brand/AI avatars range from tiny toolbar/presence circles to hero avatars, with different border/fallback treatments. | **Hierarchy partly intentional; prominence concern is genuine in Brand/AI primary contexts.** | `.brand-switcher-avatar`, `.brand-workspace-avatar`, `.campaign-*avatar`, `.ai-brain-*`, `.auth-avatar`, `renderOwnerAvatar`. Create shared avatar shells/sizes but enlarge/emphasize only hero/advisor contexts. |
| German and English strings coexist in static system UI (`Node Inhalt`, `Neuen Node verbinden`, `Node-Typ auswählen`, `Schedule post`, `Add to Calendar`) while newer areas use `data-i18n`. | **Genuine Denglisch.** | `index.html` templates and overlays near its final 60 lines; `language.js:dictionaries/applyTranslations`; direct strings in `app.js`. BW-27 should migrate system-owned visual strings touched by components, retaining user content and enum/ID strings. |
| Hover/focus/active/disabled/loading states are incomplete across one-off actions; several icon controls rely on hover. | **Accessibility/design inconsistency.** | `.fk-btn` has partial focus/hover; `.icon-btn`, connector, post-it and social actions differ. Define all states for every canonical variant and retain ARIA/keyboard handlers. |
| State badges use many separate green/yellow/red/blue shades and sometimes color is the dominant differentiator. | **Genuine inconsistency; some role/status differences intentional.** | `.fk-pill-*`, `.node-status-chip`, Insights, AI Review, generation steps. Use semantic state palette and preserve label/icon/shape cues. |
| Layer values are uncoordinated (30, 40, 50, 60, 80, 110, 9999, 1100/1200, 12000/13000, 20000/20001). | **Legacy dependency and overlap risk.** | `styles.css` z-index inventory and inline toolbar. Document layer roles and alias existing values before any numerical normalization. |

## 6. Proposed semantic token architecture

### 6.1 Color contract

Use role names, with aliases for current tokens:

```css
:root {
  color-scheme: light;
  --fk-color-app-bg: #f6f7fb;
  --fk-color-canvas-bg: #f8f9fd;
  --fk-color-surface-elevated: #ffffff;
  --fk-color-surface-secondary: #f2f4fa;
  --fk-color-surface-panel: #ffffff;
  --fk-color-surface-card: #ffffff;
  --fk-color-surface-input: #ffffff;
  --fk-color-surface-hover: #f0f1fb;
  --fk-color-surface-selected: #eeeaff;
  --fk-color-brand-primary: #6950ef;
  --fk-color-brand-hover: #5a40df;
  --fk-color-brand-active: #4932c8;
  --fk-color-brand-subtle: #ece8ff;
  --fk-color-text-primary: #22253a;
  --fk-color-text-secondary: #505773;
  --fk-color-text-muted: #6f748f;
  --fk-color-text-inverse: #ffffff;
  --fk-color-border-default: #dfe3f2;
  --fk-color-border-strong: #b8bfd6;
  --fk-color-divider: #e7e9f3;
  --fk-color-focus-ring: #6950ef;
  --fk-color-success: #18794e;
  --fk-color-success-subtle: #e8f7ef;
  --fk-color-warning: #8a5a00;
  --fk-color-warning-subtle: #fff4d6;
  --fk-color-danger: #b4232f;
  --fk-color-danger-subtle: #ffeaec;
  --fk-color-info: #2457b8;
  --fk-color-info-subtle: #eaf1ff;
  --fk-color-overlay-backdrop: rgb(21 24 38 / 58%);
  --fk-color-canvas-grid: rgb(105 80 239 / 10%);
  --fk-color-canvas-edge: #8c93ad;
  --fk-color-canvas-selection: #6950ef;
  --fk-color-scrollbar: #b6bdd2;
}

:root[data-theme="dark"] {
  color-scheme: dark;
  --fk-color-app-bg: #11131d;
  --fk-color-canvas-bg: #151824;
  --fk-color-surface-elevated: #252938;
  --fk-color-surface-secondary: #191c28;
  --fk-color-surface-panel: #1c202d;
  --fk-color-surface-card: #222635;
  --fk-color-surface-input: #181b27;
  --fk-color-surface-hover: #2a2e40;
  --fk-color-surface-selected: #302a54;
  --fk-color-brand-primary: #9b87ff;
  --fk-color-brand-hover: #ad9cff;
  --fk-color-brand-active: #8870f3;
  --fk-color-brand-subtle: #302858;
  --fk-color-text-primary: #ececf3;
  --fk-color-text-secondary: #c4c7d4;
  --fk-color-text-muted: #9a9fb3;
  --fk-color-text-inverse: #171424;
  --fk-color-border-default: #373c50;
  --fk-color-border-strong: #555d78;
  --fk-color-divider: #303548;
  --fk-color-focus-ring: #ad9cff;
  --fk-color-success: #61d49a;
  --fk-color-success-subtle: #163a2a;
  --fk-color-warning: #f0c15b;
  --fk-color-warning-subtle: #443516;
  --fk-color-danger: #ff858f;
  --fk-color-danger-subtle: #482129;
  --fk-color-info: #83b4ff;
  --fk-color-info-subtle: #1d3152;
  --fk-color-overlay-backdrop: rgb(3 5 10 / 72%);
  --fk-color-canvas-grid: rgb(173 156 255 / 10%);
  --fk-color-canvas-edge: #737b98;
  --fk-color-canvas-selection: #ad9cff;
  --fk-color-scrollbar: #555d78;
}
```

**Recommendation.** Treat these as candidate families. Automated contrast checks must test foreground/background pairs, not isolated colors. Purple solid buttons should use a dark inverse foreground when that pair gives better contrast; do not assume white on every violet. Retain role-specific Canvas hues as the few justified component-domain tokens (for example `--fk-node-role-strategy-*`), because their meaning cannot be represented by generic success/info tokens.

### 6.2 Layout, shape, elevation, and layers

- Spacing: `--fk-space-0:0`, existing 1/2/3/4/5/6/8 = 4/8/12/16/20/24/32px, plus `--fk-space-10:40px`, `--fk-space-12:48px` only for evidenced large gaps.
- Radii: retain sm 8, md 10, lg 16, xl 22, pill 999px; map controls to md, cards to lg, major panels to xl. Do not convert circles to pills semantically.
- Borders: `--fk-border-width-default:1px`, `--fk-border-width-strong:2px`.
- Shadows: `--fk-shadow-sm/md/lg` plus `--fk-shadow-overlay`; redefine per theme so Dark shadows include subtle border/elevation, not black haze alone.
- Controls: `--fk-control-height-sm:32px`, `md:40px`, `lg:48px`; `--fk-control-target-min:44px`. Compact Canvas handles may visually remain smaller but need a 44px hit area where geometry permits.
- Layout: retain sidebar width tokens; add `--fk-inspector-width:340px`, `--fk-panel-width-ai`, and `--fk-content-max:1100px` only where current geometry proves the role. Do not theme geometry.
- Layers: `--fk-z-canvas:1`, `sticky:30`, `popover:100`, `toast:200`, `backdrop:1000`, `modal:1100`, `critical-overlay:1200`. Initially alias current numeric levels rather than immediately lowering 12000/20000 values; normalize only after stacking tests.

### 6.3 Typography and motion

- Family: retain `Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`; no repository font import is present, so Inter may fall back when not installed. Do not add a network font dependency.
- Roles: display 32/40 700; page title 24/32 700; section title 18/26 700; card title 15/22 650 (or available 600/700); body 14/21 400; small body 13/19 400; label 12/16 600; caption 11/16 500; button 13/16 650. Canvas titles remain compact but at least 12px at 100% zoom. Use numeric aliases if variable weight 650 is unavailable.
- Monospace: `ui-monospace, SFMono-Regular, Consolas, monospace` only for JSON/code-like fields (the Brand editor currently deliberately uses monospace at `styles.css:.brand-workspace-edit textarea`).
- Motion: `--fk-motion-fast:120ms`, `standard:180ms`, `panel:240ms`, `overlay:200ms`; easing tokens for standard and emphasized transitions. Under `prefers-reduced-motion: reduce`, eliminate nonessential transforms, shimmer, aura, pulse, and smooth scrolling while retaining immediate state visibility. Extend existing reduced-motion blocks rather than create competing rules.

### 6.4 Migration without wholesale rewrite

1. Add semantic tokens and Light/Dark maps before components. Alias existing variables to them (`--bg:var(--fk-color-app-bg)`, etc.), producing no Light visual change.
2. Add static checks that core semantics exist and migrated selectors contain no new theme literals.
3. Migrate one surface group at a time inside the same PR. Keep old class names and add canonical classes only where safe.
4. Replace JS visual literals with CSS variables/classes, but retain geometry/state writes. For dynamic node/post-it colors, set narrowly scoped custom properties rather than inline full styles.
5. Keep compatibility aliases through BW-27; mark them deprecated. Removal is outside the combined package unless zero consumers and tests prove safety.
6. Do not reorder large historical blocks merely for cleanliness. Late overrides should be annotated and migrated with computed-style assertions.

## 7. Light and Dark theme definitions

### Light

**Recommendation.** Preserve today's pale blue-gray app background, white rounded cards/panels, purple primary actions, and current Canvas brightness. Refinement means consistent borders, a restrained elevation scale, readable muted text, unified controls, and fewer disconnected translucent/dark islands. The token alias stage must be visually lossless before normalization.

### Dark

**Recommendation.** Use a deep ink/slate-purple app background (`#11131d` family), slightly lighter Canvas (`#151824`), stepped panels/cards (`#1c202d` through `#252938`), and `#ececf3` rather than pure white for primary text. Purple becomes lighter/more chromatic so brand controls and selection remain distinct. Inputs are darker than cards but bounded by a visible border and focus ring. Status hues use light foregrounds on restrained tinted backgrounds and always retain labels/icons.

- No dominant `#000`; pure black is reserved for shadows/backdrops if needed.
- Canvas node surfaces remain elevated above the Canvas, with role-colored accent/border/header rather than fully saturated bodies.
- Comments retain authored colors but receive theme-aware text/border treatment.
- AI Review and proposal cards share panel/card tokens; Advisor/Brand avatars receive a subtle brand aura/container without constant motion.
- Chart readiness: reserve categorical palettes separate from state colors and test adjacent series; BW-27 need not implement charts that do not exist.
- Selected/hover states must differ in both fill and border/ring. Focus remains independently visible.

## 8. Theme application mechanism

**Recommendation — authoritative mechanism.** Put `data-theme="light|dark"` on `document.documentElement`. Store preference separately as `light|dark|system`; expose resolved theme only through `document.documentElement.dataset.theme`. This reaches login, viewer, dialogs, and shell, applies before `<body>`, is easier to bootstrap than a body class, and makes CSS override blocks explicit.

Proposed pure functions/state boundary (names may adapt to project conventions):

- `THEME_PREFERENCES = ['light','dark','system']`
- `DEFAULT_THEME_PREFERENCE = 'system'`
- `getThemePreference()` returns preference, never resolved theme.
- `resolveTheme(preference, mediaQuery.matches)` returns `light|dark`.
- `applyResolvedTheme(theme)` changes only root dataset/color-scheme-related presentation.
- `setThemePreference(preference)` persists and applies without reload.
- one `matchMedia('(prefers-color-scheme: dark)')` listener updates only when preference is `system`.

**Confirmed constraint.** `state.uiLanguage` and `state.campaignLanguage` originate from `language.js` and Settings listeners update only their respective domains (`app.js:29,65-67,16312-16324`). Theme must be a sibling global UI preference, not added to serialized Canvas/Brand state.

## 9. Preference and persistence behavior

**Confirmed.** `language.js` already demonstrates a browser-local global preference module with guarded localStorage reads/writes (`funklix.languagePreferences.v1`, lines 12 and 124-156). Canvas uses `campaignCanvasState`; Brand uses separate storage/API paths. No account preference endpoint or account preference field is confirmed. Authentication/session state is handled in `app.js` around `refreshAuthSession`/sign-out listeners (approximately 16380-16489).

**Recommendation.** Use one versioned local UI-preferences record (or a dedicated `funklix.themePreference.v1` only if changing the language record risks BW-21 compatibility) for pre-auth and failure fallback. The long-term authoritative signed-in value should be an account preference if the existing backend can be safely extended in BW-27. Because no such API exists now, this is the only potentially infrastructure-bearing part of the package; it still does not justify a separate audit.

| Situation | Recommended behavior |
|---|---|
| First visit | Preference `system`; bootstrap resolves current OS before paint. |
| Signed out / returning | Retain the last local preference. Never write Board/Brand/URL state. |
| Signed in | Load account preference if available; account value wins and refreshes local cache. If absent, adopt local preference once, then save to account after explicit setting change (avoid silent cross-device mutation without backend contract). |
| Account switch | Clear prior in-memory resolution, load new account preference, fall back to that browser's local value/system. No Board mutation. |
| Sign-out | Continue with locally cached preference to avoid a flash; remove account-specific in-memory provenance, not the neutral local preference. |
| OS change | Re-resolve immediately only in System mode. Explicit Light/Dark ignore it. |
| Multiple tabs | Listen for the relevant `storage` key and apply preference without reload/Board dirtying. Account server changes can reconcile on session refresh. |
| API unavailable/offline | Use validated local preference, else System. Never block boot. |

**Unresolved infrastructure decision.** Confirm whether an account-preferences API can be added within the normal BW-27 backend boundary. If not, ship correct local behavior and a schema-compatible adapter, explicitly documenting that cross-browser following is unavailable; do not misuse Board or Brand persistence.

## 10. Boot and wrong-theme flash prevention

**Confirmed.** `/styles.css` is linked at `index.html:7`; the inline style begins at line 8; application scripts load at the end of body, with `language.js` first and `app.js` last. Waiting for `app.js` to resolve theme will paint the Light `:root`/body first. `scripts/check-browser-script-integrity.js` validates browser script registration/content and must remain green.

**Recommendation.** Add the smallest synchronous, non-network bootstrap in `<head>` **before** the stylesheet link. It should: guarded-read only the validated local preference; resolve System with `matchMedia`; set `document.documentElement.dataset.theme` and `style.colorScheme`; and do nothing else. Keep the bootstrap source deterministic and update the integrity check to recognize/hash/validate it. The full module later reconciles account preference and registers the OS/storage listeners.

- Do not wait for auth, Board restoration, `language.js`, or `app.js`.
- Do not insert user-controlled strings or dynamic script source.
- On malformed/unavailable storage, resolve System without throwing.
- The bootstrap and runtime must share constants/algorithm via a tiny external early script if the current integrity policy rejects inline executable scripts. **Unresolved:** inspect/extend the integrity script's exact allow-list during implementation before choosing inline versus external; current inline `<style>` is not evidence that inline scripts are permitted.
- Login, Public Viewer, and shell automatically share the root theme because they live in the same document.

## 11. Canvas-specific findings

**Confirmed.** Canvas rendering is hybrid DOM/SVG. Nodes are cloned/generated and absolutely positioned; edges are SVG paths; direct JS writes handle node `left/top`, reveal transforms, z-index, edge pointer events, node connectivity border/shadow/opacity/filter, role tone, post-it position/background, and dynamic font size (`app.js:9675-9690,12780-12819,13225-13242,14299-14498`). These are behavior-sensitive boundaries.

| Visual | Classification | Recommendation |
|---|---|---|
| Canvas/background/grid | Decorative but essential spatial affordance | Theme semantic Canvas background/grid; retain grid scale and world geometry. Dark grid: retain at restrained ~10% violet/neutral contrast, neither erase nor strengthen globally. |
| Node role tones (`NODE_TYPES[type].color`) | Role-specific semantic identity | Provide Dark variants with comparable perceptual separation. Keep type mapping and meaning identical; set CSS role vars from existing type data. |
| Status badges/review/error | Status semantic | Map to success/warning/danger/info tokens with text/icon labels. Do not reuse role hue as status. |
| Node body/shadow | Surface/elevation | Dark nodes use card/elevated surfaces and border; avoid saturated body fills. |
| Selected/hover/drag/search | Functional interaction state | Selection gets fill + 2px ring; hover remains weaker; drag retains cursor/opacity; search dimming remains (current `!important` is functional). |
| Connectors/edges/labels | Structural/interactive | Semantic edge and stronger interactive hover; verify against all role accents and zoom levels. Preserve pointer-event writes. |
| Collapsed nodes | Functional state | Preserve `.is-compact` and hidden-content behavior; theme only visible summary/thumb overlay. |
| Comments | User content plus collaboration state | Preserve persisted note color. Compute/classify safe text and add border/overlay; unresolved/unread still use icon/count/state, not color alone. |
| AI Review | AI/state surface | Use shared AI card/state tokens while retaining review-specific classes and apply-fix lifecycle. |
| Ownership avatars | Identity | Shared avatar border/background tokens; keep fallbacks and assignment labels. |
| Print/export | Unconfirmed surface | Add `@media print { :root { color-scheme:light; ... } }` only if browser print is supported; do not mutate stored colors/data. No minimap was found. |

**Primary Canvas risk.** A broad rule on `.node`, `svg path`, `button`, `contenteditable`, or `transform` can break positions, drag/edge interaction, selection, editing, or zoom. Theme migrations must exclude layout/transform/pointer-event properties and snapshot node/edge state before and after theme switches.

## 12. AI surfaces

**Confirmed.** AI Brain is a dedicated `#ai-brain-view` with `.ai-brain-*` transcript, composer, formatted message, proposal, avatar/advisor and status selectors. AI Review and AI workspace are separate inspector/node systems. AI Insights is `#insights-view` with `.insight-card` and score/diagnostic styles. Generation uses `.campaign-loading-overlay`, `.campaign-builder-overlay`, `.campaign-v3-*` progress/card/avatar animations (`index.html:558-565`; `styles.css` AI/Insights/generation blocks; rendering functions in `app.js` around lines 13954-14299 and 12330-12650).

**Recommendation.** Share only visual primitives: AI avatar shell, advisor badge, AI surface, transcript bubble, formatted-content typography, proposal/diagnostic card, progress step, and state banner. Keep Brain conversation/proposal logic, Insights diagnostics, AI Review actions, and generation lifecycle separate.

- Formatted Markdown must theme headings, paragraphs, lists, code, links, blockquotes, and disclosure/assumption blocks; keep the BW-26.2 safe renderer untouched and covered.
- User and assistant bubbles need more than color: alignment, avatar/label, and surface remain distinct.
- Proposal preview must preserve pending/confirm/success/error transitions from BW-26.6.x.
- Score colors must have text/icon equivalents and chart-compatible semantic/categorical separation.
- Generation completed/active/pending steps use state tokens and labels; reduced motion removes decorative avatar/orbit/shimmer but not progress updates.
- Increase Brand/Advisor avatar emphasis in Brain header, generation focus card, and Brand hero only; do not enlarge toolbar/presence avatars and create overlap.

## 13. Inspector and forms

**Confirmed.** Form types include text/search, textarea, select, contenteditable, date, time, color, file-related generated UI, and likely numeric controls in inspector/campaign setup. Settings uses `.fk-select`; Brand JSON editing deliberately uses monospace. `updateInspector` toggles many sections and directly controls button display (`app.js:12894-12908,14577-14649`).

**Recommendation.** Define `.fk-control` anatomy (surface, text, border, radius, height/padding) and apply additive classes to inputs/selects/textareas without changing names, values, IDs, listeners, or native types.

- Explicit visible focus via `:focus-visible`; do not globally remove outlines.
- Placeholder uses muted text with AA where it conveys examples, not labels.
- Disabled: semantic disabled surface/border/text plus cursor and native disabled property. Read-only: normal readable text with distinct subtle surface, not disabled opacity.
- Invalid: border + icon/message and existing live region; success/error announcements remain `role=status/alert` as currently marked in Brand/Settings flows.
- Set root `color-scheme` to resolved theme for native select/calendar/validation/scrollbar behavior, then target `option`, date/time indicators, and color/file buttons only where browser support permits.
- Style `:-webkit-autofill` with semantic input/text and an inset shadow fallback; verify Chromium. Do not suppress password manager/provider behavior.
- Use `accent-color:var(--fk-color-brand-primary)` for checkbox/radio/range where appropriate; retain checked/selected native affordance.
- Scrollbars use semantic track/thumb with platform fallbacks. High contrast must not depend on custom scrollbar styling.

## 14. Button classification and mapping

### Canonical contract

All variants share label typography, 40px normal control height, 8-10px radius, 8px icon gap, visible focus ring, pressed feedback, disabled styling, and a 44px target where layout permits. Loading retains button width, label or accessible name, `aria-busy`, and disabled activation without presenting as generic disabled.

| Variant | Visual hierarchy | Existing mapping |
|---|---|---|
| Primary | Brand solid; inverse text; darker/lighter hover; active compression/tone; one dominant action per region. | `.fk-btn-primary`, `.primary-add`, create/save/confirm/generate; change `.boards-create-btn` from green to primary. |
| Secondary | Surface/card background, strong border, primary/strong text; hover surface. | `.fk-btn-secondary`; many unfinished gray save-neutral actions; Board scope buttons when unselected. |
| Subtle | Brand/state subtle fill, no strong elevation; selected or supportive action. | Active filters/scopes, AI supportive actions, appropriate pale-purple/gray legacy buttons. |
| Ghost | Transparent, text/icon; hover surface; no resting border unless contrast requires. | `.fk-btn-ghost`, close/cancel/toolbar utility/navigation actions. |
| Icon | Square/circular target, icon currentColor, accessible label; may combine ghost/secondary/destructive. | `.icon-btn`, sidebar toggle, post-it delete/resolve, connector/social tools. Retain special geometry where Canvas requires it. |
| Destructive | Danger text/border or solid only for irreversible confirmation; not all delete icons solid red. | `.icon-btn.danger`, delete Board/node/comment and destructive confirmation actions. |
| Success (exception) | Use only when action itself represents completion, not generic create. | Existing green create Board should **not** map here; completed progress is a status, not button variant. |

**Gray-button decisions.** Neutral actionable gray buttons become Secondary when they compete as the alternate main action; Ghost when dismissive/utility; Subtle when selected/contextual; true unavailable actions remain Disabled. Do not infer disabled from gray paint—use the DOM `disabled` state. Preserve intentional hierarchy: not every action becomes purple.

## 15. Typography findings

**Confirmed.** Both `body` and `--fk-font-family` specify Inter followed by system fallbacks (`styles.css:50,261`), but `index.html` contains no font preload/import and no font files were found in the top-level asset inventory. Weight availability is therefore environment-dependent and 900 may be synthetic. Canvas, toolbar, panels, buttons, labels, dashboards, and AI features use many literal sizes/weights.

**Recommendation.** Keep the existing stack; do not introduce a font. Use the compact role scale in section 6.3, reduce 900 to an available 700 where visual hierarchy remains, establish consistent line heights, and test 200% zoom. Keep Canvas compact but readable and allow German labels to wrap rather than shrink below 11-12px. Button labels use one role; uppercase/letter-spacing only for eyebrow/status labels, not general headings.

## 16. Icons, logos, images, and SVG

**Confirmed.** Navigation and controls use emoji/Unicode (`📚`, `🧩`, `🧠`, `✨`, `⚙️`, `✕`, plus connector characters); Canvas edges use inline SVG; avatars/logos use `<img>` and JS-created image elements; Brand color swatches are generated with inline backgrounds (`app.js` around line 9410). Many CSS-drawn icons/controls inherit color inconsistently.

**Recommendation.** Convert monochrome inline/CSS SVG strokes and fills to `currentColor`; do not convert data-driven Brand swatches, user imagery, node role colors, or authored post-it colors. Put emoji/Unicode product icons in consistent theme-aware icon containers because their glyph rendering cannot be recolored reliably. Preserve Funklix logo/avatar assets, use border/backplate contrast rather than theme-specific replacement, and keep `<img>` content unfiltered. Verify fallback initials. Theme variants are not currently proven necessary for brand assets.

## 17. Accessibility findings

High-risk targets:

- muted 9-11px toolbar/presence text and opacity (`index.html:14-42`);
- translucent Boards rows/chips authored against an assumed dark background (`index.html:66-84`);
- color-dominant role/status/score indicators (`.node-status-chip`, `.ai-review-score`, Insights);
- compact connector/post-it/icon controls with small visual boxes;
- contenteditable node fields and placeholder-only cues;
- hard-coded post-it foreground/background combinations (`renderPostits`);
- focus styles overridden by feature selectors and `!important` selection rings;
- moving shimmer/pulse/orbit animations outside the two existing reduced-motion blocks;
- native title tooltips and hover-revealed image delete control (`app.js:13284-13292`).

**Recommendation.** Require AA pair testing, 3:1 focus/meaningful control boundary contrast, persistent keyboard focus, accessible names on icon controls, non-color status cues, and 44px targets where practical. Ensure hover-revealed actions also appear on focus-within and touch. Add `forced-colors` rules using system colors for boundaries/focus and avoid `forced-color-adjust:none` except tested brand imagery. Preserve/extend existing `role=status`, `role=alert`, `aria-live`, `aria-pressed`, and labels in `index.html`. Theme changes should be announced only if product testing finds it useful; avoid noisy live announcements from OS changes.

## 18. Responsive findings

**Confirmed.** Responsive logic is distributed across 17 stylesheet media blocks and an inline 1200px toolbar breakpoint. The shell has fixed sidebar and inspector columns; AI/insight cards, Brand workspace, overlays, and campaign generation define independent breakpoints. Relevant values include 560, 600, 640, 720, 860, 900, 980, 1180, 1200, 1300, and 1400px (`styles.css:@media`; `index.html:58`).

**Recommendation.** Do not redesign responsiveness. Within BW-27, fix only component/theming overflow: use `min-width:0`, wrap action groups, preserve scroll containers, constrain dialogs/overlays, permit German button labels to wrap, and prevent open inspector/AI Brain from covering critical dismiss controls. Verify desktop 1440, laptop 1280, tablet 768, mobile 390, open inspector, open Brain, modal, generation overlay, German, and browser text at 200%. Dark shadows/borders must not change box dimensions.

## 19. Third-party and browser-rendered surfaces

- **Confirmed native:** dialog, selects/options, date/time/color inputs, file-related controls, validation UI, autofill, scrollbars. Root `color-scheme` plus targeted semantic overrides is required.
- **Confirmed auth boundary:** the app redirects to `/api/auth/google/start` (`app.js` around line 16409); no embedded provider widget styling is evidenced. Theme only Funklix login/account surfaces; external provider UI remains provider-controlled.
- **Confirmed images:** avatars, logos, generated campaign images remain content and must not be inverted/filtered.
- **Not found:** embedded content, chart package/widget, or third-party icon library. Future charts should consume categorical semantic palettes; this audit does not create absent charts.

## 20. CSS dependency and blast-radius analysis

### Selector/cascade risks

- Broad `body`, `button`, form element, SVG path, `.hidden`, `.active`, `.selected`, `.error`, and `.warning` changes can affect unrelated generations of UI.
- Exact-child selectors and feature nesting encode DOM hierarchy; retain markup order and wrappers.
- Inline HTML CSS follows the stylesheet and wins by order; its ID selectors and `!important` visibility rules are compatibility-critical.
- JS toggles hundreds of classes and constructs classes for nodes, status, AI review, campaign phases, views, selection, search, collaboration and modals (`app.js` `.classList`/`.className` writes). Static class inventory tests must include template literals.
- Generated inline styles mix geometry (must remain) and presentation (candidate for custom properties). A blanket CSP/style-attribute prohibition would break Canvas.
- Regression scripts inspect source strings, IDs, functions, and boot registration. Browser integrity and Runtime Boot Safety must be updated deliberately, never bypassed.

### Behavior-sensitive properties

Do not alter Canvas/world width/height/position/transform/overflow, node absolute positioning, drag pointer capture, SVG pointer events, inspector shell width/scroll, toolbar grid/overflow, modal display/stacking, AI Brain closing classes, autosave/dirty state, or selection opacity as incidental cleanup. Theme switching must touch only preference/UI presentation and must never call Board update/save/render mutation paths.

## 21. File-by-file blast-radius table

| File | Future BW-27 touch | Main risk | Required guard |
|---|---|---|---|
| `styles.css` | Tokens, theme maps, normalized components, Canvas/AI/forms/responsive/a11y | Cascade/source order, geometry, duplicated selectors, `!important`, animations | Static token/literal checks, computed visual matrix, reduced motion, no layout-property drift in protected selectors. |
| `index.html` | Early bootstrap reference/script, Appearance setting, tokenization/migration of inline rules | Wrong-theme flash, inline cascade, stable IDs, integrity registration | Existing ID inventory; bootstrap executes before CSS; integrity test; no removed/renamed IDs. |
| `app.js` | Preference controller/reconciliation; additive component classes/custom properties for visual literals | 17,896-line monolith; Board dirty/autosave; Canvas rendering; Brain lifecycle; auth switching | Theme-specific isolated functions; Board/state deep snapshots; BW-21/25/26 suites; no refactor. |
| `language.js` | English/German theme strings if architecture remains appropriate | Mutating language preference schema or campaign separation | BW-21 separation assertions; theme never changes language fields. |
| `scripts/check-bw27-design-system-dark-mode.js` | New regression suite | False confidence from source-only checks | Combine static architecture checks with DOM/runtime harness where project tooling permits. |
| `scripts/check-browser-script-integrity.js` | Register/validate early bootstrap | Security regression or rejected script | Fail closed on unexpected browser scripts; retain all existing registrations. |
| `package.json` | Add `check:bw27` | Accidental script/dependency churn | One script entry; no new dependency unless justified. |
| account settings/API files (exact route unresolved) | Optional global account preference | Authorization/account leakage, cross-browser semantics | Authenticated ownership, enum validation, no Board/Brand schema writes, failure fallback. |
| existing BW-21/25/26 scripts | Normally unchanged; run as regressions | Brittle source assertions after additive theme markup/classes | Prefer adapting only assertions genuinely affected; preserve product contracts. |

## 22. Open product decisions — recommendations

| Decision | Recommendation | UX reasoning | Technical/persistence impact | Risk |
|---|---|---|---|---|
| Default | **System** | Honors user environment on first visit and makes complete Dark Mode useful without setup. | Default preference `system`; resolved theme remains separate/dynamic. | Medium: demands prepaint bootstrap and OS listener. |
| Selector placement | **Settings plus compact quick toggle** | Discoverable full choice plus efficient frequent switch; premium tools commonly need Canvas-side access. | Settings owns three-way preference; toolbar quick control invokes same controller. | Medium: toolbar is crowded/overflow-sensitive. Hide quick toggle at narrow widths rather than remove its stable hook. |
| Quick toggle | **Open theme menu** | A binary toggle obscures System; cycling is unpredictable and hard to label. | Anchored menu with Light/Dark/System and checked state; no reload. | Medium: another popover layer; reuse existing menu/a11y patterns. |
| Follow account across browsers | **Yes, when account preferences are available** | Theme is user-level, not device content or Board content. | Authenticated account field wins after session load; local cache prevents flash. | Medium/high because no current API is confirmed; use adapter/fallback, not Board storage. |
| Signed-out retention | **Yes, locally** | Avoids repeated choice and theme flash. | Versioned local preference, storage-event sync. | Low; validate enum and catch storage denial. |
| Public Viewer | **Viewer local preference, falling back to System** | Theme is a viewing accessibility preference; Board owner should not impose it. | Never enters Board payload; signed-out local key applies. | Low; ensure viewer boot shares root theme. |
| Node role colors | **Dark variants, same semantic mapping** | Identical Light hex values can glare or lose contrast on dark surfaces; meaning must remain stable. | Theme-specific role custom properties; no node data migration. | High visual risk; test pairwise distinguishability and selection/status overlays. |
| Dark Canvas grid | **Retain, slightly restrained** | Spatial orientation remains essential, but a bright grid creates noise. | Theme grid token only; preserve size/algorithm. | Medium: too faint harms navigation; validate at zoom extremes. |

## 23. Recommended combined implementation scope

One BW-27 PR should include:

1. semantic color/layout/type/motion tokens and compatibility aliases;
2. visually equivalent Light map and complete Dark map;
3. global Light/Dark/System preference, root resolved theme, OS/storage listeners, Settings field and compact menu;
4. safe local persistence and account preference integration if the authenticated global settings boundary is available;
5. prepaint theme bootstrap registered with browser-script integrity;
6. shell, navigation, toolbar, search, menus, buttons, fields, cards, typography and avatar normalization;
7. Canvas background/grid/nodes/roles/status/connectors/edges/comments/selection/zoom and inspector/AI Review theming without behavior changes;
8. AI Brain, Insights, generation, dialogs, overlays, dashboard, Boards, Brand Workspace/Core/comparison, auth and Public Viewer theming;
9. English/German system-owned theme strings and cleanup of touched Denglisch while preserving `uiLanguage`/`campaignLanguage` separation;
10. accessibility, reduced-motion, forced-colors, native-control, responsive and regression coverage.

**No ordinary visible surface should be deferred.** External provider pages and absent charts/minimap are outside app control/not present. Print theming may be deferred only if print/export is confirmed unsupported; account cross-browser sync may degrade to local-only only if no safe authenticated preference API exists, with the limitation explicit in implementation notes.

## 24. Internal implementation stages in one PR

1. **Foundation:** semantic tokens, compatibility aliases, Light parity, contrast tooling; no intentional visual change.
2. **Theme state/boot:** preference-versus-resolution functions, root attribute, System listener, local/account reconciliation, Settings/menu strings, early bootstrap and integrity registration.
3. **Core UI:** shell, navigation, toolbar, search, menus, forms, buttons, typography, avatars, dashboard/Boards/auth.
4. **Canvas:** backdrop/grid, role palettes, nodes, edges, connectors, chips, selection, comments, inspector and AI Review; preserve protected behavior properties.
5. **AI/secondary UI:** Brain/transcript/proposals, Insights, generation, Brand surfaces, dialogs/overlays/Public Viewer.
6. **Hardening:** responsive/German/200% text, contrast/focus/forced colors/reduced motion, automated regression, local visual comparison and cleanup of compatibility literals only where proven safe.

These are reviewable commits or work stages within one implementation PR, not separate product PRs.

## 25. Proposed regression coverage

Create `scripts/check-bw27-design-system-dark-mode.js` and `check:bw27`. It should use source assertions plus a minimal DOM/runtime harness (or the repository's established VM stubs) to cover:

1. `light`, `dark`, `system` are the only valid preferences.
2. preference exists only in global UI/account storage, never Board serialization.
3. resolved theme is applied to `document.documentElement[data-theme]`.
4. System resolves both media-query outcomes.
5. an OS change updates active theme in System.
6. explicit Light/Dark ignore later OS changes.
7. account switching re-reads/reconciles preference without leakage.
8. sign-out retains defined local behavior.
9. head bootstrap precedes stylesheet and matches runtime resolution.
10. switching does not navigate/reload.
11. Board state deep-equals before/after.
12. dirty state is unchanged.
13. autosave/save calls remain zero.
14. `uiLanguage` is unchanged.
15. `campaignLanguage` is unchanged.
16. AI Brain history deep-equals before/after.
17. Canvas nodes/edges deep-equal before/after.
18. captured existing DOM-ID manifest remains present.
19. minimum semantic token contract exists in Light and Dark.
20. every major-surface selector consumes semantic tokens.
21. migrated rules introduce no unapproved theme color literals.
22. each Canvas role has Light and Dark role tokens.
23. selected node has fill/border or ring distinction in both themes.
24. inputs have distinct surface/border/text tokens.
25. disabled controls have non-color/semantic identification.
26. `:focus-visible` exists for canonical interactive variants.
27. success/warning/danger/info each have solid/subtle roles and labels remain.
28. BW-26 safe formatted-content rendering assertions still pass.
29. inspector protected layout declarations/IDs remain.
30. modal/overlay layer ordering remains valid.
31. generation active/completed/pending surfaces consume readable tokens.
32. key German control strings/wrapping rules do not exceed tested containers.
33. reduced-motion disables all new nonessential motion.
34. `check-bw21-language-separation.js` remains compatible.
35. BW-25 Insights checks remain compatible.
36. BW-26 through BW-26.6.2 suites remain compatible.
37. `check-browser-script-integrity.js` passes and knows the bootstrap.
38. Runtime Boot Safety's element/script registration includes every new required hook.

Also add automated contrast-pair assertions for proposed text/surface, state/subtle, primary/button and focus/background pairs. Static token presence alone cannot prove accessibility.

### Concise post-merge visual matrix

| View/state | Widths | Themes | Verify |
|---|---|---|---|
| First boot, login/account, dashboard, Public Viewer | 1440, 390 | Light, Dark, System matching both OS modes | No wrong-theme flash; readable shell; preference continuity. |
| Canvas populated + empty; zoom min/default/max; selected/dragged/collapsed/disconnected nodes; comments and AI Review | 1440, 1280, 768 | Light/Dark | Grid, all roles, edges, selection, post-its, controls; no geometry/interaction change. |
| Inspector with text/select/textarea/file/native date states, validation/disabled/read-only | 1280, 768, 390 | Light/Dark | Editable surfaces, focus, native popup, scroll, no overlap. |
| AI Brain transcript/Markdown/proposal success+error, AI Insights scores, generation active/completed/error | 1440, 390 | Light/Dark + reduced motion | Avatar prominence, formatted content, state distinctions, dismiss controls, motion. |
| Boards, Brand Workspace/Core/comparison, Settings/theme menu, share/filter/tools popovers, dialogs | 1440, 768, 390 | Light/Dark | Unified components, stacking, focus return, avatar/image treatment. |
| German UI and 200% browser text | 1280, 390 | Light/Dark | No clipped primary controls; wrapping/scroll; no Denglisch in touched system UI. |

## 26. Open questions

1. **Unresolved infrastructure decision:** Is there an authenticated global account-preferences endpoint/schema intended for non-language UI settings? Static code confirms none in the current client contract.
2. **Unresolved integrity decision:** Will the existing browser script integrity policy accept a minimal inline head bootstrap, or should it be a separately registered synchronous file? Decide by extending—not weakening—`scripts/check-browser-script-integrity.js`.
3. **Unresolved support decision:** Is browser print/export an officially supported Canvas workflow? No explicit print/export styling was found.
4. **Unresolved visual validation:** Candidate tokens require computed WCAG pair validation and visual testing across actual node role palette values before freeze.
5. **Unresolved responsive placement:** At what narrow width should the compact theme menu hook hide from the toolbar while Settings remains available? Base the answer on the existing 1200px toolbar and 860/600px shell behavior, not a new layout redesign.

## 27. Implementation go/no-go criteria

### GO when

- Light token aliases demonstrate baseline parity before intentional normalization.
- Preference and resolved theme are separate, global, validated, and never serialized with Board/Brand/URL state.
- The bootstrap strategy passes browser script integrity and applies before CSS paint.
- Theme switching has zero Board dirty/autosave/Canvas/AI-history effects.
- Dark token pairs meet AA targets where practical, and all node roles/status/selection remain distinguishable.
- Stable DOM IDs, runtime boot registrations, Canvas geometry/pointer behavior, inspector width/scroll, and modal order are protected by tests.
- All requested ordinary surfaces ship together and all BW-21, BW-25, BW-26 through BW-26.6.2 checks pass.

### NO-GO / stop conditions

- Theme preference can only be implemented by placing it in Board or Brand state.
- The chosen bootstrap requires weakening script integrity/security boundaries.
- Dark node palettes cannot preserve role distinction and AA-readable text after measured iteration.
- Theme switching invokes render/save paths that mutate nodes, edges, Brain history, dirty state, or autosave.
- Component normalization requires removing/renaming stable IDs or changing Canvas/AI/auth behavior.
- A required major surface remains hard-coded Light without a documented, demonstrated external-control exception.

## 28. Final recommendation

Proceed with one combined BW-27 implementation PR using root `data-theme`, System as default preference, Settings plus a compact menu, local signed-out retention, account sync when a safe global preference API is available, and viewer-local/System behavior. Establish semantic tokens and compatibility aliases first, then migrate every visible surface in internal stages. Give Canvas roles Dark-specific presentation while preserving their mapping, retain a restrained grid, and protect all geometry/state boundaries. The existing foundation is sufficient to evolve safely; wholesale CSS rewriting, DOM cleanup, and `app.js` refactoring would add risk without being necessary for a complete, premium Light/Dark design system.
