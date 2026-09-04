"use strict";

const { appError } = require("./errors");

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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Telegram-Init-Data, Authorization, X-Dev-User-Id");
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
  bodyJson
};
