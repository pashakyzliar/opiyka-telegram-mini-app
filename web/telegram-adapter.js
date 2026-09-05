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

  function applyTelegramTheme() {
    if (!tg) return;
    var scheme = tg.colorScheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", scheme);
    document.documentElement.style.colorScheme = scheme;
    var p = tg.themeParams || {};
    var bg = p.bg_color || (scheme === "dark" ? "#0b1410" : "#efe9d9");
    document.documentElement.style.setProperty("--telegram-bg", bg);
    document.body.style.backgroundColor = bg;
    try {
      if (tg.setHeaderColor) tg.setHeaderColor(bg);
      if (tg.setBackgroundColor) tg.setBackgroundColor(bg);
    } catch (e) {}
  }

  function applyViewportHeight(value) {
    value = Number(value || 0);
    if (!(value > 0)) return;
    document.documentElement.style.setProperty("--tg-viewport-height", value + "px");
    document.documentElement.style.setProperty("--tg-viewport-stable-height", value + "px");
  }

  function syncViewportHeight(forceLive) {
    if (!tg) return;
    var stable = Number(tg.viewportStableHeight || 0);
    var live = Number(tg.viewportHeight || 0);
    applyViewportHeight(stable || (forceLive ? live : 0) || window.innerHeight);
  }

  function bootTelegram() {
    if (!tg) return;
    try {
      tg.ready();
      tg.expand();
      applyTelegramTheme();
      syncViewportHeight(true);
      if (tg.onEvent) tg.onEvent("themeChanged", applyTelegramTheme);
      if (tg.onEvent) tg.onEvent("viewportChanged", function (event) {
        if (event && event.isStateStable === false) return;
        syncViewportHeight(false);
      });
    } catch (e) { console.warn("Telegram WebApp init failed", e); }
    window.KOPIYKA_TELEGRAM = { webApp: tg, user: tg.initDataUnsafe && tg.initDataUnsafe.user };
  }

  function collectionSnapshot(cache, collection) {
    return {
      docs: (cache[collection] || []).map(function (row) {
        var copy = Object.assign({}, row);
        return { id: copy.id, data: function () { return Object.assign({}, copy); } };
      })
    };
  }

  function makeApiDb(initial) {
    var cache = initial || {};
    var collectionListeners = [];
    var settingsListeners = [];
    var timer = null;
    var refreshing = false;

    function notify() {
      collectionListeners.slice().forEach(function (item) {
        try { item.onData(collectionSnapshot(cache, item.collection)); }
        catch (e) { if (item.onError) item.onError(e); }
      });
      settingsListeners.slice().forEach(function (item) {
        try { item.onData({ exists: true, data: function () { return Object.assign({}, cache.settings || {}); } }); }
        catch (e) { if (item.onError) item.onError(e); }
      });
    }

    function refresh() {
      if (refreshing) return Promise.resolve(cache);
      refreshing = true;
      return request("/api/state", { method: "GET" }).then(function (next) {
        cache = next || {};
        notify();
        return cache;
      }).catch(function (err) {
        var collectionErrors = collectionListeners.slice();
        var settingsErrors = settingsListeners.slice();
        collectionListeners = [];
        settingsListeners = [];
        if (timer) { clearInterval(timer); timer = null; }
        collectionErrors.forEach(function (x) { if (x.onError) x.onError(err); });
        settingsErrors.forEach(function (x) { if (x.onError) x.onError(err); });
        throw err;
      }).finally(function () { refreshing = false; });
    }

    function startPolling() {
      if (timer || (!collectionListeners.length && !settingsListeners.length)) return;
      timer = setInterval(function () { refresh().catch(function () {}); }, 15000);
    }

    function afterWrite(result) {
      return refresh().catch(function () {}).then(function () { return result; });
    }

    function listenCollection(collection, onData, onError) {
      var item = { collection: collection, onData: onData, onError: onError };
      collectionListeners.push(item);
      onData(collectionSnapshot(cache, collection));
      startPolling();
      return function () { collectionListeners = collectionListeners.filter(function (x) { return x !== item; }); };
    }

    function listenSettings(onData, onError) {
      var item = { onData: onData, onError: onError };
      settingsListeners.push(item);
      onData({ exists: true, data: function () { return Object.assign({}, cache.settings || {}); } });
      startPolling();
      return function () { settingsListeners = settingsListeners.filter(function (x) { return x !== item; }); };
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

      return {
        offline: false,
        collection: collection,
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
