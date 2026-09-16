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
