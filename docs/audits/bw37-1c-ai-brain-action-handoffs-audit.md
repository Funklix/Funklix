# BW-37.1C — AI Brain Action Handoffs Product & Architecture Audit

- **Repository:** `Funklix/Funklix`.
- **Audited main:** `ef7618477b9f31c9f192d4564a620639cb093c44`, including merged PR #820; tree `355f507f8d5e1bf6f146c5ae561be290fa12fe64`.
- **Audit date:** 2026-10-26 (Europe/Berlin).
- **Status:** Documentation-only proposal for review. No implementation, persistence, deployment or roadmap commitment is authorized by this document.
- **Method:** Current source inspection, existing-test inspection and provider-free probes. GitHub confirmed main and #820 merge metadata. The starting checkout was #819; #820 changes were retrieved through the connected GitHub tools because local Git transport could not reach its proxy. The reconstructed local tree matches the exact remote main tree above, and the signed main commit object matches its SHA.

## A. Executive summary

Every useful AI interaction should offer an appropriate route toward a decision, campaign, content asset, task or approved Brand knowledge **when its actual output and the user's permissions support that route**. A useful answer is not permission to persist it. AI Brain advises and prepares proposals; destination owners validate and save only after explicit human approval.

Current main already supports Advice → one Content-node proposal → read-only preview → explicit local Canvas creation. It does not implement a general action dispatcher, Brain → Creator briefing, Brain → Profile proposal, Brain → Learning proposal, new-task creation or durable decision storage. Existing Creator, Profile, Learning and responsibility workflows offer different degrees of reuse; their authorization and persistence contracts are not interchangeable.

The missing Appics CTA is **plausibly an eligibility false negative**, but the exact live case cannot be adjudicated. The actual predicate requires particular EN/DE labels, and does not accept `Campaign concept` or `Kampagnenkonzept` as an asset label. A concrete `#MyAppicsStory` campaign concept can therefore fail despite having audience, message and purpose. The hashtag alone does not qualify it for a Content node or a complete campaign. No full answer, runtime permissions, proposal state or deployment SHA was supplied. Section B separates a reproducible label limitation from this unresolved live diagnosis.

**Recommend first: BW-37.1C-1, Brain → Brand Profile value-proposition proposal only.** For a response that explicitly proposes replacement value-proposition wording, let an independently authorized Brand editor review current versus proposed text, edit it and deliberately place it in the existing Profile draft. Saving remains a separate Profile action using its protected write contract. No inference, new endpoint, new persistence object or automatic canonical write is needed. Restrict the first package to `/brand_core/valueProposition`; do not import arbitrary response text into Brand truth.

Brain → Campaign Creator is high value and has a strong existing two-step UI and transactional commit. However, its live generation endpoint accepts client context without a session/Board check and omits explicit `store:false`. These are source findings, not claims about deployed infrastructure or observed exploitation. Expanding access through Brain should wait for a separately scoped generation-boundary hardening package. The Content proposal endpoint also omits explicit `store:false` and lacks Advice's server pre/post-inference revalidation. Do not describe all existing handoffs as already satisfying Advice's safeguards.

This selection values verified safe reuse over action count. Existing Content preparation stays available under its current conservative gate; broadening it or introducing six workflows in one PR is not the MVP.

## B. Current implementation inventory with source references

All source anchors refer to the audited SHA. Function names identify exact implementation points; older audit line numbers are historical.

### Evidence register and owner boundaries

| Ref | Current files and inspected functions/contracts | Boundary and existing tests |
|---|---|---|
| S1 | [app.js](../../app.js): `AI_BRAIN_MODES`, `aiBrainIdentity`, `aiBrainRequestContextIdentity`, `aiBrainCanvasProjection`, `aiBrainConversationHistory`, `invalidateAiBrainRequest`, `requestAiBrainAdvice`, `renderAiBrain`, `renderAiBrainTranscript`, `bindAiBrainScroll` | Authenticated Board editors; account/Board/load generation, selected node, edit capability and exact projected Canvas guard pending replies. Five modes are lenses, not output types. Transcript/mode/draft/scroll live in browser memory, not a durable conversation service. Tests: [BW-37.1A](../../scripts/check-bw37-1a-strategic-advisor.js), [workspace](../../scripts/check-bw37-1a-r1-workspace.js), [R1 advisor](../../scripts/check-bw37-1b-r1-conversational-advisor.js). |
| S2 | [Advice](../../api/ai-brain/advice.js): `handler`, `providerMessages`; [Learning context](../../api/_ai-brain-learning-context.js): `scope`, `capture`, `revalidate`, `prepare`; [evidence](../../api/_ai-brain-evidence.js): `prepareEvidence`; [personality](../../api/_ai-brain-personality.js): `advisorPersonality` | Signed session; explicit Board ownership projection; independently authorized canonical Brand via persisted `board.brand_id`; approved-only Learnings behind active identity and Brand ACL; boundary revalidation; full-message token budget; one ordinary Advice inference, `store:false`, 25-second timeout. Clarification can use zero calls. Tests: [answer quality](../../scripts/check-bw37-1b-strategic-answer-quality.js), [Learning integration](../../scripts/check-bw36-20-approved-learning-ai-brain.js), [Board authorization](../../scripts/check-bw36-20r0-ai-brain-board-authorization.js). |
| S3 | [app.js](../../app.js): `aiBrainHasReusableContent`, `canUseAiBrainProposal`, `requestAiBrainNodeProposal`, `validateAiBrainNodeProposal`, `applyAiBrainNodeProposal`, `completeAiBrainNodeCreation`; [propose-node](../../api/ai-brain/propose-node.js): `handler`, `proposalMessages`, `PROPOSAL_SCHEMA`; [proposal validator](../../api/_ai-brain-node-proposal.js): `createProposal` | Separate explicit provider request; authenticated Board edit check; exact Content-only schema; untrusted source answer; preview/cancel; explicit local creation with duplicate guard, history and dirty state, then normal Canvas persistence. Preview is currently read-only, not editable. Proposal transport has the privacy/freshness gaps below. Tests: [BW-26.6](../../scripts/check-bw26-6-controlled-ai-brain-node-creation.js), [failure](../../scripts/check-bw26-6-1-node-proposal-production-failure.js), [transition](../../scripts/check-bw26-6-2-node-creation-ui-transition.js), S1 R1 advisor. |
| S4 | [app.js](../../app.js): `resolveCampaignCreationContext`, `campaignCreationIdentity`, `openStableCampaignCreation`, `startCampaignV3Creation`, `runCampaignV3AICompatibility`, `fetchGeneratedCampaignPlan`, `createCampaignV3RealCanvasAdapter`, `openCreatedCampaign`; [dialog](../../campaign-creation-dialog.js): `mount`; [V3](../../campaign-v3.js): `buildCampaignV3PlanFromNodes`, `validateCampaignV3EdgeReferences`, `layoutCampaignV3Plan`, `commitCampaignV3PlanToCanvas` | Existing Creator uses editable idea/context followed by counts/channel/LP/email setup and explicit Generate. Generation, normalization, quality/repair and Canvas adaptation precede confirmed commit. The dialog has no initial-briefing input today. Tests: [stable creation](../../scripts/check-bw36-14-stable-campaign-creation.js), [complete V3](../../scripts/check-bw36-14r1-restore-complete-campaign-v3.js). |
| S5 | [campaign contract](../../campaign-creation.js): `request`, `campaign`, `validate`, `createBoundary`; [campaign API](../../api/campaigns.js): `createHandler`; [commit service](../../api/_campaign-creation.js): `execute`; [generation API](../../api/generate-campaign.js): `handler` | Commit verifies session/active identity, Board edit, accepted Workspace membership, persisted Board/Brand/Workspace association, revision and complete funnel/edges; appends validated new assets preserving existing Board content and snapshot. Exact replay is recoverable. This is distinct from generation API authorization. `generate-campaign.js` calls Responses with client `brandBrainData`, no `getSessionUser`/`getBoardAccess` and no explicit `store:false`. Do not inherit commit guarantees backward into inference. |
| S6 | [Profile](../../brand-profile-setup.js): `FIELDS`, `createSession`, `save`, `canonicalMutation`, `verifyBrand`, `reload`, `rebaseDraft`, `leaveDialog`; [app.js](../../app.js): `openRegularBrandProfile`, `renderGuidedBrandProfile`, `retainPendingBrandProfile`, `guardBrandProfileLeave`, `reconcileConfirmedBrand` | Profile owns canonical draft/save; scopes session to account/Brand/Workspace/generation; retains newer edits and failed-save drafts; verifies authoritative read after save. Existing `proposals`/`applyProposal` are website suggestion workflows and can persist immediately; they are not a general Brain staging API. Tests: [guided Profile](../../scripts/check-bw36-13r4-guided-brand-profile-setup.js), [entry](../../scripts/check-bw36-13r4r1-brand-profile-entry-and-workspace-actions.js), [conflict recovery](../../scripts/check-bw36-22b2r1-canonical-conflict-reload.js), S7. |
| S7 | [write contract](../../brand-write-contract.js): `command`, `diff`, `normalize`, `apply`, `submit`; [Brand API](../../api/brands/[id].js): `handler`; [write preview](../../api/brands/[id]/write-preview.js); [protected service](../../api/_brand-knowledge-write.js): `write`, `verifyReview` | `canonical-brand-write/v1`; exact expected revision and old field values, mutation identity, typed operation, optional signed destructive review, database protection/history and replay. Runtime must use existing restricted write functions, not raw Brand SQL or whole-Core replacement. Tests: [knowledge protection](../../scripts/check-bw36-23-brand-knowledge-protection.js), [browser](../../scripts/check-bw36-23-brand-knowledge-browser.js), [PostgreSQL](../../scripts/check-bw36-23-brand-knowledge-postgres.js), [runtime restrictions](../../scripts/check-bw36-23a-r3-runtime-postgres.js). |
| S8 | [Profile](../../brand-profile-setup.js): `FIELDS`, `readiness`, `generateDna`, `acceptDna`, `generateAvatar`, `acceptAvatar`, module controls; [generation access](../../api/_brand-generation-access.js): `resolveGenerationBrand`; [Brand formatter](../../api/_brand-brain-context.js): `buildBrandBrainContext` | Native value proposition, Personas, tone, messaging and custom modules are distinct. Founder Story is a `customTiles` module with `moduleType: founder_story`; audiences/ICP can be modules, not a universal flat field. DNA uses `brandDNA.userApproved`; generated DNA/Avatar require separate acceptance. Advice uses raw authorized Core plus its own personality projection, not the generation formatter. Tests: [Founder/DNA context](../../scripts/check-founder-story-brand-dna-context.js), [archetype lifecycle](../../scripts/check-founder-story-archetype-lifecycle.js), S7. |
| S9 | [Learning UI](../../brand-learnings.js): `create`, review dialogs; [Learning service](../../api/_brand-learnings.js): `inputRequest`, `authorize`, `validateSource`, `duplicates`, `mutate`, `operate`; [API](../../api/brands/[id]/learnings.js); [advisor](../../api/_learning-advisor.js): `checkReceipt`, `adopt`, `adoptSelected`; [advisor UI](../../learning-advisor.js) | Proposed → approve/reject → archive/supersede with events and revisions; active identity and independent canonical Brand write ACL. Source is a verified persisted Board/node/revision, not caller-supplied provenance labels. Batch adoption creates **proposed** rows; it is not batch approval. Receipt is tied to advisor scope/candidates/freshness. Tests: [governed Learnings](../../scripts/check-bw36-17-governed-brand-learnings.js), [provenance](../../scripts/check-bw36-18-governed-learning-provenance.js), [advisor](../../scripts/check-bw36-19-ai-learning-advisor.js), [output](../../scripts/check-bw36-19r4-learning-advisor-output-reliability.js). |
| S10 | [responsibility UI](../../campaign-responsibilities.js): `structure`, `candidates`, `mount`; [app.js](../../app.js): `assignCampaignResponsibilities`, `openCampaignResponsibilities`; [service](../../api/_campaign-responsibilities.js): `assignablePeople`, `saveResponsibilities`; [Board API](../../api/boards/[id].js) | Toolbar says Tasks, but the mechanism assigns existing campaign nodes. Saves owner email/name/avatar in Board Canvas; validates persisted node IDs, assignable editor set and revision in a locked transaction. Node status is asset workflow status, not a dedicated action-item completion object. Tests: [responsibilities](../../scripts/check-bw36-15-campaign-team-responsibilities.js), [continuity](../../scripts/check-bw36-15r1-responsibility-workspace-continuity.js). |
| S11 | [session](../../api/_auth-session.js): `getSessionUser`; [Board ACL](../../api/_board-access.js): `getBoardAccess`, `accessForRole`; [Brand ACL](../../api/_brand-access.js): `getBrandAccess`, `brandCapabilities`; [Workspace ACL](../../api/_workspace-authorization.js): `evaluateWorkspacePermission`; [catalog](../../api/_workspace-catalog.js) | Board edit, canonical Brand edit, Learning access and accepted Workspace membership are separate capabilities. Selected sidebar Brand is navigation state. Missing owner columns are not permission to infer an unowned Board. Tests: [Board roles](../../scripts/check-bw18-board-access-roles.js), S2, S5, S7. |
| S12 | [app.js](../../app.js): `askAiBrainAboutFinding`, `isCurrentInsightsSnapshot`, `calculateInsightsDiagnostic`, `setActiveView`; [Home](../../home-foundation.js): model/render/navigation adapters | Insights → Brain checks current finding, inserts a bounded editable question and opens existing Brain; no automatic inference or write. It currently assigns the composer value, so existing incoming handoff does not establish a universal draft-preservation contract. Home/Living Workspace orchestrates existing owners and current diagnostics. Tests: [Insights handoff](../../scripts/check-bw28-1-insights-ux-and-brain-handoff.js), [Home](../../scripts/check-bw36-21b2-home-insights-brain.js), [Living Workspace](../../scripts/check-bw36-22b1-living-workspace.js), S1. |

### Action implementation status

| Relevant handoff | Status | Verified limit |
|---|---|---|
| Ordinary Advice and Insights/Home → Brain question draft | Already implemented | Advice is read-only; incoming question remains editable and explicitly submitted. |
| Prepare as Content node | Already implemented | One Content node only, explicit extra inference, read-only preview and explicit local creation; persistent success still belongs to Board save. |
| Content eligibility and editable preview | Partially implemented | Conservative label predicate; actual eligibility is not semantic validation. Preview editing is missing. |
| Brain → Campaign Creator | Missing bridge; destination implemented | No response-to-briefing adapter or initial-brief dialog API; inference boundary gaps in S5 must be resolved before expansion. |
| Brain → typed Social/LP/other Canvas node | Missing bridge; schemas/editors partially reusable | Content proposal schema rejects other types. Canvas support alone does not authorize a new AI proposal schema. |
| Brain → canonical Profile suggestion | Missing bridge; destination implemented | Existing website proposal adoption is not suitable for automatic Brain import. Add only a non-persisting destination staging seam. |
| Brain → governed Learning | Missing bridge; governance implemented | Manual proposal and advisor receipt paths exist. No supported transcript provenance type or Brain candidate receipt. |
| Brain → task/responsibility | Partially reusable destination, missing bridge | Assigning an existing persisted asset is supported; creating a standalone task with due date/completion is not. |
| Brain → Save Decision | Missing; intentionally deferred | Advisor `decision_candidate`/`decision_status` fields are analysis classifications, not approved decision records. Repository ADRs are engineering documents, not business decision persistence. |
| Durable conversations, cross-Board actions, automatic writes | Intentionally deferred | No new storage or cross-context replay is authorized. |

### Final Content CTA and the Appics example

The final renderer in `renderAiBrainTranscript` requires **both** `aiBrainHasReusableContent(turn)` and `canUseAiBrainProposal()`, and excludes an applied proposal. Preparation is offered for absent/cancelled/failed/stale proposal state; a pending request or ready preview has its own state. `requestAiBrainNodeProposal` repeats the content/permission gate and rejects requesting/applying/applied states. Checking only the renderer or `explore_ideas` mode would miss the actual contract.

`aiBrainHasReusableContent` requires success, non-clarification, a string answer of at most 12,000 characters, then strips CR/LF differences and limited heading/bullet/bold markers. It finds an **anchored** label such as `Content concept`, `Content-Konzept`, `Campaign asset`, `Social post`, `LinkedIn`, `Landing Page copy`, `Beitragsentwurf`, with a limited optional draft/proposed prefix and label delimiter. In the suffix from that label it requires either:

- Audience/Zielgruppe **and** Message/Botschaft/Kernbotschaft **and** Purpose/Ziel/Zweck fields, each matching the minimum text length; or
- Labelled caption/copy/text/headline with at least 80 characters before a CTA label and an explicit CTA value of sufficient length.

It does not accept the campaign-concept labels above, an arbitrary hashtag, narrative-only copy, or all possible Markdown variants. Fields are collected across the remaining answer rather than a typed single-result boundary; unrelated sections can satisfy the predicate. It is simultaneously capable of conservative false negatives and compositional false positives. It is an affordance, not approval or authorization.

Provider-free counterexample using the actual function:

```text
Campaign concept: #MyAppicsStory
Audience: Independent creators sharing their creative process.
Message: Tell a personal story through a concrete creative contribution.
Purpose: Invite participation in a proposed storytelling campaign.
```

This returns false; changing only the heading to `Content concept:` returns true. The fixture is hypothetical, not a captured Appics answer or a claim about Appics capabilities. Plain strategic advice and a hashtag without required fields correctly stay hidden. A complete campaign concept should generally lead to Creator briefing, not be squeezed into a Content node to make a button appear.

**Live verdict:** unresolved between correct limitation and false negative. Obtain the exact authorized response, turn success/reference state, account/Board/public/edit state, proposal status and deployed SHA. Run the predicate on that exact answer without exposing Brand data in logs. Only then propose bounded EN/DE positive/negative fixtures. Do not add `campaign` keywords or show a CTA for every successful answer.

### Existing privacy and freshness gaps

Advice supplies explicit `store:false`, complete-message token accounting and pre/post inference revalidation [S2]. Content preparation [S3] has a 25-second fetch timeout, byte/source/schema/language bounds and initial Board authorization, but does **not** send `store:false`, does not use Advice's token budget and does not recheck server Board access/revision after inference. Its client captures context at **preparation time**, not the source answer's successful-request context. A historical answer can thus be prepared against a newer Canvas; client stale checks protect pending preparation and creation, not original-answer freshness or server-only revocation. These are verified limits to resolve before broadening that transport.

Creator generation [S5] likewise has no explicit `store:false`, server session/Board authorization or Advice-style final-message token budget in this route. The protected `/api/campaigns` commit remains a distinct and stronger boundary. This audit makes no production configuration, network exposure, exploitability or provider-retention assertion. Maintenance wrapping is not a substitute for authentication. No calls were made to a live provider to investigate these findings.

## C. Output taxonomy and eligibility

Classify a **bounded selected result** inside an answer; do not assign one actionable type to an entire multi-idea reply. Mode, vocabulary, confident tone and model assertions do not establish content suitability, facts or permissions. An answer may contain several result types and epistemic states.

| Output type | Required substantive content | Suitable action; exclusion |
|---|---|---|
| Strategic recommendation | Proposed direction, rationale, material assumptions and next step | Can seed an editable task/decision proposal only when a concrete action or human choice is identified. Generic analysis alone has no mutation CTA. |
| Campaign concept | Distinct concept/mechanism, audience, central message, proposed objective/participation action; identify unknowns | Create Campaign briefing. Additional assets/structure remain Creator work. A name/hashtag is insufficient. |
| Content asset | Concrete bounded copy or a sufficiently specified reusable brief, intended channel/type and purpose | Add to Canvas for a compatible validated type. Multiple posts need separate selections; no invented node types. |
| Brand Profile update suggestion | Explicit field target and proposed replacement wording, durable Brand identity scope, clear proposal intent | Suggest Brand Update after independently reading current canonical value. Campaign slogans, temporary offers and unsupported claims must not be silently mapped into identity fields. |
| Brand Learning candidate | Reusable observation, evidence/source, applicability and uncertainty; compare existing knowledge | Propose Brand Learning; speculative hypotheses are labelled hypotheses for review, not performance facts. Unsupported assertions require evidence before proposal adoption. |
| Task/action item | Concrete verb/outcome, scope and human-confirmed target; assignment optional until selected | Existing-asset responsibility only where suitable. No fictional Task node or new standalone task persistence. |
| Strategic decision | Explicit human choice, scope, rationale, alternatives/trade-offs and actor confirmation | Future Save Decision object. AI recommendation or advisor `decision_candidate` alone is not a decision. |

Epistemic state is a separate axis: **hypothesis** (unverified interpretation), **proposal** (suggested future wording/action), **confirmed fact** (supported observation with an identified authorized source and scope), **approved Brand truth** (accepted canonical identity or separately approved Learning under its owner). A copied AI sentence never advances itself along this axis. Canonical persistence does not approve every nested generated draft; Learning approval is a distinct lifecycle. Record conflicts rather than synthesizing a fictional consensus.

Future internal descriptors should carry output type, exact text slice, source turn/result identity, epistemic state, language, explicit target, limitations and a captured scope/freshness fingerprint. This is a proposed ephemeral UI contract, not a new Advice response schema or database object in this audit. Candidate extraction must preserve actual content and separate unrelated results; reject ambiguous mappings. A small deterministic supported format plus explicit user selection is preferable for the first package to a paid classifier or pretending a regex proves meaning.

Action availability is the intersection of content compatibility, target-owner capability, current context, supported validation and lifecycle readiness. Share only common presentation, source selection, safe text rendering, cancellation and freshness plumbing. Creator generation, Canvas creation, Profile acceptance, Learning proposal/review and responsibility assignment each require separate owner-specific permissions and confirmations. Never share a generic "apply AI answer" mutation endpoint.

## D. Six action contracts

The following contracts describe proposed behavior. Except the existing Content path, these bridges are not implemented.

### A — Create Campaign

**Entry:** A concrete selected campaign concept; signed session, editable saved Board, persisted Brand association, current active Workspace/catalog, clean Board revision and applicable destination access. Respect `resolveCampaignCreationContext`; do not use the selected sidebar Brand to fill missing authority. Board-only Brain advice does not imply canonical read access.

**Transfer:** A bounded editable `campaignIdea` (2,000 characters maximum) and `additionalContext` (4,000), source concept/rationale/assumptions and authorized Board campaign constraints only. No whole transcript, raw canonical Core in URLs, unrelated ideas, invented goal or silent channel inference. Show truncation and require an edit if over limit. Creator resolves its own Brand context. Unknown goal/channel/counts remain user inputs; keep destination defaults visibly editable.

**Flow:** Open the existing two-step Creator with proposed initial-brief support. Preview/edit the brief, choose structure, then explicit Generate. Opening, prefilling or Continue performs zero inference/writes. Generate starts existing generation/validation/repair and commit; disclose that generation uses AI and may include the existing repair flow rather than promising exactly one request. Do not add a classifier/summarizer call. Preserve complete-funnel counts, edge validation, adapter, rollback, authoritative receipt, idempotent recovery and existing Canvas data [S4–S5].

**Outcome/return:** `/api/campaigns` owns persisted Board Canvas changes; open the same Board's resulting campaign Idea in Canvas with its confirmed revision. It does not create a new Brand or necessarily a new Board. Provide a return-to-source-conversation affordance scoped to the same still-authorized account/Board. Restore transcript, composer, mode and prior scroll; success must not resubmit the original question. Cancel restores origin. Lost response recovers the same commit, never generates another campaign by default.

**Dependencies:** New initial-brief and source-return seam only after generation authorization, privacy, freshness and request-budget safeguards are explicitly designed and verified. No new bridge should treat the current generation route as already safe because commit is protected.

### B — Add to Canvas

**Existing:** `Prepare as Content node` sends the selected turn answer to a separate inference route, validates one proposal, previews text, and explicit Create invokes `createNode({type: 'Content', initial: {title, content}})`. The UI marks dirty, selects the created node and navigates through the Canvas entry. It does not itself prove server persistence. The current preview is not editable [S3].

**Future:** Select one specific asset, use a type-specific allowlist and schema, preview/edit fields and explicitly create through Canvas's normal history/dirty/save lifecycle. Extend preview editing deliberately rather than claiming it already exists. Content may preserve a concept as a brief; it is not a full generated campaign.

| Actual type | Existing schema/editor evidence | Proposed eligibility / limitation |
|---|---|---|
| `Content` | Proposal `title/body` maps to native `title/content` | Existing route only. Preserve 120/4,000 title/body limits and duplicate protection; fix privacy/freshness before expansion. |
| `Social Media Posting` | Native `social.platform`, `caption`, `hashtags`, `preview`/CTA usage; payload adapter/editor in app.js | Specific platform-compatible post; explicit platform and field preview. Do not confuse preview with CTA or create an unsupported `Social` type. |
| `Landing Page` | Native `landingPage.headerClaim/problem/solution/trust/cta`, plus visual prompt in native editor | Require mapped sections; no fabricated testimonials/trust. Advice projection omits header visual prompt, so missing visuals cannot be reconstructed as fact. |
| `Idea`, `Campaign Variation` | V3 and native create/edit support | Scoped concept/variation only; full campaign routes to Creator. Preserve actual schema and ownership. |
| `Email Campaign` | Native content and V3 payload; subject/preview/body/CTA conventions | Separate schema and preview design required; no current Brain proposal endpoint support. |
| `Visual Concept`, `Image Brief` | Native `NODE_TYPES`, `openTypePicker`, generic `createNode`/Inspector title/content and `imagePrompt`; Advice admits both types | Native creation support exists, but no dedicated Brain proposal schema. Keep generic brief semantics; defer typed proposal mapping and image inference. |
| `Strategy` / `Task` | No such type in Advice's eight-type allowlist or Creator's six-type funnel | Strategy is an Inspector section/channel label, not permission to invent a Strategy node. Tasks toolbar is responsibilities. Do not emit these node schemas. |

**Transfer/input/cost:** One selected asset plus minimal authorized target context; user edits type-specific fields. Existing Content preparation makes one explicit inference; pure deterministic field staging should make none. A future paid conversion must be explicit. No automatic asset generation on ordinary Advice or mode change.

**Outcome/return:** Canvas owns node IDs, layout, edges, editing and persistence. Do not imply an edge, parent or published status from response prose. Announce local creation separately from confirmed save. Return through same-Board Brain navigation; retain transcript/draft/mode/scroll. Changing selection or Canvas can invalidate action proposals without destroying the conversation.

### C — Suggest Brand Update

**Entry:** Explicit durable field-specific proposal, not campaign content; independently authorized canonical Brand **edit** capability for the Board's persisted Brand and authorized Workspace scope. Fetch current canonical detail using existing owner flow; never read current values from a historical Board snapshot or trust client-declared Brand ID. No access means no old-value disclosure.

**Transfer:** Exact proposed field value, field path, source turn/excerpt, proposal label and rationale/uncertainty; captured account/Board association/Brand/Workspace identity, canonical revision and exact old value. Show existing versus proposed, affected field and source. Re-read before accepting; same text/blank absence/null are distinct according to existing contract. MVP supports only the string `/brand_core/valueProposition`, at most 2,000 characters, with no silent clipping. The cap is a proposed UI bound, not a claim about an existing schema limit.

**Flow:** Preview/edit → explicit "Use in Profile draft" → existing Profile draft → explicit Profile Save. Preview, staging and Cancel perform zero persistent writes and zero AI calls. A clean destination draft is required for MVP; if dirty/busy/deferred/unsynchronized, retain it and explain how to save/discard/cancel through `guardBrandProfileLeave`. Do not overwrite a manual field draft or auto-save it to make room. Website `applyProposal` must not be reused as a non-persisting import: it calls `persistSuggestions` [S6]. Add a small destination-owned staging method that checks the exact field and current baseline, or equivalent typed mount input with the same checks.

**Save/outcome:** Profile owns `profile_edit`, expected revision/value, mutation identity, review token when required, private database write functions, history, receipt verification and post-save authoritative read [S7]. Brain never PUTs a Core object. The new staging action is not acceptance of DNA, Founder Story, Avatar or a Learning. Preserve all unrelated and unknown keys. Changed revision/field/access requires reread and a new human comparison; never silently rebase the proposed replacement onto new truth. Failure retains editable draft; an unknown outcome uses existing safe reconciliation/retry.

**Return:** Existing Profile surface remains the destination. Add Return to conversation/Zurück zum Gespräch after save or cancel; leaving a dirty Profile must still use the leave guard. Restore original Board-scoped Brain state and source turn/scroll. Profile save does not refresh the Board snapshot automatically. No new transcript provenance may be added to the canonical write payload: that contract allows `source` only for initialization. Source attribution in MVP stays in the ephemeral review UI; durable AI-source provenance needs a separately approved design.

### D — Propose Brand Learning

**Entry:** A reusable, scoped observation with honest evidence and uncertainty; active verified application identity and independent Brand write ACL. Do not infer this permission from Board edit or Workspace membership. Compare proposed/approved knowledge with existing normalized duplicate handling. A new phrasing of the same approved Learning does not create new evidence.

**Transfer/flow:** Prefill existing manual proposal statement/evidence fields only after preview/edit and explicit Create proposal. Existing service limits statement to 2,000 code points and optional evidence summary to 4,000; expected Brand revision and later Learning revision checks remain. Creation saves `proposed`; approval requires separate human review, then approved-only retrieval. Never route a Brain string through an advisor `adopt_selected` receipt for candidates it did not issue. Batch adoption is receipt-bound, atomic and produces proposed rows [S9].

**Provenance:** Existing optional source is exactly Board ID, persisted node ID and expected Board timestamp, server-verified to belong to the authorized Brand. An unsaved Brain turn has no such node. Do not fabricate a node, label it `campaign_observation`, claim transcript durability or add unsupported source fields. A reviewed manual Learning with an explicitly labelled AI discussion excerpt may reuse the manual path without claiming structured chat provenance; if durable AI-turn provenance is required, defer until its source model/retention/access contract exists. Evidence of a hypothesis is not evidence of its truth.

**Cost/outcome/return:** Direct manual prefill adds zero inference. Invoking existing Learning Advisor would be a separate explicit AI action with its own scope and cost; unnecessary for copying one candidate. Learning service owns proposed row/event/history, approval and later retrieval. Navigate to the Brand Learnings review list, emphasize proposed status, then return to the still-authorized source conversation. Saving must never update canonical Profile or claim verified performance.

### E — Create Task

**Reuse assessment:** S10 supports assignment of **existing persisted campaign nodes** to currently eligible editors; Board role/Brand role projection and revision are checked server-side. Title/owner/asset status are not a standalone task schema. There is no verified general task API with independent description, due date, completion and decision linkage.

**Safe near-term contract:** Where the response names a unique existing asset and concrete responsibility, offer "Assign responsibility" / "Verantwortung zuweisen" rather than misleading "Create task". Transfer the explicit node ID and proposed action as review context; open existing responsibility dialog, let the user choose from live eligible people and explicitly confirm assignment. Never invent an email, preassign someone from prose, or mark an asset complete because advice says so. Unsaved/new assets must first be saved through Canvas and revalidated. Missing/multiple targets need explicit selection; no silent node-title matching.

**Cost/outcome/return:** Zero inference; existing Board responsibility save owns owner fields and revision. Asset editing remains Canvas; no new completion field. Return to same conversation. Standalone task creation, deadlines, subtasks and independent completion remain deferred to the Team/workflow owner and a separate data-object design.

### F — Save Decision

**Current support:** No verified durable business-decision object/API supports the required scope, actor, rationale, alternatives, approval and supersession lifecycle. Learning Advisor can identify `decision_candidate` and `decision_status`; adoption still writes a Learning proposal and does not solve decision persistence. `docs/decisions` holds repository ADRs, not user business decisions.

**Future contract, no persistence authorized:** Capture explicit user choice, rationale, alternatives/trade-offs, assumptions, evidence/source references, authorized Board/Brand scope, actor/time and status; preview/edit, then explicit decision confirmation. Define Workspace/Board/Brand visibility, revision/conflict, supersession, retention/deletion and source reauthorization before adding storage. Decision support belongs to Brain; decision ownership and approval belong to humans and Team/workflow, not a new Brain truth store. Learning can later describe a reviewed observation from a decision, never replace the decision record.

**UX/cost/return:** Hide Save Decision in the current MVP. Future editor would make zero inference for explicit user-confirmed extraction; any proposed AI summary must be separately requested. No current saved destination exists, so do not show a success state or silently store a Content node/Learning as a decision. A future owner route must return to the authorized source conversation without pretending the transcript is durable.

## E. UX and interaction design

Place one compact action row below each eligible bounded response/result, after answer content and before incidental metadata where practical. **One recommended primary, at most one visible secondary**, plus `Use this` / `Verwenden` only when additional eligible actions exist. The menu is contextual, not a permanent six-action toolbar. For a concrete campaign concept, Create Campaign is preferred once that bridge meets its prerequisites; for a specific asset, Add to Canvas; for explicit durable Profile wording, Suggest Brand Update. Do not rank action solely by conversation mode.

| Situation | Visible behavior |
|---|---|
| Ordinary strategic discussion, pending/failed/clarification reply, ambiguous extract | No mutation action; normal conversation/retry remains. |
| Eligible first-package Profile suggestion | Primary `Suggest Brand update` / `Brand-Änderung vorschlagen`; no secondary unless a separately implemented eligible route exists. Do not expose unimplemented menu items. |
| Compatible asset and campaign concept in one answer | Scope each action to a clearly selected result; primary follows explicit user intent, secondary can offer the other compatible implemented route. Never apply the whole mixed answer. |
| Capability absent | Hide the action and any protected current values. An open preview losing permission becomes unavailable and cannot submit. |
| Known recoverable prerequisite | A visible disabled item is allowed only when content and permission are already established, e.g. `Save project changes first` / `Projektänderungen zuerst speichern`; provide descriptive text and a safe route to the existing save flow, no automatic save. |
| Context stale, revision changed, target removed | Disable confirmation, retain safe user draft, announce need to reread/reprepare. Do not silently retarget or execute on refresh. |
| Applying, outcome unknown, confirmed | Disable duplicate submission; show owner's status. Recover exact intent/receipt; announce confirmed save only when verified. |

Preview identifies destination Workspace/Board/Brand and source excerpt, shows only allowed fields, distinguishes proposal from fact, permits editing and explains the final save owner. Explicit confirmation is separate from opening/editing. Existing Content's read-only preview is a gap against the desired editable experience; preserve current behavior until a dedicated enhancement supplies editable validation.

Use existing semantic buttons/dialogs and safe text rendering. Menu trigger supports keyboard Enter/Space; if using menu roles implement arrow navigation/Escape and return focus, otherwise use a simple accessible disclosure with native buttons. Dialog has accessible heading, focus containment, Escape/cancel when safe, visible focus and a live status region. Associate disabled reasons via description, not color/tooltip alone. Do not place editable controls inside generated Markdown. Preserve EN/DE interface text separately from campaign output language and per-turn Advice language. Avoid automatic translation or regeneration of the selected source.

Reuse current Light/Dark tokens and minimal Brain styling. On 320/375px widths allow action labels to wrap and the compact menu/dialog to fit; no horizontal overflow or large action cards. Reflow and zoom must preserve focus and scroll. The future implementation must supply EN/DE labels for preview, current/proposed, source, draft-only staging, permission loss, stale revision, recovery and return. No new CSS is part of this audit.

**State contract:** Keep Brain composer text/caret, mode, transcript, Learning disclosure and scroll anchor separate from ephemeral action preview state. Same-Board destination navigation suspends and restores them. Account/Board/load invalidation resets protected conversation state as today; privacy takes precedence over restoring another account's draft. Selected sidebar Brand alone must not change Board authority. Capture source account object/email, Board/load, Workspace/catalog generation, persisted Brand association, exact source turn/answer and relevant selected result, current permission and destination revision. Include projection/selection where the action consumes Canvas. Recheck at preview, staging and final owner submission. Brand revision/permission can change server-side without a Canvas change; the current Brain fingerprint alone is insufficient.

An action may intentionally change Canvas selection or Brand revision. Invalidate other prepared proposals afterward while retaining the conversation; avoid resetting modes/transcript as an accidental side effect. A source-return token is in-memory, same-account/Board scoped, contains no protected content in URL/localStorage, and is discarded on invalidation. No persistence of transcripts is introduced. Existing incoming Insights composer assignment should not be copied as a draft-safe implementation pattern.

## F. Authorization, freshness and data ownership

| Target | Authority | Mandatory freshness / persistence boundary |
|---|---|---|
| Advice/source discussion | Verified signed session and server-resolved Board edit capability; independent canonical/approved Learning ACL | Existing capture/revalidate and client exact Canvas identity; history is lower-authority context, never authorization. |
| Campaign | Current persisted Board/Brand/Workspace association, Board edit and accepted Workspace membership; independent canonical access for any canonical enrichment | Generation boundary must be hardened; existing commit checks Board revision, generated funnel and exact replay. No copied caller Brand context substitutes for owner authorization. |
| Canvas asset | Board edit, validated actual node schema and current owner workflow | Recheck source/target context before create; existing Canvas/Board save owns persistent success and conflicts. Client creation is not proof of a durable write. |
| Profile | Independent canonical Brand editor/owner/admin plus existing Workspace/write enforcement | Fresh canonical revision and exact expected field; `profile_edit`, mutation ID, protected database function/history and authoritative reconciliation. Brain does not write Core. |
| Learning | Unique active identity and independent Brand ACL | Proposed/approved distinction; source Board/node timestamp, Brand/Learning revision, receipt/duplicate/event handling; approved-only later retrieval. |
| Responsibility | Board editor and current assignable person set | Persisted node membership, locked Board revision and normal assignment save; owner is Board/team workflow. |
| Decision | Future explicit scope/ACL design | No approved object today; no write or invented destination. |

No cross-Brand fallback: Board A/X plus sidebar Y remains A/X. If X cannot be independently edited, hide Profile/Learning actions; do not offer Y as a convenient target. A Board-only editor can retain authorized Advice and current compatible Canvas operations without receiving hidden canonical values or Learning counts. Workspace membership alone does not authorize canonical mutation or Learning access. Viewer/public/expired sessions must not infer permission from previously rendered buttons.

All persistent mutations require a concrete human-approved owner action. Profile draft staging is reversible local state and is labelled accordingly; Save is explicit. Learning proposal creation itself is persistent and therefore confirmed; approval is another action. Creator Generate authorizes its disclosed generation/commit flow. Never auto-run paid inference on hover, menu open, classification, retry timer or mode change. All future provider requests must use `store:false`, current request/token budgets, timeout and bounded output; do not claim existing proposal/Creator routes already do. Maintain the existing restricted database runtime and canonical history protections without new SQL grants, schema or production probes.

Minimize transferred content to the selected result and necessary authorized context. Never log raw answers/Core or put them in routes, analytics or error payloads. Source references can become unavailable; a future durable object must not bypass source ACL to display private historical material. Revalidation is a boundary check, not continuous revocation and cannot retract already dispatched provider content. Untrusted text and instructions in fields stay data; approval does not make prompt injection safe.

## G. Prioritization and implementation phases

Scores are comparative product/engineering judgment from inspected code, not usage analytics. No telemetry was supplied to establish measured workflow frequency. Value/frequency/reuse use 1–5 (5 highest); complexity/risk use 1–5 (5 hardest/highest). Risk is incremental exposure if expanded, not an exploitation assessment.

| Rank / action | Value | Expected frequency | Existing reuse | Complexity | Integrity/security risk | Additional inference | Decision |
|---|---|---|---|---|---|---|---|
| 1 — Suggest Brand Update, one field | 5 | 3 | 5 | 2 | 3 | Zero | First package: explicit value-proposition proposal, protected Profile draft/save. Canonical consequence warrants strict field/intent/ACL/revision limits. |
| 2 — Create Campaign | 5 | 4 | 5 | 3 | 4 | Zero for briefing; existing generation plus possible repair on explicit Generate | Strong next bridge after separate generation boundary hardening. Editable setup and commit already fit. |
| 3 — Add to Canvas | 4 | 5 | 4 | 3 | 3 | Existing Content conversion one call; direct field staging zero | Keep existing Content; privacy/freshness and selected-result/editable-preview work before expansion. Social/LP separately. |
| 4 — Propose Brand Learning | 4 | 3 | 4 | 3 | 4 | Zero for manual prefill | Strong governance reusable, but transcript provenance and evidence/duplicate handling must be explicit. |
| 5 — Create Task / assign responsibility | 3 | 4 | 3 | 3 | 3 | Zero | Existing-node assignment only; standalone action items need future Team design. |
| 6 — Save Decision | 4 | 2 | 1 | 5 | 4 | Zero for explicit choice; optional summary deferred | New lifecycle/object/ACL/retention design needed; no persistence now. |

**Phase 0, this PR:** audit, documented gaps, source references, acceptance matrix and implementation brief only. Preserve unrelated roadmap priorities.

**Phase 1, one implementation PR:** C-1 value-proposition proposal. Eligibility only for explicit replacement wording and durable Profile intent, one field, one owner staging seam, shared preview/return lifecycle only as necessary for this action, no paid extraction. This does not resolve #MyAppicsStory eligibility or ship a six-item menu. Exclude website suggestion auto-fill and all protected DNA/Avatar/module acceptance.

**Separate prerequisite package:** harden existing generation/proposal transports under their owners. Verify session/Board authorization, persisted association, independent canonical enrichment, freshness/revocation, `store:false` and request/token bounds. Do not bundle this with C-1 or silently leave it as a condition that implementers will miss.

**Phase 2:** Brain → existing Creator editable briefing, after those checks pass. Reuse owner validation/confirmation and existing Canvas commit. Test cost disclosure and repair behavior, not an invented one-call guarantee.

**Phase 3, separate packages:** selected-result Content eligibility/preview improvement; then individually designed Social/LP adapters; manual Learning prefill with honest provenance; existing-node responsibility handoff. Each gets its own bounded acceptance gate. Standalone tasks/decisions and durable source provenance remain design work, not assumed follow-ups already committed on the roadmap.

## H. Technical dependencies and risks

1. **Source freshness is missing on successful turns as a reusable action contract.** The current client checks freshness while Advice returns, but does not retain a server-issued per-turn action capability/revision. Do not invent such a capability from model text. C-1 must capture relevant client identity on success and reauthorize/reread canonical state when staging; stale source identity requires a new proposal, not a silent reuse. No new server Advice schema is required for the narrow field-copy bridge.
2. **Profile integration must stage without persisting.** `state.proposals` belongs to website analysis; `applyProposal` performs a save. Initializing `state.core` with AI text before recording baseline would make it look clean and can erase write intent. A destination staging seam must establish baseline from the canonical record first, then update only the allowed draft field and dirty state after explicit choice. Keep pending drafts and leave guard behavior.
3. **Response semantics cannot be proven by labels.** Use explicit proposal intent, bounded exact extraction and user confirmation; unsupported/mixed campaign content stays in chat. Conservative omissions are acceptable. Do not add an unmeasured semantic classifier or claim policy alone prevents fabricated facts.
4. **Creator compatibility is more than a dialog prefill.** Generation route gaps, mixed legacy generation paths, quality/repair calls, provisional local Canvas mutation, autosave suspension, rollback and confirmed commit all need owner tests before extending entry points. Never call `runCampaignV3AICompatibility` directly from Brain to bypass `openStableCampaignCreation`.
5. **Canonical source provenance is not generic metadata.** `brand-write-contract.js` allows `source` only for initialization. Do not send a turn ID as a new field or claim canonical history will persist the review excerpt. Existing actor/change history remains; durable AI-source history requires a separate contract.
6. **Learning source claims are narrow.** Unsaved responses/nodes cannot satisfy persisted Board/node provenance; advisor receipts cannot adopt arbitrary chat text. Hypotheses and simulated results must not become measured facts.
7. **Tasks and decisions are easy to mislabel.** A Tasks button, asset status or Learning decision candidate does not establish a task/decision object. Separate object/lifecycle design avoids corrupting canonical knowledge or overloading Canvas.
8. **Restoration can conflict with privacy and freshness.** Preserve same-context conversation while invalidating stale proposals; destroy protected state on account/Board change. Reopening source after an owner mutation may keep the transcript but must not revive an old capability or confirmation.
9. **Verified limitations:** no authorized Appics payload, production Brand data, live AI quality evaluation, telemetry, deployed configuration audit or paid inference. Static tests/probes cannot establish recommendation quality, classifier recall or live permission behavior. Existing schema/read projections can omit native fields; omitted is not absent. No production SQL, Vercel/Supabase changes or deployment occurred.

## I. Regression and acceptance-test matrix

Existing tests are evidence of owner contracts, not proof that proposed bridges exist. New implementation tests must exercise actual destination/controller functions with mocked providers and disposable fixtures; do not duplicate implementation predicates as the only assertion.

| Area | Required cases / expected acceptance | Existing coverage to retain |
|---|---|---|
| Content eligibility diagnosis | Actual current function: campaign-concept heading fails; Content-concept equivalent passes; EN/DE; strategy/hashtag only fails; clarification/pending/failed/over-bound fails. Exact Appics replay requires authorized capture. Future selected-result tests prevent combining unrelated sections. | S1 R1 advisor, S3 BW-26.6. |
| C-1 content eligibility | Explicit field-specific replacement and exact nonempty ≤2,000-char value; original question/result intent consistent; ambiguous multiple values, campaign-only ideas, unsupported claims/targets and oversized values offer no action. Mode alone never qualifies. Same behavior in General and all four modes. | S1 mode/language/answer suites plus future C-1 fixtures. |
| Permissions and leakage | Editor of Board X without canonical X edit; Brand viewer; sidebar Y with Board X; public/anonymous/expired session; Workspace mismatch; account identity change. No hidden old values, canonical update CTA or writes; server rejects bypassed owner submissions. | S2, S7, S11. |
| Preview and draft staging | Fresh canonical current/proposed/source shown; edits retained; cancel/open/stage cause zero PUT/SQL writes and zero provider calls; explicit staging changes only valueProposition, baseline preserved and draft dirty. Existing manual Profile draft blocks overwrite; busy/deferred/sync-required state fails safely. | S6, S7; add actual staging/controller assertions. |
| Protected save | Only deliberate Profile Save creates typed one-field command; expected revision/value/mutation ID; unrelated Founder Story, DNA approval/Avatar, unknown modules, personas and messaging unchanged. No raw Core PUT or new payload keys. Confirmed read controls success. | S7 protection, browser and PostgreSQL suites. |
| Freshness and conflict | Canvas/source change before preview, account/Board/load change, persisted association change, Workspace/catalog switch, canonical revision or field change, permission revocation between preview/stage/save. Disable old intent; retain safe current-account draft; recompare before retry. | S1, S2, S6–S7; new bridge-specific race fixtures. |
| Outcome recovery | 409/401/403/404/503, malformed response, lost save reply, exact idempotent retry, confirmed save plus rendering failure, newer user edits while save pending. No false success, duplicate mutation or lost draft. | S6–S7. |
| Lifecycle/accessibility | Return after save/cancel preserves same-Board composer/caret/mode/transcript/disclosure/scroll; guard dirty Profile; account change clears protected state; keyboard menu/dialog/focus/Escape; EN/DE, Light/Dark, 320/375px and desktop/zoom. At most one primary/one visible secondary, no unimplemented menu entries. | S1 workspace/R1 advisor, S6 leave guard; future real-shell C-1 browser cases. |
| No incidental inference/mutation | Advice/mode/menu/preview/return cause no new paid call or write. C-1 is zero additional inference end to end. Ordinary Advice keeps one call, clarification zero and `store:false`; no classifier/self-check/retry calls. | S2/R1 and existing read-only checks. |
| Future Creator gate | Dirty/no Brand/wrong Workspace/revision/capability fails; editable bounded initial brief; no call before Generate; protected generation access and `store:false`; complete V3 nodes/edges/counts, no lost existing assets; rollback/replay/unknown outcome; source return. | S4–S5, complete V3 and stable-creation suites; hardening tests required. |
| Future Canvas expansion | Real type allowlists and field schemas, no Strategy/Task invention; explicit edited preview and create once; no edge/status fabrication; pending/stale/context/revocation; local versus server save distinction; store:false on conversion. | S3 plus native Canvas/Board regressions. |
| Future Learning/task/decision | Proposed ≠ approved; duplicates/revision/source ACL; receipt cannot adopt chat; approved-only retrieval; no fake persisted source; assign only eligible people to persisted nodes, no completion fabrication; no decision write before approved object design. | S9–S10; new scoped bridge tests only when implemented. |

### Validation of this documentation PR

- Baseline tree/commit verification described above; only the three requested Markdown paths may differ from audited main.
- Check required A–K sections, all six action contracts, date/SHA, exclusions and copyable prompt; resolve repository links and named code anchors against audited source; check balanced fences/tables, headings and whitespace.
- Provider-free probes exercise the actual current Content eligibility function and inspect the actual provider request bodies; no generated fixture is presented as a live Appics result.
- **PASS:** `node scripts/check-bw26-read-only-ai-brain.js`; `node scripts/check-bw28-ai-insights-architecture.js` (86 contracts); `node scripts/check-bw28-1-insights-ux-and-brain-handoff.js` (39 contracts); `node scripts/check-bw36-23-brand-knowledge-protection.js` (15 contract/controller groups). The architecture checks also verified all 47 local classic browser scripts.
- **PASS:** 11 provider-free probes of the actual current eligibility function verified EN/DE label false negatives, strategic/hashtag negatives, lifecycle/length guards and the suffix-composition limitation; source inspection verified provider storage/auth boundaries and Content-only proposal schema. An initial attempt to require the route modules stopped because `pg` is absent; the corrected source probe avoids runtime database imports and passes. No route integration or live provider test is claimed.
- Full application, browser and PostgreSQL CI matrices were not rerun for this documentation-only change. Previous #820 results are historical evidence only; SQL invariants remain covered by their separate existing suites, not the contract-only check above.
- No test, CI, CSS, API, schema or migration change; no paid inference, production SQL, Vercel/Supabase operation, merge or deployment.

## J. Deferred capabilities and architecture decisions

These recommendations preserve [product architecture](../constitution/product-architecture.md), [intelligence architecture](../product/product-intelligence-architecture.md), [roadmap](../roadmap/README.md), [BW-37 audit](./bw37-ai-brain-2-strategic-advisor-audit.md), [BW-37.1B audit](./bw37-1b-strategic-answer-quality-audit.md), [answer-quality implementation](../implementations/bw37-1b-strategic-answer-quality.md) and [conversational-advisor implementation](../implementations/bw37-1b-r1-conversational-advisor.md). Current source supersedes outdated claims in those earlier baselines.

AI Brain owns advice/proposals, Creator complete campaign generation, Canvas nodes/editing, Profile canonical identity, Learnings governed reusable observations, Insights diagnostics/evidence, Team/workflow responsibilities/decisions and humans approval. A common presentation component may route to these owners; it must not become a generic mutation service.

Defer: durable conversation/AI-source references, general output classification, bulk multi-result execution, standalone tasks/deadlines, business decisions and supersession, cross-Board/Brand reuse, new task/strategy node schemas, direct Profile DNA/Founder Story/Avatar acceptance, automated Learning approval, semantic retrieval redesign, quotas/providers, generation-cost redesign and agent workflows. Decisions and standalone tasks need explicit owner/data/ACL/lifecycle designs and ADRs before implementation. A reviewed manual Learning is not a substitute for a decision object.

Record the generation/proposal privacy/authorization gaps as prerequisites, not architectural permission to copy existing weaknesses. No new persistence, provider calls, deployment or production investigation is authorized by this audit. Roadmap index links are descriptive and do not silently reorder unrelated work.

## K. Complete directly copyable prompt for the first implementation package

```text
TENDRA ONE — BW-37.1C-1: AI Brain → Brand Profile Value-Proposition Proposal

Repository: Funklix/Funklix. Implement only the first package in
docs/audits/bw37-1c-ai-brain-action-handoffs-audit.md. Read the full audit, AGENTS.md,
product-architecture.md, product-intelligence-architecture.md, roadmap README,
BW-37/BW-37.1B audits and both BW-37.1B implementation notes first.
Audit baseline: ef7618477b9f31c9f192d4564a620639cb093c44, including PR #820,
2026-10-26 Europe/Berlin. Start from latest merged main; record exact SHA and
inspect changes since baseline. Current source overrides old audit assumptions.

DELIVERY
Dedicated branch; commit and push completed work. Open exactly one normal,
non-draft PR against main and verify draft:false. Never merge or deploy. If
technically blocked, report BLOCKED and the real cause; never invent a PR URL.

OWNERSHIP
AI Brain advises and prepares proposals. Brand Profile owns canonical draft,
acceptance, validation, protected save and history. Humans explicitly approve.
Never write Brand Core directly from a Brain handler or add a generic apply API.

INSPECT BEFORE EDITING
Trace app.js Brain success/identity/projection/turn/render/scroll/navigation,
aiBrainHasReusableContent and existing Content proposal flow; Profile mounting,
retainPendingBrandProfile, guardBrandProfileLeave, reconcileConfirmedBrand;
brand-profile-setup.js createSession/current/dirty/save/reload/verifyBrand,
pendingData, website proposals/applyProposal/persistSuggestions and leaveDialog;
brand-write-contract.js command/diff/submit, canonical Brand API/write-preview,
api/_brand-knowledge-write.js and restricted canonical database write/history
contracts. Inspect Board/Brand/Workspace and active-session authorization and
existing BW-26/BW-28/BW-36/BW-37 owner/lifecycle tests.

MINIMAL SCOPE
1. Add one contextual action for an actual successful, non-clarification result
   explicitly proposing durable replacement Value Proposition wording. Require
   a clear single target and exact bounded value, not mode, a generic keyword,
   a campaign hashtag or arbitrary full-answer copy. Use explicit proposal intent
   and a small conservative EN/DE supported format/result selection. No paid
   classifier, summarizer or extra Advice inference. Hide ambiguous, campaign-only,
   unsupported-field, multiple-value, empty or >2,000-character proposals. Do not
   silently truncate. Keep substantive hypotheses/proposals distinct from facts;
   preview is not verification of an AI claim. Do not alter the Advice API schema
   or require every response to follow a field template merely to get an action.

2. Independently resolve the current authorized canonical Brand from the persisted
   current Board-to-Brand association in the existing owner flow. Require canonical
   Brand edit capability and valid existing Workspace scope; Board edit or sidebar
   selection alone is insufficient. Board X/Brand X with sidebar Y stays X. No
   access means no action or disclosure of current canonical values.

3. Open a compact destination-aware preview showing field, current authorized
   canonical value, proposed value, exact source excerpt and proposal/uncertainty
   label. Permit editing. Capture account object/email, Board/load, Workspace and
   catalog generation, persisted association, source turn/result text, canonical
   revision and exact old value. Reauthorize/reread when preparing/staging; reject
   changed identity, source, association, revision/value or capability. Retain
   relevant successful-turn source context for this action; the existing pending-
   response fingerprint alone does not authorize a later handoff. Never retarget
   an old answer to another Brand. Preserve current source/request/token limits.

4. Explicit 'Use in Profile draft' stages ONLY /brand_core/valueProposition in the
   existing guided Profile after the canonical baseline is established. Add the
   smallest destination-owned staging seam with exact field/value/scope/baseline
   checks. It must mark a real draft change and persist nothing. Do not use website
   applyProposal/persistSuggestions, which can save immediately. Never overwrite
   a dirty/manual draft; block with an actionable explanation and use existing
   save/discard/cancel guard when needed. Busy/deferred/unsynchronized destination
   state cannot accept staging. Reopening/rerender must not reset baseline to AI
   text or silently stage twice. Equal current/proposed value is a no-op.

5. Existing Profile Save remains a separate deliberate action. Use profile_edit,
   canonical-brand-write/v1, exact expected revision/old value, mutation identity,
   protected review where required, restricted database function/history and
   authoritative post-save reconciliation. Preserve unrelated/unknown Core keys,
   DNA/userApproved, Avatar, Founder Story/custom modules, personas, messages and
   Board snapshot. No raw whole-Core replacement or auto-refresh of Board Core.
   Do not add transcript source fields to the write payload: source is currently
   initialization-only. Source excerpt is ephemeral review UI; do not claim it
   becomes durable AI provenance. On conflict, reread and require new comparison;
   do not silently apply replacement to a changed canonical value. Retain drafts
   and recover exact save intent on unknown outcomes through existing contracts.

6. One compact primary action below the eligible result; at most one visible
   secondary only if another already-implemented route actually qualifies.
   Do not ship a six-item menu or advertise missing workflows. Preserve existing
   Content CTA behavior. 'Use this' is only needed if actual eligible extras exist.
   Implement EN/DE labels, safe text rendering, Light/Dark, keyboard/focus/Escape,
   accessible current/proposed/source/error/status, mobile 320/375px and zoom.
   No visual redesign. Provide Return to conversation after save/cancel while
   retaining same-Board transcript, composer/new draft/caret, selected mode,
   disclosure and scroll anchor. Dirty Profile still goes through leave guard.
   Account/Board/load invalidation clears protected state; stale proposals do not
   revive on return. Successful Profile changes invalidate affected proposals,
   not the conversation. No protected content in URL, analytics or localStorage.

NON-NEGOTIABLES
No paid inference: this bridge adds zero calls on open, preview, edit, stage, save
or return. Ordinary Advice stays one call, clarification zero, store:false and
existing timeout/token/approved-only Learning boundaries. Preserve signed-session,
explicit Board ownership, independent canonical/active-identity/Learning ACLs,
persisted association authority, restricted runtime DB and canonical history.
Source/model text is untrusted data, never instructions or permission. Every
persistent mutation remains an explicit destination-owner human action.

EXCLUSIONS
No Campaign Creator bridge or generation/proposal endpoint hardening in this PR;
those verified prerequisites need a separate package. No Content eligibility
broadening, new typed Canvas creation, Tasks, Decisions, Learning bridge/approval,
DNA/Avatar/Founder acceptance, new persistence/schema/migrations, new providers,
agent workflows or durable conversation/provenance. No production SQL, Vercel,
Supabase, TLS/RLS/grant changes, paid evaluation, merge or deployment.

VALIDATION
Exercise actual controllers/owner boundaries with fictional fixtures and mocked
transport; no production data or live provider. Implement the C-1 rows in audit
section I: explicit EN/DE positives/ambiguous negatives in all modes; canonical
editor vs Board-only/viewer/public/anonymous; sidebar Y/Board X; stale source,
Board/Brand/Workspace/account/revision/field/permission races; no protected leaks;
editable preview and zero-write staging; clean baseline + dirty staged field;
dirty/busy/deferred destination preservation; cancel/return/new drafts; exact
one-field protected save, unknown keys/accepted knowledge retained; 409/401/403/
404/503/malformed/lost reply/idempotent retry/newer edits; authoritative success;
zero extra inference; Light/Dark/mobile/zoom/keyboard/focus/scroll/leave guard.
Assert no writes before separate Profile Save and no new write-payload source keys.
Retain applicable BW-26, BW-28, BW-36 Profile/knowledge/Brand-Board isolation and
BW-37 mode/advisor/workspace regressions. Run syntax/browser integrity and required
CI checks, using disposable DB only where necessary. Record actual passes,
environmental failures/skips and semantic limitations; do not claim mocks verify
live AI truth or all source eligibility. Do not weaken existing tests.

REPORT
Return real PR URL, exact changed files, narrow behavior/ownership, verification,
remaining risks and deferred Creator/privacy/provenance work. Verify main target,
draft:false and no merge/deployment. Update implementation docs with actual scope.
```

BW-37.1C AI BRAIN ACTION HANDOFFS AUDIT READY FOR REVIEW
