# BW-36.13R5R3 — Durable Brand logo and readiness

Migration/SQL: none

## Evidence and diagnosis

The supplied deployed Appics sequence is: select `appics logo.jpg`, see a local preview, Upload logo, Confirm and save Brand Profile, receive “Brand Profile saved”, navigate and immediately receive a leave warning, then reload and see initials instead of the logo in the header and sidebar. This is reported production evidence, not an authenticated production session observed during this implementation.

Base: `d6b83f7ece3a1ea0fe92c00457ac00fc0f2ad335`, the latest fetched origin/main (R5R2). The current production PUT updates only name, brand_core, revision and updated_at. **It did not erase any logo column.** The existing R5R2 regression already defines an upload/save/reload sequence, and the supplied loss has not been reproduced in the deterministic persistent fixtures. Consequently, the exact cause of the reported deployed disappearance is not established by the supplied evidence and cannot honestly be attributed to a nulling PUT. Deployment parity, real Storage availability and authenticated production responses remain manual acceptance checks.

Verified code defects, repaired and covered by executable production-function/DOM tests:

- Logo upload success required a metadata GET but not successful authenticated image delivery. An unavailable object could therefore be announced as saved while every image fell back to initials.
- A committed logo followed by a failed verification read was reported as an unverified save/retry and retained the pending file. This encouraged duplicate upload rather than recovery of the confirmed server revision.
- The logo route projected metadata after COMMIT, inside a catch that removed the newly uploaded object. A post-commit projection exception could leave committed metadata referring to a removed object. Projection now occurs before COMMIT; compensation is restricted to uncommitted writes.
- GET ignored the requested logo revision while emitting an immutable cache header. A stale URL could receive/cache different revision bytes. Revision mismatch now returns a bounded no-store 409.
- An error event from an old, replaced image could erase the current image. The shared renderer now tracks generations independently of DOM implementation.
- A profile save advanced its baseline only if the draft had not changed while saving. Newer edits correctly remained unsaved, but reverting them to the submitted server state still looked dirty. The confirmed baseline now advances independently of newer draft edits. Missing inherited form defaults and surrounding whitespace are normalized consistently.
- A partial canonical PUT replaced omitted canonical fields. Recursive merging now preserves omitted DNA/avatar/unknown fields and the server-owned creation fingerprint. Explicit values retain the existing editing semantics and revision conflict boundary.

## Exact mutation sequence and ownership

1. Brand Assets input validates PNG/JPEG/WebP/GIF, maximum 2 MB. FileReader creates an in-memory data preview; no object URL is created, so no object URL needs revocation. Preview data never enters canonical state or catalog.
2. Upload sends brand_logo_v1, upload action, expected logo revision, request ID, authorized Workspace ID, MIME and transient image bytes to the existing authenticated same-origin POST route.
3. The route authenticates the existing session and locks the Brand. Existing Brand owner/admin/editor authority and accepted Workspace context checks remain intact. Workspace membership alone grants no Brand write permission.
4. Image bytes are validated and written to the existing private brand-logos bucket using server-only credentials. The route writes object path, MIME, source, source host, incremented logo revision and timestamp in its database transaction.
5. The safe logo representation is validated before COMMIT. Only failed uncommitted writes remove their new Storage object. Old objects are removed after successful replacement/removal.
6. Response: contract and request_id plus logo `{brand_id, changed, logo_url, logo_revision, source, updated_at}`. Every current mutation changes the revision (`changed: true`); no current route action returns a no-op. No row, object path, credentials or private provider data is exposed.
7. Client validates request/contract/revision/reference (and supplied Brand identity/change flag), immediately retains the confirmed revision and clears file/fileData/candidate. The reused file input is reset on render. There is no remaining logo dirty flag.
8. One bounded, authenticated, no-store Brand GET verifies the exact logo revision/reference. The complete confirmed Brand is reconciled into app detail, affected catalog/selector/sidebar and existing Board identity consumers. Unrelated drafts remain intact.
9. A bounded Image load verifies actual same-origin image rendering before final “Logo saved”. Node fixtures call the real image-delivery handler against persistent fake Storage. Metadata/read/image failure after confirmed persistence offers **Reload saved Brand**, retains the server revision and prevents duplicate mutation. A failed upload before commit retains file/preview and the old persisted logo.
10. Generic profile save submits the canonical draft without transient logo state. PUT leaves **all** logo columns untouched, preserves omitted canonical fields, and uses the existing optimistic canonical revision. A bounded affected-Brand reread checks canonical content and unchanged logo revision/reference.
11. The saved content baseline advances to the authoritative Brand independently of newer draft changes. File/candidate/proposals/generated unaccepted DNA/avatar/direction remain separate pending data and are protected when genuinely unsaved. Successful uploaded files are already cleared. Logo state comes from the confirmed Brand, never the local preview.
12. Navigation derives dirty state from normalized content differences and pending unsaved items. A normal upload–save sequence has no leave dialog. A fresh browser loads the production-shaped Workspace catalog, runs its production validator, opens Brand detail, and uses the authenticated revisioned logo route.

## Shared identity and Overview

All existing consumers continue to use FunklixBrandLogo: valid same-origin official logo first, Unicode-safe initials otherwise. The persisted revision corrects stale URL revisions. Generation-scoped image errors cannot erase a newer logo. Official logos use contained aspect ratio, accessible Brand name and existing theme surfaces. Brand Avatar is never a compact company symbol.

Overview retains the current editable name, website, description, value proposition and foundation fields. Above them are two responsive labelled cards: **Brand Logo** (official persisted asset/initials and Add/Change logo) and **Brand Avatar** (accepted existing generated asset, safe empty/error state, Open/Create action to the existing avatar section). Both DNA and avatar acceptance are required for the avatar summary. A prompt alone is not an avatar image. The identity header and aggregate readiness use saved Brand data.

## Central readiness contract

`readiness(brand)` in brand-profile-setup.js is the sole tab/aggregate projection. It receives the confirmed Brand, never draft/core/file/analysis proposals. Empty strings, whitespace and exact placeholder values `Not provided`, `Not started`, `placeholder`, `N/A`, `TBD`, `unknown`, `Nicht angegeben`, `Noch nicht begonnen` do not count. Numbers, booleans and prompt/provenance/revision metadata alone do not count.

| Section | Required confirmed meaningful values for Complete | Additional meaningful values producing Partial |
| --- | --- | --- |
| Overview | Name, website/domain, brandCore description, valueProposition | Any required value |
| Brand DNA | userApproved DNA with primaryArchetype and secondaryArchetype | Unaccepted/partial archetypes, personality or positioning |
| Audience | At least one persona with name and note/description, and ICP or audience knowledge-module content | Incomplete personas, audience or ICP module |
| Voice & Messaging | toneOfVoice, messagingPillars, contentGuidelines, keywords, dosAndDonts, brandVoiceExamples | Any required value |
| Offers & Proof | offers or product_knowledge module, and proof or pitch_deck/whitepaper module | valueProposition, business_plan module, any required value |
| Brand Assets | Valid persisted official same-origin logo with positive revision, colors, typography | references, any required value |
| Brand Avatar | Accepted asset imageUrl and accepted Brand DNA | An existing unaccepted image reference; prompt alone is Empty |
| Team and permissions | Neutral | Operational |
| Campaign Sync | Neutral | Snapshot action, not content completion |
| Review | Neutral | Aggregate action |

All required values present = Complete. Any meaningful confirmed section data with required values missing = Needs attention. None = Not started. Operational sections = Not applicable. English/German labels are localized.

Green/yellow/red tinted borders/backgrounds are combined with distinct status symbols and localized descriptions through aria-describedby. Existing section accessible names remain stable; title exposes the full status on hover/focus via the browser tooltip. Selection has a separate focus-color outline, underline and aria-current. Buttons wrap with 44px targets. Forced colors preserve symbols and selected outline; theme tokens provide light/dark surfaces; reduced-motion rules remain active.

## Authorization and isolation

No authorization capability changed. Viewer controls remain read-only; authorized persisted logo/avatar/readiness remain visible. No public token or Board-only user receives Workspace Brand access. Existing DNA preflight, generation, review, acceptance, prompt/configuration, archetypes, audience, tone, provenance, accepted avatar and forward-compatible canonical fields survive a generic save. No Canvas/campaign snapshot/Board/workspace/share mutation is introduced. Account switch/sign-out invalidates pending private session data through the existing controller lifecycle.

## Files changed

- `.github/workflows/runtime-boot-safety.yml`
- `api/brands/[id].js`
- `api/brands/[id]/logo.js`
- `app.js`
- `brand-logo.js`
- `brand-profile-setup.css`
- `brand-profile-setup.js`
- `language.js`
- `package.json`
- `scripts/check-bw36-13r5r3-durable-brand-logo-and-readiness.js`
- `scripts/fixtures/bw36-13r5-local-runtime.js`
- `docs/implementations/bw36-13r5r3-durable-brand-logo-and-readiness.md`

## Verification

The focused registered `npm run check:bw36.13r5r3` uses production routes/auth/Storage adapter/serializers/catalog projection/browser catalog validator/controllers and real index.html/app DOM. Fake DB and private Storage persist across page reload. It verifies select/preview/upload/object/metadata/revision, subsequent profile PUT preserving every logo column, file input clearing, clean baseline, leaving without dialog, browser recreation, authoritative catalog GET and Overview/sidebar/selector images. Avatar stays separate.

Additional tests cover metadata compensation, upload failure retention, explicit removal, website discovery, failed post-commit verification with no duplicate upload, stale revision delivery, old/broken image events, partial canonical preservation, concurrent-save baseline, placeholders/readiness, read-only controls, account invalidation, EN/DE, light/dark, 320/375/768/1440px and 720x450 reflow, keyboard focus, forced colors and reduced motion. All external I/O is deterministic fake traffic; zero real database/Storage/provider/AI calls.

Historical R4, R4R1, R5 and R5R2 and the complete Runtime Boot Safety workflow are run without weakening historical assertions. There is no registered R5R1 check on this origin/main; current R5 and R5R2 are the available lifecycle checks. BW-36.12 is separately run because it is not registered as a Runtime Boot Safety step. Syntax is checked for every changed JavaScript file; git diff --check is required.

## Deployment, rollback and manual acceptance

Deploy the server routes and all browser JS/CSS/language assets in the **same application release**, after Felix reviews/merges the normal PR. This task does not merge or perform an authenticated production deployment. No migration, manual SQL, public bucket, new dependency or browser-visible credentials.

Rollback redeploys the prior application assets, without deleting or changing Brand records, logo metadata/Storage objects, DNA/avatar assets/configuration, Boards, Campaign Brand Snapshots, Workspaces, memberships or shares. The preexisting logo schema remains unchanged.

Authenticated production acceptance: verify deployment commit parity; repeat the supplied Appics JPEG sequence; inspect bounded upload/detail/image responses without exposing credentials; save profile, navigate without warning, full reload, and confirm identical revision/logo in Overview/sidebar/selector and separate accepted avatar. Repeat with viewer, a failed Storage write, a failed image load and Reload saved Brand, discovery and removal. Confirm status labels/selection in both languages, themes and small widths.

**Limitations:** Chromium verification is local production DOM with deterministic persistent backend fixtures, not authenticated deployed production. No access to the deployed Appics database, Storage objects or session was supplied; the exact reported production-loss cause remains unverified. Real Storage configuration and deployment parity require the manual acceptance above.
