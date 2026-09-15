# BW-34.1.7 — Facebook preflight 503 availability repair

## Proven branch and runtime prerequisite

The 503 is emitted only by the catch in `api/social-publishing/facebook/preflight.js`. For the production-shaped, authenticated, valid request, the newly introduced successful-result branch called `facebook-preflight-contract.issue`. BW-34.1.6 made that operation depend on `AUTH_SECRET || SESSION_SECRET`; when neither name is available to that function it throws `publishing_confirmation_unavailable`, which the undifferentiated catch converted to `preflight_unavailable` (503). This is after the service has completed its database reads and before response serialization, and is consistent with no Meta request. It was a hidden runtime requirement introduced by BW-34.1.6; the statement that no configuration requirement was added was incorrect.

Facebook publishing already requires `FACEBOOK_APP_SECRET`. Production has that variable. The repair authenticates the provider-specific confirmation binding with this existing server-only capability boundary, rather than inventing another secret or another variable name. No value is logged or returned. `FACEBOOK_APP_ID`, `APP_ORIGIN`, the publishing flag, and the versioned connector encryption key retain their existing meanings.

## Complete 503 inventory

| Stage / function | Stable code | Trigger | Before DB / credential | Environment | Production match | Safe event |
|---|---|---|---|---|---|---|
| body, route handler / `readBody` | `request_body_unavailable` | stream/JSON/size exception (valid-shape failures remain 400) | yes / yes | no | no: repaired request was valid | now yes |
| authorization/storage, `getBoardAccess` via service `resolve` | `publishing_storage_unavailable` | pool initialization/query failure | first query / yes | database configuration | possible dependency class, but not newly introduced | now yes, validated SQLSTATE only |
| connector lookup, service `resolve` | same | connected-account query failure | no / yes | database | possible | now yes |
| destination lookup, service `resolve` | same | destination query failure | no / yes | database | possible | now yes |
| prior-publication lookup, service `resolve` | same | job/external-post query failure | no / yes | database | possible | now yes |
| provenance lookup, service `preflight` | same | external-post query failure | no / yes | database | possible | now yes |
| confirmation, route / `confirmation.issue` | `confirmation_binding_unavailable` | old contract cannot find `AUTH_SECRET` or `SESSION_SECRET` | no / before decryption (preflight does not decrypt) | **old: extra login-secret name; repaired: `FACEBOOK_APP_SECRET`** | **exact newly introduced branch** | now yes |
| response, route / `route.send` | `response_serialization_unavailable` | authoritative serialization/write throws | no / yes | no | possible in general, no evidence | now yes |
| route dependency/import | platform bootstrap failure | require-time failure | yes / yes | potentially database module initialization | cannot produce this handler's bounded JSON 503 | platform log only |

No lower-level preflight branch returns 503 directly. Feature-disabled, missing connection/credential metadata, revoked credential, stale or unauthorized destination, missing scopes/capability, content invalidity, stale approval, active job, and prior publication are deterministic `evaluate`/approval results and remain bounded 409 responses. Method, authentication, and envelope failures remain 405/401/400. Credential decryption occurs only after final confirmation in `publish`; its malformed-envelope result remains `credential_invalid`, and it is not reclassified by preflight. Preflight neither mutates the database nor invokes the adapter/Meta.

## Binding and repair

The token is JSON encoded as base64url and authenticated with HMAC-SHA-256. It contains a fixed contract version, absolute ten-minute expiry, board ID, node ID, internal destination ID, client request ID, and approved fingerprint. Verification recomputes the HMAC with the server-only Facebook app secret and compares it in constant time, then compares every bound field and expiry. It uses no module state, random instance secret, or map, so a later Vercel invocation can verify it. Browser substitution remains rejected.

The route now records its stable stage and emits one sanitized `facebook_preflight_failure` event containing only a safe Vercel/request correlation ID, stage, code, HTTP status, configuration-presence booleans, and a syntactically validated five-character database error code when present. It never includes request bodies, content, tokens, credentials, URLs, Page/destination/node IDs, or secret values. The bounded response includes only the stable failure code.

## Changed files and deployment

- `api/social-connector/facebook-preflight-contract.js`: use the established Facebook server-secret boundary.
- `api/social-publishing/facebook/preflight.js`: stage-specific availability classification and sanitized diagnostic.
- `api/social-publishing-route.js`: serialize the bounded internal failure code.
- `scripts/check-bw34-1-7-facebook-preflight-503.js`, the BW-34.1.6 fixture, and `package.json`: focused cross-invocation regression and command.
- This implementation record.

No schema, RLS, OAuth, scope, Graph version, Page selection, or Vercel configuration change is required. Acceptance is: existing approved post → Publish to Facebook → Checking Facebook eligibility → HTTP 200 → existing confirmation dialog, with no provider request before confirmation.

## Rollback boundary

Revert the confirmation contract, preflight route diagnostic/classification, response alias, focused checks, package command, and this record together. There is no data or environment rollback.
