# BW-36.13R5R4: Repair Brand logo persistence

## Baseline and production evidence

Started from freshly fetched `origin/main` at `ae08fe26ae122dcf0c29c4c8bee49bc0c789a160`, which contains merged R5R3. Dedicated branch: `codex/bw36-13r5r4-brand-logo-persistence`.

The user reproduced a manual upload in production on 9 October 2026 at approximately 09:11 UTC (11:11 Europe/Berlin). `POST /api/brands/:id/logo`, request Content-Type `application/json`, returned HTTP 500 with exactly `{"contract":"brand_logo_v1","error":{"code":"UPDATE_FAILED"}}`. File selection and local preview succeeded, and the authenticated endpoint received the request. The original user report retains the concrete Brand identifier and Vercel request identifier; neither is copied into this document, tests or diagnostic logs, following the request's prohibition on copying identifiers/raw data. No Vercel log capability or production credentials were available. There was no live database, Storage or provider inspection. Fixture results below are not production evidence.

## Root cause and SQL/schema audit

The merged endpoint's first transactional read used:

```sql
FROM brands b
LEFT JOIN brand_members bm ON bm.brand_id=b.id AND bm.email=$2
WHERE b.id=$1 FOR UPDATE
```

PostgreSQL rejects an unqualified `FOR UPDATE` on the nullable side of an outer join with SQLSTATE `0A000` (`FOR UPDATE cannot be applied to the nullable side of an outer join`). This happens even for an owner. R5R3's catch-all mapped this SQL failure to HTTP 500 / `UPDATE_FAILED`. The repair uses `FOR UPDATE OF b` to lock only the authoritative Brand row. This deterministic defect in the shipped query explains the reported response shape; correlation with that individual Vercel invocation remains unverified without its logs. Contrary to the inference from the error name, this query fails before the private Storage upload, not after it. A local file preview does not demonstrate a Storage write.

Reviewed `api/brands/[id]/logo.js`, `api/_brand-logo.js`, `api/_brand-logo-storage.js`, `api/_brands-storage.js`, its actual `pg.Pool` adapter in `api/_boards-storage.js`, both Workspace catalogs, `brand-logo.js`, `brand-profile-setup.js`, `app.js`, `api/brands/[id].js`, and the unchanged, already executed `migrations/20261001_bw36_12_brand_logo.sql`.

The migration defines exactly `logo_object_path TEXT NULL`, `logo_mime_type TEXT NULL`, `logo_source TEXT NULL`, `logo_revision BIGINT NOT NULL DEFAULT 0`, `logo_updated_at TIMESTAMPTZ NULL`, `logo_source_host TEXT NULL`. The endpoint reads/writes those columns only. Its other identifiers and membership columns belong to existing Brand/Workspace authority. No schema mismatch was found.

| Query | Bindings and type authority |
| --- | --- |
| Brand read/lock | `$1` Brand UUID; `$2` owner/member email TEXT; no gaps |
| Workspace membership | `$1` Workspace UUID; `$2` canonical email TEXT; accepted membership and active identity |
| Upload/discovery update | `$1` Brand UUID; `$2` object path TEXT; `$3` MIME TEXT; `$4` source TEXT; `$5` nullable source host TEXT; `$6::bigint` expected logo revision |
| Removal update | `$1` Brand UUID; `$2::bigint` expected logo revision; metadata fields set to NULL |
| Authoritative readback | `$1` Brand UUID; all six migrated logo columns |

Every bound position is present and typable. In particular, a NULL `$5` is typed by its TEXT assignment. There was no missing-placeholder defect in this endpoint. Logo writes use `logo_revision`, not the independent canonical Brand `revision`.

`pg` defaults to returning BIGINT as canonical decimal strings and queries as `{ rows, rowCount }`. R5R3 already converted ordinary `"0"` / `"1"` via `Number`; these strings were not the identified trigger. The repair centralizes strict normalization: safe nonnegative integer numbers or canonical nonnegative decimal strings within JavaScript's safe range. Reject null, undefined, booleans, whitespace, leading zeros, signs, exponents, fractions, nonfinite values and unsafe integers; reject increment overflow before uploading. The numeric wire contract is preserved without rounding. Metadata projection validates UUID, source, MIME, path length, nullable source host and nullable timestamp (including pg Date objects). Transactional readback additionally checks the exact expected path, revision, MIME/source/host and a populated write timestamp before COMMIT. Missing/invalid rows do not silently become successful responses.

## Storage, transactions, concurrency and errors

Sequence: authenticate and authorize owner/admin/editor; begin transaction; read and lock Brand with `FOR UPDATE OF b`; enforce Workspace membership if supplied; normalize/check current logo revision; validate image; upload into the existing private `brand-logos` bucket with no upsert; update migrated metadata with an explicit expected-logo-revision predicate; require exactly one affected row; read and validate the saved row; build the bounded `brand_logo_v1` projection; COMMIT; only then remove the replaced old object.

Upload/discovery/removal preserve both the row lock and the explicit revision guard. Stale expected revisions fail closed with 409 before any Storage mutation. Viewer and unrelated identities cannot upload or remove; missing authentication fails. Existing UUID, role, workspace, MIME/image/size and discovery URL/digest checks remain in place. Uploaded logos retain priority over discovery.

Update/readback/projection failures before COMMIT roll back, then delete only the pending object. Existing metadata and the old object survive. Failed removal readback likewise rolls back and retains the old object. After a successful COMMIT, response or browser projection failures cannot compensate the saved object. Old-object deletion errors do not invalidate the committed upload. Storage deletion now propagates adapter failures to the bounded cleanup/compensation handling, instead of silently swallowing them. If Storage itself refuses a compensating delete, a pending orphan can remain; the failure is diagnosed, metadata remains unchanged, and the original bounded error is preserved. No success is fabricated.

Diagnostics contain only the fixed event name and bounded `stage`: authorization, storage_upload, metadata_update, metadata_readback, response_projection, storage_compensation or storage_cleanup. No database messages, request identifiers, UUIDs, emails, tokens, image data or object paths are logged. `UPDATE_FAILED` is now reserved for actual metadata UPDATE/COMMIT failures; readback and response failures have separate bounded codes.

## Browser reconciliation, dirty state and reload

R5R3 already clears the selected file/data/candidate on a validated committed response, recomputes content dirty state independently, and catches local reconciliation errors while displaying that the logo was saved. Those behaviors are retained and exercised without changing the profile layout. A confirmed logo-only upload can immediately leave the profile without a Save/Discard dialog. Independent profile edits remain dirty. A later ordinary profile PUT updates canonical fields only, preserves all six logo columns and retains Brand DNA/accepted Avatar/forward-compatible fields.

The affected Brand is patched in the existing in-memory Workspace and Brand catalogs. No unfiltered Catalog GET was added. Reconciliation now preserves a newer canonical revision and newer logo revision when an older confirmation arrives. Other Brands retain their values. Existing request/account/context guards remain in force.

The Brand serializer and Workspace server projection normalize pg logo revisions safely. Invalid optional display metadata falls back to no-logo initials without blocking unrelated canonical profile operations; the logo mutation readback remains strict. Fresh authorized Brand detail and catalog reads restore the same-origin `/api/brands/:id/logo?revision=N` URL. GET validates authorization and revision before serving private bytes. No public Storage URL or browser bucket access is introduced. The existing shared renderer continues to serve Overview, Assets, Sidebar and Brand selection, including initials on image errors and its generation guard against stale image errors. DNA and Avatar remain distinct.

## Tests and why previous checks missed it

The old persistent fake accepted any matching Brand SELECT and returned numeric logo revisions. It modeled neither PostgreSQL's nullable outer-join locking rule nor the BIGINT wire representation. Passing R5R3 therefore did not prove that its SQL was executable on PostgreSQL. The improved fake rejects the exact invalid lock with SQLSTATE `0A000`, verifies parameter presence and models transactional persistence/rollback plus private Storage. The focused check restores R5R3's lock clause and error classifier to reproduce its HTTP 500 / `UPDATE_FAILED`, then executes the repaired production handler with `{ rows: [...] }` and string `"0"` / `"1"` revisions to prove HTTP 200.

`check:bw36.13r5r4` covers strict/nullable metadata, signed authentication and owner/admin/editor/viewer/unrelated access, JSON upload via real production handlers/Chromium, private Storage adapter, exact migrated update columns and revision predicates, authoritative readback, authenticated GET, reload projections, stale updates, zero-row writes, failed UPDATE/readback/COMMIT, failed replacement/removal, Storage upload/compensation failure, committed response failure, old-object cleanup order, local browser reconciliation failure, dirty clearing and subsequent profile save. The older R4 boundary fake now includes the actual persisted nullable source host and update timestamp; its Storage-outage assertion expects 503 / STORAGE_UNAVAILABLE instead of the old misclassified 500 / UPDATE_FAILED. No access, persistence or dirty assertions are weakened. The reusable production DOM browser journey adds direct leave after upload and replacement/stale reconciliation checks, while retaining full reload, Overview/Sidebar/selection display, image fallback, separate accepted Avatar/DNA, light/dark, narrow widths, keyboard/reflow and forced-color coverage. All database/provider/AI/Storage I/O is fake; real service calls are forbidden.

Required checks: R5R4, R5R3, R5R2, R5, BW-36.12, browser script integrity, changed JavaScript syntax and `git diff --check`. `npm run check:bw36.13r5r1` was attempted and reports `Missing script: "check:bw36.13r5r1"`; no such script/file exists on fetched main (also recorded by R5R2/R5R3). No misleading alias or fabricated pass is added. Full Runtime Boot Safety is executed once against the final commit using every checked-in workflow test command; dependency-install steps are setup, with existing Chromium/Playwright used locally. Delivery reports its final result separately.

## Deployment, rollback and manual production acceptance

Migration/SQL: **none**. The existing BW-36.12 migration is unchanged; do not rerun BW-36.8 or BW-36.12. No manual SQL or environment change is required. Merge/deployment are left to the reviewer. Deploy the reviewed application commit through the existing Vercel workflow; existing private bucket and server credentials remain required.

For rollback, redeploy the previous reviewed application commit; do not roll back the migration, delete the bucket or rewrite stored metadata. The fix uses the existing schema and object naming, so persisted logos remain compatible. The earlier commit still contains the identified upload SQL defect.

After deployment, an authorized owner/admin/editor should select and upload a valid PNG, verify HTTP 200 / `brand_logo_v1` and in-app save feedback, immediately navigate away without a logo-only leave dialog, fully refresh, and verify Overview/Assets/Sidebar/Brand selection. Repeat with JPEG/WebP/GIF, replace a logo, check that the new image remains after refresh and the old object is removed only after commit, and verify initials fallback on an image error. Save ordinary profile edits afterward and ensure the logo, DNA and accepted Avatar persist. Confirm viewer denial and a stale revision's 409. Use authorized server inspection to verify private metadata/object persistence without exposing object URLs, credentials or identities. Check bounded stage diagnostics against the original request in the authorized logging system. This manual production acceptance remains outstanding; local fixtures are not proof of deployment or a production re-test.

## Changed files

- `.github/workflows/runtime-boot-safety.yml`
- `api/_brand-logo-storage.js`
- `api/_brand-logo.js`
- `api/_brands-storage.js`
- `api/_workspace-catalog.js`
- `api/brands/[id]/logo.js`
- `app.js`
- `package.json`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-13r5r3-durable-brand-logo-and-readiness.js`
- `scripts/check-bw36-13r5r4-brand-logo-persistence.js`
- `scripts/fixtures/bw36-13r5-local-runtime.js`
- `docs/implementations/bw36-13r5r4-brand-logo-persistence.md`
