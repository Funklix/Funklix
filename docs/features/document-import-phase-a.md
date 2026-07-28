# Pitch Deck and Whitepaper document import — Phase A

Phase A adds private source-file upload, metadata, authorized download, replacement, deletion, and restoration for the canonical `pitch_deck` and `whitepaper` Knowledge Modules. It does not extract text, run AI, create proposals, apply knowledge, or change readiness.

## Persistence boundaries

- PostgreSQL `brand_documents` records are authoritative and bind one active document to a board ID, stable `km_…` tile ID, and canonical source type.
- `brand_document_upload_intents` protects direct uploads with short-lived, single-path intents and expected-current-document baselines.
- Private Vercel Blob objects contain the binaries. Object keys and private URLs are server-only.
- Board JSON contains neither document IDs nor binary/storage data. Consequently, board copies begin without active documents and stale board snapshots cannot resurrect or grant access to a document.
- Existing tile `content` remains editable as private legacy notes but is excluded from Campaign context by canonical module identity.

## Storage and deployment

Private document storage requires one of:

- `BLOB_READ_WRITE_TOKEN`; or
- `VERCEL_OIDC_TOKEN` and `BLOB_STORE_ID`.

`DOCUMENT_BLOB_STORE_ID` may override the store used for documents. Production fails closed when private storage credentials are absent; it never falls back to public blobs or temporary disk.

The browser uploads directly to a five-minute, server-authorized, exact-path private Blob URL. The server then reads the object privately, enforces the 20 MB limit, validates PDF/DOCX structure, computes SHA-256, and transactionally makes it active. PDF page counting is bounded best-effort in Phase A; DOCX and ambiguous PDFs are marked `requires_phase_b_validation`. The 100-page limit must be revalidated by the Phase B parser before analysis.

No malware-scanning service exists in the repository. Metadata therefore records `not_configured`, the UI says “Not configured — not scanned,” and future analysis must not treat that state as scan approval.

## Lifecycle and cleanup

Replacement stores and validates a new object before switching the active metadata row. Old-object cleanup occurs only after the new row commits. Delete uses an expected document ID and a `deleting` state so a stale tab cannot delete a replacement. Tile deletion calls the same document deletion operation before removing the tile. Board deletion enumerates linked objects before the database cascade and performs bounded cleanup.

Object cleanup failures after a successful replacement or board deletion are logged only as document IDs and require operational retry infrastructure before production retention guarantees are complete.
