console.info("Campaign Canvas build: 2026-04-27-fix");
const NODE_TYPES = {
  Idea: { color: "#6b4eff" },
  "Campaign Variation": { color: "#2f7ef7" },
  Content: { color: "#16a47b" },
  "Social Media Posting": { color: "#f56f46" },
  "Landing Page": { color: "#a04ad8" },
  "Email Campaign": { color: "#d8961a" },
  "Visual Concept": { color: "#0f9bb5" },
  "Image Brief": { color: "#7c6bd8" }
};
const NEXT_STEP_NODE_TYPE = {
  Idea: "Campaign Variation",
  "Campaign Variation": "Content",
  Content: "Social Media Posting",
  "Social Media Posting": "Landing Page",
  "Social Media Post": "Landing Page",
  "Landing Page": "Email Campaign"
};

const NODE_WIDTH = 285;
const NODE_HEIGHT = 200;
const NODE_OVERLAP_MARGIN = 32;
const NODE_OVERLAP_MAX_PASSES = 4;
const BOARD_WIDTH = 20000;
const BOARD_HEIGHT = 30000;
const STORAGE_KEY = "campaignCanvasState";
const BRAND_CORE_STORAGE_KEY = "brandBrainState";
const ACTIVITY_FEED_MAX_ENTRIES = 50;
const ACTIVITY_FEED_VISIBLE_ENTRIES = 15;
const ACTIVITY_DEBOUNCE_MS = 12 * 1000;
const ACTIVITY_SEEN_STORAGE_PREFIX = "funklix.activitySeen.";
const COMMENT_SEEN_STORAGE_PREFIX = "funklix.commentSeen.";
const NODE_STATUSES = [
  { value: "Draft", label: "Draft", tone: "draft" },
  { value: "In Review", label: "In Review", tone: "review" },
  { value: "Needs Changes", label: "Needs Changes", tone: "changes" },
  { value: "Approved", label: "Approved", tone: "approved" },
  { value: "Published", label: "Published", tone: "published" }
];
const NODE_STATUS_BY_VALUE = new Map(NODE_STATUSES.map((status) => [status.value, status]));

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
  pendingScheduleNodeId: null
  ,scheduleDate: ""
  ,scheduleTime: "09:00"
  ,currentBoardId: null
  ,currentBoardName: ""
  ,lastKnownUpdatedAt: null
  ,autosaveTimer: null
  ,isDirty: false
  ,isSaving: false
  ,latestSaveRequestId: 0
  ,initialServerLoadInFlight: false
  ,conflictModalOpen: false
  ,autosavePausedUntilChange: false
  ,isBoardLoading: true
  ,lastSavedSnapshot: ""
  ,canvasMetadata: { createdAt: null, updatedAt: null }
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
  ,contentPackLoadingById: {}
  ,contentPackErrorById: {}
  ,hashtagDraftByNode: {}
  ,analysisRefreshing: false
  ,analysisLastUpdatedAt: null
  ,analysisError: ""
  ,nodeSearchQuery: ""
  ,nodeFilters: { type: new Set(), platform: new Set(), state: new Set(), status: new Set(), owner: new Set() }
  ,user: null
  ,authConfigured: true
  ,currentBoardOwnerEmail: null
  ,currentBoardOwnerName: null
  ,currentBoardOwnerAvatar: null
  ,boardAccess: { canView: true, canEdit: true, canManagePermissions: false, canRename: false, canDelete: false, reason: "unknown" }
  ,boardEditors: []
  ,boardEditorsLoading: false
  ,boardEditorsStatus: { message: "", isError: false }
  ,lastEditorIdentityRefreshAt: 0
  ,shareToastTimer: null
  ,presencePollTimer: null
  ,boardRefreshPollTimer: null
  ,boardRefreshInFlight: false
  ,lastLocalSaveAt: null
  ,remoteMergeSkippedNodeIds: new Set()
  ,presenceSelectionPingTimer: null
  ,presencePingInFlight: false
  ,presencePendingPingAfterInFlight: false
  ,presenceSelectedNodeIdLastQueued: undefined
  ,presenceSelectedNodeIdLastSent: undefined
  ,presencePayloadSignatureLastQueued: undefined
  ,presencePayloadSignatureLastSent: undefined
  ,presenceEditingNodeId: null
  ,presenceEditingField: null
  ,presenceEditingClearTimer: null
  ,presenceViewers: []
  ,presenceNodeSignature: ""
  ,presenceCursorX: null
  ,presenceCursorY: null
  ,presenceCursorHoveredNodeId: null
  ,presenceCursorLastMovedAt: null
  ,presenceCursorPublishTimer: null
  ,presenceCursorClearTimer: null
  ,presenceCursorRenderFrame: null
  ,followingCollaboratorEmail: null
  ,followingCollaboratorName: ""
  ,activityFeed: []
  ,activityCollapsed: false
  ,lastSeenActivityAt: 0
  ,commentThreadsOpenedByNode: new Set()
};

const el = {
  appShell: document.querySelector(".app-shell"),
  leftSidebar: document.getElementById("left-sidebar"),
  workspaceWrap: document.querySelector(".workspace-wrap"),
  canvas: document.getElementById("canvas"),
  canvasTopbar: document.getElementById("canvas-topbar"),
  inspectorPanel: document.getElementById("inspector-panel"),
  canvasScrollSurface: document.getElementById("canvas-scroll-surface"),
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
  compactAllButton: document.getElementById("compact-all-btn"),
  expandAllButton: document.getElementById("expand-all-btn"),
  nodeSearchInput: document.getElementById("node-search-input"),
  nodeSearchCount: document.getElementById("node-search-count"),
  filtersToggleButton: document.getElementById("filters-toggle-btn"),
  utilitiesToggleButton: document.getElementById("utilities-toggle-btn"),
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
  landingPageFields: document.getElementById("landing-page-fields"),
  generateHeaderVisualButton: document.getElementById("generate-header-visual-btn"),
  imageUpload: document.getElementById("node-image-upload"),
  inspectorImageList: document.getElementById("inspector-image-list"),
  deleteNodeButton: document.getElementById("delete-node-btn"),
  improveNodeButton: document.getElementById("improve-node-btn"),
  generateNextStepInspectorButton: document.getElementById("generate-next-step-inspector-btn"),
  regenerateNodeButton: document.getElementById("regenerate-node-btn"),
  regeneratePlatformButton: document.getElementById("regenerate-platform-btn"),
  addToPostingCalendarButton: document.getElementById("add-to-posting-calendar-btn"),
  postingScheduleMeta: document.getElementById("posting-schedule-meta"),
  generateImageButton: document.getElementById("generate-image-btn"),
  generatePostingVisualButton: document.getElementById("generate-posting-visual-btn"),
  generateFullPackButton: document.getElementById("generate-full-pack-btn"),
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
  claimBoardButton: document.getElementById("claim-board-btn"),
  boardOwnedPill: document.getElementById("board-owned-pill"),
  boardCopyFeedback: document.getElementById("board-copy-feedback"),
  googleSigninButton: document.getElementById("google-signin-btn"),
  authUserWrap: document.getElementById("auth-user"),
  authName: document.getElementById("auth-name"),
  authEmail: document.getElementById("auth-email"),
  authAvatar: document.getElementById("auth-avatar"),
  authAvatarFallback: document.getElementById("auth-avatar-fallback"),
  authMessage: document.getElementById("auth-message"),
  readonlyBoardNotice: document.getElementById("readonly-board-notice"),
  duplicateBoardCtaButton: document.getElementById("duplicate-board-cta-btn"),
  boardAccessCluster: document.getElementById("board-access-cluster"),
  boardAccessChipKind: document.getElementById("board-access-chip-kind"),
  boardAccessChipMode: document.getElementById("board-access-chip-mode"),
  boardAccessChipOwner: document.getElementById("board-access-chip-owner"),
  presenceLite: document.getElementById("presence-lite"),
  presenceAvatars: document.getElementById("presence-avatars"),
  presenceCount: document.getElementById("presence-count"),
  activityPanel: document.getElementById("activity-panel"),
  activityToggleButton: document.getElementById("activity-toggle-btn"),
  activityFeed: document.getElementById("activity-feed"),
  activityCount: document.getElementById("activity-count"),
  authSignoutButton: document.getElementById("auth-signout-btn"),
  brandCoreButton: document.getElementById("brand-core-nav-btn"),
  campaignCanvasNavButton: document.getElementById("campaign-canvas-nav-btn"),
  boardsNavButton: document.getElementById("boards-nav-btn"),
  insightsNavButton: document.getElementById("insights-nav-btn"),
  aiBrainNavButton: document.getElementById("ai-brain-nav-btn"),
  boardsLibraryView: document.getElementById("boards-library-view"),
  insightsView: document.getElementById("insights-view"),
  aiBrainView: document.getElementById("ai-brain-view"),
  insightsCards: document.getElementById("insights-cards"),
  aiBrainSummary: document.getElementById("ai-brain-summary"),
  boardsLibraryList: document.getElementById("boards-library-list"),
  boardsLibraryTitle: document.getElementById("boards-library-title"),
  boardsLibrarySubtitle: document.getElementById("boards-library-subtitle"),
  sidebarToggleButton: document.getElementById("sidebar-toggle-btn"),
  brandEditorTitle: document.getElementById("bc-editor-title"),
  brandCoreCanvas: document.getElementById("brand-core-canvas"),
  brandEditorPanel: document.getElementById("bc-editor-panel"),
  resetBrandCoreButton: document.getElementById("reset-brand-core-btn"),
  connectedContextSummary: document.getElementById("connected-context-summary"),
  connectedContextBody: document.getElementById("connected-context-body"),
  inputs: {
    type: document.getElementById("node-type"),
    status: document.getElementById("node-status"),
    title: document.getElementById("node-title"),
    content: document.getElementById("node-content"),
    imagePrompt: document.getElementById("node-image-prompt"),
    variants: document.getElementById("node-variants"),
    platform: document.getElementById("node-platform"),
    caption: document.getElementById("node-caption"),
    hashtags: document.getElementById("node-hashtags"),
    preview: document.getElementById("node-preview"),
    audience: document.getElementById("node-audience"),
    goal: document.getElementById("node-goal"),
    channel: document.getElementById("node-channel"),
    funnelStage: document.getElementById("node-funnel-stage"),
    tone: document.getElementById("node-tone"),
    contentFormat: document.getElementById("node-content-format")
    ,owner: document.getElementById("node-owner")
    ,lpHeaderVisualPrompt: document.getElementById("lp-header-visual-prompt")
    ,lpHeaderClaim: document.getElementById("lp-header-claim")
    ,lpProblem: document.getElementById("lp-problem")
    ,lpSolution: document.getElementById("lp-solution")
    ,lpTrust: document.getElementById("lp-trust")
    ,lpCta: document.getElementById("lp-cta")
  }
};

const domRegistryMeta = {
  "canvas": { category: "canvas", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "zoom-layer": { category: "canvas", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "links": { category: "canvas", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "add-node-btn": { category: "toolbar", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "create-campaign-btn": { category: "toolbar", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "undo-btn": { category: "toolbar", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "node-search-input": { category: "toolbar", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "zoom-in-btn": { category: "zoom", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "zoom-out-btn": { category: "zoom", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "zoom-label": { category: "zoom", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "inspector-panel": { category: "inspector", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "node-form": { category: "inspector", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "google-signin-btn": { category: "auth", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "auth-user": { category: "auth", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "auth-message": { category: "auth", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "save-status": { category: "saveShare", critical: true, requiredForBoot: true, optional: false, legacy: true, hiddenCompatibilityHook: true, viewSpecific: false },
  "board-share-panel": { category: "saveShare", critical: true, requiredForBoot: true, optional: false, legacy: true, hiddenCompatibilityHook: true, viewSpecific: false },
  "copy-board-link-btn": { category: "saveShare", critical: true, requiredForBoot: true, optional: false, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "filters-toggle-btn": { category: "filtersUtilities", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "utilities-toggle-btn": { category: "filtersUtilities", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: false },
  "boards-library-view": { category: "boards", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: true },
  "boards-library-list": { category: "boards", critical: false, requiredForBoot: false, optional: true, legacy: false, hiddenCompatibilityHook: false, viewSpecific: true },
  "cycle-view-btn": { category: "legacyHooks", critical: true, requiredForBoot: true, optional: false, legacy: true, hiddenCompatibilityHook: true, viewSpecific: false },
  "view-menu-btn": { category: "legacyHooks", critical: true, requiredForBoot: true, optional: false, legacy: true, hiddenCompatibilityHook: true, viewSpecific: false },
  "view-board-btn": { category: "legacyHooks", critical: true, requiredForBoot: true, optional: false, legacy: true, hiddenCompatibilityHook: true, viewSpecific: false }
};

function diagnoseDomDependencies() {
  try {
    const categories = {
      bootCritical: [
        "canvas", "zoom-layer", "zoom-label", "inspector-panel", "node-form",
        "add-node-btn", "create-campaign-btn", "undo-btn", "node-search-input"
      ],
      canvas: ["canvas", "canvas-scroll-surface", "zoom-layer", "links", "context-menu", "empty-state"],
      toolbar: [
        "add-node-btn", "create-campaign-btn", "undo-btn", "node-search-input",
        "copy-board-link-btn", "save-board-btn", "new-board-btn", "reset-board-btn",
        "compact-all-btn", "expand-all-btn"
      ],
      hiddenLegacyHooks: [
        "save-status", "view-menu-btn", "view-menu", "view-board-btn", "view-list-btn", "view-calendar-btn"
      ],
      inspector: [
        "inspector-panel", "inspector-meta", "node-form", "node-type", "node-title", "node-content"
      ],
      auth: [
        "google-signin-btn", "auth-user", "auth-name", "auth-email",
        "auth-avatar", "auth-avatar-fallback", "auth-message", "auth-signout-btn"
      ],
      boards: ["boards-library-view", "boards-library-list", "boards-create-btn", "claim-board-btn"],
      saveShare: [
        "save-status", "board-share-panel", "board-share-empty", "board-share-ready",
        "board-share-link-text", "board-last-saved", "board-copy-feedback", "copy-board-link-btn"
      ],
      filtersUtilities: ["filters-toggle-btn", "utilities-toggle-btn"],
      zoom: ["zoom-in-btn", "zoom-out-btn", "zoom-label"],
      modals: ["posting-plan-overlay", "image-lightbox"]
    };

    const idsToCheck = new Set();
    Object.values(categories).forEach((ids) => ids.forEach((id) => idsToCheck.add(id)));
    ["save-board-btn", "new-board-btn", "reset-board-btn", "compact-all-btn", "expand-all-btn"].forEach((id) => idsToCheck.add(id));

    const missingByCategory = {};
    Object.entries(categories).forEach(([category, ids]) => {
      const missing = ids.filter((id) => !document.getElementById(id));
      if (missing.length) missingByCategory[category] = missing;
    });

    const duplicateCounts = {};
    document.querySelectorAll("[id]").forEach((node) => {
      const id = node.id;
      duplicateCounts[id] = (duplicateCounts[id] || 0) + 1;
    });
    const duplicateEntries = Object.entries(duplicateCounts).filter(([, count]) => count > 1);

    const criticalSet = new Set(categories.bootCritical);
    idsToCheck.forEach((id) => {
      if (!document.getElementById(id) && criticalSet.has(id)) {
        const category = domRegistryMeta[id]?.category || "unknown";
        console.warn(`[Funklix DOM Diagnostics][${category}] Missing critical element: #${id}`);
      }
    });

    Object.entries(missingByCategory).forEach(([category, ids]) => {
      ids.forEach((id) => {
        if (category !== "bootCritical") {
          const metaCategory = domRegistryMeta[id]?.category || category || "unknown";
          console.warn(`[Funklix DOM Diagnostics][${metaCategory}] Missing element: #${id}`);
        }
      });
    });

    duplicateEntries.forEach(([id, count]) => {
      console.warn(`[Funklix DOM Diagnostics] Duplicate id detected: #${id} appears ${count} times`);
    });
    const authMessageDuplicate = duplicateEntries.find(([id]) => id === "auth-message");
    if (authMessageDuplicate) {
      console.warn(`[Funklix DOM Diagnostics] Duplicate auth id warning: #auth-message appears ${authMessageDuplicate[1]} times`);
    }
  } catch (err) {
    console.warn("[Funklix DOM Diagnostics] Diagnostics failed safely.", err);
  }
}

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

function updateBoardAccessState() {
  const ownerEmail = state.currentBoardOwnerEmail || null;
  const userEmail = state.user?.email || null;
  const normalizedOwnerEmail = typeof ownerEmail === "string" ? ownerEmail.trim().toLowerCase() : "";
  const normalizedUserEmail = typeof userEmail === "string" ? userEmail.trim().toLowerCase() : "";
  const hasOwner = !!normalizedOwnerEmail;
  const isOwner = !!normalizedUserEmail && hasOwner && normalizedUserEmail === normalizedOwnerEmail;
  const reason = isOwner ? "owner" : (!hasOwner ? (normalizedUserEmail ? "unowned" : "anonymous_shared") : (!normalizedUserEmail ? "anonymous_shared" : "non_owner"));
  const canEdit = reason === "owner" || reason === "editor" || reason === "unowned";
  const isOwnerRole = reason === "owner";
  const nextAccess = { canView: true, canEdit, canManagePermissions: isOwnerRole, canRename: isOwnerRole, canDelete: isOwnerRole, reason };
  if (state.boardAccess?.reason === "editor" && nextAccess.reason === "non_owner") {
    updateReadOnlyNoticeVisibility();
    return;
  }
  if (state.boardAccess?.reason !== nextAccess.reason || state.boardAccess?.canView !== nextAccess.canView || state.boardAccess?.canEdit !== nextAccess.canEdit || state.boardAccess?.canManagePermissions !== nextAccess.canManagePermissions) {
    state.boardAccess = nextAccess;
    console.debug("[Funklix Access] boardAccess", state.boardAccess);
  }
  if (!nextAccess.canManagePermissions) {
    state.boardEditors = [];
    state.boardEditorsStatus = { message: "", isError: false };
  }
  updateReadOnlyNoticeVisibility();
  if (nextAccess.canManagePermissions) loadBoardEditors({ silent: true });
  else state.boardEditors = [];
  return true;
}

function boardAccessFromServer(access, fallback = state.boardAccess) {
  const role = typeof access?.role === "string" && access.role ? access.role : (fallback?.reason || "unknown");
  return {
    canView: access?.canView !== false,
    canEdit: access?.canEdit !== false,
    canManagePermissions: access?.canManagePermissions === true,
    canRename: access?.canRename === true,
    canDelete: access?.canDelete === true,
    reason: role
  };
}

function applyBoardAccessFromServer(access, source = "server") {
  if (!access || typeof access !== "object" || typeof access.role !== "string") return false;
  const nextAccess = boardAccessFromServer(access);
  const changed = state.boardAccess?.reason !== nextAccess.reason
    || state.boardAccess?.canView !== nextAccess.canView
    || state.boardAccess?.canEdit !== nextAccess.canEdit
    || state.boardAccess?.canManagePermissions !== nextAccess.canManagePermissions
    || state.boardAccess?.canRename !== nextAccess.canRename
    || state.boardAccess?.canDelete !== nextAccess.canDelete;
  state.boardAccess = nextAccess;
  if (changed) console.debug("[Funklix Access] boardAccess", { source, access: state.boardAccess });
  updateReadOnlyNoticeVisibility();
  if (nextAccess.canManagePermissions) loadBoardEditors({ silent: true });
  else state.boardEditors = [];
  return true;
}

function boardAccessFromServer(access, fallback = state.boardAccess) {
  const role = typeof access?.role === "string" && access.role ? access.role : (fallback?.reason || "unknown");
  return {
    canView: access?.canView !== false,
    canEdit: access?.canEdit !== false,
    canManagePermissions: access?.canManagePermissions === true,
    canRename: access?.canRename === true,
    canDelete: access?.canDelete === true,
    reason: role
  };
}

function applyBoardAccessFromServer(access, source = "server") {
  if (!access || typeof access !== "object" || typeof access.role !== "string") return false;
  const nextAccess = boardAccessFromServer(access);
  const changed = state.boardAccess?.reason !== nextAccess.reason
    || state.boardAccess?.canView !== nextAccess.canView
    || state.boardAccess?.canEdit !== nextAccess.canEdit
    || state.boardAccess?.canManagePermissions !== nextAccess.canManagePermissions
    || state.boardAccess?.canRename !== nextAccess.canRename
    || state.boardAccess?.canDelete !== nextAccess.canDelete;
  state.boardAccess = nextAccess;
  if (changed) console.debug("[Funklix Access] boardAccess", { source, access: state.boardAccess });
  updateReadOnlyNoticeVisibility();
  if (nextAccess.canManagePermissions) loadBoardEditors({ silent: true });
  else state.boardEditors = [];
  return true;
}

function updateReadOnlyNoticeVisibility() {
  const isReadOnly = state.boardAccess?.canEdit === false;
  const readOnlyActionTitle = "View-only board. This action is disabled.";
  if (el.readonlyBoardNotice) el.readonlyBoardNotice.hidden = !isReadOnly;
  if (el.saveBoardButton) {
    el.saveBoardButton.disabled = isReadOnly;
    if (isReadOnly) el.saveBoardButton.title = "View-only board. Changes cannot be saved.";
    else el.saveBoardButton.removeAttribute("title");
  }
  [
    el.deleteNodeButton,
    el.deleteSelectedButton,
    el.disconnectSelectedButton,
    el.propagateDescendantsButton
  ].forEach((button) => {
    if (!button) return;
    button.disabled = isReadOnly;
    if (isReadOnly) button.title = readOnlyActionTitle;
    else button.removeAttribute("title");
  });
  if (el.duplicateBoardCtaButton) {
    const canDuplicate = !!(state.currentBoardId || getBoardIdFromPath());
    el.duplicateBoardCtaButton.classList.toggle("hidden", !(isReadOnly && canDuplicate));
    el.duplicateBoardCtaButton.disabled = state.isSaving || state.conflictModalOpen;
  }
  if (el.inputs?.status) el.inputs.status.disabled = isReadOnly || !state.selectedPrimary;
  if (el.inputs?.owner) el.inputs.owner.disabled = isReadOnly || !state.selectedPrimary;
  renderBoardAccessCluster();
}

function deriveOwnerDisplayName(ownerName, ownerEmail) {
  const byName = typeof ownerName === "string" ? ownerName.trim() : "";
  if (byName) return byName;
  const email = typeof ownerEmail === "string" ? ownerEmail.trim() : "";
  if (!email || !email.includes("@")) return "";
  const local = email.split("@")[0] || "";
  const cleaned = local.replace(/[._-]+/g, " ").replace(/\d+/g, " ").trim();
  const token = (cleaned.split(/\s+/)[0] || local || "").trim();
  if (!token) return "";
  return token.charAt(0).toUpperCase() + token.slice(1);
}


function normalizeOwnerEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function normalizeOwnerName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function normalizeOwnerAvatar(avatar) {
  return typeof avatar === "string" ? avatar.trim() : "";
}

function ownerFallbackLabel(email) {
  return normalizeOwnerEmail(email) || "";
}

function isEmailLikeOwnerValue(value = "") {
  const text = normalizeOwnerName(value).toLowerCase();
  return !!text && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isFallbackOwnerName(name = "", email = "") {
  const safeName = normalizeOwnerName(name);
  if (!safeName) return false;
  const normalizedName = safeName.toLowerCase();
  const normalizedEmail = normalizeOwnerEmail(email);
  if (normalizedEmail && normalizedName === normalizedEmail) return true;
  if (isEmailLikeOwnerValue(safeName)) return true;
  return ["unassigned", "unknown", "someone", "viewer", "collaborator", "editor"].includes(normalizedName);
}

function ownerDisplayLabel(identity = {}) {
  return normalizeOwnerName(identity.name || identity.ownerName) || ownerFallbackLabel(identity.email || identity.ownerEmail) || "Unassigned";
}

function nodeOwnerDisplayName(node = {}) {
  return ownerDisplayLabel(resolveOwnerIdentity(node));
}

function getOwnerInitials(name = "") {
  const source = String(name || "Unassigned").trim();
  return source.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
}

function mergeOwnershipOption(options, option) {
  const email = normalizeOwnerEmail(option?.email);
  if (!email) return;
  const name = normalizeOwnerName(option?.name);
  const avatar = normalizeOwnerAvatar(option?.avatar);
  const existing = options.find((candidate) => candidate.email === email);
  if (!existing) {
    options.push({
      email,
      name,
      avatar,
      role: option?.role || "Collaborator",
      source: option?.source || "collaborator"
    });
    return;
  }
  if (!existing.name && name) existing.name = name;
  if (!existing.avatar && avatar) existing.avatar = avatar;
  if ((!existing.role || existing.role === "Collaborator") && option?.role) existing.role = option.role;
  if (!existing.source && option?.source) existing.source = option.source;
}

function findEditorOwnerIdentity(email) {
  const normalizedEmail = normalizeOwnerEmail(email);
  if (!normalizedEmail) return null;
  const editor = (Array.isArray(state.boardEditors) ? state.boardEditors : [])
    .find((candidate) => normalizeOwnerEmail(candidate?.email) === normalizedEmail);
  if (!editor) return null;
  return {
    email: normalizedEmail,
    name: normalizeOwnerName(editor.name),
    avatar: normalizeOwnerAvatar(editor.avatar),
    role: "Board editor",
    source: "editor"
  };
}

function findPresenceOwnerIdentity(email) {
  const normalizedEmail = normalizeOwnerEmail(email);
  if (!normalizedEmail) return null;
  const viewer = (Array.isArray(state.presenceViewers) ? state.presenceViewers : [])
    .find((candidate) => normalizeOwnerEmail(candidate?.email) === normalizedEmail);
  if (!viewer) return null;
  return {
    email: normalizedEmail,
    name: normalizeOwnerName(viewer.name),
    avatar: normalizeOwnerAvatar(viewer.avatar),
    role: "Collaborator",
    source: "presence"
  };
}

function findBoardOwnerIdentity(email) {
  const normalizedEmail = normalizeOwnerEmail(email);
  const boardOwnerEmail = normalizeOwnerEmail(state.currentBoardOwnerEmail);
  if (!normalizedEmail || normalizedEmail !== boardOwnerEmail) return null;
  const currentUserEmail = normalizeOwnerEmail(state.user?.email);
  return {
    email: normalizedEmail,
    name: normalizeOwnerName(state.currentBoardOwnerName || (boardOwnerEmail === currentUserEmail ? state.user?.name : "")),
    avatar: normalizeOwnerAvatar(state.currentBoardOwnerAvatar || (boardOwnerEmail === currentUserEmail ? state.user?.avatar : "")),
    role: "Board owner",
    source: "boardOwner"
  };
}

function findCurrentUserOwnerIdentity(email) {
  const normalizedEmail = normalizeOwnerEmail(email);
  const currentUserEmail = normalizeOwnerEmail(state.user?.email);
  if (!normalizedEmail || normalizedEmail !== currentUserEmail) return null;
  return {
    email: normalizedEmail,
    name: normalizeOwnerName(state.user?.name),
    avatar: normalizeOwnerAvatar(state.user?.avatar),
    role: state.boardAccess?.reason === "owner" ? "Board owner" : "Board editor",
    source: "currentUser"
  };
}

function mergeOwnerIdentityByPriority(email, identities = [], fallback = {}) {
  const normalizedEmail = normalizeOwnerEmail(email);
  const result = { email: normalizedEmail, name: "", avatar: "" };
  identities.filter(Boolean).forEach((identity) => {
    if (!result.name && normalizeOwnerName(identity.name)) result.name = normalizeOwnerName(identity.name);
    if (!result.avatar && normalizeOwnerAvatar(identity.avatar)) result.avatar = normalizeOwnerAvatar(identity.avatar);
  });
  if (!result.name && normalizeOwnerName(fallback.name) && !isFallbackOwnerName(fallback.name, normalizedEmail)) {
    result.name = normalizeOwnerName(fallback.name);
  }
  if (!result.avatar && normalizeOwnerAvatar(fallback.avatar)) result.avatar = normalizeOwnerAvatar(fallback.avatar);
  return result;
}

function getNodeOwnerOptions() {
  const options = [];
  (Array.isArray(state.boardEditors) ? state.boardEditors : []).forEach((editor) => {
    mergeOwnershipOption(options, {
      email: editor?.email,
      name: editor?.name || "",
      avatar: editor?.avatar || "",
      role: "Board editor",
      source: "editor"
    });
  });

  (Array.isArray(state.presenceViewers) ? state.presenceViewers : []).forEach((viewer) => {
    if (!viewer?.email) return;
    mergeOwnershipOption(options, {
      email: viewer.email,
      name: viewer.name,
      avatar: viewer.avatar,
      role: "Collaborator",
      source: "presence"
    });
  });

  const boardOwnerEmail = normalizeOwnerEmail(state.currentBoardOwnerEmail);
  const currentUserEmail = normalizeOwnerEmail(state.user?.email);
  mergeOwnershipOption(options, {
    email: state.currentBoardOwnerEmail,
    name: state.currentBoardOwnerName || (boardOwnerEmail && boardOwnerEmail === currentUserEmail ? state.user?.name : ""),
    avatar: state.currentBoardOwnerAvatar || (boardOwnerEmail && boardOwnerEmail === currentUserEmail ? state.user?.avatar : ""),
    role: "Board owner",
    source: "boardOwner"
  });

  if (state.user?.email) {
    mergeOwnershipOption(options, {
      email: state.user.email,
      name: state.user.name,
      avatar: state.user.avatar,
      role: state.boardAccess?.reason === "owner" ? "Board owner" : "Collaborator",
      source: "currentUser"
    });
  }

  return options;
}

function resolveOwnerIdentity(owner = {}) {
  const email = normalizeOwnerEmail(owner?.ownerEmail || owner?.email);
  if (!email) return { email: "", name: "", avatar: "" };
  return mergeOwnerIdentityByPriority(email, [
    findEditorOwnerIdentity(email),
    findPresenceOwnerIdentity(email),
    findBoardOwnerIdentity(email),
    findCurrentUserOwnerIdentity(email)
  ], {
    name: owner?.ownerName || owner?.name,
    avatar: owner?.ownerAvatar || owner?.avatar
  });
}

function setNodeOwner(node, owner) {
  const email = normalizeOwnerEmail(owner?.email);
  if (!email) {
    delete node.ownerEmail;
    delete node.ownerName;
    delete node.ownerAvatar;
    return;
  }
  const identity = resolveOwnerIdentity(owner);
  node.ownerEmail = email;
  const name = normalizeOwnerName(identity.name || owner?.name);
  const avatar = normalizeOwnerAvatar(identity.avatar || owner?.avatar);
  if (name) node.ownerName = name;
  else delete node.ownerName;
  if (avatar) node.ownerAvatar = avatar;
  else delete node.ownerAvatar;
}

function ownersAreEqual(a = {}, b = {}) {
  return normalizeOwnerEmail(a.ownerEmail) === normalizeOwnerEmail(b.ownerEmail)
    && normalizeOwnerName(a.ownerName) === normalizeOwnerName(b.ownerName)
    && normalizeOwnerAvatar(a.ownerAvatar) === normalizeOwnerAvatar(b.ownerAvatar);
}

function recordOwnerChangedActivity(node, owner = null) {
  if (!node || state.isBoardLoading) return;
  const identity = owner?.email ? resolveOwnerIdentity(owner) : null;
  if (identity?.email) appendActivity("owner_assigned", { node, ownerName: ownerDisplayLabel(identity), ownerEmail: identity.email, ownerAvatar: identity.avatar });
  else appendActivity("owner_unassigned", { node });
}

function refreshOwnershipDisplays() {
  state.nodes.forEach((node) => updateNodeCard(node));
  if (state.selectedPrimary) populateOwnerSelect(getNode(state.selectedPrimary));
  const filtersPopover = document.getElementById("floating-filters-popover");
  if (filtersPopover) {
    filtersPopover.innerHTML = buildFiltersPopoverHtml();
    syncPopoverActiveStates(filtersPopover);
  }
  if (state.activeView === "list" || (el.boardListView && !el.boardListView.classList.contains("hidden"))) updateListView();
}

function renderBoardAccessCluster() {
  if (!el.boardAccessCluster || !el.boardAccessChipKind || !el.boardAccessChipMode || !el.boardAccessChipOwner) return;
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId) {
    el.boardAccessCluster.classList.add("hidden");
    return;
  }
  const reason = state.boardAccess?.reason || "unknown";
  const isReadOnly = state.boardAccess?.canEdit === false;
  const ownerLabel = deriveOwnerDisplayName(state.currentBoardOwnerName, state.currentBoardOwnerEmail, state.currentBoardOwnerName, state.currentBoardOwnerAvatar);
  let kind = "";
  let mode = "";
  let owner = "";
  if (reason === "owner") {
    kind = "Your Board";
  } else if (reason === "editor") {
    kind = "Editor";
    if (ownerLabel) owner = `Owner: ${ownerLabel}`;
  } else if (reason === "unowned") {
    kind = "";
    mode = "Claim Available";
  } else if (reason === "anonymous_shared" || reason === "non_owner") {
    kind = "";
    if (isReadOnly) mode = "View Only";
    if (ownerLabel) owner = `Owner: ${ownerLabel}`;
  }
  if (isReadOnly && !mode) mode = "View Only";
  [el.boardAccessChipKind, el.boardAccessChipMode].forEach((chip) => {
    chip.classList.remove("owner", "editor", "viewer", "unowned");
    chip.classList.add(reason === "owner" ? "owner" : reason === "editor" ? "editor" : reason === "unowned" ? "unowned" : "viewer");
  });
  el.boardAccessChipKind.title = kind ? (reason === "owner" ? "You own this board" : reason === "editor" ? "You can edit this board" : kind) : "";
  el.boardAccessChipMode.title = mode ? (isReadOnly ? "View-only board. Duplicate to edit your own copy." : mode) : "";
  el.boardAccessChipOwner.title = owner || "";
  el.boardAccessChipKind.textContent = kind;
  el.boardAccessChipMode.textContent = mode;
  el.boardAccessChipOwner.textContent = owner;
  el.boardAccessChipKind.classList.toggle("hidden", !kind);
  el.boardAccessChipMode.classList.toggle("hidden", !mode);
  el.boardAccessChipOwner.classList.toggle("hidden", !owner);
  el.boardAccessCluster.classList.remove("hidden");
}

function setSharePanelState(boardId, lastSaved = null, ownerEmail = null, ownerName = null, ownerAvatar = null) {
  if (!boardId) {
    state.currentBoardOwnerEmail = null;
    state.currentBoardOwnerName = null;
    state.currentBoardOwnerAvatar = null;
    updateBoardAccessState();
    el.boardShareEmpty?.classList.remove("hidden");
    el.boardShareReady?.classList.add("hidden");
    el.claimBoardButton?.classList.add("hidden");
    el.boardOwnedPill?.classList.add("hidden");
    return;
  }

  const url = `${window.location.origin}/boards/${boardId}`;
  if (el.boardShareLinkText) el.boardShareLinkText.textContent = formatShareLinkText(url);
  if (el.boardLastSaved) {
    const label = lastSaved ? formatLastSavedLabel(lastSaved) : "—";
    el.boardLastSaved.textContent = `Last saved: ${label}`;
  }

  state.currentBoardOwnerEmail = ownerEmail || null;
  state.currentBoardOwnerName = ownerName || null;
  state.currentBoardOwnerAvatar = ownerAvatar || null;
  updateBoardAccessState();
  const normalizedCurrentOwnerEmail = typeof state.currentBoardOwnerEmail === "string" ? state.currentBoardOwnerEmail.trim().toLowerCase() : "";
  const normalizedCurrentUserEmail = typeof state.user?.email === "string" ? state.user.email.trim().toLowerCase() : "";
  const isOwnedByYou = !!normalizedCurrentUserEmail && !!normalizedCurrentOwnerEmail && normalizedCurrentOwnerEmail === normalizedCurrentUserEmail;
  const canClaim = !!normalizedCurrentUserEmail && !state.currentBoardOwnerEmail;
  el.claimBoardButton?.classList.toggle("hidden", !canClaim);
  el.boardOwnedPill?.classList.toggle("hidden", !isOwnedByYou);
  el.boardShareEmpty?.classList.add("hidden");
  el.boardShareReady?.classList.remove("hidden");
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function canManageBoardEditors() {
  return state.boardAccess?.canManagePermissions === true && !!(state.currentBoardId || getBoardIdFromPath());
}

function permissionShareLines() {
  const role = state.boardAccess?.reason || "unknown";
  if (role === "owner") return ["Anyone with the link can view", "Editors can make changes to this board"];
  if (role === "editor") return ["You can edit this board", "Only the owner can manage access"];
  if (role === "unowned") return ["Anyone with the link can view", "Sign in to claim this board"];
  return ["View-only board", "Duplicate to edit your own copy"];
}

function permissionErrorMessage(errorMessage = "") {
  const message = String(errorMessage || "").trim();
  const lower = message.toLowerCase();
  if (lower.includes("valid email")) return "Enter a valid email.";
  if (lower.includes("owner is already")) return "Owner already has access.";
  if (lower.includes("forbidden") || lower.includes("unauthorized")) return "Only the owner can manage access.";
  if (lower.includes("authentication")) return "Sign in to manage access.";
  return message || "Permission update failed.";
}

function setBoardEditorsStatus(message = "", isError = false) {
  state.boardEditorsStatus = { message, isError };
  renderOpenShareEditorPanel();
}

function renderOpenShareEditorPanel() {
  const panel = document.querySelector("[data-share-editor-panel]");
  if (!panel) return;
  panel.innerHTML = buildShareEditorPanelHtml();
  bindShareEditorPanel(panel);
}

function buildShareEditorPanelHtml() {
  const editors = Array.isArray(state.boardEditors) ? state.boardEditors : [];
  const status = state.boardEditorsStatus || { message: "", isError: false };
  const rows = state.boardEditorsLoading
    ? '<div class="share-editor-empty">Loading editors…</div>'
    : editors.length
      ? editors.map((editor) => {
        const normalizedEmail = typeof editor?.email === "string" ? editor.email.trim().toLowerCase() : "";
        const email = escapeHtml(normalizedEmail);
        return `<div class="share-editor-row"><div class="share-editor-meta"><strong title="${email}">${email}</strong><span class="share-editor-role">Editor</span></div><button type="button" class="share-editor-remove" data-remove-editor="${email}" aria-label="Remove ${email}">Remove</button></div>`;
      }).join("")
      : '<div class="share-editor-empty">No editors yet</div>';
  const statusHtml = status.message
    ? `<div class="share-editor-status ${status.isError ? 'error' : 'success'}">${escapeHtml(status.message)}</div>`
    : '';

  return `<div class="share-editor-heading"><strong>Invite editor by email</strong><span>Editors can make changes to this board.</span></div>
    <form class="share-editor-form" data-share-editor-form>
      <input type="email" data-share-editor-email placeholder="editor@example.com" autocomplete="email" aria-label="Editor email" />
      <button type="submit">Invite</button>
    </form>
    ${statusHtml}
    <div class="share-editor-list" data-share-editor-list>${rows}</div>`;
}

function bindShareEditorPanel(panel) {
  const form = panel.querySelector("[data-share-editor-form]");
  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = panel.querySelector("[data-share-editor-email]");
    const email = input?.value?.trim() || "";
    await addBoardEditor(email, input);
  });
  panel.querySelectorAll("[data-remove-editor]").forEach((button) => {
    button.addEventListener("click", async () => {
      const email = button.getAttribute("data-remove-editor") || "";
      await removeBoardEditor(email);
    });
  });
}

async function loadBoardEditors({ silent = false } = {}) {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || !state.boardAccess?.canManagePermissions) {
    state.boardEditors = [];
    state.boardEditorsLoading = false;
    return;
  }
  state.boardEditorsLoading = true;
  if (!silent) setBoardEditorsStatus("", false);
  renderOpenShareEditorPanel();
  try {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/editors`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load editors");
    state.boardEditors = Array.isArray(data?.editors) ? data.editors : [];
  } catch (error) {
    state.boardEditors = [];
    if (!silent) setBoardEditorsStatus(error?.message || "Could not load editors", true);
  } finally {
    state.boardEditorsLoading = false;
    refreshOwnershipDisplays();
    renderOpenShareEditorPanel();
  }
}

async function addBoardEditor(email, input = null) {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || !state.boardAccess?.canManagePermissions) return;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    setBoardEditorsStatus("Enter a valid email.", true);
    return;
  }
  setBoardEditorsStatus("Adding editor…", false);
  try {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/editors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not add editor");
    state.boardEditors = Array.isArray(data?.editors) ? data.editors : state.boardEditors;
    if (input) input.value = "";
    setBoardEditorsStatus(data?.alreadyExists ? "Editor already added." : "Editor added.", false);
  } catch (error) {
    setBoardEditorsStatus(permissionErrorMessage(error?.message || "Could not add editor"), true);
  }
}

async function removeBoardEditor(email) {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || !state.boardAccess?.canManagePermissions) return;
  const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!normalizedEmail) return;
  setBoardEditorsStatus("Removing editor…", false);
  try {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}/editors/${encodeURIComponent(normalizedEmail)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not remove editor");
    state.boardEditors = Array.isArray(data?.editors) ? data.editors : state.boardEditors.filter((editor) => editor?.email !== normalizedEmail);
    setBoardEditorsStatus("Editor removed.", false);
  } catch (error) {
    setBoardEditorsStatus(permissionErrorMessage(error?.message || "Could not remove editor"), true);
  }
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
    showShareLinkToast(true);
  } catch (error) {
    showShareLinkToast(false);
    if (el.boardCopyFeedback) {
      el.boardCopyFeedback.textContent = "Could not copy link.";
      el.boardCopyFeedback.classList.remove("hidden");
      setTimeout(() => el.boardCopyFeedback?.classList.add("hidden"), 1500);
    }
  }
}

function dismissShareLinkToast() {
  const existing = document.getElementById("share-link-toast");
  if (existing) existing.remove();
  if (state.shareToastTimer) {
    clearTimeout(state.shareToastTimer);
    state.shareToastTimer = null;
  }
}

function showShareLinkToast(copied = true) {
  if (!el.copyBoardLinkButton) return;
  dismissShareLinkToast();
  const toast = document.createElement("div");
  const showEditorManager = canManageBoardEditors();
  toast.id = "share-link-toast";
  toast.className = `share-link-toast${showEditorManager ? " share-link-popover" : ""}`;
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  const copyMessage = copied ? "Link copied ✓" : "Could not copy link";
  const lines = permissionShareLines().map((line) => `<div class="share-link-toast-line">${escapeHtml(line)}</div>`).join("");
  if (showEditorManager) state.boardEditorsStatus = { message: "", isError: false };
  toast.innerHTML = `${lines}<div class="share-link-toast-ok">${copyMessage}</div>${showEditorManager ? '<div class="share-editor-panel" data-share-editor-panel></div>' : ''}`;
  document.body.appendChild(toast);
  if (showEditorManager) {
    renderOpenShareEditorPanel();
    loadBoardEditors({ silent: true });
  }
  const rect = el.copyBoardLinkButton.getBoundingClientRect();
  const width = toast.offsetWidth || 220;
  toast.style.top = `${Math.max(8, rect.bottom + 10)}px`;
  toast.style.left = `${Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))}px`;

  const closeOnOutside = (event) => {
    if (!toast.contains(event.target) && event.target !== el.copyBoardLinkButton) {
      dismissShareLinkToast();
      document.removeEventListener("pointerdown", closeOnOutside, true);
    }
  };
  document.addEventListener("pointerdown", closeOnOutside, true);
  if (!showEditorManager) {
    state.shareToastTimer = setTimeout(() => {
      dismissShareLinkToast();
      document.removeEventListener("pointerdown", closeOnOutside, true);
    }, copied ? 2200 : 1600);
  }
}


async function saveBoardAsNew(payload) {
  if (!state.user?.email) {
    setAuthMessage("Sign in with Google to duplicate this board.");
    setSaveStatus("Sign in with Google to duplicate this board.");
    return;
  }
  const response = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (response.status === 401) {
    setAuthMessage("Sign in with Google to duplicate this board.");
    throw new Error('Sign in with Google to duplicate this board.');
  }
  if (!response.ok) throw new Error(data?.error || 'Failed to save board');

  const newId = data?.id;
  if (newId) {
    state.currentBoardId = newId;
    state.currentBoardName = data?.name || payload?.name || "Campaign Canvas Copy";
    state.lastKnownUpdatedAt = data?.updated_at || null;
    const nextPath = `/boards/${newId}`;
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setSharePanelState(newId, data?.updated_at ? new Date(data.updated_at) : new Date(), data?.owner_email || null, data?.owner_name || null, data?.owner_avatar || null);
    state.isDirty = false;
    setSaveStatus('Saved');
    refreshLastSavedSnapshot();
  }
}

function buildDuplicateBoardName() {
  const sourceId = state.currentBoardId || getBoardIdFromPath();
  const sourceBoard = sourceId ? state.boardsLibrary.find((b) => b.id === sourceId) : null;
  const baseName = sourceBoard?.name || state.currentBoardName || "";
  const trimmed = typeof baseName === "string" ? baseName.trim() : "";
  return trimmed ? `${trimmed} (Copy)` : "Campaign Canvas Copy";
}

async function duplicateCurrentBoard() {
  if (!state.user?.email) {
    setAuthMessage("Sign in with Google to duplicate this board.");
    setSaveStatus("Sign in with Google to duplicate this board.");
    return false;
  }
  if (state.isSaving) {
    setSaveStatus("Please wait until saving finishes");
    return false;
  }
  if (state.conflictModalOpen) {
    setSaveStatus("Please resolve the conflict prompt first");
    return false;
  }

  const payload = {
    name: buildDuplicateBoardName(),
    canvas_json: serializeState(),
    brand_core_snapshot: state.brandCore
  };

  try {
    const response = await fetch('/api/boards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (response.status === 401) throw new Error('Sign in with Google to duplicate this board.');
    if (!response.ok) throw new Error(data?.error || 'Failed to duplicate board');

    const newId = data?.id;
    if (!newId) throw new Error('Duplicate board response missing id');
    state.currentBoardId = newId;
    state.currentBoardName = data?.name || payload.name;
    state.lastKnownUpdatedAt = data?.updated_at || null;
    const nextPath = `/boards/${newId}`;
    if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);
    setSharePanelState(newId, data?.updated_at ? new Date(data.updated_at) : new Date(), data?.owner_email || null, data?.owner_name || null, data?.owner_avatar || null);
    state.isDirty = false;
    refreshLastSavedSnapshot();
    setSaveStatus("Board duplicated. You're editing your copy.");
    loadBoardsLibrary();
    return true;
  } catch (error) {
    console.error(error);
    if ((error?.message || "").toLowerCase().includes("sign in with google")) setAuthMessage(error.message);
    setSaveStatus(error?.message || 'Duplicate failed');
    return false;
  }
}


function getActivityUserName(fallbackName = "") {
  return (state.user?.name || state.user?.email || fallbackName || "Someone").trim();
}

function getActivityUser(fallbackName = "") {
  return {
    name: getActivityUserName(fallbackName),
    email: state.user?.email || "",
    avatar: state.user?.avatar || ""
  };
}

function getCurrentCommentActor() {
  if (!state.user?.email) return null;
  return {
    authorName: getActivityUserName(),
    authorEmail: state.user.email,
    authorAvatar: state.user.avatar || ""
  };
}

function commentAuthorName(item = {}) {
  return (item.authorName || item.user || item.authorEmail || "Someone").trim();
}

function commentAuthorAvatar(item = {}) {
  return item.authorAvatar || item.avatar || "";
}

function commentAuthorEmail(item = {}) {
  return item.authorEmail || item.email || "";
}

function commentCreatedAt(item = {}) {
  return item.createdAt || item.time || new Date().toISOString();
}

function formatCommentTimestamp(item = {}) {
  const timestamp = commentCreatedAt(item);
  const parsed = Date.parse(timestamp);
  if (Number.isFinite(parsed)) return relativeActivityTime(timestamp);
  return String(timestamp || "just now");
}

function ensureCommentIdentity(item = {}) {
  if (!item || typeof item !== "object") return item;
  item.authorName = item.authorName || item.user || item.authorEmail || "Someone";
  item.authorEmail = item.authorEmail || item.email || "";
  item.authorAvatar = item.authorAvatar || item.avatar || "";
  item.createdAt = item.createdAt || item.time || new Date().toISOString();
  item.user = item.user || item.authorName;
  item.time = item.time || (Number.isFinite(Date.parse(item.createdAt)) ? formatCommentTimestamp({ createdAt: item.createdAt }) : item.createdAt);
  if (!Array.isArray(item.replies)) item.replies = [];
  item.replies.forEach((reply) => ensureCommentIdentity(reply));
  return item;
}

function createCommentPayload(text = "") {
  const actor = getCurrentCommentActor();
  if (!actor) return null;
  const createdAt = new Date().toISOString();
  return {
    ...actor,
    user: actor.authorName,
    time: nowString(),
    createdAt,
    text,
    resolved: false,
    replies: []
  };
}

function requireCommentIdentity() {
  if (state.user?.email) return true;
  setAuthMessage("Sign in with Google to comment.");
  setSaveStatus("Sign in with Google to comment.");
  return false;
}

function normalizeNodeStatus(status) {
  const value = typeof status === "string" ? status.trim() : "";
  return NODE_STATUS_BY_VALUE.has(value) ? value : "Draft";
}

function getNodeStatusDefinition(status) {
  return NODE_STATUS_BY_VALUE.get(normalizeNodeStatus(status)) || NODE_STATUSES[0];
}

function nodeStatusLabel(status) {
  return getNodeStatusDefinition(status).label;
}

function recordStatusChangedActivity(node, statusLabel = "") {
  if (!node || state.isBoardLoading) return;
  appendActivity("status_changed", { node, statusLabel: statusLabel || nodeStatusLabel(node.status) });
}

function sanitizeActivityFeed(feed) {
  if (!Array.isArray(feed)) return [];
  return feed
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: String(entry.id || `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`),
      type: String(entry.type || "node_updated"),
      user: typeof entry.user === "object" && entry.user
        ? {
            name: String(entry.user.name || entry.user.email || "Someone").slice(0, 80),
            email: String(entry.user.email || "").slice(0, 120),
            avatar: String(entry.user.avatar || "")
          }
        : { name: String(entry.user || "Someone").slice(0, 80), email: "", avatar: "" },
      nodeId: entry.nodeId ? String(entry.nodeId) : null,
      nodeTitle: entry.nodeTitle ? String(entry.nodeTitle).slice(0, 120) : "",
      statusLabel: entry.statusLabel ? String(entry.statusLabel).slice(0, 80) : "",
      ownerName: entry.ownerName ? String(entry.ownerName).slice(0, 80) : "",
      ownerEmail: entry.ownerEmail ? String(entry.ownerEmail).slice(0, 120) : "",
      ownerAvatar: entry.ownerAvatar ? String(entry.ownerAvatar) : "",
      timestamp: entry.timestamp || new Date().toISOString()
    }))
    .sort((a, b) => Date.parse(b.timestamp || 0) - Date.parse(a.timestamp || 0))
    .slice(0, ACTIVITY_FEED_MAX_ENTRIES);
}

function activityId() {
  return `activity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function activityNodeTitle(node, fallback = "this node") {
  return (node?.title || node?.type || fallback || "this node").trim();
}

function appendActivity(type, { node = null, nodeId = null, nodeTitle = "", userName = "", statusLabel = "", ownerName = "", ownerEmail = "", ownerAvatar = "" } = {}) {
  if (state.isBoardLoading || state.initialServerLoadInFlight) return null;
  const resolvedNode = node || (nodeId ? getNode(nodeId) : null);
  const safeNodeId = nodeId || resolvedNode?.id || null;
  const safeNodeTitle = nodeTitle || activityNodeTitle(resolvedNode);
  const user = getActivityUser(userName);
  const nowIso = new Date().toISOString();
  const recent = (type === "owner_assigned" || type === "owner_unassigned") ? null : state.activityFeed.find((entry) => {
    if (entry.type !== type || entry.nodeId !== safeNodeId) return false;
    const entryEmail = entry.user?.email || "";
    const entryName = entry.user?.name || "";
    const sameUser = user.email ? entryEmail === user.email : entryName === user.name;
    return sameUser && Date.now() - Date.parse(entry.timestamp || 0) < ACTIVITY_DEBOUNCE_MS;
  });

  if (recent) {
    recent.timestamp = nowIso;
    recent.nodeTitle = safeNodeTitle;
    if (statusLabel) recent.statusLabel = statusLabel;
    if (ownerName) recent.ownerName = ownerName;
    if (ownerEmail) recent.ownerEmail = ownerEmail;
    if (ownerAvatar) recent.ownerAvatar = ownerAvatar;
    renderActivityFeed();
    return recent;
  }

  const entry = {
    id: activityId(),
    type,
    user,
    nodeId: safeNodeId,
    nodeTitle: safeNodeTitle,
    statusLabel: statusLabel || "",
    ownerName: ownerName || "",
    ownerEmail: ownerEmail || "",
    ownerAvatar: ownerAvatar || "",
    timestamp: nowIso
  };
  state.activityFeed = [entry, ...state.activityFeed].slice(0, ACTIVITY_FEED_MAX_ENTRIES);
  renderActivityFeed();
  return entry;
}

function recordNodeUpdatedActivity(node) {
  if (!node || state.isBoardLoading) return;
  appendActivity("node_updated", { node });
}

function formatActivityAction(entry = {}) {
  const title = entry.nodeTitle ? `“${entry.nodeTitle}”` : "a node";
  const map = {
    node_created: `created ${title}`,
    node_updated: `edited ${title}`,
    status_changed: `changed status to ${entry.statusLabel || "Draft"} on ${title}`,
    owner_assigned: `assigned node to ${entry.ownerName || deriveOwnerDisplayName(entry.ownerName, entry.ownerEmail) || "someone"}`,
    owner_unassigned: "unassigned node",
    node_moved: `moved ${title}`,
    node_deleted: `deleted ${title}`,
    edge_connected: `connected ${title}`,
    edge_disconnected: `disconnected ${title}`,
    media_added: `added media to ${title}`,
    media_removed: `removed media from ${title}`,
    comment_added: `added a comment on ${title}`,
    reply_added: `replied on ${title}`,
    comment_resolved: `resolved a comment on ${title}`,
    postit_added: `added a post-it on ${title}`,
    generated_next_step: `generated next step from ${title}`,
    auto_arranged: "auto-arranged the board"
  };
  return map[entry.type] || `updated ${title}`;
}

function relativeActivityTime(timestamp) {
  const then = Date.parse(timestamp || "");
  if (!Number.isFinite(then)) return "just now";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(then).toLocaleDateString();
}

function currentBoardAwarenessKey() {
  return state.currentBoardId || getBoardIdFromPath() || "local";
}

function parseStoredTimestamp(value) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function awarenessUserKey() {
  const email = String(state.user?.email || "").trim().toLowerCase();
  return email ? encodeURIComponent(email) : "anonymous";
}

function activitySeenStorageKey() {
  return `${ACTIVITY_SEEN_STORAGE_PREFIX}${currentBoardAwarenessKey()}.${awarenessUserKey()}`;
}

function commentSeenStorageKey() {
  return `${COMMENT_SEEN_STORAGE_PREFIX}${currentBoardAwarenessKey()}.${awarenessUserKey()}`;
}

function getLastSeenActivityAt() {
  if (!state.lastSeenActivityAt) state.lastSeenActivityAt = parseStoredTimestamp(localStorage.getItem(activitySeenStorageKey()));
  return state.lastSeenActivityAt || 0;
}

function isActivityByCurrentUser(entry = {}) {
  const currentEmail = String(state.user?.email || "").trim().toLowerCase();
  const entryEmail = String(entry.user?.email || "").trim().toLowerCase();
  if (currentEmail && entryEmail) return currentEmail === entryEmail;
  const currentName = String(state.user?.name || "").trim();
  const entryName = String(entry.user?.name || "").trim();
  return !!currentName && !!entryName && currentName === entryName;
}

function activityTimestamp(entry = {}) {
  const parsed = Date.parse(entry.timestamp || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function isActivityUnread(entry = {}, seenAt = getLastSeenActivityAt()) {
  return activityTimestamp(entry) > seenAt && !isActivityByCurrentUser(entry);
}

function getUnreadActivityEntries(feed = state.activityFeed) {
  const seenAt = getLastSeenActivityAt();
  return sanitizeActivityFeed(feed).filter((entry) => isActivityUnread(entry, seenAt));
}

function latestActivityTimestamp(feed = state.activityFeed) {
  return sanitizeActivityFeed(feed).reduce((latest, entry) => Math.max(latest, activityTimestamp(entry)), 0);
}

function updateActivityUnreadIndicator() {
  const unreadCount = getUnreadActivityEntries().length;
  if (el.activityCount) el.activityCount.textContent = unreadCount ? `${Math.min(unreadCount, 99)} new` : "";
  el.activityPanel?.classList.toggle("has-unread", unreadCount > 0);
  el.activityToggleButton?.classList.toggle("has-unread", unreadCount > 0);
}

function markActivityFeedSeen({ rerender = false } = {}) {
  const latest = latestActivityTimestamp();
  if (!latest || latest <= getLastSeenActivityAt()) {
    updateActivityUnreadIndicator();
    if (rerender) renderActivityFeed();
    return;
  }
  state.lastSeenActivityAt = latest;
  localStorage.setItem(activitySeenStorageKey(), String(latest));
  updateActivityUnreadIndicator();
  if (state.activeView === "list" || (el.boardListView && !el.boardListView.classList.contains("hidden"))) updateListView();
  if (rerender) renderActivityFeed();
}

function readCommentSeenMap() {
  try {
    const raw = localStorage.getItem(commentSeenStorageKey());
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function writeCommentSeenMap(map) {
  localStorage.setItem(commentSeenStorageKey(), JSON.stringify(map || {}));
}

function getNodeCommentsSeenAt(nodeId) {
  if (!nodeId) return 0;
  return parseStoredTimestamp(readCommentSeenMap()[nodeId]);
}

function latestNodeCommentTimestamp(node = {}) {
  const comments = Array.isArray(node.postits) ? node.postits : [];
  return comments.reduce((latest, note) => {
    const noteTime = Date.parse(noteUpdatedAt(note) || "");
    let nextLatest = Number.isFinite(noteTime) ? Math.max(latest, noteTime) : latest;
    (Array.isArray(note.replies) ? note.replies : []).forEach((reply) => {
      const replyTime = Date.parse(reply.updatedAt || reply.createdAt || reply.time || "");
      if (Number.isFinite(replyTime)) nextLatest = Math.max(nextLatest, replyTime);
    });
    return nextLatest;
  }, 0);
}

function hasUnreadNodeComments(node) {
  if (!node?.id) return false;
  const latest = latestNodeCommentTimestamp(node);
  return latest > 0 && latest > getNodeCommentsSeenAt(node.id);
}

function markNodeCommentsSeen(nodeId) {
  const node = getNode(nodeId);
  if (!node?.id) return;
  const latest = latestNodeCommentTimestamp(node) || Date.now();
  const map = readCommentSeenMap();
  if (parseStoredTimestamp(map[node.id]) >= latest) return;
  map[node.id] = latest;
  writeCommentSeenMap(map);
  updateNodeCard(node);
  if (state.activeView === "list" || (el.boardListView && !el.boardListView.classList.contains("hidden"))) updateListView();
}

function ensureCommentSeenBaseline() {
  if (localStorage.getItem(commentSeenStorageKey()) !== null) return;
  const map = {};
  state.nodes.forEach((node) => {
    const latest = latestNodeCommentTimestamp(node);
    if (latest > 0) map[node.id] = latest;
  });
  writeCommentSeenMap(map);
}

function hasUnreadActivityForNode(nodeId) {
  if (!nodeId) return false;
  return getUnreadActivityEntries().some((entry) => entry.nodeId === nodeId);
}

function hasUnreadStatusActivityForNode(nodeId) {
  if (!nodeId) return false;
  return getUnreadActivityEntries().some((entry) => entry.nodeId === nodeId && entry.type === "status_changed");
}

function renderActivityFeed() {
  if (!el.activityFeed) return;
  const entries = sanitizeActivityFeed(state.activityFeed).slice(0, ACTIVITY_FEED_VISIBLE_ENTRIES);
  updateActivityUnreadIndicator();
  if (el.activityToggleButton) el.activityToggleButton.setAttribute("aria-expanded", String(!state.activityCollapsed));
  el.activityPanel?.classList.toggle("is-collapsed", !!state.activityCollapsed);
  if (state.activityCollapsed) return;
  const seenAt = getLastSeenActivityAt();
  el.activityFeed.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "activity-empty";
    empty.textContent = "Recent collaboration activity will appear here.";
    el.activityFeed.appendChild(empty);
    return;
  }
  entries.forEach((entry) => {
    const row = document.createElement("div");
    row.className = "activity-entry";
    const isUnread = isActivityUnread(entry, seenAt);
    row.classList.toggle("is-new", isUnread);
    const canFocusNode = !!entry.nodeId && !!getNode(entry.nodeId);
    if (canFocusNode) {
      row.classList.add("is-clickable");
      row.tabIndex = 0;
      row.setAttribute("role", "button");
      row.title = isCommentActivityType(entry.type) ? "Jump to discussion" : "Jump to node";
      row.addEventListener("click", () => handleActivityEntryFocus(entry));
      row.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        handleActivityEntryFocus(entry);
      });
    }
    const user = entry.user || {};
    const name = getViewerDisplayName(user);
    const avatar = document.createElement("span");
    avatar.className = "activity-avatar";
    if (user.avatar) {
      const img = document.createElement("img");
      img.src = user.avatar;
      img.alt = `${name} avatar`;
      avatar.appendChild(img);
    } else {
      avatar.textContent = getViewerInitials(user);
    }
    const body = document.createElement("div");
    body.className = "activity-body";
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = name;
    line.append(strong, document.createTextNode(` ${formatActivityAction(entry)}`));
    const time = document.createElement("time");
    time.dateTime = entry.timestamp || "";
    time.textContent = relativeActivityTime(entry.timestamp);
    body.append(line, time);
    if (isUnread) {
      const newLabel = document.createElement("span");
      newLabel.className = "activity-new-label";
      newLabel.textContent = "New";
      body.appendChild(newLabel);
    }
    row.append(avatar, body);
    el.activityFeed.appendChild(row);
  });
}

function getUserInitials(user) {
  const source = (user?.name || user?.email || "U").trim();
  return source.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

function getViewerDisplayName(viewer = {}) {
  const name = typeof viewer?.name === "string" ? viewer.name.trim() : "";
  if (name) return name;
  const email = typeof viewer?.email === "string" ? viewer.email.trim() : "";
  const localPart = email.split("@")[0]?.replace(/[._-]+/g, " ").trim();
  return localPart || "Viewer";
}

function getViewerInitials(viewer = {}) {
  const source = getViewerDisplayName(viewer);
  return source.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "U";
}

function normalizedViewerEmail(viewer = {}) {
  return String(viewer?.email || "").trim().toLowerCase();
}

function isRemoteViewer(viewer = {}) {
  const viewerEmail = normalizedViewerEmail(viewer);
  const currentEmail = String(state.user?.email || "").trim().toLowerCase();
  return !!viewerEmail && !!currentEmail && viewerEmail !== currentEmail;
}

function viewerBoardPoint(viewer = {}) {
  if (Number.isFinite(viewer.viewportCenterX) && Number.isFinite(viewer.viewportCenterY)) {
    return { x: Number(viewer.viewportCenterX), y: Number(viewer.viewportCenterY) };
  }
  if (Number.isFinite(viewer.cursorX) && Number.isFinite(viewer.cursorY)) {
    return { x: Number(viewer.cursorX), y: Number(viewer.cursorY) };
  }
  const nodeId = viewer.hoveredNodeId || viewer.editingNodeId || viewer.selectedNodeId;
  const node = nodeId ? getNode(nodeId) : null;
  if (!node) return null;
  return { x: (node.position?.x || 0) + NODE_WIDTH / 2, y: (node.position?.y || 0) + NODE_HEIGHT / 2 };
}

function formatNodePresenceTitle(viewers = []) {
  const names = viewers.map(getViewerDisplayName);
  if (names.length === 1) return `${names[0]} is viewing this node`;
  if (names.length === 2) return `${names[0]} and ${names[1]} are viewing this node`;
  const overflow = Math.max(0, names.length - 2);
  return `${names.slice(0, 2).join(", ")} +${overflow} are viewing this node`;
}

function formatEditingFieldLabel(field = "") {
  const safeField = String(field || "").trim().toLowerCase();
  const labels = {
    title: "title",
    content: "description",
    description: "description",
    audience: "audience",
    postit: "a post-it",
    textarea: "text",
    platform: "platform",
    tags: "tags",
    goal: "goal",
    channel: "channel",
    funnelstage: "funnel stage",
    tone: "tone",
    contentformat: "format",
    media: "media"
  };
  return labels[safeField] || "";
}

function formatCollaboratorSpatialStatus(viewer = {}) {
  const field = formatEditingFieldLabel(viewer.editingField);
  if (viewer.editingNodeId) return field ? `editing ${field}` : 'editing';
  const hoverNode = viewer.hoveredNodeId ? getNode(viewer.hoveredNodeId) : null;
  if (hoverNode) return `viewing ${hoverNode.title || hoverNode.type || 'node'}`;
  return '';
}

function formatNodeEditingTitle(viewers = []) {
  const names = viewers.map(getViewerDisplayName);
  if (!names.length) return "Someone is editing";
  if (viewers.length === 1) {
    const field = formatEditingFieldLabel(viewers[0]?.editingField);
    return field ? `${names[0]} is editing ${field}` : `${names[0]} is typing`;
  }
  if (viewers.length === 2) return `${names[0]} and ${names[1]} are editing`;
  const overflow = Math.max(0, names.length - 2);
  return `${names.slice(0, 2).join(", ")} +${overflow} are editing`;
}

function renderPresenceLite() {
  if (!el.presenceLite || !el.presenceAvatars || !el.presenceCount) return;
  const viewers = Array.isArray(state.presenceViewers) ? state.presenceViewers : [];
  if (!state.user?.email || viewers.length === 0) {
    el.presenceLite.classList.add("hidden");
    el.presenceAvatars.innerHTML = "";
    el.presenceCount.textContent = "";
    return;
  }
  const max = 3;
  const show = viewers.slice(0, max);
  el.presenceAvatars.innerHTML = "";
  show.forEach((viewer) => {
    const badge = document.createElement("button");
    const label = getViewerDisplayName(viewer);
    const canNavigate = isRemoteViewer(viewer) && !!viewerBoardPoint(viewer);
    badge.type = "button";
    badge.className = "presence-avatar";
    badge.title = canNavigate ? `Jump to or follow ${label}` : `${label} is viewing this board`;
    badge.setAttribute("aria-label", badge.title);
    badge.classList.toggle("is-following", state.followingCollaboratorEmail === normalizedViewerEmail(viewer));
    badge.disabled = !canNavigate;
    if (canNavigate) {
      badge.addEventListener("click", (event) => openCollaboratorFollowMenu(viewer, badge, event));
    }
    if (viewer?.avatar) {
      const img = document.createElement("img");
      img.src = viewer.avatar;
      img.alt = `${label} avatar`;
      img.title = badge.title;
      badge.appendChild(img);
    } else {
      badge.textContent = getViewerInitials(viewer);
    }
    el.presenceAvatars.appendChild(badge);
  });
  el.presenceCount.textContent = viewers.length > max ? `+${viewers.length - max}` : `${viewers.length}`;
  el.presenceLite.classList.remove("hidden");
}

function closeCollaboratorFollowMenu() {
  document.querySelector('.collab-follow-menu')?.remove();
}

function openCollaboratorFollowMenu(viewer, anchorEl, event = null) {
  event?.preventDefault?.();
  event?.stopPropagation?.();
  if (!isRemoteViewer(viewer) || !viewerBoardPoint(viewer)) return;
  closeCollaboratorFollowMenu();

  const name = getViewerDisplayName(viewer);
  const menu = document.createElement('div');
  menu.className = 'collab-follow-menu';
  menu.setAttribute('role', 'menu');
  const heading = document.createElement('strong');
  heading.textContent = name;
  const jumpButton = document.createElement('button');
  jumpButton.type = 'button';
  jumpButton.dataset.collabAction = 'jump';
  jumpButton.textContent = `Jump to ${name}`;
  const followButton = document.createElement('button');
  followButton.type = 'button';
  followButton.dataset.collabAction = 'follow';
  followButton.textContent = `Follow ${name}`;
  menu.append(heading, jumpButton, followButton);
  document.body.appendChild(menu);

  const rect = anchorEl.getBoundingClientRect();
  menu.style.left = `${Math.min(window.innerWidth - menu.offsetWidth - 10, Math.max(10, rect.left))}px`;
  menu.style.top = `${Math.min(window.innerHeight - menu.offsetHeight - 10, rect.bottom + 8)}px`;

  let close;
  const cleanup = () => {
    closeCollaboratorFollowMenu();
    if (close) document.removeEventListener('pointerdown', close, true);
  };

  jumpButton.addEventListener('click', () => {
    cleanup();
    focusCollaborator(viewer);
  });
  followButton.addEventListener('click', () => {
    cleanup();
    startFollowCollaborator(viewer);
  });

  close = (closeEvent) => {
    if (menu.contains(closeEvent.target) || anchorEl.contains(closeEvent.target)) return;
    cleanup();
  };
  setTimeout(() => document.addEventListener('pointerdown', close, true), 0);
}

function pulseCollaboratorFocus(point, label = '') {
  const layer = ensureCursorPresenceLayer();
  if (!layer || !point) return;
  const pulse = document.createElement('div');
  pulse.className = 'collab-focus-pulse';
  pulse.style.setProperty('--focus-x', `${Math.round(point.x * state.zoom)}px`);
  pulse.style.setProperty('--focus-y', `${Math.round(point.y * state.zoom)}px`);
  pulse.textContent = label;
  layer.appendChild(pulse);
  setTimeout(() => pulse.remove(), 1600);
}

function focusBoardPointInCanvas(point, { behavior = 'smooth', pulseLabel = '' } = {}) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !el.canvas) return false;

  const runFocus = () => {
    updateCanvasScrollSurfaceSize();
    const maxLeft = Math.max(0, el.canvas.scrollWidth - el.canvas.clientWidth);
    const maxTop = Math.max(0, el.canvas.scrollHeight - el.canvas.clientHeight);
    const left = Math.max(0, Math.min(maxLeft, point.x * state.zoom - el.canvas.clientWidth / 2));
    const top = Math.max(0, Math.min(maxTop, point.y * state.zoom - el.canvas.clientHeight / 2));
    el.canvas.scrollTo({ left, top, behavior });
    requestAnimationFrame(() => pulseCollaboratorFocus(point, pulseLabel));
  };

  if (state.activeView !== 'board') {
    setActiveView('board');
    requestAnimationFrame(runFocus);
  } else {
    runFocus();
  }
  return true;
}

function focusCollaborator(viewer, { behavior = 'smooth', pulse = true, preferNode = false } = {}) {
  if (!isRemoteViewer(viewer)) return false;
  const nodeId = viewer.editingNodeId || viewer.hoveredNodeId || viewer.selectedNodeId || null;
  const node = nodeId ? getNode(nodeId) : null;
  const name = getViewerDisplayName(viewer);
  const point = viewerBoardPoint(viewer);

  if (!preferNode && point) {
    return focusBoardPointInCanvas(point, { behavior, pulseLabel: pulse ? name : '' });
  }

  if (node) {
    const didFocusNode = focusNodeInCanvas(node.id, { behavior, select: true, pulse });
    if (didFocusNode && pulse) {
      pulseCollaboratorFocus(point || { x: node.position.x + NODE_WIDTH / 2, y: node.position.y + NODE_HEIGHT / 2 }, name);
    }
    return didFocusNode;
  }

  return focusBoardPointInCanvas(point, { behavior, pulseLabel: pulse ? name : '' });
}

function renderFollowModeIndicator() {
  let indicator = document.querySelector('.collab-follow-indicator');
  if (!state.followingCollaboratorEmail) {
    indicator?.remove();
    return;
  }
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'collab-follow-indicator';
    indicator.innerHTML = '<span></span><button type="button">Stop</button>';
    indicator.querySelector('button')?.addEventListener('click', () => stopFollowCollaborator('Follow stopped'));
    document.body.appendChild(indicator);
  }
  indicator.querySelector('span').textContent = `Following ${state.followingCollaboratorName || 'collaborator'}`;
}

function startFollowCollaborator(viewer) {
  if (!isRemoteViewer(viewer) || !viewerBoardPoint(viewer)) return false;
  state.followingCollaboratorEmail = normalizedViewerEmail(viewer);
  state.followingCollaboratorName = getViewerDisplayName(viewer);
  renderFollowModeIndicator();
  renderPresenceLite();
  focusCollaborator(viewer);
  setSaveStatus(`Following ${state.followingCollaboratorName}`);
  return true;
}

function stopFollowCollaborator(message = '') {
  if (!state.followingCollaboratorEmail) return;
  state.followingCollaboratorEmail = null;
  state.followingCollaboratorName = '';
  renderFollowModeIndicator();
  renderPresenceLite();
  if (message) setSaveStatus(message);
}

function stopFollowForManualNavigation() {
  if (state.followingCollaboratorEmail) stopFollowCollaborator('Follow stopped');
}

function applyFollowModeFromPresence() {
  if (!state.followingCollaboratorEmail) return;
  const viewer = (state.presenceViewers || []).find((candidate) => normalizedViewerEmail(candidate) === state.followingCollaboratorEmail);
  if (!viewer || !viewerBoardPoint(viewer)) {
    stopFollowCollaborator('Collaborator unavailable');
    return;
  }
  focusCollaborator(viewer, { behavior: 'smooth', pulse: false });
}

function getRemotePresenceByNodeId(fieldName = 'selectedNodeId') {
  const map = new Map();
  const viewers = Array.isArray(state.presenceViewers) ? state.presenceViewers : [];
  const currentUserEmail = (state.user?.email || '').toLowerCase();
  const nodeIds = new Set(state.nodes.map((node) => node.id));

  viewers.forEach((viewer) => {
    if (!viewer?.email) return;
    const viewerEmail = String(viewer.email).toLowerCase();
    if (!viewerEmail || viewerEmail === currentUserEmail) return;
    const nodeId = typeof viewer[fieldName] === 'string' ? viewer[fieldName].trim() : '';
    if (!nodeId || !nodeIds.has(nodeId)) return;
    const list = map.get(nodeId) || [];
    list.push(viewer);
    map.set(nodeId, list);
  });

  return map;
}

function getNodePresenceById() {
  return getRemotePresenceByNodeId('selectedNodeId');
}

function getNodeEditingPresenceById() {
  return getRemotePresenceByNodeId('editingNodeId');
}

function clearNodePresenceBadges() {
  state.presenceNodeSignature = "";
  if (!el.zoomLayer) return;
  el.zoomLayer.querySelectorAll('.node-presence-overlay, .node-editing-indicator').forEach((x) => x.remove());
  el.zoomLayer.querySelectorAll('.node.remote-editing').forEach((nodeEl) => nodeEl.classList.remove('remote-editing'));
  clearCollaboratorCursors();
}

function renderNodePresenceBadges({ force = false } = {}) {
  if (!el.zoomLayer) return;
  const presenceByNodeId = getNodePresenceById();
  const editingByNodeId = getNodeEditingPresenceById();
  const signature = JSON.stringify({
    viewing: [...presenceByNodeId.entries()].map(([nodeId, viewers]) => [
      nodeId,
      viewers.map((viewer) => [
        viewer.email || '',
        viewer.name || '',
        viewer.avatar || '',
        viewer.selectedNodeId || ''
      ].join(':'))
    ]),
    editing: [...editingByNodeId.entries()].map(([nodeId, viewers]) => [
      nodeId,
      viewers.map((viewer) => [
        viewer.email || '',
        viewer.name || '',
        viewer.avatar || '',
        viewer.editingNodeId || '',
        viewer.editingField || ''
      ].join(':'))
    ])
  });
  if (!force && signature === state.presenceNodeSignature) return;
  state.presenceNodeSignature = signature;

  el.zoomLayer.querySelectorAll('.node-presence-overlay, .node-editing-indicator').forEach((x) => x.remove());
  el.zoomLayer.querySelectorAll('.node.remote-editing').forEach((nodeEl) => nodeEl.classList.remove('remote-editing'));

  presenceByNodeId.forEach((viewers, nodeId) => {
    const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
    if (!nodeEl) return;

    const overlay = document.createElement('div');
    overlay.className = 'node-presence-overlay';

    const maxVisible = 2;
    const shown = viewers.slice(0, maxVisible);
    const presenceTitle = formatNodePresenceTitle(viewers);
    shown.forEach((viewer) => {
      const badge = document.createElement('span');
      badge.className = 'node-presence-avatar';
      const label = getViewerDisplayName(viewer);
      badge.title = presenceTitle;
      badge.setAttribute('aria-label', presenceTitle);
      if (isRemoteViewer(viewer)) {
        badge.classList.add('is-clickable');
        badge.addEventListener('click', (event) => {
          event.stopPropagation();
          focusCollaborator(viewer, { preferNode: true });
        });
      }
      if (viewer?.avatar) {
        const img = document.createElement('img');
        img.src = viewer.avatar;
        img.alt = label;
        img.title = presenceTitle;
        badge.appendChild(img);
      } else {
        badge.textContent = getViewerInitials(viewer);
      }
      overlay.appendChild(badge);
    });

    const overflow = viewers.length - shown.length;
    if (overflow > 0) {
      const extra = document.createElement('span');
      extra.className = 'node-presence-extra';
      extra.title = presenceTitle;
      extra.setAttribute('aria-label', presenceTitle);
      extra.textContent = `+${overflow}`;
      overlay.appendChild(extra);
    }

    overlay.title = presenceTitle;
    nodeEl.appendChild(overlay);
  });

  editingByNodeId.forEach((viewers, nodeId) => {
    const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
    if (!nodeEl) return;
    nodeEl.classList.add('remote-editing');

    const indicator = document.createElement('div');
    indicator.className = 'node-editing-indicator';
    const editingTitle = formatNodeEditingTitle(viewers);
    indicator.title = editingTitle;
    indicator.setAttribute('aria-label', editingTitle);

    const avatarWrap = document.createElement('span');
    avatarWrap.className = 'node-editing-avatars';
    const shown = viewers.slice(0, 3);
    shown.forEach((viewer) => {
      const avatar = document.createElement('span');
      avatar.className = 'node-editing-avatar';
      avatar.title = editingTitle;
      avatar.setAttribute('aria-label', `${getViewerDisplayName(viewer)} is editing`);
      if (isRemoteViewer(viewer)) {
        avatar.classList.add('is-clickable');
        avatar.addEventListener('click', (event) => {
          event.stopPropagation();
          focusCollaborator(viewer, { preferNode: true });
        });
      }
      if (viewer?.avatar) {
        const img = document.createElement('img');
        img.src = viewer.avatar;
        img.alt = getViewerDisplayName(viewer);
        avatar.appendChild(img);
      } else {
        avatar.textContent = getViewerInitials(viewer);
      }
      avatarWrap.appendChild(avatar);
    });
    const overflow = viewers.length - shown.length;
    if (overflow > 0) {
      const extra = document.createElement('span');
      extra.className = 'node-editing-avatar node-editing-extra';
      extra.textContent = `+${overflow}`;
      extra.title = editingTitle;
      avatarWrap.appendChild(extra);
    }

    const pencil = document.createElement('span');
    pencil.className = 'node-editing-pencil';
    pencil.textContent = '✎';

    const label = document.createElement('span');
    label.className = 'node-editing-label';
    const first = viewers[0] || {};
    const fieldLabel = formatEditingFieldLabel(first.editingField);
    label.textContent = viewers.length > 1 ? `${viewers.length} editing` : (fieldLabel ? `editing ${fieldLabel}` : 'typing…');

    indicator.append(avatarWrap, pencil, label);
    nodeEl.appendChild(indicator);
  });
}

function resetPresenceSelectionQueue() {
  if (state.presenceSelectionPingTimer) {
    clearTimeout(state.presenceSelectionPingTimer);
    state.presenceSelectionPingTimer = null;
  }
  state.presencePendingPingAfterInFlight = false;
  state.presenceSelectedNodeIdLastQueued = undefined;
  state.presenceSelectedNodeIdLastSent = undefined;
  state.presencePayloadSignatureLastQueued = undefined;
  state.presencePayloadSignatureLastSent = undefined;
  if (state.presenceEditingClearTimer) {
    clearTimeout(state.presenceEditingClearTimer);
    state.presenceEditingClearTimer = null;
  }
  if (state.presenceCursorPublishTimer) {
    clearTimeout(state.presenceCursorPublishTimer);
    state.presenceCursorPublishTimer = null;
  }
  if (state.presenceCursorClearTimer) {
    clearTimeout(state.presenceCursorClearTimer);
    state.presenceCursorClearTimer = null;
  }
  state.presenceEditingNodeId = null;
  state.presenceEditingField = null;
  state.presenceCursorX = null;
  state.presenceCursorY = null;
  state.presenceCursorHoveredNodeId = null;
  state.presenceCursorLastMovedAt = null;
}

function stopPresenceLite() {
  if (state.presencePollTimer) {
    clearInterval(state.presencePollTimer);
    state.presencePollTimer = null;
  }
  resetPresenceSelectionQueue();
  clearNodePresenceBadges();
  stopFollowCollaborator();
}

function stopBoardRefreshPolling() {
  if (state.boardRefreshPollTimer) {
    clearInterval(state.boardRefreshPollTimer);
    state.boardRefreshPollTimer = null;
  }
  state.boardRefreshInFlight = false;
  state.remoteMergeSkippedNodeIds.clear();
}

function startBoardRefreshPolling() {
  stopBoardRefreshPolling();
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId) return;
  state.boardRefreshPollTimer = setInterval(() => { void pollBoardForRemoteChanges(); }, 12000);
}

async function pingPresenceLite() {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  const selectedNodeId = state.selectedPrimary || null;
  const editingNodeId = state.presenceEditingNodeId || null;
  const editingField = editingNodeId ? (state.presenceEditingField || null) : null;
  const cursorPayload = cursorPresencePayload();
  if (!boardId || !state.user?.email) {
    state.presenceViewers = [];
    state.presenceSelectedNodeIdLastSent = undefined;
    refreshOwnershipDisplays();
    renderPresenceLite();
    clearNodePresenceBadges();
    return;
  }
  if (state.presencePingInFlight) {
    state.presencePendingPingAfterInFlight = true;
    return;
  }
  state.presencePingInFlight = true;
  try {
    const response = await fetch(`/api/boards/presence/${encodeURIComponent(boardId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedNodeId, editingNodeId, editingField, ...cursorPayload })
    });
    if (!response.ok) throw new Error('presence unavailable');
    const data = await response.json();
    if ((state.currentBoardId || getBoardIdFromPath()) !== boardId || !state.user?.email) return;
    state.presenceSelectedNodeIdLastSent = selectedNodeId;
    state.presencePayloadSignatureLastSent = buildPresencePayloadSignature();
    state.presenceViewers = Array.isArray(data?.viewers) ? data.viewers : [];
    refreshOwnershipDisplays();
    maybeRefreshEditorIdentitiesFromPresence();
    renderPresenceLite();
    renderNodePresenceBadges();
    scheduleCollaboratorCursorRender();
    applyFollowModeFromPresence();
  } catch (_error) {
    state.presenceViewers = [];
    refreshOwnershipDisplays();
    renderPresenceLite();
    clearNodePresenceBadges();
  } finally {
    state.presencePingInFlight = false;
    if (state.presencePendingPingAfterInFlight) {
      state.presencePendingPingAfterInFlight = false;
      notifyPresenceSelectionMaybe(120);
    }
  }
}

function buildPresencePayloadSignature() {
  return JSON.stringify({
    selectedNodeId: state.selectedPrimary || null,
    editingNodeId: state.presenceEditingNodeId || null,
    editingField: state.presenceEditingNodeId ? (state.presenceEditingField || null) : null,
    ...cursorPresencePayload()
  });
}

function notifyPresenceSelectionMaybe(delayMs = 350) {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || !state.user?.email) return;

  const selectedNodeId = state.selectedPrimary || null;
  const payloadSignature = buildPresencePayloadSignature();
  if (payloadSignature === state.presencePayloadSignatureLastQueued && state.presenceSelectionPingTimer) return;
  if (payloadSignature === state.presencePayloadSignatureLastSent && !state.presenceSelectionPingTimer) return;

  state.presenceSelectedNodeIdLastQueued = selectedNodeId;
  state.presencePayloadSignatureLastQueued = payloadSignature;
  if (state.presenceSelectionPingTimer) clearTimeout(state.presenceSelectionPingTimer);
  state.presenceSelectionPingTimer = setTimeout(() => {
    state.presenceSelectionPingTimer = null;
    if (state.presencePayloadSignatureLastQueued === state.presencePayloadSignatureLastSent) return;
    void pingPresenceLite();
  }, delayMs);
}

function setLocalEditingPresence(nodeId, field = 'textarea', { clearAfterMs = 4000, notifyDelayMs = 250 } = {}) {
  if (!nodeId || !state.user?.email || state.boardAccess?.canEdit === false) return;
  const safeField = field || 'textarea';
  const changed = state.presenceEditingNodeId !== nodeId || state.presenceEditingField !== safeField;
  state.presenceEditingNodeId = nodeId;
  state.presenceEditingField = safeField;
  if (state.presenceEditingClearTimer) clearTimeout(state.presenceEditingClearTimer);
  state.presenceEditingClearTimer = setTimeout(() => {
    clearLocalEditingPresence({ notifyDelayMs: 250 });
  }, clearAfterMs);
  if (changed) notifyPresenceSelectionMaybe(notifyDelayMs);
}

function clearLocalEditingPresence({ notifyDelayMs = 250 } = {}) {
  if (state.presenceEditingClearTimer) {
    clearTimeout(state.presenceEditingClearTimer);
    state.presenceEditingClearTimer = null;
  }
  if (!state.presenceEditingNodeId && !state.presenceEditingField) return;
  state.presenceEditingNodeId = null;
  state.presenceEditingField = null;
  notifyPresenceSelectionMaybe(notifyDelayMs);
}

function editingInfoFromTarget(target) {
  if (!target || !target.closest) return null;
  if (target.closest('.postit')) {
    const nodeEl = target.closest('.node[data-id]');
    return nodeEl?.dataset?.id ? { nodeId: nodeEl.dataset.id, field: 'postit' } : null;
  }
  const nodeEl = target.closest('.node[data-id]');
  if (nodeEl?.dataset?.id) {
    if (target.closest('.title')) return { nodeId: nodeEl.dataset.id, field: 'title' };
    if (target.closest('.content')) return { nodeId: nodeEl.dataset.id, field: 'content' };
    return { nodeId: nodeEl.dataset.id, field: 'textarea' };
  }
  if (el.nodeForm?.contains(target) && state.selectedPrimary) {
    const fieldMap = {
      type: 'textarea',
      title: 'title',
      content: 'content',
      imagePrompt: 'media',
      audience: 'audience',
      caption: 'content',
      hashtags: 'tags',
      preview: 'content',
      platform: 'platform',
      goal: 'goal',
      channel: 'channel',
      funnelStage: 'funnelStage',
      tone: 'tone',
      contentFormat: 'contentFormat',
      variants: 'content'
    };
    const name = target.getAttribute?.('name') || '';
    const id = target.id || '';
    if (name && fieldMap[name]) return { nodeId: state.selectedPrimary, field: fieldMap[name] };
    if (id.includes('title')) return { nodeId: state.selectedPrimary, field: 'title' };
    if (id.includes('content') || id.includes('caption') || id.includes('preview')) return { nodeId: state.selectedPrimary, field: 'content' };
    if (id.includes('hashtag')) return { nodeId: state.selectedPrimary, field: 'tags' };
    if (id.includes('audience')) return { nodeId: state.selectedPrimary, field: 'audience' };
    if (id.includes('goal')) return { nodeId: state.selectedPrimary, field: 'goal' };
    if (id.includes('channel')) return { nodeId: state.selectedPrimary, field: 'channel' };
    if (id.includes('funnel')) return { nodeId: state.selectedPrimary, field: 'funnelStage' };
    if (id.includes('tone')) return { nodeId: state.selectedPrimary, field: 'tone' };
    if (id.includes('platform')) return { nodeId: state.selectedPrimary, field: 'platform' };
    if (id.includes('format')) return { nodeId: state.selectedPrimary, field: 'contentFormat' };
    if (id.includes('image')) return { nodeId: state.selectedPrimary, field: 'media' };
    if (target.matches?.('textarea')) return { nodeId: state.selectedPrimary, field: 'textarea' };
    return { nodeId: state.selectedPrimary, field: 'content' };
  }
  return null;
}

function handleEditingPresenceEvent(event) {
  if (state.boardAccess?.canEdit === false) return;
  const info = editingInfoFromTarget(event.target);
  if (!info) return;
  setLocalEditingPresence(info.nodeId, info.field, { notifyDelayMs: event.type === 'focusin' ? 150 : 650 });
}

function bindEditingPresenceTracking() {
  [el.nodeForm, el.zoomLayer].forEach((root) => {
    if (!root) return;
    root.addEventListener('focusin', handleEditingPresenceEvent);
    root.addEventListener('input', handleEditingPresenceEvent);
    root.addEventListener('focusout', (event) => {
      if (!editingInfoFromTarget(event.target)) return;
      setTimeout(() => {
        const activeInfo = editingInfoFromTarget(document.activeElement);
        if (!activeInfo || activeInfo.nodeId !== state.presenceEditingNodeId) clearLocalEditingPresence({ notifyDelayMs: 250 });
      }, 80);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearLocalEditingPresence({ notifyDelayMs: 0 });
      clearLocalCursorPresence({ notifyDelayMs: 0 });
    }
  });
  window.addEventListener('pagehide', () => {
    clearLocalEditingPresence({ notifyDelayMs: 0 });
    clearLocalCursorPresence({ notifyDelayMs: 0 });
  });
}

function startPresenceLite() {
  stopPresenceLite();
  if (!state.user?.email) {
    state.presenceViewers = [];
    refreshOwnershipDisplays();
    renderPresenceLite();
    clearNodePresenceBadges();
    return;
  }
  void pingPresenceLite();
  state.presencePollTimer = setInterval(() => { void pingPresenceLite(); }, 20000);
}

function remoteTimestampIsNewer(remoteUpdatedAt) {
  if (!remoteUpdatedAt || remoteUpdatedAt === state.lastKnownUpdatedAt) return false;
  if (state.lastLocalSaveAt && Date.parse(remoteUpdatedAt) <= Date.parse(state.lastLocalSaveAt)) return false;
  if (state.lastKnownUpdatedAt && Date.parse(remoteUpdatedAt) <= Date.parse(state.lastKnownUpdatedAt)) return false;
  return true;
}

function getActivelyEditedNodeIds() {
  const ids = new Set();
  const active = document.activeElement;
  if (!active) return ids;

  const isEditableControl = active.matches?.('input,textarea,select,[contenteditable="true"]');
  if (!isEditableControl) return ids;

  const activeNodeEl = active.closest?.('.node[data-id]');
  if (activeNodeEl?.dataset?.id) ids.add(activeNodeEl.dataset.id);

  if (el.nodeForm?.contains(active) && state.selectedPrimary) ids.add(state.selectedPrimary);

  return ids;
}

function stableRemoteNodeSignature(node) {
  return JSON.stringify(sanitizeNodeForPersistence(node));
}

function patchNodeFromRemote(localNode, remoteNode) {
  const safeRemote = sanitizeNodeForPersistence(remoteNode);
  Object.keys(localNode).forEach((key) => {
    if (key !== 'id' && !(key in safeRemote)) delete localNode[key];
  });
  Object.entries(safeRemote).forEach(([key, value]) => {
    if (key === 'id') return;
    localNode[key] = value;
  });
}

function pulseRemoteNodeUpdate(nodeId) {
  const nodeEl = el.zoomLayer?.querySelector(`[data-id='${nodeId}']`);
  if (!nodeEl) return;
  nodeEl.classList.remove('remote-updated');
  void nodeEl.offsetWidth;
  nodeEl.classList.add('remote-updated');
  setTimeout(() => nodeEl.classList.remove('remote-updated'), 1000);
}

function mergeRemoteBoardState(remoteCanvasState, remoteUpdatedAt) {
  const normalizedState = withBoardSchemaDefaults(remoteCanvasState);
  const incomingNodes = (normalizedState.nodes || []).map((node) => sanitizeNodeForPersistence(node));
  const activeEditingIds = getActivelyEditedNodeIds();
  const localById = new Map(state.nodes.map((node) => [node.id, node]));
  let changedNodeCount = 0;
  let addedNodeCount = 0;
  let skippedNodeCount = 0;

  state.canvasMetadata = { ...normalizedState.metadata };
  state.nodeCounter = Math.max(state.nodeCounter || 1, normalizedState.nodeCounter || 1);
  state.postitCounter = Math.max(state.postitCounter || 1, normalizedState.postitCounter || 1);
  const hasRemoteActivityFeed = Array.isArray(remoteCanvasState?.activityFeed);
  const incomingActivityFeed = hasRemoteActivityFeed ? sanitizeActivityFeed(normalizedState.activityFeed) : state.activityFeed;
  const activityChanged = hasRemoteActivityFeed && JSON.stringify(incomingActivityFeed) !== JSON.stringify(state.activityFeed);
  if (activityChanged) {
    state.activityFeed = incomingActivityFeed;
    renderActivityFeed();
  }

  incomingNodes.forEach((remoteNode) => {
    const localNode = localById.get(remoteNode.id);
    if (!localNode) {
      state.nodes.push(remoteNode);
      renderNode(remoteNode);
      pulseRemoteNodeUpdate(remoteNode.id);
      addedNodeCount += 1;
      return;
    }

    if (stableRemoteNodeSignature(localNode) === stableRemoteNodeSignature(remoteNode)) {
      state.remoteMergeSkippedNodeIds.delete(remoteNode.id);
      return;
    }

    if (activeEditingIds.has(remoteNode.id)) {
      state.remoteMergeSkippedNodeIds.add(remoteNode.id);
      skippedNodeCount += 1;
      return;
    }

    patchNodeFromRemote(localNode, remoteNode);
    updateNodeCard(localNode);
    pulseRemoteNodeUpdate(localNode.id);
    state.remoteMergeSkippedNodeIds.delete(localNode.id);
    changedNodeCount += 1;
  });

  const incomingEdgesSignature = JSON.stringify(normalizedState.edges || []);
  const localEdgesSignature = JSON.stringify(state.edges || []);
  if (incomingEdgesSignature !== localEdgesSignature) {
    state.edges = normalizedState.edges || [];
    drawLinks();
  }

  if (changedNodeCount || addedNodeCount) {
    updateListView();
    updateEmptyState();
    renderNodePresenceBadges({ force: true });
    if (state.selectedPrimary && !activeEditingIds.has(state.selectedPrimary)) {
      fillInspector(getNode(state.selectedPrimary));
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
    if (!state.isDirty) {
      refreshLastSavedSnapshot();
      setSaveStatus('Updated from collaborator');
    }
  }

  if (activityChanged && !changedNodeCount && !addedNodeCount) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeState()));
    if (!state.isDirty) refreshLastSavedSnapshot();
  }

  if (!skippedNodeCount) {
    state.lastKnownUpdatedAt = remoteUpdatedAt || state.lastKnownUpdatedAt;
    setSharePanelState(state.currentBoardId, remoteUpdatedAt ? new Date(remoteUpdatedAt) : null, state.currentBoardOwnerEmail, state.currentBoardOwnerName, state.currentBoardOwnerAvatar);
  }
}


async function pollBoardForRemoteChanges() {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || state.boardRefreshInFlight || state.isSaving || state.conflictModalOpen || state.initialServerLoadInFlight) return;
  state.boardRefreshInFlight = true;
  try {
    const response = await fetch(`/api/boards/${encodeURIComponent(boardId)}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to refresh board');
    if ((state.currentBoardId || getBoardIdFromPath()) !== boardId) return;
    const remoteUpdatedAt = data?.updated_at || null;
    if (!remoteTimestampIsNewer(remoteUpdatedAt)) {
      applyBoardAccessFromServer(data?.access, "pollBoardForRemoteChanges");
      return;
    }
    const incomingCanvasState = data?.canvas_json || {};
    if (!isValidCanvasStatePayload(incomingCanvasState)) {
      applyBoardAccessFromServer(data?.access, "pollBoardForRemoteChanges");
      return;
    }
    mergeRemoteBoardState(incomingCanvasState, remoteUpdatedAt);
    applyBoardAccessFromServer(data?.access, "pollBoardForRemoteChanges");
  } catch (error) {
    console.debug('[Funklix Collaboration] Passive board refresh skipped', error);
  } finally {
    state.boardRefreshInFlight = false;
  }
}

function setAuthMessage(message = "") {
  if (!el.authMessage) return;
  el.authMessage.textContent = message;
  el.authMessage.classList.toggle("hidden", !message);
}

function renderAuthState() {
  const signedIn = !!state.user;
  if (el.googleSigninButton) el.googleSigninButton.style.display = signedIn ? "none" : "inline-flex";
  if (el.authUserWrap) el.authUserWrap.style.display = signedIn ? "inline-flex" : "none";
  if (!signedIn) {
    if (el.authAvatar) el.authAvatar.classList.add("hidden");
    if (el.authAvatarFallback) el.authAvatarFallback.classList.add("hidden");
    return;
  }
  el.authName.textContent = state.user.name || "Google user";
  el.authEmail.textContent = state.user.email || "";
  const hasAvatar = !!state.user.avatar;
  if (el.authAvatar) {
    el.authAvatar.src = hasAvatar ? state.user.avatar : "";
    el.authAvatar.classList.toggle("hidden", !hasAvatar);
  }
  if (el.authAvatarFallback) {
    el.authAvatarFallback.textContent = getUserInitials(state.user);
    el.authAvatarFallback.classList.toggle("hidden", hasAvatar);
  }
}

async function loadSessionUser() {
  try {
    const response = await fetch('/api/auth/session');
    if (!response.ok) return;
    const data = await response.json();
    state.user = data?.user || null;
    state.authConfigured = data?.authConfigured !== false;
  } catch (_error) {
    state.user = null;
  }
  updateBoardAccessState();
  renderAuthState();
  setSharePanelState(state.currentBoardId || getBoardIdFromPath(), null, state.currentBoardOwnerEmail, state.currentBoardOwnerName, state.currentBoardOwnerAvatar);
  startPresenceLite();
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

function viewportPresenceCenter() {
  return {
    x: (el.canvas.scrollLeft + el.canvas.clientWidth / 2) / state.zoom,
    y: (el.canvas.scrollTop + el.canvas.clientHeight / 2) / state.zoom
  };
}

function roundedPresenceNumber(value) {
  return Number.isFinite(value) ? Math.round(value) : null;
}

function cursorPresencePayload() {
  const center = viewportPresenceCenter();
  return {
    cursorX: roundedPresenceNumber(state.presenceCursorX),
    cursorY: roundedPresenceNumber(state.presenceCursorY),
    viewportCenterX: roundedPresenceNumber(center.x),
    viewportCenterY: roundedPresenceNumber(center.y),
    hoveredNodeId: state.presenceCursorHoveredNodeId || null
  };
}

function ensureCursorPresenceLayer() {
  if (!el.canvasScrollSurface) return null;
  let layer = el.canvasScrollSurface.querySelector('.collab-cursor-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.className = 'collab-cursor-layer';
    el.canvasScrollSurface.appendChild(layer);
  }
  return layer;
}

function clearCollaboratorCursors() {
  if (state.presenceCursorRenderFrame) {
    cancelAnimationFrame(state.presenceCursorRenderFrame);
    state.presenceCursorRenderFrame = null;
  }
  el.canvasScrollSurface?.querySelector('.collab-cursor-layer')?.remove();
}

function getRemoteCursorViewers() {
  const viewers = Array.isArray(state.presenceViewers) ? state.presenceViewers : [];
  const currentUserEmail = (state.user?.email || '').toLowerCase();
  const now = Date.now();
  return viewers.filter((viewer) => {
    const viewerEmail = String(viewer?.email || '').toLowerCase();
    if (!viewerEmail || viewerEmail === currentUserEmail) return false;
    if (!Number.isFinite(viewer.cursorX) || !Number.isFinite(viewer.cursorY)) return false;
    const lastCursorAt = Number(viewer.cursorUpdatedAt || viewer.lastInteractionAt || 0);
    if (lastCursorAt && now - lastCursorAt > 15000) return false;
    return true;
  });
}

function renderCollaboratorCursors() {
  state.presenceCursorRenderFrame = null;
  const layer = ensureCursorPresenceLayer();
  if (!layer) return;
  const viewers = getRemoteCursorViewers();
  if (!viewers.length) {
    layer.innerHTML = '';
    return;
  }
  layer.innerHTML = '';
  viewers.slice(0, 8).forEach((viewer) => {
    const cursor = document.createElement('div');
    cursor.className = 'collab-cursor';
    const name = getViewerDisplayName(viewer);
    const status = formatCollaboratorSpatialStatus(viewer);
    cursor.title = status ? `${name} · ${status}` : name;
    cursor.setAttribute('aria-label', cursor.title);
    cursor.style.transform = `translate(${Math.round(viewer.cursorX * state.zoom)}px, ${Math.round(viewer.cursorY * state.zoom)}px)`;

    const pointer = document.createElement('span');
    pointer.className = 'collab-cursor-pointer';
    pointer.textContent = '➤';

    const pill = document.createElement('span');
    pill.className = 'collab-cursor-pill';
    if (viewer?.avatar) {
      const img = document.createElement('img');
      img.src = viewer.avatar;
      img.alt = name;
      pill.appendChild(img);
    } else {
      const initials = document.createElement('span');
      initials.className = 'collab-cursor-initials';
      initials.textContent = getViewerInitials(viewer);
      pill.appendChild(initials);
    }
    const label = document.createElement('span');
    label.className = 'collab-cursor-name';
    label.textContent = status ? `${name} · ${status}` : name;
    pill.appendChild(label);

    cursor.append(pointer, pill);
    layer.appendChild(cursor);
  });
}

function scheduleCollaboratorCursorRender() {
  if (state.presenceCursorRenderFrame) return;
  state.presenceCursorRenderFrame = requestAnimationFrame(renderCollaboratorCursors);
}

function clearLocalCursorPresence({ notifyDelayMs = 0 } = {}) {
  if (state.presenceCursorClearTimer) {
    clearTimeout(state.presenceCursorClearTimer);
    state.presenceCursorClearTimer = null;
  }
  if (state.presenceCursorPublishTimer) {
    clearTimeout(state.presenceCursorPublishTimer);
    state.presenceCursorPublishTimer = null;
  }
  if (state.presenceCursorX === null && state.presenceCursorY === null && !state.presenceCursorHoveredNodeId) return;
  state.presenceCursorX = null;
  state.presenceCursorY = null;
  state.presenceCursorHoveredNodeId = null;
  state.presenceCursorLastMovedAt = null;
  notifyPresenceSelectionMaybe(notifyDelayMs);
}

function scheduleCursorPresencePublish(delayMs = 180) {
  if (!state.user?.email || !(state.currentBoardId || getBoardIdFromPath()) || document.hidden) return;
  if (state.presenceCursorPublishTimer) return;
  state.presenceCursorPublishTimer = setTimeout(() => {
    state.presenceCursorPublishTimer = null;
    notifyPresenceSelectionMaybe(0);
  }, delayMs);
}

function handleLocalCursorMove(event) {
  if (!state.user?.email || document.hidden || el.canvas.classList.contains('hidden')) return;
  const point = boardPointFromClient(event.clientX, event.clientY);
  const hoveredNodeId = event.target.closest?.('.node[data-id]')?.dataset?.id || null;
  state.presenceCursorX = point.x;
  state.presenceCursorY = point.y;
  state.presenceCursorHoveredNodeId = hoveredNodeId;
  state.presenceCursorLastMovedAt = Date.now();
  if (state.presenceCursorClearTimer) clearTimeout(state.presenceCursorClearTimer);
  state.presenceCursorClearTimer = setTimeout(() => clearLocalCursorPresence({ notifyDelayMs: 0 }), 9000);
  scheduleCursorPresencePublish(160);
}

function handleViewportPresenceChange() {
  scheduleCollaboratorCursorRender();
  scheduleCursorPresencePublish(240);
}

function visibleBoardBounds() {
  const left = el.canvas.scrollLeft / state.zoom;
  const top = el.canvas.scrollTop / state.zoom;
  const width = el.canvas.clientWidth / state.zoom;
  const height = el.canvas.clientHeight / state.zoom;
  return { left, top, width, height, right: left + width, bottom: top + height };
}

function getBoardContentBounds({ includeMargin = 120 } = {}) {
  if (!el.zoomLayer) return null;
  const nodes = [...el.zoomLayer.querySelectorAll('.node[data-id]')];
  if (!nodes.length) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  nodes.forEach((nodeEl) => {
    const node = getNode(nodeEl.dataset.id);
    const x = Number.isFinite(node?.position?.x) ? node.position.x : nodeEl.offsetLeft;
    const y = Number.isFinite(node?.position?.y) ? node.position.y : nodeEl.offsetTop;
    const width = nodeEl.offsetWidth || NODE_WIDTH;
    const height = nodeEl.offsetHeight || NODE_HEIGHT;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  });

  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return null;
  const margin = Math.max(0, Number(includeMargin) || 0);
  minX -= margin;
  minY -= margin;
  maxX += margin;
  maxY += margin;
  const width = maxX - minX;
  const height = maxY - minY;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2
  };
}

function scrollBoardContentIntoView({ padding = 120 } = {}) {
  const bounds = getBoardContentBounds({ includeMargin: padding });
  if (!bounds) return false;
  const visible = visibleBoardBounds();
  const centerOutside = bounds.centerX < visible.left || bounds.centerX > visible.right || bounds.centerY < visible.top || bounds.centerY > visible.bottom;
  const boundsOutside = bounds.minX < visible.left || bounds.maxX > visible.right || bounds.minY < visible.top || bounds.maxY > visible.bottom;
  if (!centerOutside && !boundsOutside) return false;

  const nextLeft = Math.max(0, bounds.centerX * state.zoom - el.canvas.clientWidth / 2);
  const nextTop = Math.max(0, bounds.centerY * state.zoom - el.canvas.clientHeight / 2);
  el.canvas.scrollTo({ left: nextLeft, top: nextTop, behavior: 'smooth' });
  return true;
}

function applyCanvasZoom(nextZoom) {
  if (!Number.isFinite(nextZoom)) return false;
  state.zoom = nextZoom;
  el.zoomLayer.style.transform = `scale(${state.zoom})`;
  el.zoomLayer.style.transformOrigin = "0 0";
  el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
  return true;
}

function updateCanvasScrollSurfaceSize() {
  const surface = el.canvasScrollSurface || document.getElementById("canvas-scroll-surface");
  if (!surface) return false;

  const bounds = getBoardContentBounds({ includeMargin: 400 });
  const safeZoom = Number.isFinite(state.zoom) && state.zoom > 0 ? state.zoom : 1;
  const zoomExpansion = Math.max(1, 1 / safeZoom);
  const safeWidth = bounds
    ? Math.max(BOARD_WIDTH, Math.ceil((bounds.maxX + 4000) * zoomExpansion))
    : BOARD_WIDTH;
  const safeHeight = bounds
    ? Math.max(BOARD_HEIGHT, Math.ceil((bounds.maxY + 4000) * zoomExpansion))
    : BOARD_HEIGHT;

  surface.style.width = `${safeWidth}px`;
  surface.style.height = `${safeHeight}px`;

  if (typeof window !== "undefined" && window.DEBUG_CANVAS_SCROLL) {
    console.log("[CanvasSurface]", {
      zoom: state.zoom,
      safeWidth,
      safeHeight,
      bounds
    });
  }

  return true;
}

function getCanvasScrollDebugMetrics(label = "debug", extra = {}) {
  const canvas = el.canvas;
  const zoomLayer = el.zoomLayer;
  const canvasScrollSurface = el.canvasScrollSurface || document.getElementById("canvas-scroll-surface");
  const canvasStyle = canvas ? getComputedStyle(canvas) : null;
  const surfaceStyle = canvasScrollSurface ? getComputedStyle(canvasScrollSurface) : null;
  const zoomLayerStyle = zoomLayer ? getComputedStyle(zoomLayer) : null;
  const bounds = getBoardContentBounds({ includeMargin: 160 });
  const visible = visibleBoardBounds();

  return {
    label,
    zoom: state.zoom,
    canvasClientHeight: canvas?.clientHeight ?? null,
    canvasScrollHeight: canvas?.scrollHeight ?? null,
    canvasScrollTop: canvas?.scrollTop ?? null,
    canvasMaxScrollTop: canvas ? canvas.scrollHeight - canvas.clientHeight : null,
    canvasClientWidth: canvas?.clientWidth ?? null,
    canvasScrollWidth: canvas?.scrollWidth ?? null,
    canvasScrollLeft: canvas?.scrollLeft ?? null,
    canvasMaxScrollLeft: canvas ? canvas.scrollWidth - canvas.clientWidth : null,
    zoomLayerOffsetHeight: zoomLayer?.offsetHeight ?? null,
    zoomLayerScrollHeight: zoomLayer?.scrollHeight ?? null,
    zoomLayerRectHeight: zoomLayer?.getBoundingClientRect?.().height ?? null,
    zoomLayerStyleHeight: zoomLayer?.style?.height || null,
    canvasScrollSurfaceOffsetHeight: canvasScrollSurface?.offsetHeight ?? null,
    canvasScrollSurfaceRectHeight: canvasScrollSurface?.getBoundingClientRect?.().height ?? null,
    canvasComputedHeight: canvasStyle?.height || null,
    canvasScrollSurfaceComputedHeight: surfaceStyle?.height || null,
    zoomLayerComputedHeight: zoomLayerStyle?.height || null,
    contentBounds: bounds,
    visibleBounds: visible,
    ...extra
  };
}

function debugCanvasScrollState(label = "debug", extra = {}) {
  const metrics = getCanvasScrollDebugMetrics(label, extra);
  console.table(metrics);
  console.log("[Funklix Canvas Scroll Debug]", metrics);
  return metrics;
}

if (typeof window !== "undefined") {
  window.debugCanvasScrollState = debugCanvasScrollState;
}

function fitBoardContentToViewport({ padding = 120, minZoom = 0.12, maxZoom = 1, behavior = "smooth" } = {}) {
  const bounds = getBoardContentBounds({ includeMargin: padding });
  if (!bounds || !bounds.width || !bounds.height) return false;
  const canvasWidth = el.canvas.clientWidth;
  const canvasHeight = el.canvas.clientHeight;
  if (!canvasWidth || !canvasHeight) return false;

  const fitZoom = Math.min(canvasWidth / bounds.width, canvasHeight / bounds.height);
  const targetZoom = Math.min(maxZoom, Math.max(minZoom, fitZoom));
  if (!applyCanvasZoom(targetZoom)) return false;
  updateCanvasScrollSurfaceSize();
  const nextLeft = Math.max(0, bounds.centerX * targetZoom - canvasWidth / 2);
  const nextTop = Math.max(0, bounds.centerY * targetZoom - canvasHeight / 2);
  const maxScrollTopBefore = Math.max(0, el.canvas.scrollHeight - el.canvas.clientHeight);
  const maxScrollLeftBefore = Math.max(0, el.canvas.scrollWidth - el.canvas.clientWidth);
  if (window.DEBUG_CANVAS_SCROLL) {
    debugCanvasScrollState("fit-before-scroll", {
      bounds,
      targetZoom,
      requestedScrollLeft: nextLeft,
      requestedScrollTop: nextTop,
      maxScrollTopBefore,
      maxScrollLeftBefore
    });
  }
  el.canvas.scrollTo({ left: nextLeft, top: nextTop, behavior });
  if (window.DEBUG_CANVAS_SCROLL) {
    requestAnimationFrame(() => {
      const actualScrollTop = el.canvas.scrollTop;
      const actualScrollLeft = el.canvas.scrollLeft;
      debugCanvasScrollState("fit-after-scroll", {
        bounds,
        targetZoom,
        requestedScrollLeft: nextLeft,
        requestedScrollTop: nextTop,
        actualScrollLeft,
        actualScrollTop,
        scrollLeftDiffersFromRequested: Math.abs(actualScrollLeft - nextLeft) > 1,
        scrollTopDiffersFromRequested: Math.abs(actualScrollTop - nextTop) > 1,
        requestedTopExceededMaxBefore: nextTop > maxScrollTopBefore,
        requestedLeftExceededMaxBefore: nextLeft > maxScrollLeftBefore
      });
    });
  }
  drawLinks();
  scheduleCollaboratorCursorRender();
  handleViewportPresenceChange();
  return true;
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

function ownerIdentityDebugCandidate(identity, label) {
  if (!identity) return null;
  return {
    source: identity.source || label,
    email: normalizeOwnerEmail(identity.email),
    name: normalizeOwnerName(identity.name),
    avatar: normalizeOwnerAvatar(identity.avatar),
    role: identity.role || ""
  };
}

function traceOwnerIdentityForNode(nodeId = state.selectedPrimary) {
  const node = getNode(nodeId);
  if (!node) {
    const availableOwnedNodes = state.nodes
      .filter((candidate) => normalizeOwnerEmail(candidate.ownerEmail))
      .map((candidate) => ({ id: candidate.id, title: candidate.title || candidate.type || "", ownerEmail: candidate.ownerEmail }));
    const missingResult = { error: `Node not found: ${nodeId || "(none selected)"}`, availableOwnedNodes };
    console.warn("[Funklix Owner Identity Debug] Node not found", missingResult);
    return missingResult;
  }

  const ownerEmail = normalizeOwnerEmail(node.ownerEmail);
  const candidates = {
    editor: ownerIdentityDebugCandidate(findEditorOwnerIdentity(ownerEmail), "editor"),
    presence: ownerIdentityDebugCandidate(findPresenceOwnerIdentity(ownerEmail), "presence"),
    boardOwner: ownerIdentityDebugCandidate(findBoardOwnerIdentity(ownerEmail), "boardOwner"),
    currentUser: ownerIdentityDebugCandidate(findCurrentUserOwnerIdentity(ownerEmail), "currentUser"),
    nodeFallback: ownerIdentityDebugCandidate({
      source: "nodeFallback",
      email: ownerEmail,
      name: isFallbackOwnerName(node.ownerName, ownerEmail) ? "" : node.ownerName,
      avatar: node.ownerAvatar,
      role: "stored node owner"
    }, "nodeFallback"),
    emailFallback: ownerEmail ? { source: "emailFallback", email: ownerEmail, name: ownerEmail, avatar: "", role: "fallback" } : null
  };
  const priority = ["editor", "presence", "boardOwner", "currentUser", "nodeFallback", "emailFallback"];
  const nameWinner = priority.find((key) => normalizeOwnerName(candidates[key]?.name)) || null;
  const avatarWinner = priority.find((key) => normalizeOwnerAvatar(candidates[key]?.avatar)) || null;
  const finalIdentity = resolveOwnerIdentity(node);
  const result = {
    node: {
      id: node.id,
      title: node.title || "",
      ownerEmail: node.ownerEmail || "",
      ownerName: node.ownerName || "",
      ownerAvatar: node.ownerAvatar || ""
    },
    matches: {
      boardEditors: (Array.isArray(state.boardEditors) ? state.boardEditors : [])
        .filter((editor) => normalizeOwnerEmail(editor?.email) === ownerEmail),
      presenceViewers: (Array.isArray(state.presenceViewers) ? state.presenceViewers : [])
        .filter((viewer) => normalizeOwnerEmail(viewer?.email) === ownerEmail)
    },
    candidates,
    winners: {
      name: nameWinner ? candidates[nameWinner] : null,
      avatar: avatarWinner ? candidates[avatarWinner] : null,
      primarySource: avatarWinner || nameWinner || (ownerEmail ? "emailFallback" : null)
    },
    finalIdentity,
    stateSnapshot: {
      boardEditors: state.boardEditors,
      presenceViewers: state.presenceViewers,
      currentUser: state.user,
      boardOwner: {
        email: state.currentBoardOwnerEmail,
        name: state.currentBoardOwnerName,
        avatar: state.currentBoardOwnerAvatar
      }
    }
  };
  console.group(`[Funklix Owner Identity Debug] ${node.id}`);
  console.log("node owner fields", result.node);
  console.log("matching editor records", result.matches.boardEditors);
  console.log("matching presence viewers", result.matches.presenceViewers);
  console.log("candidate identities", result.candidates);
  console.log("winning sources", result.winners);
  console.log("final resolved identity", result.finalIdentity);
  console.groupEnd();
  return result;
}

if (typeof window !== "undefined") {
  window.debugOwnerIdentity = traceOwnerIdentityForNode;
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
  renderNodePresenceBadges({ force: true });
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
  if (state.isBoardLoading) { return; }
  if (state.isSaving) { return; }
  if (state.conflictModalOpen) { return; }

  const currentSnapshot = JSON.stringify(serializeState());
  if (currentSnapshot !== state.lastSavedSnapshot) {
    if (!state.isDirty) {
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
  }
}

function scheduleAutosave() {
  if (state.conflictModalOpen) { return; }
  if (state.autosavePausedUntilChange) { return; }
  if (state.boardAccess?.canEdit === false) { return; }
  if (state.isSaving) { return; }
  if (state.autosaveTimer) return;
  console.debug('[Funklix Save Debug] Autosave scheduled', {
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    lastKnownUpdatedAt: state.lastKnownUpdatedAt,
    currentBoardId: state.currentBoardId || getBoardIdFromPath()
  });
  state.autosaveTimer = setTimeout(() => {
    state.autosaveTimer = null;
    console.debug('[Funklix Save Debug] Autosave fired', {
      isDirty: state.isDirty,
      isSaving: state.isSaving,
      lastKnownUpdatedAt: state.lastKnownUpdatedAt,
      currentBoardId: state.currentBoardId || getBoardIdFromPath()
    });
    if (!state.isDirty) { return; }
    if (state.isSaving) { return; }
    if (state.conflictModalOpen) { return; }
    if (state.autosavePausedUntilChange) { return; }
    saveBoardToServer('autosave');
  }, 3000);
}

function setSaveStatus(text) { el.saveStatus.textContent = text; }

function isBoardReadOnly() {
  return state.boardAccess?.canEdit === false;
}

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

function sanitizeNodeForPersistence(node) {
  const clean = { ...node, images: sanitizeNodeImages(node.images) };
  clean.status = normalizeNodeStatus(clean.status);
  const ownerEmail = normalizeOwnerEmail(clean.ownerEmail);
  if (ownerEmail) {
    clean.ownerEmail = ownerEmail;
    const ownerName = normalizeOwnerName(clean.ownerName);
    if (ownerName) clean.ownerName = ownerName;
    else delete clean.ownerName;
    const ownerAvatar = normalizeOwnerAvatar(clean.ownerAvatar);
    if (ownerAvatar) clean.ownerAvatar = ownerAvatar;
    else delete clean.ownerAvatar;
  } else {
    delete clean.ownerEmail;
    delete clean.ownerName;
    delete clean.ownerAvatar;
  }
  delete clean.isGeneratingContentPack;
  delete clean.generatingContentPack;
  delete clean.isGenerating;
  delete clean.loading;
  delete clean.generationStatus;
  delete clean.disabled;
  delete clean.contentPackError;
  return clean;
}

function getContentPackLoading(nodeId) {
  return !!state.contentPackLoadingById[nodeId];
}

function setContentPackGenerating(nodeId, value) {
  if (!nodeId) return;
  state.contentPackLoadingById[nodeId] = !!value;
}

function setContentPackError(nodeId, message = "") {
  if (!nodeId) return;
  state.contentPackErrorById[nodeId] = message || "";
}


function getPlatformTone(platform = "LinkedIn") {
  const tones = {
    "LinkedIn": { accent: "#5167d8", soft: "#eef1ff", label: "LinkedIn" },
    "X / Twitter": { accent: "#4d5d78", soft: "#eef1f6", label: "X" },
    "Instagram": { accent: "#a15fd1", soft: "#f7efff", label: "Instagram" },
    "TikTok": { accent: "#2f8e88", soft: "#eaf8f6", label: "TikTok" }
  };
  return tones[platform] || { accent: "#62709a", soft: "#f3f5ff", label: platform || "Social" };
}

function formatScheduleMeta(isoString) {
  if (!isoString) return null;
  const when = new Date(isoString);
  if (Number.isNaN(when.getTime())) return null;
  return {
    dateLabel: when.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    timeLabel: when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  };
}
function platformPromptGuidance(platform = "LinkedIn") {
  if (platform === "X / Twitter") return "Platform: X/Twitter. Keep it short, punchy, hook-first, and 280-char aware. Concise CTA. Avoid hashtags unless useful.";
  if (platform === "Instagram") return "Platform: Instagram. Visual-first, emotional, community-oriented tone. CTA should invite comments/saves/shares. Hashtags allowed but not excessive.";
  if (platform === "TikTok") return "Platform: TikTok. Short, energetic, hook-driven, video-native phrasing. CTA should invite watch/comment/follow/remix.";
  return "Platform: LinkedIn. Professional, structured, thought-leadership tone. Can be longer. Avoid excessive hashtags. CTA should invite discussion/action.";
}

function normalizeHashtagsInput(value = "") {
  const tokens = String(value)
    .split(/[\n,]+/g)
    .flatMap((part) => part.trim().split(/\s+/g))
    .map((raw) => raw.replace(/^#+/, "").replace(/[^\p{L}\p{N}_ ]/gu, "").trim())
    .filter(Boolean)
    .map((raw) => {
      const words = raw.split(/\s+/).filter(Boolean);
      const camel = words.map((w, i) => (i === 0 ? w : `${w.charAt(0).toUpperCase()}${w.slice(1)}`)).join("");
      return `#${camel}`;
    });
  return [...new Set(tokens)];
}

function structuredHashtagPrompt(platform = "LinkedIn") {
  const platformHint = platform === "Instagram"
    ? "For Instagram, you may include 4-6 if relevant."
    : platform === "TikTok"
      ? "For TikTok, keep them short/trendy and focused."
      : platform === "X / Twitter"
        ? "For X/Twitter, use 3 concise hashtags max."
        : "For LinkedIn, use 3 strategic hashtags max.";
  return `Generate strategic marketing hashtags only in this structure: (1) one broad/general hashtag, (2) one medium-specific hashtag, (3) one highly specific campaign hashtag. Minimum 3 hashtags. Never convert full sentences into hashtags. Never hashtag every word. No labels/explanations. Return hashtags only, comma-separated. ${platformHint}`;
}

function finalizeGeneratedHashtags(rawValue = "", platform = "LinkedIn") {
  const stopwords = new Set(["the", "and", "for", "with", "your", "into", "from", "this", "that", "you", "are", "our", "turn"]);
  let tags = normalizeHashtagsInput(rawValue).filter((tag) => {
    const core = tag.replace(/^#/, "");
    return core.length >= 3 && !stopwords.has(core.toLowerCase());
  });
  const maxByPlatform = platform === "Instagram" ? 6 : platform === "TikTok" ? 5 : 3;
  if (tags.length > maxByPlatform) tags = tags.slice(0, maxByPlatform);
  if (tags.length < 3) tags = [...new Set([...tags, "#Marketing", "#ContentStrategy", "#CampaignLaunch"])].slice(0, 3);
  return tags;
}

function buildContentImagePrompt(title = "", content = "") {
  const brand = state.brandCore || {};
  const mood = Array.isArray(brand.toneOfVoice) ? brand.toneOfVoice.slice(0, 2).join(", ") : "confident, modern";
  const context = [brand.valueProposition, title, content].filter(Boolean).join(" · ");
  return `16:9 campaign visual. Subject: ${title || "core offer"}. Context: ${context}. Composition: clear focal subject, balanced layout, ample negative space for headline overlay. Mood/style: ${mood}. High-quality realistic marketing visual.`;
}

function nodeStrategyContext(node) {
  if (!node) return "";
  return [
    node.tone ? `Tone: ${node.tone}` : "",
    node.goal ? `Goal: ${node.goal}` : "",
    node.audience ? `Audience: ${node.audience}` : "",
    node.channel ? `Channel: ${node.channel}` : "",
    node.funnelStage ? `Funnel Stage: ${node.funnelStage}` : ""
  ].filter(Boolean).join(" | ");
}

function getConnectedNodeContext(currentNodeId) {
  const parentIds = state.edges.filter((edge) => (Array.isArray(edge) ? edge[1] : edge?.target) === currentNodeId).map((edge) => (Array.isArray(edge) ? edge[0] : edge?.source));
  const childIds = state.edges.filter((edge) => (Array.isArray(edge) ? edge[0] : edge?.source) === currentNodeId).map((edge) => (Array.isArray(edge) ? edge[1] : edge?.target));
  const parentNodes = parentIds.map(getNode).filter(Boolean);
  const childNodes = childIds.map(getNode).filter(Boolean);
  const siblingIds = parentIds.flatMap((pid) => state.edges.filter((edge) => (Array.isArray(edge) ? edge[0] : edge?.source) === pid).map((edge) => (Array.isArray(edge) ? edge[1] : edge?.target))).filter((id) => id && id !== currentNodeId);
  const siblingNodes = [...new Map(siblingIds.map((id) => [id, getNode(id)])).values()].filter(Boolean);
  const slim = (n) => ({
    id: n.id, type: n.type, title: n.title, content: n.content,
    audience: n.audience, goal: n.goal, channel: n.channel, funnelStage: n.funnelStage, tone: n.tone,
    imagePrompt: n.imagePrompt || "",
    social: n.type === "Social Media Posting" ? { platform: n.social?.platform, caption: n.social?.caption, cta: n.social?.preview, hashtags: n.social?.hashtags } : undefined,
    landing: n.type === "Landing Page" ? { headerClaim: n.landingPage?.headerClaim, problemOfIcp: n.landingPage?.problem, solutionForIcp: n.landingPage?.solution, conversionCta: n.landingPage?.cta } : undefined
  });
  return { parentNodes: parentNodes.map(slim), childNodes: childNodes.map(slim), siblingNodes: siblingNodes.map(slim) };
}

function analyzeCampaign(nodes, edges, brandCore) {
  const stages = ["Awareness", "Interest", "Consideration", "Conversion", "Retention"];
  const derivedStages = nodes.flatMap((n) => {
    const out = [];
    if (n.funnelStage) out.push(n.funnelStage);
    if (n.type === "Idea") out.push("Awareness");
    if (n.type === "Content") out.push("Interest");
    if (n.type === "Social Media Posting") out.push("Awareness");
    if (n.type === "Landing Page" || n.goal === "Conversion" || n.funnelStage === "Conversion" || (n.landingPage?.cta || "").trim()) out.push("Conversion");
    return out;
  });
  const coveredStages = [...new Set(derivedStages.filter(Boolean))];
  const missingStages = stages.filter((s) => !coveredStages.includes(s));
  const socialNodes = nodes.filter((n) => n.type === "Social Media Posting");
  const ctas = nodes.map((n) => n.landingPage?.cta || n.social?.preview || "").filter(Boolean);
  const uniqueCtas = new Set(ctas.map((v) => v.toLowerCase()));
  const audienceSet = new Set(nodes.map((n) => (n.audience || "").trim()).filter(Boolean));
  const toneSet = new Set(nodes.map((n) => (n.tone || "").trim()).filter(Boolean));
  const trustNodes = nodes.filter((n) => n.type === "Landing Page" && (n.landingPage?.trust || "").trim().length > 0);
  const platformCounts = socialNodes.reduce((acc, n) => { const p = n.social?.platform || "Unknown"; acc[p] = (acc[p] || 0) + 1; return acc; }, {});
  const healthScore = Math.max(0, Math.min(100, Math.round(
    40 + (coveredStages.length / stages.length) * 25 + (trustNodes.length ? 10 : 0) + (uniqueCtas.size >= 2 ? 10 : 0) + (audienceSet.size <= 1 ? 10 : 0) + (toneSet.size <= 2 ? 5 : 0)
  )));
  return {
    healthScore,
    funnel: { coveredStages, missingStages, confidence: Math.round((coveredStages.length / stages.length) * 100) },
    platformDistribution: { counts: platformCounts, summary: `${socialNodes.length} social nodes across ${Object.keys(platformCounts).length || 0} platforms` },
    cta: { qualityScore: Math.round((uniqueCtas.size / Math.max(ctas.length, 1)) * 100), warnings: ctas.length ? [] : ["Missing CTA"], suggestions: uniqueCtas.size < 2 ? ["Add CTA variations for different stages."] : [] },
    icp: { consistencyScore: audienceSet.size <= 1 ? 90 : 55, inconsistencies: audienceSet.size > 1 ? [...audienceSet] : [] },
    tone: { consistencyScore: toneSet.size <= 1 ? 90 : toneSet.size <= 2 ? 75 : 50, warnings: toneSet.size > 2 ? ["Tone shifts across nodes are high."] : [] },
    trust: { score: trustNodes.length ? 80 : 35, suggestions: trustNodes.length ? [] : ["Add trust-building proof in Landing Page nodes."] },
    strengths: [coveredStages.length >= 3 ? "Good funnel stage coverage." : "", socialNodes.length >= 2 ? "Multi-platform social presence." : ""].filter(Boolean),
    weaknesses: [missingStages.length > 0 ? `Missing stages: ${missingStages.join(", ")}` : "", audienceSet.size > 1 ? "Audience/ICP varies across nodes." : ""].filter(Boolean),
    suggestions: ["Strengthen conversion-oriented CTA where missing.", "Keep ICP and tone aligned across connected nodes."]
  };
}

function suggestNextNodes(analysis, nodes, edges, brandCore) {
  const primaryAudience = brandCore?.personas?.[0]?.name || "Primary ICP";
  const tone = Array.isArray(brandCore?.toneOfVoice) ? brandCore.toneOfVoice[0] || "Professional" : "Professional";
  const suggestions = [];
  const landingNodes = nodes.filter((n) => n.type === "Landing Page");
  const hasStrongLanding = landingNodes.some((n) => {
    const lp = n.landingPage || {};
    return !!((lp.cta || "").trim() && (lp.solution || "").trim() && (n.goal === "Conversion" || n.funnelStage === "Conversion"));
  });
  if (analysis.funnel.missingStages.includes("Conversion") && !landingNodes.length) {
    suggestions.push({ id: "s-conv-lp", title: "Add conversion landing page", description: "Create a conversion destination for interested traffic.", recommendedNodeType: "Landing Page", reason: "Campaign has upper-funnel assets but no strong conversion endpoint.", priority: "high", suggestedPositionContext: "after-consideration", suggestedStrategy: { audience: primaryAudience, goal: "Conversion", channel: "Landing Page", funnelStage: "Conversion", tone } });
  } else if (hasStrongLanding) {
    const lp = landingNodes[0];
    if (!(lp.landingPage?.cta || "").trim()) suggestions.push({ id: "s-improve-lp-cta", title: "Improve landing page CTA", description: "Strengthen the conversion step on your current landing page.", recommendedNodeType: "Landing Page", reason: "Landing page exists, but CTA can be stronger.", priority: "medium", suggestedPositionContext: "near-landing", suggestedStrategy: { audience: primaryAudience, goal: "Conversion", channel: "Landing Page", funnelStage: "Conversion", tone } });
    if (!(lp.landingPage?.trust || "").trim()) suggestions.push({ id: "s-lp-trust", title: "Strengthen trust section", description: "Add stronger social proof and credibility cues.", recommendedNodeType: "Content", reason: "Landing conversion layer needs trust reinforcement.", priority: "medium", suggestedPositionContext: "near-landing", suggestedStrategy: { audience: primaryAudience, goal: "Consideration", channel: "Blog", funnelStage: "Consideration", tone: "Professional" } });
  }
  if (analysis.trust.score < 60) {
    suggestions.push({ id: "s-trust-content", title: "Add trust-building content", description: "Add proof and credibility messaging.", recommendedNodeType: "Content", reason: "Trust layer is weak in current campaign structure.", priority: "medium", suggestedPositionContext: "near-landing", suggestedStrategy: { audience: primaryAudience, goal: "Consideration", channel: "Blog", funnelStage: "Consideration", tone: "Professional" } });
  }
  if ((Object.keys(analysis.platformDistribution.counts || {}).length || 0) < 2) {
    suggestions.push({ id: "s-platform-var", title: "Create platform variation", description: "Expand to another social platform.", recommendedNodeType: "Social Media Posting", reason: "Platform spread is narrow.", priority: "medium", suggestedPositionContext: "after-content", suggestedStrategy: { audience: primaryAudience, goal: "Awareness", channel: "LinkedIn", funnelStage: "Awareness", tone: "Direct" } });
  }
  if (analysis.cta.qualityScore < 50) {
    suggestions.push({ id: "s-cta-social", title: "Add CTA-focused social post", description: "Create a clear next-step social output.", recommendedNodeType: "Social Media Posting", reason: "CTA quality and variation are currently weak.", priority: "high", suggestedPositionContext: "after-social", suggestedStrategy: { audience: primaryAudience, goal: "Lead Gen", channel: "Instagram", funnelStage: "Conversion", tone: "Direct" } });
  }
  const unique = [...new Map(suggestions.map((s) => [s.id, s])).values()];
  if (!unique.length) {
    unique.push({ id: "s-safe-variation", title: `Variation: ${tone}-focused ${primaryAudience} angle`, description: "Create a campaign variation with a distinct messaging angle and rationale.", recommendedNodeType: "Campaign Variation", reason: "Your core campaign is in place. A variation helps compare message-performance fit.", priority: "medium", suggestedPositionContext: "after-social", suggestedStrategy: { audience: primaryAudience, goal: "Awareness", channel: "Campaign Strategy", funnelStage: "Interest", tone } });
  }
  return unique.slice(0, 6);
}

async function createSuggestedNodeFromAnalysis(suggestion) {
  const base = state.nodes[state.nodes.length - 1];
  const pos = base ? { x: base.position.x + 340, y: base.position.y + 40 } : { x: 620, y: 420 };
  const node = createNode({ type: suggestion.recommendedNodeType, position: pos });
  node.title = suggestion.title;
  node.content = suggestion.description;
  node.audience = suggestion.suggestedStrategy?.audience || "";
  node.goal = suggestion.suggestedStrategy?.goal || "";
  node.channel = suggestion.suggestedStrategy?.channel || "";
  node.funnelStage = suggestion.suggestedStrategy?.funnelStage || "";
  node.tone = suggestion.suggestedStrategy?.tone || "";
  const suggestionTitle = (suggestion.title || "").toLowerCase();
  const wantsCampaignVariation = suggestion.recommendedNodeType === "Campaign Variation" || suggestionTitle.includes("campaign variation") || suggestionTitle.startsWith("variation:");
  if (wantsCampaignVariation) {
    node.type = "Campaign Variation";
    const angleSeed = (suggestion.suggestedStrategy?.tone || tone || "Strategic").replace(/\s+/g, "-").toLowerCase();
    const audienceSeed = (suggestion.suggestedStrategy?.audience || primaryAudience || "ICP").split(/[\s,/]+/).filter(Boolean).slice(0,2).join(" ");
    node.title = suggestion.title?.startsWith("Variation:") ? suggestion.title : `Variation: ${suggestion.suggestedStrategy?.tone || "Trust-first"} ${audienceSeed} angle`;
    node.content = `Angle: ${angleSeed}. Audience: ${suggestion.suggestedStrategy?.audience || primaryAudience}. Goal: ${suggestion.suggestedStrategy?.goal || "Awareness"}. Rationale: ${suggestion.reason}. Next step: create one supporting content node and one social execution node.`;
  }
  try {
    const contextPrompt = `Campaign context: ${getCampaignContextSummary()}. Suggestion reason: ${suggestion.reason}.`;
    if (node.type === "Content") {
      const refined = await refineNodeWithAI(node, `Write a specific trust-building or conversion-supporting content brief. ${contextPrompt}`);
      node.title = refined?.title || node.title;
      node.content = refined?.content || node.content;
      node.imagePrompt = buildContentImagePrompt(node.title, node.content);
    }
    if (node.type === "Social Media Posting") {
      node.social.platform = suggestion.suggestedStrategy?.channel || "LinkedIn";
      const guide = platformPromptGuidance(node.social.platform);
      const caption = await refineNodeWithAI(node, `Create a high-quality ${node.social.platform} caption aligned to campaign context. ${guide} ${contextPrompt} Return in caption.`);
      const cta = await refineNodeWithAI(node, `Create a conversion-focused CTA aligned to campaign context. ${guide} ${contextPrompt} Return in content.`);
      const hashtags = await refineNodeWithAI(node, `${structuredHashtagPrompt(node.social.platform)} ${guide} ${contextPrompt}`);
      node.social.caption = (caption?.caption || caption?.content || node.social.caption || "").trim();
      node.social.preview = (cta?.content || cta?.caption || "Learn more").trim();
      node.social.hashtags = finalizeGeneratedHashtags(hashtags?.caption || hashtags?.content || "", node.social.platform);
      node.content = node.social.caption;
    }
    if (node.type === "Landing Page") {
      const claim = await refineNodeWithAI(node, `Write a specific conversion headline for the landing page. ${contextPrompt} Return in content.`);
      const problem = await refineNodeWithAI(node, `Write the ICP problem statement clearly and specifically. ${contextPrompt} Return in content.`);
      const solution = await refineNodeWithAI(node, `Write the solution/value proposition clearly and specifically. ${contextPrompt} Return in content.`);
      const trust = await refineNodeWithAI(node, `Write trust-building copy without fake metrics/testimonials unless provided in context. ${contextPrompt} Return in content.`);
      const cta = await refineNodeWithAI(node, `Write a concise conversion CTA line. ${contextPrompt} Return in content.`);
      node.landingPage = {
        headerVisualPrompt: buildContentImagePrompt(node.title, solution?.content || node.content),
        headerClaim: claim?.content || node.title,
        problem: problem?.content || node.content,
        solution: solution?.content || node.content,
        trust: trust?.content || "Trusted by teams looking for clearer, more effective campaign execution.",
        cta: cta?.content || "Get started"
      };
      node.content = [node.landingPage.headerClaim, node.landingPage.solution].filter(Boolean).join(" — ");
    }
  } catch (_error) {
    if (node.type === "Content") node.imagePrompt = buildContentImagePrompt(node.title, node.content);
    if (node.type === "Social Media Posting") {
      node.social.platform = suggestion.suggestedStrategy?.channel || "LinkedIn";
      node.social.caption = `${suggestion.title} for ${node.audience}`.trim();
      node.social.preview = "Learn more";
      node.social.hashtags = finalizeGeneratedHashtags(`#Marketing,#${(node.channel || "Campaign").replace(/[^A-Za-z0-9]/g, "")},#NextStep`, node.social.platform);
    }
    if (node.type === "Landing Page") node.landingPage = { headerVisualPrompt: buildContentImagePrompt(node.title, node.content), headerClaim: node.title, problem: node.content, solution: node.content, trust: "Trusted by teams looking for clearer, more effective campaign execution.", cta: "Get started" };
  }
  const parent = state.nodes.find((n) => n.funnelStage === "Consideration") || state.nodes.find((n) => n.type === "Content") || null;
  if (parent && parent.id !== node.id) addEdge(parent.id, node.id);
  state.selectedIds.clear();
  state.selectedIds.add(node.id);
  state.selectedPrimary = node.id;
  updateSelectionClasses();
  fillInspector(node);
  setActiveView("board");
  renderCampaignCanvasFromStateIfNeeded();
  saveCampaignCanvasState();
  setSaveStatus("Suggested node created");
}

function renderCampaignIntelligence() {
  const a = analyzeCampaign(state.nodes, state.edges, state.brandCore);
  const suggestions = suggestNextNodes(a, state.nodes, state.edges, state.brandCore);
  if (el.insightsCards) {
    const funnelSteps = ["Awareness", "Interest", "Consideration", "Conversion", "Retention"]
      .map((step) => `<span class="insight-step ${a.funnel.coveredStages.includes(step) ? "covered" : "missing"}">${step}</span>`).join("");
    el.insightsCards.innerHTML = `
      <div class="insights-grid">
        <article class="insight-card hero"><small>Campaign Health Score</small><h3>${a.healthScore}<span>/100</span></h3><p>${a.strengths[0] || "Campaign baseline established."}</p></article>
        <article class="insight-card"><small>Funnel Coverage</small><div class="insight-funnel">${funnelSteps}</div><p>Missing: ${a.funnel.missingStages.join(", ") || "None"}</p></article>
        <article class="insight-card"><small>Platform Distribution</small><h4>${a.platformDistribution.summary}</h4><p>${Object.entries(a.platformDistribution.counts).map(([k,v]) => `${k}: ${v}`).join(" · ") || "No platforms yet"}</p></article>
        <article class="insight-card"><small>CTA Quality</small><h4>${a.cta.qualityScore}/100</h4><p>${a.cta.suggestions[0] || "CTA diversity looks healthy."}</p></article>
        <article class="insight-card"><small>ICP Consistency</small><h4>${a.icp.consistencyScore}/100</h4><p>${a.icp.inconsistencies.join(" · ") || "Strong ICP consistency across nodes."}</p></article>
        <article class="insight-card"><small>Tone Consistency</small><h4>${a.tone.consistencyScore}/100</h4><p>${a.tone.warnings[0] || "Tone alignment looks stable."}</p></article>
        <article class="insight-card"><small>Trust Layer</small><h4>${a.trust.score}/100</h4><p>${a.trust.suggestions[0] || "Trust coverage is present."}</p></article>
      </div>
      <div class="insight-card" style="margin-top:12px"><small>Recommended Next Steps</small>
        <div class="insight-suggestion-list">${suggestions.slice(0,3).map((s) => `<div class="insight-suggestion-item"><div><strong>${s.title}</strong><small>${s.recommendedNodeType} · ${s.priority}</small><p>${s.reason}</p></div><button type="button" data-suggestion-id="${s.id}">Create node</button></div>`).join("") || "<p>No suggestions right now.</p>"}</div>
      </div>
    `;
    el.insightsCards.querySelectorAll("[data-suggestion-id]").forEach((btn) => btn.addEventListener("click", async () => {
      const suggestion = suggestions.find((s) => s.id === btn.getAttribute("data-suggestion-id"));
      if (suggestion) await createSuggestedNodeFromAnalysis(suggestion);
    }));
  }
  if (el.aiBrainSummary) {
    el.aiBrainSummary.innerHTML = `
      <section class="ai-brain-wrap">
        <header class="ai-brain-header"><h3>🧠 AI Brain</h3><p>Your AI strategist & creative partner<br/><small>Last updated: ${state.analysisLastUpdatedAt ? new Date(state.analysisLastUpdatedAt).toLocaleTimeString() : "—"}</small>${state.analysisError ? `<span class="ai-inline-error">${state.analysisError}</span>` : ""}</p><button type="button" id="refresh-ai-brain" class="${state.analysisRefreshing ? "is-loading" : ""}" ${state.analysisRefreshing ? "disabled" : ""}>${state.analysisRefreshing ? `<span class="spinner" aria-hidden="true"></span>Refreshing...` : "Refresh analysis"}</button></header>
        <article class="ai-summary-card"><small>Campaign Summary</small><h2>${a.healthScore}<span>/100</span></h2><p>This campaign focuses on <strong>${a.funnel.coveredStages.join(", ") || "early-stage planning"}</strong>, with primary opportunities in <strong>${a.funnel.missingStages.join(", ") || "execution depth"}</strong>.</p></article>
        <div class="ai-columns">
          <article class="ai-list-card"><h4>Detected Issues</h4><ul>${(a.weaknesses.length ? a.weaknesses : ["No critical issues detected."]).map((w) => `<li>⚠️ ${w}</li>`).join("")}</ul></article>
          <article class="ai-list-card"><h4>Suggestions</h4><ul>${a.suggestions.map((s) => `<li>💡 ${s}</li>`).join("")}</ul></article>
        </div>
        <article class="ai-list-card"><h4>Suggested Next Nodes</h4><div class="insight-suggestion-list">${suggestions.map((s) => `<div class="insight-suggestion-item"><div><strong>${s.title}</strong><small>${s.recommendedNodeType} · ${s.priority}</small><p>${s.reason}</p></div><button type="button" data-suggestion-id="${s.id}">Create node</button></div>`).join("") || "<p>No suggestions right now.</p>"}</div></article>
        <article class="ai-actions-card"><h4>Quick Actions</h4><div class="ai-action-grid"><button type="button">Improve CTAs</button><button type="button">Generate Conversion Content</button><button type="button">Strengthen Trust Layer</button><button type="button">Create Platform Variations</button></div></article>
      </section>
    `;
    el.aiBrainSummary.querySelector("#refresh-ai-brain")?.addEventListener("click", async () => {
      state.analysisRefreshing = true;
      state.analysisError = "";
      renderCampaignIntelligence();
      try {
        await new Promise((r) => setTimeout(r, 500));
        renderCampaignIntelligence();
        state.analysisLastUpdatedAt = Date.now();
      } catch (_error) {
        state.analysisError = "Could not refresh analysis. Please try again.";
      } finally {
        state.analysisRefreshing = false;
        renderCampaignIntelligence();
      }
    });
    el.aiBrainSummary.querySelectorAll("[data-suggestion-id]").forEach((btn) => btn.addEventListener("click", async () => {
      const suggestion = suggestions.find((s) => s.id === btn.getAttribute("data-suggestion-id"));
      if (suggestion) await createSuggestedNodeFromAnalysis(suggestion);
    }));
  }
}

async function regenerateSocialForPlatform(node, triggerBtn = null) {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  if (!node || node.type !== "Social Media Posting") return;
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  const originalText = triggerBtn?.textContent || "";
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "...";
  }
  if (nodeEl) nodeEl.classList.add("ai-loading");
  try {
    const guide = platformPromptGuidance(node.social.platform || "LinkedIn");
    const strategy = nodeStrategyContext(node);
    const captionRefined = await refineNodeWithAI(node, `Write one social-media-ready caption for this node. ${guide} ${strategy} Return in caption.`);
    const ctaRefined = await refineNodeWithAI(node, `Write one concise CTA for this node. ${guide} ${strategy} Return in content.`);
    const hashtagsRefined = await refineNodeWithAI(node, `${structuredHashtagPrompt(node.social.platform || "LinkedIn")} ${guide} ${strategy}`);
    node.social.caption = (captionRefined?.caption || captionRefined?.content || "").trim() || node.social.caption;
    node.social.preview = (ctaRefined?.content || ctaRefined?.caption || "").trim() || node.social.preview;
    node.social.hashtags = finalizeGeneratedHashtags(hashtagsRefined?.caption || hashtagsRefined?.content || "", node.social.platform || "LinkedIn");
    updateNodeCard(node);
    fillInspector(node);
    saveCampaignCanvasState();
  } finally {
    if (nodeEl) nodeEl.classList.remove("ai-loading");
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalText;
    }
  }
}

function serializeState() {
  // Keep serialization stable for dirty checks; do not mutate updatedAt on every call.
  const serialized = {
    nodes: state.nodes.map((n) => sanitizeNodeForPersistence(n)),
    edges: state.edges, nodeCounter: state.nodeCounter, postitCounter: state.postitCounter, zoom: state.zoom,
    activityFeed: sanitizeActivityFeed(state.activityFeed),
    schemaVersion: 1,
    metadata: {
      createdAt: state.canvasMetadata?.createdAt || null,
      updatedAt: state.canvasMetadata?.updatedAt || null
    }
  };
  const selectedNode = state.selectedPrimary ? serialized.nodes.find((n) => n.id === state.selectedPrimary) : null;
  console.log("serialized images", selectedNode?.images || []);
  return serialized;
}
function saveCampaignCanvasState() { const campaignState = serializeState(); console.log("Saving campaignCanvasState", campaignState); localStorage.setItem(STORAGE_KEY, JSON.stringify(campaignState)); setSaveStatus("Saved"); renderCampaignIntelligence(); }
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
  applyCampaignState(withBoardSchemaDefaults(campaignState), "Restored from local storage");
  return true;
}


function withBoardSchemaDefaults(campaignState) {
  // Backward-compatible normalization: older boards may not have schemaVersion/metadata yet.
  const safeState = campaignState && typeof campaignState === "object" ? campaignState : {};
  const nowIso = new Date().toISOString();
  return {
    ...safeState,
    activityFeed: sanitizeActivityFeed(safeState.activityFeed),
    schemaVersion: Number.isFinite(safeState.schemaVersion) ? safeState.schemaVersion : 1,
    metadata: {
      createdAt: safeState?.metadata?.createdAt || nowIso,
      updatedAt: safeState?.metadata?.updatedAt || nowIso
    }
  };
}

function isValidCanvasStatePayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value.nodes !== undefined && !Array.isArray(value.nodes)) return false;
  if (value.edges !== undefined && !Array.isArray(value.edges)) return false;
  if (value.zoom !== undefined) {
    const zoomValue = typeof value.zoom === "object" && value.zoom !== null ? (value.zoom.zoom ?? value.zoom.scale) : value.zoom;
    if (!Number.isFinite(zoomValue)) return false;
  }
  if (value.schemaVersion !== undefined && !Number.isFinite(Number(value.schemaVersion))) return false;
  return true;
}

function applyCampaignState(campaignState, statusText = "Restored") {
  const normalizedState = withBoardSchemaDefaults(campaignState);
  state.canvasMetadata = { ...normalizedState.metadata };
  state.nodes = (normalizedState.nodes || []).map((node) => sanitizeNodeForPersistence(node));
  state.contentPackLoadingById = {};
  state.contentPackErrorById = {};
  state.edges = normalizedState.edges || [];
  state.nodeCounter = normalizedState.nodeCounter || 1;
  state.postitCounter = normalizedState.postitCounter || 1;
  state.activityFeed = sanitizeActivityFeed(normalizedState.activityFeed);
  state.lastSeenActivityAt = parseStoredTimestamp(localStorage.getItem(activitySeenStorageKey()));
  ensureCommentSeenBaseline();
  state.selectedIds.clear();
  state.selectedPrimary = null;
  el.zoomLayer.querySelectorAll(".node").forEach((n) => n.remove());
  state.nodes.forEach(renderNode);
  renderNodePresenceBadges({ force: true });
  renderActivityFeed();
  updateListView();
  updateEmptyState();
  drawLinks();
  if (normalizedState.zoom) setZoom(normalizedState.zoom);
  state.isDirty = false;
  clearAutosaveTimer();
  setSaveStatus(statusText);
  refreshLastSavedSnapshot();
  state.isBoardLoading = false;
}

async function saveBoardToServer(trigger = "manual") {
  if (state.isSaving) {
    console.warn('[Funklix Save Guard] Save already in progress, skipping overlapping save', {
      trigger,
      currentBoardId: state.currentBoardId || getBoardIdFromPath(),
      lastKnownUpdatedAt: state.lastKnownUpdatedAt || null,
      isDirty: state.isDirty
    });
    return false;
  }
  if (!state.boardAccess?.canEdit) {
    setSaveStatus("Read-only board");
    console.warn("[Funklix Access] Save blocked by boardAccess", {
      source: trigger,
      reason: state.boardAccess?.reason || "unknown"
    });
    return false;
  }
  state.latestSaveRequestId += 1;
  const saveRequestId = state.latestSaveRequestId;
  try {
    const canvasStateForSave = serializeState();
    const saveTimestamp = new Date().toISOString();
    canvasStateForSave.metadata = {
      ...(canvasStateForSave.metadata || {}),
      updatedAt: saveTimestamp
    };
    const payload = {
      name: `Campaign Canvas ${new Date().toISOString()}`,
      canvas_json: canvasStateForSave,
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
    if (response.status === 401 && !isUpdate) {
      setAuthMessage("Sign in with Google to create a board.");
      setSaveStatus("Sign in with Google to create a board.");
      return;
    }
    if (response.status === 409 && isUpdate) {
      console.warn('[Funklix Save Debug] Save conflict 409', {
        trigger,
        saveRequestId,
        payloadLastKnownUpdatedAt: payload.lastKnownUpdatedAt || null,
        currentStateLastKnownUpdatedAt: state.lastKnownUpdatedAt || null,
        responseStatus: response.status,
        responseUpdatedAt: data?.updated_at || null,
        responseError: data?.error || null
      });
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
        if (saveRequestId === state.latestSaveRequestId) setSaveStatus('Unsaved changes');
      }
      if (saveRequestId === state.latestSaveRequestId) state.isSaving = false;
      return;
    }
    if (!response.ok) throw new Error(data?.error || 'Failed to save board');
    if (saveRequestId !== state.latestSaveRequestId) {
      console.warn('[Funklix Save Guard] Ignored stale save completion');
      return;
    }
    console.log('Saved board response id:', data?.id);
    const returnedId = data?.id || currentBoardId;
    if (returnedId) state.currentBoardId = returnedId;
    if (data?.name && typeof data.name === "string") state.currentBoardName = data.name;
    state.lastLocalSaveAt = saveTimestamp;
    state.lastKnownUpdatedAt = data?.updated_at || new Date().toISOString();

    const shareUrl = `${window.location.origin}/boards/${returnedId}`;
    state.isDirty = false;
    setSaveStatus('Saved');
    state.canvasMetadata = {
      ...(state.canvasMetadata || {}),
      createdAt: state.canvasMetadata?.createdAt || canvasStateForSave.metadata?.createdAt || null,
      updatedAt: saveTimestamp
    };
    refreshLastSavedSnapshot();
    setSharePanelState(returnedId, new Date(), data?.owner_email || state.currentBoardOwnerEmail || null, data?.owner_name || state.currentBoardOwnerName || null, data?.owner_avatar || state.currentBoardOwnerAvatar || null);
    applyBoardAccessFromServer(data?.access, "saveBoardToServer");

    if (!isUpdate && returnedId) {
      const nextPath = `/boards/${returnedId}`;
      if (window.location.pathname !== nextPath) window.history.pushState({}, '', nextPath);

    }
  } catch (error) {
    console.error(error);
    if (saveRequestId === state.latestSaveRequestId) {
      setSaveStatus('Save failed');
    } else {
      console.warn('[Funklix Save Guard] Ignored stale save failure');
    }
  } finally {
    if (saveRequestId === state.latestSaveRequestId) state.isSaving = false;
  }
}

async function loadBoardFromUrlIfPresent() {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId) return false;
  state.initialServerLoadInFlight = true;
  state.isBoardLoading = true;
  state.currentBoardId = boardId;
  try {
    const response = await fetch(`/api/boards/${boardId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load board');
    state.currentBoardId = data?.id || boardId;
    state.currentBoardName = data?.name || "";
    state.lastKnownUpdatedAt = data?.updated_at || null;
    if (data?.brand_core_snapshot && typeof data.brand_core_snapshot === "object") {
      state.brandCore = data.brand_core_snapshot;
      renderBrandCoreTiles();
      renderBrandCoreEditor();
      saveBrandBrainState();
    }
    setSharePanelState(state.currentBoardId, data?.updated_at ? new Date(data.updated_at) : null, data?.owner_email || null, data?.owner_name || null, data?.owner_avatar || null);
    if (!applyBoardAccessFromServer(data?.access, "loadBoardFromUrlIfPresent")) {
      updateBoardAccessState();
    }
    const incomingCanvasState = data.canvas_json || {};
    if (!isValidCanvasStatePayload(incomingCanvasState)) {
      console.warn('[Funklix Board Load] Invalid canvas_json payload ignored');
      setSaveStatus('Board data is invalid and was ignored.');
      return false;
    }
    const normalizedCanvasState = withBoardSchemaDefaults(incomingCanvasState);
    applyCampaignState(normalizedCanvasState, `Loaded board ${boardId.slice(0, 8)}...`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedCanvasState));
    startPresenceLite();
    startBoardRefreshPolling();
    return true;
  } catch (error) {
    console.error(error);
    setSaveStatus('Board not found or could not be loaded.');
    return false;
  } finally {
    state.initialServerLoadInFlight = false;
    state.isBoardLoading = false;
  }
}

function renderCampaignCanvasFromStateIfNeeded() {
  const domNodes = el.zoomLayer.querySelectorAll(".node").length;
  if (domNodes === 0 && state.nodes.length > 0) {
    state.nodes.forEach(renderNode);
    renderNodePresenceBadges({ force: true });
  }
  updateCanvasScrollSurfaceSize();
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
  renderActivityFeed();
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

  applyCanvasZoom(newZoom);
  updateCanvasScrollSurfaceSize();

  el.canvas.scrollLeft = boardX * state.zoom - (cx - rect.left);
  el.canvas.scrollTop = boardY * state.zoom - (cy - rect.top);

  drawLinks();
  scheduleCollaboratorCursorRender();
  handleViewportPresenceChange();
  saveCampaignCanvasState();
}

function openTypePicker(onSelect, preferred = "Idea") {
  el.pickerOptions.innerHTML = "";
  Object.keys(NODE_TYPES).forEach((type) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.quickWired = "1";
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

function pulseActivityFocusedNode(nodeId) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
  if (!nodeEl) return;
  nodeEl.classList.remove("activity-focused");
  void nodeEl.offsetWidth;
  nodeEl.classList.add("activity-focused");
  setTimeout(() => nodeEl.classList.remove("activity-focused"), 1400);
}

function focusNodeInCanvas(nodeId, { behavior = "smooth", select = true, pulse = true } = {}) {
  const node = getNode(nodeId);
  const nodeEl = node ? el.zoomLayer.querySelector(`[data-id='${nodeId}']`) : null;
  if (!node || !nodeEl || !el.canvas) return false;

  const runFocus = () => {
    updateCanvasScrollSurfaceSize();
    const width = nodeEl.offsetWidth || NODE_WIDTH;
    const height = nodeEl.offsetHeight || NODE_HEIGHT;
    const nodeX = Number.isFinite(node.position?.x) ? node.position.x : nodeEl.offsetLeft;
    const nodeY = Number.isFinite(node.position?.y) ? node.position.y : nodeEl.offsetTop;
    const centerX = (nodeX + width / 2) * state.zoom;
    const centerY = (nodeY + height / 2) * state.zoom;
    const maxLeft = Math.max(0, el.canvas.scrollWidth - el.canvas.clientWidth);
    const maxTop = Math.max(0, el.canvas.scrollHeight - el.canvas.clientHeight);
    const left = Math.max(0, Math.min(maxLeft, centerX - el.canvas.clientWidth / 2));
    const top = Math.max(0, Math.min(maxTop, centerY - el.canvas.clientHeight / 2));

    el.canvas.scrollTo({ left, top, behavior });
    if (select) {
      state.selectedIds.clear();
      state.selectedIds.add(node.id);
      state.selectedPrimary = node.id;
      updateSelectionClasses();
      fillInspector(node);
    }
    if (pulse) requestAnimationFrame(() => pulseActivityFocusedNode(node.id));
  };

  if (state.activeView !== "board") {
    setActiveView("board");
    requestAnimationFrame(runFocus);
  } else {
    runFocus();
  }
  return true;
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
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return null;
  }
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
    status: "Draft",
    tags: [],
    variants: [],
    contentFormat: "1:1",
    audience: "",
    goal: "",
    channel: "",
    funnelStage: "",
    tone: "",
    images: [...images],
    favoriteImageId: null,
    social: { platform: "Instagram", caption: "", hashtags: [], preview: "", scheduledAt: "" },
    imagePrompt: "",
    landingPage: { headerVisualPrompt: "", headerClaim: "", problem: "", solution: "", trust: "", cta: "" },
    reactions: {},
    postits: [],
    compact: false,
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
  appendActivity("node_created", { node });
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

function openSchedulePostModal(nodeId) {
  state.pendingScheduleNodeId = nodeId;
  const node = getNode(nodeId);
  const existing = node?.social?.scheduledAt ? new Date(node.social.scheduledAt) : null;
  if (existing && !Number.isNaN(existing.getTime())) {
    el.postingDateInput.value = existing.toISOString().slice(0, 10);
    el.postingTimeInput.value = `${String(existing.getHours()).padStart(2, "0")}:${String(existing.getMinutes()).padStart(2, "0")}`;
  } else {
    el.postingDateInput.value = "";
    el.postingTimeInput.value = "09:00";
  }
  state.scheduleDate = el.postingDateInput.value || "";
  state.scheduleTime = el.postingTimeInput.value || "09:00";
  el.postingPlanOverlay.classList.remove("hidden");
}

function closePostingPlanner() {
  state.pendingScheduleNodeId = null;
  state.scheduleDate = "";
  state.scheduleTime = "09:00";
  el.postingPlanOverlay.classList.add("hidden");
}

function confirmSchedulePost() {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.pendingScheduleNodeId);
  if (!node) return closePostingPlanner();
  state.scheduleDate = el.postingDateInput.value || "";
  state.scheduleTime = el.postingTimeInput.value || "";
  if (!state.scheduleDate || !state.scheduleTime) return;
  node.social.scheduledDate = state.scheduleDate;
  node.social.scheduledTime = state.scheduleTime;
  node.social.scheduledAt = `${state.scheduleDate}T${state.scheduleTime}:00`;
  node.social.addedToCalendar = true;
  updateNodeCard(node);
  fillInspector(node);
  renderCalendarView();
  saveCampaignCanvasState();
  setSaveStatus("Scheduled in posting calendar");
  closePostingPlanner();
}

function removeNode(nodeId, { logActivity = true } = {}) {
  // Read-only guard: prevent local destructive node mutation on view-only boards.
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return null;
  }
  pushHistorySnapshot();
  const idx = state.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return null;

  const [removed] = state.nodes.splice(idx, 1);
  const removedNodeTitle = activityNodeTitle(removed);
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
  if (logActivity) appendActivity("node_deleted", { nodeId, nodeTitle: removedNodeTitle });
  saveCampaignCanvasState();
  return removed;
}

function edgeActivityTitle(fromId, toId) {
  const sourceTitle = activityNodeTitle(getNode(fromId), fromId || "Source");
  const targetTitle = activityNodeTitle(getNode(toId), toId || "Target");
  return `${sourceTitle} → ${targetTitle}`;
}

function addEdge(fromId, toId) {
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return false;
  }
  pushHistorySnapshot();
  if (!fromId || !toId || fromId === toId) return;
  if (state.edges.some(([a, b]) => a === fromId && b === toId)) return;
  state.edges.push([fromId, toId]);
  appendActivity("edge_connected", { nodeId: toId, nodeTitle: edgeActivityTitle(fromId, toId) });

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
    landingPageStructured: {
      headerVisualPrompt: `16:9 hero visual for ${baseTitle}, modern clean style, confident and trustworthy mood`,
      headerClaim: `${baseTitle}: clearer campaigns, stronger results`,
      problemOfIcp: "Teams struggle to ship consistent, high-performing campaign assets quickly.",
      solutionForIcp: `Use ${baseTitle} messaging and assets to launch with clarity and speed.`,
      buildingTrust: "Trusted by teams looking for clearer, more effective campaign execution.",
      conversionCta: "Get started"
    },
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
  Object.assign(idea, { goal: "Awareness", channel: "Campaign Strategy", funnelStage: "Awareness", audience: state.brandCore?.personas?.[0]?.name || "Primary ICP", tone: "Professional" });
  updateNodeCard(idea);

  const variationA = createNode({ type: "Campaign Variation", position: { x: 320, y: 340 } });
  Object.assign(variationA, { title: variations[0]?.title || "Variation A", content: variations[0]?.content || "" });
  updateNodeCard(variationA);
  const contentA = createNode({ type: "Content", position: { x: 260, y: 560 } });
  Object.assign(contentA, { title: variations[0]?.contentNode?.title || "Content A", content: variations[0]?.contentNode?.content || "" });
  contentA.imagePrompt = buildContentImagePrompt(contentA.title, contentA.content);
  Object.assign(contentA, { goal: "Education", channel: "Blog", funnelStage: "Interest", audience: idea.audience, tone: idea.tone });
  updateNodeCard(contentA);
  const socialA = createNode({ type: "Social Media Posting", position: { x: 220, y: 820 } });
  Object.assign(socialA, { title: variations[0]?.socialPost?.title || "Social A", content: variations[0]?.socialPost?.caption || "" });
  socialA.social.platform = variations[0]?.socialPost?.platform || "Instagram";
  socialA.social.caption = variations[0]?.socialPost?.caption || "";
  socialA.social.hashtags = finalizeGeneratedHashtags(variations[0]?.socialPost?.hashtags || `${socialA.title}, ${socialA.social.caption}`, socialA.social.platform);
  Object.assign(socialA, { goal: "Community", channel: socialA.social.platform, funnelStage: "Awareness", audience: idea.audience, tone: "Emotional" });
  updateNodeCard(socialA);

  const variationB = createNode({ type: "Campaign Variation", position: { x: 900, y: 340 } });
  Object.assign(variationB, { title: variations[1]?.title || "Variation B", content: variations[1]?.content || "" });
  updateNodeCard(variationB);
  const contentB = createNode({ type: "Content", position: { x: 980, y: 560 } });
  Object.assign(contentB, { title: variations[1]?.contentNode?.title || "Content B", content: variations[1]?.contentNode?.content || "" });
  contentB.imagePrompt = buildContentImagePrompt(contentB.title, contentB.content);
  Object.assign(contentB, { goal: "Consideration", channel: "Email", funnelStage: "Consideration", audience: idea.audience, tone: "Direct" });
  updateNodeCard(contentB);
  const socialB = createNode({ type: "Social Media Posting", position: { x: 1040, y: 820 } });
  Object.assign(socialB, { title: variations[1]?.socialPost?.title || "Social B", content: variations[1]?.socialPost?.caption || "" });
  socialB.social.platform = variations[1]?.socialPost?.platform || "Instagram";
  socialB.social.caption = variations[1]?.socialPost?.caption || "";
  socialB.social.hashtags = finalizeGeneratedHashtags(variations[1]?.socialPost?.hashtags || `${socialB.title}, ${socialB.social.caption}`, socialB.social.platform);
  Object.assign(socialB, { goal: "Lead Gen", channel: socialB.social.platform, funnelStage: "Conversion", audience: idea.audience, tone: "Direct" });
  updateNodeCard(socialB);

  const landing = createNode({ type: "Landing Page", position: { x: 520, y: 560 } });
  Object.assign(landing, { title: plan.landingPage?.title || plan.landing?.title || "Landing Page", content: plan.landingPage?.content || plan.landing?.content || "" });
  const lpStructured = plan.landingPageStructured || {};
  landing.landingPage = {
    headerVisualPrompt: lpStructured.headerVisualPrompt || `16:9 hero visual for ${landing.title}: modern product-focused scene, clean composition, confident and trustworthy mood.`,
    headerClaim: lpStructured.headerClaim || landing.title || "High-converting landing page",
    problem: lpStructured.problemOfIcp || (landing.content || "").split("\n")[0] || "Your audience struggles with inconsistent campaign execution.",
    solution: lpStructured.solutionForIcp || (landing.content || "").split("\n")[1] || "Our solution helps teams launch clearer, more effective campaigns faster.",
    trust: lpStructured.buildingTrust || "Trusted by teams looking for clearer, more effective campaign execution.",
    cta: lpStructured.conversionCta || "Get started"
  };
  Object.assign(landing, { goal: "Conversion", channel: "Landing Page", funnelStage: "Conversion", audience: idea.audience, tone: "Professional" });
  updateNodeCard(landing);
  const email = createNode({ type: "Email Campaign", position: { x: 700, y: 560 } });
  Object.assign(email, { title: plan.emailCampaign?.title || plan.email?.title || "Email Campaign", content: plan.emailCampaign?.content || plan.email?.content || "" });
  Object.assign(email, { goal: "Lead Gen", channel: "Email", funnelStage: "Consideration", audience: idea.audience, tone: "Professional" });
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
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      const edgeTitle = edgeActivityTitle(from, to);
      state.edges.splice(edgeIndex, 1);
      appendActivity("edge_disconnected", { nodeId: to, nodeTitle: edgeTitle });
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
  if (!state.selectedPrimary || (state.presenceEditingNodeId && !state.selectedIds.has(state.presenceEditingNodeId))) clearLocalEditingPresence({ notifyDelayMs: 250 });
  renderNodePresenceBadges();
  notifyPresenceSelectionMaybe();
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
  const inspectorNextStepType = selectedNode ? getNextStepNodeType(selectedNode.type) : "";
  const canGenerateInspectorNextStep = hasSingleNode && !!inspectorNextStepType && !isBoardReadOnly();

  el.deleteNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.deleteSelectedButton.style.display = hasMultipleNodes ? "block" : "none";

  el.generateImageButton.style.display = showGenerateImage ? "block" : "none";
  el.generatePostingVisualButton.style.display = showGeneratePostingVisual ? "block" : "none";
  el.generateFullPackButton.style.display = showGenerateImage ? "block" : "none";

  el.improveNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.generateNextStepInspectorButton.style.display = hasSingleNode ? "block" : "none";
  el.regenerateNodeButton.style.display = hasSingleNode ? "block" : "none";
  el.regeneratePlatformButton.style.display = selectedNode?.type === "Social Media Posting" ? "block" : "none";
  el.addToPostingCalendarButton.style.display = selectedNode?.type === "Social Media Posting" ? "block" : "none";
  el.propagateDescendantsButton.style.display = hasSingleNode ? "block" : "none";
  el.disconnectSelectedButton.style.display = selectedCount > 0 ? "block" : "none";

  el.disconnectSelectedButton.textContent = hasSingleNode ? "Disconnect node" : "Disconnect selected";

  el.deleteNodeButton.disabled = !hasSingleNode;
  el.deleteSelectedButton.disabled = !hasMultipleNodes;
  el.improveNodeButton.disabled = !hasSingleNode;
  el.generateNextStepInspectorButton.disabled = !canGenerateInspectorNextStep;
  el.generateNextStepInspectorButton.title = hasSingleNode
    ? (inspectorNextStepType ? (isBoardReadOnly() ? "Read-only board" : `Generate ${inspectorNextStepType}`) : "No next step available")
    : "Select a node";
  el.regenerateNodeButton.disabled = !hasSingleNode;
  el.regeneratePlatformButton.disabled = !(selectedNode?.type === "Social Media Posting");
  el.addToPostingCalendarButton.disabled = !(selectedNode?.type === "Social Media Posting");
  el.generateImageButton.disabled = !showGenerateImage;
  el.generatePostingVisualButton.disabled = !showGeneratePostingVisual;
  el.generateFullPackButton.disabled = !showGenerateImage || !!selectedNode && getContentPackLoading(selectedNode.id);
  if (el.generateHeaderVisualButton) el.generateHeaderVisualButton.disabled = !(selectedNode?.type === "Landing Page");
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

function isCommentActivityType(type = "") {
  return type === "comment_added" || type === "reply_added" || type === "comment_resolved" || type === "postit_added";
}

function noteUpdatedAt(note = {}) {
  return note.updatedAt || note.createdAt || note.time || null;
}

function hasRecentUnopenedComment(node) {
  if (!node?.id || state.commentThreadsOpenedByNode.has(node.id)) return false;
  return hasUnreadNodeComments(node);
}

function openNodeCommentThread(nodeId, { highlight = true } = {}) {
  const node = getNode(nodeId);
  const nodeEl = node ? el.zoomLayer.querySelector(`[data-id='${nodeId}']`) : null;
  if (!node || !nodeEl) return false;
  state.commentThreadsOpenedByNode.add(node.id);
  markNodeCommentsSeen(node.id);
  updateNodeCommentBadge(node, nodeEl);
  nodeEl.classList.add("comments-open");
  if (highlight) {
    nodeEl.classList.add("comments-highlighted");
    setTimeout(() => nodeEl.classList.remove("comments-highlighted"), 1400);
  }
  const firstPostit = nodeEl.querySelector(".postit");
  if (firstPostit) firstPostit.scrollIntoView?.({ block: "nearest", inline: "nearest", behavior: "smooth" });
  return true;
}

function handleActivityEntryFocus(entry) {
  markActivityFeedSeen({ rerender: true });
  if (!entry?.nodeId) return;
  const didFocus = focusNodeInCanvas(entry.nodeId);
  if (!didFocus) return;
  if (isCommentActivityType(entry.type)) {
    setTimeout(() => openNodeCommentThread(entry.nodeId), 180);
  }
}

function updateNodeCommentBadge(node, nodeEl) {
  if (!node || !nodeEl) return;
  let commentBadge = nodeEl.querySelector(".node-comment-badge");
  if (!commentBadge) {
    commentBadge = document.createElement("button");
    commentBadge.type = "button";
    commentBadge.className = "node-comment-badge";
    commentBadge.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!Array.isArray(node.postits) || node.postits.length === 0) {
        if (isBoardReadOnly()) {
          setSaveStatus("Read-only board");
          return;
        }
        addPostitToNode(node, { x: 12, y: 48 });
        return;
      }
      openNodeCommentThread(node.id);
    });
    const actions = nodeEl.querySelector(".node-header-actions");
    if (actions) actions.insertBefore(commentBadge, actions.firstChild);
    else nodeEl.appendChild(commentBadge);
  }
  const unresolvedCount = (node.postits || []).filter((note) => !note.resolved).length;
  const resolvedCount = (node.postits || []).filter((note) => !!note.resolved).length;
  const totalReplyCount = (node.postits || []).reduce((sum, note) => sum + (Array.isArray(note.replies) ? note.replies.length : 0), 0);
  const totalCommentCount = unresolvedCount + resolvedCount + totalReplyCount;
  const displayCount = unresolvedCount || totalCommentCount || 0;
  commentBadge.textContent = `💬 ${displayCount}`;
  commentBadge.title = totalCommentCount ? `${unresolvedCount} unresolved · ${totalReplyCount} replies · ${resolvedCount} resolved` : "Add comment";
  commentBadge.classList.toggle("has-comments", totalCommentCount > 0);
  commentBadge.classList.toggle("has-unresolved", unresolvedCount > 0);
  commentBadge.classList.toggle("has-recent", hasRecentUnopenedComment(node));
  commentBadge.classList.toggle("has-unread", hasUnreadNodeComments(node));
}

function updateNodeStatusChip(node, nodeEl) {
  if (!node || !nodeEl) return;
  const typeEl = nodeEl.querySelector(".type");
  let chip = nodeEl.querySelector(".node-status-chip");
  if (!chip) {
    chip = document.createElement("span");
    chip.className = "node-status-chip";
    if (typeEl) typeEl.insertAdjacentElement("afterend", chip);
    else nodeEl.prepend(chip);
  }
  const status = getNodeStatusDefinition(node.status);
  chip.textContent = status.label;
  chip.dataset.statusTone = status.tone;
  chip.title = `Workflow status: ${status.label}`;
  chip.setAttribute("aria-label", chip.title);
}

function createListStatusChip(node) {
  const status = getNodeStatusDefinition(node.status);
  const chip = document.createElement("span");
  chip.className = "node-status-chip list-status-chip";
  chip.dataset.statusTone = status.tone;
  chip.textContent = status.label;
  chip.title = `Workflow status: ${status.label}`;
  return chip;
}

function getNodeListPreview(node) {
  if (!node) return "";
  const preview = node.type === "Social Media Posting"
    ? (node.social?.caption || node.social?.preview || node.content || node.title || "")
    : node.type === "Landing Page"
      ? (node.landingPage?.headerClaim || node.landingPage?.cta || node.landingPage?.solution || node.content || node.title || "")
      : (node.content || node.title || "");
  return String(preview || "").replace(/\s+/g, " ").trim();
}

function getNodeDiscussionCounts(node) {
  const comments = Array.isArray(node?.postits) ? node.postits : [];
  const unresolved = comments.filter((note) => !note.resolved).length;
  const replies = comments.reduce((sum, note) => sum + (Array.isArray(note.replies) ? note.replies.length : 0), 0);
  return { comments: comments.length, unresolved, replies, total: comments.length + replies };
}

function getNodeListMeta(node) {
  const meta = [node.type];
  if (node.goal) meta.push(`Goal: ${node.goal}`);
  if (node.channel) meta.push(`Channel: ${node.channel}`);
  if (node.funnelStage) meta.push(`Stage: ${node.funnelStage}`);
  if (node.type === "Social Media Posting" && node.social?.platform) meta.push(node.social.platform);
  if (node.type === "Social Media Posting" && node.social?.scheduledAt) {
    const schedule = formatScheduleMeta(node.social.scheduledAt);
    meta.push(schedule ? `Scheduled ${schedule.dateLabel} · ${schedule.timeLabel}` : "Scheduled");
  }
  return meta.filter(Boolean);
}

function focusListViewNode(nodeId, { openComments = false } = {}) {
  const didFocus = focusNodeInCanvas(nodeId);
  if (!didFocus) return;
  if (openComments) setTimeout(() => openNodeCommentThread(nodeId), 180);
}

function isNodeSearchOrFilterActive() {
  return !!state.nodeSearchQuery.trim() || Object.values(state.nodeFilters).some((set) => set.size > 0);
}


function renderOwnerAvatar(parent, name, avatarUrl, className = "owner-avatar") {
  parent.innerHTML = "";
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = `${name} avatar`;
    parent.appendChild(img);
    return;
  }
  const fallback = document.createElement("span");
  fallback.className = `${className}-fallback`;
  fallback.textContent = getOwnerInitials(name);
  parent.appendChild(fallback);
}

function updateNodeOwnerChip(node, nodeEl) {
  const chip = nodeEl.querySelector(".node-owner-chip");
  if (!chip) return;
  const ownerEmail = normalizeOwnerEmail(node.ownerEmail);
  chip.innerHTML = "";
  chip.classList.toggle("hidden", !ownerEmail);
  if (!ownerEmail) {
    chip.removeAttribute("title");
    return;
  }
  const identity = resolveOwnerIdentity(node);
  const name = ownerDisplayLabel(identity);
  chip.title = `Owner: ${name}`;
  if (identity.avatar) {
    chip.classList.add("has-avatar");
    const avatar = document.createElement("span");
    avatar.className = "node-owner-avatar";
    renderOwnerAvatar(avatar, name, identity.avatar, "node-owner-avatar");
    const label = document.createElement("span");
    label.textContent = name;
    chip.append(avatar, label);
  } else {
    chip.classList.remove("has-avatar");
    const icon = document.createElement("span");
    icon.className = "node-owner-icon";
    icon.textContent = "👤";
    const label = document.createElement("span");
    label.textContent = name;
    chip.append(icon, label);
  }
}

function createOwnerDisplay(node, { includeUnassigned = true } = {}) {
  const wrap = document.createElement("span");
  wrap.className = "node-owner-display";
  const identity = resolveOwnerIdentity(node);
  const ownerEmail = identity.email;
  const name = ownerEmail ? ownerDisplayLabel(identity) : "Unassigned";
  if (!ownerEmail && !includeUnassigned) return wrap;
  if (ownerEmail && identity.avatar) {
    const avatar = document.createElement("span");
    avatar.className = "node-owner-avatar";
    renderOwnerAvatar(avatar, name, identity.avatar, "node-owner-avatar");
    wrap.appendChild(avatar);
  } else if (ownerEmail) {
    const icon = document.createElement("span");
    icon.className = "node-owner-icon";
    icon.textContent = "👤";
    wrap.appendChild(icon);
  }
  const text = document.createElement("span");
  text.textContent = name;
  wrap.appendChild(text);
  wrap.title = ownerEmail ? `Owner: ${name}` : "Owner: Unassigned";
  wrap.classList.toggle("is-unassigned", !ownerEmail);
  return wrap;
}

function nodeHasActivePostitEditor(nodeEl) {
  const active = document.activeElement;
  return !!active?.closest?.(".postit") && !!nodeEl?.contains(active);
}

function nodeHasActiveSocialPreviewEditor(nodeEl) {
  const active = document.activeElement;
  return !!nodeEl?.contains(active)
    && !!active?.closest?.(".social-preview")
    && !!active.closest(".social-caption, .social-cta, .social-hashtags");
}

function updateSocialPreviewCharCount(socialRoot, node) {
  const charCount = socialRoot?.querySelector(".social-char-count");
  if (!charCount) return;
  const captionLen = (node.social?.caption || "").length;
  const limits = { "X / Twitter": 280, LinkedIn: 3000, Instagram: 2200, TikTok: 2200 };
  const limit = limits[node.social?.platform] || 3000;
  charCount.textContent = `${captionLen} characters${captionLen > limit ? ` (over ${limit})` : ""}`;
  charCount.classList.toggle("warning", captionLen > limit);
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
  nodeEl.classList.toggle("is-compact", !!node.compact);
  const matchesSearch = nodeMatchesSearchAndFilters(node);
  const hasSearchActive = !!state.nodeSearchQuery.trim() || Object.values(state.nodeFilters).some((set) => set.size > 0);
  nodeEl.classList.toggle("search-match", hasSearchActive && matchesSearch);
  nodeEl.classList.toggle("search-dimmed", hasSearchActive && !matchesSearch);

  nodeEl.querySelector(".type").textContent = node.type;
  nodeEl.querySelector(".type").style.color = tone;
  updateNodeOwnerChip(node, nodeEl);
  updateNodeStatusChip(node, nodeEl);
  nodeEl.classList.toggle("is-in-review", normalizeNodeStatus(node.status) === "In Review");
  const editable = !isBoardReadOnly();
  const compactToggle = nodeEl.querySelector(".node-compact-toggle");
  if (compactToggle) {
    compactToggle.textContent = node.compact ? "↗" : "−";
    compactToggle.title = node.compact ? "Expand node" : "Compact view";
    compactToggle.setAttribute("aria-label", compactToggle.title);
  }
  updateNodeCommentBadge(node, nodeEl);

  const titleEl = nodeEl.querySelector(".title");
  if (document.activeElement !== titleEl) titleEl.textContent = node.title;
  titleEl.contentEditable = editable ? "true" : "false";
  const contentEl = nodeEl.querySelector(".content");
  contentEl.contentEditable = editable ? "true" : "false";
  if (document.activeElement !== contentEl) contentEl.textContent = node.content;
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
        if (isBoardReadOnly()) {
          setSaveStatus("Read-only board");
          return;
        }
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

  const compactSummary = nodeEl.querySelector(".node-compact-summary");
  const compactPreview = node.type === "Landing Page"
    ? (node.landingPage?.headerClaim || node.landingPage?.cta || node.content || "").trim()
    : node.type === "Social Media Posting"
      ? (node.social?.caption || node.title || "").trim()
      : (node.content || node.title || "").trim();
  const compactMeta = [];
  if (node.goal) compactMeta.push(`Goal: ${node.goal}`);
  if (node.audience) compactMeta.push(`Audience: ${node.audience}`);
  if (node.type === "Social Media Posting" && node.social?.platform) compactMeta.push(node.social.platform);
  if (node.type === "Social Media Posting" && node.social?.scheduledAt) compactMeta.push("Scheduled");
  if (node.type === "Landing Page" && node.landingPage?.cta) compactMeta.push(`CTA: ${node.landingPage.cta.slice(0, 24)}${node.landingPage.cta.length > 24 ? "…" : ""}`);
  if (node.type === "Content" && node.imagePrompt) compactMeta.push("Image prompt ready");
  compactSummary.innerHTML = `
    <p class="compact-preview">${compactPreview.slice(0, 100)}${compactPreview.length > 100 ? "…" : ""}</p>
    <div class="compact-meta">${compactMeta.slice(0, 4).map((m) => `<span>${m}</span>`).join("")}</div>
  `;
  const compactThumb = node.images?.[node.images.length - 1]?.url;
  compactSummary.classList.toggle("has-thumb", !!compactThumb);
  compactSummary.style.setProperty("--compact-thumb", compactThumb ? `url('${compactThumb.replace(/'/g, "%27")}')` : "none");

  const social = nodeEl.querySelector(".social-preview");
  const isSocial = node.type === "Social Media Posting";
  const isLandingPage = node.type === "Landing Page";
  const hasActiveSocialPreviewEditor = isSocial && nodeHasActiveSocialPreviewEditor(nodeEl);
  social.classList.toggle("hidden", !(isSocial || isLandingPage));
  if (hasActiveSocialPreviewEditor) {
    updateSocialPreviewCharCount(social, node);
  } else if (isSocial) {
    social.innerHTML = "";
    const wrapper = document.createElement("div");
    wrapper.className = "social-card";

    const top = document.createElement("div");
    top.className = "social-card-top";
    const platformSelect = document.createElement("select");
    platformSelect.className = "social-platform-select";
    ["LinkedIn", "X / Twitter", "Instagram", "TikTok"].forEach((p) => {
      const option = document.createElement("option");
      option.value = p;
      option.textContent = p;
      platformSelect.appendChild(option);
    });
    platformSelect.value = node.social.platform || "LinkedIn";
    platformSelect.addEventListener("click", (event) => event.stopPropagation());
    platformSelect.addEventListener("change", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      node.social.platform = platformSelect.value;
      updateNodeCard(node);
      if (state.selectedPrimary === node.id) fillInspector(node);
      saveCampaignCanvasState();
    });
    const platformRegenBtn = document.createElement("button");
    platformRegenBtn.type = "button";
    platformRegenBtn.className = "social-platform-regen";
    platformRegenBtn.textContent = "Regenerate for platform";
    platformRegenBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await regenerateSocialForPlatform(node, platformRegenBtn);
    });
    const status = document.createElement("span");
    status.className = "social-status-badge";
    status.textContent = "Ready";
    top.append(platformSelect, platformRegenBtn, status);

    const charCount = document.createElement("div");
    charCount.className = "social-char-count";
    const captionLen = (node.social.caption || "").length;
    const limits = { "X / Twitter": 280, LinkedIn: 3000, Instagram: 2200, TikTok: 2200 };
    const limit = limits[node.social.platform] || 3000;
    charCount.textContent = `${captionLen} characters${captionLen > limit ? ` (over ${limit})` : ""}`;
    if (captionLen > limit) charCount.classList.add("warning");

    const caption = document.createElement("div");
    caption.className = "social-caption";
    caption.contentEditable = editable ? "true" : "false";
    caption.textContent = node.social.caption || "";
    caption.addEventListener("click", (event) => event.stopPropagation());
    caption.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      node.social.caption = caption.textContent;
      recordNodeUpdatedActivity(node);
      updateSocialPreviewCharCount(social, node);
      if (state.selectedPrimary === node.id) el.inputs.caption.value = node.social.caption;
      saveCampaignCanvasState();
    });

    const cta = document.createElement("div");
    cta.className = "social-cta";
    cta.contentEditable = editable ? "true" : "false";
    cta.textContent = node.social.preview || "";
    cta.addEventListener("click", (event) => event.stopPropagation());
    cta.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      node.social.preview = cta.textContent;
      recordNodeUpdatedActivity(node);
      if (state.selectedPrimary === node.id && el.inputs.preview) el.inputs.preview.value = node.social.preview;
      saveCampaignCanvasState();
    });

    const hashtags = document.createElement("div");
    hashtags.className = "social-hashtags";
    hashtags.contentEditable = editable ? "true" : "false";
    hashtags.textContent = (node.social.hashtags || []).join(" ");
    hashtags.addEventListener("click", (event) => event.stopPropagation());
    hashtags.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      const rawHashtags = hashtags.textContent || "";
      state.hashtagDraftByNode[node.id] = rawHashtags;
      node.social.hashtags = normalizeHashtagsInput(rawHashtags);
      if (state.selectedPrimary === node.id) el.inputs.hashtags.value = rawHashtags;
      recordNodeUpdatedActivity(node);
      saveCampaignCanvasState();
    });
    hashtags.addEventListener("blur", () => {
      const normalized = normalizeHashtagsInput(state.hashtagDraftByNode[node.id] ?? hashtags.textContent ?? "");
      node.social.hashtags = normalized;
      delete state.hashtagDraftByNode[node.id];
      hashtags.textContent = normalized.join(" ");
      if (state.selectedPrimary === node.id) el.inputs.hashtags.value = normalized.join(", ");
      saveCampaignCanvasState();
    });

    const platformTone = getPlatformTone(node.social.platform || "LinkedIn");
    const scheduledMeta = formatScheduleMeta(node.social.scheduledAt);
    const scheduleMeta = document.createElement("div");
    scheduleMeta.className = "social-schedule-meta";
    if (scheduledMeta) {
      scheduleMeta.innerHTML = `<span class="social-schedule-icon">📅</span><div><small>Scheduled · ${platformTone.label}</small><strong>${scheduledMeta.dateLabel} • ${scheduledMeta.timeLabel}</strong></div>`;
      scheduleMeta.style.borderLeftColor = platformTone.accent;
    }

    const actions = document.createElement("div");
    actions.className = "social-actions-row";
    const copyCaptionBtn = document.createElement("button");
    copyCaptionBtn.type = "button";
    copyCaptionBtn.textContent = "Copy Caption";
    copyCaptionBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await navigator.clipboard.writeText(node.social.caption || "");
      copyCaptionBtn.textContent = "Copied";
      setTimeout(() => { copyCaptionBtn.textContent = "Copy Caption"; }, 900);
    });
    const copyFullBtn = document.createElement("button");
    copyFullBtn.type = "button";
    copyFullBtn.textContent = "Copy Full Post";
    copyFullBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await navigator.clipboard.writeText([node.social.caption || "", node.social.preview || "", (node.social.hashtags || []).join(" ")].filter(Boolean).join("\n\n"));
      copyFullBtn.textContent = "Copied";
      setTimeout(() => { copyFullBtn.textContent = "Copy Full Post"; }, 900);
    });
    const calendarBtn = document.createElement("button");
    calendarBtn.type = "button";
    calendarBtn.textContent = node.social?.scheduledAt ? "Scheduled" : "Add to Posting Calendar";
    calendarBtn.classList.toggle("is-scheduled", !!node.social?.scheduledAt);
    calendarBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      openSchedulePostModal(node.id);
    });

    const regen = async (instruction, key, btn) => {
      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "...";
      try {
        const refined = await refineNodeWithAI(node, `${instruction} ${platformPromptGuidance(node.social.platform || "LinkedIn")}`);
        if (key === "caption") node.social.caption = (refined?.caption || refined?.content || "").trim() || node.social.caption;
        if (key === "cta") node.social.preview = (refined?.content || refined?.caption || "").trim() || node.social.preview;
        if (key === "hashtags") node.social.hashtags = finalizeGeneratedHashtags(refined?.caption || refined?.content || "", node.social.platform || "LinkedIn");
        updateNodeCard(node);
        fillInspector(node);
        saveCampaignCanvasState();
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    };
    const regenCaption = document.createElement("button");
    regenCaption.type = "button"; regenCaption.textContent = "Regenerate Caption";
    regenCaption.addEventListener("click", (event) => { event.stopPropagation(); regen("Write a social-ready caption for this post. Return in caption.", "caption", regenCaption); });
    const regenCTA = document.createElement("button");
    regenCTA.type = "button"; regenCTA.textContent = "Regenerate CTA";
    regenCTA.addEventListener("click", (event) => { event.stopPropagation(); regen("Write one concise CTA line for this post. Return in content.", "cta", regenCTA); });
    const regenHash = document.createElement("button");
    regenHash.type = "button"; regenHash.textContent = "Regenerate Hashtags";
    regenHash.addEventListener("click", (event) => { event.stopPropagation(); regen(structuredHashtagPrompt(node.social.platform || "LinkedIn"), "hashtags", regenHash); });
    actions.append(copyCaptionBtn, copyFullBtn, calendarBtn, regenCaption, regenCTA, regenHash);

    const imageFrame = document.createElement("div");
    imageFrame.className = "social-image-frame";
    const previewImage = node.images?.[node.images.length - 1];
    if (previewImage?.url) {
      const img = document.createElement("img");
      img.src = previewImage.url;
      img.alt = "Social preview";
      img.addEventListener("click", (event) => { event.stopPropagation(); openLightbox(previewImage.url, "Social preview image"); });
      imageFrame.appendChild(img);
    }

    wrapper.append(top, charCount, caption, cta, hashtags, scheduleMeta, imageFrame, actions);
    social.appendChild(wrapper);
  } else if (isLandingPage) {
    const lp = node.landingPage || {};
    social.innerHTML = "";
    const card = document.createElement("div");
    card.className = "landing-preview-card";
    const latestImage = node.images?.[node.images.length - 1];
    if (latestImage?.url) {
      const img = document.createElement("img");
      img.className = "landing-preview-image";
      img.src = latestImage.url;
      img.alt = "Landing header visual";
      img.addEventListener("click", (event) => { event.stopPropagation(); openLightbox(latestImage.url, "Landing header visual"); });
      card.appendChild(img);
    }
    [["Claim", lp.headerClaim], ["Problem", lp.problem], ["Solution", lp.solution], ["Trust", lp.trust], ["CTA", lp.cta]]
      .forEach(([label, value]) => {
        if (!value) return;
        const p = document.createElement("p");
        p.className = `landing-preview-line${label === "CTA" ? " is-cta" : ""}`;
        p.innerHTML = `<strong>${label}:</strong> ${value}`;
        card.appendChild(p);
      });
    social.appendChild(card);
  }

  const statusEl = nodeEl.querySelector(".content-pack-status");
  const isGeneratingPack = getContentPackLoading(node.id);
  const contentPackError = state.contentPackErrorById[node.id] || "";
  statusEl.classList.toggle("hidden", !(isGeneratingPack || contentPackError));
  statusEl.textContent = isGeneratingPack ? "Generating content pack..." : contentPackError;
  statusEl.classList.toggle("error", !!contentPackError);

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
        if (isBoardReadOnly()) {
          setSaveStatus("Read-only board");
          return;
        }
        pushHistorySnapshot();
        node.reactions[emoji] = Math.max(0, (node.reactions[emoji] || 0) - 1);
        if (node.reactions[emoji] === 0) delete node.reactions[emoji];
        updateNodeCard(node);
      });
      bar.appendChild(item);
    });
    const connectorActions = nodeEl.querySelector(".connector-actions");
    if (connectorActions) {
      nodeEl.insertBefore(bar, connectorActions);
    } else {
      nodeEl.appendChild(bar);
    }
  }

  if (!nodeHasActivePostitEditor(nodeEl)) {
    renderPostits(node, nodeEl);
  }
}

function nodeSearchText(node) {
  return [
    node.type,
    node.title,
    node.content,
    node.status,
    node.audience,
    node.goal,
    node.funnelStage,
    node.social?.platform,
    node.social?.caption,
    node.social?.preview,
    (node.social?.hashtags || []).join(" "),
    node.landingPage?.headerClaim,
    node.landingPage?.cta
  ].filter(Boolean).join(" ").toLowerCase();
}

function ownerFilterValue(email) {
  const normalizedEmail = normalizeOwnerEmail(email);
  return normalizedEmail ? `owner:${normalizedEmail}` : "";
}

function nodeMatchesOwnerFilters(node) {
  const ownerFilters = state.nodeFilters.owner;
  if (!ownerFilters?.size) return true;
  const ownerEmail = normalizeOwnerEmail(node?.ownerEmail);
  const currentEmail = normalizeOwnerEmail(state.user?.email);
  return [...ownerFilters].some((value) => {
    if (value === "mine") return !!currentEmail && ownerEmail === currentEmail;
    if (value === "unassigned") return !ownerEmail;
    if (String(value).startsWith("owner:")) {
      const filterEmail = normalizeOwnerEmail(String(value).slice("owner:".length));
      return !!filterEmail && ownerEmail === filterEmail;
    }
    return false;
  });
}

function ownerFilterCandidateLabel(candidate = {}) {
  const identity = resolveOwnerIdentity(candidate);
  return ownerDisplayLabel(identity || candidate);
}

function ownerFilterLabelForValue(value) {
  if (value === "mine") return "Owner: Me";
  if (value === "unassigned") return "Owner: Unassigned";
  if (String(value).startsWith("owner:")) {
    const email = normalizeOwnerEmail(String(value).slice("owner:".length));
    const candidate = getNodeOwnerOptions().find((option) => normalizeOwnerEmail(option.email) === email);
    return `Owner: ${candidate ? ownerFilterCandidateLabel(candidate) : (email || "Unknown")}`;
  }
  return String(value || "");
}

function activeNodeFilterLabels() {
  const labels = [];
  state.nodeFilters.type.forEach((value) => labels.push(`Type: ${value}`));
  state.nodeFilters.platform.forEach((value) => labels.push(`Platform: ${value}`));
  state.nodeFilters.status?.forEach((value) => labels.push(`Status: ${nodeStatusLabel(value)}`));
  state.nodeFilters.owner?.forEach((value) => labels.push(ownerFilterLabelForValue(value)));
  state.nodeFilters.state.forEach((value) => labels.push(`State: ${value}`));
  return labels.filter(Boolean);
}

function nodeMatchesSearchAndFilters(node) {
  const q = state.nodeSearchQuery.trim().toLowerCase();
  if (q && !nodeSearchText(node).includes(q)) return false;
  if (state.nodeFilters.type.size && !state.nodeFilters.type.has(node.type)) return false;
  if (state.nodeFilters.platform.size && !state.nodeFilters.platform.has(node.social?.platform || "")) return false;
  if (state.nodeFilters.status?.size && !state.nodeFilters.status.has(normalizeNodeStatus(node.status))) return false;
  if (!nodeMatchesOwnerFilters(node)) return false;
  if (state.nodeFilters.state.size) {
    const strategyStage = node.strategy?.funnelStage || "";
    const states = new Set([
      node.social?.scheduledAt ? "scheduled" : "",
      (node.goal || "").toLowerCase(),
      (node.funnelStage || "").toLowerCase(),
      String(strategyStage).toLowerCase()
    ]);
    if (![...state.nodeFilters.state].some((s) => states.has(s))) return false;
  }
  return true;
}

function refreshNodeSearchUI() {
  const hasSearchActive = !!state.nodeSearchQuery.trim() || Object.values(state.nodeFilters).some((set) => set.size > 0);
  let matches = 0;
  state.nodes.forEach((node) => {
    if (nodeMatchesSearchAndFilters(node)) matches += 1;
    updateNodeCard(node);
  });
  if (el.nodeSearchCount) {
    el.nodeSearchCount.textContent = hasSearchActive ? `${matches} matches` : "";
    if (hasSearchActive && matches === 0) el.nodeSearchCount.textContent = "No matching nodes";
  }
  if (el.filtersToggleButton) {
    const labels = activeNodeFilterLabels();
    const activeFilters = labels.length;
    el.filtersToggleButton.textContent = activeFilters > 0 ? `Filters (${activeFilters})` : "Filters";
    if (activeFilters) el.filtersToggleButton.title = `Active filters: ${labels.join(", ")}`;
    else el.filtersToggleButton.removeAttribute("title");
  }
  if (state.activeView === "list" || (el.boardListView && !el.boardListView.classList.contains("hidden"))) updateListView();
}

function ownerFilterButtonHtml(value, label, { avatar = "", title = "" } = {}) {
  const safeValue = escapeHtml(value);
  const safeLabel = escapeHtml(label);
  const safeTitle = escapeHtml(title || label);
  const avatarHtml = avatar
    ? `<span class="node-filter-owner-avatar"><img src="${escapeHtml(avatar)}" alt="" loading="lazy"></span>`
    : "";
  return `<button type="button" class="owner-filter-option" data-filter-group="owner" data-filter-value="${safeValue}" title="${safeTitle}">${avatarHtml}<span>${safeLabel}</span></button>`;
}

function buildOwnershipFilterButtonsHtml() {
  const options = getNodeOwnerOptions();
  const activeOwnerEmails = [...(state.nodeFilters.owner || new Set())]
    .filter((value) => String(value).startsWith("owner:"))
    .map((value) => normalizeOwnerEmail(String(value).slice("owner:".length)))
    .filter(Boolean);
  activeOwnerEmails.forEach((email) => {
    mergeOwnershipOption(options, {
      email,
      name: "",
      avatar: "",
      role: "Filtered owner",
      source: "activeFilter"
    });
  });
  const collaboratorButtons = options
    .slice()
    .sort((a, b) => ownerFilterCandidateLabel(a).localeCompare(ownerFilterCandidateLabel(b)))
    .map((candidate) => {
      const email = normalizeOwnerEmail(candidate.email);
      const label = ownerFilterCandidateLabel(candidate);
      return ownerFilterButtonHtml(ownerFilterValue(email), label, {
        avatar: normalizeOwnerAvatar(candidate.avatar),
        title: email ? `Owner: ${label} · ${email}` : `Owner: ${label}`
      });
    })
    .join("");
  return `${ownerFilterButtonHtml("mine", "My Nodes", { title: "Owner: Me" })}
    ${ownerFilterButtonHtml("unassigned", "Unassigned", { title: "Owner: Unassigned" })}
    ${collaboratorButtons}`;
}

function buildFiltersPopoverHtml() {
  return `<div class="filter-group"><strong>Node Type</strong><div class="node-filter-chips">
    <button type="button" data-filter-group="type" data-filter-value="Idea">Idea</button>
    <button type="button" data-filter-group="type" data-filter-value="Campaign Variation">Variation</button>
    <button type="button" data-filter-group="type" data-filter-value="Content">Content</button>
    <button type="button" data-filter-group="type" data-filter-value="Landing Page">Landing</button>
    <button type="button" data-filter-group="type" data-filter-value="Social Media Posting">Social</button>
  </div></div>
  <div class="filter-group"><strong>Platform</strong><div class="node-filter-chips">
    <button type="button" data-filter-group="platform" data-filter-value="LinkedIn">LinkedIn</button>
    <button type="button" data-filter-group="platform" data-filter-value="X / Twitter">X</button>
    <button type="button" data-filter-group="platform" data-filter-value="Instagram">Instagram</button>
    <button type="button" data-filter-group="platform" data-filter-value="TikTok">TikTok</button>
  </div></div>
  <div class="filter-group"><strong>Status</strong><div class="node-filter-chips">
    ${NODE_STATUSES.map((status) => `<button type="button" data-filter-group="status" data-filter-value="${status.value}">${status.label}</button>`).join("")}
  </div></div>
  <div class="filter-group"><strong>Ownership</strong><div class="node-filter-chips ownership-filter-chips">
    ${buildOwnershipFilterButtonsHtml()}
  </div></div>
  <div class="filter-group"><strong>State / Funnel</strong><div class="node-filter-chips">
    <button type="button" data-filter-group="state" data-filter-value="scheduled">Scheduled</button>
    <button type="button" data-filter-group="state" data-filter-value="conversion">Conversion</button>
    <button type="button" data-filter-group="state" data-filter-value="awareness">Awareness</button>
    <button type="button" data-filter-group="state" data-filter-value="interest">Interest</button>
    <button type="button" data-filter-group="state" data-filter-value="consideration">Consideration</button>
    <button type="button" data-filter-group="state" data-filter-value="retention">Retention</button>
  </div></div>`;
}

function closeFiltersPopover() {
  document.getElementById("floating-filters-popover")?.remove();
}

function buildUtilitiesPopoverHtml() {
  const canClaim = !!state.user?.email && !!(state.currentBoardId || getBoardIdFromPath()) && !state.currentBoardOwnerEmail;
  const ownedByYou = !!state.user?.email && !!state.currentBoardOwnerEmail && state.currentBoardOwnerEmail === state.user.email;
  const lastSaved = el.boardLastSaved?.textContent || '';
  return `<div class="filter-group"><strong>Board</strong><div class="node-filter-chips">
    <button type="button" data-utility-action="save-board">Save Board</button>
    <button type="button" data-utility-action="duplicate-board">Duplicate Board</button>
    <button type="button" data-utility-action="new-board">New Board</button>
    <button type="button" data-utility-action="reset-board">Reset Board</button>
    ${canClaim ? '<button type="button" data-utility-action="claim-board">Claim Board</button>' : ''}
  </div>${lastSaved || ownedByYou ? `<div class="board-row-meta" style="margin-top:6px;">${ownedByYou ? 'Owned by you' : ''}${ownedByYou && lastSaved ? ' · ' : ''}${lastSaved}</div>` : ''}</div>
  <div class="filter-group"><strong>View</strong><div class="node-filter-chips">
    <button type="button" data-utility-action="board-view">Board View</button>
    <button type="button" data-utility-action="list-view">List View</button>
    <button type="button" data-utility-action="calendar-view">Calendar View</button>
  </div></div>
  <div class="filter-group"><strong>Layout</strong><div class="node-filter-chips">
    <button type="button" data-utility-action="fit-board">Fit to Board</button>
    <button type="button" data-utility-action="auto-arrange">Auto Arrange</button>
    <button type="button" data-utility-action="compact-all">Compact All</button>
    <button type="button" data-utility-action="expand-all">Expand All</button>
  </div></div>`;
}

function closeUtilitiesPopover() {
  document.getElementById("floating-utilities-popover")?.remove();
}

function syncPopoverActiveStates(popoverEl) {
  if (!popoverEl) return;
  popoverEl.querySelectorAll("button[data-filter-group][data-filter-value]").forEach((btn) => {
    const group = btn.dataset.filterGroup;
    const value = btn.dataset.filterValue;
    btn.classList.toggle("active", !!state.nodeFilters[group]?.has(value));
  });
}

function renderPostits(node, nodeEl) {
  nodeEl.querySelectorAll(".postit").forEach((p) => p.remove());
  if (!Array.isArray(node.postits)) node.postits = [];

  node.postits.forEach((note) => {
    ensureCommentIdentity(note);
    const postit = el.postitTemplate.content.firstElementChild.cloneNode(true);
    postit.style.left = `${note.x}px`;
    postit.style.top = `${note.y}px`;
    postit.style.background = note.color;
    postit.classList.toggle("is-resolved", !!note.resolved);

    const header = postit.querySelector("header");
    const avatar = document.createElement("span");
    avatar.className = "postit-avatar";
    const authorAvatar = commentAuthorAvatar(note);
    const authorName = commentAuthorName(note);
    if (authorAvatar) {
      const img = document.createElement("img");
      img.src = authorAvatar;
      img.alt = authorName;
      avatar.appendChild(img);
    } else {
      avatar.textContent = authorName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
    }
    header.prepend(avatar);

    postit.querySelector(".postit-user").textContent = authorName;
    postit.querySelector(".postit-time").textContent = formatCommentTimestamp(note);
    postit.querySelector(".postit-time").title = commentCreatedAt(note);

    const color = postit.querySelector(".postit-color");
    color.value = note.color || "#ffe082";
    color.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      note.color = color.value;
      postit.style.background = color.value;
      saveCampaignCanvasState();
    });

    const resolveBtn = document.createElement("button");
    resolveBtn.type = "button";
    resolveBtn.className = "postit-resolve";
    resolveBtn.textContent = note.resolved ? "Reopen" : "Resolve";
    resolveBtn.title = note.resolved ? "Reopen comment" : "Resolve comment";
    resolveBtn.addEventListener("click", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      note.resolved = !note.resolved;
      const actor = getCurrentCommentActor();
      if (note.resolved && actor) {
        note.resolvedByName = actor.authorName;
        note.resolvedByEmail = actor.authorEmail;
        note.resolvedByAvatar = actor.authorAvatar;
        note.resolvedAt = new Date().toISOString();
      }
      note.updatedAt = new Date().toISOString();
      markNodeCommentsSeen(node.id);
      appendActivity(note.resolved ? "comment_resolved" : "comment_added", { node });
      renderPostits(node, nodeEl);
      updateNodeCommentBadge(node, nodeEl);
      saveCampaignCanvasState();
    });
    header.insertBefore(resolveBtn, postit.querySelector(".postit-delete"));

    const area = postit.querySelector(".postit-text");
    area.value = note.text;
    area.disabled = !!note.resolved;
    area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
    area.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      note.text = area.value;
      area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
      saveCampaignCanvasState();
    });

    postit.querySelector(".postit-delete").addEventListener("click", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      node.postits = node.postits.filter((n) => n.id !== note.id);
      renderPostits(node, nodeEl);
      updateNodeCommentBadge(node, nodeEl);
      saveCampaignCanvasState();
    });

    if (note.resolved) {
      const summary = document.createElement("div");
      summary.className = "postit-resolved-summary";
      const resolvedBy = note.resolvedByName || "Someone";
      const replyCount = Array.isArray(note.replies) ? note.replies.length : 0;
      summary.textContent = `Resolved by ${resolvedBy}${note.resolvedAt ? ` · ${relativeActivityTime(note.resolvedAt)}` : ""}${replyCount ? ` · ${replyCount} repl${replyCount === 1 ? "y" : "ies"} hidden` : ""}`;
      postit.querySelector(".postit-text")?.remove();
      postit.appendChild(summary);
      enablePostitDrag(postit, note);
      nodeEl.appendChild(postit);
      return;
    }

    const repliesWrap = document.createElement("div");
    repliesWrap.className = "postit-replies";
    note.replies.forEach((reply) => {
      ensureCommentIdentity(reply);
      const line = document.createElement("div");
      line.className = "postit-reply";
      const replyAvatar = document.createElement("span");
      replyAvatar.className = "postit-reply-avatar";
      const replyAuthorName = commentAuthorName(reply);
      const replyAvatarUrl = commentAuthorAvatar(reply);
      if (replyAvatarUrl) {
        const img = document.createElement("img");
        img.src = replyAvatarUrl;
        img.alt = replyAuthorName;
        replyAvatar.appendChild(img);
      } else {
        replyAvatar.textContent = replyAuthorName.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "U";
      }
      const body = document.createElement("div");
      body.className = "postit-reply-body";
      const meta = document.createElement("div");
      meta.className = "postit-reply-meta";
      meta.textContent = `${replyAuthorName} · ${formatCommentTimestamp(reply)}`;
      const text = document.createElement("p");
      text.textContent = reply.text || "";
      body.append(meta, text);
      line.append(replyAvatar, body);
      repliesWrap.appendChild(line);
    });

    const addReplyBtn = document.createElement("button");
    addReplyBtn.type = "button";
    addReplyBtn.className = "postit-reply-button";
    addReplyBtn.textContent = note.resolved ? "Resolved" : "Reply";
    addReplyBtn.disabled = !!note.resolved;
    addReplyBtn.addEventListener("click", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      if (!requireCommentIdentity()) return;
      if (postit.querySelector(".postit-reply-editor")) return;
      const editor = document.createElement("div");
      editor.className = "postit-reply-editor";
      editor.innerHTML = `<textarea class="postit-reply-input" rows="2" placeholder="Write a reply..."></textarea><button type="button" class="inspector-image-delete">Send</button>`;
      editor.querySelector("button").addEventListener("click", () => {
        if (isBoardReadOnly()) {
          setSaveStatus("Read-only board");
          return;
        }
        if (!requireCommentIdentity()) return;
        const text = editor.querySelector(".postit-reply-input").value.trim();
        if (!text) return;
        const actor = createCommentPayload(text);
        if (!actor) return;
        note.replies.push({ id: `reply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ...actor });
        note.updatedAt = new Date().toISOString();
        markNodeCommentsSeen(node.id);
        state.commentThreadsOpenedByNode.delete(node.id);
        appendActivity("reply_added", { node, userName: actor.authorName });
        renderPostits(node, nodeEl);
        updateNodeCommentBadge(node, nodeEl);
        saveCampaignCanvasState();
      });
      postit.appendChild(editor);
      editor.querySelector("textarea")?.focus();
    });

    postit.append(repliesWrap, addReplyBtn);

    enablePostitDrag(postit, note);
    nodeEl.appendChild(postit);
  });
}


function enablePostitDrag(postit, note) {
  postit.addEventListener("pointerdown", (event) => {
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
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


function populateOwnerSelect(node) {
  const select = el.inputs?.owner;
  if (!select) return;
  const currentOwnerEmail = normalizeOwnerEmail(node?.ownerEmail);
  const options = getNodeOwnerOptions();
  if (currentOwnerEmail && !options.some((option) => option.email === currentOwnerEmail)) {
    options.push({
      email: currentOwnerEmail,
      name: normalizeOwnerName(node?.ownerName),
      avatar: normalizeOwnerAvatar(node?.ownerAvatar),
      role: "Current owner"
    });
  }

  select.innerHTML = "";
  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  select.appendChild(unassigned);

  options.forEach((owner) => {
    const option = document.createElement("option");
    option.value = owner.email;
    option.textContent = `${owner.role || "Collaborator"}: ${owner.name || owner.email}`;
    option.dataset.ownerName = owner.name || "";
    option.dataset.ownerAvatar = owner.avatar || "";
    select.appendChild(option);
  });

  select.value = currentOwnerEmail;
  select.disabled = isBoardReadOnly() || !node;
}

function ownerFromSelect(select) {
  const email = normalizeOwnerEmail(select?.value);
  if (!email) return null;
  const selected = select.selectedOptions?.[0];
  return {
    email,
    name: selected?.dataset?.ownerName || "",
    avatar: selected?.dataset?.ownerAvatar || ""
  };
}

function refreshOwnerSelectorIdentities() {
  refreshOwnershipDisplays();
  if (canManageBoardEditors() && !state.boardEditorsLoading) {
    state.lastEditorIdentityRefreshAt = Date.now();
    void loadBoardEditors({ silent: true });
  }
}

function maybeRefreshEditorIdentitiesFromPresence() {
  if (!canManageBoardEditors() || state.boardEditorsLoading) return;
  const now = Date.now();
  if (now - (state.lastEditorIdentityRefreshAt || 0) < 30 * 1000) return;
  state.lastEditorIdentityRefreshAt = now;
  void loadBoardEditors({ silent: true });
}

function fillInspector(node) {
  if (!node) {
    el.inspectorMeta.textContent = "Wähle oder erstelle einen Node.";
    el.nodeForm.reset();
    el.socialFields.classList.add("hidden");
    el.contentUploadFields.classList.add("hidden");
    el.contentFormatField.classList.add("hidden");
    document.getElementById("content-image-prompt-field")?.classList.add("hidden");
    el.landingPageFields?.classList.add("hidden");
    const variantsLabel = el.nodeForm.querySelector('label[for="node-variants"]');
    variantsLabel?.classList.remove("hidden");
    el.inputs.variants.classList.remove("hidden");
    el.inspectorImageList.innerHTML = "";
    if (el.inputs.status) el.inputs.status.disabled = true;
    if (el.inputs.owner) {
      el.inputs.owner.innerHTML = '<option value="">Unassigned</option>';
      el.inputs.owner.disabled = true;
    }
    if (el.connectedContextSummary) el.connectedContextSummary.textContent = "Parents: 0 · Children: 0";
    if (el.connectedContextBody) el.connectedContextBody.textContent = "";
    updateInspectorActionVisibility();
    return;
  }

  el.inspectorMeta.textContent = `Bearbeite ${node.id}`;
  el.inputs.type.value = node.type;
  if (el.inputs.status) {
    el.inputs.status.value = normalizeNodeStatus(node.status);
    el.inputs.status.disabled = isBoardReadOnly();
  }
  el.inputs.title.value = node.title;
  populateOwnerSelect(node);
  el.inputs.content.value = node.content;
  el.inputs.imagePrompt.value = node.imagePrompt || "";
  el.inputs.variants.value = node.variants.join(", ");
  el.inputs.platform.value = node.social.platform;
  el.inputs.caption.value = node.social.caption;
  el.inputs.hashtags.value = state.hashtagDraftByNode[node.id] ?? node.social.hashtags.join(", ");
  if (el.inputs.preview) el.inputs.preview.value = node.social.preview;
  el.inputs.audience.value = node.audience;
  el.inputs.goal.value = node.goal;
  el.inputs.channel.value = node.channel;
  el.inputs.funnelStage.value = node.funnelStage || "";
  el.inputs.tone.value = node.tone || "";
  el.inputs.contentFormat.value = node.contentFormat || "1:1";
  const lp = node.landingPage || { headerVisualPrompt: "", headerClaim: "", problem: "", solution: "", trust: "", cta: "" };
  el.inputs.lpHeaderVisualPrompt.value = lp.headerVisualPrompt || "";
  el.inputs.lpHeaderClaim.value = lp.headerClaim || "";
  el.inputs.lpProblem.value = lp.problem || "";
  el.inputs.lpSolution.value = lp.solution || "";
  el.inputs.lpTrust.value = lp.trust || "";
  el.inputs.lpCta.value = lp.cta || "";

  el.socialFields.classList.toggle("hidden", node.type !== "Social Media Posting");
  el.contentUploadFields.classList.toggle("hidden", !(node.type === "Content" || node.type === "Social Media Posting"));
  el.contentFormatField.classList.toggle("hidden", node.type !== "Content");
  document.getElementById("content-image-prompt-field")?.classList.toggle("hidden", node.type !== "Content");
  el.landingPageFields?.classList.toggle("hidden", node.type !== "Landing Page");
  el.generateHeaderVisualButton.style.display = node.type === "Landing Page" ? "block" : "none";
  if (el.addToPostingCalendarButton) {
    const isScheduled = node.type === "Social Media Posting" && node.social?.scheduledAt;
    el.addToPostingCalendarButton.textContent = isScheduled ? "Scheduled" : "Add to Posting Calendar";
    el.addToPostingCalendarButton.classList.toggle("is-scheduled", !!isScheduled);
  }
  if (el.postingScheduleMeta) {
    const scheduleInfo = node.type === "Social Media Posting" ? formatScheduleMeta(node.social?.scheduledAt) : null;
    el.postingScheduleMeta.textContent = scheduleInfo ? `Scheduled: ${scheduleInfo.dateLabel} • ${scheduleInfo.timeLabel}` : "";
  }
  const variantsLabel = el.nodeForm.querySelector('label[for="node-variants"]');
  const hideVariants = node.type === "Content";
  variantsLabel?.classList.toggle("hidden", hideVariants);
  el.inputs.variants.classList.toggle("hidden", hideVariants);
  renderInspectorImages(node);
  const connected = getConnectedNodeContext(node.id);
  if (el.connectedContextSummary) {
    el.connectedContextSummary.textContent = `Parents: ${connected.parentNodes.length} · Children: ${connected.childNodes.length}`;
  }
  if (el.connectedContextBody) {
    const parents = connected.parentNodes.slice(0, 3).map((n) => n.title || n.type).join(", ") || "—";
    const children = connected.childNodes.slice(0, 3).map((n) => n.title || n.type).join(", ") || "—";
    el.connectedContextBody.innerHTML = `<div><strong>Parent:</strong> ${parents}</div><div><strong>Child:</strong> ${children}</div>`;
  }
  updateInspectorActionVisibility();
  renderNodePresenceBadges();
}

function getConnectedSocialPostingNodes(contentNodeId) {
  const ids = state.edges
    .filter((edge) => {
      const from = Array.isArray(edge) ? edge[0] : edge?.source;
      return from === contentNodeId;
    })
    .map((edge) => (Array.isArray(edge) ? edge[1] : edge?.target))
    .filter(Boolean);
  return ids.map(getNode).filter((n) => n?.type === "Social Media Posting");
}

async function resolveTargetSocialNodeForContent(contentNode) {
  const connected = getConnectedSocialPostingNodes(contentNode.id);
  const yOffset = connected.length * 120;
  const created = createNode({ type: "Social Media Posting", position: { x: contentNode.position.x + 340, y: contentNode.position.y + 40 + yOffset } }) || state.nodes[state.nodes.length - 1];
  addEdge(contentNode.id, created.id);
  return created;
}

function revokeImageObjectUrl(img) {
  if (!img?.url) return;
  if (img.url.startsWith("blob:")) URL.revokeObjectURL(img.url);
}

function removeNodeImage(node, imageId) {
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return;
  }
  const idx = node.images.findIndex((img) => img.id === imageId);
  if (idx === -1) return;
  const [removed] = node.images.splice(idx, 1);
  if (node.favoriteImageId === imageId) node.favoriteImageId = null;
  revokeImageObjectUrl(removed);
  appendActivity("media_removed", { node });
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
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
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
  const connectedContext = getConnectedNodeContext(node.id);
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
      campaignContext: campaignContext || undefined,
      connectedNodeContext: connectedContext
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
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
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

async function generateFullContentPack(node, triggerBtn = null, mode = "auto") {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  if (!node || getContentPackLoading(node.id)) return;
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  const toolbarButtons = nodeEl ? [...nodeEl.querySelectorAll(".node-ai-toolbar button")] : [];
  const originalText = triggerBtn?.textContent || "";
  console.log("runContentPackGeneration started with mode:", mode, node.id);
  setContentPackGenerating(node.id, true);
  setContentPackError(node.id, "");
  toolbarButtons.forEach((btn) => { btn.disabled = true; });
  if (triggerBtn) triggerBtn.textContent = "…";
  updateNodeCard(node);
  try {
    const targetSocialNode = await resolveTargetSocialNodeForContent(node);
    if (!targetSocialNode) return;

    const platform = targetSocialNode?.social?.platform || "LinkedIn";
    const platformGuide = platformPromptGuidance(platform);
    const improved = await refineNodeWithAI(node, `Improve or finalize this content while preserving intent and brand voice. ${platformGuide}`);
    node.title = improved?.title || node.title;
    node.content = improved?.content || node.content;

    console.log("Generating image prompt");
    const imagePromptResult = await refineNodeWithAI(node, "Create or update a clearly descriptive visual image prompt based on this content. Return it in content.");
    node.imagePrompt = (imagePromptResult?.content || "").trim() || node.imagePrompt;
    if (!node.imagePrompt) throw new Error("Image prompt generation failed");

    console.log("Generating caption");
    const captionResult = await refineNodeWithAI(node, `Write one short social-media-ready caption based on this content. ${platformGuide} Return it in caption.`);
    const caption = (captionResult?.caption || captionResult?.content || "").trim();
    if (!caption) throw new Error("Caption generation failed");

    console.log("Generating CTA");
    const ctaResult = await refineNodeWithAI(node, `Write one clear, concise call-to-action line based on this content. ${platformGuide} Return it in content.`);
    const cta = (ctaResult?.content || ctaResult?.caption || "").split("\n")[0].trim();
    if (!cta) throw new Error("CTA generation failed");

    console.log("Generating hashtags");
    const hashtagResult = await refineNodeWithAI(node, `${structuredHashtagPrompt(platform)} ${platformGuide}`);
    const hashtags = finalizeGeneratedHashtags(hashtagResult?.caption || hashtagResult?.content || "", platform);

    console.log("Generating image");
    await generateImageForNode(node);
    const newestImage = node.images[node.images.length - 1];
    console.log("Creating/updating social node");
    targetSocialNode.title = `Social Post: ${node.title || "Untitled"}`;
    targetSocialNode.content = [caption, cta].filter(Boolean).join("\n\n");
    targetSocialNode.social.caption = caption;
    targetSocialNode.social.hashtags = hashtags;
    targetSocialNode.social.preview = cta;
    if (newestImage?.url) {
      targetSocialNode.images = Array.isArray(targetSocialNode.images) ? targetSocialNode.images : [];
      targetSocialNode.images.push({ ...newestImage, id: crypto.randomUUID ? crypto.randomUUID() : `img-${Date.now()}` });
    }
    updateNodeCard(node);
    updateNodeCard(targetSocialNode);
    fillInspector(node);
    saveCampaignCanvasState();
    console.log("runContentPackGeneration finished");
  } catch (_error) {
    console.error("Full content pack failed", _error);
    setContentPackError(node.id, "Could not generate content pack. Please retry.");
    updateNodeCard(node);
  } finally {
    setContentPackGenerating(node.id, false);
    toolbarButtons.forEach((btn) => { btn.disabled = false; });
    if (triggerBtn) triggerBtn.textContent = originalText;
    updateNodeCard(node);
    updateInspectorActionVisibility();
    console.log("generation loading cleared");
  }
}

async function handleGenerateFullContentPack(contentNodeId) {
  const node = getNode(contentNodeId);
  if (!node || node.type !== "Content") return;
  console.log("Full pack clicked");
  const connectedSocialNodes = getConnectedSocialPostingNodes(node.id);
  console.log("Existing social nodes:", connectedSocialNodes.length);
  await generateFullContentPack(node, el.generateFullPackButton, "new");
}

function getNextStepNodeType(nodeType = "") {
  return NEXT_STEP_NODE_TYPE[nodeType] || "";
}

function buildNextStepNodeContext(node) {
  const parentNode = getDirectParentNode(node.id);
  return {
    nodeType: node.type,
    title: node.title || "",
    description: node.description || "",
    content: node.type === "Social Media Posting"
      ? (node.social?.caption || node.social?.preview || node.content || "")
      : (node.content || ""),
    goal: node.goal || "",
    audience: node.audience || "",
    channel: node.channel || node.social?.platform || "",
    funnelStage: node.funnelStage || "",
    tone: node.tone || "",
    tags: Array.isArray(node.tags) ? node.tags : [],
    parentContext: parentNode
      ? {
          nodeType: parentNode.type,
          title: parentNode.title || "",
          content: parentNode.content || "",
          goal: parentNode.goal || "",
          audience: parentNode.audience || "",
          channel: parentNode.channel || parentNode.social?.platform || "",
          funnelStage: parentNode.funnelStage || "",
          tone: parentNode.tone || ""
        }
      : null,
    connectedParentContext: getConnectedNodeContext(node.id).parentNodes,
    campaignContext: getCampaignContextSummary() || undefined,
    brandBrainData: state.brandCore
  };
}

async function fetchGeneratedNextStep(node) {
  const response = await fetch("/api/generate-next-step", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildNextStepNodeContext(node))
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Failed to generate next step");
  return data;
}

function applyGeneratedNextStepContent(node, generated = {}) {
  const generatedDescription = (generated.description || "").trim();
  const generatedContent = (generated.content || generatedDescription || "").trim();
  const generatedImagePrompt = (generated.imagePrompt || "").trim();
  const generatedLandingPage = generated.landingPage || {};
  node.title = (generated.title || generated.nodeType || node.type || "").trim();
  node.content = generatedContent;
  if (generatedDescription && !node.content.includes(generatedDescription)) {
    node.content = [generatedDescription, node.content].filter(Boolean).join("\n\n");
  }
  if (node.type === "Content" && generatedImagePrompt) {
    node.imagePrompt = generatedImagePrompt;
  }
  if (node.type === "Landing Page") {
    node.landingPage = {
      headerVisualPrompt: (generatedLandingPage.headerVisualPrompt || "").trim(),
      headerClaim: (generatedLandingPage.headerClaim || "").trim(),
      problem: (generatedLandingPage.problem || generatedLandingPage.problemOfIcp || "").trim(),
      solution: (generatedLandingPage.solution || generatedLandingPage.solutionForIcp || "").trim(),
      trust: (generatedLandingPage.trust || generatedLandingPage.buildingTrust || "").trim(),
      cta: (generatedLandingPage.cta || generatedLandingPage.conversionCta || "").trim()
    };
    node.content = generatedContent || generatedDescription || node.landingPage.headerClaim || "";
  }
  if (node.type === "Social Media Posting") {
    node.social.caption = node.content || node.title;
    node.social.preview = generatedDescription;
  }
}

async function generateNextStepFromNode(sourceNode, triggerBtn = null) {
  if (!sourceNode) return null;
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return null;
  }
  const nextNodeType = getNextStepNodeType(sourceNode.type);
  if (!nextNodeType) {
    setSaveStatus("No next step available.");
    return null;
  }
  const originalText = triggerBtn?.textContent || "";
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "Generating next step...";
  }
  setSaveStatus("Generating next step...");
  try {
    const generated = await fetchGeneratedNextStep(sourceNode);
    const position = {
      x: sourceNode.position.x + NODE_WIDTH + 80,
      y: sourceNode.position.y + 80
    };
    const created = createNode({ type: generated.nodeType || nextNodeType, parentId: sourceNode.id, position });
    if (!created) return null;
    created.goal = sourceNode.goal || created.goal;
    created.audience = sourceNode.audience || created.audience;
    created.channel = sourceNode.channel || sourceNode.social?.platform || created.channel;
    applyGeneratedNextStepContent(created, generated);
    updateNodeCard(created);
    fillInspector(created);
    updateListView();
    drawLinks();
    appendActivity("generated_next_step", { node: sourceNode });
    saveCampaignCanvasState();
    return created;
  } catch (error) {
    console.error("[Funklix AI] Generate next step failed", error);
    setSaveStatus("Could not generate next step.");
    return null;
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalText;
    }
  }
}

async function generateImageForNode(node) {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
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
        nodeContent: [node.imagePrompt || node.content || "", nodeStrategyContext(node)].filter(Boolean).join(" | "),
        brandBrainData: state.brandCore,
        campaignContext: getCampaignContextSummary(),
        contentFormat: node.contentFormat || "1:1",
        connectedNodeContext: getConnectedNodeContext(node.id)
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
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
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
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
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

  const hasFilters = isNodeSearchOrFilterActive();
  const visibleNodes = state.nodes.filter((node) => nodeMatchesSearchAndFilters(node));
  if (!state.nodes.length) {
    el.nodeListView.innerHTML = '<p class="list-empty">Keine Nodes vorhanden.</p>';
    return;
  }
  if (!visibleNodes.length) {
    el.nodeListView.innerHTML = `<p class="list-empty">${hasFilters ? "No nodes match current filters." : "Keine Nodes vorhanden."}</p>`;
    return;
  }

  const groups = visibleNodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {});

  const types = Object.keys(groups).sort();
  types.forEach((type) => {
    const section = document.createElement("section");
    section.className = "list-group node-list-group";
    const h = document.createElement("h4");
    h.textContent = `${type} (${groups[type].length})`;
    h.style.color = NODE_TYPES[type]?.color || "#333";
    section.appendChild(h);

    const ul = document.createElement("ul");
    ul.className = "node-summary-list";
    groups[type].forEach((node) => {
      const li = document.createElement("li");
      li.className = "node-summary-row";
      const hasUnreadComments = hasUnreadNodeComments(node);
      const hasNodeUnreadActivity = hasUnreadActivityForNode(node.id);
      const hasRecentStatusChange = hasUnreadStatusActivityForNode(node.id);
      li.classList.toggle("has-unread-comments", hasUnreadComments);
      li.classList.toggle("has-recent-activity", hasNodeUnreadActivity);
      li.classList.toggle("has-recent-status", hasRecentStatusChange);
      li.tabIndex = 0;
      li.setAttribute("role", "button");
      li.setAttribute("aria-label", `Focus ${node.title || node.type || "node"}`);

      const top = document.createElement("div");
      top.className = "node-summary-topline";
      const titleWrap = document.createElement("div");
      titleWrap.className = "node-summary-titlewrap";
      titleWrap.appendChild(createListStatusChip(node));
      const title = document.createElement("strong");
      title.className = "node-summary-title";
      title.textContent = node.title || "(ohne Titel)";
      titleWrap.appendChild(title);
      if (hasNodeUnreadActivity || hasUnreadComments) {
        const dot = document.createElement("span");
        dot.className = "node-summary-new-dot";
        dot.textContent = "New";
        dot.title = hasUnreadComments ? "New discussion activity" : "New activity";
        titleWrap.appendChild(dot);
      }
      top.appendChild(titleWrap);

      const owner = createOwnerDisplay(node);
      owner.classList.add("node-summary-owner");
      top.appendChild(owner);

      const discussion = getNodeDiscussionCounts(node);
      if (discussion.total > 0) {
        const commentBtn = document.createElement("button");
        commentBtn.type = "button";
        commentBtn.className = "node-summary-comments";
        commentBtn.classList.toggle("has-unresolved", discussion.unresolved > 0);
        commentBtn.classList.toggle("has-unread", hasUnreadComments);
        commentBtn.textContent = discussion.unresolved ? `💬 ${discussion.unresolved}` : `💬 ${discussion.total}`;
        commentBtn.title = discussion.unresolved
          ? `${discussion.unresolved} unresolved · ${discussion.total} total discussion items`
          : `${discussion.total} discussion item${discussion.total === 1 ? "" : "s"}`;
        commentBtn.addEventListener("click", (event) => {
          event.stopPropagation();
          focusListViewNode(node.id, { openComments: true });
        });
        top.appendChild(commentBtn);
      }

      const preview = document.createElement("p");
      preview.className = "node-summary-preview";
      preview.textContent = getNodeListPreview(node) || "No content yet.";

      const meta = document.createElement("div");
      meta.className = "node-summary-meta";
      getNodeListMeta(node).slice(0, 6).forEach((item) => {
        const chip = document.createElement("span");
        chip.textContent = item;
        meta.appendChild(chip);
      });

      li.append(top, preview, meta);
      li.addEventListener("click", () => focusListViewNode(node.id));
      li.addEventListener("keydown", (event) => {
        if (event.target !== li) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        focusListViewNode(node.id);
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
  nodeEl.addEventListener("dblclick", (event) => {
    if (event.target.closest("button,input,textarea,select,[contenteditable='true']")) return;
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
    node.compact = false;
    updateNodeCard(node);
    saveCampaignCanvasState();
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
  const compactToggle = document.createElement("button");
  compactToggle.type = "button";
  compactToggle.className = "node-compact-toggle";
  compactToggle.addEventListener("click", (event) => {
    event.stopPropagation();
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
    const wasCompact = !!node.compact;
    node.compact = !node.compact;
    updateNodeCard(node);
    if (wasCompact && !node.compact) {
      requestAnimationFrame(() => {
        const moved = resolveOverlapsAfterNodeExpand(node.id);
        if (moved) drawLinks();
        saveCampaignCanvasState();
      });
    } else {
      saveCampaignCanvasState();
    }
  });
  const headerActions = nodeEl.querySelector(".node-header-actions");
  (headerActions || nodeEl).appendChild(compactToggle);
  const compactSummary = document.createElement("div");
  compactSummary.className = "node-compact-summary";
  nodeEl.insertBefore(compactSummary, nodeEl.querySelector(".tags"));
  const aiToolbar = document.createElement("div");
  aiToolbar.className = "node-ai-toolbar";
  [
    ["🧠 Generate Next Step", "__generate_next_step__"],
    ["✨ Improve", "Improve this node while keeping the original intent."],
    ["🔄 Regenerate", "Regenerate this node as a fresh alternative version while keeping it aligned with the campaign context and brand voice."],
    ["Shorter", "Make this shorter and more concise."],
    ["Emotional", "Make this more emotional and engaging."],
    ["Direct", "Make this more direct and clear."]
  ].forEach(([label, instruction]) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.quickWired = "1";
    btn.textContent = label;
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      if (instruction === "__generate_next_step__") {
        await generateNextStepFromNode(node, btn);
        return;
      }
      await runInlineRefine(node, instruction, btn);
    });
    aiToolbar.appendChild(btn);
  });
  if (node.type === "Content") {
    const packBtn = document.createElement("button");
    packBtn.type = "button";
    packBtn.dataset.quickWired = "1";
    packBtn.textContent = "Generate Full Content Pack";
    packBtn.addEventListener("click", async (event) => {
      event.stopPropagation();
      await handleGenerateFullContentPack(node.id);
    });
    aiToolbar.appendChild(packBtn);
  }
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
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
    node.title = title.textContent;
    if (state.selectedPrimary === node.id) el.inputs.title.value = node.title;
    updateListView();
    recordNodeUpdatedActivity(node);
    saveCampaignCanvasState();
  });
  content.addEventListener("input", () => {
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
    node.content = content.textContent;
    if (state.selectedPrimary === node.id) el.inputs.content.value = node.content;
    if ((node.content || "").length <= 160) nodeEl.classList.remove("content-expanded");
    const shouldTruncate = !isSocialNodeCard && (node.content || "").length > 160;
    const isExpanded = nodeEl.classList.contains("content-expanded");
    content.classList.toggle("clamped", shouldTruncate && !isExpanded && document.activeElement !== content);
    expandBtn.classList.toggle("hidden", !shouldTruncate || isExpanded);
    recordNodeUpdatedActivity(node);
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
    // Read-only guard: do not start node drag interactions when editing is disabled.
    if (state.boardAccess?.canEdit === false) return;

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
      const moved = origins.some((o) => {
        const n = getNode(o.id);
        return n && (Math.abs(n.position.x - o.x) > 2 || Math.abs(n.position.y - o.y) > 2);
      });
      if (moved) appendActivity("node_moved", { node: getNode(moveIds[0]) });
      updateCanvasScrollSurfaceSize();
      saveCampaignCanvasState();
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function getNodeBounds(nodeId) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
  return nodeEl ? nodeEl.getBoundingClientRect() : null;
}

function doBoundsOverlap(a, b, margin = 0) {
  if (!a || !b) return false;
  return !(a.right + margin <= b.left || b.right + margin <= a.left || a.bottom + margin <= b.top || b.bottom + margin <= a.top);
}

function nudgeNodeAwayFromAnchor(node, nodeBounds, anchorBounds, preferDiagonal = false) {
  const overlapX = Math.min(anchorBounds.right, nodeBounds.right) - Math.max(anchorBounds.left, nodeBounds.left);
  const overlapY = Math.min(anchorBounds.bottom, nodeBounds.bottom) - Math.max(anchorBounds.top, nodeBounds.top);
  const moveRight = (Math.max(0, overlapX) + NODE_OVERLAP_MARGIN) / state.zoom;
  const moveDown = (Math.max(0, overlapY) + NODE_OVERLAP_MARGIN) / state.zoom;
  node.position.x += moveRight;
  if (preferDiagonal || overlapY > 0) node.position.y += moveDown;
}

function resolveOverlapsAfterNodeExpand(expandedNodeId) {
  const expandedNode = getNode(expandedNodeId);
  if (!expandedNode) return false;
  const expandedBounds = getNodeBounds(expandedNodeId);
  if (!expandedBounds) return false;

  const movedNodeIds = new Set();
  let changed = false;

  state.nodes.forEach((candidate) => {
    if (candidate.id === expandedNodeId) return;
    const candidateBounds = getNodeBounds(candidate.id);
    if (!doBoundsOverlap(expandedBounds, candidateBounds, NODE_OVERLAP_MARGIN)) return;
    nudgeNodeAwayFromAnchor(candidate, candidateBounds, expandedBounds, false);
    updateNodeCard(candidate);
    movedNodeIds.add(candidate.id);
    changed = true;
  });

  for (let pass = 0; pass < NODE_OVERLAP_MAX_PASSES && movedNodeIds.size; pass++) {
    let passChanged = false;
    const anchors = [...movedNodeIds];
    anchors.forEach((anchorId) => {
      const anchorBounds = getNodeBounds(anchorId);
      if (!anchorBounds) return;
      state.nodes.forEach((candidate) => {
        if (candidate.id === expandedNodeId || candidate.id === anchorId) return;
        const candidateBounds = getNodeBounds(candidate.id);
        if (!doBoundsOverlap(anchorBounds, candidateBounds, NODE_OVERLAP_MARGIN)) return;
        nudgeNodeAwayFromAnchor(candidate, candidateBounds, anchorBounds, true);
        updateNodeCard(candidate);
        movedNodeIds.add(candidate.id);
        passChanged = true;
        changed = true;
      });
    });
    if (!passChanged) break;
  }

  return changed;
}

function resolveAllNodeOverlaps() {
  let changed = false;
  for (let pass = 0; pass < NODE_OVERLAP_MAX_PASSES; pass++) {
    let passChanged = false;
    for (let i = 0; i < state.nodes.length; i++) {
      const left = state.nodes[i];
      const leftBounds = getNodeBounds(left.id);
      if (!leftBounds) continue;
      for (let j = i + 1; j < state.nodes.length; j++) {
        const right = state.nodes[j];
        const rightBounds = getNodeBounds(right.id);
        if (!doBoundsOverlap(leftBounds, rightBounds, NODE_OVERLAP_MARGIN)) continue;
        nudgeNodeAwayFromAnchor(right, rightBounds, leftBounds, pass > 0);
        updateNodeCard(right);
        passChanged = true;
        changed = true;
      }
    }
    if (!passChanged) break;
  }
  return changed;
}

function toggleListMode(showList) {
  const shouldShowList = typeof showList === "boolean" ? showList : !el.canvas.classList.contains("hidden");
  el.canvas.classList.toggle("hidden", shouldShowList);
  el.boardListView.classList.toggle("hidden", !shouldShowList);
  if (shouldShowList) updateListView();

  if (!shouldShowList && state.selectedPrimary) {
    const selected = getNode(state.selectedPrimary);
    if (selected) {
      forceNodeVisible(selected.id);
      ensureNodeActuallyVisible(selected);
    }
  }
}

function autoArrangeBoardByHierarchy() {
  if (!state.nodes.length) return false;
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return false;
  }

  const hierarchy = [
    "Idea",
    "Campaign Variation",
    "Content",
    "Social Media Posting",
    "Landing Page",
    "Email Campaign"
  ];
  const rowForType = new Map(hierarchy.map((type, index) => [type, index]));
  const rows = new Map();
  const unknownRow = hierarchy.length;
  const startX = 240;
  const startY = 160;
  const colGap = 380;
  const rowGap = 56;

  state.nodes.forEach((node) => {
    const rowIndex = rowForType.has(node.type) ? rowForType.get(node.type) : unknownRow;
    const rowNodes = rows.get(rowIndex) || [];
    rowNodes.push(node);
    rows.set(rowIndex, rowNodes);
  });

  const getRenderedNodeHeight = (node) => {
    const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
    return nodeEl?.offsetHeight || NODE_HEIGHT;
  };

  pushHistorySnapshot();
  let rowY = startY;
  [...rows.entries()].sort(([a], [b]) => a - b).forEach(([, rowNodes]) => {
    const rowHeight = Math.max(NODE_HEIGHT, ...rowNodes.map(getRenderedNodeHeight));
    rowNodes.forEach((node, colIndex) => {
      node.position.x = Math.max(0, startX + colIndex * colGap);
      node.position.y = Math.max(0, rowY);
      updateNodeCard(node);
    });
    rowY += rowHeight + rowGap;
  });

  updateCanvasScrollSurfaceSize();
  drawLinks();
  appendActivity("auto_arranged");
  saveCampaignCanvasState();
  fitBoardContentToViewport({ padding: 160, minZoom: 0.12, behavior: "auto" });
  return true;
}

function setCompactModeForAllNodes(compact) {
  if (!state.nodes.length) return;
  let changed = false;
  state.nodes.forEach((node) => {
    if (!!node.compact === !!compact) return;
    node.compact = !!compact;
    updateNodeCard(node);
    changed = true;
  });
  if (!changed) return;
  if (!compact) {
    setSaveStatus("All nodes expanded");
    requestAnimationFrame(() => {
      resolveAllNodeOverlaps();
      updateCanvasScrollSurfaceSize();
      drawLinks();
      saveCampaignCanvasState();
      fitBoardContentToViewport({ padding: 160, minZoom: 0.12, behavior: "auto" });
    });
    return;
  }
  setSaveStatus("All nodes compacted");
  requestAnimationFrame(() => {
    updateCanvasScrollSurfaceSize();
    drawLinks();
    saveCampaignCanvasState();
  });
}

function renderCalendarView() {
  const month = state.calendarMonth;
  const totalScheduled = state.nodes.filter((n) => n.type === "Social Media Posting" && n.social?.addedToCalendar && n.social?.scheduledAt).length;
  el.calendarTitle.textContent = `${month.toLocaleDateString("de-DE", { month: "long", year: "numeric" })} · ${totalScheduled} scheduled posts`;
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
    state.nodes.filter((n) => n.type === "Social Media Posting" && n.social?.addedToCalendar === true && n.social?.scheduledDate === key && n.social?.scheduledTime).forEach((n) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "calendar-post";
      const when = new Date(n.social.scheduledAt);
      const metaTime = when.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
      const captionPreview = (n.social.caption || n.title || n.id || "Post").trim().slice(0, 60);
      const platformTone = getPlatformTone(n.social.platform || "LinkedIn");
      btn.style.borderLeftColor = platformTone.accent;
      const previewImage = n.images?.[n.images.length - 1]?.url;
      btn.innerHTML = `<span class="calendar-post-platform" style="background:${platformTone.soft};color:${platformTone.accent}">${platformTone.label}</span><strong>${metaTime}</strong><small>${captionPreview}${captionPreview.length >= 60 ? "…" : ""}</small>`;
      if (previewImage) {
        const thumb = document.createElement("img");
        thumb.src = previewImage;
        thumb.alt = "Scheduled post preview";
        thumb.className = "calendar-post-thumb";
        btn.appendChild(thumb);
      }
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
  el.insightsView?.classList.toggle("hidden", view !== "insights");
  el.aiBrainView?.classList.toggle("hidden", view !== "ai_brain");
  el.brandCoreWorkspace.classList.toggle("hidden", view !== "brand-core");
  el.campaignCanvasNavButton.classList.toggle("active", view !== "brand-core");
  el.brandCoreButton.classList.toggle("active", view === "brand-core");
  el.cycleViewButton.textContent =
    view === "board" ? "Board View" : view === "list" ? "List View" : view === "calendar" ? "Calendar View" : view === "insights" ? "Insights" : view === "ai_brain" ? "AI Brain" : "Brand Core";
  if (view === "list") updateListView();
  if (view === "calendar") renderCalendarView();
  if (view === "insights" || view === "ai_brain") renderCampaignIntelligence();
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
el.activityToggleButton?.addEventListener("click", () => {
  const wasCollapsed = state.activityCollapsed;
  const hadUnreadActivity = getUnreadActivityEntries().length > 0;
  state.activityCollapsed = !state.activityCollapsed;
  renderActivityFeed();
  if (wasCollapsed || hadUnreadActivity) markActivityFeedSeen({ rerender: !state.activityCollapsed });
});

if (el.addNodeButton) {
  el.addNodeButton.addEventListener("click", () => {
    setActiveView("board");
    openTypePicker((type) => {
      createNode({ type });
    }, "Idea");
  });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #add-node-btn");
}

if (el.createCampaignButton) {
  el.createCampaignButton.addEventListener("click", () => {
    openCreateCampaignModal();
  });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #create-campaign-btn");
}

if (el.cycleViewButton) {
  el.cycleViewButton.addEventListener("click", () => {
    const order = ["board", "list", "calendar"];
    const idx = order.indexOf(state.activeView);
    setActiveView(order[(idx + 1) % order.length]);
  });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #cycle-view-btn");
}
if (el.viewMenuButton) {
  el.viewMenuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    el.viewMenu.classList.toggle("hidden");
  });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #view-menu-btn");
}
if (el.viewBoardButton) {
  el.viewBoardButton.addEventListener("click", () => { setActiveView("board"); el.viewMenu.classList.add("hidden"); });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #view-board-btn");
}
if (el.viewListButton) {
  el.viewListButton.addEventListener("click", () => { setActiveView("list"); el.viewMenu.classList.add("hidden"); });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #view-list-btn");
}
if (el.viewCalendarButton) {
  el.viewCalendarButton.addEventListener("click", () => { setActiveView("calendar"); el.viewMenu.classList.add("hidden"); });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #view-calendar-btn");
}
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

if (el.zoomInButton) {
  el.zoomInButton.addEventListener("click", () => {
    stopFollowForManualNavigation();
    setZoom(state.zoom + 0.1);
  });
} else {
  console.warn("[Funklix DOM Hardening] Missing listener target: #zoom-in-btn");
}
el.googleSigninButton?.addEventListener("click", () => {
  if (!state.authConfigured) {
    setAuthMessage("Google Login is not configured yet.");
    return;
  }
  setAuthMessage("");
  const returnTo = `${window.location.pathname || "/"}${window.location.search || ""}`;
  window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`;
});
el.authSignoutButton?.addEventListener("click", async () => {
  await fetch("/api/auth/session", { method: "DELETE" });
  state.user = null;
  stopPresenceLite();
  state.presenceViewers = [];
  renderPresenceLite();
  clearNodePresenceBadges();
  setAuthMessage("");
  renderAuthState();
});
el.authAvatar?.addEventListener("error", () => {
  el.authAvatar.classList.add("hidden");
  if (el.authAvatarFallback) el.authAvatarFallback.classList.remove("hidden");
});

el.claimBoardButton?.addEventListener("click", async () => {
  const boardId = state.currentBoardId || getBoardIdFromPath();
  if (!boardId || !state.user?.email || state.currentBoardOwnerEmail) return;
  console.debug('[Funklix Save Debug] PATCH claim triggered', { boardId, actorEmail: state.user?.email || null });
  const response = await fetch(`/api/boards/${boardId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: true }) });
  const data = await response.json();
  if (!response.ok) return;
  setSharePanelState(boardId, data?.updated_at ? new Date(data.updated_at) : new Date(), data?.owner_email || state.user.email, data?.owner_name || state.user?.name || null, data?.owner_avatar || state.user?.avatar || null);
  setSaveStatus('Board claimed');
  loadBoardsLibrary();
});

el.zoomOutButton.addEventListener("click", () => {
  stopFollowForManualNavigation();
  setZoom(state.zoom - 0.1);
});

el.canvas.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey) {
      event.preventDefault();
      stopFollowForManualNavigation();
      setZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1), { x: event.clientX, y: event.clientY });
      return;
    }
    event.preventDefault();
    stopFollowForManualNavigation();
    el.canvas.scrollTop += event.deltaY;
    el.canvas.scrollLeft += event.deltaX;
    handleViewportPresenceChange();
  },
  { passive: false }
);

el.canvas.addEventListener("pointermove", handleLocalCursorMove, { passive: true });
el.canvas.addEventListener("pointerleave", () => {
  if (state.presenceCursorClearTimer) clearTimeout(state.presenceCursorClearTimer);
  state.presenceCursorClearTimer = setTimeout(() => clearLocalCursorPresence({ notifyDelayMs: 0 }), 1200);
});
el.canvas.addEventListener("scroll", handleViewportPresenceChange, { passive: true });
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeCollaboratorFollowMenu();
    stopFollowCollaborator("Follow stopped");
  }
});

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

function addPostitToNode(node, position = null) {
  if (!node) return null;
  if (!requireCommentIdentity()) return null;
  if (!Array.isArray(node.postits)) node.postits = [];
  const actor = createCommentPayload("");
  if (!actor) return null;
  const note = {
    id: `postit-${state.postitCounter++}`,
    ...actor,
    color: "#ffe082",
    updatedAt: actor.createdAt,
    x: position?.x ?? ((state.contextBoardPoint?.x || node.position.x + 24) - node.position.x),
    y: position?.y ?? ((state.contextBoardPoint?.y || node.position.y + 48) - node.position.y)
  };
  node.postits.push(note);
  markNodeCommentsSeen(node.id);
  updateNodeCard(node);
  appendActivity("comment_added", { node, userName: actor.authorName });
  saveCampaignCanvasState();
  return note;
}

el.addPostitCommentButton.addEventListener("click", () => {
  el.contextMenu.classList.add("hidden");
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return;
  }
  if (!state.selectedPrimary) return;
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  addPostitToNode(node);
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
    if (state.boardAccess?.canEdit === false) {
      setSaveStatus("Read-only board");
      return;
    }
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
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;

  if (event.target === el.inputs.type) node.type = el.inputs.type.value;
  if (event.target === el.inputs.status) {
    const previousStatus = normalizeNodeStatus(node.status);
    node.status = normalizeNodeStatus(el.inputs.status.value);
    if (previousStatus !== node.status) recordStatusChangedActivity(node, nodeStatusLabel(node.status));
  }
  if (event.target === el.inputs.title) node.title = el.inputs.title.value;
  if (event.target === el.inputs.content) node.content = el.inputs.content.value;
  if (event.target === el.inputs.imagePrompt) node.imagePrompt = el.inputs.imagePrompt.value;
  if (event.target === el.inputs.variants) node.variants = parseList(el.inputs.variants.value);
  if (event.target === el.inputs.platform) node.social.platform = el.inputs.platform.value;
  if (event.target === el.inputs.caption) node.social.caption = el.inputs.caption.value;
  if (event.target === el.inputs.hashtags) state.hashtagDraftByNode[node.id] = el.inputs.hashtags.value;
  if (el.inputs.preview && event.target === el.inputs.preview) node.social.preview = el.inputs.preview.value;
  if (event.target === el.inputs.audience) node.audience = el.inputs.audience.value.trim();
  if (event.target === el.inputs.goal) node.goal = el.inputs.goal.value.trim();
  if (event.target === el.inputs.channel) node.channel = el.inputs.channel.value.trim();
  if (event.target === el.inputs.funnelStage) node.funnelStage = el.inputs.funnelStage.value.trim();
  if (event.target === el.inputs.tone) node.tone = el.inputs.tone.value.trim();
  if (event.target === el.inputs.contentFormat) node.contentFormat = el.inputs.contentFormat.value || "1:1";
  if (event.target === el.inputs.owner) {
    const before = { ownerEmail: node.ownerEmail, ownerName: node.ownerName, ownerAvatar: node.ownerAvatar };
    const nextOwner = ownerFromSelect(el.inputs.owner);
    setNodeOwner(node, nextOwner);
    if (!ownersAreEqual(before, node)) recordOwnerChangedActivity(node, nextOwner);
  }
  if (!node.landingPage) node.landingPage = { headerVisualPrompt: "", headerClaim: "", problem: "", solution: "", trust: "", cta: "" };
  if (event.target === el.inputs.lpHeaderVisualPrompt) node.landingPage.headerVisualPrompt = el.inputs.lpHeaderVisualPrompt.value;
  if (event.target === el.inputs.lpHeaderClaim) node.landingPage.headerClaim = el.inputs.lpHeaderClaim.value;
  if (event.target === el.inputs.lpProblem) node.landingPage.problem = el.inputs.lpProblem.value;
  if (event.target === el.inputs.lpSolution) node.landingPage.solution = el.inputs.lpSolution.value;
  if (event.target === el.inputs.lpTrust) node.landingPage.trust = el.inputs.lpTrust.value;
  if (event.target === el.inputs.lpCta) node.landingPage.cta = el.inputs.lpCta.value;

  updateNodeCard(node);
  updateListView();
  const shouldRefreshInspector = event.target === el.inputs.type
    || event.target === el.inputs.platform
    || event.target === el.inputs.contentFormat
    || event.target === el.inputs.status
    || event.target === el.inputs.owner;
  if (shouldRefreshInspector) fillInspector(node);
  if (event.target !== el.inputs.status && event.target !== el.inputs.owner) recordNodeUpdatedActivity(node);
  saveCampaignCanvasState();
});

el.inputs.owner?.addEventListener("focus", refreshOwnerSelectorIdentities);
el.inputs.owner?.addEventListener("pointerdown", refreshOwnerSelectorIdentities);

el.inputs.owner?.addEventListener("change", (event) => {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    fillInspector(getNode(state.selectedPrimary));
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  const before = { ownerEmail: node.ownerEmail, ownerName: node.ownerName, ownerAvatar: node.ownerAvatar };
  const nextOwner = ownerFromSelect(event.target);
  setNodeOwner(node, nextOwner);
  if (!ownersAreEqual(before, node)) {
    recordOwnerChangedActivity(node, nextOwner);
    updateNodeCard(node);
    updateListView();
    refreshNodeSearchUI();
    saveCampaignCanvasState();
  }
});

el.inputs.channel.addEventListener("keydown", (event) => {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  const value = el.inputs.channel.value.trim();
  if (!value) return;
  pushHistorySnapshot();
  node.channel = value;
  recordNodeUpdatedActivity(node);
  updateNodeCard(node);
  fillInspector(node);
  saveCampaignCanvasState();
});
el.inputs.hashtags.addEventListener("blur", () => {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  const normalized = normalizeHashtagsInput(state.hashtagDraftByNode[node.id] ?? el.inputs.hashtags.value);
  node.social.hashtags = normalized;
  delete state.hashtagDraftByNode[node.id];
  el.inputs.hashtags.value = normalized.join(", ");
  updateNodeCard(node);
  recordNodeUpdatedActivity(node);
  saveCampaignCanvasState();
});
el.inputs.hashtags.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  el.inputs.hashtags.blur();
});

el.imageUpload.addEventListener("change", () => {
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    el.imageUpload.value = "";
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  const addedImages = [...el.imageUpload.files]
    .filter((file) => file.type.startsWith("image/"))
    .map((file) => ({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }));
  if (!addedImages.length) {
    el.imageUpload.value = "";
    return;
  }
  node.images.push(...addedImages);
  el.imageUpload.value = "";
  appendActivity("media_added", { node });
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
el.generateNextStepInspectorButton?.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  await generateNextStepFromNode(node, el.generateNextStepInspectorButton);
  updateInspectorActionVisibility();
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
el.regeneratePlatformButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Social Media Posting") return;
  await regenerateSocialForPlatform(node, el.regeneratePlatformButton);
});
el.addToPostingCalendarButton.addEventListener("click", () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Social Media Posting") return;
  openSchedulePostModal(node.id);
});
el.generateImageButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Content") return;
  await generateImageForNode(node);
});
el.generateFullPackButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Content") return;
  await handleGenerateFullContentPack(node.id);
});
el.generateHeaderVisualButton.addEventListener("click", async () => {
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Landing Page") return;
  if (!node.landingPage?.headerVisualPrompt?.trim()) return;
  const btn = el.generateHeaderVisualButton;
  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Generating...";
  try {
    const response = await fetch("/api/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nodeTitle: node.title || "",
        nodeContent: node.landingPage.headerVisualPrompt,
        brandBrainData: state.brandCore,
        campaignContext: getCampaignContextSummary(),
        contentFormat: "16:9",
        connectedNodeContext: getConnectedNodeContext(node.id)
      })
    });
    if (!response.ok) throw new Error("Header visual failed");
    const data = await response.json();
    const imageUrl = data?.imageUrl || data?.url || "";
    if (!imageUrl) throw new Error("Empty image URL");
    node.images = Array.isArray(node.images) ? node.images : [];
    node.images.push({ id: crypto.randomUUID(), url: imageUrl, name: "landing-header.png", createdAt: Date.now(), source: "generated" });
    updateNodeCard(node);
    fillInspector(node);
    saveCampaignCanvasState();
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
});
el.generatePostingVisualButton.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node || node.type !== "Social Media Posting") return;
  await generatePostingVisualForNode(node);
});
el.deleteSelectedButton.addEventListener("click", () => {
  if (!state.selectedIds.size) return;
  pushHistorySnapshot();
  const selectedIds = [...state.selectedIds];
  const removedNodes = selectedIds.map((id) => removeNode(id, { logActivity: false })).filter(Boolean);
  if (removedNodes.length === 1) {
    appendActivity("node_deleted", { nodeId: removedNodes[0].id, nodeTitle: activityNodeTitle(removedNodes[0]) });
    saveCampaignCanvasState();
  } else if (removedNodes.length > 1) {
    appendActivity("node_deleted", { nodeTitle: `${removedNodes.length} nodes` });
    saveCampaignCanvasState();
  }
});
el.disconnectSelectedButton.addEventListener("click", () => {
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return;
  }
  if (!state.selectedIds.size) return;
  pushHistorySnapshot();
  const removedEdges = state.edges.filter(([a, b]) => state.selectedIds.has(a) || state.selectedIds.has(b));
  state.edges = state.edges.filter(([a, b]) => !state.selectedIds.has(a) && !state.selectedIds.has(b));
  if (removedEdges.length === 1) {
    appendActivity("edge_disconnected", { nodeId: removedEdges[0][1], nodeTitle: edgeActivityTitle(removedEdges[0][0], removedEdges[0][1]) });
  } else if (removedEdges.length > 1) {
    appendActivity("edge_disconnected", { nodeTitle: `${removedEdges.length} connections` });
  }
  state.nodes.forEach(updateNodeCard);
  drawLinks();
  saveCampaignCanvasState();
});
el.propagateDescendantsButton.addEventListener("click", () => {
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    return;
  }
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  if (downstreamNodeIds(node.id).length === 0) return;
  pushHistorySnapshot();
  propagateNodeChangesDownward(node);
  fillInspector(node);
  saveCampaignCanvasState();
});
el.compactAllButton?.addEventListener("click", () => {
  pushHistorySnapshot();
  setCompactModeForAllNodes(true);
});
el.expandAllButton?.addEventListener("click", () => {
  pushHistorySnapshot();
  setCompactModeForAllNodes(false);
});
el.nodeSearchInput?.addEventListener("input", (event) => {
  state.nodeSearchQuery = event.target.value || "";
  refreshNodeSearchUI();
});
el.nodeSearchInput?.addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  const firstMatch = state.nodes.find((node) => nodeMatchesSearchAndFilters(node));
  if (!firstMatch) return;
  setActiveView("board");
  state.selectedIds.clear();
  state.selectedIds.add(firstMatch.id);
  state.selectedPrimary = firstMatch.id;
  updateSelectionClasses();
  fillInspector(firstMatch);
  forceNodeVisible(firstMatch.id);
});
el.zoomLayer.addEventListener("click", async (event) => {
  const quickBtn = event.target.closest(".node-ai-toolbar button");
  if (!quickBtn) return;
  const nodeEl = quickBtn.closest(".node");
  const node = nodeEl ? getNode(nodeEl.dataset.id) : null;
  if (!node) return;
  if (quickBtn.dataset.quickWired === "1") return;
  event.stopPropagation();
  const label = (quickBtn.textContent || "").trim();
  if (label === "Generate Full Content Pack") {
    await handleGenerateFullContentPack(node.id);
    return;
  }
  if (label === "🧠 Generate Next Step") {
    await generateNextStepFromNode(node, quickBtn);
    return;
  }
  const map = {
    "✨ Improve": "Improve this node while keeping the original intent.",
    "🔄 Regenerate": "Regenerate this node as a fresh alternative version while keeping it aligned with the campaign context and brand voice.",
    "Shorter": "Make this shorter and more concise.",
    "Emotional": "Make this more emotional and engaging.",
    "Direct": "Make this more direct and clear."
  };
  const instruction = map[label];
  if (!instruction) return;
  await runInlineRefine(node, instruction, quickBtn);
});
el.filtersToggleButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const existing = document.getElementById("floating-filters-popover");
  if (existing) return closeFiltersPopover();
  const popover = document.createElement("div");
  popover.id = "floating-filters-popover";
  popover.className = "floating-filter-popover";
  popover.innerHTML = buildFiltersPopoverHtml();
  const rect = el.filtersToggleButton.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.max(10, rect.right - 430)}px`;
  popover.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-filter-group][data-filter-value]");
    if (!btn) return;
    const group = btn.dataset.filterGroup;
    const value = btn.dataset.filterValue;
    const groupSet = state.nodeFilters[group];
    if (!groupSet) return;
    if (groupSet.has(value)) groupSet.delete(value);
    else groupSet.add(value);
    btn.classList.toggle("active", groupSet.has(value));
    refreshNodeSearchUI();
    syncPopoverActiveStates(popover);
  });
  document.body.appendChild(popover);
  syncPopoverActiveStates(popover);
});
el.utilitiesToggleButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const existing = document.getElementById("floating-utilities-popover");
  if (existing) return closeUtilitiesPopover();
  const popover = document.createElement("div");
  popover.id = "floating-utilities-popover";
  popover.className = "floating-filter-popover";
  popover.innerHTML = buildUtilitiesPopoverHtml();
  const rect = el.utilitiesToggleButton.getBoundingClientRect();
  popover.style.top = `${rect.bottom + 8}px`;
  popover.style.left = `${Math.max(10, rect.right - 260)}px`;
  popover.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-utility-action]");
    if (!btn) return;
    if (btn.dataset.utilityAction === "duplicate-board") {
      duplicateCurrentBoard();
      closeUtilitiesPopover();
      return;
    }
    if (btn.dataset.utilityAction === "fit-board") {
      fitBoardContentToViewport();
      closeUtilitiesPopover();
      return;
    }
    if (btn.dataset.utilityAction === "auto-arrange") {
      autoArrangeBoardByHierarchy();
      closeUtilitiesPopover();
      return;
    }
    const map = {
      "save-board": el.saveBoardButton,
      "new-board": el.newBoardButton,
      "reset-board": el.resetBoardButton,
      "compact-all": el.compactAllButton,
      "expand-all": el.expandAllButton,
      "board-view": el.viewBoardButton,
      "list-view": el.viewListButton,
      "calendar-view": el.viewCalendarButton,
      "copy-link": el.copyBoardLinkButton
    };
    const targetBtn = map[btn.dataset.utilityAction];
    if (!targetBtn || targetBtn.disabled || targetBtn.offsetParent === null && btn.dataset.utilityAction === "copy-link") return;
    targetBtn.click();
    closeUtilitiesPopover();
  });
  document.body.appendChild(popover);
});
document.addEventListener("click", (event) => {
  if (event.target.closest("#floating-filters-popover, #filters-toggle-btn")) return;
  if (event.target.closest("#floating-utilities-popover, #utilities-toggle-btn")) return;
  closeFiltersPopover();
  closeUtilitiesPopover();
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
  let hadPointerMove = false;
  const forcePan = state.forcePanNextDrag;

  const rect = el.canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const box = document.createElement("div");
  box.className = "selection-box";
  el.canvas.appendChild(box);

  function move(ev) {
    hadPointerMove = true;
    const panDx = ev.clientX - panX;
    const panDy = ev.clientY - panY;
    const holdMs = Date.now() - downAt;
    const movedEnough = Math.abs(panDx) > 4 || Math.abs(panDy) > 4;
    if (appendSelection && !selectionLocked && movedEnough) {
      selectionLocked = true;
    }
    if (!appendSelection && !selectionLocked && (forcePan || holdMs > 450) && movedEnough) {
      if (!panning) stopFollowForManualNavigation();
      panning = true;
      el.canvas.scrollLeft = startLeft - panDx;
      el.canvas.scrollTop = startTop - panDy;
      handleViewportPresenceChange();
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
      const isEmptyCanvasClick = !hadPointerMove && !appendSelection;
      if (isEmptyCanvasClick) {
        state.selectedIds.clear();
        state.selectedPrimary = null;
        updateSelectionClasses();
      }
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
el.postingDoneButton.addEventListener("click", confirmSchedulePost);
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
el.insightsNavButton?.addEventListener("click", () => {
  setAppMode("canvas");
  setActiveView("insights");
});
el.aiBrainNavButton?.addEventListener("click", () => {
  setAppMode("canvas");
  setActiveView("ai_brain");
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
    const claimBtn = event.target.closest('[data-claim-board]');
    if (claimBtn) {
      const id = claimBtn.getAttribute('data-claim-board');
      if (id && state.user?.email) {
        const response = await fetch(`/api/boards/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ claim: true }) });
        if (response.ok) loadBoardsLibrary();
      }
    }

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
el.duplicateBoardCtaButton?.addEventListener("click", () => duplicateCurrentBoard());
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
  const nowIso = new Date().toISOString();
  return { nodes: [], edges: [], nodeCounter: 1, postitCounter: 1, zoom: 1, schemaVersion: 1, metadata: { createdAt: nowIso, updatedAt: nowIso } };
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
  if (!state.user?.email) {
    setAuthMessage("Sign in with Google to create a board.");
    setSaveStatus("Sign in with Google to create a board.");
    return;
  }
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
  if (response.status === 401) {
    setAuthMessage("Sign in with Google to create a board.");
    setSaveStatus("Sign in with Google to create a board.");
    return;
  }
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
  if (state.user?.email) {
    if (el.boardsLibraryTitle) el.boardsLibraryTitle.textContent = 'My Boards';
    if (el.boardsLibrarySubtitle) el.boardsLibrarySubtitle.textContent = 'Your boards first, then shared boards.';
  } else {
    if (el.boardsLibraryTitle) el.boardsLibraryTitle.textContent = 'Boards';
    if (el.boardsLibrarySubtitle) el.boardsLibrarySubtitle.textContent = 'Open a board or sign in to save one to your account.';
  }
  if (!state.boardsLibrary.length) {
    el.boardsLibraryList.innerHTML = `<div class="board-empty"><strong>No boards yet</strong><span>Create your first board to start collaborating.</span></div>`;
    return;
  }
  state.boardsLibrary.forEach((board, index) => {
    const row = document.createElement('div');
    row.className = 'board-row';
    const savedAt = board.updated_at ? new Date(board.updated_at).toLocaleString('de-DE') : '—';
    const boardName = board.name || 'Campaign Canvas Board';
    const userEmail = typeof state.user?.email === "string" ? state.user.email.trim().toLowerCase() : "";
    const ownerEmail = typeof board.owner_email === "string" ? board.owner_email.trim().toLowerCase() : "";
    const accessRole = board.access_role || "";
    const isOwner = accessRole === "owner" || (!!userEmail && !!ownerEmail && ownerEmail === userEmail);
    const isEditor = accessRole === "editor";
    const isShared = !!board.owner_email && !isOwner;
    const isCopy = /\(copy\)$/i.test(boardName.trim());
    const ownerBy = deriveOwnerDisplayName(board.owner_name || "", board.owner_email || "");
    const roleChip = isOwner ? '<span class="board-row-chip owned">Your Board</span>' : (isEditor ? '<span class="board-row-chip shared">Editor</span>' : (isShared ? '<span class="board-row-chip shared">Shared</span>' : '<span class="board-row-chip shared">Open</span>'));
    const copyChip = isCopy ? '<span class="board-row-chip copy">Copy</span>' : '';
    const ownerLine = isOwner ? 'You can edit this board.' : (isEditor ? `By ${ownerBy || 'another user'}` : (isShared ? `By ${ownerBy || 'another user'}` : 'No owner yet'));
    row.innerHTML = `<div><div class="board-row-titleline"><strong class="board-row-title">${boardName}</strong>${roleChip}${copyChip}</div><div class="board-row-meta">Last active: ${savedAt}</div><div class="board-row-meta">${ownerLine}</div><div class="board-rename hidden" data-rename-wrap="${board.id}"><input data-rename-input="${board.id}" value="${board.name || ''}" /><button data-rename-save="${board.id}" type="button">Save</button><button data-rename-cancel="${board.id}" type="button">Cancel</button></div></div><div class="board-row-actions"><button class="icon-btn" data-open-board="${board.id}" title="Open" aria-label="Open board">↗</button><button class="icon-btn" data-copy-board="${board.id}" title="Copy link" aria-label="Copy link">⧉</button><button class="icon-btn" data-rename-board="${board.id}" title="Rename" aria-label="Rename board">✎</button><button class="icon-btn danger" data-delete-board="${board.id}" title="Delete" aria-label="Delete board">🗑</button><button class="icon-btn" data-up-board="${board.id}" data-index="${index}" title="Move up">↑</button><button class="icon-btn" data-down-board="${board.id}" data-index="${index}" title="Move down">↓</button>${state.user?.email && !board.owner_email ? `<button class="icon-btn" data-claim-board="${board.id}" title="Claim">Claim</button>` : ""}</div>`;
    el.boardsLibraryList.appendChild(row);
  });
}

async function renameBoard(boardId, name) {
  console.debug('[Funklix Save Debug] PATCH rename triggered', { boardId, name });
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
  console.debug('[Funklix Save Debug] PATCH reorder triggered', { boardId, direction, index });
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

async function bootApp() {
  state.isBoardLoading = true;
  diagnoseDomDependencies();
  createDebugPanel();
  await loadSessionUser();
  if (new URLSearchParams(window.location.search).get("auth_error") === "not_configured") setAuthMessage("Google Login is not configured yet.");
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
  applyCanvasZoom(state.zoom);
  renderCampaignCanvasFromStateIfNeeded();
  renderBrandCoreTiles();
  renderBrandCoreEditor();
  renderActivityFeed();
  updateEmptyState();
  updateListView();
  fillInspector(null);
  setAppMode("canvas");
  setActiveView("board");
  drawLinks();
  // URL/server-loaded boards refresh snapshot after applyCampaignState(); avoid capturing pre-load snapshot while in-flight.
  if (!state.initialServerLoadInFlight) refreshLastSavedSnapshot();
  if (!state.initialServerLoadInFlight) state.isBoardLoading = false;
  startAutosaveWatcher();
  bindEditingPresenceTracking();
  startPresenceLite();
  startBoardRefreshPolling();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void bootApp(); });
else void bootApp();
