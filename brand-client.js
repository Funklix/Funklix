"use strict";

(function initBrandClientFoundation(root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.BrandClientFoundation = api;
})(typeof window !== "undefined" ? window : null, function createBrandClientFoundation() {
  const BRAND_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function createState() {
    return {
      summaries: [], summariesLoading: false, summariesError: "",
      activeBrandId: null, activeBrand: null, activeBrandLoading: false, activeBrandError: "", activeBrandVerified: false,
      currentBoardBrandId: null
    };
  }

  function publicError(status, fallback) {
    const error = new Error(fallback);
    error.status = status;
    error.code = status === 401 ? "authentication_required" : status === 404 ? "not_found_or_inaccessible" : status === 409 ? "conflict" : status === 400 ? "validation_error" : "request_failed";
    return error;
  }

  async function requestJson(fetchImpl, url) {
    const response = await fetchImpl(url, { method: "GET", headers: { Accept: "application/json" } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw publicError(response.status, response.status === 401 ? "Authentication required" : response.status === 404 ? "Brand not found or inaccessible" : "Brand request failed");
    return payload;
  }

  function listBrands(fetchImpl) { return requestJson(fetchImpl, "/api/brands"); }
  function getBrand(fetchImpl, id) {
    if (!BRAND_ID_PATTERN.test(String(id || ""))) return Promise.reject(publicError(400, "Invalid Brand ID"));
    return requestJson(fetchImpl, `/api/brands/${encodeURIComponent(id)}`);
  }

  function summaryOf(value) {
    if (!value || typeof value !== "object" || !BRAND_ID_PATTERN.test(String(value.id || ""))) return null;
    return { id: value.id, name: typeof value.name === "string" ? value.name : "", revision: Number(value.revision) || 0, created_at: value.created_at || null, updated_at: value.updated_at || null };
  }

  function createController({ state, fetchImpl }) {
    if (!state || typeof fetchImpl !== "function") throw new Error("Brand controller requires state and fetchImpl");
    let sessionKey = null;
    let sessionVersion = 0;
    let summaryPromise = null;
    let summariesLoaded = false;
    let activeRequestVersion = 0;

    function resetSession(nextSessionKey = null) {
      if (nextSessionKey === sessionKey) return false;
      sessionKey = nextSessionKey;
      sessionVersion += 1;
      activeRequestVersion += 1;
      summaryPromise = null;
      summariesLoaded = false;
      Object.assign(state, createState());
      return true;
    }

    function setCurrentBoardBrandId(value) {
      state.currentBoardBrandId = BRAND_ID_PATTERN.test(String(value || "")) ? String(value) : null;
      return state.currentBoardBrandId;
    }

    function cancelActiveLoad() {
      activeRequestVersion += 1;
      state.activeBrandLoading = false;
    }

    function loadSummaries({ authenticated = false, force = false } = {}) {
      if (!authenticated || !sessionKey) return Promise.resolve([]);
      if (summaryPromise && !force) return summaryPromise;
      if (summariesLoaded && !force) return Promise.resolve(state.summaries);
      const requestedSession = sessionVersion;
      state.summariesLoading = true;
      state.summariesError = "";
      summaryPromise = listBrands(fetchImpl).then((payload) => {
        if (requestedSession !== sessionVersion) return [];
        state.summaries = (Array.isArray(payload?.brands) ? payload.brands : []).map(summaryOf).filter(Boolean);
        summariesLoaded = true;
        return state.summaries;
      }).catch((error) => {
        if (requestedSession === sessionVersion) {
          state.summaries = [];
          state.summariesError = error.code || "request_failed";
          summariesLoaded = false;
        }
        return [];
      }).finally(() => {
        if (requestedSession === sessionVersion) state.summariesLoading = false;
        if (requestedSession === sessionVersion) summaryPromise = null;
      });
      return summaryPromise;
    }

    async function activateBrand(id) {
      const requestVersion = ++activeRequestVersion;
      const requestedSession = sessionVersion;
      state.activeBrandId = null;
      state.activeBrand = null;
      state.activeBrandVerified = false;
      state.activeBrandLoading = true;
      state.activeBrandError = "";
      try {
        const brand = await getBrand(fetchImpl, id);
        if (requestVersion !== activeRequestVersion || requestedSession !== sessionVersion) return null;
        state.activeBrandId = brand.id;
        state.activeBrand = brand;
        state.activeBrandVerified = true;
        return brand;
      } catch (error) {
        if (requestVersion === activeRequestVersion && requestedSession === sessionVersion) state.activeBrandError = error.code || "request_failed";
        return null;
      } finally {
        if (requestVersion === activeRequestVersion && requestedSession === sessionVersion) state.activeBrandLoading = false;
      }
    }

    return { resetSession, loadSummaries, activateBrand, cancelActiveLoad, setCurrentBoardBrandId, getSessionKey: () => sessionKey };
  }

  return Object.freeze({ BRAND_ID_PATTERN, createState, createController, listBrands, getBrand });
});
