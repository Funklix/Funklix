# BW-32.2.8 — Social Connector storage production contradiction audit

**Date:** 2026-09-08

**Scope:** documentation-only review of repository revision `f071815` and safe, unauthenticated deployment reachability

**Production observation supplied for this audit:** request `req_giU__Sx7049ZeEwM`, `schema_initialization` / `oauth_return_path_constraint` / `check_violation`, reported schema version `3`, unchanged committed state, at `2026-09-07T22:30:23.231Z`

## Executive determination

The contradiction has a repository-proven explanation that does **not** require the inspected database to be the wrong database and does **not** implicate the already-valid return-path constraint.

`oauth_return_path_constraint` is a shared label for four different statements. One of them adds `social_oauth_attempts_last_confirmed_phase_check`. That check excludes the value `state_received`, while the production start service deliberately inserts every new OAuth attempt with `last_confirmed_phase = 'state_received'`. PostgreSQL validates an `ADD CONSTRAINT ... CHECK` against existing rows and raises SQLSTATE `23514` when one of those rows contains `state_received`. The supplied two canonical `return_path = '/'` rows may therefore be completely correct and the validated return-path check may be present: the failing check is the *phase* check, mislabeled as a return-path operation.

This is the highest-confidence and only repository-demonstrated cause matching all supplied facts. The migration transaction then rolls back, leaving the inspected return-path state unchanged and the schema-version row below the migration threshold. A later request retries the same incompatible phase-check addition and reports the same failure. Manual return-path normalization cannot repair a disallowed `last_confirmed_phase` value.

The public diagnostic's `schema_version: 3` does not prove that the database version row is 3. `settings-projection.js` hard-codes the string `3`; it does not report the value read from `social_connector_schema_version`. The diagnostic is therefore the source-code target version, not committed database state.

## 1. Database connection ownership

### Complete Social Connector connection graph

| Entrypoint | Initialization and work path | Pool |
|---|---|---|
| `GET /api/social-connections` (Settings projection) | `social-connections.js` → `createStorage()` → lazy `require('../_boards-storage').pool` → `ensureSocialConnectorSchema(selected, diagnostic)` → projection query | `_boards-storage.js` module singleton |
| LinkedIn start | `social-connections-linkedin-start.js` → `social-connector-route.ensure()` → `ensureSocialConnectorSchema(pool)`; then `route.service()` → `createService({pool})` → insert attempt | same imported `_boards-storage.js` pool |
| LinkedIn callback | `social-connections-linkedin-callback.js` → the same route `ensure()`; then the same service factory and pool for attempt/connection writes | same imported `_boards-storage.js` pool |
| LinkedIn disconnect | `social-connections-linkedin-disconnect.js` → the same route `ensure()`; then the same service factory and pool | same imported `_boards-storage.js` pool |

There is one production pool constructor in this graph: `new pg.Pool({connectionString: process.env.POSTGRES_URL})` at module evaluation in `_boards-storage.js`. Social Connector code consults **only `POSTGRES_URL`** for its database connection. It does not consult `DATABASE_URL`, Supabase-specific URL names, `BW326_DATABASE_URL`, or a fallback URL, so there is no repository-defined precedence among alternatives: `POSTGRES_URL` is the sole choice. `BW326_DATABASE_URL` belongs only to the optional regression fixture and cannot select the application database.

Dependency injection permits tests or another caller to pass a different `pool` to `createStorage`, `createService`, or `ensureSocialConnectorSchema`, but all reviewed production entrypoints use the shared `_boards-storage.js` export. Settings projection and callback therefore converge on the same pool module within a given loaded serverless bundle/process. No second production Social Connector pool was found.

### Pool and initialization caching

Node's module cache retains the `_boards-storage.js` pool for the lifetime of a warm process. `schema.js` additionally stores the successful initialization promise in a `WeakMap`, keyed by the pool object. A rejected promise is deleted and is retried on the next request. A successful promise suppresses further initialization for that pool/process.

A pool can retain the `POSTGRES_URL` captured at module load while that warm process lives. Repository code does not refresh configuration. A normal new deployment creates a new artifact/runtime rather than mutating an existing module's environment, but the repository cannot prove Vercel's alias routing, instance retirement, or which deployment served the supplied request. An older deployment generation could therefore remain externally possible, but no deployment evidence here establishes it as the cause.

Preview and production deployments can receive different `POSTGRES_URL` values because deployment environment assignment is outside the repository. The source cannot prove that production's value targets the Supabase database that was inspected. Thus the application **can** connect to a database other than the inspected database if its externally supplied `POSTGRES_URL` points elsewhere; the repository proves neither that it does nor that it does not.

### Schema and `search_path`

The pool sets neither `search_path` nor a connection `options` value. Every Social Connector table, index, constraint target, `social_connector_schema_version`, and most catalog-to-table resolutions are unqualified. In particular, `'social_oauth_attempts'::regclass` follows session `search_path`. The effective path consequently comes from PostgreSQL role/database defaults (and any connection-string options), none of which the repository controls or records.

An identically named object outside `public` can be selected before `public`; `CREATE TABLE IF NOT EXISTS` and unqualified DML can also act in the effective creation/resolution schema. Independent names can resolve to different schemas, so an unqualified schema-version table and unqualified social tables are not proven to be a single `public` schema set. One request uses one acquired client's effective path during migration, but different pool connections could theoretically have externally configured per-role/session behavior. The code itself issues no path-changing statement.

### Safe automatic identity proof for the follow-up

Because the repository cannot prove the deployed target, BW-32.2.9 should compute a server-side **HMAC-SHA-256 identity digest**, never a hash of the URL. On the same acquired migration client, collect non-credential catalog/session identity such as `current_database()`, the database OID, `current_user`, `inet_server_addr()`, `inet_server_port()`, `current_schema()`, and the ordered visible schemas. Serialize with fixed field names and lengths, then HMAC it with a dedicated high-entropy server-only diagnostic key and emit only a versioned, truncated-or-full base64url digest. Do not emit the inputs, key, host, URL, username, or connection options. A keyed digest cannot feasibly be reversed or dictionary-tested without the secret and cannot reconstruct the database URL because the URL is never input. The software should persist/compare the digest to an expected deployment diagnostic or attach it to bounded server diagnostics automatically; it must not delegate comparison or SQL execution to a user.

## 2. Exact diagnostic-to-statement mapping

### Assignment chain

1. Settings creates a mutable diagnostic object and storage marks it `phase = schema_initialization`, initially with `schema_unknown`.
2. Every migration call passes through `run()`, which calls `mark()`. `mark()` always assigns `phase = schema_initialization` and assigns the requested member of `STEPS` as `operation_category`.
3. The migration catch captures `diagnostic.operation_category` as `failedStep` **before** issuing rollback. After rollback it restores that captured category and maps PostgreSQL error code `23514` to `database_error_category = check_violation`.
4. The Settings error projection allowlists those values but hard-codes `schema_version: '3'` and `committed_state_category: 'unchanged'`.

No other repository assignment was found that can produce this exact three-field combination. LinkedIn callback errors use a different diagnostic shape and camel-case `operationCategory`; the supplied snake-case diagnostic is the Settings projection path.

### Every statement covered by `oauth_return_path_constraint`

When the committed version read by the migration is below 2, the category covers, in order:

1. **Return-check discovery:** `SELECT pg_get_constraintdef(oid) ... WHERE conrelid='social_oauth_attempts'::regclass AND conname='social_oauth_attempts_return_path_check'`.
2. **Conditional return-check removal:** `ALTER TABLE social_oauth_attempts DROP CONSTRAINT social_oauth_attempts_return_path_check`.
3. **Conditional return-check addition:** `ALTER TABLE social_oauth_attempts ADD CONSTRAINT social_oauth_attempts_return_path_check CHECK(return_path = '/')`.
4. **Phase-check discovery:** `SELECT 1 FROM pg_constraint ... conname='social_oauth_attempts_last_confirmed_phase_check'`.
5. **Conditional phase-check addition:** `ALTER TABLE social_oauth_attempts ADD CONSTRAINT social_oauth_attempts_last_confirmed_phase_check CHECK(last_confirmed_phase IS NULL OR last_confirmed_phase IN (...))`.

The category does **not** cover return-path row normalization (`oauth_return_path_backfill`), default assignment or added metadata columns (`oauth_return_path_column`), schema-version writing (`schema_version_write`), or table creation. It does cover two distinct constraints and discovery/drop/add operations, so “the return-path constraint failed” is not a valid interpretation.

Of these statements, the two `SELECT`s do not evaluate row checks and a constraint drop does not raise a row check violation. Either `ADD ... CHECK` can raise `23514` while validating existing rows. Given the confirmed canonical return paths and compatible validated return constraint, the return-check addition is skipped by current source. The phase-check addition is the exact viable `23514` source: existing `state_received` rows violate its allowlist.

## 3. Constraint compatibility detection

The return constraint is discovered by **name** on the unqualified regclass. Its expression compatibility is then inferred from the case-insensitive regular expression `return_path\s*=\s*'/'::text`. This is not exact `pg_get_constraintdef` equality and tolerates whitespace and surrounding parentheses, but it requires the explicit `::text` rendering. It does not parse a normalized expression, inspect expression catalog nodes, inspect `contype`, or inspect `convalidated`.

PostgreSQL's confirmed `CHECK ((return_path = '/'::text))` contains the required substring and matches the regex. Current source therefore retains that constraint, does not drop it, does not recreate it, and does not try to add a duplicate. It cannot fail before that decision on row validation; discovery is a catalog query (though it could fail for unrelated lookup/permissions reasons, not with the observed `23514`).

The detector is still not semantically robust in general: equivalent formatting without an explicit cast, a different-but-equivalent catalog rendering, or a matching textual fragment embedded in a broader non-equivalent expression can be misclassified. It also treats an unvalidated textually matching constraint as compatible. Those defects should be corrected, but they do not explain the confirmed expression: that expression is retained by the current regex.

Phase-check “compatibility” is weaker: only the name is tested. Any same-named phase check, validated or not and regardless of expression, is retained. If absent, the migration adds the incompatible allowlist without first classifying historical values.

## 4. Complete CHECK-violation inventory

Migration “version” below means the gate that first creates/touches the check, not the hard-coded public diagnostic version. Anonymous inline checks receive PostgreSQL-generated names; only explicitly named checks have a repository-stable name.

| Constraint / table | Expression | Version and active category | Can production-shaped existing rows violate during this migration? | Historical-row coverage |
|---|---|---|---|---|
| generated / `social_token_secrets` | platform allowlist | v1 `token_secrets_table` | `CREATE TABLE IF NOT EXISTS` does not retrofit a check onto an existing table; a fresh empty table cannot violate | Fresh-schema optional PostgreSQL fixture only; no historical platform fixture |
| generated / `social_token_secrets` | encrypted payload ≤ 32768 octets | v1 `token_secrets_table` | same creation semantics | No historical oversized row |
| generated / `social_token_secrets` | encryption key version > 0 | v1 `token_secrets_table` | same | No historical invalid row |
| generated / `social_connected_accounts` | platform allowlist | v1 `connected_accounts_table` | same | No historical invalid row |
| generated / `social_connected_accounts` | status in pending/connected/needs_attention/revoked/disconnected | v1 `connected_accounts_table` | same | Object fixtures cover some valid statuses only |
| generated / `social_connected_accounts` | `jsonb_typeof(granted_scopes)='array'` | v1 `connected_accounts_table` | same | Valid object fixtures only |
| generated / `social_connected_accounts` | `schema_version=1` | v1 `connected_accounts_table` | same | No historical invalid row |
| generated / `social_publishing_destinations` | capabilities is array | v1 `destinations_table` | same | Valid projected objects only |
| generated / `social_publishing_destinations` | status in active/unavailable/unauthorized | v1 `destinations_table` | same | Valid mocked destination only |
| generated / `social_oauth_attempts` | platform allowlist | v1 `oauth_attempts_table` | same | Optional fixture inserts valid LinkedIn |
| generated or existing named return check / `social_oauth_attempts` | `return_path='/'` | v1 table creation; v2 `oauth_return_path_constraint` for conditional add | Yes on add if any noncanonical row remains; supplied rows cannot | Optional PostgreSQL fixture covers one `/settings` legacy row, but only if configured |
| generated / `social_oauth_attempts` | `expires_at>created_at` | v1 `oauth_attempts_table` | Existing table is not altered, so no validation at v2 | Optional fixture includes one valid expiry only |
| `social_oauth_attempts_last_confirmed_phase_check` / `social_oauth_attempts` | null or callback allowlist | v2 **`oauth_return_path_constraint`** | **Yes. `state_received` written by the production start path is excluded. This is the proven matching source.** | No real fixture with `state_received`; source assertion checks only that the constraint name exists |
| generated / `social_publish_jobs` | content snapshot ≤ 65536 octets | v1 `publish_jobs_table` | Fresh-table semantics as above | No historical invalid row |
| generated / `social_publish_jobs` | delivery mode allowlist | v1 `publish_jobs_table` | same | No historical row |
| generated / `social_publish_jobs` | status allowlist | v1 `publish_jobs_table` | same | No historical row |
| generated / `social_publish_jobs` | attempt count ≥ 0 | v1 `publish_jobs_table` | same | No historical row |
| generated / `social_publish_jobs` | `schema_version=1` | v1 `publish_jobs_table` | same | No historical row |
| generated / `social_provider_attempts` | adapter platform allowlist | v1 `provider_attempts_table` | same | No historical row |
| generated / `social_provider_attempts` | attempt number > 0 | v1 `provider_attempts_table` | same | No historical row |
| generated / `social_provider_attempts` | status allowlist | v1 `provider_attempts_table` | same | No historical row |
| generated / `social_external_posts` | platform allowlist | v1 `external_posts_table` | same | No historical row |
| generated / `social_external_posts` | delivery-state allowlist | v1 `external_posts_table` | same | No historical row |
| generated / `social_external_posts` | deletion-state allowlist | v1 `external_posts_table` | same | No historical row |
| generated / `social_external_posts` | `schema_version=1` | v1 `external_posts_table` | same | No historical row |
| generated / `social_connector_schema_version` | singleton must be true | all versions, `schema_version_read` table creation | Fresh-table creation cannot violate; later insert uses true | Optional fixture uses true only |
| generated / `social_connector_schema_version` | version ≥ 0 | all versions, `schema_version_read` table creation / `schema_version_write` DML | The write uses 3; an existing table's check is not recreated | Optional fixture uses valid versions |

Therefore `oauth_return_path_constraint` cannot label failures from expiry, platform, connected-account status, destination status, OAuth expiry, or schema-version checks in current source. Their statements have distinct categories (or are not touched for an existing table). It **can and does ambiguously label** either the return-path add or the last-confirmed-phase add. The evidence selects the latter. Constraints in unrelated tables are not executed under that category.

## 5. Deployment consistency

A safe unauthenticated `GET https://funklix.vercel.app/` was attempted without cookies, authentication, OAuth, or private API access. The environment's outbound CONNECT tunnel returned `403 Forbidden` from an intermediary (`server: envoy`) before public HTML was received. A second read-only fetch facility returned `401 Unauthorized` before page retrieval. Consequently no application response headers, HTML, script references, cache markers, or BW-32.2.6 public artifact marker were accessible.

Deployment consistency remains **unproven**: this audit cannot establish the production alias generation, whether its public/browser artifact contains BW-32.2.6, or whether an older serverless route remains active. The supplied diagnostic includes the categories introduced by BW-32.2.6 and is therefore evidence that at least the serving Settings route contains that diagnostic vocabulary, but it is not an immutable build identifier and does not prove byte-for-byte parity with `f071815`.

No deployment investigation is transferred to the user. BW-32.2.9 should emit a non-secret immutable build identifier automatically beside the bounded server diagnostic and reject/flag an initialization result whose migration implementation identifier differs from the expected deployment identifier.

## 6. Why manual normalization did not recover production

### 1 — Phase-check validation fails on `state_received` (high confidence; repository-proven)

- **Supporting evidence:** the start service inserts `state_received`; the v2 phase constraint excludes it; the phase constraint add shares `oauth_return_path_constraint`; PostgreSQL `ADD CHECK` validates existing rows and can raise `23514`; the supplied database has two OAuth rows; repeated rollback explains `committed_state_category: unchanged` and repeat failures.
- **Contradicting evidence:** the supplied inspection did not report `last_confirmed_phase` values or presence/definition of the phase constraint. That missing observation is not needed to expose the code contradiction, but it prevents attributing the specific production row without a deployed statement-level diagnostic.
- **Confidence:** high. This is an internally sufficient failure path in the merged source and exactly matches the category/code while respecting all confirmed return-path facts.
- **Automatic proof/rejection:** give the phase discovery/add unique categories and, before alteration, record only aggregate counts grouped into `null`, `allowed`, and `disallowed` (never phase contents or row data). Attach the actual PostgreSQL `constraint_name` field through a strict allowlist. A dry classification followed by the narrowly repaired add makes the next request conclusive.

### 2 — Production targets another database/schema through external `POSTGRES_URL` or `search_path` (low-to-medium confidence; possible, not evidenced)

- **Supporting evidence:** target and PostgreSQL defaults are external; all names are unqualified; the repository cannot bind production to the inspected Supabase target.
- **Contradicting evidence:** every production Social Connector route shares one pool and only `POSTGRES_URL`; no alternative connection path exists. More importantly, the phase-check defect explains the observed failure even in the inspected database.
- **Confidence:** low-to-medium as a contributing uncertainty, low as the necessary cause.
- **Automatic proof/rejection:** include the keyed database-identity digest, `current_schema` classification (`public`/`other` only), and boolean presence of each expected object specifically in `public`, all captured on the failing migration client.

### 3 — Deployed/stale generation differs from merged source (low confidence; unproven)

- **Supporting evidence:** network restrictions prevented artifact inspection; source has no build marker in this diagnostic; warm processes cache module code, pool configuration, and successful initialization per process.
- **Contradicting evidence:** the supplied operation/error vocabulary matches BW-32.2.6, and current source itself contains the matching bug. A warm instance cannot silently change its already-created pool to new configuration, but no repository evidence shows cross-generation routing occurred.
- **Confidence:** low.
- **Automatic proof/rejection:** return a safe immutable build/migration implementation ID with diagnostics and compare it server-side to the expected deployed generation; never rely on browser caches or a user comparison.

### Explanations rejected by repository evidence

- **Formatted return-check incompatibility:** rejected for the confirmed definition because it matches the current regex and is retained.
- **A duplicate return-check add:** rejected for current source and the confirmed named constraint; the add condition is false.
- **Return backfill violating the canonical return check:** rejected because setting `/` satisfies it, the backfill has a different category, and supplied rows need no update.
- **Expiry/platform/status/destination/schema-version check mislabeled as return-path:** rejected by the per-call categories. Only the phase check is mislabeled with the return category.
- **Multiple application pools:** rejected within reviewed production paths; injection-only test seams are not used by entrypoints.

## 7. One conclusive BW-32.2.9 recovery implementation

Implement one narrow schema-initialization correction, not another Social Connector rewrite:

1. Make `_boards-storage.js` the sole initialization owner and keep its one pool; pass that pool/client explicitly rather than retaining fallback pool lookup paths.
2. On one acquired client, set or verify the intended schema and schema-qualify all migration catalog targets and objects as `public.social_*` and `public.social_connector_schema_version`. Report only `current_schema = public|other` and expected-object presence booleans.
3. Add exact statement categories: `oauth_return_check_discovery`, `oauth_return_check_drop`, `oauth_return_check_add`, `oauth_phase_check_discovery`, `oauth_phase_check_classify`, and `oauth_phase_check_add`. Preserve the failing statement category and allowlisted PostgreSQL constraint name through rollback.
4. Replace formatted-definition regex decisions with semantic catalog checks: correct relation namespace/OID, `contype='c'`, `convalidated`, and a canonical expression identity (for example a controlled catalog expression fingerprint), not raw whitespace/casts. A confirmed validated semantic return check is skipped.
5. Repair **only** the proven phase mismatch: define the legitimate lifecycle domain consistently by including the production-written `state_received` value (and the existing callback phase set), classify historical values, and avoid dropping a validated compatible phase check. If unexpected values exist, do not broad-normalize them; report an aggregate incompatible-phase classification and stop safely.
6. Write version 3 only after every v2/v3 statement succeeds and commit completes. Report separately `target_schema_version=3`, the actually read committed version, and the post-commit version; remove the misleading hard-coded interpretation.
7. Emit the keyed database-identity digest and immutable build/migration implementation ID. Use these automatically to distinguish a different target/schema or stale generation on the next deployed request.
8. Add a mandatory real-PostgreSQL upgrade fixture containing both canonical return paths and `last_confirmed_phase='state_received'`, the confirmed casted validated return constraint, and a version below 2. Assert exact categories, compatible-return-check skip, phase-check success, version commit, repeat behavior, and concurrent cold-pool behavior.

This scope makes the next request conclusive: success proves the actual defect repaired; failure names the exact statement/constraint, target identity digest, schema classification, committed version, and build generation without exposing credentials or requiring infrastructure inspection.

## 8. Test realism audit

Previous green checks did not establish production migration compatibility:

- **Source assertions:** BW-32.2.2 checks that migration source contains the return backfill and phase constraint name. It does not execute that constraint or compare the service's `state_received` write to its allowlist.
- **Mocked storage:** BW-32.1, BW-32.2.1, BW-32.2.2, BW-32.2.3, and Settings behavior checks rely substantially on injected pools, object rows, route-module cache fixtures, or minimal DOM/fetch substitutes. These validate contracts and UI truthfulness, not PostgreSQL DDL against historical rows.
- **Optional PostgreSQL fixture:** BW-32.2.6 runs real PostgreSQL only when `BW326_DATABASE_URL` is set. Without it, the command explicitly reports that integration was skipped and passes only deterministic source/contract assertions.
- **Fixture gap even when executed:** its legacy row has `/settings` and a null `last_confirmed_phase`; it exercises the return-path backfill but not the actual production-shaped `state_received` row. It therefore would not expose the phase allowlist contradiction even on PostgreSQL.
- **Local Runtime Boot Safety:** Node syntax and browser-script-integrity checks detect parse/load-order contracts in local files. They neither invoke Vercel functions nor connect to production PostgreSQL.
- **Deployed serverless execution:** none of the listed local commands proves which artifact/instance served production, its environment selection, module/pool cache lifetime, or its effective `search_path`.
- **Production database migration:** no check in the required suite runs the migration on production, and it should not. The intended real-PostgreSQL upgrade simulation was optional and lacked the decisive historical phase row.

Accordingly, claims of clean/repeat/concurrent migration, historical-row compatibility, correct check attribution, and schema-version advancement were unsupported in the environment where the mandatory real PostgreSQL test was unavailable. Even where PostgreSQL was available, compatibility with actual `state_received` attempts remained unsupported because that row shape was absent.

## 9. Go/no-go decision

**GO for BW-32.2.9 with the proven recovery scope.**

The recovery is bounded to the demonstrated phase-domain mismatch plus diagnostic precision needed to automatically settle the remaining deployment/identity uncertainties. No further return-path migration or broad connector rewrite is justified.
