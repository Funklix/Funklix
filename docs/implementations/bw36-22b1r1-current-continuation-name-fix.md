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
