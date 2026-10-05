# BW-36.13R1 — Phase 0 Workspace stability and Brand-logo containment

## Evidence ledger and verified causes

- **Verified source cause:** both server projection and browser validation treated optional Brand-logo metadata as part of the all-or-nothing Workspace catalog contract. A malformed revision, source, MIME type, or URL therefore rejected otherwise authorized context.
- **Verified source cause:** catalog refresh replaced the confirmed value with `null`; every transport failure consequently looked empty/unavailable. There was no stale state or retry affordance.
- **Verified source cause:** every sidebar reconciliation called `close(false)`. This synchronously removed the body-owned Workspace menu even when the same authorized Workspace remained active. The listener itself remains attached to the static trigger; no detached-listener cause was invented.
- **Verified source cause:** Board-local upload called the retired route, coerced its structured error through `Error`, and reached native `alert()`. Reusable upload/discovery were separate mutation entry points.
- **Production observation (audit):** the owner ellipsis and Workspace catalog were unreliable, and Board-local logo upload displayed `[object Object]`.
- **Remaining hypothesis:** the audit's other possible deployed hit-target, overlay, stacking, and asset-version causes remain unproven. This repair only addresses the reproducible reconciliation close and retains the established portal positioning/outside-click implementation.

## Containment and resilience boundary

The reversible application gate suppresses reusable logo upload/change/remove and website discovery, and Board-local upload/remove. Existing logo reads remain. Missing, malformed, unsupported, or failed images render Unicode initials locally. Routes, storage code, metadata, objects, columns, and the private `brand-logos` bucket are unchanged.

The server and browser now agree that unusable optional logo data is `{logo_url:null, logo_revision:0}`. Required UUIDs, identities, roles, Workspace relationships, Board-to-Brand relationships, duplicates, membership, and authorization stay strict and fail closed. `workspace_catalog_v1` is unchanged. Workspace membership still never grants Brand/Board authority; Board-only and public-token paths are untouched.

## Catalog lifecycle and Workspace actions

A same-account refresh retains the confirmed catalog. Retryable transport/server failures mark it stale, disable selectors and mutations, and show exactly one localized Retry action. A confirmed empty success is ready/empty. Authentication, disabled identity, membership/permission, integrity, account change, and sign-out clear protected context. Generation and identity checks reject stale responses; the in-flight promise deduplicates Retry. No browser persistence was added.

The Workspace menu remains one body-owned menu with Rename as its sole item. Reconciliation preserves an open menu/dialog only while the same Workspace remains ready and authorized. Context loss closes it. Existing cancel, Escape, outside click, submit, bounded inline failure, input retention, and focus restoration paths remain. Compact rail/mobile intentionally suppress management; selectors, Canvas toolbar, and compact context bar are unchanged.

New visible copy is exact and localized:

- English: “Workspace temporarily unavailable. Showing the last confirmed context.” / “Retry” / “Logo changes are temporarily unavailable.”
- German: “Workspace vorübergehend nicht verfügbar. Der zuletzt bestätigte Kontext wird angezeigt.” / “Erneut versuchen” / “Logoänderungen sind vorübergehend nicht verfügbar.”

## Deployment, rollback, and manual acceptance

Deploy the complete application bundle together; there is no migration or manual SQL. Preserve the deployed BW-36.12 schema, metadata, stored objects, and private bucket. Roll back only by reverting this Phase 0 application commit—never remove schema or storage.

Manually verify an owner/admin and member/viewer fixture at desktop, compact rail, mobile, light/dark, keyboard, and 200% zoom: confirmed context survives an injected 5xx and Retry; empty success is empty; permission loss/sign-out clears; one ellipsis menu opens before/after reconciliation; rename cancel/success/failure restores focus and retains failed input; malformed and failed logos show initials; no logo mutation action or native alert is reachable. Confirm selectors still work and Canvas/compact bars are byte-behaviorally unchanged.

Authenticated preview evidence was not available in the implementation environment, so automated DOM/request fixtures are not represented as screenshots.

## Explicitly deferred

Phases 1–4 remain deferred: project/Workspace/Brand/Board creation, selection persistence, Brand setup and discovery improvements, SVG work, Profile/snapshot IA, downstream Campaign/Calendar/export work, and redesign. No provider, AI, CDN, background discovery, migration, RLS, bucket-policy, dependency, or framework work is included.
