# BW-36.19R4 — AI Learning Advisor output reliability

Base: latest merged GitHub main, `8966cc1e89b455eb8a3890512284607edb813a23`
(PR #768). All fixture content is invented. Development used mocked OpenAI calls;
no production SQL, real paid inference, deployment, or merge was performed.

## Diagnosis and evidence

The exact cause of the reported `QA Existing Brand Test` production failure cannot
be established retrospectively: main reports one generic error without recording
the rejection stage. No production user content or full provider response was
retrieved to diagnose it. This change does not claim a verified live inference.

A concrete implementation defect was reproduced against main's **actual**
`analyze` and `validateOutput` functions using a saved Campaign fixture:

- A complete five-suggestion response had valid source handles and exact excerpts.
  Main's candidate validator accepted every suggestion, but `analyze` rejected the
  same response because serialized output exceeded 16,000 characters.
- The tokenizer measured **4,825 output tokens**, beyond main's 2,000-token request
  budget. The new mocked test verifies it fits within 8,192 tokens. This proves
  budget insufficiency for that fixture; it does not prove the production response
  was truncated. No truncation is repaired or retried automatically.
- Equivalent JSON using legal Unicode escapes exceeds the old 60,000-byte
  Responses-envelope check while decoding to the same individually valid output.
- Schema string lengths count Unicode code points, but main checked UTF-16 code
  units. An exact excerpt containing 300 emoji and ordinary prose is fewer than
  500 code points but more than 500 code units; main rejected it unnecessarily.
  Validation now agrees with JSON Schema and the existing Learning normalizer.

### Main's complete failure lifecycle

Before R4, `INVALID_OUTPUT` covered:

1. Provider envelope over 60,000 UTF-8 bytes, noncompleted `provider.status`, or
   output over 16,000 characters / a nonstring output value.
2. Wrong/missing/extra envelope keys; a language label different from the request;
   a nonarray or more than five suggestions.
3. Wrong/missing/extra candidate keys; invalid string, enum or array shape/length;
   empty sources or repeated handles within a candidate.
4. Unknown handles, missing/blank/oversized excerpts, or excerpts that are not
   contiguous literal substrings of the referenced source.
5. Invalid limitations or related Learning IDs; duplicate related IDs.
6. A conflict with fewer than two sources; approved/canonical evidence classes
   without an approved Learning / canonical Profile or accepted module.
7. Forbidden consensus/performance assertions; an update without exactly one
   approved related Learning; duplicate normalized candidate statements.
8. Consolidation citing an excerpt not contained in a previously validated
   candidate excerpt, even if it is present in the original persisted source.

Other distinctions matter: prose language mismatch was already
`OUTPUT_LANGUAGE_MISMATCH`; malformed envelope/output JSON escaped to the generic
`PROVIDER_FAILED` catch. Missing provider completion status was silently accepted.
Source authorization/freshness, model context, runtime, receipt and cancellation
failures use their own bounded codes and never represent a valid empty result.

The structured schema retains the existing required keys, enums, field lengths,
`additionalProperties:false`, five-suggestion ceiling, and array maxima. Sources
now declare `minItems:1`, aligning the schema with the existing mandatory-evidence
validator rather than allowing the provider to emit a guaranteed rejection.
Its constraints are compatible with the supported base `gpt-4o-mini` schema subset;
all requests still use Responses `text.format`, `strict:true`, `store:false` and
no tools. Mocked tests cannot establish live acceptance for every custom or
fine-tuned model. Unknown models still require configured context and encoding.

## Exact handling and recovery behavior

- Reserve **8,192** output tokens during both request construction and context
  planning. This is below the default model's published 16,384-token output
  ceiling. R2 fixture models use context 18,192 instead of 12,000 to retain the
  same 10,000-token input allowance after increasing the output reservation.
  Existing indivisible-source and function-runtime rules remain in effect.
- Replace unrelated output/envelope ceilings with bounds derived recursively
  from the existing schema. String accounting includes worst-case escaped Unicode
  surrogate pairs, array cardinality, keys and JSON punctuation. The envelope
  allows a second escaping layer plus the existing 60,000-byte envelope allowance.
  Real fetch bodies are read incrementally, cancelled on overflow and released.
  The `.text()` fallback is retained for test/adaptor responses; it is checked
  before parsing. No new source quota or product limit is added.
- Require completed provider status. A complete response has one completed
  assistant message containing one structured JSON document (contiguous output
  text parts are joined within that message), or the existing
  `output_text` adaptor shape when `output` is absent. Reasoning items are not
  evidence. Refusals, nonmessage items, malformed content, multiple documents,
  unfinished messages and disagreement between envelope representations fail.
- Parse provider and output JSON separately. Neither Markdown fences, truncated
  JSON, missing fields nor invented citations are repaired.
- Preserve literal `source.text.includes(excerpt)` checks. No translation, Unicode
  normalization, whitespace folding, quotation stripping, fuzzy matching, source
  substitution or evidence rewriting is performed. Prompt instructions explain
  how `ref` and `text_index` relate and mirror existing classification rules.
- Preserve candidate-level schema, classification, language, duplicate, update
  and evidence checks. **No partial candidate recovery is introduced.** It was
  evaluated and deliberately kept fail-closed: the current contract cannot prove
  that a surviving suggestion was not synthesized from rejected material, and
  cross-pass consolidation shares candidates and evidence. A valid candidate
  beside an invalid one therefore releases neither candidate. Duplicate statements
  also fail; they are not silently merged or substituted.
- Only validated pass candidates enter consolidation. Final excerpts must fit
  within a single previously validated excerpt for the same handle. Joined
  candidate excerpt strings cannot create new evidence across their boundary.
  Trusted persisted source metadata is restored after consolidation.
- Reauthorize and compare the full source fingerprint before dispatch, after
  each inference and before final release. A changed source, Learning set,
  membership, identity or permission invalidates the entire analysis. Receipts
  and adoption retain their existing transaction checks and session binding.
- `analysis_complete:true` and an empty suggestions array occur only after a
  completed, parsed, schema-valid and freshly authorized analysis genuinely
  returns no suitable suggestions. Errors never become empty success. Coverage,
  whole-thread exclusions and consolidation selection disclosure remain intact.
  All suggestions continue to require explicit human review and approval.

## Bounded operational diagnostics

One server-side JSON event at most is emitted for a failed `analyze` invocation:

```json
{"event":"learning_advisor_validation","correlation_id":"random UUID","category":"evidence_excerpt_mismatch","stage":"analyzing","pass":0}
```

The correlation ID is random, never derived from an actor, session or source.
`stage` is allowlisted (`analysis`, `analyzing`, `consolidating`); `pass` is a
bounded zero-based index (consolidation uses the number of source passes).
Diagnostic categories are also allowlisted before logging, including errors
thrown by adapters. Logging failures cannot change the result or authorization.

| Stable category | Condition |
| --- | --- |
| `provider_incomplete` | Provider completion status absent or not completed |
| `response_parse_failure` | Malformed JSON, refusal, ambiguous or unsupported output envelope |
| `response_size_failure` | Schema-derived output or envelope bound exceeded |
| `schema_validation_failure` | Invalid candidate/envelope shape, fields, enums, arrays or related IDs |
| `unknown_source_reference` | Structurally valid handle absent from authorized pass evidence |
| `evidence_excerpt_mismatch` | Validly shaped quote not present literally in the cited evidence |
| `duplicate_candidate` | Repeated normalized suggestion statement |
| `evidence_class_mismatch` | Incompatible evidence class, invalid conflict/update or prohibited claim |
| `language_mismatch` | Wrong label or detectable wrong-language prose |
| `consolidation_failure` | Final quote crosses or falls outside individually validated excerpts |
| `source_freshness_failure` | Source fingerprint or expected revision changed |
| `source_access_failure` | Source/Brand/Workspace authorization or identity unavailable/revoked |
| `provider_timeout` / `provider_failure` | Transport timeout or provider HTTP/transport failure |
| `analysis_failure` | Other bounded configuration, runtime or analysis failure |

There are no prompt, source, quote, comment, model-output, exception-message,
provider-response, credential, session-token, personal-identity, resource-ID or
fingerprint fields in logs. User-facing errors retain their existing bounded
codes; the new categories stay server-side. Malformed/truncated provider JSON now
maps to `INVALID_OUTPUT` rather than incorrectly implying transport failure.

## Regression coverage and security boundaries

`check:bw36.19r4` exercises nine groups with real extraction, authorization,
freshness, parsing, validation, signing and context planning. Only database
transport and providers are mocked. Saved Campaign fixtures contain canonical
Profile knowledge, an older campaign snapshot, approved/proposed Learnings,
multiple Nodes/two variations, Post-its, replies, AI Reviews, dissent, EN/DE prose
and original Unicode. No fixture comes from production.

Coverage includes Responses message and adaptor output, usage, valid empty
analysis, larger valid output, double JSON escaping, token sufficiency, Unicode
lengths, exact/nonexact/translated/rewritten quotes, missing/invented references,
valid plus invalid candidates, duplicate statements, evidence classes, wrong
language, incomplete status, truncated/malformed JSON, refusal/ambiguous output,
transport overflow cancellation, safe logging, logging failures, cross-pass
consolidation, access revocation and stale fingerprints. Mutation sentinels
check unchanged Learnings/events/Canvas and the absence of mutation SQL.

Focused BW-36.19/R1/R2 regressions retain their existing security, real disposable
PGlite SQL, receipt/adoption rollback and Chromium flows. Their mocks now include
completed Responses status and their token/context assertions reflect the new
reservation. Runtime Boot Safety registers R4 syntax and behavioral checks.

Original implementation local validation (not GitHub CI completion):

| Check | Result |
| --- | --- |
| `npm run check:bw36.19r4` | Nine production-shaped groups passed; mocked providers only |
| `npm run check:bw36.19` | 14 API/security groups, real disposable PGlite and Chromium passed |
| `npm run check:bw36.19r1` | Existing canonical/historical saved Board, disposable database and Chromium checks passed |
| `npm run check:bw36.19r2` | Eight adaptive context/security groups and streaming Chromium checks passed |
| Full Runtime Boot Safety | All **172 validation run steps / 215 command lines** passed, including relevant historical BW-26 language and BW-36.17/18 governance regressions |
| Syntax and `git diff --check` | Passed |

The workflow's dependency-preparation step was satisfied by installing the existing
package dependencies and using the available `/usr/bin/chromium`, as the browser
fixtures do. All validation steps were executed locally. The initial sandbox
attempt blocked child-process/Chromium sockets; the complete suite was rerun with
the supported test permission mechanism. No test contract was weakened to work
around those environment failures. After the final schema evidence-minimum
alignment, affected R4 and R2 suites were rerun.

## Remaining production risks

1. The particular live incident is unproven until a subsequent failure produces
   a stage/category. Mocked requests do not establish real model adherence,
   provider availability, production configuration or deployment alignment.
2. 8,192 tokens accommodates the measured fixture, not every theoretical schema
   maximum. Oversized/unfinished output still fails; no retry or extra paid job
   runs. Increased reservation can increase source passes and output cost, and
   the unchanged runtime budget can reject a larger plan before inference.
3. Literal excerpts deliberately reject typographic, spacing and translation
   changes. The prompt clarifies this rule; weak model adherence can still fail.
4. Language detection remains the existing conservative EN/DE marker heuristic;
   short or quoted prose can be ambiguous. The existing forbidden-claim regex
   can also reject discussion of a forbidden term, even when negated. Neither
   semantic evidence classification nor truth is independently established by
   schema or citation checks. Human approval remains essential.
5. No partial recovery means one invalid candidate can still suppress otherwise
   usable candidates. This preserves shared synthesis integrity until a contract
   can verify independent candidate lineage and disclose partial coverage.
6. Disposable PGlite and mocked lifecycle races do not establish multi-process
   production database contention behavior. Authorization/locking semantics and
   adoption logic are unchanged. No SQL or Canvas mutation was added.


## Repair of cancelled GitHub Runtime Boot Safety (PR #769)

### Evidence and diagnosis

The exact cancelled run is
[38479204944](https://github.com/Funklix/Funklix/actions/runs/38479204944),
job `115577362210`, at original head `c5a7e2c`. Step 160 ran
`npm run check:bw36.14r1`. Its server success message was logged at
2026-10-13 22:41:14 UTC. There was no Chromium completion or application assertion
message before cancellation at 2026-10-14 04:40:08 UTC. The runner then terminated
the surviving npm, Node and Chrome processes. Subsequent Canvas/Learning/Advisor
steps were skipped. The original GitHub workflow **did not pass**.

An isolated trace of the original browser fixture completed all assertions and
teardown in approximately 62 seconds on local Chromium 151 / Playwright 1.64.0.
The cancelled CI setup downloaded Chromium 156 (revision 1248); its actual selected
browser version was not logged. The new fixture logs both versions. Downloading
that CI Chromium locally was rejected by the environment network policy for
`cdn.playwright.dev`; no alternate route was used to bypass that restriction.

A controlled 500 ms delay before the held AI request registered its resolver
reproduced a concrete defect in the original test: the fixed 100 ms sleep ended
before `aiHold.release` existed, and the unchanged request-registration assertion
failed. The original fixture also assigned each resolver onto a mutable shared
object, did not release held requests in `finally`, and awaited `browser.close()`
without a deadline. These are evidenced synchronization/cleanup gaps, not
application behavior changes.

**The exact operation responsible for the original six-hour stall is unresolved.**
The delayed-request assertion reproduced a fixture race but did not reproduce
six hours of blocked teardown locally. It would be incorrect to label the old
cancellation an application regression, proven Chromium flakiness, or a confirmed
specific deadlock. No production regression was observed in the successful
original trace or repeated repaired tests. No shared persistent provider/database
resource was used by this fixture; all requests were local mocks. The instrumented
GitHub run is required to establish whether the complete workflow now succeeds.

### Three changed files and rationale

- `scripts/check-bw36-14r1-restore-complete-campaign-v3.js`: use explicit
  request-arrival promises instead of 100 ms registration guesses; capture each
  held gate before awaiting; release all waiting/future callbacks with one stable
  promise; abort held AI/save routes during cleanup before any fixture save;
  unregister handlers, close contexts and close Chromium with bounded cleanup.
  Emit stage checkpoints, elapsed time, pending/held counts, open-page count and
  browser/Playwright versions. No source payloads, prompts or provider output are
  included in checkpoints.
- `.github/workflows/runtime-boot-safety.yml`: add `timeout-minutes: 5` only to the
  complete Campaign V3 browser step. All tests and later workflow steps remain.
- This implementation document: correct the distinction between earlier local
  validation and cancelled GitHub CI, and record evidence, behavior and results.

The original access, persistence, generation, quality/repair, duplicate-submit,
rollback, immutable replay, reconciliation, hydration, identity-revocation,
13-node/17-edge, theme/reflow and zero-external-call assertions remain. The held
request assertion still verifies that the handler actually arrived (`started`),
now after waiting on its arrival signal. Product code, historical migrations and
architecture documents are untouched.

### Failing watchdog and cleanup behavior

The Chromium fixture has a **180-second** watchdog, chosen against successful
local executions of approximately **61–78 seconds**, including a 500 ms delay for
held callbacks. It covers launch, navigation, actions, mocks and teardown. On
expiry it prints the last stage and resource counts, marks exit status nonzero,
releases every held request, attempts browser cleanup, and forces exit 1 after
five seconds if work is still unresolved. An expired test never reports success.

Individual request-arrival waits retain a 15-second bound. Normal failure cleanup
has a separate ten-second deadline and a nonzero forced-exit fallback if cleanup
itself stalls. Cleanup is idempotent and preserves the original assertion error.
Only teardown route errors are ignored after handlers have been removed; test
assertions are not converted to success. The five-minute workflow timeout is an
independent final safety net for the whole command, including the server checks.

### Verification status

- Original traced isolation: passed, approximately 62 seconds.
- Repaired isolated runs: three normal runs passed (61.3, 68.3 and 72.7 seconds).
- Delayed-request isolation: all unchanged assertions passed (77.5 seconds),
  including the case that failed the original fixed-sleep fixture.
- Assertion-failure injection while AI was held: exited 1; teardown reached zero
  pending routes, zero held requests and zero pages in approximately 0.3 seconds.
- Deliberately unresolved-operation watchdog injection: exited 1 within the
  configured test timeout plus its five-second fallback; cleanup diagnostics
  confirmed browser resources were closed. This is a negative test, not a pass of
  the intentionally broken browser scenario.
- Independently rerun BW-36.19R4 (nine groups), BW-36.19, R1 and R2: passed,
  including disposable PGlite and Chromium. All provider calls were mocked.
- Full local Runtime Boot Safety and complete GitHub workflow: results pending
  at the first repair push; final conclusions will be appended after completion.

The specific historical stall remains uncertain until a failure records its
checkpoint. The diagnostic watchdog bounds that uncertainty and fails visibly.
Local Chromium differs from CI, so local successes alone do not establish CI
readiness. No production SQL, paid OpenAI request, replacement PR or merge was
performed.
