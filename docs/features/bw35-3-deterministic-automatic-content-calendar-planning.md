# BW-35.3 — Deterministic automatic Content Calendar planning

## Prior state and scope

BW-35.1 and BW-35.2 remain authoritative for canonical schedules and the unified calendar. BW-35.3 adds a temporary preview and one Board-scoped atomic persistence command. It does not publish, contact a social provider, optimize engagement, recur, export CSV, or replan existing schedules.

## Proposal engine and defaults

`automatic-planning.js` is the single pure, dependency-free (apart from the shared bounded timezone resolver) proposal engine. Its default is Monday–Friday, the saved `defaultPlanningTime`, one post per day, and 28 inclusive calendar days. The start is the later of today and the visible future period. All represented channels are included unless a channel filter is supplied.

Exact Social Media Posting records are ordered by canonical Board index and then stable node identity. Existing schedules are copied to the result and consume capacity; they are never modified. Finalized, publishing, unauthorized, malformed, already scheduled, non-social, and otherwise canonically ineligible records receive one bounded exclusion reason. Invalid temporal candidates and insufficient capacity receive bounded unplaced reasons.

Candidate dates follow selected weekdays. Unique strict `HH:mm` times are sorted, resolved with the shared IANA timezone/DST resolver, and filtered for existing collisions, daily capacity, and optional minimum spacing. Gaps are rejected; overlaps use the selected canonical disambiguation.

### Exact balanced distribution algorithm

Let `K = min(N, M)`, where `N` is ordered eligible posts and `M` is ordered valid slots. For post index `i` from zero through `K - 1`, choose slot index:

`floor(((2 × i + 1) × M) / (2 × K))`.

This is the integer midpoint of each of `K` equal partitions of the available sequence. For `K <= M`, indices are strictly increasing and unique. Posts retain Board order, selected slots retain chronological order, and excess posts are explicitly unplaced. There is no random input or “optimal time” claim.

## Proposal session and adjustments

The bounded session owns normalized settings, proposal version, minimal ID-to-schedule placements, excluded/unplaced categories, dirty identities, original Board revision, and lifecycle generation. It contains no Board clone, DOM, captions, media, credentials, provider responses, or history. Cancel, apply success, regeneration, access/lifecycle change, unmount, and stale authority clear or invalidate it.

Month/week movement and Schedule/Change time are proposal-only operations while preview is active. Validation covers range, timezone, DST, capacity and collisions. An intentional manual placement outside selected weekdays is accepted only through the explicit manual-adjustment option and is visibly marked; it must remain within the selected range and canonically resolve. Returning a card to proposal backlog removes its placement. These operations neither fingerprint nor write authority.

## Planning studio and accessibility

Editors and owners see **Auto-plan** in the calendar toolbar; viewers receive no mutation control. The responsive right-side studio opens with an immediate proposal, concise controls and summary, R9 platform icon/accent reuse, strong proposal badges, keyboard-native fields/buttons, visible focus inherited from the calendar, live status text, reduced-motion behavior, dark/light tokens, and a mobile full-height layout. English and German strings cover controls, state, failures, apply and Undo terminology.

## Atomic batch contract

`PUT /api/boards/:id/posting-schedule/batch` accepts only `posting_schedule_batch_v1`, Board identity/revision, a bounded request ID, and 1–100 strict schedule commands. Each command contains node identity, expected schedule revision/status, v2 publication-material fingerprint, and the canonical schedule or `null`. Unknown keys, duplicates and oversized batches are rejected.

The authenticated service requires `canEdit`, begins one transaction, locks the Board row once with `FOR UPDATE`, verifies the Board revision once, and validates every node, exact type, revision, editorial state, v2 fingerprint, publication protection and canonical time before changing any node. It detects collisions inside the batch. Only targeted `planningSchedule` fields and retired legacy schedule aliases change. One failure rolls the complete transaction back. Captions, titles, media, approval data, publication records, provider state, unrelated nodes and Board metadata remain intact.

The response is bounded snake_case authority: result code, correlation ID, new Board revision, allowlisted per-node schedule projections/revisions, and counts. It never returns a Board, caption, media, provider identifiers/URLs, tokens, encrypted values, or raw errors.

## Client reconciliation, rollback, concurrency and Undo

Apply freezes the preview, resolves current nodes, rechecks Board lifecycle/revision/access, computes current v2 fingerprints, and sends exactly one request. No optimistic canonical write occurs. A validated identity-complete response replaces schedules in one local authoritative snapshot without a full reload. Malformed, incomplete, stale or uncertain responses leave prior authority and the proposal preview intact.

A complete-plan Undo uses the same batch boundary with the returned Board and schedule revisions and the exact captured prior schedules. It is bounded by the existing Undo window and invalidated by later authority; therefore it cannot overwrite newer work. The server revalidates every lock and rolls back as one unit. Failed Undo retains the applied authority.

Diagnostics allow only correlation/lifecycle categories, bounded counts/stages/result codes, revision presence and elapsed category. IDs, content, media and provider data are prohibited.

## Deployment and rollback

No database migration is required: schedules remain in `boards.canvas_json` under the existing canonical shape. Deploy the engine/browser asset, route, contract, service and UI together. Rollback removes the new route and client surface; existing canonical schedules remain valid and untouched.

## Acceptance procedure

Use a Board containing eligible unscheduled, scheduled and locked posts. Open Auto-plan and verify immediate weekday/one-per-day/four-week distribution; change weekdays, time slots and channel filters; move, retime and backlog a proposal; verify no write; cancel and verify no request. Reopen and apply once; verify one batch request, one atomic reconciliation and no Board reload. Undo and verify the entire prior schedule set returns. Force stale authority and a one-command validation failure; verify zero partial writes and a retained preview. Repeat as viewer, in English/German, light/dark, desktop/mobile and keyboard-only. Network inspection must show no provider request.

## Non-goals

CSV export, provider scheduling/publishing, recurrence, automatic publishing, engagement/AI recommendations, provider review work, automatic replanning and modification of publication material or approval state are explicitly excluded.
