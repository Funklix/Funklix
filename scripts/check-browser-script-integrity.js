#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");

const repoRoot = path.resolve(__dirname, "..");
const failures = [];

function fail(file, reason) {
  failures.push(`${file}: ${reason}`);
}

function stripCommentsAndStrings(source) {
  // Lightweight scanner: preserves code-shaped text while replacing comments and
  // string/template contents with spaces. This is not a full JavaScript parser;
  // it is intentionally scoped to top-level lexical declaration detection.
  let output = "";
  let i = 0;
  let state = "code";
  let quote = "";
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (state === "code") {
      if (char === "/" && next === "/") { state = "lineComment"; output += "  "; i += 2; continue; }
      if (char === "/" && next === "*") { state = "blockComment"; output += "  "; i += 2; continue; }
      if (char === "\"" || char === "'" || char === "`") { state = "string"; quote = char; output += " "; i += 1; continue; }
      output += char;
      i += 1;
      continue;
    }
    if (state === "lineComment") {
      output += char === "\n" ? "\n" : " ";
      if (char === "\n") state = "code";
      i += 1;
      continue;
    }
    if (state === "blockComment") {
      output += char === "\n" ? "\n" : " ";
      if (char === "*" && next === "/") { output += " "; i += 2; state = "code"; } else i += 1;
      continue;
    }
    if (state === "string") {
      output += char === "\n" ? "\n" : " ";
      if (char === "\\") { output += next === "\n" ? "\n" : " "; i += 2; continue; }
      if (char === quote) state = "code";
      i += 1;
    }
  }
  return output;
}

function countTopLevelLexicalDeclarations(source, identifier) {
  const sanitized = stripCommentsAndStrings(source);
  const escapedIdentifier = identifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokenRe = new RegExp(`\\b(?:const|let)\\s+${escapedIdentifier}\\b|[{}()[\\]]`, "g");
  let depth = 0;
  let count = 0;
  let match;
  while ((match = tokenRe.exec(sanitized))) {
    const token = match[0];
    if (token === "{" || token === "(" || token === "[") depth += 1;
    else if (token === "}" || token === ")" || token === "]") depth = Math.max(0, depth - 1);
    else if (depth === 0) count += 1;
  }
  return count;
}

function extractLocalClassicScripts(html) {
  const scripts = [];
  const scriptRe = /<script\b([^>]*)>/gi;
  let match;
  while ((match = scriptRe.exec(html))) {
    const attrs = match[1] || "";
    const srcMatch = attrs.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
    if (!srcMatch) continue;
    if (/\btype\s*=\s*(["'])module\1/i.test(attrs)) continue;
    const src = srcMatch[2];
    if (/^(?:https?:)?\/\//i.test(src)) continue;
    scripts.push(src);
  }
  return scripts;
}

const indexPath = path.join(repoRoot, "index.html");
const html = fs.readFileSync(indexPath, "utf8");
const scripts = extractLocalClassicScripts(html);
const localFiles = scripts.map((src) => decodeURIComponent(src.split(/[?#]/)[0]).replace(/^\//, ""));

for (const file of localFiles) {
  const fullPath = path.join(repoRoot, file);
  if (!fullPath.startsWith(repoRoot + path.sep)) {
    fail(file, "script path escapes repository root");
    continue;
  }
  if (!fs.existsSync(fullPath)) {
    fail(file, "referenced local script does not exist");
    continue;
  }
  try {
    new vm.Script(fs.readFileSync(fullPath, "utf8"), { filename: file });
  } catch (error) {
    fail(file, `syntax check failed: ${error.message}`);
  }
}

const requiredOrder = [
  "knowledge-module-registry.js",
  "knowledge-module-identity.js",
  "knowledge-module-runtime-adapter.js",
  "app.js"
];
const presentRequired = requiredOrder.filter((file) => localFiles.includes(file));
for (let i = 1; i < presentRequired.length; i += 1) {
  if (localFiles.indexOf(presentRequired[i - 1]) > localFiles.indexOf(presentRequired[i])) {
    fail("index.html", `invalid Knowledge Module load order: ${presentRequired[i - 1]} must load before ${presentRequired[i]}`);
  }
}

const appPath = path.join(repoRoot, "app.js");
if (fs.existsSync(appPath)) {
  const count = countTopLevelLexicalDeclarations(fs.readFileSync(appPath, "utf8"), "BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS");
  if (count > 1) fail("app.js", `BRAND_WORKSPACE_MISSING_KNOWLEDGE_MODULE_IDS has ${count} top-level lexical declarations`);
}

if (failures.length) {
  console.error("Browser script integrity check failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Browser script integrity check passed (${localFiles.length} local classic scripts checked).`);
