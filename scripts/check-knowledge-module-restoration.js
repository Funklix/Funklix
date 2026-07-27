'use strict';
const assert = require('assert'); const fs = require('fs'); const app = fs.readFileSync('app.js','utf8');
assert(app.includes('if (restoration && ["generating", "saving"].includes(status))'));
assert(app.includes('pendingGeneration: restoration ? null'));
assert(app.includes('activeStrategyModuleGenerations.clear()'));
const load = app.slice(app.indexOf('function loadBrandBrainState'), app.indexOf('function resetBrandBrainForBoardHydration'));
assert(!/generateStrategyModuleDraft|applyStrategyModuleDraft/.test(load));
console.log('Knowledge Module passive restoration checks passed.');
