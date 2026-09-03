# BW-32 Social Connector architecture and product audit

**Audit date:** 2026-09-03
**Roadmap identifier:** BW-32 (the repository's latest authoritative implemented/audited sequence is BW-31.5.2; no conflicting BW-32 definition was found)
**Scope:** Documentation-only architecture, product, security, platform-capability, migration, and test audit for LinkedIn, Instagram, Facebook, and X.
**Evidence:** Current repository source and audits; official provider documentation listed in §3.
**Documentation reachability:** Official provider pages were requested on 2026-09-03, but this audit environment's outbound tunnel rejected every request with HTTP 403. In accordance with the audit rule, capability claims that require current provider evidence are marked **Unverified** rather than inferred from memory, blogs, or tutorials.

## 1. Executive conclusion

**Architecture decision: conditional GO for an additive, server-owned connector subsystem; NO-GO for production connection, publishing, scheduling, or analytics until the platform-specific gates in this audit are reverified against reachable official documentation and real approved applications/test accounts.**

The smallest safe design is not another set of fields on a Canvas node. It is six separate durable concepts—`ConnectedAccount`, `TokenSecret`, `PublishingDestination`, `PublishJob`, `ProviderAttempt`, `ExternalPost`, followed later by `PerformanceSnapshot`—behind one capability-driven server adapter contract. Canvas remains the editable content authority. A job captures an immutable approved material snapshot and fingerprint; an external-post record anchors delivery truth; snapshots anchor measured truth. Board JSON receives, at most, read-only UI projections and never tokens or provider payloads.

Existing `planningSchedule` is explicitly `scope: "internal_planning"`. It remains useful without a connector and never becomes a job implicitly. `Approved` is editorial evidence bound to `approvedContentFingerprint`; `Published` is currently only a manually set editorial-looking legacy status and is not provider proof. Deterministic readiness, AI Review, Funnel Simulator output, external delivery, and measured platform performance are independent domains.

Recommended delivery order remains:

1. foundation and LinkedIn connection;
2. LinkedIn publish-now with text first, optionally one image only after official media limits and upload workflow are verified;
3. durable LinkedIn scheduling, reconciliation, status, and measured performance;
4. Instagram and Facebook as separate products over shared Meta infrastructure;
5. X only after pricing/access and required write/analytics entitlements are contractually acceptable;
6. richer media and explicit cross-platform campaigns later.

The proposed **LinkedIn first production slice** is personal-profile text publishing plus organization text publishing only if official product access and administrator discovery are proven. Links are plain text in Phase 1 unless official link-preview guarantees are verified. One image is a tightly gated extension, not a launch promise. Video, carousel, edit/delete, native provider scheduling, webhooks, and analytics are excluded from the first publishing release.

## 2. Current Funklix architecture

### 2.1 Ownership map

| Concern | Current owner and behavior | Connector consequence |
|---|---|---|
| Authentication/session | Google OAuth routes live under `api/auth/google`; `_auth-session.js` signs/verifies the `funklix_session` HttpOnly cookie using `AUTH_SECRET` or `SESSION_SECRET`. Session identity is email/name/avatar. | Social OAuth must be a second, state-bound authorization lifecycle; it must not replace login identity or expose tokens through the session cookie. |
| Accounts | There is no separate workspace/tenant entity. The authenticated email is the practical account identity; Boards persist `owner_id` and `owner_email`. | Introduce a stable internal account/user owner before token custody. Do not use mutable display names as ownership keys. |
| Boards/storage | `api/_boards-storage.js` owns PostgreSQL setup through `POSTGRES_URL`; Boards store `canvas_json`, owner, brand relationship, timestamps, sharing fields, and editor rows. Browser state hydrates/serializes the Canvas. | Connector tables are additive relational records keyed to account and Board; no connector secret belongs in `canvas_json`. |
| Board access | `_board-access.js` resolves `owner`, `editor`, `viewer`, `brand_viewer`, `public_viewer`, or unowned compatibility and returns capabilities including `canEdit`. Mutating routes re-check access. | Every command and worker execution must re-resolve Board, node, and current rights. UI visibility is not authorization. |
| Canvas/node identity | `state.nodes` is the live authority; each node has a Board-local stable `id`. Board serialization persists nodes/edges. | Provenance key is at least account + Board ID + node ID + material fingerprint; node ID alone is insufficient. |
| Social Media Posting | Canonical node role. Current social object uses `platform`, `caption`, `hashtags`, `preview`/`cta`, and legacy schedule fields. Common fields include `title`, `content`, `channel`, `funnelStage`, `audience`, `tone`, `images`, `favoriteImageId`, owner, status, comments, and timestamps. | It is the only V1 publishable role. Platform is editorial intent, not an authorized destination. |
| Editorial approval | `content-workspace.js` defines Draft → In Review → Approved/Needs Changes and stores `approvedContentFingerprint` on approval. Its `materialFingerprint()` covers type, title, content, channel, funnel stage, social, landing page, images, variants, CTA, audience, and tone. | Job creation requires Approved plus exact current fingerprint. The job stores that fingerprint and immutable bounded payload. |
| Readiness | `calculateReadiness()` returns Ready, Needs attention, or Incomplete. Social requires platform and caption; CTA absence is a warning. Its capability result currently sets schedule/publish false. | Reuse as one input, then add platform validation. Incomplete blocks. Needs attention requires acknowledgment only for non-platform warnings; provider-required violations always block. |
| Internal planning | Canonical `planningSchedule` v1 includes `scope: internal_planning`, local date/time, IANA timezone, resolved UTC instant, DST disambiguation, schedule revision, asset fingerprint, and change detection. Legacy `social.scheduledDate`, `scheduledTime`, `scheduledAt`, and `addedToCalendar` remain readable. | Never treat either canonical or legacy planning fields as queued delivery. Explicit conversion creates a separate job. |
| Content Workspace | `content-workspace.js` projects current Canvas assets, readiness, review queue, filters, calendar, editorial transitions, and planning. `app.js` provides authorized callbacks and node re-resolution. | Add publishing projections/actions later, but all entry points call one canonical server command. Preserve current content projection semantics. |
| Content Calendar | Calendar is an internal-plan projection with month/week/agenda UX and timezone-aware planning contract. | A planned event may offer “Schedule for publishing”; it must visibly distinguish plan from durable job. |
| `openContentPlanning` and dialogs | `app.js` delegates to the workspace planner. Dialog confirmation writes planning metadata after eligibility and stale-content checks. | Do not overload this function to publish. A separate confirmation flow may consume its selected instant. |
| Activity history | Board activity is stored with Canvas state; events cover edits/review and bounded UI history. | Add safe events (connected, disconnected, scheduled, cancelled, accepted, failed) containing internal IDs and classifications only. Never content, tokens, provider bodies, or raw errors. |
| Autosave | Canvas mutations mark dirty and flow through local draft/Board save behavior; localStorage may hold a Canvas draft. | Connector mutations must use server transactions, never autosave/localStorage. Publishing success must not depend on saving a browser projection. |
| AI Insights | Current Insights contains deterministic Canvas diagnostics and an honest “no measured analytics” boundary. AI Review is advisory; Funnel Simulator is modeled. | Performance enters only from versioned snapshots tied to external posts. Default AI prompt projection excludes provider identifiers/raw fields and all secrets. |
| Public/read-only | Public token uses a hash in PostgreSQL and an `x-board-public-token` request header. Serializer/access contracts restrict viewer/public roles. Brand Viewer inherits bounded brand access, not edit rights. | Only editors/owners act. Viewer surfaces may receive a bounded status projection if Board policy permits; Public Viewer should default to no delivery details. |
| API conventions | Vercel-style CommonJS handlers under `api/`; routes validate method, session, body, Board access, and return bounded JSON/error codes. Existing long work has explicit processing-job routes. | Follow server-only REST commands, normalized envelopes, strict sizes, safe status codes/correlation IDs, and separate worker entry point. |
| Secrets/environment | Server reads OAuth/database/provider keys from `process.env`; Google client secret, session secret, OpenAI keys, PostgreSQL URL, Blob credentials, and worker secret are server-only. There is no general token vault. | Add envelope-encrypted token storage/vault abstraction and key identifiers. Environment variables may hold app credentials and wrapping keys, not per-user tokens. |
| Current providers | Google login; OpenAI text/image APIs; Vercel Blob for documents/images; PostgreSQL; website retrieval. No social connector, social token store, external-post table, webhook endpoint, or measured-performance sync exists. | Social delivery is greenfield and must not reuse OpenAI/provider diagnostics or public image storage without a media-security review. |

### 2.2 Existing publishing-, schedule-, platform-, analytics-, and external-looking fields

This inventory prevents accidental semantic reuse:

- **Node/general:** `id`, `type`, `title`, `content`, `description`, `channel`, `funnelStage`, `strategy.funnelStage`, `audience`, `tone`, `language`, `contentLanguage`, `status`, `ownerEmail`, `ownerName`, `ownerAvatar`, `updatedAt`/`updated_at`, `images[]`, `favoriteImageId`, `imagePrompt`, `variants[]`, `cta`, `postits[]`, `reviewNotes[]`, `aiReview`/`ai_review`/`review`.
- **Social:** `social.platform`, `caption`, `hashtags` (legacy strings and canonical arrays can occur), `preview`, `cta`, `scheduledDate`, `scheduledTime`, `scheduledAt`, `addedToCalendar`.
- **Canonical planning:** `planningSchedule.version`, `scope`, `localDate`, `localTime`, `timeZone`, `scheduledAtUtc`, `disambiguation`, `scheduleRevision`, `assetFingerprint`, plus projected `changed`, `kind`, and validation reason.
- **Editorial:** `status` values Draft, In Review, Needs Changes, Approved, Published; `approvedContentFingerprint`; review note/event metadata. `Published` is manual and **not external evidence**.
- **Readiness/diagnostics:** calculated `level`, issue `code`/`severity`, capability booleans, Canvas/Insights fingerprints, diagnostic scores/findings, AI review score/prose, and Funnel Simulator modeled values. None are measured platform analytics.
- **Board/provenance:** Board `id`, owner fields, `canvas_json`, `created_at`, `updated_at`, brand references, editor role, public-view fields, and client board-load/access generation.
- **Images/storage:** image records/URLs and public Blob-backed generated assets exist; they are content references, not provider upload IDs.
- **Absent:** connected account, scopes, refresh/access token, destination ID/capability, publish job/attempt, idempotency key, external post ID/URL, delivery status, webhook identity, metric timestamp/value, reporting window, or analytics source.

### 2.3 Five boundaries that must remain explicit

| Domain | Meaning | Existing/future authority |
|---|---|---|
| Internal plan | Funklix intent for a local date/time. Works offline from social accounts. | Existing `planningSchedule`; not a queue. |
| Editorial approval | A human approved one material fingerprint. | Node status + `approvedContentFingerprint`; becomes stale on material edit. |
| External delivery | A durable command and provider outcome. | Future Publish Job, Provider Attempt, External Post. |
| Manually marked Published | Legacy/manual editorial label with no provider proof. | Existing `node.status`; display with “manually marked; not external publication.” |
| Measured performance | Provider observations at a timestamp/window. | Future immutable Performance Snapshots; never readiness, AI opinion, or simulation. |

## 3. Official platform capability verification

### 3.1 Evidence policy and references

Each platform section was accessed on **2026-09-03**. All official pages below were unreachable from the audit environment because the outbound tunnel returned HTTP 403. Therefore every contract-sensitive value is **Unverified** and must be rechecked before Phase B/C. These links are the authoritative re-verification set, not evidence that a feature is currently available:

- **LinkedIn:** [OAuth](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication), [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api), [Images API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/images-api), [Videos API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api), [Organization access control](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role), [Community Management overview/access](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/community-management-overview), [Social metadata](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/social-metadata-api), [versioning](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/versioning).
- **Instagram/Meta:** [Instagram Platform overview](https://developers.facebook.com/docs/instagram-platform/), [content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing/), [insights](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/), [webhooks](https://developers.facebook.com/docs/instagram-platform/webhooks/), [access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/), [Graph API versioning](https://developers.facebook.com/docs/graph-api/guides/versioning/).
- **Facebook Pages/Meta:** [Pages API overview](https://developers.facebook.com/docs/pages-api/overview/), [Pages posts](https://developers.facebook.com/docs/pages-api/posts/), [Page access tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/#pagetokens), [Pages API webhooks](https://developers.facebook.com/docs/pages-api/webhooks/), [App Review](https://developers.facebook.com/docs/app-review/).
- **X:** [OAuth 2.0 authorization-code flow with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code), [create Post](https://docs.x.com/x-api/posts/create-post), [media upload](https://docs.x.com/x-api/media/quickstart/media-upload-chunked), [Post lookup](https://docs.x.com/x-api/posts/lookup/introduction), [webhooks](https://docs.x.com/x-api/webhooks), [rate limits](https://docs.x.com/x-api/fundamentals/rate-limits), [pricing](https://docs.x.com/x-api/getting-started/pricing).

### 3.2 Exact current capability matrix

“U” means **Unverified on 2026-09-03**. It does not mean no. No production promise may be derived from a U cell.

| Platform | Connectable destination | Personal publishing | Company/Page publishing | Required account type | Text | Image | Video | Carousel | Link | Publish now | Native scheduling | Analytics | Webhooks | Token refresh | App review | Pricing/access concern | Recommended Funklix phase |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|
| LinkedIn | Member and/or organization: U | U | U | Member/org role/product entitlement: U | U | U | U | U | U | U | U | U | U | U | U | Community Management/product approval and quotas: U | 1 connection/publish; 2 status/metrics |
| Instagram | Professional identity and linked assets: U | U | U/not equivalent to Page | Business/Creator and linkage requirements: U | U | U | U | U | U | U | U | U | U | U | U | Meta Login/product/app mode/review constraints: U | 3 |
| Facebook | Page and acting user/system identity: U | U | U | Page + eligible role/task: U | U | U | U | U | U | U | U | U | U | U | U | Meta permissions, review, development/live mode: U | 3 |
| X | User account: U | U | N/A | Developer project/app and eligible plan: U | U | U | U | U | U | U | U | U | U | U | U | Current write/read volume and pricing: U | 4 |

### 3.3 Required verification record per platform

Before implementation, a signed engineering/product evidence note must copy the official contract version/date and answer every item below. Until then it is unknown:

| Area | LinkedIn | Instagram | Facebook | X |
|---|---|---|---|---|
| Account/destination | member vs organization; organization role | consumer vs Creator/Business; Page linkage | user vs Page; Page tasks/roles | user/project/app relationship |
| OAuth | version, authorization code, PKCE support/requirement, redirect exactness | Meta Login variant, code exchange | Meta Login, Page token derivation | OAuth 2 code+PKCE and/or OAuth 1.0a needed by endpoints |
| Permissions | exact member write, org write/read, analytics scopes | exact basic/publish/insights/page scopes | exact Page list/read/write/insights scopes | exact tweet/media/offline scopes |
| Review/access | products, development restrictions, review evidence | App Review and Advanced Access | App Review/Advanced Access and live mode | developer access tier/plan |
| Tokens | user/org/Page token type, lifetime, refresh, revocation | short/long-lived behavior and exchange | user/Page lifetimes and invalidation | refresh-token issuance/rotation and offline access |
| Content | text, URL/article, image registration/upload, video, multi-image, alt text, edit/delete | containers, media hosting, captions, carousel, video processing | feed/photo/video/multi-photo/link, edit/delete | post/media IDs, reply/quote/poll constraints, edit/delete |
| Operations | endpoint/version headers, daily/member/app limits, polling/status, scheduling | container expiry, publish limit, status, native schedule | Page limits, scheduled publishing semantics | endpoint/user/project limits and ambiguous-request support |
| Measurement | member/org metrics, fields/windows, permissions | media/account metrics and availability | post/Page insights and breakdowns | public/non-public metrics and tier limits |
| Events | webhook topics, signatures, delivery/retry | webhook fields/signature | Page subscriptions/signature | webhook products, setup, delivery/retry |

Development applications and test users must never be assumed representative of production. A live test must prove consent, destination discovery, role loss, token expiry/refresh, one publish, lookup/reconciliation, and any analytics field promised.

### 3.4 Realistic first-version offer

Because provider contracts are currently unverified, the only unconditional Phase 1 offer is **connection architecture and a disabled capability preview**. Once LinkedIn gates pass, offer publish-now for approved text to destinations explicitly returned as write-capable. Add one image only if registration/upload, MIME/size/dimension limits, processing status, and test-account publication are verified. Do not advertise native scheduling: Funklix can schedule its own server-side Publish Jobs independently of provider-native scheduling.

## 4. Strategy comparison and rollout

| Strategy | Benefits | Costs/risks | Decision |
|---|---|---|---|
| All platforms together | Broad launch story; shared UI exercised early | Four approvals, token models, media workflows, quotas, errors, and analytics semantics multiply risk; weakest provider delays all | Reject. |
| LinkedIn first | Matches B2B content workflow; one adapter proves provenance and job model | Product access/org roles and metrics still require verification | Recommend, conditional on gates. |
| Meta first | Instagram + Facebook share infrastructure and can reach two destinations | Shared infrastructure does not make products identical; account linkage, containers, Page roles, review and media add complexity | Defer to Phase 3. |
| Aggregation provider | Potentially faster OAuth/scheduling and one API | Vendor holds/mediates tokens, markup/pricing, feature lag, reduced diagnostics/analytics, subprocessors, lock-in | No vendor recommendation without verified docs, pricing, DPA, deletion/export and live proof. |
| Direct adapters behind internal contract | Funklix controls token custody, provenance, UX, retries, and data portability | More engineering and platform operations | Recommend. Keep a future aggregator as another adapter only if it meets the same contract. |

**Sequence:** A foundation → B LinkedIn connection → C LinkedIn publish-now → D durable LinkedIn scheduling/status → E LinkedIn measurements → F Instagram then Facebook (or jointly only where independently gated) → G X → richer media/campaign orchestration.

Tradeoffs: direct integration has the highest initial complexity and approval burden but strongest token ownership, error fidelity, analytics provenance, and extensibility. An aggregator may reduce time-to-market but adds cost, outage/platform dependency, compliance/subprocessor exposure, and potentially lossy analytics. LinkedIn-first bounds reliability work; Meta-first broadens media complexity; X is held until access pricing and quotas are commercially viable.

## 5. Product terminology

| Concept | English | German | Definition |
|---|---|---|---|
| Connected Account | Connected account | Verbundenes Konto | A server-held authorization granted by one Funklix account to one platform identity; not a destination and never content. |
| Publishing Destination | Publishing destination | Veröffentlichungsziel | A discovered profile, organization, Page, or account identity that the connection may currently write to. |
| Internal Plan | Internal plan | Interne Planung | Funklix editorial date/time intent; valid without a connector and never delivery. |
| Publish Job | Publish job | Veröffentlichungsauftrag | A durable, explicit command to deliver one immutable approved revision to one destination now or later. |
| External Post | External post | Externer Beitrag | Provider-addressable result associated with exactly one source job/revision. |
| Delivery Status | Delivery status | Zustellstatus | Normalized operational state independent of editorial status. |
| Performance Snapshot | Performance snapshot | Performance-Messstand | Immutable measurement captured for one external post, window, provider schema, and retrieval time. |

Connecting never publishes, creates/reschedules jobs, edits nodes, changes planning, changes editorial status, or backfills external posts.

## 6. Canonical additive data model

IDs are opaque UUID/ULID-style stable identifiers; external IDs are strings. Every table has `created_at`, `updated_at` where mutable, and tenant-account indexing. Provider metadata is allowlisted JSON with a schema/version and size bound.

### 6.1 Entities

**ConnectedAccount**

- `id`, `owner_account_id`, `platform`, `external_account_id`, `external_display_name`, `destination_type`/identity type;
- sorted `granted_scopes`, `connection_status` (`pending|active|partial|needs_attention|revoked|disconnected`);
- `token_secret_id`, `token_expires_at`, `refresh_expires_at?`, `last_validated_at`, timestamps, safe metadata;
- unique active identity constraint scoped to owner/platform/external account; one owner has many connections.

**TokenSecret**

- `id`, `connected_account_id`, encrypted access/refresh token ciphertexts, nonce/tag, encryption-key ID/version, token type, expiry, rotated timestamp; no plaintext metadata or token hash exposed to application logs;
- one active secret version per connection, historical versions destroyed after safe rotation; accessed only by server vault interface.

**PublishingDestination**

- `id`, `connected_account_id`, `platform`, `external_destination_id`, destination type (`profile|organization|page|account`), safe display name/avatar;
- normalized role/permission state, capability document/version (`text`, `image`, `video`, `carousel`, `link`, `publishNow`, `analytics`, `delete`, `edit`, limits), `last_capability_refresh_at`, availability;
- one connection discovers many destinations; unique provider destination per active connection. Discovery is not authorization forever.

**PublishJob**

- `id`, `owner_account_id`, `board_id`, `node_id`, `approved_material_fingerprint`, `snapshot_schema_version`, immutable bounded content/media manifest, `destination_id`;
- `requested_delivery_at_utc`, `original_local_date`, `original_local_time`, `timezone_source`, `timezone`, DST disambiguation;
- `created_by_account_id`, `status`, `attempt_count`, random `idempotency_key`, `last_error_class`, timestamps, `cancelled_by/at`, lock lease fields;
- one job targets exactly one destination and revision. One cross-platform action produces one job per destination, never a multi-provider mutable row.

**ProviderAttempt**

- `id`, `publish_job_id`, attempt ordinal, safe request fingerprint, adapter/version, started/completed times, normalized outcome, HTTP class (not body), provider correlation ID if safe, error class, ambiguity flag;
- append-only; one job has many attempts, but only safe retry transitions permit another.

**ExternalPost**

- `id`, `platform`, `external_post_id`, `destination_id`, `publish_job_id`, `source_account_id`, `source_board_id`, `source_node_id`, exact fingerprint/revision;
- safe URL if supplied/derivable under verified contract, `published_at`, normalized delivery state, `deletion_state`, `last_synced_at`;
- unique `(platform, destination_id, external_post_id)` and normally one canonical external result per job. Never overwrite provenance during retries/reconciliation.

**PerformanceSnapshot** (later)

- `id`, `external_post_id`, `metric_schema_version`, `captured_at`, `window_start/end`, provider timezone and currency if relevant;
- allowlisted provider-specific normalized fields, cross-platform normalized metrics, endpoint/API-version provenance, completeness (`complete|partial|unavailable|not_permitted|deleted`), source update time;
- append-only. Corrections create a new snapshot, never rewrite history.

### 6.2 Cardinality, ownership, lifecycle, deletion

```text
Account 1—N ConnectedAccount 1—1 active TokenSecret
ConnectedAccount 1—N PublishingDestination
Account 1—N Board 1—N node (inside Canvas authority)
Board/node/revision 1—N PublishJob; PublishJob N—1 Destination
PublishJob 1—N ProviderAttempt; PublishJob 1—0..N ExternalPost
ExternalPost 1—N PerformanceSnapshot
```

Safest V1 ownership is **personal connection ownership**: only the connecting Funklix account can manage/use its connection, while a destination may be selected for a Board the actor may edit. Do not share refresh credentials through a Board. Workspace-shared connections require a future workspace entity, delegated administrators, explicit grants, offboarding, and audit policy.

Disconnect revokes where supported, destroys tokens, disables destinations, cancels unsent jobs for that connection, and preserves redacted jobs/posts/snapshots for bounded audit/retention. Board deletion cancels unsent jobs transactionally and retention-tombstones provenance; it does not silently delete external posts. Account deletion triggers revocation, secret destruction, queued cancellation, GDPR export/deletion workflow, and policy-based pseudonymization. External-post deletion preserves a tombstone and historical snapshots per retention policy.

**Secret decision:** add a dedicated `TokenVault` abstraction backed initially by envelope-encrypted database ciphertext if and only if production has a managed KMS/wrapping key, rotation and audited access. Prefer a managed secret/KMS service as scale/compliance grows. Existing plain fields and general environment handling are insufficient. Tokens are forbidden in Canvas/Board JSON, localStorage, sessionStorage, browser config, activity, logs, diagnostics, support exports, and AI prompts.

## 7. Authoritative provenance chain

```text
Funklix account
 → Board
 → Social Media Posting node
 → immutable material snapshot + approval fingerprint
 → Publishing Destination
 → Publish Job
 → Provider Attempt(s)
 → External Post
 → Performance Snapshot(s)
 → bounded AI Insights projection
```

This chain answers Board, node, exact revision, initiating/scheduling actor, destination, provider acceptance, external ID, metrics ownership, metric window, and retrieval time. The mutable node may project latest delivery state but does not own it. Measured values must resolve through `PerformanceSnapshot.external_post_id`; never attach measurements directly to the node or infer them from platform/name/date.

## 8. Eligibility and lifecycle boundaries

### 8.1 Action-time eligibility

One canonical server command must atomically verify:

1. authenticated account and session binding;
2. current Board `canEdit` (not Viewer/Brand Viewer/Public Viewer);
3. authoritative Board payload and exact node resolution;
4. exact `Social Media Posting` role;
5. deterministic readiness is not Incomplete;
6. editorial status exactly Approved;
7. recomputed current material fingerprint equals `approvedContentFingerprint`;
8. selected destination belongs to actor's active connection and platform;
9. fresh granted scopes, connection validation, role/permission, and destination capability;
10. server-side content/media validation for current provider contract.

Needs-attention warnings may be acknowledged in the final confirmation only when advisory (for example, CTA quality). Length, required media, MIME/codec, destination permission, scope, or any provider requirement is a hard blocker. The acknowledgment and warning codes are stored with the job, not used to weaken later platform validation.

### 8.2 Changes and exceptional events

| Event | Required behavior |
|---|---|
| Content edited before delivery | Existing job snapshot never changes. Mark job `blocked_stale`/cancel pending execution and require re-approval plus an explicit replace/reschedule action. Never silently publish newer text. |
| Approval stale/revoked | Block queued execution; preserve job/audit; user creates replacement after approval. |
| Node deleted | Cancel unsent job; preserve tombstoned node ID/snapshot. Published external content is not automatically deleted. |
| Planning date removed/changed | Does not affect job. Offer explicit cancel/reschedule with clear divergence warning. |
| Account disconnected/token revoked | Cancel or block unsent jobs as `connection_attention`; never auto-switch connection. Published records remain. |
| Role/scope lost | Block before provider mutation; connection needs attention. Re-discover capability after reconnect. |
| Board deleted | Transactionally cancel unsent jobs and retention-tombstone provenance; external deletion requires a separate deliberate command. |
| Ownership changed | Jobs retain creator/source; future use requires new actor/connection authorization. Pending personal-connection jobs should be cancelled or explicitly reauthorized, never transferred silently. |
| Failed delivery retry | Revalidate all eligibility, destination, snapshot, and unknown-outcome state. Deliberate retry for permanent/content failures after a new job; automatic retry only for known-safe temporary failures. |

Creating a job sets delivery `queued`/`scheduled`, never editorial `Published`. Provider acceptance creates/updates external delivery truth; node status remains editorial.

## 9. Scheduling and durable worker

### 9.1 Conversion decision

Evaluate four paths:

- **Explicit “Schedule for publishing”: recommended V1.** From an approved asset or planned event, show destination/content/time summary and create the job only after confirmation.
- **Confirmation from a planned item: recommended entry point**, but it invokes the same explicit command.
- **Automatic creation after connection: reject.** Consent to connect is not consent to publish and could mutate years of plans.
- **Background reconciliation: use only for status/capability health**, never to infer/create jobs from planning metadata.

Publish now is the same command with `requested_delivery_at_utc = now`; scheduled delivery can prefill canonical planning time. Persist both the UTC instant and original local date/time, IANA timezone, source (`planning_schedule|user_selection`), and DST disambiguation.

### 9.2 Worker contract

- A server worker/scheduled function claims due rows with transactional row lock or atomic compare-and-swap from `scheduled` to `executing`, a short lease, worker ID, and attempt ID. Browser timers are forbidden.
- Enforce database uniqueness on the idempotency key and canonical active job tuple; serialize per destination where provider ordering/limits require it. Bound global/platform/account concurrency.
- A restarted worker reclaims expired leases. A deployment cannot lose jobs because queue state is durable.
- Suggested tolerance: execute as soon as practical after due time; alert on p95 latency and jobs delayed beyond a defined SLO (product must choose, e.g. five minutes). Never backdate provider timestamps.
- Retry only known temporary failures: bounded exponential backoff with jitter, provider `Retry-After` when verified, maximum attempts/age, and no retry beyond content relevance cutoff. Permanent failures stop. Auth failures pause affected connection jobs. Storage/internal contract failures remain non-mutating and alert operations.
- Cancellation uses compare-and-swap and is allowed before provider mutation. If executing, return “cancellation pending/too late” and reconcile. Reschedule creates a new requested instant/revision under lock or cancels/replaces the old job; history remains.
- Missed jobs after downtime are claimed in order within a policy window; old jobs become `missed_review_required`, not dumped onto providers. Use database time as authority and monitor application/DB clock skew.
- Observe queue depth/age, claim conflicts, attempt latency, provider class, ambiguity, retry count, connection health, and reconciliation age with IDs only.

## 10. Capability-driven publishing adapter

Illustrative server-only contract:

```text
SocialPublishingAdapter {
  createAuthorizationUrl(context) -> { url, stateHandle, expiresAt }
  exchangeCallback(code, stateHandle, verifier?) -> SafeConnectionGrant
  refreshToken(secretHandle) -> SafeTokenUpdate
  discoverAccounts(connection) -> SafeAccount[]
  discoverDestinations(connection) -> SafeDestination[]
  getCapabilities(destination) -> CapabilitySet
  validateContent(destination, immutableDraft) -> ValidationResult
  prepareMedia(destination, mediaManifest) -> PreparedMedia
  publishNow(destination, draft, preparedMedia, attemptContext) -> PublishResult
  getPostStatus(externalRef|reconciliationHint) -> StatusResult
  getPostDetails(externalRef) -> PostDetails
  getPerformance(externalRef, window) -> MetricResult
  revoke(connection) -> RevokeResult
}
```

All methods return normalized, size-bounded, allowlisted data plus stable error classifications and safe provider correlation values. Provider request/response payloads and tokens remain server-side and are never persisted wholesale. Version adapters independently. LinkedIn can expose member/org author types, upload-registration phases, and metric availability through capability flags and typed extension metadata. Other adapters may report `unsupported`; the interface does not require fake scheduling, carousel, editing, webhook, or analytics parity.

Shared UI fields cover text, destination, media, time, and delivery. Capability flags drive provider-specific panels and validation. This avoids both platform leakage into core records and a lowest-common-denominator product.

## 11. OAuth and account-connection UX

### 11.1 User flow

1. Open **Settings → Social connections**.
2. Choose platform and see exact requested permissions, purpose, destination types, and data retention.
3. Continue to provider.
4. Server creates a single-use, high-entropy state record bound to session/account, provider, exact redirect URI, intended return location, PKCE verifier where supported/required, issue/expiry time, and attempt correlation ID; browser receives only state/authorization redirect.
5. Callback accepts only provider-required values (`code`, `state`, documented error values), validates exact state/session/provider/redirect/expiry and consumes it atomically before code exchange.
6. Server exchanges code, validates returned identity and exact granted scopes, encrypts token, and discovers destinations/capabilities.
7. User selects destinations and confirms. Only then activate the connection.
8. Settings shows health, last validation, granted capability summary, reconnect/disconnect—not tokens or sensitive provider IDs.

Use OAuth authorization-code flow; require PKCE whenever the provider supports/requires it, but reverify each provider. Exact HTTPS redirect URIs are allowlisted server-side. Validate callback host/origin deployment configuration; do not trust query `returnTo`. Single-use state prevents CSRF/replay. Authorization code exchange happens once server-side with strict timeout and no redirects to arbitrary hosts.

### 11.2 Failure behavior

- Denied consent/expired code/invalid state: no connection created; safe restart action.
- Partial scopes: store only after explaining reduced capability and explicit confirmation; publishing stays disabled when write scopes are absent.
- Mismatched external identity: show bounded identity confirmation; never merge/replace an existing connection implicitly.
- Callback in another browser/session: reject and restart; do not weaken session binding.
- Reconnect: creates new state, validates identity, rotates encrypted secret atomically, refreshes destinations, and leaves jobs blocked until health is confirmed.
- Disconnect: confirm affected pending-job count, revoke where verified, destroy secret, cancel/block jobs, retain redacted provenance.
- Lost scopes/role: health becomes needs attention; refresh/discovery and action-time checks enforce it.

No OAuth result, token, scope blob, destination list, or raw error is placed in query parameters. The final callback redirects with a short internal completion handle or server session flash only.

## 12. Publishing UX and status language

From Content card, Calendar event, Inspector, or Canvas node, every action resolves `(boardId,nodeId)` and calls one canonical publishing command. No surface implements its own eligibility or writes provider state.

Journey: **Review content → Confirm destination → Confirm media → Publish now or use/select internal planned time → Review immutable delivery summary (revision, actor, destination, time, warnings) → Submit → Show progress → Success or actionable failure.** The confirmation shows that later edits do not modify the submitted job.

Distinct UI projections:

- **Planned internally / Intern geplant** — `planningSchedule` only.
- **Scheduled for publishing / Zur Veröffentlichung geplant** — durable future job.
- **Publishing / Wird veröffentlicht** — claimed/submitted attempt.
- **Published / Veröffentlicht** — external-post evidence; if only legacy status exists, say “manually marked; not externally verified.”
- **Delivery failed / Zustellung fehlgeschlagen** — terminal/actionable job failure.
- **Connection needs attention / Verbindung erfordert Aufmerksamkeit** — auth/capability issue.
- **Delivery status unknown / Zustellstatus unbekannt** — ambiguous external mutation; never present “Retry” until reconciled or deliberate duplicate-risk review.

Entry-point projections may show bounded status, but Canvas nodes are not updated as the authority. Editorial badge and delivery badge remain separate.

## 13. Media architecture

### 13.1 Current media findings

Social nodes use common `images[]` and `favoriteImageId`; posting visuals can be generated through OpenAI and Blob-backed image storage. Image values may include remote/public URLs and generated records. There is no canonical immutable media asset/version, upload ownership proof, alt-text field, provider media ID, video model, carousel order contract, MIME/dimension/size validator for social delivery, or private signed delivery URL contract. Existing server remote-image fetch in posting-visual generation is not sufficient proof of SSRF-safe provider media ingestion.

### 13.2 Required pipeline

- Resolve each selected source to an account/Board-owned immutable asset ID/version and content hash. Reject arbitrary browser URLs by default.
- For approved allowlisted remote sources, server fetches with DNS/IP checks, blocks private/link-local/metadata networks and redirect rebinding, enforces HTTPS, byte/time/redirect limits, and streams rather than buffering unbounded data.
- Sniff MIME and verify extension/content; decode and validate provider-specific byte size, dimensions/aspect ratio, animation, and corruption. Strip unsafe metadata as policy requires.
- Video requires separate codec/container, dimensions, frame rate, duration, audio, size, resumable upload and processing-state validation; defer until a verified phase.
- Temporary derivatives live in private scoped storage with short signed URLs only if the provider must pull them. Provider upload handles are scoped to job/destination/content hash and expire; cleanup runs after terminal/expiry states.
- Deduplicate preparation by `(platform,destination,asset_hash,transformation_version)` only where provider rules allow reuse. Never reuse a media ID across identities without verified permission.
- Add explicit alt text/caption fields and preserve carousel ordering in the immutable snapshot; validate accessibility and provider limits.

**LinkedIn Phase 1:** text only is the launch floor. Permit one image as a gated launch feature only after official documentation and a live approved app verify upload, ownership, format/size/dimensions, alt text behavior, processing, and publish lookup. Support personal and organization text destinations only when discovery returns write capability. Treat URLs as text; do not promise a generated link preview. Exclude video and carousel.

## 14. Stable error model

Diagnostics contain `error_class`, phase, internal correlation IDs, provider/status class, adapter version, attempt ordinal, and timestamps—never token, provider body, raw platform error, user content, URL query, media bytes, or external display identity.

| Class | Retry | User action/message | Queue/connection effect | Safe support diagnostic |
|---|---|---|---|---|
| `connection.authorization_denied` | Permanent for attempt | “Authorization was not granted. Try connecting again.” | No job; unchanged | phase + attempt ID |
| `connection.invalid_callback` | Permanent | “Connection could not be verified. Start again.” | No connection | state reason code |
| `connection.missing_scope` | Deliberate reconnect | “Required publishing permission is missing.” | Jobs blocked; attention | missing scope code, not token |
| `connection.expired_token` | Automatic refresh once if supported, else reconnect | “Connection expired. Reconnect.” | Pause; attention if refresh fails | expiry/refresh class |
| `connection.revoked_access` | Deliberate reconnect | “Platform access was revoked.” | Block/cancel pending; attention | validation endpoint class |
| `connection.destination_unavailable` | Deliberate refresh/select | “Destination is no longer available.” | Job blocked | destination internal ID |
| `connection.insufficient_role` | Deliberate role fix | “You no longer have permission to publish there.” | Job blocked; attention | normalized role class |
| `content.missing_text` | Permanent until new approved revision | “Add post text and approve it again.” | Job not created/failed | rule code |
| `content.unsupported_length` | Permanent | “The post exceeds this destination’s limit.” | Not queued | limit/version, observed length only |
| `content.missing_media` | Permanent | “Required media is missing.” | Not queued | media rule code |
| `content.invalid_media` | Permanent | “This media cannot be processed.” | Not queued | MIME/dimension class only |
| `content.unsupported_format` | Permanent | “This format is not supported for this destination.” | Not queued | capability version |
| `content.approval_stale` | Permanent | “Content changed after approval. Approve the current revision.” | Block/cancel | fingerprints represented by internal revision IDs only |
| `content.content_changed` | Permanent | “The queued revision no longer matches current content.” | `blocked_stale` | job/revision IDs |
| `content.node_missing` | Permanent | “The source asset no longer exists.” | Cancel | Board/job/node internal IDs |
| `delivery.rate_limited` | Automatic when safe | “Platform limit reached; delivery will retry.” | Remains queued with next time | retry-after bucket |
| `delivery.temporary_platform_failure` | Bounded automatic | “Platform is temporarily unavailable; delivery will retry.” | Queued | HTTP class/phase |
| `delivery.permanent_platform_rejection` | Deliberate after correction | “Platform rejected this post. Review requirements.” | Failed | normalized rejection category |
| `delivery.duplicate_request` | Reconcile, not retry | “A matching delivery already exists; checking status.” | Reconciling | idempotency/job IDs |
| `delivery.timeout_unknown` | No blind retry | “Delivery status is unknown. Funklix is checking before any retry.” | `unknown`, not queued | attempt timing/correlation |
| `delivery.external_post_not_found` | Reconcile then deliberate | “The external post could not be found.” | degraded/tombstoned | lookup class |
| `delivery.capability_removed` | Deliberate destination fix | “Publishing is no longer available for this destination.” | Block; attention | capability delta code |
| `system.worker_unavailable` | Automatic operational | “Delivery is delayed; no action is needed yet.” | Queued | worker/lease class |
| `system.storage_failure` | Automatic if mutation not sent | “Funklix could not safely process delivery yet.” | Queued only if no provider call | transaction phase |
| `system.stale_job` | Deliberate review | “This scheduled delivery needs review.” | Review-required | age/policy code |
| `system.authorization_changed` | Deliberate reauthorization | “Your access changed. Review the connection.” | Block; attention | access generation |
| `system.internal_contract_mismatch` | No user retry; alert | “Delivery is unavailable while Funklix checks this job.” | Quarantine | adapter/schema version |

## 15. Idempotency, ambiguous outcomes, reconciliation

- Generate one unpredictable internal key at job creation; unique-index it and include destination + exact snapshot fingerprint in a separate duplicate guard. Every UI retry is a command with the existing job ID, never another uncontrolled POST.
- Persist attempt intent and request fingerprint before calling the provider. Mark `provider_call_started` transactionally, then persist response/external ID. Use provider idempotency only when official docs prove semantics; internal protection remains mandatory.
- If publish succeeds but the response is lost, set `delivery_unknown`. Do **not** automatically call publish again.
- Reconciliation uses a returned provider correlation/upload handle if available, then external post lookup/search only where an official endpoint gives a deterministic match. Compare destination, author, bounded publication time, and safe content/media fingerprint; do not match on text alone.
- If exactly one result is proven, attach it as External Post and mark published. If none and the provider contract proves the request could not have committed, a fresh attempt may be safe. Otherwise remain unknown.
- User sees “Delivery status unknown,” time, destination, “Check status,” and a manual platform-review instruction. A forced retry requires elevated confirmation explaining duplicate risk and should normally create a new job linked to the ambiguous one. Never claim success from timeout alone.

## 16. Security and privacy

- Envelope-encrypt tokens at rest with AEAD, per-record data keys, managed wrapping-key IDs, authenticated metadata, least-privilege service identity, rotation/re-encryption procedure, and access audit. Rotate provider client secrets independently.
- Request only minimum scopes at the phase that needs them. Store exact grants and validate before mutation. Never silently expand on reconnect.
- Central redaction removes authorization/cookie headers, callback codes/state, token-shaped values, URL queries, content/media, raw provider errors, and PII from logs/traces/support output.
- OAuth state/PKCE/session binding, exact redirect URI, single use/TTL, SameSite/HttpOnly/Secure cookie, callback host allowlist, and no open redirect protect CSRF/replay.
- Media retrieval applies the SSRF controls in §13. Webhooks require exact provider signature/timestamp verification, replay storage, size/type limits, event deduplication, and destination lookup before effects.
- Every record is tenant/account scoped. Board read/edit authorization and authoritative node/revision validation occur at command time and again before worker mutation.
- Audit events include actor, action, internal object IDs, classification, timestamp, and outcome only. Bounded user events: connection added/needs attention/disconnected; delivery scheduled/cancelled/started/published/failed/unknown; external deletion observed.
- Publish a retention schedule: short OAuth state/temporary media/diagnostics; job/attempt provenance for operational/legal period; snapshots per customer analytics policy. Support GDPR export of safe connection/post/metric metadata and deletion/revocation while accounting for legal retention and externally published content.
- Token-compromise response: disable connection, revoke/rotate provider credentials, destroy tokens, stop jobs, invalidate states/webhook secrets, audit affected access, notify under policy, and require reconnect.
- **AI default deny:** tokens, scopes, external account/destination/post IDs, provider request/errors, webhook payloads, connection metadata, raw platform analytics, comments, and URLs are excluded. A later explicit Insights feature may send only aggregated normalized metrics with provenance labels and consent/policy checks; never represent inference as measured fact.

## 17. Analytics ingestion (future only)

1. Synchronizer selects eligible External Posts and resolves current metric capability.
2. Prefer verified webhook hints for freshness, but use idempotent polling as source-of-truth where webhooks are absent/incomplete. Webhooks enqueue sync; they do not directly overwrite metrics.
3. Preserve provider metric names, endpoint/API version, account/post context, organic/paid classification, window, timezone, currency, retrieval and provider-update time in allowlisted normalized raw fields.
4. Map to categories such as impressions, reach, views, engagements/reactions, comments, shares/reposts, saves, clicks, video starts/completions/watch time, followers, and conversions only when definitions are documented. Null means unavailable; zero means measured zero.
5. Suggested cadence is provider/rate-limit dependent: initial after publication, then more frequently while fresh and taper over time. It is not set until official limits are verified.
6. Snapshots are immutable; late/revised values append. Keep completeness/revision state and never sum overlapping windows blindly.
7. Separate organic from paid; personal from organization/Page; platform-native and cross-platform normalization. No unsupported comparison or invented equivalent.
8. Deleted/inaccessible posts retain last snapshots plus deletion/unavailable state subject to retention; stop polling when policy says terminal.

AI Insights consumes a bounded projection labeled `measured` with source, external-post reference (internalized), period, captured time, definition/schema, completeness, currency/timezone, and organic/paid context. It remains separate from deterministic readiness, provider-backed AI Review, Funnel Simulator assumptions, and AI-inferred insights. Modeled/inferred statements must be visibly labeled and cannot populate measured cards.

## 18. Permissions and Public Viewer

| Role | View bounded delivery | Connect/manage account | Select destination/create/cancel job/publish | Notes |
|---|---:|---:|---:|---|
| Board owner | Yes | Yes, own connection | Yes, own connection after checks | Board ownership does not grant another user's token. |
| Authenticated editor | If Board policy allows | Yes, own connection | Yes, own connection after checks | Safest V1. |
| Viewer | Optional high-level status only | No | No | Hide scopes, provider IDs/errors and account health detail. |
| Brand Viewer | Optional high-level status only | No | No | Brand read access is not Board edit/token authority. |
| Public Viewer | Default no; at most published/failed generic projection if explicitly enabled later | No | No | Never expose destination identity, schedule details, URLs unless already intended public, IDs/errors, or connection metadata. |

Account connection management requires authenticated edit-capable users even though the connection is personally owned. Disconnect/reconnect requires the connection owner; a Board owner may cancel Board jobs but cannot inspect or operate another person's token. Shared workspace connections are deferred.

## 19. UX/navigation placement

Evaluate: global Settings fits personal credential lifecycle; Board Settings falsely implies Board token ownership; Content Workspace is appropriate for asset operations but not global connection management; a permanent Social destination adds unnecessary Phase-1 navigation.

**Decision:** add **Settings → Social connections** for connect/health/reconnect/disconnect. Put operational publishing in Content Workspace and Calendar, with Inspector/Canvas shortcuts. Project delivery badges/details to cards, events, Inspector, and nodes from server records. Add no permanent primary navigation item. Preserve BW-30.1 full-width shell and Inspector lifecycle: Content/Calendar remain full-width; Inspector is mounted only for Canvas lifecycle, and opening a source node uses existing selection behavior.

## 20. Migration and compatibility

- Existing Boards open byte-semantically as before; no job, connection, external post, status, or metric is inferred.
- Canonical and legacy planning dates stay internal. Old/legacy timezone-less schedules require review before explicit conversion.
- Existing `Published` remains a manual status and displays “not externally verified”; no External Post is fabricated.
- Social posts without `approvedContentFingerprint` cannot publish; user must complete current approval flow.
- Normalize platform aliases only in a versioned display/eligibility adapter (for example case/legacy naming); preserve original value and require explicit destination. Do not destructively rewrite Board JSON merely on open.
- Duplicate platform names are editorial strings, not connection deduplication. Destination IDs come from verified discovery.
- Items scheduled before connector availability remain internal plans and receive an optional deliberate “Schedule for publishing” action.
- Disconnected connections preserve redacted provenance and block future jobs. Deleted external posts become tombstones after verified sync/user report; they do not alter node editorial status.

Opening an old Board never creates jobs, connects accounts, rewrites planning, changes editorial status, infers external posts, or marks content published.

## 21. Observability and support

Use random, non-secret IDs: `oauth_attempt_id`, `refresh_operation_id`, `publish_job_id`, `delivery_attempt_id`, `webhook_event_id` (internal hash/ID, not raw payload ID where sensitive), and `analytics_sync_id`. Propagate internal IDs through logs/traces; store safe provider correlation separately and never expose it by default.

Phases are finite enums: OAuth `state_created→callback_validated→code_exchanged→identity_verified→destinations_discovered→confirmed`; delivery `claimed→revalidated→media_prepared→provider_call_started→response_classified→external_post_recorded`; sync `selected→provider_called→normalized→snapshot_committed`. Diagnostics include phase/outcome/duration/version only.

Dashboards/alerts distinguish connection failure, refresh failure, queue depth/oldest age, delivery latency, rate limit, provider rejection, ambiguous delivery, reconciliation age, worker/storage error, and analytics delay/completeness. Never use content in metric labels.

## 22. Build versus buy

No aggregator is selected or recommended because current official vendor documentation, pricing, security/DPA/subprocessor terms, deletion/export behavior, quotas, and live platform support were not verified in this audit.

| Criterion | Direct adapters | Aggregator gate |
|---|---|---|
| Platforms/features | Implement only proven features; per-platform fidelity | Verify each destination/account/content/analytics feature, not logo list |
| OAuth/token owner | Funklix app and vault | Determine whether Funklix, vendor, or customer owns apps/tokens and revocation |
| Reliability | Funklix operates retries/reconciliation | Obtain SLA/status history, incident escalation, idempotency/unknown-outcome semantics |
| Scheduling/media | Build durable jobs and native workflows | Verify scheduling durability, limits, derivatives, alt text, videos/carousels |
| Analytics/webhooks | Maximum provenance/control | Verify metric definitions, freshness, raw access, webhook coverage/replay |
| Isolation/compliance | Funklix controls tenancy/retention | DPA, subprocessors, regions, encryption, access controls, GDPR export/delete, breach terms |
| Pricing/rates | Platform + engineering/ops cost | Current base/seat/account/post/API overage, platform pass-through, limits |
| Portability/lock-in | Stable internal model | Export tokens (usually impossible), destinations, posts, IDs, schedules, metrics; termination plan |
| Time to market | Slower initial, extensible | Potentially faster only after procurement/security/platform proof |

Decision framework: score verified evidence (not sales claims), run the same controlled end-to-end test suite, model three-year cost at expected accounts/posts/metrics, review DPA/security, test export/termination, and require the vendor adapter to return the same normalized provenance/errors. Choose buy only if time saved outweighs loss of capability/control and all go/no-go gates pass.

## 23. Future implementation phases

Expected files are illustrative; exact names require implementation audit. Every phase preserves app boot safety and existing Board behavior.

| Phase | Exact scope/dependencies | Expected files/database impact | Unchanged systems | Tests and go/no-go gate |
|---|---|---|---|---|
| A — foundation | Entities, migrations, vault, adapter types, OAuth state service, Settings shell; **no provider connection/publishing**. Requires KMS/retention/tenant identity decisions. | New `api/social/*`, `_social-*` modules, migrations, settings UI/i18n/tests; six core tables may be staged, snapshots deferred. | Canvas JSON, planning, editorial flow, existing providers/routes. | Contract/security/migration tests. GO only with encryption rotation, redaction, authorization, rollback and no-token-browser proof. |
| B — LinkedIn connection | Official-contract pin, OAuth, identity/destination discovery, member/org role validation, health/reconnect/disconnect. | LinkedIn adapter/routes; ConnectedAccount/TokenSecret/Destination/OAuth-state rows. | No publishing; Content/Calendar unchanged except optional capability projection. | Mock adapter + controlled live app. GO only with approved production access, exact scopes/redirects, token lifecycle, personal/org evidence. |
| C — LinkedIn publishing | Canonical command, eligibility, immutable snapshot, text publish-now; optionally one image behind verified flag; provenance and actionable result. | Job/attempt/external-post tables and routes; bounded Content/Inspector/Canvas actions/projections. | Internal planning, editorial status, Insights metrics. | Contract, route, live publish/lookup, stale approval, ambiguity. GO only with idempotency/reconciliation and external ID proof. |
| D — durable schedule | Worker, leases, backoff, cancellation/reschedule, missed/unknown reconciliation, Calendar projection. | Worker endpoint/service, indexes/leases, scheduler deployment configuration in its later task. | `planningSchedule` remains internal; manual Published unchanged. | Restart/concurrency/duplicate/missed-job tests. GO only with durable scheduler, monitoring, runbook, latency SLO. |
| E — LinkedIn performance | Status/detail sync, verified metrics, immutable snapshots, bounded AI Insights projection. | Snapshot/sync tables/routes/workers; Insights projection UI. | Readiness, AI Review, Simulator remain separate. | Metric schema/provenance/late data/live account. GO only when permission, definitions, retention and measured labels are proven. |
| F — Meta | Separate Instagram and Facebook OAuth/destination/content/metrics adapters; minimal media per verified contracts. | Meta adapters/routes/capabilities; reuse core tables, add versioned extensions. | LinkedIn jobs unaffected; no implicit cross-post. | Independent live/review/mode tests for each platform. GO per platform, not shared-brand assumption. |
| G — X | Connection, minimal publish, status, metrics based on current tier/price. | X adapter/routes/capabilities; core schema unless proven extension needed. | Other adapters and Board domains. | OAuth/media/quota/price/live tests. GO only after commercial approval and stable access. |

### Expected blast radius

Future production work will touch authentication-adjacent callbacks, Settings/navigation/i18n, Content Workspace/Calendar/Inspector/Canvas projections, Board/node authorization resolution, PostgreSQL migrations/storage, secret management, media storage/retrieval, new API routes/worker deployment, activity, Insights, observability, and tests. The blast radius is deliberately reduced by keeping jobs/external data outside Board JSON and one canonical command behind an adapter.

### Systems explicitly unchanged by this audit and by early connector phases

This audit changes no runtime. Future A/B must leave Canvas node schema and rendering, Board serialization/autosave/local drafts, `planningSchedule`, editorial transitions/fingerprint, deterministic readiness, AI Review, AI Brain, Funnel Simulator, Insights classifications, public sharing, Brand Core, document processing, existing Google login, OpenAI generation, full-width shell and Inspector lifecycle behavior unchanged except explicit additive projections approved in their phase.

## 24. Test architecture

### Pure contract tests

- full eligibility matrix and authoritative node resolution;
- independent editorial/readiness/planning/delivery states;
- destination capability evaluation and platform alias handling;
- every error classification/table behavior;
- state machine legality, cancellation, stale revisions;
- schedule local/DST → UTC conversion;
- idempotency, duplicate guard, ambiguity/reconciliation decisions;
- exact account→Board→node→fingerprint→job→attempt→post→snapshot provenance;
- deletion/ownership/disconnect retention behavior.

### Adapter tests

- deterministic mocked LinkedIn authorization URL/state/code exchange and token refresh/rotation;
- partial scope, member/org destination discovery, admin-role loss, capability refresh;
- text (and gated image) validation/publishing, processing, lookup;
- timeout after provider commit, duplicate response, rate limit/retry-after, rejection sanitization;
- status/details, revoke, performance normalization and unavailable metrics.

Mocks contain synthetic IDs/content and assert no secrets/raw bodies escape.

### Integrated HTTP/runtime tests

- real route methods, validation, serialization/status codes and session/state callback lifecycle;
- encrypted-token boundary (database ciphertext, no browser/log/Board/activity/AI leakage);
- one canonical command invoked from Content card, Calendar, Inspector, Canvas;
- queued worker claim/restart/concurrency/duplicate prevention and exact provenance;
- stale approval/content rejection; node/Board deletion; disconnect/revocation/role changes;
- owner/editor success and Viewer/Brand Viewer/Public Viewer denial/projection;
- existing Content Workspace/Calendar/planning/autosave/public viewing preserved;
- Light/Dark Mode, English/German, keyboard/focus, responsive mobile/desktop.

### Live pre-production proof

Maintain provider-approved controlled accounts: at least one LinkedIn member and one test organization with a documented administrator, plus later isolated Meta professional/Page assets and X account. Use a non-customer staging app with exact registered HTTPS callbacks where provider policy permits; otherwise an approved production-like test tenant. Publish uniquely tagged non-sensitive text, capture returned IDs, verify in provider UI/API, test delete only if in scope, role removal, consent denial, token expiry/refresh, revocation, rate limit safely, status lookup, and analytics delay. Record app mode, product access, scopes, API version, plan, timestamp, and evidence. Mocks never prove a real app, scope, callback, post, metric, or price.

## 25. Explicit go/no-go gates

1. **Platform evidence gate — NO-GO now:** reachable official docs reviewed and pinned for every promised capability; access date/version recorded.
2. **Commercial/app gate:** approved app/products, acceptable terms/pricing/quotas, production/live mode, controlled destinations.
3. **Identity/security gate:** stable Funklix account ownership, KMS-backed vault, rotation, redaction, OAuth state/PKCE, threat model and incident runbook proven.
4. **Authorization gate:** route and worker revalidate account, Board editor, node, revision, connection, role/scope/capability.
5. **Editorial gate:** Approved exact fingerprint; Incomplete and platform requirements block; warnings explicitly acknowledged.
6. **Mutation-safety gate:** durable idempotency, attempt journal, timeout ambiguity state, reconciliation and no blind retry.
7. **Media gate:** immutable ownership, SSRF controls, verified limits/workflow and cleanup; otherwise text-only.
8. **Scheduling gate:** durable worker/lease/restart/backoff/cancel/missed-job behavior and monitoring; no browser dependency.
9. **Provenance gate:** external ID and every measurement trace to account/Board/node/revision/job/attempt/timestamps.
10. **Privacy gate:** retention/export/delete/DPA policy; no secret/content leakage; AI exclusion default.
11. **UX/accessibility gate:** status separation, canonical command, actionable safe errors, EN/DE, themes, responsive/keyboard coverage.
12. **Live proof gate:** controlled real connection, destination discovery, publish and lookup; later metric retrieval. Mock-only remains NO-GO.

## 26. Unresolved external prerequisites

- Restore access to official LinkedIn, Meta, Instagram, Facebook, and X documentation and record current versions/contracts.
- Decide/create the LinkedIn developer application, products, review submission, organization test administrator, production redirect domains, legal URLs, and verification evidence.
- Confirm LinkedIn personal vs organization publishing, exact scopes, token refresh/expiry/revocation, supported post/media/link forms, limits, lookup, deletion/editing, webhooks, analytics permissions/definitions, and development/production differences.
- Later confirm separate Instagram/Facebook business/account linkage, Page tasks, Meta Login flow, app review/Advanced Access/live mode, token derivation/lifetime, container/media rules, limits, insights and webhooks.
- Later confirm X OAuth endpoint compatibility, offline refresh, write/media/analytics/webhook access, quotas and current price/contract.
- Establish stable account/workspace identity roadmap, KMS/vault, key rotation, worker/scheduler infrastructure, private media storage, data regions/retention, GDPR and incident policies.
- Decide delayed-job SLO, retry age, unknown-outcome support process, Board deletion retention, whether organization publishing joins initial LinkedIn launch, and whether one image clears the Phase-C gate.
- If buy is reconsidered, collect current official vendor API docs, pricing, SLA, security report, DPA/subprocessors, platform app/token ownership, limits, export/deletion and termination evidence before selection.

## 27. Final recommendation

Proceed with BW-32 Phase A design only after the platform-evidence and security ownership prerequisites are assigned. Implement direct provider adapters behind one capability-driven server contract, personal connection ownership in V1, immutable job snapshots, durable server scheduling, external-post provenance, and append-only measurements. LinkedIn is still the rational first integration, but production scope is conditional: text publish-now to only those member/organization destinations demonstrated by current official access and a live approved app; one image is optional behind its own gate. Keep internal plans, human approval, deterministic diagnostics, delivery, manual Published labels, and measured analytics visibly and structurally separate.
