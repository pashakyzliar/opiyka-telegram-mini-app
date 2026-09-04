"use strict";

const fs = require("node:fs/promises");
const path = require("node:path");

const config = require("./config");
const { pseudonymizeTelegramId } = require("./auth/telegram");
const { withUserContext, closePool } = require("./db");
const accountService = require("./services/account-service");
const { normalizeAccount, COLLECTIONS } = require("./lib/state");
const { appError } = require("./lib/errors");

function parseArgs(argv) {
  const out = { dryRun: false, source: config.jsonImportSource };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--source") out.source = path.resolve(argv[index + 1] || "");
    else if (arg && arg.startsWith("--source=")) out.source = path.resolve(arg.slice("--source=".length));
  }
  return out;
}

async function readSource(file) {
  const raw = await fs.readFile(file, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_error) {
    throw appError(400, "invalid_json", "Source file is not valid JSON");
  }
  if (!parsed || typeof parsed !== "object" || !parsed.users || typeof parsed.users !== "object") {
    throw appError(400, "invalid_shape", "Source file must contain a users object");
  }
  return parsed;
}

async function backupSource(file) {
  const backupFile = file + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-");
  await fs.copyFile(file, backupFile);
  return backupFile;
}

function countAccount(account) {
  return COLLECTIONS.reduce((acc, key) => {
    acc[key] = Array.isArray(account[key]) ? account[key].length : 0;
    return acc;
  }, { users: 1 });
}

function mergeCounts(target, source) {
  Object.keys(source).forEach((key) => {
    target[key] = (target[key] || 0) + (source[key] || 0);
  });
  return target;
}

async function importUser(legacyUserId, account, dryRun, index) {
  const normalized = normalizeAccount(account);
  const counts = countAccount(normalized);
  if (dryRun) {
    return {
      user: index,
      counts
    };
  }
  const telegramKey = pseudonymizeTelegramId(legacyUserId);
  await withUserContext(telegramKey, true, async (client, userId) => {
    await accountService.replaceAll(client, userId, normalized, "json-import");
    const check = await accountService.getState(client, userId);
    const importedCounts = countAccount(check);
    for (const key of Object.keys(counts)) {
      if ((importedCounts[key] || 0) !== (counts[key] || 0)) {
        throw appError(500, "import_mismatch", "Imported record counts do not match");
      }
    }
  });
  return {
    user: index,
    counts
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const payload = await readSource(options.source);
  const entries = Object.entries(payload.users);
  if (!entries.length) {
    console.log(JSON.stringify({ dryRun: options.dryRun, users: 0, totals: { users: 0 } }, null, 2));
    return;
  }
  let backupFile = null;
  if (!options.dryRun) backupFile = await backupSource(options.source);
  const totals = { users: 0, transactions: 0, goals: 0, recurring: 0, debts: 0, amortize: 0 };
  const perUser = [];
  for (let index = 0; index < entries.length; index += 1) {
    const [legacyUserId, account] = entries[index];
    const report = await importUser(legacyUserId, account, options.dryRun, index + 1);
    totals.users += 1;
    mergeCounts(totals, report.counts);
    perUser.push(report);
  }
  console.log(JSON.stringify({
    dryRun: options.dryRun,
    source: options.source,
    backupFile,
    users: entries.length,
    totals,
    perUser
  }, null, 2));
}

main().catch((error) => {
  console.error(error.code || "import_failed", error.message);
  process.exitCode = 1;
}).finally(async () => {
  await closePool();
});
