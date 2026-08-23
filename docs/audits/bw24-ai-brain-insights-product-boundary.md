# BW-24 — AI Brain and AI Insights product-boundary audit

**Status:** audit-only; no application behavior, prompt, API, schema, dependency, configuration, workflow, or UI changes
**Baseline:** commit `6487e2d` (`Merge pull request #583 … implement-language-region-settings`), which contains the BW-23 Language and Region settings regression check
**Audit date:** 2026-08-23

## 1. Executive conclusion

Funklix currently has two navigation destinations named **AI Brain** and **Insights**, but neither yet implements its intended product. Both render the same synchronous, browser-only `analyzeCampaign()` result over the current in-memory nodes, edges, and Board Brand Core. Insights presents those structural heuristics as score cards; Brain presents the same health score, issues, suggestions, and node-creation actions. Brain is not conversational, does not call a model, has no thread or response persistence, and its “Refresh analysis” only waits 500 ms before recomputing. Insights has no event, ad-platform, CRM, commerce, attribution, spend, revenue, impression, click, conversion, period, or integration data. Its scores are deterministic content/structure diagnostics—not campaign performance.

The safe boundary is:

* **AI Brain is an active, contextual Brand and campaign advisor.** It may reason over the authorized Canonical Brand, the Board snapshot, current saved and unsaved Canvas context, selected and connected nodes, ICP, positioning, messaging, archetype, channel, goal, and funnel. It explains rather than owns deterministic diagnostics. It may produce advice and clearly labeled simulations, but never measured claims or automatic writes.
* **AI Insights is an evidence and measurement surface.** It eventually owns actual performance, comparisons, trends, anomalies, funnel metrics, provenance, freshness, and explicitly separated simulations. Until measurement sources exist, it must say so and may show clearly labeled **Canvas diagnostics** and **scenario projections**, never “performance” or unexplained health numbers.
* **Authoring stays close to the artifact.** Campaign generation stays in Campaign Canvas; node review, suggested rewrites, preview/apply, and field-specific improvements stay in Node Inspector/comments; Canonical Brand management stays in Brand Workspace; deterministic generation gates and diagnostics stay shared Campaign Canvas infrastructure.

The largest current overlap is not multiple model implementations: it is the same deterministic campaign analysis duplicated across Brain and Insights while separate AI Review/refinement/generation actions already exist around Canvas and Inspector. The most serious boundary defect is that model-backed routes such as campaign generation, node review, repair, refinement, Brand DNA discovery, and avatar/image generation generally trust client-supplied context and do not enforce the established Board/Brand authorization helpers. UI read-only checks are valuable but are not a server security boundary.

**Exactly one next implementation package is recommended:** clarify **AI Insights** in place as a read-only “data readiness and Canvas diagnostics” surface, using the existing deterministic analyzer and existing Board access state. This is copy/label/empty-state/provenance presentation plus focused regression coverage only; it does not build Brain, analytics ingestion, simulation, new persistence, or new write actions. Section 14 is the sole implementation package in this audit.

## 2. Current AI capability inventory

### 2.1 Inventory method and shared context

The inventory covers visible entry points in `index.html`, browser behavior and state in `app.js`, Campaign V3 structure in `campaign-v3.js`, server handlers in `api/`, the Knowledge Module files, storage/access helpers, regression scripts, and Runtime Boot Safety. “Persisted” below means either embedded in the serialized Board Canvas/Brand snapshot or stored in board-scoped browser local storage; transient request results and console diagnostics do not qualify.

Current Board context is assembled in the browser. Review and next-step requests include the node, campaign summary, connected/parent context, `boardId`, and `state.brandCore` (`app.js:14485-14504`, `14635-14685`). The normalized server context adapter is `api/_brand-brain-context.js`; it extracts Brand Core, mission/vision/values, value proposition, messaging, tone, personas/ICP-like audience data, content guidance, assets, Brand DNA/archetypes, Founder Story and accepted strategy modules, then adds deterministic archetype guidance. This is called “Brand Brain context” in code, but it is shared prompt-context infrastructure—not the AI Brain product.

### 2.2 Capability-by-capability current-state inventory

| Capability | Source files | Visible entry point / trigger | Input and authoritative source today | Output and persistence | Board / autosave | Server, logic, authorization | Current purpose and overlap |
|---|---|---|---|---|---|---|---|
| Campaign V3 generation | `index.html`; `app.js:9255-11805`; `campaign-v3.js`; `api/generate-campaign.js` | Create Campaign setup flow; explicit Generate action | User campaign idea, goal, channel, audience/count choices and `campaignLanguage`; current browser `state.brandCore`; generator response. The Board snapshot is intended Brand context, but the route accepts the client copy. | Structured JSON nodes/edges are normalized, planned, laid out, and committed to Canvas; created nodes/edges persist in `canvas_json`. Diagnostics are returned locally/logged, not persisted as a diagnostic record. | Yes. Successful commit changes the Board and the normal Canvas save path can autosave. | OpenAI Responses, `gpt-4o-mini`, plus deterministic normalization/layout/validation. Browser blocks read-only users; route itself has no session/Board access check. | Produces a campaign on Canvas. It overlaps Brain only as a possible future advisory starting point; generation ownership should remain Canvas. |
| Generation quality gate and repair | `app.js:10232-11722`; `api/refine-node.js` | Automatic within Campaign V3 after the first response fails quality checks | Generated nodes; deterministic issue codes; setup; campaign/Brand/connected context. | Up to three repair targets are sent one at a time, merged, and re-evaluated; best available result continues when repair fails. Repair and diagnostics are transient except repaired content becomes part of committed Canvas. | Only the final successful campaign commit changes/saves the Board; repair itself operates before commit. | Deterministic quality rules select targets; repair calls OpenAI `gpt-4o-mini` through the general refinement endpoint. Active-generation token rejects stale browser generations before commit. Browser edit check only; route lacks server Board authorization. | Generation integrity mechanism, not Brain or Insights. It overlaps AI Review in using model rewrites, but operates automatically pre-commit against generator defects. |
| AI Review | `index.html:726`; `app.js:13521-13924,14669-14802`; `api/review-node.js` | Select one node, then **Review Node** in Inspector | Full selected-node content and metadata, campaign summary, connected-node context, Board id, and browser Board Brand Core. | Score 0–10, summary, up to four strengths/improvements, and suggested rewrite. It is converted to an `ai_review` post-it/comment, with the approved Brand avatar as author image where available. The comment is embedded in the node and thus `canvas_json`; activity is browser state embedded with Canvas if serialized. | Adding the review changes the Board and invokes `saveCampaignCanvasState()`, so it can autosave. | OpenAI Responses `gpt-4o-mini`. Browser prohibits read-only use; server route has no authentication or Board authorization and accepts client Brand context. | Artifact-specific critique and collaboration record. It overlaps Brain advice, but its durable location and direct artifact scope make Node Inspector/comments the correct home. |
| AI Review suggested fix | `app.js:13602-13843`; `api/apply-review-fix.js` | **Apply Fix** beside one improvement, then explicit **Apply** or Dismiss in Inspector AI workspace | One persisted review improvement, current node body, node type/id, Board id, and browser Board Brand Core. | A transient preview contains explanation and suggested content; only explicit Apply replaces `node.content`. Preview is not persisted; applied text is. Suggested rewrite in the review card itself is display-only. | Preview: no. Apply: yes, records activity and calls Canvas save/autosave. | OpenAI Responses `gpt-4o-mini`. Browser read-only checks on request and apply; endpoint lacks server authorization. | Smallest field-specific repair with confirmation. Overlaps generic Refine/Improve and future Brain refinement; stays Inspector and should share future advice infrastructure. |
| Node review scores | Same AI Review files | AI Review card in a node post-it | Model judgment over supplied node/Brand/campaign context; no rubric version or measured outcome. | Score string is stored inside comment text, not a typed metric, so parsing reconstructs the card. | Yes as part of the post-it. | Model-generated, not deterministic and not measured. Same access limits as AI Review. | Review signal only. Must never appear in Insights as campaign performance. |
| Inline refine / improve / regenerate / next step / full content pack | `app.js:14480-15007,16377-16534`; `api/refine-node.js`; `api/generate-next-step.js`; `api/generate-image.js`; `api/generate-posting-visual.js` | Node toolbar and Inspector actions | Selected node, direct parent/connected nodes, campaign summary, browser Brand Core, platform/format/instruction. | Rewritten node content, generated next-step node, content pack, image prompt/image/social content. Applied directly after request; image URLs/content persist in Canvas. | Yes; these mutate Canvas and call save. | OpenAI Responses `gpt-4o-mini` for text; `gpt-image-1` / Images edits for visuals; some generated assets use Blob storage. Browser edit guard; most AI routes lack Board authorization. | Canvas/Inspector authoring. Considerable overlap exists among Improve, Regenerate, Full Pack, Apply Fix, and a future Brain’s “help refine”; Brain should deep-link to these explicit artifact actions, not duplicate them. |
| Strategic Diagnostics | `app.js:10642-11191` | No standalone UI; automatic Campaign V3 quality evaluation and console diagnostic payload | Generated node text/types and generation setup/context | Deterministic optimization issues for generic titles/body, short bodies, landing problem quality and variation similarity; score/dimensions. Transient; logged/returned in generation result. | No independent write or autosave; contributes diagnostic context but `repairRecommendation.shouldRepair` is currently false. | Pure browser deterministic heuristics; no API/model; available only inside an edit-triggered generation lifecycle. | Generator quality/readiness, not performance. Shared Campaign infrastructure should own it; Brain may explain, Insights may summarize only with a “Canvas diagnostic” label. |
| Social Diagnostics | `app.js:10780-10854` | No standalone UI; invoked by Strategic Diagnostics during generation | Generated social caption and inferred/configured platform | LinkedIn length/paragraph/takeaway/style, X 280-character constraint, TikTok hook, and Instagram visual/community-context issues. Transient and deterministic. | No independent mutation/autosave. | Browser heuristics, no server/model. | Platform-content quality rules. They belong with generation/Inspector diagnostics, not measured Insights. |
| Existing campaign analysis | `app.js:5000-5253` | Opening Brain or Insights; Brain **Refresh analysis** | Current in-memory nodes/edges and `state.brandCore` | Health, funnel coverage, platform counts, CTA/ICP/tone/trust scores, strengths/weaknesses, and suggested next nodes. Not persisted. `analysisLastUpdatedAt/error/refreshing` are memory only. | Viewing/refreshing: no. **Create node** recommendations mutate Canvas and save. | Synchronous deterministic browser functions. No API/model. Navigation itself is not access-gated; recommendation write relies on read-only guard. | Structural Canvas diagnostics shown twice. It is the central Brain/Insights overlap and uses score language that can be mistaken for performance. |
| AI Brain current shell | `index.html:239,562-565`; `app.js:5219-5251,15841-15870,16806-16809` | Sidebar **AI Brain** or Dashboard **Talk to Brand** | Same current Canvas analyzer inputs; not Canonical Brand detail, not selected-node focus, and no user question | Static campaign summary, deterministic health score, issues, suggestions, suggested nodes, and four inert quick-action buttons. Refresh adds an artificial delay. No conversation or persistence. | Suggested-node creation can modify/autosave; the inert quick actions do not. | No server/model. All Board viewers can navigate; read-only users cannot successfully create a suggestion. | Marketed as “AI strategist & creative partner” but is duplicated deterministic analysis, not an advisor. |
| AI Insights current shell | `index.html:240,558-561`; `app.js:5197-5217,15841-15870,16802-16805` | Sidebar **Insights** | Same current Canvas analyzer inputs | Health/funnel/platform/CTA/ICP/tone/trust cards plus three recommended nodes. No date range, provenance, analytics, actual/simulated label, or persistence. | Cards do not; create-node recommendation does and saves. | Deterministic browser logic; no server dependency. Visible to all who can load the Board. | Canvas readiness disguised as insights; completely overlaps current Brain’s analysis and recommendations. |
| Brand avatar | `app.js:8471-8778`; `api/generate-brand-avatar.js`; `api/_image-storage.js` | Brand Workspace Brand DNA/avatar lifecycle | Accepted Board Brand DNA, Board Brand Core/assets/logo, optional direction | `gpt-image-1` avatar URL/prompt; user approval state is stored under `brandCore.brandDNA.avatar`, locally and in Board snapshot after save. Approved avatar is reused for Brand Workspace/dashboard/boards and AI Review author identity. | Generation/acceptance changes Board Brand Core and saves; never Canonical automatically. | Image API and Blob storage. Browser requires accepted DNA and editability; endpoint validates DNA acceptance but does not authenticate/authorize Board. | Brand identity representation. It belongs in Brand Workspace; Brain may use the approved representation without making avatar generation a Brain action. |
| Brand archetype / Brand DNA | `app.js:8022-8879`; `brand-dna-generation-preflight.js`; `api/discover-brand-dna.js`; `api/_archetype-guidance.js` | Brand Workspace discovery/review/acceptance and Founder Story follow-up | Board Brand Core and accepted knowledge modules; deterministic preflight; model inference | Draft DNA, primary/secondary archetype and confidences/reasoning/signals; only explicit acceptance persists to Board Brand Core. | Draft does not; acceptance saves Board. | OpenAI Responses (model selected in handler), deterministic readiness/preflight and static archetype guidance. Browser edit guard; discovery route lacks Board auth. | Derived Brand intelligence. Brand Workspace owns creation/acceptance; shared context exposes accepted values to Campaign and future Brain. |
| Canonical Brand Core | `app.js:2940-4300`; `api/brands/index.js`; `api/brands/[id].js`; `api/_brands-storage.js`; `api/_brand-access.js` | Brand switcher, Brand Workspace detail/edit/compare | Server `brands.brand_core`, revisioned and role-authorized | Durable Canonical Brand JSONB and revision/timestamps. | Canonical edits change Brand, not existing Board snapshots; explicit initialize/refresh copies it to a Board and saves there. | Authenticated Brand APIs enforce Owner/Admin/Editor write and Viewer read. | Cross-Board Brand authority. Brain needs authorized read access but must identify it separately from Board snapshot. |
| Board Brand Core, ICP, positioning, messaging, tone, Founder Story | `app.js:6270-9068,7667-8069`; `api/_brand-brain-context.js`; `api/_strategy-module-generation.js`; Knowledge Module files | Brand Workspace on the current Board; compare/initialize/refresh actions | `state.brandCore`, loaded from authorized `boards.brand_core_snapshot`; built-ins plus typed custom modules. ICP/positioning/Founder Story can be custom modules; personas, value proposition, messaging, tone are built-ins. | Board-scoped snapshot JSONB with Canonical provenance; local `brandBrainState:<board>` recovery copy. Module drafts/accepted states live within custom tiles. | Edits save local state, mark dirty and can autosave Board; strategy generation draft is reviewed before explicit Apply/save. | Mostly deterministic UI; some module generation uses authenticated `_strategy-module-generation`, which reloads saved Board snapshot server-side. | Campaign-specific Brand truth. Brand Workspace owns editing; shared infrastructure supplies it. It can intentionally diverge from Canonical and must not be silently overwritten. |
| Canvas context and connected-node context | `app.js:5000-5058,14377-14685` | Implicit in review/refine/next-step/generation actions | Current in-memory Canvas—including unsaved edits—plus selected node, direct parent/children and campaign summary | Context only; no separate persisted record. Model response may later become Canvas content/comment. | Context creation does not save; action results may. | Browser-derived. Server cannot independently prove freshness or authorization on most AI routes. | Essential shared context. Brain should understand it; Inspector remains the artifact editing location. |
| Funnel/campaign simulation | `app.js:5000-5230`; `docs/product/simulation-architecture.md` | Current Insights/Brain funnel-coverage cards only | Presence of node funnel-stage labels | Coverage of five stages; no traffic, conversion, probability, cohort, time, spend, revenue, model, scenario, or actual outcome. | Not persisted except source nodes. | Deterministic set coverage. | **No simulation currently exists.** Funnel coverage is topology/readiness only. The architecture document is future design, not runtime capability. |
| Performance/analytics data | `app.js:5197-5217`; storage/API schemas | “Campaign Insights” cards imply it, but no entry point ingests data | Node counts/content only | No measured metrics or analytics persistence | No | No analytics endpoint, connector, event schema, attribution model, warehouse adapter, or scheduled import exists | **No actual campaign performance data exists.** Platform distribution is a node count, not reach or performance. |
| Knowledge Module registry | `knowledge-module-registry.js`; `knowledge-module-dependency-engine.js` | Indirectly powers Brand Workspace organization/readiness | Static definitions for stable module types, sections, categories, capabilities and knowledge-graph metadata | Registry definitions are code; evaluation diagnostics are runtime-only. `moduleType` and tile state persist in Board snapshot. | Registry read: no. Module workflows may save after explicit edits/Apply. | Deterministic browser/CommonJS shared module. | Shared Brand knowledge taxonomy, not a product destination. Several “future capabilities” are declarations, not implemented AI/history/search behavior. |
| Knowledge Module identity | `knowledge-module-identity.js` | Invisible | Web Crypto UUID where available, fallback UUID-like value | Stable `km_…` custom-tile instance id persists with tile | Only when a module is created/saved | Deterministic; no server | Prevents index/title identity drift. Shared infrastructure. |
| Knowledge Module runtime adapter | `knowledge-module-runtime-adapter.js` | Invisible; consumed by Brand Workspace/context logic | Registry, built-in Brand Core keys, custom tiles, persisted `moduleType` and stable id | Normalized runtime views with definition/capabilities/value/presence/runtime key; not separately persisted | No | Deterministic browser/CommonJS adapter | Compatibility bridge between legacy Brand Core shape and module registry. Shared infrastructure; Brain should consume it rather than invent a second module map. |

### 2.3 Campaign V3 lifecycle detail

1. An editor explicitly enters setup and starts generation; read-only Boards are rejected in the browser (`app.js:11591-11639`). A generation token is stored in `state.activeCampaignGeneration`.
2. `/api/generate-campaign` receives setup, `campaignLanguage`, Board id, and client-supplied Brand Core. OpenAI returns strict-schema nodes and edges.
3. Browser normalization constrains counts/types and creates Landing Page or Email fallbacks where needed.
4. Deterministic quality and Strategic/Social Diagnostics evaluate required content, generic/internal wording, duplicates, CTA/subject/landing fields, specificity, differentiation, and platform suitability.
5. Failed quality selects at most three nodes for one sequential repair pass through `/api/refine-node`; each repaired node is merged and the complete set is evaluated a second time. Failures retain the original node and the lifecycle continues with best available output.
6. A stale generation token is checked before plan creation and again before Canvas commit. Deterministic `campaign-v3.js` plan, edge, layout, and real-Canvas commit checks prevent invalid structure from being committed.
7. Only a successful active result creates nodes/edges. Normal Canvas persistence/autosave then stores them. Diagnostic objects remain console/result data and are not a durable provenance record.

This is a sound separation to retain: model generation, deterministic validation, bounded repair, deterministic structure, then commit. It is not an Insights pipeline and should not be moved into Brain.

### 2.4 Current browser and server AI surfaces

**Browser entry points:** Create Campaign; node Improve/Regenerate/Generate Next Step/Review Node/Apply Fix; content pack and image/posting visual generation; Brand DNA discovery/reassessment; Brand Avatar generation; Founder Story/strategy-module generation; AI Brain and Insights navigation. `app.js` holds almost all orchestration in one legacy global script, so IDs, templates, event binding order, browser globals, and state shape are compatibility constraints.

**Model-backed or AI-adjacent server routes:**

* Campaign/node: `/api/generate-campaign`, `/api/refine-node`, `/api/generate-next-step`, `/api/review-node`, `/api/apply-review-fix`.
* Visual: `/api/generate-image`, `/api/generate-posting-visual`, `/api/generate-brand-avatar`.
* Brand knowledge: `/api/analyze-brand-domain`, `/api/discover-brand-dna`, `/api/generate-founder-story`, `/api/generate-market-research`, `/api/generate-business-plan`, `/api/map-founder-story-website`, and website extraction/import helpers.
* Shared context/logic: `api/_brand-brain-context.js`, `api/_archetype-guidance.js`, `api/_strategy-module-generation.js`.

The established authenticated Board/Brand routes are `/api/boards`, `/api/boards/:id`, sharing/presence/editor routes, `/api/brands`, `/api/brands/:id`, Brand members, and document routes. Of the AI routes, `_strategy-module-generation` and Founder Story website mapping/import paths demonstrate the safer pattern: authenticate, authorize Board edit access, and reload the saved Board snapshot server-side. Most general AI endpoints currently lack that enforcement. Future Brain/Insights work must not copy that weakness.

### 2.5 Existing tests and Runtime Boot Safety

`.github/workflows/runtime-boot-safety.yml` runs syntax checks for the registry, identity, adapter, `app.js`, and `campaign-v3.js`; browser script integrity; BW-1 through BW-13 foundations; BW-15, BW-16, BW-18 through BW-21.1 and BW-23; Canonical Brand; and Knowledge Module browser-global checks. Additional local scripts cover Campaign V3, accepted module context, Brand DNA/Founder Story, document import, knowledge modules, strategy modules, website retrieval/security, and workspace behavior, but not every script is registered in Runtime Boot Safety.

Existing focused coverage relevant to this audit includes `scripts/campaign-v3-harness.js`, `scripts/check-accepted-module-campaign-context.js`, `scripts/check-brand-dna-generation-preflight.js`, Founder Story/Brand DNA lifecycle checks, Knowledge Module registry/identity/adapter/security checks, BW-18/BW-19/BW-20 authorization checks, BW-21/BW-23 language checks, and `scripts/check-browser-script-integrity.js`. There is no dedicated regression contract for Brain-versus-Insights labeling, metric provenance, AI endpoint authorization, AI Review persistence/staleness, or Brain response language because those product boundaries do not yet exist.

## 3. Current data and persistence inventory

| State/data | Current store | Durable? | Authority/freshness notes |
|---|---|---:|---|
| Current nodes, edges, comments/post-its including AI Review text, activity and Canvas metadata | Browser `state`; serialized `canvas_json`; legacy/local draft under `campaignCanvasState` | Yes after save; local recovery also exists | Saved Board is server authority; browser state may be newer and unsaved. AI Review score is untyped comment text. |
| Board Brand Core | `state.brandCore`; `boards.brand_core_snapshot` JSONB; board-scoped `brandBrainState:<board>` local storage | Yes | Board campaign truth with source revision/update/copied-at provenance. It may intentionally or accidentally differ from Canonical. Server serializer can withhold it from unauthorized/public viewers. |
| Canonical Brand Core | `brands.brand_core` JSONB with `revision`, timestamps | Yes | Canonical cross-Board authority. It does not automatically overwrite Board snapshots. |
| Brand DNA/archetype/avatar | Nested in Board Brand Core; draft/loading/reassessment in browser state | Accepted values: yes; draft/transient flags: no | Derived, user-approved Brand knowledge. Avatar assets may additionally be persisted in Blob storage. |
| Knowledge modules, Founder Story, ICP/positioning/strategy modules | Built-ins and `customTiles` inside Board Brand Core; stable tile id and `moduleType` | Yes | Accepted module content is context; draft/unaccepted states must remain labeled. Strategy route reloads saved Board snapshot, so it intentionally excludes unsaved context. |
| Brain/Insights analysis | Recomputed by `analyzeCampaign`; `analysisRefreshing`, `analysisLastUpdatedAt`, `analysisError` in memory | No | Current Canvas heuristic only; “last updated” is lost at reload and not a data timestamp. |
| Strategic/Social/generation diagnostics | Function return values and console logs | No | Deterministic for a particular generated payload/code version; not a persisted analysis record. |
| AI Review fix preview | `state.aiReviewFixPreviews` | No | Request-local and keyed only by node id; no Board revision/content hash/request generation guard. |
| Campaign generation response/repair diagnostics | Active promise/result and console | Only final Canvas artifacts | `state.activeCampaignGeneration` protects against superseded campaign commits, but no server idempotency or revision binding exists. |
| Authentication/access | Signed session cookie; server-derived Board/Brand access; browser `state.boardAccess` | Session/server state | Browser capability flags control UI but must not authorize AI data access on their own. |
| Measured analytics | None | No | No source, schema, endpoint, timestamp, units, provenance, or retention. |
| Simulated metrics | None | No | Funnel stage coverage is not simulation. |

No standalone persisted AI conversation, recommendation object, analysis run, diagnostic snapshot, metric series, model/version metadata, prompt version, source manifest, assumptions, confidence, usage/cost, or request status currently exists.

## 4. Existing authorization matrix

### 4.1 Implemented boundaries

Server Brand roles are Owner, Admin, Editor, Viewer. Owner/Admin/Editor can read and edit Canonical Brand and all Brand Boards; Viewer can read Canonical Brand and Brand Boards but cannot edit. Owner/Admin manage members; only Owner manages admins. Board membership independently supports Owner, Editor, and Viewer. A Brand role can grant Board access for a Brand-associated Board. Public Viewer is token-scoped and read-only; serialized public data omits Brand Core and other sensitive fields. Signed-out unrelated users cannot read private Boards; an anonymous valid public-token holder is a Public Viewer.

`api/_board-access.js` currently maps:

* Board Owner, Board Editor, unowned-board claimant, Brand Owner/Admin/Editor → `canEdit: true` and Board Brand Core visibility.
* Brand Viewer and Board Viewer → read-only Board access; Brand Viewer can see Board Brand Core, while Board Viewer cannot unless another Brand role grants it.
* Public Viewer → read-only public serialization, no Board Brand Core/presence/private collaborator data.
* Unrelated signed-in and anonymous users → no private Board read.

The browser consistently disables many Board mutation actions through `isBoardReadOnly()`. However, model routes commonly do not call `getSessionUser()`/`getBoardAccess()`. Therefore the effective current model-route boundary can be “any caller that can reach the deployment and supply JSON,” irrespective of the Board UI role. This is a pre-existing issue to preserve—not worsen—in this audit, and a prerequisite for a real Brain.

### 4.2 Recommended capability matrix

“Existing analysis” means persisted, provenance-safe analysis in the future; current transient heuristic views can remain readable wherever the Board itself is readable, subject to sensitive-source redaction.

| Role | View existing analysis | Request new AI analysis | Use Canonical Brand | Use Board Brand Core | Modify Canvas | Save recommendation |
|---|---|---|---|---|---|---|
| **Brand Owner** | Yes for Brand Boards | Yes | Yes | Yes | Yes | Yes, with explicit confirmation |
| **Brand Admin** | Yes for Brand Boards | Yes | Yes | Yes | Yes | Yes, with explicit confirmation |
| **Brand Editor** | Yes for Brand Boards | Yes | Yes | Yes | Yes | Yes, with explicit confirmation |
| **Brand Viewer** | Yes, read-only | **No by default**; later policy may allow metered non-writing analysis | Yes, read-only | Yes, read-only | No | No; may copy text outside Funklix, not persist to Board |
| **Board Editor** | Yes for assigned Board | Yes | **No unless separately a Brand member** | Yes, because Board edit access already permits snapshot use | Yes | Yes, with explicit confirmation |
| **Board Viewer** | Yes only if output contains no withheld Brand Core | No | No unless separately a Brand member | **No direct access** under BW-18 serialization | No | No |
| **Public Viewer** | Only public-safe, already persisted Canvas diagnostics; no hidden source excerpts or model re-query | No | No | No | No | No |
| **Signed-out user** | Only the same public-safe output when holding a valid public token | No | No | No | No | No |

Recommendations:

* Treat model invocation as a protected, metered operation requiring a signed-in user and `canEdit` for this first product generation. A future explicit Viewer entitlement can be evaluated separately; do not infer it from `canView`.
* Re-authorize every request server-side and load the allowed Canonical/Board source server-side. A Board Editor may use the Board snapshot but may not receive Canonical Brand data without Brand membership.
* Existing read-only analysis can be shown only after its source manifest has been filtered to the viewer’s current permissions. Public output must never disclose Brand Core, prompts, private comments, assumptions derived from private Brand knowledge, or hidden nodes.
* “Save recommendation” is a Board write and follows `canEdit`; saving into Canonical Brand additionally requires `canEditCanonicalBrand` and a separate Brand-specific confirmation. Brain must never turn advisory access into write access.
* These recommendations retain, rather than broaden, BW-18 through BW-20 boundaries.

## 5. AI Brain product definition

### 5.1 Definition and contract

**AI Brain is an active conversational advisor for an authorized Brand and campaign context.** It represents the Brand through an approved avatar and archetype; reasons over separately labeled Canonical Brand and Board Brand Core; sees the current saved/unsaved Canvas and selected/connected nodes; answers strategic campaign questions; explains diagnostic findings; identifies gaps; and proposes refinements grounded in ICP, positioning, value proposition, messaging, tone, channel, campaign goal, and funnel.

Brain outputs have four explicit classes:

1. **Advice** — model-generated qualitative recommendation. Non-authoritative; label “AI advice,” cite the sources/context used, explain rationale and uncertainty.
2. **Deterministic diagnostic explanation** — a plain-language explanation of a named/versioned rule result. The rule result remains authoritative only about what the rule detected, not business success; label “Canvas diagnostic,” and distinguish the deterministic finding from the Brain’s interpretation.
3. **Simulation** — scenario math over visible user inputs and explicit model-estimated assumptions. Label every value “Simulated,” show range/unit/period/assumptions, and never imply integration or observation.
4. **Authoritative/measured data narration** — explanation of source-backed Brand facts or future analytics. The underlying source remains authority; Brain must cite provenance/freshness and must not mutate measured values.

Brain is not: a replacement for Brand Workspace, a second Inspector, an automatic campaign generator, the owner of quality rules, a metrics database, or permission to edit. It can propose a patch/deep-link to the Inspector or Canvas. Applying any change is a separate explicit user action.

### 5.2 Context rules and important answers

* **Which Brand Core? Both, never silently merged.** The Board snapshot is the default campaign execution context because it is tied to the current Board. Canonical Brand is a separately authorized reference and cross-Board truth. Brain should show source badges and revisions/timestamps for both.
* **Disagreement representation:** identify field-level conflict (“Board positioning differs from Canonical revision 8”), quote only the minimum authorized values, state which source drove the answer, and offer navigation to Compare/Refresh. Never silently select Canonical, silently refresh, or portray the Board as erroneous when divergence may be intentional.
* **Unsaved Canvas:** include it when the user chooses current context, label “Unsaved Canvas,” bind the response to a stable context fingerprint/revision, and warn that collaborators/saved Board may differ. Saved Canvas remains the durable collaboration baseline.
* **Selected versus connected context:** selected node is focal; direct parents/children are supporting context; remaining Canvas is summarized. Brain should disclose scope (“selected node + 3 connected nodes + Board summary”) rather than imply omniscience.
* **Diagnostics:** Brain may display a compact diagnostic citation and explain, prioritize, or answer questions about it. It does not own calculation, severity, lifecycle, repair target selection, or persistence.
* **Inspector versus Brain:** Inspector owns current-field editing, AI Review card/comments, score, suggested rewrite, preview/diff, Apply/Dismiss, regenerate, image controls and node-specific actions. Brain owns cross-node/Brand/campaign reasoning, trade-offs, follow-up questions, and explanations; it hands proposed artifact changes back to Inspector/Canvas.
* **Automatic Canvas writes:** never. Not after a conversation, diagnostic, simulation, or “improve” request. Brain may prepare a proposed change set; each creation/update/deletion/connection/schedule/Brand change requires preview and explicit confirmation. Bulk changes require a summarized scope and one deliberately scoped confirmation, not hidden per-node writes.
* **Actions requiring confirmation:** add/update/delete/connect/reposition nodes; replace content; apply review fixes; save a recommendation/comment; launch generation; accept Brand DNA/avatar/module content; refresh Board Core from Canonical; change Canonical Brand; start cost-bearing simulation/integration where material; publish/export/send when those exist.
* **Persistence:** persist only user-approved Board artifacts/recommendations, optionally an explicitly saved/pinned conversation or decision, and future provenance-complete analysis runs. Keep drafts, streaming tokens, transient explanations, discarded previews, raw chain-of-thought, secrets, and hidden prompts non-persistent. Define retention/deletion before conversation history is introduced.
* **Stale rejection:** every request carries Board id, Board `updated_at`/revision or content hash, Brand id/revision, Canvas fingerprint, selected-node ids/content hashes, user identity, request id, and generation id. On response/apply, re-check current user/access and all relevant fingerprints. A mismatch marks response “Based on older context,” disables Apply, and offers regenerate/rebase; never merge blindly. Abort/supersede prior requests on Board, Brand, selection, language, or user change.

## 6. AI Insights product definition

### 6.1 Definition and contract

**AI Insights is a data-oriented analysis area for campaign evidence.** It presents measurable performance, comparisons, trends, anomalies, funnel metrics, findings, and recommendations only when every displayed metric has provenance: source/integration, account/campaign mapping, actual versus simulated status, definition/formula, unit/currency, time zone and period, attribution window/model where relevant, ingestion timestamp, and freshness/error state.

AI may summarize or recommend from that data, but it cannot upgrade an estimate to a fact. Measured source values remain immutable in the presentation pipeline; translation applies to surrounding labels, not raw campaign names, source dimensions, currency symbols, or source payloads. Comparisons require like-for-like definitions or a visible incompatibility warning.

Insights may contain three visually and semantically separate sections:

* **Measured performance** — only integration-backed observations, labeled “Measured” and source-cited.
* **Simulated scenarios** — only explicit scenario runs, labeled “Simulated projection,” never mixed into measured series/totals.
* **Canvas diagnostics** — deterministic structure/content readiness, labeled as such and never called results, impact, conversion, performance, trend, or effectiveness.

### 6.2 Missing required data sources

The repository currently has **none** of the following required measurement capabilities:

* ad/social/email/search/website analytics connectors or OAuth scopes;
* impression, reach, engagement, click, session, lead, conversion, retention, unsubscribe, or delivery event ingestion;
* CRM, ecommerce, booking, revenue, cost/spend, margin or offline conversion sources;
* campaign/node-to-external-entity mapping;
* account, property, pixel, UTM, event, goal, or conversion definitions;
* metric/event schema, time series storage, aggregation jobs, data warehouse/query adapter, or refresh scheduler;
* timezone-aware reporting periods, currency normalization, attribution model/window, identity resolution, deduplication, consent status, or data-quality/freshness metadata;
* baseline/benchmark/cohort/experiment definitions;
* provenance manifests, integration health, backfill, deletion, retention, or access-scoped analytics APIs.

There is also no actual funnel simulation runtime, assumption store, scenario version, calibrated estimate source, uncertainty model, or validation against outcomes.

### 6.3 What Insights should show before integrations

Before external analytics exists, Insights should lead with an honest empty state: **“No measured campaign data is connected.”** It should explain that current content can be evaluated for Canvas readiness but not performance, and—only for authorized editors—offer navigation to improve the Canvas. Existing deterministic cards may remain in a separately titled **Canvas diagnostics** summary with definitions and “Based on current Canvas structure; not measured performance.” Platform distribution must be “number of Canvas nodes by platform”; funnel must be “stage coverage”; all heuristic scores must disclose formula/rules or be replaced with plain findings later. It should not manufacture trend charts, benchmark comparisons, conversions, ROI, confidence, or “last updated” timestamps based merely on button clicks.

## 7. Feature destination matrix

“Later” means no move in BW-24 or the one package in section 14 unless explicitly included there.

| Audited feature | Recommended destination | Why / timing | Dependencies and user impact | Migration risk |
|---|---|---|---|---|
| Campaign V3 generation | **Campaign Canvas** | It creates the primary Canvas artifact; remain now and later | Existing setup, Brand context, quality gate, layout and save path | High if moved; no move |
| Generation repair loop | **Shared infrastructure** | Pre-commit generator integrity, invisible to navigation; remain | Authorized server context and stronger stale guards later | High: changes can alter campaign output; defer |
| AI Review card/comments/scores | **Node Inspector** | Artifact-specific critique and durable collaboration record; remain | Preserve post-it rendering and Board write confirmation | Medium due to legacy text parsing |
| AI Review suggested rewrite and Apply Fix preview | **Node Inspector** | Field-level proposed edit belongs beside field/diff; remain | Explicit Apply, edit permission, stale content hash needed later | High if stale preview overwrites content |
| Inline improve/regenerate/full pack | **Node Inspector** | Direct node authoring; consolidate language later, do not move now | Existing endpoints and explicit actions | Medium/high overlap and accidental-write risk |
| Generate Next Step | **Campaign Canvas** | Creates a connected artifact in campaign topology | Selected node, connected context, explicit confirmation | Medium |
| Strategic Diagnostics | **Shared infrastructure** | Deterministic generator/Canvas quality engine; remain | Versioned rule metadata and reusable result adapter later | Low if merely exposed; high if logic moved |
| Social Diagnostics | **Shared infrastructure** | Deterministic platform rule subset; remain | Same, plus platform-rule maintenance | Medium due to changing platform norms |
| Compact diagnostic display/explanation | **AI Brain** | Brain can prioritize/explain cross-campaign findings, but calculation remains shared; later | Stable diagnostic contract and provenance | Medium: avoid model reclassification |
| Detailed node diagnostic action | **Node Inspector** | Action belongs beside affected field | Rule-to-field mapping and preview | Low/medium |
| Existing `analyzeCampaign()` | **Keep temporarily where it is** | Shared synchronous implementation currently feeds both shells; relabel Insights first, then extract later | Tests and diagnostic definitions | Medium due to monolithic `app.js`/DOM coupling |
| Current health/CTA/ICP/tone/trust scores | **Retire later** | Opaque heuristic scores invite performance interpretation; replace with named rule findings unless formulas become product contracts | Migration copy, definitions, snapshots | Medium user expectation risk |
| Current AI Brain static duplicate summary | **Retire later** | It is neither AI nor conversation; do not remove until a scoped Brain replacement exists | Authenticated advisor service, lifecycle, language, cost controls | High if prematurely removed |
| Current AI Insights structural cards | **AI Insights** | Keep only as explicitly labeled Canvas diagnostics in first package | Honest empty state, definitions/provenance labels | Low; recommended first improvement |
| Suggested-next-node recommendation algorithm | **Campaign Canvas** | Its output creates Canvas nodes; show in Canvas empty/readiness flows, not measured Insights | Existing deterministic analyzer | Medium due to discovery/navigation changes; defer |
| Brain suggested-next-node display | **Keep temporarily where it is** | Avoid behavior change until Brain is rebuilt | Brain product work | Low now |
| Insights create-node buttons | **Retire later** | Measurement area should not be an authoring duplicate; replace with navigation/deep link, not direct write | IA transition and regression coverage | Medium; excluded from first package to preserve behavior |
| Canonical Brand Core editing/comparison | **Brand Workspace** | Cross-Board Brand authority | Existing BW-6–BW-13 and BW-20 boundaries | High; no move |
| Board Brand Core editing/modules | **Brand Workspace** | Board-specific Brand truth and knowledge lifecycle | Existing snapshot/save/provenance | High; no move |
| Brand DNA/archetype creation and approval | **Brand Workspace** | Derived Brand identity requires focused review/acceptance | Preflight, Founder Story, accepted knowledge | High; no move |
| Brand avatar generation/approval | **Brand Workspace** | Identity asset lifecycle, not conversation | Approved DNA, Blob/image API, confirmation | Medium |
| Approved avatar representation in Brain | **AI Brain** | Humanizes Brand advisor without displacing Canvas | Read-only approved avatar and accessible fallback | Low if decorative; mobile risk |
| ICP, positioning, messaging, tone, Founder Story | **Brand Workspace** | Source authoring and acceptance belong with Brand knowledge | Registry/adapter and explicit accepted/draft state | High if duplicated |
| Brand/Canvas prompt context normalization | **Shared infrastructure** | All AI consumers need one permission-aware source manifest | Server authorization, registry adapter, source labels | High security value; future prerequisite |
| Knowledge Module registry/identity/runtime adapter | **Shared infrastructure** | Stable taxonomy/identity/legacy compatibility | Preserve browser/CommonJS globals | High blast radius; no behavior changes now |
| Canvas and connected-node context | **Shared infrastructure** | Brain, generation, review, and Inspector need consistent context | Fingerprints, size limits, source manifest | High security/staleness concern |
| Future conversational advisor | **AI Brain** | Defined advisor responsibility | Protected endpoint, context authority, stale rejection, cost/stream lifecycle | High; defer |
| Future actual performance/trends/comparisons | **AI Insights** | Core measured-analysis responsibility | Integrations, mapping, metric store, provenance, auth | High; defer |
| Future funnel simulation | **AI Insights** for detailed scenarios; **AI Brain** may initiate/explain | Data-oriented scenario artifact belongs in Insights; conversation may set assumptions | Simulation engine/contract, assumption store, explicit labels | High hallucination/financial risk; defer |
| Runtime Alignment/Boot diagnostics | **Shared infrastructure** | Engineering diagnostics, not customer AI insight | Existing debug functions/workflow | Low; keep non-product |

### 7.1 Explicit boundary answers

1. **AI Review remains in Node Inspector and node comments.** Brain may reference or explain an existing review; it must not own the card, score, rewrite, Apply/Dismiss, or durable comment.
2. **Deterministic Strategic and Social Diagnostics remain shared Campaign Canvas/generation infrastructure.** Node-level detailed findings may render in Inspector. Insights may summarize them as non-performance Canvas diagnostics.
3. **Brain may display and explain diagnostics; it does not own or recompute them.** The deterministic engine owns codes, severity, score/formula and version.
4. **Inspector owns artifact-level review and changes; Brain owns cross-artifact conversation and strategic reasoning.** A Brain proposal deep-links into an Inspector preview.
5. **Before integrations, Insights shows a measured-data empty state plus clearly separated Canvas diagnostics/data-readiness.** No fake charts or performance claims.
6. **Simulated funnel results are labeled “Simulated projection—not actual performance” at chart, series, tooltip, table/export and summary levels**, with assumptions, ranges, units, period, version and run time.
7. **Brain uses both Brand Cores:** Board snapshot by default for campaign execution, Canonical as separately authorized reference.
8. **Disagreements are explicit field-level conflicts** with source/revision/freshness and the selected answer basis; only Brand Workspace Compare/Refresh resolves them.
9. **Brain never writes automatically.** It can prepare proposals only.
10. **Every mutation and material cost-bearing action requires explicit confirmation**, as detailed in section 5.2.
11. **Persist only approved artifacts, explicitly saved/pinned advice, and provenance-complete analysis/simulations.** Do not persist transient drafts, raw reasoning or discarded previews.
12. **Reject stale results using identity/access re-check plus Board/Brand revision, Canvas/selection hash, request/generation id and language context.** Disable apply on mismatch.
13. **Owners/Admins/Editors may use Brain and request Insights analysis; Viewers view authorized existing outputs only by default.** Exact role behavior is in section 4.2.
14. **Brand Viewer may see authorized Brand/Board analysis read-only; Board Viewer sees only analysis that does not reveal withheld Brand Core; Public Viewer sees public-safe persisted Canvas diagnostics only.** None may request, mutate, or save by default.
15. **Interface chrome follows `uiLanguage`; campaign artifact output remains governed by `campaignLanguage`.** Brain’s conversational response needs a deliberate contract described in section 10.

## 8. Data-authority hierarchy

Authority is contextual, not a single destructive precedence merge. The following order tells Brain/Insights what may establish facts and what must be labeled; a lower source cannot silently overwrite a higher source. Explicit user instructions can constrain a task but cannot rewrite persisted Brand truth or turn simulated/advisory material into fact.

| Rank/source | Authoritative for | May be stale? | Persisted / modifiable | Required UI label |
|---|---|---:|---|---|
| 1. **Future measured analytics** | The observed metric, for its documented source/mapping/definition/period only | Yes—ingestion lag, corrections and integration errors | Persisted immutable/raw plus derived aggregates; changed by source/reprocessing, not model | **Measured** · source · account/campaign · definition · period/timezone · attribution · ingested/freshness |
| 2. **Canonical Brand Core** | Current cross-Board Brand truth for authorized Brand members | Yes relative to live business knowledge; revision identifies it | Server JSONB; Owner/Admin/Editor edit explicitly | **Canonical Brand** · Brand name · revision · updated time |
| 3. **Board Brand Core snapshot** | Intentional Brand/campaign truth bound to this Board | Yes relative to Canonical; provenance detects it | Server JSONB plus local recovery; Board editors modify; explicit Canonical refresh | **Board Brand Core** · copied-from revision/time · changed/out-of-date/diverged status |
| 4. **Current unsaved Canvas** | The user’s present working draft and selected/connected artifact context | Yes relative to collaborators/saved Board | Browser only until save; Board editors modify | **Unsaved Canvas** · local change indicator · context captured time/hash |
| 5. **Saved Canvas** | Durable shared campaign artifact baseline | Yes relative to current local draft or later collaborators | `canvas_json`; authorized Board editors modify | **Saved Canvas** · Board updated time/revision/author when available |
| 6. **Explicit user instructions** | Requested task, constraints and declared scenario inputs for this run | Can conflict with Brand or become outdated | Request/transient unless explicitly saved; user can revise | **User instruction** or **Scenario input**; conflict callout where applicable |
| 7. **Deterministic diagnostics** | Reproducible fact that rule version X detected condition Y in input hash Z | Yes when inputs or rules change | Currently transient; future result may persist with rule/input versions | **Canvas diagnostic—not performance** · rule/version · scope · generated time |
| 8. **AI-generated advice** | Nothing factual by itself; a non-authoritative interpretation/proposal | Yes immediately after context changes; may be wrong | Transient by default; explicit save/pin only with source manifest | **AI advice** · sources/scope · generated time · model/service version where supportable |
| 9. **Simulated metrics** | The output of a named scenario under declared inputs/assumptions only | Yes if assumptions/model/input changes | Persist only explicit scenario save with full provenance | **Simulated projection—not actual performance** · range/unit/period/assumptions/version |

Operational resolution:

* Measured analytics outranks estimates **only for the metric and period measured**; it does not override Brand positioning.
* Canonical outranks a Board snapshot as cross-Board Brand truth, while the Board snapshot remains the default authority for this campaign until an editor explicitly refreshes/resolves it.
* Unsaved Canvas outranks saved Canvas for answering “what I am editing now,” but must never be represented as shared/saved state.
* A user can say “explore a new audience” as a scenario, but that does not mutate Canonical/Board ICP or authorize unsupported factual claims.
* Diagnostics, advice and simulation never become Brand or measured truth by being repeated, saved, or presented with a score.

## 9. Simulation and measured-data rules

There is no simulator to implement in BW-24. Any future funnel simulation must satisfy all of these rules:

1. Show an assumption ledger before and with results. Identify each value as **user input**, **measured baseline**, **deterministic calculation**, or **model estimate**.
2. Label every simulated number, chart series, comparison, tooltip, summary, export and recommendation **“Simulated projection—not actual performance.”** Never use “results,” “current conversion,” or “performance” without qualification.
3. State units, currency, denominator, funnel-stage definition, cohort, channel, geography, time zone, and time period. Percentages require numerator/denominator definitions.
4. Keep user-adjustable inputs visually and structurally separate from model estimates; changes produce a new scenario version, not mutation of historical measured data.
5. Prefer ranges/scenarios (low/base/high) over false precision. Explain confidence limitations and sensitivity; “confidence” must not imply statistical calibration unless calibrated evidence exists.
6. Cite any measured baseline and its freshness/attribution. If none exists, say “No measured baseline connected.” Do not invent an integration, benchmark, historical result, customer behavior, spend, revenue, or conversion rate.
7. Store formulas/engine version, inputs, assumptions, source manifest, output range, creator and timestamp for any explicitly saved scenario. Never merge simulation rows into measured tables/series.
8. Brain may help formulate or explain the scenario; the deterministic simulation service owns math. A language model must not be the unlogged calculator/source of numeric truth.
9. No simulation automatically writes Board or Brand data. Saving a scenario and applying a recommended Canvas change are separate confirmed actions with separate permissions.
10. No guaranteed reach, conversion, revenue, ROI, profitability or other financial outcome. Include non-guarantee language near financially material projections.
11. Reject stale scenarios when Canvas, Brand, measured baseline, mapping, attribution or engine version changes; allow viewing as historical with a stale label, not silent recalculation.
12. Validate bounds, units, division-by-zero, missing stages, incompatible periods/currencies, extreme inputs and output overflow. Preserve an auditable calculation trail.

Measured-data rules:

* Preserve raw source values and identifiers; localize formatting only. Never translate/mutate campaign names, source dimensions or underlying values.
* Distinguish source observation from Funklix-derived metric and AI finding. Derived metrics expose formula; AI findings link to the supporting series.
* Never impute missing data silently. Gaps, partial periods, sampling, delayed sources, mapping ambiguity and revoked integrations remain visible.
* Authorization applies at Brand, Board, integration/account and metric-output levels. Cached/persisted summaries must be re-filtered after role or sharing changes.

## 10. Language behavior

BW-21/BW-23 establish independent `uiLanguage` and `campaignLanguage`, with interface translation through `FunklixLanguage` and campaign-generation instructions through `campaignLanguage`.

* **AI Brain interface:** navigation, controls, empty/loading/error states, source badges, diagnostic labels, confirmation UI and accessibility text follow `uiLanguage`.
* **AI Brain response contract:** recommend reusing `campaignLanguage` for the first Brain implementation. Brain is campaign work product, often contains proposed copy and must remain aligned with generation/Inspector output. The composer should state “Responses and proposed campaign content: [campaign language]”; a user may explicitly request another language for one response without changing stored settings. This avoids prematurely adding a third preference and prevents `uiLanguage` changes from unexpectedly translating campaign advice.
* A distinct **Brain response language** preference may be considered later only if research shows users consistently want strategic discussion in an interface language while campaign artifacts stay in another. It is deferred because it adds settings, persistence, prompt, fallback and mixed-thread complexity.
* **AI Insights interface:** all product chrome, headings, metric definitions supplied by Funklix, empty/error/freshness messages and AI narrative follow `uiLanguage`.
* **Measured source data:** raw values, original campaign/ad-set/creative names, UTM values, source-provided dimensions and stored payloads are not translated or mutated. Locale may format dates/numbers/currency without changing the underlying value; source text can be accompanied by a clearly marked translated explanation later.
* **Campaign content:** generated/repaired node content, suggested rewrites and campaign-facing simulation copy remain governed by `campaignLanguage`. Enum keys, node types, diagnostic codes, IDs, formulas and provenance identifiers remain stable.
* Persist the language context with any future saved AI response/scenario and include language in stale-request identity. Current Brain/Insights hard-coded English is incomplete language coverage and must be treated as legacy, not the desired contract.

## 11. Information architecture

### 11.1 Sidebar destinations

Both **AI Brain** and **AI Insights** should remain separate navigation destinations because the user intent is different: Brain starts with a question/decision; Insights starts with evidence/measurement. Their summaries may cross-link but must not duplicate full features.

* **Home:** current Brand/Board orientation and next work, not detailed AI or analytics.
* **Campaign Canvas:** campaign artifact topology, generation and direct authoring.
* **Boards:** Board discovery/management.
* **Brand Workspace / Brand Core:** Canonical and Board Brand truth, modules, comparison/refresh, DNA/archetype/avatar acceptance.
* **AI Brain:** conversation, cross-context strategy, explanations and proposed changes. Empty state: identify the active Brand/Board, available context and missing context; invite a campaign question; state that advice does not edit the Canvas without confirmation.
* **AI Insights:** measured evidence, provenance and comparisons. Pre-integration empty state: “No measured campaign data is connected,” explain Canvas diagnostics versus performance, and link back to Canvas rather than fabricate analytics.

### 11.2 Movement between work areas

* Canvas → Inspector by selecting a node; Inspector → Brain via “Discuss this node” later, carrying a disclosed snapshot, not a hidden live write channel.
* Brain → Canvas/Inspector via “Review proposed change,” focusing the affected node and showing diff/Apply. Brain → Brand Workspace via source conflict/missing-knowledge links. Brain → Insights via “View evidence/scenario” for any metric claim.
* Insights → Canvas/Inspector via a read-only finding link to relevant nodes; navigation must not apply changes. Insights → Brain via “Ask about this finding,” carrying metric ids/source manifest rather than pasted, untraceable prose.
* Brand Workspace → Brain via “Discuss this Brand context” later; source remains read-only in the conversation unless separately edited/confirmed in Brand Workspace.

### 11.3 Avatar and summary/detail division

Use the approved Brand avatar as a modest identity cue in Brain header/message attribution and as already used for AI Review comments. Provide initials/icon fallback and descriptive alt text. It must not become a large mascot, overlay, floating Canvas obstruction, animation, or competing primary CTA—especially on mobile. Avatar generation/approval remains Brand Workspace.

Summaries show scope, status, the few highest-priority findings, provenance/freshness and a route to detail. Detailed Brain view holds conversation/source manifest/proposed changes; detailed Insights holds metric definitions, series, comparisons, data quality and assumptions; Inspector holds field-level evidence/diff/actions. Do not copy the same full recommendation cards into all three locations.

No final visual design is proposed by this audit.

## 12. Security, lifecycle, cost, and legacy risks

| Risk | Current evidence / failure mode | Required control direction |
|---|---|---|
| Duplicated AI features | Brain and Insights render the same analyzer; Inspector has multiple overlapping rewrite actions | Destination contract, shared context/diagnostics, deep links instead of duplicated Apply paths |
| Conflicting Brand sources | Browser sends Board `state.brandCore`; Canonical exists separately with revision/provenance | Separate source manifests, default Board snapshot for campaign, visible conflict, explicit Compare/Refresh |
| Stale Canvas/unsaved changes | Most AI requests have no content fingerprint; fix preview is node-id keyed | Board/Brand revisions, Canvas/node hashes, request generation, abort/reject and rebase UX |
| Hallucinated metrics | No measured source exists, yet Insights uses health/quality scores | Honest empty state, actual/simulated/diagnostic types, metric provenance required by schema/UI |
| Hidden simulation assumptions | No simulator contract currently exists | Assumption ledger, units/periods/ranges, input-versus-estimate separation and immutable run record |
| Excessive model cost | Many per-node/full-pack calls; repair can call up to three sequential refinements; refresh shell looks AI-like | Server auth, quotas/rate limits, request sizing, dedup/cache where safe, cost confirmation/status and usage telemetry |
| Long-running requests | Generation, sequential repair and image/module calls; limited cancellation | AbortController/request ids, timeouts, durable job design where needed, progress/cancel, stale-response suppression |
| Authorization leakage | Most AI handlers accept client Brand/Board context without `getSessionUser/getBoardAccess`; public serialization intentionally withholds Brand Core | Authenticate/authorize server-side, load sources server-side, field-level output filtering, never trust client Board id/context |
| Viewer access | UI guards writes but request endpoints are callable; outputs may encode hidden Brand facts | Separate view/request/save capabilities, server enforcement, output provenance/redaction, public-safe persisted-only analysis |
| Prompt injection | Brand, Canvas, website and document text can contain instructions; some strategy routes explicitly delimit evidence, others vary | Treat all content as untrusted evidence, stable system policy, delimit sources, tool allowlist/no arbitrary tools, output validation, adversarial tests |
| Unsafe automatic writes | Refine/full-pack applies responses directly; future Brain could amplify this | Brain proposal-only contract, diff/confirmation, fresh authorization and content hash at apply, bounded transaction/undo |
| Inspector/Brain overlap | Both could “review/improve/explain” | Inspector owns field edits and Review; Brain owns cross-context reasoning and hands off proposals |
| Legacy DOM dependencies | Monolithic `app.js`, hard-coded IDs/templates/globals and load order; tests assert source strings | Small additive/extraction steps, preserve IDs/global load order, browser integrity and boot tests |
| Incomplete language coverage | Current Brain/Insights and AI Review strings are largely hard-coded English | `uiLanguage` chrome, explicit response language, `campaignLanguage` artifacts, mixed-language regression tests |
| Mobile layout | Sidebar destinations, Brain avatar/conversation, Inspector handoff and dense Insights tables can compete | Progressive disclosure, compact avatar, single-column summaries, no Canvas overlay; test narrow viewport when UI work occurs |
| Unversioned scores | AI Review score stored as prose; current diagnostic formulas have no UI definition/version | Typed provenance/version before analytics reuse; never compare incompatible score versions |
| Race/cross-Board response | Generation has token checks, but review/refine/avatar/module flows have inconsistent identity guards | Common lifecycle controller bound to user/Board/Brand/node/language and response-time reauthorization |
| Sensitive logs | Generator logs raw AI response and extensive diagnostic/context payloads | Production-safe structured logging, redaction, retention and access controls |
| Cost/security denial of service | Unauthenticated AI/image routes can consume provider quota | Auth, authorization, body limits, per-user/Brand quotas, rate limits and idempotency before Brain launch |

## 13. Deferred capabilities

The following are intentionally **not** part of this audit or the first package:

* conversational Brain UI, thread/history storage, streaming, retrieval, tool use or new prompts;
* moving/removing AI Review, Inspector actions, Campaign V3 generation/repair, Strategic/Social Diagnostics, Brand Workspace, avatar or archetype flows;
* analytics integrations, OAuth, event ingestion, metric schemas, attribution, data warehouse, trend/anomaly engine, reports or exports;
* funnel simulation, assumption/scenario persistence, benchmarks, forecasting, ROI or financial projection;
* new APIs, database fields/tables, dependencies, roles, permissions, settings or language preference;
* shared AI endpoint authorization remediation (important prerequisite, but it needs its own carefully scoped security package and regression suite);
* extraction of `analyzeCampaign()` or decomposition of legacy `app.js`;
* score formula redesign, diagnostic versioning or typed AI Review migration;
* visual redesign, responsive/mobile redesign, avatar redesign or sidebar restructuring;
* automatic Canvas/Brand writes, background recommendations, scheduled analysis or autonomous agents.

## 14. Exactly one next implementation package

### Package: Honest AI Insights baseline

**Goal:** make the existing Insights destination truthfully useful before integrations by separating deterministic Canvas readiness from measured performance, without rebuilding Brain or changing any calculation/write flow.

**Included behavior (and only this behavior):**

1. Keep the existing Insights route and `analyzeCampaign()` calculation.
2. Add an Insights empty/readiness message: **“No measured campaign data is connected.”** Explain that Funklix is showing current Canvas diagnostics, not actual results.
3. Rename/qualify current sections in Insights only: health → “Canvas readiness”; funnel → “Funnel-stage coverage”; platform distribution → “Canvas nodes by platform”; scores/findings → “deterministic Canvas diagnostic—not measured performance.” Add a compact “Based on current Canvas” provenance/freshness note and define that refresh occurs on render.
4. Preserve all current Canvas, Inspector, Brain, AI Review, suggestion buttons, Board state, autosave and authorization behavior. Do not change formulas or move actions in this package.
5. Use existing `uiLanguage` translation infrastructure for every new interface string; do not modify campaign content or `campaignLanguage` behavior.
6. Add one focused source regression check registered in Runtime Boot Safety asserting: the measured-data empty-state contract exists; diagnostic/performance distinction exists; no analytics API/model call was added to `renderCampaignIntelligence`; both sidebar destinations remain; existing suggestion action and read-only guard remain; and only expected UI/source/workflow files are involved in that future package.

**Explicitly excluded:** any Brain behavior; conversation; prompts/models; APIs; analytics integration or invented sample data; database/schema/dependency/config changes; simulation; score/formula changes; removal/movement of AI Review, diagnostics or authoring actions; authorization changes; automatic writes; persistence; broad component extraction; visual redesign.

**Why this is the smallest safe meaningful improvement:** it corrects the highest-risk product claim—heuristic Canvas structure appearing to be campaign performance—using the existing deterministic renderer and navigation. It gives Insights an honest purpose and empty state now, preserves all workflows, and avoids the much larger authorization/context/lifecycle work required for a real Brain. The regression proposal protects the boundary without pretending analytics exists.

No second implementation package is recommended here.
