# BW-42 — Brand Profile redesign and logo upload investigation

Base: `2a697c9`, latest `main` when work began, including merged PR #845. Work is confined to the existing Brand Profile. The user supplied one approved Light Mode mockup; no other visual reference was requested or used. The preimplementation inventory was written before edits in `work/bw42/preimplementation.md`.

## Scope and feature inventory

| Owner / section | Preserved functionality |
| --- | --- |
| `index.html`, `app.js` shell | Existing dialog IDs, Close, regular in-flow page, guided project modal, sidebar navigation, leave guards, account/Workspace/Brand context, advanced editor, conditional AI Brain return-to-conversation action and conflict/retry controls. No shell edits. |
| Overview | Official logo/initials and add/change navigation, accepted Avatar/empty/error and open/create navigation, name, website, analysis, description, value proposition, conditional mission/vision/values/founder story. |
| Brand DNA | Existing renderer; archetypes, personality, positioning, reasoning, recommended voice/visual direction, signals and structured fallbacks; Foundation; founder-story preflight, continue/generate/accept. |
| Audience | Persona name/description and additional properties, add audience, existing audience/ICP modules. |
| Voice & Messaging | Tone, messages, content guidelines, keywords, do/don't, good/avoid examples and structured fallbacks. |
| Offers & Proof | Offers/proof/value proposition and existing product/business-plan/pitch-deck/whitepaper modules. |
| Brand Assets | Logo status, persistent file input, file name, local preview, upload/change/remove, discovered candidate confirmation; colors, typography, references and structured fallbacks. |
| Brand Avatar | Saved/draft image, unavailable state, prompt details, direction, generate/regenerate/accept. No Avatar was regenerated for this task. |
| Learnings | Existing library mount, governed review and integration. |
| Team and permissions | Existing supplied member renderer and read-only guard. |
| Campaign Sync | Explicit campaign snapshot action and existing explanatory copy. |
| Review | Existing summary, upload, website suggestion comparison, keep/use/retry, loading/error/status. |
| Management | Explicit save, latest/saved reload, conditional project save-and-continue/back, conditional campaign snapshot and advanced options. Pending, dirty, read-only, conflict, reconciliation, generation and focus contracts remain. |

All 11 sections keep their order and controller. Readiness still uses exactly seven saved-Brand groups; Learnings and management sections do not change the denominator. Current selection and complete/partial/empty/neutral statuses retain separate semantics and accessible descriptions.

## Presentation

Scoped CSS removes the 960px in-flow page cap and expands the guided modal from 720px to a fluid maximum of 1440px. The existing application shell still determines space beside expanded/collapsed navigation. The identity header groups the official mark, existing Brand identity, website, introductory copy, completion and Close. Its decorative ring derives from the unchanged readiness count.

Wrapped navigation pills use local decorative SVG paths, accessible text and unchanged handlers. Identity cards use two desktop columns; editable groups use responsive columns with stacked mobile layouts. Form, proposal, persona, upload and management surfaces share theme-token borders, radii and purple accents. Save stays prominent on Review as well. Existing theme tokens supply Dark Mode, including primary button foreground. Focus, reduced motion and forced colors remain supported. Mobile page padding leaves space for existing floating application navigation.

The original shell title/description remain available to assistive technology; the same copy is presented inside the identity header. No fields, content modules, statuses or actions were removed. No models, authorization, persistence, generation logic, providers, schema or dependencies changed.

### Differences from the approved mockup

- Real Overview contains website analysis and Foundation fields beyond the name field visible in the mockup. These remain, so management actions can be below the fold.
- The application shell is unchanged, including its existing top-bar visibility and mobile floating navigation. The screenshot's shell was not recreated globally.
- Cards retain existing product copy rather than adding mockup-only descriptions. Decoration uses restrained gradients instead of large wave artwork.
- Verification images use a fictional Brand, existing fixture Avatar and initials where no official logo exists. No Appics branding, personal identity, supplied reference artwork or production data is hardcoded or published.
- The website remains existing display text; no new external-link workflow is introduced.

## Independent logo upload investigation

1. `chooseFile` enforces existing PNG/JPEG/WebP/GIF and 2 MiB rules, reads base64 with FileReader and retains a local preview.
2. `logoMutation` captures Brand/Workspace/revision/request identity. `brand-write-contract.submitLogo` requests the protected preview, obtains existing replacement confirmation and posts JSON to `/api/brands/:id/logo` with same-origin authentication.
3. The route verifies session, Brand role, Workspace membership, revision and protected review, checks signature/dimensions and uploads an immutable private object through `_brand-logo-storage`.
4. The protected lifecycle persists metadata; readback is verified before COMMIT. The exact receipt supports retries. Client checks response identity/revision, reloads Brand, reconciles views and verifies image delivery. Ordinary profile save does not persist a local preview or overwrite logo metadata.

The exact generic message has two call sites in `brand-profile-setup.js`: the upload exception fallback in `run`, and the unsuccessful-response fallback in `logoMutation`. Transport/JSON failures and otherwise unclassified API failures can produce it. Authorization, stale state, unsupported images, database/storage availability and committed-but-unsynchronized outcomes also have dedicated handling. The obsolete unbound upload endpoint is retired (410); guided upload uses the bound route.

`check:bw42:upload` executes production controller, session/authentication, preview, logo handlers, protected lifecycle adapter and private-storage adapter with disposable SQL/storage. Injecting a metadata failure reproduces the exact generic message while retaining the file and preview. Removing that injected failure and retrying succeeds with one immutable object; authenticated delivery/reload preserves the logo and the original Core. Invalid selection and unauthorized requests remain rejected. Existing replay and persistence suites independently cover lost responses, revision strings, ownership/roles, stale writes, readback/commit failures, replacement, synchronization and reload in Chromium.

An additional check in the existing R3 PostgreSQL suite executes the complete production controller → protected preview → upload → authenticated image read → Brand reload path with the real restricted runtime login and the complete production migration chain. Only private Storage HTTP is mocked; the production storage adapter still constructs and reads the immutable object. It verifies one history event, unchanged Core/revision and persisted logo metadata/bytes. Normal, legacy-upgrade and strict-role graph variants are checked on both PostgreSQL versions. The minimal Core-only fixture does not include application Workspace authorization reads, so it is not used as a substitute for the full runtime migration fixture. No fixture permissions were broadened.

**No new production code defect was demonstrated. No upload production code was changed.** The older nullable-outer-join lock defect described in the repository's R5R4 investigation was already corrected before this task; it is not a new BW-42 fix. Supabase's public current duplicate-object definitions were also checked; they use HTTP 409, already handled by the adapter, so no speculative status mapping was added.

The original production incident remains unattributed. Injected fixtures establish behavior under specific failures, not live service health or resolution of that incident. No live database, private storage, server logs or production credentials were inspected. A production incident correlation/retest remains outstanding.

## Validation and evidence

The new actual-application Chromium suite covers 40 combinations: Light/Dark × EN/DE × expanded/collapsed sidebar × 1672/1366/768/375/320px. It checks overflow, unobstructed Close and management actions, available desktop width, Assets and text-heavy fields, all 11 sections, edits surviving navigation, production-route save/reload, campaign snapshot navigation, advanced/back, keyboard focus and reduced motion. A 720×450 CSS viewport models 1440×900 at 200%; this is equivalent reflow, not native browser zoom.

Screenshots are actual application output using local authenticated fictional fixtures, not additional design inputs:

- [Light desktop Overview](bw42-visuals/overview-light-1672.png)
- [Light desktop Assets](bw42-visuals/assets-light-desktop.png)
- [Light desktop Voice & Messaging](bw42-visuals/voice-light-desktop.png)
- [Light tablet navigation](bw42-visuals/overview-light-768.png)
- [German tablet navigation](bw42-visuals/navigation-de-tablet.png)
- [375px mobile](bw42-visuals/overview-light-375.png)
- [320px mobile](bw42-visuals/overview-light-320.png)
- [Dark desktop Overview](bw42-visuals/overview-dark-1672.png)
- [200% equivalent reflow](bw42-visuals/overview-200-percent-equivalent.png)

Complete local Runtime Boot Safety results: [per-command evidence and corrected reruns](bw42-runtime-boot-safety.json).

| Validation | Result |
| --- | --- |
| PostgreSQL 17.6 | All 223 original workflow command steps executed; four initially failed steps corrected and rerun successfully. New BW-42 registered check also passes. |
| PostgreSQL 18.4 | All 224 current workflow command steps pass; no failures in the complete run. |
| Complete real upload, each version | Normal runtime: 55/55 groups; legacy upgrade: 64/64; strict role graph: 53/53. All six runs pass. |
| BW-42 actual application browser | 40 theme/language/sidebar/viewport cases, all 11 sections via keyboard, save/reload, snapshot, advanced, loading identity, focus, reflow and reduced motion pass. |
| Independent upload investigation | Exact injected metadata failure, preview retention, retry, delivery/reload and rejection checks pass. |
| Browser script integrity and changed script syntax | Pass. |

The four initial failed steps were the legacy DOM fixture API mismatch, the AI Brain return control, and two existing logo browser suites checking the same current-section outline contract. All were corrected without weakening assertions; initial outcomes and corrected reruns remain in the evidence JSON. Relevant Brand Profile, DNA, Avatar, AI Brain, Canvas, campaign, localization, boot and security regressions pass.

The local runner executes every workflow command step, substitutes only disposable localhost database ports, and verifies existing dependencies/system Chromium with explicit load/browser smoke checks. Local PostgreSQL uses official 17.6 Debian and 18.4 Alpine images; the smaller 18.4 image accommodates workspace disk capacity. GitHub Actions retains its standard 17.6/18.4 images, fresh-install and artifact-upload steps and will run on the PR. Hosted CI results are separate from these completed local results.

## Review and publication

Review findings corrected: the active navigation hover/focus specificity, long mobile/German labels, floating-footer clearance, the conditional AI Brain return action, and preservation of the legacy title/description while a reopened Profile is loading. The existing AI Brain/Profile integration rerun passes without changing its assertions.

Self-review checks preserved IDs/listeners and section/field contracts, scope of selectors, theme specificity, status semantics, mobile word wrapping/footer clearance, current-state snapshots and independent upload test coverage. The lightweight legacy DOM fixture was extended with SVG creation and CSS property APIs required by the new presentation; existing assertions were retained. No new package was installed.

Documents and screenshots were checked before publication for secrets, personal information, real Brand identifiers and sensitive service data. Only fictional fixtures and repository-level implementation details are included. Raw operational logs and scratch files are excluded from the commit. No merge or deployment is performed.

## Exact changed files

- `.github/workflows/runtime-boot-safety.yml`
- `brand-profile-setup.css`
- `brand-profile-setup.js`
- `package.json`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-23a-r3-runtime-postgres.js`
- `scripts/check-bw42-brand-profile-browser.js`
- `scripts/check-bw42-logo-upload.js`
- `docs/implementations/bw42-brand-profile-redesign.md`
- `docs/implementations/bw42-runtime-boot-safety.json`
- `docs/implementations/bw42-visuals/assets-light-desktop.png`
- `docs/implementations/bw42-visuals/navigation-de-tablet.png`
- `docs/implementations/bw42-visuals/overview-200-percent-equivalent.png`
- `docs/implementations/bw42-visuals/overview-dark-1672.png`
- `docs/implementations/bw42-visuals/overview-light-1672.png`
- `docs/implementations/bw42-visuals/overview-light-320.png`
- `docs/implementations/bw42-visuals/overview-light-375.png`
- `docs/implementations/bw42-visuals/overview-light-768.png`
- `docs/implementations/bw42-visuals/voice-light-desktop.png`
