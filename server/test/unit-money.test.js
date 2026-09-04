"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { decimalToCents, centsToNumeric, amountToNumeric } = require("../lib/money");
const { normalizeAccount } = require("../lib/state");

test("money helpers keep kopiykas exact", () => {
  assert.equal(decimalToCents("0.10"), 10n);
  assert.equal(decimalToCents("0.20"), 20n);
  assert.equal(decimalToCents("10.23"), 1023n);
  assert.equal(centsToNumeric(1023n), "10.23");
  assert.equal(amountToNumeric(0.1, "amount"), "0.10");
  assert.equal(amountToNumeric(0.2, "amount"), "0.20");
});

test("account normalization keeps decimal amounts without float drift", () => {
  const state = normalizeAccount({
    transactions: [
      { id: "tx1", type: "expense", category: "Хавка", amount: "0.10", wallet: "Кеш", date: "2026-09-04", note: "" },
      { id: "tx2", type: "expense", category: "Хавка", amount: "0.20", wallet: "Кеш", date: "2026-09-04", note: "" }
    ],
    settings: {}
  });
  const sumCents = state.transactions.reduce((acc, row) => acc + decimalToCents(row.amount, "amount"), 0n);
  assert.equal(centsToNumeric(sumCents), "0.30");
  assert.deepEqual(state.transactions.map((row) => row.amount), [0.1, 0.2]);
});
