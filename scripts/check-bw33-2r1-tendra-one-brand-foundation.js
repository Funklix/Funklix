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
const symbol = read('assets/brand/tendra-one-symbol.svg');

const sourceHashes = {
  'docs/brand-assets/tendra-one/source/tendra-one-symbol.svg': '22ed9d111cd033dec13565983eae1488628987f6d542743ffd7bee9c3f868e7e',
  'docs/brand-assets/tendra-one/source/tendra-one-symbol.png': '3ac0a7cab86dcecb2a296b1a50a90a5ba31c52f2c0ec99125ba991d3874ffd2b',
  'docs/brand-assets/tendra-one/source/tendra-one-wordmark.svg': '71b4220fa5ebe0f64e1c0e7e60ff4b645a644d63bff12b422dbd91e4cdf59219',
  'docs/brand-assets/tendra-one/source/tendra-one-wordmark.png': 'a0d3aa8e6f907faf2f2262619e84bd1ff85ccb2bd9e73559b095adc497012005'
};
for (const [file, hash] of Object.entries(sourceHashes)) assert.strictEqual(digest(file), hash, `${file} source changed`);
assert(fs.existsSync(path.join(root, 'assets/brand/tendra-one-symbol.svg')), 'production symbol missing');
for (const file of ['index.html', 'styles.css', 'app.js', 'language.js']) assert(!read(file).includes('docs/brand-assets'), `${file} references source assets`);
assert(symbol.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="36 28 371 303">'), 'balanced production crop missing');
assert(!symbol.includes('fill="#FCFBFB"'), 'full-canvas traced backdrop remains');
assert(!symbol.includes('M278.000000,355.000000'), 'full-canvas backdrop geometry remains');
const sourceSymbol = read('docs/brand-assets/tendra-one/source/tendra-one-symbol.svg');
assert.strictEqual((symbol.match(/<path\b/g) || []).length, (sourceSymbol.match(/<path\b/g) || []).length - 1, 'more than the backdrop path was removed');
assert(symbol.includes('fill="#FCFBFC"') && symbol.includes('M198.291595,253.753326'), 'near-white internal tonal geometry missing');
assert(symbol.includes('M244.963379,36.150974') && symbol.includes('M360.011261,203.957047') && symbol.includes('M118.255455,321.156036'), 'three forms surrounding the central negative-space opening changed');
assert(!/<script\b|\son[a-z]+\s*=|(?:href|src)\s*=|url\s*\(/i.test(symbol), 'production SVG contains executable or external content');
assert(!/<(?:rect|image)\b/i.test(symbol), 'production SVG contains a canvas or raster image');

assert(index.includes('<title>Tendra One — Campaign Canvas</title>'));
assert(index.includes('<meta name="application-name" content="Tendra One"'));
assert(index.includes('<meta name="description" content="Many perspectives. One shared intelligence."'));
assert(index.includes('<link rel="icon" href="/assets/brand/tendra-one-symbol.svg"'));
const header = index.match(/<div class="sidebar-header">([\s\S]*?)<section class="brand-switcher-shell/)?.[1] || '';
assert(header.includes('class="logo-symbol"') && header.includes('class="logo-name">Tendra One</span>'), 'sidebar lockup missing');
assert(!header.includes('Many perspectives.'), 'tagline entered sidebar');
assert(/\.logo-name\s*\{[\s\S]*?white-space:\s*nowrap;/.test(css), 'product name lacks no-wrap contract');
assert(index.includes('class="logo" role="img" aria-label="Tendra One" title="Tendra One"'), 'collapsed lockup accessible name missing');
assert(css.includes('.app-shell.sidebar-collapsed .logo-name { display: none; }'), 'collapsed product text is not hidden');
assert(/\.logo-symbol\s*\{[\s\S]*?width:\s*40px;[\s\S]*?height:\s*32px;/.test(css), 'expanded symbol geometry changed');
assert(!/\.logo\s*\{[^}]*background:/s.test(css), 'logo tile background introduced');
for (const color of ['#4f46e5','#a78bfa','#f8b4c4','#ffd1a8','#f8f9fb']) assert(css.includes(color), `${color} brand color missing`);
assert(css.includes('html[data-theme="dark"]') && css.includes('--brand-selected-surface:rgba(167,139,250,.14)'), 'restrained Dark Mode mapping missing');

const protectedHashes = {
  'api/_auth-session.js': '2ee41ebe695a761c9aa05cc1c9a0df1a0dc81649f9150a6a083b6139c3e26e28',
  'api/auth/google/start.js': '47b94ca4f7341cb055cb3202b823ad023758f3ad3d35f0cfa0323a7c25f38649',
  'api/auth/google/callback.js': '676451684d6610d9b9daaca6e4fcbce4bba1ee2fc2dce12d97cc33a88ee36485',
  'api/auth/session/index.js': 'f809bd9f8ce53bc323be38343ea25487b2d477c0ab3c1d15e4a0cfe7896fb4db'
};
for (const [file, hash] of Object.entries(protectedHashes)) assert.strictEqual(digest(file), hash, `${file} authentication baseline changed`);
for (const contract of ['id="google-signin-btn"','id="auth-signout-btn"','id="auth-panel"']) assert(index.includes(contract), `${contract} missing`);
for (const contract of [
  'document.getElementById("google-signin-btn")',
  'window.location.href = `/api/auth/google/start?returnTo=${encodeURIComponent(returnTo)}`',
  "fetch('/api/auth/session')",
  'fetch("/api/auth/session", { method: "DELETE" })',
  'el.googleSigninButton?.addEventListener("click"',
  'el.authSignoutButton?.addEventListener("click"'
]) assert(app.includes(contract), `browser auth contract changed: ${contract}`);
const start = read('api/auth/google/start.js');
const callback = read('api/auth/google/callback.js');
const session = read('api/_auth-session.js');
assert(start.includes("`${origin}/api/auth/google/callback`") && callback.includes("`${origin}/api/auth/google/callback`"), 'origin-derived callback changed');
for (const cookie of ['funklix_session','funklix_oauth_state','funklix_oauth_return_to']) assert((start + callback + session).includes(cookie), `${cookie} changed`);

for (const hook of ['left-sidebar','sidebar-toggle-btn','canvas-topbar','canvas','inspector-panel','content-workspace-view','boards-library-view','ai-brain-nav-btn','insights-nav-btn','review-node-btn','linkedin-connect-button']) assert(index.includes(`id="${hook}"`), `${hook} entry point missing`);
assert((index + app).toLowerCase().includes('approval') && (index + app).toLowerCase().includes('publish'), 'approval or publishing entry point missing');
for (const identifier of ['window.FunklixLanguage','window.FunklixContentWorkspace','funklix.workspace-brand.v1.','[Funklix DOM Diagnostics]']) assert(app.includes(identifier) || read('language.js').includes(identifier) || read('content-workspace.js').includes(identifier), `${identifier} compatibility identifier changed`);
// Canvas density is now intentionally owned by the immediately following BW-33.3 regression.
assert(!/board\.density/i.test(index + app + css), 'Canvas density leaked into Board data');
const adapter = read('api/social-connector/linkedin-adapter.js');
assert.strictEqual(require(path.join(root, 'api/social-connector/linkedin-publishing.js')).enabled({}), false, 'personal LinkedIn publishing default changed');
assert(adapter.includes("accountType:'personal'") && !/organization|company page/i.test(adapter), 'Company Page publishing introduced');
assert(!/image.*publish|publish.*image/i.test(adapter), 'LinkedIn image publishing introduced');
console.log('BW-33.2R1 corrected Tendra One brand-foundation regression checks passed.');
