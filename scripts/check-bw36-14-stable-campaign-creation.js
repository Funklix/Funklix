#!/usr/bin/env node
'use strict';
// R1 supersedes the Idea-only contract; retain the signed authorization, transactional
// replay/revision tests and production DOM/context regression against the complete flow.
const {server,browser}=require('./check-bw36-14r1-restore-complete-campaign-v3');
(async()=>{await server();await browser({baseline:true});console.log('BW-36.14 retained context and handoff regressions passed with the V3 contract.');})().catch(e=>{console.error(e);process.exitCode=1;});
