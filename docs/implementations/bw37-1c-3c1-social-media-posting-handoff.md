# BW-37.1C-3C1 — AI Brain to native Social Media Posting

Base: latest merged main `ea8924114748690b46ce3a4f6fc76d1a733ccf60`, including #831, verified on 2026-10-28 (Europe/Berlin). A read of the connected GitHub source established the base while sandbox network access was unavailable; a subsequent elevated Git fetch verified the exact commit and matching tree before delivery. No merge or manual deployment.

## Verified native contract and ownership

Canvas owns node construction, rendering, Inspector editing, history and dirty/autosave signaling. Boards owns persistence and remote permissions. Brain retains only ephemeral source/proposal state. Brand remains independently protected. The existing native type identifier is exactly `Social Media Posting`, not the legacy projection alias `Social Media Post`.

| Native field | Contract and handoff mapping |
| --- | --- |
| `type` | `Social Media Posting` |
| `title` | Editable source heading; 1–120 characters |
| `social.platform`, `channel` | Same native identifier: `Instagram`, `X / Twitter`, `LinkedIn`, `Facebook`, or `TikTok` |
| `social.caption` | Labelled Caption/Tweet/Post/Text/Beitrag/Bildunterschrift; required at Create; bounded to 4,000 characters |
| `social.preview` | Existing CTA text, not an image preview; empty when absent; handoff bound 1,000 characters |
| `social.hashtags` | Native string array, using existing `normalizeHashtagsInput` on the editable source hashtag text; empty array when absent; input bound 1,000 characters |
| `content` | Optional native content mirror populated with the edited caption |
| `status` | Existing constructor default `Draft` |
| `social.scheduledAt` | Existing empty-string default; no `planningSchedule`, publication, approval or fingerprint is created |
| `images`, `favoriteImageId`, `imagePrompt` | Existing empty array, null, empty string defaults; no generated or attached image |

Native Social cards and Inspector support LinkedIn, Facebook, X/Twitter, Instagram and TikTok. Caption warning thresholds are respectively 3,000, 63,206, 280, 2,200 and 2,200 characters. These are warnings, not automatic truncation or publication guarantees. The handoff's 4,000-character caption ceiling is a bounded conversion limit, not a change to the native editor. Existing platform selection synchronizes `social.platform` and `channel`. Inspector and card caption, CTA and hashtag editors retain their existing behavior and approval invalidation owners.

`createNode` initializes the native Social fields before insertion and rendering. This matters for a renderer failure after insertion: duplicate recovery sees the correct Social material. Existing parent-based creation can inherit audience, goal, channel and parent images; this handoff creates a root with no parent or edges and empty images. Its explicit platform supersedes the constructor's Instagram default. Unknown/ambiguous platforms remain empty in preview and block Create until explicitly selected.

`applyGeneratedCampaignNodePayload` is the existing Campaign V3 Social adapter: it maps platform/channel, caption/content, description to CTA/preview and normalizes/generated-fallback hashtags. Calling that generation adapter directly would invent fallback material for a source transfer. The handoff instead uses a narrowly validated native constructor initializer and the existing hashtag normalizer. Campaign V3 is unchanged.

`pushHistorySnapshot` captures native nodes before insertion. `markUnsaved` schedules existing autosave. `serializeState` passes native nodes through `sanitizeNodeForPersistence`, retaining type/channel/social; Board save/reload owners remain unchanged. Browser tests inspect the actual PUT payload and loaded Board state. Canvas currently exposes a five-entry undo history and no redo UI/handler; this feature preserves that existing limitation.

## Before and after

Previously every selected AI Brain asset could only be converted into Content. Instagram and X assets now recommend Social Media Posting in the same compact modal, before Prepare. Other reusable concepts and uncertain-platform drafts keep Content. The user can choose either implemented destination; no unimplemented types appear.

Selecting/switching cards resets the recommendation for that exact asset without carrying fields or edits across assets. Explicit Prepare for Social extracts labelled fields deterministically into an editable native preview. The exact selected source remains separately expandable. The preview explains that populated labelled fields come from source, no fields are inferred, and missing fields stay empty. Title, platform and caption are required at Create; CTA and hashtags remain optional. Unsupported or ambiguous platform names never fall through to Instagram. The preview allows explicit platform selection from the existing five values.

Explicit Create rechecks current source and remote permission/scope, then creates exactly one native Social node with the user's edited values and existing Canvas lifecycle. The modal closes through the existing navigation owner; the resulting node is selected, revealed and editable in the Social Inspector. Content remains available and retains its existing provider/schema/edit/create behavior.

## Conversion, cost and security

The new `propose_social_node` action is accepted only through the existing exact bounded proposal envelope and signed handler. A shared bounded browser/server helper extracts only source-labelled fields. It supports existing Appics Markdown heading variants, CRLF and EN/DE field labels. A repeated field label is rejected as ambiguous; unlabelled fields are left empty rather than guessed. Extracted line endings normalize to LF and outer field whitespace is trimmed. The separate source reference and outbound selected span retain the existing exact original source contract; the server's existing source trimming boundary is unchanged.

Social Prepare makes **zero provider calls**. Content Prepare retains its single explicit source-only Responses call, unchanged strict Content schema/model, `store:false`, 25-second complete transport deadline and output byte/field limits. There are no automatic classifiers, generation, retries or repairs. Opening, selecting, editing, cancelling and Create cause no inference. No real paid provider was used for validation.

Both actions retain authoritative Board access, active identity/Workspace membership and persisted association checks, independent canonical Brand protection, expected scope comparison, and revalidation at conversion boundaries. Board-only editors need no canonical Brand permission. No canonical content, Learning or Canvas snapshot is retrieved for inference. Browser intent stays bound to the original successful turn/question/answer, account object, Board/load/revision, Workspace/catalog, association and local Canvas. A new Prepare cannot silently rebase an old source.

Create uses the existing fresh `content-scope` read and checks source/controller/data again after await. Duplicate proposal consumption precedes insertion. Pre-insertion failure restores history/consumption; partial insertion stays consumed and reveals the existing native node. This does not remove the existing remote-read-to-save race, provide durable transcript provenance or cross-tab idempotency, or change the optional/non-atomic legacy Board revision protocol.

## Validation and review

`check:bw37.1c3c1` uses the actual signed route and real ACL/scope owners with projection-aware fictional SQL transport, plus the production browser controllers and native cards/Inspector/save/reload with mocked transport. It covers all three existing Appics source variants for both independent assets, extracted fields and edits, exact sources, zero provider calls, required/optional fields, unknown/ambiguous platforms, Content fallback, bounds/inert hostile text, Board-only editors and unauthorized actors, pre/post scope changes, stale source/account/Board/Workspace/load, remote revocation and in-flight races, duplicates, pre-/post-insertion failures, history/undo, autosave wiring, PUT and reload, EN/DE, desktop/mobile, Light/Dark, keyboard and Escape. Mocked persistence does not stand in for a real PostgreSQL integration pass; the full registered Runtime Boot Safety matrix separately covers PostgreSQL 17.6 and 18.4.

Existing `check:bw37.1c3b` explicitly chooses Content in the Appics cases to retain its full Content regression assertions. The BW-26.6 static creation guard follows the validated destination while retaining unchanged Content schema negatives and one-create/one-history requirements. Actual Social behavior is tested separately. The BW-26.6.2 success announcement remains unchanged for Content and gains a native Social announcement.

Focused Social, Content, security, BW-26/28/36/37, Profile/Campaign Creator, localization, syntax and 48-script integrity checks are run locally. Full CI conclusions and any PR review findings are reported against the final PR head rather than represented as local results. Initial sandbox Chromium launch failed at local socket creation; the suites run with elevated local execution. Two old static BW-26 assertions initially expected a Content-only call spelling/success announcement; the destination assertion was updated and Content's announcement call preserved. A new browser mock initially echoed English for German requests; the fixture now echoes the actual request language. No checks were skipped or weakened to conceal those failures.

Codex implementation review checks native initialization before render, exact platform identifiers, optional fields, source isolation, bounds, source-only inference behavior and all three authorization/freshness boundaries. Independent automated PR review status is distinct and reported in the delivery; an absent review is not a clean-review claim.

## Changed files

- `.github/workflows/runtime-boot-safety.yml`
- `ai-brain-social-proposal.js`
- `api/ai-brain/propose-node.js`
- `app.js`
- `index.html`
- `package.json`
- `scripts/check-bw26-6-controlled-ai-brain-node-creation.js`
- `scripts/check-bw37-1c-3b-content-browser.js`
- `scripts/check-bw37-1c-3c1-social-handoff.js`
- `scripts/check-bw37-1c-3c1-social-browser.js`
- `docs/README.md`
- This implementation record

## Limits

Deterministic extraction deliberately does not infer missing CTA, hashtags, caption or platform. Unlabelled drafts may require manual field entry; oversized or repeated labelled fields require Content/manual review. Other supported platforms are selectable, but only clearly identified Instagram/X recommend Social by default. No new types, provider schema, generation architecture, publishing, scheduling, approval, image workflow, migrations, RLS/TLS or production configuration changes. Automated Chromium coverage is not a manual screen-reader or every-browser audit. Existing Canvas redo and remote persistence race limitations remain.
