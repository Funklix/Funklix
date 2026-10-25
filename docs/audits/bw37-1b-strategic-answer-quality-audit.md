# BW-37.1B — Strategic Answer Quality & Context Intelligence Audit

- **Repository:** `Funklix/Funklix`.
- **Audit date:** 2026-10-25 (Europe/Berlin).
- **Exact audited main:** `20f162a771ae4820b4ab4e43b588af7951f9799f`, including merged PR #817.
- **Status:** Audit and documentation only; the implementation package below is proposed for review.
- **Prior authority:** [Approved BW-37 audit](./bw37-ai-brain-2-strategic-advisor-audit.md). Its older source line numbers and pre-BW-37.1A behavior are historical. Modes and the workspace/scroll corrections are now implemented.

## A. Executive findings

The existing Advice path already has the important authorization, governance and cost boundaries. Its main quality opportunity is to make available evidence easier to interpret and attribute, then ask for a concrete decision justified by that evidence. A new provider, retrieval platform or agent workflow is unnecessary.

1. **Brand detail often reaches Advice intact, but without a task-specific interpretation layer.** Advice serializes the independently authorized canonical `brand_core` and persisted Board snapshot directly into JSON. It does **not** call `buildBrandBrainContext()` or receive that helper's archetype guidance. Applying that helper's 900-character/list limits to Advice would be a mistaken diagnosis. Raw Core can include rich Personas, DNA, Founder Story/custom-module content and drafts, but availability depends on what was actually persisted and authorized. [S1–S4, S7]
2. **Exact Canvas evidence is available for a bounded subset of fields.** Node IDs, titles, text, audience, tone, supported CTA fields and edges reach the model. The selected node is included again as an object. No selected-node neighborhood or evidence index is derived. `goal`, schedules, image briefs/prompts, comments, variants and other native fields are omitted. Browser truncation can silently remove the relevant end of a field. [S1, S5, S8]
3. **Diagnostic labels are weaker than their apparent strategic meaning.** `multiple_audiences` means more than one distinct, case-sensitive audience string; `tone_variation` requires more than two distinct tone strings. Neither proves inconsistent messaging. Advice findings carry code/severity/message, without affected IDs, exact values or per-finding applicability. The full Canvas permits a model to reconstruct some attribution, but the prompt does not require it. [S6]
4. **CTA and trust heuristics have demonstrable applicability gaps.** Advice ignores top-level `cta` and `social.cta`, treats `social.preview` as CTA presence and reports missing Landing Page trust even when no Landing Page exists. `goal === 'Conversion'` is checked by diagnostics but cannot survive Advice's validator. These are structural heuristic limitations, not performance evidence. [S5–S6]
5. **Good strategic guidance already exists.** BW-37.1A supplies five distinct modes, uncertainty rules, Brand/snapshot precedence and ordered conversational reference resolution. More generic exhortations alone are unlikely to resolve missing attribution. Add concise evidence and decision guidance to this existing policy. No response must use an obligatory multi-section template. [S1, S9]
6. **Formatting has specific, limited defects.** Safe DOM creation should stay. Every ordered-list block currently renders from 1; explicit source numbering is discarded. Actual CR/LF is normalized, while literal backslash-n remains visible. Excess headings and generic conclusions are primarily generation issues. PR #817 already widened the workspace and improved paragraph spacing and transcript continuity. [S10–S11]

**Recommendation:** a small Advice-only evidence preparation layer over the existing validated data; clearer mode-specific evidence-to-recommendation instructions; a complete client freshness fingerprint for the supplied projection; and ordered-list numbering preservation in the existing safe renderer. Keep Learning retrieval and shared Insights diagnostic rules unchanged for this MVP. Evaluate semantic quality separately from deterministic contracts.

## B. Verified current-state inventory

### Evidence register

All line references in this audit refer to the exact main commit above. Relative links resolve repository files; the baseline makes the line references reproducible.

| Ref | Repository evidence and inspected anchors |
|---|---|
| S1 | [Advice route](../../api/ai-brain/advice.js), lines 10–18 body/output bounds; 46–73 policies and message construction; 76–144 authorization/validation/context; 145–220 capture, inference, revalidation and response/error handling. |
| S2 | [Learning context](../../api/_ai-brain-learning-context.js), lines 11–27 ownership/fingerprint; 30–117 transactional scope/capture/revalidation; 120–150 ranking; 154–197 full-message budget and transparency. |
| S3 | [Brand access](../../api/_brand-access.js), lines 25–56 independent capabilities/membership; [Learning authorization](../../api/_brand-learnings.js), lines 123–143 active identity and independent Brand ACL; [Board access](../../api/_board-access.js), `getBoardAccess` and capability resolution. |
| S4 | [Brand context helper](../../api/_brand-brain-context.js), lines 3–38 text/persona limits; 47–86 accepted-module projection; 89–153 normalized Core; 176–229 archetype guidance; 248–306 formatter/exports. This helper is not imported by Advice. |
| S5 | [Advice Canvas validator](../../api/_ai-brain-canvas-context.js), lines 2–47 bounds, field allowlists, normalization, edge/selection validation. |
| S6 | [Advice diagnostics](../../api/_ai-brain-diagnostics.js), lines 5–37 stage/audience/tone/CTA/trust derivation and finding construction. |
| S7 | [Brand Profile setup](../../brand-profile-setup.js), `FIELDS`, `readiness`, `filteredSuggestions`; [Brand write contract](../../brand-write-contract.js), `CONTRACT`, `diff`, `command`, `apply`; [Brand state](../../app.js), lines 10115–10158 normalization/snapshot and 20388–20390 defaults; [Founder Story preflight](../../brand-dna-generation-preflight.js), lines 40–56 accepted-context serialization. |
| S8 | [Browser Canvas preparation](../../app.js), lines 6385–6405 identity/projection; `createNode` at 11452–11503 native fields; Advice submission at 6687–6716. |
| S9 | [Conversation validator](../../api/_ai-brain-conversation.js), lines 3–35 limits/reference detector; [browser history](../../app.js), lines 6407–6423 history/reset; [Advice modes/policy](../../api/ai-brain/advice.js), lines 48–73. |
| S10 | [Safe renderer](../../app.js), lines 6475–6516 inline/line/block parsing, 6531–6587 transcript; [workspace lifecycle](../../app.js), lines 6588–6686 scroll/render; [dedicated CSS](../../ai-brain-learning-context.css), lines 22–96; [historical shared CSS](../../styles.css), lines 3835–3845 and 7656–7659. |
| S11 | [PR #817 implementation notes](../implementations/bw37-1a-r1-ai-brain-workspace.md); [viewport helper](../../ai-brain-workspace-viewport.js), lines 1–25. |
| S12 | [Insights runtime](../../app.js), `analyzeCampaign` at 6170–6207, `calculateInsightsDiagnostic` at 6335–6346, `buildInsightsFindings` at 6986–7003, snapshot identity at 6799–6814/7004–7008, `askAiBrainAboutFinding` at 7018–7030 and `renderInsightsSurface` at 7032 onward. |
| S13 | [Product architecture](../constitution/product-architecture.md), Campaign Canvas/Brand/AI Brain sections; [intelligence architecture](../product/product-intelligence-architecture.md), AI Brain, Insights, Knowledge and human approval boundaries. |
| S14 | [BW-26](../../scripts/check-bw26-read-only-ai-brain.js), [Canvas lifecycle](../../scripts/check-bw26-1-real-canvas-context-and-turn-lifecycle.js), [safe formatting](../../scripts/check-bw26-2-safe-brain-response-formatting.js), [bounded history](../../scripts/check-bw26-3-bounded-conversation-memory.js), [references](../../scripts/check-bw26-4-reference-resolution.js), [language](../../scripts/check-bw26-5-response-language-adherence.js), [explicit Content node](../../scripts/check-bw26-6-controlled-ai-brain-node-creation.js). |
| S15 | [BW-28 architecture](../../scripts/check-bw28-ai-insights-architecture.js), [Insights handoff](../../scripts/check-bw28-1-insights-ux-and-brain-handoff.js); [BW-36.20 integration](../../scripts/check-bw36-20-approved-learning-ai-brain.js), [revalidation fixes](../../scripts/check-bw36-20r1-learning-integration-review-fixes.js), [disposable database fixture](../../scripts/fixtures/bw36-20-database.js), [Brand/Board separation](../../scripts/check-bw36-21a-r2-3-brand-board-context.js). |
| S16 | [BW-37.1A modes](../../scripts/check-bw37-1a-strategic-advisor.js), [BW-37.1A-R1 workspace](../../scripts/check-bw37-1a-r1-workspace.js), [npm registrations](../../package.json), [Runtime Boot Safety](../../.github/workflows/runtime-boot-safety.yml). |

### Actual request and authorization flow

The browser captures account/Board/load generation, current edit capability, selection, UI language, mode and projected live Canvas. It sends successful conversation pairs and the untouched question to the existing Advice endpoint. Unsaved Canvas changes are intentionally usable. The request does not contain a selected Brand ID or a replacement Brand Core. [S8–S9]

The server checks body shape/size, signed session, persisted Board, explicitly present ownership columns and Board edit capability. It validates Canvas IDs/types/fields/edges and selected-node membership. It independently looks up canonical Brand access using **persisted `Board.brand_id`**. A Board editor without that access can receive Board-only advice. A sidebar-selected Brand Y cannot supply knowledge for Board A/Brand X. Workspace membership is not a substitute for these grants. [S1–S3]

Ordinary inference then captures Board, canonical Core and active application identity in a bounded repeatable-read transaction. Approved Learnings are scanned for that Board-associated Brand only. The model receives freshly captured Core/snapshot values, validated client Canvas and server diagnostics. Complete messages are token-counted; selected Learnings and scope are revalidated before dispatch and again after output. No database locks are held during inference. `store:false`, the configured model, one Responses API request and no automatic retry remain established behavior. [S1–S2]

There is an earlier clarification path: a recognized conversational reference with absent history or the truncation flag returns a deterministic EN/DE question, with zero inference and without enumerating Learnings. It is not the ordinary capture/revalidation path and must not become a side channel for Brand knowledge. [S1, S9]

### What controls the answer

Message order is: trusted system advisor/precedence/strategy/mode policy; system JSON context; optional user-role approved-Learning envelope; alternating historical user/assistant pairs; final system instruction for this turn's EN/DE language; current user question. Learnings and history are untrusted for instructions. History is primary for resolving “the second idea,” while current authorized facts override stale historical claims. [S1]

Mode guidance is already distinct: General follows the question; Review Strategy assesses coherence and the most useful adjustment; Explore Ideas offers meaningfully different directions; Find Gaps checks applicability and separates absence from hypothesis; Evaluate Options uses goals/constraints and included historical alternatives before asking for clarification. [S1]

The policy asks for short Markdown headings, paragraphs, lists and bold labels, forbids HTML/links/images/tables/embeds/code blocks and asks for concision. It does not cap headings, require node IDs/field quotations or explicitly compare the top recommendation against a runner-up. Output reserves 4,096 tokens and is subsequently trimmed to 12,000 characters; the latter can cut a sentence or list. The EN/DE mismatch detector is lexical and permits short/ambiguous answers; it is not a semantic quality check. [S1–S2]

## C. Appics case analysis

**Evidence limitation:** The supplied Appics findings are observations from the request, not repository fixtures or captured model payloads. No Appics Brand/Board record, exact Canvas, full transcript, selected-node state, runtime model configuration or Learning library was supplied. This audit verifies mechanisms that can explain those outcomes; it cannot establish which mechanism caused a particular live answer. Example directions below are hypothetical proposals based only on the reported themes.

### Case A — Review Strategy

Recognizing empowerment, individuality, Explorer/Creator, decentralization and creator monetization indicates that some relevant context was available to that answer; it does not establish exhaustive reading, canonical origin or approved-Learning use. Current Advice can receive all those details as raw Core/snapshot fields. It does not get the helper's explicit archetype interpretation and priority order. [S1, S4]

Broad “align audience and tone” advice is compatible with prominent aggregate diagnostic warnings plus a general coherence policy. IDs, titles, `audience`, `tone`, `content`, `social.caption` and supported Landing Page copy could support exact comparisons **if populated and retained**. No code forces a recommendation to quote those fields, use edges or justify why this adjustment matters more than an unrelated tone variation. A campaign's native `goal` cannot supply prioritization because it is omitted. [S1, S5–S6, S8]

The desired answer would identify an existing node by title and ID, name its relevant field and short exact phrase, compare that phrase with a specific authorized positioning/persona/message, and recommend one edit with a reason it has the highest strategic value. It should name a connected node only if an actual submitted edge supports that relationship. Without the Appics payload, do not invent the node, wording, objective or edge. If the audience distinction is intentional segmentation, preserving it may be the right decision.

### Case B — Find Gaps

| Claim | What the implementation actually supports | Valid attribution and limit |
|---|---|---|
| “Audience messaging is inconsistent” | More than one nonempty, trimmed, **case-sensitive** `audience` string produces `multiple_audiences`. Synonyms, capitalization and intentional segments trigger the same condition. | Confirm differing field values by node ID/title and exact strings from supplied nodes. Strategic conflict requires comparing meanings, intended segments and Brand/campaign constraints. The code alone does not verify inconsistency. |
| “Multiple tone labels” | `tone_variation` triggers only above two distinct trimmed labels. Two labels alone do not trigger this warning. | Reconstruct actual labels and nodes from working Canvas; explain potential purpose before recommending alignment. Tone labels are not a measured analysis of the prose. |
| “No CTA” | Advice checks `landingPage.cta` or `social.preview`; one detected value suppresses the aggregate warning. It ignores `social.cta` and top-level `cta`. | Inspect all supplied CTA fields. State what was detected, not that all assets lack a CTA. A preview can be ordinary caption text. Aggregate presence also hides individual nodes with missing next steps. |
| “Missing trust” | No Landing Page with nonempty `trust` causes `missing_landing_trust`, including a Canvas with no Landing Pages. | Distinguish “no Landing Page exists” from “Landing Page N has no trust field.” Proof may be in content; missing a field is not proof the Brand lacks credibility. Never fabricate proof to fill it. |
| “Funnel gaps” | Fixed five-stage mapping infers Awareness from Idea/Social, Interest from Content, Conversion from Landing Page or LP CTA; explicit `funnelStage` also contributes. | State the mapping and current coverage. Missing Retention/Conversion is not automatically a defect in a scoped awareness campaign. No conversion rate or funnel performance is measured. |

Advice diagnostics are not the Insights findings feed. Insights `buildInsightsFindings()` derives affected IDs, current values, missing elements and deterministic ordering, while Advice recomputes its own small aggregate schema. Insights per-node CTA eligibility also differs and recognizes `social.cta`. Its readiness/consistency scores are heuristics, not customer-response metrics, and are not passed as Advice diagnostics. The explicit Insights handoff inserts bounded, localized evidence into an editable **question draft**; it does not send a trusted diagnostic object or submit automatically. The model must recheck it against current validated Canvas. [S6, S12, S15]

Use four epistemic distinctions in the answer where relevant, without four mandatory headings:

- **Confirmed structural observation:** exact field values or a qualified server rule result.
- **Strategic interpretation:** why that observation might help or hurt a stated objective.
- **Assumption/hypothesis:** e.g. that two descriptions are intended for one audience; invite confirmation if material.
- **Unknown evidence:** missing objective, unavailable analytics, omitted fields or unprovided customer proof.

### Case C — Explore Ideas

“Discover Your Voice,” “Unlock Your Creativity” and “Decentralization Empowerment” differ in theme but leave audience tension, product mechanism and campaign action unspecified. Raw Brand context permits greater specificity only where actual positioning, Personas, offering and constraints are present. Lexical Learning retrieval may miss relevant statements when the short question shares no vocabulary with them; DNA/positioning and full unselected node content are not ranking inputs. A short follow-up can benefit from the last assistant answer's terms, but this does not provide semantic or cross-language equivalence. [S1–S2]

Ask each proposed direction to connect a supplied audience need to a supplied differentiator, a concrete creative mechanism and a suitable existing object/channel. Under the **reported** Appics themes, possible hypotheses to evaluate include:

- A creator-led “show your process” direction linking individuality to the reported monetization proposition; verify the actual earning mechanism before writing benefit claims.
- A choice/control direction explaining a verified decentralization feature through a concrete creator decision; avoid unsupported ownership, revenue or privacy promises.
- A collaborative creative challenge using the reported Explorer/Creator themes; specify the participation action, while treating audience fit and willingness to participate as unvalidated.

These are proposed concepts, not Appics facts, user testimonials, case studies or successful campaigns. Distinctiveness should come from a verified mechanism and audience tension, not adding the Brand name to a generic slogan. A useful option explains a trade-off: product education versus emotional appeal, individual expression versus community participation, or clarity versus novelty. No direction should promise measurable lift.

## D. Context fidelity and provenance matrix

“Revalidated” below means boundary checks, not continuous monitoring, external truth verification or guaranteed model obedience. [S1–S3]

| Source / origin | Access authority | Normalization and model payload | Loss / omission | Freshness | Accurate claim |
|---|---|---|---|---|---|
| Canonical Brand Core: `brands.brand_core`, name/revision/time | Independent canonical Brand read access for persisted Board Brand; Learning capture additionally validates active identity and Brand ACL | Raw stored Core as `canonicalBrandCore.value`, name, numeric revision, updated time; not the S4 formatter | Absent for Board-only access; unsaved Profile drafts absent; no field-level source index; raw drafts/accepted content coexist; oversized base rejected, not automatically summarized | Full projected values and metadata participate in capture/revalidation fingerprint | “Current authorized saved Profile says…”; saved identity context is not external evidence or blanket approval of every nested draft |
| Saved campaign Brand snapshot: `boards.brand_core_snapshot` | Board edit capability; explicit valid ownership projection | Plain object or `{}`, sent whole as `boardBrandCore`; source revision/time separately | Unsaved browser Brand edits absent; campaign objective may be absent; copied-at/backup/comparison UI state not supplied; `{}` can still satisfy the response's object-presence flag | Board projection fingerprint includes snapshot and source metadata; snapshot may intentionally be historically older than canonical | “Saved campaign snapshot says…”; describe conflict, do not silently refresh or equate it with current canonical truth |
| Positioning, value proposition, tone, messages, Personas/ICP | Inherit the Core/snapshot authority above | Native keys include `brandCore`, `valueProposition`, `toneOfVoice`, `messagingPillars`, `personas`, guidelines/examples; Profile Personas use `{name,note}` | No guaranteed normalized `positioning`/`icp` abstraction. Custom ICP tiles may carry additional detail. S4 `formatPersona` omits `note`, but this is **not** an Advice loss because S4 is unused here | Same Core/snapshot boundary checks | Quote actual source/key; no assumption that display readiness means all strategic fields are complete |
| Brand DNA/archetypes: persisted `brandDNA` | Same independent Core/snapshot access; nested approval remains data | Raw archetypes, reasoning, confidence, signals, approval flags and other persisted properties, if present | No built-in Advice archetype guidance; no field-level trust filtering; confidence is generated metadata, not empirical Brand fit | Same fingerprint; unsaved DNA drafts unavailable | “Profile records Explorer/Creator…” when supplied; do not interpret confidence as measured effectiveness or drafts as approved facts |
| Founder Story / custom modules: Core `customTiles` | Same Core/snapshot access, not a separate retrieval grant | Persisted content, `moduleType`, nested `moduleData`, acceptance/draft lifecycle reach Advice as raw JSON | Advice does not call accepted Founder Story preflight or S4 accepted Market Research/Business Plan projection. Lifecycle needs explicit interpretation; no new external/private document fetch | Same fingerprint, not verification of the underlying narrative | Attribute saved or draft narrative appropriately; acceptance of module content is not approval as a Brand Learning |
| Working Canvas nodes: browser `state.nodes` | Authenticated Board editor plus structural server validation | IDs/type; title, content, status, funnelStage, audience, tone, cta, channel; selected social/LP fields. Alias `Social Media Post` becomes `Social Media Posting`; strings trimmed server-side | Browser slices title/short fields to 1,000, content to 8,000, nested strings to 3,000, hashtags to 20×100. Drops `goal`, variants, tags, comments/postits, image data/prompts, LP visual prompt, schedules, layouts and other native fields | Captured for request; browser checks context identity on return. Not compared to persisted `canvas_json`, intentionally supporting unsaved work | “Submitted working node N says…”; cannot assert persisted state, complete asset coverage or omitted objectives |
| Canvas connections | Same Board/Canvas authority | Array edges normalized to IDs/endpoints; object aliases normalized; optional edge type retained; server verifies endpoints exist | Layout/edge UI metadata omitted; no semantic relationship inferred by code; extra fields rejected server-side | Included in browser comparison; structural endpoint validation | “N is connected to M” if supplied; connection alone does not prove intent or causal performance |
| Selected node and surroundings | Selected ID must exist in validated Canvas | Full validated selected object repeated under `workingCanvas.selectedNode`; all nodes/edges remain available | No explicit neighbor list, path roles, relevance ranking or focus boundary; selected CTA/tone not fully used by Learning ranker | Selection participates in browser identity; known top-level CTA fingerprint omission remains | Identify selected node and true direct connections; do not substitute it for a conversationally referenced idea |
| Approved Learnings: `public.brand_learnings` | Independent unique active identity + Brand ACL after canonical access; only persisted Board Brand; Board-only path never enumerates | Scan approved rows; normalize lexical terms, rank/dedupe, pack whole statements. Model/transparency items contain `L#`, revision, statement; coverage counts | Source Board/node IDs and reviewed time are ranking inputs, not model attribution fields. `evidence_summary`, source type and reviewer are not selected here. Relevant semantic/cross-language matches may be missed; budget omissions explicit | Selected statements/revisions/status checked before/after inference; unrelated new approvals do not invalidate answer | “Supplied approved Learning L1 states…”; not independently verified performance, exhaustive library review or proof of use |
| Conversation: ephemeral successful browser exchanges | Current account/Board/load scope; server validates strict pair shape and bounds | Last fitting successful pairs, chronological; max 4, 28,000 total chars, each user 2,000/assistant 12,000; retained as original user/assistant roles | Failed/pending excluded; pair mode metadata absent; oversized/older pairs can be skipped. `truncated` is not an exhaustive flag for every omission | Reset/abort/stale suppression on identity changes; historical factual claims remain lower authority | Resolve the latest included ordered referent; do not claim durable memory or recall an omitted answer |
| Advice diagnostics | Server derives from validated working Canvas, not external analytics | Version/basis/counts/stages; aggregate code/severity/message findings | No affected IDs, actual audience/tone values or applicability in finding objects; CTA/trust/stage limitations in C | Recomputed from captured validated nodes; no independent measurement | “This structural rule detected…” with scope; never claim verified audience response, ROI or causal impact |
| Insights UI snapshot and explicit handoff | Existing visible Board/current Canvas guard; edit access for Brain draft action | Separate local analysis plus provenance/IDs; handoff renders bounded text into question draft, up to 3 affected nodes/8 values/evidence entries | Not an automatic trusted model feed; localized prose loses structured provenance; draft may be edited/truncated by question bound | Handoff requires current snapshot; Advice rechecks current supplied Canvas, not historical Insights identity | Attribute a user-supplied finding and verify fields; never treat draft text as verified measurement |
| Selected sidebar Brand / unsaved Profile / external analytics | No Advice authority from selection alone | Not added to ordinary Advice payload | Different selected Brand, unsaved Profile edits and external performance cannot be assumed available | Not applicable | State the relevant limitation; no unauthorized fallback retrieval |

### Selection and capacity details that affect relevance

Learning ranking weights question lexical overlap ×10, selected-node overlap capped at 4, Canvas title/audience/channel overlap capped at 2 and last assistant text overlap capped at 2. Same-Board provenance adds .25, same selected source node another .5, but provenance alone does not make a row match. Approval date and ID break ties; normalized statements deduplicate. Selected-node ranking includes content/social/LP values but omits top-level tone/CTA/funnelStage; general Canvas ranking omits full content and edges. Canonical positioning/DNA is not a query input. An English synonym or German translation is not guaranteed to match. [S2]

The approved scan pages by 256 rows with a 32 MiB/5-second technical guard; failure is bounded unavailability, not silent partial success. Token packing has no fixed Learning-count quota: it reserves output/framing, counts full policy/Core/Canvas/history/question and includes whole statements that fit. Oversized base context returns 422; unknown model capacity/encoding requires explicit configuration. Coverage `partial` describes budget omission among ranked rows; `partial:false` does not prove semantic completeness. [S2]

Canvas limits are 200 nodes, 400 edges and a 350,000-byte request-body guard. Direct callers with overlong fields are rejected; the normal browser slices earlier. There is no model-visible truncation manifest. Server revalidation protects captured Board/Brand/identity/selected Learning state, not client Canvas authenticity, continuous revocation or facts already sent to the provider. [S1–S2, S5, S8]

## E. Root causes of generic or weakly grounded recommendations

| Verified mechanism | Likely quality effect / qualification | Smallest response |
|---|---|---|
| Raw Core/snapshot JSON, broad source labels; no task-specific field index | Rich content competes with drafts, duplicate snapshots and other fields; weak salience is plausible, not demonstrated causation for Appics | Add a compact source/key guide and explicit lifecycle/conflict rules; preserve raw authorized values initially |
| Aggregate diagnostic labels without attribution | Model may repeat warning as conclusion or spend effort reconstructing attribution | Derive bounded exact evidence from validated nodes; keep observation and interpretation separate |
| Lexical/case-sensitive variation rules | Intentional segmentation or equivalent labels look like inconsistency | Report exact differences and condition interpretation on audience/goal/connection context |
| CTA/trust field/applicability mismatch | False “missing” claims, misplaced priority | Provide qualified applicability/counterevidence beside the existing finding; defer shared rule redesign |
| Native goals omitted; no relationship focus | Priority may drift to generic consistency; selected-node reasoning stays shallow | Use only supplied explicit constraints; derive true direct neighbors; ask for the goal when decisive |
| Lexical Learning query omits Brand context, some node fields and graph | Relevant approved observations may not be selected | Preserve truthful coverage; evaluate known vocabulary misses before any separate ranking change |
| Browser slices without disclosure; model output also character-clipped | Missing decisive wording or incomplete conclusion | Avoid completeness claims; document limits; separate truncation-contract changes from this MVP |
| Prompt already says “clear recommendation” but not “why this first” | Several reasonable actions without a decision | Ask for the best supported next change, a short comparison with the next plausible alternative and a concrete object-level action |
| Historical references and generic numbered output interact | Wrong “second idea,” especially with dropped history or visual renumbering | Keep history order/content; preserve rendered ordinal starts; add continuity evaluation |

These are source-supported mechanisms and testable hypotheses. They do not establish model failure rates, causal weights or a need to change the configured model. [S1–S12]

## F. Strategic response-quality recommendations

### Evidence and Brand interpretation

For a material factual comparison, use an actual source, field and short exact phrase: for example, “Node ‘Title’ (`node-id`), audience: ‘…’” and “Canonical Profile `messagingPillars`: ‘…’.” Do not require citations for every sentence or dump raw context. If evidence is absent, call it unavailable. Attribute Learning statements with their current per-turn `L#` ref, without inventing source campaigns, reviewers or study links.

Use positioning, audience needs, offering and campaign constraints to explain relevance before archetype/tone. Explorer/Creator should influence a proposed mechanism or expression, not become the entire strategic rationale. Treat DNA confidence, generated content and nested draft modules according to their supplied status. When canonical identity and a campaign snapshot differ, state the discrepancy, preserve explicit campaign constraints and request human review of a material conflict. Never produce a silently reconciled “truth.” [S1–S4, S7]

An internal evidence preparation step should reference only validated node IDs/fields and real edges. It can group audience/tone values by node and identify selected-node direct parents/children. Include applicable scope and counterevidence for aggregate warnings, especially CTA/trust. Bound any derived excerpt/count and indicate incomplete evidence coverage. It must remain a convenience index over the original context, not a newly authoritative strategic diagnosis.

### Decisions and mode-specific depth

| Mode | Useful answer behavior | Avoid |
|---|---|---|
| General | Answer the current question directly, add evidence/uncertainty where useful; keep a brief follow-up brief | Automatically performing a full review |
| Review Strategy | Recommend the highest-value supported adjustment, cite the relevant node/Brand constraint, explain priority and a trade-off | Generic audience/tone alignment without examples or objective relevance |
| Explore Ideas | Small distinct set; each has audience tension, verified Brand mechanism, sample expression/action and a trade-off; number options once | Three slogans with interchangeable rationales; invented product benefits or testimonials |
| Find Gaps | Qualify applicable structural absences, strategic hypotheses and unknown evidence; prioritize material gaps in current scope | Treating every funnel stage or trust block as mandatory |
| Evaluate Options | Recover supplied/historical alternatives; compare against explicit Brand/goal/constraint criteria; choose conditionally when necessary | Inventing missing budgets/results or replacing a referenced option with a Canvas item |

Prefer one clear next step tied to an existing object and field when the user asks for a decision. State why it comes before the next plausible improvement using objective fit, dependency and evidence strength; numerical scoring is unnecessary. If the objective is unavailable, make the recommendation conditional or ask one concise question whose answer would change it. No question is needed when the user already supplied enough context.

“Expand the second idea” must preserve the second idea in the most recent relevant included assistant list. Current evidence may refine or challenge it but must not replace its referent. Do not rewrite history to enrich it. Distinct concepts and stable ordinals make this easier. [S1, S9]

Write in natural EN/DE, avoiding repeated Brand summaries, boilerplate conclusions and generic imperatives such as “ensure consistency” without a concrete example. Label proposed wording as a proposal. A small query can merit a paragraph; a substantive comparison can merit a few sections. These are quality goals for evaluation, not an exact output schema.

## G. Safe formatting recommendations

| Issue | Verified current behavior | Minimal recommendation |
|---|---|---|
| Excess headings | Prompt asks for short headings; parser maps `#`–`####` to h3–h6; no heading-count constraint | Prefer paragraphs/bold labels for short replies; headings only for substantial changes of topic. No heading suppression that loses content |
| Repeated numbering | A fresh `<ol>` is created for each contiguous block; numeric source markers are discarded, including a resumed list starting at 2 or 3 | Preserve the parsed first ordinal through a validated integer `ol.start`; use explicit item values only if needed for source discontinuities. Keep the DOM allowlist and actual source order |
| Literal escaped line breaks | CRLF/CR becomes real LF; literal `\\n` is plain text. Real LF inside a paragraph becomes `<br>` | Request actual line breaks in the prompt. Do not globally unescape backslashes: that can corrupt literal text/paths. Any later legacy-output normalization needs an unambiguous producer contract and literal-text fixtures |
| Findings versus advice | Markdown/bold works; API has no structured findings/recommendations output; optional assumptions UI is supported but Advice does not populate that field | Use brief “Observed,” “Interpretation,” “Suggested change” labels when helpful, without implying verified provenance. No HTML cards or new response schema |
| Long responses | Existing 78ch text measure, larger spacing, responsive transcript and Jump to latest from #817 | Preserve these changes; first reduce generation repetition. Do not reopen the full layout or change shared `styles.css` for this package |
| Hostile/malformed content | Text nodes plus fixed semantic elements; links/HTML/images remain inert; simple lists only | Retain safe fallback. Test headings, bold, code-like literal text, malformed Markdown, long words and EN/DE. No third-party Markdown parser or `innerHTML` for model text |

Ordered numbering is relevant to semantic continuity, not merely appearance. Preserve actual idea order in history and visible output; never renumber model ideas server-side to make a prettier response. [S9–S11, S14]

## H. Proposed minimal implementation scope

This is a reviewable proposal, not authorization to implement within this PR.

1. **Internal Advice evidence preparation:** retain the current authorized raw Core/snapshot, validated Canvas and diagnostics. Add a bounded source/field guide, exact audience/tone groups, selected-node direct neighborhood and qualified diagnostic applicability/counterevidence from already supplied fields. Use IDs/titles/field paths and short source-preserving excerpts, indicate derived-index omissions and count everything in the existing final token budget. Never silently discard the raw context or truncate whole Learning statements to fit the additions.
2. **Prompt refinement:** extend the existing trusted policy with evidence→interpretation→priority guidance, lifecycle/conflict caveats and the mode distinctions in F. Avoid mandatory sections. Reconcile the opening “authoritative saved Board Brand Core” wording with the later explicit canonical/campaign precedence so the two are described by scope rather than competing absolute authority.
3. **Client freshness completeness:** use the supplied Canvas projection consistently in request identity, including top-level `cta`. This closes the known isolated CTA-edit omission without accepting new fields or changing API contracts. Preserve selection, identity, permission and stale-response lifecycle.
4. **Safe renderer correction:** retain fixed DOM elements/textContent and preserve validated ordered-list start numbers. Prompt for real newlines; defer speculative global unescaping. Preserve #817 workspace behavior and existing styling.
5. **Focused fixtures/evaluation:** add provider-mocked contracts for exact evidence, applicability, authority and zero extra calls, plus human scoring of the three reported cases and all five modes using disposable, explicitly fictional fixtures. No paid evaluation is required or run automatically.

Likely future implementation files: `api/ai-brain/advice.js`; a small Advice-only evidence helper if it keeps derivation independently testable; `app.js`; focused regression script(s), npm/workflow registration if required by the established test workflow; implementation notes. **This audit PR changes none of those runtime/test/CI files.** No CSS change is necessary for the minimal proposal.

**Preserved invariants:** signed session and independent Board/Brand/identity authorization; persisted Board Brand context; Board-only operation without hidden Brand data/counts; approved-only Learnings and existing retrieval ranking; whole-statement token packing; current Canvas allowlist/count/size validation; history limits, roles and ordered references; pre/post inference revalidation; `store:false`; unchanged provider/model/timeout/error handling; one model call per ordinary valid turn; five existing modes and UI; explicit separate Content-node preparation, preview and human creation; no implicit writes to Brand, Canvas, Insights or Knowledge.

**Separate follow-ups:** native `goal` and richer campaign constraints require a separately reviewed Canvas/request-contract extension; complete shared Insights/Advice diagnostic parity requires owning-surface design; Learning query/ranking improvements require multilingual relevance fixtures and a new selection-version decision; truncation manifests/output completion, accepted-module projection/minimization, persistent decisions and typed handoffs need their own contracts. Do not fold them into an apparently prompt-only change.

## I. Test and acceptance matrix

### Deterministic contracts for a future implementation

Provider mocks prove payload shape, authorization, call count and response handling. They do not prove the real model obeys the prompt or produces useful strategy. Database tests use only disposable fixtures such as S15's PGlite fixture; never point them at production.

| Coverage | Fixture / assertion | Acceptance |
|---|---|---|
| Five modes and legacy omission | Run General/Review/Explore/Gaps/Evaluate; omit mode; reject invalid enum/body keys | Existing mode defaults, response metadata and message ordering preserved; fixed trusted mode policy counted in budget |
| Brand-specific factual grounding | Fictional saved positioning, `{name,note}` Persona, tone/messages/DNA plus nested draft/accepted modules | Exact supplied values/source guide retained; no draft promoted to Learning approval; absent fields identified as absent |
| Exact node references | Repeated titles, distinct IDs and short differing field strings; adversarial quotes/instructions | Evidence identifies correct IDs/paths/values and cannot invent nodes; text stays untrusted |
| Selected and connected nodes | Selected node with incoming/outgoing edges, unrelated node, cycle and disconnected graph | Direct neighbor index reflects actual endpoints/direction only; no fabricated dependency; validator still rejects stale endpoints/selection |
| Diagnostic applicability | `social.cta` only, top-level CTA only, preview with no action, one populated CTA plus other missing nodes, no LP, LP with/without trust | Existing rule result remains distinguishable from supplied counterevidence/applicability; no universal “no CTA” claim in trusted guidance; shared Insights behavior unchanged |
| Audience/tone false positives | Equivalent strings/case variants, intentional segments, two versus three tones | Deterministic counts/values correct; guidance explicitly leaves semantic conflict as interpretation |
| Canonical/snapshot conflict | Different current positioning vs explicit historical campaign constraint; empty Core | Both scopes retained with provenance; no silent merge, no overstatement of object-presence flags |
| Learning governance | Approved/pending/rejected/archived, superseded selected Learning, cross-Brand secret; semantic lexical miss | Only independently authorized approved statements supplied; no invented provenance; miss/budget coverage described truthfully; ranking unchanged |
| Large Canvas and capacity | Exactly/above 200 nodes, 400 edges, body/string bounds, oversized Core/history, long selected neighborhood and many relevant Learnings | Same 400/409/413/422/503 semantics as applicable; complete messages including evidence/policies counted; no hidden dropping of raw base context or split Learning statements |
| Board-only access | Board editor lacking canonical Brand ACL; canonical Brand viewer lacking Board edit | Board-only request has snapshot/Canvas but no hidden canonical data, Learning statements or library counts; viewer denied before inference |
| Brand/Board mismatch | Sidebar Y, Board A/X; change selection during pending request | Context stays A/X; no Y retrieval; preserved lifecycle behavior |
| Account/permission changes | Remove Board edit, Brand membership or active identity before dispatch/during inference; revise snapshot/Core/selected Learning | Pre-check prevents dispatch; post-check suppresses answer; no retry; unrelated new approval alone remains non-invalidating |
| Client mutation freshness | Top-level CTA-only edit plus all projected nested fields, selection, edge and Board/account changes | In-flight stale response suppressed, including the existing CTA omission; current retry gets fresh context |
| Follow-up continuity | Three ordered ideas then “expand the second idea”; changed current facts; absent/truncated history; retry | Original second referent and history order retained; stale facts corrected without substitution; existing no-provider clarification/limits preserved |
| EN/DE | Same fictional fixtures, switched interface language and mixed-language history | Captured per-turn instruction and existing mismatch handling preserved; source quotations remain exact; no extra language-repair call |
| Safe Markdown | Headings, resumed `3.` list, separated lists, malformed markers, literal backslash-n and actual LF, hostile HTML/URLs/images | Correct visible ordinals, literal fallbacks, no executable elements/unsafe HTML; existing text-only safety retained |
| UI continuity | Short/long answer, manual scroll, Jump, mode/draft/caret/disclosure, mobile/themes/keyboard | #817 behavior retained; no layout redesign or automatic submission |
| No invented metrics / no extra calls | Mock response and complete provider request capture; ordinary, denied, clarification and error paths | One inference on ordinary valid turn, zero for rejected/clarification paths; `store:false`, no tools/retries/new model; prompt forbids fabricated metrics. Human review checks semantic compliance |
| Explicit Content-node boundary | Ordinary turn and mode changes vs explicit prepare/preview/create | Ordinary Advice does not invoke proposal endpoint, autosave or domain writes; existing separate explicit action remains intact |

### Practical human quality evaluation

Use fictional fixtures with known expected sources and deliberate conflicts. Include sparse and rich Brand context, an awareness-only Canvas, intentional multi-audience strategy, selected connected nodes, approved-Learning hits/misses and EN/DE follow-ups. Keep the three Appics observations as evaluation questions; do not pass off synthetic data as Appics records. Compare baseline and candidate only when comparable answer captures are already available or a later evaluation is explicitly authorized. This audit performs no paid calls.

Score each dimension 1–5: **1** misleading/generic, **3** useful but incomplete, **5** specific and well justified. Scores 2/4 are intermediate. Record the exact supporting or problematic sentence, expected source and reviewer rationale.

| Dimension | 1 anchor | 3 anchor | 5 anchor |
|---|---|---|---|
| Recommendation relevance | Ignores Brand/question | Generally fits but could suit many Brands | Connects supplied positioning, audience and actual campaign decision |
| Evidence precision | Invents/misattributes facts or nodes | Mostly grounded but vague attribution | Correct node/field/phrase and source scope; clean observation/interpretation distinction |
| Prioritization | Unranked generic tasks | Picks an action with weak comparison | Explains why this action comes first given objective, dependencies and evidence; conditional if goal absent |
| Creativity | Interchangeable slogans or invented benefits | Different themes with limited mechanisms | Distinct Brand-specific mechanisms, sample expression and credible trade-offs without fabricated proof |
| Uncertainty | Treats heuristics as verified results | Notes some limits | Identifies material assumptions/conflicts/unknowns naturally and asks only decision-relevant questions |
| Actionability | Abstract “improve consistency” | Clear action with incomplete object linkage | Concrete proposed change tied to an existing object/field or explicit missing input; human remains decision owner |

Suggested acceptance: no fabricated facts, metrics, testimonial, node ID or unauthorized source in any reviewed answer; evidence precision and uncertainty at least 4 on every substantive case; each other applicable dimension at least 3 and median at least 4 across cases/modes/languages. Mark creativity N/A for a simple factual follow-up rather than forcing ideas. At least two reviewers should resolve any factual-grounding disagreement against the fixture. Do not rely on average scores to hide a critical fabrication. These are proposed release criteria, not measured results.

### Validation actually performed for this audit

- **Baseline verification:** remote GitHub main/merge metadata and full tree verified; all 866 non-PNG baseline blobs in the isolated source mirror matched the exact main tree. The local starting checkout was #816; #817 text changes were retrieved through the GitHub connector because Git transport could not connect to the environment proxy. Screenshots were not re-evaluated; #817 source and implementation notes were inspected.
- **PASS:** existing BW-26 read-only checks; BW-26.2 safe Markdown checks; BW-28 architecture (86 contracts); BW-28.1 handoff (39 contracts); browser-script integrity (47 classic scripts, invoked by those checks).
- **PASS:** eight disposable, provider-free source probes verified ignored social/top-level CTA, preview-as-CTA behavior, trust warning without LP, case-sensitive audience variation, two/three-tone thresholds and validator rejection of `goal`. No probe or test change is included in the PR.
- **Environment-blocked:** existing BW-37.1A-R1 workspace and BW-36.21A-R2.3 Brand/Board browser suites were attempted but Chromium exited during launch with `setsockopt: Operation not permitted`/SIGTRAP, before assertions. No browser pass is claimed.
- **Inspected, not rerun:** BW-37.1A full mode suite and BW-36.20/20R1 integration; their PGlite and `js-tiktoken` dependencies are absent here. Existing BW-26 history/reference/language/Content-node suites were inspected for the proposed matrix. Full PostgreSQL-matrix Runtime Boot Safety was not rerun for this documentation-only change. Prior PR results are historical evidence only.
- **Documentation checks:** required A–K sections, implementation prompt, baseline/date, repository citation paths/line bounds, index links, balanced fences/tables and whitespace are validated before delivery; remote diff must contain exactly the three requested Markdown files.
- **No production operations or live evaluation:** no production SQL, Brand data/configuration change, paid model evaluation, merge or deployment command.

## J. Risks, exclusions and follow-on work

The strongest remaining uncertainty is the actual Appics payload. Without it, neither a specific wording conflict nor the highest-priority Appics edit can be verified. Authorized fixture captures, source values and complete answers would resolve this without inventing evidence.

Adding a derived index can increase token pressure and duplicate untrusted material. Keep it bounded, label its completeness and count final serialized messages. Source paths/IDs improve attribution but do not validate model claims; subjective answer review remains necessary. Avoid copying arbitrarily large draft/private modules into additional summaries. A future minimization/projection design must preserve authorized meaning, lifecycle and loss reporting rather than blindly reusing the lossy S4 formatter.

Revalidation is time-bound and cannot retract context already dispatched. Historical transcripts can contain earlier facts; authorized current facts take precedence. The current UI's “Board Brand Core” scope label and object booleans do not prove substantive coverage. A future coverage contract can improve that disclosure; do not infer it from a successful response.

Keep separate: shared diagnostic rule redesign/parity; native campaign goal/constraint schema expansion; multilingual/semantic Learning ranking; explicit truncation manifests and output-completion signaling; governed durable decisions/conversations; typed Canvas/Insights handoffs; selected-Brand-only conversations; model/provider comparisons. All require their own bounded design and validation, not silent expansion of this MVP.

Excluded: new tables/migrations, embeddings, new providers, automatic Canvas writes, agent workflows, generic usage quotas, extra ordinary-turn paid calls, unapproved Learning retrieval, production SQL, Vercel/Supabase/TLS/RLS changes, Brand data mutation, merge and deployment. Established roadmap decisions and ownership in S13 remain unchanged.

## K. Complete directly copyable BW-37.1B implementation prompt

The following is a future implementation brief. It does not change this PR's audit-only scope.

```text
TENDRA ONE — BW-37.1B: Strategic Answer Quality & Context Intelligence MVP

Repository: Funklix/Funklix.

Implement the minimal package defined in
docs/audits/bw37-1b-strategic-answer-quality-audit.md, sections F–I.
Read the entire audit and approved BW-37 audit first. The audit baseline is
20f162a771ae4820b4ab4e43b588af7951f9799f (2026-10-25 Europe/Berlin), including
PR #817. Start from latest merged main, record its exact SHA and inspect relevant
changes since that baseline. Read AGENTS.md, product architecture, intelligence
architecture, and the #817 implementation notes. Preserve roadmap decisions.

DELIVERY
Use a dedicated branch; commit and push the completed implementation. Open exactly
one normal non-draft PR against main and verify draft:false. Never merge or deploy.
If technically blocked, report BLOCKED and the actual cause; do not invent a URL.

OWNERSHIP
Brand Brain owns canonical Brand truth. AI Brain owns strategic conversations and
recommendations. Insights owns diagnostics/evidence. Campaign Canvas owns campaign
creation/editing. Knowledge owns governed reusable knowledge. Humans approve
strategic decisions. Extend existing Advice; do not add a second AI system.

INSPECT BEFORE EDITING
Trace api/ai-brain/advice.js, _ai-brain-learning-context.js,
_ai-brain-canvas-context.js, _ai-brain-conversation.js,
_ai-brain-diagnostics.js, _brand-brain-context.js, Board/Brand/Learning access,
app.js projection/history/freshness/submission/renderer, dedicated Brain CSS,
Brand Profile/DNA/Founder Story contracts and Insights diagnostics/handoffs.
Inspect BW-26, BW-28, BW-36.20/20R1, Brand/Board separation, BW-37.1A and R1 tests.
Do not assume the Brand context formatter is used by Advice: current Advice sends
raw saved Core/snapshot JSON. Do not apply its truncation rules accidentally.

MINIMAL SCOPE
1. Add a small internal Advice evidence preparation step over existing authorized
   Core/snapshot and validated Canvas only. Keep original authorized context.
   Provide a concise source/key guide, exact audience/tone values grouped by node
   ID/title, and selected-node incoming/outgoing direct neighbors from real edges.
   Provide applicable scope/counterevidence beside aggregate diagnostics, using
   existing node fields. Preserve exact short quotations and distinguish any
   excerpt/index omission from absence in the original context. Bound duplication
   and count the actual final messages in the existing token budget. Never split
   Learning statements, silently drop raw base context or invent node relationships.
   A small Advice-only helper is acceptable if it makes this derivation testable.

2. Refine trusted server-owned strategic instructions, preserving five modes and
   current message-role order. Use actual source/field/phrase when a material claim
   or comparison depends on it. Distinguish confirmed structural observation,
   strategic interpretation, hypothesis/assumption and unknown evidence naturally.
   Qualify CTA/trust/stage heuristics: differing labels do not prove inconsistency,
   no Landing Page does not imply missing required trust, and partial CTA detection
   does not prove every asset lacks a CTA. Do not change shared Insights rules.
   Reconcile source descriptions with current precedence: canonical identity,
   saved campaign constraints, supplementary approved Learnings, working Canvas
   and lower-authority historical facts. Nested generated/draft material remains
   draft; module acceptance is not Learning approval. Never silently merge conflicts.

3. Complete the client freshness identity for the actual supplied projection,
   including top-level cta. Preserve account/Board/load/permission/selection guards,
   abort/reset, current-context retry and stale-response suppression. Do not add
   goal or other native fields to the request or validator in this package.

4. Preserve safe textContent/fixed-element Markdown rendering. Honor validated
   ordered-list start ordinals so separated/resumed lists retain visible numbering.
   Preserve source order and conversational idea identity. Prompt for actual LF;
   do not globally unescape literal backslash-n or adopt an unsafe HTML/Markdown
   engine. Retain #817 workspace width, text measure, transcript anchoring, Jump,
   draft/caret/focus/disclosure, keyboard, mobile and theme behavior. No layout or
   shared stylesheet redesign is needed.

STRATEGIC QUALITY
General: answer the actual question proportionately; no automatic full review.
Review Strategy: choose the best supported next adjustment, tie it to an existing
object/field and authorized Brand constraint, explain why first and a trade-off.
Explore Ideas: a small set of distinct audience/Brand mechanisms with concrete
expression/action and trade-offs; avoid interchangeable slogans and invented proof.
Find Gaps: check applicability and materiality; separate absent fields, strategic
needs and unknown evidence; do not require a universal five-stage funnel.
Evaluate Options: use supplied or historical alternatives and explicit criteria;
recommend conditionally; ask one concise question only when essential information
cannot be recovered. Missing native goal is not permission to invent an objective.

Use positioning, audience need, offering and campaign constraints before archetype
or tone as a rationale. Preserve exact source copy when quoting; proposed copy is
a proposal. No mandatory answer template. Avoid excessive headings, repeated Brand
summaries, repeated numbering and generic conclusions. Short follow-ups stay short.
Resolve “expand the second idea” from the latest relevant included assistant list,
preserving its order. Current facts may enrich/correct but never replace referents.
Never invent studies, testimonials, product capabilities, budgets, metrics or results.
Supplied Learnings do not prove use, exhaustive review or verified performance.

NON-NEGOTIABLE INVARIANTS
Keep signed-session authentication, explicit Board ownership projection and edit
authorization, persisted Board.brand_id context, independent canonical Brand and
active-identity/Learning ACLs. Sidebar Brand Y never replaces Board A/X.
Board-only Advice must reveal no hidden canonical knowledge or Learning counts.
Preserve approved-only scan, current lexical ranking/selection version, deduplication,
whole-statement packing, complete-message token checks and existing bounded errors.
Preserve Canvas allowlist, validation/size limits, history limits/roles, zero-call
clarification, EN/DE per-turn rules, pre/post inference revalidation, store:false,
configured provider/model, timeout, one inference per ordinary valid Advice turn
and no automatic retry. Derived evidence remains untrusted context, not instructions.
No extra background calls or self-evaluation calls.

Preserve existing UI/modes, Home navigation and editable Insights question handoff.
Content-node preparation is a separate explicit action followed by preview and
human creation. Ordinary Advice or mode changes must not invoke it or write data.

EXCLUSIONS
No tables/migrations, new providers, embeddings, agent workflows, generic quotas,
automatic Canvas/Brand writes, unapproved knowledge retrieval or production SQL.
Do not change Vercel, Supabase, TLS, RLS or Brand data. No paid model evaluations.
Keep goal/constraint schema expansion, shared diagnostic parity, Learning-ranking
redesign, truncation/coverage contracts, accepted-module minimization, durable
decisions and typed handoffs as separate proposals.

VALIDATION
Implement the deterministic matrix in section I with mocked provider transport
and disposable fixtures. Cover every mode/default/invalid mode; exact source and
node evidence; selected/direct-connected nodes; CTA/trust/audience/tone false
positives; canonical/snapshot conflict; nested drafts; approved vs unapproved and
cross-Brand Learnings; large Canvas and token pressure; Board-only and viewer paths;
Brand/Board mismatch; account/permission/identity changes before and after inference;
CTA-only and nested-field stale suppression; ordinal follow-ups and missing history;
EN/DE; safe Markdown with resumed numbering and literal escapes; no invented-metric
instructions; zero/one provider counts; store:false; explicit Content-node boundary.
Do not weaken existing tests. Preserve source-role compatibility and entire budget.
Run focused tests and applicable BW-26/BW-28/BW-36/BW-37 regressions, syntax/browser
integrity and established CI gates with disposable database environments only.
Record actual passes, skips and environmental failures accurately.

Use the human rubric in section I for relevance, evidence precision, prioritization,
creativity, uncertainty and actionability on fictional EN/DE fixtures and the three
reported Appics scenarios. Do not claim mocks prove live answer quality. No paid
semantic evaluation in this task. Record unresolved live-quality uncertainty.

DELIVERY REPORT
Return real PR URL, exact changed files, implementation scope, validation results,
semantic evaluation limits and remaining risks. Verify non-draft main target.
Never merge or deploy.
```

BW-37.1B STRATEGIC ANSWER QUALITY AUDIT READY FOR REVIEW
