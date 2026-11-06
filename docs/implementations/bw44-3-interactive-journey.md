# BW-44.3 — Interactive Campaign Journey

Base: `a7ebf2d49c08a738f3ab882861c84c82353edce4` (main including PR #853).

Each unchanged stage illustration now has a native button covering its stage area, with a translated stage/coverage name, `aria-expanded`, `aria-controls`, selected outline and keyboard focus outline. Enter and Space use native button activation. Existing artwork, connecting paths, status, mobile layout and legacy IDs are preserved. Dependency inspection found no IDs or external handlers on the removed native stage disclosures; their classes are retained on the single region for existing styling.

One full-width region starts hidden and empty. Selecting a stage renders that stage's name, coverage and all recognized cards with the existing `sourceList`, fields, missing-context copy and responsive grid. Switching replaces its children; selecting again collapses and empties it. There are no duplicate hidden card controls. Selection is render-local and resets on Refresh insights, language rerender or Board identity changes. It does not focus or scroll programmatically, fetch, infer, write, save or rerun analysis.

The exact persisted-ID handler and server resolver remain in use. The handler additionally rejects a removed source button, so a reference validation that finishes after switching/collapsing/refreshing cannot navigate. Scope, snapshot freshness, authorization, stale/deleted rejection, Canvas selection and native Inspector focus retain their existing checks. No second resolver, database change or dependencies.

## Verification

- Production app in Chromium, fictional persisted fixture data: 20 Light/Dark × EN/DE × 1440/1024/768/375/320 cases; desktop grid/mobile single column, long fields, Enter/Space, focus and reduced motion, no horizontal overflow.
- Native browser 200% zoom verified using devicePixelRatio and CSS viewport.
- Every displayed persisted source (including identical titles) opens its exact Canvas node and Inspector through the real checked-reference SQL route.
- Pending, 403, 409, 503 and stale-during-request cases; stage switching, collapse, Refresh and Board change during pending validation; no old feedback or navigation; ten persisted cards with no display limit; every missing stage on a persisted unmapped-node fixture; existing empty-Canvas diagnostics.
- BW-40.1/BW-44.1 signed navigation, deleted/wrong Board/Workspace/revoked access, keyboard/EN/DE/Light/Dark; BW-43 48 layouts and native zoom; BW-26/BW-28/BW-28.1/BW-28.3, runtime renderer, translation and browser integrity checks pass locally.
- Runtime Boot Safety runs on the PR for PostgreSQL 17.6 and 18.4. Consult the PR checks for the exact final-commit outcome.

Committed screenshots: [desktop Light/EN](bw44-3-visuals/desktop-light-en.png), [375px Dark/DE](bw44-3-visuals/mobile-dark-de.png), [native 200% zoom](bw44-3-visuals/native-200-percent.png).

Screenshot evidence is generated from the running production app under `work/bw44-2/screenshots/` and uploaded by both existing Runtime Boot Safety jobs. No production data or providers are used. Browser coverage is Chromium; no manual screen-reader or other-engine pass.

## Changed files

- `app.js`: stage selection, one shared region, removed-button pending guard.
- `styles.css`: appended scoped selector and region rules; original CSS byte-exact prefix retained.
- `scripts/check-bw44-2-journey-context-browser.js`: preserves card/navigation regressions and updates disclosure assertions for exclusive stage selection, adding pending lifecycle and unlimited-card coverage.
- `scripts/check-bw43-insights-browser.js`: opens/collapses sources using the stage button rather than the removed native details property; existing assertions retained.
- `.github/workflows/runtime-boot-safety.yml`: labels the existing suite/artifact step for BW-44.3; both complete PostgreSQL jobs remain.
- `docs/implementations/bw44-3-interactive-journey.md`: implementation, evidence and limits.

- `docs/implementations/bw44-3-visuals/desktop-light-en.png`
- `docs/implementations/bw44-3-visuals/mobile-dark-de.png`
- `docs/implementations/bw44-3-visuals/native-200-percent.png`

Review: original CSS remains byte-exact before the scoped additions; existing producer hash assertions pass. No legacy IDs are removed, no duplicate focusable context remains, and no server/navigation resolver is added. Full CI remains subject to the pending approval of the whole-file CSS fingerprint and its dependent test-file fingerprint; those edits have not been made.
