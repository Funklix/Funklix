# BW-37.1C-3C1-R1 — Social reliability and response actions

Base: latest merged main `7ddcd8f6b2c5bf1e134f3d93169d2985e71c8986`, including #832, verified through the connected GitHub branch endpoint and Git fetch on 2026-10-28 (Europe/Berlin). One normal PR; no merge or manual deployment.

## Evidence and diagnosis

The supplied report describes a request for Instagram and X but contains neither the full latest successful live answer nor its provider payload, browser state, deployed version or production logs. The earlier checked-in Appics response is a complete two-post fixture from a previous report; it is **not evidence of the latest incident's answer**. No production completeness or deployment claim follows from it.

A distinct deterministic defect was verified in `api/ai-brain/advice.js`: absent a top-level `output_text` aggregate, the Responses fallback used `.find(type === 'output_text')`. Given a valid assistant message containing Instagram in one content block and X in a later block, the old server returned only Instagram. A replay of the original function prints `provider includes X: true; returned answer includes X: false`. The same defect occurs across multiple assistant output messages. This loss occurs before candidate extraction.

The fix assembles all assistant `output_text` strings in order, matching the Responses aggregate's concatenation semantics. It adds no separators or invented content, excludes reasoning/tool/user data, retains top-level aggregate precedence and the existing trim/12,000-character boundary. No extraction, model, prompt, token budget, response schema, authorization, retry or provider-call changes. Advice instructions were inspected: the question remains the last user input after bounded history, and existing instructions allow drafting proposed copy. Model omission was not established, so no speculative prompt rewrite was made.

| Chain / hypothesis | Deterministic evidence | Latest live incident |
| --- | --- | --- |
| Request + history | Actual Advice handler receives explicit Instagram + X request and prior exchange; provider input retains both | Only reported request available |
| Provider complete, server incomplete | Two text blocks / two assistant messages reproduce first-block loss on base; fixed handler returns both exactly | Provider envelope unavailable |
| A: model generates only one | One-post mocked provider output passes unchanged; browser has exactly one candidate | Cannot determine actual model completeness |
| B: browser detection drops X | Complete assembled Appics answer produces two exact disjoint spans; existing Markdown/CRLF variants also pass | Full answer unavailable; unsupported format cannot be ruled out |
| C: state transfer loses X | `turn.answer`, captured source answer, extracted candidates and selected dialog source match handler answer/spans | No production browser state |
| D: rendering loses X | Two cards render for complete fixtures; switching each selects its exact span and Social recommendation | Screenshot alone does not establish earlier candidate count |
| E: deployed/source mismatch | Local source and PR base match merged #832 | No live build identifier or page URL supplied; cannot verify deployed code |

The new regression invokes the actual Advice route with real fixture ACL/context owners and mocked provider transport, then replays those exact returned answers through the production browser controllers. It does not call a paid model or represent fixture output as live evidence. The full incident remains unattributed pending the missing live artifacts. The confirmed code defect is independently actionable.

## Presentation changes

Previously Add to Canvas used `insertBefore(..., advisorLabel.nextSibling)` and therefore preceded the answer heading. All existing qualifying actions now share a wrapping response-actions area after the entire formatted answer, disclosures, assumptions and meta. Create Campaign and Suggest Brand Update retain their owners and labels. When all three qualify, Add to Canvas retains the existing compact More actions disclosure. There is one action per eligible route. Buttons, native details, focus restoration and mobile wrapping remain keyboard accessible.

The dialog no longer appends a second unformatted selected-source paragraph under the cards. Cards retain concise plain-text previews; presentation strips supported headings, bold, code and Markdown links while preserving actual hashtags. All text still enters through `textContent`; there is no HTML interpretation. The separate initially collapsed Exact original source section retains the original selected substring, including Markdown and line endings. Editable fields, destination selector and explicit Prepare/Create are unchanged.

## Verification

- New `check:bw37.1c3c1r1`: complete multi-block/multi-message responses, aggregate precedence, reasoning/tool exclusion, genuinely incomplete output, request/history and one `store:false` provider call, unchanged 4,096 output-token budget; browser successful answer/source binding, detection, card transfer/render, exact selection and no fabricated X; footer route combinations; concise inert preview and preserved hashtags; keyboard entry/Escape/focus return; 320/375/1440 widths and Light/Dark.
- Existing `check:bw37.1c3c1`: native Social field mappings, both posts and formats, edits, source isolation, zero Social inference, Content fallback, authorization/stale/cancellation/race cases, duplicates/partial insertion, history/undo/autosave/save/reload and responsive accessibility.
- Existing Content, Profile/Campaign, BW-26/28/36/37 regressions and full Runtime Boot Safety results are reported against the PR head. The new regression is registered in both PostgreSQL 17.6 and 18.4 CI jobs.
- Implementation review: extraction remains unchanged; aggregation preserves provider ordering without duplication; exact sources remain separate from shortened inert display; no creation/ACL/persistence owner changes. Independent automated Codex review status is reported separately in delivery; absence of findings is not approval.

## Exact changed files

- `.github/workflows/runtime-boot-safety.yml`
- `ai-brain-content-review.css`
- `api/ai-brain/advice.js`
- `app.js`
- `package.json`
- `scripts/fixtures/bw36-20-database.js` (optional mocked structured provider response)
- `scripts/check-bw37-1c-3c1-r1-reliability.js`
- `docs/README.md`
- This implementation record

## Remaining limits

Language-model completeness cannot be guaranteed. A genuinely missing post remains missing. Existing recognition thresholds and unsupported formats, the 12,000-character answer cap and outer trimming are unchanged. No automatic retry, repair or extra inference was added. The latest live answer and deployed source version are unavailable, so this PR does not assert that the verified assembly defect caused that screenshot. Browser transport is mocked; PostgreSQL CI separately exercises the real runtime/database matrix. Automated keyboard/Chromium tests are not a manual screen-reader audit. Existing remote-save races, lack of durable transcript provenance and Canvas undo-only behavior remain.
