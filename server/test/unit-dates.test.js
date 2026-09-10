"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { types } = require("pg");

require("../db");
const roo = require("../roo");

test("DATE з БД не з'їжджає на день у будь-якому TZ процесу", () => {
  const parse = types.getTypeParser(1082);
  for (const value of ["2026-09-10", "2026-01-01", "2026-12-31", "2024-02-29"]) {
    assert.equal(parse(value).toISOString().slice(0, 10), value);
  }
  assert.equal(parse("2026-09-01").toISOString().slice(0, 7), "2026-09");
});

test("Roo ігнорує неправдоподібний зсув часового поясу", () => {
  assert.doesNotThrow(() => roo.todayFor(1e12));
  assert.match(roo.todayFor(1e12), /^\d{4}-\d{2}-\d{2}$/);
  assert.match(roo.todayFor("abc"), /^\d{4}-\d{2}-\d{2}$/);
});
