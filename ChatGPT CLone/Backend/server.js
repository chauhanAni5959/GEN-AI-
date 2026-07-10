const express = require("express");
const cors = require("cors");
// const { OpenAI } = require("openai");
const { Groq } = require("groq-sdk");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware configuration
app.use(cors());
app.use(express.json());

// Initialize Groq Instance using key from environment variables
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Primary Dialogue API Endpoint
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message payload data is required." });
  }

  try {
    // Map previous chat logs into a syntax structure Groq recognizes
    const formattedHistory = (history || []).map((chat) => ({
      role: chat.role,
      content: chat.content,
    }));

    const messagePayload = [
      {
        role: "system",
        content:
          "You are a precise, helpful clone of ChatGPT. Respond clearly and accurately.",
      },
      ...formattedHistory,
      { role: "user", content: message },
    ];

    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b", // Highly responsive, cost-effective processing model
      messages: messagePayload,
    });

    const aiReply = completion.choices[0].message.content;
    res.json({ reply: aiReply });
  } catch (error) {
    console.error("Server error handling prompt request:", error.message);
    res
      .status(500)
      .json({ error: "Failed to safely generate structural model response." });
  }
});

app.listen(PORT, () => {
  console.log(
    `🚀 Chat Server successfully mounted on http://localhost:${PORT}`,
  );
});
