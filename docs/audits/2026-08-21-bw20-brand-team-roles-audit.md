# BW-20 pre-implementation authorization audit

This audit was completed before BW-20 implementation. It records the owner-only assumptions that the package replaces. Formal versioned database migrations remain separate hardening work; this repository currently performs additive, retry-safe runtime schema reconciliation.

## Canonical Brands

- `brands` is runtime-created with UUID `id`, normalized `owner_email`, `name`, JSONB `brand_core`, optimistic `revision`, and timestamps. Ownership is exclusively the normalized session email matched to `brands.owner_email`.
- `_brand-access.js` exposes only `getOwnedBrand`; its query requires both Brand id and owner email. The collection likewise filters `brands.owner_email`, while item GET and PUT are owner-only (PUT additionally matches `revision`). These are every Brand-access SQL use of `owner_email` before BW-20. Board refresh contains a fourth direct owner-only Canonical query.
- Collection summaries omit `brand_core`. The browser catalog accepts only those summaries, scopes its persisted Workspace selection by normalized account email, validates restoration against the loaded catalog, and clears catalog/detail state on account change or sign-out.
- Canonical detail is fetched only for the selected catalog entry. Editing is explicit, optimistic, abortable, generation-checked, preserves the draft on conflict, and revalidates account, selected Brand, dialog lifecycle, and request/save ids before applying a response.

## Boards and sharing

- `_board-access.js` composes Board owner/unowned access with one `board_editors` row (`editor` or `viewer`). Owners and editors can write; viewers are Canvas-only; only owners manage members, permissions, rename, delete, and public sharing.
- The Board collection predicate includes owned, Board-member, and legacy unowned Boards. Brand scope first proves owner access to the Canonical Brand. Rows are de-duplicated by the one-row Board membership constraint and ordered by ownership, membership, order index, and update time.
- Board item GET uses the same access helper. Board viewers receive sanitized Canvas without Brand association/Core; public viewers require a valid revocable token and receive the same narrow Canvas surface without presence. Public tokens never affect the library.
- Brand-backed creation, target association, Canonical comparison/detail, and Canonical-to-Board refresh all call an owner-only Brand lookup. Refresh also independently requires Board owner/editor/unowned write access and concurrency/provenance checks. Restore requires Board write access. Board-to-empty-Canonical initialization is driven by the existing explicit client eligibility lifecycle and owner-only Canonical PUT.
- Board-specific memberships live in `board_editors`, are unique per Board/email, normalize email, allow exactly editor/viewer, and are managed only by the Board owner. The permissions popover has explicit open/close listener lifecycle; BW-19 sharing remains owner-controlled and private by default.

## Browser lifecycle and Runtime Boot Safety

- Workspace selection is an account-scoped preference, never an authorization claim. Account change/sign-out aborts and invalidates catalog, Canonical detail, comparison, association, Board load, and autosave state. Board capabilities returned by the server drive read-only rendering and protected Brand Core clearing.
- Runtime Boot Safety runs syntax and browser integrity, BW-1 through BW-13, Canonical foundation, BW-15, BW-16, BW-18 access and popover checks, BW-19 private/public checks, and knowledge-module browser globals. BW-20 is registered immediately after BW-19.

## Authorization map before BW-20

| Actor | Canonical Brand | Associated Board |
| --- | --- | --- |
| Brand owner | read/write, create/associate/compare/refresh | only if separately Board owner/editor, except Brand-backed creation |
| Unrelated authenticated user | non-disclosing not found | denied unless Board is legacy-unowned |
| Board owner who does not own Brand | no Canonical access | full Board ownership; cannot use owner-only Canonical actions |
| Board editor who does not own Brand | no Canonical access | invited Board Canvas and Board Brand Core read/write only |
| Board viewer | no Canonical access | invited Board Canvas only |
| Public viewer | no Canonical access | token-authorized sanitized Canvas only |

The owner-only assumptions above were fully identified before implementation: Brand helper, collection, item GET/PUT, Brand-scoped Board listing, Brand-backed Board creation, target association, comparison through Canonical detail, and refresh's direct transaction query.
