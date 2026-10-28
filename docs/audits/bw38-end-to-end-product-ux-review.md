# BW-38 — End-to-end product and UX review

Date: 2026-10-28 (Europe/Berlin). Repository: `Funklix/Funklix`.
Audited commit: **`fb4721563095efbdfb0bfd9932de420c3475adc7`**, latest merged `main` including PR [#833](https://github.com/Funklix/Funklix/pull/833).
Scope: audit and documentation only. No application changes, migrations, provider calls, production writes, paid testing, merge or deployment were performed.

## A. Executive assessment

**Tendra One already has the main pieces of an AI Marketing Operating System. Its next product gain should come from finishing work across those pieces.** Rebuilding chat, Brand onboarding, campaign generation, native Social editing or image generation would duplicate substantial working functionality. Brand knowledge and approval boundaries are particularly valuable and should be preserved.

Three priorities emerge:

1. **Let users finish the remaining assets from one Brain answer.** A provider-free Chromium walkthrough produced two selectable posts, created the first, then found no Add to Canvas action for the second. Consumption is per turn, and creation also invalidates the captured Canvas context. Parsing both posts correctly does not complete the two-post journey.
2. **Make Brain's campaign context match the work the product can create.** Native `goal` is omitted; the server rejects that field if supplied. Advice accepts at most 200 nodes/400 edges, while the supported maximum Creator configuration produces 223 nodes. These are specific context/compatibility gaps, not proof that the model needs replacement.
3. **Preserve a deliberate decision and next step for returning teammates.** Boards, content, comments, owners and approved Learnings persist, but Brain conversations and handoff intents do not. A returner can recover assets without recovering why a direction was chosen. Start with explicit reuse of existing Board discussion/notes, not automatic transcript storage or turning every answer into a node.

These are product judgments about impact, not measured retention, conversion or time savings. The first two have reproducible implementation evidence; the third has verified storage behavior and an unmeasured user-value hypothesis. Start with priority 1 as one bounded implementation package (Section J).

There is also meaningful existing continuity: editable Brain-to-Creator briefing, protected Value Proposition staging, approved-Learning retrieval, save-only campaign retry, native Social conversion without extra inference, and current Home/Board navigation. Old audits proposing those features are historical, not evidence they remain absent. PR #833 already fixes loss of later provider text blocks and groups response actions after the answer; do not recommend that fix again.

### Method and evidence vocabulary

- **C — code verified:** current implementation read directly; function names below are search anchors at the audited commit.
- **T — automated evidence:** existing assertions inspected; actual BW-38 executions are distinguished in Section I.
- **B — browser fixture observed:** Chromium ran production shell/controllers with fictional data and intercepted transport. This is not a production or live-model test.
- **D — documented prior evidence:** implementation records or accepted historical reports; their scope/date remain attached.
- **H — UX hypothesis:** likely user consequence, requiring observation with real marketing users.
- **U — unknown:** deployment, live provider quality, real usage frequency or product policy not established here.

Architecture references: [product ownership](../constitution/product-architecture.md), [product intelligence blueprint](../product/product-intelligence-architecture.md), [repository delivery rules](../../AGENTS.md). Current code overrides the blueprint's older “future modules” list: collaboration, publishing subsets and learning workflows now exist.

## B. Current capability map

“Implemented and tested” below means the scoped code path has automated evidence; it does not certify production activation, provider credentials, live output quality or every possible journey. Discoverability is a separate assessment and can coexist with implementation.

| User capability | Current status | What users can accomplish; material boundary | Supporting owners/evidence |
|---|---|---|---|
| Workspace and project creation | Implemented and tested | Create the first Workspace; create a Board with an existing or new authorized Brand using the project command. Creation/replay/reconciliation are already owned workflows. | `api/projects.js`, `api/_project-command.js`, `workspace-catalog.js`; [lifecycle implementation](../implementations/bw36-13r3-authoritative-project-creation.md), `check:bw36.13r4` |
| Guided reusable Brand Profile | Implemented and tested | Edit Brand basics, audience, voice, offers/proof and assets; review website suggestions; explicitly save. Current Profile includes Overview, DNA, Avatar, Learnings, team and Campaign Sync sections. | `brand-profile-setup.js` `SECTIONS`, `readiness`, session `save`; [guided setup](../implementations/bw36-13r4-guided-brand-profile-setup.md). The early six-section record is not the whole current UI. |
| Brand DNA and Avatar | Implemented and tested; optional to useful first campaign | Generate/review DNA, explicitly save acceptance, generate/review/save Avatar. Founder Story preflight can recommend more context; continuation with available information exists. Missing optional identity assets need not block campaign work. | Profile `requestDna`, `generateDna`, `acceptDna`, `generateAvatar`, `acceptAvatar`; `brand-dna-generation-preflight.js`; protected-write tests |
| Campaign Brand Snapshot | Implemented and tested; conceptually demanding | Board keeps its campaign snapshot/provenance independently of current canonical Profile. Explicit compare/update boundaries exist. Saving Profile does not silently rewrite an existing Board. | `app.js` authoritative snapshot loader and `brandBoardNavigationContext`; Profile Campaign Sync; [context consistency](../implementations/bw36-21a-r2-3-brand-board-context-consistency.md) |
| AI Brain conversation | Implemented and tested | Board-aware EN/DE advice, five conversation modes, current working Canvas/selection, bounded follow-ups, safe formatted answers and optional supplied-Learning disclosure. Board edit is required even for advice. | `requestAiBrainAdvice`, `renderAiBrain`, `api/ai-brain/advice.js`; BW-26, BW-37 suites |
| Conversation continuity | Partially implemented | Same-tab navigation, drafts, caret, scroll and disclosures survive legitimate rerenders. Provider history is bounded to four exchanges/28,000 characters. Reload/Board lifecycle invalidation clears the transcript; there is no durable conversation recovery. | `aiBrainConversationHistory`, `invalidateAiBrainRequest`, `serializeState`; [workspace lifecycle](../implementations/bw37-1a-r1-ai-brain-workspace.md); B probe |
| Campaign ideation → Creator V3 | Implemented and tested | A qualifying single concept opens the existing two-step editable Creator with idea/context/channel initialization; no inference until Generate. Full V3 generation, quality/repair and transactional persistence already exist. | `aiBrainCampaignBrief`, `openAiBrainCampaign`, `openStableCampaignCreation`, `campaign-creation-dialog.js`, `campaign-v3.js`; [handoff](../implementations/bw37-1c-2b-ai-brain-campaign-handoff.md) |
| Content production | Implemented and tested | Choose an exact answer asset, deliberately prepare Content through one source-only conversion call, edit title/body, explicitly create a native Draft, continue in Inspector/Content Workspace. Native editing, review and save remain their existing owners. | `aiBrainContentAssets`, `requestAiBrainNodeProposal`, `applyAiBrainNodeProposal`, `content-workspace.js`; [Content handoff](../implementations/bw37-1c-3b-content-eligibility-editable-preview.md) |
| Social draft production | Implemented and tested for one selected asset; multi-asset journey partial | Exact Instagram/X and other supported platform sources can become native Social Media Posting nodes; fields are editable. Social Prepare extracts labels without provider inference. Creating one asset consumes the whole turn's proposal path. | `ai-brain-social-proposal.js`, native `createNode`, `fillInspector`; [Social contract](../implementations/bw37-1c-3c1-social-media-posting-handoff.md); B probe |
| Image prompts and generation | Implemented native UI/provider path; direct Brain prompt-field transfer not integrated; live execution unverified | Content has editable `imagePrompt`, format, images and explicit Generate image/Full Pack actions. Brain Content conversion supplies title/body, not `imagePrompt`. Existing generation can use the prompt or content fallback. | `fillInspector`, `updateInspectorActionVisibility`, `generateImageForNode`, `generateFullContentPack`, `api/generate-image.js`; no real image call made in this audit |
| Social visual continuation | Available but more difficult to discover (H) | Posting visual generation expects a connected parent Content node with an image. Brain-created Social nodes are roots with no edges/images, so users must organize/connect existing material themselves. | `createNode`, `getParentContentNode`, `generatePostingVisualForNode`; C |
| Content review, planning, publishing | Implemented subsets; not universal publishing | Editorial transitions, approval material and internal calendar planning exist. Live connector adapters are LinkedIn and Facebook with bounded supported payloads. Instagram/X drafting or an internal schedule does not imply provider delivery. | `content-workspace.js`; `api/social-connector/adapter-registry.js` `defaultRegistry`; posting-schedule services; D publishing audits |
| Canvas organization/collaboration | Implemented and tested | Native nodes/edges, Inspector, adaptive view/list, post-its/comments, reactions, responsibilities, private/public sharing and Board save/load. Brain-created asset is a root Draft with no assignment, schedule or approval. Undo exists; there is no equivalent redo UI in the reviewed path. | `createNode`, `serializeState`, `campaign-responsibilities.js`, Board access/persistence; BW-30/33/36 tests |
| Insights | Implemented deterministic diagnostics and navigation | Current findings have scope/methodology, Canvas reveal and explicit Ask AI Brain prefill. Measured-performance panel remains unavailable; do not mistake heuristic readiness for results. | `buildInsightsFindings`, `renderInsightsSurface`, `askAiBrainAboutFinding`; BW-28 tests |
| Approved Brand Learnings | Implemented and tested with independent authorization | Manual/source/AI proposals, review, approval, successor/archive and provenance exist. Advice retrieves relevant approved whole statements with capacity accounting and freshness checks. Approval is not empirical proof. | `api/_brand-learnings.js`, `canvas-learning-advisor.js`, `api/_ai-brain-learning-context.js`; [Advice integration](../implementations/bw36-20-approved-brand-learning-ai-brain-integration.md) |
| Performance → automatic improvement loop | Partially implemented / broader loop planned only | Facebook engagement retrieval exists separately; general verified campaign analytics and automatic outcome-to-Brand optimization are not established by current Insights. Human approval remains required. | `readFacebookEngagement`, `api/social-publishing/facebook/engagement.js`, Insights empty measured panel; C/U |
| Durable strategic decision recovery | Existing notes/comments available; integrated Brain decision handoff not implemented | Users can record rationale manually in existing collaboration surfaces. Brain does not persist a selected decision/next-step handoff for teammates. Full automatic organizational memory remains a blueprint aspiration. | Brain ephemeral state versus persisted nodes/post-its/activity; C/H |

**Implemented but not integrated is narrower than absent:** Brain does not map a visual instruction directly into the existing image-prompt field; general Insights does not consume all separately available engagement data; existing Board discussion does not receive a deliberate Brain decision handoff. These gaps do not justify new image infrastructure, another analytics dashboard or a second discussion store.

## C. Six user journey evaluations

### A — Founder creates a Brand and first campaign

- **Start / goal:** Home or an empty Workspace; establish enough Brand context and produce an editable first campaign.
- **Actual steps (C/T):** create/select Workspace → Create project → select existing Brand or start a new Brand → atomic Brand/Board command → guided Profile for a new Brand → enter manually or explicitly analyze website → review/save → optionally review/save DNA and Avatar → Continue to the captured project → Create campaign → edit briefing, choose structure/channels → Generate → quality/repair → confirmed save → Reveal on the same Board.
- **Successful outcome:** durable associated Board and reusable Profile, campaign snapshot/provenance, editable V3 assets and edges. The 2-variation × 3-post fixture persists 13 nodes/17 edges and reloads them.
- **Unnecessary interactions / missing context:** the number of stages may delay first value (H), but DNA/Avatar are not mandatory setup gates. More concretely, project creation snapshots Brand before later Profile completion; Profile save is deliberately independent. Generation reads separately authorized canonical context as well as the saved snapshot, so it is false to conclude it has no updated Brand context. The founder still must understand which source future workflows use.
- **Confusing UI:** readiness measures field coverage, not marketing quality. Profile sections, the Board snapshot and campaign generation each have distinct confirmation states; presenting all as “Brand complete” would mislead (H).
- **Risks / blockers:** missing catalog/association, insufficient independent roles, dirty/saving Board, revision conflicts, website failure, missing credentials or provider failure. Existing manual entry, optional-asset deferral and save-only retry should remain.
- **Verified support:** Profile session/readiness and project command owners; `resolveCampaignCreationContext`; [guided setup](../implementations/bw36-13r4-guided-brand-profile-setup.md), [V3 restoration](../implementations/bw36-14r1-restore-complete-campaign-v3.md), [generation boundary](../implementations/bw37-1c-2a-campaign-generation-boundary.md); `check:bw36.13r4`, `check:bw36.14r1`. U: actual founder completion/time-to-value and deployed provider quality.

### B — Manager brainstorms, briefs and transfers to Creator

- **Start / goal:** AI Brain on a saved editable associated Board; turn a discussed campaign direction into generated assets without rewriting the brief.
- **Actual steps (C/T/B):** ask/iterate → qualifying successful answer exposes Create Campaign → fresh authorized source checks → native Creator opens with editable campaign idea/additional context and supported channel hint → edit → continue to structure → explicit Generate → existing V3 save/reveal lifecycle.
- **Successful outcome:** the existing Creator owns generation and persistence; Brain has not created a parallel campaign system. Cancel returns to conversation, draft and reading position.
- **Unnecessary interactions / missing context:** supported handoff already avoids manual copying. Only selected current-answer paragraphs transfer; earlier negotiated criteria outside those paragraphs may require restating or adding to Additional context. This is a bounded deliberate policy, not a missing whole-transcript import. Native `goal` is absent from Brain context, so the manager may have to repeat a saved objective (C/H).
- **Confusing UI:** action eligibility is format/content dependent and conservative. Users may not distinguish “no qualifying single brief” from “missing permissions/changed source” when the action is absent (H). General strategy and multiple alternatives should remain advice until a direction is selected.
- **Risks / blockers:** dirty Board; hidden Brand association; catalog/saved revision change; conservative EN/DE grammar and field bounds; live semantic quality unknown. Board edit alone cannot authorize hidden canonical information.
- **Verified support:** `aiBrainCampaignBrief`, `aiBrainCampaignSourceCurrent`, `revalidateAiBrainCampaignSource`, `openStableCampaignCreation`; [handoff record](../implementations/bw37-1c-2b-ai-brain-campaign-handoff.md); `check:bw37.1c2b` actual shell/Creator/transaction regression. Do not rebuild this bridge.

### C — Social manager requests Instagram and X posts

- **Start / goal:** Brain on an editable Board; create and edit **both** native posts from one answer.
- **Actual steps (C/T/B):** ask for two posts → complete answer → Add to Canvas → select one exact source card → destination recommends Social Media Posting → explicit Prepare extracts labelled platform/caption/CTA/hashtags without inference → edit → Create → fresh content-scope read → one native Draft → Canvas selects it and opens Social Inspector.
- **Successful outcome today:** one selected post renders, edits, saves and reloads through native Social fields. #833 preserves all assistant output blocks; truly missing model output is not fabricated.
- **Observed break:** fictional Northstar Studio answer starts with **2 candidates / 0 nodes**. After creating Instagram: **1 node / 2 still-extractable candidates / proposal.status=`applied` / 0 Add actions**. Returning to Brain retains the answer but cannot choose X through the normal handoff. `aiBrainContentSourceCurrent` also returns false because Canvas/selection changed. The browser reported no page errors. This is not an unsupported-heading hypothesis.
- **Unnecessary interactions / missing context:** copying X manually or asking again is a workaround (H; no user cost measured). Repeat inference is not required to extract the existing second post. The existing Social tests reload between independent asset cases; they do not establish two sequential creations from one successful answer.
- **Confusing UI:** the answer appears reusable while its action is consumed as a whole. Native X/Instagram draft support does not mean those platforms have publishing adapters. Root Social nodes have no parent image for posting-visual continuation.
- **Risks / blockers:** ambiguous/missing platform or required caption, source/permission change, partial insertion, stale save; existing validation/duplicate recovery must survive any fix.
- **Verified support:** `renderAiBrainTranscript` eligibility; `requestAiBrainNodeProposal`, `applyAiBrainNodeProposal`, `completeAiBrainNodeCreation`, `createNode`; `ai-brain-social-proposal.js`; `check:bw37.1c3c1` plus Section I's new audit probe.

### D — Content marketer develops an article or visual idea

- **Start / goal:** Brain discussion; create usable Content, then continue through existing content/image tools.
- **Actual steps (C/T):** ask for a concrete draft/concept → select exact asset → choose Content → explicit Prepare (one disclosed source-only conversion call) → edit title/body → Create → native Content Inspector → edit body, image prompt/format or upload → deliberately Generate image/Full Pack as needed → save/review in existing Content Workspace.
- **Successful outcome:** editable native Content rather than text stranded in chat; existing image generation, upload, favorites and approval workflows remain available.
- **Unnecessary interactions / missing context:** a finished article still passes through Content conversion; whether exact-copy transfer is preferable needs intent/quality evidence. It should not be called waste in every case because preparation can structure a concept. An explicit image direction is not transferred into `imagePrompt`; the user may copy it into that field. `generateImageForNode` falls back to `content` when prompt is empty, so missing prompt mapping is not absence of image capability.
- **Confusing UI:** Add to Canvas → Content preparation → Inspector → image action spans several surfaces (H). “Content” and “Social” are distinct native contracts; storing a Social caption only in Content would lose its dedicated editing semantics.
- **Risks / blockers:** conversion bounds/errors, lost source freshness, unsafe text, incompatible content language; actual image quality/provider/storage unknown. The legacy `api/generate-image.js` accepts client `brandBrainData` and has no handler-level signed-session/Board ACL check; it must not inherit the stronger Brain/Creator authorization claim. Deployment-wide controls were not inspected. A generated image request is a separate deliberate operation, not part of Create node.
- **Verified support:** `createNode` initializer maps Content title/content and defaults `imagePrompt` empty; `fillInspector`, `updateInspectorActionVisibility`, `generateImageForNode`, `generateFullContentPack`; [Content record](../implementations/bw37-1c-3b-content-eligibility-editable-preview.md); Content browser suite and Content Workspace recovery suite. Image-provider execution was not performed.

### E — Strategist reviews Canvas and updates positioning

- **Start / goal:** existing Board, Insights or Brain; reason about strategy and deliberately change shared Brand positioning.
- **Actual steps (C/T/B):** inspect current Canvas/selected node, optionally Ask AI Brain from a current Insight (prefill only) → discuss → request a proposed replacement Value Proposition → eligible answer offers Suggest Brand Update → authorized current-value/source preview → edit → Use in Profile draft → destination-owned staging → separate protected Profile Save → optional explicit campaign snapshot compare/update.
- **Successful outcome:** one reviewed canonical Value Proposition change through the existing command/revision/history boundary, without silently rewriting Board context or other knowledge.
- **Unnecessary interactions / missing context:** two confirmations have different purposes and are not redundant. Broader positioning, ICP, tone or multi-field strategy changes are not covered by this narrow handoff and may need manual editing. Do not present Value Proposition-only support as a general Brand-update assistant.
- **Confusing UI:** an unlabeled useful answer can lack the action; “Brand positioning” in ordinary speech is broader than `/brand_core/valueProposition` (H). Current canonical truth and campaign snapshot may intentionally differ.
- **Risks / blockers:** independent canonical edit required; changed baseline/revision, busy/dirty Profile, pending generated suggestions or revoked membership reject staging/save. Brand viewers and Board-only editors must not receive edit rights from Board access.
- **Verified support:** `aiBrainValueProposition`, `openAiBrainBrandProposal`, Profile `stageValueProposition`, `api/_brand-knowledge-write.js`; [Profile handoff](../implementations/bw37-1c1-brand-profile-value-proposition.md), [natural-answer/lifecycle corrections](../implementations/bw37-1c1r2-end-to-end-handoff.md); `check:bw37.1c1`, `check:bw36.23a`.

### F — Returning teammate understands and continues an existing Board

- **Start / goal:** Home/Boards/direct URL after an earlier session; understand current work and decisions without reconstructing them.
- **Actual steps (C/T/B):** open authorized saved Board → hydrate native content/snapshot/access → adopt independently visible Board Brand for navigation → Home continuation/status or Canvas/list → inspect comments, responsibilities/status and nodes → continue editing; open Brain for current-context advice if needed.
- **Successful outcome:** saved content, relationships, ownership and discussion survive; Home routes to existing work rather than generating a new project. Brand Y selection cannot silently retarget Board X.
- **Observed limit:** reloading the audit fixture leaves zero Brain messages. `serializeState` contains nodes, edges, counters, zoom, activity and metadata, not Brain transcript/source intents. Board switching/invalidation also resets Brain. Saved assets therefore do not guarantee saved strategic rationale.
- **Unnecessary interactions / missing context:** a teammate may have to ask the original author, reread comments or repeat a Brain discussion (H). Existing notes can already hold decisions, so the gap is a convenient explicit bridge and findable next step, not absence of collaboration/storage.
- **Confusing UI:** Home continuation describes saved Board recency/current state, not a personal last-read checkpoint or a confirmed decision summary. Activity/status does not establish why an option was rejected.
- **Risks / blockers:** stale/denied catalog or Board, unsaved local work, independent permissions, source unavailable after deletion. A summary must not expose another user's private chat or promote discussion to approved Brand knowledge.
- **Verified support:** `home-foundation.js`, `brandBoardNavigationContext`, `invalidateAiBrainRequest`, `serializeState`, Board loader; [context consistency](../implementations/bw36-21a-r2-3-brand-board-context-consistency.md), [Home signals](../implementations/bw36-22b3-living-signals-and-contextual-onboarding.md); navigation tests and reload probe. U: how often users already record rationale successfully.

## D. Product intelligence assessment

| Intelligence dimension | Verified support | Remaining implication / uncertainty |
|---|---|---|
| Brand DNA, voice and personality | Advice's `advisorPersonality` uses approved DNA communication styles/voice and saved top-level tone. Independently accessible canonical identity takes precedence; absent approval does not revive stale snapshot DNA. | This is a bounded style projection, not proof every saved raw Core field is approved or every answer expresses the voice well. Live voice quality is U. |
| Approved knowledge | `_ai-brain-learning-context.js` scans authorized approved statements, ranks lexical relevance, deduplicates and packs whole statements. It does not inherit access from Workspace/Board alone. | EN/DE lexical matching may miss synonyms/cross-language meaning. First evaluate offline examples; embeddings are not justified solely by their availability. |
| Canvas evidence | Browser projects native text/social/landing fields; server validates graph and builds a selected-node/neighborhood evidence index. Index is bounded to 24 nodes/32,000 characters; full validated working Canvas remains separate. | Omitted index entries are not omitted raw nodes. Conversely browser-omitted `goal`, image prompt, comments and some rich native structures cannot be recovered by the index. No image pixels are analyzed by Advice. |
| Campaign context | Saved snapshot, optional current canonical identity, selected node, nodes/edges and mode reach Advice. Creator gets a bounded editable concept/brief. | A Board can hold multiple campaign roots; Brain receives whole projected Canvas, not a selected campaign contract. Native objective omission and large-Board rejection reduce specificity. |
| Advice quality | Policies require exact evidence, uncertainty, source conflicts, no invented metrics, distinct options and context-specific next steps. | Mocked output proves composition/lifecycle, not strategic correctness, actual claim grounding, personality or model obedience. No measured quality lift is claimed. |
| Conversation reference | Four successful exchanges/28,000 characters; ordered references use history; recognized unresolved references return a clarification without a provider call. | Long discussions and reloads lose decisions. A visible long transcript does not mean every earlier turn reached the provider. Clarification asks for information the user may already have entered. |
| Action eligibility | Deterministic bounded EN/DE rules distinguish individual assets, campaign concepts and Value Proposition wording; Preview/Prepare/Create/Save remain explicit. | Conservative false negatives and absent-action ambiguity are possible. One accepted asset currently consumes the whole turn. Neither eligibility nor source text is proof of truth or server authority. |
| Freshness and authorization | Advice captures/revalidates before and after inference; proposals/Create, Creator and Profile have their own consequential-boundary checks. Board Brand association is persisted authority. | Checks are not continuous revocation and cannot retract dispatched context. Remote save races and ephemeral intent remain. Do not weaken these checks to solve a convenience problem. |
| Recommendations → outputs | Content/Social, Creator and Profile routes already yield native editable destinations. Insights can prefill Brain; Learnings use a separate human review lifecycle. | Multi-asset completion and durable decision continuation are the missing end-to-end links. Abstract strategy need not become a Canvas object. |

**Information users repeat despite existing authorization:** native node goals omitted from Brain projection; earlier agreed criteria outside the selected current-answer brief; visual instructions not routed into the existing prompt field; second post copied/regenerated after first creation; unrecorded strategic choices after reload. The first is an actual payload omission; the others combine verified transfer/storage limits with H about user workarounds. Information hidden by independent Brand or Board permissions is not “known context” the product may simply reuse.

## E. UX and information architecture findings

| Finding | Current implementation and assessment | Practical priority |
|---|---|---|
| First useful outcome | Guided creation, Profile review/manual fallback, optional DNA/Avatar and original-project continuation already exist. Home has canonical readiness guidance. | Test a short founder session; improve the next relevant action rather than adding another onboarding wizard. H about duration. |
| Workspace / Brand / Board | Hierarchy and mismatch notices are implemented; catalog visibility and Board association are separate. | Explain actual receiving Board/Brand at handoffs. Preserve neutral hidden-association copy; never infer a hidden Brand name. |
| Brain layout and scrolling | Current workspace has bounded readable answer width, bottom composer, transcript anchoring, Jump to latest, draft/caret and disclosure retention. #833 moves actions below the full response. | Leave this working layout alone. Long-answer action discovery may still need user observation; do not repeat old nested-scroll recommendations as an open defect. |
| Contextual action placement | Campaign/Profile actions are separate. If all three qualify, Add to Canvas sits in More actions. Source cards and exact-source disclosure are already compact. | Explain scope/remaining assets after an action. Do not expose every registered type or show actionable controls to unauthorized users. |
| Dialogs/editing | Native modal focus/Escape and explicit review/Prepare/Create/Save boundaries are covered in current fixture tests. | Preserve distinctions between preparation, local insertion and confirmed save. Fewer clicks alone is not a sufficient reason to remove review. |
| Canvas / Inspector | Created nodes are selected/revealed in the matching native Inspector. Content image controls are type-dependent; Social has its own caption/CTA/hashtags. | Route to the existing next editor/action; avoid another editor in Brain. Visual continuation for root Social needs explanation, not automatic parent/image invention. |
| Density / small screens / themes | Existing suites cover 320/375/desktop, Light/Dark, focus, wrapping and several reflow cases. Scoped tokens and current modal scroll exist. | No broad visual rewrite justified. Fixture checks do not replace real devices, native zoom or screen-reader review. |
| Empty/loading/success/error | Current loading, failed/retry, language, stale context, missing permissions, empty Insights and save-retry states exist. | Distinguish created locally from saved; make source-consumed versus unavailable more understandable without leaking access information. |
| Evidence wording | `buildInsightsFindings` can describe absent fields as absent campaign intent/proof; top-level `cta` is not part of its Social missing-CTA test. Brain policy already warns against this inference. | Improve field-specific diagnostic wording/counterevidence before adding scores or more analytics cards (opportunity 7). |
| Discoverability | Existing Content image tools, internal planning versus publishing, and narrow Brand-update eligibility require understanding. | Add contextual destination-specific guidance. Actual discoverability severity is H, not a click-rate measurement. |

## F. Workflow duplication and friction

1. **One answer, several assets, one consumed action.** Source selection supports multiple cards, but proposal state/consumption is turn-wide. Fix this continuity before adding batch generation or new destinations. The source and scope must remain independently checked.
2. **Reasoning about already-saved goals.** Native `goal` exists in Inspector, generation/strategy helpers and persistence but not Brain projection/server allowlist. Asking the user for it again is avoidable when authorized. Do not send unrelated private metadata to compensate.
3. **Creator output beyond Advice input.** Creator's verified maximum 10 × 20 configuration has 223 nodes; `_ai-brain-canvas-context.js` rejects 201+. Whole-Board transmission also mixes independent campaigns. Preserve bounds and introduce explicit relevant scope/coverage rather than silently dropping nodes or removing limits.
4. **Content conversion after finished prose.** One extra inference is explicitly disclosed for Content; Social already avoids it. An exact-copy Content option may be useful for clearly complete drafts, but a blanket removal would change concept-to-content behavior. Validate intent before building it (opportunity 8).
5. **Visual instruction routing.** Existing Content prompt/image tools can continue a visual idea. Missing direct prompt mapping is a small destination-field problem; Visual Concept/Image Brief registry membership does not justify new adapters or another image generator.
6. **Brand advice versus canonical truth.** Value Proposition staging and separate Save already work. General strategy, content copy, campaign brief and approved Learning have different owners. Do not apply “create node” or “save learning” to every recommendation.
7. **Return-to-work rationale.** Board state, comments and responsibilities persist; Brain's rationale may not. Reuse explicit Board discussion/notes and existing navigation before designing a new decision database or storing all private conversations.
8. **Planning versus external execution.** Calendar date/status, editorial approval and provider publish eligibility are distinct. Five draft platform options do not imply five publish connectors. Avoid another scheduler until the existing labels/readiness explain the current capability.

## G. Prioritized Top 3 improvements

Scores use **Impact / Confidence / Effort, each 1–5**. Higher Impact/Confidence is better; higher Effort is more work. The illustrative score is `Impact × Confidence ÷ Effort`. These are reviewer estimates, not measured outcomes or delivery promises; ranking also considers direct blockage and dependencies.

| Rank | Improvement | I / C / E | Illustrative score |
|---|---|---|---:|
| 1 | Complete remaining source assets after the first creation | 5 / 5 / 3 | 8.3 |
| 2 | Match Brain context to saved objectives and supported campaign size | 5 / 4 / 4 | 5.0 |
| 3 | Explicit decision/next-step continuity for returning teammates | 4 / 3 / 4 | 3.0 |

### 1. Complete remaining assets from the same successful answer

- **Exact problem:** after creating Instagram, the manager cannot use the still-present X candidate through Add to Canvas. Per-turn `applied` state and exact whole-Canvas source binding each obstruct continuation.
- **Evidence:** Journey C's B probe, `renderAiBrainTranscript`, `aiBrainContentSourceCurrent`, `applyAiBrainNodeProposal`; existing Social regression reloads between source cases. #833's output completeness fix is already present.
- **Proposed behavior:** retain immutable exact candidate spans and completed-item identity; show created destination and remaining items. Allow deliberate selection/review/creation of an unconsumed asset on the same Board. Establish a new narrowly authorized continuation only for the known successful creation transition; never automatically make arbitrary stale sources current. No batch auto-create or extra Advice call.
- **Expected benefit:** finish the requested pair without copying/reasking; preserve edits and clear progress. This benefit is H until observed, although the blocker is verified.
- **Complexity / regression risk:** medium / medium-high. Consumption, partial insertion, exact source identity, node selection and saved revisions interact.
- **Dependencies:** existing native Content/Social owners, scope read/authorization, history/save lifecycle. No new model, schema, migration or durable transcript required. If safe continuation cannot fit these owners, report the exact conflict before widening scope.
- **Acceptance:** same answer → Instagram edit/Create → return → X edit/Create; exactly two distinct native Drafts with isolated fields/sources. Double-click/retry/partial insertion cannot duplicate either. No inference for Social preparation/continuation. Preserve source edits, account/Board/load/catalog/association changes, unrelated Canvas mutations, remote revocation and save-conflict rejection. Test both before and after confirmed autosave, failed save and undo; same-tab state does not promise cross-reload idempotency. Content path and Campaign/Profile routes remain independently correct.
- **Why first:** directly blocks a requested core workflow using already-generated output; fixes ownership/lifecycle, whereas more parsers, types, themes or providers would leave it broken.

### 2. Supply useful campaign objectives and explicit bounded scope to Brain

- **Exact problem:** saved native objectives are unavailable to Advice; a supported large Creator result cannot be discussed through whole-Board Advice. Multiple campaign roots also obscure which initiative is being evaluated.
- **Evidence:** `aiBrainCanvasProjection` omits `goal`; server `NODE_KEYS` rejects it; evidence policy says native goal is not supplied. Validator probe accepts 200 nodes, rejects 201/223 with 413. [V3 restoration](../implementations/bw36-14r1-restore-complete-campaign-v3.md) and its boundary tests establish 223 supported nodes. No live frequency claim.
- **Proposed behavior:** include bounded authorized native goals with provenance; let the user choose Board versus an existing campaign/selected neighborhood when size requires it. Show scope, exclusions and saved/unsaved status before Send; retain independent canonical access and output/freshness guarantees. A campaign boundary must be derived from reviewed topology/selection rules, not silently guessed from the first Idea. Do not merely raise limits without capacity analysis.
- **Expected benefit:** more relevant advice and fewer repeated objectives; large campaigns remain usable within honest bounds. Semantic quality improvement is unmeasured.
- **Complexity / regression risk:** medium-high / high; browser/server schema, evidence, token budget, graph closure, selection and source invalidation must agree.
- **Dependencies:** validate actual native goal semantics; product choice for multi-root/shared-node scope; current Canvas transport and whole-message capacity accounting. No need to change canonical knowledge or inference count.
- **Acceptance:** saved/native goal reaches the actual mocked provider once, with exact node provenance; missing goal stays unknown. Supported maximum campaign can use an explicit bounded scope or clear recoverable choice without data loss. Cross-scope edges/selected nodes are coherent, exclusions disclosed, no hidden canonical data, stale context rejected and no automatic provider retry. Retain 200/400/byte bounds unless separately justified by measured transport/token tests.
- **Why above alternatives:** fixes input truth and compatibility across B/D/E/F; adding stronger prompt language or personality cannot recover omitted facts or a rejected request.

### 3. Record a chosen decision and next step through existing Board collaboration

- **Exact problem:** returners recover assets/status but can lose agreed direction, rejected alternatives and the next step when Brain clears.
- **Evidence:** `state.aiBrain` is ephemeral; `invalidateAiBrainRequest` resets messages; Canvas serialization omits it; B reload probe. Existing persisted comments/post-its/activity/responsibilities are counterevidence to “no memory.”
- **Proposed behavior:** an explicit user action records edited decision/rationale/next step in an existing authorized Board discussion/note associated with relevant work, then links back to it from continuation. Human authorship and source scope are visible. Do not save every answer, automatically label it Brand truth, or expose private chats to teammates.
- **Expected benefit:** resume work without rediscovering rationale; assess with returning teammates rather than asserting retention gains.
- **Complexity / regression risk:** medium-high / medium-high; choose existing note/discussion destination, sharing/audience and meaningful continuation routing.
- **Dependencies:** product decision on team-visible versus private intent and note location. Use existing collaboration persistence if adequate; audit separately before inventing a new Decision entity. New schemas are not authorized by this audit.
- **Acceptance:** explicit preview/edit/cancel makes no write until confirm; one recorded note is readable after reload by authorized teammates, identifies author/relevant Board and a next action, preserves normal discussion edits and permission revocation, and cannot modify Profile/Learnings. Returners can find it without asking AI again; evaluate that task in user observation.
- **Why third:** supports repeated team use across journeys; less certain than the first two and dependent on sharing policy. A full transcript store or autonomous organizational memory is a larger, less justified alternative.

## H. Secondary opportunities and deferrals

Exactly five additional opportunities follow. Estimates use the same judgment scale; these are below the Top 3. Some quick changes may ship separately while the larger priorities are designed.

| Rank | Opportunity | I / C / E | Score |
|---|---|---|---:|
| 4 | Clarify first-campaign source and optional setup | 3 / 4 / 3 | 4.0 |
| 5 | Route visual instructions into existing Content tools | 3 / 3 / 2 | 4.5 |
| 6 | Distinguish draft, plan, approval and actual publish support | 3 / 4 / 2 | 6.0 |
| 7 | Make diagnostic wording match field evidence/applicability | 3 / 4 / 2 | 6.0 |
| 8 | Evaluate exact-copy Content preparation for finished drafts | 2 / 2 / 3 | 1.3 |

The arithmetic alone does not determine rank: 4/5 need observation and source decisions; 6/7 are useful bounded improvements but do not restore the blocked creation/return journeys.

### 4. First-campaign source clarity

- **Problem/evidence:** a new project's snapshot precedes Profile setup; later canonical save does not update the Board implicitly. Creator reads both authorized sources. Profile `readiness` counts coverage and optional DNA/Avatar; it does not measure campaign quality (C).
- **Behavior/benefit:** at Continue/Create, explain current Profile versus saved campaign snapshot and route to the existing compare/update only when relevant. Offer immediate campaign work without requiring cosmetic identity completeness. Founder knows what context will be used (H).
- **Complexity/risk/dependencies:** medium / medium; existing source/provenance, Profile continuation and Creator entry; observe first-use confusion before changing step order.
- **Acceptance:** new/existing Brand, absent optional assets, conflicting sources, viewer and hidden canonical cases all have honest labels; no silent snapshot write, new provider call or duplicate project. No quality claim from readiness.
- **Ranking reason:** improves trust in existing onboarding; below creation/context blockers because a functioning path already exists.

### 5. Continue a visual idea in the existing image-prompt field

- **Problem/evidence:** Brain Content initializer has title/body only; native Content `imagePrompt` starts empty, while Inspector/Generate image already exist. Social posting visual requires an image-bearing Content parent (C).
- **Behavior/benefit:** a deliberate reviewable route can place an explicitly selected visual instruction into the existing Content prompt field or focus that editor. Never reinterpret arbitrary strategy as a visual prompt or generate/attach an image automatically. Avoid recopying a clearly supplied direction (H).
- **Complexity/risk/dependencies:** low-medium / medium; determine exact-source mapping and valid destination, preserve existing prompt/format; image generation remains separately explicit. The legacy image endpoint is not covered by the hardened Creator/Advice boundary; independently review its current authorization before broadening generation entry points.
- **Acceptance:** exact reviewed prompt survives native save/reload and remains editable; opening/canceling/routing makes zero inference/image calls; existing body/prompt not overwritten silently; root Social guidance explains prerequisites without inventing parent/edge/image.
- **Ranking reason:** reuses current value; higher than new visual node adapters, lower than the three broad continuity fixes.

### 6. Explain draft/planning/publishing capability at the action

- **Problem/evidence:** native platform list includes Instagram/X/TikTok; default live connector registry registers LinkedIn/Facebook only. Editorial readiness, internal schedule and provider payload support are different contracts (C).
- **Behavior/benefit:** destination-specific copy distinguishes “create draft,” “plan internally,” and supported external publication; safe specific readiness reason near the existing action. Users can choose the correct next step without inferring unavailable delivery (H).
- **Complexity/risk/dependencies:** low-medium / low for copy, medium for policy changes; current content primary-action/connector readiness owners, translation and authorization.
- **Acceptance:** unsupported external platforms never appear externally scheduled/published; existing LinkedIn/Facebook checks and payload limits remain authoritative; missing/denied destination information is not fabricated; EN/DE/keyboard/mobile fit.
- **Ranking reason:** high-confidence quick clarification; expanding publishers requires credentials, provider policy and ongoing operations and should wait.

### 7. Separate absent diagnostic fields from strategic conclusions

- **Problem/evidence:** `buildInsightsFindings` derives Social missing CTA from preview/social.cta, omitting native top-level `cta`; trust/funnel wording can imply a campaign requirement from structure. Advice's evidence policy already documents counterevidence and applicability (C).
- **Behavior/benefit:** say which field/rule was checked, consider current supplied CTA evidence, and label strategic relevance as a question/hypothesis. Preserve existing reveal and Brain-prefill actions. Users review useful evidence rather than fixing false certainty (H).
- **Complexity/risk/dependencies:** low-medium / medium; pure diagnostic evidence/affected-node mapping, current Insight identity, translations. No score redesign required.
- **Acceptance:** top-level CTA, CTA in copy, no Landing Page, intentional audience segments and single-channel campaigns do not yield universal absence/necessity claims; deterministic observations remain reproducible, no fabricated proof/metrics, no automatic edits/calls.
- **Ranking reason:** improves trust quickly; below context completeness because better wording alone does not supply objectives or fix scale.

### 8. Evaluate a deliberate exact-copy path for finished Content

- **Problem/evidence:** Content Prepare always invokes its existing source-only conversion, even when a selected answer is already a complete draft. Social demonstrates deterministic conversion is possible for a narrow native contract, but Content concepts need different treatment (C/H).
- **Behavior/benefit:** first observe whether users want exact text preservation versus expansion. If validated, offer a clear exact-copy preparation alongside the existing explicit AI-assisted conversion, with editable title/body and separate Create. Avoid another inference for an unchanged finished draft (unmeasured).
- **Complexity/risk/dependencies:** medium / medium; define finished-copy intent without an automatic paid classifier; native Content bounds, language and current source/scope checks.
- **Acceptance:** one exact selected source, no inter-asset mixing/truncation; opening/editing/cancel/Create has no provider call; existing concept transformation stays available and disclosed; no new types or auto-nodes.
- **Ranking reason:** weakest demonstrated demand; do not delete a useful conversion merely because a deterministic implementation is easy.

### Quick UX changes with low regression risk

Within 6/7, start with accurate localized text: internal calendar planning versus delivery; checked field versus inferred strategic gap. Within 4, label readiness as coverage and DNA/Avatar as optional to campaign continuation. Reuse existing status/disclosure/heading components and native focus handling. Low risk applies to bounded presentation changes, not changes to approval, publishing policy or source freshness. Verify long EN/DE labels, 320/375/desktop, both themes and keyboard with the affected existing fixtures; do not schedule a global redesign.

### Defer larger investments

- Full durable transcript/search/automatic decision extraction: sharing, retention and authority are unresolved; explicit Board notes should be evaluated first.
- Autonomous publishing, new Instagram/X/TikTok connectors or generalized multi-provider automation: much larger operational scope than accurate current routing.
- Semantic/vector knowledge retrieval: first collect approved offline EN/DE recall failures against existing lexical retrieval; no evidence here establishes a need for an architecture replacement.
- General analytics/attribution and automatic performance-to-Brand learning: require verified measurement sources; Facebook engagement does not establish a complete cross-channel loop.
- New Visual Concept/Image Brief Brain adapters, new image generation infrastructure, multi-field autonomous Brand editing, and a global application-shell rewrite: none is justified solely by registry availability or prior roadmap order.

### Explicitly leave existing functionality alone

Keep the native Content/Social editors and node contracts; existing Content conversion as an option; campaign V3 quality/repair/transaction/save-only retry; editable Brain-to-Creator bridge; Value Proposition staging/separate protected Save; independent Brand/Board ACL and persisted association; approved-Learning lifecycle/freshness; safe inert answer/source rendering; #833 output assembly/footer actions; current scroll/composer/focus preservation; manual onboarding and optional DNA/Avatar. Do not silently refresh campaign snapshots, promote chat into Brand truth, auto-create every answer or replace working owners with another “universal AI action” layer.

## I. Evidence and uncertainty register

### Audited source integrity

The supplied checkout was `7ddcd8f6b2c5bf1e134f3d93169d2985e71c8986` (merged #832), not latest main. Ordinary Git fetch failed because executor proxy port 8080 was unreachable. GitHub connector confirmed #833 merged and `main` at `fb4721563095efbdfb0bfd9932de420c3475adc7`; compare showed only its nine changed files/two commits. An isolated inspection worktree applied that exact patch. **All nine local Git blob hashes were compared to GitHub `fetch_file` SHAs at the audited commit and matched**, including `app.js`, Advice, fixtures and the new reliability test. Other tracked files come from the common ancestor. This local materialization is inspection scaffolding, not implementation changes for the PR. Delivery branches from the real remote main and adds this document only.

### BW-38 verification performed

All application transports were doubles or intercepted local requests; no paid/provider request or production application write occurred. PGlite tests use disposable SQL state, not a production migration. Chromium initially failed in the restricted sandbox (`setsockopt: Operation not permitted`, SIGTRAP). Applicable browser checks were then rerun with approved execution permissions; initial partial runs are not counted as passes.

| Check / evidence | Actual result and meaning |
|---|---|
| `check:bw37.1c3c1r1` | PASS on rerun: actual Advice handler with mocked multi-block/multi-message provider envelopes; production browser source/cards/footer/focus/theme/width cases. No live model completeness claim. |
| `check:bw37.1c3c1` | PASS on rerun: actual Social handler/scope/ACL fixtures and native browser fields/edit/create/history/save/reload. One selected asset per independently reset case. |
| `check:bw37.1c3b` | PASS on rerun: Content eligibility, scope and real-shell editable creation/recovery. |
| `check:bw37.1c2b` | PASS on rerun: current Brain concept transfer, real Creator/V3 fixture lifecycle and transactional/retry cases. |
| `check:bw37.1c1` | PASS on rerun: deterministic Value Proposition selection, actual Profile/protected-write owners and real-shell lifecycle. |
| `check:bw37.1br1` | PASS on rerun: approved personality composition and conversation/proposal lifecycle; mocked answer quality only. |
| `check:bw37.1ar1` | PASS on rerun: real-shell transcript anchors, composer, Jump, context invalidation, keyboard, narrow widths and both themes. |
| `check:bw36.14r1` | PASS on rerun: real V3 browser/transaction path, 13-node/17-edge persistence, repair/retry/reconciliation and supported boundary structures. |
| `check:bw36.21ar2.3` | PASS on rerun: 30 context/navigation groups, independently visible Brand adoption and Board X/selected Brand Y boundaries. |
| `check:bw36.22b3` | PASS: seven current Home signal/readiness/routing and responsive browser groups. |
| `check:bw30.1` | PASS: App Shell/Inspector runtime-transition contracts. |
| `check:bw31.5.1` | PASS: Content Workspace resolution, review/planning wiring and recovery contracts; not image-provider execution. |
| `check:bw36.13r4` | PASS: source/DOM/adapted-server guided Profile/return checks. This check itself explicitly does not claim visual acceptance. |
| `check:bw28.1` | PASS: 39 Insights/handoff contracts and 48-script integrity; not a live analytics test. |
| `check:bw26.3` | PASS: bounded ephemeral conversation/history contracts. |
| `check:bw36.23a` | PASS: 15 protected-write contract/controller groups; separate real PostgreSQL invariants are not part of that command. |
| `node scripts/check-bw36-20-approved-learning-ai-brain.js` | PASS: actual Advice/Board/Brand/Learning owners on disposable PGlite, three-stage freshness, ranking/token packing and one mocked provider call; production disclosure DOM/CSS in local Chromium. |
| New audit scratch probe, Journey C/F | PASS as a reproduction of the current limitation: fictional two-post answer, actual production shell/controllers, one explicit native Social insertion, return to Brain yields no remaining Add action; reload gives zero Brain messages. No shipped test/application edits. |
| Actual Canvas validator scratch probe | 200 synthetic nodes accepted; 201/223 rejected with `canvas_too_large`/413; native `goal` key rejected with `unsupported_canvas`/400. A large generated campaign was not sent to a live model. |

The table records all completed targeted suite runs. Final document checks are recorded in the PR validation summary; do not infer a full Runtime Boot Safety/PostgreSQL matrix run from this targeted audit. No new application regression tests were written for this documentation-only change. The next implementation must add lasting sequential-asset coverage; scratch reproduction is not a replacement.

### Direct source and test index

These links resolve to the reviewed repository files; function names identify the relevant boundaries without relying on line numbers from older audits.

| Evidence area | Current source / test |
|---|---|
| Brain context, source eligibility, item creation, Inspector and serialization | [app.js](../../app.js): `aiBrainCanvasProjection`, `aiBrainContentAssets`, `aiBrainContentSourceCurrent`, `renderAiBrainTranscript`, `applyAiBrainNodeProposal`, `createNode`, `fillInspector`, `serializeState` |
| Advice capacity, independent authorization, complete output and personality | [Advice handler](../../api/ai-brain/advice.js), [Canvas allowlist/limits](../../api/_ai-brain-canvas-context.js), [evidence index](../../api/_ai-brain-evidence.js), [personality](../../api/_ai-brain-personality.js), [conversation bounds](../../api/_ai-brain-conversation.js) |
| Social source extraction and single-asset native regression | [Social mapper](../../ai-brain-social-proposal.js), [handler regression](../../scripts/check-bw37-1c-3c1-social-handoff.js), [browser regression](../../scripts/check-bw37-1c-3c1-social-browser.js), [#833 regression](../../scripts/check-bw37-1c-3c1-r1-reliability.js) |
| Content/Creator/Profile destinations | [Content browser regression](../../scripts/check-bw37-1c-3b-content-browser.js), [Creator dialog](../../campaign-creation-dialog.js), [Campaign handoff regression](../../scripts/check-bw37-1c-2b-ai-brain-campaign-handoff.js), [Profile session](../../brand-profile-setup.js), [Profile handoff regression](../../scripts/check-bw37-1c1-brand-profile-proposal.js) |
| Knowledge and native image capability | [Learning context](../../api/_ai-brain-learning-context.js), [Learning service](../../api/_brand-learnings.js), [image endpoint](../../api/generate-image.js), [native Content Workspace](../../content-workspace.js) |
| Supported Creator boundary and external publish subset | [V3 boundary regression](../../scripts/check-bw36-14r1-restore-complete-campaign-v3.js), [default adapter registry](../../api/social-connector/adapter-registry.js), [Home continuation](../../home-foundation.js) |

### Prior evidence versus present observation

- [#833 reliability record](../implementations/bw37-1c-3c1-r1-reliability.md) explains deterministic provider assembly loss and explicitly leaves attribution of the latest reported live incident unknown. Its prior complete Appics fixture is not the latest live provider envelope.
- [Profile correction record](../implementations/bw37-1c1r2-end-to-end-handoff.md) contains exact supplied answer replays and lifecycle reproductions. A user-supplied answer is useful format evidence, not a newly performed production session here.
- [Guided setup](../implementations/bw36-13r4-guided-brand-profile-setup.md), [Creator restoration](../implementations/bw36-14r1-restore-complete-campaign-v3.md), [Learning integration](../implementations/bw36-20-approved-brand-learning-ai-brain-integration.md), [Brain workspace](../implementations/bw37-1a-r1-ai-brain-workspace.md) and [Home signals](../implementations/bw36-22b3-living-signals-and-contextual-onboarding.md) document earlier local fixtures and screenshots. Their manual live acceptance checklists remain checklists, not evidence they were executed.
- Historical [lifecycle audit](./bw36-13-end-to-end-workspace-brand-board-lifecycle-audit.md) and [publishing audit](./bw34-1-4-social-publishing-end-to-end-audit.md) include accepted user observations. Subsequent implementation supersedes many defects; they are not automatically current incidents. Current connector registry and content owners were reread.
- [BW-26 audit](./bw26-ai-brain-preimplementation-audit.md), [BW-28 audit](./2026-08-31-bw28-ai-insights-analytics-architecture-audit.md), [BW-37 strategic audit](./bw37-ai-brain-2-strategic-advisor-audit.md) and [contextual actions audit](./bw37-1c3-contextual-canvas-actions-audit.md) were used as historical intent, then checked against current implementation. In particular their old missing-handoff/security findings are not reissued as unfixed here.

### Unknowns and unresolved product decisions

| Unknown / decision | What would resolve it; implication |
|---|---|
| Live strategic usefulness, specificity, voice, hallucinated claims | Authorized representative EN/DE answers with human review, source context and deployed build identity. Mocked providers cannot establish quality or prompt-injection resistance. No paid evaluation performed. |
| Frequency/impact of multi-asset blockage and large Boards | Observe social managers completing two posts and inspect authorized aggregate size/use patterns; no telemetry or incidence estimate invented. |
| First-session friction and action discoverability | Observe founders completing a first useful campaign and managers finding existing image/publishing/Brand actions. Measure task completion and confusion, not aesthetic preference. |
| Multi-asset continuation policy | Recommended: explicit next-asset action, one native insertion per confirmation, item-level progress, safe scope transition tied only to known own creation. Decide undo/recreate and failed-save continuation behavior before implementation; arbitrary stale-source rebasing is excluded. |
| Campaign scope for large/multi-root Boards | Decide user-selectable boundary and treatment of shared nodes before changing context transport. Never silently choose the first Idea or call partial context complete. |
| Shared decision versus private conversation | Decide record audience, destination note/thread, author/edit semantics and continuation placement. Explicit existing Board discussion is the initial recommendation; private transcript retention is separate. |
| Brand update breadth | Current handoff covers Value Proposition only. Broader positioning/ICP/voice changes require a separately reviewed product scope, not generic automatic field application. |
| Legacy image-route authorization | Handler inspection shows no local signed-session/Board ACL gate and client-supplied Brand context; no deployment-wide middleware/control was verified. Independent endpoint authorization review is required before expanding image generation exposure. This is not evidence of a production exploit or reason to rebuild image generation. |
| Production activation, database role enforcement and provider readiness | Authorized operator evidence under the existing protection runbook and real application configuration. Repository code/fixtures and merged status are not deployment proof. |
| Accessibility beyond fixture checks | Human assistive-technology review, actual mobile devices and native browser zoom; automated keyboard/reflow results have narrower scope. |

## J. Recommended next implementation package

**BW-38.1 — Complete sequential native assets from one AI Brain answer.** Fix the demonstrated Journey C boundary first; leave the other recommendations as later product decisions. The package must preserve independent authorization, exact source identity and existing native ownership. It is not authorized by the documentation PR itself; the following is the requested copyable prompt for a subsequent task.

```text
TENDRA ONE — BW-38.1: Complete Sequential Native Assets from One AI Brain Answer

Repository: Funklix/Funklix. Start from latest merged main, including PR #833
or later. Record the exact base SHA. Audit baseline is
fb4721563095efbdfb0bfd9932de420c3475adc7.

Read AGENTS.md, docs/constitution/product-architecture.md,
docs/product/product-intelligence-architecture.md and the complete
docs/audits/bw38-end-to-end-product-ux-review.md first. Read current Content
eligibility/compact-source, native Social and #833 reliability implementation
records, current Profile/Campaign handoff records and their actual tests.
Reverify current code; do not resurrect fixed historical defects.

DELIVERY
Dedicated branch; commit and push; exactly one normal non-draft documentation
and implementation PR against main. Verify draft:false and return the real URL.
Never merge or deploy. Report BLOCKED if required delivery is technically
impossible; do not invent a URL or call an undelivered change READY.

OBJECTIVE
From one successful answer with independent Instagram and X source candidates,
a user can select/review/edit/create Instagram, return to Brain and deliberately
select/review/edit/create X without reasking Advice, copying text manually or
creating duplicate nodes. One Create confirmation still creates one native
Draft. Abstract strategy can remain conversation. No batch auto-create.

REPRODUCE BEFORE CHANGING
Use fictional disposable data and intercepted browser transport. Submit one
answer with two valid native post candidates. Observe 2 candidates/0 nodes;
create the first and return to Brain. At the audit baseline there is 1 node,
2 extractable candidates, proposal.status applied and no Add action. Also
check aiBrainContentSourceCurrent: creation changes Canvas/selection, so merely
resetting proposal.status cannot safely restore the second action. Existing
Social tests reload between independently selected source cases and therefore
do not cover this uninterrupted sequence. Add lasting failing regression
coverage of the real production controllers/native Canvas owners.

OWNERS TO INSPECT
app.js: aiBrainContentAssets, captureAiBrainContentSource,
aiBrainContentLocalContext, aiBrainContentSourceCurrent, source capture after
Advice, openAiBrainContentReview, renderAiBrainContentSource,
renderAiBrainTranscript, requestAiBrainNodeProposal, applyAiBrainNodeProposal,
completeAiBrainNodeCreation, invalidateAiBrainRequest, createNode,
pushHistorySnapshot, markUnsaved, serializeState, autosave and Board save/load.
ai-brain-social-proposal.js; api/ai-brain/propose-node.js;
api/ai-brain/content-scope.js; api/_ai-brain-proposal-scope.js;
existing Board ACL/identity/Workspace/association/revision owners.
Read current native Content/Social Inspector, insertion failure, save conflict,
undo and source cancellation behavior. Do not substitute canned canEdit:true
for real server authorization evidence.

REQUIRED BEHAVIOR
1. Preserve immutable exact answer/candidate spans and stable per-source-item
   consumption/progress within the existing ephemeral Brain owner. Do not mix
   title, caption, CTA, hashtags, edits or rationale between source items.
   Existing shortened display previews remain separate from exact source.
2. After successful first creation, identify the created destination and offer
   explicit continuation for remaining unconsumed candidates. Preserve matching
   source selection, destination recommendation, edit preview and explicit
   Prepare/Create. A completed item must not accidentally create again.
3. Design a narrow, verified continuation across this known own-creation
   transition. Preserve independent server authorization and the original exact
   source/account/Board/load/Workspace/association identity. Do not remove stale
   checks, silently recapture all current state, treat browser hashes as access
   authority or rebase an arbitrary old answer. Explicitly account for own node
   insertion/selection and confirmed autosave revision separately from unrelated
   local edits, remote revision changes, scope changes and revocation. If existing
   owners cannot support that distinction safely, report the concrete conflict
   before expanding persistence/API/security scope.
4. Keep one native node per explicit Create with existing history, dirty/autosave,
   reveal/Inspector and Board persistence owners. Preserve duplicate protection
   through double clicks, partial insertion and lost/failed save behavior.
   Define undo behavior explicitly: recommended initial policy keeps a consumed
   source marked completed and never silently makes undo a recreate request.
   A deliberate recreate, if needed, requires separate reviewed scope.
5. Social Prepare stays deterministic with zero provider calls. Continuation,
   selection, opening, editing, cancel and Create cause no inference. Content
   retains its existing disclosed one conversion call per explicit preparation.
   Do not add Advice retries, classification/repair calls or schema/model changes.
6. Preserve ordinary same-context transcript, composer draft/caret, mode,
   disclosure, scroll and modal focus/Escape return. Account/Board invalidation
   must clear protected pending work. Completion UI distinguishes local insertion
   from confirmed server save and does not promise cross-reload provenance.
7. Keep Campaign Creator and protected Brand Profile actions independently
   eligible and destination-owned. Do not auto-update Profile, Learnings, campaign
   snapshots, schedules, approvals, owners, images, parents or edges.

ACCEPTANCE / TESTS
Actual uninterrupted real-shell test: one fictional answer, two cards,
Instagram selected/edited/prepared/created, Canvas Inspector, return to Brain,
X selected/edited/prepared/created, exactly two native Drafts with disjoint exact
sources and isolated fields. Assert native save/reload content, one creation
history event per node and no extra inference. Cover completion before/after
autosave, pending/failing save, manual save, conflict and remote edits; do not
weaken server-authoritative persistence or invent save success.
Cover cancel/back, card switching, duplicate clicks, pre-insertion failure,
partial insertion, permission/source changes during awaits, source-answer edit,
same-email replacement account, Board/load/Workspace/catalog/association changes,
unrelated local Canvas changes and remote revocation. No unauthorized continuation.
Cover consumed-item/undo policy, and absence of cross-reload guarantees.
Retain existing single-asset Content and Social behavior, native field bounds,
ambiguous platform handling, exact source isolation, hostile text/inert rendering,
no implicit images/approval/schedule, and Campaign/Profile handoffs.
Run focused existing BW-37 Social/#833/Content/Campaign/Profile/Advisor/workspace,
applicable BW-26/28/36 lifecycle/knowledge, syntax/script-integrity and required
repository CI. Use provider-free disposable fixtures. Verify EN/DE, Light/Dark,
320/375/desktop, keyboard/Escape/focus and long conversation return. Report actual
passes and blocked/skipped cases; a partial browser run is not a suite pass.

EXCLUSIONS
No new node types, visual adapters, batch generation, autonomous actions, image
generation, publishing, provider/model changes, paid testing, production writes,
new database schema/migrations, durable transcript/provenance, architecture
rewrite, generic AI action framework, global ACL/save redesign, merge or deploy.
Do not implement audit priorities 2/3 or secondary opportunities in this package.

REPORT
Real non-draft PR URL, exact base/head, demonstrated before/after sequence,
per-item consumption and safe continuation design, exact changed files, actual
test/CI results, remaining races/limits and unresolved product decisions.
```

BW-38 END-TO-END PRODUCT UX REVIEW READY FOR REVIEW
