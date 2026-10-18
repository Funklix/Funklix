# BW-36.21B2 visual and validation evidence

Captured with the real application HTML, scripts and styles in Chromium, using disposable local Board/catalog fixtures and intercepted transport. Board: **Autumn Launch / Canvas Brand X**; independently selected navigation Brand: **Selected Brand Y**. The existing Insights view is explicitly visited before preview captures to establish a real deterministic snapshot. Home itself performs no analysis or inference.

Each viewport/theme/language combination has an Insights-position and Brain-position capture:

| Configuration | Campaign Insights | AI Brain |
| --- | --- | --- |
| Desktop 1440, Light, EN | [Screenshot](insights-1440-light-en.png) | [Screenshot](brain-1440-light-en.png) |
| Desktop 1440, Dark, DE | [Screenshot](insights-1440-dark-de.png) | [Screenshot](brain-1440-dark-de.png) |
| Mobile 375, Light, EN | [Screenshot](insights-375-light-en.png) | [Screenshot](brain-375-light-en.png) |
| Mobile 320, Dark, DE | [Screenshot](insights-320-dark-de.png) | [Screenshot](brain-320-dark-de.png) |
| Tablet 768, system preference resolving Dark, DE | [Screenshot](insights-768-system-de.png) | [Screenshot](brain-768-system-de.png) |

[Geometry assertions](geometry.json) record no horizontal overflow in either module or their children at all five configurations. The suite also checks long names, native keyboard activation, focus after navigation/refresh, semantic labels, reduced motion and current Board/Brand isolation. Screenshots are evidence of local browser behavior, not production-data or physical-device acceptance.

Reproduce with `npm run check:bw36.21b2`. Screenshots default to `work/bw36-21b2-visuals/`; `BW36_B2_SCREENSHOTS` can override the destination. Chromium selection uses `CHROMIUM_PATH`, installed system Chromium, or Playwright's installed browser, matching existing repository fixtures.

`validation.json` records every run block from the complete Runtime Boot Safety workflow. Local setup verifies the already-installed dependencies and system Chromium in place of reinstalling them; validation commands run as declared. `focused.log` is the final B2 output from that full run. Individual complete-workflow logs remain in the execution workspace under `work/bw36-21b2-validation/`; the JSON preserves command, status, exit code, duration and log name for each block.
