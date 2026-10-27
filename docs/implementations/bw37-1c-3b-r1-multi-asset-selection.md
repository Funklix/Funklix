# BW-37.1C-3B-R1 — Multi-asset Content selection

Base: `f79f78d978680ad4de1e17c79c45de36a882e685`, latest fetched merged main including #829, verified 2026-10-27 (Europe/Berlin). Continues the existing Content-only extraction and proposal workflow from [package B](./bw37-1c-3b-content-eligibility-editable-preview.md).

## Reproduction and verified root cause

Before editing, a VM probe of the actual production extractor replayed the exact live Appics response preserved in `scripts/fixtures/bw37-1c3b-r1-appics-response.txt`. It returned **one** candidate: Instagram, offsets `[134, 683)`, including the intervening Markdown separator. `Instagram Post` matched an asset start; `X Post` did not. The generic Markdown heading boundary nevertheless stopped Instagram at X, so X was excluded rather than merged into Instagram. This is the direct cause of the missing selection.

The independent structured validator also stripped only heading levels 1–4 and omitted `Tweet` as a copy field. Instagram survived its level-5 heading through the natural-copy fallback. Adding X alone would make this particular action-rich response pass but leave the structured Tweet path and higher-level headings inconsistent. A Markdown `Hashtags:` heading was also absent from the native-field boundary allowlist and could truncate its own post.

## Change and resulting behavior

The existing deterministic extractor recognizes X/Twitter post and EN/DE platform labels consistently at asset-start and structured-validation boundaries. Structured validation strips all six heading levels and accepts Tweet alongside Caption. Tweet and Hashtags headings remain inside their asset, together with CTA and multiple paragraphs. Known explicitly labelled trailing AI metadata bounds the excerpt. A terminal Markdown separator and its surrounding framing whitespace are excluded; internal separators remain untouched. All returned text still comes directly from original answer offsets, without rebuilding or normalizing the selected source.

After the fix, the exact fixture returns **two** candidates: Instagram Post and X Post. Each includes only its complete caption/tweet, CTA and hashtags. Introductory prose and the separating rule are excluded. Selection names continue to use the original heading through the existing UI owner. No new candidate schema or selection UI is needed. Explicit labelled asset boundaries continue to take precedence over internal testimonial quotes; unlabelled and ambiguous-response rules otherwise retain their existing behavior.

## Regression coverage and validation

The existing focused commands automatically include R1, so the complete Runtime Boot Safety workflow runs the new cases in both its PostgreSQL 17.6 and 18.4 jobs without changing the workflow:

- `npm run check:bw37.1c3b`: exact Appics fixture, exactly two disjoint eligible spans, complete correct copy/CTA/hashtags, names, all six heading levels, EN/DE labels, CRLF, structured Tweet acceptance without action-keyword fallback, trailing metadata, internal testimonials/separators, single and ambiguous answers, and existing negative/legacy/unlabelled cases.
- The real browser shell replays both selections independently, checks source equality and existing source validation, zero inference when opening/switching, one explicit proposal request per preparation, editable Content preview, no creation before Create, exactly one node/history snapshot after duplicate Create attempts, source isolation and undo. Existing freshness/permission/cancel/race, Inspector, pending-save/confirmed-save/reload and responsive UI cases remain active.
- `npm run check:bw37.1c3a`: both selected spans also traverse the actual signed proposal handler and real scope/ACL owners with mocked provider transport, asserting one source-only `store:false` call each. The existing server normalizer trims supplied source at its established boundary; browser excerpt and submitted request retain the exact original span. Existing authorization, privacy, transport/deadline, duplicate and partial-insertion tests remain active.

Final focused/local regression results, the complete CI matrix and automated Codex review status are reported on the delivery PR; pending checks are not counted as passes.

## Scope and limitations

Production changes are confined to `aiBrainContentAssets` in `app.js`. No endpoint, model, paid inference, node schema, Canvas/Inspector/creation/persistence owner, permissions, conversation ownership, Campaign Creator or Brand Profile behavior changes. No migration, RLS/TLS, merge or deployment.

Recognition remains bounded deterministic syntax and copy heuristics. Arbitrary platform names, unusual prose and unlabelled trailing commentary cannot always be distinguished safely; factual quality is outside extraction. This patch does not introduce semantic classification or broaden the supported destination beyond Content. Existing source freshness, scope-read/save race limits and proposal normalization remain as documented in package B.

## Exact changed files

- `app.js`
- `scripts/fixtures/bw37-1c3b-r1-appics-response.txt`
- `scripts/check-bw37-1c-3b-content-eligibility.js`
- `scripts/check-bw37-1c-3b-content-browser.js`
- `scripts/check-bw37-1c-3a-content-proposal-security.js`
- `docs/implementations/bw37-1c-3b-r1-multi-asset-selection.md`
- `docs/README.md`
