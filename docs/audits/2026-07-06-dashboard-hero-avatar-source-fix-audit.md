# Dashboard Hero Avatar Source Fix Audit

Date: 2026-07-06

## Scope

Audited the existing Brand Brain / Brand Avatar implementation and updated only the Dashboard hero avatar source lookup. This does not implement Active Brand, Brand records, APIs, Brand Avatar generation changes, Brand Core persistence changes, routing changes, Canvas changes, autosave changes, or new Brand data writes.

## Brand Avatar rendering source

The Brand Brain avatar section renders from the accepted Brand DNA result passed into `renderBrandAvatarSection(result)`. That renderer only appears once the Brand DNA result is user-approved, then normalizes `result.avatar` and displays `avatar.imageUrl` inside `#brand-avatar-preview` when an image exists.

The accept flow stores the accepted avatar image at:

```text
state.brandCore.brandDNA.avatar.imageUrl
```

The accepted state is represented by both:

```text
state.brandCore.brandDNA.userApproved === true
state.brandCore.brandDNA.avatar.userApproved === true
```

The same accepted avatar source is also exposed by the existing `getApprovedBrandAvatarUrl()` helper for AI Review post-it avatars.

## State, storage, and hydration

Brand Brain state is scoped by board through `brandBrainStorageKey()`, using `brandBrainState:<boardId>` when a board id exists and `brandBrainState` otherwise. Saves serialize `state.brandCore` into that key through `saveBrandBrainState()`.

Board loads hydrate `state.brandCore` from `data.brand_core_snapshot` when present, normalize that snapshot, render the Brand Core UI, and save the hydrated snapshot back through the existing Brand Brain state path without marking the board dirty.

## Why Dashboard fell back to `B`

The previous Dashboard resolver could read `state.brandCore.brandDNA.avatar.imageUrl`, but the Home view activation path did not render the Dashboard hero. `setActiveView("home")` refreshed the other Dashboard cards but skipped `renderDashboardHero()`, so the initial server-rendered/static neutral `B` remained in place after Brand Brain state loaded.

The previous resolver also did not explicitly use the existing accepted-avatar helper/source contract. This made the Dashboard source less aligned with the Brand Brain / AI Review code path that treats the accepted avatar as `state.brandCore.brandDNA.avatar.imageUrl` only when both Brand DNA and avatar acceptance flags are true.

## Fix

The Dashboard resolver now reads the same existing accepted Brand Avatar source exposed by `getApprovedBrandAvatarUrl()`, sanitizes it through the Dashboard safe image URL guard, and renders it before any initial fallback. If no accepted avatar image exists, the Dashboard keeps the existing initial fallback behavior.

The Home view activation path now calls `renderDashboardHero()` alongside the other Dashboard renderers, so Brand Brain / Brand Avatar state that has already loaded is reflected when the Dashboard opens.

## Read-only guarantee

The Dashboard hero reads `state.brandCore.brandDNA.avatar.imageUrl` passively via the existing helper. It does not mutate `state.brandCore`, persist Brand data, call APIs, generate avatars, or invent fallback image data.
