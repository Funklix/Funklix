# BW-36.13R6: Brand Profile decisions and deletion UX

## Verified causes

- `createSession` initialized a sticky `dirty: !!options.website`, even when that website already matched the saved profile. App-level project continuation also read that sticky flag.
- `dirty()` treated analysis proposals, discovered logo candidates, unuploaded files and generated previews as saved-profile edits. Consequently an unchanged profile could ask to save after analysis or a confirmed profile save.
- The editable field defaults were added during opening but not consistently after save/discard, making comparisons depend on missing versus defaulted fields.
- `applyProposal` replaced only the local draft and immediately removed the comparison; there was no Keep current decision, local save/error/retry, or authoritative revision recovery.
- Empty profile fields were filled only when the entire profile was effectively empty, and required another manual save.
- Deletion required an exact-name input. The existing server already locks the owner-authorized Brand, checks project associations, and rolls back without deleting anything when associations exist. The client did not show this relationship block before submission and rendered the server block as plain text.
- The deletion dialog was inside the mobile-hidden sidebar. Chromium confirmed it had no visible layout at 480 px; opening now moves it to the document body.

## Resulting behavior

Supported, usable website suggestions fill empty confirmed fields in one revision-checked PUT with an authoritative readback. Individual empty asset details can be added without replacing existing colors or typography. Equal normalized values require no comparison or save. Other fields remain compact decisions showing the saved current value and website suggestion. Keep current dismisses only that comparison without a request; Use website suggestion saves only that decision against the current Brand revision and dismisses it after verification. Failures keep the comparison, selection and inline Retry. Stale revisions load the authorized latest Brand, rebase untouched draft fields and rebuild the comparison without retrying a write automatically. Manual edits to other fields are retained and are not included in a suggestion save. Decisions neither navigate nor refetch Workspace/Board surfaces.

Profile dirtiness compares a normalized editable draft with the confirmed baseline, including normalized website URLs and consistent inherited defaults. Reverting an edit clears it. Confirmed saves update the baseline immediately. Analysis suggestions and optional previews use the existing account-and-Brand memory cache, including failed choices/retry batches; the captured account context is copied rather than sharing a mutable caller object, retention checks that captured account, and account reset clears the cache. This is same-session retention, not persistence across a browser refresh. Genuine profile edits continue to use the internal Save/Keep/Discard dialog. Logo storage/delivery, DNA/Avatar generation and acceptance boundaries are unchanged.

Deletion captures the authorized row independently of the active Brand or Board. A boardless Brand shows its logo/initials, name, permanent-deletion explanation, Cancel and Delete Brand. The second deliberate click sends the captured name through the existing server contract; there is no typed-name input. A known project relationship immediately shows an assertive, token-styled block with singular/plural counts and View projects, and hides Delete. A concurrent `BRAND_IN_USE` response changes the same dialog into that block. View projects uses the existing Brand-scoped library. Existing owner authority, locked server transaction, successful catalog removal and safe selection fallback remain intact. No backend file changed.

## Exact changed files

Product:

- `brand-profile-setup.js`
- `brand-profile-setup.css`
- `app.js`
- `index.html`
- `language.js`

Validation and delivery:

- `scripts/check-bw36-13r6-brand-profile-decision-and-deletion-ux.js`
- `scripts/check-bw36-13r4-guided-brand-profile-setup.js`
- `scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js`
- `scripts/check-bw36-13r5-brand-lifecycle-stability.js`
- `scripts/check-bw36-13r5r2-brand-workspace-regression-recovery.js`
- `scripts/check-bw36-13r5r3-durable-brand-logo-and-readiness.js`
- `scripts/check-bw36-13r5r4-brand-logo-persistence.js`
- `scripts/check-workspace-brand-deletion.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `docs/implementations/bw36-13r6-brand-profile-decision-and-deletion-ux.md`

## Historical test changes, individually

1. **R4:** expect one automatic save and its readback after analysis, then a separate explicit profile save; conflict acceptance now awaits its own confirmed save. Unknown-data and separate logo-boundary assertions remain.
2. **R4R1:** website suggestions no longer require Discard when opening Campaign Brand Snapshot; assert no leave dialog, then verify the snapshot view. Existing snapshot/legacy-logo protections remain.
3. **R5:** await automatic analysis saves and each asynchronous conflict decision; expect clean navigation after profile save and account-memory retention for an optional file; remove typed-name interactions and assert immediate project blocking. The fixture now replaces frozen catalog projections immutably when deliberately changing known project associations, so the new client-side check receives the intended input. Server, project replay, creation, role and snapshot assertions remain.
4. **R5R2:** generated previews/unuploaded files are retained proposals rather than profile dirtiness; assert the target name in the deletion title, delete without typing, and check an immediate singular project block. All storage/DNA/Avatar round-trip assertions remain.
5. **R5R3:** an unuploaded logo preview does not make the profile dirty; storage compensation, upload recovery and baseline/concurrent-edit tests remain.
6. **R5R4:** an unuploaded preview is clean; confirmed upload, authoritative reconciliation and logo revision/storage tests remain.
7. **Brand deletion:** replace the obsolete technical/cascade copy assertion with no typed input and the permanent Brand Profile explanation. All owner, relationship, transaction and fallback contracts remain.

The historical BW-36.6 immutable stylesheet assertion is unchanged; scoped dialog styles live in `brand-profile-setup.css`.

## Validation

The new R6 check uses real production controllers, routes, serializers, HTML, app, profile modules and CSS with external I/O replaced by bounded fixtures. Chromium tests actual clicks, native-dialog absence, Tab wrapping, Escape, focus restoration, local saving/error/selection/Retry, session retention, own-row targeting, immediate and concurrent deletion blocks, Brand-scoped project navigation, and unauthorized roles.

Coverage includes all requested areas: unchanged open/leave; saved website/logo/DNA/avatar; real manual edit and confirmed baseline; one and multiple empty fields in exactly one save; equal/conflicting/unknown suggestions; Keep/Use; failed and stale saves; unresolved retention and account reset; non-active boardless deletion; singular/plural/concurrent project blocks; roles and target identity; native-dialog absence; keyboard; both themes at 1440/1024/768/480/375/320 px; 720x450 reflow equivalent to a 1440x900 viewport at 200%; selector, asset, Board and Project regressions; and no real provider/AI/storage/database calls.

Result: **161/161 Runtime Boot Safety commands passed on the final implementation.**

Executed: the complete Runtime Boot Safety workflow command set (including R6), BW-36.12 separately, syntax checks for every changed JavaScript file, and `git diff --check`. The workflow includes R4/R4R1/R5/R5R2/R5R3/R5R4, Brand deletion, Brand team roles, inline roles, Browser-script integrity, and Board/Project creation checks. Browser layout assertions were performed in Chromium; no manual visual acceptance or deployed-production testing is claimed.

Migration/SQL: **none**. No schema or server-side deletion-rule changes.

## Manual acceptance after deployment

Use authorized test Brands; use a disposable boardless Brand for deletion.

1. Open an existing saved Brand, including website/logo/accepted DNA/avatar, then leave without editing. Expect no internal or native save warning and no mutation.
2. Analyze its website with several empty supported fields. Expect one saved batch, an accurate additions message, and persistence after reopening.
3. Analyze with conflicting saved values. Expect the current value, website suggestion, field label and both clear choices.
4. Choose Keep current. Expect only that comparison to disappear and no save; other conflicts remain. Leave/reopen in the same account and confirm unresolved suggestions remain.
5. Choose Use website suggestion. Expect local saving, disappearance only after success, and the saved value after refresh. No navigation occurs.
6. With a controlled save failure in a test environment, choose a website suggestion. Expect the comparison/selection/error/Retry to remain. Restore saving and Retry; confirm only that decision saves. For a concurrent revision, confirm the latest current value is shown before choosing again.
7. From a boardless Brand's own action menu, open deletion. Expect logo/initials, name, permanent-deletion explanation and Cancel/Delete, with no typing. Escape/Cancel preserve it; the second Delete click deletes that exact Brand.
8. Attempt deletion of a Brand with one project, then several projects. Expect an immediate prominent block, correct counts, no active Delete, and View projects opening that Brand's existing filtered library. In a controlled concurrent-attachment case, expect the same block after the server rejects deletion.
9. Keep another Brand active and delete a non-active boardless Brand from its own row. Confirm the active Brand, Workspace, projects and snapshots remain unchanged.
10. Refresh and reopen the surviving Brand and project. Confirm saved website decisions, logo, DNA and avatar persist, the deleted Brand stays absent, and the profile leaves cleanly. Repeat key dialogs in DE/EN, light/dark, narrow widths and at 200% zoom.
