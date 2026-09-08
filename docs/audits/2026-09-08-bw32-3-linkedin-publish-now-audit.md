# BW-32.3 Audit — LinkedIn Publish Now architecture and production contract

**Audit date / official-document access date:** 2026-09-08 (UTC)

**Scope:** Documentation-only audit for one immediate, text-only publication to the authenticated actor's connected personal LinkedIn profile.

**Evidence policy:** Repository source plus official LinkedIn/Microsoft documentation only for provider-contract claims. No token, encrypted payload, OAuth response, provider identifier, or personal identity is reproduced here.

## 1. Executive conclusion

**Decision: NO-GO until named official evidence and platform access exist.** The connection foundation is coherent enough to support a future publishing implementation: its accepted Settings projection reports a connected personal destination, an unexpired encrypted server-side credential, and authoritatively stored `w_member_social`. However, the adapter deliberately does not implement `publish`, no publishing route exists, and the current provider contract could not be verified at execution time.

Every request made from this audit environment to the official Microsoft Learn pages listed in §2 failed at the outbound CONNECT tunnel with HTTP 403 before page content was returned. The web research tool also returned HTTP 401. Consequently, this audit does **not** assert a current endpoint, LinkedIn version, headers, body, character limit, response identifier, retry rule, or platform entitlement from memory. The candidate contract is the **Posts API**, but even that selection remains a gate, not an implementation fact. UGC Posts API and Shares API must not be selected as historical fallbacks without current official evidence.

The smallest reliable Funklix architecture, once all gates pass, is a durable `PublishJob` created synchronously by a confirmation route and executed by a separately invoked server worker. The worker persists a `ProviderAttempt` before the network call, never holds a PostgreSQL transaction during that call, and durably commits `ExternalPost` before any UI says “Published.” There is no blind retry after an ambiguous network result.

Phase 1's only publishable body is the current authoritative Canvas node's `social.caption`, normalized deterministically without rewriting it. The title, internal `content` summary, standalone hashtag/CTA fields, links, media, hidden metadata, planning schedule, comments, and AI output are excluded. Publication never mutates Canvas, editorial status, or `planningSchedule`.

## 2. Verified official LinkedIn contract

### 2.1 Access record

The following are the official LinkedIn/Microsoft pages that must be read and archived in the BW-32.3.1 implementation evidence. “Page title” is deliberately marked unverified because no response body was available; a title is not inferred from a URL slug.

| Official documentation URL | Page title | Access date | Result |
|---|---|---|---|
| <https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |
| <https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |
| <https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts/rate-limits> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |
| <https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |
| <https://learn.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |
| <https://learn.microsoft.com/en-us/linkedin/marketing/versioning> | **Unverified** | 2026-09-08 | CONNECT tunnel rejected with HTTP 403; no page content |

These URLs identify the required official evidence set; listing them is not evidence of their contents. A human or controlled environment with access must record URL, returned title, page “last updated” date, selected `view`/version, and the relevant sections verbatim enough to permit review (within documentation-license limits).

### 2.2 Contract matrix

| Contract-sensitive item | Audit finding on 2026-09-08 | Implementation consequence |
|---|---|---|
| Publishing API family | **Unverified.** Posts API is the candidate current surface. UGC Posts and Shares are not approved alternatives. | Gate endpoint selection; do not implement from historical examples. |
| Endpoint and HTTP method | **Unverified** | No provider request builder may ship. |
| API version / version header | **Unverified** | A pinned, currently supported version and exact header are mandatory. |
| Required headers | **Unverified**, including authorization, protocol/version, content type, and any REST.li header | Verify exact names and values. Tokens remain server-side. |
| OAuth scope | Locally stored permission is `w_member_social`; whether it is the current official requirement is **unverified**. | Officially prove scope and product relationship. |
| Member author identifier | **Unverified.** Existing identity is an OIDC `userinfo.sub`; equivalence to the required publishing author/member URN is not proven. | A controlled identity proof is mandatory; never synthesize a URN. |
| Request body | **Unverified**, including author, commentary/text, distribution/visibility, lifecycle, and content shape | Validate an allowlisted exact schema. |
| Text length/counting | **Unverified**, including units (code points, UTF-16 units, bytes) and URL treatment | No hard-coded “LinkedIn maximum” until proven. Never truncate. |
| Visibility options/default | **Unverified** | Phase 1 must select one explicitly verified member-post visibility; no default assumption. |
| Success HTTP status | **Unverified** | Do not assume 201 in production code or claim live proof from a mock. |
| Returned post identifier/header/body | **Unverified** | ExternalPost commit requires the officially documented identifier source. |
| Duplicate/idempotency behavior | **Unverified; no safe provider idempotency mechanism is assumed.** | Funklix provides durable local deduplication; ambiguous calls are not retried blindly. |
| Rate limits | **Unverified**, including app/member quotas and headers | Implement conservative application rate limits; provider 429 is classified without an assumed reset formula. |
| Retry guidance | **Unverified** | Only definitely pre-send failures may be retried automatically; ambiguity requires reconciliation/support. |
| Error response categories | **Unverified** | Map HTTP/status categories without persisting or returning raw response bodies. |
| Token requirements | OAuth access token is stored locally with a token type and expiry; current official token form/lifetime/refresh/revocation rules are **unverified**. | Verify Bearer semantics, expiry, refresh availability, and revocation behavior. |
| Development vs production restrictions | **Unverified** | Prove with the exact app/product and a controlled production-capable member. |
| Application review/product access | **Unverified** | Product grant/dashboard evidence and a successful controlled call are hard gates. |
| Member-posting restrictions | **Unverified**, including content policy, member eligibility, and audience restrictions | Document and test restrictions before launch. |
| Editing/deletion | **Unverified** | Both are excluded. Manual deletion is a live-smoke prerequisite, not an API promise. |
| Webhooks/reconciliation/lookup | **Unverified** | No automatic unknown-outcome reconciliation is promised. |
| Personal text publishing | **Unverified at execution time** | NO-GO even though local permission projection is coherent. |

### 2.3 Required official contract evidence

Before coding, attach a dated evidence record showing the current official endpoint and method; pinned version/header; all required headers; `w_member_social`; exact personal author format and proof that OIDC `sub` is or is not sufficient; exact text-only request and visibility; maximum length and counting rule; expected success status and identifier location; error taxonomy; quota/rate headers; retry guidance; provider idempotency or its absence; token constraints; application product/review state; development/production restrictions; member restrictions; lookup/reconciliation/webhook availability; and edit/delete support. Until that record exists, the official endpoint and version are reported as **unverified**, not guessed.

## 3. Current Funklix connection capability

### 3.1 Trace and findings

| Layer | Current behavior | Audit decision |
|---|---|---|
| Settings projection | Owner-scoped storage projection joins account, secret metadata, and one destination. A connection is coherent only with connected status, valid/non-revoked secret, available vault key version, non-expired token, active destination, and personal identity. | Good fail-closed presentation boundary. The confirmed production projection reports coherent connection, permission, and the stated future expiry without exposing secrets. |
| Connected Account | Stores owner, platform, external account reference/display name, personal account type, status, granted scopes, token-secret reference, expiry, and timestamps. | `w_member_social` is **authoritatively persisted from the token response's returned scope string**, not inferred merely from configuration. If the token response omits scope, fallback is identity scopes only, so publishing permission fails closed. |
| Publishing Destination | Connection completion creates/updates an owner-scoped, personal destination whose external destination reference is copied from discovered account identity. | It contains an identity reference, but official evidence does not prove that this OIDC `sub` is the exact Posts API author value. Gate 13 fails until proven. |
| Token Secret | AES-256-GCM ciphertext, nonce, authentication tag, key version, owner/platform/secret-bound AAD, and revocation timestamp are server-side. | Decryption is available only to server code holding the configured vault key and correct owner/platform/secret context. No browser path returns plaintext. |
| Token type and expiry | Exchange stores the returned token type, defaulting to `Bearer`, inside the encrypted credential; expiry is computed from returned `expires_in`. Settings marks an expired credential incoherent. | Type is known in the vault but defaulting must be checked against the official contract. Expiry is enforced in projection and must be re-enforced at publish time. No refresh operation is implemented. |
| Reconnect | Callback locks the current active connection, rejects identity changes, writes a new sealed secret, updates account/destination, then revokes the old secret in the same transaction. | Safe replacement for the same member; rollback preserves the prior state. Orphan cleanup/retention remains an operational concern only after committed replacement. |
| Disconnect/revocation | Disconnect marks the account disconnected, revokes the secret, and disables destinations locally. Adapter reports no remote revocation support. | New publishing must fail closed for disconnected/revoked state. Official remote revocation behavior remains unverified. |
| Adapter registry | Registry recognizes a `publish` operation in the generic contract. | Framework-ready, but registration alone is not capability. |
| LinkedIn adapter | Exposes authorization, exchange, identity/destination discovery, capability inspection, and local-revocation semantics. `getCapabilities` returns publishing permission separately from `publishingImplemented: false`; adapter capabilities omit `publish`. | Publishing is **technically absent**, not merely hidden by product policy. There is no provider publishing request in current production code. |
| Ownership | Account, secret, and destination queries are owner-scoped; production connection is personal to the authenticated Funklix account. | Phase 1 requires the publishing actor to own the connection. Board edit rights never delegate another person's credential. |

The accepted production state establishes local readiness of the connection foundation, not official platform authorization to post. No production identifiers or personal data need to be copied into this audit.

## 4. Publishable content source

### 4.1 Authoritative source

For a current authoritative Canvas node whose canonical role is `Social Media Posting` and platform normalizes exactly to LinkedIn, **the complete post body is `node.social.caption` and only that field**. Repository generation guidance explicitly treats it as full publish-ready copy while `node.content` is an internal summary. User edits already flow into the current Canvas node and its material fingerprint. The publisher must reload the Board/node server-side; it must never trust a caption supplied by the browser.

Excluded from composition: `title`, `content`, `social.hashtags`, `social.cta`/`social.preview`, node-level CTA, language labels, links metadata, media/images, generated variants, hidden metadata, Post-its, AI Review, Brand Core, coordinates, ownership display fields, and `planningSchedule`. A title, hashtag, CTA, or URL publishes only if the user already placed its characters inside the approved `social.caption`. URLs remain plain text. There is no AI call, rewrite, tracking parameter, enrichment, hashtag append, or link-preview object during publishing.

### 4.2 Deterministic normalization

1. Require a JavaScript string; reject all other types.
2. Reject NUL and unpaired UTF-16 surrogates. Preserve valid Unicode exactly; encode the request as UTF-8 JSON.
3. Normalize CRLF and lone CR to LF. This is the only line-ending transformation.
4. Remove Unicode BOM only if it is the first code point.
5. Remove trailing spaces and tabs from each line. Do not collapse internal spaces, blank lines, or paragraphs.
6. Remove leading and trailing **blank lines** only. Do not call a broad whitespace collapse and do not normalize Unicode (NFC/NFKC), smart quotes, emoji, or directionality characters.
7. Reject if the result has no non-whitespace Unicode character (`PUBLISH_BODY_EMPTY`).
8. Count using the officially verified LinkedIn counting algorithm. Until verified, eligibility is blocked with `PROVIDER_TEXT_LIMIT_UNVERIFIED`. At the verified maximum, accept; above it, reject with count and limit but never truncate.

This normalized body is previewed exactly, fingerprint-bound, and stored immutably. Because line-ending/trailing-space normalization changes bytes, the dialog must preview the normalized result before confirmation; the approval-material fingerprint remains that of the current node, while `content_digest` covers the exact outbound normalized body.

### 4.3 Exact Phase 1 content envelope

One text body, one personal destination, immediate delivery, one approved revision. Excluded: image, video, carousel, document, organization page, multi-destination fan-out, external scheduling, edit, delete, analytics, native rich-link payload, and browser timer.

## 5. Eligibility model

Implement one pure `evaluateLinkedInTextPublishEligibility(input) -> {eligible, blockingCodes, facts}`. It has no I/O, time lookup, mutation, provider call, or AI call; its caller supplies an authoritative `now` and already resolved facts. Return all applicable stable codes in the order below, with no secret/personal values.

| Code | Blocking condition |
|---|---|
| `AUTHENTICATION_REQUIRED` | No authenticated Funklix actor/account |
| `BOARD_EDIT_ACCESS_REQUIRED` | Actor lacks current Board edit access, including viewer/Public Viewer |
| `BOARD_NOT_AUTHORITATIVE` | Board missing, stale, mismatched, or not freshly server-loaded |
| `NODE_NOT_AUTHORITATIVE` | Node missing/mismatched in the authoritative Board |
| `NODE_ROLE_UNSUPPORTED` | Role is not canonical Social Media Posting |
| `PLATFORM_NOT_LINKEDIN` | Platform is absent or not LinkedIn under the one documented normalization |
| `READINESS_INCOMPLETE` | Deterministic readiness is not acceptable (Phase 1 requires `Ready`, not “Needs attention”) |
| `EDITORIAL_APPROVAL_REQUIRED` | Normalized editorial state is not Approved |
| `APPROVAL_FINGERPRINT_MISSING` | No approved material fingerprint |
| `APPROVAL_STALE` | Approved fingerprint differs from current material fingerprint |
| `CONNECTION_UNAVAILABLE` | No coherent connected LinkedIn account |
| `CONNECTION_OWNER_MISMATCH` | Connected account owner is not the authenticated actor |
| `CREDENTIAL_MISSING` | No current token-secret reference/record |
| `CREDENTIAL_REVOKED` | Secret or connection is revoked/disconnected |
| `TOKEN_EXPIRED` | Expiry is absent when required, invalid, or not after supplied authoritative time |
| `DESTINATION_MISSING` | No active personal publishing destination |
| `DESTINATION_OWNER_MISMATCH` | Destination/connection is not owned by actor |
| `DESTINATION_TYPE_UNSUPPORTED` | Destination is not personal |
| `PROVIDER_AUTHOR_UNVERIFIED` | Stored destination identity has not been proven to match official author contract |
| `PUBLISH_SCOPE_MISSING` | Persisted granted scopes do not include `w_member_social` |
| `ADAPTER_CAPABILITY_UNAVAILABLE` | Adapter lacks exact `publish_member_text_now` implementation |
| `PROVIDER_CONTRACT_UNVERIFIED` | Endpoint/version/header/body/success contract is not approved |
| `PROVIDER_TEXT_LIMIT_UNVERIFIED` | Official length/counting rule is unavailable |
| `PUBLISH_BODY_INVALID_UNICODE` | NUL/unpaired surrogate or disallowed provider character rule |
| `PUBLISH_BODY_EMPTY` | Normalized caption is empty |
| `PUBLISH_BODY_TOO_LONG` | Verified count exceeds verified maximum |
| `REVISION_ALREADY_PUBLISHED` | Successful ExternalPost exists for identity |
| `PUBLISH_JOB_ALREADY_ACTIVE` | Existing job owns identity and is queued/sending/unknown/reconciliation-required |
| `PUBLISHING_DISABLED` | Server kill switch/product policy disables execution |

Eligibility today is **false** because provider contract/author identity/length are unverified and the adapter capability is absent. Internal planning eligibility, deterministic readiness, editorial approval, external eligibility, job delivery result, manually stored `Published`, and performance availability remain separate values. None implies another.

## 6. Immutable snapshot

At explicit confirmation, after a second authoritative reload and eligibility check, create bounded JSON with this logical schema:

```json
{
  "schemaVersion": 2,
  "publishActionVersion": "linkedin-member-text-now-v1",
  "ownerAccountId": "internal reference",
  "boardId": "internal reference",
  "nodeId": "Board-local reference",
  "nodeRole": "social_media_posting",
  "approvedMaterialFingerprint": "immutable fingerprint",
  "textBody": "exact normalized approved caption",
  "contentDigest": "sha256 base64url over a domain-separated UTF-8 body",
  "responseLanguage": "en or de",
  "destinationId": "internal reference",
  "connectedAccountId": "internal reference",
  "platform": "linkedin",
  "providerAuthorIdentityReference": "server-only stored reference",
  "publishJobId": "internal reference",
  "idempotencyKey": "bounded digest",
  "createdAt": "server timestamp",
  "requestedByActor": "internal account reference",
  "sourceAction": "content_workspace_publish_now"
}
```

Generate the job UUID before insertion so it is embedded consistently. IDs in authenticated job/status responses are safe internal references; the provider-author reference is never returned to the browser. `responseLanguage` controls bounded user messages, not post content.

Do not snapshot plaintext credentials, entire Canvas, unrelated nodes, comments/Post-its, AI Review, Inspector layout, coordinates, complete Brand Core, or provider response. The current `content_snapshot` JSONB (64 KiB) can contain the snapshot, and current top-level job columns already carry owner, Board, node, approved fingerprint, destination, mode, status, key, actor, and timestamps. It is not sufficient without an enforced snapshot schema/version and additions in §14.

## 7. Idempotency model

Canonical tuple:

`ownerAccountId + NUL + destinationId + NUL + boardId + NUL + nodeId + NUL + approvedMaterialFingerprint + NUL + "linkedin-member-text-now-v1"`

`idempotency_key = "lipub1_" + base64url(SHA-256(UTF-8(tuple)))`. IDs and fingerprint must first pass bounded canonical validation; no display name/provider ID/content or schedule participates. The server computes the key; a browser-supplied `Idempotency-Key` is only a bounded request correlation hint and cannot replace it.

Use one short transaction to recheck database-backed prerequisites and `INSERT ... ON CONFLICT (owner_account_id,idempotency_key) DO NOTHING`, then select the winner. The existing unique constraint provides durable double-click/browser/serverless dedupe. Return the existing job for the same actor and tuple. Job creation and first queued state commit before execution. A successful ExternalPost (one per job today) permanently blocks the same tuple. Active, `outcome_unknown`, or `reconciliation_required` jobs also block. A final definitely-pre-provider failure may resume the same job under explicit policy; it does not create a new identity.

A materially changed and newly approved revision changes the approved fingerprint and may create another key. Unrelated Board changes, node coordinates, comments, AI Review, and `planningSchedule` do not affect the material fingerprint/key unless the existing material-fingerprint contract deliberately includes the changed publishable field. Phase 1 must regression-lock that scheduling is excluded from identity.

Local dedupe cannot prevent a duplicate caused by “provider accepted, Funklix never received/committed evidence.” Because provider idempotency is unverified, such a job becomes unknown and cannot be automatically replayed.

## 8. Execution lifecycle

### 8.1 Boundary and architecture

Recommend **durable asynchronous execution**, not an in-request provider call. The confirmation request creates/resolves the job and returns `202 queued` (or the existing terminal state); an authenticated worker invocation claims and executes it. This adds one worker boundary but is the smallest reliable design under serverless request limits, provider latency, navigation, and future scheduling. Browser polling gives truthful feedback. A browser timer may poll status but never execute publishing.

Vercel limits are deployment-plan/runtime configuration and were not verified in this audit; design must not depend on a long foreground request. The worker itself must remain within the configured limit and use a bounded provider timeout. A queue/dispatcher must offer durable at-least-once invocation; PostgreSQL claim/lease and idempotency make duplicate invocations converge. Phase 1 remains “publish now”—the queue is reliability infrastructure, not user scheduling.

### 8.2 Exact lifecycle

1. **Request entry:** accept bounded JSON and generate/validate client correlation.
2. **Correlation:** issue server request ID; never log body.
3. **Authentication:** resolve current session actor.
4. **Board authorization:** reload Board/access and require `canEdit`.
5. **Node resolution:** parse authoritative Canvas server-side and locate exact node.
6. **Eligibility:** calculate readiness/material fingerprint/body from the same loaded node; evaluate pure contract.
7. **Destination:** owner-scope active personal destination and connected account.
8. **Credential metadata:** owner-scope non-revoked secret and expiry; do not decrypt yet.
9. **Snapshot:** create exact immutable snapshot and digest.
10. **Job:** in one short transaction insert-or-resolve the durable idempotency winner; commit queued state.
11. **Attempt:** worker atomically claims job and creates numbered `ProviderAttempt(started/sending)`; commit.
12. **Decrypt:** load/decrypt credential server-side immediately before use; zero/release references as feasible.
13. **Construct:** allowlisted official request from immutable snapshot; no Canvas reread changes it.
14. **Invoke:** bounded server-side HTTP call with verified headers/version; no open DB transaction.
15. **Classify:** reduce status/body to safe category and verified identifier only.
16. **Persist post:** for definite success, one short transaction inserts ExternalPost and completes attempt/job. If this transaction fails, mark/recover as `reconciliation_required`, never resend.
17. **Complete:** definite rejects/failures update attempt/job under guarded state transitions.
18. **Respond/project:** status route returns bounded delivery state and diagnostics; success only after ExternalPost commit.

No transaction spans steps 12–15. Claim leases must not cause replay after `sending` without proof the provider call never began.

## 9. Ambiguous outcomes

### 9.1 State vocabulary

| State | Meaning |
|---|---|
| `queued` | Job committed; no worker has begun provider delivery |
| `sending` | Attempt committed and provider call may occur/have occurred |
| `published` | Verified provider identifier and ExternalPost durably committed |
| `failed_retryable` | Definitely safe to retry under policy (normally known pre-send or explicit official safe response) |
| `failed_final` | Definite rejection/auth/content/contract failure; no automatic retry |
| `outcome_unknown` | Provider may have accepted; no durable proof either way |
| `reconciliation_required` | Unknown/success-persistence gap requires verified lookup or human operations |

### 9.2 Classification policy

| Event | State/action |
|---|---|
| Timeout/connect failure proven before request bytes could be sent | `failed_retryable`; bounded backoff only if transport can prove pre-send |
| Timeout after send or indeterminate transport phase | `outcome_unknown` → `reconciliation_required`; no replay |
| Provider 5xx | If official response proves rejection/no creation, `failed_retryable`; otherwise conservative `outcome_unknown`; no assumption today |
| Provider 429 | `failed_retryable` only under verified official retry guidance and with no ambiguous acceptance; honor verified server guidance, apply jitter/cap |
| 401 / invalid token | `failed_final`; connection `needs_attention`; reconnect |
| 403 / missing permission/product access | `failed_final`; permission/product remediation; never loop |
| 400 malformed request | `failed_final`; implementation/contract classification |
| Content rejection | `failed_final`; expose safe reason category, not raw response |
| Unknown status/body/identifier | `outcome_unknown` → `reconciliation_required` |
| DB failure before provider call | `failed_retryable` or remain queued; safe because call did not start |
| DB failure after verified acceptance | `reconciliation_required`; preserve attempt/request correlation; never republish |
| Duplicate server invocation | Claim/key constraints return existing job; only one worker owns eligible transition |
| Browser navigation | No effect; durable worker continues and status is reloadable |

### 9.3 Reconciliation boundary

If current official docs prove lookup by returned/request correlation or author-feed search with an exact, stable match, implement a separately authorized reconciler that reads but never posts. Prefer lookup by provider post ID stored in the attempt. Content/time matching alone is not sufficiently unique. If no safe lookup/idempotency contract exists—as is assumed today—support must ask the connection owner to inspect their profile, record a bounded manual resolution (`confirmed_published` with verified identifier where possible or `confirmed_not_published`), and explicitly choose whether a future deliberate republish is warranted. Automated retry remains prohibited.

## 10. ExternalPost provenance

Minimum immutable record: owner; platform; destination; Connected Account; source Board; source node; approved fingerprint; PublishJob; verified provider post identifier; server-only provider author reference; provider/verified published timestamp; canonical URL only if derivable from verified provider data; immutable normalized-body digest; delivery state; creation timestamp. It references the job snapshot rather than copying content.

ExternalPost remains revision-bound after later node edits or node deletion. `source_node_id` is historical and must not cascade. Board deletion policy must preserve or tombstone provenance; the current restrictive Board foreign key already prevents accidental loss but needs an explicit retained/tombstoned Board strategy before Board deletion. Never store raw provider responses. A later content mismatch is displayed by comparing current material fingerprint with ExternalPost's approved fingerprint; it does not alter provenance.

## 11. Permissions

| Actor | Publish control / server result |
|---|---|
| Board owner with own coherent personal connection | Eligible if every other gate passes |
| Board editor with own coherent personal connection | Eligible: Board edit permission plus actor-owned credential |
| Board editor without own connection | No publication; must connect their own profile |
| Board editor where Board owner has a connection | Must **not** use the owner's credential |
| Board viewer/read-only/brand viewer | No controls; server denies |
| Public Viewer | No controls and no publish-specific private projection; server denies |
| Connected-account owner without Board edit access | No publication |

The authenticated publishing actor must equal Connected Account owner, destination owner, token owner, job owner, and `requestedByActor`. Action-time server authorization and authoritative node state are revalidated at confirmation; worker execution revalidates connection/credential state and may revalidate Board access under product policy without substituting a new content snapshot.

## 12. UX

### 12.1 Entry point and projections

Add one **Publish to LinkedIn** action to the Content Workspace card action menu for an approved LinkedIn Social Media Posting. This is where role, readiness, approval freshness, and planning already converge. Do not initially add actions to Canvas, Inspector, or Calendar. Hidden controls for viewers are complemented by server enforcement.

After delivery, show one compact Content Workspace delivery badge/details row: “Published to LinkedIn,” personal destination display name, published time, and safe external link when verified. If the current material fingerprint differs, show “Published revision differs from current content.” A small read-only Inspector projection may be deferred; no Phase 1 Canvas-node or Calendar badge is needed. The Calendar remains exclusively internal planning. Never write delivery state into Canvas text/social fields, and never change editorial status—including manually stored `Published`.

### 12.2 Confirmation dialog

An accessible custom modal (never `alert`, `prompt`, or `confirm`) shows: connected profile display label; “Personal profile”; exact scroll-bounded normalized preview; officially counted characters and maximum; editorial `Approved`; deterministic readiness; approval freshness; and “Publishes immediately to LinkedIn; this does not use the internal Calendar.” Buttons are **Cancel** and **Publish now**.

On open, focus the heading or Cancel; trap Tab/Shift+Tab; Escape cancels only before submission; Enter activates the focused button rather than an implicit destructive default; restore focus to the originating card action on close. Disable confirmation after the first activation, set `aria-busy`, preserve the dialog during request failure, and use a polite live region. Mobile keeps actions and character count visible without hiding preview; Light/Dark and English/German must preserve meaning and contrast.

### 12.3 Truthful visible states

`checking eligibility`, `ready to publish`, `publishing` (queued/sending), `published` (ExternalPost committed), `retryable failure`, `final failure`, `unknown outcome—do not try again`, `permission expired`, `connection unavailable`, `stale approval`, and `duplicate already published`. On navigation/reload, job status restores the state. An existing published identity opens provenance rather than another confirmation. Unknown never offers a normal Retry button.

## 13. API contracts

All routes use same-origin HTTPS session cookies, `Content-Type: application/json`, `Cache-Control: no-store`, strict JSON keys/types, body-size rejection before parse, server-generated request IDs, and owner-safe responses. Do not accept tokens, provider IDs, author URNs, post text, fingerprints, status, or destination ownership claims from the browser. Validate `Origin`/`Sec-Fetch-Site` on mutating cookie-auth routes and use the application's CSRF token pattern when established. SameSite cookies alone are not the only control.

### 13.1 Preflight

`POST /api/social-publishing/linkedin/preflight`

- **Auth/authorization:** session; current Board `canEdit`; actor-owned connection.
- **Request (≤ 2 KiB):** `{ "boardId": "uuid", "nodeId": "bounded string" }` exactly.
- **200:** `{ok:true,value:{eligible,blockingCodes,preview,characterCount,characterLimit,editorialStatus,readiness,approvalFresh,destination:{displayName,type:"personal"},alreadyPublished,serverRequestId,checkedAt}}`. Preview is authorized post content; mark no-store. No provider/internal destination IDs.
- **401/403/404/409/422/429/503:** bounded stable error. Prefer 200 for a fully evaluated ineligible state; 409 for authoritative conflict; 503 for contract/policy unavailable.
- **Idempotency:** read-only; repeated calls recompute authoritative truth.
- **Rate limit:** proposed 20/account/minute and 60/IP/minute, configurable; return bounded retry category, not infrastructure detail.

### 13.2 Confirmation / job creation

`POST /api/social-publishing/linkedin/publish-now`

- **Auth/authorization:** session, current Board `canEdit`, actor-owned coherent connection; repeat all preflight checks.
- **Request (≤ 2 KiB):** `{ "boardId": "uuid", "nodeId": "bounded string", "confirmationNonce": "single-use bounded server nonce", "clientRequestId": "8..128 allowlisted characters" }` exactly. The nonce binds actor/Board/node/fingerprint/destination and expires quickly but does not replace durable idempotency.
- **202 new:** `{ok:true,value:{jobId,state:"queued",duplicate:false,serverRequestId,statusUrl}}`.
- **200 existing:** same bounded shape with current state and `duplicate:true`; published may include authorized canonical URL.
- **401/403/404/409/422/429/503:** authentication, authorization, missing authoritative entity, stale/duplicate conflict as appropriate, invalid content, limit, or disabled/unavailable.
- **Idempotency:** server canonical key and PostgreSQL unique constraint. Double-click returns one job.
- **Rate limit:** proposed 5 new identities/account/hour, 20 attempts/IP/hour; existing-key reads do not create quota-consuming provider calls. Tune from product evidence.

### 13.3 Job status

`GET /api/social-publishing/jobs/{jobId}`

- **Auth/authorization:** session; job owner; Board visibility may additionally constrain provenance UI. Never authorize by UUID possession.
- **Request:** path only; no body; URL ≤ 2 KiB.
- **200:** `{ok:true,value:{jobId,state,classification,retryable,committedState,publishedAt,externalUrl,revisionMatches,serverRequestId,updatedAt}}`; omit absent values.
- **401/403/404/429/503:** bounded errors. Use 404 where resource-existence privacy requires it.
- **Idempotency:** read-only. Poll with backoff (for example 1s, 2s, 4s, then 10s; stop on terminal/unknown), page visibility awareness, and an overall UI polling bound.
- **Rate limit:** proposed 60/account/minute and 120/IP/minute.

### 13.4 Reconciliation

Do **not** expose a Phase 1 browser reconciliation route until official lookup semantics exist. If justified later: `POST /api/social-publishing/jobs/{jobId}/reconcile`, connection owner only, ≤1 KiB, existing unknown job only, one durable reconciliation lease, low rate limit, and lookup-only adapter capability. It must never publish or accept a provider ID from an ordinary browser user. Manual support resolution belongs to a separately authenticated operational interface/audit trail.

Safe diagnostics on every route are limited to §15. Generic 400 handles malformed/oversized JSON, 405 method with `Allow`, and 415 wrong content type.

## 14. Storage readiness

### 14.1 Existing support

| Requirement | Current schema | Gap |
|---|---|---|
| Immutable snapshot | `content_snapshot JSONB`, 64 KiB bound | No DB-enforced logical shape; schema version locked to 1 |
| Approved revision | top-level `approved_fingerprint` | Supported |
| Owner/Board/node/destination | top-level columns and owner-scoped FKs | Supported; job lacks direct Connected Account column |
| Idempotency | unique `(owner_account_id,idempotency_key)` | Supports canonical durable identity; add length/format and action-version evidence |
| Attempts | attempt number, phase/status, ambiguity, safe classification, timestamps | Status vocabulary/claim lease/correlation/HTTP category insufficient |
| External identity | unique platform+external ID and one post/job | Good base; missing Connected Account, author reference, digest, created timestamp |
| Unknown/retry | job `outcome_unknown`; attempt temporary/unknown | Required public state vocabulary and reconciliation state not represented exactly |
| External URL/time | present | Supported, but derivation must be official |
| Revision retention | Board/node/fingerprint/job snapshot refs | Node is a historical string; Board FK is restrictive, not a complete tombstone policy |

### 14.2 Exact additive BW-32.3.1 migration

Use one separately controlled, forward-only migration; no destructive changes and no request-time DDL.

1. `social_publish_jobs`: add nullable `connected_account_id UUID`, `publish_action_version TEXT`, `content_digest TEXT`, `response_language TEXT`, `source_action TEXT`, `client_request_id TEXT`, `server_request_id TEXT`, `next_attempt_at TIMESTAMPTZ`, `claim_token TEXT`, `claim_expires_at TIMESTAMPTZ`; add owner-scoped Connected Account FK `NOT VALID`, backfill only real resolvable historical rows, then validate. Add bounded checks as `NOT VALID`, validate after production-shaped backfill. Upgrade schema version without rewriting historic snapshots.
2. Extend job status safely to represent `sending`, `published`, `failed_retryable`, `failed_final`, and `reconciliation_required`, while mapping/retaining legacy values. Prefer a new versioned check constraint installed `NOT VALID` then validated; do not drop old meanings until compatibility is proven.
3. `social_provider_attempts`: add nullable `client_request_id`, `server_request_id`, `http_status_category`, `provider_status_category`, `retryable BOOLEAN`, `committed_state_category`, `provider_post_id` (only verified identifier), `request_started_at`, and `response_received_at`. Do not add raw request/response columns.
4. `social_external_posts`: add nullable `connected_account_id UUID`, `provider_author_reference TEXT`, `content_digest TEXT`, and `created_at TIMESTAMPTZ DEFAULT NOW()`; owner-scoped FK and bounded checks via staged validation. Existing `published_snapshot_reference` points to the immutable job/snapshot, not content duplication.
5. Add unique correctness constraint/index for successful provenance tuple `(owner_account_id,destination_id,source_board_id,source_node_id,approved_fingerprint,publish_action_version)` (the action version may require an ExternalPost column or immutable join-independent copy). Keep the existing job idempotency uniqueness. Build large indexes concurrently in controlled operations where supported; do not pretend `CREATE INDEX CONCURRENTLY` is transactional.
6. Add worker lookup indexes on `(status,next_attempt_at)` and claim expiry as optional performance maintenance; their failure must not block ordinary connection reads.

The migration must inspect actual constraints/columns before changes, name every exact statement/operation in diagnostics, and test production-shaped rows including schema versions, null historical fields, old statuses, disconnected/revoked connections, unknown jobs, and delivered ExternalPosts. PostgreSQL integration tests against a real PostgreSQL instance are required; mocks prove query choreography only.

Current ordinary connection projection already uses a read-only compatibility preflight rather than `ensure` for its read path, but several storage helpers call schema initialization. BW-32.3.1 routes and workers must require a deployed schema version and fail closed; they must not create/alter tables/indexes at request time. Optional index repair is a runbook/maintenance operation and cannot make unrelated Settings reads unavailable.

## 15. Diagnostics and privacy

Create one safe diagnostic per request/job/attempt using only: allowlisted client request ID, server request ID, PublishJob ID, ProviderAttempt ID, phase, classification, HTTP status **category**, LinkedIn status category, retryability, committed-state category, and timestamp. Operational logs are structured, bounded, newline-safe, and access-controlled; identifiers are internal correlation values, retention is documented, and alert dimensions use categories rather than content.

Never log, persist in diagnostics, expose, or copy access/refresh tokens, authorization headers, OAuth code/state, raw provider response, post/Canvas content, provider personal identifiers, database host/query/constraint details, or stack traces. The ExternalPost's provider ID/author reference are provenance data, not diagnostics, and remain server-authorized.

**Copy diagnostics** produces an allowlisted JSON object with schema version and the safe fields above. User-facing errors explain the action (“Reconnect LinkedIn,” “Approval is stale,” “Outcome unknown—do not publish again”) without provider body or personal ID. Logs record `provider_response_invalid` rather than a snippet.

## 16. Test realism

### 16.1 Required regression layers

| Layer | Required coverage | What it proves / does not prove |
|---|---|---|
| Pure eligibility | Exact approved Social Media Posting fixture; authoritative facts; readiness; fingerprint match; platform/role; every blocking code; stale/changed content; ownership; scope; expired/disconnected; body empty/max+1; hostile controls; Unicode/paragraph preservation; scheduling excluded | Deterministic policy only; no DB/provider proof |
| PostgreSQL storage | Production-shaped migrations; snapshot bytes/digest; simultaneous double-click; exactly one job; claims; attempts; ExternalPost uniqueness; failures before/after call marker; unknown/reconciliation; historical rows | Real PostgreSQL constraints/transactions; not LinkedIn behavior |
| Adapter unit | Exact verified URL/method/headers/body; Unicode/maximum; response classification; raw-data redaction; token only server-side | Request mapping with mock HTTP; not platform access |
| Mocked provider integration | Expected verified success (201 only if official), 400/401/403/429/5xx; timeout pre-send/ambiguous; malformed/unknown response; one call/attempt/post; no blind retry | Application orchestration under controlled doubles; never called live proof |
| Real HTTP route | Session, CSRF/origin, Board reload/access, viewer/Public Viewer, actor-owned destination, hostile JSON, size/rate limits, English/German envelopes, navigation/poll recovery | Deployed route boundary against test DB/worker; provider can still be mocked |
| Browser/UI | Double-click, dialog focus trap/restore/Escape, disabled confirm, mobile, Light/Dark, accessibility tree/live region, exact preview/count, all visible states, revision mismatch | Product behavior; no delivery proof |
| Controlled live LinkedIn smoke | Exact approved test post; real production-capable app/member/credential/scope; one provider call; verified success ID; one job/attempt/ExternalPost; visible post; optional verified lookup; manual deletion | Only layer proving current live platform contract/access |

### 16.2 Production-boundary matrix

The combined suite must assert: authoritative Board/node reload; matching approval fingerprint and Ready state; personal destination owned by actor; valid decryptable credential; authoritative `w_member_social`; exact immutable snapshot; concurrent/double-click/browser retry creates exactly one job, one provider call, one ExternalPost; verified success; 400, 401, 403, 429, 5xx; timeout before response and ambiguous phase; DB failure before provider call; DB failure after provider success; browser navigation; stale approval; changed content; expired token; disconnected/revoked account; editor with another user's connection; viewer and Public Viewer; hostile text/JSON/control characters; exact maximum and maximum+1; Unicode including emoji/combining/right-to-left text; paragraph preservation; English/German; Light/Dark; mobile dialog; keyboard/screen-reader accessibility; later node mutation/deletion provenance; and no Canvas, editorial-status, or `planningSchedule` mutation/no duplicate publication.

Fault injection distinguishes “provider invocation not begun,” “bytes may have been sent,” “response success received,” “ExternalPost insert failed,” and “commit acknowledgment lost.” Tests must assert state/attempt rows at each boundary. A mocked 201 is written as “mocked success classification,” never “LinkedIn publish succeeded.”

## 17. Implementation phases

1. **Evidence/gates:** obtain official contract snapshot, app product/access evidence, author identity proof, verified limit, retry/idempotency/reconciliation decision, and controlled account.
2. **Pure contracts + migration:** body normalization/counting, eligibility, immutable snapshot/idempotency; controlled additive PostgreSQL migration with production-shaped fixtures.
3. **Server adapter/worker:** exact member-text capability, safe classifier, durable claims/attempts/ExternalPost, kill switch; no browser surface.
4. **Bounded routes:** preflight, publish-now job creation, status polling, CSRF/rate limits, diagnostics.
5. **Content Workspace UX:** one card action/modal and compact delivery projection; accessibility, localization, responsive/theme checks.
6. **Controlled smoke and staged enablement:** clearly labeled live test, manually delete if needed, reconcile records, enable allowlisted cohort, observe categories, then gradual release.

Each phase is independently reversible. Scheduling, media, organizations, edit/delete, and analytics are new audited phases, not “small additions.”

## 18. Go/no-go gates

| # | Gate | Current result |
|---:|---|---|
| 1 | Official current text-publishing endpoint verified | **FAIL — official pages unreachable** |
| 2 | Required LinkedIn API version verified | **FAIL** |
| 3 | Required headers verified | **FAIL** |
| 4 | `w_member_social` requirement verified | **FAIL officially; locally stored permission exists** |
| 5 | Personal member author URN contract verified | **FAIL; OIDC `sub` equivalence unproven** |
| 6 | Application product access verified | **FAIL; no evidence in repository/audit environment** |
| 7 | Development/production limitations verified | **FAIL** |
| 8 | Text length/counting verified | **FAIL** |
| 9 | Success response/post identifier verified | **FAIL** |
| 10 | Rate-limit behavior verified | **FAIL** |
| 11 | Retry rules verified | **FAIL** |
| 12 | Ambiguous-outcome strategy accepted | **PASS as architecture proposal; product/operations acceptance pending** |
| 13 | Existing destination identity sufficient | **FAIL pending official author proof** |
| 14 | Token vault decrypts current credential | **CONDITIONAL PASS:** implementation exists and accepted Settings coherence proves key availability, but a controlled server-only decrypt/preflight is required |
| 15 | PublishJob supports immutable revision/idempotency | **CONDITIONAL:** base columns/unique key exist; §14 additive migration required |
| 16 | No request-time schema migration blocks reads | **CONDITIONAL:** Settings read path improved; new routes must enforce migrated schema without DDL |
| 17 | Controlled live LinkedIn test account available | **FAIL / not evidenced** |
| 18 | First live post labeled and manually deletable | **FAIL / plan and operator confirmation required** |

**Final decision: NO-GO until the official evidence in §2 is reachable and recorded, the exact application has required production product access, OIDC identity is proven sufficient (or a correct author reference is discovered), the additive migration is deployed without request-time DDL, the adapter capability exists, ambiguous-outcome operations are accepted, and a controlled account/labeled manually deletable smoke post are ready.**

## 19. Rollback

- **UI:** kill switch hides/disables Publish to LinkedIn and polling initiation; existing delivery badges may remain read-only. Do not alter Canvas/editorial/planning data.
- **API:** publish/preflight route returns bounded `PUBLISHING_DISABLED`; status remains readable for owners. Do not delete jobs.
- **Adapter:** unregister/disable only `publish_member_text_now`; preserve connect/reconnect/disconnect and encrypted credentials.
- **Execution:** stop new claims; allow a currently sending attempt to finish recording its outcome where safe; queued jobs remain retained/disabled, ambiguous jobs remain flagged, and no automatic replay occurs.
- **Schema:** additions remain in place. Roll back application reads/writes, not provenance columns/tables; do not drop constraints/data in emergency rollback. A later cleanup requires a separate audited migration.

Rollback preserves connections, encrypted credentials, PublishJobs, ProviderAttempts, ExternalPosts, Board/Canvas data, and internal planning. Disabling publication never deletes provenance or rewrites an external outcome.

## 20. Exact recommended BW-32.3.1 scope

After every gate passes, implement only:

- one Content Workspace action on a current approved/Ready LinkedIn Social Media Posting;
- one accessible explicit-confirmation modal with exact normalized `social.caption`, official count, personal destination, freshness, and immediate-delivery warning;
- one actor-owned personal LinkedIn destination;
- text-only Publish Now using the officially verified Posts API contract and pinned supported version;
- one authoritative server preflight, one idempotent job-creation route, one owner-only status route, and a durable separately invoked worker;
- immutable snapshot of one approved revision, durable PostgreSQL idempotency, one attempt trail, and one ExternalPost before success UI;
- conservative unknown-outcome handling with no blind retry;
- safe correlation/diagnostics and a server kill switch;
- compact Content Workspace provenance/revision-mismatch projection;
- no Canvas/editorial/planning mutation.

Explicitly exclude media, organization destinations, fan-out, external scheduling, browser execution timers, edit/delete, webhooks/reconciliation unless separately proven, analytics, automatic hashtags/tracking/link enrichment, AI at publish time, Calendar delivery controls, and using another collaborator's credential.

The production connection foundation is usable input to this work, but it is not a substitute for the missing current official contract and live-access proof. Therefore BW-32.3.1 remains blocked at the evidence gate rather than being implemented from historical LinkedIn API memory.
