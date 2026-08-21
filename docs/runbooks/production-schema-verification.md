# Production schema verification (BW-15)

## Purpose and authorization

This runbook covers a **manual, sanitized, read-only PostgreSQL metadata inspection** for the repository-managed `brands`, `boards`, and `board_editors` tables. It compares an authorized target with the normalized contract in `scripts/inspect-production-db-readiness.js`. It neither proves that a target is production nor declares it ready.

Run it only when authorized to connect to the configured target and view its metadata. `POSTGRES_URL` must already be supplied by the approved environment/secret mechanism. Do not paste a connection URL into a command or shell history, and do not send it to another person. The command never changes environment variables.

## Safety guarantees

The command is not an API, boot hook, migration, repair, deployment, or scheduled CI production job. It uses a dedicated short-lived `pg` client, a five-second connection timeout, `BEGIN READ ONLY`, transaction-local eight-second statement and two-second lock timeouts, and verifies `transaction_read_only` before inspection. Fixed registry queries inspect catalog/information-schema metadata only. Success and failure both attempt `ROLLBACK`; the command never commits. The client is closed in `finally`.

The allowlist cannot be supplied by an operator. There is no arbitrary SQL, schema, table, debug, or output-file option. No application rows, row counts, Canvas/Brand Core JSON, recovery snapshots, names, emails, user IDs, application timestamps, sessions, presence, OAuth material, secrets, unrelated schemas/tables, backup state, or public endpoint is inspected.

Errors suppress raw messages, SQL, parameters, URLs, and stack traces. Database roles are deterministically replaced with `role_N`. Policy string and numeric literals are redacted. Search-path entries other than the expected `public` schema are redacted.

## Invocation

Help does not read `POSTGRES_URL` or connect:

```sh
node scripts/inspect-production-db-readiness.js --help
```

After the approved environment has already configured its credential:

```sh
node scripts/inspect-production-db-readiness.js --environment production --acknowledge-read-only
```

`--environment` accepts a 1–64 character non-secret label (`A-Z`, `a-z`, digits, `.`, `_`, `-`). The label is supplied by a human and **is not proof of database identity**. `--acknowledge-read-only` is mandatory. Optional flags are `--json`, `--pretty` (JSON indentation), and `--strict` (drift exits nonzero). Unknown flags are rejected.

The connection fingerprint is a truncated SHA-256 digest computed locally from normalized target components with password and query parameters excluded. Only the digest is emitted. Equal fingerprints support a “same configured target” comparison between authorized runs; they do not establish production identity, environment separation, deployed commit, data correctness, or authenticity. Investigate a changed fingerprint through approved operations channels—never by disclosing target components.

## Report and interpretation

Both formats include command version, timestamp, environment label, local commit when available, fingerprint, confirmed read-only state, PostgreSQL version, allowlisted tables, schema comparisons, constraints, indexes, pseudonymized ownership, grants, RLS/policies, current-role and metadata-indicated DDL capabilities, unknowns, warnings, and final status. Capability facts are inferred from metadata; no DDL operation is tested. RLS and grants are observations because the repository has no approved target policy.

Object classifications are `verified`, `missing`, `different`, `unexpected`, and `unavailable`. Unexpected objects are considered only inside allowlisted tables and inspected categories. Final statuses are:

- `verified_match`: required metadata was obtained and the repository contract matched.
- `verified_drift`: required metadata was obtained and material contract drift was found.
- `partial`: a required metadata permission was unavailable; do not treat partial claims as verification.
- `unavailable`: inspection could not establish availability (reserved report status).
- `failed_safe`: connection, transaction, read-only proof, query, sanitizer, rollback, or close processing failed safely.

### Exit codes

- `0`: `verified_match`, or non-strict `verified_drift`.
- `1`: `failed_safe`/operational failure.
- `2`: `verified_drift` with `--strict`.
- `3`: invocation, acknowledgement, configuration, or malformed-URL error.
- `4`: `partial` due to unavailable required metadata permission.

For drift, do not run repair SQL. Have schema owners compare each finding with current source, authorize a separate migration package, and validate it through normal change control. For partial results, request only the minimum metadata visibility necessary and rerun after authorization; do not broaden application privileges merely to make this report pass.

## Retention and contract maintenance

Output goes only to stdout/stderr; the command creates no file. If organizational policy requires retention, redirect through an approved secure process, apply access controls and retention/deletion policy, and re-review the already-sanitized output. **Inspection results must not be committed.**

Future schema packages affecting these three tables must update the normalized `EXPECTED_SCHEMA` contract and BW-15 fixtures in the same change. This command performs no migration or repair, does not verify backups/PITR or deployed application identity, and does not modify a database, environment, authorization rule, deployment, or production data.
