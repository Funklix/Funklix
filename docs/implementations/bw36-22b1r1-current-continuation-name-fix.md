# BW-36.22B1R1 — Current continuation name consistency

Baseline: latest merged `main`, `baf6fcb03a0fe08be9caa6149ae597cce180b943`, including PR #796.

Addresses the unresolved Codex P2 [“Use the hydrated name for the current continuation”](https://github.com/Funklix/Funklix/pull/796#discussion_r4318799497).

## Problem and fix

The authorized Workspace catalog may predate a Board rename. The Home context already exposes the fully hydrated current Board name, used by the adjacent Brain stage and details heading. `heroContinuation` copied the catalog name into its current candidate, so the continuation title and accessible action name could disagree with those surfaces.

The current candidate now overrides only `name` with `context.openBoard.name`, after the existing loading, hydration and authorized catalog-ID intersection. Both the card title and action `aria-label` already consume that candidate name. Other saved candidates retain catalog names. The shared catalog and detailed collection are not mutated.

Catalog membership and Board ID still determine eligibility. Hydrated metadata cannot introduce an unauthorized Board or cross an account/Workspace boundary. Existing Brand-centered ordering, hydrated association resolution into authorized visible Brands, captured action scopes, saved modification metadata and stale-response guards are unchanged. No new reader, persistence write, backend change, production SQL or paid AI request is introduced.

## Regression coverage

`npm run check:bw36.22b1r1` adds pure projection and provider-free actual application Chromium checks:

- Real Board rehydration after catalog retrieval with a renamed response and unchanged stale catalog.
- Matching continuation title, accessible button name, Brain stage and details heading.
- Other saved Boards retaining catalog labels and Brand-centered selection.
- Actual switch to a second Board with its own hydrated name and unchanged catalog identity.
- Retired Board generations, captured actions, account replacement/mismatch and Workspace switches.
- Unauthorized/missing current ID, loading/unhydrated context, public access and unavailable identity cannot promote hydrated metadata.
- Stable saved modification time, detailed catalog names, Board identity, Canvas/Core/association, dirty/saved/revision state, and no extra reads or persistence writes from redraw/continuation.

The base implementation was separately confirmed to return the stale catalog name for the same context that returns the hydrated name with this fix.

## Validation

All **188 Runtime Boot Safety validation blocks have passing results**: 186 passed in the complete sequential run; the two initially failing browser suites both passed in full on targeted rerun. Dependencies were installed with `npm install --ignore-scripts --no-package-lock` using the workspace cache; installed system Chromium supplied browser setup. Every validation run block in `.github/workflows/runtime-boot-safety.yml` was executed.

Initial failures were the existing BW-36.21B2 immediate Insights navigation focus assertion (line 131), and BW-36.22B1 static-stage computed animation assertion (line 76). Neither assertion nor production navigation, animation or timing logic was changed. `npm run check:bw36.21b2` subsequently passed all 30 groups; `npm run check:bw36.22b1` passed all 15 groups. These initial transient failures remain relevant CI reliability context; the first full run was 186/188, not a clean first-pass run.

The new BW-36.22B1R1 suite passed all four groups within the complete run, including editor and viewer accessible labels. BW-36.22A, Home foundation/intelligence/context, safe Workspace switching, Board authorization/association/creation/refresh/sharing, responsibilities and Canvas lifecycle checks passed. `node --check` on the new suite and `git diff --check` also passed. All application fixture transport is intercepted; provider calls remain mocked or prohibited. No production SQL or paid AI request was executed.

A final `git fetch origin main` confirmed the baseline SHA above was still current before delivery.

## Changed files

- `home-foundation.js`: current candidate name override only.
- `scripts/check-bw36-22b1r1-current-continuation-name.js`: focused regressions.
- `package.json`: register the regression command.
- `.github/workflows/runtime-boot-safety.yml`: run the regression in CI.
- This implementation record.

Delivery: one normal non-draft PR against `main`. Do not merge.

## Mobile scroll CI recovery — PR #797

### Confirmed failure and comparison

Retrieved the complete [failed Runtime Boot Safety job log](https://github.com/Funklix/Funklix/actions/runs/39330474904/job/118327082494). BW-36.22A passed its first nine behavioral groups and failed the mobile matrix's `Home scroll viewport overlaps fixed context controls` assertion. The original log did not record which matrix row failed; the assertion now includes width, height, theme, language, sidebar preference and rectangles.

Compared the original matrix on unchanged latest merged `main` (`baf6fcb03a0fe08be9caa6149ae597cce180b943`) and the original PR branch (`a73ee8950f475a5347234939f70133612117775b`). Both can pass after layout settles. Immediate same-task collapse/expand measurements expose the actual breach on both. The new regression deterministically fails against unchanged `main` at the matrix's 375×812 Light/EN collapsed scenario; repeated 320×740 Dark/DE measurements expose the same defect. This is a real transient scroll-clip overlap, not a harmless intersection of separate horizontal areas or a reason to relax the acceptance requirement.

### Root cause and exact correction

The global reduced-motion rule sets a nonzero `.01ms` transition duration on every element. Elements retaining the default `transition-property: all` consequently interpolate layout properties too. Home's `updateClearance()` correctly writes a new `--home-scroll-height`, but the actual `#dashboard-view` max-height briefly retains its previous value. The fixed Workspace context box simultaneously interpolates its gap from 4px to 10px, changing the top used by the clearance calculation. A later frame or unrelated Home redraw can hide the breach, explaining why a local matrix pass did not establish CI stability.

The mobile-only rule in `home-foundation.css` now permits only `background-color`, `border-color`, `color` and `box-shadow` transitions on `#dashboard-view.home-foundation-page` and the fixed Workspace context while `data-active-view="home"`. Layout snaps synchronously; no timer, sleep, tolerance, guessed clearance or new layout observer is added. The existing measured clearance and 12px gap remain authoritative. The original viewport and focus assertions are retained unchanged apart from diagnostic text.

| Scenario | Before: Home bottom / context top | After: Home bottom / context top |
| --- | --- | --- |
| 375×812, Light, EN, collapsed, reduced motion | 686 / 650 — 36px overlap | 632 / 644 — 12px gap |
| 320×740, Dark, DE, collapsed, reduced motion | 614 / 578 — 36px overlap | 560 / 572 — 12px gap |
| 320×740, Light, EN, expanded | settled 614 / 626 | 614 / 626 — 12px gap |

Fixed navigation remains at y=748 (375×812) and y=676 (320×740), height 64px. Collapsed context settles to height 98px and expanded context to height 44px. Before/after rectangles and Chromium captures are retained in [the mobile evidence directory](bw36-22b1r1-mobile-scroll/geometry.json).

### Regression and accessibility evidence

The new `scripts/fixtures/home-mobile-geometry.js` is invoked by the existing BW-36.22A command. It checks 64 immediate-layout scenarios: 320px/375px × Light/Dark × EN/DE × reduced/default motion × repeated expand/collapse. Assertions run in the same task as the layout change, before a sleep or animation frame can mask the old dimensions. It measures the actual dashboard, fixed context and fixed navigation together and requires zero overlap, with no added tolerance.

For every scenario the full expanded Home's 46 enabled controls, including the three Brand/Board mismatch-notice actions, are focused, scrolled into the viewport and checked against its clip, the fixed overlays and `elementFromPoint`. Native Tab traversal additionally checks the complete control sequence for each width/theme/language combination. The suite also verifies that the Board snapshot, Core, association, revision and dirty state are unchanged. Actual screenshots show both sidebar preferences and focused Brain/lower detailed actions. The existing fixture rejects provider calls and non-presence writes.

The new immediate regression passed in four independent 64-case runs (256 immediate checks), including the original matrix’s selected-Brand/current-Board mismatch. The three current-Brand runs checked 2,752 focus/scroll/hit-test targets each; the matching-matrix mismatch run checked 2,944. The final mismatch run additionally traversed all 368 controls with native Tab across the eight width/theme/language combinations. With Living Workspace temporarily hidden in the fixture, scrollHeight changed 5524→4100px at 375px and 5729→4299px at 320px, but the safe viewport remained 632px and 560px respectively. Living Workspace changes content length, not the shell's available scroll height.

Representative after-fix captures: [375px Light/EN collapsed](bw36-22b1r1-mobile-scroll/mobile-375-light-en-collapsed.png), [320px Dark/DE expanded](bw36-22b1r1-mobile-scroll/mobile-320-dark-de-expanded.png), [focused Brain action](bw36-22b1r1-mobile-scroll/mobile-320-dark-de-brain-focused.png), [focused final detailed action](bw36-22b1r1-mobile-scroll/mobile-375-light-en-details-focused.png). The directory contains all 16 width/theme/language/sidebar combinations and four focused-action captures. The two `before-main-*-settled.png` captures explicitly show settled baseline layout; the sub-frame defect is established by the immediate geometry and failing baseline regression, not by claiming these settled screenshots show the transient overlap.

The original Living Workspace, Home details, selectors, Brand/Board semantics, Board lifecycle, navigation and hydrated continuation-name implementation are preserved.

### Final validation

Focused checks passed: `npm run check:bw36.22a` (11 groups), `npm run check:bw36.22b1` (15 groups), `npm run check:bw36.22b1r1` (four groups), and `npm run check:bw27.7`. The final 64-case geometry run with full native Tab traversal passed; unchanged main fails the new immediate regression. New fixture syntax and `git diff --check` passed. **Complete Runtime Boot Safety: 188/188 validation blocks passed on the first complete sequential run, with zero failures or reruns.** This includes the unchanged original BW-36.22A visual matrix, the final 64-case mismatch regression with full native Tab traversal, B1, B1R1, Home, responsive shell, and Board lifecycle checks. [Exact run blocks and durations](bw36-22b1r1-mobile-scroll/runtime-validation.json) and [summary](bw36-22b1r1-mobile-scroll/runtime-summary.log) are retained. Existing installed dependencies and system Chromium supplied setup. No production SQL or paid AI request was executed.

Recovery files: `home-foundation.css`, `scripts/check-bw36-22a-compact-home.js`, new `scripts/fixtures/home-mobile-geometry.js`, this existing implementation document and the linked mobile evidence directory. The original B1R1 JavaScript/name correction is unchanged.

### Residual limits

Evidence uses actual Chromium 151 on the managed Debian runtime with intercepted local fixture transport. It does not establish physical-device or manual screen-reader acceptance, browser chrome/virtual-keyboard safe-area behavior, or other browser engines. The CSS correction uses no Chromium-specific API. CI's complete workflow remains the independent GitHub runner check.
