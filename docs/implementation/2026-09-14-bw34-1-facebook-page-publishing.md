# BW-34.1 — Facebook Page connection and approved publishing

**Implementation date:** 2026-09-14
**External actions:** none. Validation uses invented deterministic fixtures and never contacts Meta.

## Repository investigation and reused architecture

The implementation follows the BW-34.0 audit and reuses the signed Google session boundary, hashed and session-bound one-use `social_oauth_attempts`, AES-256-GCM token vault, normalized connected-account and publishing-destination tables, server-side Board/Brand authorization through `getBoardAccess`, approval-material v2 fingerprints, deterministic publish jobs, provider attempts, external-post finalization, ambiguous-outcome stop, and owner-scoped job status. LinkedIn remains registered and unchanged in capability and is not reactivated.

The provider-neutral existing tables support Facebook user connections, Page destinations, jobs, attempts, and posts. **No database migration is required or included.** The applied BW-33.5/BW-33.5.1 RLS posture is unchanged.

## Files and provider boundary

The additive server implementation is in `api/social-connector/facebook-config.js`, `facebook-adapter.js`, `facebook-service.js`, `facebook-publishing.js`, and `facebook-publishing-service.js`. Thin authenticated routes cover start, callback, disconnect, preflight, and publish. The existing connection projection now returns a safe Facebook projection and all eligible Page destinations; access tokens never enter it. The existing Social Connections card and Content Workspace are extended rather than duplicated.

## OAuth flow

1. `POST /api/social-connections-facebook-start` requires the application session, creates random state, and stores only its hash with owner, cookie-session fingerprint, request metadata, and five-minute expiry.
2. Authorization requests exactly `pages_show_list`, `pages_manage_posts`, and `pages_read_engagement`.
3. The exact callback is derived as `${APP_ORIGIN}/api/social-connections-facebook-callback`; `APP_ORIGIN` must be an HTTPS origin without credentials, query, or fragment.
4. The callback requires the same application session and transactionally locks and consumes state once before code exchange. Denial, stale/reused/substituted state, expired or missing code, provider failure, missing Pages, and storage failure produce bounded outcomes only.
5. The server exchanges the code using `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`, retrieves `/me?fields=id,name`, then `/me/accounts?fields=id,name,tasks,access_token` in user context.
6. Only Pages whose returned tasks contain `CREATE_CONTENT` and that include a Page access token become active `page` destinations. Multiple Pages remain separate and require selection in the UI.
7. The user and Page tokens are sealed together at the existing credential boundary; only Page IDs, labels, capabilities, and destination UUIDs reach the browser. Disconnect revokes the local secret and deactivates every owned destination.

The implementation targets Graph API `v24.0`, consistent with the official Meta Pages/Graph references recorded in BW-34.0 and retrieved there on 2026-09-14.

## Approved publication and payload

Immediately before preflight and publication the Facebook service reloads the authoritative Board/node and checks edit/Brand-derived access, owner-scoped connection, destination ownership and connection binding, active Page status, `CREATE_CONTENT`, exact scopes, token state, supported Facebook node type, current approval status, stored/submitted/recalculated v2 fingerprint equality, and deterministic job state.

Supported formats are:

* text only: `message=<approved caption>`;
* text plus one link: `message=<approved caption>` and `link=<one authoritative https URL>`.

The URL validator rejects malformed URLs, non-HTTPS protocols, embedded credentials, explicit ports, fragments, and ambiguous distinct link fields. It does not fetch the supplied URL, avoiding SSRF. Empty, invalid-Unicode, or messages over 63,206 Unicode code points are rejected without truncation or rewriting. Media and scheduled payloads are unsupported.

## Idempotency, response, and errors

The idempotency digest binds action version, owner, Page destination, Board, node, and approved fingerprint. Unique job insertion and atomic `queued` to `delivering` claim prevent double-click, route, browser, and worker duplicates. Provider acceptance is recorded with the opaque Facebook post ID before transactional external-post/job finalization. A permalink is stored only when an authorized Graph read returns an HTTPS `facebook.com` `permalink_url`; no URL is fabricated.

A timeout, malformed success, or accepted response without a valid post ID becomes indeterminate and cannot automatically publish again. Errors are bounded as credential/authentication, permission, destination unavailable, invalid content, rate limit, transient failure, permanent rejection, or ambiguous result; raw provider bodies and credentials are never logged or returned.

## UI and localization

Social Connections now presents connect/reconnect/disconnect state and an accessible Page selector. Multiple Pages have no automatic selection; a sole eligible Page is selected for convenience. Content Workspace exposes the existing approved-content publish confirmation for Facebook and displays an external link only when authoritative. English and German strings cover the connection, Page, permission, publishing, success, link, format, and safe failure states. Selector styles use existing theme tokens and one isolated responsive rule, preserving Light/Dark Mode and LinkedIn DOM IDs.

## Environment and deployment prerequisites

Required server variables:

* `FACEBOOK_APP_ID`
* `FACEBOOK_APP_SECRET`
* `APP_ORIGIN` (the canonical HTTPS application origin)
* `FACEBOOK_PAGE_PUBLISHING_ENABLED=true`
* the existing `SOCIAL_CONNECTOR_ENCRYPTION_KEY_VERSION` and corresponding `SOCIAL_CONNECTOR_ENCRYPTION_KEY_V<n>`

Register the exact callback `${APP_ORIGIN}/api/social-connections-facebook-callback` in the Meta app. Secrets must use the normal server secret channel and must never be placed in browser configuration.

## BW-34.2 insertion point and deferred work

BW-34.2 Social Performance should begin from confirmed rows in `social_external_posts`, joining their owner/destination/job provenance, and add a separately RLS-denied provider-neutral metric-observation table plus an owner/Board-authorized server read service. No metrics polling, Insights UI, comments, webhooks, engagement actions, scheduling, media, Instagram, Threads, Reels, Stories, customer accounts, or Brand Learning is implemented here.

Known limitations: Development Mode supports only eligible app-role/Page users; customer onboarding still requires Meta review/access and business prerequisites. There is no automatic retry or Facebook reconciliation after an ambiguous provider result. Page selection is explicit client state and is revalidated against owner-scoped server persistence on every operation.

## Production verification gate

1. Configure the documented environment variables.
2. Register the exact production callback in Meta.
3. Deploy.
4. Sign in to Tendra One.
5. Connect Facebook.
6. Select the Tendra One Page.
7. Open approved Facebook-compatible content.
8. Publish once.
9. Confirm one Facebook post and authoritative success state.
10. Retry the same action and confirm no duplicate post.
11. Disconnect and confirm publishing becomes unavailable.

The completed Graph API Explorer preflight does not need to be repeated.
