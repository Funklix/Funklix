# BW-36.19R1 — Existing Board compatibility

Implementation date: 2026-10-13 (Europe/Berlin). Base: GitHub main
`5c77b3bd359acd5a173f0e84291ea34a1795f02e`, including merged PR #766.

## Confirmed root cause and evidence

BW-36.19 validates every saved edge as an object with `from` and `to` properties.
The production Canvas persists edges as two-element arrays `[fromId, toId]`:

- `app.js:addEdge()` pushes tuples; `serializeState()` saves `state.edges` unchanged.
- `applyCampaignState()` hydrates those tuples unchanged; rendering and inheritance
  destructure the endpoints.
- `campaign-creation.js:campaign()` explicitly validates two-element tuple edges.
  `api/_campaign-creation.js` appends those validated edges to the persisted Board.
- Historical `app.js` at commit `332aa72` already used tuple edges and serialized
  flat Node objects, before `schemaVersion` and Canvas metadata were introduced.
- Generated Campaign V3 plans use `fromIndex`/`toIndex` temporarily. Creation
  resolves these indices through real Node IDs and `addEdge()` before persistence.
  Plan indices are not a saved Board format.

Thus a valid connected Board is rejected by the Advisor even with the current
`schemaVersion: 1`. Empty-edge, one-Node fixtures in BW-36.19 concealed the defect.
BW-36.18 validates the selected flat Node and its unique text ID; it does not
impose the Advisor's incorrect whole-graph edge assumption.

The synthetic connected campaign regression was run before editing the service:
preview returned HTTP 422 / `UNSUPPORTED_SOURCE` instead of HTTP 200. The same
assertion passes after the fix, followed by an explicitly requested mocked analysis.

The actual Appics / “QA Existing Brand Test” persisted row was **not inspected**.
This is a proven canonical-format incompatibility and a reproduction of the live
symptom, not proof of that private Board's exact contents. Its edge count, schema
markers, field lengths and discussion shape remain unknown. No private content,
raw Board logs or production SQL were requested or used.

## Every original UNSUPPORTED_SOURCE path

`loadScope()` has no direct `UNSUPPORTED_SOURCE` throw; it authorizes and checks
freshness before calling `extract()`. On the PR #766 baseline, the following
conditions produce that code:

| Boundary | Original rejecting condition | Finding / R1 behavior |
| --- | --- | --- |
| Profile | Non-object canonical Profile (including null); non-object truthy campaign snapshot | Absent/null Profile and snapshot contribute no text. Present malformed roots still fail. Flat objects remain separately classified. |
| Canvas root | Non-object Canvas; missing/non-array `nodes` or `edges` | Root must be an object. Absent collections default to empty, matching hydration; present non-arrays still fail. |
| Structural size | More than 100 Nodes or 300 edges | Same caps, now HTTP 413 / `CONTEXT_OVERFLOW`. |
| Schema | Non-null `schemaVersion` other than numeric 1 | Numeric 1, equivalent string `"1"`, and absent/null marker accepted; unknown declared schemas still rejected. String 1 is accepted by the existing Canvas payload validator, but is not claimed to be observed production data. |
| Canvas version | Non-null `version` whose string form is not 1, 2 or 3 | Existing compatibility gate retained. The canonical serializer has no `version` field. Campaign V3 is a generation contract, not Canvas schema version 3. |
| Node identity | Non-object Node; non-string, empty, over-200-code-unit or duplicate ID | These gates remain, with whitespace-only, control-character and unpaired-surrogate IDs also rejected. IDs stay exact; no coercion, prefix requirement or UUID assumption. |
| Optional discussions | Non-array `postits`, or more than 100 roots on a supported active Node | Non-array optional collection excluded with coverage warning; root cap unchanged and classified as overflow. |
| Relationships | Non-object edge, or `from`/`to` not present in the exact Node ID set | Confirmed bug: accept exact tuple endpoints; preserve previously accepted object form. Reject dangling, numeric, ambiguous alias or malformed endpoints. |
| Text helper | Present non-string text reaching `text()`, notably included message text or Learning text | Still rejected. Optional nontext Node/Profile fields are excluded and reported instead of silently ignored. Oversized selected text stays overflow. Unsafe selected control/surrogate text fails closed. |

Malformed included threads and excess message count/depth originally produce
`UNSUPPORTED_THREAD`, not `UNSUPPORTED_SOURCE`. They still do. Unknown excluded
thread handles and changed persisted sources produce `STALE_SOURCE`. Missing or
cross-associated Boards produce `SOURCE_UNAVAILABLE`; denied source reads produce
`SOURCE_ACCESS_DENIED`; Workspace, Brand and identity denials retain their existing
bounded codes. No raw exception, SQL, provider response or identity data is added
to API errors.

## Supported persisted formats and exact changes

Current and historical Boards use flat Nodes: `id`, `type`, optional `title`,
`content`, `description`, `body`, `social`, `postits`, and other Canvas fields.
Current IDs normally use `node-<counter>`; other safe unique text IDs remain valid.
Current serialization includes `schemaVersion: 1`, counters, zoom, activity feed
and metadata. Pre-schema Boards omit those newer optional fields.

The existing Node-type allowlist is unchanged: Idea, Campaign Variation, Content,
Social Media Posting, legacy Social Media Post, Landing Page, Email Campaign,
Visual Concept and Image Brief. Unknown and inactive Nodes are excluded with
coverage categories, but their IDs still participate in relationship validation.
No React Flow `data` wrappers, `source`/`target` graphs, numeric identifiers or
generator-index relationships are guessed or converted.

Only the Advisor normalizes tuple edges into its existing provider `{from,to}`
projection. Saved Canvas data, serialization, hydration and campaign creation are
unchanged. Previously accepted object edges remain compatible; conflicting alias
keys are rejected. All endpoints must reference one unique exact saved Node ID.

Missing social, landing-page, image, owner, timestamp, reply and other optional
fields do not invalidate a Board. Legacy Post-its can use mutable `user`/`time`
fields and omit IDs, timestamps, resolution or replies. Roots keep the existing
Node-ID/index thread handles. Resolved and unresolved messages are both eligible;
resolution remains independent of approval. Recursive replies preserve depth and
AI-parent attribution within the original limits.

Non-object optional roots/collections are excluded as `unsupported_discussion`.
Deleted roots and reply subtrees are excluded as `deleted_discussion`; deleted
descendants are never resurrected. Those exclusions set `complete_threads:false`.
Unsupported/inactive Nodes with discussions likewise prevent a complete-thread
claim. The EN/DE UI reports limited coverage and the excluded categories.
Present unsupported optional text fields are reported as `unsupported_field`.
An included malformed thread still rejects the analysis; provider-free preview
allows explicitly excluding that whole thread first. No included thread is
truncated to fit a budget.

## Security and extraction boundaries

Brand writer authority, verified signed session and canonical identity, active
Workspace/accepted membership, relational Brand/Board/Workspace association,
non-public Board read permission, locks, freshness checks, full-context hashes,
session-bound receipts and transaction-bound adoption authorization are unchanged.
No authorization is derived from Node content or discussion attribution.

Limits remain 100 Nodes, 300 edges, 100 roots/Node, 40 messages/included thread,
depth four, 100 active Learnings, 2,000 code units/selected text field and 4,000 for
Learning evidence. Profile persona and custom-tile arrays are now explicitly
bounded to 100 each. String-array fields retain their 20-item projection boundary;
unsupported field shapes are visibly excluded. Preview titles use a bounded
Unicode-safe excerpt. Extraction does not mutate sources.

The 8,000 UTF-8-byte prompt/schema budget, 2,000 output tokens, five suggestions,
25-second timeout, one explicit provider request, no tools/retries and `store:false`
remain intact. Valid large Boards can exceed Advisor budgets: they now receive an
overflow classification rather than a misleading unsupported-schema error.
Preview is not a guarantee that the selected text/discussions fit the final
provider budget. The analysis checks that budget before dispatch.

Allowlisted text only is evidence. Images, private documents, analytics, AI Brain
chats, activity feed and author identity fields are not projected. Optional data
that is wholly excluded is not treated as evidence. Malformed essential graph
identity/relationships and unsafe selected payloads fail closed. No source or
provider payload logging was introduced.

## Regression and validation evidence

`check:bw36.19r1` adds synthetic current six-Node campaign and historical fixtures:
real tuple relationships, legacy types, arbitrary safe text IDs, optional fields,
resolved/unresolved roots and nested replies. It checks the original live symptom,
object-edge backward compatibility, absent collections, separate Profile/snapshot
classification, deleted/unsupported optional content versus rejected essential
content, exact structural limits and overflow, malformed graphs, unsafe IDs/text,
stale sources, cross-association and denied membership. Excess included message
counts and malformed reply collections fail without inference; explicit whole
thread exclusion allows otherwise safe analysis.

The original one-Node fixture and BW-36.19 assertions remain. The browser fixture
also runs with the connected Board, exercises actual Canvas hydration/serialization,
and verifies provider-free analysis readiness, explicit mocked inference, review,
adoption, stale-draft preservation, zero Canvas writes, EN/DE limited-coverage copy,
themes, responsive layouts and keyboard behavior. The disposable PGlite fixture
runs the connected Board through actual SQL reads, analysis/receipt/adoption,
rollback, R2 provenance events, freshness and in-flight revocation checks.

Runtime Boot Safety includes the new syntax and regression commands. Validation
completed locally: all **209 workflow validation commands** passed (40 syntax
commands and 169 regression commands, including a targeted rerun of the new R1
test after correcting its fixture setup). Dependency/browser installation steps
were satisfied with local npm dependencies and system Chromium. Browser execution
required the environment's socket-enabled execution permission; assertions and
production code were not relaxed.

| Validation | Result |
| --- | --- |
| BW-36.19 | 13 security/API groups, original one-Node fixture, mocked Responses integration, PGlite and Chromium passed |
| BW-36.19R1 | Current/historical tuple-edge fixtures, exact bounds, safe exclusions/rejections, real Canvas hydration/serialization, provider-free readiness, mocked analysis/adoption, EN/DE coverage and PGlite passed |
| BW-36.18 | Governed provenance database/security groups and authenticated Chromium passed |
| BW-36.17 / R1 / R2 | Governed Learning lifecycle, historical migrations and disposable database recovery regressions passed |
| Canvas / Board persistence | BW-36.14 / 14R1 generation/persistence, Board access/association, canonical snapshot/refresh and posting-schedule persistence passed |
| Workspace / Brand | Workspace identity, membership, catalog, Brand association/lifecycle and responsibility continuity regressions passed |
| Post-it / Inspector | BW-33.4B lifecycle/resolution/emoji checks, authoritative comment counter and frozen Inspector hashes passed |
| AI Brain / Insights | BW-26 integrations and BW-28 Insights architecture/handoff/runtime checks passed |
| Runtime Boot Safety | All 209 validation commands completed successfully; browser script integrity and Knowledge Module globals included |

No production database commands or paid OpenAI requests were executed. The focused
tests exercise real application code with mocked external I/O and synthetic data;
SQL execution is confined to disposable PGlite instances.

## Remaining limitations and manual production smoke test

The named production Board remains uninspected. This change does not claim support
for unknown future schemas, arbitrary generation-plan payloads, unbounded contexts,
or complete evidence outside the text allowlist. Existing language and semantic
output checks remain heuristic. No paid OpenAI request was made. Local disposable
PostgreSQL checks do not simulate multi-process lock contention.

After deployment, an authorized Brand writer should:

1. Open Appics → Brand Profile → Learnings → AI Learning Advisor and select
   “QA Existing Brand Test”. Leave discussions off. Confirm preview succeeds and
   Analyze becomes enabled. Confirm selection issues only metadata/preview calls,
   with no analysis POST or OpenAI dispatch. Do not capture or share raw response
   payloads, source text or identity information.
2. Review coverage categories. Toggle discussions and verify eligible roots appear;
   exclude whole threads as needed. Inspect EN/DE warning behavior. Cancel without
   analyzing and confirm no Canvas changes, Learnings writes or provider requests.
3. If preview is rejected, record only the bounded error code/status and deployment
   revision. Distinguish overflow, unsupported schema, stale source and access
   denial; do not request a production Board dump or execute diagnostic SQL.
4. For inference verification, use the mocked fixture in a non-production test
   environment. A production Analyze click invokes the paid provider and was not
   executed or authorized as part of this implementation's validation.
5. Change/revoke a test source in that test environment and verify stale results
   and receipt adoption fail closed. Adopt only an explicitly reviewed proposal;
   confirm `proposed`, never automatic approval, and unchanged saved Canvas.

Delivery is one normal PR against main. It must remain unmerged.
