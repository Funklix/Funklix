# BW-36.21B1 — Brand Intelligence and Team Responsibilities

Implementation date: 2026-10-18 (Europe/Berlin). Phase B1 only.
Base: latest merged `main`, `995e79f770845c7590ca8c0303290e4d7abc4f70` (PR #789), confirmed through the GitHub commit API against the local checkout. Work is on `codex/bw36-21b1-home-intelligence`. Shell Git has no usable GitHub credentials in this environment; delivery uses the authenticated GitHub connector.

## Sources of truth and interface inspection

Read the complete [BW-36.21 audit](../audits/bw36-21-start-screen-intelligence-and-insights-audit.md), BW-36.15/15R1, 17, 18, 19, 20, Home Foundation, R2.2, R2.3 and R2.3R1 implementation records, then traced the merged implementation. The audit's older Brand-selection description is superseded by merged R2.2/R2.3. R2.3R1's detached optional catalog adoption remains unchanged.

| Interface | Confirmed implementation and integration boundary |
| --- | --- |
| Home renderer and delegation | `home-foundation.js` owns the read-only model, isolated renderer, scope comparison, optional metadata request, delegated native buttons and focus restoration. `home-foundation.css` owns Home styling; `styles.css` and legacy HTML IDs remain unchanged. The two new sections are children of the existing Home host, after the existing context notice and before Continue Working. |
| Workspace/Brand navigation | `workspace-catalog.js`, `workspace-sidebar.js`, `app.js:selectSessionWorkspace`, `selectSessionBrand`, `selectedBrandPreferenceId`, `renderWorkspaceSidebar`, `brandBoardNavigationContext`. Only the ready, account-bound catalog supplies identities. Workspace selection retires the Board through its existing guarded flow. Brand selection remains an independent navigation preference. |
| Brand Learning collection | `api/brands/[id]/learnings.js` → `api/_brand-learnings.js:operate`, `authorize`, `readLibrary`. Actual merged response is `brand_learnings_v1` with `brand`, **`counts`**, `can_write`, `learnings`, `has_more`, `offset`. The request description's `status_counts` refers to this existing authoritative `counts` projection; no API alias or new endpoint is introduced. |
| Independent Learning authorization | The real signed-session route and `_app-identity.js` require exactly one active application identity. `_brand-learnings.js:authorize` checks and locks identity, Brand and relevant Brand membership. Owner/admin/editor may review; viewer may read. Workspace membership and Board ownership/collaboration do not grant Learning access. |
| Profile navigation and leave guards | `app.js:openRegularBrandProfile` takes explicit `{id,workspace_id,section:'Brand Learnings'}`. `closeCanonicalBrandDetail` and `guardBrandProfileLeave` retain busy, dirty, Save/Discard/Cancel and conflict handling. `brand-profile-setup.js` mounts the existing Learning controller; no Home review controls are created. |
| Learning lifecycle/provenance | `brand-learnings.js` performs existing human actions, `canvas-learning-proposal.js` captures explicit proposals, `learning-advisor.js` manages explicit suggestions/adoption, and `api/_brand-learnings.js` owns lifecycle/provenance. Home retains no statement, source, evidence or history. A successful existing library mutation emits a minimal Brand-ID invalidation event; its request, lifecycle and write semantics are unchanged. Advisor/proposal changes occur outside Home and are refreshed on return. |
| AI Brain consumption | `api/ai-brain/advice.js`, `api/_ai-brain-learning-context.js` and BW-36.20 documentation establish separate approved-knowledge authorization. Home invokes none of them. The loaded Board snapshot remains the campaign context; selected Brand knowledge never changes it. |
| Responsibility model | `campaign-responsibilities.js` owns supported node types, structure and manager. Its existing type array is now exposed frozen for reuse. `app.js:normalizeNodeStatus` supplies the real status mapping; `isDashboardNodeComplete` supplies the existing completion predicate (Approved/Published and legacy done/completed/complete). No parallel status model is added. |
| Board runtime and capabilities | `brandBoardNavigationContext` confirms Board identity, completed hydration generation and `boardAccess.canView`. B1 projects only that runtime's supported nodes, owner email, title, normalized status, completion and dirty state. No saved or unrelated Board Canvas is fetched. |
| Responsibility navigation/writes | `openCampaignResponsibilities` and `FunklixCampaignResponsibilities.mount` remain the single manager; `focusNodeInCanvas` remains the existing node-focus adapter. Home supplies a lazy focus-return target because its DOM may refresh while the manager is open. The manager supports the prior element target as well. Roster reads, edit/manage capability checks, assignment writes, revision conflicts and immutable retry are unchanged. |
| Localization/theme/boot | `language.js:uiText` EN/DE dictionary, existing `theme-bootstrap.js`/`theme.js`, `--fk-*` tokens, existing Home focus and reduced-motion rules. `.github/workflows/runtime-boot-safety.yml` remains the complete regression gate and gains the B1 check. Root boot, DOM diagnostics, Board loader, autosave and non-blocking catalog reconciliation are untouched. |

## UI and confirmed data semantics

**Brand Intelligence** labels its scope **Selected Brand**. A successful independently authorized Learning read displays the catalog Brand name/avatar, Awaiting Review and Approved Knowledge counts, server-derived human-review/read-only availability and one existing Profile action. Approved means human-reviewed supplementary knowledge, not measured marketing performance or an externally verified strategic claim. Archived/rejected rows are excluded from both active counters.

Home performs one `GET /api/brands/:id/learnings?status=all&offset=0` with same-origin credentials and no-store. It uses aggregate `counts`, which covers the full library even when the page is incomplete. It never follows pagination to derive a count. The existing API necessarily returns one bounded page of statements/history; Home immediately discards that content and retains only two counts and the write capability. There is no full-library scan.

The SQL `GROUP BY status` aggregate is sparse: a missing status key inside a successful valid `counts` object means zero. An absent/malformed aggregate, wrong contract/Brand, missing rows/capability or failed response is unavailable. An explicitly malformed individual count is displayed as Unavailable, never fabricated zero. No Brand identity/availability/count is rendered in this module until its Learning response is validated. The rest of Home's independently authorized catalog remains usable if this optional read fails.

**Team Responsibilities** labels its scope **Current Board** and explicitly says **Responsibilities in [Board] · [authorized associated Brand]**. With selected Y and loaded A/X, Intelligence shows Y and responsibilities show A/X. A hidden association uses **No visible Brand association**; a confirmed unbranded Board uses **No Brand connected**. No snapshot or private historical label enriches that name.

Only actual assigned supported nodes that fail the existing completion predicate count as incomplete. Unassigned nodes, unsupported types, completed nodes and duplicate node IDs are excluded. Assigned to You is a count of these incomplete nodes whose actual normalized owner email equals the verified session email. Names/avatars never establish a personal assignment. The preview shows at most three real items in stable Canvas order with actual normalized statuses; this is a presentation bound, not a product quota or priority score. Preview titles use the existing `focusNodeInCanvas` adapter with current identity/node revalidation and reduced-motion handling. IDs outside the adapter’s safe selector form remain plain titles. The full existing manager is one action away. No invented deadline, urgency, priority, timestamp or cross-Board summary is shown.

The Board card says **Current loaded Canvas**, or **Live Canvas · includes unsaved changes** when the existing runtime is dirty or a responsibility command is pending. This does not assert a new persistence timestamp. Rendering only reads the minimized projection and never marks dirty, serializes for saving, hydrates another Board, triggers autosave or changes a responsibility.

## Authorization and freshness boundaries

The Home scope comparison binds actual account object, normalized catalog identity, catalog object/status/generation, Workspace, selected Brand, Board identity/load generation, view and public-token state. Changing a scope aborts requests, clears retained Learning data and rejects obsolete responses before and after JSON consumption. A new Brand never temporarily displays the old Brand's counts. Reads have a 12-second abort timeout and manual retry; no retry loop exists.

Leaving Home invalidates the optional data; returning from review obtains current counts regardless of canonical Brand revision. Successful local lifecycle events invalidate only the relevant selected Brand. Focus and visible-page resume also clear/re-read counts, covering changes made elsewhere without polling the server. There is no Learning cache in browser storage.

Responsibilities additionally require a confirmed hydrated current Board and matching runtime identity/generation; loading/hydrating or revoked Board access suppresses all rows and counts. Existing lifecycle and Home refresh callbacks update immediately. A one-second **local presentation observer**, active only for Home, detects node replacement/deletion, owner/status/permission and dirty changes missed by existing callbacks. Its key contains only the minimized runtime projection, performs no network request and causes no mutation. Off Home the adapter does not project node arrays. Logout, account mismatch and catalog loss hide all private modules. Existing Workspace exit retires the outgoing Board normally.

This is read-time authorization, not a server push revocation subscription. Unknown remote Learning changes are detected on return/focus/visibility/manual refresh, and current server permissions are rechecked on each read/destination. No new real-time infrastructure is claimed.

## Empty, loading, error and accessibility states

| State | Behavior |
| --- | --- |
| No Workspace/account/public context | Existing Home chooser/onboarding/sign-in state; no private modules or Learning fetch. |
| No selected authorized Brand | Select-Brand prompt; no guessed Board Brand Learning request. |
| Learning loading | Counts and identity cleared; access-check status and a stable, aria-disabled native action preserve keyboard focus. |
| Valid empty library | Two genuine zeros and No proposals awaiting review. |
| Partial/missing response fields | Unavailable aggregate/state or explicit unknown individual count; never an all-clear on failure. |
| Denied/failed Learning API | Neutral access/unavailable message and manual retry; Board links and responsibilities remain navigable. |
| Viewer Learning access | Server `can_write:false` gives View Brand Learnings and read-only explanation. |
| No loaded Board | Open-Board prompt and existing Browse Boards action. |
| Board loading/hydrating or stale/revoked runtime | No stale assignments/counts; wait/open prompt. |
| Board viewer | Read-only label; existing manager's assignment controls remain disabled and invitation capability unchanged. |

Native buttons, semantic headings/description lists/lists, polite loading status, visible focus and stable focus keys reuse Home conventions. The responsibility dialog resolves the current Home action on close, including after a Home refresh. Existing Profile leave guards remain the authority. Scoped token-based cards reflow to one column at 800px; phone counters become label/value rows at 400px to keep German labels legible. Long object names wrap. Existing reduced-motion, Light/Dark/system and 44px controls are preserved. There is no new global DOM dependency or hidden Canvas/Inspector removal.

## Changed files

- `home-foundation.js`: minimized projections, independent read/freshness state, two scoped modules and guarded delegation.
- `home-foundation.css`: scoped cards, count rows, preview list and responsive rules.
- `app.js`: read-only runtime adapter and existing Profile/responsibility navigation callbacks; optional focus target.
- `campaign-responsibilities.js`: expose existing supported types; resolve optional lazy focus-return target.
- `brand-learnings.js`: minimal successful-mutation invalidation event, without Learning text.
- `language.js`: EN/DE copy.
- `scripts/check-bw36-21b1-home-intelligence.js`: focused real-route and Chromium fixture regressions.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register B1 regression.
- This report and `bw36-21b1-visuals/`: screenshots and validation evidence.

## Validation

Final local results: **PASS**. Focused B1: **17/17 groups**. Complete Runtime Boot Safety: **184/184 validation blocks** after the affected B1 block was corrected and rerun. The first complete run recorded 183 passes and one screenshot-fixture failure: Playwright's scroll stability wait held an element detached by a Home refresh. The test now scrolls the current element immediately through DOM evaluation; all layout, authorization, keyboard, workflow and no-write assertions remain. The final B1 rerun passes every group. [Machine-readable evidence](bw36-21b1-visuals/validation.json) preserves the original failure and successful recheck; [focused output](bw36-21b1-visuals/b1-recovery.log) records the final run.

The complete run includes BW-36.17/R1/R2, BW-36.18, BW-36.19 and its follow-ups, BW-36.20/R0/R1, BW-36.15/15R1, Home Foundation, R2.1's 96 switching groups, R2.2, R2.3's 30 groups, root/Board/autosave, themes, localization, browser globals and all other declared validation blocks. Installed dependencies and system Chromium satisfy the two local setup blocks; the GitHub Actions browser installer is unchanged. Browser-script integrity passes for all 44 classic scripts. Final affected JavaScript syntax and `git diff --check` pass.

Recovery after the publishing interruption reused the intact local branch, source, tests, report, screenshots and logs; no implementation was reconstructed. Two existing GitHub blobs (workflow and app) were verified by SHA and reused. No B1 remote branch, commit/tree reference or PR existed when recovery began. Remaining blobs, the complete tree/commit and one normal PR are published through the GitHub connector. The latest merged main was rechecked and remains the original baseline.

Every browser request is intercepted to disposable local fixtures; the signed Learning route and real authorization helpers execute with the repository's database transport double. Existing PGlite suites use disposable databases. No production SQL, paid inference, production account data, merge or deployment is performed.

## Review findings and remaining limitations

Local review caught and repaired focus loss when a count refresh temporarily removed the Learning action, and a detached responsibility-dialog return target after Home rerendering. Focused tests exercise both actual browser flows. Sparse SQL counts were confirmed from the real `readLibrary` implementation rather than inferred from returned rows.

The existing library endpoint returns one bounded page plus its aggregate, rather than a summary-only response. B1 minimizes retained/displayed data; a new count endpoint would require separate approval. Home does not fetch unrelated Boards or aggregate tasks across Workspaces. Local browser/disposable database results do not establish production deployment/schema parity, screen-reader acceptance or physical-device behavior. Server-side changes made while a page remains continuously focused have no push notification; the next return/resume/read reauthorizes them.

## B2 integration points

B2 may reuse the two read-only projections and scoped unavailable/freshness states for separately approved current-Board diagnostics or navigation. It must keep selected Brand, loaded Board and canonical Profile identities separate, retain independently authorized reads and avoid background AI. Any summary-only endpoint, workspace-wide aggregation, analytics, readiness model, deadline/task schema or inference requires its own scope decision. No such follow-up is implemented by B1.
