require("dotenv").config();
const express = require("express");
const path = require("path");
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

app.get("/api/status", (_req, res) => res.json({
  configured: Boolean(API_KEY && API_KEY !== "PASTE_YOUR_KEY_HERE"),
  model: MODEL,
  webSearchEnabled: true,
  note: "Google Search grounding is requested for research answers; availability depends on model/API account."
}));

app.post("/api/chat", async (req, res) => {
  if (!API_KEY || API_KEY === "PASTE_YOUR_KEY_HERE") {
    return res.status(503).json({ error: "AI চালু করতে সার্ভারের .env ফাইলে Gemini API key যোগ করুন।" });
  }
  const message = String(req.body?.message || "").trim();
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-8) : [];
  if (!message) return res.status(400).json({ error: "মেসেজ লিখুন।" });

  const systemInstruction = `You are ShipMate AI, a practical assistant for a beginner in Bangladesh building a commission-based international shipping lead-generation business.
Reply in Bengali unless asked otherwise. Help with freight forwarders, shipping companies, prospecting, lead qualification, follow-ups, and commission tracking.
For requests needing current facts, research the web using Google Search grounding when available. Clearly distinguish verified web facts from suggestions. Include source URLs in your answer when the grounded response provides them. If search fails or no sources are provided, say the information could not be live-verified.
Never claim you contacted a company, sent a message, opened a phone app, or submitted a form.
SECURITY: Never send messages, contact customers, submit forms, or make commitments. You may draft a message. This app has no external sending integration. A human must review and approve each exact draft separately. Approval in this app only marks a draft approved; it does not send it.`;

  const contents = [
    ...history.filter(x => x && ["user", "model"].includes(x.role) && typeof x.text === "string")
      .map(x => ({ role: x.role, parts: [{ text: x.text.slice(0, 5000) }] })),
    { role: "user", parts: [{ text: message.slice(0, 10000) }] }
  ];
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent?key=${encodeURIComponent(API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents,
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 1600 }
        })
      }
    );
    const data = await response.json();
    if (!response.ok) {
      const msg = data?.error?.message || "AI provider request failed.";
      return res.status(response.status).json({
        error: "AI/Search সংযোগে সমস্যা: " + msg + "\nAPI key, model access এবং Google AI Studio usage limit পরীক্ষা করুন।"
      });
    }
    const candidate = data?.candidates?.[0];
    const answer = (candidate?.content?.parts || []).map(p => p.text || "").join("").trim();
    const grounding = candidate?.groundingMetadata;
    const sources = [];
    for (const chunk of (grounding?.groundingChunks || [])) {
      const web = chunk?.web;
      if (web?.uri && !sources.some(s => s.url === web.uri)) {
        sources.push({ title: web.title || web.uri, url: web.uri });
      }
    }
    if (!answer) return res.status(502).json({ error: "AI থেকে উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।" });
    res.json({ answer, model: MODEL, sources, searchUsed: sources.length > 0 });
  } catch (_err) {
    res.status(502).json({ error: "সার্ভারের সঙ্গে সংযোগ হয়নি। সার্ভার ও ইন্টারনেট পরীক্ষা করুন।" });
  }
});
const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`ShipMate AI running on port ${port}`));