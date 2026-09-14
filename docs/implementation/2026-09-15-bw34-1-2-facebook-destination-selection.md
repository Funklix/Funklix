# BW-34.1.2 — Facebook Page destination selection

## Root cause and failed boundary

Facebook OAuth persisted the connected account and discovered Page rows, but it marked every eligible Page `active=true`. The Social Connections response then treated `active` merely as eligibility, omitted a selected/default marker, and exposed the provider Page identifier. In the browser, the selector silently chose the only first option and its `change` handler only mutated module memory and printed `Connected Page`; it never called a server persistence route. A reload therefore reconstructed an arbitrary/empty destination state, while Content Workspace ignored the Facebook destination in the canonical response and consulted that transient module value. This combination created the production loop.

## Authoritative model

No parallel preference was added. The existing provider-neutral `public.social_publishing_destinations.active` flag is the authoritative selected/default destination marker. `status='active'` plus `authorization_state='authorized'` and `CREATE_CONTENT` represent current eligibility; `active=true` represents selection. The selection transaction is scoped by the signed-session owner, the active Facebook connected account, its live credential envelope, and the internal destination UUID. It checks account/provider/owner/connection/type/status/authorization/capability/scope/token validity before atomically clearing sibling selections and selecting the requested row.

The public response contains only the internal destination UUID, display label, type, bounded capability, and selected state. It no longer returns the Facebook Page's provider identifier or any credential material.

## OAuth selection and invalidation

OAuth destination refresh first marks previous destinations unavailable and unselected, then upserts the newly discovered eligible Pages. Exactly one eligible Page is written `active=true` inside the same account/credential/destination transaction before redirect. Multiple eligible Pages are all written unselected and require the explicit selection route. Zero eligible Pages retains the established localized diagnostic without inventing a destination or weakening the credential-envelope contract.

Disconnect revokes the credential and marks destinations unauthorized/unselected. OAuth refresh invalidates missing/deleted/ineligible Pages. Projection and explicit selection additionally reject disconnected accounts, missing/revoked/expired credentials, missing required scopes, foreign destinations, wrong connected accounts, non-Page destinations, unavailable/unauthorized rows, and rows without `CREATE_CONTENT`.

## Reload and Content Workspace synchronization

`GET /api/social-connections` now returns all eligible Facebook choices and marks only the coherent authoritative selection. The Facebook client renders a real disabled placeholder when none is selected. It sends one `{ destinationId }` request, disables the selector while awaiting it, accepts only the server-confirmed destination, treats the current selection as a no-op, and restores the previous projection on failure.

Opening and closing Social Connections performs a bounded canonical refresh. The connection-change event rerenders an open Content Workspace. Facebook publish preflight also derives its destination directly from the just-fetched canonical response instead of stale selector/module state. Consequently every Facebook card shares the same account-level selection across Board reloads and switches.

## UI cleanup and localization

The card distinguishes `Connected` from `Connected Page`, labels a selected value `Facebook Page`, shows the Page name rather than an ID, and retains `Disconnect`. Saving feedback says `Facebook Page saved.` rather than duplicating `Connected Page` beneath the card. Pending, saved, and failure messages are localized in English and German and remain in the existing accessible live region.

## Database decision

No migration is required. The repair uses the existing provider-neutral destination row and `active` column, so BW-33.5/BW-33.5.1 RLS and revoked browser-role privileges remain unchanged. No SQL was executed remotely.

## Files changed

- `api/social-connector/facebook-service.js`: OAuth auto-selection and authoritative selection transaction.
- `api/social-connector/storage.js`: selected-destination projection and safe destination fields.
- `api/social-connections.js`: coherent/sanitized Facebook projection.
- `api/social-connections-facebook-destination.js`: authenticated selection endpoint.
- `facebook-connections-settings.js`: placeholder, awaited persistence, rollback, and canonical state.
- `app.js`: bounded settings refresh and canonical preflight destination.
- `language.js`: German save-state copy.
- `scripts/check-bw34-1-2-facebook-destination-selection.js`, `package.json`, `.github/workflows/runtime-boot-safety.yml`: regression and boot registration.

## Regression coverage

`check:bw34.1.2` runs production normalization, selector, publishing eligibility, and selection service functions with invented in-memory fixtures. It reproduces the historical UI-only selection/reload loss and covers one/multiple/zero Page representation, placeholder behavior, request shape, ownership and capability rejection, server confirmation, idempotence, rollback, reload normalization, shared Content Workspace readiness, refresh boundaries, credential isolation, raw-ID omission, localization/UI cleanup, LinkedIn isolation, and the absence of browser-storage authority. It makes no network, Meta, PostgreSQL, credential, or publication request and is registered immediately after BW-34.1.1.

## Deployment requirements

Deploy the changed application/server files through the normal release process. No Meta setting, Facebook scope, Graph API version, callback URL, Vercel variable, encryption key, credential, database migration, manual Graph API action, or Facebook test post is required.
