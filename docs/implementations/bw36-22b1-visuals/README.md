# BW-36.22B1 — actual Chromium evidence

Actual application `index.html`/scripts/styles and the existing `scripts/fixtures/home-browser.js` fixture; system Chromium, all transport intercepted before navigation. No provider/AI/analytics request, non-presence write, production SQL or real customer data. Captures show the explicit B1 placeholder, actual authorized fixture identities and saved metadata. The conversation reference image was visually compared directly, not committed or reproduced as artwork.

## Final validation

**187/187 Runtime Boot Safety validation blocks PASS; 2/2 setup blocks satisfied (189 total).** The dependency command was run with a workspace-local npm cache; installed system Chromium was verified through the actual browser fixtures instead of downloading another browser. Every remaining run block in `.github/workflows/runtime-boot-safety.yml` was executed sequentially. The exact commands, statuses and durations are in [runtime-validation.json](runtime-validation.json), with [summary](runtime-summary.log).

**15/15 new B1 groups PASS** ([group list](validation.json)). The complete workflow also passes Home Foundation, 96 safe Workspace-switching groups, BW-36.21B1 (17), BW-36.21B2 (30), BW-36.22A (10), Avatar/Profile, Canvas, AI Brain and all other registered regressions. No test is omitted from the validation run.

Phase A layout expectations now include Living Workspace and the new details boundary, while retaining all detailed-module order, membership, preview/expansion, permission and navigation assertions. Its first-viewport continuation gate follows the new saved-Board action, because the detailed list is intentionally below the new entry. Existing Foundation contrast/containment gates are unchanged.

## Screenshot and geometry matrix

Coordinates align the existing orientation to the Home scroll viewport start. The actual scroll owner is `#dashboard-view`; these are real viewport screenshots, with separate stage/detail positions to show below-fold content. [geometry.json](geometry.json) includes complete bounding rectangles, descendant containment, scroll viewport and contrast measurements. Every document width equals its viewport; no wide/clipped descendant, sub-44px visible control or shell/focus collision is accepted.

| Viewport | Theme / language | Sidebar | Quick-action bottom | Details start | Minimum sampled text/action contrast | Actual capture |
| --- | --- | --- | ---: | ---: | ---: | --- |
| 1600 × 900 | light / en | collapsed | 843.4px | 891.4px | 5.49:1 | [Screenshot](living-1600-light-en.png) |
| 1440 × 900 | light / en | collapsed | 827.7px | 875.7px | 5.49:1 | [Screenshot](living-1440-light-en.png) |
| 1280 × 800 | light / en | expanded | 793.1px | 841.1px | 5.49:1 | [Screenshot](living-1280-light-en.png) |
| 1024 × 768 | light / en | expanded | 1365.5px | 1413.5px | 5.49:1 | [Screenshot](living-1024-light-en.png) |
| 375 × 812 | light / en | collapsed | 1709.8px | 1741.8px | 5.49:1 | [Screenshot](living-375-light-en.png) |
| 320 × 740 | light / de | expanded | 1796.5px | 1828.5px | 5.49:1 | [Screenshot](living-320-light-de.png) |
| 1440 × 900 | dark / de | expanded | 798.0px | 846.0px | 4.55:1 | [Screenshot](living-1440-dark-de.png) |
| 1440 × 900 | system / en | collapsed | 827.7px | 875.7px | 5.49:1 | [Screenshot](living-1440-system-en.png) |
| 375 × 812 | system / de | expanded | 1733.6px | 1765.6px | 4.55:1 | [Screenshot](living-375-system-de.png) |

Additional actual nested-scroll captures: [Light details](details-light-en.png), [Dark details](details-dark-de.png), [Brand/Board mismatch](mismatch-1440-light-en.png), [375px stage](stage-375-en.png), [320px German stage](stage-320-de.png).

At 1600×900 and 1440×900 Light, the split composition, continuation and complete quick-action row are visible. At 1024px the actual available Home content width triggers stacking. On 375/320px phones the initial view favors orientation/continuation; stage and actions follow through scrolling. The mobile stage images and focused final-row checks demonstrate actual fixed navigation/context-control clearance. Long German names and 200% root-text enlargement retain 320px document containment. Reduced motion, forced colors, stable keyboard focus and both resolved system themes are checked.

## Reference comparison and limits

The approved visual hierarchy is retained: oversized left greeting, white continuation surface, right luminous organic stage with bubble and violet Brain entry, pastel emoji shortcuts, then the complete detailed Workspace. The existing application shell remains unchanged. Placeholder art is deliberately abstract and explicitly labeled, with no claimed saved Brand identity. The reference mascot, health/presence/approval-today/opportunity claims, progress track, performance uplift and fabricated activity timeline are absent. B2–B4 remain gated.

All new sampled text/action contrast measurements meet 4.5:1 in Light, baseline Dark and both resolved system themes; the minimum is recorded per capture above. These samples do not replace a full manual accessibility audit. Native browser zoom, physical-device and NVDA/VoiceOver acceptance remain manual checks, distinct from tested reflow/text enlargement. No production or real saved-Avatar acceptance is claimed for the B1 placeholder.

Initial development runs caught an out-of-bounds decorative ring; its geometry was corrected while preserving the existing containment assertion. New test harness issues (existing control IDs, busy-dialog Escape and the expected Board retirement on Workspace switching) were corrected to exercise the actual contracts. The final full run is clean.

Generated by `npm run check:bw36.22b1`; archive captures only after the full workflow passes.
