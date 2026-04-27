const nodes = [
  {
    id: "idea",
    type: "Idea",
    title: "Solar Product Launch",
    content:
      "Launch our new solar product for homeowners who want to save money and live sustainably.",
    tags: ["Audience: Eco-conscious homeowners", "Goal: Product Launch"],
    variants: ["In progress"],
    position: { x: 560, y: 40 },
    comments: ["Focus on confidence + optimism", "Assign design moodboard"]
  },
  {
    id: "angle1",
    type: "Angle",
    title: "Save money long-term",
    content: "Lower bills. More savings.",
    tags: ["AI generated"],
    variants: ["A: Cost focus", "B: Family security"],
    position: { x: 300, y: 280 },
    comments: ["Test with ROI calculator CTA"]
  },
  {
    id: "angle2",
    type: "Angle",
    title: "Sustainable living",
    content: "Clean energy. Better planet.",
    tags: ["AI generated"],
    variants: ["A: Planet impact", "B: Local community"],
    position: { x: 620, y: 280 },
    comments: ["Create visual prompt with nature light"]
  },
  {
    id: "angle3",
    type: "Angle",
    title: "Energy independence",
    content: "Power your home. Your way.",
    tags: ["AI generated"],
    variants: ["A: Resilience", "B: Autonomy"],
    position: { x: 940, y: 280 },
    comments: ["Integrate UGC hook on electricity costs"]
  },
  {
    id: "social",
    type: "Social",
    title: "LinkedIn + Instagram",
    content: "Generate post series for awareness and conversion.",
    tags: ["Multi-channel", "Content batch"],
    variants: ["A/B Headline", "A/B CTA"],
    position: { x: 260, y: 540 },
    comments: ["Adapt tone for founders & families"]
  },
  {
    id: "ads",
    type: "Ads",
    title: "Ad Copy",
    content: "Primary text, headline and hook variants for paid channels.",
    tags: ["Meta", "Google", "TikTok"],
    variants: ["A: Savings", "B: Future-proof"],
    position: { x: 580, y: 540 },
    comments: ["Improve for mobile-first scannability"]
  },
  {
    id: "ugc",
    type: "UGC",
    title: "UGC Script",
    content: "Problem → solution → CTA scripts for creator collabs.",
    tags: ["Creator brief", "Storyboard"],
    variants: ["A: Direct response", "B: Story-led"],
    position: { x: 900, y: 540 },
    comments: ["Assign to creator manager"]
  },
  {
    id: "insights",
    type: "Insights",
    title: "Performance feedback loop",
    content: "Import results, rank top variants, and auto-suggest next iteration.",
    tags: ["CTR", "CPA", "Engagement"],
    variants: ["Top performer: Angle 1"],
    position: { x: 580, y: 760 },
    comments: ["Auto-adapt winning message to TikTok"]
  }
];

const edges = [
  ["idea", "angle1"],
  ["idea", "angle2"],
  ["idea", "angle3"],
  ["angle1", "social"],
  ["angle2", "ads"],
  ["angle3", "ugc"],
  ["social", "insights"],
  ["ads", "insights"],
  ["ugc", "insights"]
];

const canvas = document.getElementById("canvas");
const links = document.getElementById("links");
const template = document.getElementById("node-template");

function createNode(node) {
  const element = template.content.firstElementChild.cloneNode(true);
  element.dataset.id = node.id;
  element.style.left = `${node.position.x}px`;
  element.style.top = `${node.position.y}px`;

  element.querySelector(".type").textContent = node.type;
  element.querySelector(".title").textContent = node.title;
  element.querySelector(".content").textContent = node.content;

  const tags = element.querySelector(".tags");
  node.tags.forEach((item) => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = item;
    tags.appendChild(span);
  });

  const variants = element.querySelector(".ab-tests");
  node.variants.forEach((item) => {
    const span = document.createElement("span");
    span.className = "variant";
    span.textContent = item;
    variants.appendChild(span);
  });

  element.addEventListener("click", () => selectNode(node.id));
  canvas.appendChild(element);
}

function centerOf(nodeId) {
  const el = canvas.querySelector(`[data-id="${nodeId}"]`);
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

function selectNode(nodeId) {
  const selected = nodes.find((node) => node.id === nodeId);
  document
    .querySelectorAll(".node")
    .forEach((el) => el.classList.toggle("selected", el.dataset.id === nodeId));

  document.getElementById("inspector-title").textContent = `${selected.type} Node`;
  document.getElementById("inspector-meta").textContent = selected.title;

  const comments = document.getElementById("comments");
  comments.innerHTML = selected.comments
    .map((comment, index) => `<p>${index + 1}. ${comment}</p>`)
    .join("");
}

nodes.forEach(createNode);
window.addEventListener("resize", drawLinks);
requestAnimationFrame(drawLinks);
selectNode("idea");
