# Funklix UI / Design System Migration Audit

| Field | Value |
|---|---|
| Date | 2026-07-06 |
| Type | Documentation-only UI / Design System migration audit |
| Scope | Product-wide UI surfaces, component adoption, and future migration plan |
| Runtime behavior changes | None |
| Files changed | `docs/audits/2026-07-06-ui-design-system-migration-audit.md` |

## Documents Read

- `docs/constitution/design-constitution.md`
- `docs/constitution/engineering-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-components-foundation-audit.md`
- `docs/audits/2026-06-26-dashboard-design-migration-audit.md`
- `docs/audits/2026-06-27-sidebar-navigation-foundation-audit.md`
- `docs/audits/2026-06-27-top-toolbar-controls-foundation-audit.md`
- `docs/audits/2026-06-27-inspector-ui-migration-audit.md`
- `docs/audits/2026-06-27-activity-feed-migration-audit.md`
- `docs/audits/2026-06-28-brand-switcher-shell-audit.md`
- `docs/audits/2026-06-28-sidebar-hierarchy-polish-audit.md`
- `index.html`
- `styles.css`
- `app.js`
- `campaign-v3.js`

## Runtime Confirmation

This audit is documentation only.

No runtime files were modified. Specifically, this audit does not modify:

- `app.js`
- `campaign-v3.js`
- `index.html`
- `styles.css`
- API files
- save/load
- autosave
- routing
- Canvas behavior
- Dashboard behavior
- Brand Core behavior
- AI Brain behavior
- Insights behavior
- Boards behavior

---

## A. Executive Summary

Funklix now has a clear design direction and an initial reusable component layer, but adoption is uneven. The highest-maturity areas are the Dashboard, persistent sidebar navigation, top toolbar, Activity Feed shell, Inspector static fields, and Campaign Generator modals. The largest remaining visual debt is concentrated in Boards / My Boards, Brand Core, AI Brain, Insights, popover internals, dynamically generated dialogs, and responsive/theme/localization readiness.

### Design maturity score by area

| Area | Score | Current maturity |
|---|---:|---|
| Dashboard / Mission Control | 7.5 / 10 | Strong `.fk-*` adoption in main cards and actions; remaining polish in placeholder sections, Team Activity, Live Campaigns, and responsive density. |
| Sidebar / Brand Switcher / Activity Feed | 7 / 10 | Foundation is modernized; Brand Switcher is a static shell; Activity Feed is scoped and calmer, but menu/dropdown semantics remain immature. |
| Top Toolbar | 6.5 / 10 | Visible toolbar controls use many `.fk-*` primitives, but inline CSS, filter/utility popovers, status chips, and responsive overflow still need cleanup. |
| Inspector | 6.5 / 10 | Static sections and fields have migrated; generated image controls and action hierarchy remain partly legacy. |
| Campaign Generator modals | 7 / 10 | V3 and legacy builder modals use `.fk-*` primitives in their main form structure; loading/error/completion sub-states still use specialized patterns. |
| Boards / My Boards | 3 / 10 | Uses inline page styles, legacy `primary-add`, `.icon-btn`, bespoke chips, custom rows, and incomplete empty-state/action hierarchy. |
| Campaign Canvas | 4.5 / 10 | Core Canvas should remain protected; shell controls are partly modernized, but zoom controls, node cards, connection controls, empty canvas, and responsive behavior remain legacy/specialized. |
| Brand Core | 3.5 / 10 | Dynamic editor and Brand DNA surfaces use many bespoke classes, buttons, inputs, cards, and empty/loading patterns. |
| AI Brain | 3 / 10 | Dynamically generated cards/actions do not use reusable primitives and need AI-specific component guidance. |
| Insights | 3 / 10 | Cards and recommendation actions are dynamically generated and bespoke; analytics-ready empty/loading/filter patterns are not established. |
| Settings | 1 / 10 | No meaningful Settings shell is present; future account, workspace, brand, language, output-language, and theme preferences need a planned surface. |
| Modals / confirmations / share | 4 / 10 | Campaign builder is strongest; conflict/reset/Brand confirmations and share editor remain bespoke. |
| Popovers / menus | 3 / 10 | Filters, Utilities, and Brand Switcher placeholder menus are inconsistent and use hardcoded positioning/colors. |
| Theme readiness | 4 / 10 | `--fk-*` tokens exist, but many hardcoded colors and rgba values remain in inline styles and dynamic UI. |
| Language / localization readiness | 2 / 10 | UI strings are hardcoded across static HTML and generated JavaScript; document language is German while much UI is English/German mixed. |

### Biggest remaining inconsistencies

1. **Boards / My Boards is the most visible non-migrated product surface.** It uses inline CSS in `index.html`, legacy `primary-add`, custom `.icon-btn`, bespoke row/card styling, and custom ownership chips.
2. **Dynamic JavaScript-rendered UI bypasses the component foundation.** AI Brain, Insights, Brand Core editor controls, generated confirmation modals, share editor rows, filter menus, utility menus, and board rows create buttons/cards/inputs without `.fk-*` classes.
3. **Empty states are not consistent.** Some states provide only a headline and description, while the required pattern should be headline, description, and one clear action when an action is available.
4. **Loading and status patterns remain fragmented.** Campaign V3 has rich loading states, while board loading, AI response loading, share/editor loading, Brand Brain generation, autosave, read-only, warnings, and errors use unrelated visual treatments.
5. **Theme readiness is blocked by hardcoded colors.** Inline styles and generated markup use direct hex/rgba values, which will make dark mode and theme switching fragile.
6. **Localization readiness is low.** UI strings are hardcoded in static HTML and JavaScript templates, with a mix of German and English labels.

### Highest priority visual debt

1. Boards / My Boards design migration.
2. Brand Core form/editor and Brand DNA component migration.
3. AI Brain and Insights dynamic card/action migration.
4. Modal and popover consistency cleanup.
5. Product-wide empty/loading/status pattern standardization.
6. Theme-token and localization-readiness documentation before implementation.

---

## B. Surface Inventory

| Surface | Current adoption level | Evidence / notes | Migration risk |
|---|---|---|---|
| Dashboard / Mission Control | High | Dashboard hero, primary actions, cards, badges, and continue-working surfaces already use `.fk-section`, `.fk-card`, `.fk-card-header`, `.fk-badge`, and `.fk-btn`. | Low |
| Live Campaigns | Medium | Static Dashboard card area exists but remains placeholder-oriented and needs final empty/action pattern. | Low |
| Team Activity | Medium | Static Dashboard card area exists; Activity Feed separately improved, but Dashboard Team Activity itself is still placeholder-like. | Low |
| Boards / My Boards | Low | Static page uses inline `.boards-*` styles, `primary-add`, bespoke `.board-row`, `.board-row-chip`, `.icon-btn`, and dynamic row HTML. | Medium |
| Campaign Canvas shell | Medium | Persistent toolbar has partial `.fk-*` adoption, but Canvas internals and zoom controls remain specialized. | High |
| Canvas node cards | Low-medium | Nodes are core runtime/Canvas behavior and should only be migrated after a dedicated Canvas node audit. | High |
| Connection controls | Low | Edge/connection affordances are behavior-sensitive and should not be visually refactored without Canvas-specific QA. | High |
| Inspector | Medium-high | Static form fields use `.fk-input`, `.fk-select`, `.fk-textarea`, and section cards; generated image/action controls still vary. | Medium |
| Brand Core | Low | Static shell and dynamic editor use bespoke `brand-*`, `bc-*`, and Brand DNA markup. | Medium |
| AI Brain | Low | Generated cards/actions use `ai-*` classes and plain buttons. | Medium |
| Insights | Low | Generated analytics cards/actions use `insight-*` classes and plain buttons. | Medium |
| Settings | Missing | No Settings shell or nav item exists in the current product shell. | Low-medium |
| Campaign Generator modal | High | V3 and legacy generator forms use `.fk-section`, `.fk-card`, `.fk-input`, `.fk-select`, `.fk-textarea`, and `.fk-btn`. | Medium |
| Legacy Campaign Builder modal | High | Uses `.fk-*` primitives, but still has specialized cards/steppers and loading sub-states. | Medium |
| Conflict/save-as-new modals | Low | Generated `brand-confirm-card` confirmations use plain buttons and bespoke classes. | Medium-high |
| Share/copy editor modals/panels | Low | Share editor uses plain input/button/status rows generated in JavaScript. | Medium |
| Filter menu | Low | Buttons are generated without `.fk-btn`; popover uses hardcoded background/border/shadow. | Medium |
| Utilities menu | Low | Buttons are generated without `.fk-btn`; menu combines board actions, view actions, and canvas layout actions. | Medium |
| Brand switcher placeholder menu | Medium | Static shell is polished, but placeholder menu semantics and future real switcher behavior are not designed. | Low-medium |
| Buttons | Medium | Foundation exists and many static buttons migrated; dynamic buttons remain inconsistent. | Medium |
| Inputs / forms | Medium | Inspector and campaign modals are strong; Boards rename, share editor, Brand Core dynamic editor, and popover inputs remain legacy. | Medium |
| Cards / surfaces | Medium | Dashboard and campaign modals are strong; board rows, AI cards, Insights cards, Brand Core tiles, confirmations remain bespoke. | Medium |
| Empty states | Medium-low | Empty states exist but are inconsistent and often lack one clear action. | Low-medium |
| Loading states | Medium-low | Campaign generation is strongest; board/AI/share/loading skeleton strategy is missing. | Medium |
| Notifications / status | Medium-low | Save/read-only/share/status labels exist, but status component hierarchy is fragmented. | Medium |
| Responsive / layout | Medium-low | Toolbar has breakpoints; Boards and Dashboard have partial handling; Canvas/Inspector/modals/mobile remain high-risk. | High |
| Theme readiness | Medium-low | Tokens exist; hardcoded colors remain common. | Medium |
| Language / localization readiness | Low | Hardcoded strings and mixed language labels exist across HTML and JavaScript. | Medium |

---

## C. Legacy Component Inventory

This inventory identifies likely remaining legacy or inconsistent components. It does not prescribe implementation details beyond future migration planning.

### Buttons

Likely remaining non-`.fk-btn` buttons include:

- Boards create button: `#boards-create-btn` still uses `primary-add boards-create-btn`.
- Board row icon actions: `.icon-btn` for open, copy, rename, delete, move up/down, and claim.
- Board rename buttons generated inside `.board-rename`.
- Floating Canvas zoom buttons: `#zoom-out-btn` and `#zoom-in-btn`.
- Calendar navigation buttons.
- Reset Brand Core button.
- Brand Core dynamic editor buttons.
- Brand DNA accept/refine/regenerate/avatar buttons.
- AI Brain quick action buttons and suggested-node buttons.
- Insights suggested-node buttons.
- Filter menu buttons.
- Utility menu buttons.
- Share editor invite/remove buttons.
- Conflict, reset, and Brand confirmation modal buttons.
- Image lightbox close button.
- Post-it reply send button.

### Inputs / forms

Likely remaining non-`.fk-input` / `.fk-select` / `.fk-textarea` controls include:

- Board rename input.
- Share editor email input.
- Brand Core custom tile inputs/textareas.
- Brand Core dynamic editor list inputs, domain/logo/typography/color/persona/tag fields.
- Post-it reply textarea.
- Filter/search controls inside future popovers, if expanded.
- Checkbox/toggle fields in campaign builders are visually specialized and may need a documented toggle primitive.

### Cards / surfaces

Likely remaining non-`.fk-card` surfaces include:

- Board rows and board empty state.
- AI Brain summary/list/action cards.
- Insights metric and suggestion cards.
- Brand Core canvas nodes/tiles.
- Brand DNA card, score cards, avatar preview, blocks, signals, and empty/loading cards.
- Conflict/reset/Brand confirmation cards.
- Share editor rows and statuses.
- Filter and Utility popovers.
- Canvas empty state and floating zoom surface.
- Node cards and connection affordances.

### Modals / overlays

- Campaign Generator V3 and legacy builder are mostly migrated, but loading, completion, and error states are still specialized.
- Board conflict/save-as-new modal uses `brand-confirm-card` and plain buttons.
- Reset board and Brand apply-suggestions confirmations use the same legacy confirmation pattern.
- Share/copy UI appears as toolbar/panel/toast/editor patterns rather than a unified dialog/menu/status family.
- Image lightbox uses bespoke close button and image shell.

### Menus / popovers

- Filters popover uses inline/topbar CSS, hardcoded colors, absolute positioning, and plain generated buttons.
- Utilities popover uses plain generated buttons and mixes unrelated action groups.
- Brand Switcher placeholder menu is visually polished but intentionally temporary and not yet a reusable menu pattern.
- Native/select dropdowns and custom menus do not share one documented interaction/visual model.

### Status / notification patterns

- Save status, share feedback, read-only notice, board access chip, activity count, Brand DNA status, AI refresh state, generator status/error, and conflict/warning states do not yet share one status taxonomy.
- Success, warning, danger, loading, disabled, read-only, and ownership states should map to reusable badge/notice/toast patterns.

---

## D. Risk / Blast Radius

| Area | Risk | Blast radius rationale |
|---|---|---|
| Dashboard polish | Low | Mostly static Dashboard-specific markup/styles; existing runtime state should be read-only. |
| Boards / My Boards | Medium | Board rows are generated in `app.js`; IDs/data attributes drive open/copy/rename/delete/claim/reorder behavior. Class additions are possible, but generated actions require careful preservation. |
| Campaign Canvas shell | High | Canvas is core product; visual changes can affect hit areas, zoom, drag/drop, scroll, edge rendering, and inspector interactions. |
| Canvas node cards | High | Node rendering is behavior-sensitive and tied to selection, drag, context, connections, save/load, and generated content. |
| Brand Core | Medium | Dynamic editor is generated by JavaScript and interacts with stored Brand Brain state; visual migration can be safe if IDs/events are preserved. |
| AI Brain | Medium | Generated dynamic surface; recommendations can create nodes, so action data attributes and event delegation must remain intact. |
| Insights | Medium | Generated analytics surface; suggested-node actions are behavior-sensitive. |
| Settings shell | Low-medium | New static shell can be low risk if it is placeholder/documentation-like, but adding navigation/routing raises risk. |
| Modals / confirmations | Medium-high | Dialogs often gate destructive/save/conflict flows; button identity/order/labels must not change accidentally. |
| Popovers / menus | Medium | Positioning and event delegation depend on current button bounds and generated data attributes. |
| Buttons | Medium | Broad button CSS can unintentionally affect Canvas, toolbar density, modals, and dynamic controls. |
| Inputs / forms | Medium | Form field class changes are safe only if names/IDs/value flows/autosave listeners remain unchanged. |
| Empty states | Low-medium | Usually visual/content-only, but CTA wiring must be preserved. |
| Loading states | Medium | Loading UI often indicates async state; must not change state flags or disable/enable behavior. |
| Notifications/status | Medium | Status UI communicates permission/save/conflict; visual changes must preserve semantics. |
| Responsive/layout | High | Layout changes can alter toolbar overflow, inspector width, Canvas viewport, modal usability, and sidebar collapse. |
| Theme readiness | Medium | Tokenization is mostly CSS-safe, but broad color replacement can cause contrast regressions. |
| Language readiness | Medium | String extraction can touch many generated templates and must not alter data/content language behavior. |

---

## E. Recommended Migration Order

Based on actual code findings, the safest and highest-value sequence is:

1. **Boards / My Boards Design Migration**
   - Highest visible debt, relatively isolated surface, and strong candidate for `.fk-card`, `.fk-btn`, `.fk-input`, and `.fk-badge` adoption.
2. **Brand Core Design Migration**
   - Important Brand product surface with many bespoke editor controls, Brand DNA cards, avatar area, empty/loading states, and upload/reference areas.
3. **AI Brain Design Migration**
   - Needs consistent AI-specific cards, response states, prompt/action buttons, loading, and context panels.
4. **Insights Design Migration**
   - Establish future analytics card, filter, empty-state, and recommendation patterns.
5. **Settings Shell Audit + Placeholder Shell**
   - Add a planned shell only after audit, covering account, workspace, brand preferences, interface language, output language, theme/dark mode, and accessibility/preferences.
6. **Modals / Confirmation / Share Cleanup**
   - Standardize confirmation cards, headers, footers, overlays, danger/secondary/primary hierarchy, spacing, and status messaging.
7. **Popover / Menu Cleanup**
   - Standardize Filters, Utilities, Brand Switcher menu, dropdowns, z-index, positioning, keyboard/focus expectations, and menu item styles.
8. **Responsive Polish Pass**
   - Address dashboard, boards, toolbar, inspector/canvas, and modal responsive behavior after component migration reduces visual variance.
9. **Theme Readiness Pass**
   - Replace hardcoded colors with tokens in scoped areas, starting with migrated surfaces.
10. **Language / Localization Readiness Pass**
   - Document and then extract UI strings separately from generated content language.
11. **Campaign Canvas Node/Zoom/Connection Audit**
   - Perform only after lower-risk surfaces are stable. Implementation should be separate from this migration wave.

---

## F. Suggested PR Plan

### PR 1: Boards / My Boards Design Migration

- **Purpose:** Modernize Boards list shell, board rows/cards, ownership/status chips, create/rename/delete/copy/reorder actions, empty state, and responsive layout.
- **Files likely affected:** `index.html`, `styles.css`, `app.js`, audit doc for Boards migration.
- **Expected risk:** Medium.
- **What not to touch:** save/load, autosave, board API calls, ownership logic, share/copy logic, routing, Canvas state, board IDs/data attributes.
- **Manual QA checklist:**
  - Boards view opens from sidebar.
  - Empty state appears when no boards exist and has headline, description, one clear action.
  - Create New Board still works.
  - Open/copy/rename/delete/move/claim actions still work.
  - Owner/shared/copy chips still reflect current state.
  - Rename save/cancel still works.
  - Narrow viewport does not overflow horizontally.

### PR 2: Brand Core Static Shell + Editor Controls Audit

- **Purpose:** Audit and migrate Brand Core shell, side panel, editor forms, reset action, Brand Brain state, knowledge tiles, and empty states.
- **Files likely affected:** `index.html`, `styles.css`, `app.js`, Brand Core audit doc.
- **Expected risk:** Medium.
- **What not to touch:** Brand Core data model, generated Brand Brain behavior, saved Brand state, AI calls, upload behavior, Brand DNA logic.
- **Manual QA checklist:**
  - Brand Core opens.
  - Selecting knowledge tiles still populates editor.
  - Text/list/domain/persona/color editors still save correctly.
  - Reset confirmation still behaves as before.
  - Empty and loading states remain understandable.

### PR 3: Brand DNA / Avatar / Reference Areas

- **Purpose:** Standardize Brand DNA result cards, score tiles, avatar area, loading state, empty state, and action buttons.
- **Files likely affected:** `styles.css`, `app.js`, Brand DNA audit doc.
- **Expected risk:** Medium.
- **What not to touch:** Brand DNA generation, accept/refine/regenerate state, avatar generation APIs, approved result state.
- **Manual QA checklist:**
  - Generate/refine/regenerate/accept still work.
  - Avatar generation/edit/accept still work.
  - Loading and empty states are visible and clear.

### PR 4: AI Brain Components

- **Purpose:** Create consistent AI summary, issue, suggestion, prompt/action, response, context, empty, and loading card patterns.
- **Files likely affected:** `styles.css`, `app.js`, AI Brain audit doc.
- **Expected risk:** Medium.
- **What not to touch:** analysis generation, suggestion IDs, create-node actions, AI API calls, state refresh flags.
- **Manual QA checklist:**
  - Refresh analysis still works.
  - Loading/disabled refresh state still works.
  - Suggested node creation still works.
  - Empty/error states are clear.

### PR 5: Insights Analytics Surface

- **Purpose:** Migrate insights cards, future filter area, empty states, suggested next steps, and analytics readiness patterns.
- **Files likely affected:** `styles.css`, `app.js`, Insights audit doc.
- **Expected risk:** Medium.
- **What not to touch:** analysis data, recommendation IDs, create-node actions, Campaign Canvas state.
- **Manual QA checklist:**
  - Insights view opens.
  - Metrics render correctly.
  - Suggested next-step buttons still create nodes.
  - Empty state appears when analysis is unavailable.

### PR 6: Settings Shell Audit + Non-functional Placeholder

- **Purpose:** Define and optionally introduce a safe Settings shell for account/workspace/brand preferences, UI language, content output language, theme/dark mode, and future preferences.
- **Files likely affected:** `index.html`, `styles.css`, `app.js` only if routing/nav is intentionally added, Settings audit doc.
- **Expected risk:** Low-medium.
- **What not to touch:** authentication, workspace persistence, Brand Core behavior, generated content language, theme runtime switching unless separately audited.
- **Manual QA checklist:**
  - Existing nav still works.
  - Settings placeholder is clearly non-functional if no settings behavior exists.
  - No persisted preferences are written.

### PR 7: Confirmation Modals + Share Editor Cleanup

- **Purpose:** Standardize confirmation overlays, headers, body copy, footer action hierarchy, danger buttons, share editor rows, invite/remove controls, and statuses.
- **Files likely affected:** `styles.css`, `app.js`, modal/share audit doc.
- **Expected risk:** Medium-high.
- **What not to touch:** conflict resolution logic, reset behavior, Brand apply behavior, invite/remove editor behavior, copy-link behavior.
- **Manual QA checklist:**
  - Board conflict load/save-as-new/cancel still works.
  - Reset board confirmation still works.
  - Apply Brand suggestions confirmation still works.
  - Share invite/remove/status flows still work.

### PR 8: Popovers / Menus Cleanup

- **Purpose:** Standardize Filters, Utilities, Brand Switcher placeholder/future menu, dropdown/select consistency, z-index, positioning, focus-visible, and menu item hierarchy.
- **Files likely affected:** `index.html`, `styles.css`, `app.js`, popover audit doc.
- **Expected risk:** Medium.
- **What not to touch:** filter logic, utility actions, board view/list/calendar switching, fit/arrange/compact/expand behavior, Brand switching behavior.
- **Manual QA checklist:**
  - Filters open/close and apply correctly.
  - Utilities actions still execute correctly.
  - Menus position correctly near triggers.
  - Menus do not hide behind Canvas/Inspector/modals.

### PR 9: Responsive Layout Polish

- **Purpose:** Normalize behavior at tablet/low-width sizes for sidebar collapse, Dashboard, Boards, toolbar, inspector/canvas, and modals.
- **Files likely affected:** `styles.css`, possibly `index.html`, responsive audit doc.
- **Expected risk:** High.
- **What not to touch:** Canvas coordinate math, drag/drop, zoom state, routing, save/load, autosave.
- **Manual QA checklist:**
  - Sidebar collapse still works.
  - Top toolbar does not overlap/clip required controls.
  - Boards cards stack cleanly.
  - Inspector remains usable.
  - Modals fit viewport.

### PR 10: Theme Readiness Tokens

- **Purpose:** Audit hardcoded colors and migrate scoped surfaces to token usage in preparation for dark mode.
- **Files likely affected:** `styles.css`, `index.html` inline style cleanup if separately approved, theme audit doc.
- **Expected risk:** Medium.
- **What not to touch:** actual theme toggle behavior, Settings persistence, runtime dark-mode switching.
- **Manual QA checklist:**
  - Light theme remains unchanged or intentionally equivalent.
  - Contrast remains acceptable.
  - No Canvas/node legibility regressions.

### PR 11: Language / Localization Readiness

- **Purpose:** Document UI language vs generated content output language, identify hardcoded strings, and prepare string ownership strategy.
- **Files likely affected:** docs first; implementation later may touch `index.html` and `app.js`.
- **Expected risk:** Medium.
- **What not to touch:** AI output prompts/content language behavior until a dedicated content-language implementation exists.
- **Manual QA checklist:**
  - UI labels remain unchanged if documentation-only.
  - Generated content language remains unchanged.

### PR 12: Campaign Canvas Controls / Node UI Audit

- **Purpose:** Dedicated high-risk audit for zoom controls, node cards, edge/connection controls, toolbar interaction points, inspector interactions, empty Canvas, and responsive Canvas behavior.
- **Files likely affected:** docs first; implementation likely `styles.css`, `index.html`, `app.js` only after audit.
- **Expected risk:** High.
- **What not to touch:** save/load, autosave, node/edge data model, drag/drop math, zoom transforms, generation pipeline.
- **Manual QA checklist:**
  - Node selection, drag, edge rendering, zoom, fit, inspector updates, save/load, and autosave all pass.

---

## G. Design Principles Gaps

A separate design principles / component usage document is recommended before broad implementation continues. The current Design Constitution defines philosophy well, and the Design System README defines foundation direction, but the product now needs usage rules for recurring patterns.

Recommended new document:

`docs/design-system/component-principles.md`

Suggested contents:

1. **Card usage**
   - When to use `.fk-card` vs `.fk-section` vs feature-specific surfaces.
   - Card anatomy: header, body, footer, metadata, actions.
   - Metric cards vs content cards vs action cards.
2. **Button hierarchy**
   - Primary, secondary, ghost, danger, icon-only, compact toolbar, destructive confirmation.
   - One primary action per surface rule.
   - Disabled/loading/focus-visible expectations.
3. **Empty states**
   - Required pattern: headline, description, one clear action.
   - When an empty state should be passive vs action-oriented.
4. **AI components**
   - AI response cards, prompt chips, suggested actions, loading/progress narration, confidence/status indicators.
   - How AI should feel collaborative and explain work.
5. **Brand components**
   - Brand Brain state, knowledge tiles, avatar area, Brand DNA score/result cards, reference/upload areas.
6. **Status states**
   - Success, warning, danger, info, read-only, saving, saved, failed, shared, owner/editor/viewer, loading.
7. **Loading states**
   - Spinner vs skeleton vs educational/progress loading.
   - Campaign Generator, AI response, Board loading, Brand Brain generation.
8. **Modal/dialog anatomy**
   - Overlay, card, header, body, footer, button order, danger positioning, dismissal rules, focus expectations.
9. **Popover/menu anatomy**
   - Trigger, menu positioning, item hierarchy, grouping labels, keyboard/focus behavior, z-index rules.
10. **Theme readiness**
    - Token usage rules, no hardcoded colors in migrated surfaces, contrast requirements.
11. **Language readiness**
    - Separate UI language from generated content output language.
    - Avoid embedding user-facing strings directly in future dynamic templates where practical.

---

## H. Immediate Next Recommended PR

The immediate next implementation PR should be:

**Boards / My Boards Design Migration**

### Why this should be first

- It is the highest-visibility surface with the lowest current design-system adoption among everyday product areas.
- It is more isolated than Campaign Canvas, Brand Core, AI Brain, or Insights.
- It provides a clear opportunity to standardize cards, icon buttons, status chips, empty states, and responsive behavior.
- It can be done safely if IDs, data attributes, event delegation, board ownership logic, copy/share logic, save/load, and routing remain untouched.

### Recommended first Boards scope

- Add `.fk-section` or `.fk-card` to the Boards shell/panel where safe.
- Convert `#boards-create-btn` to `.fk-btn .fk-btn-primary` while preserving ID and behavior.
- Convert board rows to a calmer card pattern without changing generated data attributes.
- Convert `.board-row-chip` to badge/pill-compatible status styling.
- Convert `.icon-btn` actions to a documented icon-button treatment, ideally scoped to Boards first.
- Convert board rename input/buttons to `.fk-input` and `.fk-btn` classes.
- Replace the empty state with the required pattern: headline, description, one clear action.
- Add responsive stacking rules for narrow widths.

### Explicit non-goals for first Boards PR

- Do not change board persistence.
- Do not change board ownership or access rules.
- Do not change share/copy behavior.
- Do not change create/delete/rename/reorder logic.
- Do not change Canvas state.
- Do not change routing.
- Do not change autosave/save/load.

---

## Audit Findings by Requested Area

### 1. Dashboard / Mission Control

- **Current status:** Strongest migrated product surface after earlier Dashboard work. Uses `.fk-*` primitives for hero, cards, badges, and buttons.
- **Remaining polish:** Placeholder cards need final empty-state/action treatment; Team Activity and Live Campaigns need richer state models; progress/status chips need final status taxonomy.
- **Team Activity:** Dashboard card is placeholder-like and separate from sidebar Activity Feed. It should eventually summarize meaningful collaboration updates, not duplicate the sidebar feed.
- **Live Campaigns:** Currently reads as a placeholder/no deployed campaigns area. Needs future deployed-campaign card pattern.
- **Empty states:** Mostly readable but should be normalized to headline, description, one clear action.
- **Responsive behavior:** Needs a final pass after Boards and dynamic surfaces are migrated.
- **Risk:** Low.

### 2. Boards / My Boards

- **Current status:** Low adoption. Uses bespoke inline styles and dynamic rows.
- **Board cards:** Existing `.board-row` is card-like but not `.fk-card` aligned.
- **Old buttons:** `primary-add`, `.icon-btn`, and generated rename/action buttons remain.
- **Search/filter controls:** No mature Boards-specific search/filter UI is evident; future controls should adopt toolbar/menu/input patterns from the start.
- **Create board flow:** Create button is visible but legacy styled.
- **Duplicate/copy actions:** Copy link action exists per row; duplicate board exists in Utilities menu. They need a consistent action hierarchy.
- **Board ownership/status UI:** Chips exist for Your Board, Editor, Shared/Open, Copy; they should map to badge/pill semantics.
- **Empty states:** Existing empty state lacks a clear action.
- **Responsive behavior:** Rows use two-column layout and many icon actions; narrow width stacking should be improved.
- **Risk:** Medium.

### 3. Campaign Canvas

- **Current status:** Partially modern shell, high-risk internals.
- **Canvas shell:** Toolbar is partly migrated; Canvas viewport/surface remains specialized.
- **Zoom controls:** Floating zoom buttons are legacy plain buttons.
- **Node cards:** Should not be migrated without dedicated audit because they are tied to selection/drag/save/load/edge behavior.
- **Connection controls:** High-risk and should be deferred.
- **Toolbar interaction points:** Filters/Utilities and zoom/fit/arrange controls still need cleanup.
- **Inspector interaction:** Inspector static fields are improved, but Canvas selection/Inspector coupling must be protected.
- **Responsive behavior:** Highest risk due to Canvas viewport and toolbar density.
- **Risk:** High.

### 4. Brand Core

- **Current status:** Low adoption; dynamic editor and Brand DNA surfaces are bespoke.
- **Form layout:** Side editor generates labels/inputs/textareas dynamically without consistent `.fk-*` classes.
- **Sections:** Brand Core shell, canvas, side panel, knowledge tiles, and Brand DNA need component alignment.
- **Inputs/selects/textareas:** Many dynamic editor controls remain legacy.
- **Avatar area:** Brand Avatar section has bespoke loading/preview/empty/action patterns.
- **Brand Brain state:** Needs clearer status/empty/loading/completeness patterns.
- **Knowledge tiles:** Need card/tile rules and selected/disabled/focus states.
- **Empty states:** Present but inconsistent.
- **Upload/reference areas:** Need a dedicated upload/reference component pattern.
- **Risk:** Medium.

### 5. AI Brain

- **Current status:** Low adoption; mostly generated from `app.js` using bespoke `ai-*` classes and plain buttons.
- **Chat/input area:** A full chat/input pattern is not currently mature; future prompt/input patterns should be designed before implementation.
- **Response cards:** AI summary/list/action cards need reusable AI card patterns.
- **Prompt/action buttons:** Quick actions are plain buttons and need hierarchy.
- **Context panels:** Need a consistent context card/panel pattern.
- **Empty states:** Need clearer zero-analysis and error states.
- **Loading states:** Refresh loading exists, but AI response/progress loading should be standardized.
- **AI-specific component patterns:** Missing and should be documented.
- **Risk:** Medium.

### 6. Insights

- **Current status:** Low adoption; generated analytics cards use bespoke `insight-*` classes.
- **Placeholder surfaces:** Need analytics-ready empty and loading states.
- **Cards:** Metric cards, funnel coverage, distribution, CTA, ICP, tone, trust, and suggestions should use a consistent analytics card anatomy.
- **Filters:** Future filters should reuse popover/menu/input guidance.
- **Empty states:** Should explain what data is needed and provide one clear action.
- **Future analytics/readiness patterns:** Needs documented chart/metric/card status rules before deeper analytics work.
- **Risk:** Medium.

### 7. Settings

- **Current status:** Settings is absent or not meaningfully implemented in the current shell.
- **Required shell:** Future Settings should be a deliberate shell, not scattered preferences.
- **Future user language:** Needs UI language preference model.
- **Future content output language:** Must remain separate from UI language because generated campaign content can target a different language than the product UI.
- **Future theme/dark mode:** Needs theme preference placeholder and token readiness first.
- **Account/workspace/brand preferences:** Should be grouped clearly and introduced only after an audit.
- **Risk:** Low-medium.

### 8. Modals

- **Campaign Generator modal:** Good adoption in V3 form structure.
- **Legacy Campaign Builder modal:** Good adoption in form structure, but specialized steppers/toggles/loading remain.
- **Conflict/save-as-new modals:** Legacy `brand-confirm-card` pattern with plain buttons.
- **Share/copy modals if present:** Share editor/panel/toast patterns are bespoke.
- **Confirmation modals:** Reset and Brand apply-suggestions confirmations need standard modal anatomy.
- **Consistency needs:** Headers, footers, button hierarchy, danger treatment, spacing, overlays, focus expectations.
- **Risk:** Medium-high.

### 9. Popovers / Menus

- **Filters menu:** Legacy generated buttons and hardcoded popover styling.
- **Utilities menu:** Legacy generated buttons and mixed action groups.
- **Brand switcher placeholder menu:** Polished but temporary and not reusable yet.
- **Dropdown/select consistency:** Native selects and custom popovers need documented distinction.
- **Z-index/positioning:** Needs a product-wide layering scale to avoid Canvas/toolbar/modal conflicts.
- **Risk:** Medium.

### 10. Buttons

- **Remaining non-`.fk-btn` buttons:** Numerous dynamic buttons remain in Boards, Brand Core, AI Brain, Insights, filters, utilities, confirmations, zoom, calendar, share, and lightbox flows.
- **Primary/secondary/ghost/danger consistency:** Danger and icon-only patterns are not fully formalized in the foundation.
- **Icon buttons:** `.icon-btn` exists but should become an explicit component or scoped pattern.
- **Disabled state:** Foundation supports disabled, but generated dynamic buttons vary.
- **Focus state:** Needs consistent focus-visible treatment, especially menus/icon buttons.
- **Risk:** Medium.

### 11. Inputs / Forms

- **Remaining non-`.fk-*` fields:** Boards rename, share editor, Brand Core dynamic editor, post-it reply, and specialized toggles/checkboxes.
- **Labels:** Static Inspector labels are better; dynamic editors need consistent label/help text structure.
- **Help text:** Missing in many forms.
- **Validation/error states:** No unified form validation pattern.
- **Form spacing:** Varies by surface.
- **Risk:** Medium.

### 12. Cards / Surfaces

- **Remaining non-`.fk-card` surfaces:** Boards, AI, Insights, Brand Core, confirmations, share editor, filters/utilities, Canvas empty/zoom/node surfaces.
- **Section surfaces:** Dashboard and Campaign Builder are stronger; Boards/Settings/Brand Core need alignment.
- **Dashboard cards:** Mostly migrated; final placeholder polish remains.
- **Boards cards:** Highest priority.
- **AI cards:** Need dedicated AI card anatomy.
- **Insights cards:** Need analytics card anatomy.
- **Modal cards:** Confirmation/share need standardization.
- **Risk:** Medium.

### 13. Empty States

Required pattern: **headline, description, one clear action**.

- **Dashboard:** Mostly strong but placeholder sections should be normalized.
- **Boards:** Existing empty state lacks a clear action.
- **Brand Core:** Empty states exist but vary and often lack one clear action.
- **AI Brain:** Needs explicit no-analysis/error/loading empty state patterns.
- **Insights:** Needs analytics-empty pattern with clear next action.
- **Settings:** Future placeholder should be clear and action-limited.
- **Risk:** Low-medium.

### 14. Loading States

- **Existing indicators:** Campaign V3 has the richest loading/progress experience; AI refresh and Brand DNA loading exist; share editor has a loading text.
- **Missing states:** Boards loading, AI response loading, Insights loading, Settings future loading, generic modal async loading.
- **Campaign Generator loading:** Strong but specialized; should inform a reusable educational loading pattern.
- **Board loading:** Not consistently expressed.
- **AI response loading:** Needs collaborative progress treatment.
- **Future skeleton opportunities:** Boards list, Insights cards, AI response cards, Brand Core tiles.
- **Risk:** Medium.

### 15. Notifications / Status

- **Save status:** Exists in toolbar but should map to status taxonomy.
- **Autosave status:** Must remain behaviorally untouched; visual pattern can be standardized later.
- **Read-only status:** Exists as a notice/chip and should remain prominent.
- **Board access status:** Owner/editor/viewer/shared/copy statuses exist but need badge/pill consistency.
- **Error notices:** Generator, AI analysis, share, and confirmations vary.
- **Success messages:** Share/copy/status feedback needs consistency.
- **Warning states:** Conflict/read-only/danger/reset patterns need modal/notice alignment.
- **Risk:** Medium.

### 16. Responsive / Layout

- **Sidebar collapsed behavior:** Improved and should be preserved.
- **Dashboard responsiveness:** Mostly acceptable but needs final density check.
- **Boards responsiveness:** Needs stacking rules for rows/actions.
- **Inspector/canvas responsiveness:** High-risk and should be separately audited.
- **Modal responsiveness:** Campaign builders need continued viewport testing; confirmations need standard dimensions.
- **Mobile/low-width concerns:** Product is dense; avoid broad responsive refactors until surface migrations stabilize.
- **Risk:** High.

### 17. Theme Readiness

- **Readiness for dark mode:** Partial only. Tokens exist, but many direct colors remain.
- **Hardcoded colors:** Inline toolbar/Boards styles and dynamic generated components use direct hex/rgba colors.
- **Missing token usage:** Boards, popovers, share/toast, presence, Brand Core, AI, Insights, and confirmations.
- **Surfaces that may break under dark mode:** Boards rows/chips, filter popover, share toast/editor, Brand Core dynamic editor, AI/Insights cards, confirmation modals, Canvas zoom controls.
- **Risk:** Medium.

### 18. Language / Localization Readiness

- **Hardcoded UI strings:** Present throughout static HTML and generated JavaScript templates.
- **Future user interface language:** Needs a UI-language preference, string ownership strategy, and default-language decision.
- **Future content output language:** Must be separate from UI language and should inform AI generation prompts/content settings only.
- **Separation between UI language and generated content language:** Not yet formalized; this is required before localization implementation.
- **Mixed language signs:** Document language is German, while UI labels include both German and English. This should be intentionally resolved through product language strategy.
- **Risk:** Medium.

---

## Decision

Proceed with a product-wide migration plan, beginning with **Boards / My Boards Design Migration**.

Do not implement product-wide styling changes in one PR. Continue the established Funklix pattern: audit first, then migrate one surface at a time, preserving IDs, event flows, save/load, autosave, routing, Canvas behavior, and generated-data contracts.
