# BW-34.2A — Facebook engagement MVP

## Investigation and existing authority

The finalized provider identity already lives server-side in `social_external_posts.external_post_id`. Facebook finalization associates it with `owner_account_id`, `source_board_id`, `source_node_id`, `destination_id`, a confirmed delivery state, and its publish job. No provider identity is accepted from or returned to the browser.

The read follows the existing signed-session actor (`getSessionUser`), `getBoardAccess` Board/Brand membership resolution, Canvas node membership, and the finalized external-post ownership tuple. It then joins the record to its owner-scoped connected Facebook account, selected Page destination, and encrypted token secret. The token vault decrypts the existing Page token only in server memory. This proves the stored `page_post` identity can be queried directly without browser exposure. Repository inspection found no provider-neutral metrics snapshot table; `last_synchronized_at` is metadata on the publication rather than an aggregate metrics model, so this MVP adds no migration or persistence.

## Meta request and permission

The adapter performs one read-only Graph API v24.0 `GET /{stored-page-post-id}` request with exactly:

`fields=reactions.limit(0).summary(true),comments.limit(0).summary(true),shares`

It uses the existing `pages_read_engagement` permission and encrypted Page access token. It does not request `read_insights`, change OAuth, or alter publishing. Aggregate summaries only are projected; data arrays, identities, comment bodies, paging, Page IDs, post IDs, tokens, external URLs, and raw responses never enter the response DTO.

## Availability semantics and DTO

Each metric is `{ "state": "available", "value": <non-negative integer> }` or `{ "state": "unavailable" }`. An authoritative zero remains available. An omitted/malformed field is unavailable, never zero. Request-level failures use a sanitized status (`credential_invalid`, `insufficient_permission`, `provider_rate_limited`, `provider_temporarily_unavailable`, `publication_unavailable`, or access denial); the UI treats these as temporarily unavailable and preserves any valid in-memory result.

Successful DTO fields are `ok`, `status`, `client_request_id`, `server_request_id`, `metrics`, and `refreshed_at`. Its diagnostic contains only request correlation, stable stage code, bounded HTTP status, metric-presence categories, and provider HTTP status.

## UI and cache

Only a reconciled, finalized Facebook card renders the compact row below “Published to Facebook”; the existing permalink remains unchanged. Reactions and comments display when authoritative; Shares displays only when available. Loading is asynchronous and does not block workspace rendering. First card rendering triggers one request, results remain in browser memory for 60 seconds, concurrent requests per node share one promise, and manual Refresh makes one fresh request. There is no polling and failures do not clear prior values. English and German states/copy are included.

## Privacy, limitations, and BW-34.2B

This is a live aggregate view. There is no database mutation, snapshot history, chart, scheduled synchronization, body/user/demographic data, reach, impressions, clicks, webhook, or Brand Learning. BW-34.2B should insert a provider-neutral metrics persistence/collection layer behind the engagement service and consume its allowlisted aggregate projection without widening this endpoint.

## Changed files and deployment

Changed: the Facebook adapter, engagement service and GET route, shared authoritative response projection, Content Workspace and app request wiring, styles, focused regression/package command, and this document. Deployment needs no migration, new variable, permission, OAuth reconnect, or Meta configuration change; existing production Graph v24.0 configuration and vault key remain required.

## Acceptance and rollback

Acceptance is the already-published card retaining “Published to Facebook” and “Open on Facebook,” then showing authoritative reactions/comments and optional shares; Refresh produces one bounded GET and no publication mutation or provider identity disclosure. Rollback is limited to the engagement route/service/adapter capability and workspace panel/wiring/styles; publication and stored records remain untouched.

## BW-34.2AR1 — provider-neutral adapter compatibility repair

Clean-checkout Runtime Boot Safety exposed the failure at `npm run check:bw32.2`: `defaultRegistry()` rejected the Facebook adapter with `Invalid social connector adapter`, causing the LinkedIn connection check to stop during registry initialization. BW-34.2A had added `facebook_post_engagement_read_v1` as both a Facebook capability declaration and method, but the registry's exact allowed-operation predicate did not recognize either key. The LinkedIn adapter itself was not defective.

The repair preserves `OPERATIONS` as the established provider-neutral base interface and introduces a narrow recognized optional-operation list for the Facebook engagement extension. Existing LinkedIn adapters, inert/historical fixtures, and future adapters implementing only the base contract therefore register unchanged. No fake Facebook method was added to LinkedIn. `defaultRegistry()` can register both production adapters again.

The Facebook engagement service now validates the extension at its own boundary before authorization, storage, credential, or provider access. A missing declaration and method yields bounded `engagement_capability_unsupported`; a declaration/method mismatch yields bounded `engagement_capability_invalid`. Only a coherently declared and implemented Facebook engagement adapter can proceed to the existing authorized read path.

Clean-checkout proof uses a temporary archive containing tracked files only and runs BW-32.2 plus BW-34.2AR1 without access to the working tree or its untracked `node_modules/`. The focused repair check additionally proves missing/malformed capabilities cause zero database and network calls. Meta configuration, Graph version, OAuth, publication, schema, UI, and LinkedIn behavior are unchanged.

## BW-34.2AR2 — authentication and request-lifecycle repair

### Exact 401 cause and credential comparison

The historical engagement path decrypted the complete OAuth credential envelope and passed that envelope to the engagement adapter. Token selection then happened a second time inside that adapter from `credentials.pageTokens[input.pageId]`. This was an authentication-boundary mismatch: the engagement operation accepted both the user token and every Page token even though it needed exactly one authoritative Page credential. It also provided no trustworthy diagnostic of which credential category reached Graph. The production 401 was therefore surfaced only as `credential_invalid`, making the selected Page credential indistinguishable from user-token, missing-map, and stale-envelope failures.

Publishing and its post-publication permalink GET derive the Page identity from `social_publishing_destinations.external_destination_id`, decrypt the connected account's owner-scoped secret, and use the Page-token map entry keyed by that external Page identity. AR2 extracts that proven lookup into `resolveSelectedPageCredential`. Both publishing and engagement now invoke it. Engagement passes only `{ accessToken, tokenSource: "selected_page_token" }` to its adapter; the user token, remaining Page-token map, internal destination UUID, Page label, and provider identities cannot become adapter authentication inputs or response fields. An absent lookup fails locally and makes no Meta request. This is backward-compatible with the existing encrypted envelope and requires no reconnect.

### Graph request and safe failure diagnostics

The repaired request remains one Graph API v24.0 `GET /{encoded page_post identity}` with the exact fields `reactions.limit(0).summary(true),comments.limit(0).summary(true),shares`, `Accept: application/json`, and the established `Authorization: Bearer <selected Page token>` convention used by permalink retrieval. It adds neither query-string credentials nor app-secret proof and does not double-encode or substitute the internal destination UUID.

Failures are bounded as authentication/token rejection, missing permission, expired/revoked credential, rate limit, unavailable provider object, temporary provider failure, or internal failure. One sanitized server event contains only correlation ID, stable stage/code, bounded provider status, token-source category, permission-presence boolean, credential-expiry category, and a validated numeric OAuth category. It excludes tokens, Page/post IDs, content, URLs, and raw Meta responses. A Meta 401 is stable and is never automatically retried.

### Request-loop cause and bounded lifecycle

The exact loop was `bind()` calling `loadFacebookEngagement()` after every render. A failed request had neither `refreshedAt` nor an attempted/cooldown marker; its completion called `rerender()`, which called `bind()` again and immediately started another request. Publication reconciliation and unrelated renders entered the same path.

AR2 stores automatic-attempt, result/error, cooldown, and pending-promise state in module-level maps outside card DOM construction. Each board/node receives at most one automatic attempt during a mounted Content Workspace lifecycle. Success is cached for 60 seconds, failure records a 60-second cooldown, and rerenders/reconciliation events cannot erase either state. Concurrent automatic/manual calls share the pending request. Manual Refresh bypasses completed cache/cooldown once, but repeated clicks while pending deduplicate. There is no interval or recursive retry; unmount begins the next workspace lifecycle.

### Changed files, deployment, acceptance, and rollback

Changed files are the shared Page-credential resolver, Facebook adapter, publishing service credential narrowing, engagement service and route diagnostics, Content Workspace request lifecycle, focused AR2 regression/package command, the adjusted BW-34.2A fixture, and this document. Deployment requires no schema migration, environment variable, OAuth scope, Meta setting, reconnect, or new post. Graph v24.0, the current vault key, and the existing selected Page destination remain required.

Acceptance after one Content Workspace reload is one browser engagement request and one Meta GET, authoritative Reactions and Comments, Shares only when returned, no rerender request multiplication, and exactly one additional request for manual Refresh. Publishing, permalink retrieval, publication finalization, duplicate-delivery protection, and LinkedIn remain unchanged. Rollback is limited to the AR2 resolver/narrowing, engagement diagnostics, client lifecycle, regression, and this documentation; no stored data needs reversal.
