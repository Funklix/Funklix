# BW-36.23A completed-install fingerprint upgrade

Base: main at 588cb3c, including merged #805. Addresses the exact
[P1 review finding](https://github.com/Funklix/Funklix/pull/805#discussion_r4342353968):
“Switching to brand_knowledge_owner here therefore makes the fingerprint call
fail with permission denied for function install_fingerprint before the migration
can normalize ownership; the same assumption appears in the R3 preflight.”

## Fix

Both existing migrations now use the same transaction-local compatibility block.
Fresh installations skip it. Current installations validate their fingerprint as
the NOLOGIN owner. A completed legacy installation instead requires the operator
to own, or inherit ownership of, its installer-owned fingerprint. EXECUTE alone
is insufficient, and runtime/browser/service roles cannot be legacy owners.

The block temporarily borrows private-schema USAGE only if needed, validates the
stored fingerprint **as the authorized installer before any ownership change**,
and rejects unexpected owners or helper signatures. It transfers only the seven
known installer-owned helpers to brand_knowledge_owner, including the fingerprint.
The four SECURITY DEFINER entry points must already have their intended owner.
The same bodies, search paths and runtime EXECUTE boundaries remain in place.

After normalization, the new owner has implicit EXECUTE. The block removes any
borrowed operator USAGE, records the fingerprint of the normalized catalog as the
schema comment, and restores the operator identity. No broad EXECUTE grant,
SECURITY DEFINER change, new migration or permanent compatibility function is used.
All changes roll back with the surrounding migration transaction.

R3 can normalize the old completed layout without depending on a prior rerun of
the new protection migration. Its full legacy path reaches final verification in
an injected late-failure test, which then proves ownership/ACL/comment rollback.
The committed canonical test chain runs protection → protection verifier → R3 →
R3 verifier → protection verifier through the non-superuser SET-only operator.

## Evidence

The frozen SQL fixture `scripts/fixtures/bw36-23-pre805-protection.sql` is the exact
protection migration at 74503b90ea11cf9817c79e1491c48aa6ce331338, SHA-256
`2770f4324f330586e45b68e6513490688a016adca75d636d0aea019178d15d47`.
It executes completely in disposable databases to create the real legacy catalog;
its bytes are checked before use. Only historical installation uses the fixture
administrator. Every upgrade and verifier uses the real NOSUPERUSER password
LOGIN, owner membership INHERIT FALSE / SET TRUE / ADMIN FALSE, and NOLOGIN owner.

Both unpatched preflights reproduce PostgreSQL 42501:
`permission denied for function install_fingerprint`.

| PostgreSQL | Fresh protection / R3 | Completed-install upgrade protection / R3 |
| --- | --- | --- |
| 17.6 | 68 / 32 groups passed | 74 / 41 groups passed |
| 18.4 | 68 / 32 groups passed | 74 / 41 groups passed |

Coverage includes exact reruns, unchanged Brand/history rows and policies, current
owner/function/RLS checks, no borrowed schema privileges left behind, direct and
inherited public CREATE preservation, runtime write/history/owner denials, legacy
fingerprint drift, EXECUTE-only callers, unknown legacy helpers, and late failures
in both full migrations restoring the old owners, ACLs, schema marker and role.

Runtime Boot Safety now runs both fresh suites and both completed-install suites
in its existing exact PostgreSQL 17.6/18.4 matrix. Final local and Actions results
are recorded in the PR description. The migration compatibility blocks and R3's
embedded/standalone verifier were also checked for exact equality.

No production connection, SQL, credentials, deployment or merge is part of this
change. A legacy upgrade requires effective ownership of the prior installer's
functions in addition to owner SET and the existing schema/table prerequisites;
otherwise it fails closed with LEGACY_INSTALLER_OWNERSHIP_REQUIRED. Existing
backup, verifier, staging and activation gates remain unchanged.
