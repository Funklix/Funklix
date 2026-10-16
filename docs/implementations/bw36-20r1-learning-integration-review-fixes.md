# BW-36.20R1 — Learning integration review fixes

Date: 2026-10-16. Base: merged `main` at `ad25d728a15bc7c9286337fbb0feac177a54e149`, including PR #778.

Read the full PR #778 discussion and automated review before implementation:

- [P1 provider storage finding](https://github.com/Funklix/Funklix/pull/778#discussion_r4288808000)
- [P2 revalidation classification finding](https://github.com/Funklix/Funklix/pull/778#discussion_r4288808004)

## Corrections

`api/ai-brain/advice.js` explicitly sends `store: false` in the existing Responses API request, matching `api/_learning-advisor.js`. Model, input messages, response parsing, authorization, Learning selection and Advice behavior are preserved. The request body and raw Brand knowledge are not logged.

`api/_ai-brain-learning-context.js` preserves explicit `AdviceContextError` classifications. Only typed authorization failures from the existing Learning authorization helper (`AUTHENTICATION_REQUIRED`, `IDENTITY_INVALID`, `BRAND_UNAVAILABLE`, `BRAND_ACCESS_DENIED`) are converted to the existing `advice_context_changed`/409 response during revalidation. Confirmed Board, canonical context, identity fingerprint or selected Learning changes continue to fail with 409.

All other revalidation exceptions become the existing `learning_context_unavailable`/503 classification. This includes connection failures, outages, lock contention, statement timeouts, schema errors, serialization/deadlock failures and unexpected operational exceptions. Clients receive only the existing bounded error message/code/retryability, with no internal error details, authorization information, answer or Learning disclosure. The existing transaction rollback/release behavior remains intact.

Both pre-dispatch and post-inference revalidation still run. No provider retry is introduced: a failed pre-check prevents dispatch; a failed post-check suppresses the generated answer after exactly one mocked call. Existing locking, authorization, fingerprints and selected-row revision/statement checks remain unchanged.

No retrieval ranking, provider context selection, governance, UI, schema, Canvas, Brand Profile, Learning Advisor or unrelated AI routes changed. No quotas, arbitrary limits or migrations were added.

## Regression coverage

`node scripts/check-bw36-20r1-learning-integration-review-fixes.js` uses the real Advice route, ACL helpers and revalidation with disposable PGlite PostgreSQL and a mocked OpenAI transport:

- Explicit `store: false` for Board-only Advice, an empty approved library and Advice with approved Brand Learnings; existing model preserved.
- 90 operational failures: nine error forms across connection acquisition, Board lock/scope, identity lookup, selected Learning lookup and transaction commit, at both revalidation stages.
- 12 confirmed stale-context/authorization cases across both stages: Board edit revocation, Brand membership revocation, identity disable/email change, saved snapshot change and selected Learning archive.
- Exact bounded 503/409 payloads, suppressed output, no automatic provider retry, rollback and release of every acquired connection.

The shared BW-36.20 mocked transport also asserts `store: false` on every applicable request throughout the existing integration suite. Runtime Boot Safety includes the new regression and its syntax check.

## Validation

Focused R1 regression and all existing BW-36.20 database/browser checks passed locally with mocked OpenAI. BW-36.20R0 and relevant session, Board/Brand authorization and all ten BW-26 AI Brain checks run as part of complete Runtime Boot Safety. Full workflow results are recorded in the pull request delivery report and GitHub Actions run.

The local workflow's browser dependency installation cannot switch to root (`su: Authentication failure`); system Chromium is already installed and is used by the browser regressions. This setup limitation is separate from the hosted GitHub Actions release gate.

No paid OpenAI request, production SQL, merge or production deployment was performed. SQL runs only in disposable local regression databases.
