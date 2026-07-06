# Dashboard Hero Avatar Source Audit

Date: 2026-06-29

## Scope

Audited the Dashboard hero avatar source only. This change does not implement Active Brand, Brand records, APIs, Brand Core persistence changes, routing changes, Dashboard ownership changes, AI Brain changes, Canvas changes, autosave changes, or new Brand data writes.

## Existing Brand Core / Brand DNA signals

`state.brandCore` already carries read-only runtime Brand Brain signals, including:

- `brandAssets.logo`, plus other Brand Asset fields.
- `brandDNA`, which can include an `avatar` object.
- Additional possible Brand identity fields if loaded from existing persisted state or server snapshots, such as `brandName`, `name`, `title`, `avatarImageUrl`, `avatarUrl`, `avatarInitial`, `avatarIcon`, `initial`, or `icon`.

The normalized Brand DNA avatar shape currently supports `avatar.imageUrl`, `avatar.prompt`, `avatar.style`, `avatar.generatedAt`, and `avatar.userApproved`. The Dashboard resolver reads these fields but never writes to them.

## Available avatar sources

The best existing image signal is an existing Brand DNA avatar image URL, followed by existing Brand image/logo fields. If no safe image URL exists, the resolver checks explicit avatar/icon/initial fields, then Brand name-like fields.

## Fallback order implemented

1. Existing Brand avatar image URL if safely available (`http:`, `https:`, `data:image/`, or `blob:`).
2. Existing Brand avatar/icon/initial field if available.
3. Brand Core / Brand DNA / Brand Asset name or domain initial if available.
4. Signed-in user name/email initial as the final user fallback.
5. Neutral `B` Brand fallback when no Brand or user signal exists.

## Read-only guarantee

The resolver only reads `state.brandCore`, `state.user`, and existing DOM render targets. It does not mutate Brand Core, persist Brand data, call APIs, or create/fake a Brand avatar. The Dashboard refresh path now re-renders the avatar after existing Brand Brain saves so the hero reflects current read-only state.
