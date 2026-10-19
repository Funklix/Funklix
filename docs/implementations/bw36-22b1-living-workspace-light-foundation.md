# BW-36.22B1 — Living Workspace Light Mode foundation

Phase B1 implements the approved Light Mode reference composition as live Home HTML/CSS. A prominent generic greeting and saved-Board continuation sit beside a luminous, explicitly labeled Avatar placeholder, a static truthful speech bubble and the existing Board-scoped AI Brain entry. Four emoji shortcuts precede the complete detailed Home.

Baseline: `99cd35baf2ef7b2a255959fff8efcb4ea9c74125`, including PR #795. GitHub comparison confirmed this commit was identical to `main`; a subsequent successful `git fetch origin main` confirmed the same baseline. Work is isolated on `bw36-22b1-living-workspace`. The complete [Living Workspace audit](../audits/bw36-22b-living-workspace-light-mode-audit.md), [Home UX audit](../audits/bw36-22-home-ux-and-visual-design-audit.md), [Phase A record](bw36-22a-compact-home-and-continuation.md), and current Home, Profile/Avatar, Workspace, Canvas, Brain, Intelligence and theme integration were reviewed. The actual approximately 1672 × 941 reference image attached to this implementation request was visually inspected; it is not a production asset.

## Approved decisions and B1 boundary

The implementation request approves L1–L9 but authorizes **Phase B1 only**. The archived audit remains unchanged.

| Decision | B1 application / deferred boundary |
| --- | --- |
| L1 — Expressive entry, width, reduced header | Home-only effective maximum 1440px; compact real orientation; complete detailed Home follows the Living Workspace. |
| L2 — Accepted saved Avatar policy | Explicit neutral placeholder, never another Brand's logo or the reference character. Both-approval predicate and accepted original image integration remain B2. |
| L3 — Shared canonical detail | No new Home canonical read or cache in B1. Existing Profile loader remains unchanged. Shared read coordination is a B2 integration point. |
| L4 — Brain context | Board-named CTA; visible authorized Board/Brand caption; explicit selected-versus-current mismatch; read-only/unavailable guidance and Browse alternative. |
| L5 — Continuation | Authorized matching current Board, then first connected Board in existing unfiltered ordering, then explicit current/available-Board fallback. Detailed ordering is unchanged. |
| L6 — Progress | No progress track, percentage, four-step state or inferred completion. Actual saved metadata and qualitative current/saved/view-only labels. |
| L7 — Bubble | Static EN/DE “Ready to explore your next idea?” No message-selection engine, rotation or AI. |
| L8 — Signals/lower row | Existing scoped navigation descriptions only. Aggregate signal pills/current-status recomposition remain B3; no fabricated timeline or metrics. |
| L9 — Assets/motion | Lightweight static CSS gradients, organic shape, rings and three decorative marks. No generated asset, motion, animation engine or dependency. B4 remains gated. |

## Composition and data integration

One existing `FunklixHomeFoundation.create` controller still owns Home. New `livingWorkspace` presentation consumes the existing minimized context and `rows`; exported pure `heroContinuation` selects one authorized candidate without changing `model`, filters or the full collection. There is no second Learning reader, diagnostics engine, responsibility reader, Board collection or AI path.

Generated reading order is orientation/selectors → Living Workspace (greeting, continuation, Avatar stage, shortcuts) → Workspace details/open-Board entry → existing mismatch notice → Your Next Moves → Continue Working → Brand Intelligence/Team Responsibilities → Campaign Insights/AI Brain → full Brand exploration. A two-column grid supplies the desktop split without changing keyboard/DOM order. Exactly one visible H1 is retained. The original header's open-Board entry is retained in the new details heading, with its `header-board` focus/action key.

`index.html` is unchanged. Every static lifecycle ID, hidden legacy dashboard sibling, Canvas mount, Profile dialog and Brain destination remains mounted. All detailed module heading IDs, findings, filters, six-Board preview/expansion, Create/Browse routes, source states/retries, Workspace management and complete Brand/Profile exploration are retained. Details are neither collapsed nor deleted.

Orientation uses the existing labeled native Workspace and Brand selects, confirmed-value behavior and guarded selection adapters. Workspace identity and selected Brand come only from the account-bound authorized catalog. Generic EN/DE greeting avoids inferring a preferred user name, time of day or personal recency.

Hero continuation is independent of the detail filter. A loaded candidate requires full current hydration and catalog Board membership. Its Brand association resolves from the current authorized `openBoard` projection into visible catalog Brands, so stale catalog association cannot relabel it or disclose hidden snapshot identity. Nonloaded candidates use catalog associations and the existing connected-Board saved-date order. Fallback scope is stated explicitly. Current viewer access is taken from the hydrated capability; other candidates use catalog roles. The CTA names the actual Board and offers View/Open/Continue as appropriate.

Saved dates come only from the existing metadata join, after catalog-ID intersection and valid date parsing, and are labeled “Last saved modification.” Unavailable/pending metadata remains explicit. No last-opened time, campaign strategy, personal history, progress percentage or campaign completion is invented. No Board is silently loaded to enable Brain.

## Placeholder and Brain stage

The static stage uses a reserved square slot, cyan/lavender/peach/mint Light accents, dimensional CSS depth, two orbital rings, a rounded HTML bubble and a prominent native Brain CTA. The abstract shape has no face or borrowed Brand identity. “Brand Avatar / Visual placeholder” is explicit, including German translation. The stage does not claim an Avatar is missing or accepted: no canonical detail has been read in B1.

The image slot is separate from the bubble, decoration and navigation and has a reserved aspect ratio plus `object-fit:contain` support. B2 can replace placeholder content with one accepted square or transparent image without reorganizing the stage. No saved image is generated, transformed, cropped or replaced by B1. Decorative layers are pointer-inert and hidden from assistive technology; the readable bubble is ordinary text, outside a live region. There is no timer, carousel, typing effect or automatic announcement.

Brain always uses the existing loaded saved editable Board. The CTA says “Open AI Brain for {board}”; its caption names the actual authorized Board association, with explicit selected Brand context on mismatch. Hidden/unassigned association wording remains distinct. Viewer/no-Board/loading states offer Browse and accurate eligibility guidance. The placeholder itself is presentation, not a misleading clickable Brand chat image.

## Action safeguards and lifecycle

New `living-*`, `stage-*` and `quick-*` actions are created through the existing button/placement factories. Every action captures the current render scope in the existing `actionScopes` WeakMap; Board destinations additionally use the existing `boardActionContexts` map. Delegation recognizes the new placement prefixes, then runs the original revalidation/adapter paths. Copied dataset attributes cannot authorize a control.

The four native shortcuts are 🧠 AI Brain, 📊 Campaign Insights, 📚 Brand Learnings and 👥 Team Responsibilities. Their descriptions distinguish selected-Brand Learnings from current-Board work. Unavailable actions remain keyboard-discoverable with `aria-disabled`, visible reasons and independent activation blocking. Existing details retain source retries and alternative navigation. Learning access is separately revalidated; Board membership does not grant Brand library rights.

Navigation preserves the existing Canvas/Profile leave guards, Board loader, editor/viewer rules, diagnostic evidence checks, Brain draft and destination focus. Opening Brain never submits a question or requests inference. Responsibilities use the existing manager and lazy origin lookup, restoring the correct new shortcut after a Home redraw. Stable unique focus keys preserve keyboard focus across asynchronous render updates.

Existing scope invalidation, request abort/post-response checks, account-object identity, normalized account identity, catalog/generation, Workspace/Brand/Board switching, logout/public-token behavior, and disposal remain controller-owned. The new presentation adds no network reader, polling, persistent storage, timer or event listener. It does not mutate Canvas nodes/edges/Core, saved snapshots, Board association, dirty state or revision.

## Responsive, theme and reference fidelity

Home-only width and resolved-Light decoration preserve the existing application rail, logo and emoji navigation. The reference's greeting/working-card left, expressive stage/bubble/Brain right, broad whitespace and pastel four-action row are implemented using the existing font and semantic theme tokens. Functional Workspace management/Profile controls replace illustrative inert search/notification chrome.

Content-width queries keep the split above 900px, stack the stage below continuation when narrower, switch actions to two columns below 1100px and one column below 520px, and grow intrinsically for German/long names. Mobile uses the existing `#dashboard-view` scroll owner and `updateClearance`/fixed-control/focus collision handling. Controls retain at least 44px height. No decorative transformation extends beyond the Home bounds. Narrow layouts prioritize full scope text and touch targets over forcing all content into one viewport.

Light-specific gradients and pastel treatments are scoped to resolved `data-theme="light"`, including system preference resolving Light. Dark uses the application's existing semantic surfaces/text/actions; no separate Dark visual concept or theme state is introduced. Reduced motion is static and forced-colors retains explicit boundaries/focus.

Intentional reference differences: B1 displays an explicit abstract placeholder rather than the glossy smiling character or saved Avatar. It omits unsupported health/presence, approvals-today, three opportunities, four-step progress, engagement uplift, activity timeline and handwritten artwork. Real saved dates and accurately scoped destinations replace example claims. No B2/B3/B4 implementation or paid AI/image request is included.

## Validation and evidence

The new provider-free Chromium suite covers 15 acceptance groups spanning the 25 requested concerns: hierarchy/detail preservation/static IDs; context and continuation ordering/fallback/permissions; hidden/unassigned and newer hydrated associations; truthful recency/progress/placeholder/bubble; all four navigation adapters and Brain draft/no inference; viewer and unavailable-library restrictions; account/logout/catalog/Workspace/Board switching and stale/forged controls; unchanged Canvas and no additional reads; EN/DE; Light/Dark/system; desktop/tablet/mobile containment, touch targets, focus restoration, reduced motion, forced colors and text enlargement.

All fixture transport is intercepted before navigation, rejects provider/AI/analytics endpoints, records API reads, and asserts no page errors or non-presence writes. It uses the existing actual Home browser fixture and application HTML/scripts, not a screenshot-only mock. Existing Home Foundation, Phase A, B1/B2, Avatar/Profile, Workspace, Canvas and Brain regressions remain in Runtime Boot Safety.

Final complete Runtime Boot Safety result and actual Chromium measurements are recorded in [the evidence record](bw36-22b1-visuals/README.md). Setup uses installed project dependencies and system Chromium. The previous Phase A test's exact hierarchy/geometry assertions are updated for the explicitly authorized inserted Living Workspace; it still verifies every detailed module in order, the full preview/filter/expansion, context, permissions and navigation. Its early-continuation gate now targets the new real saved-Board action rather than the intentionally lower detailed list. No authorization/contrast/focus/ordering assertion is removed or relaxed. The shared fixture adds API request observation only, leaving default transport/data behavior unchanged.

Actual screenshots include 1600×900, 1440×900, 1280×800 and 1024×768 Light, 375px Light, 320px Light/DE, baseline Dark/DE, system Light/Dark, actual lower details, selected-Brand/current-Board mismatch and mobile stage positions. Bounding rectangles, scroll viewport, all-descendant containment, fixed-control collisions, minimum hit heights and measured text/action contrast accompany the screenshots. Captures use fixture identities and saved metadata, never invented reference performance metrics.

## Changed files

- `home-foundation.js`: read-only continuation helper, Living Workspace renderer, compact orientation/detail boundary and new scoped placements.
- `home-foundation.css`: Home-only width, Light composition/decoration, token-based baseline Dark compatibility and responsive/focus rules.
- `language.js`: complete EN/DE presentation/eligibility/fallback phrases.
- `scripts/check-bw36-22b1-living-workspace.js`: focused acceptance/regression and screenshot/geometry evidence.
- `scripts/check-bw36-22a-compact-home.js`: explicit updated layout expectations; existing behavioral coverage preserved.
- `scripts/fixtures/home-browser.js`: observe API requests for no-extra-read assertions.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register the new provider-free suite.
- This implementation record and `bw36-22b1-visuals/`: actual evidence and validation record.

## Known gaps and next-phase integration points

B2 owns the shared authorized canonical detail read coordinator, accepted saved original Avatar/loading/error states, Profile save refresh and deterministic message selection. B1 neither uses the Profile cache as authority nor claims canonical Avatar availability. B3 owns eligible factual signals/status presentation and any separately supported assigned-node count. B4 owns approved motion and further polish; the current stage is fully static.

On phones the first screen prioritizes orientation and continuation; the full stage and quick actions require natural Home scrolling. Mobile stage captures demonstrate the actual nested scroll position rather than compressing controls or clipping names to mimic desktop. At 1600×900 and 1440×900 the first-screen split, continuation and quick actions are visible, with the details boundary immediately below.

Chromium evidence and automated focus/forced-colors/reflow checks do not establish manual NVDA/VoiceOver or physical-device acceptance. Native 200%/400% browser zoom remains a manual check distinct from tested 320px reflow and 200% root-text enlargement. Existing server/session refresh and destination reauthorization still determine remote revocation visibility; no new push permission channel is introduced. Existing catalog/metadata coverage limits and saved-recency semantics remain unchanged.

Delivery is one normal non-draft PR against `main`, with no merge, production SQL or deployment.
