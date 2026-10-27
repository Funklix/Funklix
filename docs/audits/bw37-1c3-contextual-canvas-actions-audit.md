# BW-37.1C-3 — Contextual Canvas Actions Audit

Date: 2026-10-27 (Europe/Berlin). Repository: Funklix/Funklix.
Audited main: `55ba1342e8a539dda3dda3acee1eb3839f758136`, merge of PR #826.
Audited tree: `1ca52cf3b99e49fbcb58a650c0b25a7edb52c5c4`.
Status: proposed direction for review; audit and documentation only.

## A. Executive summary

Extend the existing explicit Content proposal flow through one contextual **Add to Canvas** action, with a bounded source selection, editable destination preview and separate **Create node** confirmation. Canvas remains the node/editing/persistence owner; Brain owns advice and ephemeral proposals. Preserve **Create Campaign** and **Suggest Brand Update** as separate destination-owned handoffs. No advice, classification, preview, cancellation or navigation may automatically create a node.

**First implement package A: Content proposal security/privacy hardening.** Do not broaden eligibility or add types first. The current proposal endpoint lacks explicit `store:false`, independent canonical Brand authorization, active-identity/Workspace checks, and pre/post-inference context revalidation. More seriously, it calls `getBoardAccess` with `columns: 'id, name, updated_at'`. The helper adds `brand_id` but not `owner_id`/`owner_email`; missing owner values are treated as unowned, granting a signed unrelated actor `unowned`/edit access. A provider-free probe of the actual helper reproduces this. Ordinary Advice and the hardened generation boundary already protect against missing ownership projections; those protections have not reached this route.

The registry has eight types: `Idea`, `Campaign Variation`, `Content`, `Social Media Posting`, `Landing Page`, `Email Campaign`, `Visual Concept`, `Image Brief`. **Messaging and Strategy are not types.** Visual types use the common text-node contract; there is no verified separate `visualConcept` or `imageBrief` object. Social has a dedicated contract and renderer: storing copy only in `content` would hide it on its card. Registry membership alone is insufficient authorization to add an AI proposal adapter.

After A, package B improves Content eligibility, exact source extraction and editable preview. Package C adds small, separately verified adapters, beginning with common-text visual types and then Social. Abstract strategy remains in conversation; a concrete messaging asset can be reviewed as Content without changing canonical Brand messaging. Full campaign concepts continue through Creator.

### Evidence and scope

Read: [AGENTS.md](../../AGENTS.md), [product architecture](../constitution/product-architecture.md), [intelligence architecture](../product/product-intelligence-architecture.md), [previous handoff audit](./bw37-1c-ai-brain-action-handoffs-audit.md), [Campaign handoff implementation](../implementations/bw37-1c-2b-ai-brain-campaign-handoff.md), and the implementation/tests cited below. Current source supersedes older audit claims.

The supplied checkout was at #825 (`85832ec3c44b01c2ccfb95ddbc1d57fa0e6e0df3`); Git fetch failed because the executor proxy was unreachable. GitHub connector reads verified main/#826 and supplied its eight-file patch. Applying it locally produced exactly the GitHub main tree SHA above (`git write-tree`), including unchanged files. A local materialization commit is only an inspection aid; delivery must parent the real audited main and contain documentation only. No production data, credentials, live provider calls, database changes or deployment were used.

## B. Verified current Content-node workflow

All named browser functions below are in [app.js](../../app.js). The endpoints and helpers are linked explicitly; names are stable search anchors at the audited commit.

| Step / owner | Verified behavior and boundary |
|---|---|
| Advice / Brain | `requestAiBrainAdvice` sends a signed-session `/api/ai-brain/advice` request with current Board, Canvas projection, selected node, mode, response language and bounded history. Successful turns hold exact question/answer, assumptions, reference resolution and `brandProposalSource`. Ordinary Advice never calls `createNode`. |
| Advice authorization / server | [advice.js](../../api/ai-brain/advice.js) loads explicit owner columns, rejects missing owner fields, requires Board edit, independently resolves canonical Brand read, uses authorized approved-Learning context and pre/post revalidation, and sends `store:false`. Clarification may avoid inference. These are Advice guarantees, not proposal guarantees. |
| Eligibility / Brain | `aiBrainHasReusableContent` requires success, non-clarification and answer ≤12,000 characters. It strips simple heading/list/bold syntax, finds a recognized asset label, then requires audience/message/purpose fields or a labelled copy body ≥80 characters plus CTA. It examines the entire suffix after the label, so later unrelated sections can satisfy fields. It does not extract an isolated asset. |
| Affordance / Brain | `renderAiBrainTranscript` offers **Prepare as Content node** only when eligibility and `canUseAiBrainProposal` pass: email, saved Board, cached edit access and no public token. #826 hides this preparation affordance if Campaign and Brand actions both qualify, keeping at most two. This precedence can also explain an absent CTA. |
| Prepare / Brain | `requestAiBrainNodeProposal` captures Board ID, email, Board-load generation, current projected Canvas/selection identity and UI/content languages, then posts the **entire answer** to [propose-node.js](../../api/ai-brain/propose-node.js). The header `X-AI-Brain-Generation` is not an authorization receipt. The server requires exactly nine body keys: action, board_id, canvas_context, content_language, response_language, selected_node_id, source_answer, source_turn_id. Action is `propose_content_node`. |
| Validation / server | POST only, request ≤350,000 bytes, source ≤12,000 characters, bounded Board/turn/selection identifiers, EN/DE language enums, `validateCanvasContext`. Canvas bounds: 200 nodes/400 edges; dangling references and invalid selection reject. See [_ai-brain-canvas-context.js](../../api/_ai-brain-canvas-context.js). Validation establishes shape, not authoritative ownership or correspondence to a saved Canvas. |
| Authorization / proposal server | `getSessionUser` authenticates the signed session via [_auth-session.js](../../api/_auth-session.js); one `getBoardAccess` call follows. The incomplete projection defect described in A defeats the intended edit check for ordinary returned rows. There is no independent canonical Brand check, active-identity/Workspace verification, saved association binding or post-inference recheck. Maintenance wrapper is not a substitute for access control. |
| Provider / proposal server | One POST to OpenAI Responses, `OPENAI_AI_BRAIN_MODEL` or `gpt-4o-mini`, strict `content_node_proposal` JSON schema; 25-second abort timer around fetch. Provider input consists of policy and source answer only. The supplied Canvas is validated but not added to `proposalMessages`; canonical Brand/Board snapshots and Learnings are not fetched or sent by this route. No explicit `store:false` or output-token budget. No automatic retry, classifier, repair or language-repair call. |
| Proposal / server | [_ai-brain-node-proposal.js](../../api/_ai-brain-node-proposal.js): `createProposal`, `validateProviderProposal`, `validateResponseProposal`. Content-only, title 1–120, body 1–4,000, rationale ≤500; normalized newlines, forbidden controls/prototype keys/unknown keys rejected. Provider strict schema requires rationale, while runtime validators tolerate omission/empty rationale. Server adds random 24-byte base64url `proposal_id` and echoes bounded source turn. IDs are not signed, persisted, one-use capabilities or proof of source origin. |
| Receive / Brain | Response must echo action/Board/languages and pass `validateAiBrainNodeProposal`. Controller identity, cached permission, Board/email/load generation and projected Canvas identity are rechecked before `ready`. This binds the response to the request-time context; it does not prove that the answer originated in that current context. |
| Preview / Brain | `renderAiBrainTranscript` renders title/body/rationale with `textContent`, plus **Create node** and **Cancel**. Current preview is read-only, fixed to Content, and lacks a source excerpt/type picker. Preparing/previewing causes no Canvas mutation; preparing does cause one provider call. |
| Explicit create / Canvas | `applyAiBrainNodeProposal` requires ready state, cached permission, matching Board/email/load/Canvas, valid Content proposal and unused ID. It marks applying/consumes ID, calls `pushHistorySnapshot`, then `createNode({type:'Content', position:aiBrainNodePlacement(), initial:{title,content:body}})` once and `markUnsaved`. No parent or edge is passed. All IDs/layout/defaults are local owner-generated. |
| Reveal / navigation | `completeAiBrainNodeCreation` uses the existing Canvas navigation button, then selects/fills Inspector/focuses the new node after layout; `revealAiBrainCreatedNode` pans within toolbar/Inspector bounds without changing zoom/positions. Same-context ephemeral conversation survives navigation. |
| Local persistence / Canvas | `createNode` pushes `state.nodes`, renders, updates lists/selection/Inspector, logs activity and calls `saveCampaignCanvasState`. `serializeState` uses `sanitizeNodeForPersistence`; localStorage receives the Canvas, not Brain transcript/proposal. `markUnsaved` sets dirty and schedules existing autosave. A local “Saved”/“Node created” status is not a server persistence receipt. |
| Server persistence / Boards | `saveBoardToServer` serializes Canvas and Board Brand snapshot, submits PUT `/api/boards/:id` with `lastKnownUpdatedAt`, and validates returned ID/timestamp before updating the saved baseline; edits made during saving remain dirty. [boards/[id].js](../../api/boards/[id].js) independently authenticates/authorizes using full owner projection, checks supplied revision and stores Canvas JSON. It does not share the proposal route's incomplete-owner projection. |

### Failure and recovery

Server failures: 400 invalid source/shape/language, 401 session, 403 edit denial, 404 missing Board, 413 size, 502 provider/output/language, 503 missing provider setup, 504 fetch abort, 500 unexpected failure. Output language mismatch rejects without repair. Logs disclose lifecycle booleans/classification rather than raw provider text. The fetch timer is cleared before response-body reading; it is not a proven end-to-end body deadline.

Browser recognizes typed error codes, handles non-JSON/404/405 as route unavailable and displays explicit retry. Each Prepare/Retry is a fresh paid conversion; no hidden retry is observed. Cancel marks cancelled and removes the preview; there is no cancel control while requesting. `cancelAiBrainNodeProposal` itself does not abort a controller; account/Board invalidation does abort pending proposal requests and clears Brain state. An abort cannot recall already transmitted source data.

Before-mutation creation failure restores history length and releases the applied ID. If a node was inserted before a later exception, the wrapper keeps the proposal consumed and reveals that existing node, preventing a duplicate retry. Existing history is capped at five snapshots; restoring length cannot recover an oldest entry shifted off a full history. Do not expand this into an unrelated history redesign.

Server-save errors retain local work; 409 offers load latest, save new or cancel/pause autosave. Load latest can replace local work and must use the existing explicit conflict choice. The general Board PUT revision check is optional and separate from UPDATE, not a demonstrated atomic compare-and-swap; do not describe it as the Creator's transactional/idempotent commit. This legacy persistence limitation is recorded, not changed here.

### Protection status on current main

| Protection | Current proposal state | Required treatment |
|---|---|---|
| Explicit provider `store:false` | **Missing**; present in Advice and hardened generation. | Set explicitly for the existing conversion request. Absence is not proof of actual provider retention settings, but fails the explicit privacy contract. |
| Board ownership | Intended edit check exists; **incomplete owner projection grants unowned edit**. | Include and validate ownership fields, fail closed for missing/malformed identity; use actual access helper in regression tests. |
| Independent Brand authorization | **Missing**; no canonical context fetched today. | Never infer canonical read/edit from Board edit. Preserve permitted Board-only conversion of supplied text; if a future path reads canonical Brand, independently authorize it, omit denied context, and never require Brand edit for a Canvas-only action. |
| Active actor / Workspace / association | **Missing** in proposal route. | Use persisted scope and existing read-only identity/access owners; no sidebar-supplied Brand authority. Define safe legacy/null-association handling explicitly. |
| Pre/post inference access and freshness | **Missing** after initial Board read; no expected saved scope in body. | Capture authorized scope and compare before provider dispatch and after completion. Reject changed actor/membership/Board revision/association; never return a stale proposal. |
| Browser request-time identity | **Present, partial**: Board/email/load/projected Canvas checks at reply/create. | Also bind exact successful source/question/answer and account object, persisted association, saved revision and relevant Workspace/catalog generation. Never rebase an old answer at Prepare time. |
| Preview/create source freshness | **Partial**: source turn ID checked, answer not compared with captured source at create. Projection truncates and omits some native fields. | Exact source snapshot + local owner identity; fresh access read before confirm in B. A Canvas projection fingerprint is not a full Canvas revision. |
| Confirmation and duplicate guard | **Present**: explicit Create, Content-only validation, per-session applied IDs. | Retain. This is not durable idempotency across reloads/tabs or a server capability. |
| Safe errors and retry | **Present, partial**: bounded codes, text rendering, one call, no automatic repair. | Preserve; add stale-scope/authorization races, response-body timeout/malformed output and no raw-error leakage tests. |

## C. Existing Canvas node inventory

Authoritative UI registry: `NODE_TYPES` in [app.js](../../app.js); the same eight canonical types are accepted in [_ai-brain-canvas-context.js](../../api/_ai-brain-canvas-context.js) and [refine-node.js](../../api/refine-node.js). `Social Media Post` is a legacy alias normalized to `Social Media Posting` in Brain projection/validation, not a ninth creation type. [campaign-v3.js](../../campaign-v3.js) deliberately generates six types, excluding the two visual types; that narrower generation registry must not replace the Canvas registry.

### Shared native fields, validation and editing

`createNode` creates all eight from the same object defaults: local `id`, `type`, clamped `position`; empty `title`/`content`; `status:'Draft'`; arrays `tags`, `variants`, `images`, `postits`; `contentFormat:'1:1'`; empty `audience`, `goal`, `channel`, `funnelStage`, `tone`, `imagePrompt`; `favoriteImageId:null`; `social:{platform:'Instagram',caption:'',hashtags:[],preview:'',scheduledAt:''}`; `landingPage:{headerVisualPrompt:'',headerClaim:'',problem:'',solution:'',trust:'',cta:''}`; `reactions:{}`, `compact:false`, `justConnectedAt:null`. Optional owner fields are sanitized separately; absent means unassigned. Scheduling, publishing/approval and planning metadata belong to their existing workflows.

These are native object defaults, **not eight strict required-content schemas**. Blank manual nodes are supported; title/content are not required by `createNode`. Its `initial` seam copies only title/content, and it does not itself allowlist `type`. `isValidCanvasStatePayload` validates the top-level arrays/version/zoom, not a strict per-type business schema. `sanitizeNodeForPersistence` preserves unknown native fields while normalizing status/owner/images and stripping transient loading flags. The Brain projection validator has stricter bounded read-context fields, not a complete persisted-node schema. The proposed AI contract must explicitly validate its own small field allowlist without tightening all legacy Boards.

Every type can be created through existing Add/type-picker/connector controls and edited through shared card title/content plus `fillInspector` and the `el.nodeForm` input handler. `renderNode`/`updateNodeCard` own cards, AI tools, safe text, selection and Inspector bindings. Common metadata remains optional. AI preparation should require a nonempty bounded title and meaningful asset text even though manual blank nodes are valid.

| Exact type | Purpose; native content fields (beyond shared defaults) | Rendering / creation and editing | AI suitability and additional risk |
|---|---|---|---|
| `Idea` | An initial campaign idea; `title`, `content`; optional audience/goal/channel/variants. No special nested object required. | Common text card and Inspector; manual/connector and complete V3 owner. Suggested next step Campaign Variation. | A specifically selected idea can fit; defer automatic routing so full campaign concepts continue to Creator. Never copy abstract strategy by default or generate a campaign graph from a single-node action. |
| `Campaign Variation` | One campaign variation; title/content and optional shared metadata/variants. | Common text card/Inspector, manual/connector and V3. Suggested next step Content. | Potential concrete alternative, deferred. An unselected list of alternatives must not become one blended asset or imply V3 lane membership. |
| `Content` | Reusable content idea/copy; title/content; optional imagePrompt, contentFormat, images, audience/goal/channel/tone/funnelStage. | Common text card, Content upload/format/image-prompt Inspector fields; variants control hidden for Content. Manual/connector, V3, content-pack and current Brain proposal. | First supported proposal. Message recommendation with actual reusable wording can fit. No canonical Brand update, image generation, pack generation or automatic follow-up calls. Existing initial seam supports title/content only. |
| `Social Media Posting` | An individual social post. Copy is `social.caption`, CTA is `social.preview`, hashtags are an array, platform is `social.platform`; channel is kept aligned. Optional content mirror/images; scheduling absent/empty by default. | Dedicated social card hides generic content; platform selector, caption/CTA/hashtags editor and character warnings. Social Inspector fields; uploads. Manual/connector and V3 adapter `applyGeneratedCampaignNodePayload` map nested social fields. | Strong fit after a dedicated adapter. Preview actual caption/CTA/platform/hashtags; never create a content-only social node, default silently to Instagram, invent hashtags/CTA, schedule, approve, attach destinations or publish. Platform limits shown by card are warnings, not universal schema validation. Approval material must start Draft without fingerprint. |
| `Landing Page` | Landing-page asset; title/content plus optional landingPage headerVisualPrompt/headerClaim/problem/solution/trust/cta. | Specialized landing fields/header-visual action and preview paths alongside common card. Manual/connector/V3 normalize and map LP fields. | Defer: partial section versus complete page and trust claims need explicit contracts. Never import fabricated proof, trigger visual generation or assume `initial` accepts the nested LP object. |
| `Email Campaign` | Email-related campaign asset; title/content with shared metadata/variants. No native subject/body/recipient/send-time object verified in constructor/Inspector. | Common text card/Inspector; manual/connector/V3; next-step mapping ends here. | Concrete email copy could fit later; defer separate mail-specific proposal schema. Never create sending/recipient semantics or assume this sends email. Generic messaging should normally use Content. |
| `Visual Concept` | Textual visual/art-direction concept in title/content; shared optional metadata/images. No specialized `visualConcept` nested schema or dedicated visual Inspector group. | Common text card and Inspector; manual/type picker/connector; accepted by read-context/refine allowlists, excluded from complete V3 type list. | Suitable small C adapter for one concrete visual description. Text only; no image URL, upload, generation, model instruction or fabricated visual asset. `imagePrompt` is shared storage, but Content-only Inspector visibility makes it an unsuitable primary field here. |
| `Image Brief` | Textual brief for a specific image in title/content; shared optional metadata/images. No distinct imageBrief object or required resolution/prompt fields verified. | Common text card/Inspector; manual/type picker/connector, accepted by read-context/refine allowlists, outside V3 list. | Suitable later C adapter when source is a concrete image brief. Preserve explicit composition/style/constraints as reviewed text; no image generation, arbitrary media URLs or invented technical requirements. |

### Relationships and connections

All eight share `state.edges` and `addEdge(fromId,toId)`: reject missing endpoint IDs, self and duplicate directed edges; existing native handler does not enforce a per-type graph or cycle rule. Connector UI chooses existing targets; current Brain create has **no connection**. `createNode({parentId})` positions relative to the parent and calls `addEdge`; `applyInherited` copies missing audience/goal/channel, and Social targets may inherit images. The suggested `NEXT_STEP_NODE_TYPE` chain is guidance, not a universal relationship validator. Complete Creator has its own lane/count/funnel-edge validation. Do not reuse Creator graph generation for single assets or let the model supply parent/edge/IDs. Initial contextual additions stay unconnected; any future Connect choice needs explicit reviewed target and existing owner validation.

Canvas messaging text does not grant permission to change Brand Core messaging. Strategy can be discussed, or a user may manually create a concrete Idea/Content; no `Messaging`, `Strategy`, Task or Decision schema is introduced by this audit.

## D. Proposed contextual action UX

Prefer **one Add to Canvas action**, with type selection inside the preview, over a row of Content/Social/Visual/Image buttons. It expresses one user intent, lets a user correct a deterministic suggestion and avoids crowding the conversation. Initially show only implemented type choices; package B offers Content alone. Do not advertise all eight simply because they are registered.

1. Successful result contains an identifiable concrete asset. Show the action alongside the existing owner-specific Campaign/Profile actions, using the current at-most-two preparation convention. If a result contains several candidates, require selecting one bounded excerpt/candidate before preparation; do not synthesize them. If all three owner routes qualify, use a compact secondary action disclosure so Canvas remains discoverable without three prominent buttons. Only implemented actions appear.
2. Open a source-selection review with exact excerpt and destination Board name. Deterministic extraction/selection is zero inference. State that preparation uses AI when proceeding through the existing provider conversion; action disclosure must precede that call. The current Content Prepare behavior can remain during A; no automatic call on menu opening or selection.
3. Show **Canvas node preview**, selected exact type, source excerpt and editable fields. For Content and visual text types: title and body. Social later adds supported platform, caption, CTA and hashtags. Rationale explains fit, not truth. Render source/proposal as inert text; input values use `.value`. No raw model HTML or auto-followed links.
4. Allow changing only to implemented compatible types. Conversion between common text types uses the same selected text without inference; Social requires an explicit valid field mapping. If a type needs unsupported fields, block with explanation or return to Content; never fabricate defaults to make a type fit. Preserve user edits when switching/back, disclose any field that cannot transfer, and require renewed review.
5. **Create node** rechecks identity/access/source, validates the edited draft, creates exactly one Draft node through the existing Canvas seam and consumes that proposal. No connection, schedule, publish, approval or Brand mutation. Add one undo snapshot and existing dirty/autosave transition; no manual server-save bypass. Clearly distinguish local creation from confirmed server save.
6. **Cancel**, Escape and **Return to conversation** cause zero node/edge/Brand writes or inference. Preserve same-Board transcript, composer/newer draft/caret, selected mode, Learning disclosure and scroll. Creation reveals the node/Inspector through existing navigation; provide a same-context return route. Account/Board changes destroy protected state; reopening never revives stale confirmation.

Accessibility/compatibility: EN/DE strings, Light/Dark, 320/375px and desktop/zoom; labelled native controls, keyboard selection, focus return without scroll jump, modal focus management/Escape, readable error/status. Preserve existing Canvas DOM IDs, `data-ai-brain-*` bindings or migrate only this narrow owner with regression coverage. Do not redesign the Canvas/Inspector to add this preview.

**Create Campaign** retains `aiBrainCampaignBrief`, `aiBrainCampaignSourceCurrent`, `revalidateAiBrainCampaignSource`, `openAiBrainCampaign` and `openStableCampaignCreation`: editable campaignIdea/additionalContext/channels, no inference until explicit Generate, complete V3/repair/provisional commit/rollback/save-only recovery. **Suggest Brand Update** retains `aiBrainValueProposition`, `aiBrainBrandSourceCurrent`, independent canonical edit comparison and Profile draft/explicit protected Save. Never route either through generic Canvas mutation. #826's source metadata can inform a small shared capture seam, but canonical-edit permission must not become the Canvas permission gate.

## E. Eligibility and extraction model

### Why #MyAppicsStory did not show the old Content action

No authorized exact historical user response was supplied with this request. We cannot claim a production replay or know its actual label/fields/action precedence. The earlier audit and current code establish a reproducible failure class: `Campaign concept`, `Kampagnenkonzept` and a standalone hashtag are not recognized asset headings. Natural paragraphs without the supported field labels also fail. Even a concrete post can fail because copy is shorter than 80 characters, CTA is unlabelled, audience/message/purpose is absent, or labels are phrased differently. Missing permission, pending/failed/clarification state, >12,000 characters and current all-three-action precedence are separate causes.

Provider-free probes of the actual current function establish: synthetic campaign-heading + audience/message/purpose = false; changing only to Content concept = true; equivalent German pair behaves the same; natural post prose = false; hashtag/general strategy = false; labelled substantial copy+CTA = true; later unrelated message/purpose can incorrectly complete an earlier Content section. Pending, clarification and oversized answers fail. These are fictional fixtures, not captured Appics output.

PR #826 now recognizes bounded natural EN/DE campaign concepts such as a community campaign inviting creators to share their stories and opens Creator. That addresses a **campaign initiative**, not the extraction of one actual reusable post from inside that initiative. “Launch #MyAppicsStory to build creator participation” is a campaign brief; “Here is one Instagram caption inviting creators to share a story…” with usable text is an asset. A campaign hashtag alone is neither sufficient. When both a campaign and a separately specified post exist, keep both owner routes without conflating the sources.

### Recommended deterministic model

Eligibility selects a candidate; it never authorizes execution. Require a successful non-clarification turn, unchanged source scope, bounded exact text and a single concrete artifact. Use modest EN/DE semantic cues, paragraph/list boundaries and the user's requested artifact together; Markdown labels are optional evidence. A social platform or “strategy” keyword alone cannot qualify. Exclude advice/questions/diagnostics, unselected competing alternatives, unsupported types, empty/oversized excerpts and mixed sections. Do not silently truncate or combine fields from unrelated sections.

Select exact source spans first; maintain original text and offsets/identity in ephemeral state. A visible user selection can resolve ambiguous multi-result prose and makes a conservative parser sufficient for the initial implementation. Selection must still contain concrete asset material, rather than making any general advice eligible. Do not rewrite all Advice to mandatory rigid labels just to make CTAs appear. Offer a short explanation when selected text needs clarification; never trigger classification inference to decide eligibility.

Mapping: concrete content idea/usable messaging wording → Content; explicit individual social copy → Social Media Posting only after its adapter ships, otherwise reviewed Content; concrete art direction → Visual Concept after adapter; specific image production brief → Image Brief after adapter. Abstract strategy/general advice → no automatic asset action. Campaign-wide concept → existing Create Campaign. Canonical value-proposition change → existing Profile route. Do not promote a claim, simulation or hypothesis into approved Brand truth.

### Structured-output alternative and actual call costs

Current ordinary substantive Advice normally has one existing inference; clarification may have zero. Current Prepare adds **one separate conversion inference**. Proposal preview/edit/Create/cancel/return add zero. Explicit preparation retry adds another conversion. No additional call was made by this audit.

For B/C, deterministic source selection followed by the **existing explicitly requested conversion call** can produce a strict allowlisted typed proposal. Extending that existing response schema in a later approved package need not add a call, but requires per-type validation, language/output budgets and an updated contract. Do not append a classifier, repair, summarizer or second call, or trigger conversion merely because an answer arrived. Type changes use local compatible mappings; unsupported conversions require a fresh disclosed user action or stay disabled.

Optional structured candidate metadata returned alongside an already-authorized Advice answer would also avoid a second round trip, but changes Advice schema/token budget, output parsing and conversational quality across modes. It is unjustified for the first packages given user-selected spans and the existing conversion seam. Revisit only with deterministic failures and an approved scope; the audit does not authorize extra inference, model changes or live paid evaluation. Deterministic rules have limited recall and cannot establish factual accuracy.

## F. Authorization, privacy and freshness boundaries

1. **Actor/Board:** signed session is necessary but not sufficient. Read explicit persisted ownership columns and validate their presence before access interpretation. An unrelated actor/viewer/public token must not spend provider calls on a guessed private Board ID. Resolve active identity and applicable Workspace membership through existing owners, never body/email/sidebar claims. Distinguish truly legacy unowned/null association from omitted columns; missing fields always fail closed. Define permitted legacy behavior from current owner policy rather than silently classifying all old Boards as newly invalid.
2. **Brand:** Canvas edit and canonical Brand edit are independent. Board-only editors may use permitted Board context and their supplied source without receiving hidden canonical context. Brand viewers with actual Board edit do not need Brand edit for Canvas creation. If canonical context is needed later, independently check canonical read on persisted Board Brand X, omit it if denied, and do not substitute sidebar Brand Y. No new canonical retrieval is necessary for today's source-only converter. Never use `canEditCanonicalBrand` as generic Add-to-Canvas eligibility.
3. **Before/after inference:** capture authoritative Board revision/ownership/association, actor and relevant Workspace state; immediately revalidate before dispatch and after provider completion. Compare the same scope; an internal change or access revocation invalidates the output. Add a bounded expected-scope envelope to the existing request if necessary to reject a remote save between source capture and dispatch. A client hash is only equality evidence, not authentication or attestation. Do not trust client Canvas as a saved-state authority; unsaved context remains permitted only as explicitly supplied untrusted source under current access.
4. **Browser/source:** capture successful turn ID, exact question/answer and selected span, account object/email, Board/load, local context, saved revision, persisted association, Workspace/catalog identity/generation and languages. Check on Prepare, reply, edit/type-change and Create; do not capture a fresh scope and attach an old answer to it. A fresh read before Create should use existing read-only owners; Board-detail GET may enrich editor identity. A hidden Brand or bounded Board list must fail safely with an explanation, not broaden visibility. Same-email new account object and change-away/change-back must invalidate old intent.
5. **No durable source proof:** the server currently has no persisted conversation to verify `source_turn_id`/answer. It can authorize the actor/Board and bind a request to scope, but cannot prove text originated in a prior Advice answer. Accept bounded supplied source as untrusted user input; do not claim browser snapshots or random proposal IDs establish historical provenance. A signed receipt/durable transcript would need a separate design and is not required here.
6. **Privacy:** explicitly `store:false` on the current Responses request. Preserve source-only input; validated Canvas must not accidentally become provider payload. Never forward entire transcript, hidden canonical values, Learnings, raw errors, cookies or account metadata. Proposal/source drafts stay ephemeral and out of analytics, URL and browser storage. Confirmed node text is intentionally part of Canvas persistence. No automatic external media loading or provider retry; maintain bounded output and end-to-end timeout handling.
7. **Mutation/save:** current cached create permission is not live server authorization. Fresh pre-create reads narrow races; server Board write remains final authority and must still reject revocation. Do not claim a read prevents a later permission race or that provider transmission can be recalled. Preserve dirty local work and explicit conflict recovery; distinguish confirmed save, local creation, known pre-insertion failure and unknown persistence outcome. Do not retry Create to recover a node that already exists.

## G. Phased implementation roadmap

| Package | Scope and smallest owners | Exit criteria / exclusions |
|---|---|---|
| **A — first: Content proposal security/privacy hardening** | `api/ai-brain/propose-node.js`, narrow read-only proposal-scope helper if needed, existing validators and minimal `app.js` request/source checks. Fix owner projection; independent scope/identity authorization; pre/post inference revalidation; explicit store:false; bounded provider response/timeouts; safe stale/retry results. Exact Content-only proposal behavior and human Create remain. | Real access-helper and actual handler tests with mocked DB/provider prove no unauthorized inference and no stale output. No broader eligibility, editable preview, new types, Advice/provider change, canonical retrieval expansion, migrations, generic mutation API or unrelated Board write refactor. |
| **B — existing Content eligibility/preview** | Existing Brain eligibility/request/render/apply controller; exact selected result/source spans, natural supported assets, editable title/body, source/destination review, fresh access check before explicit Create and same-context cancel/return. Initially Content only. | EN/DE positives and negatives, multiple-section isolation, edit validation, single undo/create, stale source and remote-scope races. Preserve previous accepted Content fixtures and one explicit conversion call; no automatic inference or Creator/Profile regression. |
| **C1 — common text visual adapters** | Small proposal type allowlist and Canvas adapter for Visual Concept, then Image Brief, using existing title/content and native creation/rendering. Enable only verified shipped choices. | Per-type source fit, editable preview, persisted roundtrip, common Inspector/undo/autosave; zero images/generated prompts/edges; no new persisted schema. |
| **C2 — Social adapter** | Explicit mapping of platform/channel/caption/CTA/hashtags, narrow nested validation and destination-owned population seam; reuse existing defaults/rendering/approval controls. Keep general Content fallback available. | No hidden content-only card, silent platform choice, approval/fingerprint, schedule/destination/publish or inherited images. Verify content mirror/field semantics, safe character-limit feedback and ordinary content/publishing regression contracts. |
| **Deferred** | Idea/Variation/LP/Email proposals only after clear product need and exact field contracts. | No Strategy/Messaging schemas; no batch graph creation, tasks/decisions, durable AI provenance, canonical learning/Brand updates or cross-Board reuse. |

Each package is separately scoped/reviewed. This audit authorizes documentation only. Future implementation must start from latest merged main and reverify these findings; privacy hardening precedes broader discovery/use of the conversion route.

## H. Risks and compatibility constraints

- **Access defect is present despite passing legacy tests.** BW-26.6.1 mocks `getBoardAccess` as already-authorized/denied and cannot detect the partial projection. Fix tests at the real helper/handler boundary, not by extending string assertions alone. Do not copy that fixture as security proof.
- **Registry versus schema:** common object storage accepts more than a safe proposal should. Avoid whole-node model payloads and broad object spreads. Model output never chooses IDs/coordinates/parent/edges/status/owner, activity/approval/schedule or Brand scope. Type correction must not drop edits or smuggle nested fields across adapters.
- **Preserve native lifecycle:** `createNode` already mutates state/renders/local-saves; do not insert a second node, save twice or add a second undo snapshot. Existing `addEdge` adds its own history snapshot; initial proposals remain unconnected. Preserve IDs, event bindings, Inspector, selection, autosave guards and existing history/restoration behavior; do not promise or add a new redo system.
- **Partial creation:** mutation can precede a rendering error. Keep applied state if the node exists; never offer duplicate retry or falsely claim persisted success. Maintain existing save-conflict handling. General Board PUT's non-atomic optional revision contract is a known limitation and a separate persistence-owner concern.
- **Freshness is narrower than a string fingerprint:** Brain projection truncates long fields and excludes fields such as position/images/goal/imagePrompt. Use appropriate owner/source identity without treating it as full saved Canvas proof; do not invalidate unrelated conversation drafts just to retire proposals.
- **Owner separation:** Profile's protected one-field draft/Save and Creator's complete V3/rollback/transaction/reconciliation must remain intact. Creator's generated six-type schema is not the eight-type Canvas registry. Generic Add to Canvas must never bypass their authorization or write contracts.
- **Eligibility is imperfect:** conservative rules miss valid prose and cannot verify truth. User selection improves precision, not quality assurance. Keep campaign-wide advice, factual hypotheses and user-reviewed asset copy distinct; no automatic canonical learning or measured-results claims.
- **Verification limits:** no exact historical Appics payload or production telemetry, live permissions, provider quality/storage configuration or deployment inspection. Browser launch failed in this sandbox; full CI/PostgreSQL results are not claimed from partial local checks. Remote permission races persist between read boundaries and final Board save.

## I. Deterministic acceptance and regression matrix

Future tests must exercise actual owner/controller functions and captured requests, with fictional fixtures, mocked provider transport and disposable DB only where needed. Existing checks are regression evidence; passing them does not prove the proposed packages exist.

| Area | Deterministic acceptance | Retain / extend |
|---|---|---|
| A: real Board access | Full owner projection permits owner/editor; unrelated/viewer/public/anonymous denied before any provider call. Partial/malformed projection rejects; truly unowned legacy case follows explicit owner policy. Prove fake/real DB returns only requested columns so this defect cannot hide behind a canned owner object. | BW-26 read-only; BW-26.6 and .6.1; `_board-access` and signed-session route fixtures. |
| A: independent permissions | Board X editor without canonical X read can convert permitted supplied text without hidden context; Brand viewer + Board edit allowed for Canvas; Brand-only viewer without Board edit denied. Sidebar Y never retargets X. Accepted/disabled identity, Workspace membership and persisted association changes tested. | BW-36 Brand/Board isolation and BW-37.1C-2A generation-boundary fixtures; do not reuse canonical-edit eligibility. |
| A: inference privacy/freshness | Captured actual request has store:false, unchanged provider/model/schema, source-only bounded input, exactly one call. Revoke membership/change actor/Board revision/association before dispatch: zero calls. Change during provider await: no proposal returned. Failure to read authorization fails closed; no canonical leak. | Actual proposal route; Advice/approved-Learning and generation-boundary regressions. |
| A: transport/output | 401/403/404/409/413/502/503/504, network loss, HTML route response, malformed envelope/JSON, extra/prototype keys, bad type/language/control chars/limits, oversized body, delayed body, abort. Error strings/logs contain no source/provider internals. Explicit Retry only; no hidden repair or classifier. | BW-26.6.1 production response and BW-26.5 language suites. |
| B: eligibility | Natural EN/DE concrete post, content idea, reusable message; old labelled positives; campaign concept with no asset, hashtag, advice/strategy/question/diagnostic negatives; pending/failed/clarification/oversized; all five modes identical semantics. | `aiBrainHasReusableContent`; BW-37 Advisor and Campaign/Profile extractors. Synthetic Appics pairs, not a claimed production replay. |
| B: exact extraction | Several independent sections/alternatives cannot contribute mixed fields. Select exactly one supported bounded span; source preview matches exact answer. Unknown/empty/over-bound selections fail, no silent truncation. Campaign and asset excerpt route separately. | Actual extraction/controller tests; BW-26 history/reference resolution. |
| B: preview/confirmation | Open/select/edit/type/cancel/return cause zero Canvas/Brand writes; one explicit existing conversion only when requested. Edited valid title/body become exactly one Draft node; invalid edits cannot create. Repeat click creates once; no edge; no owner/status/model metadata. | BW-26.6, .6.2, actual Canvas/Inspector handlers; test mutation then renderer failure separately. |
| B: source/scope races | Exact source edited/retried, same-email account object replaced, Board/load or selection/Canvas changed, switch away/back, saved revision/association/catalog/Workspace changed, permission revoked before confirm. Old preview is retired; no retarget/automatic rebase; no disclosure of stale protected text after account change. | BW-36 safe switching, BW-37 workspace/Profile/Campaign race suites. |
| C: typed mapping | All shipped types validated client/server; reject non-shipped registered type. Visual text survives native serialize/reload/edit. Social caption/CTA/hashtags/platform render visibly; content mirror consistent; missing platform requires choice; no approval/schedule/publish/image generation. | `fillInspector`, `updateNodeCard`, Content/social native workflows and approval material tests. |
| Canvas lifecycle/save | IDs/bindings retained, one creation snapshot and undo restoration, existing history/redo behavior unchanged, selection/reveal/Inspector, no lost existing nodes/edges. Local storage separate from server save; autosave success/revoked permission/409/load-latest/save-new/cancel/unknown outcome retain established recovery; concurrent edits stay dirty. | BW-26.6.2; BW-36.16 adaptive Canvas; safe Workspace switching/canonical conflict; general Board persistence contracts. |
| Other handoffs/knowledge | Existing Campaign/Profile CTA precedence, independent ACL, prefilled editable Creator with zero call until Generate, V3 rollback/save-only reconciliation; Profile stage then separate protected Save; unrelated Brand Core/DNA/Avatar/Founder Story/Learnings unchanged. | BW-37.1C-1, C-2A/C-2B; BW-36.14R1, BW-36.15; BW-36.23 knowledge protection; BW-28 Insights handoff. |
| UI and source return | Keyboard/focus/Escape, Light/Dark, 320/375/desktop/zoom, translated EN/DE fields/status/errors. Same-context newer composer draft/caret/mode/disclosure/scroll preserved on cancel/return; account/Board change clears protected state. | Real browser shell/controllers; BW-37 workspace/advisor; C-1/C-2B browser tests. |

### Validation performed for this documentation change

- Verified GitHub main/#826 and exact locally materialized tree as recorded in A. Final PR must change only this audit and documentation index link(s); no application/test/CI/schema/migration changes.
- **PASS:** `node scripts/check-bw26-read-only-ai-brain.js`; `check-bw26-6-controlled-ai-brain-node-creation.js`; `check-bw26-6-1-node-proposal-production-failure.js`; `check-bw26-6-2-node-creation-ui-transition.js` (the last three also run with `node scripts/` prefix).
- **PASS:** `node scripts/check-bw28-ai-insights-architecture.js` (86 contracts); `node scripts/check-bw28-1-insights-ux-and-brain-handoff.js` (39); both verified all 47 classic browser scripts. `node scripts/check-bw36-23-brand-knowledge-protection.js` passed 15 contract/controller groups; it does not run the separate real PostgreSQL invariants.
- **PASS:** provider-free scratch probes exercised 12 cases of the actual current Content eligibility function, and the actual `getBoardAccess` function with a projection-aware fake DB reproduced partial-owner `unowned` edit versus full-owner denial. Scratch script is not a shipped regression test; package A must add lasting actual-handler/access coverage.
- **PARTIAL / browser blocked:** `node scripts/check-bw37-1c1-brand-profile-proposal.js` passed deterministic selection, actual Profile staging/save and signed Brand-handler/protected-service groups, then Chromium failed before browser cases. `node scripts/check-bw37-1c-2b-ai-brain-campaign-handoff.js` passed deterministic extraction, then browser launch failed. Both exited 1: sandbox `setsockopt: Operation not permitted`, Chromium SIGTRAP. Neither full suite is reported as passed. No test or sandbox policy was changed to conceal this limitation.
- Documentation review checks required A–J sections, exact eight-type coverage, local Markdown links, balanced fences, whitespace and documentation-only diff. Full runtime/browser/PostgreSQL CI remains distinct from these audit checks. No live provider evaluation, production SQL, merge or deployment.

## J. Complete directly copyable prompt for the first implementation package

```text
TENDRA ONE — BW-37.1C-3A: Content Proposal Security and Privacy Hardening

Repository: Funklix/Funklix. Implement only package A in
docs/audits/bw37-1c3-contextual-canvas-actions-audit.md.
Start from latest merged main, including #826 or later. Record exact base SHA;
audit baseline is 55ba1342e8a539dda3dda3acee1eb3839f758136 (2026-10-27 Berlin).
Read AGENTS.md, product-architecture.md, product-intelligence-architecture.md,
the full contextual Canvas audit and previous BW-37.1C handoff audit, current
C-1 Profile and C-2A/C-2B generation/Campaign implementation records first.
Current source overrides old audit assumptions; reverify before editing.

DELIVERY
Dedicated branch; commit/push completed work; exactly one normal non-draft PR
against main; verify draft:false. Never merge/deploy. If delivery is technically
impossible report BLOCKED and actual reason; never invent a PR URL.

OBJECTIVE / OWNERS
Secure the existing explicitly requested AI Brain -> Content proposal conversion.
Brain owns ephemeral source/proposal; Canvas creates only after human Create;
Boards owns persistence; Brand owns canonical knowledge. Preserve the working
Content proposal, Brand Profile handoff and Campaign Creator handoff. No new
node types, eligibility expansion, editable-preview redesign or generic apply API.

READ CURRENT OWNERS
app.js: aiBrainHasReusableContent, aiBrainCanvasProjection, aiBrainIdentity,
aiBrainRequestContextIdentity, successful-turn source capture/invalidation,
requestAiBrainNodeProposal, validateAiBrainNodeProposal, renderAiBrainTranscript,
applyAiBrainNodeProposal, completeAiBrainNodeCreation; createNode, history,
serializeState, local save, markUnsaved, scheduleAutosave and saveBoardToServer.
api/ai-brain/propose-node.js, api/_ai-brain-node-proposal.js,
api/_ai-brain-canvas-context.js, api/_auth-session.js, api/_board-access.js,
api/_brand-access.js, active identity/Workspace access owners, Advice authorization
and learning freshness, api/_campaign-generation-context.js and Board PUT owner.
Inspect actual BW-26/28/36/37 tests; do not trust mocked canEdit as ACL proof.

REQUIRED IMPLEMENTATION
1. Fix the proposal route's incomplete Board projection. Current columns are
   id,name,updated_at; getBoardAccess treats missing owner_id/owner_email as
   unowned/editable. Explicitly select and verify ownership fields before using
   access; fail closed for missing/malformed projection. Reject unrelated actors,
   viewers, anonymous/public-only and invalid sessions before provider dispatch.
   Do not change global Board role policy or tighten all stored Canvas schemas.

2. Resolve persisted Board scope and active application identity through existing
   read-only owners. Validate applicable Workspace membership and persisted
   association. Independently authorize canonical Brand access if any path reads
   it; Board edit does not grant canonical read/edit. Keep the conversion payload
   source-only: no new canonical, saved Brand or Learning retrieval for inference.
   A permitted Board-only editor must not gain hidden canonical context and must
   not need canonical Brand edit for a Content action. Brand viewer + actual
   Board edit remains valid. Sidebar Y never retargets Board X. Explicitly handle
   legitimate legacy/null association according to current owner policy; never
   confuse missing columns with an authorized unowned Board. Avoid copying the
   generation helper wholesale if its stricter campaign prerequisites would
   silently break valid legacy Content conversion. Use a narrow scoped helper
   or existing read seam without new authorization grants/persistence.

3. Capture authorized actor/Board/revision/association/applicable Workspace scope.
   Revalidate immediately before provider dispatch and after completion; reject
   permission/identity/scope/revision changes and unavailable authorization reads.
   If needed, minimally extend the exact request/envelope with bounded expected
   scope so a remote change since source capture fails before a paid call. Update
   client/server validators together, preserving normal Content behavior. A hash
   or header is not authority; compare against persisted data. Do not require a
   saved Canvas match for every unsaved field or treat client text as saved truth.

4. Bind browser intent to the exact successful source turn/question/answer and
   account object/email, Board/load, local context, saved scope/association and
   relevant Workspace/catalog generation. Check before request, after await and
   before explicit Create. An old answer must not be rebound to current scope
   merely by pressing Prepare. Keep existing UI/content language separation and
   request/response controller checks. Reject stale rather than silently rebase.
   Server has no durable transcript: do not claim source_turn_id proves origin.
   No durable conversation/receipt/token storage is needed in this package.

5. Explicit store:false on the existing Responses request. Preserve current
   model/provider and Content-only strict schema/field bounds, single existing
   user-requested conversion call and no automatic retry, repair or classifier.
   Provider input stays policy + bounded source_answer only. Keep Canvas context
   validation without forwarding it to the provider. Bound output parsing and
   end-to-end timeout (including response body), map safe typed failures, and
   never expose raw source/provider/internal errors in logs or UI. Preserve
   rationale compatibility and EN/DE validation; no language-repair inference.

6. Every Prepare/Retry remains explicit. Preview/Cancel/Create/navigation cause
   no additional inference; no Canvas mutation before existing human Create.
   Preserve single node/undo/dirty/autosave/reveal flow, applied-ID duplicate
   protection and partial-insertion recovery. Local node creation is not server
   save confirmation. Keep authoritative Board persistence/revision/conflict
   owners unchanged. Do not solve the separately recorded legacy optional,
   non-atomic Board PUT revision contract in this package.

VALIDATION
Add lasting tests of actual handler + real getBoardAccess with projection-aware
DB fixtures (and disposable PostgreSQL only where needed), not canned allowed
roles or string checks alone. Unrelated signed actor on private owned Board must
be denied before fetch. Cover missing/null/malformed owner fields; owner/editor/
viewer/public/anonymous; independent Brand read versus edit; Board-only actor,
Workspace/identity revocation; sidebar mismatch and legacy associations.
Capture actual provider JSON and assert store:false/source-only/exactly one call.
Change access/revision/association/identity before dispatch and during provider
await: zero call or no returned proposal as appropriate. Test stale source,
same-email new account, Board/load/catalog change, malformed/HTML/oversized or
delayed provider body, timeout/abort, language mismatch, safe 401/403/404/409/
413/502/503/504 and explicit retry without duplicates. No live/paid provider.
Retain existing Content schema limits, request language/context echoes and all
known accepted eligibility fixtures. Run BW-26 read-only/lifecycle/Content .6,
.6.1/.6.2/language, BW-28 Insights handoffs, applicable BW-36 lifecycle/Brand
knowledge, BW-37 Advice/Profile and C-2A/C-2B generation/Campaign regressions.
Exercise real shell/source/apply boundaries with mocked transport; preserve
transcript/newer draft/caret/mode/disclosure/scroll, Light/Dark/mobile/keyboard.
Run required syntax/integrity/CI. Report actual passes and blocked/skipped cases;
partial browser or SQL execution is not a full suite pass. Never weaken tests.

EXCLUSIONS
No Add-to-Canvas UI expansion, natural-language classifier, new type/schema,
new provider/model/call, live paid evaluation, automatic content extraction on
Advice arrival, campaign generation changes, image/media generation, edges,
publishing/scheduling/approval/owners, direct Brand write, Learning update,
new DB schema/migration, global role rewrite, Board save redesign, production
SQL/credentials/RLS/TLS changes, merge or deployment. Keep implementation minimal.

REPORT
Real non-draft PR URL, audited/new base SHA, exact files, fixed defects versus
remaining limits, actual verification and deferred B/C work. Update a narrow
implementation record and appropriate index. Do not claim semantic truth,
durable source provenance or elimination of every read-to-write permission race.
```

BW-37.1C-3 CONTEXTUAL CANVAS ACTIONS AUDIT READY FOR REVIEW
