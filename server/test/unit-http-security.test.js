"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { securityHeaders, etagFor, CSP_DIRECTIVES } = require("../lib/http");

function fakeRes() {
  const headers = {};
  return {
    headers,
    setHeader(name, value) { headers[name] = value; }
  };
}

test("типовий режим — лише звіти, щоб не зламати клієнтів Telegram", () => {
  const res = fakeRes();
  securityHeaders(res);
  assert.equal(res.headers["Content-Security-Policy-Report-Only"], CSP_DIRECTIVES);
  assert.equal(res.headers["Content-Security-Policy"], undefined);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
  assert.equal(res.headers["Referrer-Policy"], "no-referrer");
  assert.match(res.headers["Permissions-Policy"], /camera=\(\)/);
});

test("enforce вмикає саму політику", () => {
  const res = fakeRes();
  securityHeaders(res, "enforce");
  assert.equal(res.headers["Content-Security-Policy"], CSP_DIRECTIVES);
  assert.equal(res.headers["Content-Security-Policy-Report-Only"], undefined);
});

test("off лишає решту заголовків, але прибирає CSP", () => {
  const res = fakeRes();
  securityHeaders(res, "off");
  assert.equal(res.headers["Content-Security-Policy"], undefined);
  assert.equal(res.headers["Content-Security-Policy-Report-Only"], undefined);
  assert.equal(res.headers["X-Content-Type-Options"], "nosniff");
});

test("CSP дозволяє те, що застосунок реально вантажить", () => {
  // web/index.html тягне telegram-web-app.js і Google Fonts, а app.js рендерить
  // інлайнові стилі. Якщо CSP це заборонить, Mini App просто не запуститься.
  assert.match(CSP_DIRECTIVES, /script-src 'self' https:\/\/telegram\.org/);
  assert.match(CSP_DIRECTIVES, /style-src [^;]*'unsafe-inline'/);
  assert.match(CSP_DIRECTIVES, /font-src [^;]*https:\/\/fonts\.gstatic\.com/);
  assert.match(CSP_DIRECTIVES, /frame-ancestors [^;]*telegram\.org/);
});

test("ETag стабільний для однакового тіла й різний для різного", () => {
  const a = etagFor(JSON.stringify({ transactions: [{ id: "t1", amount: 10 }] }));
  const b = etagFor(JSON.stringify({ transactions: [{ id: "t1", amount: 10 }] }));
  const c = etagFor(JSON.stringify({ transactions: [{ id: "t1", amount: 11 }] }));
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.match(a, /^".+"$/);
});
