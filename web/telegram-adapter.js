(function () {
  "use strict";

  var tg = window.Telegram && window.Telegram.WebApp;
  var apiBase = String(window.KOPIYKA_API_BASE || "").replace(/\/$/, "");
  var devUserId = String(window.KOPIYKA_DEV_USER_ID || "");
  var isFile = window.location.protocol === "file:";

  function initData() {
    return tg && tg.initData ? tg.initData : "";
  }

  function apiUrl(path) {
    return (apiBase || (isFile ? "" : window.location.origin)) + path;
  }

  function headers(json) {
    var h = { "Accept": "application/json" };
    if (json) h["Content-Type"] = "application/json";
    if (initData()) h["X-Telegram-Init-Data"] = initData();
    if (!initData() && devUserId) h["X-Dev-User-Id"] = devUserId;
    return h;
  }

  function request(path, options) {
    options = options || {};
    options.headers = Object.assign({}, headers(!!options.body), options.headers || {});
    return fetch(apiUrl(path), options).then(function (res) {
      return res.text().then(function (raw) {
        var data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (e) {}
        if (!res.ok) {
          var err = new Error((data && data.error) || ("HTTP " + res.status));
          err.code = (data && data.code) || ("http_" + res.status);
          throw err;
        }
        return data;
      });
    });
  }

  function saveBlob(filename, data) {
    var blob = new Blob([data], { type: filename.toLowerCase().indexOf(".csv") >= 0 ? "text/csv;charset=utf-8" : "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1000);
    return Promise.resolve();
  }

  var THEME_PARAM_VARS = {
    bg_color: "--tg-theme-bg-color",
    text_color: "--tg-theme-text-color",
    hint_color: "--tg-theme-hint-color",
    link_color: "--tg-theme-link-color",
    button_color: "--tg-theme-button-color",
    button_text_color: "--tg-theme-button-text-color",
    secondary_bg_color: "--tg-theme-secondary-bg-color",
    header_bg_color: "--tg-theme-header-bg-color",
    bottom_bar_bg_color: "--tg-theme-bottom-bar-bg-color",
    accent_text_color: "--tg-theme-accent-text-color",
    section_bg_color: "--tg-theme-section-bg-color",
    section_header_text_color: "--tg-theme-section-header-text-color",
    section_separator_color: "--tg-theme-section-separator-color",
    subtitle_text_color: "--tg-theme-subtitle-text-color",
    destructive_text_color: "--tg-theme-destructive-text-color"
  };

  function supports(version) {
    try { return !tg || !tg.isVersionAtLeast || tg.isVersionAtLeast(version); }
    catch (e) { return false; }
  }

  function syncTelegramChrome(surface) {
    if (!tg) return;
    var p = tg.themeParams || {};
    var bg = surface || p.bg_color || (tg.colorScheme === "dark" ? "#08121F" : "#F4F1FF");
    var header = surface || p.header_bg_color || bg;
    var bottom = surface || p.bottom_bar_bg_color || p.secondary_bg_color || bg;
    try {
      if (supports("6.1") && tg.setHeaderColor) tg.setHeaderColor(header);
      if (supports("6.1") && tg.setBackgroundColor) tg.setBackgroundColor(bg);
      if (supports("7.10") && tg.setBottomBarColor) tg.setBottomBarColor(bottom);
    } catch (e) {}
  }
  window.KOPIYKA_SYNC_TELEGRAM_CHROME = syncTelegramChrome;

  function setTelegramBackVisible(visible) {
    if (!tg || !supports("6.1") || !tg.BackButton) return;
    try {
      if (visible && tg.BackButton.show) tg.BackButton.show();
      if (!visible && tg.BackButton.hide) tg.BackButton.hide();
    } catch (e) {}
  }
  window.KOPIYKA_SET_TELEGRAM_BACK_VISIBLE = setTelegramBackVisible;

  function applyTelegramTheme() {
    if (!tg) return;
    var scheme = tg.colorScheme === "dark" ? "dark" : "light";
    var root = document.documentElement;
    var p = tg.themeParams || {};
    root.setAttribute("data-telegram-theme", scheme);
    Object.keys(THEME_PARAM_VARS).forEach(function (key) {
      if (p[key]) root.style.setProperty(THEME_PARAM_VARS[key], p[key]);
    });
    syncTelegramChrome();
    window.dispatchEvent(new CustomEvent("kopiyka:telegram-theme", { detail: { scheme: scheme } }));
  }

  function setPixelVar(name, value) {
    value = Number(value || 0);
    if (!(value > 0)) return;
    document.documentElement.style.setProperty(name, value + "px");
  }

  function syncViewportHeight(forceLive) {
    if (!tg) return;
    var stable = Number(tg.viewportStableHeight || 0);
    var live = Number(tg.viewportHeight || 0);
    setPixelVar("--app-viewport-height", live || stable || window.innerHeight);
    setPixelVar("--app-viewport-stable-height", stable || (forceLive ? live : 0) || window.innerHeight);
  }

  function syncSafeAreas() {
    if (!tg) return;
    var root = document.documentElement;
    var safe = tg.safeAreaInset || {};
    var content = tg.contentSafeAreaInset || {};
    ["top", "right", "bottom", "left"].forEach(function (side) {
      var outer = Math.max(0, Number(safe[side] || 0));
      var inner = Math.max(0, Number(content[side] || 0));
      root.style.setProperty("--app-tg-safe-" + side, outer + "px");
      root.style.setProperty("--app-tg-content-safe-" + side, inner + "px");
    });
  }

  function bootTelegram() {
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      applyTelegramTheme();
      syncViewportHeight(true);
      syncSafeAreas();
      if (tg.onEvent) tg.onEvent("themeChanged", applyTelegramTheme);
      if (tg.onEvent) tg.onEvent("viewportChanged", function (event) {
        syncViewportHeight(!(event && event.isStateStable === false));
      });
      if (tg.onEvent) tg.onEvent("safeAreaChanged", syncSafeAreas);
      if (tg.onEvent) tg.onEvent("contentSafeAreaChanged", syncSafeAreas);
      if (supports("6.1") && tg.BackButton && tg.BackButton.onClick) {
        tg.BackButton.onClick(function () {
          window.dispatchEvent(new CustomEvent("kopiyka:telegram-back"));
        });
      }
    } catch (e) { console.warn("Telegram WebApp init failed", e); }
    window.KOPIYKA_TELEGRAM = { webApp: tg, user: tg.initDataUnsafe && tg.initDataUnsafe.user };
  }

  function collectionSnapshot(cache, collection) {
    return {
      docs: (cache[collection] || []).map(function (row) {
        var copy = JSON.parse(JSON.stringify(row));
        return { id: copy.id, data: function () { return JSON.parse(JSON.stringify(copy)); } };
      })
    };
  }

  function settingsSnapshot(cache) {
    var copy = JSON.stringify(cache.settings || {});
    return { exists: true, data: function () { return JSON.parse(copy); } };
  }

  function makeApiDb(initial) {
    var cache = initial || {};
    var collectionListeners = [];
    var settingsListeners = [];
    var timer = null;
    var refreshPromise = null;

    function notify() {
      collectionListeners.slice().forEach(function (item) {
        var signature = JSON.stringify(cache[item.collection] || []);
        if (item.signature === signature) return;
        item.signature = signature;
        try { item.onData(collectionSnapshot(cache, item.collection)); }
        catch (e) { if (item.onError) item.onError(e); }
      });
      settingsListeners.slice().forEach(function (item) {
        var signature = JSON.stringify(cache.settings || {});
        if (item.signature === signature) return;
        item.signature = signature;
        try { item.onData(settingsSnapshot(cache)); }
        catch (e) { if (item.onError) item.onError(e); }
      });
    }

    function refresh() {
      if (refreshPromise) return refreshPromise;
      refreshPromise = request("/api/state", { method: "GET" }).then(function (next) {
        cache = next || {};
        notify();
        return cache;
      }).catch(function (err) {
        var collectionErrors = collectionListeners.slice();
        var settingsErrors = settingsListeners.slice();
        collectionListeners = [];
        settingsListeners = [];
        stopTimer();
        collectionErrors.forEach(function (x) { if (x.onError) x.onError(err); });
        settingsErrors.forEach(function (x) { if (x.onError) x.onError(err); });
        throw err;
      }).finally(function () { refreshPromise = null; });
      return refreshPromise;
    }

    /* Опитування сервера.
     *
     * Було: setInterval кожні 15 секунд, назавжди. Згорнутий Mini App
     * продовжував тягнути повний стан акаунта чотири рази на хвилину —
     * при тому що дані змінює той самий пристрій, який зараз нічого не
     * робить. Стало:
     *   • поки вкладка прихована, таймер зупинений повністю;
     *   • при поверненні — одне негайне оновлення й далі звичайний ритм;
     *   • інтервал зріс до 45 с, бо кожен власний запис і так робить
     *     refresh одразу після себе, тож полінг ловить лише зміни з бота
     *     чи іншого пристрою.
     */
    var POLL_MS = 45000;
    var visibilityBound = false;

    function hasListeners() {
      return !!(collectionListeners.length || settingsListeners.length);
    }

    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function startPolling() {
      bindVisibility();
      if (timer || !hasListeners()) return;
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      timer = setInterval(function () { refresh().catch(function () {}); }, POLL_MS);
    }

    function bindVisibility() {
      // Без document (тести у vm, неброузерне оточення) лишаємо звичайний
      // інтервал: краще зайве опитування, ніж падіння на старті підписки.
      if (visibilityBound || typeof document === "undefined") return;
      visibilityBound = true;
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "hidden") { stopTimer(); return; }
        if (!hasListeners()) return;
        // Поки застосунок був згорнутий, дані могли змінитись у боті —
        // тож спершу одне негайне оновлення, і лише потім звичайний ритм.
        refresh().catch(function () {});
        startPolling();
      });
    }

    function afterWrite(result) {
      // Поточний GET міг початися до запису: після нього потрібен свіжий стан.
      return (refreshPromise || Promise.resolve()).catch(function () {})
        .then(refresh).catch(function () {}).then(function () { return result; });
    }

    function stopUnusedPolling() {
      if (!hasListeners()) stopTimer();
    }

    function listenCollection(collection, onData, onError) {
      var item = { collection: collection, onData: onData, onError: onError, signature: JSON.stringify(cache[collection] || []) };
      collectionListeners.push(item);
      onData(collectionSnapshot(cache, collection));
      startPolling();
      return function () {
        collectionListeners = collectionListeners.filter(function (x) { return x !== item; });
        stopUnusedPolling();
      };
    }

    function listenSettings(onData, onError) {
      var item = { onData: onData, onError: onError, signature: JSON.stringify(cache.settings || {}) };
      settingsListeners.push(item);
      onData(settingsSnapshot(cache));
      startPolling();
      return function () {
        settingsListeners = settingsListeners.filter(function (x) { return x !== item; });
        stopUnusedPolling();
      };
    }

    function collection(name) {
      return {
        onSnapshot: function (onData, onError) { return listenCollection(name, onData, onError); },
        add: function (obj) {
          return request("/api/" + encodeURIComponent(name), { method: "POST", body: JSON.stringify(obj) })
            .then(function (result) { return afterWrite({ id: result.id }); });
        },
        doc: function (id) {
          var path = "/api/" + encodeURIComponent(name) + "/" + encodeURIComponent(id);
          return {
            set: function (obj) { return request(path, { method: "PUT", body: JSON.stringify(obj) }).then(afterWrite); },
            update: function (patch) { return request(path, { method: "PATCH", body: JSON.stringify(patch) }).then(afterWrite); },
            delete: function () { return request(path, { method: "DELETE" }).then(afterWrite); }
          };
        }
      };
    }

    // Імпорт виписки надсилає сотні рядків. Через звичайний add кожен із них
    // тягнув би за собою повне вичитування стану, тож тут запис іде пачкою з
    // обмеженою паралельністю, а стан оновлюється один раз у кінці.
    function bulkAdd(name, rows) {
      var list = (rows || []).slice();
      var path = "/api/" + encodeURIComponent(name);
      var index = 0;
      var failed = 0;
      function worker() {
        if (index >= list.length) return Promise.resolve();
        var row = list[index++];
        return request(path, { method: "POST", body: JSON.stringify(row) })
          .catch(function (error) { failed++; console.warn("Kopiyka bulk row failed", error && error.code); })
          .then(worker);
      }
      var lanes = [];
      for (var i = 0; i < Math.min(4, list.length); i++) lanes.push(worker());
      return Promise.all(lanes)
        .then(function () { return refresh().catch(function () {}); })
        .then(function () {
          if (failed && failed === list.length) throw Object.assign(new Error("Не вдалось записати жодного рядка."), { code: "bulk_failed" });
          return { added: list.length - failed, failed: failed };
        });
    }

      return {
        offline: false,
        collection: collection,
        bulkAdd: bulkAdd,
        exportAll: function () {
          return request("/api/export", { method: "GET" });
        },
        deleteAccount: function (payload) {
          return request("/api/account", { method: "DELETE", body: JSON.stringify(payload || {}) }).then(afterWrite);
        },
        doc: function (path) {
          if (path !== "settings/main") throw new Error("Unknown document: " + path);
          return {
          onSnapshot: listenSettings,
          set: function (settings) { return request("/api/settings", { method: "PUT", body: JSON.stringify(settings) }).then(afterWrite); }
        };
      }
    };
  }

  /* ======================= ЗМІНА: capability "sample" =======================
     app.js уже вміє все — runAiWrite() вносить операції, runAiAsk() будує
     фільтр для питання. Бракувало лише реалізації caps.sample. Контракт:

       sample.json(prompt, { signal }) -> Promise<розібраний JSON>

     Помилки мають нести .code, який розуміє handleAiError():
       "cancelled"    — користувач натиснув «Стоп»
       "not_granted"  — AI недоступний, кнопку треба сховати
       "rate_limited" — впертись у ліміт, показати «зачекай»
     ====================================================================== */

  function makeSample() {
    return {
      json: function (prompt, options) {
        var opts = options || {};
        if (opts.signal && opts.signal.aborted) {
          return Promise.reject(Object.assign(new Error("cancelled"), { code: "cancelled" }));
        }
        return request("/api/ai", {
          method: "POST",
          body: JSON.stringify({ prompt: String(prompt || "") }),
          signal: opts.signal
        }).then(function (data) {
          return data && Object.prototype.hasOwnProperty.call(data, "result") ? data.result : null;
        }).catch(function (err) {
          // fetch кидає AbortError без нашого коду — перекладаємо на "cancelled",
          // інакше app.js покаже «Не вийшло» замість «Скасовано».
          var aborted = (err && err.name === "AbortError") || (opts.signal && opts.signal.aborted);
          if (aborted) throw Object.assign(new Error("cancelled"), { code: "cancelled" });
          throw err;
        });
      }
    };
  }

  bootTelegram();
  window.KOPIYKA_API_REQUEST = request;

  window.claude = {
    use: function (capability) {
      if (capability === "downloads") {
        return Promise.resolve({ save: function (payload) { return saveBlob(payload.filename, payload.data); } });
      }
      if (capability === "sample") {
        if (isFile || (!initData() && !devUserId)) return Promise.resolve(null);
        // Статус безкоштовний — не витрачає квоту провайдера. Якщо сервер
        // каже enabled:false, кнопка AI просто не з'явиться.
        return request("/api/ai/status", { method: "GET" })
          .then(function (status) { return status && status.enabled ? makeSample() : null; })
          .catch(function () { return null; });
      }
      if (capability !== "db" || isFile || (!initData() && !devUserId)) return Promise.resolve(null);
      return request("/api/state", { method: "GET" }).then(function (state) {
        return makeApiDb(state);
      }).catch(function (err) {
        console.warn("Kopiyka API unavailable, using local storage", err);
        return null;
      });
    }
  };
})();
