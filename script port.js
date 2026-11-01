"use strict";

/* ===========================================================
   CONSTANTS
   =========================================================== */
const STORAGE_KEY = "portfolioMessages";   // array of message objects (JSON)
const THEME_KEY = "portfolioTheme";        // "light" | "dark"
const ADMIN_KEY = "portfolioAdminLoggedIn"; // sessionStorage flag

// Demo admin credentials (frontend-only project)
const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "admin123";

// Simple email regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ===========================================================
   SAFE STORAGE HELPERS
   =========================================================== */
function getMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    return [];
  }
}

function saveMessages(messages) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    return true;
  } catch (err) {
    return false;
  }
}

/* ===========================================================
   DOM REFERENCES
   =========================================================== */
const html = document.documentElement;
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const menuToggle = document.getElementById("menuToggle");
const navLinks = document.getElementById("navLinks");
const navLinkItems = document.querySelectorAll(".nav-link");

const contactForm = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const emailInput = document.getElementById("email");
const messageInput = document.getElementById("message");
const nameError = document.getElementById("nameError");
const emailError = document.getElementById("emailError");
const messageError = document.getElementById("messageError");
const formSuccess = document.getElementById("formSuccess");

const loginBox = document.getElementById("loginBox");
const loginForm = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const loginError = document.getElementById("loginError");
const responsesBox = document.getElementById("responsesBox");
const responsesList = document.getElementById("responsesList");
const msgCount = document.getElementById("msgCount");
const logoutBtn = document.getElementById("logoutBtn");
const clearBtn = document.getElementById("clearBtn");

/* ===========================================================
   THEME (LIGHT / DARK) + PERSISTENCE
   =========================================================== */
function applyTheme(theme) {
  html.setAttribute("data-theme", theme);
  themeIcon.textContent = theme === "dark" ? "☀️" : "🌙";
}

function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { /* ignore */ }

  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
  } else {
    // Fall back to system preference on first visit
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(prefersDark ? "dark" : "light");
  }
}

themeToggle.addEventListener("click", () => {
  const next = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* ignore */ }
});

/* ===========================================================
   NAVIGATION (mobile menu + active link highlight)
   =========================================================== */
menuToggle.addEventListener("click", () => {
  const isOpen = navLinks.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

navLinkItems.forEach((link) => {
  link.addEventListener("click", () => {
    navLinks.classList.remove("open");
    menuToggle.setAttribute("aria-expanded", "false");
  });
});

function initActiveLinkObserver() {
  const sections = document.querySelectorAll("main section[id]");
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          navLinkItems.forEach((l) => {
            l.classList.toggle("active", l.getAttribute("href") === "#" + entry.target.id);
          });
        }
      });
    },
    { rootMargin: "-40% 0px -55% 0px" }
  );
  sections.forEach((s) => observer.observe(s));
}

/* ===========================================================
   CONTACT FORM + VALIDATION
   =========================================================== */
function setError(input, errorEl, message) {
  errorEl.textContent = message;
  input.closest(".form-group").classList.toggle("invalid", Boolean(message));
}

function validateName() {
  const value = nameInput.value.trim();
  if (value.length < 2) {
    setError(nameInput, nameError, "Please enter your name (at least 2 characters).");
    return false;
  }
  setError(nameInput, nameError, "");
  return true;
}

function validateEmail() {
  const value = emailInput.value.trim();
  if (value === "") {
    setError(emailInput, emailError, "Email is required.");
    return false;
  }
  if (!EMAIL_REGEX.test(value)) {
    setError(emailInput, emailError, "Oops! Please enter a valid email like name@example.com.");
    return false;
  }
  setError(emailInput, emailError, "");
  return true;
}

function validateMessage() {
  const value = messageInput.value.trim();
  if (value.length < 5) {
    setError(messageInput, messageError, "Please write a message (at least 5 characters).");
    return false;
  }
  setError(messageInput, messageError, "");
  return true;
}

// Live feedback once the user leaves a field / types in it
nameInput.addEventListener("blur", validateName);
emailInput.addEventListener("blur", validateEmail);
messageInput.addEventListener("blur", validateMessage);
emailInput.addEventListener("input", () => { if (emailError.textContent) validateEmail(); });
nameInput.addEventListener("input", () => { if (nameError.textContent) validateName(); });
messageInput.addEventListener("input", () => { if (messageError.textContent) validateMessage(); });

contactForm.addEventListener("submit", (event) => {
  event.preventDefault();
  formSuccess.classList.add("hidden");

  const okName = validateName();
  const okEmail = validateEmail();
  const okMessage = validateMessage();

  if (!(okName && okEmail && okMessage)) return; // block submission until fixed

  const newMessage = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    name: nameInput.value.trim(),
    email: emailInput.value.trim(),
    message: messageInput.value.trim(),
  };

  const messages = getMessages();
  messages.push(newMessage);

  if (!saveMessages(messages)) {
    setError(messageInput, messageError, "Could not save your message (browser storage unavailable).");
    return;
  }

  contactForm.reset();
  formSuccess.classList.remove("hidden");
  setTimeout(() => formSuccess.classList.add("hidden"), 4000);

  // If admin is currently logged in, refresh the list live
  if (sessionStorage.getItem(ADMIN_KEY) === "true") renderResponses();
});

/* ===========================================================
   ADMIN LOGIN / RESPONSES VIEWER
   =========================================================== */
function showAdminPanel() {
  loginBox.classList.add("hidden");
  responsesBox.classList.remove("hidden");
  renderResponses();
}

function showLogin() {
  responsesBox.classList.add("hidden");
  loginBox.classList.remove("hidden");
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function renderResponses() {
  const messages = getMessages().slice().reverse(); // newest first
  responsesList.innerHTML = "";
  msgCount.textContent = String(messages.length);

  if (messages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No messages yet. Submit one from the Contact form above!";
    responsesList.appendChild(empty);
    return;
  }

  messages.forEach((msg) => {
    const card = document.createElement("article");
    card.className = "card message-card";

    const time = document.createElement("span");
    time.className = "msg-time";
    time.textContent = "🕒 " + formatTimestamp(msg.timestamp);

    const name = document.createElement("h4");
    name.textContent = msg.name;

    const email = document.createElement("div");
    email.className = "msg-email";
    email.textContent = msg.email;

    const body = document.createElement("p");
    body.className = "msg-body";
    body.textContent = msg.message;

    card.append(time, name, email, body);
    responsesList.appendChild(card);
  });
}

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const user = usernameInput.value.trim();
  const pass = passwordInput.value;

  if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
    sessionStorage.setItem(ADMIN_KEY, "true");
    loginError.textContent = "";
    loginForm.reset();
    showAdminPanel();
  } else {
    loginError.textContent = "Invalid username or password. Please try again.";
  }
});

logoutBtn.addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_KEY);
  showLogin();
});

clearBtn.addEventListener("click", () => {
  if (getMessages().length === 0) return;
  if (window.confirm("Delete all saved messages? This cannot be undone.")) {
    saveMessages([]);
    renderResponses();
  }
});

/* ===========================================================
   INIT
   =========================================================== */
document.getElementById("year").textContent = new Date().getFullYear();
initTheme();
initActiveLinkObserver();

try {
  if (sessionStorage.getItem(ADMIN_KEY) === "true") {
    showAdminPanel();
  }
} catch (e) { /* sessionStorage unavailable */ }
