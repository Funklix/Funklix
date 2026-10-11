# BW-36.17R1 — Brand Learning provenance schema repair

Baseline: latest fetched `origin/main` `11f381451cc4ca74813ceaeb827b1374bc0c1700`, including merged BW-36.17. This is a prerequisite schema repair only. No application route, UI, projection, campaign proposal, generation or provider behavior changes. Brand Profile remains the one governed Learning Library, with the existing manual creation/review flow and human approval.

## Verified conflict and forward repair

The executed `20261011_bw36_17_governed_brand_learnings.sql` defines `source_board_id` as a Board FK with `ON DELETE SET NULL`. PostgreSQL implements that action as an UPDATE, which the existing provenance/revision trigger rejects with `learning_revision_or_ownership`. A disposable PostgreSQL test reproduces the failure before applying the repair. The original migration remains byte-identical because it is already deployed; editing it would produce divergent installed schemas.

Exactly one new transaction, `migrations/20261011_bw36_17r1_learning_provenance_schema.sql`, discovers the Board FK through `pg_constraint`/`pg_attribute`, checks its exact UUID column, target column, validated SET NULL action and nondeferrable contract, and removes only that FK. The source UUID and all existing values remain unchanged. An immutable soft identifier survives source deletion and can later be checked against current Board authorization without interfering with Board deletion or rewriting approved knowledge.

The Brand FK/cascade, proposing/reviewing identities, same-Brand successor/event relationships, exact duplicate indexes, revision rules, status transitions, append-only event/history guards and browser-denying RLS/privileges remain intact. The actual BW-36.17 proposer column is `proposed_by_identity_id`, not `created_by_identity_id`; it remains protected. There is no `source_brand_id` column to alter. `brand_id` remains the ownership boundary.

Three nullable historical display columns are added without defaults or backfill:

| Column | Limit |
| --- | --- |
| `source_board_name_snapshot` | 1–200 characters |
| `source_node_title_snapshot` | 1–300 characters |
| `source_node_type_snapshot` | 1–100 characters |

Non-null values must contain visible text. Whitespace-only values (including common Unicode spaces) and control characters are rejected. Each new column and all existing provenance/ownership fields remain immutable even when an UPDATE supplies the correct revision increment. Ordinary governed updates still require exactly one revision increment. INSERT still requires proposed/revision zero with no reviewer; application endpoints still enforce human Brand review. Database storage is privileged and does not substitute for application authorization.

The existing event snapshot CHECK is replaced, preserving required statement/source type, the 40,000-byte JSON bound and existing text limits. Only five new optional keys are admitted: `source_board_id`, `source_node_id` and the three display snapshot columns. Source identifiers in events must be canonical hyphenated UUID strings or null; this does not change the existing text type of `brand_learnings.source_node_id`. Display limits match the columns. Nested objects, arrays, unknown keys, raw payloads, prompts, outputs, email/identity metadata and arbitrary source metadata are refused. Existing nullable optional fields remain supported; non-null predecessor identifiers are UUID strings. No event is rewritten.

## Authority and privacy

These fields are historical facts, never permission grants. There is no new browser route or UI exposure in this PR. BW-36.18 must derive Board/Brand/node authority server-side and separately authorize current Board access before showing any source name, title or View source link. Deleted/inaccessible sources must render generic unavailable copy, while Learning/history survive. No full Board, node body, generated content or automatic extraction is stored.

## Migration and operator deployment

No production SQL or real application-data mutation is performed by implementation/tests. After manual GitHub review and merge:

1. Identify the correct Supabase project, take the normal backup, and choose a quiet window with Learning writes quiescent.
2. Run the complete one-query `scripts/sql/bw36-17r1-learning-provenance-verification.sql` **before** migration. Record only its four aggregate count/fingerprint outputs. Its `baseline_required` readiness is expected before supplying a baseline.
3. Execute the entire **merged** `migrations/20261011_bw36_17r1_learning_provenance_schema.sql` exactly once in Supabase SQL Editor. Its explicit transaction locks the Brand, Board, Learning and event tables while checking and altering the schema. It performs no existing-row INSERT/UPDATE/DELETE and no backfill. A transaction-local temporary aggregate baseline must match at the end or the whole transaction aborts.
4. In the verification query's `expected_baseline` VALUES, replace only the four NULL placeholders with the captured learning count/fingerprint and event count/fingerprint. Counts remain bigint; hashes remain quoted text. Run the complete single read-only query again.
5. Require every check true and `overall_readiness = ok`. Archive the bounded result. If any check is false, or output is `not_ready`/`baseline_required`, **stop**. Do not enable BW-36.18.

The query exposes counts and aggregate hashes only: no row contents, UUIDs, identities or private campaign information. It verifies UUID preservation/no source FK, Brand cascade ownership, nullable columns, exact bounded CHECK expressions, the full immutable lifecycle function, append-only guards, RLS, zero policies and table/column/PUBLIC privilege closure, no backfill, and matching existing-row fingerprints. A post-only result cannot establish historical preservation; the required baseline provides that evidence. Unrelated writes between captures invalidate the comparison. The no-backfill check is intended for immediate repair acceptance, before BW-36.18 can populate provenance.

Refusal is deliberate for missing prerequisites, unexpected FK shape/action, existing repair columns/replay, changed lifecycle/history functions, open browser access or changed event constraints. Catalog expression fingerprints were validated with PostgreSQL 17 in PGlite; an unexpected PostgreSQL deparser output fails closed rather than guessing. A platform-version mismatch must be investigated against its catalog evidence, not worked around by deleting guards. Constraint names for removal are discovered, never assumed. A renamed generated FK/event constraint is supported.

## Verification and rollback boundary

`npm run check:bw36.17r1` runs a pinned development-only PGlite disposable PostgreSQL runtime, applying the exact original migration followed by the exact repair. It reproduces the original source-delete failure, exercises successful Board deletion with preserved Learning/history/provenance, all immutable fields, valid and invalid event/column boundaries, NULL and UUID contracts, real production manual lifecycle queries, Brand cascade, event immutability, browser-role denial, replay/schema drift refusal and transaction rollback. Network transports are blocked in this check. No production connection or AI/provider call occurs.

The new check is registered after BW-36.17 in Runtime Boot Safety. Two historical Workspace tests only extend their later-migration filename allowlists; substantive assertions and historical SQL are untouched. The original governed Learning check and relevant historical Brand/Board/Canvas/Content/export regressions remain required.

Rollback before any provenance is adopted can be an operator-reviewed forward schema change. Never blindly recreate the Board FK: surviving source UUIDs may intentionally reference deleted Boards. Never drop populated snapshot columns or rewrite append-only history. After adoption, disable the future capture UI/application and roll forward while retaining Learning/event facts; this PR itself activates no UI and needs no application rollback. Do not revert/remove the BW-36.17 schema.

BW-36.18 remains blocked until the user executes this merged repair and obtains the final verification `ok`. This PR does not authorize that feature or production SQL execution by the agent.

## Changed files

- `migrations/20261011_bw36_17r1_learning_provenance_schema.sql`
- `scripts/sql/bw36-17r1-learning-provenance-verification.sql`
- `scripts/check-bw36-17r1-learning-provenance-schema.js`
- `package.json` — focused command and pinned development-only PGlite dependency
- `.github/workflows/runtime-boot-safety.yml` — syntax and focused check registration
- `scripts/check-bw36-9-authorized-workspace-read-boundary.js`
- `scripts/check-bw36-9r1-workspace-identity-resolution.js`
- This implementation record

## Local validation record

All 23 focused disposable PostgreSQL scenarios passed with the exact migrations and the production Learning service. The unchanged BW-36.17 authenticated Chromium regression passed, including both languages, themes, established viewport/reflow widths, manual/review/successor lifecycle, stale recovery, read-only access, focus and dirty-state protections.

Runtime Boot Safety completed all 193 commands in declared order: 191 validation commands passed and npm provisioning passed. The one setup command `npx playwright-core install --with-deps chromium` failed because switching to root produced `su: Authentication failure`. All browser validations used the installed `/usr/bin/chromium` and passed; this does not claim the installer succeeded. The normal GitHub runner must execute its unchanged setup command. Historical Brand setup/lifecycle/deletion/team, Board access/sharing, BW-36.15/R1 responsibilities, BW-36.16/R1 Canvas, Content Workspace/Calendar, Posting Plan CSV/PDF and browser script integrity checks passed without weakened assertions.

Changed JavaScript syntax checks and `git diff --check` passed. Authorized external activity was limited to package provisioning and Git/GitHub delivery. No production SQL, real application-data mutation, AI request or provider request occurred. The repair remains unexecuted in production; manual post-merge Supabase migration and baseline-backed verification are required.
