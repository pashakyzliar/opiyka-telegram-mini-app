"use strict";

const { appError } = require("./errors");
const { money } = require("./money");
const { newId, normalizeId } = require("./ids");

const COLLECTIONS = ["transactions", "goals", "recurring", "debts", "amortize"];
const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Машина", color: "#5aa8ba", icon: "" },
  { name: "Пайка", color: "#c08a4a", icon: "" },
  { name: "Хавка", color: "#63b06e", icon: "" },
  { name: "Дурка", color: "#b07dad", icon: "" },
  { name: "Продукти", color: "#d29a5c", icon: "" },
  { name: "Сіги", color: "#97a851", icon: "" },
  { name: "Подпіски", color: "#7d8ecb", icon: "" }
];
const DEFAULT_INCOME_CATEGORIES = ["ЗП", "Аванс", "Підробіток", "Інше"];
const DEFAULT_WALLETS = ["Кеш"];

const SETTINGS_KEYS = new Set([
  "budgets",
  "expenseCategories",
  "glossary",
  "salaryAmount",
  "salaryDays",
  "salaryPlanEnabled",
  "salaryPayments",
  "allowanceEnabled",
  "weekBudget",
  "weekReserve",
  "weekDaily",
  "navarHistory",
  "calmMode",
  "lockEnabled",
  "pin",
  "lastBackup",
  "streakRecord",
  "bestRate",
  "recSkip"
]);

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function cloneJson(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function normalizeName(value, fieldName, maxLen) {
  const out = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!out) throw appError(400, "invalid_" + fieldName, fieldName + " is required");
  if (out.length > maxLen) throw appError(400, "invalid_" + fieldName, fieldName + " is too long");
  return out;
}

function normalizeOptionalName(value, fieldName, maxLen) {
  const out = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
  if (!out) return "";
  if (out.length > maxLen) throw appError(400, "invalid_" + fieldName, fieldName + " is too long");
  return out;
}

function normalizeColor(value, fallback) {
  const out = String(value || fallback || "").trim().toLowerCase();
  return /^#[0-9a-f]{6}$/.test(out) ? out : fallback;
}

function normalizeIcon(value) {
  const text = String(value || "");
  if (!text || typeof Intl === "undefined" || !Intl.Segmenter) return "";
  const clusters = Array.from(new Intl.Segmenter("uk", { granularity: "grapheme" }).segment(text), (item) => item.segment);
  return clusters.length === 1 && Buffer.byteLength(clusters[0], "utf8") <= 8 ? clusters[0] : "";
}

function normalizeDate(value, fieldName, required) {
  const out = String(value == null ? "" : value).trim();
  if (!out) {
    if (required) throw appError(400, "invalid_" + fieldName, fieldName + " is required");
    return "";
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(out) || Number.isNaN(Date.parse(out + "T00:00:00Z"))) {
    throw appError(400, "invalid_" + fieldName, fieldName + " must be YYYY-MM-DD");
  }
  return out;
}

function normalizeMonth(value, fieldName) {
  const out = String(value == null ? "" : value).trim();
  if (!/^\d{4}-\d{2}$/.test(out) || Number.isNaN(Date.parse(out + "-01T00:00:00Z"))) {
    throw appError(400, "invalid_" + fieldName, fieldName + " must be YYYY-MM");
  }
  return out;
}

function normalizeTimestamp(value, fieldName, fallbackNow) {
  const out = String(value || fallbackNow || new Date().toISOString()).trim();
  const time = Date.parse(out);
  if (Number.isNaN(time)) throw appError(400, "invalid_" + fieldName, fieldName + " must be an ISO timestamp");
  return new Date(time).toISOString();
}

function normalizeBoolean(value) {
  return !!value;
}

function normalizeInteger(value, fieldName, min, max, fallback) {
  if (value === "" || value === null || value === undefined) return fallback;
  const out = Number(value);
  if (!Number.isInteger(out) || out < min || out > max) {
    throw appError(400, "invalid_" + fieldName, fieldName + " is out of range");
  }
  return out;
}

function expenseCategoryKey(name) {
  return String(name || "").trim().toLocaleLowerCase("uk-UA");
}

function defaultExpenseRows() {
  return DEFAULT_EXPENSE_CATEGORIES.map((row) => ({ name: row.name, color: row.color, icon: row.icon || "" }));
}

function normalizeExpenseCategories(list) {
  const src = Array.isArray(list) && list.length ? list : DEFAULT_EXPENSE_CATEGORIES;
  const out = [];
  const seen = new Set();
  src.forEach((row, index) => {
    const fallback = DEFAULT_EXPENSE_CATEGORIES[index % DEFAULT_EXPENSE_CATEGORIES.length];
    const name = normalizeOptionalName(row && row.name !== undefined ? row.name : row, "expense_category_name", 28);
    if (!name) return;
    const key = expenseCategoryKey(name);
    if (seen.has(key)) return;
    seen.add(key);
    const matched = DEFAULT_EXPENSE_CATEGORIES.find((item) => expenseCategoryKey(item.name) === key);
    out.push({
      name,
      color: normalizeColor(row && row.color, fallback.color),
      icon: normalizeIcon(row && row.icon) || (matched ? matched.icon || "" : "")
    });
  });
  return out.length ? out : defaultExpenseRows();
}

function normalizeGlossary(input) {
  if (!isPlainObject(input)) return {};
  const out = {};
  Object.keys(input).slice(0, 500).forEach((key) => {
    const normalizedKey = normalizeOptionalName(key, "glossary_key", 40).toLocaleLowerCase("uk-UA");
    const normalizedValue = normalizeOptionalName(input[key], "glossary_value", 28);
    if (!normalizedKey || !normalizedValue) return;
    out[normalizedKey] = normalizedValue;
  });
  return out;
}

function normalizeNavarHistory(list) {
  return (Array.isArray(list) ? list : []).map((row) => ({
    id: normalizeId(row && row.id, "navar."),
    month: normalizeMonth(row && row.month, "month"),
    amount: money(row && row.amount !== undefined ? row.amount : 0, "amount"),
    createdAt: normalizeTimestamp(row && row.createdAt, "createdAt")
  }));
}

function normalizeWeekDaily(list) {
  const source = Array.isArray(list) ? list.slice(0, 7) : [];
  const out = [];
  for (let index = 0; index < 7; index += 1) {
    out.push(money(source[index] || 0, "weekDaily[" + index + "]"));
  }
  return out;
}

function defaultSettings() {
  return {
    budgets: {},
    expenseCategories: defaultExpenseRows(),
    glossary: {},
    salaryAmount: 0,
    salaryDays: [5, 20],
    salaryPlanEnabled: false,
    salaryPayments: [],
    allowanceEnabled: false,
    weekBudget: 0,
    weekReserve: 0,
    weekDaily: [0, 0, 0, 0, 0, 0, 0],
    navarHistory: [],
    calmMode: false,
    lockEnabled: false,
    pin: "",
    lastBackup: 0,
    streakRecord: 0,
    bestRate: null,
    recSkip: []
  };
}

function emptyAccount() {
  return {
    transactions: [],
    goals: [],
    recurring: [],
    debts: [],
    amortize: [],
    settings: defaultSettings()
  };
}

function splitExtras(source, knownKeys) {
  const extra = {};
  Object.keys(source || {}).forEach((key) => {
    if (!knownKeys.has(key)) extra[key] = cloneJson(source[key]);
  });
  return extra;
}

function ensureExpenseCategoriesForAccount(settings, collections) {
  const rows = normalizeExpenseCategories(settings.expenseCategories);
  const known = new Map(rows.map((row) => [expenseCategoryKey(row.name), row]));
  const addMissing = (name) => {
    const normalized = normalizeOptionalName(name, "category", 28);
    if (!normalized) return;
    const key = expenseCategoryKey(normalized);
    if (known.has(key)) return;
    const fallback = DEFAULT_EXPENSE_CATEGORIES[(known.size) % DEFAULT_EXPENSE_CATEGORIES.length];
    const row = { name: normalized, color: fallback.color, icon: fallback.icon || "" };
    known.set(key, row);
    rows.push(row);
  };
  Object.keys(settings.budgets || {}).forEach(addMissing);
  (collections.transactions || []).forEach((row) => {
    if (row.type === "expense" && !row.pending) addMissing(row.category);
  });
  (collections.recurring || []).forEach((row) => addMissing(row.category));
  return rows;
}

function normalizeSettings(input, collections) {
  const current = isPlainObject(input) ? Object.assign({}, input) : {};
  const defaults = defaultSettings();
  const out = Object.assign({}, defaults, current);
  out.glossary = normalizeGlossary(out.glossary);
  out.salaryAmount = money(out.salaryAmount || 0, "salaryAmount");
  out.salaryDays = Array.isArray(out.salaryDays) && out.salaryDays.length
    ? out.salaryDays.slice(0, 6).map((value) => normalizeInteger(value, "salaryDays", 1, 31, 5))
    : defaults.salaryDays.slice();
  out.salaryPlanEnabled = normalizeBoolean(out.salaryPlanEnabled);
  out.salaryPayments = (Array.isArray(out.salaryPayments) ? out.salaryPayments : []).map((row) => ({
    date: normalizeDate(row && row.date, "date", true),
    expected: money(row && row.expected !== undefined ? row.expected : 0, "expected"),
    actual: money(row && row.actual !== undefined ? row.actual : 0, "actual")
  }));
  out.allowanceEnabled = normalizeBoolean(out.allowanceEnabled);
  out.weekBudget = money(out.weekBudget || 0, "weekBudget");
  out.weekReserve = money(out.weekReserve || 0, "weekReserve");
  out.weekDaily = normalizeWeekDaily(out.weekDaily);
  out.navarHistory = normalizeNavarHistory(out.navarHistory);
  out.calmMode = normalizeBoolean(out.calmMode);
  out.lockEnabled = normalizeBoolean(out.lockEnabled);
  out.pin = normalizeOptionalName(out.pin, "pin", 255);
  out.lastBackup = Math.max(0, Number(out.lastBackup) || 0);
  out.streakRecord = Math.max(0, Number(out.streakRecord) || 0);
  out.recSkip = Array.isArray(out.recSkip)
    ? out.recSkip
        .map((value) => normalizeOptionalName(value, "recSkip", 120))
        .filter(Boolean)
        .slice(-240)
    : [];
  const rawBudgets = isPlainObject(out.budgets) ? out.budgets : {};
  const normalizedBudgets = {};
  Object.keys(rawBudgets).forEach((key) => {
    const nextKey = normalizeOptionalName(key, "budget_category", 28);
    if (!nextKey) return;
    normalizedBudgets[nextKey] = money(rawBudgets[key], "budget");
  });
  out.budgets = normalizedBudgets;
  out.expenseCategories = ensureExpenseCategoriesForAccount(out, collections || {});
  const extra = splitExtras(current, SETTINGS_KEYS);
  if (Object.prototype.hasOwnProperty.call(current, "bestRate")) extra.bestRate = cloneJson(current.bestRate);
  return { value: out, extra };
}

function knownRowKeys(collection) {
  switch (collection) {
    case "transactions":
      return new Set(["id", "type", "category", "amount", "wallet", "toWallet", "date", "note", "reserve", "recKey", "recId", "createdAt", "updatedAt"]);
    case "goals":
      return new Set(["id", "name", "target", "current", "deadline", "closedAt", "createdAt", "updatedAt"]);
    case "recurring":
      return new Set(["id", "name", "amount", "category", "wallet", "day", "active", "startFrom", "createdAt", "updatedAt"]);
    case "debts":
      return new Set(["id", "direction", "person", "amount", "due", "settled", "createdAt", "updatedAt"]);
    case "amortize":
      return new Set(["id", "name", "amount", "months", "startDate", "createdAt", "updatedAt"]);
    default:
      throw appError(400, "invalid_collection", "Unknown collection");
  }
}

function normalizeTransaction(row) {
  const out = Object.assign({}, row);
  out.id = normalizeId(out.id, "t");
  out.type = ["expense", "income", "transfer"].includes(out.type) ? out.type : (() => { throw appError(400, "invalid_type", "type is invalid"); })();
  out.pending = out.type === "expense" ? normalizeBoolean(out.pending) : false;
  out.srcWord = normalizeOptionalName(out.srcWord, "srcWord", 120);
  if (out.type === "transfer") out.category = normalizeOptionalName(out.category, "category", 28);
  else if (out.pending && out.type === "expense") out.category = normalizeOptionalName(out.category, "category", 28) || null;
  else out.category = normalizeName(out.category, "category", 28);
  out.amount = money(out.amount, "amount");
  out.wallet = normalizeName(out.wallet || DEFAULT_WALLETS[0], "wallet", 32);
  out.toWallet = normalizeOptionalName(out.toWallet, "toWallet", 32);
  out.date = normalizeDate(out.date, "date", true);
  out.note = normalizeOptionalName(out.note, "note", 120);
  out.reserve = out.type === "expense" ? normalizeBoolean(out.reserve) : false;
  out.recKey = normalizeOptionalName(out.recKey, "recKey", 120);
  out.recId = normalizeOptionalName(out.recId, "recId", 120);
  out.createdAt = normalizeTimestamp(out.createdAt, "createdAt");
  out.updatedAt = out.updatedAt ? normalizeTimestamp(out.updatedAt, "updatedAt") : out.createdAt;
  return { value: out, extra: splitExtras(row, knownRowKeys("transactions")) };
}

function normalizeGoal(row) {
  const out = Object.assign({}, row);
  out.id = normalizeId(out.id, "g");
  out.name = normalizeName(out.name, "name", 80);
  out.target = money(out.target, "target");
  out.current = money(out.current || 0, "current");
  out.deadline = normalizeDate(out.deadline, "deadline", false);
  out.closedAt = normalizeDate(out.closedAt, "closedAt", false);
  out.createdAt = normalizeTimestamp(out.createdAt, "createdAt");
  out.updatedAt = out.updatedAt ? normalizeTimestamp(out.updatedAt, "updatedAt") : out.createdAt;
  return { value: out, extra: splitExtras(row, knownRowKeys("goals")) };
}

function normalizeRecurring(row) {
  const out = Object.assign({}, row);
  out.id = normalizeId(out.id, "r");
  out.name = normalizeName(out.name, "name", 60);
  out.amount = money(out.amount, "amount");
  out.category = normalizeName(out.category, "category", 28);
  out.wallet = normalizeName(out.wallet || DEFAULT_WALLETS[0], "wallet", 32);
  out.day = normalizeInteger(out.day, "day", 1, 31);
  out.active = out.active !== false;
  out.startFrom = normalizeDate(out.startFrom, "startFrom", false) || normalizeTimestamp(out.createdAt, "createdAt").slice(0, 10);
  out.createdAt = normalizeTimestamp(out.createdAt, "createdAt");
  out.updatedAt = out.updatedAt ? normalizeTimestamp(out.updatedAt, "updatedAt") : out.createdAt;
  return { value: out, extra: splitExtras(row, knownRowKeys("recurring")) };
}

function normalizeDebt(row) {
  const out = Object.assign({}, row);
  out.id = normalizeId(out.id, "d");
  out.direction = ["lent", "borrowed"].includes(out.direction) ? out.direction : (() => { throw appError(400, "invalid_direction", "direction is invalid"); })();
  out.person = normalizeName(out.person, "person", 60);
  out.amount = money(out.amount, "amount");
  out.due = normalizeDate(out.due, "due", false);
  out.settled = normalizeBoolean(out.settled);
  out.createdAt = normalizeTimestamp(out.createdAt, "createdAt");
  out.updatedAt = out.updatedAt ? normalizeTimestamp(out.updatedAt, "updatedAt") : out.createdAt;
  return { value: out, extra: splitExtras(row, knownRowKeys("debts")) };
}

function normalizeAmortize(row) {
  const out = Object.assign({}, row);
  out.id = normalizeId(out.id, "a");
  out.name = normalizeName(out.name, "name", 60);
  out.amount = money(out.amount, "amount");
  out.months = normalizeInteger(out.months, "months", 1, 1200);
  out.startDate = normalizeDate(out.startDate, "startDate", false) || normalizeTimestamp(out.createdAt, "createdAt").slice(0, 10);
  out.createdAt = normalizeTimestamp(out.createdAt, "createdAt");
  out.updatedAt = out.updatedAt ? normalizeTimestamp(out.updatedAt, "updatedAt") : out.createdAt;
  return { value: out, extra: splitExtras(row, knownRowKeys("amortize")) };
}

function normalizeRow(collection, row) {
  switch (collection) {
    case "transactions":
      return normalizeTransaction(row);
    case "goals":
      return normalizeGoal(row);
    case "recurring":
      return normalizeRecurring(row);
    case "debts":
      return normalizeDebt(row);
    case "amortize":
      return normalizeAmortize(row);
    default:
      throw appError(400, "invalid_collection", "Unknown collection");
  }
}

function normalizeAccount(input) {
  const out = emptyAccount();
  const raw = isPlainObject(input) ? input : {};
  COLLECTIONS.forEach((collection) => {
    out[collection] = (Array.isArray(raw[collection]) ? raw[collection] : []).map((row) => {
      const normalized = normalizeRow(collection, row);
      return Object.assign({}, normalized.value, normalized.extra);
    });
  });
  const settings = normalizeSettings(raw.settings, out);
  out.settings = Object.assign({}, settings.value, settings.extra);
  return out;
}

module.exports = {
  COLLECTIONS,
  DEFAULT_EXPENSE_CATEGORIES,
  DEFAULT_INCOME_CATEGORIES,
  DEFAULT_WALLETS,
  defaultSettings,
  emptyAccount,
  expenseCategoryKey,
  normalizeAccount,
  normalizeRow,
  normalizeSettings,
  normalizeExpenseCategories,
  normalizeTimestamp,
  normalizeDate,
  splitExtras,
  cloneJson,
  newId
};
