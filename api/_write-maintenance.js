'use strict';
const { AsyncLocalStorage } = require('node:async_hooks');
const requests = new AsyncLocalStorage();
const CODE = 'TENDRA_WRITE_MAINTENANCE';
const MESSAGE = 'Database writes are temporarily paused for maintenance. Please retry after maintenance ends.';
const RETRY_SECONDS = '60';
// SQL grammar constructs with parentheses, and the read-only builtins used by
// this application's queries. Unreviewed functions fail closed during maintenance.
const READ_CALLS = new Set(`select and or on where join lateral any all array as case to_char pg_get_constraintdef pg_get_indexdef coalesce count date_trunc exists filter greatest least lower upper max min nullif now
  array_agg array_length cardinality jsonb_agg json_agg jsonb_build_object json_build_object jsonb_array_elements jsonb_typeof
  length octet_length string_agg substring btrim trim to_regclass pg_has_role pg_advisory_xact_lock hashtextextended
  current_setting to_jsonb row_number over in not values extract cast encode digest round sum bool_or bool_and`.split(/\s+/));
function enabled() { return /^(1|true|on)$/i.test(String(process.env.TENDRA_WRITE_MAINTENANCE || '').trim()); }
function maintenanceError() {
  const context = requests.getStore();
  if (context) context.blocked = true;
  return Object.assign(new Error(MESSAGE), { code: CODE, status: 503, retryable: true });
}
function assertWritesAllowed() { if (enabled()) throw maintenanceError(); }

// Tokenize SQL, ignoring comments and values (including dollar-quoted bodies), but
// retaining quoted identifiers. This detects writable CTEs and SELECT-based write
// functions without mistaking a user's string value for a SQL operation.
function sqlCode(sql) {
  return sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\/|'(?:''|[^'])*'|\$(?:[a-z_][a-z_0-9]*)?\$[\s\S]*?\$(?:[a-z_][a-z_0-9]*)?\$|"(?:""|[^"])*"/gi, token =>
    token.startsWith('"') ? token.slice(1, -1).replace(/""/g, '"').toLowerCase() : ' ').toLowerCase();
}
function isReadQuery(query, values) {
  const text = typeof query === 'string' ? query : query?.text;
  if (typeof text !== 'string') return false;
  const sql = sqlCode(text).trim().replace(/;\s*$/, '');
  // Multiple statements and session changes fail closed. Transaction boundaries
  // remain available so read transactions and rollback cleanup keep working.
  if (sql.includes(';')) return false;
  if (/^(?:begin(?:\s+(?:transaction|work))?(?:\s+isolation\s+level\s+serializable)?|commit|rollback)$/.test(sql)) return true;
  if (/^set\s+local\s+lock_timeout\s*=\s*$/.test(sql)) return true; // a bounded session timeout, never data
  // Audited preview mode performs authorization and computes a diff, then returns
  // before write_brand's first DML. Match the complete invocation, not a substring.
  const params = values || query?.values;
  if (/^select\s+brand_knowledge_private\s*\.\s*write_brand\s*\(\s*\$1\s*,\s*\$2::uuid\s*,\s*\$3::jsonb\s*,\s*(?:null\s*,\s*true|\$4::jsonb\s*,\s*\$5)\s*\)\s+as\s+outcome$/.test(sql)) {
    return Array.isArray(params) && (/null\s*,\s*true/.test(sql) || params[4] === true);
  }
  if (!/^(select|with)\b/.test(sql)) return false;
  if (/\b(insert|delete|merge|into|create|alter|drop|truncate|grant|revoke|copy|call|do|set|reset|nextval|setval|set_config|pg_notify|pg_logical_emit_message|lo_import|lo_export|dblink_exec)\b/.test(sql)) return false;
  if (/\bupdate\b/.test(sql.replace(/\bfor\s+(?:no\s+key\s+)?update\b/g, ''))) return false;
  if (/\bbrand_knowledge_private\s*\.\s*(write_brand|create_brand|lifecycle)\s*\(/.test(sql)) return false;
  for (const match of sql.matchAll(/([a-z_][a-z_0-9]*(?:\s*\.\s*[a-z_][a-z_0-9]*)*)\s*\(/g)) {
    const name = match[1].replace(/\s/g, '');
    if (name === 'brand_knowledge_private.logo_receipt') continue; // audited read-only receipt
    if (name === 'tendra_runtime_private.lock_brand') continue; // audited lock-only helper
    if (name.includes('.') && !name.startsWith('pg_catalog.')) return false;
    if (!READ_CALLS.has(name.replace(/^pg_catalog\./, ''))) return false;
  }
  return true;
}
function check(query, values) { if (enabled() && !isReadQuery(query, values)) throw maintenanceError(); }
const guardedQueries = new WeakSet();
function guardQuery(target) {
  if (guardedQueries.has(target)) return target;
  guardedQueries.add(target);
  const original = target.query;
  target.query = function (...args) {
    const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
    try { check(args[0], args[1]); } catch (error) { if (callback) { queueMicrotask(() => callback(error)); return; } return Promise.reject(error); }
    return original.apply(this, args);
  };
  return target;
}
function guardPool(pool) {
  guardQuery(pool);
  const connect = pool.connect;
  pool.connect = function (callback) {
    if (typeof callback === 'function') return connect.call(this, (error, client, release) => callback(error, client && guardQuery(client), release));
    return connect.call(this).then(guardQuery);
  };
  return pool;
}
function respond(res) {
  res.statusCode = 503;
  for (const header of ['Location', 'Content-Length', 'Content-Encoding', 'ETag']) res.removeHeader?.(header);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Retry-After', RETRY_SECONDS);
  return JSON.stringify({ ok: false, code: CODE, error: { code: CODE, message: MESSAGE }, message: MESSAGE, retryable: true });
}
function withMaintenanceResponse(handler) {
  function wrapped(req, res) {
    if (!enabled()) return handler(req, res);
    return requests.run({ blocked: false }, async () => {
      const end = res.end;
      const json = res.json;
      // Existing handlers may translate or swallow database errors. Preserve the
      // maintenance result across those catches, including OAuth redirect handlers.
      res.end = function (...args) {
        if (requests.getStore()?.blocked && !res.headersSent) args = [respond(res)];
        return end.apply(this, args);
      };
      if (json) res.json = function (body) {
        if (requests.getStore()?.blocked && !res.headersSent) return res.end(respond(res));
        return json.call(this, body);
      };
      try { return await handler(req, res); }
      catch (error) { if (error?.code === CODE && !res.headersSent) return res.end(respond(res)); throw error; }
    });
  }
  Object.assign(wrapped, handler);
  if (handler.createHandler) wrapped.createHandler = (...args) => withMaintenanceResponse(handler.createHandler(...args));
  return wrapped;
}
module.exports = { CODE, MESSAGE, enabled, assertWritesAllowed, isReadQuery, guardPool, withMaintenanceResponse };
