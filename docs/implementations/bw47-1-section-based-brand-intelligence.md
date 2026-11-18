# BW-47.1 — Section-based Brand intelligence

Base: `918fee9` (merged PR #866). Branch: `codex/bw47-1-section-brand-intelligence`. Fictional business descriptions and mocked inference only. No paid inference, migration, new provider, automatic retry, merge or manual deployment.

## Inspection and baseline

Read repository AGENTS.md, BW-46 completeness audit, field-integrity matrix and BW-46.2/3/5/6 implementation reports. Traced enrichment/schema/HTTP authorization, shared adoption contract, profile controller/review/CSS/localization, canonical reader, normalized Brain projection, Founder serializer/dependency engine and DNA approval. Existing protected writes, revisions, pending drafts, evidence and campaign projection remain their original owners.

Before modifying generation behavior, ran the production `enrich` function at base with the fictional refrigeration fixture in `scripts/fixtures/bw47-1-brand-quality.json`. This fixture describes technical installation/maintenance, individual solutions, emergency service, experienced staff, quality equipment and customer support. It contains an expected-behavior entry for each of the 13 supported fields. Deterministic injected bad responses were all adoptable `ai_interpretation`: promotional Content Guidelines (`Wir sind Ihr zuverlässiger Partner…`), company-attribute Tone (`Erfahrene Servicemitarbeiter`, `Hochwertige Geräte`) and an ungrounded 80-percent savings message. The original prompt contained shapes and general conservatism but no editorial field purpose. An additional deterministic probe of the exact archived base also accepted an English nested `dosAndDonts` entry (`Use the facts and explain the benefits for your customers.`) for requested German output. These are demonstrated contract gaps, **not observed live model outputs**. No claim is made about the unavailable Eiskrallt incident or actual provider improvement.

## Before and after

Before: explicit draft request → optional research → normalized canonical context and short accepted citations → one general shape-oriented prompt covering all fields (or one field) → strict schema/parser/quotation validation → existing review/adoption.

After: explicit request → validated section/target-field scope → existing saved context and reviewed evidence (section requests cannot crawl) → centralized field-purpose specifications and explicit output language → the same single provider request/schema → independent shape/evidence checks plus conservative quality review flags → compatible review/adoption. Legacy full drafts retain optional research; single-field requests remain supported. Opening/rendering a section never invokes inference.

`api/_brand-enrichment-quality.js` defines each field's purpose, expected content, structure, sources, relevant context, quality criteria, common errors, missing-information behavior and language policy. The provider receives only requested fields' specifications. `brand-enrichment-contract.js` exposes immutable section lists without adding canonical schema fields.

| Section identifier | Eligible generation fields |
| --- | --- |
| `brand_foundation` | `brandCore`, `valueProposition`, `mission`, `vision`, `values` |
| `audience_offers` | `personas`; existing accepted offers/modules inform context, no new offer target |
| `voice_messaging` | `toneOfVoice`, `messagingPillars`, `contentGuidelines`, `keywords`, `dosAndDonts`, `brandVoiceExamples` |
| `brand_identity` | `brandAssets` colors/typography/references only; Founder Story/DNA retain specialized workflows |

| Specification | Strategic job and source discipline |
| --- | --- |
| Description | Factual activity and supported audience, no invented history/certifications |
| Value Proposition | Relevant customer outcome and supported contribution, no invented differentiator |
| Mission | Present purpose; explicit purpose/answer required by instructions, unknown remains missing |
| Vision | Future ambition; supplied ambition required, never invent an official aspiration |
| Values | Decision principles grounded in practices; derived values remain suggestions |
| Personas | Evidenced segments/buying roles; service category alone does not prove an audience |
| Tone | Coherent communication characteristics rather than equipment/staff attributes |
| Key Messages | Supported customer takeaways, no unsupported superiority/guarantees |
| Content Guidelines | Actionable editorial rules rather than company advertising statements |
| Keywords | Supported service/topic vocabulary, no invented products/certifications |
| Dos & Don'ts | Actionable behaviors classified in the correct positive/negative lists |
| Voice Examples | Concrete good/avoid phrasing consistent with known facts, including the avoid example |
| Assets | Evidenced visual identity only; no generated DNA/logo or fabricated fonts/colors |

## Request and additive response contract

Example explicit request to the existing endpoint:

```json
{
  "brandId": "<authorized Brand UUID>",
  "workspaceId": "<authorized Workspace UUID>",
  "revision": 7,
  "action": "draft",
  "section": "voice_messaging",
  "targetFields": ["toneOfVoice", "contentGuidelines"],
  "language": "de"
}
```

A section requires a nonempty unique subset of its eligible `targetFields`. Unknown sections, cross-section/specialized targets, targets without a section and section requests carrying `domainUrl` fail before inference. This last rule prevents accidentally repeating research and makes reuse explicit. Omit `section`/`targetFields` for existing full-draft callers; existing `field` callers remain valid. A field scoped to a section must be its sole target. The current profile has no new guided navigation or section buttons; its existing reusable controller forwards explicit section requests and uses the same review UI. The future UI must initiate each section request through a deliberate user action.

The v1 response retains `fields`, field evidence, originId, originalValue, research, Brand ID and revision. Additions: `requestedSection` (null for legacy calls), `targetFields`, `language`, `missingFields` (missing or unavailable targets), `unsupportedFields` (Founder/DNA specialized owners for Identity), and optional `questions`. No out-of-scope model field survives. Each proposal retains its checked citations; there is no second evidence store or acceptance endpoint. Specialized Founder/DNA are reported as unsupported generation targets, not invented proposal fields. Existing full-draft callers still get the same 13 field placeholders.

## Language and quality handling

Profile generation currently follows `state.uiLanguage` → profile mount language callback → controller request `language` → enrichment prompt. The independent campaign-language preference does not control canonical profile generation. Both full draft and field/question routes use this path. Missing language defaults explicitly to English for older callers; supplied values must be `en` or `de`. The legacy domain-analysis endpoint is unchanged and is outside this new enrichment validation layer.

| Generation seam | Language propagation verified in source |
| --- | --- |
| Full, section and single-field enrichment | Saved UI-language callback is sent explicitly as `language`; prompt, nested-value validation and response metadata use it |
| Field questions and answer-based suggestions | Same callback and endpoint; questions are localized without inference, later explicit suggestions use the same language contract |
| Legacy `analyze-brand-domain` profile action | Sends domain and Brand ID without UI language; remains outside the new enrichment validator |
| Specialized Founder narrative and DNA actions | Current profile requests do not send UI language; their separate prompt/acceptance owners are preserved |

This PR therefore does not claim application-wide language enforcement for legacy/specialized routes. Their language propagation gaps are documented follow-up work rather than silently altering research, Founder or DNA contracts. Canonical profile enrichment has explicit EN/DE enforcement within the conservative detector's limits below.

The specification requires consistent prose in every nested value, list and persona note; JSON keys and proper brand/product names stay unchanged. Established technical terms may remain. A conservative sentence-level DE/EN function-word check detects demonstrable foreign prose within individual nested values, so one English do/don't entry can flag its field while independent German fields survive. Brand names are removed from detection; short title-cased names/labels (including product names with English function words), isolated HVAC, IoT, R290, B2B and short foreign labels do not establish a mismatch. This is deliberately **not a complete language classifier**: short mixed phrases and other languages can escape detection. Source excerpts retain their original language.

Quality diagnostics identify the supported affected field with fixed `language_mismatch`, `field_purpose_review`, or `claim_grounding_review` categories. Narrow self-descriptive advertising patterns in guidelines and exact recognizable staff/equipment-only tone patterns trigger review. Previously unseen quantified claims in textual strategy fields also trigger review. These heuristic flags are **not semantic certainty**; number-format or wording differences can also require manual review. The original proposal and evidence remain available with `classification: unavailable`, `reason: quality_review_required`; existing individual/bulk acceptance excludes it. Conflicting fields stay conflicting. Safe correction is manual editing in the existing canonical editor, or another explicit generation action; no translation retry, filler or additional paid call occurs. Review diagnostics explain this in EN/DE.

Existing shape, unsafe-key, unsupported-field, quotation, source, unchanged-value and specialized-module checks remain authoritative. Independently valid fields survive malformed/flagged neighbors. Quote occurrence verifies attribution only, not entailment. Full paraphrase grounding, arbitrary unsupported claims, contradictions with accepted information, mission/vision intent, usefulness, do/don't polarity and general field semantics require qualitative evaluation; prompts instruct these behaviors but deterministic checks cannot certify them. No numerical quality score is produced.

## Dependencies, authorization and user control

Canonical saved positioning, audience, offers and plain Foundation modules supply context. Existing accepted Market Research/Business Plan projection retains confirmed facts versus assumptions. Only still-current accepted evidence decisions contribute short historical citations; full private inputs and rejected/postponed decisions are excluded. An optional description/answers record is explicitly `user_provided`, never silently promoted to confirmed canonical knowledge.

The enrichment-specific projection now excludes unapproved DNA before normalization, closing its earlier nested archetype/signals path. Founder context requires the existing accepted structured serializer and exactly one Founder instance; ambiguous instances supply no Founder context. Draft-bearing general modules and unsupported arbitrary module types do not enter confirmed context. Existing registered plaintext Product Knowledge, Competitor Research and Custom modules remain available as user-saved canonical context; nonempty structured draft data in those modules is excluded. The shared Brain projector, Founder acceptance, DNA approval and dependency engine themselves are unchanged. No unaccepted model response is supplied as a dependency.

The existing HTTP handler independently checks current identity, matching active Workspace/membership, canonical Brand edit permission and revision before and after generation. Revocation/staleness withholds section content and diagnostics. No Board-only permission can authorize Brand enrichment. No write occurs during generation. Existing typed editing, reject/later, eligible bulk acceptance, revision/expected-value conflict protection, destructive preview/token, idempotent receipt, authoritative reload and later editing all use the original contracts. No campaign snapshot synchronizes automatically, and no hidden mutation or separate persistence owner is added.

Section calls reuse saved canonical evidence and accepted knowledge; they do not reuse an unaccepted in-memory research envelope as authoritative evidence. Thus pending website findings should first be reviewed/accepted through the current workflow. This is a deliberate bounded dependency, not a new research cache.

## Regression and review evidence

New checks:

- `node scripts/check-bw47-1-brand-intelligence.js`: all sections/specifications, request/schema scope, single/full compatibility, unknown Mission/Vision and missing audience fixtures, optional questions/answers/skips, DE/EN nested mixed language, technical names, good/bad guidelines/tone/messages, quantified grounding flags, malformed neighbors, accepted evidence/Founder/DNA and draft isolation, real HTTP scope/revocation.
- `node scripts/check-bw47-1-brand-intelligence-browser.js`: actual app/controller/handler/review/protected writer/GET, DE/EN diagnostics, one valid field surviving two flagged fields, valid-only bulk acceptance, zero recrawl/extra inference, postponement preserving quality diagnostics, reload, snapshot isolation and mobile/dark reflow.

Both pass locally. Existing BW-46.2 and BW-46.5 production API suites pass. The unchanged BW-46.1 binding ledger and BW-46.2–6 browser/controller suites cover individual editing/reject/later, 28 field bindings, source/provenance, save/reload/edit-again, protected bulk behavior, Founder and DNA workflows. Existing BW-36 protected permissions/runtime SQL suites, BW-40 reference suites and BW-42 mobile/theme matrix remain registered. New checks are registered in both Runtime Boot Safety database jobs. Complete replay results and publication review are recorded below after execution.

| Requested coverage | Evidence and boundary |
| --- | --- |
| 1–6: four sections, single field, legacy full draft | New production enrichment test checks exact schema/response target keys and call counts |
| 7–11: DE/EN, mixed language, names, technical terms | New nested-output tests and actual EN/DE diagnostics; short ambiguous prose remains a documented limit |
| 12–19: guidelines, tone, messages, unsupported claims, unknown strategy/audience | Good/bad fictional injections exercise narrow review flags and missing fixtures; prompt assertions cover source/intent instructions, not real inference quality |
| 20–21: optional questions and skipped answers | New production questions/suggest calls, zero inference for questions, skipped-answer missing result |
| 22–26: accepted context, draft isolation, Founder, DNA, evidence | New prompt/provenance isolation checks plus existing specialized dependency/approval and real PostgreSQL fixtures |
| 27–28: malformed and mixed valid/invalid fields | New section tests and unchanged BW-46.5 parser/browser cases |
| 29–32: bulk, protected editing/reload, permissions, campaign isolation | New real-app valid-only bulk and postponed-quality decision; existing BW-46.1/2/6 controller/browser/real PostgreSQL protections |
| 33–34: EN/DE UI and mobile/theme | New section diagnostics/correction links and unchanged BW-42/BW-46 browser matrices |

No existing assertion, role gate, browser timeout or migration is relaxed. The tests establish contracts with mocked inference; they do not establish improved live model behavior.

## Proposed qualitative evaluation (not executed)

Paid provider evaluations require explicit user approval before execution. Freeze these prompts and an unchanged-base comparator; use identical provider/model settings and anonymized fictional inputs. Evaluate German and English refrigeration descriptions, short/detailed and missing-audience variants, accepted Foundation followed by Voice, contradictory website/user excerpts, unknown purpose/ambition, technical product/brand names, and explicit voice preferences. Include an unrelated service business to detect overfitting to this fixture.

Have independent bilingual reviewers compare blind paired outputs for field purpose, actionable editorial rules, coherent voice, grounded claims, mission/vision uncertainty, supported audiences, language and usefulness. Record field-level evidence and failure examples, including false-positive withheld fields and missed mixed language, separately from schema/transport success. Review unsupported assertions against sources rather than quote occurrence. Report sample sizes and disagreement; do not infer quality improvement from deterministic fixture pass rates. No paid run has been executed here.

## Remaining work for BW-47.2

Design/review the guided section UX separately, with explicit Generate/Review/Accept section/Complete later actions and draft-retention behavior. Reuse the v1 proposal/plan contract and existing protected writer. Decide how to expose optional missing-field questions without a fixed questionnaire or automatic loops. Consider a separately authorized design for reusing unaccepted research as clearly labeled drafting context and a broader, evaluated language detector. Qualitative model evaluation and tuning remain pending cost approval. Broad offers/proof aliases, the legacy domain-analysis path and unrelated audit findings remain outside this scope.

## Scoped review and publication inventory

Self-review addressed production-path details: unapproved DNA could previously enter normalized enrichment context through nested archetype/signals, and quality-withheld proposals needed a direct existing Advanced options correction link with a reason specific to suggestion quality. These fixes do not change approval owners or protected acceptance. Review also retained registered plaintext product/custom knowledge and populated-field Help actions while excluding structured unaccepted drafts. Proper-name tests also cover a multiword international name containing English articles, preventing noun-only text from establishing a language mismatch. Already-known canonical fields do not produce redundant missing-information follow-ups after generation. Explicit Help actions for populated fields still work: they ask about a refinement decision, with specific voice/outcome/audience variants, rather than reopening factual onboarding.

Only these ten files are intended for publication:

- `.github/workflows/runtime-boot-safety.yml`
- `api/_brand-enrichment.js`
- `api/_brand-enrichment-quality.js`
- `brand-enrichment-contract.js`
- `brand-profile-setup.js`
- `language.js`
- `scripts/check-bw47-1-brand-intelligence.js`
- `scripts/check-bw47-1-brand-intelligence-browser.js`
- `scripts/fixtures/bw47-1-brand-quality.json`
- `docs/implementations/bw47-1-section-based-brand-intelligence.md`

Attachments, dependencies, scratch baseline checkouts, raw logs, screenshots, local replay scripts, container assets and environment data remain excluded. The fixture contains no real customer data, biography, website fetch or live model response. External review and hosted CI are separate from this self-review and local replay. Public PR publication requires direct Chat authorization under the uploaded request's delivery section; no merge or manual deployment is authorized.

## Local Runtime Boot Safety replay

The complete workflow's executable run blocks are replayed with fail-fast shell semantics within each block and retained per-step results; later blocks still execute after a failed block. The two dependency/browser installation blocks use supplied dependencies and system Chromium, matching prior local replay practice. PostgreSQL 17.6 uses the official Debian image (17.6-2.pgdg13+1); PostgreSQL 18.4 uses the official Alpine image. Separate local database ports isolate their role/transaction fixtures. This is local validation, not hosted image/browser parity or a hosted CI result. Only temporary fixture infrastructure is affected; no application migration or deployment is performed.

Both databases pass the real restricted-runtime R3 standard (57 groups), completed-upgrade (66 groups, plus 74 installer/protection groups) and restrictive-graph (55 groups) checks. PostgreSQL 18.4's first bootstrap-operator setup attempted connection before its temporary container was ready and failed ECONNREFUSED; the identical role creation succeeded after readiness was confirmed, before any real database test. The initial failed setup log remains retained. Later fixture logging omits verbose SQL error statements to bound local log growth; client errors, assertions, permissions and query behavior are unchanged.

Both replays reproduce unchanged BW-43 `Expanded Journey sources reflow` at `scripts/check-bw43-insights-browser.js:135`. An independent exact `git archive 918fee9` checkout with the same dependencies/Chromium also fails this assertion. This is a demonstrated pre-existing issue, outside section intelligence; no Journey code/assertion is modified. The native Chromium 200% zoom subcommand skipped by the failing shell chain passes independently. The BW-43 failed block remains a failure, not a green result inferred from the zoom check.

Both complete replays account for 234 run blocks each:

| Initial full replay | PostgreSQL 17.6 | PostgreSQL 18.4 |
| --- | ---: | ---: |
| Passed executable blocks | 230 | 229 |
| Failed executable blocks (retained) | 2 | 3 |
| Supplied installation equivalents | 2 | 2 |

All BW-46.1–46.6 and new BW-47.1 API/controller/browser blocks pass in both full replays. This includes actual EN/DE onboarding, Founder acceptance, DNA draft editing, typed review/bulk adoption, source provenance, authoritative reload, read-only permissions, mobile/themes and campaign isolation. The final affected-path checks use frozen production source `e302fa9`; subsequent delivery changes update this report only. Existing BW-36, BW-40 and BW-42 checks execute within these full replays. No full hosted CI success is claimed.

Two additional initial browser failures are retained for serial investigation: PostgreSQL 17.6's BW-36.21B2 Home Insights check found 0 rather than 1 entry at line154; the same complete check passes in the PostgreSQL 18.4 replay. PostgreSQL 18.4's BW-37.1B-R1 Advisor check timed out waiting for `[data-ai-brain-create]` at line118; the same complete check passes in the PostgreSQL 17.6 replay. Neither related production path nor its assertions/timeouts were changed. These initial local failures are retained. After both full replays finished, the unchanged Home suite passed serially (125.4 seconds), followed by the unchanged Advisor suite (14.2 seconds). No assertions, timeouts or related production code were altered for these retests.


| Consolidated local coverage after explicit setup recovery and unchanged serial retests | PostgreSQL 17.6 | PostgreSQL 18.4 |
| --- | ---: | ---: |
| Passing executable run blocks | 231 | 231 |
| Unchanged-base BW-43 reflow failure | 1 | 1 |
| Supplied dependency/browser installation equivalents | 2 | 2 |
| Independent native Chromium 200% zoom check | PASS | PASS |

This consolidated table does not erase the initial two/three failures above and does not label BW-43 as passing. No scoped regression remains identified by the mocked production-path, browser and existing protected PostgreSQL suites. Real model quality remains unevaluated; hosted CI and external review remain separate. The dedicated branch is prepared for publication with the exact ten-file inventory above. Exactly one public non-draft PR against `main` remains pending direct Chat authorization required by delivery section15. No merge or manual deployment has occurred.
