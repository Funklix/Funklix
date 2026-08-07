# Brand Workspace Current-State Audit

| Field | Audited value |
|---|---|
| Audit date | 2026-08-07 |
| Repository baseline | `main` at `3c489adfe08685dedfd38fc3143342900001a43d` |
| Primary objective | **Brand Workspace vollständig fertigstellen** |
| Scope | Repository, documentation, tests, CI, database bootstrap code, and locally available Git/GitHub history |
| Change type | Documentation only |
| Runtime/database changes | None |

## Evidence labels used in this audit

- **Verified fact** — directly established by the audited tree, an executable check, or local Git history.
- **Incomplete** — code or UI exists, but the end-to-end product behavior is not connected or production-proven.
- **Inferred requirement** — follows from the established architecture/roadmap but is not an implemented contract.
- **Open decision** — product, security, migration, or operations policy that cannot be settled from this repository alone.

---

## 1. Executive Summary

Funklix has **two materially different Brand systems** on audited `main`:

1. A mature, working **Board-level Brand Core snapshot editor** embedded in the monolithic browser runtime. It stores strategic knowledge in board-scoped local storage and in `boards.brand_core_snapshot`, and downstream Canvas/AI flows consume that in-memory snapshot.
2. A server-only **Canonical Brand foundation**: owner-scoped PostgreSQL records, list/create/get/update APIs, optimistic revisions, and an optional nullable `boards.brand_id` association. This foundation is not loaded by `app.js`, has no active Brand controller, and has no usable Brand selection or creation UI.

The passive Workspace/Brand shell accurately exposes the present compatibility state: **“No Brand selected,” while Boards remain available**. Existing unbranded Boards remain supported. The sidebar and Board Brand Core copy deliberately avoid pretending that a Canonical Brand is active or that Board edits update one.

The current target architecture remains `Workspace → Brand → Board → Campaign Canvas → Nodes → Assets`, but only the Board/Canvas portion is authoritative at runtime. `state.session.workspaceId` and `state.session.brandId` remain `null`; Board loading merely observes `brand_id` for diagnostics. There is no canonical Workspace record, membership model, active Brand persistence/resolution, Brand-filtered Board list, or Brand-owned navigation context.

The server foundation is promising but not production-ready as a complete Brand Workspace. Schema changes occur lazily in request handlers through application-role DDL; the repository contains no Supabase migration directory, declarative migration, RLS policy, role/grant definition, or live PostgreSQL integration test. Canonical Brand authorization is email-owner-only and intentionally does not inherit Board-editor access. Board PUT preserves the existing association but still accepts and writes client-supplied Board snapshots, so a linked Board snapshot can diverge from Canonical Brand Core immediately after creation.

**Audit conclusion:** the Brand Workspace is **partial**. Board Brand Core and legacy Board compatibility are established; Canonical Brand server primitives are implemented but dormant; Workspace identity, active Brand, usable selection/creation, Brand-scoped navigation, canonical editing, and an explicit snapshot synchronization policy remain unfinished.

**Exactly one next package is recommended:** **BW-1 — Read-only Canonical Brand catalog in the switcher, with an explicit no-selection state.** It is the smallest safe vertical slice: connect authenticated `GET /api/brands` to the existing passive shell, display owned Brand summaries, preserve “No Brand selected,” and introduce no active Brand authority, Board filtering, creation, or writes.

---

## 2. Audited Repository State

### 2.1 Baseline and audit method

**Verified fact.** The audited checkout was branch `work` at `3c489ad`, whose subject is `Merge pull request #551 from Funklix/codex/audit-funklix-brand/workspace-rollout-steps`. It is the locally available tip representing `main`; the checkout contains no configured Git remote. The pre-existing untracked `node_modules/` directory was excluded from the audit change.

The audit reviewed:

- current application and API sources (`app.js`, `index.html`, `api/`);
- canonical architecture, constitution, roadmap, and earlier audits under `docs/`;
- executable contract scripts under `scripts/`;
- the only GitHub Actions workflow;
- full local history relevant to Workspace, Brand, Boards, Brand Core, and startup/autosave;
- merge commits and patch history for PRs #546–#551, including the reverted PR #548;
- static searches for Supabase, migrations, SQL roles, privileges, and RLS;
- syntax and repository-provided checks listed in §14 and §19.

### 2.2 Relevant recent GitHub history

| PR / commit | Verified effect on current state |
|---|---|
| PR #546 / `ee5fef1` (`feat: add canonical brand server foundation`) | Introduced the Canonical Brand server storage/API foundation. |
| PR #547 / `a4871d8` (`fix: harden canonical brand server foundation`) | Hardened validation, authorization, conflicts, and contract coverage. |
| PR #548 / `3ff1a8f` (`feat: add canonical brand client foundation`) | Attempted client/controller and Board→Brand wiring. |
| PR #549 / `8157b23`, `21fd4d2` | Reverted PR #548; the Canonical Brand client is absent from current `main`. |
| PR #550 / `e7e0f19` (`feat: add passive workspace brand hierarchy`) | Clarified passive Workspace/Boards hierarchy and Board-scoped Brand Core UX without runtime Brand authority. |
| PR #551 / `022b616` (`fix: decouple board and brand initialization`) | Made Board and Brand lazy schema initialization independent and retryable; retained optional relationship reconciliation. |

**Important history finding.** Client activation was not merely never attempted; it was merged and deliberately reverted. Any new client integration must avoid silently restoring the full reverted design. The safe approach is incremental, read-only first, with explicit contracts.

### 2.3 Scope confirmation

This audit adds only this Markdown file. It does not alter application code, tests, CI, authentication, APIs, database bootstrap behavior, SQL schema, migrations, RLS, roles, privileges, or deployment configuration.

---

## 3. Existing Brand Workspace Implementation

### 3.1 Capability status matrix

| Capability | State | Evidence-based assessment |
|---|---|---|
| Workspace visual hierarchy | **Partial** | Sidebar labels Workspace and Boards, but no Workspace entity/API/session exists. |
| “No Brand selected” | **Complete compatibility state** | Explicit sidebar state; contract check guarantees Boards remain available. |
| Board library and Board routing | **Implemented** | Authenticated list/create and `/boards/:id` load/update paths exist. |
| Campaign Canvas | **Implemented, Board-centered** | Canvas state serializes into `boards.canvas_json`; autosave is update-only when no Board ID. |
| Board Brand Core | **Implemented** | Rich editor, local board key, Board snapshot load/save, Brand DNA/assets/modules. |
| Canonical Brand table/API | **Implemented server foundation** | Lazy table bootstrap and authenticated CRUD subset (GET/POST collection; GET/PUT item). |
| Canonical Brand deletion/archive | **Missing** | No DELETE route or archived state. |
| Brand selection/switching | **Missing** | Static `<details>` shell only; no API consumption. |
| Brand creation UX | **Missing** | Button is disabled; POST API is dormant from the browser. |
| Active Brand context | **Missing** | `session.brandId` intentionally null; payload `brand_id` is passive diagnostics only. |
| Brand-scoped Board listing | **Missing** | Board list is user/editor/unowned scoped, not Brand filtered. |
| Create Board from active Brand | **Server-only partial** | POST supports `brand_id` and canonical snapshot copy, but current browser create/copy flows omit it. |
| Canonical Brand Core editor | **Missing** | Current editor is explicitly a Board snapshot editor. |
| Snapshot sync/rebase | **Missing / undecided** | No publish, pull, refresh, provenance, or conflict policy. |
| Workspace membership/roles | **Missing** | Ownership remains email/user/Board editor based. |
| Supabase/RLS/migrations | **Missing** | No declarative artifacts in repository. |

### 3.2 What currently works

- Signed-in users can list Boards they own, edit, or may claim when legacy-unowned.
- Users can explicitly create Boards without selecting a Brand.
- Existing unbranded Boards load with `brand_id: null` and retain their Board Brand Core snapshot.
- Board edits/autosave update Canvas plus the Board snapshot; autosave does not create a Board when no existing Board ID is resolved.
- Owners can create/list/read/update Canonical Brands through direct authenticated APIs.
- Creating a Board through the API with an owned `brand_id` copies server-authoritative canonical `brand_core` into the new Board snapshot.
- A Board linked to a Brand exposes `brand_id` to Board readers but does not expose canonical private Brand Core through that link.
- Brand optimistic concurrency uses a numeric `revision`; stale updates return `409`.
- Canonical Brand authorization returns `404` for a non-owner, reducing record enumeration through item APIs.

### 3.3 Dormant versus absent

The distinction matters:

- **Dormant:** Canonical Brand APIs, database record, revision contract, and create-from-Brand Board server path exist but have no browser consumer.
- **Partial:** the nullable Board association exists, is returned in payloads, and is passively diagnosed, but is not active product context.
- **Absent:** Workspace persistence, membership, Brand selector/controller, active Brand persistence, canonical editor, Brand-scoped Board queries, migration/RLS artifacts, archive/delete, and synchronization workflow.

---

## 4. Current User Experience

### 4.1 No-Brand entry state

**Verified fact.** The sidebar labels the containing scope “Workspace,” shows “No Brand selected,” says “Boards remain available in this Workspace,” and disables “Create Brand coming soon.” The Brand shell uses native disclosure only; it does not read or write Brand state.

This is not an error state. It is the currently supported compatibility mode:

```text
Workspace (visual/passive)
└── No active Brand
    └── Boards remain listable/creatable/openable
        ├── Campaign Canvas
        └── Board Brand Core snapshot
```

### 4.2 Brand-related user actions

- **Select/switch Brand:** unavailable.
- **Create Brand:** unavailable in UI, despite the server POST endpoint.
- **Edit Canonical Brand:** unavailable in UI.
- **Edit Board Brand Core:** available and substantial.
- **Create Board from Brand:** unavailable in current UI; generic Board creation does not send `brand_id`.
- **See Brand on a Board:** Board list can derive display name/avatar from the stored snapshot, but that is display metadata, not active Canonical Brand identity.

### 4.3 Compatibility assessment

**Verified fact.** “No Brand selected” and unbranded Boards remain supported by code and checks. The server column is nullable, generic create/copy/save-as-new paths preserve supplied snapshots without a Brand, and the shell contract explicitly tests this behavior.

**Inferred requirement.** Completion must preserve this state until an explicit migration/deprecation decision is made. Forcing Brand selection now would contradict current UI copy, nullable schema, contract tests, and legacy Board access.

---

## 5. Workspace and Navigation

### 5.1 Established architecture

The canonical product document defines:

```text
Workspace
↓
Brand
↓
Dashboard / Brand Core / AI Brain / Insights / Boards / Content Workspace / Simulation
↓
Campaign Canvas
↓
Nodes
↓
Assets
```

Workspace owns administration; Brand owns marketing intelligence; Board owns campaign work; Canvas owns visual campaign structure.

### 5.2 Current runtime reality

**Incomplete.** The navigation communicates hierarchy but does not enforce it. `workspaceId` is a null placeholder. Home, Boards, Campaign Canvas, Content Workspace, Board Brand Core, AI Brain, and Insights are still top-level browser views controlled by the monolithic `app.js`; they are not resolved beneath a durable Workspace/Brand URL.

Current Board URLs (`/boards/:id`) can open a Board without first resolving an active Workspace or Brand. This remains compatible with the architecture only as a future shorthand where Board lookup eventually resolves ownership.

### 5.3 Unresolved Workspace decisions

- What is the durable Workspace entity and identifier?
- Is the current single-owner account implicitly one Workspace during transition?
- How is last active Brand stored: URL, server preference, browser storage, or a combination?
- Which surfaces remain usable with no active Brand?
- When do Workspace membership and Brand roles replace email-owner fallback?

These are open decisions; this audit does not invent answers.

---

## 6. Canonical Brands

### 6.1 Implemented server model

`brands` currently contains:

```text
id UUID
owner_email TEXT
name TEXT
brand_core JSONB
revision BIGINT
created_at TIMESTAMPTZ
updated_at TIMESTAMPTZ
```

It validates lower-case owner email, trimmed name length 1–160, object-shaped JSON, and revision ≥1. The collection returns summaries without `brand_core`; item GET returns the full canonical value. POST derives owner identity from the signed session rather than the body. PUT updates name/Core only when the submitted revision matches and increments once.

### 6.2 Security boundary

Canonical Brand access is owner-email-only. Board editor access does not imply Brand access; knowing a Brand UUID does not grant item access. The API intentionally answers non-owner item reads/writes with `404`.

### 6.3 What it does not yet model

- Workspace ownership (`workspace_id`);
- stable owner/user ID separate from mutable email;
- Brand members, roles, grants, or invitations;
- archive/delete/restore;
- slug, description, icon/avatar/color metadata;
- audit trail or revision history;
- canonical module/source records separate from one JSON document;
- Workspace transfer or Brand transfer;
- RLS or database-enforced tenant isolation.

### 6.4 Canonical status conclusion

Canonical Brands are **real server records but a dormant product capability**. Calling them “complete” would be incorrect because no shipped browser flow can discover, select, create, or edit them, and their deployment/security schema is not declaratively managed.

---

## 7. Brand Selection and Creation

### 7.1 Selection

**Missing.** `app.js` contains no `/api/brands` request. The shell has no active Brand ID attribute or controller. PR #548’s client foundation was reverted by PR #549, and the current contract check explicitly asserts that no Canonical Brand client is loaded.

Selection will require, at minimum:

- loading only Brands the API says the user owns/can access;
- explicit loading, empty, unauthenticated, and failure states;
- a distinct “No Brand selected” option;
- active selection state whose authority is clearly defined;
- stale/deleted/inaccessible selection recovery;
- keyboard and screen-reader behavior;
- no implicit Board reassignment or snapshot overwrite.

### 7.2 Creation

**Server partial, UI missing.** `POST /api/brands` accepts `name` and object `brand_core`; the disabled UI does not call it. There is no creation dialog, validation UX, duplicate-name decision, initial Core template contract, post-create selection rule, retry behavior, or production telemetry.

### 7.3 Explicit compatibility rule

Selection and creation must not automatically:

- attach existing Boards;
- rewrite Board snapshots;
- infer a Brand from snapshot content/name/avatar;
- make unbranded Boards inaccessible;
- grant Brand access to Board collaborators;
- treat a locally remembered Brand ID as authorization.

---

## 8. Active Brand Context

### 8.1 Current state

**Verified fact.** No active Brand context exists. `state.session.brandId` is initialized to `null` with an explicit comment that Active Brand is not implemented. `getActiveContext()` returns that null value. A Board payload’s `brand_id` is read only into passive Brand-session diagnostics; it does not set `state.session.brandId`.

`workspaceId` is also null. Board ID is the only meaningful current ownership/session identifier and is resolved from runtime/path state.

### 8.2 Why Board `brand_id` is not active context

A linked Board proves an association for that Board; it does not by itself define the user’s active Brand across Dashboard, Boards, Brand Core, AI Brain, Insights, or a new Board. Shared Board readers may not have Canonical Brand permission. Therefore silently promoting Board `brand_id` into active Brand would cross the existing authorization boundary.

### 8.3 Required future invariant (inferred)

An active Brand resolver should eventually expose a verified, accessible Brand and its Workspace, but the no-Brand mode must remain explicit during migration. Active context must be resolved only from an authorized server response or a server-validated URL/session hint, never from Brand Core content or a Board snapshot.

---

## 9. Boards and Brand Association

### 9.1 Current association

`boards.brand_id` is nullable and indexed. When both tables exist, lazy reconciliation adds a foreign key to `brands(id)` with `ON DELETE SET NULL`. Generic create paths omit the association. Board PUT and PATCH cannot change it. Board list and item payloads return it.

### 9.2 Create-from-Brand behavior

When `POST /api/boards` receives `brand_id`:

1. the server validates UUID shape;
2. loads that Brand through owner-only authorization;
3. ignores any forged client snapshot in favor of the canonical server `brand_core`;
4. inserts both `brand_id` and the copied snapshot.

This is a good server-authoritative boundary for creation, but no current application flow uses it.

### 9.3 Existing Board preservation

Existing Boards are not backfilled. Their `brand_id` stays null. Generic copy/save-as-new creates an unbranded Board and carries its supplied snapshot. Linked Board PUT preserves the relationship because it does not accept `brand_id` as a mutable field.

### 9.4 Gaps

- no Board filtering by Brand;
- no attach/detach/reassign API or UX;
- no permission model for a Board whose owner differs from Brand owner;
- no rule for duplicate/save-as-new from a linked Board;
- no archive/delete lifecycle despite `ON DELETE SET NULL`;
- no endpoint that proves Board→Brand→Workspace ownership in one transaction;
- no indication whether linked shared Boards should reveal Brand identity metadata to collaborators.

---

## 10. Brand Core Architecture

### 10.1 Board-level Core today

The rich Brand Workspace/editor in `app.js` is now accurately named **Board Brand Core**. It supports the core narrative, messaging, tone, guidelines, assets, personas, keywords, Brand DNA/archetype/avatar, custom/typed knowledge modules, Founder Story, website imports, research, and readiness cues.

Persistence is Board-scoped:

- in memory: `state.brandCore`;
- local storage: key `brandBrainState:<boardId>` (or transitional local scope);
- server Board: `brand_core_snapshot` saved beside `canvas_json`;
- load: Board snapshot hydrates `state.brandCore`, then updates local storage without marking dirty.

### 10.2 Canonical Core today

Canonical `brands.brand_core` is a JSON object available through Brand item APIs. It has optimistic revision control, but no UI/editor consumer and no separate module-level concurrency.

### 10.3 Snapshot relationship

**Verified current rule:** Canonical Core is copied into `brand_core_snapshot` only during server-side Board creation with `brand_id`. Thereafter the snapshot is independent:

- Board saves can update the snapshot without updating Canonical Core;
- Canonical Brand PUT can update Core without refreshing existing Boards;
- no version/revision/provenance is stored on the Board snapshot;
- no comparison, drift indicator, pull, publish, rebase, or conflict workflow exists.

This makes “snapshot” accurate: it is campaign-specific state, not a live alias.

### 10.4 Open product decision: authority and synchronization

The repository does not settle whether Board changes should be:

1. always local and never publishable;
2. explicitly publishable to Canonical Core by authorized Brand roles;
3. split into canonical inherited fields and Board overrides; or
4. periodically refreshable from canonical with a reviewable merge.

That decision must precede canonical editing/synchronization implementation. Automatic two-way synchronization would risk destructive overwrites and leakage across campaigns.

---

## 11. Campaign Canvas Safety

### 11.1 Current ownership and persistence

Canvas is stored in `boards.canvas_json`. Board load hydrates Canvas and the Board Brand Core snapshot together. Board ID controls update routing, conflict checking, collaboration/presence, and document scoping.

### 11.2 Existing safety improvements

- Root startup was guarded from blindly restoring an editable local Canvas.
- Autosave is explicitly skipped when no existing Board ID exists; creation remains an explicit flow.
- Board updates use a last-known timestamp conflict check.
- A Board linked to a Brand cannot have `brand_id` mutated via normal PUT.

### 11.3 Remaining safety risks

- Manual/non-autosave save logic still retains a POST fallback when no Board ID; callers must remain carefully bounded.
- Canvas/AI generation reads current Board Brand Core, not Canonical Active Brand context.
- Changing active Brand while a dirty Board is open has no defined save/discard/navigation interlock because active Brand switching does not exist.
- Filtering Boards before preserving a directly linked active Board could make current work appear lost.
- A future “refresh from Brand” could alter generation context mid-campaign unless revision/provenance and explicit confirmation are designed.

**Safety invariant for all packages:** do not couple Brand selection to Canvas mutation, Board reassignment, autosave endpoint selection, or snapshot replacement until separately specified and tested.

---

## 12. Ownership and Authorization

### 12.1 Current boundaries

| Object | Current authority |
|---|---|
| Session | HMAC-signed HttpOnly cookie; user object embedded for 14 days. |
| Canonical Brand | Exact normalized `owner_email`; no collaborators. |
| Board | Owner by email or user ID; explicit email editors; legacy unowned claim path. |
| Board rename/delete/permissions | Owner only. |
| Board content edit | Owner, editor, or signed-in claimant of an unowned Board. |
| Shared Board read | Non-owner/anonymous behavior is allowed by current access helper for known IDs; access response differentiates roles. |
| Workspace | No persisted object or authorization layer. |

### 12.2 Architectural inconsistency

Brand and Board ownership are separate and can diverge. The Brand uses only email ownership; Boards use email or user ID plus editors. A Board editor can read a linked `brand_id` and Board snapshot but cannot read Canonical Core. This is deliberately tested and safer than implicit access, but there is no future Brand-role bridge.

### 12.3 Risks

- Email is mutable and may be recycled; it is a weak long-term tenant key.
- Application-only predicates are the sole Canonical Brand isolation boundary; no RLS defense-in-depth exists.
- Session verification compares HMAC strings with ordinary equality rather than a timing-safe primitive.
- The session cookie carries the user object until expiry; role/identity changes have no repository-visible server revocation mechanism.
- Anonymous users with a Board UUID receive a Board response under the present `anonymous_shared` role. Whether that is intended public-link behavior is an unresolved security/product decision.
- Legacy unowned Boards are visible to signed-in list queries and claimable; migration/retirement policy is unresolved.
- Canonical Brand endpoints have no workspace membership, Brand editor/viewer, administrative override, or audit log.

These observations do not change authentication in this documentation-only audit.

---

## 13. Database and Supabase Readiness

### 13.1 What exists

- Direct `pg.Pool` connection through `POSTGRES_URL`.
- Runtime `CREATE TABLE IF NOT EXISTS`, additive `ALTER TABLE`, and index creation.
- Retryable, cached lazy initialization for Boards and Brands.
- Order-independent optional foreign-key reconciliation after PR #551.
- JSON shape/name/revision checks and optimistic Brand revision.
- Board foreign-key intent with `ON DELETE SET NULL`.

### 13.2 What is absent

Repository search found no:

- `supabase/` directory or Supabase CLI configuration;
- versioned SQL migration for Brands/Board association;
- schema baseline or rollback migration;
- PostgreSQL role definitions;
- `GRANT`/`REVOKE` privilege contract;
- `ENABLE ROW LEVEL SECURITY` or RLS policies;
- Supabase Auth integration;
- database integration-test service/workflow;
- production schema verification script.

### 13.3 Readiness conclusion

**Partial, not production-proven.** The application can bootstrap schema if its PostgreSQL role has DDL rights, but that is not equivalent to migration readiness. Production deployments may use a restricted runtime role that cannot create/alter tables; concurrent cold starts and partially applied DDL are operational concerns; schema state is not reviewable independently of request traffic.

The code does not reveal the actual production PostgreSQL role, existing Supabase policies, or deployed schema. Therefore:

- **Verified repository fact:** no declarative Supabase/RLS/role readiness exists here.
- **Open operational decision:** whether production uses Supabase, which role `POSTGRES_URL` represents, and whether out-of-repository migrations/policies already exist.
- **Required production verification:** inspect deployed schema, constraint/index state, role grants, RLS state, and backups without applying changes.

---

## 14. Tests and CI Coverage

### 14.1 Existing relevant automated checks

`scripts/check-canonical-brand-foundation.js` provides mocked/contract coverage for:

- auth and validation;
- owner isolation and response redaction;
- optimistic revision conflict;
- sanitized server errors;
- server-authoritative create-from-Brand snapshot;
- unbranded generic create compatibility;
- linked/legacy/shared Board reads;
- immutable Board association on PUT;
- nullable/no-backfill schema source contracts;
- schema initialization retry/idempotence/order/failure isolation.

`scripts/check-workspace-brand-shell.js` covers passive hierarchy labels, no-Brand Board availability, Board Core labeling, preserved DOM IDs, absence of a Brand client, script boot ordering, and absence of active Brand data attributes.

Broader scripts cover browser syntax/integrity, startup safety, Brand button consistency, knowledge modules, guided Brand foundation, document security, and campaign context.

### 14.2 CI reality

The sole workflow, **Runtime Boot Safety**, runs syntax checks plus only:

- `check-browser-script-integrity.js`;
- `check-knowledge-module-browser-globals.js`.

It does **not** run the Canonical Brand foundation check or Workspace shell check. There is no package test script, test framework configuration, coverage threshold, browser E2E suite, PostgreSQL service, migration validation, security scanner, or deployment smoke test in CI.

### 14.3 Coverage gaps

- no live PostgreSQL test of DDL, FK, JSON constraints, transactions, or concurrency;
- no browser test for Brand UI (currently none exists);
- no test of production auth/session integration;
- no RLS/role test;
- no active Brand resolver test with authorized/unauthorized/deleted Brands;
- no Brand-filtered Board tests;
- no snapshot drift/sync tests;
- no test proving navigation preserves dirty Canvas during Brand changes;
- no test of anonymous Board-link policy;
- current mock query matcher cannot validate all PostgreSQL semantics.

---

## 15. Risks and Open Decisions

### 15.1 Critical risks

1. **Dual Brand truth without a synchronization contract.** Canonical Core and Board snapshots can diverge silently.
2. **Dormant server APIs may be mistaken for shipped functionality.** No user can access them through the current client.
3. **Runtime DDL and absent migrations/RLS.** Deployment privileges and defense-in-depth are unverified.
4. **Association is not context.** Treating `boards.brand_id` as active Brand could grant context the user cannot access.
5. **Compatibility regression risk.** Forcing Brands would break the explicitly preserved no-Brand/unbranded Board workflow.
6. **Ownership mismatch.** Email-owner Canonical Brands and richer Board sharing do not compose into Workspace roles.
7. **Revert history.** Reintroducing PR #548 wholesale would bypass the reasoned incremental reset represented by PRs #549–#551.

### 15.2 Architectural inconsistencies

- Architecture says every Board belongs to exactly one Brand; current compatibility schema intentionally permits null.
- Architecture says no editable Canvas without active Brand and Board; runtime intentionally permits Board-without-Brand.
- Architecture says Brand owns Board list; current list is account/editor/unowned scoped.
- “Brand Workspace” historically named the Board Core editor; current copy corrects that, while no Canonical Brand Workspace UI exists.
- Canonical Brands have revision concurrency; Boards use timestamp concurrency; their snapshots store neither canonical Brand revision nor copy timestamp.

These are migration-stage inconsistencies, not reasons to discard the established architecture.

### 15.3 Unresolved product/security decisions

1. Can users indefinitely choose “No Brand selected,” or only during legacy migration?
2. What does selecting a Brand change before Board filtering ships?
3. Is a newly created Brand auto-selected?
4. How are existing Boards attached, and who may attach them?
5. Does duplicate/save-as-new preserve Brand association?
6. Are Board snapshots immutable campaign baselines, editable overrides, or publishable drafts?
7. Who may publish a Board snapshot into Canonical Core?
8. Can Board collaborators see Brand name/avatar, Canonical Core, or neither?
9. Is anonymous Board-by-link access intentional?
10. What is the transitional Workspace/role model?
11. What is the archive/delete behavior for Brands with Boards?
12. Which production database role and RLS posture are required?

---

## 16. Remaining Brand Workspace Packages

The packages below break down **only** the remaining work for **Brand Workspace vollständig fertigstellen**. They do not replace or reorder the broader product roadmap. Each is intended to be independently reviewable and mergeable.

### BW-1 — Read-only Canonical Brand catalog in the switcher

- **Objective:** expose the already-authorized Brand summaries without establishing active Brand authority.
- **Current evidence:** `GET /api/brands` exists; current shell is static; current check asserts no client request.
- **Dependencies:** existing session and Brand collection API; a narrow client request/helper; loading/error/empty design.
- **Included:** fetch owned summaries; render in shell; preserve a visible “No Brand selected” row; retry; accessible list; safe response validation; contract tests.
- **Explicit exclusions:** selecting/persisting a Brand, creation, item Core fetch, Board filtering/association, navigation changes, Canvas/save changes.
- **Safety risks:** XSS from names, unauthorized cache bleed, UI implying selection works, boot failure if API is unavailable.
- **Required tests:** auth/empty/list/error/malformed response; escaped names; app still boots when request fails; no selection side effects; no-Brand Boards remain available.
- **Production verification:** signed-in owner sees only summaries; signed-out/failure leaves shell usable; no Brand Core appears in list response; Board/Canvas behavior unchanged.
- **Recommended order:** **1**.

### BW-2 — Explicit ephemeral Brand selection context

- **Objective:** allow a catalog Brand to become an in-memory active context without yet scoping persistence consumers.
- **Current evidence:** session placeholders and passive resolver exist; selection is absent.
- **Dependencies:** BW-1; documented resolution rules; server validation via Brand item/summary access.
- **Included:** select and clear; active shell display; authorized resolution; stale/deleted recovery; diagnostics; navigation-safe in-memory state.
- **Explicit exclusions:** cross-reload persistence, Board filtering, Canvas mutation, Board association, canonical editing.
- **Safety risks:** confusing “active” with authoritative persistence; dirty Board context changes; unauthorized remembered IDs.
- **Required tests:** select/clear; 401/404 recovery; rapid selection race; dirty Board remains untouched; linked Board does not auto-select; no-Brand fallback.
- **Production verification:** select/clear across views; verify no API write and no Board/Canvas change.
- **Recommended order:** **2**.

### BW-3 — Canonical Brand creation UI

- **Objective:** make the existing owner-scoped POST capability safely usable.
- **Current evidence:** POST validates name/Core and ignores forged ownership; UI button is disabled.
- **Dependencies:** BW-1/BW-2; decision on initial Core template and auto-selection.
- **Included:** accessible create dialog; name validation; initial object; request lifecycle; conflict/error messaging; catalog refresh; explicitly decided post-create selection.
- **Explicit exclusions:** onboarding wizard, domain analysis, Board creation, existing Board attachment, invitations, delete/archive.
- **Safety risks:** duplicate submissions, misleading success after refresh failure, unbounded records, weak empty template.
- **Required tests:** validation, double-submit guard, 401/400/500, escaped rendering, successful refresh, no Board created/attached.
- **Production verification:** create owner Brand; verify response ownership and catalog; verify no Board/database behavior beyond Brand insert.
- **Recommended order:** **3**.

### BW-4 — Durable active Brand recovery

- **Objective:** recover an authorized active Brand across reload/navigation while preserving explicit no-Brand mode.
- **Current evidence:** only null in-memory placeholders; URLs are Board-centric.
- **Dependencies:** BW-2; decision on URL versus preference/browser storage; stale-access behavior.
- **Included:** persistence hint, server revalidation, clear/no-selection persistence, deterministic boot order, diagnostics.
- **Explicit exclusions:** Workspace URLs, Board filtering, auto-attachment, Canvas mutation.
- **Safety risks:** cross-account browser leakage, boot races, stale/deleted selection, back-button inconsistency.
- **Required tests:** reload, logout/account change, invalid/stale ID, API outage, direct Board URL, no-Brand persistence.
- **Production verification:** reload/select/clear/logout scenarios in clean and existing browser storage.
- **Recommended order:** **4**.

### BW-5 — Brand-scoped Board catalog with legacy lane

- **Objective:** show Boards for the active Brand without hiding unbranded legacy work.
- **Current evidence:** Board GET returns all accessible Boards and `brand_id`; no server filter exists.
- **Dependencies:** durable active Brand; explicit UX decision for unbranded Boards; authorization-preserving query design.
- **Included:** server-side authorized filter or clearly bounded client transition; “Unbranded Boards” lane; empty/loading/error states; direct active-Board preservation.
- **Explicit exclusions:** attaching/reassigning Boards; snapshot synchronization; mandatory Brand.
- **Safety risks:** apparent data loss, client-only overfetch, editor-visible association metadata, active Board disappearing.
- **Required tests:** owner/editor/unowned combinations; active Brand/no Brand; direct links; pagination/order; unauthorized Brand filter; zero results.
- **Production verification:** reconcile counts against existing list; verify every legacy Board remains reachable.
- **Recommended order:** **5**.

### BW-6 — Create Board from active Brand

- **Objective:** activate the existing server-authoritative Brand→Board creation path.
- **Current evidence:** POST supports authorized `brand_id`; browser generic creation omits it.
- **Dependencies:** BW-4/BW-5; decision whether no-Brand creation remains default/option.
- **Included:** explicit create-under-Brand action; send active `brand_id`; hydrate returned snapshot; correct routing; clear visual association.
- **Explicit exclusions:** attaching old Boards, live synchronization, copying linked Boards, canonical Core editing.
- **Safety risks:** wrong/racing active ID, duplicate Boards, snapshot mismatch, partial navigation after failure.
- **Required tests:** authorized/unauthorized/deleted Brand; server snapshot wins; rapid Brand switch; POST failure; no-Brand create compatibility.
- **Production verification:** create linked and unbranded Boards; inspect IDs/snapshots; edit/reload both.
- **Recommended order:** **6**.

### BW-7 — Existing Board attachment workflow

- **Objective:** explicitly associate an eligible unbranded Board with one Canonical Brand.
- **Current evidence:** no mutation endpoint; `brand_id` intentionally immutable today.
- **Dependencies:** association authorization decision; snapshot migration decision; audit/rollback design.
- **Included:** owner-only (or decided role) attach endpoint/UI; transactional checks; preview; explicit snapshot choice; idempotence; audit information.
- **Explicit exclusions:** silent backfill, bulk migration, automatic name inference, arbitrary reassignment, collaborator-granted Brand access.
- **Safety risks:** destructive snapshot replacement, cross-owner linkage, leaked canonical knowledge, irreversible misattachment.
- **Required tests:** owner/editor/anonymous; mismatched ownership; concurrency; idempotence; rollback/failure atomicity; existing snapshot preservation choices.
- **Production verification:** attach a test legacy Board with backup; verify access, snapshot, direct link, and rollback path.
- **Recommended order:** **7**.

### BW-8 — Canonical Brand Workspace read/edit surface

- **Objective:** provide a clearly separate editor for Canonical Brand Core.
- **Current evidence:** Brand item GET/PUT/revision exist; current editor is Board-only.
- **Dependencies:** active Brand; creation; canonical-versus-snapshot UX; module compatibility audit.
- **Included:** load canonical Core; edit/save with revision; 409 recovery; explicit Canonical labeling; unsaved-change guard; permission/read-only states.
- **Explicit exclusions:** automatic Board propagation, onboarding wizard, Brand Chat, team roles beyond decided minimum.
- **Safety risks:** reusing Board editor handlers may trigger Board autosave/local keys; whole-document conflicts; sensitive knowledge exposure.
- **Required tests:** revision success/conflict; Brand switch while dirty; Board snapshot unchanged; access denial; malformed/legacy Core; module round trip.
- **Production verification:** edit a disposable Brand; concurrent-tab conflict; confirm existing linked Boards do not change.
- **Recommended order:** **8**.

### BW-9 — Snapshot provenance and explicit synchronization

- **Objective:** make Canonical Core ↔ Board snapshot drift visible and safe under the chosen product policy.
- **Current evidence:** one-time copy only; no canonical revision metadata on Board.
- **Dependencies:** explicit authority/sync decision; BW-6–BW-8; schema/migration/security package.
- **Included:** provenance (`brand_id`, source revision/time), drift indicator, reviewable pull and/or publish action as decided, conflict checks, immutable backup/recovery.
- **Explicit exclusions:** background/automatic two-way sync; changes to Canvas nodes; AI learning loop.
- **Safety risks:** highest data-loss and cross-campaign contamination risk; access changes between preview and apply.
- **Required tests:** every revision ordering; partial/malformed snapshots; concurrent Brand/Board writes; permission loss; atomic failure; restore; collaborator boundaries.
- **Production verification:** staged Brand and multiple Boards; exercise divergence, preview, conflict, apply, rollback; audit logs.
- **Recommended order:** **9**.

### BW-10 — Workspace/Brand authorization and database hardening

- **Objective:** replace transitional email-only/runtime-DDL assumptions with a deployable ownership and database contract.
- **Current evidence:** no Workspace model/migrations/RLS/roles; direct application DDL; separate Brand/Board access models.
- **Dependencies:** Workspace membership/role decisions; production PostgreSQL/Supabase inventory; backup/rollback plan.
- **Included:** reviewed versioned migrations; stable ownership identifiers; Workspace/Brand role checks; least-privilege runtime role; RLS if Supabase/direct client access requires it; grants; live integration tests; staged migration of legacy rows.
- **Explicit exclusions:** team collaboration UX beyond minimum Brand Workspace roles; billing; unrelated schema cleanup.
- **Safety risks:** lockout, privilege escalation, migration downtime, orphaned legacy data, policy recursion/performance.
- **Required tests:** migration up/down or forward recovery; role matrix; RLS positive/negative cases; legacy records; concurrency; restricted runtime role boot.
- **Production verification:** backup; dry run on production-like clone; role/policy inspection; staged rollout/metrics; rollback rehearsal.
- **Recommended order:** **10 for product completion, but design/inventory begins before any write package and migration may be pulled earlier if production policy requires it.**

### BW-11 — Completion integration and regression gate

- **Objective:** certify the complete Brand Workspace without beginning later roadmap items.
- **Current evidence:** relevant checks are not in CI; no browser/database E2E.
- **Dependencies:** BW-1–BW-10.
- **Included:** CI execution of Brand checks; live PostgreSQL integration; browser E2E for no-Brand/create/select/reload/filter/create/attach/edit/sync; accessibility; telemetry/runbook; compatibility matrix.
- **Explicit exclusions:** onboarding, output language, i18n, dark mode, Brand Chat, team comments/approvals, scheduling, analytics, agents, realtime collaboration.
- **Safety risks:** flaky tests, unsafe production fixtures, declaring completion without operations evidence.
- **Required tests:** the full matrix above plus existing runtime boot suite.
- **Production verification:** controlled smoke test, logs/metrics, no legacy Board loss, rollback/runbook sign-off.
- **Recommended order:** **11**.

---

## 17. Recommended Implementation Order

1. **BW-1:** Read-only Canonical Brand catalog.
2. **BW-2:** Explicit ephemeral selection.
3. **BW-3:** Brand creation UI.
4. **BW-4:** Durable active Brand recovery.
5. **BW-5:** Brand-scoped Board catalog with legacy lane.
6. **BW-6:** Create Board from active Brand.
7. **BW-7:** Existing Board attachment.
8. **BW-8:** Canonical Brand Workspace read/edit surface.
9. **BW-9:** Snapshot provenance and explicit synchronization.
10. **BW-10:** Workspace/Brand authorization and database hardening (inventory/design starts earlier; deployment timing is gated by production policy).
11. **BW-11:** Completion integration and regression gate.

This sequence intentionally separates **discovery → selection → creation → recovery → Board scope → Board creation → migration → canonical editing → synchronization → durable security → certification**. It avoids a large client-controller restoration and keeps unbranded Boards usable throughout.

### Preserved product roadmap

After **Brand Workspace vollständig fertigstellen**, the established roadmap remains exactly:

1. Onboarding Wizard auf dem fertigen Brand-Flow aufbauen
2. Output-Sprache einführen
3. Software-Internationalisierung vorbereiten und Deutsch/Englisch umsetzen
4. Dark Mode
5. Quality Repair Loop und Full Content Pack abschließen
6. Brand Chat
7. Team Workspaces, Kommentare und Freigaben
8. Content Calendar und wiederverwendbare Templates
9. Social Scheduling und Publishing
10. Analytics inklusive Social Performance
11. Brand Learning und Optimization Loop
12. Deploybare Agents und Automationen
13. Realtime Collaboration

No replacement roadmap is proposed by this audit.

---

## 18. Next Recommended Package

### Recommendation: BW-1 — Read-only Canonical Brand catalog in the switcher

This is the **single** next implementation package.

Why it is the smallest safe advance:

- It uses an already implemented, owner-filtered summary endpoint.
- It reveals whether Canonical Brand records and authentication work in the real browser before giving Brand context authority.
- It does not mutate Brand, Board, Canvas, active session, local storage, or URLs.
- It preserves “No Brand selected” and every unbranded Board path.
- It can fail closed to the existing passive shell without blocking the application.
- It directly reverses none of PR #549’s safety posture: it does not restore the reverted controller or Board wiring.

### Acceptance boundary

The package is complete only when:

1. signed-in owned Brand summaries render safely in the existing switcher;
2. empty/401/error/malformed responses leave “No Brand selected” and Boards usable;
3. clicking a Brand does not select it yet (rows must be clearly non-actionable or labeled as preview/catalog-only);
4. no full `brand_core` enters the collection response/client list state;
5. no Board fetch, filter, association, Canvas state, autosave, or Brand write changes;
6. focused tests run in CI or the package explicitly adds its check to the existing workflow.

### Not the next package

Do not combine BW-1 with creation, persistent selection, Board filtering, canonical editing, schema changes, or snapshot synchronization. Those are independently risky and reviewable packages listed above.

---

## 19. Evidence Appendix

### 19.1 Primary current-source evidence

| Evidence | Conclusion supported |
|---|---|
| `index.html` sidebar and Brand Core shell | Passive Workspace hierarchy; no-Brand support; Board Brand Core labeling. |
| `app.js` state/session, active context, save/load, Brand Brain storage | No active Brand; Board is runtime authority; Board snapshot/local persistence. |
| `api/_brands-storage.js` | Canonical Brand schema and lazy bootstrap. |
| `api/_brand-access.js` | Owner-email Brand authorization and UUID validation. |
| `api/brands/index.js` | Authenticated list/create, summary redaction, body validation. |
| `api/brands/[id].js` | Authenticated owner-only get/update and revision conflict. |
| `api/_boards-storage.js` | Nullable association, optional FK, runtime DDL, retryable independent boot. |
| `api/boards/index.js` | account/editor/unowned list; server-authoritative create-from-Brand; generic unbranded create. |
| `api/boards/[id].js` | Board association returned but immutable through PUT/PATCH; Board snapshot remains editable. |
| `api/_board-access.js` | Owner/editor/unowned/anonymous-shared boundaries. |
| `scripts/check-canonical-brand-foundation.js` | Mock/contract coverage and explicit no-live-PostgreSQL limitation. |
| `scripts/check-workspace-brand-shell.js` | Passive shell/no-Brand compatibility contract and no client foundation. |
| `.github/workflows/runtime-boot-safety.yml` | Limited CI scope. |
| `docs/product/workspace-architecture.md` | Canonical ownership hierarchy and active Brand target. |
| `docs/product/brand-consciousness-architecture.md` | Brand-owned intelligence model. |
| `docs/audits/2026-06-27-board-session-autosave-architecture-audit.md` | Historical Canvas/Board ownership risk. |
| `docs/audits/2026-06-27-canonical-brand-records-audit.md` | Planned canonical identity boundary. |
| `docs/audits/2026-06-27-board-to-brand-association-audit.md` | Legacy safety and intended association. |
| `docs/audits/2026-06-28-brand-switcher-shell-audit.md` | Original static shell intent. |

### 19.2 Git/GitHub-history evidence

- `3c489ad` — merge PR #551, audited baseline.
- `022b616` — decouple Board/Brand initialization.
- `39f0b3b` / `e7e0f19` — merge/implementation for PR #550 passive hierarchy.
- `b1a9392`, `8157b23`, `21fd4d2` — PR #549 and explicit client-foundation reverts.
- `26e7c0f`, `3ff1a8f` — PR #548 attempted client foundation.
- `7b0c45e`, `a4871d8` — PR #547 server hardening.
- `5436662`, `ee5fef1` — PR #546 server foundation.
- `e4f9a6d` — autosave create guard.
- `36d45d5` — root startup local Canvas guard.
- `8267882`, `e4ea5a8` — passive Brand session and active-context diagnostics.

The repository had no configured remote and GitHub CLI had no authenticated host during the audit, so PR titles/descriptions beyond locally recorded subjects were not independently fetched. Merge numbers, branch names, commit topology, patches, and current contents are nevertheless locally verifiable Git evidence.

### 19.3 Checks performed for this audit

The following checks were used to validate conclusions and the documentation-only scope:

```text
git status --short --branch
git log --oneline --decorate -30
git log --merges --all
git show <relevant commits>
rg (Workspace/Brand/Board/brand_id/Brand Core/RLS/migration searches)
node --check app.js
node scripts/check-workspace-brand-shell.js
node scripts/check-canonical-brand-foundation.js
node scripts/check-browser-script-integrity.js
git diff --check
git diff --stat
git status --short
```

### 19.4 Final classification

| Classification | Items |
|---|---|
| **Verified facts** | Server Canonical Brand CRUD subset; owner-only access; nullable Board association; one-time canonical snapshot copy; Board snapshot persistence; passive no-Brand UI; absent active Brand; absent migrations/RLS; limited CI. |
| **Incomplete implementation** | Canonical product activation, selection, creation UI, association UX, Brand-scoped Boards, canonical editor, synchronization, Workspace ownership, production DB hardening. |
| **Inferred requirements** | Authorized active resolver, safe legacy lane, explicit provenance/conflict handling, least-privilege deployable schema, completion E2E gate. |
| **Unresolved decisions** | no-Brand lifetime, Workspace transition, post-create selection, attach/reassign rules, sync authority, collaborator visibility, anonymous Board policy, Brand archive/delete, Supabase/role/RLS posture. |

---

**Final audit decision:** preserve the current compatibility mode and established roadmap. Finish the Brand Workspace through the small packages above, beginning only with the read-only Canonical Brand catalog. Do not treat Canonical Brand records as active context, do not infer identity from Board Brand Core, and do not migrate or overwrite existing Boards implicitly.
