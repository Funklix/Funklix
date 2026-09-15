# BW-34.1.8 — Facebook preflight response serialization repair

## Exact failure

The successful route reached `route.send` in `api/social-publishing/facebook/preflight.js` with the complete preflight service result spread into the response. `route.send` projected that result to snake case and `_authoritative-response.write` rejected it at `!isPlain(envelope)`, throwing `TypeError("unsafe_authoritative_envelope")`. The route catch classified every throw after setting `stage = "response_serialization"` as `response_serialization_unavailable`.

The exact invalid value is `result.provenance.publishedAt`, sourced from PostgreSQL's `published_at` timestamp column by the service's latest-publication query. At runtime `pg` supplies that timestamp as a `Date`, not a JSON-contract string. Native `JSON.stringify` can serialize a Date by invoking `toJSON`; it was never reached. The authoritative contract intentionally rejects non-plain object prototypes first. This occurs when the same node has a retained latest external-publication record (including a publication on another platform); Facebook's provider-specific idempotency check can still find no Facebook publication and declare the preflight eligible.

No `BigInt`, `Buffer`, `Error`, `Map`, `Set`, non-finite number, circular reference, raw destination/account row, confirmation object, missing expiry, fingerprint shape mismatch, already-serialized body, or writer misuse is on this successful path. The database row leak was the nested `Date` in the otherwise unnecessary provenance service object.

## Service result, intended contract, and repaired DTO

Before repair, the route spread the service object, including `blockingCodes`, the approval diagnostic, and provenance, then appended a confirmation token and request IDs. Content Workspace only requires the authoritative caption, character count, safe account/Page labels, internal destination reference, approved fingerprint, readiness/editorial status, opaque confirmation binding, and client/server request correlation.

The new Facebook-specific response projector constructs one allowlisted plain object. It requires `ok: true`, `status: "ready"`, the existing bounded caption/link and safe labels, a finite safe character count equal to the caption's Unicode code-point count, an internal UUID destination with type `page`, a valid established approval fingerprint, `Approved` editorial status, confirmation-required boolean, an opaque bounded string token, and valid request IDs. The shared route then performs the existing snake-case projection, yielding:

* `contract_version`, `ok`, `status`, `classification`, `server_request_id`;
* `client_request_id`, `caption`, `link`, `character_count`;
* `profile_display_name`, `destination` (`id`, `type`, `label`);
* `approved_fingerprint`, `readiness`, `editorial_status`;
* `confirmation_required`, `confirmation_token`.

No database model, provenance row, Date, credential, token secret, external Page ID, raw connected account, raw diagnostic, or service object crosses the successful public boundary. Missing or malformed required values are not coerced: projection fails with `response_projection_invalid`.

## Content Workspace

`app.js` now converts the authoritative snake-case response into one explicit browser object rather than spreading the raw response and adding camel-case aliases. The dialog displays only its returned caption, count, readiness, account label, and destination label. Confirmation submits the returned internal destination ID, approved fingerprint, opaque binding, and returned client request ID. Those values are not reconstructed from the card, settings selector, or the request generated before preflight.

## Diagnostics

Response failures now use stable stages/codes: `response_projection_invalid`, `response_contract_invalid`, `response_json_serialization_failed`, and `response_write_failed`. The safe log contains only correlation ID, stage, code, HTTP status, a broad error category, configuration-presence booleans, and (when applicable) a validated SQLSTATE. It never logs content, destination/Page IDs, approval fingerprints, confirmation bindings, credentials, raw rows, or DTOs.

## Changed files and deployment

* `api/social-connector/facebook-preflight-response.js` adds the explicit successful response DTO.
* `api/social-publishing/facebook/preflight.js` projects before writing and reports precise safe failure codes.
* `api/_authoritative-response.js` distinguishes response contract, JSON serialization, and writer failures.
* `app.js` and `content-workspace.js` consume the returned contract and correlation once.
* The focused BW-34.1.6/BW-34.1.7 fixtures now represent the full production service result; `scripts/check-bw34-1-8-facebook-preflight-response-serialization.js` covers the historical Date value, actual route/writer, invalid projections, browser contract, and absence of side effects.

No schema, migration, RLS, OAuth, Meta scope/version, Page selection, environment, reconnection, confirmation-secret, binding coverage/expiry, publication-material, approval fingerprint, scheduling, generation, LinkedIn, Instagram, or Canvas change is required. Deploy the server and browser files together.

## Acceptance and rollback

Production acceptance is: an existing approved Facebook post proceeds from **Publish to Facebook** through **Checking Facebook eligibility** to HTTP 200 and opens the confirmation dialog with the authoritative Page and content, without a Meta request or publication before confirmation.

Rollback is limited to the response projector, route diagnostics/writer classification, explicit browser projection/correlation consumption, focused checks, package command, and this record. It requires no data or configuration rollback.
