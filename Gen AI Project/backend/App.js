import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import {
  createAuthCookie,
  createJwt,
  hashPassword,
  parseCookies,
  verifyJwt,
  verifyPassword,
} from "./lib/security.js";
import { createRepository } from "./lib/store.js";
import { startInterviewSession, continueInterviewSession } from "./lib/interview.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 3000);
const jwtSecret = process.env.JWT_SECRET || "vivekai-development-secret";
const repository = await createRepository({
  mongoUri: process.env.MONGODB_URI,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(projectRoot, "Frontend");
const frontendIndex = path.join(frontendDir, "index.html");

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(frontendDir, { extensions: ["html"] }));

function getCookieToken(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.vivekai_token || null;
}

function sendAuthCookie(res, token) {
  res.setHeader(
    "Set-Cookie",
    createAuthCookie("vivekai_token", token, {
      maxAge: 7 * 24 * 60 * 60,
    }),
  );
}

function clearAuthCookie(res) {
  res.setHeader(
    "Set-Cookie",
    createAuthCookie("vivekai_token", "", {
      maxAge: 0,
    }),
  );
}

async function requireUser(req, res, next) {
  const token = getCookieToken(req);
  if (!token) {
    return res.status(401).json({ message: "Sign in to continue." });
  }

  try {
    const payload = verifyJwt(token, jwtSecret);
    const user = await repository.getUserById(payload.sub);
    if (!user) {
      return res.status(401).json({ message: "Session expired. Please sign in again." });
    }

    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please sign in again." });
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    name: "VivekAI",
    premium: true,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password } = req.body || {};

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Name, email, and password are required." });
    }

    const existing = await repository.getUserByEmail(email.trim().toLowerCase());
    if (existing) {
      return res.status(409).json({ message: "An account with that email already exists." });
    }

    const user = await repository.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password),
    });

    const token = createJwt(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      7 * 24 * 60 * 60,
    );

    sendAuthCookie(res, token);
    return res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to create account." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await repository.getUserByEmail(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = createJwt(
      {
        sub: user.id,
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      7 * 24 * 60 * 60,
    );

    sendAuthCookie(res, token);
    return res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Unable to sign in." });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

app.get("/api/auth/me", requireUser, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
    },
  });
});

app.get("/api/interviews", requireUser, async (req, res) => {
  const sessions = await repository.listSessionsByUser(req.user.id);
  return res.json({ sessions });
});

app.get("/api/interviews/:id", requireUser, async (req, res) => {
  const session = await repository.getSessionById(req.params.id);
  if (!session || session.userId !== req.user.id) {
    return res.status(404).json({ message: "Interview session not found." });
  }

  return res.json({ session });
});

app.post("/api/interviews/start", requireUser, async (req, res) => {
  try {
    const session = await startInterviewSession(repository, req.user.id, req.body || {});
    return res.status(201).json({
      session,
      assistantMessage: session.messages[0],
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to start interview." });
  }
});

app.post("/api/interviews/:id/message", requireUser, async (req, res) => {
  try {
    const session = await repository.getSessionById(req.params.id);
    if (!session || session.userId !== req.user.id) {
      return res.status(404).json({ message: "Interview session not found." });
    }

    const { message } = req.body || {};
    if (!message?.trim()) {
      return res.status(400).json({ message: "Please send an answer before continuing." });
    }

    const response = await continueInterviewSession(repository, session, message.trim());
    return res.json(response);
  } catch (error) {
    return res.status(400).json({ message: error.message || "Unable to continue interview." });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(frontendIndex);
});

app.use((_req, res) => {
  res.status(404).json({ message: "Route not found." });
});

app.listen(port, () => {
  const mode = process.env.MONGODB_URI ? "Mongo-ready" : "local demo";
  console.log(`VivekAI server running on port ${port} (${mode})`);
});
