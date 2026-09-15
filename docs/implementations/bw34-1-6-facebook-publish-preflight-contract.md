# BW-34.1.6 — Facebook publish-preflight request contract

## Proven failure source

The Content Workspace click path is `data-facebook-publish` → `bind` → live `getNode`/`projectAsset` → `openPublishDialog`. Readiness uses the authoritative Facebook settings projection and its selected destination's internal `id`. `openPublishDialog` then called `preflightLinkedInPublish` with `provider: "facebook"`. That shared browser function spread the whole input into JSON and added `destinationId`, producing:

```json
{"boardId":"…","nodeId":"…","provider":"facebook","clientRequestId":"…","expectedApprovedFingerprint":"v2-…","expectedBoardRevision":"…","saveConfirmationCategory":"…","nodeMaterialNormalizationCategory":"…","requestLifecycleGeneration":1,"destinationId":"…"}
```

`POST /api/social-publishing/facebook/preflight` parsed JSON correctly, but `social-publishing-route.validInput` uses an exact allowlist which did not include `provider`. It therefore returned HTTP 400 with the safe authoritative status `request_invalid`, after signed-session authentication but before Board authorization, database access, publishing-service evaluation, or Meta/provider access. This is the exact production-compatible mismatch; it is not evidence of a Meta rejection.

## Request-invalid branch inventory

Within the publishing boundary, `request_invalid` can come from: Facebook or LinkedIn preflight exact-shape/value validation (HTTP 400, after authentication and before database/provider access); Facebook or LinkedIn publish exact-shape/value validation (HTTP 400, after authentication and before database/provider access); Facebook or LinkedIn publish with `confirmed: true` but an invalid command (HTTP 400); either publish route with a non-POST method (HTTP 405, before authentication); and job status with a non-GET method (HTTP 405, before authentication) or malformed job UUID (HTTP 400, after authentication and before database/provider access). The Facebook preflight now classifies its bounded 400 as `invalid_local_request`; malformed bodies remain secret-free. No branch returns raw bodies, credentials, external Page IDs, or provider responses.

## Field-level comparison and repair

The server-supported preflight envelope is camelCase and flat: `boardId` (UUID), `nodeId` (bounded internal reference), `destinationId` (UUID), `clientRequestId` (bounded reference), optional `expectedApprovedFingerprint`, optional `expectedBoardRevision`, and bounded lifecycle categories/generation. It has no `provider`, `platform`, `channel`, message, link, action/phase, account ID, display label, external Page ID, or nested envelope. `Content-Type` remains `application/json`; `undefined` optional values are omitted by `JSON.stringify`, while `null` is accepted only where the route contract permits it.

The repaired Facebook branch constructs that exact allowlisted object rather than spreading UI input. Provider only selects the endpoint and never enters the Facebook body. The destination comes from `FacebookSettings.normalizeProjection(...).destination_id`, whose normalization selects the internal destination `id`; the display label and external Page ID are not serialized. LinkedIn retains its existing branch and payload behavior.

## Authoritative response and confirmation binding

The authoritative response envelope now retains only the bounded preflight presentation values (caption/link, character count, safe profile display name, internal destination object, approval fingerprint, readiness/status, provenance, and confirmation requirement) using the established snake-case response contract. The Facebook browser branch verifies the authoritative envelope/request-ID contract and normalizes those fields for the dialog.

A successful preflight also issues a ten-minute opaque HMAC confirmation token using the already-required session signing secret. It binds board, node, internal destination, client request ID, and expected approval fingerprint. The dialog's final request uses the server-returned destination, fingerprint, and token. The Facebook publish route verifies this binding before database or provider access; changing board, node, destination, request ID, or fingerprint invalidates confirmation. Publish still re-runs signed-session, Board/Brand authorization, current approval, connection, credential, scope/capability, content, idempotency, and prior-publication checks. Preflight performs no adapter/Meta call.

## Safe diagnostics

The UI no longer renders raw `request_invalid`. It maps bounded server statuses to safe localized messages for stale approval, unavailable destination/connection, prior publication, and authorization. All other malformed or temporary failures use “Facebook publishing could not be verified. Please try again.” Internal stable status/classification values remain in the authoritative response without exposing request bodies, tokens, credentials, external Page IDs, or provider responses.

## Changed files

- `app.js` — exact Facebook request envelope and authoritative response normalization.
- `content-workspace.js` — bounded localized preflight errors and token-bound confirmation.
- `api/social-publishing-route.js` — bounded preflight response fields and optional publish token field.
- `api/social-publishing/facebook/preflight.js` — safe classification and confirmation issuance.
- `api/social-publishing/facebook/publish.js` — confirmation binding verification.
- `api/social-connector/facebook-preflight-contract.js` — bounded signed confirmation contract.
- `scripts/check-bw34-1-6-facebook-publish-preflight-contract.js` and `package.json` — focused deterministic regression.

## Acceptance criterion

An existing approved Facebook node with an authoritative selected internal Page destination sends the exact accepted preflight envelope, receives a successful authoritative response, and opens confirmation. Display names/external Page IDs cannot become destination IDs; malformed requests receive safe text; stale approval and prior publication still block; confirmation cannot substitute its board/node/destination/fingerprint; the regression makes no Meta call; and LinkedIn remains on its existing branch.

## Rollback boundary

Revert the files above as one unit. There is no schema, migration, RLS, OAuth, Meta configuration, scope, Graph version, credential, environment-variable, publication-material, scheduling, generation, LinkedIn, or Instagram change and no data rollback.
