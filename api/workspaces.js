'use strict';

const crypto = require('crypto');
const { getSessionUser } = require('./_auth-session');
const { pool } = require('./_boards-storage');
const { APP_IDENTITY_ERRORS, lookupRequestFromVerifiedSession, validateIdentityRow, compareIdentityToSessionEmail } = require('./_app-identity');
const { WorkspaceCatalogError, loadWorkspaceCatalog } = require('./_workspace-catalog');
const { validateWorkspaceName } = require('../workspace-name');

const CONTRACT = 'workspace_catalog_v1';
const UPDATE_CONTRACT = 'workspace_update_v1';
const CREATE_CONTRACT = 'workspace_create_v1';
const CREATE_V2_CONTRACT = 'workspace_create_v2';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDENTITY_SELECT = 'SELECT id, canonical_email, status, revision FROM public.app_identities WHERE canonical_email = $1 ORDER BY id LIMIT 2';
const ERROR_STATUS = Object.freeze({ METHOD_NOT_ALLOWED: 405, AUTHENTICATION_REQUIRED: 401, SESSION_INVALID: 401,
  IDENTITY_INVALID: 422, IDENTITY_DISABLED: 403, IDENTITY_AMBIGUOUS: 409, WORKSPACE_SCHEMA_UNAVAILABLE: 503,
  WORKSPACE_CATALOG_CONFLICT: 409, REQUEST_INVALID: 400, WORKSPACE_NAME_INVALID: 422, WORKSPACE_ALREADY_EXISTS: 409, WORKSPACE_CREATE_CONFLICT: 409,
  DATABASE_UNAVAILABLE: 503, RESPONSE_INVALID: 500, INTERNAL_ERROR: 500 });
const UPDATE_ERROR_STATUS = Object.freeze({ WORKSPACE_NOT_FOUND:404, MEMBERSHIP_REQUIRED:403, PERMISSION_DENIED:403,
  INVALID_WORKSPACE_NAME:422, WORKSPACE_CHANGED:409, DATABASE_UNAVAILABLE:503, RESPONSE_INVALID:500, INTERNAL_ERROR:500 });

function requestId() { return crypto.randomBytes(12).toString('hex'); }
function durationBucket(started) { const ms = Date.now() - started; return ms < 100 ? 'lt_100ms' : ms < 500 ? 'lt_500ms' : 'gte_500ms'; }
function send(res, status, body) { res.status(status); return res.json(body); }
function failure(res, id, code, stage, contract = CONTRACT) { return send(res, UPDATE_ERROR_STATUS[code] || ERROR_STATUS[code] || 500, { contract, request_id: id, error: { code, stage } }); }
function identityCode(code) {
  if (code === APP_IDENTITY_ERRORS.DISABLED) return 'IDENTITY_DISABLED';
  if (code === APP_IDENTITY_ERRORS.AMBIGUOUS) return 'IDENTITY_AMBIGUOUS';
  return 'IDENTITY_INVALID';
}
function databaseCode(error) {
  if (['42P01', '42703', '42883'].includes(error?.code)) return 'WORKSPACE_SCHEMA_UNAVAILABLE';
  if (['ECONNREFUSED', 'ETIMEDOUT', '57P01', '57P03'].includes(error?.code)) return 'DATABASE_UNAVAILABLE';
  return 'INTERNAL_ERROR';
}
function identityRows(result) {
  return result && typeof result === 'object' && !Array.isArray(result) && Array.isArray(result.rows)
    ? result.rows : null;
}
function updateRequest(body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
  if (keys.length !== 5 || keys.some((key) => !['contract','workspace_id','expected_revision','name','request_id'].includes(key))
    || body.contract !== UPDATE_CONTRACT || !UUID.test(body.workspace_id || '') || !Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0 || typeof body.name !== 'string'
    || typeof body.request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(body.request_id)) return null;
  return { ...body };
}
function createRequest(body) {
  const keys = body && typeof body === 'object' && !Array.isArray(body) ? Object.keys(body) : [];
  const v2 = body?.contract === CREATE_V2_CONTRACT;
  if (keys.length !== (v2 ? 4 : 3) || keys.some((key) => !(v2 ? ['contract','request_id','name','workspace_id'] : ['contract','request_id','name']).includes(key))
    || ![CREATE_CONTRACT, CREATE_V2_CONTRACT].includes(body.contract) || (v2 && !UUID.test(body.workspace_id || '')) || typeof body.name !== 'string'
    || typeof body.request_id !== 'string' || !/^[A-Za-z0-9._:-]{1,64}$/.test(body.request_id)) return null;
  const checked = validateWorkspaceName(body.name);
  return checked.ok ? { requestId: body.request_id, name: checked.name, ...(v2 ? { workspaceId: body.workspace_id.toLowerCase() } : {}) } : { requestId: body.request_id, invalidName: true };
}

async function createFirstWorkspace({ db, canonicalEmail, input }) {
  const client = typeof db.connect === 'function' ? await db.connect() : db;
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 3613))`, [canonicalEmail]);
    const identityResult = await client.query(input.workspaceId ? IDENTITY_SELECT + ' FOR UPDATE' : IDENTITY_SELECT, [canonicalEmail]);
    const rows = identityRows(identityResult);
    if (!rows) throw Object.assign(new Error('identity response invalid'), { workspaceCode: 'INTERNAL_ERROR', workspaceStage: 'identity' });
    let identity = validateIdentityRow(rows);
    if (!identity.ok && identity.code === APP_IDENTITY_ERRORS.NOT_FOUND) {
      const inserted = await client.query(`INSERT INTO public.app_identities (canonical_email, status, revision)
        VALUES ($1, 'active', 0) RETURNING id, canonical_email, status, revision`, [canonicalEmail]);
      identity = validateIdentityRow(inserted.rows || []);
    }
    if (!identity.ok) {
      const code = identity.code === APP_IDENTITY_ERRORS.DISABLED ? 'IDENTITY_DISABLED'
        : identity.code === APP_IDENTITY_ERRORS.AMBIGUOUS ? 'IDENTITY_AMBIGUOUS' : 'IDENTITY_INVALID';
      throw Object.assign(new Error('identity rejected'), { workspaceCode: code, workspaceStage: 'identity' });
    }
    const match = compareIdentityToSessionEmail(identity, canonicalEmail);
    if (!match.ok) throw Object.assign(new Error('identity mismatch'), { workspaceCode: 'SESSION_INVALID', workspaceStage: 'identity' });
    if (input.workspaceId) {
      // Email serialization also covers identity bootstrap/v1. UUID serialization
      // covers collisions across creators; all writers retain the PK guarantee.
      await client.query('SELECT pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended($1, 3622))', [input.workspaceId]);
      const existing = await client.query(`SELECT id, name, revision, status, created_by_identity_id
        FROM public.workspaces WHERE id = $1 FOR UPDATE`, [input.workspaceId]);
      if (!Array.isArray(existing.rows)) throw new Error('invalid workspace response');
      if (existing.rows.length) {
        const workspace = existing.rows[0];
        const membership = await client.query(`SELECT role, status, revision FROM public.workspace_memberships
          WHERE workspace_id = $1 AND identity_id = $2 FOR UPDATE`, [input.workspaceId, match.identityId]);
        const owner = membership.rows?.[0];
        // Mutable names cannot prove the original input after a rename. Fence
        // replays at the initial revisions rather than accepting a changed name.
        if (workspace.created_by_identity_id !== match.identityId || workspace.status !== 'active'
          || workspace.name !== input.name || Number(workspace.revision) !== 1
          || owner?.role !== 'owner' || owner.status !== 'accepted' || Number(owner.revision) !== 1) {
          throw Object.assign(new Error('creation conflict'), { workspaceCode: 'WORKSPACE_CREATE_CONFLICT', workspaceStage: 'replay' });
        }
        await client.query('COMMIT');
        return { created: false, workspace: { id: workspace.id, name: workspace.name, role: 'owner', revision: 1, brands: [], boards: [] } };
      }
    }
    const memberships = input.workspaceId ? { rows: [] } : await client.query(`SELECT w.id, w.name, w.revision, m.role
      FROM public.workspace_memberships m JOIN public.workspaces w ON w.id = m.workspace_id
      WHERE m.identity_id = $1 AND m.status = 'accepted' AND w.status = 'active'
      ORDER BY w.id FOR UPDATE OF w, m`, [match.identityId]);
    if (!Array.isArray(memberships.rows)) throw Object.assign(new Error('membership response invalid'), { workspaceCode: 'INTERNAL_ERROR', workspaceStage: 'membership' });
    if (!input.workspaceId && memberships.rows.length) {
      if (memberships.rows.length === 1 && memberships.rows[0].role === 'owner' && validateWorkspaceName(memberships.rows[0].name)?.name === input.name) {
        await client.query('COMMIT');
        return { created: false, workspace: { id: memberships.rows[0].id, name: memberships.rows[0].name, role: 'owner', revision: Number(memberships.rows[0].revision), brands: [], boards: [] } };
      }
      throw Object.assign(new Error('workspace exists'), { workspaceCode: 'WORKSPACE_ALREADY_EXISTS', workspaceStage: 'authorization' });
    }
    const workspaceResult = input.workspaceId
      ? await client.query(`INSERT INTO public.workspaces (id, name, locale, status, created_by_identity_id)
        VALUES ($1, $2, 'en', 'active', $3) RETURNING id, name, revision`, [input.workspaceId, input.name, match.identityId])
      : await client.query(`INSERT INTO public.workspaces (name, locale, status, created_by_identity_id)
        VALUES ($1, 'en', 'active', $2) RETURNING id, name, revision`, [input.name, match.identityId]);
    const workspace = workspaceResult.rows?.[0];
    if (!workspace || !UUID.test(workspace.id || '') || workspace.name !== input.name || !Number.isSafeInteger(Number(workspace.revision))) {
      throw Object.assign(new Error('workspace response invalid'), { workspaceCode: 'INTERNAL_ERROR', workspaceStage: 'workspace' });
    }
    await client.query(`INSERT INTO public.workspace_memberships (workspace_id, identity_id, role, status, revision)
      VALUES ($1, $2, 'owner', 'accepted', 1)`, [workspace.id, match.identityId]);
    const owners = await client.query(`SELECT count(*)::int AS count FROM public.workspace_memberships
      WHERE workspace_id = $1 AND role = 'owner' AND status = 'accepted'`, [workspace.id]);
    if (owners.rows?.[0]?.count !== 1) throw Object.assign(new Error('owner invariant failed'), { workspaceCode: 'INTERNAL_ERROR', workspaceStage: 'owner_validation' });
    await client.query('COMMIT');
    return { created: true, workspace: { id: workspace.id, name: workspace.name, role: 'owner', revision: Number(workspace.revision), brands: [], boards: [] } };
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch {}
    throw error;
  } finally { if (client !== db) client.release(); }
}

function createHandler({ sessionReader = getSessionUser, db = pool, catalogLoader = loadWorkspaceCatalog } = {}) {
  return async function handler(req, res) {
    const id = requestId(); const started = Date.now();
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Request-Id', id);
    const contract = req.method === 'PATCH' ? UPDATE_CONTRACT : req.method === 'POST' ? (req.body?.contract === CREATE_V2_CONTRACT ? CREATE_V2_CONTRACT : CREATE_CONTRACT) : CONTRACT;
    if (!['GET','PATCH','POST'].includes(req.method)) { res.setHeader('Allow', 'GET, PATCH, POST'); return failure(res, id, 'METHOD_NOT_ALLOWED', 'method', contract); }
    let user;
    try { user = sessionReader(req); } catch { return failure(res, id, 'SESSION_INVALID', 'session', contract); }
    if (!user) {
      const hasSessionCookie = /(?:^|;\s*)funklix_session=/.test(req.headers?.cookie || '');
      return failure(res, id, hasSessionCookie ? 'SESSION_INVALID' : 'AUTHENTICATION_REQUIRED', 'session', contract);
    }
    const lookup = lookupRequestFromVerifiedSession({ verified: true, user });
    if (!lookup.ok) return failure(res, id, 'SESSION_INVALID', 'session', contract);
    if (req.method === 'POST') {
      const input = createRequest(req.body);
      if (!input) return failure(res, id, 'REQUEST_INVALID', 'request', contract);
      if (input.invalidName) return failure(res, id, 'WORKSPACE_NAME_INVALID', 'name', contract);
      try {
        const result = await createFirstWorkspace({ db, canonicalEmail: lookup.canonicalEmail, input });
        console.info('[WORKSPACE_CREATE]', { request_id: id, stage: 'complete', code: 'OK', created: result.created, duration_bucket: durationBucket(started) });
        return send(res, result.created ? 201 : 200, { contract, request_id: input.requestId, ok: true, ...result });
      } catch (error) {
        const code = error.workspaceCode || (input.workspaceId && error?.code === '23505' ? 'WORKSPACE_CREATE_CONFLICT' : databaseCode(error)); const stage = error.workspaceStage || 'transaction';
        console.error('[WORKSPACE_CREATE]', { request_id: id, stage, code, created: false, duration_bucket: durationBucket(started) });
        return failure(res, id, code, stage, contract);
      }
    }
    let currentStage = 'identity_query_construction';
    const diagnostic = (stage, code = 'OK') => {
      currentStage = stage;
      console.info('[WORKSPACE_CATALOG_STAGE]', { request_id: id, stage, code });
    };
    try {
      diagnostic('identity_query_construction');
      diagnostic('identity_query_execution');
      const identityResult = await db.query(IDENTITY_SELECT, [lookup.canonicalEmail]);
      diagnostic('identity_response_normalization');
      const rows = identityRows(identityResult);
      if (!rows) {
        diagnostic('identity_response_normalization', 'IDENTITY_INVALID');
        return failure(res, id, 'IDENTITY_INVALID', 'identity', contract);
      }
      diagnostic('identity_row_validation');
      const identity = validateIdentityRow(rows);
      if (!identity.ok && identity.code === APP_IDENTITY_ERRORS.NOT_FOUND) {
        if (req.method === 'PATCH') return failure(res, id, 'IDENTITY_INVALID', 'identity', contract);
        return send(res, 200, { contract: CONTRACT, request_id: id, workspaces: [] });
      }
      if (!identity.ok) {
        diagnostic('identity_row_validation', identityCode(identity.code));
        return failure(res, id, identityCode(identity.code), 'identity', contract);
      }
      diagnostic('identity_canonical_comparison');
      const match = compareIdentityToSessionEmail(identity, lookup.canonicalEmail);
      if (!match.ok) {
        diagnostic('identity_canonical_comparison', 'IDENTITY_INVALID');
        return failure(res, id, 'IDENTITY_INVALID', 'identity', contract);
      }
      if (req.method === 'PATCH') {
        const input = updateRequest(req.body);
        if (!input) return failure(res, id, 'INVALID_WORKSPACE_NAME', 'request', UPDATE_CONTRACT);
        const client = typeof db.connect === 'function' ? await db.connect() : db;
        let roleCategory = 'none'; let changed = false;
        try {
          await client.query('BEGIN');
          const workspaceResult = await client.query(`SELECT id, name, avatar_url, locale, revision, status FROM public.workspaces WHERE id = $1 FOR UPDATE`, [input.workspace_id]);
          const workspace = workspaceResult.rows?.[0];
          if (!workspace || workspace.status !== 'active') { await client.query('ROLLBACK'); return failure(res,id,'WORKSPACE_NOT_FOUND','workspace',UPDATE_CONTRACT); }
          const membershipResult = await client.query(`SELECT role, status FROM public.workspace_memberships WHERE workspace_id = $1 AND identity_id = $2 FOR UPDATE`, [input.workspace_id, match.identityId]);
          const membership = membershipResult.rows?.[0];
          if (!membership || membership.status !== 'accepted') { await client.query('ROLLBACK'); return failure(res,id,'MEMBERSHIP_REQUIRED','membership',UPDATE_CONTRACT); }
          roleCategory = ['owner','admin'].includes(membership.role) ? membership.role : 'read_only';
          if (!['owner','admin'].includes(membership.role)) { await client.query('ROLLBACK'); return failure(res,id,'PERMISSION_DENIED','authorization',UPDATE_CONTRACT); }
          if (Number(workspace.revision) !== input.expected_revision) { await client.query('ROLLBACK'); return failure(res,id,'WORKSPACE_CHANGED','revision',UPDATE_CONTRACT); }
          const checkedName = validateWorkspaceName(input.name);
          if (!checkedName.ok) { await client.query('ROLLBACK'); return failure(res,id,'INVALID_WORKSPACE_NAME','name',UPDATE_CONTRACT); }
          input.name = checkedName.name;
          let updated = workspace;
          if (workspace.name !== input.name) {
            changed = true;
            const result = await client.query(`UPDATE public.workspaces SET name = $2, revision = revision + 1, updated_at = now() WHERE id = $1 RETURNING id, name, avatar_url, locale, revision`, [input.workspace_id,input.name]);
            updated = result.rows?.[0];
            if (!updated) throw Object.assign(new Error('update failed'), { code:'RESPONSE_INVALID' });
          }
          await client.query('COMMIT');
          console.info('[WORKSPACE_UPDATE]', { request_id:id, stage:'complete', code:'OK', role_category:roleCategory, changed, duration_bucket:durationBucket(started) });
          return send(res,200,{contract:UPDATE_CONTRACT,request_id:input.request_id,workspace:{id:updated.id,name:updated.name,avatar_url:updated.avatar_url||null,locale:updated.locale||null,revision:Number(updated.revision),role:membership.role}});
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch {}
          const code = error?.code === 'RESPONSE_INVALID' ? 'RESPONSE_INVALID' : databaseCode(error);
          console.error('[WORKSPACE_UPDATE]', { request_id:id, stage:'transaction', code, role_category:roleCategory, changed:false, duration_bucket:durationBucket(started) });
          return failure(res,id,code,'transaction',UPDATE_CONTRACT);
        } finally { if (client !== db) client.release(); }
      }
      const workspaces = await catalogLoader({ db, identityId: match.identityId, canonicalEmail: lookup.canonicalEmail, diagnostic });
      console.info('[WORKSPACE_CATALOG]', { request_id: id, stage: 'complete', code: 'OK', workspace_count: workspaces.length,
        brand_count: workspaces.reduce((n, w) => n + w.brands.length, 0), board_count: workspaces.reduce((n, w) => n + w.boards.length, 0),
        membership_count: workspaces.length, duration_bucket: durationBucket(started) });
      diagnostic('response_construction');
      return send(res, 200, { contract: CONTRACT, request_id: id, workspaces });
    } catch (error) {
      const code = error instanceof WorkspaceCatalogError ? error.code : databaseCode(error);
      const stage = error instanceof WorkspaceCatalogError ? error.stage : 'database';
      const diagnosticStage = error instanceof WorkspaceCatalogError ? error.stage : currentStage;
      console.error('[WORKSPACE_CATALOG]', { request_id: id, stage: diagnosticStage, code, workspace_count: 0, brand_count: 0, board_count: 0,
        membership_count: 0, duration_bucket: durationBucket(started) });
      return failure(res, id, code, stage, contract);
    }
  };
}

module.exports = createHandler();
module.exports.createHandler = createHandler;
module.exports.CONTRACT = CONTRACT;
module.exports.UPDATE_CONTRACT = UPDATE_CONTRACT;
module.exports.CREATE_CONTRACT = CREATE_CONTRACT;
module.exports.updateRequest = updateRequest;
module.exports.createRequest = createRequest;
module.exports.createFirstWorkspace = createFirstWorkspace;
module.exports.IDENTITY_SELECT = IDENTITY_SELECT;

module.exports.CREATE_V2_CONTRACT = CREATE_V2_CONTRACT;
