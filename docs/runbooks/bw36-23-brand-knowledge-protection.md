# BW-36.23A production cutover runbook — R3

Review artifacts only. This task authorizes code, disposable tests and a PR. **Every production database connection, SQL execution, password/LOGIN change, Vercel configuration, deployment and write activation below requires separate production authorization.** No production SQL or cutover was performed. Supabase PostgreSQL is the only production database.

## Work permitted now

Review the PR and the complete dependency/grant inventory in `docs/implementations/bw36-23a-r3-restricted-runtime-access.md`. In a disposable localhost cluster run:

```sh
npm install --ignore-scripts --no-package-lock
# Supply BW36_23_TEST_URL privately for a disposable localhost cluster only.
# Its account must create/drop fixture databases and local test roles.
export BW36_23_DISPOSABLE=1
npm run check:bw36.23a
npm run check:bw36.23a:postgres
npm run check:bw36.23ar3:postgres
npm run check:bw36.23a:browser
npm run check:bw36.23ar2
```

The PostgreSQL scripts refuse a non-localhost URL or missing disposable opt-in. They never use `POSTGRES_URL` as an administrator fallback. R3's named `tendra_app_runtime` fixture requires an isolated cluster; run the two PostgreSQL suites sequentially. Run the complete `.github/workflows/runtime-boot-safety.yml` workflow as well. Existing baseline failures are activation blockers, not waived by focused tests.

## Prerequisites for a separately authorized production window

1. Merge only after review, passing required CI and separate merge authorization. Record the exact reviewed commit and SQL hashes. This task does not merge. Identify the Supabase project, PostgreSQL version (R3 requires 16+), actual existing schemas, table/function owners, migration ledger, storage authorities, all writers/jobs and Vercel environments. Do not infer an endpoint from a region or change existing roles blindly.
2. Verify PITR/backup retention and an isolated restore with measured RPO/RTO. Keep encrypted backups of data **and** roles, ACLs, policies, triggers and functions, and a migration manifest outside this database. Record timestamps, checksums and ownership privately. Separately retain actual Supabase Storage logos and Vercel Blob image bytes; history contains references, not asset backups. Do not prune uploads or restore historical Brands.
3. Drain every old application instance and job, including previews using production credentials. Freeze incoming writes at the application boundary before SQL. Keep old privileged credentials out of new runtime processes. Stop if a writer cannot be accounted for.
4. Existing roles must be present, with no elevated attributes: `brand_knowledge_owner` NOLOGIN; `brand_knowledge_runtime` NOLOGIN; `tendra_app_runtime` INHERIT, initially NOLOGIN. The only membership touching the runtime group/login must be `brand_knowledge_runtime` → `tendra_app_runtime`, INHERIT TRUE, SET FALSE, ADMIN FALSE. No runtime path to an owner, `anon`, `authenticated`, `service_role` or another group is allowed. Do not recreate them. R3 validates the graph and aborts on additional memberships/privileges.
5. The migration operator must own or be authorized to grant on all application tables, create schemas in the database and **SET ROLE to `brand_knowledge_owner`**, plus owner-level USAGE/EXECUTE for the private fingerprint verifier (through its approved operator-only membership). Supabase `postgres` is not a true superuser. Test its actual authority in isolated staging; R3 creates the lock function while locally assuming its NOLOGIN owner, in an owner-owned schema. Do not grant owner membership to the application. If the operator lacks ownership/SET authority, stop for a separately reviewed operator-only membership plan; do not change the migration to use the app owner connection.
6. Existing Workspace identity/backfill, logo, Project, Learning/provenance and Social schema v4 must already match the repository. Do not rerun old one-shot/backfill migrations over existing production rows. R3 checks required columns, version, ownership, RLS, exact effective table/column ACLs, policies, protected commands and sequence assumptions. The current tables use UUID defaults and require **no sequence grant**. An unexpected `nextval` default aborts. Review types/defaults/FKs/unique indexes against the staging schema as well; column existence is not a schema-equivalence proof.
7. Provision `BRAND_KNOWLEDGE_REVIEW_KEY` through a server-only secret manager, with at least 32 random bytes, before enabling Brand mutations. No `NEXT_PUBLIC_` prefix, source/browser exposure, logs or history. Five-minute tokens bind the actor, exact command digest and Brand. Rotation invalidates outstanding reviews; retain drafts and obtain new review. Exact committed receipts remain independently authorized. Keep existing `AUTH_SECRET`, storage keys, social vault encryption key/version and OAuth configuration available; the restricted database login does not replace those credentials.

## Operator connection and exact SQL order — separate authorization only

Use a controlled terminal, with shell tracing disabled. Read non-secret connection fields from the Supabase dashboard for the **approved operator** endpoint. Passwords are entered only at `psql` prompts. Do not paste a connection URI into commands, chat or logs.

```sh
set +x
unset PGPASSWORD PGSERVICE PGSERVICEFILE PGOPTIONS
read -r -p 'Approved operator host: ' PGHOST
read -r -p 'Approved operator port: ' PGPORT
read -r -p 'Approved operator username: ' PGUSER
read -r -p 'Verified CA bundle path: ' PGSSLROOTCERT
export PGHOST PGPORT PGUSER PGSSLROOTCERT
export PGDATABASE=postgres PGSSLMODE=verify-full
psql -X -W -v ON_ERROR_STOP=1 -f scripts/sql/bw36-23-brand-knowledge-preflight.sql
psql -X -W -v ON_ERROR_STOP=1 -c "SELECT current_user,session_user,current_setting('server_version_num'),pg_has_role(current_user,'brand_knowledge_owner','SET') AS can_set_owner; SELECT roleid::regrole,member::regrole,inherit_option,set_option,admin_option FROM pg_auth_members WHERE roleid IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole) OR member IN ('brand_knowledge_runtime'::regrole,'tendra_app_runtime'::regrole);"
sha256sum migrations/20261020_bw36_23_brand_knowledge_protection*.sql migrations/20261021_bw36_23a_restricted_runtime_access*.sql
```

Expected: the intended operator identity, PostgreSQL 16+, `can_set_owner=t`, and exactly the reviewed runtime membership. Compare catalogs privately; do not select Brand payloads into logs. `brand_knowledge_history` and `brand_knowledge_private` are absent before the initial protection install. If present, investigate whether an exact prior install exists; do not overwrite a partial/drifted install.

Execute **this order**, while writers remain drained:

```sh
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261020_bw36_23_brand_knowledge_protection.sql
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261021_bw36_23a_restricted_runtime_access.sql
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261021_bw36_23a_restricted_runtime_access.verify.sql
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql
```

The original Core install must precede R3. Expected Core results: `catalog_matches_install=t`, `rows_without_exact_history=0`, one baseline per preexisting Brand, only the four approved command/receipt entry points executable by runtime. Owner capabilities shown under the **operator** are not runtime findings. The Core verifier's history/fingerprint queries are operator-only; do not run that whole file as runtime (its history reads must fail).

Expected R3: transaction commits; both runs of its verifier finish with `BW36_23A_R3_RUNTIME_ACCESS_VERIFIED`. Initially `login_enabled=f` is acceptable for preparation. R3 grants nothing on `brands`, changes no private Core functions/history and does not change LOGIN/password attributes. It materializes missing document tables, enables their RLS, and adds command-specific server policies. It is atomic, rerunnable for the exact reviewed state, and refuses drift. The Core install remains independently rerunnable after R3. Both migrations use the same advisory migration lock, five-second lock timeout and bounded statement timeout. Any failure exits nonzero: stop, preserve evidence, keep writers drained. Do not retry a partial file, split the baseline, remove guards or broaden grants for availability.

## Safely enabling the existing login — separate authorization only

In the operator terminal:

```sh
psql -X -W -v ON_ERROR_STOP=1
```

Inside `psql`, after the prerequisite/grant verifications pass:

```sql
SET password_encryption='scram-sha-256';
\password tendra_app_runtime
ALTER ROLE tendra_app_runtime LOGIN;
\q
```

Enter a new password generated/stored in the approved password manager at the hidden `\password` prompts. There is no fixed or placeholder password in SQL. Do not put it in `ALTER ROLE ... PASSWORD` text, command arguments, environment dumps or SQL logs. The existing role already has its restricted attributes and membership; do not grant it another role.

## Connection compatibility and read-only proof — separate authorization only

Supabase documents the shared-pooler custom username as `tendra_app_runtime.<project-ref>`. For the dashboard's shared transaction pooler use port **6543**; for its shared session pooler use **5432**. A direct database endpoint on 5432 uses username **`tendra_app_runtime`** without the project suffix and may require IPv6 or the project's IPv4 option. Use the exact endpoint/project suffix from that project, not an invented hostname.

Documentation establishes supported formats; it does **not** prove this project's authentication. No actual Supabase custom-role connection was attempted. The current `pg` calls use unnamed queries, explicit transactions and transaction advisory locks; no named prepared statements or persistent `SET ROLE` are required. Transaction pooling must preserve `session_user=tendra_app_runtime` for the policies/lock helper. Test the primary endpoint, never a read replica. If transaction-pooler authentication or identity fails, keep the cutover blocked and test the approved session pooler, then direct endpoint. Never switch back to `postgres` in the app to make a test pass.

In a **second terminal**, set connection fields privately as above, with `PGUSER` set to the custom username for the selected method. Keep TLS verification enabled; use `psql -W` to enter the custom password. Run:

```sh
psql -X -W -v ON_ERROR_STOP=1 -c "BEGIN READ ONLY; SELECT current_user,session_user,pg_is_in_recovery(),current_setting('transaction_read_only'); SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid(); SELECT 1 FROM public.boards LIMIT 0; SELECT 1 FROM public.social_token_secrets LIMIT 0; COMMIT;"
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261021_bw36_23a_restricted_runtime_access.verify.sql
```

Expected: both database identities exactly `tendra_app_runtime`, `pg_is_in_recovery=f`, `transaction_read_only=on`, `ssl=t`, empty successful projections, verifier marker and `login_enabled=t`. No row values or credentials are printed. The R3 verifier is catalog-only and checks effective ACLs by role name from either connection. Separately prove the runtime connection's lack of owner capability without risking an elevated session:

```sh
psql -X -W -v ON_ERROR_STOP=1 -c "SELECT pg_has_role(current_user,'brand_knowledge_owner','MEMBER') AS owner_path,has_schema_privilege(current_user,'public','CREATE') AS ddl,has_any_column_privilege(current_user,'public.brands','UPDATE') AS direct_brand_update,has_table_privilege(current_user,'public.brand_knowledge_history','SELECT') AS history_read;"
```

Expected: four `f` values. Do not run write probes against production Brands. In isolated staging perform the prohibited SQL attempts as well; the real PostgreSQL suite verifies their denial.

Official references: [database connections](https://supabase.com/docs/guides/database/connecting-to-postgres), [shared-pooler tenant/user troubleshooting](https://supabase.com/docs/guides/troubleshooting/tenant-or-user-not-found). Stop on certificate, tenant/user, password, privilege, session-identity, version or catalog mismatch. Record only bounded error codes; never print a URI to diagnose it.

## Vercel and functional cutover — separate authorization only

After DB checks and restricted-login staging pass, an authorized operator opens the existing Vercel project → Settings → Environment Variables. Update **server-only `POSTGRES_URL`** for only the approved environment to the successfully tested custom-role connection, using the secret manager. URL-encode credentials through the secret manager; do not echo or paste the URI into a ticket. Confirm `BRAND_KNOWLEDGE_REVIEW_KEY` and existing server secrets are configured. Remove duplicate privileged PostgreSQL connection variables from the approved runtime configuration only after checking which names the deployment actually reads (`api/_boards-storage.js` uses `POSTGRES_URL`). This task changes no Vercel values.

Deploy the reviewed compatible commit only with separate deployment authorization; drain/restart old instances and verify their sessions disappear. A Vercel variable update alone does not update existing deployments. Keep writes closed until a restricted-login staging environment has passed all of:

- Cold boot, login, Home/catalog and read-only navigation with no DDL attempts or optional Avatar boot dependency.
- Board/Canvas save/reload, compare/refresh/restore, editor invitation/role/remove, private/public sharing and unrelated-user denial.
- First/existing Workspace, accepted membership, rename and cross-Workspace rejection; Brand Profile/create/replay/membership; new and existing Brand Project creation/replay and rollback.
- Protected Brand Core preview/edit, destructive review/expiry, explicit DNA/Avatar acceptance without altering existing content, initialization at SERIALIZABLE, logo upload/discovery/removal/receipt retry and authorized deletion on **disposable fixtures only**. Verify one history event per mutation and no direct/history access.
- Learning proposal/edit/approve/reject/archive, duplicate/supersession/provenance/advisor freshness and immutable event behavior.
- Document intent/expiry/cancel/upload/replace/delete; processing lease/retry/cancel/supersede. Scanner-not-configured remains a blocked workflow, not a false success.
- Social settings and OAuth owner/session binding, credential encryption, reconnect/disconnect/destination selection; publishing job/attempt/finalization persistence with provider stubs or specifically authorized sandbox accounts. No live publish as an unapproved smoke test. Test wrong-account denial and absence of decrypted tokens in responses/logs.
- Concurrent/stale writes, lost-response idempotency, history/Board insertion failure and atomic rollback. All Runtime Boot Safety checks must pass; do not waive baseline failures.

For production, observe only existing read paths until a separately authorized smoke-fixture/write activation plan is approved. Then enable supported writes, monitor bounded errors, latency, locks, history growth, WAL/storage and asset availability. Do not restore historical test Brands or add Phase B UI.

## Failure / safe write freeze — separate incident authorization only

Before a migration COMMIT, errors roll back its changes. After COMMIT, keep protections and roll forward. Freeze incoming requests/jobs, drain all writers and disable new runtime authentication first:

```sh
# In the approved OPERATOR terminal only:
psql -X -W -v ON_ERROR_STOP=1 -c "ALTER ROLE tendra_app_runtime NOLOGIN;"
psql -X -W -v ON_ERROR_STOP=1 -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE usename='tendra_app_runtime' AND pid<>pg_backend_pid();"
psql -X -W -v ON_ERROR_STOP=1 -c "SELECT count(*) AS remaining_runtime_sessions FROM pg_stat_activity WHERE usename='tendra_app_runtime';"
psql -X -W -v ON_ERROR_STOP=1 -f migrations/20261021_bw36_23a_restricted_runtime_access.rollback.sql
```

Expected: no remaining runtime transactions, then ALTER ROLE/REVOKE/DO/COMMIT. If Supabase denies termination, stop for the authorized project operator; do not assume existing transactions are frozen. Transaction poolers may retain sessions: repeat the session count and keep entrypoints disabled. Freeze cannot undo an already committed write. R3's rollback revokes non-Brand DML (including column grants) from both the capability group and login, disables LOGIN and revokes the three mutating protected commands. SELECT and the receipt lookup remain available only to preexisting permitted connections; the application should serve a compatible read-only version. Keep **every history row, baseline, trigger and deny policy**.

The original `migrations/20261020_bw36_23_brand_knowledge_protection.rollback.sql` freezes **Brand mutations only**; it is insufficient to freeze the full app. Any freeze intentionally makes the full readiness verifier fail and changes private function ACLs/fingerprint. Do not rerun the Core migration while frozen or treat the mismatch as repair permission. Resume only after incident review and separate authorization: restore EXECUTE on exactly `write_brand(text,uuid,jsonb,jsonb,boolean)`, `create_brand(text,uuid,uuid,text,jsonb,uuid)` and `lifecycle(text,uuid,jsonb,jsonb)` to `brand_knowledge_runtime`, apply the reviewed R3 migration, run both operator verifiers, repeat restricted-login connectivity/staging checks, and enable LOGIN last. Never drop history, disable triggers, regrant direct Brand DML, restore privileged app credentials or overwrite newer knowledge from an old database backup.
