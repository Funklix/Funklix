# BW-36.22B4 — Living Workspace motion and visual polish

Base: `e22cbf400d9721705b39526a56bb1a40c78a3d77`, latest merged main including PR #813.

## Change and boundaries

- Ambient rings, a decorative radial glow and three accents use small transform/opacity animations (8–22 seconds). All are inside the existing `aria-hidden` decoration. Reduced motion disables all Living animations/transitions, including pseudo-elements. No timer, library or continuous JavaScript work was added.
- Avatar slot lighting has softer layered shadows. The speech bubble moves 6px toward the centered Avatar and 1px downward without breaking B3R1 separation. Only the existing manual Previous/Next handler marks newly displayed text for a 220ms, 2px arrival; text stays 94–100% opaque. Focus and translated text behavior stay intact.
- Continue Board and the stage Brain action share violet gradients, hover lighting, pressed inset shadows, disabled styling and 3px keyboard focus. No scaling or changed geometry. White text has at least 5.06:1 contrast against the gradient endpoints in either theme.
- Signals use the existing text-symbol icon treatment, hidden from assistive technology, with aligned text and restrained hover/pressed feedback. The contextual Profile next step stays unboxed. Signal calculations, attribution and action handlers are unchanged.
- Pastel Light and navy/violet Dark keep identical hierarchy. Forced-colors controls use system colors.

Only two production files change. Existing IDs, action attributes, component hierarchy, authorization, focus adapters, image loading, acceptance and canonical persistence stay intact. No backend, migration, RLS/TLS/role, Vercel, Canvas, autosave, AI Brain or navigation implementation changes.

## Evidence

These are actual application screenshots using the repository's provider-free Home transport fixture and unchanged **accepted original 360×240 fixture Avatar**, including its background. They are not captures of a customer's production Avatar. The real canonical acceptance/read/render path is exercised; no substitute image is introduced by this PR. Asset SHA-256: `08ac172536cd926ce52e01d2e7045ff03f40a98593976c7b488e37339a43d163`.

Baseline captures load exact main Home CSS/JS before fresh navigation. Both versions use identical viewport, theme, Brand/Board data and original image. Mobile top-of-page and stage views are separate so the compact controls and Avatar/Brain can both be inspected.

| View | Before | After | Avatar stage before / after |
| --- | --- | --- | --- |
| Light desktop 1440×900 | [Before](before-1440-light.png) | [After](after-1440-light.png) | [Before](before-1440-light-stage.png) / [After](after-1440-light-stage.png) |
| Dark desktop 1440×900 | [Before](before-1440-dark.png) | [After](after-1440-dark.png) | [Before](before-1440-dark-stage.png) / [After](after-1440-dark-stage.png) |
| Light mobile 375×812 | [Before](before-375-light.png) | [After](after-375-light.png) | [Before](before-375-light-stage.png) / [After](after-375-light-stage.png) |
| Dark mobile 375×812 | [Before](before-375-dark.png) | [After](after-375-dark.png) | [Before](before-375-dark-stage.png) / [After](after-375-dark-stage.png) |

Interaction evidence: [Light Board focus + hover](after-1440-light-focus-living-board.png), [Dark Brain focus + hover](after-1440-dark-focus-stage-brain.png), [Light mobile Brain focus](after-375-light-focus-stage-brain.png), [Dark mobile Board focus](after-375-dark-focus-living-board.png).

The B4 matrix also checks laptop 1280px and narrow mobile 320px in both themes. Geometry and complete local suite logs accompany these screenshots.

## Validation and review

Commands: `npm run check:bw36.22b1`, `npm run check:bw36.22b1r1`, `npm run check:bw36.22b2`, `npm run check:bw36.22b2r1`, `npm run check:bw36.22b3`, `npm run check:bw36.21b1`, `npm run check:bw36.21b2`, `npm run check:bw36.22a`, and `node scripts/check-bw36-22b4-motion-polish.js`. B3R1 coverage resides in the existing Home suites; there is no standalone B3R1 command.

B4 checks original URL/dimensions/contain rendering, static unfiltered image geometry during ambient motion, manual message sequencing and focus, readable transition opacity, no automatic entry transition, hover/pressed/focus/disabled states, no action size change, reduced-motion animation removal including the glow pseudo-element, forced-colors focus, no horizontal overflow and no extra API requests/writes. The existing suites cover truthful scope, permissions, disabled/unavailable paths, EN/DE, text enlargement, keyboard navigation, legacy DOM, persistence and signal regressions.

Review caught the old B1 assertion forbidding motion on *all* stage descendants. It now permits animation only within `.home-avatar-art`, still requires a static Avatar/placeholder/automatic speech, and additionally verifies all descendants are static under reduced motion. Review also caught an initial 4px bubble offset violating B3R1's non-overlap bound; the final offset preserves that contract. No original image rule or asset was altered.

Test harness findings: stage screenshots can encounter a detached node during a legitimate Home redraw; B4 retries only that specific screenshot error, up to three attempts, following the existing B2 pattern. Existing shell resize transitions are allowed to settle before image-motion measurements. Final evidence measures the current connected image atomically and never waits for an expected object-fit value.

Full Runtime Boot Safety, including the new B4 check, runs in the existing unchanged PostgreSQL **17.6 / 18.4** matrix. Final commit CI conclusions and PR review findings are reported in the delivery/PR conversation without adding an evidence-only commit after the tested head. No merge or deployment is performed. No human review, physical-device test, customer production screenshot or assistive-technology session is claimed.

Final local result: all commands listed above PASS; the B4 matrix passes all eight theme/viewport combinations. [Combined final logs](focused-tests.log), [baseline geometry](before-geometry.json), [final geometry](after-geometry.json), and [exact changed-file manifest](changed-files.json). The full Runtime Boot Safety matrix is validated on the pushed PR head.
