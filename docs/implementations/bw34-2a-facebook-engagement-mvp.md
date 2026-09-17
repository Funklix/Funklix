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

## BW-34.2AR3 — OAuth 190 classification and hard request bound

### Proven cause and field-level adapter comparison

AR3 re-audited the three Meta paths rather than treating the stored expiry as proof that a credential is valid. Publishing and engagement both decrypt the owner-scoped `social_connected_accounts.token_secret_id` payload and call `resolveSelectedPageCredential(credentials, external_destination_id)`. Publishing passes the complete credential envelope to `facebook_page_text_link_publish_v1`, which selects the Page token and puts it in the form-encoded `access_token` field for `POST /{page-id}/feed`. Its successful permalink lookup then uses that same selected raw string in `Authorization: Bearer` for `GET /{post-id}?fields=permalink_url`. Engagement now selects the same Page-map property in the service and passes exactly `{ context, credential: { accessToken, tokenSource: "selected_page_token" }, input: { pageId, postId } }`; the adapter extracts `credential.accessToken` and uses the same Bearer-header transport as the proven permalink GET. Neither GET uses app-secret proof. All three use the same bounded fetch/parser, and provider errors are classified from HTTP status plus numeric Meta error code.

The audit found no remaining raw-string/object, `accessToken`/`pageAccessToken`/`access_token`, descriptor, undefined-property, encoding, query/header, or adapter-envelope mismatch in the deployed AR2 construction. AR3 nevertheless makes that contract executable: the engagement adapter accepts only the documented operation argument and selected credential keys, and requires a primitive, non-empty, 8–12000-character, already-trimmed token. Wrapped tokens, strings in place of the operation object, alternate property names, whitespace artifacts, missing values, arrays, and extra registry-envelope fields fail locally before fetch. Diagnostics report only bounded type/presence/contract/equality categories—never a value, fragment, hash, encoded value, Page/post identity, URL, content, destination, or raw response.

Given the production evidence—OAuth 190 after AR2 selected the same Page-token category and sent it through the permalink-proven Bearer transport—the exact remaining cause is a provider-rejected stored Page credential. A current database expiry is not a guarantee of provider validity. This is not repaired through token reformatting or automatic rotation: Felix must reconnect Facebook once after deployment.

### Reconnect-required behavior

Only an authoritative Meta OAuth 190 returned from the correctly constructed adapter request maps to `reconnect_required`. Missing permission, rate limiting, object absence, local malformed input, and temporary failure retain their distinct states. The finalized external publication, permalink, connection, and history are not deleted or altered. The engagement panel says “Facebook access needs to be renewed before engagement can be refreshed.” (German: “Der Facebook-Zugriff muss erneuert werden, bevor Interaktionen aktualisiert werden können.”) and replaces Refresh with an action opening Social Connections. Social Connections exposes the same renewal state and Reconnect action without disconnecting automatically.

### Remaining loop cause and hard bounded lifecycle

AR2 used several separately keyed collections: pending/automatic attempt used `boardId:nodeId`, while result/error state used only `nodeId`; it also cleared only the automatic-attempt set on unmount. This split allowed lifecycle cleanup, board transitions, and independently rendered presentations to disagree about whether the logical publication had already attempted a read. Its promise was installed only after constructing the provider callback promise, rather than reserving one unified state before scheduling asynchronous work.

AR3 uses the stable internal `boardId:nodeId` key everywhere and never includes the changing client request ID. It synchronously installs a reserved promise before scheduling the callback. Automatic render, rerender, reconciliation, and duplicate-card callers share the same maps and consume at most one automatic attempt per workspace lifecycle. Concurrent manual clicks share the reservation. A normal failure keeps the existing 60-second cooldown; OAuth 190 adds a terminal set, so automatic and manual calls return the cached renewal guidance without network access. One authoritative changed Facebook connection snapshot clears the bounded workspace maps and permits one new automatic attempt. A genuine account/board/lifecycle-generation change or unmount clears all engagement maps; ordinary theme/localization renders do not. There are no timers, polling loops, or recursive fetch chains, and keys cannot accumulate past the active workspace lifecycle.

### Changed files, deployment, acceptance, and rollback

Changed: `api/social-connector/facebook-adapter.js`, `facebook-engagement-service.js`, `facebook-engagement-diagnostics.js`, the Facebook engagement route and shared response projection, `content-workspace.js`, `app.js`, `facebook-connections-settings.js`, `package.json`, the AR3 focused regression, and this document. No schema, RLS, OAuth scope, Graph version, Meta setting, publication/finalization logic, provider record, LinkedIn/Instagram, scheduling, Canvas, or campaign-generation behavior changes.

Deployment requires the application code only, followed by one Felix Facebook reconnect because Meta has rejected the existing stored Page token. Acceptance is: malformed adapter inputs cause zero fetches; an invented correctly formed aggregate response succeeds; OAuth 190 alone produces renewal guidance; one node produces no additional automatic/manual provider calls after that terminal result; changed client request IDs, rerenders, reconciliation, duplicate listeners/cards, and concurrent clicks cannot bypass the bound; one authoritative connection change permits exactly one new automatic attempt; and the finalized publication/permalink remain intact. Rollback is limited to the AR3 adapter validation, OAuth-190 projection/diagnostics, renewal UI, lifecycle maps, regression, and this section. Rolling back does not modify stored credentials or publication data, but would restore unsafe retry behavior and ambiguous OAuth-190 presentation.
