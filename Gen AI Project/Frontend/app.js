const authPanel = document.getElementById("authPanel");
const dashboard = document.getElementById("dashboard");
const authForm = document.getElementById("authForm");
const authSubmitButton = document.getElementById("authSubmitButton");
const switchModeButton = document.getElementById("switchModeButton");
const authHelperText = document.getElementById("authHelperText");
const nameInput = document.getElementById("nameInput");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");
const logoutButton = document.getElementById("logoutButton");
const sessionForm = document.getElementById("sessionForm");
const chatLog = document.getElementById("chatLog");
const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const sendButton = document.getElementById("sendButton");
const sessionStatus = document.getElementById("sessionStatus");
const welcomeName = document.getElementById("welcomeName");
const roleSummary = document.getElementById("roleSummary");
const stackSummary = document.getElementById("stackSummary");
const focusSummary = document.getElementById("focusSummary");
const progressFill = document.getElementById("progressFill");
const progressText = document.getElementById("progressText");
const scoreValue = document.getElementById("scoreValue");
const roundValue = document.getElementById("roundValue");
const roleInput = document.getElementById("roleInput");
const stackInput = document.getElementById("stackInput");
const levelInput = document.getElementById("levelInput");
const styleInput = document.getElementById("styleInput");
const focusInput = document.getElementById("focusInput");

let isRegisterMode = false;
let currentUser = null;
let currentSession = null;

function setStatus(text, kind = "ready") {
  sessionStatus.textContent = text;
  sessionStatus.style.background = kind === "error" ? "rgba(255, 116, 116, 0.14)" : "rgba(36, 209, 143, 0.14)";
  sessionStatus.style.color = kind === "error" ? "#ffb4b4" : "#8ff0c8";
}

function showAuthMode() {
  authPanel.classList.remove("hidden");
  dashboard.classList.add("hidden");
}

function showDashboard() {
  authPanel.classList.add("hidden");
  dashboard.classList.remove("hidden");
}

function splitFocusTopics(value) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "Something went wrong.");
  }

  return payload;
}

function escapeHtml(input) {
  return String(input)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMessages(messages = []) {
  chatLog.innerHTML = "";

  if (!messages.length) {
    chatLog.innerHTML = `
      <div class="empty-state">
        <h3>Your interview begins here.</h3>
        <p>Choose a role and question style, then let VivekAI open with the first question.</p>
      </div>
    `;
    return;
  }

  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = `chat-message ${message.role}`;
    bubble.innerHTML = `
      <div class="chat-meta">
        <strong>${message.role === "assistant" ? "VivekAI" : currentUser?.name || "You"}</strong>
        <span>${new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <div>${escapeHtml(message.content)}</div>
    `;
    chatLog.appendChild(bubble);
  }

  chatLog.scrollTop = chatLog.scrollHeight;
}

function updateSessionInsights(session) {
  roleSummary.textContent = session.role || "Full Stack Developer";
  stackSummary.textContent = session.stack || "MERN";
  focusSummary.textContent = session.interviewStyle || "Mixed technical";
  scoreValue.textContent = session.score || 0;
  roundValue.textContent = session.currentIndex || 0;

  const total = session.questionCount || 1;
  const progress = Math.min(100, ((session.currentIndex || 0) / total) * 100);
  progressFill.style.width = `${Math.max(6, progress)}%`;
  progressText.textContent = session.completed
    ? "Interview complete. Review the notes and rerun a more advanced round if needed."
    : `Round ${(session.currentIndex || 0) + 1} of ${total}.`;
}

async function loadMe() {
  try {
    const payload = await request("/api/auth/me", { method: "GET" });
    currentUser = payload.user;
    welcomeName.textContent = currentUser.name;
    showDashboard();
    setStatus("Authenticated");

    const sessions = await request("/api/interviews", { method: "GET" });
    if (sessions.sessions?.length) {
      currentSession = sessions.sessions[0];
      renderMessages(currentSession.messages || []);
      updateSessionInsights(currentSession);
      messageInput.disabled = Boolean(currentSession.completed);
      sendButton.disabled = Boolean(currentSession.completed);
      if (currentSession.completed) {
        messageInput.placeholder = "This interview is complete. Start a new session to continue.";
      }
    }
  } catch {
    showAuthMode();
  }
}

switchModeButton.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  authSubmitButton.textContent = isRegisterMode ? "Create account" : "Login";
  switchModeButton.textContent = isRegisterMode ? "Back to login" : "Create account";
  authHelperText.textContent = isRegisterMode
    ? "Create your premium VivekAI account to save sessions."
    : "Use your account to save premium interview sessions.";
  nameInput.parentElement.style.display = isRegisterMode ? "grid" : "none";
});

nameInput.parentElement.style.display = "none";

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const body = {
      email: emailInput.value,
      password: passwordInput.value,
    };

    if (isRegisterMode) {
      body.name = nameInput.value;
    }

    const payload = await request(`/api/auth/${isRegisterMode ? "register" : "login"}`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    currentUser = payload.user;
    welcomeName.textContent = currentUser.name;
    authForm.reset();
    showDashboard();
    setStatus("Authenticated");
    await loadMe();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

logoutButton.addEventListener("click", async () => {
  try {
    await request("/api/auth/logout", { method: "POST", body: JSON.stringify({}) });
  } finally {
    currentUser = null;
    currentSession = null;
    messageInput.value = "";
    messageInput.disabled = true;
    sendButton.disabled = true;
    renderMessages([]);
    setStatus("Logged out");
    showAuthMode();
  }
});

sessionForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const payload = await request("/api/interviews/start", {
      method: "POST",
      body: JSON.stringify({
        role: roleInput.value,
        stack: stackInput.value,
        level: levelInput.value,
        interviewStyle: styleInput.value,
        focusTopics: splitFocusTopics(focusInput.value),
      }),
    });

    currentSession = payload.session;
    renderMessages(currentSession.messages || []);
    updateSessionInsights(currentSession);
    messageInput.disabled = Boolean(currentSession.completed);
    sendButton.disabled = Boolean(currentSession.completed);
    messageInput.placeholder = currentSession.completed
      ? "This interview is complete. Start a new session to continue."
      : "Type your answer here...";
    setStatus("Interview started");
    messageInput.focus();
  } catch (error) {
    setStatus(error.message, "error");
  }
});

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentSession || currentSession.completed) {
    return;
  }

  const answer = messageInput.value.trim();
  if (!answer) {
    return;
  }

  sendButton.disabled = true;
  try {
    const payload = await request(`/api/interviews/${currentSession.id}/message`, {
      method: "POST",
      body: JSON.stringify({ message: answer }),
    });

    currentSession = payload.session;
    renderMessages(currentSession.messages || []);
    updateSessionInsights(currentSession);
    messageInput.value = "";
    messageInput.disabled = Boolean(currentSession.completed);
    sendButton.disabled = Boolean(currentSession.completed);
    messageInput.placeholder = currentSession.completed
      ? "This interview is complete. Start a new session to continue."
      : "Type your answer here...";
    setStatus(currentSession.completed ? "Interview complete" : "Awaiting next round");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    sendButton.disabled = Boolean(currentSession?.completed);
  }
});

loadMe();
