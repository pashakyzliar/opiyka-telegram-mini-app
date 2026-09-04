"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { existsSync } = require("node:fs");

loadDotEnv(path.join(__dirname, ".env"));

const ai = require("./ai");
const botAi = require("./bot-ai");
const allowance = require("./allowance");

const PORT = Number(process.env.PORT || 3000);
const BOT_TOKEN = String(process.env.BOT_TOKEN || "");
const PUBLIC_URL = String(process.env.PUBLIC_URL || "").replace(/\/$/, "");
const WEB_ROOT = path.resolve(__dirname, "..", "web");
const REPO_ROOT = path.resolve(__dirname, "..");
const DATA_FILE = path.resolve(process.env.DATA_FILE || path.join(__dirname, "data", "users.json"));
const MAX_BODY = 2 * 1024 * 1024;
const COLLECTIONS = ["transactions", "goals", "recurring", "debts", "amortize"];
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Машина", color: "#5aa8ba", icon: "" },
  { name: "Пайка", color: "#c08a4a", icon: "" },
  { name: "Хавка", color: "#63b06e", icon: "" },
  { name: "Дурка", color: "#b07dad", icon: "" },
  { name: "Продукти", color: "#d29a5c", icon: "" },
  { name: "Сіги", color: "#97a851", icon: "" },
  { name: "Подпіски", color: "#7d8ecb", icon: "" }
];

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
  return {
    budgets: {},
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ name: row.name, color: row.color, icon: row.icon })),
    salaryAmount: 0,
    salaryDays: [5, 20],
    allowanceEnabled: false,
    weekBudget: 0,
    weekReserve: 0,
    weekDaily: [0, 0, 0, 0, 0, 0, 0],
    navarHistory: [],
    calmMode: false,
    pin: "",
    lastBackup: 0,
    streakRecord: 0,
    bestRate: null
  };
}

function normalizeExpenseCategoryIcon(raw) {
  const value = String(raw == null ? "" : raw).trim();
  if (!value || typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return "";
  const parts = Array.from(new Intl.Segmenter("uk-UA", { granularity: "grapheme" }).segment(value), (part) => part.segment);
  if (parts.length !== 1) return "";
  return Buffer.byteLength(parts[0], "utf8") <= 8 ? parts[0] : "";
}

function emptyAccount() {
  return {
    transactions: [],
    goals: [],
    recurring: [],
    debts: [],
    amortize: [],
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
  account.settings.expenseCategories = normalizeExpenseCategories(account.settings.expenseCategories);
  account.settings.allowanceEnabled = !!account.settings.allowanceEnabled;
  account.settings.salaryAmount = Math.max(0, Number(account.settings.salaryAmount) || 0);
  account.settings.weekBudget = Math.max(0, Number(account.settings.weekBudget) || 0);
  account.settings.weekReserve = Math.max(0, Number(account.settings.weekReserve) || 0);
  account.settings.weekDaily = Array.isArray(account.settings.weekDaily)
    ? account.settings.weekDaily.slice(0, 7).map((value) => Math.max(0, Number(value) || 0)).concat([0, 0, 0, 0, 0, 0, 0]).slice(0, 7)
    : [0, 0, 0, 0, 0, 0, 0];
  account.settings.navarHistory = Array.isArray(account.settings.navarHistory)
    ? account.settings.navarHistory
        .map((row) => ({
          id: String((row && row.id) || ("navar." + String((row && row.month) || "").replace("-", "_"))),
          month: String((row && row.month) || "").slice(0, 7),
          amount: Math.max(0, Number(row && row.amount) || 0),
          createdAt: row && row.createdAt ? String(row.createdAt) : new Date().toISOString()
        }))
        .filter((row) => /^\d{4}-\d{2}$/.test(row.month))
    : [];
  return account;
}

function normalizeExpenseCategories(list) {
  const source = Array.isArray(list) && list.length ? list : DEFAULT_EXPENSE_CATEGORIES;
  const out = [];
  const seen = new Set();
  source.forEach((row, index) => {
    const fallback = DEFAULT_EXPENSE_CATEGORIES[index % DEFAULT_EXPENSE_CATEGORIES.length];
    const name = String(row && typeof row === "object" ? row.name : row || "").replace(/\s+/g, " ").trim().slice(0, 28);
    if (!name) return;
    const key = name.toLocaleLowerCase("uk-UA");
    if (seen.has(key)) return;
    seen.add(key);
    const rawColor = String(row && row.color ? row.color : "").trim().toLowerCase();
    const matched = DEFAULT_EXPENSE_CATEGORIES.find((item) => item.name.toLocaleLowerCase("uk-UA") === key);
    const icon = normalizeExpenseCategoryIcon(row && row.icon);
    out.push({
      name,
      color: /^#[0-9a-f]{6}$/.test(rawColor) ? rawColor : fallback.color,
      icon: icon || (matched ? matched.icon : "")
    });
  });
  return out.length ? out : DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ name: row.name, color: row.color, icon: row.icon }));
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

function jsonDownload(res, filename, value) {
  const body = JSON.stringify(value, null, 2);
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Disposition": 'attachment; filename="' + filename.replace(/"/g, "") + '"',
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
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw Object.assign(new Error("Invalid JSON"), { code: "invalid_json" });
  }
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
  try {
    user = JSON.parse(params.get("user") || "{}");
  } catch (error) {
    throw Object.assign(new Error("Invalid Telegram user"), { code: "invalid_user" });
  }
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

async function askAiForUser(userId, prompt) {
  const gate = ai.reserve(userId);
  if (!gate.ok) throw Object.assign(new Error(gate.message), { code: gate.code });
  try {
    const out = await ai.askJson(prompt);
    if (out.usage) {
      console.log("AI", userId, out.model, JSON.stringify(out.usage), gate.used + "/" + gate.limit);
    }
    return out.result;
  } catch (error) {
    console.error("AI помилка:", error.code || "provider_error", error.message);
    throw error;
  }
}

async function addTransactionForUser(userId, payload) {
  const { store, account } = await accountFor(userId);
  const row = Object.assign({}, payload);
  row.id = String(row.id || newId());
  if (!row.createdAt) row.createdAt = new Date().toISOString();
  const index = account.transactions.findIndex((item) => item.id === row.id);
  if (index >= 0) account.transactions[index] = row;
  else account.transactions.push(row);
  await persistStore(store);
  return row;
}

async function removeTransactionForUser(userId, id) {
  const { store, account } = await accountFor(userId);
  const index = account.transactions.findIndex((item) => item.id === id);
  if (index < 0) return null;
  const removed = account.transactions[index];
  account.transactions.splice(index, 1);
  await persistStore(store);
  return removed;
}

async function api(req, res, pathname) {
  let auth;
  try {
    auth = authenticatedUser(req);
  } catch (error) {
    return errorJson(res, error.code === "server_not_configured" ? 503 : 401, error.code || "unauthorized", error.message);
  }

  const { store, account } = await accountFor(auth.id);
  if (req.method === "GET" && pathname === "/api/state") return json(res, 200, account);
  if (req.method === "GET" && pathname === "/api/export") {
    return jsonDownload(res, "kopiyka-" + auth.id + "-" + new Date().toISOString().slice(0, 10) + ".json", account);
  }

  if (req.method === "GET" && pathname === "/api/ai/status") {
    if (!ai.configured()) return json(res, 200, { enabled: false });
    return json(res, 200, Object.assign({ enabled: true, model: ai.AI_MODEL }, ai.quotaFor(auth.id)));
  }

  if (req.method === "POST" && pathname === "/api/ai") {
    if (!ai.configured()) return errorJson(res, 503, "not_granted", "AI не налаштовано на сервері.");
    const payload = await bodyJson(req);
    const prompt = String(payload && payload.prompt || "").trim();
    if (!prompt) return errorJson(res, 400, "bad_request", "Порожній запит до AI.");
    try {
      const result = await askAiForUser(auth.id, prompt);
      return json(res, 200, { result });
    } catch (error) {
      const code = error.code || "provider_error";
      const status = code === "not_granted" ? 503 : code === "rate_limited" ? 429 : 502;
      return errorJson(res, status, code, error.message);
    }
  }

  if (req.method === "PUT" && pathname === "/api/settings") {
    const payload = await bodyJson(req);
    account.settings = normalizeAccount({ settings: Object.assign(defaultSettings(), account.settings, payload || {}) }).settings;
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
    account.settings = normalizeAccount({ settings: Object.assign(defaultSettings(), payload.settings || {}) }).settings;
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
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};

async function staticFile(res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (error) {
    return errorJson(res, 400, "bad_path", "Bad path");
  }
  if (decoded === "/") decoded = "/index.html";
  const file = path.resolve(WEB_ROOT, "." + decoded);
  const relative = path.relative(WEB_ROOT, file);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return errorJson(res, 403, "forbidden", "Forbidden");
  try {
    const content = await fs.readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Cache-Control": /\/vendor\/|\.(woff2|svg|ico|png|jpg)$/i.test(pathname) ? "public, max-age=31536000, immutable" : "no-cache"
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

function appMarkup() {
  if (!PUBLIC_URL) return undefined;
  return { inline_keyboard: [[{ text: "Відкрити Копійку", web_app: { url: PUBLIC_URL } }]] };
}

function undoMarkup(txId) {
  const row = [{ text: "Скасувати", callback_data: "undo_tx:" + txId }];
  if (PUBLIC_URL) row.push({ text: "Копійка", web_app: { url: PUBLIC_URL } });
  return { inline_keyboard: [row] };
}

async function sendBotMessage(chatId, text, replyMarkup, parseMode) {
  const payload = { chat_id: chatId, text };
  if (replyMarkup) payload.reply_markup = replyMarkup;
  if (parseMode) payload.parse_mode = parseMode;
  return telegramCall("sendMessage", payload);
}

function botErrorText(error) {
  if (!error) return "Не вийшло виконати запит.";
  if (error.code === "rate_limited" || error.code === "timeout" || error.code === "provider_unreachable") return error.message;
  if (error.code === "not_granted") return "AI на сервері не налаштовано.";
  return "Не вийшло виконати запит.";
}

async function handleBotStart(message) {
  const chatId = message.chat.id;
  const intro = "Wallet by Baha_Vora";
  return sendBotMessage(chatId, intro, appMarkup());
}

async function handleBotHelp(message) {
  return sendBotMessage(message.chat.id, botAi.helpText(PUBLIC_URL), appMarkup());
}

async function handleBotWrite(message) {
  const text = String(message.text || "").trim();
  const userId = String(message.from && message.from.id || "");
  const chatId = message.chat.id;
  const { account } = await accountFor(userId);
  const expenseCategories = account.settings.expenseCategories;
  const data = await askAiForUser(userId, botAi.buildWritePrompt(text, expenseCategories));
  const rawRows = Array.isArray(data) ? data : (data && Array.isArray(data.operations) ? data.operations : []);
  const rows = rawRows.map((row) => botAi.normalizeDraft(row, expenseCategories)).filter(Boolean);
  const note = rows.length === 1 ? botAi.noteFromUserText(text) : "";
  if (rows.length === 1 && note) rows[0].note = note;
  if (!rows.length || (rows.length === 1 && !rows[0].note)) {
    return sendBotMessage(chatId, botAi.formatWriteReply([]), appMarkup(), "HTML");
  }
  const saved = [];
  for (const row of rows) saved.push(await addTransactionForUser(userId, row));
  const current = await accountFor(userId);
  const allowanceInfo = Object.assign(
    allowance.dayAllowance(current.account, botAi.todayISO()),
    { expenseCategories: current.account.settings.expenseCategories }
  );
  const markup = saved.length === 1 ? undoMarkup(saved[0].id) : appMarkup();
  return sendBotMessage(chatId, botAi.formatWriteReply(saved, allowanceInfo), markup, "HTML");
}

async function handleBotAsk(message) {
  const text = String(message.text || "").trim();
  const userId = String(message.from && message.from.id || "");
  const chatId = message.chat.id;
  const { account } = await accountFor(userId);
  const filterPayload = await askAiForUser(userId, botAi.buildAskPrompt(text, account.settings.expenseCategories));
  const filter = botAi.normalizeFilter(filterPayload, account.settings.expenseCategories);
  const rows = botAi.filterTransactions(account.transactions, filter);
  const total = botAi.sumTransactions(rows);
  return sendBotMessage(chatId, botAi.formatAskReply(filter, rows, total), appMarkup());
}

async function handleBotCallback(query) {
  const id = String(query && query.id || "");
  const data = String(query && query.data || "");
  if (!id) return;
  if (!/^undo_tx:/.test(data)) {
    await telegramCall("answerCallbackQuery", { callback_query_id: id });
    return;
  }
  const txId = data.slice("undo_tx:".length);
  const userId = String(query.from && query.from.id || "");
  const removed = await removeTransactionForUser(userId, txId);
  const notice = removed ? "Операцію скасовано." : "Операцію вже скасовано.";
  await telegramCall("answerCallbackQuery", { callback_query_id: id, text: notice });
  if (!query.message || !query.message.chat || !query.message.message_id) return;
  const currentText = String(query.message.text || "");
  const nextText = removed && !/Скасовано\.$/.test(currentText) ? currentText + "\n\nСкасовано." : currentText;
  try {
    await telegramCall("editMessageText", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      text: nextText || notice,
      reply_markup: { inline_keyboard: [] }
    });
  } catch (error) {
    await telegramCall("editMessageReplyMarkup", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      reply_markup: { inline_keyboard: [] }
    });
  }
}

async function handleBotUpdate(update) {
  if (update && update.callback_query) return handleBotCallback(update.callback_query);
  const message = update && update.message;
  if (!message || !message.chat || message.chat.type !== "private") return;
  const text = String(message.text || "").trim();
  if (!text) return;

  const route = botAi.routeBotMessage(text);
  if (route === "app") return handleBotStart(message);
  if (route === "help") return handleBotHelp(message);
  if (!ai.configured()) {
    return sendBotMessage(message.chat.id, "AI на сервері не налаштовано.\n" + botAi.helpText(PUBLIC_URL), appMarkup());
  }
  try {
    if (route === "write") return handleBotWrite(message);
    if (route === "ask") return handleBotAsk(message);
    return handleBotStart(message);
  } catch (error) {
    return sendBotMessage(message.chat.id, botErrorText(error), appMarkup());
  }
}

async function botPolling() {
  if (!BOT_TOKEN) {
    console.log("Бот не запущений: заповни BOT_TOKEN у server/.env.");
    return;
  }
  console.log("Telegram bot polling увімкнено.");
  let offset = 0;
  while (true) {
    try {
      const updates = await telegramCall("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "callback_query"]
      });
      for (const update of updates || []) {
        offset = Math.max(offset, Number(update.update_id) + 1);
        await handleBotUpdate(update);
      }
    } catch (error) {
      console.error("Telegram polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

const server = http.createServer(async (req, res) => {
  corsHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }
  const url = new URL(req.url, "http://localhost");
  try {
    if (url.pathname === "/health") return json(res, 200, { ok: true });
    if (url.pathname.startsWith("/api/")) return await api(req, res, url.pathname);
    if (req.method !== "GET" && req.method !== "HEAD") return errorJson(res, 405, "method_not_allowed", "Method not allowed");
    return await staticFile(res, url.pathname);
  } catch (error) {
    console.error("Request error:", error);
    return errorJson(
      res,
      error.code === "invalid_json" || error.code === "body_too_large" ? 400 : 500,
      error.code || "server_error",
      error.message || "Server error"
    );
  }
});

server.listen(PORT, () => {
  console.log("Копійка слухає порт " + PORT);
  console.log(ai.configured() ? "AI увімкнено: " + ai.AI_MODEL : "AI вимкнено: не задано AI_BASE_URL.");
  const dataRelative = path.relative(REPO_ROOT, DATA_FILE);
  if (process.env.RAILWAY_ENVIRONMENT && dataRelative && !dataRelative.startsWith("..") && !path.isAbsolute(dataRelative)) {
    console.warn("УВАГА: DATA_FILE не на Volume — дані зникнуть при наступному деплої");
  }
  void botPolling();
});
