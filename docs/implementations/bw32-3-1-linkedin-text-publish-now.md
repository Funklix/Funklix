# BW-32.3.1 — Guarded LinkedIn text Publish Now

**Contract access date:** 2026-09-08.

## Provider contract and Phase 1 scope

Phase 1 implements the public **Share on LinkedIn** contract documented by Microsoft Learn: `POST https://api.linkedin.com/v2/ugcPosts`, Bearer authorization, `X-Restli-Protocol-Version: 2.0.0`, JSON content, the authenticated member Person URN as author, `PUBLISHED` lifecycle, commentary text, media category `NONE`, and member-network visibility `PUBLIC`. A result is accepted only for HTTP 201 with a bounded `X-RestLi-Id` post URN. The member and application limits documented there are 150/day and 100,000/day. Source: [Share on LinkedIn](https://learn.microsoft.com/en-us/linkedin/consumer/integrations/self-serve/share-on-linkedin).

The versioned Marketing [Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api) is a distinct replacement surface requiring separately verified access and a `Linkedin-Version` header. This release deliberately does not switch APIs.

Only an immediate, public, text-only post to the acting account's one personal destination is supported. Media, articles, organizations, scheduling, analytics, editing, deletion, fan-out, retries, and AI transformations are excluded.

## Gate and eligibility

`LINKEDIN_TEXT_PUBLISHING_ENABLED` defaults off; only a trimmed, case-normalized `true` enables server execution. Browser fields cannot enable it. The independent `LINKEDIN_TEXT_PUBLISHING_LIVE_SMOKE_TEST=true` boundary is also required by any manually built live-smoke tooling; neither variable causes a post by itself.

The pure evaluator checks authentication, current edit access, a saved authoritative Board/node, Social Media Posting role, LinkedIn platform, Ready or Needs attention readiness, Approved status and matching approval fingerprint, valid caption, actor-owned coherent connection and credential, future expiry, active personal destination, authoritative `w_member_social`, valid Person URN, adapter action version, the server gate, and absence of a delivered revision or active/ambiguous job. Viewers cannot reach the control or pass server authorization.

The outbound text is only the freshly loaded `node.social.caption`. CRLF/CR becomes LF, outer whitespace is trimmed, Unicode and internal paragraphs remain, and empty, invalid-Unicode, or over-3,000-code-point input is rejected without truncation. No title, CTA, hashtags, links, metadata, planning data, or summary is appended.

## Persistence and idempotency

Existing Social Connector tables are sufficient, so this change performs no schema DDL. `social_publish_jobs.content_snapshot` stores the immutable caption, its SHA-256 digest, owner/Board/node/fingerprint, connection/destination, action version, requester, response language, and timestamp. The unique owner/idempotency constraint enforces identity over owner, destination, Board, node, approved fingerprint, and `linkedin_text_publish_v1`. Planning changes and unrelated Board changes are absent from that identity.

A ProviderAttempt is committed before the HTTP call. No transaction spans the network request. A successful provider result, completed job, accepted attempt, and ExternalPost are committed atomically afterward. Tokens and raw responses are never stored in publishing records or diagnostics. Historical ExternalPosts are not overwritten; projection reports whether their fingerprint matches current content.

## Failure and ambiguous outcomes

400, 401, 403, 409, 429, and 5xx map to bounded rejection, credential, permission, conflict, rate-limit, and unavailable classifications. A timeout is `outcome_unknown`; malformed 201 responses are invalid. Storage failure before sending is safe and no call occurs. Persistence failure after 201 is `reconciliation_required` / provider-only committed. Active, unknown, delivered, and reconciliation states never trigger an automatic second provider call.

## Manual production verification

1. Deploy with publishing disabled and verify Settings remains readable and the action reports unavailable.
2. Deliberately prepare and save one Approved LinkedIn Social Media Posting; verify its exact caption and personal destination.
3. Set `LINKEDIN_TEXT_PUBLISHING_ENABLED=true` in Production and redeploy.
4. Open **Publish to LinkedIn**, check profile, exact text, count, Approved/readiness labels, and public/immediate warning.
5. Select **Publish now exactly once** and observe checking, publishing, then one truthful success.
6. Verify one LinkedIn post and visible ExternalPost provenance.
7. Repeat the action and verify **Already published**.
8. Verify Canvas editorial status and `planningSchedule` are unchanged.

Never automate this checklist, reuse customer content, or automatically delete the test post. If a separate manual live-smoke harness is introduced, require both flags and text supplied deliberately at execution time.

## Rollback

Set `LINKEDIN_TEXT_PUBLISHING_ENABLED=false` and redeploy. This immediately prevents new sends while retaining Settings, connection controls, PublishJobs, attempts, and ExternalPost provenance. Do not delete records or retry ambiguous attempts during rollback.
