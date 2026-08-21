# BW-14 — Production Database and Authorization Readiness Audit

**Audit date:** 2026-08-21 (UTC)

**Repository baseline:** local `work` at `a637dab` (`Merge pull request #568 from Funklix/codex/add-controlled-canonical-to-board-update`)

**Scope:** documentation and evidence only; no request was sent to the application and no database, environment, deployment, authorization, or production-data mutation was performed.

## 1. Executive conclusion and evidence rules

The repository has understandable server-side authorization predicates for the current account-owned Canonical Brand and owner/editor/unowned Board models, but it does not establish a database-enforced tenant boundary or a versioned schema. Request-time DDL makes application availability depend on a comparatively privileged runtime database role. Identity is mostly a normalized email embedded in a 14-day HMAC cookie; session verification uses ordinary string comparison and there is no repository-visible revocation mechanism. These are readiness gaps, not proof of a production compromise.

Production database and deployment access were unavailable in the audit environment. Consequently, deployed schema, grants, table ownership, RLS, backups, environment separation, runtime version, and the deployed commit remain **Unknown**. The deployment classification is **Deployment identity unavailable**. The repository baseline therefore cannot be proven to match production.

Every substantive statement below is marked:

- **Repository verified** — directly established by tracked source at the baseline commit.
- **Live environment verified** — established by authorized, sanitized, read-only live inspection. There are no findings in this class in this audit.
- **Inferred** — a reasoned consequence of repository evidence, not a confirmed operational fact.
- **Unknown** — evidence was unavailable.
- **Decision required** — product/operations policy must be selected before hardening.
- **Risk** — a bounded adverse outcome supported by the stated evidence.
- **Recommended** — proposed future work, not current behavior.

## 2. Evidence sources and inspection limits

**Repository verified.** Inspected authentication routes and helpers; Brand and Board storage/access/routes; editor and presence routes; Workspace selection paths in `app.js`; document-related persistent tables; `vercel.json`; the sole workflow; package metadata; and repository-wide searches for DDL, SQL, grants/RLS, PostgreSQL/Supabase, identity/membership, cookie/session helpers, timing-safe comparison, and direct SQL. `pg` is the only database client dependency and all repository PostgreSQL access shares the pool exported by `api/_boards-storage.js`.

**Unknown.** `POSTGRES_URL`, Vercel credentials/project identifiers, and an authenticated deployment CLI context were absent. No Git remote is configured in this checkout. Values were neither requested nor printed. Therefore no PostgreSQL connection, public application probing, Vercel inspection, or production row/count inspection occurred.

**Repository verified.** The GitHub workflow runs syntax/integrity and BW-1–BW-13 source-level regression scripts. It does not provision PostgreSQL. The BW scripts mock or statically inspect database behavior; the repository contains no production schema verification or smoke script.

## 3. Authentication, session, and request-security boundary

| Topic | Finding |
|---|---|
| Login | **Repository verified.** `GET /api/auth/google/start` creates 128-bit random OAuth `state`, places it and a sanitized relative return path in 10-minute HttpOnly cookies, then requests Google `openid email profile`. The callback compares query state to the cookie, exchanges the code, calls Google userinfo, and requires an email. HTTP method is not explicitly checked on start/callback. |
| OAuth nonce/account assurance | **Repository verified.** State is present; no OIDC `nonce`, PKCE, `email_verified` check, or Google `sub` persistence is visible. The profile response, rather than a locally verified ID token, supplies identity. **Unknown:** upstream/operational protections. |
| Session contents | **Repository verified.** `{user, exp}` is base64url JSON plus HMAC-SHA-256. The callback stores `name`, raw `email`, and `avatar`; it does not store `sub`/stable ID. Identity is cookie-embedded and sessions are not persisted server-side. |
| Signature verification | **Repository verified.** A freshly computed base64url signature is compared with `!==`; `crypto.timingSafeEqual` is not used for sessions (it is used only for the document worker secret). Parsing rejects missing pieces/malformed JSON and expiration strictly earlier than current epoch time. Extra `.` components are ignored by destructuring. |
| Duration and cookies | **Repository verified.** TTL/Max-Age is 14 days. Session, state, and return cookies use `Path=/; HttpOnly; SameSite=Lax`; `Secure` is conditional on `NODE_ENV === 'production'`. No explicit `Domain`, `Expires`, or cookie-name prefix is set. |
| Logout/revocation | **Repository verified.** `POST` or `DELETE /api/auth/session` expires the browser cookie; `GET` returns the user and configuration presence. No server session record, revocation list, rotation/version, logout-all, account-disable check, or early invalidation is visible. Changing the signing secret invalidates every session. |
| Normalization/account changes | **Repository verified.** The cookie retains Google’s email form. Brand and most Board authorization normalize at use; Brand inserts use normalized email. Existing cookies are not refreshed against Google. Email changes therefore do not migrate ownership in code. |
| CSRF | **Repository verified.** State-changing Brand/Board endpoints authenticate solely by the automatically sent cookie. No CSRF token or Origin/Referer validation is visible. `SameSite=Lax` is the visible browser-level mitigation. JSON bodies are used by the UI, but handlers do not universally enforce content type. Logout also accepts POST. **Inferred:** cross-site form attacks are constrained by Lax and JSON parsing, but this is not a complete, live-verified CSRF contract. |
| Methods/body validation | **Repository verified.** Principal routes return 405 for unsupported methods. UUIDs are validated on Brand and Board item/association paths, but editor routes only require a nonempty Board ID. Brand name/core/revision and special Board operations are validated; ordinary Board PUT accepts any object for Canvas and can change name/core together. PATCH claim tolerates unrelated fields. |
| Disclosure/logging | **Repository verified.** Brand routes redact client 500s but log owner email and stack. Board item catch returns `error.message`; successful/direct Board reads and editor refresh log IDs, roles, and sometimes emails. There is diagnostic logging, not a durable repository-visible authorization audit log. |
| Headers/rate limits | **Repository verified.** No repository security-header configuration or general authentication/Brand/Board rate limiter was found. `vercel.json` contains only two SPA rewrites. **Unknown:** platform-added headers/WAF/rate limits. |

**Risk (Medium):** ordinary string signature comparison is avoidable cryptographic hygiene debt. Timing leakage exploitability through the deployed serverless/network stack is **Unknown**, so this is not classified as a confirmed authentication bypass.

**Risk (Medium):** valid cookies remain usable until expiry unless the global secret changes; logout only clears one client cookie. Impact is a longer response window for a copied cookie; likelihood and operational compensating controls are **Unknown**.

## 4. Identity and Workspace model

| Subject | Current identity/key and storage |
|---|---|
| Session user | **Repository verified.** Cookie-embedded name/email/avatar; helper can consume `id` or `sub`, but Google callback supplies neither. |
| Canonical Brand owner | **Repository verified.** normalized session email = `brands.owner_email`. |
| Board owner | **Repository verified.** normalized email match OR exact `owner_id` vs session `id/sub`; current Board creation writes normalized email into both `owner_email` and `owner_id`, so current OAuth sessions practically authorize by email. |
| Board editor | **Repository verified.** normalized session email = `board_editors.email`; name/avatar are opportunistically refreshed. |
| Board creator | **Repository verified.** `boards.created_by`, currently normalized email; editor `created_by`, document `created_by`/`requested_by` are also email-like text. These are attribution, not authorization predicates. |
| Workspace preference | **Repository verified.** `{v, brandId}` in browser `localStorage`, keyed by SHA-256 of normalized email. It is restored only if the authenticated account’s server-returned Brand catalog contains the ID. |
| Collaboration/presence | **Repository verified.** per-process global Map, keyed by lowercase email and Board ID, TTL 45 seconds; no persistent presence table. The presence route does not first prove Board view access and returns viewer identity to a caller with a Board ID. |

**Repository verified answers.** No durable Workspace table or membership table exists. The UI uses “Workspace” as an account-scoped presentation context, effectively treating the current Brand catalog account as one scope, but the preference itself grants no server authority. One email can own multiple Brands. `board.brand_id` is association/provenance context, not Workspace authority. A Board editor can access its Board but can read the linked Canonical Brand only when that editor separately owns the Brand. A Canonical Brand owner cannot edit every associated Board without also being owner/editor (or using the legacy unowned behavior).

**Repository verified selected-Brand paths.** The selected ID is stored/restored/removed in `app.js`, drives Brand detail loading, Board-list `scope=brand`, Board creation, association UI, and comparison UI. Every authoritative server action rechecks Brand ownership. **Repository verified `board.brand_id` paths.** It is created/indexed/FK-reconciled; selected/returned in Board list/detail/create; filtered in Brand-scoped lists; set/cleared in isolated PATCH; checked during compare/refresh; and cleared of provenance/recovery metadata when association changes.

**Inferred risks.** Email mutation, recycling, or duplicate identity-provider accounts can orphan access or transfer practical authority to whoever later controls the same normalized address. Cross-account browser preference collision is plausible for sequential users of the same email/browser, but catalog validation prevents the stored ID alone from granting access. Ownership transfer and automatic email migration do not exist. A Brand/Board ownership mismatch is supported intentionally by separate predicates, but its desired long-term semantics require a decision.

**Unknown.** Google account lifecycle protections, verified-email guarantees, duplicate-account prevention outside this repository, support-driven transfers, log retention, and operational session invalidation are not evidenced.

**Repository verified transitional behavior to preserve:** authenticated Board creation; owner/editor Board access; direct-link viewing; legacy unowned Boards visible/editable/claimable by authenticated users; unbranded Boards; nullable association; multiple Brands per account; editor access independent of Brand ownership; and local preference remaining non-authoritative.

## 5. Current authorization matrix

All cells below describe current code, not desired policy. Codes combine outcome and enforcement location. Database enforcement is **DB-FK/check only** where noted; every actor/tenant decision is **application-only** because no repository grants/RLS/policies exist.

**Actors:** SO signed out; UU authenticated unrelated; BO Board owner; BE Board editor; UC authenticated claimant viewing legacy unowned Board; AV anonymous direct-link visitor; CO Canonical Brand owner; BE¬CO Board editor who does not own linked Brand; CO¬BE Brand owner who cannot edit Board.

**Enforcement codes** (exact source locations):

- `L` — Board list, `api/boards/index.js` GET: SO/AV receive empty list; authenticated predicate is owner-email OR editor-email OR unowned. Brand scope additionally calls `getOwnedBrand`.
- `R` — direct Board GET, `api/boards/[id].js` + `_board-access.getBoardAccess`: any existing UUID is returned; role may be `non_owner` or `anonymous_shared` and `canView` is always true.
- `E` — Board PUT, same files: owner/editor/unowned role has `canEdit`; signed-out anonymous on unowned receives `anonymous_shared` and is denied.
- `O` — owner-only rename/delete/editor management: item/editor routes use `canRename`, `canDelete`, `canManagePermissions` from `_board-access`; only `owner` is true.
- `C` — claim, Board item PATCH: authenticated email plus row with `owner_email IS NULL`; it does **not** also require `owner_id IS NULL`, and the UPDATE is conditional only on `owner_email IS NULL`.
- `A` — association PATCH: authenticated Board `canEdit`; non-null target additionally must pass `_brand-access.getOwnedBrand` for the same actor; null needs no Brand authority.
- `B` — Brand list/read/create/edit in `api/brands/index.js`, `api/brands/[id].js`, `_brand-access.js`: authentication plus normalized owner-email predicate; edit also requires matching positive revision.
- `I` — initialization is client composition: direct Board GET (`R`) + owned Brand GET and revision-controlled Brand PUT (`B`); the server Brand PUT does not verify Board edit authority or provenance of supplied core.
- `Q` — compare is client-side after `R` + owned Brand GET (`B`); no compare API.
- `F` — refresh/restore special PATCH in Board item: authentication, transaction/row lock, owner/editor/unowned edit role, `updated_at` match; refresh additionally requires actor ownership of the associated Brand and revision/association match. Restore does not require Brand ownership.
- `N` — Board POST: authentication; when branded, actor must own Brand and server copies authoritative core/revision. Unbranded creation is allowed.

| Operation | SO | UU | BO | BE | UC | AV | CO | BE¬CO | CO¬BE |
|---|---|---|---|---|---|---|---|---|---|
| List Boards (`L`) | Allowed: empty | Conditional: own/editor/unowned | Allowed: own + accessible | Allowed: edited + accessible | Allowed: unowned | Allowed: empty | Conditional: Board predicate, not Brand ownership | Allowed: edited | Conditional: Board predicate |
| Read Board by ID (`R`) | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed | Allowed |
| Edit Canvas (`E`) | Denied | Denied, except unowned | Allowed | Allowed | Allowed | Denied | Conditional on Board role | Allowed | Denied |
| Edit Board Brand Core (`E`) | Denied | Denied, except unowned | Allowed | Allowed | Allowed | Denied | Conditional on Board role | Allowed | Denied |
| Rename Board (`O`) | Denied | Denied | Allowed | Denied | Denied | Denied | Conditional: Board owner only | Denied | Denied |
| Delete Board (`O`) | Denied | Denied | Allowed | Denied | Denied | Denied | Conditional: Board owner only | Denied | Denied |
| Manage editors (`O`) | Denied | Denied | Allowed | Denied | Denied | Denied | Conditional: Board owner only | Denied | Denied |
| Claim unowned (`C`) | Denied | Conditional: any authenticated claimant | Conditional only if target has null owner email | Conditional only if target has null owner email | Allowed | Denied | Conditional: same as any authenticated | Conditional | Conditional |
| Change `board.brand_id` (`A`) | Denied | Conditional: unowned + owns target, or clear | Conditional: owns target Brand, or clear | Conditional: owns target Brand, or clear | Conditional: owns target Brand, or clear | Denied | Conditional: must also edit Board | Denied for setting; allowed to clear as editor | Denied: cannot edit Board |
| List Canonical Brands (`B`) | Denied | Allowed: own only | Allowed: own only | Allowed: own only | Allowed: own only | Denied | Allowed: own only | Allowed: own only (not linked Brand) | Allowed: own only |
| Read Brand detail (`B`) | Denied | Denied unless owner | Conditional: owner | Conditional: owner | Conditional: owner | Denied | Allowed | Denied for associated Brand | Allowed |
| Create Brand (`B`) | Denied | Allowed | Allowed | Allowed | Allowed | Denied | Allowed | Allowed | Allowed |
| Edit Brand (`B`) | Denied | Denied unless owner | Conditional: owner + revision | Conditional: owner + revision | Conditional | Denied | Allowed with revision | Denied for associated Brand | Allowed with revision |
| Initialize empty Canonical from Board (`I`) | Denied | Conditional: can read Board + owns empty Brand | Conditional: must own Brand | Conditional: must own Brand | Conditional: must own Brand | Denied | Allowed even without Board edit authority | Denied for linked Brand | Allowed despite no Board edit |
| Compare Cores (`Q`) | Denied (no Brand) | Conditional: owns Brand; Board is public-read | Conditional: owns Brand | Conditional: owns Brand | Conditional: owns Brand | Denied (no Brand) | Allowed despite no Board edit | Denied for linked Brand | Allowed |
| Refresh Board from Canonical (`F`) | Denied | Conditional: unowned/editable Board + owns Brand | Conditional: must also own Brand | Conditional: must also own Brand | Conditional: must own Brand | Denied | Conditional: must edit Board | Denied | Denied |
| Restore previous Board Core (`F`) | Denied | Conditional: unowned + valid backup/concurrency | Allowed if backup/concurrency valid | Allowed if backup/concurrency valid | Allowed if valid | Denied | Conditional on Board edit role | Allowed if valid | Denied |
| Create Board from Brand (`N`) | Denied | Conditional: own Brand | Conditional: own Brand | Conditional: own Brand | Conditional: own Brand | Denied | Allowed | Denied for associated Brand | Allowed; becomes new Board owner |

**Risk (High):** direct Board reads are intentionally unrestricted by `getBoardAccess`, including Canvas and Brand Core snapshot, and anonymous presence GET reveals active viewer identity for a guessed/known Board UUID. This is a confirmed repository behavior; whether links are intended public secrets and whether production content is sensitive are **Decision required/Unknown**. It blocks introducing stronger Workspace assumptions until anonymous-link policy is decided.

**Risk (Medium):** legacy unowned Boards are listed to and editable/claimable by every authenticated email. This is confirmed compatibility behavior, not automatically a vulnerability; inventory and retirement policy are **Unknown/Decision required**.

## 6. Repository-managed database schema inventory

No users/accounts, sessions, Workspace, membership, or persistent presence table exists. No migration directory/version table is present. All tables below are created lazily during requests.

### `boards`

**Repository verified.** Initial table: `id UUID PK DEFAULT gen_random_uuid()`; `name TEXT NOT NULL`; `canvas_json JSONB NOT NULL`; `brand_core_snapshot JSONB` nullable; `order_index INTEGER` nullable; `created_at`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`. Additive nullable columns: `owner_id`, `owner_email`, `owner_name`, `owner_avatar`, `created_by` (all TEXT); `brand_id UUID`; BW-12 provenance `brand_core_source_revision BIGINT`, `brand_core_source_updated_at TIMESTAMPTZ`, `brand_core_snapshot_copied_at TIMESTAMPTZ`; BW-13 recovery `brand_core_snapshot_backup JSONB`, `brand_core_backup_source_revision BIGINT`, `brand_core_backup_source_updated_at TIMESTAMPTZ`, `brand_core_backup_snapshot_copied_at TIMESTAMPTZ`, `brand_core_snapshot_backup_created_at TIMESTAMPTZ`.

Checks require each source revision to be null or positive. Index: `boards_brand_id_idx`. A conditionally reconciled FK `boards.brand_id -> brands.id ON DELETE SET NULL` exists in repository intent. There are no JSON-type checks, owner-shape checks, normalized-email check, optimistic revision, or index on owner identity. Tenant boundary is application predicates over owner/editor. Deleting a Board cascades editors/documents/jobs/results after their schema is initialized; linked private objects are best-effort deleted after the row.

Legacy compatibility: ownership and Brand columns remain nullable; an unowned row is normally both owner fields null, while claim checks only `owner_email`. Existing rows are not backfilled. PUT replaces Canvas/snapshot and uses optional timestamp comparison before a non-conditional UPDATE; special refresh/restore uses a transaction, `FOR UPDATE`, exact timestamp comparison, and a one-slot swap.

### `board_editors`

**Repository verified.** `board_id UUID NOT NULL FK boards ON DELETE CASCADE`; `email TEXT NOT NULL`; `role TEXT NOT NULL DEFAULT 'editor'`; `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`; `created_by TEXT`; additive nullable `name`, `avatar`. Checks enforce lowercase email and the sole role `editor`. There is no declared PK; unique index `(board_id,email)` plus indexes on `email` and `board_id`. Tenant boundary is Board FK plus application owner management/editor lookup.

### `brands`

**Repository verified.** `id UUID PK DEFAULT gen_random_uuid()`; `owner_email TEXT NOT NULL`; `name TEXT NOT NULL`; `brand_core JSONB NOT NULL DEFAULT {}`; `revision BIGINT NOT NULL DEFAULT 1`; timestamps not null/default now. Checks enforce lowercase owner, trimmed name length 1–160, JSON object, and revision >=1. Index on owner email; no owner/name uniqueness or stable owner FK. Application owner-email predicate is the tenant boundary. Brand deletion route does not exist; FK intent would set associated Board IDs null if an out-of-band delete occurred.

### Document/recovery-related tables

**Repository verified.** These are Board-bound rather than Workspace/Brand-owned and inherit Board authorization through document route helpers:

- `brand_documents`: UUID PK; Board FK cascade; tile/source/name/media/extension/hash/storage fields; unique storage key; sizes/statuses/schema version/creator/timestamps/active/revision; source check; partial unique active `(board_id,tile_id)`. Most columns are NOT NULL as declared; page count and replacement/deletion times are nullable. No file-size/status/revision checks are declared.
- `brand_document_upload_intents`: UUID PK; unique request ID and storage key; Board FK cascade; tile/source/file declaration/expected document/creator/status/timestamps; source check; partial unique pending `(board_id,tile_id)`. `expected_document_id` is nullable and has no FK; status has no check.
- `brand_document_processing_jobs`: UUID PK; cascade FKs to Board/document; checked source, positive revision, 64-character hash, enumerated state/scan state, bounded attempts; request/version/lease/timestamp fields; six-column unique key; partial active-revision unique index and queued-claim index.
- `brand_document_processing_results`: UUID PK; unique cascade job FK plus cascade Board/document FKs; checked source/revision/hash; parser/scanner/schema/timestamps; same six-column unique key.

**Repository verified schema lifecycle.** None is declaratively versioned. `boards`/editors are request-initialized and additively reconciled; `brands` is request-created; their FK is conditionally reconciled after both exist. Document schemas are request-created after Boards, then processing tables. In-memory promises reuse successful initialization per warm process and reset on failure; optional Board/Brand FK reconciliation logs a redacted error and allows requests to continue.

**Unknown.** Every production column, default, constraint, index, owner, grant, row count, extension/function availability (`gen_random_uuid`), drift state, and cascade behavior is unverified.

## 7. Complete runtime DDL inventory

All operations require connection plus schema `CREATE`; ALTER actions require table ownership or equivalent privilege; index creation requires table ownership/schema privileges; FK creation requires privileges on both tables. Exact production grants are **Unknown**.

| File/function; trigger | Runtime DDL | Idempotence/retry/failure and operational concern |
|---|---|---|
| `_boards-storage.ensureBoardsTable`; every Board/editor route and presence editor refresh; document initialization | `CREATE TABLE IF NOT EXISTS boards`; 16 `ADD COLUMN IF NOT EXISTS` statements (snapshot/order, five owner/creator fields, Brand ID, three provenance, five backup fields); two DO/`ADD CONSTRAINT` revision checks; Brand-ID index; `CREATE TABLE IF NOT EXISTS board_editors`; two editor columns; three editor indexes | Create/add/index are catalog-idempotent; DO suppresses only `duplicate_object`, not an existing differently defined constraint. Sequential statements are not transactional. Promise resets on any failure, so later request retries whole sequence. DDL locks can delay concurrent requests/deployments. Board availability depends on success except optional relationship reconciliation. |
| `_brands-storage.ensureBrandsTable`; every Brand route and owned-Brand check | `CREATE TABLE IF NOT EXISTS brands` with four checks; owner index | Multi-statement query, catalog-idempotent; promise resets and later requests retry. Brand availability depends on success. It then attempts optional relationship reconciliation. |
| `_boards-storage.reconcileBrandRelationship`; after Board/Brand ensure | `to_regclass` existence probe; DO/`ALTER TABLE boards ADD CONSTRAINT boards_brand_id_fkey ... ON DELETE SET NULL` | Missing table returns false and resets for later retry. Duplicate name is swallowed. Other failure resets internally but wrapper logs and does not block Board/Brand availability. Adding/validating FK can scan/lock Boards and fail on drift/orphans. |
| `_document-records.ensureDocumentTables`; document routes and Board deletion | Creates `brand_documents`, its partial unique index, `brand_document_upload_intents`, its partial unique index; then processing schema | Catalog-idempotent, one multi-statement query. Promise resets on failure; request/delete fails. Index creation can fail on legacy duplicates and take locks. |
| `_document-processing-records.createSchema`; processing routes or document initialization | Creates jobs, two indexes, and results | Catalog-idempotent multi-statement query; shared-pool promise resets on failure. Processing/document availability depends on success. Unique/FK/index validation can lock or reject drift. |

**Repository verified.** No runtime `DROP`, `GRANT`, `REVOKE`, RLS enablement, or policy creation was found. No migration ledger prevents two versions from racing. `pg.Pool` has only `connectionString`; no explicit SSL, pool size/timeouts, application name, or session reset callback. Pool reuse follows Node module/process lifetime; Vercel functions are presumed serverless from layout (**Inferred**, runtime metadata unavailable). Transactions are used for refresh/restore and document state operations, not schema bootstrap or ordinary Board updates.

## 8. Database authorization and RLS

**Repository verified.** There are no `ROW LEVEL SECURITY`, `CREATE POLICY`, `GRANT`, `REVOKE`, `pg_roles`, `pg_policies`, or `information_schema` inspection paths, and no Supabase reference/direct browser database client. All SQL goes through server modules and the one `pg` pool. Tenant isolation is therefore expressed only by application predicates in this repository; FK/check constraints protect shape/relationships, not actor access.

**Unknown.** Live RLS enablement/policies, runtime role identity, `BYPASSRLS`, role membership, table ownership, grants, DDL capability, default privileges, schema ownership, and whether production adds controls outside the repository.

**Inferred.** Successful lazy DDL would imply the deployed runtime role (or a role it assumes) has significant DDL capability at initialization time, but production success and actual role architecture were not inspected. RLS’s value cannot be selected generically: with one trusted server role lacking per-request database identity, server application authorization remains primary; grants can limit capabilities and RLS may provide constrained defense in depth only with a trustworthy request-to-database identity mechanism. Direct-client RLS is not the present architecture.

## 9. Production and deployment inspection

- **Live inspection availability: Unknown/unavailable.** `POSTGRES_URL` was absent, so no connection was attempted and no transaction/query was issued.
- **Deployment identity unavailable.** Vercel token/org/project variables and CLI were unavailable; no deployment metadata was read. The production URL, project/environment identity, deployment time, commit SHA, function runtime, environment names, and preview/production database distinction are unknown.
- **Unknown.** PostgreSQL version/current schema/current user, table owners, columns, constraints/indexes, RLS/policies, grants, row counts, DDL rights, backups/PITR, and production/preview separation.
- **Repository verified.** `vercel.json` rewrites `/boards` and `/boards/:id` to the SPA; it declares no functions/runtime/headers. The workflow targets pushes to `main` and PRs, but contains no deployment, database, migration, live integration, schema verification, backup, or rollback job.

## 10. Prioritized risk register

No **Critical** issue is proven. Severity describes realistic repository-supported impact and does not assume unknown production conditions.

| Severity / title | Evidence and boundary | Impact / likelihood / mitigation / remaining gap | Recommended package; blocks Brand Workspace? |
|---|---|---|---|
| High — unrestricted direct Board/presence read | **Repository verified:** `getBoardAccess` returns `canView:true` for `non_owner`/`anonymous_shared`; Board GET returns Canvas/snapshot; presence GET lacks Board access check. **Live:** unavailable. | Confidential Board/viewer data can be read with an ID. Likelihood depends on ID disclosure and intended sharing (**Unknown**). UUID entropy and link knowledge mitigate enumeration; policy/telemetry are unknown. | Anonymous shared-Board policy after decision/inventory. **Yes**, blocks assuming Workspace isolation. |
| High — request-time privileged DDL and no migration ledger | **Repository verified:** complete §7 inventory. **Live:** unavailable. | Concurrent deploy/request locks, drift-dependent failure, and runtime compromise blast radius. Likelihood medium as DDL runs on cold processes; promise/idempotent clauses mitigate repeats but not drift/locking. | First gather schema evidence, then versioned baseline/restricted role. **Yes** for DB hardening, not UI-only work. |
| Medium — mutable email is principal ownership key | **Repository verified:** §4 predicates and callback fields. | Account changes/recycling can orphan or plausibly redirect access. Likelihood unknown; provider controls may mitigate. No transfer/mapping exists. | Stable ownership identifier introduction after identity decision. **Yes** for roles/Workspace authorization. |
| Medium — universal authenticated legacy-unowned edit/claim | **Repository verified:** list, access role, claim code. | Any signed-in account can alter/claim legacy rows. Likelihood/row population unknown. Compatibility is current mitigation/intent. | Read-only inventory then retirement strategy. **Yes** before stronger ownership semantics. |
| Medium — no per-session revocation | **Repository verified:** stateless 14-day cookie; logout client-only. | Copied session remains usable until expiry/global secret change. Likelihood unknown. HttpOnly/Secure-in-production/Lax/HMAC/expiry mitigate. | Session revocation expectations decision, then isolated package. **No** immediate block to evidence work. |
| Medium — session MAC uses non-timing-safe comparison | **Repository verified:** `_auth-session.js`; no live evidence. | Potential timing side channel; practical exploitability unknown. HMAC remains cryptographically signed. | Timing-safe session verification. **No**. |
| Medium — cross-ownership operations are inconsistent by composition | **Repository verified:** initialization/compare require Brand ownership but not Board edit; refresh requires both; restore requires Board edit only. | Users may see/use public Board snapshots to change their own empty Brand, while editors cannot refresh a Brand they do not own. This is behavior ambiguity, not proven escalation. | Board/Brand cross-ownership decision before role package. **Yes** for Brand roles. |
| Low — error/identity diagnostics | **Repository verified:** Board GET can return raw error messages; logs contain emails/stacks/IDs. | Operational logs/client errors may disclose more than necessary. Likelihood depends on logging access/error content. | Redaction/logging package later. **No**. |
| Low — schema constraints incomplete | **Repository verified:** Board JSON/owner invariants and several document statuses lack checks. | Drift/invalid rows can reach application and block later constraints. Application validation partially mitigates. Production state unknown. | Versioned baseline after read-only verification. **No** to evidence package; yes to migrations. |
| Informational — no repository RLS | **Repository verified**, live state unknown. | Not inherently a vulnerability in a trusted-server architecture; application predicates are the visible boundary. | Decide connection model, then grants/RLS if useful. **No** by itself. |

## 11. Decision register

| Decision required | Options; compatibility/security/migration impact | Recommended default; evidence still required |
|---|---|---|
| Durable Workspace vs transitional account scope | Keep email-account scope (compatible, weak role foundation); add Workspace entity later (role boundary, data mapping needed). | Preserve transitional account scope until stable user IDs and ownership inventory exist. Need product tenancy definition and live cardinalities. |
| Stable user identifier | Google `sub`; internal UUID account mapped to provider; retain email. Stable IDs improve lifecycle security but require backfill/dual-read. | Internal account UUID + provider identity mapping eventually; do not migrate yet. Need verified provider claims, duplicate/account-linking policy, production owners/editors. |
| Email migration | No migration; automatic verified change; explicit transfer/support workflow. Automatic mapping is compatible but risky without stable identity. | Explicit migration tied to stable identity. Need account-change/support requirements and audit expectations. |
| Canonical Brand roles | Owner-only; owner/editor/viewer; Workspace-derived roles. More roles expand schema/API/UI/test surface. | Retain owner-only until Workspace/identity decisions. Need collaboration requirements. |
| Board/Brand cross-ownership | Require both permissions; Board permission delegates snapshot-only actions; Brand permission implies Board action. Each changes current cells in §5. | Require explicit permission on each resource for mutations; preserve compare as read composition only after anonymous-read decision. Need product confirmation and usage telemetry. |
| Anonymous Board link | Keep anyone-with-link full read; signed-in only; explicit share token/ACL; public redacted view. Tightening can break links. | Do not change yet; inventory intent and introduce explicit share semantics before restriction. Need sensitivity classification/link usage. |
| Legacy unowned Boards | Indefinite; auto-claim; admin migration; staged sunset. Lockout/data-ownership risk varies. | Inventory, then staged claim/sunset with rollback; never bulk assign blindly. Need row counts/age/activity and support policy. |
| Runtime role/DDL privileges | One owner-like role; separate migrator/runtime; assumed short-lived role. Separation reduces blast radius but requires completed migrations. | Separate migration owner and DML runtime after schema baseline. Need live grants/owner/hosting constraints. |
| Versioned migrations | SQL files + ledger; migration framework; platform tooling. All must baseline existing drift safely. | Minimal ordered SQL + checksum/ledger and explicit deploy step. Need live schema dump metadata and deployment process. |
| RLS purpose/connection model | None + server predicates; defense-in-depth with server context; direct-client RLS. Direct-client is an architecture change. | Keep trusted server architecture; evaluate RLS only after stable identity/transaction context and runtime role facts. Need live role/grants and threat model. |
| Rollback strategy | Forward fix; reversible migrations; restore/PITR. Destructive rollback risks data. | Expand/contract migrations plus tested PITR/runbook. Need provider capabilities/RTO/RPO. |
| Backup verification | Provider claims only; scheduled restore drill; automated verification. | Periodic isolated restore drill. Need retention, encryption, last successful restore, ownership. |
| Staging/production separation | Shared database/schema; separate schemas; separate databases/projects. Shared increases blast radius. | Separate database/project and credentials. Need environment metadata and current topology. |
| Schema ownership | Runtime owns; dedicated owner/migrator; managed owner. | Dedicated non-login owner/migrator where provider supports it. Need `pg_roles`, owners, grants. |
| Session revocation | TTL only; global secret rotation; per-user/session version/store. Persistence adds operational work. | Define logout-all/account-disable requirement; likely per-session or per-user version if required. Need risk tolerance and account model. |

## 12. Independent readiness grades

| Area | Grade | Evidence |
|---|---|---|
| Repository schema clarity | Partially ready | **Repository verified:** schema is discoverable in four storage modules, but split across request DDL/additive reconciliation with no authoritative version. §§6–7. |
| Production schema verification | Unknown | No authorized database connection; §9. |
| Migration readiness | Not ready | No migrations/ledger, drift report, deploy ordering, or rollback path; §§7, 11. |
| Runtime-role least privilege | Unknown | Repository requires DDL but live role/grants/ownership are unavailable; §§7–9. |
| Application authorization clarity | Partially ready | Central helpers and route predicates allow the exact matrix, but anonymous/unowned/cross-resource policies are unresolved; §§5, 10. |
| Database-enforced isolation | Unknown | No repository RLS/grants; live controls unavailable; §8. |
| Session security | Partially ready | HMAC/expiry/HttpOnly/Lax/Secure-in-production and OAuth state exist; timing-safe comparison, stable subject, revocation/nonce are absent; §3. |
| Workspace ownership readiness | Not ready | No Workspace/membership entity and selection is non-authoritative local preference; §4. |
| Brand role readiness | Not ready | Sole normalized-email owner predicate; no roles/membership/transfer; §§4, 11. |
| Legacy Board compatibility | Ready | Nullable ownership/Brand, unowned list/edit/claim, unbranded creation, and direct links are explicitly retained in code/checks; §§4–6. “Ready” means behavior is clear, not that policy is endorsed. |
| Backup/rollback readiness | Unknown | No repository runbook and no live provider/restore evidence; §§9, 11. |
| Integration-test readiness | Partially ready | BW-1–BW-13 regressions exist and pass against mocks/static contracts, but no live PostgreSQL/RLS/migration suite; §§2, 15. |
| Deployment identity confidence | Unknown | **Deployment identity unavailable**; §9. |

No aggregate score is assigned.

## 13. Phased, independently mergeable hardening candidates

The ordering is evidence-first; each item is a separate candidate, not a combined proposal.

| Candidate | Objective / dependencies | Likely files; production prerequisite; risk/rollback | Compatibility, tests, runtime behavior |
|---|---|---|---|
| Production schema verification command | Emit sanitized read-only schema/role/RLS/grant drift report. Depends only on approved read-only connection. | New `scripts/inspect-production-schema-readonly.js`, docs/runbook; read-only credential. Low risk; rollback delete script. | No semantics/data changes. Tests with fixture catalog responses, SQL allowlist, secret/redaction checks, read-only transaction. **No runtime behavior change.** |
| Versioned schema baseline | Establish ordered, checksummed current-state baseline. Depends on verified live schemas and migration tool decision. | `db/migrations/*`, runner, package/workflow/docs; backups/staging. Medium migration risk; baseline marker/forward fix. | Preserve null/unowned/data; test empty DB and drifted snapshot. Deployment behavior changes; product behavior should not. |
| Restricted runtime-role contract | Remove runtime DDL and constrain DML. Depends on completed migrations/role facts. | Storage modules, role SQL/runbook/env docs; migrated schema and separate roles. Medium outage risk; restore former credential/grants. | Must preserve endpoints; integration/cold-start/permission-denial tests. Runtime deployment behavior changes. |
| Timing-safe session verification | Constant-time, length-safe MAC verification. Depends on compatibility fixtures. | `_auth-session.js`, new session tests; none. Low risk; revert. | Existing tokens must remain valid; malformed/valid/expired tests. Runtime security behavior changes only for verification implementation. |
| Stable ownership identifier | Add immutable account/provider mapping and dual-write/read. Depends on identity/email decisions and verified inventories. | Auth helper/callback, Brand/Board/access, migrations/tests; backup/staging. High backfill risk; dual-read flag/expand-contract rollback. | Must retain email-owned rows/editors. Runtime authorization behavior changes. |
| Workspace/account transitional ownership | Represent current single-account scope without Team roles. Depends on stable identity. | New storage/access/migration/API context/tests; mapping inventory. Medium/high; dual-write rollback. | Preserve multiple Brands/unbranded Boards/local selection. Runtime ownership behavior changes. |
| Canonical Brand role model | Add explicit owner/editor/viewer semantics. Depends on Workspace/product cross-ownership decisions. | Brand access/routes, membership schema/migrations, UI/tests; stable IDs. High; feature flag/dual-read. | Owner behavior preserved; runtime authorization changes. |
| Legacy unowned Board retirement | Inventory, claim window, staged disable/migration. Depends on policy/live counts. | Read-only report first, then Board access/routes/migrations/UI/tests; communications/backups. High lockout risk; staged flag. | Explicitly preserve until owners assigned. Runtime behavior eventually changes. |
| Anonymous shared-Board policy | Make link access explicit and minimize returned data. Depends on product/privacy decision and link inventory. | Board/presence access/routes, share-token storage/migration, UI/tests; rollout plan. High link-break risk; dual-mode flag. | Current links need transition. Runtime authorization changes. |
| RLS/grants package | Add database defense appropriate to actual server role/context. Depends on stable identity, connection model, migrations, role separation. | Migration SQL, transaction context/access, integration tests/runbook; staging and restore. High lockout risk; rollback policies/grants with migrator. | Must map every matrix operation. Runtime DB authorization changes. |
| Live PostgreSQL integration tests | Exercise schema/transactions/predicates on disposable DB. Depends on baseline migrations/fixtures. | Test harness/scripts/workflow; isolated DB. Low production risk; remove job. | Never production data; tests owner/editor/unowned/conflicts/FKs. No application runtime change. |
| Deployment smoke and rollback runbook | Prove commit, env separation, schema compatibility, restore/rollback gates. Depends on deployment/provider facts. | `docs/runbooks/*`, safe smoke script/workflow; authenticated metadata/staging. Low documentation risk; revert. | No destructive smoke records; read-only endpoint/schema checks. Process change, not product runtime. |

## 14. Exactly one recommended next implementation package

### **BW-15 — Sanitized read-only production schema verification command**

**Recommended. Objective:** reduce the largest evidence gap without changing authorization semantics or important data.

**Exact scope:** add a manually invoked Node command that requires an explicitly provided authorized connection, begins a read-only transaction, queries only allowlisted `information_schema`/`pg_catalog`/`pg_policies` metadata, reports server version/schema/runtime role name, relevant table/column/constraint/index/owner/RLS/policy/grant/capability facts and optional counts, redacts connection/error secrets, rolls back, and closes the pool. Add fixtures/unit tests and a short operator runbook.

**Explicit exclusions:** no migrations or DDL; no row content/JSON/email retrieval; no role/grant/RLS changes; no application/API/auth/Workspace/Board/Brand/UI/deployment/env changes; no automatic CI production connection.

**Acceptance criteria:** SQL statement allowlist is reviewable; transaction is read-only; every exit attempts rollback/close; output contains no URL, credential, email, Canvas, Core, snapshot, or row data; absent access fails safely; report captures all §9 unknown schema/role facts; repository application files are unchanged.

**Required tests:** syntax check; mocked catalog-result formatting; reject non-allowlisted SQL; secret/error redaction fixtures; forced query-failure rollback/close; empty/drifted metadata; disposable PostgreSQL read-only-role integration test when available; existing BW-1–BW-13 checks; `git diff --check`.

**Production verification:** an authorized operator runs it once against production and once against preview/staging, records only sanitized output, confirms read-only transaction/rollback in logs where available, and compares deployed commit metadata separately. It must not query application-content columns.

**Rollback:** remove the standalone command/runbook; there is no database or runtime state to reverse.

**Why next:** it is the smallest reversible package that determines actual schema drift, grants, ownership, RLS, DDL capability, and environment separation before selecting migrations, restricted roles, or RLS. It neither locks out users nor freezes an unverified identity/Workspace policy.

## 15. Validation record

**Repository verified.** Audit checks were non-mutating with respect to application/runtime/production. The only repository change is this document.

- `node --check` was run for the inspected authentication, Brand, Board, editor, presence, and storage scripts.
- Every existing `scripts/check-bw1-*.js` through `scripts/check-bw13-*.js` regression command was run.
- `git diff --check`, `git diff --name-only`, `git status --short --branch`, and `git fsck --no-dangling` were run.
- Environment/tool presence was checked by name/presence only. No secret value was emitted.
- **Unknown:** no live database/deployment check could be run because authorized access was unavailable.

## 16. Final audit answers

1. Current auth boundaries are a signed 14-day application cookie, normalized-email Brand ownership, email/optional-ID Board ownership, email editors, public direct reads, and authenticated unowned compatibility; all actor enforcement visible in the repository is server-application-only.
2. Schema is request-created/reconciled, with useful FK/check/index constraints but no versioned baseline; production realization and grants are unknown.
3. Repository-proven behavior is explicitly identified above.
4. No behavior received **Live environment verified** classification in this audit because access was unavailable; the user-provided statement that earlier packages were live-verified is context, not independently re-verified evidence.
5. Highest-priority unknowns are deployed commit/environment identity, real schema drift, role/grants/ownership/RLS/DDL capability, unowned/public Board population and intent, backups/restore proof, and staging separation.
6. Identity, Workspace, cross-resource, public-link, unowned, migration, role, RLS, rollback, backup, environment, schema-owner, and revocation decisions in §11 precede semantic hardening.
7. The single next package is **BW-15 — Sanitized read-only production schema verification command**, exactly as bounded in §14.
