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
  ,session: {
    workspaceId: null,
    // Active Brand runtime is intentionally not implemented yet; keep brandId null until a canonical Brand owner exists.
    brandId: null,
    boardId: null,
    source: "initial",
    isInitialized: false
  }
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
  ,isBoardHydrating: false
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
    brandDNA: null,
    customTiles: []
  },
  brandCoreSelectedKey: "brandCore"
  ,brandDnaDraft: null
  ,brandDnaLoading: false
  ,brandAvatarLoading: false
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
  ,activeCampaignGeneration: null
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
  ,aiReviewFixPreviews: {}
  ,runtimeDiagnostics: {
    canvasSource: "empty/default state",
    startupBranch: "unknown",
    pathBoardId: null,
    localDraft: {
      exists: false,
      restored: false,
      reason: ""
    },
    boardOwnership: {
      hasBrandOwner: false,
      brandId: null,
      source: "not-implemented",
      reason: "boards-have-no-canonical-brand-field"
    }
  }
};

const el = {
  appShell: document.querySelector(".app-shell"),
  leftSidebar: document.getElementById("left-sidebar"),
  workspaceWrap: document.querySelector(".workspace-wrap"),
  dashboardView: document.getElementById("dashboard-view"),
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
  aiWorkspaceSection: document.getElementById("ai-workspace-section"),
  aiWorkspaceBody: document.getElementById("ai-workspace-body"),
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
  reviewNodeButton: document.getElementById("review-node-btn"),
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
  homeNavButton: document.getElementById("home-nav-btn"),
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
    setPassiveBoardOwnershipDiagnostics(data, "save-as-new-response");
    state.currentBoardId = newId;
    syncRuntimeSessionFromLegacy("save-as-new");
    saveBrandBrainState({ markDirty: false });
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
    brand_core_snapshot: serializeBrandCoreSnapshot()
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
    setPassiveBoardOwnershipDiagnostics(data, "duplicate-board-response");
    state.currentBoardId = newId;
    syncRuntimeSessionFromLegacy("duplicate-board");
    saveBrandBrainState({ markDirty: false });
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
    ai_reviewed_node: `reviewed ${title}`,
    generated_campaign_chain: `generated campaign chain from ${title}`,
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
    refreshDashboardIfVisible();
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
  refreshDashboardIfVisible();
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
    x: Math.max(40, Math.min(12000, x)),
    y: Math.max(40, Math.min(8000, y))
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




function buildLastSavedSnapshot() {
  return JSON.stringify({
    canvas_json: serializeState(),
    brand_core_snapshot: serializeBrandCoreSnapshot()
  });
}

function refreshLastSavedSnapshot() {
  state.lastSavedSnapshot = buildLastSavedSnapshot();
}

function detectDirtyFromSnapshot() {
  if (state.isBoardLoading) { return; }
  if (state.isBoardHydrating) { return; }
  if (state.initialServerLoadInFlight) { return; }
  if (state.isSaving) { return; }
  if (state.conflictModalOpen) { return; }

  const currentSnapshot = buildLastSavedSnapshot();
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
  if (state.isBoardLoading) { return; }
  if (state.isBoardHydrating) { return; }
  if (state.initialServerLoadInFlight) { return; }
  if (state.conflictModalOpen) { return; }
  if (state.autosavePausedUntilChange) { return; }
  if (state.boardAccess?.canEdit === false) { return; }
  if (state.isSaving) { return; }
  if (state.autosaveTimer) return;
  console.debug('[Funklix Save Debug] Autosave scheduled', {
    isDirty: state.isDirty,
    isSaving: state.isSaving,
    lastKnownUpdatedAt: state.lastKnownUpdatedAt,
    currentBoardId: resolveExistingBoardId()
  });
  state.autosaveTimer = setTimeout(() => {
    state.autosaveTimer = null;
    console.debug('[Funklix Save Debug] Autosave fired', {
      isDirty: state.isDirty,
      isSaving: state.isSaving,
      lastKnownUpdatedAt: state.lastKnownUpdatedAt,
      currentBoardId: resolveExistingBoardId()
    });
    if (!state.isDirty) { return; }
    if (state.isBoardLoading) { return; }
    if (state.isBoardHydrating) { return; }
    if (state.initialServerLoadInFlight) { return; }
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

function resolveExistingBoardId() {
  return state.currentBoardId || getBoardIdFromPath();
}

function resolveBoardPersistenceTarget() {
  const pathname = window.location.pathname || '';
  const pathBoardId = pathname.startsWith('/boards/')
    ? decodeURIComponent(pathname.replace(/^\/boards\//, '').split('/')[0]).trim()
    : null;
  const boardId = state.currentBoardId || pathBoardId || getBoardIdFromPath();
  const isUpdate = Boolean(boardId);
  return {
    boardId,
    isUpdate,
    endpoint: isUpdate ? `/api/boards/${boardId}` : '/api/boards',
    method: isUpdate ? 'PUT' : 'POST'
  };
}

function syncRuntimeSessionFromLegacy(source = "legacy-runtime") {
  const legacyBoardId = resolveExistingBoardId() || null;
  state.session = {
    workspaceId: null,
    brandId: null,
    boardId: legacyBoardId,
    source,
    isInitialized: true
  };
  return state.session;
}

function readPassiveBrandIdFromBoardPayload(boardPayload = {}) {
  const candidates = [
    { field: "brandId", value: boardPayload?.brandId },
    { field: "brand_id", value: boardPayload?.brand_id }
  ];
  const match = candidates.find(({ value }) => typeof value === "string" && value.trim());
  if (!match) return { brandId: null, field: null };
  return { brandId: match.value.trim(), field: match.field };
}

function buildPassiveBoardOwnershipDiagnostics(boardPayload = null, source = "runtime") {
  const { brandId, field } = readPassiveBrandIdFromBoardPayload(boardPayload || {});
  if (brandId) {
    return {
      hasBrandOwner: true,
      brandId,
      source,
      reason: "brand-field-present-passive-only",
      field,
      trustedForBehavior: false
    };
  }
  const hasBoardContext = Boolean(boardPayload?.id || resolveExistingBoardId());
  if (!hasBoardContext) {
    return {
      hasBrandOwner: false,
      brandId: null,
      source: "none",
      reason: "no-board-loaded"
    };
  }
  return {
    hasBrandOwner: false,
    brandId: null,
    source: "not-implemented",
    reason: "boards-have-no-canonical-brand-field"
  };
}

function setPassiveBoardOwnershipDiagnostics(boardPayload = null, source = "runtime") {
  const ownership = buildPassiveBoardOwnershipDiagnostics(boardPayload, source);
  state.runtimeDiagnostics.boardOwnership = ownership;
  return ownership;
}

function getPassiveBoardOwnershipDiagnostics() {
  return state.runtimeDiagnostics?.boardOwnership || buildPassiveBoardOwnershipDiagnostics(null, "runtime");
}

function getPassiveBrandSessionReadiness() {
  let hasBrandBrainLocalStorage = false;
  try {
    hasBrandBrainLocalStorage = Boolean(localStorage.getItem(brandBrainStorageKey()));
  } catch {
    hasBrandBrainLocalStorage = false;
  }
  return {
    exists: false,
    brandId: null,
    source: "not-implemented",
    reason: "no-canonical-brand-runtime",
    evidence: {
      hasBrandCoreState: Boolean(state.brandCore && typeof state.brandCore === "object"),
      hasBrandBrainLocalStorage,
      note: "Brand Core / Brand Brain data exists, but it is not a canonical Active Brand identity."
    }
  };
}

function getRuntimeCanvasSource() {
  if (state.runtimeDiagnostics?.canvasSource) return state.runtimeDiagnostics.canvasSource;
  if (state.currentBoardId || getBoardIdFromPath()) return "/boards/:id";
  if (state.nodes.length || state.edges.length) return "unknown";
  return "empty/default state";
}

function getActiveContext() {
  const pathBoardId = getBoardIdFromPath();
  const boardId = state.session?.boardId || state.currentBoardId || pathBoardId || null;
  const canvasSource = getRuntimeCanvasSource();
  const canvasLoaded = canvasSource !== "empty/default state" || state.nodes.length > 0 || state.edges.length > 0;
  const boardBacked = Boolean(boardId);
  return {
    workspaceId: state.session?.workspaceId || null,
    brandId: state.session?.brandId || null,
    boardId,
    activeView: state.activeView,
    startupSource: state.runtimeDiagnostics?.startupBranch || "unknown",
    boardBacked,
    sessionInitialized: Boolean(state.session?.isInitialized),
    canvasLoaded,
    anonymousCanvas: canvasLoaded && !boardBacked
  };
}

function getRuntimeAutosaveDiagnostics() {
  const currentBoardId = resolveExistingBoardId();
  if (currentBoardId) {
    return {
      mode: "update-existing-board",
      wouldCreateBoard: false,
      reason: "existing-board"
    };
  }
  if (state.boardAccess?.canEdit === false) {
    return {
      mode: "blocked-read-only",
      wouldCreateBoard: false,
      reason: "read-only"
    };
  }
  return {
    mode: "blocked-no-board",
    wouldCreateBoard: false,
    reason: "autosave-update-only",
    lastBlockedAutosave: state.runtimeDiagnostics?.lastBlockedAutosave || null
  };
}

function getNodeRelationshipDiagnostics() {
  const relationshipMap = getNodeRelationshipMap();
  const isolatedNodeCount = Object.keys(relationshipMap.nodesById).filter((nodeId) => {
    return (relationshipMap.incomingByNodeId[nodeId]?.length || 0) === 0
      && (relationshipMap.outgoingByNodeId[nodeId]?.length || 0) === 0;
  }).length;

  return {
    nodeCount: relationshipMap.nodeCount,
    edgeCount: relationshipMap.edgeCount,
    rootCount: relationshipMap.roots.length,
    leafCount: relationshipMap.leaves.length,
    invalidEdgeCount: relationshipMap.invalidEdges.length,
    hasCycles: relationshipMap.hasCycles,
    isolatedNodeCount
  };
}

function buildRuntimeAlignmentDiagnostics() {
  const pathBoardId = getBoardIdFromPath();
  const activeContext = getActiveContext();
  const currentBoardId = activeContext.boardId;
  const runtimeSession = state.session || {};
  const brandSession = getPassiveBrandSessionReadiness();
  const canvasSource = getRuntimeCanvasSource();
  return {
    activeContext,
    currentUser: {
      exists: Boolean(state.user?.email),
      userEmail: state.user?.email || null,
      authConfigured: state.authConfigured !== false
    },
    session: {
      workspaceId: runtimeSession.workspaceId,
      brandId: runtimeSession.brandId,
      boardId: runtimeSession.boardId,
      source: runtimeSession.source,
      isInitialized: runtimeSession.isInitialized
    },
    brandSession,
    legacyRuntime: {
      currentBoardId: state.currentBoardId || null,
      pathBoardId,
      activeView: activeContext.activeView
    },
    sessionRuntime: {
      workspaceId: runtimeSession.workspaceId,
      brandId: runtimeSession.brandId,
      boardId: runtimeSession.boardId,
      source: runtimeSession.source,
      isInitialized: runtimeSession.isInitialized,
      mirrorsLegacyBoardId: runtimeSession.boardId === currentBoardId
    },
    architectureWarnings: brandSession.exists ? [] : ["Active Brand runtime is not implemented; session.brandId intentionally remains null."],
    workspace: {
      exists: false,
      mode: "not-implemented"
    },
    brand: {
      exists: false,
      mode: "not-implemented"
    },
    board: {
      currentBoardId,
      boardAccess: state.boardAccess || null,
      isBoardBacked: activeContext.boardBacked,
      source: currentBoardId ? "/boards/:id" : "none"
    },
    boardOwnership: getPassiveBoardOwnershipDiagnostics(),
    canvas: {
      hasNodes: state.nodes.length > 0,
      nodeCount: state.nodes.length,
      edgeCount: state.edges.length,
      source: canvasSource,
      isBoardBacked: activeContext.boardBacked,
      isAnonymousEditable: activeContext.anonymousCanvas
    },
    relationshipGraph: getNodeRelationshipDiagnostics(),
    autosave: getRuntimeAutosaveDiagnostics(),
    startup: {
      branch: state.runtimeDiagnostics?.startupBranch || "unknown",
      pathBoardId: state.runtimeDiagnostics?.pathBoardId || pathBoardId || null
    },
    localDraft: {
      exists: Boolean(state.runtimeDiagnostics?.localDraft?.exists),
      restored: Boolean(state.runtimeDiagnostics?.localDraft?.restored),
      reason: state.runtimeDiagnostics?.localDraft?.reason || ""
    },
    view: {
      activeView: state.activeView
    }
  };
}

function logRuntimeAlignmentDiagnostics(reason = "manual") {
  const diagnostics = buildRuntimeAlignmentDiagnostics();
  console.info("[Runtime Alignment Diagnostics]", { reason, ...diagnostics });
  return diagnostics;
}

if (typeof window !== "undefined") {
  window.debugRuntimeAlignmentDiagnostics = logRuntimeAlignmentDiagnostics;
  window.debugNodeRelationshipDiagnostics = getNodeRelationshipDiagnostics;
}

function formatDashboardTimestamp(value) {
  if (!value) return "Not available yet";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return "Not available yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(parsed));
}

function getDashboardBoardStatus(activeContext) {
  if (!activeContext.boardBacked) {
    return activeContext.canvasLoaded ? "Local canvas only" : "Not available yet";
  }
  if (state.boardAccess?.canEdit === false) return "View-only board";
  if (state.boardAccess?.reason === "owner") return "Owned board";
  if (state.boardAccess?.reason === "editor") return "Editable board";
  if (state.boardAccess?.reason === "unowned") return "Claim available";
  return "Board-backed";
}

const DASHBOARD_CAMPAIGN_STATUS_BUCKETS = [
  { key: "completed", label: "Completed" },
  { key: "inReview", label: "In Review" },
  { key: "draft", label: "Draft" },
  { key: "needsChanges", label: "Needs Changes" },
  { key: "other", label: "Other" }
];

const DASHBOARD_CAMPAIGN_TYPE_BUCKETS = [
  { key: "ideas", label: "Ideas" },
  { key: "campaignVariations", label: "Campaign Variations" },
  { key: "content", label: "Content" },
  { key: "socialPosts", label: "Social Posts" },
  { key: "landingPages", label: "Landing Pages" },
  { key: "emailCampaigns", label: "Email Campaigns" },
  { key: "other", label: "Other" }
];

function getDashboardCampaignStatusBucket(status) {
  const value = String(status || "").trim().toLowerCase();
  if (["approved", "published", "done", "completed", "complete"].includes(value)) return "completed";
  if (["in review", "review", "in-review", "in_review"].includes(value)) return "inReview";
  if (["needs changes", "needs change", "changes", "needs-changes", "needs_changes"].includes(value)) return "needsChanges";
  if (!value || value === "draft") return "draft";
  return "other";
}

function getDashboardCampaignTypeBucket(type) {
  const value = String(type || "").trim().toLowerCase();
  if (value === "idea" || value === "ideas") return "ideas";
  if (value === "campaign variation" || value === "campaign variations") return "campaignVariations";
  if (value === "content") return "content";
  if (["social media posting", "social media post", "social post", "social posts"].includes(value)) return "socialPosts";
  if (value === "landing page" || value === "landing pages") return "landingPages";
  if (value === "email campaign" || value === "email campaigns") return "emailCampaigns";
  return "other";
}

function getDashboardCampaignHealthModel(nodes = []) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  const totalNodes = safeNodes.length;
  const statusCounts = DASHBOARD_CAMPAIGN_STATUS_BUCKETS.reduce((counts, bucket) => ({ ...counts, [bucket.key]: 0 }), {});
  const typeCounts = DASHBOARD_CAMPAIGN_TYPE_BUCKETS.reduce((counts, bucket) => ({ ...counts, [bucket.key]: 0 }), {});

  safeNodes.forEach((node) => {
    statusCounts[getDashboardCampaignStatusBucket(node?.status)] += 1;
    typeCounts[getDashboardCampaignTypeBucket(node?.type)] += 1;
  });

  const completedNodes = statusCounts.completed;
  const progressPercent = totalNodes ? Math.round((completedNodes / totalNodes) * 100) : 0;

  return {
    totalNodes,
    completedNodes,
    progressPercent,
    remainingNodes: Math.max(0, totalNodes - completedNodes),
    progressCopy: `${completedNodes} approved · ${Math.max(0, totalNodes - completedNodes)} remaining`,
    statusBuckets: DASHBOARD_CAMPAIGN_STATUS_BUCKETS
      .map((bucket) => ({ ...bucket, count: statusCounts[bucket.key] || 0 }))
      .filter((bucket) => bucket.key !== "other" || bucket.count > 0),
    typeBuckets: DASHBOARD_CAMPAIGN_TYPE_BUCKETS
      .map((bucket) => ({ ...bucket, count: typeCounts[bucket.key] || 0 }))
      .filter((bucket) => bucket.count > 0)
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  };
}

function getDashboardCampaignSummaryText(value, maxLength = 220) {
  const text = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function getDashboardNodeSummaryText(node) {
  if (!node || typeof node !== "object") return "";
  return getDashboardCampaignSummaryText(node.description || node.content || node.title || "");
}

function findDashboardCampaignSummaryNode(nodes = []) {
  const safeNodes = Array.isArray(nodes) ? nodes : [];
  return safeNodes.find((node) => getDashboardCampaignTypeBucket(node?.type) === "ideas" && !node?.parentId && getDashboardNodeSummaryText(node))
    || safeNodes.find((node) => getDashboardCampaignTypeBucket(node?.type) === "ideas" && getDashboardNodeSummaryText(node))
    || safeNodes.find((node) => String(node?.type || "").toLowerCase().includes("campaign") && getDashboardNodeSummaryText(node))
    || safeNodes.find((node) => getDashboardNodeSummaryText(node))
    || null;
}

function getDashboardCampaignFieldValue(nodes = [], field = "", preferredNode = null) {
  const candidates = [preferredNode, ...(Array.isArray(nodes) ? nodes : [])].filter(Boolean);
  for (const node of candidates) {
    const value = getDashboardCampaignSummaryText(node?.[field], 120);
    if (value) return value;
  }
  return "";
}

function getDashboardCampaignSummaryModel(nodes = [], hasCampaign = false) {
  const summaryNode = findDashboardCampaignSummaryNode(nodes);
  const summary = summaryNode
    ? [getDashboardNodeSummaryText(summaryNode)].filter(Boolean)
    : ["This campaign is ready to continue. Open the Campaign Canvas to keep building."];

  return {
    isFallback: !summaryNode,
    paragraphs: hasCampaign ? summary : [],
    fields: hasCampaign ? [
      { label: "Primary Objective", value: getDashboardCampaignFieldValue(nodes, "goal", summaryNode) },
      { label: "Primary Audience", value: getDashboardCampaignFieldValue(nodes, "audience", summaryNode) },
      { label: "Channel", value: getDashboardCampaignFieldValue(nodes, "channel", summaryNode) }
    ].filter((field) => field.value) : []
  };
}

function getDashboardUserFirstName() {
  const displayName = typeof state.user?.name === "string" ? state.user.name.trim() : "";
  if (!displayName) return "";
  if (displayName.toLowerCase() === "google user") return "";
  return displayName.split(/\s+/)[0]?.slice(0, 32) || "";
}

function getCleanDashboardAvatarText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getDashboardAvatarInitial(value) {
  const source = getCleanDashboardAvatarText(value);
  if (!source) return "";
  const alphaNumeric = source.match(/[A-Za-z0-9]/u)?.[0] || "";
  return alphaNumeric.toUpperCase();
}

function getSafeDashboardAvatarImageUrl(value) {
  const url = getCleanDashboardAvatarText(value);
  if (!url) return "";
  if (/^(https?:|data:image\/|blob:)/i.test(url)) return url;
  return "";
}

function resolveDashboardHeroAvatar() {
  const brandCore = state.brandCore && typeof state.brandCore === "object" && !Array.isArray(state.brandCore) ? state.brandCore : {};
  const brandDNA = brandCore.brandDNA && typeof brandCore.brandDNA === "object" && !Array.isArray(brandCore.brandDNA) ? brandCore.brandDNA : {};
  const brandAssets = brandCore.brandAssets && typeof brandCore.brandAssets === "object" && !Array.isArray(brandCore.brandAssets) ? brandCore.brandAssets : {};
  const avatar = brandDNA.avatar && typeof brandDNA.avatar === "object" && !Array.isArray(brandDNA.avatar) ? brandDNA.avatar : {};
  const acceptedAvatarImageUrl = getSafeDashboardAvatarImageUrl(getApprovedBrandAvatarUrl());
  if (acceptedAvatarImageUrl) return { imageUrl: acceptedAvatarImageUrl, initial: "", source: "accepted-brand-avatar-image" };

  const brandAvatarInitial = [
    avatar.initial,
    avatar.icon,
    brandDNA.initial,
    brandDNA.icon,
    brandCore.avatarInitial,
    brandCore.avatarIcon,
    brandCore.initial,
    brandCore.icon
  ].map(getDashboardAvatarInitial).find(Boolean) || "";
  if (brandAvatarInitial) return { imageUrl: "", initial: brandAvatarInitial, source: "brand-avatar-initial" };

  const brandNameInitial = [
    brandCore.brandName,
    brandCore.name,
    brandCore.title,
    brandDNA.brandName,
    brandDNA.name,
    brandAssets.name,
    brandAssets.domain
  ].map(getDashboardAvatarInitial).find(Boolean) || "";
  if (brandNameInitial) return { imageUrl: "", initial: brandNameInitial, source: "brand-name-initial" };

  const userInitial = getDashboardAvatarInitial(state.user?.name || state.user?.email || "");
  if (userInitial) return { imageUrl: "", initial: userInitial, source: "user-initial" };

  return { imageUrl: "", initial: "B", source: "neutral-brand-fallback" };
}

function renderDashboardHeroAvatar() {
  const avatarEl = document.getElementById("dashboard-hero-avatar");
  if (!avatarEl) return;
  const model = resolveDashboardHeroAvatar();
  avatarEl.dataset.avatarSource = model.source;
  avatarEl.replaceChildren();
  if (model.imageUrl) {
    const img = document.createElement("img");
    img.src = model.imageUrl;
    img.alt = "Brand avatar";
    avatarEl.appendChild(img);
    return;
  }
  const initial = document.createElement("span");
  initial.id = "dashboard-hero-avatar-initial";
  initial.textContent = model.initial || "B";
  avatarEl.appendChild(initial);
}

function getDashboardCampaignDisplayName(activeContext = getActiveContext()) {
  const boardId = activeContext?.boardId;
  const boardName = typeof state.currentBoardName === "string" ? state.currentBoardName.trim() : "";
  if (boardName) return boardName;
  if (boardId) return "Untitled board";
  return "Current campaign";
}

function getDashboardBucketCount(buckets = [], key = "") {
  return buckets.find((bucket) => bucket.key === key)?.count || 0;
}

function getDashboardExecutiveSummaryLine(campaignHealth) {
  if (campaignHealth.progressPercent >= 100) return "Campaign ready.";
  if (campaignHealth.progressPercent > 80) return "You're approaching launch.";
  if (campaignHealth.progressPercent > 50) return "You're making strong progress.";
  if (campaignHealth.progressPercent > 20) return "Momentum is building.";
  if (campaignHealth.progressPercent > 0) return "Your campaign is taking shape.";
  return "Let's build your campaign.";
}

function getDashboardDailyBriefingFocusLine(focusItem = null) {
  return focusItem?.title ? `Today you're focusing on:
${focusItem.title}` : "";
}

function normalizeNodeRelationshipEdge(edge, index = -1) {
  const source = Array.isArray(edge)
    ? edge[0]
    : edge?.from ?? edge?.fromId ?? edge?.source ?? "";
  const target = Array.isArray(edge)
    ? edge[1]
    : edge?.to ?? edge?.toId ?? edge?.target ?? "";

  return {
    index,
    source: typeof source === "string" ? source : String(source || ""),
    target: typeof target === "string" ? target : String(target || ""),
    raw: edge
  };
}

function relationshipMapHasCycles(nodeIds = [], outgoingByNodeId = {}) {
  const visiting = new Set();
  const visited = new Set();

  function visit(nodeId) {
    if (visiting.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;

    visiting.add(nodeId);
    const downstreamIds = outgoingByNodeId[nodeId] || [];
    for (const downstreamId of downstreamIds) {
      if (visit(downstreamId)) return true;
    }
    visiting.delete(nodeId);
    visited.add(nodeId);
    return false;
  }

  return nodeIds.some((nodeId) => visit(nodeId));
}

function getNodeRelationshipMap() {
  const nodesById = {};
  const outgoingByNodeId = {};
  const incomingByNodeId = {};
  const nodeIds = [];

  state.nodes.forEach((node) => {
    if (!node?.id) return;
    nodesById[node.id] = { ...node };
    outgoingByNodeId[node.id] = [];
    incomingByNodeId[node.id] = [];
    nodeIds.push(node.id);
  });

  const invalidEdges = [];
  let edgeCount = 0;

  state.edges.forEach((edge, index) => {
    const normalized = normalizeNodeRelationshipEdge(edge, index);
    const { source, target } = normalized;
    const hasSource = Boolean(source && nodesById[source]);
    const hasTarget = Boolean(target && nodesById[target]);

    if (!hasSource || !hasTarget) {
      invalidEdges.push({
        index,
        source,
        target,
        reason: !source || !target ? "missing-endpoint" : !hasSource ? "missing-source-node" : "missing-target-node",
        edge
      });
      return;
    }

    if (!outgoingByNodeId[source].includes(target)) outgoingByNodeId[source].push(target);
    if (!incomingByNodeId[target].includes(source)) incomingByNodeId[target].push(source);
    edgeCount += 1;
  });

  const roots = nodeIds.filter((nodeId) => incomingByNodeId[nodeId].length === 0);
  const leaves = nodeIds.filter((nodeId) => outgoingByNodeId[nodeId].length === 0);

  return {
    nodesById,
    outgoingByNodeId,
    incomingByNodeId,
    roots,
    leaves,
    nodeCount: nodeIds.length,
    edgeCount,
    hasCycles: relationshipMapHasCycles(nodeIds, outgoingByNodeId),
    invalidEdges
  };
}

function getNodeDownstreamCount(nodeId) {
  if (!nodeId) return 0;
  const relationshipMap = getNodeRelationshipMap();
  return relationshipMap.outgoingByNodeId[nodeId]?.length || 0;
}

function getNodeUpstreamCount(nodeId) {
  if (!nodeId) return 0;
  const relationshipMap = getNodeRelationshipMap();
  return relationshipMap.incomingByNodeId[nodeId]?.length || 0;
}

if (typeof window !== "undefined") {
  window.debugNodeRelationshipMap = getNodeRelationshipMap;
}

function getDashboardEdgeSource(edge) {
  return Array.isArray(edge) ? edge[0] : (edge?.source || edge?.sourceNodeId || edge?.from || edge?.fromNodeId || "");
}

function getDashboardEdgeTarget(edge) {
  return Array.isArray(edge) ? edge[1] : (edge?.target || edge?.targetNodeId || edge?.to || edge?.toNodeId || "");
}

function getDashboardDownstreamNodeCount(nodeId) {
  if (!nodeId) return 0;
  const downstreamIds = new Set();
  state.edges.forEach((edge) => {
    if (getDashboardEdgeSource(edge) === nodeId) {
      const targetId = getDashboardEdgeTarget(edge);
      if (targetId) downstreamIds.add(targetId);
    }
  });
  return downstreamIds.size;
}

function getMissionInsight(focusItem = null, campaignHealth = getDashboardCampaignHealthModel(state.nodes)) {
  const focusNode = focusItem?.id ? getNode(focusItem.id) : null;
  if (focusNode) {
    const downstreamCount = getDashboardDownstreamNodeCount(focusNode.id);
    const statusBucket = getDashboardCampaignStatusBucket(focusNode.status);
    if (downstreamCount > 0) return `Completing this unlocks ${downstreamCount} downstream asset${downstreamCount === 1 ? "" : "s"}.`;
    if (statusBucket === "inReview") return "Approving this moves the campaign forward.";
    if (statusBucket === "needsChanges") return "Resolving feedback keeps downstream work moving.";
    if (statusBucket === "draft" && downstreamCount > 0) return "Publishing this enables the next campaign step.";
    return "This is your highest priority active asset.";
  }
  if (campaignHealth.totalNodes > 0 && campaignHealth.completedNodes === campaignHealth.totalNodes) return "Campaign is ready for launch.";
  if (campaignHealth.progressPercent > 80) return "You're approaching campaign completion.";
  return "";
}

function getDashboardDailyBriefingModel() {
  const activeContext = getActiveContext();
  const isCurrentCanvas = activeContext.boardBacked || activeContext.canvasLoaded;
  const campaignHealth = getDashboardCampaignHealthModel(state.nodes);
  const campaignName = getDashboardCampaignDisplayName(activeContext);
  const firstName = getDashboardUserFirstName();
  const greeting = firstName ? `Hi ${firstName},` : "Hi there,";

  if (!isCurrentCanvas) {
    return {
      greeting,
      subtitle: "Select a board to see your campaign focus.",
      support: "Your briefing will update once a campaign board is active."
    };
  }

  if (campaignHealth.totalNodes === 0) {
    return {
      greeting,
      subtitle: `${campaignName} is ready to build.`,
      support: "Add or generate nodes to create your first campaign health signals."
    };
  }

  const focusItem = getDashboardTodaysFocusActions()[0] || null;
  return {
    greeting,
    subtitle: getDashboardExecutiveSummaryLine(campaignHealth),
    support: "",
    focusLine: getDashboardDailyBriefingFocusLine(focusItem),
    missionInsight: getMissionInsight(focusItem, campaignHealth)
  };
}

function renderDashboardHero() {
  const title = document.getElementById("dashboard-title");
  const subtitle = document.getElementById("dashboard-hero-subtitle");
  const support = document.getElementById("dashboard-hero-support");
  const briefing = getDashboardDailyBriefingModel();
  renderDashboardHeroAvatar();
  if (title) title.textContent = briefing.greeting;
  if (subtitle) subtitle.textContent = briefing.subtitle;
  if (support) {
    support.replaceChildren();
    const hasStructuredBriefing = Boolean(briefing.focusLine || briefing.missionInsight);
    support.classList.toggle("dashboard-hero-briefing", hasStructuredBriefing);
    support.classList.toggle("hidden", !briefing.support && !hasStructuredBriefing);
    if (hasStructuredBriefing) {
      if (briefing.focusLine) {
        const focus = document.createElement("span");
        focus.className = "dashboard-hero-focus-line";
        focus.textContent = briefing.focusLine;
        support.appendChild(focus);
      }
      if (briefing.missionInsight) {
        const insight = document.createElement("span");
        insight.className = "dashboard-hero-mission-insight";
        insight.textContent = briefing.missionInsight;
        support.appendChild(insight);
      }
      return;
    }
    support.textContent = briefing.support || "";
  }
}

function getDashboardContinueWorkingModel() {
  const activeContext = getActiveContext();
  const boardId = activeContext.boardId;
  const hasBoardName = typeof state.currentBoardName === "string" && state.currentBoardName.trim();
  const lastUpdated = state.lastKnownUpdatedAt || state.canvasMetadata?.updatedAt || null;
  const isCurrentCanvas = activeContext.boardBacked || activeContext.canvasLoaded;
  const campaignHealth = getDashboardCampaignHealthModel(state.nodes);
  const hasNoActiveBoard = !isCurrentCanvas;
  const hasEmptyCampaign = isCurrentCanvas && campaignHealth.totalNodes === 0;
  const campaignSummary = getDashboardCampaignSummaryModel(state.nodes, isCurrentCanvas);

  return {
    activeContext,
    title: hasNoActiveBoard
      ? "No board selected"
      : hasEmptyCampaign
        ? "Campaign board is ready."
        : (hasBoardName ? state.currentBoardName.trim() : (boardId ? "Untitled board" : "Current campaign")),
    lastUpdated: formatDashboardTimestamp(lastUpdated),
    campaignHealth,
    campaignSummary,
    nextAction: hasNoActiveBoard
      ? "Select a board to continue your campaign work."
      : hasEmptyCampaign
        ? "Add or generate nodes to start building campaign health."
        : "Pick up this campaign where you left off.",
    contextLabel: hasNoActiveBoard ? "" : "Campaign health updates automatically as your campaign evolves.",
    buttonLabel: isCurrentCanvas ? "Open Board" : "Open Boards",
    opensCanvas: isCurrentCanvas,
    isEmpty: hasNoActiveBoard,
    isCampaignEmpty: hasEmptyCampaign
  };
}

function renderDashboardCampaignBucketList(container, buckets = [], options = {}) {
  if (!container) return;
  container.classList.toggle("is-kpi", options.variant === "kpi");
  container.replaceChildren();
  buckets.forEach((bucket) => {
    const item = document.createElement("span");
    item.className = "dashboard-campaign-chip";
    item.dataset.bucket = bucket.key;
    const label = document.createElement("span");
    label.textContent = bucket.label;
    const count = document.createElement("strong");
    count.textContent = String(bucket.count);
    item.append(label, count);
    container.appendChild(item);
  });
}

function renderDashboardCampaignSummary(container, summary) {
  if (!container) return;
  let summaryEl = container.querySelector("#dashboard-campaign-summary");
  if (!summaryEl) {
    summaryEl = document.createElement("div");
    summaryEl.id = "dashboard-campaign-summary";
    summaryEl.className = "dashboard-campaign-summary";
    container.appendChild(summaryEl);
  }
  summaryEl.replaceChildren();
  const hasSummary = Boolean(summary?.paragraphs?.length || summary?.fields?.length);
  summaryEl.classList.toggle("hidden", !hasSummary);
  if (!hasSummary) return;

  const heading = document.createElement("span");
  heading.className = "dashboard-campaign-summary-label";
  heading.textContent = "Campaign Summary";
  summaryEl.appendChild(heading);

  (summary?.paragraphs || []).slice(0, 2).forEach((paragraph) => {
    if (!paragraph) return;
    const p = document.createElement("p");
    p.textContent = paragraph;
    summaryEl.appendChild(p);
  });

  if (summary?.fields?.length) {
    const fieldList = document.createElement("dl");
    fieldList.className = "dashboard-campaign-summary-fields";
    summary.fields.forEach((field) => {
      const item = document.createElement("div");
      const term = document.createElement("dt");
      term.textContent = field.label;
      const description = document.createElement("dd");
      description.textContent = field.value;
      item.append(term, description);
      fieldList.appendChild(item);
    });
    summaryEl.appendChild(fieldList);
  }
}

function renderDashboardContinueWorking() {
  if (!el.dashboardView) return;
  const card = document.getElementById("dashboard-continue-working");
  if (!card) return;
  const model = getDashboardContinueWorkingModel();
  const title = card.querySelector("#dashboard-continue-title");
  const action = card.querySelector("#dashboard-continue-action");
  const copy = card.querySelector(".dashboard-continue-copy");
  const health = card.querySelector("#dashboard-campaign-health");
  const progressPercent = card.querySelector("#dashboard-campaign-progress-percent");
  const progressFill = card.querySelector("#dashboard-campaign-progress-fill");
  const progressCopy = card.querySelector("#dashboard-campaign-progress-copy");
  const statusList = card.querySelector("#dashboard-campaign-status-list");
  const typeList = card.querySelector("#dashboard-campaign-type-list");
  const emptyNote = card.querySelector("#dashboard-campaign-empty-note");
  const updated = card.querySelector("#dashboard-continue-updated");
  const context = card.querySelector("#dashboard-continue-context");
  const openButton = card.querySelector("#dashboard-continue-open");

  card.classList.toggle("is-empty", model.isEmpty);
  card.classList.toggle("is-campaign-empty", model.isCampaignEmpty);
  if (title) title.textContent = model.title;
  if (action) action.textContent = model.nextAction;
  renderDashboardCampaignSummary(copy, model.campaignSummary);
  if (health) health.classList.toggle("hidden", model.isEmpty);
  if (progressPercent) progressPercent.textContent = `${model.campaignHealth.progressPercent}%`;
  if (progressFill) progressFill.style.width = `${model.campaignHealth.progressPercent}%`;
  if (progressCopy) progressCopy.textContent = model.campaignHealth.progressCopy;
  renderDashboardCampaignBucketList(statusList, model.campaignHealth.statusBuckets, { variant: "kpi" });
  renderDashboardCampaignBucketList(typeList, model.campaignHealth.typeBuckets);
  if (emptyNote) emptyNote.classList.toggle("hidden", !model.isCampaignEmpty);
  if (updated) updated.textContent = model.lastUpdated;
  if (context) {
    context.textContent = model.contextLabel;
    context.classList.toggle("hidden", !model.contextLabel);
  }
  if (openButton) openButton.textContent = model.buttonLabel;
  el.dashboardView?.querySelectorAll('[data-dashboard-action="open-current-board"]').forEach((button) => {
    button.dataset.dashboardTarget = model.opensCanvas ? "canvas" : "boards";
  });
}

function refreshDashboardIfVisible() {
  if (!el.dashboardView || el.dashboardView.classList.contains("hidden")) return;
  renderDashboardHero();
  renderDashboardContinueWorking();
  renderDashboardBrandEvolution();
  renderDashboardSuggestedOpportunities();
  renderDashboardTodaysFocus();
}

const DASHBOARD_BRAND_SIGNAL_FIELDS = [
  { key: "brandCore", label: "Brand Core" },
  { key: "valueProposition", label: "Value Proposition" },
  { key: "toneOfVoice", label: "Tone of Voice" },
  { key: "messagingPillars", label: "Messaging Pillars" },
  { key: "personas", label: "Personas" },
  { key: "contentGuidelines", label: "Content Guidelines" },
  { key: "dosAndDonts", label: "Do / Don't Rules" },
  { key: "brandVoiceExamples", label: "Brand Voice Examples" },
  { key: "keywords", label: "Keywords" },
  { key: "brandAssets", label: "Brand Assets" }
];

const DASHBOARD_KNOWLEDGE_INPUTS = ["Founder Story", "Market Research", "Pitch Deck", "Whitepaper", "Business Plan"];

function hasMeaningfulBrandValue(value) {
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulBrandValue(item));
  if (typeof value === "string") return value.trim().length > 0;
  if (!value || typeof value !== "object") return false;
  return Object.values(value).some((item) => hasMeaningfulBrandValue(item));
}

function getBrandSignalPreview(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const item = value.find((entry) => hasMeaningfulBrandValue(entry));
    if (!item) return "";
    if (typeof item === "string") return item.trim();
    return item.name || item.title || item.note || "Saved structured input";
  }
  if (value && typeof value === "object") {
    if (value.good) return value.good;
    if (value.domain) return value.domain;
    if (value.logo) return value.logo;
    if (Array.isArray(value.colors) && value.colors.length) return value.colors[0];
    if (Array.isArray(value.references) && value.references.length) return String(value.references[0] || "").trim();
    return "Saved structured input";
  }
  return "";
}

function getDashboardBrandSignals() {
  const brandCore = normalizeBrandCoreState(state.brandCore || defaultBrandCoreState());
  return DASHBOARD_BRAND_SIGNAL_FIELDS.map((field) => {
    const value = brandCore[field.key];
    return {
      ...field,
      hasValue: hasMeaningfulBrandValue(value),
      preview: getBrandSignalPreview(value)
    };
  });
}

function getDashboardKnowledgeInputStatus() {
  const brandCore = normalizeBrandCoreState(state.brandCore || defaultBrandCoreState());
  const customTiles = Array.isArray(brandCore.customTiles) ? brandCore.customTiles : [];
  const references = Array.isArray(brandCore.brandAssets?.references) ? brandCore.brandAssets.references : [];
  const searchable = [
    brandCore.brandCore,
    brandCore.valueProposition,
    ...customTiles.flatMap((tile) => [tile?.title, tile?.content]),
    ...references
  ].filter(Boolean).join(" ").toLowerCase();
  return DASHBOARD_KNOWLEDGE_INPUTS.map((label) => ({
    label,
    exists: searchable.includes(label.toLowerCase())
  }));
}

function getDashboardBrandEvolutionModel() {
  const signals = getDashboardBrandSignals();
  const completedSignals = signals.filter((signal) => signal.hasValue);
  const missingCoreSignal = signals.find((signal) => !signal.hasValue);
  const knowledgeInputs = getDashboardKnowledgeInputStatus();
  const missingKnowledge = knowledgeInputs.filter((input) => !input.exists);
  const firstSignal = completedSignals[0];
  const hasSignals = completedSignals.length > 0;
  return {
    hasSignals,
    title: hasSignals ? "Brand Brain is becoming clearer" : "Brand signals will appear once Brand Core is connected.",
    completeness: hasSignals
      ? `${completedSignals.length} of ${signals.length} Brand Core signals present. ${missingKnowledge.length ? `${missingKnowledge.length} strategic input${missingKnowledge.length === 1 ? "" : "s"} still missing.` : "All strategic inputs detected."}`
      : "No Brand Core signals yet.",
    learning: firstSignal
      ? `${firstSignal.label}: ${String(firstSignal.preview || "Saved input").slice(0, 120)}`
      : "Brand signals will appear once Brand Core is connected.",
    improvement: missingKnowledge.length
      ? `${missingKnowledge.length} strategic input${missingKnowledge.length === 1 ? " is" : "s are"} still missing. Add ${missingKnowledge[0].label} next to strengthen future campaign recommendations.`
      : missingCoreSignal
        ? `Add ${missingCoreSignal.label} to make Brand Core more complete.`
        : "Review Brand Core before the next campaign so recommendations stay aligned.",
    missingKnowledge
  };
}

function renderDashboardBrandEvolution() {
  const card = document.getElementById("dashboard-brand-evolution");
  if (!card) return;
  const model = getDashboardBrandEvolutionModel();
  const title = card.querySelector("#dashboard-brand-evolution-title");
  const empty = card.querySelector("#dashboard-brand-evolution-empty");
  const content = card.querySelector("#dashboard-brand-evolution-content");
  const completeness = card.querySelector("#dashboard-brand-completeness");
  const learning = card.querySelector("#dashboard-brand-learning");
  const improvement = card.querySelector("#dashboard-brand-improvement");
  const missingPills = card.querySelector("#dashboard-brand-missing-pills");

  if (title) title.textContent = model.title;
  if (empty) empty.classList.toggle("hidden", model.hasSignals);
  if (content) content.classList.toggle("hidden", !model.hasSignals);
  if (completeness) completeness.textContent = model.completeness;
  if (learning) learning.textContent = model.learning;
  if (improvement) improvement.textContent = model.improvement;
  if (missingPills) {
    missingPills.innerHTML = "";
    const pills = model.missingKnowledge.length ? model.missingKnowledge : [{ label: "No required knowledge gaps detected" }];
    pills.forEach((input) => {
      const pill = document.createElement("button");
      pill.type = "button";
      pill.className = "fk-pill dashboard-brand-pill";
      pill.dataset.dashboardAction = "open-brand";
      pill.textContent = input.label;
      missingPills.appendChild(pill);
    });
  }
}

function countDashboardNodesByType(type) {
  return state.nodes.filter((node) => node?.type === type).length;
}

function getDashboardSuggestedOpportunities() {
  const opportunities = [];
  const signals = getDashboardBrandSignals();
  const hasBrandSignals = signals.some((signal) => signal.hasValue);
  const knowledgeInputs = getDashboardKnowledgeInputStatus();
  const missingKnowledge = new Set(knowledgeInputs.filter((input) => !input.exists).map((input) => input.label));
  const personasSignal = signals.find((signal) => signal.key === "personas");
  const landingPageCount = countDashboardNodesByType("Landing Page");
  const emailCount = countDashboardNodesByType("Email Campaign");
  const socialCount = countDashboardNodesByType("Social Media Posting");
  const draftCount = state.nodes.filter((node) => normalizeNodeStatus(node?.status) === "Draft").length;

  const addOpportunity = (id, title, explanation) => {
    if (opportunities.some((entry) => entry.id === id)) return;
    opportunities.push({ id, title, explanation });
  };

  if (hasBrandSignals && missingKnowledge.has("Founder Story")) {
    addOpportunity("founder-story", "Explore founder-led storytelling", "A Founder Story input can give the next campaign a more human trust layer.");
  }
  if (hasBrandSignals && missingKnowledge.has("Market Research")) {
    addOpportunity("market-research", "Expand ICP research", "Market Research can sharpen the audience and category context for upcoming ideas.");
  }
  if (hasBrandSignals && !personasSignal?.hasValue) {
    addOpportunity("audience-language", "Sharpen audience language", "Persona details can help campaign nodes speak to the right buyer more clearly.");
  }
  if (landingPageCount > 0) {
    addOpportunity("landing-page", "Review landing page message", "A Landing Page node is ready for a focused pass on clarity, trust, and next action.");
  }
  if (emailCount > 0) {
    addOpportunity("email-sequence", "Strengthen follow-up sequence", "An Email Campaign node can become a more connected follow-up path from the campaign idea.");
  }
  if (socialCount > 0) {
    addOpportunity("social-sequence", "Turn posts into a campaign sequence", "Social Media Posting nodes can be grouped into a clearer sequence across the campaign.");
  }
  if (draftCount >= 3) {
    addOpportunity("draft-flow", "Review draft-to-ready flow", "Several Draft nodes are available for a calm pass toward review-ready campaign assets.");
  }

  return opportunities.slice(0, 3);
}

function renderDashboardSuggestedOpportunities() {
  const section = document.getElementById("dashboard-suggested-opportunities");
  if (!section) return;
  const empty = section.querySelector("#dashboard-suggested-opportunities-empty");
  const list = section.querySelector("#dashboard-suggested-opportunities-list");
  if (!list) return;
  const opportunities = getDashboardSuggestedOpportunities();
  if (empty) empty.classList.toggle("hidden", opportunities.length > 0);
  list.classList.toggle("hidden", opportunities.length === 0);
  list.innerHTML = "";
  opportunities.forEach((opportunity) => {
    const card = document.createElement("article");
    const title = document.createElement("strong");
    title.textContent = opportunity.title;
    const explanation = document.createElement("span");
    explanation.textContent = opportunity.explanation;
    card.append(title, explanation);
    list.appendChild(card);
  });
}

function isDashboardNodeComplete(node) {
  const rawStatus = typeof node?.status === "string" ? node.status.trim().toLowerCase() : "";
  const status = normalizeNodeStatus(node?.status);
  return status === "Approved" || status === "Published" || rawStatus === "done" || rawStatus === "completed" || rawStatus === "complete";
}

function dashboardNodeTimestamp(node) {
  const value = node?.updatedAt || node?.modifiedAt || node?.createdAt || node?.time || "";
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getDashboardNodeOwnerLabel(node) {
  const ownerEmail = normalizeOwnerEmail(node?.ownerEmail);
  if (!ownerEmail) return "Campaign node";
  const currentEmail = normalizeOwnerEmail(state.user?.email);
  if (currentEmail && ownerEmail === currentEmail) return "Assigned to you";
  return `Owner: ${nodeOwnerDisplayName(node)}`;
}

function getDashboardTodaysFocusActions() {
  const currentEmail = normalizeOwnerEmail(state.user?.email);
  return state.nodes
    .map((node, index) => {
      const ownerEmail = normalizeOwnerEmail(node?.ownerEmail);
      return {
        node,
        index,
        ownerEmail,
        assignedToCurrentUser: Boolean(currentEmail && ownerEmail && ownerEmail === currentEmail),
        hasOwner: Boolean(ownerEmail),
        complete: isDashboardNodeComplete(node),
        timestamp: dashboardNodeTimestamp(node)
      };
    })
    .filter((entry) => !entry.complete)
    .sort((a, b) => {
      if (a.assignedToCurrentUser !== b.assignedToCurrentUser) return a.assignedToCurrentUser ? -1 : 1;
      if (a.hasOwner !== b.hasOwner) return a.hasOwner ? -1 : 1;
      if (a.timestamp !== b.timestamp) return b.timestamp - a.timestamp;
      return b.index - a.index;
    })
    .slice(0, 3)
    .map((entry) => {
      const node = entry.node;
      const status = nodeStatusLabel(node?.status);
      return {
        id: node.id,
        title: node.title?.trim() || node.type || "Untitled node",
        type: node.type || "Node",
        status,
        ownerLabel: getDashboardNodeOwnerLabel(node)
      };
    });
}

function renderDashboardTodaysFocus() {
  const section = document.getElementById("dashboard-todays-focus");
  if (!section) return;
  const empty = section.querySelector("#dashboard-todays-focus-empty");
  const list = section.querySelector("#dashboard-todays-focus-list");
  if (!list) return;
  const actions = getDashboardTodaysFocusActions();
  if (empty) empty.classList.toggle("hidden", actions.length > 0);
  list.classList.toggle("hidden", actions.length === 0);
  list.innerHTML = "";
  actions.forEach((action) => {
    const card = document.createElement("article");
    card.className = "dashboard-focus-action";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.dataset.dashboardFocusNode = action.id;
    const title = document.createElement("strong");
    title.textContent = action.title;
    const meta = document.createElement("span");
    meta.textContent = `${action.ownerLabel} · ${action.type} · ${action.status}`;
    card.append(title, meta);
    list.appendChild(card);
  });
}

function getCurrentBrandBrainBoardId() {
  return state.currentBoardId || getBoardIdFromPath() || "";
}

function brandBrainStorageKey(boardId = getCurrentBrandBrainBoardId()) {
  const scopedBoardId = String(boardId || "").trim();
  return scopedBoardId ? `${BRAND_CORE_STORAGE_KEY}:${scopedBoardId}` : BRAND_CORE_STORAGE_KEY;
}

function loadCampaignCanvasState() {
  const raw = localStorage.getItem(STORAGE_KEY); if (!raw) return false;
  const campaignState = JSON.parse(raw); console.log("Loaded campaignCanvasState", campaignState);
  state.runtimeDiagnostics.canvasSource = "localStorage campaignCanvasState";
  state.runtimeDiagnostics.localDraft = { exists: true, restored: true, reason: "loadCampaignCanvasState" };
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
  if (state.isBoardLoading || state.isBoardHydrating || state.initialServerLoadInFlight) {
    console.warn("[Funklix Save Guard] Save blocked while board is loading or hydrating", {
      trigger,
      currentBoardId: state.currentBoardId || getBoardIdFromPath(),
      isBoardLoading: state.isBoardLoading,
      isBoardHydrating: state.isBoardHydrating,
      initialServerLoadInFlight: state.initialServerLoadInFlight
    });
    return false;
  }
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
      brand_core_snapshot: serializeBrandCoreSnapshot()
    };
    const persistenceTarget = resolveBoardPersistenceTarget();
    const currentBoardId = persistenceTarget.boardId;
    const isUpdate = persistenceTarget.isUpdate;
    if (trigger === "autosave" && !currentBoardId) {
      state.runtimeDiagnostics.lastBlockedAutosave = {
        mode: "blocked-no-board",
        reason: "autosave-update-only",
        trigger,
        at: new Date().toISOString(),
        hasNodes: state.nodes.length > 0,
        hasEdges: state.edges.length > 0,
        canvasSource: state.runtimeDiagnostics?.canvasSource || "unknown"
      };
      console.warn("[Funklix Save Guard] Autosave skipped without an existing board id", {
        currentBoardId,
        ...state.runtimeDiagnostics.lastBlockedAutosave
      });
      setSaveStatus("Unsaved local changes");
      return false;
    }
    if (isUpdate) payload.name = null;
    const endpoint = persistenceTarget.endpoint;
    const method = persistenceTarget.method;
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
    setPassiveBoardOwnershipDiagnostics(data, isUpdate ? "save-board-update-response" : "save-board-create-response");
    if (returnedId) state.currentBoardId = returnedId;
    syncRuntimeSessionFromLegacy(isUpdate ? "save-board-update" : "save-board-create");
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
    refreshDashboardIfVisible();

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
  state.isBoardHydrating = true;
  state.currentBoardId = boardId;
  syncRuntimeSessionFromLegacy("board-load-start");
  clearAutosaveTimer();
  resetBrandBrainForBoardHydration();
  renderBrandCoreTiles();
  renderBrandCoreEditor();
  debugBrandBrainScope("board-load-start", { boardId, storageKey: brandBrainStorageKey(boardId) });
  try {
    const response = await fetch(`/api/boards/${boardId}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || 'Failed to load board');
    const snapshot = data?.brand_core_snapshot && typeof data.brand_core_snapshot === "object" ? data.brand_core_snapshot : null;
    debugBrandBrainScope("board-snapshot-received", { boardId, hasSnapshot: Boolean(snapshot), ...brandDnaScopeSummary(snapshot || {}) });
    setPassiveBoardOwnershipDiagnostics(data, "board-load-response");
    state.currentBoardId = data?.id || boardId;
    syncRuntimeSessionFromLegacy("board-load");
    state.currentBoardName = data?.name || "";
    state.lastKnownUpdatedAt = data?.updated_at || null;
    state.brandCore = snapshot ? normalizeBrandCoreState(snapshot) : normalizeBrandCoreState(defaultBrandCoreState());
    renderBrandCoreTiles();
    renderBrandCoreEditor();
    saveBrandBrainState({ markDirty: false });
    debugBrandBrainScope("board-brand-brain-hydrated", { boardId: state.currentBoardId, storageKey: brandBrainStorageKey(), ...brandDnaScopeSummary(state.brandCore) });
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
    state.runtimeDiagnostics.canvasSource = "/boards/:id";
    applyCampaignState(normalizedCanvasState, `Loaded board ${boardId.slice(0, 8)}...`);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizedCanvasState));
    startPresenceLite();
    startBoardRefreshPolling();
    refreshDashboardIfVisible();
    return true;
  } catch (error) {
    console.error(error);
    setSaveStatus('Board not found or could not be loaded.');
    return false;
  } finally {
    state.initialServerLoadInFlight = false;
    state.isBoardLoading = false;
    state.isBoardHydrating = false;
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

function clonePlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return JSON.parse(JSON.stringify(value));
}

function normalizeBrandDnaSnapshot(brandDNA = null) {
  if (!brandDNA || typeof brandDNA !== "object" || Array.isArray(brandDNA)) return null;
  return clonePlainObject(brandDNA);
}

function normalizeBrandCoreState(brandCore = {}) {
  const defaults = defaultBrandCoreState();
  const safeBrandCore = brandCore && typeof brandCore === "object" && !Array.isArray(brandCore) ? brandCore : {};
  const hasIncomingBrandDNA = safeBrandCore.brandDNA && typeof safeBrandCore.brandDNA === "object" && !Array.isArray(safeBrandCore.brandDNA);

  return {
    ...defaults,
    ...safeBrandCore,
    dosAndDonts: {
      ...defaults.dosAndDonts,
      ...(safeBrandCore.dosAndDonts && typeof safeBrandCore.dosAndDonts === "object" ? safeBrandCore.dosAndDonts : {})
    },
    brandVoiceExamples: {
      ...defaults.brandVoiceExamples,
      ...(safeBrandCore.brandVoiceExamples && typeof safeBrandCore.brandVoiceExamples === "object" ? safeBrandCore.brandVoiceExamples : {})
    },
    brandAssets: {
      ...defaults.brandAssets,
      ...(safeBrandCore.brandAssets && typeof safeBrandCore.brandAssets === "object" ? safeBrandCore.brandAssets : {})
    },
    customTiles: Array.isArray(safeBrandCore.customTiles) ? safeBrandCore.customTiles : [],
    brandDNA: normalizeBrandDnaSnapshot(hasIncomingBrandDNA ? safeBrandCore.brandDNA : null)
  };
}

function serializeBrandCoreSnapshot() {
  state.brandCore = normalizeBrandCoreState(state.brandCore);
  return clonePlainObject(state.brandCore);
}

function getBrandCoreData() {
  return serializeBrandCoreSnapshot();
}
window.getBrandCoreData = getBrandCoreData;

function saveBrandBrainState(options = {}) {
  const { markDirty: shouldMarkDirty = true } = options;
  const brandState = getBrandCoreData();
  console.log("Saving brandBrainState", brandState);
  localStorage.setItem(brandBrainStorageKey(), JSON.stringify(brandState));
  if (shouldMarkDirty) markUnsaved();
  refreshDashboardIfVisible();
}

function loadBrandBrainState() {
  const raw = localStorage.getItem(brandBrainStorageKey());
  if (raw) {
    state.brandCore = normalizeBrandCoreState(JSON.parse(raw));
    console.log("Loaded brandBrainState", state.brandCore);
  } else {
    state.brandCore = normalizeBrandCoreState(defaultBrandCoreState());
  }
  state.brandDnaDraft = null;
  state.brandDnaLoading = false;
  state.brandAvatarLoading = false;
}

function resetBrandBrainForBoardHydration() {
  state.brandCore = normalizeBrandCoreState(defaultBrandCoreState());
  state.brandDnaDraft = null;
  state.brandDnaLoading = false;
  state.brandAvatarLoading = false;
}

function debugBrandBrainScope(event, details = {}) {
  if (typeof window === "undefined" || !window.DEBUG_BRAND_BRAIN_SCOPE) return;
  console.debug("[BrandBrainScope]", event, details);
}

function brandDnaScopeSummary(brandCore = {}) {
  const brandDNA = brandCore?.brandDNA && typeof brandCore.brandDNA === "object" ? brandCore.brandDNA : null;
  return {
    hasBrandDNA: Boolean(brandDNA?.primaryArchetype),
    primaryArchetype: brandDNA?.primaryArchetype || "",
    hasAvatar: Boolean(brandDNA?.avatar?.imageUrl)
  };
}

function resetBrandBrainState() {
  console.log("RESET BRAND CORE CLICKED");
  localStorage.removeItem(brandBrainStorageKey());
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


const BRAND_DNA_ARCHETYPES = new Set([
  "Explorer",
  "Sage",
  "Hero",
  "Ruler",
  "Magician",
  "Caregiver",
  "Creator",
  "Everyman",
  "Jester",
  "Innocent",
  "Rebel",
  "Lover"
]);

function clampBrandDnaConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(100, Math.round(number)));
}

function normalizeBrandDnaSignals(signals = {}) {
  const keys = ["toneSignals", "missionSignals", "audienceSignals", "messagingSignals", "visualSignals"];
  return keys.reduce((clean, key) => {
    clean[key] = (Array.isArray(signals?.[key]) ? signals[key] : [])
      .map((item) => String(item || "").trim())
      .filter(Boolean)
      .slice(0, 5);
    return clean;
  }, {});
}

function normalizeBrandAvatar(avatar = null) {
  if (!avatar || typeof avatar !== "object" || Array.isArray(avatar)) return null;
  const imageUrl = String(avatar.imageUrl || "").trim();
  const prompt = String(avatar.prompt || "").trim();
  if (!imageUrl && !prompt) return null;
  return {
    imageUrl,
    prompt,
    style: String(avatar.style || "semi-realistic symbolic figure").trim() || "semi-realistic symbolic figure",
    generatedAt: avatar.generatedAt || new Date().toISOString(),
    userApproved: Boolean(avatar.userApproved)
  };
}

function normalizeBrandDnaResult(result = {}, approved = false) {
  const primaryArchetype = BRAND_DNA_ARCHETYPES.has(result.primaryArchetype) ? result.primaryArchetype : "";
  const secondaryArchetype = BRAND_DNA_ARCHETYPES.has(result.secondaryArchetype) ? result.secondaryArchetype : "";
  return {
    primaryArchetype,
    secondaryArchetype,
    primaryConfidence: clampBrandDnaConfidence(result.primaryConfidence),
    secondaryConfidence: clampBrandDnaConfidence(result.secondaryConfidence),
    reasoning: String(result.reasoning || "").trim(),
    alternatives: (Array.isArray(result.alternatives) ? result.alternatives : [])
      .map((item) => ({
        archetype: BRAND_DNA_ARCHETYPES.has(item?.archetype) ? item.archetype : "",
        confidence: clampBrandDnaConfidence(item?.confidence),
        why: String(item?.why || "").trim()
      }))
      .filter((item) => item.archetype)
      .slice(0, 3),
    signals: normalizeBrandDnaSignals(result.signals),
    recommendedVoice: String(result.recommendedVoice || "").trim(),
    recommendedVisualDirection: String(result.recommendedVisualDirection || "").trim(),
    generatedAt: result.generatedAt || new Date().toISOString(),
    userApproved: Boolean(approved || result.userApproved),
    avatar: normalizeBrandAvatar(result.avatar)
  };
}

function brandDnaResultHtml(result) {
  if (!result?.primaryArchetype) return "";
  const signals = result.signals || {};
  const signalGroups = [
    ["Tone", signals.toneSignals],
    ["Mission", signals.missionSignals],
    ["Audience", signals.audienceSignals],
    ["Messaging", signals.messagingSignals],
    ["Visual", signals.visualSignals]
  ];
  const alternatives = (result.alternatives || [])
    .map((item) => `<li><strong>${escapeHtml(item.archetype)}</strong>${item.confidence ? ` · ${escapeHtml(item.confidence)}%` : ""}${item.why ? `<span>${escapeHtml(item.why)}</span>` : ""}</li>`)
    .join("");
  return `
    <div class="brand-dna-result">
      <div class="brand-dna-score-grid">
        <div class="brand-dna-score primary">
          <span>Primary Archetype</span>
          <strong>${escapeHtml(result.primaryArchetype)}</strong>
          <em>${escapeHtml(result.primaryConfidence)}%</em>
        </div>
        <div class="brand-dna-score">
          <span>Secondary Archetype</span>
          <strong>${escapeHtml(result.secondaryArchetype)}</strong>
          <em>${escapeHtml(result.secondaryConfidence)}%</em>
        </div>
      </div>
      ${result.reasoning ? `<div class="brand-dna-block"><h4>Why we think this</h4><p>${escapeHtml(result.reasoning)}</p></div>` : ""}
      <div class="brand-dna-signals">
        ${signalGroups.map(([label, items]) => `
          <div>
            <h5>${escapeHtml(label)} signals</h5>
            ${(items || []).length ? `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : `<p>No strong ${escapeHtml(label.toLowerCase())} signal yet.</p>`}
          </div>`).join("")}
      </div>
      ${alternatives ? `<div class="brand-dna-block"><h4>Alternatives</h4><ul class="brand-dna-alternatives">${alternatives}</ul></div>` : ""}
      ${result.recommendedVoice ? `<div class="brand-dna-block"><h4>Recommended voice</h4><p>${escapeHtml(result.recommendedVoice)}</p></div>` : ""}
      ${result.recommendedVisualDirection ? `<div class="brand-dna-block"><h4>Recommended visual direction</h4><p>${escapeHtml(result.recommendedVisualDirection)}</p></div>` : ""}
    </div>`;
}

function renderBrandAvatarSection(result) {
  if (!result?.userApproved) return "";
  const avatar = normalizeBrandAvatar(result.avatar);
  const isLoading = Boolean(state.brandAvatarLoading);
  const hasAvatar = Boolean(avatar?.imageUrl);
  return `
    <div class="brand-dna-avatar-section">
      <div class="brand-dna-avatar-copy">
        <span class="brand-dna-eyebrow">Phase 2</span>
        <h3>Brand Avatar</h3>
        <p>Visualize your brand personality as an avatar your AI can use across reviews, comments and future team workflows.</p>
      </div>
      ${isLoading ? `<div class="brand-dna-loading">Generating Brand Avatar…</div>` : ""}
      ${hasAvatar ? `
        <div class="brand-dna-avatar-preview">
          <button type="button" class="brand-dna-avatar-image" id="brand-avatar-preview" aria-label="Open Brand Avatar preview">
            <img src="${escapeHtml(avatar.imageUrl)}" alt="Brand Avatar preview" />
          </button>
          <div class="brand-dna-avatar-details">
            <strong>${avatar.userApproved ? "Accepted Brand Avatar" : "Generated Brand Avatar"}</strong>
            <span>${escapeHtml(avatar.style || "semi-realistic symbolic figure")}${avatar.generatedAt ? ` · ${escapeHtml(new Date(avatar.generatedAt).toLocaleDateString())}` : ""}</span>
            ${avatar.prompt ? `<details><summary>Avatar prompt / description</summary><p>${escapeHtml(avatar.prompt)}</p></details>` : ""}
          </div>
        </div>` : `<div class="brand-dna-empty"><strong>No Brand Avatar yet.</strong><span>Generate a symbolic identity image from your accepted Brand DNA.</span></div>`}
      <div class="brand-dna-actions brand-dna-avatar-actions">
        ${hasAvatar && !avatar.userApproved ? `<button type="button" class="primary-add" id="brand-avatar-accept" ${isLoading ? "disabled" : ""}>Accept Avatar</button>` : ""}
        <button type="button" id="brand-avatar-generate" ${isLoading ? "disabled" : ""}>${hasAvatar ? "Regenerate" : "Generate Brand Avatar"}</button>
        ${hasAvatar ? `<button type="button" id="brand-avatar-edit" ${isLoading ? "disabled" : ""}>Edit Prompt</button>` : ""}
      </div>
    </div>`;
}

function renderBrandDnaCard() {
  if (!el.brandCoreCanvas) return;
  let card = el.brandCoreCanvas.querySelector("#brand-dna-card");
  if (!card) {
    card = document.createElement("section");
    card.id = "brand-dna-card";
    card.className = "brand-dna-card";
    el.brandCoreCanvas.prepend(card);
  }
  const accepted = state.brandCore?.brandDNA || null;
  const draft = state.brandDnaDraft || null;
  const result = draft || accepted;
  const hasAcceptedResult = Boolean(accepted?.primaryArchetype && accepted.userApproved && !draft);
  const hasDraft = Boolean(draft?.primaryArchetype);
  const loading = Boolean(state.brandDnaLoading);
  const statusLabel = hasAcceptedResult ? "Accepted Brand DNA" : hasDraft ? "Review generated Brand DNA" : "Phase 1";
  card.innerHTML = `
    <div class="brand-dna-header">
      <div>
        <span class="brand-dna-eyebrow">${escapeHtml(statusLabel)}</span>
        <h2>Discover Brand DNA</h2>
        <p>Understand the personality behind your brand and unlock more consistent AI-generated marketing.</p>
      </div>
      <div class="brand-dna-actions">
        ${hasDraft ? `<button type="button" class="primary-add" id="brand-dna-accept">✓ Accept</button>` : ""}
        <button type="button" id="brand-dna-refine" ${loading || !result ? "disabled" : ""}>✏ Refine</button>
        <button type="button" id="brand-dna-regenerate" ${loading ? "disabled" : ""}>🔄 ${result ? "Regenerate" : "Generate Brand DNA"}</button>
      </div>
    </div>
    ${loading ? `<div class="brand-dna-loading">Analyzing your Brand Brain, founder signals, voice, ICP, and visual assets…</div>` : ""}
    ${result ? brandDnaResultHtml(result) : `<div class="brand-dna-empty"><strong>Ready when your Brand Brain has enough context.</strong><span>We will look at your founder story, mission, value proposition, messaging pillars, ICP, tone, website/domain, and visual assets.</span></div>`}
    ${hasAcceptedResult ? renderBrandAvatarSection(accepted) : ""}
  `;
  card.querySelector("#brand-dna-regenerate")?.addEventListener("click", () => discoverBrandDna());
  card.querySelector("#brand-dna-refine")?.addEventListener("click", () => refineBrandDna());
  card.querySelector("#brand-dna-accept")?.addEventListener("click", () => acceptBrandDna());
  card.querySelector("#brand-avatar-generate")?.addEventListener("click", () => generateBrandAvatar());
  card.querySelector("#brand-avatar-accept")?.addEventListener("click", () => acceptBrandAvatar());
  card.querySelector("#brand-avatar-edit")?.addEventListener("click", () => editBrandAvatarPrompt());
  card.querySelector("#brand-avatar-preview")?.addEventListener("click", () => {
    const imageUrl = state.brandCore?.brandDNA?.avatar?.imageUrl;
    if (imageUrl) openLightbox(imageUrl, "Brand Avatar preview");
  });
}

function getAcceptedBrandDna() {
  const brandDNA = state.brandCore?.brandDNA;
  return brandDNA?.primaryArchetype && brandDNA.userApproved ? brandDNA : null;
}

async function generateBrandAvatar(optionalUserDirection = "") {
  const brandDNA = getAcceptedBrandDna();
  if (!brandDNA || state.brandAvatarLoading) return;
  state.brandAvatarLoading = true;
  renderBrandDnaCard();
  try {
    const response = await fetch("/api/generate-brand-avatar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: state.currentBoardId || getBoardIdFromPath() || "",
        brandBrainData: state.brandCore,
        brandDNA,
        optionalUserDirection
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Could not generate Brand Avatar");
    if (!payload?.imageUrl) throw new Error("Brand Avatar response did not include an image URL.");
    state.brandCore = normalizeBrandCoreState(state.brandCore);
    state.brandCore.brandDNA = normalizeBrandDnaResult({ ...state.brandCore.brandDNA, userApproved: true }, true);
    state.brandCore.brandDNA.avatar = normalizeBrandAvatar({
      imageUrl: payload.imageUrl,
      prompt: payload.prompt,
      style: "semi-realistic symbolic figure",
      generatedAt: payload.generatedAt || new Date().toISOString(),
      userApproved: false
    });
    saveBrandBrainState({ markDirty: true });
  } catch (error) {
    alert(error?.message || "Could not generate Brand Avatar right now.");
  } finally {
    state.brandAvatarLoading = false;
    renderBrandDnaCard();
  }
}

function acceptBrandAvatar() {
  const avatar = normalizeBrandAvatar(state.brandCore?.brandDNA?.avatar);
  if (!avatar?.imageUrl || !getAcceptedBrandDna()) return;
  state.brandCore.brandDNA.avatar = { ...avatar, userApproved: true };
  saveBrandBrainState({ markDirty: true });
  renderBrandDnaCard();
}

function editBrandAvatarPrompt() {
  const currentPrompt = state.brandCore?.brandDNA?.avatar?.prompt || "";
  const direction = window.prompt(
    "Add direction for the next Brand Avatar generation.",
    currentPrompt ? "Keep the same strategy, but adjust the visual expression." : ""
  );
  if (!direction || !direction.trim()) return;
  generateBrandAvatar(direction.trim());
}

async function discoverBrandDna(refineGuidance = "") {
  if (state.brandDnaLoading) return;
  state.brandDnaLoading = true;
  renderBrandDnaCard();
  try {
    const response = await fetch("/api/discover-brand-dna", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        boardId: state.currentBoardId || getBoardIdFromPath() || "",
        brandBrainData: state.brandCore,
        refineGuidance
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error || "Could not discover Brand DNA");
    const draft = normalizeBrandDnaResult(payload, false);
    if (!draft.primaryArchetype || !draft.secondaryArchetype) throw new Error("Brand DNA response was incomplete.");
    state.brandDnaDraft = draft;
  } catch (error) {
    alert(error?.message || "Could not discover Brand DNA right now.");
  } finally {
    state.brandDnaLoading = false;
    renderBrandDnaCard();
  }
}

function refineBrandDna() {
  const guidance = window.prompt(
    "How should AI refine this Brand DNA?",
    "More premium, more playful, more authoritative, more visionary, or more rebellious"
  );
  if (!guidance || !guidance.trim()) return;
  discoverBrandDna(guidance.trim());
}

function acceptBrandDna() {
  const result = state.brandDnaDraft || state.brandCore?.brandDNA;
  if (!result?.primaryArchetype) return;
  state.brandCore = normalizeBrandCoreState(state.brandCore);
  state.brandCore.brandDNA = normalizeBrandDnaResult({ ...result, userApproved: true }, true);
  state.brandDnaDraft = null;
  saveBrandBrainState({ markDirty: true });
  renderBrandCoreTiles();
  renderBrandCoreEditor();
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
      <section class="brand-dna-card" id="brand-dna-card"></section>
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
  renderBrandDnaCard();
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
  if (!Array.isArray(state.brandCore.customTiles)) state.brandCore.customTiles = [];
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

function normalizeCampaignSetupOptions(options = {}) {
  const clamp = (value, fallback, min, max) => {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, number));
  };
  const channel = ["LinkedIn", "X", "Instagram", "TikTok", "Mixed"].includes(options.channel) ? options.channel : "LinkedIn";
  return {
    variationCount: clamp(options.variationCount, 3, 1, 10),
    postsPerVariation: clamp(options.postsPerVariation, 5, 1, 20),
    includeLandingPage: options.includeLandingPage !== false,
    includeEmailCampaign: options.includeEmailCampaign !== false,
    channel
  };
}

function expectedCampaignNodeCount(setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  return 1 + normalized.variationCount * (2 + normalized.postsPerVariation + (normalized.includeLandingPage ? 1 : 0) + (normalized.includeEmailCampaign ? 1 : 0));
}

async function fetchGeneratedCampaignPlan(ideaText, contextText, setupOptions = {}) {
  const setup = normalizeCampaignSetupOptions(setupOptions);
  const response = await fetch("/api/generate-campaign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      campaignIdea: ideaText,
      additionalContext: contextText,
      boardId: getCurrentBrandBrainBoardId(),
      brandBrainData: state.brandCore,
      ...setup
    })
  });
  if (!response.ok) throw new Error("Generation request failed");
  return response.json();
}

const CAMPAIGN_CHAIN_TYPES = [
  "Idea",
  "Campaign Variation",
  "Content",
  "Social Media Posting",
  "Landing Page",
  "Email Campaign"
];

const CAMPAIGN_V3_ENABLED = true;

function isCampaignV3Enabled() {
  return CAMPAIGN_V3_ENABLED === true;
}

function openCampaignGeneratorEntry() {
  if (isCampaignV3Enabled()) {
    return openCampaignV3Modal();
  }
  return openCreateCampaignModal();
}

const CAMPAIGN_WORKER_STATUS = {
  "Idea": "🧠 Strategist is shaping the idea...",
  "Campaign Variation": "🎯 Strategist is finding a distinct angle...",
  "Content": "✍️ Copywriter is drafting the hero content...",
  "Social Media Posting": "📱 Social editor is creating diverse post ideas...",
  "Landing Page": "🧱 Funnel builder is creating the landing page...",
  "Email Campaign": "📧 CRM writer is preparing the follow-up email..."
};

function waitForCampaignWorker(ms = 420) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function cleanCampaignField(value = "") {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLandingPreviewSectionLabel(label = "") {
  const normalized = cleanCampaignField(label).toLowerCase().replace(/\s+/g, " ");
  if (normalized === "hero headline") return "heroHeadline";
  if (normalized === "subheadline") return "subheadline";
  if (normalized === "problem section") return "problemSection";
  if (normalized === "benefits") return "benefits";
  if (normalized === "trust elements") return "trustElements";
  if (normalized === "offer") return "offer";
  if (normalized === "faq") return "faq";
  if (normalized === "primary cta") return "primaryCta";
  if (normalized === "final cta") return "finalCta";
  if (normalized === "cta") return "cta";
  return "";
}

function firstCleanLandingSectionValue(...values) {
  return values.map((value) => cleanCampaignField(value)).find(Boolean) || "";
}

function combineLandingSectionValues(...values) {
  return values
    .map((value) => cleanCampaignField(value))
    .filter(Boolean)
    .filter((value, index, list) => list.findIndex((item) => item.toLowerCase() === value.toLowerCase()) === index)
    .join("\n\n");
}

function isWeakLandingPageField(value = "") {
  const cleaned = cleanCampaignField(value);
  if (!cleaned || cleaned.length < 12) return true;
  const normalized = cleaned.toLowerCase();
  if (/^(landing page for|position|a focused campaign)/i.test(cleaned)) return true;
  return /\b(campaign|targeting|objective|audience|angle|variation)\b/.test(normalized);
}

function parseLandingPreviewListItems(value = "", limit = 4) {
  return cleanCampaignField(value)
    .split(/\n+/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean)
    .slice(0, limit);
}

function parseStructuredLandingPagePreview(content = "") {
  const cleaned = cleanCampaignField(content);
  if (!cleaned) return null;

  const sectionPattern = /(?:^|\n)\s*(Hero Headline|Subheadline|Primary CTA|Problem Section|Benefits|Trust Elements|Offer|FAQ|Final CTA|CTA)\s*:\s*/gi;
  const matches = [];
  let match = sectionPattern.exec(cleaned);
  while (match) {
    matches.push(match);
    match = sectionPattern.exec(cleaned);
  }
  if (matches.length < 2) return null;

  const sections = {};
  matches.forEach((match, index) => {
    const key = normalizeLandingPreviewSectionLabel(match[1]);
    if (!key) return;
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : cleaned.length;
    const value = cleanCampaignField(cleaned.slice(start, end));
    if (value && !sections[key]) sections[key] = value;
  });

  const recognizedCount = ["heroHeadline", "subheadline", "primaryCta", "problemSection", "benefits", "trustElements", "offer", "faq", "finalCta", "cta"]
    .filter((key) => sections[key]).length;
  return recognizedCount >= 2 ? sections : null;
}

function campaignV3LandingAliasValue(node = {}, landing = {}, aliases = []) {
  return aliases.map((alias) => cleanCampaignField(landing?.[alias] || node?.[alias])).find(Boolean) || "";
}

function campaignV3LandingCanonicalFields(landing = {}) {
  return {
    headerClaim: cleanCampaignField(landing.headerClaim),
    problem: cleanCampaignField(landing.problem),
    solution: cleanCampaignField(landing.solution),
    trust: cleanCampaignField(landing.trust),
    cta: cleanCampaignField(landing.cta)
  };
}

function campaignV3LandingCanonicalizationSections(node = {}) {
  const sourceText = [node.description, node.content].map((value) => cleanCampaignField(value)).filter(Boolean).join("\n\n");
  try {
    return parseStructuredLandingPagePreview(sourceText) || {};
  } catch (error) {
    console.warn("[Campaign V3 Landing Canonicalization] Landing Page content parsing failed; continuing with aliases only.", error);
    return {};
  }
}

function logCampaignV3LandingCanonicalization(details = {}) {
  console.info("[Campaign V3 Landing Canonicalization]", details);
}

function canonicalizeCampaignV3LandingPageFields(node = {}) {
  if (cleanCampaignField(node?.type) !== "Landing Page") return node;

  const landing = node.landingPage && typeof node.landingPage === "object" ? node.landingPage : {};
  const nextNode = {
    ...node,
    metadata: node.metadata && typeof node.metadata === "object" ? { ...node.metadata } : node.metadata,
    social: node.social && typeof node.social === "object" ? { ...node.social } : node.social,
    landingPage: { ...landing }
  };
  const before = campaignV3LandingCanonicalFields(nextNode.landingPage);
  const sections = campaignV3LandingCanonicalizationSections(nextNode);
  const aliasSources = {
    headerClaim: campaignV3LandingAliasValue(nextNode, landing, ["heroHeadline", "headline", "claim"]),
    problem: campaignV3LandingAliasValue(nextNode, landing, ["problemOfIcp", "problemSection", "customerPain", "audiencePain"]),
    solution: campaignV3LandingAliasValue(nextNode, landing, ["solutionForIcp", "solutionSection", "offer", "benefits"]),
    trust: campaignV3LandingAliasValue(nextNode, landing, ["buildingTrust", "trustElements", "proof", "credibility"]),
    cta: campaignV3LandingAliasValue(nextNode, landing, ["conversionCta", "ctaText", "callToAction", "primaryCta", "finalCta"])
  };
  const parsedSources = {
    headerClaim: firstCleanLandingSectionValue(sections.heroHeadline),
    problem: combineLandingSectionValues(sections.subheadline, sections.problemSection),
    solution: combineLandingSectionValues(sections.offer, sections.benefits),
    trust: combineLandingSectionValues(sections.trustElements, sections.faq),
    cta: firstCleanLandingSectionValue(sections.primaryCta, sections.finalCta, sections.cta)
  };
  const fieldsPopulated = [];
  ["headerClaim", "problem", "solution", "trust", "cta"].forEach((field) => {
    if (cleanCampaignField(nextNode.landingPage[field])) return;
    const value = cleanCampaignField(aliasSources[field] || parsedSources[field]);
    if (!value) return;
    nextNode.landingPage[field] = value;
    fieldsPopulated.push(field);
  });
  const aliasesDetected = Object.entries(aliasSources).reduce((detected, [field, value]) => {
    if (value) detected[field] = value;
    return detected;
  }, {});
  const parsedSectionsDetected = Object.entries(parsedSources).reduce((detected, [field, value]) => {
    if (value) detected[field] = value;
    return detected;
  }, {});
  const finalFields = campaignV3LandingCanonicalFields(nextNode.landingPage);

  logCampaignV3LandingCanonicalization({
    tempId: cleanCampaignField(nextNode.tempId || nextNode.id),
    title: cleanCampaignField(nextNode.title),
    before,
    aliasesDetected,
    parsedSectionsDetected,
    fieldsPopulated,
    final: finalFields
  });

  return nextNode;
}

function appendLandingPreviewText(parent, className, text, style = {}) {
  if (!text) return null;
  const element = document.createElement("p");
  element.className = className;
  Object.entries(style).forEach(([property, value]) => {
    element.style[property] = value;
  });
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function appendLandingPreviewSectionTitle(parent, label) {
  const title = document.createElement("p");
  title.className = "landing-preview-line";
  title.style.fontWeight = "700";
  title.style.color = "#30407d";
  title.style.marginTop = "2px";
  title.textContent = label;
  parent.appendChild(title);
}

function appendLandingPreviewList(parent, items = []) {
  if (!items.length) return;
  const list = document.createElement("ul");
  list.className = "landing-preview-line";
  list.style.margin = "0";
  list.style.paddingLeft = "16px";
  items.forEach((item) => {
    const listItem = document.createElement("li");
    listItem.textContent = item;
    list.appendChild(listItem);
  });
  parent.appendChild(list);
}

function appendStructuredLandingPagePreview(parent, sections) {
  if (!sections) return false;

  const preview = document.createElement("div");
  preview.className = "landing-preview-structured";
  preview.style.display = "grid";
  preview.style.gap = "4px";
  preview.style.maxHeight = "13.5em";
  preview.style.overflow = "hidden";
  preview.style.paddingBottom = "4px";

  appendLandingPreviewText(preview, "landing-preview-line", sections.heroHeadline, {
    color: "#1f2a5c",
    fontSize: "0.82rem",
    fontWeight: "800",
    lineHeight: "1.2"
  });
  appendLandingPreviewText(preview, "landing-preview-line", sections.subheadline, {
    color: "#4a537b"
  });

  const benefitItems = parseLandingPreviewListItems(sections.benefits, 4);
  if (benefitItems.length) {
    appendLandingPreviewSectionTitle(preview, "Benefits");
    appendLandingPreviewList(preview, benefitItems);
  }

  const trustItems = parseLandingPreviewListItems(sections.trustElements, 3);
  if (trustItems.length) {
    appendLandingPreviewSectionTitle(preview, "Trust Elements");
    appendLandingPreviewList(preview, trustItems);
  }

  const faqItems = parseLandingPreviewListItems(sections.faq, 2);
  if (faqItems.length) {
    appendLandingPreviewSectionTitle(preview, "FAQ");
    appendLandingPreviewList(preview, faqItems);
  }

  appendLandingPreviewText(preview, "landing-preview-line is-cta", firstCleanLandingSectionValue(sections.primaryCta, sections.finalCta, sections.cta), {
    background: "#eef3ff",
    border: "1px solid #dce6ff",
    borderRadius: "8px",
    color: "#30407d",
    fontWeight: "800",
    padding: "5px 7px",
    textAlign: "center"
  });

  parent.appendChild(preview);
  return true;
}

function canonicalizeCampaignPlanNodes(nodes = [], setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  const grouped = CAMPAIGN_CHAIN_TYPES.reduce((groups, type) => {
    groups[type] = [];
    return groups;
  }, {});

  nodes.forEach((node) => {
    if (grouped[node?.type]) grouped[node.type].push(node);
  });

  const expectedCounts = {
    Idea: 1,
    "Campaign Variation": normalized.variationCount,
    Content: normalized.variationCount,
    "Social Media Posting": normalized.variationCount * normalized.postsPerVariation,
    "Landing Page": normalized.includeLandingPage ? normalized.variationCount : 0,
    "Email Campaign": normalized.includeEmailCampaign ? normalized.variationCount : 0
  };

  Object.entries(expectedCounts).forEach(([type, expected]) => {
    const actual = grouped[type]?.length || 0;
    if (actual !== expected) {
      throw new Error(`Campaign plan must include exactly ${expected} ${type} node${expected === 1 ? "" : "s"}; received ${actual}.`);
    }
  });

  const canonicalNodes = [grouped.Idea[0]];
  for (let lane = 0; lane < normalized.variationCount; lane += 1) {
    const socialStart = lane * normalized.postsPerVariation;
    canonicalNodes.push(grouped["Campaign Variation"][lane]);
    canonicalNodes.push(grouped.Content[lane]);
    canonicalNodes.push(...grouped["Social Media Posting"].slice(socialStart, socialStart + normalized.postsPerVariation));
    if (normalized.includeLandingPage) canonicalNodes.push(grouped["Landing Page"][lane]);
    if (normalized.includeEmailCampaign) canonicalNodes.push(grouped["Email Campaign"][lane]);
  }

  return canonicalNodes;
}

function validateGeneratedCampaignPlan(plan = {}, setupOptions = {}) {
  const setup = normalizeCampaignSetupOptions(plan.setup || setupOptions);
  const nodes = Array.isArray(plan.nodes) ? plan.nodes : [];
  const edges = Array.isArray(plan.edges) ? plan.edges : [];
  const expectedNodes = expectedCampaignNodeCount(setup);
  if (nodes.length !== expectedNodes) {
    throw new Error(`Campaign plan must include exactly ${expectedNodes} nodes.`);
  }
  const normalizedNodes = nodes.map((node, index) => {
    const type = cleanCampaignField(node?.type);
    if (!CAMPAIGN_CHAIN_TYPES.includes(type)) {
      throw new Error(`Campaign node ${index + 1} has unsupported type ${type || "(empty)"}.`);
    }
    return {
      type,
      title: cleanCampaignField(node.title) || type,
      description: cleanCampaignField(node.description),
      content: cleanCampaignField(node.content),
      metadata: node.metadata && typeof node.metadata === "object" ? node.metadata : {},
      imagePrompt: cleanCampaignField(node.imagePrompt),
      social: node.social && typeof node.social === "object" ? node.social : {},
      landingPage: node.landingPage && typeof node.landingPage === "object" ? node.landingPage : {}
    };
  });
  const canonicalNodes = canonicalizeCampaignPlanNodes(normalizedNodes, setup);
  edges.forEach((edge) => {
    if (!Number.isInteger(edge?.fromIndex) || !Number.isInteger(edge?.toIndex)) throw new Error("Campaign edges must use numeric indexes.");
    if (edge.fromIndex < 0 || edge.fromIndex >= normalizedNodes.length || edge.toIndex < 0 || edge.toIndex >= normalizedNodes.length) {
      throw new Error("Campaign edge index is out of range.");
    }
  });
  return { nodes: canonicalNodes, edges: deriveCampaignFunnelEdges(canonicalNodes, setup), setup };
}

function applyGeneratedCampaignNodePayload(node, payload = {}, previousNode = null) {
  const metadata = payload.metadata || {};
  const description = cleanCampaignField(payload.description);
  const content = cleanCampaignField(payload.content);
  node.title = cleanCampaignField(payload.title) || payload.type || node.type;
  node.content = [description, content].filter(Boolean).join("\n\n") || node.content || node.title;
  node.goal = cleanCampaignField(metadata.goal) || previousNode?.goal || node.goal;
  node.audience = cleanCampaignField(metadata.audience) || previousNode?.audience || node.audience;
  node.channel = cleanCampaignField(metadata.channel) || previousNode?.channel || node.channel;
  node.funnelStage = cleanCampaignField(metadata.funnelStage) || previousNode?.funnelStage || node.funnelStage;
  node.tone = cleanCampaignField(metadata.tone) || previousNode?.tone || node.tone;

  if (node.type === "Content") {
    node.imagePrompt = cleanCampaignField(payload.imagePrompt) || buildContentImagePrompt(node.title, node.content);
  }

  if (node.type === "Social Media Posting") {
    const platform = cleanCampaignField(payload.social?.platform) || node.channel || "LinkedIn";
    const caption = cleanCampaignField(payload.social?.caption) || node.content || node.title;
    node.social.platform = platform;
    node.social.caption = caption;
    node.social.preview = description;
    node.social.hashtags = finalizeGeneratedHashtags(payload.social?.hashtags || `${node.title}, ${caption}`, platform);
    node.content = caption;
    node.channel = platform;
  }

  if (node.type === "Landing Page") {
    const landing = payload.landingPage || {};
    node.landingPage = {
      headerVisualPrompt: cleanCampaignField(landing.headerVisualPrompt),
      headerClaim: cleanCampaignField(landing.headerClaim),
      problem: cleanCampaignField(landing.problem || landing.problemOfIcp),
      solution: cleanCampaignField(landing.solution || landing.solutionForIcp),
      trust: cleanCampaignField(landing.trust || landing.buildingTrust),
      cta: cleanCampaignField(landing.cta || landing.conversionCta)
    };
    node.content = [description, content].filter(Boolean).join("\n\n") || node.landingPage.headerClaim || "";
    const landingSections = parseStructuredLandingPagePreview(node.content) || {};
    const sectionHeaderClaim = firstCleanLandingSectionValue(landingSections.heroHeadline);
    const sectionProblem = combineLandingSectionValues(landingSections.subheadline, landingSections.problemSection);
    const sectionSolution = combineLandingSectionValues(landingSections.offer, landingSections.benefits);
    const sectionTrust = combineLandingSectionValues(landingSections.trustElements, landingSections.faq);
    const sectionCta = firstCleanLandingSectionValue(landingSections.primaryCta, landingSections.finalCta, landingSections.cta);
    if (sectionHeaderClaim && isWeakLandingPageField(node.landingPage.headerClaim)) node.landingPage.headerClaim = sectionHeaderClaim;
    if (sectionProblem && isWeakLandingPageField(node.landingPage.problem)) node.landingPage.problem = sectionProblem;
    if (sectionSolution && isWeakLandingPageField(node.landingPage.solution)) node.landingPage.solution = sectionSolution;
    if (sectionTrust && isWeakLandingPageField(node.landingPage.trust)) node.landingPage.trust = sectionTrust;
    if (sectionCta && isWeakLandingPageField(node.landingPage.cta)) node.landingPage.cta = sectionCta;
  }
}

const CAMPAIGN_V2_X = {
  idea: 0,
  variation: 360,
  content: 720,
  social: 1080,
  landing: 1440,
  email: 1800
};
const CAMPAIGN_V2_ROW_GAP = 260;
const CAMPAIGN_V2_ITEM_GAP = 176;
const CAMPAIGN_V2_PADDING = 420;

function campaignPlanRowHeight(setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  return Math.max(CAMPAIGN_V2_ROW_GAP, normalized.postsPerVariation * CAMPAIGN_V2_ITEM_GAP + 80);
}

function campaignPlanRect(origin, setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  const rowHeight = campaignPlanRowHeight(normalized);
  const maxX = normalized.includeEmailCampaign ? CAMPAIGN_V2_X.email : normalized.includeLandingPage ? CAMPAIGN_V2_X.landing : CAMPAIGN_V2_X.social;
  return {
    minX: origin.x,
    minY: origin.y,
    maxX: origin.x + maxX + NODE_WIDTH + 220,
    maxY: origin.y + Math.max(NODE_HEIGHT + 200, normalized.variationCount * rowHeight + 220)
  };
}

function campaignRectOverlapsExisting(rect, padding = 80) {
  return state.nodes.some((node) => {
    const nodeEl = el.zoomLayer?.querySelector(`[data-id='${node.id}']`);
    const x = Number.isFinite(node?.position?.x) ? node.position.x : 0;
    const y = Number.isFinite(node?.position?.y) ? node.position.y : 0;
    const width = nodeEl?.offsetWidth || NODE_WIDTH;
    const height = nodeEl?.offsetHeight || NODE_HEIGHT;
    return !(
      rect.maxX + padding < x
      || rect.minX - padding > x + width
      || rect.maxY + padding < y
      || rect.minY - padding > y + height
    );
  });
}

function calculateCampaignPlanOrigin(setup = {}) {
  const visible = visibleBoardBounds();
  const rectAt = (origin) => campaignPlanRect(origin, setup);
  const sampleRect = rectAt({ x: 0, y: 0 });
  const planWidth = sampleRect.maxX - sampleRect.minX;
  const planHeight = sampleRect.maxY - sampleRect.minY;
  const visibleOrigin = clampNodePosition(
    visible.left + Math.max(80, (visible.width - planWidth) / 2),
    visible.top + Math.max(80, (visible.height - Math.min(planHeight, visible.height)) / 2)
  );
  if (!state.nodes.length) return visibleOrigin;

  const viewportHasRoom = visible.width >= Math.min(planWidth, visible.width) * 0.75 && visible.height >= Math.min(planHeight, visible.height) * 0.45;
  if (viewportHasRoom && !campaignRectOverlapsExisting(rectAt(visibleOrigin), 120)) return visibleOrigin;

  const bounds = getBoardContentBounds({ includeMargin: 0 });
  if (!bounds) return visibleOrigin;

  const rightOrigin = clampNodePosition(bounds.maxX + CAMPAIGN_V2_PADDING, Math.max(120, bounds.minY));
  if (!campaignRectOverlapsExisting(rectAt(rightOrigin), 120)) return rightOrigin;

  return clampNodePosition(Math.max(120, bounds.minX), bounds.maxY + CAMPAIGN_V2_PADDING);
}

function deriveCampaignStructure(nodes = [], setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  const indexesByType = CAMPAIGN_CHAIN_TYPES.reduce((groups, type) => {
    groups[type] = [];
    return groups;
  }, {});
  nodes.forEach((node, index) => {
    if (indexesByType[node?.type]) indexesByType[node.type].push(index);
  });

  const ideaIndex = indexesByType.Idea[0];
  if (!Number.isInteger(ideaIndex)) return [];

  const variations = [];
  for (let row = 0; row < normalized.variationCount; row += 1) {
    const variationIndex = indexesByType["Campaign Variation"][row];
    const contentIndex = indexesByType.Content[row];
    const socialStart = row * normalized.postsPerVariation;
    const socialIndexes = indexesByType["Social Media Posting"].slice(socialStart, socialStart + normalized.postsPerVariation);
    const landingIndex = normalized.includeLandingPage ? indexesByType["Landing Page"][row] : null;
    const emailIndex = normalized.includeEmailCampaign ? indexesByType["Email Campaign"][row] : null;
    if (!Number.isInteger(variationIndex) || !Number.isInteger(contentIndex) || socialIndexes.length !== normalized.postsPerVariation) continue;
    if (normalized.includeLandingPage && !Number.isInteger(landingIndex)) continue;
    if (normalized.includeEmailCampaign && !Number.isInteger(emailIndex)) continue;
    variations.push({ row, ideaIndex, variationIndex, contentIndex, socialIndexes, landingIndex, emailIndex });
  }
  return variations;
}
function deriveCampaignFunnelEdges(nodes = [], setup = {}) {
  const edges = [];
  deriveCampaignStructure(nodes, setup).forEach((variation) => {
    edges.push({ fromIndex: variation.ideaIndex, toIndex: variation.variationIndex });
    edges.push({ fromIndex: variation.variationIndex, toIndex: variation.contentIndex });
    variation.socialIndexes.forEach((socialIndex) => {
      if (!nodes[socialIndex]) return;
      edges.push({ fromIndex: variation.contentIndex, toIndex: socialIndex });
      if (variation.landingIndex !== null && nodes[variation.landingIndex]) edges.push({ fromIndex: socialIndex, toIndex: variation.landingIndex });
      else if (variation.emailIndex !== null && nodes[variation.emailIndex]) edges.push({ fromIndex: socialIndex, toIndex: variation.emailIndex });
    });
    if (variation.landingIndex !== null && variation.emailIndex !== null && nodes[variation.landingIndex] && nodes[variation.emailIndex]) {
      edges.push({ fromIndex: variation.landingIndex, toIndex: variation.emailIndex });
    }
  });
  return edges;
}

function calculateCampaignNodePositions(nodes = [], origin, setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  const rowHeight = campaignPlanRowHeight(normalized);
  const positions = new Map();
  const structure = deriveCampaignStructure(nodes, normalized);
  const ideaIndex = structure[0]?.ideaIndex ?? 0;
  positions.set(ideaIndex, {
    x: origin.x + CAMPAIGN_V2_X.idea,
    y: origin.y + Math.max(0, ((normalized.variationCount - 1) * rowHeight) / 2)
  });
  structure.forEach((variation) => {
    const rowY = origin.y + variation.row * rowHeight;
    positions.set(variation.variationIndex, { x: origin.x + CAMPAIGN_V2_X.variation, y: rowY });
    positions.set(variation.contentIndex, { x: origin.x + CAMPAIGN_V2_X.content, y: rowY });
    variation.socialIndexes.forEach((socialIndex, index) => {
      positions.set(socialIndex, { x: origin.x + CAMPAIGN_V2_X.social, y: rowY + index * CAMPAIGN_V2_ITEM_GAP });
    });
    const middleY = rowY + Math.max(0, ((variation.socialIndexes.length - 1) * CAMPAIGN_V2_ITEM_GAP) / 2);
    if (variation.landingIndex !== null) positions.set(variation.landingIndex, { x: origin.x + CAMPAIGN_V2_X.landing, y: middleY });
    if (variation.emailIndex !== null) positions.set(variation.emailIndex, { x: origin.x + CAMPAIGN_V2_X.email, y: middleY });
  });
  return positions;
}

function campaignGenerationOrder(nodes = [], setup = {}) {
  const variations = deriveCampaignStructure(nodes, setup);
  return [
    variations[0]?.ideaIndex ?? 0,
    ...variations.map((variation) => variation.variationIndex),
    ...variations.map((variation) => variation.contentIndex),
    ...variations.flatMap((variation) => variation.socialIndexes),
    ...variations.map((variation) => variation.landingIndex).filter((index) => index !== null),
    ...variations.map((variation) => variation.emailIndex).filter((index) => index !== null)
  ].filter((index) => nodes[index]);
}

async function generateCampaignChainProgressively(plan, { onStatus = null, setupOptions = {}, onFirstNode = null } = {}) {
  const validated = validateGeneratedCampaignPlan(plan, setupOptions);
  setActiveView("board");
  toggleListMode(false);
  const chainOrigin = calculateCampaignPlanOrigin(validated.setup);
  const positions = calculateCampaignNodePositions(validated.nodes, chainOrigin, validated.setup);
  const creationOrder = campaignGenerationOrder(validated.nodes, validated.setup);
  const createdNodes = [];
  const createdByIndex = new Map();
  let firstNodeAnnounced = false;
  try {
    for (let orderIndex = 0; orderIndex < creationOrder.length; orderIndex += 1) {
      const index = creationOrder[orderIndex];
      const payload = validated.nodes[index];
      const status = CAMPAIGN_WORKER_STATUS[payload.type] || "✨ AI teammate is building the campaign...";
      if (onStatus) onStatus(`${status} (${orderIndex + 1}/${validated.nodes.length})`);
      setSaveStatus(`${status} (${orderIndex + 1}/${validated.nodes.length})`);
      const node = createNode({ type: payload.type, parentId: null, position: positions.get(index) || chainOrigin });
      if (!node) throw new Error(`Could not create ${payload.type}.`);
      const incomingEdge = validated.edges.find((edge) => edge.toIndex === index && createdByIndex.has(edge.fromIndex));
      const previousNode = incomingEdge ? createdByIndex.get(incomingEdge.fromIndex) : createdNodes[createdNodes.length - 1] || null;
      applyGeneratedCampaignNodePayload(node, payload, previousNode);
      updateNodeCard(node);
      fillInspector(node);
      updateListView();
      const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
      nodeEl?.classList.add("campaign-node-reveal", "ai-updated");
      setTimeout(() => nodeEl?.classList.remove("campaign-node-reveal"), 760);
      setTimeout(() => nodeEl?.classList.remove("ai-updated"), 1000);
      createdNodes.push(node);
      createdByIndex.set(index, node);
      if (!firstNodeAnnounced) {
        firstNodeAnnounced = true;
        onFirstNode?.(node);
      }
      validated.edges
        .filter((edge) => edge.toIndex === index && createdByIndex.has(edge.fromIndex))
        .forEach((edge) => addEdge(createdByIndex.get(edge.fromIndex).id, node.id));
      validated.edges
        .filter((edge) => edge.fromIndex === index && createdByIndex.has(edge.toIndex))
        .forEach((edge) => addEdge(node.id, createdByIndex.get(edge.toIndex).id));
      drawLinks();
      markUnsaved();
      await waitForCampaignWorker(orderIndex === 0 ? 520 : 320);
    }
    validated.edges.forEach((edge) => {
      const source = createdByIndex.get(edge.fromIndex);
      const target = createdByIndex.get(edge.toIndex);
      if (source && target && !state.edges.some(([a, b]) => a === source.id && b === target.id)) addEdge(source.id, target.id);
    });
    updateEmptyState();
    drawLinks();
    updateListView();
    const ideaNode = createdByIndex.get(0) || createdNodes[0];
    appendActivity("generated_campaign_chain", { node: ideaNode, nodeTitle: activityNodeTitle(ideaNode) });
    state.runtimeDiagnostics.canvasSource = "generated campaign";
    logRuntimeAlignmentDiagnostics("generated-campaign");
    markUnsaved();
    setSaveStatus("Campaign generated");
    return createdNodes;
  } catch (error) {
    console.error("[Funklix AI] Progressive campaign generation stopped", error);
    error.partialCampaign = createdNodes.length > 0;
    setSaveStatus("Campaign generation stopped early. You can continue manually or use Generate Next Step.");
    throw error;
  }
}
async function generateCampaignFromIdea(ideaText, contextText, providedPlan = null, options = {}) {
  const setupOptions = normalizeCampaignSetupOptions(options.setupOptions || providedPlan?.setup || {});
  const plan = providedPlan || await fetchGeneratedCampaignPlan(ideaText, contextText, setupOptions);
  return generateCampaignChainProgressively(plan, { ...options, setupOptions });
}

function getCampaignV3Api() {
  return typeof window !== "undefined" ? window.CampaignGeneratorV3 : null;
}

function defaultCampaignV3AISetup(overrides = {}) {
  const normalized = normalizeCampaignSetupOptions({
    variationCount: overrides.variationCount ?? 3,
    postsPerVariation: overrides.postsPerVariation ?? 3,
    channel: overrides.channel || "LinkedIn",
    includeLandingPage: overrides.includeLandingPage !== false,
    includeEmailCampaign: overrides.includeEmailCampaign !== false
  });
  return {
    campaignIdea: cleanCampaignField(overrides.campaignIdea) || "Promote a premium networking experience for C-level executives.",
    additionalContext: cleanCampaignField(overrides.additionalContext) || "Focus on trust, exclusivity, meaningful business relationships, and high-quality leads.",
    ...normalized
  };
}

function campaignV3NodeCounts(nodes = []) {
  const counts = CAMPAIGN_CHAIN_TYPES.reduce((nextCounts, type) => {
    nextCounts[type] = 0;
    return nextCounts;
  }, {});
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const type = cleanCampaignField(node?.type);
    if (Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
  });
  return counts;
}

function expectedCampaignV3NodeCounts(setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  return {
    Idea: 1,
    "Campaign Variation": normalized.variationCount,
    Content: normalized.variationCount,
    "Social Media Posting": normalized.variationCount * normalized.postsPerVariation,
    "Landing Page": normalized.includeLandingPage ? 1 : 0,
    "Email Campaign": normalized.includeEmailCampaign ? 1 : 0
  };
}

function campaignV3NodeSubtype(node = {}) {
  return cleanCampaignField(node.subtype || node.subType || node.metadata?.subtype || node.metadata?.subType || node.metadata?.purpose || node.metadata?.angle || "(none)");
}

function campaignV3NodeSubtypeCounts(nodes = []) {
  return (Array.isArray(nodes) ? nodes : []).reduce((counts, node) => {
    const subtype = campaignV3NodeSubtype(node);
    counts[subtype] = (counts[subtype] || 0) + 1;
    return counts;
  }, {});
}

function campaignV3NodeReport(nodes = [], limit = Number.POSITIVE_INFINITY) {
  return (Array.isArray(nodes) ? nodes : []).slice(0, limit).map((node, index) => ({
    index,
    title: cleanCampaignField(node?.title),
    type: cleanCampaignField(node?.type),
    subtype: campaignV3NodeSubtype(node)
  }));
}

function campaignV3EmailBodyText(node = {}) {
  return cleanCampaignField(node.content || node.body || node.email?.body || node.metadata?.body || "");
}

function normalizeCampaignV3AIEmailNodes(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const emailEntries = sourceNodes
    .map((node, index) => ({ node, index, type: cleanCampaignField(node?.type) }))
    .filter((entry) => entry.type === "Email Campaign");

  if (setup.includeEmailCampaign === false) {
    const discardedEmailTitles = emailEntries
      .map((entry) => cleanCampaignField(entry.node?.title) || `Email Campaign ${entry.index + 1}`);
    return {
      nodes: sourceNodes.filter((node) => cleanCampaignField(node?.type) !== "Email Campaign"),
      diagnostics: {
        originalEmailCount: emailEntries.length,
        selectedCanonicalEmailTitle: "",
        discardedEmailTitles,
        emailDisabled: true
      }
    };
  }

  if (emailEntries.length <= 1) {
    return {
      nodes: sourceNodes,
      diagnostics: {
        originalEmailCount: emailEntries.length,
        selectedCanonicalEmailTitle: emailEntries[0] ? cleanCampaignField(emailEntries[0].node?.title) : "",
        discardedEmailTitles: [],
        emailDisabled: false
      }
    };
  }

  const canonicalEntry = emailEntries.reduce((best, entry) => {
    const bestLength = campaignV3EmailBodyText(best.node).length;
    const entryLength = campaignV3EmailBodyText(entry.node).length;
    return entryLength > bestLength ? entry : best;
  }, emailEntries[0]);
  const discardedEmailTitles = emailEntries
    .filter((entry) => entry.index !== canonicalEntry.index)
    .map((entry) => cleanCampaignField(entry.node?.title) || `Email Campaign ${entry.index + 1}`);

  return {
    nodes: sourceNodes.filter((node, index) => cleanCampaignField(node?.type) !== "Email Campaign" || index === canonicalEntry.index),
    diagnostics: {
      originalEmailCount: emailEntries.length,
      selectedCanonicalEmailTitle: cleanCampaignField(canonicalEntry.node?.title) || `Email Campaign ${canonicalEntry.index + 1}`,
      discardedEmailTitles,
      emailDisabled: false
    }
  };
}

function campaignV3LandingBodyText(node = {}) {
  const landingPage = node.landingPage && typeof node.landingPage === "object" ? node.landingPage : {};
  return [
    node.content,
    landingPage.headerClaim,
    landingPage.problem,
    landingPage.solution,
    landingPage.trust,
    landingPage.cta
  ].map((value) => cleanCampaignField(value)).filter(Boolean).join("\n");
}

function normalizeCampaignV3AILandingNodes(nodes = []) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const landingEntries = sourceNodes
    .map((node, index) => ({ node, index, type: cleanCampaignField(node?.type) }))
    .filter((entry) => entry.type === "Landing Page");

  if (landingEntries.length <= 1) {
    return {
      nodes: sourceNodes,
      diagnostics: {
        originalLandingCount: landingEntries.length,
        selectedCanonicalLandingTitle: landingEntries[0] ? cleanCampaignField(landingEntries[0].node?.title) : "",
        discardedLandingTitles: []
      }
    };
  }

  const canonicalEntry = landingEntries.reduce((best, entry) => {
    const bestLength = campaignV3LandingBodyText(best.node).length;
    const entryLength = campaignV3LandingBodyText(entry.node).length;
    return entryLength > bestLength ? entry : best;
  }, landingEntries[0]);
  const discardedLandingTitles = landingEntries
    .filter((entry) => entry.index !== canonicalEntry.index)
    .map((entry) => cleanCampaignField(entry.node?.title) || `Landing Page ${entry.index + 1}`);

  return {
    nodes: sourceNodes.filter((node, index) => cleanCampaignField(node?.type) !== "Landing Page" || index === canonicalEntry.index),
    diagnostics: {
      originalLandingCount: landingEntries.length,
      selectedCanonicalLandingTitle: cleanCampaignField(canonicalEntry.node?.title) || `Landing Page ${canonicalEntry.index + 1}`,
      discardedLandingTitles
    }
  };
}

function normalizeCampaignV3AIPrimaryOvercounts(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const normalized = normalizeCampaignSetupOptions(setup);
  const limits = {
    Idea: 1,
    "Campaign Variation": normalized.variationCount,
    Content: normalized.variationCount
  };
  const keptByType = { Idea: [], "Campaign Variation": [], Content: [] };
  const discardedByType = { Idea: [], "Campaign Variation": [], Content: [] };

  const normalizedNodes = sourceNodes.filter((node) => {
    const type = cleanCampaignField(node?.type);
    if (!Object.prototype.hasOwnProperty.call(limits, type)) return true;
    if (keptByType[type].length < limits[type]) {
      keptByType[type].push(node);
      return true;
    }
    discardedByType[type].push(cleanCampaignField(node?.title) || `${type} ${keptByType[type].length + discardedByType[type].length + 1}`);
    return false;
  });

  return {
    nodes: normalizedNodes,
    diagnostics: {
      originalCounts: campaignV3NodeCounts(sourceNodes),
      normalizedCounts: campaignV3NodeCounts(normalizedNodes),
      selectedIdeaTitle: keptByType.Idea[0] ? cleanCampaignField(keptByType.Idea[0].title) : "",
      selectedVariationTitles: keptByType["Campaign Variation"].map((node) => cleanCampaignField(node.title)),
      selectedContentTitles: keptByType.Content.map((node) => cleanCampaignField(node.title)),
      discardedIdeaTitles: discardedByType.Idea,
      discardedVariationTitles: discardedByType["Campaign Variation"],
      discardedContentTitles: discardedByType.Content
    }
  };
}

function normalizeCampaignV3AISocialOvercounts(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const normalized = normalizeCampaignSetupOptions(setup);
  const expectedSocialCount = normalized.variationCount * normalized.postsPerVariation;
  const keptSocials = [];
  const discardedSocialTitles = [];

  const normalizedNodes = sourceNodes.filter((node) => {
    const type = cleanCampaignField(node?.type);
    if (type !== "Social Media Posting") return true;
    if (keptSocials.length < expectedSocialCount) {
      keptSocials.push(node);
      return true;
    }
    discardedSocialTitles.push(cleanCampaignField(node?.title) || `Social Media Posting ${keptSocials.length + discardedSocialTitles.length + 1}`);
    return false;
  });

  return {
    nodes: normalizedNodes,
    diagnostics: {
      originalSocialCount: sourceNodes.filter((node) => cleanCampaignField(node?.type) === "Social Media Posting").length,
      expectedSocialCount,
      keptSocialTitles: keptSocials.map((node) => cleanCampaignField(node.title)),
      discardedSocialTitles,
      normalizedCounts: campaignV3NodeCounts(normalizedNodes)
    }
  };
}

function buildCampaignV3FallbackLandingNode(nodes = [], setup = {}) {
  const ideaNode = (Array.isArray(nodes) ? nodes : []).find((node) => cleanCampaignField(node?.type) === "Idea") || {};
  const variationTitles = (Array.isArray(nodes) ? nodes : [])
    .filter((node) => cleanCampaignField(node?.type) === "Campaign Variation")
    .map((node) => cleanCampaignField(node?.title))
    .filter(Boolean);
  const emailNode = (Array.isArray(nodes) ? nodes : []).find((node) => cleanCampaignField(node?.type) === "Email Campaign") || {};
  const campaignIdea = cleanCampaignField(setup.campaignIdea || ideaNode.title || ideaNode.content) || "the campaign offer";
  const context = cleanCampaignField(setup.additionalContext || ideaNode.description || ideaNode.content);
  const variationsSummary = variationTitles.slice(0, 3).join(", ");
  const emailTitle = cleanCampaignField(emailNode.title);
  const description = `Landing page for ${campaignIdea}${context ? `. ${context}` : ""}`;
  const content = [
    `Position ${campaignIdea} as a focused campaign destination.`,
    variationsSummary ? `Support campaign angles: ${variationsSummary}.` : "Reinforce the strongest campaign angle and primary value proposition.",
    emailTitle ? `Align follow-up with ${emailTitle}.` : "Guide qualified visitors toward the next step."
  ].join("\n");

  return {
    tempId: "campaign-v3-ai-fallback-landing",
    type: "Landing Page",
    title: "Campaign Landing Page",
    description,
    content,
    metadata: {
      goal: cleanCampaignField(ideaNode.metadata?.goal) || "Convert qualified campaign interest",
      audience: cleanCampaignField(ideaNode.metadata?.audience) || "Campaign audience",
      channel: setup.channel || "LinkedIn",
      funnelStage: "Landing Page",
      tone: cleanCampaignField(ideaNode.metadata?.tone) || "Trusted and exclusive"
    },
    imagePrompt: `Premium landing page hero visual for ${campaignIdea}`,
    social: { platform: "", caption: "", hashtags: "" },
    landingPage: {
      headerVisualPrompt: `Premium landing page hero visual for ${campaignIdea}`,
      headerClaim: campaignIdea,
      problem: context || "Busy decision-makers need a trusted reason to engage.",
      solution: `A focused campaign experience for ${campaignIdea}.`,
      trust: "Built around trust, exclusivity, and meaningful business relationships.",
      cta: "Request an invitation"
    }
  };
}

function normalizeCampaignV3AILandingFallback(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const landingCount = sourceNodes.filter((node) => cleanCampaignField(node?.type) === "Landing Page").length;
  if (!setup.includeLandingPage || landingCount > 0) {
    return {
      nodes: sourceNodes,
      diagnostics: {
        landingFallbackCreated: false,
        fallbackLandingTitle: "",
        reason: landingCount > 0 ? "landing page already present" : "landing page disabled",
        originalLandingCount: landingCount
      }
    };
  }

  const fallbackLanding = buildCampaignV3FallbackLandingNode(sourceNodes, setup);
  return {
    nodes: [...sourceNodes, fallbackLanding],
    diagnostics: {
      landingFallbackCreated: true,
      fallbackLandingTitle: fallbackLanding.title,
      reason: "missing landing page from AI response",
      originalLandingCount: landingCount
    }
  };
}

function buildCampaignV3FallbackEmailNode(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const ideaNode = sourceNodes.find((node) => cleanCampaignField(node?.type) === "Idea") || {};
  const landingNode = sourceNodes.find((node) => cleanCampaignField(node?.type) === "Landing Page") || {};
  const variationTitles = sourceNodes
    .filter((node) => cleanCampaignField(node?.type) === "Campaign Variation")
    .map((node) => cleanCampaignField(node?.title))
    .filter(Boolean);
  const campaignIdea = cleanCampaignField(setup.campaignIdea || ideaNode.title || ideaNode.content || landingNode.title) || "the campaign offer";
  const context = cleanCampaignField(setup.additionalContext || ideaNode.description || landingNode.description || ideaNode.content);
  const audience = cleanCampaignField(ideaNode.metadata?.audience || landingNode.metadata?.audience) || "Campaign audience";
  const goal = "Follow up with interested prospects and guide them toward conversion";
  const subject = `Next steps for ${campaignIdea}`;
  const variationSummary = variationTitles.slice(0, 2).join(" and ");
  const bodyOutline = [
    `Open with a concise reminder of ${campaignIdea}.`,
    context ? `Connect the message to this audience need: ${context}.` : `Highlight the most relevant benefit for ${audience}.`,
    variationSummary ? `Reference the strongest campaign angles: ${variationSummary}.` : "Reinforce the primary value proposition with a practical next step.",
    "Close with a clear reply or booking action."
  ].join("\n");

  return {
    tempId: "campaign-v3-ai-fallback-email",
    type: "Email Campaign",
    title: `Follow-up email for ${campaignIdea}`,
    description: `Nurture email campaign for ${audience} after they engage with ${campaignIdea}.`,
    content: `Subject: ${subject}\n\n${bodyOutline}`,
    metadata: {
      goal,
      audience,
      channel: "Email",
      funnelStage: "Email Campaign",
      tone: cleanCampaignField(ideaNode.metadata?.tone || landingNode.metadata?.tone) || "Helpful and direct"
    },
    imagePrompt: "",
    social: { platform: "", caption: "", hashtags: "" },
    landingPage: {}
  };
}

function normalizeCampaignV3AIEmailFallback(nodes = [], setup = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const emailCount = sourceNodes.filter((node) => cleanCampaignField(node?.type) === "Email Campaign").length;
  if (setup.includeEmailCampaign === false || emailCount > 0) {
    return {
      nodes: sourceNodes,
      diagnostics: {
        emailFallbackCreated: false,
        fallbackEmailTitle: "",
        reason: emailCount > 0 ? "email campaign already present" : "email campaign disabled",
        originalEmailCount: emailCount
      }
    };
  }

  const fallbackEmail = buildCampaignV3FallbackEmailNode(sourceNodes, setup);
  return {
    nodes: [...sourceNodes, fallbackEmail],
    diagnostics: {
      emailFallbackCreated: true,
      fallbackEmailTitle: fallbackEmail.title,
      reason: "missing email campaign from AI response",
      originalEmailCount: emailCount
    }
  };
}

function campaignV3QualityNormalized(value = "") {
  return cleanCampaignField(value).toLowerCase();
}

function campaignV3QualityHasInviteContext(setup = {}) {
  const combined = [
    setup.campaignIdea,
    setup.additionalContext,
    setup.offer,
    setup.valueProposition
  ].map((value) => campaignV3QualityNormalized(value)).join(" ");
  return /\b(invite|invitation|access|exclusive|private|waitlist|application)\b/.test(combined);
}

function campaignV3QualityLooksLikeSocialPost(value = "") {
  const cleaned = cleanCampaignField(value);
  if (!cleaned) return false;
  return /^#\w+/.test(cleaned) || /(?:^|\s)#\w+/.test(cleaned) || /\b(?:caption|hashtags?|post copy)\s*:/i.test(cleaned);
}

function campaignV3QualityHasMeaningfulTextBeforeHashtag(value = "") {
  const cleaned = cleanCampaignField(value);
  if (!cleaned.includes("#")) return true;
  const firstHashIndex = cleaned.indexOf("#");
  return cleaned.slice(0, firstHashIndex).replace(/[^\w]+/g, " ").trim().length >= 20;
}

function campaignV3QualityHasSubjectLine(value = "") {
  return /\bsubject(?: line)?\s*:/i.test(cleanCampaignField(value));
}

function campaignV3QualityHasCta(value = "") {
  return /\b(?:cta|call to action|book|reserve|request|schedule|start|get|try|join|apply|download|reply|contact)\b/i.test(cleanCampaignField(value));
}

function campaignV3StrategicNormalize(value = "") {
  return cleanCampaignField(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function campaignV3StrategicTextForNode(node = {}) {
  const type = cleanCampaignField(node?.type);
  const description = cleanCampaignField(node?.description);
  const content = cleanCampaignField(node?.content);
  if (type === "Social Media Posting") return cleanCampaignField(node?.social?.caption || content || description);
  if (type === "Landing Page") {
    const landing = node?.landingPage || {};
    return [
      description,
      content,
      landing.headerClaim,
      landing.problem,
      landing.solution,
      landing.trust,
      landing.cta
    ].map((value) => cleanCampaignField(value)).filter(Boolean).join("\n\n");
  }
  return [description, content].filter(Boolean).join("\n\n");
}

function campaignV3StrategicTokens(value = "") {
  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "in", "into", "is", "it", "of", "on", "or", "that", "the", "this", "to", "with",
    "campaign", "variation", "angle", "audience", "offer", "content", "post", "social", "media", "email", "landing", "page", "business", "marketing"
  ]);
  return campaignV3StrategicNormalize(value)
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function campaignV3StrategicJaccardSimilarity(a = "", b = "") {
  const first = new Set(campaignV3StrategicTokens(a));
  const second = new Set(campaignV3StrategicTokens(b));
  if (!first.size || !second.size) return 0;
  const intersection = [...first].filter((token) => second.has(token)).length;
  const union = new Set([...first, ...second]).size;
  return union ? intersection / union : 0;
}

function campaignV3StrategicLooksLikeGenericTitle(title = "", type = "") {
  const normalizedTitle = campaignV3StrategicNormalize(title);
  if (!normalizedTitle) return null;
  const normalizedType = campaignV3StrategicNormalize(type);
  const exactGenericTitles = new Set([
    "campaign landing page",
    "landing page",
    "campaign variation",
    "social media post",
    "social media posting",
    "email campaign",
    "campaign idea",
    "content",
    "generated campaign",
    "untitled"
  ]);
  if (exactGenericTitles.has(normalizedTitle) || normalizedTitle === normalizedType) {
    return { weight: 10, message: "Title is an exact generic placeholder.", confidence: "high", level: "strong" };
  }
  if (/^(?:post|variation|content|email|idea)\s+\d+$/i.test(normalizedTitle) || /^landing\s+page\s+\d+$/i.test(normalizedTitle)) {
    return { weight: 8, message: "Title is a numbered placeholder.", confidence: "high", level: "warning" };
  }
  return null;
}

function campaignV3StrategicKnownFallbackMatches(text = "") {
  const normalized = campaignV3StrategicNormalize(text);
  const phrases = [
    "a focused campaign experience",
    "focused campaign destination",
    "built around trust",
    "meaningful business relationships",
    "guide qualified visitors toward the next step",
    "reinforce the primary value proposition",
    "highlight the most relevant benefit",
    "close with a clear reply or booking action"
  ];
  return phrases.filter((phrase) => normalized.includes(phrase));
}

function campaignV3StrategicLooksLabelOnly(text = "") {
  const cleaned = cleanCampaignField(text);
  if (!cleaned) return false;
  const labelMatches = cleaned.match(/\b(?:Subject|CTA|Benefits|Problem|Solution|Trust|Header|Claim)\s*:/gi) || [];
  if (labelMatches.length < 2) return false;
  const meaningfulText = cleanCampaignField(cleaned.replace(/\b(?:Subject|CTA|Benefits|Problem|Solution|Trust|Header|Claim)\s*:/gi, " "));
  const meaningfulWords = campaignV3StrategicTokens(meaningfulText);
  return meaningfulWords.length <= 5 && meaningfulText.length < 48;
}

function campaignV3StrategicBodyTooShort(node = {}, setup = {}, context = {}) {
  const type = cleanCampaignField(node?.type);
  const body = campaignV3StrategicTextForNode(node);
  if (!body) return false;
  const platform = cleanCampaignField(node?.social?.platform || node?.channel || setup.channel || context.channel || "LinkedIn").toLowerCase();
  const thresholds = {
    Idea: 40,
    "Campaign Variation": 50,
    Content: 80,
    "Landing Page": 120,
    "Email Campaign": 100
  };
  let threshold = thresholds[type] || 50;
  if (type === "Social Media Posting") threshold = /\b(x|twitter)\b/.test(platform) ? 35 : 80;
  if (body.length >= threshold) return false;
  const wordCount = campaignV3StrategicTokens(body).length;
  if (type === "Social Media Posting" && /\b(x|twitter)\b/.test(platform)) return wordCount <= 5;
  if (type === "Social Media Posting") return wordCount <= 11;
  return true;
}

function createCampaignV3OptimizationIssue(node = {}, sourceNodes = [], overrides = {}) {
  return {
    code: overrides.code,
    severity: "optimization",
    level: overrides.level || "warning",
    confidence: overrides.confidence || "high",
    type: cleanCampaignField(node?.type),
    tempId: cleanCampaignField(node?.tempId || node?.id),
    nodeIndex: sourceNodes.indexOf(node),
    title: cleanCampaignField(node?.title),
    field: overrides.field || "",
    value: cleanCampaignField(overrides.value),
    message: overrides.message || "",
    dimension: overrides.dimension || "specificity",
    weight: overrides.weight || 0
  };
}

function campaignV3StrategicSocialPlatform(node = {}, setup = {}, context = {}) {
  const platform = cleanCampaignField(node?.social?.platform || node?.channel || setup.channel || context.channel || "LinkedIn").toLowerCase();
  if (/^(x|x\s*\/\s*twitter|twitter)$/.test(platform)) return "X";
  if (platform === "tiktok" || platform === "tik tok") return "TikTok";
  if (platform === "instagram") return "Instagram";
  return "LinkedIn";
}

function campaignV3StrategicParagraphCount(text = "") {
  return cleanCampaignField(text)
    .split(/\n{2,}|\r?\n/)
    .map((part) => cleanCampaignField(part))
    .filter(Boolean).length;
}

function campaignV3StrategicHasLinkedInTakeaway(text = "") {
  const normalized = campaignV3StrategicNormalize(text);
  return /\b(lesson|takeaway|framework|principle|what this means|here'?s why|the key is|try this|remember|in practice|practical|insight|learned)\b/i.test(normalized);
}

function campaignV3StrategicHasTikTokHook(text = "") {
  const firstLine = cleanCampaignField(text).split(/\n+/).map((line) => cleanCampaignField(line)).find(Boolean) || "";
  if (!firstLine) return false;
  if (firstLine.length <= 90 && /[?!]/.test(firstLine)) return true;
  return /\b(stop|watch|wait|pov|here'?s|this is why|nobody tells you|you need|mistake|before you|if you|when you|how to|why|quick)\b/i.test(firstLine.slice(0, 140));
}

function campaignV3StrategicHasInstagramVisualContext(text = "") {
  return /\b(see|look|watch|visual|image|photo|carousel|swipe|reel|video|clip|behind the scenes|before and after|save this|share this|comment|tap|show)\b/i.test(cleanCampaignField(text));
}

function addCampaignV3StrategicSocialDiagnostics(node = {}, sourceNodes = [], setup = {}, context = {}, optimizationIssues = []) {
  if (cleanCampaignField(node?.type) !== "Social Media Posting") return;
  const caption = campaignV3StrategicTextForNode(node);
  if (!caption) return;
  const platform = campaignV3StrategicSocialPlatform(node, setup, context);
  const wordCount = cleanCampaignField(caption).split(/\s+/).filter(Boolean).length;
  const paragraphCount = campaignV3StrategicParagraphCount(caption);
  const addSocialIssue = (overrides = {}) => optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
    field: "social.caption",
    value: caption,
    dimension: "audienceFit",
    level: "opportunity",
    confidence: "medium",
    ...overrides
  }));

  if (platform === "LinkedIn") {
    if (caption.length < 500 || wordCount < 90) {
      addSocialIssue({
        code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_LINKEDIN_TOO_SHORT",
        message: "LinkedIn caption is short for a professional insight-led post.",
        weight: 5
      });
    }
    if (paragraphCount < 2) {
      addSocialIssue({
        code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_LINKEDIN_NO_PARAGRAPHS",
        message: "LinkedIn caption does not use multiple short paragraphs.",
        weight: 4
      });
    }
    if (!campaignV3StrategicHasLinkedInTakeaway(caption)) {
      addSocialIssue({
        code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_LINKEDIN_NO_TAKEAWAY",
        message: "LinkedIn caption does not include an obvious lesson, insight, framework, or takeaway.",
        weight: 4
      });
    }
    if (caption.length <= 300 && paragraphCount < 2) {
      addSocialIssue({
        code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_LINKEDIN_SHORT_FORM_STYLE",
        message: "LinkedIn caption resembles short-form social copy more than a LinkedIn-native post.",
        weight: 5
      });
    }
    return;
  }

  if (platform === "X" && caption.length > 280) {
    addSocialIssue({
      code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_X_TOO_LONG",
      message: "X caption exceeds the 280-character platform constraint.",
      weight: 8,
      confidence: "high"
    });
    return;
  }

  if (platform === "TikTok" && !campaignV3StrategicHasTikTokHook(caption)) {
    addSocialIssue({
      code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_TIKTOK_NO_HOOK",
      message: "TikTok caption does not open with an obvious hook.",
      weight: 4
    });
    return;
  }

  if (platform === "Instagram" && !campaignV3StrategicHasInstagramVisualContext(caption)) {
    addSocialIssue({
      code: "CAMPAIGN_V3_STRATEGIC_SOCIAL_INSTAGRAM_NO_VISUAL_CONTEXT",
      message: "Instagram caption does not include obvious visual, save/share, or community context.",
      weight: 4
    });
  }
}

function evaluateCampaignV3StrategicDiagnostics(nodes = [], setup = {}, context = {}) {
  const sourceNodes = Array.isArray(nodes) ? nodes : [];
  const optimizationIssues = [];
  sourceNodes.forEach((node) => {
    const type = cleanCampaignField(node?.type);
    const title = cleanCampaignField(node?.title);
    const body = campaignV3StrategicTextForNode(node);
    const genericTitle = campaignV3StrategicLooksLikeGenericTitle(title, type);
    if (genericTitle) {
      optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
        code: "CAMPAIGN_V3_STRATEGIC_GENERIC_TITLE",
        field: "title",
        value: title,
        message: genericTitle.message,
        dimension: "specificity",
        weight: genericTitle.weight,
        confidence: genericTitle.confidence,
        level: genericTitle.level
      }));
    }
    const fallbackMatches = campaignV3StrategicKnownFallbackMatches(body);
    if (fallbackMatches.length) {
      optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
        code: "CAMPAIGN_V3_STRATEGIC_GENERIC_BODY_FALLBACK",
        field: "content",
        value: fallbackMatches.join(", "),
        message: "Body contains known generic fallback language.",
        dimension: "specificity",
        weight: 10,
        level: "strong"
      }));
    }
    if (campaignV3StrategicLooksLabelOnly(body)) {
      optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
        code: "CAMPAIGN_V3_STRATEGIC_GENERIC_BODY_LABEL_ONLY",
        field: "content",
        value: body,
        message: "Body is mostly section labels with very little substantive copy.",
        dimension: "specificity",
        weight: 8
      }));
    }
    if (campaignV3StrategicBodyTooShort(node, setup, context)) {
      optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
        code: "CAMPAIGN_V3_STRATEGIC_GENERIC_BODY_TOO_SHORT",
        field: type === "Social Media Posting" ? "social.caption" : "content",
        value: body,
        message: "Body is extremely short for this node type.",
        dimension: "specificity",
        weight: 5,
        confidence: "medium"
      }));
    }
    addCampaignV3StrategicSocialDiagnostics(node, sourceNodes, setup, context, optimizationIssues);
    if (type === "Landing Page") {
      const landingProblem = cleanCampaignField(node?.landingPage?.problem);
      if (landingProblem && (landingProblem.length < 24 || /\b(focus on|targeting|audience|campaign objective)\b/i.test(landingProblem))) {
        optimizationIssues.push(createCampaignV3OptimizationIssue(node, sourceNodes, {
          code: "CAMPAIGN_V3_STRATEGIC_LANDING_PROBLEM_GENERIC",
          field: "landingPage.problem",
          value: landingProblem,
          message: "Landing Page problem is too generic or describes targeting/audience instead of pain.",
          dimension: "specificity",
          weight: 5,
          confidence: "medium"
        }));
      }
    }
  });

  const variations = sourceNodes.filter((node) => cleanCampaignField(node?.type) === "Campaign Variation");
  variations.forEach((variation, index) => {
    const variationText = [variation.title, variation.description, variation.content].map((value) => cleanCampaignField(value)).filter(Boolean).join(" ");
    variations.slice(index + 1).forEach((otherVariation) => {
      const otherText = [otherVariation.title, otherVariation.description, otherVariation.content].map((value) => cleanCampaignField(value)).filter(Boolean).join(" ");
      const similarity = campaignV3StrategicJaccardSimilarity(variationText, otherText);
      if (similarity >= 0.92) {
        optimizationIssues.push(createCampaignV3OptimizationIssue(otherVariation, sourceNodes, {
          code: "CAMPAIGN_V3_STRATEGIC_VARIATION_TOO_SIMILAR",
          field: "title/description/content",
          value: `Similarity ${similarity.toFixed(2)} with "${cleanCampaignField(variation.title)}"`,
          message: "Campaign Variation is too similar to another variation.",
          dimension: "differentiation",
          weight: 10,
          level: "strong"
        }));
      }
    });
  });

  const specificityPenalty = optimizationIssues
    .filter((issue) => issue.dimension === "specificity")
    .reduce((total, issue) => total + issue.weight, 0);
  const differentiationPenalty = optimizationIssues
    .filter((issue) => issue.dimension === "differentiation")
    .reduce((total, issue) => total + issue.weight, 0);
  const audienceFitPenalty = optimizationIssues
    .filter((issue) => issue.dimension === "audienceFit")
    .reduce((total, issue) => total + issue.weight, 0);
  const totalOptimizationWeight = optimizationIssues.reduce((total, issue) => total + issue.weight, 0);
  const strategicScore = Math.max(0, 100 - Math.min(30, totalOptimizationWeight));
  return {
    strategicScore,
    optimizationIssues,
    optimizationCounts: {
      total: optimizationIssues.length,
      warnings: optimizationIssues.filter((issue) => issue.level === "warning" || issue.level === "strong").length,
      opportunities: optimizationIssues.length
    },
    strategicDimensions: {
      specificity: Math.max(0, 100 - Math.min(30, specificityPenalty)),
      offerClarity: null,
      outcomeClarity: null,
      differentiation: Math.max(0, 100 - Math.min(30, differentiationPenalty)),
      audienceFit: Math.max(0, 100 - Math.min(30, audienceFitPenalty)),
      brandBrainAlignment: null
    },
    repairRecommendation: {
      shouldRepair: false,
      reason: null,
      targetCount: 0,
      maxTargets: 0,
      targets: []
    }
  };
}

function evaluateCampaignV3Quality(normalizedNodes = [], setup = {}, context = {}) {
  const issues = [];
  const sourceNodes = Array.isArray(normalizedNodes) ? normalizedNodes : [];
  const normalizedSetup = setup || {};
  const addIssue = (node = {}, field = "", code = "", severity = "error", message = "", valueOverride) => {
    issues.push({
      code,
      severity,
      type: cleanCampaignField(node?.type),
      tempId: cleanCampaignField(node?.tempId || node?.id),
      nodeIndex: sourceNodes.indexOf(node),
      title: cleanCampaignField(node?.title),
      field,
      value: cleanCampaignField(valueOverride === undefined ? node?.[field] : valueOverride),
      message
    });
  };
  const requireText = (node, field, value, code, message) => {
    if (!cleanCampaignField(value)) addIssue(node, field, code, "error", message, value);
  };
  const grouped = sourceNodes.reduce((groups, node) => {
    const type = cleanCampaignField(node?.type);
    if (!groups[type]) groups[type] = [];
    groups[type].push(node);
    return groups;
  }, {});
  const duplicateValueMap = (nodes, selector) => nodes.reduce((map, node) => {
    const value = campaignV3QualityNormalized(selector(node));
    if (!value) return map;
    map[value] = (map[value] || 0) + 1;
    return map;
  }, {});
  const fallbackContext = {
    nodeCount: sourceNodes.length,
    countsByType: campaignV3NodeCounts(sourceNodes),
    ...context
  };

  sourceNodes.forEach((node) => {
    const type = cleanCampaignField(node?.type);
    const title = cleanCampaignField(node?.title);
    const description = cleanCampaignField(node?.description);
    const content = cleanCampaignField(node?.content);
    const body = [description, content].filter(Boolean).join("\n\n");

    if (type === "Idea") {
      requireText(node, "title", title, "CAMPAIGN_V3_QUALITY_IDEA_MISSING_TITLE", "Idea is missing a title.");
      if (!body) addIssue(node, "description", "CAMPAIGN_V3_QUALITY_IDEA_MISSING_BODY", "error", "Idea is missing description/content.", body);
      return;
    }

    if (type === "Campaign Variation") {
      requireText(node, "title", title, "CAMPAIGN_V3_QUALITY_VARIATION_MISSING_TITLE", "Campaign Variation is missing a title.");
      if (!body) addIssue(node, "description", "CAMPAIGN_V3_QUALITY_VARIATION_MISSING_BODY", "error", "Campaign Variation is missing description/content.", body);
      return;
    }

    if (type === "Content") {
      requireText(node, "title", title, "CAMPAIGN_V3_QUALITY_CONTENT_MISSING_TITLE", "Content is missing a title.");
      if (!body) addIssue(node, "content", "CAMPAIGN_V3_QUALITY_CONTENT_MISSING_BODY", "error", "Content is missing description/content.", body);
      if (campaignV3QualityLooksLikeSocialPost(body)) {
        addIssue(node, "content", "CAMPAIGN_V3_QUALITY_CONTENT_LOOKS_LIKE_SOCIAL_POST", "warning", "Content looks like a social post rather than a strategic content asset.", body);
      }
      return;
    }

    if (type === "Social Media Posting") {
      const caption = cleanCampaignField(node?.social?.caption || content || description);
      if (!caption) addIssue(node, "social.caption", "CAMPAIGN_V3_QUALITY_SOCIAL_MISSING_CAPTION", "error", "Social Media Posting is missing caption/body.", caption);
      if (caption && !campaignV3QualityHasMeaningfulTextBeforeHashtag(caption)) {
        addIssue(node, "social.caption", "CAMPAIGN_V3_QUALITY_SOCIAL_HASHTAGS_BEFORE_TEXT", "warning", "Social caption starts with hashtags before meaningful text.", caption);
      }
      return;
    }

    if (type === "Email Campaign") {
      requireText(node, "title", title, "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_TITLE", "Email Campaign is missing a title.");
      if (!body) addIssue(node, "content", "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_BODY", "error", "Email Campaign is missing description/content.", body);
      if (body && !campaignV3QualityHasSubjectLine(body)) {
        addIssue(node, "content", "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_SUBJECT", "warning", "Email Campaign does not include a detectable subject line.", body);
      }
      if (body && !campaignV3QualityHasCta(body)) {
        addIssue(node, "content", "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_CTA", "warning", "Email Campaign does not include a detectable CTA.", body);
      }
      if (/follow-up email for the campaign offer/i.test(title) || /nurture email campaign for campaign audience/i.test(description)) {
        addIssue(node, "title", "CAMPAIGN_V3_QUALITY_EMAIL_GENERIC_FALLBACK", "warning", "Email Campaign appears to use generic fallback language.", title || description);
      }
      return;
    }

    if (type !== "Landing Page") return;

    const landing = node?.landingPage || {};
    const landingFields = {
      headerClaim: cleanCampaignField(landing.headerClaim),
      problem: cleanCampaignField(landing.problem),
      solution: cleanCampaignField(landing.solution),
      trust: cleanCampaignField(landing.trust),
      cta: cleanCampaignField(landing.cta)
    };
    const normalizedDescription = campaignV3QualityNormalized(description);
    const normalizedContent = campaignV3QualityNormalized(content);

    requireText(node, "title", title, "CAMPAIGN_V3_QUALITY_LANDING_MISSING_TITLE", "Landing Page is missing a title.");
    if (/^(campaign landing page|combined campaign landing page)$/i.test(title) || /^landing page for\b/i.test(title)) {
      addIssue(node, "title", "CAMPAIGN_V3_QUALITY_LANDING_GENERIC_TITLE", "error", "Landing Page title is generic/internal instead of customer-facing.", title);
    }
    const landingBodySources = [description, content, landingFields.headerClaim, landingFields.problem, landingFields.solution, landingFields.trust, landingFields.cta];
    const hasLandingBodySource = landingBodySources.some((value) => cleanCampaignField(value));
    if (!hasLandingBodySource) {
      addIssue(node, "description", "CAMPAIGN_V3_QUALITY_LANDING_MISSING_BODY", "error", "Landing Page is missing description/content and structured landingPage fields.", body);
    }
    if (/^landing page for\b/i.test(description)) {
      addIssue(node, "description", "CAMPAIGN_V3_QUALITY_LANDING_GENERIC_DESCRIPTION", "error", "Landing Page description starts with generic fallback copy.", description);
    }
    if (/position\b[\s\S]{0,120}\bas a focused campaign destination/i.test(content)) {
      addIssue(node, "content", "CAMPAIGN_V3_QUALITY_LANDING_FOCUSED_CAMPAIGN_DESTINATION", "error", "Landing Page content contains generic focused-campaign destination copy.", content);
    }
    if (/\b(campaign summary|campaign asset|campaign objective|campaign angle|variation)\b/i.test([normalizedDescription, normalizedContent].join(" "))) {
      addIssue(node, "content", "CAMPAIGN_V3_QUALITY_LANDING_INTERNAL_SUMMARY", "warning", "Landing Page description/content appears to describe internal campaign structure.", body);
    }

    requireText(node, "landingPage.headerClaim", landingFields.headerClaim, "CAMPAIGN_V3_QUALITY_LANDING_HEADER_MISSING", "Landing Page headerClaim is missing.");
    if (/^(promote|increase|generate|drive|launch)\b/i.test(landingFields.headerClaim)) {
      addIssue(node, "landingPage.headerClaim", "CAMPAIGN_V3_QUALITY_LANDING_HEADER_INTERNAL_VERB", "error", "Landing Page headerClaim starts with an internal campaign verb.", landingFields.headerClaim);
    }
    if (/\bcampaign\b/i.test(landingFields.headerClaim)) {
      addIssue(node, "landingPage.headerClaim", "CAMPAIGN_V3_QUALITY_LANDING_HEADER_MENTIONS_CAMPAIGN", "error", "Landing Page headerClaim mentions campaign instead of the customer-facing offer.", landingFields.headerClaim);
    }

    requireText(node, "landingPage.problem", landingFields.problem, "CAMPAIGN_V3_QUALITY_LANDING_PROBLEM_MISSING", "Landing Page problem is missing.");
    if (landingFields.problem && (landingFields.problem.length < 24 || /\b(focus on|targeting|audience|campaign objective)\b/i.test(landingFields.problem))) {
      addIssue(node, "landingPage.problem", "CAMPAIGN_V3_QUALITY_LANDING_PROBLEM_GENERIC", "warning", "Landing Page problem is too generic or describes targeting/audience instead of pain.", landingFields.problem);
    }

    requireText(node, "landingPage.solution", landingFields.solution, "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_MISSING", "Landing Page solution is missing.");
    if (/a focused campaign experience/i.test(landingFields.solution)) {
      addIssue(node, "landingPage.solution", "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_FOCUSED_CAMPAIGN", "error", "Landing Page solution uses generic focused-campaign language.", landingFields.solution);
    }
    if (landingFields.solution && /\bcampaign\b/i.test(landingFields.solution)) {
      addIssue(node, "landingPage.solution", "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_DESCRIBES_CAMPAIGN", "warning", "Landing Page solution appears to describe the campaign instead of the product/offer/service.", landingFields.solution);
    }
    const offerHint = cleanCampaignField(normalizedSetup.offer || normalizedSetup.valueProposition || normalizedSetup.campaignIdea);
    const offerWords = offerHint.toLowerCase().split(/\W+/).filter((word) => word.length >= 5);
    if (landingFields.solution && offerWords.length > 0 && !offerWords.some((word) => landingFields.solution.toLowerCase().includes(word))) {
      addIssue(node, "landingPage.solution", "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_OFFER_MISMATCH", "warning", "Landing Page solution may not mention or imply the available product/offer context.", landingFields.solution);
    }

    requireText(node, "landingPage.trust", landingFields.trust, "CAMPAIGN_V3_QUALITY_LANDING_TRUST_MISSING", "Landing Page trust is missing.");
    if (/built around trust,?\s+exclusivity/i.test(landingFields.trust) || /meaningful business relationships/i.test(landingFields.trust)) {
      addIssue(node, "landingPage.trust", "CAMPAIGN_V3_QUALITY_LANDING_TRUST_GENERIC", "error", "Landing Page trust uses generic trust language.", landingFields.trust);
    }
    if (landingFields.trust && landingFields.trust.length < 24) {
      addIssue(node, "landingPage.trust", "CAMPAIGN_V3_QUALITY_LANDING_TRUST_TOO_SHORT", "warning", "Landing Page trust is too short to establish credibility.", landingFields.trust);
    }

    requireText(node, "landingPage.cta", landingFields.cta, "CAMPAIGN_V3_QUALITY_LANDING_CTA_MISSING", "Landing Page CTA is missing.");
    if (/^request an invitation$/i.test(landingFields.cta) && !campaignV3QualityHasInviteContext(normalizedSetup)) {
      addIssue(node, "landingPage.cta", "CAMPAIGN_V3_QUALITY_LANDING_CTA_GENERIC_INVITATION", "error", "Landing Page CTA requests an invitation without invitation/access context.", landingFields.cta);
    }
    if (/^learn more$/i.test(landingFields.cta)) {
      addIssue(node, "landingPage.cta", "CAMPAIGN_V3_QUALITY_LANDING_CTA_LEARN_MORE", "warning", "Landing Page CTA is generic learn-more copy.", landingFields.cta);
    }
  });

  const duplicateVariationTitles = duplicateValueMap(grouped["Campaign Variation"] || [], (node) => node?.title);
  (grouped["Campaign Variation"] || []).forEach((node) => {
    if (duplicateVariationTitles[campaignV3QualityNormalized(node?.title)] > 1) {
      addIssue(node, "title", "CAMPAIGN_V3_QUALITY_VARIATION_DUPLICATE_TITLE", "warning", "Campaign Variation title is duplicated.", node?.title);
    }
  });

  const duplicateSocialCaptions = duplicateValueMap(grouped["Social Media Posting"] || [], (node) => node?.social?.caption || node?.content || node?.description);
  (grouped["Social Media Posting"] || []).forEach((node) => {
    const caption = node?.social?.caption || node?.content || node?.description;
    if (duplicateSocialCaptions[campaignV3QualityNormalized(caption)] > 1) {
      addIssue(node, "social.caption", "CAMPAIGN_V3_QUALITY_SOCIAL_DUPLICATE_CAPTION", "warning", "Social Media Posting caption/body is duplicated.", caption);
    }
  });

  const counts = issues.reduce((summary, issue) => {
    if (issue.severity === "error") summary.errors += 1;
    if (issue.severity === "warning") summary.warnings += 1;
    return summary;
  }, { errors: 0, warnings: 0 });
  const totalChecks = Math.max(sourceNodes.length * 3, issues.length, 1);
  const score = Math.max(0, Math.round(((totalChecks - counts.errors * 2 - counts.warnings) / totalChecks) * 100));
  const ok = counts.errors === 0;
  const strategicDiagnostics = evaluateCampaignV3StrategicDiagnostics(sourceNodes, normalizedSetup, fallbackContext);

  return {
    ok,
    score,
    issues,
    counts,
    structuralOk: ok,
    structuralScore: score,
    strategicScore: strategicDiagnostics.strategicScore,
    overallScore: Math.round((score * 0.7) + (strategicDiagnostics.strategicScore * 0.3)),
    validationIssues: issues,
    optimizationIssues: strategicDiagnostics.optimizationIssues,
    validationCounts: counts,
    optimizationCounts: strategicDiagnostics.optimizationCounts,
    strategicDimensions: strategicDiagnostics.strategicDimensions,
    repairRecommendation: strategicDiagnostics.repairRecommendation,
    context: fallbackContext
  };
}

const CAMPAIGN_V3_REPAIRABLE_ISSUE_CODES = new Set([
  "CAMPAIGN_V3_QUALITY_IDEA_MISSING_TITLE",
  "CAMPAIGN_V3_QUALITY_IDEA_MISSING_BODY",
  "CAMPAIGN_V3_QUALITY_VARIATION_MISSING_TITLE",
  "CAMPAIGN_V3_QUALITY_VARIATION_MISSING_BODY",
  "CAMPAIGN_V3_QUALITY_VARIATION_DUPLICATE_TITLE",
  "CAMPAIGN_V3_QUALITY_CONTENT_MISSING_TITLE",
  "CAMPAIGN_V3_QUALITY_CONTENT_MISSING_BODY",
  "CAMPAIGN_V3_QUALITY_CONTENT_LOOKS_LIKE_SOCIAL_POST",
  "CAMPAIGN_V3_QUALITY_SOCIAL_MISSING_CAPTION",
  "CAMPAIGN_V3_QUALITY_SOCIAL_HASHTAGS_BEFORE_TEXT",
  "CAMPAIGN_V3_QUALITY_SOCIAL_DUPLICATE_CAPTION",
  "CAMPAIGN_V3_QUALITY_LANDING_MISSING_TITLE",
  "CAMPAIGN_V3_QUALITY_LANDING_GENERIC_TITLE",
  "CAMPAIGN_V3_QUALITY_LANDING_MISSING_BODY",
  "CAMPAIGN_V3_QUALITY_LANDING_GENERIC_DESCRIPTION",
  "CAMPAIGN_V3_QUALITY_LANDING_FOCUSED_CAMPAIGN_DESTINATION",
  "CAMPAIGN_V3_QUALITY_LANDING_INTERNAL_SUMMARY",
  "CAMPAIGN_V3_QUALITY_LANDING_HEADER_MISSING",
  "CAMPAIGN_V3_QUALITY_LANDING_HEADER_INTERNAL_VERB",
  "CAMPAIGN_V3_QUALITY_LANDING_HEADER_MENTIONS_CAMPAIGN",
  "CAMPAIGN_V3_QUALITY_LANDING_PROBLEM_MISSING",
  "CAMPAIGN_V3_QUALITY_LANDING_PROBLEM_GENERIC",
  "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_MISSING",
  "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_FOCUSED_CAMPAIGN",
  "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_DESCRIBES_CAMPAIGN",
  "CAMPAIGN_V3_QUALITY_LANDING_SOLUTION_OFFER_MISMATCH",
  "CAMPAIGN_V3_QUALITY_LANDING_TRUST_MISSING",
  "CAMPAIGN_V3_QUALITY_LANDING_TRUST_GENERIC",
  "CAMPAIGN_V3_QUALITY_LANDING_TRUST_TOO_SHORT",
  "CAMPAIGN_V3_QUALITY_LANDING_CTA_MISSING",
  "CAMPAIGN_V3_QUALITY_LANDING_CTA_GENERIC_INVITATION",
  "CAMPAIGN_V3_QUALITY_LANDING_CTA_LEARN_MORE",
  "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_TITLE",
  "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_BODY",
  "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_SUBJECT",
  "CAMPAIGN_V3_QUALITY_EMAIL_MISSING_CTA",
  "CAMPAIGN_V3_QUALITY_EMAIL_GENERIC_FALLBACK"
]);

function logCampaignV3RepairLoop(label, details = {}) {
  console.info(`[Campaign V3 Repair Loop] ${label}`, details);
}

function isCampaignV3IssueRepairable(issue = {}) {
  return CAMPAIGN_V3_REPAIRABLE_ISSUE_CODES.has(cleanCampaignField(issue.code));
}

function campaignV3RepairNodeKeyFromIssue(issue = {}) {
  if (Number.isInteger(issue.nodeIndex) && issue.nodeIndex >= 0) return `index:${issue.nodeIndex}`;
  const tempId = cleanCampaignField(issue.tempId);
  if (tempId) return `tempId:${tempId}`;
  return `type-title:${cleanCampaignField(issue.type)}:${cleanCampaignField(issue.title)}`;
}

function groupCampaignV3IssuesByNode(qualityResult = {}) {
  const grouped = new Map();
  (Array.isArray(qualityResult?.issues) ? qualityResult.issues : [])
    .filter(isCampaignV3IssueRepairable)
    .forEach((issue) => {
      const key = campaignV3RepairNodeKeyFromIssue(issue);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(issue);
    });
  return grouped;
}

function getCampaignV3RepairTargets(qualityResult = {}, normalizedCampaign = []) {
  const nodes = Array.isArray(normalizedCampaign) ? normalizedCampaign : [];
  return Array.from(groupCampaignV3IssuesByNode(qualityResult).entries())
    .map(([key, issues]) => {
      const firstIssue = issues[0] || {};
      const nodeIndex = Number.isInteger(firstIssue.nodeIndex) && firstIssue.nodeIndex >= 0
        ? firstIssue.nodeIndex
        : nodes.findIndex((node) => {
          const tempId = cleanCampaignField(node?.tempId || node?.id);
          if (firstIssue.tempId && tempId === cleanCampaignField(firstIssue.tempId)) return true;
          return cleanCampaignField(node?.type) === cleanCampaignField(firstIssue.type)
            && cleanCampaignField(node?.title) === cleanCampaignField(firstIssue.title);
        });
      return {
        key,
        nodeIndex,
        node: nodeIndex >= 0 ? nodes[nodeIndex] : null,
        nodeType: cleanCampaignField(firstIssue.type),
        issues
      };
    })
    .filter((target) => target.node && target.nodeIndex >= 0);
}

function campaignV3RepairNodeSummary(node = {}) {
  return {
    id: cleanCampaignField(node.id),
    tempId: cleanCampaignField(node.tempId),
    type: cleanCampaignField(node.type),
    title: cleanCampaignField(node.title),
    description: cleanCampaignField(node.description),
    content: cleanCampaignField(node.content),
    metadata: node.metadata || {},
    social: node.social || {},
    landingPage: node.landingPage || {}
  };
}

function buildCampaignV3RepairContext(normalizedCampaign = [], setup = {}) {
  const nodes = Array.isArray(normalizedCampaign) ? normalizedCampaign : [];
  return {
    setup,
    countsByType: campaignV3NodeCounts(nodes),
    idea: nodes.find((node) => cleanCampaignField(node?.type) === "Idea") ? campaignV3RepairNodeSummary(nodes.find((node) => cleanCampaignField(node?.type) === "Idea")) : null,
    variations: nodes.filter((node) => cleanCampaignField(node?.type) === "Campaign Variation").map(campaignV3RepairNodeSummary),
    content: nodes.filter((node) => cleanCampaignField(node?.type) === "Content").map(campaignV3RepairNodeSummary),
    socialPosts: nodes.filter((node) => cleanCampaignField(node?.type) === "Social Media Posting").map(campaignV3RepairNodeSummary),
    landingPage: nodes.find((node) => cleanCampaignField(node?.type) === "Landing Page") ? campaignV3RepairNodeSummary(nodes.find((node) => cleanCampaignField(node?.type) === "Landing Page")) : null,
    emailCampaign: nodes.find((node) => cleanCampaignField(node?.type) === "Email Campaign") ? campaignV3RepairNodeSummary(nodes.find((node) => cleanCampaignField(node?.type) === "Email Campaign")) : null
  };
}

function buildCampaignV3NodeRepairPrompt({ node, nodeType, issues, campaignContext }) {
  const issueCodes = (Array.isArray(issues) ? issues : []).map((issue) => issue.code).filter(Boolean);
  const platform = cleanCampaignField(node?.social?.platform || node?.channel || campaignContext?.setup?.channel || "LinkedIn");
  const landingGuidance = nodeType === "Landing Page"
    ? "For Landing Page repairs, include labeled sections in content: Hero Headline, Problem Section, Offer, Trust Elements, Primary CTA. Avoid internal words like campaign, landing page, and AI-generated."
    : "";
  const socialGuidance = nodeType === "Social Media Posting"
    ? `For Social Media Posting repairs, write a platform-aware ${platform} caption. Put meaningful text before hashtags.`
    : "";
  const emailGuidance = nodeType === "Email Campaign"
    ? "For Email Campaign repairs, content must include Subject, Preview text, Email body, and CTA."
    : "";
  return [
    "Repair exactly one Campaign V3 node. Do not regenerate the full campaign.",
    `Node type: ${nodeType}`,
    `Quality issue codes: ${issueCodes.join(", ")}`,
    `Current problematic node: ${JSON.stringify(campaignV3RepairNodeSummary(node))}`,
    `Campaign context: ${JSON.stringify(campaignContext)}`,
    "Preserve the same node type and intent. Preserve identity fields conceptually; only improve title/content/caption copy.",
    "Return strong, specific, customer-facing content. Avoid generic filler and duplicate wording.",
    landingGuidance,
    socialGuidance,
    emailGuidance,
    "Return JSON accepted by the refine endpoint: title, content, caption. No markdown. No explanations."
  ].filter(Boolean).join("\n");
}

async function repairCampaignV3Node({ node, nodeType, issues, campaignContext }) {
  const instruction = buildCampaignV3NodeRepairPrompt({ node, nodeType, issues, campaignContext });
  const response = await fetch("/api/refine-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nodeType,
      currentContent: campaignV3RepairNodeSummary(node),
      instruction,
      boardId: getCurrentBrandBrainBoardId(),
      brandBrainData: state.brandCore,
      campaignContext: JSON.stringify(campaignContext)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Campaign V3 repair request failed");
  return data;
}

function normalizeCampaignV3RepairedNodeFields(originalNode = {}, repaired = {}) {
  const repairedTitle = cleanCampaignField(repaired.title);
  const repairedContent = cleanCampaignField(repaired.content || repaired.body || repaired.description);
  const repairedCaption = cleanCampaignField(repaired.caption);
  const nextNode = {
    ...originalNode,
    metadata: { ...(originalNode.metadata || {}) },
    social: { ...(originalNode.social || {}) },
    landingPage: { ...(originalNode.landingPage || {}) }
  };
  if (repairedTitle) nextNode.title = repairedTitle;
  if (repairedContent) {
    nextNode.content = repairedContent;
    nextNode.description = repairedContent.split("\n").find(Boolean) || repairedContent;
  }
  if (cleanCampaignField(nextNode.type) === "Social Media Posting") {
    const caption = repairedCaption || repairedContent || repairedTitle;
    if (caption) {
      nextNode.social.caption = caption;
      nextNode.content = caption;
    }
  }
  if (cleanCampaignField(nextNode.type) === "Email Campaign" && repairedCaption && !cleanCampaignField(nextNode.content).includes(repairedCaption)) {
    nextNode.content = [nextNode.content, `CTA: ${repairedCaption}`].filter(Boolean).join("\n\n");
  }
  if (cleanCampaignField(nextNode.type) === "Landing Page") {
    const sections = parseStructuredLandingPagePreview(repairedContent) || {};
    const headerClaim = firstCleanLandingSectionValue(sections.heroHeadline, repairedTitle);
    const problem = combineLandingSectionValues(sections.subheadline, sections.problemSection);
    const solution = combineLandingSectionValues(sections.offer, sections.benefits);
    const trust = combineLandingSectionValues(sections.trustElements, sections.faq);
    const cta = firstCleanLandingSectionValue(sections.primaryCta, sections.finalCta, sections.cta, repairedCaption);
    if (headerClaim) nextNode.landingPage.headerClaim = headerClaim;
    if (problem) nextNode.landingPage.problem = problem;
    if (solution) nextNode.landingPage.solution = solution;
    if (trust) nextNode.landingPage.trust = trust;
    if (cta) nextNode.landingPage.cta = cta;
    if (!nextNode.content) nextNode.content = repairedContent || nextNode.landingPage.headerClaim || "";
    return canonicalizeCampaignV3LandingPageFields(nextNode);
  }
  return nextNode;
}

function mergeRepairedCampaignV3Node(normalizedCampaign = [], nodeIndex = -1, repairedNode = null) {
  if (!Array.isArray(normalizedCampaign) || nodeIndex < 0 || nodeIndex >= normalizedCampaign.length || !repairedNode) return normalizedCampaign;
  return normalizedCampaign.map((node, index) => (index === nodeIndex ? repairedNode : node));
}

async function runCampaignV3QualityRepairLoop(normalizedCampaign = [], qualityResult = {}, campaignContext = {}) {
  let nodes = Array.isArray(normalizedCampaign) ? normalizedCampaign : [];
  const firstQualityResult = qualityResult;
  const targets = firstQualityResult?.ok === false ? getCampaignV3RepairTargets(firstQualityResult, nodes) : [];
  const diagnostics = {
    attempted: targets.length > 0,
    maxAttempts: 1,
    repairableIssueCount: targets.reduce((total, target) => total + target.issues.length, 0),
    targetCount: targets.length,
    targets: targets.map((target) => ({
      nodeIndex: target.nodeIndex,
      nodeType: target.nodeType,
      tempId: cleanCampaignField(target.node?.tempId || target.node?.id),
      title: cleanCampaignField(target.node?.title),
      issueCodes: target.issues.map((issue) => issue.code)
    })),
    repaired: [],
    failed: [],
    remainingIssues: []
  };

  logCampaignV3RepairLoop("First quality result:", firstQualityResult);
  logCampaignV3RepairLoop("Repair targets:", diagnostics.targets);

  for (const target of targets) {
    logCampaignV3RepairLoop("Repairing node:", diagnostics.targets.find((item) => item.nodeIndex === target.nodeIndex));
    try {
      const repaired = await repairCampaignV3Node({
        node: target.node,
        nodeType: target.nodeType,
        issues: target.issues,
        campaignContext
      });
      const repairedNode = normalizeCampaignV3RepairedNodeFields(target.node, repaired);
      nodes = mergeRepairedCampaignV3Node(nodes, target.nodeIndex, repairedNode);
      diagnostics.repaired.push({
        nodeIndex: target.nodeIndex,
        nodeType: target.nodeType,
        title: cleanCampaignField(repairedNode.title),
        issueCodes: target.issues.map((issue) => issue.code)
      });
      logCampaignV3RepairLoop("Repaired node merged:", diagnostics.repaired[diagnostics.repaired.length - 1]);
    } catch (error) {
      diagnostics.failed.push({
        nodeIndex: target.nodeIndex,
        nodeType: target.nodeType,
        title: cleanCampaignField(target.node?.title),
        issueCodes: target.issues.map((issue) => issue.code),
        error: error?.message || String(error || "")
      });
      console.warn("[Campaign V3 Repair Loop] Repair failed; continuing with original node.", diagnostics.failed[diagnostics.failed.length - 1]);
    }
  }

  const secondQualityResult = targets.length
    ? evaluateCampaignV3Quality(nodes, campaignContext.setup || {}, {
      stage: "afterRepairBeforePlan",
      expectedCounts: expectedCampaignV3NodeCounts(campaignContext.setup || {})
    })
    : firstQualityResult;
  diagnostics.secondQualityResult = secondQualityResult;
  diagnostics.remainingIssues = Array.isArray(secondQualityResult?.issues) ? secondQualityResult.issues : [];
  logCampaignV3RepairLoop("Second quality result:", secondQualityResult);
  logCampaignV3RepairLoop("Remaining issues:", diagnostics.remainingIssues);
  return { nodes, qualityResult: secondQualityResult, diagnostics };
}

function logCampaignV3AIDiagnostics(label, details = {}) {
  console.info(`[Funklix Campaign Generator V3 AI] ${label}`, details);
}

function campaignV3AdapterAuditDetails(payload = {}, node = null) {
  return {
    tempId: cleanCampaignField(payload.tempId || node?.tempId),
    type: cleanCampaignField(payload.type || node?.type),
    title: cleanCampaignField(payload.title || node?.title),
    nodeId: cleanCampaignField(node?.id)
  };
}

function logCampaignV3AdapterAudit(status, details = {}) {
  console.info("[V3 Adapter Audit]", status, details);
}

function logCampaignV3AdapterAuditFailure(step, details = {}, error = null) {
  console.error("[V3 Adapter Audit]", `FAILED ${step}`, {
    ...details,
    errorMessage: error?.message || String(error || ""),
    errorStack: error?.stack || ""
  });
}

function createCampaignV3RealCanvasAdapter() {
  const committedNodes = [];
  const committedEdges = [];
  const activityLog = [];
  return {
    committedNodes,
    committedEdges,
    activityLog,
    unsavedCallCount: 0,
    createNode(payload = {}, position = {}) {
      const startDetails = campaignV3AdapterAuditDetails(payload);
      logCampaignV3AdapterAudit("START createNode", startDetails);

      let node = null;
      logCampaignV3AdapterAudit("BEFORE createNode", startDetails);
      try {
        node = createNode({ type: payload.type || "Idea", position });
        if (!node) throw new Error("Campaign V3 real adapter could not create node.");
        logCampaignV3AdapterAudit("PASSED createNode", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("createNode", startDetails, error);
        throw error;
      }

      logCampaignV3AdapterAudit("BEFORE applyGeneratedCampaignNodePayload", campaignV3AdapterAuditDetails(payload, node));
      try {
        applyGeneratedCampaignNodePayload(node, payload);
        logCampaignV3AdapterAudit("PASSED applyGeneratedCampaignNodePayload", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("applyGeneratedCampaignNodePayload", campaignV3AdapterAuditDetails(payload, node), error);
        throw error;
      }

      logCampaignV3AdapterAudit("BEFORE updateNodeCard", campaignV3AdapterAuditDetails(payload, node));
      try {
        updateNodeCard(node);
        logCampaignV3AdapterAudit("PASSED updateNodeCard", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("updateNodeCard", campaignV3AdapterAuditDetails(payload, node), error);
        throw error;
      }

      logCampaignV3AdapterAudit("BEFORE updateListView", campaignV3AdapterAuditDetails(payload, node));
      try {
        updateListView();
        logCampaignV3AdapterAudit("PASSED updateListView", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("updateListView", campaignV3AdapterAuditDetails(payload, node), error);
        throw error;
      }

      logCampaignV3AdapterAudit("BEFORE committedNodes.push", campaignV3AdapterAuditDetails(payload, node));
      try {
        committedNodes.push({ id: node.id, tempId: payload.tempId, type: node.type, title: node.title, x: node.position.x, y: node.position.y, node });
        logCampaignV3AdapterAudit("PASSED committedNodes.push", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("committedNodes.push", campaignV3AdapterAuditDetails(payload, node), error);
        throw error;
      }

      logCampaignV3AdapterAudit("BEFORE activityLog.push", campaignV3AdapterAuditDetails(payload, node));
      try {
        activityLog.push({ action: "createNode", tempId: payload.tempId, nodeId: node.id });
        logCampaignV3AdapterAudit("PASSED activityLog.push", campaignV3AdapterAuditDetails(payload, node));
      } catch (error) {
        logCampaignV3AdapterAuditFailure("activityLog.push", campaignV3AdapterAuditDetails(payload, node), error);
        throw error;
      }

      logCampaignV3AdapterAudit("FINISHED createNode", campaignV3AdapterAuditDetails(payload, node));
      return node;
    },
    createEdge(sourceNodeId, targetNodeId, edge = {}) {
      addEdge(sourceNodeId, targetNodeId);
      const committedEdge = { sourceNodeId, targetNodeId, sourceTempId: edge.fromTempId, targetTempId: edge.toTempId, type: edge.type, laneId: edge.laneId };
      committedEdges.push(committedEdge);
      activityLog.push({ action: "createEdge", sourceNodeId, targetNodeId, sourceTempId: edge.fromTempId, targetTempId: edge.toTempId });
      return committedEdge;
    },
    markUnsaved() {
      this.unsavedCallCount += 1;
      activityLog.push({ action: "markUnsaved" });
      markUnsaved();
    }
  };
}

function debugRunCampaignV3Mock() {
  const campaignV3 = getCampaignV3Api();
  if (!campaignV3) {
    console.error("[Funklix Campaign Generator V3] campaign-v3.js is not loaded.");
    return null;
  }
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    console.warn("[Funklix Campaign Generator V3] Board is read-only; mock commit skipped.");
    return null;
  }

  const setup = { variationCount: 3, postsPerVariation: 3, includeLandingPage: true, includeEmailCampaign: true, channel: "LinkedIn" };
  const rawNodes = campaignV3.createCampaignV3MockNodes(setup, "grouped");
  const planResult = campaignV3.buildCampaignV3PlanFromNodes(rawNodes, setup);
  if (!planResult.ok) {
    console.error("[Funklix Campaign Generator V3] Mock plan failed validation", planResult.diagnostics);
    return planResult;
  }

  const origin = calculateCampaignPlanOrigin(setup);
  const layoutResult = campaignV3.layoutCampaignV3Plan(planResult.plan, setup, origin);
  if (!layoutResult.ok) {
    console.error("[Funklix Campaign Generator V3] Mock layout failed", layoutResult.diagnostics);
    return { ...planResult, layoutResult };
  }

  const adapter = createCampaignV3RealCanvasAdapter();
  const commitResult = campaignV3.commitCampaignV3PlanToCanvas(layoutResult, adapter);
  if (!commitResult.ok) {
    console.error("[Funklix Campaign Generator V3] Mock real-canvas commit had diagnostics", commitResult.diagnostics);
  } else {
    console.info("[Funklix Campaign Generator V3] Mock campaign committed", commitResult);
  }
  updateEmptyState();
  drawLinks();
  updateListView();
  return { planResult, layoutResult, commitResult, adapter };
}

async function runCampaignV3AICompatibility(setupOverride = {}, options = {}) {
  const campaignV3 = getCampaignV3Api();
  if (!campaignV3) {
    console.error("[Funklix Campaign Generator V3 AI] campaign-v3.js is not loaded.");
    return null;
  }
  if (state.boardAccess?.canEdit === false) {
    setSaveStatus("Read-only board");
    console.warn("[Funklix Campaign Generator V3 AI] Board is read-only; AI compatibility commit skipped.");
    return null;
  }

  const setup = defaultCampaignV3AISetup(setupOverride);
  const reportStatus = typeof options.onStatus === "function" ? options.onStatus : () => {};
  reportStatus("Analyzing Strategy...");
  logCampaignV3AIDiagnostics("Starting AI compatibility flow with Email, primary/social over-count, and Landing Page fallback normalization.", {
    setup,
    featureFlagEnabled: isCampaignV3Enabled()
  });

  try {
    reportStatus("Generating Campaign...");
    const apiPlan = await fetchGeneratedCampaignPlan(setup.campaignIdea, setup.additionalContext, setup);
    const rawNodes = Array.isArray(apiPlan?.nodes) ? apiPlan.nodes : [];
    const emailNormalization = normalizeCampaignV3AIEmailNodes(rawNodes, setup);
    const landingNormalization = normalizeCampaignV3AILandingNodes(emailNormalization.nodes);
    const primaryNormalization = normalizeCampaignV3AIPrimaryOvercounts(landingNormalization.nodes, setup);
    const socialNormalization = normalizeCampaignV3AISocialOvercounts(primaryNormalization.nodes, setup);
    const landingFallback = normalizeCampaignV3AILandingFallback(socialNormalization.nodes, setup);
    const emailFallback = normalizeCampaignV3AIEmailFallback(landingFallback.nodes, setup);
    let normalizedNodes = emailFallback.nodes.map((node) => canonicalizeCampaignV3LandingPageFields(node));
    let qualityDiagnostics = null;
    let initialQualityDiagnostics = null;
    let repairDiagnostics = null;
    try {
      qualityDiagnostics = evaluateCampaignV3Quality(normalizedNodes, setup, {
        stage: "afterEmailFallbackBeforePlan",
        expectedCounts: expectedCampaignV3NodeCounts(setup)
      });
      initialQualityDiagnostics = qualityDiagnostics;
      console.info("[Campaign V3 Quality Gate]", qualityDiagnostics);
    } catch (qualityError) {
      qualityDiagnostics = {
        ok: true,
        score: 100,
        issues: [],
        counts: { errors: 0, warnings: 0 },
        structuralOk: true,
        structuralScore: 100,
        strategicScore: 100,
        overallScore: 100,
        validationIssues: [],
        optimizationIssues: [],
        validationCounts: { errors: 0, warnings: 0 },
        optimizationCounts: {
          total: 0,
          warnings: 0,
          opportunities: 0
        },
        strategicDimensions: {
          specificity: null,
          offerClarity: null,
          outcomeClarity: null,
          differentiation: null,
          audienceFit: null,
          brandBrainAlignment: null
        },
        repairRecommendation: {
          shouldRepair: false,
          reason: null,
          targetCount: 0,
          maxTargets: 0,
          targets: []
        },
        error: qualityError?.message || String(qualityError || "")
      };
      initialQualityDiagnostics = qualityDiagnostics;
      console.warn("[Campaign V3 Quality Gate] diagnostics failed; continuing without behavior changes.", qualityDiagnostics);
    }
    if (qualityDiagnostics?.ok === false) {
      try {
        const repairLoop = await runCampaignV3QualityRepairLoop(normalizedNodes, qualityDiagnostics, buildCampaignV3RepairContext(normalizedNodes, setup));
        normalizedNodes = repairLoop.nodes;
        qualityDiagnostics = repairLoop.qualityResult;
        repairDiagnostics = repairLoop.diagnostics;
      } catch (repairError) {
        repairDiagnostics = {
          attempted: true,
          error: repairError?.message || String(repairError || ""),
          remainingIssues: Array.isArray(qualityDiagnostics?.issues) ? qualityDiagnostics.issues : []
        };
        console.warn("[Campaign V3 Repair Loop] Repair loop failed; continuing with best available campaign.", repairDiagnostics);
      }
    } else {
      logCampaignV3RepairLoop("First quality result:", qualityDiagnostics);
      logCampaignV3RepairLoop("Repair targets:", []);
    }
    const nodeReport = campaignV3NodeReport(rawNodes);
    const firstTwentyNodes = campaignV3NodeReport(rawNodes, 20);
    const diagnosticBase = {
      setup,
      expectedCounts: expectedCampaignV3NodeCounts(setup),
      actualCountsByType: campaignV3NodeCounts(rawNodes),
      normalizedCountsByType: campaignV3NodeCounts(normalizedNodes),
      actualCountsBySubtype: campaignV3NodeSubtypeCounts(rawNodes),
      nodeCount: rawNodes.length,
      normalizedNodeCount: normalizedNodes.length,
      emailNormalization: emailNormalization.diagnostics,
      landingNormalization: landingNormalization.diagnostics,
      primaryNormalization: primaryNormalization.diagnostics,
      socialNormalization: socialNormalization.diagnostics,
      landingFallback: landingFallback.diagnostics,
      emailFallback: emailFallback.diagnostics,
      initialQualityDiagnostics,
      qualityDiagnostics,
      repairDiagnostics,
      firstTwentyNodes
    };

    console.info("[Funklix Campaign Generator V3 AI] Raw AI response", apiPlan);
    console.table(nodeReport);
    logCampaignV3AIDiagnostics("Expected V3 counts", diagnosticBase.expectedCounts);
    logCampaignV3AIDiagnostics("Actual AI counts grouped by type", diagnosticBase.actualCountsByType);
    logCampaignV3AIDiagnostics("Email Campaign normalization", diagnosticBase.emailNormalization);
    logCampaignV3AIDiagnostics("Landing Page over-count normalization", diagnosticBase.landingNormalization);
    logCampaignV3AIDiagnostics("Idea / Campaign Variation / Content over-count normalization", diagnosticBase.primaryNormalization);
    logCampaignV3AIDiagnostics("Social Media Posting over-count normalization", diagnosticBase.socialNormalization);
    logCampaignV3AIDiagnostics("Landing Page fallback normalization", diagnosticBase.landingFallback);
    logCampaignV3AIDiagnostics("Email Campaign fallback normalization", diagnosticBase.emailFallback);
    logCampaignV3AIDiagnostics("Normalized counts grouped by type", diagnosticBase.normalizedCountsByType);
    logCampaignV3AIDiagnostics("Actual AI counts grouped by subtype", diagnosticBase.actualCountsBySubtype);
    logCampaignV3AIDiagnostics("First 20 returned nodes", firstTwentyNodes);

    const planResult = campaignV3.buildCampaignV3PlanFromNodes(normalizedNodes, setup);
    const failedRules = planResult.ok ? [] : planResult.diagnostics.map((diagnostic) => diagnostic.code);
    const planDiagnostics = {
      ...diagnosticBase,
      failedRules,
      diagnostics: planResult.diagnostics
    };

    if (!planResult.ok) {
      console.error("[Funklix Campaign Generator V3 AI] FAILED V3 compatibility validation. No nodes were created.", planDiagnostics);
      return { ok: false, apiPlan, planResult, diagnostics: planDiagnostics };
    }

    const edges = campaignV3.buildCampaignV3Edges(planResult.plan);
    const origin = calculateCampaignPlanOrigin(setup);
    const layoutResult = campaignV3.layoutCampaignV3Plan(planResult.plan, setup, origin);
    if (!layoutResult.ok) {
      const layoutDiagnostics = {
        ...diagnosticBase,
        failedRules: layoutResult.diagnostics.map((diagnostic) => diagnostic.code),
        diagnostics: layoutResult.diagnostics
      };
      console.error("[Funklix Campaign Generator V3 AI] V3 layout failed. No nodes were created.", layoutDiagnostics);
      return { ok: false, apiPlan, planResult, edges, layoutResult, diagnostics: layoutDiagnostics };
    }

    reportStatus("Building Canvas...");
    const adapter = createCampaignV3RealCanvasAdapter();
    const commitResult = campaignV3.commitCampaignV3PlanToCanvas(layoutResult, adapter);
    const commitDiagnostics = {
      ...diagnosticBase,
      failedRules: commitResult.ok ? [] : commitResult.diagnostics.map((diagnostic) => diagnostic.code),
      diagnostics: commitResult.diagnostics
    };
    if (!commitResult.ok) {
      console.error("[Funklix Campaign Generator V3 AI] Real-canvas commit had diagnostics.", commitDiagnostics);
    } else {
      logCampaignV3AIDiagnostics("AI compatibility campaign committed to canvas.", commitDiagnostics);
    }
    updateEmptyState();
    drawLinks();
    updateListView();
    return { ok: commitResult.ok, apiPlan, planResult, edges, layoutResult, commitResult, adapter, diagnostics: commitDiagnostics };
  } catch (error) {
    console.error("[Funklix Campaign Generator V3 AI] AI compatibility flow failed before commit. No nodes were created.", {
      setup,
      error
    });
    return { ok: false, error, setup };
  }
}


function centerViewportOnCampaignV3Result(result = {}) {
  const createdEntries = result?.commitResult?.createdNodes || result?.adapter?.committedNodes || [];
  const createdNodes = createdEntries
    .map((entry) => entry?.node || entry)
    .filter((node) => node && node.position && Number.isFinite(node.position.x) && Number.isFinite(node.position.y));
  if (!createdNodes.length || !el.canvas) return;

  const bounds = createdNodes.reduce((nextBounds, node) => ({
    minX: Math.min(nextBounds.minX, node.position.x),
    minY: Math.min(nextBounds.minY, node.position.y),
    maxX: Math.max(nextBounds.maxX, node.position.x + NODE_WIDTH),
    maxY: Math.max(nextBounds.maxY, node.position.y + NODE_HEIGHT)
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });

  if (!Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY) || !Number.isFinite(bounds.maxX) || !Number.isFinite(bounds.maxY)) return;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  el.canvas.scrollLeft = Math.max(0, centerX * state.zoom - el.canvas.clientWidth / 2);
  el.canvas.scrollTop = Math.max(0, centerY * state.zoom - el.canvas.clientHeight / 2);
}

function setCampaignV3ModalBusy(overlay, busy) {
  overlay.dataset.campaignV3Busy = busy ? "true" : "false";
  overlay.querySelectorAll("input, textarea, select, button").forEach((control) => {
    control.disabled = busy;
  });
}

function campaignV3ModalSetupFromInputs(overlay) {
  const normalized = normalizeCampaignSetupOptions({
    variationCount: overlay.querySelector("#campaign-v3-variations")?.value,
    postsPerVariation: overlay.querySelector("#campaign-v3-posts")?.value,
    channel: overlay.querySelector("#campaign-v3-channel")?.value,
    includeLandingPage: overlay.querySelector("#campaign-v3-include-landing")?.checked,
    includeEmailCampaign: overlay.querySelector("#campaign-v3-include-email")?.checked
  });
  return {
    campaignIdea: cleanCampaignField(overlay.querySelector("#campaign-v3-idea")?.value),
    additionalContext: cleanCampaignField(overlay.querySelector("#campaign-v3-context")?.value),
    ...normalized
  };
}


const CAMPAIGN_V3_CREATION_STEPS = [
  { id: "understand", label: "Understanding your campaign", status: "Reading your campaign brief..." },
  { id: "brand", label: "Learning your brand context", status: "Tuning the work to your Brand Brain..." },
  { id: "angles", label: "Exploring campaign angles", status: "Finding the strongest angles..." },
  { id: "strategy", label: "Creating content strategy", status: "Turning your strategy into content..." },
  { id: "social", label: "Generating social content", status: "Drafting social posts and messaging paths..." },
  { id: "landing", label: "Preparing landing page", status: "Preparing conversion assets..." },
  { id: "quality", label: "Running quality checks", status: "Checking campaign quality..." },
  { id: "optimize", label: "Optimizing campaign structure", status: "Optimizing campaign structure..." },
  { id: "canvas", label: "Building campaign canvas", status: "Assembling your canvas..." }
];

function campaignV3StepIndexForStatus(message = "") {
  if (/building\s+canvas|canvas/i.test(message)) return 5;
  if (/generating\s+campaign|campaign/i.test(message)) return 5;
  if (/analyzing\s+strategy|strategy/i.test(message)) return 2;
  return 0;
}

function waitForCampaignV3ModalStep(ms = 900) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function campaignV3ProgressSummary(setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  const extras = [
    normalized.includeLandingPage ? "landing page" : null,
    normalized.includeEmailCampaign ? "email campaign" : null
  ].filter(Boolean).join(" + ");
  return `${normalized.variationCount} variations · ${normalized.postsPerVariation} posts each · ${normalized.channel}${extras ? ` · ${extras}` : ""}`;
}

function campaignV3AvatarMarkup({ complete = false } = {}) {
  const avatarUrl = getApprovedBrandAvatarUrl();
  return `
    <div class="campaign-v3-avatar-wrap ${complete ? "is-complete" : ""}">
      <div class="campaign-v3-avatar-orbit" aria-hidden="true"></div>
      <div class="campaign-v3-avatar" aria-label="Brand AI creator">
        ${avatarUrl ? `<img src="${avatarUrl}" alt="Brand Avatar" />` : `<span class="campaign-v3-avatar-fallback"><strong>F</strong><small>AI</small></span>`}
      </div>
      ${complete ? `<div class="campaign-v3-avatar-check" aria-hidden="true">✓</div>` : ""}
    </div>`;
}

function campaignV3ModalScrollContainer(overlay) {
  return overlay?.querySelector?.(".campaign-builder-modal") || null;
}

function markCampaignV3AutoScrolling(container, duration = 420) {
  if (!container) return;
  container.dataset.campaignV3AutoScrolling = "true";
  window.setTimeout(() => {
    if (container) container.dataset.campaignV3AutoScrolling = "false";
  }, duration);
}

function prepareCampaignV3ModalScrolling(overlay) {
  const container = campaignV3ModalScrollContainer(overlay);
  if (!container) return;
  container.dataset.campaignV3LastUserScrollAt = "0";
  container.dataset.campaignV3AutoScrolling = "true";
  if (!container.dataset.campaignV3ScrollListenerAttached) {
    container.addEventListener("scroll", () => {
      if (container.dataset.campaignV3AutoScrolling === "true") return;
      container.dataset.campaignV3LastUserScrollAt = String(Date.now());
    }, { passive: true });
    container.dataset.campaignV3ScrollListenerAttached = "true";
  }
  container.scrollTop = 0;
  window.requestAnimationFrame(() => {
    container.scrollTop = 0;
    markCampaignV3AutoScrolling(container, 160);
  });
}

function scrollCampaignV3ActiveStepIntoView(overlay, activeItem) {
  const container = campaignV3ModalScrollContainer(overlay);
  if (!container || !activeItem) return;
  const lastUserScrollAt = Number(container.dataset.campaignV3LastUserScrollAt || 0);
  if (lastUserScrollAt && Date.now() - lastUserScrollAt < 1800) return;

  const containerRect = container.getBoundingClientRect();
  const itemRect = activeItem.getBoundingClientRect();
  const topPadding = 26;
  const bottomPadding = 26;
  const itemAbove = itemRect.top < containerRect.top + topPadding;
  const itemBelow = itemRect.bottom > containerRect.bottom - bottomPadding;
  if (!itemAbove && !itemBelow) return;

  const targetTop = itemAbove
    ? container.scrollTop + itemRect.top - containerRect.top - topPadding
    : container.scrollTop + itemRect.bottom - containerRect.bottom + bottomPadding;
  markCampaignV3AutoScrolling(container, 520);
  container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
}

function renderCampaignV3CreationExperience(overlay, setup = {}) {
  const modal = overlay.querySelector(".campaign-builder-modal");
  if (!modal) return;
  modal.classList.add("campaign-v3-creation-modal");
  modal.innerHTML = `
    <div class="campaign-v3-creation-shell" aria-live="polite">
      ${campaignV3AvatarMarkup()}
      <div class="campaign-v3-creation-copy">
        <span class="campaign-builder-kicker">Brand AI Campaign Creator</span>
        <h3>Your Brand AI is building your campaign</h3>
        <p>Designing a campaign tailored to your audience, channel and goals.</p>
        <div class="campaign-v3-live-status" data-campaign-v3-live-status>${CAMPAIGN_V3_CREATION_STEPS[0].status}</div>
        <small>${campaignV3ProgressSummary(setup)}</small>
      </div>
      <ol class="campaign-v3-progress-steps">
        ${CAMPAIGN_V3_CREATION_STEPS.map((step, index) => `<li data-campaign-v3-step="${step.id}" class="${index === 0 ? "is-active" : ""}"><span>•</span><strong>${step.label}</strong></li>`).join("")}
      </ol>
    </div>`;
  prepareCampaignV3ModalScrolling(overlay);
  updateCampaignV3CreationProgress(overlay, 0);
}

function updateCampaignV3CreationProgress(overlay, activeIndex = 0) {
  const safeActiveIndex = Math.max(0, Math.min(CAMPAIGN_V3_CREATION_STEPS.length - 1, activeIndex));
  let activeItem = null;
  overlay.querySelectorAll("[data-campaign-v3-step]").forEach((item, index) => {
    const done = index < safeActiveIndex;
    const active = index === safeActiveIndex;
    item.classList.toggle("is-done", done);
    item.classList.toggle("is-active", active);
    item.classList.toggle("is-upcoming", index > safeActiveIndex);
    if (active) activeItem = item;
    const marker = item.querySelector("span");
    if (marker) marker.textContent = done ? "✓" : "•";
  });
  const statusEl = overlay.querySelector("[data-campaign-v3-live-status]");
  if (statusEl) statusEl.textContent = CAMPAIGN_V3_CREATION_STEPS[safeActiveIndex]?.status || "Almost ready...";
  scrollCampaignV3ActiveStepIntoView(overlay, activeItem);
}

function renderCampaignV3ReadyState(overlay, result = null) {
  const modal = overlay.querySelector(".campaign-builder-modal");
  if (!modal) return;
  overlay.dataset.campaignV3Busy = "true";
  modal.classList.add("campaign-v3-creation-modal");
  modal.innerHTML = `
    <div class="campaign-v3-complete-shell" aria-live="polite">
      ${campaignV3AvatarMarkup({ complete: true })}
      <span class="campaign-builder-kicker">Campaign Creation Complete</span>
      <h3>Campaign Ready</h3>
      <p>Your Brand AI has created, checked and assembled your campaign.</p>
      <ul class="campaign-v3-summary-chips" aria-label="Campaign completion summary">
        <li>Strategy</li>
        <li>Content</li>
        <li>Landing Page</li>
        <li>Quality Checked</li>
        <li>Canvas Ready</li>
      </ul>
      <div class="campaign-builder-actions campaign-v3-complete-actions">
        <button type="button" id="campaign-v3-reveal" class="campaign-v3-primary-button">Reveal Campaign</button>
      </div>
    </div>`;
  prepareCampaignV3ModalScrolling(overlay);
  modal.querySelector("#campaign-v3-reveal")?.addEventListener("click", () => {
    overlay.remove();
    centerViewportOnCampaignV3Result(result);
    setSaveStatus("Campaign generated successfully.");
  });
}

function renderCampaignV3ErrorState(overlay, setup = {}, onRetry = null) {
  const modal = overlay.querySelector(".campaign-builder-modal");
  if (!modal) return;
  overlay.dataset.campaignV3Busy = "false";
  modal.classList.add("campaign-v3-creation-modal");
  modal.innerHTML = `
    <div class="campaign-v3-error-shell" aria-live="assertive">
      <div class="campaign-v3-error-mark">!</div>
      <span class="campaign-builder-kicker">Campaign Creation Paused</span>
      <h3>We couldn’t finish this campaign</h3>
      <p>Something interrupted generation. You can retry with the same settings or close this window and try again later.</p>
      <div class="campaign-builder-actions campaign-v3-error-actions">
        <button type="button" id="campaign-v3-error-close" class="campaign-v3-secondary-button">Close</button>
        <button type="button" id="campaign-v3-error-retry" class="campaign-v3-primary-button">Retry</button>
      </div>
    </div>`;
  modal.querySelector("#campaign-v3-error-close")?.addEventListener("click", () => overlay.remove());
  modal.querySelector("#campaign-v3-error-retry")?.addEventListener("click", () => {
    if (typeof onRetry === "function") onRetry(setup);
  });
}

function openCampaignV3Modal() {
  const overlay = document.createElement("div");
  overlay.className = "campaign-builder-overlay";
  overlay.innerHTML = `<div class="campaign-builder-modal fk-section">
    <div class="campaign-builder-hero fk-card">
      <span class="campaign-builder-kicker fk-badge">Campaign Generator V3</span>
      <h3>Generate Campaign (V3)</h3>
      <p>Use the feature-flagged V3 AI compatibility flow to build a deterministic campaign funnel on the canvas.</p>
    </div>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Campaign Idea</span>
      <textarea class="fk-textarea" id="campaign-v3-idea" rows="5" placeholder="Launch a new service, promote a seasonal offer, or increase demo bookings..."></textarea>
    </label>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Additional Context</span>
      <textarea class="fk-textarea" id="campaign-v3-context" rows="3" placeholder="Optional audience, timing, channel, or campaign notes..."></textarea>
    </label>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Channel</span>
      <select class="fk-select" id="campaign-v3-channel"><option>LinkedIn</option><option>X</option><option>Instagram</option><option>TikTok</option><option>Mixed</option></select>
    </label>
    <div class="campaign-builder-grid">
      <label class="campaign-builder-field fk-card">
        <span>Variations</span>
        <input class="fk-input" id="campaign-v3-variations" type="number" min="1" max="10" value="3" />
      </label>
      <label class="campaign-builder-field fk-card">
        <span>Posts per Variation</span>
        <input class="fk-input" id="campaign-v3-posts" type="number" min="1" max="20" value="3" />
      </label>
    </div>
    <div class="campaign-builder-grid">
      <label class="campaign-builder-toggle fk-card"><input id="campaign-v3-include-landing" type="checkbox" checked /><span><strong>Landing Page</strong><small>Include Landing Page</small></span></label>
      <label class="campaign-builder-toggle fk-card"><input id="campaign-v3-include-email" type="checkbox" checked /><span><strong>Email Campaign</strong><small>Include Email Campaign</small></span></label>
    </div>
    <p class="campaign-builder-status" data-campaign-v3-status></p>
    <p class="campaign-builder-error" data-campaign-v3-error></p>
    <div class="campaign-builder-actions"><button class="fk-btn fk-btn-ghost" type="button" id="campaign-v3-legacy">Use legacy generator</button><button class="fk-btn fk-btn-secondary" type="button" id="campaign-v3-cancel">Cancel</button><button class="fk-btn fk-btn-primary primary-add" type="button" id="campaign-v3-generate">Generate Campaign</button></div>
  </div>`;
  document.body.appendChild(overlay);

  const errorEl = overlay.querySelector("[data-campaign-v3-error]");
  const closeModal = (force = false) => {
    if (!force && overlay.dataset.campaignV3Busy === "true") return;
    overlay.remove();
  };
  overlay.querySelector("#campaign-v3-legacy")?.addEventListener("click", () => {
    closeModal(true);
    openCreateCampaignModal();
  });
  overlay.querySelector("#campaign-v3-cancel")?.addEventListener("click", () => closeModal());
  overlay.addEventListener("click", (event) => { if (event.target === overlay) closeModal(); });

  overlay.querySelector("#campaign-v3-generate")?.addEventListener("click", async () => {
    const setup = campaignV3ModalSetupFromInputs(overlay);
    if (!setup.campaignIdea) {
      errorEl.textContent = "Please enter a campaign idea.";
      return;
    }

    const runGeneration = async (activeSetup) => {
      renderCampaignV3CreationExperience(overlay, activeSetup);
      setCampaignV3ModalBusy(overlay, true);
      updateCampaignV3CreationProgress(overlay, 0);
      setActiveView("board");
      toggleListMode(false);

      let activeStepIndex = 0;
      let maxWorkingStepIndex = 2;
      const generationExperienceStartedAt = Date.now();
      const simulatedProgress = window.setInterval(() => {
        const cappedWorkingStep = Math.min(maxWorkingStepIndex, 5);
        if (activeStepIndex < cappedWorkingStep) {
          activeStepIndex += 1;
          updateCampaignV3CreationProgress(overlay, activeStepIndex);
        }
      }, 1050);

      const stopSimulatedProgress = () => window.clearInterval(simulatedProgress);
      let result = null;

      try {
        result = await runCampaignV3AICompatibility(activeSetup, {
          onStatus: (message) => {
            maxWorkingStepIndex = Math.max(maxWorkingStepIndex, campaignV3StepIndexForStatus(message));
            if (/building\s+canvas|canvas/i.test(message)) {
              const statusEl = overlay.querySelector("[data-campaign-v3-live-status]");
              if (statusEl) statusEl.textContent = "Almost ready...";
            }
          }
        });
        const minimumExperienceRemaining = Math.max(0, 4600 - (Date.now() - generationExperienceStartedAt));
        if (minimumExperienceRemaining) await waitForCampaignV3ModalStep(minimumExperienceRemaining);
      } finally {
        stopSimulatedProgress();
      }

      if (result?.ok) {
        for (let index = activeStepIndex + 1; index < CAMPAIGN_V3_CREATION_STEPS.length; index += 1) {
          await waitForCampaignV3ModalStep(420);
          updateCampaignV3CreationProgress(overlay, index);
        }
        await waitForCampaignV3ModalStep(360);
        renderCampaignV3ReadyState(overlay, result);
        return;
      }

      renderCampaignV3ErrorState(overlay, activeSetup, runGeneration);
    };

    errorEl.textContent = "";
    runGeneration(setup).catch((error) => {
      console.error("[Funklix Campaign Generator V3] Modal generation experience failed", error);
      renderCampaignV3ErrorState(overlay, setup, runGeneration);
    });
  });

  return overlay;
}

async function debugRunCampaignV3AI(setupOverride = {}) {
  return runCampaignV3AICompatibility(setupOverride);
}

if (typeof window !== "undefined") {
  window.debugRunCampaignV3Mock = debugRunCampaignV3Mock;
  window.debugRunCampaignV3AI = debugRunCampaignV3AI;
  window.debugOpenCampaignV3Modal = openCampaignV3Modal;
  window.debugOpenLegacyCampaignModal = openCreateCampaignModal;
}

function campaignEstimate(setup = {}) {
  const normalized = normalizeCampaignSetupOptions(setup);
  return {
    variations: normalized.variationCount,
    socialPosts: normalized.variationCount * normalized.postsPerVariation,
    landingPages: normalized.includeLandingPage ? normalized.variationCount : 0,
    emails: normalized.includeEmailCampaign ? normalized.variationCount : 0,
    totalAssets: expectedCampaignNodeCount(normalized)
  };
}

function updateCampaignEstimate(overlay) {
  const setup = normalizeCampaignSetupOptions({
    variationCount: overlay.querySelector("#campaign-variation-count")?.value,
    postsPerVariation: overlay.querySelector("#campaign-post-count")?.value,
    includeLandingPage: overlay.querySelector("#campaign-include-landing")?.checked,
    includeEmailCampaign: overlay.querySelector("#campaign-include-email")?.checked,
    channel: overlay.querySelector("#campaign-channel")?.value
  });
  const estimate = campaignEstimate(setup);
  const target = overlay.querySelector("#campaign-estimate-output");
  if (!target) return;
  target.innerHTML = `
    <div><strong>${estimate.variations}</strong><span>Variations</span></div>
    <div><strong>${estimate.socialPosts}</strong><span>Social Posts</span></div>
    <div><strong>${estimate.landingPages}</strong><span>Landing Pages</span></div>
    <div><strong>${estimate.emails}</strong><span>Emails</span></div>
    <p><strong>${estimate.totalAssets}</strong> Assets Total</p>`;
}

function createCampaignLoadingOverlay(setup = {}) {
  const overlay = document.createElement("div");
  overlay.className = "campaign-loading-overlay";
  const avatarUrl = getApprovedBrandAvatarUrl();
  overlay.innerHTML = `
    <div class="campaign-loading-card">
      <div class="campaign-loading-avatar">${avatarUrl ? `<img src="${avatarUrl}" alt="Brand Avatar" />` : `<span>🤖</span>`}</div>
      <div class="campaign-loading-copy">
        <strong>Creating Campaign...</strong>
        <p>${normalizeCampaignSetupOptions(setup).variationCount} angles · ${normalizeCampaignSetupOptions(setup).postsPerVariation} posts each · ${normalizeCampaignSetupOptions(setup).channel}</p>
      </div>
      <ol class="campaign-loading-steps">
        <li data-step="strategy"><span>•</span> Analyzing Brand Strategy</li>
        <li data-step="angles"><span>•</span> Creating Campaign Angles</li>
        <li data-step="content"><span>•</span> Writing Content</li>
        <li data-step="funnel"><span>•</span> Building Funnel</li>
        <li data-step="connect"><span>•</span> Connecting Assets</li>
      </ol>
    </div>`;
  document.body.appendChild(overlay);
  return overlay;
}

function setCampaignLoadingStep(overlay, activeStep = "strategy") {
  if (!overlay) return;
  const steps = ["strategy", "angles", "content", "funnel", "connect"];
  const activeIndex = Math.max(0, steps.indexOf(activeStep));
  overlay.querySelectorAll("[data-step]").forEach((item) => {
    const index = steps.indexOf(item.dataset.step);
    item.classList.toggle("is-done", index < activeIndex);
    item.classList.toggle("is-active", index === activeIndex);
    item.querySelector("span").textContent = index < activeIndex ? "✓" : index === activeIndex ? "•" : "•";
  });
}

function campaignLoadingStepForStatus(message = "") {
  if (/angle|variation/i.test(message)) return "angles";
  if (/content|social|post/i.test(message)) return "content";
  if (/landing|email|funnel/i.test(message)) return "funnel";
  if (/connect|asset|ready/i.test(message)) return "connect";
  return "strategy";
}

function dismissCampaignLoadingOverlay(overlay) {
  if (!overlay) return;
  overlay.classList.add("is-exiting");
  setTimeout(() => overlay.remove(), 280);
}

function setupCampaignStepper(overlay, inputId, min, max) {
  const input = overlay.querySelector(`#${inputId}`);
  overlay.querySelectorAll(`[data-stepper="${inputId}"]`).forEach((button) => {
    button.addEventListener("click", () => {
      const delta = Number(button.dataset.delta || 0);
      const next = Math.max(min, Math.min(max, Number(input.value || 0) + delta));
      input.value = String(next);
      updateCampaignEstimate(overlay);
    });
  });
}
function openCreateCampaignModal() {
  const overlay = document.createElement("div");
  overlay.className = "campaign-builder-overlay";
  overlay.innerHTML = `<div class="campaign-builder-modal fk-section">
    <div class="campaign-builder-hero fk-card">
      <span class="campaign-builder-kicker fk-badge">AI Campaign Builder</span>
      <h3>Create Campaign</h3>
      <p>Brief your AI marketing teammate. Funklix will build a multi-angle funnel directly on the canvas.</p>
    </div>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Campaign Idea</span>
      <textarea class="fk-textarea" id="campaign-idea-input" rows="5" placeholder="Describe the campaign goal, offer, ICP, launch, or product story..."></textarea>
    </label>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Additional Context</span>
      <input class="fk-input" id="campaign-context-input" type="text" placeholder="Optional constraints, timing, product details..." />
    </label>
    <div class="campaign-builder-grid">
      <div class="campaign-builder-card fk-card">
        <span>Campaign Variations</span>
        <div class="campaign-stepper">
          <button class="fk-btn fk-btn-secondary" type="button" data-stepper="campaign-variation-count" data-delta="-1">−</button>
          <input class="fk-input" id="campaign-variation-count" type="number" min="1" max="10" value="3" />
          <button class="fk-btn fk-btn-secondary" type="button" data-stepper="campaign-variation-count" data-delta="1">+</button>
        </div>
      </div>
      <div class="campaign-builder-card fk-card">
        <span>Social Posts Per Variation</span>
        <div class="campaign-stepper">
          <button class="fk-btn fk-btn-secondary" type="button" data-stepper="campaign-post-count" data-delta="-1">−</button>
          <input class="fk-input" id="campaign-post-count" type="number" min="1" max="20" value="5" />
          <button class="fk-btn fk-btn-secondary" type="button" data-stepper="campaign-post-count" data-delta="1">+</button>
        </div>
      </div>
    </div>
    <label class="campaign-builder-field campaign-builder-field-full fk-card">
      <span>Channel</span>
      <select class="fk-select" id="campaign-channel"><option>LinkedIn</option><option>X</option><option>Instagram</option><option>TikTok</option><option>Mixed</option></select>
    </label>
    <div class="campaign-builder-grid">
      <label class="campaign-builder-toggle fk-card"><input id="campaign-include-landing" type="checkbox" checked /><span><strong>Landing Page</strong><small>Generate Landing Page</small></span></label>
      <label class="campaign-builder-toggle fk-card"><input id="campaign-include-email" type="checkbox" checked /><span><strong>Email Campaign</strong><small>Generate Email Campaign</small></span></label>
    </div>
    <div class="campaign-estimate-card fk-card">
      <span class="campaign-builder-kicker fk-badge">Estimated Output</span>
      <div id="campaign-estimate-output" class="campaign-estimate-output"></div>
    </div>
    <div class="campaign-builder-actions"><button class="fk-btn fk-btn-secondary" type="button" id="campaign-modal-cancel">Cancel</button><button class="fk-btn fk-btn-primary primary-add" type="button" id="campaign-modal-generate">Generate Campaign</button></div>
  </div>`;
  document.body.appendChild(overlay);
  setupCampaignStepper(overlay, "campaign-variation-count", 1, 10);
  setupCampaignStepper(overlay, "campaign-post-count", 1, 20);
  ["campaign-include-landing", "campaign-include-email", "campaign-channel"].forEach((id) => overlay.querySelector(`#${id}`)?.addEventListener("change", () => updateCampaignEstimate(overlay)));
  updateCampaignEstimate(overlay);
  overlay.querySelector("#campaign-modal-cancel").addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
  overlay.querySelector("#campaign-modal-generate").addEventListener("click", async () => {
    const ideaText = overlay.querySelector("#campaign-idea-input").value.trim() || "Campaign Idea";
    const contextText = overlay.querySelector("#campaign-context-input").value.trim();
    const setupOptions = normalizeCampaignSetupOptions({
      variationCount: overlay.querySelector("#campaign-variation-count").value,
      postsPerVariation: overlay.querySelector("#campaign-post-count").value,
      includeLandingPage: overlay.querySelector("#campaign-include-landing").checked,
      includeEmailCampaign: overlay.querySelector("#campaign-include-email").checked,
      channel: overlay.querySelector("#campaign-channel").value
    });
    overlay.remove();
    setActiveView("board");
    toggleListMode(false);
    const loadingOverlay = createCampaignLoadingOverlay(setupOptions);
    setCampaignLoadingStep(loadingOverlay, "strategy");
    setSaveStatus(`Planning campaign: ${setupOptions.variationCount} variations, ${setupOptions.postsPerVariation} posts each...`);
    const setWorkerStatus = (message) => {
      setSaveStatus(message);
      setCampaignLoadingStep(loadingOverlay, campaignLoadingStepForStatus(message));
    };
    try {
      const apiPlan = await fetchGeneratedCampaignPlan(ideaText, contextText, setupOptions);
      setWorkerStatus("✨ Campaign plan ready. AI teammate is entering the board...");
      await generateCampaignFromIdea(ideaText, contextText, apiPlan, {
        onStatus: setWorkerStatus,
        setupOptions,
        onFirstNode: () => dismissCampaignLoadingOverlay(loadingOverlay)
      });
    } catch (error) {
      dismissCampaignLoadingOverlay(loadingOverlay);
      console.error("[Funklix AI] Generate Campaign failed", error);
      alert(error?.partialCampaign
        ? "Campaign generation stopped early. You can continue manually or use Generate Next Step."
        : "Could not generate campaign right now. No nodes were created.");
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
    const sourceNode = getNode(from);
    const targetNode = getNode(to);
    if (Date.now() - Math.max(sourceNode?.justConnectedAt || 0, targetNode?.justConnectedAt || 0) < 1300) {
      path.classList.add("campaign-link-reveal");
    }
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
  el.reviewNodeButton.style.display = hasSingleNode ? "block" : "none";
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
  el.reviewNodeButton.disabled = !hasSingleNode || isBoardReadOnly();
  el.reviewNodeButton.title = hasSingleNode ? (isBoardReadOnly() ? "Read-only board" : "Review selected node") : "Select a node";
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
    const structuredLandingText = [lp.headerClaim, lp.problem, lp.solution, lp.trust, lp.cta]
      .map((value) => cleanCampaignField(value))
      .filter(Boolean)
      .join(" ");
    const landingContent = cleanCampaignField(node.content);
    const normalizedLandingContent = landingContent.toLowerCase();
    const duplicatesStructuredField = [lp.headerClaim, lp.problem, lp.solution, lp.trust, lp.cta]
      .map((value) => cleanCampaignField(value).toLowerCase())
      .filter(Boolean)
      .some((value) => normalizedLandingContent === value);
    const hasMeaningfulLandingContent = landingContent
      && !duplicatesStructuredField
      && landingContent.length > Math.max(140, structuredLandingText.length * 0.75);
    if (hasMeaningfulLandingContent) {
      let didRenderStructuredPreview = false;
      try {
        const structuredPreview = parseStructuredLandingPagePreview(landingContent);
        didRenderStructuredPreview = appendStructuredLandingPagePreview(card, structuredPreview);
      } catch (error) {
        console.warn("[Funklix] Landing Page structured preview failed; falling back to plain preview.", error);
      }
      if (!didRenderStructuredPreview) {
        const contentPreview = document.createElement("p");
        contentPreview.className = "landing-preview-line";
        contentPreview.style.whiteSpace = "pre-line";
        contentPreview.style.maxHeight = "9.5em";
        contentPreview.style.overflow = "hidden";
        contentPreview.style.paddingBottom = "4px";
        contentPreview.textContent = landingContent.length > 520 ? `${landingContent.slice(0, 520).trim()}…` : landingContent;
        card.appendChild(contentPreview);
      }
    }
    [["Claim", lp.headerClaim], ["Problem", lp.problem], ["Solution", lp.solution], ["Trust", lp.trust], ["CTA", lp.cta]]
      .forEach(([label, value]) => {
        if (!value) return;
        const p = document.createElement("p");
        p.className = `landing-preview-line${label === "CTA" ? " is-cta" : ""}`;
        const strong = document.createElement("strong");
        strong.textContent = `${label}:`;
        p.append(strong, ` ${value}`);
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


function normalizeAiReviewSectionText(lines = []) {
  return lines.join("\n").trim();
}

function parseAiReviewList(text = "") {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^(?:[-*•]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function parseAiReviewText(rawText = "") {
  const text = String(rawText || "").trim();
  if (!text) return null;

  const sections = { summary: [], strengths: [], improvements: [], suggestedRewrite: [] };
  let score = "";
  let currentSection = null;

  text.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    const scoreMatch = trimmed.match(/^AI Review:\s*(.+)$/i);
    if (scoreMatch) {
      score = scoreMatch[1].trim();
      currentSection = null;
      return;
    }

    const sectionMatch = trimmed.match(/^(Summary|Strengths|Improvements|Improve|Suggested Rewrite):\s*(.*)$/i);
    if (sectionMatch) {
      const label = sectionMatch[1].toLowerCase();
      if (label === "improve") currentSection = "improvements";
      else if (label === "suggested rewrite") currentSection = "suggestedRewrite";
      else currentSection = label;
      if (sectionMatch[2]) sections[currentSection].push(sectionMatch[2]);
      return;
    }

    if (currentSection) sections[currentSection].push(line);
  });

  const summary = normalizeAiReviewSectionText(sections.summary);
  const strengths = parseAiReviewList(normalizeAiReviewSectionText(sections.strengths));
  const improvements = parseAiReviewList(normalizeAiReviewSectionText(sections.improvements));
  const suggestedRewrite = normalizeAiReviewSectionText(sections.suggestedRewrite);

  if (!score && !summary && !strengths.length && !improvements.length && !suggestedRewrite) return null;

  return {
    score: score || "—",
    summary,
    strengths,
    improvements,
    suggestedRewrite
  };
}

function appendAiReviewText(parent, text = "") {
  const paragraph = document.createElement("p");
  paragraph.textContent = text || "No details provided.";
  parent.appendChild(paragraph);
}

function createAiReviewAccordionSection({ title, tone, count = null, open = false, emptyText = "No details provided.", renderContent }) {
  const details = document.createElement("details");
  details.className = `ai-review-section ai-review-section-${tone}`;
  details.open = !!open;

  const summary = document.createElement("summary");
  const label = document.createElement("span");
  label.textContent = count === null ? title : `${title} (${count})`;
  summary.appendChild(label);

  const body = document.createElement("div");
  body.className = "ai-review-section-body";
  renderContent?.(body);
  if (!body.childNodes.length) appendAiReviewText(body, emptyText);

  details.append(summary, body);
  return details;
}


function setAiReviewFixPreview(nodeId, previewState = null) {
  if (!nodeId) return;
  if (!previewState) delete state.aiReviewFixPreviews[nodeId];
  else state.aiReviewFixPreviews[nodeId] = previewState;
}

function getAiReviewFixPreview(nodeId) {
  return nodeId ? state.aiReviewFixPreviews[nodeId] || null : null;
}

function selectNodeForAiWorkspace(node) {
  if (!node?.id) return;
  if (state.appMode === "brand") setAppMode("canvas");
  state.selectedIds.clear();
  state.selectedIds.add(node.id);
  state.selectedPrimary = node.id;
  updateSelectionClasses();
  fillInspector(node);
}

function focusAiWorkspace() {
  requestAnimationFrame(() => {
    el.aiWorkspaceSection?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  });
}

async function fetchAiReviewFix(node, improvementText) {
  const response = await fetch("/api/apply-review-fix", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      boardId: getCurrentBrandBrainBoardId(),
      nodeId: node.id,
      improvementText,
      currentNodeContent: node.content || "",
      nodeType: node.type || "",
      brandBrainData: state.brandCore
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Failed to apply review fix");
  return data;
}

function pulseAiUpdatedNode(nodeId) {
  const updatedEl = el.zoomLayer.querySelector(`[data-id='${nodeId}']`);
  if (!updatedEl) return;
  updatedEl.classList.add("ai-updated");
  setTimeout(() => updatedEl.classList.remove("ai-updated"), 1300);
}

function pulseInspectorContentField() {
  const field = el.inputs?.content;
  if (!field) return;
  field.classList.add("ai-workspace-field-updated");
  setTimeout(() => field.classList.remove("ai-workspace-field-updated"), 1300);
}

function applyAiReviewFixToNode(node, preview = null) {
  const nextContent = String(preview?.suggestedContent || "").trim();
  if (!node || !nextContent) return;
  node.content = nextContent;
  if (state.selectedPrimary === node.id && el.inputs?.content) el.inputs.content.value = node.content;
  updateNodeCard(node);
  updateListView();
  recordNodeUpdatedActivity(node);
  setAiReviewFixPreview(node.id, null);
  fillInspector(node);
  pulseAiUpdatedNode(node.id);
  pulseInspectorContentField();
  saveCampaignCanvasState();
}

function dismissAiReviewFix(node) {
  if (!node?.id) return;
  setAiReviewFixPreview(node.id, null);
  fillInspector(node);
}

function createAiWorkspaceReadonlyText(labelText, value = "") {
  const wrap = document.createElement("label");
  wrap.className = "ai-workspace-text-wrap";
  const label = document.createElement("span");
  label.textContent = labelText;
  const textarea = document.createElement("textarea");
  textarea.className = "ai-workspace-text";
  textarea.readOnly = true;
  textarea.rows = 5;
  textarea.value = value || "";
  wrap.append(label, textarea);
  return wrap;
}

function renderInspectorAiWorkspace(node) {
  if (!el.aiWorkspaceSection || !el.aiWorkspaceBody) return;
  const preview = getAiReviewFixPreview(node?.id);
  el.aiWorkspaceSection.classList.toggle("hidden", !node || !preview);
  el.aiWorkspaceBody.innerHTML = "";
  if (!node || !preview) return;

  const title = document.createElement("strong");
  title.className = "ai-workspace-heading";
  title.textContent = "Suggested Fix";

  const meta = document.createElement("div");
  meta.className = "ai-workspace-meta";
  meta.innerHTML = `<span><strong>Target Field:</strong> ${preview.targetLabel || "Content"}</span>`;

  const improvement = document.createElement("div");
  improvement.className = "ai-workspace-improvement";
  const improvementLabel = document.createElement("strong");
  improvementLabel.textContent = "Improvement:";
  const improvementText = document.createElement("p");
  improvementText.textContent = preview.improvementText || "";
  improvement.append(improvementLabel, improvementText);

  el.aiWorkspaceBody.append(title, meta, improvement);

  if (preview.status === "loading") {
    const loading = document.createElement("p");
    loading.className = "ai-workspace-status";
    loading.textContent = "Generating suggested fix...";
    el.aiWorkspaceBody.appendChild(loading);
    return;
  }

  if (preview.status === "error") {
    const error = document.createElement("p");
    error.className = "ai-workspace-error";
    error.textContent = preview.error || "Could not generate a suggested fix.";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", () => dismissAiReviewFix(node));
    el.aiWorkspaceBody.append(error, dismiss);
    return;
  }

  const explanation = document.createElement("div");
  explanation.className = "ai-workspace-explanation";
  const explanationLabel = document.createElement("strong");
  explanationLabel.textContent = "Explanation:";
  const explanationText = document.createElement("p");
  explanationText.textContent = preview.explanation || "No explanation provided.";
  explanation.append(explanationLabel, explanationText);

  const actions = document.createElement("div");
  actions.className = "ai-workspace-actions";
  const apply = document.createElement("button");
  apply.type = "button";
  apply.className = "primary-add";
  apply.textContent = "Apply";
  apply.disabled = !preview.suggestedContent || isBoardReadOnly();
  apply.addEventListener("click", () => {
    if (isBoardReadOnly()) {
      setSaveStatus("Read-only board");
      return;
    }
    applyAiReviewFixToNode(node, preview);
  });
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Dismiss";
  dismiss.addEventListener("click", () => dismissAiReviewFix(node));
  actions.append(apply, dismiss);

  el.aiWorkspaceBody.append(
    explanation,
    createAiWorkspaceReadonlyText("Current Text", preview.currentText || ""),
    createAiWorkspaceReadonlyText("Suggested Text", preview.suggestedContent || ""),
    actions
  );
}

async function startAiReviewFixFromPostit({ node, note, item, index, button = null }) {
  if (!node || !note) return;
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return;
  }
  selectNodeForAiWorkspace(node);
  const loadingPreview = {
    noteId: note.id,
    improvementIndex: index,
    improvementText: item,
    status: "loading",
    targetField: "content",
    targetLabel: "Content",
    currentText: node.content || "",
    suggestedContent: "",
    explanation: "",
    error: ""
  };
  setAiReviewFixPreview(node.id, loadingPreview);
  fillInspector(node);
  focusAiWorkspace();
  if (button) {
    button.disabled = true;
    button.textContent = "Generating...";
  }
  try {
    const fix = await fetchAiReviewFix(node, item);
    setAiReviewFixPreview(node.id, {
      ...loadingPreview,
      status: "ready",
      explanation: fix.explanation || "",
      suggestedContent: fix.suggestedContent || ""
    });
  } catch (error) {
    setAiReviewFixPreview(node.id, {
      ...loadingPreview,
      status: "error",
      error: error?.message || "Could not generate a suggested fix."
    });
  } finally {
    if (button?.isConnected) {
      button.disabled = isBoardReadOnly();
      button.textContent = "Apply Fix";
    }
    fillInspector(node);
    focusAiWorkspace();
  }
}

function renderAiReviewImprovementAction({ row, node, note, item, index }) {
  if (!node || !note) return;
  const button = document.createElement("button");
  button.type = "button";
  button.className = "postit-reply-button ai-review-apply-fix";
  button.textContent = "Apply Fix";
  const activePreview = getAiReviewFixPreview(node.id);
  button.disabled = isBoardReadOnly() || (activePreview?.noteId === note.id && activePreview?.improvementIndex === index && activePreview?.status === "loading");
  button.addEventListener("click", async (event) => {
    event.stopPropagation();
    await startAiReviewFixFromPostit({ node, note, item, index, button });
  });
  row.appendChild(button);
}

function renderAiReviewCard(review, context = {}) {
  const card = document.createElement("section");
  card.className = "ai-review-card";

  const heading = document.createElement("div");
  heading.className = "ai-review-card-heading";
  const title = document.createElement("strong");
  title.textContent = "🤖 AI Review";
  const score = document.createElement("span");
  score.className = "ai-review-score";
  score.textContent = review.score;
  heading.append(title, score);

  const summary = createAiReviewAccordionSection({
    title: "Summary",
    tone: "summary",
    open: true,
    renderContent: (body) => appendAiReviewText(body, review.summary)
  });

  const strengths = createAiReviewAccordionSection({
    title: "Strengths",
    tone: "strengths",
    count: review.strengths.length,
    emptyText: "No clear strengths identified.",
    renderContent: (body) => {
      if (!review.strengths.length) return;
      const list = document.createElement("ul");
      review.strengths.forEach((item) => {
        const li = document.createElement("li");
        li.textContent = item;
        list.appendChild(li);
      });
      body.appendChild(list);
    }
  });

  const improvements = createAiReviewAccordionSection({
    title: "Improvements",
    tone: "improvements",
    count: review.improvements.length,
    emptyText: "No major improvements identified.",
    renderContent: (body) => {
      review.improvements.forEach((item, index) => {
        const row = document.createElement("div");
        row.className = "ai-review-improvement-row";
        const rowTitle = document.createElement("strong");
        rowTitle.textContent = `Improvement ${index + 1}`;
        const rowText = document.createElement("p");
        rowText.textContent = item;
        row.append(rowTitle, rowText);
        renderAiReviewImprovementAction({ row, node: context.node, note: context.note, item, index });
        body.appendChild(row);
      });
    }
  });

  card.append(heading, summary, strengths, improvements);

  if (review.suggestedRewrite) {
    const rewrite = createAiReviewAccordionSection({
      title: "Suggested Rewrite",
      tone: "rewrite",
      renderContent: (body) => {
        const block = document.createElement("pre");
        block.className = "ai-review-rewrite";
        block.textContent = review.suggestedRewrite;
        body.appendChild(block);
      }
    });
    card.appendChild(rewrite);
  }

  return card;
}

function renderPostits(node, nodeEl) {
  nodeEl.querySelectorAll(".postit").forEach((p) => p.remove());
  if (!Array.isArray(node.postits)) node.postits = [];

  node.postits.forEach((note) => {
    ensureCommentIdentity(note);
    const isAiReviewNote = note.source === "ai_review" || note.authorEmail === "ai@funklix.local" || note.authorName === "AI Review";
    const parsedAiReview = isAiReviewNote ? parseAiReviewText(note.text) : null;
    const postit = el.postitTemplate.content.firstElementChild.cloneNode(true);
    postit.style.left = `${note.x}px`;
    postit.style.top = `${note.y}px`;
    postit.style.background = note.color;
    postit.classList.toggle("is-resolved", !!note.resolved);
    postit.classList.toggle("ai-review-postit", isAiReviewNote);

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
    area.value = note.text || "";
    area.disabled = !!note.resolved;
    area.readOnly = isAiReviewNote;
    area.style.fontSize = (note.text || "").length > 220 ? "0.7rem" : (note.text || "").length > 120 ? "0.82rem" : "0.96rem";
    area.addEventListener("input", () => {
      if (isBoardReadOnly()) {
        setSaveStatus("Read-only board");
        return;
      }
      note.text = area.value;
      area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
      saveCampaignCanvasState();
    });
    if (parsedAiReview && !note.resolved) {
      area.replaceWith(renderAiReviewCard(parsedAiReview, { node, note, nodeEl }));
    }

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
    renderInspectorAiWorkspace(null);
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
  renderInspectorAiWorkspace(node);
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
    empty.className = "inspector-image-name inspector-image-empty";
    empty.textContent = "Keine Bilder hochgeladen.";
    el.inspectorImageList.appendChild(empty);
    return;
  }

  node.images.forEach((img) => {
    const card = document.createElement("div");
    const isFavorite = node.favoriteImageId === img.id;
    card.className = `inspector-image-item fk-card${isFavorite ? " is-favorite" : ""}`;
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
    favoriteTag.className = "inspector-image-favorite-tag fk-pill";
    favoriteTag.textContent = "★";

    const actions = document.createElement("div");
    actions.className = "inspector-image-actions";

    const favoriteBtn = document.createElement("button");
    favoriteBtn.type = "button";
    favoriteBtn.className = "inspector-image-action fk-btn fk-btn-ghost";
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
    downloadBtn.className = "inspector-image-action fk-btn fk-btn-ghost";
    downloadBtn.textContent = "⬇️";
    downloadBtn.title = "Download";
    downloadBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      downloadNodeImage(node, img);
    });

    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "inspector-image-action danger fk-btn fk-btn-ghost";
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
      boardId: getCurrentBrandBrainBoardId(),
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
    boardId: getCurrentBrandBrainBoardId(),
    brandBrainData: state.brandCore
  };
}

function buildReviewNodeContext(node) {
  return {
    nodeType: node.type,
    title: node.title || "",
    content: node.content || "",
    social: node.social || {},
    landingPage: node.landingPage || {},
    imagePrompt: node.imagePrompt || "",
    goal: node.goal || "",
    audience: node.audience || "",
    channel: node.channel || node.social?.platform || "",
    funnelStage: node.funnelStage || "",
    tone: node.tone || "",
    tags: Array.isArray(node.tags) ? node.tags : [],
    campaignContext: getCampaignContextSummary() || "",
    connectedNodeContext: getConnectedNodeContext(node.id),
    boardId: getCurrentBrandBrainBoardId(),
    brandBrainData: state.brandCore
  };
}

async function fetchNodeReview(node) {
  const response = await fetch("/api/review-node", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildReviewNodeContext(node))
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error || "Failed to review node");
  return data;
}

function formatAiReviewComment(review = {}) {
  const score = Number.isFinite(Number(review.score)) ? Number(review.score).toFixed(1).replace(/\.0$/, "") : "0";
  const strengths = (Array.isArray(review.strengths) ? review.strengths : []).filter(Boolean).slice(0, 4);
  const improvements = (Array.isArray(review.improvements) ? review.improvements : []).filter(Boolean).slice(0, 4);
  return [
    `AI Review: ${score}/10`,
    "",
    "Summary:",
    review.summary || "No summary returned.",
    "",
    "Strengths:",
    ...(strengths.length ? strengths.map((item) => `- ${item}`) : ["- No clear strengths identified."]),
    "",
    "Improve:",
    ...(improvements.length ? improvements.map((item) => `- ${item}`) : ["- No major improvements identified."]),
    review.suggestedRewrite ? "" : null,
    review.suggestedRewrite ? "Suggested rewrite:" : null,
    review.suggestedRewrite || null
  ].filter((line) => line !== null).join("\n").trim();
}

function getApprovedBrandAvatarUrl() {
  const brandDNA = state.brandCore?.brandDNA;
  const avatar = brandDNA?.avatar;
  return brandDNA?.userApproved && avatar?.userApproved && avatar?.imageUrl ? avatar.imageUrl : "";
}

function addAiReviewPostitToNode(node, review) {
  if (!node) return null;
  if (!Array.isArray(node.postits)) node.postits = [];
  const createdAt = new Date().toISOString();
  const existingCount = node.postits.length;
  const note = {
    id: `postit-${state.postitCounter++}`,
    authorName: "AI Review",
    authorEmail: "ai@funklix.local",
    authorAvatar: getApprovedBrandAvatarUrl(),
    user: "AI Review",
    time: nowString(),
    createdAt,
    updatedAt: createdAt,
    source: "ai_review",
    text: formatAiReviewComment(review),
    color: "#e9f1ff",
    resolved: false,
    replies: [],
    x: 16 + (existingCount % 3) * 18,
    y: 56 + (existingCount % 3) * 18
  };
  node.postits.push(note);
  markNodeCommentsSeen(node.id);
  updateNodeCard(node);
  const entry = appendActivity("ai_reviewed_node", { node, userName: "AI" });
  if (entry) {
    entry.user = { name: "AI", email: "ai@funklix.local", avatar: getApprovedBrandAvatarUrl() };
    renderActivityFeed();
  }
  saveCampaignCanvasState();
  return note;
}

async function reviewNodeWithAI(node, triggerBtn = null) {
  if (!node) return null;
  if (isBoardReadOnly()) {
    setSaveStatus("Read-only board");
    return null;
  }
  const originalText = triggerBtn?.textContent || "";
  if (triggerBtn) {
    triggerBtn.disabled = true;
    triggerBtn.textContent = "Reviewing...";
  }
  setSaveStatus("Reviewing node...");
  try {
    const review = await fetchNodeReview(node);
    const note = addAiReviewPostitToNode(node, review);
    setSaveStatus("AI review added");
    return note;
  } catch (error) {
    console.error("[Funklix AI] Review node failed", error);
    setSaveStatus("Could not review node.");
    return null;
  } finally {
    if (triggerBtn) {
      triggerBtn.disabled = false;
      triggerBtn.textContent = originalText;
    }
  }
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
        boardId: getCurrentBrandBrainBoardId(),
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
        boardId: getCurrentBrandBrainBoardId(),
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
  const isHome = view === "home";
  const isBrandCore = view === "brand-core";
  el.dashboardView?.classList.toggle("hidden", !isHome);
  el.canvas.classList.toggle("hidden", view !== "board");
  el.boardListView.classList.toggle("hidden", view !== "list");
  el.calendarView.classList.toggle("hidden", view !== "calendar");
  el.boardsLibraryView?.classList.toggle("hidden", view !== "boards_library");
  el.insightsView?.classList.toggle("hidden", view !== "insights");
  el.aiBrainView?.classList.toggle("hidden", view !== "ai_brain");
  el.brandCoreWorkspace.classList.toggle("hidden", !isBrandCore);
  el.homeNavButton?.classList.toggle("active", isHome);
  el.campaignCanvasNavButton.classList.toggle("active", view === "board" || view === "list" || view === "calendar");
  el.boardsNavButton?.classList.toggle("active", view === "boards_library");
  el.brandCoreButton.classList.toggle("active", isBrandCore);
  el.aiBrainNavButton?.classList.toggle("active", view === "ai_brain");
  el.insightsNavButton?.classList.toggle("active", view === "insights");
  if (state.appMode !== "brand") {
    el.canvasTopbar.classList.toggle("hidden", isHome);
    el.inspectorPanel.classList.toggle("hidden", isHome);
  }
  el.cycleViewButton.textContent =
    view === "home" ? "Home" : view === "board" ? "Board View" : view === "list" ? "List View" : view === "calendar" ? "Calendar View" : view === "boards_library" ? "Boards" : view === "insights" ? "Insights" : view === "ai_brain" ? "AI Brain" : "Brand Core";
  if (isHome) {
    renderDashboardHero();
    renderDashboardContinueWorking();
    renderDashboardBrandEvolution();
    renderDashboardSuggestedOpportunities();
    renderDashboardTodaysFocus();
  }
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
    openCampaignGeneratorEntry();
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
    if (event.target.closest?.(".postit-text, .postit-scroll-body")) {
      return;
    }
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
el.reviewNodeButton?.addEventListener("click", async () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  await reviewNodeWithAI(node, el.reviewNodeButton);
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
        boardId: getCurrentBrandBrainBoardId(),
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

el.homeNavButton?.addEventListener("click", () => {
  setAppMode("canvas");
  setActiveView("home");
});
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
el.dashboardView?.addEventListener("click", (event) => {
  const focusNodeCard = event.target.closest("[data-dashboard-focus-node]");
  if (focusNodeCard) {
    const nodeId = focusNodeCard.dataset.dashboardFocusNode;
    if (nodeId && getNode(nodeId)) {
      setAppMode("canvas");
      requestAnimationFrame(() => focusNodeInCanvas(nodeId, { behavior: "smooth", select: true, pulse: true }));
    }
    return;
  }

  const actionButton = event.target.closest("[data-dashboard-action]");
  if (!actionButton) return;

  const action = actionButton.dataset.dashboardAction;
  if (action === "create-campaign") {
    setAppMode("canvas");
    setActiveView("board");
    el.createCampaignButton?.click();
    return;
  }

  if (action === "open-boards") {
    el.boardsNavButton?.click();
    return;
  }

  if (action === "open-current-board") {
    if (actionButton.dataset.dashboardTarget === "canvas") {
      el.campaignCanvasNavButton?.click();
    } else {
      el.boardsNavButton?.click();
    }
    return;
  }

  if (action === "open-brand") {
    el.brandCoreButton?.click();
    return;
  }

  if (action === "open-ai-brain") {
    el.aiBrainNavButton?.click();
  }
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
    if (event.target.closest("[data-empty-create-board]")) {
      event.preventDefault();
      el.boardsCreateButton?.click();
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
  return { brandCore: "", toneOfVoice: [], messagingPillars: [], valueProposition: "", personas: [], contentGuidelines: [], dosAndDonts: { dos: [], donts: [] }, brandVoiceExamples: { good: "", avoid: "" }, keywords: [], brandAssets: { domain: "", logo: "", colors: [], typography: "", references: [] }, brandDNA: null, customTiles: [] };
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
    if (el.boardsLibraryList) el.boardsLibraryList.innerHTML = '<div class="board-empty fk-card"><strong>Could not load boards.</strong><span>Please try again from the Boards navigation item.</span></div>';
  }
}

function getBoardBrandSnapshot(board = {}) {
  const boardId = board?.id ? String(board.id) : "";
  const currentBoardId = state.currentBoardId || getBoardIdFromPath() || "";
  if (boardId && currentBoardId && boardId === String(currentBoardId) && state.brandCore && typeof state.brandCore === "object" && !Array.isArray(state.brandCore)) {
    return state.brandCore;
  }
  const snapshot = board?.brand_core_snapshot || board?.brandCoreSnapshot || board?.brandCore || null;
  return snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) ? snapshot : null;
}

function getBoardBrandDisplay(board = {}, boardName = "") {
  const displaySnapshot = board?.brand_display && typeof board.brand_display === "object" && !Array.isArray(board.brand_display) ? board.brand_display : {};
  const snapshot = getBoardBrandSnapshot(board) || {};
  const brandDNA = snapshot.brandDNA && typeof snapshot.brandDNA === "object" && !Array.isArray(snapshot.brandDNA) ? snapshot.brandDNA : {};
  const avatar = brandDNA.avatar && typeof brandDNA.avatar === "object" && !Array.isArray(brandDNA.avatar) ? brandDNA.avatar : {};
  const brandAssets = snapshot.brandAssets && typeof snapshot.brandAssets === "object" && !Array.isArray(snapshot.brandAssets) ? snapshot.brandAssets : {};
  const brandName = [
    displaySnapshot.name,
    snapshot.brandName,
    snapshot.name,
    snapshot.title,
    brandDNA.brandName,
    brandDNA.name,
    brandAssets.name
  ].map((value) => (typeof value === "string" ? value.trim() : "")).find(Boolean) || "";
  const avatarUrl = [
    displaySnapshot.avatarUrl,
    brandDNA?.userApproved && avatar?.userApproved ? avatar.imageUrl : "",
    snapshot.avatarImageUrl,
    snapshot.avatarUrl,
    snapshot.brandAvatarUrl
  ].map(getSafeDashboardAvatarImageUrl).find(Boolean) || "";
  return {
    name: brandName,
    avatarUrl,
    initial: getDashboardAvatarInitial(brandName) || getDashboardAvatarInitial(boardName) || "B"
  };
}


function getBoardLastEdited(board = {}) {
  const rawTimestamp = board?.updated_at || board?.updatedAt || "";
  if (!rawTimestamp) return "Not available yet";
  const parsedTimestamp = new Date(rawTimestamp);
  if (Number.isNaN(parsedTimestamp.getTime())) return "Not available yet";
  return parsedTimestamp.toLocaleString('de-DE');
}

function getDisplayedBoards() {
  const boards = Array.isArray(state.boardsLibrary) ? [...state.boardsLibrary] : [];
  const currentBoardId = state.currentBoardId || getBoardIdFromPath() || "";
  if (!currentBoardId) return boards;
  const activeIndex = boards.findIndex((board) => String(board?.id || "") === String(currentBoardId));
  if (activeIndex <= 0) return boards;
  const [activeBoard] = boards.splice(activeIndex, 1);
  return [activeBoard, ...boards];
}

function getBoardsDomOrder() {
  if (!el.boardsLibraryList) return [];
  return [...el.boardsLibraryList.querySelectorAll('.board-row[data-board-id]')]
    .map((row) => row.getAttribute('data-board-id'))
    .filter(Boolean);
}

function getBoardDragAfterElement(container, y) {
  const rows = [...container.querySelectorAll('.board-row[data-board-id]:not(.is-dragging)')];
  return rows.reduce((closest, child) => {
    const box = child.getBoundingClientRect();
    const offset = y - box.top - box.height / 2;
    if (offset < 0 && offset > closest.offset) return { offset, element: child };
    return closest;
  }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
}

async function persistBoardOrderFromDom(initialOrder = []) {
  const orderedIds = getBoardsDomOrder();
  if (!orderedIds.length || orderedIds.join('|') === initialOrder.join('|')) return;
  const boardById = new Map(state.boardsLibrary.map((board) => [String(board?.id || ''), board]));
  const orderedBoards = orderedIds.map((id) => boardById.get(String(id))).filter(Boolean);
  if (orderedBoards.length !== orderedIds.length) {
    loadBoardsLibrary();
    return;
  }
  try {
    await Promise.all(orderedBoards.map(async (board, index) => {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: index })
      });
      if (!response.ok) throw new Error(`Failed to update board order for ${board.id}`);
    }));
  } catch (error) {
    console.error('[Boards Drag Reorder] Failed to persist order', error);
  } finally {
    loadBoardsLibrary();
  }
}

function bindBoardRowDragHandlers(row) {
  row.addEventListener('dragstart', (event) => {
    if (event.target.closest('button, input, textarea, select, a')) {
      event.preventDefault();
      return;
    }
    row.classList.add('is-dragging');
    row.setAttribute('aria-grabbed', 'true');
    row.dataset.dragInitialOrder = getBoardsDomOrder().join('|');
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', row.dataset.boardId || '');
  });

  row.addEventListener('dragend', () => {
    const initialOrder = (row.dataset.dragInitialOrder || '').split('|').filter(Boolean);
    row.classList.remove('is-dragging');
    row.setAttribute('aria-grabbed', 'false');
    delete row.dataset.dragInitialOrder;
    persistBoardOrderFromDom(initialOrder);
  });
}

function bindBoardsListDragHandlers() {
  if (!el.boardsLibraryList || el.boardsLibraryList.dataset.dragBound === 'true') return;
  el.boardsLibraryList.dataset.dragBound = 'true';
  el.boardsLibraryList.addEventListener('dragover', (event) => {
    const dragging = el.boardsLibraryList.querySelector('.board-row.is-dragging');
    if (!dragging) return;
    event.preventDefault();
    const afterElement = getBoardDragAfterElement(el.boardsLibraryList, event.clientY);
    if (afterElement == null) el.boardsLibraryList.appendChild(dragging);
    else el.boardsLibraryList.insertBefore(dragging, afterElement);
  });
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
    el.boardsLibraryList.innerHTML = `<div class="board-empty fk-card"><span class="boards-empty-kicker fk-badge">No saved workspaces</span><strong>No boards yet</strong><span>Create your first board to start collaborating.</span><button type="button" class="fk-btn fk-btn-primary" data-empty-create-board>Create New Board</button></div>`;
    return;
  }
  bindBoardsListDragHandlers();
  getDisplayedBoards().forEach((board) => {
    const sourceIndex = state.boardsLibrary.indexOf(board);
    const row = document.createElement('div');
    row.className = 'board-row fk-card';
    row.draggable = true;
    row.dataset.boardId = String(board.id || '');
    row.setAttribute('aria-grabbed', 'false');
    const savedAt = getBoardLastEdited(board);
    const boardName = board.name || 'Campaign Canvas Board';
    const userEmail = typeof state.user?.email === "string" ? state.user.email.trim().toLowerCase() : "";
    const ownerEmail = typeof board.owner_email === "string" ? board.owner_email.trim().toLowerCase() : "";
    const accessRole = board.access_role || "";
    const isOwner = accessRole === "owner" || (!!userEmail && !!ownerEmail && ownerEmail === userEmail);
    const isEditor = accessRole === "editor";
    const isShared = !!board.owner_email && !isOwner;
    const isCopy = /\(copy\)$/i.test(boardName.trim());
    const ownerBy = deriveOwnerDisplayName(board.owner_name || "", board.owner_email || "");
    const roleChip = isOwner ? '<span class="board-row-chip owned fk-pill">Your Board</span>' : (isEditor ? '<span class="board-row-chip shared fk-pill">Editor</span>' : (isShared ? '<span class="board-row-chip shared fk-pill">Shared</span>' : '<span class="board-row-chip shared fk-pill">Open</span>'));
    const copyChip = isCopy ? '<span class="board-row-chip copy fk-pill">Copy</span>' : '';
    const ownerLine = isOwner ? 'You can edit this board.' : (isEditor ? `By ${ownerBy || 'another user'}` : (isShared ? `By ${ownerBy || 'another user'}` : 'No owner yet'));
    const boardBrand = getBoardBrandDisplay(board, boardName);
    const boardAvatar = boardBrand.avatarUrl
      ? `<img src="${escapeHtml(boardBrand.avatarUrl)}" alt="${escapeHtml(boardBrand.name || boardName)} Brand Avatar" />`
      : `<span>${escapeHtml(boardBrand.initial)}</span>`;
    const brandLine = boardBrand.name ? `<div class="board-row-brand"><span>Brand</span><strong>${escapeHtml(boardBrand.name)}</strong></div>` : "";
    row.innerHTML = `<div class="board-row-drag-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</div><div class="board-row-content"><div class="board-row-avatar" aria-hidden="true">${boardAvatar}</div><div class="board-row-details"><div class="board-row-titleline"><strong class="board-row-title">${escapeHtml(boardName)}</strong>${roleChip}${copyChip}</div>${brandLine}<div class="board-row-meta"><span>Last edited</span><strong>${escapeHtml(savedAt)}</strong></div><div class="board-row-description">${escapeHtml(ownerLine)}</div><div class="board-rename hidden" data-rename-wrap="${escapeHtml(board.id)}"><input class="fk-input" data-rename-input="${escapeHtml(board.id)}" value="${escapeHtml(board.name || '')}" /><button class="fk-btn fk-btn-primary" data-rename-save="${escapeHtml(board.id)}" type="button">Save</button><button class="fk-btn fk-btn-ghost" data-rename-cancel="${escapeHtml(board.id)}" type="button">Cancel</button></div></div></div><div class="board-row-actions"><button class="board-action-btn fk-btn fk-btn-primary" data-open-board="${escapeHtml(board.id)}" title="Open" aria-label="Open board">Open</button><button class="board-action-btn fk-btn fk-btn-secondary" data-copy-board="${escapeHtml(board.id)}" title="Copy link" aria-label="Copy link">Copy Link</button><button class="board-action-btn board-action-tertiary fk-btn fk-btn-ghost" data-rename-board="${escapeHtml(board.id)}" title="Rename" aria-label="Rename board">Rename</button><button class="board-action-btn board-action-tertiary danger fk-btn fk-btn-ghost" data-delete-board="${escapeHtml(board.id)}" title="Delete" aria-label="Delete board">Delete</button><button class="board-action-btn board-action-tertiary fk-btn fk-btn-ghost" data-up-board="${escapeHtml(board.id)}" data-index="${sourceIndex}" title="Move up" aria-label="Move board up">Move Up</button><button class="board-action-btn board-action-tertiary fk-btn fk-btn-ghost" data-down-board="${escapeHtml(board.id)}" data-index="${sourceIndex}" title="Move down" aria-label="Move board down">Move Down</button>${state.user?.email && !board.owner_email ? `<button class="board-action-btn fk-btn fk-btn-secondary" data-claim-board="${escapeHtml(board.id)}" title="Claim">Claim</button>` : ""}</div>`;
    bindBoardRowDragHandlers(row);
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
  const boardIdFromPath = getBoardIdFromPath();
  const hasLocalCanvasDraft = Boolean(localStorage.getItem(STORAGE_KEY));
  state.runtimeDiagnostics.pathBoardId = boardIdFromPath;
  state.runtimeDiagnostics.startupBranch = boardIdFromPath
    ? "/boards/:id"
    : (hasLocalCanvasDraft ? "root-localStorage-guarded" : "root-home");
  state.runtimeDiagnostics.canvasSource = boardIdFromPath
    ? "/boards/:id"
    : "empty/default state";
  state.runtimeDiagnostics.localDraft = {
    exists: hasLocalCanvasDraft,
    restored: false,
    reason: hasLocalCanvasDraft ? "root-startup-guard" : "none"
  };
  state.currentBoardId = boardIdFromPath;
  syncRuntimeSessionFromLegacy(boardIdFromPath ? "boot-board-route" : "boot-root");
  loadBrandBrainState();
  setSharePanelState(state.currentBoardId);
  if (boardIdFromPath) {
    resetBrandBrainForBoardHydration();
    await loadBoardFromUrlIfPresent();
  } else {
    loadBrandBrainState();
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
  setActiveView(boardIdFromPath ? "board" : "home");
  drawLinks();
  // URL/server-loaded boards refresh snapshot after applyCampaignState(); avoid capturing pre-load snapshot while in-flight.
  if (!state.initialServerLoadInFlight) refreshLastSavedSnapshot();
  if (!state.initialServerLoadInFlight) state.isBoardLoading = false;
  startAutosaveWatcher();
  bindEditingPresenceTracking();
  startPresenceLite();
  startBoardRefreshPolling();
  logRuntimeAlignmentDiagnostics("boot");
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { void bootApp(); });
else void bootApp();
