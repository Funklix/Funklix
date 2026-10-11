(function installAdaptiveCanvasView(global) {
  'use strict';
  function create() {
    let selected = null, detail = false, mode = 'compact', hovered = null, focused = null;
    let paused = false;
    const frozen = new Map();
    const view = id => {
      if (mode === 'standard' || mode === 'detailed') return mode;
      if (paused) return frozen.get(id) || 'compact';
      if (id === selected) return detail ? 'detailed' : 'standard';
      return id === focused || id === hovered ? 'standard' : 'compact';
    };
    return Object.freeze({
      view,
      snapshot: () => ({ selected, detail, mode, hovered, focused, paused }),
      reset() { selected = hovered = focused = null; detail = paused = false; mode = 'compact'; frozen.clear(); },
      select(id) { if (selected !== id) detail = false; selected = id; hovered = focused = null; },
      details(id) { selected = id; detail = true; hovered = focused = null; },
      hover(id) { hovered = id; },
      focus(id) { focused = id; },
      setMode(value) {
        if (!['compact', 'standard', 'detailed'].includes(value)) return;
        mode = value;
        if (mode === 'compact') { selected = hovered = focused = null; detail = false; frozen.clear(); }
      },
      clear() { selected = hovered = focused = null; detail = false; },
      escape() {
        if (!selected) return false;
        if (detail) detail = false;
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
        for (const id of frozen.keys()) if (!valid.has(id)) frozen.delete(id);
        if (!valid.has(selected)) { selected = null; detail = false; }
        if (!valid.has(hovered)) hovered = null;
        if (!valid.has(focused)) focused = null;
      }
    });
  }
  global.TendraAdaptiveCanvasView = Object.freeze({ create });
})(globalThis);
