# BW-34.1.3 — Facebook publishing readiness

## Production trace and exact false condition

`GET /api/social-connections` reads the account/destination rows and `facebookProjection` emits a sanitized provider object. An account is `connected` only when its persisted state and token-vault references are valid. Eligible destinations are active, authorized Pages whose normalized capability list contains `CREATE_CONTENT`. The selected destination is represented by the internal destination UUID in `destination_id` and by `selected: true` on the matching entry in `destinations`; the browser never receives the external Page ID or a token.

`facebook-connections-settings.js` validates that pair again in `normalizeProjection`. Before this repair it then flattened the result into three independent mutable presentation fields: `connected`, `destinationId`, and `destinationLabel`. Content Workspace used `destinationLabel` directly for **Connected Page**, calculated the **Ready** badge solely from content completeness, but sent `connected` and `destinationId` through a separate `evaluateFacebookPublishAction` path. The exact historical rejection was `input.connected !== true`, producing `connection_unavailable`. Thus a stale/default `connected: false` could select **Connect Facebook to publish** while the separately consumed label still rendered **Connected Page: Tendra One**. The split object had no resolved/loading state and opening Content Workspace did not await its canonical fetch.

The BW-34.1.2 production-shaped contract that exposes the defect is:

```json
{
  "state": "connected",
  "connection_id": "<internal connection UUID>",
  "destination_id": "<internal destination UUID>",
  "destinations": [{
    "id": "<same internal destination UUID>",
    "label": "Tendra One",
    "type": "page",
    "capabilities": ["CREATE_CONTENT"],
    "selected": true
  }]
}
```

No `available`, Page access token, external Page ID, provider response, or LinkedIn-shaped field is part of that contract.

## Authoritative client selector

`selectFacebookPublishingReadiness(snapshot, node)` is the single pure Content Workspace selector. Its only provider input is `{ status, projection }`, where `projection` is the sanitized normalized server response. It returns `ready`, `reason`, `connectedAccount`, `selectedDestination`, `payloadSupported`, `approvalCurrent`, `alreadyPublished`, and bounded validation detail. It neither mutates nor performs I/O.

Stable reasons are:

- `facebook_loading`
- `facebook_not_connected`
- `facebook_destination_required`
- `facebook_destination_unavailable`
- `facebook_content_not_approved`
- `facebook_approval_stale`
- `facebook_payload_unsupported`
- `facebook_already_published`
- `facebook_ready`

The connected Page metadata, primary decision, label, behavior, and unavailable explanation all consume this result. Consequently a selector result containing a selected Page can never take the not-connected action branch.

## Action mapping

- `facebook_ready` → **Publish to Facebook**, entering the existing preflight/confirmation/publish path.
- `facebook_not_connected` → **Connect Facebook to publish**, opening Social Connections.
- `facebook_destination_required` → **Select Facebook Page to publish**, opening Social Connections.
- `facebook_loading` → bounded disabled **Checking Facebook connection…** state.
- `facebook_payload_unsupported` → localized unsupported-content state.
- approval, unavailable destination, and prior-publication reasons remain accurately unavailable rather than being relabeled as disconnection.
- A successful publication is authoritative; **Open on Facebook** is emitted only when the result contains a real external URL.

## Refresh lifecycle

The settings controller publishes a shared snapshot with an explicit `loading`, `resolved`, or `error` status. It deduplicates an in-flight fetch and uses its request version before accepting a response. Opening Content Workspace first renders the bounded loading action and starts/awaits the canonical refresh. An app-level screen generation prevents an obsolete completion from rerendering a later screen. The existing connection-change event rerenders only Content Workspace cards. Closing Social Connections refreshes the shared snapshot once and rerenders the active workspace. Reload uses the same initialization fetch and selector.

## Publish request contract

Preflight re-reads `/api/social-connections`, normalizes its Facebook projection, and sends `destinationId` from the sanitized internal `destination_id`. Confirmation sends the server-returned preflight destination's internal `id`. Neither Page label, selector index, external Page ID, nor browser credential is request authority. Existing server ownership, credential, capability, approval, idempotency, and finalization checks are unchanged.

## Files changed

- `facebook-connections-settings.js` — canonical shared snapshot and bounded refresh lifecycle.
- `content-workspace.js` — pure readiness selector and unified Page/action projection.
- `app.js` — snapshot handoff and generation-safe workspace refresh.
- `scripts/check-bw34-1-3-facebook-publishing-readiness.js` — deterministic production-shaped regression.
- `package.json` and `.github/workflows/runtime-boot-safety.yml` — check registration immediately after BW-34.1.2.
- This implementation record.

## Regression coverage

The check reconstructs the reported historical contradiction, proves its old `connection_unavailable` result, and proves the identical canonical response now yields `facebook_ready`. It covers disconnect, missing destination, loading, multiple cards sharing one snapshot, unsupported payload, stale approval, prior publication, internal destination authority, token/external-ID absence, fetch deduplication and generation guards, workflow order, and LinkedIn isolation. All fixtures are invented and perform no network, Meta, credential, PostgreSQL, or publication operation.

## Deployment requirements

Deploy the application code only. No migration, schema/RLS change, environment variable, Meta setting, OAuth reconnect, credential operation, Page reselection, or manual Facebook publication is required.
