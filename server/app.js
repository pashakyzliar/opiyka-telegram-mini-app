"use strict";

const http = require("node:http");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

const config = require("./config");
const ai = require("./ai");
const botAi = require("./bot-ai");
const { dayAllowance } = require("./allowance");
const { authenticatedUser, pseudonymizeTelegramId } = require("./auth/telegram");
const { json, errorJson, corsHeaders, bodyJson } = require("./lib/http");
const { isAppError } = require("./lib/errors");
const { COLLECTIONS } = require("./lib/state");
const { withUserContext, mapDbError } = require("./db");
const accountService = require("./services/account-service");

const WEB_ROOT = path.resolve(__dirname, "..", "web");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".ico": "image/x-icon"
};

function requestId() {
  return crypto.randomUUID();
}

async function staticFile(res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch (_error) {
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

function userQuotaKey(auth) {
  return auth.telegramKey;
}

async function askAiForUser(auth, prompt) {
  const key = userQuotaKey(auth);
  const gate = ai.reserve(key);
  if (!gate.ok) throw Object.assign(new Error(gate.message), { code: gate.code });
  try {
    const out = await ai.askJson(prompt);
    if (out.usage) {
      console.log("AI", gate.used + "/" + gate.limit, out.model, JSON.stringify(out.usage));
    }
    return out.result;
  } catch (error) {
    console.error("AI помилка:", error.code || "provider_error", error.message);
    throw error;
  }
}

async function telegramCall(method, payload) {
  if (!config.botToken) return null;
  const response = await fetch("https://api.telegram.org/bot" + config.botToken + "/" + method, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json();
  if (!data.ok) throw new Error(data.description || "Telegram API error");
  return data.result;
}

function appMarkup() {
  if (!config.publicUrl) return undefined;
  return { inline_keyboard: [[{ text: "Відкрити Копійку", web_app: { url: config.publicUrl } }]] };
}

function undoMarkup(txId) {
  const row = [{ text: "Скасувати", callback_data: "undo_tx:" + txId }];
  if (config.publicUrl) row.push({ text: "Копійка", web_app: { url: config.publicUrl } });
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

function expenseCategoriesForAccount(account) {
  const categories = account && account.settings && Array.isArray(account.settings.expenseCategories)
    ? account.settings.expenseCategories.filter((row) => row && row.name)
    : [];
  return categories.length ? categories : botAi.EXPENSE_CATS.map((name) => ({ name, icon: "" }));
}

function glossaryForAccount(account) {
  return account && account.settings && account.settings.glossary && typeof account.settings.glossary === "object"
    ? account.settings.glossary
    : {};
}

function allowanceInfoForAccount(account) {
  const info = dayAllowance(account, botAi.todayISO());
  info.expenseCategories = expenseCategoriesForAccount(account);
  return info;
}

function categoryButtonText(row) {
  return row && row.icon ? row.icon + " " + row.name : row.name;
}

function categoryMarkup(categories, txId, offset) {
  const start = Math.max(0, Number(offset) || 0);
  const buttons = [];
  const page = categories.slice(start, start + 11);
  page.forEach((row, index) => {
    buttons.push({
      text: categoryButtonText(row),
      callback_data: "setcat:" + txId + ":" + (start + index)
    });
  });
  if (start + 11 < categories.length) {
    buttons.push({
      text: "⋯ Ще",
      callback_data: "setcat_more:" + txId + ":" + (start + 11)
    });
  }
  const rows = [];
  for (let index = 0; index < buttons.length; index += 3) rows.push(buttons.slice(index, index + 3));
  return { inline_keyboard: rows };
}

async function botCreateTransaction(telegramId, payload) {
  const auth = { telegramKey: pseudonymizeTelegramId(telegramId) };
  return withUserContext(auth.telegramKey, true, async (client, userId) => {
    const id = await accountService.createCollectionRow(client, userId, "transactions", payload);
    const state = await accountService.getState(client, userId);
    return state.transactions.find((row) => row.id === id) || Object.assign({}, payload, { id });
  });
}

async function botRemoveTransaction(telegramId, txId) {
  const auth = { telegramKey: pseudonymizeTelegramId(telegramId) };
  return withUserContext(auth.telegramKey, true, async (client, userId) => {
    const before = await accountService.getState(client, userId);
    const existing = before.transactions.find((row) => row.id === txId) || null;
    if (!existing) return null;
    await accountService.deleteCollectionRow(client, userId, "transactions", txId);
    return existing;
  });
}

async function botAccountState(telegramId) {
  const auth = { telegramKey: pseudonymizeTelegramId(telegramId) };
  return withUserContext(auth.telegramKey, false, (client, userId) => accountService.getState(client, userId));
}

async function resolveCategorySelection(telegramId, txId, categoryIndex) {
  const auth = { telegramKey: pseudonymizeTelegramId(telegramId) };
  return withUserContext(auth.telegramKey, true, async (client, userId) => {
    const account = await accountService.getState(client, userId);
    const tx = (account.transactions || []).find((row) => row.id === txId) || null;
    if (!tx || !tx.pending) return { ok: false };
    const categories = expenseCategoriesForAccount(account);
    const category = categories[categoryIndex];
    if (!category) return { ok: false };
    await accountService.updateCollectionRow(client, userId, "transactions", txId, "PATCH", {
      category: category.name,
      pending: false
    });
    const glossary = Object.assign({}, glossaryForAccount(account));
    const srcWord = String(tx.srcWord || "").trim();
    const glossaryKey = botAi.normalizeWord(srcWord);
    if (glossaryKey) {
      glossary[glossaryKey] = category.name;
      await accountService.updateSettings(client, userId, { glossary }, requestId());
    }
    const next = await accountService.getState(client, userId);
    return {
      ok: true,
      text: srcWord ? "Запамʼятав: «" + srcWord + "» → " + category.name : "Категорію збережено.",
      transaction: next.transactions.find((row) => row.id === txId) || null,
      allowance: allowanceInfoForAccount(next)
    };
  });
}

async function categoryMarkupForTransaction(telegramId, txId, offset) {
  const account = await botAccountState(telegramId);
  const tx = (account.transactions || []).find((row) => row.id === txId) || null;
  if (!tx || !tx.pending) return null;
  return categoryMarkup(expenseCategoriesForAccount(account), txId, offset);
}

async function handleBotStart(message) {
  return sendBotMessage(message.chat.id, "Wallet by Baha_Vora", appMarkup());
}

async function handleBotHelp(message) {
  return sendBotMessage(message.chat.id, botAi.helpText(config.publicUrl), appMarkup());
}

async function handleBotWrite(message) {
  const text = String(message.text || "").trim();
  const telegramId = String((message.from && message.from.id) || "");
  const account = await botAccountState(telegramId);
  const categories = expenseCategoriesForAccount(account);
  let rows = [];
  const quick = botAi.resolveGlossaryWrite(text, glossaryForAccount(account), categories);

  if (quick) {
    rows = [quick];
  } else {
    if (!ai.configured()) {
      return sendBotMessage(message.chat.id, "AI на сервері не налаштовано.\n" + botAi.helpText(config.publicUrl), appMarkup());
    }
    const data = await askAiForUser({ telegramKey: pseudonymizeTelegramId(telegramId) }, botAi.buildWritePrompt(text, categories));
    const rawRows = Array.isArray(data) ? data : (data && Array.isArray(data.operations) ? data.operations : []);
    rows = rawRows.map((row) => botAi.normalizeDraft(row, categories)).filter(Boolean);
  }

  const note = rows.length === 1 ? botAi.noteFromUserText(text) : "";
  if (rows.length === 1 && note) rows[0].note = note;
  if (!rows.length || (rows.length === 1 && !rows[0].note && !rows[0].needsCategory)) {
    return sendBotMessage(message.chat.id, botAi.formatWriteReply([]), appMarkup());
  }

  if (rows.length === 1 && rows[0].needsCategory) {
    rows[0].pending = true;
    rows[0].srcWord = botAi.sourceWord(text) || rows[0].note || "";
    const saved = await botCreateTransaction(telegramId, rows[0]);
    return sendBotMessage(
      message.chat.id,
      botAi.formatPendingCategoryReply(saved),
      categoryMarkup(categories, saved.id, 0),
      "HTML"
    );
  }

  const saved = [];
  for (const row of rows) {
    if (row.needsCategory) {
      row.pending = true;
      row.srcWord = row.srcWord || botAi.sourceWord(text) || row.note || "";
    }
    saved.push(await botCreateTransaction(telegramId, row));
  }
  const nextAccount = await botAccountState(telegramId);
  return sendBotMessage(
    message.chat.id,
    botAi.formatWriteReply(saved, allowanceInfoForAccount(nextAccount)),
    saved.length === 1 ? undoMarkup(saved[0].id) : appMarkup(),
    "HTML"
  );
}

async function handleBotAsk(message) {
  if (!ai.configured()) {
    return sendBotMessage(message.chat.id, "AI на сервері не налаштовано.\n" + botAi.helpText(config.publicUrl), appMarkup());
  }
  const text = String(message.text || "").trim();
  const telegramId = String((message.from && message.from.id) || "");
  const account = await botAccountState(telegramId);
  const filterPayload = await askAiForUser(
    { telegramKey: pseudonymizeTelegramId(telegramId) },
    botAi.buildAskPrompt(text, expenseCategoriesForAccount(account))
  );
  const filter = botAi.normalizeFilter(filterPayload, expenseCategoriesForAccount(account));
  const rows = botAi.filterTransactions(account.transactions, filter);
  const total = botAi.sumTransactions(rows);
  return sendBotMessage(message.chat.id, botAi.formatAskReply(filter, rows, total), appMarkup());
}

async function handleBotCallback(query) {
  const callbackId = String((query && query.id) || "");
  const data = String((query && query.data) || "");
  if (!callbackId) return;

  if (data.startsWith("undo_tx:")) {
    const txId = data.slice("undo_tx:".length);
    const telegramId = String((query.from && query.from.id) || "");
    const removed = await botRemoveTransaction(telegramId, txId);
    const notice = removed ? "Операцію скасовано." : "Операцію вже скасовано.";
    await telegramCall("answerCallbackQuery", { callback_query_id: callbackId, text: notice });
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
    } catch (_error) {
      await telegramCall("editMessageReplyMarkup", {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: { inline_keyboard: [] }
      });
    }
    return;
  }

  if (data.startsWith("setcat_more:")) {
    const parts = data.split(":");
    const txId = parts[1] || "";
    const offset = Number(parts[2] || 0) || 0;
    const telegramId = String((query.from && query.from.id) || "");
    const markup = await categoryMarkupForTransaction(telegramId, txId, offset);
    if (!markup) {
      await telegramCall("answerCallbackQuery", { callback_query_id: callbackId, text: "Ця витрата вже неактуальна" });
      return;
    }
    await telegramCall("answerCallbackQuery", { callback_query_id: callbackId });
    if (query.message && query.message.chat && query.message.message_id) {
      await telegramCall("editMessageReplyMarkup", {
        chat_id: query.message.chat.id,
        message_id: query.message.message_id,
        reply_markup: markup
      });
    }
    return;
  }

  if (data.startsWith("setcat:")) {
    const parts = data.split(":");
    const txId = parts[1] || "";
    const categoryIndex = Number(parts[2] || -1);
    const telegramId = String((query.from && query.from.id) || "");
    const resolved = await resolveCategorySelection(telegramId, txId, categoryIndex);
    if (!resolved.ok || !resolved.transaction) {
      await telegramCall("answerCallbackQuery", { callback_query_id: callbackId, text: "Ця витрата вже неактуальна" });
      return;
    }
    await telegramCall("answerCallbackQuery", { callback_query_id: callbackId, text: resolved.text });
    if (!query.message || !query.message.chat || !query.message.message_id) return;
    await telegramCall("editMessageText", {
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
      text: botAi.formatWriteReply([resolved.transaction], resolved.allowance),
      parse_mode: "HTML",
      reply_markup: undoMarkup(resolved.transaction.id)
    });
    return;
  }

  await telegramCall("answerCallbackQuery", { callback_query_id: callbackId });
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
  try {
    if (route === "write") return handleBotWrite(message);
    if (route === "ask") return handleBotAsk(message);
    return handleBotStart(message);
  } catch (error) {
    return sendBotMessage(message.chat.id, botErrorText(error), appMarkup());
  }
}

async function botPolling() {
  if (!config.botToken) {
    console.log("Бот не запущений: заповни BOT_TOKEN.");
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

async function api(req, res, pathname) {
  let auth;
  try {
    auth = authenticatedUser(req);
  } catch (error) {
    return errorJson(res, error.status || 401, error.code || "unauthorized", error.message);
  }

  const reqId = requestId();

  if (req.method === "GET" && pathname === "/api/state") {
    const state = await withUserContext(auth.telegramKey, false, (client, userId) => accountService.getState(client, userId));
    return json(res, 200, state);
  }

  if (req.method === "GET" && pathname === "/api/profile") {
    const profile = await withUserContext(auth.telegramKey, false, (client, userId) => accountService.getProfile(client, userId));
    return json(res, 200, {
      firstName: auth.firstName || "Користувач",
      photoUrl: auth.photoUrl || "",
      since: profile.since
    });
  }

  if (req.method === "GET" && pathname === "/api/export") {
    const payload = await withUserContext(auth.telegramKey, true, (client, userId) => accountService.exportAccount(client, userId, reqId));
    return json(res, 200, payload, {
      "Content-Disposition": "attachment; filename=\"kopiyka-export.json\""
    });
  }

  if (req.method === "GET" && pathname === "/api/ai/status") {
    if (!ai.configured()) return json(res, 200, { enabled: false });
    return json(res, 200, Object.assign({ enabled: true, model: ai.AI_MODEL }, ai.quotaFor(userQuotaKey(auth))));
  }

  if (req.method === "POST" && pathname === "/api/ai") {
    if (!ai.configured()) return errorJson(res, 503, "not_granted", "AI не налаштовано на сервері.");
    const payload = await bodyJson(req, 24 * 1024);
    const prompt = String((payload && payload.prompt) || "").trim();
    if (!prompt || prompt.length > 20000) return errorJson(res, 400, "bad_request", "Порожній запит до AI.");
    try {
      const result = await askAiForUser(auth, prompt);
      return json(res, 200, { result });
    } catch (error) {
      const code = error.code || "provider_error";
      const status = code === "not_granted" ? 503 : code === "rate_limited" ? 429 : 502;
      return errorJson(res, status, code, error.message);
    }
  }

  if (req.method === "PUT" && pathname === "/api/settings") {
    const payload = await bodyJson(req, config.maxBodyBytes);
    await withUserContext(auth.telegramKey, true, (client, userId) => accountService.updateSettings(client, userId, payload, reqId));
    return json(res, 200, { ok: true });
  }

  if (req.method === "POST" && pathname === "/api/replace-all") {
    const payload = await bodyJson(req, config.maxBodyBytes);
    await withUserContext(auth.telegramKey, true, (client, userId) => accountService.replaceAll(client, userId, payload, reqId));
    return json(res, 200, { ok: true });
  }

  if (req.method === "DELETE" && pathname === "/api/account") {
    const payload = await bodyJson(req, 16 * 1024);
    await withUserContext(auth.telegramKey, true, (client, userId) => accountService.deleteAccount(client, userId, payload, reqId));
    return json(res, 200, { ok: true });
  }

  const match = pathname.match(/^\/api\/([^/]+)(?:\/([^/]+))?$/);
  if (!match || !COLLECTIONS.includes(match[1])) return errorJson(res, 404, "not_found", "API route not found");
  const collection = match[1];
  const id = match[2] ? decodeURIComponent(match[2]) : "";

  if (req.method === "POST" && !id) {
    const payload = await bodyJson(req, 64 * 1024);
    const createdId = await withUserContext(auth.telegramKey, true, (client, userId) => accountService.createCollectionRow(client, userId, collection, payload));
    return json(res, 200, { ok: true, id: createdId });
  }

  if ((req.method === "PUT" || req.method === "PATCH") && id) {
    const payload = await bodyJson(req, 64 * 1024);
    await withUserContext(auth.telegramKey, true, (client, userId) => accountService.updateCollectionRow(client, userId, collection, id, req.method, payload));
    return json(res, 200, { ok: true, id });
  }

  if (req.method === "DELETE" && id) {
    await withUserContext(auth.telegramKey, true, (client, userId) => accountService.deleteCollectionRow(client, userId, collection, id));
    return json(res, 200, { ok: true });
  }

  return errorJson(res, 405, "method_not_allowed", "Method not allowed");
}

function createAppServer() {
  return http.createServer(async (req, res) => {
    corsHeaders(res, config.corsOrigin);
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
      const mapped = mapDbError(error);
      if (!isAppError(mapped)) console.error("Request error:", mapped && mapped.code, mapped && mapped.message);
      return errorJson(
        res,
        mapped.status || 500,
        mapped.code || "server_error",
        mapped.message || "Server error"
      );
    }
  });
}

async function startServer() {
  const server = createAppServer();
  await new Promise((resolve) => server.listen(config.port, resolve));
  console.log("Копійка слухає порт " + config.port);
  console.log(ai.configured() ? "AI увімкнено: " + ai.AI_MODEL : "AI вимкнено: не задано AI_BASE_URL.");
  void botPolling();
  return server;
}

module.exports = {
  createAppServer,
  startServer
};
