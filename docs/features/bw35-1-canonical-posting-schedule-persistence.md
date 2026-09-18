# BW-35.1 — Canonical Posting Schedule Persistence

## Prior behavior

Manual planning changed browser state immediately and relied on a later whole-Board autosave. The active Content Workspace understood `planningSchedule`, while the shell calendar and several labels still read the retired `social.scheduled*` aliases. A success message could therefore precede durable persistence, and an old browser snapshot could replace unrelated Board changes.

## Canonical contract

`node.planningSchedule` remains the only scheduling authority. A version 1 record contains `version: 1`, an ISO `scheduledAtUtc`, strict `localDate` (`YYYY-MM-DD`) and `localTime` (`HH:mm`), an explicit IANA `timeZone`, `disambiguation`, bounded `scheduledBy`, ISO creation/update instants, a positive `scheduleRevision`, the advisory publication-material `assetFingerprint`, and `scope: internal_planning`. `schedule: null` is the sole unschedule command. Empty or partial objects are invalid.

Legacy `social.scheduledDate`, `scheduledTime`, `scheduledAt`, and `addedToCalendar` remain a bounded read fallback. They are never newly written and are removed only when that node is deliberately scheduled or unscheduled through the canonical boundary.

## Authenticated write boundary and authorization

`PUT /api/boards/:id/posting-schedule` accepts one allowlisted command for one opaque node ID. It authenticates the session, validates the path/body Board UUID and complete payload, resolves established Board access, and requires `canEdit`. Owners, Board editors, unowned authenticated editors, and established Brand write roles therefore follow the existing capability contract; viewers, public/read-only users, and anonymous callers cannot write. The server re-resolves the node from the requested Board and requires its exact type to be `Social Media Posting`.

The response is an allowlisted authoritative envelope containing only Board/node identity, the canonical schedule (or `null`), and the new Board revision. It contains no content, provider identifier, destination, credential, token, or provider response.

## Validation and deterministic storage

The shared server contract rejects unsupported properties, arrays and non-plain objects; invalid or overlong identifiers; invalid revision/material/status expectations; malformed or impossible dates; invalid times; unknown/non-IANA timezones; unsupported DST disambiguation; nonexistent local times; and ambiguous local times without `earlier` or `later`. It calculates and stores UTC from the supplied local components and timezone. It never infers the server timezone or stores a localized display string.

## Concurrency and preservation

The service opens a transaction, takes a `FOR UPDATE` lock on the current Board, checks the exact Board revision, schedule revision, node editorial status, and current v2 material fingerprint, then changes only the selected node's `planningSchedule` inside the locked current `canvas_json`. This prevents a client Board snapshot from becoming mutation authority. Every unrelated node, Board metadata field, node content field, approval field, and publication-material field is retained from the locked record. Conflicts reject atomically with stable bounded codes.

The browser refuses scheduling while unrelated local Board edits are unsaved. It prevents duplicate node submissions, retains the previous schedule until a structured server success arrives, applies only the returned authoritative schedule/revision, and restores controls on every exit.

## Approval and publication invariants

Scheduling does not change status, `approvedContentFingerprint`, `approvalMetadata`, caption, media, or approved publication material. `planningSchedule` remains excluded from approval material; its `assetFingerprint` is advisory provenance only. Facebook and LinkedIn publication-material contracts are unchanged.

Before mutation, the server rejects editorial `Scheduled`/`Published` nodes and checks durable external-post and publish-job state. Confirmed, delivering, delivered, or outcome-unknown publication state is protected as finalized. Scheduling neither calls a provider nor creates a publish job, attempt, or external post.

## Browser reconciliation and rendering

The existing dialog now calls the authoritative route and reports success only after persistence. Failures use bounded English/German messages for invalid input, authorization loss, unsaved/stale conflict, finalized publication, duplicate pending submission, and generic failure. Existing cards, list state, Canvas labels, Inspector defaults, Content Workspace Calendar, and shell Calendar View prefer canonical `planningSchedule`; only the bounded legacy reader fallback remains.

## Diagnostics privacy

Server diagnostics contain only a generated request ID and bounded failure classification. They never log request bodies, captions, content, destination/provider identifiers, tokens, credentials, or raw provider responses.

## Changed files

- `api/posting-schedule/contract.js`: strict scheduling command and timezone conversion.
- `api/posting-schedule/service.js`: locked, revision-checked narrow persistence service and finalized-publication guard.
- `api/boards/[id]/posting-schedule.js`: authenticated authoritative route.
- `app.js`: server-confirmed reconciliation and canonical shell readers.
- `content-workspace.js`: bounded localized scheduling failures (canonical reader retained).
- `scripts/check-bw35-1-canonical-posting-schedule-persistence.js`: invented-fixture regression.
- `package.json` and `.github/workflows/runtime-boot-safety.yml`: focused command registration.

## Deployment and migration

Deploy the route and browser assets together. Existing Board and social publication tables are used. No environment variable, provider credential, worker, queue, or database migration is required; schedules already live in Board JSON.

## Acceptance and rollback

The focused regression covers schedule/save/remove validation, owner/editor/viewer boundaries, type and membership enforcement, deterministic canonical-only writes, preservation, approval invariants, durable finalization protection, stale-write rejection, canonical rendering/legacy fallback, diagnostic minimization, and absence of provider calls. Existing Board, calendar, localization, theme, approval, and provider-finalization checks remain compatibility gates.

Rollback is limited to removing/disabling the new route and browser adapter and returning to Board autosave. Existing `planningSchedule` records remain compatible and must not be rewritten or rolled back.

## Explicit non-goals

BW-35.1 adds no scheduler workspace, automatic/bulk scheduler, CSV export, destination binding, provider-side schedule, publish queue, provider call, automatic publication, approval change, database migration, or real social-media mutation.
