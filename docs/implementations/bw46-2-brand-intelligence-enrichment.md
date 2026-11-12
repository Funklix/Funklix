# BW-46.2 — Brand Profile intelligence, evidence and explicit enrichment

Base: `5794f6b5e742e44246cf05479d81a5a5d39d9440`, latest merged main including #861. No migration, new provider, background inference, manual deployment or merge. All test brands, sources and model responses are fictional.

## Description, website and field assistance

`POST /api/enrich-brand-profile` accepts the current `brandId`, `workspaceId`, numeric `revision`, `language` (`en`/`de`), and explicit `action`: `draft`, `suggest`, or `questions`. `description` and `domainUrl` are optional and compatible; `suggest` and `questions` require an eligible `field`. A description without a website creates a useful partial draft. A website uses the existing BW-46.1 research engine, including #861 robots-at-effective-URL and same-page conflict protections. A combined request uses both sources in one model request. No separate model validation call or inference retry exists.

Supported suggestions: `brandCore`, `valueProposition`, `personas`, `toneOfVoice`, `messagingPillars`, `contentGuidelines`, `keywords`, `dosAndDonts`, `brandVoiceExamples`, and only colors/typography/references within `brandAssets`. `mission`, `vision`, `values` address existing typed module content, not new native fields. General enrichment cannot rename the Brand, choose its domain/logo, write DNA/avatar, create Founder facts, approve Learnings, or replace specialized accepted module data. Ambiguous duplicate modules and modules with specialized moduleData refuse general adoption.

`questions` returns one field-specific localized question without any model call. Answers are optional `{id: field, answer: text}` entries sent with a later explicit `suggest` request. Skipped questions stay optional. The endpoint does not autonomously ask again or persist a conversation. `FunklixBrandProfileSetup.createSession()` exposes `enrichProfile`, `editEnrichment` and `decideEnrichment` as reusable controller actions. Dedicated field/question UI belongs to BW-46.3.

The minimal existing Overview button **Prepare enrichment draft** uses the saved description and optional website. Save manual changes before generating. Existing Review cards support text/structured JSON editing, explicit Accept, Reject and Complete later. Invalid structured edits receive native validation. No CSS, section layout or legacy IDs were removed. Opening/rendering never calls the model. EN/DE strings are included. Existing **Analyze website** remains the compatible older path, including its protected automatic empty-field fill; only the new workflow guarantees review before every adoption. This semantic distinction is deliberate and fixture-tested.

## Evidence and privacy decision

The existing protected JSONB contract safely supports a small namespace: `brand_core._profileEvidence`, version `brand-enrichment/v1`. No schema migration or separate store is needed. Each supported field keeps its latest explicit decision, original proposal, selected edited value, classification, origin, baseline revision and checked short citations. Citations retain the sanitized source URL, original URL when available, exact excerpt, retrieval time/hash when available, source kind and research origin. Query strings, fragments and credentials are not retained as source URLs. Unsupported/invalid quotes are discarded. Occurrence checks establish attribution, never entailment or external verification.

Classification separates `user_provided`, `website_supported`, `ai_interpretation`, `conflicting` and `missing`. Existing saved Brand context is identified as existing context, not automatically certified fact. Strategic proposals remain interpretations; acceptance does not certify company truth. Missing does not mean absent from a website. Research's unavailable/deferred outcomes remain distinct in the returned research envelope. Conflicts remain visible and non-adoptable even with missing/invalid citations. Factual suggestions require checked evidence. Description extraction with no checked support remains missing; field-specific strategy can suggest an explicitly labeled interpretation.

Original user descriptions and submitted answers are retained in an input map keyed by the request's context hash, only after an explicit decision. Fields reference that origin; no full fetched website, raw HTML, prompt, whole research graph or private document is persisted. Inputs no longer referenced by any latest decision are pruned atomically. The existing <=1MiB protected command/core boundary still applies, with no silent slicing. User text uses the existing 50,000-character field boundary and is rejected explicitly if oversized. Detailed supported input is passed intact; source retrieval/context, model-response parse and timeout safeguards reuse BW-46.1 (16,000-character website context, 200,000-character response parse boundary, 30-second provider abort). These are technical safeguards, not new page or product quotas.

Retention is the latest decision per field plus referenced original user inputs. Protected history retains prior snapshots under its existing retention rules: replacing/clearing current evidence is not a promise to erase history. Evidence is editable user-owned provenance, not a signed server assertion. Advanced canonical editing can remove/correct it using the same reviewed writer. Saved evidence is inspectable in existing Review details after reload; later manual field edits label its earlier evidence historical.

Privacy boundary: `_profileEvidence` is omitted from raw DNA and AI Brain model context, normalized downstream context, initial project snapshots and explicitly refreshed Board snapshots. Snapshot comparison/confirmation uses this same intentional projection. No existing snapshot is updated by enrichment. Board-only access cannot retrieve canonical evidence through the new endpoint, which independently requires Brand edit capability and accepted Workspace membership. Explicit campaign sync/approval remains intact. Original briefs are not silently copied into Board context.

## Protection and adoption

The handler requires session identity, active application identity, active matching Workspace, accepted membership and independent canonical Brand edit capability. It checks authorization/revision again after the asynchronous provider call, so revoked access or changed Brand data prevents returning a draft. Viewer/no membership/cross-Workspace/stale requests fail before inference. Disconnects propagate cancellation. Errors return fixed codes without provider body, source text or private exception details. Model input is delimited JSON under system instructions treating evidence as data, never instructions; strict eligible key/shape checks reject malformed/unsupported output.

Generation makes no canonical mutation. Explicit decisions use `profile_edit`, exact expected revision/value comparison, existing destructive preview/review, idempotent receipts and authoritative GET verification. The evidence namespace is replaced atomically in the same protected command as an accepted value; this is necessary because ordinary partial JSONB diff intentionally preserves omitted keys. Rejected/postponed decisions change metadata only. Existing nested siblings and unknown data survive. A reviewed array replacement replaces that selected array; unrelated structures remain untouched. Saved values remain manually editable/clearable. A stale proposal never rebases over another actor's newer value; reload and regenerate are required. Remaining proposals advance only after this session's confirmed own decision.

## Founder, DNA and downstream context

Accepted structured Founder context is read through `serializeFounderStoryContext`; unaccepted Founder text is excluded from the new contextual projection. The specialized public URL import, seven facts, narrative acceptance and optional Founder→DNA preflight remain owned by their existing workflows. General enrichment cannot alter these or approved DNA/avatar. Existing approved strategic module projection is reused; private document modules and unapproved Learnings are not added. Governed Learnings remain separate, and no new Learning read or approval bypass exists.

`formatPersona` now includes the actual `note` used by guided/domain personas alongside a distinct richer description/summary. Existing downstream bounds remain; no authorization expansion or automatic snapshot sync occurs. Accepted strategy `sourceNotes`, optional offers/proof aliases, broader normalized-field coverage and specialized canonical module controls remain documented gaps in the field matrix. We deliberately do not turn sourceNotes into confirmed factual claims. DNA generated-draft binding defect F6 and persona-row removal F4 remain separate follow-ups.

## Verification and review

New production-path tests: `check-bw46-2-brand-enrichment.js` and `check-bw46-2-brand-enrichment-browser.js`. They cover short/detailed description, domain and combined evidence, typed field shapes, optional localized questions/answers/skips, conservative missing/conflicting drafts, invalid quotes/output/provider failure, current and in-flight access revocation, viewer/cross-Workspace/stale revision, explicit editing/accept/reject/postpone, actual protected HTTP save/reload/clear, all 13 eligible suggestion keys, unchanged Founder/DNA, downstream persona notes and snapshot isolation. Browser checks run actual app bindings in EN/DE. Existing BW-46.1 browser ledger independently exercises all 28 guided bindings and advanced leaves; its F2 assertion now verifies repaired note projection rather than the former defect. F6 characterization is retained unchanged.

The workflow registers both new checks after browser installation, preserving PostgreSQL 17.6 and 18.4 jobs and every existing security assertion. Local and remote results are reported separately in the PR/final delivery. A mock proves transport/contract behavior, not real model semantic accuracy or independent factual truth. No paid inference/customer requests were used. No universal field completeness claim is inferred from the new button or two browser cases.

Publication review: scope is production code, fictional fixtures/tests, field matrix and this implementation document. Attachments, scratch files, logs, screenshots, dependency directories and environment/secret values are excluded. Self-review specifically checked canonical-vs-snapshot boundaries, evidence minimization, robots/conflict compatibility, unchanged special approvals, expected-value/revision protection and lack of automatic generation. External review and full remote CI remain separately observable gates.


## Focused local results

Both new suites pass. All 35 existing focused checks pass after the BW-8 comparison rerun. Coverage includes the BW-46.1 eleven domain/source-integrity groups and 28-guided-binding/advanced-field browser ledger; Founder mapping/import/context/archetype and DNA preflight; canonical foundation/writer/browser/conflict; governed Learnings and approved-only Brain; BW-37 Brain profile handoff; guided setup/lifecycle/decisions; BW-42 profile; canonical creation/editing/roles; Insights architecture; URL/retrieval/diagnostics/extractor/route; campaign snapshot isolation/comparison/initialization; BW-40 reference contracts/browser; runtime script integrity and PostgreSQL TLS. The initial comparison failure was an introduced browser-global dependency in the isolated function VM; the production comparison now projects locally and its unchanged suite passes. No assertion was weakened.

The first public PR creation attempt was rejected by automatic approval review, which did not accept uploaded-file authorization as direct chat authorization for this destination. The user subsequently confirmed this exact public non-draft PR publication directly in chat. The implementation branch is published; PR creation and remote PostgreSQL matrix results are reported separately in the delivery. Local PostgreSQL work is reported separately and cannot establish remote CI success.


## Final projection and real PostgreSQL review

The production project-creation test was extended with a Brand that already contains private evidence. It reproduced an HTTP 500 because the existing client/server command validator still required byte-for-byte equality with the entire canonical core. The validator now requires exact equality with the canonical snapshot projection excluding only `_profileEvidence`; revision, timestamp, field and ownership checks remain unchanged. BW-11/12/13 source assertions now check that explicit projection while preserving their existing safety assertions. The enriched-Brand creation test passes and proves that new Boards receive no private evidence. Existing creation and profile-lifecycle suites also pass.

The restricted-runtime PostgreSQL suite now calls a dedicated fictional `bw46-2-postgres` fixture through the actual profile controller, signed-session HTTP handlers and protected writer. On PostgreSQL 17.6, all 56 groups pass, including generation without mutation, user-edited adoption, atomic pruning of old input references, rejected/postponed decisions, reload/manual edit/clear, real stale-revision rejection and unchanged saved campaign snapshot. No new SQL function or privilege is introduced. Complete workflow replay and PostgreSQL 18.4 outcomes follow separately; this is not a claim of remote CI success.


A mixed-input request can retain its description draft when public research reports an unavailable/denied/empty source; the response and existing status text disclose that gap. Invalid/unsafe destination policy failures still reject before inference. Research processing counters/state reflect the single successful enrichment request; provider-failure evidence is returned only after revalidating current access. The provider-output validator also rejects scalar `fields` payloads. Fictional regressions cover these branches.


Field-level requests also reuse short citations from accepted evidence records whose saved value still matches the current field. Rejected/postponed decisions and historical evidence for manually changed values are excluded. Reused quotes are labeled previously reviewed evidence, not fresh website verification; URLs are sanitized again. Entire original private briefs are not serialized for this contextual reuse. A deterministic field-assistance regression checks both useful reuse and omission of the full private input.


## Exact scoped file inventory

- `.github/workflows/runtime-boot-safety.yml`
- `api/_brand-brain-context.js`
- `api/_brand-enrichment.js`
- `api/_project-command.js`
- `api/ai-brain/advice.js`
- `api/boards/[id].js`
- `api/discover-brand-dna.js`
- `api/enrich-brand-profile.js`
- `app.js`
- `brand-enrichment-contract.js`
- `brand-profile-setup.js`
- `docs/audits/bw46-1-brand-field-integrity-matrix.md`
- `docs/implementations/bw46-2-brand-intelligence-enrichment.md`
- `index.html`
- `language.js`
- `project-command.js`
- `scripts/check-bw11-create-board-from-canonical-brand.js`
- `scripts/check-bw12-canonical-snapshot-provenance.js`
- `scripts/check-bw13-canonical-to-board-refresh.js`
- `scripts/check-bw36-23a-r3-runtime-postgres.js`
- `scripts/check-bw46-1-brand-fields-browser.js`
- `scripts/check-bw46-2-brand-enrichment-browser.js`
- `scripts/check-bw46-2-brand-enrichment.js`
- `scripts/fixtures/bw46-2-postgres.js`
