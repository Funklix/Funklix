# Founder Story website retrieval failure

**Date:** 2026-07-27
**Status:** Fixed with controlled regression coverage; live end-to-end verification is limited by the runner network

## Reproduction

The authenticated `POST /api/extract-website-text` handler was invoked locally with the reported URL and a valid repository session token. The request passed client-contract-equivalent construction, session validation, and route validation, then returned HTTP 400 with the stable `dns_failed` code before a connection was made. The runner's system resolver independently returned `EAI_AGAIN` for both the `www` and apex host, and its outbound proxy rejected the site, so this environment could not complete a live socket request. No URL query, address, DNS answer, body, HTML, extracted text, cookie, or secret was logged.

The code-level production defect was reproduced deterministically with the actual URL policy, resolver-validation function, pinned request path, response reader, and HTML extractor. A dual-stack public About-page fixture containing IPv4 plus an ordinary global IPv6 address in `2000::/10` failed before transport as `unsafe_destination` on the merged implementation.

## Exact root cause and failing layer

`isPublicAddress()` in `api/_website-url-policy.js` used `(first & 0xffc0) === 0x2000`. That rejects the entire IPv6 `2000::/10` block rather than the intended documentation-only `2001:db8::/32` block. Consequently, `resolvePublicAddresses()` rejected an otherwise safe mixed IPv4/IPv6 answer set before address selection or connection. Because A7 correctly validates every DNS answer, one incorrectly classified public IPv6 answer made the complete destination fail closed.

The failing layer is **DNS resolution/address classification (layers 5–6)**. Its stable production-policy error is `unsafe_destination`. The local real-page attempt instead stopped at the runner's unavailable resolver with `dns_failed`; it did not reach classification, socket pinning, TLS, headers, redirects, compression, type, streaming, timeout, or extraction.

## Correction

The broad mask was replaced with an exact word comparison for `2001:db8::/32`. No site allowlist, hostname exception, retry bypass, or alternate connection path was added. Ordinary global unicast IPv6 is accepted; the documentation range remains rejected.

The Founder Story client now maps known stable retrieval failures to bounded recovery messages for invalid URLs, unsafe destinations, redirects, timeouts, large responses, unsupported HTML/encoding, empty extraction, HTTP rejection, and reachability. Unknown failures retain the existing generic fallback.

## Preserved security controls

HTTP(S)-only parsing, credential and non-default-port rejection, localhost/unsafe-address rejection, validation of every DNS answer, mixed safe/unsafe rejection, DNS-to-socket pinning, original TLS hostname/SNI/certificate and Host handling, per-hop redirect validation, redirect loop/limit enforcement, GET-only transport, fixed credential-free headers, identity-only encoding, total timeout, streaming wire-size cap, HTML/XHTML allowlist, inert extraction, bounded output, and no raw HTML or persistence remain unchanged.

## Regression coverage

The focused fixture proves that a mixed IPv4/ordinary-global-IPv6 public HTTPS About page reaches deterministic extraction, accepts a parameterized HTML content type, caps extracted text, marks truncation, and returns no raw HTML. Separate assertions retain rejection of `2001:db8::/32`, private/mixed-unsafe DNS results, rebinding attempts, unsafe redirects, redirect loops/limits, non-HTML and encoded responses, oversized streams, timeout/cancellation, and HTTP failures. The transport check asserts the pinned lookup plus original HTTPS hostname, SNI, and Host header. Lifecycle checks cover every new stable message and confirm that the failure handler contains no Founder Story save or autosave call.

## Affected symbols

- `isPublicAddress()` in `api/_website-url-policy.js`
- `FOUNDER_STORY_IMPORT_ERROR_MESSAGES` in `app.js`
- A7 policy/retrieval checks and the A8 import lifecycle check

## Remaining limitations

- The runner could not resolve or proxy the reported host, so a successful live retrieval through the corrected implementation was not claimable here.
- Automated coverage intentionally uses controlled transport and DNS fixtures and does not depend on the theater website's continued availability.
- Server-rendered HTML/XHTML only remains the product boundary; JavaScript rendering, crawling, documents, authenticated pages, and non-identity compression remain unsupported.

No dependency, schema, migration, field semantic, mapping behavior, review/Apply behavior, persistence behavior, DOM ID, modal layout, or Founder Story button-layout change was made.
