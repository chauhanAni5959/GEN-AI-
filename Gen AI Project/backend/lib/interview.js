import { randomUUID } from "crypto";

const interviewStyles = {
  mixed: {
    label: "Mixed technical interview",
    categories: ["core", "frontend", "backend", "database", "system-design", "behavioral"],
  },
  frontend: {
    label: "Frontend specialist interview",
    categories: ["core", "frontend", "system-design", "behavioral"],
  },
  backend: {
    label: "Backend specialist interview",
    categories: ["core", "backend", "database", "system-design", "behavioral"],
  },
  fullstack: {
    label: "Full stack interview",
    categories: ["core", "frontend", "backend", "database", "system-design", "behavioral"],
  },
  dsa: {
    label: "Problem solving interview",
    categories: ["dsa", "core", "behavioral"],
  },
};

const questionLibrary = {
  core: [
    "Walk me through how JavaScript handles asynchronous work and event loops.",
    "Explain the difference between shallow copy and deep copy in a real project.",
    "How would you prevent state bugs when several components depend on the same data?",
  ],
  frontend: [
    "How do you optimize rendering in a React application with large lists?",
    "What patterns do you use for managing complex forms and validation?",
    "How would you design a responsive dashboard that feels premium on both desktop and mobile?",
  ],
  backend: [
    "How would you structure an Express API for maintainability and versioning?",
    "How do you design idempotent APIs and why are they important?",
    "What is your approach to request validation, error handling, and observability?",
  ],
  database: [
    "When would you choose indexing strategies differently for read-heavy vs write-heavy workloads?",
    "How do you model relationships and avoid N+1-style data access problems?",
    "What tradeoffs do you consider between normalized and denormalized data models?",
  ],
  "system-design": [
    "Design a scalable interview platform that supports real-time chat and scoring.",
    "How would you architect authentication, session management, and refresh flows?",
    "What would you do to keep response times fast during heavy interview traffic?",
  ],
  behavioral: [
    "Tell me about a time you resolved a technical disagreement on a team.",
    "Describe a project where you had to learn a new stack quickly under pressure.",
    "How do you keep product quality high while moving fast?",
  ],
  dsa: [
    "How would you explain the tradeoff between time complexity and memory usage in a coding task?",
    "Walk through how you would solve a two-pointer or sliding window problem.",
    "How do you think about choosing the right data structure before coding?",
  ],
};

function normalizeChoice(value, fallback) {
  if (!value) {
    return fallback;
  }

  const clean = String(value).trim().toLowerCase();
  if (interviewStyles[clean]) {
    return clean;
  }

  if (clean.includes("front")) return "frontend";
  if (clean.includes("back")) return "backend";
  if (clean.includes("full")) return "fullstack";
  if (clean.includes("algo") || clean.includes("dsa")) return "dsa";
  return fallback;
}

function pickQuestion(session) {
  const categories = interviewStyles[session.interviewStyle]?.categories || interviewStyles.mixed.categories;
  const availablePool = categories.flatMap((category) => questionLibrary[category] || []);
  return availablePool[session.currentIndex % availablePool.length];
}

function evaluateAnswer(answer) {
  const text = answer.toLowerCase();
  const scoreBoost = [
    text.includes("example") ? 12 : 0,
    text.includes("tradeoff") ? 10 : 0,
    text.includes("optimize") ? 10 : 0,
    text.includes("security") ? 8 : 0,
    text.includes("scalable") ? 8 : 0,
    Math.min(18, Math.floor(answer.length / 60) * 3),
  ].reduce((total, value) => total + value, 0);

  const strengths = [];
  if (text.includes("example")) strengths.push("You grounded the answer with a concrete example.");
  if (text.includes("tradeoff")) strengths.push("You showed product and engineering tradeoff awareness.");
  if (text.includes("security")) strengths.push("You considered production safety and trust.");
  if (!strengths.length) strengths.push("The answer was clear and direct.");

  const gap = [];
  if (!text.includes("example")) gap.push("Add one real project example next time.");
  if (!text.includes("metrics")) gap.push("Quantify impact with a number or outcome.");
  if (!text.includes("edge")) gap.push("Call out edge cases and failure modes.");
  if (!gap.length) gap.push("Keep the structure, but tighten the delivery.");

  return {
    scoreBoost,
    strengths,
    gap,
  };
}

async function askOpenAI({ session, userAnswer, nextQuestion }) {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              "You are VivekAI, a premium technical interviewer. Ask one question at a time, keep tone polished and supportive, and return JSON with keys: feedback, nextQuestion, scoreDelta, ended. Do not add markdown fences.",
          },
          {
            role: "user",
            content: JSON.stringify({
              candidateProfile: {
                role: session.role,
                stack: session.stack,
                interviewStyle: session.interviewStyle,
                focusTopics: session.focusTopics,
                level: session.level,
              },
              userAnswer,
              nextQuestion,
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    const content = payload?.choices?.[0]?.message?.content;
    return content || null;
  } catch {
    return null;
  }
}

function safeParseAiJson(content) {
  const trimmed = content.trim();
  const candidate = trimmed.startsWith("{") ? trimmed : trimmed.match(/\{[\s\S]*\}/)?.[0];
  if (!candidate) {
    return null;
  }

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function buildFallbackReply(session, answer) {
  const { scoreBoost, strengths, gap } = evaluateAnswer(answer);
  const nextQuestion = session.currentIndex < session.questionCount - 1 ? pickQuestion({
    ...session,
    currentIndex: session.currentIndex + 1,
  }) : null;

  const feedback = [
    `Score update: +${scoreBoost}.`,
    `Strength: ${strengths[0]}`,
    `Improvement: ${gap[0]}`,
  ].join(" ");

  return {
    feedback,
    nextQuestion,
    scoreDelta: scoreBoost,
    ended: !nextQuestion,
  };
}

export async function startInterviewSession(repository, userId, payload) {
  const role = String(payload.role || "Software Engineer").trim();
  const stack = String(payload.stack || "MERN").trim();
  const level = String(payload.level || "Mid").trim();
  const interviewStyle = normalizeChoice(payload.interviewStyle, "mixed");
  const focusTopics = Array.isArray(payload.focusTopics) ? payload.focusTopics.filter(Boolean).slice(0, 5) : [];

  const seedSession = {
    userId,
    role,
    stack,
    level,
    interviewStyle,
    focusTopics,
    currentIndex: 0,
    score: 0,
    completed: false,
    messages: [],
    questionCount: interviewStyles[interviewStyle]?.categories.length || interviewStyles.mixed.categories.length,
  };

  const firstQuestion = pickQuestion(seedSession);
  const assistantMessage = {
    id: randomUUID(),
    role: "assistant",
    type: "question",
    content: `Welcome to VivekAI. I’ll run a ${interviewStyles[interviewStyle].label.toLowerCase()} for a ${role} role on ${stack}. Let’s start with this: ${firstQuestion}`,
    createdAt: new Date().toISOString(),
  };

  const session = await repository.createSession({
    ...seedSession,
    currentIndex: 0,
    score: 0,
    messages: [assistantMessage],
    currentQuestion: firstQuestion,
  });

  return session;
}

export async function continueInterviewSession(repository, session, answer) {
  const currentQuestion = session.currentQuestion || pickQuestion(session);
  const nextIndex = (session.currentIndex || 0) + 1;
  const nextQuestion = nextIndex < session.questionCount ? pickQuestion({ ...session, currentIndex: nextIndex }) : null;

  const aiText = await askOpenAI({ session, userAnswer: answer, nextQuestion });
  const fallback = buildFallbackReply(session, answer);

  let feedback = fallback.feedback;
  let scoreDelta = fallback.scoreDelta;
  let ended = fallback.ended;
  let suggestedQuestion = fallback.nextQuestion;

  if (aiText) {
    const parsed = safeParseAiJson(aiText);
    if (parsed) {
      feedback = parsed.feedback || feedback;
      scoreDelta = Number.isFinite(parsed.scoreDelta) ? parsed.scoreDelta : scoreDelta;
      ended = Boolean(parsed.ended);
      suggestedQuestion = parsed.nextQuestion || suggestedQuestion;
    } else {
      feedback = aiText;
    }
  }

  const userMessage = {
    id: randomUUID(),
    role: "candidate",
    type: "answer",
    content: answer,
    createdAt: new Date().toISOString(),
  };

  const assistantMessage = {
    id: randomUUID(),
    role: "assistant",
    type: ended ? "closing" : "question",
    content: ended
      ? `${feedback} Great work today. Your interview is complete.`
      : `${feedback} Next up: ${suggestedQuestion || nextQuestion}`,
    createdAt: new Date().toISOString(),
  };

  const updatedSession = await repository.updateSession(session.id, {
    currentIndex: ended ? session.currentIndex : nextIndex,
    currentQuestion: ended ? currentQuestion : (suggestedQuestion || nextQuestion),
    score: Math.max(0, (session.score || 0) + scoreDelta),
    completed: ended,
    messages: [...(session.messages || []), userMessage, assistantMessage],
  });

  return {
    session: updatedSession,
    assistantMessage,
    scoreDelta,
    feedback,
    nextQuestion: ended ? null : (suggestedQuestion || nextQuestion),
    completed: ended,
  };
}
