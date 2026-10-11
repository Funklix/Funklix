# BW-36.17 — governed Brand Learnings

## Architecture and ownership

Baseline: live `origin/main` `9acc0373e0d4c464f7c7c4542b6e11e3468a6fb2`, including BW-36.16R1. The initial cached remote ref was older; the live GitHub tree was retrieved and its exact tree hash verified, then the Git transport fetched the current baseline and ancestry. One implementation branch: `codex/bw36-17-governed-brand-learnings`.

Reconciles `docs/audits/bw36-3-brand-workspace-and-governed-learnings-audit.md` with the later reusable Profile, signed-session/application-identity bridge, Workspace catalog and authorized deletion implementations. The reusable `brands` row is the ownership boundary. The audit's original sidebar-only Workspace assumption is superseded. Brand Profile owns proposals, human review, approved knowledge and history. Campaign Brand Snapshots remain independent. This phase deliberately excludes the audit's categories/tags, semantic conflict detection, AI suggestions, consumption, notifications and campaign capture.

No AI system approves a Learning. No generation, provider request, campaign analysis, analytics ingestion, automatic proposal, AI Brain change, prompt injection or consumer was added. Reserved source types do not activate future functionality.

## Storage and invariants

Exactly one ordered additive migration: `migrations/20261011_bw36_17_governed_brand_learnings.sql`.

`public.brand_learnings` stores UUID ID, required Brand FK, status (`proposed`, `approved`, `rejected`, `archived`), normalized statement (1–2000 Unicode code points), SHA-256 normalized comparison key, source type (`manual`, `campaign_observation`, `ai_suggestion`), nullable Board FK/node identifier (1–200 characters), optional evidence (1–4000 characters), proposing identity FK, reviewing identity FK/time, same-Brand predecessor FK, nonnegative BIGINT revision, and creation/update timestamps. IDs never move between Brands. Proposed records have no reviewer; every reviewed/inactive record has a reviewer/time. BIGINT values cross the API as decimal strings without precision loss.

`public.brand_learning_events` stores UUID ID, required Brand FK, composite same-Brand Learning FK, event type, actor identity FK, previous/next status, Learning revision, bounded allowlisted snapshot and event timestamp. Snapshots contain only statement, evidence summary, source type and predecessor ID. Event types are `proposed`, `proposal_edited`, `approved`, `rejected`, `archived`, `successor_proposed`, `superseded`. A successor starts with a `successor_proposed` event. Approving it records its approval plus both superseded and archived events for the original. History is append-only; UPDATE, individual DELETE and TRUNCATE are guarded. No individual Learning deletion endpoint exists.

Indexes cover Brand/status/update ordering, predecessor lookup, unique proposed comparison keys, unique approved comparison keys, one open successor per original, and Brand/Learning/time history lookup. Comparison keys are fixed 64-character hashes to avoid PostgreSQL B-tree entry size failures for long multibyte statements. SHA-256 collisions conservatively reject a duplicate; there is no fuzzy or semantic matching.

Normalization runs on the server: NFKC, trim, collapse JavaScript Unicode whitespace, then locale-independent Unicode lowercase for comparison. Statements retain normalized presentation case. Unpaired surrogates and control characters are rejected. Evidence follows the same text bounds/normalization. Empty optional evidence becomes NULL. No raw provider payload, raw prompt, Board snapshot, session, token or unrelated Brand data is stored in events.

Both tables enable RLS with **no browser policies**, and revoke all privileges from PUBLIC, anon and authenticated. The existing privileged server PostgreSQL pool is the sole transport. No browser Supabase query or runtime Learning schema creation was added.

## Authorization and transactions

Every list/mutation starts a transaction, resolves the verified signed-session canonical email to exactly one active `app_identities` row and holds that identity FOR SHARE. Missing, disabled, ambiguous and mismatched identities fail closed. The feature never uses `auth.uid()`, `auth.users`, browser email, public tokens or Workspace membership as authority.

The explicit predicate mirrors `_brand-access.js`: `brands.owner_email = canonicalEmail` or a `brand_members` role of admin/editor/viewer. Owner/admin/editor may read, propose, edit, approve, reject and archive. Viewer reads only. Workspace owners/admins, Board owners/editors/viewers and Board-only collaborators gain no implicit Brand authority. Unrelated or absent Brands return the same bounded unavailable response; this prevents catalog enumeration. A known viewer mutation returns access denied.

Read operations lock the Brand FOR SHARE; mutations lock it FOR UPDATE. Identity and membership FOR SHARE locks prevent concurrent disable/revocation from completing between authorization and commit. The Brand lock serializes same-Brand Learning changes and the existing Brand deletion flow. No Workspace authority is broadened, and no existing membership/Board authorization code changes.

All mutation effects and events commit together. On any failed event, lifecycle check, database constraint, conflict or commit, the transaction rolls back. Service transport alone never grants access.

| Action | Required current state | Result |
| --- | --- | --- |
| Manual create | Authorized writable Brand + expected Brand revision | New `proposed`, `manual`, revision 0 |
| Edit proposal | `proposed` + expected Learning revision | Same ID, changed normalized text/evidence, revision +1, edit event |
| Propose update | `approved` + expected Learning revision | New proposed successor, revision 0; original untouched/active |
| Approve | `proposed` + expected revision | Approved with human reviewer/time, revision +1 |
| Approve successor | Proposed successor + expected revision + original still approved | Original archived/revision +1 and successor approved in one transaction |
| Reject | `proposed` + expected revision | Rejected with reviewer/time, revision +1, retained history |
| Archive | `approved` + expected revision | Archived/revision +1, retains original approver/time and history |

Rejected and archived records cannot be edited/reactivated in this phase. A proposed successor whose original is already archived cannot be approved. Another proposed successor for the same active original is rejected. Revision guards forbid decreases, skipped increments, ownership/provenance changes and silent approved statement/evidence edits.

## Existing authorized Brand deletion

The existing `_brand-deletion.js` locks the owned Brand, confirms its name, detaches Boards, deletes memberships, then deletes the Brand. The new Brand FKs use ON DELETE CASCADE. Learning/event history guards allow deletion only when the owning Brand no longer exists, which is true during that Brand cascade. The same-Brand self FK uses statement-end NO ACTION validation, so deletion of all Brand descendants leaves no orphaned successor. Events additionally cascade from their composite Learning FK. Identity FKs use RESTRICT; source Board FK uses SET NULL for the reserved future relationship (no sources are populated in this phase). There is no second Brand deletion path. Existing Boards, snapshots and content survive unchanged through the established flow.

## API contract

`GET /api/brands/:id/learnings?status=all&offset=0`: only `proposed`, `approved`, `rejected`, `archived`, `all`; numeric offset 0–10000; max 50 records plus `has_more`. Counts are aggregated separately for all Brand statuses. Records order proposed first, approved second, then rejected/archived, newest updates first with stable ID tie-break. Each returned Learning has at most 10 recent events, with statement/evidence summaries capped at 500 Unicode code points each, including human-readable actor labels, statement/evidence snapshots and dates. Member display names are bounded; absent names use a localized safe Brand-member label. Identity IDs/emails and statement hashes are excluded from browser projections. This is a bounded history summary, not a complete audit export.

`POST`: exactly `statement`, optional `evidence_summary`, required `expected_brand_revision`. No status/source/identity/Board/node fields accepted. The server sets proposed/manual/actor/revision/timestamps.

`PATCH`: `action` (`edit`, `approve`, `reject`, `archive`), `learning_id`, required `expected_revision`; only edit also accepts statement/optional evidence. Editing an approved record creates a successor. No hard deletion, rejection-note feature or AI endpoint.

Responses use `contract: brand_learnings_v1`, authoritative Brand context, capabilities, counts, records and optional mutation result. Cache-Control is private/no-store. Errors return only a bounded code: authentication required, invalid identity, Brand unavailable/access denied, Learning unavailable, invalid request/statement, duplicate proposal/approved Learning, stale Brand/Learning revision, invalid transition, schema/database unavailable or internal error. UI copy localizes these codes in EN/DE. Database messages, SQL, table names, email/session/provider contents never reach error copy.

Duplicate checks run inside the Brand transaction and unique partial indexes guard races. A manual proposal identical to an active approved Learning is also rejected. A successor may retain the original statement when revising evidence; only its own explicitly referenced approved predecessor is exempt from duplicate comparison, and that predecessor is archived before successor approval in the same transaction. A repeated network mutation may produce a duplicate/conflict rather than claiming an unverified save; the user can inspect current state.

## Brand Profile experience

Learnings is a first-class guided section between Brand Avatar and Team/permissions. Both languages display the `Learnings` header; subtitle is exactly “Build reusable Brand knowledge from confirmed experience.” / “Bestätigtes Markenwissen aus Erfahrungen aufbauen.”

Governance counts are independent of the unchanged Brand setup-readiness contract. The default shows Needs review followed by Approved; compact counts show Needs review, Approved, Archived. Restrained filters also expose Rejected, Archived and All. Proposal/approved cards include source Manual, proposer, creation/update dates, evidence, human approval details, predecessor relationship and a human-readable expandable history. Inactive records remain visible through their filters/history. Pagination bounds large libraries; an original-link action loads the first All page and focuses its original when present there. Full snapshots and older history beyond the last 10 events remains durable; full audit browsing is deferred.

Writable roles see Add learning, proposal Edit/Approve/Reject, approved Propose update/Archive. Viewers see read-only copy and no active mutation controls. Internal modal dialogs have text entry or exact-statement/Brand/source confirmations. Approval explicitly explains reusable Brand knowledge. Rejection requires its explicit action; closing is not rejection. Archive explains retained history/inactive knowledge. No auto-approve option, native alert/confirm/prompt or typed Brand-name requirement.

The Learning dialog tracks normalized statement/evidence changes independently of Brand Core. Untouched or whitespace-equivalent content does not trigger discard confirmation; actual unsaved changes require an internal discard choice. Successful mutations close the editor and clear its draft baseline. Stale conflicts preserve local text, display inline feedback, offer current-state reload, display the currently saved statement and require another explicit save/review. Status changes block stale actions. Review reload updates the exact statement shown in the confirmation. Authentication/access loss suppresses mutations and retains unsent text until closing. Requests have a 12-second timeout and there is no automatic retry loop.

Profile navigation without edits never invokes Save/Discard. Existing logo acquisition/persistence, Brand DNA, Brand Avatar, Core unknown fields, Campaign Sync and guided editing remain intact. No global sidebar/catalog Learning counts/statements are added. Canvas/Tasks/Calendar/Posting Plan/exports are unchanged.

## Migration, verification and deployment

No production SQL was executed. Execution requires the operator after merge, against the correct Supabase project. The SQL is intentionally non-idempotent: a second execution refuses and rolls back rather than changing guards or duplicating schema. Existing foundation/identity migrations must already be installed.

1. Review and manually merge the one normal PR; never merge automatically.
2. Open the correct Supabase project and identify a quiet execution window.
3. Capture the final existing-data aggregate SELECT in `scripts/sql/bw36-17-verify-governed-brand-learnings.sql` as a pre-execution baseline. It returns counts/aggregate fingerprints only, including Board snapshots and memberships.
4. Open the **merged** `migrations/20261011_bw36_17_governed_brand_learnings.sql` file.
5. Copy the complete raw SQL without modification and execute it **exactly once** in Supabase SQL Editor.
6. Capture the success result. If refused/error: capture the exact error and **stop**; do not edit around guards or rerun a modified fragment.
7. Run the complete separate read-only verification SQL. Confirm both tables, RLS, zero policies/browser grants, statuses, six required indexes, five lifecycle/history triggers, eight validated FKs, same-Brand boundaries/cascades, and zero initial Learning/event rows.
8. Compare the existing-data aggregate fingerprints/counts to the captured baseline. A single after-only query cannot establish absence of earlier mutations; unrelated concurrent writes invalidate that comparison.
9. Deploy/reload the application bundle, including both new browser assets and the server route/service.
10. Perform browser acceptance below and capture results. Do not create automatic historical Learnings.

If code deploys before migration, the Profile continues to load normally. Opening Learnings makes one bounded failed request, shows localized temporarily unavailable copy and a manual Retry action. Switching sections does not create a request loop or break other features.

## Verification and acceptance

`npm run check:bw36.17` runs dependency-free production route/service checks with an invented transaction transport plus authenticated Chromium over the real application DOM/assets and real signed-session server handlers. Chromium dependency/executable resolution follows the repository's existing test convention. No production connection or provider request is permitted by the fixture.

The optional `scripts/check-bw36-17-local-postgres.js` executes the exact migration, verification SQL and production service against disposable PGlite PostgreSQL. Reproduce with `npm install --prefix work/pgtest @electric-sql/pglite --no-save --package-lock=false --ignore-scripts --no-audit --no-fund`, then `node scripts/check-bw36-17-local-postgres.js`. It verifies constraints, browser-role denial, approved immutability, event append-only/TRUNCATE restrictions, cross-Brand FK rejection, real successor SQL, rejection/archive and Brand cascade. It uses only invented local rows and adds no production dependency. PGlite does not establish deployed Supabase grants, connection privileges or concurrent-lock performance; post-merge verification remains mandatory.

Manual deployed acceptance:

- Authorized owner/admin/editor: empty section; create manual proposal; close/reopen and confirm persistence; edit and revision increment/clean navigation; explicit approve; reload and confirm approved state; normalized duplicate rejection.
- Propose update: original stays active, new proposal needs review; approve successor and confirm original superseded/archived and retained history. Create/reject another proposal, verify rejection persists and close alone does not reject. Archive approved knowledge and confirm inactive history.
- Two browser contexts: stale edit/review cannot overwrite; reload retains unsaved text, shows current saved content and requires an explicit follow-up action. Check access revocation, missing/disabled identity and viewer suppression. Confirm Workspace-only, Board-only and public-token users cannot enter the Library or call its API.
- EN/DE, light/dark, 1440/1024/768/480/375/320px and 720×450 equivalent 200% reflow: stacked content, no horizontal overflow, 44px actions, visible keyboard focus, Tab/Shift+Tab trap, Escape, focus return, live feedback. Include actual 200% browser zoom and assistive-technology contrast checks in deployed acceptance.
- Open/close without edits and after save: no false Save/Discard. Logo, DNA, Avatar, existing Profile navigation and Campaign snapshots persist. Confirm zero provider/AI requests and zero unrelated writes.

Privacy: Learning text/evidence is intentionally human-entered Brand knowledge, not telemetry. No Learning statement or evidence is logged or added to catalog/sidebar/provider prompts. Session/identity lookup uses existing server authority. Browser account/Profile invalidation destroys Library state and dialogs. Brand deletion intentionally deletes its owned Library/history; individual history deletion is blocked.

## Rollback and deferred phases

Before adoption, revert the application bundle if needed. Additive empty tables/functions may be removed only through an operator-reviewed rollback. After **any** Learning/event row exists, do not blindly drop/truncate tables: disable the feature in the application and roll forward while preserving history. No rollback SQL is run automatically and existing Core/snapshots require no rollback.

Deferred: AI Brain suggestion/consumption, campaign observations and authorized source capture, analytics evidence ingestion, category/tag/search expansion, semantic contradiction handling, complete paginated history/export and notifications. Reserved source enums cannot be submitted by this phase's browser contract.

## Changed files

- `.github/workflows/runtime-boot-safety.yml`, `package.json`: focused check and syntax registration.
- `migrations/20261011_bw36_17_governed_brand_learnings.sql`: single additive schema.
- `scripts/sql/bw36-17-verify-governed-brand-learnings.sql`: separate manual read-only verification/baseline.
- `api/_brand-learnings.js`, `api/brands/[id]/learnings.js`: governed service and authenticated API.
- `brand-learnings.js`, `brand-learnings.css`: localized Library/cards/dialogs.
- `brand-profile-setup.js`, `index.html`, `language.js`: guided section and asset registration; existing sections preserved.
- `scripts/check-bw36-17-governed-brand-learnings.js`, `scripts/fixtures/bw36-17-local-runtime.js`: focused service and production-shaped Chromium regression.
- `scripts/check-bw36-17-local-postgres.js`: optional repeatable disposable SQL validation.
- This operations record.

### Local validation record

Focused authenticated Chromium and the disposable PostgreSQL-compatible migration/verification/service checks passed. All 189 validation commands in Runtime Boot Safety passed in declared order, including Brand guided setup/lifecycle/team/deletion/catalog/sidebar, Canvas BW-36.15/BW-36.16/R1, calendars/Posting Plan/CSV/PDF, script integrity and changed-file syntax. The separate npm provisioning command succeeded. The exact `npx playwright-core install --with-deps chromium` setup command could not switch to root (`su: Authentication failure`); local browser checks used the already installed `/usr/bin/chromium`. This is a local setup limitation, not a claim that that installer passed. A transient historical deletion-dialog sizing assertion passed unchanged on rerun. No historical assertion was weakened. GitHub CI must run the unchanged setup and full workflow on its normal runner.

`git diff --check` and the full diff against origin/main passed. External activity was limited to authorized GitHub/Git delivery and package installation for local fixtures: no production SQL, external AI/provider request, or real application-data mutation. Deployment and operator Supabase verification remain post-merge work.
