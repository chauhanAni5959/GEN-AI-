import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "..", "data");
const dataFile = path.join(dataDir, "vivekai-store.json");

async function ensureStore() {
  await fs.mkdir(dataDir, { recursive: true });
  try {
    await fs.access(dataFile);
  } catch {
    await fs.writeFile(dataFile, JSON.stringify({ users: [], sessions: [] }, null, 2), "utf8");
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, "utf8");
  return JSON.parse(raw);
}

async function writeStore(store) {
  await fs.writeFile(dataFile, JSON.stringify(store, null, 2), "utf8");
}

function withoutPassword(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function createRepository({ mongoUri }) {
  if (mongoUri) {
    try {
      const mongoose = await import("mongoose");
      await mongoose.default.connect(mongoUri);
      console.log("Connected to MongoDB");
    } catch (error) {
      console.warn(`MongoDB unavailable, using local store instead: ${error.message}`);
    }
  }

  return {
    async createUser({ name, email, passwordHash }) {
      const store = await readStore();
      const user = {
        id: randomUUID(),
        name,
        email,
        passwordHash,
        createdAt: new Date().toISOString(),
      };
      store.users.push(user);
      await writeStore(store);
      return withoutPassword(user);
    },
    async getUserByEmail(email) {
      const store = await readStore();
      return store.users.find((entry) => entry.email === email) || null;
    },
    async getUserById(id) {
      const store = await readStore();
      const user = store.users.find((entry) => entry.id === id);
      return user ? withoutPassword(user) : null;
    },
    async createSession(session) {
      const store = await readStore();
      const record = {
        ...session,
        id: randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.sessions.unshift(record);
      await writeStore(store);
      return record;
    },
    async getSessionById(id) {
      const store = await readStore();
      return store.sessions.find((entry) => entry.id === id) || null;
    },
    async updateSession(id, updater) {
      const store = await readStore();
      const index = store.sessions.findIndex((entry) => entry.id === id);
      if (index === -1) {
        return null;
      }

      const updated = {
        ...store.sessions[index],
        ...updater,
        updatedAt: new Date().toISOString(),
      };
      store.sessions[index] = updated;
      await writeStore(store);
      return updated;
    },
    async listSessionsByUser(userId) {
      const store = await readStore();
      return store.sessions
        .filter((session) => session.userId === userId)
        .sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
    },
  };
}
