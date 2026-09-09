'use strict';

const crypto = require('crypto');
const { pool: defaultPool } = require('../_boards-storage');
const { getBoardAccess } = require('../_board-access');
const vault = require('./token-vault');
const { createLinkedInAdapter } = require('./linkedin-adapter');
const { ACTION_VERSION, ACTIVE_JOB_STATES, PERSON_URN, enabled, materialFingerprint, evaluateLinkedInTextPublishEligibility, approvalBoundary, digest, idempotencyKey, externalUrl } = require('./linkedin-publishing');

function authorReference(value) {
  if (PERSON_URN.test(value || '')) return value;
  return /^[A-Za-z0-9_-]{1,128}$/.test(value || '') ? `urn:li:person:${value}` : '';
}
function readiness(node) {
  if (!node || node.type !== 'Social Media Posting') return 'Incomplete';
  const caption = typeof node.social?.caption === 'string' && node.social.caption.trim();
  const platform = String(node.social?.platform || node.channel || '').trim();
  if (!caption || !platform) return 'Incomplete';
  const hasCta = (typeof node.social?.cta === 'string' && node.social.cta.trim()) || /(https?:\/\/|\b(link|learn|shop|book|join|download|discover|visit)\b)/i.test(caption);
  return hasCta ? 'Ready' : 'Needs attention';
}
function boardNodes(board) { const canvas = board?.canvas_json; return Array.isArray(canvas) ? canvas : Array.isArray(canvas?.nodes) ? canvas.nodes : []; }
function safeDiagnostic(input = {}) { return { clientRequestId: input.clientRequestId || null, serverRequestId: input.serverRequestId, publishJobId: input.publishJobId || null, providerAttemptId: input.providerAttemptId || null, phase: input.phase, classification: input.classification, providerHttpStatusCategory: input.providerHttpStatusCategory || null, retryable: input.retryable === true, committedStateCategory: input.committedStateCategory || 'none', timestamp: new Date().toISOString() }; }

function createPublishingService({ pool = defaultPool, adapter = createLinkedInAdapter(), env = process.env, now = () => new Date() } = {}) {
  async function resolve(input, actor) {
    const { board, access } = await getBoardAccess(input.boardId, actor, { columns: 'id, canvas_json, owner_id, owner_email, updated_at' });
    const node = boardNodes(board).find(item => item?.id === input.nodeId) || null;
    const connectionResult = await pool.query(`SELECT c.*,s.id AS credential_id,s.encrypted_payload,s.nonce,s.authentication_tag,s.encryption_key_version,s.revoked_at
      FROM public.social_connected_accounts c LEFT JOIN public.social_token_secrets s ON s.id=c.token_secret_id AND s.owner_account_id=c.owner_account_id
      WHERE c.owner_account_id=$1 AND c.platform='linkedin' AND c.status<>'disconnected' ORDER BY c.updated_at DESC LIMIT 1`, [input.ownerAccountId]);
    const connection = connectionResult.rows[0] || null;
    const destinationResult = await pool.query(`SELECT * FROM public.social_publishing_destinations WHERE id=$1 AND owner_account_id=$2 LIMIT 1`, [input.destinationId, input.ownerAccountId]);
    const rawDestination = destinationResult.rows[0] || null;
    const destination = rawDestination ? { ...rawDestination, external_destination_id: authorReference(rawDestination.external_destination_id) } : null;
    const fingerprint = node ? materialFingerprint(node) : '';
    const key = node?.approvedContentFingerprint ? idempotencyKey({ ownerAccountId: input.ownerAccountId, destinationId: input.destinationId, boardId: input.boardId, nodeId: input.nodeId, approvedFingerprint: node.approvedContentFingerprint }) : '';
    let previous = [];
    if (key) previous = (await pool.query(`SELECT j.id,j.status,e.id AS external_post_id FROM public.social_publish_jobs j LEFT JOIN public.social_external_posts e ON e.publish_job_id=j.id AND e.delivery_state='confirmed' WHERE j.owner_account_id=$1 AND j.idempotency_key=$2`, [input.ownerAccountId, key])).rows;
    const evaluation = evaluateLinkedInTextPublishEligibility({ authenticatedAccountId: input.ownerAccountId, boardEditAccess: access?.canEdit === true, boardSaved: !!board, node, readiness: readiness(node), currentFingerprint: fingerprint, connection, credential: connection, destination, now: now().toISOString(), adapterSupported: adapter.capabilities?.includes(ACTION_VERSION), successfulExternalPost: previous.some(row => row.external_post_id), activeJob: previous.some(row => ACTIVE_JOB_STATES.includes(row.status)), publishingEnabled: enabled(env) });
    return { board, access, node, connection, destination, fingerprint, key, previous, evaluation };
  }

  async function preflight(input, actor) {
    const state = await resolve(input, actor);
    const latestPost = state.node ? (await pool.query(`SELECT platform,delivery_state,published_at,external_url,approved_fingerprint FROM public.social_external_posts WHERE owner_account_id=$1 AND source_board_id=$2 AND source_node_id=$3 ORDER BY published_at DESC NULLS LAST LIMIT 1`, [input.ownerAccountId, input.boardId, input.nodeId])).rows[0] : null;
    const boundary = approvalBoundary(input, state);
    if (boundary.rejection) return { ok: false, status: boundary.rejection === 'approval_version_outdated' ? 'approval_version_outdated' : 'approval_stale', classification: 'approval_stale', rejectionCategory: boundary.rejection, blockingCodes: [boundary.rejection === 'approval_version_outdated' ? 'approval_version_outdated' : 'approval_stale'], diagnostic: boundary.diagnostic };
    return { ok: state.evaluation.eligible, status: state.evaluation.code, blockingCodes: state.evaluation.blockingCodes, diagnostic: boundary.diagnostic, confirmationRequired: state.evaluation.eligible, caption: state.evaluation.caption, characterCount: state.evaluation.characterCount, profileDisplayName: state.connection?.external_display_name || null, destination: state.destination ? { id: state.destination.id, type: 'personal', label: state.destination.display_name } : null, approvedFingerprint: state.node?.approvedContentFingerprint || null, readiness: readiness(state.node), editorialStatus: state.node?.status || null, provenance: latestPost ? { platform: latestPost.platform, deliveryState: latestPost.delivery_state, destinationType: 'personal', publishedAt: latestPost.published_at, externalUrl: latestPost.external_url, currentRevisionMatches: latestPost.approved_fingerprint === state.fingerprint } : null };
  }

  async function publish(input, actor) {
    const state = await resolve(input, actor);
    if (!state.evaluation.eligible) return { ok: false, status: state.evaluation.code, blockingCodes: state.evaluation.blockingCodes };
    if (input.expectedApprovedFingerprint !== state.node.approvedContentFingerprint) return { ok: false, status: 'approval_stale' };
    const jobId = crypto.randomUUID();
    const snapshot = { schemaVersion: 1, actionVersion: ACTION_VERSION, ownerAccountId: input.ownerAccountId, boardId: input.boardId, nodeId: input.nodeId, approvedFingerprint: state.node.approvedContentFingerprint, normalizedTextDigest: digest(state.evaluation.caption), caption: state.evaluation.caption, connectedAccountId: state.connection.id, destinationId: state.destination.id, platform: 'linkedin', requestedByActor: input.ownerAccountId, responseLanguage: input.responseLanguage, createdAt: now().toISOString() };
    let job;
    try {
      const inserted = await pool.query(`INSERT INTO public.social_publish_jobs(id,owner_account_id,board_id,node_id,approved_fingerprint,content_snapshot,destination_id,delivery_mode,status,idempotency_key,created_by_actor)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,'immediate','queued',$8,$2) ON CONFLICT(owner_account_id,idempotency_key) DO NOTHING RETURNING *`, [jobId, input.ownerAccountId, input.boardId, input.nodeId, state.node.approvedContentFingerprint, JSON.stringify(snapshot), input.destinationId, state.key]);
      job = inserted.rows[0] || (await pool.query('SELECT * FROM public.social_publish_jobs WHERE owner_account_id=$1 AND idempotency_key=$2', [input.ownerAccountId, state.key])).rows[0];
    } catch { return { ok: false, status: 'storage_failed_without_delivery' }; }
    if (job.id !== jobId) return { ok: false, status: job.status === 'delivered' ? 'already_published' : 'publishing_in_progress', jobId: job.id };
    const attemptId = crypto.randomUUID();
    try {
      const claimed = await pool.query(`UPDATE public.social_publish_jobs SET status='delivering',attempt_count=1,updated_at=NOW() WHERE id=$1 AND owner_account_id=$2 AND status='queued' RETURNING id`, [jobId, input.ownerAccountId]);
      if (!claimed.rowCount) return { ok: false, status: 'publishing_in_progress', jobId };
      await pool.query(`INSERT INTO public.social_provider_attempts(id,publish_job_id,owner_account_id,adapter_platform,attempt_number,phase,status) VALUES($1,$2,$3,'linkedin',1,'provider_request','started')`, [attemptId, jobId, input.ownerAccountId]);
    } catch { await pool.query(`UPDATE public.social_publish_jobs SET status='failed',last_safe_error_classification='storage_failed_without_delivery' WHERE id=$1`, [jobId]).catch(() => {}); return { ok: false, status: 'storage_failed_without_delivery', jobId }; }
    let credential;
    try { credential = vault.open({ algorithm: 'aes-256-gcm', formatVersion: 1, keyVersion: state.connection.encryption_key_version, ciphertext: state.connection.encrypted_payload, nonce: state.connection.nonce, authenticationTag: state.connection.authentication_tag }, { secretId: state.connection.token_secret_id, ownerAccountId: input.ownerAccountId, platform: 'linkedin' }, { env }); }
    catch { await markFailure(pool, jobId, attemptId, 'credential_invalid', false); return { ok: false, status: 'credential_invalid', jobId }; }
    const result = await adapter.linkedin_text_publish_v1({ context: { requestId: input.serverRequestId, accountId: input.ownerAccountId }, credentials: credential, input: { author: state.destination.external_destination_id, caption: state.evaluation.caption } });
    Object.keys(credential).forEach(key => { credential[key] = ''; });
    if (!result.ok) { const unknown = ['outcome_unknown', 'provider_response_invalid'].includes(result.error?.code); await markFailure(pool, jobId, attemptId, result.error?.code || 'provider_unavailable', unknown); return { ok: false, status: result.error?.code || 'provider_unavailable', jobId, providerAttemptId: attemptId }; }
    const publishedAt = now().toISOString(), url = externalUrl(result.value.postUrn); let client;
    try { client = await pool.connect(); } catch { await markFailure(pool, jobId, attemptId, 'delivery_committed_provider_only', true).catch(() => {}); return { ok: false, status: 'reconciliation_required', jobId, providerAttemptId: attemptId }; }
    try {
      await client.query('BEGIN');
      await client.query(`UPDATE public.social_provider_attempts SET status='accepted',completed_at=$2,provider_request_reference=$3 WHERE id=$1`, [attemptId, publishedAt, result.value.postUrn]);
      await client.query(`INSERT INTO public.social_external_posts(platform,external_post_id,destination_id,publish_job_id,owner_account_id,source_board_id,source_node_id,approved_fingerprint,published_snapshot_reference,external_url,published_at,delivery_state,deletion_state) VALUES('linkedin',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed','retained')`, [result.value.postUrn, input.destinationId, jobId, input.ownerAccountId, input.boardId, input.nodeId, state.node.approvedContentFingerprint, snapshot.normalizedTextDigest, url, publishedAt]);
      await client.query(`UPDATE public.social_publish_jobs SET status='delivered',completed_at=$2,updated_at=$2 WHERE id=$1`, [jobId, publishedAt]);
      await client.query('COMMIT');
      return { ok: true, status: 'published', jobId, providerAttemptId: attemptId, publishedAt, destination: { type: 'personal', label: state.destination.display_name }, externalUrl: url };
    } catch { await client.query('ROLLBACK').catch(() => {}); await markFailure(pool, jobId, attemptId, 'delivery_committed_provider_only', true).catch(() => {}); return { ok: false, status: 'reconciliation_required', jobId, providerAttemptId: attemptId }; } finally { client.release(); }
  }
  return Object.freeze({ resolve, preflight, publish });
}
async function markFailure(pool, jobId, attemptId, classification, unknown) { await pool.query(`UPDATE public.social_provider_attempts SET status=$2,safe_error_classification=$3,ambiguous_outcome=$4,completed_at=NOW() WHERE id=$1`, [attemptId, unknown ? 'outcome_unknown' : 'permanent_failure', classification, unknown]); await pool.query(`UPDATE public.social_publish_jobs SET status=$2,last_safe_error_classification=$3,updated_at=NOW() WHERE id=$1`, [jobId, unknown ? 'outcome_unknown' : 'failed', classification]); }

module.exports = { authorReference, readiness, boardNodes, safeDiagnostic, createPublishingService };
