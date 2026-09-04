"use strict";

const repository = require("../repositories/account-repository");
const { appError } = require("../lib/errors");
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

async function getState(client, userId) {
  return repository.getAccountState(client, userId);
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
  updateSettings,
  replaceAll,
  createCollectionRow,
  updateCollectionRow,
  deleteCollectionRow,
  exportAccount,
  deleteAccount
};
