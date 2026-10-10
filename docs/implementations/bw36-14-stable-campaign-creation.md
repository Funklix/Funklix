# BW-36.14 — Stable campaign creation and direct campaign handoff

Inspected production baseline: `main` at `209efaf860f8074945ee521c19442cd8cc6ee98d` (merged BW-36.13R6). The working branch was created directly from this freshly fetched commit. No migration, manual SQL, new Campaign table, or changes to provider/generation implementation.

## Pre-implementation production-path audit

These findings are code evidence from the baseline, not inferred production incidents.

| Question | Verified production code and result |
| --- | --- |
| Entry buttons | `index.html` has one `#create-campaign-btn` in the existing Canvas toolbar. Brand DNA's next-step handler and the existing keyboard action call that same button; no second product CTA was added. |
| Listeners | `app.js` registers exactly one `el.createCampaignButton.addEventListener("click", …)` calling `openCampaignGeneratorEntry`. No duplicate listener was found. |
| Competing paths | `CAMPAIGN_V3_ENABLED` is true. The entry opens `openCampaignV3Modal`; its explicit legacy button opens `openCreateCampaignModal`. Both allocate and append a fresh `.campaign-builder-overlay` on each invocation. Neither has a singleton guard. |
| Dialog behavior | V3 has a technical feature-flag description and generation controls. Both overlays handle background clicks/Cancel but lack a modal focus trap, Escape handling, and focus restoration. The legacy handler removes its input overlay before requesting a plan; errors call native `alert`. |
| Context | `fetchGeneratedCampaignPlan` sends `getCurrentBrandBrainBoardId()` and browser `state.brandCore`. The entry does not validate an active authorized Board/Workspace/Brand tuple or display its read-only project/Brand identity. |
| Server/runtime | `/api/generate-campaign` builds an AI plan, not a saved campaign record. V3 normalizes/validates it and uses `createCampaignV3RealCanvasAdapter`/`commitCampaignV3PlanToCanvas`. Legacy uses `generateCampaignFromIdea`/`generateCampaignChainProgressively`. |
| Records | Generator commits mutate `state.nodes`/`state.edges` through Canvas operations. Existing local serialization and dirty/autosave mechanisms eventually call `/api/boards/:id` PUT. There is no atomic campaign creation command or idempotency receipt. No separate Campaign table was found. |
| Handoff | Both generation handlers call `setActiveView("board")` and `toggleListMode(false)` **before** generation completes. `board` means Campaign Canvas, not the Board library. V3 subsequently shows a “Reveal Campaign” completion overlay based on local commit success, without awaiting an authoritative Board save. |
| Overview fallback | The inspected creation handlers do not directly navigate to `boards_library`; no overview fallback root cause is asserted. Separately, generic save conflict handling can invoke `loadBoardFromUrlIfPresent` or the explicitly chosen `saveBoardAsNew` action. The new creation path uses neither generic conflict action nor new-Board persistence. |
| Save/error distinction | `saveBoardToServer` wraps response parsing, post-save state adoption, and subsequent rendering in one catch reporting “Save failed”. A throw after a successful server response can therefore be classified as failure. The new creation boundary retains confirmed success before any rendering/opening. |
| Duplicate requests | Repeated entry calls can append multiple overlays. Each owns its independent submit handler/generation token. No server idempotency contract exists in the plan route. These are code-level duplicate-operation opportunities; no duplicate-listener cause was found. |
| Refresh | Existing `/boards/:id` rewrite, `bootApp`, and `loadBoardFromUrlIfPresent` restore the server Canvas. A merely generated local Canvas does not establish a server save; the Board route intentionally prefers server state over a local draft. `syncRuntimeSessionFromLegacy` also initializes Workspace/Brand to null. Board hydration now explicitly restores the returned Board's Brand before deriving the authorized Workspace. |

## Implementation

Creation is a bounded persistence operation, distinct from generating AI assets. The primary dialog retains the existing required campaign idea/goal and optional additional context; audience/timing/channel notes can use that optional existing field. It does not ask again for Brand information or claim that AI content has been generated.

- The existing toolbar listener opens one native modal `dialog`. EN/DE copies show Workspace, project, Brand, and the shared protected-logo/initials renderer. Text is inserted through `textContent`.
- The authorized catalog Board and its loaded association determine context. Missing Board opens an internal feedback surface with the existing projects action. A Board without a Brand offers the existing `openBoardBrandAssociation` flow; it never selects a recent Brand. Unsaved/in-flight Board saves block creation with an actionable message.
- `POST /api/campaigns` uses the established signed session, application identity, Workspace membership, and `getBoardAccess` capabilities. One database transaction locks the existing Board, membership rows, Workspace, and Brand; permissions are resolved again after Brand locking. Cross-Workspace/Brand mismatches and stale revisions fail closed.
- The existing `boards.canvas_json` receives exactly one editable `Idea` node with the existing Canvas node fields. Existing nodes/edges and all Brand snapshot/provenance columns are preserved. No Board, Brand, Workspace, or campaign table is inserted.
- A deterministic request-derived node ID and server fingerprint/actor receipt in that node's existing metadata make identical retries replay the same seed. Altered requests conflict. If the seed has since been deleted, the original revision is stale and the retry cannot recreate it. Creation timestamps advance by at least one millisecond, matching the existing browser revision precision. Replay rechecks current access and relationships and returns the current authoritative Canvas, avoiding replacement of later edits.
- The browser keeps one in-flight command and retains its inputs/request identity through network, unknown-outcome, and invalid-response retries. Confirmed server success is retained separately from local opening. An opening failure offers “Open campaign” and an ordinary “Reload campaign” link to the confirmed Board route; opening retry issues no second save.
- Successful handoff adopts the authoritative Board ID/revision/Canvas/snapshot, Workspace and Brand projections, selects/centers the new Idea, and focuses its editable title. It uses the existing `/boards/:id` route and Canvas view directly, without visiting the Board library, creating another Board, or automatically reloading.
- Existing AI/provider functions, Brand/Workspace/project creation/deletion/profile modules, selectors, calendar/content tools, and other toolbar controls remain unchanged. The only change to existing Board hydration explicitly restores its authoritative Brand and derives its Workspace.

## Regression evidence

`npm run check:bw36.14` runs the production signed auth, command service, established access helper, response contract, real browser modules, full application, and actual DOM. Only external I/O is replaced with local fixtures. Its local database adapter emulates transactional isolation/row serialization; this is not a live PostgreSQL integration or deployed production check.

Covered: authentication and editor/Brand editor/viewer permissions; absent Board/Brand; Workspace/Brand/Board conflicts; validation; stale revision; rollback without partial state; concurrent duplicate command replay; conflicting reuse; deleted-seed retry; lost commit response; invalid response recovery; confirmed success with local opening failure; original input/request retention; single toolbar listener/dialog; repeated clicks/submits; read-only context; logo/initials; direct server-ID Canvas handoff; no Board-library intermediate view; title focus; persisted route and real refresh; Escape/Cancel/Tab/restored focus; no native dialogs; EN/DE; Light/Dark at 1440, 1024, 768, 480, 375, 320 px; 720×450 reflow equivalent; 320×280 internal scrolling; Forced Colors and Reduced Motion. Fixtures assert local-only network destinations, zero generator-route requests, and zero real provider/AI/storage/production database calls.

The full Runtime Boot Safety command list is run locally, including project creation/R3/R3R1, R6, Workspace catalog/sidebar and protected Brand checks. BW-36.12 and syntax checks for every new JavaScript module are also registered. Final result: all **168/168 Runtime Boot Safety commands passed**, including BW-36.14 and BW-36.12. The final BW-36.14 fixture was additionally rerun after correcting its simulated Brand ownership to match the production role query; it passed. Browser-script integrity checked 37 local classic scripts; JavaScript syntax and staged/unstaged `git diff --check` passed. No historical test was changed or relaxed. The initial tracked-only checkout failure was resolved by adding the new modules to Git's index, not altering that test.

## Exact changed files

- `app.js`
- `index.html`
- `campaign-creation.js`
- `campaign-creation-dialog.js`
- `campaign-creation-dialog.css`
- `api/campaigns.js`
- `api/_campaign-creation.js`
- `scripts/check-bw36-14-stable-campaign-creation.js`
- `package.json`
- `.github/workflows/runtime-boot-safety.yml`
- `docs/implementations/bw36-14-stable-campaign-creation.md`

## Manual acceptance after user merge/deployment

Deployment has not been performed by this change. After deployment:

1. Open an existing Board with its Brand.
2. Click the existing Create campaign CTA once.
3. Check project, Workspace, Brand, logo/initials, and EN/DE copy.
4. Enter the required campaign goal/idea; optionally add audience/timing notes.
5. Create the campaign and verify one new editable Idea is saved.
6. Verify the exact Board's Canvas opens with its new Idea selected and title focused.
7. Verify no Board library appears in between and no additional Board exists.
8. Refresh the browser.
9. Verify Board, Brand, Workspace, and the saved campaign seed remain correct.
10. Try a rapid double-click and double-submit; verify one operation/node.
11. Simulate a network failure, retry with preserved entries, and verify no duplicate.
12. Open a Board with no Brand; verify the existing assignment action and no recent-Brand fallback.
13. Test a viewer; verify creation is denied and no data changes.
14. Test desktop/mobile, a short viewport, light/dark, keyboard focus, and 200% reflow.
