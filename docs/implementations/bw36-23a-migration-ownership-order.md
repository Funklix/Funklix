# BW-36.23A migration ownership ordering

Base: main at 74503b9, including merged #804. No production SQL, Supabase
connection, deployment or merge is part of this change.

## Reproduced failure and fixture correction

The premature transfer followed by
`ALTER TABLE public.brand_knowledge_history ENABLE ROW LEVEL SECURITY` reproduces
SQLSTATE **42501**, **must be owner of table brand_knowledge_history**, on exact
PostgreSQL 17.6 and 18.4. The regression moves the transfer to its former position
and executes through that statement, then checks the complete rollback snapshot.
The earlier schema CREATE 42501 regression remains covered separately.

The old fixture explicitly granted owner INHERIT TRUE, which let the operator
retain table-owner privileges after transferring ownership and masked this error.
The fixture now uses a real password LOGIN with NOSUPERUSER/NOBYPASSRLS, inherited
legacy object/database/schema authority, and owner membership with INHERIT FALSE,
SET TRUE, ADMIN FALSE. It asserts both SET ability and absence of inherited owner
privileges. The receiving owner is NOLOGIN and initially lacks public CREATE;
history is absent before installation. The operator name is randomized; inheriting
the fixture's postgres role does not inherit its superuser attribute. This models
SET authority without assuming unreported production inheritance or private ACLs.

## Changed SQL and ownership audit

In `20261020_bw36_23_brand_knowledge_protection.sql`:

- Former lines 92–100 transferred history before RLS and baseline capture. The
  final transfer now occurs in `$history_owner$` near the end, after all history
  comment/RLS/baseline/trigger/ACL work. Conditional public CREATE remains borrowed
  only for that transfer and is immediately revoked if newly granted.
- `$history_ddl_role$` uses the existing table owner for verified exact reruns;
  fresh installs keep their table-owning operator through history DDL. No reverse
  transfer or new role membership is needed.
- `$triggers$` creates the existing guards on fresh installations before transfer.
  Reruns retain triggers already proven by the fingerprint, avoiding unnecessary
  DROP/CREATE and private-helper EXECUTE grants to the operator.
- Private schema ACL changes and private function definitions/ACLs use explicit
  owner role scopes. All functions are created by their intended NOLOGIN owner,
  replacing four early ALTER FUNCTION transfers and preventing later function ACL
  operations from depending on inherited ownership. Function bodies, SECURITY
  DEFINER flags, search paths and the runtime's four approved entry points remain
  unchanged. Helpers remain invoker functions.
- Trigger name resolution borrows private-schema USAGE for the operator only if
  absent; transaction-local bookkeeping removes exactly that borrowed grant.
  CREATE on the private schema is never granted to the operator.
- `$close_grants$` revokes history grants with the table's current owner and
  function grants with the private function owner. Legacy table grants and policy
  creation remain with the existing legacy table operator.
- Fingerprint/schema COMMENT and final history verification execute explicitly
  as owner after the final transfer. RESET ROLE precedes COMMIT.

The original verifier now runs its history/fingerprint reads in a read-only owner
scope, resets to the operator for its privilege report, and commits. The full file
is operator-only; it is not an application-login verifier.

R3's existing helper schema and function ownership design remains intact. Its
fingerprint preflight and lock-helper preflight now explicitly SET the owner.
The embedded and standalone R3 verifier use an owner scope only for a caller that
already has SET authority, restore its original role before returning, and leave
the application login in its own identity. Their checks still evaluate the exact
runtime roles, memberships, grants, function bodies and policies. Runtime cannot
use this branch to acquire owner privileges.

No Brand Core values, baseline contract, RLS policy definitions, history
constraints, guard bodies or runtime grant matrix changed. No manual production
GRANT/ALTER workaround or new versioned migration was added.

## Complete-chain validation

Both existing PostgreSQL suites run the fixed original migration and its complete
companion verifier through the SET-only operator. The R3 suite then executes R3,
its complete verifier, and the original verifier again through that same operator.
Fresh installs, exact reruns, existing direct CREATE WITH GRANT OPTION and inherited
CREATE preservation, canonical values/baselines, runtime denials and original
browser deny policies are covered.

| PostgreSQL | Protection suite | Complete-chain/R3 suite |
| --- | --- | --- |
| 17.6 (Debian 17.6-2.pgdg13+1) | 68 groups passed | 32 groups passed |
| 18.4 (Debian 18.4-1.pgdg13+1) | 68 groups passed | 32 groups passed |

The fixture asserts final history owner/RLS, all private function owners, zero
borrowed operator private USAGE/CREATE, and no new owner public CREATE. Existing
suites deny runtime ownership, owner SET, direct Brand writes, history reads/DML,
DDL and helper execution; actual runtime login and verifier also pass.

Injected errors cover the premature ownership error, failure immediately after
transfer while public CREATE is still borrowed, failure immediately before the
original COMMIT, and failure immediately before R3 COMMIT. After ROLLBACK, Brand
rows, namespace ACLs, relations/columns, policies, functions and triggers match
the prior snapshot. Role identity is restored. There are no exception handlers
that swallow a migration error or commit a partial installation.

Runtime Boot Safety retains the exact PostgreSQL 17.6/18.4 matrix and executes all
existing checks. Final local/Actions results are reported in the PR description.

## Production prerequisites

Actual Supabase inheritance/private ACLs beyond the previously confirmed owner
SET authority were not supplied or queried. The fix does not require owner
inheritance or pre-granted private-schema CREATE/USAGE for the operator. Existing
legacy table ownership/grant authority, database CREATE, owner SET and public
schema grant authority remain prerequisites. Confirm the failed transaction has
been rolled back and run the existing runbook preflights/verifiers before any
separately authorized installation. Existing backup, asset retention, runtime
credential/TLS identity, staging, writer-drain, signing/vault secret and activation
gates remain unchanged. This PR does not authorize production execution.
