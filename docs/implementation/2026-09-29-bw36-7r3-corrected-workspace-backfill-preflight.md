# BW-36.7R3 corrected Workspace backfill preflight

## Purpose and evidence boundary

BW-36.7 joined stored email identities to `auth.users` and consequently reported 38 blockers. That was a false-positive identity-authority failure: Tendra One authenticates with a signed Google session and authorizes the application by `lower(trim(email))`; Supabase Auth is not the application identity authority. BW-36.7R1 subsequently found zero genuinely malformed, ambiguous, empty, ownerless, or unresolved identity records. Its production inventory established 6 Brands, 20 Boards (6 branded and 14 unbranded snapshot-only), 2 Brand owners, 5 Board owners, 1 Brand editor grant, 11 Board shares, 10 Board-only collaborators, one collaborator independently having Brand access, one public-token Board, and no missing Brand links or Board/Brand owner mismatches.

BW-36.7R2 added the private `app_identities` bridge: stable internal UUID `id`, normalized private `canonical_email`, lifecycle state, and Workspace foreign keys. It replaced `workspace_memberships.user_id` with `identity_id`, closed direct browser catalog access, and retained last-owner protection. Its migration was manually executed successfully (`Success. No rows returned`) with no guard error. The migration was designed to create no identity, Workspace, membership, or assignment rows; only this R3 query can measure the current post-migration adoption state. R3 neither repeats nor changes the historical BW-36.7 query.

## Corrected authority and Option C projection

R3 uses the repository rule `lower(btrim(email))`, corresponding to the signed-session `lower(trim(email))` authority. It never joins `auth.users` to resolve a person. Existing `app_identities.canonical_email` values are used only to count exact existing, missing, disabled, ambiguous, or conflicting mappings; no email or UUID leaves the query.

The approved Option C projection is:

* Create one deterministic default Workspace per **distinct safe primary owner**, across Brand and Board ownership—not one per Brand or Board. The same schema supports single- and multi-Brand Workspaces; later agency grouping or moves require an explicit product workflow.
* Identity eligibility is the union of distinct primary owners and distinct existing Brand members. A qualifying person is counted once. A Board share alone and anonymous public-token access never qualify.
* Create one accepted `owner` membership per projected Workspace. Add only a deduplicated least-privileged `viewer` membership needed to make an existing member's Brand discoverable. `brand_members` remains the Brand authorization authority; Workspace visibility does not expand Brand rights.
* Assign each safely owned Brand to its owner's default Workspace. Preserve all Brand grants.
* A branded Board inherits its associated Brand's Workspace. An unbranded Board uses its current owner's default Workspace. No association is inferred for an unbranded or snapshot-only Board, and its `brand_id` is not changed. Preserve all Board grants.
* Preserve Campaign Brand Snapshots byte-for-byte. Board-only collaborators remain Board-only. Public-token access remains an anonymous, bounded one-Board exception and creates neither an identity nor membership.

## Read-only and privacy boundaries

`scripts/sql/bw36-7r3-corrected-workspace-backfill-preflight.sql` is exactly one `WITH` statement ending in one ordered `SELECT`. It contains no mutation, DDL, privilege change, procedure call, dynamic execution, transaction control, lock, temporary object, UUID generation, sequence operation, or remote operation. It reads catalogs and application tables only.

The only returned columns are `category`, `check_name`, `status`, `record_count`, and `notes`. Values are aggregate counts and static notes. The result never exposes emails, UUIDs, people or object names, Workspace/Brand/Board names, tokens or hashes, Google subjects, sessions, avatars, content, snapshots, JSON, metadata, provider data, or raw policy/constraint definitions. Internal catalog inspection is reduced to boolean/count checks.

## Readiness and blocker accounting

The ordered result has eleven categories: `identity_bridge_schema`, `post_migration_state`, `source_identity_inventory`, `projected_application_identities`, `projected_workspaces`, `projected_memberships`, `projected_brand_assignments`, `projected_board_assignments`, `access_preservation`, `backfill_projection`, and `final_readiness`.

Statuses mean:

* `ok` — the individual invariant is satisfied. A final `ok` authorizes only preparation of a separately reviewed transactional backfill; it neither executes nor automatically approves BW-36.8.
* `info` — a neutral, typed aggregate projection or preserved baseline; it is not a blocker.
* `review` — valid data with a bounded product/migration decision requiring human review. Review counts are not silently treated as corrupt and are not added to genuine blockers unless another blocking invariant applies.
* `blocked` — schema drift, partial adoption, malformed/empty/ambiguous authority, a disabled/conflicting mapping, missing association/authority, assignment conflict, quarantine, access expansion, or access loss prevents automatic backfill.

`final_readiness.record_count` is derived from genuine blocking invariants, not the old 38 false positives and not a sum of review-only or overlapping relationship populations. Typed projections keep branded/unbranded Boards and owner/minimal-visibility memberships disjoint. Repeated ownership across multiple entities is normal. Any nonzero adoption count blocks the first automatic backfill pending explicit review without labeling existing rows corrupt. Zero quarantine, access expansion, and access loss are mandatory.

## Deployment and exact manual procedure

1. Merge and deploy BW-36.7R3.
2. Open the correct authenticated Supabase project.
3. Open `scripts/sql/bw36-7r3-corrected-workspace-backfill-preflight.sql`.
4. Copy the complete raw file without modification.
5. Paste it into a new Supabase SQL Editor query.
6. Verify it contains one read-only CTE/final-`SELECT` statement.
7. Execute it exactly once.
8. Capture the complete result table across all eleven categories.
9. Do not insert application identities.
10. Do not create Workspaces or memberships.
11. Do not update Brands or Boards.
12. Do not alter shares, snapshots, or public-token state.
13. Do not proceed to BW-36.8 until the result is reviewed and explicitly accepted.

Review must retain the entire ordered aggregate table, confirm every schema and zero-adoption check, reconcile each projection with the approved model, establish zero genuine blocking anomalies/quarantine/access expansion/access loss, and record explicit acceptance. Repository evidence and the successful R2 execution do not substitute for this live read-only result. Never use production credentials outside the authenticated project SQL Editor and never automate this manual query.

## Rollback

R3 deploys only documentation, a read-only SQL file, a local deterministic regression, and check registration. It has no database rollback because it changes no database state. Repository rollback is a revert of the focused R3 commit. A captured result is evidence only and can be discarded; rerunning requires a new, deliberate review because production state may have changed.

## Non-goals

R3 does not implement or approve BW-36.8; add a migration; create or reserve identities, UUIDs, Workspaces, or memberships; assign Brands or Boards; modify Brand/Board grants; infer Brand associations; touch snapshots or public tokens; change authentication, UI, application runtime, providers, or historical diagnostics; execute production SQL; or perform database, provider, AI, or network requests. A later backfill must be separately designed, transactional, reviewed, and authorized from accepted manual evidence.
