# BW-13 pre-implementation audit and design

## Confirmed baseline

The `boards` runtime schema had nullable `brand_core_snapshot`, `brand_id`, and BW-12's source revision, source update time, and copy time. `BOARD_COLUMNS` and item/create serializers return the complete saved snapshot and normalized numeric revision; library serialization strips the snapshot and returns only display data. Item GET uses `getBoardAccess`; PUT requires `canEdit`, writes canvas and the saved Core, and optionally checks `lastKnownUpdatedAt`; association PATCH requires authentication, `canEdit`, and owner-scoped Canonical access, changes only `brand_id`, clears provenance, and updates `updated_at`.

Board roles are owner, editor, unowned, non-owner, and anonymous-shared. Owners and editors (and the legacy authenticated unowned case) can edit, while rename/delete/permission capabilities remain owner-specific. `getOwnedBrand` independently scopes Canonical reads by normalized session email. Canonical PUT increments `revision` with an expected-revision predicate. Board PUT compares timestamps before writing, although BW-13 needs a locked recheck.

Snapshot writes occur at Board POST (client snapshot for unbranded creation or authoritative Canonical snapshot for Brand-backed creation), ordinary Board PUT, and browser hydration only. Brand association changes occur only in Board POST and the explicit item association PATCH. Brand-backed creation supplies BW-12 provenance; ordinary edits retain it; association changes clear it. Existing transaction code uses `pool.connect()`, `BEGIN`, `COMMIT`, rollback, and release where atomic multi-record behavior is required.

BW-8 owns a modal lifecycle with comparison/load generations, account/Board/Brand/catalog guards, abort controllers, timeouts, safe DOM text, and last-saved `authoritativeBoardBrandCore` rather than mutable editor state. BW-12 renders normalized provenance there. Autosave is timer-based, dirty-aware, guarded during hydration/saves, and Board loads advance `boardLoadGeneration`. Vercel already uses `api/boards/[id].js` plus deeper editor routes; adding another nested dynamic action would increase filesystem-routing risk. Existing focused checks cover BW-1 through BW-12.

## Smallest safe design

Extend `PATCH /api/boards/:id` with a mandatory, strict `operation` discriminator. Keep the existing one-field association PATCH contract distinct. Refresh accepts exactly `operation`, `brand_id`, `canonical_revision`, and `board_updated_at`; restore accepts exactly `operation` and `board_updated_at`. The server accepts no Core, provenance, backup, ownership, or Workspace content.

Add five nullable columns for exactly one recovery value and its prior provenance plus creation time. Runtime `ADD COLUMN IF NOT EXISTS` and a retry-safe positive-revision constraint require no backfill or manual repair. Item responses expose only restore availability and backup creation time; list responses never select or serialize recovery JSON.

Both operations use one transaction and a locked Board row. Refresh independently rechecks Board edit access, association, Board timestamp, Canonical ownership/revision/Core, then stores the old snapshot/provenance and replaces it from the authoritative Canonical row. Restore atomically swaps current and backup values. Association changes clear the entire recovery slot without changing the current snapshot. Conflicts return 409 without writes; uncertain browser outcomes require an authoritative reload and are never retried automatically.
