"use strict";

const {
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_WALLETS,
  defaultSettings,
  expenseCategoryKey,
  normalizeSettings,
  splitExtras,
  cloneJson
} = require("../lib/state");
const { amountToNumeric } = require("../lib/money");
const { appError } = require("../lib/errors");

function toNumber(value) {
  return value == null ? null : Number(value);
}

function firstDayOfMonth(month) {
  return month + "-01";
}

function lastBackupMillis(value) {
  return value ? new Date(value).getTime() : 0;
}

async function ensureScaffold(client, userId) {
  await client.query(
    `INSERT INTO user_settings (user_id)
     VALUES ($1)
     ON CONFLICT (user_id) DO NOTHING`,
    [userId]
  );
  await client.query(
    `INSERT INTO wallets (user_id, name, name_key, currency_code, sort_order, is_default)
     VALUES ($1, $2, $3, 'UAH', 0, true)
     ON CONFLICT (user_id, name_key)
     DO UPDATE SET is_default = EXCLUDED.is_default`,
    [userId, DEFAULT_WALLETS[0], expenseCategoryKey(DEFAULT_WALLETS[0])]
  );
  for (let index = 0; index < DEFAULT_EXPENSE_CATEGORIES.length; index += 1) {
    const row = DEFAULT_EXPENSE_CATEGORIES[index];
    await upsertCategory(client, userId, "expense", row.name, row.color, index, row.icon);
  }
  for (let index = 0; index < DEFAULT_INCOME_CATEGORIES.length; index += 1) {
    await upsertCategory(client, userId, "income", DEFAULT_INCOME_CATEGORIES[index], null, index);
  }
}

async function upsertWallet(client, userId, name, sortOrder, isDefault) {
  const result = await client.query(
    `INSERT INTO wallets (user_id, name, name_key, currency_code, sort_order, is_default)
     VALUES ($1, $2, $3, 'UAH', $4, $5)
     ON CONFLICT (user_id, name_key)
     DO UPDATE SET
       name = EXCLUDED.name,
       sort_order = EXCLUDED.sort_order,
       is_default = wallets.is_default OR EXCLUDED.is_default
     RETURNING id`,
    [userId, name, expenseCategoryKey(name), sortOrder || 0, !!isDefault]
  );
  return result.rows[0].id;
}

async function upsertCategory(client, userId, kind, name, color, sortOrder, icon) {
  const result = await client.query(
    `INSERT INTO categories (user_id, kind, name, name_key, color, sort_order, icon)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, kind, name_key)
     DO UPDATE SET
       name = EXCLUDED.name,
       color = COALESCE(EXCLUDED.color, categories.color),
       icon = EXCLUDED.icon,
       sort_order = EXCLUDED.sort_order
     RETURNING id`,
    [userId, kind, name, expenseCategoryKey(name), color, sortOrder || 0, icon || ""]
  );
  return result.rows[0].id;
}

async function getWalletId(client, userId, name) {
  return upsertWallet(client, userId, name || DEFAULT_WALLETS[0], 0, name === DEFAULT_WALLETS[0]);
}

async function getCategoryId(client, userId, kind, name, sortOrder) {
  if (!name) return null;
  const fallback = kind === "expense"
    ? DEFAULT_EXPENSE_CATEGORIES.find((row) => expenseCategoryKey(row.name) === expenseCategoryKey(name))
      || DEFAULT_EXPENSE_CATEGORIES[sortOrder % DEFAULT_EXPENSE_CATEGORIES.length]
      || DEFAULT_EXPENSE_CATEGORIES[0]
    : null;
  const color = fallback ? fallback.color : null;
  const icon = fallback ? fallback.icon || "" : "";
  return upsertCategory(client, userId, kind, name, color, sortOrder || 0, icon);
}

async function serializeSettings(client, userId) {
  await ensureScaffold(client, userId);
  const settingsRow = await client.query("SELECT * FROM user_settings WHERE user_id = $1", [userId]);
  const expenseCategories = await client.query(
    `SELECT id, name, color, icon, sort_order
     FROM categories
     WHERE user_id = $1 AND kind = 'expense' AND archived_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  const budgets = await client.query(
    `SELECT c.name, b.amount
     FROM category_budgets b
     JOIN categories c ON c.id = b.category_id
     WHERE b.user_id = $1
     ORDER BY c.sort_order ASC, c.created_at ASC`,
    [userId]
  );
  const salaryDays = await client.query(
    `SELECT position, day_of_month
     FROM salary_schedule_days
     WHERE user_id = $1
     ORDER BY position ASC`,
    [userId]
  );
  const salaryPayments = await client.query(
    `SELECT payment_date, expected_amount, actual_amount
     FROM salary_payments
     WHERE user_id = $1
     ORDER BY payment_date ASC`,
    [userId]
  );
  const weekDaily = await client.query(
    `SELECT weekday, amount
     FROM weekly_day_plans
     WHERE user_id = $1
     ORDER BY weekday ASC`,
    [userId]
  );
  const recSkips = await client.query(
    `SELECT rec_key
     FROM recurring_skips
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  const navarRows = await client.query(
    `SELECT record_id, month_start, amount, created_at, extra_data
     FROM navar_history
     WHERE user_id = $1
     ORDER BY month_start ASC`,
    [userId]
  );

  const row = settingsRow.rows[0] || {};
  const base = defaultSettings();
  const settings = Object.assign({}, base, cloneJson(row.extra_settings || {}), {
    expenseCategories: expenseCategories.rows.map((item) => ({ name: item.name, color: item.color, icon: item.icon || "" })),
    budgets: {},
    salaryAmount: toNumber(row.salary_amount) || 0,
    salaryDays: salaryDays.rows.length ? salaryDays.rows.map((item) => item.day_of_month) : base.salaryDays.slice(),
    salaryPlanEnabled: !!row.salary_plan_enabled,
    salaryPayments: salaryPayments.rows.map((item) => ({
      date: item.payment_date.toISOString().slice(0, 10),
      expected: toNumber(item.expected_amount) || 0,
      actual: toNumber(item.actual_amount) || 0
    })),
    allowanceEnabled: !!row.allowance_enabled,
    weekBudget: toNumber(row.week_budget) || 0,
    weekReserve: toNumber(row.week_reserve) || 0,
    weekDaily: base.weekDaily.slice(),
    navarHistory: navarRows.rows.map((item) => Object.assign({}, cloneJson(item.extra_data || {}), {
      id: item.record_id,
      month: item.month_start.toISOString().slice(0, 7),
      amount: toNumber(item.amount) || 0,
      createdAt: new Date(item.created_at).toISOString()
    })),
    calmMode: !!row.calm_mode,
    lockEnabled: !!row.login_lock_enabled,
    pin: row.pin_hash || "",
    lastBackup: lastBackupMillis(row.last_backup_at),
    streakRecord: row.streak_record || 0,
    recSkip: recSkips.rows.map((item) => item.rec_key)
  });
  budgets.rows.forEach((item) => {
    settings.budgets[item.name] = toNumber(item.amount) || 0;
  });
  weekDaily.rows.forEach((item) => {
    settings.weekDaily[item.weekday] = toNumber(item.amount) || 0;
  });
  return normalizeSettings(settings, {}).value;
}

async function serializeTransactions(client, userId) {
  const result = await client.query(
    `SELECT t.record_id, t.type, t.amount, t.tx_date, t.note, t.reserve, t.rec_key, t.recurring_payment_record_id,
            t.created_at, t.updated_at, t.extra_data, cw.name AS wallet_name, tw.name AS to_wallet_name, c.name AS category_name
     FROM transactions t
     LEFT JOIN wallets cw ON cw.id = t.wallet_id
     LEFT JOIN wallets tw ON tw.id = t.to_wallet_id
     LEFT JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
     ORDER BY t.created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => Object.assign({}, cloneJson(row.extra_data || {}), {
    id: row.record_id,
    type: row.type,
    category: row.category_name == null ? null : row.category_name,
    amount: toNumber(row.amount) || 0,
    wallet: row.wallet_name || DEFAULT_WALLETS[0],
    toWallet: row.to_wallet_name || "",
    date: row.tx_date.toISOString().slice(0, 10),
    note: row.note || "",
    reserve: !!row.reserve,
    recKey: row.rec_key || "",
    recId: row.recurring_payment_record_id || "",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

async function serializeGoals(client, userId) {
  const result = await client.query(
    `SELECT *
     FROM goals
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => Object.assign({}, cloneJson(row.extra_data || {}), {
    id: row.record_id,
    name: row.name,
    target: toNumber(row.target_amount) || 0,
    current: toNumber(row.current_amount) || 0,
    deadline: row.deadline ? row.deadline.toISOString().slice(0, 10) : "",
    closedAt: row.closed_at ? row.closed_at.toISOString().slice(0, 10) : "",
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

async function serializeRecurring(client, userId) {
  const result = await client.query(
    `SELECT r.*, c.name AS category_name, w.name AS wallet_name
     FROM recurring_payments r
     JOIN categories c ON c.id = r.category_id
     JOIN wallets w ON w.id = r.wallet_id
     WHERE r.user_id = $1
     ORDER BY r.created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => Object.assign({}, cloneJson(row.extra_data || {}), {
    id: row.record_id,
    name: row.name,
    amount: toNumber(row.amount) || 0,
    category: row.category_name,
    wallet: row.wallet_name,
    day: row.day_of_month,
    active: !!row.active,
    startFrom: row.start_from.toISOString().slice(0, 10),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

async function serializeDebts(client, userId) {
  const result = await client.query(
    `SELECT *
     FROM debts
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => Object.assign({}, cloneJson(row.extra_data || {}), {
    id: row.record_id,
    direction: row.direction,
    person: row.person,
    amount: toNumber(row.amount) || 0,
    due: row.due_date ? row.due_date.toISOString().slice(0, 10) : "",
    settled: !!row.settled,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

async function serializeAmortizations(client, userId) {
  const result = await client.query(
    `SELECT *
     FROM amortizations
     WHERE user_id = $1
     ORDER BY created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => Object.assign({}, cloneJson(row.extra_data || {}), {
    id: row.record_id,
    name: row.name,
    amount: toNumber(row.amount) || 0,
    months: row.months,
    startDate: row.start_date.toISOString().slice(0, 10),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString()
  }));
}

async function getAccountState(client, userId) {
  const settings = await serializeSettings(client, userId);
  return {
    transactions: await serializeTransactions(client, userId),
    goals: await serializeGoals(client, userId),
    recurring: await serializeRecurring(client, userId),
    debts: await serializeDebts(client, userId),
    amortize: await serializeAmortizations(client, userId),
    settings
  };
}

async function getProfile(client, userId) {
  const result = await client.query(
    `SELECT MIN(tx_date) AS since
     FROM transactions
     WHERE user_id = $1`,
    [userId]
  );
  const since = result.rows[0] && result.rows[0].since;
  return { since: since ? since.toISOString().slice(0, 10) : null };
}

async function glossaryMap(client, userId) {
  const result = await client.query(
    `SELECT g.word, c.name
     FROM user_glossary g
     JOIN categories c ON c.id = g.category_id AND c.user_id = g.user_id
     WHERE g.user_id = $1 AND c.archived_at IS NULL`,
    [userId]
  );
  return result.rows.reduce((out, row) => { out[row.word] = row.name; return out; }, {});
}

async function incrementGlossaryHit(client, userId, word) {
  await client.query("UPDATE user_glossary SET hits = hits + 1 WHERE user_id = $1 AND word = $2", [userId, word]);
}

async function listGlossary(client, userId) {
  const result = await client.query(
    `SELECT g.id, g.word_raw, g.source, g.hits, g.created_at, c.id AS category_id, c.name AS category_name, c.icon AS category_icon
     FROM user_glossary g
     JOIN categories c ON c.id = g.category_id AND c.user_id = g.user_id
     WHERE g.user_id = $1
     ORDER BY g.hits DESC, g.created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: String(row.id), word: row.word_raw, source: row.source, hits: Number(row.hits) || 0,
    createdAt: new Date(row.created_at).toISOString(),
    categoryId: row.category_id, category: { id: row.category_id, name: row.category_name, icon: row.category_icon || "" }
  }));
}

async function glossaryCategories(client, userId) {
  const result = await client.query(
    `SELECT id, name, icon FROM categories
     WHERE user_id = $1 AND kind = 'expense' AND archived_at IS NULL
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  return result.rows.map((row) => ({ id: row.id, name: row.name, icon: row.icon || "" }));
}

async function upsertGlossary(client, userId, word, wordRaw, categoryId, source) {
  const result = await client.query(
    `INSERT INTO user_glossary (user_id, word, word_raw, category_id, source)
     SELECT $1, $2, $3, c.id, $5
     FROM categories c
     WHERE c.user_id = $1 AND c.id = $4 AND c.kind = 'expense' AND c.archived_at IS NULL
     ON CONFLICT (user_id, word) DO UPDATE SET
       word_raw = EXCLUDED.word_raw, category_id = EXCLUDED.category_id, source = EXCLUDED.source
     RETURNING id`,
    [userId, word, wordRaw, categoryId, source]
  );
  if (!result.rows.length) throw appError(404, "not_found", "Category not found");
  return String(result.rows[0].id);
}

async function upsertGlossaryByCategoryName(client, userId, word, wordRaw, categoryName) {
  const category = await client.query(
    `SELECT id FROM categories WHERE user_id = $1 AND kind = 'expense' AND name = $2 AND archived_at IS NULL LIMIT 1`,
    [userId, categoryName]
  );
  if (!category.rows.length) return null;
  return upsertGlossary(client, userId, word, wordRaw, category.rows[0].id, "learned");
}

async function updateGlossaryCategory(client, userId, id, categoryId) {
  const result = await client.query(
    `UPDATE user_glossary g SET category_id = c.id
     FROM categories c
     WHERE g.id = $2 AND g.user_id = $1
       AND c.id = $3 AND c.user_id = $1 AND c.kind = 'expense' AND c.archived_at IS NULL
     RETURNING g.id`,
    [userId, id, categoryId]
  );
  return result.rows.length > 0;
}

async function deleteGlossary(client, userId, id) {
  const result = await client.query("DELETE FROM user_glossary WHERE user_id = $1 AND id = $2 RETURNING id", [userId, id]);
  return result.rows.length > 0;
}

async function insertTransaction(client, userId, row, extraData) {
  const categoryId = await getCategoryId(client, userId, row.type === "income" ? "income" : "expense", row.category, 0);
  const walletId = await getWalletId(client, userId, row.wallet);
  const toWalletId = row.toWallet ? await getWalletId(client, userId, row.toWallet) : null;
  await client.query(
    `INSERT INTO transactions (
       user_id, record_id, type, category_id, wallet_id, to_wallet_id, amount, tx_date, note, reserve,
       rec_key, recurring_payment_record_id, created_at, updated_at, extra_data
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::numeric, $8, $9, $10, $11, $12, $13::timestamptz, $14::timestamptz, $15::jsonb)
     ON CONFLICT (user_id, record_id)
     DO UPDATE SET
       type = EXCLUDED.type,
       category_id = EXCLUDED.category_id,
       wallet_id = EXCLUDED.wallet_id,
       to_wallet_id = EXCLUDED.to_wallet_id,
       amount = EXCLUDED.amount,
       tx_date = EXCLUDED.tx_date,
       note = EXCLUDED.note,
       reserve = EXCLUDED.reserve,
       rec_key = EXCLUDED.rec_key,
       recurring_payment_record_id = EXCLUDED.recurring_payment_record_id,
       updated_at = EXCLUDED.updated_at,
       extra_data = EXCLUDED.extra_data`,
    [
      userId,
      row.id,
      row.type,
      categoryId,
      walletId,
      toWalletId,
      amountToNumeric(row.amount, "amount"),
      row.date,
      row.note,
      row.reserve,
      row.recKey || null,
      row.recId || null,
      row.createdAt,
      row.updatedAt,
      JSON.stringify(extraData || {})
    ]
  );
}

async function insertGoal(client, userId, row, extraData) {
  await client.query(
    `INSERT INTO goals (
       user_id, record_id, name, target_amount, current_amount, deadline, closed_at, created_at, updated_at, extra_data
     )
     VALUES ($1, $2, $3, $4::numeric, $5::numeric, NULLIF($6, '')::date, NULLIF($7, '')::date, $8::timestamptz, $9::timestamptz, $10::jsonb)
     ON CONFLICT (user_id, record_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       target_amount = EXCLUDED.target_amount,
       current_amount = EXCLUDED.current_amount,
       deadline = EXCLUDED.deadline,
       closed_at = EXCLUDED.closed_at,
       updated_at = EXCLUDED.updated_at,
       extra_data = EXCLUDED.extra_data`,
    [
      userId,
      row.id,
      row.name,
      amountToNumeric(row.target, "target"),
      amountToNumeric(row.current, "current"),
      row.deadline || "",
      row.closedAt || "",
      row.createdAt,
      row.updatedAt,
      JSON.stringify(extraData || {})
    ]
  );
}

async function insertRecurring(client, userId, row, extraData) {
  const categoryId = await getCategoryId(client, userId, "expense", row.category, 0);
  const walletId = await getWalletId(client, userId, row.wallet);
  await client.query(
    `INSERT INTO recurring_payments (
       user_id, record_id, name, amount, category_id, wallet_id, day_of_month, active, start_from, created_at, updated_at, extra_data
     )
     VALUES ($1, $2, $3, $4::numeric, $5, $6, $7, $8, $9::date, $10::timestamptz, $11::timestamptz, $12::jsonb)
     ON CONFLICT (user_id, record_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       amount = EXCLUDED.amount,
       category_id = EXCLUDED.category_id,
       wallet_id = EXCLUDED.wallet_id,
       day_of_month = EXCLUDED.day_of_month,
       active = EXCLUDED.active,
       start_from = EXCLUDED.start_from,
       updated_at = EXCLUDED.updated_at,
       extra_data = EXCLUDED.extra_data`,
    [
      userId,
      row.id,
      row.name,
      amountToNumeric(row.amount, "amount"),
      categoryId,
      walletId,
      row.day,
      row.active,
      row.startFrom,
      row.createdAt,
      row.updatedAt,
      JSON.stringify(extraData || {})
    ]
  );
}

async function insertDebt(client, userId, row, extraData) {
  await client.query(
    `INSERT INTO debts (
       user_id, record_id, direction, person, amount, due_date, settled, created_at, updated_at, extra_data
     )
     VALUES ($1, $2, $3, $4, $5::numeric, NULLIF($6, '')::date, $7, $8::timestamptz, $9::timestamptz, $10::jsonb)
     ON CONFLICT (user_id, record_id)
     DO UPDATE SET
       direction = EXCLUDED.direction,
       person = EXCLUDED.person,
       amount = EXCLUDED.amount,
       due_date = EXCLUDED.due_date,
       settled = EXCLUDED.settled,
       updated_at = EXCLUDED.updated_at,
       extra_data = EXCLUDED.extra_data`,
    [
      userId,
      row.id,
      row.direction,
      row.person,
      amountToNumeric(row.amount, "amount"),
      row.due || "",
      row.settled,
      row.createdAt,
      row.updatedAt,
      JSON.stringify(extraData || {})
    ]
  );
}

async function insertAmortization(client, userId, row, extraData) {
  await client.query(
    `INSERT INTO amortizations (
       user_id, record_id, name, amount, months, start_date, created_at, updated_at, extra_data
     )
     VALUES ($1, $2, $3, $4::numeric, $5, $6::date, $7::timestamptz, $8::timestamptz, $9::jsonb)
     ON CONFLICT (user_id, record_id)
     DO UPDATE SET
       name = EXCLUDED.name,
       amount = EXCLUDED.amount,
       months = EXCLUDED.months,
       start_date = EXCLUDED.start_date,
       updated_at = EXCLUDED.updated_at,
       extra_data = EXCLUDED.extra_data`,
    [
      userId,
      row.id,
      row.name,
      amountToNumeric(row.amount, "amount"),
      row.months,
      row.startDate,
      row.createdAt,
      row.updatedAt,
      JSON.stringify(extraData || {})
    ]
  );
}

async function replaceSettings(client, userId, settings, extraSettings) {
  await ensureScaffold(client, userId);
  const categoryNames = settings.expenseCategories.map((row) => expenseCategoryKey(row.name));
  const referenced = await client.query(
    `SELECT c.name
     FROM categories c
     WHERE c.user_id = $1
       AND c.kind = 'expense'
       AND NOT (c.name_key = ANY($2::text[]))
       AND (
         EXISTS (SELECT 1 FROM transactions t WHERE t.user_id = $1 AND t.category_id = c.id)
         OR EXISTS (SELECT 1 FROM recurring_payments r WHERE r.user_id = $1 AND r.category_id = c.id)
         OR EXISTS (SELECT 1 FROM category_budgets b WHERE b.user_id = $1 AND b.category_id = c.id)
       )`,
    [userId, categoryNames]
  );
  if (referenced.rows.length) {
    throw appError(409, "category_in_use", "Cannot remove a category that is still in use");
  }
  await client.query(
    `DELETE FROM categories
     WHERE user_id = $1
       AND kind = 'expense'
       AND NOT (name_key = ANY($2::text[]))`,
    [userId, categoryNames]
  );
  for (let index = 0; index < settings.expenseCategories.length; index += 1) {
    const row = settings.expenseCategories[index];
    await upsertCategory(client, userId, "expense", row.name, row.color, index, row.icon);
  }
  await client.query(
    `UPDATE user_settings
     SET
       salary_amount = $2::numeric,
       salary_plan_enabled = $3,
       allowance_enabled = $4,
       week_budget = $5::numeric,
       week_reserve = $6::numeric,
       calm_mode = $7,
       pin_hash = $8,
       login_lock_enabled = $9,
       last_backup_at = CASE WHEN $10::bigint > 0 THEN to_timestamp($10::double precision / 1000.0) ELSE NULL END,
       streak_record = $11,
       extra_settings = $12::jsonb
     WHERE user_id = $1`,
    [
      userId,
      amountToNumeric(settings.salaryAmount, "salaryAmount"),
      settings.salaryPlanEnabled,
      settings.allowanceEnabled,
      amountToNumeric(settings.weekBudget, "weekBudget"),
      amountToNumeric(settings.weekReserve, "weekReserve"),
      settings.calmMode,
      settings.pin,
      settings.lockEnabled && !!settings.pin,
      settings.lastBackup,
      settings.streakRecord,
      JSON.stringify(extraSettings || {})
    ]
  );
  await client.query("DELETE FROM weekly_day_plans WHERE user_id = $1", [userId]);
  for (let weekday = 0; weekday < settings.weekDaily.length; weekday += 1) {
    await client.query(
      `INSERT INTO weekly_day_plans (user_id, weekday, amount)
       VALUES ($1, $2, $3::numeric)`,
      [userId, weekday, amountToNumeric(settings.weekDaily[weekday], "weekDaily[" + weekday + "]")]
    );
  }
  await client.query("DELETE FROM salary_schedule_days WHERE user_id = $1", [userId]);
  for (let index = 0; index < settings.salaryDays.length; index += 1) {
    await client.query(
      `INSERT INTO salary_schedule_days (user_id, position, day_of_month)
       VALUES ($1, $2, $3)`,
      [userId, index, settings.salaryDays[index]]
    );
  }
  await client.query("DELETE FROM salary_payments WHERE user_id = $1", [userId]);
  for (const row of settings.salaryPayments) {
    await client.query(
      `INSERT INTO salary_payments (user_id, payment_date, expected_amount, actual_amount)
       VALUES ($1, $2::date, $3::numeric, $4::numeric)`,
      [
        userId,
        row.date,
        amountToNumeric(row.expected, "salaryPayment.expected"),
        amountToNumeric(row.actual, "salaryPayment.actual")
      ]
    );
  }
  await client.query("DELETE FROM category_budgets WHERE user_id = $1", [userId]);
  for (const [name, amount] of Object.entries(settings.budgets || {})) {
    const categoryId = await getCategoryId(client, userId, "expense", name, 0);
    await client.query(
      `INSERT INTO category_budgets (user_id, category_id, amount)
       VALUES ($1, $2, $3::numeric)`,
      [userId, categoryId, amountToNumeric(amount, "budget")]
    );
  }
  await client.query("DELETE FROM recurring_skips WHERE user_id = $1", [userId]);
  for (const recKey of settings.recSkip) {
    await client.query(
      `INSERT INTO recurring_skips (user_id, rec_key)
       VALUES ($1, $2)`,
      [userId, recKey]
    );
  }
  await client.query("DELETE FROM navar_history WHERE user_id = $1", [userId]);
  for (const row of settings.navarHistory) {
    const extra = splitExtras(row, new Set(["id", "month", "amount", "createdAt"]));
    await client.query(
      `INSERT INTO navar_history (user_id, record_id, month_start, amount, created_at, extra_data)
       VALUES ($1, $2, $3::date, $4::numeric, $5::timestamptz, $6::jsonb)`,
      [
        userId,
        row.id,
        firstDayOfMonth(row.month),
        amountToNumeric(row.amount, "navar.amount"),
        row.createdAt,
        JSON.stringify(extra || {})
      ]
    );
  }
}

async function replaceAll(client, userId, account) {
  await ensureScaffold(client, userId);
  const settingsBundle = normalizeSettings(account.settings, account);
  const settings = settingsBundle.value;
  const settingsExtra = settingsBundle.extra;
  const walletNames = new Set([DEFAULT_WALLETS[0]]);
  account.transactions.forEach((row) => {
    walletNames.add(row.wallet || DEFAULT_WALLETS[0]);
    if (row.toWallet) walletNames.add(row.toWallet);
  });
  account.recurring.forEach((row) => walletNames.add(row.wallet || DEFAULT_WALLETS[0]));
  let walletOrder = 0;
  for (const name of walletNames) {
    await upsertWallet(client, userId, name, walletOrder, name === DEFAULT_WALLETS[0]);
    walletOrder += 1;
  }
  await replaceSettings(client, userId, settings, settingsExtra);
  await client.query("DELETE FROM transactions WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM goals WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM debts WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM amortizations WHERE user_id = $1", [userId]);
  await client.query("DELETE FROM recurring_payments WHERE user_id = $1", [userId]);
  for (const row of account.recurring) {
    const extra = splitExtras(row, new Set(["id", "name", "amount", "category", "wallet", "day", "active", "startFrom", "createdAt", "updatedAt"]));
    await insertRecurring(client, userId, row, extra);
  }
  for (const row of account.transactions) {
    const extra = splitExtras(row, new Set(["id", "type", "category", "amount", "wallet", "toWallet", "date", "note", "reserve", "recKey", "recId", "createdAt", "updatedAt"]));
    await insertTransaction(client, userId, row, extra);
  }
  for (const row of account.goals) {
    const extra = splitExtras(row, new Set(["id", "name", "target", "current", "deadline", "closedAt", "createdAt", "updatedAt"]));
    await insertGoal(client, userId, row, extra);
  }
  for (const row of account.debts) {
    const extra = splitExtras(row, new Set(["id", "direction", "person", "amount", "due", "settled", "createdAt", "updatedAt"]));
    await insertDebt(client, userId, row, extra);
  }
  for (const row of account.amortize) {
    const extra = splitExtras(row, new Set(["id", "name", "amount", "months", "startDate", "createdAt", "updatedAt"]));
    await insertAmortization(client, userId, row, extra);
  }
}

async function getCollectionRow(client, userId, collection, id) {
  const state = await getAccountState(client, userId);
  return (state[collection] || []).find((row) => row.id === id) || null;
}

async function deleteCollectionRow(client, userId, collection, id) {
  const table = {
    transactions: "transactions",
    goals: "goals",
    recurring: "recurring_payments",
    debts: "debts",
    amortize: "amortizations"
  }[collection];
  if (!table) throw appError(400, "invalid_collection", "Unknown collection");
  await client.query(`DELETE FROM ${table} WHERE user_id = $1 AND record_id = $2`, [userId, id]);
}

async function upsertCollectionRow(client, userId, collection, row, extraData) {
  switch (collection) {
    case "transactions":
      return insertTransaction(client, userId, row, extraData);
    case "goals":
      return insertGoal(client, userId, row, extraData);
    case "recurring":
      return insertRecurring(client, userId, row, extraData);
    case "debts":
      return insertDebt(client, userId, row, extraData);
    case "amortize":
      return insertAmortization(client, userId, row, extraData);
    default:
      throw appError(400, "invalid_collection", "Unknown collection");
  }
}

async function deleteAccount(client, userId) {
  await client.query("DELETE FROM users WHERE id = $1", [userId]);
}

async function writeAuditEvent(client, userId, eventType, requestId, details) {
  await client.query(
    `INSERT INTO security_audit_events (user_id, event_type, request_id, details)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [userId || null, eventType, requestId || null, JSON.stringify(details || {})]
  );
}

module.exports = {
  getProfile,
  glossaryMap,
  incrementGlossaryHit,
  listGlossary,
  glossaryCategories,
  upsertGlossary,
  upsertGlossaryByCategoryName,
  updateGlossaryCategory,
  deleteGlossary,
  ensureScaffold,
  getAccountState,
  getCollectionRow,
  upsertCollectionRow,
  deleteCollectionRow,
  replaceSettings,
  replaceAll,
  deleteAccount,
  writeAuditEvent
};
