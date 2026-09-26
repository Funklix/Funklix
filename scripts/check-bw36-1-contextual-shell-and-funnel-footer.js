const assert = require('assert');
const fs = require('fs');

const app = fs.readFileSync('app.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const css = fs.readFileSync('styles.css', 'utf8');
const language = fs.readFileSync('language.js', 'utf8');
const pkg = require('../package.json');
const workflow = fs.readFileSync('.github/workflows/runtime-boot-safety.yml', 'utf8');

function test(name, fn) { fn(); console.log(`✓ ${name}`); }
function includesAll(source, values) { values.forEach((value) => assert(source.includes(value), `Missing ${value}`)); }

test('one bounded four-mode header authority maps every application section', () => {
  assert.equal((app.match(/const HEADER_MODE_BY_VIEW/g) || []).length, 1);
  includesAll(app, ['board: "canvas"', 'content_workspace: "board_context"', 'calendar: "board_context"', 'ai_brain: "board_context"', 'insights: "board_context"', 'funnel_simulator: "board_context"', '"brand-core": "brand_context"', 'home: "account_library"', 'boards_library: "account_library"', 'settings: "account_library"']);
});

test('the single header host separates Canvas commands from shared account controls', () => {
  assert.equal((html.match(/id="canvas-topbar"/g) || []).length, 1);
  assert.equal((html.match(/id="contextual-header"/g) || []).length, 1);
  assert.equal((html.match(/id="auth-panel"/g) || []).length, 1);
  includesAll(html, ['class="actions canvas-toolbar"', 'id="create-campaign-btn"', 'id="add-node-btn"', 'id="node-search-input"', 'id="filters-toggle-btn"', 'id="utilities-toggle-btn"', 'id="copy-board-link-btn"']);
  assert(app.includes('el.canvasToolbar?.classList.toggle("hidden", !canvas)'));
});

test('Board and Brand context are authorized, truthful, replaceable projections', () => {
  includesAll(app, ['state.currentBoardId && state.boardAccess?.canView !== false', 'state.currentBoardName.trim()', 'uiText("No Board selected")', 'state.brandCatalog.entries.some(({ id }) => id === brand.id)', 'uiText("No Brand selected")']);
  assert(app.includes('boards_library: "account_library"'));
  assert(!app.slice(app.indexOf('function deriveHeaderModel'), app.indexOf('function renderContextualHeader')).includes('fetch('));
});

test('header updates are render-only and resizing does not reload workspaces', () => {
  const render = app.slice(app.indexOf('function renderContextualHeader'), app.indexOf('function synchronizeAppShell'));
  ['fetch(', 'loadBoard(', 'renderContentWorkspace(', 'renderFunnelSimulator(', 'setActiveView('].forEach((token) => assert(!render.includes(token)));
  const resizeStart = app.lastIndexOf('window.matchMedia?.("(min-width: 1024px)")');
  const resize = resizeStart >= 0 ? app.slice(resizeStart, resizeStart + 220) : '';
  assert(resize.includes('synchronizeAppShell'));
  ['loadBoard', 'renderContentWorkspace', 'renderFunnelSimulator'].forEach((token) => assert(!resize.includes(token)));
});

test('Funnel navigation is normal-flow, bounded and safe-area aware on compact screens', () => {
  const compact = css.match(/@media\(max-width:768px\)\{\.journey-steps,[\s\S]*?\n/)?.[0] || '';
  includesAll(compact, ['.journey-nav{position:static', 'inset:auto', 'min-height:0', 'height:auto', 'env(safe-area-inset-bottom,0px)', 'background:transparent', '.journey-nav button{flex:1}']);
  assert(!/\.journey-nav\{[^}]*position:(sticky|fixed)/.test(compact));
  includesAll(html + css, ['journey-nav', 'min-height:44px', 'prefers-reduced-motion:reduce', 'forced-colors:active']);
});

test('responsive contextual identity shrinks without duplicate mobile DOM', () => {
  includesAll(css, ['text-overflow:ellipsis', 'white-space:nowrap', 'min-width:0', 'min-width:44px', 'env(safe-area-inset-right,0px)', '@media(max-width:560px)']);
  assert.equal((html.match(/class="contextual-header /g) || []).length, 1);
});

test('English fallback keys and complete German contextual labels exist', () => {
  includesAll(language, ['"Board": "Board"', '"Current Board": "Aktuelles Board"', '"Open Canvas": "Canvas öffnen"', '"No Board selected": "Kein Board ausgewählt"', '"Brand": "Marke"', '"Current Brand": "Aktuelle Marke"', '"No Brand selected": "Keine Marke ausgewählt"', '"Boards": "Boards"', '"Home": "Startseite"', '"Settings": "Einstellungen"']);
});

test('the focused check is registered in package and Runtime Boot Safety', () => {
  assert.equal(pkg.scripts['check:bw36.1'], 'node scripts/check-bw36-1-contextual-shell-and-funnel-footer.js');
  assert(workflow.includes('npm run check:bw36.1'));
});

test('scope adds no provider, persistence, migration, or dependency contract', () => {
  const productionProjection = app.slice(app.indexOf('const HEADER_MODE_BY_VIEW'), app.indexOf('function synchronizeAppShell'));
  ['facebook', 'linkedin', 'publish', '/api/', 'brand_core', 'schedule', 'localStorage', 'fetch('].forEach((token) => assert(!productionProjection.toLowerCase().includes(token.toLowerCase())));
  assert.deepEqual(pkg.dependencies || {}, require('../package.json').dependencies || {});
});

console.log('BW-36.1 contextual shell and Funnel footer checks passed.');
