# BW-36.13R5 — Brand lifecycle and persistence

## Scope and evidence

Based on `origin/main` at `8396457c35dd56e52231d924c52b5dcce2166321` (PR #749 merged). The reported screenshots show save/upload failures, missing Sidebar actions and a native discard prompt; screenshots alone cannot establish an HTTP status. The following statuses were reproduced locally with real handlers, access checks, serializers and browser controllers. External database, website/AI and private Storage I/O use fictional local adapters. No production database, AI provider or live Storage was contacted. Production credentials and deployed behavior remain unverified until deployment acceptance.

| Trigger | Reproduced before repair | Server wrote? | Root cause and repair |
| --- | --- | --- | --- |
| PUT `/api/brands/:id`, full edited/analyzed core | 500, generic `Failed to load Brand` | No | UPDATE used `$1,$3,$4,$5` while supplying an unused `$2`. A separate local PostgreSQL engine reproduction returned `42P18: could not determine data type of parameter $2`. Use dense `$1..$4` bindings and bounded errors. |
| PUT succeeds, then async `onSave` throws | HTTP 200; controller returned false and displayed save not confirmed | Yes | Network and projection shared a catch boundary. Validate response, mark confirmed state clean, then catch local reconciliation independently; return true with saved/refresh notice. |
| POST `/api/brands/:id/logo`, upload without service key | 500 `UPDATE_FAILED`; storage helper internally raised `STORAGE_UNAVAILABLE` | No | Handler obscured deployment failure. Return 503 `STORAGE_UNAVAILABLE`, retain file/preview and allow independent core save. |
| Logo response succeeds, `onLogo` throws | HTTP 200; controller treated projection as failed upload | Yes | Same catch-boundary defect. Confirm logo revision and URL before optional projection; retain success with refresh notice. |
| POST `/api/brands` | 409 `PROJECT_CREATION_REQUIRED` | No | Endpoint intentionally rejected standalone creation and Sidebar had no actions. Add validated workspace-bound `brand_creation_v1`, with stable UUID idempotency and no Board creation. |
| Sidebar delete | No request possible | No | Existing owner deletion was wired only to old switcher. Connect Sidebar to the same exact-name dialog and DELETE transaction. |
| Dirty close / advanced handoff / snapshot navigation | No request; native browser confirm | No | Native confirmation discarded local work. Replace with internal Save/Keep/explicit Discard decisions and preserve deferred optional files/suggestions in account-scoped memory. |

New-project creation/replay, real analysis and suggestion adoption, save/reload, manual and discovered logos, removal/retry, exact Board handoff and Sidebar create/select/delete are covered by `check:bw36.13r5` through real browser clicks and handlers. Existing Board data and Campaign snapshots are checked unchanged.

## Save and navigation boundary

PUT keeps optimistic concurrency: the existing revision is required and SQL updates only that revision. Full reusable `brand_core` is persisted, including manual and accepted analyzed fields, safe assets, extensions and a server-owned creation fingerprint. Never apply a newer server revision automatically after 409. Complete draft remains on request failure, invalid response or conflict; Reload latest is explicit.

Request, response validation, confirmed server state and local reconciliation are distinct. An acknowledged save updates the controller and authoritative detail before Sidebar/catalog/project projections. Projection errors report `Brand Profile saved. Refresh the view if the update is not visible everywhere yet.` and do not retry a successful server mutation. Immutable workspace summaries retain the catalog contract; the legacy catalog, project picker and logo/avatar share the acknowledged state.

The new-project primary action is **Save Brand Profile and continue** / **Markenprofil speichern und fortfahren**. It saves first, then reads and opens the already-created exact Board. Failed PUT stays in Profile with the same creation command and draft; no duplicate Board or Brand. Optional upload failures do not block this core save. Files, previews and unaccepted suggestions can be retained in RAM for the same account and Brand across Profile navigation, including project handoff; they are cleared on account reset and explicit discard/deletion. They are intentionally not serialized to persistent browser storage and do not survive a page reload.

All Brand lifecycle navigation uses an internal token-based modal: **Save changes before leaving?** / **Änderungen vor dem Verlassen speichern?**. Save and continue awaits confirmation; Keep editing and Escape retain work; Discard requires its own click. Focus trap/return, 44px actions, responsive layout, EN/DE, light/dark, forced colors and reduced motion are covered. Board-sharing confirmations outside this lifecycle are unchanged.

## Logo Storage and deployment

Continue using the existing private `brand-logos` bucket, revisioned `/api/brands/:id/logo`, existing MIME/size/signature/dimension checks, uploaded-logo precedence and same-origin private delivery. No browser Supabase access or alternative Storage. Confirmed logo writes survive subsequent rendering failures. Missing service configuration returns bounded 503 `STORAGE_UNAVAILABLE`; the UI says **Logo storage is temporarily unavailable. Your Brand information can still be saved.** (fully translated).

Felix must check Vercel **Production and Preview** separately:

- `SUPABASE_SERVICE_ROLE_KEY` is mandatory, server-side only. The existing bucket migration does not configure this secret. Never put it in frontend/public variables or print/request its value.
- `SUPABASE_URL` can continue to be derived safely only when `POSTGRES_URL` has the direct hostname `db.<project-ref>.supabase.co`. A pooler or custom database hostname requires an explicit HTTPS `SUPABASE_URL` for the correct project.
- Confirm `POSTGRES_URL`, signed-session configuration, the existing private bucket and server access use the intended environment/project. Redeploy after changing environment settings.
- Run the manual checklist below against the deployed Preview, then Production after a separately approved merge/deployment. This PR remains open and is never merged by this implementation task.

No secrets, provider responses, raw SQL errors, emails or IDs are emitted by the changed failure logs. Safe codes and translated messages are used.

## Creation, deletion and roles

Creation uses a signed session, resolves canonical `app_identities`, locks an active workspace and accepted membership, and requires Workspace owner/admin. The normalized name and stable client UUID are validated. A transaction-level advisory lock serializes retries, including cross-workspace ID races. Initial core comes from the existing project core factory. A SHA-256 original-input fingerprint is stored in existing JSONB `_creation` (no schema change) and protected by PUT; an identical retry returns the same Brand with `created:false`, including after later rename. Different input/owner/workspace for that ID conflicts. An ambiguous commit returns `OUTCOME_UNKNOWN`; retry retains the same UUID. No Board is created.

Sidebar creation inserts an immutable catalog summary, selects the Brand and immediately opens guided Profile without an extra catalog GET. Member/viewer, signed-out, stale or unauthorized contexts cannot create.

Only actual Brand owner can delete. Brand admin/editor/viewer and Board-only collaborators cannot. Sidebar delegates to existing `DELETE /api/brands/:id` and `_brand-deletion` transaction with exact-name confirmation. Board rows, Canvas, nodes, sharing and Campaign snapshots survive; live Brand associations become null. Confirmed deletion removes workspace/legacy/project projections, closes deleted Profile and selects the unique remaining Brand or null. Failure retains the Brand and confirmation UI.

One Sidebar portal surface is open at a time. Workspace/Brand menus mutually close, support outside click, Escape, keyboard focus and return, truncate long names and keep compact actions reachable without changing Canvas toolbar or the non-Canvas topbar.

## Bounded error contract

| Condition | Code / status | Behavior |
| --- | --- | --- |
| Missing signed session | `AUTHENTICATION_REQUIRED`, 401 | Sign in again |
| Missing identity or insufficient role | `IDENTITY_UNAVAILABLE` / `PERMISSION_DENIED`, 403 | No mutation; retained input |
| Removed Brand/workspace | `BRAND_NOT_FOUND` / `WORKSPACE_NOT_FOUND`, 404 | Context unavailable |
| Newer revision | `STALE_UPDATE`, 409 | Keep draft; explicit Reload latest |
| Reused creation ID with other input | `IDEMPOTENCY_CONFLICT`, 409 | No second Brand |
| Database unavailable / uncertain commit | `DATABASE_UNAVAILABLE` / `OUTCOME_UNKNOWN`, 503 | Retain input; same-ID retry |
| Invalid core/name/revision/creation | bounded validation codes, 400 / 422 | Correct input |
| Missing/unavailable Storage | `STORAGE_UNAVAILABLE`, 503 | Keep file; core save independent |
| Unsupported logo | `UNSUPPORTED_FILE`, 415 | Existing logo retained |
| Malformed successful response | client validation message | Not confirmed; retain complete draft |
| Confirmed save then local render failure | local saved/refresh notice | Saved remains confirmed |

Existing logo conflict, changed-candidate and uploaded-logo-priority codes remain authoritative. UI text never shows raw server/provider payloads.

## Verification

Focused `npm run check:bw36.13r5` executes real handlers/controllers and real `index.html`, `app.js`, `workspace-sidebar.js`, `brand-profile-setup.js` and CSS in Chromium. It rejects every native dialog with `page.on('dialog')`, routes all external I/O locally, verifies actual logo image decoding and asserts no live provider/production calls. It covers save/reload, deliberate post-save projection failure, full-draft PUT failures, optional logo retry after navigation, optimistic conflict, lost-create-response retries, roles, Sidebar creation/deletion, Board/snapshot survival and exact project handoff. Responsive checks cover 320,375,480,768,1024,1440 and a 720 CSS-pixel 200% reflow equivalent, both themes, EN/DE, forced colors and reduced motion. Reflow is a CSS viewport equivalent, not a claim of testing native browser zoom UI.

Required R4R1, R4, R3, BW36.12, workspace deletion, BW20 roles and browser integrity checks run as part of the complete Runtime Boot Safety workflow. Old assertions were narrowly adapted only for intentionally changed guards, dense SQL placeholders, bounded errors and standalone creation; historical behavioral checks remain. Every changed JavaScript file receives `node --check`, plus `git diff --check`. Full workflow result: **157/157 verification commands passed** locally; dependencies and system Chromium were provisioned before executing every workflow verification command. Final committed-version rerun and GitHub CI must be checked before reporting delivery.

## Migration and rollback

**No migration, no manual SQL, no new table, no changed bucket or database schema.** Creation metadata uses existing JSONB. Rollback by reverting this PR commit and redeploying the prior application version. Existing Boards and snapshots remain. Brands created by this version retain valid existing-schema records; do not delete them or run cleanup SQL. Reverting reintroduces the prior missing Sidebar actions and save defect, so prefer a forward fix where possible.

## Manual deployed acceptance — pending deployment

The following cannot be marked passed in Production while this PR remains open and unmerged. Automated local equivalents passed; Felix must record environment, deployment, role and outcome without secrets after deployment:

1. Open an existing Brand.
2. Analyze a public website.
3. Explicitly adopt suggestions.
4. Save the Brand Profile.
5. Reload and confirm saved values.
6. Upload a supported logo.
7. Reload and verify the logo in Profile and Sidebar.
8. Create a Brand from Sidebar as workspace owner/admin; ensure no Board created.
9. Switch Brands and confirm the selected context.
10. Delete the newly created Brand as its owner with exact-name confirmation.
11. Open an existing associated Board; confirm it survives unbranded with Canvas/sharing/snapshot intact.
12. Create a new project with an existing Brand.
13. Create a new project with a new Brand.
14. Save its Brand Profile; exercise save failure/retry and optional upload failure/retry.
15. Continue to exactly the Board created in step 13; confirm no duplicate Board/Brand.
16. Exercise dirty navigation: Keep/Escape, failed then successful Save and continue, explicit Discard. Verify retained optional file on reopen.
17. Check complete English and German text.
18. Check light and dark themes.
19. Check desktop/mobile, all six widths, keyboard/focus and 200% reflow. Confirm member/viewer cannot create and nonowner cannot delete.

## Exact changed files

- `.github/workflows/runtime-boot-safety.yml`
- `api/_brand-creation.js`
- `api/_brand-deletion.js`
- `api/brands/[id].js`
- `api/brands/[id]/logo.js`
- `api/brands/index.js`
- `app.js`
- `brand-profile-setup.css`
- `brand-profile-setup.js`
- `docs/implementations/bw36-13r5-brand-lifecycle-stability.md`
- `index.html`
- `language.js`
- `package.json`
- `project-dialog.js`
- `scripts/check-bw20-1-inline-brand-role-management.js`
- `scripts/check-bw36-11-workspace-renaming.js`
- `scripts/check-bw36-13r3-authoritative-project-creation.js`
- `scripts/check-bw36-13r3r1-workspace-catalog-repair.js`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js`
- `scripts/check-bw36-13r5-brand-lifecycle-stability.js`
- `scripts/check-bw7-canonical-brand-editing.js`
- `scripts/check-canonical-brand-foundation.js`
- `scripts/check-workspace-brand-deletion.js`
- `scripts/fixtures/bw36-13r5-local-runtime.js`
- `workspace-sidebar.css`
- `workspace-sidebar.js`
