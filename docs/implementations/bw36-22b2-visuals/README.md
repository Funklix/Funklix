# B2 validation and Chromium evidence

Baseline: `a4523b14b38ed71ed4a26fca2cf91f60c8b59d31`, including merged PR #797; rechecked with `git fetch origin main` before delivery. [Implementation and data ownership](../bw36-22b2-real-brand-avatar-and-personality.md).

## Runtime Boot Safety

Every validation run block in `.github/workflows/runtime-boot-safety.yml` was executed with declared dependencies and system Chromium. **All 189 validation blocks have final passing results**, including B2's eight acceptance groups, existing Home/Brain's 30 groups, B1's 15 groups, B1R1 and the complete mobile fixed-control regression.

This was **not a clean first-pass run**. The first complete sequence passed 179/189. Eight initial failures were test setup: missing declared `pg`/PGlite dependencies and a repository-copy test excluding the initially untracked new script. After `npm install --ignore-scripts --no-package-lock` and staging the new script, all eight passed. Two browser assertions reproduced the immediate-focus and detached/static-stage failures already recorded in B1R1. The tests now wait for actual Insights focus and inspect current DOM atomically, preserving the original requirements. A focused B1 probe also exposed a detached control between focus/scroll operations; the matrix now focuses, scrolls and measures its current target in one task, adding an actual-focus assertion while retaining exact no-overlay bounds. Final complete browser suites pass with these corrections. No product timing, sleep, tolerance or navigation changes were introduced for these test fixes.

Records:

- [Final results for all 189 blocks](runtime-validation.json) and [summary](runtime-summary.log).
- [Original complete first pass](runtime-first-pass.json), retaining its failures.
- [Eight setup reruns](runtime-setup-retries.json).
- [Two complete browser reruns](runtime-browser-retries.json), and [final B1 matrix verification](runtime-final-b1.json).
- B2: `npm run check:bw36.22b2` — eight groups PASS, including both canonical approval flags, missing/error/image/retry states, actual Profile PUT/verification/save refresh, pending scope retirement before headers/after JSON, hidden Brand versus authorized Board access, selected-Brand/open-Board mismatch, deterministic speech, keyboard focus and theme geometry.

Final syntax, browser-script integrity and `git diff --check` also pass. New B2 syntax and its acceptance suite are registered in Runtime Boot Safety. Transport is intercepted locally; providers and generation are prohibited. The intentional Profile-save fixture checks its one existing PUT. Disposable database fixtures never connect to production. No production SQL or paid AI/image request ran.

## Actual Chromium captures

These are screenshots of the actual application, production Home/Profile code and existing authorized API fixtures. The saved/approved 360×240 PNG is deliberately synthetic test art, not a production customer's Avatar or a generated reference mascot. Its original proportions and background remain visible, unchanged. [Geometry measurements](geometry.json).

| Scenario | Capture |
| --- | --- |
| Light desktop, EN, 1440×900 | [Home](home-1440-light-en.png), [Avatar stage](stage-1440-light-en.png) |
| Light mobile, EN, 375×812 | [Top of Home](home-375-light-en.png), [scrolled Avatar](avatar-375-light-en.png), [focused Brain CTA](brain-375-light-en.png) |
| Light mobile, DE, 320×740 | [Top of Home](home-320-light-de.png), [scrolled Avatar](avatar-320-light-de.png), [focused Brain CTA](brain-320-light-de.png) |
| Dark desktop baseline, DE | [Home](home-1440-dark-de.png), [Avatar stage](stage-1440-dark-de.png) |
| Selected Brand Y / open Board X | [Different accepted Brand image and explicit Board-scoped Brain](home-brand-board-mismatch-light-en.png) |
| Confirmed absent/unapproved Avatar | [Onboarding and authorized Profile entry](home-missing-light-en.png) |
| Accepted image cannot load | [Unavailable state and Retry](home-image-error-light-en.png) |

Finite theme transitions are completed only in the capture harness so screenshots show resolved theme colors. Full mobile viewport captures deliberately retain the fixed shell and real scroll clipping; the scrolled Avatar/Brain captures show what users can reach. Supplemental element captures may show clipping from that real scroll owner. Capture retries only handle an element replaced during a legitimate background redraw; functional assertions are not retried or relaxed by that helper.

Physical-device, manual screen-reader and non-Chromium acceptance remain unverified. Existing B1/B1R1 layout, detailed modules, static IDs, saved-Board continuation, authorization and autosave contracts are preserved. CI and Codex review status are reported from the live PR separately.
