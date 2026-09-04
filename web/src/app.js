(function () {
  "use strict";

  /* ============================ constants ============================ */

  var EXPENSE_CATS = ["Машина", "Пайка", "Хавка", "Дурка", "Продукти", "Сіги", "Подпіски"];
  var DEFAULT_EXPENSE_CATEGORY_ROWS = [
    { name: "Машина", color: "#5aa8ba" },
    { name: "Пайка", color: "#c08a4a" },
    { name: "Хавка", color: "#63b06e" },
    { name: "Дурка", color: "#b07dad" },
    { name: "Продукти", color: "#d29a5c" },
    { name: "Сіги", color: "#97a851" },
    { name: "Подпіски", color: "#7d8ecb" }
  ];
  var INCOME_CATS = ["ЗП", "Аванс", "Підробіток", "Інше"];
  var WALLETS = ["Кеш"];
 
  var EXPENSE_ICON_PRESETS = ["🚗", "🍱", "🍔", "🎉", "🛒", "🚬", "📦", "💳"];

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
      pin: "",
      lastBackup: 0,
      streakRecord: 0,
      bestRate: null
    };
  }
  function settings() {
    var s = state.settings || {};
    if (!s.budgets) s.budgets = {};
    if (!s.glossary || typeof s.glossary !== "object") s.glossary = {};
    s.expenseCategories = normalizeExpenseCategories(s.expenseCategories);
    if (!Array.isArray(s.salaryDays) || !s.salaryDays.length) s.salaryDays = [5, 20];
    s.allowanceEnabled = !!s.allowanceEnabled;
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
    if (mode === "online") { txt.textContent = "BAHA VORA"; }
    else if (mode === "local") { dot.classList.add("offline"); txt.textContent = "BAHA SPYT"; }
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

  var animGen = new WeakMap();
  function animateValue(el, from, to, formatFn, negClass) {
    if (!el) return;
    // The final value lands FIRST, synchronously. Everything below is
    // decoration painted over an already-correct number: if the tween engine
    // never ticks (a background tab throttles rAF, GSAP failed to load, an
    // animation throws) the screen still shows the right sum.
    el.textContent = formatFn(to);
    if (negClass) el.classList.toggle("negative", to < 0);
    if (state.settings && state.settings.calmMode) return;
    if (!isFinite(from) || from === to) return;

    // GSAP drives the count-up when it is there; the rAF loop below is the
    // fallback for a view where the library did not load.
    if (window.__motion && window.__motion.tweenNumber) {
      window.__motion.tweenNumber(el, from, to, formatFn, negClass);
      return;
    }
    from = isFinite(from) ? from : to;
    var myGen = (animGen.get(el) || 0) + 1;
    animGen.set(el, myGen);
    var start = null, dur = 650;
    function step(ts) {
      if (animGen.get(el) !== myGen) return;
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      var val = from + (to - from) * (1 - Math.pow(1 - p, 3));
      el.textContent = formatFn(val);
      if (negClass) el.classList.toggle("negative", val < 0);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function renderStats() {
    var balance = totalBalance();
    animateValue(document.getElementById("statBalance"), prevStat.balance, balance, fmt, true);
    prevStat.balance = balance;
    var cash = balance;
    var navarSum = totalNavar();
    document.getElementById("statBalanceSub").innerHTML =
      '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>Кеш ' + esc(fmtShort(cash)) + '</span>' +
      '<span class="split-chip"><i style="background:' + css("--gold") + '"></i>Навар ' + esc(fmtShort(navarSum)) + '</span>';

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
    var monthlyCard = document.getElementById("monthlyForecastCard");
    var bento = card ? card.closest(".bento") : null;
    var show = state.view === "main" && a.active && a.enabled;
    if (card) card.hidden = !show;
    if (monthlyCard) monthlyCard.hidden = !show;
    if (bento) bento.dataset.allowance = show ? "on" : "off";
    if (!show) return;
    var el = document.getElementById("allowanceValue");
    var visible = a.active && a.configured ? Math.max(0, a.weekAvailable) : 0;
    animateValue(el, prevStat.allowance, visible, fmt, true);
    prevStat.allowance = visible;
    var monthlyVisible = a.active && a.configured ? Math.max(0, a.todayAvailable) : 0;
    var monthlyEl = document.getElementById("monthlyForecastValue");
    animateValue(monthlyEl, null, monthlyVisible, fmt, true);
    document.getElementById("monthlyForecastBasis").textContent = "місячний залишок";
    document.getElementById("monthlyForecastSpent").textContent = "Сьогодні витрачено " + fmtShort(a.spentToday);
    document.getElementById("monthlyForecastHint").textContent = a.todayAvailable < 0 ? " · перевищення " + fmtShort(a.overBy) : "";
    document.getElementById("monthlyForecastBar").style.width = (a.todayLimit > 0 ? Math.min(100, (a.spentToday / a.todayLimit) * 100) : 0) + "%";
    document.getElementById("monthlyForecastBar").classList.toggle("over", a.todayAvailable < 0);
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
      var statusClass = item.isFuture ? "pending" : item.ok ? "ok" : "bad";
      var statusMark = item.isFuture ? "·" : item.ok ? "✓" : "✕";
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
    if (!open.length) wrap.innerHTML = '<div class="empty-note">Ще нема заначки. Почни з "Подушка безпеки".</div>';
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
      b.addEventListener("click", function () { store.remove("goals", b.dataset.delGoal).catch(function (e) { reportFailure("схрон", e); }); });
    });
    wrap.querySelectorAll("[data-contribute]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.contribute;
        var input = wrap.querySelector('[data-add="' + id + '"]');
        var p = parseAmount(input.value);
        if (!p.ok) { showError("схрон", p.msg); input.focus(); return; }
        var g = state.goals.find(function (x) { return x.id === id; });
        if (!g) return;
        var next = (g.current || 0) + p.value;
        var patch = { current: next };
        if (g.target > 0 && next >= g.target && !g.closedAt) {
          patch.closedAt = todayISO();
          celebrate(g.name);
        }
        store.update("goals", id, patch).catch(function (e) { reportFailure("схрон", e); });
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
    showError("схрон", "Ціль «" + name + "» закрита.");
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
      '<span class="split-chip"><i style="background:' + css("--negative") + '"></i>Спускаємо</span>';
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
    var useFlip = flipPending && window.__motion && window.__motion.flipCapture && !state.settings.calmMode;
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
      '<div class="cell"><span class="cell-label">Заносять</span><span class="cell-value positive money">' + esc(fmt(inc)) + '</span></div>' +
      '<div class="cell"><span class="cell-label">Спускаємо</span><span class="cell-value negative money">' + esc(fmt(exp)) + '</span></div>' +
      '<div class="cell"><span class="cell-label">Навар</span><span class="cell-value money">' + esc(fmt(navarYear)) + '</span></div>' +
      '<div class="cell"><span class="cell-label">Чистими</span><span class="cell-value money">' + esc(fmt(inc - exp)) + '</span></div>';

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
    if (!state.debts.length) { wrap.innerHTML = '<div class="empty-note">Боргів нема. Красава.</div>'; return; }
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
    var best = navarHistory().reduce(function (top, row) {
      if (!top || row.amount > top.amount) return row;
      return top;
    }, null);
    var s = streak();
    box.innerHTML = '<div class="hof-title">Рекорди</div>' +
      '<div class="record-row"><span>Найкращий перенос</span><span>' + (best ? esc(monthLabel(best.month)) + " · " + esc(fmtShort(best.amount)) : "—") + '</span></div>' +
      '<div class="record-row"><span>Рекорд серії</span><span>' + s.record + ' дн.</span></div>' +
      '<div class="record-row"><span>Місяців у наварі</span><span>' + navarHistory().length + '</span></div>';
  }

  function renderExpenseCategorySettings() {
    var wrap = document.getElementById("expenseCategoryList");
    if (!wrap) return;
    var rows = expenseCats();
    wrap.innerHTML = rows.map(function (row, index) {
      return '<div class="expense-cat-row" data-cat-index="' + index + '">' +
        '<span class="cat-dot expense-cat-dot" style="background:' + esc(row.color) + '"></span>' +
        '<input type="text" data-cat-name value="' + esc(row.name) + '" maxlength="28" aria-label="Назва категорії" />' +
        '<input type="color" data-cat-color value="' + esc(row.color) + '" aria-label="Колір категорії" />' +
        '<button class="btn" type="button" data-save-expense-cat="' + index + '">Оновити</button>' +
        '<button class="icon-btn" type="button" data-del-expense-cat="' + esc(row.name) + '" aria-label="Видалити категорію">✕</button>' +
        '</div>';
    }).join("");
    wrap.querySelectorAll("[data-save-expense-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".expense-cat-row");
        if (!row) return;
        saveExpenseCategoryEdit(Number(btn.dataset.saveExpenseCat), row.querySelector("[data-cat-name]").value, row.querySelector("[data-cat-color]").value);
      });
    });
    wrap.querySelectorAll("[data-del-expense-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        dropExpenseCategory(btn.dataset.delExpenseCat);
      });
    });
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
    if (expenseNote) expenseNote.textContent = expenseCatNames().length + " категорій · кольори одразу йдуть у журнал, ліміти та аналітику";
    renderExpenseCategorySettings();
  }

  function renderTicker() {
    var track = document.getElementById("tickerTrack");
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

  /* ============================ backup / export ============================ */

  function snapshotPayload() {
    var out = { app: "kopiyka", version: 5, exportedAt: new Date().toISOString(), settings: settings() };
    COLLECTIONS.forEach(function (c) { out[c] = state[c]; });
    return out;
  }

  function saveFile(filename, data) {
    if (!caps.downloads) { showError("копія", "Збереження файлів недоступне у цьому вікні."); return Promise.resolve(false); }
    return caps.downloads.save({ filename: filename, data: data }).then(function () {
      saveSettings({ lastBackup: Date.now() });
      hideNudge();
      return true;
    }).catch(function (e) {
      if (e && e.code === "declined") { showError("копія", "Збереження скасовано."); }
      else if (e && e.code === "rate_limited") { showError("копія", "Зачекай секунду і спробуй ще."); }
      else { showError("копія", "Не вдалось зберегти (" + ((e && e.code) || "помилка") + ")."); }
      return false;
    });
  }

  function doBackup() {
    var source = store && store.exportAll ? Promise.resolve(store.exportAll()) : Promise.resolve(snapshotPayload());
    return source.then(function (payload) {
      return saveFile("kopiyka-" + todayISO() + ".json", JSON.stringify(payload, null, 2));
    }).catch(function (e) {
      reportFailure("копія", e);
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

  function doRestore(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try { parsed = JSON.parse(String(reader.result)); }
      catch (e) { showError("відновлення", "Файл пошкоджений — це не коректний JSON."); return; }
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.transactions)) {
        showError("відновлення", "У файлі нема журналу операцій. Це не копія Копійки.");
        return;
      }
      confirmBox("Замінити всі поточні дані вмістом файлу? Операцій у файлі: " + parsed.transactions.length + ".").then(function (ok) {
        if (!ok) return;
        if (!state.ready) { showError("відновлення", "Дані ще вантажаться — спробуй за секунду."); return; }
        Promise.resolve(store.replaceAll(parsed)).then(function () {
          showError("відновлення", "Готово, дані замінено.");
        }).catch(function (e) { reportFailure("відновлення", e); });
      });
    };
    reader.onerror = function () { showError("відновлення", "Не вдалось прочитати файл."); };
    reader.readAsText(file);
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

  function maybeNudge() {
    if (!caps.downloads) return;
    var last = Number(settings().lastBackup) || 0;
    if (Date.now() - last < 7 * 86400000) return;
    if (!state.transactions.length) return;
    document.getElementById("backupNudge").hidden = false;
  }
  function hideNudge() { document.getElementById("backupNudge").hidden = true; }

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
    if (!s.pin) { document.getElementById("pinGate").hidden = true; return; }
    if (sessionStorage.getItem("kopiyka_unlocked") === "1") { document.getElementById("pinGate").hidden = true; return; }
    document.getElementById("pinGate").hidden = false;
    setTimeout(function () { document.getElementById("pinInput").focus(); }, 60);
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

  function ensureExpenseCategoryStyles() {
    if (document.getElementById("expenseCategoryIconStyles")) return;
    var style = document.createElement("style");
    style.id = "expenseCategoryIconStyles";
    style.textContent =
      '.expense-cat-form input[name="icon"]{width:72px;text-align:center;}' +
      '.expense-cat-row{grid-template-columns:auto auto minmax(0,1fr) 72px 48px auto auto;}' +
      '.expense-cat-icon-btn{min-width:52px;padding-inline:10px;}' +
      '.expense-cat-icon-input{text-align:center;}' +
      '.expense-cat-presets,.expense-cat-form-presets{display:flex;flex-wrap:wrap;gap:6px;grid-column:1 / -1;}' +
      '.expense-cat-preset{min-width:38px;padding:6px 8px;}' +
      '@media (max-width: 720px){.expense-cat-row{grid-template-columns:auto auto 1fr;}.expense-cat-icon-input,.expense-cat-row input[type="color"],.expense-cat-row .btn,.expense-cat-row .icon-btn,.expense-cat-presets{grid-column:1 / -1;}}';
    document.head.appendChild(style);
  }

  function ensureExpenseCategoryFormExtras() {
    var form = document.getElementById("expenseCategoryForm");
    if (!form) return null;
    ensureExpenseCategoryStyles();
    var iconInput = form.querySelector('input[name="icon"]');
    if (!iconInput) {
      iconInput = document.createElement("input");
      iconInput.type = "text";
      iconInput.name = "icon";
      iconInput.maxLength = 8;
      iconInput.placeholder = "🙂";
      iconInput.setAttribute("aria-label", "Іконка категорії");
      var colorInput = form.querySelector('input[name="color"]');
      form.insertBefore(iconInput, colorInput || form.querySelector("button"));
    }
    var presets = form.querySelector(".expense-cat-form-presets");
    if (!presets) {
      presets = document.createElement("div");
      presets.className = "expense-cat-form-presets";
      presets.innerHTML = EXPENSE_ICON_PRESETS.map(function (icon) {
        return '<button class="icon-btn expense-cat-preset" type="button" data-form-cat-preset="' + esc(icon) + '" aria-label="Швидка іконка">' + esc(icon) + '</button>';
      }).join("");
      form.parentNode.insertBefore(presets, form.nextSibling);
      presets.querySelectorAll("[data-form-cat-preset]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          iconInput.value = btn.dataset.formCatPreset || "";
          iconInput.focus();
        });
      });
    }
    return iconInput;
  }

  function renderExpenseCategorySettings() {
    ensureExpenseCategoryFormExtras();
    var wrap = document.getElementById("expenseCategoryList");
    if (!wrap) return;
    var rows = expenseCats();
    wrap.innerHTML = rows.map(function (row, index) {
      var presets = EXPENSE_ICON_PRESETS.map(function (icon) {
        return '<button class="icon-btn expense-cat-preset" type="button" data-cat-preset="' + esc(icon) + '" aria-label="Швидка іконка">' + esc(icon) + '</button>';
      }).join("");
      return '<div class="expense-cat-row" data-cat-index="' + index + '">' +
        '<span class="cat-dot expense-cat-dot" style="background:' + esc(row.color) + '"></span>' +
        '<button class="btn expense-cat-icon-btn" type="button" data-cat-pick-icon aria-label="Іконка категорії">' + esc(row.icon || "🙂") + '</button>' +
        '<input type="text" data-cat-name value="' + esc(row.name) + '" maxlength="28" aria-label="Назва категорії" />' +
        '<input type="text" data-cat-icon class="expense-cat-icon-input" value="' + esc(row.icon || "") + '" maxlength="8" placeholder="🙂" aria-label="Іконка категорії" />' +
        '<input type="color" data-cat-color value="' + esc(row.color) + '" aria-label="Колір категорії" />' +
        '<button class="btn" type="button" data-save-expense-cat="' + index + '">Оновити</button>' +
        '<button class="icon-btn" type="button" data-del-expense-cat="' + esc(row.name) + '" aria-label="Видалити категорію">✕</button>' +
        '<div class="expense-cat-presets">' + presets + '</div>' +
        '</div>';
    }).join("");
    wrap.querySelectorAll("[data-save-expense-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".expense-cat-row");
        if (!row) return;
        saveExpenseCategoryEdit(
          Number(btn.dataset.saveExpenseCat),
          row.querySelector("[data-cat-name]").value,
          row.querySelector("[data-cat-color]").value,
          row.querySelector("[data-cat-icon]").value
        );
      });
    });
    wrap.querySelectorAll("[data-cat-pick-icon]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".expense-cat-row");
        var input = row && row.querySelector("[data-cat-icon]");
        if (!input) return;
        input.focus();
        input.select();
      });
    });
    wrap.querySelectorAll("[data-cat-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var row = btn.closest(".expense-cat-row");
        var input = row && row.querySelector("[data-cat-icon]");
        var trigger = row && row.querySelector("[data-cat-pick-icon]");
        if (!input) return;
        input.value = btn.dataset.catPreset || "";
        if (trigger) trigger.textContent = input.value || "🙂";
      });
    });
    wrap.querySelectorAll("[data-cat-icon]").forEach(function (input) {
      input.addEventListener("input", function () {
        var row = input.closest(".expense-cat-row");
        var trigger = row && row.querySelector("[data-cat-pick-icon]");
        if (trigger) trigger.textContent = input.value || "🙂";
      });
    });
    wrap.querySelectorAll("[data-del-expense-cat]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        dropExpenseCategory(btn.dataset.delExpenseCat);
      });
    });
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
    var catColor = document.querySelector('#expenseCategoryForm input[name="color"]');
    if (catColor && document.activeElement !== catColor) {
      catColor.value = DEFAULT_EXPENSE_CATEGORY_ROWS[expenseCats().length % DEFAULT_EXPENSE_CATEGORY_ROWS.length].color;
    }
    ensureExpenseCategoryFormExtras();
    var catIcon = document.querySelector('#expenseCategoryForm input[name="icon"]');
    if (catIcon && document.activeElement !== catIcon) catIcon.value = "";
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

  function renderAll() {
    dropMonthCache();
    var steps = [renderStats, renderAllowance, renderWeekForecast, renderBudgets, renderDonut,
      renderTrend, renderLedger, renderRecurring, renderAmortize,
      renderDebts, renderRecords, renderTicker, renderYear, renderPresets, renderSettings, syncSearchCats];
    steps.forEach(function (fn) { fn(); });
    refreshExpenseLabels();
  }

  function wire() {
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

    var vtBusy = false;
    document.querySelectorAll(".viewtab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        state.view = tab.dataset.view;
        document.querySelectorAll(".viewtab").forEach(function (t) {
          var on = t === tab;
          t.classList.toggle("active", on); t.setAttribute("aria-selected", on ? "true" : "false");
        });
        function swap() {
          ["main", "year", "plan", "settings"].forEach(function (v) { document.getElementById("view-" + v).hidden = v !== state.view; });
          renderAll();
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
        saveSettings({ pin: h });
        sessionStorage.setItem("kopiyka_unlocked", "1");
        showError("PIN", "Замок увімкнено. Він ховає екран, але не шифрує дані.");
      });
    });

    document.getElementById("btnBackup").addEventListener("click", doBackup);
    document.getElementById("btnExportAccount").addEventListener("click", doBackup);
    document.getElementById("btnCsv").addEventListener("click", doCsv);
    document.getElementById("btnRestore").addEventListener("click", function () { document.getElementById("restoreFile").click(); });
    document.getElementById("btnDeleteAccount").addEventListener("click", requestAccountDeletion);
    document.getElementById("restoreFile").addEventListener("change", function () {
      if (this.files && this.files[0]) doRestore(this.files[0]);
      this.value = "";
    });
    document.getElementById("nudgeSave").addEventListener("click", doBackup);
    document.getElementById("nudgeDismiss").addEventListener("click", function () {
      hideNudge(); saveSettings({ lastBackup: Date.now() - 6 * 86400000 });
    });

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
          ? "сіги 65, кава 45, вчора заправився на 900"
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
    document.getElementById("aiInput").placeholder = "сіги 65, кава 45, вчора заправився на 900";
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
        if (c === "transactions") syncNavarHistory();
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
      maybeNudge();
      focusAmount();
      introOnce();
    }, 260);
  }

  var introDone = false;
  function introOnce() {
    if (introDone) return;
    introDone = true;
    if (state.settings.calmMode) return;
    if (window.__motion && window.__motion.splitReveal) {
      window.__motion.splitReveal(document.getElementById("allowanceValue"));
    }
  }

  // Форма готова до вводу одразу: курсор у сумі, на телефоні — цифрова
  // клавіатура (inputmode="decimal"). Замок має пріоритет над фокусом.
  function focusAmount() {
    if (!shouldAutoFocusAmount()) return;
    if (!document.getElementById("pinGate").hidden) return;
    if (!document.getElementById("confirmBack").hidden) return;
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
      ["btnBackup", "btnCsv", "btnRestore"].forEach(function (id) {
        var el = document.getElementById(id); if (el) el.hidden = !has;
      });
      if (has) maybeNudge();
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
