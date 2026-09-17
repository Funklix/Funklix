# BW-34.1.10 — Facebook publication wire contract

The first producer/consumer mismatch was casing at the HTTP boundary: `social-publishing-route.snake()` serializes `client_request_id`, `server_request_id`, `job_id`, and the remaining durable fields, while the historical browser success path consumed a JavaScript service-shaped object. Its tests never passed the route's serialized JSON through the browser parser, so that mismatch could regress unseen.

`facebook-publication-contract.js` is now the explicit browser wire projector. The live publish helper passes the parsed route body through it and accepts success only when every finalization invariant, correlation identifier, Page label, ISO timestamp, and optional HTTPS permalink is valid. The focused regression JSON-round-trips the actual output of `route.snake()`; removing a durable field proves the safe ambiguous path remains. This is an offline contract check and performs no provider call or database mutation.

## Clean-checkout CI correction

The first regression imported `api/social-publishing-route.js` before installing a dependency seam. That route synchronously imports `social-connector/publishing-service.js`, which imports `_boards-storage.js`, which imports the production `pg` package. Runtime Boot Safety deliberately installs no dependencies. A local untracked `node_modules` directory therefore hid the premature require and produced a false-positive pass.

The corrected check reuses the bounded CommonJS cache-injection pattern established by the Facebook callback regression: it saves the existing cache entries, relevant authentication environment values, and global `fetch`; installs a database-forbidden `_boards-storage` double before the first real route import; then executes the real publication projector, real route `send`/authoritative writer, HTTP JSON round-trip, and browser wire projector. Its `finally` block restores every saved cache entry, environment value, and global. A tracked-files-only archive with neither `.git` nor `node_modules`, with parent/global lookup disabled, proves the focused publication and engagement checks and browser integrity pass without resolving `pg`.
