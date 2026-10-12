# BW-36.17R2 — Learning provenance migration recovery

Base: latest GitHub `main`, `097a14bccb23361ac117e8f17934ef2a913e0788` (merged R1). This phase adds recovery SQL, read-only verification, tests and deployment instructions. It activates no UI, API, provider, AI or Learning workflow; no BW-36.18 work is included. The original BW-36.17 and R1 migrations remain byte-identical.

## Failure and accepted production evidence

During manual R1 execution in Supabase SQL Editor, the operator accepted the editor's prompt to enable Row Level Security. The transaction-local `CREATE TEMP TABLE bw36_17r1_preservation ON COMMIT DROP` did not survive to the final preservation block. The reported error was:

```
ERROR: 42P01: relation "bw36_17r1_preservation" does not exist
```

The implementation verifies the PostgreSQL failure mechanism in a disposable database: execute the first part through temporary baseline creation, commit, then execute the remainder. The commit drops the baseline; the last block fails with exactly `42P01`, while the intervening DDL has already applied. This reproduces the supplied schema outcome. It does not claim independent access to Supabase editor internals or production logs. R1's explicit transaction would preserve the table if submitted and executed as one uninterrupted transaction; a baseline stored in a separate SQL statement is unsafe for the documented editor workflow when the client introduces transaction boundaries.

The following production evidence was supplied by the operator, not obtained by Codex:

| Diagnostic | Accepted result |
| --- | --- |
| provenance_columns | 3 |
| source_board_fk_count | 0 |
| expanded_event_check_count | 1 |
| lifecycle_updated | true |
| learnings_rls_enabled | true |
| events_rls_enabled | true |

Complete R1 verification reported these fields `true`: `source_uuid_preserved`, `source_has_no_fk`, `brand_ownership_cascade`, `nullable_snapshot_columns`, `exact_bounded_column_checks`, `immutable_provenance_and_lifecycle`, `exact_event_allowlist_and_bounds`, `append_only_history_preserved`, `rls_enabled`, `no_browser_policies`, `browser_grants_closed`, `public_grants_closed`, and `no_provenance_backfill`.

It also reported `learning_count = 0`, `event_count = 0`, and both aggregate fingerprints `d41d8cd98f00b204e9800998ecf8427e`. `overall_readiness = baseline_required` arose solely because the operator had not recorded a pre-migration baseline. The accepted fact that both governed tables had zero existing rows means there was no existing Learning/event application data for this schema-only migration to rewrite or lose. A post-only zero count alone would not prove historical preservation in a populated installation; R2 proves preservation internally for new upgrades and does not invent an R1 historical baseline. The production schema is already in State B.

## Exact supported states and procedural authority

The new migration uses `BEGIN`, one `DO $recovery$` block, and `COMMIT`. It creates no temporary, permanent or other staging table. Counts and fingerprints live in PL/pgSQL records for the entire classification/change/verification lifecycle. Even a client splitting at top-level SQL statement boundaries cannot separate those variables from their preservation check. Submit the entire file; never select an internal fragment of the DO block.

Before inspecting or capturing evidence, the block locks Brands, Boards, Learnings and events in `ACCESS EXCLUSIVE` mode until transaction completion. This prevents concurrent Learning writes and source/owner deletion from invalidating the preservation evidence. It does not modify those unrelated relations.

**State A: untouched BW-36.17.** The source is UUID with exactly one validated, nondeferrable Board(id) `ON DELETE SET NULL` FK; no snapshot columns exist; the complete original lifecycle function and original event CHECK match. Common column/default, CHECK, duplicate/index, ownership, RLS, privilege and history contracts must remain exact. The block captures counts and fingerprints before DDL, drops only the source Board FK, adds the three bounded nullable text snapshot columns without defaults, replaces the lifecycle function, and replaces the event snapshot CHECK. It performs no row backfill or DML.

The block then reinspects the final contract and compares both counts and ordered aggregate fingerprints. The comparable Learning fingerprint excludes only the three newly added columns, which must remain null; the event fingerprint includes the complete row. A difference raises `bw36_17r2_preservation_failed` and rolls back the complete correction. Existing rows that cannot satisfy the intended R1 CHECK also cause refusal and rollback; no data is silently rewritten to make them fit.

**State B: exact completed R1.** The complete final contract passes: source UUID with no FK, all three exact nullable/no-default bounded snapshot columns, updated lifecycle function/trigger, expanded event allowlist/bounds, exact ownership relationships, closed privileges, enabled RLS and correct history guards. The block emits `bw36_17r2_already_ready` and returns before all DDL. It runs no ALTER, CREATE, DROP or application DML. Zero rows are valid. The test compares complete public relation, attribute, constraint, trigger, function and policy catalog records (including OIDs), plus row bytes, before and after both empty and populated State B runs.

State A success emits `bw36_17r2_upgraded_preserved`. Every other schema combination fails with the bounded `bw36_17r2_partial_or_conflicting_schema`. It refuses missing snapshot columns, mixed lifecycle/event versions, extra or incorrect FKs, weakened RLS, table/column/PUBLIC grants, policies, wrong or conditional trigger definitions, unexpected columns, defaults, weakened base checks or duplicate indexes. Constraint names for original removal are discovered safely. PostgreSQL 17 catalog expression fingerprints follow R1's existing deparser contract; unexpected platform output fails closed and requires investigation rather than removing checks.

## Security, ownership and data boundaries

`source_board_id` stays an immutable soft UUID. Board deletion can succeed without updating the Learning or its provenance. Snapshot text retains the R1 limits of 200/300/100 characters, visible text requirements and control-character rejection. The exact event CHECK retains required statement/source type, a 40,000-byte bound, bounded optional scalar provenance and a closed key allowlist. Unknown, nested and oversized source data are refused.

Both Brand ownership cascades, same-Brand predecessor/event FKs, identity relationships, duplicate guards, lifecycle revisions/transitions, append-only event history, deletion and TRUNCATE guards remain intact. RLS remains enabled; no policies or PUBLIC/anon/authenticated table or column grants are added. Historical identifiers and snapshots do not grant current Board access. Future BW-36.18 must still authorize current source access independently.

No Learning/event row is created, changed, deleted or backfilled by this migration. No Workspace, Brand, Board, Canvas, campaign or account data changes. Codex executes no production SQL. Focused tests use invented in-memory PostgreSQL data and block HTTP/fetch transports; they make zero real database, provider, AI or external network requests. Package provisioning and the explicitly required Git/GitHub delivery are separate development operations.

## Deployment order and manual Supabase execution

1. Review and manually merge this normal PR on GitHub. Codex never merges it.
2. In the correct Supabase project, use the normal backup and a quiet window because the migration briefly takes exclusive locks.
3. Execute the complete merged `migrations/20261012_bw36_17r2_learning_provenance_recovery.sql` **exactly once** in Supabase SQL Editor. This supersedes rerunning R1 for recovery; do not edit either historical migration. Current production State B must return `bw36_17r2_already_ready`. No table is created, so this migration has no newly created table for an RLS enablement prompt.
4. Execute the complete `scripts/sql/bw36-17r2-learning-provenance-recovery-verification.sql` unchanged. It is one read-only statement and has no baseline placeholders to edit.
5. Require all contract fields `true` and `overall_readiness = ok`. Archive the bounded result. Zero Learnings/events and empty fingerprints are valid and return `ok` for the accepted production state. A refusal, SQL error or `not_ready` blocks further activation; investigate without relaxing the guards.

The verification checks UUID/no FK, both exact Brand cascades through the ownership inventory, nullable snapshots and exact checks, immutable lifecycle and exact trigger configuration, expanded event allowlist/bounds, append-only history, enabled RLS, absent policies and closed browser/PUBLIC table, column and guard-function grants. It also checks the unchanged base columns/defaults/checks/indexes and absence of unexpected provenance backfill in Learnings/events before BW-36.18. It returns only booleans, current counts, 32-character aggregate fingerprints and bounded readiness; never row text, UUIDs or identities. The Learning fingerprint is the same comparable projection used by migration preservation. Readiness validates the current contract; it does not falsely claim independent historical R1 row preservation.

BW-36.18 remains dependent on successful R2 verification after user deployment. Its eventual legitimate provenance capture will require its own acceptance criteria; this pre-activation no-backfill gate deliberately rejects non-null future provenance.

## Rollback boundary and validation

Any unsupported state, failed DDL, final contract mismatch or preservation difference aborts the block and transaction, retaining the original schema and rows. A bounded error handler prevents underlying row/constraint detail from escaping. State B has no changes to roll back. After successful commit, any schema reversal requires an operator-reviewed forward migration. Never blindly restore the Board FK, drop adopted provenance columns or rewrite append-only history: source UUIDs may correctly reference deleted Boards. No application behavior changed, so this phase has no application rollback.

`npm run check:bw36.17r2` is registered in Runtime Boot Safety after R1. It applies exact SQL in pinned PGlite PostgreSQL 17, reproduces the editor commit failure, upgrades populated State A, validates empty/populated State B without schema or row mutation, refuses representative partial/conflicting states atomically, injects mid-DDL failure and row mutation to prove rollback, and exercises Board deletion, immutable provenance, event bounds, Brand cascade and append-only history. Historical migration hashes are pinned. Only two historical Workspace migration inventory allowlists are extended; substantive historical assertions are unchanged.

Changed files:

- `migrations/20261012_bw36_17r2_learning_provenance_recovery.sql`
- `scripts/sql/bw36-17r2-learning-provenance-recovery-verification.sql`
- `scripts/check-bw36-17r2-learning-provenance-recovery.js`
- `docs/implementations/bw36-17r2-learning-provenance-recovery.md`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `scripts/check-bw36-9-authorized-workspace-read-boundary.js`
- `scripts/check-bw36-9r1-workspace-identity-resolution.js`

Local validation results: all 31 focused R2 scenarios passed, including the reproduced `42P01` editor failure and zero-row `ok`. All 35 registered historical BW-36 commands passed, including R1's 23 database scenarios and BW-36.17's authenticated Chromium regression. BW-36.16 initially encountered a browser timing assertion (`detailed` versus `standard`); an isolated rerun passed all five groups with unchanged assertions. Initial restricted-sandbox browser/HTTP fixture failures were resolved by rerunning with local network capability. The Workspace Brand deletion regression passed all 19 contracts, browser integrity passed all 40 local classic scripts, changed JavaScript syntax checks passed, and `git diff --check` passed. No production SQL was executed.


## PR #763 follow-up: CI fixture settlement and FK cardinality

Runtime Boot Safety run `38218829463`, on `1cc688d0a53f45e25259317d716fc3726c435152`, passed BW-36.16 and then failed BW-36.16R1 at shared fixture line 152: `detailed` instead of `standard`. The exact GitHub job logs confirm that the R1 toolbar/first-cycle checks and first hierarchy sequence had already passed.

A repeated local browser trace reproduces the same failure with the original fixture. The first Escape reaches the native responsibilities dialog while `aria-busy=true`; the production `cancel` handler intentionally prevents dismissal during the asynchronous team load. Attempting to focus the Canvas card while the modal remains open cannot transfer focus. The next Escape therefore dismisses the dialog instead of changing the card from Detailed to Standard. Native dialog removal and trigger-focus restoration also happen in its queued `close` handler. The fixture waited only for modal visibility, which does not establish either loading or dismissal completion. Each BW-36.16/R1 invocation creates a fresh runtime and browser, so the preceding workflow test does not share stale Canvas state.

The shared fixture now waits for the existing `aria-busy=false` readiness before Escape, and for dialog detachment plus restored Tasks-trigger focus before returning focus to Canvas. No view assertion was removed, weakened or converted to a polling assertion, and no fixed delay was added. All production modules, intended view hierarchy, request behavior and busy-state dismissal protection remain unchanged. The repaired sequence passed 60 consecutive diagnostic iterations against real production rendering.

The P2 review finding was also valid: the old aggregate join could have relationship cardinalities `0,2,1,1,1,1,1` and still count seven matches. State A, State B, post-DDL validation and the standalone read-only verification now count matches independently for each expected FK and require every count to be exactly one. The existing total FK count is retained (eight in State A including its independently checked Board FK; seven in the final state), so additional/unexpected constraints still refuse. Targets, ordered source/target columns, delete/update actions, match mode, validation and deferrability checks are unchanged.

The disposable suite now passes 46 scenarios. Fourteen new adversarial cases cover every missing relationship compensated by a differently named duplicate in both State A and State B. They demonstrate the old aggregate acceptance while requiring the corrected verification to return `not_ready`, and compare complete catalog/row evidence after migration refusal. A fifteenth new case injects the same conflict after DDL and verifies full transaction rollback. Existing preservation, RLS, privilege, immutable provenance, Board deletion, Brand cascade and append-only history scenarios remain green.

Follow-up file scope: the shared Canvas test fixture, R2 migration, R2 verification SQL, R2 disposable regression suite and this implementation record. Neither already-deployed historical migration is edited. Deployment order remains manual merge followed by exactly-once execution of the complete corrected R2 migration and unchanged-input R2 verification. Completed production R1 remains a validated no-op; conflicting catalogs must be investigated rather than silently repaired. No BW-36.18 work, production SQL execution, merge or replacement PR occurs.

The complete local Runtime Boot Safety shell payloads ran in workflow order: 168 steps, with all browser/database/runtime validations successful except BW-36.7's working-tree guard, which refuses an uncommitted migration diff against HEAD. That guard subsequently passed all 18 deterministic groups from the clean committed checkout, with the same execution capability as the full workflow, without changing or waiving it. All 167 validation steps therefore passed; the root-only browser installer remains the one local setup limitation. The installer step's npm provisioning passed, but `npx playwright-core install --with-deps chromium` failed with `su: Authentication failure`; this environment cannot switch to root. The installed `/usr/bin/chromium` ran the unchanged workflow's browser checks, including both BW-36.16 variants and all subsequent checks. This local result does not claim the privileged installer passed; the GitHub runner retains its normal setup. Changed JavaScript syntax checks and `git diff --check` also passed. The new pushed commit's GitHub Actions result is reported separately from these local checks.
