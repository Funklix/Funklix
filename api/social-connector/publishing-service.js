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
  async function jobResult(jobId, ownerAccountId, { reconcile = true } = {}) {
    const found = await pool.query(`SELECT j.*,e.external_post_id,e.published_at,e.external_url,e.delivery_state,d.destination_type,d.display_name,
      a.id AS provider_attempt_id,a.status AS provider_attempt_state,a.provider_request_reference,a.ambiguous_outcome
      FROM public.social_publish_jobs j JOIN public.social_publishing_destinations d ON d.id=j.destination_id AND d.owner_account_id=j.owner_account_id
      LEFT JOIN public.social_external_posts e ON e.publish_job_id=j.id
      LEFT JOIN public.social_provider_attempts a ON a.publish_job_id=j.id AND a.attempt_number=1
      WHERE j.id=$1 AND j.owner_account_id=$2 LIMIT 1`, [jobId, ownerAccountId]);
    if (!found.rowCount) return null;
    let row = found.rows[0];
    if (row.external_post_id && row.delivery_state === 'confirmed') {
      if (row.status !== 'delivered') await pool.query(`UPDATE public.social_publish_jobs SET status='delivered',completed_at=COALESCE(completed_at,$2),updated_at=$2 WHERE id=$1 AND owner_account_id=$3`, [jobId, row.published_at || now().toISOString(), ownerAccountId]);
      return publishedResult(row);
    }
    if (reconcile && row.provider_attempt_state === 'accepted' && POST_ID.test(row.provider_request_reference || '')) {
      const snapshot = typeof row.content_snapshot === 'string' ? JSON.parse(row.content_snapshot) : row.content_snapshot;
      const publishedAt = row.completed_at || now().toISOString();
      await pool.query(`INSERT INTO public.social_external_posts(platform,external_post_id,destination_id,publish_job_id,owner_account_id,source_board_id,source_node_id,approved_fingerprint,published_snapshot_reference,external_url,published_at,delivery_state,deletion_state)
        VALUES('linkedin',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed','retained') ON CONFLICT(publish_job_id) DO NOTHING`, [row.provider_request_reference,row.destination_id,row.id,row.owner_account_id,row.board_id,row.node_id,row.approved_fingerprint,snapshot.normalizedTextDigest,externalUrl(row.provider_request_reference),publishedAt]);
      const recovered = await pool.query(`SELECT external_post_id,published_at,external_url,delivery_state FROM public.social_external_posts WHERE publish_job_id=$1 AND owner_account_id=$2`, [jobId, ownerAccountId]);
      const post = recovered.rows[0];
      if (post?.delivery_state === 'confirmed' && post.external_post_id === row.provider_request_reference) {
        await pool.query(`UPDATE public.social_provider_attempts SET status='reconciled',completed_at=COALESCE(completed_at,$2) WHERE id=$1`, [row.provider_attempt_id,publishedAt]);
        await pool.query(`UPDATE public.social_publish_jobs SET status='delivered',completed_at=$2,updated_at=$2,last_safe_error_classification=NULL WHERE id=$1 AND owner_account_id=$3`, [jobId,publishedAt,ownerAccountId]);
        row={...row,...post,status:'delivered',completed_at:publishedAt}; return publishedResult(row);
      }
      await pool.query(`UPDATE public.social_publish_jobs SET status='outcome_unknown',last_safe_error_classification='accepted_identity_conflict',updated_at=NOW() WHERE id=$1 AND owner_account_id=$2`,[jobId,ownerAccountId]);
      row={...row,status:'outcome_unknown',last_safe_error_classification:'accepted_identity_conflict'};
    }
    return { ok:false,status: terminalStatus(row),jobId:row.id,providerAttemptId:row.provider_attempt_id||null,jobState:row.status,providerAttemptState:row.provider_attempt_state||null,destination:{type:row.destination_type,label:row.display_name},diagnostic: lifecycleDiagnostic(row) };
  }
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
    const existing = state.previous[0];
    if (existing) return await jobResult(existing.id,input.ownerAccountId) || {ok:false,status:'publishing_in_progress',jobId:existing.id};
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
    if (job.id !== jobId) return await jobResult(job.id,input.ownerAccountId) || { ok:false,status:'publishing_in_progress',jobId:job.id };
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
    if (!result.ok) { const acceptedWithoutIdentity=result.acceptanceKnown===true,unknown=acceptedWithoutIdentity||['outcome_unknown'].includes(result.error?.code);const classification=acceptedWithoutIdentity?'provider_accepted_identity_unretained':result.error?.code||'provider_unavailable';await markFailure(pool,jobId,attemptId,classification,unknown);return {ok:false,status:acceptedWithoutIdentity?'provider_accepted_unreconciled':classification,jobId,providerAttemptId:attemptId,jobState:unknown?'outcome_unknown':'failed'}; }
    const publishedAt = now().toISOString(), url = externalUrl(result.value.postUrn); let client;
    try { await pool.query(`UPDATE public.social_provider_attempts SET status='accepted',completed_at=$2,provider_request_reference=$3,ambiguous_outcome=FALSE WHERE id=$1`,[attemptId,publishedAt,result.value.postUrn]); }
    catch { await pool.query(`UPDATE public.social_publish_jobs SET status='outcome_unknown',last_safe_error_classification='provider_accepted_identity_not_durable',updated_at=NOW() WHERE id=$1`,[jobId]).catch(()=>{});return {ok:false,status:'provider_accepted_unreconciled',jobId,providerAttemptId:attemptId,jobState:'outcome_unknown'}; }
    try { client = await pool.connect(); } catch { await pool.query(`UPDATE public.social_publish_jobs SET status='outcome_unknown',last_safe_error_classification='delivery_committed_provider_only',updated_at=NOW() WHERE id=$1`,[jobId]).catch(()=>{}); return { ok: false, status: 'reconciliation_required', jobId, providerAttemptId: attemptId,jobState:'outcome_unknown' }; }
    try {
      await client.query('BEGIN');
      await client.query(`INSERT INTO public.social_external_posts(platform,external_post_id,destination_id,publish_job_id,owner_account_id,source_board_id,source_node_id,approved_fingerprint,published_snapshot_reference,external_url,published_at,delivery_state,deletion_state) VALUES('linkedin',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'confirmed','retained') ON CONFLICT(publish_job_id) DO NOTHING`, [result.value.postUrn, input.destinationId, jobId, input.ownerAccountId, input.boardId, input.nodeId, state.node.approvedContentFingerprint, snapshot.normalizedTextDigest, url, publishedAt]);
      await client.query(`UPDATE public.social_publish_jobs SET status='delivered',completed_at=$2,updated_at=$2 WHERE id=$1`, [jobId, publishedAt]);
      await client.query('COMMIT');
      return { ok: true, status: 'published', jobId, providerAttemptId: attemptId, publishedAt, destination: { type: 'personal', label: state.destination.display_name }, externalUrl: url };
    } catch { await client.query('ROLLBACK').catch(() => {}); await pool.query(`UPDATE public.social_publish_jobs SET status='outcome_unknown',last_safe_error_classification='delivery_committed_provider_only',updated_at=NOW() WHERE id=$1`,[jobId]).catch(()=>{}); return { ok: false, status: 'reconciliation_required', jobId, providerAttemptId: attemptId,jobState:'outcome_unknown' }; } finally { client.release(); }
  }
  return Object.freeze({ resolve, preflight, publish, jobResult });
}
const POST_ID=/^urn:li:(?:ugcPost|share):[A-Za-z0-9_-]{1,128}$/;
function terminalStatus(row){if(row.status==='outcome_unknown')return row.last_safe_error_classification==='provider_accepted_identity_unretained'||row.last_safe_error_classification==='provider_accepted_identity_not_durable'?'provider_accepted_unreconciled':'outcome_unknown';if(row.status==='failed')return 'failed';if(row.status==='cancelled')return 'cancelled';return 'publishing_in_progress';}
function publishedResult(row){return {ok:true,status:'published',jobId:row.id,providerAttemptId:row.provider_attempt_id||null,jobState:'delivered',publishedAt:row.published_at||row.completed_at,externalUrl:row.external_url||externalUrl(row.external_post_id),destination:{type:row.destination_type,label:row.display_name},recovered:row.status!=='delivered'};}
function lifecycleDiagnostic(row){return {timestamp:new Date().toISOString(),phase:'job_status',classification:terminalStatus(row),failure_category:row.last_safe_error_classification||'none',job_id:row.id,job_state:row.status,provider_attempt_state:row.provider_attempt_state||'unavailable',provider_acceptance_category:['accepted','reconciled'].includes(row.provider_attempt_state)?'accepted':row.ambiguous_outcome?'unknown':'not_accepted',provider_post_identity_category:POST_ID.test(row.provider_request_reference||'')?'retained':'unavailable',external_post_state:row.delivery_state||'missing',duplicate_delivery_prevented:true};}
async function markFailure(pool, jobId, attemptId, classification, unknown) { await pool.query(`UPDATE public.social_provider_attempts SET status=$2,safe_error_classification=$3,ambiguous_outcome=$4,completed_at=NOW() WHERE id=$1`, [attemptId, unknown ? 'outcome_unknown' : 'permanent_failure', classification, unknown]); await pool.query(`UPDATE public.social_publish_jobs SET status=$2,last_safe_error_classification=$3,updated_at=NOW() WHERE id=$1`, [jobId, unknown ? 'outcome_unknown' : 'failed', classification]); }

module.exports = { authorReference, readiness, boardNodes, safeDiagnostic, createPublishingService };
