const assert = require('assert');
const fs = require('fs');
const app = fs.readFileSync('app.js', 'utf8');
const api = fs.readFileSync('api/boards/index.js', 'utf8');
const html = fs.readFileSync('index.html', 'utf8');
const workflow = fs.readFileSync('.github/workflows/runtime-boot-safety.yml', 'utf8');
function block(source, start, end) {
  const from = source.indexOf(start); const to = source.indexOf(end, from + start.length);
  assert(from >= 0 && to > from, `missing ${start}`); return source.slice(from, to);
}
const load = block(app, 'async function loadBoardsLibrary()', 'function getBoardBrandSnapshot');
const scope = block(app, 'function setBoardsLibraryScope', 'function handleWorkspaceBrandSelectionChange');
const selection = block(app, 'function handleWorkspaceBrandSelectionChange', 'async function loadBoardsLibrary');
assert.match(html, /boards-scope-all[\s\S]*All Boards/);
assert.match(html, /boards-scope-brand[\s\S]*Selected Brand/);
assert.match(html, /boards-scope-unbranded[\s\S]*Unbranded/);
assert.match(app, /boardsLibraryRequest: \{ scope: "all"/); // default and reload behavior
assert.match(scope, /scope === state\.boardsLibraryRequest\.scope/); // deliberate activation + duplicate protection
assert.match(api, /\['all', 'brand', 'unbranded'\]\.includes\(scope\)/);
assert.match(api, /scope === 'brand'[\s\S]*Authentication required/);
assert.match(api, /isBrandId\(rawBrandId\.trim\(\)\)/);
assert.match(api, /getOwnedBrand\(rawBrandId\.trim\(\), user/); // selection is never authorization
assert.match(api, /Brand not found/); // safe inaccessible response
assert.match(api, /WHERE \(LOWER\(COALESCE\(b\.owner_email/); // board predicates retained and grouped
assert.match(api, /AND b\.brand_id = \$2/);
assert.match(api, /AND b\.brand_id IS NULL/);
assert.match(api, /ORDER BY CASE[\s\S]*order_index ASC NULLS LAST[\s\S]*updated_at DESC/);
assert.match(api, /const \{ brand_core_snapshot, \.\.\.safeRow \} = row/);
assert.match(load, /generation !== request\.generation/);
assert.match(load, /identity !== getBoardsLibraryIdentity\(scope\)/);
assert.match(load, /scope !== request\.scope/);
assert.match(load, /request\.controller\?\.abort\(\)/);
assert.match(load, /request\.status === 'loading' && request\.identity === identity/);
assert.match(selection, /boardsLibraryRequest\.scope !== 'brand'/);
assert.match(selection, /state\.boardsLibrary = \[\]/); // clearing never leaves old Brand results
assert.match(app, /No Boards for the selected Brand/);
assert.match(app, /No Unbranded Boards/);
assert.match(app, /Malformed board-list response/);
assert.match(app, /The open Board is outside the current Board list filter/);
assert.doesNotMatch(load + scope + selection, /history\.|location\.|saveBoard|autosave|canvas_json|brand_core_snapshot|method:\s*['"](?:POST|PUT|PATCH|DELETE)/i);
assert.doesNotMatch(load + scope + selection, /currentBoardId\s*=|brandCore\s*=|boardBrandAssociation\.brandId\s*=/);
assert.match(app, /boardsScopeAll\?\.addEventListener/);
assert.match(app, /boardsScopeBrand\?\.addEventListener/);
assert.match(app, /boardsScopeUnbranded\?\.addEventListener/);
assert.match(workflow, /node scripts\/check-bw10-brand-scoped-board-library\.js/);
for (let n = 1; n <= 9; n += 1) assert.match(workflow, new RegExp(`check-bw${n}`));
console.log('BW-10 Brand-scoped Board library checks passed.');
