const MAX_TEXT_LENGTH = 900;
const MAX_LIST_ITEMS = 8;

function cleanText(value = "", maxLength = MAX_TEXT_LENGTH) {
  const rawValue = value && typeof value === "object" ? JSON.stringify(value) : value;
  const text = String(rawValue || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function cleanList(value = [], maxItems = MAX_LIST_ITEMS) {
  const source = Array.isArray(value) ? value : [value];
  return source
    .map((item) => cleanText(item, 240))
    .filter(Boolean)
    .slice(0, maxItems);
}

function formatPersona(persona = {}) {
  if (typeof persona === "string") return cleanText(persona, 300);
  if (!persona || typeof persona !== "object") return "";
  const parts = [
    persona.name || persona.title || persona.segment,
    persona.role || persona.jobTitle,
    persona.description || persona.summary,
    persona.needs ? `Needs: ${persona.needs}` : "",
    persona.painPoints ? `Pain points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(", ") : persona.painPoints}` : "",
    persona.motivations ? `Motivations: ${Array.isArray(persona.motivations) ? persona.motivations.join(", ") : persona.motivations}` : ""
  ].map((part) => cleanText(part, 220)).filter(Boolean);
  return cleanText(parts.join(" — "), 500);
}

function formatCustomTile(tile = {}) {
  if (typeof tile === "string") return cleanText(tile, 300);
  if (!tile || typeof tile !== "object") return "";
  const label = cleanText(tile.label || tile.title || tile.name || "Custom context", 80);
  const value = cleanText(tile.value || tile.content || tile.description || tile.text || "", 500);
  return value ? `${label}: ${value}` : "";
}

function hasMeaningfulValue(value) {
  if (Array.isArray(value)) return value.some(hasMeaningfulValue);
  if (!value || typeof value !== "object") return Boolean(cleanText(value));
  return Object.values(value).some(hasMeaningfulValue);
}

function normalizeBrandBrainData(brandBrainData = {}) {
  const data = brandBrainData && typeof brandBrainData === "object" ? brandBrainData : {};
  const brandAssets = data.brandAssets && typeof data.brandAssets === "object" ? data.brandAssets : {};
  const dosAndDonts = data.dosAndDonts && typeof data.dosAndDonts === "object" ? data.dosAndDonts : {};
  const voiceExamples = data.brandVoiceExamples && typeof data.brandVoiceExamples === "object" ? data.brandVoiceExamples : {};

  const icp = Array.isArray(data.personas)
    ? data.personas.map(formatPersona).filter(Boolean).slice(0, 6)
    : cleanList(data.personas, 6);

  const tone = cleanList(data.toneOfVoice, 8);
  const contentGuidelines = cleanList(data.contentGuidelines, 8);
  const messagingPillars = cleanList(data.messagingPillars, 8);
  const valueProposition = cleanText(data.valueProposition, 700);
  const brandCore = cleanText(data.brandCore, 900);

  return {
    icp,
    positioning: brandCore,
    usp: valueProposition,
    offer: cleanText(data.offer || data.coreOffer || valueProposition || brandCore, 700),
    tone,
    archetype: cleanText(data.archetype || data.brandArchetype || (tone.length ? tone.join(", ") : ""), 300),
    messagingPillars,
    ctaGuidance: {
      contentGuidelines,
      dos: cleanList(dosAndDonts.dos, 8),
      donts: cleanList(dosAndDonts.donts, 8)
    },
    visualStyle: {
      domain: cleanText(brandAssets.domain, 200),
      logo: cleanText(brandAssets.logo, 300),
      colors: cleanList(brandAssets.colors, 10),
      typography: cleanText(brandAssets.typography, 300),
      references: cleanList(brandAssets.references, 6)
    },
    brandVoiceExamples: {
      good: cleanText(voiceExamples.good, 500),
      avoid: cleanText(voiceExamples.avoid, 500)
    },
    keywords: cleanList(data.keywords, 16),
    customContext: Array.isArray(data.customTiles)
      ? data.customTiles.map(formatCustomTile).filter(Boolean).slice(0, 8)
      : []
  };
}

function appendLine(lines, label, value) {
  if (Array.isArray(value)) {
    if (value.length) lines.push(`${label}: ${value.join("; ")}`);
    return;
  }
  if (value && typeof value === "object") {
    const nested = Object.entries(value)
      .map(([key, nestedValue]) => {
        if (Array.isArray(nestedValue)) return nestedValue.length ? `${key}: ${nestedValue.join(", ")}` : "";
        return nestedValue ? `${key}: ${nestedValue}` : "";
      })
      .filter(Boolean)
      .join("; ");
    if (nested) lines.push(`${label}: ${nested}`);
    return;
  }
  if (value) lines.push(`${label}: ${value}`);
}

function brandBrainContextToText(normalized, hasBrandBrain) {
  if (!hasBrandBrain) {
    return `Brand Brain Context:\nStatus: not configured or empty. Use only the provided node/campaign context and do not invent brand facts.`;
  }

  const lines = ["Brand Brain Context:", "Status: available. Use this as the authoritative brand strategy context."];
  appendLine(lines, "ICP / audience personas", normalized.icp);
  appendLine(lines, "Positioning", normalized.positioning);
  appendLine(lines, "USP / value proposition", normalized.usp);
  appendLine(lines, "Offer", normalized.offer);
  appendLine(lines, "Tone", normalized.tone);
  appendLine(lines, "Archetype", normalized.archetype);
  appendLine(lines, "Messaging pillars", normalized.messagingPillars);
  appendLine(lines, "CTA guidance", normalized.ctaGuidance);
  appendLine(lines, "Visual style", normalized.visualStyle);
  appendLine(lines, "Brand voice examples", normalized.brandVoiceExamples);
  appendLine(lines, "Keywords", normalized.keywords);
  appendLine(lines, "Custom Brand Brain context", normalized.customContext);
  lines.push("Use the Brand Brain when relevant, but never fabricate unavailable proof, metrics, testimonials, logos, or brand facts.");
  return lines.join("\n");
}

function buildBrandBrainContext(boardId = "", brandBrainData = {}) {
  const normalized = normalizeBrandBrainData(brandBrainData);
  const hasBrandBrain = hasMeaningfulValue(normalized);
  return {
    boardId: cleanText(boardId, 120),
    hasBrandBrain,
    normalized,
    text: brandBrainContextToText(normalized, hasBrandBrain)
  };
}

module.exports = {
  buildBrandBrainContext,
  normalizeBrandBrainData
};
