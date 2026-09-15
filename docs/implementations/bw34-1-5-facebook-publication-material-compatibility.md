# BW-34.1.5 — Facebook publication-material compatibility

## Implementation boundary

This repair addresses only the audited Facebook publication-material mismatch. It introduces no migration or configuration change and does not change OAuth, Page selection, credentials, provider scopes/version, scheduling, generation, Canvas rendering, or the LinkedIn/Instagram publishing paths.

## Proven inherited field and classification

The production-compatible rejection originated from the Social Media Posting node's existing `images` array. `createNode` can copy that array from a parent into a generated next-step node, while the former browser and server validators interpreted every non-empty `images` array as selected Facebook media.

`images` is the existing Canvas image collection, not a newly invented publication schema. The extraction contract now classifies its bounded `source` values:

* generation/Canvas/planning sources (`generated`, `campaign_generated`, `campaign-generation`, `canvas`, `preview`, `prompt`, `placeholder`, and `planning`) are inherited planning metadata and are not sent;
* explicit upload/attachment sources (`uploaded`, `manual_upload`, `attached`, `attachment`, `user_selected`, and `selected`) are real publication-attachment intent and remain blocked as `facebook_media_unsupported`;
* unknown/non-object image entries and non-empty historical `attachments`, `media`, `social.attachment`, or `social.media` state are conservatively blocked as `facebook_media_ambiguous`.

`favoriteImageId` and `imagePrompt` remain Canvas/generation metadata as established by the audit. They do not select Facebook publication media. Nothing reads or rewrites persisted board data during extraction.

## Canonical Facebook material

`facebook-publication-material.js` is the single browser/server extraction contract. Its immutable result contains:

* the normalized `social.caption` message and exact Unicode code-point count;
* zero or one authoritative link from the audit-established `social.link`, `social.url`, or whole-value URL-shaped `social.preview` fields;
* the bounded media classification (`none`, `planning_metadata`, `explicit_attachment`, or `ambiguous`);
* one stable support/rejection code.

The contract preserves the existing message rules (leading BOM removal, CRLF-to-LF normalization, outer trimming, no truncation), 63,206-code-point limit, and HTTPS link safety rules. It neither appends title/hashtags nor falls back to `content`, so the visible canonical caption is exactly the server adapter message. Invalid, credential-bearing, port-bearing, fragment-bearing, and multiple distinct links remain rejected.

## Browser/server alignment

Content Workspace validation and readiness consume the shared extractor. The server evaluator consumes the same extractor, and its result supplies preflight caption/link, immutable job snapshot, and Facebook adapter message/link. Therefore inherited planning images cannot be accepted as text-only by the browser and rejected as media by the server.

The Content Workspace primary action now carries the exact extraction failure code rather than collapsing it to `facebook_payload_unsupported`. Safe localized labels distinguish explicit unsupported attachment, ambiguous media, empty/invalid/over-limit message, invalid link, and multiple links. The server remains authoritative for authorization, destination, credentials, approval, idempotency, existing publication, and active-job checks.

## Approval impact

The v2 approval-material contract is intentionally unchanged. Existing image values are already included in the approved material fingerprint. Merely interpreting an unchanged generated/planning image as non-publication metadata changes neither stored bytes nor user-visible approved publication material, so a current approved fingerprint stays current. Changing/removing an actual image, or changing the visible caption, continues to change the v2 fingerprint and requires approval again. This compatibility projection does not regenerate, bypass, or rewrite an approval fingerprint.

## Changed files

* `facebook-publication-material.js` — canonical extraction and bounded media classification.
* `content-workspace.js` — shared browser validation/readiness and exact safe unsupported labels.
* `api/social-connector/facebook-publishing.js` — shared authoritative server validation and adapter-bound material.
* `index.html` — loads the shared browser contract before Content Workspace.
* `scripts/check-bw34-1-5-facebook-publication-material-compatibility.js` — focused deterministic regression.
* `scripts/check-bw34-1-1-facebook-content-publishing-surface.js` — makes its pre-existing explicit-media fixture unambiguous.
* `package.json` — exposes the focused regression command.

## Production acceptance criterion

After reload, an existing approved canonical Facebook Social Media Posting with a connected account, authoritative eligible selected Page, ordinary non-empty `social.caption`, no completed publication, and only inherited generated/planning `images` metadata resolves to `facebook_ready`. Its primary action is **Publish to Facebook**, and preflight reaches the existing authoritative confirmation with the exact extracted caption and link without recreation, edit, reapproval, or board mutation.

Explicit or ambiguous attachment state remains unavailable with its precise safe reason. A durable prior publication remains blocked by the existing server-side `already_published` check.

## Rollback boundary

Revert the shared extractor and its three consumers/load/test documentation changes as one unit. There is no data rollback, migration rollback, environment-variable rollback, OAuth rollback, or Page-selection rollback because this implementation changes only read-time publication-material interpretation.
