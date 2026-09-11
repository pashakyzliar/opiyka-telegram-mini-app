"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const botAi = require("../bot-ai");
const { dayAllowance } = require("../allowance");
const { normalizeAccount } = require("../lib/state");

const categories = [
  { name: "Сіги", color: "#97a851", icon: "🚬" },
  { name: "Хавка", color: "#63b06e", icon: "🍔" }
];

test("normalizeDraft keeps unknown expense category pending instead of falling back", () => {
  const row = botAi.normalizeDraft({
    type: "expense",
    category: "Стіки",
    amount: 150,
    wallet: "Кеш",
    date: "2026-09-04",
    note: "стіки"
  }, categories);
  assert.equal(row.category, null);
  assert.equal(row.needsCategory, true);
});

test("glossary quick path resolves one amount and one normalized word", () => {
  const row = botAi.resolveGlossaryWrite("150 стіки", { стік: "Сіги" }, categories);
  assert.equal(row.category, "Сіги");
  assert.equal(row.amount, 150);
  assert.equal(row.note, "стіки");
});

test("dayAllowance ignores pending and reserve rows", () => {
  const account = normalizeAccount({
    transactions: [
      { id: "t1", type: "expense", category: "Сіги", amount: 100, wallet: "Кеш", date: "2026-09-04", note: "" },
      { id: "t2", type: "expense", category: null, amount: 300, wallet: "Кеш", date: "2026-09-04", note: "стіки", pending: true },
      { id: "t3", type: "expense", category: "Сіги", amount: 200, wallet: "Кеш", date: "2026-09-04", note: "", reserve: true }
    ],
    settings: {
      allowanceEnabled: true,
      weekDaily: [0, 0, 0, 1000, 0, 0, 0]
    }
  });
  const info = dayAllowance(account, "2026-09-04");
  assert.equal(info.spentToday, 100);
  assert.equal(info.todayAvailable, 900);
});

test("категорія береться з історії, коли вибір користувача був послідовним", () => {
  const transactions = [
    { type: "expense", category: "Хавка", amount: 120, date: botAi.isoAdd(botAi.todayISO(), -3), note: "кава" },
    { type: "expense", category: "Хавка", amount: 130, date: botAi.isoAdd(botAi.todayISO(), -10), note: "Кава" }
  ];
  const row = botAi.resolveFromHistory("кава 120", transactions, categories);
  assert.equal(row.category, "Хавка");
  assert.equal(row.amount, 120);
  assert.equal(row.categorySource, "history");
});

test("історія не використовується, коли та сама покупка йшла в різні категорії", () => {
  const transactions = [
    { type: "expense", category: "Хавка", amount: 120, date: botAi.isoAdd(botAi.todayISO(), -3), note: "кава" },
    { type: "expense", category: "Сіги", amount: 120, date: botAi.isoAdd(botAi.todayISO(), -4), note: "кава" }
  ];
  assert.equal(botAi.resolveFromHistory("кава 120", transactions, categories), null);
});

test("історія не бере старі записи й pending", () => {
  const stale = [
    { type: "expense", category: "Хавка", amount: 120, date: botAi.isoAdd(botAi.todayISO(), -365), note: "кава" },
    { type: "expense", category: "Хавка", amount: 120, date: botAi.isoAdd(botAi.todayISO(), -400), note: "кава" }
  ];
  assert.equal(botAi.resolveFromHistory("кава 120", stale, categories), null);
  const pending = [
    { type: "expense", category: "Хавка", amount: 120, date: botAi.todayISO(), note: "кава", pending: true },
    { type: "expense", category: "Хавка", amount: 120, date: botAi.todayISO(), note: "кава", pending: true }
  ];
  assert.equal(botAi.resolveFromHistory("кава 120", pending, categories), null);
});

test("фільтр розуміє межі суми й пошук за нотаткою", () => {
  const filter = botAi.normalizeFilter({
    categories: [],
    type: "expense",
    from: "2026-08-01",
    to: "2026-08-31",
    minAmount: 500,
    maxAmount: 100,
    query: "ресторан"
  }, categories);
  // Межі, переплутані моделлю, міняються місцями, інакше вибірка порожня.
  assert.equal(filter.minAmount, 100);
  assert.equal(filter.maxAmount, 500);
  assert.equal(filter.query, "ресторан");

  const rows = botAi.filterTransactions([
    { type: "expense", category: "Хавка", amount: 200, date: "2026-08-10", note: "ресторан у центрі" },
    { type: "expense", category: "Хавка", amount: 50, date: "2026-08-11", note: "ресторан" },
    { type: "expense", category: "Хавка", amount: 300, date: "2026-08-12", note: "таксі" }
  ], filter);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 200);
});

test("formatWriteReply renders allowance bar in html", () => {
  const text = botAi.formatWriteReply([{
    type: "expense",
    category: "Сіги",
    amount: 190,
    wallet: "Кеш",
    date: botAi.todayISO(),
    note: "сіги"
  }], {
    enabled: true,
    configured: true,
    todayLimit: 1000,
    spentToday: 640,
    todayAvailable: 360,
    weekAvailable: 520,
    overBy: 0,
    expenseCategories: categories
  });
  assert.match(text, /<code>/);
  assert.match(text, /520/);
  assert.match(text, /лишилось <b>/);
  assert.match(text, /Сіги/);
});
