(function () {
  "use strict";

  /* ============================ constants ============================ */

  var EXPENSE_CATS = ["Машина", "Пайка", "Хавка", "Дурка", "Продукти", "Сіги", "Подпіски"];
  var INCOME_CATS = ["ЗП", "Аванс", "Підробіток", "Інше"];
  var WALLETS = ["Кеш"];
 
  var LS_KEY = "kopiyka_v2";
  var COLLECTIONS = ["transactions", "goals", "recurring", "debts", "amortize"];

  var CAT_VAR = {
    "Машина": "--cat-1", "Пайка": "--cat-2", "Хавка": "--cat-3", "Дурка": "--cat-4",
    "Продукти": "--cat-5", "Сіги": "--cat-6", "Подпіски": "--cat-7"
  };
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
    
    var v = CAT_VAR[cat];
    return v ? css(v) : css("--ink-muted");
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
    return { budgets: {}, salaryDays: [5, 20], calmMode: false, pin: "", lastBackup: 0, streakRecord: 0, bestRate: null };
  }
  function settings() {
    var s = state.settings || {};
    if (!s.budgets) s.budgets = {};
    if (!Array.isArray(s.salaryDays) || !s.salaryDays.length) s.salaryDays = [5, 20];
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

  function isExpense(t) { return t.type === "expense"; }
  function isIncome(t) { return t.type === "income"; }
  function isTransfer(t) { return t.type === "transfer"; }

  // One render pass asks for the same month a dozen times over (stats, donut,
  // trend, ticker, delta...). Slice once per pass instead of re-filtering the
  // whole journal each time.
  var monthCache = Object.create(null);
  function dropMonthCache() { monthCache = Object.create(null); }
  function monthTx(mk) {
    var hit = monthCache[mk];
    if (hit) return hit;
    hit = state.transactions.filter(function (t) { return monthKey(t.date) === mk; });
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
    }, 0);
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

  function nextSalaryDate(fromISO) {
    var days = settings().salaryDays.slice().sort(function (a, b) { return a - b; });
    var p = fromISO.split("-");
    var y = +p[0], m = +p[1], d = +p[2];
    for (var i = 0; i < days.length; i++) {
      var dd = Math.min(days[i], daysInMonth(y, m));
      if (dd > d) return y + "-" + pad(m) + "-" + pad(dd);
    }
    var nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
    var first = Math.min(days[0], daysInMonth(ny, nm));
    return ny + "-" + pad(nm) + "-" + pad(first);
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

  function allowance() {
    var today = todayISO();
    var pay = nextSalaryDate(today);
    var daysLeft = Math.max(1, dayDiff(today, pay));
    var pend = pendingRecurring(today, pay);
    var pendSum = pend.reduce(function (s, x) { return s + (Number(x.rec.amount) || 0); }, 0);
    var free = totalBalance() - pendSum;
    var per = free / daysLeft;
    var spentToday = sum(state.transactions.filter(function (t) { return isExpense(t) && t.date === today; }));
    return { pay: pay, daysLeft: daysLeft, pendSum: pendSum, free: free, per: per, spentToday: spentToday };
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
    document.getElementById("statBalanceSub").innerHTML =
      
      '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>Кеш ' + esc(fmtShort(cash)) + '</span>';

    var mtx = monthTx(state.viewMonth);
    var income = sum(mtx.filter(isIncome));
    var expense = sum(mtx.filter(isExpense));
    animateValue(document.getElementById("statIncome"), prevStat.income, income, fmt);
    animateValue(document.getElementById("statExpense"), prevStat.expense, expense, fmt);
    prevStat.income = income; prevStat.expense = expense;

    var net = income - expense;
    // With no income at all a percentage of nothing is meaningless: say so
    // instead of printing a confident 0%.
    var rate = income > 0 ? Math.round((net / income) * 100) : null;
    var savEl = document.getElementById("statSavings");
    if (rate === null) {
      animGen.set(savEl, (animGen.get(savEl) || 0) + 1);
      savEl.textContent = expense > 0 ? "—" : "0%";
      savEl.className = "cell-value money";
      prevStat.savings = null;
    } else {
      animateValue(savEl, prevStat.savings, rate, function (v) { return Math.round(v) + "%"; });
      savEl.className = "cell-value money" + (rate < 0 ? " negative" : rate > 0 ? " positive" : "");
      prevStat.savings = rate;
    }

    
    var inCash = income;
    document.getElementById("statIncomeSub").innerHTML =
      
      '<span class="split-chip"><i style="background:' + walletColor("Кеш") + '"></i>Кеш ' + esc(fmtShort(inCash)) + '</span>';
    document.getElementById("statExpenseSub").textContent = mtx.filter(isExpense).length + " списань";
    document.getElementById("statSavingsSub").textContent =
      rate === null && expense > 0 ? "доходу цього місяця нема" : "чистими " + fmtShort(net);

    var months = [];
    for (var i = 5; i >= 0; i--) months.push(addMonths(monthKey(todayISO()), -i));
    var running = 0;
    state.transactions.forEach(function (t) {
      if (monthKey(t.date) < months[0]) running += isIncome(t) ? t.amount : isExpense(t) ? -t.amount : 0;
    });
    var pts = months.map(function (mk) {
      running += monthTx(mk).reduce(function (s, t) { return s + (isIncome(t) ? t.amount : isExpense(t) ? -t.amount : 0); }, 0);
      return running;
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
    var el = document.getElementById("allowanceValue");
    animateValue(el, prevStat.allowance, a.per, fmt, true);
    prevStat.allowance = a.per;
    document.getElementById("allowanceBasis").textContent =
      "до " + a.pay.split("-").reverse().slice(0, 2).join(".") + " · " + a.daysLeft + " дн.";
    document.getElementById("allowanceSpentToday").textContent = "Сьогодні витрачено " + fmtShort(a.spentToday);
    var card = document.getElementById("allowanceCard");
    var over = a.per > 0 && a.spentToday > a.per;
    card.classList.toggle("over", over);
    card.classList.toggle("under", !over && a.per > 0);
    document.getElementById("allowanceHint").textContent =
      a.per <= 0 ? "вільних коштів нема" : over ? "норму перевищено" : "у межах норми";
    var pct = a.per > 0 ? Math.min(100, (a.spentToday / a.per) * 100) : 100;
    document.getElementById("allowanceBar").style.width = pct + "%";
    document.getElementById("allowanceBar").classList.toggle("over", over);
  }

  function renderBudgets() {
    var wrap = document.getElementById("budgetList");
    wrap.innerHTML = "";
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var spent = {};
    mtx.forEach(function (t) { spent[t.category] = (spent[t.category] || 0) + t.amount; });
    var budgets = settings().budgets;
    EXPENSE_CATS.forEach(function (cat) {
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
    var cur = {}, prev = {};
    monthTx(state.viewMonth).filter(isExpense).forEach(function (t) { cur[t.category] = (cur[t.category] || 0) + t.amount; });
    monthTx(addMonths(state.viewMonth, -1)).filter(isExpense).forEach(function (t) { prev[t.category] = (prev[t.category] || 0) + t.amount; });
    var rows = EXPENSE_CATS.map(function (c) {
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
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var totals = {};
    mtx.forEach(function (t) { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    var entries = EXPENSE_CATS.map(function (c) { return { cat: c, amt: totals[c] || 0 }; })
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
    var today = todayISO();
    var p = today.split("-");
    var endOfMonth = p[0] + "-" + p[1] + "-" + pad(daysInMonth(+p[0], +p[1]));
    var list = pendingRecurring(today, endOfMonth);
    document.getElementById("upcomingNote").textContent = list.length ? fmtShort(list.reduce(function (s, x) { return s + Number(x.rec.amount || 0); }, 0)) : "нічого";
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
      '<span class="streak-rec">рекорд ' + s.record + '</span>' +
      (s.todayLogged ? '' : '<span class="streak-todo">сьогодні ще порожньо</span>');
  }

  var flipPending = false;
  function markFlip() { flipPending = true; }
  function filteredTx() {
    var list = monthTx(state.viewMonth);
    var f = state.filter;
    if (!f) return list;
    if (f.allMonths) list = state.transactions.slice();
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

    list.forEach(function (t) {
      var tr = document.createElement("tr");
      if (t.id === lastAddedId) { tr.classList.add("just-added"); lastAddedId = null; }
      if (t.recKey) tr.classList.add("is-recurring");
      var d = new Date(t.date + "T00:00:00");
      var color = colorFor(t.type, t.category);
      var wal = "";
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
    var cats = t.type === "income" ? INCOME_CATS : EXPENSE_CATS;
    var editor = document.createElement("tr");
    editor.className = "edit-row";
    editor.innerHTML = '<td colspan="6"><form class="edit-form">' +
      '<input type="date" name="date" value="' + esc(t.date) + '" required aria-label="Дата" />' +
      ('<select name="category" aria-label="Стаття">' + cats.map(function (c) {
        return '<option' + (c === t.category ? ' selected' : '') + '>' + esc(c) + '</option>';
      }).join("") + '</select>') +
      '<select name="wallet" aria-label="Гаманець">' + WALLETS.map(function (w) {
        return '<option' + (w === t.wallet ? ' selected' : '') + '>' + esc(w) + '</option>';
      }).join("") + '</select>' +
      '<input type="text" name="amount" inputmode="decimal" value="' + esc(t.amount) + '" required aria-label="Сума" />' +
      '<input type="text" name="note" maxlength="120" value="' + esc(t.note || "") + '" aria-label="Нотатка" />' +
      '<button class="btn-primary" type="submit">Зберегти</button>' +
      '<button class="btn" type="button" data-cancel>Скасувати</button></form></td>';
    tr.after(editor);
    editor.querySelector("[data-cancel]").addEventListener("click", function () { editor.remove(); });
    editor.querySelector("form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("amount"));
      if (!p.ok) { showError("журнал", p.msg); return; }
      var patch = { date: fd.get("date") || t.date, amount: p.value, note: String(fd.get("note") || "").trim(), wallet: fd.get("wallet") || t.wallet };
      patch.category = fd.get("category") || t.category;
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
    var rate = inc > 0 ? Math.round(((inc - exp) / inc) * 100) : null;
    document.getElementById("yearTotals").innerHTML =
      '<div class="cell"><span class="cell-label">Заносять</span><span class="cell-value positive money">' + esc(fmt(inc)) + '</span></div>' +
      '<div class="cell"><span class="cell-label">Спускаємо</span><span class="cell-value negative money">' + esc(fmt(exp)) + '</span></div>' +
      '<div class="cell"><span class="cell-label">Навар</span><span class="cell-value money">' + (rate === null ? "—" : rate + "%") + '</span></div>' +
      '<div class="cell"><span class="cell-label">Чистими</span><span class="cell-value money">' + esc(fmt(inc - exp)) + '</span></div>';

    var months = [];
    for (var m = 1; m <= 12; m++) months.push(state.viewYear + "-" + pad(m));
    var head = '<tr><th>Стаття</th>' + months.map(function (mk) { return '<th class="num">' + esc(monthShort(mk)) + '</th>'; }).join("") + '<th class="num">Разом</th></tr>';
    var rows = EXPENSE_CATS.map(function (cat) {
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
    var byMonth = {};
    state.transactions.forEach(function (t) {
      var mk = monthKey(t.date);
      if (!byMonth[mk]) byMonth[mk] = { inc: 0, exp: 0 };
      if (isIncome(t)) byMonth[mk].inc += t.amount;
      if (isExpense(t)) byMonth[mk].exp += t.amount;
    });
    var best = null;
    Object.keys(byMonth).forEach(function (mk) {
      var m = byMonth[mk];
      if (m.inc <= 0) return;
      var r = Math.round(((m.inc - m.exp) / m.inc) * 100);
      if (!best || r > best.rate) best = { mk: mk, rate: r };
    });
    var closed = state.goals.filter(function (g) { return g.closedAt; }).length;
    var s = streak();
    box.innerHTML = '<div class="hof-title">Рекорди</div>' +
      '<div class="record-row"><span>Найкращий місяць</span><span>' + (best ? esc(monthLabel(best.mk)) + " · " + best.rate + "%" : "—") + '</span></div>' +
      '<div class="record-row"><span>Рекорд серії</span><span>' + s.record + ' дн.</span></div>' +
      '<div class="record-row"><span>Закритих цілей</span><span>' + closed + '</span></div>';
    if (best && (settings().bestRate == null || best.rate > settings().bestRate)) {
      if (settings().bestRate != null) flashGold();
      saveSettings({ bestRate: best.rate });
    }
  }
  function flashGold() {
    var el = document.getElementById("statSavings");
    if (!el || state.settings.calmMode) return;
    el.classList.add("gold-flash");
    setTimeout(function () { el.classList.remove("gold-flash"); }, 1200);
  }

  function renderTicker() {
    var track = document.getElementById("tickerTrack");
    var mtx = monthTx(state.viewMonth).filter(isExpense);
    var totals = {};
    mtx.forEach(function (t) { totals[t.category] = (totals[t.category] || 0) + t.amount; });
    var parts = EXPENSE_CATS.map(function (c) {
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
    var steps = [renderStats, renderAllowance, renderBudgets, renderDelta, renderGoals, renderDonut,
      renderTrend, renderUpcoming, renderStreak, renderLedger, renderRecurring, renderAmortize,
      renderDebts, renderRecords, renderTicker, renderYear, renderPresets, syncSearchCats];
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
    EXPENSE_CATS.forEach(function (c) {
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
    var sd = document.getElementById("salaryDays");
    if (sd && document.activeElement !== sd) sd.value = s.salaryDays.join(", ");
    var cm = document.getElementById("calmMode");
    if (cm) cm.checked = !!s.calmMode;
    var ps = document.getElementById("pinSet");
    if (ps && document.activeElement !== ps) ps.value = s.pin ? "••••" : "";
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
    var copy = { type: last.type, category: last.category, amount: last.amount, wallet: last.wallet, date: todayISO(), note: last.note || "" };
    
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
            type: "expense", category: r.category || "Подпіски", amount: Number(r.amount) || 0,
            wallet: r.wallet || "Кеш", date: when, note: r.name, recKey: key, recId: r.id
          }, key, true);
        }
        mk = addMonths(mk, 1);
      }
    });
  }

  /* ============================ migration ============================ */

  function runMigrations() {
    var s = settings();
    var patch = {};
    // Old rows carried the wallet in `category` for income and had none at all
    // for expenses.
    var needWallet = state.transactions.filter(function (t) { return !t.wallet; });
    if (needWallet.length) {
      needWallet.forEach(function (t) {
        var up = {};
        if (t.type === "income" && (t.category === "Карта" || t.category === "Кеш")) { up.wallet = "Кеш"; up.category = "ЗП"; }
        else if (t.type === "income") { up.wallet = "Кеш"; if (INCOME_CATS.indexOf(t.category) < 0) up.category = "ЗП"; }
        else { up.wallet = "Кеш"; }
        store.update("transactions", t.id, up).catch(function () {});
      });
    }
    if (!s.migratedV3) patch.migratedV3 = true;
    if (Object.keys(patch).length) saveSettings(patch);
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
      saveSettings({ migratedFromLocal: true, budgets: Object.assign({}, (raw.settings && raw.settings.budgets) || {}, settings().budgets) });
      if (jobs.length) showError("міграція", "Перенесено " + jobs.length + " записів у спільну базу.");
    }).catch(function (e) { console.error("[Копійка] міграція:", e); });
  }

  /* ============================ backup / export ============================ */

  function snapshotPayload() {
    var out = { app: "kopiyka", version: 3, exportedAt: new Date().toISOString(), settings: settings() };
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
    return saveFile("kopiyka-" + todayISO() + ".json", JSON.stringify(snapshotPayload(), null, 2));
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
      expenseCategories: EXPENSE_CATS,
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
      "Категорію обирай лише зі списків вище. Якщо гаманець не вказано — \"Карта\". " +
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
    var cats = type === "income" ? INCOME_CATS : EXPENSE_CATS;
    var cat = cats.indexOf(r.category) >= 0 ? r.category : cats[0];
    var wallet = "Кеш";
    var date = /^\d{4}-\d{2}-\d{2}$/.test(String(r.date)) ? r.date : todayISO();
    return { type: type, category: cat, amount: amt, wallet: wallet, date: date, note: String(r.note || "").slice(0, 120) };
  }

  function renderDraft() {
    var box = document.getElementById("aiDraft");
    if (!aiDraft.length) { box.innerHTML = ""; return; }
    box.innerHTML = aiDraft.map(function (d, i) {
      var cats = d.type === "income" ? INCOME_CATS : EXPENSE_CATS;
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
        var cats = Array.isArray(f.categories) ? f.categories.filter(function (c) {
          return EXPENSE_CATS.indexOf(c) >= 0 || INCOME_CATS.indexOf(c) >= 0;
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
    if (sel.options.length > 1) return;
    EXPENSE_CATS.concat(INCOME_CATS).forEach(function (c) {
      var o = document.createElement("option"); o.value = c; o.textContent = c; sel.appendChild(o);
    });
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

  function wire() {
    var form = document.getElementById("txForm");
    var dateInput = form.querySelector('input[name="date"]');
    dateInput.value = todayISO();
    var currentType = "expense";
    fillSelect(document.getElementById("txCategory"), EXPENSE_CATS);
    
    

    form.querySelectorAll(".type-toggle button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        currentType = btn.dataset.type;
        form.querySelectorAll(".type-toggle button").forEach(function (b) { b.classList.toggle("active", b === btn); });
        var catSel = document.getElementById("txCategory");
        catSel.hidden = false; catSel.required = true;
          fillSelect(catSel, currentType === "income" ? INCOME_CATS : EXPENSE_CATS);
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
      commitTx(payload);
      form.querySelector('input[name="amount"]').value = "";
      form.querySelector('input[name="note"]').value = "";
      form.querySelector('input[name="amount"]').focus();
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
          ["main", "year", "plan"].forEach(function (v) { document.getElementById("view-" + v).hidden = v !== state.view; });
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

    // goals
    document.getElementById("addGoalBtn").addEventListener("click", function () {
      var gf = document.getElementById("goalForm"); gf.hidden = !gf.hidden;
    });
    document.getElementById("goalForm").addEventListener("submit", function (ev) {
      ev.preventDefault();
      var fd = new FormData(ev.target);
      var p = parseAmount(fd.get("target"));
      var name = String(fd.get("name") || "").trim();
      if (!name) { showError("схрон", "Введи назву."); return; }
      if (!p.ok) { showError("схрон", p.msg); return; }
      store.add("goals", { name: name, target: p.value, current: 0, deadline: fd.get("deadline") || null })
        .catch(function (e) { reportFailure("схрон", e); });
      ev.target.reset(); ev.target.hidden = true;
    });

    // recurring
    fillSelect(document.getElementById("recCategory"), EXPENSE_CATS);
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
    document.getElementById("salaryDays").addEventListener("change", function () {
      var days = String(this.value).split(/[^\d]+/).map(Number).filter(function (d) { return d >= 1 && d <= 31; });
      if (!days.length) { showError("налаштування", "Вкажи хоч один день від 1 до 31."); this.value = settings().salaryDays.join(", "); return; }
      saveSettings({ salaryDays: days.slice(0, 6) });
      renderAll();
    });
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
    document.getElementById("btnCsv").addEventListener("click", doCsv);
    document.getElementById("btnRestore").addEventListener("click", function () { document.getElementById("restoreFile").click(); });
    document.getElementById("restoreFile").addEventListener("change", function () {
      if (this.files && this.files[0]) doRestore(this.files[0]);
      this.value = "";
    });
    document.getElementById("nudgeSave").addEventListener("click", doBackup);
    document.getElementById("nudgeDismiss").addEventListener("click", function () {
      hideNudge(); saveSettings({ lastBackup: Date.now() - 6 * 86400000 });
    });

    // search
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
        renderAll();
        if (c === "recurring" || c === "transactions") postDueRecurring();
      }, function (down) { setSync(down ? "warn" : (store.offline ? "local" : "online")); });
    });
    store.subscribeSettings(function (s) {
      seen.settings = true;
      state.settings = Object.assign(defaultSettings(), s);
      applySettingsToUi();
      lockIfNeeded();
      if (state.ready) renderAll();
    });
    // First paint once the initial snapshots have had a moment to land.
    setTimeout(function () {
      state.ready = true;
      runMigrations();
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
    if (!document.getElementById("pinGate").hidden) return;
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

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
