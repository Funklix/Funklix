# Home Dashboard Shell Implementation Audit

| Field | Value |
|---|---|
| Date | 2026-06-26 |
| Topic | Home Dashboard Shell as a new internal app view |
| Current behavior | Funklix starts on Campaign Canvas, with sidebar navigation for Campaign Canvas, Boards, Brand Core, AI Brain, and Insights. View switching is handled by `setActiveView()`, while Brand-specific chrome behavior is handled by `setAppMode()`. |
| Goal | Add a static Home Dashboard Shell behind a new Home sidebar item without changing boot default behavior or adding dashboard business logic. |

## Files/functions inspected

- `docs/constitution/product-constitution.md`
- `docs/constitution/product-architecture.md`
- `docs/constitution/engineering-constitution.md`
- `docs/constitution/design-constitution.md`
- `docs/design-system/README.md`
- `docs/audits/2026-06-26-design-foundation-implementation-audit.md`
- `index.html`
- `app.js`
- `styles.css`

## Current architecture summary

- Home should orchestrate work and must not own Campaign logic, Brand logic, AI conversations, or business logic.
- Campaign Canvas remains the primary creation workspace.
- Brand defines truth, AI Brain advises, Insights analyze, and Settings personalize.
- `bootApp()` currently initializes the app and ends by calling `setAppMode("canvas")` and `setActiveView("board")`; this startup behavior should remain unchanged in this PR.
- Board URL handling is owned by the existing board-loading flow and should not change.

## Safest insertion points

- Add the Home sidebar nav item above the existing Campaign Canvas nav item.
- Add `dashboard-view` as a sibling view inside the existing workspace, after the Canvas topbar and before the Canvas section.
- Do not insert Dashboard markup inside the Canvas DOM.

## Recommended view/nav behavior

- Home should be accessible only by clicking the new Home nav item in this PR.
- Campaign Canvas remains the default startup view.
- `setActiveView()` should add support for `view === "home"` and keep all existing view support.
- Home should hide the Canvas topbar and inspector panel while active.
- Leaving Home should restore the current non-Brand chrome behavior.
- Active nav state should be explicit for Home, Campaign Canvas, Boards, Brand Core, AI Brain, and Insights.

## Dashboard shell structure

Phase 1 should include only static shell content:

- Welcome/Hero area
- Quick Actions
- Brand Status placeholder
- Insight Highlights placeholder
- AI Activity placeholder

Do not include Recent Boards or Campaign Health in this PR.

## Quick Actions

Quick Actions should call existing flows only:

- Create Campaign: switch to Campaign Canvas and call the existing campaign generator entry.
- Open Boards: trigger the existing Boards navigation behavior instead of loading board data inside Home.
- Open Brand: use the existing Brand Core behavior.
- Open AI Brain: use the existing AI Brain behavior.

## Styling approach

- Add Dashboard-scoped CSS only.
- Use existing `--fk-*` design foundation tokens.
- Do not add `fk-btn`, `fk-card`, `fk-badge`, or `fk-input` classes yet.
- Do not globally restyle buttons, cards, inputs, modals, inspector, nodes, Campaign Canvas, or Campaign V3.

## Risks

- Changing boot default behavior could alter user entry flow.
- Breaking board deep links would affect shared boards.
- Incorrect active nav mapping could make Home or existing views appear selected incorrectly.
- Forgetting to hide the Canvas topbar or inspector on Home would make the shell feel like Canvas.
- Duplicating campaign generation logic could fork Campaign V3 behavior.
- Loading Recent Boards or calling board data loaders directly from Home could couple Dashboard to board ownership and library flows too early.

## Blast radius

Expected files changed:

- `index.html`
- `app.js`
- `styles.css`
- `docs/audits/2026-06-26-home-dashboard-shell-implementation-audit.md`

No API, Campaign V3, save/load, auth/session, board ownership, dependency, or router changes are needed.

## Decision

Proceed with a small additive Home Dashboard Shell that is accessible through sidebar navigation only. Preserve Campaign Canvas as the default startup view and defer root/default-entry changes to a later dedicated PR.

## Follow-up

- Prove the Home shell is stable before making it the root default.
- Add Recent Boards only after a dedicated data/loading audit.
- Add Campaign Health only after metrics ownership is defined.
- Consider shared `fk-*` component classes in a later design-system PR.
