# BW-18 Board access audit and authorization contract

## Pre-implementation audit

The runtime schema created `board_editors(board_id, email, role, created_at, created_by, name, avatar)`, enforced lowercase email, a role limited to `editor`, a unique `(board_id,email)` index, and email/board lookup indexes. Initialization was promise-coalesced and retryable. Board access resolved `owner`, `editor`, `unowned`, `non_owner`, and `anonymous_shared`; owner and editor identity came from Board columns and membership rows respectively. Owners alone managed invitations, rename, and delete; owners, editors, and authenticated legacy-unowned claimants edited Canvas and the Board snapshot. The invitation API only upserted/removes editors.

The collection query included owned, editor, and unowned Boards and returned identity and derived Brand display metadata. The item GET returned nearly every Board column to every direct-link caller, including owner identity, Brand association, snapshot, provenance, and recovery state. Consequently owner, editor, authenticated unrelated, anonymous direct-link, and legacy-unowned callers received the same item fields; only the `access` role/capabilities differed. Owners/editors/unowned received write capability, while unrelated and anonymous users were read-only. Presence did not first resolve Board access and returned identity-bearing entries. Canonical Brand routes were independently owner-scoped.

The browser already guarded Canvas mutations, manual save, autosave, document writes, association, comparison/initialization, refresh/restore, rename, and delete primarily through server-provided `canEdit`/owner capabilities. It rendered owner/editor/open roles in the Board library and had an owner-only editor manager. Direct URLs remained transitionally readable. A missing snapshot fell back to a default Brand Core, and public responses could therefore confuse hidden Brand data with an unbranded Board. Existing BW checks cover ownership/editor writes, Brand isolation, comparison, provenance/recovery, autosave, and runtime boot, but had no viewer/redaction contract.

## Authorization matrix after BW-18

| Caller | Direct Canvas | Writes | Board Brand Core | Canonical Brand | Members/presence identities | Collection |
|---|---|---|---|---|---|---|
| Owner | read | full existing owner policy | read/write | separately owner-scoped | manage/read | full owned row |
| Editor | read | Canvas/snapshot under existing editor policy | read/write | no derived access | presence only | invited row |
| Viewer | read | none | omitted | none | viewing presence only | invited, Brand-redacted row |
| Authenticated unrelated | transitional public read | none | omitted | none | none | not included |
| Anonymous | transitional public read | none | omitted | none | none | none |
| Authenticated legacy-unowned | read/write and claim, preserved | existing legacy policy | read/write | separately scoped | presence | unowned row |

## Implemented contracts

The membership role constraint now accepts exactly `editor` and `viewer`; existing rows are untouched and the unique normalized-email membership remains. Runtime reconciliation replaces only the old check constraint, idempotently; versioned migration hardening remains separate.

`getBoardAccess` is authoritative. It returns `role`, `canRead`, `canView`, `canEdit`, `canViewBoardBrandCore`, member-management, rename/delete, association, refresh/restore, and presence capabilities. Ownership derives only from Board owner fields; membership derives only from the normalized email row.

The centralized item serializer emits the full authorized Board contract to owner/editor/unowned callers. Viewer, unrelated, and anonymous callers receive only id, name, sanitized Canvas payload, safe timestamps, access, and `brand_visibility: hidden`. It omits snapshot, Brand ID, provenance/recovery, owner identity, members, and diagnostics. `hidden` is distinct from `unbranded`.

Presence resolves Board access before reads/writes. Owner/editor/viewer/unowned authenticated callers may use current presence; unrelated and anonymous callers receive an empty identity-safe result and cannot write an identity entry.

BW-19 sharing tokens, visibility controls, Workspace/Brand membership, Brand roles, and invitation delivery are intentionally not implemented.
