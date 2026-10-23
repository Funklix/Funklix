# BW-36.23A R3 browser ACL migration fix

Base: latest main `d6503014dff99fb0316ba7da358394c6fd6e0b10`, including #809.
No production SQL execution, deployment or merge.

## Root cause

R3 installs server grants and checks effective browser privileges, but did not
remove obsolete browser ACLs. RLS policies and SQL privileges are independent:
a restrictive deny policy can deny rows while has_table_privilege still returns
true. The older BW-33.5 table cleanup omitted board_editors. It also only revoked
table grants, which does not remove separate pg_attribute.attacl column grants.

The reported error establishes effective authenticated privileges on
board_editors; it does not establish which ACL source or columns production has.
Production catalogs have not been accessed. The disposable reproduction seeds
authenticated SELECT/INSERT/UPDATE/DELETE on board_editors, plus SELECT(email),
UPDATE(role), REFERENCES(board_id), legacy SELECT/UPDATE policies and a
restrictive false deny. Removing only the new cleanup block reproduces exactly
P0001: BROWSER_PRIVILEGE_LEAK: authenticated board_editors and rolls back.

## Exact scope of change

Before runtime grants/policies, R3 enables RLS and executes REVOKE ALL PRIVILEGES
on each table and separately on every live column FROM PUBLIC, anon,
authenticated RESTRICT, on these 21 existing verifier-listed server-only tables:

- boards
- board_editors
- app_identities
- workspaces
- workspace_memberships
- brand_members
- project_commands
- brand_learnings
- brand_learning_events
- brand_documents
- brand_document_upload_intents
- brand_document_processing_jobs
- brand_document_processing_results
- social_token_secrets
- social_connected_accounts
- social_publishing_destinations
- social_oauth_attempts
- social_publish_jobs
- social_provider_attempts
- social_external_posts
- social_connector_schema_version

This removes direct table privileges (including grant options and the version's
ALL privileges) and SELECT/INSERT/UPDATE/REFERENCES column privileges, including
column grant options. PUBLIC privileges contribute to both browser roles.
No defaults, role memberships, service_role ACLs, brands/history ACLs, unrelated
relations or existing policies are changed. The original companion verifier and
backend session_user fence remain unchanged. Application runtime grants retain
their existing least-privilege command and column matrix.

After each cleanup, effective checks still run. Shared inherited privileges,
ownership and elevated browser authority abort with
UNREVIEWED_INHERITED_BROWSER_ACCESS, including owner and actual raw table/column
ACL sources, grantors and grant options. Shared role ACLs/memberships are never
silently edited. Dependent regrants abort under RESTRICT; no CASCADE is used.
These cases require a separately scoped decision based on actual catalog data.
The final original verifier continues to reject subsequent browser ACL drift.

## Atomicity and reruns

All DDL, RLS, ACL cleanup, function and policy creation and embedded verification
remain inside the existing BEGIN/COMMIT and advisory lock. A failure requires
ROLLBACK in that operator session and leaves the prior catalog intact. Revoking
an absent grant and enabling already-enabled RLS are idempotent. All four document
tables have RLS enabled before commit, verified even when they are newly created.
The generic SQL Editor create-table warning does not establish disabled RLS.

## Validation

The existing Runtime Boot Safety matrix runs PostgreSQL 17.6 and 18.4 with the
extended R3 fixtures for fresh, completed pre-805 and restrictive-role graphs.
It exercises Protection install → Protection verify → R3 install → R3 verify →
Protection verify, reruns, late injected rollback, actual runtime application
workflows, policy preservation and the existing unsafe identity/role tests.

Added fixtures reproduce the exact old failure, demonstrate column ACL survival,
seed table/column browser grants on all 21 tables (including PUBLIC and grant
options), preserve an unrelated ACL, reject shared inherited table/column grants
with source diagnostics and atomic rollback, reject dependent regrants, and verify
new document RLS before commit. Final CI results are recorded in the PR.
Production's precise grantor/column/inheritance inventory remains uninspected.
