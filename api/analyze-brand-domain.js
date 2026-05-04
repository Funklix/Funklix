module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Server is missing OPENAI_API_KEY" });

  try {
    const { domainUrl = "" } = req.body || {};
    if (!domainUrl) return res.status(400).json({ error: "domainUrl is required" });

    let normalized = domainUrl.trim();
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

    const pageRes = await fetch(normalized, {
      redirect: "follow",
      headers: { "User-Agent": "CampaignCanvasBrandAnalyzer/1.0" }
    });
    if (!pageRes.ok) return res.status(400).json({ error: "Could not fetch website" });

    const html = await pageRes.text();
    const safeHtml = html.slice(0, 300000);

    const title = (safeHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/\s+/g, " ").trim();
    const description = (safeHtml.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] || "").trim();
    const headings = [...safeHtml.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 20);
    const nav = [...safeHtml.matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter((x) => x && x.length < 40).slice(0, 30);
    const paragraphs = [...safeHtml.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 30);

    const extracted = [
      `URL: ${normalized}`,
      `Title: ${title}`,
      `Meta description: ${description}`,
      `Headings: ${headings.join(" | ")}`,
      `Navigation labels: ${nav.join(" | ")}`,
      `Paragraphs: ${paragraphs.join("\n")}`
    ].join("\n").slice(0, 12000);

    const prompt = `Analyze the website text context and produce a concise Brand Brain JSON object.
Return ONLY valid JSON with this exact shape and keys:
{
  "brandCore": "",
  "toneOfVoice": [],
  "messagingPillars": [],
  "valueProposition": "",
  "personas": [],
  "contentGuidelines": [],
  "dosAndDonts": { "dos": [], "donts": [] },
  "brandVoiceExamples": { "good": "", "avoid": "" },
  "keywords": [],
  "brandAssets": { "domain": "", "logo": "", "colors": [], "typography": "", "references": [] }
}
Rules:
- Keep arrays concise (3-8 items).
- persona entries should be objects: {"name":"","note":""}
- Fill brandAssets.domain with the website URL.
- If unsure, leave fields conservative and useful.
Website context:\n${extracted}`;

    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }]
      })
    });

    if (!aiRes.ok) return res.status(502).json({ error: "AI analysis failed" });
    const ai = await aiRes.json();
    const text = ai?.choices?.[0]?.message?.content || "";
    const parsed = JSON.parse(text);
    return res.status(200).json({ suggestions: parsed });
  } catch (error) {
    return res.status(500).json({ error: error?.message || "Failed to analyze domain" });
  }
};
