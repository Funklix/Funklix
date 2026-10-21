# BW-36.23A — Brand Knowledge Protection Core

Date: 20 October 2026, Europe/Berlin. Base: merged main `a1f72e68c1b9e236606db8f9f6f346db0c344be3`, including PR #801.

**Reviewable implementation; production activation BLOCKED.** Current Runtime Boot Safety and Codex finding status are recorded in the R2 section below; earlier failure inventories are historical. This is not a release-readiness or production-enforcement claim. No merge, deploy, production SQL/records, historical restore/backfill, paid AI or generation was performed. The initial implementation did not modify existing tests; the targeted CI recovery below updates BW-7 without weakening its meaningful assertions. Historical incident investigation was reused, not repeated.

## Changed files

- `docs/implementations/bw36-23a-runtime-boot-safety.json`
- `docs/implementations/bw36-23a-explicit-editing-ci-recovery.json`
- `scripts/check-bw7-canonical-brand-editing.js`
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


## CI recovery — explicit Canonical Brand editing (PR #802)

### Evidence and precise cause

Retrieved the **complete decoded GitHub Actions job log**, 59,170 characters, for [Runtime Boot Safety run 39458594020, job 118751820105](https://github.com/Funklix/Funklix/actions/runs/39458594020/job/118751820105), reviewed commit `6989659be6abb107727d8f8351560b6200117ebe`. The failing step ran `node scripts/check-bw7-canonical-brand-editing.js`. Log lines 579–580 identify **line 36**, `assert.match(save, /method: "PUT"/, "save reuses PUT")`; line 657 prints the exact expected regex. All later GitHub workflow checks were skipped after that failure; they were not successful checks.

The saved complete decoded log is retained locally at `work/bw36-23a-ci-recovery/github-job-118751820105.log`, SHA-256 `091e98eb0ebd4274fac0e59ab701dc2d8f585feb1f631feb26c40ec137b71a78`. This is the saved decoded-text artifact, not a hash of GitHub's compressed transport.

Main `a1f72e68c1b9e236606db8f9f6f346db0c344be3` and the PR originally contained the **byte-identical BW-7 test**, SHA-256 `9a64383dee595da724e63f78f793d57f9a05b47b1f2d2ba11af311cdf03b4c9e`. The main test passes against main's actual app/HTML/workflow files in an isolated local source fixture. Main sent a legacy full document directly from `submitCanonicalBrandEditing`; the PR builds an `advanced_edit` field command and delegates transport to the production shared module. Thus the literal `method: "PUT"` moved out of the function inspected by the old test. No endpoint/method replacement was needed to fix this failure.

The original invariant remains: only an explicit, authorized Canonical Brand edit reaches `PUT /api/brands/:id`; it targets the captured Brand/revision, verifies persistence and preserves drafts on failure/conflict, without writing Board/Canvas state or forging ownership. A test of a literal's location is insufficient after delegation.

### Verified current invocation and security boundary

1. `beginCanonicalBrandEditing` requires `canEditCanonicalBrand`; submission binds authenticated account email, an authorized Workspace catalog entry, canonical identity, open dialog, navigation generation and captured revision.
2. The production submission invokes `BrandWriteContract.command(..., workspaceId, 'advanced_edit')`, derives the expected preserved result with `apply`, and calls the actual `BrandWriteContract.submit` helper.
3. That helper sends **PUT `/api/brands/${brandId}`**, with `canonical-brand-write/v1`, string `expected_revision`, Workspace context, UUID mutation ID, typed operation and exact path/action/existence/old-value intent. It does not supply ownership/actor/Board fields. Destructive changes use the authenticated preview, concrete confirmation and bound review header before the same PUT; cancellation sends no mutation.
4. The route authenticates the signed server session and calls the protected backend service. The service verifies the contract/review token and uses one checked-out client and transaction. PostgreSQL locks and rechecks active identity, canonical Brand membership/Workspace and exact revision, rejects unreviewed destructive operations and records full before/after history through the protected trigger. Unauthorized, stale, malformed and history-failed writes cannot commit canonical-only state. The real PostgreSQL suite separately verifies those guarantees; client transport fixtures are not substituted for engine evidence.
5. The editor verifies the returned Brand identity, revision, name and preserved complete Core against its computed expected result before marking saved or reconciling projections. The shared helper's response body is consumed exactly once. Late responses cannot project into a replaced account/Workspace/generation.

### Targeted change and retained requirements

Only the four assertions coupled to inline legacy transport were replaced. They now require the exact command construction, actual protected submission, preservation-aware expected state, the helper's canonical PUT route and serialized command. All other original meaningful checks remain, including explicit editing, authorization gates, duplicate-submit guard, verified identity/revision/Core, 409 conflict, error/draft retention, reload behavior, stale-response invalidation and Board/Canvas isolation.

The **existing BW-7 test** additionally loads the actual shared browser module plus the production editor/validator functions in a disposable VM. Its **25 behavioral groups** check ordinary save through the real call chain, exact envelope/path/old-value intent, no ownership/actor/Board injection, unknown and accepted DNA/Avatar preservation, no-op revision, rejected identity/revision/name/Core responses, 409/401/403/404/422/428/503 failures, viewer denial, reviewed clear, cancelled review, network failure and retained pending command, pre-submission scope rejection and late-response isolation. The transport/DOM are local substitutes; they do not establish SQL authorization or atomicity on their own.

No application runtime, server write function, schema, history guarantee, Board/Canvas persistence, generation behavior or production configuration was changed for this targeted recovery. No test was removed/skipped, legacy payload restored or bypass added.

### Recovery validation

Targeted changed files: `scripts/check-bw7-canonical-brand-editing.js`, this existing implementation report, and `docs/implementations/bw36-23a-explicit-editing-ci-recovery.json` (reproducible command/exit-code evidence).

- Corrected BW-7 regression: **PASS**, every retained source invariant plus **25/25** final behavioral groups. The final explicit rerun includes the strict envelope and duplicate-submit checks added after the complete workflow started.
- BW-36.23A contract/controllers: **15/15 PASS**; provider-free Chromium: **3/3 PASS**.
- Real PostgreSQL **17.6: 43/43 PASS**, independently in the focused run and again in the complete workflow. Restricted actual LOGIN, RLS fixture tables, independent connections, exact revisions, reviewed destructive writes, authorization revocation, history insertion failure and transaction rollback are exercised. Rejected writes leave both canonical state and history unchanged.
- Existing domain import (`check-bw26-6-3-large-brand-core-website-import.js`), DNA generation preflight and Founder Story/DNA context checks: **PASS**. The protection suites also exercise accepted DNA and reviewed Avatar replacement while preserving unknown/unrelated knowledge.
- Existing Profile/lifecycle (`check:bw36.13r4`, `check:bw36.13r5`), real Brand Avatar (`check:bw36.22b2`) and conflict reload (`check:bw36.22b2r1`) suites: **FAIL**. The Profile fixture's first website-save assertion gets `0 !== 1`; the lifecycle fixture fails at its website acceptance/save boundary; the Avatar suite reports an unconfirmed save; the conflict reload browser suite times out. These failures predate this targeted correction and remain blockers. Their checks were not removed, bypassed or changed.
- Complete current Runtime Boot Safety: **195/195 run blocks attempted, 176 PASS, 19 FAIL**, including two local setup substitutions (installed declared dependencies and system Chromium). Validation-only count is **174 PASS, 19 FAIL** across 193 validation blocks. No full-workflow pass is claimed. Later blocks ran locally even after failures, so these counts are more complete than GitHub's fail-fast job. The corrected explicit-editor block and all three new protection blocks passed.
- Changed JavaScript syntax and `git diff --check`: **PASS**.

[Exact recovery commands, exit codes, durations and failure summaries](bw36-23a-explicit-editing-ci-recovery.json). Remaining complete-workflow failures:

| Check | Exit |
| --- | --- |
| Check explicit Canonical Brand Core initialization | 1 |
| Check Canonical Brand foundation | 1 |
| Check Canonical Brand team roles | 1 |
| Check inline Brand member role management | 1 |
| Check Workspace Brand deletion and selector theme | 1 |
| Check BW-33.5.1 publishing destinations RLS delta | 1 |
| Check BW-36.13R3 authoritative project creation | 1 |
| Check BW-36.13R3R1 Workspace catalog and project launch repair | 1 |
| Guided Brand Profile setup regression | 1 |
| Check BW-36.21A-R2.1 safe Workspace switching (Chromium) | 1 |
| Check Brand Profile entry and Workspace actions in Chromium | 1 |
| Check BW-36.13R5 Brand lifecycle stability | 1 |
| Check Brand workspace regression recovery | 1 |
| Check durable Brand logos and readiness | 1 |
| Check production Brand logo persistence | 1 |
| Check Brand Profile decisions and deletion UX | 1 |
| Check BW-36.12 Brand logo acquisition and projection | 1 |
| Check BW-36.22B2 real Brand Avatar and contextual personality | 1 |
| Check BW-36.22B2R1 canonical conflict reload recovery | 1 |


### Codex review and unchanged production gates

The Codex review of `6989659be6` completed with two unresolved findings:

- [P1: update the Project creation MemoryDb fixture for protected creation](https://github.com/Funklix/Funklix/pull/802#discussion_r4327558085). This concerns a different required regression, not BW-7's inline-PUT assertion.
- [P2: validate logo retries against the preserved request ID and retain pending state until validation](https://github.com/Funklix/Funklix/pull/802#discussion_r4327558100). This is a separate logo replay defect; this targeted explicit-editor test correction does not resolve it.

These findings are reported as unresolved, not marked fixed or approved. Remaining full-workflow failures and the existing production gates (restricted runtime-role/subsystem compatibility, schema/grant/external-writer inventory, review-key provisioning, verified independent database and asset backups/restore, SQL/initialization review and separately approved cutover) still block activation. No merge, deployment or production SQL/data operation was performed.


## R2 comprehensive compatibility and regression recovery — 2026-10-21

This section supersedes the earlier partial recovery conclusions. Work remains on existing PR #802, originally investigated at `614b6eb932c29b9eb51ff219ea682a20c73b5cb5`. No new PR, merge, deployment, production SQL, production data change, or paid provider/image request was performed. All database mutations below used a newly created disposable local PostgreSQL container/database; browser/provider/storage transports used disposable fixtures.

### Failure inventory and compatibility matrix

The prior complete inventory in `bw36-23a-explicit-editing-ci-recovery.json` recorded **195 attempted blocks, 176 PASS, 19 FAIL**. The original explicit-initialization failure was an obsolete inline `method: "PUT"` assertion. It did not justify restoring unprotected persistence. R2 inspected every workflow run block and expanded each registered npm command, including source assertions, database fixtures, browser transport, revision handling and explicit intent. The final registered workflow has **196 run blocks**: the original 195 plus initialization/logo replay regressions. The complete machine-readable final inventory is `bw36-23a-comprehensive-ci-recovery.json`.

| Affected check(s) | Class and obsolete assumption/root cause | Preserved invariant and adaptation |
| --- | --- | --- |
| BW-9 explicit initialization | A: inline full-document PUT expected inside app function | Assert actual app → `BrandWriteContract.command/submit` → protected PUT, explicit initialize operation, captured Board/snapshot/Workspace and pending mutation. Retain original eligibility, confirmation, exact response, conflict, scope, and no-autosave assertions; add 19 production-controller groups. |
| Canonical Brand foundation | A/B: runtime Brand DDL, old raw PUT, old schema adapter and boot ordering | Schema probes fail closed and retry; read paths never create Brand tables; typed field writes keep immutable ownership, safe revisions, unknown knowledge and untouched Board snapshots. Legacy shapes now assert 428, rather than expecting obsolete validation/success. |
| BW-20 team roles; BW-20.1 inline member roles | A: schema and edit SQL expected in `_brands-storage`/item route | Retain all former membership schema assertions against the supported baseline fixture; real PostgreSQL verifies uniqueness, lowercase, allowed roles, non-null and FK constraints after migration. Access/UI capabilities remain asserted; write authority and revision increment now checked on the protected SQL path. |
| Workspace Brand deletion | A/B: untyped confirmation-only request and direct DELETE fixture | Explicit contract, expected Core/logo revisions and mutation ID; lifecycle authorization, associated-Board denial, atomic history/membership deletion and rollback; legacy deletion rejected. Canvas and unrelated memberships survive. |
| BW-33.5.1 publishing destinations RLS inventory | A: both Brand tables still created at runtime | Keep historical protected-table inventory and migration hashes; separately verify existing Brand schema probes, and require no runtime Brand DDL. No table silently disappears from inventory. |
| BW-36.13R3 authoritative Project creation (Codex P1) | B: `MemoryDb` only recognized direct INSERT | Model exact protected `create_brand` arguments/return envelope, server-generated canonical identity, transactional history, failure and empty-result paths. Keep Workspace/identity/role checks, no partial Project, replay and concurrent retry coverage. |
| BW-36.13R3R1 catalog/Project repair | B: embeds R3 fixture in VM | Share the corrected protected fixture and provide its assertion dependency; retain existing catalog privacy, ownership and exact Brand/Board Workspace identity assertions. |
| BW-36.13R4 guided Profile; BW-36.13R4R1 Profile entry/actions | B: raw PUT fields, no preview response and fixed Brand identity | Normalize/apply protected field commands; preview/review responses and exact generated identity; retain draft, readonly, failure/retry, navigation and upload checks. |
| BW-36.13R5 lifecycle; R5R2 workspace recovery; R5R3 durable logos/readiness; R5R4 logo persistence; R6 decision/deletion UX | A/B: direct Brand SQL adapters, no preview/review header, reused ID for distinct logo actions, immediate old-asset cleanup, revision-only paths | Bounded protected-function adapter, exact commands/revisions/Workspace, transactional history and durable receipts; independent IDs for different mutations and same ID for retries; private immutable mutation-qualified assets retained after failure/replacement. Preserve readback, failure, roles, dirty state, metadata, Board/Canvas, accessibility, locale, theme and navigation assertions. Native confirmation acceptance is limited to the explicit protected-review prompts; unexpected dialogs still fail. |
| BW-36.12 logo acquisition/projection | A: required immediate compensation/direct logo UPDATE | Require protected lifecycle integration and SQL CAS; assert retained immutable assets rather than deleting historical references. Keep image/privacy, private storage, source priority, validation and projection checks. |
| BW-36.22B2 Avatar; BW-36.22B2R1 conflict reload | B: shared Home fixture could not execute protected writes/review | Correct shared transport and protected adapter, retaining accepted Avatar/DNA/unknowns, stale revision, deliberate reconciliation and Canvas isolation. |
| BW-36.21A-R2.1 Workspace switching | B/C: missing review header plus Home redraw removed blocked-switch status | Forward review headers and settle deliberate foreground edits before observing stale responses, preserving all exact mutation/timer assertions. Preserve the status inside Home's host when the same authorized context is redrawn; regression forces a Home redraw. All existing save/conflict/AI-flight/dirty/discard/retirement guards remain. No Board persistence code changes. |
| BW-36.7, BW-36.9, BW-36.9R1 scope guards; BW-36.7R2/R3 test evidence pins (additional full-run failures) | A: working-tree migration allowlist assumed an old implementation scope | Replace brittle worktree checks with fixed SHA-256 values for all historical migrations from `main` at `a1f72e6`, enforced even on a clean CI checkout. Preserve read-only preflight/catalog checks and original registration order. Refresh the two transitive test-source hash pins to reflect the reviewed scope-gate correction; historical SQL and runtime hashes stay unchanged. |
| Logo retry (Codex P2) | C: persisted receipt compared to a fresh local request ID; pending cleared before verification | Compare to `input.request_id`, require current account/Brand/Workspace context, and clear pending state only after exact receipt validation. Ten new groups cover committed-response loss, invalid receipt, failed commit, new mutation, and context changes. |
| Logo authorization response | C: protected receipt SQL denial classified as database outage | Map permission denial to 403, missing Brand to 404 and known conflicts to 409, without weakening database authorization or exposing SQL details. |
| Protected deletion response | C: associated-project count lost in lifecycle exception | Capture count in authorized SQL error detail while the Brand is locked; whitelist only a positive safe integer through server error mapping. Existing singular/plural Project guidance and retained Board links pass. |
| BW-36.15/R1 responsibilities; BW-36.16/R1 Canvas hierarchy | B: a legitimate 12-second background poll could hide a deliberately stale request or be counted as a forbidden mutation/presentation GET on slow runs | Stop the unrelated scheduled poll in these fixtures while retaining exact request-count assertions. Responsibility role tests still invoke the real competing refresh explicitly. No production polling or persistence change. |
| BW-36.18 source-capture browser snapshot | B: mouse motion plus the existing delayed cursor-clear timer could change the presence signature during a read-only dialog | Settle the existing cursor-clear timer and activate the snapshot-critical controls with the keyboard. Keep the entire Canvas/storage/undo/presence snapshot and no-write assertions unchanged. |
| BW-36.21B1 Home Intelligence; BW-36.21B2 Home Insights | B: deferred modal focus restoration and the ordinary dirty watcher could race keyboard/malformed-diagnostic assertions | Await responsibility-dialog removal and focus restoration; explicitly hold Learning reauthorization and assert focus during/after it. Settle deliberate Canvas edits before constructing malformed diagnostic snapshots; retain exact unavailable-state and no-write checks. The redraw focus regression now acquires native focus and refreshes in one browser task, verifies the old node was replaced and the new node retained focus, then independently checks focus and Enter navigation across the protocol. |
| CI Chromium selection | D: CI installs Playwright Chromium in its cache, while some fixtures default to the local `/usr/bin/chromium` path | The existing setup block exports the installed Playwright executable as `CHROMIUM_PATH`; the remaining hardcoded review-UX fixture now respects that variable. Local collection explicitly uses system Chromium. |
| PostgreSQL setup/concurrency fixture | B/D: grant preceded role setup; LOGIN had no password; deferred rejection handler raced | Create roles before grant; provision a generated disposable LOGIN password; attach rejection assertions before releasing competing transactions. Actual restricted LOGIN/independent connections are used. |

Categories: A obsolete source assumption; B outdated fixture; C runtime regression; D environment/tooling limitation; E security/data-integrity failure. Initial sandbox failures (unreachable proxy, missing packages, Chromium local socket denial) were D and were resolved by running authorized test commands outside the command sandbox through the configured proxy. They are not counted as passes. Early local four-minute collector caps also interrupted long switching/provenance/Advisor suites, sometimes after their assertions had printed PASS; those D failures were retained and the final collector uses a ten-minute per-block cap. Success requires the full process to exit successfully. Older overlapping diagnostic collectors were stopped when their competition for the two-core environment was identified; none is treated as a passing complete run. The final full-run inventory records every attempted block and any remaining category; no failed check was disabled, deleted or skipped.

### P1 Project fixture resolution

The R3 fixture now recognizes only the explicit protected creation function and verifies canonical normalized email, exact Workspace, UUID Brand/mutation identity, submitted Core, revision 1 and history event. Brand, Board, command and history remain transaction-local until COMMIT. Injected Brand/history/Board/snapshot/ownership/command failures and an absent function result leave all durable collections empty. Concurrent command retries create one Brand/Board/history/command; mismatched input still conflicts. The real PostgreSQL tests independently commit protected creation and Board insertion together, and prove that a real Board constraint failure rolls both Brand and history back.

The guided setup adapter and R3R1 VM consumer were corrected in the same pass; updating R3 alone would leave those required consumers broken. No catch-all SQL-function-success stub was introduced.

### P2 logo replay resolution

`pendingLogo` owns the original request, image bytes, action, expected logo revision and Workspace. A retry reuses that identity, so the server receipt is checked against the submitted `input.request_id`. A failed/unverifiable response retains both pending request and file. Exact receipt validation precedes clearing pending state, projection, file removal and readback. A stale account/Brand/Workspace response cannot mutate controller state. A same-surface generation refresh may resume the original request safely. A real-route regression also exposed the stale preview gate: after a committed response is lost, preview necessarily sees a newer revision. `submitLogo` now resolves that case with `X-Brand-Receipt-Only: 1` and the unchanged original request. The independently authorized logo endpoint returns an exact durable receipt or `RECEIPT_NOT_FOUND`; receipt-only requests cannot reach upload or mutation code. A missing receipt with an otherwise current revision is explicitly tested as non-mutating, and real restricted PostgreSQL verifies replay, changed-input conflict, account denial and anonymous denial through the actual HTTP handler.

The ten controller/production-route groups verify one logical history event and one stored object after lost response or malformed receipt, successful exact replay without a repeated upload, failure without false success, and a new ID only for a distinct subsequent mutation. Restricted PostgreSQL independently verifies durable logo receipts, revision isolation, Core preservation, and rollback when logo history fails. Committed-but-readback-unavailable behavior retains the existing synchronization-required flow.

### Canonical Core initialization safety proof

1. The production controller sends no request until explicit confirmation, current edit permission, current associated Board, exact authoritative saved snapshot, matching account/generation, and an exactly empty object Core are established. Missing, null, default-only and populated client values remain ineligible. UI presentation defaults do not become initialization intent.
2. The submitted command contains explicit `operation: initialize`, the expected canonical revision, Workspace, mutation ID, source Board ID and a deep-copied source snapshot. It never copies transient Canvas/Core state or starts autosave.
3. The server uses a SERIALIZABLE transaction. The protected function independently locks/authorizes the canonical Brand, active identity and Workspace membership; it independently verifies that the selected Board is associated with that Brand and Workspace and that its saved snapshot exactly equals both the submitted snapshot and candidate Core. Current canonical edit authority grants associated-Board edit access under the existing Brand-wide Board access rule; no client-supplied Board permission is trusted.
4. The database requires the existing Core to be exactly `{}`. Default-only/nonempty objects are rejected. Missing/SQL-null/JSON-null creation Cores are rejected instead of being converted to empty knowledge. Revision mismatch or PostgreSQL concurrent-update serialization failure rejects the stale operation; these initialization conflicts now map to HTTP 409 rather than a generic outage.
5. The same transaction captures full preimage/postimage Brand history. A history failure rolls back initialization and leaves the source Board untouched. Repeating the identical mutation returns the original receipt without another event or revision increment.
6. The database return value and matching history postimage are read back exactly in PostgreSQL. The HTTP response is sent after commit. The production UI verifies exact Brand ID, unchanged name, expected revision increment and deep-equal submitted Core before accepting success. Wrong identity, wrong revision, altered Core, denial or changed context never become confirmed initialization.

Evidence: 19 controller groups plus dedicated restricted-role PostgreSQL cases for successful initialization/readback/history/replay; default-only and accepted populated knowledge; missing/null creation; missing/cross-Brand/cross-Workspace source; changed source; independent concurrent canonical edit; authorization denial; and initialization history failure. This is a proof of the tested paths, not authorization for production activation. The pre-existing SERIALIZABLE architecture deviation still requires operator/SQL review for cutover.

### Real PostgreSQL, complete runtime suite and GitHub Actions

**60/60 real PostgreSQL 17.11 groups PASS** on a disposable local Docker cluster, with a generated restricted non-superuser/non-bypass LOGIN, RLS, independent connections and actual transactions. This includes exact postimage/history readback, initialization concurrency/rollback/isolation, Core/DNA/Avatar/unknown preservation, explicit and legacy writes, creation/Project atomicity, membership constraints, durable logo receipts and receipt-only HTTP replay. No production SQL was executed.

The migration intentionally supplies Brand protection grants only. A newly created restricted runtime LOGIN cannot insert Boards implicitly: the integration test first verifies that denial rolls back the newly created Brand/history. Subsequent Project transaction tests apply an explicit **disposable-fixture-only**, Workspace/owner-scoped Board INSERT grant/policy. Those fixture permissions are not a production migration or evidence that the production application's full role inventory is ready.

**196/196 registered Runtime Boot Safety run blocks PASS, 0 FAIL** in the completed final local run (691.26 seconds): 194 validation blocks plus two locally satisfied setup blocks. Both corrected Home suites pass (B1 17 groups, B2 30 groups). Every block exited successfully. Source fingerprints before and after the full run are identical; no runtime, SQL, fixture or workflow source changed during collection. Earlier full diagnostic runs (194/196 and 195/196) were not treated as success; their remaining Home fixture races were corrected before this complete clean run. The attached machine-readable evidence records each command, exit status, duration and output tail.

The local collector parses every `run` block in `.github/workflows/runtime-boot-safety.yml`, runs each block with Bash fail-fast semantics internally, records its exit status, and proceeds to the next block even after failure. Setup substitutions are explicit: installed declared dependencies are checked locally; system Chromium replaces the download/install step; the disposable PostgreSQL URL uses localhost port 55432 instead of the CI service's 5432. Check commands are otherwise identical. No production URL is used or substituted. The original check commands plus the new `check:bw36.23ar2` are registered in GitHub Actions.

GitHub Actions checks are bound to the current head of existing PR #802. The required job executes the same registered checks, with Playwright Chromium selected explicitly from the CI install. The final delivery report and PR checks record the observed terminal run URL/conclusion after push; local results do not substitute for that remote conclusion.

### Production activation remains blocked

- No merge/deploy/production SQL has been authorized or performed.
- Operator review must verify the actual deployed schema, immutable historical migrations, all grants/policies/triggers, existing service credentials, external writers/jobs and supported role topology.
- The complete application must retain separately provisioned Board/Canvas/Project/identity/catalog/member permissions under the restricted runtime role; the Brand migration alone does not supply these. The new fixture proves this limitation explicitly.
- Provision the review-signing key independently; confirm runtime identity and provider/storage access without granting Brand bypass rights.
- Verify independent database and asset backups and restore procedures, retained historical logo references, retention ownership and separately approved cutover/rollback.
- Review the initialization SERIALIZABLE design and production lock/retry behavior, and complete client restart/reconciliation coverage beyond the tested live-controller receipt flows.
- Passing recovery CI is review evidence, not production activation approval. Historical recovery and Phase B restore/history UI remain outside this PR.
