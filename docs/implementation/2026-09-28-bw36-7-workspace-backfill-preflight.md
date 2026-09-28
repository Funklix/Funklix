# BW-36.7 — production-safe Workspace backfill preflight

**Status:** ready for one manual production execution after merge and deployment. This phase adds a read-only evidence query and a deterministic source regression. It contains no backfill, migration, application behavior, or UI change.

## Purpose and fixed strategy

BW-36.6 is already deployed. Before BW-36.8 writes anything, the preflight measures the deployed ownership, association, collaboration, public-access, and unexpected-adoption shapes needed by Option C: one deterministic default Workspace per safe primary owner; Brands assigned by primary owner; branded Boards inherited through Brand; and unbranded Boards assigned through a safe owner or quarantined. Existing Brand grants, Board ownership/shares, snapshots, and public-link state remain distinct and must be preserved.

The query is deliberately stored at `scripts/sql/bw36-7-workspace-backfill-preflight.sql`, outside `migrations/`. It must never be put into a migration runner or application boot path.

## Safety and privacy boundary

The SQL consists of one `WITH ... SELECT` statement. It uses read-only catalog inspection, joins, grouping, existence tests, and aggregate counts. It starts no transaction; creates no object; invokes no mutating function or dynamic SQL; and performs no insert, update, delete, privilege, RLS, policy, trigger, or grant change. The regression strips comments and quoted literals before rejecting mutation/DDL/procedural keywords.

The output is a fixed five-column table: `category`, `check_name`, `status`, `record_count`, and static `notes`. It returns no UUID, user/owner identity, name, email, public token, provider record, content JSON, Canvas payload, Brand profile, Board content, or raw policy definition. Email columns are used only inside equality/grouping and authenticated-identity resolution; values never reach the projection. Snapshot JSON is not traversed: only SQL nullness is tested. Public token material is not selected: only the boolean access state is counted. No provider, AI, browser state, local preference, remote extension, or network service is consulted.

## Result categories

Rows appear deterministically in this order:

1. **schema** — BW-36.6 tables, columns, RLS flags, helper/guard, and indexes;
2. **adoption state** — existing Workspace rows/memberships and non-null object references;
3. **brands** — ownership, identity resolution, member, duplicate, and lifecycle inventory;
4. **boards** — ownership, Brand resolution, snapshot, sharing, public access, and mismatch inventory;
5. **memberships/access** — bounded aggregate access-preservation baselines;
6. **migration risks** — cross-owner, access expansion/loss, invalid identity, and automatic-backfill risks;
7. **projected backfill** — projected Workspace/membership/assignment/quarantine totals only;
8. **final readiness** — one aggregate decision row.

All counts are numeric and bounded by the number of fixed checks. Status has exactly four values:

* `ok`: the safety condition is satisfied; final `ok` is the READY equivalent.
* `info`: inventory/baseline evidence, not by itself a warning.
* `review`: a non-blocking irregularity or legitimate relationship needs human treatment; final `review` is REVIEW.
* `blocked`: the shape makes a fully automatic backfill unsafe; final `blocked` is BLOCKED.

## Expected adoption state and blockers

The expected **zero adoption** state is zero `workspaces`, zero `workspace_memberships`, and zero non-null Brand or Board `workspace_id` values. A nonzero value is marked `review`, not hidden or destructively corrected. It may represent deliberate prior adoption and must be reconciled before BW-36.8.

Missing BW-36.6 schema/RLS/helper/guard/index foundations are blockers. Data blockers include missing or ambiguous authenticated owner authority, missing Brand associations, invalid membership/collaborator identities, duplicate normalized Brand membership shapes, and conservative Brand/Board quarantine records. Owner differences and unbranded/snapshot-only records are surfaced for review because they require explicit preservation or deterministic treatment. `records_preventing_automatic_backfill` and `total_blocking_anomalies` summarize the conservative blockers; the final row also considers unexpected adoption and review-only Board shapes.

## Exact manual execution procedure

1. Merge and deploy this repository change.
2. Open the correct authenticated Supabase project and verify its project identity/environment.
3. In the deployed repository, open `scripts/sql/bw36-7-workspace-backfill-preflight.sql`.
4. Use **GitHub Raw** and copy the entire file without modification.
5. Open a **new** Supabase SQL Editor query and paste the entire file.
6. Before running, verify the pasted query contains only read-only CTEs/SELECTs and ends with the bounded projection and deterministic `ORDER BY`.
7. Run it once.
8. Copy or screenshot the complete result table, including every category and the final readiness row, into the restricted implementation review record.
9. **Do not edit production data.** Do not run a fix, migration, or partial backfill from the Editor.
10. Do not proceed to backfill until the complete aggregate result is reviewed and explicitly accepted.

If the file differs from the reviewed commit, the schema foundation is missing, the result is incomplete, or any result is `blocked`, stop. A `review` result requires documented disposition; it is not permission to infer ownership.

## How this informs BW-36.8

BW-36.8 will use the projected owner population to define deterministic Workspace keys, the minimal visibility count to design deduplicated membership insertion, and quarantine counts to decide whether the migration may run automatically or must include recovery handling. Owner mismatch, Board-only collaborator, and public-token baselines define explicit exceptions: Workspace visibility cannot become Brand access; Board-only access cannot become catalog access; anonymous public access remains outside Workspace catalogs.

These aggregates are necessary but **not sufficient** for final migration verification. Aggregate equality can hide swapped or incorrectly assigned records. The later idempotent backfill must use row-level transaction logic internally, lock/revalidate authority and relationships, preserve each existing access edge, and return only bounded aggregate results. It must also compare pre/post aggregate baselines without exposing identities or payloads.

## Why there is no backfill here

Production shapes were intentionally unknown before this evidence pass. Combining discovery and mutation would prevent safe review and could assign ambiguous owners or expand access. Therefore BW-36.7 performs zero writes and does not add or alter anything under `migrations/`. BW-36.8 is a separately reviewed phase after the captured evidence is accepted.

## Verification and limitations

The focused regression proves the checked-in SQL's lexical and source contract, expected check inventory, bounded projection/statuses, unchanged BW-36.6 and BW-36.4 baselines, tracked-files-only behavior, and Runtime Boot Safety registration. It makes zero database, provider, AI, or network requests. The current UI remains unchanged.

Repository checks cannot prove deployed row counts, schema drift outside the inspected contract, query runtime on production volume, or semantic correctness of stored identity data. Only the authorized manual execution supplies that evidence. The query assumes the repository-proven `brands`, `brand_members`, `boards`, and `board_editors` tables and exact current columns are deployed; PostgreSQL cannot conditionally reference an absent relation in static SQL without dynamic SQL, which this safety boundary forbids. If a required relation is absent, execution must stop and schema parity must be resolved rather than weakening the query.
