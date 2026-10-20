# BW-36.23A — Brand Knowledge Protection Core

Date: 20 October 2026, Europe/Berlin. Base: merged main `a1f72e68c1b9e236606db8f9f6f346db0c344be3`, including PR #801.

**Reviewable implementation; production activation BLOCKED.** Full Runtime Boot Safety has failures. This is not a release-readiness or production-enforcement claim. No merge, deploy, production SQL/records, historical restore/backfill, paid AI or generation was performed. Existing tests were not weakened or modified. Historical incident investigation was reused, not repeated.

## Changed files

- `docs/implementations/bw36-23a-runtime-boot-safety.json`
- `.github/workflows/runtime-boot-safety.yml`
- `api/_boards-storage.js`
- `api/_brand-creation.js`
- `api/_brand-deletion.js`
- `api/_brand-knowledge-write.js`
- `api/_brand-logo-storage.js`
- `api/_brands-storage.js`
- `api/_project-command.js`
- `api/brands/[id].js`
- `api/brands/[id]/logo.js`
- `api/brands/[id]/write-preview.js`
- `app.js`
- `brand-profile-setup.js`
- `brand-write-contract.js`
- `docs/audits/bw36-23-brand-knowledge-protection-architecture.md`
- `docs/implementations/bw36-23a-brand-knowledge-protection-core.md`
- `docs/runbooks/bw36-23-brand-knowledge-protection.md`
- `index.html`
- `migrations/20261020_bw36_23_brand_knowledge_protection.rollback.sql`
- `migrations/20261020_bw36_23_brand_knowledge_protection.sql`
- `migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql`
- `package.json`
- `scripts/check-bw36-23-brand-knowledge-browser.js`
- `scripts/check-bw36-23-brand-knowledge-postgres.js`
- `scripts/check-bw36-23-brand-knowledge-protection.js`
- `scripts/fixtures/bw36-23-brand-knowledge-browser.js`
- `scripts/fixtures/bw36-23-brand-knowledge-runtime.js`
- `scripts/sql/bw36-23-brand-knowledge-preflight.sql`

## Final write semantics

`canonical-brand-write/v1` binds Workspace, exact decimal revision, UUID mutation ID, typed operation and explicit JSON Pointer field changes. Each change declares expected existence and exact old value. Omitted keys preserve all stored values recursively; unknown future JSON remains protected. Arrays are atomic, with full old-array comparison and destructive review for loss/replacement; exact prefix-preserving appends retain every old element and need no destructive dialog. Missing and null are different; false/zero are not empty. Ambiguous/overlapping/root/server-owned/prototype paths, excessive depth/count/size and type mismatches are rejected. Browser normalization and PostgreSQL resolution independently validate the contract.

Ordinary deliberate scalar edits require Save without a destructive dialog. Clear/remove, populated subtree/array replacement, approval/status/type changes and asset reference replacements require an authorized preview and five-minute HMAC review token bound to exact command digest/actor/Brand. Tokens fit HTTP headers and never contain full knowledge. SQL checks the backend's exact attestation; browser flags cannot authorize destructive writes. There is no generic bypass flag. An invalid/expired token cannot authorize a new write; a read-only authorized lookup may resolve an already committed matching receipt.

Legacy whole-document PUT payloads fail with 428 WRITE_CONTRACT_REQUIRED without partial application. This is a conservative rejection policy; no legacy destructive permission is inferred. The compatible read projection stays at the response top level with contract/event/mutation/replay metadata. Numeric responses fail closed outside safe revision bounds.

The Profile controller diffs deliberate changes, excludes untouched UI defaults, preserves unknowns and accepted siblings, retains exact pending command IDs across response-loss retries, and suppresses stale responses after account/Brand/Workspace changes. Advanced editing uses the same field contract. Omitted keys in its JSON editor also preserve storage; explicit API remove is available, but there is no new field-removal editor UI. DNA/Avatar acceptance is typed and server-validated. Domain automatic fills require still-empty paths; accepted replacements are explicit. Founder Story/customTiles array edits retain draft metadata and require review. Board-only Founder Story/strategy and AI Brain/Learning/Canvas generation remain unchanged.

## Protected lifecycle and history

Backend session identity supplies the email; SQL resolves and locks the active identity, Brand and current membership, validates Workspace context and rechecks authorization. Runtime is a restricted backend login, not end-user database authentication. It cannot hold owner/BYPASSRLS credentials. Trusted backend compromise remains outside this boundary. Existing membership revocation row locks linearize with protected writes; no browser-side authorization is relied upon.

All canonical UPDATE/INSERT/DELETE operations go through SECURITY DEFINER command functions with a fixed `pg_catalog` search path. Core/name revision changes exactly once for actual changes; no-op receipt events advance only the shared history sequence. Logo events keep the Core revision and increment logo revision/sequence. Trigger insertion and canonical writes share one database transaction; history failure rolls back canonical state and coupled creation. A caller-writable GUC only transports validated context; direct runtime writes are denied by grants and the invoking-user trigger boundary. History UPDATE/DELETE/TRUNCATE and Brand TRUNCATE are guarded.

History stores full `to_jsonb(OLD/NEW)` row images, including future columns, Brand/Workspace, event ordering, revisions, verified actor/registered baseline operation, UUID mutation ID, SHA-256 digest, bounded intent/provenance and snapshot version. Actor/mutation receipts are unique and checked before stale revisions under current authorization. Replays return the original committed snapshot and explicit replay marker. Browser pending holders are session-local; durable receipts are in PostgreSQL. Restart/reload reconciliation beyond authoritative readback remains a client follow-up requirement.

`source_event_id UUID NULL` is present in Phase A. `UNIQUE (brand_id, event_id)` backs `FOREIGN KEY (brand_id, source_event_id) REFERENCES brand_knowledge_history (brand_id, event_id) ON DELETE RESTRICT`. Real-engine tests accept a same-Brand reference and reject a foreign Brand reference with that exact FK. Ordinary events retain NULL. This resolves PR #801's P2 schema omission now; restore endpoints/UI remain Phase B.

Creation runs inside the existing Brand/Project transaction. Logo uploads use immutable mutation-specific keys; old and uncertain uploads are retained, never automatically deleted. Logo receipts resolve response loss before further upload/revision checks. Owner-only deletion requires captured revisions, Workspace and exact name; associated Boards block deletion; history survives deletion and UUID reuse is rejected. Only the original active actor can resolve their own deleted-Brand receipt. No deleted-history browsing UI is exposed.

Explicit empty-Core initialization checks independent canonical edit authority and a matching associated authorized Board snapshot. It requires SERIALIZABLE isolation, rejects nonempty canonical Core and compares the entire selected snapshot. This deliberately replaces the proposed NOWAIT row lock to avoid expanding Board UPDATE privileges for the NOLOGIN function owner. SERIALIZABLE conflicts require a fresh comparison, never automatic rebase. This deviation needs review before activation.

## Migration and deployment safety

See [production cutover runbook](../runbooks/bw36-23-brand-knowledge-protection.md). SQL artifacts are supplied for review only. Supabase remains the sole production database. Operator-created NOLOGIN owner/runtime roles and a separately restricted backend login are mandatory. Browser/service roles get neither private function execution nor history access. Migration verifies effective runtime/member privileges and aborts on owner/bypass/inherited/column/DDL routes. Backend Brand SELECT remains available; history is private. Existing non-Brand subsystem grants and lazy DDL compatibility require a separate complete operator inventory and staging verification; owner credentials are not an acceptable shortcut.

Installation uses one transaction, advisory lock, lock/statement bounds, exact current baselines, structural checks, and a catalog fingerprint. An exact rerun adds no baseline; installed catalog drift aborts. Baselines do not rewrite Brand Core or fabricate older history. Rollback keeps history and guards, freezes function execution and rolls forward. No automatic production activation, schema migration or privileged fallback exists.

## Validation actually executed

- `node scripts/check-bw36-23-brand-knowledge-protection.js`: **15/15 PASS**; real client controllers with provider-free transport and cryptographic review tests.
- `node scripts/check-bw36-23-brand-knowledge-browser.js`: **3/3 PASS**; real system Chromium loads the production modules and checks ordinary edit, reviewed Avatar replacement and in-flight Workspace switching. No external network/provider calls.
- `BW36_23_DISPOSABLE=1 BW36_23_TEST_URL=postgres://postgres@127.0.0.1:55423/postgres node scripts/check-bw36-23-brand-knowledge-postgres.js`: **43/43 PASS**, real PostgreSQL **17.6**, independent connections, RLS-enabled fixture tables and an actual non-owner LOGIN with restricted roles. Disposable local cluster from the npm-distributed PostgreSQL binaries; no Supabase connection.
- Real engine coverage: exact baseline/rerun/drift, unknown nested/future-column preservation, null/blank/empty/object/array review, approval dependencies, image replacement/preimage, DNA/Founder Story/domain fill, legacy rejection, stale/concurrent editors, lost response/idempotency conflict, unauthorized/viewer/Workspace mismatch, membership revocation, history insertion failure and rollback, direct SQL/GUC/DDL/truncate denial for runtime/anon/authenticated/service fixtures, exact source FK, creation rollback, reviewed clear/remove, logo sequence/receipt, initialization, retained deletion history and UUID reuse, expired proof denial and invalid command rejection; the real HTTP handler with verified session; expired-token receipt resolution; no-op receipts; rejection of function-owner SET ROLE; and logo/Core interleaving.
- `node scripts/check-browser-script-integrity.js`: PASS, 46 local classic scripts. Changed JavaScript syntax and `git diff --check`: PASS.
- Full Runtime Boot Safety results are retained below. It is **not passing**, and focused successes do not replace it. The complete run began before the final added checks and some later hardening edits; final focused checks cover those edits. A final full passing rerun is still required.

### Full Runtime Boot Safety evidence

All **192/192 starting-workflow run blocks attempted: 169 PASS, 23 FAIL**, including two locally satisfied setup blocks. The 190 validation blocks therefore yielded **167 PASS, 23 FAIL**. The final workflow adds three passing focused suites, for 195 registered run blocks. No full final-tree passing run is claimed. [Exact commands, exit codes and durations](bw36-23a-runtime-boot-safety.json).

Targeted rerun: `npm run check:bw35.3r4` **PASS** after staging the new module for its tracked-files-only checkout. Original failure evidence is retained. The remaining **22 failing blocks are unresolved**; this is still not a final full-workflow pass.

Failed starting-workflow blocks:

| Check | Exit |
| --- | --- |
| Check BW-35.3R4 Auto-plan batch runtime | 1 |
| Check explicit Canonical Brand editing | 1 |
| Check explicit Canonical Brand Core initialization | 1 |
| Check Canonical Brand foundation | 1 |
| Check Canonical Brand team roles | 1 |
| Check inline Brand member role management | 1 |
| Check Workspace Brand deletion and selector theme | 1 |
| Check BW-33.5.1 publishing destinations RLS delta | 1 |
| Check BW-36.9 authorized Workspace read boundary | 1 |
| Check BW-36.9R1 Workspace identity resolution repair | 1 |
| Check BW-36.13R3 authoritative project creation | 1 |
| Check BW-36.13R3R1 Workspace catalog and project launch repair | 1 |
| Guided Brand Profile setup regression | 1 |
| Check BW-36.21A-R2.1 safe Workspace switching (Chromium) | 124 |
| Check Brand Profile entry and Workspace actions in Chromium | 1 |
| Check BW-36.13R5 Brand lifecycle stability | 1 |
| Check Brand workspace regression recovery | 1 |
| Check durable Brand logos and readiness | 1 |
| Check production Brand logo persistence | 1 |
| Check Brand Profile decisions and deletion UX | 1 |
| Check BW-36.12 Brand logo acquisition and projection | 1 |
| Check BW-36.22B2 real Brand Avatar and contextual personality | 1 |
| Check BW-36.22B2R1 canonical conflict reload recovery | 1 |


## Known limitations and production blockers

1. Resolve/adapt all existing failing regression fixtures and source contracts without weakening their authorization/isolation assertions. Re-run the entire final Runtime Boot Safety workflow. Some failures are old payload/query mocks; others are browser/timeouts. Do not classify them all as harmless or claim UI acceptance until investigated.
2. Verify actual Supabase schema, ownership, RLS/policies, default/inherited/column grants, runtime login separation, external writers and all existing subsystem grants/schema preparation. The disposable fixture does not establish production configuration. No production database credentials were used.
3. Verify independent database backup/PITR and isolated restore, plus separately retained Vercel Blob/Supabase Storage image bytes. History in the same database is not a backup. Accepted asset recoverability remains unverified.
4. Provision/rotate the server-only review signing key; rehearse draining old instances, compatible client cutover, baseline timing/storage and rollback. Review SERIALIZABLE initialization and legacy rejection UX.
5. Additional end-to-end staging of coupled full Project/Board/Workspace flows, runtime schema preparation, durable client reconciliation after browser restart, and lost-response behavior in the Advanced/logo UI remains required. The server receipts are durable; some pending client IDs remain in memory.
6. Supabase's deployed `service_role` is not assumed safe simply because BYPASSRLS exists. Production must deny table/function paths and never run the app as an owner. PostgreSQL superusers/operators can alter protection; isolate those credentials and retain independent backups.

## Deferred Phase B

History listing/comparison/restore UI and endpoints, selected-field recovery, operator entitlement and isolated backup recovery drills. No historical Brand reconstruction, Board promotion, Avatar regeneration, new storage provider, unrelated Home redesign or automatic repair is included. No Codex approval or CI success is implied by opening this PR.
