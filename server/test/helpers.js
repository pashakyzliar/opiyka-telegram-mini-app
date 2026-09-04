"use strict";

const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { Pool } = require("pg");
const { sign } = require("@tma.js/init-data-node");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const MIGRATE_BIN = path.join(ROOT_DIR, "node_modules", "node-pg-migrate", "bin", "node-pg-migrate.js");

function applyTestEnv() {
  process.env.NODE_ENV = "test";
  process.env.PORT = "0";
  process.env.PUBLIC_URL = "https://example.com";
  process.env.BOT_TOKEN = process.env.BOT_TOKEN || "123456:TEST_TOKEN";
  process.env.USER_ID_PEPPER = process.env.USER_ID_PEPPER || "test-pepper";
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || "postgres://kopiyka:kopiyka@127.0.0.1:5432/kopiyka";
  process.env.DATABASE_SSL_MODE = "disable";
  process.env.INIT_DATA_MAX_AGE = "900";
  process.env.INIT_DATA_MAX_FUTURE_SKEW = "60";
  process.env.ALLOW_DEV_AUTH = "0";
}

applyTestEnv();

function runMigrations(direction, extraArgs) {
  execFileSync("node", [MIGRATE_BIN, "-m", path.join(ROOT_DIR, "server", "db", "migrations"), direction].concat(extraArgs || []), {
    cwd: ROOT_DIR,
    env: process.env,
    stdio: "pipe"
  });
}

async function resetDatabase() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
  try {
    await pool.query("TRUNCATE TABLE security_audit_events, users CASCADE");
  } finally {
    await pool.end();
  }
}

function signedInitData(telegramId, authDate) {
  return sign({
    user: {
      id: Number(telegramId)
    }
  }, process.env.BOT_TOKEN, authDate || new Date());
}

function tamperedInitData(telegramId) {
  return signedInitData(telegramId).replace(/hash=[a-f0-9]+/, "hash=" + "0".repeat(64));
}

async function startServer() {
  const { createAppServer } = require("../app");
  const server = createAppServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  return {
    server,
    baseUrl: "http://127.0.0.1:" + port
  };
}

async function stopServer(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

async function requestJson(baseUrl, pathname, options) {
  const opts = Object.assign({ method: "GET", headers: {} }, options || {});
  const res = await fetch(baseUrl + pathname, opts);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_error) {}
  return { res, body, text };
}

let uniqueCounter = 500000;
function uniqueTelegramId() {
  uniqueCounter += 1;
  return String(uniqueCounter);
}

module.exports = {
  ROOT_DIR,
  applyTestEnv,
  runMigrations,
  resetDatabase,
  signedInitData,
  tamperedInitData,
  startServer,
  stopServer,
  requestJson,
  uniqueTelegramId
};
