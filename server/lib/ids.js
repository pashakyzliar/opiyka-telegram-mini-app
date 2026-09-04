"use strict";

const crypto = require("node:crypto");

function newId(prefix) {
  return String(prefix || "t") + Date.now().toString(36) + crypto.randomBytes(5).toString("hex");
}

function normalizeId(value, fallbackPrefix) {
  const raw = String(value || "").trim();
  if (!raw) return newId(fallbackPrefix);
  if (raw.length > 120 || /[\u0000-\u001f\u007f]/.test(raw)) {
    throw new Error("Invalid identifier");
  }
  return raw;
}

module.exports = {
  newId,
  normalizeId
};
