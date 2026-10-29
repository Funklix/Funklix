# BW-38.2A — AI Brain marketing goals

Base: merged main `165f811369cd2da8d8fc8426ba7a4a407685abf0`, including PR #836.
Date: 2026-10-29 (Europe/Berlin). No merge or manual deployment authorized.

## Verified root cause and native semantics

`index.html#node-goal` is an existing Inspector select: empty, Awareness,
Lead Gen, Conversion, Community and Education. `app.js` stores its trimmed
string in `node.goal`. This is not a schema enum: generated campaign metadata
is copied into `node.goal` by `applyGeneratedCampaignNodePayload`, and imported
or previously saved nodes may contain other strings. Therefore an objective
such as “Increase creator registrations” is valid native data even though the
Inspector does not offer that phrase as a preset. This PR does not change that
editor. A goal may be generated then saved; persistence does not confer human
approval, canonical Brand authority or measured performance.

`sanitizeNodeForPersistence` copies the native field; `serializeState` places
nodes in `canvas_json.nodes`; the existing Board PUT persists that snapshot
with its optimistic `lastKnownUpdatedAt` contract. On reload it hydrates native
nodes. The omission occurs afterwards: `aiBrainCanvasProjection` omitted goal,
and `_ai-brain-canvas-context.js` rejected it as an unsupported node key.
The evidence index could not recover omitted data and explicitly said that
native goal was not supplied. Advice already instructed the model to treat a
missing goal as unknown, so repeating a saved goal was previously necessary.

## Client and server contracts

The existing projection now copies only the native `goal` field alongside its
original node id/type. It never derives a goal from content, title, diagnostics,
Brand, conversation or generated advice. Goal values are not truncated: malformed
or oversized values reach validation and fail. Server validation permits strings
up to the existing short-field bound of 1,000 JavaScript code units; non-strings
produce 400 and oversize strings 413. Empty/whitespace-only strings are omitted
and remain unknown. Nonempty strings retain their exact whitespace, punctuation,
EN/DE text and Unicode. The underlying Canvas schema is unchanged.

Advice requests containing goals also send `canvas_revision`, taken from the
existing `state.lastKnownUpdatedAt`. A nonempty goal requires a valid matching
saved Board revision; missing, invalid or stale revisions return the existing
409 `advice_context_changed` error, without inference. Requests without goals
retain the existing request behavior and do not acquire new database reads.

`_ai-brain-goal-context.js` reuses the existing proposal scope authorization
contract: active identity, current Board edit access, accepted Workspace
membership when associated, current Workspace revision/status, and matching
Board/Brand Workspace association. Null Workspace/Brand remains supported under
the existing legacy Board policy. This does not grant canonical Brand read.
Advice opts into reading only the requested Board's persisted Canvas together
with its exact SQL timestamp in that same authorized transaction. Browser
revisions have millisecond precision while PostgreSQL `NOW()` can have
microseconds: do not compare the browser Date to the stored timestamp using SQL
equality. The raw SQL revision remains in the internal scope fingerprint, so
even a change within the same millisecond invalidates the answer. The stored
Canvas never enters the provider request. Content proposal scope reads retain
their existing projection and do not retrieve saved Canvas.

For each supplied nonempty goal, `workingCanvas.goalSources` contains nodeId,
canonical type, field `goal`, `state`, and boardRevision. `saved` requires exact
id, type and value equality with that revision's persisted node; all other
working/new values are `unsaved`. Repeated titles do not affect attribution.
Moving another node's goal or changing node type cannot acquire saved status.
Client-supplied provenance keys are rejected. Local changes remain legitimate
working context rather than being silently presented as persisted facts.
An unchanged saved goal may coexist with unsaved copy, layout or other fields;
the provenance deliberately attests only the goal, never the whole Board.

## Actual provider context before and after

Fictional fixture, same saved native node and same question. These are focused
extracts of the actual mocked Responses input, not a claimed model-generated
answer. The regression executes the production projection/request function,
Advice route, SQL validators, evidence builder and provider message builder.

Before, the projected/provider node has no goal:

```json
{"id":"variation-1","type":"Campaign Variation","title":"Creator launch"}
```

After, the matching `workingCanvas` extract is:

```json
{
  "nodes": [{"id":"variation-1","type":"Campaign Variation","title":"Creator launch","goal":"Increase creator registrations"}],
  "selectedNode": {"id":"variation-1","type":"Campaign Variation","title":"Creator launch","goal":"Increase creator registrations"},
  "goalSources": [{"nodeId":"variation-1","type":"Campaign Variation","field":"goal","state":"saved","boardRevision":"2026-10-29T08:00:00.000Z"}]
}
```

A local replacement remains the exact working node goal, with the corresponding
source labelled `unsaved`. A missing goal produces neither a fabricated value
nor a goal-source entry. The bounded evidence index adds an exact goal quotation
under `fields.goal`, still with its existing 180-character excerpt rules,
24-node limit and 32,000-character duplicate-data budget. The full validated
goal remains in `workingCanvas`; omitted index entries never prove absence.

## Privacy, authorization, freshness and evidence

The saved-goal verification runs after the existing Board and independent
canonical Brand checks. Canonical Profile and approved Learnings retain their
own ACL and lifecycle checks. Board-only editors can receive their Board's
goals without receiving hidden canonical Core or enumerating Learnings.
Sidebar Brand values are not accepted as context authority. Unprojected saved
nodes, goals, comments, owners and images are never added to the provider input.

Before inference and before releasing the answer, the goal helper recaptures
authorization/scope and recomputes provenance at the same saved revision.
Scope, identity, membership, association, revision and saved-goal changes fail
closed. Existing Learning revalidation still runs independently. Database or
schema failures remain unavailable errors rather than empty successful context.
No database lock is held during inference. On the client, the existing request
context identity now includes goal naturally through the projection: an edit
while waiting suppresses the stale answer and retry captures current context.

Goals remain untrusted task data. Existing system evidence policy applies to
every supplied field and quotation. The evidence source description explicitly
distinguishes saved/unsaved goals from instructions, canonical truth and
performance. Advice can use a relevant objective without forcing it into every
answer; existing modes, conversation style, response shape and disclaimers
remain. No inferred KPI baseline, rate or outcome is added. Model/provider,
`store:false`, inference count, output limit and complete-message token budgeting
are unchanged. Maximum Canvas remains 200 nodes, 400 edges and 350,000 request
bytes. Larger context still rejects rather than truncating nodes or increasing
the provider context budget.

## Focused regression evidence

`npm run check:bw38.2a` uses fictional data, disposable PGlite SQL and a mocked
Responses transport, with the real Advice handler and authorization helpers.
It covers one/multiple goals, repeated titles with distinct identities, missing
goals, whitespace, punctuation, Unicode/EN/DE, injection-like text as inert data,
malformed and oversized goals, swapped goals/wrong IDs/types, forged provenance,
saved versus local context, 200/201/223 nodes, request bytes, missing/stale
revisions (including PostgreSQL sub-millisecond values and changes), unauthorized Boards, canonical ACL isolation, approved-only Learnings,
sidebar mismatch, Workspace membership/association changes and revoked access.
It verifies exact provider context, one or zero calls, `store:false`, unchanged
budget, response structure, and suppression after remote or local changes during
inference. Production client functions execute in a VM; broader existing
handoff and lifecycle suites execute in Chromium. This is not a live model
quality evaluation or a claim that every response will reference a goal.

The BW-37 evidence regression now expects the newly supported native goal and
still rejects malformed goal objects. The shared SQL fixture optionally models
native Canvas/Workspace columns and shares Date with its VM so real PostgreSQL
timestamp values retain their production semantics. Existing fixture defaults
and assertions remain. Runtime Boot Safety runs the new focused test in both
PostgreSQL 17.6 and 18.4 jobs alongside all existing checks. Final execution and
review results are reported on the PR; a workflow definition alone is not proof.

## BW-38.2B preparation — design only

Verified representation: `campaign-v3.js` plans an Idea root with variation /
Content / Social lanes and optional shared Landing Page / Email funnel nodes.
Planning edges have temporary ids, semantic types and lane ids. Native Canvas
commit uses node ids and endpoint connections (`addEdge` stores `[fromId,toId]`);
the Advice projection also understands object-shaped endpoint variants. Durable
ownership must not be inferred from temporary lane ids, screen position, order
or title. `deriveCampaignFunnelEdges` supports Idea → Variation → Content →
Social → Landing/Email and Landing → Email. The existing responsibilities
`structure` groups Ideas and typed connected assets and recognizes shared
funnel nodes; it is a UI grouping helper, not an authoritative security or
complete campaign-boundary contract. A Board can contain multiple Ideas,
cross-links, orphan nodes and manually edited connections. No immutable campaign
membership identifier is established by these helpers.

Recommended user experience:

- Full Board: available when the complete selected projection fits node, edge,
  byte and model-token limits. Show Board, node/edge counts and saved/unsaved
  status before Send. Above bounds, explain the limit and offer a smaller scope.
- Existing campaign: explicitly choose a visible Idea/root by title and id.
  Preview candidate members, shared assets and excluded nodes before confirmation.
  A single maximum Creator campaign can itself have 223 nodes: choosing its root
  alone does not solve capacity. Offer a narrower connected area or a clearly
  disclosed future summary only under a separately reviewed contract.
- Selected connected area: begin with explicit Canvas selection, preview the
  exact node/edge membership and let the user confirm/adjust it. Show boundaries,
  counts, omissions and whether the currently selected node is included.

Unresolved product rules: root discovery with inbound/cyclic links; whether
traversal is directed; what edges define membership; multiple roots reaching one
node; shared Landing/Email assets across campaigns; orphan and nonstandard
nodes; boundary/cross-scope edges; multi-selection depth; selection versus
campaign intent; and what to do when one campaign still exceeds any limit.
Do not silently pick the first Idea, traverse the whole connected component or
trim to 200 nodes. Deterministic user-confirmed scope and coverage must precede
any future summary strategy or capacity change.

Future security requirements: independently authorize the current Board and
Workspace; bind chosen roots and exact membership to Board/load/association
revision; validate every selected id and internal edge endpoint; disclose
excluded boundary edges; retain canonical Brand and approved-Learning ACL;
reject scope changes before inference/output; preserve field-level goal
provenance; never use hidden Boards, canonical data or history to fill omissions;
measure full serialized/token costs without extra inference by default. Scope
selection must remain separate from destination-owned handoffs and persistence.
No new selection UI, traversal or summary inference is implemented in BW-38.2A.

## Exact changed files and limitations

- `app.js`: exact native goal projection and existing Board revision on Advice.
- `api/_ai-brain-canvas-context.js`: bounded native goal validation.
- `api/_ai-brain-goal-context.js`: authorized persisted-goal provenance/freshness.
- `api/_ai-brain-proposal-scope.js`: opt-in atomic saved Canvas/exact revision read for Advice.
- `api/_ai-brain-evidence.js`: bounded source quotations and goal authority policy.
- `api/ai-brain/advice.js`: provenance integration/revalidation; existing reply shape.
- `scripts/check-bw38-2a-marketing-goals.js`: focused production-path regression.
- `scripts/check-bw37-1b-strategic-answer-quality.js`: updated supported-field contract.
- `scripts/fixtures/bw36-20-database.js`: optional native goal/scope fixture support.
- `package.json`: focused regression command.
- `.github/workflows/runtime-boot-safety.yml`: syntax and matrix regression integration.
- `docs/implementations/bw38-2a-ai-brain-marketing-goals.md`: this record/design.

Limitations: goals over 1,000 code units require correction, not silent clipping;
the Inspector still offers its existing presets; goal-bearing Advice requires
current persisted revision and existing identity/Workspace authorization; whole
Board scope still rejects supported Creator output above the Advice bound.
Saved means persisted, not approved or measured. Semantic advice quality remains
unmeasured with a live provider. No migrations, schemas, model changes, automatic
Canvas/Brand changes, permissions rewrite, persistence redesign or BW-38.1
sequential-feature changes are included.
