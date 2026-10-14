require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

const API_KEY = process.env.OPENROUTER_API_KEY;

// OpenRouter-এর ফ্রি মডেল রাউটার
const MODEL = process.env.OPENROUTER_MODEL || "openrouter/free";

app.use(express.json({ limit: "1mb" }));

app.use(express.static(__dirname));

// Server status
app.get("/api/status", (_req, res) => {
  res.json({
    success: true,
    provider: "OpenRouter",
    configured: Boolean(API_KEY),
    model: MODEL
  });
});

// AI chat
async function handleChat(req, res) {
  try {
    if (!API_KEY) {
      return res.status(503).json({
        error: "OpenRouter API key কনফিগার করা নেই।"
      });
    }

    const { message, messages } = req.body || {};

    let chatMessages;

    if (Array.isArray(messages) && messages.length > 0) {
      chatMessages = messages;
    } else if (
      typeof message === "string" &&
      message.trim()
    ) {
      chatMessages = [
        { role: "user", content: message.trim() }
      ];
    } else {
      return res.status(400).json({
        error: "একটি সঠিক মেসেজ পাঠান।"
      });
    }

    if (chatMessages.length > 50) {
      return res.status(400).json({
        error: "একবারে সর্বোচ্চ ৫০টি মেসেজ পাঠানো যাবে।"
      });
    }

    const validMessages = chatMessages.every((item) =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.content.length <= 20000
    );

    if (!validMessages) {
      return res.status(400).json({
        error: "মেসেজের ফরম্যাট সঠিক নয়।"
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          "Content-Type": "application/json",
          "X-Title": "ShipMate AI"
        },
        body: JSON.stringify({
          model: MODEL,
          messages: chatMessages,
          stream: false
        }),
        signal: AbortSignal.timeout(60000)
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter API error:", {
        status: response.status,
        code: data?.error?.code,
        message: data?.error?.message
      });

      if (response.status === 429) {
        return res.status(429).json({
          error:
            "ফ্রি AI ব্যবহারের সীমা শেষ হয়েছে। পরে আবার চেষ্টা করুন।"
        });
      }

      if (response.status === 401 ||
          response.status === 403) {
        return res.status(502).json({
          error:
            "OpenRouter API key বা মডেল ব্যবহারের অনুমতিতে সমস্যা হয়েছে।"
        });
      }

      return res.status(502).json({
        error:
          "AI সার্ভার বর্তমানে উত্তর দিতে পারছে না। পরে আবার চেষ্টা করুন।"
      });
    }

    const reply =
      data?.choices?.[0]?.message?.content;

    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({
        error: "AI থেকে কোনো উত্তর পাওয়া যায়নি।"
      });
    }

    return res.json({
      success: true,
      provider: "OpenRouter",
      model: data.model || MODEL,
      reply: reply.trim()
    });

  } catch (error) {
    console.error("Chat request failed:", error.message);

    if (error.name === "TimeoutError" ||
        error.name === "AbortError") {
      return res.status(504).json({
        error: "AI উত্তর দিতে বেশি সময় নিচ্ছে। আবার চেষ্টা করুন।"
      });
    }

    return res.status(502).json({
      error: "AI সার্ভারের সঙ্গে সংযোগ করা যায়নি।"
    });
  }
}

// মূল chat endpoint
app.post("/api/chat", handleChat);

// আগের বিকল্প endpoint-এর সঙ্গে সামঞ্জস্য
app.post("/api/alternative-chat", handleChat);

app.listen(PORT, () => {
  console.log(`ShipMate AI running on port ${PORT}`);
  console.log(`AI provider: OpenRouter`);
  console.log(`AI model: ${MODEL}`);
});