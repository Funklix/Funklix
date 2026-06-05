const { uploadGeneratedImage } = require("./_image-storage");
const { buildBrandBrainContext } = require("./_brand-brain-context");

function cleanText(value = "", maxLength = 900) {
  const rawValue = value && typeof value === "object" ? JSON.stringify(value) : value;
  const text = String(rawValue || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}…` : text;
}

function cleanList(value = [], maxItems = 8) {
  return (Array.isArray(value) ? value : [value])
    .map((item) => cleanText(item, 220))
    .filter(Boolean)
    .slice(0, maxItems);
}

function buildAvatarPrompt({ brandBrainData = {}, brandDNA = {}, optionalUserDirection = "", brandBrainContext }) {
  const brandAssets = brandBrainData?.brandAssets && typeof brandBrainData.brandAssets === "object" ? brandBrainData.brandAssets : {};
  const primaryArchetype = cleanText(brandDNA.primaryArchetype, 80) || "brand personality";
  const secondaryArchetype = cleanText(brandDNA.secondaryArchetype, 80) || "supporting brand energy";
  const colors = cleanList(brandAssets.colors, 8).join(", ") || "brand-appropriate accent colors";
  const tone = cleanList(brandBrainData.toneOfVoice, 8).join(", ") || "brand-appropriate tone";
  const messagingPillars = cleanList(brandBrainData.messagingPillars, 8).join("; ") || "not provided";
  const valueProposition = cleanText(brandBrainData.valueProposition, 500) || "not provided";
  const recommendedVisualDirection = cleanText(brandDNA.recommendedVisualDirection, 700) || "not provided";
  const recommendedVoice = cleanText(brandDNA.recommendedVoice, 500) || "not provided";
  const domain = cleanText(brandAssets.domain || brandBrainData.website || brandBrainData.domain, 220) || "not provided";
  const userDirection = cleanText(optionalUserDirection, 600);

  return `Create a Brand Avatar image that visualizes the brand personality.

Brand DNA:
- Primary archetype: ${primaryArchetype}
- Secondary archetype: ${secondaryArchetype}
- Reasoning: ${cleanText(brandDNA.reasoning, 700) || "not provided"}
- Recommended voice: ${recommendedVoice}
- Recommended visual direction: ${recommendedVisualDirection}

Brand inputs:
- Brand colors: ${colors}
- Tone of voice: ${tone}
- Messaging pillars: ${messagingPillars}
- Value proposition: ${valueProposition}
- Website/domain or brand asset signal: ${domain}
${userDirection ? `- User direction: ${userDirection}` : ""}

${brandBrainContext.text}

Image requirements:
- Semi-realistic symbolic brand figure, not a mascot and not a logo.
- The avatar should face camera or use a confident 3/4 view.
- Emotionally expressive, suitable as an identity card / AI assistant avatar.
- Strongly aligned with the primary archetype and subtly influenced by the secondary archetype.
- Use brand colors and recommended visual direction as styling influence.
- Premium editorial quality, polished lighting, clear silhouette, centered composition, refined background.
- Make it reusable for Brand Brain identity, AI Review comments, and future AI workflow anchors.

Avoid:
- Mascot, cartoon mascot, logo, emblem-only design, celebrity, identifiable real person, watermark, UI mockup, app screenshot, text-heavy image, typography, letters, numbers, labels, speech bubbles.
- Do not depict an actual customer, founder, employee, or public figure.

Final image style: semi-realistic symbolic figure, modern brand identity avatar, expressive but professional.`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const { boardId = "", brandBrainData = {}, brandDNA = {}, optionalUserDirection = "" } = req.body || {};
    if (!brandDNA?.primaryArchetype || !brandDNA?.userApproved) {
      return res.status(400).json({ error: "Accepted Brand DNA is required before generating a Brand Avatar." });
    }

    const brandBrainContext = buildBrandBrainContext(boardId, brandBrainData);
    const prompt = buildAvatarPrompt({ brandBrainData, brandDNA, optionalUserDirection, brandBrainContext });

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: "1024x1024",
        quality: "high",
        n: 1
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({ error: `OpenAI API error: ${errorBody}` });
    }

    const data = await response.json();
    const imageBase64 = data?.data?.[0]?.b64_json;
    if (!imageBase64) return res.status(500).json({ error: "OpenAI returned no image" });

    const uploaded = await uploadGeneratedImage({ imageBase64, mimeType: "image/png", prefix: "brand-avatar" });
    return res.status(200).json({
      imageUrl: uploaded.imageUrl,
      prompt,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to generate Brand Avatar" });
  }
};
