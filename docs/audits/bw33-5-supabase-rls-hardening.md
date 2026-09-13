# BW-33.5 — Supabase RLS hardening audit and prepared implementation

**Decision:** GO, **Model A — server-only direct PostgreSQL access**. The SQL is prepared but was not run. No production connection, Supabase CLI, dashboard, environment change, or remote operation was used.

## Findings and access-path proof

The reported advisor state is RLS disabled on `brands`, `social_publish_jobs`, `social_provider_attempts`, `brand_documents`, `brand_document_upload_intents`, `brand_document_processing_jobs`, `brand_document_processing_results`, `social_external_posts`, `brand_members`, `social_token_secrets`, `social_connected_accounts`, and `social_oauth_attempts`; `boards` has RLS enabled and no policy.

Production code has one database constructor: Node's `pg.Pool` in `api/_boards-storage.js`, using only server environment variable `POSTGRES_URL`. All other storage modules import that pool. Repository-wide searches found no `@supabase/supabase-js`, Supabase client, `SUPABASE_URL`, anon/publishable/service-role key, Data API `/rest/v1`, database GraphQL, Realtime, Storage, or RPC path. Browser code calls authenticated `/api/*` endpoints and contains no database credential or query. Identity is the application's signed HttpOnly Google session, not Supabase Auth; `auth.uid()`, `anon`, and `authenticated` do not participate in application authorization.

The server role's name/value is intentionally unknown and unrecorded. Its classification is the trusted direct-PostgreSQL `POSTGRES_URL` login. The same login lazily creates all affected tables and therefore owns newly created relations in the represented design; PostgreSQL table owners bypass ordinary RLS unless `FORCE ROW LEVEL SECURITY` is set. The reported fact that Boards still work after RLS was manually enabled is production corroboration for that established path. The migration does not force RLS and targets deny policies only to `anon` and `authenticated`. Felix must nevertheless verify `current_user`, ownership, `rolbypassrls`, and the current policy inventory before execution; unexpected policies cause the migration to abort before changes.

## Affected-table access matrix

All rows are server-side Node/Vercel functions through `pg`/`POSTGRES_URL`; none intentionally supports unauthenticated database access or needs browser `anon`/`authenticated` grants. “Authorization” means checks completed before storage work, not RLS.

| Table | Production access files | Operations | Preceding application authorization |
|---|---|---|---|
| `boards` | `_board-access.js`, `_boards-storage.js`, `boards/index.js`, `boards/[id].js`, `boards/[id]/sharing.js`, `boards/presence/[id].js`, `content-review/approval-service.js` | S/I/U/D | signed session plus owner/editor/viewer/public-token capability; writes require edit/owner as appropriate |
| `brands` | `_brands-storage.js`, `_brand-access.js`, `brands/index.js`, `brands/[id].js`, `boards/index.js`, `boards/[id].js` | S/I/U | signed session; owner or Brand-member role; revision guard on update |
| `brand_members` | `_brands-storage.js`, `_brand-access.js`, `brands/[id]/members.js`, Brand/Board collection routes | S/I/U/D | signed session; owner/admin for management, scoped membership for reads |
| `brand_documents` | `_document-records.js`, `_document-route.js`, `_document-processing-records.js`, `boards/[id].js` | S/I/U | signed session followed by Board access/source-tile checks; Board deletion observes linked blobs |
| `brand_document_upload_intents` | `_document-records.js`, `_document-route.js`, `boards/[id].js` | S/I/U | signed session plus editable Board/source-tile and request binding |
| `brand_document_processing_jobs` | `_document-processing-records.js` | S/I/U | called only after document route Board authorization; worker claims are trusted server operations |
| `brand_document_processing_results` | `_document-processing-records.js` | S/I/U | same trusted document-processing boundary |
| `social_token_secrets` | `social-connector/schema.js`, `storage.js`, `linkedin-service.js`, `publishing-service.js` | S/I/U/D | signed session account id; owner predicates; plaintext is sealed server-side before insert |
| `social_connected_accounts` | same Social Connector files | S/I/U | signed session account id and owner predicates |
| `social_oauth_attempts` | `schema.js`, `linkedin-service.js` | S/I/U | signed session binding, owner, state hash, expiry and one-time-consumption checks |
| `social_publish_jobs` | `schema.js`, `storage.js`, `publishing-service.js` | S/I/U | signed owner, Board edit authority, approved-content fingerprint, destination ownership and idempotency |
| `social_provider_attempts` | `schema.js`, `storage.js`, `publishing-service.js` | S/I/U | owner-scoped parent job and trusted publisher workflow |
| `social_external_posts` | `schema.js`, `storage.js`, `publishing-service.js` | S/I | owner/Board/node/job/destination bindings and accepted-provider result |

`DELETE` also reaches documents/jobs/results by existing foreign-key cascades; BW-33.5 changes no foreign key. No affected table is intentionally exposed through the Supabase Data API.

## Repository database state

There is no SQL migration runner or `supabase/` configuration. Tables are created idempotently at request time: Boards in `_boards-storage.js`; Brands/members in `_brands-storage.js`; document/intents in `_document-records.js`; processing jobs/results in `_document-processing-records.js`; Social tables in `social-connector/schema.js`. Deployment CI runs JavaScript regressions only and applies no SQL. Thus `migrations/` is an operator-reviewed artifact, not auto-executed.

Committed schema code represents no RLS statements, policies, table grants, default-privilege changes, explicit owners, security-definer functions, or views over these tables. Sequences are implicit UUID generation (`gen_random_uuid()`), not serial/identity sequences, so no sequence grants are needed. Foreign-key triggers run as PostgreSQL constraint triggers and no repository function/view depends on caller privileges. The manual Boards RLS toggle is production state supplied by the owner, not committed history; reachable history contains no Boards RLS migration.

## Migration, risk, and advisor decision

`migrations/20260911_bw33_5_supabase_rls_hardening.sql` first rejects any policy other than its own named deny policy, then enables (not forces) RLS on exactly 13 tables, revokes all table privileges from `anon` and `authenticated`, and adds one restrictive `FOR ALL` false/false policy per table. PostgreSQL applies `USING (false)` to SELECT visibility and UPDATE/DELETE row selection, and `WITH CHECK (false)` to INSERT/UPDATE candidate rows. Grants independently deny every table operation. There is no allow policy, schema/data DDL, owner change, or credential.

The explicit deny policies are defense-in-depth and give `boards` a policy without inventing a client identity. Supabase's `RLS Disabled in Public` condition should clear for 12 tables. Its `RLS Enabled No Policy` condition should clear for Boards because a policy exists. Advisor implementation details can change and could not be live-queried from this environment; if it flags deny-only policies, acknowledge the finding rather than weakening security. Refreshing the Advisor is the authoritative post-run confirmation.

`ALTER TABLE ... ENABLE`, `REVOKE`, and the conditional policy creation are repeat-safe. The preflight occurs inside the transaction before DDL, and an error rolls everything back. Normal bounded catalog locks are required. The central residual risk is external configuration: the repository cannot read the production login attributes. The mandatory owner/bypass query in the runbook closes that boundary before execution. `FORCE ROW LEVEL SECURITY` is prohibited because a table-owner server path could then default-deny and regress every workflow.

## Verification, rollback, and regression scope

The migration ends with a read-only 13-row verification query. Each row must show RLS on, force off, the deny policy true, and empty grant arrays. The separate rollback drops only BW-33.5 policies, returns the 12 reported-disabled tables to their former RLS state, preserves Boards RLS, and intentionally leaves API grants revoked. Exact pre-existing grants are captured before application and are restored only after an explicit security review; restoring broad client grants automatically would recreate the incident.

The bounded check verifies table coverage, RLS/revokes/deny syntax, forbidden permissive/force/data/schema SQL, idempotency guards, verification and rollback, server pool assumptions, browser credential absence, unchanged application/auth/API/UI files, workflow placement, and absence of database commands. A local disposable PostgreSQL/Supabase environment is not configured, so behavioral role tests are not performed. Existing checks cover session/OAuth, Boards/public access/ownership/membership/loading, Brand isolation/membership, documents, Social/OAuth/tokens/publishing/approval, browser integrity, and Runtime Boot Safety.

Production execution and the required smoke-test gate are in `docs/runbooks/bw33-5-rls-hardening.md`.
