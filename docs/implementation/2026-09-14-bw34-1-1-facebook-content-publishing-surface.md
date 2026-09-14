# BW-34.1.1 — Facebook content-to-publishing surface

## Missing product boundary

BW-34.1 supplied the server-authoritative Facebook Page connector and publishing routes, and Content Workspace already had a partial provider branch. The user-facing Social Media Posting platform/channel selectors, Canvas selector, filters, and Campaign allowlist did not offer Facebook. Consequently production nodes remained Instagram or LinkedIn nodes, and the deliberately platform-gated publishing action could never be reached by a Facebook content item. The partial action also waited until preflight to discover connection/destination/content blockers.

## Canonical channel contract

The canonical persisted Canvas value is `Facebook`, matching the title-cased existing values (`LinkedIn`, `Instagram`, `TikTok`, and `X / Twitter`). Connector/API provider identifiers remain lowercase `facebook`. Existing values are not normalized or rewritten and unknown values continue to hydrate and render unchanged.

Updated channel knowledge is bounded to the Inspector platform and strategy selectors, Canvas social selector and character limit, platform filter, the Campaign setup allowlist/selectors, Campaign strategic platform projection, and Content Workspace supported platforms. Facebook is never inferred from an account connection.

## Creation and editing

Add Node continues to create the established Social Media Posting template. Facebook can then be selected in the Inspector or directly on the Canvas; this synchronizes that posting's `social.platform` and `channel`. Titles and Unicode/multiline captions continue through existing controls, serialization, autosave, hydration, and collaboration projections. Campaign generation can deterministically choose Facebook, but regeneration is not required.

Material mutations use the shared v2 approval material serialization. Changing a platform/channel or caption on an approved post returns it to Draft and removes its approved fingerprint. Existing nodes are untouched until a user edits them.

## Approval lifecycle and publishing eligibility

Facebook uses the existing Draft → In Review → Approved authoritative transition. Platform is already included in the shared approval fingerprint. Both client and server require a Social Media Posting, canonical Facebook platform, Approved status, a current v2 fingerprint, valid supported content, a connected account, selected active Page destination, and no finalized publication. The server remains authoritative and repeats the full connection, ownership, permission, credential, destination, idempotency, and publication checks.

The client mirrors BW-34.1 payload shape checks for non-empty well-formed text, the 63,206-code-point limit, at most one authoritative HTTPS URL without credentials, port, or fragment, and no media. It does not truncate, translate, or rewrite content. The existing real Facebook preflight/publish routes are used. An authoritative success is retained in the card presentation, including Page name and an `Open on Facebook` link only when the server returned a permalink.

Approved Facebook content without a usable connection or Page shows a localized Social Connections action instead of a misleading publish button. Other platforms cannot receive a Facebook action.

## Social Connections card repair

The Facebook card now has one connected-state label and one associated `Select Facebook Page` label. Options expose only Page names as visible text; the raw provider Page ID is no longer rendered. The internal destination UUID remains the option value used by publishing, and accessibility association is preserved. Narrow responsive styling is isolated to the Facebook card.

## Scheduling boundary

The existing calendar remains an internal planning facility (`scope: internal_planning`). Facebook cards continue to permit internal planning but never claim a Meta-side scheduled post. `Publish to Facebook` remains a separate immediate provider operation; Facebook scheduling was not added.

## Files changed

- `index.html`
- `app.js`
- `content-workspace.js`
- `facebook-connections-settings.js`
- `api/social-connector/facebook-publishing.js`
- `language.js`
- `styles.css`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `scripts/check-bw34-1-1-facebook-content-publishing-surface.js`
- this implementation record

## Regression coverage

`check:bw34.1.1` uses only built-in Node modules and invented fixtures. It exercises production approval fingerprints, transition/readiness/projector functions, client/server Facebook validation and eligibility, positive text/link cases, blockers, platform isolation, source-level Add Node/Inspector/Canvas/persistence/collaboration boundaries, localized labels, card privacy/accessibility contract, scheduling distinction, authoritative routes/permalink presentation, LinkedIn isolation, and Runtime Boot Safety ordering. It performs no network call or provider publication.

## Known limitations

Only text and text plus one HTTPS link are supported. Media, Meta-side scheduling, analytics, comments, webhooks, and customer accounts remain out of scope. The reported legacy LinkedIn approval rejection did not expose an authoritative cause and was not changed; only the shared platform/fingerprint path needed by newly created Facebook content was verified.

## Deployment requirements

No database migration, environment variable, Meta scope/configuration change, credential operation, RLS change, or Vercel setting is required. Deploy the application code through the existing process.
