(function installTendraOneCanvasDensity(global) {
  "use strict";

  const STORAGE_KEY = "tendra.canvasDensity.v1";
  const DEFAULT_MODE = "compact";
  const MODES = Object.freeze(["compact", "standard", "detailed"]);
  let sessionMode = DEFAULT_MODE;

  function validateMode(value) {
    return MODES.includes(value) ? value : DEFAULT_MODE;
  }

  function readPreference(storage) {
    try {
      const stored = JSON.parse(storage.getItem(STORAGE_KEY));
      sessionMode = stored?.version === 1 ? validateMode(stored.mode) : DEFAULT_MODE;
    } catch (_) {
      sessionMode = DEFAULT_MODE;
    }
    return sessionMode;
  }

  function remember(mode, storage) {
    sessionMode = validateMode(mode);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, mode: sessionMode }));
    } catch (_) {
      // Presentation preference writes fail open; keep the current session choice.
    }
    return sessionMode;
  }

  function applyMarker(canvas, mode) {
    const validated = validateMode(mode);
    canvas.setAttribute("data-tendra-canvas-density", validated);
    return validated;
  }

  const root = global.TendraOnePresentation || {};
  root.canvasDensity = Object.freeze({ STORAGE_KEY, DEFAULT_MODE, MODES, validateMode, readPreference, remember, applyMarker, currentMode: () => sessionMode });
  global.TendraOnePresentation = root;
})(globalThis);
