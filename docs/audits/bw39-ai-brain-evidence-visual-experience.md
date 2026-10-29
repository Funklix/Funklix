# BW-39.0 — AI Brain Evidence & Visual Experience Foundation

Date: 2026-10-29 (Europe/Berlin). Repository: `Funklix/Funklix`.
Audited commit: **`1b277c8ae7b2dc1d6a01365020ec3cba05bba50c`**, merged `main` including [PR #837](https://github.com/Funklix/Funklix/pull/837). GitHub's current-main commit was checked through the connector because the sandbox shell proxy was unavailable; the local HEAD matches it. The local `origin/main` tracking ref was stale and was not used as audit authority.

**Audit and UX design only.** This change adds this document, with no application changes, database changes, migrations, inference, production data writes, visual assets, merge or deployment. Sections D–J describe proposed behavior, not delivered functionality.

Evidence vocabulary: **C** means current source inspected; **T** means a regression executed for this audit; **D** means a historical implementation record; **H** means a product hypothesis; **U** means unverified. Mocked provider responses establish deterministic contracts, not live answer quality.

## A. Executive product assessment

AI Brain already receives substantially more evidence than its interface exposes. Extend the existing Advice evidence index into a small, server-validated response contract. Do not build a second evidence system or a dashboard. The first useful workflow is: identify one specific Canvas issue → inspect its exact supporting field → open that exact node in the existing Canvas Inspector.

BW-37.1B already supplies actual node IDs, exact quotations, diagnostic counterevidence and source policies. BW-38.2A adds native marketing goals and saved/unsaved provenance for **the goal field only**. Neither implementation makes every returned claim attributable or creates a trusted navigation reference. Advice still returns an unstructured answer string. Its safe text renderer deliberately creates no interactive citations. These are the verified product gaps, rather than missing access to native goals on current main.

The supplied user observation is credible as a UX problem: a response about audience inconsistency, missing CTAs and tone variation did not identify the supporting nodes, and its broad goals were hard to distinguish from saved objectives. The complete real request payload, Board snapshot and response are not available in this audit. Consequently, which actual nodes support those particular claims, whether that response predates #837, and whether its recommendations are strategically correct remain **U**. No customer nodes, quotations or model outputs are invented here.

| Expected improvement (H) | What the MVP makes possible | Evidence needed after implementation |
|---|---|---|
| Understanding | Read the actual CTA and relevant native goal beside the explanation | User can explain which field supports the recommendation and which part is interpretation |
| Trust | Distinguish source match, persistence and strategic judgment | User detects missing/counterevidence; unsupported findings never receive a source-checked presentation |
| Finding work | Open the referenced ID despite repeated titles | One deliberate action opens the correct existing node and Inspector |
| Follow-through | Inspect and decide on a normal Canvas edit | User can locate the relevant editable field without any automatic edit |

These are testable value hypotheses, not measured time savings or performance improvements. Visuals earn their place by shortening the path from a claim to its source.

Read-first sources: [repository rules](../../AGENTS.md), [product ownership](../constitution/product-architecture.md), [intelligence blueprint](../product/product-intelligence-architecture.md), [BW-38 UX review](bw38-end-to-end-product-ux-review.md), [BW-38.2A goals](../implementations/bw38-2a-ai-brain-marketing-goals.md), [BW-37 advisor audit](bw37-ai-brain-2-strategic-advisor-audit.md), [answer-quality audit](bw37-1b-strategic-answer-quality-audit.md), [answer-quality implementation](../implementations/bw37-1b-strategic-answer-quality.md), [conversational advisor](../implementations/bw37-1b-r1-conversational-advisor.md), [action-handoff audit](bw37-1c-ai-brain-action-handoffs-audit.md), [contextual Canvas actions](bw37-1c3-contextual-canvas-actions-audit.md). Historical gaps must be checked against current code; several are already fixed.

## B. Current evidence architecture

### Actual flow and authority (C)

```text
Board canvas_json ← existing serializeState / Board save owner
       ↓ reload hydrates native state.nodes / state.edges
Browser aiBrainCanvasProjection() ← includes current local edits
       ↓ authenticated Advice; Board canEdit required
validateCanvasContext() → bounded, normalized working projection
       ├─ analyzeCanvas() → deterministic structural diagnostics
       ├─ prepareEvidence() → bounded index and source/counterevidence guide
       └─ goalContext.capture() → authorized saved Canvas comparison, if goals supplied
learningContext.capture/prepare → authorized Board/Brand/Learnings and full-message budget
       ↓ pre-dispatch revalidation
one Responses request → outputText() → post-response revalidation
       ↓ answer + context metadata + disclaimer
browser request lifecycle checks → turn.answer → safe text DOM
```

The saved Board is not automatically the whole provider Canvas context. The browser sends a projection of current native state, potentially unsaved. Structural validation authorizes neither a submitted node's persisted existence nor the truth of its copy. Board authorization and independently authorized canonical Brand context are separate operations. The persisted Canvas read added for goals stays on the server; it does not fill omitted provider fields.

### Traceable inventory (C)

| Stage / owner | Existing behavior | Boundary relevant to BW-39.1 |
|---|---|---|
| `app.js`: `sanitizeNodeForPersistence`, `serializeState`, `saveBoardToServer` | Native `goal` and other Canvas fields persist through existing `canvas_json` save/load; `lastKnownUpdatedAt` is the browser's acknowledged Board revision | Persistence is not approval. Do not trigger save, reload, conflict resolution or replacement of dirty work from a citation |
| `app.js`: `aiBrainCanvasProjection` | Actual node IDs/types; legacy `Social Media Post` becomes `Social Media Posting`; actual edge endpoints; native `goal` retained exactly | Most strings are sliced before dispatch; projection is not a full native-node snapshot |
| `api/_ai-brain-canvas-context.js`: `validateCanvasContext` | Strict keys/types, duplicate-ID rejection, canonical types, supplied edge/selection referential checks | IDs only resolve within submitted working nodes, not necessarily persisted Board nodes |
| `api/_ai-brain-evidence.js`: `prepareEvidence` | Uses actual node IDs; no independent citation IDs, credentials or lookup service; selected node, then direct neighbors, then remaining Canvas order | Existing IDs can be reused. Index entries are an attribution aid, not authorization |
| `api/_ai-brain-goal-context.js`: `capture/revalidate` | If any nonempty goal is supplied, requires matching browser revision and independently captures identity/Board/Workspace/association plus saved Canvas; exact ID + canonical type + value comparison labels each goal saved/unsaved | Does not verify saved state of title, caption, CTA, content or every node; requests without goals do not acquire this additional path |
| `api/_ai-brain-learning-context.js`: `capture/prepare/revalidate` | Board edit access, independently authorized canonical Core and approved Learnings; captures/rechecks actual values/revisions; Board-only access does not enumerate hidden Brand knowledge | Supplied Learning `L1` etc. identifies supplied context, not proven sentence attribution or a Canvas navigation target |
| `api/ai-brain/advice.js`: `providerMessages`, `outputText`, handler | Explicit source/field/exact-phrase policy; one nonstored Responses call; pre/post context checks | Response is text with no machine-validated claim-to-node mapping |
| `app.js`: `requestAiBrainAdvice`, `renderAiBrainTranscript`, `renderAiBrainFormattedAnswer` | Request generation, Board/email/load identity, edit permission, selection and exact projected-Canvas comparison; EN/DE language identity; inert DOM formatting | Completion stores selected response properties, not arbitrary provider metadata. Future references require explicit parsing/storage/rendering |

Eight accepted types: `Idea`, `Campaign Variation`, `Content`, `Social Media Posting`, `Landing Page`, `Email Campaign`, `Visual Concept`, `Image Brief`. This is a read-context contract, not the whole native persistence schema and not permission to create any type.

The provider receives `workingCanvas.nodes`, `edges`, `selectedNode`, optional `goalSources`, index nodes with their same IDs, indexed audience/tone groups, direct-neighbor IDs, CTA/trust diagnostic IDs, Board metadata and separately scoped Brand/Learning data. Titles may repeat. Edges establish a supplied connection, not inferred campaign membership, dependency or strategic intent.

### Fields, limits and provenance (C)

| Surface | Actual fields / limit | Meaning |
|---|---|---|
| Validated working nodes | ID ≤160; type ≤80; title/status/funnelStage/audience/tone/cta/channel ≤1,000; content ≤8,000 JavaScript code units | General strings are trimmed by server validation after browser slicing |
| Native goal | Nonempty string ≤1,000; exact whitespace preserved; malformed/oversized rejected | Saved provenance requires exact persisted ID/type/value equality at authorized revision; absent goal stays unknown |
| Social | caption, platform, preview, cta ≤3,000; hashtags ≤20 strings of ≤100 | No images, posting outcomes, schedule, owners or approvals are inferred from this projection |
| Landing Page | headerClaim, problem, solution, trust, cta ≤3,000 | No full page/visual or analytics context |
| Quotation index | `goal`, `content`, `cta`, `social.caption`, `social.preview`, `social.cta`, `landingPage.headerClaim/problem/solution/trust/cta` | Only present nonempty strings; each quote is an exact prefix ≤180 code units, with `excerpted` separately flagged |
| Index capacity | ≤24 node entries; ≤32,000 serialized characters for indexed nodes plus audience/tone groups | Counts/titles/escaping count toward duplication budget. Entries can be skipped; omission never proves absence |
| Whole working Canvas | ≤200 nodes, ≤400 edges; Advice body limit 350,000 bytes | No silent node pruning. A maximum 223-node Creator output can exceed this; scope/capacity redesign is deferred |
| Conversation | ≤4 exchanges; user ≤2,000, assistant ≤12,000, combined ≤28,000 characters | Ephemeral history is untrusted reference context, not current source authority |

The index's full-Canvas diagnostic IDs/counts and direct-neighbor IDs can exceed the 24 indexed entries. Its 32,000-character bound does **not** bound all raw context or the whole evidence object. Full validated working values remain supplied even when not indexed. Native data can already be omitted/truncated by browser projection. Neither an absent index field nor a truncated quote proves a missing CTA in the complete native copy.

Only goals currently have server-verified saved/unsaved field provenance. A saved goal can coexist with unsaved caption/CTA/title. The header's `state.isDirty`-based “Saved Canvas context” / “Includes unsaved Canvas changes” is useful UI disclosure, not a field attestation. Goal persistence does not make it canonical Brand truth, human approval, strategic interpretation or a measured result.

### Actual provider/output contract and freshness (C)

Advice sends `model` (default `gpt-4o-mini`), `store:false`, `max_output_tokens:4096` and `input` to `/v1/responses`, with a 25-second fetch timer. There is no structured citation output schema. System instructions request node title **and ID**, field path and a short exact phrase for material claims, separate observations/interpretations/unknowns, and forbid model HTML, links, images, tables, embeds and code blocks. These instructions discourage unsupported generalizations; they do not enforce compliance.

`outputText` takes `output_text` or concatenates all assistant `output_text` blocks, cleans and bounds the result to 12,000 characters. It does not parse structured evidence; separate provider metadata/annotations do not become API citations. IDs mentioned in answer prose survive as ordinary text, with no validation or click behavior. Success returns `{answer, context, disclaimer}`; context contains Board/Brand flags, counts, selected-node descriptor, diagnostic version, history/reference-resolution mode, language/mode and optional supplied-Learning transparency. The selected node descriptor is not a reference to all nodes used by the answer. The early clarification response makes zero inference calls and has no evidence-linked findings.

Budgeting counts complete serialized messages with the existing encoding, reserving 4,096 output and 1,024 framing tokens. Default model context is 128,000 tokens; custom model configuration must name the matching context/encoding. Learnings pack as whole statements; actual final messages are checked; excessive base context produces 422. Adding citation instructions must stay inside this budget, not silently replace omitted raw context or increase capacity.

Learning-context capture revalidates Board access and supplied Board/Brand values plus selected approved Learning revisions before dispatch and before release. Goal-bearing requests additionally revalidate unique active application identity, Workspace membership/status/revision, association, exact saved Canvas and raw SQL timestamp through the goal/scope owner. Browser dates have millisecond precision; PostgreSQL revisions can have microseconds. Preserve the raw revision in internal comparisons, rather than comparing a rounded browser Date to SQL equality. No-goal Advice should not be described as already having all goal-specific checks. Neither boundary check can retract data already transmitted to the provider.

### Existing Canvas and handoff owners (C/D)

`focusNodeInCanvas(nodeId, {behavior, select:true, pulse})` resolves through `getNode`, checks the rendered node, uses `setActiveView("board")` when necessary, selects via `selectedIds/selectedPrimary`, calls `updateSelectionClasses` and `fillInspector`, and scrolls/pulses through existing Canvas behavior. It returns false if the node/DOM is unavailable. This is a navigation helper, not an authorization guard. `showInsightsFindingOnCanvas` demonstrates current identity/snapshot checks before calling it. Do not copy its “first affected node” behavior into Brain: the clicked reference must name the exact target ID.

`completeAiBrainNodeCreation` and `revealAiBrainCreatedNode` handle a **newly created** node after canonical navigation/layout, including Inspector/toolbar viewport bounds. Reuse their layout lessons if needed, never their creation/mutation path for opening evidence. Account for adaptive Canvas details and existing Inspector close/flush ownership; a citation must not force a second Inspector or bypass pending destination UI decisions.

Campaign `openAiBrainCampaign` and `revalidateAiBrainCampaignSource` stage an editable Creator brief; generation/commit remain Creator-owned. `openAiBrainContentReview` and the Content/Social proposal flow preserve exact source selection, editable previews and explicit Add/Create; Social preparation is deterministic, Content conversion has its separately disclosed call. `openAiBrainBrandProposal` stages only an eligible Value Proposition via the protected Profile destination; separate explicit Profile Save owns persistence. Evidence analysis/opening must not invoke these actions, change their eligibility from incidental quoted copy, consume a candidate, or reset sequential continuation. Preserve `turn.answer` as the exact natural-text answer used by existing source parsers; never append evidence metadata to it.

## C. Verified gaps in response grounding

| Finding | Evidence / consequence | Required product treatment |
|---|---|---|
| Guidance exists without a citation contract | `EVIDENCE_POLICY` requests attribution, but `outputText`/success only carry text | Validate proposed references on the server; explicitly retain them in browser turns |
| Structural heuristics can resemble strategic conclusions | `_ai-brain-diagnostics.js` tests multiple audience labels, >2 tone labels and CTA presence via Landing CTA or Social preview | Different segments/labels are not inconsistency; preview presence is not CTA clarity; expose actual copy and counterevidence |
| Broad absence is especially unsafe | CTA diagnostics do not inspect every top-level/social CTA or interpret caption; index is partial | “Many nodes lack CTAs” cannot be source-checked from the warning or absent index entries |
| Goals can still be semantically conflated | Native goals now arrive with per-field provenance, but interpretation is unconstrained prose | Quote the exact native value with its status; place any proposed strategic objective separately |
| General evidence provenance is incomplete | Persisted equality is currently checked only for `goal` | Default other fields to working context; introduce narrow cited-field verification, not a whole-Board saved badge |
| No trusted node-opening object | Text formatter intentionally has no links/buttons from model output | Add explicit server-resolved reference metadata and a guarded UI action |
| Current client identity is insufficient for long-lived navigation alone | Email/Board/load/projected Canvas comparison is useful, but not independently fresh SQL authorization or full account/Workspace proof | Capture exact account object and persisted scope; recheck after every await and before invoking Canvas |

Do not claim the current prompt positively instructs the model to generalize: it explicitly warns against this. Aggregate warnings are nevertheless salient context, and free text permits ungrounded synthesis. No model comparison or live reproduction establishes which factor caused the reported response. Supplying data is not proof of its use.

| Claim category | Proposed display / validation rule |
|---|---|
| Exact node-specific observation | Source-check ID/type/field/excerpt against authorized supplied context; server supplies title/type/quote/provenance. “Source checked” attests the source match, not strategic correctness |
| Strategic interpretation | “AI interpretation” with concise rationale tied to available sources; clarity/alignment judgments remain interpretation even when quotations are valid |
| Missing evidence | Say what is unavailable or outside supplied coverage. No fabricated ID, inferred saved goal, empty quote or automatic fallback to another node |
| Conflicting evidence | Show the relevant differing values, preserve campaign constraints, explain uncertainty. Do not silently reconcile Brand snapshot/canonical identity or treat label variation as a defect |
| Saved vs working | Field-specific persisted equality only; goal's existing saved/unsaved states remain exact. Other unmatched copy says “Working context — may include unsaved edits,” not “Saved” or definitely “Unsaved” when truncation/normalization could explain a mismatch |
| Measured performance | No performance claim from copy, goals, diagnostics or approved Learnings alone. Say measurement is unavailable; an improvement suggestion is not evidence of poor conversion |

For quantified absence, a future server rule would need a defined applicable population, complete relevant fields, explicit count/denominator, actual node identities and counterevidence across all CTA locations/copy. BW-39.1 does not implement that rule. It source-checks positive excerpts, never validates an absence conclusion merely because a field is missing.

## D. Evidence-linked UX design

### A — Ordinary conversation (first implementation)

Keep natural text, the current mode selector, response language and existing response actions. Do not add empty evidence containers or impose a report template on greetings, follow-ups, ideation or ordinary strategy advice.

```text
You: What should we prioritize next?
AI Brain: [concise recommendation, relevant caveats and next step]
[existing eligible response actions]
────────────────────────────────────────────────────────────
[existing composer, outside the scrolling transcript]
```

### B — Node-specific analysis (first implementation)

Maximum three findings, maximum two field references per finding. Show one compact finding initially; a native disclosure can reveal the other findings with the actual count. Never state that this bounded set is every issue in the Board. Within a finding, show the primary CTA/copy reference; an optional goal reference is collapsed initially. No confidence percentage, risk score, metric or generic graph.

Fictional wireframe only; labels in brackets are runtime-resolved values, not real customer records:

```text
You: Which of our current social posts have unclear CTAs, and why?
AI Brain: [short scoped answer; disclose limited evidence if relevant]

The next step is vague                         AI interpretation
[Why the quoted wording does not specify the desired next action.]
┌ [actual node title] · Social Media Posting ─────────────────┐
│ CTA · [exact bounded quotation]                            │
│ Source checked · [Saved field / Working context]           │
│ ▸ Relevant saved goal (when supplied and verified)         │
│ [Open in Canvas]                                          │
└───────────────────────────────────────────────────────────┘
▸ 2 more findings
[existing eligible response actions]
─────────────────────────────────────────────────────────────
[existing composer]
```

If insufficient: “I don't have enough supplied CTA copy to identify a specific post reliably. I can suggest what to look for.” Render interpretation as text, with no source-checked node finding or disabled placeholder card. A saved goal alone is not enough to establish unclear CTA copy. Missing goals do not block a supported copy observation; make the goal relationship conditional.

Use real title and canonical type in the reference; missing title displays the existing localized fallback, never a model-generated replacement. Duplicate titles retain distinct ID-bound buttons, with a small identity suffix where needed. Display friendly field labels mapped from allowlisted paths (for example `social.cta` → CTA); keep canonical type recognizable and accessible. Show `excerpted` as “Excerpt” outside the quotation. Do not append ellipses inside an exact quotation or claim the rest was reviewed for absence.

Reuse `.ai-brain-message`, `.ai-brain-node-preview` proportions and native `.ai-brain-learning-context` disclosure behavior without reusing their eligibility/action semantics. Use existing `--fk-color-surface-card/secondary`, `--fk-color-border-default`, `--fk-color-text-primary/secondary`, `--fk-color-focus-ring`, `--fk-space-*` and `--fk-radius-*` tokens. No new visual assets or color system. Keep restrained borders and spacing; status must be readable without color.

At 320/375px use a single column, wrapped titles/quotes (`overflow-wrap:anywhere`), full readable buttons and no horizontal transcript overflow. Preserve Light/Dark contrast, 200% zoom, reduced-motion behavior, fixed composer and `ai-brain-workspace-viewport` ownership. Ordinary rerenders preserve composer text/caret, transcript position, open disclosures and focused reference. New results reveal themselves only through existing follow-latest behavior; expansion must not jump to the bottom.

Use semantic sections/headings, native `details/summary` and real buttons. Each action's accessible name includes the node title; Enter/Space operate normally. Tab order follows reading order. Announce “Checking access…” and failures with a bounded status message. On successful opening, focus the existing node/Inspector through destination-owned behavior; on failure, retain the conversation, composer and focused button. Returning to Brain restores the same-context transcript/draft/scroll. Account/Board invalidation must clear protected references rather than restore stale content.

### C — Two-node comparison (future only)

```text
[comparison question and explicit criteria]
[Node A · type]              [Node B · type]
[same field / exact quote]   [same field / exact quote]
[field provenance]          [field provenance]
[Open in Canvas]            [Open in Canvas]
[conditional interpretation and missing evidence]
```

Use comparable fields, explicit distinct IDs and two columns only when space permits; stack in reading order on mobile. No ranking score, inferred winner or extra inference. This pattern is not required for BW-39.1.

### D — Campaign review (future only)

```text
[explicit reviewed scope and omissions]
CTA clarity (2 findings) ▾
  [compact finding + relevant node references]
Audience alignment (1 interpretation) ▸
[no unsupported all-Board or campaign-membership claim]
```

Reuse bounded findings with grouping only after campaign membership/scope rules are resolved. Board adjacency and Creator lane layout are not immutable campaign membership. No new dashboard, campaign traversal, analytics view or hundreds of cards.

## E. Secure node reference and navigation contract

### Server validation at Advice completion (proposed)

1. For citation-enabled node analysis, capture scope using the existing `_ai-brain-proposal-scope.capture({includeCanvas:true})` identity/Board/Workspace/association owner, even if the request has no goals. Require the browser's current saved revision. Preserve separate canonical Brand/Learning authorization. Ordinary non-citation conversation retains its current route behavior.
2. Resolve model-proposed node ID and allowlisted field against the validated **request-local** working projection/evidence index. Titles, types, quotes and provenance in public references come from server data, not model claims. Require the node ID and canonical type also to match a unique node in the authorized saved Board Canvas for MVP navigation. Duplicate/corrupt saved identities fail closed; do not fall back to title lookup.
3. MVP supports references to already persisted nodes whose cited fields may have current working edits. A newly inserted, never-saved node can remain working task context, but receives no navigable source-checked reference in BW-39.1. Do not save it automatically. This keeps server-verified node existence concrete; session-only node navigation is deferred.
4. Restrict initial cited fields to `goal`, `cta`, `social.cta`, `social.caption`, `social.preview`, `content` on actual `Social Media Posting` nodes. Require positive exact index excerpts for primary copy evidence; goal is supplementary. Use existing 180-code-unit prefixes and `excerpted`; do not search arbitrary hidden saved fields to rescue a model citation. A node outside the quotation index can be discussed as interpretation, but does not acquire a new MVP reference.
5. Compare cited working values with the authorized saved native field. A non-goal field is `saved` only on full-value equality after the same documented validator normalization, without accepting a truncated prefix as full equality. Otherwise mark `working`; do not invent precise unsaved provenance. Goal uses existing exact-value `goalSources`. Saved raw values never replace the working quotation or flow wholesale to the provider. A saved goal never marks the whole card saved.
6. Recheck the same captured actor/identity, Board access, Workspace, association, raw SQL revision and cited source values before provider dispatch and before releasing validated findings. Goal and Learning checks remain independent. Reuse captures where safe; do not compare a `capture(includeCanvas:true)` fingerprint with the existing default no-Canvas `revalidate` fingerprint: that shape differs. The goal helper already demonstrates recapture with identical options. No lock spans inference.
7. Enforce bounded arrays/strings and exact schema. Reject unknown/forged fields, IDs outside context, ID/type mismatches, mismatched phrases and unsupported absence/measurement claims as evidence. Remove an invalid finding rather than show it as verified. A valid quotation does not mechanically validate the model's interpretation: always label the rationale accordingly.
8. Return only allowlisted resolved title/type/field/excerpt/provenance, current Board ID and minimal opaque freshness metadata. No raw saved Canvas, ACL rows, owner emails, identity internals, hidden canonical Core, Learning provenance/source nodes, public tokens or full internal fingerprints. Do not create cross-Board or canonical-Brand navigation from model text.

Existing node IDs suffice. A server-assigned response-local `referenceId` can bind a UI button to a validated record; it is not a new durable evidence ID or an authorization capability. No additional inference is necessary.

### Explicit click preflight (proposed)

Add a narrow read-only evidence-reference resolver, using the existing scope owner rather than extending Content creation semantics. Input is bounded current Board ID, expected saved scope/revision, node ID/type and the selected resolved reference's allowlisted fields/freshness data. It is an authenticated check, not a destination URL interpreter. Client-provided checksums, node IDs and model strings never grant access.

The resolver independently recaptures active application identity, current Board **edit** access (preserving current Brain eligibility), accepted Workspace membership/status/revision and Board/Brand association, plus the current saved Canvas. It verifies exact saved node ID/type/existence and expected revision/scope. For saved fields it checks the attested source value; for working fields it authorizes the persisted node and saved baseline, while the browser must additionally compare the exact current working field snapshot. Return only an allow/changed result with minimal freshness data; never echo arbitrary saved node fields. Unauthorized requests disclose no hidden node existence. Unavailability is not “no evidence.”

Use a digest of a minimal, allowlisted authorized scope (including exact server revision) for freshness if needed; keep raw internal fingerprints private. It is a comparison aid, never a bearer credential. Signing/reference storage is unnecessary for this read-only check when every request reauthorizes and recomputes scope, and no caller can use it to retrieve additional fields. Do not repurpose Content `scope_revision` or continuation rebasing as citation authority.

Before the await, bind exact `state.user` object (not email alone), verified account identity where available, Board ID/load generation, expected saved revision, Workspace/catalog/association generations, request/turn/reference identity and exact projected working source. After the await and immediately before navigation, verify all still match, access remains eligible, no Board is loading and `getNode(id)` still has the cited canonical type and current source values. Replacing an account with the same email must fail. Changing selection during this click need not alone invalidate a citation, but a changed source/scope does; do not reuse the selection-sensitive Advice identity as the sole click guard.

Invoke normal `setActiveView("board")` / `focusNodeInCanvas` selection and Inspector ownership only after those checks. Respect any existing navigation/Inspector guard; if a modal/guard defers navigation, recheck when it resumes. Verify the destination is the intended Board view, node exists/rendered, selection and Inspector match. Guard scheduled animation-frame work against intervening account/load/node changes. Never select a similarly named node or create one to repair a missing reference. Preserve zoom/layout; use reduced-motion settings, and measure final Inspector/toolbar bounds when revealing the node.

Remote revocation between the final SQL check and actual UI navigation cannot be eliminated without a broader session architecture. Keep that window short, use existing invalidation hooks, and fail closed whenever a change is observed. The action reveals an already loaded authorized Board; it must not fetch protected node content via the reference.

| Failure | User-visible behavior | Forbidden recovery |
|---|---|---|
| Deleted/stale/type-changed node, remote revision or local source change | “This reference is no longer current. Ask again with the current Canvas.” No selection/Inspector mutation | Title matching, silently substituting a node, auto-retrying Advice |
| Access revoked or identity/Workspace/association changed | Generic unavailable state; existing protected-state invalidation applies | Using old reference metadata as permission, leaking existence/details |
| Resolver/database/network unavailable | “Could not check this reference. Try opening it again.” Preserve draft and location | Treating a failed check as authorization or triggering inference |
| Save in flight, acknowledged new revision, conflict/load replacement | Reference becomes stale under strict MVP policy | Rebasing across own saves, forcing save/load or adopting latest revision silently |
| Missing DOM / interrupted destination navigation | Remain/recover through normal navigation owner; show unable-to-open state | Direct DOM fabrication, second Inspector or arbitrary selector interpolation |

Choose strict revision freshness initially: even an unrelated save can invalidate a reference. This is conservative and may be inconvenient; optimize only in later reviewed scope. Changes after a successful response also invalidate its source-checked presentation/action, not merely its button. Do not leave a stale “Saved field” label looking current.

## F. Response format and provider implications

Recommended internal provider format is a small bounded JSON envelope in the **same** Advice call for an explicit node-analysis request. This is a proposed output contract change, not a new persisted schema or provider/model change. Ordinary conversation can retain text-only output. Use a deterministic explicit node-analysis entry/known request variant to select the contract; do not add an inference classifier or rely on model-chosen tool execution. The freeform acceptance question must be supported in that entry, without requiring a magic phrase.

```json
{
  "answer": "Natural conversational answer with uncertainty where needed.",
  "findings": [
    {
      "title": "Short interpretation title",
      "explanation": "Why the supplied wording may be unclear.",
      "evidence": [{"nodeId": "<supplied actual ID>", "field": "social.cta", "quote": "<exact supplied index quote>"}]
    }
  ]
}
```

Angle-bracket values are specification placeholders, never literals or fixture node findings to return to users. Max three findings; title ≤120, explanation ≤600, max two evidence entries, each quote ≤180. `answer` remains ≤12,000; total structured output must also fit a bounded parser and current output-token reservation. Node ID/field sizes use existing bounds. The first reference must support copy analysis; an optional goal reference can only explain relevant context. Do not allow a second reference to another Board, arbitrary URLs, actions, scores or performance objects. Empty findings is a successful truthful outcome.

The server validates the envelope before populating public fields. Public success preserves `answer`, existing `context` and `disclaimer`, adding optional `findings` with server-assigned IDs, `kind:"interpretation"`, `sourceCheck:"matched"`, resolved reference metadata, field provenance and minimal scope freshness. Include server-derived coverage for the supplied Social nodes and the subset eligible for indexed citations; counts come only from the authorized supplied projection, never hidden saved nodes. Disclose incomplete citable coverage without implying that all nodes were reviewed. The browser must explicitly validate/store these fields on the matching successful turn. It never renders provider-supplied HTML or turns inline text into links. An old plain-text success has no findings and keeps its existing renderer/actions.

Keep natural-language policies for `answer` and finding prose, while scoping the JSON-envelope instruction explicitly outside the current “no code blocks/tables/embeds” prose policy. Parse the complete assistant text once; do not blindly pass a JSON string through the current 12,000-character slicing helper and then parse truncated JSON. Check provider completion/refusal/incomplete output and bounds before parsing; validate types/keys/array counts and language on human prose, not serialized keys or quoted foreign-language evidence. No eval, Markdown JSON extraction heuristics, salvage of partial objects or repair call.

For a valid envelope with individual bad references, omit those findings and disclose insufficient validated evidence; the natural text remains AI interpretation, never retroactively “verified.” Malformed/incomplete envelopes fail with a bounded response-invalid error and explicit current-context retry. Never display raw JSON or retain unvalidated cards. A no-evidence answer is different from a parser/service failure. Quoted source text can be another language without failing the existing response-language intent.

Existing `turn.answer` must remain exactly the envelope's natural answer, not a concatenation of cards. History, Content/Social extraction, campaign briefing and Brand proposal eligibility continue to consume that exact answer through their existing owners. Server-generated reference labels are localized separately. Supplied Learning transparency remains “supplied,” never relabeled “used” based on a node citation.

Calls: ordinary Advice remains one call (or zero on current clarification/validation paths). Evidence capture/validation, expansion, click preflight and Canvas opening add **zero** inference. No model switch, classifier, citation-repair pass, summary generation or automatic Advice retry. `store:false` stays explicit. Prompt/envelope overhead increases input/output use within existing limits; measure complete serialized input including contract instructions and count any provider format/schema framing if introduced. Retain 4,096 output tokens and 1,024 framing reservation; do not silently increase budgets or prune nodes. Prefer the already bounded index over repeating raw copy. Server reads increase for evidence-enabled requests and explicit click preflight; document latency without inventing milliseconds or cost savings.

## G. BW-39.1 MVP implementation boundaries

One workflow only: an explicit current-Board social-post analysis asks “Which of our current social posts have unclear CTAs, and why?” It returns up to three concise interpretations with source-checked positive copy references, optionally a relevant verified native goal, and opens one persisted Social Media Posting node through normal Canvas selection/Inspector. Missing/uncitable evidence yields a qualified text answer. No automatic edits or writes.

| Owner | Minimal expected change | Must remain with existing owner |
|---|---|---|
| Advice API / evidence helper | Node-analysis request variant; bounded proposed-finding parser; resolve existing IDs/index excerpts; narrow cited-field saved comparison and scope recapture | Board/Workspace identity/ACL in existing scope helper; canonical Brand/Learnings independently authorized; no generic retrieval framework |
| Read-only resolver | Fresh authorization, scope/revision/existence check for explicit click | No Content proposal preparation/creation, continuation rebase, save or provider |
| Brain browser turn/transcript | Validate and retain optional resolved findings; compact cards/disclosures; localized statuses; bind full account/load/source scope | Exact answer, modes, composer, history, draft/caret/scroll and eligible response actions remain Brain-owned |
| Canvas / Inspector | Guarded invocation of existing navigation/selection/reveal seams | Nodes, selection, Inspector lifecycle, zoom/layout and editing stay Canvas-owned; no parallel selection state |
| Design tokens / tests | Small token-based styles and focused regression fixtures | No visual assets, dashboard, charting dependency, global theme rewrite or analytics tracking |

Likely files: `api/ai-brain/advice.js`, `api/_ai-brain-evidence.js`, a small response-validation module if needed, a narrow evidence resolver route, `app.js`, `styles.css`, focused regression script(s), `package.json`/existing CI registration and implementation notes. Reuse `_ai-brain-proposal-scope` and goal-context owners without broad ACL changes. The exact split is an implementation detail; field validation, fresh authorization and destination ownership are mandatory. This audit changes none of them.

Explicit exclusions: C/D comparison and grouped review, other node-type evidence UX, references to never-saved nodes, cross-Board navigation, canonical Brand citations, historical/durable citations, transcript persistence, campaign-scope selection/traversal, >200-node capacity changes, absence quantification, scores, metrics, measured performance, charts, generic visualization/action framework, automatic edits, node creation, approval/scheduling/publishing, new database schema/migrations, production data testing, deployment or merging. Existing explicit Content/Social/Campaign/Profile actions stay available under their current independent contracts.

## H. Acceptance and regression matrix

### Implementation acceptance (required for BW-39.1; not claimed delivered)

| Case | Expected observable result | Coverage owner |
|---|---|---|
| Real saved Social node with ambiguous positive CTA copy and relevant saved native goal | Exact real ID/type/title, bounded copy and goal, separate field statuses; rationale is interpretation | Production projection → authorized disposable SQL → mocked Responses → parser → real shell |
| Open the reference | One explicit click, fresh SQL scope check, exact selected ID and normal Inspector; no edits, save or inference | Real Canvas/navigation/Inspector integration, not helper-only stubs |
| Repeated titles / legacy Social type alias | Correct distinct ID and canonical type; never first-title match | API + browser |
| Caption has a clear action although explicit CTA field is empty; preview has no action | No mechanically verified “missing CTA” finding; include counterevidence or qualify interpretation | Provider-input assertions plus adversarial candidate-output fixtures |
| Only saved goal / missing goal / missing copy / outside index / empty Canvas | No fabricated CTA observation; absent goal remains unknown; empty findings allowed | API + renderer |
| Edited working copy with unchanged saved goal | Copy says working context, goal alone says saved; no whole-node saved badge | SQL + actual client |
| Browser truncation/normalization, quote after first 180 chars, excerpt omissions | Exact prefix rules; no false full-value saved equality or absence assertion; no quote salvage | Boundary fixtures including Unicode/EN/DE |
| Forged ID/type/field/quote/status/title/URL, hidden Board or canonical data | Invalid finding removed/rejected; server-derived metadata only; inert text; no navigation or data leak | Actual auth helpers + parser + hostile DOM fixtures |
| New never-saved or deleted node | No MVP navigable reference; no implicit save or replacement node | SQL + local lifecycle |
| No-goal evidence analysis | Same explicit citation identity/Workspace/association capture and freshness, without requiring a goal | API security regression |
| Active identity replacement (same email), membership/revision/association or ACL revocation during any await | Suppress output/opening and invalidate protected state | SQL and delayed/reordered browser transport |
| Local source edit, remote save, raw microsecond revision change, own autosave acknowledgement, conflict/reload | Strict stale behavior; never silently rebase | Native save/load/dirty owners + disposable SQL |
| Navigation blocked by Inspector/modal, node removed before animation frame, unavailable DOM | Destination guards respected; no wrong node/Inspector or extra owner | Real shell integration |
| Malformed/incomplete/refusal/oversized/unknown-key envelope and mixed-language quotes | Bounded failure or reference omission as specified; no raw JSON, repair or hidden retry | Responses transport/parser/language fixtures |
| Ordinary conversation and legacy text response | Natural text, no empty cards; exact answer/history and modes remain | BW-26/37 conversation suites |
| Create Campaign / Add to Canvas / Suggest Brand Update; sequential assets | Original eligibility, exact source spans, preview/confirm and destination writes unchanged | BW-37 handoff + BW-38.1 suites |
| Mobile 320/375, desktop, Light/Dark, 200% zoom, keyboard/reduced motion | Readable bounded cards; working disclosure/button/status focus; no horizontal overflow or composer overlap | Actual shell browser checks |
| Long conversation / expand / open / return | Draft/caret/mode/disclosure/scroll preserved within same identity; invalidation clears protected state | Workspace/viewport browser tests |
| Budget/call count | One Advice call; zero on invalid/clarification, reference click or expansion; unchanged model/store/output reservation; bounded 422 | Token-count and provider transport assertions |

For semantic acceptance, use an authorized fixture or supplied real capture and review exact sentences: does quoted copy support the observation, does counterevidence change it, is goal attribution exact, and is the recommendation useful? Mocked outputs cannot establish live model compliance. Human review must not average away fabricated IDs/quotes, unsupported counts or performance claims. No paid/live-model evaluation is authorized by this audit.

### Verification performed for BW-39.0 (T)

No tests were added or modified for this documentation-only change. Existing provider-free checks were run to corroborate current architecture:

- `npm run check:bw38.2a`: passed; exact goals, saved/unsaved values, SQL ACL/Workspace/association isolation, same-millisecond microsecond freshness, provider budget/count and production client projection/lifecycle.
- `npm run check:bw37.1b`: passed; exact bounded evidence, CTA/trust counterevidence, IDs/repeated titles, safe formatting, modes, token bounds and stale client responses.
- `npm run check:bw37.1br1`: passed, including real-shell composer/caret/navigation, stale lifecycle, explicit preview/create and mobile/desktop Light/Dark. Initial Chromium launch inside the sandbox failed with `setsockopt: Operation not permitted`; the complete suite passed under the supported elevated execution path. The initial attempt is not counted as a pass.
- Existing BW-26 read-only, real-Canvas/turn lifecycle, safe formatting, conversation memory, reference resolution and language scripts: passed (`check-bw26-read-only-ai-brain.js`, `check-bw26-1-real-canvas-context-and-turn-lifecycle.js`, `check-bw26-2-safe-brain-response-formatting.js`, `check-bw26-3-bounded-conversation-memory.js`, `check-bw26-4-reference-resolution.js`, `check-bw26-5-response-language-adherence.js`).
- `check-bw28-ai-insights-architecture.js`: passed (86 contracts). `check-bw36-20r0-ai-brain-board-authorization.js`: passed (17 ACL cases, 11 invalid projections). `check-browser-script-integrity.js`: passed (48 classic scripts).
- `npm run check:bw38.1`, `check:bw37.1c2b`, `check:bw37.1c1`, `check:bw37.1c3a`, `check:bw37.1c3b` and `check:bw37.1c3c1`: passed under the supported elevated browser execution path. These exercise sequential Content/Social save/load and source isolation, signed scope/races, Campaign briefing/generation boundaries, protected Profile staging/Save, Content eligibility/preview/Create, and Social native Inspector/undo/persistence with mocked provider transports. Fixture writes are disposable, not production writes.

Other Workspace/knowledge/lifecycle suites remain required implementation regressions; historical implementation pass records are not reruns for this audit. The repository's Runtime Boot Safety workflow runs PostgreSQL 17.6/18.4; full matrix success is not implied by local disposable SQL/browser passes. No production DB, live provider or new UX implementation was exercised.

## I. Risks, limitations and deferred features

- **Semantic overclaim:** matching a real quotation cannot prove that the interpretation is correct or that the model actually relied on it. “Source checked” describes data validation only; do not use a green “verified recommendation” badge.
- **Partial context:** the 24-node index and preexisting projection truncation limit citable evidence; 200-node request limits can exclude legitimate larger workflows. Disclose limits; do not infer universal absence or raise capacity in this package.
- **Persistence ambiguity:** saved means field equality at a revision, not human acceptance, canonical authority or measured success. For non-goal mismatches, working-context wording avoids false certainty about unsaved vs truncated data.
- **Freshness friction:** strict revision checks invalidate references on autosave or unrelated changes. This is the initial policy; seamless continuation across saves is deferred, not a reason to weaken freshness checks.
- **Race boundaries:** no continuous authorization guarantee, no retraction after dispatch, and existing save owners have their own limitations. Do not claim an atomic end-to-end snapshot across model inference and browser navigation.
- **Compatibility:** response parsing can break history/handoff extraction if cards enter `turn.answer`; maintain exact natural answer and test every existing destination. The current string cap is unsafe for naïvely clipped JSON.
- **Privacy:** citations must not expand current context access or create hidden-node/canonical-Brand existence or content oracles. Browser/source hashes are not permission. Avoid logging source text or sensitive reference payloads.
- **Latency and provider quality:** extra SQL checks have unmeasured latency; structured output could still be invalid. One bounded request and explicit retry preserve predictable calls; no repair inference or fabricated evidence fallback.

Remaining questions for implementation review: whether the node-analysis entry is a compact explicit control or a request variant within the existing mode UI; the exact localized “Source checked / Working context” wording; whether users find strict invalidation on autosave too disruptive; and real-provider adherence to bounded citation proposals. None requires an additional visualization system. Resolve entry discoverability and record the contract before implementation; do not add a paid classifier. Never-saved-node references, alternate quote spans, other node types and field-level freshness optimization require later scope.

## J. Complete directly copyable BW-39.1 implementation prompt

```text
TENDRA ONE — BW-39.1: Evidence-linked Social CTA analysis
Repository: Funklix/Funklix. Base: latest merged main including PR #837 and
the approved BW-39.0 audit. Read AGENTS.md and work on a dedicated branch.
Implement only the bounded A/B experience in
docs/audits/bw39-ai-brain-evidence-visual-experience.md.
Commit/push and open exactly one normal non-draft PR against main; verify
draft:false. Never merge or deploy. If delivery is technically impossible,
report BLOCKED with the exact limitation and completed work.

READ FIRST
docs/constitution/product-architecture.md;
docs/product/product-intelligence-architecture.md;
docs/audits/bw38-end-to-end-product-ux-review.md;
docs/implementations/bw38-2a-ai-brain-marketing-goals.md;
current BW-37 advisor, evidence and Content/Social/Campaign/Profile records;
api/_ai-brain-evidence.js, _ai-brain-canvas-context.js,
_ai-brain-goal-context.js, _ai-brain-learning-context.js,
_ai-brain-proposal-scope.js, ai-brain/advice.js, ai-brain/content-scope.js;
app.js projection, Advice/turn/render/history/invalidation functions,
account/Board/load/Workspace/association owners, native Canvas focus/selection,
Inspector/adaptive details, dirty/save/load/conflict and existing handoffs;
semantic theme tokens, ai-brain-workspace-viewport and applicable tests.
Current source overrides historical audit statements. Do not implement C/D.

PRODUCT OUTCOME
The user asks: "Which of our current social posts have unclear CTAs, and why?"
An explicit current-Board node-analysis entry supports this freeform question.
Brain identifies a supported actual persisted Social Media Posting node,
shows exact positive CTA/copy evidence and a relevant native goal if available,
explains the strategic interpretation, and offers Open in Canvas.
The action opens that exact node through existing selection/Inspector owners.
Insufficient evidence yields qualified text with no invented finding.
Ordinary conversation stays natural text. No automatic edits or writes.

SERVER
1. Extend the existing Advice call/index; use actual node IDs, canonical types
   and request-local field excerpts. No new evidence retrieval/inference system.
   Select the node-analysis contract deterministically via an explicit entry/
   request variant, without a model classifier. Preserve ordinary Advice paths.
2. For citation-enabled requests, require current saved revision and capture
   active identity, Board edit ACL, Workspace membership/status/revision and
   Board/Brand association through the existing scope owner with saved Canvas,
   even without goals. Keep independent canonical Brand/Learning authorization.
   Reuse safe captures. Revalidate identical capture shapes before dispatch and
   release; preserve exact raw SQL timestamp precision, including microseconds.
3. Use a bounded same-call envelope: answer plus max 3 findings; title <=120,
   explanation <=600, max 2 evidence entries/finding with nodeId/field/quote.
   Quote <=180. Preserve current answer bound and complete output-token bound.
   First evidence is positive copy; goal can supplement it. Empty findings is OK.
   Parse complete assistant output before string clipping; handle refusal,
   incomplete/malformed/oversized/unknown-key data safely. No repair call,
   automatic retry, eval, raw JSON display or partial-object salvage.
4. Resolve each candidate against the validated supplied index and authorized
   saved Canvas ID/type. Only existing persisted Social Media Posting identities
   are MVP navigable. Allow cited goal/cta/social.cta/social.caption/
   social.preview/content. Reject forged/out-of-scope IDs, mismatched quotes,
   unsupported fields or hidden data. Server supplies title/type/quote/status;
   model strings do not authorize anything. Use exact index prefix/excerpt rules.
5. Preserve goalSources exact saved/unsaved goal provenance. For other cited
   fields, saved requires full equality under documented normalization, never
   prefix equality against longer saved data. Otherwise label Working context,
   which may include unsaved edits. Do not claim precise unsaved state where
   projection truncation can explain differences. Never mark a whole node saved
   because its goal matches. Missing goals remain unknown; no inferred objectives.
6. Keep finding rationale an AI interpretation. Source checked means a matched
   source, not proven strategic correctness or proven model use. Do not verify
   absence/count/performance claims from aggregate warnings or missing fields.
   Inspect CTA counterevidence; audience/tone variation is not itself a defect.
   Invalid references cannot survive as verified findings. No evidence and
   service/parse failure are distinct states.
7. Preserve public answer/context/disclaimer, adding optional bounded resolved
   findings, server-derived supplied/indexed Social coverage and minimal freshness
   metadata. Disclose partial citable coverage. Keep internals/ACL/raw saved Canvas,
   hidden Brand data and Learning source nodes private. Request-local reference
   IDs/checksums are not credentials or durable citations.

BROWSER AND OPENING
8. Validate/store optional findings only on the matching successful turn. Keep
   exact natural answer in turn.answer for history and existing handoff parsers;
   do not append cards/metadata to source text. Legacy text replies still work.
9. Render max 3 compact findings, initially one, with native disclosures for
   additional findings/optional goal. Show real title/canonical type, friendly
   field label, exact bounded quotation, excerpt disclosure, field provenance,
   AI interpretation label and explicit Open in Canvas. No empty cards,
   confidence percentages, scores, decorative charts or large dashboard.
10. Add a narrow authenticated read-only click resolver using existing scope
   authorization; do not repurpose Content creation/continuation authority.
   Recheck actor/identity, Board edit ACL, Workspace/association/revision, saved
   node ID/type/existence and cited saved baseline, returning only bounded status/
   minimal freshness. No reference-based content retrieval or new write path.
11. Bind exact account object, Board/load, Workspace/catalog/association
   generations, saved scope, turn/reference and exact current working source.
   Recheck after every await, before navigating, after deferred guards and before
   scheduled focus. Same-email account replacement, scope/source changes or
   deletion must fail safely. Verify working fields locally; server authorizes
   saved identity/baseline. No title lookup, ID substitution or implicit save.
12. Use normal setActiveView/focusNodeInCanvas selection, fillInspector and
   existing guarded navigation owners; handle false/unrendered/deferred outcomes.
   Preserve zoom/layout and Inspector lifecycle; reveal within final viewport
   bounds. Click never creates nodes, edits, saves, calls a provider or invokes
   existing creation helpers. Stale/deleted/revoked/unavailable references give
   clear localized feedback and preserve draft/location where authorized.
13. Strict revision policy initially: any save/source/scope change invalidates
   reference/action/status; do not silently rebase across own autosave/conflicts.
   Account/Board invalidation clears protected references. Do not claim continuous
   authorization or retraction of provider data already dispatched.
14. Preserve fixed composer/scroll owner, draft/caret/mode/disclosure/focus and
   same-context return. Use existing semantic tokens, inert DOM text, native
   buttons/details/status; support EN/DE, Light/Dark, 320/375/desktop, 200% zoom,
   keyboard and reduced motion without horizontal overflow or composer overlap.
15. Keep Create Campaign, Add to Canvas (Content/Social), sequential asset
   continuation and Suggest Brand Update independently eligible/destination-owned.
   Evidence cards must not contaminate exact source selection or imply writes.

CALLS AND BUDGET
Same model, explicit store:false, existing 4096 output/1024 framing reservation
and complete-message token accounting. Include envelope instructions/any format
framing in the budget; retain bounded 422 behavior and current node/edge/byte
limits. No silent pruning or budget increase. One Advice call, zero extra calls
for citation validation, expansion, click, opening, errors or fallback.
Existing explicit Content/Campaign inference stays separately owned/disclosed.

ACCEPTANCE AND TESTS
Use fictional data, disposable SQL and mocked Responses with real production
projection/API/scope helpers and real shell Canvas/Inspector. Demonstrate exact
ID opening for a real saved Social node with CTA copy and saved goal; repeated
titles; alias canonicalization; working-copy/saved-goal split; missing copy/goal;
counterevidence; index omissions/truncation/Unicode; forged IDs/fields/quotes;
never-saved/deleted nodes; no-goal authorization; same-email identity replacement;
revocation/Workspace/association/source changes during awaits; microsecond remote
revisions, autosave/conflict/reload; blocked/deferred/animation-frame navigation;
invalid/incomplete/refusal output; current-context retry; language; exact call
counts/budget. No canned canEdit:true as authorization proof.
Run applicable BW-26/28, BW-36 Board/knowledge/lifecycle, BW-37 advisor/workspace/
Content/Social/Campaign/Profile, BW-38.1 and BW-38.2A regressions plus browser
script integrity and required repository CI. Register focused new coverage in
the existing PostgreSQL 17.6/18.4 workflow. Real-shell checks must verify normal
Inspector/selection, no write/inference on open, preserved composer/return,
mobile/themes/keyboard and unchanged exact handoff source spans. Report actual
passes and blocked/skipped cases; mocks do not prove live semantic quality.

EXCLUSIONS
No C/D comparison/grouped review, other-type citation UI, never-saved-node or
cross-Board navigation, canonical Brand citations, durable references/transcripts,
campaign traversal/scope/capacity redesign, quantified absence or performance,
scores/charts/assets, generic action framework, automatic writes, new schema/
migrations, production data tests, paid model evaluation, merge or deployment.

REPORT
Real non-draft PR URL; exact audited base/head; changed files; before/after
workflow; field provenance and reference validation; exact authorization and
freshness boundaries; normal Canvas/Inspector path; call/token consequences;
actual test/CI results and limitations/unresolved product questions.
```

BW-39.0 AI BRAIN EVIDENCE UX FOUNDATION READY FOR REVIEW
