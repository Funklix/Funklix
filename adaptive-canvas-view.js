(function installAdaptiveCanvasView(global) {
  'use strict';
  function create() {
    let selected = null, detail = false, forced = false, hovered = null, focused = null;
    let paused = false;
    const frozen = new Map();
    const view = id => {
      if (forced) return 'compact';
      if (paused) return frozen.get(id) || 'compact';
      if (id === selected) return detail ? 'detailed' : 'standard';
      return id === focused || id === hovered ? 'standard' : 'compact';
    };
    return Object.freeze({
      view,
      snapshot: () => ({ selected, detail, forced, hovered, focused, paused }),
      reset() { selected = hovered = focused = null; detail = forced = paused = false; frozen.clear(); },
      select(id) { if (selected !== id) detail = false; selected = id; hovered = focused = null; },
      details(id) { selected = id; detail = true; forced = false; hovered = focused = null; },
      hover(id) { hovered = id; },
      focus(id) { focused = id; },
      compact(value) { forced = !!value; hovered = focused = null; },
      clear() { selected = hovered = focused = null; detail = false; },
      escape() {
        if (!selected) return false;
        if (detail && !forced) detail = false;
        else { selected = hovered = focused = null; detail = false; }
        return true;
      },
      pause(value, ids = []) {
        if (value === paused) return;
        if (value) { frozen.clear(); ids.forEach(id => frozen.set(id, view(id))); }
        paused = !!value;
        if (!paused) frozen.clear();
      },
      prune(ids) {
        const valid = new Set(ids);
        if (!valid.has(selected)) { selected = null; detail = false; }
        if (!valid.has(hovered)) hovered = null;
        if (!valid.has(focused)) focused = null;
      }
    });
  }
  global.TendraAdaptiveCanvasView = Object.freeze({ create });
})(globalThis);
