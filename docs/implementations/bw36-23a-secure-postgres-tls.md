# BW-36.23A secure PostgreSQL TLS

The shared runtime pool now requires server-only `SUPABASE_CA_CERT` for any
configured remote PostgreSQL URL. Disposable loopback databases without a CA keep
their existing pg defaults. If a CA is supplied locally it is validated and used.

The complete PEM may contain ordinary multiline content, CRLF, literal `\n` /
`\r\n`, or multiple complete certificates. Missing, empty, malformed or trailing
non-certificate content fails before pool construction with
`POSTGRES_TLS_CONFIGURATION_ERROR`. No secret content is included in that error.
A globally disabled TLS verifier also fails configuration.

The runtime uses `ssl: { ca, rejectUnauthorized: true }`. Node's default hostname
verification remains active. There is no retry with weaker TLS.
node-postgres merges parsed connection-string options after explicit options, so
URL SSL parameters can replace the entire SSL object. The helper removes SSL
controls and `uselibpqcompat` only from an in-memory URL copy before handing it to
pg. Connection-target query overrides (`host`, `hostaddr`, `port`, `service`) are rejected
before the local-development exception, including empty, duplicate and encoded
keys. The URL authority is the sole destination and TLS hostname source.
The Vercel URL secret, login, pooler hostname, port 6543, database, other accepted non-TLS query
options, pool defaults, maintenance guard, transactions and authorization remain
unchanged. No migrations are required.

## Safe operator rollout (after PR review and explicit release approval)

1. Keep Production `TENDRA_WRITE_MAINTENANCE=1` throughout review, merge, build,
   deployment and read verification. Do not restore writes as part of deploying
   this fix.
2. In Vercel project Settings → Environment Variables, confirm the Production
   bindings exist: `SUPABASE_CA_CERT` (complete official Supabase PEM, server-only),
   `POSTGRES_URL` (existing restricted `tendra_app_runtime` pooler login at 6543,
   unchanged, including existing `sslmode=require`) and
   `TENDRA_WRITE_MAINTENANCE=1`. Do not print or copy secret values into logs,
   tickets, browser code or commands. Confirm no global TLS bypass is configured.
3. Require the PR's Runtime Boot Safety checks on both PostgreSQL versions to pass.
   After authorized merge, deploy the reviewed merge commit. If Vercel Git
   integration deploys main automatically, that deployment is the release; verify
   its source commit. Otherwise use Deployments → the deployment for that commit →
   Redeploy, with current Production environment variables and build cache
   disabled. Do not redeploy an older commit.
4. Confirm deployment Ready and verify its source SHA is the reviewed release.
   Keep the maintenance flag enabled. Check server logs for
   `POSTGRES_TLS_CONFIGURATION_ERROR`, certificate-chain, hostname and database
   permission errors. If any appear, keep maintenance active and fix configuration;
   never disable verification or switch to an administrative login.
5. Sign in as an existing authorized user and reload the application. In browser
   Network, confirm the existing workspace/Brand catalog, Brand detail, Board
   library and an existing Board detail GET return successful responses with
   expected saved content. Confirm Canonical Brand Core and Board canvas load
   after a hard refresh and a fresh session. Do not create/edit/delete records.
   Check server logs over those requests: no TLS or runtime permission errors.
6. Verify the read access boundary with a separate unprivileged test account:
   inaccessible Brand/Board reads must remain denied and reveal no protected data.
   Use the application's existing authenticated read routes; do not run migration
   verifiers or mutation probes against production.
7. Record the deployment SHA/time and read-check results. If reads fail, leave
   `TENDRA_WRITE_MAINTENANCE=1`; investigate or roll back only to a reviewed,
   compatible release with maintenance retained. Never weaken TLS.
8. Restore writes only after successful read verification and separate operator
   approval that the original migration maintenance may end. Set the Production
   maintenance flag to its normal disabled value, then create a new deployment
   of the same reviewed code with current variables (Vercel environment changes
   do not update existing deployments). Confirm reads again before ordinary use.
   Keep the restricted login and CA in place.

This task does not merge, deploy, change Vercel/Supabase configuration, or access
production data. Local and CI databases are disposable fixtures only.
