# BW-35.4R2 — Export naming and Tendra One branding

## Naming and ownership
Export Review owns one ephemeral filename base for its lifetime. The automatic precedence is the authoritative Canonical Brand display name plus Board/campaign display name, Board only, Brand only, then `posting-plan`; the user's local `YYYY-MM-DD` follows. Adjacent duplicate identity is removed, including a campaign beginning with its Brand. Examples for 25 September 2026 are `posting-plan-saudebrasil-demo-2026-09-25` and the fallback `posting-plan-2026-09-25`. IDs and node/provider material are never candidates.

The suggestion initializes once. Format, inclusion, preview rerenders, Auto-plan return, and recoverable errors retain it. An authoritative name refresh updates it only while automatic management remains active. Typing creates a manual override; **Use suggested name** / **Vorgeschlagenen Namen verwenden** returns to automatic management. Board/lifecycle change, access loss, reset, close, and unmount clear the session. The value is not written to a Board, node, database, storage, analytics, or diagnostics.

## Sanitization and extensions
One pure sanitizer serves CSV and PDF. It trims whitespace and control characters, removes path and common-filesystem metacharacters, bounds the base to 120 characters, removes terminal dots and `.csv`/`.pdf` suffix chains, collapses whitespace/separators, rejects dot paths and Windows device names, and preserves safe human-readable Unicode and emoji. Invalid/empty input visibly resolves to deterministic `posting-plan` (or the current safe suggestion) with localized feedback. The exact resolved base remains visible. The non-editable suffix tracks the selected format; creation applies exactly one extension.

CSV still creates the unchanged CSV v1 BOM/RFC 4180/formula-protected payload in one browser Blob/object URL/anchor cycle and uses `{confirmed-base}.csv`. No request occurs.

For PDF, browser print APIs cannot force a saved filename. Immediately before the single print call the document title becomes the confirmed extension-free base, which commonly supplies the print dialog suggestion. Idempotent `afterprint`, bounded fallback, exception, explicit cleanup, Board switch, and unmount paths restore the prior title and remove the print root. Users must confirm the name in the print dialog where necessary.

## Document branding and hierarchy
Both preview and print use `/assets/brand/tendra-one-symbol.svg`, the repository-owned symbol used by Tendra One. It keeps its SVG geometry through `object-fit: contain`; image failure reveals restrained `Tendra One` text and never blocks printing. The cover hierarchy is the modest Tendra One identity, **Posting Plan** / **Posting-Plan**, prominent Board/campaign name, and a smaller Brand label only when normalization shows it adds meaning, followed by range, generated date, timezone, and metrics.

A compact, non-overlapping document-end signature uses the same symbol and the stable phrase **Created with Tendra One**. A flow footer was chosen over unreliable browser fixed-page behavior, preventing content overlap and blank trailing pages. No public canonical product URL is defined for this surface, so no URL, tagline, CTA, or tracking parameter is invented. Page numbering is intentionally omitted.

## Accessibility and responsive behavior
The explicit filename label, single announced extension, associated helper/status, keyboard reset, 44px controls, focus-within treatment, polite validation, image alternatives, hidden decorative footer logo, forced-color rules, existing reduced-motion behavior, mobile stacking, safe-area sticky footer, and wrapping/overflow constraints support mobile and 200% zoom. Application preview remains theme-aware while print stays light and high contrast.

## Privacy and lifecycle
Creation revalidates current Board identity, view access, lifecycle generation, unscheduled choice, and safe filename while duplicate actions are locked. Only explicit Brand/Board display names, local date, and user input enter naming. No email, account/Board/node/destination/provider ID, token, fingerprint, revision, publication, or diagnostic value is used. There is zero export storage, provider request, schedule/approval/publication mutation, or real social-media action.

## Deployment and rollback
Deploy `posting-plan-export.js`, `posting-plan-pdf.js`, `content-workspace.js`, `app.js`, `styles.css`, the existing SVG asset, registration/check, and documentation together. There is no migration, dependency, environment variable, server endpoint, or provider permission. Roll back this R2 bundle together; BW-35.4 CSV v1 and BW-35.4R1 print architecture remain data-compatible.

## Manual acceptance
1. Open a named Brand and campaign Board; open **Export plan** and verify the meaningful suggestion.
2. Edit it, switch CSV/PDF, change inclusion, and verify it remains; download CSV and verify the exact single-extension name and unchanged data.
3. Reopen, choose PDF, and verify the real logo, prominent campaign, one meaningful Brand label, and compact signature.
4. Create PDF; where supported verify the dialog suggestion, save/open it, and inspect logo/footer, overlap, trailing pages, selectable content, and visual priority.
5. Repeat with Board-only, duplicate Brand/campaign, unsafe/empty/long input, German, mobile, forced colors, and 200% zoom.
6. Confirm the Network panel shows no export/provider request and no schedule, approval, publication, or social mutation.

## Non-goals
No provider scheduling/publication, remote/server PDF or CSV generation/storage, persistence/migration, recurrence or queue, CSV contract or Auto-plan change, external logo/CDN, invented URL/tagline, mandatory page counters, extra confirmation dialog, or global responsive redesign.
