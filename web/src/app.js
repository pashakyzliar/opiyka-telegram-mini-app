(function () {
  "use strict";

  /* ============================ constants ============================ */

  var EXPENSE_CATS = ["Транспорт", "Кафе і ресторани", "Доставка їжі", "Розваги", "Продукти", "Тютюн і алкоголь", "Підписки"];
  var DEFAULT_EXPENSE_CATEGORY_ROWS = [
    { name: "Транспорт", color: "#5aa8ba" },
    { name: "Кафе і ресторани", color: "#c08a4a" },
    { name: "Доставка їжі", color: "#63b06e" },
    { name: "Розваги", color: "#b07dad" },
    { name: "Продукти", color: "#d29a5c" },
    { name: "Тютюн і алкоголь", color: "#97a851" },
    { name: "Підписки", color: "#7d8ecb" }
  ];
  var INCOME_CATS = ["ЗП", "Аванс", "Підробіток", "Інше"];
  var WALLETS = ["Кеш"];
 
  var EXPENSE_ICON_PRESETS = ["🛒", "🍔", "🥗", "☕", "🍱", "🍕", "🚗", "⛽", "🚌", "🚕", "🏠", "💡", "💧", "📱", "🌐", "💳", "💸", "🚬", "💊", "🏥", "🧴", "👕", "👟", "🎁", "🎉", "🎮", "📦", "🐾", "✈️", "🏨", "📚", "✂️", "🔧", "👶", "❤️", "🧾"];

  var BLOCK_HELP = {
    "dashboard-date": {
      title: "Дата і привітання",
      body: [
        "День тижня і дата беруться з місцевого часу пристрою.",
        "Привітання змінюється так: 05:00–11:59 — «Доброго ранку», 12:00–17:59 — «Доброго дня», 18:00–21:59 — «Доброго вечора», 22:00–04:59 — «Доброї ночі». Перевірка виконується щохвилини."
      ]
    },
    ledger: {
      title: "Журнал",
      body: [
        "Тут зберігаються підтверджені доходи й витрати вибраного місяця. Новий запис містить дату, категорію, суму та необов’язкову нотатку.",
        "Пошук фільтрує журнал за текстом, категорією, сумою та датами. Витрата з позначкою «З резерву» рахується окремо від звичайного денного плану."
      ]
    },
    allowance: {
      title: "Сьогодні можна",
      body: [
        "Показує доступну суму на поточний момент тижня: сума денних планів від понеділка до сьогодні мінус звичайні витрати за цей самий період.",
        "Невитрачений залишок переходить на наступний день. Витрати з позначкою «З резерву» сюди не віднімаються — вони зменшують окремий тижневий резерв. Від’ємний результат на картці показується як нуль."
      ]
    },
    balance: {
      title: "Баланс",
      body: [
        "Загальний баланс = усі підтверджені доходи за весь час − усі підтверджені витрати − уже зафіксовані заощадження.",
        "Перекази між гаманцями не змінюють загальний баланс. Лінія внизу показує зміну балансу за останні шість місяців з урахуванням перенесених заощаджень."
      ]
    },
    "income-plan": {
      title: "План доходу",
      body: [
        "Якщо заданий місячний план зарплати, картка показує, скільки ще очікується: планова сума мінус уже записані доходи вибраного місяця, але не менше нуля.",
        "Якщо план зарплати не заданий, тут показується фактична сума доходів за місяць."
      ]
    },
    "income-fact": {
      title: "Отримано",
      body: [
        "Сума всіх підтверджених операцій типу «Дохід» у вибраному місяці.",
        "Майбутній план зарплати тут не враховується — лише фактично додані надходження."
      ]
    },
    expenses: {
      title: "Витрати",
      body: [
        "Сума всіх підтверджених витрат у вибраному місяці. Поруч показується кількість таких списань.",
        "Борги й незавершені записи сюди не входять. Витрати з резерву входять у місячну суму, але окремо враховуються в тижневому прогнозі."
      ]
    },
    "week-forecast": {
      title: "Тиждень",
      body: [
        "Кожний день починається із залишку попереднього дня плюс його денний план. Після віднімання звичайних витрат утворюється залишок, який переходить далі.",
        "Резервні витрати показуються окремо й зменшують тижневий резерв. Галочка означає, що день завершився без перевищення доступної суми."
      ]
    },
    budgets: {
      title: "Ліміти",
      body: [
        "Для кожної категорії порівнюються фактичні витрати вибраного місяця з установленим місячним лімітом.",
        "Смуга заповнюється пропорційно витратам, а після перевищення стає червоною. Значення в полі праворуч одразу змінює ліміт категорії."
      ]
    },
    "expense-breakdown": {
      title: "Розклад витрат",
      body: [
        "Діаграма групує всі підтверджені витрати вибраного місяця за категоріями.",
        "Розмір сектора = сума категорії ÷ загальна сума витрат. У списку показані сума та округлена частка кожної категорії."
      ]
    },
    "year-income": {
      title: "Заносять за рік",
      body: ["Сума всіх підтверджених доходів, дата яких належить вибраному року."]
    },
    "year-expense": {
      title: "Витрати за рік",
      body: ["Сума всіх підтверджених витрат, дата яких належить вибраному року."]
    },
    "year-navar": {
      title: "Заощадження за рік",
      body: ["Сума всіх позитивних місячних залишків, які були зафіксовані в історії заощаджень за вибраний рік."]
    },
    "year-net": {
      title: "Чистими за рік",
      body: ["Різниця між підтвердженими доходами та витратами вибраного року: доходи − витрати."]
    },
    "six-month-trend": {
      title: "Динаміка за 6 місяців",
      body: [
        "Для кожного з останніх шести календарних місяців окремо підсумовуються підтверджені доходи та витрати.",
        "Висота стовпчиків відносна до найбільшої місячної суми на графіку."
      ]
    },
    "year-table": {
      title: "Річна таблиця",
      body: [
        "Таблиця підсумовує витрати вибраного року за категоріями та місяцями.",
        "Категорії впорядковані від найбільшої річної суми до найменшої; смуга в колонці «Разом» показує їх співвідношення."
      ]
    },
    recurring: {
      title: "Регулярні платежі",
      body: [
        "Активний платіж автоматично створює витрату у вказане число кожного місяця. Для коротких місяців використовується останній доступний день.",
        "Повторний запуск не створює дубль. Платіж можна призупинити, відновити або видалити."
      ]
    },
    amortization: {
      title: "Амортизація",
      body: [
        "Допомагає розкласти рідку велику покупку на умовну місячну вартість: сума ÷ кількість місяців.",
        "Накопичений прогрес оцінюється за часом від дати старту, де один місяць дорівнює приблизно 30,4 дня. Цей блок не створює витрат у журналі автоматично."
      ]
    },
    debts: {
      title: "Борги",
      body: [
        "Окремо підсумовує відкриті суми «Мені винні» та «Я винен». Закриті борги лишаються в історії, але не входять у ці підсумки.",
        "Борги не додаються до доходів або витрат і не впливають на баланс та статистику."
      ]
    },
    "salary-plan": {
      title: "Місячний план",
      body: [
        "Задає загальну очікувану зарплату за місяць і дні її надходження. Однакові дні прибираються, а дата автоматично обмежується останнім днем місяця.",
        "План впливає на картку «План доходу». Після настання дати застосунок просить підтвердити фактичне надходження."
      ]
    },
    "week-settings": {
      title: "Налаштування тижня",
      body: [
        "Тижневий бюджет складається з денних планів і резерву. Унизу показується різниця: нерозподілений залишок або перевищення плану.",
        "Перемикач «Сьогодні можна» вмикає прогноз. Звичайні витрати списуються з накопиченого денного плану, а позначені резервними — з резерву."
      ]
    },
    categories: {
      title: "Кастомізація витрат",
      body: [
        "Категорія визначає назву, емодзі та колір витрати в журналі, лімітах і діаграмах.",
        "Перейменування переносить на нову назву пов’язані витрати, регулярні платежі та ліміт. Усі зміни списку застосовуються кнопкою «Оновити категорії»."
      ]
    },
    "navar-history": {
      title: "Заощадження",
      body: [
        "Після завершення місяця позитивна різниця «доходи − витрати» фіксується як заощадження. Від’ємний або нульовий результат не переноситься.",
        "Історичні заощадження підсумовуються окремо та віднімаються від доступного загального балансу."
      ]
    },
    service: {
      title: "Сервіс",
      body: [
        "Спокійний режим вимикає декоративні анімації. PIN або доступна біометрія ховають екран на цьому пристрої, але не шифрують фінансові дані.",
        "Експорт CSV формує таблицю операцій. Видалення акаунта безповоротно видаляє його дані після окремого підтвердження."
      ]
    },
    cabinet: {
      title: "Кабінет",
      body: [
        "Тут зібрані захист входу, категорії, особистий словник, ліміти та швидкий запис з iPhone.",
        "Словник пов’язує ваші слова з категоріями для бота. Швидкий запис використовує окремий токен і додає витрату без відкриття Mini App."
      ]
    }
  };

  var LS_KEY = "kopiyka_v2";
  var COLLECTIONS = ["transactions", "goals", "recurring", "debts", "amortize"];

  var INC_VAR = { "Карта": "--inc-card", "Кеш": "--inc-cash" };

  /* ============================ helpers ============================ */

  // Everything user-typed that reaches innerHTML goes through this. Notes,
  // goal names and person names sync through db and can arrive from another
  // device, so they are never trusted markup.
  function esc(v) {
    return String(v == null ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  // Accepts "65.50" and "65,50" alike and says what is wrong rather than
  // dropping the entry in silence.
  function parseAmount(raw) {
    var t = String(raw == null ? "" : raw).trim().replace(/\s/g, "").replace(",", ".");
    if (!t) return { ok: false, msg: "Введи суму." };
    if (!/^\d*\.?\d+$/.test(t)) return { ok: false, msg: "Сума має бути числом, напр. 65.50 або 65,50." };
    var v = Number(t);
    if (!isFinite(v)) return { ok: false, msg: "Сума має бути числом." };
    if (v <= 0) return { ok: false, msg: "Сума має бути більшою за нуль." };
    if (v > 1e12) return { ok: false, msg: "Занадто велика сума." };
    return { ok: true, value: Math.round(v * 100) / 100 };
  }
  function softAmount(raw) { var p = parseAmount(raw); return p.ok ? p.value : null; }

  // getComputedStyle forces a style recalc, and a full render asked for a
  // colour once per row, per budget, per legend entry — hundreds of calls that
  // between them cost more than everything else on the frame. The values only
  // change when the theme does, so they are read once and cached.
  var cssCache = Object.create(null);
  function css(varName) {
    var v = cssCache[varName];
    if (v === undefined) {
      v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
      cssCache[varName] = v;
    }
    return v;
  }
  function dropCssCache() { cssCache = Object.create(null); }
  try {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      dropCssCache(); if (state.ready) renderAll();
    });
    new MutationObserver(function () { dropCssCache(); }).observe(document.documentElement, {
      attributes: true, attributeFilter: ["data-theme", "class"]
    });
  } catch (e) {}
  function colorFor(type, cat) {
    if (type === "income") return css("--positive");
    var meta = expenseCats().find(function (row) { return row.name === cat; });
    if (meta && meta.color) return meta.color;
    var fallback = DEFAULT_EXPENSE_CATEGORY_ROWS.find(function (row) { return row.name === cat; });
    return fallback ? fallback.color : css("--ink-muted");
  }
  function walletColor(w) { var v = INC_VAR[w]; return v ? css(v) : css("--ink-muted"); }

  function fmt(n) {
    var v = Math.round((n || 0) * 100) / 100;
    return v.toLocaleString("uk-UA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " ₴";
  }
  function fmtShort(n) { return Math.round(n || 0).toLocaleString("uk-UA") + " ₴"; }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function monthKey(dateStr) { return String(dateStr || "").slice(0, 7); }
  function yearOf(dateStr) { return String(dateStr || "").slice(0, 4); }
  function monthLabel(key) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, 1);
    var s = d.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function monthShort(key) {
    var p = key.split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, 1).toLocaleDateString("uk-UA", { month: "short" });
  }
  function addMonths(key, delta) {
    var p = key.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1 + delta, 1);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1);
  }
  function daysInMonth(y, m) { return new Date(y, m, 0).getDate(); }
  function isoAdd(iso, days) {
    var p = iso.split("-");
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + days);
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function dayDiff(a, b) {
    var pa = a.split("-"), pb = b.split("-");
    var da = Date.UTC(+pa[0], +pa[1] - 1, +pa[2]), db = Date.UTC(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((db - da) / 86400000);
  }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function weekdayIndex(iso) {
    var d = new Date(iso + "T00:00:00");
    return (d.getDay() + 6) % 7;
  }
  function activeEditableElement() {
    var el = document.activeElement;
    if (!el) return null;
    var tag = String(el.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable) return el;
    return null;
  }
  function blurActiveEditable() {
    var el = activeEditableElement();
    if (!el) return;
    try { el.blur(); } catch (e) {}
  }
  function isTouchLikeDevice() {
    try {
      if (window.matchMedia("(pointer: coarse)").matches) return true;
      if (window.matchMedia("(hover: none)").matches) return true;
    } catch (e) {}
    return !!(("ontouchstart" in window) || (navigator && navigator.maxTouchPoints > 0));
  }
  function shouldAutoFocusAmount() {
    if (isTouchLikeDevice()) return false;
    if (window.KOPIYKA_TELEGRAM && window.KOPIYKA_TELEGRAM.webApp) return false;
    return true;
  }
  function monthStart(mk) { return mk + "-01"; }
  function weekStart(iso) { return isoAdd(iso, -weekdayIndex(iso)); }
  function weekEnd(iso) { return isoAdd(iso, 6 - weekdayIndex(iso)); }
  function sameOrAfter(a, b) { return dayDiff(b, a) >= 0; }
  function sameOrBefore(a, b) { return dayDiff(a, b) >= 0; }
  function inRange(iso, from, to) { return sameOrAfter(iso, from) && sameOrBefore(iso, to); }
  function normalizeWeekDaily(list) {
    var out = [0, 0, 0, 0, 0, 0, 0];
    if (!Array.isArray(list)) return out;
    for (var i = 0; i < 7; i++) out[i] = Math.max(0, round2(list[i]));
    return out;
  }
  function normalizeNavarHistory(list) {
    return (Array.isArray(list) ? list : []).map(function (row) {
      return {
        id: String((row && row.id) || ("navar." + String((row && row.month) || "").replace("-", "_"))),
        month: String((row && row.month) || "").slice(0, 7),
        amount: Math.max(0, round2(row && row.amount)),
        createdAt: row && row.createdAt ? String(row.createdAt) : new Date().toISOString()
      };
    }).filter(function (row) { return /^\d{4}-\d{2}$/.test(row.month); })
      .sort(function (a, b) { return a.month < b.month ? -1 : 1; });
  }
  function normalizeExpenseCategoryName(raw) {
    return String(raw == null ? "" : raw).replace(/\s+/g, " ").trim().slice(0, 28);
  }
  function normalizeExpenseCategoryColor(raw, fallback) {
    var color = String(raw == null ? "" : raw).trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(color)) return color;
    return fallback;
  }
  function utf8Bytes(text) {
    if (typeof TextEncoder === "function") return new TextEncoder().encode(String(text || "")).length;
    return unescape(encodeURIComponent(String(text || ""))).length;
  }
  function normalizeExpenseCategoryIcon(raw) {
    var value = String(raw == null ? "" : raw).trim();
    if (!value || typeof Intl === "undefined" || typeof Intl.Segmenter !== "function") return "";
    var segments = Array.from(new Intl.Segmenter("uk-UA", { granularity: "grapheme" }).segment(value), function (part) {
      return part.segment;
    });
    if (segments.length !== 1) return "";
    return utf8Bytes(segments[0]) <= 8 ? segments[0] : "";
  }
  function cloneDefaultExpenseCategories() {
    return DEFAULT_EXPENSE_CATEGORY_ROWS.map(function (row) {
      return { name: row.name, color: row.color, icon: row.icon || "" };
    });
  }
  function normalizeExpenseCategories(list) {
    var source = Array.isArray(list) && list.length ? list : cloneDefaultExpenseCategories();
    var out = [];
    var seen = Object.create(null);
    source.forEach(function (row, idx) {
      var fallback = DEFAULT_EXPENSE_CATEGORY_ROWS[idx % DEFAULT_EXPENSE_CATEGORY_ROWS.length] || DEFAULT_EXPENSE_CATEGORY_ROWS[0];
      var name = normalizeExpenseCategoryName(row && typeof row === "object" ? row.name : row);
      if (!name) return;
      var key = name.toLocaleLowerCase("uk-UA");
      if (seen[key]) return;
      seen[key] = true;
      var matched = DEFAULT_EXPENSE_CATEGORY_ROWS.find(function (item) {
        return item.name.toLocaleLowerCase("uk-UA") === key;
      });
      out.push({
        name: name,
        color: normalizeExpenseCategoryColor(row && row.color, fallback.color),
        icon: normalizeExpenseCategoryIcon(row && row.icon) || (matched && matched.icon) || ""
      });
    });
    return out.length ? out : cloneDefaultExpenseCategories();
  }
  function expenseCats() {
    var s = settings();
    s.expenseCategories = normalizeExpenseCategories(s.expenseCategories);
    return s.expenseCategories;
  }
  function expenseCatNames() {
    return expenseCats().map(function (row) { return row.name; });
  }
  function defaultExpenseCategory() {
    return expenseCats()[0] || cloneDefaultExpenseCategories()[0];
  }
  function defaultExpenseName() {
    return defaultExpenseCategory().name;
  }
  function expenseMeta(name) {
    return expenseCats().find(function (row) { return row.name === name; }) || null;
  }
  function expenseIcon(name) {
    var meta = expenseMeta(name);
    return meta && meta.icon ? meta.icon : "";
  }
  function expenseLabel(name) {
    var icon = expenseIcon(name);
    return icon ? icon + " " + name : name;
  }
  function sumWeekDaily(list) {
    return normalizeWeekDaily(list).reduce(function (s, v) { return s + v; }, 0);
  }
  function plannedForDay(iso) {
    return normalizeWeekDaily(settings().weekDaily)[weekdayIndex(iso)] || 0;
  }
  function salaryDaysForMonth(mk) {
    var p = mk.split("-");
    var y = +p[0], m = +p[1];
    var maxDay = daysInMonth(y, m);
    var uniq = {};
    return settings().salaryDays
      .map(function (d) { return Math.min(maxDay, Math.max(1, Number(d) || 1)); })
      .filter(function (d) {
        var k = String(d);
        if (uniq[k]) return false;
        uniq[k] = true;
        return true;
      })
      .sort(function (a, b) { return a - b; });
  }
  function plannedSalary(mk) {
    var total = Math.max(0, round2(settings().salaryAmount));
    if (!total) return 0;
    return total;
  }
  function payoutLabel(mk) {
    var days = salaryDaysForMonth(mk);
    if (!days.length) return "дні не задані";
    return days.map(function (d) { return pad(d) + "." + mk.slice(5, 7); }).join(" · ");
  }
  function navarHistory() { return normalizeNavarHistory(settings().navarHistory); }
  function totalNavar() {
    return navarHistory().reduce(function (s, row) { return s + row.amount; }, 0);
  }
  function monthActuals(mk) {
    var tx = monthTx(mk);
    var income = sum(tx.filter(isIncome));
    var expense = sum(tx.filter(isExpense));
    return { income: income, expense: expense, net: income - expense };
  }
  function monthProjectedCarry(mk) {
    return Math.max(0, round2(monthActuals(mk).net));
  }
  function navarDeductedByMonth(mk) {
    return navarHistory().reduce(function (s, row) {
      return addMonths(row.month, 1) <= mk ? s + row.amount : s;
    }, 0);
  }

  /* ============================ state ============================ */

  var state = {
    transactions: [], goals: [], recurring: [], debts: [], amortize: [],
    settings: {},
    viewMonth: monthKey(todayISO()),
    viewYear: Number(yearOf(todayISO())),
    view: "main",
    filter: null,
    ready: false
  };
  var store = null;
  var caps = { db: null, downloads: null, sample: null };
  var lastAddedId = null;
  var prevStat = { balance: null, income: null, expense: null, savings: null, allowance: null };

  function defaultSettings() {
    return {
      budgets: {},
      expenseCategories: cloneDefaultExpenseCategories(),
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
      streakRecord: 0,
      bestRate: null,
      onboardingDone: false
    };
  }
  function settings() {
    var s = state.settings || {};
    if (!s.budgets) s.budgets = {};
    if (!s.glossary || typeof s.glossary !== "object") s.glossary = {};
    s.expenseCategories = normalizeExpenseCategories(s.expenseCategories);
    if (!Array.isArray(s.salaryDays) || !s.salaryDays.length) s.salaryDays = [5, 20];
    s.allowanceEnabled = !!s.allowanceEnabled;
    s.lockEnabled = !!s.lockEnabled;
    s.salaryAmount = Math.max(0, round2(s.salaryAmount));
    s.salaryPlanEnabled = !!s.salaryPlanEnabled;
    if (!Array.isArray(s.salaryPayments)) s.salaryPayments = [];
    s.weekBudget = Math.max(0, round2(s.weekBudget));
    s.weekReserve = Math.max(0, round2(s.weekReserve));
    s.weekDaily = normalizeWeekDaily(s.weekDaily);
    s.navarHistory = normalizeNavarHistory(s.navarHistory);
    return s;
  }

  /* ============================ toasts / dialogs ============================ */

  function showError(label, message) {
    var stack = document.getElementById("toastStack");
    if (!stack) return;
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = '<strong></strong><span></span>';
    el.querySelector("strong").textContent = label;
    el.querySelector("span").textContent = message;
    stack.appendChild(el);
    setTimeout(function () {
      el.style.opacity = "0"; el.style.transition = "opacity .3s ease";
      setTimeout(function () { el.remove(); }, 320);
    }, 4600);
  }
  function reportFailure(label, err) {
    console.error("[Копійка] " + label + ":", err && err.code, err && err.message, err);
    showError(label, "не збереглось (" + ((err && err.code) || "помилка") + "). Спробуй ще раз.");
  }
  function confirmBox(text) {
    return new Promise(function (resolve) {
      var back = document.getElementById("confirmBack");
      blurActiveEditable();
      document.getElementById("confirmText").textContent = text;
      back.hidden = false;
      function done(v) {
        back.hidden = true;
        document.getElementById("confirmYes").onclick = null;
        document.getElementById("confirmNo").onclick = null;
        resolve(v);
      }
      document.getElementById("confirmYes").onclick = function () { done(true); };
      document.getElementById("confirmNo").onclick = function () { done(false); };
    });
  }

  /* ============================ storage backends ============================ */

  function uid() { return "l" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function makeLocalStore() {
    var data;
    try { data = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { data = null; }
    if (!data || typeof data !== "object") data = {};
    COLLECTIONS.forEach(function (c) { if (!Array.isArray(data[c])) data[c] = []; });
    if (!data.settings || typeof data.settings !== "object") data.settings = defaultSettings();
    var subs = {};
    function persist() { try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch (e) {} }
    function fire(c) { if (subs[c]) subs[c](data[c].slice()); }
    function fireSettings() { if (subs.settings) subs.settings(Object.assign({}, data.settings)); }
      return {
        offline: true,
        subscribe: function (c, cb) { subs[c] = cb; cb(data[c].slice()); },
        subscribeSettings: function (cb) { subs.settings = cb; cb(Object.assign({}, data.settings)); },
      add: function (c, obj, forcedId) {
        var o = Object.assign({}, obj);
        o.id = forcedId || uid();
        if (!o.createdAt) o.createdAt = new Date().toISOString();
        var i = data[c].findIndex(function (x) { return x.id === o.id; });
        if (i >= 0) data[c][i] = o; else data[c].push(o);
        persist(); fire(c);
        return Promise.resolve(o.id);
      },
      // Імпорт виписки додає сотні рядків за раз: один запис і одне
      // перемальовування замість сотні.
      bulkAdd: function (c, rows) {
        (rows || []).forEach(function (obj) {
          var o = Object.assign({}, obj);
          o.id = uid();
          if (!o.createdAt) o.createdAt = new Date().toISOString();
          data[c].push(o);
        });
        persist(); fire(c);
        return Promise.resolve({ added: (rows || []).length, failed: 0 });
      },
      update: function (c, id, patch) {
        var o = data[c].find(function (x) { return x.id === id; });
        if (o) { Object.assign(o, patch); persist(); fire(c); }
        return Promise.resolve();
      },
      remove: function (c, id) {
        data[c] = data[c].filter(function (x) { return x.id !== id; });
        persist(); fire(c);
        return Promise.resolve();
      },
      saveSettings: function (s) {
        data.settings = Object.assign({}, s);
        persist(); fireSettings();
        return Promise.resolve();
      },
        replaceAll: function (payload) {
          COLLECTIONS.forEach(function (c) { data[c] = Array.isArray(payload[c]) ? payload[c].slice() : []; });
          data.settings = Object.assign(defaultSettings(), payload.settings || {});
          persist(); COLLECTIONS.forEach(fire); fireSettings();
          return Promise.resolve();
        },
        exportAll: function () {
          var out = { app: "kopiyka", version: 5, exportedAt: new Date().toISOString(), settings: Object.assign({}, data.settings) };
          COLLECTIONS.forEach(function (c) { out[c] = data[c].slice(); });
          return Promise.resolve(out);
        },
        deleteAccount: function () {
          COLLECTIONS.forEach(function (c) { data[c] = []; });
          data.settings = defaultSettings();
          persist(); COLLECTIONS.forEach(fire); fireSettings();
          return Promise.resolve({ ok: true });
        }
      };
    }

  // onSnapshot's error callback fires at most once and the listener is dead
  // after it, so a swallowed error froze the whole screen. Resubscribe and say
  // so out loud.
  function watchRef(ref, label, onData, onDown) {
    var attempt = 0;
    function go() {
      ref.onSnapshot(function (snap) {
        attempt = 0;
        if (onDown) onDown(false);
        try { onData(snap); }
        catch (err) {
          console.error("[Копійка] снапшот \"" + label + "\" прийшов, але обробка впала:", err);
          showError(label, "дані дійшли, але не намалювались (" + ((err && err.message) || "помилка") + ")");
        }
      }, function (err) {
        console.error("[Копійка] підписка \"" + label + "\" відвалилась:", err && err.code, err && err.message);
        if (onDown) onDown(true);
        showError(label, "оновлення призупинено (" + ((err && err.code) || "помилка") + "), перепідключаюсь…");
        attempt++;
        setTimeout(go, Math.min(15000, 1000 * Math.pow(2, attempt)));
      });
    }
    go();
  }

  function makeDbStore(db) {
    var settingsCache = defaultSettings();
    // Snapshot bodies are frozen — clone before stamping the id on, or strict
    // mode throws inside the snapshot callback and the subscription dies.
    function mapDocs(snap) {
      return snap.docs.map(function (d) {
        var o = Object.assign({}, d.data());
        o.id = d.id;
        return o;
      });
    }
      return {
        offline: false,
        subscribe: function (c, cb, onDown) {
        // No orderBy here: the store sorts in memory. An orderBy would drop
        // every document missing that field, and a limit would silently cut
        // history once the journal outgrows it.
        watchRef(db.collection(c), c, function (snap) { cb(mapDocs(snap)); }, onDown);
      },
      subscribeSettings: function (cb, onDown) {
        watchRef(db.doc("settings/main"), "налаштування", function (snap) {
          var raw = (snap.exists && snap.data()) || {};
          settingsCache = Object.assign(defaultSettings(), raw);
          settingsCache.budgets = Object.assign({}, raw.budgets || {});
          cb(settingsCache);
        }, onDown);
      },
      add: function (c, obj, forcedId) {
        var o = Object.assign({}, obj);
        if (!o.createdAt) o.createdAt = new Date().toISOString();
        delete o.id;
        if (forcedId) return db.collection(c).doc(forcedId).set(o).then(function () { return forcedId; });
        return db.collection(c).add(o).then(function (ref) { return ref.id; });
      },
      // Через адаптер пачка йде одним проходом і оновлює стан один раз.
      // Без bulkAdd кожен рядок коштував би запис плюс повне вичитування.
      bulkAdd: function (c, rows) {
        var list = (rows || []).map(function (row) {
          var o = Object.assign({}, row);
          delete o.id;
          if (!o.createdAt) o.createdAt = new Date().toISOString();
          return o;
        });
        if (typeof db.bulkAdd === "function") return db.bulkAdd(c, list);
        return list.reduce(function (chain, row) {
          return chain.then(function () { return db.collection(c).add(row); });
        }, Promise.resolve()).then(function () { return { added: list.length, failed: 0 }; });
      },
      update: function (c, id, patch) { return db.collection(c).doc(id).update(patch); },
        remove: function (c, id) { return db.collection(c).doc(id).delete(); },
        exportAll: function () { return db.exportAll(); },
        deleteAccount: function (payload) { return db.deleteAccount(payload); },
        saveSettings: function (s) {
          settingsCache = Object.assign({}, settingsCache, s);
          return db.doc("settings/main").set(settingsCache);
      },
      replaceAll: function (payload) {
        var jobs = [];
        COLLECTIONS.forEach(function (c) {
          state[c].forEach(function (row) { jobs.push(db.collection(c).doc(row.id).delete()); });
        });
        return Promise.all(jobs).then(function () {
          var adds = [];
          COLLECTIONS.forEach(function (c) {
            (payload[c] || []).forEach(function (row) {
              var o = Object.assign({}, row); var id = o.id; delete o.id;
              adds.push(id ? db.collection(c).doc(id).set(o) : db.collection(c).add(o));
            });
          });
          adds.push(db.doc("settings/main").set(Object.assign(defaultSettings(), payload.settings || {})));
          return Promise.all(adds);
        });
      }
    };
  }

  function setSync(mode) {
    var dot = document.getElementById("syncDot");
    var txt = document.getElementById("syncText");
    if (!dot) return;
    dot.classList.remove("offline", "warn");
    if (mode === "online") { txt.textContent = "Синхронізовано"; }
    else if (mode === "local") { dot.classList.add("offline"); txt.textContent = "Офлайн"; }
    else { dot.classList.add("warn"); txt.textContent = "Перепідключення…"; }
  }

  /* ============================ derived data ============================ */

  function isExpense(t) { return t.type === "expense" && !t.pending; }
  function isIncome(t) { return t.type === "income" && !t.pending; }
  function isTransfer(t) { return t.type === "transfer"; }
  // One render pass asks for the same month a dozen times over (stats, donut,
  // trend, ticker, delta...). Slice once per pass instead of re-filtering the
  // whole journal each time.
  var monthCache = Object.create(null);
  function dropMonthCache() { monthCache = Object.create(null); }
  function monthTx(mk) {
    var hit = monthCache[mk];
    if (hit) return hit;
    hit = state.transactions.filter(function (t) { return !t.pending && monthKey(t.date) === mk; });
    monthCache[mk] = hit;
    return hit;
  }
  function sum(list, pick) {
    return list.reduce(function (s, t) { return s + (pick ? pick(t) : t.amount); }, 0);
  }
  // Transfers move money between wallets: never income, never expense.
  function totalBalance() {
    return state.transactions.reduce(function (s, t) {
      if (isIncome(t)) return s + t.amount;
      if (isExpense(t)) return s - t.amount;
      return s;
    }, 0) - totalNavar();
  }
  function walletBalance(w) {
    return state.transactions.reduce(function (s, t) {
      if (isIncome(t) && t.wallet === w) return s + t.amount;
      if (isExpense(t) && t.wallet === w) return s - t.amount;
      if (isTransfer(t)) {
        if (t.wallet === w) return s - t.amount;
        if (t.toWallet === w) return s + t.amount;
      }
      return s;
    }, 0);
  }

  // Every recurring charge still to fall between today and the next payday.
  function pendingRecurring(fromISO, toISO) {
    var out = [];
    state.recurring.forEach(function (r) {
      if (r.active === false) return;
      var cur = fromISO;
      var guard = 0;
      while (dayDiff(cur, toISO) >= 0 && guard++ < 400) {
        var p = cur.split("-");
        var y = +p[0], m = +p[1];
        var dd = Math.min(Number(r.day) || 1, daysInMonth(y, m));
        var when = y + "-" + pad(m) + "-" + pad(dd);
        if (dayDiff(fromISO, when) >= 0 && dayDiff(when, toISO) >= 0 && !recurringPosted(r, monthKey(when))) {
          out.push({ rec: r, date: when });
        }
        var nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
        cur = ny + "-" + pad(nm) + "-01";
      }
    });
    out.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    return out;
  }
  function recurringPosted(r, mk) {
    var key = recKey(r.id, mk);
    // A charge the user deleted must not come back on the next open. Without
    // this the row reappeared every time the app started, and deleting it was
    // pointless.
    var skipped = settings().recSkip || [];
    if (skipped.indexOf(key) >= 0) return true;
    return state.transactions.some(function (t) { return t.id === key || t.recKey === key; });
  }
  function recKey(id, mk) { return "rec." + id + "." + mk.replace("-", "_"); }

  // ЗЕРКАЛО: server/allowance.js — міняєш тут, міняй і там
  function allowance() {
    var today = todayISO();
    var currentMk = monthKey(today);
    var currentMonthEnd = isoAdd(monthStart(addMonths(currentMk, 1)), -1);
    var viewIsCurrent = state.viewMonth === currentMk;
    var s = settings();
    var enabled = !!s.allowanceEnabled;
    var hasPlan = s.weekBudget > 0 || s.weekReserve > 0 || sumWeekDaily(s.weekDaily) > 0;
    var spentToday = 0, spentBeforeToday = 0, monthSpent = 0, weekSpent = 0, reserveSpent = 0;
    var reserveFrom = weekStart(today);
    var reserveTo = weekEnd(today);
    var reserveStart = reserveFrom < monthStart(currentMk) ? monthStart(currentMk) : reserveFrom;
    state.transactions.forEach(function (t) {
      if (t.pending) return;
      if (!isExpense(t)) return;
      if (monthKey(t.date) === currentMk) monthSpent += t.amount;
      if (inRange(t.date, reserveFrom, reserveTo) && !t.reserve) weekSpent += t.amount;
      if (monthKey(t.date) !== currentMk) return;
      if (t.reserve) {
        if (inRange(t.date, reserveStart, reserveTo)) reserveSpent += t.amount;
        return;
      }
      if (t.date < today) spentBeforeToday += t.amount;
      else if (t.date === today) spentToday += t.amount;
    });
    var planThroughToday = 0;
    for (var d = monthStart(currentMk); d <= today; d = isoAdd(d, 1)) planThroughToday += plannedForDay(d);
    var todayLimit = round2(planThroughToday - spentBeforeToday);
    var todayAvailable = round2(todayLimit - spentToday);
    var weekPlanThroughToday = 0;
    for (var wd = reserveFrom; wd <= today; wd = isoAdd(wd, 1)) weekPlanThroughToday += plannedForDay(wd);
    var weekAvailable = round2(weekPlanThroughToday - weekSpent);
    var monthPlan = 0;
    for (var md = monthStart(currentMk); md <= currentMonthEnd; md = isoAdd(md, 1)) monthPlan += plannedForDay(md);
    var monthAvailable = round2(monthPlan - monthSpent);
    var tomorrow = isoAdd(today, 1);
    var tomorrowAvailable = null;
    if (monthKey(tomorrow) === currentMk) tomorrowAvailable = round2(todayAvailable + plannedForDay(tomorrow));
    return {
      active: viewIsCurrent,
      enabled: enabled,
      configured: enabled && hasPlan,
      today: today,
      todayPlanned: plannedForDay(today),
      todayLimit: todayLimit,
      todayAvailable: todayAvailable,
      weekAvailable: weekAvailable,
      weekPlanThroughToday: round2(weekPlanThroughToday),
      monthAvailable: monthAvailable,
      monthSpent: round2(monthSpent),
      monthPlan: round2(monthPlan),
      tomorrowAvailable: tomorrowAvailable,
      spentToday: spentToday,
      overBy: Math.max(0, round2(-todayAvailable)),
      reserveSpent: round2(reserveSpent),
      reserveLeft: round2(s.weekReserve - reserveSpent),
      weekPlan: round2(sumWeekDaily(s.weekDaily)),
      weekBudget: round2(s.weekBudget),
      weekReserve: round2(s.weekReserve),
      weekGap: round2(s.weekBudget - (sumWeekDaily(s.weekDaily) + s.weekReserve))
    };
  }

  function weekForecast() {
    var today = todayISO();
    var currentMk = monthKey(today);
    var start = weekStart(today);
    var end = weekEnd(today);
    var currentMonthEnd = monthStart(addMonths(currentMk, 1));
    var items = [];
    var carry = 0;
    var reserveSpent = 0;
    var reserveTotal = Math.max(0, round2(settings().weekReserve));
    var txByDay = {};
    monthTx(currentMk).forEach(function (t) {
      if (!isExpense(t)) return;
      if (!txByDay[t.date]) txByDay[t.date] = { regular: 0, reserve: 0 };
      if (t.reserve) txByDay[t.date].reserve += t.amount;
      else txByDay[t.date].regular += t.amount;
    });

    // Build the carry from the current month's start up to the week start.
    // The visible week may begin in the previous month, so it must not be
    // inferred from the number of items produced by this loop.
    for (var d = monthStart(currentMk); d < start; d = isoAdd(d, 1)) {
      if (d >= currentMonthEnd) carry = 0;
      var beforeWeekDay = txByDay[d] || { regular: 0, reserve: 0 };
      carry = round2(carry + plannedForDay(d) - beforeWeekDay.regular);
    }

    for (var d = start; d <= end; d = isoAdd(d, 1)) {
      var day = txByDay[d] || { regular: 0, reserve: 0 };
      var planned = plannedForDay(d);
      reserveSpent += day.reserve;
      var available = round2(carry + planned);
      var carryOut = round2(available - day.regular);
      var isPast = d < today;
      var isToday = d === today;
      items.push({
        date: d,
        planned: planned,
        spent: round2(day.regular),
        reserveSpent: round2(day.reserve),
        available: available,
        carryOut: carryOut,
        isPast: isPast,
        isToday: isToday,
        isFuture: d > today,
        inMonth: monthKey(d) === currentMk,
        ok: carryOut >= 0
      });
      carry = carryOut;
    }

    return {
      start: start,
      end: end,
      items: items.slice(0, 7),
      reserveSpent: round2(reserveSpent),
      reserveLeft: round2(reserveTotal - reserveSpent)
    };
  }

  function streak() {
    var days = {};
    state.transactions.forEach(function (t) { if (t.date) days[t.date] = true; });
    var today = todayISO();
    var cur = 0;
    var probe = days[today] ? today : (days[isoAdd(today, -1)] ? isoAdd(today, -1) : null);
    if (probe) { while (days[probe]) { cur++; probe = isoAdd(probe, -1); } }
    var best = 0, run = 0, all = Object.keys(days).sort();
    for (var i = 0; i < all.length; i++) {
      if (i > 0 && dayDiff(all[i - 1], all[i]) === 1) run++; else run = 1;
      if (run > best) best = run;
    }
    var record = Math.max(best, Number(settings().streakRecord) || 0);
    return { current: cur, record: record, todayLogged: !!days[today] };
  }

  /* ============================ rendering ============================ */

  function animateValue(el, from, to, formatFn, negClass) {
    if (!el) return;
    el.textContent = formatFn(to);
    if (negClass) el.classList.toggle("negative", to < 0);
  }

  function renderDashboardDate() {
    var now = new Date();
    var d = new Date(todayISO() + "T12:00:00");
    var weekday = document.getElementById("dashboardWeekday");
    var today = document.getElementById("dashboardToday");
    var greeting = document.getElementById("dashboardGreeting");
    if (weekday) weekday.textContent = d.toLocaleDateString("uk-UA", { weekday: "long" });
    if (today) today.textContent = d.toLocaleDateString("uk-UA", { day: "numeric", month: "long" });
    if (greeting) {
      var hour = now.getHours();
      if (hour >= 5 && hour < 12) greeting.textContent = "Доброго ранку";
      else if (hour >= 12 && hour < 18) greeting.textContent = "Доброго дня";
      else if (hour >= 18 && hour < 22) greeting.textContent = "Доброго вечора";
      else greeting.textContent = "Доброї ночі";
    }
  }

  var calendarDay = todayISO();
  function refreshCalendarDay() {
    var today = todayISO();
    if (today === calendarDay) {
      renderDashboardDate();
      return;
    }
    if (state.viewMonth === monthKey(calendarDay)) state.viewMonth = monthKey(today);
    calendarDay = today;
    renderAll();
  }

  function renderStats() {
    var balance = totalBalance();
    animateValue(document.getElementById("statBalance"), prevStat.balance, balance, fmt, true);
    prevStat.balance = balance;
    var cash = balance;
    var navarSum = totalNavar();
    document.getElementById("statBalanceSub").innerHTML =
      '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>Кеш ' + esc(fmtShort(cash)) + '</span>' +
      '<span class="split-chip"><i style="background:' + css("--gold") + '"></i>Заощадження ' + esc(fmtShort(navarSum)) + '</span>';

    var actual = monthActuals(state.viewMonth);
    var plannedIncome = plannedSalary(state.viewMonth);
    var income = plannedIncome > 0 ? Math.max(0, plannedIncome - actual.income) : actual.income;
    var expense = actual.expense;
    animateValue(document.getElementById("statIncome"), prevStat.income, income, fmt);
    animateValue(document.getElementById("statIncomeFact"), null, actual.income, fmt);
    animateValue(document.getElementById("statExpense"), prevStat.expense, expense, fmt);
    prevStat.income = income; prevStat.expense = expense;

    var projectedCarry = monthProjectedCarry(state.viewMonth);
    var savEl = document.getElementById("statSavings");
    if (savEl) {
      animateValue(savEl, prevStat.savings, navarSum, fmt, true);
      savEl.className = "cell-value money" + (navarSum > 0 ? " positive" : "");
    }
    prevStat.savings = navarSum;

    var inCash = actual.income;
    document.getElementById("statIncomeSub").innerHTML =
      plannedIncome > 0
        ? '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>' + esc(payoutLabel(state.viewMonth)) + ' · очікується</span>'
        : '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>факт ' + esc(fmtShort(inCash)) + '</span>';
    document.getElementById("statIncomeFactSub").textContent = plannedIncome > 0 ? "усі приходи за місяць" : "фактичні надходження";
    document.getElementById("statExpenseSub").textContent = monthTx(state.viewMonth).filter(isExpense).length + " списань";
    var savSub = document.getElementById("statSavingsSub");
    if (savSub) savSub.textContent =
      projectedCarry > 0 ? "цього місяця піде " + fmtShort(projectedCarry) : "цього місяця переносу поки нема";

    var months = [];
    for (var i = 5; i >= 0; i--) months.push(addMonths(monthKey(todayISO()), -i));
    var running = 0;
    state.transactions.forEach(function (t) {
      if (monthKey(t.date) < months[0]) running += isIncome(t) ? t.amount : isExpense(t) ? -t.amount : 0;
    });
    var pts = months.map(function (mk) {
      running += monthTx(mk).reduce(function (s, t) { return s + (isIncome(t) ? t.amount : isExpense(t) ? -t.amount : 0); }, 0);
      return running - navarDeductedByMonth(mk);
    });
    drawSpark(pts);
  }

  function drawSpark(pts) {
    var svg = document.getElementById("statSpark");
    if (!svg) return;
    var w = 160, h = 26;
    var min = Math.min.apply(null, pts), max = Math.max.apply(null, pts);
    if (min === max) { min -= 1; max += 1; }
    var n = pts.length;
    var coords = pts.map(function (v, i) {
      var x = n === 1 ? w / 2 : (i / (n - 1)) * w;
      var y = h - ((v - min) / (max - min)) * h;
      return x.toFixed(1) + "," + Math.max(2, Math.min(h - 2, y)).toFixed(1);
    });
    var last = coords[coords.length - 1].split(",");
    svg.innerHTML =
      '<polyline points="' + coords.join(" ") + '" fill="none" stroke="' + css("--gold") + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />' +
      '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="2.6" fill="' + css("--gold-hi") + '" />';
  }

  function renderAllowance() {
    var a = allowance();
    var card = document.getElementById("allowanceCard");
    var bento = card ? card.closest(".bento") : null;
    var show = state.view === "main" && a.active && a.enabled;
    if (card) card.hidden = !show;
    if (bento) bento.dataset.allowance = show ? "on" : "off";
    if (!show) return;
    var el = document.getElementById("allowanceValue");
    var visible = a.active && a.configured ? Math.max(0, a.weekAvailable) : 0;
    animateValue(el, prevStat.allowance, visible, fmt, true);
    prevStat.allowance = visible;
    if (!a.active) {
      document.getElementById("allowanceBasis").textContent = "лише для поточного місяця";
      document.getElementById("allowanceSpentToday").textContent = "Перемкнись на поточний місяць";
      document.getElementById("allowanceHint").textContent = "архів не тягне денний прогноз";
      document.getElementById("allowanceBar").style.width = "0%";
      document.getElementById("allowanceBar").classList.remove("over");
      card.classList.remove("over", "under");
      return;
    }
    if (!a.enabled) {
      document.getElementById("allowanceBasis").textContent = "прогноз вимкнено";
      document.getElementById("allowanceSpentToday").textContent = "Увімкни функцію в налаштуваннях";
      document.getElementById("allowanceHint").textContent = "після цього денний ліміт почне рахуватись";
      document.getElementById("allowanceBar").style.width = "0%";
      document.getElementById("allowanceBar").classList.remove("over");
      card.classList.remove("over", "under");
      return;
    }
    if (!a.configured) {
      document.getElementById("allowanceBasis").textContent = "налаштуй тиждень";
      document.getElementById("allowanceSpentToday").textContent = "Прогноз поки не задано";
      document.getElementById("allowanceHint").textContent = "додай денні суми та резерв у налаштуваннях";
      document.getElementById("allowanceBar").style.width = "0%";
      document.getElementById("allowanceBar").classList.remove("over");
      card.classList.remove("over", "under");
      return;
    }
    document.getElementById("allowanceBasis").textContent =
      "тижневий залишок";
    document.getElementById("allowanceSpentToday").textContent = "Сьогодні витрачено " + fmtShort(a.spentToday);
    var over = a.todayAvailable < 0;
    card.classList.toggle("over", over);
    card.classList.toggle("under", !over && a.todayLimit > 0);
    document.getElementById("allowanceHint").textContent =
      over
        ? "переліміт " + fmtShort(a.overBy) + (a.tomorrowAvailable == null ? "" : " · завтра " + fmtShort(Math.max(0, a.tomorrowAvailable)))
        : "до кінця дня лишається " + fmtShort(visible);
    var pct = a.todayLimit > 0 ? Math.min(100, (a.spentToday / a.todayLimit) * 100) : 100;
    document.getElementById("allowanceBar").style.width = pct + "%";
    document.getElementById("allowanceBar").classList.toggle("over", over);
  }

  function renderWeekForecast() {
    var panel = document.getElementById("weekForecastPanel");
    var meta = document.getElementById("weekForecastMeta");
    var grid = document.getElementById("weekForecastGrid");
    if (!panel || !meta || !grid) return;
    var a = allowance();
    var currentMk = monthKey(todayISO());
    var show = state.view === "main" && state.viewMonth === currentMk && a.enabled;
    panel.hidden = !show;
    if (!show) return;

    var week = weekForecast();
    meta.textContent =
      week.start.split("-").reverse().slice(0, 2).join(".") + " — " +
      week.end.split("-").reverse().slice(0, 2).join(".") +
      " · резерв " + fmtShort(Math.max(0, week.reserveLeft));

    grid.innerHTML = week.items.map(function (item) {
      var statusClass = (item.isFuture || item.isToday) ? "pending" : item.ok ? "ok" : "bad";
      var statusMark = (item.isFuture || item.isToday) ? "·" : item.ok ? "✓" : "✕";
      var dayLabel = new Date(item.date + "T00:00:00").toLocaleDateString("uk-UA", { weekday: "short" });
      var dateLabel = item.date.slice(8) + "." + item.date.slice(5, 7);
      var carryLabel = item.isFuture ? "старт " + fmtShort(Math.max(0, item.available)) : "далі " + fmtShort(Math.max(0, item.carryOut));
      var spentCls = item.isFuture ? "" : item.ok ? "ok" : "bad";
      return '<article class="week-day' + (item.isToday ? ' is-today' : '') + (!item.inMonth ? ' is-out' : '') + '">' +
        '<div class="week-day-top"><span class="week-day-name">' + esc(dayLabel.replace(".", "").toUpperCase()) + '</span>' +
        '<span class="week-day-date">' + esc(dateLabel) + '</span>' +
        '<span class="week-day-status ' + statusClass + '">' + statusMark + '</span></div>' +
        '<div class="week-day-money">' + esc(fmtShort(item.planned)) + '</div>' +
        '<div class="week-day-lines">' +
        '<span>факт <b class="' + spentCls + '">' + esc(fmtShort(item.spent)) + '</b></span>' +
        (item.reserveSpent > 0 ? '<span>резерв ' + esc(fmtShort(item.reserveSpent)) + '</span>' : '<span>' + esc(carryLabel) + '</span>') +
        '</div></article>';
    }).join("");
  }

  function renderBudgets() {
    var wrap = document.getElementById("budgetList");
    if (!wrap) return;
    wrap.innerHTML = "";
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var spent = {};
    mtx.forEach(function (t) { spent[t.category] = (spent[t.category] || 0) + t.amount; });
    var budgets = settings().budgets;
    expenseCatNames().forEach(function (cat) {
      var limit = Number(budgets[cat]) || 0;
      var s = spent[cat] || 0;
      var pct = limit > 0 ? Math.min(100, (s / limit) * 100) : (s > 0 ? 100 : 0);
      var over = limit > 0 && s > limit;
      var color = colorFor("expense", cat);
      var row = document.createElement("div");
      row.className = "budget-row";
      row.innerHTML =
        '<span class="cat-dot" style="background:' + color + '"></span>' +
        '<div class="budget-main"><div class="budget-top">' +
        '<span class="budget-cat">' + esc(cat) + '</span>' +
        '<span class="budget-amounts' + (over ? " over" : "") + '">' + esc(fmtShort(s)) + (limit > 0 ? " / " + esc(fmtShort(limit)) : "") + '</span>' +
        '</div><div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:' + (over ? css("--negative") : color) + '"></div></div></div>' +
        '<input class="budget-input" type="text" inputmode="decimal" placeholder="0" value="' + esc(limit || "") + '" data-cat="' + esc(cat) + '" aria-label="Ліміт ' + esc(cat) + '" />';
      wrap.appendChild(row);
    });
    wrap.querySelectorAll(".budget-input").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var b = Object.assign({}, settings().budgets);
        var raw = String(inp.value).trim();
        if (!raw) { delete b[inp.dataset.cat]; }
        else {
          var p = parseAmount(raw);
          if (!p.ok) { showError("ліміт", p.msg); inp.focus(); return; }
          b[inp.dataset.cat] = p.value;
        }
        saveSettings({ budgets: b });
      });
    });
  }

  function renderDelta() {
    var wrap = document.getElementById("deltaList");
    if (!wrap) return;
    var cur = {}, prev = {};
    monthTx(state.viewMonth).filter(isExpense).forEach(function (t) { cur[t.category] = (cur[t.category] || 0) + t.amount; });
    monthTx(addMonths(state.viewMonth, -1)).filter(isExpense).forEach(function (t) { prev[t.category] = (prev[t.category] || 0) + t.amount; });
    var rows = expenseCatNames().map(function (c) {
      var a = cur[c] || 0, b = prev[c] || 0;
      var pct = b > 0 ? Math.round(((a - b) / b) * 100) : (a > 0 ? null : 0);
      return { cat: c, now: a, was: b, pct: pct };
    }).filter(function (r) { return r.now > 0 || r.was > 0; });
    if (!rows.length) { wrap.innerHTML = '<div class="empty-note">Нема з чим порівнювати.</div>'; return; }
    rows.sort(function (x, y) { return y.now - x.now; });
    wrap.innerHTML = rows.map(function (r) {
      var txt = r.pct === null ? "новий" : (r.pct > 0 ? "+" : "") + r.pct + "%";
      var cls = r.pct === null ? "neutral" : r.pct > 0 ? "worse" : r.pct < 0 ? "better" : "neutral";
      return '<div class="delta-row"><span class="cat-dot" style="background:' + colorFor("expense", r.cat) + '"></span>' +
        '<span class="delta-cat">' + esc(r.cat) + '</span>' +
        '<span class="delta-now">' + esc(fmtShort(r.now)) + '</span>' +
        '<span class="delta-pct ' + cls + '">' + esc(txt) + '</span></div>';
    }).join("");
  }

  function renderGoals() {
    var wrap = document.getElementById("goalsList");
    if (!wrap) return;
    var open = state.goals.filter(function (g) { return !g.closedAt; });
    var closed = state.goals.filter(function (g) { return g.closedAt; });
    wrap.innerHTML = "";
    if (!open.length) wrap.innerHTML = '<div class="empty-note">Ще немає цілей. Почніть з «Подушки безпеки».</div>';
    open.forEach(function (g) {
      var pct = g.target > 0 ? Math.min(100, ((g.current || 0) / g.target) * 100) : 0;
      var card = document.createElement("div");
      card.className = "goal-card";
      card.innerHTML =
        '<div class="goal-top"><span class="goal-name">' + esc(g.name) + '</span>' +
        (g.deadline ? '<span class="goal-deadline">до ' + esc(new Date(g.deadline).toLocaleDateString("uk-UA")) + '</span>' : '') +
        '<button class="icon-btn" type="button" data-del-goal="' + esc(g.id) + '" aria-label="Видалити ціль">✕</button></div>' +
        '<div class="bar-track"><div class="bar-fill gold" style="width:' + pct + '%"></div></div>' +
        '<div class="goal-nums"><span>' + esc(fmtShort(g.current || 0)) + ' з ' + esc(fmtShort(g.target)) + '</span><span>' + Math.round(pct) + '%</span></div>' +
        '<div class="goal-actions"><input type="text" inputmode="decimal" placeholder="Сума, ₴" data-add="' + esc(g.id) + '" aria-label="Поповнити" />' +
        '<button class="btn" type="button" data-contribute="' + esc(g.id) + '">Поповнити</button></div>';
      wrap.appendChild(card);
    });
    wrap.querySelectorAll("[data-del-goal]").forEach(function (b) {
      b.addEventListener("click", function () { store.remove("goals", b.dataset.delGoal).catch(function (e) { reportFailure("цілі", e); }); });
    });
    wrap.querySelectorAll("[data-contribute]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.contribute;
        var input = wrap.querySelector('[data-add="' + id + '"]');
        var p = parseAmount(input.value);
        if (!p.ok) { showError("цілі", p.msg); input.focus(); return; }
        var g = state.goals.find(function (x) { return x.id === id; });
        if (!g) return;
        var next = (g.current || 0) + p.value;
        var patch = { current: next };
        if (g.target > 0 && next >= g.target && !g.closedAt) {
          patch.closedAt = todayISO();
          celebrate(g.name);
        }
        store.update("goals", id, patch).catch(function (e) { reportFailure("цілі", e); });
        input.value = "";
      });
    });

    var hof = document.getElementById("hallOfFame");
    if (!hof) return;
    if (!closed.length) { hof.innerHTML = ""; return; }
    hof.innerHTML = '<div class="hof-title">Зал слави</div>' + closed.map(function (g) {
      return '<div class="hof-row"><span class="seal">✔</span><span class="hof-name">' + esc(g.name) + '</span>' +
        '<span class="hof-sum">' + esc(fmtShort(g.target)) + '</span>' +
        '<span class="hof-date">' + esc(g.closedAt) + '</span></div>';
    }).join("");
  }

  function celebrate(name) {
    showError("цілі", "Ціль «" + name + "» закрита.");
    var app = document.getElementById("app");
    app.classList.add("foil-sweep");
    setTimeout(function () { app.classList.remove("foil-sweep"); }, 1600);
  }

  var donutDrawn = false;
  function renderDonut() {
    var wrap = document.getElementById("donutWrap");
    var tip = document.getElementById("chartTip");
    if (!wrap || !tip) return;
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var totals = {};
    mtx.forEach(function (t) { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    var entries = expenseCatNames().map(function (c) { return { cat: c, amt: totals[c] || 0 }; })
      .filter(function (e) { return e.amt > 0; });
    var total = entries.reduce(function (s, e) { return s + e.amt; }, 0);
    document.getElementById("donutNote").textContent = entries.length ? entries.length + " статей" : "поки чисто";
    if (!total) { wrap.innerHTML = '<div class="empty-note">У цьому місяці ще нічого не спущено.</div>'; return; }
    var R = 54, C = 2 * Math.PI * R, offset = 0;
    var segs = entries.map(function (e) {
      var frac = e.amt / total, len = frac * C;
      var s = '<circle class="donut-seg" r="' + R + '" cx="70" cy="70" fill="none" stroke="' + colorFor("expense", e.cat) + '"' +
        ' stroke-width="18" stroke-dasharray="' + len.toFixed(2) + ' ' + (C - len).toFixed(2) + '"' +
        ' stroke-dashoffset="' + (-offset).toFixed(2) + '" data-cat="' + esc(e.cat) + '" data-amt="' + e.amt + '" data-pct="' + Math.round(frac * 100) + '"></circle>';
      offset += len;
      return s;
    }).join("");
    wrap.innerHTML =
      '<div class="donut-box"><svg viewBox="0 0 140 140" class="donut' +
      (donutDrawn || state.settings.calmMode ? '' : ' drawing') + '">' + segs + '</svg>' +
      '<div class="donut-center"><span class="donut-total money">' + esc(fmtShort(total)) + '</span><span class="donut-cap">всього</span></div></div>' +
      '<div class="legend">' + entries.map(function (e) {
        return '<div class="legend-row" data-cat="' + esc(e.cat) + '"><span class="cat-dot" style="background:' + colorFor("expense", e.cat) + '"></span>' +
          '<span class="legend-cat">' + esc(e.cat) + '</span><span class="legend-amt">' + esc(fmtShort(e.amt)) + '</span>' +
          '<span class="legend-pct">' + Math.round((e.amt / total) * 100) + '%</span></div>';
      }).join("") + '</div>';
    donutDrawn = true;
    wrap.querySelectorAll(".donut-seg").forEach(function (seg) {
      seg.addEventListener("mousemove", function (ev) {
        tip.innerHTML = '<strong>' + esc(seg.dataset.cat) + '</strong><br>' + esc(fmtShort(Number(seg.dataset.amt))) + ' · ' + esc(seg.dataset.pct) + '%';
        tip.style.left = ev.clientX + "px"; tip.style.top = (ev.clientY - 8) + "px";
        tip.classList.add("show");
      });
      seg.addEventListener("mouseleave", function () { tip.classList.remove("show"); });
    });
  }

  function renderTrend() {
    var wrap = document.getElementById("trendWrap");
    var months = [];
    for (var i = 5; i >= 0; i--) months.push(addMonths(monthKey(todayISO()), -i));
    var rows = months.map(function (mk) {
      var mt = monthTx(mk);
      return { mk: mk, inc: sum(mt.filter(isIncome)), exp: sum(mt.filter(isExpense)) };
    });
    var max = Math.max(1, Math.max.apply(null, rows.map(function (r) { return Math.max(r.inc, r.exp); })));
    document.getElementById("trendLegend").innerHTML =
      '<span class="split-chip"><i style="background:' + css("--positive") + '"></i>Заносять</span>' +
      '<span class="split-chip"><i style="background:' + css("--negative") + '"></i>Витрати</span>';
    var W = 320, H = 130, gap = W / rows.length;
    wrap.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + (H + 20) + '" class="trend" preserveAspectRatio="none">' +
      rows.map(function (r, i) {
        var x = i * gap + gap * 0.18, bw = gap * 0.28;
        var hi = (r.inc / max) * H, he = (r.exp / max) * H;
        return '<rect x="' + x.toFixed(1) + '" y="' + (H - hi).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + hi.toFixed(1) + '" fill="' + css("--positive") + '" rx="1.5"></rect>' +
          '<rect x="' + (x + bw + 2).toFixed(1) + '" y="' + (H - he).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + he.toFixed(1) + '" fill="' + css("--negative") + '" rx="1.5"></rect>' +
          '<text x="' + (x + bw).toFixed(1) + '" y="' + (H + 14) + '" class="trend-label" text-anchor="middle">' + esc(monthShort(r.mk)) + '</text>';
      }).join("") + '</svg>';
  }

  function renderUpcoming() {
    var wrap = document.getElementById("upcomingList");
    var note = document.getElementById("upcomingNote");
    if (!wrap || !note) return;
    var today = todayISO();
    var p = today.split("-");
    var endOfMonth = p[0] + "-" + p[1] + "-" + pad(daysInMonth(+p[0], +p[1]));
    var list = pendingRecurring(today, endOfMonth);
    note.textContent = list.length ? fmtShort(list.reduce(function (s, x) { return s + Number(x.rec.amount || 0); }, 0)) : "нічого";
    if (!list.length) { wrap.innerHTML = '<div class="empty-note">До кінця місяця списань нема.</div>'; return; }
    wrap.innerHTML = list.map(function (x) {
      return '<div class="upcoming-row"><span class="up-day">' + esc(x.date.slice(8)) + '.' + esc(x.date.slice(5, 7)) + '</span>' +
        '<span class="cat-dot" style="background:' + colorFor("expense", x.rec.category) + '"></span>' +
        '<span class="up-name">' + esc(x.rec.name) + '</span>' +
        '<span class="up-sum">' + esc(fmtShort(x.rec.amount)) + '</span></div>';
    }).join("");
  }

  function renderStreak() {
    var s = streak();
    if (s.record > (Number(settings().streakRecord) || 0)) saveSettings({ streakRecord: s.record });
    var el = document.getElementById("streakStrip");
    el.innerHTML =
      '<span class="streak-cur">Серія ' + s.current + '</span>' +
      '<span class="streak-rec">рекорд ' + s.record + '</span>';
  }

  var flipPending = false;
  function markFlip() { flipPending = true; }
  function filteredTx() {
    var list = monthTx(state.viewMonth);
    var f = state.filter;
    if (!f) return list;
    if (f.allMonths) list = state.transactions.filter(function (t) { return !t.pending; });
    return list.filter(function (t) {
      if (f.text && String(t.note || "").toLowerCase().indexOf(f.text.toLowerCase()) < 0 &&
        String(t.category || "").toLowerCase().indexOf(f.text.toLowerCase()) < 0) return false;
      if (f.cats && f.cats.length && f.cats.indexOf(t.category) < 0) return false;
      if (f.type && t.type !== f.type) return false;
      if (f.min != null && t.amount < f.min) return false;
      if (f.max != null && t.amount > f.max) return false;
      if (f.from && t.date < f.from) return false;
      if (f.to && t.date > f.to) return false;
      return true;
    });
  }

  function renderLedger() {
    document.getElementById("monthLabel").textContent = monthLabel(state.viewMonth);
    var body = document.getElementById("txBody");
    var summary = document.getElementById("ledgerSummary");
    // Rows slide to their new places instead of jumping — but only when the
    // filter actually changed. Measuring every row on every render made a
    // month switch cost ~75 ms with a full journal.
    var useFlip = false;
    flipPending = false;
    if (useFlip) window.__motion.flipCapture(body);
    var list = filteredTx().slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
    body.innerHTML = "";
    document.getElementById("txEmpty").hidden = list.length > 0;
    var note = document.getElementById("filterNote");
    if (state.filter) {
      var tot = list.filter(isExpense).reduce(function (s, t) { return s + t.amount; }, 0);
      note.hidden = false;
      note.textContent = "Фільтр: " + list.length + " операцій, витрат " + fmtShort(tot);
    } else note.hidden = true;
    if (summary) {
      var monthInc = sum(list.filter(isIncome));
      var monthExp = sum(list.filter(isExpense));
      summary.textContent = list.length
        ? list.length + " операцій · " + fmtShort(monthInc) + " вхід · " + fmtShort(monthExp) + " вихід"
        : "поки чисто, можна заносити перший рух";
    }

    list.forEach(function (t, i) {
      var tr = document.createElement("tr");
      tr.style.setProperty("--row-i", String(Math.min(i, 10)));
      if (t.id === lastAddedId) { tr.classList.add("just-added"); lastAddedId = null; }
      if (t.recKey) tr.classList.add("is-recurring");
      var d = new Date(t.date + "T00:00:00");
      var color = colorFor(t.type, t.category);
      var wal = t.reserve ? "Резерв" : "";
      var sign = isIncome(t) ? "+" : "−";
      var cls = isIncome(t) ? "amt-pos" : "amt-neg";
      tr.innerHTML =
        '<td class="date">' + esc(d.toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })) + '</td>' +
        '<td><div class="row-cat"><span class="cat-dot" style="background:' + color + '"></span>' + esc(t.category) +
        (t.recKey ? ' <span class="rec-flag">рег.</span>' : '') + '</div></td>' +
        '<td class="row-wallet">' + wal + '</td>' +
        '<td class="row-note">' + esc(t.note) + '</td>' +
        '<td class="num money ' + cls + '">' + sign + esc(fmt(t.amount)) + '</td>' +
        '<td class="actions"><button class="icon-btn" type="button" data-edit-tx="' + esc(t.id) + '" aria-label="Редагувати">✎</button>' +
        '<button class="icon-btn" type="button" data-del-tx="' + esc(t.id) + '" aria-label="Видалити">✕</button></td>';
      body.appendChild(tr);
    });
    body.querySelectorAll("[data-del-tx]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.delTx;
        var row = state.transactions.find(function (x) { return x.id === id; });
        if (row && row.recKey) {
          var skip = (settings().recSkip || []).slice();
          if (skip.indexOf(row.recKey) < 0) skip.push(row.recKey);
          // Keep the list from growing without bound; two years of monthly
          // charges is far more history than the check needs.
          if (skip.length > 240) skip = skip.slice(-240);
          saveSettings({ recSkip: skip });
        }
        var tr = b.closest("tr");
        if (tr) tr.classList.add("burning");
        setTimeout(function () {
          store.remove("transactions", id).catch(function (e) { reportFailure("журнал", e); });
        }, state.settings.calmMode ? 0 : 260);
      });
    });
    body.querySelectorAll("[data-edit-tx]").forEach(function (b) {
      b.addEventListener("click", function () { openEdit(b.dataset.editTx); });
    });
    if (useFlip && window.__motion.flipPlay) window.__motion.flipPlay();
  }

  /* -------- inline edit of an existing operation -------- */
  function openEdit(id) {
    var t = state.transactions.find(function (x) { return x.id === id; });
    if (!t) return;
    var tr = document.querySelector('[data-edit-tx="' + CSS.escape(id) + '"]').closest("tr");
    var cats = t.type === "income" ? INCOME_CATS : expenseCatNames();
    var editor = document.createElement("tr");
    editor.className = "edit-row";
    editor.innerHTML = '<td colspan="6"><form class="edit-form">' +
      '<input type="date" name="date" value="' + esc(t.date) + '" required aria-label="Дата" />' +
      ('<select name="category" aria-label="Стаття">' + cats.map(function (c) {
        return '<option' + (c === t.category ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join("") + '</select>') +
      '<input type="text" name="amount" inputmode="decimal" value="' + esc(t.amount) + '" required aria-label="Сума" />' +
      '<input type="text" name="note" maxlength="120" value="' + esc(t.note || "") + '" aria-label="Нотатка" />' +
      (t.type === "expense" ? '<label class="mini-check"><input type="checkbox" name="reserve"' + (t.reserve ? ' checked' : '') + ' />З резерву</label>' : '') +
      '<button class="btn-primary" type="submit">Зберегти</button>' +
      '<button class="btn" type="button" data-cancel>Скасувати</button></form></td>';
    tr.after(editor);
    editor.querySelector("[data-cancel]").addEventListener("click", function () { editor.remove(); });
    editor.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("amount"));
      if (!p.ok) { showError("журнал", p.msg); return; }
      var patch = { date: fd.get("date") || t.date, amount: p.value, note: String(fd.get("note") || "").trim(), wallet: "Кеш" };
      patch.category = fd.get("category") || t.category;
      if (t.type === "expense") patch.reserve = fd.get("reserve") === "on";
      editor.remove();
      store.update("transactions", id, patch).catch(function (e) { reportFailure("журнал", e); });
    });
  }

  /* -------- year screen -------- */
  function renderYear() {
    if (state.view !== "year") return;
    document.getElementById("yearLabel").textContent = state.viewYear;
    var yearTx = state.transactions.filter(function (t) { return yearOf(t.date) === String(state.viewYear); });
    var inc = sum(yearTx.filter(isIncome)), exp = sum(yearTx.filter(isExpense));
    var navarYear = navarHistory().filter(function (row) { return yearOf(row.month) === String(state.viewYear); })
      .reduce(function (s, row) { return s + row.amount; }, 0);
    document.getElementById("yearTotals").innerHTML =
      '<div class="cell" data-help-key="year-income"><span class="cell-label">Заносять</span><span class="cell-value positive money">' + esc(fmt(inc)) + '</span></div>' +
      '<div class="cell" data-help-key="year-expense"><span class="cell-label">Витрати</span><span class="cell-value negative money">' + esc(fmt(exp)) + '</span></div>' +
      '<div class="cell" data-help-key="year-navar"><span class="cell-label">Заощадження</span><span class="cell-value money">' + esc(fmt(navarYear)) + '</span></div>' +
      '<div class="cell" data-help-key="year-net"><span class="cell-label">Чистими</span><span class="cell-value money">' + esc(fmt(inc - exp)) + '</span></div>';

    var months = [];
    for (var m = 1; m <= 12; m++) months.push(state.viewYear + "-" + pad(m));
    var head = '<tr><th>Стаття</th>' + months.map(function (mk) { return '<th class="num">' + esc(monthShort(mk)) + '</th>'; }).join("") + '<th class="num">Разом</th></tr>';
    var rows = expenseCatNames().map(function (cat) {
      var cells = months.map(function (mk) {
        return monthTx(mk).filter(function (t) { return isExpense(t) && t.category === cat; }).reduce(function (s, t) { return s + t.amount; }, 0);
      });
      var tot = cells.reduce(function (s, v) { return s + v; }, 0);
      return { cat: cat, cells: cells, tot: tot };
    }).filter(function (r) { return r.tot > 0; });
    if (!rows.length) { document.getElementById("yearTable").innerHTML = '<div class="empty-note">За цей рік витрат нема.</div>'; return; }
    rows.sort(function (a, b) { return b.tot - a.tot; });
    var maxTot = rows[0].tot;
    var body = rows.map(function (r, i) {
      return '<tr class="year-row" style="--i:' + i + '"><td><span class="cat-dot" style="background:' + colorFor("expense", r.cat) + '"></span>' + esc(r.cat) + '</td>' +
        r.cells.map(function (v) { return '<td class="num">' + (v ? esc(fmtShort(v)) : '<span class="zero">—</span>') + '</td>'; }).join("") +
        '<td class="num strong"><span class="year-bar" style="width:' + Math.round((r.tot / maxTot) * 100) + '%"></span>' + esc(fmtShort(r.tot)) + '</td></tr>';
    }).join("");
    document.getElementById("yearTable").innerHTML =
      '<div class="table-wrap"><table class="year-table"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>';
  }

  /* -------- plan screen -------- */
  function renderRecurring() {
    if (state.view !== "plan") return;
    var wrap = document.getElementById("recList");
    if (!state.recurring.length) { wrap.innerHTML = '<div class="empty-note">Регулярних платежів нема.</div>'; return; }
    wrap.innerHTML = state.recurring.map(function (r) {
      return '<div class="rec-row' + (r.active === false ? ' off' : '') + '">' +
        '<span class="cat-dot" style="background:' + colorFor("expense", r.category) + '"></span>' +
        '<span class="rec-name">' + esc(r.name) + '</span>' +
        '<span class="rec-day">' + esc(r.day) + ' числа</span>' +
        '<span class="rec-wallet">' + esc(r.wallet) + '</span>' +
        '<span class="rec-sum">' + esc(fmtShort(r.amount)) + '</span>' +
        '<button class="icon-btn" type="button" data-toggle-rec="' + esc(r.id) + '" aria-label="Увімк/вимк">' + (r.active === false ? '▷' : '❚❚') + '</button>' +
        '<button class="icon-btn" type="button" data-del-rec="' + esc(r.id) + '" aria-label="Видалити">✕</button></div>';
    }).join("");
    wrap.querySelectorAll("[data-del-rec]").forEach(function (b) {
      b.addEventListener("click", function () { store.remove("recurring", b.dataset.delRec).catch(function (e) { reportFailure("регулярні", e); }); });
    });
    wrap.querySelectorAll("[data-toggle-rec]").forEach(function (b) {
      b.addEventListener("click", function () {
        var r = state.recurring.find(function (x) { return x.id === b.dataset.toggleRec; });
        store.update("recurring", r.id, { active: r.active === false }).catch(function (e) { reportFailure("регулярні", e); });
      });
    });
  }

  function renderAmortize() {
    if (state.view !== "plan") return;
    var wrap = document.getElementById("amList");
    if (!state.amortize.length) { wrap.innerHTML = '<div class="empty-note">Нічого не амортизуємо.</div>'; return; }
    var today = todayISO();
    wrap.innerHTML = state.amortize.map(function (a) {
      var months = Math.max(1, Number(a.months) || 1);
      var per = a.amount / months;
      var start = (a.startDate || String(a.createdAt || today)).slice(0, 10);
      var elapsed = Math.max(0, Math.min(months, Math.floor(dayDiff(start, today) / 30.4)));
      var saved = Math.min(a.amount, per * elapsed);
      var pct = Math.min(100, (saved / a.amount) * 100);
      return '<div class="am-row"><div class="am-top"><span class="am-name">' + esc(a.name) + '</span>' +
        '<span class="am-per">' + esc(fmtShort(per)) + ' / міс.</span>' +
        '<button class="icon-btn" type="button" data-reset-am="' + esc(a.id) + '" aria-label="Почати цикл заново">⟲</button>' +
        '<button class="icon-btn" type="button" data-del-am="' + esc(a.id) + '" aria-label="Видалити">✕</button></div>' +
        '<div class="bar-track"><div class="bar-fill gold" style="width:' + pct + '%"></div></div>' +
        '<div class="am-nums"><span>накопичено ' + esc(fmtShort(saved)) + ' з ' + esc(fmtShort(a.amount)) + '</span>' +
        '<span>' + elapsed + '/' + months + ' міс.</span></div></div>';
    }).join("");
    wrap.querySelectorAll("[data-del-am]").forEach(function (b) {
      b.addEventListener("click", function () { store.remove("amortize", b.dataset.delAm).catch(function (e) { reportFailure("амортизація", e); }); });
    });
    wrap.querySelectorAll("[data-reset-am]").forEach(function (b) {
      b.addEventListener("click", function () { store.update("amortize", b.dataset.resetAm, { startDate: todayISO() }).catch(function (e) { reportFailure("амортизація", e); }); });
    });
  }

  function renderDebts() {
    if (state.view !== "plan") return;
    var wrap = document.getElementById("debtList");
    var open = state.debts.filter(function (d) { return !d.settled; });
    if (!state.debts.length) { wrap.innerHTML = '<div class="empty-note">Боргів немає.</div>'; return; }
    var lent = open.filter(function (d) { return d.direction === "lent"; }).reduce(function (s, d) { return s + d.amount; }, 0);
    var borrowed = open.filter(function (d) { return d.direction === "borrowed"; }).reduce(function (s, d) { return s + d.amount; }, 0);
    wrap.innerHTML = '<div class="debt-summary"><span>Мені винні ' + esc(fmtShort(lent)) + '</span><span>Я винен ' + esc(fmtShort(borrowed)) + '</span></div>' +
      state.debts.map(function (d) {
        return '<div class="debt-row' + (d.settled ? ' settled' : '') + '">' +
          '<span class="debt-dir ' + esc(d.direction) + '">' + (d.direction === "lent" ? "→" : "←") + '</span>' +
          '<span class="debt-person">' + esc(d.person) + '</span>' +
          '<span class="debt-sum">' + esc(fmtShort(d.amount)) + '</span>' +
          '<span class="debt-due">' + esc(d.due || "") + '</span>' +
          '<button class="icon-btn" type="button" data-settle="' + esc(d.id) + '" aria-label="Закрити борг">' + (d.settled ? '↺' : '✔') + '</button>' +
          '<button class="icon-btn" type="button" data-del-debt="' + esc(d.id) + '" aria-label="Видалити">✕</button></div>';
      }).join("");
    wrap.querySelectorAll("[data-del-debt]").forEach(function (b) {
      b.addEventListener("click", function () { store.remove("debts", b.dataset.delDebt).catch(function (e) { reportFailure("борги", e); }); });
    });
    wrap.querySelectorAll("[data-settle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var d = state.debts.find(function (x) { return x.id === b.dataset.settle; });
        store.update("debts", d.id, { settled: !d.settled }).catch(function (e) { reportFailure("борги", e); });
      });
    });
  }

  function renderRecords() {
    var box = document.getElementById("recordsBox");
    if (!box) return;
    box.innerHTML = "";
    box.hidden = true;
  }

  function renderSettings() {
    if (state.view !== "settings") return;
    var s = settings();
    var salaryNote = document.getElementById("salaryPlanNote");
    if (salaryNote) {
      if (s.salaryAmount > 0) {
        var days = salaryDaysForMonth(monthKey(todayISO()));
        var each = days.length ? round2(s.salaryAmount / days.length) : s.salaryAmount;
        salaryNote.textContent = days.length
          ? "Цього місяця " + days.length + " випл. · " + payoutLabel(monthKey(todayISO())) + " · орієнтир " + fmtShort(each) + " за раз"
          : "ЗП задана, але дні надходження ще не вказані.";
      } else salaryNote.textContent = "Місячна ЗП поки не задана.";
    }
    var salaryDaysList = document.getElementById("salaryDaysList");
    if (salaryDaysList) salaryDaysList.querySelectorAll("[data-salary-day]").forEach(function (input) {
      input.onchange = function () {
        var days = Array.prototype.slice.call(salaryDaysList.querySelectorAll("[data-salary-day]"))
          .map(function (el) { return Number(String(el.value).slice(8, 10)); }).filter(function (d) { return d >= 1 && d <= 31; });
        if (days.length) { saveSettings({ salaryDays: days.slice(0, 6) }); renderAll(); }
      };
    });
    if (salaryDaysList) salaryDaysList.querySelectorAll("[data-remove-salary-day]").forEach(function (button) {
      button.onclick = function () {
        var days = settings().salaryDays.slice();
        var index = Number(button.dataset.removeSalaryDay);
        if (days.length <= 1) { showError("Місячний план", "Залиши хоча б одну дату виплати."); return; }
        days.splice(index, 1);
        saveSettings({ salaryDays: days });
        renderAll();
      };
    });

    var weekPlanStatus = document.getElementById("weekPlanStatus");
    if (weekPlanStatus) {
      var a = allowance();
      var planned = sumWeekDaily(s.weekDaily);
      var gap = round2(s.weekBudget - (planned + s.weekReserve));
      var parts = [
        "дні " + fmtShort(planned),
        "резерв " + fmtShort(s.weekReserve),
        "тиждень " + fmtShort(s.weekBudget)
      ];
      if (gap) parts.push((gap > 0 ? "не розкладено " : "перебір ") + fmtShort(Math.abs(gap)));
      parts.push("резерв лишився " + fmtShort(Math.max(0, a.reserveLeft)));
      if (!s.allowanceEnabled) parts.unshift("прогноз вимкнено");
      weekPlanStatus.textContent = parts.join(" · ");
    }

    var navarBox = document.getElementById("navarList");
    if (navarBox) {
      var rows = navarHistory().slice().sort(function (a, b) { return a.month < b.month ? 1 : -1; });
      if (!rows.length) navarBox.innerHTML = '<div class="empty-note">Ще нема місячних переносів.</div>';
      else navarBox.innerHTML = '<div class="hof-title">Історія</div>' + rows.map(function (row) {
        return '<div class="record-row"><span>' + esc(monthLabel(row.month)) + '</span><span>' + esc(fmtShort(row.amount)) + '</span></div>';
      }).join("");
    }
    var expenseNote = document.getElementById("expenseCategoryNote");
    if (expenseNote) expenseNote.textContent = expenseCatNames().length + " категорій · зміни по списку застосуються кнопкою знизу";
    renderExpenseCategorySettings();
  }

  function renderTicker() {
    var track = document.getElementById("tickerTrack");
    if (!track) return;
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var totals = {};
    mtx.forEach(function (t) { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    var parts = expenseCatNames().map(function (c) {
      var prev = monthTx(addMonths(state.viewMonth, -1)).filter(function (t) { return isExpense(t) && t.category === c; })
        .reduce(function (s, t) { return s + t.amount; }, 0);
      var now = totals[c] || 0;
      var d = prev > 0 ? Math.round(((now - prev) / prev) * 100) : null;
      return c.toUpperCase() + " " + Math.round(now) + (d === null ? "" : " " + (d > 0 ? "▲" : d < 0 ? "▼" : "=") + Math.abs(d) + "%");
    });
    var line = parts.join("   ·   ") + "   ·   ";
    track.textContent = line + line;
  }

  function renderAll() {
    dropMonthCache();
    var steps = [renderStats, renderAllowance, renderWeekForecast, renderBudgets, renderDonut,
      renderTrend, renderLedger, renderRecurring, renderAmortize,
      renderDebts, renderRecords, renderTicker, renderYear, renderPresets, renderSettings, syncSearchCats];
    steps.forEach(function (fn) {
      try { fn(); } catch (err) { console.error("[Копійка] помилка рендеру в " + fn.name + ":", err); }
    });
    if (window.__guilloche) { try { window.__guilloche.update(guillocheParams()); } catch (e) {} }
  }

  /* ============================ guilloche parameters ============================ */

  function guillocheParams() {
    var mtx = monthTx(state.viewMonth);
    var exp = mtx.filter(isExpense);
    var cats = {};
    exp.forEach(function (t) { cats[t.category] = true; });
    var petals = Math.max(3, Math.min(13, Object.keys(cats).length + 3));
    var budgets = settings().budgets;
    var pressure = 0, counted = 0;
    expenseCatNames().forEach(function (c) {
      var lim = Number(budgets[c]) || 0;
      if (!lim) return;
      var spent = exp.filter(function (t) { return t.category === c; }).reduce(function (s, t) { return s + t.amount; }, 0);
      pressure += Math.min(2, spent / lim); counted++;
    });
    pressure = counted ? pressure / counted : 0.35;
    var density = Math.max(24, Math.min(150, 24 + mtx.length * 2));
    var net = sum(mtx.filter(isIncome)) - sum(exp);
    return { petals: petals, amplitude: pressure, density: density, positive: net >= 0, over: pressure > 1 };
  }

  /* ============================ settings io ============================ */

  var settingsQueue = null;
  function saveSettings(patch) {
    state.settings = Object.assign({}, settings(), patch);
    applySettingsToUi();
    if (settingsQueue) clearTimeout(settingsQueue);
    settingsQueue = setTimeout(function () {
      settingsQueue = null;
      Promise.resolve(store.saveSettings(state.settings)).catch(function (e) { reportFailure("налаштування", e); });
    }, 120);
  }

  function applySettingsToUi() {
    var s = settings();
    document.documentElement.classList.toggle("calm", !!s.calmMode);
    syncExpenseCategoryControls();
    var ae = document.getElementById("allowanceEnabled");
    if (ae) ae.checked = !!s.allowanceEnabled;
    var spe = document.getElementById("salaryPlanEnabled");
    if (spe) spe.checked = !!s.salaryPlanEnabled;
    var sa = document.getElementById("salaryAmount");
    if (sa && document.activeElement !== sa) sa.value = s.salaryAmount ? String(s.salaryAmount) : "";
    var salaryDaysList = document.getElementById("salaryDaysList");
    if (salaryDaysList && document.activeElement && !salaryDaysList.contains(document.activeElement)) {
      var currentMonth = monthKey(todayISO());
      salaryDaysList.innerHTML = s.salaryDays.map(function (day, index) {
        var date = currentMonth + '-' + pad(day);
        var payment = s.salaryPayments.find(function (p) { return p.date === date; });
        var status = payment ? (payment.actual === 0 ? '✕ ' + fmtShort(payment.expected) : (Math.abs(payment.actual - payment.expected) < 0.01 ? '✓ ' : '● ') + fmtShort(payment.actual) + ' / ' + fmtShort(payment.expected)) : '';
        return '<label class="setting-row"><span>Виплата ' + (index + 1) + ' ' + status + '</span><input type="date" data-salary-day="' + index + '" value="' + date + '" /><button class="icon-btn" type="button" data-remove-salary-day="' + index + '" aria-label="Видалити виплату">✕</button></label>';
      }).join("");
    }
    var wb = document.getElementById("weekBudget");
    if (wb && document.activeElement !== wb) wb.value = s.weekBudget ? String(s.weekBudget) : "";
    var wr = document.getElementById("weekReserve");
    if (wr && document.activeElement !== wr) wr.value = s.weekReserve ? String(s.weekReserve) : "";
    document.querySelectorAll("[data-weekday]").forEach(function (inp) {
      var idx = Number(inp.dataset.weekday) || 0;
      if (document.activeElement === inp) return;
      inp.value = s.weekDaily[idx] ? String(s.weekDaily[idx]) : "";
    });
    var cm = document.getElementById("calmMode");
    if (cm) cm.checked = !!s.calmMode;
    var ps = document.getElementById("pinSet");
    if (ps && document.activeElement !== ps) ps.value = s.pin ? "••••" : "";
    var catColor = document.querySelector('#expenseCategoryForm input[name="color"]');
    if (catColor && document.activeElement !== catColor) {
      catColor.value = DEFAULT_EXPENSE_CATEGORY_ROWS[expenseCats().length % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color;
    }
  }

  /* ============================ presets & repeat ============================ */

  function renderPresets() {
    var row = document.getElementById("presetRow");
    var counts = {};
    state.transactions.filter(isExpense).slice(-400).forEach(function (t) {
      var k = t.category + "|" + t.amount + "|" + (t.wallet || "Кеш");
      counts[k] = (counts[k] || 0) + 1;
    });
    var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; }).slice(0, 6);
    if (!top.length) { row.innerHTML = ""; return; }
    row.innerHTML = top.map(function (k) {
      var p = k.split("|");
      return '<button class="preset" type="button" data-preset="' + esc(k) + '">' +
        '<span class="cat-dot" style="background:' + colorFor("expense", p[0]) + '"></span>' +
        esc(p[0]) + ' <b>' + esc(fmtShort(Number(p[1]))) + '</b></button>';
    }).join("");
    row.querySelectorAll("[data-preset]").forEach(function (b) {
      b.addEventListener("click", function () {
        var p = b.dataset.preset.split("|");
        commitTx({ type: "expense", category: p[0], amount: Number(p[1]), wallet: p[2], date: todayISO(), note: "" });
      });
    });
  }

  function repeatLast() {
    var last = state.transactions.slice().sort(function (a, b) {
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    })[0];
    if (!last) { showError("журнал", "Ще нема що повторювати."); return; }
    var copy = { type: last.type, category: last.category, amount: last.amount, wallet: "Кеш", date: todayISO(), note: last.note || "" };
    if (last.type === "expense") copy.reserve = !!last.reserve;
    
    commitTx(copy);
  }

  /* ============================ writes ============================ */

  // `silent` writes without moving the journal. Auto-posted recurring charges
  // are back-dated, and following them would yank the view to January the
  // first time the app opens after a break — the user did not ask to go there.
  function commitTx(payload, forcedId, silent) {
    if (!store) { showError("журнал", "база ще підключається — спробуй через секунду"); return Promise.resolve(); }
    if (!silent) {
      // The month must move BEFORE the write: a synchronous store re-renders
      // inside add(), and it has to draw the month the entry belongs to.
      var prev = state.viewMonth;
      state.viewMonth = monthKey(payload.date);
      if (prev !== state.viewMonth) renderAll();
    }
    return Promise.resolve(store.add("transactions", payload, forcedId)).then(function (id) {
      if (typeof id === "string" && !silent) { lastAddedId = id; stampAnimation(payload); }
      return id;
    }).catch(function (err) { reportFailure("журнал", err); });
  }

  function stampAnimation(payload) {
    if (state.settings.calmMode) return;
    var el = document.createElement("div");
    el.className = "stamp";
    el.textContent = payload.category;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 1100);
  }

  /* ============================ recurring auto-post ============================ */

  function postDueRecurring() {
    if (!store || !state.ready) return;
    var today = todayISO();
    state.recurring.forEach(function (r) {
      if (r.active === false) return;
      var startMk = monthKey(String(r.startFrom || r.createdAt || today).slice(0, 10));
      var mk = startMk;
      var guard = 0;
      while (mk <= monthKey(today) && guard++ < 240) {
        var p = mk.split("-");
        var dd = Math.min(Number(r.day) || 1, daysInMonth(+p[0], +p[1]));
        var when = p[0] + "-" + p[1] + "-" + pad(dd);
        if (dayDiff(when, today) >= 0 && !recurringPosted(r, mk)) {
          var key = recKey(r.id, mk);
          // Deterministic document id — opening the app twice, or on two
          // devices, writes the same id instead of a duplicate row.
          commitTx({
            type: "expense", category: r.category || defaultExpenseName(), amount: Number(r.amount) || 0,
            wallet: r.wallet || "Кеш", date: when, note: r.name, recKey: key, recId: r.id
          }, key, true);
        }
        mk = addMonths(mk, 1);
      }
    });
  }

  function syncNavarHistory() {
    var currentMk = monthKey(todayISO());
    var firstMk = null;
    state.transactions.forEach(function (t) {
      var mk = monthKey(t.date);
      if (!firstMk || mk < firstMk) firstMk = mk;
    });
    navarHistory().forEach(function (row) {
      if (!firstMk || row.month < firstMk) firstMk = row.month;
    });
    if (!firstMk || firstMk >= currentMk) return;
    var current = navarHistory();
    var seenMonths = {};
    current.forEach(function (row) { seenMonths[row.month] = true; });
    var additions = [];
    for (var mk = firstMk; mk < currentMk; mk = addMonths(mk, 1)) {
      if (seenMonths[mk]) continue;
      additions.push({
        id: "navar." + mk.replace("-", "_"),
        month: mk,
        amount: monthProjectedCarry(mk),
        createdAt: addMonths(mk, 1) + "-01T00:00:00.000Z"
      });
    }
    if (!additions.length) return;
    saveSettings({ navarHistory: current.concat(additions) });
  }

  /* ============================ migration ============================ */

  function runMigrations() {
    var s = settings();
    var patch = {};
    // Old rows carried the wallet in `category` for income and had none at all
    // for expenses.
    var needWallet = state.transactions.filter(function (t) { return !t.wallet || t.wallet !== "Кеш"; });
    if (needWallet.length) {
      needWallet.forEach(function (t) {
        var up = { wallet: "Кеш" };
        if (t.type === "income" && (t.category === "Карта" || t.category === "Кеш")) up.category = "ЗП";
        else if (t.type === "income" && INCOME_CATS.indexOf(t.category) < 0) up.category = "ЗП";
        store.update("transactions", t.id, up).catch(function () {});
      });
    }
    if (!s.migratedV3) patch.migratedV3 = true;
    if (!s.migratedV4) patch.migratedV4 = true;
    if (Object.keys(patch).length) saveSettings(patch);
    syncNavarHistory();
  }

  function askDueSalaryPayments() {
    var s = settings();
    if (!s.salaryPlanEnabled || !s.salaryAmount || !s.salaryDays.length || !store) return;
    var mk = monthKey(todayISO());
    var today = todayISO();
    var payments = Array.isArray(s.salaryPayments) ? s.salaryPayments.slice() : [];
    var pending = [];
    salaryDaysForMonth(mk).forEach(function (day) {
      var date = mk + "-" + pad(day);
      if (date > today || payments.some(function (p) { return p.date === date; })) return;
      pending.push({
        date: date,
        expected: round2(s.salaryAmount / s.salaryDays.length)
      });
    });
    if (!pending.length) return;

    function promptSalaryAmount(expected) {
      while (true) {
        var raw = window.prompt("Вкажи фактичну суму надходження", String(expected).replace(".", ","));
        if (raw == null) return null;
        var parsed = parseAmount(raw);
        if (parsed.ok) return parsed.value;
        showError("Місячний план", parsed.msg);
      }
    }

    var writes = [];
    pending.reduce(function (chain, item) {
      return chain.then(function () {
        return confirmBox("Чи відбулося надходження ЗП " + item.date.split("-").reverse().join(".") + "?");
      }).then(function (yes) {
        if (!yes) {
          payments.push({ date: item.date, expected: item.expected, actual: 0 });
          return;
        }
        var amount = promptSalaryAmount(item.expected);
        if (amount == null) return;
        amount = round2(amount);
        payments.push({ date: item.date, expected: item.expected, actual: amount });
        writes.push(commitTx({
          type: "income",
          category: "ЗП",
          amount: amount,
          wallet: "Кеш",
          date: item.date,
          note: "ЗП за " + item.date
        }, "salary." + item.date, true));
      });
    }, Promise.resolve()).then(function () {
      saveSettings({ salaryPayments: payments });
      return Promise.all(writes);
    }).then(function () {
      renderAll();
    }).catch(function (e) {
      console.error("[Копійка] зарплатний план:", e);
      showError("Місячний план", "Не вдалось завершити перевірку виплат.");
    });
  }

  // One-time lift of a localStorage-era journal into db, guarded against
  // running twice and against duplicating rows already there.
  var migrateWaited = 0;
  var seen = { transactions: false, settings: false };
  function migrateLocalToDb() {
    // Migration deduplicates against what is already in db. Running it before
    // the first snapshot arrives would compare against an empty journal and
    // import everything a second time, so wait for real data (or give up).
    if (!seen.transactions || !seen.settings) {
      if (migrateWaited > 12000) {
        console.warn("[Копійка] міграцію пропущено: снапшоти не дійшли вчасно");
        return;
      }
      migrateWaited += 400;
      setTimeout(migrateLocalToDb, 400);
      return;
    }
    var raw;
    try { raw = JSON.parse(localStorage.getItem(LS_KEY) || "null"); } catch (e) { return Promise.resolve(); }
    if (!raw || !Array.isArray(raw.transactions) || !raw.transactions.length) return Promise.resolve();
    if (settings().migratedFromLocal) return Promise.resolve();
    var have = {};
    state.transactions.forEach(function (t) { have[t.date + "|" + t.type + "|" + t.amount + "|" + (t.note || "")] = true; });
    var jobs = [];
    raw.transactions.forEach(function (t) {
      var k = t.date + "|" + t.type + "|" + t.amount + "|" + (t.note || "");
      if (have[k]) return;
      var o = Object.assign({}, t); delete o.id;
      jobs.push(store.add("transactions", o));
    });
    (raw.goals || []).forEach(function (g) { var o = Object.assign({}, g); delete o.id; jobs.push(store.add("goals", o)); });
    return Promise.all(jobs).then(function () {
      saveSettings(Object.assign({}, raw.settings || {}, settings(), {
        migratedFromLocal: true,
        budgets: Object.assign({}, (raw.settings && raw.settings.budgets) || {}, settings().budgets)
      }));
      if (jobs.length) showError("міграція", "Перенесено " + jobs.length + " записів у спільну базу.");
    }).catch(function (e) { console.error("[Копійка] міграція:", e); });
  }

  /* ============================ експорт CSV ============================ */

  function saveFile(filename, data) {
    if (!caps.downloads) { showError("копія", "Збереження файлів недоступне у цьому вікні."); return Promise.resolve(false); }
    return caps.downloads.save({ filename: filename, data: data }).then(function () {
      return true;
    }).catch(function (e) {
      if (e && e.code === "declined") { showError("копія", "Збереження скасовано."); }
      else if (e && e.code === "rate_limited") { showError("копія", "Зачекай секунду і спробуй ще."); }
      else { showError("копія", "Не вдалось зберегти (" + ((e && e.code) || "помилка") + ")."); }
      return false;
    });
  }

  function doCsv() {
    var head = ["Дата", "Тип", "Категорія", "Сума", "Гаманець", "Куди", "Нотатка"];
    function cell(v) {
      var s = String(v == null ? "" : v);
      return '"' + s.replace(/"/g, '""') + '"';
    }
    var typeName = { expense: "Витрата", income: "Дохід" };
    var rows = state.transactions.slice().sort(function (a, b) { return a.date < b.date ? -1 : 1; }).map(function (t) {
      return [t.date, typeName[t.type] || t.type, t.category,
        String(t.amount).replace(".", ","), t.wallet || "", t.toWallet || "", t.note || ""].map(cell).join(";");
    });
    // BOM + semicolons: Excel on a Ukrainian locale opens this straight.
    var csv = "﻿" + head.map(cell).join(";") + "\r\n" + rows.join("\r\n") + "\r\n";
    return saveFile("kopiyka-" + todayISO() + ".csv", csv);
  }

  function requestAccountDeletion() {
    if (!store || !store.deleteAccount) {
      showError("акаунт", "Видалення недоступне без підключеного сховища.");
      return;
    }
    confirmBox("Видалити акаунт і всі пов'язані дані без можливості відновлення?").then(function (ok) {
      if (!ok) return;
      var phrase = window.prompt('Щоб підтвердити, введи DELETE');
      if (phrase !== "DELETE") {
        showError("акаунт", "Підтвердження не збіглося. Видалення скасовано.");
        return;
      }
      return confirmBox("Останнє підтвердження: точно видалити акаунт?").then(function (again) {
        if (!again) return;
        return Promise.resolve(store.deleteAccount({ confirm: "DELETE", confirmAgain: "DELETE" })).then(function () {
          try { localStorage.removeItem(LS_KEY); } catch (e) {}
          try { sessionStorage.removeItem("kopiyka_unlocked"); } catch (e) {}
          showError("акаунт", "Акаунт видалено.");
          setTimeout(function () { window.location.reload(); }, 500);
        }).catch(function (e) { reportFailure("акаунт", e); });
      });
    });
  }

  /* ============================ онбординг ============================ */

  /* Порожній дашборд нічого не пояснює новому користувачу: п'ять карток по
     нулю і форма нижче за межею екрана. Замість цього — три питання, після
     яких на дашборді вже є дані, а «Сьогодні можна» починає рахуватись.
     Показується рівно один раз: прапорець onboardingDone їде в налаштування
     (сервер тримає невідомі ключі в extra_settings, тож він переживає
     синхронізацію), а журнал з операціями сам по собі закриває онбординг. */

  var onbStep = 1;
  var onbCategory = "";
  var onbBusy = false;

  function onbEl(id) { return document.getElementById(id); }

  function onbShowStep(step) {
    onbStep = step;
    document.querySelectorAll("[data-onb-step]").forEach(function (section) {
      section.hidden = Number(section.dataset.onbStep) !== step;
    });
    document.querySelectorAll("[data-onb-dot]").forEach(function (dot) {
      dot.classList.toggle("is-on", Number(dot.dataset.onbDot) <= step);
    });
    var next = onbEl("onbNext");
    if (next) next.textContent = step === 3 ? "Готово" : "Далі";
    var input = document.querySelector('[data-onb-step="' + step + '"] input');
    if (input) setTimeout(function () { try { input.focus({ preventScroll: true }); } catch (e) {} }, 60);
  }

  function onbRenderCats() {
    var wrap = onbEl("onbCats");
    if (!wrap) return;
    var rows = expenseCats();
    onbCategory = rows.length ? rows[0].name : "";
    wrap.innerHTML = rows.map(function (row, index) {
      return '<button class="onboarding-cat" type="button" data-onb-cat="' + esc(row.name) + '" aria-pressed="' +
        (index === 0 ? "true" : "false") + '">' +
        '<i style="background:' + esc(row.color) + '"></i>' + esc(expenseLabel(row.name)) + '</button>';
    }).join("");
    wrap.querySelectorAll("[data-onb-cat]").forEach(function (button) {
      button.addEventListener("click", function () {
        onbCategory = button.dataset.onbCat;
        wrap.querySelectorAll("[data-onb-cat]").forEach(function (other) {
          other.setAttribute("aria-pressed", other === button ? "true" : "false");
        });
      });
    });
  }

  function onbWeekHint() {
    var hint = onbEl("onbWeekHint");
    if (!hint) return;
    var value = softAmount(onbEl("onbWeek").value);
    hint.textContent = value ? "Це " + fmtShort(round2(value / 7)) + " на день" : "";
  }

  // Тижневу суму розкладаємо порівну, а копійки округлення віддаємо неділі,
  // щоб сума денних планів точно дорівнювала введеній.
  function onbSpreadWeek(total) {
    var perDay = round2(total / 7);
    var days = [perDay, perDay, perDay, perDay, perDay, perDay, 0];
    days[6] = round2(total - perDay * 6);
    if (days[6] < 0) days[6] = 0;
    return days;
  }

  function onbFinish(patch) {
    var next = Object.assign({ onboardingDone: true }, patch || {});
    saveSettings(next);
    var box = onbEl("onboarding");
    if (box) box.hidden = true;
    renderAll();
    focusAmount();
  }

  function onbSubmit() {
    if (onbBusy) return;
    if (onbStep === 1) {
      var incomeRaw = String(onbEl("onbIncome").value || "").trim();
      if (incomeRaw) {
        var income = parseAmount(incomeRaw);
        if (!income.ok) { showError("дохід", income.msg); return; }
        saveSettings({ salaryAmount: income.value });
      }
      onbShowStep(2);
      return;
    }
    if (onbStep === 2) {
      var weekRaw = String(onbEl("onbWeek").value || "").trim();
      if (weekRaw) {
        var week = parseAmount(weekRaw);
        if (!week.ok) { showError("тиждень", week.msg); return; }
        saveSettings({
          weekBudget: week.value,
          weekDaily: onbSpreadWeek(week.value),
          allowanceEnabled: true
        });
      }
      onbShowStep(3);
      return;
    }
    var amountRaw = String(onbEl("onbAmount").value || "").trim();
    if (!amountRaw) { onbFinish(); return; }
    var amount = parseAmount(amountRaw);
    if (!amount.ok) { showError("витрата", amount.msg); return; }
    onbBusy = true;
    Promise.resolve(commitTx({
      type: "expense",
      category: onbCategory || defaultExpenseName(),
      amount: amount.value,
      wallet: "Кеш",
      date: todayISO(),
      note: ""
    })).then(function () {
      onbBusy = false;
      onbFinish();
    }).catch(function () {
      onbBusy = false;
      onbFinish();
    });
  }

  function wireOnboarding() {
    var form = onbEl("onboardingForm");
    if (!form) return;
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      onbSubmit();
    });
    var skip = onbEl("onbSkip");
    if (skip) skip.addEventListener("click", function () { onbFinish(); });
    var week = onbEl("onbWeek");
    if (week) week.addEventListener("input", onbWeekHint);
  }

  function maybeStartOnboarding() {
    var box = onbEl("onboarding");
    if (!box) return;
    var s = settings();
    // Журнал з операціями означає, що людина вже розібралась сама.
    if (state.transactions.length) {
      if (!s.onboardingDone) saveSettings({ onboardingDone: true });
      box.hidden = true;
      return;
    }
    if (s.onboardingDone) { box.hidden = true; return; }
    // Замок має пріоритет: спершу людина заходить, потім її щось питають.
    if (!document.getElementById("pinGate").hidden) return;
    if (!box.hidden) return;
    onbRenderCats();
    onbShowStep(1);
    box.hidden = false;
  }

  /* ==================== імпорт банківської виписки ==================== */

  /* Файл розбирається тут, у браузері: виписка нікуди не відправляється, у
     базу потрапляють лише готові операції після підтвердження людиною.
     Імпортуємо тільки витрати — надходження в картковій виписці здебільшого
     не доходи, а власні поповнення, кешбек і повернення. */

  var IMPORT_MAX_ROWS = 800;
  var XLSX_CDN = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  var XLSX_SRI = "sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw";

  // Назва мережі в описі точніша за MCC: банки ставлять код торговця як
  // доведеться. Тому спершу ключові слова, і лише потім MCC.
  // Порядок правил важливий: «bolt food» має спрацювати раніше за «bolt».
  var IMPORT_MERCHANT_RULES = [
    ["Доставка їжі", ["glovo", "глово", "bolt food", "болт фуд", "rocket", "ракета", "raketa", "wolt", "uber eats", "menu.ua"]],
    ["Продукти", ["атб", "atb", "сільпо", "silpo", "новус", "novus", "varus", "варус", "фора", "fora", "ашан", "auchan", "метро", "metro", "космос", "еко маркет", "эко маркет", "маркетопт", "делві", "близенько"]],
    ["Кафе і ресторани", ["mcdonald", "макдональд", "kfc", "пузата", "львівськ", "аромакава", "coffee", "кав'ярн", "кавярн", "кофе", "pizza", "піц", "суші", "sushi", "ресторан", "кафе", "starbucks", "чашка", "буфет", "їдальн"]],
    ["Транспорт", ["wog", "окко", "okko", "socar", "укрнафта", "shell", "брсм", "amic", "авіас", "авиас", "uklon", "уклон", "uber", "bolt", "таксі", "такси", "азс", "паливо", "паркінг", "parking", "автозапчаст", "шиномонтаж", "укрзалізниц", "blablacar"]],
    ["Підписки", ["netflix", "spotify", "youtube", "megogo", "київстар", "kyivstar", "vodafone", "lifecell", "chatgpt", "openai", "icloud", "apple.com/bill", "google", "sweet.tv", "setanta", "patreon", "megogo", "інтертелеком"]],
    ["Тютюн і алкоголь", ["тютюн", "сигарет", "цигарк", "iqos", "glo ", "vape", "вейп", "алкогол", "wine", "вино", "пиво", "beer", "горілк", "whisky", "віскі", "wine time", "мушля"]],
    ["Розваги", ["кіно", "cinema", "multiplex", "planeta kino", "квиток", "ticket", "концерт", "concert", "steam", "playstation", "аквапарк", "боулінг", "квест"]]
  ];

  var IMPORT_MCC = {
    "5411": "Продукти", "5422": "Продукти", "5441": "Продукти", "5451": "Продукти",
    "5462": "Продукти", "5499": "Продукти",
    "5812": "Кафе і ресторани", "5813": "Кафе і ресторани", "5814": "Кафе і ресторани",
    "5541": "Транспорт", "5542": "Транспорт", "4111": "Транспорт", "4121": "Транспорт",
    "4131": "Транспорт", "4784": "Транспорт", "7523": "Транспорт", "5533": "Транспорт",
    "5921": "Тютюн і алкоголь", "5993": "Тютюн і алкоголь",
    "7832": "Розваги", "7841": "Розваги", "7922": "Розваги", "7929": "Розваги",
    "7994": "Розваги", "7996": "Розваги", "7997": "Розваги", "7998": "Розваги", "7999": "Розваги",
    "4814": "Підписки", "4816": "Підписки", "4899": "Підписки",
    "5815": "Підписки", "5816": "Підписки", "5817": "Підписки", "5818": "Підписки"
  };

  // Це списання, але не витрати: власні перекази, поповнення інших рахунків,
  // повернення. Рядок показуємо, та знімаємо позначку — хай людина вирішує.
  var IMPORT_TRANSFER_HINTS = [
    "переказ", "перевод", "на картку", "з картки на картку", "власн", "поповнення",
    "кешбек", "кэшбэк", "cashback", "повернення", "відсотк", "капіталіз", "депозит", "p2p"
  ];

  var importState = { rows: [], fileName: "" };

  function importDecode(buffer) {
    var bytes = new Uint8Array(buffer);
    if (bytes.length > 2 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
      return new TextDecoder("utf-8").decode(bytes.subarray(3));
    }
    // Приват віддає CSV у windows-1251. Строгий декодер падає на такому файлі,
    // і це найнадійніший спосіб відрізнити одне кодування від іншого.
    try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
    catch (e) {
      try { return new TextDecoder("windows-1251").decode(bytes); }
      catch (e2) { return new TextDecoder("utf-8").decode(bytes); }
    }
  }

  function importDetectDelimiter(text) {
    var head = text.split("\n").slice(0, 5).join("\n");
    var counts = { ";": 0, ",": 0, "\t": 0 };
    var quoted = false;
    for (var i = 0; i < head.length; i++) {
      var ch = head[i];
      if (ch === '"') { quoted = !quoted; continue; }
      if (quoted) continue;
      if (counts[ch] !== undefined) counts[ch]++;
    }
    var best = ";";
    Object.keys(counts).forEach(function (key) { if (counts[key] > counts[best]) best = key; });
    return counts[best] ? best : ";";
  }

  function importSplitCsv(text) {
    var delimiter = importDetectDelimiter(text);
    var rows = [];
    var row = [];
    var field = "";
    var quoted = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (quoted) {
        if (ch !== '"') { field += ch; continue; }
        if (text[i + 1] === '"') { field += '"'; i++; continue; }
        quoted = false;
        continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === delimiter) { row.push(field); field = ""; continue; }
      if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; continue; }
      if (ch === "\r") continue;
      field += ch;
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    return rows.map(function (cells) {
      return cells.map(function (cell) { return String(cell).replace(/ /g, " ").trim(); });
    });
  }

  function importFindHeader(table) {
    for (var i = 0; i < Math.min(table.length, 25); i++) {
      var cells = table[i] || [];
      if (cells.length < 3) continue;
      var hasDate = cells.some(function (cell) { return /дата|date/i.test(cell); });
      var hasAmount = cells.some(function (cell) { return /сум|amount/i.test(cell); });
      if (hasDate && hasAmount) return i;
    }
    return -1;
  }

  function importFindColumn(header, pattern) {
    for (var i = 0; i < header.length; i++) if (pattern.test(header[i])) return i;
    return -1;
  }

  // У виписці кілька колонок із «сумою»: у валюті картки, у валюті операції,
  // комісія, кешбек, залишок. Потрібна саме гривнева сума операції.
  function importPickAmountColumn(header) {
    var best = -1;
    var bestScore = -99;
    header.forEach(function (name, index) {
      if (!/сум|amount/i.test(name)) return;
      var score = 0;
      if (/картк|карти|card|uah|грн/i.test(name)) score += 3;
      if (/валюті операці|валюте операц|транзакц|transaction/i.test(name)) score -= 2;
      if (/комісі|комисс|кешб|кэшб|cashback|залишок|остаток|balance/i.test(name)) score -= 5;
      if (score > bestScore) { bestScore = score; best = index; }
    });
    return best;
  }

  function importParseDate(value) {
    if (value instanceof Date && !isNaN(value.getTime())) {
      return value.getFullYear() + "-" + pad(value.getMonth() + 1) + "-" + pad(value.getDate());
    }
    var text = String(value == null ? "" : value).trim();
    var iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return iso[1] + "-" + iso[2] + "-" + iso[3];
    var dotted = text.match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
    if (!dotted) return "";
    var year = Number(dotted[3]);
    if (year < 100) year += 2000;
    var month = Number(dotted[2]);
    var day = Number(dotted[1]);
    if (!(month >= 1 && month <= 12) || !(day >= 1 && day <= 31)) return "";
    return year + "-" + pad(month) + "-" + pad(day);
  }

  // «-1 234,56», «−1234.56», «(1234,56)» і «1 234,56» мають дати одне число.
  function importParseNumber(value) {
    if (typeof value === "number") return isFinite(value) ? value : null;
    var raw = String(value == null ? "" : value).replace(/ /g, " ").trim();
    if (!raw) return null;
    var negative = /^[-−–]/.test(raw) || /^\(.*\)$/.test(raw);
    var digits = raw.replace(/[^\d.,]/g, "");
    if (!digits) return null;
    var sep = Math.max(digits.lastIndexOf(","), digits.lastIndexOf("."));
    var intPart = digits;
    var fracPart = "";
    if (sep >= 0 && digits.length - sep - 1 <= 2) {
      intPart = digits.slice(0, sep);
      fracPart = digits.slice(sep + 1);
    }
    intPart = intPart.replace(/[.,]/g, "");
    var number = Number((intPart || "0") + (fracPart ? "." + fracPart : ""));
    if (!isFinite(number)) return null;
    return negative ? -number : number;
  }

  function importDetectCategory(description, mcc) {
    var text = String(description || "").toLocaleLowerCase("uk-UA");
    var names = expenseCatNames();
    for (var i = 0; i < IMPORT_MERCHANT_RULES.length; i++) {
      var rule = IMPORT_MERCHANT_RULES[i];
      for (var j = 0; j < rule[1].length; j++) {
        if (text.indexOf(rule[1][j]) >= 0) return names.indexOf(rule[0]) >= 0 ? rule[0] : "";
      }
    }
    var code = String(mcc == null ? "" : mcc).replace(/\D/g, "");
    var byMcc = code && IMPORT_MCC[code];
    return byMcc && names.indexOf(byMcc) >= 0 ? byMcc : "";
  }

  function importLooksLikeTransfer(description) {
    var text = String(description || "").toLocaleLowerCase("uk-UA");
    return IMPORT_TRANSFER_HINTS.some(function (hint) { return text.indexOf(hint) >= 0; });
  }

  function importKeyFor(date, amount, description) {
    return "imp:" + date + ":" + Math.round(Math.abs(Number(amount) || 0) * 100) + ":" +
      String(description || "").toLocaleLowerCase("uk-UA").replace(/\s+/g, " ").trim().slice(0, 40);
  }

  function importExistingKeys() {
    var seen = Object.create(null);
    state.transactions.forEach(function (row) {
      if (row.importKey) seen[row.importKey] = true;
      seen[importKeyFor(row.date, row.amount, row.note)] = true;
    });
    return seen;
  }

  function importBuildRows(table) {
    var headerIndex = importFindHeader(table);
    if (headerIndex < 0) throw new Error("no_header");
    var header = table[headerIndex];
    var dateColumn = importFindColumn(header, /дата|date/i);
    var descColumn = importFindColumn(header, /опис|деталі|детали|призначенн|контрагент|коментар|merchant|description/i);
    var mccColumn = importFindColumn(header, /mcc/i);
    var amountColumn = importPickAmountColumn(header);
    if (dateColumn < 0 || amountColumn < 0) throw new Error("no_columns");

    var known = importExistingKeys();
    var rows = [];
    var incomes = 0;
    var broken = 0;
    for (var i = headerIndex + 1; i < table.length && rows.length < IMPORT_MAX_ROWS; i++) {
      var cells = table[i] || [];
      if (!cells.length || cells.every(function (cell) { return !cell; })) continue;
      var date = importParseDate(cells[dateColumn]);
      var amount = importParseNumber(cells[amountColumn]);
      if (!date || amount === null || amount === 0) { broken++; continue; }
      if (amount > 0) { incomes++; continue; }
      var description = descColumn >= 0 ? String(cells[descColumn] || "").replace(/\s+/g, " ").trim() : "";
      var key = importKeyFor(date, amount, description);
      var transfer = importLooksLikeTransfer(description);
      var duplicate = !!known[key];
      known[key] = true;
      rows.push({
        date: date,
        amount: round2(Math.abs(amount)),
        note: description.slice(0, 120),
        category: importDetectCategory(description, mccColumn >= 0 ? cells[mccColumn] : ""),
        importKey: key,
        duplicate: duplicate,
        transfer: transfer,
        include: !duplicate && !transfer
      });
    }
    return { rows: rows, incomes: incomes, broken: broken };
  }

  var xlsxPromise = null;
  function importLoadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    if (xlsxPromise) return xlsxPromise;
    xlsxPromise = new Promise(function (resolve, reject) {
      var el = document.createElement("script");
      el.src = XLSX_CDN;
      el.integrity = XLSX_SRI;
      el.crossOrigin = "anonymous";
      el.referrerPolicy = "no-referrer";
      el.onload = function () { window.XLSX ? resolve(window.XLSX) : reject(new Error("xlsx")); };
      el.onerror = function () { reject(new Error("xlsx")); };
      document.head.appendChild(el);
    }).catch(function (error) { xlsxPromise = null; throw error; });
    return xlsxPromise;
  }

  function importTableFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error("read")); };
      reader.onload = function () { resolve(reader.result); };
      reader.readAsArrayBuffer(file);
    }).then(function (buffer) {
      if (/\.xlsx?$/i.test(file.name)) {
        return importLoadXlsx().then(function (XLSX) {
          var book = XLSX.read(new Uint8Array(buffer), { type: "array", cellDates: true });
          var sheet = book.Sheets[book.SheetNames[0]];
          return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, blankrows: false });
        });
      }
      return importSplitCsv(importDecode(buffer));
    });
  }

  function importErrorText(error) {
    var code = error && error.message;
    if (code === "no_header") return "Не знайшов рядок із заголовками. Вивантажте виписку без змін, як її віддає банк.";
    if (code === "no_columns") return "У файлі немає колонок дати й суми. Схоже, це не виписка.";
    if (code === "xlsx") return "Не вдалось завантажити читач XLSX. Перевірте інтернет або вивантажте виписку у форматі CSV.";
    if (code === "read") return "Не вдалось прочитати файл.";
    return "Не вдалось розібрати файл. Спробуйте формат CSV.";
  }

  function importRenderRows() {
    var wrap = document.getElementById("importRows");
    if (!wrap) return;
    var names = expenseCatNames();
    wrap.innerHTML = importState.rows.map(function (row, index) {
      var flag = row.duplicate ? '<span class="import-flag">вже є</span>'
        : row.transfer ? '<span class="import-flag">переказ</span>' : "";
      var options = ['<option value="">— оберіть категорію —</option>'].concat(names.map(function (name) {
        return '<option value="' + esc(name) + '"' + (name === row.category ? " selected" : "") + '>' + esc(expenseLabel(name)) + '</option>';
      })).join("");
      return '<div class="import-row" data-import-index="' + index + '" data-on="' + (row.include ? "1" : "0") +
        '" data-need="' + (row.category ? "0" : "1") + '">' +
        '<input type="checkbox" data-import-toggle aria-label="Імпортувати операцію"' + (row.include ? " checked" : "") + ' />' +
        '<span class="import-row-main"><span class="import-row-desc">' + esc(row.note || "Без опису") + flag + '</span>' +
        '<span class="import-row-meta">' + esc(row.date.split("-").reverse().join(".")) + '</span></span>' +
        '<span class="import-row-amount">−' + esc(fmt(row.amount)) + '</span>' +
        '<select data-import-category aria-label="Категорія операції">' + options + '</select>' +
        '</div>';
    }).join("");
    importUpdateSummary();
  }

  function importUpdateSummary() {
    var summary = document.getElementById("importSummary");
    var confirm = document.getElementById("importConfirm");
    if (!summary) return;
    var chosen = importState.rows.filter(function (row) { return row.include; });
    var missing = chosen.filter(function (row) { return !row.category; }).length;
    var total = chosen.reduce(function (sum, row) { return sum + row.amount; }, 0);
    // Формулювання через двокрапку свідоме: воно не потребує узгодження
    // числівника з іменником, тож не даватиме «1 операцій».
    var parts = ["знайдено витрат: " + importState.rows.length, "позначено: " + chosen.length + " на " + fmtShort(total)];
    if (missing) parts.push("без категорії: " + missing);
    summary.textContent = parts.join(" · ");
    if (confirm) {
      confirm.disabled = !chosen.length || !!missing;
      confirm.textContent = missing ? "Оберіть категорії" : "Імпортувати " + chosen.length;
    }
  }

  function importOpenSheet() {
    var sheet = document.getElementById("importSheet");
    if (!sheet) return;
    importRenderRows();
    document.getElementById("importProgress").textContent = "";
    sheet.hidden = false;
  }

  function importCloseSheet() {
    var sheet = document.getElementById("importSheet");
    if (sheet) sheet.hidden = true;
    importState.rows = [];
  }

  function importRunImport() {
    var chosen = importState.rows.filter(function (row) { return row.include && row.category; });
    if (!chosen.length) return;
    var progress = document.getElementById("importProgress");
    var confirm = document.getElementById("importConfirm");
    if (confirm) { confirm.disabled = true; confirm.textContent = "Записую…"; }
    if (progress) progress.textContent = "Записую операції: " + chosen.length + "…";
    var payload = chosen.map(function (row) {
      return {
        type: "expense",
        category: row.category,
        amount: row.amount,
        wallet: "Кеш",
        date: row.date,
        note: row.note,
        importKey: row.importKey
      };
    });
    var job = store && typeof store.bulkAdd === "function"
      ? store.bulkAdd("transactions", payload)
      : payload.reduce(function (chain, row) {
          return chain.then(function () { return commitTx(row, undefined, true); });
        }, Promise.resolve());
    return Promise.resolve(job).then(function () {
      importCloseSheet();
      showError("імпорт", "Готово. Додано операцій: " + chosen.length + ".");
      renderAll();
    }).catch(function (error) {
      reportFailure("імпорт", error);
      if (confirm) { confirm.disabled = false; confirm.textContent = "Спробувати ще раз"; }
      if (progress) progress.textContent = "";
    });
  }

  function importHandleFile(file, noteEl) {
    if (!file) return;
    importState.fileName = file.name;
    if (noteEl) noteEl.textContent = "Читаю " + file.name + "…";
    importTableFromFile(file).then(function (table) {
      var built = importBuildRows(table);
      if (!built.rows.length) {
        if (noteEl) noteEl.textContent = "У файлі немає витрат за цей період.";
        return;
      }
      importState.rows = built.rows;
      var tail = [];
      if (built.incomes) tail.push("надходжень пропущено: " + built.incomes);
      if (built.broken) tail.push("нерозпізнаних рядків: " + built.broken);
      if (noteEl) noteEl.textContent = tail.join(" · ");
      importOpenSheet();
    }).catch(function (error) {
      console.error("[Копійка] імпорт:", error);
      if (noteEl) noteEl.textContent = importErrorText(error);
    });
  }

  function wireImportSheet() {
    var sheet = document.getElementById("importSheet");
    if (!sheet) return;
    document.getElementById("importClose").addEventListener("click", importCloseSheet);
    document.getElementById("importConfirm").addEventListener("click", importRunImport);
    sheet.querySelectorAll("[data-import-all]").forEach(function (button) {
      button.addEventListener("click", function () {
        var on = button.dataset.importAll === "1";
        importState.rows.forEach(function (row) { row.include = on; });
        importRenderRows();
      });
    });
    var rows = document.getElementById("importRows");
    rows.addEventListener("change", function (event) {
      var host = event.target.closest("[data-import-index]");
      if (!host) return;
      var row = importState.rows[Number(host.dataset.importIndex)];
      if (!row) return;
      if (event.target.hasAttribute("data-import-toggle")) {
        row.include = event.target.checked;
        host.dataset.on = row.include ? "1" : "0";
      } else if (event.target.hasAttribute("data-import-category")) {
        row.category = event.target.value;
        host.dataset.need = row.category ? "0" : "1";
      }
      importUpdateSummary();
    });
  }

  function showCabinetImport() {
    var menu = document.querySelector(".cabinet-menu");
    var detail = document.getElementById("cabinetDetail");
    if (!menu || !detail) return;
    menu.hidden = true;
    detail.hidden = false;
    detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button>' +
      '<h2 class="cabinet-detail-title">Імпорт виписки</h2>' +
      '<div class="import-picker">' +
      '<p class="import-note">monobank: у застосунку відкрийте картку → «Виписка» → період → «Надіслати» і збережіть CSV або XLSX. ' +
      'ПриватБанк: Приват24 → «Виписки» → період → експорт у CSV.</p>' +
      '<p class="import-note">Файл розбирається на вашому телефоні й нікуди не надсилається. ' +
      'Імпортуються тільки витрати; перед записом ви побачите список і зможете зняти зайве.</p>' +
      '<input type="file" id="importFile" accept=".csv,.xlsx,.xls" hidden />' +
      '<button class="btn-primary" type="button" id="importPick">Обрати файл</button>' +
      '<p class="import-note" id="importPickNote" aria-live="polite"></p>' +
      '</div>';
    document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
    var input = document.getElementById("importFile");
    var note = document.getElementById("importPickNote");
    document.getElementById("importPick").onclick = function () { input.click(); };
    input.onchange = function () {
      importHandleFile(input.files && input.files[0], note);
      input.value = "";
    };
  }

  /* ============================ PIN ============================ */

  function hashPin(pin) {
    var enc = new TextEncoder().encode("kopiyka:" + pin);
    if (!crypto || !crypto.subtle) return Promise.resolve("plain:" + pin);
    return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    });
  }
  function lockIfNeeded() {
    var s = settings();
    if (!s.pin || !s.lockEnabled) { document.getElementById("pinGate").hidden = true; return; }
    if (sessionStorage.getItem("kopiyka_unlocked") === "1") { document.getElementById("pinGate").hidden = true; return; }
    biometricAttempted = false;
    if (localStorage.getItem("kopiyka_lock_mode") === "biometric") {
      document.getElementById("pinGate").hidden = true;
      tryBiometricUnlock(showPinGate);
      return;
    }
    showPinGate();
  }

  function showPinGate() {
    document.getElementById("pinGate").hidden = false;
    setTimeout(function () { document.getElementById("pinInput").focus(); }, 60);
  }

  var biometricAttempted = false;
  function biometricLabel() {
    var tg = window.Telegram && window.Telegram.WebApp;
    var bio = tg && tg.BiometricManager;
    if (!bio) return "Біометрія";
    return bio.biometricType === "face" ? "Face ID" : bio.biometricType === "finger" ? "Відбиток пальця" : "Біометрія";
  }
  function tryBiometricUnlock(onFallback) {
    if (biometricAttempted) return;
    biometricAttempted = true;
    var tg = window.Telegram && window.Telegram.WebApp;
    var bio = tg && tg.BiometricManager;
    if (!bio || !bio.init) { if (onFallback) onFallback(); return; }
    try {
      bio.init(function () {
        if (!bio.isBiometricAvailable || !bio.authenticate) { if (onFallback) onFallback(); return; }
        bio.authenticate({ reason: "Доступ до Копійки" }, function (ok) {
          if (!ok) { if (onFallback) onFallback(); return; }
          sessionStorage.setItem("kopiyka_unlocked", "1");
          document.getElementById("pinGate").hidden = true;
          if (state.ready) maybeStartOnboarding();
          focusAmount();
        });
      });
    } catch (_error) { if (onFallback) onFallback(); }
  }

  /* ============================ AI (sample) ============================ */

  var aiMode = "write", aiCtl = null, aiDraft = [];

  function aiStatus(msg) { document.getElementById("aiStatus").textContent = msg || ""; }

  function aiContext() {
    return {
      today: todayISO(),
      expenseCategories: expenseCatNames(),
      incomeCategories: INCOME_CATS,
      wallets: WALLETS
    };
  }

  function runAiWrite(text) {
    var ctx = aiContext();
    var prompt =
      "Ти розбираєш український текст про особисті витрати на окремі операції.\n" +
      "Сьогодні: " + ctx.today + ".\n" +
      "Статті витрат: " + ctx.expenseCategories.join(", ") + ".\n" +
      "Статті доходу: " + ctx.incomeCategories.join(", ") + ".\n" +
      "Гаманці: " + ctx.wallets.join(", ") + ".\n" +
      "Поверни ТІЛЬКИ JSON-масив об'єктів виду " +
      '{"type":"expense"|"income","category":"...","amount":123.45,"wallet":"Кеш","date":"YYYY-MM-DD","note":"..."}.\n' +
      "Категорію обирай лише зі списків вище. Якщо гаманець не вказано — \"Кеш\". " +
      "Відносні дати (вчора, позавчора) переводь у конкретну дату. Якщо дата не вказана — сьогодні.\n\n" +
      "Текст: " + text;
    aiCtl = new AbortController();
    aiStatus("Думаю…");
    document.getElementById("aiStop").hidden = false;
    return caps.sample.json(prompt, { signal: aiCtl.signal })
      .then(function (data) {
        var rows = Array.isArray(data) ? data : (data && Array.isArray(data.operations) ? data.operations : []);
        aiDraft = rows.map(normaliseDraft).filter(Boolean);
        if (!aiDraft.length) { aiStatus("Не вдалось нічого розібрати. Спробуй конкретніше."); return; }
        aiStatus("Перевір і натисни «Записати».");
        renderDraft();
      })
      .catch(handleAiError)
      .then(function () { document.getElementById("aiStop").hidden = true; aiCtl = null; });
  }

  function normaliseDraft(r) {
    if (!r || typeof r !== "object") return null;
    var amt = softAmount(r.amount);
    if (amt == null) return null;
    var type = r.type === "income" ? "income" : "expense";
    var cats = type === "income" ? INCOME_CATS : expenseCatNames();
    var cat = cats.indexOf(r.category) >= 0 ? r.category : cats[0];
    var wallet = "Кеш";
    var date = /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ? r.date : todayISO();
    return { type: type, category: cat, amount: amt, wallet: wallet, date: date, note: String(r.note || "").slice(0, 120) };
  }

  function renderDraft() {
    var box = document.getElementById("aiDraft");
    if (!aiDraft.length) { box.innerHTML = ""; return; }
    box.innerHTML = aiDraft.map(function (d, i) {
      var cats = d.type === "income" ? INCOME_CATS : expenseCatNames();
      return '<div class="draft-card" data-i="' + i + '">' +
        '<select data-f="type"><option value="expense"' + (d.type === "expense" ? " selected" : "") + '>Витрата</option>' +
        '<option value="income"' + (d.type === "income" ? " selected" : "") + '>Дохід</option></select>' +
        '<select data-f="category">' + cats.map(function (c) { return '<option' + (c === d.category ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("") + '</select>' +
        '<select data-f="wallet">' + WALLETS.map(function (w) { return '<option' + (w === d.wallet ? " selected" : "") + '>' + esc(w) + '</option>'; }).join("") + '</select>' +
        '<input data-f="amount" type="text" inputmode="decimal" value="' + esc(d.amount) + '" aria-label="Сума" />' +
        '<input data-f="date" type="date" value="' + esc(d.date) + '" aria-label="Дата" />' +
        '<input data-f="note" type="text" value="' + esc(d.note) + '" maxlength="120" aria-label="Нотатка" />' +
        '<button class="icon-btn" type="button" data-drop="' + i + '" aria-label="Викинути">✕</button></div>';
    }).join("") + '<div class="draft-actions"><button class="btn-primary" type="button" id="draftCommit">Записати ' + aiDraft.length + '</button></div>';

    box.querySelectorAll(".draft-card").forEach(function (card) {
      card.querySelectorAll("[data-f]").forEach(function (inp) {
        inp.addEventListener("change", function () {
          var i = Number(card.dataset.i), f = inp.dataset.f;
          if (f === "amount") { var p = parseAmount(inp.value); if (!p.ok) { showError("розбір", p.msg); return; } aiDraft[i].amount = p.value; }
          else aiDraft[i][f] = inp.value;
          if (f === "type") renderDraft();
        });
      });
    });
    box.querySelectorAll("[data-drop]").forEach(function (b) {
      b.addEventListener("click", function () { aiDraft.splice(Number(b.dataset.drop), 1); renderDraft(); });
    });
    var commit = document.getElementById("draftCommit");
    if (commit) commit.addEventListener("click", function () {
      var rows = aiDraft.slice();
      aiDraft = []; renderDraft(); aiStatus("");
      rows.reduce(function (chain, r) { return chain.then(function () { return commitTx(r); }); }, Promise.resolve())
        .then(function () { showError("журнал", "Записано " + rows.length + " операцій."); });
    });
  }

  function runAiAsk(question) {
    var ctx = aiContext();
    var prompt =
      "Користувач питає про свої фінанси. Поверни ТІЛЬКИ JSON-фільтр, не рахуй сам.\n" +
      "Сьогодні: " + ctx.today + ".\n" +
      "Статті витрат: " + ctx.expenseCategories.join(", ") + ".\n" +
      "Статті доходу: " + ctx.incomeCategories.join(", ") + ".\n" +
      'Формат: {"categories":["..."],"type":"expense"|"income"|null,"from":"YYYY-MM-DD","to":"YYYY-MM-DD","title":"короткий підпис"}\n' +
      "Порожній масив категорій означає всі. Якщо період не названо — останні 12 місяців.\n\n" +
      "Питання: " + question;
    aiCtl = new AbortController();
    aiStatus("Думаю…");
    document.getElementById("aiStop").hidden = false;
    return caps.sample.json(prompt, { signal: aiCtl.signal })
      .then(function (f) {
        if (!f || typeof f !== "object") { aiStatus("Не зрозумів питання."); return; }
        var from = /^\d{4}-\d{2}-\d{2}$/.test(String(f.from)) ? f.from : isoAdd(todayISO(), -365);
        var to = /^\d{4}-\d{2}-\d{2}$/.test(String(f.to)) ? f.to : todayISO();
        var allowedExpenseCats = expenseCatNames();
        var cats = Array.isArray(f.categories) ? f.categories.filter(function (c) {
          return allowedExpenseCats.indexOf(c) >= 0 || INCOME_CATS.indexOf(c) >= 0;
        }) : [];
        var type = (f.type === "expense" || f.type === "income") ? f.type : null;
        state.filter = { allMonths: true, cats: cats, type: type, from: from, to: to, text: "" };
        markFlip();
        renderLedger();
        // The number is computed here, from the page's own rows — the model
        // only ever chose the filter.
        var rows = filteredTx();
        var total = rows.reduce(function (s, t) { return s + t.amount; }, 0);
        var label = esc(String(f.title || "Вибірка"));
        var ans = document.getElementById("aiAnswer");
        ans.hidden = false;
        ans.innerHTML = '<div class="answer-title">' + label + '</div>' +
          '<div class="answer-sum money">' + esc(fmt(total)) + '</div>' +
          '<div class="answer-meta">' + rows.length + ' операцій · ' + esc(from) + ' — ' + esc(to) +
          (cats.length ? ' · ' + esc(cats.join(", ")) : '') + '</div>';
        aiStatus("Журнал відфільтровано під цю вибірку.");
      })
      .catch(handleAiError)
      .then(function () { document.getElementById("aiStop").hidden = true; aiCtl = null; });
  }

  function handleAiError(e) {
    var code = e && e.code;
    if (code === "cancelled") { aiStatus("Скасовано."); return; }
    if (code === "not_granted") { document.getElementById("aiBtn").hidden = true; document.getElementById("aiPanel").hidden = true; caps.sample = null; return; }
    if (code === "rate_limited") { aiStatus("Забагато запитів — зачекай трохи."); return; }
    console.error("[Копійка] sample:", code, e && e.message);
    aiStatus("Не вийшло (" + (code || "помилка") + ").");
  }

  /* ============================ search ============================ */

  function syncSearchCats() {
    var sel = document.getElementById("searchCat");
    if (!sel) return;
    var current = sel.value;
    sel.innerHTML = '<option value="">Усі статті</option>';
    expenseCatNames().concat(INCOME_CATS).forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
    });
    if (current && Array.prototype.some.call(sel.options, function (o) { return o.value === current; })) sel.value = current;
  }
  function readSearch() {
    var text = document.getElementById("searchText").value.trim();
    var cat = document.getElementById("searchCat").value;
    var min = softAmount(document.getElementById("searchMin").value);
    var max = softAmount(document.getElementById("searchMax").value);
    var from = document.getElementById("searchFrom").value;
    var to = document.getElementById("searchTo").value;
    if (!text && !cat && min == null && max == null && !from && !to) { state.filter = null; }
    else state.filter = { allMonths: !!(from || to), text: text, cats: cat ? [cat] : [], min: min, max: max, from: from, to: to };
    document.getElementById("aiAnswer").hidden = true;
    markFlip();
    renderLedger();
  }
  function resetSearch() {
    ["searchText", "searchMin", "searchMax", "searchFrom", "searchTo"].forEach(function (id) { document.getElementById(id).value = ""; });
    document.getElementById("searchCat").value = "";
    state.filter = null;
    document.getElementById("aiAnswer").hidden = true;
    markFlip();
    renderLedger();
  }

  /* ============================ wiring ============================ */

  function fillSelect(sel, items, selected) {
    sel.innerHTML = items.map(function (c) { return '<option' + (c === selected ? " selected" : "") + '>' + esc(c) + '</option>'; }).join("");
  }
  function syncExpenseCategoryControls() {
    var expenseNames = expenseCatNames();
    var tx = document.getElementById("txCategory");
    var form = document.getElementById("txForm");
    if (tx && form) {
      var txItems = form.dataset.type === "income" ? INCOME_CATS : expenseNames;
      var txSelected = txItems.indexOf(tx.value) >= 0 ? tx.value : txItems[0];
      fillSelect(tx, txItems, txSelected);
    }
    var rec = document.getElementById("recCategory");
    if (rec) {
      var recSelected = expenseNames.indexOf(rec.value) >= 0 ? rec.value : expenseNames[0];
      fillSelect(rec, expenseNames, recSelected);
    }
    syncSearchCats();
  }

  function collectExpenseCategoryUsage(name) {
    var txCount = state.transactions.filter(function (t) { return isExpense(t) && t.category === name; }).length;
    var recCount = state.recurring.filter(function (r) { return r.category === name; }).length;
    var budgetUsed = Object.prototype.hasOwnProperty.call(settings().budgets || {}, name);
    return { txCount: txCount, recCount: recCount, budgetUsed: budgetUsed };
  }

  function renameExpenseCategoryRefs(oldName, nextName) {
    if (oldName === nextName) return;
    state.transactions.forEach(function (t) {
      if (isExpense(t) && t.category === oldName) t.category = nextName;
    });
    state.recurring.forEach(function (r) {
      if (r.category === oldName) r.category = nextName;
    });
    if (state.filter && Array.isArray(state.filter.cats)) {
      state.filter.cats = state.filter.cats.map(function (cat) { return cat === oldName ? nextName : cat; });
    }
    aiDraft.forEach(function (row) {
      if (row.type === "expense" && row.category === oldName) row.category = nextName;
    });
    ["txCategory", "recCategory", "searchCat"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.value === oldName) el.value = nextName;
    });
  }

  function persistExpenseCategoryRename(oldName, nextName) {
    var jobs = [];
    state.transactions.forEach(function (t) {
      if (isExpense(t) && t.category === oldName) jobs.push(store.update("transactions", t.id, { category: nextName }));
    });
    state.recurring.forEach(function (r) {
      if (r.category === oldName) jobs.push(store.update("recurring", r.id, { category: nextName }));
    });
    Promise.all(jobs).catch(function (e) { reportFailure("категорії", e); });
  }

  function saveExpenseCategoryEdit(index, rawName, rawColor) {
    var rows = expenseCats().slice();
    var current = rows[index];
    if (!current) return;
    var nextName = normalizeExpenseCategoryName(rawName);
    if (!nextName) { showError("категорії", "Введи назву категорії."); return; }
    var duplicate = rows.some(function (row, rowIndex) {
      return rowIndex !== index && row.name.toLocaleLowerCase("uk-UA") === nextName.toLocaleLowerCase("uk-UA");
    });
    if (duplicate) { showError("категорії", "Така категорія вже є."); return; }
    var nextColor = normalizeExpenseCategoryColor(rawColor, current.color);
    rows[index] = { name: nextName, color: nextColor };
    var budgets = Object.assign({}, settings().budgets);
    if (nextName !== current.name && Object.prototype.hasOwnProperty.call(budgets, current.name)) {
      budgets[nextName] = budgets[current.name];
      delete budgets[current.name];
    }
    renameExpenseCategoryRefs(current.name, nextName);
    saveSettings({ expenseCategories: rows, budgets: budgets });
    if (nextName !== current.name) persistExpenseCategoryRename(current.name, nextName);
    renderAll();
  }

  function dropExpenseCategory(name) {
    var rows = expenseCats().slice();
    if (rows.length <= 1) { showError("категорії", "Залиш хоча б одну категорію витрат."); return; }
    var usage = collectExpenseCategoryUsage(name);
    if (usage.txCount || usage.recCount || usage.budgetUsed) {
      showError("категорії", "Спочатку перенеси записи, регулярні витрати та ліміти з цієї категорії.");
      return;
    }
    saveSettings({
      expenseCategories: rows.filter(function (row) { return row.name !== name; })
    });
    renderAll();
  }

  function addExpenseCategory(rawName, rawColor) {
    var name = normalizeExpenseCategoryName(rawName);
    if (!name) { showError("категорії", "Введи назву для нової категорії."); return false; }
    var rows = expenseCats().slice();
    var duplicate = rows.some(function (row) { return row.name.toLocaleLowerCase("uk-UA") === name.toLocaleLowerCase("uk-UA"); });
    if (duplicate) { showError("категорії", "Така категорія вже є."); return false; }
    rows.push({ name: name, color: normalizeExpenseCategoryColor(rawColor, DEFAULT_EXPENSE_CATEGORY_ROWS[rows.length % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color) });
    saveSettings({ expenseCategories: rows });
    renderAll();
    return true;
  }

  var expenseCategorySyncStamp = "";
  function ensureExpenseCategoriesFromData() {
    var rows = expenseCats().slice();
    var known = Object.create(null);
    rows.forEach(function (row) { known[row.name.toLocaleLowerCase("uk-UA")] = true; });
    var missing = [];
    function push(raw) {
      var name = normalizeExpenseCategoryName(raw);
      if (!name) return;
      var key = name.toLocaleLowerCase("uk-UA");
      if (known[key]) return;
      known[key] = true;
      missing.push({
        name: name,
        color: DEFAULT_EXPENSE_CATEGORY_ROWS[(rows.length + missing.length) % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color
      });
    }
    Object.keys(settings().budgets || {}).forEach(push);
    state.transactions.forEach(function (t) { if (isExpense(t)) push(t.category); });
    state.recurring.forEach(function (r) { push(r.category); });
    var stamp = Object.keys(known).sort().join("|");
    if (!missing.length) { expenseCategorySyncStamp = stamp; return; }
    if (expenseCategorySyncStamp === stamp) return;
    expenseCategorySyncStamp = stamp;
    saveSettings({ expenseCategories: rows.concat(missing) });
  }

  var expenseIconTarget = null;

  function closeExpenseIconPicker() {
    var picker = document.getElementById("expenseIconPicker");
    if (picker) picker.hidden = true;
    if (expenseIconTarget) expenseIconTarget.setAttribute("aria-expanded", "false");
    expenseIconTarget = null;
  }

  function positionExpenseIconPicker() {
    var picker = document.getElementById("expenseIconPicker");
    if (!picker || picker.hidden || !expenseIconTarget) return;
    if (!expenseIconTarget.isConnected) { closeExpenseIconPicker(); return; }
    var rect = expenseIconTarget.getBoundingClientRect();
    var viewport = window.visualViewport;
    var topEdge = viewport ? viewport.offsetTop : 0;
    var bottomEdge = topEdge + (viewport ? viewport.height : window.innerHeight);
    var leftEdge = viewport ? viewport.offsetLeft : 0;
    var rightEdge = leftEdge + (viewport ? viewport.width : window.innerWidth);
    var top = rect.bottom + 8;
    if (top + picker.offsetHeight > bottomEdge - 8) top = rect.top - picker.offsetHeight - 8;
    picker.style.top = Math.max(topEdge + 8, top) + "px";
    picker.style.left = Math.max(leftEdge + 8, Math.min(rect.left, rightEdge - picker.offsetWidth - 8)) + "px";
  }

  function showExpenseIconPicker(input) {
    var picker = document.getElementById("expenseIconPicker");
    if (!picker) return;
    if (expenseIconTarget && expenseIconTarget !== input) expenseIconTarget.setAttribute("aria-expanded", "false");
    expenseIconTarget = input;
    input.setAttribute("aria-expanded", "true");
    picker.hidden = false;
    positionExpenseIconPicker();
  }

  function setExpenseIconTrigger(trigger, rawIcon) {
    if (!trigger) return;
    var icon = normalizeExpenseCategoryIcon(rawIcon);
    trigger.dataset.iconValue = icon;
    trigger.textContent = icon || "🙂";
    trigger.classList.toggle("is-empty", !icon);
    var linkedId = trigger.dataset.iconInputId;
    var linkedInput = linkedId ? document.getElementById(linkedId) : null;
    if (linkedInput) linkedInput.value = icon;
  }

  function wireExpenseIconPicker() {
    var picker = document.getElementById("expenseIconPicker");
    if (!picker) return;
    picker.innerHTML = '<div class="expense-icon-picker-title">Емодзі витрат</div><div class="expense-icon-options">' +
      EXPENSE_ICON_PRESETS.map(function (icon) {
        return '<button type="button" data-expense-icon="' + esc(icon) + '" aria-label="Обрати ' + esc(icon) + '">' + esc(icon) + '</button>';
      }).join("") + '</div><button type="button" class="expense-icon-clear" data-expense-icon="">Без емодзі</button>';
    function isIconTrigger(target) {
      return target && target.matches && target.matches("[data-expense-icon-trigger]");
    }
    document.addEventListener("click", function (event) {
      if (isIconTrigger(event.target)) showExpenseIconPicker(event.target);
      else if (!picker.contains(event.target)) closeExpenseIconPicker();
    });
    picker.addEventListener("pointerdown", function (event) {
      if (event.target.closest("[data-expense-icon]")) event.preventDefault();
    });
    picker.addEventListener("click", function (event) {
      var button = event.target.closest("[data-expense-icon]");
      if (!button || !expenseIconTarget) return;
      setExpenseIconTrigger(expenseIconTarget, button.dataset.expenseIcon);
      var trigger = expenseIconTarget;
      closeExpenseIconPicker();
      trigger.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") closeExpenseIconPicker();
    });
    window.addEventListener("resize", positionExpenseIconPicker);
    window.addEventListener("scroll", function (event) {
      if (!picker.contains(event.target)) closeExpenseIconPicker();
    }, true);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", positionExpenseIconPicker);
  }

  var blockHelpTarget = null;

  function closeBlockHelpPopover(restoreFocus) {
    var popover = document.getElementById("blockHelpPopover");
    var target = blockHelpTarget;
    if (popover) popover.hidden = true;
    if (target) target.setAttribute("aria-expanded", "false");
    blockHelpTarget = null;
    if (restoreFocus && target && target.isConnected) target.focus({ preventScroll: true });
  }

  function positionBlockHelpPopover() {
    var popover = document.getElementById("blockHelpPopover");
    if (!popover || popover.hidden || !blockHelpTarget) return;
    if (!blockHelpTarget.isConnected) { closeBlockHelpPopover(false); return; }
    var rect = blockHelpTarget.getBoundingClientRect();
    var viewport = window.visualViewport;
    var topEdge = viewport ? viewport.offsetTop : 0;
    var bottomEdge = topEdge + (viewport ? viewport.height : window.innerHeight);
    var leftEdge = viewport ? viewport.offsetLeft : 0;
    var rightEdge = leftEdge + (viewport ? viewport.width : window.innerWidth);
    var top = rect.bottom + 8;
    if (top + popover.offsetHeight > bottomEdge - 10) top = rect.top - popover.offsetHeight - 8;
    var left = rect.right - popover.offsetWidth;
    popover.style.top = Math.max(topEdge + 10, top) + "px";
    popover.style.left = Math.max(leftEdge + 10, Math.min(left, rightEdge - popover.offsetWidth - 10)) + "px";
  }

  function openBlockHelpPopover(trigger) {
    var popover = document.getElementById("blockHelpPopover");
    var info = BLOCK_HELP[trigger.dataset.blockHelp];
    if (!popover || !info) return;
    if (blockHelpTarget === trigger && !popover.hidden) { closeBlockHelpPopover(true); return; }
    if (blockHelpTarget) blockHelpTarget.setAttribute("aria-expanded", "false");
    blockHelpTarget = trigger;
    trigger.setAttribute("aria-expanded", "true");
    document.getElementById("blockHelpTitle").textContent = info.title;
    var body = document.getElementById("blockHelpBody");
    body.replaceChildren();
    info.body.forEach(function (paragraph) {
      var p = document.createElement("p");
      p.textContent = paragraph;
      body.appendChild(p);
    });
    popover.hidden = false;
    positionBlockHelpPopover();
  }

  function ensureBlockHelpButtons(root) {
    if (blockHelpTarget && !blockHelpTarget.isConnected) closeBlockHelpPopover(false);
    (root || document).querySelectorAll("[data-help-key]").forEach(function (block) {
      var key = block.dataset.helpKey;
      var info = BLOCK_HELP[key];
      if (!info) return;
      block.classList.add("has-block-help");
      var exists = Array.prototype.some.call(block.children, function (child) {
        return child.classList && child.classList.contains("block-help-button");
      });
      if (exists) return;
      var button = document.createElement("button");
      button.type = "button";
      button.className = "block-help-button";
      button.dataset.blockHelp = key;
      button.textContent = "?";
      button.title = "Як це працює";
      button.setAttribute("aria-label", "Як працює «" + info.title + "»");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-controls", "blockHelpPopover");
      button.setAttribute("aria-expanded", "false");
      block.appendChild(button);
    });
  }

  function wireBlockHelp() {
    var popover = document.getElementById("blockHelpPopover");
    var close = document.getElementById("blockHelpClose");
    if (!popover || !close) return;
    ensureBlockHelpButtons(document);
    document.addEventListener("click", function (event) {
      var trigger = event.target.closest && event.target.closest("[data-block-help]");
      if (trigger) { openBlockHelpPopover(trigger); return; }
      if (!popover.hidden && !popover.contains(event.target)) closeBlockHelpPopover(false);
    });
    close.addEventListener("click", function () { closeBlockHelpPopover(true); });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !popover.hidden) closeBlockHelpPopover(true);
    });
    window.addEventListener("resize", positionBlockHelpPopover);
    window.addEventListener("scroll", function (event) {
      if (!popover.contains(event.target)) closeBlockHelpPopover(false);
    }, true);
    if (window.visualViewport) window.visualViewport.addEventListener("resize", positionBlockHelpPopover);
  }

  function ensureExpenseCategoryFormExtras() {
    var form = document.getElementById("expenseCategoryForm");
    if (!form) return null;
    var iconInput = form.querySelector('input[name="icon"]');
    if (!iconInput) {
      iconInput = document.createElement("input");
      iconInput.type = "hidden";
      iconInput.name = "icon";
      iconInput.id = "newExpenseCategoryIcon";
      form.appendChild(iconInput);
    }
    var trigger = form.querySelector("[data-expense-icon-trigger]");
    if (!trigger) {
      trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "expense-cat-icon-button";
      trigger.setAttribute("data-expense-icon-trigger", "");
      trigger.setAttribute("aria-label", "Обрати емодзі категорії");
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-controls", "expenseIconPicker");
      trigger.setAttribute("aria-expanded", "false");
      var colorInput = form.querySelector('input[name="color"]');
      form.insertBefore(trigger, colorInput || form.querySelector("button"));
    }
    trigger.dataset.iconInputId = iconInput.id || "newExpenseCategoryIcon";
    setExpenseIconTrigger(trigger, iconInput.value);
    var presets = form.querySelector(".expense-cat-form-presets");
    if (presets) presets.remove();
    return iconInput;
  }

  function collectExpenseCategoryDrafts() {
    var wrap = document.getElementById("expenseCategoryList");
    var currentRows = expenseCats().slice();
    if (!wrap) return [];
    var rows = Array.prototype.slice.call(wrap.querySelectorAll("[data-cat-index]"));
    var drafts = [];
    var seen = Object.create(null);
    for (var index = 0; index < rows.length; index += 1) {
      var row = rows[index];
      var current = currentRows[index];
      if (!current) continue;
      var nameInput = row.querySelector("[data-cat-name]");
      var colorInput = row.querySelector("[data-cat-color]");
      var iconInput = row.querySelector("[data-cat-icon]");
      var nextName = normalizeExpenseCategoryName(nameInput && nameInput.value);
      if (!nextName) {
        showError("категорії", "Введи назву категорії.");
        if (nameInput) nameInput.focus();
        return null;
      }
      var key = nextName.toLocaleLowerCase("uk-UA");
      if (seen[key]) {
        showError("категорії", "Однакові назви категорій не можна зберегти.");
        if (nameInput) nameInput.focus();
        return null;
      }
      seen[key] = true;
      drafts.push({
        name: nextName,
        color: normalizeExpenseCategoryColor(colorInput && colorInput.value, current.color),
        icon: normalizeExpenseCategoryIcon(iconInput && iconInput.dataset.iconValue)
      });
    }
    return drafts;
  }

  function saveAllExpenseCategoryEdits() {
    var currentRows = expenseCats().slice();
    var nextRows = collectExpenseCategoryDrafts();
    if (!nextRows || nextRows.length !== currentRows.length) return;
    var changed = nextRows.some(function (row, index) {
      var current = currentRows[index];
      return !current || row.name !== current.name || row.color !== current.color || row.icon !== current.icon;
    });
    if (!changed) return;
    var renameClash = currentRows.some(function (current, index) {
      var next = nextRows[index];
      if (!next || next.name === current.name) return false;
      return currentRows.some(function (other, otherIndex) {
        return otherIndex !== index &&
          other.name.toLocaleLowerCase("uk-UA") === next.name.toLocaleLowerCase("uk-UA") &&
          nextRows[otherIndex] &&
          nextRows[otherIndex].name !== other.name;
      });
    });
    if (renameClash) {
      showError("категорії", "Взаємне перейменування зроби по черзі, щоб не змішати історію.");
      return;
    }
    var budgets = Object.assign({}, settings().budgets);
    currentRows.forEach(function (current, index) {
      var next = nextRows[index];
      if (!next || next.name === current.name) return;
      if (Object.prototype.hasOwnProperty.call(budgets, current.name) &&
        !Object.prototype.hasOwnProperty.call(budgets, next.name)) {
        budgets[next.name] = budgets[current.name];
      }
      delete budgets[current.name];
      renameExpenseCategoryRefs(current.name, next.name);
    });
    saveSettings({ expenseCategories: nextRows, budgets: budgets });
    currentRows.forEach(function (current, index) {
      var next = nextRows[index];
      if (next && next.name !== current.name) persistExpenseCategoryRename(current.name, next.name);
    });
    renderAll();
  }

  function renderExpenseCategorySettings() {
    ensureExpenseCategoryFormExtras();
    var wrap = document.getElementById("expenseCategoryList");
    if (!wrap) return;
    var rows = expenseCats();
    var signature = JSON.stringify(rows);
    // Синхронізація інших даних не повинна стирати незбережені поля категорій.
    if (wrap.dataset.categoriesSignature === signature) return;
    closeExpenseIconPicker();
    wrap.dataset.categoriesSignature = signature;
    wrap.classList.add("expense-cat-list");
    wrap.innerHTML = rows.map(function (row, index) {
      return '<div class="expense-cat-card">' +
        '<div class="expense-cat-row" data-cat-index="' + index + '">' +
        '<input type="text" class="expense-cat-name" data-cat-name value="' + esc(row.name) + '" maxlength="28" aria-label="Назва категорії" />' +
        '<button type="button" data-cat-icon data-expense-icon-trigger data-icon-value="' + esc(row.icon || "") + '" class="expense-cat-icon-button' + (row.icon ? '' : ' is-empty') + '" aria-label="Обрати емодзі для категорії ' + esc(row.name) + '" aria-haspopup="dialog" aria-expanded="false" aria-controls="expenseIconPicker">' + esc(row.icon || "🙂") + '</button>' +
        '<input type="color" data-cat-color value="' + esc(row.color) + '" aria-label="Колір категорії" />' +
        '<button class="icon-btn" type="button" data-del-expense-cat="' + esc(row.name) + '" aria-label="Видалити категорію">✕</button>' +
        '</div></div>';
    }).join("") + '<div class="expense-cat-actions"><button class="btn-primary" type="button" id="saveExpenseCategories">Оновити категорії</button></div>';
    wrap.querySelectorAll("[data-del-expense-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        dropExpenseCategory(btn.dataset.delExpenseCat);
      });
    });
    var saveButton = document.getElementById("saveExpenseCategories");
    if (saveButton) {
      saveButton.addEventListener("click", function () {
        saveAllExpenseCategoryEdits();
      });
    }
  }

  function saveExpenseCategoryEdit(index, rawName, rawColor, rawIcon) {
    var rows = expenseCats().slice();
    var current = rows[index];
    if (!current) return;
    var nextName = normalizeExpenseCategoryName(rawName);
    if (!nextName) { showError("категорії", "Введи назву категорії."); return; }
    var duplicate = rows.some(function (row, rowIndex) {
      return rowIndex !== index && row.name.toLocaleLowerCase("uk-UA") === nextName.toLocaleLowerCase("uk-UA");
    });
    if (duplicate) { showError("категорії", "Така категорія вже є."); return; }
    var nextColor = normalizeExpenseCategoryColor(rawColor, current.color);
    rows[index] = { name: nextName, color: nextColor, icon: normalizeExpenseCategoryIcon(rawIcon) };
    var budgets = Object.assign({}, settings().budgets);
    if (nextName !== current.name && Object.prototype.hasOwnProperty.call(budgets, current.name)) {
      budgets[nextName] = budgets[current.name];
      delete budgets[current.name];
      Object.keys(budgets).forEach(function (key) {
        if (key === current.name) delete budgets[key];
      });
      renameExpenseCategoryRefs(current.name, nextName);
      persistExpenseCategoryRename(current.name, nextName);
    }
    saveSettings({ expenseCategories: rows, budgets: budgets });
    renderAll();
  }

  function addExpenseCategory(rawName, rawColor, rawIcon) {
    var name = normalizeExpenseCategoryName(rawName);
    if (!name) { showError("категорії", "Введи назву для нової категорії."); return false; }
    var rows = expenseCats().slice();
    var duplicate = rows.some(function (row) { return row.name.toLocaleLowerCase("uk-UA") === name.toLocaleLowerCase("uk-UA"); });
    if (duplicate) { showError("категорії", "Така категорія вже є."); return false; }
    rows.push({
      name: name,
      color: normalizeExpenseCategoryColor(rawColor, DEFAULT_EXPENSE_CATEGORY_ROWS[rows.length % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color),
      icon: normalizeExpenseCategoryIcon(rawIcon)
    });
    saveSettings({ expenseCategories: rows });
    renderAll();
    return true;
  }

  function ensureExpenseCategoriesFromData() {
    var rows = expenseCats().slice();
    var known = Object.create(null);
    rows.forEach(function (row) { known[row.name.toLocaleLowerCase("uk-UA")] = true; });
    var missing = [];
    function push(raw) {
      var name = normalizeExpenseCategoryName(raw);
      if (!name) return;
      var key = name.toLocaleLowerCase("uk-UA");
      if (known[key]) return;
      known[key] = true;
      missing.push({
        name: name,
        color: DEFAULT_EXPENSE_CATEGORY_ROWS[(rows.length + missing.length) % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color,
        icon: ""
      });
    }
    Object.keys(settings().budgets || {}).forEach(push);
    state.transactions.forEach(function (t) { if (isExpense(t)) push(t.category); });
    state.recurring.forEach(function (r) { push(r.category); });
    var stamp = Object.keys(known).sort().join("|");
    if (!missing.length) { expenseCategorySyncStamp = stamp; return; }
    if (expenseCategorySyncStamp === stamp) return;
    expenseCategorySyncStamp = stamp;
    saveSettings({ expenseCategories: rows.concat(missing) });
  }

  function applySettingsToUi() {
    var s = settings();
    document.documentElement.classList.toggle("calm", !!s.calmMode);
    syncExpenseCategoryControls();
    var ae = document.getElementById("allowanceEnabled");
    if (ae) ae.checked = !!s.allowanceEnabled;
    var spe = document.getElementById("salaryPlanEnabled");
    if (spe) spe.checked = !!s.salaryPlanEnabled;
    var sa = document.getElementById("salaryAmount");
    if (sa && document.activeElement !== sa) sa.value = s.salaryAmount ? String(s.salaryAmount) : "";
    var wb = document.getElementById("weekBudget");
    if (wb && document.activeElement !== wb) wb.value = s.weekBudget ? String(s.weekBudget) : "";
    var wr = document.getElementById("weekReserve");
    if (wr && document.activeElement !== wr) wr.value = s.weekReserve ? String(s.weekReserve) : "";
    document.querySelectorAll("[data-weekday]").forEach(function (inp) {
      var index = Number(inp.dataset.weekday) || 0;
      if (document.activeElement !== inp) inp.value = s.weekDaily[index] ? String(s.weekDaily[index]) : "";
    });
    var cm = document.getElementById("calmMode");
    if (cm) cm.checked = !!s.calmMode;
    var ps = document.getElementById("pinSet");
    if (ps && document.activeElement !== ps) ps.value = s.pin ? "••••" : "";
    ensureExpenseCategoryFormExtras();
  }

  function refreshExpenseLabels() {
    document.querySelectorAll(".legend-row").forEach(function (row) {
      var cat = row.getAttribute("data-cat");
      var label = row.querySelector(".legend-cat");
      if (cat && label) label.textContent = expenseLabel(cat);
    });
    document.querySelectorAll("#txBody .row-cat").forEach(function (row) {
      var text = row.childNodes && row.childNodes.length > 1 ? row.childNodes[1] : null;
      if (!text || !text.nodeValue) return;
      var clean = text.nodeValue.replace(/\s+/g, " ").trim();
      var match = expenseCats().find(function (item) { return item.name === clean; });
      if (match) text.nodeValue = expenseLabel(match.name);
    });
  }

  function renderAllNow() {
    dropMonthCache();
    renderDashboardDate();
    var monthSwitcher = document.getElementById("monthSwitcher");
    if (monthSwitcher) monthSwitcher.hidden = state.view !== "main";
    var steps;
    if (state.view === "main") {
      steps = [renderStats, renderAllowance, renderWeekForecast, renderBudgets, renderDonut,
        renderTrend, renderLedger, renderDebts, renderTicker, renderPresets, syncSearchCats];
    } else if (state.view === "year") {
      steps = [renderYear];
    } else if (state.view === "plan") {
      steps = [renderRecurring, renderAmortize, renderDebts];
    } else if (state.view === "settings") {
      steps = [renderSettings];
    } else {
      steps = [];
    }
    steps.forEach(function (fn) { fn(); });
    if (state.view === "main") refreshExpenseLabels();
    ensureBlockHelpButtons(document);
  }

  var renderQueued = false;
  function renderAll() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      renderAllNow();
    });
  }

  function showCabinetProfile() {
    var tg = window.Telegram && window.Telegram.WebApp;
    var user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || (window.KOPIYKA_TELEGRAM && window.KOPIYKA_TELEGRAM.user) || {};
    var name = String(user.first_name || "Користувач").trim() || "Користувач";
    var avatar = document.getElementById("cabinetAvatar");
    var nameEl = document.getElementById("cabinetName");
    if (nameEl) nameEl.textContent = name;
    if (avatar) {
      avatar.textContent = name.slice(0, 1).toLocaleUpperCase("uk-UA");
      if (user.photo_url) { avatar.style.backgroundImage = "url(" + String(user.photo_url).replace(/[\"\\\\]/g, "") + ")"; avatar.textContent = ""; }
    }
    if (!tg || !tg.initData) return;
    fetch("/api/profile", { headers: { "X-Telegram-Init-Data": tg.initData, "Accept": "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (profile) {
        if (!profile) return;
        if (nameEl) nameEl.textContent = profile.firstName || name;
        if (avatar && profile.photoUrl) { avatar.style.backgroundImage = "url(" + String(profile.photoUrl).replace(/[\"\\\\]/g, "") + ")"; avatar.textContent = ""; }
        var since = document.getElementById("cabinetSince");
        if (since && profile.since) {
          var date = new Date(profile.since + "T00:00:00");
          since.textContent = "з нами з " + date.toLocaleDateString("uk-UA", { month: "2-digit", year: "numeric" });
          since.hidden = false;
        }
      }).catch(function () {});
  }

  function showCabinetSecurity() {
    var menu = document.querySelector(".cabinet-menu");
    var detail = document.getElementById("cabinetDetail");
    if (!menu || !detail) return;
    menu.hidden = true; detail.hidden = false;
    var mode = localStorage.getItem("kopiyka_lock_mode") || "pin";
    var hasPin = !!settings().pin;
    detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button>' +
      '<h2 class="cabinet-detail-title">Захист входу</h2>' +
      '<label class="cabinet-choice"><input type="radio" name="cabinetLock" value="off"' + (!settings().lockEnabled ? ' checked' : '') + '> Вимкнено</label>' +
      '<label class="cabinet-choice"><input type="radio" name="cabinetLock" value="pin"' + (settings().lockEnabled && mode !== "biometric" ? ' checked' : '') + '> PIN-код</label>' +
      '<label class="cabinet-choice" id="cabinetBioChoice"><input type="radio" name="cabinetLock" value="biometric"' + (settings().lockEnabled && mode === "biometric" ? ' checked' : '') + '> ' + esc(biometricLabel()) + '</label>' +
      '<label class="setting-row"><span>PIN-код</span><input type="text" id="cabinetPin" inputmode="numeric" maxlength="12" placeholder="4–12 цифр" value="' + (hasPin ? "••••" : "") + '"></label>' +
      '<p class="setting-note">Біометрія — локальний замок пристрою. Сервер і далі перевіряє лише підпис Telegram.</p>';
    var tg = window.Telegram && window.Telegram.WebApp;
    var bio = tg && tg.BiometricManager;
    if (!bio || !bio.init) document.getElementById("cabinetBioChoice").hidden = true;
    document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
    detail.querySelectorAll('input[name="cabinetLock"]').forEach(function (input) {
      input.onchange = function () {
        var value = input.value;
        if (value === "off") { localStorage.removeItem("kopiyka_lock_mode"); saveSettings({ lockEnabled: false }); return; }
        if (!settings().pin) { showError("Захист входу", "Спершу задайте PIN-код."); input.checked = false; return; }
        if (value === "biometric") {
          if (!bio || !bio.init) { showError("Захист входу", "Біометрія недоступна на цьому пристрої."); input.checked = false; return; }
          try { bio.init(function () { if (!bio.isBiometricAvailable) { showError("Захист входу", "Біометрія недоступна на цьому пристрої."); return; } bio.requestAccess({ reason: "Щоб швидко відкривати Копійку" }, function (granted) { if (granted) { localStorage.setItem("kopiyka_lock_mode", "biometric"); saveSettings({ lockEnabled: true }); } }); }); } catch (_error) {}
          return;
        }
        localStorage.setItem("kopiyka_lock_mode", "pin"); saveSettings({ lockEnabled: true });
      };
    });
    document.getElementById("cabinetPin").onchange = function () {
      var value = String(this.value).trim();
      if (value === "••••") return;
      if (!/^\d{4,12}$/.test(value)) { showError("PIN", "PIN — від 4 до 12 цифр."); return; }
      hashPin(value).then(function (hash) { saveSettings({ pin: hash, lockEnabled: true }); localStorage.setItem("kopiyka_lock_mode", "pin"); sessionStorage.setItem("kopiyka_unlocked", "1"); });
    };
  }

  function showCabinetGlossary() {
    var menu = document.querySelector(".cabinet-menu");
    var detail = document.getElementById("cabinetDetail");
    var request = window.KOPIYKA_API_REQUEST;
    if (!menu || !detail || !request) return;
    menu.hidden = true; detail.hidden = false;
    detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button><h2 class="cabinet-detail-title">Мій словник</h2><div class="empty-note">Завантаження…</div>';
    document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
    request("/api/glossary", { method: "GET" }).then(function (data) {
      var rows = data.rows || [], cats = data.categories || [];
      var options = cats.map(function (cat) { return '<option value="' + esc(cat.id) + '">' + esc((cat.icon ? cat.icon + " " : "") + cat.name) + '</option>'; }).join("");
      detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button><h2 class="cabinet-detail-title">Мій словник</h2>' +
        '<form id="glossaryForm" class="stack-form"><input name="word" maxlength="32" placeholder="Слово, наприклад стіки" required><select name="categoryId">' + options + '</select><button class="btn-primary">Додати</button></form>' +
        '<input type="search" id="glossarySearch" placeholder="Пошук слова" aria-label="Пошук слова"><div id="glossaryList"></div>';
      document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
      var list = document.getElementById("glossaryList");
      function render(filter) {
        var needle = String(filter || "").toLocaleLowerCase("uk-UA");
        var visible = rows.filter(function (row) { return String(row.word || "").toLocaleLowerCase("uk-UA").includes(needle); });
        list.innerHTML = visible.length ? visible.map(function (row) {
          return '<div class="glossary-row" data-glossary-id="' + esc(row.id) + '"><div><b>' + esc(row.word) + '</b> → ' + esc((row.category.icon ? row.category.icon + " " : "") + row.category.name) + '<small>' + (row.source === "learned" ? "вивчено ботом" : "додано вручну") + " · " + row.hits + " разів" + '</small></div><select data-glossary-category>' + cats.map(function (cat) { return '<option value="' + esc(cat.id) + '"' + (cat.id === row.categoryId ? " selected" : "") + '>' + esc(cat.name) + '</option>'; }).join("") + '</select><button class="icon-btn" type="button" data-glossary-save>✎</button><button class="icon-btn" type="button" data-glossary-delete>✕</button></div>';
        }).join("") : '<div class="empty-note">Словник наповнюється сам, коли бот питає про незнайоме слово.</div>';
        list.querySelectorAll("[data-glossary-save]").forEach(function (button) { button.onclick = function () { var row = button.closest("[data-glossary-id]"); request("/api/glossary/" + encodeURIComponent(row.dataset.glossaryId), { method: "PATCH", body: JSON.stringify({ categoryId: row.querySelector("[data-glossary-category]").value }) }).then(function () { showCabinetGlossary(); }).catch(function (e) { reportFailure("словник", e); }); }; });
        list.querySelectorAll("[data-glossary-delete]").forEach(function (button) { button.onclick = function () { var row = button.closest("[data-glossary-id]"); confirmBox("Видалити слово зі словника?").then(function (ok) { if (!ok) return; request("/api/glossary/" + encodeURIComponent(row.dataset.glossaryId), { method: "DELETE" }).then(function () { showCabinetGlossary(); }).catch(function (e) { reportFailure("словник", e); }); }); }; });
      }
      render("");
      document.getElementById("glossarySearch").oninput = function () { render(this.value); };
      document.getElementById("glossaryForm").onsubmit = function (event) { event.preventDefault(); var fd = new FormData(event.target); request("/api/glossary", { method: "POST", body: JSON.stringify({ word: fd.get("word"), categoryId: fd.get("categoryId") }) }).then(function () { showCabinetGlossary(); }).catch(function (e) { reportFailure("словник", e); }); };
    }).catch(function (error) { detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button><div class="empty-note">Не вдалося відкрити словник.</div>'; document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; }; reportFailure("словник", error); });
  }

  var quickTokenForSession = "";

  /* navigator.clipboard у Telegram WebView доступний не завжди: на iOS він
     часто відсутній або мовчки відхиляє запис поза «довіреним» жестом. Тому
     спершу пробуємо його, а на невдачі — прихований textarea з execCommand,
     який працює й у старих webview. Якщо не вийшло й це — не мовчимо, а
     виділяємо текст на екрані, щоб людина скопіювала його вручну. */
  function copyQuickFallback(value) {
    var area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "readonly");
    area.style.position = "fixed";
    area.style.top = "-1000px";
    area.style.opacity = "0";
    document.body.appendChild(area);
    var ok = false;
    try {
      area.focus();
      area.select();
      area.setSelectionRange(0, value.length);
      ok = document.execCommand("copy");
    } catch (e) { ok = false; }
    area.remove();
    return ok;
  }

  function selectQuickText(id) {
    var el = document.getElementById(id);
    if (!el) return;
    try {
      var range = document.createRange();
      range.selectNodeContents(el);
      var selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    } catch (e) {}
  }

  function copyQuickValue(value, selectId) {
    var text = String(value || "");
    if (!text) return Promise.reject(new Error("empty"));
    function done() { showError("Швидкий запис", "Скопійовано."); return true; }
    function manual() {
      selectQuickText(selectId);
      showError("Швидкий запис", "Скопіюйте виділений текст вручну — Telegram не дав доступ до буфера.");
      return false;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done).catch(function () {
        return copyQuickFallback(text) ? done() : manual();
      });
    }
    return Promise.resolve(copyQuickFallback(text) ? done() : manual());
  }

  function quickErrorText(error) {
    var code = error && error.code;
    if (code === "unauthorized") return "Токен не підійшов. Створіть новий і замініть його в команді.";
    if (code === "bot_unreachable") return "Бот не може вам написати. Відкрийте чат із ботом і натисніть «Почати».";
    if (code === "rate_limited") return "Забагато запитів. Спробуйте за хвилину.";
    if (code === "http_404") return "Сервер не знає цього маршруту — оновіть застосунок і спробуйте ще раз.";
    return (error && error.message) || "Не вдалося виконати запит.";
  }

  // Перевірка йде тим самим шляхом, що й команда з iPhone: той самий URL,
  // той самий заголовок. Тому якщо вона проходить — пройде і Shortcut.
  function quickProbe(endpoint, token) {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Quick-Token": token },
      body: JSON.stringify({ probe: true })
    }).then(function (response) {
      return response.text().then(function (raw) {
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (!response.ok) {
          throw Object.assign(new Error((data && data.error) || ("HTTP " + response.status)), {
            code: (data && data.code) || ("http_" + response.status)
          });
        }
        return data || {};
      });
    });
  }

  function showCabinetQuick() {
    var menu = document.querySelector(".cabinet-menu");
    var detail = document.getElementById("cabinetDetail");
    var request = window.KOPIYKA_API_REQUEST;
    if (!menu || !detail || !request) return;
    menu.hidden = true; detail.hidden = false;
    detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button><h2 class="cabinet-detail-title">Швидкий запис з iPhone</h2><div class="empty-note">Завантаження…</div>';
    document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
    request("/api/quick/token", { method: "GET" }).then(function (data) {
      var tg = window.Telegram && window.Telegram.WebApp;
      var ios = !!(tg && tg.platform === "ios");
      var endpoint = String(data.publicUrl || window.location.origin).replace(/\/$/, "") + "/api/quick";
      var hasToken = !!quickTokenForSession;

      // Токен показуємо повністю й у кілька рядків: у Telegram копіювання в
      // буфер спрацьовує не завжди, тож людина мусить бачити весь рядок,
      // щоб виділити його пальцем.
      var tokenBox = hasToken
        ? '<div class="quick-value"><span class="quick-value-label">Ваш токен</span>' +
          '<code id="quickTokenValue">' + esc(quickTokenForSession) + '</code>' +
          '<div class="quick-value-actions">' +
          '<button class="btn" type="button" id="quickCopyToken">Копіювати токен</button>' +
          '<button class="btn" type="button" id="quickCopyBoth">Копіювати URL і токен</button>' +
          '</div>' +
          '<p class="setting-note">Збережіть його зараз: після виходу з екрана токен більше не показується — на сервері лежить лише його хеш.</p></div>'
        : (data.active
          ? '<p class="setting-note">Токен уже створений, але його не видно: сервер зберігає тільки хеш. Якщо ви його загубили — створіть новий, старий одразу перестане діяти.</p>'
          : '<p class="setting-note">Токен ще не створений.</p>');

      var probeBlock = hasToken
        ? '<button class="btn-primary" type="button" id="quickProbe">Перевірити підключення</button>' +
          '<p class="import-note" id="quickProbeNote" aria-live="polite"></p>'
        : '';

      var install = ios && hasToken && data.shortcutIcloudUrl
        ? '<button class="btn-primary" type="button" id="quickInstall">Додати команду на iPhone</button>' +
          '<p class="setting-note">iOS попередить, що команда звертається до мережі — це нормально.</p>' : '';

      var platformNote = data.shortcutIcloudUrl
        ? (ios ? '' : '<p class="setting-note">Готова команда додається лише з Telegram на iPhone. З іншого пристрою скористайтесь ручним налаштуванням нижче.</p>')
        : '<p class="setting-note">Готової команди поки немає — налаштуйте вручну за шістьма кроками нижче. Це одноразово, займає хвилини три.</p>';

      detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button>' +
        '<h2 class="cabinet-detail-title">Швидкий запис з iPhone</h2>' +
        '<p class="setting-note">Команда в «Швидких командах» надсилає витрату сюди, не відкриваючи Telegram. Підтвердження й вибір категорії приходять у чат із ботом.</p>' +
        '<p class="setting-note">Спершу відкрийте чат із ботом і натисніть «Почати» — інакше йому нема куди вам відповідати.</p>' +
        tokenBox +
        '<button class="' + (hasToken ? "btn" : "btn-primary") + '" type="button" id="quickCreate">' +
        (data.active || hasToken ? "Створити новий токен" : "Створити токен") + '</button>' +
        probeBlock + install + platformNote +
        '<details' + (!data.shortcutIcloudUrl ? ' open' : '') + '><summary>Налаштувати команду вручну</summary>' +
        '<div class="quick-value"><span class="quick-value-label">Адреса запиту</span><code id="quickUrlValue">' + esc(endpoint) + '</code>' +
        '<div class="quick-value-actions"><button class="btn" type="button" id="quickCopyUrl">Копіювати URL</button></div></div>' +
        '<ol class="quick-instructions">' +
        '<li>Відкрийте «Команди» (Shortcuts) і створіть нову.</li>' +
        '<li>Додайте дію «Запитати текст» (Ask for Input) з підказкою «Витрата».</li>' +
        '<li>Додайте «Отримати вміст URL» (Get Contents of URL) і вставте адресу вище.</li>' +
        '<li>Розгорніть її, виберіть метод <code>POST</code>, у Headers додайте ключ <code>X-Quick-Token</code> і вставте токен.</li>' +
        '<li>Request Body → JSON, поле <code>text</code> зі значенням «Запитаний текст» (Provided Input).</li>' +
        '<li>Додайте «Отримати значення зі словника» (Get Dictionary Value) з ключем <code>reply</code>, а після неї «Показати сповіщення».</li>' +
        '</ol>' +
        '<p class="setting-note">Далі додайте команду на екран «Додому» або в віджет — і витрата записується одним дотиком.</p></details>' +
        (data.active ? '<button class="btn" type="button" id="quickRevoke">Відкликати токен</button>' +
          '<p class="setting-note">Після відкликання команду перевстановлювати не треба: достатньо замінити значення заголовка X-Quick-Token у її налаштуваннях.</p>' : '') +
        '<p class="setting-note">На заблокованому екрані iPhone усе одно попросить розблокувати пристрій — це обмеження iOS.</p>';

      document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };

      var createButton = document.getElementById("quickCreate");
      createButton.onclick = function () {
        if (createButton.disabled) return;
        createButton.disabled = true;
        createButton.textContent = "Створюю…";
        request("/api/quick/token", { method: "POST", body: JSON.stringify({}) }).then(function (created) {
          if (!created || !created.token) throw Object.assign(new Error("Сервер не повернув токен."), { code: "empty_token" });
          quickTokenForSession = created.token;
          showCabinetQuick();
        }).catch(function (error) {
          console.error("[Копійка] швидкий запис:", error);
          createButton.disabled = false;
          createButton.textContent = "Створити новий токен";
          showError("Швидкий запис", quickErrorText(error));
        });
      };

      var copyToken = document.getElementById("quickCopyToken");
      if (copyToken) copyToken.onclick = function () { copyQuickValue(quickTokenForSession, "quickTokenValue"); };
      var copyBoth = document.getElementById("quickCopyBoth");
      if (copyBoth) copyBoth.onclick = function () {
        copyQuickValue("URL: " + endpoint + "\nX-Quick-Token: " + quickTokenForSession, "quickTokenValue");
      };
      var copyUrl = document.getElementById("quickCopyUrl");
      if (copyUrl) copyUrl.onclick = function () { copyQuickValue(endpoint, "quickUrlValue"); };

      var probeButton = document.getElementById("quickProbe");
      if (probeButton) probeButton.onclick = function () {
        var note = document.getElementById("quickProbeNote");
        probeButton.disabled = true;
        probeButton.textContent = "Перевіряю…";
        if (note) note.textContent = "";
        quickProbe(endpoint, quickTokenForSession).then(function (result) {
          probeButton.disabled = false;
          probeButton.textContent = "Перевірити ще раз";
          if (note) note.textContent = (result && result.reply) || "Готово.";
          if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
        }).catch(function (error) {
          console.error("[Копійка] перевірка швидкого запису:", error);
          probeButton.disabled = false;
          probeButton.textContent = "Перевірити підключення";
          if (note) note.textContent = quickErrorText(error);
        });
      };

      var installButton = document.getElementById("quickInstall");
      if (installButton) installButton.onclick = function () {
        copyQuickValue(quickTokenForSession, "quickTokenValue").then(function () {
          if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred("success");
          if (tg && tg.openLink) tg.openLink(data.shortcutIcloudUrl);
        });
      };

      var revoke = document.getElementById("quickRevoke");
      if (revoke) revoke.onclick = function () {
        confirmBox("Відкликати токен? Стара команда перестане працювати.").then(function (ok) {
          if (!ok) return;
          request("/api/quick/token", { method: "DELETE" }).then(function () {
            quickTokenForSession = "";
            showCabinetQuick();
          }).catch(function (error) { showError("Швидкий запис", quickErrorText(error)); });
        });
      };
    }).catch(function (error) {
      // Без цього екран назавжди лишався на «Завантаження…», і виглядало це
      // як «кнопка нічого не робить».
      console.error("[Копійка] швидкий запис:", error);
      detail.innerHTML = '<button class="btn" type="button" id="cabinetBack">‹ Кабінет</button>' +
        '<h2 class="cabinet-detail-title">Швидкий запис з iPhone</h2>' +
        '<p class="import-note">' + esc(quickErrorText(error)) + '</p>' +
        '<button class="btn-primary" type="button" id="quickRetry">Спробувати ще раз</button>';
      document.getElementById("cabinetBack").onclick = function () { detail.hidden = true; menu.hidden = false; };
      document.getElementById("quickRetry").onclick = showCabinetQuick;
    });
  }

  function wire() {
    wireExpenseIconPicker();
    wireBlockHelp();
    wireOnboarding();
    wireImportSheet();
    setInterval(refreshCalendarDay, 60000);
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) refreshCalendarDay();
    });
    var form = document.getElementById("txForm");
    var dateInput = form.querySelector('input[name="date"]');
    dateInput.value = todayISO();
    var currentType = "expense";
    form.dataset.type = currentType;
    var reserveToggle = document.getElementById("reserveToggle");
    var reserveInput = reserveToggle && reserveToggle.querySelector('input[name="reserve"]');
    fillSelect(document.getElementById("txCategory"), expenseCatNames());
    function syncTxMode() {
      if (!reserveToggle || !reserveInput) return;
      form.dataset.type = currentType;
      var showReserve = currentType === "expense";
      reserveToggle.hidden = !showReserve;
      reserveInput.disabled = !showReserve;
      if (!showReserve) reserveInput.checked = false;
    }
    syncTxMode();

    form.querySelectorAll(".type-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentType = btn.dataset.type;
        form.querySelectorAll(".type-toggle button").forEach(function (b) { b.classList.toggle("active", b === btn); });
        var catSel = document.getElementById("txCategory");
        catSel.hidden = false; catSel.required = true;
        fillSelect(catSel, currentType === "income" ? INCOME_CATS : expenseCatNames());
        syncTxMode();
      });
    });

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(form);
      var p = parseAmount(fd.get("amount"));
      if (!p.ok) { showError("журнал", p.msg); form.querySelector('input[name="amount"]').focus(); return; }
      var wallet = fd.get("wallet") || "Кеш";
      var payload = {
        type: currentType, amount: p.value, wallet: wallet,
        date: fd.get("date") || todayISO(), note: String(fd.get("note") || "").trim()
      };
      payload.category = fd.get("category");
      if (currentType === "expense") payload.reserve = fd.get("reserve") === "on";
      commitTx(payload);
      form.querySelector('input[name="amount"]').value = "";
      form.querySelector('input[name="note"]').value = "";
      if (reserveInput) reserveInput.checked = false;
      focusAmount();
    });

    document.getElementById("repeatLast").addEventListener("click", repeatLast);
    document.getElementById("prevMonth").addEventListener("click", function () { state.viewMonth = addMonths(state.viewMonth, -1); renderAll(); });
    document.getElementById("nextMonth").addEventListener("click", function () { state.viewMonth = addMonths(state.viewMonth, 1); renderAll(); });
    document.getElementById("prevYear").addEventListener("click", function () { state.viewYear--; renderYear(); });
    document.getElementById("nextYear").addEventListener("click", function () { state.viewYear++; renderYear(); });

    var appScroller = document.getElementById("app");
    var viewScrollPositions = Object.create(null);
    function rememberViewScroll(view) {
      if (appScroller) viewScrollPositions[view] = appScroller.scrollTop;
    }
    function restoreViewScroll(view) {
      if (!appScroller) return;
      requestAnimationFrame(function () {
        appScroller.scrollTop = viewScrollPositions[view] || 0;
      });
    }

    var vtBusy = false;
    document.querySelectorAll(".viewtab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        rememberViewScroll(state.view);
        state.view = tab.dataset.view;
        document.querySelectorAll(".viewtab").forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false");
        });
        function swap() {
          ["main", "year", "plan", "cabinet", "settings"].forEach(function (v) { document.getElementById("view-" + v).hidden = v !== state.view; });
          if (state.view === "cabinet") showCabinetProfile();
          renderAll();
          restoreViewScroll(state.view);
        }
        // A second transition started while one is still running rejects with
        // "invalid state", and a synchronous throw would leave the screen on
        // the old view entirely. The swap must happen either way — the
        // transition is decoration on top of it.
        if (document.startViewTransition && !state.settings.calmMode && !vtBusy) {
          vtBusy = true;
          var vt;
          try { vt = document.startViewTransition(swap); }
          catch (e) { vtBusy = false; swap(); return; }
          var done = function () { vtBusy = false; };
          if (vt && vt.finished && vt.finished.then) vt.finished.then(done, done);
          else done();
          if (vt && vt.ready && vt.ready.catch) vt.ready.catch(function () {});
        } else swap();
      });
    });

    document.querySelectorAll("[data-cabinet-target]").forEach(function (button) {
      button.addEventListener("click", function () {
        var target = button.dataset.cabinetTarget;
        if (target === "security") { showCabinetSecurity(); return; }
        if (target === "glossary") { showCabinetGlossary(); return; }
        if (target === "quick") { showCabinetQuick(); return; }
        if (target === "import") { showCabinetImport(); return; }
        rememberViewScroll(state.view);
        state.view = "settings";
        document.querySelectorAll(".viewtab").forEach(function (tab) {
          var on = tab.dataset.view === "settings";
          tab.classList.toggle("active", on); tab.setAttribute("aria-selected", on ? "true" : "false");
        });
        ["main", "year", "plan", "cabinet", "settings"].forEach(function (v) { document.getElementById("view-" + v).hidden = v !== "settings"; });
        var map = { security: "settings-security", categories: "settings-categories", limits: "settings-limits" };
        var el = document.getElementById(map[target]);
        renderAll();
        if (el) setTimeout(function () { el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 0);
      });
    });
    var support = document.getElementById("cabinetSupport");
    if (support) support.addEventListener("click", function (event) {
      var tg = window.Telegram && window.Telegram.WebApp;
      if (!tg || !tg.openTelegramLink) return;
      event.preventDefault();
      tg.openTelegramLink("https://t.me/mriya7");
    });

    // recurring
    fillSelect(document.getElementById("recCategory"), expenseCatNames());
    fillSelect(document.getElementById("recWallet"), WALLETS);
    document.getElementById("addRecBtn").addEventListener("click", function () {
      var f = document.getElementById("recForm"); f.hidden = !f.hidden;
    });
    document.getElementById("recForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("amount"));
      var name = String(fd.get("name") || "").trim();
      var day = Number(fd.get("day"));
      if (!name) { showError("регулярні", "Введи назву."); return; }
      if (!p.ok) { showError("регулярні", p.msg); return; }
      if (!(day >= 1 && day <= 31)) { showError("регулярні", "День місяця — від 1 до 31."); return; }
      store.add("recurring", {
        name: name, amount: p.value, category: fd.get("category"), wallet: fd.get("wallet"),
        day: day, active: true, startFrom: todayISO()
      }).then(function () { setTimeout(postDueRecurring, 50); }).catch(function (e) { reportFailure("регулярні", e); });
      ev.target.reset(); ev.target.hidden = true;
    });

    // amortize
    document.getElementById("addAmBtn").addEventListener("click", function () {
      var f = document.getElementById("amForm"); f.hidden = !f.hidden;
    });
    document.getElementById("amForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("amount"));
      var months = Number(fd.get("months"));
      var name = String(fd.get("name") || "").trim();
      if (!name) { showError("амортизація", "Введи назву."); return; }
      if (!p.ok) { showError("амортизація", p.msg); return; }
      if (!(months >= 1)) { showError("амортизація", "Періодичність — від 1 місяця."); return; }
      store.add("amortize", { name: name, amount: p.value, months: months, startDate: todayISO() })
        .catch(function (e) { reportFailure("амортизація", e); });
      ev.target.reset(); ev.target.hidden = true;
    });

    // debts
    document.getElementById("addDebtBtn").addEventListener("click", function () {
      var f = document.getElementById("debtForm"); f.hidden = !f.hidden;
    });
    document.getElementById("debtForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("amount"));
      var person = String(fd.get("person") || "").trim();
      if (!person) { showError("борги", "Вкажи, кому або хто."); return; }
      if (!p.ok) { showError("борги", p.msg); return; }
      store.add("debts", { direction: fd.get("direction"), person: person, amount: p.value, due: fd.get("due") || "", settled: false })
        .catch(function (e) { reportFailure("борги", e); });
      ev.target.reset(); ev.target.hidden = true;
    });

    // settings
    document.getElementById("salaryAmount").addEventListener("change", function () {
      var raw = String(this.value).trim();
      if (!raw) { saveSettings({ salaryAmount: 0 }); renderAll(); return; }
      var p = parseAmount(raw);
      if (!p.ok) { showError("налаштування", p.msg); this.focus(); return; }
      saveSettings({ salaryAmount: p.value });
      renderAll();
    });
    document.getElementById("salaryPlanEnabled").addEventListener("change", function () {
      saveSettings({ salaryPlanEnabled: this.checked });
      renderAll();
    });
    document.getElementById("addSalaryDay").addEventListener("click", function () {
      var days = settings().salaryDays.slice();
      if (days.length >= 6) return;
      days.push(Number(todayISO().slice(8, 10)));
      saveSettings({ salaryDays: days });
      renderAll();
    });
    document.getElementById("allowanceEnabled").addEventListener("change", function () {
      saveSettings({ allowanceEnabled: this.checked });
      renderAll();
    });
    document.getElementById("weekBudget").addEventListener("change", function () {
      var raw = String(this.value).trim();
      if (!raw) { saveSettings({ weekBudget: 0 }); renderAll(); return; }
      var p = parseAmount(raw);
      if (!p.ok) { showError("налаштування", p.msg); this.focus(); return; }
      saveSettings({ weekBudget: p.value });
      renderAll();
    });
    document.getElementById("weekReserve").addEventListener("change", function () {
      var raw = String(this.value).trim();
      if (!raw) { saveSettings({ weekReserve: 0 }); renderAll(); return; }
      var p = parseAmount(raw);
      if (!p.ok) { showError("налаштування", p.msg); this.focus(); return; }
      saveSettings({ weekReserve: p.value });
      renderAll();
    });
    document.querySelectorAll("[data-weekday]").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var raw = String(inp.value).trim();
        var next = normalizeWeekDaily(settings().weekDaily);
        if (!raw) next[Number(inp.dataset.weekday) || 0] = 0;
        else {
          var p = parseAmount(raw);
          if (!p.ok) { showError("налаштування", p.msg); inp.focus(); return; }
          next[Number(inp.dataset.weekday) || 0] = p.value;
        }
        saveSettings({ weekDaily: next });
        renderAll();
      });
    });
    var expenseCategoryForm = document.getElementById("expenseCategoryForm");
    if (expenseCategoryForm) {
      expenseCategoryForm.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var fd = new FormData(ev.target);
        if (addExpenseCategory(fd.get("name"), fd.get("color"), fd.get("icon"))) ev.target.reset();
        var icon = ensureExpenseCategoryFormExtras();
        var color = expenseCategoryForm.querySelector('input[name="color"]');
        if (color) color.value = DEFAULT_EXPENSE_CATEGORY_ROWS[expenseCats().length % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color;
        if (icon) icon.value = "";
      });
    }
    document.getElementById("calmMode").addEventListener("change", function () {
      saveSettings({ calmMode: this.checked });
      if (window.__guilloche) window.__guilloche.setCalm(this.checked);
      renderAll();
    });
    document.getElementById("pinSet").addEventListener("change", function () {
      var v = String(this.value).trim();
      if (v === "••••") return;
      if (!v) { saveSettings({ pin: "" }); showError("PIN", "Замок вимкнено."); return; }
      if (!/^\d{4,12}$/.test(v)) { showError("PIN", "PIN — від 4 до 12 цифр."); return; }
      hashPin(v).then(function (h) {
        saveSettings({ pin: h, lockEnabled: true });
        sessionStorage.setItem("kopiyka_unlocked", "1");
        showError("PIN", "Замок увімкнено. Він ховає екран, але не шифрує дані.");
      });
    });

    document.getElementById("btnCsv").addEventListener("click", doCsv);
    document.getElementById("btnDeleteAccount").addEventListener("click", requestAccountDeletion);

    // search
    document.getElementById("searchToggle").addEventListener("click", function () {
      var filters = document.getElementById("searchFilters");
      var open = filters.hidden;
      filters.hidden = !open;
      this.setAttribute("aria-expanded", String(open));
      this.textContent = open ? "⌃ Пошук" : "⌄ Пошук";
    });
    ["searchText", "searchMin", "searchMax"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", debounce(readSearch, 200));
    });
    ["searchCat", "searchFrom", "searchTo"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", readSearch);
    });
    document.getElementById("searchReset").addEventListener("click", resetSearch);

    // PIN gate
    document.getElementById("pinForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var v = document.getElementById("pinInput").value;
      hashPin(v).then(function (h) {
        if (h === settings().pin) {
          sessionStorage.setItem("kopiyka_unlocked", "1");
          document.getElementById("pinGate").hidden = true;
          if (state.ready) maybeStartOnboarding();
          focusAmount();
        } else {
          document.getElementById("pinNote").textContent = "Не той PIN";
          document.getElementById("pinInput").value = "";
        }
      });
    });

    // AI
    document.getElementById("aiBtn").addEventListener("click", function () {
      var p = document.getElementById("aiPanel");
      p.hidden = !p.hidden;
      if (!p.hidden) document.getElementById("aiInput").focus();
    });
    document.getElementById("aiClose").addEventListener("click", function () { document.getElementById("aiPanel").hidden = true; });
    document.querySelectorAll("[data-aimode]").forEach(function (b) {
      b.addEventListener("click", function () {
        aiMode = b.dataset.aimode;
        document.querySelectorAll("[data-aimode]").forEach(function (x) { x.classList.toggle("active", x === b); });
        document.getElementById("aiRun").textContent = aiMode === "write" ? "Розібрати" : "Спитати";
        document.getElementById("aiInput").placeholder = aiMode === "write"
          ? "кава 45, обід 180, вчора заправився на 900"
          : "скільки я залив у машину за півроку";
        document.getElementById("aiAnswer").hidden = true;
        aiDraft = []; renderDraft(); aiStatus("");
      });
    });
    document.getElementById("aiRun").addEventListener("click", function () {
      if (!caps.sample) return;
      var text = document.getElementById("aiInput").value.trim();
      if (!text) { aiStatus("Спочатку напиши текст."); return; }
      if (aiMode === "write") runAiWrite(text); else runAiAsk(text);
    });
    document.getElementById("aiStop").addEventListener("click", function () { if (aiCtl) aiCtl.abort(); });
    document.getElementById("aiInput").placeholder = "кава 45, обід 180, вчора заправився на 900";
  }

  function debounce(fn, ms) {
    var t = null;
    return function () { if (t) clearTimeout(t); t = setTimeout(fn, ms); };
  }

  /* ============================ boot ============================ */

  function bindStore() {
    COLLECTIONS.forEach(function (c) {
      store.subscribe(c, function (list) {
        state[c] = list;
        seen[c] = true;
        if (!state.ready) return;
        if (c === "transactions" || c === "recurring") ensureExpenseCategoriesFromData();
        if (c === "transactions") { syncNavarHistory(); maybeStartOnboarding(); }
        renderAll();
        if (c === "recurring" || c === "transactions") postDueRecurring();
      }, function (down) { setSync(down ? "warn" : (store.offline ? "local" : "online")); });
    });
    store.subscribeSettings(function (s) {
      seen.settings = true;
      state.settings = Object.assign(defaultSettings(), s);
      ensureExpenseCategoriesFromData();
      applySettingsToUi();
      lockIfNeeded();
      if (state.ready) {
        syncNavarHistory();
        maybeStartOnboarding();
        renderAll();
      }
    });
    // First paint once the initial snapshots have had a moment to land.
    setTimeout(function () {
      state.ready = true;
      runMigrations();
      ensureExpenseCategoriesFromData();
      postDueRecurring();
      renderAll();
      maybeStartOnboarding();
      focusAmount();
      introOnce();
    }, 260);
  }

  var introDone = false;
  function introOnce() {
    if (introDone) return;
    introDone = true;
  }

  // Форма готова до вводу одразу: курсор у сумі, на телефоні — цифрова
  // клавіатура (inputmode="decimal"). Замок має пріоритет над фокусом.
  function focusAmount() {
    if (!shouldAutoFocusAmount()) return;
    if (!document.getElementById("pinGate").hidden) return;
    if (!document.getElementById("confirmBack").hidden) return;
    var onb = document.getElementById("onboarding");
    if (onb && !onb.hidden) return;
    if (document.activeElement && document.activeElement.tagName === "INPUT") return;
    var el = document.querySelector('#txForm input[name="amount"]');
    if (el) try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
  }

  function init() {
    applySettingsToUi();
    wire();
    renderAll();

    var useCap = (window.claude && typeof window.claude.use === "function")
      ? window.claude.use.bind(window.claude)
      : function () { return Promise.resolve(null); };

    Promise.resolve(useCap("db")).catch(function () { return null; }).then(function (db) {
      caps.db = db;
      if (db) { store = makeDbStore(db); setSync("online"); }
      else { store = makeLocalStore(); setSync("local"); }
      bindStore();
      setTimeout(askDueSalaryPayments, 500);
      if (db) setTimeout(migrateLocalToDb, 900);
    });

    Promise.resolve(useCap("downloads")).catch(function () { return null; }).then(function (d) {
      caps.downloads = d;
      var has = !!d;
      ["btnCsv"].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.hidden = !has;
      });
    });

    Promise.resolve(useCap("sample")).catch(function () { return null; }).then(function (s) {
      caps.sample = s;
      document.getElementById("aiBtn").hidden = !s;
    });
  }

  function start() {
    try {
      init();
    } catch (err) {
      console.error(err);
      if (typeof window.__showBootError === "function") window.__showBootError();
      else throw err;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
