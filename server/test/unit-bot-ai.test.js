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
    overBy: 0,
    expenseCategories: categories
  });
  assert.match(text, /<code>/);
  assert.match(text, /лишилось <b>/);
  assert.match(text, /Сіги/);
});
