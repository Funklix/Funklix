# BW-36.21A — Intelligent Home Foundation

## Baseline and approved scope

Implementation starts at merged `main` **a6945dfbc6d48cf222d2a9ee9707796ab87cfab4** (PR #780). The complete [BW-36.21 audit](../audits/bw36-21-start-screen-intelligence-and-insights-audit.md) was read before editing. The initial local checkout was PR #778; the latest files, signed commit and tree were hash-verified through GitHub, followed by a full Git fetch confirming the baseline.

Confirmed baseline: Home shares `app.js`, the application shell and Canvas lifecycle. Its existing intelligence modules largely use live Canvas/Brand state. Root startup detects but deliberately does not restore the old local Canvas draft. Workspace selection uses the validated authenticated catalog and Board-first context precedence; Brand switching refuses to change an active Board. The Board library has independent collection reads, a 200-row cap and manual ordering. It has no authoritative personal visit history.

Phase A implements Workspace orientation and saved Board continuation only. Workspace is the primary scope, Brand supplies context and an optional display filter, and a saved Board remains the concrete working context. Learning reviews, responsibilities, diagnostics, readiness scoring and AI entry modules remain Phase B. No inference, new backend service, schema, persistence store, paid request, production SQL or new product quota is introduced.

## Final Home layout

1. An editorial Workspace hero: real selected Workspace name, available avatar or initials, restrained violet accent and a short invitation to work.
2. A native Workspace selector using `selectSessionWorkspace`.
3. Accessible Brand cards with the existing persisted logo renderer, safe initials and the existing Brand Profile entry. Counts explicitly describe Brands/Boards **visible to you**.
4. Continue Working: saved Board cards, active Board first, optional server modification dates, authorized Brand identity, viewer label and Open/Continue action. Browse Boards and permitted Create project actions use existing controls.
5. All visible Boards / selected Brand display filters. Filtering does not write an association or change the library's order/scope.

No unsupported intelligence, activity, performance or deployment facts fill empty space. All previous dashboard structures remain mounted but are hidden by one Home-scoped selector. Static Team Activity examples are replaced with an informational state; the legacy Live Campaigns heading no longer asserts there are no deployed campaigns.

## Workspace and Brand scope

`home-foundation.js` composes a read-only view from the current `workspaceCatalog`, its status/identity/generation, selected Workspace/Brand, session account and current Board/load generation. It does not create another Workspace or Brand store. Only a **ready** catalog belonging to the authenticated account can supply cards. Refreshing/stale/error states do not expose old catalog cards. Anonymous/public-token contexts receive a sign-in state instead of authenticated aggregation.

Workspace changes and Brand changes use the existing guarded functions. While a Board is open, Brand-selection controls are disabled and text explains that the Board keeps its saved Brand context. Explicit profile navigation uses `openRegularBrandProfile` with the independently catalog-authorized target. A local Board filter only selects already-visible Board identities. A missing/hidden Brand association shows neutral copy, never a collection snapshot's Brand name.

Creation uses existing Workspace/Brand/project flows. Viewer-only contexts receive read/navigation actions. An empty Workspace's Brand management action appears only for Workspace owner/admin roles; server handlers remain the write authority.

## Continue Working data and ordering

- Authoritative identities, names, display roles and permitted associations come from the validated Workspace catalog.
- One optional `GET /api/boards` request obtains saved `updated_at` values; no Board detail/Canvas requests or per-Board fan-out occur for Home rendering.
- Collection rows are intersected with the selected Workspace's catalog Board IDs. Only IDs and saved dates are retained. Collection names, ownership, Brand display snapshots and Canvas payloads never populate cards.
- The authorized current Board is first. Remaining known modification dates sort descending. Missing dates retain stable catalog order after dated rows. Neither input nor the library's manual order is mutated.
- A date is labeled **Last edited**, never last opened. Missing/invalid dates show **Modification time unavailable**. The list visibly discloses potentially incomplete collection coverage and explicitly says it is not visit history.
- Optional request/malformed-response failures preserve the catalog's usable links and provide a date retry. A 401/403 clears Home metadata and the existing catalog context, then revalidates catalog access. A failed revalidation remains unavailable, not empty.

Active Continue uses the existing Canvas navigation control; other Boards use the same full `/boards/:id` navigation as the Board library. Existing browser leave behavior, Board authorization, hydration, autosave and direct-route boot remain responsible for loading. Home never calls hydration or save functions to build previews.

## Freshness and privacy

Requests capture the actual account object, normalized catalog identity, catalog object/status/generation, Workspace, Brand, Board, Board-load generation, public-token context and active view. Scope changes abort and invalidate the optional request, remove retained metadata and reject late responses both before and after JSON parsing. Leaving Home clears its rendered content. Click handlers resolve targets against the current authorized scope again.

Existing catalog/session/logout/sidebar lifecycle hooks synchronize Home. Account changes with an old catalog identity render no private cards; logout clears them immediately. The metadata cache exists only inside the component for the current scope; it uses no browser storage. Optional reads use same-origin credentials and `cache: no-store`.

Catalog visibility is a snapshot of a successful server read, not a subscription to membership changes. Destination handlers reauthorize every opened Board/Profile. A known permission failure triggers catalog revalidation; changes not yet reported by a server cannot be inferred from browser state.

## Legacy DOM and lifecycle preservation

All **364** baseline HTML IDs remain present. `#dashboard-view`, the old hero/Continue Working/Brand Evolution/opportunities/focus/support modules, Canvas, zoom layer, links, Inspector, editors and dialogs remain mounted. The dashboard region now has a visible Home label instead of relying on a hidden legacy heading.

Home rendering is an isolated optional browser module. The legacy renderers/functions/handlers remain available; when the module is mounted, ordinary Home refreshes use the new read-only renderer instead of repopulating hidden Canvas-based modules. Isolated older VM regression fixtures still work without loading the optional controller.

No Board write, owner/association change, Canvas serialization, autosave, boot restoration, authentication, provider, canonical Profile, Learning, Advisor or Advice implementation is changed. The existing library's list/filter/reorder and navigation code is untouched.

## Loading, empty and failure states

| Condition | Presentation/action |
| --- | --- |
| Signed out / public token | Welcome and existing sign-in action; no account catalog. |
| Loading/refreshing catalog | Loading explanation; old private cards cleared. |
| No Workspace | Existing first Workspace creation entry. |
| Several Workspaces without selection | Explicit chooser; no guessed working scope. |
| No visible Brand | Honest visibility explanation; existing management only when supported. |
| No saved Board / Brand filter without Boards | Useful empty state; existing permitted project flow or library entry. |
| Unavailable/stale/denied catalog | Retry; never an empty-account claim. |
| Partial/missing/malformed Board metadata | Catalog links remain; no fabricated date; explicit completeness wording. |
| Optional date request fails | Navigation remains available; separate retry. |
| Board loading | Opening another Board is disabled with explanatory text. |
| Account, scope, view or permission changes | Invalidate/abort and clear the previous Home scope. |

## Visual design and accessibility

`home-foundation.css` uses existing surface/text/border/action tokens, layered cards, typographic hierarchy, a restrained hero and violet selection/focus accents. Rules are rooted in Home; Canvas/Inspector dimensions and shell breakpoints are not changed. Existing light/dark/system preferences are reused. Brand artwork uses `FunklixBrandLogo`; Workspace images accept HTTP(S), use a no-referrer policy and fall back to initials on failure.

Native select/buttons, visible focus rings, semantic sections/lists, explicit Board/Profile action names, busy/status states and 44px minimum actions support keyboard and accessibility APIs. Scope refreshes restore a still-available control's focus without scrolling. Object names are not translated; EN/DE UI strings use the existing localization dictionary. Cards wrap long names, shrink safely and reflow on mobile. Motion is limited to hover surface changes and disabled under reduced motion.

The existing mobile shell/context controls remain intact. Screenshots include both the mobile introduction and a scrolled Board section because the dashboard is its own scroll container.

## Changed files

- `home-foundation.js`: read-only model, scoped optional metadata request, renderer and action validation.
- `home-foundation.css`: isolated Home styling and responsive/accessibility rules.
- `app.js`: small catalog/view/session rendering hooks and existing navigation adapters.
- `index.html`: mounted Home host/assets, retained legacy DOM and honest legacy support copy.
- `language.js`: German Home UI strings.
- `scripts/check-bw36-21a-home-foundation.js`: focused composition and real Chromium regressions.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register the focused check after Chromium setup.
- This implementation record and `bw36-21a-visuals/`: visual review evidence.

## Verification

Focused command: `npm run check:bw36.21a`. Uses the production root/scripts and saved Board authorization/serialization fixture; all external transport is local and provider calls are forbidden.

Passed: signed-in/out root; old local draft not restored; explicit Workspace/Brand selection; authorization intersection; current Board priority; saved-date ordering; unchanged collection order; partial metadata/catalog fallback; no fabricated recency/activity/deployment claims; no Workspace/Brand/Board states; optional failures/retry; stale response rejection; account/logout isolation; public/viewer boundaries; revoked reads; long names; failed persisted logo fallback; unchanged dirty Canvas; guarded Brand selection; Board open/reload/Back; keyboard focus; EN/DE; actual layout geometry and screenshots. Home caused zero inference requests or Board/Brand/Canvas writes.

Measured geometries: 1440px light EN and dark DE; 375px light EN; 320px dark DE; 768px system theme; 720px with 200% text. All measured Home descendants stayed inside the viewport and Home had no horizontal scroll overflow. Reduced-motion media was enabled during the visual matrix. These checks inspect browser DOM/keyboard behavior; they do not claim a manual screen-reader session or physical-device testing.

**Runtime Boot Safety: PASS.** All 179 existing executable check blocks were run from the workflow, including BW-36.9/10/13/16/17/19/20, responsive shell, root/Canvas lifecycle, provider-free browser suites and disposable PostgreSQL regressions. Four initial failures were resolved and individually rerun: the tracked-files-only fixture required staging the new module; isolated Insights/catalog VM fixtures needed optional-controller guards. No existing test or assertion was weakened. The new Home suite also passes: **180 check blocks total**. [Machine-readable results](bw36-21a-visuals/validation.json) preserve the initial failure/recheck evidence.

Dependencies use `npm install --ignore-scripts --no-package-lock`; local browser checks use installed `/usr/bin/chromium` in place of downloading another Chromium. Both setup steps were satisfied separately from the executable check count. Disposable PostgreSQL fixtures and all existing regression assertions remain unchanged. Browser script integrity, JavaScript syntax, `git diff --check` and the baseline DOM-ID comparison also pass. Measured small accent text contrast exceeds 4.5:1 in both themes.

Screenshots use real Chromium rendering of a deterministic local authorized fixture, not production account data. See the [visual review gallery](bw36-21a-visuals/README.md).

## Remaining limitations and Phase B integration

The 200-row collection contract and lack of personal visit history remain. No globally complete recent-Board order is promised. Catalog permission/name changes require another authoritative read; there is no real-time workspace activity/membership subscription. Brand selection remains deliberately guarded by the active Board; the separate local display filter does not bypass it.

Phase B can add independently authorized modules alongside the current hero, Brands and Continue Working sections. Keep per-source unavailable/freshness states, explicit selected Brand/current Board scope and human-triggered navigation. Governed Learning review, responsibilities, diagnostics and AI Brain entry are not implemented or simulated here.

Do not merge automatically. Review the PR and Chromium evidence before merging.
