const NODE_TYPES = {
  Idea: { color: "#6b4eff" },
  "Campaign Variation": { color: "#2f7ef7" },
  Content: { color: "#16a47b" },
  "Social Media Posting": { color: "#f56f46" },
  "Landing Page": { color: "#a04ad8" },
  "Email Campaign": { color: "#d8961a" }
};

const nodes = [];
const edges = [];

const canvas = document.getElementById("canvas");
const zoomLayer = document.getElementById("zoom-layer");
const links = document.getElementById("links");
const template = document.getElementById("node-template");
const postitTemplate = document.getElementById("postit-template");
const emptyState = document.getElementById("empty-state");
const nodeListView = document.getElementById("node-list-view");

const addNodeButton = document.getElementById("add-node-btn");
const zoomInButton = document.getElementById("zoom-in-btn");
const zoomOutButton = document.getElementById("zoom-out-btn");
const zoomLabel = document.getElementById("zoom-label");

const contextMenu = document.getElementById("context-menu");
const addPostitCommentButton = document.getElementById("add-postit-comment-btn");

const inspectorMeta = document.getElementById("inspector-meta");
const nodeForm = document.getElementById("node-form");
const socialFields = document.getElementById("social-fields");
const deleteNodeButton = document.getElementById("delete-node-btn");

const inputs = {
  type: document.getElementById("node-type"),
  title: document.getElementById("node-title"),
  content: document.getElementById("node-content"),
  tags: document.getElementById("node-tags"),
  variants: document.getElementById("node-variants"),
  platform: document.getElementById("node-platform"),
  caption: document.getElementById("node-caption"),
  hashtags: document.getElementById("node-hashtags"),
  preview: document.getElementById("node-preview")
};

let nodeCounter = 1;
let selectedNodeId = null;
let sourceForConnection = null;
let zoom = 1;
let contextPosition = { x: 0, y: 0 };

function populateTypeSelect() {
  Object.keys(NODE_TYPES).forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.textContent = type;
    inputs.type.appendChild(option);
  });
}

function setEmptyStateVisibility() {
  emptyState.hidden = nodes.length > 0;
}

function parseList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function formatDate(date) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

function getNode(nodeId) {
  return nodes.find((node) => node.id === nodeId) || null;
}

function colorForType(type) {
  return NODE_TYPES[type]?.color || "#5f6a82";
}

function showContextMenu(clientX, clientY) {
  const canvasRect = canvas.getBoundingClientRect();
  const x = Math.max(12, Math.min(clientX - canvasRect.left, canvasRect.width - 220));
  const y = Math.max(12, Math.min(clientY - canvasRect.top, canvasRect.height - 80));

  contextPosition = { x, y };
  contextMenu.style.left = `${x}px`;
  contextMenu.style.top = `${y}px`;
  contextMenu.classList.remove("hidden");
}

function hideContextMenu() {
  contextMenu.classList.add("hidden");
}

function updateListView() {
  nodeListView.innerHTML = "";

  const grouped = nodes.reduce((acc, node) => {
    if (!acc[node.type]) acc[node.type] = [];
    acc[node.type].push(node);
    return acc;
  }, {});

  if (Object.keys(grouped).length === 0) {
    nodeListView.innerHTML = '<p class="list-empty">Keine Nodes vorhanden.</p>';
    return;
  }

  Object.keys(grouped)
    .sort()
    .forEach((type) => {
      const block = document.createElement("section");
      block.className = "list-group";

      const title = document.createElement("h4");
      title.textContent = `${type} (${grouped[type].length})`;
      title.style.color = colorForType(type);
      block.appendChild(title);

      const list = document.createElement("ul");
      grouped[type].forEach((node) => {
        const item = document.createElement("li");
        item.textContent = node.title;
        item.addEventListener("click", () => selectNode(node.id));
        list.appendChild(item);
      });

      block.appendChild(list);
      nodeListView.appendChild(block);
    });
}

function createNode({ type = "Idea", parentId = null } = {}) {
  const parent = parentId ? getNode(parentId) : null;

  const node = {
    id: `node-${nodeCounter++}`,
    type,
    title: type,
    content: "Inhalt bearbeiten...",
    tags: [],
    variants: [],
    social: {
      platform: "Instagram",
      caption: "",
      hashtags: [],
      preview: ""
    },
    postits: [],
    level: parent ? parent.level + 1 : 0,
    position: {
      x: parent ? parent.position.x + 24 : 120 + (nodes.length % 3) * 290,
      y: parent ? parent.position.y + 210 : 80 + Math.floor(nodes.length / 3) * 210
    }
  };

  nodes.push(node);
  renderNode(node);

  if (parent) addEdge(parent.id, node.id);

  setEmptyStateVisibility();
  updateListView();
  selectNode(node.id);
  drawLinks();
}

function addEdge(from, to) {
  if (from === to) return;
  if (edges.some((edge) => edge[0] === from && edge[1] === to)) return;
  edges.push([from, to]);

  const source = getNode(from);
  const target = getNode(to);
  if (source && target) {
    target.level = Math.max(target.level, source.level + 1);
    target.position.y = Math.max(target.position.y, source.position.y + 190);
    updateNodeCard(target);
  }
}

function removeNode(nodeId) {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index === -1) return;

  nodes.splice(index, 1);
  const element = zoomLayer.querySelector(`[data-id="${nodeId}"]`);
  if (element) element.remove();

  for (let i = edges.length - 1; i >= 0; i -= 1) {
    if (edges[i][0] === nodeId || edges[i][1] === nodeId) edges.splice(i, 1);
  }

  if (selectedNodeId === nodeId) {
    selectedNodeId = null;
    fillInspector(null);
  }

  setEmptyStateVisibility();
  updateListView();
  drawLinks();
}

function postitFontSize(text) {
  const length = text.length;
  if (length > 280) return "0.66rem";
  if (length > 180) return "0.76rem";
  if (length > 100) return "0.86rem";
  return "0.96rem";
}

function renderPostits(node, element) {
  element.querySelectorAll(".postit").forEach((note) => note.remove());

  node.postits.forEach((postit) => {
    const note = postitTemplate.content.firstElementChild.cloneNode(true);
    note.style.left = `${postit.x}px`;
    note.style.top = `${postit.y}px`;
    note.style.background = postit.color;

    note.querySelector(".postit-user").textContent = postit.user;
    note.querySelector(".postit-time").textContent = postit.time;

    const colorInput = note.querySelector(".postit-color");
    colorInput.value = postit.color;
    colorInput.addEventListener("input", () => {
      postit.color = colorInput.value;
      note.style.background = postit.color;
    });

    const textArea = note.querySelector(".postit-text");
    textArea.value = postit.text;
    textArea.style.fontSize = postitFontSize(postit.text);
    textArea.addEventListener("input", () => {
      postit.text = textArea.value;
      textArea.style.fontSize = postitFontSize(postit.text);
    });

    element.appendChild(note);
  });
}

function updateNodeCard(node) {
  const element = zoomLayer.querySelector(`[data-id="${node.id}"]`);
  if (!element) return;

  const tone = colorForType(node.type);
  element.style.left = `${node.position.x}px`;
  element.style.top = `${node.position.y}px`;
  element.style.borderColor = `${tone}66`;
  element.style.boxShadow = `0 8px 18px ${tone}22`;

  const typeElement = element.querySelector(".type");
  typeElement.textContent = node.type;
  typeElement.style.color = tone;

  element.querySelector(".title").textContent = node.title;
  element.querySelector(".content").textContent = node.content;

  const tagsContainer = element.querySelector(".tags");
  tagsContainer.innerHTML = "";
  node.tags.forEach((tag) => {
    const chip = document.createElement("span");
    chip.className = "tag";
    chip.textContent = tag;
    tagsContainer.appendChild(chip);
  });

  const variantsContainer = element.querySelector(".ab-tests");
  variantsContainer.innerHTML = "";
  node.variants.forEach((variant) => {
    const chip = document.createElement("span");
    chip.className = "variant";
    chip.textContent = variant;
    variantsContainer.appendChild(chip);
  });

  const socialPreview = element.querySelector(".social-preview");
  const isSocial = node.type === "Social Media Posting";
  socialPreview.classList.toggle("hidden", !isSocial);
  if (isSocial) {
    const hashtags = node.social.hashtags.join(" ");
    socialPreview.innerHTML = `
      <strong>${node.social.platform} Preview</strong>
      <p>${node.social.caption || "Keine Caption"}</p>
      <small>${hashtags}</small>
      <em>${node.social.preview || "Kein Preview-Text"}</em>
    `;
  }

  renderPostits(node, element);
}

function fillInspector(node) {
  if (!node) {
    inspectorMeta.textContent = "Wähle oder erstelle einen Node.";
    nodeForm.reset();
    deleteNodeButton.disabled = true;
    socialFields.classList.add("hidden");
    return;
  }

  inspectorMeta.textContent = `Bearbeite ${node.id} (Level ${node.level})`;
  inputs.type.value = node.type;
  inputs.title.value = node.title;
  inputs.content.value = node.content;
  inputs.tags.value = node.tags.join(", ");
  inputs.variants.value = node.variants.join(", ");
  inputs.platform.value = node.social.platform;
  inputs.caption.value = node.social.caption;
  inputs.hashtags.value = node.social.hashtags.join(", ");
  inputs.preview.value = node.social.preview;
  deleteNodeButton.disabled = false;

  socialFields.classList.toggle("hidden", node.type !== "Social Media Posting");
}

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  const selected = getNode(nodeId);

  zoomLayer
    .querySelectorAll(".node")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === nodeId));

  fillInspector(selected);
}

function enableDragging(element, node) {
  element.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;

    const interactive = event.target.closest("button, input, textarea, select");
    if (interactive) return;

    const editable = event.target.closest("[contenteditable='true']");
    if (editable) return;

    selectNode(node.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = node.position.x;
    const originY = node.position.y;

    function onMove(moveEvent) {
      const deltaX = (moveEvent.clientX - startX) / zoom;
      const deltaY = (moveEvent.clientY - startY) / zoom;
      node.position.x = Math.max(10, originX + deltaX);
      node.position.y = Math.max(10, originY + deltaY);
      updateNodeCard(node);
      drawLinks();
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  });
}

function renderNode(node) {
  const element = template.content.firstElementChild.cloneNode(true);
  element.dataset.id = node.id;
  element.addEventListener("click", () => selectNode(node.id));

  const titleElement = element.querySelector(".title");
  const contentElement = element.querySelector(".content");

  titleElement.addEventListener("input", () => {
    node.title = titleElement.textContent.trim() || node.type;
    if (selectedNodeId === node.id) inputs.title.value = node.title;
    updateListView();
  });

  contentElement.addEventListener("input", () => {
    node.content = contentElement.textContent.trim();
    if (selectedNodeId === node.id) inputs.content.value = node.content;
  });

  element.querySelector(".add-child-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    const type = window.prompt(
      "Neuen Node-Typ eingeben: Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign",
      "Content"
    );

    const finalType = NODE_TYPES[type] ? type : "Content";
    createNode({ type: finalType, parentId: node.id });
  });

  element.querySelector(".connect-btn").addEventListener("click", (event) => {
    event.stopPropagation();
    sourceForConnection = node.id;
    inspectorMeta.textContent = `Verbindungsmodus: Zielnode anklicken für ${node.id}`;
  });

  zoomLayer.appendChild(element);
  enableDragging(element, node);
  updateNodeCard(node);
}

function centerOf(nodeId) {
  const element = zoomLayer.querySelector(`[data-id="${nodeId}"]`);
  if (!element) return null;

  return {
    x: element.offsetLeft + element.offsetWidth / 2,
    y: element.offsetTop + element.offsetHeight / 2
  };
}

function drawLinks() {
  links.innerHTML = "";

  edges.forEach(([from, to]) => {
    const a = centerOf(from);
    const b = centerOf(to);
    if (!a || !b) return;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const midpointY = (a.y + b.y) / 2;
    path.setAttribute(
      "d",
      `M ${a.x} ${a.y} C ${a.x} ${midpointY}, ${b.x} ${midpointY}, ${b.x} ${b.y}`
    );
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "#8f80ff");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    links.appendChild(path);
  });
}

zoomLayer.addEventListener("click", (event) => {
  const targetNode = event.target.closest(".node");
  if (!targetNode || !sourceForConnection) return;

  addEdge(sourceForConnection, targetNode.dataset.id);
  sourceForConnection = null;
  drawLinks();
});

canvas.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  showContextMenu(event.clientX, event.clientY);
});

document.addEventListener("click", (event) => {
  if (!contextMenu.contains(event.target)) hideContextMenu();
});

addPostitCommentButton.addEventListener("click", () => {
  hideContextMenu();
  if (!selectedNodeId) return;

  const node = getNode(selectedNodeId);
  if (!node) return;

  const user =
    window.prompt("Nutzername für den Kommentar:", "Felix")?.trim() ||
    "Anonymous";

  node.postits.push({
    id: crypto.randomUUID(),
    user,
    time: formatDate(new Date()),
    text: "",
    color: "#ffe082",
    x: contextPosition.x / zoom - node.position.x + 24,
    y: contextPosition.y / zoom - node.position.y + 24
  });

  updateNodeCard(node);
});

nodeForm.addEventListener("input", (event) => {
  if (!selectedNodeId) return;
  const selected = getNode(selectedNodeId);
  if (!selected) return;

  if (event.target === inputs.type) selected.type = inputs.type.value;
  if (event.target === inputs.title) selected.title = inputs.title.value.trim() || selected.type;
  if (event.target === inputs.content) selected.content = inputs.content.value;
  if (event.target === inputs.tags) selected.tags = parseList(inputs.tags.value);
  if (event.target === inputs.variants) selected.variants = parseList(inputs.variants.value);

  if (event.target === inputs.platform) selected.social.platform = inputs.platform.value;
  if (event.target === inputs.caption) selected.social.caption = inputs.caption.value;
  if (event.target === inputs.hashtags) selected.social.hashtags = parseList(inputs.hashtags.value);
  if (event.target === inputs.preview) selected.social.preview = inputs.preview.value;

  socialFields.classList.toggle("hidden", selected.type !== "Social Media Posting");
  updateNodeCard(selected);
  updateListView();
});

deleteNodeButton.addEventListener("click", () => {
  if (!selectedNodeId) return;
  removeNode(selectedNodeId);
});

addNodeButton.addEventListener("click", () => {
  const type = window.prompt(
    "Node-Typ auswählen: Idea, Campaign Variation, Content, Social Media Posting, Landing Page, Email Campaign",
    "Idea"
  );

  const finalType = NODE_TYPES[type] ? type : "Idea";
  createNode({ type: finalType });
});

function setZoom(nextZoom) {
  zoom = Math.min(1.6, Math.max(0.7, nextZoom));
  zoomLayer.style.transform = `scale(${zoom})`;
  zoomLayer.style.transformOrigin = "0 0";
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

zoomInButton.addEventListener("click", () => setZoom(zoom + 0.1));
zoomOutButton.addEventListener("click", () => setZoom(zoom - 0.1));
window.addEventListener("resize", drawLinks);

populateTypeSelect();
fillInspector(null);
setEmptyStateVisibility();
updateListView();
setZoom(1);
drawLinks();
