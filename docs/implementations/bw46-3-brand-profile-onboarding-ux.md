# BW-46.3 — Brand Profile & Onboarding 2.0

Base: `2ccc44e4866ee2791cfa2314ded6d918a53b70ab` (merged #862). Dedicated branch: `bw46-3-brand-profile-onboarding-ux`. No migration, provider, background inference, merge or manual deployment. All research, AI, brands and browser screenshots in these checks are fictional.

## Architecture and dependency review

Read the BW-46 completeness audit, field matrix, BW-46.1 retrieval/completeness and R1 source-integrity implementation, and BW-46.2 evidence/enrichment implementation. Inspected `brand-profile-setup.js`/CSS, `brand-write-contract.js`, `canonical-brand-reader.js`, DNA preflight, module registry/dependencies, enrichment handler/contract, Founder extraction/mapping/generation/import handlers, `app.js`, `index.html`, localization, Brand ACL, actual browser fixtures and Runtime Boot Safety.

The existing 11 `SECTIONS`, section indexes, `data-profile-key` bindings, legacy DOM IDs, advanced editor, canonical reader, protected write contract and special module identities are retained. Additions mount inside the existing guided profile. The `app.js` seam supplies existing Founder field definitions, minimum-input validator and source-import dialog. No authentication, SQL, global theme, Board state or persistence architecture is replaced.

Dependency-sensitive behavior: draft edits survive section navigation; generation remains explicit and session-bound; existing leave/cache/Brand-switch protection stays authoritative. Native disclosures use stable, locale-independent keys to retain expansion across renders and language changes; a fresh controller does not inherit another Brand's disclosure state. Async operations preserve focus to a surviving action, the question input, proposal editor or section heading. The old isolated guided-profile DOM fixture now loads the same enrichment/write dependencies as production `index.html`.

## Navigation and presentation

| UI grouping | Existing destination / action |
|---|---|
| Overview | Overview; saved identity, coverage, assets, research entry |
| Brand Foundation | Foundation & Founder Story link reveals the existing Overview Foundation and structured Founder workspace |
| Audience & Positioning | Audience; Offers & Proof |
| Voice & Messaging | Voice & Messaging |
| Brand Identity & AI | Brand DNA; Brand Assets; Brand Avatar |
| Knowledge & Workspace | Brand Learnings; Team and permissions; Campaign Sync; Review |

These are disclosure groups, not new persistent entities. Every original destination remains reachable. Advanced canonical JSON editing remains available; supported read-only module presentations also link to it. Logo, Avatar, Learnings, Team and explicit campaign snapshot controls keep their existing authorities. Coverage is explicitly described as profile coverage, not factual verification.

Desktop uses a document/sidebar layout with compact field cards. The sidebar scrolls with the document so it cannot cover save actions. The profile menu is a native disclosure that starts collapsed when mounted at <=768px. It can remain expanded by choice. Existing central surface/text/border/focus/action tokens work in Light and Dark Mode. Narrative/structured fields get more room; shorter groups remain compact. Scoped hover rules prevent the global button scale from overflowing the navigation. Reduced motion and forced colors remain supported. Field-assistance and informational Website text use central text tokens rather than button accent colors; a measured 3.49:1 dark-mode field label was corrected to 14.03:1 Dark / 15.20:1 Light, and the actual browser now enforces >=4.5:1 for assistance text.

## Actual user flows

1. A new/minimal Brand sees **Let's build your brand ✨** expanded. A populated returning Brand (including saved voice, Foundation/Founder, visual or DNA content even without a description) sees its saved profile with a collapsed **Enrich your Brand Profile** invitation. Opening or revisiting never performs inference.
2. **Your website** is the prominent, keyboard-submittable research input. Direct Founder/About URL and natural-language brief are optional. Domain only, description only and combined input use the same BW-46.2 request. Creation's supplied/saved website prefills research. Public HTTPS syntax is checked client-side; the server retains authoritative SSRF/robots/retrieval checks.
3. **Research my brand** posts `action: draft` to `/api/enrich-brand-profile`. The selected domain uses BW-46.1 multi-page research, not the older analyzer adapter. Entry inputs are request drafts and never silently save canonical fields. The canonical Website editor remains the explicit place to save/change the Brand website; enrichment cannot infer domain ownership or change that field.
4. During the single pending request, a real aggregate loading state explains that source totals arrive at completion. No percentage, timer-driven phase or background job is invented. The returned envelope displays actual discovered/retrieved/extracted/processed/unavailable/excluded/deferred counts and individual source outcomes, redirects, gaps, module drafts and conflicts. The processing label means selected excerpts, not whole-page understanding. Partial results remain reviewable; failure retains inputs for retry.
5. Review shows current value, classification, checked short citations, editable draft, Accept, Reject and Complete later. Acceptance saves the chosen field and evidence through the protected controller; rejected/postponed decisions save metadata only. Other drafts remain optional. Discard enrichment draft explicitly clears volatile proposals. Missing-only results do not prevent a new request. An unresolved actionable/conflicting draft requires review or explicit discard before replacement.
6. Manual fields use existing editable bindings and explicit save/reload. Unsaved values survive navigation. Saved content can be edited/cleared again. A reproduced legacy Website defect is fixed narrowly: explicitly clearing the visible Website also clears an existing string `core.website` fallback, so it cannot reappear in a fresh session. Unchanged website saves do not create this intent. Discard changes restores the saved baseline. Website-free and short-description Brands can continue without completing optional strategy, Founder, DNA or assets.

## Field actions and evidence

The ten native enrichment groups (`brandCore`, `valueProposition`, `personas`, voice, pillars, guidelines, keywords, do/don't, voice examples, visual assets) and unambiguous plain mission/vision/values content expose a compact **Field assistance** disclosure:

- **Write myself** focuses the functioning existing input.
- **Suggest with AI** explicitly calls the existing `enrichProfile({action:'suggest',field})`; no automatic replacement.
- **Help me figure it out** calls `action:'questions'` without model inference, renders the localized question and accepts optional answers for a later explicit suggestion.
- **Complete later** is an optional, session-local presentation choice; the Review proposal's postponed decision is the durable evidence-backed choice.

An empty persona collection exposes all four actions without first saving a blank row; Write myself creates and focuses a real draft row only when chosen. Incompatible structured shapes link to Advanced options rather than presenting an inert manual action. Specialized moduleData is not advertised as general AI-editable. Ambiguous modules cannot adopt general suggestions. Saved values, unsaved edits, empty/optional fields, available suggestions, confirmed values and conflicts use text labels. AI classification/evidence never claims independent factual verification.

`editEnrichment` and `decideEnrichment` remain the adoption boundary. `_profileEvidence` retention, pruning, approved-only reuse and private-input exclusion from downstream contexts remain BW-46.2 behavior. Array replacement is deliberately reviewed; unrelated nested data survives. Brand revision, exact expected values, destructive preview, role checks, idempotent receipts and authoritative GET verification are unchanged. A newer manual edit cannot be overwritten by a stale draft. Disclosures/question answers/research inputs are volatile, not durable research-job resumability.

## Founder Story and DNA

The optional direct URL opens the established protected Founder website-import/review dialog with a prefilled URL. It continues to call `/api/extract-website-text`, `/api/map-founder-story-website` and `validateFounderStoryWebsiteImportFields`. Unsupported/unquoted facts are excluded, existing values are not automatically selected, and supported values remain manually editable before application.

The dialog has an explicit canonical adapter: it binds to the active profile session/tile, independently checks current context/role, and saves the existing `customTiles[].moduleData.founderStory` plus `founderStoryImport` through `session.save()`. Opening/canceling/closing or failing retrieval uses a preview-only tile outside the canonical draft. A new tile is attached only when reviewed facts are explicitly applied; failed adoption removes only that unsaved tile and retains the review for retry. Its original Board path still uses its original Board persistence. Neither path writes to the other's authority. There is no second Founder data model. Import marks structured facts as draft; it does not approve a generated narrative or DNA. Save failure retains the dialog and restores the prior module data.

The Founder workspace exposes all seven existing structured fields, direct narrative entry and existing `/api/generate-founder-story` generation with the established minimum-input validator. Generation returns an editable narrative draft bound in memory to the current Brand revision, stable tile ID, structured facts and prior narrative. Generation replies and later acceptance reject changed baselines; reload never silently rebases an old narrative over a newer edit. Explicit manual acceptance stages the currently reviewed narrative against its own fresh baseline. This adds no persisted source model. **Accept Founder Story** explicitly saves content plus the existing `founderStoryLifecycle.acceptedAt`; later structured corrections retire that acceptance until reviewed again. Ordinary legacy narrative text editing retains its original metadata-preservation behavior. Plain text alone is not represented as accepted structured Founder context. Duplicate Founder modules require advanced resolution.

DNA still uses existing optional Founder preflight, Continue anyway, generation and explicit `accept_dna`. Fix F6 binds generated-DNA text controls to `dnaDraft`, so a correction is what acceptance saves; ordinary stored DNA fields still bind to `core.brandDNA`. No auto-approval occurs. Existing Avatar and independent Logo authority are retained.

## Compatibility and permissions

| Entry point | Behavior |
|---|---|
| New Research my brand; existing Prepare enrichment draft; field assistance | BW-46.2 review-before-adoption, BW-46.1 research when domain supplied |
| Legacy website tools → Analyze website | Existing `session.analyze()`; protected automatic empty-field fill, existing-value comparison/review and separate logo preview |
| Legacy advanced campaign `analyzeBrandDomainFromEditor` | Original explicit-confirmation campaign snapshot importer; unchanged |
| Founder dialog without canonical adapter | Existing Board/tile context, cancellation, review and Board save |
| Canonical Founder dialog | Same retrieval/mapping/review with explicit protected canonical adapter |

Legacy handlers/IDs are retained. Four existing legacy browser suites now explicitly open the compatibility disclosure before exercising the unchanged path; their data/security assertions are preserved. No field/Board permission is inferred from Workspace visibility. Viewers have disabled inputs and no research/AI/import/save controls. Board-only collaborators still cannot acquire canonical Brand Knowledge through this UI. Learnings approval, DNA/Avatar acceptance, separate logo revision and explicit campaign snapshot isolation are unchanged.

Persona removal (F4) now removes exactly the selected row from the local draft, preserving others. Protected array save retains the existing destructive preview/confirmation. F3 accepted-strategy sourceNotes projection and other advanced-only aliases remain outside this UI change.

## Accessibility, localization and deterministic evidence

EN/DE uses `FunklixLanguage` including new onboarding, assistance, status and Founder copy. URL/description controls have visible labels; the primary URL has an explanatory description. Native form Enter submission, native disclosures, >=44px actions, visible focus, section-heading focus, modal Tab containment/Escape and focus return to the Founder workspace after import, status announcements and read-only controls are retained or added. Browser reflow covers 320/375/720/768/desktop CSS widths, both themes, reduced motion and forced colors. 720px models equivalent 200% reflow, not native browser zoom certification. Screen-reader semantics are inspected/tested through the DOM; no claim of a human screen-reader session is made.

`node scripts/check-bw46-3-onboarding-browser.js` uses the actual application, production enrichment handler/controller, protected HTTP writer and fictional local fixture. It captures implemented UI in `work/bw46-3/screenshots/`: Start, Research loading, Review, Field assistance, saved Profile in Light/Dark and Mobile. Runtime Boot Safety runs it on both PostgreSQL matrix jobs and uploads these images as `bw46-3-browser-postgres-<version>`. Images are generated application screenshots, never conceptual mockups. No screenshots, dependencies, raw logs, attachments, environment dumps or customer material are committed. The existing BW-42 capture matrix supplements this evidence.

## Validation results

Focused checks, local replay results and baseline comparisons are recorded below. The independent hosted PostgreSQL matrix is linked from PR #863. Current focused results: the new BW-46.3 actual-browser suite passes EN/DE description-only recovery after empty-input validation, combined research/loading/partial coverage, visible draft-retention guard, invalid structured draft validation, edited acceptance/rejection/postponement, optional questions (zero inference), all seven structured Founder field edit/save/reload, imported facts, corrected/accepted narrative, later fact correction, generated DNA correction, persona removal, independent canonical viewer denial, Light/Dark/reflow/keyboard/forced-colors and snapshot isolation. Existing BW-42 passes all 40 locale/theme/sidebar/viewport cases plus all 11 destinations, save/reload, advanced/snapshot access and 200%-equivalent reflow. Existing BW-46.1 field ledger passes all 28 bindings and 227 inspected leaf paths. Guided-profile isolated DOM checks pass with the correct production dependencies.

Real PostgreSQL 17.6 focused retests pass standard R3 (56 groups), legacy-upgrade R3 (65 groups) and restrictive-graph R3 (54 groups), with the unchanged protected-core legacy installer check also passing. The first full replay exposed an overstrict draft-replacement guard: missing-only suggestions must not prevent a later explicit request. The presentation guard now protects only unresolved actionable/conflicting drafts. A subsequent existing API/controller regression also established that this protection must live in the UI bindings, preserving the reusable BW-46.2 controller's explicit-request replacement contract. The final guard is UI-only; no canonical write/revision protection changes. A concurrent diagnostic R3 retry interfered with cluster-global role fixtures; the final retests were run sequentially and passed without modifying any SQL/security assertions.

The BW-43 `Expanded Journey sources reflow` assertion fails at line135 on both this branch and an unchanged checkout of base `2ccc44e`, using the same local Chromium. Its assertion is retained. This is a reproduced baseline failure, not counted as a pass. Full replay continues through other steps.

The disposable SQL browser adapter is distinct from real PostgreSQL. Local replay reuses installed dependencies and system Chromium; 17.6 uses the standard Debian image and 18.4 uses the official Alpine image to fit the disposable environment, so hosted image/browser parity remains a separate CI gate; hosted CI independently installs its browser and tests PostgreSQL 17.6/18.4. All original security assertions remain intact.

## Publication review and limitations

Scope consists of guided UI/controller/CSS/localization, the existing Founder dialog adapter, fictional browser tests, workflow registration and documentation/matrix updates. No secrets, customer inputs, provider outputs, live paid inference or external website requests are used in tests. Explicitly stage only this inventory; exclude `work/`, `node_modules/` and uploaded files.

Limits: generation semantic quality is not established by mock success; excerpt occurrence is attribution, not entailment. Research remains bounded/request-local. Research website input does not silently update the canonical Website field. Founder import is an explicit separate review action, even when a URL is provided alongside domain/description; accepted imported facts do not approve a narrative automatically. Advanced-only aliases and specialized strategy modules keep their existing editors/qualifications in the matrix. No universal completeness or factual accuracy claim follows from coverage or acceptance. Hosted CI/review is reported separately from local checks.

## Exact scoped file inventory

- `.github/workflows/runtime-boot-safety.yml`
- `app.js`
- `brand-profile-setup.css`
- `brand-profile-setup.js`
- `language.js`
- `docs/audits/bw46-1-brand-field-integrity-matrix.md`
- `docs/implementations/bw46-3-brand-profile-onboarding-ux.md`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js`
- `scripts/check-bw36-13r5-brand-lifecycle-stability.js`
- `scripts/check-bw36-13r6-brand-profile-decision-and-deletion-ux.js`
- `scripts/check-bw46-1-brand-fields-browser.js`
- `scripts/check-bw46-3-onboarding-browser.js`

Existing Founder website mapping/import lifecycle, Founder-to-DNA context/archetype lifecycle and DNA preflight suites also pass after the final localization/boundary changes. The browser-script integrity check passes all 49 classic scripts; all seven PostgreSQL TLS groups and `git diff --check` pass.

The implementation is committed and pushed to the dedicated branch. The first PR creation was rejected by automatic approval review; the user subsequently authorized this exact public non-draft PR directly in chat. Publication proceeds under that authorization. Public, non-draft [PR #863](https://github.com/Funklix/Funklix/pull/863) is open and verified (`draft: false`). The final head and hosted PostgreSQL matrix outcomes are reported separately; no merge or manual deployment is performed.

## Completed local replay and PR review corrections

All 230 Runtime Boot Safety run blocks were accounted for on PostgreSQL 17.6: 228 executed and two setup equivalents reused installed dependencies/system Chromium. After focused corrections and unchanged serial retests, 227 executed blocks pass; the remaining BW-43 local-browser reflow assertion reproduces unchanged on base. The otherwise-skipped native zoom subcommand was run separately and passes. The independent hosted workflow has already passed BW-43 on both matrix versions, confirming that local result is not reported as a hosted failure.

The initial failures are retained in the evidence, not hidden: the draft guard/isolated DOM dependency were corrected; the three real-PostgreSQL variants passed sequentially after avoiding shared-role fixture interference; the Social browser reload timeout passed its unchanged serial retest; all three locale/disclosure Logo/Avatar regressions pass after stable disclosure keys. No security assertion was removed or weakened. The additional local 18.4 replay uses an isolated worktree and the same reviewed production files; its completed role gates and any ongoing/partial duplicate replay are distinct from the hosted final-head matrix.

Automatic PR review reported two P2 findings. Both were reproduced before correction in the actual browser: empty Audience had zero AI actions, and opening/canceling Founder import made the profile dirty. After correction the same observations are one AI action and `dirty: false` throughout opening/canceling.

- Founder import now previews an unattached tile. Browser regressions cover Cancel, Close, retrieval failure, failed protected save with retained review, explicit retry/adoption and focus restoration; no empty module is persisted or left dirty by those exits.
- Empty Audience exposes Write myself, Suggest with AI, Help me figure it out and Complete later. Browser regressions verify actual row/focus creation only on manual intent, questions without inference/dirty state, editable explicit AI adoption without a prior blank-row save, and unchanged campaign snapshots.

The expanded actual-browser suite passes both EN/DE main journeys, all seven Founder field edit/clear/reload/subsequent-edit cycles, empty narrative validation, stale-Founder rejection after manual input changes, the independent Viewer case, empty-Audience actions and full-page legacy Website clearing/re-editing. The production-controller fixture additionally rejects changed sources during generation and a newer revision after reload. All model responses are fictional; no live paid inference is used.
