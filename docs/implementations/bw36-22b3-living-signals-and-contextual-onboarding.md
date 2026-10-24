# BW-36.22B3 — Living Signals and contextual onboarding

Baseline: latest merged `main`, `7c5371e63a9c4cee7ba2787343a4e8d1f71789c3`, including PR #811. Implements approved L8 and canonical contextual onboarding from the Living Workspace audit. No merge or deployment is part of this delivery.

## Signals and source boundaries

The existing Living Workspace shows at most two compact, keyboard-operated status pills. Priority is confirmed pending selected-Brand Learning reviews, the first current-Board diagnostic, exact authenticated-user incomplete responsibilities, then authorized saved-Board continuation. A third signal is deliberately omitted on every layout.

Learning reviews require the existing valid Brand-matched aggregate, positive safe-integer count and explicit review/write capability. Their caption names the selected Brand and Learning reviews. Board diagnostics require a hydrated catalog-authorized current Board and the existing fresh diagnostic status/key; their caption names the actual current Board and Canvas diagnostics. Responsibilities reuse the existing Board/generation projection, supported-node filtering, duplicate rejection, normalized exact owner email and incomplete status; their caption names the current Board, Team Responsibilities and current loaded/live unsaved Canvas. Saved continuation uses the existing catalog-authorized B1R1 candidate and hydrated name, without an activity or recency claim.

Missing, loading, stale and denied projections yield no factual signal for that source. Another independently eligible source may appear instead. Zero and completion are never inferred from missing data. Selected-Brand Learning facts remain independent of a mismatched current Board. No health, growth, performance, AI insight or activity timestamp is introduced.

Every signal action uses the existing Home button/placement factories and original destination adapter. Delegation checks the controller-owned scope, current eligible signal and, for diagnostics, its captured fresh key/finding. Reinserted old elements and copied dataset attributes cannot authorize navigation. Responsibility dialog return focus resolves its current Home origin after redraw. When reauthorization removes a focused signal or next step, focus moves to the stable Home heading and survives the result redraw.

## Canonical next step

Home derives one next step from the existing `FunklixBrandProfileSetup.readiness` result of the same authorized canonical read used by the B2 Avatar. Only a confirmed `partial` or `empty` section produces guidance. Fully complete/neutral readiness, pending reads, denial, failures and unreadable readiness produce no incomplete-profile claim. The Home controller retains only the section and canonical capability; it does not retain another Core or introduce onboarding storage.

The next step names the selected Brand and specific Profile section. Editors receive an open-section action. Canonical viewers receive editor guidance and a view-section action, using the same role/capability rules as Profile. Existing Profile entry now accepts its existing section allowlist rather than only Learnings/Avatar. The existing reader, authorization, draft/leave guards and Profile workflows still own entry and writes. Returning restores the current Home origin, or the stable Home heading while canonical readiness refreshes; focus survives subsequent redraws. Readiness failure cannot hide an independently confirmed accepted Avatar.

## Presentation and preserved contracts

The pills sit below continuation, with a compact next-step surface beside the accepted Avatar. Semantic theme tokens provide the Dark baseline; Light uses muted mint/lavender status surfaces. The next-step action shares its row on desktop and stacks on phones. Small desktop spacing adjustments preserve the existing first-screen quick-action requirement. Continuation and Brain CTAs use explicit wrapping label elements and reserve their decorative arrow width at enlarged text sizes. Signal pills override the application's global button hover scaling, keeping full-width pills inside Home at enlarged text. Names and scope text wrap, native controls retain 44px targets, existing focus rings remain visible and EN/DE strings cover the new presentation. There is no new animation or automatic message rotation.

B1/B2 composition, accepted original Avatar, deterministic/manual messages, all legacy IDs, detailed Home sections and destinations remain. There are no new API endpoints, reads, caches, provider calls, timers, polling, schema/DDL changes, Brand writes, generation paths or history changes.

## Validation and review limits

The provider-free B3 suite covers seven acceptance groups: eligible/missing/stale/denied evidence and exact ownership; incomplete/complete canonical readiness; real destinations and mismatch scopes; canonical viewer/loading/failure states and section entry; Learning capability and fallback sources; account/Workspace/Brand/catalog switching races plus forged controls; and actual Chromium EN/DE, Light/Dark, desktop/mobile, focus, 200% root-text enlargement and forced colors. The fixture rejects provider endpoints and records all requests and non-presence writes. B3 performs no write; presentation redraws add no read.

Run `npm run check:bw36.22b3`. It is registered alongside B1/B2 in Runtime Boot Safety. [Visual and runtime evidence](bw36-22b3-visuals/README.md) records final results and screenshots.

Chromium fixtures establish application behavior and layout with the unchanged synthetic accepted B2 Avatar asset, not production customer identity. Manual NVDA/VoiceOver, physical devices and native browser zoom remain manual review checks. Existing server/session reauthorization governs remote permission changes; this change adds no permission push channel.

## Changed files

- `home-foundation.js`: pure signal/readiness projections, scoped status/navigation, canonical next step and stable focus fallback.
- `home-foundation.css`: compact token-based status/next-step surfaces and responsive layout.
- `language.js`: EN/DE presentation templates.
- `brand-profile-setup.js`, `app.js`: existing Profile section entry and lazy return-focus support.
- `scripts/check-bw36-22b3-living-signals.js`, `package.json`, `.github/workflows/runtime-boot-safety.yml`: provider-free acceptance and regression registration.
- Existing Home foundation, Intelligence, compact Home, B1 and B2 scripts: preserve every assertion and expose failure stacks in CI annotations when log downloads are unavailable. Home foundation also reports internal overflow measurements. The workflow groups the existing Home cluster early without removing or duplicating any of its 201 run blocks.
- This implementation record and `bw36-22b3-visuals/`: review evidence.
