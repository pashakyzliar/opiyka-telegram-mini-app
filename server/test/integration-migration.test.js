"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const {
  ROOT_DIR,
  runMigrations,
  resetDatabase,
  startServer,
  stopServer,
  requestJson,
  signedInitData
} = require("./helpers");
const { closePool } = require("../db");

let appServer;
let baseUrl;

test.before(async () => {
  runMigrations("up");
  await resetDatabase();
  const started = await startServer();
  appServer = started.server;
  baseUrl = started.baseUrl;
});

test.after(async () => {
  await stopServer(appServer);
  await closePool();
});

test("JSON import supports dry-run and idempotent re-run", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "kopiyka-import-"));
  const sourceFile = path.join(tempDir, "users.json");
  const legacyUserId = "700001";
  await fs.writeFile(sourceFile, JSON.stringify({
    users: {
      [legacyUserId]: {
        transactions: [
          { id: "mig-tx", type: "expense", category: "Хавка", amount: "15.75", wallet: "Кеш", date: "2026-09-04", note: "import" }
        ],
        goals: [
          { id: "mig-goal", name: "Подушка", target: "100.00", current: "20.00", deadline: "", closedAt: "" }
        ],
        recurring: [],
        debts: [],
        amortize: [],
        settings: {
          budgets: { "Хавка": "500.00" }
        }
      }
    }
  }, null, 2), "utf8");

  const dryRun = JSON.parse(execFileSync("node", ["server/import-json.js", "--source", sourceFile, "--dry-run"], {
    cwd: ROOT_DIR,
    env: process.env
  }).toString("utf8"));
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.totals.transactions, 1);

  const firstImport = JSON.parse(execFileSync("node", ["server/import-json.js", "--source", sourceFile], {
    cwd: ROOT_DIR,
    env: process.env
  }).toString("utf8"));
  assert.equal(firstImport.dryRun, false);
  assert.equal(firstImport.totals.goals, 1);
  assert.ok(firstImport.backupFile);

  const secondImport = JSON.parse(execFileSync("node", ["server/import-json.js", "--source", sourceFile], {
    cwd: ROOT_DIR,
    env: process.env
  }).toString("utf8"));
  assert.equal(secondImport.totals.transactions, 1);

  const state = await requestJson(baseUrl, "/api/state", {
    headers: { "X-Telegram-Init-Data": signedInitData(legacyUserId, new Date()) }
  });
  assert.equal(state.body.transactions.length, 1);
  assert.equal(state.body.goals.length, 1);
  assert.equal(state.body.settings.budgets["Хавка"], 500);
});
