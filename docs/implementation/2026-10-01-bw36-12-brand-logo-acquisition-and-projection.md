# BW-36.12 — Brand logo acquisition and projection

## Verified prior behavior

Brands had no dedicated durable logo authority. Workspace catalog Brand rows emitted a permanently null `avatar_url`; compact identity surfaces used initials, while Board Brand Core could independently display an approved generated personality avatar. The existing upload endpoint returned a public blob URL without binding it to a Brand, authorization, concurrency, or cleanup. Domain analysis guessed the first logo-like asset and embedded its URL in Brand Core. Those paths were not reused as the new authority.

## Durable authority and schema

The reusable `brands` row now owns `logo_object_path`, raster MIME, `uploaded|discovered` source, monotonic `logo_revision`, update time, and a bounded source hostname. Logo data is not placed in Brand Core or a Campaign snapshot. Existing rows remain valid and show Unicode-safe initials. **Manual Supabase execution of `migrations/20261001_bw36_12_brand_logo.sql` is required after merge and before deploying the code.** No fake-logo backfill occurs.

Supabase Storage is the sole Brand-logo object store. The dedicated `brand-logos` bucket is private, limited to the four accepted raster MIME types and 2 MiB objects, and has no browser upload/read/update/delete grant. Its deterministic `Brand UUID/revision.extension` object key is server-only. Product surfaces receive only the same-origin `/api/brands/:id/logo?revision=N` URL. The read boundary independently checks Brand visibility and validates the owned raster before returning it with MIME, `nosniff`, and revision-aware immutable caching. No Vercel Blob account, package, token, or configuration is required.

## Discovery and fetch safety

Candidate order is Organization JSON-LD, explicit logo metadata, manifest references, Apple touch icons, then explicit icons and a same-origin favicon fallback. Open Graph/social, hero, screenshot, and arbitrary content images are excluded. Candidate failure is bounded and does not fail website knowledge analysis.

All retrieval is server-side. URLs require HTTPS, forbid credentials/nonstandard ports, revalidate every redirect and resolved IPv4/IPv6 address, limit redirects/time/body size, and send no cookies, browser credentials, or provider credentials. Accepted PNG, JPEG, WebP, and GIF files must match their signature and remain within 2 MiB and 16–4096 pixels per side. SVG is rejected because the repository has no trusted SVG sanitizer. No proxy, CDN logo helper, or third-party logo API is used.

## Mutation lifecycle and authorization

The single authenticated Brand-logo mutation verifies existing Brand owner/admin/editor authority; Board ownership never grants Brand permission. An optional Workspace relationship assertion requires an accepted active application identity membership. `expected_revision` provides optimistic concurrency. Upload/discovery writes the new owned object first, updates metadata in the locked transaction, deletes the new object on database failure, commits atomically, and only then removes the replaced object. Discovery refuses to replace `uploaded`; remove clears only logo columns and advances the logo revision.

The UI provides an accessible file input, 44px controls, contained transparent preview, upload/change, website discovery when domain knowledge exists, and confirmed removal. Viewers get the preview without controls. English and German status/action copy covers empty, progress, file errors, discovery/update failure, stale update, and permission denial. Dialog ownership and existing Escape/focus restoration remain with the body-owned Brand Profile dialog.

## Projection and lifecycle

One `FunklixBrandLogo` renderer supplies same-origin validation, Unicode initials, contained aspect ratio, and broken-image fallback. It is used by Workspace Brand rows/options and the shared sidebar identity; the Brand Profile editor uses it at the larger size. The current authorized association therefore also projects into the Board Brand Core/sidebar header without modifying snapshot knowledge. Catalog responses strictly expose only `logo_url` and `logo_revision` for independently authorized Brand rows.

Successful mutation patches the in-memory Workspace catalog and rerenders visible identity surfaces without navigation or unrelated refetches. Existing catalog generation and account-change teardown discards stale requests/state. Logo actions perform no AI/provider, publication, scheduling, social, Board, Brand Core, or snapshot mutation.

## Deployment and rollback

After this pull request is merged, run the corrected additive migration in Supabase. Deploy the application only after that migration succeeds. The server uses the existing `POSTGRES_URL` convention to derive the Supabase project origin when possible; server-only `SUPABASE_URL` may provide it explicitly, and `SUPABASE_SERVICE_ROLE_KEY` performs private Storage operations. Neither value is exposed to browser code.

Rollback application code first. If the private bucket is empty, it may then be removed; otherwise retain or deliberately archive its objects before removal. Only afterward may the six metadata columns be dropped. The additive columns and an empty private bucket are harmless to the preceding release; do not remove either while the new API is live.

## Minimal manual browser acceptance

1. As a Brand editor, open Brand Profile at desktop, 74px rail, mobile width, dark/light, forced colors, and 200% zoom.
2. Upload a transparent PNG; confirm sidebar/profile update without reload and preserve aspect ratio.
3. Replace it, reload, and confirm the revision URL changes. Trigger a stale request from a second tab.
4. Discover from an HTTPS Brand website; confirm an uploaded logo is never replaced.
5. Break the image response and confirm initials; remove with confirmation and confirm initials everywhere.
6. Verify a viewer sees the logo but no controls, a Board-only collaborator gains no Brand mutation, public Board tokens gain no catalog data, and keyboard focus/Escape behavior remains intact.

## Explicit boundaries

Zero external browser hotlinks; zero third-party logo services; zero cross-Workspace visibility expansion; zero Board-only collaborator promotion; zero public-token catalog expansion; zero Brand Core/snapshot mutation; zero provider/publication/scheduling/social mutation; and no logo bytes, names, domains, UUIDs, emails, filenames, signed URLs, or raw database errors in diagnostics.
