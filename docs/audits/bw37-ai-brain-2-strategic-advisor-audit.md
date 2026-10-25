# BW-37 — AI Brain 2.0 Strategic Advisor Product & Repository Audit

- **Repository:** `Funklix/Funklix`
- **Audit date:** 2026-10-25 (Europe/Berlin)
- **Audited baseline:** `364d32deec7348b8182a7ae39a9cb09da17eca10`, latest merged `main` verified during the audit, including PR #814.
- **Status:** Approved audit reference, archived at the user's request before implementation.
- **Scope:** Verified current implementation and identified gaps; proposed BW-37.1A MVP and implementation prompt; deferred BW-37.1B/C/D recommendations.
- **Architectural authority:** Existing approved architecture remains authoritative. The proposed implementation and deferred recommendations below are distinguished from verified runtime behavior and existing architectural decisions.

**Archive note:** The complete preceding Codex audit is preserved below, including sections A–J and the directly copyable implementation prompt. The audit's statements that no PR was created and the repository remained unchanged describe the original audit activity; this documentation-only archival PR is a subsequent task. Historical validation results are audit evidence, not claims that those suites were rerun for this documentation change. Section J is an archived future implementation prompt, not an instruction to implement functionality in this archival task.

**BW-37.1A should extend the existing AI Brain with four optional conversation modes and stronger strategic guidance within its current Advice request.** The existing authorization, Learning retrieval, conversation lifecycle and read-only Advice boundary provide the foundation. No second AI system is needed.

**Verified baseline:** `Funklix/Funklix`, remote `main` and local HEAD both at `364d32deec7348b8182a7ae39a9cb09da17eca10`, including merge PR **#814**. All source references below refer to that commit.

This was an audit only. Repository files remain unchanged. No PR, deployment, production SQL or paid model request was performed.

## A. Verified current-state inventory

### Product ownership

The approved architecture already supports this direction:

| Owner | Responsibility | Source |
|---|---|---|
| Brand Brain | Canonical positioning, audience, messaging, voice and other Brand truth | `docs/constitution/product-architecture.md:127–175` |
| AI Brain | Conversations, recommendations, strategy discussions and creative sparring | `docs/product/product-intelligence-architecture.md:124–142` |
| Campaign Canvas | Nodes, connections and campaign editing | `docs/constitution/product-architecture.md:96–123` |
| Insights | Diagnostics, observations and evidence; separate from strategic conversation | `docs/product/product-intelligence-architecture.md:144–160`, `332–366` |
| Knowledge | Governed, reusable context with accepted/unverified distinctions | `docs/product/product-intelligence-architecture.md:180–196` |
| Humans | Strategic decisions and approval | `docs/product/product-intelligence-architecture.md:40` |

`docs/roadmap/README.md:5–17` lists AI Brain 2.0 as a product area, but does not define BW-37.1A–D implementation packages. The follow-on packages proposed below are recommendations.

### Existing runtime capabilities

| Capability | Verified behavior | Exact source |
|---|---|---|
| Existing destination | Sidebar navigation opens the existing `ai_brain` view | `index.html:301`, `690–692`; `app.js:20121–20124` |
| Existing presentation | Header, advisor avatar, Board context, selected node, saved/unsaved indicator, transcript and freeform composer | `app.js:6518–6601` |
| Existing primary interaction | `#ai-brain-question`, maximum 2,000 characters, submitted through `#ai-brain-form` | `app.js:6592–6596` |
| Draft preservation | Rendering reads the existing textarea before replacing the summary and restores its value afterward | `app.js:6588–6595` |
| Advice transport | One explicit POST to `/api/ai-brain/advice` | `app.js:6603–6612` |
| Signed session | Cookie token signature and expiration verification | `api/_auth-session.js:51–63`, `84–90` |
| Board authorization | Advice requires server-resolved `access.canEdit`; ownership columns must be explicitly present and valid | `api/ai-brain/advice.js:68–93` |
| Canonical Brand authorization | Canonical Core is resolved independently from the persisted Board’s `brand_id` | `api/ai-brain/advice.js:103–107`; `api/_ai-brain-learning-context.js:41–60` |
| Working Canvas | Browser projects bounded node and edge fields; server validates types, sizes, IDs, edges and selected-node membership | `app.js:6388–6405`; `api/_ai-brain-canvas-context.js:2–47` |
| Conversation memory | Up to four successful exchanges, 28,000 aggregate characters; failed/pending turns excluded | `app.js:6407–6418`; `api/_ai-brain-conversation.js:3–30` |
| Follow-up references | Ordered references use recent assistant history; recognized references without sufficient history receive clarification without inference | `api/ai-brain/advice.js:49–59`, `118–130`; `api/_ai-brain-conversation.js:8`, `33–35` |
| Approved Learnings | Server scans only the Board-associated Brand’s approved rows after independent authorization | `api/_ai-brain-learning-context.js:41–87` |
| Learning selection | Deterministic multilingual lexical ranking, deduplication and whole-statement packing | `api/_ai-brain-learning-context.js:120–150`, `171–197` |
| Token budgeting | Counts the assembled messages; reserves output/framing capacity; rejects an oversized base context | `api/_ai-brain-learning-context.js:154–197` |
| Freshness | Context capture plus revalidation immediately before inference and after inference | `api/ai-brain/advice.js:135–160`; `api/_ai-brain-learning-context.js:90–117` |
| Provider behavior | Existing Responses API, configured model, `store:false`, 25-second fetch timeout | `api/ai-brain/advice.js:132–157` |
| Language | Per-turn EN/DE instruction and mismatch rejection without automatic paid retry | `api/ai-brain/advice.js:20–44`, `162–167`; `app.js:6608–6620` |
| Safe answer rendering | Restricted Markdown converted into DOM elements; hostile text is not executed | `app.js:6475–6516` |
| Learning transparency | Optional disclosure explicitly says supplied Learnings were not necessarily used in every sentence | `app.js:6365–6383`, `6556`; `ai-brain-learning-context.css:1–6` |

### Authorization boundary: selected Brand versus Board context

The authorization chain is:

```text
Verified signed-session user
  → persisted Board resolved server-side
  → verified Board edit capability
  → saved Board Brand Core snapshot

Persisted Board.brand_id
  → independent canonical Brand authorization
  → canonical Brand Core, where authorized
  → independent active application identity + Brand Learning authorization
  → approved-only Learning retrieval

Client working Canvas
  → bounded structural validation
  → selected node must exist in that submitted Canvas
```

The selected sidebar Brand is a navigation preference. It is **not** the authority for Advice context.

Important consequences:

- Selecting Brand Y while Board A belongs to Brand X must leave Advice scoped to A/X.
- A Board editor without canonical Brand access can receive Board-only Advice, without canonical Core, Learning statements or Learning-library counts.
- Workspace membership alone does not grant Brand Learning access.
- A Brand viewer needs an independent Board edit grant to use Advice.
- The existing authenticated, genuinely unowned-Board capability remains part of `getBoardAccess`; BW-37.1A must not reinterpret it.
- Missing ownership fields must never be treated as an unowned Board.

Sources: `api/_board-access.js:88–149`; `api/_brand-access.js:25–56`; `api/_brand-learnings.js:123–143`; `api/_ai-brain-learning-context.js:17–19`, `41–73`.

**Canvas validation is structural validation of client working data.** It does not prove that every submitted node already exists in persisted `canvas_json`. That supports unsaved editing. The model must continue treating this material as working context, not canonical Brand truth.

### Home, Insights, Canvas and Inspector

**Living Workspace:** The current entry explicitly distinguishes the selected Brand from the open Board’s Brand. It uses existing navigation and focuses the existing composer without submitting a question.

Sources: `home-foundation.js:546–572`, `905–912`; `app.js:6837–6864`.

**Home diagnostics:** The original B2 document’s snapshot-only behavior is historical. Current runtime schedules local deterministic analysis when authorized Home evidence is missing or stale, reusing the existing diagnostic calculation.

Sources: `app.js:6327–6345`, `6727–6784`; `docs/implementations/bw36-21b2-r2-automatic-home-diagnostics.md:3–21`.

**Insights → Brain:** An existing explicit action validates a current finding, builds a bounded question, opens Brain and fills the composer. It does not submit automatically.

Source: `app.js:6929–6940`.

**Canvas and Inspector:** Existing creation/editing responsibilities remain outside ordinary Advice. BW-37.1A needs no new Inspector action.

**Existing Content-node handoff:** AI Brain already offers “Prepare as Content node,” a separate model request, preview and explicit creation action.

Sources: `app.js:6442–6466`, `6565–6582`, `6678–6695`; `api/ai-brain/propose-node.js:38–53`.

Therefore, “AI Brain is read-only” is accurate for **Advice**, but does not describe every existing Brain-adjacent action. BW-37.1A should preserve this established explicit handoff without invoking or extending it.

### Diagnostic distinction

Advice and Insights currently use different diagnostic contracts:

- Advice: `api/_ai-brain-diagnostics.js:5–37`, version `bw25-canvas-diagnostics-v1`.
- Insights/Home: `app.js:6170–6204`, with findings captured through `app.js:6718–6722`.

They are not interchangeable evidence.

The Advice diagnostic currently detects CTAs from `landingPage.cta` or `social.preview`, and can emit trust or funnel findings without considering whether those recommendations are applicable to the campaign. Its validator does not admit the `goal` field read by one diagnostic branch.

These are existing diagnostic limitations. BW-37.1A should qualify their interpretation, without introducing another calculation engine or silently changing formulas.

## B. Gap analysis

| Classification | Findings |
|---|---|
| **Already implemented** | Conversational Advice; freeform composer; bounded history; follow-up reference policy; selected-node context; independent Board/Brand authorization; approved Learning retrieval; token budgeting; pre/post inference revalidation; safe rendering; language checks; Learning-supply disclosure; guarded Home navigation. |
| **Partially implemented** | Strategic answer quality: current instructions require concise advice and uncertainty, but do not consistently direct recommendation, rationale, alternatives and actionable next steps. |
| **Partially implemented** | Context transparency: Learning supply is accurately labeled, but existing compact metadata does not establish which evidence influenced a particular recommendation. |
| **Partially implemented** | Diagnostic interpretation: deterministic findings are available, but applicability and differences between Advice and Insights need careful explanation. |
| **Missing** | Four discoverable conversation modes; explicit general-mode return; mode request contract; per-turn mode capture; mode-specific retry behavior; localized mode guidance. |
| **Intentionally deferred** | Selected-Brand-only conversations; persistent history; decision storage; automatic edits; recommendation acceptance writes; simulation; new analytical calculations; cross-Board aggregation; new retrieval infrastructure; additional paid requests. |

The historical BW-24 statement that Brain is not conversational is superseded by current runtime. The BW-26 audit describes its initial implementation boundary, rather than the complete present feature set.

Sources: `docs/audits/bw24-ai-brain-insights-product-boundary.md:7–19`; `docs/audits/bw26-ai-brain-preimplementation-audit.md:3–22`.

## C. Final BW-37.1A MVP specification

### Product contract

Add **one optional conversation-focus selector** to the existing composer. It changes how the existing AI Brain approaches the user’s question.

It must not:

- Replace, populate or prepend text to the question.
- Submit a request when changed.
- Choose another model or service.
- Expand context authorization.
- Modify the Canvas or Brand.
- Add another request to an ordinary turn.

The freeform question remains primary.

### Modes and EN/DE copy

| API value | EN title and description | DE title and description | Strategic purpose |
|---|---|---|---|
| `general` | **General conversation** — Ask any strategic question about this Brand or campaign. | **Allgemeines Gespräch** — Stelle eine strategische Frage zu dieser Brand oder Kampagne. | Natural conversation without a specialized lens. |
| `review_strategy` | **Review Strategy** — Review alignment, priorities and trade-offs in the current strategy. | **Strategie prüfen** — Prüfe Ausrichtung, Prioritäten und Zielkonflikte der aktuellen Strategie. | Assess coherence with authorized Brand context and campaign constraints; recommend the most useful adjustment. |
| `explore_ideas` | **Explore Ideas** — Explore distinct ideas that fit your Brand and campaign. | **Ideen erkunden** — Entwickle unterschiedliche Ideen, die zu deiner Brand und Kampagne passen. | Offer a small set of meaningfully different directions; explain fit and trade-offs. |
| `find_gaps` | **Find Gaps** — Find missing assumptions, evidence or campaign elements. | **Lücken finden** — Finde fehlende Annahmen, Belege oder Kampagnenelemente. | Identify material omissions, separating observable absence from strategic hypothesis. |
| `evaluate_options` | **Evaluate Options** — Compare options against your goals, constraints and Brand context. | **Optionen bewerten** — Vergleiche Optionen anhand deiner Ziele, Rahmenbedingungen und Brand. | Compare supplied or conversationally referenced alternatives and recommend conditionally. |

**Control label:** “Conversation focus” / “Gesprächsfokus”.

**Control guidance:** “Optional. Your question leads the conversation.” / “Optional. Deine Frage bestimmt das Gespräch.”

### Selection and lifecycle

- Default to `general`.
- Selecting a mode updates its helper description only.
- Return to ordinary conversation by selecting `general`; no second reset control.
- Retain the selected mode across follow-ups and same-context navigation.
- Preserve the mode through theme, language and ordinary presentation rerenders.
- Reset it to `general` through the existing Brain invalidation lifecycle.
- Changing only the selected sidebar Brand must not retarget the open Board’s conversation.
- A mode change must not clear history, the question draft or selected-node scope.
- Disable mode selection while an Advice request is pending.
- Capture the mode on each submitted turn.
- Retry a failed turn using its originally captured mode, its original question, and the current authorized context and interface response language.
- A legacy failed turn without mode metadata retries as `general`.
- Retrying an older turn must not change the composer’s selected mode.

### Additive API contract

Extend the existing request with:

```json
{
  "advice_mode": "review_strategy"
}
```

Rules:

- `advice_mode` is optional.
- Omission means `general`.
- A supplied value must exactly match one of the five values above.
- Reject `null`, arrays, objects, unsupported strings and invalid types with HTTP 400 before inference.
- Continue rejecting unknown body keys.
- Keep every existing required field required.
- Add normalized `context.advice_mode` to successful and deterministic clarification responses.
- Preserve `answer`, disclaimers, Learning metadata and existing error semantics.

**Implementation trap:** `REQUIRED_BODY_KEYS` is derived from `BODY_KEYS` at `api/ai-brain/advice.js:11–12`. Adding the mode to the allowlist must also exclude it from the required-key calculation.

### Strategic answer behavior

Extend the existing prompt with a flexible quality policy:

1. Address the actual question and provide a clear recommendation when the context supports one.
2. Explain the recommendation using relevant authorized Brand, campaign or selected-node context.
3. Surface material assumptions, uncertainty and source conflicts.
4. Offer alternatives when they would change the decision.
5. Give concrete next steps proportionate to the question.

This is a quality standard, not a mandatory five-section response.

Additional behavior:

- A brief follow-up can receive a brief answer.
- Preserve numbered-list referents exactly.
- Use the requested mode as a lens; explicit user intent remains central.
- If comparison options are missing, first inspect included conversation history. Ask one concise clarification only when necessary.
- Do not manufacture campaign goals, budgets, measurements, business outcomes or customer evidence.
- Distinguish “this rule detected…” from “my strategic interpretation is…”.
- Check diagnostic applicability against the actual supplied node fields.
- An absent Canvas element is not automatically a strategic requirement.
- Empty Canvas does not prevent authorized Board-based advice; it limits campaign-specific conclusions.
- Preserve the existing EN/DE policy and safe output format.

### Evidence policy

Maintain three distinct concepts:

| Concept | Permitted claim |
|---|---|
| Supplied context | “These approved Learnings were supplied to AI Brain.” |
| Explanation grounded in a supplied fact | “The saved campaign snapshot specifies this audience, so…” |
| Verified measurement | Only claim this when an actual authorized measurement is available. Current Canvas diagnostics do not establish it. |

Do not introduce “sources used,” citation counts or verified-evidence badges based on the supplied Learning envelope. Request-local `L1` references are not a validated attribution system.

## D. Proposed UI layout and states

Preserve the existing hierarchy:

```text
AI Brain header and advisor identity
Board / selected-node / saved-or-unsaved context
Existing conversation transcript
Existing composer
  Your strategic question
  Conversation focus [General conversation ▾]
  Selected mode description
  Existing freeform textarea
  Existing qualitative-advice notice       Ask AI Brain
```

Use a compact native `<select>` containing General plus the four modes. This gives one mode control, native keyboard behavior and an explicit return to General.

On desktop, the question label and focus control may share a compact row. On mobile, stack them and keep the textarea full width. Add no dashboard cards or new Home controls.

### Interaction states

| State | Required behavior |
|---|---|
| New conversation | General selected; no request; existing textarea empty or containing its preserved draft. |
| Mode selected | Show its description; leave draft, transcript and context unchanged. |
| Follow-up | Selected mode remains active; existing bounded history is sent. |
| Request pending | Disable selector and submit; preserve captured mode and existing pending UI. |
| Success | Existing answer rendering and Learning disclosure; a small localized non-General mode label may identify the user turn. |
| Failure | Preserve draft and mode; existing localized error and explicit Retry. |
| Context changed | Existing stale-result rejection; Retry uses fresh authorized context. |
| Board/account lifecycle invalidation | Existing transcript/request cleanup; reset mode to General. |
| No saved Board | Explain the existing Board requirement; no mode-driven request. |
| Viewer or unconfirmed access | Preserve unavailable presentation; modes grant no capability. |
| Empty Canvas with valid Board edit access | Allow questions; explain that campaign-specific assessment is limited. |
| Canonical Brand unavailable to this actor | Valid Board-only Advice remains available; do not disclose hidden Brand knowledge. |
| Learning infrastructure unavailable | Preserve existing failure semantics; never display a false empty-library result. |

### Additional localized copy

| Purpose | EN | DE |
|---|---|---|
| Empty conversation guidance | Ask a question, or choose a focus to review strategy, explore ideas, find gaps or evaluate options. | Stelle eine Frage oder wähle einen Fokus, um die Strategie zu prüfen, Ideen zu erkunden, Lücken zu finden oder Optionen zu bewerten. |
| No Board | Open a saved Board with edit access to use AI Brain. | Öffne ein gespeichertes Board mit Bearbeitungsrechten, um AI Brain zu nutzen. |
| Empty Canvas | This Canvas is empty. Advice can use the available Brand context; campaign-specific conclusions are limited. | Dieser Canvas ist leer. Die Beratung kann den verfügbaren Brand-Kontext nutzen; kampagnenspezifische Aussagen sind eingeschränkt. |

Reuse existing localized access, loading and error strings wherever they already express the state accurately.

### Accessibility and visual standards

- Associate a visible label with the native selector.
- Associate the selected description using `aria-describedby`.
- Preserve visible focus, logical tab order and native arrow-key selection.
- Enter in the textarea continues to insert a newline; no new submission shortcut.
- Mode changes must not move focus or replace the composer DOM.
- Required rerenders must preserve draft, focus and caret when the composer owns focus.
- Use existing theme tokens, typography, borders and violet accent.
- Provide approximately 44px usable control targets.
- Support 320px widths, zoom and long German labels without horizontal overflow.
- Add no decorative animation.

## E. Smallest safe implementation boundary

The recommended boundary is:

**Existing composer + ephemeral mode state + optional Advice field + existing prompt composition + focused regression coverage.**

Keep mode instructions inside the existing policy message. Preserve the message sequence, especially the final language system message followed by the unchanged user question.

Pass the mode through the existing `learningContext.prepare()` message callback so its instructions are counted in the real token budget.

Do not alter retrieval ranking, authorization, transaction boundaries, diagnostic formulas or provider configuration for this package.

The existing explicit Content-node preparation/creation flow remains separate. Selecting or submitting a mode must never trigger it.

## F. Exact files likely to change

These are proposed implementation changes; none were made during this audit.

| File | Intended change |
|---|---|
| `app.js` | Mode definitions/state, initialization/reset, selector rendering, localized helper text, per-turn capture, retry behavior and request field. |
| `api/ai-brain/advice.js` | Optional enum validation, General default, mode-specific policy, flexible strategic-answer guidance and normalized response metadata. |
| `language.js` | New EN/DE composer, mode and state copy through the existing localization system. |
| `styles.css` | Narrowly scoped selector/layout/focus styling using existing tokens. |
| `scripts/check-bw37-1a-strategic-advisor.js` | New behavioral contract tests for modes, compatibility, prompt composition and browser lifecycle. |
| `package.json` | Register `check:bw37.1a`. |
| `.github/workflows/runtime-boot-safety.yml` | Register the new suite and relevant syntax validation without removing existing checks. |

No runtime changes are expected in:

- `index.html`: existing dynamic composer is sufficient.
- `home-foundation.js` or its stylesheet.
- `ai-brain-learning-context.css`.
- Authorization, Learning, Canvas or conversation helpers.
- Inspector, generation, simulation, persistence or migrations.

`api/_brand-brain-context.js:290–305` is shared Brand-context infrastructure. Advice currently constructs its own independently authorized context rather than calling that adapter. Introducing it into Advice would expand this package unnecessarily.

## G. Regression and acceptance-test matrix

### Audit checks completed

| Area | Result |
|---|---|
| BW-26 Advice, Canvas lifecycle, formatting, bounded conversation, references and response language | Passed |
| BW-26.6 controlled node creation and its production-boundary, transition and large-Core regressions | Passed |
| BW-28 architecture, Insights handoff and runtime rendering | Passed: 86, 39 and 46 reported contracts |
| Browser script integrity | Passed: 46 classic scripts |
| BW-36.20R0 real authorization-helper regressions | Passed: 17 ACL cases and 11 invalid projections |
| BW-36.20 Learning integration | Database/provider-fixture phase passed |
| BW-36.20 Learning disclosure browser checks | Passed separately across EN/DE, Light/Dark, desktop/mobile and keyboard |
| BW-36.20R1 storage and revalidation failures | Passed: 90 infrastructure failures and 12 stale-context cases |
| BW-36.21B2 Home/browser integration | Passed: 30 groups |
| Direct current Brain inspection | Desktop Light and mobile Dark inspected; opening produced zero Advice requests; mobile overflow check passed |
| Repository status and whitespace | Clean |

The initial Learning-suite browser phase could not resolve `playwright-core` under the isolated module path. Its database phase passed; the browser phase then passed with the corrected path.

The **complete Runtime Boot Safety workflow was inspected but not executed in full**. Its current matrix includes PostgreSQL **17.6 and 18.4**: `.github/workflows/runtime-boot-safety.yml:9–29`.

Mocked-provider tests establish contracts and safety behavior. They do not establish live model recommendation quality.

### Required BW-37.1A acceptance coverage

| Test | Expected result |
|---|---|
| Legacy request omits mode | General behavior; existing contract succeeds. |
| Each valid mode | Same route/model; normalized mode reaches prompt and response metadata. |
| Invalid mode types/values | HTTP 400; zero inference calls. |
| Unknown request key | Existing rejection preserved. |
| Mode change | Zero requests and zero domain mutations; draft unchanged. |
| Follow-up | Mode retained; bounded history and ordered references preserved. |
| Return to General | History and draft retained; specialized policy removed for the next turn. |
| Retry | Original failed-turn mode/question; current context/language; no duplicated history turn. |
| Missing-history reference | Existing deterministic clarification; zero provider calls; correct mode metadata. |
| Board/account invalidation | Abort and stale suppression preserved; mode resets. |
| Same-context navigation | Draft and mode preserved. |
| Selected Y, Board A/X | Only A/X-authorized context supplied. |
| Board-only editor | No hidden canonical data, Learnings or library counts. |
| Viewer/public/unrelated actor | No newly available Advice or provider call. |
| Learning lifecycle | Approved-only; selected archive/revision/access changes suppress output. |
| Token capacity | Mode instructions included in complete request counting; existing 422 behavior preserved. |
| Provider behavior | One inference per ordinary valid turn; `store:false`; unchanged timeout; no automatic retry. |
| Language | EN/DE after mixed-language history; existing mismatch handling preserved. |
| Rendering | Hostile mode-adjacent/user text remains inert; safe answer rendering unchanged. |
| Keyboard/mobile/themes | Native select, label/description association, focus/caret retention, 320/375px, Light/Dark/system. |
| Existing handoffs | Home remains navigation-only; Insights retains explicit draft behavior; node preparation requires its existing explicit action. |
| Full CI | Complete Runtime Boot Safety passes on both configured PostgreSQL versions. |

For strategic quality, review examples covering Brand/snapshot conflict, empty Canvas, absent comparison options, diagnostic false positives and “expand the second idea.” Human review should assess relevance and usefulness without requiring identical wording or a rigid answer template. Do not add paid evaluation calls.

## H. Risks and dependencies

| Risk | Implication and treatment |
|---|---|
| **Full composer replacement** | `renderAiBrain()` replaces `innerHTML`. Mode changes should update state/helper text in place; other rerenders need focused draft/caret preservation. Source: `app.js:6586–6601`. |
| **Two state initialization paths** | Both initial Brain state and `invalidateAiBrainRequest()` must initialize General. Sources: `app.js:163`, `6420–6423`. |
| **Required-key derivation** | Accidentally making `advice_mode` required would break existing clients/tests. Explicitly preserve omission compatibility. |
| **Retry mode drift** | Reading the current selector when retrying an old turn changes its meaning. Store the mode per turn. |
| **Navigation coupling** | `setActiveView()` renders both intelligence surfaces, and Profile leave guards can interrupt transitions. Preserve existing adapters and IDs. Sources: `app.js:18557–18597`. |
| **Selected-Brand confusion** | Living Workspace can display Brand Y while Advice belongs to Board A/X. Modes must not use session Brand selection as context authority. |
| **Context freshness limitations** | Server revalidation protects captured Board/Brand/Learning context at boundaries, not continuous revocation. Context already sent to a provider cannot be retracted. |
| **Incomplete client fingerprint** | `aiBrainCanvasProjection()` includes top-level `cta`, while `aiBrainRequestContextIdentity()` omits it. An isolated CTA edit can escape that particular in-flight client comparison. Sources: `app.js:6385–6399`. This is an existing limitation suitable for targeted follow-up hardening. |
| **Diagnostic divergence** | Advice and Insights use different schemas/rules. Modes must not promise identical findings or verified performance. |
| **Overstated coverage** | Supplied Learnings and boolean context flags are not proof of exhaustive review or evidence use. Preserve conditional wording. |
| **Prompt injection** | Modes must be a fixed server-side enum mapped to trusted instructions. Never interpolate client-supplied mode instructions. Existing context/history remain untrusted data. |
| **Overstructured answers** | Mandatory sections would degrade short follow-ups. Apply proportional quality guidance. |
| **Existing paid handoff** | Content-node preparation already makes a separate explicit request. It must not become part of a mode submission. |

The existing pre/post inference safeguards, bounded conversation and provider error handling are dependencies to preserve, not components to redesign.

## I. Proposed follow-on scope

These package definitions are recommendations, not existing roadmap commitments.

| Package | Recommended scope |
|---|---|
| **BW-37.1B — Context and answer-quality hardening** | Targeted client fingerprint completeness; diagnostic applicability/parity audit; better authorized context-coverage wording; stronger conflict and retrieval relevance evaluation. Preserve existing access requirements. |
| **BW-37.1C — Canvas and Insights handoffs** | Typed, freshness-bound advisory handoffs into existing owning surfaces. Preserve user drafts and explicit action boundaries. Reuse existing finding and Content-node handoffs; artifact writes remain explicit Canvas/Inspector operations. |
| **BW-37.1D — Governed strategic continuity** | Separately designed decision records, approved reusable recommendations or conversation continuity, with explicit ownership, retention, authorization and human approval. No automatic promotion of chat into Brand truth. |

Simulation, selected-Brand-only Advice, new providers and additional background AI requests are not implied by these proposals.

## J. Directly copyable implementation prompt

```text
TENDRA ONE — BW-37.1A: AI Brain 2.0 Strategic Advisor MVP

Repository: Funklix/Funklix.

Implement the focused Strategic Advisor MVP described below.

BASELINE AND DELIVERY
Start from latest merged main and verify its commit before editing. The audit
baseline was 364d32deec7348b8182a7ae39a9cb09da17eca10, including PR #814.
Inspect subsequent relevant changes if main has advanced.

Read AGENTS.md and follow the repository implementation delivery workflow:
dedicated branch, commit and push, exactly one normal non-draft PR against main,
verify draft:false, and return the real PR URL. Never merge or deploy. If delivery
is technically blocked, report it accurately.

PRODUCT OWNERSHIP
Brand Brain owns canonical Brand truth.
AI Brain owns strategic conversations and recommendations.
Insights owns diagnostics, evidence and measurements.
Campaign Canvas and Node Inspector own artifact creation/editing.
Knowledge owns governed reusable knowledge.
Humans own approval and strategic decisions.

Extend the existing AI Brain. Do not introduce a parallel AI service.

REQUIRED INSPECTION
Read:
- docs/constitution/product-architecture.md
- docs/product/product-intelligence-architecture.md
- docs/roadmap/README.md
- docs/audits/bw24-ai-brain-insights-product-boundary.md
- docs/audits/bw26-ai-brain-preimplementation-audit.md
- docs/implementations/bw36-20-approved-brand-learning-ai-brain-integration.md
- docs/implementations/bw36-21b2-campaign-insights-and-ai-brain-home.md
- docs/implementations/bw36-21b2-r2-automatic-home-diagnostics.md

Trace the current Advice, Learning context, Canvas validation, conversation,
authorization, Brain rendering/submission/reset, Home navigation and Insights
handoff code. Treat historical documents as historical where runtime supersedes
them. Home now automatically refreshes local deterministic diagnostics.

IMPLEMENTATION BOUNDARY
Modify the existing composer and POST /api/ai-brain/advice only as needed for
optional conversation modes and improved strategic-answer guidance.

Expected files:
- app.js
- api/ai-brain/advice.js
- language.js
- styles.css
- scripts/check-bw37-1a-strategic-advisor.js (new)
- package.json
- .github/workflows/runtime-boot-safety.yml

Reuse existing fixtures where suitable. Do not change unrelated runtime helpers.
Any additional file must have a concrete scope justification.

MODES AND EXACT COPY
Use these stable API values and localized labels/descriptions:

general
EN: General conversation
EN description: Ask any strategic question about this Brand or campaign.
DE: Allgemeines Gespräch
DE description: Stelle eine strategische Frage zu dieser Brand oder Kampagne.

review_strategy
EN: Review Strategy
EN description: Review alignment, priorities and trade-offs in the current strategy.
DE: Strategie prüfen
DE description: Prüfe Ausrichtung, Prioritäten und Zielkonflikte der aktuellen Strategie.

explore_ideas
EN: Explore Ideas
EN description: Explore distinct ideas that fit your Brand and campaign.
DE: Ideen erkunden
DE description: Entwickle unterschiedliche Ideen, die zu deiner Brand und Kampagne passen.

find_gaps
EN: Find Gaps
EN description: Find missing assumptions, evidence or campaign elements.
DE: Lücken finden
DE description: Finde fehlende Annahmen, Belege oder Kampagnenelemente.

evaluate_options
EN: Evaluate Options
EN description: Compare options against your goals, constraints and Brand context.
DE: Optionen bewerten
DE description: Vergleiche Optionen anhand deiner Ziele, Rahmenbedingungen und Brand.

Control label:
EN: Conversation focus
DE: Gesprächsfokus

Control guidance:
EN: Optional. Your question leads the conversation.
DE: Optional. Deine Frage bestimmt das Gespräch.

Empty conversation guidance:
EN: Ask a question, or choose a focus to review strategy, explore ideas, find gaps or evaluate options.
DE: Stelle eine Frage oder wähle einen Fokus, um die Strategie zu prüfen, Ideen zu erkunden, Lücken zu finden oder Optionen zu bewerten.

No-Board explanation:
EN: Open a saved Board with edit access to use AI Brain.
DE: Öffne ein gespeichertes Board mit Bearbeitungsrechten, um AI Brain zu nutzen.

Empty-Canvas explanation:
EN: This Canvas is empty. Advice can use the available Brand context; campaign-specific conclusions are limited.
DE: Dieser Canvas ist leer. Die Beratung kann den verfügbaren Brand-Kontext nutzen; kampagnenspezifische Aussagen sind eingeschränkt.

Reuse existing localized loading, access and error strings where appropriate.

UI AND STATE
Add one compact native select to the existing composer, containing General plus
the four modes. Use a visible associated label and aria-describedby for the
selected description. Keep the freeform textarea as the primary interaction.

Preserve all existing DOM IDs, handlers, navigation adapters, Board context,
selected-node scope and existing question-draft behavior.

Selecting a mode:
- updates only local ephemeral mode state and its helper description;
- never fills, prefixes, replaces or submits the question;
- never makes a network request or mutates domain state;
- never replaces the composer DOM or moves focus.

Default to general in both initial Brain state and its existing invalidation
reset. Retain the mode across follow-ups, same-context navigation, theme changes,
language changes and presentation rerenders. Reset through the existing Brain
invalidation lifecycle. Selecting General returns to ordinary conversation
without clearing history or draft.

Store the selected mode as adviceMode in ephemeral Brain state and capture
adviceMode on each submitted turn. Disable the selector during a pending Advice
request. Never allow later UI state to change an in-flight turn's mode.

Retry uses the failed turn's original question and captured mode, current
authorized context, and the currently captured interface response language.
Legacy turns without adviceMode retry as general. Retrying an older turn must
not overwrite the composer's current selected mode.

Preserve draft text, keyboard focus and textarea selection/caret through required
rerenders when the composer owns focus. Do not steal focus on background renders.
A compact localized mode label may identify non-General user turns.

Use existing Light/Dark/system theme tokens and violet accent. Stack controls on
mobile, support 320px widths and zoom, wrap long German text, retain visible focus
and approximately 44px usable targets. Keep native select keyboard behavior and
textarea newline behavior. Add no decorative animation or dashboard cards.

API CONTRACT
Add optional advice_mode to the existing Advice body allowlist.
Omission defaults to general.
If supplied, require an exact string enum:
general, review_strategy, explore_ideas, find_gaps, evaluate_options.

Reject null, objects, arrays, unsupported strings and invalid types with HTTP 400
before inference. Continue rejecting unknown body keys.

Important: REQUIRED_BODY_KEYS is derived from BODY_KEYS. Exclude advice_mode from
required keys so existing clients remain compatible.

Add normalized context.advice_mode to successful Advice and deterministic
clarification responses. Preserve existing answer, disclaimer, Learning metadata,
language and error contracts.

PROMPT COMPOSITION
Map the validated enum to fixed server-owned instructions. Do not accept client
mode instructions. Extend the existing first policy message rather than adding
a second conversation or changing message-role ordering.

Preserve the final per-turn language system message followed by the user's
unchanged question. Keep history user/assistant objects unchanged.

Pass the normalized mode through the existing learningContext.prepare messages
callback so all new instructions are counted in the actual complete token budget.
Do not alter Learning ranking or source selection for this package.

General quality guidance:
- Address the actual question.
- Give a clear recommendation when supported.
- Explain relevant reasons grounded in authorized context.
- State material assumptions, uncertainty and source conflicts.
- Offer alternatives when decision-relevant.
- Give concrete next steps proportionate to the question.
- Do not require a fixed section template for ordinary answers.
- Keep short follow-ups concise.

Mode guidance:
review_strategy: assess strategic coherence, priorities and trade-offs against
authorized Brand context and campaign constraints; recommend the most useful
adjustment.

explore_ideas: offer a small set of meaningfully different, context-fitting
directions with concise rationale and trade-offs; concepts remain advice.

find_gaps: identify material missing assumptions, evidence or campaign elements;
distinguish directly observable absence from strategic hypothesis; check diagnostic
applicability against actual supplied node fields; do not treat every missing
funnel stage or trust element as universally required.

evaluate_options: compare supplied or conversationally referenced alternatives
against explicit goals and constraints; make conditional recommendations when
evidence is incomplete; ask one concise clarification only if necessary options
or criteria cannot be resolved from the supplied context/history.

Explicit user intent remains central in every mode. Preserve ordered follow-up
references exactly. Current authorized facts override stale historical facts
without replacing the conversational referent.

Preserve existing knowledge precedence and injection defenses.
Approved Learnings are supplementary approved observations, not verified
performance. Supplied context does not prove model use.
Do not invent citations, measurements, business outcomes, budgets or Brand facts.
Keep deterministic findings distinct from strategic interpretation.
Keep existing safe Markdown restrictions and EN/DE adherence.

AUTHORIZATION, FRESHNESS AND COST INVARIANTS
Preserve:
- signed-session authentication;
- verified Board edit permission;
- explicit valid ownership projection;
- persisted Board.brand_id as the Brand-context source;
- independent canonical Brand authorization;
- independent active-identity and approved-Learning authorization;
- Board-only Advice without hidden Brand metadata;
- approved-only, token-budgeted whole-statement retrieval;
- working Canvas validation and selected-node membership checks;
- bounded conversation history and no-provider clarification;
- pre-dispatch and post-inference revalidation;
- store:false;
- existing model/provider configuration;
- existing timeout, response handling and error semantics;
- no automatic provider retries;
- one paid inference for an ordinary valid Advice turn.

Do not allow selected-Brand-only conversations.
A selected Brand Y must never replace Board A/X's context.
Do not add a cache, persistence store, quota, provider, subscription or additional
paid request per ordinary turn.

EXISTING HANDOFFS
Home remains navigation-only and must preserve drafts.
Preserve the existing explicit Insights-to-Brain draft handoff.
The existing Prepare as Content node / preview / Create node path is established
behavior: preserve it, but never invoke or extend it through mode selection or
ordinary Advice submission.

Do not implement automatic node modifications, recommendation acceptance writes,
history storage, simulation, new Canvas/Insights handoffs or new diagnostics.
Those are outside BW-37.1A.

REGRESSION COVERAGE
Add behavioral tests for:
- omitted-mode compatibility and every valid mode;
- invalid mode types/values and unknown-key rejection before inference;
- fixed server-owned prompt instructions and unchanged question/history ordering;
- normalized mode metadata on success and clarification;
- mode instructions included in complete token budgeting;
- selection without requests or writes;
- draft, focus/caret and mode preservation;
- follow-up and return-to-General behavior;
- original-mode retry with fresh context/language and no duplicate history;
- lifecycle reset and stale-response suppression;
- selected Brand Y versus Board A/X isolation;
- Board-only, viewer, public and unrelated authorization boundaries;
- one mocked provider call, store:false and no automatic retry;
- EN/DE, Light/Dark/system, desktop/mobile, keyboard and hostile-text safety;
- existing Home, Insights and explicit Content-node handoff compatibility.

Use mocked provider transport and disposable fixtures only. Do not execute paid
model evaluation or production SQL. Do not weaken existing assertions to
accommodate regressions. Preserve existing message-role compatibility tests.

Register npm run check:bw37.1a in Runtime Boot Safety and retain all existing
workflow checks. Run focused tests, existing BW-26/BW-28/BW-36.20 and relevant
Home/Living Workspace regressions, syntax/integrity checks, and the complete
Runtime Boot Safety gate for its configured PostgreSQL matrix.

Report actual results and limitations. Mocked tests do not establish live
strategic usefulness or model obedience. Human semantic review must assess
recommendation relevance, factual grounding, uncertainty, alternatives, next
steps and follow-up continuity without demanding identical wording or a rigid
template. Do not add paid evaluation calls.

DELIVERY
Return the implementation summary, actual validation results, material limitations,
and exactly one real normal non-draft PR URL. Do not merge or deploy.
```

BW-37.1A STRATEGIC ADVISOR AUDIT READY FOR IMPLEMENTATION
