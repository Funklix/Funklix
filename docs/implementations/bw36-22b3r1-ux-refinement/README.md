# BW-36.22B3R1 — Living Workspace UX refinement

[Non-draft PR #813](https://github.com/Funklix/Funklix/pull/813) against main. Baseline `9a804794fd2ad7f756edf101841b48c84ca94bcd`, including merged PR #812. Production/test source commit `f2549fc535918dd27261a1e02582be5445cad0ed`. No merge or deployment.

## Result and boundaries

- Workspace and Selected Brand use aligned label baselines and identical 44px selectors, padding, typography and radius. The selected Workspace is named once in the visible toolbar, with its identity retained. Create Workspace and Manage Brands are secondary visible actions; Brand Profile stays adjacent to the Brand. Tablet uses two context columns and mobile stacks them.
- Smaller greeting, compact continuation, unboxed truthful saved metadata, compact source-labeled signals, and a lightweight specific Profile next step reduce competing surfaces. Board identity and its navigation CTA remain prominent. Quick Actions arrive sooner.
- Speech bubble and Brain entry spacing are compacted. Avatar image rendering, proportions, contain fit, original background, acceptance and selected-Brand scope are unchanged. The asset file is unchanged (SHA-256 `08ac172536cd926ce52e01d2e7045ff03f40a98593976c7b488e37339a43d163`).
- A private presentation helper chooses the first verified message whose evidence source is absent from the two visible signals. The existing message list, evidence priority and manual circular sequence are unchanged. Manual selection survives redraw; Previous/Next starts from the displayed message. If no complementary verified evidence exists, the original first message remains. When diagnostics become stale and signals change, the default may use verified saved-Board identity instead. No facts, readers or translated strings were added.
- All selector IDs, legacy Home IDs/classes, focus keys, permissions, action guards, switching and navigation adapters remain. Detailed Home stays below the Living Workspace. No APIs, database changes, Brand/write-contract changes, providers, generation, polling, caches, engine or architectural refactoring.

## Measured comparison

Same provider-free application fixture, original accepted 360×240 Avatar test asset, EN, identical viewport and sidebar state. CSS pixel positions are relative to the viewport; mobile uses the existing fixed navigation. Light and Dark have matching geometry. These are fixture measurements, not performance or production usage claims.

| Viewport width | Continuation height, before → after | Quick Actions start, before → after | Earlier access |
| --- | --- | --- | --- |
| 1440px | 221.0 → 187.7px | 744.8 → 676.6px | 68.2px |
| 1280px | 221.0 → 187.7px | 745.8 → 677.1px | 68.7px |
| 375px | 295.8 → 249.7px | 1652.3 → 1426.3px | 226.0px |
| 320px | 295.8 → 249.7px | 1713.4 → 1534.7px | 178.6px |

Both desktop selector tops align exactly. Both selectors are 44px high across the B1 matrix; label baselines align at tablet/desktop. No horizontal overflow in the 1440/1280/375/320 Light/Dark capture matrix. See [raw geometry](geometry.json) and [B1/B2/B3 test output](focused-tests.log).

## Screenshots

Screenshots are actual application rendering with intercepted local transport. The Avatar is the unchanged accepted synthetic fixture used by existing B2/B3 tests, not a replacement customer Avatar. Top-of-page pairs use matching EN viewport/theme/sidebar state. Additional DE/mobile evidence comes from unchanged B3 transport fixtures.

| View | Before | After |
| --- | --- | --- |
| Desktop Light, 1440×900 | [Before](before-1440-light.png) | [After](after-1440-light.png) |
| Desktop Dark, 1440×900 | [Before](before-1440-dark.png) | [After](after-1440-dark.png) |
| Laptop Light, 1280×800 | [Before](before-1280-light.png) | [After](after-1280-light.png) |
| Laptop Dark, 1280×800 | [Before](before-1280-dark.png) | [After](after-1280-dark.png) |
| Mobile Light, 375×812 | [Before](before-375-light.png) | [After](after-375-light.png) |
| Mobile Dark, 375×812 | [Before](before-375-dark.png) | [After](after-375-dark.png) |
| Narrow mobile Light, 320×812 | [Before](before-320-light.png) | [After](after-320-light.png) |
| Narrow mobile Dark, 320×812 | [Before](before-320-dark.png) | [After](after-320-dark.png) |
| Mobile signals / Profile, Light EN | [Before](before-signals-375-light-en.png) | [After](after-signals-375-light-en.png) |
| Mobile signals / Profile, Dark DE | [Before](before-signals-320-dark-de.png) | [After](after-signals-320-dark-de.png) |
| Mobile Avatar / Brain, Light | [Before](before-375-light-stage.png) | [After](after-375-light-stage.png) |
| Mobile Avatar / Brain, Dark | [Before](before-375-dark-stage.png) | [After](after-375-dark-stage.png) |

## Tests and review

Final focused suites: Home Intelligence 17, compact Home 11, B1 15, B2 eight, B3 seven groups. Exact commands, statuses and durations are in [validation.json](validation.json); logs are in [focused-tests.log](focused-tests.log).

B1 additionally checks the new selector geometry and intended contextual default. B2 preserves the original pure evidence-priority assertions and now checks complementary default attribution, keyboard access back to Learning, stable manual selection, EN/DE and sole-evidence fallback. Existing responsive, contrast, reduced-motion, forced-colors, text enlargement, disabled actions, focus restoration, account/Workspace/Brand races, original-image fidelity and navigation checks remain. JavaScript syntax and `git diff --check` pass.

Complete local Runtime Boot Safety: all 203 workflow run blocks were attempted; all 200 validation blocks passed across the initial run and recorded successful reruns. Dependency setup passed; PostgreSQL operator preparation passed after database readiness; the browser installer was substituted with system Chromium. Initial setup, database, screenshot and legacy class findings, their exact output and the successful follow-up runs are retained in [runtime-findings.log](runtime-findings.log) and [validation.json](validation.json). Local Chromium setup used installed system Chromium because the workflow dependency installer requires root. Disposable PostgreSQL 17.6 passed all five setup/database blocks. PostgreSQL 18.4 passed the database retries and remaining full-sequence checks. The first broad run preceded the final spacing adjustments; final Home checks and the GitHub matrix cover the pushed source.

GitHub full unmodified Runtime Boot Safety matrix: [run 40091131443](https://github.com/Funklix/Funklix/actions/runs/40091131443). Both PostgreSQL 17.6 and 18.4 jobs **passed** on the exact final production/test source commit. Full job IDs and conclusions are recorded in validation.json. This evidence-only commit may trigger another CI run; it does not change the validated source.

Review found no unresolved product regression in the inspected scope. Exact-class dependency found during validation was preserved by using `data-context-ready`. Scope review confirms only two production files changed; no migration, backend, write adapter, navigation handler or asset changed. No human review or physical-device/NVDA/VoiceOver testing is claimed. PR reviews/threads were empty when inspected.

## Exact changed files

- `docs/implementations/bw36-22b3r1-ux-refinement/README.md`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-1280-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-1280-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-1440-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-1440-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-320-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-320-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-375-dark-stage.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-375-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-375-light-stage.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-375-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-signals-320-dark-de.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/after-signals-375-light-en.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-1280-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-1280-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-1440-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-1440-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-320-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-320-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-375-dark-stage.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-375-dark.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-375-light-stage.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-375-light.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-signals-320-dark-de.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/before-signals-375-light-en.png`
- `docs/implementations/bw36-22b3r1-ux-refinement/changed-files.json`
- `docs/implementations/bw36-22b3r1-ux-refinement/focused-tests.log`
- `docs/implementations/bw36-22b3r1-ux-refinement/geometry.json`
- `docs/implementations/bw36-22b3r1-ux-refinement/runtime-findings.log`
- `docs/implementations/bw36-22b3r1-ux-refinement/validation.json`
- `home-foundation.css`
- `home-foundation.js`
- `scripts/check-bw36-22b1-living-workspace.js`
- `scripts/check-bw36-22b2-real-brand-avatar.js`
