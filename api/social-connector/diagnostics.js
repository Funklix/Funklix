'use strict';
const { exact, boundedText, platform, stableId, timestamp }=require('./contracts');
function diagnostic(input){if(!exact(input,['requestId','operation','phase','classification','timestamp'],['platform','jobId','connectionId'])||!stableId(input.requestId)||!boundedText(input.operation,80)||!boundedText(input.phase,80)||!boundedText(input.classification,80)||!timestamp(input.timestamp)||input.platform!==undefined&&!platform(input.platform)||input.jobId!==undefined&&!stableId(input.jobId)||input.connectionId!==undefined&&!stableId(input.connectionId))return null;return Object.freeze({...input});}
module.exports={diagnostic};
