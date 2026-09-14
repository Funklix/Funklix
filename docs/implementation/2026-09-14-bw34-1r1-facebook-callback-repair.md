# BW-34.1R1 — Facebook OAuth callback repair

## Diagnosis and exact callback map

The production route performs these operations, in order:

1. validates the signed application session and derives the owner;
2. parses callback query parameters;
3. hashes `state` and locks the matching `social_oauth_attempts` row;
4. validates owner, provider, session fingerprint, expiry, and unused status;
5. consumes the state and commits that short transaction;
6. exchanges the authorization code (`GET /v24.0/oauth/access_token`);
7. retrieves granted permissions (`GET /v24.0/me/permissions`);
8. verifies exactly `pages_show_list`, `pages_manage_posts`, and `pages_read_engagement`;
9. retrieves the authorizing identity (`GET /v24.0/me?fields=id,name`);
10. discovers Pages (`GET /v24.0/me/accounts?fields=id,name,tasks,access_token`);
11. normalizes returned `tasks` string arrays;
12. retains Pages containing `CREATE_CONTENT` and a Page access credential;
13. constructs the user credential envelope;
14. adds Page credentials and AES-256-GCM encrypts the complete envelope;
15. begins one write transaction, inserts the secret, and upserts the connected account;
16. disables old destinations and upserts every eligible destination;
17. revokes the replaced secret and commits; any account/destination failure rolls back all writes;
18. redirects with `facebook_connected` on success;
19. otherwise logs one bounded failure event and redirects with a stable reason plus support correlation ID;
20. `/api/social-connections` reads the owner-scoped account/destination projection and the settings UI renders it.

The four observed outbound GETs map exactly to steps 6, 7, 9, and 10 and to `exchangeAuthorizationCode`, `discoverPermissions`, `discoverAccount`, and `discoverDestinations`. After request four, the old implementation copied Page credentials into `credential.pageTokens`, removed them from Page objects, and called `token-vault.seal` before any database write.

## Proven root cause and reproduction

The exact failure is proven at **credential encryption (step 14)**. BW-34.1 built `{ accessToken, pageTokens }`, while the existing token vault accepted only string-valued `accessToken`, `refreshToken`, `clientSecret`, `tokenType`, and `scope`. The `pageTokens` object deterministically raised `connector_contract_invalid`. BW-34.1 caught that together with persistence failures as `facebook_storage_failed`; its route then reduced this to the generic browser failure and logged nothing. This matches four completed requests followed by a 303 and no stored connection.

The R1 regression executes the real service/adapter/vault path. It asserts that the committed BW-34.1 vault contract lacks `pageTokens`, reproduces the four-request boundary, and proves the repaired flow encrypts and persists the account and eligible Page.

## Repair

The token vault now accepts one narrowly validated `pageTokens` object: a non-empty plain mapping of bounded provider identifiers to bounded credential strings. Existing LinkedIn string-only envelopes remain valid. The callback service now retains single-use state, separates encryption/account/destination stages, rolls back the complete write transaction, counts all and eligible Pages, and returns stable safe reasons. Multiple Pages are accepted when at least one is eligible; tasks are de-duplicated; unrelated or ineligible Pages do not abort discovery. No permalink is part of connection discovery.

Every callback failure emits exactly one `console.error` JSON event (captured by Vercel) containing only: event name, correlation ID, provider, stable stage/code, optional bounded HTTP status, required-scope presence, numeric Page counts, five-character PostgreSQL code, and a syntactically bounded constraint name. Arbitrary errors are never serialized. Redirects contain only the stable reason and correlation ID. Authorization code, state, all credentials/secrets, response bodies, identity/Page/Board/Brand data, cookies, sessions, email, and connection strings are excluded. English and German messages render each safe reason; the support reference remains secondary inline text.

State is still consumed before provider calls, so callback replay is rejected. A failure does not prevent the unchanged start route from issuing a fresh one-use attempt.

## Database/schema conclusion

**No migration is required.** The committed schema uses text for Facebook identity/Page IDs, JSONB arrays for scopes/capabilities, nullable token expiry/display fields where appropriate, and matching unique conflict targets. All relevant platform checks (`social_token_secrets`, `social_connected_accounts`, `social_oauth_attempts`, `social_provider_attempts`, and `social_external_posts`) already include `facebook`. Account insertion precedes destination insertion under the existing composite foreign keys. The encrypted payload remains beneath the existing 32 KiB constraint and schema version remains 1.

The existing ordinary (not forced) RLS and restrictive `anon`/`authenticated` deny policies do not change; the private server role model is preserved. No schema bootstrap or applied migration was rewritten. Thus no verification or rollback SQL artifact is appropriate.

## Files changed and coverage

- `api/social-connector/token-vault.js`: compatible Page-credential envelope validation.
- `api/social-connector/facebook-adapter.js`: total Page count alongside eligible results.
- `api/social-connector/facebook-service.js`: explicit stages, safe reasons, atomic persistence diagnostics.
- `api/social-connections-facebook-callback.js`: one bounded log event and safe correlation redirect.
- `facebook-connections-settings.js`, `language.js`: English/German safe failure display and support reference.
- `scripts/check-bw34-1r1-facebook-callback-repair.js`: isolated no-network/no-database regression.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: `check:bw34.1r1` immediately after BW-34.1.

Coverage includes the exact four requests; account/destination success; the historical envelope mismatch; encryption; task normalization; one eligible among multiple Pages; missing task/scope; provider stage failures; account/destination database failures and rollback; replay rejection and a fresh attempt; safe redirects/logs/correlation; database metadata allowlisting; secret omission; and unchanged LinkedIn source. Fixtures are invented and no external system is contacted.

### Clean-checkout CI correction

The first R1 regression imported the callback before installing a storage double. That import synchronously loaded `api/_boards-storage.js`, whose first line legitimately imports the production `pg` dependency. Runtime Boot Safety intentionally does not install packages. Local validation therefore produced a false positive solely because an untracked `node_modules/` supplied `pg`; a clean GitHub Actions checkout failed with `MODULE_NOT_FOUND` before assertions ran.

The regression now follows the predecessor Social Connector pattern: it saves the relevant CommonJS cache entries, installs bounded storage and route-base doubles **before** importing the real callback, executes the production callback handler against the real Facebook service/adapter/vault with deterministic pool and fetch doubles, and restores the loader cache, environment, and global fetch in `finally`. The exact Runtime Boot Safety command was also run from a Git archive containing neither `.git` nor `node_modules`, with parent/global module lookup disabled, and required no package installation. Production modules and behavior are unchanged by this CI-only correction.

## Deployment and one production verification

1. Merge and deploy the code.
2. Click **Connect Facebook** once and confirm the eligible Page appears; if it does not, provide only the displayed support reference so the single sanitized Vercel event can identify the stage.

Do not repeat Graph API Explorer testing and do not publish a manual Facebook post.
