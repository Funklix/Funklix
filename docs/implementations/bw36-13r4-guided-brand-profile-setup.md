# BW-36.13R4 — Guided Brand Profile setup and reliable project handoff

## Baseline and confirmed causes

The implementation starts from merged main `27dc691ff141e6c898a486e30724fef9a746ec26` (R3R1). GitHub's branch API confirmed the local checkout; the local `origin/main` ref was older. No production database or provider was queried.

Confirmed source causes:

- R3 already creates Brand and Board atomically, durably deduplicates commands, reconciles the authorized catalog, hydrates the Board and opens the reusable Brand dialog. Its setup notice explicitly postponed the guided interface.
- The reusable Profile's primary renderer exposes record metadata and whole-object JSON instead of a focused setup. Board Brand Core is a separate snapshot editor and must remain separate.
- R1 intentionally disables the older reusable/Board-local logo mutation surfaces. The existing BW-36.12 private object store, metadata and authorized revision boundary remain available.
- Brand detail loading/saving discarded `logo_url`, `logo_revision` and source from otherwise valid API responses, so confirmed logo identity could disappear on detail reload.
- Domain analysis returned candidate counts, not a validated preview; the old discovery action stored a result immediately on invocation.
- **Reproduced in Chromium:** the Profile dialog was a direct Sidebar child. The existing mobile rule `.sidebar > :not(nav):not(.sidebar-settings)` hides it at narrow widths. Moving this one native dialog to the Body fixes visibility without changing Sidebar navigation or layout.
- **Reproduced in Chromium:** forward Tab from the final Profile action can leave focus at the browser boundary. The guided native dialog now explicitly wraps first/last visible controls.

The R1–R3R1 records, BW-36.3/BW-36.5 audits, BW-36.12 record/migration, all requested client/server files, Brand detail/PUT, shared logo renderer, URL/image policy, registry/custom-tile adapter, Board hydration and the existing advanced editors were inspected. No competing Brand, Workspace, Project, snapshot or Storage model was introduced.

## Existing architecture and project creation

`Account → Workspace → Brands → Boards` remains authoritative. `project_command_v1`, `api/projects.js`, `api/_project-command.js`, the R3 transaction, command ledger/fingerprint, same-Workspace validation, ownership and snapshot/provenance checks are unchanged. Legacy unscoped collection creation remains blocked by R3R1. No successful regular creation can fall back to a null Workspace.

The two-step Project dialog opens from the in-memory authorized Workspace catalog without GETs. Every authorized Brand is represented by its name, shared renderer's confirmed logo or Unicode initials, and localized Choose/Selected text. Viewers remain unavailable for Board creation because the established Brand create capability requires owner/admin/editor. Native radio-button roles, roving tabindex, arrow/Home/End, Enter/Space, hover/focus/selection, pending lock, input retention, fixed retry command and focus restoration remain.

The distinct dashed creation card reads “Start with a new Brand” / “Mit einer neuen Marke starten”. It collects Board name, Brand name and optional Website. Website is syntactically validated and normalized before submission, but is **not added to the R3 command contract**: it travels only as an account/generation-scoped in-memory setup draft, and is saved through Brand PUT after confirmation. A failed command keeps the dialog and inputs; replay continues using the existing stable request ID. A committed outcome with navigation failure opens the retained outcome without another POST.

After creation, the existing reconciliation upserts Brand and Board in the catalog/library, applies the returned Board authority and snapshot, sets active Workspace/Brand/Board, and opens the new Brand's Profile. Rendering, dialog reconciliation, Back and direct setup-route restoration do not issue a creation request.

## Brand Profile setup and data compatibility

`brand-profile-setup.js` is a focused UI/session controller mounted in the existing reusable Brand detail container. It does not own a new persisted model or global navigation. The familiar dialog's advanced JSON editing, member functions and compare boundaries are retained behind the explicit secondary Advanced options action. Opening it with a dirty guided draft requires confirmed discard. The older contained logo editor and Board-local logo paths stay contained; only the new guided authorized path is enabled.

The Profile header shows the confirmed name, shared logo/initials, Website and readable readiness. One of six sections is visible at a time:

| Section | Existing persisted fields used |
| --- | --- |
| Brand Basics | `brands.name`, `brand_core.brandAssets.domain`, dedicated Brand logo metadata; existing Website values are read compatibly |
| Foundation | `brandCore`, `valueProposition`; Mission/Vision/Values use registered `customTiles` with the existing `createBrandCustomTile` identity/factory and `moduleType` |
| Audience | `personas` name/note/description cards; existing Audience/ICP module content |
| Voice & Messaging | `toneOfVoice`, `messagingPillars`, `contentGuidelines`, `keywords`, `dosAndDonts`, `brandVoiceExamples` |
| Offers & Proof | Existing value proposition and persisted Product Knowledge/Business Plan/Pitch Deck/Whitepaper narrative content; no fabricated proof, offers or schema |
| Review | Section coverage, remaining additions, analysis and logo status, current-versus-suggested values, explicit confirmation/save and Continue to project |

Only registry-supported Mission/Vision/Values modules are created, using the established custom-tile representation. Unknown top-level and nested data, existing modules, identities and lifecycle metadata remain in the cloned document. Unsupported legacy field shapes are rendered readably and preserved rather than coerced into strings/JSON. Accepted structured knowledge remains available in its existing advanced editors. A missing logo and optional sections do not block continuation. Readiness is field coverage, not a claim about business or campaign quality.

Brand edits use the existing authenticated `PUT /api/brands/:id` with expected Brand revision. Name, returned document and exactly incremented revision are verified before adopting success. Reload-latest retains the local draft and requires deliberate review/save. It does not silently replace unsaved inputs. Name/revision/profile cache/catalog and identity surfaces reconcile from verified server responses.

## Website analysis and proposal review

Analyze website uses the existing `POST /api/analyze-brand-domain` with `domainUrl` and the current `brandId`. For this Profile path, the server independently checks existing Brand edit authority before retrieval/provider work; a Workspace membership alone is insufficient. The existing authenticated Board-oriented analyzer without `brandId` is unchanged. HTTPS/host/credentials/port checks are followed by existing server DNS/public-address/redirect/body/time policies.

The analyzer still makes one bounded provider call per deliberate action. The controller owns one flight, disables controls, shows an honest analyzing state and makes no request from render/resize. Supported suggestions are type/bounds checked and only mapped to existing Profile fields; provider `brandAssets.logo`, unknown fields and external image URLs never become logo authority. A currently empty document may receive suggestions into its **local draft**, then enters Review. Confirmed/nonempty content stays untouched and shows current/proposed values with explicit per-field Use suggestion. Persistence occurs only on Confirm and save, or the explicit Continue action after saving a dirty draft. Changing Website clears proposals/candidates for the old Website. Invalid/empty/failed analysis preserves typed Profile inputs and allows manual completion/retry.

## Logo discovery and manual upload

BW-36.12 `brands` metadata, private `brand-logos` Supabase bucket, authenticated `/api/brands/:id/logo`, revision locking, validation and compensation remain the sole logo infrastructure. The retired unbound `upload-brand-logo` route is not used. No browser access to Supabase exists.

For Profile analysis, discovery reuses the **already retrieved HTML** and the existing candidate ranking and safe image retrieval. Only Organization-schema and explicit logo-metadata candidates are proposed. Hero/social images, generic favicons, touch/manifest/tile icons are not presented as high-quality logos. Legacy ranking order remains available to its existing callers; the guided `logoOnly` option filters their candidates conservatively. A bad/missing candidate does not fail usable knowledge analysis.

The analyzer returns a bounded validated raster preview in memory with a SHA-256 and candidate URL. It performs **no Storage or metadata write**. Use this logo deliberately calls the existing discovery mutation, which reranks the Website, restricts retrieval to that candidate, verifies the preview digest, rechecks independent Brand/Workspace authority and expected logo revision, and uses the existing private upload/metadata transaction. A changed candidate returns `CANDIDATE_CHANGED`; uploaded-logo precedence remains enforced server-side. No external hotlink is saved, and no preview bytes enter Brand Core or the catalog. Manual upload always takes priority.

PNG/JPEG/WebP/GIF selection first shows a local preview and an explicit Upload logo action. Client type/2 MiB checks precede the existing server MIME/signature/dimension/size checks. The actual native file input is retained across render/section changes, along with the File and preview, so failed uploads preserve the selection and can be retried. Success requires a verified request ID, same-origin Brand logo URL and exactly incremented revision; a storage failure cannot become UI success.

Confirmed logos render in the Profile header and existing authorized Sidebar identity surfaces through `FunklixBrandLogo`. Catalog patches include only `logo_url`/`logo_revision`; they update the Brand summary and any open Project dialog through its pure in-memory `reconcileBrand` method. Broken images fall back locally to Unicode initials in fixed geometry. Viewer renders contain no file, analyze, upload, candidate confirmation or save controls.

## Authorization, lifecycle and return to project

Brand owner/admin/editor capabilities come from the existing server Brand ACL. Workspace membership alone, Board-only collaborators and public tokens gain no Brand catalog, Profile edit or logo authority. Cross-Workspace assertions and R3 creation checks remain strict. All writes use existing server routes and optimistic revisions. No sensitive identifiers, accounts, provider payloads or image data are added to diagnostics.

Each guided session captures account object, Workspace generation, Workspace and Brand. Responses are checked before and after JSON parsing and before adoption. Account change, Sign-out, context invalidation and dialog teardown clear local setup, File/preview, proposals, candidate and return data. Mounting also verifies the detail belongs to the current account. No setup/analysis/logo/return state is persisted to `localStorage` or `sessionStorage`. Existing Board loader storage behavior is not redesigned.

Continue to project targets exactly the captured Board ID. It uses the established authorized Board GET/hydration to detect missing/revoked Boards and preserve their saved content; it never invokes the project command or creates a Brand/Board. Matching Board/Brand and current account/generation are checked before closing the Profile and navigating to the Board. Workspace and Brand remain in the Sidebar; the existing Canvas toolbar is restored and focus moves to its existing Create campaign button. Concurrent return clicks are guarded. An unavailable Board shows a visible Profile error while keeping the saved Brand. Independently opened Profiles have ordinary Back/Close and no invented Board context. Normal close clears an abandoned return context; URL restoration validates the Brand/Board relationship from the authorized catalog and performs reads only.

The reusable Brand save does **not** silently update the existing Board snapshot. Its R3 provenance and stable snapshot remain intact, and the existing explicit update/compare boundaries remain available. Campaign Sync redesign is deferred.

## Error recovery and accessibility

Localized, visible live statuses cover missing/invalid Website, analyzing, analysis failure/no usable data, no suitable logo, invalid/unreadable file, upload pending/failure/success, Brand save pending/failure, malformed confirmation, stale revision, revoked access, lost Workspace/Brand context and unavailable return Board. Inputs and confirmed data survive retryable errors. Controls are locked during a flight, and confirmed saves are distinct from drafts/previews. Dirty discard is explicit. Native cancel/Escape, initial/return focus, visible focus rings and explicit first/last Tab wrapping are retained.

The new stylesheet uses Tendra-One semantic surface/text/border/action/focus tokens for Light/Dark, flexible wrapping, bounded scrollable dialog widths, 44px targets and forced-color outlines. It does not change Sidebar structure, global topbars, Canvas, campaign, calendar or export styling. Only the Profile dialog moves out of the mobile-hidden Sidebar.

## Validation performed

All required checks passed:

- `npm run check:bw36.13r4` — dependency-free internal-source/DOM/adapted-server fixtures cover atomically created Brand/Board Workspace scope, one-flight replay, existing/new Brand cards, mouse/keyboard, analysis/proposal/explicit confirmation, safe logo discovery/storage metadata, manual-upload success/failure/retry, uploaded precedence, viewer/unrelated authority, stale revision/revoked access, malformed/no-data responses, account/generation invalidation, catalog/Sidebar/Project dialog reconciliation, original Board return and missing Board, localization, responsive CSS, native-dialog focus handler and mobile portal ownership.
- `npm run check:bw36.13r3r1`, `check:bw36.13r3`, `check:bw36.13r2`, `check:bw36.13r1`, `check:bw36.12`, `check:bw36.11r1`.
- `node scripts/check-bw20-brand-team-roles.js`.
- `node scripts/check-browser-script-integrity.js` — 35 local classic scripts.
- `node --check` for all eight changed JavaScript files.
- `git diff --check`.

The initial remote CI exposed BW-6’s obsolete literal read-only description assertion. Only that copy assertion now checks the localized accessible R4 Profile description; all existing loading, permission, isolation and no-write assertions remain intact. The analyzer now loads its Brand ACL dependency only for Brand-scoped requests, preserving dependency-free legacy analysis and tracked-files-only boot. R4 is registered in Runtime Boot Safety immediately after R3R1. All 150 single-line workflow checks were run locally: 143 passed initially; BW-26.6.3 passed after the dependency-loading correction; six subprocess-dependent checks passed when rerun outside the sandbox. No check was disabled and no security boundary was relaxed.

**Actual local Chromium/Playwright fixture acceptance was performed**, with every request intercepted: the complete application boots, creates a new Brand/project, analyzes once without saving, creates/saves Mission through the existing custom-tile factory, previews/uploads without premature upload, patches the catalog without reload, and returns to the same Board with one project POST and unchanged Canvas toolbar/focus. It reports no page errors. Light/Dark renders were measured at 1440, 1024, 768, 480, 375 and 320px: the Profile remains visible, within viewport, without horizontal overflow; visible buttons meet 44px. Native Tab containment and preserved native File selection were checked. Two locally generated desktop-Light/mobile-Dark screenshots were actually inspected. A 720px reflow with 200% text sizing passed; this is not a claim of native browser-chrome zoom or live production acceptance.

The local fixtures use invented accounts/content, fake DB/Storage adapters and in-memory API responses. No real provider, AI, Storage, database or production account calls occurred. GitHub repository reads/publishing are delivery operations, not application-provider tests.

## Deployment, rollback and manual production acceptance

Deployment has **not** been performed. After normal PR review/merge and CI, deploy browser assets and analyzer/logo route changes together. Migration/SQL: **none**. Keep existing BW-36.8/BW-36.12/BW-36.13R3 migrations, tables, data and private bucket; do not rerun migrations, repair production rows or change storage policies. No missing database capability was found for this scope.

Rollback is an application-commit revert/redeployment. Keep all existing schemas, metadata, logo objects, Brand records, Board relationships, snapshots and provenance. The older contained mutation paths remain disabled throughout.

Pending authorized production/manual acceptance, separate from the completed local fixture run:

1. Use an owner/admin/editor and a viewer fixture; verify permitted Profile/Logo actions and read-only views. Check a Board-only collaborator and public token do not expose protected catalogs or logo mutations.
2. Create from no-Brands and several-Brands Workspaces; verify the authorized cards, real confirmed raster/fallback, keyboard selection and correct Workspace/Brand/Board. Double-submit and retry a lost response; confirm one Brand/Board.
3. Analyze a real authorized Website deliberately; review meaningful suggestions/explicit raster candidate, confirm once, and test no-logo/manual-upload, invalid raster, storage outage, outdated revision and permission revocation. Existing confirmed values and uploaded logos must keep priority.
4. Verify same-origin confirmed logos appear without reload in Profile, Sidebar and Project dialog; inject an image-load error for initials.
5. Return to the original Board, create the first campaign through existing controls, and exercise deleted/revoked Board failure without recreating anything. Independently open/close a Profile; change account/sign out during delayed requests.
6. Repeat native browser **200% zoom**, screen-reader/keyboard navigation, long names/English/German, Light/Dark/forced colors and required widths on deployed assets. The local text/reflow proxy does not replace this native zoom check.

## Delivery and deferred scope

The required root `AGENTS.md` is added because none existed. Delivery uses the dedicated `codex/bw36-13r4-guided-brand-profile` branch, exact requested commit/PR titles, one normal open PR against main and no merge. The shell Git transport was unavailable at the environment proxy; the authorized GitHub connector/Git Data API is the publishing fallback. PR state/base/draft and actual URL must be read back before completion.

Deferred: Campaign Sync redesign, Compare redesign, Brand Learnings, member/Workspace invitation and management changes, new navigation/Sidebar architecture, Canvas/campaign/calendar/export/AI-Brain/Insights changes, data repair/migrations and alternate storage.
