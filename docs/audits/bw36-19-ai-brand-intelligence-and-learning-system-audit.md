# TENDRA ONE — AI BRAND INTELLIGENCE & LEARNING SYSTEM AUDIT

| Metadata | Value |
|---|---|
| Project | Tendra One |
| Audit | BW-36.19 AI Brand Intelligence & Learning System |
| Date | 2026-10-12 (original audit); archived 2026-10-13 |
| Audited baseline | GitHub commit `3ac1be9` (`3ac1be9eb185787d38e608687608c26c0150ed0f`) |
| Status | Audit completed, implementation pending approval |
| Scope | Architecture, product opportunities, governance, AI suggestions, Conversation Intelligence and roadmap |

> Archive note: The complete original audit follows unchanged. Repository findings and references remain pinned to the audited baseline. No implementation decision or approval is recorded by archiving this document.

**Recommendation: begin BW-36.19 with explicit, user-triggered analysis of Brand Profile and one selected saved Board, including its Post-its and replies. Reuse human Learning review. Keep suggestions temporary initially, and limit migration-free promotion to evidence anchored to one Node.**

Durable multi-source provenance is a separate, justified schema extension. The existing single-Node contract cannot safely represent a complete conversation evidence ledger.

**Audit basis**

Reviewed GitHub `main` at [`3ac1be9`](https://github.com/Funklix/Funklix/commit/3ac1be9eb185787d38e608687608c26c0150ed0f), the merged BW-36.18 implementation. GitHub was checked again at completion.

The local checkout ended at BW-36.17R2. I inspected an isolated snapshot incorporating GitHub’s complete BW-36.18 change set; the original repository remains unchanged.

No implementation, branch, PR, database operation, production SQL, or AI-provider invocation occurred. Production verification and the live persistence test are **user-reported evidence**, not independently reproduced here.

Throughout this report:

- **CONFIRMED FACT** means supported by the inspected repository.
- **PROPOSAL** means functionality requiring implementation.
- **RISK** identifies a limitation or failure mode.
- **OPEN DECISION** requires approval before implementation.

---

**1. Executive summary: the three strongest opportunities**

| Opportunity | User value | Why it is promising |
|---|---|---|
| Conversation-to-Learning assistance | Recover reusable decisions and corrections from discussions that otherwise remain buried on Boards. | Post-its, replies, resolution metadata, and human Learning review already exist. |
| Evidence-backed knowledge gap and conflict review | Help teams identify missing knowledge and investigate differences between Profile, campaign snapshots, and current work. | Structured Brand knowledge, module readiness, and deterministic Canvas diagnostics provide a useful baseline. |
| Governed Learning feedback loop | Make future AI work reflect knowledge the team has explicitly approved. | Learning approval, revision, archive, and successor mechanisms exist. Provider consumption remains future work. |

**PROPOSAL:** establish trustworthy extraction and review before introducing cross-Board Start Screen intelligence, background processing, or broad AI consumption.

The main architectural challenge is preserving evidence, access, and uncertainty—not choosing a new model or vector database.

---

**2. Confirmed architecture and exact implementation references**

All references below are pinned to the audited commit.

| Area | Exact file/function references | Confirmed behavior |
|---|---|---|
| Signed identity | [`api/_auth-session.js`][session]: `verifySessionToken`, `getSessionUser`; [`api/_app-identity.js`][identity]: `lookupRequestFromVerifiedSession`, `validateIdentityRow`, `compareIdentityToSessionEmail` | Signed cookie authentication; Learning operations require exactly one valid active application identity matching the session email. |
| Brand authority | [`api/_brand-access.js`][brand-access]: `brandCapabilities`, `getBrandAccess` | Owner/admin/editor can edit canonical Brand knowledge; viewer can read. |
| Board authority | [`api/_board-access.js`][board-access]: `getBoardAccess`, `accessForRole` | Board ownership, Board membership, and associated Brand membership contribute to Board access. |
| Workspace boundary | [`api/_workspace-catalog.js`][catalog]: `loadWorkspaceCatalog`, `projectCatalog` | Catalog requires accepted membership in an active Workspace and independently filters Brand/Board authority. |
| Canonical Brand storage | [`api/_brands-storage.js`][brand-storage]: `BRAND_COLUMNS`, `serializeBrand` | Canonical Profile is `brands.brand_core` JSONB with revision and timestamps; Workspace association is relational. |
| Board storage and persistence | [`api/_boards-storage.js`][board-storage]; [`api/boards/[id].js`][board-route] | Board Canvas is JSONB; Brand association and campaign Brand snapshot are stored separately. |
| Campaign creation | [`api/_campaign-creation.js`][campaign]: `execute`; `campaign-creation.js`: `campaign`, `request` | Persists a validated campaign Node/edge graph into an existing Board. |
| Learning lifecycle | [`api/_brand-learnings.js`][learning]: `authorize`, `mutate`, `duplicates`, `appendEvent`, `operate` | Proposed/approved/rejected/archived lifecycle, exact duplicate checks, revision concurrency, transactional history. |
| Learning source capture | [`api/_brand-learnings.js`][learning]: `sourceRequest`, `validateSource`, `previewSource`, `sourceContext`; [`learning-source.js`][source-route] | Authorized persisted single-Node capture, precise Board freshness checks, server-derived labels, current-access source projection. |
| Learning interface | [`brand-learnings.js`][learning-ui]: `create`, internal `load`, `open`, `render`; [`brand-profile-setup.js`][profile]: `readiness`, `createSession`, Learnings section | Human proposal/review/update/archive interfaces and explicit stale-revision recovery. |
| Canvas proposal interface | [`canvas-learning-proposal.js`][canvas-proposal]: `create`; [`app.js`][app], lines 14073 onward: `canvasLearningContext`, `initializeCanvasLearningAction` | Manual Learning proposal from one saved selected Node, with context isolation and explicit Learnings handoff. |
| Conversations | [`app.js`][app], lines 1651–1747, 15757 onward, 16659 onward, 18759 onward | Actor payloads, root Post-its, replies, resolve/reopen/delete, and AI Review Post-its. |
| AI context | [`api/_brand-brain-context.js`][brain-context]: `normalizeBrandBrainData`, `projectAcceptedStrategyModule`, `buildBrandBrainContext` | Bounded Brand projection; accepted strategy modules separate supported facts from assumptions. |
| AI Brain | [`api/ai-brain/advice.js`][advice]: handler, `providerMessages`; [`propose-node.js`][node-proposal]: handler, `proposalMessages` | Authorized advice, bounded working Canvas context, conversation history, timeout, language handling, and structured Node proposals. |
| Diagnostics and Insights | [`api/_ai-brain-diagnostics.js`][diagnostics]: `analyzeCanvas`; [`app.js`][app]: `analyzeCampaign`, `captureInsightsDiagnostic`, `buildInsightsFindings`, `renderInsightsSurface` | Deterministic structural diagnostics; browser Insights snapshots distinguish saved and unsaved Canvas state. |
| Knowledge modules | [`knowledge-module-registry.js`][registry]; [`knowledge-module-dependency-engine.js`][dependencies]: `evaluateKnowledgeModule`, `evaluateDirectDependencies` | Module identities, presence/readiness, and dependency checks. Registry `futureCapabilities` are declarations, not implemented features. |

**CONFIRMED FACT — associations**

- Workspaces contain associated Brands and Boards through `workspace_id`.
- Boards independently reference a Brand through `brand_id`.
- Canonical Brand Profile and Board Brand snapshot are distinct objects.
- Board snapshot provenance includes source revision/time and explicit refresh/restore mechanisms.
- In the inspected campaign creation path, a campaign is a Node/edge graph inside a Board. The route `/api/campaigns` does not establish a separate campaign knowledge table.
- Canvas Node IDs are text identifiers, including values such as `node-1`.
- Learning proposer/reviewer identities use application identity UUIDs. Conversation author fields do not have equivalent server-verified identity provenance.

**RISK:** Workspace membership is not interchangeable with Brand or Board authority. Conversely, existing Brand membership can grant access to associated Boards; “private Board” assumptions must follow actual ACL behavior.

---

**3. Inventory of usable knowledge sources**

| Source | Storage and retrieval | Persistence and evidence limits | Advisor treatment |
|---|---|---|---|
| Brand description, positioning, value proposition | `brands.brand_core`; authorized Brand API/service | Durable canonical JSONB; human-maintained information, not external verification | Primary reusable Brand context |
| Personas, ICP/audience knowledge | Built-in `personas` and typed custom tiles in Brand core | Completeness varies; built-in and module representations can differ | Preserve representation and identify ambiguity |
| Voice and messaging | `toneOfVoice`, `messagingPillars`, `contentGuidelines`, `keywords`, `dosAndDonts`, `brandVoiceExamples` | Durable after canonical save | Policy/context and comparison targets |
| Offers and proof | Profile fields and relevant typed modules | Presence does not prove claims | Treat unsupported proof as a gap |
| Brand DNA/archetypes | `brand_core.brandDNA` | Draft and human-approved states differ | Preserve `userApproved`; unapproved DNA remains a suggestion |
| Brand assets/avatar | Brand asset fields, logo metadata/storage, DNA avatar | Visual assets are not evidence of strategic truth | Use relevant textual metadata; exclude image bytes from MVP |
| Founder Story | `customTiles` and `moduleData.founderStory`; lifecycle/import metadata | Available in persisted core/snapshot; source facts, drafts, and accepted narrative differ | Extract supported fields with their lifecycle |
| Market Research and Business Plan | Typed custom tiles with `moduleData.marketResearch` / `businessPlan` accepted revisions | Existing projection distinguishes accepted facts and assumptions | Reuse that distinction; acceptance is not independent verification |
| Other custom knowledge | Typed/custom tiles: mission, vision, values, audience, ICP, competitor research, product knowledge, website analysis, and freeform tiles | Registry presence does not guarantee meaningful or current content | Allowlist relevant fields; report missing/ambiguous data |
| Campaign Brand snapshot | `boards.brand_core_snapshot` and source revision/time | Durable campaign context; may intentionally differ from current Profile | Compare with canonical knowledge without silently replacing it |
| Canvas Nodes and graph | `boards.canvas_json.nodes` and `.edges` | Durable only after successful server save; content may be generated or user-authored | Campaign evidence/context; origin may be unknown |
| Post-its and replies | `nodes[].postits[]`, nested `.replies[]` inside Canvas JSONB | Durable with Board save; mutable and client-attributed | Discussion evidence with explicit trust limits |
| Approved/proposed Learnings | `brand_learnings`, `brand_learning_events`; Learning service/API | Durable governed records and append-only events | Approved knowledge as comparison authority; proposed records only for pending context and deduplication |
| Canvas diagnostics/Insights | Server diagnostic helper and browser analysis/snapshot | Derived/transient; browser Insights can include unsaved content | Recompute from saved Advisor input and label deterministic |
| Activity feed | Canvas `activityFeed`; local seen markers | Events are not full conversation history; seen state is local | Navigation/context only |
| AI Brain exchanges | Browser session state; bounded history sent to advice route | Not a durable governed knowledge store | Exclude from initial extraction |
| AI Reviews | AI-authored Post-its in Canvas JSONB | Persist after Board save; generated opinion and score | Separate from human evidence |
| Content review/publication/schedule state | Content state, existing review/publication services, internal schedule records | Approval/publication proves workflow state, not marketing effectiveness | Optional later contextual evidence |
| Facebook engagement | Existing account-scoped engagement service | Live reactions/comments/shares aggregate counts; permissions and availability vary | Later explicit evidence integration |
| Simulation results | Simulator assumptions and generated scenario outputs | Hypothetical, not measurements | Never convert to factual performance Learning |
| Historical documents | Existing private document metadata/download paths | New import/processing paths are disabled; private document sources are excluded from generic Brand context | Exclude from MVP; require a separate authorized design |

**CONFIRMED FACT:** Facebook aggregate engagement exists in [`facebook-engagement-service.js`][facebook], specifically `projectAggregates` and `createFacebookEngagementService().read`.

It does **not** provide customer comment conversations, conversion attribution, revenue, comparative campaign effectiveness, or a general analytics warehouse. The service returns current aggregates and a refresh timestamp; this is not a durable historical measurement series.

**PROPOSAL:** no external measurement refresh, website retrieval, image analysis, or document processing should occur during the MVP Advisor run.

---

**4. Conversation Intelligence feasibility**

**Assessment: feasible for assisted extraction; insufficient for verified authorship, historical reconstruction, or automatic consensus detection.**

The current shape is approximately:

```json
{
  "nodes": [
    {
      "id": "node-1",
      "postits": [
        {
          "id": "postit-7",
          "authorName": "Team member",
          "authorEmail": "member@example.test",
          "authorAvatar": "",
          "user": "Team member",
          "time": "legacy display timestamp",
          "createdAt": "ISO timestamp when available",
          "updatedAt": "ISO timestamp when maintained",
          "text": "Discussion text",
          "resolved": false,
          "replies": [
            {
              "id": "reply-...",
              "authorName": "Another member",
              "authorEmail": "another@example.test",
              "createdAt": "ISO timestamp",
              "text": "Reply text",
              "resolved": false,
              "replies": []
            }
          ],
          "color": "#ffe082",
          "x": 24,
          "y": 48
        }
      ]
    }
  ]
}
```

AI Review roots additionally use:

```json
{
  "source": "ai_review",
  "authorName": "AI Review",
  "authorEmail": "ai@funklix.local"
}
```

Resolution can add `resolvedByName`, `resolvedByEmail`, `resolvedByAvatar`, and `resolvedAt`.

| Question | CONFIRMED FACT | Design implication |
|---|---|---|
| Threads and replies | Replies are stored under root Post-its. Normal UI renders one reply level; normalization recursively accommodates reply collections. | Use a bounded extractor and flag unsupported nesting. |
| Source Node | Recoverable through the containing persisted Node. | Require exactly one matching Node ID; ambiguous IDs fail closed. |
| Author | Name/email/avatar come from client payloads; legacy aliases exist. | Display attributed author, not verified identity. Do not infer authority from an email string. |
| Timestamp | New messages receive client timestamps. Legacy fallback can use display `time` or the current time. | Never use UI fallback timestamps as historical evidence. Preserve “unknown/unreliable”. |
| Editing | Root text is mutable; the text input handler does not maintain a complete edit/version ledger. | Fingerprint persisted content; `updatedAt` alone is insufficient. |
| Deletion | Ordinary Post-it deletion removes the root and its replies from the array. | Deleted material cannot be reliably reconstructed. |
| Resolution | Text/replies remain persisted but may be hidden by presentation. | Extract retained discussion independently of UI visibility. |
| Reopening | Sets `resolved` false; previous resolution metadata may remain. | Current state takes precedence; resolution history is incomplete. |
| Human versus AI | Existing code recognizes `source` values and AI name/email markers. | Reuse recognition, but treat these mutable fields as classification signals, not cryptographic proof. |
| Human replies to AI Review | Stored in the same replies collection and counted separately from the generated root. | Include human replies with AI parent context explicitly marked. |
| Consensus | No authoritative consensus/decision schema exists. | Extract explicit decision language with evidence; never invent team agreement. |

**PROPOSAL — decision recognition**

Classify statements as:

- Asserted fact
- Hypothesis
- Subjective opinion/preference
- Question
- Rejected idea
- Explicit decision statement
- Correction
- AI-generated suggestion
- Unresolved disagreement

A reply saying “let’s use this wording” supports an **explicit decision statement**. It does not prove approval by an authorized decision-maker or agreement by the whole team.

Resolution, silence, repeated wording, or several agreeing replies must not become “confirmed team consensus” automatically. Genuine confirmed team decisions require explicit human confirmation; durable structured confirmation would be new functionality.

**PROPOSAL — freshness and access**

Invalidate temporary results when relevant persisted content changes, a source disappears, Board/Brand association changes, Workspace membership becomes inactive, or source access is revoked. Recheck after provider completion, before displaying results, and at promotion.

Already displayed content cannot be retroactively removed from a person’s knowledge. The application can suppress subsequent rendering, discard memory state, and deny further retrieval or submission.

**RISK — R2 event limitation**

The Learning row permits text `source_node_id`. R2’s optional event snapshot Node identifier remains UUID-only.

BW-36.18 therefore deliberately omits `source_node_id` from lifecycle event snapshots while retaining it in the Learning row. Do not fabricate UUIDs, rename Nodes, weaken the CHECK, or insert arrays of comment references into the closed event snapshot schema.

---

**5. AI Learning Advisor design and structured output**

**PROPOSAL — processing sequence**

1. Accept one explicit authorized scope: Brand, Workspace, selected saved Board, and discussion inclusion/exclusions.
2. Resolve signed-session identity and current permissions.
3. Read persisted source data server-side.
4. Produce bounded, allowlisted source records with classification and fingerprints.
5. Calculate deterministic gaps and exact duplicate matches.
6. Make one bounded structured-output inference call.
7. Validate every returned source reference and excerpt against the extracted records.
8. Group similar suggestions and identify possible conflicts.
9. Recheck access and freshness before returning results.
10. Present temporary suggestions; a separate human action begins Learning submission.

No model tools, autonomous retrieval, Learning writes, or approval capabilities are needed.

**Suggested output types**

| Type | Meaning | Action |
|---|---|---|
| `learning_candidate` | Potential reusable Brand knowledge | Human adoption where provenance can be represented |
| `decision_candidate` | Explicit decision language found in discussion | Confirm scope and meaning |
| `recurring_observation` | Similar observations across distinct sources | Review evidence and independence |
| `knowledge_gap` | Missing information in the analyzed scope | Open the relevant Profile/module workflow |
| `potential_conflict` | Possible contradiction involving knowledge or campaign context | Compare both sides |
| `learning_update_candidate` | New evidence may justify revising an approved Learning | Use the successor workflow |
| `strategic_opportunity` | Interpretive next step | Discuss or investigate |

**Evidence indicators**

Separate extraction confidence from factual authority:

- **Extraction confidence:** low/medium/high, with a reason.
- **Evidence class:** human-attributed discussion, approved Learning, canonical Profile, accepted module, deterministic diagnostic, generated material, or unknown.
- **Decision status:** unresolved, explicit statement, disputed, or human-confirmed.
- **Coverage:** included/excluded sources and truncation.
- **Freshness:** source version/fingerprint and validation time.
- **Independence:** repeated copies versus distinct observations.

Confidence must not be presented as a calibrated probability that the underlying statement is true.

**Example proposed output — synthetic data**

```json
{
  "contract": "brand_learning_advisor_v1",
  "scope": {
    "brand_id": "11111111-1111-4111-8111-111111111111",
    "board_id": "22222222-2222-4222-8222-222222222222",
    "include_discussions": true
  },
  "coverage": {
    "complete_for_selected_scope": true,
    "excluded_source_classes": [
      "private_documents",
      "external_analytics",
      "ai_brain_history"
    ]
  },
  "suggestions": [
    {
      "id": "suggestion-1",
      "type": "learning_candidate",
      "statement": "Use a concrete next-step CTA rather than a general slogan.",
      "scope": "brand_candidate",
      "rationale": "A discussion explicitly selected this approach.",
      "extraction_confidence": {
        "band": "medium",
        "reason": "The wording is explicit, but authorship and team authority are unverified."
      },
      "decision_status": "explicit_statement",
      "sources": [
        {
          "ref": "s1",
          "kind": "canvas_reply",
          "node_id": "node-1",
          "thread_id": "postit-7",
          "message_id": "reply-example",
          "classification": "human_attributed",
          "excerpt": "For this campaign, let's use a specific next step."
        }
      ],
      "limitations": [
        "Campaign-specific wording needs human review before Brand-wide adoption.",
        "One discussion does not establish performance improvement."
      ],
      "related_learning_ids": [],
      "duplicate_group": null,
      "recommended_action": "review_single_node_proposal",
      "lifecycle": "temporary_suggestion",
      "approval_required": true
    }
  ]
}
```

The provider should receive pseudonymous source handles such as `s1`; trusted server code maps them to real references. Source existence, classification, and excerpt matching are server responsibilities.

**PROPOSAL — conflict and duplicate handling**

- Reuse exact normalized statement hashing for final Learning duplicate enforcement.
- Add lexical/semantic grouping for suggestions, without a vector database initially.
- Compare against approved and proposed Learnings separately.
- Treat differing audiences, campaign scope, dates, and snapshot revisions as possible explanations before declaring contradiction.
- Do not collapse distinct claims simply because they use similar words.
- Preserve dissent and supporting evidence when grouping.

---

**6. Proposed user journey and product surfaces**

**BW-36.19 journey**

1. A Brand writer opens **Brand Profile → Learnings → Find Learning suggestions**.
2. Selects one authorized saved Board.
3. Reviews scope and explicitly includes Post-its/replies, with exclusions available.
4. Sees what will be sent to the configured AI provider.
5. Clicks **Analyze selected sources**.
6. Reviews temporary cards with evidence, uncertainty, conflicts, and existing Learning matches.
7. Adopts an eligible single-Node suggestion, edits its statement, and saves it as **proposed**.
8. Reviews and approves through the existing Learnings workflow.

Opening the dialog, dashboard, or results surface makes no AI-provider call.

A later Canvas entry point can open the same Advisor with the current Board or thread preselected.

| Feature | Value and example | Data/components to reuse | Missing functionality | Complexity, risk, phase |
|---|---|---|---|---|
| **A. Start Screen intelligence** | “Three Learnings need review; one unresolved positioning question needs attention.” | Existing dashboard hero, Brand Evolution, Suggested Opportunities, Today’s Focus; Learning counts | Authorized Brand-level summary projection; durable suggestion inbox for persistent AI suggestions; source-safe navigation | Medium–high. Cross-context leakage and misleading counts. Phase 3 after reliable engine and storage |
| **B. Conversation Intelligence** | A discussion choosing clearer CTA wording becomes a reviewable Learning candidate | Persisted Post-its/replies; AI/human classification signals; BW-36.18 source validation; Learning dialogs | Bounded extraction, evidence classification, inference schema, freshness checking | Medium–high. Attribution and false-consensus risks. Narrow Phase 1 |
| **C. Knowledge Gap Detector** | “ICP is incomplete; this Board names two audiences whose relationship is unclear.” | Profile `readiness`; module dependency engine; Canvas diagnostics; Campaign Sync | Canonical-versus-campaign comparison and explainable semantic gap review | Medium. Missing data can be mistaken for absence of knowledge. Basic Phase 1; deeper Phase 2 |
| **D. Insights recommendations** | “Several discussions raise this objection; consider reviewing the positioning Learning.” | Findings cards, methodology classifications, Canvas navigation, Ask AI Brain handoff | Conversation-derived findings and durable evidence integration | Medium–high. Diagnostic findings must remain distinct from measurements. Phase 3 |
| **E. Learning feedback loop** | Future advice uses approved CTA guidance; new contradictory evidence proposes an update | Approval/archive/successor lifecycle; bounded Brand context patterns | Server-side approved-Learning selector, consumer-specific precedence, usage explanation and current-access checks | High. Prompt contamination and stale/conflicting guidance. Phase 4, one consumer at a time |

**CONFIRMED FACT:** dashboard `getDashboardBrandEvolutionModel()` currently derives “learning” copy from an existing Brand signal. It does not query the governed Learning library.

**CONFIRMED FACT:** current Insights provides deterministic Canvas diagnostics and an unavailable measured-performance disclosure. New intelligence should use an explicit classification rather than implying these are measured campaign results.

**PROPOSAL — DOM integration discipline**

Before implementation, trace the affected IDs, event bindings, rendering, modal teardown, keyboard handling, and editing-presence detection.

Preserve `#propose-brand-learning-btn`, `#node-form`, existing Inspector hooks, dashboard targets, and legacy navigation IDs. Follow BW-36.18’s dialog placement outside the Node form. Advisor interactions must not dirty or save the Canvas.

---

**7. Authorization, provenance, and governance**

**CONFIRMED FACT — reusable governance**

- Learning create/review operations resolve signed-session identity independently.
- Brand owner/admin/editor can write; Brand viewer can read.
- Board-only and Workspace-only authority do not grant Learning write access.
- Source capture verifies Board read access, exact Brand association, consistent non-null Workspace association, and one supported persisted Node.
- Source-backed creation checks precise persisted Board timestamp and expected Brand revision.
- Learning operations and events share a transaction.
- Identity/membership locks protect existing mutation boundaries.
- Brand-to-Board lock acquisition uses `NOWAIT` to fail closed on contention.
- RLS is enabled for Learning tables, with browser privileges revoked and no browser policies.

**PROPOSAL — Advisor authorization**

For the MVP, allow generation only to current Brand owner/admin/editor, with:

- Active signed-session application identity.
- Accepted membership in the selected active Workspace.
- Brand authority and current Board read permission.
- Matching Board/Brand/Workspace association.
- Explicit analysis scope and provider disclosure.

The accepted Workspace membership requirement is a proposed Advisor boundary; existing Learning authorization itself does not join Workspace membership.

Do not hold database locks across a slow provider request. Read/check in a short transaction, invoke the provider, then reauthorize and compare source fingerprints in a second short transaction.

**PROPOSAL — recheck points**

Recheck current authorization:

1. Before extraction.
2. Before provider dispatch.
3. After provider completion, before releasing results.
4. When results are redisplayed after navigation/resume.
5. Before submitting a proposal.
6. When displaying or submitting future durable source-backed suggestions.

Any denied evidence that contributed to a synthesized suggestion invalidates that suggestion. Removing its citation while retaining the synthesized text can still leak the source.

**Governance**

AI output remains temporary advice. Human adoption creates `proposed`; only the existing authorized human action creates `approved`.

Approved knowledge updates remain successors: the old Learning stays approved until the successor is approved, then is archived transactionally.

**Important existing limitation:** BW-36.18 intentionally allows human review and successor operations after source deletion. Source availability is not a universal approval prerequisite. Preserve that workflow and distinguish unavailable evidence from unavailable human governance.

---

**8. AI architecture, inference cost, and caching**

**CONFIRMED FACT**

The repository uses direct OpenAI Responses API calls rather than a universal provider abstraction.

- AI Brain uses `OPENAI_API_KEY` and `OPENAI_AI_BRAIN_MODEL`, defaulting to `gpt-4o-mini`, with a 25-second timeout.
- Node proposal provides a strict JSON-schema pattern.
- Strategy module generation uses `OPENAI_STRATEGY_MODULE_MODEL`.
- Founder Story, Brand DNA, and simulation have their own model overrides.
- Several older routes, including `review-node.js` and `generate-campaign.js`, accept client context without the newer signed-session/source authorization pattern.

Reuse provider request and structured-output patterns. Do not reuse a legacy route as the Advisor’s security boundary.

Current application Settings covers language, appearance, and social connections. I found no implemented project/Brand AI-consent policy, Advisor budget model, or shared AI job/cache/rate-limit subsystem. Deployment-specific configuration and provider account settings were not inspected.

| Approach | Cost/latency | Authorization/cache implications | Recommendation |
|---|---|---|---|
| Explicit user trigger | Predictable bounded calls; user waits for results | Consent and scope are clear; easiest freshness handling | MVP |
| Incremental after meaningful saved changes | Potentially many calls without debouncing and fingerprints | Requires saved-change detection, opt-in, invalidation, and distributed deduplication | Later |
| Scheduled/background | Recurring cost and queue latency | Must recheck authorization at execution time; consent and revocation need durable policy | Defer |
| Hybrid | Can reuse saved results and prompt users to refresh | Requires reliable suggestion storage and invalidation | Preferred later model |

**PROPOSAL — inexpensive initial operation**

- Deterministic gap checks and exact duplicates before inference.
- One model call per explicit run.
- Suggested initial budget: about 8,000 total input tokens and 2,000 output tokens, subject to evaluation.
- At most five useful suggestions.
- No automatic retries, semantic judge calls, embeddings, agent chains, or external retrieval.
- If the selected scope exceeds the budget, require a smaller selection or explicitly disclose incomplete coverage.
- Keep whole relevant threads together; truncating the decisive reply can reverse the interpretation.

**Cost formula**

For input tokens \(I\), output tokens \(O\), and current provider prices per million tokens \(P_i\), \(P_o\):

\[
C_{\text{run}} = (I P_i + O P_o) / 1{,}000{,}000
\]

For the proposed budget:

\[
C_{\text{run}} = 0.008P_i + 0.002P_o
\]

Multiply by actual runs, retries, and any additional calls. Verify current account pricing and model availability before approval; this audit does not claim current dollar prices.

**PROPOSAL — cache design**

A reusable result key should include:

- Actor and authorized scope
- Brand revision/content fingerprint
- Board association, exact timestamp, and relevant content fingerprint
- Included/excluded discussions
- Learning IDs/revisions/status fingerprint
- Extraction/prompt/schema version
- Model and response language

Learning changes need their own fingerprint: do not assume Brand revision changes whenever a Learning changes.

For MVP, retain results only in short-lived memory within the current authorized context. Reauthorize before reuse. Clear on account/Brand/Workspace changes and expiry.

A signed analysis receipt can bind scope, fingerprints, candidate digest, actor, and expiry without durable suggestion storage. It needs new server code and must not contain raw discussion text.

**RISK:** browser “busy” state and process-local caches do not enforce distributed rate limits across serverless instances. Broader rollout needs an enforceable shared quota mechanism or equivalent verified deployment control. Do not claim such protection already exists.

---

**9. Data model and migration assessment**

| Capability | Migration needed? | Assessment |
|---|---|---|
| Explicit extraction and temporary suggestions | No | New read/inference/UI functionality |
| Current-run multi-source evidence display | No | Can live in a bounded response with fresh checks |
| Human adoption with one primary Node and evidence summary | No, with stated limits | Reuse existing Learning source contract |
| Persistent pending AI suggestions across sessions | Yes, unless another suitable durable store is explicitly selected | No such suggestion store was found |
| Durable Profile field/comment/reply source references | Yes | Existing source columns cannot express these |
| Historical excerpts, hashes, source versions, and AI-run lineage | Yes | Existing evidence summary is plain text |
| Durable multi-source successor evidence | Yes | Current successor copies original immutable provenance |
| Approved-Learning consumption | Not inherently | Requires new selection/authorization/prompt logic; durable usage tracking may require storage |

**Migration-free boundary**

A temporary suggestion may show several sources. The existing Learning row cannot preserve that complete structured provenance.

A limited human-adoption path can retain:

- The human-reviewed statement.
- A minimized evidence summary.
- One primary Board/Node reference through BW-36.18.
- Existing proposer/reviewer/events.

It cannot claim to preserve:

- Exact contributing replies or Profile fields.
- Source content as analyzed.
- Source hashes or analysis versions.
- Immutable AI-origin/run metadata.
- Complete multi-source evidence.
- New evidence lineage for successors.

**PROPOSAL:** multi-source claims remain advisory in the migration-free MVP. Do not silently downgrade them into a supposedly complete single-Node provenance record.

Profile-only candidates can become an explicitly human-authored manual proposal, with the same disclosure about absent structured Profile provenance.

**Future additive model**

Consider:

- `brand_intelligence_runs`: authorized scope, actor, model/prompt version, source manifest hash, coverage, expiry.
- `brand_learning_suggestions`: candidate content, type, review disposition, duplicate grouping, related Learning.
- `brand_learning_evidence`: typed Profile/Node/thread/reply/Learning references, versions/hashes, minimized excerpts, classification, capture time, and relationship to suggestion/Learning.

These are conceptual names, not an implementation specification.

Keep Node/comment identifiers as text. Enforce owning Brand scope and verify every source independently. Preserve historical references without deletion cascades erasing evidence; current source presentation still requires authorization.

Append new migrations. Do not alter historical BW-36.17/R1/R2 files, rewrite historical verification baselines, or add incompatible fields to existing event snapshots.

---

**10. Major risks and mitigations**

| RISK | Mitigation |
|---|---|
| Prompt injection in comments/Nodes | Treat source material as untrusted data; no model tools or write privileges; strict output schema and server validation |
| Cross-Brand leakage | Server-derived association, one Brand scope, independent source authorization, actor/scope-bound results |
| Sensitive comments sent to provider | Explicit discussion inclusion; source preview/exclusion; bounded excerpts; omit email/avatar/token/document payloads |
| False consensus | Preserve speakers/dissent; resolution is workflow state; require human confirmation |
| AI text mistaken for human evidence | Preserve known generated markers; unknown origin remains unknown; generated repetition does not increase evidence strength |
| Unreliable authors and timestamps | Mark attribution limitations; do not synthesize historical dates from UI fallbacks |
| Edited or deleted evidence | Content fingerprints, exact Board freshness, source validation; no unsupported reconstruction claims |
| Reassociation/access revocation | Invalidate whole affected suggestions and deny release/promotion |
| Archived sources | Exclude explicitly inactive records when authoritative state exists; generic Canvas archive/tombstone semantics need separate design |
| False contradictions | Compare scope, time, snapshot revision, hypothesis versus policy before recommending conflict review |
| Duplicate flooding | Exact Learning protection plus bounded suggestion grouping; persistent suppression requires durable disposition |
| Multi-source provenance loss | Restrict promotion or add an explicit ledger |
| Source-backed successor misrepresentation | Current workflow inherits original origin; defer new evidence lineage or label the limitation clearly |
| Provider latency/429/failure | Timeout, bounded errors, retained UI state, explicit retry, no implicit retry loop |
| Transaction contention | Short transactions; preserve fail-closed lock contracts and explicit retries |
| Monolithic app integration | Additive module, exact DOM dependency tracing, no Canvas/Workspace/AI Brain rewrite |
| Unsafe logging | New Advisor logs only bounded operational metadata; no raw comments, prompts, provider responses, or sensitive identity fields |

**OPEN DECISION:** promotion makes a minimized summary reusable Brand knowledge. Users must understand that the adopted statement/evidence summary can remain governed Brand information even after its original Board becomes unavailable.

---

**11. Phased roadmap**

Estimates are engineering effort ranges for one experienced contributor, including focused tests/review; they are not delivery commitments.

| Phase | Scope | Dependencies | Complexity/estimate |
|---|---|---|---|
| **1 — BW-36.19** | Explicit Profile + one saved Board analysis; conversations; temporary evidence cards; limited single-Node adoption | Consent/provenance decisions, bounded contract, provider configuration | Medium–high; approximately 8–15 engineering days |
| **2 — durable evidence** | Suggestion inbox, typed multi-source evidence, persistent dismiss/grouping, successor evidence lineage | Approved additive schema/retention/security design | High; approximately 10–18 days |
| **3 — product surfaces** | Start Screen overview and Insights presentation of authorized stored results; source navigation | Stable engine and durable projection/invalidation | Medium–high; approximately 6–12 days |
| **4 — approved knowledge consumption** | One AI consumer first; approved-Learning selector, precedence, conflict exclusion, explanation | Stable governance and freshness rules | High; approximately 5–10 days for first consumer |
| **5 — opt-in incremental/hybrid** | Saved-change detection, queue, debounce, shared quotas, background authorization | Durable consent/jobs/results, operational controls | High; approximately 10–20 days |
| **6 — broader evidence** | Selected multi-Board synthesis and verified measurement integration | Reliable multi-source access model and measurement history | Separate scoped audit and estimate |

Start Screen can later display existing pending Learning counts without inference. A persistent inbox of unadopted AI suggestions requires Phase 2.

---

**12. Detailed recommended BW-36.19 scope**

**PROPOSAL — include**

- One active Brand and one explicitly selected saved associated Board.
- Authorized canonical Profile, relevant accepted modules, Board snapshot, allowlisted Nodes/edges.
- Explicitly included Post-its and reply conversations.
- Approved/proposed Learning context for comparison and duplicates.
- Deterministic gaps, explicit-decision candidates, corrections, Learning candidates, possible conflicts, and update recommendations.
- Up to five temporary suggestions, with verifiable evidence and visible coverage.
- One explicit bounded provider call.
- Current-access/freshness validation before result release and promotion.
- A signed short-lived analysis receipt.
- Human-edited single-Node proposal adoption into existing `proposed` governance.
- Manual Profile-only proposal handoff with clear provenance limits.
- EN/DE, accessible dialog behavior, narrow-layout support, stale/error recovery.

**Update recommendations**

Show the target approved Learning and suggested replacement. Reuse the established successor workflow after explicit human review.

The current successor inherits original provenance and cannot attach new structured evidence. In this MVP, the handoff must disclose that limitation. Claims needing a durable new evidence chain wait for Phase 2.

**PROPOSAL — exclude**

- Automatic generation on dashboard opening or Board saving.
- Background/scheduled processing.
- Automatic approval, Profile rewriting, or campaign snapshot refresh.
- Cross-Board analysis.
- Durable unadopted suggestion inbox.
- Complete multi-source promotion.
- New analytics retrieval or performance claims.
- Private document/image processing.
- AI Brain conversation ingestion.
- Approved-Learning consumption by existing providers.
- Large refactors or historical migration changes.

**Recommended implementation boundary**

Use one additive Advisor service/route and one frontend module. Reuse Learning service behavior where it fits; do not overload AI Brain’s existing working-Canvas contract to accept persisted comments.

Any AI-assisted promotion endpoint must independently validate the receipt and current sources and invoke the existing transaction/lifecycle rules. It must not trust client-supplied labels, actor, approval status, or source classification.

---

**13. Acceptance criteria and required regression tests**

These are proposed implementation gates. They were not executed as part of this read-only audit.

| Area | Required acceptance |
|---|---|
| No surprise inference | Dashboard/Profile/dialog open, typing, navigation, cancel, and Board save produce zero AI calls |
| Explicit scope | User sees receiving Brand, selected Board, discussion inclusion/exclusions, and provider disclosure |
| Persisted sources | Advisor uses authorized saved records; unsaved drafts are excluded or explicitly require separate saving |
| Access | Anonymous/public-token/disabled identity/Board-only/Workspace-only/Brand viewer generation attempts fail before inference |
| Context isolation | Account, Workspace, Brand, Board, or selection changes suppress obsolete responses |
| Revocation | Revocation before dispatch, during inference, before display, and before promotion prevents release/write |
| Conversation handling | AI roots, human replies to AI roots, questions, dissent, rejected ideas, resolution/reopen, missing timestamps, and unknown origin remain distinct |
| No invented consensus | Resolved thread, silence, or copied statements never automatically become team approval |
| Source validation | Unknown/duplicate references, nonexistent excerpts, malformed Nodes, and unsupported nesting fail safely |
| Freshness | Source edits/deletion/reassociation and Learning changes invalidate relevant results |
| Duplicates | Exact duplicates reuse existing 409 behavior; semantic grouping preserves distinct claims |
| Governance | Adoption creates only `proposed`; human approval is separate; archive/reject and successor rules remain intact |
| Provenance | Text Node IDs survive; event snapshots omit incompatible Node IDs; multi-source limitations are visible |
| Privacy | Provider payload excludes author email/avatar, tokens, hidden Boards, image bytes, and private documents |
| Limits/failures | Oversized context, invalid JSON, provider 429, timeout, and wrong-language output produce bounded recoverable states |
| UI stability | Advisor causes no Canvas/undo/activity/presence/autosave/snapshot mutations |
| Accessibility | Keyboard focus/Tab/Escape/dirty cancel, EN/DE, light/dark, and widths 1440/768/375/320 work |

**Existing suites to preserve and run during implementation**

- BW-36.17, R1, R2, and BW-36.18 Learning lifecycle/provenance checks.
- Board access roles and canonical Brand isolation.
- Workspace identity/catalog and Brand lifecycle/deletion.
- BW-36.16/R1 Canvas selection/view behavior.
- BW-33.4B1R1 conversation count; resolved Post-it and emoji-picker lifecycle tests.
- BW-26 AI Brain advice, bounded conversation memory, and controlled Node proposal checks.
- BW-28 Insights classification/rendering.
- Browser script integrity and relevant DOM dependency checks.
- Content review/publication, posting schedule, and export regressions if shared bindings are touched.

Use mocked provider transports and disposable local database fixtures for implementation tests. Add real PostgreSQL concurrency coverage for new lock ordering; PGlite alone is not a multi-process contention benchmark.

---

**14. Decisions requiring explicit approval**

No implementation should begin until these are settled.

| OPEN DECISION | Recommended choice |
|---|---|
| BW-36.19 product boundary | Explicit Profile + one saved Board, including opted-in discussions |
| Provenance versus migration | Migration-free temporary suggestions with restricted promotion; approve Phase 2 if complete durable evidence is required immediately |
| Generation roles | Brand owner/admin/editor only for MVP |
| Discussion authorization | Explicit inclusion, provider disclosure, source preview and exclusions |
| Adoption meaning | Human accepts responsibility for the minimized Brand-wide statement; no automatic approval |
| Profile-only promotion | Manual proposal handoff with disclosed absence of structured field provenance |
| Successor evidence | Existing inherited origin in MVP; new evidence lineage requires additive design |
| Model and budget | Reuse configured OpenAI architecture; confirm model, token limits, pricing, and rollout controls |
| Retention | Temporary results initially; separately approve durable excerpts, evidence, and deletion policy |
| Background analysis | Disabled; revisit only after durable consent, authorization, jobs, and quotas |
| Approved-Learning consumption | Separate later phase, one consumer first |
| Start Screen and Insights | Later presentation over reliable authorized results |
| Knowledge precedence | Define per consumer; approved Learnings remain supplemental and cannot silently override Profile or campaign snapshot |
| Decision confirmation | Human confirmation required; durable team-decision authority needs a separate model |

The recommended MVP is valuable without a migration **only if its provenance limits are accepted explicitly**. If BW-36.19 must preserve complete evidence through later review, revisions, deletion, and multi-source updates, an additive evidence migration is justified.

AI BRAND INTELLIGENCE AUDIT READY FOR REVIEW

[session]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_auth-session.js#L51
[identity]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_app-identity.js#L46
[brand-access]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_brand-access.js#L25
[board-access]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_board-access.js#L88
[catalog]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_workspace-catalog.js#L88
[brand-storage]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_brands-storage.js#L4
[board-storage]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_boards-storage.js#L48
[board-route]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/boards/%5Bid%5D.js#L144
[campaign]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_campaign-creation.js#L9
[learning]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_brand-learnings.js#L27
[source-route]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/brands/%5Bid%5D/learning-source.js#L1
[learning-ui]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/brand-learnings.js#L48
[profile]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/brand-profile-setup.js#L39
[canvas-proposal]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/canvas-learning-proposal.js#L1
[app]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/app.js
[brain-context]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_brand-brain-context.js#L64
[advice]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/ai-brain/advice.js#L59
[node-proposal]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/ai-brain/propose-node.js#L24
[diagnostics]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/_ai-brain-diagnostics.js#L5
[registry]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/knowledge-module-registry.js#L37
[dependencies]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/knowledge-module-dependency-engine.js#L238
[facebook]: https://github.com/Funklix/Funklix/blob/3ac1be9eb185787d38e608687608c26c0150ed0f/api/social-connector/facebook-engagement-service.js#L17
