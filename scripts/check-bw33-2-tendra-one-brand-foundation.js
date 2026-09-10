'use strict';
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const digest = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const index = read('index.html');
const css = read('styles.css');
const app = read('app.js');
const language = read('language.js');
const publishing = read('api/social-connector/linkedin-publishing.js');
const adapter = read('api/social-connector/linkedin-adapter.js');

assert(index.includes('<title>Tendra One — Campaign Canvas</title>'));
assert(index.includes('Many perspectives. One shared intelligence.'));
assert(!index.includes('Funklix') && !language.includes('Funklix is') && !language.includes('in Funklix'));
assert(app.includes('window.FunklixLanguage') && app.includes('window.FunklixContentWorkspace'));
assert(read('theme-bootstrap.js').includes('funklix.themePreference.v1'));
assert(app.includes('funklix.workspace-brand.v1.') && publishing.includes('funklix-linkedin-publish-v1'));
assert(read('api/social-connector/linkedin-adapter.js').includes('Funklix-Social-Connector/1.0'));

const sourceHashes = {
  'docs/brand-assets/tendra-one/source/tendra-one-symbol.svg': '22ed9d111cd033dec13565983eae1488628987f6d542743ffd7bee9c3f868e7e',
  'docs/brand-assets/tendra-one/source/tendra-one-symbol.png': '3ac0a7cab86dcecb2a296b1a50a90a5ba31c52f2c0ec99125ba991d3874ffd2b',
  'docs/brand-assets/tendra-one/source/tendra-one-wordmark.svg': '71b4220fa5ebe0f64e1c0e7e60ff4b645a644d63bff12b422dbd91e4cdf59219',
  'docs/brand-assets/tendra-one/source/tendra-one-wordmark.png': 'a0d3aa8e6f907faf2f2262619e84bd1ff85ccb2bd9e73559b095adc497012005'
};
for (const [file, hash] of Object.entries(sourceHashes)) assert.strictEqual(digest(file), hash, `${file} source changed`);
const normalizedRoot = svg => svg.replace(/\s(?:version|id|x|y|width|height|enable-background|xml:space|xmlns:xlink)="[^"]*"/g, '').replace('<svg  ', '<svg ').trim();
for (const stem of ['symbol', 'wordmark']) assert.strictEqual(read(`assets/brand/tendra-one-${stem}.svg`).trim(), normalizedRoot(read(`docs/brand-assets/tendra-one/source/tendra-one-${stem}.svg`)), `${stem} drawing geometry changed`);
for (const file of ['assets/brand/tendra-one-symbol.svg', 'assets/brand/tendra-one-wordmark.svg']) {
  const svg = read(file);
  assert(/viewBox="[0-9.]+ [0-9.]+ [0-9.]+ [0-9.]+"/.test(svg), `${file} needs viewBox`);
  assert(!/<script\b|\son[a-z]+\s*=|(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:|javascript:)/i.test(svg), `${file} contains unsafe content`);
  assert(!/<svg[^>]*\s(?:width|height)=/i.test(svg), `${file} must remain CSS-sized`);
}
assert(index.includes('href="/assets/brand/tendra-one-symbol.svg"') && fs.existsSync(path.join(root, 'assets/brand/tendra-one-symbol.svg')));
for (const file of ['index.html', 'styles.css', 'app.js', 'language.js']) assert(!read(file).includes('docs/brand-assets/tendra-one/source'));

for (const token of ['brand-primary','brand-primary-hover','brand-secondary','brand-accent-warm','brand-accent-open','brand-surface','brand-surface-emphasis','brand-border','brand-focus-ring','brand-text-on-primary']) assert(css.match(new RegExp(`--${token}:`, 'g'))?.length >= 2, `${token} missing by theme`);
assert(/html\[data-theme="dark"\][\s\S]*--fk-color-surface-panel: #191c35;[\s\S]*--fk-color-surface-card: #20233f;[\s\S]*--fk-color-surface-elevated: #282b4a;/.test(css));
for (const semantic of ['focus-visible', ':disabled', 'color-warning', 'color-danger', 'color-success']) assert(css.includes(semantic), `${semantic} semantic missing`);
for (const hook of ['left-sidebar','canvas-topbar','canvas','inspector-panel','content-workspace-view','settings-dialog','auth-panel']) assert(index.includes(`id="${hook}"`), `${hook} hook missing`);
for (const entry of ['collaboration','Review','approval','linkedin-connect-button']) assert((index + app).toLowerCase().includes(entry.toLowerCase()), `${entry} entry missing`);
assert.strictEqual(require(path.join(root, 'api/social-connector/linkedin-publishing.js')).enabled({}), false, 'personal publishing must default disabled');
assert(adapter.includes("accountType:'personal'") && adapter.includes("type:'personal'") && !/organization|company page/i.test(adapter));
assert(!/canvasDensity|canvas-density|densityPreference|board\.density/i.test(index + app + css));
assert.strictEqual(digest('approval-material-contract.js'), 'c02c08e63b73b5af5120cc1dea170adf8d267aace4989e689ac79832d0462867');
assert.strictEqual(digest('social-connections-response-contract.js'), 'ccf573c98efd111b79d8876d56b4cf839576514bbe2b58a4bdaac546ba1b8ea8');
assert.strictEqual(digest('api/social-connector/linkedin-publishing.js'), 'f4d454d7a42ff84e0af6e7e26cb23534401e78ef32a65f6bb6abf789aa5728de');
console.log('BW-33.2 Tendra One brand-foundation regression checks passed.');
