"use strict";

const path = require("node:path");
const fs = require("node:fs");
const { loadEnvFiles } = require("./lib/env");

const ROOT_DIR = path.resolve(__dirname, "..");

loadEnvFiles([
  path.join(ROOT_DIR, ".env"),
  path.join(ROOT_DIR, ".env.local"),
  path.join(__dirname, ".env"),
  path.join(__dirname, ".env.local")
]);

function numberEnv(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function booleanEnv(name, fallback) {
  const raw = String(process.env[name] || "");
  if (!raw) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function sslConfig() {
  const mode = String(process.env.DATABASE_SSL_MODE || "disable").toLowerCase();
  if (mode === "disable" || mode === "false" || mode === "0") return false;
  const cfg = {
    rejectUnauthorized: booleanEnv("DATABASE_SSL_REJECT_UNAUTHORIZED", true)
  };
  const caPath = process.env.DATABASE_SSL_CA_FILE;
  if (caPath && fs.existsSync(caPath)) cfg.ca = fs.readFileSync(caPath, "utf8");
  return cfg;
}

module.exports = {
  rootDir: ROOT_DIR,
  port: numberEnv("PORT", 3000),
  botToken: String(process.env.BOT_TOKEN || ""),
  publicUrl: String(process.env.PUBLIC_URL || "").replace(/\/$/, ""),
  corsOrigin: String(process.env.CORS_ORIGIN || ""),
  allowDevAuth: booleanEnv("ALLOW_DEV_AUTH", false) && process.env.NODE_ENV !== "production",
  devUserId: String(process.env.DEV_USER_ID || "local"),
  initDataMaxAgeSeconds: numberEnv("INIT_DATA_MAX_AGE", 900),
  initDataMaxFutureSkewSeconds: numberEnv("INIT_DATA_MAX_FUTURE_SKEW", 60),
  userIdPepper: String(process.env.USER_ID_PEPPER || ""),
  databaseUrl: String(process.env.DATABASE_URL || "postgres://kopiyka:kopiyka@127.0.0.1:5432/kopiyka"),
  databaseSsl: sslConfig(),
  maxBodyBytes: numberEnv("MAX_BODY_BYTES", 2 * 1024 * 1024),
  jsonImportSource: path.resolve(process.env.JSON_IMPORT_SOURCE || path.join(__dirname, "data", "users.json"))
};
