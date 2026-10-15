# BW-36.20 — Approved Brand Learnings in AI Brain Advice

Date: 2026-10-15. Implementation authorized by the user after approval of the three product decisions in the [architecture audit](../audits/bw36-20-approved-learning-ai-brain-integration-audit.md). Base: latest merged GitHub `main`, `d774d0560d941fe4a94d0f5cf55371acc28ba163` (PR #777). The [R0 authorization repair](bw36-20r0-ai-brain-board-authorization-fix.md) and archived audit remain unchanged.

## Architecture and scope

Only `POST /api/ai-brain/advice` consumes the new context. Its existing request keys, Canvas validation, edit requirement, plain-text `answer`, response language, bounded follow-up history, safe answer renderer, 25-second provider timeout and deterministic no-provider clarification remain in place. An ordinary successful request still makes exactly one OpenAI Responses call. No automatic retry, model tools, mutation capability, embedding, new service, background work, migration, subscription limit or daily quota is added.

The route captures current authorized context, ranks and packs approved statements outside its database transaction, revalidates immediately before dispatch, invokes the existing provider once, and revalidates again before delivering an answer. Failure at the last gate suppresses the entire answer, rather than removing attribution from an answer already influenced by revoked knowledge. Advice responses use `Cache-Control: private, no-store`.

The Learning Advisor, proposal/adoption/review flows, Learning lifecycle module, campaign generation, Brand Profile editing and shared `buildBrandBrainContext` are unchanged. The new module imports only the existing read-only Learning authorization function from the lifecycle service.

## Exact affected files

| File | Purpose |
| --- | --- |
| `api/_ai-brain-learning-context.js` | New read-only scope, full approved scan, ranking, token packing and freshness checks |
| `api/ai-brain/advice.js` | Advice-only integration, knowledge policy, additive metadata, bounded errors and no-store |
| `app.js` | Store supplied-context metadata per successful turn; safe EN/DE disclosure and retry messages |
| `ai-brain-learning-context.css` | Six scoped disclosure rules; theme inheritance, wrapping and keyboard focus |
| `index.html` | Load the scoped disclosure stylesheet |
| `scripts/check-bw36-20-approved-learning-ai-brain.js` | Behavioral authorization, lifecycle, provider, freshness, ranking and budget tests |
| `scripts/fixtures/bw36-20-database.js` | Disposable PGlite with deployed migrations; real route and ACL/Learning helpers; provider double |
| `scripts/fixtures/bw36-20-browser.js` | Production disclosure source and CSS in real Chromium across language/theme/width combinations |
| `scripts/fixtures/bw26-advice-database.js` | Transaction transport for existing Board-only BW-26 ACL doubles |
| `scripts/check-bw26-1-real-canvas-context-and-turn-lifecycle.js` | Register the transaction transport; existing assertions preserved |
| `scripts/check-bw26-3-bounded-conversation-memory.js` | Same fixture adaptation; existing assertions preserved |
| `scripts/check-bw26-4-reference-resolution.js` | Same fixture adaptation; existing assertions preserved |
| `scripts/check-bw26-5-response-language-adherence.js` | Same fixture adaptation; existing assertions preserved |
| `scripts/check-bw36-20r0-ai-brain-board-authorization.js` | Extend projection-aware SQL transport for real freshness/identity checks; preserve original ACL assertions and historical reproduction |
| `.github/workflows/runtime-boot-safety.yml` | Install existing dependencies before tokenizer-dependent Advice checks; register focused integration and syntax checks |
| `docs/implementations/bw36-20-approved-brand-learning-ai-brain-integration.md` | This implementation record |

`styles.css` is byte-for-byte unchanged. Historical Canvas/Workspace stylesheet fingerprints and their assertions are preserved. There are no dependency changes.

## Permission boundary and trusted retrieval

The relevant Brand is exclusively the persisted authorized Board's `brand_id`. Neither client Brand identifiers nor Learning text are accepted. R0's explicit `owner_id`/`owner_email` projection and malformed-projection denial remain. Ownership identifiers are never included in provider or browser payloads.

Each context transaction executes the real Board access helper and requires Board edit access. It resolves canonical Brand access through `getBrandAccess` with `client` and `skipEnsure: true`, then independently calls `authorize(client, user, brandId, false)` before reading Learnings. This requires exactly one active application identity and current Brand owner/admin/editor/viewer authority. Brand viewers need a separate genuine Board edit grant. Board-only collaborators and Workspace-only membership gain no Brand Learning authority. Permitted Board-only Advice continues without a Learning query, canonical data or library counts. Missing, ambiguous or disabled identities for otherwise eligible Brand readers fail closed; unavailable schema/database/scan work is never reported as an empty library.

Parameterized SQL scans `public.brand_learnings` with both `brand_id=$1` and `status='approved'`. It uses UUID keyset batches of 256 under one repeatable-read snapshot, without the UI endpoint's 50-row pagination or a total Learning-count ceiling. ID/revision/statement/approval time and source Board/node IDs are the only retrieved fields. Source IDs stay server-side as ranking hints. No evidence summaries, event history, identities, source labels, source Board content or source hydration are supplied. Approved statements survive source Board deletion according to the repaired lifecycle; a real source deletion regression confirms this behavior.

The complete scan has a five-second scan deadline, four-second per-statement database timeout, and 32 MiB serialized-row memory guard. These are synchronous execution safeguards: exceeding them fails the request with `learning_context_unavailable`; it never silently returns a partial or newest-N library.

## Transactions, concurrency and freshness

Board context is acquired with `FOR SHARE NOWAIT`, followed by current Board membership and the existing read authorization helpers. The shared Learning authorization function locks active identity, Brand and Brand membership. Existing Board writes take Board first; Learning/source paths can take identity/Brand first. Board `NOWAIT`, a 750 ms lock timeout and a four-second statement timeout bound opposite-order contention. Every path commits or rolls back and releases its client before tokenization or provider work. No database locks span inference.

The fingerprint includes actual selected Board values (including snapshot/provenance/association/update time), canonical Profile values/revision/update time/access role, and application identity ID/revision. Actual values supplement revisions because legacy writers may not increment every revision. The dispatch and return transactions repeat current authorization and compare that fingerprint. Selected Learning IDs are checked in parameterized 256-ID batches for same Brand, current approved status, revision and exact full statement, with shared locks. Unselected new approvals do not invalidate an answer. Included archive/supersession, revision change, Board deletion/reassociation, role revocation, identity disable and Profile/snapshot changes suppress dispatch or delivery with retryable HTTP 409 `advice_context_changed`. No retry consumes a second paid request automatically.

These are boundary checks, not a distributed revocation protocol. Permission can change after a transaction commits and before the next external action; no implementation can retract context already sent to the provider. Previously displayed ephemeral conversation turns are not remotely erased after a later archive. The existing browser account/Board/Canvas/selection/request-generation stale checks remain.

## Deterministic relevance

All authorized approved statements are normalized using NFKC, case folding, German sharp-S and diacritic normalization, English/German stop words, and simple suffix normalization. Ranking uses corpus document frequency: a matching term contributes `log(1 + (N + 1) / documentFrequency)`. Question matches have weight 10; selected-node text has a bounded secondary weight of 4; Canvas title/audience/channel and the most recent bounded assistant response each contribute at most 2. Same-Board and same-selected-node provenance add 0.25/0.5 only after a lexical match. Provenance alone cannot make a statement eligible or establish truth.

Ties resolve by approval timestamp descending, then stable ID. Normalized duplicate statements are deduplicated. An explicit EN/DE request for all Learnings admits all distinct statements to packing; no positive lexical match otherwise selects none. Follow-up assistant text is a low-trust retrieval hint and cannot authorize anything or replace the conversational referent.

This is lexical retrieval, not semantic or translated retrieval. English and German text are supported, but synonym and cross-language conceptual recall are not guaranteed. Recency and ranking are relevance rules, not knowledge precedence. Future improvements should be evaluated offline before changing retrieval architecture.

## Model capacity and whole statements

The existing `js-tiktoken` dependency counts serialized input with special-token recognition disabled. Known `gpt-4o-mini` and `gpt-4o-mini-2024-07-18` configurations use the published 128,000-token window and `o200k_base`. Advice reserves 4,096 output tokens and 1,024 conservative protocol/framing tokens, and sends `max_output_tokens: 4096` in its existing single call. The 12,000-character public answer bound remains. The output reservation supports ordinary concise Advice without adding a Learning token quota; the rest of the actual context window is available for full statements.

All existing input counts against capacity: system policy, both Core categories, Canvas/selection/diagnostics, history, response language, question and supplementary envelope. Packing accounts for each whole serialized item plus structural margin and metadata growth, then validates the actual final input. Oversized statements are skipped so smaller later statements can fit; none are cut or summarized. A final capacity check can remove complete lowest-ranked packed statements if necessary. Pathological uninterrupted sequences longer than 8,192 code units use the conservative UTF-8 byte upper bound to avoid quadratic JavaScript BPE work. This may conservatively exclude content, but cannot authorize an oversized request.

Base context over capacity returns recoverable HTTP 422 `advice_context_too_large`. A fitting base context with no remaining Learning headroom may proceed with explicit budget exclusion counts. No Canvas constraints, history or canonical knowledge are silently evicted to make room. Offline fixtures cover 1,200 fitting distinct statements, 601 approved SQL rows across batch boundaries, multilingual/pathological input, exact-fit/one-token-overflow, complete statement skipping and partial coverage.

For every other configured model, an administrator must verify the provider's matching context window/encoding and configure all three values together:

```text
OPENAI_AI_BRAIN_CONTEXT_MODEL=<exact OPENAI_AI_BRAIN_MODEL value>
OPENAI_AI_BRAIN_CONTEXT_TOKENS=<verified integer context window greater than 5120>
OPENAI_AI_BRAIN_TOKEN_ENCODING=o200k_base|cl100k_base
```

The chosen model must support the existing Responses request and a 4,096-token output allocation. A missing or mismatched configuration fails before dispatch with HTTP 503 `model_context_unconfigured`. No model metadata or verification call is made during Advice.

## Knowledge precedence and provider data

The existing system policy now explicitly orders system/security/privacy requirements, canonical Profile for current durable Brand facts, campaign snapshot for saved campaign constraints, supplementary approved observations, then working Canvas/history. Differences must be surfaced with uncertainty; important strategic conflicts should receive human review. The assistant must not silently rewrite sources or invent reconciled facts. Nested draft/generated Profile material remains draft/generated. Learning approval is neither empirical verification nor an instruction grant.

Learning statements appear only in a separately labelled JSON user-data message before conversation history, never concatenated into privileged instructions. System policy explicitly rejects embedded instructions, fake system messages, prompt injection and requests for unauthorized actions. No provider tools are added. Mocked tests prove composition and data boundaries, not live model obedience or strategic correctness.

The provider and additive browser metadata use this envelope:

```json
{
  "selectionVersion": "approved_brand_learnings_v1",
  "coverage": { "eligible": 100, "relevant": 12, "included": 10, "omitted_for_budget": 2, "partial": true },
  "items": [{ "ref": "L1", "revision": "3", "statement": "A complete approved statement." }]
}
```

`eligible` counts all authorized approved rows in the completed scan. `relevant` counts distinct positive matches after normalization/deduplication, or distinct statements for a broad request. Budget omissions are `relevant - included`. Counts describe the captured scan, not new approvals during inference. Request-local `L1`, `L2` handles replace Learning database IDs. Board-only fallback omits library metadata entirely. Zero approved records and a nonempty library with no relevant match remain distinguishable to authorized callers.

## Context transparency and compatibility

Successful authorized responses add `context.approved_learnings`; the `answer` contract is unchanged. The UI stores it with the existing ephemeral successful turn and renders an optional native `details` section labelled “Approved Brand Learnings supplied as context,” with EN/DE copy explaining that provision does not prove use in every sentence. Complete statements render through `textContent`, without source navigation, model-generated citations or links. Partial packing receives a capacity notice. No included statements means no distracting empty section.

The disclosure inherits Light/Dark text/surface colors, wraps long strings, provides visible keyboard focus, and works at 375px. Eight actual Chromium combinations verify language, theme, width, native keyboard expansion/collapse, hostile text rendering and partial/empty states. Existing follow-up, Markdown, language and stale-request assertions remain intact. Earlier-message facts are not promoted to current approved knowledge.

## Validation and release gate

All provider tests use local doubles and assert call counts; all application SQL tests use disposable state. No paid OpenAI request, production SQL, merge or deployment was performed.

Focused command: `node scripts/check-bw36-20-approved-learning-ai-brain.js`. Covers real route/access/Learning helpers and deployed migrations; Board/Brand roles, Board-only/Workspace-only access, disabled/missing/ambiguous identity, cross-Brand isolation, approval statuses, real approved edit/successor approval, deleted sources, dispatch/return invalidation, unrelated new approval, lock-error rollback/release, schema/scan errors, no locks during provider wait, relevance/ties/EN/DE/large libraries, custom model configuration, token boundaries, injection composition, Profile/snapshot conflict labels, source privacy, exact metadata, clarification and zero application mutations. Approved revisions cannot be edited in place under deployed triggers; a separate transport fault verifies the defensive revision comparison without weakening those triggers.

The R0 test retains 17 ACL cases and 11 malformed projections, and its original vulnerable-route reproduction still establishes the one-query owner-projection defect with a stubbed provider. Existing BW-26 assertions were not weakened: only transaction transports were added to their existing ACL doubles.

Runtime Boot Safety results are recorded after the complete local run and focused reruns below. GitHub Actions on the delivered non-draft PR is the final clean-environment gate; its status is reported with delivery.

**Local results:** every one of the 180 Runtime Boot Safety commands was attempted. The initial run passed 176 commands and reported three implementation-related compatibility failures plus one environment setup failure. The three compatibility failures were corrected without changing their assertions: the route explicitly captures its existing model configuration, and disclosure CSS moved out of the historically pinned stylesheet. All three checks and the complete current syntax block passed focused reruns. The final focused integration/database/browser suite and R0 authorization suite also passed after final changes.

The effective final local result is **179/180 commands passed**, including every product regression: all ten BW-26 checks; BW-36.17/R1/R2, BW-36.18 and BW-36.19/R1/R2/R4/R5/R6/R7/R8; Board/Brand/Workspace, Canvas, language, theme and browser regressions. The sole remaining local failure is `npx playwright-core install --with-deps chromium`: the installer attempts root dependency installation and fails with `su: Authentication failure`. The installed system `/usr/bin/chromium` successfully ran the actual browser checks. This is not represented as an entirely green local workflow. GitHub Runtime Boot Safety installs browser dependencies in its normal runner and remains the final complete gate.

## Deployment implications and remaining limits

No migration or browser database permission is required. Deployment must already contain governed Learning storage, R1/R2 provenance repairs, application identity and existing ACL tables. Missing prerequisites cause a bounded unavailable result rather than runtime DDL or an ungoverned fallback. Deploy the new server module, route, browser script, linked stylesheet and HTML together. Custom model operators must verify and supply the matching configuration above.

The new scan trades synchronous CPU/memory for simple local deterministic retrieval. Very large libraries can return a recoverable unavailable result rather than a misleading incomplete answer. Existing raw Core projection/privacy risks remain outside this integration; no additional documents or provenance are hydrated. Prompt composition tests cannot prove model resistance. PGlite exercises real PostgreSQL SQL/triggers and controlled inter-boundary mutations, but does not establish multi-process PostgreSQL contention behavior; lock acquisition/error paths and zero inference-time transactions are separately asserted. Real multi-session stress testing and semantic-recall evaluation are future validation improvements.

## Manual live-test checklist for user review

1. On a test Brand with an approved engagement Learning, open an associated Board as an editor who can read that Brand. Ask an engagement question and expand the supplied-context disclosure. Confirm the full statement and context-only explanation.
2. Repeat in German and Light/Dark Mode at desktop and narrow width; expand/collapse with the keyboard and continue a follow-up conversation.
3. Use a Board-only editor without Brand membership. Confirm ordinary Board Advice succeeds and reveals no Learning section, statements or library counts. A Board viewer should remain unable to ask.
4. Compare approved, proposed, rejected and archived statements. Only relevant approved statements should appear. Confirm zero approved/no-match turns have no empty disclosure.
5. During an in-flight test answer, archive an included Learning or revoke Brand read access. Expect a context-changed retry result with no answer; retry only after reviewing current access/context.
6. Review a deliberate canonical Profile/campaign snapshot/Learning conflict. Confirm the response preserves campaign constraints and surfaces uncertainty rather than silently rewriting sources. This step evaluates model behavior, which mocked tests cannot establish.

Do not merge until explicit user review and the complete GitHub Runtime Boot Safety gate are satisfied.
