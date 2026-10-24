# B3 validation and Chromium evidence

Baseline: merged `main` at `7c5371e63a9c4cee7ba2787343a4e8d1f71789c3`, including PR #811. [Implementation and source boundaries](../bw36-22b3-living-signals-and-contextual-onboarding.md).

## Focused acceptance

- B3: all seven acceptance groups pass. [Machine-readable acceptance and geometry](validation.json).
- B1: all 15 groups pass, including its unchanged first-screen, contrast, reflow, fixed-control clearance and keyboard geometry assertions.
- B2: all eight groups pass, including canonical scope races, original accepted Avatar, Profile save reconciliation and deterministic manual messages.
- Changed JavaScript syntax and `git diff --check` pass.
- Complete Runtime Boot Safety and GitHub CI results are recorded after the ongoing full run completes.

The first B3 test runs corrected fixture expectations (persisted logo metadata, the responsibility dialog ID and the actual three owned incomplete nodes). The dialog test now waits for the existing team-loading hold to finish before Escape, then waits for its native close/focus event. Product timing and permissions are unchanged. An initial B1 run exposed a real desktop geometry regression from the added content; compact desktop spacing and the next-step action layout fix it. No existing B1/B2 assertion was relaxed or removed.

## Actual application screenshots

These captures use the production Home/Profile code and existing authorized local API fixture. Providers are rejected, requests/writes are recorded, and the original accepted 360×240 B2 Avatar fixture is unchanged. It is synthetic test art, not a customer Avatar or generated mascot. The mobile signal and next-step captures show actual Home scroll positions above the fixed mobile controls.

| Layout | Screenshot |
| --- | --- |
| Desktop Light, English, 1600×900 | [Home](home-1600-light-en.png) |
| Desktop Dark, German, 1440×900 | [Home](home-1440-dark-de.png) |
| Mobile Light, English, 375×812 | [Signals](signals-375-light-en.png) |
| Mobile Dark, German, 320×740 | [Signals](signals-320-dark-de.png), [next step and keyboard focus](next-step-320-dark-de.png) |

Automated coverage includes 44px control targets, no horizontal document overflow, EN/DE source labels, original Avatar URL, no continuous animation, 200% root-text enlargement, forced colors and keyboard focus. B1 additionally retains the broader theme/system preference, contrast and fixed-control matrix. Manual screen-reader/physical-device acceptance and native browser zoom remain review checks; no such manual result is claimed.
