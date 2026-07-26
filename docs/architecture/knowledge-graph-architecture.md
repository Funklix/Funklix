# Knowledge Graph Architecture — Phase A1

**Status:** Proposed architecture; documentation only.
**Scope:** Repository-backed audit and implementation contract for later A2–A4 phases.
**Labels used below:** **Observed** means current runtime behavior, **Proposed** means a future contract, and **Deferred** means no implementation decision is authorized by A1.

## 1. Executive Summary

Campaign Canvas already has the necessary foundations for a small, additive Brand Knowledge Graph: a registry of stable module definitions, persisted Custom Tile instance IDs and optional `moduleType`, a read-only runtime adapter, module-specific Founder Story semantics, and board-scoped Brand Core persistence. It does **not** yet have a dependency contract, graph resolver, shared readiness engine, provenance model, or graph-derived Missing Knowledge behavior.

The safest first vertical is `founder_story` → `brand_dna`. Founder Story is a **Source Module** whose seven structured facts are authoritative and whose `content` is a reusable narrative representation. Brand DNA is a **Derived Module**. Founder Story should be a recommended—not required—Brand DNA dependency. That relationship should be declared in `knowledge-module-registry.js`, resolved at runtime by stable `moduleType`, and never persisted as copied graph state.

This document recommends one optional registry-only `knowledgeGraph` object with four fields: `role`, `layer`, `dependencies`, and `acquisitionMethods`. It deliberately omits `produces` from A2: no current consumer needs a capability vocabulary, and adding one now would duplicate capabilities or create an unvalidated ontology. Existing registry fields remain unchanged.

No Board/Brand migration is needed. Definitions without `knowledgeGraph` remain non-participating, and legacy untyped tiles remain readable and editable through current behavior. A2 adds metadata and validation only; A3 adds a pure direct-dependency/readiness resolver; A4 adds opt-in recommendations and the Founder Story soft prompt before Brand DNA generation. Website Import requires a separate audit.

## 2. Product Vision

**Proposed.** Knowledge is captured once, retained in structured form, connected through explicit contracts, reviewed when AI materially changes it, and reused across strategy and creation. The graph is a governed view over current Brand knowledge—not a replacement persistence model and not permission for AI to infer facts or relationships.

The first vertical should let accepted, usable Founder Story knowledge inform Brand DNA without allowing Brand DNA to mutate Founder Story. Later content and execution consumers may reuse the same governed knowledge, but those concepts do not need to become Knowledge Module roles in the first release.

## 3. Current-State Repository Audit

**Observed.** The audit inspected:

- `knowledge-module-registry.js`: registry constants, definitions, lookups, sections, categories, multiplicity, capabilities, and runtime state keys.
- `knowledge-module-identity.js`: `createKnowledgeModuleInstanceId()` and `isKnowledgeModuleInstanceId()`.
- `knowledge-module-runtime-adapter.js`: built-in/Custom Tile normalized views and legacy title inference.
- `app.js`: Brand state, Missing Knowledge, tile creation/resolution, Founder Story, readiness/card display, Brand DNA requests, save/load, and board hydration.
- `api/discover-brand-dna.js` and `api/_brand-brain-context.js`: input normalization and AI request construction.
- `api/_boards-storage.js`, `api/boards/index.js`, and `api/boards/[id].js`: `brand_core_snapshot` JSONB persistence.
- `campaign-v3.js`: campaign plan/commit behavior; it does not define Knowledge Module dependency semantics.
- Current architecture/audit material under `docs/audits`, especially the Knowledge Module registry, stable identity, runtime adapter, Phase 5A–5D, and Founder Story F0–F3 audits; and relevant `docs/product`/`docs/constitution` documents.

Repository searches found generic uses of “dependency,” product-level graph/provenance concepts, AI archetype confidence, and future registry capabilities such as `sourceMetadata` and `graphProjection`. None is an implemented Knowledge Module input contract. Canvas edges likewise must not be reinterpreted as module dependencies.

This document lives at the requested `docs/architecture/knowledge-graph-architecture.md`. The directory is new, but appropriate: the repository separates durable product architecture (`docs/product`), implementation audits (`docs/audits`), and ADRs (`docs/decisions`); this deliverable is a focused technical/product architecture contract rather than an implementation audit or decision record.

## 4. Existing Knowledge Module Architecture

**Observed.** A Knowledge Module is currently a registry-backed definition exposed either from built-in Brand Core state or from a `state.brandCore.customTiles` entry through the runtime adapter. It is not a separate database entity.

- Definitions are entries in `KNOWLEDGE_MODULE_REGISTRY`, keyed by normalized IDs such as `founder_story` and `brand_dna`. Each entry also repeats that value in `id`.
- The stable **module definition identity** is the registry ID, persisted on typed Custom Tiles as `tile.moduleType`.
- The stable **module instance identity** is `tile.id`, a `km_`-prefixed UUID-like value. These identities solve different problems and must not be conflated.
- `section` and `category` control current organization; `runtimeStateKeys` maps built-in fields such as `brandDNA` to a definition; `allowMultiple` expresses intended multiplicity; capability arrays describe current/future feature support.
- `createBrandCustomTile()` creates `{ id, title, content, items }` and conditionally adds `moduleType`. Runtime selection uses `custom-id:${id}` for valid stable IDs and `custom:${index}` for legacy fallback.
- `adaptBuiltInBrandCoreModule()` and `adaptCustomTileToKnowledgeModule()` create frozen read-only views. The adapter first trusts persisted `moduleType`; for a limited known Custom Tile set it can infer a definition by canonical title. Such inference is compatibility/display behavior, not stable identity.
- Typed Custom Tiles have a registry-valid persisted `moduleType`. Untyped/legacy tiles do not. In `app.js`, specialized Founder Story behavior is stricter than the adapter: `getValidPersistedMissingKnowledgeModuleDefinition()` plus `isFounderStoryCustomTile()` require the persisted type. A title-only Founder Story remains generic.

The registry says `allowMultiple: false` for Founder Story and Brand DNA, but storage is an array and no schema constraint guarantees uniqueness. Existing helper flows prevent common canonical duplicates; malformed or manually produced data can still contain duplicates.

## 5. Existing Founder Story Architecture

**Observed.** Founder Story remains a Custom Tile, specialized only when its valid persisted `moduleType` is `founder_story`.

- `FOUNDER_STORY_FIELD_DEFINITIONS` defines seven source fields under `tile.moduleData.founderStory`: `founderNameRole`, `observedProblem`, `motivation`, `turningPoint`, `background`, `proofPoints`, and `vision`.
- `getFounderStoryModuleData()` supplies safe read defaults without mutating state; `saveFounderStoryModuleData()` writes additively.
- The reusable narrative is `tile.content`. Editing source fields does not rewrite it.
- `validateFounderStoryGenerationInput()` requires founder identity (field or Brand name) and at least two of six detail fields before AI generation.
- `generateFounderStoryNarrative()` sends stable `moduleType`, board ID, structured `source`, filtered Brand context, and the existing narrative to `/api/generate-founder-story`.
- `openFounderStoryGeneratedReview()` requires explicit “Use this narrative” action. It verifies board, selection, stable tile ID, and typed identity before replacing `content`; cancellation and errors preserve existing content.
- `getFounderStoryDerivedStatus()` is presentation-only: narrative → `story_ready`; any structured field → `in_progress`; otherwise `empty`. It is neither persisted nor a generalized readiness/acceptance contract.
- The card preview prefers narrative, then the first meaningful structured field in a defined order. `renderFounderStoryCustomTileCardContent()` escapes title, preview, and status.

Therefore structured facts are the authoritative inputs, while the narrative is a reusable formulation. Current explicit acceptance applies to generated narrative replacement, but no general persisted “accepted source knowledge” flag exists.

## 6. Existing Brand DNA Architecture

**Observed.** `renderBrandDnaCard()` shows draft/accepted/loading states. `discoverBrandDna()` POSTs the entire `state.brandCore` as `brandBrainData` plus `refineGuidance` to `/api/discover-brand-dna`. A returned draft remains in `state.brandDnaDraft`; `acceptBrandDna()` copies it into `state.brandCore.brandDNA` with `userApproved: true` and saves.

`api/discover-brand-dna.js`:

1. rejects requests with no meaningful Brand Brain data;
2. calls `buildBrandBrainContext(boardId, brandBrainData)`;
3. includes both normalized context text and raw `brandBrainData` JSON in the prompt;
4. hardcodes archetype detection priority: Founder Story, Mission/Vision, Value Proposition, Messaging Pillars, ICP/Personas, and Visual Assets;
5. separately reads website/domain context;
6. instructs the model not to invent facts, testimonials, colors, founder stories, or website content; and
7. normalizes a strict JSON-schema response.

`api/_brand-brain-context.js` hardcodes normalization for positioning/Brand Core, value proposition/USP, offer, personas/ICP, tone, accepted/existing Brand DNA, messaging pillars, content guidance, do/don’t rules, visual assets, voice examples, keywords, and Custom Tile title/content. Its formatted `customContext` ignores `moduleType` and `moduleData`, although the raw JSON included separately in the prompt contains both.

**Answer: does Brand DNA use Founder Story today?** Potentially, but only incidentally. A Founder Story narrative in a Custom Tile can enter normalized `customContext`, and all fields—including structured `moduleData`—are present in raw JSON. The prompt explicitly prioritizes Founder Story. There is no typed lookup, usability/readiness check, duplicate resolution, acceptance check, or declarative dependency. Thus current use is broad payload/prompt behavior, not a Knowledge Graph contract.

## 7. Existing Missing Knowledge Architecture

**Observed.** Missing Knowledge is an allowlist/presence feature, not a dependency engine.

- `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS` hardcodes five IDs: Founder Story, Market Research, Business Plan, Pitch Deck, and Whitepaper.
- `getMissingKnowledgeModuleDefinitions()` resolves those IDs through the registry.
- `getPresentBrandWorkspaceCanonicalModuleIds()` counts a valid, non-malformed tile as present when it has a supported valid `moduleType`; otherwise it accepts an exact normalized canonical title for legacy compatibility.
- `getDashboardKnowledgeInputStatus()` returns `{ label, exists }`; it does not inspect content, structured completeness, acceptance, or readiness.
- `getBrandWorkspaceMissingKnowledgeForSection()` subtracts present modules and `renderBrandWorkspaceMissingKnowledgeBlock()` renders section prompts.
- `createOrSelectMissingKnowledgeTile()` selects the first typed match, then a legacy canonical-title match, or creates a stable typed tile. It does not migrate the legacy match.
- Dashboard evolution/opportunity helpers reuse this presence list; Founder Story and Market Research opportunities are hardcoded.

Current behavior must remain until A4 intentionally integrates graph recommendations.

## 8. First Principles

**Proposed.** The implementation phases must enforce:

1. **Enter once:** consumers resolve existing typed modules instead of asking for duplicate facts.
2. **Keep structure:** facts remain in module-specific structured fields; narratives are representations, not replacements.
3. **Reuse explicitly:** only registry-declared relationships authorize dependency behavior.
4. **Source authority:** derived consumers read but never mutate source modules.
5. **No invented facts:** AI may extract, organize, analyze, synthesize, and formulate supplied material; unsupported assertions do not become Brand knowledge.
6. **User control:** extraction/generation that materially changes reusable knowledge requires review/acceptance.
7. **Guide by default:** recommended dependencies offer completion or continue-anyway; required dependencies block only invalid/unsafe operations.
8. **Stable relationships:** use registry IDs/`moduleType`, never titles or labels.
9. **Data continuity:** graph metadata is additive and registry-only; existing snapshots remain valid.
10. **Declarative behavior:** relationships live centrally in the registry, while runtime state is computed by pure code rather than scattered UI checks.

## 9. Terminology

| Term | Meaning | Not the same as |
|---|---|---|
| Module definition ID / module type | Stable registry identity, e.g. `founder_story`; persisted on typed Custom Tiles as `moduleType` | Instance `id`, title, role |
| Module instance ID | Stable `km_…` Custom Tile identity | Definition ID |
| Knowledge role | `source` or `derived`: origin/authority relationship of a module’s knowledge | Product layer, dependency importance |
| Product layer | Where value is produced: acquisition, Brand intelligence, content intelligence, execution | Current registry `section`/`category` |
| Acquisition method | How facts enter one module, e.g. manual, website extraction, guided AI interview | Module identity or role |
| Dependency | A consumer’s declared required/recommended need for another stable module type | Canvas edge, title similarity |
| Dependency role | `required` or `recommended` importance | Source/derived role |
| Readiness state | Runtime interpretation such as unavailable, started, ready, accepted | Persisted status or UI label |
| Output/capability | What a module can provide/do; current registry uses capabilities | Role or layer |
| Source Module | A module whose primary structured knowledge/evidence is authoritative | Source field, URL, evidence record |
| Source field | One structured input inside a module | Source Module |
| External source | URL/document/interview supplied for extraction | Accepted Brand knowledge |
| Provenance/evidence source | Future record connecting a claim to origin | Acquisition method |

## 10. Conceptual Layers

**Proposed.** Use four conceptual values without mapping them to persisted categories:

- `knowledge_acquisition`: captures primary Brand facts/evidence (Founder Story, mission, audience, product, market).
- `brand_intelligence`: derives strategic conclusions (Brand DNA, archetypes, positioning, tone/messaging strategy).
- `content_intelligence`: creates reusable content assets (About Page, landing copy, press/pitch material).
- `execution`: applies approved knowledge/content in campaigns and channels.

These do not replace current `section` (`foundation`, `strategy`, `intelligence`, `deployment`, `custom`) or `category`. A2 should validate values only for graph-enabled definitions; no UI navigation or storage should consume them.

## 11. Module Taxonomy

**Proposed.** The minimal `knowledgeRole` taxonomy is:

- **Source Module (`source`)**: owns primary structured facts/evidence. It may still have an AI-formulated narrative.
- **Derived Module (`derived`)**: produces conclusions from source and/or other derived modules without rewriting them.

Do not add `content` and `execution` as roles in A2. They answer *where/how output is used*, not *whether knowledge is authoritative or derived*. Represent them as conceptual `layer` values when a real registry module exists; otherwise defer them. This avoids overlap between module role, current categories, capabilities, and product surfaces.

Initial classification: Founder Story = `source` + `knowledge_acquisition`; Brand DNA = `derived` + `brand_intelligence`.

## 12. Proposed Registry Contract

**Proposed, not implemented.** Extend only graph-participating definitions with an optional registry-only object:

```js
founder_story: Object.freeze({
  id: "founder_story",
  // existing fields unchanged
  knowledgeGraph: Object.freeze({
    role: "source",
    layer: "knowledge_acquisition",
    dependencies: Object.freeze([]),
    acquisitionMethods: Object.freeze(["manual"])
  })
}),

brand_dna: Object.freeze({
  id: "brand_dna",
  // existing fields unchanged
  knowledgeGraph: Object.freeze({
    role: "derived",
    layer: "brand_intelligence",
    dependencies: Object.freeze([
      Object.freeze({ moduleType: "founder_story", requirement: "recommended" })
    ]),
    acquisitionMethods: Object.freeze([])
  })
})
```

The outer `knowledgeGraph` namespace keeps new semantics visibly optional, prevents confusion with current `section`/`category`, and gives legacy definitions one clean backward-compatible default: absent means “not graph-enabled.” `dependencies` is the single canonical input representation; do not add parallel `inputs`, `consumes`, `requiredInputs`, or `recommendedInputs` lists.

`produces` is deferred. Current `defaultCapabilities`/`futureCapabilities` already describe behaviors, and no A2–A4 requirement needs output matching. Add an output vocabulary only after a consumer audit establishes identifiers and validation rules.

## 13. Property-by-Property Contract

All properties below are **registry-only**, never copied into Boards, Brands, tiles, or API payloads merely because they exist.

| Property | Purpose and type | Required/default | Validation | Compatibility | Example |
|---|---|---|---|---|---|
| `knowledgeGraph` | Optional frozen plain object containing graph semantics | Optional; absent = module operates exactly as today and is excluded from graph traversal | If present, reject unknown keys in A2 validation | Old definitions require no edits | `{ role, layer, dependencies, acquisitionMethods }` |
| `role` | Authority taxonomy; enum string | Required when `knowledgeGraph` exists; no implicit role | One of `source`, `derived` | Absent graph object has no inferred role | `"source"` |
| `layer` | Conceptual product layer; enum string | Required when graph-enabled | One of four values in §10 | Does not alter current `section`/`category` | `"brand_intelligence"` |
| `dependencies` | Ordered array of direct dependency descriptors | Required when graph-enabled; empty array means none | Frozen array; unique target `moduleType`; each target is another known registry ID; no self-edge; valid `requirement`; entire declared graph acyclic | Missing graph object produces no edges | `[{ moduleType: "founder_story", requirement: "recommended" }]` |
| `dependencies[].moduleType` | Stable target definition ID | Required per descriptor | Must already resolve through registry normalization; store canonical ID; never title | Does not inspect legacy titles | `"founder_story"` |
| `dependencies[].requirement` | Dependency importance | Required; no guessed default | `required` or `recommended` | Existing behavior remains when descriptor absent | `"recommended"` |
| `acquisitionMethods` | Product-supported ways to populate this module | Required when graph-enabled; empty for non-acquisition/derived modules | Unique values from a deliberately small enum; A2 initially permits `manual`; later phases may add audited values | Descriptive only in A2; no buttons/routes | `["manual"]` |

**Deferred acquisition values:** `website_import`, `document_import`, and `ai_interview` should not be advertised in A2 metadata until their flows exist or an audit explicitly permits forward declarations. The contract can accept them later without changing module identity.

**Why no `required` flag on each top-level property?** Presence of `knowledgeGraph` opts a definition into a strict complete contract; this prevents partially declared nodes from producing ambiguous behavior.

## 14. Dependency Semantics

**Proposed.** Dependencies point from consumer to input.

- **Required input:** generation or valid completion cannot proceed without one usable resolved instance. A hard block must explain the missing input and how to satisfy it. “Helpful” is not enough to make an input required.
- **Recommended input:** output remains valid without it, but it should improve relevance/quality. The user may complete it or continue anyway.
- **Direct dependency:** one descriptor in the consuming definition’s `dependencies`.
- **Transitive dependency:** reachable by following dependencies through one or more intermediate consumers. It supports impact/explanation, not automatic hard blocking: only the consumer’s direct required edges gate its action.
- **Missing dependency:** no usable instance satisfies that edge under module-specific readiness and acceptance rules. This differs from mere absence.

Cycles are invalid registry configuration. A2 validation should run depth-first cycle detection across graph-enabled definitions and report the full path. Runtime traversal must also keep `visited`/active-path sets and return a diagnostic rather than loop, protecting against validation bypass or mixed versions.

## 15. Readiness Semantics

**Proposed.** A3 should expose orthogonal facts rather than one universal percentage:

| State | Meaning |
|---|---|
| Unavailable | No matching stable typed instance exists. A legacy title-only tile does not establish graph availability. |
| Available | At least one registry-valid typed instance exists, regardless of content. |
| Started | A module-specific helper finds meaningful partial user data. |
| Ready | A module-specific semantic contract says the instance can be used for its intended downstream purpose. |
| Accepted | Material that requires review (AI-generated/imported) has explicit acceptance; for manual facts that do not require a separate acceptance workflow, the module contract may treat reviewed manual data as usable without inventing a persisted flag. |
| Missing | No resolved instance is **usable for the dependency**, because it is unavailable, not ready enough, unaccepted where required, or ambiguous. |

Readiness is module-specific. A3 should use a resolver table keyed by stable module type (or a narrowly designed registry callback convention after browser/CommonJS review), with a conservative fallback. It must not reuse the current Founder Story card label as a universal contract.

For Founder Story, “started” can reuse the semantic idea of any meaningful structured field/narrative. Downstream readiness should prioritize sufficient structured facts, not merely a narrative. Exact thresholds and how manually written narratives qualify must be finalized with A3 tests. Current `story_ready` means narrative present and is presentation status only.

Source completeness and downstream usability are different: a module can be incomplete yet contain enough accepted facts for a particular recommended consumer. A3 results should include reasons such as `unavailable`, `not_started`, `not_ready`, `acceptance_required`, or `ambiguous`, plus the module-specific readiness result; no state is persisted.

## 16. Module Resolution and Duplicate Handling

**Observed.** `allowMultiple: false` documents intended cardinality and creation helpers usually select existing tiles, but array persistence does not enforce uniqueness. Current selection takes the first typed match, then first exact legacy-title match.

**Proposed A3 smallest safe rule:**

1. Collect only valid persisted typed instances whose `moduleType` equals the target; never match titles.
2. If zero: unavailable.
3. If exactly one: resolve it and evaluate readiness.
4. If more than one and the definition has `allowMultiple: false`: return `ambiguous`; do not silently select “first” or “most complete.”
5. If `allowMultiple: true`: do not aggregate by default. Return the instances plus `resolutionRequired` until the consuming contract explicitly supports aggregation or selection.

“Most complete” hides conflicts and can change unexpectedly. Explicit canonical IDs, user selection, and aggregation require persisted relationships/UI and are deferred. A4 can guide the user to resolve ambiguity; it must not delete, merge, or retag tiles.

Legacy title-only tiles remain usable in the generic editor and current Missing Knowledge compatibility flow, but they do not satisfy graph dependencies. A future opt-in conversion can preserve the tile ID while adding `moduleType`; it requires its own UX/audit.

## 17. Knowledge Impact Model

**Proposed.** Knowledge Impact is a deterministic runtime graph explanation, not persisted stars or an AI confidence score.

First version:

1. For a missing/not-usable input module, enumerate unique **direct downstream consumers** with incoming declared dependencies.
2. Keep only consumers available to the current product/runtime (initially, registry definitions surfaced by the current Brand Workspace); do not count speculative catalog entries.
3. Partition direct consumers into required and recommended, and identify which are currently missing/incomplete or about to be generated.
4. Optionally enumerate unique transitive downstream consumers for explanation, with visited-set cycle protection, but do not use transitive paths for blocking.
5. Sort recommendations lexicographically by a transparent tuple: active/current consumer first, then count of blocked direct required consumers, then count of incomplete direct recommended consumers, then canonical module ID. Do not combine them into a pseudo-scientific decimal.

User-facing output should be categorical/explanatory (“Needed by 1 module” or “Improves Brand DNA”), not `5/5`. If later research requires a score, it must be a presentation mapping from documented counts, never hand-authored registry metadata.

## 18. Founder Story → Brand DNA Reference Flow

**Proposed.** The reference flow is:

1. Resolve `brand_dna` and read its direct `founder_story` recommendation.
2. Resolve exactly one valid typed Founder Story instance.
3. Evaluate module-specific usable structured knowledge and acceptance requirements.
4. If usable, construct a bounded, explicit Founder Story input from the seven structured facts; the accepted/manual narrative may be included as a representation, but cannot override conflicting facts.
5. Pass it to Brand DNA generation under an explicit input label/contract.
6. Brand DNA analyzes emotional origin/archetype signals and produces a reviewable draft.
7. Acceptance writes only Brand DNA’s existing destination. It never updates Founder Story fields, narrative, `moduleType`, or instance ID.

This future explicit construction should replace reliance on arbitrary raw Custom Tile JSON for this relationship, but only in A4 or a separately approved prompt/API phase. Current generation behavior must be preserved until then.

## 19. Missing-Founder-Story Brand DNA UX Contract

**Proposed A4 concept only.** When Brand DNA generation is requested and usable Founder Story is missing, show a soft recommendation:

> Founder Story is one of the strongest inputs for a meaningful Brand DNA.

Actions:

- **Import from website** — show only when Website Import is separately implemented; before then it must be hidden/disabled rather than a dead action.
- **Add manually** — open/select the typed Founder Story flow.
- **Continue without it** — invoke the unchanged Brand DNA generation action.

Concise note: “You can add Founder Story later and regenerate Brand DNA when you are ready.”

The recommendation must distinguish absent, incomplete, acceptance-required, and ambiguous states; it must not claim the module does not exist when it merely is not usable. Dismiss/continue is per invocation unless product research later authorizes persistence.

## 20. Acquisition Methods

**Proposed.** Acquisition method is independent of module identity. `founder_story` remains the same stable module type whether populated by:

- manual entry;
- website/About-page extraction;
- article/interview document extraction; or
- a future guided AI interview.

All non-manual methods are proposals that transform untrusted external material into a review draft. They do not create new module types such as “website Founder Story.” Multiple acquisition runs must target an explicitly resolved instance and must not silently overwrite accepted fields.

## 21. Website Import Placement

**Proposed future flow:** external source → bounded retrieval → extraction → seven structured Founder Story fields → user review/edit → accepted structured knowledge → optional narrative generation/review.

Website content must never bypass structured fields and become an authoritative narrative. Retrieval and extraction are separate trust boundaries. The implementation audit must decide URL validation, redirect/DNS/SSRF defenses, content type/size limits, robots/legal expectations, sanitization, prompt-injection isolation, source attribution, conflict handling, field-level acceptance, retry/cost limits, and whether fetching occurs server-side.

**Deferred:** provenance schema, source URLs/documents, excerpts, timestamps, extraction confidence, per-field evidence links, and import history. A1 adds none; Website Import receives its own audit and implementation phase after A4.

## 22. Derived Knowledge Staleness

**Proposed conceptual states:**

- **Fresh:** no known accepted source change has occurred since the derived output was generated from its recorded inputs.
- **Potentially stale:** a consumed source may have changed and the system cannot prove equivalence.
- **Regeneration recommended:** potentially stale derived output matters to a current action; user is invited to regenerate/review.

Never automatically regenerate and never overwrite an accepted derived result. Accurate fresh/stale determination requires source revisions or normalized hashes plus dependency snapshots, none of which exists today.

**Decision:** defer stale tracking from the first A2–A4 Knowledge Graph release and represent it conceptually only. A2 metadata and A3 direct state do not claim freshness. A4 may use neutral copy (“Founder Story can be added later; regenerate to incorporate it”) but must not label old Brand DNA stale without evidence. A later staleness audit should design revisions/snapshots across manual edits, imports, acceptance, and legacy records.

## 23. AI and Data-Grounding Rules

**Proposed.** AI may summarize, extract, organize, compare, infer explicitly labeled strategic interpretations, and formulate narratives from supplied inputs. It may not add unsupported people, events, claims, metrics, customer evidence, credentials, URLs, or causal conclusions to Brand knowledge.

- Separate untrusted external text from system/developer instructions; treat embedded instructions as data.
- Send only necessary, bounded fields; avoid broad raw state once an explicit contract exists.
- Preserve facts and uncertainty; missing input stays missing.
- Extracted source facts and material mutations require review before becoming reusable accepted knowledge.
- Derived interpretations must be labeled as interpretations and must not mutate source modules.
- Existing archetype `confidence` is model output normalized to 0–100; it is not source provenance, dependency readiness, or Knowledge Impact.

## 24. Persistence Boundaries

**Observed.** `normalizeBrandCoreState()` merges existing Brand Core data with defaults and preserves `customTiles`; `serializeBrandCoreSnapshot()` clones it. `saveBrandBrainState()` stores board-keyed local storage and marks the canvas dirty; board APIs persist the same object in `brand_core_snapshot` JSONB. Brand DNA is stored under `brandDNA`; Custom Tiles retain additive fields such as `id`, `moduleType`, `moduleData`, `items`, and references carried by JSON.

**Proposed.** Persist only existing module-owned user data through existing paths. Keep registry graph definitions, resolved instances, dependency states, direct/transitive paths, readiness reasons, Missing Knowledge recommendations, duplicate diagnostics, impact results, and continue-anyway decisions runtime-derived. Do not persist copied dependency edges, registry metadata, scores, or caches in A2–A4.

No Board or Brand schema migration is necessary to read registry metadata. Future provenance, selected-instance relationships, and staleness snapshots are separate schema decisions.

## 25. Backward Compatibility

**Proposed acceptance rule.** Optional metadata must preserve:

- existing Boards/Brands and `brand_core_snapshot` JSON;
- all existing Custom Tiles, IDs, `moduleType`, `moduleData`, `items`, and references;
- legacy title-only and typed Founder Story tiles;
- generic editing and legacy runtime-index selection;
- current registry IDs, sections, categories, capabilities, and `allowMultiple`;
- current Founder Story specialization/generation/review/card derivation;
- current Brand DNA payload/prompt/generation/acceptance until A4 intentionally changes an entry point;
- current Missing Knowledge presence/title compatibility until A4;
- local save/load, board hydration, API persistence, and campaign behavior.

A definition without `knowledgeGraph` works exactly as today. Legacy tiles remain visible/editable but do not silently gain stable graph identity. No read-time or save-time migration is permitted.

## 26. Security and Trust Boundaries

- **Registry:** trusted application configuration; validate IDs, enums, uniqueness, targets, and acyclicity before consumption.
- **Persisted Brand/Board JSON:** user-controlled/untrusted; validate shapes, stable IDs, types, lengths, and ambiguity without mutating on read.
- **Titles/content/moduleData:** untrusted text; never use title as graph authority; escape in HTML and bound before AI calls.
- **External import:** hostile network/content boundary; prevent SSRF and prompt injection, enforce redirect/domain/IP/content limits, sanitize, and require review.
- **AI output:** untrusted draft; schema/length validation is necessary but not acceptance. Never grant write authority to source modules.
- **Authorization:** board ownership/editor checks remain authoritative. A graph resolver must not cross Board/Brand scope or use data unavailable to the caller.
- **Availability/cost:** cycle guards, depth bounds, payload limits, timeouts, and explicit generation actions prevent runaway traversal/calls.

## 27. Risks and Open Questions

1. What exact Founder Story structured threshold makes it usable for Brand DNA, and can a manual narrative alone qualify?
2. Does manual structured entry need an explicit acceptance action, or is direct editing inherently accepted?
3. Should `acquisitionMethods` advertise future methods or only shipped ones? This document recommends shipped-only.
4. Where should pure module-specific readiness evaluators live so browser and CommonJS use remain aligned?
5. Should A4 integrate both Missing Knowledge and generation entry points, or ship the Brand DNA prompt first to keep scope narrow? Recommendation: entry point first, then Missing Knowledge in a separate commit/PR if needed.
6. How should users resolve malformed duplicate singleton modules without destructive automation?
7. Which registry definitions beyond the first vertical qualify as Source/Derived after domain review?
8. Is a future `produces` vocabulary needed for capability matching, or are dependencies by module type sufficient?
9. What Brand-level persistence model will eventually supersede board-scoped snapshots, if any? It is not required here.
10. What revision/evidence model can support trustworthy freshness and provenance?

## 28. Explicit Non-Goals

A1 does not add registry fields; runtime traversal/resolution; impact scoring; Missing Knowledge changes; Brand DNA prompt/API/request changes; Founder Story changes; Website Import/URL fetching; AI Interview; UI/CSS/navigation; schemas or persisted graph state; provenance/confidence storage; staleness tracking; automatic regeneration; migrations; new specialized modules; or unrelated cleanup.

This architecture also does not reinterpret Campaign Canvas node edges as Knowledge Module dependencies, define a universal readiness percentage, or establish content/execution as Knowledge roles.

## 29. Recommended A2–A4 Implementation Sequence

### A2 — Additive Registry Metadata

- Add the optional strict `knowledgeGraph` contract and constants to `knowledge-module-registry.js`.
- Define only Founder Story (`source`, acquisition layer, manual) and Brand DNA (`derived`, Brand intelligence, recommended Founder Story dependency).
- Add dependency-free validation for shape, targets, unique edges, self-edges, enums, and cycles; cover browser/CommonJS compatibility.
- No UI, runtime dependency behavior, prompt/API changes, readiness changes, persistence, or migration.

### A3 — Dependency and Readiness Engine

- Implement pure, read-only direct dependency state over current board-scoped state.
- Resolve only stable typed instances and expose unavailable/available/started/ready/accepted-or-required/ambiguous facts and reasons.
- Implement Founder Story and Brand DNA-specific evaluators conservatively; preserve existing card status helpers and presentation.
- Return direct state plus separately requested transitive/impact diagnostics with cycle guards.
- Add unit/VM tests; no UI, AI request changes, persisted state, recommendations, or mutations.

### A4 — Recommendation Integration

- First integrate the graph result at Brand DNA’s generation entry point.
- When Founder Story is unusable, show the soft recommendation, manual path, continue-anyway, and later/regenerate note. Do not expose Website Import until shipped.
- Continue-anyway must call the current generation path; required edges (none in the initial vertical) would block with explanation.
- In a separately reviewable slice, use graph-derived state to enhance Missing Knowledge while retaining legacy current behavior and copy where the graph has no metadata.
- Explicit Founder Story input construction and prompt/API consumption should be separately reviewed within A4 because they alter AI behavior; no source mutation or automatic regeneration.

This sequence is safer than combining UI and prompt changes: registry validation lands first, pure resolution second, recommendation UX third, and AI consumption only after the input contract is tested.

### Deferred Website Import phase

Run a dedicated acquisition/security/persistence audit, then implement URL/document retrieval, safe extraction into structured fields, review/acceptance, conflict behavior, and provenance only if approved. Do not bundle it into A4.

## 30. Acceptance Criteria

- [x] Current registry, identity, adapter, app, Campaign V3, Founder Story, Brand DNA, Missing Knowledge, readiness/card, persistence, and AI construction paths are named and distinguished from proposals.
- [x] Stable definition identity (`moduleType`) is distinct from stable instance `id`; titles are excluded from future graph relationships.
- [x] Source/derived roles, four conceptual layers, acquisition methods, dependency roles, readiness, and outputs/capabilities do not overlap.
- [x] The smallest optional registry contract is specified property by property, including defaults, validation, persistence, examples, and compatibility.
- [x] Required/recommended and direct/transitive semantics, cycle validation, legacy behavior, duplicate ambiguity, and module-specific readiness are defined.
- [x] Knowledge Impact is deterministic and explanatory, not persisted or hand-rated.
- [x] Founder Story → Brand DNA, missing-input UX, Website Import placement, grounding, trust, persistence, and staleness boundaries are explicit.
- [x] Existing data and behavior remain valid; no schema migration is proposed for A2–A4 metadata/state.
- [x] A2, A3, A4, and deferred Website Import scopes are independently reviewable.
- [x] The A1 diff contains this document only and makes no runtime, UI, prompt, route, persistence, configuration, dependency, or generated-artifact change.
