const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

function expect(pattern, message) {
  assert.match(app, pattern, message);
}

expect(/id="bc-analyze-domain" class="fk-btn fk-btn-primary" type="button"/, "Analyze Website must remain the primary canonical button");
expect(/<input id="bc-logo-upload" class="bc-logo-upload-input" type="file" accept="image\/png,image\/jpeg,image\/webp,image\/gif"\/>/, "logo upload input contract changed");
expect(/<label for="bc-logo-upload" class="bc-logo-upload-action fk-btn fk-btn-secondary">\$\{value\.logo \? "Replace logo" : "Upload logo"\}<\/label>/, "upload label must target the input and reflect replacement state");
expect(/id="bc-logo-remove" class="bc-logo-remove fk-btn fk-btn-ghost" \$\{value\.logo \? "" : "disabled"\}>Remove logo<\/button>/, "Remove logo classes or disabled condition changed");
expect(/querySelector\("#bc-logo-upload"\)\.addEventListener\("change", \(event\) => replacePrimaryBrandLogo\(event\.target\.files\?\.\[0\]\)\)/, "logo upload listener changed");
expect(/querySelector\("#bc-logo-remove"\)\.addEventListener\("click"/, "logo removal listener changed");
assert.doesNotMatch(styles, /\.bc-logo-upload-input\s*\{[^}]*\b(?:display\s*:\s*none|visibility\s*:\s*hidden)/s, "logo input must stay in the accessibility tree");
assert.doesNotMatch(styles, /\.bc-add-row\s+button\s*\{[^}]*width:\s*34px/s, "Remove logo must not inherit the legacy 34px add-button rule");

assert(app.includes('aria-label="${title}"'), "list add action must use its contextual accessible name");
for (const label of ["Add Do", "Add Don't", "Add color", "Add persona", "Remove item", "Remove Do", "Remove Don't", "Remove persona"]) {
  assert(app.includes(`aria-label="${label}"`), `missing accessible editor action name: ${label}`);
}

expect(/class="fk-btn fk-btn-primary" id="brand-dna-accept"/, "Brand DNA Accept must be primary");
expect(/class="fk-btn fk-btn-secondary" id="brand-dna-keep-existing"/, "Keep existing Archetype must be secondary");
expect(/class="fk-btn fk-btn-secondary" id="brand-dna-refine"/, "Refine must be secondary");
expect(/class="fk-btn \$\{hasAcceptedResult \? "fk-btn-secondary" : "fk-btn-primary"\}" id="brand-dna-regenerate"/, "Brand DNA generation hierarchy must depend on accepted state");

expect(/class="fk-btn fk-btn-primary" id="brand-avatar-accept"/, "Avatar Accept must be primary");
expect(/class="fk-btn \$\{hasAvatar \? "fk-btn-secondary" : "fk-btn-primary"\}" id="brand-avatar-generate"/, "Avatar regeneration hierarchy must depend on existing Avatar state");
expect(/class="fk-btn fk-btn-ghost" id="brand-avatar-edit"/, "Edit Prompt must be ghost");

assert(app.includes('cancel.className = "fk-btn fk-btn-ghost";'), "Founder Story review cancel must be ghost");
assert(app.includes('apply.className = "fk-btn fk-btn-primary";'), "Founder Story review apply must be primary");
expect(/class="fk-btn fk-btn-ghost" data-import-cancel/, "website import cancel must be ghost");
expect(/class="fk-btn fk-btn-primary" data-founder-story-import-start/, "Retrieve and map must be primary");
expect(/class="fk-btn fk-btn-primary" data-import-apply/, "website import Apply must be primary");
expect(/class="fk-btn fk-btn-ghost" id="founder-story-archetype-later"/, "Founder Story dismissal must be ghost");
expect(/class="fk-btn fk-btn-primary" id="founder-story-archetype-define"/, "Define Brand Archetype must be primary");

expect(/class="fk-btn fk-btn-secondary" id="brand-dna-continue-anyway"/, "preflight continue action must be secondary");
expect(/class="fk-btn fk-btn-primary" id="brand-dna-open-founder-story"/, "preflight Founder Story action must be primary");
expect(/class="fk-btn fk-btn-ghost" data-later>Maybe later/, "Avatar recommendation dismissal must be ghost");
expect(/class="fk-btn fk-btn-primary" data-next>Create Brand Avatar/, "Create Brand Avatar must be primary");
expect(/class="fk-btn fk-btn-ghost" data-later>Explore Brand Brain/, "Campaign recommendation dismissal must be ghost");
expect(/class="fk-btn fk-btn-primary" data-next>Create First Campaign/, "Create First Campaign must be primary");
expect(/class="fk-btn fk-btn-ghost" id="brand-confirm-cancel"/, "Brand suggestion cancel must be ghost");
expect(/class="fk-btn fk-btn-primary" id="brand-confirm-apply"/, "Brand suggestion Apply must be primary");

expect(/<button type="button" class="brand-dna-recommendation-close fk-btn fk-btn-ghost" aria-label="[^"]+"/, "modal close controls must remain named semantic buttons");
assert.match(styles, /\.brand-dna-recommendation-close:focus-visible\s*\{/, "modal close focus state missing");
assert.match(styles, /\.brand-dna-avatar-image:focus-visible\s*\{/, "Avatar preview focus state missing");

const dnaLayout = styles.match(/\.brand-dna-actions\s*\{([^}]*)\}/)?.[1] || "";
for (const property of ["background", "border:", "border-radius", "color:", "font-weight", "padding:"]) {
  assert(!dnaLayout.includes(property), `.brand-dna-actions must not define ${property}`);
}
const modalLayout = styles.match(/\.brand-confirm-actions\s*\{([^}]*)\}/)?.[1] || "";
for (const property of ["background", "border:", "border-radius", "color:", "font-weight", "padding:"]) {
  assert(!modalLayout.includes(property), `.brand-confirm-actions must not define ${property}`);
}

for (const id of ["bc-analyze-domain", "bc-logo-upload", "bc-logo-remove", "brand-dna-accept", "brand-dna-regenerate", "brand-avatar-generate", "brand-core-founder-story-generate-apply"]) {
  assert(app.includes(id), `required DOM ID missing: ${id}`);
}
assert(app.includes('window.getBrandCoreData = getBrandCoreData'), "Brand Core browser global changed");
assert(html.includes('<button id="zoom-out-btn" aria-label="Zoom out">-</button>'), "Canvas zoom control was modified");
assert(html.includes('<button id="zoom-in-btn" aria-label="Zoom in">+</button>'), "Canvas zoom control was modified");

console.log("Brand button system checks passed (20 focused regression groups). ");
