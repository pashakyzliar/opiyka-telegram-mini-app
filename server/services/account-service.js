"use strict";

const repository = require("../repositories/account-repository");
const { appError } = require("../lib/errors");
const botAi = require("../bot-ai");
const crypto = require("node:crypto");
const {
  COLLECTIONS,
  defaultSettings,
  normalizeAccount,
  normalizeRow,
  normalizeSettings,
  splitExtras
} = require("../lib/state");

function sanitizeSettingsPatch(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw appError(400, "bad_request", "Settings payload must be an object");
  }
  return payload;
}

function sanitizeAccountPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw appError(400, "bad_request", "Account payload must be an object");
  }
  return payload;
}

function stalePendingIds(state) {
  const now = Date.now();
  return (state.transactions || [])
    .filter((row) => row && row.pending && row.createdAt && now - Date.parse(row.createdAt) > 24 * 60 * 60 * 1000)
    .map((row) => row.id);
}

async function getState(client, userId) {
  const state = await repository.getAccountState(client, userId);
  const staleIds = stalePendingIds(state);
  if (!staleIds.length) return state;
  for (const id of staleIds) {
    await repository.deleteCollectionRow(client, userId, "transactions", id);
  }
  return repository.getAccountState(client, userId);
}

async function getProfile(client, userId) {
  return repository.getProfile(client, userId);
}

async function bindTelegramChat(client, userId, telegramId) { return repository.bindTelegramChat(client, userId, telegramId); }
async function generateQuickToken(client, userId) {
  const token = crypto.randomBytes(24).toString("base64url");
  await repository.setQuickToken(client, userId, crypto.createHash("sha256").update(token).digest("hex"));
  return token;
}
async function revokeQuickToken(client, userId) { return repository.setQuickToken(client, userId, ""); }
async function quickTokenStatus(client, userId) { return repository.quickTokenStatus(client, userId); }
async function findQuickToken(client, hash) { return repository.findQuickToken(client, hash); }
async function registerQuickRequest(client, userId, clientId) { return repository.registerQuickRequest(client, userId, clientId); }

function normalizeGlossaryInput(word) {
  const raw = String(word || "").replace(/[^\p{L}-]+/gu, "").replace(/-+/g, "-").replace(/^-|-$/g, "");
  if (raw.length < 2 || raw.length > 32) throw appError(400, "invalid_word", "Word must contain 2–32 letters");
  const normalized = botAi.normalizeWord(raw);
  if (!normalized) throw appError(400, "invalid_word", "Word is invalid");
  return { raw, normalized };
}

async function listGlossary(client, userId) { return repository.listGlossary(client, userId); }
async function glossaryCategories(client, userId) { return repository.glossaryCategories(client, userId); }
async function glossaryMap(client, userId) { return repository.glossaryMap(client, userId); }
async function incrementGlossaryHit(client, userId, word) { return repository.incrementGlossaryHit(client, userId, word); }
async function createGlossary(client, userId, payload) {
  const input = normalizeGlossaryInput(payload && payload.word);
  const count = await repository.listGlossary(client, userId);
  if (count.length >= 500 && !count.some((row) => botAi.normalizeWord(row.word) === input.normalized)) throw appError(400, "glossary_limit", "Glossary limit reached");
  return repository.upsertGlossary(client, userId, input.normalized, input.raw, String(payload && payload.categoryId || ""), "manual");
}
async function updateGlossary(client, userId, id, payload) {
  return repository.updateGlossaryCategory(client, userId, id, String(payload && payload.categoryId || ""));
}
async function deleteGlossary(client, userId, id) { return repository.deleteGlossary(client, userId, id); }
async function learnGlossary(client, userId, rawWord, categoryName) {
  const input = normalizeGlossaryInput(rawWord);
  return repository.upsertGlossaryByCategoryName(client, userId, input.normalized, input.raw, categoryName);
}

async function updateSettings(client, userId, payload, requestId) {
  const patch = sanitizeSettingsPatch(payload);
  const current = await repository.getAccountState(client, userId);
  const merged = Object.assign({}, defaultSettings(), current.settings || {}, patch);
  const normalized = normalizeSettings(merged, current);
  await repository.replaceSettings(client, userId, normalized.value, normalized.extra);
  await repository.writeAuditEvent(client, userId, "settings_updated", requestId, {
    fields: Object.keys(patch).sort()
  });
}

async function replaceAll(client, userId, payload, requestId) {
  const normalized = normalizeAccount(sanitizeAccountPayload(payload));
  await repository.replaceAll(client, userId, normalized);
  await repository.writeAuditEvent(client, userId, "replace_all", requestId, {
    counts: COLLECTIONS.reduce((acc, key) => {
      acc[key] = normalized[key].length;
      return acc;
    }, {})
  });
}

async function createCollectionRow(client, userId, collection, payload) {
  if (!COLLECTIONS.includes(collection)) throw appError(404, "not_found", "API route not found");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw appError(400, "bad_request", "Payload must be an object");
  }
  const normalized = normalizeRow(collection, payload);
  await repository.upsertCollectionRow(client, userId, collection, normalized.value, normalized.extra);
  return normalized.value.id;
}

async function updateCollectionRow(client, userId, collection, id, method, payload) {
  if (!COLLECTIONS.includes(collection)) throw appError(404, "not_found", "API route not found");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw appError(400, "bad_request", "Payload must be an object");
  }
  const existing = await repository.getCollectionRow(client, userId, collection, id);
  if (method === "PATCH" && !existing) throw appError(404, "not_found", "Record not found");
  const raw = method === "PATCH"
    ? Object.assign({}, existing, payload, { id })
    : Object.assign({}, payload, { id, createdAt: (payload && payload.createdAt) || (existing && existing.createdAt) });
  const normalized = normalizeRow(collection, raw);
  await repository.upsertCollectionRow(client, userId, collection, normalized.value, normalized.extra);
  return normalized.value.id;
}

async function deleteCollectionRow(client, userId, collection, id) {
  if (!COLLECTIONS.includes(collection)) throw appError(404, "not_found", "API route not found");
  await repository.deleteCollectionRow(client, userId, collection, id);
}

async function exportAccount(client, userId, requestId) {
  const state = await repository.getAccountState(client, userId);
  await repository.writeAuditEvent(client, userId, "account_exported", requestId, {
    counts: COLLECTIONS.reduce((acc, key) => {
      acc[key] = state[key].length;
      return acc;
    }, {})
  });
  return Object.assign({
    app: "kopiyka",
    version: 5,
    exportedAt: new Date().toISOString()
  }, state);
}

async function deleteAccount(client, userId, payload, requestId) {
  const body = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  if (body.confirm !== "DELETE" || body.confirmAgain !== "DELETE") {
    throw appError(400, "confirmation_required", "Account deletion confirmation is invalid");
  }
  await repository.writeAuditEvent(client, userId, "account_deleted", requestId, {
    confirmed: true
  });
  await repository.deleteAccount(client, userId);
}

module.exports = {
  getState,
  getProfile,
  bindTelegramChat,
  generateQuickToken,
  revokeQuickToken,
  quickTokenStatus,
  findQuickToken,
  registerQuickRequest,
  listGlossary,
  glossaryCategories,
  glossaryMap,
  incrementGlossaryHit,
  createGlossary,
  updateGlossary,
  deleteGlossary,
  learnGlossary,
  updateSettings,
  replaceAll,
  createCollectionRow,
  updateCollectionRow,
  deleteCollectionRow,
  exportAccount,
  deleteAccount
};
