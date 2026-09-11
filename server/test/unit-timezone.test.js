"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { todayInZone, normalizeTimeZone, accountTimeZone } = require("../lib/dates");
const botAi = require("../bot-ai");

test("todayInZone рахує дату за поясом користувача, а не процесу", () => {
  // 2026-09-11T22:30:00Z — це вже 12 вересня в Києві, але ще 11-те в UTC.
  const at = new Date("2026-09-11T22:30:00Z");
  assert.equal(todayInZone("Europe/Kyiv", null, at), "2026-09-12");
  assert.equal(todayInZone("UTC", null, at), "2026-09-11");
});

test("todayInZone падає назад на зсув у хвилинах, коли поясу немає", () => {
  const at = new Date("2026-09-11T22:30:00Z");
  assert.equal(todayInZone("", 180, at), "2026-09-12");
  assert.equal(todayInZone("", 0, at), "2026-09-11");
});

test("todayInZone ігнорує сміття замість поясу", () => {
  const at = new Date("2026-09-11T22:30:00Z");
  assert.equal(todayInZone("Not/AZone", 0, at), "2026-09-11");
  assert.equal(todayInZone("../../etc/passwd", 0, at), "2026-09-11");
  assert.match(todayInZone("x".repeat(200), null, at), /^\d{4}-\d{2}-\d{2}$/);
});

test("normalizeTimeZone приймає лише справжні зони", () => {
  assert.equal(normalizeTimeZone("Europe/Kyiv"), "Europe/Kyiv");
  assert.equal(normalizeTimeZone(" UTC "), "UTC");
  assert.equal(normalizeTimeZone("Europe/Нема"), "");
  assert.equal(normalizeTimeZone(null), "");
});

test("accountTimeZone читає пояс із налаштувань акаунта", () => {
  assert.equal(accountTimeZone({ settings: { timezone: "Europe/Kyiv" } }), "Europe/Kyiv");
  assert.equal(accountTimeZone({ settings: {} }), "");
  assert.equal(accountTimeZone(null), "");
});

test("botAi.todayISO поважає пояс і лишається сумісним без нього", () => {
  assert.match(botAi.todayISO(), /^\d{4}-\d{2}-\d{2}$/);
  // Kiritimati (UTC+14) і Etc/GMT+12 (UTC-12) розділяє 26 годин, тож дати
  // не збігаються ніколи — тест не «мигає» залежно від часу прогону.
  assert.notEqual(botAi.todayISO("Pacific/Kiritimati"), botAi.todayISO("Etc/GMT+12"));
});
