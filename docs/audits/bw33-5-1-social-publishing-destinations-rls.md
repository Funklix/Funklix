# BW-33.5.1 — Social publishing destination RLS delta audit

**Decision:** GO for a one-table, unapplied delta. Production reported `public.social_publishing_destinations` as the sole remaining Security Advisor error after BW-33.5 protected its original 13 tables. This work does not revise the applied migration.

## Creation, history, and stored information

`api/social-connector/schema.js` creates the table in the server-only Social Connector bootstrap. Git history shows the destination table entered with the original Social Connector foundation on 2026-09-03 and was already present before BW-33.5 on 2026-09-11. It was therefore omitted from the BW-33.5 inventory; it was not created after that inventory. No committed migration previously changes its RLS, policies, owner, or grants.

The table stores the owning application account identifier, connected-account relationship, external destination identifier, destination type/display name, provider capabilities, authorization state, availability status, active state, and timestamps. It stores publishing/provider configuration and ownership metadata, but no plaintext token or credential; encrypted credential material belongs to `social_token_secrets`.

## Complete access inventory

All runtime references are server-side and use the authoritative `pg.Pool` exported by `api/_boards-storage.js`, whose only connection setting is `POSTGRES_URL`. No browser Supabase client, Data API route, Supabase credential, or direct `anon`/`authenticated` authorization path exists.

| Operation | Server path | Preceding authorization/binding |
|---|---|---|
| SELECT | `social-connector/storage.js`: owner-scoped `getDestination`; owner-scoped Social Connections projection | API obtains a signed Google-session account identifier; storage validates the identifier and filters by `owner_account_id`. |
| SELECT | `social-connector/linkedin-service.js`: committed-callback consistency inspection | Callback requires a signed session and binds OAuth attempt, connected account, secret, and destination to the same owner. |
| SELECT | `social-connector/publishing-service.js`: destination/job validation and destination lookup | Publishing route requires a signed session; service binds destination to owner and requires Board edit authority, current approval fingerprint, destination capability, and publishing safety checks. |
| INSERT / UPDATE | `social-connector/linkedin-service.js`: destination upsert after LinkedIn callback | Signed session, OAuth state/session fingerprint, owner, provider identity, sealed credential, and connected-account transaction checks precede the upsert. |
| UPDATE | `social-connector/linkedin-service.js`: destination deactivation during disconnect | Signed session and owner-scoped connected-account lookup precede the update. |
| DELETE | No direct repository path | Foreign keys deliberately use `ON DELETE RESTRICT`; the application does not delete destination rows directly. |

`social_publish_jobs` and `social_external_posts` also reference the table through owner-bound foreign keys. `anon` and `authenticated` require no direct table privileges. The verified production application role is `postgres` with `BYPASSRLS`, so ordinary, non-forced RLS preserves the established server path.

## Public-table inventory

Repository runtime DDL represents 16 user-created tables in the effective/public application schema:

- the BW-33.5 protected 13: `boards`, `brands`, `social_publish_jobs`, `social_provider_attempts`, `brand_documents`, `brand_document_upload_intents`, `brand_document_processing_jobs`, `brand_document_processing_results`, `social_external_posts`, `brand_members`, `social_token_secrets`, `social_connected_accounts`, and `social_oauth_attempts`;
- this delta: `social_publishing_destinations`;
- separately inventoried objects: `board_editors` and the internal `social_connector_schema_version` migration ledger.

The supplied post-BW-33.5 production Advisor result identifies only `social_publishing_destinations` as unprotected. Accordingly, the protected finding-driven inventory becomes exactly 14 tables. The two separately inventoried objects are not silently treated as part of this delta; neither has a remaining production Advisor error in the supplied state. Any future Advisor finding for either is a stop condition requiring its own production-state preflight and separate migration.

## Delta safety

The delta checks table existence and rejects every policy name except `bw33_5_deny_supabase_api_roles` before mutation. It then enables ordinary RLS, revokes all table privileges from both browser roles, and conditionally creates the same restrictive false/false policy as BW-33.5. It does not force RLS or change data, schema shape, owner, sequences, indexes, constraints, columns, or triggers. The separate verification is read-only. Emergency rollback removes only this policy, restores the reported prior disabled-RLS state, and deliberately does not recreate browser grants.

SQL behavior is statically verified because this repository has no disposable PostgreSQL environment. Manual Supabase execution and verification remain required.
