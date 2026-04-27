const nodes = [];
const edges = [];

const canvas = document.getElementById("canvas");
const links = document.getElementById("links");
const template = document.getElementById("node-template");
const addNodeButton = document.getElementById("add-node-btn");
const emptyState = document.getElementById("empty-state");

const inspectorMeta = document.getElementById("inspector-meta");
const nodeForm = document.getElementById("node-form");
const deleteNodeButton = document.getElementById("delete-node-btn");

const inputs = {
  type: document.getElementById("node-type"),
  title: document.getElementById("node-title"),
  content: document.getElementById("node-content"),
  tags: document.getElementById("node-tags"),
  variants: document.getElementById("node-variants")
};

let nodeCounter = 1;
let selectedNodeId = null;

function setEmptyStateVisibility() {
  emptyState.hidden = nodes.length > 0;
}

function createNewNode() {
  const node = {
    id: `node-${nodeCounter++}`,
    type: "Idea",
    title: "Neue Node",
    content: "Klicke hier oder im Inspector, um Inhalte zu bearbeiten.",
    tags: [],
    variants: [],
    position: {
      x: 220 + (nodes.length % 3) * 320,
      y: 80 + Math.floor(nodes.length / 3) * 220
    }
  };

  nodes.push(node);
  renderNode(node);
  setEmptyStateVisibility();
  selectNode(node.id);
  drawLinks();
}

function updateNodeCard(node) {
  const element = canvas.querySelector(`[data-id="${node.id}"]`);
  if (!element) return;

  element.style.left = `${node.position.x}px`;
  element.style.top = `${node.position.y}px`;
  element.querySelector(".type").textContent = node.type || "Node";
  element.querySelector(".title").textContent = node.title;
  element.querySelector(".content").textContent = node.content;

  const tagsContainer = element.querySelector(".tags");
  tagsContainer.innerHTML = "";
  node.tags.forEach((tag) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagsContainer.appendChild(span);
  });

  const variantsContainer = element.querySelector(".ab-tests");
  variantsContainer.innerHTML = "";
  node.variants.forEach((variant) => {
    const span = document.createElement("span");
    span.className = "variant";
    span.textContent = variant;
    variantsContainer.appendChild(span);
  });
}

function parseList(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function fillInspector(node) {
  if (!node) {
    inspectorMeta.textContent = "Wähle oder erstelle einen Node.";
    nodeForm.reset();
    deleteNodeButton.disabled = true;
    return;
  }

  inspectorMeta.textContent = `Bearbeite ${node.id}`;
  inputs.type.value = node.type;
  inputs.title.value = node.title;
  inputs.content.value = node.content;
  inputs.tags.value = node.tags.join(", ");
  inputs.variants.value = node.variants.join(", ");
  deleteNodeButton.disabled = false;
}

function selectNode(nodeId) {
  selectedNodeId = nodeId;
  const selected = nodes.find((node) => node.id === nodeId) || null;

  document
    .querySelectorAll(".node")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === nodeId));

  fillInspector(selected);
}

function enableDragging(element, node) {
  const handle = element.querySelector(".drag-handle");

  const onPointerDown = (event) => {
    event.preventDefault();
    selectNode(node.id);

    const startX = event.clientX;
    const startY = event.clientY;
    const originX = node.position.x;
    const originY = node.position.y;

    function onPointerMove(moveEvent) {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      node.position.x = Math.max(10, originX + deltaX);
      node.position.y = Math.max(10, originY + deltaY);
      element.style.left = `${node.position.x}px`;
      element.style.top = `${node.position.y}px`;
      drawLinks();
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  handle.addEventListener("pointerdown", onPointerDown);
}

function renderNode(node) {
  const element = template.content.firstElementChild.cloneNode(true);
  element.dataset.id = node.id;

  element.addEventListener("click", () => selectNode(node.id));

  const titleElement = element.querySelector(".title");
  const contentElement = element.querySelector(".content");

  titleElement.addEventListener("input", () => {
    node.title = titleElement.textContent.trim() || "Neue Node";
    if (selectedNodeId === node.id) inputs.title.value = node.title;
  });

  contentElement.addEventListener("input", () => {
    node.content = contentElement.textContent.trim();
    if (selectedNodeId === node.id) inputs.content.value = node.content;
  });

  canvas.appendChild(element);
  enableDragging(element, node);
  updateNodeCard(node);
}

function centerOf(nodeId) {
  const el = canvas.querySelector(`[data-id="${nodeId}"]`);
  if (!el) return null;

  return {
    x: el.offsetLeft + el.offsetWidth / 2,
    y: el.offsetTop + el.offsetHeight / 2
  };
}

function drawLinks() {
  links.innerHTML = "";

  edges.forEach(([from, to]) => {
    const a = centerOf(from);
    const b = centerOf(to);
    if (!a || !b) return;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const mid = (a.y + b.y) / 2;
    line.setAttribute(
      "d",
      `M ${a.x} ${a.y} C ${a.x} ${mid}, ${b.x} ${mid}, ${b.x} ${b.y}`
    );
    line.setAttribute("fill", "none");
    line.setAttribute("stroke", "#8f80ff");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-linecap", "round");
    links.appendChild(line);
  });
}

nodeForm.addEventListener("input", (event) => {
  if (!selectedNodeId) return;
  const selected = nodes.find((node) => node.id === selectedNodeId);
  if (!selected) return;

  if (event.target === inputs.type) selected.type = inputs.type.value.trim() || "Node";
  if (event.target === inputs.title) selected.title = inputs.title.value.trim() || "Neue Node";
  if (event.target === inputs.content) selected.content = inputs.content.value;
  if (event.target === inputs.tags) selected.tags = parseList(inputs.tags.value);
  if (event.target === inputs.variants) selected.variants = parseList(inputs.variants.value);

  updateNodeCard(selected);
});

deleteNodeButton.addEventListener("click", () => {
  if (!selectedNodeId) return;

  const index = nodes.findIndex((node) => node.id === selectedNodeId);
  if (index === -1) return;

  const [removed] = nodes.splice(index, 1);
  const card = canvas.querySelector(`[data-id="${removed.id}"]`);
  if (card) card.remove();

  selectedNodeId = null;
  fillInspector(null);
  setEmptyStateVisibility();
  drawLinks();
});

addNodeButton.addEventListener("click", createNewNode);
window.addEventListener("resize", drawLinks);
fillInspector(null);
setEmptyStateVisibility();
drawLinks();
