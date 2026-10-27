'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const app = fs.readFileSync('app.js','utf8'), c={};
vm.runInNewContext(app.slice(app.indexOf('function aiBrainHasReusableContent'),app.indexOf('// A deliberately small supported format.')),c);
const en="Here's a LinkedIn post you can use:\nYour first sketch doesn't need to be perfect. It needs a place to begin. Share the experiment behind your next idea with a community that values the process. Join our next workshop.";
const de='Hier ist ein konkreter LinkedIn-Beitrag:\nDeine erste Skizze muss nicht perfekt sein. Sie braucht einen Anfang. Teile das Experiment hinter deiner nächsten Idee mit einer Gemeinschaft, die deinen eigenen Weg schätzt. Melde dich zum Workshop an.';
const concept='Content idea: The first sketch\nShow a weekly portrait series of independent creators and the choices behind their first sketch to help the community start experimenting.';
const messaging='Campaign messaging: Make room\nMake room for the idea you have been postponing. Our workshop brings independent makers together to explore new formats. Discover the next session and book your seat.';
const landing='Landing page copy — Your next idea\nA place for unfinished ideas. Explore a new format alongside independent makers and turn your first sketch into a shared experiment. Book your workshop seat today.';
const old='Content concept: First sketches\nAudience: Independent makers\nMessage: Share the story behind your work.\nPurpose: Invite the community to participate.';
const fixtures=[en,de,concept,messaging,landing,old,old.replaceAll('\n','\n### '),old.replace('Share the story behind your work.','Share your LinkedIn post with our creative community.'),en.replaceAll('\n','\r\n'),en.replace("Here's a LinkedIn post you can use:", '### **LinkedIn post:**')];
for(const answer of fixtures)for(const adviceMode of ['general','review_strategy','explore_ideas','find_gaps','evaluate_options']) {
 const turn={status:'success',answer,adviceMode};assert(c.aiBrainHasReusableContent(turn),answer);
 for(const a of c.aiBrainContentAssets(turn))assert.equal(a.text,answer.slice(a.start,a.end));
}
for(const answer of ['', 'Thanks!', 'Which audience do you mean?', 'Review the funnel before changing the message.', 'Campaign concept: A month of creative workshops\nGoal: Build awareness\nAudience: Independent creators\nChannels: LinkedIn and email\nCTA: Join the workshop.', 'Social post: Diagnostic\nCaption: Too short\nCTA: No', 'Content concept: Strategy\nAudience: Everyone\nPurpose: Grow', 'Proposed Value Proposition: A community where makers share their work.', 'LinkedIn post: Recommendation\nYou should share more useful content with your audience. Start by reviewing your strategy and deciding which channels to prioritize.'])assert(!c.aiBrainHasReusableContent({status:'success',answer}),answer);
for(const status of ['pending','failed'])assert(!c.aiBrainHasReusableContent({status,answer:en}));
assert(!c.aiBrainHasReusableContent({status:'success',answer:en,referenceResolution:'clarification'}));
assert(!c.aiBrainHasReusableContent({status:'success',answer:'x'.repeat(12001)}));
const multi=`Strategy context before the assets.\n\n${en}\n\n${de}\n\n## Strategic next steps\nReview the campaign plan.`;
const assets=c.aiBrainContentAssets({status:'success',answer:multi});assert.equal(assets.length,2);
assert(assets[0].text.includes('Your first sketch'));assert(!assets[0].text.includes('Deine erste'));assert(!assets[1].text.includes('Strategic next steps'));
const numbered='1. '+en.split('\n')[1]+'\n\n2. '+de.split('\n')[1];
assert.equal(c.aiBrainContentAssets({status:'success',question:'Write a social post',answer:numbered}).length,2);
const quoted='“'+en.split('\n')[1]+'”\n\n“'+de.split('\n')[1]+'”';
assert.equal(c.aiBrainContentAssets({status:'success',question:'Write a social post',answer:quoted}).length,2);
assert(c.aiBrainHasReusableContent({status:'success',question:'Suggest a specific reusable content concept',answer:concept.split('\n')[1]}));
const numberedLabels=en.replace("Here's a LinkedIn post you can use:",'LinkedIn post 1:')+'\n\n'+de.replace('Hier ist ein konkreter LinkedIn-Beitrag:','LinkedIn post 2:');
assert.equal(c.aiBrainContentAssets({status:'success',answer:numberedLabels}).length,2);
const incomplete='Content concept: One\nAudience: Independent makers\n\nContent concept: Two\nMessage: Share the story behind your work.\nPurpose: Invite the community to participate.';
assert.equal(c.aiBrainContentAssets({status:'success',answer:incomplete}).length,0,'never borrow fields across assets');

// Codex P2 regression: quotations within one supported labelled caption are
// testimonials belonging to that asset, not independent alternative posts.
const testimonials='LinkedIn post: Customer stories\nCaption:\n"Before the workshop, I had a folder full of unfinished sketches and no confidence to take the next step."\n\n"Working alongside other independent makers gave me a place to explore my own process and finish an experiment."\nCTA: Book your workshop seat today.';
assert.equal(c.aiBrainContentAssets({status:'success',answer:'LinkedIn post: Two alternatives\n'+quoted}).length,2);
assert.equal(c.aiBrainContentAssets({status:'success',question:'Write two posts with customer testimonials',answer:testimonials}).length,1,'a request for alternatives cannot override a complete labelled source asset');
assert.equal(c.aiBrainContentAssets({status:'success',answer:testimonials+'\n\n'+testimonials.replace('Customer stories','More customer stories')}).length,2,'quotes inside two explicit assets do not become separate sources');
const testimonialsAssets=c.aiBrainContentAssets({status:'success',answer:testimonials});assert.equal(testimonialsAssets.length,1);assert.equal(testimonialsAssets[0].text,testimonials);
const embedded='A campaign needs a focused individual invitation.\n\n“'+en.split('\n')[1]+'”\n\n## Next steps\nReview the campaign strategy.';
const embeddedAssets=c.aiBrainContentAssets({status:'success',answer:embedded});assert.equal(embeddedAssets.length,1);assert(!embeddedAssets[0].text.includes('Next steps'));
assert.equal(c.aiBrainContentAssets({status:'success',answer:'Proposed Brand Value Proposition:\n“'+en.split('\n')[1]+'”'}).length,0,'a replacement Brand value alone does not become Content');
console.log('PASS production eligibility: natural EN/DE, legacy/Markdown/CRLF, all modes, campaign/diagnostic negatives and exact isolated asset offsets');

// BW-37.1C-3B-R1: exact live Appics answer, including its fifth-level headings.
const appics=fs.readFileSync('scripts/fixtures/bw37-1c3b-r1-appics-response.txt','utf8');
const checkPair=answer=>{
 const turn={status:'success',answer},assets=c.aiBrainContentAssets(turn);
 assert.equal(assets.length,2);
 assert.match(assets[0].text,/Instagram/);assert.match(assets[1].text,/X(?: Post|[- ]Beitrag)/);
 for(const [i,a] of assets.entries()){
  assert.equal(a.text,answer.slice(a.start,a.end));assert.match(a.text,/\*\*CTA:\*\*/);assert.match(a.text,/\*\*Hashtags:\*\*/);
  assert(!a.text.includes('Here are two'));assert(!a.text.includes('Assumptions'));assert(!a.text.includes('---'));
  assert(!a.text.includes(i===0?'🚀 Tired':'✨ Every'));
 }
 assert.match(assets[0].text,/Let’s build a community/);assert.match(assets[0].text,/#CelebrateCreativity #Appics/);
 assert.match(assets[1].text,/Your voice matters/);assert.match(assets[1].text,/#ContentOwnership #CensorshipFree/);
 assert(assets[0].end<=assets[1].start);return assets;
};
checkPair(appics);
for(let level=1;level<=6;level++)for(const german of [false,true]){
 let answer=appics.replaceAll('#####','#'.repeat(level));
 if(german)answer=answer.replace('Instagram Post','Instagram-Beitrag').replace('X Post','X Beitrag');
 checkPair(answer);checkPair(answer.replaceAll('\n','\r\n'));
 // Heading fields are part of the post, even when nested at any level.
 checkPair(answer.replace(/\*\*(Caption|Tweet|CTA|Hashtags):\*\*/g,`${'#'.repeat(level)} **$1:**`));
}
checkPair(appics+'\n\n**Assumptions:** Fictional trailing AI metadata.');
for(const platform of ['X Post','X-Beitrag','Twitter Post','Twitter-Beitrag']){
 // No action keyword: this must pass the structured Tweet/CTA owner, not
 // merely the natural-copy fallback that masked the fifth-level heading gap.
 const structured=`###### ${platform}\n###### **Tweet:**\nIndependent creators deserve a community where their creative work has lasting value and every unique perspective has a welcoming home.\n###### **CTA:** Become a member today.\n###### **Hashtags:** #Creators`;
 const result=c.aiBrainContentAssets({status:'success',answer:structured});assert.equal(result.length,1);assert.equal(result[0].text,structured);
}
const quotedAppics=appics.replace('Let’s build a community', '"A folder of sketches became my first creative breakthrough."\n\n"Every experiment helped me find my voice."\n\nLet’s build a community');
checkPair(quotedAppics);
const internalSeparator=appics.replace('Let’s build a community','---\n\nLet’s build a community');
const separated=c.aiBrainContentAssets({status:'success',answer:internalSeparator});assert.equal(separated.length,2);assert.match(separated[0].text,/---\n\nLet’s/);
const single=appics.slice(appics.indexOf('##### X Post'));assert.equal(c.aiBrainContentAssets({status:'success',answer:single})[0].text,single);
assert.equal(c.aiBrainContentAssets({status:'success',answer:'Here are two posts: Instagram and X. Which should we draft first?'}).length,0);
console.log('PASS R1 exact Appics pair, EN/DE platforms, six heading levels/fields, CRLF, Tweet validation, metadata, internal testimonials/separators and single/ambiguous responses');
