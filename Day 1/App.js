import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export async function main() {
  const stream = await getGroqChatStream();
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content;
    if (text) {
      process.stdout.write(text);
    }
  }
}

export async function getGroqChatStream() {
  return groq.chat.completions.create({
    messages: [
      {
        role: "system",
        content: "You are a helpful assistant. Answer the user's question clearly and concisely.",
      },

      {
        role: "user",
        content: "What is the weather of the day in New York City?",
      },
    ],

    model: "llama-3.3-70b-versatile",

    temperature: 0,

    max_completion_tokens: 4096,

    top_p: 1,

    stop: null,

    stream: true,
  });
}

main();

async function webSearch({ query }) {
  return "I am from web search";
}
