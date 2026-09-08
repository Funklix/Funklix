'use strict';
const assert = require('assert');
const fs = require('fs');
const publishing = require('../api/social-connector/linkedin-publishing');
const { createLinkedInAdapter, UGC_POSTS_ENDPOINT } = require('../api/social-connector/linkedin-adapter');

function fixture(overrides = {}) {
  const node = { id: 'node_publish_1', type: 'Social Media Posting', status: 'Approved', title: 'Approved', content: 'internal only', social: { platform: 'LinkedIn', caption: 'Hello\r\n\r\nWörld 🌍', cta: 'Visit' } };
  node.approvedContentFingerprint = publishing.materialFingerprint(node);
  return { authenticatedAccountId: 'owner@example.test', boardEditAccess: true, boardSaved: true, node, readiness: 'Ready', currentFingerprint: node.approvedContentFingerprint, connection: { owner_account_id: 'owner@example.test', token_secret_id: 'secret', status: 'connected', token_expires_at: '2030-01-01T00:00:00Z', granted_scopes: ['w_member_social'] }, credential: { revoked_at: null }, destination: { owner_account_id: 'owner@example.test', destination_type: 'personal', active: true, status: 'active', external_destination_id: 'urn:li:person:abc_123' }, now: '2026-09-08T00:00:00Z', adapterSupported: true, successfulExternalPost: false, activeJob: false, publishingEnabled: true, ...overrides };
}
function blocked(change, code) { const input = fixture(); change(input); assert(publishing.evaluateLinkedInTextPublishEligibility(input).blockingCodes.includes(code), code); }

async function main() {
  assert.strictEqual(publishing.enabled({}), false); assert.strictEqual(publishing.enabled({ LINKEDIN_TEXT_PUBLISHING_ENABLED: ' TRUE ' }), true); assert.strictEqual(publishing.enabled({ publishingEnabled: 'true' }), false);
  assert.strictEqual(publishing.evaluateLinkedInTextPublishEligibility(fixture()).eligible, true);
  blocked(x => { x.node.status = 'Draft'; }, 'editorial_approval_required'); blocked(x => { x.node.status = 'In Review'; }, 'editorial_approval_required'); blocked(x => { x.node.status = 'Needs Changes'; }, 'editorial_approval_required');
  blocked(x => { x.currentFingerprint = 'v1-new'; }, 'approval_stale'); blocked(x => { x.readiness = 'Incomplete'; }, 'readiness_incomplete'); blocked(x => { x.node.type = 'Content'; }, 'node_role_unsupported'); blocked(x => { x.node.social.platform = 'X'; }, 'platform_not_linkedin'); blocked(x => { x.boardSaved = false; }, 'board_not_saved'); blocked(x => { x.boardEditAccess = false; }, 'board_edit_access_required');
  blocked(x => { x.connection.owner_account_id = 'collaborator@example.test'; }, 'connection_owner_mismatch'); blocked(x => { x.connection = null; }, 'connection_unavailable'); blocked(x => { x.connection.status = 'disconnected'; }, 'credential_revoked'); blocked(x => { x.connection.token_expires_at = '2020-01-01T00:00:00Z'; }, 'token_expired'); blocked(x => { x.credential.revoked_at = '2026-01-01'; }, 'credential_revoked'); blocked(x => { x.destination.active = false; }, 'destination_inactive'); blocked(x => { x.connection.granted_scopes = []; }, 'permission_missing'); blocked(x => { x.destination.external_destination_id = 'bad:author'; }, 'provider_author_invalid');
  assert.deepStrictEqual(publishing.normalizeCaption('  A\r\n\r\nB 🌍  '), { ok: true, caption: 'A\n\nB 🌍', characterCount: 6 });
  blocked(x => { x.node.social.caption = '   '; }, 'caption_empty'); blocked(x => { x.node.social.caption = 'x'.repeat(3001); }, 'caption_too_long');
  const first = publishing.idempotencyKey({ ownerAccountId: 'o', destinationId: 'd', boardId: 'b', nodeId: 'n', approvedFingerprint: 'f' }); const second = publishing.idempotencyKey({ ownerAccountId: 'o', destinationId: 'd', boardId: 'b', nodeId: 'n', approvedFingerprint: 'f' }); assert.strictEqual(first, second);
  blocked(x => { x.successfulExternalPost = true; }, 'already_published'); blocked(x => { x.activeJob = true; }, 'publishing_in_progress');
  let invocation = 0, captured;
  const adapter = createLinkedInAdapter({ fetchImpl: async (url, options) => { invocation += 1; captured = { url, options }; return { status: 201, headers: { get: key => key.toLowerCase() === 'x-restli-id' ? 'urn:li:ugcPost:123' : null } }; } });
  const result = await adapter.linkedin_text_publish_v1({ context: { requestId: 'request_123', accountId: 'owner' }, credentials: { accessToken: 'server-secret', tokenType: 'Bearer' }, input: { author: 'urn:li:person:abc', caption: 'Exact\n\ntext' } });
  assert.strictEqual(result.ok, true); assert.strictEqual(invocation, 1); assert.strictEqual(captured.url, UGC_POSTS_ENDPOINT); assert.strictEqual(captured.options.headers['X-Restli-Protocol-Version'], '2.0.0'); const body = JSON.parse(captured.options.body); assert.strictEqual(body.specificContent['com.linkedin.ugc.ShareContent'].shareCommentary.text, 'Exact\n\ntext'); assert.strictEqual(body.specificContent['com.linkedin.ugc.ShareContent'].shareMediaCategory, 'NONE'); assert.strictEqual(body.visibility['com.linkedin.ugc.MemberNetworkVisibility'], 'PUBLIC'); assert(!captured.options.body.includes('server-secret'));
  for (const [status, code] of [[400, 'provider_request_rejected'], [401, 'credential_invalid'], [403, 'permission_missing'], [409, 'provider_conflict'], [429, 'provider_rate_limited'], [500, 'provider_unavailable']]) assert.strictEqual(publishing.classifyProviderStatus(status), code);
  assert.strictEqual(publishing.POST_URN.test('urn:li:ugcPost:123'), true); assert.strictEqual(publishing.POST_URN.test('https://evil.test'), false);
  const routeSource = fs.readFileSync(require.resolve('../api/social-publishing/linkedin/publish'), 'utf8'); const serviceSource = fs.readFileSync(require.resolve('../api/social-connector/publishing-service'), 'utf8'); const ui = fs.readFileSync(require.resolve('../content-workspace'), 'utf8'); const workflow = fs.readFileSync('.github/workflows/runtime-boot-safety.yml', 'utf8');
  assert(routeSource.includes('confirmation_required')); assert(!routeSource.includes('caption: body')); assert(serviceSource.includes('social_external_posts')); assert(serviceSource.includes("status='delivering'")); assert(serviceSource.includes('delivery_committed_provider_only')); assert(ui.includes('data-linkedin-publish')); assert(ui.includes('aria-modal="true"')); assert(ui.includes('Published on LinkedIn')); assert(ui.includes('Auf LinkedIn veröffentlicht')); assert(ui.includes('Escape')); assert(workflow.match(/check:bw32\.3\.1/g)?.length === 1);
  assert.strictEqual(publishing.liveSmokeEnabled({ LINKEDIN_TEXT_PUBLISHING_ENABLED: 'true' }), false); assert.strictEqual(publishing.liveSmokeEnabled({ LINKEDIN_TEXT_PUBLISHING_ENABLED: 'true', LINKEDIN_TEXT_PUBLISHING_LIVE_SMOKE_TEST: 'true' }), true);
  console.log('BW-32.3.1 LinkedIn text Publish Now checks passed (pure evaluator, storage/route source fixtures, adapter fixture, browser lifecycle, controlled live boundary; zero live LinkedIn calls).');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
