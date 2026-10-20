# BW-36.22B2 — Real Brand Avatar and contextual personality

Phase B2 implements the saved accepted Brand Avatar, honest optional-read states, deterministic EN/DE speech and manual message selection inside the approved B1/B1R1 Living Workspace. The existing Board-scoped AI Brain entry remains the primary stage action. All detailed Home sections, legacy IDs, emoji shortcuts, continuation, guarded navigation and Board persistence remain in place.

Baseline: latest merged `main`, `a4523b14b38ed71ed4a26fca2cf91f60c8b59d31`, including PR #797. The Living Workspace audit, B1 report, merged B1R1 continuation/mobile recovery report and current Profile, Avatar, Home, Learning and Brain implementations were reviewed. Approved L1–L9 remain the design boundary. B3/B4, production SQL, new endpoints, providers, paid inference and generation are excluded.

## Data ownership and authorization

`canonical-brand-reader.js` is one application-level, volatile canonical detail owner shared by Profile entry and Home. It reuses authenticated `GET /api/brands/:id` and the existing `isCanonicalBrandDetail` ID, Core, revision, timestamp and access validation. Catalog membership authorizes attempting the GET; its logo or role never substitutes for a confirmed Avatar response. Board access alone cannot authorize Brand data.

The reader keeps at most one in-flight/resolved detail, keyed by account-object identity, normalized identity, catalog object/generation, Workspace, selected navigation Brand, requested Brand and catalog revision. Only the selected Home Brand is read. Profile retains its existing explicit catalog-authorized entry. There is no all-Brand read, Home Core cache, persistent storage, new backend contract, or Board snapshot fallback. Existing `sidebarProfileCache` remains a legacy Profile/sidebar projection and is never consulted by the new reader or Home Avatar.

Scope is checked before the request, after headers and after JSON. A response must pass the existing predicate and cannot precede a known catalog revision. Scope retirement aborts the shared transport and drops the entry; late results cannot be adopted. Same-scope concurrent reads, including freshness requests while a read is pending, share one promise. The optional 12-second timeout leads to an explicit failure state. Closing a consumer invalidates its own request token; another authorized consumer may still finish the shared read. Home/Board startup and autosave never await Avatar availability.

Profile continues to own its drafts, leave guards, save/verification GET, conflicts and canonical reconciliation. Successful reconciliation supplies its already-confirmed Brand to the shared owner and emits `funklix:canonical-brand-saved` with the Brand ID only. Home reprojects the accepted image through the same owner. Home never mutates Profile state, Core, canonical assets, Canvas, Board association, dirty state or revision. Canonical API/server session checks remain authoritative; this does not add immediate push revocation.

## Freshness and rendering

Home entry, visible focus and visibility restoration refresh settled detail. Pending authorized work is deduplicated. Account, Workspace, Brand, catalog and authorization changes retire the old projection immediately. Successful saves publish confirmed detail; its first authorized consumption also satisfies the immediate Home-entry refresh, avoiding a redundant GET after save verification. Later entry/focus refreshes and explicit Retry revalidate safely. No polling for Avatar data, timed speech rotation or generation is added.

Home reuses `FunklixBrandProfileSetup.acceptedAvatar`: both parent Brand DNA and Avatar must be user-approved, with the existing safe HTTPS/root-relative image contract. Home retains only the image URL and canonical edit capability as presentation data. Generated/unapproved drafts and Canvas snapshots are never promoted; catalog logos remain separate identities.

One ordinary image preserves its original content, proportions and background using `object-fit: contain`, without cropping, CSS image transforms or asset rewriting. Pastel halo, rings and depth remain outside the image. Accessible alternative text identifies the saved selected-Brand Avatar. The original asset is neither regenerated nor overwritten. No continuous motion or animation framework is introduced.

Loading, confirmed absence, canonical failure/denial and image failure are separate states. A failed GET never leads to the missing-Avatar onboarding claim. Confirmed absence offers “Bring your Brand to life” and the existing authorized Brand Profile at its Avatar section; read-only canonical capability instead explains that a Brand editor can save the Avatar. Home never starts generation. Image failures preserve the stage and offer a safe retry. Manual retry focuses the labeled Avatar group and preserves that focus through loading/result redraws.

## Deterministic speech and Brain context

Eligible messages follow this order:

1. Verified selected-Brand Learning proposals awaiting review, only with existing write/review capability and valid aggregate counts.
2. The first applicable current-Board structural finding from the existing fresh Home diagnostic projection, explicitly naming the Board.
3. Verified incomplete responsibilities assigned to the current account in the authorized hydrated Board, explicitly naming the Board.
4. Existing saved-Board continuation using the approved B1R1 selection and hydrated current name.
5. A neutral selected-Brand greeting, or generic greeting without Brand context.

No new Learning, responsibility, diagnostic or activity reader exists. Failure/loading/denial produces no invented count, health, growth, approval-today or campaign-success claim. Foreign Board diagnostics and responsibilities remain visibly Board-scoped rather than being attributed to the selected Brand.

Previous/Next are native buttons with translated accessible names, 44px targets, `aria-controls` and a readable position indicator. Explicit activation focuses the readable message; the stable focus key survives unrelated Home redraws. A selected eligible message key is retained across redraws. Scope changes reset it; evidence changes revalidate it. Automatic updates do not use an assertive/live announcement or timed rotation. Text comes from EN/DE templates and existing translated diagnostic titles, never from provider inference.

The Brain CTA still names the authorized saved editable open Board and uses the existing guarded Brain adapter. A selected-Brand/open-Board mismatch explicitly names both contexts. Read-only/no-Board states offer Browse Boards and accurate eligibility guidance. Opening Brain preserves its question draft and submits nothing.

## Validation and limits

The new provider-free B2 suite covers shared reads, both response race boundaries, account-object/identity/Workspace/Brand/catalog/revision retirement, access denial, timeout, both approval flags, missing image, image failure/retry, real Profile save verification/reconciliation, selected-Brand versus open-Board images, deterministic evidence, manual navigation, keyboard focus, EN/DE names, read-only/no-Board alternatives and actual Chromium Light desktop/mobile/Dark screenshots. The existing fixture rejects generation/inference endpoints and records writes; the one deliberate Profile-save test permits and checks its existing PUT then clears the fixture's expected write record.

B1 assertions are updated only where B2 replaces its explicit placeholder/static sentence and adds the authorized selected-Brand GET. Hierarchy, full detail preservation, authorization, continuation, no extra reads on redraw, no Canvas mutation, geometry, contrast, fixed controls, keyboard and theme assertions remain. Two pre-existing transient assertions documented in B1R1 are made deterministic without changing product timing, sleeps or tolerances: the Insights test waits for the existing destination-focus contract before asserting it; the static-stage test resolves the current DOM and computes every animation name in one JavaScript task, avoiding a detached ElementHandle during legitimate Home redraws. Both original focus/static properties remain required. The B1 matrix likewise resolves, focuses, scrolls and measures its current control in one task, retaining the no-fixed-overlay assertion and additionally requiring actual focus; background redraws cannot invalidate a Playwright scroll handle between these operations. The legacy Profile loader regression now exercises the actual shared reader and retains all existing stale-response, denial, malformed-response and isolation tests.

Screenshots use a deliberately synthetic 360×240 persisted/approved local PNG fixture, retained unchanged in `scripts/fixtures/brand-avatar-original.png`. They establish composition with arbitrary real image proportions, not the appearance of a production customer's Avatar. Chromium evidence does not establish physical-device or manual screen-reader acceptance, other engines, or remote image service availability. Existing global Profile localization is outside this change; new Home messages, state text and control names are translated.

Detailed validation results and screenshots are recorded in [the B2 evidence record](bw36-22b2-visuals/README.md). B3 can consume the same Home projections for signals without adding caches. B4 can decorate the existing image stage after motion approval; it must preserve original assets, authorization and user-operated speech.

Delivery is one normal, non-draft PR against `main`; do not merge.
