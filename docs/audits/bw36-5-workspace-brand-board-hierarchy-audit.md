# BW-36.5 — Workspace → Brands → Boards architecture, migration, authorization, and UX audit

> **Status:** documentation-only audit, 2026-09-28. **Target product decision:** approved and fixed. **Repository baseline:** current merged tree; the supplied BW-36.4 commit object `c4662c449c0e98677b6eccf59275aa5173941ed8` is not present in this checkout's reachable object database, so its checked-in implementation record and current files are the verifiable authorities. No production, provider, or customer data was queried.

Throughout this document, **Verified repository behavior** means directly established in the checked-in source or executable checks; **Verified persistence behavior** means established by table bootstrap SQL/routes (not production-schema parity); **Target decision** is approved product architecture; **Migration requirement** is mandatory transition work; **Recommendation** is the implementation choice made here; **Required work** belongs to the first Workspace release; **Optional future work** is explicitly deferred; and **Unresolved production evidence** requires production, legal, authenticated-browser, or deployed-RLS evidence.

## 1. Executive summary

**Target decision:** Tendra One must use `Account/User → Workspace → Brands → Boards`. Workspace is the durable tenant/team boundary; a Brand owns reusable Brand Profile knowledge and may have many Boards; a Board is Workspace-owned, normally has exactly one Brand, and keeps a stable Campaign Brand Snapshot. Single-Brand and multi-Brand usage are the same model.

**Verified repository behavior:** no table, route, durable identifier, membership relation, or server access helper represents that Workspace. `brands` are email-owned reusable records; `brand_members` grant Brand roles; `boards` are independently owned/shared and optionally reference one Brand. The UI's “Workspace Brand” is a hashed-email browser preference over the accessible Brand catalog. Neither `Content Workspace` nor Brand workspace/editor markup is a tenant. Therefore no existing entity can safely be renamed into Workspace.

**Verified persistence behavior:** Board `brand_id` is nullable; the Board stores `brand_core_snapshot` plus source revision/timestamps and one backup. Brand deletion detaches Boards while retaining their snapshots. Brand membership can currently confer access to all associated Boards. Board shares and public tokens are separate. Runtime `CREATE TABLE IF NOT EXISTS` bootstrap exists for Brands/Boards; repository migrations harden other areas but do not establish a Workspace tenant or comprehensive Workspace RLS. Production row counts/schema parity remain unknown.

**Migration requirement:** an additive Workspace schema and deterministic backfill are required. Recommend **Option C, explicit user-led grouping**, implemented initially as one generated personal Workspace per primary owner, preserving every Brand/Board/share and letting authorized users deliberately regroup later. Do not infer grouping from browser preferences.

Safest rollout: expand schema → add server authorization → idempotent backfill → verify → dual read → Workspace APIs/client authority → selectors → Workspace-aware creation → write cutover → retain fallback → evidence-based contract. Largest risks are accidental cross-tenant access through inherited Brand/Board grants, ambiguous owner-email identities, shared-Brand/shared-Board placement, snapshot-only/unbranded Boards, policy/write races, and destructive cleanup before adoption.

## 2. Evidence boundary

### Inspected evidence

* **Prior audits/product records (read completely):** `docs/audits/bw36-contextual-shell-funnel-and-brand-workspace-audit.md`, `docs/audits/bw36-3-brand-workspace-and-governed-learnings-audit.md`, `docs/audits/brand-workspace-current-state-audit.md`, `docs/product/workspace-architecture.md`, and relevant Board-to-Brand, canonical Brand, sharing/roles, snapshot, deletion, dashboard/Boards, Brand Core, Content Workspace, Insights, and migration audits under `docs/audits/`.
* **BW-36 implementation records:** BW-36.1R1, BW-36.2, and BW-36.4 records under `docs/implementation/`; the workspace Brand management repair record was also inspected.
* **Persistence/schema:** `api/_brands-storage.js`, `api/_boards-storage.js`, document/social schema helpers, all checked-in `migrations/*.sql`, rollback/verify files, and `docs/runbooks/production-schema-verification.md`.
* **Authentication/authorization:** `_auth-session`, `_brand-access`, `_board-access`, `_board-public-sharing`, `_brand-deletion`, serializers, document access, social authorization, and Brand/Board route handlers.
* **Routes/contracts:** all files under `api/brands/` and `api/boards/`, relevant AI/Brand context, avatar/upload, export, content, Insights, Funnel, and social routes.
* **Client authorities:** `app.js`, `brand-sidebar.js`, `index.html`, `styles.css`, `language.js`, `content-workspace.js`, `funnel-simulator.js`, `persona-journey-simulator.js`, export modules, and package/workflow registrations.
* **Tests:** relevant `check-bw1`–`check-bw20`, BW-25/27/28/29/30/31/33/35/36 checks, browser integrity, Workspace Brand shell/deletion, and RLS/migration checks.

### Proven and not proven

Proven: checked-in table shapes and bootstrap behavior; route allowlists; role projections; browser preference mechanics; Board/Brand association, snapshot, sharing, deletion, shell and localization contracts; absence of a Workspace persistence/API authority in the repository. Source checks prove contracts, not deployed database state or pixels.

**Unresolved production evidence:** deployed schema/RLS parity; row counts and ownership conflicts; public-link prevalence; orphan/deleted data; browser behavior under real auth, long-lived tabs, access revocation, assistive technology and all target breakpoints; legal retention; external consumers; whether inaccessible historical records exist. No authenticated browser, database, provider, or AI request was used.

## 3. Fixed product hierarchy

```text
Account/User
  └─ Workspace Membership ──> Workspace (tenant boundary)
                                  ├─ Brand ── Brand Profile
                                  │    ├─ Brand Learning (human-approved)
                                  │    └─ Board / Campaign
                                  │         ├─ Campaign Brand Snapshot
                                  │         └─ Campaign Observation
                                  └─ legacy unassigned Board (migration-only)
```

| Object | Precise responsibility |
|---|---|
| Account/User | Authenticated human identity; never the tenant itself. |
| Workspace | Durable isolation, administration, billing/locale/defaults, and top-level ownership boundary. |
| Workspace Membership | User-to-Workspace grant and Workspace role/invitation lifecycle. |
| Brand | Workspace-owned reusable business identity and ACL refinement point. |
| Brand Profile | Current reusable Brand knowledge, stored/versioned with the Brand. |
| Board | Durable campaign collaboration/content container within one Workspace. |
| Campaign Brand Snapshot | Stable Board-owned copy of Brand knowledge used by that campaign. |
| Campaign Observation | Board-scoped evidence/proposal; not reusable by default. |
| Brand Learning | Brand-scoped, reviewed reusable knowledge; only human approval activates it. |

## 4. Product terminology

* **Workspace:** persisted tenant/team environment. Never a selected Brand, filter, layout, or local-storage value.
* **Brand:** reusable identity inside exactly one Workspace.
* **Brand Profile:** current reusable Brand knowledge (`brand_core` remains an internal compatibility name).
* **Board / Campaign:** Board is the durable product object; “campaign” is its user-facing work concept, not another tenant.
* **Campaign Brand Snapshot:** Board-owned, versioned point-in-time Brand Profile copy.
* **Campaign Observation:** Board-local finding eligible for explicit promotion.
* **Brand Learning:** reviewed reusable Brand knowledge, unavailable across Brands unless separately approved there.
* **Content Workspace:** existing Board-bound content production feature; retain its visible name only if research confirms users do not mistake it for the tenant. Prefer **Content Studio / Content-Bereich** in a later separately scoped terminology change.
* **Brand Workspace:** legacy/internal editor phrase; visible UI should say **Brand Profile**. Internal CSS/IDs may remain until safe refactor.
* **Browser-local selection:** convenience preference/filter only. **Persisted Workspace identity:** server-authorized Workspace ID from route/session/API.

## 5. Current persistence inventory

| Table/object | Stable ID / owner / access | Revision | Deletion | Brand/Board/user relation | Workspace candidate? |
|---|---|---|---|---|---|
| Signed session payload | Cookie identity (`id/sub`, email, name/avatar); authenticated by HMAC | expiry only | sign-out/expiry | supplies user identity | **No**: not durable tenant data. |
| `brands` | UUID; `owner_email`; owner or `brand_members` | bigint `revision` | owner-confirmed hard delete | reusable `brand_core`; Boards optionally reference it | **No**: it is the Brand required below Workspace. |
| `brand_members` | composite Brand/email; Brand ACL | none; timestamps | cascades/manual removal | admin/editor/viewer, invite metadata | **No**: scope is one Brand. |
| `boards` | UUID; owner ID/email; Board/Brand grants | `updated_at` concurrency token | owner hard delete plus document cleanup | nullable `brand_id`, snapshot/provenance, user owner | **No**: campaign object. |
| `board_editors` | composite Board/email | none | cascades with Board | editor/viewer Board-only grants | **No**: scope is one Board. |
| Board public state | columns on Board; token stored only as SHA-256 hash | created timestamp | revoke clears state; Board deletion removes it | anonymous read of one Board only | **No**. |
| Board snapshot/provenance | columns on Board | source Brand revision + Board `updated_at` | survives Brand detach; dies with Board | copy/backup associated with Board | **No**. |
| Canvas/content/schedules/approvals/documents | Board-bound JSON/rows | mixed Board/material/schedule revisions | Board-specific cascades/cleanup | campaign content | **No**. |
| Social connection/publication records | account/Board/destination scoped per feature | feature-specific | feature policy | provider/account execution, not tenant catalog | **No**. |
| Browser local storage | namespaced strings/JSON | none | browser/sign-out cleanup varies | preference/draft/cache | **Never**. |

No durable organization, tenant, account container, project, folder, catalog, or team record with both stable identity and membership semantics exists. Runtime DDL is repository evidence, not proof that production has no extra unmanaged table; production inventory must verify that before schema design is finalized.

## 6. Current non-persisted state

The browser-restored “Workspace Brand” is `ephemeralBrandSwitcherSelection`, persisted under a hashed per-email key and reconciled against the authorized catalog. `state.currentBoardId`, name, load generation and access own active Board state; `state.boardBrandAssociation` owns the loaded association; Brand mode/profile state owns the opened reusable Brand; `brandCatalog.entries` is a cache; views are `state.activeView`; public token/path and dialogs add transient session/URL state. Board IDs may come from the path, but primary navigation is state-driven.

None of selected Brand, Brand mode, cached catalogs, local/session storage, DOM/sidebar projection, active view, or URL hints may become tenant authority. Only a server-authorized Workspace ID may scope reads/writes. Cache keys must include account and Workspace, and stale generations must be rejected.

## 7. Existing “Workspace” terminology inventory

| Significant usage | Classification | Decision |
|---|---|---|
| `content-workspace.js`, Content Workspace labels/classes/tests | Content Workspace feature | Keep internal identifiers; consider visible “Content Studio” later. |
| `#brand-core-workspace`, Brand workspace/editor copy, docs/tests | Brand workspace/editor; legacy | Rename visible surface to Brand Profile; internal IDs can remain during compatibility. |
| Workspace Brand selector/delete strings and `workspaceBrand*` concepts | legacy terminology / temporary UI state | Replace visible text and eventually internal names after Workspace rollout. |
| BW-36.4 Brand sidebar | temporary UI projection | Replace as a unit in Phase 4; do not overload it into tenant authority. |
| `.workspace`, shell/layout variables | generic layout | May remain internal when not user-facing. |
| product/audit docs describing planned Workspace | intended tenant, not implementation | Preserve as historical evidence; this audit supersedes architecture decisions. |
| tests named workspace Brand/deletion/shell | obsolete Brand-as-Workspace assumption | Keep safety assertions, rename/refixture when replacement exists. |
| analytics/storage keys using Workspace for selected Brand | legacy/temporary | Version and retire; never reinterpret old values as Workspace IDs. |
| API surface | no tenant Workspace routes today | Add explicit `/api/workspaces/...`; never alias Brand ID. |

Repository search found no current tenant Workspace analytics authority. Any deployed analytics not represented here is unresolved production evidence.

## 8. Target entity model

### Workspace and membership

Required `workspaces`: `id uuid PK`, `name`, optional unique/non-authoritative `slug`, optional approved `avatar_url`, `created_by_user_id/email`, `status active|archived|pending_delete`, `locale`, `revision bigint`, timestamps, `archived_at`, nullable deletion-request metadata. Names need not be globally unique. Prefer immutable UUID in authorization and URL; slugs are presentation/redirect aids only.

Required `workspace_memberships`: `(workspace_id,user_id)` stable key (temporary normalized email only for pending invitations), `role owner|admin|member|viewer`, `invitation_status pending|accepted|revoked|expired`, inviter, timestamps, `revoked_at`, and optional membership revision. Exactly one or more accepted owners must remain. Invitations should be separate rows/tokens if identity is not yet resolvable.

### Brand

Add `brands.workspace_id`. After verified backfill it is `NOT NULL` and references Workspace with delete restricted. Retain Brand UUID, Profile JSON, revision, avatar data and Brand-specific roles. Workspace owns the Brand; `owner_email` remains compatibility/audit during migration, then ownership is expressed by Workspace plus an optional Brand-level responsible person—not a second tenant owner. Archive before delete. Moving Brands between Workspaces is deferred.

### Board — decisive recommendation

Persist **both `boards.workspace_id NOT NULL` and normally `boards.brand_id NOT NULL`**. Workspace ID is deliberate denormalization required for direct tenant isolation, fast policy evaluation, unassigned migration quarantine, and independence when Brand is archived/deleted. Enforce a composite relation `(brand_id, workspace_id) → brands(id, workspace_id)` with a unique supporting key. New production Boards must be branded; only flagged migration/quarantine records may temporarily have `brand_id NULL`. Draft creation must choose a Brand atomically; do not persist an unassigned draft.

Board public tokens authorize a bounded serialized Board view, never Workspace/Brand catalogs or reusable Profile. Shared Boards do not imply reusable Brand edit. Brand deletion should archive/block while active Boards exist; if an exceptional hard delete occurs after retention, null `brand_id` only under a recorded migration/admin operation while retaining Workspace and snapshot.

## 9. Target relationship invariants

| Invariant | Enforcement |
|---|---|
| Every Brand belongs to exactly one Workspace. | DB `NOT NULL` FK after backfill; RLS. |
| Every durable Board belongs to exactly one Workspace. | DB `NOT NULL` FK; no client default. |
| Board Brand, when present for legacy exception, is in same Workspace. | Composite FK plus same-transaction service check. |
| One Brand has many Boards; Board has at most one active Brand. | FK/cardinality. |
| New Boards always have a Brand. | Service validation; client requires choice; later DB check using migration-state policy. |
| Snapshot survives association loss/archive and never silently updates. | Service contract; retained snapshot/provenance. |
| Board association, not selector, is campaign truth. | Server response/client projection. |
| Cross-Workspace assignment/move/copy is rejected by default. | RLS, composite FK, service authorization. |
| Workspace deletion cannot orphan active children. | Restrict; archival and explicit staged purge. |
| All access is tenant-bounded; public token is one-Board exception. | RLS/server policies and serializer. |

Clients present these constraints but are never enforcement. Service validation supplies humane errors/idempotency; database constraints close races.

## 10. Single-Brand Workspace behavior

Quick start creates one Workspace then one Brand and first Board in transactions/idempotent steps. The sole Brand auto-selects; sidebar shows Brand identity/Profile link but collapses the switch affordance. Home and Boards remain Workspace-scoped; Board creation defaults the only writable Brand. Invitations are Workspace invitations with optional Brand/Board restriction. Adding a second Brand immediately reveals All Brands/switch controls without migration or type change.

## 11. Multi-Brand Workspace behavior

Home summarizes authorized activity across Brands. Workspace selection is fixed first; Brand selector offers **All Brands** for library/overview and individual authorized Brands. Brand-specific Boards and creation use that Brand; All Brands creation forces an explicit Brand choice. Agency users can navigate Profiles without losing open Board work. Permissions may hide Brands/Boards, but counts must not leak inaccessible objects. Switching a filter never mutates Board association.

## 12. Workspace switching

Place the selector directly below Tendra One identity. Show Workspace logo/initials and name, then authorized Workspaces. Authority is route/API Workspace ID validated server-side; persist only a last-used Workspace ID per account as a convenience and reconcile it at boot. Prefer `/w/:workspace_id/...`; session memory mirrors the validated route.

Loading shows skeleton without old-tenant content. Revoked/deleted selection clears caches, announces access loss, removes preference, and routes to another authorized Workspace or “No Workspace selected.” Mobile uses an accessible sheet.

**Deterministic rule:** switching Workspace closes the active Board before exposing target content; an active Board cannot remain open across switches. If there are unsaved local edits, block and offer Save/Discard/Cancel. Deep-opening a Board switches only after server authorization and explicit confirmation when it differs from current Workspace.

## 13. Brand switching inside a Workspace

Brand selection is a Workspace-bounded library/Profile filter. Offer All Brands on overview/library, not while editing a campaign. One Brand collapses switch affordance. Opening a Board makes its associated Brand the displayed campaign context without rewriting the saved filter. Reject catalog entries outside active Workspace, clear stale selection on access loss, use approved Brand avatar/initials, and show a truthful no-Brand empty state. Viewers can select/view authorized Brands but cannot create/edit.

## 14. Board ownership and context

Create Board inside an authorized Workspace and Brand; Brand is mandatory for new production Boards. Opening reads authoritative `workspace_id`, `brand_id`, snapshot and access. Board switching follows target Board's Workspace/Brand, not local filters. Changing Brand within one Workspace is an explicit editor/admin operation with preview, fresh snapshot choice, revision check and audit. Board duplication copies content and stable snapshot; user chooses a destination Brand in the same Workspace and explicitly chooses retain snapshot versus initialize from destination Profile.

Board shares remain Board-only unless an explicit higher grant exists. Public links remain read-only and reveal neither Workspace membership nor reusable Profile. Archive precedes deletion; deletion is owner/admin policy-bound. Legacy unbranded/snapshot-only Boards live in an identified migration state and remain recoverable, but cannot be silently assigned.

## 15. Recommended sidebar architecture

Expanded order: **(1)** Tendra One identity, **(2)** Workspace selector (logo/name/switch), **(3)** Brand context (All Brands or avatar/name/Profile), **(4)** navigation, **(5)** activity/help/account. When a Board is active, a light relationship line names the campaign under Brand context; do not call snapshots “canonical” or “saved Brand Core.”

Single-Brand reduces the Brand switch control but keeps Brand Profile access. Compact rail exposes separate labelled Workspace and Brand buttons; mobile bottom navigation contains destinations, while selectors live in the account/context sheet—not duplicate cards. Only one selector instance/model owns each value.

**Replacement rule:** Phase 4 replaces BW-36.4's projection with a Workspace-aware derived model in one cutover. Do not add Workspace semantics to `ephemeralBrandSwitcherSelection`, stack another “card,” or make the current Brand block dual-purpose. Preserve BW-36.4 until replacement passes rollback acceptance.

## 16. Recommended top-bar behavior

Keep full Canvas toolbar only on Canvas and BW-36.2 compact context bar only on mapped non-Canvas surfaces. For Board-dependent non-Canvas pages show bounded `Board name · Brand name`; add Workspace only when entering by deep link or when ambiguity/access transition requires `Workspace / Brand / Board`, then collapse responsively. Library shows **Boards** and optional Brand filter, never remembered Board. Do not add selectors, graph commands, sharing, or dense breadcrumbs to the compact bar.

## 17. Home/Dashboard behavior

* No Workspace: onboarding/join/create, no customer content.
* Workspace with no Brands: permission-aware Create Brand or “Ask an admin.”
* Brands/no Boards: Profile completion and Create Board.
* Single Brand: Brand summary, recent Boards, next action; selector reduced.
* Multi Brand: cross-Brand recent activity and Brand cards, respecting grants.
* Recent Board: Board/Brand identity and access state; never stale local selection.

## 18. Boards library behavior

Scope every query by Workspace. Default All Brands (unless one Brand); offer Brand, owned/shared and status filters. Creation uses current Workspace and mandatory Brand. Cards show Board name, Brand avatar/name, update time and access role; do not reveal hidden Brand data to Board-only collaborators. Legacy null association says **Brand not assigned (legacy)**, not All Brands. Empty states distinguish no Brands, no Boards, no filter matches and no access. Server results—not client filtering—define visibility.

## 19. Brand Profile behavior

Brand Profile is content inside a Workspace. Header shows Brand identity/avatar and Workspace context. It owns reusable knowledge, Brand-specific roles, campaign list, Campaign Sync and governed Learnings. Multiple Boards reference it but snapshots remain stable. Viewers inspect; editors update Profile/propose/approve per policy; admins manage access/archive; destructive deletion is owner/Workspace-admin controlled and blocked by active dependencies. Archive hides new selection but preserves Boards/snapshots/audit.

## 20. Campaign Brand Snapshot behavior

Creation copies the authorized Brand Profile, `brand_id`, Workspace, source revision/update time and copied time atomically. Board revision protects writes. Profile edits do nothing automatically. Campaign Sync compares current snapshot to the exact associated Brand and displays field-level provenance; explicit confirmation updates selected fields and backup/history after revalidation. Brand archive/deletion leaves the snapshot readable. Duplication follows section 14. Composite constraints prevent cross-Workspace sources. Legacy snapshots with no Brand remain labelled historical and cannot claim current Profile lineage.

## 21. Brand Learnings placement

Preserve BW-36.3: Learnings belong to one Brand; observations begin on one Board; promotion needs explicit authorized human approval; approved active Learnings can inform future Boards of that Brand only. They never flow automatically to another Brand in the Workspace. AI may propose bounded evidence but cannot approve. Workspace-wide agency Learnings are out of first-release scope.

## 22. Authorization hierarchy

“Account owner” below means the human controlling their login, not a tenant superuser. ✓ allowed, C conditional explicit lower-level grant, — denied.

| Action | Account only | WS owner | WS admin | WS member | WS viewer | Brand owner/editor/viewer | Board owner/editor/viewer | Public token |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| View Workspace | — | ✓ | ✓ | ✓ | ✓ | C | C | — |
| Manage Workspace / delete-archive | — | ✓ | manage/archive, no delete | — | — | — | — | — |
| Invite Workspace members | — | ✓ | ✓ | — | — | — | — | — |
| Create Brand | — | ✓ | ✓ | ✓ | — | — | — | — |
| Edit Profile | — | ✓ | ✓ | C | — | owner/editor ✓; viewer — | — | — |
| Archive/delete Brand | — | ✓ | ✓ archive; delete policy C | — | — | owner archive C; editor/viewer — | — | — |
| Create Board | — | ✓ | ✓ | ✓ in writable Brand | — | owner/editor ✓ | — | — |
| Move/change Board Brand | — | ✓ | ✓ | C | — | destination editor + Board editor | owner/editor C; viewer — | — |
| View snapshot | — | C | C | C | C | C | owner/editor/viewer ✓ | view-only serialized C |
| Synchronize snapshot | — | ✓ | ✓ | C | — | editor + Board edit ✓ | owner/editor with Brand read/write C | — |
| Propose Learning | — | ✓ | ✓ | C | — | owner/editor ✓; viewer optional product decision | Board editor only if Brand proposal grant | — |
| Approve Learning | — | ✓ | ✓ | — | — | authorized human owner/editor ✓ | Board role alone — | — |

Recommend Workspace viewer. “Brand owner” becomes a Brand responsibility role, not tenant ownership. Workspace deletion requires Workspace owner, recent reauthentication, last-owner protection and retention workflow.

## 23. Permission inheritance

Use understandable additive grants: Workspace owner/admin can manage all descendants; Workspace member can discover the Workspace and create only where policy permits; viewer reads tenant-visible objects. Brand-specific roles grant that Brand/Profile and associated Boards according to role. Board-specific shares grant only that Board and its safe snapshot, never Profile editing or sibling discovery. Missing grant denies. Do **not** add explicit deny in v1; it makes inheritance opaque. If a Brand must be restricted from ordinary members, mark it restricted and require a positive Brand grant—one simple boundary, not per-action deny lists.

Ownership is Workspace-level durability plus object creator/responsible metadata. External collaborators should normally receive Brand-specific or Board-specific grants, not Workspace membership. Least privilege wins where actions combine objects: snapshot sync requires Board edit **and** Brand read; association change requires Board edit and destination Brand board-create/read rights.

## 24. RLS and server authorization

Required policies: Workspace visible to accepted membership; memberships visible to self and manageable by owner/admin; Brands require same-Workspace membership or explicit Brand grant; Brand roles remain tenant-matched; Boards require same Workspace plus inherited/explicit Board access; Board shares cannot escape Workspace; snapshots follow Board visibility but reusable Profile fields remain serializer-bounded; Learnings require Brand access and human approval policy.

Every create/move/associate transaction locks/rechecks actor membership, source/destination objects, revisions and matching Workspace before write. Composite FK rejects races. Public token accepts exactly one canonical token, compares its hash timing-safely, emits only public Board serialization, and never calls Workspace/Brand catalog APIs. Service-role use is confined to named background/admin operations with explicit tenant predicates, audit IDs and no user-controlled tenant bypass.

Add database integration tests using two Workspaces and adversarial IDs for every CRUD/join/function, public token, revoked membership and service path. Current server checks are necessary compatibility defense but not a substitute for deployed RLS.

## 25. Existing role compatibility

Current Brand owner/admin/editor/viewer can map to Brand responsible owner/editor/viewer; retain admin only as Brand access manager if product needs it. Board owner/editor/viewer retain object roles. Current Brand writers inherit Board edits; migration must preserve that behavior initially behind compatibility mapping, then product may narrow it visibly.

Ambiguities: `owner_email` versus session ID; unowned Boards; Brand owner differing from Board owner; a shared Brand containing Boards owned/shared by others; Board-only collaborators lacking Brand access; Brand members who currently see every associated Board. Never elevate a Brand member to Workspace admin/member merely to preserve one Brand. Instead create minimal Workspace visibility shell plus equivalent Brand/Board grants. Board-only users get a constrained external membership/grant sufficient to resolve tenant context, not Brand catalog access. Report every conflicting primary owner for review.

## 26. Workspace creation flow

New user: localized name (suggest account/team, editable), optional logo, locale, then choose **Quick start with one Brand** or **Set up multiple Brands**. Quick start asks Brand name/Profile basics and can create first Board; agency path adds Brands/invites progressively. Workspace creation commits Workspace + owner membership atomically; subsequent Brand/Board steps are idempotent and cancellable. Cancel after Workspace commit lands on empty Workspace; cancel before commits nothing. Trim/length/control-character validation; duplicate names allowed with disambiguation. Invitations show role/scope before send.

## 27. Board creation flow

Use current server-authorized Workspace. Single writable Brand defaults visibly; multi-Brand requires choice. Validate Workspace membership and Brand board-create capability, create Board + association + Profile snapshot/provenance in one transaction, return Workspace/Brand/Board IDs and revisions. Cancellation writes nothing. An unassigned option is unavailable except an admin migration repair tool; no new production Board may remain unbranded.

## 28. Brand creation flow

Use current Workspace ID from route, not browser selection. Ask name, optional avatar and Profile starter; assign creator Brand editor/responsible metadata under Workspace policy. Duplicate names are allowed but warn/disambiguate. On success offer Open Brand Profile or Create Board. Never search another Workspace, reuse an identically named Brand, or auto-assign a cross-Workspace Board.

## 29. Moving Brands and Boards

| Operation | First release | Contract |
|---|---|---|
| Brand between Workspaces | **Deferred** | Too many membership, Board, Learning, audit and share implications. Later owner/admin both sides, atomic entire graph or copy/archive. |
| Board between Brands, same Workspace | Supported carefully | Board editor + destination Brand right; preview; preserve old snapshot until explicit initialize/sync; retain content/comments/shares/audit; transaction + revision/idempotency rollback. |
| Board between Workspaces | **Deferred** | Prefer explicit copy after reauthorization/redaction; never update two FKs casually. Shares/integrations/public token require review/revocation. |
| Copy Board | Same Workspace v1 | New ID, destination Brand required; content/comments policy explicit; no approvals/public token; provenance records source; Learnings do not copy. |

Cross-Workspace copy is optional future work and must default to stripping memberships, public tokens, provider links, schedules/approvals and Brand Learnings.

## 30. Deletion and archival

Archive Workspace first: block new writes/invites, retain read/export per policy. Hard delete is delayed, owner-confirmed, legally governed, and blocked until child disposition is explicit; never cascade silently. Archive Brand blocks new Boards/edits but retains Profile, Learnings, Boards and snapshots. Active Boards block hard Brand deletion; migration-only detachment must retain Workspace/snapshot and audit. Archive Board before hard delete; current hard-delete behavior remains compatibility until policy ships. Member removal revokes caches/sessions promptly but retains audit actor IDs. Restores must revalidate names/access and never restore public tokens automatically. Legal/audit retention and eventual blob/cache/search deletion require counsel/operations input.

## 31. Current-data migration inventory

Repository fixtures/checks prove shapes and scenarios, not production quantities. No authorized fixture provides representative counts.

| Population | Repository evidence | Production count |
|---|---|---:|
| Users/accounts | signed session identity; no user table here | unresolved |
| Owned/shared Brands; memberships | supported by `brands`/`brand_members` | unresolved |
| Owned/shared/unowned Boards | supported by owner columns/`board_editors` | unresolved |
| Branded Boards | nullable `brand_id` supported/tested | unresolved |
| Snapshot-only/unbranded Boards | supported/tested legacy states | unresolved |
| Multiple/conflicting owners | structurally possible across Brand/Board | unresolved |
| Browser preferences | per-browser/per-email; inaccessible server-side | intentionally not counted/backfilled |
| Public tokens | enabled/hash columns and routes | unresolved |

Required preflight produces aggregate-only counts by ownership/access category, null/mismatch status and token state; it must not expose names, emails, content or token material.

## 32. Migration strategy options

| Option | Loss/access risk | Agency/shared correctness | Reversibility/confusion | Generated count / complexity |
|---|---|---|---|---|
| A: Workspace per Brand | Low content loss; fragments unbranded/shared Boards | Poor agency grouping; duplicates tenant shells | Reversible but visibly noisy | Up to Brands + extras; medium |
| B: Workspace per primary owner | Preserves owned portfolio; owner inference can overgrant shared objects | Good agency owners, ambiguous co-ownership | Good with mapping; moderate surprise | Roughly owners; medium |
| **C: default per primary owner + explicit user-led grouping** | Lowest if grants preserved and exceptions quarantined | Good agency baseline without guessing shared grouping | Best: mapping/audit retained and moves intentional | Roughly owners + exception workspaces; medium-high |
| D: access-component grouping (connected graph of shared Brands/Boards) | High privilege-merge risk | Can collapse unrelated clients through one collaborator | Hard to explain/undo | Unpredictable; high |

**Recommendation: C.** Its mechanical seed resembles B, but its defining rule is no inferred organization semantics: generate a personal/default Workspace for each deterministic primary owner, preserve scoped grants, quarantine conflicts, then let owners explicitly create/group/move after dedicated tooling. It minimizes privilege convergence and never uses browser preferences.

## 33. Recommended backfill algorithm

1. Create migration-run ID, immutable source watermark and mapping tables with unique source keys; dry-run aggregate counts.
2. Normalize resolvable account identity by stable auth user ID; where only email exists, use normalized email compatibility key and flag for later binding. Never merge distinct provider subjects solely by display name.
3. For each deterministic primary owner key, upsert Workspace UUID derived/stored in mapping, name `Personal Workspace` (localized on presentation; append stable short suffix only for collision in that user's list), active status, creator and revision 1; upsert owner membership.
4. For ownerless or conflicting-owner records, create a restricted **Migration recovery Workspace** per deterministic custody key; do not grant broad users; queue manual resolution.
5. Assign each owned Brand to its owner's generated Workspace. Preserve Brand ID, owner fields, Profile, memberships and revision. For shared Brand users, create only the minimum Workspace context membership/external grant needed to resolve Brand; preserve exact Brand role—never Workspace admin.
6. Assign each branded Board to its Brand's Workspace, regardless of Board owner. Preserve Board owner/shares/public state/snapshot. If Board owner lacks context access, add minimal external Workspace visibility plus existing Board grant.
7. For unbranded Boards, assign to Board primary owner's Workspace; ownerless Boards go to recovery Workspace. Keep `brand_id NULL`, mark `migration_state=legacy_unassigned`, and preserve snapshot/provenance exactly.
8. If a Board's Brand mapping and proposed Workspace disagree, do not update either; quarantine with reason `workspace_brand_conflict`.
9. Shared Board-only and shared Brand users retain their exact grants; do not infer access to siblings. Conflicting owners are reported, not reconciled automatically.
10. Deleted/inaccessible/tombstoned records remain excluded or mapped to recovery according to retention policy; record counts and hashes, not content.
11. Each step is upsert/idempotent using mapping/run keys, transactional per aggregate, retryable after rollback, and never reads local preferences.
12. Verify total mapped source IDs, zero duplicate mappings, zero cross-Workspace Brand relations, all durable Boards have Workspace, grant equivalence, unchanged snapshot/content hashes, unchanged public hashes, and repeat-run zero semantic changes. Human sign-off gates cutover.

## 34. Migration phases

1. Add nullable tables/columns/constraints/indexes and mapping ledger.
2. Add server models/access helpers behind flags.
3. Run idempotent backfill in bounded batches.
4. Verify aggregates, relationships, hashes and access equivalence.
5. Enable dual reads; legacy remains authoritative on disagreement and emits safe diagnostics.
6. Add Workspace-aware versioned APIs.
7. Switch UI identity/selectors for opted cohorts.
8. Cut writes to require Workspace and same-tenant Brand; dual-write compatibility fields.
9. Retain legacy readers and repair queue through production adoption.
10. Only later make non-null constraints, remove fallback/legacy terms and contract unused fields.

No destructive contraction occurs until production metrics, rollback rehearsal, support window and data-owner sign-off pass.

## 35. Rollback strategy

Schema rollout is additive and can be ignored by old code; do not drop columns in rollback. Backfill rollback marks run inactive/removes only run-owned mappings/rows after proving no new writes, otherwise forward-repair. UI rollback flips to BW-36.4 and legacy APIs without rewriting data. RLS rollout uses staged shadow/report policies, then transactionally swaps; restore prior policies on denial spikes. Write cutover keeps original Brand/Board ownership, association and snapshot fields, dual-write ledger and queued replay. Partial migrations stay in legacy mode. Relation inconsistencies quarantine objects. Failed membership creation aborts that aggregate assignment; never assign content without access. Preserve old relationships until adoption and restore rehearsal are complete.

## 36. API and contract changes

Likely routes: Workspace catalog/item/members/invites/bootstrap; Workspace-scoped Brand catalog/create/item/members; Workspace-scoped Board list/create/item/move/share; association/snapshot sync; Home/sidebar bootstrap; exports that display identity. Prefer `/api/workspaces/:workspace_id/brands` and `/api/workspaces/:workspace_id/boards`; Board item may stay ID-addressed only if response/authorization always includes Workspace.

Requests/responses use `snake_case`, stable `workspace_id`, `brand_id`, `board_id`, `revision`/`updated_at`, role/capability projection and migration state. Strict per-operation allowlists reject mixed operations. Never accept tenant from payload when route defines it without equality check. Version additive responses or `v2` endpoints; old clients receive legacy-compatible bounded fields. Export filenames may include sanitized display names only after authorization, never IDs/tokens/emails by default.

## 37. Client-state changes

One authority each: `active_workspace_id` = validated route/bootstrap; `selected_brand_id` = optional Workspace-bounded UI filter; `active_board_id` = authorized loaded Board; Brand mode = view state, not identity. Board response owns Board Brand. Add Workspace/catalog/Board lifecycle generations; abort/ignore responses whose account, Workspace or generation differs.

Version storage keys (`tendra:v1:last_workspace:<account-subject-hash>`, `...:brand_filter:<workspace_id>`) and store IDs only. Broadcast changes across tabs; each tab revalidates before rendering. Sign-out/account switch clears memory, tokens, catalogs, filters and sensitive caches. Deep links resolve server-first and never flash prior tenant. Do not migrate the old Workspace Brand key into Workspace identity.

## 38. Concurrency and lifecycle

Workspace has bigint revision; membership rows need `updated_at` and revision for administrative conflicts; retain Brand revision; introduce explicit Board revision eventually while supporting `updated_at`. Workspace switch increments generation and closes/guards Board. Deleted/archived Workspace or changed access invalidates clients and mutation tokens. Moved Brand/Board returns conflict with current identities. A Board open during allowed same-Workspace Brand movement becomes read-only until refetch. Snapshot sync locks Board/Brand revisions and is idempotent by operation key. Creation/backfill/move/invite operations require idempotency keys and replay-safe responses.

## 39. Privacy and security

Workspace is tenant isolation. Authenticate stable user identity, bind invitations securely with expiry/single use, and avoid email as final identity. Public Board links expose one bounded Board projection, no Profile/catalog/memberships. Avatar URLs require approved schemes/storage, authorization, CSP and no provider secrets. Diagnostics/analytics use pseudonymous IDs, enum/error classes and counts—not names, emails, content, tokens or payloads. Audit metadata records actor ID/action/revision without raw content.

Exports avoid sensitive naming. Provider data remains scoped to authorized account/Board. AI context is assembled server-side from the exact Workspace/Brand/Board grants; cache/prompt retrieval keys include Workspace and must reject mismatch. Brand, Board, snapshot and Learning content may never cross Workspace boundaries. Approved Learnings remain untrusted delimited content and Brand-scoped.

## 40. Localization

| English | German |
|---|---|
| Workspace | Arbeitsbereich |
| Switch Workspace | Arbeitsbereich wechseln |
| Create Workspace | Arbeitsbereich erstellen |
| Workspace settings | Arbeitsbereich-Einstellungen |
| Workspace members | Mitglieder des Arbeitsbereichs |
| Brand | Marke |
| All Brands | Alle Marken |
| Switch Brand | Marke wechseln |
| Create Brand | Marke erstellen |
| Brand Profile | Markenprofil |
| Boards | Boards |
| Create Board | Board erstellen |
| No Workspace selected | Kein Arbeitsbereich ausgewählt |
| No Brands yet | Noch keine Marken |
| No Boards yet | Noch keine Boards |
| Used by this campaign | Von dieser Kampagne verwendet |
| Campaign Brand Snapshot | Kampagnen-Markenstand |
| Move | Verschieben |
| Archive | Archivieren |
| You no longer have access to this Workspace. | Du hast keinen Zugriff mehr auf diesen Arbeitsbereich. |
| You do not have permission to perform this action. | Du hast keine Berechtigung für diese Aktion. |

Use these exact concepts consistently; never translate Brand as Workspace or mix Brand Workspace in primary copy.

## 41. Responsive UX

* **≥1440:** 240–280px expanded sidebar; both selectors visible; bounded menus with search/virtualization for many Brands.
* **1024–1439:** narrower sidebar; names ellipsize with accessible full text; selector popovers remain anchored.
* **768–1023:** icon rail; Workspace/Brand context opens one sheet; compact top bar remains one row where possible.
* **480–767:** bottom navigation plus context sheet; no sidebar cards; full-width selector/move dialogs.
* **320–479:** one column, 44px controls, initials, two-line bounded names, no horizontal scroll.
* **200% zoom:** narrow layout rules; sheets/dialogs scroll internally, focused controls stay visible, no sticky action hides content.

Long names truncate only visually. Selector panels search/paginate many Brands, preserve keyboard position, and never render inaccessible counts.

## 42. Accessibility

Use labelled button + listbox (or menu only for commands), `aria-expanded/controls`, selected/current state, active descendant or roving focus, Home/End/typeahead/Escape and deterministic focus restoration. Avatar alt is “{name} logo”; decorative duplicates hidden; initials expose full name. Announce switching/loading/success/access loss once via polite status; errors assert as appropriate. Confirm archive/delete/move with named destination/effect and focus trap. Targets ≥44px, visible AA focus/contrast, text status beyond color, reduced motion, forced-colors borders, logical DOM order and usable 200% zoom.

## 43. Analytics and diagnostics

Allowlist: `workspace_created`, `workspace_switched`, `brand_created`, `brand_switched`, `board_created`, `board_moved`, `workspace_membership_changed`, `workspace_migration_state`, `workspace_access_rejected`. Payload: pseudonymous IDs, role/action/result enum, source surface, locale, viewport bucket, migration version, latency/error class/request ID. Separate UI intent from accepted server mutation. Never log names, Brand/Board/Learning content, email, tokens, invitations, provider payloads or free text.

## 44. Existing test impact

| Class | Tests/areas |
|---|---|
| Reusable unchanged | auth signature, public-token hashing, snapshot/provenance/refresh, Canvas isolation, compact-bar exclusion, responsive/browser integrity, Content/Insights/Funnel safety. |
| Needs Workspace fixture | Brand catalog/create/edit/roles/deletion; Board catalog/create/access/share/delete; dashboard/Boards/avatar; AI context and exports. |
| Obsolete Brand-as-Workspace assumption | ephemeral/durable Brand selection, Workspace Brand shell/deletion, BW-36.4 projection and strings. Preserve their association/safety assertions while replacing terminology. |
| New RLS integration | cross-Workspace reads/writes/joins, composite association, revocation, service role, public serialization. |
| Migration fixtures | owned/shared/conflicting/ownerless Brands and Boards; branded, unbranded, snapshot-only, public, deleted; repeat/rollback/partial runs. |
| Browser acceptance | both Workspace types, selectors, deep links, access loss, responsive/a11y/locales/themes/zoom. |

Do not weaken current authorization, snapshot stability, public-token, deletion survival, browser-integrity or Canvas isolation assertions.

## 45. Implementation roadmap

| Phase | Likely areas | Deployment / rollback boundary | Acceptance gate / dependencies |
|---|---|---|---|
| 1 Additive schema/authorization | versioned migrations, models, RLS, access tests | nullable/additive only; old app ignores | two-tenant RLS suite; schema rollback is disable-only |
| 2 Idempotent migration/reads | backfill job, ledger, verification, serializers | bounded batches; deactivate mapping/forward repair | repeat-run no-op, counts/hashes/grants; Phase 1 |
| 3 APIs/client identity | Workspace routes/bootstrap, `app.js` state/storage/deep links | feature flag + legacy fallback | no stale/cross-account projection; Phases 1–2 |
| 4 selectors | sidebar/HTML/CSS/language/brand projection | cohort flag; revert whole target sidebar to BW-36.4 | single/multi/mobile/a11y acceptance; Phase 3 |
| 5 Home/Boards/creation | dashboard, library, create dialogs/routes | per-surface flags | required Brand, correct scopes/empty states |
| 6 Brand Profile redesign | Brand workspace/Profile modules | preserve JSON/routes and old editor fallback | BW-36.3 IA, round-trip and ACL |
| 7 Campaign Sync | comparison/snapshot route/UI | independent flag; old explicit refresh retained | direction/revision/backup/recovery |
| 8 Governed Learnings | new reviewed migration/API/RLS/Profile | creation/consumption separate flags | all start proposed; human-only approval |
| 9 Observation promotion/AI proposals | Board observations, bounded AI context | proposal source flags; no auto approval | provenance/privacy/no cross-tenant prompt |
| 10 Legacy cleanup | old keys/copy/adapters/nullable constraints | only after adoption/support window; restore tag/migration | production parity, rollback drill, zero unresolved mappings |

Every phase ships its migration/code/tests/docs together where applicable, has a cohort/flag or additive rollback, and never couples provider requests to navigation.

## 46. Acceptance criteria

1. One Workspace can contain ≥3 Brands and multiple Boards each; one-Brand Workspace uses identical rows/constraints.
2. Workspace switch closes active Board, prevents old content flash, and revalidates route; Brand switch only filters/navigates.
3. New Board transaction always returns matching non-null Workspace/Brand and snapshot provenance; injected cross-Workspace Brand fails at DB and service.
4. Role matrix passes for inherited and explicit grants; Board share grants no Profile edit; public token reads exactly one safe Board.
5. Every legacy Board is mapped to a Workspace, remains readable by equivalent users, and snapshot/unbranded state is unchanged.
6. Backfill rerun produces zero duplicate/semantic changes; rollback rehearsal restores old UI/access without data repair.
7. Sidebar order and one-authority selectors match section 15; Home/Boards/Brand Profile states match sections 17–19.
8. Snapshot never changes without explicit sync; Brand delete/archive cannot destroy Board snapshot.
9. All target widths, both themes/locales, forced colors/reduced motion, keyboard/screen reader and 200% zoom pass with ≥44px targets/no hidden focus.
10. Automated adversarial two-Workspace suite and diagnostic review show zero content, membership, count, avatar, AI context or Learning leakage.

## 47. Manual production acceptance

Use authorized synthetic tenants and record build/browser/OS, actor, IDs, expected/actual, network/console, screenshots and cleanup—never customer content.

1. New account: create single-Brand Workspace, cancel at each step, finish first Board; verify atomicity/localization.
2. Existing single-Brand owner: verify mapped Workspace, Profile, all Boards/shares/snapshots and collapsed selector.
3. Agency owner: verify multiple Brands, All Brands, create per Brand, cross-Brand activity and no selector-driven reassignment.
4. Shared Brand member: repeat viewer/editor/admin actions; verify inherited Boards and no Workspace escalation.
5. Shared Board-only collaborator: verify only Board/safe snapshot is visible, no Profile/siblings/members.
6. Exercise viewer, editor and Workspace admin against every matrix action and direct API tampering.
7. Public token in signed-out/incognito: view one Board; try Workspace/Brand/list/write endpoints and altered/revoked token.
8. Open unbranded legacy, snapshot-only legacy and associated Brand Board; verify labels, recovery and unchanged snapshot hashes.
9. Switch Workspaces with a clean Board, dirty Board, deleted Workspace and revoked membership; verify deterministic close/block/fallback.
10. Change same-Workspace Board Brand with conflict; duplicate Board; confirm snapshots, shares, content, audit and rollback.
11. Test >80-character Workspace/Brand names, many Brands, missing/broken avatars and empty/error/loading states.
12. Repeat core flows English/German; light/dark/forced colors/reduced motion; keyboard and screen reader.
13. Repeat at 1440, 1024, 768, 480, 375 and 320 CSS px, live resizing and 200% zoom; verify no duplicate selectors, overlap, clipping or focus loss.
14. Inspect requests/logs/analytics: no content/email/token/provider payload and no provider/AI call caused by switching/rendering.

## 48. Unresolved questions

Only external-evidence questions remain:

* **Production data:** aggregate counts, owner conflicts, unowned/inaccessible/deleted rows, public links, shared-access graph, snapshot-only/unbranded prevalence and unmanaged Workspace-like tables.
* **Deployed security:** exact production schema, grants, RLS/function/service-role parity and whether runtime DDL ownership permits safe migrations.
* **Product:** whether ordinary Workspace members may create Brands by default; whether Brand viewers may propose Learnings; naming of generated personal Workspace; whether visible Content Workspace becomes Content Studio.
* **Legal/retention:** archive/purge periods, audit actor retention, invitation/email handling, exports/backups and right-to-erasure interaction.
* **Authenticated browser:** actual BW-36.4/sidebar/top-bar behavior with real roles, access loss, deep links, long-lived tabs, screen readers, forced colors, zoom and production breakpoints.

## 49. Final recommendation

Implement the approved `Account/User → Workspace → Brands → Boards` hierarchy without substituting Brand for Workspace. Add durable `workspaces` and `workspace_memberships`; add non-null `workspace_id` to Brand and Board after verified backfill; retain normally non-null Board `brand_id`; enforce same-Workspace association with composite constraints, RLS and same-transaction server checks. Use simple additive Workspace inheritance with scoped Brand/Board grants and no explicit deny; public tokens remain one-Board read-only exceptions.

Replace—not extend—BW-36.4 with Tendra One identity, Workspace selector, Brand context, navigation and account areas. Keep Canvas toolbar isolation and the bounded compact context bar. Brand Profile remains Brand-owned reusable knowledge; Board association is campaign truth; Campaign Brand Snapshot remains stable and explicitly synchronized; Brand Learnings remain Brand-scoped and human-approved.

Choose Option C: generate deterministic personal Workspaces per primary owner, quarantine ambiguity, preserve every grant/relationship/snapshot/public token, and allow later explicit regrouping. Never infer grouping from browser preference. Roll out expand/backfill/verify/dual-read/API/UI/write-cutover/fallback/contract, retaining legacy relations until production adoption and rollback drills succeed. No destructive cleanup, cross-Workspace movement, Workspace-wide Learnings, or AI auto-approval belongs in the first release.

**Audit conclusion:** the repository verifies that a real Workspace tenant does not currently exist and cannot be recovered by relabeling Brand or local state. A formal additive schema, authorization boundary, backfill and staged UI replacement are required. This audit applies no code, schema, migration, data, API, test, workflow, dependency, provider, AI, Board, Brand, approval, publication, schedule, or social-media change.
