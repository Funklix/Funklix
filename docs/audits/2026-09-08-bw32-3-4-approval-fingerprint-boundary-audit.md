# BW-32.3.4 — Approval fingerprint boundary audit

**Date:** 2026-09-08

**Scope:** documentation-only review of the browser → Board persistence → server publishing boundary.
**Production observation accepted as evidence:** after canonical reapproval, the live card said the approval was current and exposed LinkedIn publishing, while the publishing preflight returned `approval_stale` and installed stale-recovery UI.

## Executive finding

The browser and server have **two separately maintained but textually equivalent implementations** of the same `v1` projection and FNV-1a-style hash. They are not one shared implementation. For the same JavaScript object, BW-32.3.3 proves that they agree. The first proven transformation capable of making the objects different is **Board serialization**, not approval mutation: approval hashes the live, post-status node, including the live `images` array; `serializeState()` then passes every node through `sanitizeNodeForPersistence()`, whose `sanitizeNodeImages()` removes every `blob:`/`data:` image and reduces retained image objects to `{id,url,name,createdAt,source}`. The approved fingerprint is copied unchanged. Publishing later hashes the server-loaded, sanitized JSONB node. Thus any approval-time image excluded or reshaped by persistence deterministically yields:

`stored approvedContentFingerprint (hash of live node) !== server materialFingerprint(persisted node)`.

That is the exact first code-level divergence. It fully explains the reported contradiction when the affected production node has a non-persistable or extra-property image. The repository contains no automatic boundary diagnostic that proves whether that category occurred for the reported production node; therefore the final decision is NO-GO rather than asserting an unobserved production datum.

There is a second, independent UI defect: an `approval_stale` response imperatively inserts a stale message into the existing card and writes the bottom feedback, even though that card's declarative projection remains current. No rerender occurs on this failure. Current and stale messages therefore legitimately coexist in one DOM generation.

## 1. Complete fingerprint and lifecycle implementation inventory

### 1.1 Browser material fingerprint

| Property | Exact behavior |
|---|---|
| File / function / owner | `content-workspace.js:19`, `materialFingerprint(node)`, browser Content Workspace (also CommonJS-exported for tests). |
| Field order | Top level, fixed insertion order: `type`, `title`, `content`, `channel`, `funnelStage`, `social`, `landingPage`, `images`, `variants`, `cta`, `audience`, `tone`. Nested `social`: `platform`, `caption`, `cta`, `preview`, `hashtags`. |
| Included values | The fields above, including complete values/objects for `landingPage`, `images`, and `variants`; `social` is a bounded nested projection. |
| Explicitly excluded | IDs; status; language/contentLanguage; readiness; owners; planningSchedule; comments/Post-its; AI Review aliases; review notes; approval fingerprint/metadata; timestamps; URL fields except those nested in included opaque objects (notably any URL/property in `images`, `landingPage`, or `variants`); all other node fields. |
| Normalization | No trimming, case folding, HTML normalization, Unicode normalization, alias reconciliation, line-ending conversion, sorting, or cloning. Each scalar field uses JavaScript `value || default`. Nested opaque values are passed as-is. |
| Whitespace / line endings | Preserved byte-for-JavaScript-code-unit exactly as represented by `JSON.stringify`; `\r\n` and `\n`, leading/trailing spaces, and repeated whitespace differ. |
| null / undefined | Scalar `null`, `undefined`, `false`, `0`, and `""` collapse to `""`; `hashtags` collapses falsy values to `null`; absent/falsy `social` becomes `null`; `landingPage`, `images`, and `variants` collapse falsy values to `null`. Undefined properties inside retained objects are omitted by `JSON.stringify`; undefined array elements become `null`. |
| Ordering | Array order is significant. The fixed projection keys have fixed order. Object key insertion order inside `landingPage`, `images` elements, and `variants` remains significant because ordinary `JSON.stringify`, not canonical key sorting, is used. |
| Algorithm / encoding / output | Start `h = 2166136261`; for every UTF-16 code unit of `JSON.stringify(material)`, XOR then `Math.imul(h, 16777619)`; unsigned 32-bit lower-case, unpadded hexadecimal; prefix `v1-`; output matches `^v1-[0-9a-f]{1,8}$`. This resembles FNV-1a but operates on UTF-16 code units rather than encoded bytes and is not cryptographic. |

Browser consumers are `projectAsset()` (`content-workspace.js:22`) for `asset.fingerprint` and `approvalChanged`; `evaluateScheduling()` (`:38`) for client eligibility; transition preparation/current-node guards; `applyContentWorkspaceTransition()` (`app.js:16591-16638`) for approval storage; and planning schedule change checks (`content-workspace.js:37`).

### 1.2 Server material fingerprint

`api/social-connector/linkedin-publishing.js:40-46` defines another `materialFingerprint(node)`. Its projection fields, insertion order, fallback semantics, JSON serialization, UTF-16 iteration, constants, prefix, hex formatting, and output are textually equivalent to the browser function. It is independently authored CommonJS server code, not imported from `content-workspace.js`; therefore the system has **similar duplicate implementations, not one implementation**.

`publishing-service.resolve()` (`api/social-connector/publishing-service.js:26-41`) calculates it over the authoritative node loaded from `boards.canvas_json`. `evaluateLinkedInTextPublishEligibility()` (`linkedin-publishing.js:48-79`) compares the node's canonical stored fingerprint to this supplied current fingerprint.

### 1.3 Approval data and aliases

The one canonical Board-node property is **`approvedContentFingerprint`**. Browser approval writes it (`app.js:16622`), Draft reopening removes it (`:16625`), browser projection and eligibility read it, serialization spreads it unchanged, restore retains it, and server publishing reads it. `approvalMetadata` is the canonical accompanying metadata object, with `approvedByAccountId`, `approvedByName`, `approvedAt`, `boardId`, and `nodeId` (`app.js:16623`). It is excluded from both fingerprints.

Repository-wide source search found no production reader/writer for `approved_content_fingerprint`, `approvalFingerprint`, `approval_fingerprint`, `material_fingerprint`, `approvedRevisionFingerprint`, or `approvalRevisionFingerprint`. `materialFingerprint` is a function name, not stored Board data. Database publishing records use a separate SQL column `approved_fingerprint`, and the immutable job snapshot uses `approvedFingerprint`; both are downstream publication evidence, not aliases used to restore Board approval (`publishing-service.js:56-60,81`). No write/read spelling mismatch exists at the Board boundary.

### 1.4 Browser approval validation and presentation

- `projectAsset()` calculates the live fingerprint and sets `approvalChanged` only when normalized status is `Approved` and `node.approvedContentFingerprint !== fingerprint`.
- `evaluateScheduling()` uses the same inequality and adds `APPROVAL_STALE`; it normalizes status and readiness/platform separately.
- `card()` (`content-workspace.js:44`) writes **“The current version is approved.”** when Approved and not changed, or declarative stale text/recovery when changed.
- `primaryDecision()` and `actions()` (`:42-43`) expose **Publish to LinkedIn** only for an Approved LinkedIn asset with `approvalChanged === false`; the primary action additionally requires approval persistence category `saved`.
- `openPublishDialog()` (`:70`) owns server-preflight feedback. On `approval_stale`, it imperatively creates the inline recovery control if absent and calls `feedback(host, t.approvalChanged)` for the bottom live-region toast.

### 1.5 Board serialization, persistence, restoration, and normalization

| Phase | Implementation and fingerprint effect |
|---|---|
| Browser node serialization | `serializeState()` (`app.js:5729-5744`) maps every node through `sanitizeNodeForPersistence()`. The top-level spread retains `approvedContentFingerprint` and `approvalMetadata`. |
| Node normalization | `sanitizeNodeForPersistence()` (`app.js:4913-4937`) shallow-copies the node, normalizes status, normalizes/removes ownership fields, removes transient generation fields, and **replaces images** using `sanitizeNodeImages()`. It does not recalculate approval. |
| Image normalization | `sanitizeNodeImages()` (`app.js:4901-4910`) drops missing, `blob:`, and `data:` URLs; retains HTTP-like/nonempty URLs; reduces each retained object to fixed keys and supplies defaults/generated IDs. This is the first material-projection-changing boundary. |
| JSON request | `saveBoardToServer()` (`app.js:8214-8260`) puts the serialized object at `payload.canvas_json` and calls `JSON.stringify(payload)`. Consequently remaining undefined object properties disappear and undefined array positions become null. The fingerprint string is JSON-safe and remains present. |
| API validation/storage | `PUT /api/boards/:id` checks only that `canvas_json` is an object and optimistic `updated_at`, then executes `$3::jsonb` with `JSON.stringify(canvas_json)` (`api/boards/[id].js:139-192`). It neither allow-lists node properties nor strips the fingerprint. JSONB can reorder object keys, which is immaterial for fixed projection keys but can change key order inside opaque included objects on reload. |
| Save response | The route returns the stored Board, but `saveBoardToServer()` only consumes identity/access/timestamps; it does **not** compare or hydrate `data.canvas_json` (`app.js:8294-8326`). `true` means successful HTTP/API response, not an authoritative Board round trip. |
| Restore | `loadBoardFromUrlIfPresent()` validates the Canvas envelope, applies schema defaults, and calls `applyCampaignState()` (`app.js:8360-8407`). `applyCampaignState()` maps restored nodes through the same sanitizer (`:8154-8179`), retaining canonical approval data. |
| Server authoritative load | `publishing-service.resolve()` calls `getBoardAccess(... columns: 'id, canvas_json, ... updated_at')`, resolves the first exact `item.id === input.nodeId`, and fingerprints that saved node. `boardNodes()` accepts either a legacy array Canvas or canonical `{nodes}` Canvas (`publishing-service.js:22,26-41`). It does not otherwise normalize aliases/defaults. |
| Provider snapshot | Only after eligibility and expected-fingerprint checks, `publish()` builds schema v1 `snapshot` containing identifiers, canonical approved fingerprint, SHA-256/base64url normalized-caption digest, the caption, connection/destination references, platform, requester, language, and timestamp (`publishing-service.js:51-60`). It does not generate or validate Board approval; it binds the already accepted fingerprint to the job. |

There is no storage schema validator for individual Board-node keys and no server sanitizer/merge of `canvas_json`; the PUT replaces the entire JSONB document. A stale overlapping save is prevented within one page by `state.isSaving`; optimistic `lastKnownUpdatedAt` prevents a known older client from replacing a newer server revision. A previously scheduled autosave that fires while the approval save runs sees `isSaving` and exits. However, edits occurring after request serialization but before completion can be incorrectly covered by `state.isDirty = false` and `refreshLastSavedSnapshot()` over newer memory; save completion is not revision-content confirmation. That general race is real, but it is not needed for the deterministic image boundary above.

## 2. Social Media Posting field-by-field comparison

Browser and server use the same projection rules **at their respective moments**, but the browser receives the live node and the server receives persisted JSONB.

| Requested field/category | Browser and server fingerprint treatment | Boundary differences/risk |
|---|---|---|
| role/type | Includes raw `type || ""`. | No alias normalization; legacy role aliases differ if upstream changes them. |
| platform/channel | Includes both raw `channel` and `social.platform` independently. | Eligibility falls back `platform || channel`, but fingerprint does not reconcile them. A default added on only one persisted representation changes the hash. |
| title | Included raw. | Empty/absent/null/falsy collapse; whitespace and line endings preserved. |
| content | Included raw even when LinkedIn publishes `social.caption`. | Editing an internal/fallback content field invalidates a caption-based post. |
| `social.caption` | Included raw. Publishing requires/normalizes this field only; unlike browser readiness it does not fall back to `content`. | Persistence JSON rules apply; whitespace is material for approval while provider caption uses trim plus CRLF→LF normalization. |
| `social.hashtags` | Included as raw value or null. | Arrays preserve order; object key order is not canonical; `[]` differs from null. |
| social CTA fields | `social.cta` and top-level `cta` both included; `social.preview` also included. | Missing/falsy collapses to empty string. Other CTA aliases are excluded. |
| language | Excluded (`language`, `contentLanguage`). | Presentation uses aliases but approval does not. |
| media references | Full `images` value included. | **Proven divergence:** persistence filters URLs and reconstructs image elements; JSONB may reorder nested keys. No other media alias is included unless nested in `variants`/`landingPage`. |
| URL fields | No standalone URL field is selected. URLs inside included opaque objects are material. | Image URL filtering is material. Caption URLs remain raw caption text. |
| format | Excluded unless embedded within an included opaque object. | No canonical format alias. |
| status | Excluded. | Approval safely hashes after status changes; no self-invalidation. |
| readiness metadata | Excluded. | Browser/server calculate readiness independently; neither calculation is hashed. |
| ownership metadata | Excluded. | Persistence normalizes/removes owner data without affecting hash. |
| planningSchedule | Excluded. | Legacy `social.scheduledAt/scheduledDate/scheduledTime/addedToCalendar` are also excluded because the bounded social projection omits them. |
| comments/Post-its | Excluded, including casing/field variants not selected. | No invalidation. |
| AI Review | Excluded (`aiReview`, `ai_review`, `review`). | No invalidation. |
| timestamps | Excluded, except timestamps nested inside `images`, `landingPage`, or `variants`. | Image `createdAt` is explicitly rebuilt/defaulted and therefore can diverge. |
| undefined | Projection scalar undefined collapses to defaults. Nested undefined follows JSON.stringify. | Request serialization can remove undefined from opaque objects after browser hashing, creating a mismatch. |
| legacy aliases | Only `channel` is included beside `social.platform`; `funnelStage` is included but `strategy.funnelStage` is not. Content presentation falls back caption/content, but hashing includes both independently. | Server performs no Canvas-node alias normalization. Browser restoration only applies persistence sanitizer/status/owner normalization. |
| browser-only fields | Position, selection, transient generation flags, most UI state excluded; transient flags are dropped by persistence. | No fingerprint effect unless inside included opaque objects. |
| server defaults | None are injected into the node by publishing. | PostgreSQL JSONB representation can canonicalize nested object key order before Node receives it. Because the hash uses ordinary JSON.stringify on opaque objects, this can be material. |

## 3. Exact approval mutation ordering

The real Approved transition is:

1. Validate account/access/Board identity and call `resolveCurrentContentNode()` (`app.js:16591-16603`).
2. Recalculate readiness and pre-transition material fingerprint; require equality with the prepared action (`:16604-16606`).
3. Validate requested transition, readiness, warning acknowledgement, and note (`:16607-16614`).
4. Assign `node.status = "Approved"` (`:16615`).
5. Calculate `workspace.materialFingerprint(node)` and assign `node.approvedContentFingerprint` (`:16621-16622`).
6. Assign `approvalMetadata` after the fingerprint (`:16623`).
7. Record status-change activity (`:16626`).
8. Update Canvas card/Inspector/list, then `markUnsaved()` (`:16627-16630`).
9. Mark approval persistence `saving` and rerender Content Workspace (`:16631-16634`).
10. Await `saveBoardToServer("canonical-content-approval")` (`:16635`). Serialization occurs inside the call, followed by PUT and JSONB replacement.
11. Categorize merely the save return boolean as `saved`/`error`, rerender, and return (`:16636-16638`).

The stored fingerprint is calculated **after status assignment but before fingerprint assignment and before approval metadata assignment**. Because status, the fingerprint itself, and approval metadata are all excluded, this ordering is not self-invalidating. It is correctly post-transition for the fields currently projected. Activity and rerender do not alter projected material.

## 4. Persistence and revision conclusions

- The exact outgoing node is the shallow-spread live node after image, status, owner, and transient-field sanitation. The exact outgoing approval field is `approvedContentFingerprint`.
- JSON serialization, Canvas validation, API storage, JSONB, Board restoration, and server lookup all permit/retain that field.
- There is no server merge that overwrites it; the full Canvas is replaced.
- Same-page overlapping saves are skipped; optimistic concurrency rejects known revision conflicts. This does not amount to serialized edit/save transactions, and the post-snapshot edit race described above remains possible.
- `saveBoardToServer()` success means a successful response plus timestamp/access bookkeeping. It does not assert that the response Canvas contains the same node/fingerprint, does not reload it, and exposes publishing immediately after setting the local persistence map to `saved`.
- Publishing therefore can begin after HTTP completion but before any authoritative hydration/semantic confirmation.
- Publishing reloads the Board by ID in a new server request. It receives whichever committed `boards.canvas_json` is current at that request, not a requested revision. Neither preflight request nor service carries `updated_at`/revision. Consequently the route cannot prove it loaded the exact revision acknowledged to the approval UI.

## 5. Current/stale UI ownership and coexistence

There are three separate state identities:

1. Declarative card state from live `state.nodes` → `projectAsset()` writes current approval and controls visibility.
2. Ephemeral `approvalPersistenceByNode`, whose default is `saved`, gates only action presentation and is set from the Boolean save result.
3. Imperative DOM feedback from a failed publishing preflight.

After reapproval and HTTP save success, the declarative rerender shows current approval and Publish. When the authoritative preflight rejects, `openPublishDialog()` finds no declarative stale element (because `approvalChanged` is false), creates one immediately before `.cw-actions`, and writes the same stale copy into `.cw-feedback`. It does **not** mutate `state.nodes`, change the stored fingerprint, update `approvalPersistenceByNode`, or rerender. Therefore the already-rendered `.cw-approved-current` remains next to the newly inserted `.cw-stale-approval`, while publish visibility also remains. This precisely explains simultaneous current text, stale recovery, and bottom toast; no multiple lifecycle generation is required. A later full rerender would remove the injected stale element unless the projection itself became stale.

## 6. Publishing preflight boundary and rejection ordering

1. Browser click binds the freshly projected asset. `openPublishDialog()` submits `boardId`, `nodeId`, generated `clientRequestId`, and **`expectedApprovedFingerprint: asset.fingerprint`** (the browser's recalculated current fingerprint), not the stored fingerprint (`content-workspace.js:70`).
2. `preflightLinkedInPublish()` first blocks dirty memory, fetches the authenticated account's LinkedIn destination, adds `destinationId`, and POSTs `/api/social-publishing/linkedin/preflight` (`app.js:16476-16483`). Authentication itself is session-cookie based.
3. The route accepts only UUID Board/destination IDs, bounded reference node/request IDs, and bounded expected fingerprint; it adds authenticated owner and server request IDs (`api/social-publishing-route.js:6-13`; `api/social-publishing/linkedin/preflight.js:3`). There is no fingerprint-version/shape check beyond the general reference regex.
4. `resolve()` authoritatively loads that Board through access control, accepts legacy array or canonical object Canvas, resolves exact node ID, loads owner-scoped connection/destination, recalculates server fingerprint, and runs ordered eligibility (`publishing-service.js:22-41`).
5. **First explicit preflight branch:** before returning the eligibility result, `preflight()` compares `state.node?.approvedContentFingerprint !== input.expectedApprovedFingerprint`; mismatch (including missing node/stored value) returns `approval_stale` (`:44-48`). Thus the reported response proves this submitted/stored comparison rejected first. It does not prove whether the underlying category was missing fingerprint, different revision, wrong Board/node, or sanitizer-induced mismatch.
6. If that comparison matches, eligibility's earliest approval-specific failures are missing stored fingerprint and then stored-versus-server-recalculated mismatch (`linkedin-publishing.js:58-61`). Its ordered response distinguishes these as `approval_fingerprint_missing` versus `approval_stale`.
7. Publish repeats authoritative resolve, first returns the ordered eligibility failure, then separately compares the preflight-returned expected stored fingerprint (`publishing-service.js:51-56`).

For the observed **preflight click** response, the exact first rejected condition in code is **submitted expected fingerprint mismatch with the authoritative node's stored `approvedContentFingerprint`**. The browser sent its current calculated hash, so the strongest code-supported cause is a persistence/revision boundary difference. The image sanitizer is the first deterministic such boundary in the save path. The current response envelope cannot discriminate saved revision mismatch, wrong node/Board, or the precise changed projected input.

## 7. Safe diagnostic design for BW-32.3.5

Emit one bounded diagnostic on preflight and publish, and optionally echo it to the browser. It must contain categories/booleans only:

```json
{
  "clientRequestId": "bounded-reference",
  "serverRequestId": "bounded-reference",
  "boardRevisionCategory": "request_revision_match|request_revision_absent|newer_than_confirmed|unknown",
  "nodeResolutionCategory": "exact|missing|duplicate_id|board_missing",
  "submittedFingerprintPresence": true,
  "storedFingerprintPresence": true,
  "storedFingerprintVersion": "v1|missing|invalid|unknown",
  "recalculatedFingerprintVersion": "v1|invalid|unknown",
  "submittedStoredMatch": false,
  "storedRecalculatedMatch": false,
  "lastConfirmedPhase": "request_validated|board_loaded|node_resolved|approval_compared|eligible",
  "rejectionCategory": "fingerprint_missing|fingerprint_format_invalid|submitted_stored_mismatch|stored_recalculated_mismatch|revision_mismatch|node_mismatch|board_mismatch|other",
  "timestamp": "ISO-8601"
}
```

Do not include caption, title, content, complete inputs, Board content, account/provider data, tokens, destination/provider identity, raw revision payloads, or full fingerprints. If support needs correlation, expose at most a fixed short prefix (for example eight hex characters) taken from an already cryptographic SHA-256 digest of each full fingerprint—not a prefix of the current non-cryptographic `v1` value—and label it non-authoritative.

## 8. Why BW-32.3.3 passed

The exact fixture (`scripts/check-bw32-3-3-canonical-reapproval.js`) is principally source-token assertions plus pure-function tests:

| Production boundary | Covered? |
|---|---|
| Real browser/server fingerprint functions | **Yes**, both modules are called on the same in-memory `node` at line 35. |
| Real Board serializer/sanitizer | **No.** |
| Real save endpoint | **No.** The script only checks that source contains the awaited call. |
| JSON request/JSONB round trip | **No.** `JSON.parse(JSON.stringify(...))` clones fixture objects, but no `serializeState()`, sanitizer, API handler, or JSONB behavior runs. |
| Reload saved Board | **No.** |
| Real publishing preflight/service | **No.** It imports only the pure fingerprint module; no route/service/Board access executes. |
| Production-shaped legacy fields | **Partial.** It includes channel, scheduledAt, planning metadata, presentation data, and external history, but no image/media objects, undefined values, key-order perturbation, or Board envelope. |
| Actual approval/save lifecycle wait | **No.** Source substring/regex assertions only. |
| Autosave/edit race | **No.** |
| Stale feedback clearing / mutual exclusion | **No.** It checks that guided copy exists, not DOM lifecycle behavior. |

The artificial agreement is specifically line 35: both duplicate hash helpers receive the **same unsanitized object**. Line 36 then installs the browser helper's result directly into another in-memory clone. The test never places serialization/persistence between the approval hash and server hash, so it cannot expose the first divergence. It also never invokes `openPublishDialog()` twice or asserts that `.cw-approved-current` and `.cw-stale-approval` are mutually exclusive.

## 9. One narrow authoritative recovery

For BW-32.3.5, implement one versioned material-projection contract and canonical serialization, with equivalent browser/server implementations validated by shared cross-runtime vectors **before and after the exact Board JSON round trip**:

1. Define a `v2` projection for Social Media Posting using intentional semantic fields (including an explicit media-reference contract), normalized strings/line endings/nulls, array policy, and recursively sorted object keys; hash canonical UTF-8 bytes with SHA-256 and version the output.
2. Keep `approvedContentFingerprint` as the sole Board stored property. Calculate it from the **post-transition, persistence-normalized authoritative material projection**—never from unsanitized presentation memory—and exclude status/approval metadata from the projection.
3. Save with a Board revision token; require the save response's returned Canvas/revision to contain the exact node and stored v2 fingerprint, then hydrate/accept that authoritative state. Leave approval persistence `saving` and hide/disable publish until this confirmation completes.
4. Send the confirmed revision and stored fingerprint in preflight. The server reloads that Board revision, resolves one exact node, validates submitted=stored and stored=recalculated, and remains authoritative. Do not auto-approve and do not bypass comparison.
5. Derive current/stale presentation and publish visibility from one accepted lifecycle state. A successful reapproval/round-trip explicitly clears all per-node stale feedback; any server stale result transitions that same state to stale and rerenders rather than appending contradictory DOM.
6. Add regression vectors covering blob/data/HTTP images with extra keys, undefined-to-JSON changes, CRLF/LF, empty/absent/null, reordered nested keys, legacy array Canvas and aliases, plus a real serializer/API-like JSON round trip, authoritative reload, real preflight, delayed save/edit race, and an assertion that current and stale UI cannot coexist.

This is narrow because it changes only the approval material contract and its persistence confirmation/diagnostic boundary; it preserves explicit human approval and authoritative server rejection.

## 10. Go/no-go

**NO-GO until one missing fact is captured automatically:** add the safe boundary diagnostic above to capture, for the failing request, the Board revision category and the submitted/stored and stored/recalculated match categories. The exact code-level correction is proven (canonicalize the persistence-normalized v2 projection and confirm its authoritative saved revision before publishing), but the present response cannot automatically prove whether the observed production instance first differed at serialization or loaded a different saved revision. No manual inspection is required or requested.
