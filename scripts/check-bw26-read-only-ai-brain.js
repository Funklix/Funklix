'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');

const route = read('api/ai-brain/advice.js');
const app = read('app.js');
const html = read('index.html');
assert(route.includes("getSessionUser(req)") && route.includes("getBoardAccess(boardId, user"));
assert(route.includes("if (!access?.canEdit)") && route.includes("getBrandAccess(board.brand_id, user"));
assert(route.includes('board.brand_core_snapshot') && !route.includes('req.body.brand_core'));
assert(route.includes("OPENAI_AI_BRAIN_MODEL") && route.includes('controller.abort()'));
assert(route.includes("never claim to edit, save, generate, repair, apply, or simulate"));
assert(app.includes('Includes unsaved Canvas changes') && app.includes('selected_node_id: selectedNodeId'));
assert(app.includes('state.boardAccess?.canEdit === true') && app.includes('invalidateAiBrainRequest'));
assert(!app.slice(app.indexOf('function renderAiBrain'), app.indexOf('function currentInsightsIdentity')).includes('saveCampaignCanvasState'));
assert(html.includes('id="ai-brain-view"') && html.includes('id="ai-brain-summary"') && html.includes('id="ai-brain-nav-btn"'));
console.log('BW-26 read-only AI Brain checks passed.');
