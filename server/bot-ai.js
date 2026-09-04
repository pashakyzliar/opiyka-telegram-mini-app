"use strict";

const EXPENSE_CATS = ["Машина", "Пайка", "Хавка", "Дурка", "Продукти", "Сіги", "Подпіски"];
const INCOME_CATS = ["ЗП", "Аванс", "Підробіток", "Інше"];
const WALLETS = ["Кеш"];
const MONEY_WORDS = ["грн", "гривня", "гривні", "гривень", "uah", "usd", "eur"];
const DATE_WORDS = ["сьогодні", "вчора", "позавчора", "завтра"];
const NOTE_STOP_WORDS = ["я", "ми", "запиши", "додай", "додав", "додала", "витратив", "витратила", "дохід", "доход", "витрата", "витрати", "купив", "купила"];

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

function escapeHtml(text) {
  return String(text == null ? "" : text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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
  value = stripWords(value, MONEY_WORDS);
  value = stripWords(value, DATE_WORDS);
  value = stripWords(value, NOTE_STOP_WORDS);
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}

function expenseCategoryRows(list) {
  const source = Array.isArray(list) ? list : [];
  const rows = source
    .map((row) => row && typeof row === "object" ? row : { name: String(row || "") })
    .filter((row) => row && String(row.name || "").trim());
  if (rows.length) return rows;
  return EXPENSE_CATS.map((name) => ({ name, icon: "" }));
}

function expenseCategoryNames(list) {
  return expenseCategoryRows(list).map((row) => row.name);
}

function normalizeLower(text) {
  return String(text || "").replace(/\s+/g, " ").trim().toLocaleLowerCase("uk-UA");
}

function normalizeWord(word) {
  let value = String(word || "").toLocaleLowerCase("uk-UA").replace(/[^\p{L}]+/gu, "");
  if (value.length > 4) value = value.slice(0, -1);
  return value;
}

function sourceWords(text) {
  return noteFromUserText(text).split(/\s+/).map((word) => String(word || "").trim()).filter(Boolean);
}

function sourceWord(text) {
  return sourceWords(text)[0] || "";
}

function resolveGlossaryWrite(text, glossary, expenseCategories) {
  const numbers = String(text || "").match(/\d+(?:[\s.,]\d+)*/g) || [];
  if (numbers.length !== 1) return null;
  const amount = parseAmount(numbers[0]);
  if (amount == null) return null;
  const words = sourceWords(text);
  if (words.length !== 1) return null;
  const rawWord = words[0];
  const key = normalizeWord(rawWord);
  if (!key) return null;
  const category = glossary && typeof glossary === "object" ? glossary[key] : "";
  if (!expenseCategoryNames(expenseCategories).includes(category)) return null;
  return {
    type: "expense",
    category,
    amount,
    wallet: WALLETS[0],
    date: todayISO(),
    note: noteFromUserText(text),
    srcWord: rawWord
  };
}

function buildWritePrompt(text, expenseCategories) {
  const today = todayISO();
  return [
    "Ти розбираєш український текст про особисті фінанси на окремі операції.",
    "Сьогодні: " + today + ".",
    "Статті витрат: " + expenseCategoryNames(expenseCategories).join(", ") + ".",
    "Статті доходу: " + INCOME_CATS.join(", ") + ".",
    "Гаманці: " + WALLETS.join(", ") + ".",
    "Поверни ТІЛЬКИ JSON-об'єкт виду " +
      "{\"operations\":[{\"type\":\"expense\"|\"income\",\"category\":\"...\",\"amount\":123.45,\"wallet\":\"Кеш\",\"date\":\"YYYY-MM-DD\",\"note\":\"...\"}]}.",
    "Категорію обирай лише зі списків вище.",
    "Якщо жодна категорія витрат зі списку не підходить упевнено, повертай \"category\": null і не вгадуй.",
    "Приклад: \"150 грн стіки\" → {\"operations\":[{\"amount\":150,\"category\":null,\"note\":\"стіки\"}]}.",
    "Якщо гаманець не вказано, став \"Кеш\".",
    "Відносні дати переводь у конкретні YYYY-MM-DD. Якщо дата не вказана, став сьогодні.",
    "Поле note заповнюй короткою назвою покупки або сервісу без суми й без валюти.",
    "",
    "Текст: " + text
  ].join("\n");
}

function buildAskPrompt(question, expenseCategories) {
  return [
    "Користувач питає про свої фінанси. Поверни ТІЛЬКИ JSON-фільтр, не рахуй сам.",
    "Сьогодні: " + todayISO() + ".",
    "Статті витрат: " + expenseCategoryNames(expenseCategories).join(", ") + ".",
    "Статті доходу: " + INCOME_CATS.join(", ") + ".",
    "{\"categories\":[\"...\"],\"type\":\"expense\"|\"income\"|null,\"from\":\"YYYY-MM-DD\",\"to\":\"YYYY-MM-DD\",\"title\":\"короткий підпис\"}",
    "Порожній масив categories означає всі категорії.",
    "Якщо період не названо, став останні 12 місяців.",
    "",
    "Питання: " + question
  ].join("\n");
}

function normalizeDraft(row, expenseCategories) {
  if (!row || typeof row !== "object") return null;
  const amount = parseAmount(row.amount);
  if (amount == null) return null;
  const type = row.type === "income" ? "income" : "expense";
  const categories = type === "income" ? INCOME_CATS : expenseCategoryNames(expenseCategories);
  const wallet = WALLETS.includes(row.wallet) ? row.wallet : WALLETS[0];
  const date = isIsoDate(row.date) ? String(row.date) : todayISO();
  const note = String(row.note || "").trim().slice(0, 120);
  if (!categories.includes(row.category)) {
    if (type === "expense") return { type, category: null, amount, wallet, date, note, needsCategory: true };
    return { type, category: categories[0], amount, wallet, date, note, needsCategory: false };
  }
  return { type, category: row.category, amount, wallet, date, note, needsCategory: false };
}

function normalizeFilter(value, expenseCategories) {
  const today = todayISO();
  const fallbackFrom = isoAdd(today, -365);
  const result = value && typeof value === "object" ? value : {};
  const allowedExpense = expenseCategoryNames(expenseCategories);
  const categories = Array.isArray(result.categories)
    ? result.categories.filter((cat) => allowedExpense.includes(cat) || INCOME_CATS.includes(cat))
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
    if (!row || row.pending || !isIsoDate(row.date)) return false;
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

function bar(pct) {
  const safe = Math.max(0, Number(pct) || 0);
  const filled = Math.min(10, Math.round((safe / 100) * 10));
  return "▰".repeat(filled) + "▱".repeat(10 - filled);
}

function indicator(pct) {
  const safe = Number(pct) || 0;
  if (safe >= 100) return "🔴";
  if (safe >= 80) return "🟠";
  return "🟢";
}

function categoryEmoji(name, type, expenseCategories) {
  if (type !== "expense") return "";
  const row = expenseCategoryRows(expenseCategories).find((item) => item.name === name);
  return row && row.icon ? row.icon : "";
}

function formatNote(note, category) {
  const clean = String(note || "").replace(/\s+/g, " ").trim();
  if (!clean) return "";
  if (normalizeLower(clean) === normalizeLower(category)) return "";
  return escapeHtml(clean);
}

function formatCategoryLabel(row, expenseCategories) {
  const icon = categoryEmoji(row.category, row.type, expenseCategories);
  const name = row.category || "Без категорії";
  return escapeHtml(icon ? icon + " " + name : name);
}

function formatAllowanceBlock(info, show) {
  if (!info || !show) return "";
  const safeLimit = Math.max(0, Number(info.todayLimit) || 0);
  const spentToday = Number(info.spentToday) || 0;
  const dayProgressAvailable = Number(info.todayAvailable) || 0;
  const todayAvailable = Number.isFinite(Number(info.weekAvailable))
    ? Math.max(0, Number(info.weekAvailable))
    : Math.max(0, dayProgressAvailable);
  const overBy = Math.max(0, Number(info.overBy) || 0);
  const pct = safeLimit > 0 ? (spentToday / safeLimit) * 100 : 100;
  const marker = indicator(pct);
  if (!info.enabled || !info.configured) {
    return "\nСьогодні: <b>" + escapeHtml(formatMoney(spentToday)) + "</b>";
  }
  if (dayProgressAvailable < 0 || pct >= 100) {
    return "\nСьогодні: <b>" + escapeHtml(formatMoney(spentToday)) + "</b>" +
      "\nПеревитрата <b>" + escapeHtml(formatMoney(overBy)) + "</b>";
  }
  return "\nСьогодні: <b>" + escapeHtml(formatMoney(spentToday)) + "</b>" +
    " · лишилось <b>" + escapeHtml(formatMoney(todayAvailable)) + "</b>" +
    "\n<code>" + marker + " " + bar(pct) + "  " + Math.round(pct) + "%</code>";
}

function formatWriteReply(rows, allowanceInfo) {
  if (!rows.length) return "Не зміг розібрати запис. Спробуй написати щось на кшталт: 180 грн Glovo";
  const today = todayISO();
  const expenseCategories = allowanceInfo && allowanceInfo.expenseCategories;
  const showAllowance = rows.some((row) => row.type === "expense" && row.date === today && !row.pending);
  if (rows.length === 1) {
    const row = rows[0];
    const note = formatNote(row.note, row.category);
    const when = row.date === today ? "" : "\n<code>" + escapeHtml(row.date) + "</code>";
    return "<b>" + escapeHtml(formatMoney(row.amount)) + "</b> — " + formatCategoryLabel(row, expenseCategories) +
      (note ? " · " + note : "") +
      formatAllowanceBlock(allowanceInfo, showAllowance && row.type === "expense") +
      when;
  }
  const lines = rows.map((row, index) => {
    const note = formatNote(row.note, row.category);
    const when = row.date === today ? "" : " · " + row.date;
    return (index + 1) + ". " + formatCategoryLabel(row, expenseCategories) + " — " +
      escapeHtml(formatMoney(row.amount)) + (note ? " — " + note : "") + when;
  });
  const allowanceBlock = formatAllowanceBlock(allowanceInfo, showAllowance);
  return "Записав " + rows.length + " операції:\n" + lines.join("\n") + allowanceBlock;
}

function formatPendingCategoryReply(row) {
  return "<b>" + escapeHtml(formatMoney(row.amount)) + "</b>\n" +
    "Не зрозумів, що таке «" + escapeHtml(row.srcWord || row.note || "") + "». Куди віднести?\n" +
    "Запамʼятаю на майбутнє.";
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
  NOTE_STOP_WORDS,
  todayISO,
  isoAdd,
  noteFromUserText,
  normalizeWord,
  sourceWord,
  resolveGlossaryWrite,
  buildWritePrompt,
  buildAskPrompt,
  normalizeDraft,
  normalizeFilter,
  filterTransactions,
  sumTransactions,
  bar,
  indicator,
  categoryEmoji,
  formatWriteReply,
  formatPendingCategoryReply,
  formatAskReply,
  routeBotMessage,
  helpText,
  formatMoney,
  daysInMonth
};
