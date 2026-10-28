'use strict';
// Format variants of the recorded #830 answer, not a new live-session capture.
const fs = require('node:fs');
const original = fs.readFileSync(require('node:path').join(__dirname, 'bw37-1c3b-r1-appics-response.txt'), 'utf8');
module.exports = [
  original,
  original.replace(/##### (Instagram Post|X Post)/g, '### **$1**')
    .replace(/\*\*(Caption|Tweet|CTA|Hashtags):\*\*/g, '###### **$1:**')
    .replaceAll('\n', '\r\n'),
  original.replace('Let’s build a community', '\\-\\-\\-\n\nLet’s build a community')
    + '\n\n**AI metadata:** This explanation is outside both selected sources.'
];
