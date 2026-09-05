"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../web/telegram-adapter.js"), "utf8");
const settle = () => new Promise((resolve) => setImmediate(resolve));
const copy = (value) => JSON.parse(JSON.stringify(value));

async function apiHarness() {
  const timers = new Set();
  const server = {
    state: { transactions: [], goals: [], settings: { budgets: { Хавка: 500 }, expenseCategories: [{ name: "Хавка", icon: "🍔" }] } },
    reads: 0,
    beforeRead: null
  };
  const window = { KOPIYKA_DEV_USER_ID: "test", location: { origin: "http://localhost", protocol: "http:" } };
  vm.runInNewContext(source, {
    window, console, Promise,
    setInterval(fn) { timers.add(fn); return fn; },
    clearInterval(fn) { timers.delete(fn); },
    async fetch(url, options) {
      if (options.method === "POST") {
        server.state.transactions.push({ id: "new", ...JSON.parse(options.body) });
        return { ok: true, text: async () => JSON.stringify({ id: "new" }) };
      }
      server.reads++;
      const body = JSON.stringify(server.state);
      if (server.beforeRead) await server.beforeRead();
      return { ok: true, text: async () => body };
    }
  });
  const db = await window.claude.use("db");
  return {
    db, server, timers,
    async poll() { for (const tick of timers) tick(); await settle(); }
  };
}

test("повторні незмінені SQL-снапшоти не запускають перерендер", async () => {
  const h = await apiHarness();
  let collections = 0, settings = 0;
  h.db.collection("transactions").onSnapshot(() => collections++);
  h.db.doc("settings/main").onSnapshot(() => settings++);
  for (let i = 0; i < 30; i++) await h.poll();
  assert.equal(collections, 1);
  assert.equal(settings, 1);
  assert.equal(h.server.reads, 31);
});

test("нова витрата оновлює лише журнал, зберігаючи поля налаштувань", async () => {
  const h = await apiHarness();
  let txCalls = 0, goalCalls = 0, settingsCalls = 0;
  h.db.collection("transactions").onSnapshot(() => txCalls++);
  h.db.collection("goals").onSnapshot(() => goalCalls++);
  h.db.doc("settings/main").onSnapshot(() => settingsCalls++);
  h.server.state.transactions.push({ id: "bot", amount: 190 });
  await h.poll();
  assert.deepEqual([txCalls, goalCalls, settingsCalls], [2, 1, 1]);
  h.server.state.settings.budgets.Хавка = 800;
  await h.poll();
  assert.deepEqual([txCalls, goalCalls, settingsCalls], [2, 1, 2]);
  h.server.state.transactions = [];
  await h.poll();
  assert.deepEqual([txCalls, goalCalls, settingsCalls], [3, 1, 2]);
});

test("редагування локального снапшота не змінює кеш синхронізації", async () => {
  const h = await apiHarness();
  h.db.doc("settings/main").onSnapshot((snap) => { snap.data().budgets.Хавка = 10; });
  let received;
  h.db.doc("settings/main").onSnapshot((snap) => { received = copy(snap.data()); });
  assert.equal(received.budgets.Хавка, 500);
});

test("запис під час фонового запиту очікує свіжий стан після збереження", async () => {
  const h = await apiHarness();
  let received = [];
  h.db.collection("transactions").onSnapshot((snap) => { received = snap.docs.map((doc) => doc.data()); });
  let release;
  h.server.beforeRead = () => new Promise((resolve) => { release = resolve; });
  for (const tick of h.timers) tick();
  const saved = h.db.collection("transactions").add({ amount: 190 });
  await settle();
  h.server.beforeRead = null;
  release();
  await saved;
  await settle();
  assert.equal(received.length, 1);
  assert.equal(received[0].amount, 190);
});

test("відписка від усіх даних зупиняє фоновий таймер", async () => {
  const h = await apiHarness();
  const stop = h.db.collection("transactions").onSnapshot(() => {});
  assert.equal(h.timers.size, 1);
  stop();
  assert.equal(h.timers.size, 0);
});
