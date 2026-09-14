# BW-34.0 — Company social publishing, performance tracking, and posting-plan export feasibility audit

**Audit date and official-document retrieval date:** 2026-09-14

**Audit mode:** read-only repository inspection and public official documentation; no live provider calls, credentials, database access, configuration changes, deployments, or social-account actions.

**Decision confidence:** repository findings are high confidence; platform access remains conditional on Felix confirming the named capabilities in the relevant developer console because approval, account eligibility, product availability, quotas, and pricing are account-specific and can change without a code release.

## 1. Executive decision

| Question | Plain answer |
|---|---|
| Which company platform first? | **Facebook Page — GO, first connector.** It offers the shortest legitimate proof: publish a text/link Page post without first solving media hosting, while fitting the existing destination, encrypted-token, approval, job, attempt, and external-post boundaries. |
| Can Tendra One publish to its own account before full customer-app review? | **Conditionally yes.** A Page controlled by Tendra One and a Facebook user assigned an app role can normally test permissions while the Meta app is in Development mode. This is not customer availability. Felix must confirm that the app dashboard grants the required permissions/features to the app-role test user and Page. No real post may be claimed until that controlled test succeeds. |
| Which real metrics in version one? | For the Page's own post, poll only values actually returned by Graph API: reaction/like total, comment count, share count, and eligible Page-post insights such as impressions, reach, clicks, and engagement. Store `null`/unsupported—not zero—when a metric or insight is absent. Video views are out of the text/link proof. |
| Can comments be counted or retrieved? | **Count: yes, when `comments.summary(true)` is authorized. Content/authors: technically possible with additional Page read capability, but explicitly deferred** pending review of permissions, privacy, retention, deletion, moderation, and webhook obligations. A count is not comment ingestion. |
| Smallest useful export? | A deterministic, UTF-8-with-BOM **CSV posting plan** for authorized Board Content/Social Media Posting nodes, with filters and RFC 4180 quoting. It is read-only and independent of OAuth. |
| What blocks the first real post? | Felix must own/administer a real Tendra One Facebook Page; create/configure a Meta Business app, add Facebook Login, register the exact HTTPS redirect, add the test user as an app role and Page administrator/full-control user, confirm Development-mode access and the scopes `pages_show_list`, `pages_manage_posts`, and `pages_read_engagement` (plus `read_insights` for insights), and provide server configuration through the normal secret process. App Review/Advanced Access and likely business verification block customer accounts, not necessarily the controlled internal proof. |
| What immediately follows this audit? | Ship authorized CSV export first, then implement one thin Facebook Page OAuth/destination adapter, text/link publish-now, authoritative post persistence, and manual metric refresh. Do not build comments, scheduling workers, webhooks, media uploads, or cross-platform analytics yet. |

**Decision guardrail.** “Conditionally yes” is not evidence of a publication. The first post remains **NO-GO** until the developer-console prerequisite gate in sections 7 and 18 is evidenced. If Meta does not grant the controlled Page permissions, release CSV export and stop; do not fall back to personal LinkedIn publishing or simulated success.

## 2. Current repository architecture

### 2.1 Actual connection route and call chain

1. `app.js` initializes the LinkedIn settings UI. Browser settings code reads `GET /api/social-connections`, then starts/disconnects through the LinkedIn routes.
2. `api/social-connections-linkedin-start.js` accepts authenticated POST only, bounds the body, obtains the signed Google session identity through `social-connector-route`, ensures the social schema, and calls `linkedin-service.start`.
3. `linkedin-service.start` creates random OAuth state, stores **only its SHA-256 hash** with owner, cookie-derived session fingerprint, request IDs, fixed return path `/`, timestamps, and five-minute expiry in `social_oauth_attempts`, then returns the provider authorization URL.
4. `api/social-connections-linkedin-callback.js` accepts GET, requires the same signed application session, and calls `linkedin-service.complete`. The service transactionally locks and consumes state before code exchange, checking owner, provider, session binding, one-time use, and expiry.
5. The adapter exchanges the code and calls OIDC UserInfo. The service AES-256-GCM seals the credential, writes `social_token_secrets`, upserts a `social_connected_accounts` **personal** identity, and upserts one **personal** destination. The callback redirects only bounded status/request metadata to `/`; it never places a token in browser history.
6. `GET /api/social-connections` reads a bounded owner-scoped projection and makes that server projection the UI source of truth. It intentionally exposes no encrypted payload.
7. Disconnect locks the owner-scoped connection, revokes the local secret row, marks the connection disconnected, and makes destinations unauthorized/inactive in one transaction. The current adapter explicitly reports that remote revocation is unsupported.

This is a production route chain, but only for LinkedIn personal identity. Its live readiness depends on environment flags, provider product approval, schema availability, and an actual OAuth exercise; repository tests use fakes and do not prove a real connection.

### 2.2 Actual publish-now route and call chain

1. Content Workspace projects eligible nodes and calls `POST /api/social-publishing/linkedin/preflight`; `app.js` refuses while the Board has unsaved client changes.
2. The route accepts a tightly allow-listed body, requires a signed session, and calls `publishing-service.preflight`.
3. `resolve` reloads the Board server-side with `getBoardAccess`, requires edit authority, resolves the node, connection and owner-scoped destination, recalculates canonical approval material, checks credential/scopes/expiry and the personal destination type, and finds any job for the deterministic idempotency key.
4. `approvalBoundary` compares submitted, stored, and freshly recalculated v2 fingerprints. A Board revision is diagnostic concurrency evidence; material equality remains authoritative. Stale or legacy approval blocks.
5. After an explicit modal confirmation, `publish` repeats resolution and all checks, inserts an immediate queued job with an immutable content snapshot, atomically claims it as delivering, and writes attempt 1 before the provider request.
6. The encrypted token is opened only in server memory and cleared after use. `linkedin_text_publish_v1` currently sends text to the legacy LinkedIn UGC endpoint for a **person** author.
7. A retained provider URN is first persisted on the provider attempt. In a transaction the service inserts a unique external post and marks the job delivered. If database finalization fails after provider acceptance, it marks the job `outcome_unknown`; owner-scoped job polling can reconstruct the external-post record from the durable attempt identity without making a second provider request.
8. Content Workspace polls a bounded eight times and represents confirmed, failed, and ambiguous outcomes differently. A provider mock is never labelled a real publication by the regression scripts.

There is no job runner. Although the schema represents `delivery_mode='scheduled'` and due timestamps, the production route inserts only `immediate` and performs delivery synchronously. There is no safe automatic provider retry; ambiguous outcomes stop for reconciliation. “Retry” is only safe before delivery, or after a definitively rejected attempt under a future explicit policy.

### 2.3 Server and authorization boundaries

* Signed Google sessions are resolved by `api/_auth-session.js`; social route identities derive from the session email/id.
* PostgreSQL remains server-only through the existing `pg.Pool` exported by `api/_boards-storage.js` and `POSTGRES_URL`.
* `getBoardAccess` grants edit authority to Board owner/editor and qualifying Brand owner/admin/editor roles; viewers and unrelated users cannot preflight or publish.
* Publishing currently derives Brand authorization indirectly through the Board's authoritative `brand_id` in `getBoardAccess`; it does **not** snapshot a Brand or Campaign identity into the publish tables.
* The 14-table Supabase deny boundary plus the later `social_publishing_destinations` hardening must remain intact. Browser code never directly accesses social tables.

## 3. Existing capability inventory

“Production-used” below means reachable from a production route/UI path, not that a live provider exercise was observed.

| Component | File / symbol / state | Current responsibility and actual status | Reuse decision |
|---|---|---|---|
| Provider contract | `api/social-connector/contracts.js`; platform/status constants | Four platform names and lifecycle enums. Production-imported foundation; validation is partial and not a working multi-provider layer. | Reuse enums cautiously; do not mistake declared platforms for adapters. |
| Adapter registry | `api/social-connector/adapter-registry.js`; `defaultRegistry` | Defines operation names but registers only LinkedIn. Mostly foundation/test-facing; production services instantiate LinkedIn directly. | Do not expand into a large framework; a small Facebook adapter can later replace direct construction at the existing service seam. |
| OAuth state | `oauth-state.js`; `create`, `consume`; `social_oauth_attempts` | Random state, bounded TTL/return, owner/provider/session binding. Production start/complete reimplement persistence checks around it. | Reuse the rules/table; parameterize service without weakening one-use locking. Add PKCE for a provider flow when supported/required. |
| OAuth phase recovery | `linkedin-service.js`; `phase`, `inspectCommitted`; schema v4 phase fields | Records bounded progress and recovers a committed callback after response/construction failure. Production-used LinkedIn path. | Reuse semantics and request diagnostics. |
| Provider identity | `linkedin-adapter.discoverAccount`; `social_connected_accounts` | OIDC `sub`/name; hard-coded `account_type='personal'`. | Reuse table, not personal assumptions. For Meta store the authorizing Facebook user as the connection identity and Page as destination. |
| Destinations | `linkedin-adapter.discoverDestinations`; `social_publishing_destinations` | Returns exactly the personal member. Destination has type, external ID, label, capabilities, authorization and health. | Table is sufficient for Pages. Replace discovery with Page enumeration and store `destination_type='page'`. |
| Credential vault | `token-vault.js`; `seal/open/rotate`; `social_token_secrets` | AES-256-GCM, per-secret owner/platform/id AAD, versioned keys, size bounds; server-only. Rotate helper exists but no route/job orchestrates rotation. | Reuse without exposing payload. Store the Page credential needed by the chosen Graph flow; never return it to UI/logs. |
| Token refresh | `linkedin-adapter.exchangeAuthorizationCode`; optional refresh-token storage | Accepts a refresh token if returned, but adapter does not implement `refreshCredentials` and no refresh job exists. Expired tokens block publish. | Incomplete. Facebook implementation needs explicit long-lived-token/reauthorization policy based on actual token metadata; do not invent expiry. |
| Disconnect | `linkedin-service.disconnect` | Local credential revocation, connection disconnect, destination deactivation. No remote LinkedIn revocation. | Reuse transaction shape; call an official Meta revoke endpoint only if the selected flow documents it, otherwise fail closed locally. |
| Credential health | `settings-projection.project`, `evaluateLinkedInTextPublishEligibility` | Checks secret presence/revocation, connection/destination coherence, returned scopes, and expiry. No background validation or revoked-permission probe. | Reuse, extend provider-specific health and classify OAuth/permission errors to `needs_attention`/`unauthorized`. |
| Approval write | `api/content-review/approval-service.js`; `approve` | Server lock, edit authorization, readiness check, canonical v2 fingerprint, authoritative metadata. Production-used. | Reuse unchanged. |
| Approval/publish guard | `linkedin-publishing.js`; `evaluate...`, `approvalBoundary` | Exact content, approval, connection, destination, capability, duplicate, and feature-flag checks. Production-used personal LinkedIn only. | Extract only minimal provider-neutral safety checks; add Page-specific content/capability validation. |
| Publish routes | `api/social-publishing/linkedin/preflight.js`, `publish.js` | Authenticated bounded preflight/publish-now, authoritative response envelopes. | Mirror/parameterize for Facebook; do not change old personal LinkedIn behavior. |
| Publish jobs | `social_publish_jobs`; `publishing-service.publish` | Immutable approved snapshot, destination, immediate/scheduled shape, deterministic key, states and actor. Immediate route is production-used; scheduled execution is absent. | Sufficient for first Facebook immediate post. Keep scheduling dormant. |
| Provider attempts | `social_provider_attempts`; `publish`, `markFailure` | Attempt-before-request, acceptance identity, ambiguity and safe classification. Only attempt 1; no automatic delivery retry. | Sufficient for first connector and critical to reuse. |
| External posts | `social_external_posts`; finalization and `jobResult` | Provider ID/URL/time, source Board/node, approved fingerprint/snapshot digest, state and last-sync placeholder. Production LinkedIn path, tested with fakes. | Sufficient for authoritative Facebook post identity/provenance; platform-specific ID must remain opaque. |
| Idempotency | `linkedin-publishing.idempotencyKey`; unique `(owner_account_id,idempotency_key)` and unique job external post | App-owned key binds owner, destination, Board, node, approval fingerprint and action version. Provider has no assumed idempotency. | Reuse pattern with a Facebook action-version namespace. Never retry an ambiguous attempt merely because a provider lacks idempotency. |
| Finalization recovery | `jobResult`, `publishedResult` | Repairs a missing external-post row only from a durable accepted provider identity, then marks attempt/job reconciled/delivered. | Reuse with provider-specific external-ID validation. |
| Error model | `errors.js`, `classifyProviderStatus`, route diagnostics | Safe categories for credential, permission, rate limit, provider failure and unknown outcome; bounded IDs, no raw bodies. | Reuse and extend provider-specific classifications; retain raw provider payload only if separately redacted and justified (not MVP). |
| UI | `content-workspace.js`; `openPublishDialog`, `poll`; `app.js` fetch functions | Accessible confirmation, warning, status live region, external link and bounded polling. LinkedIn/personal text is hard-coded; English/German strings exist. | Reuse interaction pattern, replace provider/destination copy and never imply success before confirmed finalization. |
| Internal planning | `content-workspace.js`; planning schedule/calendar | Nodes can carry local date/time/timezone and appear in internal calendar. It does not enqueue provider delivery. | Reuse as CSV source; label it planned, never published/scheduled-at-provider. |
| RLS | BW-33.5/33.5.1 migrations and checks | Denies Supabase API roles access to protected server tables, including all social tables/destinations. | Preserve exactly; any new metrics table joins the server-only deny inventory. |

### 3.1 Performance and comment inventory

| Data/capability | Present? | Evidence and readiness |
|---|---|---|
| External post ID, URL, publication time | Yes | `social_external_posts.external_post_id`, `external_url`, `published_at`; written only after accepted LinkedIn response. Reusable. |
| Association to approved content | Yes | Publish job snapshot + Board ID + node ID + approved fingerprint + published snapshot digest. Reusable. |
| Brand association | Indirect only | Board carries `brand_id`; no Brand snapshot/FK on an external post. Resolve through authorized Board. Adequate now if Board retention remains authoritative. |
| Campaign association | Partial | Campaign context exists inside Canvas/Board data, but there is no normalized campaign entity/reference on social records. A stable campaign identifier must be copied into the immutable publication snapshot when one exists. |
| Likes/reactions, comments, shares/reposts, impressions, reach, clicks, video metrics, saves, engagement rate | No production implementation | No fields, provider calls, snapshots, or UI totals. Placeholder explanatory UI copy is not analytics. `last_synchronized_at` alone stores no metric. |
| Metric snapshots/history | No | Requires a new server-only table later. Not required for a single latest-total MVP if a bounded JSON latest-metrics record is deliberately added, but a table is cleaner and needed for provenance/history. |
| Metric synchronization/polling worker | No | Job status polling only reads Tendra One state; it does not call provider metrics. No scheduler/queue/cron exists. |
| Social webhooks | No | No verification, subscription, event dedupe, raw event retention, or delivery handler. |
| Rate-limit handling | Partial | LinkedIn HTTP 429 maps to `provider_rate_limited`; no `Retry-After` persistence, quota budget, backoff worker, or metrics throttling exists. |
| Provider comment IDs/content/authors/moderation | No | Canvas Post-its and AI review “comments” are internal collaboration objects and must never be conflated with provider comments. |

## 4. Platform comparison

### 4.1 Weighted decision

Scores are 1 (poor/high risk) to 5 (best/low risk), multiplied by weight. Access and pricing are conditional on the actual developer account/dashboard; a score does not grant access.

| Criterion | Weight | Facebook Page | Instagram Professional | X brand account | LinkedIn Organization |
|---|---:|---:|---:|---:|---:|
| Realistic access for Tendra One now | 15 | 5 | 4 | 3 | 2 |
| Company-account publishing | 10 | 5 | 5 | 5 | 5 |
| Existing-repository implementation effort | 10 | 4 | 2 | 4 | 3 |
| Permission/review risk | 10 | 3 | 3 | 4 | 1 |
| Media formats | 7 | 5 | 5 | 4 | 5 |
| Metric availability | 10 | 5 | 5 | 3 | 4 |
| Comment availability | 5 | 5 | 5 | 3 | 4 |
| Token stability | 7 | 4 | 4 | 4 | 3 |
| Pricing predictability | 7 | 5 | 5 | 1 | 5 |
| Future customer accounts | 7 | 4 | 4 | 4 | 2 |
| Publishing-safety compatibility | 7 | 5 | 4 | 4 | 4 |
| Time to first real company post | 5 | 5 | 3 | 4 | 2 |
| **Weighted total / 500** | **100** | **458** | **398** | **363** | **303** |
| **Classification** |  | **GO — first connector** | **CONDITIONAL GO** | **DEFER** | **NO-GO under current prerequisites** |

### 4.2 Access, publishing, metrics, and operational facts

#### Facebook Page — GO, first connector

* **Access:** Meta developer account; a Business-type app; Facebook Login; a real Page; a Facebook user with Page task/full-control authority; Graph API OAuth. Minimum discovery/publish/read scopes for the proposed flow are `pages_show_list`, `pages_manage_posts`, and `pages_read_engagement`; request `read_insights` only for Page/post insights. The Page access token and the `/me/accounts` tasks/scopes response are authoritative. Development mode is for app-role/test assets, not arbitrary customers. Advanced Access/App Review is required before serving people without app roles; Meta may require business verification and data-use review.
* **Publishing:** Page feed supports immediate Page-authored text/link posts; Page photo/video endpoints support media later. Graph returns an object ID which must be treated as opaque (commonly a Page/post composite) and can be used to construct/read a permalink only from a documented returned field—do not guess. Multi-image publishing needs a separate unpublished-photo/attachment flow and is deferred. No provider-native scheduling is required; Tendra One must own scheduling later. Editing/deleting is intentionally out of scope even where API endpoints exist. Graph API does not provide an app-level idempotency contract that can replace Tendra One's key.
* **Metrics:** For an authorized Page post, object summaries can provide reactions/likes, comments and shares when requested with the required Page read permission. Page post insights can provide only the currently documented metrics accepted for that post type, commonly impression/reach/click/engagement families, with `read_insights`; values may be delayed/aggregated and may change by API version. Polling is appropriate for MVP. Audience/Page follower metrics are separate Page insights and later scope. Video views require video objects/metrics and are later. Saves are not a Facebook Page-post MVP metric.
* **Comments:** summary count is in scope; comment content, IDs, author identity, replies, hiding/deleting and Feed webhooks exist only with the relevant Page permissions/subscriptions and Page tasks. They are out of scope because they add personal data, retention/deletion, moderation, webhook verification, and customer-review obligations.
* **Risks:** Page/user role changes, token expiry/invalidations, password/security changes, revoked permissions, app mode/review, annual Data Use Checkup, business verification, Graph version retirement, per-app/Page/user rate limits and usage headers, Page publishing limits, webhook signature verification, and Meta Platform Terms/user-data deletion requirements can stop service. Persist granted scopes, expiry/debug metadata that is safe, and last validation; never assume “long-lived” means permanent.

#### Instagram Professional — CONDITIONAL GO

* **Access:** A Business or Creator professional account is required. Under Instagram API with Facebook Login it must be linked to a Facebook Page and uses Meta app review/Advanced Access for customer users; permissions include `instagram_basic`, `instagram_content_publish`, `instagram_manage_insights`, and (only if comments are implemented) `instagram_manage_comments`, plus Page discovery/read permissions. Meta also documents Instagram Login variants whose permission names and availability differ; choose one official flow, never mix scopes. App-role-owned assets may be testable before public review, subject to dashboard eligibility.
* **Publishing:** Container creation then publish supports images, videos/Reels, and carousel albums within documented media/type/count constraints. It is not the shortest proof because media must be available at a provider-fetchable URL and container status must be polled before publication; text-only posts are not supported. Captions/links do not behave like a Page link post. Publishing limits apply and must be queried rather than guessed. Provider-native scheduling is not the MVP; Tendra One schedules invocation.
* **Metrics/comments:** Own professional media can expose documented media insights such as reach, views/plays where applicable, likes, comments, shares, saves and interactions; availability depends on media type, account type, dates and thresholds, and deprecated metric names must not be requested. Comment count/content and moderation/replies can be available with `instagram_manage_comments`; comment webhooks require subscriptions. Defer all comment ingestion.
* **Risks:** Page linkage under the Facebook Login flow, public media URL handling, container expiry/status, publishing quotas, permission review, metric deprecations/type-specific availability, token invalidation, webhooks, privacy/deletion obligations, and account conversion/removal. Strong second candidate after the Page connector proves Meta OAuth and review.

#### X company/brand account — DEFER

* **Access:** X has no distinct “company Page”; Tendra One would connect the company-owned X user. Use an X developer project/app and OAuth 2.0 Authorization Code with PKCE/user context; request least privilege (`tweet.read`, `tweet.write`, `users.read`, `offline.access` only if refresh is needed). Elevated access is a product/tier/account entitlement, not solvable in code. Customer accounts use the same user-consent flow but remain bound to X developer terms and the purchased tier.
* **Publishing:** `POST /2/tweets` supports text and references/options; media requires the documented upload flow and media IDs. Polls and replies exist; edits are not a general correction mechanism, so correction is another post or authorized deletion. Returned post ID/text are authoritative. Tendra One still owns idempotency and scheduling.
* **Metrics/comments:** Public metrics can include like, reply, repost/retweet, quote and possibly impression counts as documented for the requesting access level. Non-public/organic metrics such as URL/profile clicks and some impressions require that the authenticated user own the post and require user context; metric availability and retention window vary. Replies are posts found through conversation/search; reliable ingestion, authors, reply actions and streaming/webhooks depend on paid products/access. Treat comment moderation as unsupported. Reach and saves are not dependable X post metrics.
* **Risks:** API plan pricing/credits and rapidly changing product limits dominate. OAuth access tokens are short-lived unless refresh is requested; refresh rotation must be atomic. Endpoint limits, monthly read/post caps, search window, policy-mandated deletion/compliance handling and plan changes can stop the connector. Defer until Felix confirms a paid tier that covers write plus owned-post reads at acceptable cost.

#### LinkedIn Organization/Company Page — NO-GO under current prerequisites

* **Access:** The existing self-service products/scopes are personal: OIDC and `w_member_social`. Organization posting requires LinkedIn Community Management API access, an approved developer application/Page association, the authenticated member's qualifying organization administrator role, and organization scopes such as `w_organization_social`; organization lookup/administration and analytics require the exact approved `r_organization_*` permissions. Development versus Standard tier, app/Page verification, review and partner/product approval are external gates. The repository and environment prove none of them.
* **Publishing:** Current LinkedIn Marketing Posts API supports organization text and media/article/multi-image/document/video types according to product access and versioned headers. The repository instead calls legacy `/v2/ugcPosts`, authors a `urn:li:person`, permits only `destination_type='personal'`, and intentionally disables personal publishing by default. Organization posts return a share/post URN; provider identity must be persisted before success. Scheduling and drafts are not assumed; deletion/correction are excluded.
* **Metrics/comments:** With approved organization social permissions, organization share statistics can expose time-bound/aggregate organizational impressions, unique impressions/reach-like counts, clicks, likes, comments, shares and engagement; exact query pivots, permissions and retention are product-tier dependent. Social Actions can read comment/like summaries and, with write permission, manage organization interactions. Webhooks require approved event-subscription access. None is available through `w_member_social` alone.
* **Risks:** Community Management review, organization/Page verification and admin role are hard gates; versioned Marketing API headers/monthly versions, token expiry (commonly reported by the token response; refresh tokens are restricted), daily application/member limits, permission revocation, compliance audits and organization role changes can stop it. Do not revive the personal connector as a substitute.

## 5. Official source links and retrieval dates

Only first-party documentation informed platform access conclusions. All links below were selected/retrieved for this audit on **2026-09-14**; provider dashboards and the API-version selector remain authoritative at implementation time. Where an official page is dynamic or login-gated, Felix must capture the dashboard evidence listed in section 18. No blog/tutorial is evidence.

### Meta / Facebook / Instagram

* [Facebook Pages API overview](https://developers.facebook.com/docs/pages-api/) and [Get started](https://developers.facebook.com/docs/pages-api/getting-started/) — Page tokens, tasks and Page discovery.
* [Page posts](https://developers.facebook.com/docs/pages-api/posts/) and [Page feed reference](https://developers.facebook.com/docs/graph-api/reference/page/feed/) — create/read Page posts and required permissions.
* [Graph API permissions reference](https://developers.facebook.com/docs/permissions/) — `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `read_insights`, Instagram permissions and review status.
* [Page insights](https://developers.facebook.com/docs/graph-api/reference/v24.0/insights) and [Page Insights API](https://developers.facebook.com/docs/platforminsights/page/) — eligible metrics, periods and Page insight access. **Implementation must use the then-current stable version, not blindly pin `v24.0`.**
* [Graph API rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting/) — usage headers and limit categories.
* [App Review](https://developers.facebook.com/docs/app-review/) and [Development and Live modes](https://developers.facebook.com/docs/development/build-and-test/app-modes/) — app-role testing versus public use.
* [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/) and [Page Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-pages/) — verification/subscription boundary; not MVP.
* [User Data Deletion](https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback/) and [Platform Terms](https://developers.facebook.com/terms/) — deletion/compliance obligations.
* [Instagram API with Facebook Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/) and [Content Publishing](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/content-publishing/) — professional accounts, Page linkage, containers, media and limits.
* [Instagram Insights](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/insights/) and [Comment Moderation](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/comment-moderation/) — media insights/comments and permissions.

### X

* [Create Post](https://docs.x.com/x-api/posts/create-a-post) and [Post lookup](https://docs.x.com/x-api/posts/get-post-by-id) — create response and post/public/non-public fields.
* [OAuth 2.0 Authorization Code with PKCE](https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code) — user-context scopes, token lifetime and refresh.
* [Post metrics](https://docs.x.com/x-api/posts/post-metrics-by-post-id) — public/non-public/organic metric conditions.
* [Rate limits](https://docs.x.com/x-api/fundamentals/rate-limits) and [X API access](https://developer.x.com/en/products/x-api) — endpoint limits and current plan/pricing source. The dashboard quote is authoritative because pricing may be account/region specific.
* [Developer Agreement and Policy](https://developer.x.com/en/developer-terms/agreement-and-policy) — storage, deletion and compliance.

### LinkedIn

* [Community Management API overview/access](https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management?view=li-lms-2026-07) — product tiers, review and organization capability.
* [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2026-07) — organization authoring and post formats.
* [Organization access control by role](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-access-control-by-role?view=li-lms-2026-07) — organization authorization checks.
* [Organization Share Statistics](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/share-statistics?view=li-lms-2026-07) and [Social Actions](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/social-actions-api?view=li-lms-2026-07) — metrics and comment/like access.
* [Authorization Code Flow](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow), [Programmatic refresh tokens](https://learn.microsoft.com/en-us/linkedin/shared/authentication/programmatic-refresh-tokens), [API versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning), and [rate limits](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits) — OAuth and operations.

## 6. First-platform recommendation

### Selected connector: Facebook Page

It wins because the smallest useful post can be text/link, Meta permits controlled app-role testing of owned assets before broad customer review when the dashboard grants access, Page identity maps cleanly to the existing destination model, and Page-owned post summaries/insights offer the best same-milestone feedback. It avoids Instagram's public-media/container prerequisite, X's pricing uncertainty, and LinkedIn Organization's Community Management approval gate.

The required account is **Tendra One's real Facebook Page**, controlled by a named employee's Facebook account with sufficient Page task/full-control access. It is not a personal-profile destination. The exact app is one Meta Business app owned by Tendra One's verified Business Portfolio where required, with Facebook Login and an exact production HTTPS callback.

Required first-proof scopes are:

* `pages_show_list` — discover Pages the authorizing user can access;
* `pages_manage_posts` — create the Page post;
* `pages_read_engagement` — read Page/post content and engagement summaries;
* `read_insights` — only if the first milestone includes insight metrics.

For the internal post, full customer App Review is generally not required when the authorizing user has an app role and controls the Page, **but the dashboard's actual Standard/Advanced Access, app-mode and business-verification status must be confirmed first**. Customer accounts cannot be supported immediately: they require Live mode, approved Advanced Access for every relevant permission, business verification/data handling declarations as demanded by Meta, privacy policy and user-data deletion mechanism, and production review evidence.

The smallest proof is: connect the Tendra One Page; select one saved, approved `Social Media Posting` node whose platform is Facebook; revalidate it server-side; publish one text-only or text-plus-link Page post; persist the returned opaque post ID, provider-returned permalink if available, Page destination, job/attempt, approved fingerprint and snapshot; then read it back through the app. Do not use an image in the proof.

In the same milestone, a manual refresh may retrieve reaction/like total, comment count, share count, and supported post insights (impressions, reach, clicks/engagement) actually returned for that post. `unsupported`, `permission_denied`, `not_applicable`, and `temporarily_unavailable` are states, not numeric zero. Defer image/video/carousel, provider deletion/editing, native drafts, scheduling workers, webhooks, comment bodies/authors/actions, follower analytics, historical charts, recommendations, and customer onboarding.

## 7. Required external prerequisites

The code phase is blocked until all **P0** items are evidenced without copying secrets into tickets or this repository.

| Priority | External prerequisite | Acceptance evidence (secret-free) |
|---|---|---|
| P0 | Tendra One Facebook Page and responsible employee with full control/required Page task | Page ID/label and role confirmation; no token screenshot. |
| P0 | Tendra One-owned Meta Business app with Facebook Login | App ID may be recorded; secret must not. App type/product screenshots may redact identifiers. |
| P0 | Exact HTTPS callback registered | Exact non-secret callback string matches the future route byte-for-byte. |
| P0 | Development-mode internal-test eligibility | Test user is an app role and controls Page; dashboard shows requested features available for that test. |
| P0 | Permission gate | Dashboard/test consent proves `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`; add `read_insights` only if granted. |
| P0 | Current Graph version and Page-post endpoint/field confirmation | Record selected stable version, create endpoint, returned ID/permalink field and supported metric names from Graph API Explorer using non-production test content; do not paste tokens. |
| P0 | Privacy/data handling owner | Named owner approves privacy policy, deletion/disconnect behavior and retention before any comment data (comments remain deferred). |
| P1 customer | Business verification, Live mode and App Review/Advanced Access | Required before non-role customer users; approval status captured without credentials. |
| P1 operations | Current rate-limit/quota and pricing confirmation | Dashboard quota/usage evidence; Meta API access has no assumed fee, but business/review costs are not guaranteed. |

## 8. Minimal publishing architecture

### 8.1 Lifecycle

1. **Start:** signed-in user invokes a new Facebook connection endpoint. Server derives owner from the signed session; no account ID from the body is trusted.
2. **State:** create `social_oauth_attempts(platform='facebook')` with random state hash, one-time expiry, session binding, fixed `/` return and bounded request IDs. Use PKCE if the selected official Meta web flow supports/requires it; store only a verifier reference or sealed verifier.
3. **Callback:** exact HTTPS server callback validates method, state, owner/session binding, provider, expiry and consumption under row lock before exchanging the code.
4. **Identity/ownership:** discover the authorizing user, enumerate `/me/accounts`, and retain only Pages for which the API returns the task/capability needed to create content. A Page label is not ownership proof; provider-returned tasks and granted scopes are.
5. **Destinations:** write one connected user identity and one or more Page destinations (`destination_type='page'`, external Page ID, capability set, authorization state). Never silently auto-select when multiple Pages exist.
6. **Credentials:** seal the necessary user/Page credential using the existing vault and AAD. Browser receives only destination ID/label/capabilities/health. Store actual expiry from provider/debug response; never invent it.
7. **Selection:** Content Workspace shows Publish only for a saved Facebook `Social Media Posting` node and selected active Page. Existing approval UX stays unchanged.
8. **Authoritative preflight:** reload Board and node; require Board edit authority and Brand access inherited through that Board; ensure current Board `brand_id` is the expected Brand; re-resolve connection/destination owner, Page capability, scope, token health, platform/format; compare submitted/stored/recalculated approval fingerprints and current material.
9. **Idempotent job:** Tendra One creates an app-owned key over versioned action + owner + Page destination + Board + node + approved fingerprint. Insert one immediate job/content snapshot under the existing uniqueness constraint.
10. **Attempt/request:** atomically claim queued job, write provider attempt 1, clear credential after use, call the versioned Page feed endpoint once. Never auto-repeat after timeout/connection loss unless a documented provider reconciliation proves no post exists.
11. **Finalization:** validate and persist the opaque returned post ID on the attempt before reporting success; transactionally create `social_external_posts` and mark job delivered. Store a provider-returned permalink when available; otherwise leave URL null until an authorized read returns it.
12. **Status:** owner-scoped job endpoint returns confirmed/failed/ambiguous status. UI live region says “Published” only for a confirmed external-post record.
13. **Metrics:** a separate owner-authorized POST “Refresh metrics” invokes the Facebook read adapter for that external post and writes only documented returned metrics with provider observation time and local sync time.
14. **Association:** metric row references `social_external_posts.id`; that post already binds job, Page, owner, Board, node, fingerprint and snapshot. Campaign/funnel metadata comes from the immutable snapshot described below.
15. **Failure/retry:** definite pre-delivery/4xx failures may create a new numbered attempt under explicit policy; 401/403 marks connection/destination attention; 429 honors safe provider timing; ambiguous delivery remains reconciliation-required and must not republish.

### 8.2 Reuse, extension, and minimum persistence

* **Reuse unchanged:** signed-session resolution, `getBoardAccess`, approval service/material contract, OAuth state invariants, token vault, owner-scoped connected accounts/destinations, jobs, attempts, external posts, authoritative response envelope, ambiguity/finalization model, Content Workspace confirmation/poll UX, pg.Pool boundary and RLS deny posture.
* **Extend narrowly:** add Facebook config and adapter; parameterize connection/publishing services where hard-coded to LinkedIn/person; add Page discovery/task checks; validate Facebook text/link limits; add provider-version header/query; make UI destination/provider-neutral while leaving LinkedIn personal paused.
* **Existing table sufficiency:** `social_connected_accounts`, `social_publishing_destinations`, `social_publish_jobs`, `social_provider_attempts`, and `social_external_posts` are sufficient for connection, immediate publication, authoritative identity, and provenance. Their text fields already accommodate Page identities/capabilities. They are **not sufficient for storing metric values/history**; `last_synchronized_at` is only a timestamp.
* **Minimum new metrics table during implementation:** `social_post_metric_observations(id, external_post_id, owner_account_id, provider_observed_at nullable, synchronized_at, metric_schema_version, metrics_json, availability_json)`. Enforce one owner/FK path to external post, bounded JSON sizes and allowed metric keys; protect with the same Supabase API-role deny policy. For the first milestone retain only the latest observation by upsert if history is deliberately deferred. Never overload external-post columns with provider-specific counters.
* **Publication snapshot extension (not necessarily a column):** add stable `brandId` and `campaignReference` when authoritative, plus `funnelStage`, `personaOrIcpReference`, `channel`, `messageReference`, and `cta` values/references that already exist. Missing values are null. This is immutable provenance, not speculative simulation schema.
* **Idempotency ownership:** Tendra One owns key generation and uniqueness. Do not assert provider idempotency. The version namespace must change when delivery semantics materially change.
* **Scheduling ownership:** Tendra One eventually owns invocation time in UTC while preserving original local time/timezone. Existing columns model it but no worker exists, so scheduled provider publication stays disabled.
* **Sync ownership:** a server-only metrics service owns reads/writes. Start with user-triggered, rate-limited refresh (for example, reject repeated refresh inside a documented safe interval); later add narrowly bounded polling for recent posts. Webhooks are unnecessary for totals and deferred with comments.
* **Retention/deletion:** on disconnect cryptographically disable/delete active credentials and deactivate Page destinations while retaining already-published provenance/metrics under documented account policy. Board deletion currently conflicts with social `ON DELETE RESTRICT`; implementation must define a server-authoritative deletion workflow that cancels unpublished jobs and retains or tombstones delivered provenance without leaking Board content. User-data deletion must remove provider-derived personal data within policy; counts can be retained only if lawful and de-identified policy permits. Never cascade-delete proof of an ambiguous delivery before reconciliation.

### 8.3 UI, localization, accessibility, and Dark Mode

* Insert Facebook connection/destination state beside existing Social Connections settings; insert Page selection and publish confirmation in Content Workspace; show external identity/status/last refresh and supported totals on the published asset's Inspector/Content Workspace detail, not on unrelated Boards.
* All user-facing strings require English and German entries through the existing localization path. UI language controls labels/date formatting; asset/output language is the node's content language and must not be translated by connection, publishing, metrics, or export.
* Preserve keyboard activation, logical focus return, labelled modal/title, explicit destination/account, destructive-warning semantics, `aria-live` status, `aria-busy`, non-color status text, accessible metric definitions, and error recovery. A screen reader must hear “unavailable,” not “0.”
* Reuse design tokens and verify every added settings/dialog/table/control in light/dark themes, high contrast, 200% zoom and narrow layouts. Do not hard-code provider brand colors as the only state indicator.

## 9. Metric and comment availability

### 9.1 Exact first-connector contract

The adapter maps provider responses to the following canonical keys. Availability is stored independently from value. “Own” means a post authored by the selected authenticated Page.

| Canonical value | Facebook own Page post | Acquisition | MVP rule |
|---|---|---|---|
| `reactions_total` / `likes_total` | Available with Page read engagement when the post/summary exposes it; reactions may include types | Poll object/connection summary | Store returned total and optional documented type breakdown; do not derive likes from reactions unless provider semantics say so. |
| `comments_total` | Available when comment summary is authorized | Poll post fields | In scope; no bodies/authors. |
| `shares_total` | Available for shareable posts when returned | Poll post fields | In scope; absent/not applicable is null, not zero. |
| `impressions_total` | Available only through an eligible, currently documented post insight | Poll insights with `read_insights`; delayed/aggregated | In scope only after capability probe. |
| `reach_unique` | Available only through eligible unique/reach insight | Poll insights; delayed/aggregated | In scope only after capability probe; do not label impressions as reach. |
| `clicks_total` | Available only through eligible click insight | Poll insights; delayed/aggregated | In scope only after capability probe; preserve provider definition. |
| `engaged_users` / provider engagement | Eligible insight only | Poll insights | Store raw canonical total if documented; do not calculate an “engagement rate” without denominator/window definition. |
| `video_views` | Only for applicable video object/insight | Poll video/insights | Deferred because first proof is text/link. |
| `saves` | Not a selected Facebook Page-post KPI | — | Unsupported; never infer. |
| follower/audience values | Page-level, not post-level | Separate Page insights | Later analytics, never attach to one post as its performance. |

Each observation must record provider API/version, requested metric, availability (`available`, `unsupported`, `not_applicable`, `permission_denied`, `delayed`, `rate_limited`, `error`), integer value when returned, provider/end time when supplied, and synchronization time. Counters are non-negative but may decrease due to moderation/deletion/provider correction. Partial refresh must not erase a previously known value without marking why.

### 9.2 Cross-platform metric matrix

| Metric | Facebook Page | Instagram Professional | X own post | LinkedIn Organization |
|---|---|---|---|---|
| Likes/reactions | Own post, Page read permission; poll | Own media; poll insights/fields | Public metric; poll | Approved org social/statistics permission; poll |
| Comment count | Own post summary; poll | Media field/insight; poll | Reply metric; poll where accessible | Social actions/statistics; poll |
| Comment content/authors | Additional Page read/privacy boundary; webhook or poll; deferred | Manage-comments permission; webhook or poll; deferred | Replies/search access/tier; deferred | Approved social actions; deferred |
| Shares/reposts | Own post field/insight when applicable; poll | Media insight when documented/type supports it | Repost/quote public metrics; poll | Org share statistics; poll |
| Impressions | Eligible insight; delayed/aggregated | Eligible media insight; delayed | Public/organic availability depends on ownership/access | Org share statistics; approved access |
| Reach | Eligible unique/reach insight | Eligible reach insight | Not a dependable exposed post metric | Unique impressions where supplied; do not rename without definition |
| Clicks | Eligible post insight | Limited/type-specific interactions, not a universal outbound-click count | Non-public organic fields for own post/access window | Org share statistics clicks |
| Video views | Applicable video insight | Applicable media views/plays | Media metric/access dependent | Video analytics/product dependent |
| Saves | Not selected | Own eligible media insight | Unavailable/not dependable | Unavailable/not dependable |
| Engagement/rate | Provider totals/insight; preserve definition | Interactions/engagement per documented metric | Totals; calculate later only with defined denominator | Provider engagement rate/statistics where returned |
| Audience/followers | Page insight, later | Account insight, later | User public metric, later | Organization follower statistics, later |

### 9.3 Comments decision

The MVP retrieves **comment count only**. It will not retrieve provider comment IDs, content, authors/profile data, receive comment webhooks, reply, hide, moderate, or delete. Those features need a separate privacy impact assessment, purpose/retention policy, deletion propagation, role model (who may speak for the Page), moderation audit log, webhook verification/deduplication, and explicit App Review evidence. Internal Canvas Post-its remain entirely separate.

## 10. Posting-plan export design

### 10.1 Selection and authorization

One server-authorized read operation accepts a Board ID plus optional allow-listed filters: selected node IDs, inclusive date range with timezone, authoritative campaign reference, and platforms. An empty node selection means all exportable `Content` and `Social Media Posting` nodes in the Board. Whole-Board export still excludes non-content strategy/private system fields. The server calls `getBoardAccess` and requires `canRead`; export does not require edit or approval, but exposes approval state accurately. It resolves only nodes from that one authorized Board and rejects unknown/stale IDs rather than searching globally.

Private Boards work because output is generated only after normal signed-session authorization and returned `Cache-Control: private, no-store` with attachment disposition. No credential/token/provider payload, presigned/private asset URL, internal database URL, or unauthorized Brand/Board field enters the projection. An asset reference is a stable internal asset/node label or a safe filename—not a private fetch URL.

### 10.2 Canonical export record

Ordered fields (stable schema version `posting-plan-v1`):

1. `scheduled_date` (`YYYY-MM-DD` or empty)
2. `scheduled_time` (`HH:MM` or empty)
3. `timezone` (IANA ID or empty/`legacy_unspecified`; never silently UTC-shift legacy values)
4. `platform`
5. `destination_label` (display label only; empty when unconnected)
6. `campaign`
7. `board`
8. `funnel_stage`
9. `content_type`
10. `title`
11. `caption`
12. `cta`
13. `asset_reference`
14. `owner`
15. `approval_state`
16. `publishing_state` (`not_published`, `publishing`, `published`, `failed`, `outcome_unknown`; planned is separate and never promoted to published)
17. `internal_notes`
18. `source_node_reference` (stable `board:<board-uuid>/node:<node-id>`)
19. `asset_language` (BCP-47 when known; distinct from UI locale)

Deterministic ordering is scheduled instant/date (missing last), then platform's normalized code point order, then stable node ID. Normalize line endings to LF before RFC 4180 quoting; preserve Unicode and multiline fields; prefix UTF-8 BOM for spreadsheet compatibility. Empty/missing values serialize as empty quoted-safe cells, not fabricated defaults. CSV injection protection must prefix cells beginning after whitespace with `=`, `+`, `-`, or `@` (for example with an apostrophe), and this transformation must be documented because captions are untrusted spreadsheet input.

### 10.3 Format decision

| Format | Value | Cost/risk | Decision |
|---|---|---|---|
| CSV | Universal operations handoff; opens in Sheets/Excel; no dependency required | Styling absent; timezone semantics need explicit columns | **First release.** UTF-8 BOM + RFC 4180. |
| XLSX | Types, sheets, filters, styled plan | No current dependency; installation is forbidden in audit and adds spreadsheet-generation attack surface | Later only if users validate demand. |
| iCalendar (`.ics`) | Calendar import/reminders | Only scheduled rows; multiline/timezone/UID update semantics; can look like execution scheduling | Later, clearly labelled planning events. |
| Designed PDF | Client-ready review artifact | Layout, pagination, fonts, localization/accessibility; poor interchange | Later. |
| JSON | Lossless machine interchange | Little immediate marketer value; can expose excessive structure if projection is careless | Not first; add only for a named integration. |

**Representative invented row** (wrapped here for readability; actual CSV is one record):

```csv
scheduled_date,scheduled_time,timezone,platform,destination_label,campaign,board,funnel_stage,content_type,title,caption,cta,asset_reference,owner,approval_state,publishing_state,internal_notes,source_node_reference,asset_language
"2026-10-08","09:30","Europe/Berlin","facebook","Tendra One Demo Page","Autumn Launch","Example Campaign Board","Awareness","Social Media Posting","Meet the clearer campaign canvas","Plan together.\nPublish with confidence. 🌱","See the demo","asset:hero-concept-01","Alex Example","Approved","not_published","Use invented demo artwork only","board:11111111-1111-4111-8111-111111111111/node:social_demo_01","en-GB"
```

Generating this row performs no save, approval, job creation, provider call, or Board mutation. Export audit logging, if later required, must be a separate bounded security event and must not change content state.

## 11. Analytics and Brand Learning boundary

### First connector milestone

* Confirmed publication status, opaque external post identity/permalink when returned, publication time, destination, approved snapshot/fingerprint and safe provider error.
* Latest supported totals only: reactions/likes, comment count, shares, eligible impressions/reach/clicks/engagement, availability reason and `last_synchronized_at`.
* Manual refresh with authorization, rate-limit guard and partial-failure semantics; optionally narrowly bounded polling of recent confirmed posts only after quotas are known.
* No chart that implies a time series from a latest-total overwrite; no invented engagement rate.

### Later Social Analytics

* Append-only historical metric snapshots and provider observation windows; change-over-time charts.
* Campaign/platform/Funnel-stage comparisons with defined denominators and comparable windows.
* Follower/video/content-type metrics, webhook ingestion and provider quota orchestration.
* Comment content/authors, moderation, sentiment/topics, recommendations—only after permission/privacy review.

### Later Brand Learning

* Join confirmed performance provenance to existing authoritative ICP/persona, Archetype, message, CTA, format and Funnel-stage references.
* Generate a **proposal**, citing source external posts and immutable metric snapshot IDs; label correlation/uncertainty and never present raw totals as causal proof.
* Require a human action: **Add Learning**, **Discuss**, or **Ignore**. “Add” writes a versioned Brand Consciousness learning with actor/time/provenance; “Discuss” opens collaboration without mutation; “Ignore” records only workflow disposition.
* Never silently rewrite Brand Consciousness, canonical Brand Core, Canvas content, approval state, or strategy from metrics.

No analytics or Brand Learning behavior is implemented by this audit.

## 12. Funnel Simulation compatibility

No simulation fields or builder are proposed. The stable chain needed now is:

`metric observation -> external_post.id -> publish_job.id -> {owner, destination, board_id, node_id, approved_fingerprint, immutable content_snapshot}`.

The snapshot should include only stable references already authoritative at publish time: Board `brand_id`; Campaign ID/reference if the Board model supplies one (otherwise null plus bounded campaign label); Canvas node ID; existing `funnelStage`; existing persona/ICP ID/reference if present; normalized channel/platform; message/asset reference; and CTA. The approved fingerprint ties actual performance to the exact published material, even if the node later changes. Existing simulator path/asset references should remain separate and may later point to Board/node/fingerprint; no `simulated_path` column is needed today. This avoids destructive migration while not pretending mutable labels are identities.

## 13. Security and authorization boundaries

1. Browser identities, destination IDs, Board IDs and node IDs are claims; the server re-resolves and owner-scopes every one.
2. Connection ownership is the signed-session account; Page authority also requires fresh provider tasks/capabilities. Neither display name nor Page ID alone proves authority.
3. Board read authorizes export; Board edit plus qualifying Brand role authorizes approval/publishing. Publishing must also verify the Board's current `brand_id` and destination policy if company destinations later become Brand-shared rather than personal-to-user.
4. OAuth state remains random, hashed at rest, short-lived, single-use, row-locked, exact-provider, owner/session-bound and fixed-return. Callback errors contain no provider code/token.
5. Client secret, access/refresh/Page tokens and encryption keys remain server environment/vault data. No logs, diagnostics, URLs, client JSON, exports or analytics contain them.
6. AES-256-GCM AAD continues binding secret ID + owner + platform + key version. Rotation must be explicit and old secrets revoked only after atomic replacement.
7. Approval is server-authoritative v2 material. A publish repeats checks after confirmation; immutable snapshot/fingerprint, not mutable current node, defines what was sent.
8. Provider success requires a validated/durable external identity and committed external-post row. HTTP 2xx alone is insufficient. Ambiguity blocks duplicate requests.
9. New metrics storage is server-only and owner/FK constrained; reads additionally authorize the source Board. Provider-reported absence never becomes zero.
10. Export is a pure projection, `no-store`, spreadsheet-injection-safe, and contains no private URLs or strategy fields outside its explicit schema.
11. All existing RLS denies remain; any new provider-data table gets equivalent denies before deployment.

## 14. Risk register

| Risk | Failure mode | Required control | Severity |
|---|---|---|---|
| Authentication | Forged/missing session invokes connection/export/publish/refresh | Existing signed Google verification; derive owner server-side; 401 before storage/provider work | Critical |
| OAuth state | CSRF, replay, login-session swap, open redirect | Hashed random state, TTL, row lock/consume, cookie-session binding, provider binding, exact `/` return, optional PKCE | Critical |
| Token secrecy | Token reaches log/browser/export or wrong owner decrypts | Existing GCM+Aad vault, bounded safe diagnostics, secret scanning, server-only routes, zero buffers best effort | Critical |
| Board/Brand isolation | User publishes/exports another Board/Brand | `getBoardAccess`; explicit canRead/canEdit; current Board-brand check; owner-scoped joins; negative tests | Critical |
| Approval integrity | Draft/unapproved material sent | Server reload/status + submitted/stored/recomputed v2 fingerprint; immutable snapshot | Critical |
| Duplicate publication | retry/double click/server timeout sends twice | Deterministic unique job, atomic claim, attempt-before-request, lock UI, reconcile identity, never replay ambiguity | Critical |
| Stale content | Node changes after approval/preflight | Repeat authoritative checks immediately before job/provider request; reject and require reapproval | Critical |
| Destination ownership | Guessing a Page UUID or stale Page task | owner-scoped destination/connection joins; provider Page task discovery; capability refresh; explicit selection | Critical |
| Retry behavior | 429/5xx/timeout treated identically | Classify definite rejection vs unknown outcome; bounded backoff only when safe; preserve attempt number/timing | High |
| Scheduled jobs | Dormant schema mistaken for working scheduler; revoked auth at due time | Keep UI/API disabled; future worker revalidates everything at execution; lease/locking/cancellation tests | High |
| Metric misattribution | Page/post/campaign/node totals joined incorrectly | External-post FK; opaque composite ID; owner+platform+destination checks; snapshot references; fixture collision tests | Critical |
| Rate limits | refresh storm exhausts quota | Manual cooldown, usage/Retry-After handling, per-connection budget, no unbounded polling/webhooks | High |
| Private exports | unauthorized/download-cache leak | normal Board read authorization, explicit projection, private/no-store, no URLs/tokens, CSV injection defense | Critical |
| Deleted Boards/nodes | FK blocks deletion or provenance becomes inaccessible/misleading | define cancellation+tombstone/retention flow before implementation; never silently orphan metrics | High |
| Disconnection | queued/new publish still uses token | transactionally revoke/deactivate; pre-request recheck; cancel unpublished jobs; retain provenance | Critical |
| Permission revocation | provider 401/403 loops or UI still says connected | mark connection `needs_attention`/destination unauthorized, stop refresh/publish, require reconnect | High |
| App boot | provider config/schema issue breaks entire SPA | lazy server-only provider initialization; connection unavailable projection; boot regression without env/DB | High |
| Inspector/Canvas | new metrics/publish rendering mutates node/layout/focus | read-only projections, targeted rerender, visual/keyboard regressions | Medium |
| Collaboration/autosave | export/metrics triggers dirty state or overwrites concurrent edit | no mutation dispatch; server reload for publish; dirty-state/autosave/collaboration counters unchanged | High |
| RLS | new table exposed through Supabase API | deny anon/authenticated/service-role policy boundary consistent with existing architecture; catalog verification | Critical |
| Existing Social Connector | refactor accidentally enables personal LinkedIn or changes callbacks | preserve routes/flags/personal destination blocks; full BW-32 suite; explicit no-company-via-person regression | Critical |
| Platform review/version/pricing | approval denied, version retires, tier changes | external prerequisite gate, version inventory, capability flags, kill switch and export fallback | High |
| Comments/privacy | bodies/authors stored without basis/deletion | count only in MVP; separate DPIA/review/schema before ingestion | Critical |

## 15. Required regressions

### 15.1 Automated, secret-free

* Run all existing BW-32.1, BW-32.2.x, BW-32.3.x, BW-33.5 and BW-33.5.1 scripts with fake pools/fetches; ensure zero live URLs/credentials and personal LinkedIn remains paused.
* Connection routes: method/body bounds, unauthenticated rejection, state hash/no raw state, TTL/replay/session/provider/owner mismatch, exact redirect, callback consume-before-exchange, multiple Page selection, insufficient Page task, partial write rollback/recovery, token replacement/revocation and safe diagnostics.
* Publishing: unauthorized Board/Brand/viewer, guessed destination, disconnected/revoked/expired token, missing scopes/capability, wrong platform/type, unsaved/missing/deleted node, draft/In Review, legacy/missing/mismatched fingerprint, content changed after preflight, link/text limits, double-submit, unique conflict, crash before/after request, accepted ID not durable, finalization recovery, provider 400/401/403/429/5xx/timeout and no ambiguous replay.
* Metrics: owner/Board isolation; external-post/destination/platform mismatch; allowed-key/type/size validation; absent versus zero; partial response; decrease; delayed window; 401/403 health transition; 429 cooldown; deleted/unavailable post; concurrent refresh dedupe; no comment body/author persistence.
* Export: Board owner/editor/viewer read policy as intended and unrelated-user denial; private Board; whole/selected/date/Campaign/platform filters; unknown/deleted IDs; deterministic order/bytes; BOM; Unicode/emoji/newlines/quotes/commas; missing timezone/fields; UI versus asset language; formula injection; no secret/private URL; no Board/job/approval/publish/autosave mutation.
* UI/browser integrity: focus trap/return, keyboard-only destination and confirmation, live status, disabled double-submit, ambiguous wording, unavailable metric labels, external `noopener noreferrer`, responsive layout, English/German, light/dark/high contrast/zoom.
* Boot and RLS: missing provider env produces a bounded unavailable state, not boot failure; new server-only table is denied to Supabase API roles; pg.Pool/`POSTGRES_URL` remains the only social data path.

### 15.2 Real browser/provider verification (cannot be proven by Node mocks)

In a controlled non-production deployment and Tendra One-owned Meta app/Page: verify the real consent screen and granted scopes; Page list/tasks; correct Page selection; a single deliberately approved harmless test post; returned ID and permalink/read-back; visible Page post; real reaction/comment/share summaries and each accepted insight; token expiry/reauthorization; disconnect; revoked permission; 429 behavior if safely reproducible; and no second post after a lost client response. Capture post ID/time and sanitized screenshots, never tokens.

Use a second unrelated test user/Page/Board to prove isolation. Use browser accessibility tooling plus keyboard/screen reader and both themes. Provider sandbox/Explorer success proves only the provider prerequisite; fake-fetch success proves only code handling. Only a visibly present provider post plus stored matching external identity is a real-publication proof.

### 15.3 Audit-phase validation boundary

For this documentation-only phase, run only existing secret-free Node regression scripts, browser-script integrity, Markdown/diff checks, and changed-file confirmation. Do not run schema initialization tests against a real database or any live smoke script.

## 16. Phased implementation plan

### Phase 0 — immediate independent release: posting-plan CSV

1. Implement server-authorized pure Board projection and filters.
2. Generate deterministic UTF-8 BOM RFC 4180 CSV with formula-injection protection.
3. Add Content Workspace/Board export UI, localization, accessibility and Dark Mode checks.
4. Prove no content/approval/publishing/autosave mutation.

### Phase 1 — external gate and contract fixture

Felix completes section 18. Record sanitized Graph version, Page task/scopes, response shapes, metric names, quota headers and review status. Build redacted fixtures; if P0 fails, stop connector work and keep CSV as the release.

### Phase 2 — Facebook Page connection

Implement thin config/adapter and server routes using existing state/vault/account/destination tables. Discover multiple Pages and capabilities; add explicit selection/reconnect/disconnect. Do not touch personal LinkedIn behavior.

### Phase 3 — smallest real publish-now

Add Facebook text/link preflight and publish, using existing approval, jobs, attempts, idempotency, ambiguity and finalization. Complete automated coverage, then perform exactly one controlled Tendra One Page proof. No media/scheduling.

### Phase 4 — latest metrics

Add server-only observation persistence, manual rate-limited refresh and supported totals/availability UI. Validate every requested insight against official current API and the real Page. Comments remain count-only.

### Phase 5 — production/customer readiness

Complete App Review/Advanced Access, business verification if required, privacy/deletion endpoints, operational alerts/runbook, token lifecycle and quotas. Pilot one explicitly authorized customer only after approval. Later prioritize media formats; scheduling only after a durable worker/lease design.

### Later, separate milestones

Historical analytics, comparisons, webhooks, comment ingestion/moderation, sentiment, recommendations, Brand Learning proposals and Funnel Simulation links. Instagram is the second candidate after Meta foundations; reconsider X only with accepted pricing; reconsider LinkedIn Organization only after Community Management access is actually granted.

## 17. Explicit GO / NO-GO conclusions

| Decision | Conclusion |
|---|---|
| Posting-plan CSV | **GO now.** No platform prerequisite; implementation still requires normal review/authorization tests. |
| Facebook Page internal connector | **GO, first connector, conditional on P0 dashboard/account evidence.** |
| Facebook customer accounts | **NO-GO until Live mode + required Advanced Access/App Review/business and data-handling prerequisites.** |
| Instagram Professional | **CONDITIONAL GO later**, not simultaneous; Page/account/media-hosting/container and permission gates make it slower. |
| X brand account | **DEFER** until current paid access, owned-post metrics and cost limits are accepted. |
| LinkedIn Organization | **NO-GO under current prerequisites** until Community Management/API tier, organization verification/admin roles and required organization scopes are granted. |
| LinkedIn personal profile | **NO-GO by product decision; remains paused.** |
| Scheduling, media, comments, analytics, Brand Learning | **NO-GO in first connector milestone.** |
| Claiming real publication from mocks | **NO-GO always.** |

## 18. Exact manual actions required from Felix

These are actions for the implementation phase, **not actions performed during this audit**.

1. Confirm or create the official Tendra One Facebook Page; record its non-secret label/ID and designate a responsible employee with the Page task/full control required to create content.
2. In Meta for Developers, create/select a Tendra One-owned **Business** app, connect it to the correct Business Portfolio if required, and add Facebook Login. Do not reuse an unowned/personal experimental app.
3. Add Felix/the controlled employee as an app Administrator/Developer/Tester and confirm that the same person has the required Page access. Use Development mode for the internal proof.
4. Register the exact future production HTTPS Facebook callback URL, with no wildcard, alternate host, fragment or open return target.
5. In the app dashboard, request/confirm availability for `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, and—only for insight metrics—`read_insights`. Record Standard/Advanced Access and review status for each, without copying tokens.
6. Select a current supported Graph API version. With Graph API Explorer or Meta's official test tool, using only the controlled Page, confirm: Page enumeration and returned tasks; Page feed create contract; returned post ID; authorized permalink read; reactions/comments/shares summaries; exact eligible insights and periods; usage/rate headers. Delete test artifacts only according to the approved test plan; do not do this during the audit.
7. Confirm whether internal Development-mode publication is permitted for this app-role user/Page. If it is not, stop and identify the exact review/business-verification gate—do not broaden scope or use a personal profile.
8. Provide app ID, app secret, exact callback, Graph version and a new social-vault key **only through approved server secret management** during implementation. Never send values in chat/issues, commit them, print them, or expose them to the browser. Arrange rotation ownership.
9. Publish/approve privacy policy and user-data deletion instructions/callback as required; name the compliance contact and set retention/deletion rules before Live mode. Complete Data Use Checkup/business verification/App Review when customer access is pursued.
10. Approve one harmless, final, text/link test asset in a private test Board and separately authorize the exact time/person for one real Page post. Verify it visibly on Facebook and match the stored external ID before declaring success.
11. Confirm operational budget/quotas and monitoring owner; define who responds to permission revocation, app review notices, Graph version migrations and ambiguous outcomes.

## 19. Open questions that repository and public documentation cannot resolve

1. Does Tendra One already own an eligible Facebook Page and Meta Business Portfolio, and which human account has the required Page tasks?
2. Does an existing Tendra One Meta app exist, what is its app type/mode/business-verification status, and which permissions/features does its dashboard actually grant? No secrets are needed to answer.
3. Will Meta permit Development-mode Page publication for the exact app-role/Page combination before review, or impose an account-specific verification gate?
4. Which current stable Graph version will be selected at implementation time, and which Page-post insights/periods does the controlled Page actually return for text/link posts?
5. Does Tendra One require `read_insights` in the first real-post milestone, or can reactions/comments/shares prove the first feedback loop while insight review proceeds?
6. What is the authoritative Campaign stable ID in current Board data? Campaign names/context appear mutable; implementation must identify an existing immutable ID or explicitly document a nullable reference.
7. Are company destinations owned per user, per Brand, or by a Tendra One workspace? Current social rows are user-owned; sharing a Page among Brand editors needs an explicit policy before customer rollout.
8. Who may publish for a Brand—every Board/Brand editor, or only a new publisher role? The existing boundary allows editors; product/legal must confirm least privilege.
9. What retention periods apply to tokens, OAuth attempts, immutable published snapshots, latest metrics and future historical observations, and how should account/Board/Brand deletion reconcile provider provenance with erasure requests?
10. How should Board deletion proceed given `ON DELETE RESTRICT` references from jobs/external posts? This must be resolved before implementation, not by weakening referential integrity.
11. What provider-visible permalink field is returned/readable for the chosen Page post type/version? Until verified, store URL as null rather than synthesize it.
12. What rate limits/usage headers and any Page publishing limits apply to Tendra One's app tier, and what operational polling interval fits them?
13. Are Page post reaction/comment/share summaries sufficient for the first metric UI if `read_insights` review is delayed?
14. Which timezone is authoritative for legacy internally planned nodes with no IANA timezone, and should they be excluded from date-range filtering or labelled `legacy_unspecified`?
15. Who approves the CSV formula-injection transformation and the set of exportable internal notes for private Boards?
16. When customer access is pursued, what countries, privacy regimes, subprocessors and data-deletion SLA apply?

---

**Audit conclusion:** implement the authorized CSV posting-plan export immediately; in parallel, let Felix clear the Meta P0 gate. Then implement exactly one Facebook Page text/link connector and manual latest-metric refresh behind the existing server-authoritative approval, ownership, encryption, job, attempt, idempotency and external-post boundaries. No application, database, credential, deployment, OAuth, provider account, or social-post state was changed by this audit.

`COMPANY SOCIAL PUBLISHING AUDIT READY FOR USER REVIEW`
