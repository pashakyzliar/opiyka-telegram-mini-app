"use strict";

const { Pool, types } = require("pg");
const config = require("../config");
const { appError } = require("../lib/errors");

// DATE (OID 1082) pg за замовчуванням розбирає як північ у часовому поясі
// процесу. Репозиторій далі робить toISOString().slice(0, 10), тож на
// сервері не в UTC (локально в Києві) кожна дата з'їжджала на день назад.
// Північ UTC дає рівно ту дату, що лежить у БД, незалежно від TZ процесу.
types.setTypeParser(1082, (value) => (value === null ? null : new Date(value + "T00:00:00Z")));

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      ssl: config.databaseSsl || false
    });
    pool.on("error", (error) => {
      console.error("PostgreSQL pool error:", error.message);
    });
  }
  return pool;
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_rollbackError) {}
    throw error;
  } finally {
    client.release();
  }
}

async function ensureUserId(client, telegramKey) {
  const result = await client.query("SELECT public.ensure_user_by_telegram_key($1) AS user_id", [telegramKey]);
  return result.rows[0].user_id;
}

async function withUserContext(telegramKey, writable, fn) {
  return withTransaction(async (client) => {
    const userId = await ensureUserId(client, telegramKey);
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    if (writable) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    }
    return fn(client, userId);
  });
}

async function withUserIdContext(userId, writable, fn) {
  return withTransaction(async (client) => {
    await client.query("SELECT set_config('app.current_user_id', $1, true)", [userId]);
    if (writable) await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [userId]);
    return fn(client, userId);
  });
}

function mapDbError(error) {
  if (error && error.code === "23505") return appError(409, "conflict", "Record already exists");
  if (error && error.code === "42501") return appError(403, "forbidden", "Access denied");
  if (error && error.code === "22P02") return appError(400, "invalid_input", "Invalid data");
  if (error && error.code === "23503") return appError(400, "invalid_reference", "Referenced record does not exist");
  if (error && error.code === "ECONNREFUSED") return appError(503, "db_unavailable", "Database unavailable");
  if (error && error.code === "ENOTFOUND") return appError(503, "db_unavailable", "Database unavailable");
  return error;
}

async function closePool() {
  if (!pool) return;
  await pool.end();
  pool = null;
}

module.exports = {
  getPool,
  withTransaction,
  withUserContext,
  withUserIdContext,
  mapDbError,
  closePool
};
