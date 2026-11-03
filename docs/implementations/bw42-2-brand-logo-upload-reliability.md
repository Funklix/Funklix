# BW-42.2 — Brand Logo immutable upload retry

Base: latest merged main `006234108f13f58a7491dac6639b7fca41c7aa77`.

## Demonstrated defect and limits

The historical live incident's first failure is **not attributed**. No production
Supabase/hosting connection, database credential, service-role credential, or
incident log is available to this session. This correction fixes an independently
reproduced production-adapter retry defect; it does not establish that a deployed
bucket, key, migration, or policy is broken. No production policies were changed.

The production endpoint retains immutable bytes when database persistence fails
or a commit is uncertain. The controller retains the selected file and request ID
for retry. A repeated `POST` with `x-upsert:false` therefore encounters an existing
object. Supabase REST renders that duplicate as **HTTP 400** with a JSON semantic
`statusCode:"409"`, `code:"KeyAlreadyExists"` (or `ResourceAlreadyExists`),
`error:"Duplicate"`. Its legacy envelope can omit `code`.

Upstream source, pinned at `b74897cf261d87f8890fc473899e9f2100873e3c`:

- [Storage error definitions](https://github.com/supabase/storage/blob/b74897cf261d87f8890fc473899e9f2100873e3c/src/internal/errors/codes.ts)
- [HTTP error rendering](https://github.com/supabase/storage/blob/b74897cf261d87f8890fc473899e9f2100873e3c/src/http/error-handler.ts)
- [StorageBackendError user status](https://github.com/supabase/storage/blob/b74897cf261d87f8890fc473899e9f2100873e3c/src/internal/errors/storage-error.ts)

`api/_brand-logo-storage.js:request` previously recognized only HTTP 409. It
classified this real HTTP 400 envelope as `STORAGE_UNAVAILABLE`, preventing
`api/brands/[id]/logo.js` from executing its existing retained-object read and
SHA-256 comparison. The prior fixture silently overwrote existing objects,
despite `x-upsert:false`, masking the defect.

Before the adapter correction, making the fixture return this envelope caused
the unchanged `check-bw42-logo-upload.js` retry assertion to fail at line 23 with
“Logo storage is temporarily unavailable. Your Brand information can still be
saved.” After correction the same assertion passes, with exactly one immutable
object and one committed logo revision. A different-byte collision still fails.

## Lifecycle trace

- `brand-profile-setup.js:chooseFile` validates PNG/JPEG/WebP/GIF, nonempty, at
  most 2 MB; retains FileReader bytes. `mount:logoControls` renders a data URL
  preview. Neither action uploads or persists anything.
- `logoMutation` constructs `brand_logo_v1` with the Brand, captured Workspace,
  expected logo revision, MIME type, base64 bytes and retained request ID.
- `brand-write-contract.js:submitLogo` sends same-origin session cookies to
  `/api/brands/:id/write-preview`, obtains protected replacement review when
  needed, then posts JSON to `/api/brands/:id/logo`. Receipt-only replay handles
  a previously committed but lost response without another upload.
- The logo endpoint validates the signed session, owner/admin/editor Brand role,
  Workspace membership/context, revision and replacement review. Image signature,
  dimensions and MIME validation precede storage. Missing/invalid files and
  unauthorized requests never reach the storage adapter.
- The provider is **Supabase Storage**, private bucket **brand-logos**, configured
  by migration `20261001_bw36_12_brand_logo.sql`. Server requests use
  `SUPABASE_SERVICE_ROLE_KEY` in Authorization and apikey headers. `SUPABASE_URL`
  supplies the origin; only a direct `db.<project>.supabase.co` `POSTGRES_URL`
  hostname supports the existing fallback. A pooler hostname requires an explicit
  `SUPABASE_URL`. This is an existing configuration requirement, not a demonstrated
  incident cause.
- Object path: `<brand UUID>/<next revision>-<mutation UUID>.<extension>`, with
  `x-upsert:false`. The existing restrictive browser policy and authenticated
  application route remain authoritative; no public bucket URL is sent to clients.
- The protected database lifecycle atomically persists metadata and a receipt;
  readback validates the object reference and revision before commit. The response
  projects a same-origin authenticated revision URL. Internal object paths and
  provider credentials never appear in that response.
- The controller verifies the response contract, authoritative Brand GET and
  decoded image GET before reporting completed success. It distinguishes saved
  but unsynchronized state from an upload failure.
- Profile save is a **separate canonical write**. It does not carry logo metadata;
  a later profile save preserves the logo and the independent Brand Avatar.
- The exact observed generic message appears in `createSession:run`'s upload
  exception handler and `logoMutation`'s fallback for otherwise unclassified failed
  responses. An injected `UPDATE_FAILED` at `metadata_update` reproduces that
  message; it is not evidence that production had that database failure.

## Correction and coverage

Only the storage adapter's duplicate response interpretation changes in production.
For POST HTTP 400, parse at most 4096 bytes of the error envelope and recognize
only a semantic 409 plus a known duplicate code, or the legacy Duplicate envelope
without a code. Malformed, oversized, permission, missing-bucket and unrelated
errors remain failures. No raw response is logged or shown. HTTP 409 compatibility
is retained. The endpoint still reads and hashes retained bytes before adopting
them; no overwrite, new upload path, new quota, provider or data model is added.

Tests added without removing existing assertions:

- Contract cases for current/legacy envelopes, bounded malformed/oversized bodies,
  nonduplicate errors, authentication/Brand/Workspace denial, invalid signatures,
  immutable retry, digest mismatch, double-click serialization, profile save and
  fresh authenticated image GET.
- Actual Chromium application interaction: file selection, decoded local preview
  before any storage object, storage failure, metadata failure, EN/DE feedback,
  retained-file retry, real production image delivery/readback, save, full page
  reload, replacement, reopen and unchanged core/Avatar data. External SQL and
  storage transport are disposable fixtures; no unconditional binary GET mock.
- Existing restricted PostgreSQL upload test now rejects a real metadata UPDATE
  using a disposable database trigger, verifies rollback with a retained object,
  removes the trigger, then retries through the real controller/auth/preview/API,
  SQL lifecycle and storage adapter. Its HTTP fixture rejects duplicate creation
  with Supabase's envelope. Existing normal, legacy-upgrade and strict-role-graph
  matrix variants all exercise this path.

## Production diagnostic needed to attribute the original incident

The smallest next step is one failed upload against a disposable production Brand,
using the harmless generated PNG fixture, with matching server logs:

1. Record deployment commit, UTC timestamp and the `brand_logo_v1` request ID from
   DevTools. Record status and sanitized error code for both write-preview and
   logo POST. Do not export cookies, review tokens, request bodies/base64, private
   Brand fields or an unsanitized HAR.
2. In the deployment's server logs, correlate that time/request to
   `[BRAND_LOGO_FAILURE]` and record its stage (`authorization`, `storage_upload`,
   `metadata_update`, `metadata_readback`, `response_projection`). A failure before
   that catch may be visible only in the API response. For a storage failure,
   correlate the Supabase Storage request log and retain only HTTP status and
   semantic error code/statusCode, excluding raw messages and paths.
3. Verify in hosting settings that `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` are present in the failing deployment environment
   and refer to the same Supabase project as the application database. Report
   booleans/project-match only, never their values. Check whether the database URL
   is a pooler URL; absence of an explicit storage origin then cannot use fallback.
4. In Supabase's SQL editor, read only configuration:

   ```sql
   SELECT id, public, file_size_limit, allowed_mime_types
   FROM storage.buckets WHERE id = 'brand-logos';
   SELECT policyname, permissive, roles, cmd, qual, with_check
   FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects';
   ```

   Confirm the private 2 MB four-format bucket and installed migration policy;
   confirm the server credential is an authorized service role. Do not enumerate
   customer objects or alter policies. If metadata is the first failing stage,
   obtain the redacted database SQLSTATE and migration/verifier outcome for that
   deployment rather than modifying storage permissions.

These observations are required before claiming the historical live failure fixed.
