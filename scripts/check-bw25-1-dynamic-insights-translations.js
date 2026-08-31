#!/usr/bin/env node
"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm"); const root=path.resolve(__dirname,".."); const read=f=>fs.readFileSync(path.join(root,f),"utf8"); const app=read("app.js"),source=read("language.js");
const sandbox={module:{exports:{}},localStorage:{getItem:()=>null,setItem:()=>{}}}; sandbox.exports=sandbox.module.exports; vm.runInNewContext(source,sandbox,{filename:"language.js"}); const language=sandbox.module.exports;
for(const message of ["Missing CTA","Add CTA variations for different stages.","Tone shifts across nodes are high.","Add trust-building proof in Landing Page nodes."]){assert.strictEqual(language.t(message,"en"),message);assert.notStrictEqual(language.t(message,"de"),message);}
for(const key of ["Evidence from your campaign Canvas","Measured Performance","Canvas Diagnostics","Opportunities","Data and Methodology","Show on Canvas","Ask AI Brain","Unavailable","Deterministic diagnostic"]){assert.notStrictEqual(language.t(key,"de"),key,`German translation missing: ${key}`);}
assert(app.includes("textContent") && app.includes("node.title || node.type"),"safe authored text rendering missing"); assert(!/innerHTML/.test(app.slice(app.indexOf("function renderInsightsSurface"),app.indexOf("function isValidInsightsDiagnostic"))),"Insights dynamic renderer must not use innerHTML");
const change=app.slice(app.indexOf('el.uiLanguageSelect?.addEventListener("change"'),app.indexOf('el.campaignLanguageSelect?.addEventListener')); assert(change.includes("renderInsightsSurface()")&&!/analyzeCampaign|captureInsightsDiagnostic|markUnsaved|autosave/.test(change),"language rerender contract changed");
console.log("BW-25.1 dynamic AI Insights translation checks passed.");
