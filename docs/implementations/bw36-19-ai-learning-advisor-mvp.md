# BW-36.19 — AI Learning Advisor MVP

Baseline: latest merged main `f194979a64dac16098d6a5de2a242d991aa049d9`.
Implementation date: 2026-10-13 (Europe/Berlin).
Status: implemented for user review; operational verification requirements below remain.

## Approved scope and superseding product decision

Brand Profile → Learnings → **Find Learning suggestions** opens an additive Advisor dialog. A Brand writer selects one saved associated Board, reviews the source disclosure and explicitly clicks **Analyze selected sources**. Opening Profile/dialog, previews, typing, cancellation and Board saves cause no inference.

The user's continuation explicitly **rejects** the proposed 10 analyses/Brand/day and 5 analyses/user/day limits. This implementation adds no daily limits, quota table/migration, paid service, subscription, credits, billing or entitlement logic. Centralized quotas, credits, subscriptions and usage billing are deferred to a future coherent product-wide monetization architecture. That decision supersedes the archived audit's quota recommendations; it is not an unresolved quota rollout gate.

The historical audit is unchanged: `docs/audits/bw36-19-ai-brand-intelligence-and-learning-system-audit.md`, Git blob `cedc7a96d4ecbd967d02ea6667dddeb4288f1128`.

## Authorization and saved-source boundary

The dedicated `/api/brands/:id/learning-advisor` route requires the existing signed session. Browser-supplied identity, Profile, Canvas, author classifications and Brand associations are never accepted.

The service reuses Learning authorization: exactly one active canonical application identity matching the signed email and independent Brand owner/admin/editor authority. Viewer, Board-only, Workspace-only, ambiguous/disabled identity, public-token and invalid-session requests fail before inference.

It independently requires accepted membership in the selected active Workspace, matching relational Brand/Board/Workspace associations and current non-public Board read access through the established Board service. Identity, Brand membership, Workspace membership and sources are checked in short transactions. The existing Brand write authority also grants associated Board read access; existing role semantics are preserved.

Sources are read from persisted rows. Brand revision, exact Board contents/timestamp/association, included/excluded scope and approved/proposed Learning rows are fingerprinted. The Board timestamp accepts the existing API's millisecond projection for selection; fingerprints and single-Node adoption retain exact persisted PostgreSQL precision.

Reads finish before inference. The service checks again immediately before dispatch and after completion. Any freshness or authority change suppresses the entire synthesized result. It never removes a denied citation while retaining potentially private synthesis. Receipt validation on resume/review and transaction-bound validation on adoption check the entire authorized analysis scope again.

Advisor extraction is allowlisted:

- Canonical Profile fields: positioning, value proposition/offers, voice, pillars, guidelines, keywords, selected persona/rule/example fields, textual DNA with approval state.
- Existing accepted strategy module projections, preserving confirmed fields versus assumptions and disclosing their bounded coverage. Draft, unallowlisted and private-document modules are excluded.
- Campaign Brand snapshot is separately classified from canonical Profile.
- Supported active persisted Node types and title/content/description/body strings, selected social text and structural edges.
- Approved and proposed Learning statements and evidence summaries, separately classified.
- Optional whole persisted Post-it/reply threads, disabled by default. Each thread can be excluded before inference.

No image bytes, private documents, credential fields, author emails/avatars, external measurements, activity history or transient AI Brain exchanges are projected. Author email/name markers are used only to identify possible AI Reviews; they are not identity proof and are not sent as identities.

Supported Canvas schema is the current persisted node/edge shape with schemaVersion 1 (legacy absent version is accepted). Duplicate/malformed Node IDs, unsupported graph relationships or declared schema versions fail closed. Unsupported/inactive Node types are visibly excluded. Generic tombstone history and deleted conversation reconstruction are not implemented.

Whole included threads retain root/reply depth, AI parent context, human-attributed versus generated markers, current resolved/reopened state and only available parseable persisted timestamps. Mutable timestamps/authorship remain unverified. A thread with unsupported nesting/size fails rather than losing a decisive reply. Preview lists roots without extracting replies so a user can exclude an unsupported thread.

## Provider integration and request safeguards

Uses the existing OpenAI account, `OPENAI_API_KEY`, direct Responses API endpoint and strict JSON-schema pattern. No new provider or transport service.

`OPENAI_LEARNING_ADVISOR_MODEL` is justified by existing feature-specific overrides such as `OPENAI_AI_BRAIN_MODEL` and `OPENAI_STRATEGY_MODULE_MODEL`; default is `gpt-4o-mini`, consistent with the existing AI Brain workflow. Successful responses expose the actual selected model as bounded operational metadata.

Limits:

- Exactly one inference request per explicit analysis; no autonomous retry, tools, browsing, embeddings, retrieval or agent chain.
- Conservative 8,000 UTF-8-byte budget across serialized input plus strict output schema. This deliberately provides an upper bound around the requested 8,000 input tokens rather than assuming four characters per token. In ordinary text it permits fewer tokens; large scopes must select a smaller Board or exclude discussions.
- Maximum 2,000 output tokens and five suggestions.
- Structural caps: 100 Nodes, 300 edges, 100 roots per Node, 40 messages per included thread, depth at most four, 100 active Learnings.
- 25-second provider timeout covering response consumption; frontend timeout 35 seconds. Missing API/signing configuration fails closed.
- Provider 429 maps to bounded 429; other provider failures/invalid structured output map to 502; timeout maps to 504. There are no automatic retries.
- `store:false`; no prompt/source/response logging. Only bounded model and token counts from provider usage are returned in temporary operational metadata. No persistent usage metering is introduced.

Current model availability, account access and current pricing were **not independently verified**. A read-only request to public OpenAI model documentation returned HTTP 403 in this environment. No paid model request was used as verification. The operator must confirm Responses/strict structured-output compatibility and current account pricing before live rollout.

With input/output prices per million tokens Pi/Po, the approximate maximum inference estimate at the requested ceiling is `0.008 × Pi + 0.002 × Po`. This record does not present historical dollar prices as current evidence. Provider-account spending controls and alerts remain existing-account operator configuration; they do not establish application daily quotas, and this MVP does not add those quotas.

## Structured contract and trust limits

`brand_learning_advisor_v1` uses a closed strict schema. Types: Learning, decision, correction, knowledge gap, potential conflict and approved-Learning update candidate. Each suggestion includes statement, rationale, extraction confidence/reason, evidence classification, decision status, bounded exact source excerpts/handles, limitations and related Learning IDs.

The server rejects invented/duplicate handles, nonexistent excerpts, unknown Learning IDs/types, excess suggestions, malformed output and detected wrong-language prose. Conflict candidates require at least two citations; update candidates require one current approved target. Exact normalized duplicate statements are marked deterministically; semantic duplicate/conflict classification remains advisory.

The model has no tools/actions and receives all source text as untrusted data. Resolution and model agreement do not establish approval or verified consensus. Confirmed-consensus decision status is absent from the output schema. A conservative statement guard also rejects common consensus/performance-validation claims. These controls do not prove that all model prose is true: reviewers must assess scope, evidence and hypotheses. Existing language detection is heuristic and accepts short/ambiguous text.

Returned source classification and Node/Learning identifiers come from the server-prepared manifest, never provider-supplied source metadata. Confidence is extraction confidence, not a calibrated truth probability. Coverage discloses field allowlisting, bounded accepted-module projections, omitted categories and zero truncated included threads.

## Temporary state and human adoption

Suggestions/receipts remain in current controller memory only, expire after ten minutes and are discarded on relevant context/language changes, dialog closure, expiry or denied validation. No localStorage, durable inbox or server suggestion cache is added. Results are hidden while authorization is revalidated on focus/visibility resume; there is no background inference.

HMAC receipts use the existing AUTH_SECRET/SESSION_SECRET and bind contract, actor UUID, hash of the signed session token, Brand, Workspace/Board selection, source fingerprint, expiry and temporary candidate ID/digest/adoption mode. They contain no raw discussions or statements. Candidate IDs are valid only with their signed receipt.

**Review proposal** validates the receipt and opens human-editable statement/context fields. The next explicit action creates only `proposed` through BW-36.17/BW-36.18:

- All cited evidence genuinely belongs to one eligible persisted Node: preserve that exact text Node ID and existing server-derived Board/Node provenance.
- Profile-only or mixed-source suggestion: explicit human-authored manual proposal, with absence of structured Profile/multi-source provenance disclosed.
- Approved-Learning update: existing successor workflow, with original provenance inheritance disclosed. Original knowledge remains approved until the successor is human-approved.

A narrow internal `beforeMutation` hook rechecks receipt, Workspace/source authority and fingerprint in the same Learning write transaction. Existing duplicate enforcement, source checks, events, revision checks, approval/archive/rejection and rollback remain unchanged. No schema contract or historical migration is changed. R2-compatible events continue omitting text source_node_id while rows retain it.

Complete durable multi-source evidence, exact discussion excerpts, new successor evidence lineage and immutable AI-run history are not claimed. A minimized human-adopted statement can remain governed Brand knowledge after its original source disappears, consistent with existing review governance.

## UI and stability

One additive frontend module and stylesheet reuse existing Learning card/dialog styling. All UI copy is EN/DE; source excerpts retain their original language. Native modal semantics, focus restoration, Tab/Escape, edited-draft discard protection, themes and mobile reflow are covered.

Integration changes are limited to the Learnings action, passing existing Profile Workspace context and loading the additive assets. app.js, Inspector markup/bindings, Canvas serialization, undo/autosave/presence, campaign generation, AI Brain and Insights are unchanged.

## Changed files

- `api/_learning-advisor.js`: extraction, source checks, strict inference, validation, receipts and adoption.
- `api/brands/[id]/learning-advisor.js`: signed API, authorized Board list, preview/analyze/validate/adopt.
- `api/_brand-learnings.js`: reuse authorization and internal transaction-bound freshness hook.
- `learning-advisor.js`, `learning-advisor.css`: accessible localized temporary Advisor.
- `brand-learnings.js`, `brand-profile-setup.js`, `index.html`: narrow additive entry/assets.
- `scripts/check-bw36-19-ai-learning-advisor.js` and `scripts/fixtures/bw36-19-{advisor-runtime,browser,database}.js`: mocked API/security, real app Chromium and disposable database checks.
- `scripts/fixtures/bw36-17-local-runtime.js`: optional query/provider injection and exported loader for isolated Advisor fixtures; historical default behavior retained.
- `package.json`, `.github/workflows/runtime-boot-safety.yml`: register checks and syntax coverage.
- This implementation record.

## Verification and deployment requirements

Focused validation: 13 security/API groups, disposable PGlite executing the historical migrations and actual source/adoption SQL, plus real application Chromium. Includes role/session/identity isolation, Workspace/source denial, discussion opt-in/exclusion/AI roots/replies, malformed schemas/output/injection references, wrong language, duplicates/conflicts, context overflow, source/permission/Learning freshness, one-call boundaries, 429/timeout/missing configuration, single-Node/manual/successor governance and atomic event rollback.

Chromium covers the actual Profile entry, no inference on opening/preview, edited adoption, stale draft retention, account-context discard, EN/DE, light/dark, widths 1440/768/375/320, focus/Tab/Escape and unchanged Canvas/undo/history/activity/presence/storage. Explicit language preference changes in the test are accounted for separately.

All 169 executable Runtime Boot Safety steps passed locally across the complete run and two targeted reruns. The initial run passed 167: the tracked-file Auto-plan packaging fixture initially omitted the unstaged new script (passed after staging), and the Campaign V3 browser suite had a transient timeout (passed on targeted rerun; unchanged main also passed). No frozen hashes/assertions were replaced. This includes BW-36.17/R1/R2/BW-36.18, Brand/Board/Workspace identity and deletion, Canvas hierarchy/Inspector/Post-its, AI Brain/Insights, Content Workspace, publishing and exports. Local setup used installed repository dependencies and system Chromium rather than repeating the workflow's browser installation. GitHub Actions results remain separate from local evidence.

PGlite validates PostgreSQL-compatible SQL and transactions, not separate-process contention; existing NOWAIT lock handling is retained. No new lock subsystem is introduced.

Deployment requires the existing deployed BW-36.17/R2/BW-36.18 contract, existing database/session/OpenAI credentials, operator model/price verification and review of the remaining test evidence. No migration or production SQL is required. This PR is not independently verified as production-ready.

## Exact manual smoke test

1. In an authorized test account, open Brand Profile → Learnings → Find Learning suggestions. Confirm receiving Brand, saved Board list, provider disclosure and unchecked discussions; opening/typing/cancelling must cause no inference.
2. Select one saved Board. Opt into discussions, exclude one entire thread and inspect scope. In a local mocked environment, explicitly analyze; verify one mocked Responses request and at most five temporary cards.
3. Inspect exact citations, AI/human attribution, decision/conflict labels, confidence explanation, excluded categories and limitations.
4. Review an eligible one-Node candidate, edit text, cancel/Keep editing, then explicitly save as proposed. Verify the exact Node ID, separate human approval and existing history. Check a Profile/multi-source manual proposal and approved-Learning successor disclosures.
5. Change persisted source text or revoke Brand/Workspace authority after analysis; review/adoption must fail, preserve the edited stale draft until closure and write no Learning/event. Change account/Brand/Workspace or close/reopen; previous suggestions must disappear.
6. Check EN/DE, light/dark, keyboard/Tab/Escape/focus and 320/375/768/1440 widths. Compare Canvas, undo/activity/presence/autosave and campaign snapshots before/after.
7. Verify mocked 429, timeout, missing configuration, invalid sources/output and overflow; no automatic retry or incomplete-thread analysis.
8. Live analysis is a separate reviewed operator smoke step after account/model/pricing verification; development and this validation use no paid inference.

## Future phases

Durable evidence/retention and successor evidence ledger; Start Screen/Insights presentation; approved-Learning consumption by explicitly scoped consumers; opt-in background intelligence with durable consent/revocation. Product-wide subscriptions, credits, quota/usage billing belong to a separately designed monetization phase.
