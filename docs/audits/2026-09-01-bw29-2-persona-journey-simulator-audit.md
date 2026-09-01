# BW-29.2 — Persona-based Campaign Journey Simulator audit

**Date:** 2026-09-01

**Scope:** product, UX, data contract, provider, security, accessibility, and implementation planning only

**Decision:** **GO with gates.** Do not implement in this package; retain the current deterministic calculator unchanged until the combined implementation PR is approved.

## 1. Executive conclusion

The confirmed gap is real. BW-29/BW-29.1 is an honest, deterministic assumption calculator: the user supplies a starting audience, four transition rates, and optional commercial assumptions; the browser computes the result. Canvas coverage is descriptive only. That is valuable, but it is not the desired experience of testing selected campaign assets against recognizable target-audience scenarios.

V1 should add a primary **Audience journey / Zielgruppenreise** mode and retain the existing module as a clearly separate secondary **Assumption calculator / Annahmenrechner** mode. The journey must use authorized Board Brand Core Personas, at most one temporary custom target group, canonical ordered funnel stages, and current eligible Canvas nodes. It must make one deliberate request to a dedicated endpoint, validate the whole structured result before display, and then animate only a local reveal of that already validated result.

The recommended numbers are **qualitative likelihood bands with a modeled range per 100**, not exact forecasts. They are scenario communication aids derived deterministically from bounded provider signals, always labeled simulated. The UI must never call them measured, predictive, statistically representative, or “performance.” No diagnostic score or structural proxy is a conversion input.

V1 limits are: three selected target groups, one of which may be custom; **two synthetic personas per group and six total**; five ordered stages; two nodes per stage; eight distinct nodes total; one provider call; and no retry. This bounds the worst case to 6 personas × 5 stages × 2 encounters = 60 reaction records while retaining meaningful variation.

The feature is read-only and ephemeral. It does not mutate or dirty the Canvas or Brand Core, persist configuration/results, invoke another AI feature, or expose itself to Public Viewers. A deliberate AI Brain handoff may prefill an editable composer for authorized editors, but must not submit or add a transcript turn.

## 2. Current BW-29/BW-29.1 architecture

- `funnel-simulator.js` is an isolated UMD classic-script module with closure-owned session state. It has no fetch or persistence dependency.
- It exposes five canonical stages in order: Awareness, Interest, Consideration, Conversion, Retention.
- A scenario strictly accepts a bounded name, integer starting audience, four 0–100 rates, optional budget/value, and EUR/USD/GBP. It rejects unknown fields and invalid numeric forms.
- Calculation is deterministic: each unrounded stage value is multiplied by its preceding visible user-entered rate; only display values are rounded. The alternative scenario is independently editable.
- The page consistently classifies results as assumption-based, simulated, not measured performance, and not a prediction.
- The existing adapter supplies Board name, node count, audiences/channels, derived stage coverage, saved/unsaved state, lifecycle identity, and optional deliberate AI Brain handoff. This context never seeds rates.
- Identity changes across account, Board, load generation, access, and public-token lifecycle reset the module. Refresh clears closure state.
- BW-28 `analyzeCampaign` currently builds stage coverage from explicit `node.funnelStage`, then adds role heuristics: Idea and Social Media Posting → Awareness; Content → Interest; Landing Page, conversion goal, conversion stage, or non-empty landing CTA → Conversion. A `Set` deduplicates coverage. There is no current inferred rule for Consideration or Retention.
- BW-28 Insights coverage is an explanatory diagnostic over the whole Canvas. It is not an asset-eligibility contract, path, performance measure, or simulation probability.

## 3. Gap between calculator and desired product

| Current calculator | Desired journey |
|---|---|
| User supplies abstract rates | User selects target groups and actual current assets |
| Always displays five mathematical stages | Shows represented, missing, selected, and explicit-gap stages |
| No personas or asset reactions | Generates disclosed synthetic personas and bounded reactions |
| Immediate local recalculation | Deliberate server request, full validation, then local reveal |
| Exact deterministic arithmetic | Qualitative modeled signals and honest ranges |
| Canvas is descriptive context | Authorized Canvas nodes are untrusted campaign evidence |
| Optional scenario comparison | Aggregate journey plus individual persona timelines |

The current calculator should not be stretched into persona research. Mixing its exact user assumptions with model-produced reactions in one default calculation would obscure provenance and imply validation that neither model provides.

## 4. Exact recommended V1 user flow

1. Open **Audience journey** and read the persistent simulated-research disclosure.
2. Select one to three target groups from cards projected from the current Board Brand Core.
3. Optionally add one temporary custom target group with name and description; it consumes one of the three slots.
4. Inspect all five canonical stages in fixed order, each labeled Available or Missing from Canvas.
5. Select one or more available stages; optionally include a missing stage as an explicit gap. Non-adjacent selection is allowed only with every skipped middle stage visibly retained as “Not simulated” or selected as an “Explicit gap.”
6. For each selected available stage, select one or two eligible asset cards. A selected explicit gap has no asset control.
7. Review target groups, stage path, assets, Board, Brand Core provenance, Canvas saved/unsaved state, gaps, classification, provider use, and limits. Every section has an Edit action.
8. Activate **Run simulation**. Nothing calls the provider before this action.
9. Wait in a non-theatrical preparation state. The server authorizes and validates current context, calls the provider once, validates the complete response, and returns a server-derived envelope.
10. Watch or skip the local stage reveal. Controls are Pause/Resume, Skip animation, and, after completion, Replay.
11. Review aggregate simulated ranges, objections, motivators, friction, strongest simulated responses, opportunities, and each persona’s inline timeline.
12. Edit and rerun, or deliberately prefill an editable AI Brain discussion. Rerun replaces the current result; V1 keeps no previous run comparison.

## 5. Target-group source contract

The current authorized **Board Brand Core snapshot** is the V1 source, not a browser-provided canonical Brand object and not Canvas `audience` strings. This preserves Board-scoped intent and avoids revealing Canonical Brand data unavailable to the Board role.

The server re-resolves the Board and `brand_core_snapshot` after authorization. The browser sends only selected stable persona references, never authoritative descriptions. Eligible source entries are array members of `brandCore.personas` that project to a non-empty bounded label. Preserve source array order and derive an opaque reference from the source index plus a server-computed Brand Core revision/digest. Duplicate normalized names remain distinct source entries but should display their source order; exact duplicate projections may be collapsed with an explanatory note.

If there are no usable Personas, the user may configure the single custom group but sees “No target groups in this Board Brand Core.” Do not fall back silently to node audiences, AI inference, or Canonical Brand Core.

## 6. Custom target-group lifecycle

- Exactly zero or one custom group; it counts toward the three-group total.
- Fields: `name` 1–80 characters and `description` 1–500 characters after whitespace normalization.
- Visibly badge it **Temporary custom group / Temporäre eigene Zielgruppe**; Brand Core cards are badged **Board Brand Core**.
- It may be edited or removed until Run. Removing it removes its downstream personas/result by invalidating the configuration.
- It exists only in the Simulator’s in-memory state and request. Never write it into Brand Core, Board JSON, URLs, storage, cookies, diagnostics, or transcript.
- After a successful response it is copied only into the ephemeral result envelope. Edit/rerun replaces that envelope. Lifecycle clear destroys both copies.

## 7. Brand Core Persona projection

Strict server projection per selected entry:

```json
{
  "source_id": "board-persona:<revision>:<index>",
  "source": "board_brand_core",
  "name": "1..80 characters",
  "description": "0..500 characters",
  "needs": ["0..5 items, each 1..120 characters"],
  "motivations": ["0..5 items, each 1..120 characters"],
  "additional_context": ["0..5 items, each 1..120 characters"]
}
```

Accept legacy strings as `name`; for objects, map only allowlisted `name`, `category`, `note`, `description`, `needs`, and `motivations`. A scalar need/motivation becomes one item; arrays are bounded. Ignore every other field in V1. Normalize whitespace, strip control characters, preserve ordinary Unicode, and truncate only at a visible field boundary. Render as text, never HTML/Markdown. The review shows the exact projected source text and whether any source was omitted by bounds.

## 8. Funnel-stage projection

Use one shared, versioned server/browser pure mapping contract, `stage_mapping_version: "bw28-v1"`, initially matching BW-28:

1. A recognized explicit `funnelStage` is authoritative and maps the node to that one stage.
2. Only when no recognized explicit stage exists, apply deterministic fallbacks: Idea/Social Media Posting → Awareness; Content → Interest; Landing Page or conversion goal or non-empty landing CTA → Conversion.
3. Unknown explicit strings do not become stages and do not activate a fallback except where the independent Landing/goal/CTA rule applies; surface them as unmapped.
4. Consideration and Retention currently require an explicit recognized stage.

This tightens BW-28’s union-style coverage into single-stage selection eligibility. A node appears in **one stage only**. The user may not override or supplement mapping in V1; that would turn untrusted browser classification into authority. A future explicit metadata editor can change the node through its own confirmed Canvas workflow, after which the Simulator reprojects it.

The journey always preserves canonical stage order. Non-adjacent stages are permitted because real Canvases can be incomplete, but omitted intermediate rows stay visible. A missing stage may be selected only as an **explicit gap**: it has no invented asset, all entering modeled members drop at that gap for the displayed journey, and later selected stages become unreachable in aggregate (their qualitative asset reactions may be inspectable only as counterfactual and must not be included in continuation totals). Prefer a shorter journey over gaps; require confirmation if a selected gap precedes another selected stage.

Insights differs: Insights reports whole-Canvas coverage using its existing union heuristic and diagnostic language. Simulator mapping identifies a single eligible stage per chosen node for a configured scenario. Neither supplies a rate.

## 9. Node eligibility and selection rules

Eligible roles are Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign, and Visual Concept, plus a future role only after it is added to the allowlist and given a tested meaningful projection. Generic/unknown roles are excluded rather than guessed. Status does not determine eligibility, but deleted/temporary generation placeholders and nodes with unsafe/non-stable identity are excluded.

- Minimum: one asset in every selected available stage. Maximum: two per stage and eight distinct nodes per run.
- A node may be selected only once because projection assigns it one stage. Deduplicate globally by canonical node ID.
- Order stages canonically. Within a stage, preserve explicit user selection order; initial candidates use Canvas array order with stable title tie-break only if needed. Provide Move earlier/later controls, not drag-only ordering.
- Multi-node stages are one combined touchpoint in sequence. Each persona receives an encounter for each selected node in selected order, then one stage-level continuation decision. Do not multiply continuation probabilities per node.
- Cards show bounded title (120), mapped stage, role (60), platform/channel (60), status (40), plain-text preview (300), and at most one safe image thumbnail. Images must use already authorized safe URLs/data handled by current policy; no arbitrary provider Markdown, HTML, SVG, remote fetch, or URL from the response. Alt text uses the title; decorative fallback is marked accordingly.
- Use a stage accordion with explicit Select buttons/checkbox semantics and a sticky compact selection summary. “Show on Canvas” navigates only, restores focus on return, and never changes selection.
- Mobile uses one full-width card per row, a stage-by-stage accordion, count text (“1 of 2 selected”), and a bottom review action; no dense native multi-select.
- Any edit changes a configuration fingerprint and clears a result. Node deletion, stage/role/content change, Board revision/load generation, or server mismatch marks a pending request/result stale. Run is disabled until reviewed again.

## 10. Review-before-run structure

The review is a dedicated step containing:

1. Classification and full synthetic-persona disclosure.
2. Board name/ID-safe display, Board Brand Core source/revision, and Canvas saved/unsaved badge.
3. Selected Brand Core cards and the visibly temporary custom group.
4. Five-stage canonical path with selected, omitted, missing, and explicit-gap status.
5. Ordered asset cards under each selected available stage.
6. Blocking issues (no group, no stage, no asset for an available selected stage, stale source) and non-blocking warnings (unsaved Canvas, non-adjacent path).
7. “One AI provider request; simulated research output; nothing will be saved or changed.”
8. Per-section Edit controls, Back, and one enabled **Run simulation** button.

Unsaved Canvas content may be simulated because it is the user’s current authorized working context, but the server cannot trust it. The request therefore includes bounded selected-node snapshots plus the persisted Board revision and a client lifecycle/config fingerprint. Server validation must use an existing strict Canvas-context validator and reject malformed or internally stale selections; the review explicitly says the run uses the currently shown unsaved version. It must never imply server persistence.

## 11. Synthetic Persona schema

Generate exactly two personas per selected group, at most six total. Every card always shows:

- English label: **Synthetic persona**
- German label: **Synthetische Persona**
- English disclosure: **These personas are simulated audience profiles created from the selected Brand Core context and your inputs. They are not real customers or measured audience data.**
- German disclosure: **Diese Personas sind simulierte Zielgruppenprofile auf Basis des ausgewählten Brand-Core-Kontexts und deiner Angaben. Sie sind keine realen Kunden oder gemessenen Zielgruppendaten.**

```json
{
  "persona_id": "p1",
  "target_group_id": "selected source/custom id",
  "classification": "synthetic_persona",
  "first_name": "1..40",
  "age_range": "0..30",
  "occupation_or_role": "1..80",
  "location_or_market_context": "0..80",
  "interests": ["0..4 × 60"],
  "hobbies": ["0..3 × 60"],
  "digital_habits": ["1..4 × 100"],
  "motivations": ["1..4 × 100"],
  "needs": ["1..4 × 100"],
  "action_triggers": ["1..3 × 100"],
  "concerns": ["1..3 × 100"],
  "objections": ["1..3 × 100"],
  "preferred_channels": ["1..3 × 40"],
  "familiarity": "unfamiliar|aware|experienced",
  "brand_relationship": "1..120",
  "intent": "low|exploring|active",
  "risk_tolerance": "low|medium|high",
  "decision_speed": "deliberate|balanced|fast",
  "scenario_attribute_disclosure": true
}
```

Age, location, hobbies, occupation, and habits are optional plausible scenario attributes unless supported; never state that the Brand knows them. No surname, contact information, precise address, employer, unique handle, or portrait of an alleged person. Generated avatars should be abstract initials/markers in V1, not photorealistic faces.

## 12. Persona diversity rules

Within each group, persona 1 and persona 2 must differ on at least four of: primary motivation, familiarity, intent, primary objection, channel behavior, risk tolerance, decision speed, and work/life context. Across the run, no normalized first-name/role/motivation tuple may duplicate. The server validates categorical diversity and may reject—not silently repair—a homogeneous response.

Diversity is psychographic and situational, not a demand to manufacture protected traits. Do not infer or use race, ethnicity, religion, disability, sexual orientation, gender identity, health, political affiliation, or precise socioeconomic status. Age range is descriptive only and cannot alter eligibility or pricing. Prompts prohibit stereotypes and prohibit use for employment, credit, housing, education admissions, insurance, health, legal, public-benefit, or other high-impact decisions. Persona continuation is product-message research, never an individual decision.

## 13. Campaign-journey schema

The response contains exactly one journey per generated persona, exactly one stage record per selected stage in canonical order, and exactly one encounter per selected node in configured order. IDs must reference server-issued allowlists; the provider cannot invent IDs.

```json
{
  "persona_id": "p1",
  "stages": [{
    "stage": "Awareness",
    "entry_state": "entered|unreachable|explicit_gap",
    "encounters": [{ "node_id": "n1", "reaction": {} }],
    "stage_summary": "1..240",
    "continuation_band": "very_low|low|moderate|high|very_high",
    "continuation_decision": "continue|hesitate|stop",
    "decision_reason": "1..180",
    "dropoff_reason": "0..180",
    "stage_improvement_opportunity": "1..200"
  }]
}
```

An explicit gap is server-derived, has zero encounters, decision `stop`, and a fixed gap reason. Unreachable stages contain no provider-authored continuation signal and are excluded from totals.

## 14. Reaction and objection schema

```json
{
  "what_is_seen": "1..180",
  "reaction_summary": "1..220",
  "attention_signal": "1..140",
  "understanding": "1..180",
  "emotional_response": "positive|neutral|mixed|negative",
  "emotional_response_summary": "1..120",
  "relevance": "low|medium|high",
  "motivating_elements": ["0..3 × 100"],
  "confusion": "0..140",
  "objection": "0..160",
  "trust_response": "1..160",
  "resistance": "none|low|medium|high",
  "improvement_opportunity": "1..180"
}
```

These are short user-facing scenario rationales, not chain-of-thought. The prompt must request conclusions and concise supporting observations only and explicitly forbid hidden reasoning, deliberation traces, private scratch work, or claims about internal model confidence. All strings are plain text, control-character-cleaned, length validated, and rendered with `textContent`.

## 15. Numerical simulation alternatives

| Alternative | Benefit | Material risk | V1 decision |
|---|---|---|---|
| A. Exact counts, e.g. 62/100 | Familiar and compact | Provider score becomes false precision and resembles measured conversion | Reject |
| B. Bounded ranges, e.g. 55–65/100 | Makes uncertainty visible | Range still looks quantitative without a plain-language anchor | Acceptable, not sufficient alone |
| C. Likelihood band + modeled range | Leads with qualitative interpretation and retains requested drop-off | Still requires explicit deterministic method and limitations | **Choose** |
| D. User assumptions + qualitative reactions | Inputs are transparent and user-controlled | Conflates the current calculator with persona output and may imply reactions validate rates | Keep separate |

## 16. Final recommended numerical model

Use **C: qualitative likelihood bands plus supporting modeled ranges**.

- **Starting cohort:** 100 modeled audience members per selected target group. Aggregate starts at 100, not 100 × groups, by giving groups equal shares of the combined scenario.
- **Weights:** selected groups are equal weight. Their two personas are equal weight within the group. Display this assumption. No demographic or inferred market-size weights.
- **Provider signal:** only one of five categorical bands per persona/stage: very_low, low, moderate, high, very_high. Never accept a raw probability or provider count.
- **Deterministic intervals:** map bands to broad intervals: very low 10–30%, low 25–45%, moderate 45–65%, high 65–85%, very high 80–95%. Overlap is intentional uncertainty, not confidence.
- **Stage aggregation:** average lower endpoints and upper endpoints across equal-weight personas that entered the stage. Multiply the previous aggregate entering range by these rates endpoint-wise. Clamp to `[0, previous entering bound]`.
- **Rounding:** round modeled people to nearest 5, lower downward and upper upward, clamp 0–100. Display “Moderate continuation likelihood · modeled range 45–65 of 100.” Drop-off range is `[enteringLow − continueHigh, enteringHigh − continueLow]`, clamped and ordered.
- **Displayed band:** derive from the unrounded midpoint of the equal-weight persona band intervals using fixed midpoint thresholds; never ask the provider for an aggregate.
- **Quality classification:** only `Scenario completeness: complete|limited`. `limited` means custom-only context, omitted optional persona fields, or one selected asset at most stages. It is not statistical confidence or accuracy.
- **Zero:** a selected explicit gap deterministically yields 0 continuation. Otherwise do not display exact zero from categorical provider output. If no one can enter, later stage is “Unreachable,” not 0% performance.
- **Missing stages:** omitted stages do not apply a transition. A shorter journey connects the selected stages but visibly says intermediate stages were not simulated. Explicit gaps stop aggregate flow.
- **Multiple nodes:** provider evaluates encounters in order and returns one stage band; the server does not compound per-node scores.
- **Multiple personas/groups:** equal weights as above; expose per-persona qualitative decisions separately.
- **Prohibited inputs:** readiness, ICP/tone/CTA/AI Review scores, node count, content length, Insights coverage, benchmarks, or any inferred performance metric.

Every numeric surface says **Simulated modeled range—not measured performance or a prediction** and links to the visible method. Never display confidence intervals, statistical significance, expected revenue, or “conversion rate.”

## 17. Current calculator disposition

Keep both in V1 under two visibly separate modes:

- Primary: **Audience journey / Zielgruppenreise** — AI-generated synthetic research reactions and modeled bands/ranges.
- Secondary: **Assumption calculator / Annahmenrechner** — existing deterministic, user-entered mathematical scenario.

Do not make the calculator “advanced settings,” feed its rates into journey aggregation, or replace its module. A mode switch must state the provenance before navigation: “Synthetic audience scenarios” versus “Your numerical assumptions.” State does not cross modes. Existing deep links/navigation should land predictably; the Simulator destination defaults to Audience journey, while an explicit secondary tab opens the unchanged calculator. The combined PR must run all BW-29/BW-29.1 contracts to prove preservation.

## 18. Provider request schema

Dedicated `POST /api/funnel-simulator/run`; JSON only; maximum HTTP body 64 KiB. Exact top-level allowlist:

```json
{
  "board_id": "1..80",
  "response_language": "en|de",
  "board_revision": "string or integer server-comparable revision",
  "canvas_context": {
    "revision": "client lifecycle revision",
    "saved_state": "saved|unsaved",
    "nodes": ["existing bounded strict canvas node contract"],
    "edges": ["existing bounded strict canvas edge contract"]
  },
  "configuration": {
    "target_groups": [
      { "kind": "brand_core", "source_id": "bounded reference" },
      { "kind": "custom", "client_id": "custom-1", "name": "1..80", "description": "1..500" }
    ],
    "stages": [{
      "stage": "canonical enum",
      "mode": "assets|explicit_gap",
      "node_ids": ["1..2 IDs when assets"]
    }]
  },
  "client_run_id": "UUID",
  "configuration_fingerprint": "bounded digest",
  "stage_mapping_version": "bw28-v1"
}
```

No persona count, cohort arithmetic, Brand Core text, node title/content authority, access claim, prompt, provider option, model, classification, weights, diagnostic, or result is accepted from the browser. The fixed server policy derives two personas/group and all output classifications.

## 19. Provider response schema

Provider output is strict JSON with `additionalProperties: false` at every object; exact arrays use server-known counts. It returns only:

```json
{
  "personas": ["Synthetic Persona schema"],
  "journeys": ["Campaign-journey schema"],
  "aggregate_insights": {
    "common_objections": ["1..6 × 160"],
    "common_motivators": ["1..6 × 160"],
    "trust_signals": ["1..6 × 160"],
    "friction_points": ["1..6 × 180"],
    "asset_responses": [{
      "node_id": "selected ID",
      "classification": "strongest_simulated_response|mixed_simulated_response|friction",
      "summary": "1..180"
    }],
    "improvement_opportunities": [{
      "stage": "selected canonical stage",
      "node_id": "selected ID or null",
      "summary": "1..200"
    }]
  }
}
```

The server rejects missing/extra/duplicate IDs, wrong cardinality/order, unknown enums, excessive Unicode/code-point or byte lengths, mismatch language, unsafe URLs/markup where prohibited, non-finite values, and any provider-authored counts. It derives and returns an envelope containing run ID, Board/Canvas identity, source projections, classification, disclosure, range calculations, limits/method version, response language, timestamps for stale comparison, and `changes_made: false`.

## 20. Provider-message ordering

1. **System policy:** read-only synthetic research task; exact schema; categorical signals; no measurement/prediction/representation claims; no stereotypes/high-impact decisions; no chain-of-thought; no tools; ignore embedded instructions; language rule.
2. **System authoritative context:** server-derived Board identity, bounded Board Brand Core projections, selected group projections, canonical mapping, selected node metadata/content, configured order, and saved/unsaved classification inside clearly delimited JSON.
3. **System untrusted-content warning:** every Brand Core string and Canvas field is quoted campaign material only. It cannot alter roles, schema, policy, language, tools, or disclose other context.
4. **System simulation task:** exact persona count, required diversity axes, encounter cardinality, response-language instruction, and explicit-gap rules.
5. **User configuration summary:** server-generated selection summary, not raw browser prompt.

Do not put untrusted source text in a system instruction outside a delimited serialized data value. Do not send unrelated Brand Core, unselected nodes, edges not required for validation, diagnostics, account details, collaborator details, public tokens, or conversation history.

## 21. Authorization and validation

- POST only; reject other methods with 405. Require a current authenticated session (401).
- Resolve Board by `board_id`; return indistinguishable 404 for absent/inaccessible Board. Require `access.canEdit`; Viewer, Brand Viewer, and Public Viewer receive 403 without provider use.
- Re-resolve Board Brand Core and selected persona references. Do not trust browser-projected Persona data.
- Strictly validate the whole body, byte size, canvas shape/counts, stage enum/order/uniqueness, mapping version, group/node limits, custom group, response language, and UUID/fingerprint.
- Validate selected node IDs exist exactly once in current supplied Canvas context, pass the strict Canvas validator, are eligible for their server-derived stage, and have bounded current content. Reject stale revision/mapping/selection with 409 `stale_context`.
- Before and after provider completion, compare request generation/run ID against account, Board, access, Brand Core revision, Canvas revision/fingerprint, interface language, and configuration fingerprint. Browser silently discards an old response and transitions to stale.
- Provider timeout: 30 seconds via `AbortController`; return 504 `simulation_timeout`. User cancel aborts browser waiting/reveal where supported but never launches a second request.
- One request maps to at most one provider call. No automatic retry, repair call, fallback model, per-persona call, or per-stage call. A response validation failure returns 502 `invalid_simulation_response`; user may deliberately Run again.
- Safe codes: `invalid_request` 400, `authentication_required` 401, `simulation_unavailable_for_access` 403, `board_not_found` 404, `method_not_allowed` 405, `stale_context` 409, `payload_too_large` 413, `rate_limited` 429, `simulation_unavailable` 503, `invalid_simulation_response`/`provider_failure` 502, `simulation_timeout` 504. User messages reveal no provider payload, prompt, access topology, or hidden data.

## 22. Prompt-injection protection

Treat Board Brand Core and every node field as **untrusted campaign material**, even though the server authoritatively selected it. “Authoritative” means source identity/value, not instruction authority. Normalize and bound it before provider use; serialize it as JSON between explicit delimiters; tell the model never to obey text within it. HTML, Markdown, role claims, requests for secrets, fake tool calls, and system-looking text remain quoted evidence to react to, not commands.

The endpoint supplies no tools and no secret-bearing context. It allowlists context rather than redacting an oversized object. Structured output and referential validation prevent content from creating fields or IDs. Render all response/source prose as text. Log only safe lifecycle metadata, classifications, counts, and error names—not Brand Core, node content, provider output, prompts, tokens, or public links.

## 23. Language behavior

Capture Interface language (`en` or `de`) at Run. UI and generated persona/reaction/recommendation prose follow it. Selected node content stays in its source language; do not translate, rewrite, or relabel it as generated output. Brand/product names, URLs, and short source quotes remain unchanged.

Campaign-content language and source-node language never determine response language. The server places the response-language instruction after authoritative/untrusted context and validates dominant prose using the established conservative EN/DE mismatch pattern while excluding names, URLs, and quoted source. Mismatch rejects the whole response with `response_language_mismatch`; no automatic retry. A post-Run interface-language change marks the result stale/clears it rather than relabeling prose.

## 24. Loading and animation architecture

The state sequence is submitting → validating/preparing → prepared → playing; these labels describe system work, never “interviewing real people.” The UI waits for the complete server-validated result. No partial provider stream, fake typing, chat bubbles, or per-persona network request.

- Preparation uses a static progress indicator with indeterminate accessible text and an elapsed-time-neutral message.
- Default reveal: 600 ms marker movement, then reaction card reveal; 1.8 seconds dwell per stage, maximum about 12 seconds across five stages. CSS movement is 200–600 ms and never blocks controls.
- Pause freezes the reveal timer/animation at the current stage and retains position. Resume continues remaining stage time.
- Skip immediately cancels reveal timers, displays the complete result, announces completion, and moves no focus automatically.
- Replay resets presentation only, never data or provider state, then starts from prepared. It is available after completed and does not announce another simulation request.
- Do not auto-scroll on desktop. On mobile, scroll the newly revealed stage into view only when the user has not manually scrolled since play began; otherwise show a “New stage available” control.
- Focus remains on the invoked control during playback. On completion, announce through a polite live region and offer “Go to results”; explicit activation moves focus to the results heading. Error focus moves to an error summary; editing restores focus to the originating Review control.
- `prefers-reduced-motion: reduce` defaults prepared directly to completed, with all results visible and no movement; Replay remains a static re-announcement. A visible Skip control is always present.
- A text timeline and data table are authoritative; animation is decorative and `aria-hidden` where duplicative.

## 25. Aggregate result design

Order the dashboard:

1. persistent simulation classification/disclosure and scenario completeness;
2. Overall simulated journey with qualitative bands and modeled ranges;
3. Persona outcomes;
4. stage-by-stage continuation/drop-off;
5. objections and resistance;
6. motivators and trust signals;
7. **Strongest simulated response / Stärkste simulierte Reaktion** and **Most positive modeled reaction / Positivste modellierte Reaktion**;
8. friction points;
9. suggested improvements;
10. assumptions, weights, range mapping, gaps, source and limitations.

Each selected stage shows ordered assets, modeled entering/continuing/drop-off ranges, common reactions, objection, motivation, and improvement. Use no “best performing,” “winner,” lift, forecast, conversion, confidence interval, representative-sample, or measured language. Charts require adjacent exact textual alternatives and cannot rely on color.

## 26. Persona-detail design

Use **expandable inline persona cards with an inline vertical stage timeline**. This preserves aggregate context, works at mobile width, supports browser find/reading order, and avoids modal focus/scroll complexity. One card may be expanded at a time by default, but independent buttons remain available. The card header shows the classification, source target group, plausible attributes, key motivation/objection, and final scenario decision. Timeline rows show stage, encountered assets, reaction, emotion, objection, resistance, decision/reason, and improvement. “Show on Canvas” and eligible AI Brain handoffs are explicit row actions. Do not use a hover-only side panel or drawer.

## 27. AI Brain handoff

Reuse the established deliberate prefill architecture after results exist. Supported scopes: whole run, one persona, one stage, one objection, one selected asset, or improvement ideas. Construct bounded structured context from the validated result: `synthetic_persona` classification/disclosure, selected source group projection/custom input, stages, node IDs/roles/titles, short reactions, ranges/bands, objections, decisions, opportunities, Board/Canvas identity, saved/unsaved state, and simulation limitations.

Maximum prefill 2,000 characters; summarize deterministically when needed. Open AI Brain and populate its editable composer. Do not submit, add a user/assistant transcript turn, call a provider, or persist context until the user deliberately submits under AI Brain’s existing authorization and validation. Public/View-only users see no handoff. The handoff never requests an automatic node edit, creation, generation, repair, status change, rewrite, save, or AI Review.

## 28. Lifecycle and clearing

Configuration and current result live in memory only for the active authorized Board lifecycle. Leaving the Simulator view may preserve them for that unchanged lifecycle. Clear configuration/result and abort/ignore work on Board change, account change, sign-out, access loss/change, public-mode transition, load-generation change, Brand Core revision affecting selections, interface-language change, or refresh.

Canvas edits affecting selected node identity/content/stage/status mark configured/reviewed/result state stale immediately; any broader Canvas revision change should conservatively require revalidation. Rerun replaces the current result. **Do not retain one previous run in V1**: comparison doubles cognitive load and memory/output exposure and lacks a stable persistence identity. “Duplicate configuration” means copy the current choices into an editable in-memory configuration after clearing the result, not archive a run.

## 29. Persistence exclusions

No configuration, custom target group, provider request/result, animation position, comparison, or handoff draft is written to localStorage, sessionStorage, Board JSON, Brand JSON, database, URL/query/hash, cookie, analytics payload, service-worker cache, or AI Brain transcript before deliberate submission. It never enters Board serialization/autosave/dirty checks. Server processing is transient; application logs contain no content. Standard infrastructure transport logs must not log request bodies.

## 30. Public Viewer behavior

Public Viewer has no Simulator access in V1 because the journey requires Brand Core projection and a paid/controlled provider action. Hide/disable the Audience journey entry according to existing navigation policy and enforce 403 server-side. Do not accept a public token at this endpoint. The existing deterministic Assumption calculator’s current Public Viewer behavior remains unchanged and read-only/local; its AI Brain handoff remains suppressed. Viewer and Brand Viewer likewise cannot run or hand off unless product authorization later explicitly changes.

## 31. Light/Dark design specification

- Use established semantic surface, text, border, focus, status, and accent tokens—no hard-coded light backgrounds in dark mode.
- Target cards use quiet bordered surfaces; selection uses border/icon/text in addition to tint. Temporary custom cards use a distinct dashed boundary and explicit badge, not warning color.
- Stage rail uses canonical order, clear Available/Missing/Selected/Gap text and icons. Persona marker colors are supplemental; initials and names distinguish them.
- Light mode maintains readable low-elevation hierarchy without gray-on-gray controls. Premium Dark Mode uses restrained elevation, non-neon accent, legible reaction cards, and no pure-black large surfaces.
- Skeleton/preparation, focus rings, disabled state, error/warning, charts, thumbnails, badges, and overlays meet contrast requirements in both modes.
- Active Brand Avatar may identify the AI-guided simulation header or Brain handoff only. Never place it on a persona marker/card or imply it is an audience participant. A neutral Funklix simulation glyph is preferable for playback.

## 32. Responsive and accessibility specification

- All configuration works by keyboard: logical heading/tab order, native buttons/checkbox semantics, Space/Enter operation, no drag requirement, and visible focus.
- Stage accordion buttons expose expanded state, availability, selection counts, and errors. Node actions include node title, role, stage, and selection state in their accessible names.
- Announce selection counts and validation errors; do not announce every cosmetic animation frame. A polite live region announces prepared, stage N of M, paused/resumed, skipped, completed, stale, and failed.
- Pause/Resume and Skip are always reachable and at least 44×44 CSS px. Reduced-motion behavior is functional, not merely shorter animation.
- Restore focus after accordion edits, Show on Canvas return, error recovery, and replay. Never steal focus during playback.
- Every state uses icon/text/pattern as well as color. Range bars/charts have table/text alternatives with entering, continuing, and drop-off ranges.
- At ≤768 px, use single-column cards, sticky but non-obscuring Next/Review control, inline timeline, horizontally wrapping stage names rather than horizontal page scroll, and no hover-only content.
- German labels may wrap to two or more lines without truncating controls; use natural wrapping and test 320 px width and 200% zoom.
- Source/reaction strings render as plain text; image failure yields a safe placeholder. Screen readers encounter aggregate content before optional details.

## 33. Cost and size limits

| Item | V1 limit |
|---|---:|
| Selected target groups | 3 total, including ≤1 custom |
| Synthetic personas | exactly 2/group, ≤6 total |
| Stages | 1–5, canonical order |
| Nodes | 1–2/available stage, ≤8 distinct total |
| Reaction records | ≤60 (6 × 5 × 2) |
| Browser HTTP body | 64 KiB |
| Projected Brand Core/group | ≤1.7 KiB; ≤5 KiB total |
| Node title/content projection | 120/1,200 characters; ≤10 KiB selected content total |
| Provider input target | approximately 8k–14k tokens worst case after JSON/instructions |
| Provider output | ≤96 KiB; approximately 10k–18k tokens worst case |
| Timeout | 30 seconds |
| Provider calls | exactly 1 per deliberate Run; 0 automatic retries |

The 60-record maximum is the main latency/output risk. Require compact fields and omit empty optional fields only where the strict schema permits. If representative fixtures exceed provider structured-output reliability or 30-second/96-KiB bounds, reduce to one node per stage before considering any fan-out. Never split by persona/stage/node.

## 34. Exact file-by-file blast radius

The future **single combined implementation PR** should be limited to:

| File/component | Planned responsibility | Risk |
|---|---|---|
| `persona-journey-simulator.js` (new) | Pure state machine, projection UI, review, validated-result playback/ranges, accessible result rendering | High: state/lifecycle/a11y |
| `api/funnel-simulator/run.js` (new) | Dedicated auth, server projection, strict schemas, one provider call, output validation/envelope | Critical: auth/injection/honesty/cost |
| `api/_funnel-simulator-contract.js` (new) | Shared server validators, allowlists, stage mapping, limits, deterministic ranges | Critical: contract drift |
| `app.js` | Minimal authorized context adapter, lifecycle invalidation, mode routing, Show on Canvas and Brain prefill | High: broad SPA regression |
| `index.html` | Guided mode shell and script registration | Medium: stable DOM/navigation |
| `style.css` (or current main stylesheet) | Scoped journey Light/Dark/responsive/reduced-motion styles | Medium: theme leakage |
| `language.js` | EN/DE interface strings only | Medium: missing/wrapping copy |
| `scripts/check-bw29-2-persona-journey-simulator.js` (new) | Contract/security/honesty/lifecycle regression | Low |
| `package.json` | Add `check:bw29.2` only | Low |
| `.github/workflows/static.yml` (current registration file) | Register new check only | Low |
| `docs/audits/2026-09-01-bw29-2-persona-journey-simulator-audit.md` | Approved source specification | Low |

Names must be reconciled with repository conventions before implementation. Do not refactor unrelated modules in this combined PR.

## 35. Files that should remain unchanged

- `funnel-simulator.js`: preserve deterministic module, formulas, validation, state, disclosure, and exports.
- Existing BW-26 through BW-29.1 regression scripts and fixtures: add a new check; do not weaken old assertions.
- Board/Brand storage and serializer modules, schemas/migrations, save/autosave/dirty-state code.
- Canvas generation, repair, AI Review, node proposal/creation/refinement, diagnostics, and Insights formulas.
- Auth/session, membership, public sharing/token, and Public Viewer serialization except importing an existing read helper from the new endpoint.
- Existing AI Brain advice endpoint/request contract and transcript memory.
- Production translations/styles/tests/workflow registration in **this audit package**. Only the audit document changes now.

## 36. Future regression specification

The combined implementation PR must prove:

### Sources, configuration, and review

- [ ] Brand Core Persona discovery uses the current authorized Board snapshot and bounded projection.
- [ ] Selection is one to three groups, exactly two synthetic personas/group, and no more than six.
- [ ] One bounded custom target group is add/edit/remove capable and visually distinct.
- [ ] Custom data never mutates Brand Core or Board data.
- [ ] Available Canvas stages follow the versioned deterministic mapping; missing stages are explicit.
- [ ] Stage order is canonical; non-adjacent and missing-middle behavior matches this audit.
- [ ] Explicit gaps contain no invented content and stop aggregate flow.
- [ ] Insights coverage remains separate from Simulator eligibility.
- [ ] Eligible roles, single-stage mapping, global deduplication, stable ordering, and one/two-per-stage/eight-total bounds hold.
- [ ] User cannot override mapping; Show on Canvas is navigate-only.
- [ ] Deleted, changed, malformed, duplicated, or stale selected nodes reject/invalidate.
- [ ] Review includes all groups/stages/nodes, Board, source, saved state, gaps, classification, provider use, and Edit actions.

### Request, response, honesty, and safety

- [ ] Only deliberate Run sends a request; one run makes exactly one provider call and no automatic retry.
- [ ] Request body/keys/types/enums/cardinality/bytes are strict; browser context is untrusted.
- [ ] Response schema/keys/IDs/order/cardinality/strings/enums/bytes/language are strict and fully validated before animation.
- [ ] Synthetic Persona/Synthetische Persona classification and exact EN/DE disclosures are persistent.
- [ ] Personas include concrete bounded scenario fields while disclaiming real, measured, verified, representative, or factual status.
- [ ] Personas differ meaningfully on four axes without protected-trait stereotypes or high-impact use.
- [ ] Every Persona × selected stage × selected node has bounded reactions; stage records include objections, motivations, trust, resistance, and decisions.
- [ ] Rationale is concise user-facing explanation; prompts/output expose no chain-of-thought.
- [ ] Qualitative band + modeled range math, weights, rounding, gaps, zero, multiple nodes/personas/groups, and limitations match the contract.
- [ ] No measured-performance, prediction, statistical-significance, best-performing, or individual-behavior claim appears.
- [ ] No readiness, ICP, tone, CTA, AI Review, node-count, content-length, coverage, or benchmark score becomes a rate.
- [ ] Injection fixtures in Brand Core/node content cannot alter prompt role, language, schema, IDs, policy, or reveal context.
- [ ] HTML/Markdown/provider images render safely as text or approved thumbnails; no unsafe DOM sink.

### Playback, results, handoff, lifecycle, and isolation

- [ ] Playback begins only after complete server validation and makes no calls while revealing.
- [ ] Timing, Pause/Resume, Skip, Replay, manual-scroll behavior, focus, announcements, and reduced-motion static result work.
- [ ] Aggregate dashboard and inline Persona timelines expose equivalent textual data and honest terminology.
- [ ] AI Brain whole/persona/stage/objection/asset/improvement handoffs are bounded and editable.
- [ ] Handoff causes no automatic submission, transcript turn, or provider call.
- [ ] Board/account/sign-out/access/public-mode/load generation/Brand revision/language changes clear or stale state and reject late responses.
- [ ] Public Viewer and read-only roles cannot run/handoff; deterministic calculator behavior is unchanged.
- [ ] Refresh clears; rerun replaces; no previous result history exists.
- [ ] No local/session storage, URL, cookie, Board/Brand/database, transcript, or analytics persistence.
- [ ] Running/viewing never mutates nodes/edges/fields/status/ownership/Brand Core, marks dirty, autosaves, generates, repairs, reviews, proposes, or changes Insights diagnostics.
- [ ] EN/DE response follows captured Interface language independent of campaign/source language; mismatch rejects conservatively.
- [ ] Light/Dark, 320 px mobile, 200% zoom, German wrapping, keyboard, screen reader, non-color status, and chart alternatives pass.
- [ ] Browser script integrity passes and the module introduces no unsupported classic-script syntax/global collision.
- [ ] All BW-26 through BW-29.1 checks remain compatible, especially read-only Brain, language separation, Insights, dark mode, and calculator determinism.

## 37. Implementation go/no-go criteria

**GO only when all are true:**

1. Product accepts the separate Audience journey and Assumption calculator modes and qualitative-band/range terminology.
2. Security accepts editor-only endpoint access, Board-snapshot Persona projection, strict canvas validator reuse, injection boundaries, and no public-token access.
3. Provider fixtures reliably return the strict maximum schema within the 30-second and 96-KiB bounds in EN and DE; otherwise limits are reduced.
4. The single authoritative mapping function is extracted/versioned without changing BW-28 visible coverage semantics.
5. UX/accessibility prototypes prove review, explicit gaps, mobile selection, inline timelines, controls, and reduced-motion behavior.
6. Lifecycle fingerprints cover account, Board, access, Brand Core, Canvas, language, configuration, and late-response rejection.
7. Read-only isolation and zero persistence can be asserted programmatically.
8. Exact disclosures, numerical method, error codes, request/response schemas, and Public Viewer policy are approved.
9. Existing calculator and BW-26–BW-29.1 regressions pass unchanged.

**NO-GO** if implementation needs provider fan-out, hidden benchmarks, diagnostic-derived rates, automatic repair/retry, browser-authoritative Brand/Core/node data, persistence, public access to Brand Core, chain-of-thought, or Canvas mutation. Reduce scope rather than relax these boundaries.

## 38. One combined implementation-PR plan

1. Freeze JSON schemas, categorical/range math, shared limits, stage mapping version, disclosures, error codes, and fixtures.
2. Add the pure contract module and exhaustive unit fixtures for projection, stale context, cardinality, diversity, references, language, and deterministic aggregation.
3. Add the dedicated endpoint with session/Board edit authorization, Board Brand Core re-resolution, bounded Canvas validation, ordered provider messages, structured output, timeout, one-call/no-retry behavior, safe logging, and server-derived envelope.
4. Add the isolated browser journey module and full state machine; integrate a minimal lifecycle/context adapter into `app.js`.
5. Add guided target/stage/node/review UI, preparation and validated local playback, aggregate results, inline persona timelines, and deliberate Brain prefill.
6. Add scoped Light/Dark/responsive/reduced-motion styling and complete EN/DE copy.
7. Add BW-29.2 regression coverage and workflow registration; run all legacy checks. Review the diff to prove the current calculator/storage/generation/repair/review/diagnostics remain untouched.

## Exact component map

| Component | Purpose | Data source | User action | Server involvement | Persistence | Primary risk |
|---|---|---|---|---|---|---|
| Mode switch | Separate journey and calculator provenance | Static EN/DE copy | Choose mode | None | In-memory view only | Model confusion |
| Disclosure banner | Persistent honesty/classification | Static copy + result method | Read methodology | Server classification echoed | None | Misrepresentation |
| Target-group cards | Discover/select Board Personas | Authorized Board Brand Core projection | Inspect/select 1–3 | Re-resolve on Run | None | Brand data exposure/staleness |
| Custom-group form | Add one scenario-only group | User input | Add/edit/remove | Validate only | None | Accidental Brand mutation |
| Stage journey | Represent coverage/gaps/order | Shared node-stage mapping | Select/omit/gap | Revalidate | None | Invented path |
| Asset accordion/cards | Choose relevant mapped nodes | Current authorized Canvas | Select/order/show | Revalidate IDs/content/stage | None | Injection/stale nodes |
| Selected summary | Keep mobile choices legible | Configuration | Remove/reorder | None | None | Hidden duplicates |
| Review screen | Explicit informed Run | Server-bound configuration | Edit/Run | None until Run | None | Accidental provider use |
| Run controller | One deliberate request | Reviewed configuration | Run/cancel | Auth, validation, provider once | None | Cost/race/authorization |
| Preparation state | Explain bounded wait | Request state | Cancel/wait | Request in flight | None | Fake live research |
| Playback rail | Reveal validated journey | Complete safe envelope | Pause/resume/skip/replay | None | Presentation memory | Motion/a11y deception |
| Reaction card | Explain asset response | Validated encounter | Expand/show asset | None | None | Unsafe rendering/CoT |
| Aggregate dashboard | Honest bands/ranges and themes | Server-derived arithmetic + validated summaries | Inspect methodology | Arithmetic derived server-side | None | False precision |
| Persona timeline | Inspect individual scenario | Validated persona journey | Expand rows | None | None | Aggregate displacement |
| Opportunity panels | Offer read-only next steps | Validated output | Inspect/rerun/handoff | None until handoff submit | None | Implied automatic mutation |
| Brain handoff | Prefill bounded discussion | Validated selected scope | Edit then submit | Existing Brain only after submit | Existing transcript after submit | Premature call/data excess |
| Lifecycle guard | Clear/stale/ignore late results | Account/Board/access/revisions/language | Reconfigure | Server stale check | None | Cross-context leak |
| Assumption calculator | Preserve deterministic value | Existing user inputs/module | Calculate/compare | None | Existing memory only | Cross-model blending |

## State model

| State | Entry condition | Allowed actions | Exit/invariant |
|---|---|---|---|
| `configure` | Initial authorized lifecycle or Edit | Select groups/stages/nodes; manage custom group | Valid config → `ready`; no network |
| `ready` | All bounds valid and review current | Edit or Run | Edit → `configure`; Run → `submitting` |
| `submitting` | One deliberate Run | Cancel local wait | Request dispatched once → `validating`; Run disabled |
| `validating` | Server auth/context/provider/output work | Cancel local wait | Valid envelope → `prepared`; safe error → `failed`; lifecycle drift → `stale` |
| `prepared` | Complete validated envelope received | Play, Skip, inspect static for reduced motion | Default → `playing`; reduced motion/Skip → `completed` |
| `playing` | Reveal timer active | Pause or Skip | Pause → `paused`; final stage/Skip → `completed` |
| `paused` | User pauses | Resume, Skip | Resume → `playing`; Skip → `completed`; no call |
| `completed` | All safe results visible | Expand, Replay, Edit/rerun, Show on Canvas, Brain prefill | Replay → `prepared`; Edit → `configure`; lifecycle drift → `stale` |
| `failed` | Safe request/provider/schema/language error | Return to review; deliberate retry | Retry is a new Run; no automatic retry/partial result |
| `stale` | Identity/revision/config/language changed or late response | Clear and reconfigure/review | Never render stale result → `configure` or `cleared` |
| `cleared` | Board/account/access/sign-out/public/refresh teardown | None until new authorized context | No configuration, result, timer, request reference, or handoff draft remains |

The transition implementation must accept only named legal transitions. Every timer, abort controller, and late promise is keyed by lifecycle identity plus `client_run_id` and configuration fingerprint.

## Audit conclusion

The safest useful V1 is a guided, editor-only, ephemeral audience-research scenario over selected authorized source material: two diverse synthetic personas per group, one ordered journey, one strict provider call, fully validated data before a local accessible reveal, and broad modeled ranges led by qualitative bands. It complements rather than replaces the deterministic calculator. Implementation is ready to plan only under the go/no-go gates above; this audit intentionally changes no production behavior.
