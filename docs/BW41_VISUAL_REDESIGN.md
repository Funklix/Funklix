# BW-41 AI Brain visual redesign

## Scope and inspection

Base: `c6bd908e0182e512a5d9d061745b6d5bbd28596c` (main including merged PR #844).
The supplied reference image was inspected before implementation.

Inspected `renderAiBrain`, `renderAiBrainTranscript`, avatar rendering, all six focus modes, BW-40.1 suggestion listeners, form/retry bindings, draft/caret restoration, viewport binding, theme tokens, BW-40 references and Canvas/Inspector routing, evidence/proposal surfaces, and existing responsive CSS. Expected blast radius: AI Brain presentation plus its stylesheet registration and acceptance checks. Global navigation and application behavior are unchanged.

## Changed files

- `ai-brain-visual.css`: scoped presentation, using existing semantic theme tokens.
- `index.html`: register the scoped stylesheet after existing Brain styles.
- `scripts/check-bw41-visual-browser.js`: actual application browser acceptance and screenshots.
- `package.json`: `check:bw41` entry point.
- `.github/workflows/runtime-boot-safety.yml`: run acceptance and retain browser screenshots on both existing PostgreSQL matrix jobs.
- `docs/BW41_VISUAL_REDESIGN.md`: implementation and validation record.

## Visual result

Larger title/avatar hierarchy, pill Advisor badge, separated Board metadata, rounded lavender welcome surface, subtle gradient depth and CSS sparkles, a unified rounded composer, refined focus selector and textarea, lavender shortcuts, purple primary action, and matching conversation cards. The existing transcript remains the conversation scroll owner; existing keyboard viewport handling and shortcut overflow behavior are retained.

Light Mode is the visual target. All surfaces, borders, copy and accents derive from existing theme variables, including Dark Mode. Shadows are restrained. No new image, dependency, animation, provider call, payload, persistence change, DOM ID change or application handler change. `app.js` and the protected global `styles.css` are unchanged.

## Reference fidelity

The composition, hierarchy, rounded surfaces, lavender palette and composer grouping follow the attached reference. This is an architectural adaptation, not a pixel-identical copy. Decorative waves are simplified to lightweight gradients and sparkles; existing typography and translated headline remain intact rather than adding a language-dependent partial highlight. Existing metadata text is retained without new icon markup. Avatar selection is unchanged: approved Brand avatar when available, existing sparkle fallback otherwise. Fictional browser fixtures have no approved Brand avatar and show that fallback, not the illustrative reference portrait.

## Validation

Local Chromium checks passed:

- `npm run check:bw41`: real application DOM with authenticated fictional transport; Light/Dark, empty and active layouts, desktop 1440×900, laptop 1366×768, tablet 768×1024, mobile 375×812 and 320×740. Desktop/tablet 200% zoom is emulated by halving the CSS viewport (unlike CSS zoom, browser zoom also changes viewport units). Checks page/control overflow, reachable Ask button, focus outline, draft preservation, top of welcome content reachable, reduced motion, pending/failure/retry, Markdown, follow-up turns, and zero domain writes.
- `npm run check:bw40.1`: BW-40 references including exact Canvas/native Inspector routing, plus all six modes, EN/DE prompts, insertion/editing without submission, draft preservation, keyboard, Light/Dark and existing CSS zoom regressions.
- `npm run check:bw37.1ar1`: active exchange visibility, intentional history scrolling, draft/caret/focus, Jump to latest, Markdown, failure/retry, navigation, language/themes, keyboard viewport, stale response suppression and account/Board resets.
- `node scripts/check-browser-script-integrity.js` and `git diff --check`.

The unchanged complete Runtime Boot Safety suite runs on PostgreSQL **17.6** and **18.4** for this PR, including BW-37/38/39/40 regressions and the stylesheet integrity contract. The PR's Actions/check results are authoritative for full CI status.

Actual Chromium screenshots are generated in `work/bw41/` and uploaded by CI as `bw41-browser-postgres-17.6` and `bw41-browser-postgres-18.4`: Light/Dark desktop/mobile welcome states, loading/failure, and active conversations at 1440/375/320. These render the application with local fictional data and mocked advice responses, without external providers.

## Review and limits

Self-review found no changes to functionality, global styles, authentication, authorization, database, Canvas state, rendering, inference settings or navigation. An initial mobile welcome alignment issue was corrected to use safe centering so overflow starts within the scrollport. Existing narrow/keyboard viewports can scroll welcome content or shortcut chips in their established regions; controls remain accessible.

No external human review is claimed. Automated emulation does not replace physical-device, native browser zoom or screen-reader testing. Simultaneous 200% zoom on an already 320px mobile viewport is not a new acceptance claim; the inherited shell has a 320 CSS pixel minimum width, which this scoped change does not alter. Do not merge or deploy manually.
