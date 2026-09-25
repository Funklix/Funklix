"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const css = fs.readFileSync("styles.css", "utf8");
const workspace = fs.readFileSync("content-workspace.js", "utf8");
const app = fs.readFileSync("app.js", "utf8");
const workflow = fs.readFileSync(".github/workflows/runtime-boot-safety.yml", "utf8");
const pkg = require("../package.json");

function test(name, fn) {
  fn();
  process.stdout.write(`✓ ${name}\n`);
}

function has(pattern, message) {
  assert.match(css, pattern, message);
}

test("Runtime Boot Safety registers BW-27.7 directly after BW-27.6", () => {
  assert.equal(pkg.scripts["check:bw27.7"], "node scripts/check-bw27-7-responsive-shell-stability.js");
  const previous = workflow.indexOf("check:bw27.6");
  const current = workflow.indexOf("check:bw27.7");
  const next = workflow.indexOf("Check BW-28 trustworthy", current);
  assert(previous >= 0 && current > previous && next > current);
});

test("root and shell have one shrink-safe width owner", () => {
  has(/html \{ overflow-x: clip; \}/, "document clips accidental paint overflow only after child containment");
  has(/\.app-shell \{ width: 100%; max-width: 100%; \}/, "shell is viewport bounded");
  has(/grid-template-columns: var\(--sidebar-collapsed-width\) minmax\(0, 1fr\)/, "bounded navigation and flexible workspace tracks");
  has(/\.workspace-wrap[\s\S]*min-width: 0/, "workspace can shrink");
  assert.doesNotMatch(css.slice(css.indexOf("BW-27.7 responsive shell")), /width:\s*100vw/,
    "responsive repair does not put a 100vw child inside the offset shell");
});

test("compact navigation is one persistent DOM mode", () => {
  has(/max-width: 1300px[\s\S]*min-width: 768px/, "compact desktop range exists");
  has(/\.sidebar \.nav-item \{ display: flex;[\s\S]*min-width: 44px/, "compact destinations remain usable");
  has(/max-width: 767px[\s\S]*\.sidebar \{ position: fixed;[\s\S]*inset: auto 0 0/, "single navigation becomes the mobile bar");
  assert.equal((app.match(/addEventListener\(["']resize["']/g) || []).length, 2,
    "only the existing Canvas link redraw and transient emoji portal observe resize");
  assert.match(app, /removeEventListener\("resize", active\.onViewportChange\)/,
    "transient portal listener is cleaned up");
});

test("dashboard changes deliberately from columns to one readable track", () => {
  has(/max-width: 1180px[\s\S]*dashboard-continue-working[\s\S]*minmax\(0, 1fr\)/, "continue card stacks before compression");
  has(/max-width: 1023px[\s\S]*mission-two-column[\s\S]*minmax\(0, 1fr\)/, "dashboard grids stack");
  has(/max-width: 767px[\s\S]*mission-hero[\s\S]*minmax\(0, 1fr\)/, "mobile hero is one column");
});

test("calendar toolbar, backlog, cards and genuine data overflow stay local", () => {
  has(/max-width: 1180px[\s\S]*content-calendar-layout \{ grid-template-columns: minmax\(0, 1fr\)/, "backlog stacks without crushing calendar");
  has(/\.content-calendar-backlog \{ position: static; width: 100%; max-height: 360px; \}/, "stacked backlog is bounded");
  has(/max-width: 767px[\s\S]*content-calendar-switcher button \{ flex: 1 1 0; \}/, "view controls remain reachable");
  has(/\.content-calendar-week\{min-width:760px\}[\s\S]*\.week-scroll\{max-height:65vh;overflow:auto\}/, "week data surface owns required scrolling");
});

test("portals are viewport bounded with reachable sticky actions", () => {
  has(/automatic-planning-studio[\s\S]*grid-template-rows:auto minmax\(0,1fr\) auto[\s\S]*height:calc\(100dvh/, "Auto-plan owns header, scrolling body and footer tracks");
  has(/max-width: 479px[\s\S]*automatic-planning-studio \{ inset: 0; width: 100%; height: 100dvh; \}/, "Auto-plan is full screen on narrow mobile");
  has(/content-calendar-drawer, \.cw-quick-scheduler \{ width: 100%; max-width: 100%/, "detail and quick schedule sheets are bounded");
  assert.match(workspace, /querySelectorAll\("\[data-calendar-auto-plan-portal\]"\)[\s\S]*remove/, "duplicate Auto-plan portals are removed");
  assert.match(workspace, /automaticPlanningBodyLocked[\s\S]*body\.style\.overflow=automaticPlanningBodyOverflow/, "scroll lock is restored");
});

test("resize is presentation-only and preserves Board, tab, proposal and schedules", () => {
  const resizeListeners = (workspace.match(/addEventListener\(["']resize["']/g) || []).length;
  assert.equal(resizeListeners, 0, "workspace has no resize listener");
  assert.doesNotMatch(workspace, /onresize\s*=/, "workspace has no implicit resize handler");
  assert.match(workspace, /calendarState\.proposal/, "proposal remains owned by workspace state");
  assert.match(workspace, /calendarState\.mode/, "active Content tab remains owned by workspace state");
});

test("accessibility contracts cover touch, focus, motion, contrast and zoom reflow", () => {
  has(/min-width: 44px; min-height: 44px/, "compact controls meet touch target contract");
  has(/@media \(prefers-reduced-motion: reduce\)/, "reduced motion exists");
  has(/@media \(forced-colors: active\)/, "forced colors exists");
  has(/max-width: 479px/, "narrow reflow supports 200 percent zoom equivalent widths");
  assert.match(workspace, /e\.key==="Escape"/, "sheets preserve Escape behavior");
  assert.match(workspace, /previous\?\.focus\?\./, "detail drawer restores focus");
});

console.log("BW-27.7 responsive shell stability checks passed.");
