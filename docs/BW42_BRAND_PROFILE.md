# BW-42 Brand Profile redesign and upload investigation

## Initial audit (before implementation)

Base: latest main `2a697c9`, including PR #845. Both supplied references were inspected: approved Light Mode composition and Brand Assets failed-upload state. Application behavior is the feature inventory source.

Rendering owner: `brand-profile-setup.js`; scoped presentation: `brand-profile-setup.css`. `app.js` supplies canonical reads, context/permission guards, Team, DNA rendering, reconciliation, Snapshot and Advanced options. `index.html` owns the outer dialog, heading, Close, status, legacy edit form/actions and retry IDs. All must remain. `styles.css` owns the shell; BW-41 uses existing theme tokens in `ai-brain-visual.css`. The guided page has a restrictive 960px cap; modal has 720px containment. Scope is guided profile presentation, with no global shell changes.

Inventory: eleven ordered sections (Overview, DNA, Audience, Voice, Offers, Assets, Avatar, Learnings, Team, Campaign Sync, Review). Overview includes name, website/analysis, Brand description, Value Proposition, mission, vision, values and Founder Story beyond the mockup. DNA retains generation/preflight/draft acceptance and all fields. Audience retains personas and audience/ICP knowledge. Voice retains tone/messages/guidelines/keywords/rules/examples. Offers retains knowledge modules/offers/proof. Assets retains upload/discovery/removal, previews, colors/typography/references. Avatar retains direction/generation/review/acceptance. Learnings mounts independently; Team respects permissions; Sync preserves Snapshot; Review preserves website proposals and retries. Seven saved-data readiness groups are unchanged. Native buttons and section-heading focus preserve keyboard navigation.

Save/reload use canonical revisions and protected writes. Dirty baseline, single flight, context invalidation, conflicts, synchronization warnings, leave guards, project continuation and read-only access remain owned by the existing controller. No save logic changes are planned.

Upload trace: chooseFile validates existing formats/2 MB policy and reads local preview; logoMutation builds a versioned Workspace/revision/request-ID payload; submitLogo obtains preview/review and supports receipt-only recovery. The signed-session server checks Brand/Workspace authorization, validates bytes, writes immutable private Supabase storage, updates protected metadata, verifies readback and commits. Client verifies canonical metadata/image delivery and reconciles projections. Failure retains selected data; retry retains request identity. The screenshot only establishes successful local preview. Production request status/body and server-stage logs are unavailable. Baseline persistence, Chromium journey, initialization and response-loss/retry checks pass. No historical root cause or justified upload code correction is established; no speculative storage/auth/schema change is planned.

Expected blast radius: guided page/modal presentation and rendering classes only; upload investigation is independently reviewable documentation unless evidence proves a defect. All legacy IDs, callbacks, data contracts and authorization rules remain.


## Implemented presentation

The guided page now uses the available shell width with responsive gutters, preserving the original modal width. A lavender identity header groups the real logo, Brand name, existing website/intro copy, unchanged readiness count and a presentation-only progress ring. The original Close, heading/context IDs and legacy forms remain. Ordered navigation retains its handlers, saved statuses, labels, descriptions and active/focus outlines; decorative inline SVG follows the existing application icon approach. Identity cards share a desktop row. Independent Voice, Assets and persona groups use columns only at wide desktop sizes; narrative/review content remains linear. Fields, previews, status feedback and actions use existing Light/Dark tokens. The save action stays prominent in Review too. Mobile padding/scroll padding keeps management actions clear of existing floating shell controls without changing the shell.

Differences from the mockup are intentional: every Overview field (including website/analysis and Foundation knowledge) remains, so the page and save group extend below the mockup's crop. No explanatory card copy or new website-link action was invented. Existing native file selection and product-specific tools remain. Wrapping responds to actual translated labels and available width. Actual user assets are never replaced; screenshots use disposable existing image fixtures and fictional Brand data, not the user's account, logo or avatar.

## Actual browser evidence

These are screenshots of the running production application and event handlers in Chromium, with signed-session endpoints and disposable SQL/private-storage adapters. No generated screenshots or production/customer data. Inspected for credentials and personal information before publication.

- [Overview / Light desktop](screenshots/bw42/overview-light-desktop.png)
- [Brand Assets / Light desktop](screenshots/bw42/assets-light-desktop.png)
- [Voice & Messaging / Light desktop](screenshots/bw42/voice-light-desktop.png)
- [Tablet navigation](screenshots/bw42/overview-light-768.png)
- [Mobile header/navigation](screenshots/bw42/overview-light-375.png)
- [Mobile Overview cards](screenshots/bw42/overview-light-mobile-content.png)
- [Overview / Dark desktop](screenshots/bw42/overview-dark-1672.png)
- [Upload failure with retained preview](screenshots/bw42/upload-failure-retained.png)

## Upload outcome and diagnostics

No upload-related runtime code was changed. Successful upload, private delivery, metadata persistence, failure with retained preview, retry and full-boot logo projection pass through the existing production handlers with disposable storage. Response-loss/replay, invalid files, unauthorized users, stale revision, failed storage/metadata/readback and context isolation are covered by existing regression suites. This does not establish the historical production incident's cause or prove production storage configuration is healthy.

The existing diagnostics distinguish `STORAGE_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, `UPDATE_FAILED`, `READBACK_FAILED`, `RESPONSE_INVALID`, invalid-file and authorization responses. For the historical incident, the remaining evidence needed is the failed `/write-preview` or `/logo` HTTP status/error code and, if emitted, `[BRAND_LOGO_FAILURE]` stage (`authorization`, `storage_upload`, `metadata_update`, `metadata_readback`, `response_projection`). Cookies, review tokens, base64 bytes and credentials are unnecessary for diagnosis and were not published.

## Validation and review

`npm run check:bw42` passes all eleven sections, readiness and focus, full-width layout, editing/save/reload, Avatar/Advanced navigation, upload failure/retention/retry/full-boot persistence, both themes, expanded/collapsed sidebar, desktop/laptop/tablet/375px/320px and 720×450 (200% reflow equivalent), keyboard, reduced motion, forced colors, German section reflow, long names, missing logo/URL and reachable mobile management actions. This is responsive reflow equivalence, not a native browser UI zoom measurement. Existing profile entry/Snapshot, decisions/conflicts/deletion, persistence and replay suites also pass. Complete Runtime Boot Safety matrix results will be recorded after the runs finish.

Codex code review: changes remain in guided rendering/presentation, tests/CI and this evidence. No app.js, upload handler, persistence, authorization, schema, provider or boot changes. All existing legacy DOM IDs remain. The lightweight DOM test fixture gains namespace element creation for SVG; its assertions are unchanged. Review caught and corrected active outline retention, focus-outline scroll overflow, modal positioning and floating-mobile-navigation clearance. Remaining uncertainty: the historical production upload failure cannot be attributed from the supplied screenshot.

Conditional workflow discovered by the full regression run: AI Brain Brand proposals insert an existing “Return to conversation” action beside the outer title. The title alone is visually hidden; its parent and return action remain visible. That conditional action row uses normal flow so Close and the identity header cannot cover it. No AI Brain logic was changed.

Contrast verification measures the actual computed gradient stops against rendered text for the active tab and primary Save action in both themes (minimum 4.5:1). It reproduced a 4.34:1 Dark Mode gradient endpoint; mixing the small highlight with white preserves the theme accent and raises that endpoint above the threshold. The regression test rejects either endpoint falling below 4.5:1.
