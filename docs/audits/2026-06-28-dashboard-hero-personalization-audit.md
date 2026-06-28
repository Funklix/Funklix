# Dashboard Hero Personalization Audit

| Field | Value |
|---|---|
| Date | 2026-06-28 |
| Type | PR 15B Dashboard hero personalization audit |
| Scope | Dashboard Daily Briefing hero copy only |
| Runtime behavior changes | None; read-only presentation copy |
| Files changed | `app.js`, `index.html`, `docs/audits/2026-06-28-dashboard-hero-personalization-audit.md` |

## Goal

Make the Dashboard Daily Briefing hero feel more personal and less generic without adding data sources, APIs, profile storage, routing changes, or Dashboard model changes.

## Audit Findings

### 1. Existing hero copy

The Dashboard hero currently used a static headline:

```text
Good morning. I have your focus ready.
```

and a longer paragraph:

```text
I found the clearest next step in our workspace. Start with the current campaign, then review the brand signals and opportunities below.
```

This worked functionally but felt generic and more AI-authored than personal.

### 2. Existing user data availability

The runtime already has `state.user` from the existing auth/session flow.

Existing safe display fields include:

- `state.user.name`
- `state.user.email`
- `state.user.avatar`

For this PR, only `state.user.name` is read, and only for display copy.

No user profile storage, auth behavior, API request, or session behavior is changed.

### 3. Safe personalization model

If `state.user.name` is a non-empty display name, the hero can use the first word as a greeting name:

```text
Good morning, Felix.
```

If there is no safe name, the fallback is:

```text
Good morning.
```

The subheadline is always:

```text
Your next best move is ready.
```

The support copy is always:

```text
Start with the current campaign, then review the brand signals and opportunities below.
```

### 4. Safest implementation

The smallest safe implementation is:

- make the HTML fallback copy clean by default
- add `#dashboard-hero-subtitle` and `#dashboard-hero-support` IDs for stable copy targets
- add a read-only `renderDashboardHero()` helper
- call the helper from the existing Dashboard refresh path
- refresh the Dashboard copy after auth state renders if Dashboard is visible

## Behavior Unchanged Confirmation

This PR does not:

- add APIs
- add user profile storage
- change auth behavior
- change Dashboard data model
- change routing
- change save/load
- change autosave
- change Canvas
- change Brand runtime
- change AI Brain
- change Sidebar
- change hero CTA behavior

## Risks

### 1. Over-personalization

The helper uses only the first word of the existing display name and falls back cleanly. It does not use email-derived names.

### 2. Generic auth names

The helper ignores the existing generic `Google user` fallback so the hero does not render `Good morning, Google.`

### 3. Copy refresh timing

Auth can load before or after Dashboard visibility. The helper is called from Dashboard refresh and after auth state renders when Dashboard is visible.

## Rollback Plan

Rollback is simple:

1. Restore static hero copy in `index.html`.
2. Remove `getDashboardUserFirstName()` and `renderDashboardHero()` from `app.js`.
3. Remove `renderDashboardHero()` from the Dashboard refresh path.
4. Remove this audit file.

No runtime data, API, auth, routing, save/load, autosave, Canvas, Brand, AI Brain, Sidebar, or Dashboard data model changes depend on this PR.

## Manual QA Checklist

1. Signed-in user with a display name sees `Good morning, <FirstName>.`.
2. Logged-out/no-name state sees `Good morning.`.
3. Subheadline says `Your next best move is ready.`.
4. Support copy remains short and matches the approved copy.
5. Hero CTAs still work.
6. Dashboard layout is unchanged.

## Decision

Proceed with read-only Dashboard hero personalization using only the existing signed-in user display name when available.
