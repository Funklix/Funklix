# A8 Founder Story Website Import

**Date:** 2026-07-27
**Status:** Implemented for review

## 1. Objective

A8 adds the smallest reviewed, evidence-constrained public-website import to the existing Founder Story editor. Retrieval and AI mapping never mutate state. Only the user's explicit selection and Apply action can update existing structured Founder Story fields.

## 2. A6 and A7 contracts read

Implementation read `docs/audits/A6-founder-story-website-import-architecture-audit.md` in full and reused the merged A7 `api/extract-website-text.js` route and its `_website-url-policy.js`, `_website-retrieval.js`, and `_html-text-extractor.js` security boundary. A8 does not retrieve external sites in the browser or duplicate URL, DNS, redirect, transport, size, content-type, or extraction controls.

## 3. Exact seven-field contract

The keys confirmed from `app.js` `FOUNDER_STORY_FIELD_DEFINITIONS` are `founderNameRole`, `observedProblem`, `motivation`, `turningPoint`, `background`, `proofPoints`, and `vision`. `api/map-founder-story-website.js` `FIELD_KEYS` and its strict JSON schema use exactly the same keys. Each key owns `{ value, evidence }`; no narrative or graph output is permitted.

## 4. UI entry point

`renderFounderStoryCustomTileEditor()` adds `#brand-core-founder-story-website-import-button` beside the source-fact generation action. `openFounderStoryWebsiteImport()` creates a Founder Story-specific modal using the existing `brand-confirm-modal`/`brand-confirm-card` styling conventions. It includes the public-page/AI/review disclosure, one URL input, loading and safe error states, keyboard Escape, close, Cancel, backdrop dismissal, focus restoration, editable proposals, evidence, selection controls, and explicit Apply. No existing ID or control was removed or renamed.

## 5. A7 endpoint usage

`startFounderStoryWebsiteImport()` sends `{ url }` to `/api/extract-website-text`. It consumes only A7's bounded `source.title` and `content.text`, then drops them when the async controller call ends. Stable A7 codes are mapped through `FOUNDER_STORY_IMPORT_ERROR_MESSAGES`; internal network details are not displayed.

## 6. AI mapping route and prompt responsibility

`api/map-founder-story-website.js` is an authenticated POST-only route using `getSessionUser()` and the repository's server-side OpenAI Responses API convention. It accepts only optional bounded `title` and required bounded `text`, makes exactly one provider request, and does not accept Board, tile, Brand Brain, Brand DNA, Missing Knowledge, cookies, URL, HTML, or diagnostics as mapping input.

`buildPrompt()` provides extraction/grounding rules; the webpage title and text appear only inside clearly marked untrusted delimiters in the user message. `responseSchema()` constrains provider output. `validateMapping()` validates again before returning a sanitized draft; raw provider output is never returned.

## 7. Request and response contracts

Mapping request: `{ "title": "bounded extracted title", "text": "bounded extracted text" }`. Mapping success: `{ "success": true, "fields": { <seven exact keys>: { "value": string, "evidence": string } } }`. Values are capped at 1,600 characters and evidence at 300 characters. Unknown/missing keys, malformed shapes, extra properties, and overlong strings fail closed. Unsupported entries normalize to empty pairs.

## 8. Prompt-injection controls

The system message declares webpage content untrusted data. `buildPrompt()` states that page instructions have no authority; embedded prompts, scripts, comments, role labels, and policy text must be ignored; format-changing and secret/system-prompt disclosure requests must be ignored; general knowledge and unsupported marketing claims cannot fill gaps; and unsupported fields remain empty. Source content is never interpolated into the system message.

## 9. Evidence validation

Every non-empty value requires non-empty evidence. `validateMapping()` requires evidence to occur literally in the submitted extracted text and clears unsupported pairs; the independent browser `validateFounderStoryWebsiteImportFields()` repeats shape, cap, and literal-occurrence validation. Evidence is displayed only in the review modal and is never passed to `saveFounderStoryModuleData()`.

## 10. Draft-state ownership

`activeFounderStoryWebsiteImport` points to one narrow runtime controller. The controller closure owns the exact tile object/id, Board identity, runtime token, modal, focus return target, AbortController, and reviewed draft. It is not part of `state`. `closeFounderStoryWebsiteImport()` aborts work, invalidates/removes the surface, clears draft/controller references, and restores focus.

## 11. Review and selection behavior

`renderFounderStoryWebsiteImportReview()` shows current value, editable proposal, literal excerpt, and checkbox for each supported proposal. Supported fields whose current value is empty start selected; fields with current content start deselected. Empty edits are immediately deselected and cannot apply. No supported results produces an unchanged-data message.

## 12. Apply path

The Apply listener re-runs `assertFounderStoryWebsiteImportContext()`, allowlists selected draft keys, excludes empty values, merges only selected values into the latest seven-field object, and calls the existing `saveFounderStoryModuleData(tile, next)` helper. It does not assign `tile.content`, invoke generation, or accept a narrative.

## 13. Autosave path

After the existing field-update helper, Apply calls the same `saveBrandBrainState()` path used by manual Founder Story field inputs, once, then refreshes existing tile/editor rendering. There is no route-side or parallel persistence path.

## 14. Cancellation behavior

Cancel, close, Escape, backdrop dismissal, abort, retrieval/mapping errors, malformed output, no supported data, and stale/superseded responses do not call either field update or autosave. Closing aborts pending fetches and removes the scoped DOM and its listeners.

## 15. Tile and Board identity protection

`assertFounderStoryWebsiteImportContext()` requires the active controller/token/surface, unchanged active Board id, stable tile id, original tile object reference, tile presence, and `founder_story` typed identity. It runs before async work, after extraction, after mapping, before review, and immediately before Apply. A new import closes/aborts the previous controller; `inFlight` blocks duplicate starts. Thus Board changes, deletion, replacement, dismissal, and stale responses cannot apply to another instance.

## 16. Persistence exclusions

Before Apply there are no Board, tile, `moduleData`, `tile.content`, localStorage/sessionStorage, autosave, Brand Brain, Brand DNA, Missing Knowledge, readiness, schema, migration, history, or provenance writes. After Apply only explicitly selected structured values enter `moduleData.founderStory` through the existing path. URL, text, evidence, token, and draft never enter that path.

## 17. Privacy and logging behavior

The browser sends the submitted URL only to A7. The mapping route receives no URL, authentication data, Board/tile identity, raw HTML, redirect/DNS information, or unrelated state. Neither route logs request bodies, source text, evidence, prompts, raw model output, or URL/query data. The mapping route logs only a stable event and error class name on unexpected failure.

## 18. Files changed

- `api/map-founder-story-website.js`
- `app.js`
- `styles.css`
- `scripts/check-founder-story-website-mapping.js`
- `scripts/check-founder-story-website-import-lifecycle.js`
- `docs/phases/A8-founder-story-website-import.md`

No dependency, schema, or migration was added.

## 19. Tests executed

The focused mapping and lifecycle checks, all four A7 checks, Founder Story/A5 context, browser globals, script integrity, registry, dependency engine, A4 preflight, Campaign V3 harness, Node syntax checks, and `git diff --check` passed on 2026-07-27. Tests use local provider/route fixtures and make no real website or AI request. Exact commands are preserved in the pull request and final implementation report.

## 20. Compatibility confirmation

A3 readiness, A4 preflight, A5 `founderStoryContext`, A7 retrieval/extraction, Brand DNA, Brand Brain shape, Missing Knowledge, existing Boards, legacy title-only tiles, Custom Tiles, and `tile.content` semantics are unchanged. Manual Founder Story editing and existing narrative generation, review, and acceptance remain on their original controls and paths.

## 21. Remaining limitations

- Import supports one server-rendered public HTML/XHTML page per attempt; it does not crawl or execute JavaScript and does not support private/paywalled pages, documents, PDFs, or social sources.
- Literal evidence membership and boundedness are deterministic. Whether an excerpt semantically supports a field is instructed to the model and remains a user review decision; A8 intentionally adds no second AI request or confidence score.
- No browser engine is installed in the repository environment, so automated programmatic checks replaced screenshot/manual browser interaction in this implementation session.

## 22. Recommended next phase

**A9: Founder Story Website Import usability and production-observability validation.** Validate the reviewed A8 flow in the deployed authenticated browser environment with privacy-safe aggregate route outcomes (never URLs/content), accessibility/focus testing, and controlled provider-quality fixtures. Do not add crawling, persistent provenance, or automatic narrative acceptance.

Future phases must explicitly read both `docs/audits/A6-founder-story-website-import-architecture-audit.md` and this document.
