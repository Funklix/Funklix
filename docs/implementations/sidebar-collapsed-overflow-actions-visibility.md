# Collapsed sidebar overflow action visibility

Base: latest merged main `537e10009ad6ff66d1488ac269589f756946e5d3`.

The controls are `#workspace-context-manage` (Workspace actions) and
`#workspace-brand-manage` (Brand actions), both `.workspace-context-manage`
buttons inside the existing identity rows in `index.html`.
`workspace-sidebar.js` owns permission-based hidden/disabled attributes, click
listeners, body-owned menus, keyboard handling and focus restoration.
`app.js` toggles the existing `.app-shell.sidebar-collapsed` class through
`setSidebarCollapsed`; responsive CSS also provides compact and mobile layouts.

A later compact CSS rule deliberately redisplayed these controls below the icons,
overriding an earlier `display:none` rule. Add only `visibility:hidden` to that
existing collapsed-state rule. This preserves the current grid slots, dimensions
and unrelated spacing while preventing pointer interaction, keyboard tab stops
and programmatic focus. Removing the collapsed class automatically restores the
original visibility, including responsive layouts. No DOM, IDs, handlers,
permissions, menu logic or state management changes.

Validation:

- Production page in Chromium with local mocked API responses: Light and Dark,
  widths 1440/1024/768/375/320, expanded → collapsed → expanded. Both controls
  retain their DOM nodes, reject focus and are skipped by Tab while collapsed.
  Both menus open again after expansion; Escape restores the originating control.
  No page errors.
- Sidebar/Workspace/Brand checks BW-36.4, BW-36.10 and BW-36.11R1 passed.
- Full Runtime Boot Safety: all 223 validation commands passed, including the
  Workspace/Brand lifecycle browser regressions, script syntax/integrity,
  Campaign, Canvas, Learning Advisor, localization and browser-global checks.
  Two CI setup commands failed locally (default npm installation and Playwright
  browser installation); dependencies were instead installed successfully using
  the writable workspace npm cache, and the suite used system Chromium. Browser
  checks ran with the network-enabled execution profile for local socket access.
- `git diff --check` passed.
