'use strict';
const crypto = require('crypto');
const { getSessionUser } = require('./_auth-session');
const { pool } = require('./_boards-storage');
const { createPublishingService, safeDiagnostic } = require('./social-connector/publishing-service');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REF = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
function requestId(req) { const value = req.headers?.['x-request-id']; return typeof value === 'string' && REF.test(value) ? value : `req_${crypto.randomBytes(12).toString('base64url')}`; }
function send(res, status, body) { res.statusCode = status; res.setHeader('content-type', 'application/json; charset=utf-8'); res.setHeader('cache-control', 'private, no-store'); res.end(JSON.stringify(body)); }
async function readBody(req) { if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) { if (Buffer.byteLength(JSON.stringify(req.body)) > 4096) throw new Error('large'); return req.body; } let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) throw new Error('large'); } const parsed = raw ? JSON.parse(raw) : {}; if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape'); return parsed; }
function validInput(body, publish = false) { const keys = ['boardId', 'nodeId', 'destinationId', 'clientRequestId', 'expectedApprovedFingerprint', ...(publish ? ['confirmed'] : [])]; if (Object.keys(body).some(key => !keys.includes(key) || ['__proto__', 'prototype', 'constructor'].includes(key))) return false; return UUID.test(body.boardId || '') && REF.test(body.nodeId || '') && UUID.test(body.destinationId || '') && REF.test(body.clientRequestId || '') && REF.test(body.expectedApprovedFingerprint || '') && (!publish || body.confirmed === true); }
function actor(req) { const user = getSessionUser(req); const ownerAccountId = user?.email || user?.id || ''; return ownerAccountId ? { user, ownerAccountId } : null; }
function service() { return createPublishingService({ pool }); }
module.exports = { UUID, REF, requestId, send, readBody, validInput, actor, service, safeDiagnostic, pool };
