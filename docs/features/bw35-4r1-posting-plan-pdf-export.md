# BW-35.4R1 — visual Posting Plan PDF export

## Architecture decision

The repository had no trusted PDF library satisfying selectable Unicode text, images, pagination, browser execution, and zero runtime requests. The extension therefore uses a dedicated semantic HTML print document, print CSS, `window.print()`, and the browser's **Save as PDF** destination. It adds no dependency, CDN, endpoint, headless server browser, low-level PDF writer, or rasterized page capture.

`posting-plan-pdf.js` is a pure document projector and renderer. It consumes the existing BW-35.4 allowlisted projection; preview and print use the same model and markup. The existing CSV projection, serializer, columns, download, and safety contract are unchanged.

## User flow and document structure

Export Review now owns a session-only CSV/PDF segmented selection. The unscheduled decision survives format switches and harmless rerenders. PDF selection shows a light A4-proportioned document on a neutral preview surface with Fit width and 100% controls. **Create PDF** / **PDF erstellen** honestly explains that the browser print dialog opens and that the user must select Save as PDF.

The document begins with the Tendra One mark, Posting Plan title, Board/campaign name, localized generated date and canonical planning range, plus totals for included, scheduled, unscheduled, finalized, and represented channels. Scheduled posts group under localized date headings in canonical chronological order. Explicitly included unscheduled posts and finalized posts receive separate sections. A bounded notes section reports aggregate excluded items and unsafe URL/media omissions without reproducing excluded content.

## Visual hierarchy and pagination

The client-facing light theme uses lavender brand treatment, dark readable typography, compact summary tiles, whitespace, restrained borders, and platform-colored card edges. Every card retains an icon and text channel label, full title, full plain-text caption with paragraph breaks, schedule/status badge, safe media or colored fallback, additional-media count, and quiet workflow metadata.

A4 portrait print rules set practical margins and exact color adjustment. Date headings stay with following content; ordinary cards avoid breaks; headings and metadata footers avoid isolation. Captions have orphan/widow hints and safe word wrapping. Long content can continue rather than forcing tiny typography or excessive whitespace. Images use a bounded 16:9-style surface, `object-fit: cover`, and a print maximum height. Section starts provide visible pagination cues without an empty trailing surface.

## Media, privacy, authorization, and lifecycle

Only the R9-selected media URL and BW-35.4 safe HTTPS content link enter the model. Credentialed URLs, unsafe protocols, and token-like query keys are rejected before PDF projection. Failed images reveal the fallback and never block printing; readiness resolves immediately with no images and otherwise on load/error or a 2.4-second bound, with no retry or proxy.

The document excludes Board/node/provider/publication IDs, fingerprints, revisions, credentials, cookies, image records, diagnostic references, and provider payloads. Text is escaped, remains selectable, and never executes arbitrary HTML. No content is logged or stored in local/session storage.

Create revalidates Board identity, current view authorization, lifecycle generation, authoritative rows, and the prior explicit unscheduled choice. One isolated `data-posting-plan-print-root` is appended without replacing application state. Print CSS excludes the application shell, portals, navigation, controls, and toasts. Duplicate clicks and roots are suppressed. `afterprint` and a 30-second fallback clear the root/body class idempotently; access failure or print failure retains a usable preview. There is no Board reload, provider/server request, or approval/schedule/publication mutation.

## Accessibility, responsive behavior, and localization

Preview markup has semantic headings, logical reading order, channel text, image alternatives, selectable captions, keyboard-operable radio/zoom controls, visible inherited focus, 44px targets, live status, forced-color boundaries, and reduced-motion handling. Desktop approximates A4; mobile reflows naturally to one column without horizontal overflow. Dark application mode continues around a consistently light shareable document. English and German cover format, action/help, structure, metadata, preparation/errors, and locale-aware dates while ISO schedule values remain authoritative internally.

## Performance, deployment, and rollback

Projection is local, deterministic, bounded, and recreated from the current authoritative snapshot only for review/creation. There are no per-post requests or mutable global caption copies. Deploy the new browser module before Content Workspace with the scoped CSS, integration, check registration, and documentation. No migration, environment variable, service, or provider permission is required. Rollback these R1 files/integration together; retain `posting-plan-export.js` and BW-35.4 CSV behavior.

## Manual acceptance

1. Open a Board containing scheduled, unscheduled, finalized, and media-bearing posts.
2. Open Export plan and explicitly resolve unscheduled posts.
3. Switch CSV/PDF repeatedly; confirm the choice persists and CSV remains unchanged.
4. Inspect desktop, narrow desktop, mobile, 200% zoom, dark application mode, forced colors, keyboard flow, channel icons/colors, captions/paragraphs, images/fallbacks, chronological dates, separate unscheduled/finalized sections, and notes.
5. Create PDF, choose Save as PDF, and inspect the first/content/unscheduled/long-caption pages. Confirm selectable Unicode, emoji, hashtags, wrapped URLs, page breaks, no clipping, and no application UI.
6. Close/cancel print and confirm Export Review remains usable with no duplicate root, hidden shell, body class, scroll lock, Board reload, or changed schedule.
7. Repeat in German and confirm the Network panel shows no PDF endpoint or provider request and the PDF has no internal/provider-sensitive values.

Automated checks verify deterministic DOM/CSS/security contracts. Final rendering, native print-dialog, saved-PDF, font/emoji, and pagination inspection still require supported desktop/mobile browsers.

## Non-goals

No provider scheduling or publication, remote/server PDF generation or storage, database change, recurrence/publishing queue, schedule/approval mutation, fabricated dates, CSV change, external CDN/framework, full-page raster export, or Auto-plan persistence change.

## BW-35.4R2 follow-up

BW-35.4R2 adds shared, user-confirmed CSV/PDF naming, temporary print-title filename suggestion, the repository-owned Tendra One symbol, meaningful Brand/campaign cover hierarchy, and the compact document signature. See [BW-35.4R2 export naming and Tendra One branding](./bw35-4r2-export-naming-and-branding.md); this R1 audit remains unchanged.
