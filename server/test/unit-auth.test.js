"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { signedInitData, tamperedInitData } = require("./helpers");
const { authenticatedUser } = require("../auth/telegram");

test("authenticatedUser accepts valid Telegram initData", () => {
  const req = {
    headers: {
      "x-telegram-init-data": signedInitData(100001, new Date())
    }
  };
  const auth = authenticatedUser(req);
  assert.equal(auth.mode, "telegram");
  assert.equal(auth.telegramId, "100001");
  assert.match(auth.telegramKey, /^[a-f0-9]{64}$/);
});

test("authenticatedUser rejects tampered initData", () => {
  const req = {
    headers: {
      "x-telegram-init-data": tamperedInitData(100002)
    }
  };
  assert.throws(() => authenticatedUser(req), /signature mismatch/i);
});

test("authenticatedUser rejects expired initData", () => {
  const oldDate = new Date(Date.now() - 3600 * 1000);
  const req = {
    headers: {
      "x-telegram-init-data": signedInitData(100003, oldDate)
    }
  };
  assert.throws(() => authenticatedUser(req), /expired/i);
});

test("authenticatedUser rejects future auth_date", () => {
  const futureDate = new Date(Date.now() + 5 * 60 * 1000);
  const req = {
    headers: {
      "x-telegram-init-data": signedInitData(100004, futureDate)
    }
  };
  assert.throws(() => authenticatedUser(req), /future/i);
});

test("authenticatedUser rejects duplicated initData fields", () => {
  const raw = signedInitData(100005, new Date());
  const req = {
    headers: {
      "x-telegram-init-data": raw + "&user=%7B%22id%22%3A100005%7D"
    }
  };
  assert.throws(() => authenticatedUser(req), /duplicated/i);
});
