"use strict";

// Minimal deterministic representation of the unsafe lifecycle established by BW-33.3A.
// This intentionally contains no application data and must never be loaded by production code.
function runUnsafeDensityLifecycle() {
  const events = [];
  const state = { sessionResolved: false, activeBoardId: null, boardLoaded: false };
  let accessWarningShown = false;
  let firstException = null;

  function applyDensity({ fail = false } = {}) {
    events.push("density-application");
    if (fail) throw new Error("injected density failure");
  }

  function updateNodeCard() {
    events.push("updateNodeCard");
    applyDensity({ fail: true });
  }

  function renderNode() {
    events.push("renderNode");
    updateNodeCard();
  }

  function applyCampaignState() {
    events.push("applyCampaignState");
    renderNode();
  }

  function bootApp() {
    events.push("boot-start");
    applyDensity();
    state.sessionResolved = true;
    events.push("session-resolved");
  }

  function loadBoardFromUrlIfPresent() {
    try {
      events.push("authoritative-board-success");
      state.activeBoardId = "fixture-board";
      applyCampaignState();
      state.boardLoaded = true;
    } catch (error) {
      firstException = error;
      accessWarningShown = true;
      state.activeBoardId = null;
    }
  }

  bootApp();
  loadBoardFromUrlIfPresent();
  return { events, state, accessWarningShown, firstException };
}

module.exports = Object.freeze({ runUnsafeDensityLifecycle });
