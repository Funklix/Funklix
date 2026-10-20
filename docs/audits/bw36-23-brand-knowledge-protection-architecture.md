# BW-36.23 — Permanent Brand Knowledge Protection Architecture

Date: 20 October 2026 (Europe/Berlin). Status: architecture and implementation specification for review; **not implemented or deployed**. Supabase PostgreSQL is the sole production database provider.

## Scope and evidence

**Decision:** protect all existing and future confirmed canonical Brand Knowledge before attempting individual historical recovery. Recovery of SaúdeBrasil, Eiskrallt and TLDR remains deferred. No runtime code, executable migration, production SQL, production write, restoration, deployment, paid AI or image-generation call is part of this PR.

Baseline: latest merged main `ef480d4b507b14f483752c419a4857a980910615`, including [incident audit PR #800](https://github.com/Funklix/Funklix/pull/800). Reuse the [incident investigation](bw36-22b2-inc1-canonical-brand-knowledge-loss-investigation.md); do not repeat or reinterpret its production incident findings. Production loss remains unverified.

Inspection method: GitHub connector supplied the current recursive Git tree and incident report. Shell Git fetch failed because its proxy was unreachable. All **161** mounted blobs under `api/`, `migrations/`, plus `app.js`, `brand-profile-setup.js`, `canonical-brand-reader.js`, `home-foundation.js` and `AGENTS.md`, matched that tree using `git hash-object`. Source findings below therefore describe pinned main despite stale local Git refs. A source scan covered Brand INSERT/UPDATE/DELETE statements and Core assignments. This establishes repository paths, not external jobs, deployed schema, applied migrations or production privileges.

Managed environment status exposed no ready database credentials or Supabase control-plane identity. No Supabase connector is available in this session. Current project backup/PITR configuration, production login role and external writers are **unverified rollout blockers**, not assumed absent.

## 1. Confirmed current write paths

Paths and function names below are references at the pinned commit.

| Path / entry | Confirmed effect | Required disposition |
| --- | --- | --- |
| `api/brands/[id].js` PUT, `mergeCore` | Only repository application UPDATE assigning existing `brands.brand_core`. Reads authorized row, recursively merges objects, then CAS-updates name/Core where revision matches. Explicit leaves, nulls, arrays and approval changes replace stored values. No history. | Replace persistence with the protected command. Preserve GET response compatibility. |
| `brand-profile-setup.js` `save` | Sends cloned full editable Core, name and revision; verifies authoritative response/readback. Defaults can be present in payload. | Generate changes from baseline versus deliberate draft edits; never promote defaults into edit intent. |
| Same, `persistSuggestions`, `analyze`, `applyProposal` | Domain suggestions may fill eligible empty fields automatically; manual proposals and full cloned saved Core go through PUT. DNA/Avatar suggestions are filtered. | Automatic fill is missing/empty-only, rechecked under lock; populated fields require manual review. Preserve nested unknowns. |
| Same, `acceptDna` | Browser merges DNA draft over saved DNA, retains previous Avatar and unknown siblings, sets parent approval. | Typed acceptance command; revalidate server-side. Draft generation alone must not write canonical knowledge. |
| Same, `acceptAvatar` | Browser merges Avatar draft over existing metadata and sets approval, then saves. | Typed accepted-asset replacement with current revision, exact changed metadata and dependency validation. |
| `app.js` `submitCanonicalBrandEditing` | Advanced JSON editor submits whole parsed Core and draft revision; no server field-intent contract. | Convert explicit diff into reviewed operations; do not infer removal from omitted keys. |
| `app.js` `submitCanonicalBrandCoreInitialization` | Explicit Board snapshot import into browser-confirmed exactly-empty canonical Core; server PUT does not enforce that precondition. | Separate initialize command, server empty-only condition and source authorization; never use for recovery. |
| `api/_brand-creation.js` `createWorkspaceBrand`; `api/brands/index.js` | New UUID/default Core, immutable creation fingerprint; idempotent existing-row return does not replace Core. | Record creation snapshot within existing transaction; retries return existing outcome. |
| `api/_project-command.js` `execute` | New-Brand branch inserts default Core; copies authorized canonical state to new Board snapshot. Existing-Brand replay does not overwrite Core. | Preserve transaction and replay contract; creation history must commit with Brand/Project creation. |
| `api/brands/[id]/logo.js` | Separate logo metadata UPDATE with `logo_revision`, row lock, upload and transactional metadata handling. Does not assign Core or increment Core revision. | Keep logo revision API; include metadata changes in durable history through a shared event sequence. |
| `api/_brand-deletion.js` `deleteOwnedBrand` | Owner/name-confirmed physical deletion, Brand lock and associated-Board check; no current revision input. Removes memberships. | Explicit revision-safe lifecycle command; preimage and retained history required. No automatic delete. |
| `migrations/20260929_bw36_8_transactional_workspace_backfill.sql` | Changes Brand Workspace assignment, not Core. | Existing one-time administrative migration; future reassignment must be separately reviewed and historically attributable. |
| `api/_brand-learnings.js`, `api/brands/[id]/learnings.js` | Governed Learning tables/events, separate from Core; authorization locks identity/Brand/membership. | Preserve governance. Approved learning does not silently rewrite Core. A future promotion must use the protected command. |
| `api/boards/[id].js`, `api/_project-command.js`, `app.js` Board saves | Save Canvas/Board Core, association and Board backup/provenance. | Board state stays non-authoritative; no implicit Board-to-Brand writer. |
| `api/generate-founder-story.js`, `map-founder-story-website.js`, `discover-brand-dna.js`, `generate-brand-avatar.js`, `analyze-brand-domain.js` | Return generated/retrieved proposals; Avatar generation may upload an image. No canonical Core UPDATE in these endpoints. Founder Story/strategy Canvas acceptance persists Board state. Profile Founder Story lives in `customTiles`. | Keep proposals separate; only explicit canonical acceptance/edit uses protected writes. Preserve Board-only workflows. |
| `canonical-brand-reader.js`, `home-foundation.js`, AI Brain context modules | Read canonical/Board/Learning projections. | No canonical mutation, normalization, approval toggling or default persistence on read. |

`api/_boards-storage.js` constructs a `pg.Pool` from server `POSTGRES_URL`. `api/_brands-storage.js` provides Brand columns/serialization and lazy DDL. `ensureBrandsTable` can invoke Board relationship reconciliation; GET is therefore not currently a guaranteed DDL-free operation. Move schema preparation to reviewed migrations and make runtime read checks read-only. No live GET was used as production evidence collection.

Brand authorization is independent of Board and Workspace access: `_brand-access.js` permits canonical edits to owner/admin/editor and reads to viewer. Workspace membership alone must not grant canonical access. Preserve that predicate, add verified identity and declared Workspace-context validation, and recheck inside the write transaction.

## 2. Root failure modes

The incident audit reproduced local vulnerability, not a proven production loss chronology:

- Explicit current-revision `brandDNA:null`, `brandDNA.avatar:null`, blank leaves, default arrays or approval downgrades are writable. Object merging only protects omissions; it cannot establish intention.
- CAS prevents stale writes but accepts a stale destructive payload resubmitted with a fresh revision. A client readback failure cannot undo a committed mutation.
- Whole-document editors and default insertion blur omission, blank UI values and intentional deletion. Nested arrays can discard unknown tile metadata.
- Browser-only acceptance/initialization guards can be bypassed by older or direct clients.
- Only the current Core/revision remains; neither a revision number nor Board backup reconstructs canonical history.
- Parent approval changes can hide otherwise preserved Avatar/DNA. Asset references can survive while object bytes disappear.
- Authorization checked before a later UPDATE can race membership revocation. Existing owner/bypass-RLS database access, if deployed, also bypasses ordinary RLS assumptions.
- Physical Brand deletion removes current access anchors; Learning event foreign keys cascade today. Canonical history must not inherit that lifecycle.
- Historical Board-only knowledge is a storage-boundary issue. This design does not silently promote it into canonical knowledge.

## 3. Protected field semantics and recommended contract

### Universal preservation rule

Treat **every persisted canonical field as protected by default**, regardless of recognized key or approval flag. This conservative rule covers historical values whose confirmation metadata is incomplete. Protect the full Core recursively: DNA, archetypes, positioning, audience/ICP, messaging, voice, assets, domains, Founder Story, accepted strategy/custom tiles and future fields. Also retain name, logo metadata, ownership/Workspace association and lifecycle in full-row history.

No fixed knowledge-field allowlist. A small validated operation/provenance schema is appropriate; a field registry may add validation but must never exempt unknown fields. Server-owned metadata such as `_creation`, ownership, revisions and history pointers is never writable through generic Core operations.

Recommended versioned envelope for PUT `/api/brands/:id`:

```json
{
  "contract": "canonical-brand-write/v1",
  "workspace_id": "<expected-authorized-context>",
  "expected_revision": "42",
  "mutation_id": "<UUID>",
  "operation": "profile_edit",
  "changes": [
    {
      "path": "/brand_core/brandVoiceExamples/good",
      "action": "replace",
      "expected": {"exists": true, "value": "Previous text"},
      "value": "Reviewed new text"
    }
  ]
}
```

Revision strings avoid BIGINT precision loss. Preserve legacy numeric response revision while safe; fail closed at unsafe numeric bounds until all clients support strings. Return canonical Brand plus contract/mutation/event identifiers; retain the normal Brand projection at the top level for compatible readers. Treat timestamps as metadata, not concurrency tokens.

Paths use canonical JSON Pointer escaping, exact case and own keys. Reject ambiguous/noncanonical encodings, overlapping ancestor/descendant operations, duplicate paths, root replacement, prototype-pollution keys, excessive depth/count/size and path/type mismatch. Never strip or silently ignore invalid keys. Validate the final merged Core against the existing size bound as well as request size.

| Input/action | Server semantics |
| --- | --- |
| Omitted path | Exact stored value, type, existence and unknown children remain. Omission never deletes. |
| `add` | Requires absent path; can create object containers without erasing siblings. Expected absence distinguishes missing from JSON null. |
| `fill_empty` | Only for approved proposal workflows; requires a precise old empty representation and locked recheck. Empty means absent, null, whitespace string, empty array or empty object; false and zero are meaningful. Never traverse or replace a populated subtree. |
| `replace` | Existing nonempty scalar change requires explicit exact-path operation, expected old value and deliberate user save/acceptance. For objects, use leaf operations; parent replacement requires enumerating every changed/removed descendant and previewing the whole affected subtree. |
| `clear` | Explicitly sets null/blank/empty collection; requires exact old value, destructive intent and review. |
| `remove` | Explicit deletion of key, distinct from setting JSON null; requires old-value match and review. |
| Approval/status/type changes | Changes that revoke acceptance, invalidate display or alter interpretation require typed intent, exact old values and dependency validation even when payload is nonempty. Unknown type changes are destructive by default. |
| Arrays | Treat as atomic for comparison; require expected entire previous array and explicit replacement/removal intent. Preserve all unedited elements and unknown properties. Never address mutable positional indices as stable identities. Stable tile-ID editing must prove IDs unique and merge server-side; otherwise require whole-array review. |
| Same value | Valid no-op; may have an idempotency receipt event, no Core revision increment. |
| Name or logo | Explicit operation through protected persistence; maintain separate logo revision precondition. |

Do not silently coerce types or regard false/zero as empty. Unknown nested fields are traversed and retained identically to known fields. If an unknown status/approval dependency cannot be validated safely, preserve it and reject the proposed change as requiring review. Generic object deletion cannot conceal loss of an unknown accepted child.

Intent is **not** an untrusted `force:true`. The authenticated backend binds operation class, actor, Brand/Workspace, revision, exact paths/old values, selected new values and any required destructive confirmation to the normalized command. For destructive operations, issue a short-lived signed review token over that digest after an authorized preview; submit consumes the same digest through idempotency. Refreshing revision invalidates the review. The preview endpoint is authenticated and read-only; provision a dedicated server-only signing key with version/expiry and rotation support. The database function verifies the normalized command supplied by that trusted backend; the browser cannot invoke it directly. Old clients cannot obtain destructive permission through arbitrary body flags. Tokens attest the authenticated review flow; they cannot prove a human read the screen.

For ordinary populated scalar edits, explicit field submission on Save supplies replacement intent; no second dialog for every keystroke. Clear/remove, subtree/array loss, acceptance downgrade and asset replacement require a concrete before/after review. Generated suggestions cannot manufacture user intent.

### Acceptance dependencies and assets

DNA and Avatar generation produce drafts. Accept-DNA changes selected strategy fields and approval together, preserving Avatar and all unspecified metadata. Accept-Avatar binds the selected stored image identity, metadata, parent DNA revision/acceptance and Avatar approval in one command. Replacement requires deliberate confirmation even if new URL is nonempty. Clearing parent approval cannot silently invalidate an accepted Avatar: reject unless the reviewed operation explicitly covers affected dependents.

Existing shape `brandDNA.userApproved` and `brandDNA.avatar.userApproved/imageUrl` remains compatible. Do not normalize historical approval shapes during migration. Future schema validators must declare invalidation dependencies; unknown fields stay protected.

An image URL is not a recoverable image backup. `api/_image-storage.js` uses Vercel Blob for generated images; `api/_brand-logo-storage.js` uses Supabase Storage for logos. These are asset stores, not alternate production databases. Keep accepted image objects immutable and retained while referenced by live state **or history**. No automatic cleanup of previously accepted assets. Record stable object key/provider and digest when available; retain legacy reference unchanged if unavailable. Do not place expiring signed URLs or credentials in new canonical history; resolve access at read time. Existing legacy sensitive values require private review, not lossy snapshot redaction.

## 4. Proposed immutable history schema

Use full before/after snapshots, not reversible patches. This trades storage for simple, provably lossless restoration of unknown JSON and future Brand columns.

Smallest recommended data-model addition: **one table** `public.brand_knowledge_history` and **one column** `brands.knowledge_event_seq BIGINT NOT NULL DEFAULT 0`, plus functions, triggers, constraints and grants. No second canonical store or browser backup. Existing `revision` remains Core/name CAS; `logo_revision` remains logo CAS. Event sequence orders *all* relevant Brand-row transitions, including logo-only changes at the same Core revision.

Specification, not executable SQL:

| Column | Required definition / purpose |
| --- | --- |
| `event_id` | UUID primary key, generated server-side |
| `brand_id`, `workspace_id` | Brand UUID required; historical Workspace UUID nullable only for existing unassigned Brands |
| `event_seq` | BIGINT nonnegative, UNIQUE(brand_id,event_seq); increments under Brand row lock |
| `previous_revision`, `result_revision` | BIGINT with positive values when a corresponding state exists; preserve native decimal precision |
| `previous_logo_revision`, `result_logo_revision` | Separate logo concurrency record |
| `recorded_at` | TIMESTAMPTZ NOT NULL from database clock; event_seq is ordering authority |
| `actor_identity_id`, `operation_identity` | Exactly one verified human identity UUID or registered server operation identity; no browser-supplied attribution |
| `operation_type`, `contract_version` | Validated nonempty operation class and version; baseline/create/edit/accept/clear/restore/logo/archive/delete/noop distinctions |
| `mutation_id`, `request_digest` | Non-null UUID and SHA-256 normalized request digest for durable idempotency |
| `source_event_id` | UUID NULL; normal writes use NULL. Same-Brand restore source enforced by `FOREIGN KEY (brand_id, source_event_id) REFERENCES brand_knowledge_history (brand_id, event_id) ON DELETE RESTRICT`; backed by `UNIQUE (brand_id, event_id)`. Required in Phase A, including before any Phase B endpoint exists. |
| `before_state`, `after_state` | JSONB full `to_jsonb(OLD/NEW)` Brand row; NULL only for absent creation/deletion side |
| `intent`, `provenance` | Bounded structured changed paths/actions, reviewed source event, safe source class and request correlation; no raw prompts, credentials, arbitrary URLs or browser session dumps |
| `snapshot_format_version` | Explicit version; old snapshots remain readable after schema evolution |

Snapshots include **all** columns, including unknown future columns and full `brand_core`, not a hand-built known-field projection. Snapshots are private protected data; safe provenance does not mean removing fields needed for recovery. A future credential-bearing Brand column would require a reviewed encrypted lossless representation before deployment. Snapshot content is not copied into logs or PRs.

Constraints: object-valued snapshots; at least one snapshot present; `brand_core` object on each present side; snapshot Brand IDs match `brand_id`; snapshot revisions/sequence match event columns; actor exclusivity; operation-specific create/delete/baseline rules. Unique `(brand_id, actor_key, mutation_id)`, where actor_key is a deterministic non-null identity namespace, prevents nullable-key loopholes. Composite `(brand_id,event_id)` unique key supports same-Brand restore-source reference. Request digest format and metadata length/depth bounds are enforced.

Indexes: unique Brand/sequence supports descending revision browsing; unique idempotency key; `(workspace_id,recorded_at,event_id)` only if scoped operator paging requires it. Avoid GIN indexing private full Core. Do not declare UNIQUE(brand_id,result_revision): logo/noop/lifecycle events may share Core revision.

No cascading Brand/Workspace/actor FK. UUID references are historical identity, not an authorization grant. Same-table `source_event_id UUID NULL` restore-source reference uses RESTRICT and the same-Brand composite key. This resolves PR #801’s P2 finding in Phase A; it is not deferred. Retain frozen ownership/Workspace context inside snapshots. Identity retirement cannot delete history.

Baseline: during approved cutover, insert sequence-0 snapshots of every existing row, mark actor as verified migration operation and record actual capture time/current revision. Do not invent earlier actors or imply historical recovery. New Brands create sequence-1 creation events (before_state absent). Baselines have before/after equal. Existing sequence defaults are compatible; no Core/default/approval rewrite.

### Retention, growth and access

Default recommendation is no automatic pruning for canonical history, including deleted/archived Brands. A separate approved legal retention/erasure policy may require exceptional administrator action; never grant ordinary clients deletion. Record that exception outside the application history authority. Indefinite retention, legal erasure rules and asset retention costs need product/operator approval before rollout.

Estimate bytes as baseline rows × average full row plus events/day × retention days × average(before+after+metadata), then measure actual TOAST, index, WAL and backup overhead in staging. Near the current 1 MiB Core bound, one event may contain about 2 MiB of uncompressed Core alone. Monitor growth, commit latency, replication lag and free disk; alert before exhaustion. If history storage fails, **fail the mutation**, never skip history. Partitioning/offline archival is deferred until measurements justify a separately reviewed lossless design.

## 5. Supabase migration and access specification

### Current source boundary

`migrations/20260911_bw33_5_supabase_rls_hardening.sql` enables RLS, revokes anon/authenticated table privileges and adds restrictive deny policies; it is labelled unapplied in source. `docs/runbooks/bw33-5-rls-hardening.md` expects the application login to own tables or bypass RLS. Later Workspace and Learning migrations add their own grants/guards. Repository migrations do not establish production application status.

`20261011_bw36_17_governed_brand_learnings.sql` and follow-ups already demonstrate append-only event and truncate guards, but Learning/event Brand cascades cannot be reused for durable canonical history. Do not modify Learning lifecycle as part of this protection change.

### Reviewed migration specification — pending implementation and DBA review

Proposed exact files:
- `migrations/20261020_bw36_23_brand_knowledge_protection.sql`
- `migrations/20261020_bw36_23_brand_knowledge_protection.verify.sql`
- `migrations/20261020_bw36_23_brand_knowledge_protection.rollback.sql`
- `scripts/sql/bw36-23-brand-knowledge-preflight.sql`
- `docs/runbooks/bw36-23-brand-knowledge-protection.md`

Date prefix is reserved for this plan; implementation must check ordering/collisions before creating files. This PR adds none of those SQL files.

Migration requirements, in sequence:

1. Operator read-only preflight captures PostgreSQL version, exact columns/types/defaults/constraints, table/function owners, runtime role memberships, inherited/table/column/default privileges, RLS/policies, triggers, replication settings, partition topology and applied migration state. Enumerate external SQL/jobs/admin paths. Confirm all baseline rows have object Core, valid revision and unique UUID; no repair-by-default.
2. Validate schema ownership and runtime role separation. Use a dedicated **non-owner, non-superuser, NOBYPASSRLS** application login for protected persistence; no inheritance/SET ROLE to history/function/table owners, no DDL, TRIGGER, TRUNCATE or replication-bypass privileges. If current POSTGRES_URL uses owner credentials, rotate/reconfigure through approved deployment secrets. Keeping that privileged login in ordinary application code blocks the claimed enforcement boundary.
3. Use a dedicated NOLOGIN function owner with only required privileges and no runtime membership. Protected `SECURITY DEFINER` functions have fixed safe search_path, fully qualified objects, typed parameters, no interpolated identifiers and no PUBLIC EXECUTE. Schemas used by the functions must not be runtime-writable.
4. Add history table/column and complete catalog-validated constraints/indexes in one reviewed transaction with short lock timeout/advisory migration lock. Lock Brands for cutover, seed baselines under that same boundary, install canonical mutation/history guard and no-delete/no-truncate history triggers, revoke old write grants, verify before commit. Rehearse baseline duration; if lock budget is exceeded, abort and schedule a longer approved window rather than silently leaving an unprotected interval.
5. Revoke ALL on history from PUBLIC/anon/authenticated and ordinary application role, including inherited/column/sequence access; enable RLS with no browser allow policies. Only function owner inserts. Authorized history reads use bounded server functions. Explicitly close function EXECUTE defaults and Supabase `service_role` exposure; BYPASSRLS does not justify granting table privileges.
6. Revoke ordinary runtime direct INSERT/UPDATE/DELETE on Brands; eliminate column-level and inherited alternatives. Provide narrowly scoped functions for create, Core/name, logo, initialization and lifecycle. Grant runtime EXECUTE only on these and authorized read functions; add least required policies/grants for those functions' owner. Verify Brand/Board/Project/Logo transactions still work without owner access. Do not apply FORCE RLS blindly to existing tables.
7. BEFORE guard validates revision transitions, recursive intent, server-owned fields, acceptance dependencies and history sequence. AFTER row trigger records before/after within the same transaction and fails closed if event context is absent or invalid. INSERT and DELETE are covered. History UPDATE/DELETE and statement TRUNCATE guards always reject ordinary operations. Do not use a caller-writable session GUC as an authorization secret: function privilege isolation is the boundary; transaction-local context only transports validated metadata to the trigger.
8. Verify all catalog signatures, grants, policies, baseline counts/content and fail-closed probes **before commit**; produce sanitized summary counts/hashes. No private payload output.
9. Run post-cutover authorized disposable smoke tests, not destructive tests against real Brand rows. Retain preflight and migration hash privately.

Idempotency of migration: record exact version and catalog fingerprints; an exact fully-applied state returns without reseeding. A conflicting or partially applied table/function/trigger/grant state aborts. `IF NOT EXISTS` alone is insufficient. Baseline uniqueness prevents duplicates. Failure rolls back DDL, baselines and grants together. If production size needs a multi-transaction index/seed strategy, that is a revised specification requiring review before execution.

Rollback: pre-cutover transaction failure rolls back completely. After cutover, keep history, data, guards and safe privileges; disable writes or return maintenance errors and roll forward. Application rollback must target a contract-compatible build. Do not drop history or restore destructive legacy write grants to recover availability. A separate operator-approved emergency procedure may restore captured infrastructure state only after a verified backup and explicit risk review. This report does not authorize that operation.

Schema changes to future Brand columns must update validators and run full-row snapshot round-trip tests. PostgreSQL table owners/superusers can ultimately alter protection; keep their credentials outside app processes, restrict operator access and monitor DDL. External backups are the independent recovery boundary.

## 6. Transaction, concurrency and retry design

One command executes on **one checked-out pg client**, one transaction. Do not combine pool.query calls that can use different sessions. Existing Project creation can invoke the protected create function inside its own transaction.

1. Authenticate server session; derive active application identity through existing identity bridge. Validate payload and review token; never accept body actor/email as authority.
2. Begin; lock active identity FOR SHARE, Brand FOR UPDATE, then acting Brand membership FOR SHARE and re-evaluate role after locks. Validate stored Workspace equals submitted context. Required Workspace eligibility checks supplement, never replace, Brand authorization. Coordinate lock order with Learning, membership, logo, deletion and reassignment operations; fail bounded lock contention/deadlock without automatically changing revisions.
3. Check authorized idempotency receipt **before stale revision rejection**. Matching actor/Brand/mutation/digest returns previously committed outcome; different digest returns 409 IDEMPOTENCY_CONFLICT. After deletion, use restricted tombstone authorization for original actor's receipt. Never expose a receipt based on UUID alone.
4. Compare expected Core revision with locked row; use logo revision too for logo/asset-dependent operations. A stale request returns 409 STALE_UPDATE with no canonical/history mutation. Revision increments are exactly one for actual name/Core edits; logo-only retains Core revision. All events increment knowledge_event_seq once.
5. Resolve operations against locked OLD row; compare existence and exact JSONB values, compute candidate recursively, validate destructive intent and dependencies. Do not rebase. Candidate outside explicit paths must equal OLD, including unknown fields. Ownership/Workspace changes have separate privileged operation types.
6. Execute one parameterized Brand update/insert/delete through protected function; trigger captures OLD/NEW full row and verified context. Trigger/history constraint failure aborts entire transaction. Do not swallow errors or catch-and-continue around history insertion.
7. Commit. Return authoritative result/event/mutation identifiers. Private structured error codes only; no Core logging.

A valid no-op with a new mutation ID records a receipt/noop history event and advances only event sequence, not Core revision. Repeated exact retries do not add events. Retain receipts as long as history; response contains original committed snapshot plus its revision, clearly identified as replay. UI can then GET current state separately if newer edits exist; it must not mistake replay for the latest row.

Lost response after commit is resolved by retrying the **same mutation ID, same digest and same revision**. Do not obtain fresh revision and resend old full payload. After a 409, retain local drafts and show three-way comparison of baseline/local/current; only a new reviewed command receives a new ID. Revalidate destructive intent after reconciliation.

For simultaneous valid writes at revision r, the Brand lock serializes execution: one commits r+1, the other sees stale revision. Membership revocation either commits first and denies the command, or waits for the authorized in-flight command to finish. All authority-changing paths must participate in the locking protocol; no absent-membership lock can grant authority. Avoid acquiring Board locks after Brand locks in ordinary saves. Initialization needing Board validation must use bounded NOWAIT locks/retry with unchanged intent to avoid existing Board-first deadlocks.

## 7. Server authorization and history isolation

Backend trust boundary: application session verification supplies the identity; the restricted server database login may call functions on behalf of that verified identity. SQL repeats active identity/ownership/membership checks. This is not end-user database authentication, and compromise of trusted backend credentials cannot be solved by a body actor field. Never expose protected functions with browser-accessible credentials.

History listing/comparison requires **current** Brand read authorization. Restoring requires current canonical edit authorization and explicit review; full removal/delete remains owner-only as today. A Workspace admin or Board editor who lacks Brand access receives no history. Apply same predicate for current and historical UUIDs; reject cross-Brand source-event references and UUID reuse.

For archived Brands, keep current ownership/membership and deny writes unless lifecycle permits them. For physically deleted Brands, retain snapshots but ordinary users cannot browse history through deleted memberships. A separate restricted recovery-operator function checks verified operator entitlement and the historical ownership/Workspace context, logs access privately and may inspect history for an explicitly authorized case. Current Workspace membership alone cannot resurrect former access. Recreating a deleted Brand or restoring its memberships is outside selected-field recovery and needs a separate lifecycle authorization.

Use private no-store responses, authorization before event existence disclosure, pagination/byte bounds and short-lived comparison handles. Summaries contain event metadata/changed paths, not full snapshots. Detailed comparisons reveal only authorized selected fields. A revoked user's old comparison handle or review token is insufficient at commit.

## 8. Controlled recovery protocol

Phase B adds explicit history-based recovery, never automatic repair:

1. Authorized operator/editor selects Brand UUID and recorded canonical event. Verify snapshot format, same Brand, historical lineage and current authorization. Board snapshots are ineligible recovery sources.
2. Read current row and selected historical **after_state** (or explicit before_state for a deletion/preimage case). List precise selected paths; show existence/null differences, current value, source value and dependencies. Unknown keys remain selectable. No wholesale old Core upload.
3. Prepare a short-lived comparison manifest binding source event/hash, selected paths, expected current revision, current values, proposed values, actor/Workspace, dependencies and new mutation ID. Reject overlapping paths, partial accepted-asset pairs, ambiguous array identity, missing required objects or incompatible schema.
4. User reviews exactly those field changes. Server reconstructs values from immutable history, not submitted historical payload. Require current expected revision and review token; authorize again under lock. If any revision or selected-value mismatch occurs, return RECOVERY_CONFLICT, regenerate comparison and require a new decision. Even unrelated concurrent edits invalidate the revision; do not auto-merge.
5. Apply selected operations to current state through the same protected write function. Preserve all unselected newer data; any necessary dependent-field change must be explicitly included in the reviewed selection. Record operation restore, source event, selected paths, actor and full before/after in one new event. Never rewrite or erase old history.
6. Return committed revision/event; verify canonical readback and accepted asset access. Asset unavailability blocks Avatar recovery or leaves it as a proposal; do not regenerate an image, invent approval or assume URL availability.
7. Rollback of a recovery is another selected-field restore from its own before_state with current revision and review. If newer edits conflict, compare and reject until re-reviewed. Infrastructure-level rollback is not field recovery.

A delete event can supply evidence for a separately authorized lifecycle recreation, but the selected-field API rejects a missing Brand. No blind full-database restoration into production. No restoration of the deferred historical Brands is authorized by either phase plan.

## 9. Existing client compatibility and deployment order

| Workflow | Compatibility requirement |
| --- | --- |
| Profile editing / advanced JSON | Keep routes, capabilities and authoritative readback. Save baseline-to-draft explicit changes; omitted unknown fields survive. Advanced editor displays removals as reviewable operations. |
| DNA acceptance / Avatar acceptance | Typed operations preserve existing parent/sibling/unknown data. Generation never downgrades accepted state. Replace only after user review and exact revision/asset match. |
| Founder Story / accepted strategy | Profile customTiles are canonical; use stable-ID proof or explicit array replacement. Canvas acceptance remains Board-only. No implicit promotion or automatic reset. |
| Website/domain import | Preview remains available; auto-fill only still-empty paths under lock. Populated conflicts require explicit acceptance. Preserve brandAssets siblings and accepted Avatar; use separate logo command. |
| Brand Learning / AI Brain | Keep separate approved-learning lifecycle/context; no accepted-learning-to-Core auto-sync. Home/Brain GET paths must issue no canonical mutations or DDL. |
| Board association, saving, snapshots | Preserve Board UUID/Workspace/source-revision checks and Board backup semantics. Refresh may copy Brand to Board; reverse sync prohibited except separate explicit initial empty-only import. |
| Empty-Core initialization | Server verifies exactly empty Core, current revision, independent Brand/Board access, matching Brand/Workspace association, authoritative Board revision/hash and explicit initial-import intent. Not available when any canonical data exists; never a recovery route. |
| Brand/Workspace switching | Bind pending requests/results/drafts/intent to account, Brand UUID, Workspace and navigation generation. Abort does not undo commit. Returning later resolves mutation receipt; no retry into newly selected scope. |
| Concurrent editors / conflict reload | Retain baseline/local/remote three-way UI; untouched remote changes remain. Never reuse destructive token after reload/rebase. |
| Logo / creation / Project creation / delete | Preserve current API outcomes while replacing database writes with protected functions; history failure rolls back all coupled database writes. Retain uploaded objects on uncertain commit; no cleanup of historical references. |

Legacy PUT contract: retain read compatibility; do **not** infer destructive intent from a full document. Adapter may recursively preserve omissions and accept only equal values or missing/empty-only additions that cannot invalidate populated data. Reject any changed populated leaf/array, null/blank overwrite, type change, approval loss or unsupported operation with 428 WRITE_CONTRACT_REQUIRED (or stable 422 protection error); no partial application. Compatible old retries still cannot erase data. Existing supported clients must be upgraded before enforced cutover; older clients receive actionable upgrade/reload errors and retained drafts.

Deploy in this order within the two phases: stage and test compatible clients/backend against disposable migrated DB; deploy capability-aware code able to remain read-only when migration is absent; obtain approved migration/credential cutover window; drain or disable canonical writes across old server instances; apply reviewed migration and restricted-role config together; verify catalog and disposable smoke checks; enable new contract for supported workflows; monitor errors/growth. Capability detection is read-only and cannot auto-run migrations. Old binaries that try direct SQL must fail closed. Do not claim zero downtime until role rotation, baseline duration and all instances' convergence have been measured.

## 10. Supabase backup/PITR and restore verification checklist

**Configured state investigation result:** no project control-plane credentials/dashboard evidence or production DB connection was available. Project identity, subscription, backup mode, retention, earliest/latest recovery time, WAL continuity and last restore drill are unknown. Source and environment configuration cannot establish them.

Official [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups), checked 20 October 2026, describes plan-dependent backups and optional PITR. Database backups exclude Storage object bytes. Verify actual project settings; this report assumes no tier, retention or recoverable point.

Operator checklist, with private evidence and named owner:

- [ ] Confirm correct production Supabase project/region and deployment identity using approved metadata; record actual Postgres version, backup type, plan entitlements and PITR enabled status.
- [ ] Capture actual available backup timestamps, retention, earliest/latest PITR points and WAL gaps/health. Agree RPO/RTO and compare actual restore coverage. If protection is insufficient, present a costed configuration proposal for approval; do not enable a paid add-on here.
- [ ] Preserve an immediately restorable pre-migration database backup plus roles/grants/functions/policies/migration manifest through approved infrastructure. Record encrypted location, checksum, restore compatibility and credential-rebinding procedure; never store passwords in this report.
- [ ] Verify independent off-project/off-account encrypted exports or equivalent disaster-recovery copies, restricted access, retention and alerts. History in the same PostgreSQL database is not an independent backup.
- [ ] Inventory accepted Vercel Blob Avatar objects, Supabase logo objects and other referenced assets; verify bytes, digests where available, retention and separate asset backups. Protect objects referenced only by history.
- [ ] Obtain approval for an isolated recovery target and any storage/restore costs. Restore selected real backup/PITR point **only there**, with outgoing AI/jobs/publishing/webhooks disabled and no production traffic.
- [ ] Validate restored schema/owners/grants/functions/RLS, history counts and event sequence continuity, canonical before/after round trips including unknown fields, and asset availability. Test anon/authenticated denial and non-owner runtime restrictions.
- [ ] Measure restore time and actual data loss window; compare to RTO/RPO. Preserve sanitized drill outcome, timestamps and failure remediation. Do not equate backup existence with restore success.
- [ ] Test controlled field recovery against isolated data, including conflicting newer writes, loss of response and rollback-of-recovery. No production record changes.
- [ ] Assign recurring drill cadence and backup/asset health alerts. Cadence, retention, RPO/RTO and budget are approval decisions. Recheck before migration and after infrastructure changes.

## 11. Exactly two implementation phases

### Phase A — Protection Core

Scope: safe canonical contract; server-enforced destructive protection; atomic history; required migration and regressions. No history recovery UI or production recovery.

Exact proposed files and sequencing:

1. Add `brand-write-contract.js` (browser/server pure normalization/diff contract), `api/_brand-knowledge-write.js` (session authorization, command invocation/error mapping), `api/brands/[id]/write-preview.js` (authorized read-only destructive review/token issuance) and the migration/preflight/verify/rollback/runbook files named in section 5. Implement SQL validation/trigger functions as authority, not duplicated browser-only rules.
2. Adapt `api/brands/[id].js`, `api/_brands-storage.js`, `api/_brand-access.js` for protected persistence, read-only schema checks and transaction-aware authorization. Adapt `api/_brand-creation.js`, `api/_project-command.js`, `api/brands/[id]/logo.js`, `api/_brand-deletion.js` for atomic history and compatible outcomes. Audit `api/brands/[id]/members.js` and `api/_brand-learnings.js` lock order/revocation races; change only as needed for this boundary. Keep `api/_boards-storage.js` shared pool and Board persistence; remove Brand-read invocation of lazy reconciliation rather than redesigning Boards.
3. Adapt `brand-profile-setup.js` and `app.js` canonical editing/acceptance/initialization/conflict/retry paths. Register shared contract in `index.html` and `package.json` only if required by loading/check scripts. No generation changes or new AI feature.
4. Add `scripts/check-bw36-23-brand-knowledge-protection.js`, `scripts/check-bw36-23-brand-knowledge-postgres.js`, `scripts/fixtures/bw36-23-brand-knowledge-runtime.js`, and `scripts/fixtures/bw36-23-brand-knowledge-browser.js`. Extend existing relevant regressions without weakening them.
5. Complete disposable PostgreSQL role/concurrency/failure tests, compatibility fixtures and required repository CI/Boot Safety checks. Review exact migration SQL, backup evidence and role grants. Then execute only separately user-approved Supabase operations and deploy in section 9 order.

Dependencies: server-only review-token signing key provisioning/rotation; actual runtime DB role/preflight; non-owner login provisioning; deployed-instance drain/configuration; backup availability; staging engine and asset retention agreement. Owner-only runtime credentials are a blocker, not an optional hardening item.

### Phase B — Recovery & Verification

Scope: controlled historical field comparison/recovery, backup/restore verification, lifecycle and recovery tests.

1. Add `api/_brand-knowledge-history.js`, `api/brands/[id]/history.js`, `api/brands/[id]/restore.js`, `brand-knowledge-history.js`, and `brand-knowledge-history.css`. Read summaries/comparisons through authorized functions; restore uses Phase A write authority. Add history/restore SQL function definitions in reviewed `migrations/20261020_bw36_23b_brand_knowledge_recovery.sql` with matching `.verify.sql`; no new canonical/history table.
2. Integrate review/compare in `brand-profile-setup.js`/`app.js`/`index.html`; retain current Profile editing. Add `docs/runbooks/bw36-23-brand-knowledge-recovery.md` and `docs/runbooks/bw36-23-backup-restore-verification.md`.
3. Add `scripts/check-bw36-23-brand-knowledge-recovery.js` and `scripts/check-bw36-23-brand-knowledge-recovery-postgres.js`; extend Phase A browser fixtures for selections, conflicts, deleted-history access and rollback.
4. Operator verifies actual Supabase backup configuration and completes approved isolated restore drill and asset validation. Review migration/functions and deploy only after Phase A gates pass.

Dependencies: Phase A enforcement and stable history; approved recovery role/access policy; verified asset retention; approved isolated restore target/costs. Implementing this mechanism does not authorize restoration of the deferred Brands.

## 12. Explicit unresolved blockers and approval decisions

| Blocker / decision | Required evidence or decision | Effect |
| --- | --- | --- |
| Production schema/grants/role ownership and migration state | Authorized operator preflight; actual runtime role cannot own/bypass protection | Blocks enforcement rollout |
| External writers, admin credentials and old deployed instances | Inventory, privilege closure and cutover drain | Prevents bypass claims |
| Supabase backup/PITR and asset backup state | Project dashboard/control-plane evidence and isolated restore | Blocks production migration readiness |
| Exact deployed historic approval/asset/customTiles shapes | Private schema sampling by authorized operator; no incident reconstruction required | Determines validator compatibility; never normalize blindly |
| Baseline size/lock duration/storage budget | Staging measurements and operator window | Determines feasible migration window |
| Asset retention and legacy sensitive references | Provider inventory and approved immutable-byte retention | Blocks complete accepted-asset recoverability claim |
| Identity/role configuration and lifecycle authorization | Confirm restricted runtime/function owners; define recovery-operator entitlement | Blocks secure deleted-history access |
| Retention/erasure, RPO/RTO, drill cadence and budget | Product/operator approval of concrete measured proposal | No assumed subscription, retention period or paid change |
| Intent UX for approval revocation and large array changes | Review concrete Phase A diff/token flow and dependency cases | Must keep legitimate edits/removals possible |
| Execution approval | Review exact future SQL, backup/rollback evidence and deployment config before approving Supabase operation | Architecture PR is not production authorization |

No additional product redesign is needed to adopt the invariant. Recommended role policy retains existing owner/admin/editor editing and owner-only deletion. Any broader recovery-operator access, paid backup upgrade or exceptional erasure needs explicit approval. Future production migration/credential change and isolated restore actions require separate approval of concrete artifacts; none is requested or performed by this document.

## 13. Permanent regression and acceptance gates

Use disposable **real PostgreSQL** with Supabase-like anon/authenticated/service/runtime/owner roles, applied fixture schema and actual migration/functions. PGlite can supplement structural tests but does not replace multi-connection PostgreSQL scheduling, ownership/RLS, lock and rollback tests. Browser mocks alone cannot satisfy acceptance.

| Scenario | Required invariant / engine evidence |
| --- | --- |
| Unrelated edit; partial nested updates | Exact DNA, Avatar, approvals, unknown siblings and all unselected paths remain byte-equivalent at JSON value level; recoverable full preimage recorded. |
| Null/blank/object/array/type writes | Implicit destructive payload rejected atomically; reviewed clear/remove succeeds with exact preimage; false/zero retained as meaningful values. |
| Unknown future JSON/Brand column | Arbitrarily nested custom sentinels and added fixture column survive edits, history reconstruction and recovery. No field-name allowlist. |
| Legacy clients | Omission/equal/missing-only safe adapter cases work; destructive populated changes get stable upgrade error; no partial commit. |
| Concurrent stale revisions | Two real connections/barriers: one success, one 409; no fresh-revision auto-retry; one successful event. Include logo-only and Core edit interleavings. |
| Lost response / repeated retries | Drop response after commit; same ID/digest returns receipt before stale check; one event/revision change. Changed digest or actor conflicts/denies. |
| Avatar replacement / approval dependency | Approved replacement atomic, old metadata/bytes retained; generation does not mutate Core; parent downgrade without dependent review denied. |
| Profile conflict reconciliation | Baseline/local/current flow preserves remote untouched DNA/unknowns and local deliberate edits; old review token invalid after revision change. |
| Domain import | Locked empty-only recheck; concurrent populated field not overwritten; sibling assets and Avatar retained; explicit conflict approval required. |
| Founder Story / strategy | Generation changes no canonical row; Profile selected-tile edit preserves other tiles/unknown properties; Canvas acceptance stays Board-only. |
| Cross-Workspace/Brand/account switch | In-flight commit remains attributable to original scope; stale UI response ignored; no writes/retries to newly selected scope. |
| Unauthorized/revoked writes | Owner/editor allowed under intended predicate, viewer/foreign Brand/Workspace-only/Board-only denied. Real membership/identity revocation race linearizes correctly. |
| Transaction/history failure | Inject history insert/constraint failure, trigger exception, backend disconnect and commit failure; no canonical-only or history-only committed mutation. Project creation rolls back coupled rows. |
| Direct DB bypass / append-only | Runtime, anon/authenticated and available service-role fixtures cannot directly mutate Brand/history, alter triggers/functions or TRUNCATE. No PUBLIC/inherited/column grant route. |
| Restore attempts | Same-Brand, selected-field, authorized current-revision restore creates new event, preserves unselected newer data and reconstructs unknown values losslessly. |
| Recovery conflicts/ambiguity | Changed revision/path, cross-Brand event, overlap, partial dependent restore, ambiguous array ID or missing Brand rejected without mutation. Rollback-of-restore is a new reviewed event. |
| History isolation / lifecycle | Current authorized reader sees only own Brand; revoked/deleted memberships grant no access; retained history survives Brand/Workspace/identity lifecycle. Ordinary deleted-Brand browse denied; approved operator route tested. |
| No Board-to-Brand synchronization | Board save/refresh/associate/restore never writes canonical Core. Explicit initialization rejected on any nonempty Core, stale source or mismatched association. |
| Read purity / no automatic deletion | Home, AI Brain, catalog/detail reads execute no Brand UPDATE/DELETE or runtime DDL. No job/UI reset deletes confirmed knowledge or referenced historical assets. |
| Migration / rollback | Fresh schema, exact rerun, conflicting partial state, lock timeout and failure rollback tested. Baselines exact, no Core rewrite; rollback retains history/guards. |
| Backup/restore drill | Isolated restored database and separate asset bytes pass authorization, history round-trip and measured RPO/RTO checks. |

Phase A release gate: reviewed SQL and privilege model; all protection/compatibility tests and required CI pass; every known writer adapted or denied; verified backup; concrete user-approved Supabase cutover. No exceptions that silently skip history.

Phase B release gate: Phase A stable; selected-field recovery and lifecycle/isolation tests pass; actual backup settings documented privately; approved isolated restore drill succeeds; no automatic historical repair.

Documentation PR verification: only this Markdown file is added; no runtime/SQL migration changed. This architecture has not been engine-tested or production-verified. Implementation tests above are specified acceptance requirements, not claimed results.

BW-36.23 BRAND KNOWLEDGE PROTECTION ARCHITECTURE READY FOR REVIEW
