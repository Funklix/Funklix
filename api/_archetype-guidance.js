const ARCHETYPE_GUIDANCE = {
  creator: {
    motivations: ["make something original", "express a distinct point of view", "turn imagination into tangible work", "improve through craft and experimentation"],
    communicationStyle: ["inventive", "expressive", "specific", "possibility-oriented", "confident without sounding corporate"],
    preferredThemes: ["originality", "self-expression", "innovation", "creative agency", "making ideas real", "personal vision"],
    preferredEmotions: ["inspiration", "curiosity", "creative confidence", "pride in craft", "optimism"],
    preferredStorytellingPatterns: ["from blank page to breakthrough", "show the creative process", "celebrate individuality", "position the audience as makers or builders"],
    avoid: ["generic marketing clichés", "bureaucratic tone", "copycat positioning", "overly rigid formulas", "conformity messaging"]
  },
  explorer: {
    motivations: ["seek freedom", "discover better paths", "escape limitations", "learn through direct experience", "pursue independence"],
    communicationStyle: ["open", "adventurous", "energizing", "direct", "self-directed"],
    preferredThemes: ["freedom", "discovery", "independence", "new horizons", "experimentation", "personal growth"],
    preferredEmotions: ["excitement", "wonder", "courage", "restlessness", "liberation"],
    preferredStorytellingPatterns: ["journey from constraint to possibility", "invite discovery", "frame offers as paths or expeditions", "highlight choice and autonomy"],
    avoid: ["restrictive language", "heavy-handed rules", "safe sameness", "claustrophobic corporate framing", "one-size-fits-all claims"]
  },
  sage: {
    motivations: ["understand the truth", "clarify complexity", "share useful knowledge", "make smarter decisions", "build authority through insight"],
    communicationStyle: ["clear", "evidence-aware", "thoughtful", "precise", "calmly authoritative"],
    preferredThemes: ["wisdom", "clarity", "learning", "expertise", "proof", "better judgment"],
    preferredEmotions: ["confidence", "relief", "intellectual curiosity", "trust", "focus"],
    preferredStorytellingPatterns: ["from confusion to clarity", "teach a useful framework", "reveal an overlooked truth", "use insight to change behavior"],
    avoid: ["hype without substance", "vague claims", "overly emotional manipulation", "unsupported certainty", "dumbing down the audience"]
  },
  hero: {
    motivations: ["overcome obstacles", "prove capability", "achieve meaningful goals", "protect progress", "rise to a challenge"],
    communicationStyle: ["bold", "motivating", "action-oriented", "resilient", "high-conviction"],
    preferredThemes: ["achievement", "courage", "discipline", "momentum", "mastery", "winning against odds"],
    preferredEmotions: ["determination", "confidence", "urgency", "pride", "resolve"],
    preferredStorytellingPatterns: ["challenge to victory", "call the audience to act", "show progress earned through effort", "turn friction into fuel"],
    avoid: ["passive language", "victim framing", "timid CTAs", "comfort-first complacency", "unsupported bravado"]
  },
  magician: {
    motivations: ["create transformation", "make the impossible feel possible", "unlock hidden potential", "connect vision with results", "change how people see reality"],
    communicationStyle: ["visionary", "transformational", "elevated", "imaginative", "outcome-focused"],
    preferredThemes: ["transformation", "breakthrough", "potential", "alchemy", "future state", "hidden possibilities"],
    preferredEmotions: ["awe", "hope", "anticipation", "belief", "delight"],
    preferredStorytellingPatterns: ["before-and-after transformation", "reveal the unseen mechanism", "paint the future state", "turn complexity into wonder"],
    avoid: ["flat functional language", "overexplaining the magic", "empty mysticism", "cynical framing", "incremental-only promises"]
  },
  rebel: {
    motivations: ["challenge the status quo", "break outdated rules", "create liberation", "reject what no longer works", "spark change"],
    communicationStyle: ["provocative", "direct", "unfiltered", "challenger-minded", "confident"],
    preferredThemes: ["disruption", "liberation", "rule-breaking", "truth-telling", "defiance", "reinvention"],
    preferredEmotions: ["defiance", "energy", "relief", "boldness", "urgency"],
    preferredStorytellingPatterns: ["name the broken system", "contrast old rules with a better way", "invite people to opt out", "turn frustration into action"],
    avoid: ["polite corporate blandness", "appeasing everyone", "softening the point too much", "empty shock value", "reckless claims"]
  },
  caregiver: {
    motivations: ["help people feel supported", "reduce pain or stress", "protect wellbeing", "serve with empathy", "create safety"],
    communicationStyle: ["warm", "reassuring", "empathetic", "practical", "patient"],
    preferredThemes: ["support", "care", "protection", "service", "wellbeing", "reliability"],
    preferredEmotions: ["comfort", "trust", "relief", "gratitude", "belonging"],
    preferredStorytellingPatterns: ["from stress to support", "show care in action", "center human needs", "make the audience feel understood"],
    avoid: ["cold transactional language", "pressure tactics", "dismissive tone", "overly aggressive CTAs", "self-centered brand heroics"]
  },
  ruler: {
    motivations: ["create order", "lead with authority", "raise standards", "protect stability", "build lasting success"],
    communicationStyle: ["polished", "decisive", "commanding", "structured", "premium"],
    preferredThemes: ["leadership", "control", "excellence", "standards", "legacy", "stability"],
    preferredEmotions: ["confidence", "security", "ambition", "respect", "assurance"],
    preferredStorytellingPatterns: ["from chaos to command", "set a higher standard", "show disciplined leadership", "frame the audience as decision-makers"],
    avoid: ["messy casualness", "unclear hierarchy", "cheap or gimmicky language", "indecision", "overly playful tone"]
  },
  lover: {
    motivations: ["create connection", "deepen desire", "celebrate beauty", "make experiences feel personal", "build intimacy and appreciation"],
    communicationStyle: ["sensory", "warm", "emotionally rich", "elegant", "personal"],
    preferredThemes: ["connection", "beauty", "desire", "belonging", "pleasure", "devotion"],
    preferredEmotions: ["desire", "warmth", "joy", "appreciation", "intimacy"],
    preferredStorytellingPatterns: ["make the audience feel seen", "focus on moments and senses", "show the emotional payoff", "turn utility into meaningful experience"],
    avoid: ["sterile language", "purely transactional framing", "cold feature lists", "awkward over-intimacy", "generic sentimentality"]
  },
  jester: {
    motivations: ["create joy", "make moments lighter", "surprise people", "turn attention into delight", "help people enjoy the present"],
    communicationStyle: ["playful", "witty", "punchy", "unexpected", "approachable"],
    preferredThemes: ["fun", "surprise", "lightness", "play", "cleverness", "spontaneity"],
    preferredEmotions: ["delight", "amusement", "ease", "surprise", "joy"],
    preferredStorytellingPatterns: ["set up and subvert expectations", "use playful analogies", "make the problem feel approachable", "turn friction into a memorable moment"],
    avoid: ["stiff seriousness", "overly dense explanations", "mean-spirited jokes", "forced humor", "humor that weakens clarity"]
  },
  innocent: {
    motivations: ["make life simpler", "restore optimism", "do the right thing", "create ease", "help people feel safe and hopeful"],
    communicationStyle: ["simple", "clear", "honest", "uplifting", "gentle"],
    preferredThemes: ["simplicity", "trust", "goodness", "fresh starts", "clarity", "peace of mind"],
    preferredEmotions: ["hope", "calm", "relief", "happiness", "trust"],
    preferredStorytellingPatterns: ["from complication to simplicity", "show a clean fresh start", "use plainspoken reassurance", "highlight what is wholesome and easy"],
    avoid: ["cynicism", "complex jargon", "fear-heavy framing", "edgy shock tactics", "overpromising perfection"]
  },
  everyman: {
    motivations: ["belong", "be useful and relatable", "make progress accessible", "connect through shared experience", "earn trust through honesty"],
    communicationStyle: ["plainspoken", "friendly", "practical", "humble", "relatable"],
    preferredThemes: ["belonging", "accessibility", "shared progress", "fairness", "everyday wins", "community"],
    preferredEmotions: ["trust", "ease", "solidarity", "encouragement", "reassurance"],
    preferredStorytellingPatterns: ["real-life relatable problem to practical solution", "use everyday examples", "show people like the audience succeeding", "make the offer feel approachable"],
    avoid: ["elitist tone", "overly polished distance", "jargon", "exclusive status signaling", "talking down to the audience"]
  }
};

function normalizeArchetypeName(value = "") {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "");
}

function getArchetypeGuidance(archetype = "") {
  return ARCHETYPE_GUIDANCE[normalizeArchetypeName(archetype)] || null;
}

module.exports = {
  ARCHETYPE_GUIDANCE,
  getArchetypeGuidance,
  normalizeArchetypeName
};
