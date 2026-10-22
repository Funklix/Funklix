# BW-36.23A runtime role verification fix

Base: main `7591d3ebf770405a7f32d7e0b5894f267dac7265`, including #806 and #807.
Review only; no production SQL execution, deployment, or merge.

## Root cause

The protection migration's final `DO $verify$` recursively joined
`pg_auth_members.roleid` to the previous role and selected `member`, without
checking membership options. Thus an operator ADMIN row from
`brand_knowledge_runtime` to `postgres` placed `postgres` in the runtime closure.
The same happens indirectly through an operator membership in `tendra_app_runtime`.
The existing elevated-role/ownership checks then correctly identified the operator
as powerful, but applied a runtime restriction to an administrative identity.

PostgreSQL 16+ supports per-membership INHERIT, SET and ADMIN options. A role
creator with CREATEROLE can receive automatic ADMIN TRUE / INHERIT FALSE /
SET FALSE membership; these rows do not confer inherited or SET ROLE capability.
An explicit equivalent row reproduces the exact production P0001 error on both
specified versions, using the actual `postgres` role with NOSUPERUSER, BYPASSRLS,
CREATEROLE and CREATEDB, plus explicit owner SET authority. A separate disposable
bootstrap administrator permits restoring fixture roles after each check. The
Runtime Boot Safety service uses that same setup because PostgreSQL does not
allow demoting the bootstrap superuser. The supplied production facts did not include a complete
`pg_auth_members` dump: the exact incoming operator edge in production must be
confirmed from that catalog, not inferred merely from the error. Owner SET
membership alone cannot put postgres into the runtime closure.

Do not substitute `pg_has_role(postgres, runtime, 'USAGE')` for traversal: a
superuser has implicit authority even without a catalog membership. Do not
exclude postgres by name or exclude all elevated roles. An operator with an
actual INHERIT or SET path into runtime must still fail.

## Changes

Protection installation and standalone verification traverse explicit INHERIT
or SET edges down to runtime members, then up to every capability-reachable
ancestor. The union deliberately rejects mixed INHERIT/SET paths conservatively;
ADMIN-only edges do not convey capabilities. Only owner-authorized operators
may hold inert incoming ADMIN rows; untrusted ADMIN holders and outgoing runtime
ADMIN rights fail closed in protection verification too. Every resulting role undergoes the
existing elevated attribute, owner membership, protected table/column and schema
privilege checks. Ancestors matter: SET into another role must not evade checks
just because its grants are not inherited in the login's current identity.

The companion verifier now raises on unsafe runtime privileges, catalog drift
and missing exact history instead of only printing diagnostic booleans. Protection
now explicitly requires PostgreSQL 16+, where these membership options exist.

R3's preflight, embedded verifier and standalone verifier previously rejected all
extra memberships, including inert creator ADMIN rows. They still require the
exact application membership (INHERIT TRUE, SET FALSE, ADMIN FALSE) and reject
all other runtime membership edges, with one narrowly defined administrative
case: incoming ADMIN TRUE / INHERIT FALSE / SET FALSE rows belonging to an
operator with an explicit all-SET catalog path to `brand_knowledge_owner`.
Implicit superuser authority is insufficient for this exception. An untrusted
ADMIN-only member, runtime ADMIN membership in another role, extra capability
member, or runtime owner path remains rejected. No role/grant setup is added to
production SQL. RLS, history, function bodies and ACLs are unchanged.

## Validation

Local final validation passed on both PostgreSQL versions:

| Suite | Fresh groups | Legacy upgrade groups |
| --- | ---: | ---: |
| Protection | 68 | 74 |
| R3 including role graph and NOSUPERUSER postgres chain | 47 | 56 |

The restrictive graph without incoming administrative memberships also passed
45 R3 groups on each version.

The 15 contract/controller groups and `git diff --check` also passed. GitHub
Runtime Boot Safety is required on the pushed PR commit; its final status is
reported in the PR.

The existing Runtime Boot Safety matrix executes the extended R3 suite on
PostgreSQL 17.6 and 18.4, fresh and completed pre-805 installations. The suite
runs Protection install → Protection verify → R3 install → R3 verify → Protection
verify, reruns both migrations, verifies actual runtime password connections,
checks atomic failures and preserves policies/history. New fixtures retain the
original verification block and reproduce the exact P0001 with full transaction
rollback before installing the fix.

Negative graph tests exercise operator INHERIT/SET paths into runtime, operator
inheritance of the runtime login, transitive elevated members, runtime SET into an
elevated ancestor or schema creator, direct and transitive owner paths, untrusted
ADMIN-only memberships, outgoing runtime ADMIN and changed SET options. Both
installers and both verifiers reject capability escalation. Existing real
runtime probes deny direct Brand writes, history reads/writes, TRUNCATE, owner
SET, capability SET and schema DDL, while protected writes and history receipts
continue to work. Brand SELECT remains the existing intentional server read.

The temporary maintenance gate from #807 remains unchanged. This PR is not
production execution approval; migration operators must retain the documented
maintenance and drain procedure.
