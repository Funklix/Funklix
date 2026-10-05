# BW-36.13 — End-to-end Workspace → Brand → Board → Campaign → Calendar → Export audit

**Status:** documentation-only audit and recovery plan.
**Evidence:** repository on the task branch and the accepted production observations in BW-36.13.
**Safety:** no application fix, migration, SQL, production credential access, Supabase mutation, provider request, or AI generation was performed.

## Executive verdict

The approved hierarchy remains `Account/User → Workspace → Brands → Boards`, but the repository does not implement it as one lifecycle. It has three partially overlapping authorities: the signed cookie session and email-owned legacy Board/Brand APIs; the application-identity-backed Workspace catalog; and Board-local Brand Core state presented beside reusable Brand detail.

That split explains why `/api/boards` can show authorized Boards while `/api/workspaces` fails. Board creation with an existing Brand copies the Brand Core snapshot in the same insert, but it does not accept/enforce a Workspace, create a Brand, create all owner relations, or return a complete application context. Brand creation does not assign `workspace_id`. First-Workspace creation is absent. Neither target journey is therefore complete.

BW-36.12 introduced two logo paths. The reusable Brand editor uses `/api/brands/:id/logo`; the Board Brand Core editor still calls retired `/api/upload-brand-logo`, which always returns `410 {error:{code}}`. Its caller runs `new Error(payload.error)`, coercing the object to `[object Object]`, then displays `error.message` with native `alert()`. This is the verified repository chain for the production upload failure.

Website analysis and durable logo discovery are separate. Discovery only considers Organization JSON-LD, a narrow set of link/meta tags, and `/favicon.ico`; downloads require exact raster MIME/signature/dimensions. It ignores normal `<img>`/`srcset`, CSS assets, manifest contents, and SVG. SVG-only/SVG-preferred sites are effectively unsupported, but Markmans cannot be attributed to SVG without fetched HTML, candidate, redirect, header, and bounded rejection diagnostics.

**Decision:** replace the current modal with one **Create project** flow: Project → Brand → Create. Normal Boards select an existing authorized Workspace Brand or create a new Brand. One idempotent server transaction must validate identity/authorization, create any new Brand, create the matching Workspace/Brand Board, initialize the Campaign Brand Snapshot and ownership, and return complete context. The client reconciles once and opens guided Brand setup (new Brand) or the Board (existing Brand). Unbranded creation is secondary, permission-bounded legacy recovery only.

**Immediate recommendation:** partially disable BW-36.12 application mutation controls now, while preserving existing safe logo reads. Leave applied nullable columns and the private `brand-logos` bucket intact. First restore reliable Workspace catalog projection and Workspace actions; next deliver atomic project creation and explicit context/navigation. Do not ship another isolated fix.

## Evidence table

| Class | Evidence | Finding |
|---|---|---|
| Verified production | Accepted observations 1–10 | Workspace/Brand intermittency, dead owner ellipsis, working selector on catalog success, `[object Object]` upload, Markmans no-logo, Profile ambiguity, unusable creation, no immediate open, context loss, and fragmented design are confirmed production behavior. |
| Verified repository | `api/_auth-session.js`, `api/_app-identity.js`, `api/workspaces.js` | Signed cookie session is authentication authority; Workspace APIs additionally resolve canonical session email to exactly one active `app_identities` UUID. |
| Verified repository | `api/_workspace-catalog.js:73-113` | Workspace membership, Brands, and Boards load separately; any independently authorized descendant outside accepted Workspace membership rejects the catalog. |
| Verified repository | `api/_workspace-catalog.js:44-68`, `workspace-catalog.js:11-41` | One malformed Workspace/Brand/Board/logo field or unknown response field invalidates the entire catalog. |
| Verified repository | `api/boards/index.js:69-127` | Boards use legacy email/Board/Brand authorization independently of application identity and Workspace membership, so they can remain visible during catalog failure. |
| Verified repository | `app.js:4571-4594`, `19014-19049` | Workspace and Boards have separate generation, identity, abort, state, and error owners. |
| Verified repository | `workspace-sidebar.js:108-121` | Render closes an open transient surface and toggles manage visibility; it does not replace/detach the manage button, whose listener is bound once. |
| Verified repository | `workspace-sidebar.css:6-8` | Compact rail and mobile hide management; visible-but-dead production behavior still needs event/hit-test evidence. |
| Verified repository | `api/brands/index.js:41-50` | Brand creation requires name and object `brand_core`, but omits Workspace assignment. |
| Verified repository | `api/boards/index.js:130-179` | Existing-Brand Board create atomically inserts association/snapshot, but neither receives nor validates Workspace. |
| Verified repository | `app.js:18819-18952` | Current modal renders no Brand catalog/new-Brand path; success intends `pushState`, but does not explicitly switch `activeView` to Board. |
| Verified repository | `app.js:9156-9179`, `api/upload-brand-logo.js:12-16` | Retired route plus raw object passed to `Error` exactly produces the native `[object Object]` alert; nothing is stored. |
| Verified repository | `app.js:3153-3156`, `api/brands/[id]/logo.js` | Reusable Brand upload is JSON/base64, revision/permission checked, stored server-side, metadata committed, and catalog patched. |
| Verified repository | `app.js:9091-9153`, `api/analyze-brand-domain.js` | Analyze Website updates Board-local Brand Core; it does not invoke reusable Brand logo discovery. |
| Verified repository | `api/_brand-logo.js`, `api/_website-image-retrieval.js` | Discovery is narrow, raster-only, and swallows candidate failures into undifferentiated no-result. |
| Verified repository | `scripts/check-bw36-12-brand-logo-acquisition-and-projection.js` | Checks are mostly source tokens/strings, isolated helpers, and fake storage; no real DOM-to-route lifecycle is tested. |
| Requires runtime evidence | Production observations 1, 2, 5, 8, 9 | Need deployed asset hash, request/status/body IDs, DOM event/overlay evidence, create response, client state transitions, and bounded logo candidate diagnostics. |
| Target decision | This audit | Reusable Brand Profile is shared authority; Campaign Brand Snapshot is the stable Board copy; Workspace membership never broadens Brand/Board access. |

## Current architecture and journeys

### Identity and boot

`getSessionUser()` verifies the signed `funklix_session`. Legacy Brands/Boards authorize by normalized session email (`owner_email`, `brand_members.email`, `board_editors.email`); Workspace membership authorizes by `app_identities.id`. Public-token reads are bounded to one Board. This is not one end-to-end identity key.

`loadSessionUser()` owns account boot. On account change it clears Workspace catalog, Boards library, Brand selection/creation, Board association, and sharing. `loadAuthorizedWorkspaceCatalog()` owns `workspaceCatalog.generation` plus account/object checks; the legacy Brand switcher owns `brandCatalog.requestId/userEmail`; Boards own `boardsLibraryRequest.generation/identity/controller`; Board load owns `boardLoadGeneration`. There is no coordinator that commits one ready context.

Boards survive catalog failure because `/api/boards?scope=all` does not require Workspace membership. `/api/workspaces` must resolve identity, memberships, every independently authorized descendant, relationships, logo metadata, and a strict envelope. Loading replaces the prior catalog with `value:null`; any error renders unavailable. An optional bad logo revision/source/MIME can invalidate everything.

Sign-out invalidates substantial account state but does not explicitly clear every Board id/path/local-storage value before session DELETE. Target cleanup must invalidate all account-bound generations and route neutral without deleting server data.

### Workspace lifecycle

Tables are `workspaces`, `workspace_memberships`, `app_identities`, with nullable `brands.workspace_id` and `boards.workspace_id`. Only `GET/PATCH /api/workspaces` exist; the foundation migration explicitly deferred creation/membership writes. First-Workspace creation is neither implemented nor reachable.

Selection lives only in client session state and is derived from active Board, Brand, or the sole Workspace. Multi-Workspace ambiguity yields no durable choice. Loading/empty/error lack a coherent first-use/retry journey.

The owner ellipsis listener is not disconnected by repository rendering. `render()` can close its menu on every reconciliation and hide it if context/role changes; responsive CSS also hides it. `patchCatalogBrandLogo()` rerenders the sidebar, so it can close a newly opened menu. The exact visible dead-click cause remains unverified; production must capture `elementFromPoint`, computed style, `hidden/disabled`, derived role, event delivery, overlay stack, render timing, and deployed hash.

### Brand lifecycle and Profile ambiguity

`POST /api/brands` creates `{owner_email,name,brand_core,revision}` with empty Core but no Workspace. The creator is buried in the legacy Brand switcher, cannot start from Board creation, and initializes no setup/completeness state. Logo metadata defaults absent/revision zero.

Reusable detail is a sidebar overlay (`canonicalBrandDetail`), while “Brand Profile” can expose the Board Brand Core workspace. Website analysis mutates `state.brandCore` and saves the Board snapshot, not reusable Brand. Users therefore cannot identify shared authority.

Target ownership:

- `/brands/:brandId`: reusable Brand Profile and only shared logo authority;
- Board surface: clearly labeled Campaign Brand Snapshot with source revision and explicit compare/refresh/restore;
- no implicit reusable edit from Board setup;
- only Brand owner/admin/editor confirms shared data;
- website/AI output remains reviewable proposals;
- governed Brand Learnings remain later work.

### Logo paths

**Reusable manual upload:** file input → client PNG/JPEG/WebP/GIF and 2 MB checks → FileReader base64 → JSON `brand_logo_v1` POST → cookie auth → locked Brand role and optional Workspace membership → revision check → byte signature/dimension check → private Supabase Storage upload → metadata update/commit → response → detail/catalog/sidebar patch. It is not multipart. Deployment JSON body limits can reject encoded bodies. Pending objects are deleted on transaction failure; old deletion after commit is best effort. The client does not validate response contract/request id or verify the subsequent logo GET.

**Board Brand Core manual upload:** file input → base64 JSON → retired route returns structured 410 → `new Error(payload.error)` coerces object → catch sets candidate unavailable → `alert(error.message)` shows `[object Object]`. No storage or metadata write occurs.

**Discovery:** Brand domain → explicit “Find from website” → logo POST → website HTML fetch → JSON-LD/link/meta ranking → candidate download → raster validation → storage → metadata commit → catalog rendering. Analyze Website does not call it. Extraction ignores `<img>`, `srcset`, CSS/backgrounds, OpenGraph and manifest contents; a manifest URL is mistakenly treated as an image. Retrieval requires HTTPS/public DNS, bounded redirects, 2xx, exact PNG/JPEG/WebP/GIF MIME, <=2 MB, valid dimensions 16–4096. Candidate errors are swallowed.

For Markmans, SVG is credible but unproven. Other causes include logo exposed only via normal image/CSS/manifest, bot-specific HTML, unsupported ICO/MIME, redirects, size/dimensions, or retrieval policy. Log only candidate kind/host/safe path class and bounded rejection category—never bytes or credentials.

GIF is a poor new Brand-logo format because animation/frame behavior is nondeterministic across previews/exports. Continue reading legacy GIF, but prefer static PNG/WebP for new writes. For SVG, bounded server-side rasterization in an isolated, pinned component (no scripts/external resources/fonts, strict byte/pixel/time limits) is safer than serving sanitized SVG. If that dependency cannot be maintained, clearly reject SVG and request raster upload.

### Board creation

Current trace is:

`Create click → unsaved warning → generated modal → externally selected ephemeral legacy Brand → POST /api/boards → one INSERT → strict response validation → local hydration → history.pushState → list reload`.

The modal has no Brand rows/cards and relies on `getResolvedWorkspaceBrand()`, which requires a separately loaded legacy catalog and selection. Workspace is not sent. The equally prominent unbranded choice remains usable. New Brand is absent.

Existing Brand association/snapshot are in the Board insert, but Workspace is omitted. New Brand+Board is not implemented and must not become browser-orchestrated writes. The API returns full Board data and the client consumes it. The production non-navigation conflicts partly with intent; strongest repository cause is success changes pathname without `setActiveView('board')`, so Boards overview can remain visible. Other possibilities needing evidence: deployed mismatch, strict response rejection, context invalidation, or later rerender.

Post-create reconciles Board/snapshot but cannot reconcile Workspace from the response and does not establish active Brand/catalog consistently. List and full Board shapes differ legitimately but lack a shared created-context contract.

### Campaign through export

| Stage | Repository owner | Assessment |
|---|---|---|
| Campaign | `createCampaignSetup`, `generateCampaignChainProgressively`, `generateCampaignFromIdea`, `/api/generate-campaign` | Present; consumes Board-local snapshot. |
| Responsibilities | node owner fields and `setNodeOwner()` persisted in `canvas_json` | Present; Board access/editor identity, not Workspace membership. |
| Collaboration/review | Board editors/presence, node post-its/activity, review/content-review APIs | Present; public remains read-only and Board collaborators remain Board-only. |
| Content Workspace | `content-workspace.js`, `renderContentWorkspace()` | Present; projects Social Media Posting nodes. |
| Scheduling/Calendar | posting-schedule routes/services, calendar modules, `renderCalendarView()` | Present with Board authorization/freshness. |
| Auto-plan | `automatic-planning.js`, proposal/apply batch service | Present; proposal client-side, apply bounded server batch. |
| CSV | `posting-plan-export.js` | Present. |
| PDF | `posting-plan-pdf.js:printDocument` | Browser print-to-PDF, not server-generated file; product must confirm this satisfies “presentation-ready PDF.” |

Downstream code tolerates legacy empty/unbranded snapshots. It must never infer authorization from browser-selected Brand. Phase 3 should fix only blockers exposed by production-shaped lifecycle acceptance.

## Verified defects and cause chains

1. Split identity/catalog authority permits Board success plus Workspace failure.
2. Whole-catalog strict projection lets one optional logo issue remove all context.
3. First Workspace creation is absent; selection is session-only.
4. Sidebar rerender closes actions and responsive modes hide them; exact visible dead click needs runtime proof.
5. Workspace catalog and legacy Brand catalog are separate state owners.
6. Brand creation omits Workspace and cannot safely feed project creation.
7. Reusable Profile and Board snapshot edit surfaces are semantically mixed.
8. Board-local upload calls a deliberately retired route and directly causes `[object Object]`.
9. Logo discovery is narrow/raster-only and loses candidate failure reasons.
10. Board dialog has no catalog/new Brand path and promotes unbranded creation.
11. Creation transaction omits Workspace and new-Brand orchestration.
12. Post-create does not explicitly switch visible view and lacks complete context response.
13. Error shapes vary among strings, `{error:string}`, structured objects, and bespoke envelopes; native alerts/raw coercion remain.
14. Deterministic checks validate snippets/tokens, not the authenticated journey.

## Target journeys

### Scenario A — new user/new Brand

1. Verify sign-in and resolve/create application identity.
2. If no Workspace, create Workspace + accepted owner membership in one server transaction.
3. Start **Create project**; show current Workspace and ask Board name.
4. Brand step selects **Create a new Brand**; normal unbranded is absent.
5. One idempotent server command creates minimal Brand, matching Workspace Board, ownership, snapshot and complete context.
6. Route directly to `/brands/:id/setup?board=:id`.
7. Basics: Brand name, domain, discovery/upload/skip.
8. Discover: separate meaningful text/logo progress; show safe candidate; never silently apply uncertain data.
9. Review: identity/positioning, audience, voice/messaging, offers/proof, visual assets.
10. Ready: show completeness; confirm reusable Profile.
11. Server refreshes snapshot through safe boundary and opens Board explicitly.
12. Create campaign, assign owners, collaborate/review, schedule Social Media Posting content, verify Calendar/Auto-plan, export CSV and PDF.

### Scenario B — existing user/multiple Brands

1. Boot signed identity and existing Workspace context.
2. Create project Step 1 shows Workspace and Board name.
3. Brand step displays every and only authorized current-Workspace Brand with logo/initials, name, concise context and selected state, plus new Brand.
4. Existing selection is reauthorized server-side; create Board, matching Workspace/Brand, ownership and snapshot atomically.
5. Return complete context, reconcile once, change URL and active view, then full-load Board.
6. New Brand follows Scenario A setup.
7. Normal flow never creates unbranded Board; recovery is visually secondary and permission-bounded.

## Target information architecture and UI

- **Sidebar:** navigation/current context only; Workspace/Brand selectors, Boards and Profile link—no dense toolbar.
- **Create project:** focused responsive Project/Brand/Create surface owning its Brand selection rather than ephemeral sidebar state.
- **Brand Profile route:** Overview, Identity, Audience, Voice & Messaging, Offers & Proof, Visual Assets, Campaign Sync; Learnings later.
- **Brand setup:** Basics, Discover, Review, Ready; resumable and revision-aware.
- **Board:** “Campaign snapshot from {Brand}, revision N,” explicit refresh/restore; no canonical/association jargon.

Each owns loading, ready, empty, retryable error, permission loss and stale states. Preserve confirmed context as stale/disabled during transient refresh, but never after verified account/permission loss. Use semantic list/radio/dialog markup, focus trap/restore, `aria-live`, 44 px targets, initials, one primary action, tokenized dark mode, and fixed contained logo previews. Desktop uses cards/list; compact rail provides an accessible launcher; mobile uses full-height sheet/page; 200% zoom becomes one column without horizontal scroll.

## State machines

### Authenticated boot

`signed_out → session_checking → identity_resolving → catalog_loading → context_deriving → ready`.

- Missing/invalid session → signed out; network → recoverable session unknown.
- No identity/new account → first Workspace required; disabled/ambiguous → terminal identity error.
- Catalog transient error preserves stale disabled display; integrity/permission blocks authority.
- Multi-Workspace ambiguity requires explicit selection.
- Account switch increments global generation, aborts children, clears authority, and ignores stale responses.
- Resulting authority is verified session + application identity + server context envelope.

### Workspace catalog

`idle → loading → ready_nonempty | ready_empty | recoverable_error | auth_error | integrity_error`.

Load/retry/refresh/select/invalidate/account-change are valid events. New-account empty routes to Workspace creation; failure never appears empty. Optional asset failure degrades to initials; relationship corruption blocks. Account change clears. Only matching account/generation commits immutable catalog and selected Workspace.

### Create project

`closed → project_step → brand_step → confirming → submitting → created_existing | created_new → navigating`.

Validation returns to its step. Network/5xx becomes outcome-unknown; query idempotency status before retry. Permission loss returns safe. Stale context refreshes/reselects. Cancel clears draft only. Account switch invalidates visual reconciliation without duplicating committed work. Authority is server created-context.

### New Brand setup

`basics_empty → basics_valid → discovering → review → saving_confirmation → ready → continuing_to_board`.

Upload/discover may fail recoverably without erasing basics. No candidate is a successful outcome with Upload/Skip. Stale revision preserves draft and offers compare/reload. Permission loss is terminal/read-only. Account/Brand/domain/revision generation rejects stale results. Confirmed reusable revision is authority.

### Existing-Brand Board creation

`brand_selected → server_validating → transaction_open → board_with_snapshot_inserted → committed → context_returned → opening_board`.

All pre-commit failures roll back. Response loss is outcome-unknown and resolved by idempotency, never repeat insert. No browser compensation. Committed Board context is authority.

### Logo upload

`idle → selected → client_valid → uploading → metadata_committing → success_visible`.

Invalid file stays local. Old logo survives auth/stale/storage/DB failure. Server removes pending object on rollback. Stale response is ignored by account/Brand/logo generation. Success requires valid response plus normalized Brand reconciliation across setup/Profile/sidebar/cards.

### Logo discovery

`idle → fetching_site → extracting → evaluating → preview | no_candidate → confirming → storing → success_visible`.

Candidate failures have bounded categories. Persist only after user confirmation. Optional isolated rasterization handles SVG; otherwise request raster. Skip/no candidate continues setup. Bind response to account/Brand/domain/revision.

### Post-create navigation

`created_context → response_validated → projections_reconciled → route_committed → surface_committed → board_loading → board_ready`.

One navigation function changes both URL and active view. New Brand targets setup; existing Brand targets Board. Board-load failure retains created id with retry, never creates again. List/catalog refresh cannot overwrite the new context. Final authority is full Board read matching returned Workspace/Brand/Board.

## Data and transaction plan

Add one versioned authenticated orchestrator such as `POST /api/projects` with idempotency key, `workspace_id`, Board name, and exactly one of `existing_brand_id` or minimal `new_brand:{name}`. Do not compose browser writes.

In one database transaction:

1. resolve verified session to active application identity;
2. lock/check active Workspace and accepted create permission;
3. existing path: lock/read independently authorized Brand and require matching Workspace;
4. new path: insert Brand with Workspace, owner fields/membership, empty Core and initial revision;
5. insert Board with Workspace, Brand, owner fields and blank validated canvas;
6. copy Brand Core plus revision/timestamps into Campaign Snapshot provenance;
7. create normalized owner relation if adopted;
8. persist idempotent command outcome;
9. commit and return Workspace summary, Brand summary/access/setup, full Board/access/snapshot, request id and next route.

Existing `/api/boards` becomes recovery-only or delegates to this service. No core browser multi-write.

Storage and PostgreSQL cannot share a transaction: retain pending versioned upload, locked metadata commit, pending-object deletion on rollback, and old-object best-effort retirement after commit.

Minimum repair may use existing schema. A durable idempotency table, setup state, normalized owner relation, or eventual non-null Workspace constraints requires a separate additive migration after legacy measurement/backfill. Do not harden nullable columns in the first release.

## Authorization matrix

| Actor | Workspace/Brand | Project/Snapshot | Board/export/logo |
|---|---|---|---|
| Workspace owner/admin without Brand access | See Workspace; no inaccessible Brand | May create new Brand only if explicitly granted; cannot select inaccessible Brand | Explicit Board access only; no Brand logo |
| Workspace member/viewer | Workspace summary; no implicit Brand | No unless explicit permission | Explicit Board access only |
| Brand owner/admin | Read/edit/member capability | Create matching Board; initialize/refresh snapshot | Inherited Board access; logo mutate; export |
| Brand editor | Read/edit, no members | Create matching Board under current capability | Editor; logo mutate; export |
| Brand viewer | Read only | Cannot create under current capability | Viewer; logo read only |
| Board owner/editor only | No reusable Brand unless separately authorized | Recovery only; Board-local snapshot per policy | Board actions/export; no reusable logo |
| Board viewer only | No inferred Brand | Read-only snapshot if response permits | Read-only Board/export policy |
| Public token | None | None | One Board safe read only; no logo mutation/export by default |
| AI/provider | Never authority; proposals only | Never approves | No authorization role |

Workspace membership never replaces Brand/Board authorization. Board-only stays Board-only. Public stays Board-bounded. AI cannot approve Learnings; Learnings are deferred.

## Error contract

Target routes return a versioned envelope:

```json
{"contract":"project_command_v1","request_id":"client-id","ok":false,"error":{"code":"BRAND_REVISION_STALE","category":"conflict","stage":"brand_validation","retryable":true,"user_action":"reload_brand","correlation_id":"safe-server-id"}}
```

Codes map to localized inline copy owned by the relevant step/control. Never expose provider/SQL/stack/object path/credentials; never interpolate raw objects, use `String(error)` for UI, or call native `alert()`. Unknown/malformed create responses preserve input and reconcile outcome before retry.

Categories: validation, authentication, permission, not-found, conflict, network, storage, provider, integrity, outcome-unknown, internal. Actions: correct input, sign in, retry, reload catalog/Brand, choose another Brand, upload raster, check created projects, contact support. Recoverable failure does not clear confirmed context.

Current inventory includes native alerts in Board logo and downstream generation tools; raw object coercion in Board logo; `error.message || String(error)` diagnostic patterns; swallowed logo candidate catches; generic catalog/list fallbacks; Brand-create 401 directly nulling global user; and Board-load catch clearing canvas/local state even for possibly transient errors.

## Why Runtime Boot Safety passed and minimum tests

BW-36.12 tests source tokens/labels, isolated candidate/image helpers, and fake storage. They never click real controls, call the retired response envelope, mount both Brand surfaces, use real post-migration catalog rows, parse deployment-sized upload bodies, render Brand choices, verify `activeView` and pathname, inspect errors, exercise realistic logo formats, or traverse the authenticated lifecycle. Mocks erase session, body-parser, DB, storage, history and DOM boundaries. Strings existing is not product connectivity.

Use four production-shaped lifecycle tests:

1. Existing multi-Brand project: real DOM + production envelopes; Brand cards, atomic create, URL/active view/full Board/snapshot.
2. New account/new Brand: first Workspace, project, guided setup with network-boundary fixtures, Board, campaign/social post/schedule, CSV and print-PDF.
3. Parameterized failure/recovery: catalog, each transaction stage, stale revision, permission loss, response loss, account switch; preserved input/no duplicates.
4. Logo integration: click actual controls, deployment body parsing, raster write/read/reconcile, structured inline error, and fixtures for JSON-LD, `<img>`, manifest, SVG-preferred, ICO/MIME and no-candidate.

Keep security parser units, but do not count them as lifecycle acceptance.

## Minimal recovery roadmap

### Phase 0 — containment

- **Scope:** hide both mutation controls temporarily; preserve safe reads/initials; isolate optional logo projection; restore retryable catalog and owner actions; eliminate raw/native target-flow errors.
- **Likely systems:** `app.js`, `workspace-catalog.js`, `api/_workspace-catalog.js`, `workspace-sidebar.js/.css`, logo route and lifecycle tests.
- **Prerequisites:** failing request stage/body and deployed hash; read-only logo metadata inventory.
- **Migration:** none; keep columns/private bucket.
- **Deploy/rollback:** compatible server projection before client; reversible app/flag rollback only, never schema/object deletion.
- **Acceptance:** optional logo cannot remove Workspace; ellipsis works after refresh/reconciliation and responsive replacement; no raw alert; confirmed logos read.
- **Deferred:** formats, creation, setup, Learnings.

### Phase 1 — authoritative project creation

- **Scope:** Project/Brand/Create, visible cards, new Brand, idempotent transaction, complete context, explicit navigation, secondary recovery.
- **Systems:** project route/service/contract, Board/Brand/access helpers, client creation module, markup/styles/catalog normalization/tests.
- **Prerequisites:** reliable catalog; agreed Workspace create roles.
- **Migration:** none if possible; separate additive idempotency migration if required.
- **Deploy/rollback:** dormant endpoint first, client second, restrict legacy last; client rollback leaves created data.
- **Acceptance:** forced failures produce no partial rows; existing path opens Board; new path opens setup; account switch cannot cross-reconcile; no normal unbranded Board.
- **Deferred:** Profile redesign/vector conversion/hardening.

### Phase 2 — guided Brand setup

- **Scope:** Basics/Discover/Review/Ready; revision-aware reusable draft; separate text/logo progress; preview/confirm/replace/upload/skip; final snapshot refresh/open.
- **Systems:** Brand update/analysis/logo services, setup route/modules/styles/entity normalization.
- **Prerequisites:** Phase 1 context.
- **Migration:** derive completeness if possible; additive setup state only if resumability needs it.
- **Deploy/rollback:** setup behind new path; upload first, discovery after fixtures; flag rollback preserves confirmed data.
- **Acceptance:** only confirmed proposals become shared; success updates all surfaces; stale preserves draft; Markmans has diagnosed outcome.
- **Deferred:** governed Learnings/asset library.

### Phase 3 — downstream lifecycle acceptance

- **Scope:** fix only blockers across campaign, owners, collaboration/review, Content Workspace, scheduling, Calendar, Auto-plan, CSV/PDF.
- **Systems:** `app.js`, campaign/content/calendar/planning/export modules and scheduling/review APIs.
- **Prerequisite:** valid Phase 1/2 Board.
- **Migration:** none expected.
- **Deploy/rollback:** boundary-sized fixes; lifecycle test gate; preserve data.
- **Acceptance:** both scripts finish with CSV/PDF; Board-only authorization remains bounded; no selected-Brand dependency.
- **Deferred:** provider publishing expansion/polish.

### Phase 4 — Brand Profile IA

- **Scope:** Overview, Identity, Audience, Voice & Messaging, Offers & Proof, Campaign Sync; explicit shared/snapshot language.
- **Systems:** routing/shell/sidebar, Brand Profile modules/APIs, responsive/dark styles.
- **Prerequisites:** stable entity/context/setup.
- **Migration:** none expected.
- **Deploy/rollback:** parallel route then switch navigation; flag rollback.
- **Acceptance:** users can identify shared vs campaign data; one logo home; desktop/compact/mobile/dark/200% zoom pass.
- **Deferred:** governed Learnings.

## Acceptance criteria

- One session identity and account-bound generations; stale responses never reconcile.
- Optional logo faults degrade locally; authorization/integrity remains safe and diagnosed.
- First Workspace creates owner membership atomically; selection is explicit/durable.
- Create project shows every/only authorized current-Workspace Brand.
- Normal creation cannot be unbranded or Workspace-mismatched.
- Brand/Board/snapshot/ownership are one server transaction; unknown outcomes cannot duplicate.
- Success changes URL, visible surface, all context, then confirms with full Board read.
- Setup is resumable/reviewable; logo supports confirm/replace/upload/skip and all visible projections.
- No native alert/raw object; categorized localized errors preserve drafts.
- Workspace/Brand/Board/public authorization matches the matrix.
- Both correctly created Boards complete campaign through CSV/PDF.
- Desktop, compact, mobile, dark, keyboard and 200% zoom pass.

## Manual acceptance scripts

### Scenario A — genuinely new account to PDF

1. Use a clean new account/browser; sign in and verify no prior context flashes.
2. Create first Workspace and verify owner membership; refresh and verify durable selection.
3. Create project “Autumn launch”; verify Workspace display and no normal unbranded path.
4. Choose new Brand “Acme”; submit once under delay/double-click; verify exactly one matching Brand/Board, ownership and snapshot provenance.
5. Verify guided setup opens, not Boards overview.
6. Enter name/domain; run text and logo discovery with meaningful progress.
7. Preview/reject candidate, upload/confirm valid PNG, and verify setup/Profile/sidebar/card. Separately verify no-candidate offers upload/skip.
8. Review identity, audience, voice, offers/proof and visuals; reject/edit/accept proposals; confirm reusable Profile.
9. Verify Ready completeness; continue; verify snapshot refresh, URL and visible Board.
10. Create deterministic/manual campaign (no real provider), assign owners, comment/reply/resolve, review/approve, and verify reload.
11. Create Social Media Posting content; schedule manually; verify Calendar/time zone.
12. Auto-plan another eligible post; preview/apply/reload.
13. Export CSV and inspect naming/headers/escaping/Brand/schedules.
14. Print/save presentation-ready PDF; verify Brand/range/posts/status/links/media and 200% zoom clipping.
15. Sign out and verify all authenticated context/actions clear.

### Scenario B — existing multi-Brand Workspace to export

1. Sign in to a fixture with two Workspaces and three authorized Brands in current Workspace; verify other/inaccessible Brand absent.
2. Open/cancel owner action before and after catalog/logo refresh; repeat keyboard, compact, mobile, dark and 200% zoom.
3. Create “Winter retention”; verify three Brand cards with logo/initials/name/context/selection plus new Brand.
4. Choose Brand B and create; verify one command, matching Workspace/Brand, ownership and snapshot.
5. Verify modal closes, URL/visible Board/full load/sidebar context all match immediately.
6. Refresh/direct-open and verify same context; run account-switch-during-create case and verify isolation.
7. Create deterministic campaign; assign owners; collaborate/review/approve.
8. Schedule and Auto-plan posts; verify Calendar.
9. Export CSV/PDF and verify only this Board with Brand B.
10. Verify Workspace-only, Board-only and public-token access stays bounded.

### Bounded failures

| Failure | Expected behavior and assertion |
|---|---|
| Catalog unavailable | Last confirmed context stale/disabled + Retry; Boards clearly independently available; never false empty. |
| Brand creation | Inputs preserved; no partial/duplicate Brand/Board; outcome lookup if uncertain. |
| Board creation | Selection/name preserved; no Board/orphan new Brand. |
| Snapshot initialization | Whole transaction rolls back; no empty Board navigation. |
| Logo upload | Existing logo/initials remains; inline retry; metadata unchanged; pending object compensated. |
| No discovery candidate | Upload/Skip; no mutation; setup continues. |
| Stale revision | Draft retained; compare/reload; no overwrite. |
| Permission loss | Stop mutation, safe read/route; no broadened access/partial write. |
| Account switch | Old UI operation closes; old response ignored; committed command remains attributable/reconcilable only to old account. |

## Unresolved production questions

1. Exact `/api/workspaces` status, `error.code/stage`, request id, and offending row/field?
2. Deployed HTML/script hash and revision for each reported failure?
3. Ellipsis hit test, computed style, event delivery, derived role, overlay, and render timing?
4. Does reconciliation close the menu immediately, or is click never delivered?
5. Create response/status, strict validation, pathname, `activeView`, and later navigation sequence?
6. Counts of null/mismatched Workspace IDs and inconsistent logo metadata (read-only measurement only)?
7. Deployment JSON body limit and failed upload encoded size?
8. Markmans sanitized candidate/rejection diagnostics, and was Analyze Website or explicit Find invoked?
9. Markmans region/user-agent HTML; SVG, `<img>`, CSS, manifest, ICO, redirects, MIME and dimensions?
10. Is browser print-to-PDF sufficient, or is deterministic downloaded PDF required?
11. Which Workspace roles may create Brands/projects?
12. Persist Workspace selection server-side or account-bound browser preference?
13. Derive setup completeness or add durable setup state?

## Direct operational recommendation

1. **Do not fully revert BW-36.12.** Keep applied additive columns/constraints and private bucket; do not delete metadata or objects.
2. **Partially disable its application mutations now.** Hide both current upload/discovery entry points, including broken Board-local upload, while preserving safe reads/initials. Re-enable repaired reusable upload first; discovery only after production-shaped diagnostics/fixtures.
3. **Repair Workspace catalog first.** Isolate optional logo projection, retain retryable confirmed context, and diagnose relationship/identity failures by request stage.
4. **Restore Workspace actions second.** Test the real owner control through refresh/reconciliation and responsive modes; do not invent a disconnected-handler cause unsupported by source.
5. **Then ship atomic Create project plus explicit navigation/context reconciliation.** Do not attempt another isolated logo/dialog/post-create fix.
6. **Then add guided setup and downstream acceptance.** Preserve governed Learnings for later.

No fixes are applied by BW-36.13; this is the implementation-ready audit and recovery plan.
