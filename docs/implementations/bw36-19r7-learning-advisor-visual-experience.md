# BW-36.19R7 — AI Learning Advisor visual experience

Base: latest merged GitHub main `1d000b5b5fd6988300196d743082a8c6954776c8`, including R6 / PR #771. GitHub connector and subsequent successful Git fetch independently confirmed this base.

## Audit before editing

The previous Advisor presented the entire source/privacy explanation as consecutive paragraphs before a small Board form. Cards used the shared Learning library styling without an Advisor hierarchy or a visible selected-card treatment. Primary analysis and save actions inherited secondary styling. Review fields, navigation, source material and success feedback had little visual differentiation.

The production dependency audit covered `learning-advisor.js`, `learning-advisor.css`, `brand-learnings.js`, `brand-learnings.css`, the theme tokens/global cascade in `styles.css`, script/style loading in `index.html`, the Advisor HTTP/service modules and all BW-36.19/R1/R2/R4/R5/R6 fixtures. Only Advisor presentation files change in production.

| Contract | Preservation |
| --- | --- |
| `[data-learning-advisor]`, `[data-advisor-board]`, `[data-advisor-discussions]`, `[data-advisor-thread]`, `[data-advisor-suggestion]`, `[data-advisor-select]`, `[data-advisor-field]`, `[data-advisor-action]` | Names, values and control elements retained. New classes and feedback `data-stage` describe presentation only. |
| `button()` and control event bindings | Existing callback bodies, action names, checkbox selection semantics and disabled eligibility retained. |
| Drafts, normalization, capacity warning, dirty state | Existing `capture`, `edit`, discard and validation logic retained. Read-only AI source disclosure never changes editable values. |
| Modal lifecycle and focus | Native `dialog`, monitor, cancellation, Escape/Tab wrapping, textarea focus, focus/visibility receipt validation and opener restoration retained. Initial Close focus uses `preventScroll` and resets dialog scroll to the top so the mobile header is visible; the focused element is unchanged. |
| Async source and analysis rendering | Existing preview/loading messages and validated NDJSON progress remain authoritative. Stage styling uses only existing reported stages. No synthetic progress, time, percentages or extra provider calls. |
| Adoption and receipt transitions | `startReview`, navigation, confirmation payload freezing, `saveItems`, expiry and `returnToList` unchanged. Individual/bulk requests, atomicity and proposed status remain unchanged. |
| Localization/theme | Existing EN/DE copy and language invalidation retained. Additive presentation text uses the existing `COPY` infrastructure. Existing semantic `--fk-*` tokens, font family and theme selector reused. |

## Intelligence Studio design

A layered violet/indigo header introduces Brand Intelligence, the existing Advisor title, a short benefit statement, a restrained AI star and receiving Brand identity. The Board/discussion controls form one distinct source-selection surface. Analysis has a full-width primary treatment, and the existing explicit action remains the only consent trigger. A visible sentence explains when selected sources are sent to OpenAI. Every original scope, provider, exclusion and API-usage disclosure remains available through native progressive disclosure; optional discussion disclosure stays with its controls.

Cards emphasize the actual suggestion title, Learning statement and rationale, with a restrained localized type chip. Evidence uses an outlined expandable source surface; complete quotes, source identifiers, attribution and provenance warnings remain intact. The native selected checkbox drives the card border and inset accent through CSS `:has`, without additional selection state or event work. Proposed cards have a textual green status badge and the existing disabled controls.

The review view gives the editable human-reviewed statement a larger type size and more space, separates editable context from a read-only copy of the AI statement/rationale, presents bulk position as a compact numeric marker, and groups the existing navigation and save actions. Confirmation and dirty-discard surfaces are visually explicit. Existing save feedback uses a semantic success surface. Errors retain their alert semantics, bounded messages, original warning icon and recovery controls.

Preparation, analysis and consolidation reuse existing real feedback. A transform-only CSS orbit is confined to the visible progress icon. Preparation has a dashed accent; actual analysis has the standard accent; server-reported consolidation has a stronger edge. No timer, animation frame loop or new inference work is introduced. Completion presents returned cards; proposal success presents the existing server-confirmed save message.

## Themes, responsive behavior and accessibility

Light and Dark Mode use the application's semantic surfaces, borders, action colors, text and feedback tokens. No separate font download or package is added. The Advisor is at most 800px wide, narrows to viewport margins, and preserves dialog scrolling and overscroll containment. At mobile widths, card/header padding decreases and review actions wrap. At short viewport heights, the footer becomes static, keeping content and primary actions reachable.

Labels remain associated by native nesting; checkbox state, disabled state, accessible button names, dialog name and live-region roles remain intact. Controls have at least 44px action height and visible 3px focus outlines. Selection is communicated by a native checkbox and border, and proposed state includes text. Reduced motion disables animation and transitions. Forced colors uses system borders, surfaces and focus colors. Body and statement text wrap; quotes retain full text, and textareas remain resizable and scrollable.

Real Chromium checks measure at least 4.5:1 contrast for enabled primary-action text and both editor text surfaces in Light/Dark Mode. This is targeted contrast verification, not a claim of a complete automated accessibility audit.

## Changed files

- `learning-advisor.css`: scoped layout, typography, surfaces, actions, cards, feedback, review, themes and responsive/accessibility treatments.
- `learning-advisor.js`: presentation copy, header/disclosure wrappers, semantic presentation classes, feedback stage hooks, read-only source view and initial scroll presentation.
- `scripts/check-bw36-19r7-advisor-visual.js`: real Chromium visual/accessibility QA against production styles and DOM, with provider-free transport fixtures.
- `.github/workflows/runtime-boot-safety.yml`: additive R7 Chromium check; all existing checks remain unchanged.
- This document, `docs/implementations/bw36-19r7-validation.json` and `docs/screenshots/bw36-19r7/`: validation and visual evidence.

No APIs, prompts, extraction, authorization, schema, provenance, adoption, stored content, receipt/session rules, packages or historical test assertions changed. No production SQL or paid provider requests were executed. Database regression tests use their existing disposable PGlite fixtures.

## Visual evidence

The reproducible R7 check captures 48 screenshots: Light/Dark × desktop 1280/mobile 375 × initial, preparation, analyzing, consolidating, results, expanded evidence, bulk selection, review, confirmation, success, error and forced colors. The [manifest](../screenshots/bw36-19r7/manifest.json) lists every capture. Transport fixtures feed the real renderer; these are deterministic visual states, not production provider results.

| View | Light desktop | Dark mobile |
| --- | --- | --- |
| Initial | [Screenshot](../screenshots/bw36-19r7/light-1280-initial.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-initial.png) |
| Analysis | [Screenshot](../screenshots/bw36-19r7/light-1280-analyzing.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-analyzing.png) |
| Results | [Screenshot](../screenshots/bw36-19r7/light-1280-results.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-results.png) |
| Bulk selection | [Screenshot](../screenshots/bw36-19r7/light-1280-bulk-selection.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-bulk-selection.png) |
| Review | [Screenshot](../screenshots/bw36-19r7/light-1280-review.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-review.png) |
| Success | [Screenshot](../screenshots/bw36-19r7/light-1280-success.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-success.png) |
| Error | [Screenshot](../screenshots/bw36-19r7/light-1280-error.png) | [Screenshot](../screenshots/bw36-19r7/dark-375-error.png) |

The screenshots were inspected for hierarchy, overflow, spacing, theme consistency and reachable actions. QA caught and corrected a global theme heading-size override and the initial mobile scroll position. The fixture received an explicit UTF-8 declaration so localized text and the AI motif render correctly. No historical snapshots or expected hashes were replaced.

Run `node scripts/check-bw36-19r7-advisor-visual.js`; by default screenshots go to `work/advisor-screenshots`. Set `ADVISOR_SCREENSHOTS` to choose another evidence directory. Additional checks cover tablet 768px, narrow 320px, 400/540px heights, dialog horizontal overflow, expanded source disclosure, source quotes, independent edits through navigation, explicit confirmation, proposed disabled states, one analysis request, recoverable errors, reduced motion, forced colors, Tab wrapping, Escape and opener focus restoration. All routed network requests must target localhost.

## Test results

All **173 existing Runtime Boot Safety validation steps / 220 command lines passed** locally, including the unchanged BW-36.19, R1, R2, R4, R5 and R6 suites and the relevant Brand Profile, Learning lifecycle/provenance, modal, Canvas, theme, responsive, localization and runtime-global regressions. The additive R7 Chromium check also passed: **174 total validation steps / 221 command lines** for the final workflow. Existing dependency and Chromium provisioning was satisfied before running these validation commands. See the [machine-readable validation summary](bw36-19r7-validation.json).

The focused `npm run check:bw36.19r6` was also rerun independently and passed its API/security, disposable-database and Chromium groups, including receipt continuation after individual save, independent drafts, explicit bulk confirmation, atomic second-event rollback, retry, persistence and human review.

The final R7 run passed all 48 visual captures and its responsive, text-contrast, keyboard, reduced-motion, forced-colors and state assertions. Syntax checks for both changed JavaScript files and `git diff --check` passed.

A separate byte comparison against main confirmed that 13 core routines are unchanged: `request`, `clear`, `close`, `discard`, `cancel`, `validate`, `resume`, `coverage`, `startReview`, `capture`, `returnToList`, `saveItems` and `refreshScope`. Every historical test file and assertion is unchanged. No failing legacy hashes or frozen markup assertions required replacement.

Chromium/network provisioning initially failed inside the restricted process sandbox. Re-running with the granted execution permission resolved those environment restrictions; the completed validation run had no failures.

## Remaining risks

Live provider performance was deliberately not exercised; existing mocked-provider service/API and disposable-database suites verify functional behavior. Screenshot fixtures use representative source content, so unusually long real Brand names or content may produce different vertical composition; text wrapping and narrow-height scrolling are covered. All changes remain subject to visual user review. The PR must remain unmerged.
