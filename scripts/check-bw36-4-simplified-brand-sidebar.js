#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");
const sidebar = require(path.join(root, "brand-sidebar.js"));
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const language = fs.readFileSync(path.join(root, "language.js"), "utf8");
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const A = { id: "a", name: "Acme 🚀", revision: 4, role: "viewer" };
const B = { id: "b", name: "Borealis", revision: 2, role: "editor" };
const base = { language: "en", catalog: [A, B], canChange: true };
const campaign = sidebar.project({ ...base, hasBoard: true, boardBrandId: "a", selectedBrandId: "b", updateAvailable: true });
assert.equal(campaign.id, "a", "Board association must override Workspace preference");
assert.equal(campaign.supporting, "Used by this campaign");
assert.equal(campaign.text.change, "Change campaign Brand");
assert.equal(sidebar.project({ ...base, selectedBrandId: "b" }).id, "b");
assert.equal(sidebar.project({ ...base, brandMode: true, viewedBrandId: "a" }).supporting, "Brand Profile");
assert.equal(sidebar.project({ ...base }).title, "No Brand selected");
assert.equal(sidebar.project({ ...base, accessDenied: true, hasBoard: true, boardBrandId: "a" }).title, "Brand unavailable");
assert.equal(sidebar.project({ ...base, hasBoard: true, hasLegacySnapshot: true }).reusable, false);
assert.equal(sidebar.initials("Über Cool 🚀"), "ÜC");
assert.equal(sidebar.avatarUrl({ brandDNA: { avatar: { userApproved: true, imageUrl: "https://images.example/logo.png" } } }), "https://images.example/logo.png");
assert.equal(sidebar.avatarUrl({ brandDNA: { avatar: { userApproved: false, imageUrl: "https://images.example/unapproved.png" } } }), "");

class Classes { constructor() { this.values = new Set(["hidden"]); } toggle(name, force) { force ? this.values.add(name) : this.values.delete(name); } }
class Node {
  constructor(doc) { this.ownerDocument = doc; this.children = []; this.classList = new Classes(); this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; }
  replaceChildren(...children) { this.children = children; }
  append(child) { this.children.push(child); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, fn) { this.listener = { type, fn }; }
}
const doc = { createElement() { return new Node(doc); } };
const elements = Object.fromEntries(["panel", "avatar", "name", "note", "status", "open", "change"].map((key) => [key, new Node(doc)]));
sidebar.render(elements, campaign, { brandCore: { brandDNA: { avatar: { userApproved: true, imageUrl: "https://images.example/logo.png" } } } });
assert.equal(elements.panel.dataset.brandState, "campaign");
assert.equal(elements.name.textContent, "Acme 🚀");
assert.equal(elements.avatar.children[0].textContent, "A🚀", "Brand identity without a logo uses initials, never the Brand Avatar");
assert.equal(elements.open.textContent, "Open Brand Profile");
assert.equal(elements.change.textContent, "Change campaign Brand");

assert.equal((html.match(/id="brand-identity-panel"/g) || []).length, 1, "one expanded panel boundary");
const panelStart = html.indexOf("id=\"brand-identity-panel\"");
const sidebarSlice = html.slice(panelStart, html.indexOf("<dialog class=\"brand-delete-dialog\"", panelStart));
assert(!sidebarSlice.includes("Current Board Brand"));
assert(!sidebarSlice.includes("Compare Brand Cores"));
assert(!sidebarSlice.includes("Board association is authoritative"));
assert(!sidebarSlice.includes("id=\"board-brand-association\""));
assert(html.indexOf("board-brand-core-compare-open") > html.indexOf("brand-workspace-detail"), "comparison entry remains outside panel");
assert(css.includes("max-height:180px") && css.includes("min-height:44px") && css.includes("forced-colors:active") && css.includes("prefers-reduced-motion:reduce"));
assert(app.includes("catalogBrand.revision > sourceRevision"), "existing revision/provenance drives status");
assert(app.includes("state.boardAccess?.canEdit === true"), "Board access still gates reassignment");
assert(!app.slice(app.indexOf("function renderBoardBrandAssociation"), app.indexOf("function openBoardBrandAssociation")).includes("fetch("), "render performs no refetch");
for (const value of Object.values(sidebar.TEXT.en).concat(Object.values(sidebar.TEXT.de))) assert(language.includes(JSON.stringify(value).slice(1, -1)) || Object.values(sidebar.TEXT.en).includes(value), `localized copy missing: ${value}`);
assert.equal(pkg.scripts["check:bw36.4"], "node scripts/check-bw36-4-simplified-brand-sidebar.js");
assert(!html.includes("brand-sidebar-provider") && !app.includes("BrandSidebarAI"));
console.log("BW-36.4 simplified Brand sidebar checks passed (58 acceptance boundaries; production projection + DOM fixture).");
