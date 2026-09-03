"use strict";

const EXPENSE_CATS = ["Машина", "Пайка", "Хавка", "Дурка", "Продукти", "Сіги", "Подпіски"];
const INCOME_CATS = ["ЗП", "Аванс", "Підробіток", "Інше"];
const WALLETS = ["Кеш"];

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function todayISO() {
  const now = new Date();
  return now.getFullYear() + "-" + pad(now.getMonth() + 1) + "-" + pad(now.getDate());
}

function isoAdd(iso, days) {
  const parts = String(iso || "").split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + days);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripWords(text, words) {
  if (!words.length) return text;
  const pattern = "(^|\\s)(" + words.map(escapeRegex).join("|") + ")(?=\\s|$)";
  return String(text).replace(new RegExp(pattern, "giu"), " ");
}

function startsWithAny(text, parts) {
  return parts.some((part) => text.startsWith(part));
}

function includesAny(text, parts) {
  return parts.some((part) => text.includes(part));
}

function parseAmount(raw) {
  const text = String(raw == null ? "" : raw).trim().replace(/\s/g, "").replace(",", ".");
  if (!text || !/^\d*\.?\d+$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value <= 0 || value > 1e12) return null;
  return Math.round(value * 100) / 100;
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function noteFromUserText(text) {
  let value = String(text || "")
    .replace(/\d+(?:[\s.,]\d+)*/g, " ")
    .replace(/[₴$€]/g, " ")
    .replace(/[.,;:+\-–—()[\]{}\\/]+/g, " ");
  value = stripWords(value, ["грн", "гривня", "гривні", "гривень", "uah", "usd", "eur"]);
  value = stripWords(value, ["сьогодні", "вчора", "позавчора", "завтра"]);
  value = stripWords(value, ["я", "ми", "запиши", "додай", "додав", "додала", "витратив", "витратила", "дохід", "доход", "витрата", "витрати", "купив", "купила"]);
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function buildWritePrompt(text) {
  const today = todayISO();
  return [
    "Ти розбираєш український текст про особисті фінанси на окремі операції.",
    "Сьогодні: " + today + ".",
    "Статті витрат: " + EXPENSE_CATS.join(", ") + ".",
    "Статті доходу: " + INCOME_CATS.join(", ") + ".",
    "Гаманці: " + WALLETS.join(", ") + ".",
    "Поверни ТІЛЬКИ JSON-масив об'єктів виду " +
      '{"type":"expense"|"income","category":"...","amount":123.45,"wallet":"Кеш","date":"YYYY-MM-DD","note":"..."}' + ".",
    "Категорію обирай лише зі списків вище.",
    "Якщо гаманець не вказано, став \"Кеш\".",
    "Відносні дати переводь у конкретні YYYY-MM-DD. Якщо дата не вказана, став сьогодні.",
    "Поле note заповнюй короткою назвою покупки або сервісу без суми й без валюти.",
    "",
    "Текст: " + text
  ].join("\n");
}

function buildAskPrompt(question) {
  return [
    "Користувач питає про свої фінанси. Поверни ТІЛЬКИ JSON-фільтр, не рахуй сам.",
    "Сьогодні: " + todayISO() + ".",
    "Статті витрат: " + EXPENSE_CATS.join(", ") + ".",
    "Статті доходу: " + INCOME_CATS.join(", ") + ".",
    'Формат: {"categories":["..."],"type":"expense"|"income"|null,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","title":"короткий підпис"}',
    "Порожній масив categories означає всі категорії.",
    "Якщо період не названо, став останні 12 місяців.",
    "",
    "Питання: " + question
  ].join("\n");
}

function normalizeDraft(row) {
  if (!row || typeof row !== "object") return null;
  const amount = parseAmount(row.amount);
  if (amount == null) return null;
  const type = row.type === "income" ? "income" : "expense";
  const categories = type === "income" ? INCOME_CATS : EXPENSE_CATS;
  const category = categories.includes(row.category) ? row.category : categories[0];
  const wallet = WALLETS.includes(row.wallet) ? row.wallet : WALLETS[0];
  const date = isIsoDate(row.date) ? String(row.date) : todayISO();
  const note = String(row.note || "").trim().slice(0, 120);
  return { type, category, amount, wallet, date, note };
}

function normalizeFilter(value) {
  const today = todayISO();
  const fallbackFrom = isoAdd(today, -365);
  const result = value && typeof value === "object" ? value : {};
  const categories = Array.isArray(result.categories)
    ? result.categories.filter((cat) => EXPENSE_CATS.includes(cat) || INCOME_CATS.includes(cat))
    : [];
  const type = result.type === "expense" || result.type === "income" ? result.type : null;
  const from = isIsoDate(result.from) ? String(result.from) : fallbackFrom;
  const to = isIsoDate(result.to) ? String(result.to) : today;
  const title = String(result.title || "").trim().slice(0, 120);
  return { categories, type, from, to, title };
}

function filterTransactions(transactions, filter) {
  const list = Array.isArray(transactions) ? transactions : [];
  return list.filter((row) => {
    if (!row || !isIsoDate(row.date)) return false;
    if (row.type !== "expense" && row.type !== "income") return false;
    if (filter.type && row.type !== filter.type) return false;
    if (filter.categories.length && !filter.categories.includes(row.category)) return false;
    if (filter.from && row.date < filter.from) return false;
    if (filter.to && row.date > filter.to) return false;
    return true;
  });
}

function sumTransactions(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function formatMoney(amount) {
  const value = Math.round((Number(amount) || 0) * 100) / 100;
  return value.toLocaleString("uk-UA", {
    minimumFractionDigits: value % 1 ? 2 : 0,
    maximumFractionDigits: 2
  }) + " ₴";
}

function formatDateRange(from, to) {
  if (!from && !to) return "";
  if (from && to) return from + " — " + to;
  return from || to || "";
}

function formatWriteReply(rows) {
  if (!rows.length) return "Не зміг розібрати запис. Спробуй написати щось на кшталт: 180 грн Glovo";
  if (rows.length === 1) {
    const row = rows[0];
    const note = row.note ? "\nНотатка: " + row.note : "";
    return "Записав " + (row.type === "income" ? "дохід" : "витрату") +
      ": " + formatMoney(row.amount) +
      "\nКатегорія: " + row.category +
      note +
      "\nДата: " + row.date;
  }
  return "Записав " + rows.length + " операції:\n" + rows.map((row, index) => {
    return (index + 1) + ". " + row.category + " — " + formatMoney(row.amount) + (row.note ? " — " + row.note : "");
  }).join("\n");
}

function formatAskReply(filter, rows, total) {
  const label = filter.title || (filter.type === "income" ? "Дохід" : filter.type === "expense" ? "Витрати" : "Вибірка");
  if (!rows.length) {
    return label + "\nЗа " + formatDateRange(filter.from, filter.to) + " записів не знайшов.";
  }
  const cats = filter.categories.length ? "\nКатегорії: " + filter.categories.join(", ") : "";
  return label +
    "\nСума: " + formatMoney(total) +
    "\nОперацій: " + rows.length +
    "\nПеріод: " + formatDateRange(filter.from, filter.to) +
    cats;
}

function routeBotMessage(text) {
  const value = String(text || "").trim();
  if (!value) return "ignore";
  const lower = value.toLowerCase();
  if (/^\/(start|app)(?:@\w+)?$/.test(lower)) return "app";
  if (/^\/help(?:@\w+)?$/.test(lower)) return "help";
  const startsAsQuestion = startsWithAny(lower, ["скільки", "скока", "скок", "покажи", "дай", "яка", "який", "які", "аналіз", "аналітика", "статистика"]);
  const periodCue = includesAny(lower, ["за цей", "за місяць", "за тиж", "за рік", "сумарно", "загалом"]);
  const noAmountAnalytics = !/\d/.test(value) && includesAny(lower, ["витратив", "заробив", "доход", "витрат"]);
  const analyticsCue = value.includes("?") || startsAsQuestion || periodCue || noAmountAnalytics;
  if (analyticsCue) return "ask";
  if (/\d/.test(value)) return "write";
  return "help";
}

function helpText(publicUrl) {
  const examples = [
    "Що я вмію:",
    "• Запис: 180 грн Glovo",
    "• Запис: 250 атб",
    "• Аналітика: скільки я витратив за цей місяць на сіги"
  ];
  if (publicUrl) examples.push("• Mini App: /app");
  return examples.join("\n");
}

module.exports = {
  EXPENSE_CATS,
  INCOME_CATS,
  WALLETS,
  todayISO,
  isoAdd,
  noteFromUserText,
  buildWritePrompt,
  buildAskPrompt,
  normalizeDraft,
  normalizeFilter,
  filterTransactions,
  sumTransactions,
  formatWriteReply,
  formatAskReply,
  routeBotMessage,
  helpText,
  formatMoney
};
