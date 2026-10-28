# BW-37.1C-3B-R2 — Compact Content handoff

Base: `7d219a74fd60a6dc4767583e464d7d932228d9dc`, fetched latest merged main including #830. No merge or manual deployment.

## Investigation and evidence limits

Before editing, replaying #830's recorded Appics response against current main returned both exact, disjoint Instagram and X spans. The initial workspace checkout was older (`f79f78d`, before #830); it was replaced by a dedicated branch from fetched main before implementation. GitHub confirms #830 merged at 2026-10-28 00:09:33 UTC. The initial stale local checkout is not evidence about the user's deployed frontend.

The production browser fixture traces the entire Advice response into `turn.answer`, `contentProposalSource.answer`, deterministic extraction, review state, card rendering, exact selection validation, source-only proposal request, editable preview and existing Create owner. Both sources survive these boundaries. Server tests exercise the signed source envelope and independent authorization checks. These results do not reproduce the new live missing-X report on current main.

**The new live root cause and deployed/cached frontend version remain unverified.** The retest's app URL, actual answer and browser state were not supplied; they were requested during implementation. The available GitHub API access also rejects deployment listing. No cache invalidation or speculative extractor modification is included. Repository HTML loads `/app.js` without a version query, but this alone does not prove a stale production asset. A deployed-asset comparison and replay of the actual retest answer remain necessary before claiming that failure is resolved.

A separate UI failure was reproduced in Chromium at 320px/640px: Jump to latest intercepted clicks on Add to Canvas. The entry action now appears near the start of the answer, and short mobile screens give Jump a separate row. This is a verified handoff usability cause, not proof of why X was missing.

## Experience and contracts

Before: native select plus a full raw source inside the transcript; preparation and editable preview actions require conversation scrolling.

After: Add to Canvas opens a native modal with the destination Board and Content type, accessible radio cards with recognizable titles and short excerpts, a concise selected preview, and collapsed exact original source. Prepare and Cancel occupy a footer outside the scrollable body. Explicit preparation keeps the same modal flow for editable title/body and Create/Cancel. Preparing also stays in the modal with a cancel action. The browser top layer makes the composer and Jump inert behind the handoff. Escape and Cancel return focus to Add to Canvas; navigation and identity reset close the modal before Inspector focus is restored. Only one Content handoff can be active.

Display shortening does not modify any stored source. Each selection retains its original `start`, `end`, and `text`; switching cards performs neither inference nor scope reads. Prepare makes the existing single explicit provider request. Create uses the existing remote scope revalidation and Canvas creation/history/undo/autosave owners. Provider security, `store:false`, independent canonical Brand protections, schemas, authorization and source freshness checks are unchanged. No new calls, migrations or automatic writes. Campaign Creator and Brand Profile owners are unchanged.

All provider/user text is assigned through textContent or input values. Native modal focus containment and existing theme tokens are used. The exact source is accessible on demand rather than filling the initial viewport.

## Tests and review

`npm run check:bw37.1c3b` includes recorded Appics and labelled format variants (bold headings, six-level native fields, CRLF, escaped internal separator and trailing source metadata), each traversing both independent selections in the production shell. Original eligibility negatives, endpoint authorization/revocation, stale identity/Board/Workspace/source, duplicate creation, partial insertion, history, undo and save/reload assertions remain.

Added browser assertions cover card titles and switching, radio arrow keys, no inference/scope read on selection, exact expandable source, single explicit inference, EN/DE, light/dark, 320/375/1440px, short mobile heights, modal bounds, contained scrolling, stationary footer, top-layer pointer hit testing, keyboard focus containment and restoration. Existing edit validation, inert hostile text and composer draft/mode/caret/scroll assertions remain active. Format variants are explicitly derived from the earlier capture; they are not represented as the missing retest capture.

Focused suites, applicable BW-26/28/36/37 regressions and full Runtime Boot Safety PostgreSQL 17.6/18.4 results are reported against the PR head in its description. Pending checks are not passes. Codex implementation review focuses on lifecycle cleanup, safe rendering, exact source binding and unchanged authorization/inference boundaries; an independent review must be identified separately if obtained.

## Changed files

- `app.js`
- `ai-brain-content-review.css`
- `scripts/check-bw37-1c-3b-content-browser.js`
- `scripts/fixtures/bw37-1c3b-r2-appics-markdown.js`
- `docs/implementations/bw37-1c-3b-r2-compact-content-handoff.md`
- `docs/README.md`

## Remaining limits

The post-#830 live report requires its exact source and deployment/browser evidence. The extractor deliberately retains #830's bounded deterministic eligibility and syntax limitations. Existing server source normalization and scope-read/save race limitations also remain. Automated Chromium checks cover the listed layouts and keyboard behavior; they do not constitute a manual screen-reader audit or testing every mobile browser.
