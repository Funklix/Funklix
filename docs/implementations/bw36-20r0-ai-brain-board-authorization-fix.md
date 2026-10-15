# BW-36.20R0 — AI Brain Advice Board authorization repair

Date: 2026-10-15. Base: latest merged `main`, `c90e77e56675aa20195846bef2cf2193f0ba43aa` (PR #776).

## Confirmed defect

The [architecture audit](../audits/bw36-20-approved-learning-ai-brain-integration-audit.md) identified an unsafe composition between `api/ai-brain/advice.js` and the real `getBoardAccess` helper in `api/_board-access.js`. Advice requested Board context without `owner_id` or `owner_email`. The helper uses those fields to recognize owners and distinguish owned Boards from genuinely unowned Boards. With both fields absent, it assigned an unrelated signed-in identity the `unowned` role with `canEdit: true`, before querying Board or Brand membership.

The new regression executes the real route and both real access helpers. Its database transport fixture parses the actual Board SELECT projection and returns only selected fields. Running the pre-fix projection and authorization gate against a stored private owned Board reproduces HTTP 200, role `unowned`, one Board query, and one **stubbed** provider invocation for an unrelated identity. A fixture returning the complete stored Board regardless of SELECT would conceal this defect.

## Exact correction and boundaries

Advice now selects `owner_id` and `owner_email` with its existing Board fields. It also requires both ownership properties to be present and each value to be either SQL-null or a string. An incomplete or malformed projection returns the existing generic HTTP 500 failure before provider dispatch. This check is local to Advice: it does not change shared ownership semantics. Null and legacy empty-string ownership still follow the helper's existing genuinely unowned rule.

The existing `canEdit` gate continues to reject unrelated signed-in identities and Board/Brand viewers with HTTP 403. Anonymous requests return HTTP 401 before Board lookup. Public viewing does not grant Advice authority. Owner matching by session ID or normalized email, invited Board editors, Brand owner/admin/editor authority, and Brand viewer membership combined with independent Board editor authority retain their existing permissions.

Ownership columns remain server authorization data. Provider context still uses the explicit Board `{ id, name, updatedAt }` projection; neither ownership keys nor values are included. Both successful Advice and deterministic clarification response paths preserve their existing response projections. Tests check serialized provider requests and client responses for ownership keys and sentinel values.

Canonical Brand access still runs independently through the real `getBrandAccess`. A Board editor without Brand membership receives Board snapshot context and no canonical Brand Core. Brand viewers receive canonical context only when they also have Board edit authority. Prompts, provider configuration, Canvas serialization, UI, Learning lifecycle, quotas and unrelated access consumers are unchanged. No approved-Learning retrieval is implemented.

## Regression evidence

`node scripts/check-bw36-20r0-ai-brain-board-authorization.js` passes:

- 17 ACL cases: owner by ID, owner by normalized email, Board editor, unrelated identity, null/legacy-empty unowned Boards, ID-only/email-only owned Boards, Board viewer, Brand owner/admin/editor, Brand viewer without/with Board editor authority, unrelated Brand identity, anonymous public-enabled and anonymous unowned Boards.
- 11 invalid projections: each ownership field omitted or returned with number, boolean, object or array values, plus both fields omitted. All fail before any provider invocation, including the shared helper's remaining `unowned` classification for both absent fields.
- Zero unauthorized provider calls, one stubbed call for permitted ordinary Advice, and zero calls for deterministic follow-up clarification and invalid Canvas.
- Existing saved snapshot, working Canvas/selection, canonical isolation, model, current question, answer and disclaimer behavior; ownership keys/values absent from provider and client payloads. Fixture SQL is SELECT-only.

Focused checks: **15/15 passed**, comprising the new regression, BW-16 session verification, BW-18 Board roles, BW-19 private/public sharing, BW-20 Brand team roles and all ten existing BW-26 AI Brain regression scripts. Four existing Advice fixtures now explicitly include null ownership properties; all existing assertions remain intact. The new regression is registered in Runtime Boot Safety immediately after the existing read-only Advice check.

Full Runtime Boot Safety was attempted locally after focused checks: **147 steps passed, 30 failed, one dependency-install step blocked**. Local failures include child-process `EPERM`, Chromium socket/process restrictions and missing `@electric-sql/pglite`/`js-tiktoken`. The environment proxy is unreachable, preventing dependency installation and Git fetch. These results are not a full-suite pass. The PR requests the complete unmodified Runtime Boot Safety workflow, including its dependency/browser installation and all browser/database fixtures; the PR's GitHub Actions result is the release-gate evidence.

Repository source was verified against the recursive latest-main tree through the GitHub connector. The pre-existing local checkout was older; all relevant application, helper, script, package and workflow base blobs matched latest main. The main-only sidebar stylesheet was synchronized for local validation. Publication uses a dedicated remote branch created directly from the exact latest-main SHA; only the eight repair/test/documentation/workflow files belong to this change.

## Remaining risks and separate follow-up

The shared helper still treats omitted ownership fields as unowned for other callers. It also does not itself validate ownership projection types. This is a broader caller-contract hardening concern, explicitly documented here rather than refactoring shared behavior in this repair. Advice now supplies and validates the required projection. A later shared-helper change needs its own caller inventory, compatibility review and regression coverage.

Existing authorization is evaluated before inference; this repair adds no locks or in-flight revocation revalidation. Existing raw Brand Core context minimization concerns from the audit also remain separate. Synthetic transport/provider tests establish route composition and dispatch boundaries, not production database state or live model behavior.

No production SQL, paid OpenAI requests, merge or deployment was performed.
