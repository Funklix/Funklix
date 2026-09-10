(function (root, factory) {
  const api = factory(root && root.localStorage);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.TendraCanvasDensity = api;
})(typeof window !== "undefined" ? window : null, function (storage) {
  "use strict";
  const STORAGE_KEY = "tendra.canvasDensity.v1";
  const MODES = Object.freeze(["compact", "standard", "detailed"]);
  const DEFAULT_MODE = "compact";
  const valid = (value) => typeof value === "string" && MODES.includes(value) ? value : DEFAULT_MODE;
  function restore(source = storage) {
    try {
      const parsed = JSON.parse(source?.getItem(STORAGE_KEY));
      return parsed && !Array.isArray(parsed) && parsed.version === 1 ? valid(parsed.mode) : DEFAULT_MODE;
    } catch (_) { return DEFAULT_MODE; }
  }
  let mode = restore();
  function setMode(value, source = storage) {
    mode = valid(value);
    try { source?.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode })); } catch (_) { /* in-memory choice remains active */ }
    return mode;
  }
  return Object.freeze({ STORAGE_KEY, MODES, DEFAULT_MODE, valid, restore, getMode: () => mode, setMode });
});
