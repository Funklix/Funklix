# BW-36.13R5R2: Restore Brand workspace and lifecycle

Migration/SQL: none

## Baseline and supplied evidence

Started from fetched `origin/main` at `56e7afff8e54fb599b365a1aa2e89a16671b8877` (PR #750, R5). This repository has no R5R1 branch/check on that baseline; the existing R5 line is followed immediately by `check:bw36.13r5r2` in package.json and Runtime Boot Safety.

The supplied evidence is a text description of deployed behavior, not an attached screenshot: Appics selected; Board-less/incomplete markmans has no independent row action; logo preview and save toast followed by leave confirmation and missing reload image; Advanced options shows raw canonical knowledge instead of the DNA/Avatar product. No authenticated production session or screenshot was available. Local verification below does not claim authenticated production verification.

## Repository archaeology and confirmed causes

Evidence was obtained with `git log -S`, `git show`, `git blame` and production source inspection:

- `01ef0bf` introduced Discover Brand DNA, its structured result card, explicit discovery/review/acceptance, `/api/discover-brand-dna` and `brand_core.brandDNA`.
- `bef2754f25255a924d309430696eb5ec580a53d7` introduced Avatar generation/render/review/acceptance and `/api/generate-brand-avatar`. The existing image adapter is `api/_image-storage.js`. Accepted references live in `brandDNA.avatar.imageUrl`, alongside prompt, style, generatedAt, logoReference and userApproved. An avatar prompt without imageUrl is not an asset.
- `fe4af0b` and `b39f24d` subsequently scoped Brand Brain hydration/cache by Board. These are snapshot isolation protections, retained here.
- `git show 9b1da34^:app.js` confirms the last pre-guided product surface: `renderBrandAvatarSection` at 9335, `renderBrandDnaCard` at 9557, `generateBrandAvatar` at 9616 and `acceptBrandAvatar` at 9654. Those functions still exist on the fetched baseline, but operate on `state.brandCore` and save through `saveBoardToServer`, not the reusable Brand record.
- `0aa0c8b` added per-turn AI advisor identity using `getApprovedBrandAvatarUrl`; `bef2754` also wired archetype context into campaign generation. Those consumers retain Board snapshot continuity. In the reusable Profile view, advisor identity can now read the authoritative canonical Avatar; campaign consumers continue to use their stable snapshot until explicit sync.
- `9b1da34fdf3cab44f1d3c99dc4c2e4a876cd695e` introduced the guided profile, confirmed by blame of the early return at app.js:3098. It mounted six onboarding groups with no DNA/Avatar actions; Advanced options rendered canonical data with JSON.stringify. `d2e4cd0` repaired entry but did not reconnect these capabilities. `9ce25d8` stabilized that limited surface.
- The baseline workspace-sidebar `option` created one selection button per Brand; `openBrandManagement` offered Delete only for `model.brand`. Hence Board-less markmans could not be targeted independently while Appics stayed selected.
- `api/_brand-deletion.js` explicitly ran `UPDATE boards SET brand_id = NULL`; this contradicted the requested lifecycle rule. It now counts current associations under the locked Brand and returns 409/BRAND_IN_USE with an authoritative count before any deletion.
- The old dirty decision was a sticky `state.dirty` boolean plus file/candidate/proposal presence. Profile saving set the flag false but retained independent proposals/files; this could legitimately or incorrectly keep the leave dialog open and could not recognize restored/reverted field values. The new decision compares normalized current content to the authoritative baseline and separately tracks pending file, proposals, DNA review and Avatar review/direction.
- The old upload accepted its POST projection without a verification read. Local original production-handler fixtures do persist the logo; the supplied deployed disappearance cannot be attributed conclusively to the real bucket/configuration without authenticated production access. This release verifies metadata through one bounded, no-store Brand GET and refuses to claim a verified save when that read fails. It does not invent an unverified Storage root cause.
- brand-sidebar previously substituted an accepted Avatar when the official logo was absent. Brand identity now uses the official logo or Unicode-safe initials; the Avatar remains an advisor asset.

## Integrity gate and ownership

A deterministic gate executed the original `origin/main` profile controller and real Brand PUT/GET handlers against the existing mocked runtime. A name edit round-tripped the complete canonical object: DNA with avatar/configuration/prompt and unknown nested fields, positioning, audiences, voice, value proposition, messaging, guidelines/examples, offers/proof, references, provenance, revisions and forward-compatible fields. The focused regression repeats preservation against the updated controller and subsequent reload.

The save always clones the full canonical draft and uses the existing revision-checked PUT. Object editors merge supported subfields rather than rebuilding the canonical object. Creation fingerprint, unknown DNA/Avatar keys and provenance survive. A newly generated DNA proposal merges into existing DNA and explicitly retains the existing Avatar. Avatar generation stores only a local proposal; acceptance merges its fields and uses canonical PUT with revision verification. Generation endpoints use the established prompt/model/image adapter, not a second provider implementation.

Canonical generator requests require a signed session, actual Brand edit capability and matching canonical revision; inputs are read from the authoritative Brand. Legacy Board generator requests require Board edit authority and retain their established snapshot contract. Workspace membership does not confer Brand edit/delete rights. Viewer controls are absent/disabled. Public-token and Board-only access cannot acquire the Workspace catalog or canonical management through these paths.

No migration is needed: all strategic and Avatar fields already reside in brand_core JSONB; official logos use the existing BW-36.12 columns, private brand-logos bucket and same-origin authorized route. No migration or historical SQL was modified or executed.

## Restored product and lifecycle

The reusable Profile has Overview, Brand DNA, Audience, Voice & Messaging, Offers & Proof, Brand Assets, Brand Avatar, Team and permissions, Campaign Sync and Review. DNA reuses the original structured result formatter, registry-backed strategic modules and original Founder Story preflight/context serializer. Its explicit generate/review/save flow is connected to the canonical record. Unknown shapes remain readable instead of being flattened into form strings. Advanced options remains technical, not the primary DNA/Avatar surface.

Avatar displays the existing image prominently and distinctly from the official logo. Explicit Generate/Regenerate produces a review proposal. Save Avatar authoritatively saves it; generation never overwrites an accepted asset or runs on mount. Prompt direction remains separate from the generated image. Existing campaign/advisor consumers remain compatible with brandDNA.avatar and userApproved.

Each manageable Brand row has a sibling ellipsis button with propagation stopped. Opening it preserves selection. Its closure captures a frozen Brand ID/name, Workspace ID, authorization projection, revision and association projection. Confirmation never reads activeBrandId. Authorized owner deletion of a zero-Board Brand removes only that Brand and its memberships. Non-active deletion preserves active Brand, Board, route and view; active deletion closes the Profile, drops cached references and chooses a unique remaining Brand or the existing no-selection state. Associated Brands are blocked with the server count and reassignment instruction. Boards, snapshots, Canvas, publication/provider state, Workspace memberships and unrelated Brand memberships are not detached/deleted.

Logo lifecycle: validate PNG/JPEG/WebP/GIF <=2 MiB; keep a local preview/pending file; POST to the existing authenticated logo route; validate bytes and upload with the server-only private Storage adapter; commit metadata/revision; validate POST contract; bounded 12-second authoritative GET; compare revision and same-origin reference; reconcile affected Brand projections; clear only confirmed pending logo state. Successful Profile save independently replaces its baseline. Renderer failures after persistence show saved/refresh feedback; failed verification or upload retains recoverable inputs and does not claim confirmed success. Website candidates require confirmation through the same logo mutation route and never overwrite manual uploads.

Menus/dialogs remain body-owned, one owner at a time. Row controls use 44px targets and visible focus; menus support arrows/Home/End and Escape; existing modal containment/restoration remains in use. Layout reflows across mobile, desktop, themes, forced colors and reduced motion. New copy is localized in EN/DE.

## Regression evidence and intentional historical updates

`check:bw36.13r5r2` executes production controllers, serializers, access checks, API routes and real Chromium HTML/app/sidebar/Profile DOM. Only database query results, provider responses, website retrieval and image Storage are mocked. Unexpected external destinations fail the fixtures; no real provider, AI, database or Storage requests are made.

The production-shaped Appics/markmans fixture proves independent row menu targeting, frozen confirmation, DELETE markmans UUID, Appics still selected/unchanged, no markmans Board, no reload, and unrelated Board/snapshot preservation. Additional coverage includes associated-Board block/count, active deletion cleanup in R5, Board deletion leaving canonical Brands intact, DNA generation/review/edit/save/reload, accepted Avatar retrieval/generation/acceptance, unknown field preservation, logo storage/revision/sidebar/reload, retained file on failure, website confirmation/manual precedence, normalized dirty baseline and clean leave, projection failure after persistence, verification-read failure, roles and session cleanup.

Chromium covers light/dark, 320/375/768/1440px plus 720x450 reflow, keyboard, EN/DE and forced-colors/reduced-motion. The directly affected R4R1/R5 browser suites also cover 480/1024px, focus restoration, leave-dialog containment, revoke/stale state and project handoff.

Intentional historical assertion changes:

- R4 and R4R1 now navigate Overview/Brand Assets; upload controls moved to their first-class Assets section. R4 mocked GETs return their actual preceding mutation, because authoritative verification replaces zero-follow-up-GET assumptions.
- R5 and workspace deletion now assert the approved in-use block instead of detached Boards, then exercise Board-less deletion after reassignment.
- BW-6 permits explicit authorized row Profile targeting in addition to regular context resolution.
- BW-36.4 asserts initials instead of Avatar substitution for logo identity. BW-36.6/7/7R1/7R2/7R3 retain exact fingerprint checks with only the approved sidebar/test fingerprints and dependent test hashes updated. SQL, auth, Canvas and unrelated presentation hashes remain unchanged. No historical behavior check is disabled.

Validation: focused and directly affected checks, Brand detail/foundation/roles/deletion, catalog/preflight/Avatar checks, browser integrity, changed JavaScript syntax and git diff --check. The full Runtime Boot Safety command list is run locally with the existing installed dependencies/Chromium; installation steps are environment setup, not tests. R5R1 does not exist on fetched main. Final validation totals are reported with delivery.

## Deployment, rollback and manual acceptance

Deploy the changed server routes/helper and client assets together after Felix's merge through the existing deployment pipeline. This task does not deploy or merge. No SQL step, bucket creation, credentials in browser, storage migration, backfill or historical migration rerun.

Rollback reverts this application bundle only. Preserve Workspace schema/backfill, Brand records/DNA/Avatar assets/logos, Boards/snapshots, memberships and shares.

Manual production acceptance: with Appics active, delete Board-less markmans through its row ellipsis; confirm Appics context survives. Attempt deletion of a used Brand and confirm count/block. Review/edit/save DNA, reload, confirm unknown strategic fields and campaign snapshot unchanged. Explicitly generate and review an Avatar, verify accepted asset stays until Save Avatar. Upload a supported logo, save profile, navigate without leave prompt, reload and confirm same-origin image in Profile/selector. Repeat viewer, expired-session, failed Storage and both language/theme/mobile cases. Real production bucket/provider availability remains a deployment acceptance step; it is not established by mocked tests.

## Exact files changed

- `.github/workflows/runtime-boot-safety.yml`
- `api/_brand-deletion.js`
- `api/_brand-generation-access.js`
- `api/brands/[id].js`
- `api/discover-brand-dna.js`
- `api/generate-brand-avatar.js`
- `app.js`
- `brand-profile-setup.css`
- `brand-profile-setup.js`
- `brand-sidebar.js`
- `docs/implementations/bw36-13r5r2-brand-workspace-regression-recovery.md`
- `language.js`
- `package.json`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js`
- `scripts/check-bw36-13r5-brand-lifecycle-stability.js`
- `scripts/check-bw36-13r5r2-brand-workspace-regression-recovery.js`
- `scripts/check-bw36-4-simplified-brand-sidebar.js`
- `scripts/check-bw36-6-workspace-schema-foundation.js`
- `scripts/check-bw36-7-workspace-backfill-preflight.js`
- `scripts/check-bw36-7r1-workspace-identity-diagnostic.js`
- `scripts/check-bw36-7r2-application-identity-bridge.js`
- `scripts/check-bw36-7r3-corrected-workspace-backfill-preflight.js`
- `scripts/check-bw6-brand-workspace-detail.js`
- `scripts/check-workspace-brand-deletion.js`
- `scripts/fixtures/bw36-13r5-local-runtime.js`
- `workspace-sidebar.css`
- `workspace-sidebar.js`
