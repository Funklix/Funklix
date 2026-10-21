# BW-36.23A protection migration ownership hotfix

Historical PR #804 evidence. Its operator fixture inherited owner privileges; that
masked the subsequent table-ownership failure for SET-only operators. See
[bw36-23a-migration-ownership-order.md](bw36-23a-migration-ownership-order.md) for
the superseding ordering fix and stricter complete-chain validation.

Base: main at 8ccc919, including merged #802 and #803. No production connection,
SQL execution, deployment or merge is part of this change.

## Failure and minimal repair

On PostgreSQL 17.6 and 18.4, a password-authenticated NOSUPERUSER/NOBYPASSRLS
operator with inherited legacy object/schema/database ownership and explicit SET
on the NOLOGIN `brand_knowledge_owner` reproduces `42501: permission denied for
schema public` when the original first migration transfers the newly created
history table. The history relation is absent at the start. The operator's test
name is randomized; its privileges model the production `postgres` operator.
Inheriting the fixture's `postgres` role does not inherit its superuser attribute.
The superuser connection only provisions and inspects disposable test fixtures.

Only the history ownership statement changes in the SQL. A DO block checks the
owner's effective CREATE privilege on public, grants it if absent, transfers the
table, and revokes only the grant it added. This runs inside the original
BEGIN/COMMIT and advisory lock. The privilege is removed immediately after the
transfer, before baseline capture or later installation steps. Direct CREATE with
GRANT OPTION and inherited CREATE are preserved without new ACL entries.
The existing intentional removal of PUBLIC/runtime CREATE is unchanged.

## Ownership and dependency review

- `public.brand_knowledge_history`: the sole transfer into public; needs this fix.
- Original `logo_receipt`, `write_brand`, `create_brand`, `lifecycle`: destination
  schema `brand_knowledge_private` is created AUTHORIZATION brand_knowledge_owner;
  schema ownership supplies CREATE. No temporary public CREATE is required.
- R3 `tendra_runtime_private.lock_brand`: its schema is already created
  AUTHORIZATION brand_knowledge_owner, owner drift is rejected, and creation runs
  under SET LOCAL ROLE. Its transfer is safe without public CREATE. No R3 SQL
  change is needed; fresh installation and reruns now run as the non-superuser.
- Schema creation still requires database CREATE and owner SET authority. The
  operator must own public or have authority to grant CREATE there, plus the
  existing legacy object/policy/grant authority. SET on the receiving role alone
  does not establish those prerequisites.

Brand Core values, baseline snapshots, history constraints/guards, function
bodies/search paths, fingerprints, policies, runtime membership and runtime DML
boundaries are unchanged by the SQL patch.

## Regression evidence

The shared fixture runs in both existing PostgreSQL suites, behind their existing
explicit disposable-localhost guards. It reconstructs the original ownership
statement and asserts SQLSTATE 42501 and the exact message. It compares Brand
rows, namespaces/ACLs, public relations/columns, policies, functions and triggers
after rollback. A second injected error immediately before COMMIT checks rollback
of a fully executed protection installation. R3 has a corresponding late failure
check for its schema, helper, grants and policies. Success, exact reruns, absence
of new owner CREATE, and direct/inherited privilege preservation are asserted.

- PostgreSQL 17.6: 65 protection groups and 28 R3 groups passed.
- PostgreSQL 18.4: 65 protection groups and 28 R3 groups passed.
- Runtime Boot Safety now has a fail-independent matrix using exact images
  postgres:17.6 and postgres:18.4, running both integration suites and all existing
  runtime checks on each version.

## Remaining production gates

No production privilege/catalog check was performed. Before any separately
authorized installation, verify operator schema-grant authority, database CREATE,
owner SET and legacy object privileges, rollback state after the failed attempt,
and all existing runbook preflight/backup/verifier requirements. Execute the
corrected original migration before R3. The existing restricted credential,
TLS/pooler identity, signing/vault secret, staging, writer-drain and activation
requirements remain in force. This PR neither provisions nor activates them.
