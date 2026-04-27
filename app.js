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
const addNodeButton = document.getElementById("add-node-btn");
const emptyState = document.getElementById("empty-state");

const zoomInButton = document.getElementById("zoom-in-btn");
const zoomOutButton = document.getElementById("zoom-out-btn");
const zoomLabel = document.getElementById("zoom-label");

const inspectorMeta = document.getElementById("inspector-meta");
const nodeForm = document.getElementById("node-form");
const socialFields = document.getElementById("social-fields");
const deleteNodeButton = document.getElementById("delete-node-btn");

const commentsList = document.getElementById("comments-list");
const commentUser = document.getElementById("comment-user");
const commentText = document.getElementById("comment-text");
const addCommentButton = document.getElementById("add-comment-btn");

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
    comments: [],
    level: parent ? parent.level + 1 : 0,
    position: {
      x: parent ? parent.position.x + 20 : 220 + (nodes.length % 3) * 320,
      y: parent ? parent.position.y + 230 : 80 + Math.floor(nodes.length / 3) * 220
    }
  };

  nodes.push(node);
  renderNode(node);

  if (parent) {
    addEdge(parent.id, node.id);
  }

  setEmptyStateVisibility();
  selectNode(node.id);
  drawLinks();
  return node;
}

function addEdge(from, to) {
  if (from === to) return;
  const exists = edges.some((edge) => edge[0] === from && edge[1] === to);
  if (!exists) edges.push([from, to]);

  const source = getNode(from);
  const target = getNode(to);
  if (source && target) {
    target.level = Math.max(target.level, source.level + 1);
    target.position.y = Math.max(target.position.y, source.position.y + 210);
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
  drawLinks();
}

function colorForType(type) {
  return NODE_TYPES[type]?.color || "#5f6a82";
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
}

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  const selected = getNode(nodeId);

  zoomLayer
    .querySelectorAll(".node")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === nodeId));

  fillInspector(selected);
  renderComments(selected);
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

function renderComments(node) {
  commentsList.innerHTML = "";

  if (!node) {
    commentsList.innerHTML = `<p class="comment-empty">Keine Node ausgewählt.</p>`;
    return;
  }

  if (node.comments.length === 0) {
    commentsList.innerHTML = `<p class="comment-empty">Noch keine Kommentare vorhanden.</p>`;
    return;
  }

  node.comments.forEach((comment) => {
    const card = document.createElement("article");
    card.className = "comment-card";
    card.innerHTML = `
      <header>
        <strong>${comment.user}</strong>
        <time>${comment.date}</time>
      </header>
      <p>${comment.text}</p>
    `;
    commentsList.appendChild(card);
  });
}

function enableDragging(element, node) {
  const handle = element.querySelector(".drag-handle");

  handle.addEventListener("pointerdown", (event) => {
    event.preventDefault();
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

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const midpointY = (a.y + b.y) / 2;

    line.setAttribute(
      "d",
      `M ${a.x} ${a.y} C ${a.x} ${midpointY}, ${b.x} ${midpointY}, ${b.x} ${b.y}`
    );
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#8f80ff");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    links.appendChild(line);
  });
}

zoomLayer.addEventListener("click", (event) => {
  const targetNode = event.target.closest(".node");
  if (!targetNode || !sourceForConnection) return;

  const toId = targetNode.dataset.id;
  addEdge(sourceForConnection, toId);
  sourceForConnection = null;
  drawLinks();
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
});

addCommentButton.addEventListener("click", () => {
  if (!selectedNodeId) return;

  const node = getNode(selectedNodeId);
  if (!node) return;

  const user = commentUser.value.trim() || "Anonymous";
  const text = commentText.value.trim();
  if (!text) return;

  node.comments.unshift({
    user,
    text,
    date: formatDate(new Date())
  });

  commentText.value = "";
  renderComments(node);
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
  zoom = Math.min(1.8, Math.max(0.5, nextZoom));
  zoomLayer.style.transform = `scale(${zoom})`;
  zoomLayer.style.transformOrigin = "0 0";
  zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
}

zoomInButton.addEventListener("click", () => setZoom(zoom + 0.1));
zoomOutButton.addEventListener("click", () => setZoom(zoom - 0.1));
window.addEventListener("resize", drawLinks);

populateTypeSelect();
fillInspector(null);
renderComments(null);
setEmptyStateVisibility();
setZoom(1);
drawLinks();
