# BW-36.22A — Compact Home and continuation

Implemented 19 October 2026 (Europe/Berlin), Phase A only. Baseline is latest merged `main`, `fd023dce45de359eb5847166e88a107cd5394de7`, including #792 and #793, confirmed with `git fetch origin main` before branching. The complete [BW-36.22 audit](../audits/bw36-22-home-ux-and-visual-design-audit.md) and relevant Home implementation records/source were inspected. The implementation request explicitly approves D1–D5; the archived audit's proposal status is unchanged.

## Approved decisions and Phase A boundary

- **D1:** factual Next Moves, fixed source order, existing summary eligibility and saved-Board fallback. No combined urgency, deadline, recommendation generation or automatic action.
- **D2:** compact authorized Brand selector at the top; complete Brand exploration moves below work, with every selection/Profile route and visible-to-you count preserved.
- **D3:** first six authorized entries from the existing ordered model, reversible in-place expansion, accurate available/visible counts and scope reset. This does not cap a catalog, entitlement or collection request.
- **D4:** navigation and scope remain explicit. Full intelligence copy, disclosures and AI Brain recomposition are deferred to Phase B; existing editor/read-only eligibility and explicit-question inference boundary remain intact.
- **D5:** effective 1200px Home width, compact header and Board density, existing theme/type tokens and intrinsic growth. Shared Board intelligence presentation and broader responsive polish are deferred to Phase B.

## Actual composition and context

The generated DOM, visual and keyboard section order is header → applicable context notice → Your Next Moves → Continue Working → existing B1 intelligence → existing B2 intelligence → all Workspace Brands. No CSS `order` or duplicate detail modules are used.

The header shows the selected Workspace's actual avatar/fallback, name and labeled native `#home-workspace-select`; a labeled native `#home-brand-select` uses the same catalog and `selectSessionBrand`. Workspace creation, permitted Brand management and selected-Brand Profile navigation remain accessible. The actual hydrated, authorized current Board has its independently authorized Brand relationship and a direct guarded Continue/view action. Exceptionally long selected Brand names also have wrapping text outside the native select. Header controls have 44px minimum hit heights.

Both selectors retain the confirmed value while the existing selection/leave adapters run. No additional Brand preference store, Board association assignment, Core mutation or forced Board switch is added. The mismatch notice sits immediately below the header. Its Home-only Board identity is incorporated into the same sentence; Continue, selected-Brand Boards and Profile actions remain separate, wrapping native buttons. Hidden and unassigned associations retain distinct wording. The separately owned Canvas notice is unchanged.

## Next Moves eligibility and navigation

The module reads the same already-available `learning`, `learningStatus`, `responsibilitySummary(c)` and `c.campaign` projections as the details. It has no fetch, polling loop, inference, diagnostic engine or persistent summary cache.

1. A selected authorized Brand with a successful aggregate, known positive `proposed` count and `canWrite` offers its existing Learning review navigation. The selected Brand is named; singular/plural EN/DE phrases are complete translations.
2. A current hydrated Board in the authorized Workspace catalog with a positive existing incomplete assigned-to-me count offers the existing responsibilities manager. Identity/completion/duplicate semantics are unchanged; the actual Board is named.
3. A fresh `ready` diagnostic projection with its evidence key offers the first applicable finding in existing engine order, with its actual translated title, supported severity and actual Board. It opens the existing guarded Insights destination.
4. Only when none of these is actionable, the first Board from the **unfiltered existing model order** is offered. If none exists, Browse Boards remains available; permitted project creation remains in Continue Working.

Denied, failed, pending and malformed/unknown sources do not become zeros. A concise unavailable notice links to each detail module and its existing status/retry controls. Valid zero proposals, no loaded Board, empty Canvas and no applicable finding retain their existing distinctions. There is no all-work-complete claim.

Every new button receives a captured render scope in a WeakMap; copied dataset attributes alone cannot authorize it. Additional Insights placements also use the existing B2 WeakMap with captured evidence. Activation rechecks current scope, catalog membership, eligibility and, for the Next Moves finding, the current first finding/evidence key. Workspace/Brand selection and mismatch routes revalidate their captured context. Scope is captured once per draw to avoid repeated large-Canvas fingerprint construction per button. Underlying action adapters remain authoritative for navigation and leave guards.

## Board preview and density

`model` is unchanged: selected Brand's connected Boards → other accessible Brands → unassigned/association-hidden Boards; known saved modification time descending within each group, missing dates last, catalog order for ties. The dedicated Boards library is untouched. An open foreign Board is highlighted in its actual group, never promoted; header Continue reaches it even outside the first six.

The initial preview slices only the rendered Board list. Show all reveals every currently available authorized entry, in unchanged order, without another read; Show less restores six. Counts describe currently available entries, including zero, rather than a complete organization-wide total. The original metadata coverage/recency explanation and retry remain visible. Collection names or Canvas timestamps never supply identities or saved dates.

Expansion resets on account/scope changes, Workspace, Brand/filter and the relevant Board ID/association/role collection identity. All existing controller invalidation still applies. Collapsing retains focus on the expansion button; collection changes recover an otherwise disappearing Board focus there when available. Responsibilities navigation returns focus through a lazy lookup for the originating summary/detail placement.

Cards use 32px identity art, 16px padding and 8–12px gaps, wrapping titles, actual relationship, current/read-only state, reliable saved modification date/unavailable wording, and explicit Open/Continue. Relationship and Brand share a concise line. No Board detail hydration is added. Three columns are used only above 959px of Home content width, two down to 640px, then one; the 1200px cap is effective through the Home-only parent override.

## DOM, lifecycle and accessibility

`index.html` is untouched: every static ID and mounted lifecycle node remains. Existing generated headings/select IDs, module/finding markers, context actions, B2 evidence validation and focus keys remain. New IDs are `home-brand-select`, `home-next-title` and `home-board-preview`, each generated once. Newly placed actions have distinct `header-*`/`next-*` keys. Native labels, buttons, lists, expanded/controls semantics, explicit Board action names and theme focus rings are used. No positive tab index is introduced.

B1/B2 detail renderers, projections, source copy and automatic diagnostic scheduler/engine remain unchanged, apart from shared action-scope validation and origin-aware responsibilities focus return. No new provider call, Learning request, Board read fan-out, Canvas write, serialization, association change, autosave change, API, schema, SQL or quota is introduced.

Mobile Home measures the existing fixed sidebar and floating context-control rectangles. Bottom padding alone would leave middle-of-page controls covered, so the Home scroll viewport ends above the earliest occupied fixed rectangle, with additional bottom/safe-area clearance and focus scroll margins. A focus collision fallback scrolls the target into view. This is confined to Home: global shell/Canvas geometry, navigation and preferences are unchanged. Resize/focus listeners are removed on disposal. Screenshots and measured scroll-viewport bounds verify the actual occupied area, not merely lack of horizontal overflow.

## Validation and visual evidence

**Final local result: 186/186 Runtime Boot Safety validation blocks PASS**, with two setup steps satisfied by installed dependencies/system Chromium. The initial Foundation selector failure was corrected and its full rerun passed. The new suite passes **10/10 groups**, B1 **17/17**, B2 **30/30**, R2.3 **30/30** and safe Workspace switching **96/96**. Final syntax and diff whitespace checks pass. The focused provider-free Chromium suite and all existing Runtime Boot Safety run blocks are executed; final results are recorded in [validation evidence](bw36-22a-visuals/README.md). The shared B2 fixture was extracted unchanged by default so both suites boot actual application HTML/scripts and use existing disposable data/transport interception. The new optional ten-Board fixture tests the presentation cap. All transport is intercepted before navigation, rejects provider/AI/analytics endpoints, asserts zero non-presence writes, and checks page errors.

The new suite covers section order/unique IDs, labeled selectors, header continuation/Profile keyboard actions, preference versus Board association, mismatch identity/actions, source eligibility and fixed order, unavailable/read-only/malformed/zero Learning data, responsibility identity/completion/duplicates, diagnostic freshness, exact model ordering, preview counts/expansion/reset, current highlighting, hidden/unassigned associations, fallback/Browse, stale/forged actions, focus recovery, repeated-render request reuse and immutable Canvas/association state. It also captures the viewport/theme/language/sidebar matrix and measures focus/overlay collisions. Existing suites supply Workspace/Profile dirty/busy guards, account/Board switching, Board boot/autosave, Learning governance, complete automatic diagnostics and BW-28/Advice regressions.

The existing Foundation contrast check now measures `.home-board-group`, the retained small accent relationship label, instead of the intentionally removed repeated “Saved Board” eyebrow. Its **4.5:1 threshold and all other assertions remain unchanged**. The first full-run attempt exposed that obsolete selector; the corrected suite is rerun, with the initial failure retained in the validation record. B2 assertions are unchanged; only its default fixture moved to a shared helper.

Actual desktop Light/EN mismatch measurements meet the audit targets: 134.5px header; Next Moves about y=239; first saved Board action about y=590 at 1440×900. Coordinates align the Home header to y=0, as the audit does. [Geometry](bw36-22a-visuals/geometry.json) records every captured configuration and the actual fixed-control rectangle. Current Board, mismatched Brand, no Board, several saved Boards, expanded list, desktop/mobile Light/Dark and EN/DE screenshots are included.

## Changed files

- `home-foundation.js`: composition, native Brand chooser, Next Moves, expansion, scoped actions and Home mobile clearance.
- `home-foundation.css`: Home-only compact header, continuation cards, content-width reflow, focus/theme/forced-color styling and safe scroll boundary.
- `language.js`: new complete EN/DE summary, unavailable and expansion phrases.
- `scripts/check-bw36-22a-compact-home.js`: new acceptance/regression suite.
- `scripts/fixtures/home-browser.js`, `scripts/check-bw36-21b2-home-insights-brain.js`: shared existing B2 fixture, no B2 assertion changes.
- `scripts/check-bw36-21a-home-foundation.js`: contrast target follows the new actual small accent label.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register the new suite.
- This record and `bw36-22a-visuals/`: actual evidence and validation results.

## Remaining limitations and Phase B

Long labels, DE and narrow widths grow intrinsically. The current Board's Continue remains visible in the narrow initial viewport, but Next Moves and the first saved card require scrolling in the populated mismatch scenario. Preserving full scope copy, all three notice actions, 44px targets and a clear fixed-control area takes priority over forcing a height target. Mobile scroll bounds deliberately reserve the floating controls' entire occupied band. These deviations are measured, not hidden through clipping/truncation.

The screenshots use existing local fixtures, not production data. Automated keyboard, forced-colors, reduced-motion, 320px reflow and root-text enlargement checks do not establish manual NVDA/VoiceOver or physical-device acceptance. Native browser zoom shortcuts in this headless Chromium did not change `innerWidth` or DPR; native 200%/400% zoom remains a manual acceptance item, distinct from tested reflow/text enlargement. Remote revocation still depends on the existing server/session refresh and destination reauthorization; no push permission channel is added. The existing collection coverage limit and saved-recency semantics remain.

Phase B owns full intelligence-card visual recomposition, concise explanatory disclosures, shared Board-scoped presentation and broader responsive refinement. Global shell redesign, AI recommendations, changed engine formulas, activity/visit tracking, schema/provider changes and Board association semantics remain outside scope. Delivery is one normal PR against main, without merging.
