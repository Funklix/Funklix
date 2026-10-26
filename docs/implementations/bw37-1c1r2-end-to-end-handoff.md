# BW-37.1C-1R2 — end-to-end Brand proposal handoff

Base: `7e22b567a98605dedc6d5e1346a2767665cafc17` (merged #823), verified against GitHub main before implementation. No merge or manual deployment is part of this delivery.

## Verified blockers and why green tests missed them

The newly supplied full failing reply establishes the direct content blocker: `Proposed Value Proposition:` followed by the exact quoted wording **Transform Your Passion into Profit: Join APPICS to Monetize Your Creativity in a Decentralized Community.**, then `Explanation:` immediately on the next line. Main rejects the missing blank separator, the unsupported `Explanation:` section, the ordinary phrase “proposed wording”, and quoted phrases inside reasons. The proposal itself already satisfies question intent and the exact single-value limits. This reply is now a verbatim parser and 36-node browser regression, including preview, staging and separate Save.

Two additional lifecycle blockers reproduce in production code:

1. **Catalog completion did not notify the AI Brain renderer.** With a 36-node Board, a supported answer arriving while the approved catalog refresh is pending renders without the action. The catalog subsequently becomes `ready`, but only the sidebar rerenders. Observed on unmodified main: action count is **0 while pending, 0 after catalog readiness, 1 after a manual AI Brain rerender**. The action's data was eligible; its DOM was stale.
2. **First catalog load can capture an empty Workspace identity.** Advice does not require a ready Workspace catalog. A source captured during first loading has no active Workspace ID. The previous predicate compares that empty ID against the resolved Workspace forever. A rerender alone cannot recover it. Complete only the exact pending catalog generation, with unchanged account, Board/load, Canvas, question/answer and persisted Board-to-Brand target; never retarget an older successful source after a later refresh.

A separate verified extraction blocker remains after #823: its numbered explanation grammar accepts only one line per sequential `N.` item. Realistic `2)` numbering, wrapped explanation paragraphs and a closing summary fail despite an explicitly bounded, unambiguous quoted proposal. The candidate grammar and exact value boundary remain unchanged; the separately headed explanation grammar accepts those variations and the supplied `Explanation:` prose. Explanation quotes are allowed inside prose, while explicit alternative fields/wording and standalone second quoted candidates remain rejected.

The previous browser regression used an **empty Board**, a catalog already loaded before submission, an owner role, and reason bodies literally recorded as `...` on one line. It exercised a valid happy path, so green CI did not establish the pending-catalog lifecycle or the complete natural answer format. These are deterministic coverage gaps, not evidence that Board ownership grants Brand edit permission.

The exact supplied reply fails content eligibility on unmodified main independently of authorization. Catalog races are additional verified defects; the user’s authenticated catalog/session state at failure remains unobserved.

## Full decision path

| Boundary | Required conditions / behavior |
| --- | --- |
| Advice request | Signed-in account, current Board, Board `canEdit === true`, no Advice already loading, nonempty question. The existing server independently authorizes the Board and context. |
| Response and storage | Existing Advice response must succeed and match response language. Request generation, Board/load identity and the complete projected Canvas/selection/edit context must still match. The client stores the original trimmed question and returned answer on the successful in-memory turn. No new transcript persistence. |
| Provider | Existing Responses request, output/context limits, `store: false`, approved-only Learnings and server revalidation remain untouched. No additional inference or classifier calls. |
| Content | Successful, non-clarification turn; answer at most 12,000 characters; question explicitly asks for Brand/Profile Value Proposition replacement wording. One recognized proposal heading and one exact nonempty value, at most 2,000 characters. Balanced Markdown labels/quotes; optional separately recognized explanation (with or without a blank separator). Competing values, unrelated fields, missing values, speculative/numeric/guaranteed wording and arbitrary strategic prose fail closed. |
| Account / source freshness | Same account object and email, Board/load identity, full request context, exact question/answer, no source invalidation, unchanged catalog generation and active Workspace. Public-link sessions cannot stage. |
| Approved catalog | `ready`, matching normalized account identity; active Workspace contains the exact persisted Board-to-Brand association; independent Brand role is `owner`, `admin` or `editor`. Server SQL determines Brand roles separately from Workspace and Board roles; browser validation rejects unknown role strings. Missing roles never become assumed permissions. |
| Pending metadata | Capture the generation already loading. Complete its Workspace ID only from that generation's approved catalog and the unchanged Board Brand target. Catalog completion rerenders the active AI Brain; rendering also resolves pending scope when returning to the view. Advice and catalog may finish in either order. A later catalog generation cannot revive old sources. |
| Board readiness | Association belongs to the current Board; Board is neither loading nor hydrating; current Board edit permission remains required. Sidebar selection cannot retarget the source. |
| Action DOM | `renderAiBrain` calls the real transcript renderer. Both content eligibility and current source/role gate must pass, and the turn must not already be staged. The actual button has its normal click binding. |
| Preview | Fresh authenticated, no-store catalog and canonical Brand GETs independently verify persisted association, Board edit and canonical Brand edit permission. Canonical values appear only after these checks. Denied/malformed/stale reads leave staging disabled and canonical value blank. |
| Staging | Editable preview; no existing dirty/busy/deferred Profile operation. Fresh canonical revision and exact old-value/existence validation, existing destination loader and `stageValueProposition`, final source/access revalidation. No writes or inference. |
| Save | Separate explicit existing Profile Save, existing protected one-field write command, canonical revision/old-value contract, write/history protections and authoritative reconciliation. Unrelated Brand Core and Board snapshot remain unchanged. |

No authorization enum normalization or backend ACL change was needed. The correction uses the existing approved single-flight catalog loader when metadata is missing/stale and refreshes the dependent renderer. It never derives Brand permission from Workspace/Board edit roles.

## Deployment and cache investigation

`index.html` loads `/app.js` as an ordinary static script without a content hash. There is no application service-worker registration or custom static cache override in `vercel.json`; existing API reads use their established no-store behavior. GitHub reports the #823 merge commit's Vercel status as **Deployment has completed** (2026-10-26 09:37:04 UTC). That confirms a deployment status, not the asset bytes loaded in the user's browser or its session metadata. No cache-busting edit, Vercel configuration change or deployment was performed. The failure above reproduces while serving the checked-out source directly, independently of a CDN cache.

## Regression evidence

`npm run check:bw37.1c1` now includes:

- A Board loaded with **36 Appics-like nodes**, independent canonical **editor** authority, the exact recorded question, the newly supplied complete failing reply verbatim, the original abbreviated R1 answer, and a full realistic natural answer with bold headings, quotes, blank lines, mixed numbering, wrapped reasons and closing summary. EN/DE parser variants are covered.
- The production catalog **SQL joins, role selection and projection** executed against disposable SQL, then the production browser validator/loader, real application bootstrap, Advice submission, transcript renderer and click flow.
- Catalog-after-Advice during refresh and first load, plus catalog-before-Advice during first load. Action visibility is asserted automatically after completion, without a test-invoked rerender or injected action. A newer composer draft survives.
- Independently eligible content while metadata is pending; absent/viewer Brand role; stale catalog generation; changed Board association. All remain hidden, with no canonical preview or writes. Existing cases separately cover account/Canvas changes, denied canonical reads, permission revocation, revision races, final staging races and conflict reload.
- Exact proposed text in the editable preview; current canonical value; edit/stage with zero writes; separate protected Profile Save; complete unrelated Core equality; no additional Advice calls.
- Existing mobile, theme, keyboard, focus/caret, conversation scroll/return, snapshot isolation, history/knowledge and destination contract regressions.

The R1 documentation/fixture records its original reason bodies only as ellipses; that fixture remains intact. During R2 the user supplied a complete failing reply with an `Explanation:` section; it is included verbatim separately. Additional natural EN/DE variations are synthetic test data. Optional `BW37_C1_EVIDENCE_DIR` saves a screenshot and DOM evidence JSON of the action after first-load completion.

Full Runtime Boot Safety executes every workflow test and syntax step for disposable PostgreSQL **17.6** and **18.4**. Dependencies are installed once; installed `/usr/bin/chromium` substitutes for the workflow browser download. Final results and GitHub CI/review status are reported in the PR handoff. Initial integration failures in older isolated fixture surfaces were corrected by keeping source completion in the actual renderer, without weakening tests or adding permission fallbacks.

## Scope and remaining limits

Changed files are `app.js`, `scripts/check-bw37-1c1-brand-profile-proposal.js`, `scripts/fixtures/home-browser.js` (pre-bootstrap data hook), and this report. No database schema, RLS, TLS, Vercel configuration, Advice provider policy/store, Campaign Creator, Learnings or write-contract change.

The extractor is intentionally conservative and cannot validate the truth of Appics income/reward claims. Preview is human review of an unverified proposal. In-memory conversations disappear on reload. Later catalog generations intentionally invalidate prior source eligibility; they require a new successful source. Live authenticated session state and the user's cached asset bytes were unavailable, so post-merge production acceptance remains a separate verification step. Do not merge or deploy as part of this task.
