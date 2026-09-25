# BW-35.4 — Posting Plan preview and CSV export

> **PDF extension:** BW-35.4R1 adds a presentation-ready, browser-native Posting Plan PDF preview and print workflow while preserving this CSV v1 contract. See [BW-35.4R1 Posting Plan PDF export](./bw35-4r1-posting-plan-pdf-export.md).

## User flow and scope

The unified Content Calendar keeps **Auto-plan** primary and places **Export plan** beside it. Export opens a dedicated review studio; it never downloads immediately. Its compact summary and content-first cards cover every exact `Social Media Posting` node in the current authoritative Board, independent of Calendar filters. Cards retain complete plain-text captions, paragraphs, channel visuals, schedule, approval/readiness/publication state, safe destination/link indicators, and the existing safe-media preview/fallback. Non-post nodes and unavailable material remain counted with a bounded reason rather than disappearing.

Authenticated Board members with current `canView` access (owner, editor, viewer, and corresponding authorized Brand roles) may export. Public-token viewers and users without an authenticated account/current Board are denied. This follows the audit's read-operation recommendation; the check is repeated from current authority immediately before Blob creation. Export does not grant edit rights.

## Unscheduled decision and Auto-plan handoff

When exportable posts are unscheduled, Download stays disabled until the session records **Include without dates**. Included unscheduled rows use `planning_status=unscheduled` and empty date, time, timezone, and DST fields—never defaults or the export date. **Review in Calendar** closes the studio, retains the current view/preferences, selects the unscheduled filter, and focuses the backlog. **Auto-plan posts** hands off to the existing deterministic studio without applying anything. A successful atomic Apply returns to a newly projected Export Review; cancel remains non-mutating. Export cancellation clears only its bounded session.

## CSV v1 contract

The pure `posting-plan-export.js` projection exposes this fixed, locale-neutral order:

`title`, `caption`, `channel`, `planning_status`, `scheduled_date`, `scheduled_time`, `timezone`, `dst_disambiguation`, `approval_status`, `readiness_status`, `publication_status`, `destination_label`, `content_link`, `media_count`, `media_url`.

Scheduled rows sort chronologically with stable identity tie-breaking, unscheduled rows retain Board order, and finalized rows follow afterward in Board order. Canonical `planningSchedule` is the only temporal source: malformed/legacy scheduling data is left unscheduled rather than guessed. Finalized posts are read-only export rows. Internal Board/node/provider/publication identifiers, fingerprints, revisions, notes, payloads, credentials, and full image records are never columns.

Serialization is deterministic RFC 4180-compatible UTF-8 with BOM, comma delimiter, CRLF records, doubled quotes, and preserved caption line breaks. A leading apostrophe neutralizes any text whose first meaningful character is `=`, `+`, `-`, or `@`, and any tab/CR/LF prefix. The apostrophe is visible spreadsheet text and preserves the authored value without executing it.

## URL, media, privacy, and browser boundary

Only HTTPS URLs without credentials or credential/token-like query keys are emitted. Rejected links leave an empty cell and increment the review's bounded omission summary; they do not abort export. Media is neither fetched nor retried during projection or serialization. Destination output is a human-readable label only.

After explicit confirmation, the browser creates one `text/csv;charset=utf-8` Blob, one temporary object URL and anchor, activates it, then removes the anchor and revokes the URL. The filename is `posting-plan-{lowercase-safe-board-slug}-{local-YYYY-MM-DD}.csv`, with `board` fallback and bounded slug length. The local date affects only the filename. No CSV/caption is sent to an API, logged, or stored in local/session storage or the database.

## Lifecycle, accessibility, and responsive behavior

The session holds only Board/generation identity, the unscheduled decision, expanded-card identities, pending state, and bounded error. Every render/download re-projects immutable authority. Board switch, access/lifecycle change, reset, unmount, cancel, or successful activation clears the portal and session idempotently. Mobile locks body scrolling and uses an opaque full-screen `100dvh` studio with safe areas; tablet uses a proportional sheet and desktop a bounded right studio. Header/footer remain sticky and the body scrolls independently.

The studio provides semantic headings, a labelled summary, full icon labels, live status/help, keyboard actions, Escape, modal focus containment/restoration, visible focus inherited from Tendra One, 44px targets, forced-color handling, dark mode, reduced motion, wrapping, and usable 200% zoom behavior.

## Deployment and rollback

Deploy the browser module before `content-workspace.js`, styles, check, and documentation together; no migration, environment variable, endpoint, provider permission, or package is needed. Rollback removes the Export action/module/styles. Scheduling and stored `planningSchedule` data are unchanged.

## Manual acceptance

1. Open a Board containing scheduled and unscheduled posts and enter Content Calendar.
2. Open Export plan; compare complete counts, full captions, visuals, safe media, statuses, fields, and exclusions.
3. Choose Review in Calendar; verify the backlog is focused and schedules/view preferences are unchanged.
4. Reopen, choose Auto-plan, review and explicitly Apply; verify Export Review returns with authoritative dates.
5. With an unscheduled post, choose Include without dates, download, and open the file in a spreadsheet.
6. Verify paragraphs, commas, quotes, Unicode, emoji, hashtags, HTTPS URLs, canonical schedules, blank unscheduled temporal fields, formula-defense apostrophes, safe filename, and absence of internal/provider-sensitive fields.
7. Repeat in German, desktop/tablet/mobile, dark mode, forced colors, keyboard-only, and 200% zoom. Confirm Network records no export/server/provider request.

Automated invented fixtures cover the deterministic and security portions. A real browser and spreadsheet application remain required for visual, focus, downloaded-file, and Network-panel acceptance.

## Explicit non-goals

No provider scheduling/publication/API call, server-side generation/storage, database migration, recurrence or publishing queue, approval/publication/schedule mutation from Export Review, invented dates, PDF/XLSX, external CSV library, new framework/icon package, or change to Auto-plan persistence.
