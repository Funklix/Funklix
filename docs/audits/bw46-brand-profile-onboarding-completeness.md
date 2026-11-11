# BW-46.0 — Brand Profile, AI Enrichment & Onboarding completeness audit

## 1. Executive summary

Audit date: 2026-11-11. Repository: Funklix/Funklix. Audited main: **`3fc6e679e38b021d6d3a51f99b33c19fd7eee4fb`**, merge of PR #858. This is an audit and architecture decision only. No production code, UI, schema, migrations, provider configuration or deployment changes are included. No paid inference or external customer website requests were made. All runtime evidence uses local fixtures and mocked transports/providers.

**Decision: extend the existing protected Brand architecture incrementally.** Canonical `brands.brand_core` JSONB, revisioned writes, independent Brand permissions, knowledge modules, accepted DNA and governed Learnings are useful foundations. They do not yet constitute comprehensive website research or a source-grounded description-first onboarding experience.

The current domain endpoint retrieves **one submitted HTTPS HTML URL**, following safe redirects. It does not discover/fetch About, Founder, product or other linked pages, sitemaps, or external resources for brand text analysis. Logo candidate discovery is a separate image operation and must not be counted as additional page research. A user may submit a specific About URL, but that still analyzes only that page.

The largest losses occur before inference (first-in-document extraction/context caps), at output mapping (a narrow strategy-oriented schema), and at adoption (source metadata/excerpts are not retained alongside saved claims). Generated suggestions may automatically fill empty canonical fields; that is a successful protected mutation, not evidence that the values are independently verified. Existing nonempty values receive comparison/review rather than unconditional replacement in the guided flow. The legacy campaign snapshot importer has different replacement semantics.

There is **no dedicated natural-language description → complete Brand Profile onboarding endpoint or starter** in the inspected creation/profile routes. Users can enter `brandCore` and other fields, use them for archetype discovery, or discuss a brand with AI Brain. DNA discovery returns archetype analysis, not a full profile extraction. Founder Story generation and strategy-module generation are narrower, existing draft workflows. AI Brain's controlled Value Proposition handoff is not general automatic profile enrichment.

Recommended order: BW-46.1 retrieval coverage, truthful diagnostics and source-grounded response contract; BW-46.2 provenance, conservative consolidation and compatible description input; BW-46.3 separately approved visual/interactive mockup and onboarding redesign. Define the evidence response contract before expanding retrieval; persist it only through reviewed protected contracts. Do not introduce a new crawler architecture or rewrite the application.

### Verified code reference index

Links point to repository files; function names identify the audited implementation, including where line numbers change later.

| Ref | Actual implementation inspected |
|---|---|
| R1 | [`api/analyze-brand-domain.js`](../../api/analyze-brand-domain.js): `normalizeDomainUrl`, `analyzeBrandDomain`, `validSuggestions`, handler |
| R2 | [`api/_website-url-policy.js`](../../api/_website-url-policy.js): `validateWebsiteUrl`, `isPublicAddress`, `resolvePublicAddresses` |
| R3 | [`api/_website-retrieval.js`](../../api/_website-retrieval.js): `requestOnce`, `readBounded`, `retrieveWebsiteText` |
| R4 | [`api/_html-text-extractor.js`](../../api/_html-text-extractor.js): constants, `stableBound`, `extractBrandProjection` |
| R5 | [`brand-profile-setup.js`](../../brand-profile-setup.js): `FIELDS`, `SECTIONS`, `readiness`, `filteredSuggestions`, `createSession`, `analyze`, `persistSuggestions`, `save`, `reload`, `requestDna`, `mount` |
| R6 | [`app.js`](../../app.js): `openRegularBrandProfile`, `renderGuidedBrandProfile`, `createSidebarBrand`, `submitCanonicalBrandCreation`, `analyzeBrandDomainFromEditor`, `startFounderStoryWebsiteImport`, `renderFounderStoryWebsiteImportReview`, `generateFounderStoryNarrative`, `discoverBrandDna`, `saveBrandBrainState`, `saveBoardToServer`, `openCreatedBrandSetup` |
| R7 | [`project-dialog.js`](../../project-dialog.js), [`project-command.js`](../../project-command.js), [`api/projects.js`](../../api/projects.js), [`api/_project-command.js`](../../api/_project-command.js): project creation and `core()` defaults |
| R8 | [`api/brands/index.js`](../../api/brands/index.js), [`api/_brand-creation.js`](../../api/_brand-creation.js), [`api/brands/[id].js`](../../api/brands/%5Bid%5D.js), [`api/_brands-storage.js`](../../api/_brands-storage.js), [`api/_brand-access.js`](../../api/_brand-access.js) |
| R9 | [`brand-write-contract.js`](../../brand-write-contract.js), [`api/_brand-knowledge-write.js`](../../api/_brand-knowledge-write.js), [`migrations/20261020_bw36_23_brand_knowledge_protection.sql`](../../migrations/20261020_bw36_23_brand_knowledge_protection.sql): `normalize`, `diff`, `apply`, `submit`, `write_brand`, history capture |
| R10 | [`api/extract-website-text.js`](../../api/extract-website-text.js), [`api/map-founder-story-website.js`](../../api/map-founder-story-website.js): `validateMapping`, mapping schema, extraction handler |
| R11 | [`api/generate-founder-story.js`](../../api/generate-founder-story.js): input normalization, `validateMinimumInput`, narrative generation |
| R12 | [`api/discover-brand-dna.js`](../../api/discover-brand-dna.js), [`api/_brand-generation-access.js`](../../api/_brand-generation-access.js), [`brand-dna-generation-preflight.js`](../../brand-dna-generation-preflight.js), [`knowledge-module-dependency-engine.js`](../../knowledge-module-dependency-engine.js) |
| R13 | [`knowledge-module-registry.js`](../../knowledge-module-registry.js), [`api/_strategy-module-generation.js`](../../api/_strategy-module-generation.js), [`api/_brand-brain-context.js`](../../api/_brand-brain-context.js) |
| R14 | [`api/ai-brain/advice.js`](../../api/ai-brain/advice.js), [`api/_ai-brain-learning-context.js`](../../api/_ai-brain-learning-context.js), [`api/_ai-brain-evidence.js`](../../api/_ai-brain-evidence.js), [`api/_campaign-generation-context.js`](../../api/_campaign-generation-context.js) |
| R15 | [`api/_brand-learnings.js`](../../api/_brand-learnings.js), [`brand-learnings.js`](../../brand-learnings.js), [`canonical-brand-reader.js`](../../canonical-brand-reader.js), [`home-foundation.js`](../../home-foundation.js) |
| R16 | [`brand-profile-setup.css`](../../brand-profile-setup.css), [`index.html`](../../index.html), [`language.js`](../../language.js), [`api/_brand-logo.js`](../../api/_brand-logo.js), [`api/_write-maintenance.js`](../../api/_write-maintenance.js) |

## 2. Current onboarding flow map

No evidence of a single universal first-run wizard was found. First brand/project creation opens the reusable profile; Home/sidebar/profile and campaign snapshot entry points coexist. The following inventory distinguishes canonical Brand and campaign Board data.

| Entry/stage | UI and client responsibility | Server/input/permissions | Loading, failure, persistence and retry | Evidence/dependencies |
|---|---|---|---|---|
| New project with new Brand | `project-dialog.js` `mount`: Project name → existing/new Brand choice → Brand name and optional website; R6 project setup handoff | `POST /api/projects`; R7 validates typed command, active identity/workspace membership, new Brand requires workspace owner/admin; existing Brand independently requires Board-creation capability | Pending disables edits; same command/request ID recovers unknown outcome. Transaction creates Brand, Board, initial snapshot and command receipt. Website is a client setup handoff, **not in the project creation command** | No research yet. Newly created Board starts with initial canonical snapshot; later profile edits do not silently replace it |
| Sidebar new Brand | R6 `createSidebarBrand` from workspace sidebar; name input | `POST /api/brands`, `brand_creation_v1`, UUID id/workspace/name; R8 `createWorkspaceBrand`, active identity + accepted workspace owner/admin | Creation pending/errors; fingerprint and ID lock protect retry; opens Brand setup; DB initializes `core()` | Requires authorized workspace. No description or evidence input in creation contract |
| Legacy Brand switcher creation | `#brand-switcher-create-form`, R6 `submitCanonicalBrandCreation` | Same collection route now requires typed workspace creation contract | Client submits `{name,brand_core:{}}`, so current typed server contract rejects it with422; its New project guidance is only mapped to409. This is a confirmed legacy contract mismatch, not a second working creation contract | Compatibility surface must be retained and tested; do not assume all historical triggers have equal capability |
| Return to canonical Brand Profile | Main Brand button, sidebar Open Brand Profile, Home foundation action, `/brands/:id/setup` handoff; R6 `openRegularBrandProfile`, R5 `resolveEntry` | Authorized catalog selection and `GET /api/brands/:id`; R8 independent Brand read ACL | Loading/retry/empty/choice/unavailable states; R15 reader deduplicates reads and retires stale results; forced reload for conflicts | Board association determines Brand within Board context; no fallback to another tenant/Brand |
| Enter/edit identity and website | R5 Overview, Brand Assets, Foundation: name, website, description, Value Proposition, mission/vision/values/story module text | Local draft until save, except successful analysis can persist empty-field suggestions separately; R5 HTTPS client validation | Draft persists across section changes; leave dialog; invalid names/URLs blocked. `save` performs protected canonical mutation and authoritative readback | Website optional; name required. Name may already have been entered in creation; it remains editable |
| Analyze website | R5 `analyze`, Overview button | `POST /api/analyze-brand-domain` with domainUrl + brandId; R1 session, valid Brand ID, canEditCanonicalBrand | Single “Analyzing website…” pending operation; errors allow retry/manual input. Empty fields use `domain_fill`; conflicts go to Review. Logo preview separately reviewed | Does not send or save page evidence with accepted fields. Response `source` not consumed by R5 |
| Edit/approve website proposals | Review section Current value vs Website suggestion; Keep current / Use website suggestion | R5 `persistSuggestions`; R9 `domain_accept` or fill-only command; revision and exact expected field values | Verified GET after mutation, 409 rebase of untouched draft, retry automatic fill, sync-required if save cannot be reconciled | Review applies actual field changes; not a factual verification mechanism. Nonempty asset conflicts retained for review |
| Generate Brand DNA | DNA section; requestDna preflight, optional Founder Story prompt, Continue anyway; R12 legacy modal also supports refine/reassessment | `/api/discover-brand-dna`; canonical brandId/revision resolves persisted core server-side; Board path requires edit access and uses submitted legacy context | Must save dirty profile first. Generation returns draft; Save Brand DNA accepts through `accept_dna`; errors retain existing DNA; accepted avatar/unknown fields preserved | Founder Story recommended, not mandatory. Requires meaningful Brand data, not exhaustive strategy |
| Founder Story source facts/import | Campaign snapshot Knowledge Module specialized editor (`founder_story`); seven fields; Import Founder Story facts dialog | R10 session-auth extraction and mapping; client binds Board/tile; values saved by Board mutation, not research routes | Retrieving → Mapping → per-field review; exact evidence validation; cancel/abort/context guards; selected values apply; save failure restores prior facts | One manually selected page. No automatic About/Founder discovery. Existing values not preselected for replacement |
| Generate/accept Founder Story | Specialized source editor and Generate Founder Story; review generated narrative then Apply/accept | R11 requires moduleType, identity/brand name + two detail fields. Optional boardId checked for view permission; result route itself writes nothing | In-flight/context guards; no generation on insufficient input; narrative draft does not replace accepted story automatically; persisted lifecycle `acceptedAt` | Profile's plain Founder Story textarea is not equivalent to this structured accepted-story workflow; recommended dependency can still be unresolved |
| Manual/advanced Brand editing | R6 Advanced options, canonical editor; campaign snapshot advanced fields/module editors separately | R9 `advanced_edit`; Board mutations use Board ACL | Explicit save/cancel/reload, revision conflict handling; unknown fields retained by partial diff | Moving between surfaces can change which authority is edited; do not merge canonical and snapshot state implicitly |
| AI Brain suggestions | Existing Board-scoped conversation; controlled Value Proposition review/handoff opens Profile | R14 Advice read authorization; R5 `stageValueProposition` requires clean destination, current Brand/revision and revalidation | Stages a single reviewed value locally; Save required; stale proposal rejected; conversation return control | No general description-to-profile importer. Brain is Board-scoped and cannot be treated as first-run Brand creation |
| Learnings / later enrichment | Profile Learnings, repeat Analyze website, manual edits, DNA reassessment | R15 separate proposed/approved/rejected/archived lifecycle and Brand authorization; canonical edits remain R9 | Learnings review counts separate from profile readiness; repeat research can fill gaps and propose replacements | Approved Learnings supplement identity; no automatic research → approved Learning conversion |
| Continue/activate/campaign sync | Confirm and save Brand Profile; Save Brand Profile and continue; Campaign Sync / snapshot comparison | R7/R9 and existing explicit campaign update boundary | No universal `active` profile state set by final save. Canonical save does not automatically update existing Board snapshots | DNA/avatar have own approvals; Learnings own approval. “Profile confirmed” is not blanket approval of every claim |

R5 session `current()` binds account, generation, Brand and Workspace and ignores stale responses. Pending proposals, files and drafts can be retained in the account's in-memory profile cache (R6 `retainPendingBrandProfile`); this is not durable resumability across browser refresh. Saved canonical data and request receipts survive; in-flight research does not.

## 3. Current Domain Research architecture

```text
Overview website / legacy Assets URL
 → add https:// if absent (client and/or R1)
 → R2 HTTPS/host/credentials/port policy; remove fragment
 → R3 resolve every destination; reject unsafe DNS answers; pin selected address
 → GET supplied URL; revalidate each redirect; no cookies/auth forwarded
 → bounded compressed/decompressed HTML download
 → R4 extract readable text; reject empty content/parse overflow
 → R1 re-extract internal HTML as semantic projection
 → bound URL + title + metadata + sections to 16,000 characters
 → one gpt-4.1-mini Chat Completions request
 → parse JSON; shallow required-shape check
 → suggestions + source {url, sections, truncated} + logoDiscovery
 → R5 filter known fields; automatic fill of empty fields or review conflicts
 → R9 protected canonical write + verified GET
```

Legacy `analyzeBrandDomainFromEditor` instead confirms replacement, spreads suggestions into `state.brandCore`, preserves customTiles, then calls `saveBrandBrainState` and `saveBoardToServer("brand-domain-analysis")`. That writes the campaign snapshot, not the reusable Brand. It uses the endpoint without brandId, which requires session but does not read a Brand. Do not confuse that compatibility behavior with the stricter canonical editor.

`absolute` in R1 is defined but unused; it is not a link crawler. R4 recognizes selected metadata and image/icon/canonical assets, but not ordinary anchor URL destinations. R16 logo discovery ranks and safely retrieves image candidates; its candidate count is not text research coverage.

### Actual capability classification

“PARTIAL” below means page text can participate **if present on the supplied page or if the user explicitly supplies that URL**. It does not mean linked pages were retrieved. IMPLEMENTED denotes the narrow behavior stated, not full-site completeness.

| Capability | Classification | Discovery / fetch / extraction / processing / persistence reality |
|---|---|---|
| Supplied homepage URL | IMPLEMENTED | One safe HTML fetch, usable extraction and one AI projection; only mapped suggestions persist if adoption succeeds |
| About/company; founder/team | PARTIAL | No automatic discovery/fetch. Visible text from supplied URL may influence strategy; founder fields require separate R10 importer |
| Mission/vision/values | PARTIAL | Visible text can influence `brandCore`/messaging; no dedicated domain output for those modules |
| Products; services | PARTIAL | Visible copy influences strategy/personas; no portfolio contract or automatic product-page traversal |
| Pricing | PARTIAL | Text can enter context; no pricing field in domain output, verification or dedicated pricing research |
| Customers/industry; case studies; testimonials | PARTIAL | Same one-page condition; no structured trust/proof extraction and citation persistence |
| FAQ; contact/company details | PARTIAL | Text extraction possible; no question/contact/company-information field mapping |
| Press/news; blog/editorial | PARTIAL | Only a submitted page's visible text; no recency selection, index traversal or editorial relevance model |
| Selected title/description/OG/Twitter metadata | IMPLEMENTED | Selected keys in R4 feed the prompt; not saved as reusable evidence records |
| Navigation text | PARTIAL | `nav` text retained; href destinations not traversed; noisy early navigation can consume budget |
| Navigation link discovery | NOT IMPLEMENTED | No anchor URL inventory/queue in R1/R4 |
| Sitemap discovery / XML parsing | NOT IMPLEMENTED | No robots/sitemap request; R3 accepts HTML only, so direct sitemap XML is unsupported |
| schema.org / JSON-LD | PARTIAL | R16 logo ranker parses Organization logo JSON-LD. R4 excludes scripts, including application/ld+json, from brand text; no structured company/product/FAQ fact mapping |
| Externally linked public brand text resources | NOT IMPLEMENTED | No discovery/fetch/relevance/consent flow. Logo image retrieval is a different capability |
| Client-rendered-only copy | BLOCKED BY EXISTING ARCHITECTURE | Raw HTTP HTML only; no JavaScript renderer. Empty hydration shell may return empty_content |
| Private/paywalled/denied/unreachable sources | BLOCKED BY SOURCE | No credentials, bypass, authentication or access-restriction circumvention; report unavailability |
| Whole-site coverage / durable background resume | BLOCKED BY EXISTING ARCHITECTURE | Request-response single-page operation; no research job/checkpoint system |

## 4. Current AI-description architecture

The proposed unified starting prompt does not exist in R5/R7/R8. A short description can be saved manually in `brandCore`; DNA `hasMeaningfulBrandData` accepts broadly meaningful data (including nested values). It is not a completeness validator or description parser. Canonical DNA generation reloads saved `brand_core` through R12, so unsaved descriptions are intentionally not used. The prompt prioritizes Founder Story, mission/vision, Value Proposition, messaging, ICP and visual assets, and asks for conservative confidence/missing signals. Returned fields are primary/secondary archetypes and confidence, alternatives, reasoning, signals, recommendedVoice and recommendedVisualDirection. It does not populate mission, business facts, audience or product modules from prose.

R11 Founder Story is narrower: `founderNameRole` or brandName plus at least two of six detail fields. Short incomplete input can fail with insufficient_input. Narrative is supposed to use only source facts; missing facts must not be invented. It asks for about 250–450 words and returns one narrative; no automatic follow-up questionnaire or external research. Existing narrative is optional refinement context, not permission to overwrite.

R13 strategy modules accept explicit structured facts and narrative, generate draft structured fields, preserve unsupported facts as empty and distinguish assumptions/open questions. They require an existing saved Board/module ID, so they cannot simply serve as a new-brand entry endpoint. Their original structured inputs are kept by the module workflow, but no general original onboarding utterance/source object is created.

AI Brain can answer from description in its question and authorized context, but Advice is read-only. Its single-field Value Proposition handoff requires explicit review, current canonical baseline, staging and saving. It is unsuitable as implicit general profile persistence.

**Compatibility conclusion:** domain output and manual description share some `brand_core` keys only after explicit manual entry/adoption. They do not share a field-level evidence model. DNA/Founder Story/strategy module contracts have distinct acceptance lifecycles. Repeated guided domain research protects nonempty values; repeated legacy website import can replace suggested top-level snapshot fields after confirmation. DNA accepts a new draft on deliberate save, merges existing DNA and preserves avatar/unknown fields. Never infer “confirmed fact” from `userApproved` strategy alone.

## 5. Brand Profile field inventory

Actual default schema is R7 `core()`, duplicated by R6 `blankBrandCore`. `brands` stores `name`, JSONB `brand_core`, `revision`, timestamps, workspace/owner association and separate logo fields (R8). JSONB permits additional existing keys; a concept appearing in a prompt is not proof of a native top-level schema field.

Legend: **U** user input; **W** public webpage text; **I** AI interpretation. **C** protected canonical R9 write; **B** campaign snapshot write. For ordinary native fields, missing/empty can be detected but inferred versus verified cannot be reliably distinguished. All canonical native values can be edited or preserved through the advanced editor; guided structured editing is narrower. There is no ordinary per-field source link.

| Actual keys / location | Concepts and origin | Save / correction / traceability | Verified consumers |
|---|---|---|---|
| `brands.name` | Identity; U at creation/edit | C, max 160; manual edit; history records mutation, not external evidence | Catalog, sidebar, Profile, Board creation, AI Brain canonical name |
| `brand_core.brandCore` | Description/positioning summary; U/W→I | C or B; editable; no inference flag or original source excerpt | R13 context `positioning`; DNA; AI Brain raw context; campaign generators |
| `valueProposition` | UVP; U/W→I/Brain proposal | C/B; guided edit + protected single-field Brain handoff; proposal not verified fact | DNA, context `usp`, campaigns, readiness/diagnostics |
| `toneOfVoice[]`, `messagingPillars[]` | Voice and key messages; U/W→I | C/B; guided list editing; no source distinction | DNA, context builder, campaigns, Brain |
| `contentGuidelines[]`, `dosAndDonts.{dos,donts}`, `brandVoiceExamples.{good,avoid}`, `keywords[]` | Communication rules/examples/tags; U/W→I | C/B; structured fields/manual corrections; domain filter rejects incompatible shapes | Context CTA guidance, campaigns, Brain, Profile |
| `personas[]` with `name,note` from domain | Audience; U/W→I | C/B; guided personas; no confirmed vs inferred marker. Existing richer persona keys can survive, but domain proposal emits name/note | Profile readiness reads note/description; context formatter does **not** include note (see §7); Brain raw context |
| `brandAssets.{domain,colors[],typography,references[]}` | Website/visual cues; U and W→I | C/B; guided domain from user's website, not AI domain; colors/typography/references proposals; manual correction; references are not evidence of fetch | Profile, logo acquisition, DNA, context visual style, campaigns |
| `brandAssets.logo`, legacy `logoAsset` | Legacy snapshot presentation metadata | C JSON may contain old value; canonical analyzer deliberately blanks returned logo and guided filter excludes it | Legacy context visualStyle reads logo; canonical UI uses separate logo authority |
| Separate `logo_object_path,logo_mime_type,logo_source,logo_revision,logo_updated_at,logo_source_host` | Canonical company logo; upload/discovery | Separate protected image storage/write; private authorized logo URL; upload has priority; replace/remove reviewed; host metadata is not text claim provenance | Shared logo renderer, sidebar, Home, profile, catalog |
| `customTiles[]` with `moduleType: mission/vision/values` and `content` | Purpose/future/principles; U; possible manual paste | C/B; guided Foundation text editing; no automatic domain mapping; history retains values | DNA raw core and R13 bounded customContext; Brain raw authorized context |
| `customTiles[].moduleType: founder_story`; `moduleData.founderStory.{founderNameRole,observedProblem,motivation,turningPoint,background,proofPoints,vision}`; tile `content` | Founder facts U or reviewed W; narrative I/U | C/B depending editor; specialized import/generation currently campaign editor. `founderStoryImport.{status,confirmedAt}`; `founderStoryLifecycle.{status,acceptedAt}`. Excerpts/source URL discarded on Apply; facts/narrative manually correctable | DNA preflight/accepted structured context; raw Brain; bounded customContext uses narrative |
| `brandDNA.{primaryArchetype,primaryConfidence,secondaryArchetype,secondaryConfidence,alternatives,reasoning,signals,recommendedVoice,recommendedVisualDirection,userApproved}` | Strategy/archetypes I, manual correction U | C/B with explicit accept intent; signals keys `toneSignals,missionSignals,audienceSignals,messagingSignals,visualSignals`; approval is strategic acceptance, no external verification | Profile, avatar generation, context archetype guidance, Brain personality, campaign generation |
| Existing `brandDNA.personality`, `.positioning`; top-level `personality,positioning,audiences,offers,proof` | Optional/legacy values displayed when present | JSONB preservation; some DNA strings editable guided; not emitted by DNA discovery/default domain contract; not guaranteed native schema | R5 profile displays; raw Brain; normalized context does not uniformly consume these aliases |
| `brandDNA.avatar.{imageUrl,prompt,userApproved,...}` | Generated advisor image I, optional U direction | Draft/explicit acceptance; requires approved DNA; preserve unknown child keys; separate from company logo | Profile, Home/sidebar approved avatar/personality, Brain visual presentation |
| `customTiles[].moduleType: audience/icp/product_knowledge/competitor_research/custom` | ICP, pains/outcomes, portfolio/competition; U/manual paste; no dedicated domain extraction | Tile content and optional moduleData; C/B; advanced module editors; guided audience/offers often read-only display; registry futureCapabilities are not implemented evidence storage | Context customContext with caps; Brain raw core; DNA raw data |
| `market_research` → `moduleData.marketResearch.accepted.structuredFacts` | `marketCategory,geographicFocus,marketScope,researchObjective,researchDate,customerSegments,primaryNeeds,buyingTriggers,adoptionBarriers,competitors,alternatives,differentiationOpportunities,trends,opportunities,risks,positioningImplications,messagingImplications,channelImplications,recommendedNextSteps,userProvidedFacts,assumptionsToValidate,sourceNotes` | Separate draft/accepted/lifecycle and revision metadata; U/I; no live research claim authorized; accepted assumptions still assumptions | R13 acceptedStrategyModules, Brain raw accepted/draft context; campaign context |
| `business_plan` → `moduleData.businessPlan.accepted.structuredFacts` | `businessSummary,problem,solution,currentStage,objectives,targetCustomers,marketNeed,competitivePosition,marketResearchReference,offer,revenueModel,pricing,salesChannels,distributionModel,acquisitionStrategy,retentionStrategy,partnerships,keyMilestones,coreActivities,resources,team,operationalRisks,revenueAssumptions,costAssumptions,fundingNeeds,budgetNotes,confirmedFacts,assumptionsToValidate,openQuestions` | Separate accepted revision/lifecycle; manual review/correction. Financial assumptions are not confirmed research | R13 acceptedStrategyModules; Brain; campaigns |
| `pitch_deck`, `whitepaper` tiles | Potential proof/trust/private document context U | Existing module data; not website citations. R13 explicitly excludes private document source modules from generic customContext | Profile proof display; raw Brain requires existing authorized context handling; do not repurpose as public research dump |
| Governed `brand_learnings` | statement/evidence_summary/source_type, revisions, statuses and optional Board/node source snapshots | Separate DB/lifecycle/event system R15; proposed vs approved distinguishable; reviewer role enforced; no automatic website approval | Brain independently authorized approved learnings; Profile Learnings; campaign observations |

Market Research generation also emits `sourceNotes`; the accepted strategy context allowlist in R13 does not project it. Saved module data and downstream supplied context must be distinguished.

Downstream integration is uneven: Campaign Canvas stores an explicit `brand_core_snapshot`; R14 campaign generation builds bounded snapshot plus separately authorized canonical identity context. AI Brain Advice receives raw scoped cores and approved Learning selection; canonical edits do not update a campaign automatically. Current Insights `calculateInsightsDiagnostic` calls `analyzeCampaign(nodes,edges,brandCore)`, but that function’s body derives its diagnostics from Canvas nodes and does not read the Brand argument. `suggestNextNodes` separately uses the first persona name and tone. Therefore current Insights is not a full Brand Profile completeness validator. Home uses authorized canonical readiness/approved avatar and separate campaign diagnostics.

There are no default dedicated top-level fields for a verified company address, founding date, complete product catalog, pricing catalog, geography, industry, testimonial/case-study citations, customer outcome evidence or website research completeness. Some concepts fit current knowledge modules; adding new native contracts must be deliberate. Registry `website_analysis` describes a module identity, not a functioning multi-page research system.

## 6. Source-to-field coverage matrix

| Source | Discovered/fetched? | Semantic use | Persisted result | Main missing connection |
|---|---|---|---|---|
| Submitted homepage/About/service/etc HTML | One URL fetched through R3 | R1 prompt from bounded sections/metadata | Known R5 fields, if valid and saved; legacy snapshot spread differs | No field→quote/page attribution; no named-page coverage |
| Another page linked from HTML | URL not collected for text | None | None | Entire evidence area missed even when navigation names it |
| Title/description/OG/Twitter text | Extracted selected metadata | Early prompt priority | May influence strategy; not metadata record | No trace or confidence separation |
| JSON-LD | Excluded from text; logo ranker parses Organization logo | Logo candidate only; no company/product/FAQ fact processing | Logo metadata if separately adopted | Structured brand facts unavailable through domain text contract |
| Icons/logo/images | Candidate discovery; image fetch separately validated | Logo preview/image adoption; not image-text analysis | Separate canonical logo metadata on explicit adoption | Image success not proof of website text coverage |
| Founder import page | User explicitly chooses URL; R10 retrieves it | Strict seven-field evidence mapping | Selected values + confirmation flag in Founder module | URL/title/quotes not retained on Apply |
| Manual brief in brandCore | No fetch needed | DNA/Brain/context if saved and authorized | Original field string C/B | No original standalone description source or extracted-fact lineage |
| Accepted Founder facts/narrative | Saved module context | DNA high-priority accepted structured evidence; narrative supplemental | Existing module + accepted DNA separately | Accepted narrative may still be interpretation; no website source retained |
| Strategy module explicit facts/narrative | User input, not live web research | Scoped draft generation | Module draft then accepted revision | Must preserve assumption/open-question distinction |
| Approved Learnings | Scoped DB read, not website research | Brain selected with coverage accounting | Existing Learning records remain unchanged by advice | Approval not independent external verification; Board-only users cannot enumerate Brand Learnings |
| AI-generated references/personas/colors | Text in AI JSON, not retrieved evidence | Suggested strategy/visual cues | Can be adopted as ordinary values | Links/claims must not be represented as verified sources |

## 7. Information-loss inventory

Every row identifies implementation, classification, consequence, disclosure, adaptive alternative and risk. “No” means no useful user-visible accounting at the relevant adoption boundary, not that no error code exists.

| Implementation and exact bound | Classification | Information lost / current disclosure | Safe adaptive alternative / risk |
|---|---|---|---|
| R1 one `retrieve(...)`; no queue, crawl depth or page count parameter | Existing architecture limitation, not an intentional “one page quota” | All unsubmitted pages; no coverage UI | Add permitted same-site discovery + deterministic relevance, staged per-source outcomes; medium/high |
| R4 `MAX_TITLE_LENGTH=300` | Local presentation/input bound, not provider rule | Longer title; no title-specific notice; title entities are not decoded like body units | Decode and retain original evidence separately; low |
| R4 `MAX_PARSED_NODES=100000` | CPU/resource safeguard | Entire too-complex page rejected `parse_limit`; error visible generically | Keep safeguard; source-specific unavailable outcome; medium |
| R4 flush stores only `maxSections*4` units = 240 default | Local extraction policy | Later blocks never enter units; omission itself not counted, may evade truncated flag | Streaming selection/accounting with overflow outcome; medium |
| R4 EXCLUDED/hidden/noisy filters | Security/noise policy | Scripts/JSON-LD, CSS-hidden text, alt-only content, cookie/modal-class false positives excluded; no detailed notice | Separate safe structured-data extraction; measure excluded material without executing it; medium |
| R4 `MAX_TEXT_LENGTH=50000`; `stableBound` breaks at **first** unit that does not fit | Local context/resource policy, not provider cap | A huge early unit prevents later short relevant sections; page can become empty despite useful later content; boolean only | Complete-unit segmentation, selective continuation, omission ledger; medium |
| R4 `MAX_SECTIONS=60`, `MAX_METADATA=20`, `MAX_ASSETS=24` | Local projection/asset policies | Later sections/metadata/assets dropped; aggregate flag incomplete | Rank evidence by topic, deduplicate, batch per source, explain exclusion; medium |
| R4 exact-string dedup in `stableBound`; truncated computed against nonempty unit count | Dedup heuristic | Duplicate removal can set truncated even without meaningful evidence loss; no URL canonicalization or semantic duplicate detection | Separate duplicate counts from budget omissions; preserve source aliases; low/medium |
| R4 `MAX_PROVIDER_CONTEXT=16000`; R1 second `stableBound([URL,Title,...metadata,...sections],16000)` | Local prompt policy, **not verified provider restriction** | Early metadata/sections win; late proof, founders and contradictory copy absent. R1 returns projection.truncated, not second bound's flag | Token-aware staged extraction/consolidation with per-batch coverage; medium/high |
| R1 `projection.providerContext.length < 80` | Arbitrary local usable-input threshold | Short genuine company pages rejected; visible empty_content | Assess usable evidence rather than raw character minimum; low/medium |
| R1 prompt “arrays concise (3–8)” | Product/prompt restriction | Additional audience/product/message distinctions summarized away; no warning | Relevant facts first; strategy synthesis separate from evidence inventory; medium |
| R1 output keys; shallow `validSuggestions`; first/last brace parser | Output/mapping contract, not provider necessity | Mission, vision, products/proof/founder facts never receive dedicated output. Extra keys may pass server check but disappear in R5. Malformed output fails whole analysis | Strict typed source-grounded schema, unsupported areas explicit, preserve valid source results if consolidation fails; medium |
| R5 `filteredSuggestions`: texts ≤50000; lists ≤100; list items ≤5000; personas ≤100 with name≤500/note≤5000; examples≤50000 | Payload/type protection mixed with presentation bounds | Oversized/invalid fields silently rejected; persona values sliced; no per-field rejection message | Keep size validation; typed rejection and staged review, no silent drop; medium |
| R5 assets accepts only colors/references/typography; domain from U; logo separate | Intentional authority boundary | AI domain/logo not adopted (correct); other extracted assets lack persistence | Keep boundary; evidence for visual suggestions distinct from canonical logo authority; low |
| R1 `{source:{url,sections,truncated}}` not retained by R5; R6 legacy import also ignores source | Integration gap | Cannot reconstruct source-to-field coverage after save; no user notice | Carry evidence response through proposal review and protected persistence; medium |
| R6 Founder Apply saves value only; R10 quotes up to 300 and values up to1600, source text≤50000/title≤300 | Schema/grounding bounds + provenance gap | Invalid exact quote clears field; missing fields remain empty; approved facts lose page/quote. Missing suggestions are visible; reason per field not supplied | Retain validated source/quote with acceptance revision; keep exact-evidence checks; medium |
| R11 source fields1600, brand-context fields1200, existing narrative4000, output narrative6000; R12 Founder context facts2000/narrative6000 | Local prompt/normalization bounds | Details clipped without per-field notice; generated biography can lose nuance | Explicit clipping diagnostics; evidence chunks; medium |
| R12 DNA raw parser `cleanText(...,12000)` and result reasoning1200, voice/visual700, signals5×220, alternatives3×why360; refineGuidance500 | Local output/presentation policies | Longer valid JSON may be cut before parse; rich reasoning/signals clipped; no omission details | Parse before display bounding; preserve structured evidence separately; low/medium |
| R13 normalized context: brandCore900, UVP700; personas6 (formatted≤500), list items typically8×240; customContext8 tiles with content500; accepted strategy narrative1200/facts700 or lists12 | Local downstream compression | Detailed accepted knowledge omitted from campaign prompts; no general omitted-field ledger | Relevant selection with coverage metadata and stable evidence references; medium |
| R13 `formatPersona` reads name/title/segment, role/jobTitle, description/summary, needs/painPoints/motivations — **not `note`** | Confirmed contract mismatch | Domain/manual guided persona detail disappears from normalized campaign/DNA context, though raw core remains available to DNA/Brain | Backward-compatible note fallback plus parity regression; low |
| R13 strategy input body120000 bytes; fields1600, arrays20×600, narrative6000 | Resource + local processing policy | Excess request rejected; facts/narrative clipped without coverage | Typed per-field preparation with notice, reuse accepted revision evidence; medium |
| R9 command ≤1MiB, ≤256 changes, depth32, path≤2048; SQL candidate core≤1MiB | Security/resource and mutation boundaries | Oversized mutation rejected atomically, not silently truncated; UI may show generic failure | Chunk only compatible independent mutations with exact revisions/receipts; never bypass protection; high if changed |
| R14 Brain model context128000 tokens for known default, output4096 + framing1024 reserved; unknown model needs matched config | Model-specific provider/context accounting | Relevant Learnings excluded for actual budget with explicit coverage; overlarge base fails rather than silent success | Reuse this accounting pattern; do not transplant model numbers to website analysis; medium |
| R14 Brain evidence index24 nodes/32000 chars | Bounded navigation aid, not full context replacement | Index omissions do not prove source absence; policy already says so | Preserve distinction and existing raw authorization-bound context; low |
| R15 Learning list returns first50; approved Brain capture pages256 with32MiB/5s safety | UI pagination vs technical processing boundaries | UI list not whole library; Brain processes library until bound, then fails rather than claiming complete | Reuse cursor/coverage patterns; do not impose Learning list count as research quota; medium |

No explicit max_tokens/max_output_tokens, measured input token budget, provider timeout or automatic inference retry is supplied by R1/R10/R11/R12/R13. Finite provider/model/platform limits still exist; their effective deployment values were not measured and must not be invented. DNA sends both normalized context **and raw `brandBrainData`**, so normalized-context omissions do not prove the DNA model never received those raw fields. Campaign context uses the normalized builder; Brain Advice supplies independently authorized raw core with its own budgeting. Distinguish these consumers.

## 8. Existing technical limits and constraints

Preserve these boundaries: R2 URL≤2048, HTTPS only, no credentials, port443 only, fragment stripped; public address checks on all DNS answers; address-pinned connection/TLS hostname; every redirect validated. R3 total operation abort timer10s, redirects≤5, transferred response≤4MiB, decompressed≤6MiB, parse nodes≤100000. Gzip/deflate/br/identity only; HTML/XHTML content types only. Read body is UTF-8, not a charset-aware transcoder. A total timer does not establish prompt provider cancellation or a durable job deadline.

The resource limits bound unsafe or unbounded work. They are separate from first-in-document section selection, 16k prompt projection, concise arrays and output shaping, which are application choices rather than demonstrated provider maxima. No crawler page budget or crawl depth setting exists because there is no crawler. Do not add a permanent product rule of N pages or N results to compensate.

A future multi-page process needs explicit bounded concurrency, memory, download size, elapsed execution, cancellation, per-host politeness, provider-context budgeting and continuation. If eligible relevant work exceeds a technical execution window, return an honest partial/continuable state; never call it full website analysis. Long-running background jobs or persistent checkpoints require a separate architecture decision after checking runtime constraints. Do not feed an entire large site into one model request.

## 9. Evidence/provenance assessment

Three different authorities already exist: canonical mutation history (what changed), module acceptance (what a user accepted) and Learning approval (a governed reusable observation). None is automatically a website fact-verification record.

R9 history retains before/after snapshots, actor, revision, operation, intent and server command provenance. Its `provenance.source='verified-server-command'` means authorized command origin, **not verified public claim**. R10 has the strongest existing website grounding: strict seven-field schema, verbatim excerpt membership check, empty unsupported fields and per-field human review. An excerpt's presence confirms string occurrence; it does not prove that an AI paraphrase is entailed or that the webpage is truthful. Edited suggestions need to be labeled user edits. Apply currently drops the excerpt and source identity.

Smallest compatible future approach: define a versioned JSON evidence envelope associated with stable field paths or module IDs and accepted revision, carrying original/final public URL (sanitized), retrieval timestamp, content hash, short exact excerpt, extraction/processing outcome and classification (`user_provided`, `website_supported`, `ai_interpretation`, `missing`, `conflicting`, `unavailable`). These are **proposed** fields/statuses, not current ones. Preserve original user description with explicit user ownership; separate generated draft claims from it. A supported fact should retain its source; an inferred positioning proposal must stay inferred after acceptance. Missing is not confidence zero; inaccessible is not missing; conflict needs multiple evidence references.

Initially return this envelope with source-grounded drafts without persistence changes. A small compatible JSONB namespace may be viable later, but requires explicit validation, size policy, existing write-preview/history integration, exclusion from generic raw prompt serialization, and consumer tests. R9 currently allows a `source` command only for `initialize` Board snapshots; do not insert website provenance into that reserved field or relax the allowlist. A new server-controlled contract or reviewed core namespace must be designed before durable evidence writes. Do not abuse generic custom tile content or Learning evidence_summary as a raw crawl store.

Users should be able to inspect a claim's source, exact excerpt, retrieval time, adoption status and user edits, and see “strategic suggestion” for generated positioning/archetypes. Founder names/dates/biography, customer claims and market conclusions need explicit support. Reuse governed proposed→review→approved Learnings only for intentional strategic learning actions under their existing roles/source validation, never automatic website ingestion.

## 10. Persistence and authorization review

R8 Brand read/edit is independent of Board access. Brand owner/admin/editor can edit canonical data; viewer reads. Workspace new Brand creation requires accepted owner/admin. R9 SQL rechecks active application identity, Brand role, matching workspace context and membership inside transaction; mutations are locked, revisioned, expected-value checked, audited and idempotent. Destructive shapes require preview/bound review token. Plain scalar replacement does not always require the extra destructive-review token; guided proposal acceptance is still an explicit action. DNA/avatar acceptance has typed intent and dependency checks. Existing data, unknown nested fields and campaign snapshots must be preserved.

R12 canonical generation checks Brand edit capability and exact revision and loads persisted core server-side. Board generation compatibility path checks Board edit access, then returns submitted body; not all client context is authoritative saved data. R11 optional Board check requires canView, not canEdit, and absent boardId permits session-only generation of submitted facts. R10 extraction/mapping are session-only utilities and write no Brand/Board. R1 without brandId is also session-only and writes nothing. These are real existing boundaries, not proof of a cross-tenant DB read: callers cannot cause these routes to fetch another tenant's stored Brand. Future enrichment endpoints that load/save Brand data must use canonical authority, not copy utility-only checks.

R14 independently authorizes Board, optional canonical Brand and approved Learnings; Board-only permission does not expose Brand membership knowledge. Campaign generation captures/revalidates scoped snapshot and canonical context separately. Never make onboarding a route around those boundaries. R15 authorizes Learning mutations through canonical Brand edit capability (owner/admin/editor); viewers read. Propose/edit/approve/reject/archive are separate explicit lifecycle actions with revision, duplicate and source checks, not separate reviewer role tiers. Preserve these exact rules and never equate automatic canonical field fill with a Learning approval action.

SSRF controls are substantive: private/reserved IPv4 and local IPv6/mapped IPv4 checks, mixed DNS answer rejection, DNS pinning, redirect revalidation, TLS identity preservation. Tests verify examples, not every future reserved range or deployment path. No real attack probes were made. DNS returns only its first validated address for connection; a failed first address has no fallback. Additional discovery must preserve checks for **every URL and redirect**, including sitemap/image/off-origin candidates.

Unsafe HTML is not sent to the browser by R10 extraction; it returns text. R5 constructs text nodes/readable views, and Founder review escapes imported fields. Legacy advanced renderers contain innerHTML interpolation of some existing text values; broad XSS assurance is outside the focused fixture checks. Reuse escaped/text rendering for new evidence. R1 domain prompt lacks the strong delimited untrusted-source instructions and exact evidence checks already used by R10; page text can influence the same user message as the task. No secret tools are supplied, but output poisoning and invented strategic facts remain risks. Server output validation needs strengthening before expanding input sources.

Entering a domain does not prove ownership. No domain ownership check exists or is needed to analyze eligible public text; it must not authorize account association, private sources or logo rights. Public availability alone also does not settle crawling permission; future discovery must respect access restrictions and an explicit eligibility/politeness policy. Current code has no robots/sitemap eligibility workflow. No logged-in crawling, bypasses or invasive requests are proposed.

R1/R3/R10 mostly log bounded codes/diagnostics rather than HTML/URLs; R12 DNA logs message and stack and can return provider error messages. This is inconsistent sanitization, not demonstrated credential leakage. URLs may contain sensitive query parameters; returned source URL must be sanitized before durable evidence or public debugging. Do not store raw HTML, prompts, personal contact details or URL tokens without a need/retention decision. R16 maintenance wrappers and DB write guards must continue to fail closed.

## 11. Current UX issues and reusable design

The actual Profile uses 11 sections (Overview, Brand DNA, Audience, Voice & Messaging, Offers & Proof, Brand Assets, Brand Avatar, Brand Learnings, Team and permissions, Campaign Sync, Review), saved-state readiness, logo/avatar cards and explicit save/reload. R16 CSS includes theme tokens, focus-visible, minimum44px controls, responsive grids, reduced-motion and forced-colors rules. BW-42 browser checks exercise EN/DE, both themes, 320–1672px widths, collapsed/expanded sidebar, keyboard destination focus, local save/reload and 200%-equivalent reflow. This is a reusable functional design foundation; it must not be described as missing or broken without evidence.

| Confirmed issue | User effect / proposed direction |
|---|---|
| New project asks for project name before Brand choice/name/optional website | Campaign structure precedes help understanding the business. Offer Brand-first start while preserving existing project creation |
| Legacy switcher creation contract differs from server | Its still-wired handler submits old `{name,brand_core}` and gets422; clarify reachability and route users to the working typed creation flow without removing legacy IDs |
| No first-class description input | User must know where to enter brand strategy or use a Board-scoped advisor. Add optional natural-language brief as evidence, not a required questionnaire |
| Overview foregrounds logo/avatar cards and multiple Foundation fields | Start action competes with brand asset tasks; defer logo/avatar and advanced strategy until useful draft exists |
| Eleven navigation choices; 7-group readiness includes website/accepted DNA/avatar | Setup completion mixes useful identity with optional artifacts. A website-free brand can remain incomplete even after useful manual entry. Do not imply all seven groups required to activate |
| `confirmedValue` checks nonempty values/placeholders, not evidence | “Complete” means stored presence, not verified facts. Separate coverage, verification and readiness |
| Single pending label in guided analyzer | No discovered/fetched/extracted/processed counts or recoverable-source errors; no basis for whole-site confidence |
| Legacy staged copy changes after awaited network response | “Connecting/reading/extracting/building” is UI sequencing, not live server stage telemetry. Replace claims with actual events/outcomes |
| Website empty-field fill persists during Analyze | User may assume all suggestions are still draft until Confirm and save. Explain auto-save or shift to explicit draft adoption after product decision |
| Website edits reset proposals/candidate; source metadata discarded | Returning user cannot inspect which page supplied a claim or recover unsaved research after refresh |
| Founder structured flow is in specialized snapshot editor; guided text is simpler | Plain profile story text may not satisfy accepted structured-story dependency. Avoid asking for the same story twice; expose/reuse accepted facts carefully |
| DNA requires save, then Founder preflight, then generation, then Save DNA | Several decisions before outcome. Explain optional Founder contribution, preserve Continue anyway, keep save/accept semantics explicit |
| Canonical versus Campaign Snapshot versus Advanced options | Similar-looking data can have different persistence targets. Label authority and explicit campaign sync consistently |
| Error detail diverges between guided/legacy import | Guided generic “retry/manual” lacks source reason; legacy offers specific-page guidance. Reuse safe error taxonomy |
| Localization/accessibility uneven in peripheral flows | Guided translator is reused, but Founder import and legacy team/editor strings include hardcoded English. Require EN/DE coverage of new copy; browser keyboard pass is not a full screen-reader audit |

Preserve IDs/events: `brand-workspace-detail`, `-title`, `-context`, `-close`, `-content`, `brand-workspace-edit-form`, `brand-core-workspace`, `brand-editor-panel`, `bc-domain`, `bc-analyze-domain`, `bc-domain-import-status`, `brand-switcher-create-*`, `project-brand-name`, `project-brand-website`, Founder `brand-core-founder-story-*`, `founder-story-import-url`; dynamic `data-profile-key`, `data-bc-key`, module IDs and `brand-section-status-*`. R6 binds legacy listeners and captures element references; R5 replaces section children and restores focus. Moving/removing nodes can break wiring, stale-context guards, dirty handling and tests. Use existing buttons, status/live regions, dialogs, readable views, proposal cards, tokens and controller seams. No DOM/CSS redesign is included here.

## 12. Recommended onboarding flow

1. **Start:** website or description, optional Brand name if unknown; preserve workspace choice/permissions. A short description is useful evidence, not a requirement to know mission/persona/archetype.
2. **Research:** eligible website discovery with safe fetching and relevance selection; original description retained as user evidence. A no-website route skips retrieval and clearly shows supplied versus inferred context.
3. **Progress:** show actual discovered, fetched, usable extracted and semantically processed counts separately, including duplicates, unavailable URLs and remaining work. Cancellation leaves a truthful partial result.
4. **Draft:** consolidate relevant supported facts into existing compatible keys/modules, with field evidence references. Generate strategy proposals separately; do not invent unknowns to fill a visual meter.
5. **Evidence/gaps:** reveal important quotes, conflicting claims and missing areas. Ask targeted follow-ups only when a useful fact could not be researched or conflicts need human judgment.
6. **Review/edit/approve:** compare against saved Brand revision; preserve approved/user-entered values; allow per-field adoption and user correction. Handle automatic fill as an explicit product decision. Retain existing protected write review.
7. **Activate:** save a useful profile and allow work to begin. This is a proposed experience, not a new current DB status or blanket fact approval. Founder Story, DNA, logo/avatar and remaining strategic modules can be added later. DNA keeps its optional Founder dependency and explicit strategy acceptance.
8. **Enrich later:** rerun only selected/new/stale sources, show a versioned comparison, retain rejected/user decisions, resume recoverable omissions and explicitly update campaign snapshots when requested.

Future progress/detail DTO should expose discovered URLs, fetch outcomes, extraction outcomes, processed evidence sources, populated fields, fields awaiting review, missing research areas, unavailable sources, recoverable errors and whether continuation remains. Do not collapse those into “website analyzed.” This is a future requirement, not implementation of a tracker.

## 13. Five prioritized improvements

| Priority / confirmed problem | Journey / verified location / consequence | Recommendation and information-quality gain | Impact, privacy/security, complexity and regression risk | Required tests |
|---|---|---|---|---|
| 1. Single-page analysis cannot cover a linked business site | Website start/enrich; R1–R4; About/founder/product/proof areas absent | Safe relevant URL discovery, per-source outcomes and staged extraction; more evidence without false coverage claims | Extend existing retrieval, medium/high complexity; preserve SSRF and eligibility/politeness; medium/high risk | Nested navigation/sitemap/redirects, off-origin and private targets, JS shells, duplicate/conflicting sources, partial failures |
| 2. Silent first-in-document and schema losses | Research→profile→campaign; R4 stableBound, R1 output, R5 filters, R13 persona formatter | Adaptive complete evidence units, token-aware batches, explicit omission/rejection accounting, note/description compatibility; preserve late important facts | Incremental extractor/DTO/consumer changes; medium complexity/risk, low risk for isolated persona fallback; never remove size safeguards | Late proof, giant early unit, duplicate flags, multilingual input, strict schema, persona detail parity, oversized responses |
| 3. Accepted claims lose their sources and inference status | Review/returning profile; R5 ignored source and R6 Founder Apply; unreliable later verification | Shared evidence envelope, retain exact excerpts and user origin, distinguish interpretation/missing/conflict/unavailable; enables inspectable claims | Medium/high contract work; sanitize URLs, scoped access, retention; no approval bypass; medium/high regression risk | Source→field→save→reload trace, user edit distinction, conflicting sources, same-tenant isolation, protected history/receipt/revision semantics |
| 4. No compatible description-first profile draft | New brand without website; R5/R7/R8/R12; user must enter several strategy fields manually | Reuse native keys/modules and evidence contract for description draft; preserve original brief; ask only evidence-based gaps; no fabricated facts | Product/contract approval, medium/high complexity; original brief may be private, never send cross-tenant context; medium risk | Short/detailed/mixed briefs, existing approved data, unknowns, founder missing, no overwrite, provider failure, review/save |
| 5. Onboarding sequence obscures coverage and optionality | R5 sections/readiness/preflight and R6 legacy progress; users see steps/artifacts before useful business draft | Approved Brand-first mockup, real progress, source/gap review, optional Founder/DNA/assets and explicit sync; improved control/comprehension | BW-46.3 only after mockup approval; reuse controller/IDs; medium UX complexity/high DOM regression risk | EN/DE, light/dark, mobile/zoom, keyboard/screen reader, leave/retry/refresh, viewer/role changes and campaign snapshot isolation |

## 14. Implementation dependencies and risk assessment

Low-risk candidates: truthful “this page” wording, display already returned source/truncation status, correct persona `note` fallback, characterize extraction defects, retain existing security boundaries, and improve error taxonomy. Even these require focused regression tests in a later implementation PR, not this audit.

Medium-risk work: discover permitted same-site links, parse sitemaps safely, topic-based extraction, distinguish duplicate/truncated/unsupported outcomes, strict provider schema and batched consolidation. Keep a compatibility adapter for current `suggestions`, `logoDiscovery`, `source`; do not break R5/legacy importer. Safe XML parsing must reject external entities and decompression abuse; structured data must remain data, never executable script or instructions.

Higher-risk/approval-dependent work: persistent evidence namespace and write contract, durable research checkpoints/background processing, unified module acceptance, profile-first navigation and changes to automatic empty-field adoption. Evidence must not become arbitrary raw core content subsequently duplicated into every AI prompt. Review existing raw Brain/DNA/Board snapshot consumers before persisting anything large or sensitive. No new table/migration is proposed as a prerequisite for BW-46.1. If durable work cannot safely fit the current request lifecycle, propose a separate architecture decision instead of pretending retries are resume.

Dependencies: R1 response/coverage definition → BW-46.1 safe discovery/extraction → BW-46.2 persistence and description adapter (can prepare in parallel conceptually, no concurrent agent work required) → BW-46.3 approved mockup and UI implementation. Patch verified low-risk formatter defects independently if desired. No automatic canonical-to-Board propagation, no new paid provider calls during audit, no architecture rewrite.

## 15. Detailed future work packages

### BW-46.1 — Domain Research Completeness & Reliability

Scope: characterize current one-page behavior and regressions; design backward-compatible per-source coverage response; strengthen source-grounded parsing/injection defense; discover permitted relevant same-site HTML/navigation and sitemap entries; retain R2/R3 boundaries; deduplicate source identities and content; extract relevant evidence in complete units; stage processing within verified provider context and execution boundaries. Report partial/continuable state and unavailable/rejected evidence explicitly. Keep original single-page compatibility and logo authority. No visual redesign, schema migration, general description generator or hidden job subsystem.

Deliverables: verified source inventory/outcomes, coverage accounting distinguishing discovery/fetch/extraction/processing, typed evidence references in returned drafts, no claim of complete website analysis when work remains, mocks for each failure boundary and a measured context preparation contract. Use bounded concurrency/time/memory as technical limits; do not introduce arbitrary product page/result quotas. Multi-request inference must await implementation authorization and resource/cost design; audit permits none.

Acceptance: late relevant evidence survives; duplicates do not falsely imply omission; invalid model output never replaces existing values; failed individual sources permit an honest useful partial draft; every eligible discovered source has an explained terminal/deferred outcome; user-supplied specific URLs still work; no cross-tenant read, SSRF bypass, raw HTML exposure or canonical/snapshot regression. Explicitly call out sources not fetched or semantically processed.

### BW-46.2 — Brand Profile Evidence & AI Enrichment Quality

Scope: smallest versioned evidence namespace/contract compatible with JSONB and R9 protection; preserve user brief and field-level source/excerpt lineage; expose inferred vs supplied vs unavailable/conflicting; retain review decisions across enrichment. Reuse R10 grounding principles and module acceptance; preserve Learning approval roles. Build description→draft adapter into actual supported keys/modules, not a fake complete schema. Review/correct before replacing existing Brand knowledge. Repair persona contract mismatch and downstream omission reporting if not already delivered.

Acceptance: short, detailed and mixed inputs yield useful conservative drafts; original evidence survives save/reload without leaking raw private sources to unrelated consumers; founder details never invented; every accepted sourced claim has traceability, every strategic suggestion remains labeled; no override of user-approved content, avatar or campaign snapshot; receipt/revision/review tests remain valid. Define retention/size behavior before persistent source data.

### BW-46.3 — Onboarding UX & Brand Profile Visual Redesign

First deliverable: interactive or visual mockup showing website/description start, real progress, evidence/gap review, optional Founder/DNA/assets, first useful save and later enrichment. **Separate explicit user approval of that mockup is required before visual implementation.** This audit and its public PR do not grant it.

Then implement approved design with current controller, IDs/events, language/theme/button/dialog systems, authority labels and save protections. Preserve all working entry points, Learnings, Canvas/Creator/Brain integrations and viewer behavior. Re-test desktop/mobile, EN/DE, both themes, forced colors/reduced motion, keyboard and manual screen-reader interactions. Readiness must communicate presence, verification and optionality accurately.

## 16. Regression and acceptance test plan

### Audit execution method

Existing relevant scripts were run on the audited main code; production files were not changed. Local scratch fixtures in `work/bw46` exercised real extractor/analyzer functions with injected retrieval and provider mocks. They are not published production changes or assertions of model quality. Browser scripts use Chromium and local mocked application/SQL/storage fixtures. No external customer sites were contacted; URL strings in existing tests are inert mock inputs. Disposable SQL validation requires a separate local PostgreSQL fixture and never falls back to a production DB.

### Fictional scenario coverage

| Scenario | Deterministic audit evidence / future acceptance requirement |
|---|---|
| Small business / service / SaaS / e-commerce | Scratch fictional HTML, actual analyzer with mocked provider; one retrieval, one provider call for usable input; future compare typed facts with expected source fields |
| Large multi-page site | Scratch long page + links establishes current one-page behavior and late-proof loss; future graph fixture must cover relevant pages adaptively and account for deferred work |
| Separate About/Founder | Linked pages are not fetched today; existing Founder mapping tests exercise manually supplied evidence; future automatic discovery must distinguish both source outcomes |
| Incomplete/JS/metadata-only site | Too-short and script-only input rejected before provider; future honest empty/partial outcome, never invented facts |
| Conflicting content | Both short visible claims can reach prompt; current mocked provider does not prove conflict detection; future output must retain conflict and evidence for each claim |
| Sitemap/nested navigation | Scratch anchor URLs absent from provider prompt and no child retrieval; future safe XML/nested traversal, no XXE/off-origin bypass |
| Duplicate pages/content | Actual stableBound dedup tested; future URL/content aliases and duplicate-vs-omission counts distinct |
| Missing Founder Story | Existing preflight/lifecycle tests; continue with available Brand context, no invented identity |
| Short/detailed AI descriptions | No description importer to runtime-test. Manual `brandCore` and DNA path inspected; future fixtures must retain original brief, supported facts and unknowns separately |
| Mixed domain + user facts / existing approved profile | Existing guided setup/protection tests cover empty fill/conflict/accepted child preservation; future evidence merge must preserve explicit user decisions |
| Partial provider failure / invalid output | Scratch analyzer mock provider-unavailable and invalid-analysis-response; existing importer failure tests; future per-source extraction survives consolidation failure |
| Interrupted analysis / refresh | Existing context/lifecycle/conflict tests and R5 inspection; no durable research resume today. Future test refresh rehydration of approved data and explicit loss/continuation of unsaved work |

### Existing regression results

Results of the focused run follow. A passing source/assertion test does not establish deployed runtime health, provider reasoning quality or external website coverage.

| Existing command (`node scripts/<name>.js`) | Audit result |
|---|---|
| `check-bw26-6-3-large-brand-core-website-import` | PASS; real bounded extraction/analyzer with mocked provider |
| `check-founder-story-website-mapping` | PASS |
| `check-founder-story-website-import-lifecycle` | PASS |
| `check-founder-story-brand-dna-context` | PASS |
| `check-founder-story-archetype-lifecycle` | PASS |
| `check-brand-dna-generation-preflight` | PASS |
| `check-canonical-brand-foundation` | PASS |
| `check-bw36-23-brand-knowledge-protection` | PASS; source/contract checks, not PostgreSQL runtime proof |
| `check-bw36-22b2r1-canonical-conflict-reload` | PASS; includes browser/runtime conflict behavior |
| `check-bw36-17-governed-brand-learnings` | PASS |
| `check-bw37-1c1-brand-profile-proposal` | PASS; actual Profile/Brain one-field staging, permissions, explicit save, snapshot isolation, EN/DE/theme/mobile/keyboard |
| `check-bw36-13r4-guided-brand-profile-setup` | PASS |
| `check-bw42-brand-profile-browser` | PASS; responsive/theme/locale/focus/save checks; fictional screenshots inspected |
| `check-bw36-13r5-brand-lifecycle-stability` | PASS; real handler/controller and Chromium creation/save/retry/permissions/lifecycle fixtures |
| `check-bw3-canonical-brand-creation` | PASS |
| `check-bw20-brand-team-roles` | PASS |
| `check-bw28-ai-insights-architecture` | PASS; browser script integrity and local Canvas Intelligence contracts |
| `check-website-url-policy` | PASS |
| `check-website-retrieval-diagnostics` | PASS |
| `check-extract-website-text-route` | PASS |
| `check-bw36-20-approved-learning-ai-brain` | PASS; mocked provider and authorization/coverage/revalidation |
| `check-website-retrieval` | FAIL at line49: test expects `unsafe_destination` for HTTP redirect to loopback; actual HTTPS-first policy returns `unsupported_scheme`. Redirect is rejected. Scratch-only copy accepting either rejection code passed remaining tests; original remains failed/unmodified |
| `check-html-text-extractor` | FAIL at line10: title `Example &amp; Co` remains entity-encoded; expected `Example & Co`. Body is entity-decoded; titleParts are not. Actual extraction defect, not evidence of unsafe fetch |
| `check-guided-brand-foundation-journey` | FAIL at line15: obsolete expectation that domain analyzer uploads/persists logo. Actual analyzer now previews; separate authenticated logo write owns persistence. Script stops there, so later assertions in this script are not counted as passed |
| `check-bw36-23-brand-knowledge-postgres` | BLOCKED (exit2): no configured disposable localhost PostgreSQL fixture/opt-in. Never attempted production connection or migration |

One initially mistyped test filename (`check-bw36-20-approved-brand-learning-ai-brain-integration`) returned MODULE_NOT_FOUND; it was corrected to the existing `check-bw36-20-approved-learning-ai-brain` above. It is not counted as a product regression or a completed test.

The scratch harness exercised 13 fictional HTML variants (small, large, About/Founder links, service, SaaS, e-commerce, incomplete, contradictory, sitemap/nested links, duplicate content, missing founder, German copy, JSON-LD-only), plus oversized-first-unit behavior, unsupported evidence, provider failure and invalid JSON. It asserts transport/prompt preparation, not semantic model correctness. Reproduce the key truncation/contract defects without a provider:

```sh
node - <<'JS'
const assert = require('node:assert/strict');
const {stableBound,extractHtmlText} = require('./api/_html-text-extractor');
const {normalizeBrandBrainData} = require('./api/_brand-brain-context');
assert.equal(stableBound(['x'.repeat(30),'later useful proof'],20).text,'');
assert.equal(extractHtmlText('<title>A &amp; B</title><p>Useful facts</p>').title,'A &amp; B');
const projected = normalizeBrandBrainData({personas:[{name:'Makers',note:'Need affordable repairs'}]});
assert(!JSON.stringify(projected.icp).includes('affordable repairs'));
console.log('Current information-loss behavior reproduced without network');
JS
```

### Future regression gates

Run the existing suites above and creation/lifecycle/Brand role suites after any related implementation. Require real disposable PostgreSQL protection/history/receipt tests before changing persistence. Add deterministic fixtures for source outcome accounting and evidence rehydration, not assertions that merely mirror implementation strings. For description-first onboarding, assert no founder/customer/competitor inventions on short input; preserve original user evidence and existing approved profile. For interruption/partial failures, assert no duplicate writes, stale response adoption, broad overwrite or claim of complete coverage. Test model malformed JSON, incomplete required fields, oversized values, timeout/429, per-source failure and consolidation failure separately.

Browser acceptance: 320/375/768/desktop widths; EN/DE; light/dark; keyboard/focus/leave flow; reduced motion/forced colors; manual screen-reader labels/live-region announcement review; refresh, logout, role revocation, Brand/Workspace switch during research; canonical vs Board snapshot separation; optional Founder/DNA/avatar. Do not contact external customer sites or paid inference providers for regression fixtures.

## 17. Remaining uncertainties and publication review

- No deployed environment, production DB, actual provider output, real site accessibility or live pricing/model ceilings were inspected. Mock success proves preparation/control flow, not model extraction accuracy.
- Real PostgreSQL authorization/history behavior remains unvalidated locally in this audit; source and mocked/browser tests do not replace it. The repository CI has a disposable PostgreSQL matrix; report its actual PR outcome separately.
- No dedicated description importer exists to exercise end to end; future acceptance criteria are distinguished from today's capabilities. Interrupted multi-source resume likewise has no existing runtime contract.
- Current non-English text is transmitted as UTF-8; correct semantic interpretation and source-language preservation are not established by mocked tests. Non-UTF-8 HTML may decode poorly.
- Multiple domains and redirect aliases have no brand-level relationship/evidence reconciliation. One redirect chain may end on another public host after safety checks; this does not verify company ownership or eligibility of all linked domains.
- No conflict resolver validates contradictory page claims; invalid or incomplete AI output is coarse failure. Empty fields do not identify whether facts were absent, filtered, omitted or unsupported.
- Broad accessibility, legacy HTML rendering, provider cancellation and deployment execution/cost budgets require focused future validation. Do not turn these unverified areas into claims that existing features are broken.
- Three unchanged-baseline tests fail as recorded above; no production or test-source fixes are authorized by this audit. They require follow-up characterization/fixes in BW-46.1 or the appropriate existing test package.

Publication review for this audit: restricted to repository source analysis, fictional examples and bounded test conclusions. No credentials, secret values, customer records, raw HTML from external customers, private URLs, source-page content or runtime operational dumps are included. Environment variable **names** describe existing contracts without values. Only this Markdown file is intended for the PR; scratch logs, browser screenshots, dependencies and local fixtures remain uncommitted. Repository AGENTS.md requires a dedicated branch, commit/push, exactly one normal non-draft PR against main and no merge. The user's explicit public documentation publication authorization applies; no additional interactive publication approval requirement was found in the inspected repository instructions/workflow. Runtime Boot Safety is the existing CI gate; publication is not an assertion that CI or human review has passed. Final PR status must be reported after creation. No manual merge or deploy.

## 18. Directly copyable BW-46.1 implementation prompt

```text
# TENDRA ONE — BW-46.1: Domain Research Completeness & Reliability

Repository: Funklix/Funklix. Start from latest merged main. Read AGENTS.md first and
read docs/audits/bw46-brand-profile-onboarding-completeness.md. Reconfirm the relevant
code against current main; the audit baseline is
3fc6e679e38b021d6d3a51f99b33c19fd7eee4fb (includes PR #858).

Implement the narrowly scoped domain-research reliability package described below.
This prompt does not authorize a visual redesign, new database tables/migrations,
new background-job architecture or general description-first onboarding generator.
Keep the current working Brand Profile, Board snapshot importer, logo authority,
Brand permissions, Brain, Canvas/Creator, Learnings and explicit campaign sync.

Verified starting points:
- api/analyze-brand-domain.js analyzeBrandDomain fetches one supplied URL through
  retrieveWebsiteText(...,{includeHtml:true}); it does not crawl links/sitemaps.
- api/_website-url-policy.js validates HTTPS/public destinations and all DNS answers.
  api/_website-retrieval.js pins DNS, validates redirects and bounds response size,
  decompression, time and content type. Preserve these controls on every new source.
- api/_html-text-extractor.js stableBound breaks on the first oversized unit;
  projection retains early units/sections and caps provider context at16000 chars.
  Duplicate removal and truncation share a flag; the analyzer's second context bound
  does not contribute its own truncation flag. Title entities remain encoded.
- The domain prompt asks for concise strategy JSON; validSuggestions is shallow.
  brand-profile-setup.js filteredSuggestions accepts only its existing fields.
  The current response is {suggestions,logoDiscovery,source:{url,sections,truncated}}.
  Keep a compatibility adapter for existing callers.
- The guided analyzer sends brandId and auto-persists empty fields with domain_fill;
  nonempty conflicts are reviewed. Legacy app.js analyzeBrandDomainFromEditor sends
  no brandId and replaces selected campaign snapshot values after confirmation.
- api/map-founder-story-website.js provides useful existing strict-schema,
  untrusted-evidence and exact-excerpt validation patterns; do not change its
  separate accepted-story lifecycle without a justified compatibility requirement.
- brand-write-contract.js and api/_brand-knowledge-write.js protect canonical writes.
  Its command source field is reserved for initialize, not website evidence.
- api/_brand-brain-context.js formatPersona omits note despite domain personas using
  name/note. Characterize this and add a backward-compatible fallback if included.

Required outcomes:
1. Establish deterministic characterization tests for current extraction, source
   outcomes, parser failures and both frontend adoption paths before changing them.
   Fix the verified title/late-evidence/duplicate-accounting defects with focused tests.
   Investigate the three baseline test failures documented in BW-46.0; update stale
   assertions only when justified by actual intended behavior, never weaken security.
2. Extend existing retrieval with eligible relevant same-site link discovery and safe
   sitemap support. Distinguish navigation discovery, fetched HTML, usable extracted
   evidence, semantically processed source and adopted field. Collect relevant About,
   Founder, mission/values, product/service, pricing, customers/industry, case-study,
   testimonial, FAQ, contact/company and press/editorial candidates when available.
   Discovery alone must never count as analysis. Treat externally linked domains as
   separately eligible/authorized scope; never crawl arbitrary third parties.
3. Define and enforce a public-source eligibility/politeness policy. Never bypass
   private/login/paywall/access restrictions. Keep SSRF, redirect, decompression,
   content-type, parse complexity and raw-HTML exposure boundaries intact. Safely parse
   XML/structured metadata as data with no external entities or script execution.
4. Deduplicate URLs/redirect aliases/content while retaining source references.
   Select relevant evidence adaptively rather than taking the first N pages/sections.
   Do not impose arbitrary product page/character/token/source/result quotas. Preserve
   necessary technical safety limits and document each separately with a reason.
   Bound concurrency/memory/time/provider context. If work exceeds an execution
   boundary, report partial/deferred/continuable work explicitly, not complete success.
5. Use staged evidence extraction and structured consolidation where necessary;
   verify actual model-specific input/output constraints. Never send an entire large
   website as one request. Preserve per-source extracted results when later processing
   fails. Keep unsupported fields empty and contradictions visible. Do not invent
   Founder Story, customer proof, competitors or market facts to complete a schema.
6. Strengthen prompt-injection handling and typed response validation. Return source-
   grounded draft claims with exact excerpts/references and distinct interpretations.
   Report unsupported/rejected/omitted fields rather than silently filtering them away.
7. Return a backward-compatible versioned research summary with pages discovered,
   fetch/extraction/semantic-processing outcomes, duplicates, unavailable sources,
   omitted/deferred evidence, field coverage, recoverable errors and completion state.
   Ensure the actual second context bound is represented. Present minimal truthful
   status using existing components; preserve all existing DOM IDs/listeners and
   language/theme/accessibility behavior. No visual restructuring.
8. Do not persist a new evidence/job system in this package. Carry returned evidence
   through drafts/review only as compatible with existing contracts. Preserve protected
   canonical mutation semantics, exact revision checks, idempotent retries, destructive
   review and separate logo writes. If durable jobs/checkpoints or evidence persistence
   become necessary, document a concrete architecture decision for BW-46.2 instead of
   weakening the current write contract. Do not claim browser refresh can resume an
   operation without a durable implementation.
9. Maintain both current endpoint caller modes. Canonical mode independently checks
   Brand authority; legacy session-only analysis must not gain access to stored Brand
   information. Ignore stale results after account/Workspace/Brand/Board changes.

Validation:
Use only fictional/local deterministic site graphs and mocked AI transports. Cover
small/service/SaaS/e-commerce sites, large nested navigation, sitemap, separate Founder
and About, duplicates, conflicting claims, incomplete/JS-only/non-English sources,
unsafe redirects/private DNS, oversized/compressed responses, invalid provider output,
provider/individual-source failure, interruptions and existing approved Brand data.
Check source-to-draft traceability, truthful coverage, no silent omission, preserved
user decisions, unchanged logo/Avatar/DNA and canonical-vs-snapshot isolation.
Run the relevant existing BW-46.0 listed regression suites, including the BW-42 browser
suite and Brand protection/role/conflict/Founder/Learning checks. For persistence
changes beyond this scope, require a separate approved contract and disposable local
PostgreSQL tests; never run migrations against production. No paid inference or live
customer requests during fixture validation.

Document implementation, actual safety/provider/runtime constraints, regression results,
remaining limitations and any deferred architecture decision. Review publication for
secrets/private data. Follow AGENTS.md: dedicated branch, commit/push, exactly one
normal non-draft PR against main, verify draft:false, return its real URL; never merge
or deploy manually. Obtain any publication approval specifically required by the
repository or the implementation session; BW-46.0 authorizes its documentation PR,
not a blanket future production release. Report audited/current base, actual resulting
coverage, preservation guarantees, tests, CI/review status and unresolved blockers.
```
