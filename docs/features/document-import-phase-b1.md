# Secure document processing — Phase B1

Phase B1 adds only the server-authoritative processing control plane for the existing private Pitch Deck and Whitepaper sources. It adds no extraction, parsing, chunking, OCR, AI, embeddings, proposals, Review, Apply, readiness, or Brand Brain mutation.

## Persistence and binding

`brand_document_processing_jobs` and `brand_document_processing_results` are created idempotently through the existing runtime schema convention. Every row is bound to board ID, stable tile ID, canonical source type, document ID, positive document revision, and SHA-256 content hash. Jobs contain state/control metadata only; results contain provenance metadata only. Neither table has a payload, binary, extracted-content, scan-report, private-URL, storage-key, prompt, or credential column.

One unique job exists for an exact revision binding. Repeated starts return that job, including its terminal state. The normalized states are `queued`, `scanning`, `blocked`, `processing`, `completed`, `failed`, `cancelled`, and `superseded`. Attempts are capped at three.

## Lease and stale-work protection

The internal worker endpoint claims the oldest eligible queued job with `FOR UPDATE SKIP LOCKED`, changes it to `scanning`, increments its bounded attempt count, and assigns a random 120-second lease token and worker ID. A scan transition succeeds only when the job remains `scanning`, the lease token/owner match, the lease is unexpired, and the joined document is still the exact active uploaded board/tile/type/revision/hash. Cancellation or supersession clears the lease, making late worker transitions no-ops.

Before a future result can be committed, it must use the same conditional active-document and lease checks. Phase B1 never creates a processing result because extraction is intentionally absent.

## Scanner status and fail-closed behavior

The repository and Vercel configuration contain no real private malware scanner. The production provider is therefore always `not_configured`. Start and retry requests create or resolve the authoritative job to `blocked` with safe error code `scanner_not_configured`, while the document retains `malware_scan_status = not_configured`. No source read, parsing, or extraction begins.

An injected deterministic scanner exists only as a programmatic test seam. It requires `ALLOW_DOCUMENT_TEST_SCANNER=true` and is rejected whenever `NODE_ENV=production` or `VERCEL_ENV` is set. It cannot be selected through an API request or production configuration.

## APIs

- `POST /api/documents/processing/start`
- `GET /api/documents/processing/status`
- `POST /api/documents/processing/retry`
- `POST /api/documents/processing/cancel`
- `POST /api/documents/processing/run` (internal bearer secret only)

User operations reauthorize against the current board and canonical source tile. Mutations require edit access and the existing same-origin policy. Every request supplies the exact document ID, revision, and hash, which must match the active PostgreSQL document. Responses are private/no-store and expose only bounded public job metadata and safe error codes.

The internal route requires a constant-time-checked `DOCUMENT_PROCESSING_WORKER_SECRET` of at least 32 characters. No worker scheduler is configured in this repository; production must invoke it from trusted infrastructure only after a real private scanner is integrated.

## Replacement, deletion, and copying

Replacement marks jobs `superseded`, invalidates result metadata, and clears leases for the old exact revision inside the same transaction that changes the active document. Document and tile deletion do the same before Blob deletion. Board deletion relies on exact board foreign keys with `ON DELETE CASCADE` after preserving the existing private-object enumeration. Board creation/copy has no processing-table path and copies no jobs or results.

Pitch Deck and Whitepaper content remains explicitly excluded from Campaign context. Processing state is never written to board JSON.
