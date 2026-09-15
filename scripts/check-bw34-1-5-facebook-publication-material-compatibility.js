'use strict';
const assert = require('assert');
const approval = require('../approval-material-contract');
const material = require('../facebook-publication-material');
const workspace = require('../content-workspace');
const facebook = require('../api/social-connector/facebook-publishing');
const linkedin = require('../api/social-connector/linkedin-publishing');

const caption = 'The exact approved message remains unchanged. 🌍';
const baseNode = () => ({ id:'historical-facebook',type:'Social Media Posting',title:'Approved post',content:caption,channel:'Facebook',status:'Approved',social:{platform:'Facebook',caption,preview:'Campaign planning preview',hashtags:[]},images:[{id:'generated-image',url:'https://example.invalid/generated.png',name:'Generated concept',source:'generated'}],variants:[] });
const approve = node => { node.approvedContentFingerprint=approval.fingerprintSync(node); return node; };
const snapshot = {status:'resolved',projection:{state:'connected',connection_id:'connection',display_name:'Facebook',destination_id:'page',destinations:[{id:'page',type:'page',label:'Tendra One',selected:true,capabilities:['CREATE_CONTENT']}]}};
const serverInput = (node,extra={}) => ({authenticatedAccountId:'owner',boardEditAccess:true,boardSaved:true,node,currentFingerprint:approval.fingerprintSync(node),connection:{id:'connection',owner_account_id:'owner',status:'connected',token_secret_id:'secret',granted_scopes:['pages_show_list','pages_manage_posts','pages_read_engagement']},credential:{revoked_at:null},destination:{id:'page',owner_account_id:'owner',connected_account_id:'connection',destination_type:'page',active:true,status:'active',capabilities:['CREATE_CONTENT']},now:'2026-09-15T00:00:00.000Z',adapterSupported:true,publishingEnabled:true,...extra});

const historical = approve(baseNode());
const browserMaterial = workspace.validateFacebookContent(historical);
const serverEvaluation = facebook.evaluate(serverInput(historical));
assert.strictEqual(browserMaterial.ok,true,'generated Canvas image metadata is not a publication attachment');
assert.strictEqual(browserMaterial.mediaKind,'planning_metadata');
assert.strictEqual(serverEvaluation.eligible,true);
assert.strictEqual(browserMaterial.message,caption);
assert.strictEqual(serverEvaluation.message,caption,'server sends the exact visible approved caption');
assert.strictEqual(workspace.selectFacebookPublishingReadiness(snapshot,historical).reason,'facebook_ready','browser and server accept the same material');
assert.strictEqual(approval.fingerprintSync(historical),historical.approvedContentFingerprint,'projection does not mutate data or stale the existing approval');

const uploaded=approve({...baseNode(),images:[{id:'upload',url:'https://example.invalid/upload.png',source:'uploaded'}]});
assert.strictEqual(material.extract(uploaded).code,'facebook_media_unsupported');
assert.strictEqual(facebook.evaluate(serverInput(uploaded)).code,'facebook_media_unsupported');
const changedAttachment={...uploaded,images:[...uploaded.images,{id:'second',url:'https://example.invalid/second.png',source:'uploaded'}]};
assert.notStrictEqual(approval.fingerprintSync(changedAttachment),uploaded.approvedContentFingerprint,'real attachment changes cannot preserve approval');

const ambiguous=approve({...baseNode(),images:[{id:'legacy',url:'https://example.invalid/legacy.png',source:'unknown_legacy_source'}]});
assert.strictEqual(workspace.validateFacebookContent(ambiguous).code,'facebook_media_ambiguous');
assert.strictEqual(facebook.evaluate(serverInput(ambiguous)).code,'facebook_media_ambiguous');

const linked=approve({...baseNode(),social:{...baseNode().social,link:'https://example.com/launch'}});
assert.deepStrictEqual({ok:workspace.validateFacebookContent(linked).ok,link:facebook.evaluate(serverInput(linked)).link},{ok:true,link:'https://example.com/launch'});
for(const bad of ['http://example.com','https://example.com/#section']){const node=approve({...baseNode(),social:{...baseNode().social,link:bad}});assert.strictEqual(material.extract(node).code,'facebook_link_invalid');}
const multiple=approve({...baseNode(),social:{...baseNode().social,link:'https://one.example/',url:'https://two.example/'}});assert.strictEqual(material.extract(multiple).code,'facebook_link_ambiguous');

assert.strictEqual(facebook.evaluate(serverInput(historical,{successfulExternalPost:true})).code,'already_published','durable prior-publication protection remains authoritative');
const changedCopy={...historical,social:{...historical.social,caption:`${caption} changed`}};
assert.notStrictEqual(approval.fingerprintSync(changedCopy),historical.approvedContentFingerprint,'visible publication material changes stale approval');
assert.strictEqual(linkedin.normalizeCaption(' LinkedIn unchanged ').caption,'LinkedIn unchanged','LinkedIn publishing contract remains untouched');

console.log('BW-34.1.5 Facebook publication material compatibility regression passed.');
