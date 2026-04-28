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

const state = {
  nodes: [],
  edges: [],
  selectedIds: new Set(),
  selectedPrimary: null,
  zoom: 1,
  nodeCounter: 1,
  postitCounter: 1,
  activeConnection: null,
  connectorCreateMode: null,
  connectorGhostEl: null,
  contextBoardPoint: { x: 0, y: 0 }
};

const el = {
  canvas: document.getElementById("canvas"),
  zoomLayer: document.getElementById("zoom-layer"),
  links: document.getElementById("links"),
  emptyState: document.getElementById("empty-state"),
  nodeListView: document.getElementById("node-list-view"),
  boardListView: document.getElementById("board-list-view"),
  toggleListViewButton: document.getElementById("toggle-list-view-btn"),
  addNodeButton: document.getElementById("add-node-btn"),
  zoomInButton: document.getElementById("zoom-in-btn"),
  zoomOutButton: document.getElementById("zoom-out-btn"),
  zoomLabel: document.getElementById("zoom-label"),
  nodeTemplate: document.getElementById("node-template"),
  postitTemplate: document.getElementById("postit-template"),
  contextMenu: document.getElementById("context-menu"),
  addContextNodeButton: document.getElementById("add-context-node-btn"),
  addPostitCommentButton: document.getElementById("add-postit-comment-btn"),
  picker: document.getElementById("node-type-picker"),
  pickerOptions: document.getElementById("node-type-options"),
  inspectorMeta: document.getElementById("inspector-meta"),
  nodeForm: document.getElementById("node-form"),
  socialFields: document.getElementById("social-fields"),
  contentUploadFields: document.getElementById("content-upload-fields"),
  imageUpload: document.getElementById("node-image-upload"),
  deleteNodeButton: document.getElementById("delete-node-btn"),
  inputs: {
    type: document.getElementById("node-type"),
    title: document.getElementById("node-title"),
    content: document.getElementById("node-content"),
    tags: document.getElementById("node-tags"),
    variants: document.getElementById("node-variants"),
    platform: document.getElementById("node-platform"),
    caption: document.getElementById("node-caption"),
    hashtags: document.getElementById("node-hashtags"),
    preview: document.getElementById("node-preview"),
    audience: document.getElementById("node-audience"),
    goal: document.getElementById("node-goal"),
    channel: document.getElementById("node-channel")
  }
};

Object.keys(NODE_TYPES).forEach((type) => {
  const option = document.createElement("option");
  option.value = type;
  option.textContent = type;
  el.inputs.type.appendChild(option);
});

function nowString() {
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "short", timeStyle: "short" }).format(new Date());
}

function boardPointFromClient(clientX, clientY) {
  const rect = el.canvas.getBoundingClientRect();
  return {
    x: (clientX - rect.left + el.canvas.scrollLeft) / state.zoom,
    y: (clientY - rect.top + el.canvas.scrollTop) / state.zoom
  };
}

function viewportCenterBoard() {
  return {
    x: (el.canvas.scrollLeft + el.canvas.clientWidth / 2) / state.zoom,
    y: (el.canvas.scrollTop + el.canvas.clientHeight / 2) / state.zoom
  };
}

function getNode(id) {
  return state.nodes.find((n) => n.id === id) || null;
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
  const intersects = !(n.right < c.left || n.left > c.right || n.bottom < c.top || n.top > c.bottom);
  if (intersects) return;

  const center = viewportCenterBoard();
  node.position.x = center.x - NODE_WIDTH / 2;
  node.position.y = center.y - NODE_HEIGHT / 2;
  updateNodeCard(node);
  forceNodeVisible(node.id);
}

function applyInherited(source, target) {
  if (!target.audience && source.audience) target.audience = source.audience;
  if (!target.goal && source.goal) target.goal = source.goal;
  if (!target.channel && source.channel) target.channel = source.channel;
}

function createNode({ type = "Idea", parentId = null, position = null, images = [] } = {}) {
  const parent = parentId ? getNode(parentId) : null;
  const center = viewportCenterBoard();

  const node = {
    id: `node-${state.nodeCounter++}`,
    type,
    title: "",
    content: "",
    tags: [],
    variants: [],
    audience: "",
    goal: "",
    channel: "",
    images: [...images],
    social: { platform: "Instagram", caption: "", hashtags: [], preview: "" },
    postits: [],
    justConnectedAt: null,
    position: position || {
      x: parent ? parent.position.x + 24 : center.x - NODE_WIDTH / 2,
      y: parent ? parent.position.y + 240 : center.y - NODE_HEIGHT / 2
    }
  };

  if (parent) {
    applyInherited(parent, node);
    if (node.type === "Social Media Posting" && node.images.length === 0) {
      node.images = [...parent.images];
    }
  }

  state.nodes.push(node);
  renderNode(node);
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
  runNetworkImpulse();
  forceNodeVisible(node.id);
  setTimeout(() => { forceNodeVisible(node.id); ensureNodeActuallyVisible(node); }, 30);
}

function removeNode(nodeId) {
  const idx = state.nodes.findIndex((n) => n.id === nodeId);
  if (idx === -1) return;

  const [removed] = state.nodes.splice(idx, 1);
  removed.images.forEach((img) => URL.revokeObjectURL(img.url));

  state.edges = state.edges.filter(([a, b]) => a !== nodeId && b !== nodeId);

  el.zoomLayer.querySelector(`[data-id='${nodeId}']`)?.remove();
  state.selectedIds.delete(nodeId);
  if (state.selectedPrimary === nodeId) state.selectedPrimary = null;

  updateSelectionClasses();
  fillInspector(state.selectedPrimary ? getNode(state.selectedPrimary) : null);
  updateListView();
  updateEmptyState();
  drawLinks();
}

function addEdge(fromId, toId) {
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
}

function parseList(value) {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function updateNodeCard(node) {
  const nodeEl = el.zoomLayer.querySelector(`[data-id='${node.id}']`);
  if (!nodeEl) return;

  const tone = NODE_TYPES[node.type]?.color || "#5f6a82";
  const isConnected = connectedIds().has(node.id);

  nodeEl.style.left = `${node.position.x}px`;
  nodeEl.style.top = `${node.position.y}px`;
  nodeEl.style.borderColor = `${tone}66`;
  nodeEl.style.boxShadow = isConnected ? `0 8px 18px ${tone}22` : "0 5px 10px rgba(80,80,120,0.08)";
  nodeEl.style.opacity = isConnected ? "1" : "0.9";
  nodeEl.classList.toggle("just-connected", !!node.justConnectedAt && Date.now() - node.justConnectedAt < 700);

  nodeEl.querySelector(".type").textContent = node.type;
  nodeEl.querySelector(".type").style.color = tone;
  nodeEl.querySelector(".title").textContent = node.title;
  nodeEl.querySelector(".content").textContent = node.content;

  const tags = [];
  if (node.channel) tags.push(`Channel: ${node.channel}`);
  if (node.goal) tags.push(`Goal: ${node.goal}`);
  if (node.audience) tags.push(`Audience: ${node.audience}`);
  tags.push(...node.tags);

  const tagsWrap = nodeEl.querySelector(".tags");
  tagsWrap.innerHTML = "";
  tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
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
  node.images.forEach((img) => {
    const thumb = document.createElement("button");
    thumb.type = "button";
    thumb.className = "image-thumb";

    const image = document.createElement("img");
    image.src = img.url;
    image.alt = img.name;

    const hint = document.createElement("span");
    hint.className = "zoom-hint";
    hint.textContent = "🔍";

    thumb.append(image, hint);
    thumb.addEventListener("click", (event) => {
      event.stopPropagation();
      thumb.classList.add("expanded");
    });
    thumb.addEventListener("mouseleave", () => thumb.classList.remove("expanded"));

    imageStrip.appendChild(thumb);
  });

  const social = nodeEl.querySelector(".social-preview");
  const isSocial = node.type === "Social Media Posting";
  social.classList.toggle("hidden", !isSocial);
  if (isSocial) {
    social.innerHTML = `<strong>${node.social.platform} Preview</strong><p>${node.social.caption || ""}</p><small>${node.social.hashtags.join(" ")}</small><em>${node.social.preview || ""}</em>`;
  }

  renderPostits(node, nodeEl);
}

function renderPostits(node, nodeEl) {
  nodeEl.querySelectorAll(".postit").forEach((p) => p.remove());

  node.postits.forEach((note) => {
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
    });

    const area = postit.querySelector(".postit-text");
    area.value = note.text;
    area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
    area.addEventListener("input", () => {
      note.text = area.value;
      area.style.fontSize = note.text.length > 220 ? "0.7rem" : note.text.length > 120 ? "0.82rem" : "0.96rem";
    });

    postit.querySelector(".postit-delete").addEventListener("click", () => {
      node.postits = node.postits.filter((n) => n.id !== note.id);
      renderPostits(node, nodeEl);
    });

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
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function fillInspector(node) {
  if (!node) {
    el.inspectorMeta.textContent = "Wähle oder erstelle einen Node.";
    el.nodeForm.reset();
    el.deleteNodeButton.disabled = true;
    el.socialFields.classList.add("hidden");
    el.contentUploadFields.classList.add("hidden");
    return;
  }

  el.inspectorMeta.textContent = `Bearbeite ${node.id}`;
  el.inputs.type.value = node.type;
  el.inputs.title.value = node.title;
  el.inputs.content.value = node.content;
  el.inputs.tags.value = node.tags.join(", ");
  el.inputs.variants.value = node.variants.join(", ");
  el.inputs.platform.value = node.social.platform;
  el.inputs.caption.value = node.social.caption;
  el.inputs.hashtags.value = node.social.hashtags.join(", ");
  el.inputs.preview.value = node.social.preview;
  el.inputs.audience.value = node.audience;
  el.inputs.goal.value = node.goal;
  el.inputs.channel.value = node.channel;

  el.deleteNodeButton.disabled = false;
  el.socialFields.classList.toggle("hidden", node.type !== "Social Media Posting");
  el.contentUploadFields.classList.toggle("hidden", !(node.type === "Content" || node.type === "Social Media Posting"));
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
    const append = event.shiftKey;
    if (!append) state.selectedIds.clear();
    state.selectedIds.add(node.id);
    state.selectedPrimary = node.id;
    updateSelectionClasses();
    fillInspector(node);
  });

  nodeEl.querySelector(".add-child-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    openTypePicker((type) => createNode({ type, parentId: node.id }), "Content");
  });

  nodeEl.querySelector(".connector-handle").addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();

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
        createNode({
          type: nodeType,
          position: { x: point.x - NODE_WIDTH / 2, y: point.y - NODE_HEIGHT / 2 }
        });
        const newNode = state.nodes[state.nodes.length - 1];
        if (state.nodes.length > prevCount && newNode) {
          addEdge(fromId, newNode.id);
        }
      }

      window.addEventListener("pointermove", move);
      el.canvas.addEventListener("click", place, true);
    }, "Content");
  });

  const title = nodeEl.querySelector(".title");
  const content = nodeEl.querySelector(".content");
  title.addEventListener("input", () => {
    node.title = title.textContent.trim();
    if (state.selectedPrimary === node.id) el.inputs.title.value = node.title;
    updateListView();
  });
  content.addEventListener("input", () => {
    node.content = content.textContent.trim();
    if (state.selectedPrimary === node.id) el.inputs.content.value = node.content;
  });

  enableNodeDrag(nodeEl, node);
  el.zoomLayer.appendChild(nodeEl);
  updateNodeCard(node);
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
    }

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  });
}

function toggleListMode(showList) {
  const shouldShowList = typeof showList === "boolean" ? showList : !el.canvas.classList.contains("hidden");
  el.canvas.classList.toggle("hidden", shouldShowList);
  el.boardListView.classList.toggle("hidden", !shouldShowList);
  el.toggleListViewButton.textContent = shouldShowList ? "Board View" : "List View";
}

// Events
el.addNodeButton.addEventListener("click", () => {
  toggleListMode(false);
  openTypePicker((type) => {
    const center = viewportCenterBoard();
    createNode({ type, position: { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 } });
  }, "Idea");
});

el.toggleListViewButton.addEventListener("click", () => {
  toggleListMode();
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
    el.canvas.scrollLeft += event.deltaX;
    el.canvas.scrollTop += event.deltaY;
  },
  { passive: false }
);

el.canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  const point = boardPointFromClient(event.clientX, event.clientY);
  state.contextBoardPoint = point;

  const rect = el.canvas.getBoundingClientRect();
  el.contextMenu.style.left = `${event.clientX - rect.left}px`;
  el.contextMenu.style.top = `${event.clientY - rect.top}px`;
  el.contextMenu.classList.remove("hidden");
});

document.addEventListener("click", (event) => {
  if (!el.contextMenu.contains(event.target)) el.contextMenu.classList.add("hidden");
});

el.addContextNodeButton.addEventListener("click", () => {
  el.contextMenu.classList.add("hidden");
  openTypePicker((type) => {
    const center = viewportCenterBoard();
    createNode({ type, position: { x: center.x - NODE_WIDTH / 2, y: center.y - NODE_HEIGHT / 2 } });
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
});

el.nodeForm.addEventListener("input", (event) => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;

  if (event.target === el.inputs.type) node.type = el.inputs.type.value;
  if (event.target === el.inputs.title) node.title = el.inputs.title.value.trim();
  if (event.target === el.inputs.content) node.content = el.inputs.content.value;
  if (event.target === el.inputs.tags) node.tags = parseList(el.inputs.tags.value);
  if (event.target === el.inputs.variants) node.variants = parseList(el.inputs.variants.value);
  if (event.target === el.inputs.platform) node.social.platform = el.inputs.platform.value;
  if (event.target === el.inputs.caption) node.social.caption = el.inputs.caption.value;
  if (event.target === el.inputs.hashtags) node.social.hashtags = parseList(el.inputs.hashtags.value);
  if (event.target === el.inputs.preview) node.social.preview = el.inputs.preview.value;
  if (event.target === el.inputs.audience) node.audience = el.inputs.audience.value.trim();
  if (event.target === el.inputs.goal) node.goal = el.inputs.goal.value.trim();
  if (event.target === el.inputs.channel) node.channel = el.inputs.channel.value.trim();

  updateNodeCard(node);
  updateListView();
  fillInspector(node);
});

el.imageUpload.addEventListener("change", () => {
  const node = getNode(state.selectedPrimary);
  if (!node) return;
  [...el.imageUpload.files]
    .filter((file) => file.type.startsWith("image/"))
    .forEach((file) => node.images.push({ id: crypto.randomUUID(), name: file.name, url: URL.createObjectURL(file) }));
  el.imageUpload.value = "";
  updateNodeCard(node);
});

el.deleteNodeButton.addEventListener("click", () => {
  if (!state.selectedPrimary) return;
  removeNode(state.selectedPrimary);
});

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

  const rect = el.canvas.getBoundingClientRect();
  const sx = event.clientX - rect.left;
  const sy = event.clientY - rect.top;

  const box = document.createElement("div");
  box.className = "selection-box";
  el.canvas.appendChild(box);

  function move(ev) {
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

    state.selectedIds.clear();
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
    fillInspector(state.selectedPrimary ? getNode(state.selectedPrimary) : null);
  }

  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
});

el.picker.addEventListener("click", (event) => {
  if (event.target === el.picker) el.picker.classList.add("hidden");
});

window.addEventListener("resize", drawLinks);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && state.connectorCreateMode) {
    state.connectorCreateMode = null;
    state.connectorGhostEl?.remove();
    state.connectorGhostEl = null;
    drawLinks();
  }
});

// init
setZoom(state.zoom);
updateEmptyState();
updateListView();
fillInspector(null);
toggleListMode(false);
