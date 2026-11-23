# BW-47.1 R1 — Brand AI quality and proposal state correctness

Base commit `8c765bce9149300edfeb732b1ad08bec3a8f4acb` is merged main including PR #867. The implementation follows the entry points and protected ownership documented in BW-46.2 through BW-47.1.

## Reproduction on merged main

The Chromium regression used the actual Brand Profile, production HTTP handler, parser and adoption contract with a fictional refrigeration and air-conditioning service. The website excerpts and inference response were deterministic fixtures. An accepted Tone of Voice record was already saved. Full website enrichment displayed **13 review items, 0 available suggestions, 0 eligible, 13 needing attention and 1 already reviewed**. The targeted Tone of Voice request returned the identical saved list and displayed “Needs more information.”

Three distinct behaviors produced that aggregate. The server guaranteed one field entry for each of the 13 requested fields, even for null or malformed records. Review counted those entries as items and every plan exclusion as needing attention. The parser assigned the legacy `missing` classification to identical values with `reason: 'unchanged'`, and Review ignored that reason. Quality flags used the broader `unavailable` classification, obscuring why a generated value was withheld. The actual customer response and field-level telemetry were unavailable, so the table records verified causes for the reproduced scenario.

| Target | Verified fixture cause | R1 presentation |
| --- | --- | --- |
| Brand description | Generated text equals the saved description | Saved value unchanged |
| Value Proposition | Null model record | No value was generated |
| Mission | Null model record | No value was generated |
| Vision | Null model record | No value was generated |
| Values | Existing specialized module owns the field | Specialized module editor |
| Personas | Generated value cites an excerpt absent from the cited record | No usable evidence for this suggestion |
| Tone of Voice | Generated list equals the accepted saved list | Saved value unchanged, with prior acceptance visible in saved history |
| Key messages | Generated savings claim includes an unsupported percentage | Quantified claim needs supporting evidence |
| Content guidelines | Generated advertising copy has the wrong purpose for an editorial field | Field purpose needs manual review |
| Keywords | Model record has an invalid value shape | The generated field could not be validated |
| Communication guidelines | German request contains an English instruction | Output language differs |
| Voice examples | Null model record | No value was generated |
| Brand assets | Null model record | No value was generated |

On R1 the same website response shows **4 review items, 0 available suggestions, 0 eligible and 4 needing attention**. The four cards cover the three withheld drafts and the unsupported Persona citation. A separate disclosure lists nine other generation results. The saved profile and previous reviews display the one accepted record independently. Valid drafts increment available suggestions. Unsaved profile edits, permissions, current revision, supported shape and ownership determine eligibility. An explicit generation request can replace a stale draft after a manual correction. A conflicting result is a review item with its evidence and a blocked acceptance action.

## Improvement and review behavior

- Populated fields expose **Improve with AI**. Empty fields retain **Suggest with AI**. Optional questions for populated Voice, Content Guidelines, Messaging Pillars, Value Proposition and Personas ask about a specific refinement goal. Replies enter the next explicit request as user input.
- Improvement requests include the saved value for the eligible target, its field purpose, relevant persisted Brand context and criteria for useful change. The instructions connect Tone of Voice to actual communication, Content Guidelines to editorial decisions, Messaging Pillars to customer takeaways, Value Proposition to an evidenced offer and outcome, and Personas to known audiences and decisions. An optional answer supplies the reason for the change.
- The server recognizes an equivalent generated value after whitespace normalization and object-key comparison. A populated improvement target can also return an explicit no-improvement result with a null value and empty evidence. Both outcomes keep the saved value visible and sit outside actionable counts and missing-field follow-ups. Acceptance also rejects an edit that resolves to the saved value.
- Review shows the saved value and its confirmation status alongside an eligible proposal or a withheld draft. Language, purpose and grounding flags are localized in EN/DE alongside the proposal. Validated excerpts and the original generated value remain inspectable. **Edit saved field** opens the existing editor without transferring the draft into it. Specialized fields use Advanced options. Canonical edits and accepted proposals follow the existing preview, authorization, revision and authoritative readback.
- A rejection or postponement keeps the most recent accepted value and its citations visible in history. Earlier full request inputs continue to be pruned when superseded. Later generation can reuse the accepted citations while the accepted value still matches the saved value. The history and original inputs remain in the private evidence namespace that campaign snapshot and downstream projections already exclude.

## Grounding and qualitative evaluation

Full drafts still require a checked short excerpt per proposed value. Factual fields and populated-field improvements also require a usable citation. The prompt explains the existing source identifiers and asks for short verbatim excerpts in the original source language, including when the generated value uses a different language or draws on saved context. The fixed quality checks continue to flag detectable mixed-language prose, narrow patterns of misplaced marketing copy or company attributes, and unseen quantified claims. The parser validates fields independently, retains conflicts for review and keeps invalid or withheld results outside individual and bulk acceptance. Website retrieval, URL and source rules, Founder/DNA ownership, and Brand authorization remain on their established paths.

The deterministic tests exercise classification, display, prompts, protection and persistence with mocked inference. Actual provider quality remains unevaluated. A future qualitative evaluation can compare blind pairs in EN and DE using the same model settings, fictional service profiles and optional reasons for improvement. Reviewers can check whether a tone change helps a writer handle technical questions, whether a guideline gives an actionable instruction, whether a pillar expresses a distinct customer takeaway, whether a value proposition supports its outcome with a confirmed offer, and whether every proposed buyer role has direct evidence. Include good existing values, unsupported claims, uncertain audiences, conflicting sources and a missing-source case. Record unjustified rewrites and appropriate decisions to keep the saved value. Short mixed-language phrases, unquantified unsupported claims, semantic entailment and generic paraphrases still require human evaluation.

## BW-47.2 interface

Use the existing `POST /api/enrich-brand-profile` and current Brand ID, Workspace ID, revision and UI language. Keep `action: 'draft'` for a section with a nonempty `targetFields` subset. Use `action: 'suggest'` with one `field` for a targeted request. A scoped improvement adds `intent: 'improve'`. Existing targeted suggest callers also receive the improvement prompt for a populated supported value. The section can contain both populated and empty fields. Response `improvementFields` lists the targets with eligible saved values.

Use `action: 'questions'` with the field and optional matching single-field scope. It returns localized optional questions without inference. A later explicit field request can submit `answers: [{ id: field, answer: '…' }]`. Section-only requests reject a website URL and use authorized persisted context, including short still-current accepted citations. A section or field result stays a draft until the existing individual or atomic bulk confirmation.

The v1 envelope, 13 field contracts, legacy classification values and field provenance remain compatible. Read additive `fields[key].outcome` for rendering and use the shared plan for acceptance eligibility. The no-change outcomes use the existing non-adoptable legacy classification and are excluded from `missingFields`. An earlier `reason: 'unchanged'` also renders as unchanged. Use `qualityIssues` for per-field reasons, `questions` for relevant blank targets, and `unsupportedFields` for specialized Founder and DNA owners.

## Regression coverage

The new API check exercises empty and partially completed profiles, identical and meaningfully improved drafts, a good saved value with no improvement, unsupported changes, mixed-language guidelines, accepted citations, questions and scoped requests. The new browser check reproduces the website scenario on the merged base and verifies all 13 R1 outcomes, counters, retained acceptance, safe correction, deliberate review and reload in the application. Existing BW-46 and BW-47 checks cover EN/DE, full website requests with adoptable partial results, typed proposal editing, individual and bulk acceptance, save/reload/edit-again, Brand permissions, stale revisions, Founder/DNA dependencies, campaign snapshot isolation and source policy. Both new checks are registered in Runtime Boot Safety for the PostgreSQL 17.6 / 18.4 matrix.

## Local Runtime Boot Safety

The local replay uses the workflow's shell blocks with fail-fast and pipefail within each block. Later blocks continue after a failure so the ledger retains all outcomes. The two setup blocks use supplied npm dependencies and system Chromium 151. The databases are disposable, isolated instances of the official PostgreSQL 17.6 Debian and 18.4 Alpine images. The independent hosted workflow installs its dependencies and browser.

The BW-43 Expanded Journey sources reflow assertion fails on this branch and the exact `8c765bc` base in the same local Chromium at `scripts/check-bw43-insights-browser.js:135`. The native 200% zoom command passes separately on both replay checkouts.

Both versions passed the final isolated R3 standard (57 groups), completed upgrade (66 groups plus 74 installer and protection groups) and restrictive graph (55 groups) checks. An early 17.6 attempt retained the older private brief alongside the accepted citations and correctly failed the existing pruning assertion. The production change retains the acceptance and citations while pruning the superseded brief. The unchanged assertions pass after that correction. Two 18.4 replay steps that require Git's tracked-file inventory passed when rerun from the actual Git worktree.

| Runtime workflow accounting | PostgreSQL 17.6 | PostgreSQL 18.4 |
| --- | ---: | ---: |
| Original run blocks attempted in the first replay | 234 | 234 |
| Passing executable blocks in the first replay | 228 | 228 |
| Failing executable blocks in the first replay | 4 | 4 |
| Supplied setup equivalents | 2 | 2 |
| Passing executable blocks after retests, including the new R1 block | 232 | 232 |
| Remaining unchanged-base BW-43 reflow failure | 1 | 1 |

The 17.6 conversational Advisor run initially timed out at its Create button. The same unchanged check passed serially. The 18.4 Home Campaign Insights run initially exceeded its 1,000 ms first-render assertion by 16.4 ms and passed all 31 groups serially. The initial failures remain visible in the replay ledger. All 15 focused BW-46 and BW-47 regression scripts passed. The added R1 workflow block also passed in the final validation for each matrix entry. All inference in the enrichment checks was mocked.
