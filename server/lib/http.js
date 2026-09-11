"use strict";

const crypto = require("node:crypto");

const { appError } = require("./errors");

// Mini App живе у WebView Telegram, але вебверсії (web.telegram.org) вбудовують
// його в iframe — тому frame-ancestors перелічує саме їх, а не 'none'.
// Шрифти тягнуться з Google Fonts, а telegram-web-app.js — з telegram.org
// (див. web/index.html). style-src потребує 'unsafe-inline', бо app.js рендерить
// інлайнові стилі; прибрати це можна лише разом із рефакторингом рендера.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' https://telegram.org",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self'",
  "frame-ancestors https://web.telegram.org https://*.telegram.org",
  "base-uri 'none'",
  "form-action 'self'",
  "object-src 'none'"
].join("; ");

// Режим за замовчуванням — Report-Only: політику треба спершу перевірити на всіх
// клієнтах Telegram (iOS, Android, Desktop, Web), і лише тоді вмикати CSP_MODE=enforce.
function securityHeaders(res, mode) {
  const cspMode = String(mode || "report-only").toLowerCase();
  if (cspMode !== "off") {
    res.setHeader(cspMode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", CSP_DIRECTIVES);
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
}

// ETag рахується від тіла, а не від часу: два однакові стани мають дати
// однаковий тег, інакше 304 ніколи не спрацює.
function etagFor(body) {
  return '"' + crypto.createHash("sha1").update(body).digest("base64") + '"';
}

function notModified(res, etag) {
  res.writeHead(304, {
    ETag: etag,
    "Cache-Control": "no-store"
  });
  res.end();
}

function json(res, status, value, headers) {
  const body = JSON.stringify(value);
  const out = Object.assign({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  }, headers || {});
  res.writeHead(status, out);
  res.end(body);
}

function errorJson(res, status, code, message) {
  json(res, status, { error: message, code });
}

function corsHeaders(res, origin) {
  if (!origin) return;
  res.setHeader("Access-Control-Allow-Origin", origin);
  // X-Quick-Token потрібен, коли Mini App і API стоять на різних доменах:
  // без нього перевірка швидкого запису з самого застосунку не пройде preflight.
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data, Authorization, X-Dev-User-Id, X-Quick-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  res.setHeader("Vary", "Origin");
}

async function bodyJson(req, maxBytes) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) throw appError(413, "body_too_large", "Request body too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (error) {
    throw appError(400, "invalid_json", "Invalid JSON");
  }
}

module.exports = {
  json,
  errorJson,
  corsHeaders,
  bodyJson,
  securityHeaders,
  etagFor,
  notModified,
  CSP_DIRECTIVES
};
