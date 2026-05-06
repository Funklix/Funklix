console.info("Campaign Canvas build: 2026-04-27-fix");
const NODE_TYPES = {
  Idea: { color: "#6b4eff" },
  "Campaign Variation": { color: "#2f7ef7" },
  Content: { color: "#16a47b" },
  "Social Media Posting": { color: "#f56f46" },
  "Landing Page": { color: "#a04ad8" },
  "Email Campaign": { color: "#d8961a" }
};

const NODE_WIDTH = 285;
const NODE_HEIGHT = 200;
const BOARD_WIDTH = 10000;
const BOARD_HEIGHT = 10000;
const STORAGE_KEY = "campaignCanvasState";
const BRAND_CORE_STORAGE_KEY = "brandBrainState";

let activeLightbox = null;

const state = {
  nodes: [],
  edges: [],
  selectedIds: new Set(),
  selectedPrimary: null,
  zoom: 1,
  nodeCounter: 1,
  postitCounter: 1,
  activeConnection: null,
  activeConnectionMoveHandler: null,
  activeConnectionPlaceHandler: null,
  lastAutoZoomAt: 0,
  connectorCreateMode: null,
  connectorGhostEl: null,
  contextBoardPoint: { x: 0, y: 0 },
  contextNodeId: null,
  activeView: "board",
  calendarMonth: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  postingPlannerNodeId: null
  ,currentBoardId: null
  ,lastKnownUpdatedAt: null
  ,autosaveTimer: null
  ,isDirty: false
  ,isSaving: false
  ,conflictModalOpen: false
  ,autosavePausedUntilChange: false
  ,isBoardLoading: true
  ,lastSavedSnapshot: ""
  ,history: []
  ,forcePanNextDrag: false
  ,brandCore: {
    brandCore: "",
    toneOfVoice: [],
    messagingPillars: [],
    valueProposition: "",
    personas: [],
    contentGuidelines: [],
    dosAndDonts: { dos: [], donts: [] },
    brandVoiceExamples: { good: "", avoid: "" },
    keywords: [],
    brandAssets: { domain: "", logo: "", colors: [], typography: "", references: [] },
    customTiles: []
  },
  brandCoreSelectedKey: "brandCore"
  ,appMode: "canvas"
  ,boardsLibrary: []
};

const el = {
  appShell: document.querySelector(".app-shell"),
  leftSidebar: document.getElementById("left-sidebar"),
  workspaceWrap: document.querySelector(".workspace-wrap"),
  canvas: document.getElementById("canvas"),
  canvasTopbar: document.getElementById("canvas-topbar"),
  inspectorPanel: document.getElementById("inspector-panel"),
  zoomLayer: document.getElementById("zoom-layer"),
  links: document.getElementById("links"),
  emptyState: document.getElementById("empty-state"),
  nodeListView: document.getElementById("node-list-view"),
  boardListView: document.getElementById("board-list-view"),
  calendarView: document.getElementById("calendar-view"),
  brandCoreWorkspace: document.getElementById("brand-core-workspace"),
  cycleViewButton: document.getElementById("cycle-view-btn"),
  viewMenuButton: document.getElementById("view-menu-btn"),
  viewMenu: document.getElementById("view-menu"),
  viewBoardButton: document.getElementById("view-board-btn"),
  viewListButton: document.getElementById("view-list-btn"),
  viewCalendarButton: document.getElementById("view-calendar-btn"),
  calendarGrid: document.getElementById("calendar-grid"),
  calendarTitle: document.getElementById("calendar-title"),
  calendarPrevMonthButton: document.getElementById("calendar-prev-month-btn"),
  calendarNextMonthButton: document.getElementById("calendar-next-month-btn"),
  createCampaignButton: document.getElementById("create-campaign-btn"),
  addNodeButton: document.getElementById("add-node-btn"),
  zoomInButton: document.getElementById("zoom-in-btn"),
  zoomOutButton: document.getElementById("zoom-out-btn"),
  zoomLabel: document.getElementById("zoom-label"),
  nodeTemplate: document.getElementById("node-template"),
  postitTemplate: document.getElementById("postit-template"),
  contextMenu: document.getElementById("context-menu"),
  addContextNodeButton: document.getElementById("add-context-node-btn"),
  addPostitCommentButton: document.getElementById("add-postit-comment-btn"),
  improveContextNodeButton: document.getElementById("improve-context-node-btn"),
  picker: document.getElementById("node-type-picker"),
  pickerOptions: document.getElementById("node-type-options"),
  inspectorMeta: document.getElementById("inspector-meta"),
  nodeForm: document.getElementById("node-form"),
  socialFields: document.getElementById("social-fields"),
  contentUploadFields: document.getElementById("content-upload-fields"),
  contentFormatField: document.getElementById("content-format-field"),
  imageUpload: document.getElementById("node-image-upload"),
  inspectorImageList: document.getElementById("inspector-image-list"),
  deleteNodeButton: document.getElementById("delete-node-btn"),
  improveNodeButton: document.getElementById("improve-node-btn"),
  regenerateNodeButton: document.getElementById("regenerate-node-btn"),
  generateImageButton: document.getElementById("generate-image-btn"),
  generatePostingVisualButton: document.getElementById("generate-posting-visual-btn"),
  postingPlanOverlay: document.getElementById("posting-plan-overlay"),
  postingDateInput: document.getElementById("posting-date-input"),
  postingTimeInput: document.getElementById("posting-time-input"),
  postingDoneButton: document.getElementById("posting-done-btn"),
  postingCancelButton: document.getElementById("posting-cancel-btn"),
  undoButton: document.getElementById("undo-btn"),
  deleteSelectedButton: document.getElementById("delete-selected-btn"),
  disconnectSelectedButton: document.getElementById("disconnect-selected-btn"),
  propagateDescendantsButton: document.getElementById("propagate-descendants-btn"),
  resetBoardButton: document.getElementById("reset-board-btn"),
  saveBoardButton: document.getElementById("save-board-btn"),
  newBoardButton: document.getElementById("new-board-btn"),
  boardsCreateButton: document.getElementById("boards-create-btn"),
  saveStatus: document.getElementById("save-status"),
  boardSharePanel: document.getElementById("board-share-panel"),
  boardShareEmpty: document.getElementById("board-share-empty"),
  boardShareReady: document.getElementById("board-share-ready"),
  boardShareLinkText: document.getElementById("board-share-link-text"),
  copyBoardLinkButton: document.getElementById("copy-board-link-btn"),
  boardLastSaved: document.getElementById("board-last-saved"),
  boardCopyFeedback: document.getElementById("board-copy-feedback"),
  brandCoreButton: document.getElementById("brand-core-nav-btn"),
  campaignCanvasNavButton: document.getElementById("campaign-canvas-nav-btn"),
  boardsNavButton: document.getElementById("boards-nav-btn"),
  boardsLibraryView: document.getElementById("boards-library-view"),
  boardsLibraryList: document.getElementById("boards-library-list"),
  sidebarToggleButton: document.getElementById("sidebar-toggle-btn"),
  brandEditorTitle: document.getElementById("bc-editor-title"),
  brandCoreCanvas: document.getElementById("brand-core-canvas"),
  brandEditorPanel: document.getElementById("bc-editor-panel"),
  resetBrandCoreButton: document.getElementById("reset-brand-core-btn"),
  inputs: {
    type: document.getElementById("node-type"),
    title: document.getElementById("node-title"),
    content: document.getElementById("node-content"),
    variants: document.getElementById("node-variants"),
    platform: document.getElementById("node-platform"),
    caption: document.getElementById("node-caption"),
    hashtags: document.getElementById("node-hashtags"),
    preview: document.getElementById("node-preview"),
    audience: document.getElementById("node-audience"),
    goal: document.getElementById("node-goal"),
    channel: document.getElementById("node-channel"),
    contentFormat: document.getElementById("node-content-format")
  }
};

Object.keys(NODE_TYPES).forEach((type) => {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  el.inputs.type.appendChild(option);
});



function ensureImageLightbox() {
  let overlay = document.getElementById("image-lightbox");
  if (overlay) return overlay;
  overlay = document.createElement("div");
  overlay.id = "image-lightbox";
  overlay.className = "image-lightbox hidden";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = '<button type="button" class="image-lightbox-close" aria-label="Close preview">✕</button><img class="image-lightbox-image" alt="Image preview" />';
  document.body.appendChild(overlay);
  return overlay;
}

function openLightbox(imageUrl, alt = "Image preview") {
  if (!imageUrl) return;

  const lightbox = ensureImageLightbox();
  const img = lightbox.querySelector(".image-lightbox-image");

  img.src = imageUrl;
  img.alt = alt;

  lightbox.style.display = "flex";
  lightbox.classList.remove("hidden");
  lightbox.classList.add("open");
  lightbox.setAttribute("aria-hidden", "false");

  activeLightbox = lightbox;
}

function closeLightbox() {
  const lightbox = document.getElementById("image-lightbox");
  if (!lightbox) return;

  lightbox.classList.add("hidden");
  lightbox.classList.remove("open");
  lightbox.style.display = "none";
  lightbox.setAttribute("aria-hidden", "true");

  const img = lightbox.querySelector(".image-lightbox-image");
  if (img) {
    img.removeAttribute("src");
    img.alt = "";
  }

  activeLightbox = null;
}

function openImageLightbox(url, alt = "Image preview") {
  if (!url) return;
  openLightbox(url, alt);
}

function nowString() {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date());
}



function formatShareLinkText(url) {
  try {
    const parsed = new URL(url);
    const id = parsed.pathname.split('/').filter(Boolean).pop() || '';
    return `${parsed.host}/boards/${id.slice(0, 8)}...`;
  } catch {
    return url;
  }
}

function formatLastSavedLabel(value = new Date()) {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(value);
}

function setSharePanelState(boardId, lastSaved = null) {
  if (!boardId) {
    el.boardShareEmpty?.classList.remove("hidden");
    el.boardShareReady?.classList.add("hidden");
    return;
  }

  const url = `${window.location.origin}/boards/${boardId}`;
  if (el.boardShareLinkText) el.boardShareLinkText.textContent = formatShareLinkText(url);
  if (el.boardLastSaved) {
    const label = lastSaved ? formatLastSavedLabel(lastSaved) : "—";
    el.boardLastSaved.textContent = `Last saved: ${label}`;
  }

  el.boardShareEmpty?.classList.add("hidden");
  el.boardShareReady?.classList.remove("hidden");
}

async function copyCurrentBoardLink() {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId) {
    if (el.boardCopyFeedback) {
      el.boardCopyFeedback.textContent = "Could not copy link.";
      el.boardCopyFeedback.classList.remove("hidden");
      setTimeout(() => el.boardCopyFeedback?.classList.add("hidden"), 1500);
    }
    return;
  }

  const url = `${window.location.origin}/boards/${boardId}`;
  try {
    await navigator.clipboard.writeText(url);
    if (el.copyBoardLinkButton) {
      el.copyBoardLinkButton.textContent = "Copied";
      setTimeout(() => {
        if (el.copyBoardLinkButton) el.copyBoardLinkButton.textContent = "Copy";
      }, 1500);
    }
    el.boardCopyFeedback?.classList.add("hidden");
  } catch (error) {
    if (el.boardCopyFeedback) {
      el.boardCopyFeedback.textContent = "Could not copy link.";
      el.boardCopyFeedback.classList.remove("hidden");
      setTimeout(() => el.boardCopyFeedback?.classList.add("hidden"), 1500);
    }
  }
}


async function saveBoardAsNew(payload) {
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Failed to save board');

  const newId = data?.id;
  if (newId) {
    state.currentBoardId = newId;
    state.lastKnownUpdatedAt = data?.updated_at || null;
    const nextPath = `/boards/${newId}`;
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setSharePanelState(newId, data?.updated_at ? new Date(data.updated_at) : new Date());
    state.isDirty = false;
    setSaveStatus('Saved');
    refreshLastSavedSnapshot();
  }
}

function showBoardConflictModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'brand-confirm-modal';
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>A newer version of this board exists</h3><p>Someone else has saved changes to this board since you opened it. What would you like to do?</p><div class="brand-confirm-actions"><button type="button" id="board-conflict-load">Load latest version</button><button type="button" class="primary-add" id="board-conflict-save-new">Save as new board</button><button type="button" id="board-conflict-cancel">Cancel</button></div></div>`;
    document.body.appendChild(overlay);

    const close = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) close('cancel');
    });
    overlay.querySelector('#board-conflict-load').addEventListener('click', () => close('load_latest'));
    overlay.querySelector('#board-conflict-save-new').addEventListener('click', () => close('save_new'));
    overlay.querySelector('#board-conflict-cancel').addEventListener('click', () => close('cancel'));
  });
}

function boardPointFromClient(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left + el.canvas.scrollLeft) / state.zoom,
    y: (clientY - rect.top + el.canvas.scrollTop) / state.zoom
  };
}

function visibleBoardBounds() {
  const left = el.canvas.scrollLeft / state.zoom;
  const top = el.canvas.scrollTop / state.zoom;
  const width = el.canvas.clientWidth / state.zoom;
  const height = el.canvas.clientHeight / state.zoom;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function viewportCenterBoard() {
  const b = visibleBoardBounds();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

function clampNodePosition(rawX, rawY) {
  const x = Number.isFinite(rawX) ? rawX : 320;
  const y = Number.isFinite(rawY) ? rawY : 180;

  return {
    x: Math.max(40, Math.min(1600, x)),
    y: Math.max(40, Math.min(1200, y))
  };
}

function getNode(id) {
  return state.nodes.find((n) => n.id === id) || null;
}

function pushHistorySnapshot() {
  const snapshot = JSON.stringify({
    nodes: state.nodes,
    edges: state.edges,
    nodeCounter: state.nodeCounter,
    postitCounter: state.postitCounter
  });
  state.history.push(snapshot);
  if (state.history.length > 5) state.history.shift();
}

function restoreLastSnapshot() {
  const last = state.history.pop();
  if (!last) return;
  state.nodes.forEach((n) => (n.images || []).forEach(revokeImageObjectUrl));
  const parsed = JSON.parse(last);
  state.nodes = parsed.nodes;
  state.edges = parsed.edges;
  state.nodeCounter = parsed.nodeCounter;
  state.postitCounter = parsed.postitCounter;
  state.selectedIds.clear();
  state.selectedPrimary = null;
  el.zoomLayer.querySelectorAll(".node").forEach((n) => n.remove());
  state.nodes.forEach(renderNode);
  updateSelectionClasses();
  fillInspector(null);
  updateListView();
  updateEmptyState();
  drawLinks();
  markUnsaved();
}




function refreshLastSavedSnapshot() {
  state.lastSavedSnapshot = JSON.stringify(serializeState());
}

function detectDirtyFromSnapshot() {
  console.log('Autosave effect fired');
  if (state.isBoardLoading) { console.log('Autosave blocked because:', 'loading'); return; }
  if (state.isSaving) { console.log('Autosave blocked because:', 'saving'); return; }
  if (state.conflictModalOpen) { console.log('Autosave blocked because:', 'conflict modal open'); return; }

  const currentSnapshot = JSON.stringify(serializeState());
  if (currentSnapshot !== state.lastSavedSnapshot) {
    if (!state.isDirty) {
      console.log('Autosave dirty detected');
      markUnsaved();
    }
  }
}

function startAutosaveWatcher() {
  setInterval(detectDirtyFromSnapshot, 1000);
}

function clearAutosaveTimer() {
  if (state.autosaveTimer) {
    clearTimeout(state.autosaveTimer);
    state.autosaveTimer = null;
    console.log("Autosave timer cleared");
  }
}

function scheduleAutosave() {
  if (state.conflictModalOpen) { console.log('Autosave blocked because:', 'conflict modal open'); return; }
  if (state.autosavePausedUntilChange) { console.log('Autosave blocked because:', 'paused until change'); return; }
  if (state.isSaving) { console.log('Autosave blocked because:', 'saving'); return; }
  if (state.autosaveTimer) return;
  console.log('Autosave timer scheduled');
  state.autosaveTimer = setTimeout(() => {
    state.autosaveTimer = null;
    if (!state.isDirty) { console.log('Autosave blocked because:', 'no changes'); return; }
    if (state.isSaving) { console.log('Autosave blocked because:', 'saving'); return; }
    if (state.conflictModalOpen) { console.log('Autosave blocked because:', 'conflict modal open'); return; }
    if (state.autosavePausedUntilChange) { console.log('Autosave blocked because:', 'paused until change'); return; }
    console.log('Autosave executing');
    saveBoardToServer('autosave');
  }, 3000);
}

function setSaveStatus(text) { el.saveStatus.textContent = text; }

function isPersistableImageUrl(url) {
  return typeof url === "string" && url.length > 0 && !url.startsWith("blob:") && !url.startsWith("data:");
}

function sanitizeNodeImages(images) {
  return (Array.isArray(images) ? images : [])
    .filter((img) => img && isPersistableImageUrl(img.url))
    .map((img) => ({
      id: img.id || (crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}`),
      url: img.url,
      name: img.name || "image",
      createdAt: img.createdAt || Date.now(),
      source: img.source || "uploaded"
    }));
}

function serializeState() {
  const serialized = {
    nodes: state.nodes.map((n) => ({ ...n, images: sanitizeNodeImages(n.images) })),
    edges: state.edges, nodeCounter: state.nodeCounter, postitCounter: state.postitCounter, zoom: state.zoom
  };
  const selectedNode = state.selectedPrimary ? serialized.nodes.find((n) => n.id === state.selectedPrimary) : null;
  console.log("serialized images", selectedNode?.images || []);
  return serialized;
}
function saveCampaignCanvasState() { const campaignState = serializeState(); console.log("Saving campaignCanvasState", campaignState); localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState)); setSaveStatus("Saved"); }
function markUnsaved() {
  state.isDirty = true;
  state.autosavePausedUntilChange = false;
  setSaveStatus("Unsaved changes");
  scheduleAutosave();
}
function getBoardIdFromPath() {
  const fromPathname = (window.location.pathname || "").match(/\/boards\/([^/?#]+)/i);
  if (fromPathname?.[1]) return decodeURIComponent(fromPathname[1]);

  const fromHref = (window.location.href || "").match(/\/boards\/([^/?#]+)/i);
  if (fromHref?.[1]) return decodeURIComponent(fromHref[1]);

  return null;
}

function loadCampaignCanvasState() {
  const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
  const campaignState = JSON.parse(raw); console.log("Loaded campaignCanvasState", campaignState);
  applyCampaignState(campaignState, "Restored from local storage");
  return true;
}


function applyCampaignState(campaignState, statusText = "Restored") {
  state.nodes = (campaignState.nodes || []).map((node) => ({ ...node, images: sanitizeNodeImages(node.images) }));
  state.edges = campaignState.edges || [];
  state.nodeCounter = campaignState.nodeCounter || 1;
  state.postitCounter = campaignState.postitCounter || 1;
  state.selectedIds.clear();
  state.selectedPrimary = null;
  el.zoomLayer.querySelectorAll(".node").forEach((n) => n.remove());
  state.nodes.forEach(renderNode);
  updateListView();
  updateEmptyState();
  drawLinks();
  if (campaignState.zoom) setZoom(campaignState.zoom);
  state.isDirty = false;
  clearAutosaveTimer();
  setSaveStatus(statusText);
  refreshLastSavedSnapshot();
  state.isBoardLoading = false;
}

async function saveBoardToServer(trigger = "manual") {
  try {
    const payload = {
      name: `Campaign Canvas ${new Date().toISOString()}`,
      canvas_json: serializeState(),
      brand_core_snapshot: state.brandCore
    };
    const pathname = window.location.pathname || '';
    const pathBoardId = pathname.startsWith('/boards/')
      ? decodeURIComponent(pathname.replace(/^\/boards\//, '').split('/')[0]).trim()
      : null;
    const currentBoardId = state.currentBoardId || pathBoardId || getBoardIdFromPath();
    const isUpdate = Boolean(currentBoardId);
    if (isUpdate) payload.name = null;
    const endpoint = isUpdate ? `/api/boards/${currentBoardId}` : '/api/boards';
    const method = isUpdate ? 'PUT' : 'POST';
    console.log('Current board id:', currentBoardId);
    console.log('Save method:', currentBoardId ? 'PUT' : 'POST');
    console.log('Save endpoint:', endpoint);

    if (isUpdate && state.lastKnownUpdatedAt) payload.lastKnownUpdatedAt = state.lastKnownUpdatedAt;

    state.isSaving = true;
    setSaveStatus('Saving...');

    const response = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.status === 409 && isUpdate) {
      state.conflictModalOpen = true;
      clearAutosaveTimer();
      const action = await showBoardConflictModal();
      state.conflictModalOpen = false;
      if (action === 'load_latest') {
        state.autosavePausedUntilChange = false;
        await loadBoardFromUrlIfPresent();
      } else if (action === 'save_new') {
        state.autosavePausedUntilChange = false;
        await saveBoardAsNew(payload);
      } else {
        state.autosavePausedUntilChange = true;
        setSaveStatus('Unsaved changes');
      }
      state.isSaving = false;
      return;
    }
    if (!response.ok) throw new Error(data?.error || 'Failed to save board');
    console.log('Saved board response id:', data?.id);

    const returnedId = data?.id || currentBoardId;
    if (returnedId) state.currentBoardId = returnedId;
    state.lastKnownUpdatedAt = data?.updated_at || new Date().toISOString();

    const shareUrl = `${window.location.origin}/boards/${returnedId}`;
    state.isDirty = false;
    setSaveStatus('Saved');
    refreshLastSavedSnapshot();
    console.log('Autosave success');
    setSharePanelState(returnedId, new Date());

    if (!isUpdate && returnedId) {
      const nextPath = `/boards/${returnedId}`;
      if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);

    }
  } catch (error) {
    console.error(error);
    setSaveStatus('Save failed');
  } finally {
    state.isSaving = false;
  }
}

async function loadBoardFromUrlIfPresent() {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId) return false;
  state.currentBoardId = boardId;
  try {
    const response = await fetch(`/api/boards/${boardId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load board');
    state.currentBoardId = data?.id || boardId;
    state.lastKnownUpdatedAt = data?.updated_at || null;
    if (data?.brand_core_snapshot && typeof data.brand_core_snapshot === "object") {
      state.brandCore = data.brand_core_snapshot;
      renderBrandCoreTiles();
      renderBrandCoreEditor();
      saveBrandBrainState();
    }
    setSharePanelState(state.currentBoardId, data?.updated_at ? new Date(data.updated_at) : null);
    applyCampaignState(data.canvas_json || {}, `Loaded board ${boardId.slice(0, 8)}...`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data.canvas_json || {}));
    return true;
  } catch (error) {
    console.error(error);
    setSaveStatus('Board not found or could not be loaded.');
    return false;
  }
}

function renderCampaignCanvasFromStateIfNeeded() {
  const domNodes = el.zoomLayer.querySelectorAll(".node").length;
  if (domNodes === 0 && state.nodes.length > 0) {
    state.nodes.forEach(renderNode);
  }
  drawLinks();
  updateListView();
  updateEmptyState();
}
function resetCampaignCanvasState() {
  console.log("RESET BOARD CLICKED");
  localStorage.removeItem(STORAGE_KEY);
  state.nodes = []; state.edges = []; state.nodeCounter = 1; state.postitCounter = 1; state.selectedIds.clear(); state.selectedPrimary = null;
  el.zoomLayer.querySelectorAll(".node").forEach((n) => n.remove()); fillInspector(null); updateListView(); updateEmptyState(); drawLinks(); setSaveStatus("Unsaved changes");
}

function getBrandCoreData() {
  return state.brandCore;
}
window.getBrandCoreData = getBrandCoreData;

function saveBrandBrainState() {
  const brandState = getBrandCoreData();
  console.log("Saving brandBrainState", brandState);
  localStorage.setItem(BRAND_CORE_STORAGE_KEY, JSON.stringify(brandState));
}

function loadBrandBrainState() {
  const raw = localStorage.getItem(BRAND_CORE_STORAGE_KEY);
  if (raw) { state.brandCore = JSON.parse(raw); console.log("Loaded brandBrainState", state.brandCore); }
  else {
    state.brandCore = { brandCore: "", toneOfVoice: [], messagingPillars: [], valueProposition: "", personas: [], contentGuidelines: [], dosAndDonts: { dos: [], donts: [] }, brandVoiceExamples: { good: "", avoid: "" }, keywords: [], brandAssets: { domain: "", logo: "", colors: [], typography: "", references: [] }, customTiles: [] };
  }
  if (!Array.isArray(state.brandCore.customTiles)) state.brandCore.customTiles = [];
}

function resetBrandBrainState() {
  console.log("RESET BRAND CORE CLICKED");
  localStorage.removeItem(BRAND_CORE_STORAGE_KEY);
  loadBrandBrainState();
  renderBrandCoreTiles();
  renderBrandCoreEditor();
}






function showResetBoardConfirmModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "brand-confirm-modal";
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>You are about to reset the board</h3><p>This will remove all nodes and changes from the current board. This action cannot be undone.</p><div class="brand-confirm-actions"><button type="button" id="reset-board-cancel">Cancel</button><button type="button" class="danger" id="reset-board-confirm">Confirm</button></div></div>`;
    document.body.appendChild(overlay);

    const close = (value) => {
      overlay.remove();
      document.removeEventListener("keydown", onKeydown);
      resolve(value);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") close(false);
    };

    document.addEventListener("keydown", onKeydown);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector("#reset-board-cancel").addEventListener("click", () => close(false));
    overlay.querySelector("#reset-board-confirm").addEventListener("click", () => close(true));
  });
}

function showBrandSuggestionConfirmModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "brand-confirm-modal";
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>Apply Suggestions</h3><p>Replace current Brand Brain with generated suggestions?</p><div class="brand-confirm-actions"><button type="button" id="brand-confirm-cancel">Cancel</button><button type="button" class="primary-add" id="brand-confirm-apply">Apply Suggestions</button></div></div>`;
    document.body.appendChild(overlay);
    const close = (value) => {
      overlay.remove();
      resolve(value);
    };
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close(false);
    });
    overlay.querySelector("#brand-confirm-cancel").addEventListener("click", () => close(false));
    overlay.querySelector("#brand-confirm-apply").addEventListener("click", () => close(true));
  });
}

async function analyzeBrandDomainFromEditor() {
  const domainInput = el.brandEditorPanel.querySelector("#bc-domain");
  const analyzeButton = el.brandEditorPanel.querySelector("#bc-analyze-domain");
  const domainUrl = domainInput?.value?.trim();
  if (!domainUrl) {
    alert("Please enter a domain URL first.");
    return;
  }

  const originalLabel = analyzeButton?.textContent || "Analyze Website";
  if (analyzeButton) {
    analyzeButton.disabled = true;
    analyzeButton.textContent = "Analyzing website…";
  }

  try {
    const response = await fetch("/api/analyze-brand-domain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domainUrl })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Could not analyze website");

    const next = payload?.suggestions;
    if (!next || typeof next !== "object") throw new Error("No brand suggestions returned");

    const confirmReplace = await showBrandSuggestionConfirmModal();
    if (!confirmReplace) return;

    state.brandCore = {
      ...state.brandCore,
      ...next,
      brandAssets: { ...(state.brandCore.brandAssets || {}), ...(next.brandAssets || {}) },
      customTiles: Array.isArray(state.brandCore.customTiles) ? state.brandCore.customTiles : []
    };

    saveBrandBrainState();
    renderBrandCoreTiles();
    renderBrandCoreEditor();
  } catch (error) {
    alert(error?.message || "Website analysis failed. Please try another domain.");
  } finally {
    if (analyzeButton) {
      analyzeButton.disabled = false;
      analyzeButton.textContent = originalLabel;
    }
  }
}

function renderBrandCoreEditor() {
  const selectedKey = state.brandCoreSelectedKey;
  if (selectedKey === "custom:add") {
    state.brandCore.customTiles.push({ title: "New Custom Tile", content: "", items: [] });
    state.brandCoreSelectedKey = `custom:${state.brandCore.customTiles.length - 1}`;
    saveBrandBrainState();
    renderBrandCoreTiles();
  }
  const activeKey = state.brandCoreSelectedKey;
  if (activeKey.startsWith("custom:")) {
    const idx = Number(activeKey.split(":")[1]);
    const tile = state.brandCore.customTiles[idx];
    el.brandEditorTitle.textContent = tile?.title || "Custom Tile";
    el.brandEditorPanel.innerHTML = `<div class="bc-editor-meta"><p class="bc-helper">Custom Brand Tile</p><span class="bc-badge">custom</span></div><label>Title</label><input id="bc-custom-title" value="${tile?.title || ""}"/><label>Content</label><textarea id="bc-custom-content" rows="5">${tile?.content || ""}</textarea><button id="bc-custom-delete" type="button">Remove custom tile</button>`;
    el.brandEditorPanel.querySelector("#bc-custom-title").addEventListener("input", (e) => { tile.title = e.target.value; saveBrandBrainState(); renderBrandCoreTiles(); });
    el.brandEditorPanel.querySelector("#bc-custom-content").addEventListener("input", (e) => { tile.content = e.target.value; saveBrandBrainState(); renderBrandCoreTiles(); });
    el.brandEditorPanel.querySelector("#bc-custom-delete").addEventListener("click", () => { state.brandCore.customTiles.splice(idx, 1); state.brandCoreSelectedKey = "brandCore"; saveBrandBrainState(); renderBrandCoreEditor(); });
    return;
  }
  const labelMap = {
    brandCore: "Brand Core", toneOfVoice: "Tone of Voice", messagingPillars: "Messaging Pillars",
    valueProposition: "Value Proposition", personas: "Personas", contentGuidelines: "Content Guidelines",
    dosAndDonts: "Do / Don't", brandVoiceExamples: "Brand Voice Examples", keywords: "Keywords", brandAssets: "Brand Assets"
  };
  el.brandEditorTitle.textContent = labelMap[activeKey] || "Brand Core";
  const value = state.brandCore[activeKey];
  const key = activeKey;
  const count = Array.isArray(value)
    ? `${value.length} items`
    : key === "dosAndDonts"
      ? `${value.dos.length + value.donts.length} rules`
      : key === "brandVoiceExamples"
        ? "2 examples"
        : key === "brandAssets"
          ? `${(value.colors || []).length} colors`
          : "1 section";
  el.brandEditorPanel.innerHTML = "";
  const meta = document.createElement("div");
  meta.className = "bc-editor-meta";
  meta.innerHTML = `<p class="bc-helper">Edit this section and preview updates live.</p><span class="bc-badge">${count}</span>`;
  el.brandEditorPanel.appendChild(meta);
  if (key === "brandCore" || key === "valueProposition") {
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<textarea id="bc-edit-text" rows="6">${value || ""}</textarea>`);
    el.brandEditorPanel.querySelector("textarea").addEventListener("input", (e) => { state.brandCore[key] = e.target.value; saveBrandBrainState(); renderBrandCoreTiles(); });
  } else if (key === "toneOfVoice" || key === "messagingPillars" || key === "contentGuidelines") {
    const title = key === "toneOfVoice" ? "Add trait" : key === "messagingPillars" ? "Add pillar" : "Add guideline";
    const listPrefix = key === "messagingPillars" ? "ol" : "ul";
    const listItems = value.map((v, i) => `<li data-i="${i}">${v}<button type="button">✕</button></li>`).join("");
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<label>${title}</label><div class="posting-actions bc-add-row"><input id="bc-list-add" placeholder="${title}"/><button type="button" id="bc-list-plus">+</button></div><${listPrefix} class="bc-edit-list">${listItems}</${listPrefix}>`);
    el.brandEditorPanel.querySelector("button").addEventListener("click", () => { const v = el.brandEditorPanel.querySelector("#bc-list-add").value.trim(); if (!v) return; value.push(v); saveBrandBrainState(); renderBrandCoreEditor(); });
    el.brandEditorPanel.querySelectorAll("li button").forEach((btn) => btn.addEventListener("click", (e) => { const idx = Number(e.target.closest("li").dataset.i); value.splice(idx, 1); saveBrandBrainState(); renderBrandCoreEditor(); }));
  } else if (key === "dosAndDonts") {
    const d = value;
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `
      <label>Do</label><div class="posting-actions bc-add-row"><input id="bc-do-add" placeholder="Add Do"/><button type="button">+</button></div>
      <ul class="bc-edit-list">${d.dos.map((v, i) => `<li data-i="${i}" data-t="do">${v}<button type="button">✕</button></li>`).join("")}</ul>
      <label>Don't</label><div class="posting-actions bc-add-row"><input id="bc-dont-add" placeholder="Add Don't"/><button type="button" id="bc-dont-plus">+</button></div>
      <ul class="bc-edit-list">${d.donts.map((v, i) => `<li data-i="${i}" data-t="dont">${v}<button type="button">✕</button></li>`).join("")}</ul>`);
    el.brandEditorPanel.querySelector("button").addEventListener("click", () => { const v = el.brandEditorPanel.querySelector("#bc-do-add").value.trim(); if (!v) return; d.dos.push(v); saveBrandBrainState(); renderBrandCoreEditor(); });
    el.brandEditorPanel.querySelector("#bc-dont-plus").addEventListener("click", () => { const v = el.brandEditorPanel.querySelector("#bc-dont-add").value.trim(); if (!v) return; d.donts.push(v); saveBrandBrainState(); renderBrandCoreEditor(); });
    el.brandEditorPanel.querySelectorAll("li button").forEach((btn) => btn.addEventListener("click", (e) => { const li = e.target.closest("li"); const idx = Number(li.dataset.i); if (li.dataset.t === "do") d.dos.splice(idx, 1); else d.donts.splice(idx, 1); saveBrandBrainState(); renderBrandCoreEditor(); }));
  } else if (key === "brandVoiceExamples") {
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<label>Good example</label><textarea class="bc-good" id="bc-good" rows="3">${value.good || ""}</textarea><label>Avoid example</label><textarea class="bc-bad" id="bc-avoid" rows="3">${value.avoid || ""}</textarea>`);
    ["bc-good","bc-avoid"].forEach((id) => el.brandEditorPanel.querySelector(`#${id}`).addEventListener("input", () => { value.good = el.brandEditorPanel.querySelector("#bc-good").value; value.avoid = el.brandEditorPanel.querySelector("#bc-avoid").value; saveBrandBrainState(); renderBrandCoreTiles(); }));
  } else if (key === "brandAssets") {
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<label>Domain URL</label><input id="bc-domain" value="${value.domain || ""}"/><button id="bc-analyze-domain" type="button">Analyze Website</button><label>Typography</label><input id="bc-typo" value="${value.typography || ""}"/><label>Logo URL</label><input id="bc-logo" value="${value.logo || ""}"/><label>Palette</label><div class="posting-actions bc-add-row"><input id="bc-color-add" placeholder="#AABBCC"/><input id="bc-color-picker" type="color" value="#6f5bff"/><button type="button" id="bc-color-plus">+</button></div><div class="bc-tags">${(value.colors||[]).map((c,i)=>`<span data-i="${i}">${c}</span>`).join("")}</div>`);
    ["bc-domain","bc-typo","bc-logo"].forEach((id) => el.brandEditorPanel.querySelector(`#${id}`).addEventListener("input", () => { value.domain = el.brandEditorPanel.querySelector("#bc-domain").value; value.typography = el.brandEditorPanel.querySelector("#bc-typo").value; value.logo = el.brandEditorPanel.querySelector("#bc-logo").value; saveBrandBrainState(); renderBrandCoreTiles(); }));
    el.brandEditorPanel.querySelector("#bc-analyze-domain").addEventListener("click", analyzeBrandDomainFromEditor);
    el.brandEditorPanel.querySelector("#bc-color-picker").addEventListener("input", () => {
      const picked = el.brandEditorPanel.querySelector("#bc-color-picker").value.trim();
      el.brandEditorPanel.querySelector("#bc-color-add").value = picked;
    });
    el.brandEditorPanel.querySelector("#bc-color-plus").addEventListener("click", () => { const c = (el.brandEditorPanel.querySelector("#bc-color-add").value.trim() || el.brandEditorPanel.querySelector("#bc-color-picker").value.trim()).toUpperCase(); if (!/^#([0-9A-F]{6})$/.test(c)) return; value.colors.push(c); saveBrandBrainState(); renderBrandCoreEditor(); });
    el.brandEditorPanel.querySelectorAll(".bc-tags span").forEach((chip) => chip.addEventListener("click", () => { value.colors.splice(Number(chip.dataset.i),1); saveBrandBrainState(); renderBrandCoreEditor(); }));
  } else if (key === "personas") {
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<div class="posting-actions bc-add-row"><input id="bc-p-name" placeholder="Persona"/><input id="bc-p-note" placeholder="Label"/><button type="button">+</button></div><ul class="bc-edit-list">${value.map((p, i) => `<li data-i="${i}">${p.name} <small>${p.note}</small><button type="button">✕</button></li>`).join("")}</ul>`);
    el.brandEditorPanel.querySelector("button").addEventListener("click", () => { const n = el.brandEditorPanel.querySelector("#bc-p-name").value.trim(); if (!n) return; value.push({ name: n, note: el.brandEditorPanel.querySelector("#bc-p-note").value.trim() }); saveBrandBrainState(); renderBrandCoreEditor(); });
    el.brandEditorPanel.querySelectorAll("li button").forEach((btn) => btn.addEventListener("click", (e) => { value.splice(Number(e.target.closest("li").dataset.i), 1); saveBrandBrainState(); renderBrandCoreEditor(); }));
  } else if (key === "keywords") {
    el.brandEditorPanel.insertAdjacentHTML("beforeend", `<label>Keyword tags</label><input id="bc-keyword-input" placeholder="Type keyword and press Enter"/><div class="bc-tags">${value.map((t, i) => `<span data-i="${i}">${t}</span>`).join("")}</div>`);
    el.brandEditorPanel.querySelector("#bc-keyword-input").addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      const v = event.target.value.trim();
      if (!v) return;
      value.push(v);
      saveBrandBrainState();
      renderBrandCoreEditor();
    });
    el.brandEditorPanel.querySelectorAll(".bc-tags span").forEach((chip) => chip.addEventListener("click", () => { value.splice(Number(chip.dataset.i), 1); saveBrandBrainState(); renderBrandCoreEditor(); }));
  }
  renderBrandCoreTiles();
}

function renderBrandCoreTiles() {
  console.log("BrandBrain mounted");
  console.log("BrandBrain data:", state.brandCore);
  if (!el.brandCoreCanvas.querySelector(".bc-node")) {
    el.brandCoreCanvas.innerHTML = `
      <article class="bc-node bc-main selected" data-bc-key="brandCore"></article>
      <div class="bc-row">
        <article class="bc-node" data-bc-key="toneOfVoice"></article>
        <article class="bc-node" data-bc-key="messagingPillars"></article>
        <article class="bc-node" data-bc-key="valueProposition"></article>
        <article class="bc-node" data-bc-key="personas"></article>
      </div>
      <div class="bc-row">
        <article class="bc-node" data-bc-key="contentGuidelines"></article>
        <article class="bc-node" data-bc-key="dosAndDonts"></article>
        <article class="bc-node" data-bc-key="brandVoiceExamples"></article>
        <article class="bc-node" data-bc-key="keywords"></article>
      </div>
      <article class="bc-node bc-assets" data-bc-key="brandAssets"></article>`;
  }
  el.brandCoreCanvas.querySelectorAll(".bc-custom-row").forEach((n) => n.remove());
  const titleMap = { brandCore: "BRAND CORE", toneOfVoice: "TONE OF VOICE", messagingPillars: "MESSAGING PILLARS", valueProposition: "VALUE PROPOSITION", personas: "PERSONAS", contentGuidelines: "CONTENT GUIDELINES", dosAndDonts: "DO'S & DON'TS", brandVoiceExamples: "BRAND VOICE EXAMPLES", keywords: "KEYWORDS", brandAssets: "BRAND ASSETS" };
  document.querySelectorAll(".bc-node[data-bc-key]").forEach((tile) => {
    const key = tile.dataset.bcKey;
    const val = state.brandCore[key];
    const title = titleMap[key] || key;
    let preview = "";
    let count = "";
    if (key === "keywords") {
      preview = `<div class="bc-tags">${val.slice(0, 8).map((t) => `<span>${t}</span>`).join("")}</div>`;
      count = `${val.length} keywords`;
    } else if (key === "brandVoiceExamples") {
      preview = `<div class="bc-good">Good: ${val.good}</div><div class="bc-bad">Avoid: ${val.avoid}</div>`;
      count = "2 examples";
    } else if (key === "dosAndDonts") {
      preview = `<div><strong>Do</strong><ul>${val.dos.slice(0,3).map((v) => `<li>${v}</li>`).join("")}</ul></div><div><strong>Don't</strong><ul>${val.donts.slice(0,3).map((v) => `<li>${v}</li>`).join("")}</ul></div>`;
      count = `${val.dos.length + val.donts.length} rules`;
    } else if (key === "personas") {
      preview = `<ul>${val.slice(0,3).map((p) => `<li>${p.name}<small> ${p.note}</small></li>`).join("")}</ul>`;
      count = `${val.length} personas`;
    } else if (key === "brandAssets") {
      preview = `<div class="bc-assets-preview"><span>${val.domain || ""}</span><span>${val.typography || ""}</span><div class="bc-colors">${(val.colors||[]).slice(0,4).map((c) => `<i style="background:${c}"></i>`).join("")}</div></div>`;
      count = "assets";
    } else if (Array.isArray(val)) {
      preview = `<ul>${val.slice(0, 4).map((v) => `<li>${v}</li>`).join("")}</ul>`;
      count = key === "messagingPillars" ? `${val.length} pillars` : `${val.length} traits`;
    } else {
      preview = `<p>${(val || "").slice(0, 120)}</p>`;
      count = val ? "1 statement" : "0";
    }
    tile.innerHTML = `<div class="bc-title">${title}</div><div class="bc-preview">${preview}</div><div class="bc-count">${count}</div>`;
  });
  const customRow = document.createElement("div");
  customRow.className = "bc-row bc-custom-row";
  state.brandCore.customTiles.forEach((tile, idx) => {
    const card = document.createElement("article");
    card.className = "bc-node";
    card.dataset.bcKey = `custom:${idx}`;
    card.innerHTML = `<div class="bc-title">${tile.title || "Custom Tile"}</div><div class="bc-preview"><p>${(tile.content || "").slice(0, 120)}</p></div><div class="bc-count">custom</div>`;
    customRow.appendChild(card);
  });
  const addCard = document.createElement("article");
  addCard.className = "bc-node bc-add-custom";
  addCard.dataset.bcKey = "custom:add";
  addCard.innerHTML = `<div class="bc-title">+ Add custom tile</div><div class="bc-preview"><p>Create your own brand section.</p></div>`;
  customRow.appendChild(addCard);
  el.brandCoreCanvas.appendChild(customRow);
}

function connectedIds() {
  const ids = new Set();
  state.edges.forEach(([a, b]) => {
    ids.add(a);
    ids.add(b);
  });
  return ids;
}

function updateEmptyState() {
  el.emptyState.hidden = state.nodes.length > 0;
}

function setZoom(nextZoom, centerClient = null) {
  const oldZoom = state.zoom;
  const newZoom = Math.min(2, Math.max(0.4, nextZoom));

  const rect = el.canvas.getBoundingClientRect();
  const cx = centerClient?.x ?? rect.left + el.canvas.clientWidth / 2;
  const cy = centerClient?.y ?? rect.top + el.canvas.clientHeight / 2;

  const boardX = (cx - rect.left + el.canvas.scrollLeft) / oldZoom;
  const boardY = (cy - rect.top + el.canvas.scrollTop) / oldZoom;

  state.zoom = newZoom;
  el.zoomLayer.style.transform = `scale(${state.zoom})`;
  el.zoomLayer.style.transformOrigin = "0 0";

  el.canvas.scrollLeft = boardX * state.zoom - (cx - rect.left);
  el.canvas.scrollTop = boardY * state.zoom - (cy - rect.top);

  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  drawLinks();
  saveCampaignCanvasState();
}

function openTypePicker(onSelect, preferred = "Idea") {
  el.pickerOptions.innerHTML = "";
  Object.keys(NODE_TYPES).forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "picker-option";
    btn.textContent = type;
    btn.style.borderColor = `${NODE_TYPES[type].color}66`;
    btn.addEventListener("click", () => {
      el.picker.classList.add("hidden");
      onSelect(type);
    });
    el.pickerOptions.appendChild(btn);
  });
  el.picker.classList.remove("hidden");
  const pref = [...el.pickerOptions.children].find((b) => b.textContent === preferred);
  pref?.focus();
}

function focusNodeInViewport(nodeId) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
  if (!nodeEl) return;
  const x = nodeEl.offsetLeft * state.zoom - el.canvas.clientWidth / 2 + nodeEl.offsetWidth / 2;
  const y = nodeEl.offsetTop * state.zoom - el.canvas.clientHeight / 2 + nodeEl.offsetHeight / 2;
  el.canvas.scrollTo({ left: Math.max(0, x), top: Math.max(0, y) });
}
function forceNodeVisible(nodeId) {
  focusNodeInViewport(nodeId);
  requestAnimationFrame(() => focusNodeInViewport(nodeId));
}

function ensureNodeActuallyVisible(node) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (!nodeEl) return;

  const c = el.canvas.getBoundingClientRect();
  const n = nodeEl.getBoundingClientRect();
  const outside = n.right < c.left || n.left > c.right || n.bottom < c.top || n.top > c.bottom;
  if (!outside) return;

  const b = visibleBoardBounds();
  const fallback = clampNodePosition(b.left + 300, b.top + 150);
  node.position.x = fallback.x;
  node.position.y = fallback.y;
  updateNodeCard(node);
  forceNodeVisible(node.id);
}

function defaultGridPosition() {
  const index = state.nodes.length;
  return {
    x: 280 + (index % 3) * 320,
    y: 160 + Math.floor(index / 3) * 240
  };
}

function connectorSpawnPositionFromPoint(point) {
  const candidateX = point.x - NODE_WIDTH / 2;
  const candidateY = point.y - NODE_HEIGHT / 2;
  const isSafe =
    Number.isFinite(candidateX) &&
    Number.isFinite(candidateY) &&
    candidateX >= 80 &&
    candidateX <= 1560 &&
    candidateY >= 80 &&
    candidateY <= 1160;

  if (!isSafe) {
    return { x: 320, y: 180 };
  }
  return { x: candidateX, y: candidateY };
}

function applyInherited(source, target) {
  if (!target.audience && source.audience) target.audience = source.audience;
  if (!target.goal && source.goal) target.goal = source.goal;
  if (!target.channel && source.channel) target.channel = source.channel;
}

function createNode({ type = "Idea", parentId = null, position = null, images = [] } = {}) {
  const parent = parentId ? getNode(parentId) : null;
  const defaultPos = parent
    ? { x: parent.position.x + 320, y: parent.position.y + 80 }
    : defaultGridPosition();

  const safePos = clampNodePosition(
    (position || defaultPos).x,
    (position || defaultPos).y
  );

  const node = {
    id: `node-${state.nodeCounter++}`,
    type,
    title: "",
    content: "",
    tags: [],
    variants: [],
    contentFormat: "1:1",
    audience: "",
    goal: "",
    channel: "",
    images: [...images],
    favoriteImageId: null,
    social: { platform: "Instagram", caption: "", hashtags: [], preview: "", scheduledAt: "" },
    caption: "",
    cta: "",
    isGeneratingContentPack: false,
    contentPackError: "",
    reactions: {},
    postits: [],
    justConnectedAt: null,
    position: safePos
  };

  if (parent) {
    applyInherited(parent, node);
    if (node.type === "Social Media Posting" && node.images.length === 0) {
      node.images = [...parent.images];
    }
  }

  state.nodes.push(node);
  renderNode(node);
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (nodeEl) {
    nodeEl.style.position = "absolute";
    nodeEl.style.left = `${node.position.x}px`;
    nodeEl.style.top = `${node.position.y}px`;
    nodeEl.style.display = "block";
    nodeEl.style.visibility = "visible";
    nodeEl.style.opacity = "0";
    nodeEl.style.transform = "scale(0.95)";
    nodeEl.style.transition = "opacity 250ms ease-out, transform 250ms ease-out";
    nodeEl.style.zIndex = "10";
    requestAnimationFrame(() => {
      nodeEl.style.opacity = "1";
      nodeEl.style.transform = "scale(1)";
    });
    setTimeout(() => {
      nodeEl.style.transition = "";
      nodeEl.style.transform = "";
    }, 280);
  }
  updateNodeCard(node);
  toggleListMode(false);

  if (parent) addEdge(parent.id, node.id);

  state.selectedIds.clear();
  state.selectedIds.add(node.id);
  state.selectedPrimary = node.id;

  updateSelectionClasses();
  fillInspector(node);
  updateListView();
  updateEmptyState();
  drawLinks();
  console.log("CREATED NODE", node.id, node.position);
  if (nodeEl) {
    console.log("NODE RECT", nodeEl.getBoundingClientRect());
  }
  runNetworkImpulse();
  forceNodeVisible(node.id);
  setTimeout(() => { forceNodeVisible(node.id); ensureNodeActuallyVisible(node); }, 30);
  autoZoomOutIfBoardCrowded();
  setSaveStatus("Unsaved changes");
  saveCampaignCanvasState();
  return node;
}

function autoZoomOutIfBoardCrowded() {
  if (state.nodes.length < 2) return;
  const now = Date.now();
  if (now - state.lastAutoZoomAt < 250) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  state.nodes.forEach((node) => {
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + NODE_WIDTH);
    maxY = Math.max(maxY, node.position.y + NODE_HEIGHT);
  });

  const bounds = visibleBoardBounds();
  const spanW = Math.max(1, maxX - minX);
  const spanH = Math.max(1, maxY - minY);
  const fillW = spanW / Math.max(1, bounds.width);
  const fillH = spanH / Math.max(1, bounds.height);

  if (fillW >= 0.9 || fillH >= 0.9) {
    state.lastAutoZoomAt = now;
    setZoom(state.zoom * 0.9);
  }
}

function createCampaignSetup() {
  setActiveView("board");
  el.canvas.scrollLeft = 0;
  el.canvas.scrollTop = 0;

  const idea = createNode({ type: "Idea", position: { x: 640, y: 120 } });
  const variationA = createNode({ type: "Campaign Variation", position: { x: 360, y: 330 } });
  const variationB = createNode({ type: "Campaign Variation", position: { x: 920, y: 330 } });
  const landing = createNode({ type: "Landing Page", position: { x: 220, y: 560 } });
  const newsletter = createNode({ type: "Email Campaign", position: { x: 560, y: 560 } });
  const contentA = createNode({ type: "Content", position: { x: 920, y: 560 } });
  const contentB = createNode({ type: "Content", position: { x: 1260, y: 560 } });
  const socialA = createNode({ type: "Social Media Posting", position: { x: 860, y: 860 } });
  const socialB = createNode({ type: "Social Media Posting", position: { x: 1220, y: 860 } });

  addEdge(idea.id, landing.id);
  addEdge(landing.id, newsletter.id);
  addEdge(idea.id, variationA.id);
  addEdge(idea.id, variationB.id);
  addEdge(variationA.id, contentA.id);
  addEdge(variationB.id, contentB.id);
  addEdge(contentA.id, socialA.id);
  addEdge(contentB.id, socialB.id);

  state.selectedIds.clear();
  state.selectedIds.add(idea.id);
  state.selectedPrimary = idea.id;
  updateSelectionClasses();
  fillInspector(idea);
  updateListView();
  updateEmptyState();
  drawLinks();
  saveCampaignCanvasState();
}

function openPostingPlanner(nodeId) {
  state.postingPlannerNodeId = nodeId;
  const node = getNode(nodeId);
  const existing = node?.social?.scheduledAt ? new Date(node.social.scheduledAt) : null;
  if (existing && !Number.isNaN(existing.getTime())) {
    el.postingDateInput.value = existing.toISOString().slice(0, 10);
    el.postingTimeInput.value = `${String(existing.getHours()).padStart(2, "0")}:${String(existing.getMinutes()).padStart(2, "0")}`;
  } else {
    el.postingDateInput.value = "";
    el.postingTimeInput.value = "09:00";
  }
  el.postingPlanOverlay.classList.remove("hidden");
}

function closePostingPlanner() {
  state.postingPlannerNodeId = null;
  el.postingPlanOverlay.classList.add("hidden");
}

function removeNode(nodeId) {
  pushHistorySnapshot();
  const idx = state.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return;

  const [removed] = state.nodes.splice(idx, 1);
  removed.images.forEach(revokeImageObjectUrl);

  state.edges = state.edges.filter(([a, b]) => a !== nodeId && b !== nodeId);

  el.zoomLayer.querySelector(`[data-id='${nodeId}']`)?.remove();
  state.selectedIds.delete(nodeId);
  if (state.selectedPrimary === nodeId) state.selectedPrimary = null;

  updateSelectionClasses();
  fillInspector(state.selectedPrimary ? getNode(state.selectedPrimary) : null);
  updateListView();
  updateEmptyState();
  drawLinks();
  saveCampaignCanvasState();
}

function addEdge(fromId, toId) {
  pushHistorySnapshot();
  if (!fromId || !toId || fromId === toId) return;
  if (state.edges.some(([a, b]) => a === fromId && b === toId)) return;
  state.edges.push([fromId, toId]);

  const source = getNode(fromId);
  const target = getNode(toId);
  if (source && target) {
    applyInherited(source, target);
    if (target.type === "Social Media Posting" && target.images.length === 0) {
      target.images = [...source.images];
    }
    source.justConnectedAt = Date.now();
    target.justConnectedAt = Date.now();
    updateNodeCard(source);
    updateNodeCard(target);
    if (state.selectedPrimary === target.id) fillInspector(target);
  }

  drawLinks();
}

function buildGeneratedCampaignPlan(ideaText, contextText) {
  const brand = state.brandCore || {};
  const tone = Array.isArray(brand.toneOfVoice) ? brand.toneOfVoice.slice(0, 2).join(", ") : "";
  const pillar = Array.isArray(brand.messagingPillars) ? brand.messagingPillars[0] || "" : "";
  const context = [contextText, brand.valueProposition, pillar].filter(Boolean).join(" · ");
  const baseTitle = ideaText || "Campaign Idea";
  return {
    idea: { title: baseTitle, content: context || "Core campaign direction." },
    varA: { title: `${baseTitle} – Variation A`, content: `Angle: ${tone || "Direct and clear"} narrative` },
    varB: { title: `${baseTitle} – Variation B`, content: `Angle: ${pillar || "Benefit-led"} storytelling` },
    contentA: { title: "Hero Content A", content: `Main message: ${baseTitle}` },
    contentB: { title: "Hero Content B", content: `Alternative hook for ${baseTitle}` },
    socialA: { title: "Social Post A", content: `CTA focused on ${baseTitle}` },
    socialB: { title: "Social Post B", content: `Community engagement for ${baseTitle}` },
    landing: { title: "Landing Page", content: `Conversion destination for ${baseTitle}` },
    email: { title: "Email Campaign", content: `Nurture sequence for ${baseTitle}` }
  };
}

async function fetchGeneratedCampaignPlan(ideaText, contextText) {
  const response = await fetch("/api/generate-campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignIdea: ideaText,
      additionalContext: contextText,
      brandBrainData: state.brandCore
    })
  });
  if (!response.ok) throw new Error("Generation request failed");
  return response.json();
}

function generateCampaignFromIdea(ideaText, contextText, providedPlan = null) {
  if (state.nodes.length > 0) {
    const clear = window.confirm("Canvas already has nodes. Clear board before generating?");
    if (!clear) return;
    resetCampaignCanvasState();
  }
  const plan = providedPlan || buildGeneratedCampaignPlan(ideaText, contextText);
  const variations = Array.isArray(plan.variations) && plan.variations.length
    ? plan.variations.slice(0, 2)
    : [
      { title: plan.varA.title, content: plan.varA.content, contentNode: plan.contentA, socialPost: { title: plan.socialA.title, caption: plan.socialA.content, platform: "Instagram" } },
      { title: plan.varB.title, content: plan.varB.content, contentNode: plan.contentB, socialPost: { title: plan.socialB.title, caption: plan.socialB.content, platform: "Instagram" } }
    ];

  const idea = createNode({ type: "Idea", position: { x: 620, y: 120 } });
  Object.assign(idea, { title: plan.idea.title, content: plan.idea.content });
  updateNodeCard(idea);

  const variationA = createNode({ type: "Campaign Variation", position: { x: 320, y: 340 } });
  Object.assign(variationA, { title: variations[0]?.title || "Variation A", content: variations[0]?.content || "" });
  updateNodeCard(variationA);
  const contentA = createNode({ type: "Content", position: { x: 260, y: 560 } });
  Object.assign(contentA, { title: variations[0]?.contentNode?.title || "Content A", content: variations[0]?.contentNode?.content || "" });
  updateNodeCard(contentA);
  const socialA = createNode({ type: "Social Media Posting", position: { x: 220, y: 820 } });
  Object.assign(socialA, { title: variations[0]?.socialPost?.title || "Social A", content: variations[0]?.socialPost?.caption || "" });
  socialA.social.platform = variations[0]?.socialPost?.platform || "Instagram";
  socialA.social.caption = variations[0]?.socialPost?.caption || "";
  updateNodeCard(socialA);

  const variationB = createNode({ type: "Campaign Variation", position: { x: 900, y: 340 } });
  Object.assign(variationB, { title: variations[1]?.title || "Variation B", content: variations[1]?.content || "" });
  updateNodeCard(variationB);
  const contentB = createNode({ type: "Content", position: { x: 980, y: 560 } });
  Object.assign(contentB, { title: variations[1]?.contentNode?.title || "Content B", content: variations[1]?.contentNode?.content || "" });
  updateNodeCard(contentB);
  const socialB = createNode({ type: "Social Media Posting", position: { x: 1040, y: 820 } });
  Object.assign(socialB, { title: variations[1]?.socialPost?.title || "Social B", content: variations[1]?.socialPost?.caption || "" });
  socialB.social.platform = variations[1]?.socialPost?.platform || "Instagram";
  socialB.social.caption = variations[1]?.socialPost?.caption || "";
  updateNodeCard(socialB);

  const landing = createNode({ type: "Landing Page", position: { x: 520, y: 560 } });
  Object.assign(landing, { title: plan.landingPage?.title || plan.landing?.title || "Landing Page", content: plan.landingPage?.content || plan.landing?.content || "" });
  updateNodeCard(landing);
  const email = createNode({ type: "Email Campaign", position: { x: 700, y: 560 } });
  Object.assign(email, { title: plan.emailCampaign?.title || plan.email?.title || "Email Campaign", content: plan.emailCampaign?.content || plan.email?.content || "" });
  updateNodeCard(email);

  addEdge(idea.id, variationA.id); addEdge(variationA.id, contentA.id); addEdge(contentA.id, socialA.id);
  addEdge(idea.id, variationB.id); addEdge(variationB.id, contentB.id); addEdge(contentB.id, socialB.id);
  addEdge(idea.id, landing.id); addEdge(idea.id, email.id);
  drawLinks();
  saveCampaignCanvasState();
}

function openCreateCampaignModal() {
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.innerHTML = `<div style="width:min(560px,95vw);background:#fff;border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:10px">
    <h3 style="margin:0">Create Campaign</h3>
    <label>What is the campaign idea?<textarea id="campaign-idea-input" rows="4" style="width:100%"></textarea></label>
    <label>Additional context<input id="campaign-context-input" type="text" style="width:100%"/></label>
    <div id="campaign-ai-loader" class="hidden" style="border:1px solid #ececf4;border-radius:10px;padding:10px;background:#fafaff">
      <strong>✨ Improving content<span id="campaign-ai-dots"></span></strong>
      <p id="campaign-ai-subtext" style="margin:6px 0 0;color:#5f6174">Analyzing brand voice...</p>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button type="button" id="campaign-modal-cancel">Cancel</button><button type="button" id="campaign-modal-generate">Generate Campaign</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const loader = overlay.querySelector("#campaign-ai-loader");
  const dotsEl = overlay.querySelector("#campaign-ai-dots");
  const subtextEl = overlay.querySelector("#campaign-ai-subtext");
  let thinkingTimer = null;
  let thinkingTick = 0;
  const startThinking = () => {
    loader.classList.remove("hidden");
    const steps = ["Analyzing brand voice...", "Refining tone...", "Optimizing structure..."];
    thinkingTimer = setInterval(() => {
      thinkingTick += 1;
      dotsEl.textContent = ".".repeat((thinkingTick % 3) + 1);
      subtextEl.textContent = steps[thinkingTick % steps.length];
    }, 450);
  };
  const stopThinking = () => {
    loader.classList.add("hidden");
    if (thinkingTimer) clearInterval(thinkingTimer);
    thinkingTimer = null;
    dotsEl.textContent = "";
  };
  overlay.querySelector("#campaign-modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#campaign-modal-generate").addEventListener("click", async () => {
    const ideaText = overlay.querySelector("#campaign-idea-input").value.trim();
    const contextText = overlay.querySelector("#campaign-context-input").value.trim();
    const generateBtn = overlay.querySelector("#campaign-modal-generate");
    const cancelBtn = overlay.querySelector("#campaign-modal-cancel");
    const ideaInput = overlay.querySelector("#campaign-idea-input");
    const contextInput = overlay.querySelector("#campaign-context-input");
    generateBtn.disabled = true;
    generateBtn.textContent = "Generating...";
    cancelBtn.disabled = true;
    ideaInput.disabled = true;
    contextInput.disabled = true;
    startThinking();
    try {
      const apiPlan = await fetchGeneratedCampaignPlan(ideaText || "Campaign Idea", contextText);
      generateCampaignFromIdea(ideaText || "Campaign Idea", contextText, apiPlan);
      overlay.remove();
    } catch (error) {
      alert("Could not generate with AI right now. Using fallback campaign template.");
      generateCampaignFromIdea(ideaText || "Campaign Idea", contextText);
      overlay.remove();
    } finally {
      stopThinking();
    }
  });
}

function edgePath(fromPoint, toPoint) {
  const midY = (fromPoint.y + toPoint.y) / 2;
  return `M ${fromPoint.x} ${fromPoint.y} C ${fromPoint.x} ${midY}, ${toPoint.x} ${midY}, ${toPoint.x} ${toPoint.y}`;
}

function nodeBottomCenter(nodeId) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
  if (!nodeEl) return null;
  return {
    x: nodeEl.offsetLeft + nodeEl.offsetWidth / 2,
    y: nodeEl.offsetTop + nodeEl.offsetHeight
  };
}

function drawLinks() {
  el.links.innerHTML = "";

  state.edges.forEach(([from, to], edgeIndex) => {
    const a = nodeBottomCenter(from);
    const b = nodeBottomCenter(to);
    if (!a || !b) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(a, b));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#8f80ff");
    path.setAttribute("stroke-width", "2");
    path.style.cursor = "pointer";
    path.style.pointerEvents = "stroke";
    path.addEventListener("click", (event) => {
      event.stopPropagation();
      state.edges.splice(edgeIndex, 1);
      drawLinks();
      state.nodes.forEach(updateNodeCard);
      saveCampaignCanvasState();
    markUnsaved();
    markUnsaved();
    });
    el.links.appendChild(path);
  });

  if (state.activeConnection) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(state.activeConnection.start, state.activeConnection.current));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#8f80ff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "6 5");
    path.style.pointerEvents = "none";
    el.links.appendChild(path);
  }
  if (state.connectorCreateMode) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", edgePath(state.connectorCreateMode.start, state.connectorCreateMode.current));
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#36c08b");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-dasharray", "7 5");
    path.style.pointerEvents = "none";
    el.links.appendChild(path);
  }
}

function runNetworkImpulse() {
  if (state.edges.length === 0) return;
  const roots = state.nodes.filter((n) => !state.edges.some(([, to]) => to === n.id));
  const rootId = roots[0]?.id;
  if (!rootId) return;

  const queue = [{ id: rootId, delay: 0 }];
  const seen = new Set();
  const pulses = [];

  while (queue.length) {
    const { id, delay } = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);

    state.edges.forEach(([from, to]) => {
      if (from !== id) return;
      const a = nodeBottomCenter(from);
      const b = nodeBottomCenter(to);
      if (!a || !b) return;

      const pulse = document.createElementNS("http://www.w3.org/2000/svg", "path");
      pulse.setAttribute("d", edgePath(a, b));
      pulse.setAttribute("fill", "none");
      pulse.setAttribute("stroke", "#c8bfff");
      pulse.setAttribute("stroke-width", "4");
      pulse.setAttribute("class", "impulse-path");
      pulse.style.animationDelay = `${delay}ms`;
      el.links.appendChild(pulse);
      pulses.push(pulse);
      queue.push({ id: to, delay: delay + 110 });
    });
  }

  setTimeout(() => pulses.forEach((p) => p.remove()), 1400);
}

function updateSelectionClasses() {
  el.zoomLayer.querySelectorAll(".node").forEach((nodeEl) => {
    nodeEl.classList.toggle("selected", state.selectedIds.has(nodeEl.dataset.id));
  });
  updateInspectorActionVisibility();
}

function collapseExpandedNodes(exceptNodeId = null) {
  el.zoomLayer.querySelectorAll(".node.content-expanded").forEach((nodeEl) => {
    if (exceptNodeId && nodeEl.dataset.id === exceptNodeId) return;
    nodeEl.classList.remove("content-expanded");
    const content = nodeEl.querySelector(".content");
    const expandBtn = nodeEl.querySelector(".node-expand-content");
    const shouldTruncate = (content?.textContent || "").trim().length > 160;
    if (content) content.classList.toggle("clamped", shouldTruncate && document.activeElement !== content);
    if (expandBtn) expandBtn.classList.toggle("hidden", !shouldTruncate);
  });
}

function updateInspectorActionVisibility() {
  const selectedCount = state.selectedIds.size;
  const hasSingleNode = selectedCount === 1 && !!state.selectedPrimary;
  const hasMultipleNodes = selectedCount > 1;
  const selectedNode = hasSingleNode ? getNode(state.selectedPrimary) : null;

  const showGenerateImage = !!selectedNode && selectedNode.type === "Content";
  const showGeneratePostingVisual = !!selectedNode && selectedNode.type === "Social Media Posting";

  el.deleteNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.deleteSelectedButton.style.display = hasMultipleNodes ? "block" : "none";

  el.generateImageButton.style.display = showGenerateImage ? "block" : "none";
  el.generatePostingVisualButton.style.display = showGeneratePostingVisual ? "block" : "none";

  el.improveNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.regenerateNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.propagateDescendantsButton.style.display = hasSingleNode ? "block" : "none";
  el.disconnectSelectedButton.style.display = selectedCount > 0 ? "block" : "none";

  el.disconnectSelectedButton.textContent = hasSingleNode ? "Disconnect node" : "Disconnect selected";

  el.deleteNodeButton.disabled = !hasSingleNode;
  el.deleteSelectedButton.disabled = !hasMultipleNodes;
  el.improveNodeButton.disabled = !hasSingleNode;
  el.regenerateNodeButton.disabled = !hasSingleNode;
  el.generateImageButton.disabled = !showGenerateImage;
  el.generatePostingVisualButton.disabled = !showGeneratePostingVisual;
  el.propagateDescendantsButton.disabled = !hasSingleNode;
  el.disconnectSelectedButton.disabled = !(selectedCount > 0);
}


function parseList(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function downstreamNodeIds(startId) {
  const out = new Set();
  const q = [startId];
  while (q.length) {
    const id = q.shift();
    state.edges.forEach(([from, to]) => {
      if (from !== id || out.has(to)) return;
      out.add(to);
      q.push(to);
    });
  }
  return [...out];
}

function getDirectParentNode(nodeId) {
  const parentEdge = state.edges.find(([, to]) => to === nodeId);
  if (!parentEdge) return null;
  return getNode(parentEdge[0]) || null;
}

function getCampaignContextSummary() {
  const rootIdea = state.nodes.find((node) => node.type === "Idea" && !state.edges.some(([, to]) => to === node.id))
    || state.nodes.find((node) => node.type === "Idea");
  if (!rootIdea) return "";
  return [rootIdea.title, rootIdea.content].filter(Boolean).join(" — ").trim();
}

function propagateNodeChangesDownward(node) {
  const targets = downstreamNodeIds(node.id).map(getNode).filter(Boolean);
  targets.forEach((t) => {
    if (node.channel) t.channel = node.channel;
    if (node.goal) t.goal = node.goal;
    if (node.audience) t.audience = node.audience;
    if (node.tags.length) t.tags = [...new Set([...t.tags, ...node.tags])];
    updateNodeCard(t);
  });
  runNetworkImpulse();
}

function updateNodeCard(node) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (!nodeEl) return;

  const tone = NODE_TYPES[node.type]?.color || "#5f6a82";
  const isConnected = connectedIds().has(node.id);

  nodeEl.style.left = `${node.position.x}px`;
  nodeEl.style.top = `${node.position.y}px`;
  nodeEl.style.borderColor = isConnected ? `${tone}88` : "#b8bdcb";
  nodeEl.style.boxShadow = isConnected ? `0 10px 22px ${tone}44` : "0 5px 10px rgba(70,70,90,0.05)";
  nodeEl.style.opacity = isConnected ? "1" : "0.62";
  nodeEl.style.filter = isConnected ? "grayscale(0)" : "grayscale(1) saturate(0)";
  nodeEl.classList.toggle("just-connected", !!node.justConnectedAt && Date.now() - node.justConnectedAt < 700);

  nodeEl.querySelector(".type").textContent = node.type;
  nodeEl.querySelector(".type").style.color = tone;
  nodeEl.querySelector(".title").textContent = node.title;
  const contentEl = nodeEl.querySelector(".content");
  contentEl.textContent = node.content;
  const isSocialNodeCard = node.type === "Social Media Posting";
  contentEl.classList.toggle("hidden", isSocialNodeCard);
  const expandBtn = nodeEl.querySelector(".node-expand-content");
  const shouldTruncate = !isSocialNodeCard && (node.content || "").length > 160;
  const isExpanded = nodeEl.classList.contains("content-expanded");
  contentEl.classList.toggle("clamped", shouldTruncate && !isExpanded && document.activeElement !== contentEl);
  expandBtn.classList.toggle("hidden", !shouldTruncate || isExpanded);

  const tags = [];
  if (node.channel) tags.push(`Channel: ${node.channel}`);
  if (node.goal) tags.push(`Goal: ${node.goal}`);
  if (node.audience) tags.push(`Audience: ${node.audience}`);
  if (node.type === "Content") tags.push(`Format: ${node.contentFormat || "1:1"}`);
  tags.push(...node.tags);

  const tagsWrap = nodeEl.querySelector(".tags");
  tagsWrap.innerHTML = "";
  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    if (!tag.startsWith("Channel: ") && !tag.startsWith("Goal: ") && !tag.startsWith("Audience: ")) {
      const x = document.createElement("button");
      x.type = "button";
      x.className = "image-delete-btn";
      x.textContent = "✕";
      x.style.width = "14px";
      x.style.height = "14px";
      x.style.fontSize = "0.56rem";
      x.style.top = "-4px";
      x.style.right = "-4px";
      x.style.display = "none";
      chip.style.position = "relative";
      chip.addEventListener("mouseenter", () => { x.style.display = "inline-flex"; });
      chip.addEventListener("mouseleave", () => { x.style.display = "none"; });
      x.addEventListener("click", (event) => {
        event.stopPropagation();
        pushHistorySnapshot();
        node.tags = node.tags.filter((t) => t !== tag);
        updateNodeCard(node);
        if (state.selectedPrimary === node.id) fillInspector(node);
      });
      chip.appendChild(x);
    }
    tagsWrap.appendChild(chip);
  });

  const variantsWrap = nodeEl.querySelector(".ab-tests");
  variantsWrap.innerHTML = "";
  node.variants.forEach((variant) => {
    const chip = document.createElement("span");
    chip.className = "variant";
    chip.textContent = variant;
    variantsWrap.appendChild(chip);
  });

  const imageStrip = nodeEl.querySelector(".image-strip");
  imageStrip.innerHTML = "";
  if (node.images.length) {
    const favoriteImage = node.images.find((img) => img.id === node.favoriteImageId);
    const previewImage = favoriteImage || node.images[node.images.length - 1];
    const thumb = document.createElement("div");
    thumb.className = `image-thumb image-thumb-preview${favoriteImage ? " is-favorite" : ""}`;

    const image = document.createElement("img");
    image.className = "node-image-preview";
    image.src = previewImage.url;
    image.alt = previewImage.name || "Node image";

    const badge = document.createElement("span");
    badge.className = "image-badge";
    badge.textContent = favoriteImage ? "★" : "🖼";

    thumb.append(image, badge);

    const extraCount = node.images.length - 1;
    if (extraCount > 0) {
      const more = document.createElement("span");
      more.className = "image-more-count";
      more.textContent = `+${extraCount}`;
      thumb.appendChild(more);
    }

    imageStrip.appendChild(thumb);
  }

  const social = nodeEl.querySelector(".social-preview");
  const isSocial = node.type === "Social Media Posting";
  social.classList.toggle("hidden", !isSocial);
  if (isSocial) {
    social.innerHTML = `<strong>${node.social.platform} Preview</strong><p>${node.social.caption || ""}</p><small>${node.social.hashtags.join(" ")}</small><em>${node.social.preview || ""}</em>`;
    if (node.social.scheduledAt) {
      const when = new Date(node.social.scheduledAt);
      const scheduled = document.createElement("small");
      scheduled.textContent = `Geplant: ${when.toLocaleString("de-DE")}`;
      social.appendChild(scheduled);
    }
    const planBtn = document.createElement("button");
    planBtn.type = "button";
    planBtn.className = "inspector-image-delete";
    planBtn.textContent = "Add to Posting Plan";
    planBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openPostingPlanner(node.id);
    });
    social.appendChild(planBtn);
  }

  const captionEl = nodeEl.querySelector(".content-pack-caption");
  const ctaEl = nodeEl.querySelector(".content-pack-cta");
  const statusEl = nodeEl.querySelector(".content-pack-status");
  captionEl.classList.toggle("hidden", !node.caption);
  captionEl.textContent = node.caption ? `Caption: ${node.caption}` : "";
  ctaEl.classList.toggle("hidden", !node.cta);
  ctaEl.textContent = node.cta ? `CTA: ${node.cta}` : "";
  statusEl.classList.toggle("hidden", !(node.isGeneratingContentPack || node.contentPackError));
  statusEl.textContent = node.isGeneratingContentPack ? "Generating content pack..." : (node.contentPackError || "");
  statusEl.classList.toggle("error", !!node.contentPackError);

  const existingBar = nodeEl.querySelector(".reaction-bar");
  if (existingBar) existingBar.remove();
  const reactionEntries = Object.entries(node.reactions || {}).filter(([, count]) => count > 0);
  if (reactionEntries.length) {
    const bar = document.createElement("div");
    bar.className = "reaction-bar";
    reactionEntries.forEach(([emoji, count]) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "reaction-pill";
      item.textContent = `${emoji} ${count}`;
      item.title = "Click to remove one reaction";
      item.addEventListener("click", (event) => {
        event.stopPropagation();
        pushHistorySnapshot();
        node.reactions[emoji] = Math.max(0, (node.reactions[emoji] || 0) - 1);
        if (node.reactions[emoji] === 0) delete node.reactions[emoji];
        updateNodeCard(node);
      });
      bar.appendChild(item);
    });
    nodeEl.appendChild(bar);
  }

  renderPostits(node, nodeEl);
}

function renderPostits(node, nodeEl) {
  nodeEl.querySelectorAll(".postit").forEach((p) => p.remove());

  node.postits.forEach((note) => {
    if (!Array.isArray(note.replies)) note.replies = [];
    const postit = el.postitTemplate.content.firstElementChild.cloneNode(true);
    postit.style.left = `${note.x}px`;
    postit.style.top = `${note.y}px`;
    postit.style.background = note.color;

    postit.querySelector(".postit-user").textContent = note.user;
    postit.querySelector(".postit-time").textContent = note.time;

    const color = postit.querySelector(".postit-color");
    color.value = note.color;
    color.addEventListener("input", () => {
      note.color = color.value;
      postit.style.background = color.value;
      saveCampaignCanvasState();
    });

    const area = postit.querySelector(".postit-text");
    area.value = note.text;
    area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
    area.addEventListener("input", () => {
      note.text = area.value;
      area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
      saveCampaignCanvasState();
    });

    postit.querySelector(".postit-delete").addEventListener("click", () => {
      node.postits = node.postits.filter((n) => n.id !== note.id);
      renderPostits(node, nodeEl);
      saveCampaignCanvasState();
    });

    const repliesWrap = document.createElement("div");
    repliesWrap.className = "postit-replies";
    note.replies.forEach((reply) => {
      const line = document.createElement("p");
      line.className = "postit-reply";
      line.textContent = `${reply.user} (${reply.time}): ${reply.text}`;
      repliesWrap.appendChild(line);
    });

    const addReplyBtn = document.createElement("button");
    addReplyBtn.type = "button";
    addReplyBtn.className = "inspector-image-delete";
    addReplyBtn.textContent = "Reply";
    addReplyBtn.addEventListener("click", () => {
      if (postit.querySelector(".postit-reply-editor")) return;
      const editor = document.createElement("div");
      editor.className = "postit-reply-editor";
      editor.innerHTML = `<input class="postit-reply-name" placeholder="Name" /><textarea class="postit-reply-input" rows="2" placeholder="Write a reply..."></textarea><button type="button" class="inspector-image-delete">Send</button>`;
      editor.querySelector("button").addEventListener("click", () => {
        const user = editor.querySelector(".postit-reply-name").value.trim() || "Anonymous";
        const text = editor.querySelector(".postit-reply-input").value.trim();
        if (!text) return;
        note.replies.push({ user, text, time: nowString() });
        renderPostits(node, nodeEl);
        saveCampaignCanvasState();
      });
      postit.appendChild(editor);
    });

    postit.append(repliesWrap, addReplyBtn);

    enablePostitDrag(postit, note);
    nodeEl.appendChild(postit);
  });
}

function enablePostitDrag(postit, note) {
  postit.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || event.target.closest("textarea,input,button")) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const ox = note.x;
    const oy = note.y;

    function move(ev) {
      note.x = ox + (ev.clientX - startX) / state.zoom;
      note.y = oy + (ev.clientY - startY) / state.zoom;
      postit.style.left = `${note.x}px`;
      postit.style.top = `${note.y}px`;
    }

    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveCampaignCanvasState();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function fillInspector(node) {
  if (!node) {
    el.inspectorMeta.textContent = "Wähle oder erstelle einen Node.";
    el.nodeForm.reset();
    el.socialFields.classList.add("hidden");
    el.contentUploadFields.classList.add("hidden");
    el.contentFormatField.classList.add("hidden");
    const variantsLabel = el.nodeForm.querySelector('label[for="node-variants"]');
    variantsLabel?.classList.remove("hidden");
    el.inputs.variants.classList.remove("hidden");
    el.inspectorImageList.innerHTML = "";
    updateInspectorActionVisibility();
    return;
  }

  el.inspectorMeta.textContent = `Bearbeite ${node.id}`;
  el.inputs.type.value = node.type;
  el.inputs.title.value = node.title;
  el.inputs.content.value = node.content;
  el.inputs.variants.value = node.variants.join(", ");
  el.inputs.platform.value = node.social.platform;
  el.inputs.caption.value = node.social.caption;
  el.inputs.hashtags.value = node.social.hashtags.join(", ");
  el.inputs.preview.value = node.social.preview;
  el.inputs.audience.value = node.audience;
  el.inputs.goal.value = node.goal;
  el.inputs.channel.value = node.channel;
  el.inputs.contentFormat.value = node.contentFormat || "1:1";

  el.socialFields.classList.toggle("hidden", node.type !== "Social Media Posting");
  el.contentUploadFields.classList.toggle("hidden", !(node.type === "Content" || node.type === "Social Media Posting"));
  el.contentFormatField.classList.toggle("hidden", node.type !== "Content");
  const variantsLabel = el.nodeForm.querySelector('label[for="node-variants"]');
  const hideVariants = node.type === "Content";
  variantsLabel?.classList.toggle("hidden", hideVariants);
  el.inputs.variants.classList.toggle("hidden", hideVariants);
  renderInspectorImages(node);
  updateInspectorActionVisibility();
}

function revokeImageObjectUrl(img) {
  if (!img?.url) return;
  if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
}

function removeNodeImage(node, imageId) {
  const idx = node.images.findIndex((img) => img.id === imageId);
  if (idx === -1) return;
  const [removed] = node.images.splice(idx, 1);
  if (node.favoriteImageId === imageId) node.favoriteImageId = null;
  revokeImageObjectUrl(removed);
  updateNodeCard(node);
  if (state.selectedPrimary === node.id) fillInspector(node);
}



function downloadNodeImage(node, img) {
  const a = document.createElement("a");
  a.href = img.url;
  const safeName = (img.name || node.title || node.content || "node-image")
    .slice(0, 40)
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-+|-+$/g, "");
  a.download = `${safeName || "node-image"}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function renderInspectorImages(node) {
  el.inspectorImageList.innerHTML = "";
  if (!node.images.length) {
    const empty = document.createElement("p");
    empty.className = "inspector-image-name";
    empty.textContent = "Keine Bilder hochgeladen.";
    el.inspectorImageList.appendChild(empty);
    return;
  }

  node.images.forEach((img) => {
    const card = document.createElement("div");
    const isFavorite = node.favoriteImageId === img.id;
    card.className = `inspector-image-item${isFavorite ? " is-favorite" : ""}`;
    card.addEventListener("click", () => openLightbox(img.url, img.name || "Image preview"));

    const thumb = document.createElement("img");
    thumb.className = "inspector-image-thumb";
    thumb.src = img.url;
    thumb.alt = img.name || "Bild";
    thumb.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      openLightbox(img.url, img.name || "Image preview");
    });

    const favoriteTag = document.createElement("span");
    favoriteTag.className = "inspector-image-favorite-tag";
    favoriteTag.textContent = "★";

    const actions = document.createElement("div");
    actions.className = "inspector-image-actions";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "inspector-image-action";
    favoriteBtn.textContent = "⭐";
    favoriteBtn.title = "Set as favorite";
    favoriteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      node.favoriteImageId = node.favoriteImageId === img.id ? null : img.id;
      updateNodeCard(node);
      fillInspector(node);
      saveCampaignCanvasState();
    });

    const downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "inspector-image-action";
    downloadBtn.textContent = "⬇️";
    downloadBtn.title = "Download";
    downloadBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadNodeImage(node, img);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inspector-image-action danger";
    deleteBtn.textContent = "❌";
    deleteBtn.title = "Delete";
    deleteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      removeNodeImage(node, img.id);
    });

    const name = document.createElement("span");
    name.className = "inspector-image-name";
    name.textContent = img.name || "Bild";

    actions.append(favoriteBtn, downloadBtn, deleteBtn);
    card.append(thumb, favoriteTag, actions, name);
    el.inspectorImageList.appendChild(card);
  });
}


async function refineNodeWithAI(node, instruction) {
  const parentNode = getDirectParentNode(node.id);
  const campaignContext = getCampaignContextSummary();
  const response = await fetch("/api/refine-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeType: node.type,
      currentContent: {
        title: node.title || "",
        content: node.content || "",
        caption: node.social?.caption || ""
      },
      instruction,
      brandBrainData: state.brandCore,
      parentNode: parentNode
        ? { title: parentNode.title || "", content: parentNode.content || "", type: parentNode.type || "" }
        : undefined,
      campaignContext: campaignContext || undefined
    })
  });
  if (!response.ok) {
    const errorResponse = await response.json().catch(() => ({}));
    console.error("Refine node failed", errorResponse);
    throw new Error(errorResponse?.error || "Refine API request failed");
  }
  return response.json();
}

async function runInlineRefine(node, instruction, triggerBtn = null) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (!nodeEl) return;
  const toolbarButtons = [...nodeEl.querySelectorAll(".node-ai-toolbar button")];
  const originalText = triggerBtn?.textContent || "";
  toolbarButtons.forEach((btn) => { btn.disabled = true; });
  if (triggerBtn) triggerBtn.textContent = "…";
  nodeEl.classList.add("ai-loading");
  try {
    const refined = await refineNodeWithAI(node, instruction);
    node.title = refined?.title || node.title;
    node.content = refined?.content || node.content;
    if (node.type === "Social Media Posting" && refined?.caption) node.social.caption = refined.caption;
    updateNodeCard(node);
    fillInspector(node);
    saveCampaignCanvasState();
    nodeEl.classList.add("ai-updated");
    setTimeout(() => nodeEl.classList.remove("ai-updated"), 1300);
  } catch (_error) {
    alert("Could not refine node right now. Please try again.");
  } finally {
    nodeEl.classList.remove("ai-loading");
    toolbarButtons.forEach((btn) => { btn.disabled = false; });
    if (triggerBtn) triggerBtn.textContent = originalText;
  }
}

async function generateFullContentPack(node, triggerBtn = null) {
  if (!node || node.isGeneratingContentPack) return;
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  const toolbarButtons = nodeEl ? [...nodeEl.querySelectorAll(".node-ai-toolbar button")] : [];
  const originalText = triggerBtn?.textContent || "";
  node.isGeneratingContentPack = true;
  node.contentPackError = "";
  toolbarButtons.forEach((btn) => { btn.disabled = true; });
  if (triggerBtn) triggerBtn.textContent = "…";
  updateNodeCard(node);
  try {
    const improved = await refineNodeWithAI(node, "Improve or finalize this content while preserving intent and brand voice.");
    node.title = improved?.title || node.title;
    node.content = improved?.content || node.content;

    const captionResult = await refineNodeWithAI(node, "Write one short social-media-ready caption based on this content. Return it in caption.");
    node.caption = (captionResult?.caption || captionResult?.content || "").trim();
    if (!node.caption) throw new Error("Caption generation failed");

    const ctaResult = await refineNodeWithAI(node, "Write one clear, concise call-to-action line based on this content. Return it in content.");
    node.cta = (ctaResult?.content || ctaResult?.caption || "").split("\n")[0].trim();
    if (!node.cta) throw new Error("CTA generation failed");

    await generateImageForNode(node);
    updateNodeCard(node);
    fillInspector(node);
    saveCampaignCanvasState();
  } catch (_error) {
    node.contentPackError = "Could not generate content pack. Please retry.";
    updateNodeCard(node);
  } finally {
    node.isGeneratingContentPack = false;
    toolbarButtons.forEach((btn) => { btn.disabled = false; });
    if (triggerBtn) triggerBtn.textContent = originalText;
    updateNodeCard(node);
  }
}

async function generateImageForNode(node) {
  console.log("generate image start");
  const button = el.generateImageButton;
  const originalLabel = button.textContent;
  let imageAttached = false;
  button.disabled = true;
  button.textContent = "Generating image...";
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (nodeEl) nodeEl.classList.add("image-generating");
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeTitle: node.title || "",
        nodeContent: node.content || "",
        brandBrainData: state.brandCore,
        campaignContext: getCampaignContextSummary(),
        contentFormat: node.contentFormat || "1:1"
      })
    });
    if (!response.ok) throw new Error("Image generation failed");
    const data = await response.json();
    console.log("generate image API response", data);
    const imageUrl = data?.imageUrl || data?.url || "";
    console.log("resolved image URL", imageUrl);
    if (!imageUrl) throw new Error("Image response is empty");
    const newImage = {
      id: crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}`,
      url: imageUrl,
      name: "generated-image.png",
      createdAt: Date.now(),
      source: "generated"
    };
    node.images = Array.isArray(node.images) ? node.images : [];
    console.log("BEFORE image add", node.id, node.images?.length, node.images);
    node.images.push(newImage);
    console.log("AFTER image add", node.id, node.images?.length, node.images);
    imageAttached = true;
    console.log("image attached to node", node.id);
    updateNodeCard(node);
    fillInspector(node);
    saveCampaignCanvasState();
    console.log("SAVED image count", serializeState().nodes.find((n) => n.id === node.id)?.images?.length);
    console.log("generate image success - no alert");
    return;
  } catch (error) {
    if (!imageAttached) {
      console.error("SHOWING IMAGE ERROR ALERT", error);
      alert("Could not generate image right now. Please try again.");
    }
  } finally {
    if (nodeEl) nodeEl.classList.remove('image-generating');
    button.disabled = false;
    button.textContent = originalLabel;
    updateInspectorActionVisibility();
  }
}

function getParentContentNode(nodeId) {
  const parentId = state.edges.find(([, to]) => to === nodeId)?.[0];
  const parent = parentId ? getNode(parentId) : null;
  return parent?.type === "Content" ? parent : null;
}

async function generatePostingVisualForNode(node) {
  let postingVisualAttached = false;
  const parentContent = getParentContentNode(node.id);
  if (!parentContent?.images?.length) {
    alert("Please connect this post to a Content node with an image first.");
    return;
  }
  const favoriteImage = parentContent.images.find((img) => img.id === parentContent.favoriteImageId);
  const sourceImage = favoriteImage || parentContent.images[parentContent.images.length - 1];
  console.log("content images before save", parentContent.images);
  console.log("selected source image", sourceImage?.id, sourceImage?.url?.slice(0, 30));
  if (!sourceImage?.url) {
    alert("Please connect this post to a Content node with an image first.");
    return;
  }
  const overlayText = (node.title || "").trim() || (node.social?.caption || "").split("\n")[0].trim();
  if (!overlayText) {
    alert("Please add a title or caption first.");
    return;
  }

  const button = el.generatePostingVisualButton;
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (nodeEl) nodeEl.classList.add('image-generating');
  const originalLabel = button.textContent;
  button.disabled = true;
  button.textContent = "Generating posting visual...";
  try {
    const response = await fetch("/api/generate-posting-visual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sourceImage: sourceImage.url,
        overlayText,
        format: node.contentFormat || "1:1",
        brandBrainData: state.brandCore,
        campaignContext: getCampaignContextSummary()
      })
    });
    if (!response.ok) throw new Error("Posting visual generation failed");
    const data = await response.json();
    const imageUrl = data?.imageUrl || data?.url || "";
    if (!imageUrl) throw new Error("No posting visual returned");
    const newImage = {
      id: crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}`,
      url: imageUrl,
      name: "generated-image.png",
      createdAt: Date.now(),
      source: "generated"
    };
    node.images = Array.isArray(node.images) ? node.images : [];
    console.log("BEFORE image add", node.id, node.images?.length, node.images);
    node.images.push(newImage);
    console.log("AFTER image add", node.id, node.images?.length, node.images);
    postingVisualAttached = true;
    saveCampaignCanvasState();
    console.log("posting visual attached", node.images);
    console.log("SAVED image count", serializeState().nodes.find((n) => n.id === node.id)?.images?.length);
    updateNodeCard(node);
    fillInspector(node);
    return;
  } catch (error) {
    if (!postingVisualAttached) {
      alert("Could not generate posting visual right now. Please try again.");
    }
  } finally {
    if (nodeEl) nodeEl.classList.remove('image-generating');
    button.disabled = false;
    button.textContent = originalLabel;
    updateInspectorActionVisibility();
  }
}

async function runImproveNodeFlow(node) {
  const presets = {
    Emotional: "Make it more emotional",
    Direct: "Make it more direct",
    Premium: "Make it feel more premium and high-end",
    Shorter: "Make it shorter and more concise"
  };
  let selectedLabel = "";
  let selectedInstruction = "";

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(10,10,14,.45);z-index:10000;display:flex;align-items:center;justify-content:center;padding:20px";
  overlay.innerHTML = `<div style="width:min(560px,95vw);background:#fff;border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:12px">
    <h3 style="margin:0">✨ Improve with AI</h3>
    <div id="improve-ai-options" style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
      <button type="button" data-preset="Emotional">Emotional</button>
      <button type="button" data-preset="Direct">Direct</button>
      <button type="button" data-preset="Premium">Premium</button>
      <button type="button" data-preset="Shorter">Shorter</button>
      <button type="button" data-preset="Custom" style="grid-column:1/-1">Custom</button>
    </div>
    <input id="improve-ai-custom" class="hidden" placeholder="Enter your instruction..." />
    <div id="improve-ai-loader" class="hidden" style="border:1px solid #ececf4;border-radius:10px;padding:10px;background:#fafaff">
      <strong>✨ Improving content<span id="improve-ai-dots"></span></strong>
      <p id="improve-ai-subtext" style="margin:6px 0 0;color:#5f6174">Analyzing brand voice...</p>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px">
      <button type="button" id="improve-ai-cancel">Cancel</button>
      <button type="button" id="improve-ai-run" disabled>Improve</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  const optionWrap = overlay.querySelector("#improve-ai-options");
  const customInput = overlay.querySelector("#improve-ai-custom");
  const runBtn = overlay.querySelector("#improve-ai-run");
  const cancelBtn = overlay.querySelector("#improve-ai-cancel");
  const loader = overlay.querySelector("#improve-ai-loader");
  const dotsEl = overlay.querySelector("#improve-ai-dots");
  const subtextEl = overlay.querySelector("#improve-ai-subtext");
  let thinkingTimer = null;
  let thinkingTick = 0;
  const startThinking = () => {
    loader.classList.remove("hidden");
    const steps = ["Analyzing brand voice...", "Refining tone...", "Optimizing structure..."];
    thinkingTimer = setInterval(() => {
      thinkingTick += 1;
      dotsEl.textContent = ".".repeat((thinkingTick % 3) + 1);
      subtextEl.textContent = steps[thinkingTick % steps.length];
    }, 450);
  };
  const stopThinking = () => {
    loader.classList.add("hidden");
    if (thinkingTimer) clearInterval(thinkingTimer);
    thinkingTimer = null;
    dotsEl.textContent = "";
  };

  const refreshSelectionUI = () => {
    optionWrap.querySelectorAll("button").forEach((btn) => {
      const active = btn.dataset.preset === selectedLabel;
      btn.style.border = active ? "2px solid #6b4eff" : "1px solid #d6d6df";
      btn.style.background = active ? "#f3f0ff" : "#fff";
    });
    const instructionReady = selectedLabel === "Custom" ? !!customInput.value.trim() : !!selectedInstruction;
    runBtn.disabled = !instructionReady;
  };

  optionWrap.addEventListener("click", (event) => {
    const btn = event.target.closest("button[data-preset]");
    if (!btn) return;
    selectedLabel = btn.dataset.preset;
    if (selectedLabel === "Custom") {
      customInput.classList.remove("hidden");
      selectedInstruction = customInput.value.trim();
      customInput.focus();
    } else {
      customInput.classList.add("hidden");
      selectedInstruction = presets[selectedLabel];
    }
    refreshSelectionUI();
  });

  customInput.addEventListener("input", () => {
    if (selectedLabel === "Custom") selectedInstruction = customInput.value.trim();
    refreshSelectionUI();
  });

  cancelBtn.addEventListener("click", () => overlay.remove());

  runBtn.addEventListener("click", async () => {
    const instruction = selectedLabel === "Custom" ? customInput.value.trim() : selectedInstruction;
    if (!instruction) return;
    const originalLabel = el.improveNodeButton.textContent;
    el.improveNodeButton.disabled = true;
    el.improveNodeButton.textContent = "✨ Improving...";
    runBtn.disabled = true;
    runBtn.textContent = "Improving...";
    cancelBtn.disabled = true;
    optionWrap.style.pointerEvents = "none";
    customInput.disabled = true;
    startThinking();
    try {
      const refined = await refineNodeWithAI(node, instruction);
      node.title = refined?.title || node.title;
      node.content = refined?.content || node.content;
      if (node.type === "Social Media Posting" && refined?.caption) node.social.caption = refined.caption;
      updateNodeCard(node);
      const updatedEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
      if (updatedEl) {
        updatedEl.classList.add("ai-updated");
        setTimeout(() => updatedEl.classList.remove("ai-updated"), 1300);
      }
      fillInspector(node);
      saveCampaignCanvasState();
      stopThinking();
      overlay.remove();
    } catch (_error) {
      alert("Could not refine node right now. Please try again.");
      runBtn.disabled = false;
      runBtn.textContent = "Improve";
      cancelBtn.disabled = false;
      optionWrap.style.pointerEvents = "";
      customInput.disabled = false;
      stopThinking();
    } finally {
      el.improveNodeButton.disabled = false;
      el.improveNodeButton.textContent = originalLabel;
    }
  });
}

function updateListView() {
  el.nodeListView.innerHTML = "";

  const groups = state.nodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {});

  const types = Object.keys(groups).sort();
  if (types.length === 0) {
    el.nodeListView.innerHTML = '<p class="list-empty">Keine Nodes vorhanden.</p>';
    return;
  }

  types.forEach((type) => {
    const section = document.createElement("section");
    section.className = "list-group";
    const h = document.createElement("h4");
    h.textContent = `${type} (${groups[type].length})`;
    h.style.color = NODE_TYPES[type]?.color || "#333";
    section.appendChild(h);

    const ul = document.createElement("ul");
    groups[type].forEach((node) => {
      const li = document.createElement("li");
      li.textContent = node.title || "(ohne Titel)";
      li.addEventListener("click", () => {
        toggleListMode(false);
        state.selectedIds.clear();
        state.selectedIds.add(node.id);
        state.selectedPrimary = node.id;
        updateSelectionClasses();
        fillInspector(node);
        forceNodeVisible(node.id);
        ensureNodeActuallyVisible(node);
      });
      ul.appendChild(li);
    });
    section.appendChild(ul);
    el.nodeListView.appendChild(section);
  });
}

function renderNode(node) {
  const nodeEl = el.nodeTemplate.content.firstElementChild.cloneNode(true);
  nodeEl.dataset.id = node.id;

  nodeEl.addEventListener("click", (event) => {
    collapseExpandedNodes(node.id);
    const append = event.shiftKey;
    if (!append) state.selectedIds.clear();
    state.selectedIds.add(node.id);
    state.selectedPrimary = node.id;
    updateSelectionClasses();
    fillInspector(node);
  });

  nodeEl.querySelector(".connector-handle").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stopExistingNodeConnection();

    const start = nodeBottomCenter(node.id);
    if (!start) return;

    openTypePicker((type) => {
      state.connectorCreateMode = { fromId: node.id, type, start, current: start };

      const ghost = document.createElement("article");
      ghost.className = "node node-ghost";
      ghost.innerHTML = `<span class="type">${type}</span><h3>${type}</h3>`;
      el.zoomLayer.appendChild(ghost);
      state.connectorGhostEl = ghost;
      drawLinks();

      function move(ev) {
        if (!state.connectorCreateMode) return;
        const point = boardPointFromClient(ev.clientX, ev.clientY);
        state.connectorCreateMode.current = point;
        if (state.connectorGhostEl) {
          state.connectorGhostEl.style.left = `${point.x - NODE_WIDTH / 2}px`;
          state.connectorGhostEl.style.top = `${point.y - NODE_HEIGHT / 2}px`;
        }
        drawLinks();
      }

      function place(ev) {
        if (!state.connectorCreateMode) return;
        ev.preventDefault();
        const point = boardPointFromClient(ev.clientX, ev.clientY);
        const fromId = state.connectorCreateMode.fromId;
        const nodeType = state.connectorCreateMode.type;

        state.connectorCreateMode = null;
        if (state.connectorGhostEl) {
          state.connectorGhostEl.remove();
          state.connectorGhostEl = null;
        }
        window.removeEventListener("pointermove", move);
        el.canvas.removeEventListener("click", place, true);

        const prevCount = state.nodes.length;
        const created = createNode({
          type: nodeType,
          position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 }
        });
        const newNode = created || state.nodes[state.nodes.length - 1];
        if (state.nodes.length > prevCount && newNode) {
          addEdge(fromId, newNode.id);
        }
      }

      window.addEventListener("pointermove", move);
      el.canvas.addEventListener("click", place, true);
    }, "Content");
  });

  nodeEl.querySelector(".connector-link-handle").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    startExistingNodeConnection(node.id);
  });

  const title = nodeEl.querySelector(".title");
  const content = nodeEl.querySelector(".content");
  const aiToolbar = document.createElement("div");
  aiToolbar.className = "node-ai-toolbar";
  [
    ["✨ Improve", "Improve this node while keeping the original intent."],
    ["🔄 Regenerate", "Regenerate this node as a fresh alternative version while keeping it aligned with the campaign context and brand voice."],
    ["Shorter", "Make this shorter and more concise."],
    ["Emotional", "Make this more emotional and engaging."],
    ["Direct", "Make this more direct and clear."]
  ].forEach(([label, instruction]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = label;
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await runInlineRefine(node, instruction, btn);
    });
    aiToolbar.appendChild(btn);
  });
  const fullPackBtn = document.createElement("button");
  fullPackBtn.type = "button";
  fullPackBtn.textContent = "Generate Full Content Pack";
  fullPackBtn.addEventListener("click", async (event) => {
    event.stopPropagation();
    await generateFullContentPack(node, fullPackBtn);
  });
  aiToolbar.appendChild(fullPackBtn);
  nodeEl.appendChild(aiToolbar);

  const expandBtn = document.createElement("button");
  expandBtn.type = "button";
  expandBtn.className = "node-expand-content hidden";
  expandBtn.textContent = "↗";
  expandBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    nodeEl.classList.add("content-expanded");
    content.classList.remove("clamped");
    expandBtn.classList.add("hidden");
  });
  content.addEventListener("click", () => {
    if (!content.classList.contains("clamped")) return;
    nodeEl.classList.add("content-expanded");
    content.classList.remove("clamped");
    expandBtn.classList.add("hidden");
  });
  content.insertAdjacentElement("afterend", expandBtn);

  title.addEventListener("input", () => {
    node.title = title.textContent.trim();
    if (state.selectedPrimary === node.id) el.inputs.title.value = node.title;
    updateListView();
    saveCampaignCanvasState();
  });
  content.addEventListener("input", () => {
    node.content = content.textContent.trim();
    if (state.selectedPrimary === node.id) el.inputs.content.value = node.content;
    if ((node.content || "").length <= 160) nodeEl.classList.remove("content-expanded");
    const shouldTruncate = !isSocialNodeCard && (node.content || "").length > 160;
    const isExpanded = nodeEl.classList.contains("content-expanded");
    content.classList.toggle("clamped", shouldTruncate && !isExpanded && document.activeElement !== content);
    expandBtn.classList.toggle("hidden", !shouldTruncate || isExpanded);
    saveCampaignCanvasState();
  });
  content.addEventListener("focus", () => content.classList.remove("clamped"));
  content.addEventListener("blur", () => {
    const shouldTruncate = !isSocialNodeCard && (node.content || "").length > 160;
    const isExpanded = nodeEl.classList.contains("content-expanded");
    content.classList.toggle("clamped", shouldTruncate && !isExpanded);
  });

  enableNodeDrag(nodeEl, node);
  el.zoomLayer.appendChild(nodeEl);
  updateNodeCard(node);
}

function stopExistingNodeConnection() {
  if (state.activeConnectionMoveHandler) {
    window.removeEventListener("pointermove", state.activeConnectionMoveHandler);
    state.activeConnectionMoveHandler = null;
  }
  if (state.activeConnectionPlaceHandler) {
    el.canvas.removeEventListener("click", state.activeConnectionPlaceHandler, true);
    state.activeConnectionPlaceHandler = null;
  }
  state.activeConnection = null;
  drawLinks();
}

function startExistingNodeConnection(fromId) {
  stopExistingNodeConnection();
  const start = nodeBottomCenter(fromId);
  if (!start) return;
  state.activeConnection = { fromId, start, current: start };

  const move = (ev) => {
    if (!state.activeConnection) return;
    state.activeConnection.current = boardPointFromClient(ev.clientX, ev.clientY);
    const hoverNode = ev.target.closest?.(".node");
    const toId = hoverNode?.dataset?.id;
    if (toId && toId !== fromId) {
      addEdge(fromId, toId);
      stopExistingNodeConnection();
      return;
    }
    drawLinks();
  };

  const place = (ev) => {
    if (!state.activeConnection) return;
    const targetEl = ev.target.closest(".node");
    if (targetEl) {
      const toId = targetEl.dataset.id;
      if (toId && toId !== fromId) {
        addEdge(fromId, toId);
      }
    }
    stopExistingNodeConnection();
  };

  state.activeConnectionMoveHandler = move;
  state.activeConnectionPlaceHandler = place;
  window.addEventListener("pointermove", move);
  setTimeout(() => el.canvas.addEventListener("click", place, true), 0);
  drawLinks();
}

function enableNodeDrag(nodeEl, node) {
  nodeEl.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (event.target.closest("button,input,textarea,select")) return;

    if (!state.selectedIds.has(node.id)) {
      state.selectedIds.clear();
      state.selectedIds.add(node.id);
      state.selectedPrimary = node.id;
      updateSelectionClasses();
      fillInspector(node);
    }

    const moveIds = [...state.selectedIds];
    const origins = moveIds.map((id) => ({ id, x: getNode(id).position.x, y: getNode(id).position.y }));
    const sx = event.clientX;
    const sy = event.clientY;

    function move(ev) {
      const dx = (ev.clientX - sx) / state.zoom;
      const dy = (ev.clientY - sy) / state.zoom;
      origins.forEach((o) => {
        const n = getNode(o.id);
        n.position.x = o.x + dx;
        n.position.y = o.y + dy;
        updateNodeCard(n);
      });
      drawLinks();
    }

    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      saveCampaignCanvasState();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function toggleListMode(showList) {
  const shouldShowList = typeof showList === "boolean" ? showList : !el.canvas.classList.contains("hidden");
  el.canvas.classList.toggle("hidden", shouldShowList);
  el.boardListView.classList.toggle("hidden", !shouldShowList);

  if (!shouldShowList && state.selectedPrimary) {
    const selected = getNode(state.selectedPrimary);
    if (selected) {
      forceNodeVisible(selected.id);
      ensureNodeActuallyVisible(selected);
    }
  }
}

function renderCalendarView() {
  const month = state.calendarMonth;
  el.calendarTitle.textContent = month.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
  el.calendarGrid.innerHTML = "";
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const padStart = (start.getDay() + 6) % 7;
  const today = new Date();
  for (let i = 0; i < padStart; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-day";
    empty.style.visibility = "hidden";
    el.calendarGrid.appendChild(empty);
  }
  for (let d = 1; d <= end.getDate(); d++) {
    const day = document.createElement("div");
    day.className = "calendar-day";
    if (today.getFullYear() === month.getFullYear() && today.getMonth() === month.getMonth() && today.getDate() === d) day.classList.add("today");
    day.innerHTML = `<strong>${d}</strong>`;
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    state.nodes.filter((n) => n.type === "Social Media Posting" && n.social.scheduledAt?.startsWith(key)).forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-post";
      const when = new Date(n.social.scheduledAt);
      btn.textContent = `${n.title || n.id} · ${when.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`;
      btn.addEventListener("click", () => {
        setActiveView("board");
        state.selectedIds.clear();
        state.selectedIds.add(n.id);
        state.selectedPrimary = n.id;
        updateSelectionClasses();
        fillInspector(n);
        forceNodeVisible(n.id);
      });
      day.appendChild(btn);
    });
    el.calendarGrid.appendChild(day);
  }
}



function setSidebarCollapsed(collapsed) {
  if (!el.appShell) return;
  el.appShell.classList.toggle("sidebar-collapsed", !!collapsed);
  if (el.sidebarToggleButton) {
    el.sidebarToggleButton.textContent = collapsed ? "▶" : "◀";
    el.sidebarToggleButton.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
    el.sidebarToggleButton.title = collapsed ? "Expand sidebar" : "Collapse sidebar";
  }
}

function setActiveView(view) {
  state.activeView = view;
  el.canvas.classList.toggle("hidden", view !== "board");
  el.boardListView.classList.toggle("hidden", view !== "list");
  el.calendarView.classList.toggle("hidden", view !== "calendar");
  el.boardsLibraryView?.classList.toggle("hidden", view !== "boards_library");
  el.brandCoreWorkspace.classList.toggle("hidden", view !== "brand-core");
  el.campaignCanvasNavButton.classList.toggle("active", view !== "brand-core");
  el.brandCoreButton.classList.toggle("active", view === "brand-core");
  el.cycleViewButton.textContent =
    view === "board" ? "Board View" : view === "list" ? "List View" : view === "calendar" ? "Calendar View" : "Brand Core";
  if (view === "calendar") renderCalendarView();
}

function setAppMode(mode) {
  state.appMode = mode;
  const brand = mode === "brand";
  el.canvasTopbar.classList.toggle("hidden", brand);
  el.inspectorPanel.classList.toggle("hidden", brand);
  el.workspaceWrap?.classList?.toggle("brand-mode", brand);
  if (brand) {
    setActiveView("brand-core");
    renderBrandCoreTiles();
    renderBrandCoreEditor();
  }
  else {
    if (state.activeView === "brand-core") setActiveView("board");
    renderCampaignCanvasFromStateIfNeeded();
  }
}

// Events
document.addEventListener("click", (e) => {
  if (e.target.closest(".image-lightbox-close")) {
    e.preventDefault();
    e.stopPropagation();
    closeLightbox();
    return;
  }

  if (e.target.id === "image-lightbox") {
    closeLightbox();
    return;
  }

  const nodeImg = e.target.closest(".node-image-preview");
  if (nodeImg) {
    const url = nodeImg.src || nodeImg.dataset.url;
    if (url) openLightbox(url);
    return;
  }

  const inspectorImg = e.target.closest(".inspector-image-thumb");
  if (inspectorImg) {
    const url = inspectorImg.src || inspectorImg.dataset.url;
    if (url) openLightbox(url);
    return;
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeLightbox();
  }
});
el.sidebarToggleButton?.addEventListener("click", () => {
  const collapsed = !el.appShell.classList.contains("sidebar-collapsed");
  setSidebarCollapsed(collapsed);
});

el.addNodeButton.addEventListener("click", () => {
  setActiveView("board");
  openTypePicker((type) => {
    createNode({ type });
  }, "Idea");
});

el.createCampaignButton.addEventListener("click", () => {
  openCreateCampaignModal();
});

el.cycleViewButton.addEventListener("click", () => {
  const order = ["board", "list", "calendar"];
  const idx = order.indexOf(state.activeView);
  setActiveView(order[(idx + 1) % order.length]);
});
el.viewMenuButton.addEventListener("click", (event) => {
  event.stopPropagation();
  el.viewMenu.classList.toggle("hidden");
});
el.viewBoardButton.addEventListener("click", () => { setActiveView("board"); el.viewMenu.classList.add("hidden"); });
el.viewListButton.addEventListener("click", () => { setActiveView("list"); el.viewMenu.classList.add("hidden"); });
el.viewCalendarButton.addEventListener("click", () => { setActiveView("calendar"); el.viewMenu.classList.add("hidden"); });
document.addEventListener("click", (event) => {
  if (!event.target.closest(".view-switcher")) el.viewMenu.classList.add("hidden");
});
el.calendarPrevMonthButton.addEventListener("click", () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() - 1, 1);
  renderCalendarView();
});
el.calendarNextMonthButton.addEventListener("click", () => {
  state.calendarMonth = new Date(state.calendarMonth.getFullYear(), state.calendarMonth.getMonth() + 1, 1);
  renderCalendarView();
});

el.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.1));
el.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.1));

el.canvas.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      setZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1), { x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    el.canvas.scrollTop += event.deltaY;
    el.canvas.scrollLeft += event.deltaX;
  },
  { passive: false }
);

el.canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const nodeEl = event.target.closest(".node");
  const nodeId = nodeEl?.dataset?.id || null;
  state.contextNodeId = nodeId;
  el.improveContextNodeButton.classList.toggle("hidden", !nodeId);
  const point = boardPointFromClient(event.clientX, event.clientY);
  state.contextBoardPoint = point;
  el.contextMenu.style.left = `${event.clientX}px`;
  el.contextMenu.style.top = `${event.clientY}px`;
  el.contextMenu.style.position = "fixed";
  el.contextMenu.classList.remove("hidden");
});

document.addEventListener("click", (event) => {
  if (!el.contextMenu.contains(event.target)) el.contextMenu.classList.add("hidden");
});

el.addContextNodeButton.addEventListener("click", () => {
  el.contextMenu.classList.add("hidden");
  openTypePicker((type) => {
    createNode({ type });
  }, "Idea");
});

el.addPostitCommentButton.addEventListener("click", () => {
  el.contextMenu.classList.add("hidden");
  if (!state.selectedPrimary) return;
  const node = getNode(state.selectedPrimary);
  if (!node) return;

  const user = window.prompt("Nutzername für den Kommentar:", "Felix")?.trim() || "Anonymous";
  node.postits.push({
    id: `postit-${state.postitCounter++}`,
    user,
    time: nowString(),
    text: "",
    color: "#ffe082",
    x: state.contextBoardPoint.x - node.position.x,
    y: state.contextBoardPoint.y - node.position.y
  });
  updateNodeCard(node);
  saveCampaignCanvasState();
});
el.improveContextNodeButton.addEventListener("click", async () => {
  el.contextMenu.classList.add("hidden");
  if (!state.contextNodeId) return;
  const node = getNode(state.contextNodeId);
  if (!node) return;
  state.selectedIds.clear();
  state.selectedIds.add(node.id);
  state.selectedPrimary = node.id;
  updateSelectionClasses();
  fillInspector(node);
  await runImproveNodeFlow(node);
});
el.contextMenu.querySelectorAll(".emoji-quick").forEach((btn) => {
  btn.addEventListener("click", () => {
    el.contextMenu.classList.add("hidden");
    if (!state.selectedPrimary) return;
    const node = getNode(state.selectedPrimary);
    if (!node) return;
    const emoji = btn.dataset.emoji || "👍";
    node.reactions[emoji] = (node.reactions[emoji] || 0) + 1;
    updateNodeCard(node);
    saveCampaignCanvasState();
  });
});

el.nodeForm.addEventListener("input", (event) => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;

  if (event.target === el.inputs.type) node.type = el.inputs.type.value;
  if (event.target === el.inputs.title) node.title = el.inputs.title.value.trim();
  if (event.target === el.inputs.content) node.content = el.inputs.content.value;
  if (event.target === el.inputs.variants) node.variants = parseList(el.inputs.variants.value);
  if (event.target === el.inputs.platform) node.social.platform = el.inputs.platform.value;
  if (event.target === el.inputs.caption) node.social.caption = el.inputs.caption.value;
  if (event.target === el.inputs.hashtags) node.social.hashtags = parseList(el.inputs.hashtags.value);
  if (event.target === el.inputs.preview) node.social.preview = el.inputs.preview.value;
  if (event.target === el.inputs.audience) node.audience = el.inputs.audience.value.trim();
  if (event.target === el.inputs.goal) node.goal = el.inputs.goal.value.trim();
  if (event.target === el.inputs.channel) node.channel = el.inputs.channel.value.trim();
  if (event.target === el.inputs.contentFormat) node.contentFormat = el.inputs.contentFormat.value || "1:1";

  updateNodeCard(node);
  updateListView();
  fillInspector(node);
  saveCampaignCanvasState();
});
el.inputs.channel.addEventListener("keydown", (event) => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const value = el.inputs.channel.value.trim();
  if (!value) return;
  pushHistorySnapshot();
  node.channel = value;
  updateNodeCard(node);
  fillInspector(node);
  saveCampaignCanvasState();
});

el.imageUpload.addEventListener("change", () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  [...el.imageUpload.files]
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => node.images.push({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }));
  el.imageUpload.value = "";
  updateNodeCard(node);
  fillInspector(node);
  saveCampaignCanvasState();
});

el.deleteNodeButton.addEventListener("click", () => {
  if (!state.selectedPrimary) return;
  removeNode(state.selectedPrimary);
});
el.improveNodeButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  await runImproveNodeFlow(node);
});
el.regenerateNodeButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  await runInlineRefine(
    node,
    "Regenerate this node as a fresh alternative version while keeping it aligned with the campaign context and brand voice.",
    el.regenerateNodeButton
  );
});
el.generateImageButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Content") return;
  await generateImageForNode(node);
});
el.generatePostingVisualButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Social Media Posting") return;
  await generatePostingVisualForNode(node);
});
el.deleteSelectedButton.addEventListener("click", () => {
  if (!state.selectedIds.size) return;
  pushHistorySnapshot();
  [...state.selectedIds].forEach((id) => removeNode(id));
});
el.disconnectSelectedButton.addEventListener("click", () => {
  if (!state.selectedIds.size) return;
  pushHistorySnapshot();
  state.edges = state.edges.filter(([a, b]) => !state.selectedIds.has(a) && !state.selectedIds.has(b));
  state.nodes.forEach(updateNodeCard);
  drawLinks();
  saveCampaignCanvasState();
});
el.propagateDescendantsButton.addEventListener("click", () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  if (downstreamNodeIds(node.id).length === 0) return;
  pushHistorySnapshot();
  propagateNodeChangesDownward(node);
  fillInspector(node);
  saveCampaignCanvasState();
});
// Undo is handled via delegated click binding in bindGlobalResetDelegation().

el.canvas.addEventListener("dragover", (event) => event.preventDefault());
el.canvas.addEventListener("drop", (event) => {
  event.preventDefault();
  const files = [...event.dataTransfer.files].filter((f) => f.type.startsWith("image/"));
  if (files.length === 0) return;
  const point = boardPointFromClient(event.clientX, event.clientY);
  createNode({
    type: "Content",
    position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 },
    images: files.map((f) => ({ id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f) }))
  });
});

el.canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest(".node, .context-menu, button, input, textarea, select")) return;
  collapseExpandedNodes();

  const appendSelection = event.shiftKey;
  const startLeft = el.canvas.scrollLeft;
  const startTop = el.canvas.scrollTop;
  const panX = event.clientX;
  const panY = event.clientY;
  const downAt = Date.now();
  let panning = false;
  let selectionLocked = false;
  const forcePan = state.forcePanNextDrag;

  const rect = el.canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const box = document.createElement("div");
  box.className = "selection-box";
  el.canvas.appendChild(box);

  function move(ev) {
    const panDx = ev.clientX - panX;
    const panDy = ev.clientY - panY;
    const holdMs = Date.now() - downAt;
    const movedEnough = Math.abs(panDx) > 4 || Math.abs(panDy) > 4;
    if (appendSelection && !selectionLocked && movedEnough) {
      selectionLocked = true;
    }
    if (!appendSelection && !selectionLocked && (forcePan || holdMs > 450) && movedEnough) {
      panning = true;
      el.canvas.scrollLeft = startLeft - panDx;
      el.canvas.scrollTop = startTop - panDy;
      return;
    }
    const cx = ev.clientX - rect.left;
    const cy = ev.clientY - rect.top;
    const left = Math.min(sx, cx);
    const top = Math.min(sy, cy);
    const width = Math.abs(cx - sx);
    const height = Math.abs(cy - sy);
    box.style.left = `${left}px`;
    box.style.top = `${top}px`;
    box.style.width = `${width}px`;
    box.style.height = `${height}px`;

    if (!appendSelection) state.selectedIds.clear();
    state.nodes.forEach((node) => {
      const nx = node.position.x * state.zoom - el.canvas.scrollLeft;
      const ny = node.position.y * state.zoom - el.canvas.scrollTop;
      const nw = NODE_WIDTH * state.zoom;
      const nh = NODE_HEIGHT * state.zoom;
      const hit = nx < left + width && nx + nw > left && ny < top + height && ny + nh > top;
      if (hit) state.selectedIds.add(node.id);
    });
    state.selectedPrimary = [...state.selectedIds][0] || null;
    updateSelectionClasses();
  }

  function up() {
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    box.remove();
    if (!panning) {
      fillInspector(state.selectedPrimary ? getNode(state.selectedPrimary) : null);
      state.forcePanNextDrag = true;
    } else {
      state.forcePanNextDrag = false;
    }
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

function centerBoardStartPosition() {
  el.canvas.scrollLeft = 0;
  el.canvas.scrollTop = 0;
}

el.picker.addEventListener("click", (event) => {
  if (event.target === el.picker) el.picker.classList.add("hidden");
});
el.postingDoneButton.addEventListener("click", () => {
  const node = getNode(state.postingPlannerNodeId);
  if (!node) return closePostingPlanner();
  if (!el.postingDateInput.value || !el.postingTimeInput.value) return;
  node.social.scheduledAt = `${el.postingDateInput.value}T${el.postingTimeInput.value}:00`;
  updateNodeCard(node);
  fillInspector(node);
  renderCalendarView();
  closePostingPlanner();
});
el.postingCancelButton.addEventListener("click", closePostingPlanner);
setSidebarCollapsed(true);

el.brandCoreButton.addEventListener("click", () => {
  setAppMode("brand");
});
el.campaignCanvasNavButton.addEventListener("click", () => {
  setAppMode("canvas");
  setActiveView("board");
  renderCampaignCanvasFromStateIfNeeded();
});
el.boardsNavButton?.addEventListener("click", () => {
  setAppMode("canvas");
  setActiveView("boards_library");
  loadBoardsLibrary();
});
el.brandCoreCanvas.addEventListener("click", (event) => {
  const n = event.target.closest(".bc-node[data-bc-key]");
  if (!n) return;
  el.brandCoreCanvas.querySelectorAll(".bc-node.selected").forEach((x) => x.classList.remove("selected"));
  n.classList.add("selected");
  state.brandCoreSelectedKey = n.dataset.bcKey;
  renderBrandCoreEditor();
});
// Removed: brandEditorInput does not exist. Brand Brain inputs are bound dynamically in renderBrandCoreEditor().
window.addEventListener("resize", drawLinks);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.connectorCreateMode) {
    state.connectorCreateMode = null;
    state.connectorGhostEl?.remove();
    state.connectorGhostEl = null;
    drawLinks();
    return;
  }
  if (event.key === "Escape" && state.activeConnection) stopExistingNodeConnection();
});

window.debugNodes = () => {
  console.log("STATE NODES", state.nodes);
  console.log("DOM NODES", [...document.querySelectorAll(".node")].map((n) => n.getBoundingClientRect()));
};

function createDebugPanel() {}

function bindGlobalResetDelegation() {
  document.addEventListener("click", async (event) => {
    if (event.target.closest("#reset-board-btn")) {
      console.log("RESET BOARD CLICK DELEGATED");
      event.preventDefault();
      const shouldReset = await showResetBoardConfirmModal();
      if (shouldReset) window.resetCampaignCanvasState();
    }
    if (event.target.closest("#reset-brand-core-btn")) {
      console.log("RESET BRAND CLICK DELEGATED");
      event.preventDefault();
      window.resetBrandBrainState();
    }
    const openBtn = event.target.closest("[data-open-board]");
    if (openBtn) {
      const id = openBtn.getAttribute("data-open-board");
      if (id) window.location.href = `/boards/${id}`;
    }
    const renameBtn = event.target.closest('[data-rename-board]');
    if (renameBtn) {
      const id = renameBtn.getAttribute('data-rename-board');
      document.querySelector(`[data-rename-wrap="${id}"]`)?.classList.remove('hidden');
    }
    const renameCancelBtn = event.target.closest('[data-rename-cancel]');
    if (renameCancelBtn) {
      const id = renameCancelBtn.getAttribute('data-rename-cancel');
      document.querySelector(`[data-rename-wrap="${id}"]`)?.classList.add('hidden');
    }
    const renameSaveBtn = event.target.closest('[data-rename-save]');
    if (renameSaveBtn) {
      const id = renameSaveBtn.getAttribute('data-rename-save');
      const input = document.querySelector(`[data-rename-input="${id}"]`);
      renameBoard(id, input?.value || 'Campaign Canvas Board');
    }
    const delBtn = event.target.closest('[data-delete-board]');
    if (delBtn) deleteBoard(delBtn.getAttribute('data-delete-board'));
    const upBtn = event.target.closest('[data-up-board]');
    if (upBtn) moveBoard(upBtn.getAttribute('data-up-board'), 'up', Number(upBtn.getAttribute('data-index')));
    const downBtn = event.target.closest('[data-down-board]');
    if (downBtn) moveBoard(downBtn.getAttribute('data-down-board'), 'down', Number(downBtn.getAttribute('data-index')));

    const copyBtn = event.target.closest("[data-copy-board]");
    if (copyBtn) {
      const id = copyBtn.getAttribute("data-copy-board");
      if (id) {
        const full = `${window.location.origin}/boards/${id}`;
        navigator.clipboard.writeText(full).then(() => {
          copyBtn.textContent = 'Copied';
          setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1200);
        }).catch(() => {
          copyBtn.textContent = 'Copy failed';
          setTimeout(() => { copyBtn.textContent = 'Copy Link'; }, 1200);
        });
      }
    }
    if (event.target.closest("#undo-btn")) {
      console.log("UNDO CLICK DELEGATED");
      event.preventDefault();
      restoreLastSnapshot();
    }
  });
}

el.saveBoardButton?.addEventListener("click", () => saveBoardToServer("manual"));
el.newBoardButton?.addEventListener("click", createNewBoardFlow);
el.boardsCreateButton?.addEventListener("click", createNewBoardFlow);
el.copyBoardLinkButton?.addEventListener("click", copyCurrentBoardLink);

window.saveCampaignCanvasState = saveCampaignCanvasState;
window.loadCampaignCanvasState = loadCampaignCanvasState;
window.resetCampaignCanvasState = resetCampaignCanvasState;
window.saveBrandBrainState = saveBrandBrainState;
window.loadBrandBrainState = loadBrandBrainState;
window.resetBrandBrainState = resetBrandBrainState;


function defaultBrandCoreState() {
  return { brandCore: "", toneOfVoice: [], messagingPillars: [], valueProposition: "", personas: [], contentGuidelines: [], dosAndDonts: { dos: [], donts: [] }, brandVoiceExamples: { good: "", avoid: "" }, keywords: [], brandAssets: { domain: "", logo: "", colors: [], typography: "", references: [] }, customTiles: [] };
}

function blankCanvasState() {
  return { nodes: [], edges: [], nodeCounter: 1, postitCounter: 1, zoom: 1 };
}

function showCreateBoardModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'brand-confirm-modal';
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>Create new board</h3><p>Give your new Campaign Canvas board a name.</p><input id="create-board-name" placeholder="Board name" /><div class="brand-confirm-actions"><button type="button" id="create-board-cancel">Cancel</button><button type="button" class="primary-add" id="create-board-confirm">Create</button></div></div>`;
    document.body.appendChild(overlay);
    const close = (v) => { overlay.remove(); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(null); });
    overlay.querySelector('#create-board-cancel').addEventListener('click', () => close(null));
    overlay.querySelector('#create-board-confirm').addEventListener('click', () => {
      const name = overlay.querySelector('#create-board-name')?.value?.trim();
      if (!name) return;
      close(name);
    });
  });
}

function showUnsavedLeaveModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'brand-confirm-modal';
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>You have unsaved changes</h3><p>Creating a new board will leave this board. Make sure your current changes are saved before continuing.</p><div class="brand-confirm-actions"><button type="button" id="leave-cancel">Cancel</button><button type="button" class="primary-add" id="leave-continue">Continue</button></div></div>`;
    document.body.appendChild(overlay);
    const close = (v) => { overlay.remove(); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('#leave-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#leave-continue').addEventListener('click', () => close(true));
  });
}

async function createNewBoardFlow() {
  if (state.isDirty) {
    const canLeave = await showUnsavedLeaveModal();
    if (!canLeave) return;
  }
  const name = (await showCreateBoardModal())?.trim();
  if (!name) return;
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, canvas_json: blankCanvasState(), brand_core_snapshot: defaultBrandCoreState() })
  });
  const data = await response.json();
  if (!response.ok || !data?.id) return;
  window.location.href = `/boards/${data.id}`;
}

async function loadBoardsLibrary() {
  try {
    const response = await fetch('/api/boards');
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load boards');
    state.boardsLibrary = Array.isArray(data?.boards) ? data.boards : [];
    renderBoardsLibrary();
  } catch (error) {
    if (el.boardsLibraryList) el.boardsLibraryList.textContent = 'Could not load boards.';
  }
}

function renderBoardsLibrary() {
  if (!el.boardsLibraryList) return;
  el.boardsLibraryList.innerHTML = '';
  state.boardsLibrary.forEach((board, index) => {
    const row = document.createElement('div');
    row.className = 'board-row';
    const savedAt = board.updated_at ? new Date(board.updated_at).toLocaleString('de-DE') : '—';
    const preview = `${board.id?.slice(0, 8)}...`;
    row.innerHTML = `<div><strong>${board.name || 'Campaign Canvas Board'}</strong><div class="board-row-meta">Last saved: ${savedAt} · ${preview}</div><div class="board-rename hidden" data-rename-wrap="${board.id}"><input data-rename-input="${board.id}" value="${board.name || ''}" /><button data-rename-save="${board.id}" type="button">Save</button><button data-rename-cancel="${board.id}" type="button">Cancel</button></div></div><div class="board-row-actions"><button class="icon-btn" data-open-board="${board.id}" title="Open" aria-label="Open board">↗</button><button class="icon-btn" data-copy-board="${board.id}" title="Copy link" aria-label="Copy link">⧉</button><button class="icon-btn" data-rename-board="${board.id}" title="Rename" aria-label="Rename board">✎</button><button class="icon-btn danger" data-delete-board="${board.id}" title="Delete" aria-label="Delete board">🗑</button><button class="icon-btn" data-up-board="${board.id}" data-index="${index}" title="Move up">↑</button><button class="icon-btn" data-down-board="${board.id}" data-index="${index}" title="Move down">↓</button></div>`;
    el.boardsLibraryList.appendChild(row);
  });
}

async function renameBoard(boardId, name) {
  const response = await fetch(`/api/boards/${boardId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
  if (response.ok) loadBoardsLibrary();
}

async function deleteBoard(boardId) {
  const confirmed = await showDeleteBoardConfirmModal();
  if (!confirmed) return;
  const response = await fetch(`/api/boards/${boardId}`, { method: 'DELETE' });
  if (response.ok) loadBoardsLibrary();
}

async function moveBoard(boardId, direction, index) {
  const boards = [...state.boardsLibrary];
  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= boards.length) return;
  const a = boards[index];
  const b = boards[swapIndex];
  await fetch(`/api/boards/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_index: swapIndex }) });
  await fetch(`/api/boards/${b.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_index: index }) });
  loadBoardsLibrary();
}

function showDeleteBoardConfirmModal() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'brand-confirm-modal';
    overlay.innerHTML = `<div class="brand-confirm-card"><h3>Delete this board?</h3><p>This will permanently delete the board. This action cannot be undone.</p><div class="brand-confirm-actions"><button type="button" id="delete-board-cancel">Cancel</button><button type="button" class="danger" id="delete-board-confirm">Delete</button></div></div>`;
    document.body.appendChild(overlay);
    const close = (v) => { overlay.remove(); resolve(v); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(false); });
    overlay.querySelector('#delete-board-cancel').addEventListener('click', () => close(false));
    overlay.querySelector('#delete-board-confirm').addEventListener('click', () => close(true));
  });
}

function bootApp() {
  state.isBoardLoading = true;
  createDebugPanel();
  bindGlobalResetDelegation();
  loadBrandBrainState();
  const boardIdFromPath = getBoardIdFromPath();
  state.currentBoardId = boardIdFromPath;
  setSharePanelState(state.currentBoardId);
  if (boardIdFromPath) {
    loadBoardFromUrlIfPresent();
  } else {
    loadCampaignCanvasState();
  }
  centerBoardStartPosition();
  el.zoomLayer.style.transform = `scale(${state.zoom})`;
  el.zoomLayer.style.transformOrigin = "0 0";
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  renderCampaignCanvasFromStateIfNeeded();
  renderBrandCoreTiles();
  renderBrandCoreEditor();
  updateEmptyState();
  updateListView();
  fillInspector(null);
  setAppMode("canvas");
  setActiveView("board");
  drawLinks();
  refreshLastSavedSnapshot();
  state.isBoardLoading = false;
  startAutosaveWatcher();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootApp);
else bootApp();
