#!/usr/bin/env node
"use strict";

const { execFileSync } = require("child_process");

const docsOnly = process.argv.includes("--docs-only");

function git(args, fallback = "") {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trimEnd();
  } catch (_error) {
    return fallback;
  }
}

function section(title, content) {
  console.log(`\n## ${title}`);
  console.log(content || "(none)");
}

console.log("# Local Change-Scope Safety Report");
console.log("This report describes the local checkout only; it does not prove GitHub PR scope without a remote baseline.");
section("HEAD", git(["rev-parse", "HEAD"], "unavailable"));
section("Branch", git(["branch", "--show-current"], "unavailable"));
section("Working-tree changed files", git(["status", "--short"]));
section("Staged files", git(["diff", "--cached", "--name-only"]));
section("Recent commits", git(["log", "--oneline", "-10"]));
section("Local diff stat", git(["diff", "--stat"]));

const changed = [
  ...git(["diff", "--name-only"]).split("\n"),
  ...git(["ls-files", "--others", "--exclude-standard"]).split("\n"),
  ...git(["diff", "--cached", "--name-only"]).split("\n")
].filter((file) => file && !file.startsWith("node_modules/"));
const outsideDocs = [...new Set(changed.filter((file) => !file.startsWith("docs/")))];
if (docsOnly && outsideDocs.length) {
  console.error("\nWARNING: docs-only mode found tracked changes outside docs/:");
  outsideDocs.forEach((file) => console.error(`- ${file}`));
  process.exit(1);
}
if (docsOnly) console.log("\nDocs-only scope check passed for tracked local changes.");
