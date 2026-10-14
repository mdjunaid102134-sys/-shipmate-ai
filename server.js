require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "1mb" }));

// Serve the main HTML file from the project root.
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Gemini configuration: set these in Render Environment Variables.
const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const isConfigured = () =>
  Boolean(
    API_KEY &&
    API_KEY.trim() &&
    API_KEY !== "PASTE_YOUR_KEY_HERE"
  );

// Health/status endpoint.
app.get("/api/status", (_req, res) => {
  res.json({
    configured: isConfigured(),
    model: MODEL,
    webSearchEnabled: true,
    service: "ShipMate AI",
    note: "Search availability depends on Gemini model and API access."
  });
});

// Chat endpoint.
app.post("/api/chat", async (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({
      error:
        "Gemini API Key সেট করা নেই। Render Dashboard > Environment-এ GEMINI_API_KEY যোগ করুন।"
    });
  }

  const message =
    typeof req.body?.message === "string"
      ? req.body.message.trim()
      : "";

  const rawHistory = Array.isArray(req.body?.history)
    ? req.body.history.slice(-8)
    : [];

  if (!message) {
    return res.status(400).json({
      error: "দয়া করে একটি মেসেজ লিখুন।"
    });
  }

  if (message.length > 10000) {
    return res.status(413).json({
      error: "মেসেজটি অনেক বড়। সর্বোচ্চ ১০,০০০ অক্ষর পাঠান।"
    });
  }

  const systemInstruction = `
You are ShipMate AI, a practical assistant for a beginner in Bangladesh
building a commission-based international shipping lead-generation business.

Reply in Bengali unless the user requests another language.

Help with:
- Freight forwarders and shipping companies
- Prospect research and lead qualification
- Customer communication drafts and follow-ups
- Shipping business planning
- Commission tracking and business reports

For current information, use Google Search grounding when available.
Never invent search results, sources, company details, or current facts.
Clearly distinguish verified information from suggestions.
Provide source URLs when grounding metadata supplies them.
If sources are unavailable, explain that live verification was not confirmed.

SECURITY RULES:
Never claim you contacted a company, sent a message, submitted a form,
received payment, or completed an external action unless a real integration
confirms it. This application does not have an external sending integration.
You may draft messages, but a human must review them.
Marking a draft approved inside the app does not send it.
Never reveal API keys or confidential server configuration.
`;

  // Accept only valid user/model messages from the conversation history.
  const contents = rawHistory
    .filter(
      (item) =>
        item &&
        ["user", "model"].includes(item.role) &&
        typeof item.text === "string" &&
        item.text.trim()
    )
    .map((item) => ({
      role: item.role,
      parts: [{ text: item.text.slice(0, 5000) }]
    }));

  contents.push({
    role: "user",
    parts: [{ text: message }]
  });

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45000);

    let response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          MODEL
        )}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
          },
          signal: controller.signal,
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents,
            tools: [{ google_search: {} }],
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 1600
            }
          })
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const providerMessage =
        data?.error?.message || "Gemini API request failed.";

      console.error(
        "Gemini API error:",
        response.status,
        providerMessage
      );

      return res.status(502).json({
        error:
          "AI সংযোগে সমস্যা হয়েছে। Render Environment-এ API Key, মডেল অ্যাক্সেস এবং Google AI Studio-এর usage limit পরীক্ষা করুন।",
        providerStatus: response.status
      });
    }

    const candidate = data?.candidates?.[0];

    if (!candidate) {
      return res.status(502).json({
        error:
          "AI কোনো উত্তর দেয়নি। API usage limit বা মডেল অ্যাক্সেস পরীক্ষা করে আবার চেষ্টা করুন।"
      });
    }

    const answer = (candidate.content?.parts || [])
      .map((part) => part.text || "")
      .join("")
      .trim();

    if (!answer) {
      return res.status(502).json({
        error:
          "AI থেকে উত্তর পাওয়া যায়নি। অন্য প্রশ্ন দিয়ে আবার চেষ্টা করুন।"
      });
    }

    // Extract source URLs from Google Search grounding metadata.
    const grounding = candidate.groundingMetadata;
    const sources = [];

    for (const chunk of grounding?.groundingChunks || []) {
      const web = chunk?.web;

      if (
        web?.uri &&
        /^https?:\/\//i.test(web.uri) &&
        !sources.some((source) => source.url === web.uri)
      ) {
        sources.push({
          title: web.title || web.uri,
          url: web.uri
        });
      }
    }

    return res.json({
      answer,
      model: MODEL,
      sources,
      searchUsed: sources.length > 0
    });
  } catch (error) {
    if (error.name === "AbortError") {
      return res.status(504).json({
        error:
          "AI উত্তর দিতে বেশি সময় নিচ্ছে। কিছুক্ষণ পর আবার চেষ্টা করুন।"
      });
    }

    console.error("Chat server error:", error.message);

    return res.status(502).json({
      error:
        "সার্ভার থেকে AI-এর উত্তর পাওয়া যায়নি। Render Logs পরীক্ষা করে আবার চেষ্টা করুন।"
    });
  }
});

// Render provides PORT through its environment.
const port = Number(process.env.PORT || 3000);

app.listen(port, "0.0.0.0", () => {
  console.log(`ShipMate AI running on port ${port}`);
});