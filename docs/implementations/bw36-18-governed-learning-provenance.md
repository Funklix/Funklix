# BW-36.18 — Governed Learning provenance capture

Based on latest GitHub main `30cf2aebb868735fa978bd5c0682cf51a2f19a86` (merged BW-36.17R2). No migration is introduced or edited. R2 and its historical pre-activation verification are unchanged.

## Behavior and contract

The existing Inspector Node Actions contains one `type="button"` action: “Propose Brand Learning” / “Markenwissen vorschlagen”. Eligibility requires one persisted selected Node, a saved Board, current authorized Brand owner/admin/editor catalog membership, Board read access, a signed-in account and no public-share context. Eligibility is presentation only; server authorization is independent. No Board saving, Canvas mutation or automatic extraction occurs. The action is both hidden and disabled when eligibility is missing; explicit display handling respects the existing Inspector CSS.

The dialog is appended to document.body, outside node-form. It shows server-derived receiving Brand, Board and Node labels, an initially empty manual statement, optional evidence, “Save as pending” and Cancel. It uses existing Learning normalization, dialog styling and EN/DE copy. Escape is contained within the dialog, Tab wraps, cancellation protects dirty text, and focus returns to the action. The new Inspector action is excluded from existing editing-presence field detection. The proposal module has no Board, activity, undo, presence or local-storage writers; normal background presence timers remain active.

`GET /api/brands/:id/learning-source?board_id=…&node_id=…&expected_board_updated_at=…` is an authenticated read-only operation, with private/no-store responses and no public-token contract. It returns `brand_learning_source_v1`, Brand ID/name/revision, the three-field source contract, and bounded Board name, Node title and Node type. It returns no Node content, hidden Canvas payload or identity IDs.

Existing Learning POST accepts one optional `source` object containing exactly `board_id`, text `node_id` and `expected_board_updated_at`. Manual creation remains additive and unchanged. Unknown fields, client labels/snapshots/source type, status/reviewer/actor, and PATCH source replacement are rejected. The existing `expected_brand_revision` is required for creation.

The Board API serializes PostgreSQL timestamps at millisecond precision. Preview accepts that exact millisecond representation and returns the persisted six-digit UTC timestamp; source-backed POST compares that full timestamp in PostgreSQL. A timestamp differing even within one millisecond is stale at POST. Stale Board or Brand responses retain statement/evidence and disable submission until explicit source validation; refresh reads the Board, obtains a fresh authorized preview, and requires another explicit Save. This does not modify the Canvas snapshot, dirty state or autosave. Asynchronous responses and saves are bound to account, Workspace generation, Board/load generation and selected Node; switching retains text but prevents submission from the obsolete context.

On success, confirmation says the Learning awaits human review and offers an explicit action to open that receiving Brand's Learnings section. No source-navigation link is added.

## Security and transaction boundaries

Preview and mutation resolve the existing verified signed session to exactly one active application identity, then verify current Brand access. Both enforce Brand owner/admin/editor for source proposal capability; Brand viewer, Board-only and Workspace-only roles cannot substitute for Brand authority. The existing `_board-access.js` read contract executes with the same transaction client. Exact Board-to-Brand association, non-null consistent Board/Brand Workspace IDs, exactly one matching persisted text Node ID, supported Canvas Node type and bounded derived source labels are required.

Existing order is identity → Brand → Brand membership → Learning. Source validation adds a shared Board lock through commit. Existing Board operations may lock Board before Brand, so the new Board lock uses NOWAIT: contention aborts the transaction and returns bounded DATABASE_UNAVAILABLE rather than creating a Brand/Board wait cycle. Identity and Brand membership SHARE locks preserve disable/revocation boundaries; Brand UPDATE locks serialize Learning mutations, revision checks, duplicate protection and owned deletion. Preview holds Brand SHARE locks. No authorization query uses a second pool client.

Learning insert and proposal event share the existing transaction. The immutable row holds `source_type=campaign_observation`, exact Board UUID, exact text Node ID such as `node-1`, and bounded name/title/type snapshots (200/300/100 characters). Initial state remains proposed, revision zero, no reviewer. All lifecycle event snapshots include permitted Board UUID/display snapshots but consistently omit optional `source_node_id`, including edit, review, archive, supersede and successor events. This satisfies the exact R2 UUID-only optional event Node constraint without fabricating a UUID or weakening a CHECK.

Approved-source successors copy the original complete immutable provenance on the server; they do not validate or replace the historical origin. Human edit/review/archive and successor workflows therefore operate after source deletion. R2's immutable row trigger, append-only event guards, RLS, grants, identity relationships, duplicate indexes and Brand cascade remain intact.

Library and mutation projections independently reauthorize current source read and current Board/Brand/Workspace association. Safe source context uses current bounded labels only after this check. Missing/deleted/reassociated/ambiguous/unsupported source data returns only `{available:false}` and localized “Source unavailable”. No historical snapshots or source identifiers leak through history projections; historical provenance remains stored. Source lock contention fails the request closed. Historical labels never grant authority.

## Post-activation verification

`scripts/sql/bw36-18-learning-provenance-verification.sql` is read-only and is not executed against production during development. It retains R2's exact catalog, lifecycle, relationship, RLS, privilege and append-only checks. It replaces the pre-activation no-provenance gate with checks for complete source capture, a revision-zero proposal/successor origin event created in the same transaction by the same proposer, matching Board/display provenance, omission of event Node IDs, unchanged manual provenance and successor inheritance. Disposable tests accept legitimate capture and reject a campaign record lacking its matching origin event.

Keep the operator's R2 pre-activation result and activation/deployment evidence. Consistency checks and immutable triggers distinguish permitted application capture from an incomplete historical backfill; a post-only query cannot prove that a privileged operator never disabled guards and fabricated matching history. No historical migration, pre-activation result or production baseline is rewritten.

## Validation and limitations

`npm run check:bw36.18` executes the real production source validator, Learning service and signed-session routes, exact original/R1/R2 SQL in disposable PGlite PostgreSQL 17, and local authenticated Chromium. Database coverage includes owner/admin/editor, viewer/Board-only/Workspace-only/anonymous/public-token/invalid-identity denial, metadata forgery, exact text IDs, wrong association/Workspace, missing/duplicate/unsupported Nodes, stale Board/Brand, timestamp precision, bounded snapshots, immutable provenance, duplicate protection, event failure rollback, source suppression, Node/Board deletion, review/successor after deletion and owned Brand cascade. Browser coverage includes no opening/typing/cancelling writes, retained text and explicit stale resubmission, save-time revocation, Board/account/Node switching, EN/DE, light/dark, widths 1440/768/375/320, keyboard/Escape/focus restoration, Inspector eligibility and explicit Learnings handoff. Focused transports allow only local fixture traffic; no provider, AI or production database calls occur.

PGlite validates PostgreSQL SQL/constraints and transactional rollback; it is not a separate-process PostgreSQL contention benchmark. NOWAIT contention is fail-closed with retry and does not auto-resubmit. Current library pagination and history limits are unchanged. No AI extraction, consumption, category, analytics, automatic approval, AI Brain integration or source navigation is included.

Relevant registered BW-36, Content Workspace, Workspace/Brand deletion and CSV/PDF export suites are run without changing their assertions. R1's disposable Board fixture is expanded with the existing Board columns needed by current source projection; historical SQL and security assertions remain unchanged.

## Manual smoke test after reviewed deployment

1. As Brand owner/admin/editor, open a saved Brand-associated Board and select one persisted Node. Confirm the action is absent/disabled for unsaved changes, multiple selection, Brand viewer and public-share mode.
2. Open the proposal. Verify receiving Brand and source labels, empty statement, manual evidence, Tab/Shift+Tab, Escape dirty confirmation, cancellation and restored Inspector focus. Confirm Canvas content, connections, selection, adaptive view and saved state are unchanged.
3. Write a manual statement and Save as pending. Open that Brand's Learnings with the explicit success action; confirm Needs review, authorized source context and human approval controls.
4. Change the saved Board or Brand in another authenticated context before saving. Confirm text survives rejection; validate the source again and explicitly resubmit. Revoke Brand write access before saving and verify denial with no proposal/event write.
5. Review and propose an update after deleting the source Node/Board. Confirm generic Source unavailable, working governance and unchanged historical origin. Check EN/DE, light/dark and narrow layouts.
6. An authorized operator may run the new read-only post-activation verification after retaining deployment evidence; require every boolean true and `overall_readiness=ok`. Do not rerun or reinterpret R2's historical pre-activation no-backfill gate after legitimate capture.

## Changed files

- `api/_brand-learnings.js`
- `api/brands/[id]/learning-source.js`
- `app.js`
- `canvas-learning-proposal.js`
- `brand-learnings.js`
- `brand-profile-setup.js`
- `index.html`
- `language.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `scripts/check-bw36-18-governed-learning-provenance.js`
- `scripts/fixtures/bw36-18-browser.js`
- `scripts/fixtures/bw36-17-local-runtime.js`
- `scripts/check-bw36-17r1-learning-provenance-schema.js`
- `scripts/sql/bw36-18-learning-provenance-verification.sql`
- `docs/implementations/bw36-18-governed-learning-provenance.md`

## Final local evidence

All 36 historical registered BW-36 checks passed, including BW-36.17 authenticated Chromium, R1's 23 database scenarios and R2's 46 recovery scenarios. All nine Content Workspace/Workspace-Brand deletion/CSV-PDF export checks passed. Board-access roles, canonical Brand foundation, browser script integrity (41 classic scripts), Canvas density, Canvas component polish and Canvas dark-mode controls passed. The final BW-36.18 run passed 11 database/security groups and authenticated Chromium. Final affected Canvas BW-36.16/R1, Brand lifecycle BW-36.13R5 and Learning BW-36.17 browser regressions passed after the final integration fixes. Changed JavaScript syntax and `git diff --check` passed. These are local results; GitHub Actions runs independently on the PR.
