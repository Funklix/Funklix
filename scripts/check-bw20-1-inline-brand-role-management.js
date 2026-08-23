#!/usr/bin/env node
'use strict';

const fs = require('fs');
const assert = require('assert');
const read = (path) => fs.readFileSync(path, 'utf8');
const browser = read('app.js');
const members = read('api/brands/[id]/members.js');
const access = read('api/_brand-access.js');
const storage = read('api/_brands-storage.js');
const workflow = read('.github/workflows/runtime-boot-safety.yml');

// The existing POST upsert updates one unique membership without delete/recreate.
assert.match(members, /ON CONFLICT \(brand_id, email\) DO UPDATE SET role = EXCLUDED\.role/);
assert.match(storage, /UNIQUE \(brand_id, email\)/);
assert.doesNotMatch(members.match(/if \(req\.method === 'DELETE'\)[^]*?const role =/)?.[0] || '', /req\.method === 'POST'[^]*DELETE FROM brand_members/);

// Server-derived capabilities retain the BW-20 Owner/Admin/Editor/Viewer boundary.
assert.match(access, /canManageBrandMembers: canManage/);
assert.match(access, /canManageBrandAdmins: role === 'owner'/);
assert.match(members, /!access\.canManageBrandAdmins && \(role === 'admin' \|\| existing\.rows\[0\]\?\.role === 'admin' \|\| targetEmail === actorEmail\)/);
assert.match(members, /!brand \|\| !access\.canManageBrandMembers/);
assert.match(members, /targetEmail === normalizeEmail\(brand\.owner_email\)/);

// Existing rows render safe email text and explicit, separately-triggered controls.
assert.match(browser, /email\.textContent = member\.email/);
assert.doesNotMatch(browser, /innerHTML = `[^`]*\$\{member\.email\}/);
for (const text of ['Role change not saved.', 'Update', 'Cancel', 'Remove', 'Reload member list']) assert(browser.includes(text));
assert.match(browser, /select\.addEventListener\("change"/);
assert.match(browser, /update\.addEventListener\("click"/);
assert.match(browser, /JSON\.stringify\(\{ email: member\.email, role: submittedRole \}\)/);
assert.match(browser, /row\.dataset\.pending === "true"/);
assert.match(browser, /reductions\[submittedRole\] < reductions\[authoritativeRole\][^]*window\.confirm/);

// Owner receives all three choices; Admin receives Viewer/Editor and neither Admin nor self controls.
assert.match(browser, /\["viewer", "editor", \.\.\.\(brand\.access\.canManageBrandAdmins \? \["admin"\] : \[\]\)\]/);
assert.match(browser, /member\.role !== "admin" && member\.email\.trim\(\)\.toLowerCase\(\) !== accountEmail/);
assert.match(browser, /if \(brand\.access\.canManageBrandMembers\) renderBrandTeamSection/);

// Authoritative response and complete stale/uncertain-result gates.
for (const token of ['canonicalBrandDetail.requestId === generation', 'canonicalBrandDetail.brandId === brand.id', 'canonicalBrandDetail.userEmail === accountEmail', 'canManageBrandMembers === true', 'canManageBrandAdmins === brand.access.canManageBrandAdmins', 'el.brandWorkspaceDetail?.open', 'operationId !== requestGeneration', 'listId !== memberListGeneration', 'memberEmail !== member.email.trim().toLowerCase()', 'submittedRole !== select.value']) assert(browser.includes(token));
assert.match(browser, /data\.member\.email\.trim\(\)\.toLowerCase\(\) !== memberEmail \|\| data\.member\.role !== submittedRole/);
assert.match(browser, /Update outcome is uncertain\. Reload the member list before trying again\./);
assert.match(browser, /uncertain = true/);
assert.match(browser, /select\.value = authoritativeRole/);

// This focused change is registered after BW-20 and does not touch isolated feature contracts.
assert.match(workflow, /check-bw20-brand-team-roles\.js[^]*check-bw20-1-inline-brand-role-management\.js/);
for (const forbidden of ['board_id', 'brand_core', 'public_view_token', 'workspace_members', 'canvas', 'autosave']) assert(!members.includes(forbidden));

console.log('BW-20.1 inline Brand member role management checks passed.');
