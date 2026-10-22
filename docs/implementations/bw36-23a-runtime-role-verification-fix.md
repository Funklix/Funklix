# BW-36.23A runtime role verification fix

Base: main `7591d3ebf770405a7f32d7e0b5894f267dac7265`, including #806 and #807. No production SQL, deploy, merge, credentials or application/runtime grants changed.

## Root cause and reproduction

The final protection DO block walks `pg_auth_members` from `roleid` to `member`, recursively, without considering the membership options. An ADMIN TRUE, INHERIT FALSE, SET FALSE operator membership of `brand_knowledge_runtime` therefore adds `postgres` to the runtime closure. Its elevated attributes/effective ACLs then raise exactly `P0001: UNSAFE_RUNTIME_PRIVILEGES: postgres`. PostgreSQL 16+ can record such ADMIN-only grants for non-superuser role creators; membership existence is not proof of runtime privilege inheritance.

The supplied owner SET membership alone cannot introduce postgres into this downward closure. There must also be a direct or indirect membership path from the runtime group. The disposable reproduction runs through a NOSUPERUSER, BYPASSRLS, CREATEROLE, CREATEDB, REPLICATION operator with legacy object authority, and explicitly includes the ADMIN-only runtime-group membership and owner SET membership; it does not claim to have inspected the production catalog. The runbook's existing read-only membership query identifies the actual edges. If production instead has an INHERIT or SET runtime edge, rejection remains intentional and the operator must resolve that unsafe graph separately.

## Boundary

Only ADMIN-only edges held by elevated LOGIN operators (SUPERUSER or CREATEROLE), already able to SET the owner, are excluded from the capability closure. This describes existing operator authority. A superuser inherently has owner SET authority; a non-superuser must have a SET path. INHERIT or SET edges are always inspected regardless of the role name. Non-elevated or unauthorized ADMIN-only holders are rejected. Protection additionally rejects runtime membership in elevated upstream roles, including SET-only routes that do not change the runtime role's own catalog attributes.

Owner membership remains forbidden for runtime identities, including indirect, SET-only and ADMIN-only paths. R3 keeps its exact expected application edge (INHERIT TRUE, SET FALSE, ADMIN FALSE), with only the same administrative exception on the capability group. It permits no administrative members of the application login. No SQL membership/grant is added by either migration. No RLS, history trigger, function boundary, ACL, fingerprint or data protection is relaxed. Protection explicitly requires PostgreSQL 16+ because the verifier uses per-membership options.

The operator-only protection companion now executes the same failing DO verification as installation, rather than only displaying operator privileges. R3's embedded verifier and companion share the revised rule. Fixture assertions require both verifier copies to remain identical.

## Validation

Exact local engines: PostgreSQL 17.6 (Debian 17.6-2.pgdg13+1) and 18.4 (Debian 18.4-1.pgdg13+1), disposable localhost Docker clusters only.

Each engine passed:

| Graph/install mode | Protection suite | Full R3 suite |
| --- | ---: | ---: |
| Fresh, ADMIN-only operator | 82 groups | 46 groups |
| Completed pre-805 legacy upgrade | 88 groups | 55 groups |
| Restrictive graph, no operator ADMIN membership | 78 groups | 42 groups |

The R3 suite runs Protection install → Protection verify → R3 install → R3 verify → Protection verify, reruns both installers, and verifies through the real password runtime login. Tests reproduce the exact P0001 with the previous traversal and compare full catalogs/data plus membership rows after rollback. They exercise operator INHERIT/SET edges (postgres is rejected), an unauthorized ADMIN holder, a differently named authorized CREATEROLE/LOGIN operator, a Supabase-equivalent non-superuser operator, elevated downstream members and upstream roles, and direct/indirect owner paths. Existing suites cover transactional failure after ownership transfer and late install, history preservation, direct Brand/history/DDL/SET denial, application writes, RLS identity fences, concurrency, freeze rollback and browser restrictions.

Runtime Boot Safety runs the fresh and legacy cases in its PostgreSQL 17.6/18.4 matrix; this change adds the restrictive graph case. Full hosted workflow results are recorded in the PR. Contract/controller tests (15 groups) and diff whitespace checks also passed locally.

## Production limits

No production connection or catalog inspection was performed. No role memberships should be changed by copying fixture SQL. Review actual membership options privately before an approved migration attempt. Earlier failed BEGIN/COMMIT attempts are covered by rollback tests; they do not establish production catalog state. R3 remains uninstalled in production, and the #807 maintenance gate remains an operator-controlled prerequisite. This PR does not change the gate or authorize a cutover.
