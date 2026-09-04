"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  runMigrations,
  resetDatabase,
  signedInitData,
  tamperedInitData,
  startServer,
  stopServer,
  requestJson,
  uniqueTelegramId
} = require("./helpers");
const { closePool } = require("../db");

let appServer;
let baseUrl;

test.before(async () => {
  runMigrations("up");
  await resetDatabase();
  const started = await startServer();
  appServer = started.server;
  baseUrl = started.baseUrl;
});

test.after(async () => {
  await stopServer(appServer);
  await closePool();
});

function authHeaders(telegramId, initData) {
  return { "X-Telegram-Init-Data": initData || signedInitData(telegramId, new Date()) };
}

test("API isolates two users", async () => {
  const userA = uniqueTelegramId();
  const userB = uniqueTelegramId();
  await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(userA)),
    body: JSON.stringify({ type: "expense", category: "Хавка", amount: "10.25", wallet: "Кеш", date: "2026-09-04", note: "A" })
  });
  await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(userB)),
    body: JSON.stringify({ type: "expense", category: "Машина", amount: "99.99", wallet: "Кеш", date: "2026-09-04", note: "B" })
  });
  const stateA = await requestJson(baseUrl, "/api/state", { headers: authHeaders(userA) });
  const stateB = await requestJson(baseUrl, "/api/state", { headers: authHeaders(userB) });
  assert.equal(stateA.body.transactions.length, 1);
  assert.equal(stateB.body.transactions.length, 1);
  assert.equal(stateA.body.transactions[0].note, "A");
  assert.equal(stateB.body.transactions[0].note, "B");
});

test("API rejects forged initData", async () => {
  const result = await requestJson(baseUrl, "/api/state", {
    headers: authHeaders(uniqueTelegramId(), tamperedInitData(uniqueTelegramId()))
  });
  assert.equal(result.res.status, 401);
  assert.equal(result.body.code, "invalid_init_data");
});

test("API rejects expired initData", async () => {
  const result = await requestJson(baseUrl, "/api/state", {
    headers: authHeaders(uniqueTelegramId(), signedInitData(uniqueTelegramId(), new Date(Date.now() - 3600 * 1000)))
  });
  assert.equal(result.res.status, 401);
  assert.equal(result.body.code, "expired_init_data");
});

test("API is safe against SQL injection strings", async () => {
  const user = uniqueTelegramId();
  const note = `"; DROP TABLE users; --`;
  const write = await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ type: "expense", category: "Хавка", amount: "1.10", wallet: "Кеш", date: "2026-09-04", note })
  });
  assert.equal(write.res.status, 200);
  const state = await requestJson(baseUrl, "/api/state", { headers: authHeaders(user) });
  assert.equal(state.body.transactions[0].note, note);
});

test("parallel transaction writes do not lose data", async () => {
  const user = uniqueTelegramId();
  await Promise.all(Array.from({ length: 12 }, (_, index) => requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({
      id: "tx.parallel." + index,
      type: "expense",
      category: "Хавка",
      amount: "0.10",
      wallet: "Кеш",
      date: "2026-09-04",
      note: "P" + index
    })
  })));
  const state = await requestJson(baseUrl, "/api/state", { headers: authHeaders(user) });
  assert.equal(state.body.transactions.length, 12);
});

test("replace-all rolls back on foreign key failure", async () => {
  const user = uniqueTelegramId();
  await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ id: "safe-tx", type: "expense", category: "Хавка", amount: "4.50", wallet: "Кеш", date: "2026-09-04", note: "safe" })
  });
  const invalid = await requestJson(baseUrl, "/api/replace-all", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({
      transactions: [
        { id: "broken", type: "expense", category: "Хавка", amount: "5.00", wallet: "Кеш", date: "2026-09-04", note: "broken", recId: "missing-recurring" }
      ],
      goals: [],
      recurring: [],
      debts: [],
      amortize: [],
      settings: {}
    })
  });
  assert.equal(invalid.res.status, 400);
  const state = await requestJson(baseUrl, "/api/state", { headers: authHeaders(user) });
  assert.equal(state.body.transactions.length, 1);
  assert.equal(state.body.transactions[0].id, "safe-tx");
});

test("export endpoint returns all user data", async () => {
  const user = uniqueTelegramId();
  await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ id: "export-tx", type: "income", category: "ЗП", amount: "10.23", wallet: "Кеш", date: "2026-09-04", note: "salary" })
  });
  const exported = await requestJson(baseUrl, "/api/export", { headers: authHeaders(user) });
  assert.equal(exported.res.status, 200);
  assert.equal(exported.body.transactions.length, 1);
  assert.equal(exported.body.transactions[0].amount, 10.23);
  assert.equal(exported.body.app, "kopiyka");
});

test("account deletion requires confirmation and removes data", async () => {
  const user = uniqueTelegramId();
  await requestJson(baseUrl, "/api/transactions", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ id: "delete-tx", type: "expense", category: "Хавка", amount: "2.00", wallet: "Кеш", date: "2026-09-04", note: "bye" })
  });
  const bad = await requestJson(baseUrl, "/api/account", {
    method: "DELETE",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ confirm: "NOPE", confirmAgain: "NOPE" })
  });
  assert.equal(bad.res.status, 400);
  const good = await requestJson(baseUrl, "/api/account", {
    method: "DELETE",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(user)),
    body: JSON.stringify({ confirm: "DELETE", confirmAgain: "DELETE" })
  });
  assert.equal(good.res.status, 200);
  const state = await requestJson(baseUrl, "/api/state", { headers: authHeaders(user) });
  assert.equal(state.body.transactions.length, 0);
});
