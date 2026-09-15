# BW-34.1.9 — Facebook publication finalization

## Rejection condition and contract mismatch

The production-shaped service success was `{ ok, status: "published", jobId, providerAttemptId, publishedAt, externalUrl, destination }`. The shared snake-case envelope therefore contained correlation, job identity, timestamp, URL, destination, and a generic diagnostic, but omitted `job_state`, `provider_attempt_state`, provider acceptance/identity categories, `external_post_state`, `provider`, `finalized`, and `duplicate_delivery_prevented`. The old Content Workspace adapter spread that envelope and validated only the authoritative wrapper, matching client request ID, and string status. Any `readAuthoritativeJson` rejection (empty/non-JSON/incompatible body or response/body request-ID mismatch) threw; the dialog catch, when it had no parsed job ID, converted that received HTTP outcome to `response_lost_or_unavailable`. The supplied empty server/job diagnostic is the signature of this pre-result catch. The captured browser diagnostic does not preserve the response body or headers, so it cannot distinguish those wrapper failure subcategories; claiming a more specific one would not be evidence-based.

The repaired Facebook contract is an explicit allowlist. It requires `ok/status`, provider, client/server correlation, durable job ID and delivered state, accepted/reconciled attempt state, bounded acceptance and identity-presence categories, confirmed external-post state, safe Page label, ISO timestamp, finalized state, and duplicate-delivery prevention. The HTTPS permalink is nullable and optional for presentation. Dates are explicitly converted to ISO strings. No Page ID, post ID, destination UUID, token, raw provider value, row, content, or confirmation binding is returned.

## Durable finalization and reload

Meta acceptance identity is written to the provider attempt before finalization. External-post insertion and the delivered job update occur in one transaction, and success is returned only after commit. Failures after acceptance remain reconciliation-required and never become successful DTOs. Existing idempotency reservation and `ON CONFLICT` behavior remain unchanged; an existing job is read/reconciled rather than delivered again.

A read-only owner/Board-authorized Facebook publication endpoint projects an existing confirmed external post through the same DTO. Workspace refresh consumes it and seeds the card's finalized map, restoring **Published to Facebook**, the selected Page label, and **Open on Facebook** only for an authoritative HTTPS permalink. The finalized state suppresses Publish. Accepted-but-unconfirmed outcomes are not projected as success and remain blocked by the existing job/idempotency state. No migration or production data operation is required.

## Provider-specific UI

Confirmation warning and ambiguous-outcome text now select Facebook or LinkedIn from the card's authoritative workflow platform. English Facebook text is “This publishes immediately and publicly to Facebook.” and “The post may already be live on Facebook. Tendra One could not finish confirming the publication.” German equivalents use “Facebook”; LinkedIn strings are retained unchanged. Facebook continues to display the selected Page label, not the LinkedIn profile fallback.

## Changed files and deployment

Deploy `api/social-connector/facebook-publication-response.js`, the Facebook publishing service and publish/publication routes, `api/social-publishing-route.js`, `app.js`, `content-workspace.js`, `package.json`, and the focused regression together. No OAuth, Page selection, Meta version/scope, secret, preflight binding, approval material, schema/RLS, Instagram, scheduling, Canvas, or generation change is included.

## Acceptance and rollback

After deployment, reload the already-published node: the card must show **Published to Facebook**, restore **Open on Facebook** when the persisted permalink exists, omit Publish, and cause no Meta POST. Roll back only the files listed above as one unit; there is no data, schema, configuration, or provider rollback.
