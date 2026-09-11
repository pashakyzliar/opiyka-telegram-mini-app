"use strict";

/**
 * Ліміти AI та облік токенів у PostgreSQL.
 *
 * Раніше це був `Map` у пам'яті процесу: ліміт обнулявся при кожному рестарті
 * й деплої. Тепер лічильник живе поруч із рештою даних користувача, під тими
 * самими RLS-політиками.
 *
 * Слот резервується ДО звернення до провайдера, і невдалий запит теж
 * списується: інакше поламаний провайдер за секунди з'їсть квоту на ретраях.
 */

const { withUserContext } = require("./db");
const ai = require("./ai");

const TOO_OFTEN = {
  ok: false,
  code: "rate_limited",
  message: "Занадто часто. Зачекай кілька секунд."
};
const DAILY_EXHAUSTED = {
  ok: false,
  code: "rate_limited",
  message: "Ліміт AI-запитів на сьогодні вичерпано."
};

// Один запит робить усю роботу: вставляє рядок на сьогодні або інкрементує
// наявний, але ЛИШЕ якщо не перевищено добовий ліміт і минула пауза між
// запитами. Порожній результат означає, що якась із умов не виконалась.
async function reserveSlot(client, userId, limit, minGapMs) {
  const reserved = await client.query(
    `INSERT INTO ai_usage (user_id, day, request_count, last_request_at)
     VALUES ($1, (now() AT TIME ZONE 'utc')::date, 1, now())
     ON CONFLICT (user_id, day) DO UPDATE
        SET request_count = ai_usage.request_count + 1,
            last_request_at = now()
      WHERE ai_usage.request_count < $2::integer
        AND ai_usage.last_request_at <= now() - make_interval(secs => $3::double precision)
     RETURNING request_count`,
    [userId, limit, Math.max(0, Number(minGapMs) || 0) / 1000]
  );

  if (reserved.rows.length) {
    return { ok: true, used: reserved.rows[0].request_count, limit };
  }

  // Причину розрізняємо окремим читанням: користувачеві треба знати, чекати
  // кілька секунд чи вже до завтра.
  const current = await client.query(
    `SELECT request_count FROM ai_usage
      WHERE user_id = $1 AND day = (now() AT TIME ZONE 'utc')::date`,
    [userId]
  );
  const used = current.rows.length ? current.rows[0].request_count : 0;
  return used >= limit ? Object.assign({ used, limit }, DAILY_EXHAUSTED) : Object.assign({ used, limit }, TOO_OFTEN);
}

async function readQuota(client, userId, limit) {
  const result = await client.query(
    `SELECT request_count, tokens_in, tokens_out FROM ai_usage
      WHERE user_id = $1 AND day = (now() AT TIME ZONE 'utc')::date`,
    [userId]
  );
  const row = result.rows[0] || {};
  return {
    used: Number(row.request_count) || 0,
    limit,
    tokensIn: Number(row.tokens_in) || 0,
    tokensOut: Number(row.tokens_out) || 0
  };
}

// Токени приходять уже після відповіді провайдера, тож це окремий UPDATE.
// Рядок на сьогодні на цей момент завжди існує — його створив reserveSlot.
async function addTokens(client, userId, usage) {
  const promptTokens = Number(usage && (usage.prompt_tokens || usage.input_tokens)) || 0;
  const completionTokens = Number(usage && (usage.completion_tokens || usage.output_tokens)) || 0;
  if (!promptTokens && !completionTokens) return;
  await client.query(
    `UPDATE ai_usage
        SET tokens_in = tokens_in + $2::bigint,
            tokens_out = tokens_out + $3::bigint
      WHERE user_id = $1 AND day = (now() AT TIME ZONE 'utc')::date`,
    [userId, promptTokens, completionTokens]
  );
}

async function reserve(telegramKey) {
  return withUserContext(telegramKey, true, (client, userId) =>
    reserveSlot(client, userId, ai.LIMITS.daily, ai.LIMITS.minGapMs));
}

async function quota(telegramKey) {
  return withUserContext(telegramKey, false, (client, userId) =>
    readQuota(client, userId, ai.LIMITS.daily));
}

// Облік вартості не має ламати відповідь користувачу: якщо запис токенів не
// вдався, це лише дірка в статистиці, а не помилка запиту.
async function record(telegramKey, usage) {
  if (!usage) return;
  try {
    await withUserContext(telegramKey, true, (client, userId) => addTokens(client, userId, usage));
  } catch (error) {
    console.error("AI usage не записано:", error && error.message);
  }
}

module.exports = {
  reserve,
  quota,
  record,
  reserveSlot,
  readQuota,
  addTokens
};
