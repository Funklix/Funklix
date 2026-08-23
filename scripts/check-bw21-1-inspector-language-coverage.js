#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const language = require(path.join(root, "language.js"));
const app = read("app.js");
const html = read("index.html");
const workflow = read(".github/workflows/runtime-boot-safety.yml");

const inspector = html.slice(html.indexOf('<aside class="inspector"'), html.indexOf('<template id="node-template"'));
assert.ok(inspector.length > 1000, "Inspector markup must remain discoverable");
const staticKeys = [...inspector.matchAll(/data-i18n(?:-placeholder)?="([^"]+)"/g)].map((match) => match[1]);
const dynamicKeys = [
  "Select or create a node.", "Editing {id}", "Unassigned", "Collaborator", "Current owner",
  "Parents: {count} · Children: {children}", "Parent", "Child", "Scheduled", "Scheduled: {date} • {time}",
  "No images uploaded.", "Image preview", "Image", "Set as favorite", "Download", "Delete",
  "Read-only board", "No next step available", "Select a node", "Review selected node",
  "Suggested Fix", "Target Field", "Improvement", "Generating suggested fix...",
  "Could not generate a suggested fix.", "Dismiss", "Explanation", "No explanation provided.",
  "Apply", "Current Text", "Suggested Text"
];
const enumKeys = [
  "Draft", "In Review", "Needs Changes", "Approved", "Published", "Idea", "Campaign Variation", "Content",
  "Social Media Posting", "Landing Page", "Email Campaign", "Visual Concept", "Image Brief", "Awareness",
  "Lead Gen", "Conversion", "Community", "Education", "Campaign Strategy", "Interest", "Consideration",
  "Retention", "Professional", "Emotional", "Direct", "Premium", "Playful"
];
for (const key of new Set([...staticKeys, ...dynamicKeys, ...enumKeys])) {
  assert.strictEqual(language.t(key, "en"), key, `English canonical text changed: ${key}`);
  assert.ok(language.dictionaries.de[key], `Missing German Inspector translation: ${key}`);
}
assert.strictEqual(language.t("Safe English fallback", "de"), "Safe English fallback");
assert.doesNotMatch(language.t("Safe English fallback", "de"), /undefined|null|^[a-z]+\.[a-z.]+$/i);

// Active paths: base, Social, Content/image, Landing Page, AI workspace, scheduling, images and connected context.
[
  'node.type !== "Social Media Posting"', 'node.type === "Content"', 'node.type !== "Landing Page"',
  "renderInspectorImages(node)", "renderInspectorAiWorkspace(node)", "formatScheduleMeta", "getConnectedNodeContext"
].forEach((fragment) => assert.ok(app.includes(fragment), `Missing Inspector rendering path: ${fragment}`));
assert.match(inspector, /content-image-prompt-field[\s\S]*landing-page-fields[\s\S]*social-fields[\s\S]*content-upload-fields[\s\S]*content-format-field/);

// Display labels translate while canonical values stay in value/state/schema fields.
assert.match(app, /option\.value = type;[\s\S]*option\.dataset\.i18n = type/);
assert.match(app, /if \(option\.value\) option\.dataset\.i18n = option\.textContent\.trim\(\)/);
for (const value of ["Draft", "Approved", "Social Media Posting", "Landing Page"]) assert.ok(app.includes(`"${value}"`));

// The language lifecycle has one registered change handler and a form-preserving refresh with no persistence.
assert.strictEqual((app.match(/uiLanguageSelect\?\.addEventListener\("change"/g) || []).length, 1);
assert.match(app, /translateInterface\(document\);\s*refreshOpenInspectorLanguage\(\);/);
const refresh = app.slice(app.indexOf("function refreshOpenInspectorLanguage"), app.indexOf("function getConnectedSocialPostingNodes"));
assert.doesNotMatch(refresh, /\.value\s*=|dispatchEvent|saveCampaignCanvasState|markUnsaved|autosave|selectedPrimary\s*=|selectedIds\./);
assert.match(refresh, /populateOwnerSelect\(node\)/);
assert.match(refresh, /renderInspectorImages\(node\)[\s\S]*renderInspectorAiWorkspace\(node\)[\s\S]*updateInspectorActionVisibility\(\)/);

// User/generated values are assigned verbatim and never passed through uiText.
for (const assignment of [
  "el.inputs.title.value = node.title", "el.inputs.content.value = node.content",
  "el.inputs.caption.value = node.social.caption", "improvementText.textContent = preview.improvementText",
  "explanationText.textContent = preview.explanation", "name.textContent = img.name"
]) assert.ok(app.includes(assignment), `Missing content boundary: ${assignment}`);
assert.doesNotMatch(app, /uiText\((?:node\.(?:title|content)|preview\.(?:improvementText|explanation|suggestedContent)|img\.name)/);

// BW-21 remains separate and this check is registered directly after it.
assert.match(workflow, /check-bw21-language-separation\.js[\s\S]*check-bw21-1-inspector-language-coverage\.js/);
assert.ok(workflow.indexOf("check-bw21-language-separation.js") < workflow.indexOf("check-bw21-1-inspector-language-coverage.js"));
assert.match(html, /language\.js[\s\S]*app\.js/);
console.log("BW-21.1 Inspector language coverage checks passed.");
