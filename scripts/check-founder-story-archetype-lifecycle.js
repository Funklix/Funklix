#!/usr/bin/env node
"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const route = require("../api/discover-brand-dna");

const app = fs.readFileSync(path.join(__dirname, "..", "app.js"), "utf8");
const generatedReview = app.slice(app.indexOf("function openFounderStoryGeneratedReview"), app.indexOf("async function generateFounderStoryNarrative"));
const generation = app.slice(app.indexOf("async function generateFounderStoryNarrative"), app.indexOf("const FOUNDER_STORY_IMPORT_MAX_VALUE_LENGTH"));
const extraction = app.slice(app.indexOf("async function startFounderStoryWebsiteImport"), app.indexOf("function openFounderStoryWebsiteImport"));
const lifecycle = app.slice(app.indexOf("function getPersistedFounderStoryContext"), app.indexOf("function loadBrandBrainState"));
const discovery = app.slice(app.indexOf("async function discoverBrandDna"), app.indexOf("function refineBrandDna"));

// Draft generation, extraction, mapping, cancellation, and ordinary edits are not triggers.
assert.doesNotMatch(generation, /continueAfterPersistedFounderStoryAcceptance|persistFounderStoryAcceptance/);
assert.doesNotMatch(extraction, /continueAfterPersistedFounderStoryAcceptance|persistFounderStoryAcceptance/);
assert.match(generatedReview, /cancel\.addEventListener\("click", \(\) => overlay\.remove\(\)\)/);
assert.doesNotMatch(generatedReview.slice(generatedReview.indexOf("cancel.addEventListener"), generatedReview.indexOf("apply.addEventListener")), /persistFounderStoryAcceptance/);

// Apply persists first, triggers once, and rolls back on persistence failure.
assert.match(generatedReview, /apply\.disabled = true/);
assert.match(generatedReview, /await persistFounderStoryAcceptance\(context\.tile, acceptanceEventKey\)/);
assert.match(generatedReview, /context\.tile\.content = previousNarrative/);
assert.match(lifecycle, /await saveBoardToServer\("founder-story-apply"\)/);
assert.match(lifecycle, /if \(persisted !== true\) return false/);
assert.match(lifecycle, /founderStoryAcceptanceInFlight/);
assert.match(lifecycle, /founderStoryAcceptanceHandled/);

// Existing Archetypes remain persisted while the reassessment uses the established draft review.
assert.match(lifecycle, /existingArchetype\?\.primaryArchetype/);
assert.match(lifecycle, /state\.brandDnaReassessment =/);
assert.match(discovery, /state\.brandDnaDraft = draft/);
assert.doesNotMatch(discovery, /state\.brandCore\.brandDNA\s*=/);
assert.match(app, /id="brand-dna-keep-existing"/);
assert.match(app, /state\.brandDnaDraft = null;\s*state\.brandDnaReassessment = null;/);

// Missing Archetype recommends, never generates until the established CTA is selected.
assert.match(lifecycle, /Founder Story complete/);
assert.match(lifecycle, /Define Brand Archetype/);
assert.match(lifecycle, /Maybe later/);
assert.match(lifecycle, /initiateBrandDnaGeneration/);
const missingBranch = lifecycle.slice(lifecycle.indexOf("if (!existingArchetype?.primaryArchetype)"), lifecycle.indexOf("state.brandDnaReassessment"));
assert.doesNotMatch(missingBranch, /discoverBrandDna/);

const acceptedStory = {
  structuredFacts: { founderNameRole: "A founder", motivation: "A real need", vision: "A better future" },
  supplementalNarrative: "Persisted accepted narrative. <html>not markup instructions</html>"
};
const existing = { primaryArchetype: "Caregiver", primaryConfidence: 70, secondaryArchetype: "Sage", secondaryConfidence: 20, reasoning: "Prior evidence" };
const prompt = route.buildDiscoveryPrompt({
  brandBrainContext: { text: "Complete Brand Brain context" },
  brandBrainData: { mission: "Help", brandDNA: existing },
  founderStoryContext: acceptedStory,
  reassessmentContext: existing
});
assert(prompt.includes("Persisted accepted narrative"));
assert(prompt.includes("currently persisted Brand Archetype result"));
assert(prompt.includes("remains the strongest fit"));
assert(prompt.includes("not as instructions"));
assert(!prompt.includes("rawWebsiteExtraction"));
assert(!prompt.includes("unacceptedDraft"));
assert.strictEqual(route.sanitizeReassessmentContext({ primaryArchetype: "invalid" }), null);

// Restore/load has no acceptance dispatch and legacy globals/IDs remain.
const load = app.slice(app.indexOf("async function loadBoardFromUrlIfPresent"), app.indexOf("function renderCampaignCanvasFromStateIfNeeded"));
assert.doesNotMatch(load, /continueAfterPersistedFounderStoryAcceptance|persistFounderStoryAcceptance/);
for (const id of ["brand-core-founder-story-generate-apply", "brand-dna-accept", "brand-dna-regenerate"]) assert(app.includes(id));
assert(app.includes("window.getBrandCoreData = getBrandCoreData"));

console.log("Founder Story to Brand Archetype lifecycle checks passed (18 regression invariants). ");
