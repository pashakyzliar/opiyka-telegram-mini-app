"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { existsSync } = require("node:fs");

loadDotEnv(path.join(__dirname, ".env"));

// ЗМІНА: AI-клієнт. Модуль сам вирішує, чи він налаштований (AI_BASE_URL).
const ai = require("./ai");

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = String(process.env.BOT_TOKEN || "");
const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
const WEB_ROOT = path.resolve(__dirname, "..", "web");
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(__dirname, "data", "users.json"));
const MAX_BODY = 2 * 1024 * 1024;
const COLLECTIONS = ["transactions", "goals", "recurring", "debts", "amortize"];

function loadDotEnv(file) {
  if (!existsSync(file)) return;
  try {
    const text = require("node:fs").readFileSync(file, "utf8");
    for (const line of text.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match || process.env[match[1]] !== undefined) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
    }
  } catch (error) {
    console.error("Не вдалось прочитати .env:", error.message);
  }
}

function defaultSettings() {
  return { budgets: {}, salaryDays: [5, 20], calmMode: false, pin: "", lastBackup: 0, streakRecord: 0, bestRate: null };
}

function emptyAccount() {
  return {
    transactions: [], goals: [], recurring: [], debts: [], amortize: [],
    settings: defaultSettings()
  };
}

function normalizeAccount(value) {
  const account = value && typeof value === "object" ? value : {};
  for (const collection of COLLECTIONS) {
    if (!Array.isArray(account[collection])) account[collection] = [];
  }
  account.settings = Object.assign(defaultSettings(), account.settings || {});
  account.settings.budgets = Object.assign({}, account.settings.budgets || {});
  return account;
}

async function readStore() {
  try {
    const parsed = JSON.parse(await fs.readFile(DATA_FILE, "utf8"));
    if (parsed && parsed.users && typeof parsed.users === "object") return parsed;
  } catch (error) {
    if (error.code !== "ENOENT") console.error("Не вдалось прочитати базу:", error.message);
  }
  return { users: {} };
}

let storePromise = readStore();
let writeQueue = Promise.resolve();

function persistStore(store) {
  writeQueue = writeQueue.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temp = DATA_FILE + ".tmp-" + process.pid;
    await fs.writeFile(temp, JSON.stringify(store, null, 2), "utf8");
    await fs.rename(temp, DATA_FILE);
  });
  return writeQueue;
}

async function accountFor(userId) {
  const store = await storePromise;
  if (!store.users[userId]) store.users[userId] = emptyAccount();
  store.users[userId] = normalizeAccount(store.users[userId]);
  return { store, account: store.users[userId] };
}

function json(res, status, value) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function errorJson(res, status, code, message) {
  json(res, status, { error: message, code });
}

function corsHeaders(res) {
  const origin = process.env.CORS_ORIGIN;
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data, Authorization, X-Dev-User-Id");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Vary", "Origin");
}

async function bodyJson(req) {
  let length = 0;
  const chunks = [];
  for await (const chunk of req) {
    length += chunk.length;
    if (length > MAX_BODY) throw Object.assign(new Error("Request body too large"), { code: "body_too_large" });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch (error) { throw Object.assign(new Error("Invalid JSON"), { code: "invalid_json" }); }
}

function safeEqualHex(a, b) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

function verifyTelegramInitData(raw) {
  if (!BOT_TOKEN) throw Object.assign(new Error("BOT_TOKEN is not configured"), { code: "server_not_configured" });
  const params = new URLSearchParams(raw || "");
  const receivedHash = params.get("hash") || "";
  if (!receivedHash) throw Object.assign(new Error("Missing Telegram init data hash"), { code: "missing_hash" });

  const authDate = Number(params.get("auth_date"));
  const maxAge = Number(process.env.INIT_DATA_MAX_AGE || 86400);
  if (!Number.isFinite(authDate) || (maxAge > 0 && Math.floor(Date.now() / 1000) - authDate > maxAge)) {
    throw Object.assign(new Error("Telegram init data expired"), { code: "expired_init_data" });
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => key + "=" + value)
    .join("\n");
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  if (!safeEqualHex(receivedHash, calculatedHash)) {
    throw Object.assign(new Error("Telegram init data signature mismatch"), { code: "invalid_init_data" });
  }

  let user;
  try { user = JSON.parse(params.get("user") || "{}"); }
  catch (error) { throw Object.assign(new Error("Invalid Telegram user"), { code: "invalid_user" }); }
  if (!user || user.id === undefined || user.id === null) {
    throw Object.assign(new Error("Telegram user is missing"), { code: "missing_user" });
  }
  return { id: String(user.id), user };
}

function authenticatedUser(req) {
  const rawHeader = req.headers["x-telegram-init-data"] || req.headers.authorization || "";
  const raw = String(rawHeader).replace(/^tma\s+/i, "");
  if (raw) return verifyTelegramInitData(raw);

  if (process.env.ALLOW_DEV_AUTH === "1") {
    const devId = String(req.headers["x-dev-user-id"] || process.env.DEV_USER_ID || "dev");
    if (/^[A-Za-z0-9_-]{1,80}$/.test(devId)) return { id: devId, user: { id: devId, first_name: "Local" } };
  }
  throw Object.assign(new Error("Telegram authorization required"), { code: "unauthorized" });
}

function newId() {
  return "t" + Date.now().toString(36) + crypto.randomBytes(5).toString("hex");
}

function validCollection(name) {
  return COLLECTIONS.includes(name);
}

function cleanRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const copy = Object.assign({}, row);
    copy.id = String(copy.id || newId());
    if (!copy.createdAt) copy.createdAt = new Date().toISOString();
    return copy;
  });
}

async function api(req, res, pathname) {
  let auth;
  try { auth = authenticatedUser(req); }
  catch (error) { return errorJson(res, error.code === "server_not_configured" ? 503 : 401, error.code || "unauthorized", error.message); }

  const { store, account } = await accountFor(auth.id);
  if (req.method === "GET" && pathname === "/api/state") return json(res, 200, account);

  /* --------------------------- ЗМІНА: AI --------------------------- */
  // Обидва маршрути стоять ДО регулярки колекцій: інакше "ai" впало б у неї
  // і повернуло 404, бо в COLLECTIONS його немає.

  if (req.method === "GET" && pathname === "/api/ai/status") {
    // Дешево і без витрат квоти: app.js питає це на старті, щоб вирішити,
    // показувати кнопку AI чи ні.
    if (!ai.configured()) return json(res, 200, { enabled: false });
    return json(res, 200, Object.assign({ enabled: true, model: ai.AI_MODEL }, ai.quotaFor(auth.id)));
  }

  if (req.method === "POST" && pathname === "/api/ai") {
    if (!ai.configured()) return errorJson(res, 503, "not_granted", "AI не налаштовано на сервері.");

    // Спершу читаємо тіло, потім резервуємо слот: порожній запит не має
    // з'їдати квоту. Але резерв усе одно стоїть ДО звернення до провайдера.
    const payload = await bodyJson(req);
    const prompt = String(payload && payload.prompt || "").trim();
    if (!prompt) return errorJson(res, 400, "bad_request", "Порожній запит до AI.");

    const gate = ai.reserve(auth.id);
    if (!gate.ok) return errorJson(res, 429, gate.code, gate.message);

    try {
      const out = await ai.askJson(prompt);
      if (out.usage) {
        console.log("AI", auth.id, out.model, JSON.stringify(out.usage), gate.used + "/" + gate.limit);
      }
      return json(res, 200, { result: out.result });
    } catch (error) {
      const code = error.code || "provider_error";
      const status = code === "not_granted" ? 503 : code === "rate_limited" ? 429 : 502;
      console.error("AI помилка:", code, error.message);
      return errorJson(res, status, code, error.message);
    }
  }
  /* ------------------------- кінець змін AI ------------------------- */

  if (req.method === "PUT" && pathname === "/api/settings") {
    const payload = await bodyJson(req);
    account.settings = Object.assign(defaultSettings(), account.settings, payload || {});
    account.settings.budgets = Object.assign({}, account.settings.budgets || {});
    await persistStore(store);
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/replace-all") {
    const payload = await bodyJson(req);
    account.transactions = cleanRows(payload.transactions);
    account.goals = cleanRows(payload.goals);
    account.recurring = cleanRows(payload.recurring);
    account.debts = cleanRows(payload.debts);
    account.amortize = cleanRows(payload.amortize);
    account.settings = Object.assign(defaultSettings(), payload.settings || {});
    await persistStore(store);
    return json(res, 200, { ok: true });
  }

  const match = pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
  if (!match || !validCollection(match[1])) return errorJson(res, 404, "not_found", "API route not found");
  const collection = match[1];
  const id = match[2] ? decodeURIComponent(match[2]) : "";

  if (req.method === "POST" && !id) {
    const payload = Object.assign({}, await bodyJson(req));
    payload.id = String(payload.id || newId());
    if (!payload.createdAt) payload.createdAt = new Date().toISOString();
    account[collection].push(payload);
    await persistStore(store);
    return json(res, 200, { ok: true, id: payload.id });
  }

  if ((req.method === "PUT" || req.method === "PATCH") && id) {
    const index = account[collection].findIndex((row) => String(row.id) === id);
    const payload = Object.assign({}, await bodyJson(req));
    payload.id = id;
    if (req.method === "PUT") {
      if (!payload.createdAt && index >= 0) payload.createdAt = account[collection][index].createdAt;
      if (!payload.createdAt) payload.createdAt = new Date().toISOString();
      if (index >= 0) account[collection][index] = payload;
      else account[collection].push(payload);
    } else {
      if (index < 0) return errorJson(res, 404, "not_found", "Record not found");
      account[collection][index] = Object.assign({}, account[collection][index], payload, { id });
    }
    await persistStore(store);
    return json(res, 200, { ok: true, id });
  }

  if (req.method === "DELETE" && id) {
    account[collection] = account[collection].filter((row) => String(row.id) !== id);
    await persistStore(store);
    return json(res, 200, { ok: true });
  }

  return errorJson(res, 405, "method_not_allowed", "Method not allowed");
}

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".woff2": "font/woff2", ".ico": "image/x-icon"
};

async function staticFile(res, pathname) {
  let decoded;
  try { decoded = decodeURIComponent(pathname); } catch (error) { return errorJson(res, 400, "bad_path", "Bad path"); }
  if (decoded === "/") decoded = "/index.html";
  const file = path.resolve(WEB_ROOT, "." + decoded);
  const relative = path.relative(WEB_ROOT, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return errorJson(res, 403, "forbidden", "Forbidden");
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": pathname.endsWith("config.js") ? "no-store" : "public, max-age=3600"
    });
    res.end(content);
  } catch (error) {
    if (error.code === "ENOENT") return errorJson(res, 404, "not_found", "File not found");
    return errorJson(res, 500, "static_error", "Could not read file");
  }
}

async function telegramCall(method, payload) {
  if (!BOT_TOKEN) return null;
  const response = await fetch("https://api.telegram.org/bot" + BOT_TOKEN + "/" + method, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

async function botPolling() {
  if (!BOT_TOKEN || !PUBLIC_URL) {
    console.log("Бот не запущений: заповни BOT_TOKEN і PUBLIC_URL у server/.env.");
    return;
  }
  console.log("Telegram bot polling увімкнено.");
  let offset = 0;
  while (true) {
    try {
      const updates = await telegramCall("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] });
      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        const message = update.message;
        const text = String(message && message.text || "");
        if (!message || !message.chat || !/^\/(start|app)(?:@\w+)?/.test(text)) continue;
        await telegramCall("sendMessage", {
          chat_id: message.chat.id,
          text: "Копійка — твій особистий общак. Відкривай Mini App:",
          reply_markup: { inline_keyboard: [[{ text: "Відкрити Копійку", web_app: { url: PUBLIC_URL } }]] }
        });
      }
    } catch (error) {
      console.error("Telegram polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

const server = http.createServer(async (req, res) => {
  corsHeaders(res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    if (req.method !== "GET" && req.method !== "HEAD") return errorJson(res, 405, "method_not_allowed", "Method not allowed");
    return await staticFile(res, url.pathname);
  } catch (error) {
    console.error("Request error:", error);
    return errorJson(res, error.code === "invalid_json" || error.code === "body_too_large" ? 400 : 500, error.code || "server_error", error.message || "Server error");
  }
});

server.listen(PORT, () => {
  console.log("Копійка слухає порт " + PORT);
  console.log(ai.configured() ? "AI увімкнено: " + ai.AI_MODEL : "AI вимкнено: не задано AI_BASE_URL.");
  void botPolling();
});
