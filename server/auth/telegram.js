"use strict";

const crypto = require("node:crypto");
const {
  validate,
  SignatureInvalidError,
  SignatureMissingError,
  ExpiredError,
  AuthDateInvalidError
} = require("@tma.js/init-data-node");

const config = require("../config");
const { appError } = require("../lib/errors");

function assertUniqueQueryKeys(raw) {
  const seen = new Set();
  const pairs = String(raw || "").split("&").filter(Boolean);
  for (const pair of pairs) {
    const [rawKey] = pair.split("=", 1);
    const key = decodeURIComponent(String(rawKey || "").replace(/\+/g, "%20"));
    if (seen.has(key)) {
      throw appError(401, "duplicate_init_data_key", "Telegram init data contains duplicated fields");
    }
    seen.add(key);
  }
}

function pseudonymizeTelegramId(telegramId) {
  if (!config.userIdPepper) {
    throw appError(503, "server_not_configured", "USER_ID_PEPPER is not configured");
  }
  return crypto.createHmac("sha256", config.userIdPepper).update(String(telegramId)).digest("hex");
}

function mapValidationError(error) {
  // The package can surface error instances from an internal dependency, so
  // constructor identity is not stable across package-manager layouts.
  const name = error && (error.name || (error.constructor && error.constructor.name));
  if (error instanceof SignatureMissingError || name === "SignatureMissingError") return appError(401, "missing_init_data_hash", "Telegram init data hash is missing");
  if (error instanceof SignatureInvalidError || name === "SignatureInvalidError") return appError(401, "invalid_init_data", "Telegram init data signature mismatch");
  if (error instanceof ExpiredError || name === "ExpiredError") return appError(401, "expired_init_data", "Telegram init data expired");
  if (error instanceof AuthDateInvalidError || name === "AuthDateInvalidError") return appError(401, "invalid_auth_date", "Telegram auth_date is invalid");
  return appError(401, "unauthorized", "Telegram authorization required");
}

function authenticatedUser(req) {
  const header = req.headers["x-telegram-init-data"] || req.headers.authorization || "";
  const raw = String(header).replace(/^tma\s+/i, "").trim();
  if (!raw) {
    if (config.allowDevAuth) {
      const devId = String(req.headers["x-dev-user-id"] || config.devUserId || "local");
      if (/^[A-Za-z0-9_-]{1,80}$/.test(devId)) {
        return {
          mode: "dev",
          telegramId: devId,
          telegramKey: pseudonymizeTelegramId("dev:" + devId)
        };
      }
    }
    throw appError(401, "unauthorized", "Telegram authorization required");
  }

  assertUniqueQueryKeys(raw);
  try {
    validate(raw, config.botToken, { expiresIn: config.initDataMaxAgeSeconds });
  } catch (error) {
    throw mapValidationError(error);
  }

  const params = new URLSearchParams(raw);
  const authDateRaw = params.get("auth_date") || "";
  const authDateSeconds = Number(authDateRaw);
  const authDate = Number.isFinite(authDateSeconds) ? new Date(authDateSeconds * 1000) : null;
  if (!authDate) throw appError(401, "invalid_auth_date", "Telegram auth_date is invalid");
  const futureSkewMs = config.initDataMaxFutureSkewSeconds * 1000;
  if (authDate.getTime() - Date.now() > futureSkewMs) {
    throw appError(401, "future_auth_date", "Telegram auth_date is in the future");
  }
  let telegramUser = null;
  try {
    telegramUser = JSON.parse(params.get("user") || "null");
  } catch (_error) {
    throw appError(401, "invalid_user", "Telegram user payload is invalid");
  }
  if (!telegramUser || telegramUser.id === undefined || telegramUser.id === null) {
    throw appError(401, "missing_user", "Telegram user is missing");
  }

  return {
    mode: "telegram",
    telegramId: String(telegramUser.id),
    telegramKey: pseudonymizeTelegramId(telegramUser.id),
    firstName: String(telegramUser.first_name || "").trim().slice(0, 80),
    photoUrl: String(telegramUser.photo_url || "").trim().slice(0, 2048)
  };
}

module.exports = {
  authenticatedUser,
  pseudonymizeTelegramId
};
