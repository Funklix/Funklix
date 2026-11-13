# BW-46.1 — Brand Profile field integrity matrix

Base: `14eb9617fd7821fff0dde727dec04fb754ff0f0e`, including PR #859. The inventory follows actual `core()` / `blankBrandCore`, guided `FIELDS`/`fields`, canonical advanced JSON form, registry module definitions, Founder and strategy editors, protected write contract and downstream projectors. JSONB's ability to store a key alone is **not** classified as working editability.

## Verification method and notation

The new browser check runs real `app.js` and `brand-profile-setup.js` bindings, `BrandWriteContract.submit`, preview/PUT handlers and authoritative GET against the existing disposable SQL adapter. It edits every one of the 28 guided bindings, saves/reloads, corrects website-derived stored data, clears permitted values and tests required-name validation. It also changes/inserts advanced structures through the actual JSON textarea and Save Canonical Brand action, reloads, and tests content clearing. The full fixture-leaf ledger below distinguishes actual editing from preservation-only checks. It does not claim independent PostgreSQL execution for every UI field.

Independent real PostgreSQL suites exercise the shared ACL/revision/expected-value/review/history/receipt boundary. Website fixtures, providers, storage and browser data are fictional. Existing Founder mapping/lifecycle/preflight, Logo/Avatar, role, conflict and Brain proposal suites supplement the new tests. Source inspection is labeled separately from runtime evidence; untested controls are not promoted to tested success.

A = manual entry; B = existing eligible AI suggestion; C = edit AI draft before acceptance; D = stored-value edit; E = reload; F = clearing; G = preserve nonempty during research; H = unrelated/nested preservation on adoption; I = permission enforcement; J = canonical/snapshot isolation; K = intended downstream availability; L = visible errors/conflicts/missing controls.

Codes: **T** tested production client/HTTP path with disposable transport/SQL adapter; **P** shared PostgreSQL contract tested; **S** source-inspected; **U** not exercised for this field; **—** not applicable/no such workflow. **W** website native suggestion; **M** returned research-only module draft, manual review required; **Dna** existing DNA workflow; **Fs** existing specific-page Founder workflow; **St** existing Board strategy workflow; **Brain** controlled Value Proposition draft handoff. These are distinct workflows and authorities.

For every canonical row below, **I=P** refers to the same independent Brand ACL (owner/admin/editor edit; viewer read) and protected writer; it is not a claim that every field has separate per-field ACL logic. **J=T/P** means profile/advanced saves do not mutate `boards.brand_core_snapshot`; explicit campaign synchronization remains separate. **G=T** for the seeded nonempty identity/persona/assets/DNA/Founder/unknown structures, with existing guided tests covering native empty-fill versus conflicts; other optional aliases/module states are **S** under the same allowlisted research adoption path. **H=T/P** protects unrelated targets/unknown siblings; replacing a reviewed array intentionally replaces that array's entries. **L=T** covers ordinary validation/conflict/reload errors; absent controls and workflow-specific gaps are called out below. These common results apply to each listed row unless its row says otherwise.

`C=/brand_core` in paths below refers to JSON in `brands.brand_core`; `/name` is `brands.name`. `T(type)` means the existing array member `/brand_core/customTiles/<index>` whose `moduleType=type` and stable `km_...` ID match. The numeric pointers in the leaf ledger are exact fixture pointers, not a stable production index contract.

## Native and guided inventory

| Exact schema path / owner and UI | A | B | C | D | E | F | K / consumer | Classification |
|---|---|---|---|---|---|---|---|---|
| `/name`; Brand row; Overview / advanced name | T | — (no inferred rename) | — | T | T | T: required, empty rejected visibly | Catalog/sidebar/Home/Brain/creation (S) | Fully functional and tested |
| `/brand_core/brandAssets/domain`; Overview website | T | User URL only; AI domain excluded | — | T | T | T: optional clear | Logo acquisition, Profile, DNA/context (S) | Fully functional and tested |
| `/brand_core/website`; legacy fallback, displayed when domain absent | S: advanced JSON | — | — | U | U | U; fallback can reappear if only domain cleared | Guided fallback (S) | Partially supported; fallback clearing untested |
| `/brand_core/brandCore`; Overview description | T | W | **No** website value editor (T) | T | T | T | DNA/raw Brain/campaign positioning (S) | Partially supported (F1) |
| `/brand_core/valueProposition`; Overview | T | W / Brain | W: no (T); Brain: staged editable draft (existing test) | T | T | T | DNA/Brain/campaign USP/readiness (S) | Partially supported (F1) |
| `/brand_core/toneOfVoice[]`; Voice & Messaging | T | W | No (T/S) | T | T | T: empty list | Context/Brain/campaigns (S) | Partially supported (F1) |
| `/brand_core/messagingPillars[]`; Voice & Messaging | T | W | No (T/S) | T | T | T | Context/Brain/campaigns (S) | Partially supported (F1) |
| `/brand_core/contentGuidelines[]`; Voice & Messaging | T | W | No (T/S) | T | T | T | Context/Brain/campaigns (S) | Partially supported (F1) |
| `/brand_core/keywords[]`; Voice & Messaging | T | W | No (T/S) | T | T | T | Context/Brain/campaigns (S) | Partially supported (F1) |
| `/brand_core/dosAndDonts/dos[]`; Voice & Messaging | T | W | No (T/S) | T | T | T | Communication context (S) | Partially supported (F1) |
| `/brand_core/dosAndDonts/donts[]`; Voice & Messaging | T | W | No (T/S) | T | T | T | Communication context (S) | Partially supported (F1) |
| `/brand_core/brandVoiceExamples/good`; Voice & Messaging | T | W | No (T/S) | T | T | T | Brain/campaign context (S) | Partially supported (F1) |
| `/brand_core/brandVoiceExamples/avoid`; Voice & Messaging | T | W | No (T/S) | T | T | T | Brain/campaign context (S) | Partially supported (F1) |
| `/brand_core/personas/<index>/name`; Audience | T | W | No (T) | T | T | T: text clear; no guided remove-row action | Context persona name (S) | Partially supported (F1/F4) |
| `/brand_core/personas/<index>/note`; Audience | T | W | No (T) | T | T | T: text clear | **Lost in normalized campaign context**; raw core retains it | Verified defect (F2), manual storage works |
| `/brand_core/personas/<index>/description`; existing richer fallback | S guided fallback / advanced | W emits note only | No general richer-persona draft editor | U for this alias | U | U; note/description fallback needs separate characterization | `formatPersona` reads description (S) | Partially supported |
| Other persona keys (`role`, `jobTitle`, `summary`, `needs`, `painPoints`, `motivations`, etc. when present) | Advanced only; guided readable remainder (S) | Not domain output | — | U | U | U | Supported formatter subset (S); arbitrary unknown keys have no guaranteed consumer | Functional through advanced editor in principle; per-alias runtime untested |
| `/brand_core/brandAssets/colors[]`; Assets | T | W | No (S) | T | T | T | Visual style/DNA/context (S) | Partially supported (F1) |
| `/brand_core/brandAssets/typography`; Assets | T | W | No (S) | T | T | T | Visual style/DNA/context (S) | Partially supported (F1) |
| `/brand_core/brandAssets/references[]`; Assets | T | W; **not** proof those URLs were fetched | No (S) | T | T | T | Visual references/context (S) | Partially supported (F1) |
| `/brand_core/brandAssets/logo`, `/brand_core/brandAssets/logoAsset`; legacy JSON | Advanced storage only (S) | Domain never adopts logo | Separate logo review | U for legacy JSON | U | U | Not canonical logo authority | Partially supported; legacy metadata only |
| `/brand_core/personality`, `/brand_core/positioning`, `/brand_core/audiences`; optional existing display | Advanced T; guided read-only | Not emitted by current domain/DNA contract | — | T advanced | T | T | Raw core; aliases not uniformly normalized (S) | Read-only in guided editor by design; functional through advanced editor |
| `/brand_core/offers[]`, `/brand_core/proof[]`; Offers & Proof display | Advanced T; no guided inputs | Not native domain output | — | T advanced | T | T | Raw core/Profile; no universal normalized offer/proof projection (S) | Read-only in guided editor by design; functional through advanced editor |

## Modules and lifecycle inventory

| Exact schema path / UI authority | A | B | C | D | E | F | K / consumer | Classification |
|---|---|---|---|---|---|---|---|---|
| `T(mission)/content`; Overview/Foundation | T | M; research-only | Manual module entry; no automatic adoption | T | T | T | Raw DNA/Brain + bounded custom context (S) | Fully functional manual field; research draft requires manual review |
| `T(vision)/content`; Overview/Foundation | T | M | Same | T | T | T | Same | Fully functional manual field; research draft requires manual review |
| `T(values)/content`; Overview/Foundation | T | M | Same | T | T | T | Same | Fully functional manual field; research draft requires manual review |
| `T(founder_story)/content`; plain guided narrative | T | Fs narrative generation is a separate specialized workflow | Specialized narrative preview editable (S/existing tests) | T | T | T | DNA preflight requires accepted facts/lifecycle, not plain text alone | Partially supported (F5 authority/acceptance distinction) |
| `T(founder_story)/moduleData/founderStory/founderNameRole` | T advanced; Board specialized source input (S) | Fs | Editable import textarea (existing lifecycle test) | T advanced | T | T advanced | Accepted structured DNA Founder context (existing test) | Functional through advanced editor; specialized canonical UI absent |
| `…/observedProblem` | T advanced | Fs | Same | T | T | T | Same | Same |
| `…/motivation` | T advanced | Fs | Same | T | T | T | Same | Same |
| `…/turningPoint` | T advanced | Fs | Same | T | T | T | Same | Same |
| `…/background` | T advanced | Fs | Same | T | T | T | Same | Same |
| `…/proofPoints` | T advanced | Fs, supported exact excerpts only | Same | T | T | T | Same | Same |
| `…/vision` | T advanced | Fs | Same | T | T | T | Same | Same |
| `T(founder_story)/moduleData/founderStoryImport/{status,confirmedAt}` | Controlled by Apply; not ordinary form input | Fs | Selection/value review before Apply | Preservation inspected; direct edits U | Existing import test | U; lifecycle control, not an ordinary clearable fact | Confirmed source-fact import (S) | Partially supported; controlled metadata |
| `T(founder_story)/moduleData/founderStoryLifecycle/{status,acceptedAt}` | Controlled narrative acceptance | Fs narrative | Narrative review | Preserved T; direct metadata edit U | T preservation/existing test | U; clearing must preserve dependency semantics | Founder→DNA dependency (existing test) | Controlled metadata; not claimed freely editable |
| `T(audience)/content`, `T(icp)/content`; guided Audience display | Advanced T; guided read-only | M for existing modules only | Manual review required | T advanced | T | T advanced | Raw/normalized custom context (S) | Read-only in guided editor by design; functional advanced |
| `T(product_knowledge)/content`; Offers & Proof | Advanced T; guided read-only | M | Manual review required | T | T | T | Product context via custom module (S) | Read-only guided by design; functional advanced |
| `T(competitor_research)/content`, `T(custom)/content` | Advanced T; legacy module editor (S) | No domain competitor inference | — | T | T | T | Bounded custom context/raw Brain (S) | Functional through advanced editor |
| `T(website_analysis)/content` | Advanced T; no functioning durable research module contract | Not auto-filled | — | T | T | T | Generic content only; not provenance storage | Partially supported; registry label is not a research system |
| `T(pitch_deck)/content`, `T(whitepaper)/content` | Advanced T; guided proof display read-only | No website document import here | — | T | T | T | Excluded from generic custom-context projector; document authorization remains separate | Read-only guided by design; functional advanced; private document handling unchanged |
| `T(market_research)/content`, `T(business_plan)/content` | Advanced T; specialized Board editor S | St | Board draft review editable (S) | T advanced | T | T advanced | Accepted namespace is actual strategy authority; content alone insufficient | Functional through advanced editor; specialized Board controls not runtime-tested here |
| Strategy `moduleData.<namespace>.structuredFacts.<field>` | Specialized Board inputs S; canonical advanced available | St | Draft review | U for top-level source-input copy in new test | U | U | Generation inputs, not accepted strategy context | Partially supported / explicitly untested per-field input binding |
| Strategy `moduleData.<namespace>.draft.{content,structuredFacts.<field>}` | T advanced | St | Board review S; canonical JSON manually editable | T | T | T content | Draft excluded from accepted-strategy projector | Functional through advanced editor; canonical specialized review absent |
| Strategy `moduleData.<namespace>.accepted.{content,structuredFacts.<field>}` | T advanced | St after explicit acceptance | Board review S | T | T | T content | Real `projectAcceptedStrategyModule` asserted for all supported facts; sourceNotes exception below | Functional through advanced editor |
| Strategy accepted `{acceptedAt,revisionId,provenanceRefs}`; draft `{createdAt,origin,basedOnAcceptedRevisionId}`; lifecycle `{status,updatedAt,lastError}`; `pendingGeneration` | Workflow-owned S | Existing generation/acceptance | Board controls S | New fixture sets acceptedAt/revisionId/status; other metadata edits U | Set/preserved subset T | U; do not erase acceptance dependencies casually | Required acceptance/stable-ID gates; history metadata is not public fact verification | Partially supported; untested metadata labeled |

Both strategy fact inventories are exact and apply separately to source-input `structuredFacts`, draft `structuredFacts`, and accepted `structuredFacts`. The new test exercises **draft and accepted** fact copies through canonical advanced save/reload/clearing; it does not exercise all specialized Board inputs.

- `market_research`, namespace `marketResearch`: `marketCategory`, `geographicFocus`, `marketScope`, `researchObjective`, `researchDate`, `customerSegments[]`, `primaryNeeds[]`, `buyingTriggers[]`, `adoptionBarriers[]`, `competitors[]`, `alternatives[]`, `differentiationOpportunities[]`, `trends[]`, `opportunities[]`, `risks[]`, `positioningImplications[]`, `messagingImplications[]`, `channelImplications[]`, `recommendedNextSteps[]`, `userProvidedFacts[]`, `assumptionsToValidate[]`, `sourceNotes[]`.
- `business_plan`, namespace `businessPlan`: `businessSummary`, `problem`, `solution`, `currentStage`, `objectives[]`, `targetCustomers[]`, `marketNeed`, `competitivePosition`, `marketResearchReference`, `offer`, `revenueModel`, `pricing`, `salesChannels[]`, `distributionModel`, `acquisitionStrategy[]`, `retentionStrategy[]`, `partnerships[]`, `keyMilestones[]`, `coreActivities[]`, `resources[]`, `team[]`, `operationalRisks[]`, `revenueAssumptions`, `costAssumptions`, `fundingNeeds`, `budgetNotes`, `confirmedFacts[]`, `assumptionsToValidate[]`, `openQuestions[]`.

The new test compares these keys to the actual `STRATEGY_MODULE_CONFIG` form definitions and server generation contracts, uses real `km_...` module identities, and invokes the downstream accepted-module projector. `marketResearch.accepted.structuredFacts.sourceNotes` saves/reloads but is omitted from that projector (F3). Financial assumptions remain assumptions, not verified facts.

Registry runtime aliases `brand_core`, `value_proposition`, `messaging_pillars`, `tone_of_voice`, `personas`, `brand_assets`, `keywords`, `content_guidelines`, `dos_and_donts`, `voice_examples`, `brand_dna`, `brand_avatar` map to the native paths already listed; they do not create duplicate canonical fields. Module `id`, `moduleType`, `title`, and `moduleData` are preserved through the actual array save. IDs/type are identity/lifecycle data; arbitrary changes are not claimed as supported content edits.

## DNA, assets and independent authorities

| Exact path / owner | A | B | C | D | E | F | G/H/I/J | K / L | Classification |
|---|---|---|---|---|---|---|---|---|---|
| `/brand_core/brandDNA/primaryArchetype`, `secondaryArchetype` | T guided | Dna | **No reliable generated-draft editing** (F6) | T | T | T: stored strings can clear | Shared; approved avatar preserved | Archetype consumers S; errors tested | Verified defect for draft edit; stored fields functional |
| `…/personality`, `positioning` (optional legacy strings) | T guided | Not guaranteed discovery outputs | Same draft-binding caution | T | T | T | Shared | Display/raw context S | Partially supported; optional aliases |
| `…/reasoning`, `recommendedVoice`, `recommendedVisualDirection` | T guided | Dna | Same F6 | T | T | T | Shared | DNA/Brain/campaign guidance S | Partially supported (F6) |
| `…/primaryConfidence`, `secondaryConfidence` | T advanced; guided display only | Dna | No numeric guided draft editor | T advanced | T | U numeric clear | Shared | Archetype display/guidance S | Functional through advanced editor; clearing untested |
| `…/alternatives[].{archetype,confidence,why}` | T advanced; guided rendered | Dna | No guided structured edit | T | T | T: array clear | Shared | Alternatives display S | Read-only guided by design; functional advanced |
| `…/signals.{toneSignals,missionSignals,audienceSignals,messagingSignals,visualSignals}[]` | T advanced; guided readable | Dna | No guided structured edit | T | T | T | Shared | DNA/context S | Read-only guided by design; functional advanced |
| `…/userApproved` | Explicit `accept_dna`, not ordinary checkbox | Dna produces draft only | Accept action; not factual certification | Existing accept path T; manual status editing U | Preserved T/P | U; avatar downgrade dependency reviewed | Protected typed intent P | Approval controls strategy/Avatar availability | Controlled metadata; not freely editable |
| `…/avatar.{imageUrl,prompt,userApproved,...}` | Generated preview/direction, explicit `accept_avatar`; JSON storage is not image upload | Existing Avatar workflow | Direction editable before generation; returned image reviewed, not pixel-edited | Existing replace/accept T; arbitrary leaf editing U | Existing suites T | Guided image removal absent; direct metadata clear U | Preserved T/P; independent logo | Approved-avatar readers S; generation/reload errors T | Partially supported; lifecycle-controlled asset |
| Separate `brands.logo_object_path`, `logo_mime_type`, `logo_source`, `logo_source_host`, `logo_revision`, `logo_updated_at`; derived authorized `logo_url` | Upload / reviewed discovery / Remove logo | Website logo **preview**, no semantic logo fact | User chooses candidate; cannot text-edit binary image | Existing actual upload/replace/remove/reload suites T/P | T/P | Remove tested | Independent revision/authority; upload priority T/P | Shared logo renderer; storage/config errors visible | Fully functional via dedicated logo controls; server metadata not manual fields |
| Governed `brand_learnings`: `statement`, `evidence_summary`, `source_type`, `status`, `revision`, optional source references/snapshots | Separate Learnings editor/lifecycle | Existing governed advisor proposal only | Existing Learnings review/editor | Existing suite T/P | Existing suite T/P | Reject/archive lifecycle, not deletion-by-profile | Research never writes; separate Brand ACL | Approved-only authorized Brain integration tested | Functional through dedicated library; each optional metadata control not re-tested here |
| `brand_members.email/role` / workspace membership | Team controls, separate authority | — | — | Existing role suites | Existing suites | Remove member requires role | No research write; Brand ACL independent of Board | Membership error/uncertain-state controls S | Functional separate Team surface; no per-field new UI test |
| `boards.brand_core_snapshot` / source revision/timestamps | Explicit Campaign Sync/snapshot editor | Legacy website importer can replace after confirmation | Existing confirmation | Separate Board ACL | Existing isolation suites | Separate Board contract | **J=T/P:** canonical saves isolated | Canvas/campaign consumers use snapshot; canonical identity/Learnings separately authorized | Separate authority, preserved |

No native dedicated verified company-address/founding-date/customer-count/testimonial-citation/product-catalog/pricing-catalog field is invented. Such concepts may occur in appropriate existing module text. Missing website, Founder, DNA or assets remain optional inputs; readiness/scoring policy is unchanged. Approval does not convert strategy or marketing text into verified company facts.

## Verified defects and narrow follow-ups

| Finding | Evidence / effect | Priority and separate fix boundary |
|---|---|---|
| F1 Website comparison has Keep/Use but no value input; empty fields save automatically | Actual `.profile-proposal` contains no input/textarea. `persistSuggestions` accepts the original proposal; stored values remain manually editable afterward. C fails for website review even while A/D/E/F work. New coverage copy discloses current auto-save. | High: separately approved review-before-adoption UX; do not silently change current auto-fill in BW-46.1 |
| F2 `personas[].note` missing in normalized campaign context | `formatPersona` reads description/summary but not note. Raw canonical/snapshot data survives; normalized `icp` loses guided/domain needs. | High: narrow backward-compatible formatter fallback + parity test; no storage migration |
| F3 Accepted Market Research `sourceNotes` omitted downstream | Real accepted-module projector test; saved sourceNotes present, confirmed/assumption projection excludes it. | Medium: deliberate bounded provenance/context contract, not blanket raw-context expansion |
| F4 Guided personas cannot remove an existing row | Actual controls support Add audience and edit name/note only; empty child strings save, array element remains. | Medium: separate narrow remove control with preservation/confirmation checks |
| F5 Guided plain Founder Story content does not establish accepted structured facts | Guided textarea saves tile content; specialized importer/narrative acceptance owns separate lifecycle. | Medium: authority-aware canonical entry point in later approved UX; no competing source model |
| F6 DNA review binds text inputs to `state.core.brandDNA`, but Save Brand DNA merges `state.dnaDraft` over them | Actual `createSession.acceptDna` + production protected handler test: local primary archetype Lover, generated draft Hero → saved Hero. Existing accepted Avatar preserved. Post-save manual correction works, but pre-accept draft correction is unreliable. | High: separate narrow draft-binding/acceptance correction; no broad editor rewrite |
| Legacy creation mismatch remains inherited | `submitCanonicalBrandCreation` legacy payload differs from typed server creation contract (BW-46.0); not changed here. | Separate existing creation compatibility fix |

F1/F4/F5 are verified UI limitations; F2/F3/F6 are concrete data/flow defects. No claim that all fields are fully functional is made. Existing working Founder/Logo/Avatar/Brain workflows remain intact.

## Limits of verification

Specialized strategy Board input-by-input clearing, all richer persona aliases, legacy website fallback clearing, all optional Learnings metadata controls, arbitrary DNA/Avatar status edits, manual screen-reader testing and live provider semantic accuracy remain untested in this package. Existing suites cover many lifecycle behaviors but do not justify a universal per-field pass. Source restrictions, robot behavior and provider excerpts are fixture-tested, not audited against real customer websites. Durable source grounding is explicitly unavailable after refresh/save; no evidence namespace is persisted.

## Exact fixture-leaf ledger

The following table is generated from successful actual guided/advanced form save/reload checks. “Preserved; edit not exercised” is not counted as editability. Scalar/list leaf indices below identify this fictional fixture only. Parent-array clearing can remove a previously tested `/0` leaf; that is an explicit successful clear, not missing persistence. Common G/H/I/J/L results and the workflow-specific B/C/K qualifications above apply to each row.

| Exact pointer | Actual editor | A/D/E manual edit + save/reload | F clear |
|---|---|---|---|
| `/name` | guided | pass | required-name validation pass |
| `/brand_core/brandAssets/domain` | guided | pass | pass |
| `/brand_core/brandCore` | guided | pass | pass |
| `/brand_core/valueProposition` | guided | pass | pass |
| `/brand_core/customTiles/mission/content` | guided | pass | pass |
| `/brand_core/customTiles/vision/content` | guided | pass | pass |
| `/brand_core/customTiles/values/content` | guided | pass | pass |
| `/brand_core/customTiles/founder_story/content` | guided | pass | pass |
| `/brand_core/personas/0/name` | guided | pass | pass |
| `/brand_core/personas/0/note` | guided | pass | pass |
| `/brand_core/toneOfVoice` | guided | pass | pass |
| `/brand_core/messagingPillars` | guided | pass | pass |
| `/brand_core/contentGuidelines` | guided | pass | pass |
| `/brand_core/keywords` | guided | pass | pass |
| `/brand_core/dosAndDonts/dos` | guided | pass | pass |
| `/brand_core/dosAndDonts/donts` | guided | pass | pass |
| `/brand_core/brandVoiceExamples/good` | guided | pass | pass |
| `/brand_core/brandVoiceExamples/avoid` | guided | pass | pass |
| `/brand_core/brandAssets/colors` | guided | pass | pass |
| `/brand_core/brandAssets/typography` | guided | pass | pass |
| `/brand_core/brandAssets/references` | guided | pass | pass |
| `/brand_core/brandDNA/primaryArchetype` | guided | pass | pass |
| `/brand_core/brandDNA/secondaryArchetype` | guided | pass | pass |
| `/brand_core/brandDNA/personality` | guided | pass | pass |
| `/brand_core/brandDNA/positioning` | guided | pass | pass |
| `/brand_core/brandDNA/reasoning` | guided | pass | pass |
| `/brand_core/brandDNA/recommendedVoice` | guided | pass | pass |
| `/brand_core/brandDNA/recommendedVisualDirection` | guided | pass | pass |
| `/brand_core/brandAssets/future` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/brandDNA/userApproved` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/brandDNA/primaryConfidence` | advanced JSON | pass | not exercised |
| `/brand_core/brandDNA/secondaryConfidence` | advanced JSON | pass | not exercised |
| `/brand_core/brandDNA/signals/toneSignals/0` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/signals/missionSignals/0` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/signals/audienceSignals/0` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/signals/messagingSignals/0` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/signals/visualSignals/0` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/avatar/userApproved` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/brandDNA/avatar/imageUrl` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/brandDNA/avatar/future` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/brandDNA/alternatives/0/archetype` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/alternatives/0/confidence` | advanced JSON | pass | pass |
| `/brand_core/brandDNA/alternatives/0/why` | advanced JSON | pass | pass |
| `/brand_core/customTiles/0/id` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/0/moduleType` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/0/title` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/0/content` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/1/id` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/1/moduleType` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/1/title` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/1/content` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/2/id` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/2/moduleType` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/2/title` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/2/content` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/id` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/moduleType` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/title` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/content` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/moduleData/founderStory/founderNameRole` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/observedProblem` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/motivation` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/turningPoint` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/background` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/proofPoints` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStory/vision` | advanced JSON | pass | pass |
| `/brand_core/customTiles/3/moduleData/founderStoryLifecycle/status` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/3/moduleData/founderStoryLifecycle/acceptedAt` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/customTiles/4/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/4/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/4/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/4/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/5/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/5/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/5/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/5/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/6/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/6/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/6/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/6/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/7/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/7/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/7/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/7/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/8/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/8/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/8/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/8/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/9/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/9/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/9/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/9/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/10/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/10/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/10/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/10/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/11/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/11/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/11/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/11/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/12/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/12/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/12/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/revisionId` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/acceptedAt` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/marketCategory` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/geographicFocus` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/marketScope` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/researchObjective` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/researchDate` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/customerSegments/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/primaryNeeds/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/buyingTriggers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/adoptionBarriers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/competitors/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/alternatives/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/differentiationOpportunities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/trends/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/opportunities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/risks/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/positioningImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/messagingImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/channelImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/recommendedNextSteps/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/userProvidedFacts/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/assumptionsToValidate/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/accepted/structuredFacts/sourceNotes/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/marketCategory` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/geographicFocus` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/marketScope` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/researchObjective` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/researchDate` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/customerSegments/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/primaryNeeds/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/buyingTriggers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/adoptionBarriers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/competitors/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/alternatives/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/differentiationOpportunities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/trends/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/opportunities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/risks/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/positioningImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/messagingImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/channelImplications/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/recommendedNextSteps/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/userProvidedFacts/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/assumptionsToValidate/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/draft/structuredFacts/sourceNotes/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/12/moduleData/marketResearch/lifecycle/status` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/id` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/moduleType` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/title` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/revisionId` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/acceptedAt` | advanced JSON | pass | not exercised |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/businessSummary` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/problem` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/solution` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/currentStage` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/objectives/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/targetCustomers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/marketNeed` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/competitivePosition` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/marketResearchReference` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/offer` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/revenueModel` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/pricing` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/salesChannels/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/distributionModel` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/acquisitionStrategy/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/retentionStrategy/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/partnerships/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/keyMilestones/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/coreActivities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/resources/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/team/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/operationalRisks/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/revenueAssumptions` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/costAssumptions` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/fundingNeeds` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/budgetNotes` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/confirmedFacts/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/assumptionsToValidate/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/accepted/structuredFacts/openQuestions/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/content` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/businessSummary` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/problem` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/solution` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/currentStage` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/objectives/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/targetCustomers/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/marketNeed` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/competitivePosition` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/marketResearchReference` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/offer` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/revenueModel` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/pricing` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/salesChannels/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/distributionModel` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/acquisitionStrategy/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/retentionStrategy/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/partnerships/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/keyMilestones/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/coreActivities/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/resources/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/team/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/operationalRisks/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/revenueAssumptions` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/costAssumptions` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/fundingNeeds` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/budgetNotes` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/confirmedFacts/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/assumptionsToValidate/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/draft/structuredFacts/openQuestions/0` | advanced JSON | pass | pass |
| `/brand_core/customTiles/13/moduleData/businessPlan/lifecycle/status` | advanced JSON | pass | not exercised |
| `/brand_core/future/nested/keep` | advanced JSON | preserved; edit not exercised | not exercised |
| `/brand_core/personality` | advanced JSON | pass | pass |
| `/brand_core/positioning` | advanced JSON | pass | pass |
| `/brand_core/audiences/0` | advanced JSON | pass | pass |
| `/brand_core/offers/0/name` | advanced JSON | pass | pass |
| `/brand_core/offers/0/benefit` | advanced JSON | pass | pass |
| `/brand_core/proof/0/evidence` | advanced JSON | pass | pass |

Measured fixture: 227 inspected leaf paths; 28 guided bindings; 203 changed/entered leaves; 164 cleared leaves. These counts include module identity/metadata insertion and preservation checks; they are not a count of independently native product fields.

## BW-46.2 verified changes (base #861)

The original ledger above remains the baseline, with its untested controls and separate-owner qualifications. See [implementation and validation](../implementations/bw46-2-brand-intelligence-enrichment.md). The old website path retains its automatic empty fill and original read-only comparisons (F1). The new explicitly requested enrichment path adds review-before-adoption with editable text/structured proposals for the ten existing native groups and existing mission/vision/values content. No competing persistence editor, Founder/DNA approval or private-document projection is introduced.

| Fields / contract | BW-46.2 result | Remaining qualification |
|---|---|---|
| Description, Value Proposition; voice/messaging/guidelines/keywords; personas; rules/examples; colors/typography/references; mission/vision/values | New controller tests exercise every eligible key through review/editable draft, protected acceptance, reload, later manual correction/save and clear/save; all 28 guided bindings remain independently browser-tested | New Review structured proposals use validated JSON editing; dedicated field-level/question controls await BW-46.3. Reviewing an array replaces that array intentionally |
| Source lineage and explicit decisions | `_profileEvidence` latest per-field record plus referenced original user input persists atomically through the existing protected writer. Accept/reject/postpone and source inspection survive reload | It is user-owned provenance, not independently verified truth; prior snapshots remain in existing protected history. Historical evidence is labeled when manual values change |
| F2 persona note context loss | Fixed: normalized persona formatting includes distinct note alongside description/summary; production projection regression and existing field-browser check pass | Existing downstream text/list bounds remain |
| F3 accepted Market Research sourceNotes | Preserved in canonical storage; still omitted from generic accepted-strategy factual projection | Requires deliberate source/provenance consumer design, not conversion into confirmed facts |
| F4 row removal / F5 specialized canonical Founder UI / F6 DNA generated-draft input binding | Existing ownership and baseline limitations unchanged; F6 defect characterization retained | Separate controls/fixes required; general enrichment cannot claim these are repaired |
| Offers/proof/optional aliases and audience/product/strategy module content | Existing advanced editor and accepted-module owners retained; not new general enrichment targets | Broader normalized downstream projection and specialized canonical UI remain limited as above |
| Board snapshots and canonical-only evidence | New project copy and explicit refresh omit private evidence; comparison/confirmation use the same projection; enrichment leaves existing snapshots untouched | Explicit campaign sync remains required; private inputs are not supplied to Board-only users |

These results do not certify every optional alias, arbitrary lifecycle metadata edit, specialized Board input, screen reader path or live model factual accuracy. Shared PostgreSQL/CI protection gates remain distinct from the disposable SQL adapter and browser checks.

## BW-46.3 UI verification (base #862)

The baseline ledger and its per-alias qualifications remain above; this section supersedes the specific UI limitations below. See [implemented UX and regression evidence](../implementations/bw46-3-brand-profile-onboarding-ux.md).

| Fields / flow | BW-46.3 change and verification | Qualification |
|---|---|---|
| All 28 existing guided bindings | Existing real browser ledger passes manual entry, save/reload, subsequent correction, permitted clearing, nested preservation, viewer denial and campaign isolation | Advanced content/227-leaf ledger retains its original preservation-only and untested metadata labels |
| Ten native enrichment groups + plain mission/vision/values | Direct manual/AI/question/later actions; existing BW-46.2 editable Review/decisions/evidence remain protected | Incompatible shapes link to Advanced options; ambiguous/specialized modules are not general AI-editable |
| F1 | New main research entry always prepares reviewable BW-46.2 drafts; real browser edits before adoption, rejects/postpones and reloads | Legacy Analyze website remains in an explicitly labeled compatibility disclosure with its original auto-empty-fill/comparison behavior |
| F4 `personas[]` | Guided remove-row control edits only the selected row; actual browser saves it through reviewed array replacement | Reviewed replacement intentionally changes the array; unrelated data and campaign snapshots stay unchanged |
| F5 seven `founderStory` facts | Canonical structured fields and existing website import/review dialog now accessible from Profile; real browser imports facts, edits narrative, explicitly accepts and corrects structured data | Same moduleData/lifecycle; import is not narrative approval; duplicates use Advanced options; legacy plain-content metadata behavior retained |
| Founder narrative | Existing generation endpoint, editable draft and explicit lifecycle acceptance; subsequent structured correction returns lifecycle to draft | Plain text alone remains insufficient for accepted structured dependency |
| F6 generated DNA fields | Controls bind to the generated draft before explicit acceptance; actual browser edits Hero → Creator and verifies saved Creator | Existing protected `accept_dna`, optional Founder preflight and Avatar preservation remain authoritative |
| Field question flow | Localized optional answer UI calls existing questions/suggest contracts; browser asserts no inference for questions, explicit answer-based generation and durable rejection | Session-local answers; no generic chat or automatic re-questioning |
| New onboarding research | Domain/description combined, aggregate loading, returned partial-source counts, no write until decision, saved evidence, later manual edit/reload, theme/reflow/focus verified in actual EN/DE browser | The original research-domain contract suite covers domain-only/description-only/failure/SSRF/robots cases; mock semantic correctness is not claimed |
| Legacy `/brand_core/website` fallback | Confirmed fresh-session clearing defect reproduced and fixed: an explicit visible Website clear also clears the existing string fallback; production controller/HTTP and actual browser full-refresh clear and subsequent correction pass | No automatic alias rewrite on unchanged saves; unrelated nested data and snapshots remain protected |
| F2/F3 and advanced aliases | F2 stays fixed by BW-46.2; F3 sourceNotes and advanced-only consumer gaps remain as recorded | No broad data-model or downstream-context rewrite |

`check-bw46-1-brand-fields-browser.js` remains the complete original binding/advanced ledger. Its legacy clicks now explicitly open the retained legacy disclosure; security/storage assertions are unchanged. Its controller-level DNA acceptance assertion retains the original precedence check (it does not simulate typing into a DOM control); the new actual-DOM regression independently verifies the corrected binding. No original untested alias/metadata leaf is relabeled as tested merely because JSONB stores it.


PR #863 review regressions also verify empty-persona assistance without a saved blank row, working manual-row focus, preview-only Founder opening/cancel/close/retrieval failure, failed-save cleanup and explicit retry. All seven structured Founder inputs pass manual edit, clear, fresh authoritative reload and subsequent edit/save cycles. Founder narrative drafts reject changed source/narrative baselines or a newer Brand revision; generated prose never silently replaces an intervening edit. These are actual controller/HTTP/browser results, not inferred JSONB support.
