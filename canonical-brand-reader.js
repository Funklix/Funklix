(function (root) {
  'use strict';
  // One bounded, volatile detail owner shared by Profile and Home. Catalog
  // membership permits a request; only the canonical response authorizes Core.
  function create({ context, validate, fetchImpl = root.fetch.bind(root), timeout = 12000 }) {
    let entry = null;
    const equal = (a, b) => !!a && !!b && ['account', 'identity', 'catalog', 'generation', 'workspaceId', 'selectedBrandId', 'brandId', 'revision'].every(k => a[k] === b[k]);
    function retire() { entry?.controller?.abort(); entry = null; }
    function current() { if (entry && !equal(entry.scope, context(entry.scope.brandId))) retire(); }
    function failure(status) { const error = new Error('Canonical Brand unavailable'); error.status = status; return error; }
    function read(brandId, { force = false } = {}) {
      current();
      const scope = context(brandId);
      if (!scope) return Promise.reject(failure(403));
      if (entry && (!equal(entry.scope, scope) || force && entry.settled && !entry.confirmedSave)) retire();
      if (entry) { entry.confirmedSave = false; return entry.promise; }
      const token = { scope, controller: new AbortController() }; entry = token;
      token.promise = (async () => {
        const timer = root.setTimeout(() => token.controller.abort(), timeout);
        try {
          const response = await fetchImpl('/api/brands/' + encodeURIComponent(brandId), {
            credentials: 'same-origin', cache: 'no-store', headers: { Accept: 'application/json' }, signal: token.controller.signal
          });
          const active = () => entry === token && !token.controller.signal.aborted && equal(scope, context(brandId));
          if (!active()) throw failure(409);
          if (!response.ok) throw failure(response.status);
          const brand = await response.json();
          if (!active()) throw failure(409);
          if (!validate(brand, brandId) || brand.revision < (scope.revision || 1)) throw failure(422);
          token.settled = true; return brand;
        } catch (error) {
          if (entry === token) entry = null;
          throw error?.name === 'AbortError' ? failure(408) : error;
        } finally { root.clearTimeout(timer); }
      })();
      return token.promise;
    }
    function accept(brand) {
      retire();
      const scope = context(brand.id);
      if (scope && validate(brand, brand.id) && brand.revision >= (scope.revision || 1))
        entry = { scope, settled: true, confirmedSave: true, promise: Promise.resolve(brand) };
    }
    return Object.freeze({ read, accept, current, retire });
  }
  root.FunklixCanonicalBrandReader = Object.freeze({ create });
  if (typeof module === 'object' && module.exports) module.exports = root.FunklixCanonicalBrandReader;
}(typeof globalThis !== 'undefined' ? globalThis : window));
