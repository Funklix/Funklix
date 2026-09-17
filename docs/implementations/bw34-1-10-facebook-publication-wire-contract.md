# BW-34.1.10 — Facebook publication wire contract

The first producer/consumer mismatch was casing at the HTTP boundary: `social-publishing-route.snake()` serializes `client_request_id`, `server_request_id`, `job_id`, and the remaining durable fields, while the historical browser success path consumed a JavaScript service-shaped object. Its tests never passed the route's serialized JSON through the browser parser, so that mismatch could regress unseen.

`facebook-publication-contract.js` is now the explicit browser wire projector. The live publish helper passes the parsed route body through it and accepts success only when every finalization invariant, correlation identifier, Page label, ISO timestamp, and optional HTTPS permalink is valid. The focused regression JSON-round-trips the actual output of `route.snake()`; removing a durable field proves the safe ambiguous path remains. This is an offline contract check and performs no provider call or database mutation.
