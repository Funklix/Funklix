# BW-36.19R2 — Adaptive Learning Advisor context and recovery

Implementation date: 2026-10-13 (Europe/Berlin). Base: verified latest GitHub main
`26578424c85bc09337895ef535c217ebbc006a26`, including merged PR #767 / BW-36.19R1.
No historical implementation or audit records were modified.

## Confirmed root cause

The original Advisor measures `Buffer.byteLength(JSON.stringify([input, SCHEMA]))`
and rejects the entire analysis above **8,000 UTF-8 bytes**. This is a product gate,
not an OpenAI context limit. The prompt, schema, escaped JSON, repeated canonical
Profile/campaign snapshot fields and source metadata all consume that gate before
useful evidence reaches inference. Separate extraction caps reject valid text,
large graphs and complete discussions even before this measurement.

A reproducible synthetic campaign uses the existing R1 persisted Canvas fixture,
with two Campaign Variations and the same 1,823-byte Profile field in canonical
Profile and campaign snapshot. Every field fits the original 2,000-code-unit cap.
Its original request is **8,291 bytes** and is rejected. The original system prompt
alone is **1,089 bytes** and schema **1,654 bytes**. The prepared R2 request is
**6,685 bytes / 1,385 o200k_base tokens**, before the output/framing reserves. Text
is stored once, while canonical and snapshot references remain distinct.

These measurements are synthetic and contain no production Board data. The
production symptom is consistent with the confirmed gate; a particular private
Board's contents and production environment overrides were not inspected.

Bytes, JavaScript UTF-16 code units and model tokens are different quantities.
Non-ASCII content especially invalidates a fixed byte-to-token ratio. UTF-8 bytes
can serve as a conservative upper bound for byte-level BPE tokens, but **8,000
bytes is not the configured model's context capacity**.

## Model and provider constraints

The repository defaults to `gpt-4o-mini` (or its `2024-07-18` snapshot). Its published
context window is **128,000 tokens**, maximum output **16,384 tokens**, and token
encoding **o200k_base**. References:

- https://platform.openai.com/docs/models/gpt-4o-mini
- https://platform.openai.com/docs/api-reference/responses/create

R2 uses local `js-tiktoken@1.0.21` to count the serialized prompt, selected source
payload and strict JSON schema. It reserves the existing **2,000 output tokens**
and **1,024 tokens** for provider protocol/framing variation. Serialized JSON
includes additional keys/escaping, so this is conservative accounting rather than
an assertion of exact billed input tokens. Provider-reported token usage is summed
across requests; missing usage remains unknown, never fabricated as zero.

An overridden model must have operator-verified
`OPENAI_LEARNING_ADVISOR_CONTEXT_TOKENS` and
`OPENAI_LEARNING_ADVISOR_TOKEN_ENCODING` (`o200k_base` or `cl100k_base`). Unknown
models fail recoverably with `MODEL_CONTEXT_UNCONFIGURED`, rather than borrowing
a different model's capability. No OpenAI account change, new provider, paid
infrastructure, automatic inference, daily quota, credit or subscription ceiling
is introduced. No production/paid provider request was made during development.

Pure-JavaScript BPE has poor worst-case behavior on enormous uninterrupted strings.
If a source text contains more than **8,192 consecutive non-whitespace code units**,
request accounting uses the UTF-8 byte upper bound instead. This is a CPU safety
switch, not a source truncation or a fixed context quota. Such exceptional content
can require extra partitioning or a recoverable model-context error.

## Complete limit audit

| Original boundary | R2 treatment / reason |
| --- | --- |
| Entire provider input + schema: 8,000 UTF-8 bytes | Removed; model-derived token accounting includes prompt/schema/output overhead. Arbitrary MVP restriction. |
| Selected text: 2,000 code units; Learning evidence: 4,000 | Extraction restriction removed. Human-edited Learning storage remains governed by the existing 2,000/4,000 contract. |
| Profile string arrays: 20 items | Removed; all allowlisted string items are extracted. |
| Personas/custom tiles: 100 each | Removed; type/acceptance/field allowlists remain. |
| Canvas: 100 Nodes / 300 edges | Removed; unique safe Node identities, valid schema and exact persisted endpoints remain required. |
| Post-it roots: 100 per Node | Removed. Selected whole-thread exclusion remains explicit. |
| Included discussion: 40 messages / depth 4 | Removed. Iterative traversal avoids call-stack recursion; malformed collections and cyclic/aliased adapter objects still fail. Deleted subtrees remain excluded. |
| Active approved/proposed Learnings: 100 / SQL LIMIT 101 | Removed; all authorized approved/proposed Learnings are loaded and fingerprinted. |
| Saved Board picker: 100 / SQL LIMIT 101 | Removed; every offered Board is individually read-authorized. |
| Excluded thread handles: 100 | Removed; strict safe handle validation and bounded request transport remain. |
| Node identity 200 code units; excluded handle 220 | Retained identity/transport validation; IDs are exact and never coerced. |
| Accepted strategy module projections | Existing security/acceptance allowlists preserved. Projection bounds: narrative 1,200 characters; structured text 700; lists 12 entries of 240 characters. Coverage explicitly identifies bounded accepted modules. |
| Provider output: 2,000 tokens; five suggestions | Existing structured response/review contract retained; not a daily usage or source-scope ceiling. Token exhaustion/incomplete output releases no result. |
| Output statement 2,000; rationale 500; confidence reason 300 | Retained strict output/storage contract. |
| Evidence: 12 sources per suggestion; reference 20; excerpt 500 | Retained bounded verifiable citations, exact persisted-source validation. |
| Limitations: six × 300; related Learnings: five × 40 | Retained strict structured output contract. |
| Provider envelope 60,000 bytes; extracted JSON 16,000 code units | Retained response parsing/integrity bounds; oversized/unexpected output fails closed. |
| Receipt 10,000 characters; POST body 24,000 bytes | Raised to 60,000 / 64,000 for larger selected-thread scopes; these are bounded security/transport envelopes, not analysis quotas. |
| Provider timeout 25 seconds; receipt TTL 10 minutes | Retained safe call timeout and session-bound temporary advice lifetime. |
| Browser timeout 35 seconds | Ordinary calls retain 35 seconds; explicitly requested analysis gets 300 seconds to receive multi-pass progress/results. |
| Function runtime | Explicit Vercel route configuration: 300 seconds, with 280 seconds for preparation/analysis. Pass planning requires every source pass plus consolidation to fit at 25 seconds each. Currently at most ten source passes plus one consolidation, derived from the execution window, not a marketing quota. |

Strict request keys, session/identity checks, Brand capability, Workspace membership,
Board association/read authority, schema compatibility, unsafe control/surrogate
rejection, output enums, nonempty citations and excerpt equality are correctness
or security checks, not context ceilings. TTL and parsing envelopes bound replay,
transport and resource use. The five-suggestion output remains a selective
human-review list, **not an exhaustive knowledge inventory**.

## Preparation and adaptive processing

1. Read authorized persisted sources in the existing transaction, including the
   canonical Profile, campaign snapshot, accepted modules, eligible Nodes,
   relationships, optional complete discussions and approved/proposed Learnings.
2. Discard only existing excluded categories (private documents, unsupported/draft
   modules, inactive/unsupported Nodes, deleted material, optional unallowlisted
   fields and explicitly excluded discussions). Report coverage limitations.
3. Deduplicate exact source text into a `texts` table; each source keeps its own
   `ref`, classification and provenance with `text_index`. Repetition cannot
   establish independent corroboration. Do not send coordinates, images, mutable
   author identity fields, analytics or AI Brain conversations.
4. If the full request fits the model budget, make one provider request.
5. Otherwise form coherent source units: one Node, one complete Post-it/reply
   thread, one Learning with its evidence, or one canonical/snapshot Profile
   field. Greedily pack complete units within the model budget. A thread is never
   split. Each extracted source is processed exactly once in source passes.
   Authorized graph relationships and coverage remain shared structural context.
6. Reauthorize and compare the full persisted-source fingerprint before and after
   every inference, including consolidation. Each pass validates against only its
   supplied source references and Learning context.
7. Send **all validated candidates** to one final consolidation request, along
   with their verified excerpts and trusted provenance. The final model can select
   up to five suggestions; it cannot cite a source outside those candidates, quote
   uncited raw source text, or construct a quote across joined excerpt boundaries.
   Restore persisted provenance after validation. No candidate is dropped merely
   to make consolidation fit: an oversized consolidation returns a recoverable
   technical status and releases nothing.
8. Reauthorize again before signing the existing session/actor/scope/fingerprint
   receipt. Human adoption still uses the existing proposed/manual/single-Node/
   successor workflows, including transactional authorization before mutation.

A complete source-pass run does not imply full knowledge coverage: allowlists and
accepted-module projections still apply, and model findings are selective. The
UI explicitly says all selected source groups were processed and the five
suggestions are not an exhaustive knowledge inventory. Complete-thread coverage
remains false when deleted/unsupported material is excluded. No resolved message,
repeated comment or AI agreement proves consensus or approval.

## Failure, recovery and provider usage

Any failed pass, timeout, stale source, revoked authority, unexpected structured
output, invalid citation or failed consolidation suppresses **the whole result**.
Intermediate candidates are never returned. No background processing, automatic
retry or resume releases prior private synthesis. Disconnect/cancellation prevents
subsequent passes; an already dispatched request can finish within its timeout.

Oversized indivisible threads, oversized sources/consolidation, unknown model
constraints and requests outside the execution window have separate recoverable
codes. Recovery offers explicit retry, whole-thread exclusion, another saved
Board, saved-source reload, or verified server model configuration, as applicable.
Board/discussion selections survive recoverable errors; source reload refreshes
revision/timestamp while retaining still-valid whole-thread exclusions.

The modal separates neutral disclosure, active status and icon-bearing `role=alert`
errors, with separately styled limited-coverage warnings. NDJSON progress comes from actual server dispatch stages: source group
counts, planned request count and consolidation. No elapsed-time fake progress.
JSON fallback remains supported. Larger workloads disclose extra time/API usage
before explicit Analyze; results display actual provider request count. The
existing account is charged for completed/dispatched passes even when a later
pass fails, so retry is always explicit.

The dialog is vertically scrollable, keeps Close reachable, preserves focus
restoration/Tab/Escape, and uses EN/DE strings and theme-aware surfaces. Unsaved
Board changes are still excluded. There is no automatic Canvas or Brand mutation.

## Changed files

- `api/_learning-advisor.js`: extraction, model budgets, source preparation,
  bounded passes, validation, reauthorization and signed result generation.
- `api/brands/[id]/learning-advisor.js`: provider-free discovery, bounded request
  envelope and optional NDJSON progress/error/result transport.
- `learning-advisor.js`, `learning-advisor.css`: progress, cost disclosure,
  prominent errors, retained options, source reload and responsive dialog.
- `vercel.json`: explicit 300-second runtime for this route.
- `package.json`: pinned local tokenizer and R2 regression command.
- `.github/workflows/runtime-boot-safety.yml`: R2 syntax and regression registration.
- Existing BW-36.19/R1 checks: superseded MVP size expectations updated; security,
  compatibility, provenance and storage assertions preserved.
- `scripts/fixtures/bw36-19-advisor-runtime.js`: optional streamed response adapter.
- `scripts/check-bw36-19r2-adaptive-learning-advisor-context.js` and
  `scripts/fixtures/bw36-19r2-browser.js`: realistic saved-Canvas/adaptive/security
  regressions and browser recovery checks.
- Four historical dependency-inventory assertions (BW-16, BW-36.1R1, BW-36.2, BW-36.6): include the approved pinned tokenizer; their behavioral/security assertions remain intact.
- This new implementation record.

## Regression results

- BW-36.19: 13 focused API/security groups, real disposable PGlite source SQL and
  adoption rollback/revocation tests, and Chromium passed.
- BW-36.19R1: canonical/historical tuple-edge fixtures, browser compatibility and
  disposable database checks passed.
- BW-36.19R2: eight adaptive context/security groups plus Chromium passed. Includes
  ordinary two-variation campaigns, >8 KB context, repeated Profile text, >100
  Nodes / >300 edges, arrays >20 items, whole threads >40 messages/depth four,
  single/multi-pass plans, exact per-pass references, two-sided consolidation,
  revocation/source changes, partial failure/timeouts, unsupported output,
  tokenizer safety, model configuration and cancellation.
- Browser coverage: true streamed analysis/consolidation, critical alert icon,
  failed-analysis option preservation, stale-source reload, EN/DE, light/dark,
  320px scrolling, keyboard/focus. Historical Advisor checks also cover
  1440/768/375/320px and governed proposal adoption.
- All **171 Runtime Boot Safety run steps** were executed locally, with dependency
  installation completed separately. The initial run had a Campaign V3 browser
  timeout and exposed an R2 tokenizer fallback bug. The R2 bug was fixed and its
  complete suite passed; Campaign V3 passed independently on both the changed
  branch and an untouched-main worktree. The tokenizer dependency was added after
  early dependency-inventory checks had already run, so this local aggregate was
  not a full verification of the final dependency set.
- GitHub Runtime Boot Safety run `38413521999` on PR #768 caught BW-16's stale
  assertion that only `@vercel/blob` and `pg` can exist. Investigation found the
  same historical snapshot in BW-36.1R1, BW-36.2 and BW-36.6. All four assertions
  now retain their exact inventory check with pinned `js-tiktoken@1.0.21` included;
  no authentication or authorization behavior was weakened. All four focused
  regressions passed after correction. Final GitHub run status is verified and
  reported with PR delivery, rather than inferred from the earlier local run.
- Historical BW-36.17/R1/R2, BW-36.18, Brand/Workspace, Canvas/Post-it/Inspector,
  AI Brain and Insights checks are included in that workflow and passed.
- Syntax and `git diff --check` passed. All provider calls were mocked; SQL tests
  used disposable PGlite. No production SQL, paid AI request or merge occurred.

## Remaining limitations

- No production Board/private data or deployed model override was inspected.
- Extremely large sources or one indivisible thread can exceed the model context.
  Conservative accounting of pathological uninterrupted text may reject a source
  that exact BPE would fit, in exchange for bounded preparation cost.
- The route needs the configured 300-second Vercel execution support. Very large
  scopes are recoverable errors, not asynchronous jobs or silent partial results.
- Accepted module text remains an explicitly bounded existing projection; source
  selection and five final suggestions cannot prove exhaustive strategic coverage.
- Shared graph context is repeated across source passes; globally enormous graph
  metadata can itself exceed a request. Source grouping avoids repeated evidence
  processing but does not remove strategically meaningful persisted relationships.
- A single final consolidation can overflow on unusually dense candidates. Nothing
  is silently omitted; the user must narrow scope and explicitly retry.
- PGlite validates actual SQL, not multiprocess contention or production latency.
  Browser streaming tests use local intercepted HTTP, not deployed proxy buffering.
- Existing human Learning provenance/storage limitations remain: no durable
  multisource evidence ledger and no automatic approval. Larger analyses cost more
  provider requests; billed requests are not undone by a later failed pass.
