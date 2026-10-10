# BW-36.14R1: Restore complete Campaign V3 generation

## Verified cause and scope

Baseline: `main` at `7df404e06c383e6559511826210ac7dcc72f1bae`, the merge of BW-36.14 (#755). `openCampaignGeneratorEntry()` selected the new authorized dialog, but its submit used the `campaign_creation_v1` endpoint to append a single Idea. This bypassed the existing full V3 engine and its creation experience.

The authorized BW-36.14 mask remains the only primary entry. Its Campaign brief step retains Workspace, Project, Brand logo/initials/name, goal and additional context. Campaign structure adds LinkedIn/Facebook/X/Instagram/TikTok/Mixed, 1–10 variations, 1–20 posts per variation, and both default-on shared funnel completions. The original V3 defaults are three variations and three posts. Estimates use `normalizeCampaignSetupOptions()` and `expectedCampaignV3NodeCounts()`, including the multiplication display and the sum of those authoritative counts. Buttons use the existing `fk-btn` classes; no parallel button styling is introduced.

The dialog hands its normalized brief to `runCampaignV3AICompatibility()`. Existing plan fetching, email/landing/over-count normalization, quality rules, repair targets/limits, count validation, layout and real Canvas adapter remain authoritative. Guards at async boundaries prevent committing results for a changed account, Board, Workspace, Brand, catalog generation or editing permission. Repair calls use the same guards; repair selection and quality rules are unchanged. An explicitly empty optional context stays empty.

The existing nine-step experience, avatar, sequential progress, timing, auto-scroll, error and ready renderers are reused inside the same native HTML dialog. The old V3 debug-modal entry delegates to this flow; the primary flow has no legacy switch. A busy dialog cannot be closed or duplicated. AI errors retain the captured brief for retry and roll back a failed adapter commit. A successful generated result is retained for persistence retries.

## Persistence and recovery

Option 1: retain the existing authorized transactional `POST /api/campaigns` boundary for **complete validated V3 persistence**. Its new `campaign_creation_v3` contract requires a full Canvas snapshot, the generated node IDs and normalized structure. It uses `campaign-v3.js` to validate exact counts and exact funnel edges. The old Idea-only contract is rejected.

The existing server transaction keeps its signed-session identity, Board row lock, editing access, Workspace membership, Board/Brand association, Brand/Workspace relationship, revision guard and replay fingerprint. It appends only the validated generated nodes/edges to the locked server Canvas. Existing nodes—including user-created single Ideas—edges, project identity and Brand snapshot survive unchanged. The node counter is retained monotonically. No seed is created before AI generation.

The controller suppresses scheduled/manual Board saves and intermediate local Canvas saves while it owns generation/persistence. Only the complete transaction is submitted. Ready/Reveal appears after server confirmation and local reconciliation. Refresh hydrates the same saved Canvas without a replacement Board or a Board-library detour.

A failed save displays `Campaign generated, but not saved yet.` and `Retry Save`; nodes, edges, brief and the immutable save command remain in the tab. Retry replays only persistence, never AI or a second Canvas commit. A lost response can replay the same transaction fingerprint. Server-confirmed success is retained before local reconciliation, so an open/render failure offers controlled opening of the original saved Board and retries local reconciliation without another save or generation. Stale contexts cannot apply that response to another Board.

Migration/SQL: **none**. No schema, table, migration, manual SQL execution, data cleanup or deletion of historical Ideas.

## Changed files

- `app.js`: authorized dialog handoff, existing experience orchestration, async context guards, save suppression and recovery.
- `campaign-creation-dialog.js`: two-step brief/structure, estimates, design-system buttons and dialog lifecycle.
- `campaign-creation-dialog.css`: scoped dialog/reflow styles without generic button overrides.
- `campaign-creation.js`: shared complete V3 persistence contract and confirmed-result boundary.
- `api/_campaign-creation.js`: transactional full-funnel append; historical assets and snapshots retained.
- `campaign-v3.js`, `api/generate-campaign.js`: preserve the already offered Facebook channel through normalization.
- `language.js`: localized ready, saving, saved and save-retry copy.
- `scripts/check-bw36-14r1-restore-complete-campaign-v3.js`: production-module Chromium and transactional fixtures.
- `scripts/check-bw36-14-stable-campaign-creation.js`: retained context/authorization/handoff regression using the successor contract.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register R1 and its syntax/browser check.
- This implementation/acceptance document.

## Validation

The real Chromium fixture loads production `index.html`, classic modules, `app.js`, styles, actual entry button, both dialog steps, the real V3 engine and real Canvas adapter. Only external I/O is replaced: generation/refinement responses, signed-session/auth data, database adapter and asset delivery. Every browser request is intercepted; non-fixture destinations are rejected. There are zero real provider, AI, Storage or production database calls.

For **2 variations × 3 posts**, the saved and refreshed structure is:

| Type | Nodes |
| --- | ---: |
| Idea | 1 |
| Campaign Variation | 2 |
| Content | 2 |
| Social Media Posting | 6 |
| Landing Page | 1 |
| Email Campaign | 1 |
| Total | **13** |

The **17 edges** are 2 Idea→Variation, 2 Variation→Content, 6 Content→Social, 6 Social→shared Landing Page, and 1 Landing Page→shared Email Campaign.

The fixture deliberately supplies one Content with missing body, exercising the real quality gate, repair target selection, refinement call and post-repair evaluation. It observes all nine progress steps, avatar markup and auto-scroll calls. It verifies AI failure without partial nodes, save failure with all 13 nodes retained, save-only retry, one adapter commit, response replay, confirmed save plus local open failure, singleton/double submit, stale contexts, 13-node/17-edge refresh hydration, and no extra autosave after Reveal.

Server fixtures also exercise authenticated owner/editor/brand-editor paths, Viewer rejection, absent Brand, cross-Workspace mismatch, revision conflicts, concurrent identical submissions, transaction rollback, lost commit response, deleted-campaign replay, old-contract rejection and preservation of an existing user Idea. Boundary structures include 1×1, 10×20 (**223 nodes**), and disabled shared completions.

Both steps and loading/error/ready states are checked in Light/Dark at 1440, 1024, 768, 480, 375 and 320 px, plus 720×450 as 200%-equivalent reflow. The fixture checks horizontal fit, `fk-btn` computed appearance/radius, keyboard focus, Escape/Cancel, short height, forced colors, reduced motion, localization and bound validation. Screenshots remain local test artifacts in `work/`.

Commands:

- `npm run check:bw36.14r1`
- `npm run check:bw36.14`
- `node scripts/campaign-v3-harness.js` (14 valid/expected-invalid cases)
- All 170 checks registered by Runtime Boot Safety, including Board-persistence/snapshot/access checks, Canvas-toolbar isolation, Workspace/Brand/Profile regressions and `check:bw36.13r6`.
- Browser-script integrity (37 classic scripts), syntax of every changed JavaScript file, and `git diff --check`.

Runtime execution note: the general list ran in the sandbox. Twelve checks initially hit sandbox subprocess/socket restrictions. Their sources were inspected; they use read-only Git commands, temporary tracked-file fixtures, mock database clients or intercepted Chromium requests. Each was separately rerun successfully with the required execution permission. No checker was weakened for the environment.

### Historical test changes

BW-36.14's single-Idea contract/count assertions are obsolete because R1 explicitly replaces that product behavior. Its signed authorization, locking, revision, rollback, concurrent replay, response validation and reconciliation assertions now run against complete V3 commands (13 nodes). Its production DOM/context/logo/permissions/singleton/themes/reflow checks share the R1 fixture in baseline mode. The full handoff, persistence, refresh and recovery cases live in R1. No role, conflict, count, quality or repair invariant is loosened; the stricter successor contract additionally rejects missing nodes and incorrect edges. Other historical checker files are unchanged.

## Manual acceptance after deployment

This is an acceptance checklist for the user after deployment; automated fixtures do not claim live provider/deployment verification.

1. Open an editable Board with an associated Brand.
2. Click Create campaign once; repeated clicks must retain one dialog.
3. Check Workspace, Project, Brand name and logo/initials in Step 1.
4. Enter the campaign idea and optional context.
5. Continue to Step 2.
6. Select two variations.
7. Select three posts per variation.
8. Leave Landing Page and Email Campaign enabled; verify 13 assets in the estimate.
9. Click Generate Campaign.
10. Verify the Brand Avatar, start at the top, sequential steps, auto-scroll, quality check and Canvas build.
11. Wait for “Your campaign is ready”, then click Reveal Campaign.
12. Count 1 Idea, 2 variations, 2 Content pieces, 6 Social posts, 1 shared Landing Page and 1 shared Email Campaign.
13. Verify the 17 funnel connections and shared completions.
14. Refresh the page.
15. Verify all 13 nodes and 17 edges persist on the same Board/Workspace/Brand.
16. Repeat with a double-click on Generate; there must be one generation/commit.
17. With a controlled save failure, verify retained nodes and Retry Save; retry must issue no second AI generation.
18. Check desktop/mobile, both themes, keyboard and reflow. With a Viewer or a Board without Brand, generation must remain blocked.
