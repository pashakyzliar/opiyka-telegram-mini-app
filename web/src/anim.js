/* ===================================================================
   Гільйош із даних + моушн-шар.

   Гільйош — захисний візерунок банкнот: гіпотрохоїди й епітрохоїди,
   накладені тонкими лініями шар за шаром. Математика власна (формули
   параметричних кривих — загальновідомі); реалізацію писав під наші
   дані, дивлячись на підхід stabla/guillocheJS (HiDPI-canvas + анімація
   параметрів) та prabinpebam/guilloche (полярне зміщення точок).
   Код не копійований — обидва проєкти під MIT, але тут нічого з них
   дослівно не взято.
   =================================================================== */

(function () {
  "use strict";

  var canvas = document.getElementById("guilloche");
  if (!canvas) return;
  var ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  var calm = false;
  var running = false;
  var raf = null;
  var t0 = 0;

  // Поточні й цільові параметри: кожен місяць плавно перетікає в наступний.
  var cur = { petals: 6, amplitude: .4, density: 40, hue: 0, over: 0 };
  var tgt = { petals: 6, amplitude: .4, density: 40, hue: 0, over: 0 };

  var dpr = 1, W = 0, H = 0;
  var intro = 1;          // 1 = повністю проявлено; runIntro() опускає до 0

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = canvas.clientWidth || window.innerWidth || 360;
    H = canvas.clientHeight || 1100;
    // Канва фіксованої висоти: без цієї межі в iframe, що росте під контент,
    // вона вийшла б на кілька тисяч пікселів — десятки мегабайт ні за що.
    W = Math.min(W, 2000);
    H = Math.min(H, 1200);
    if (W < 768) dpr = Math.min(dpr, 1.5);
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function lerp(a, b, k) { return a + (b - a) * k; }

  function strokeColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--guilloche").trim() || "rgba(120,180,150,.15)";
  }
  function goldColor() {
    return getComputedStyle(document.documentElement).getPropertyValue("--gold").trim() || "#c9a447";
  }

  // Один виток розетки. k — відношення радіусів, воно й дає кількість
  // пелюсток; d — виліт пера, від нього залежить глибина хвилі.
  function rosette(cx, cy, R, k, d, phase, wobble) {
    var r = R / (k + 1);
    // Кількість точок на криву: на вузькому екрані втричі менша — око різниці
    // не бачить, а роботи для GPU суттєво менше.
    var steps = narrowNow
      ? Math.max(120, Math.round(34 * k))
      : Math.max(180, Math.round(60 * k));
    ctx.beginPath();
    for (var i = 0; i <= steps; i++) {
      var t = (i / steps) * Math.PI * 2 * 1.0;
      var a = (R - r) * Math.cos(t + phase);
      var b = (R - r) * Math.sin(t + phase);
      var c = d * Math.cos(((R - r) / r) * t + phase);
      var e = d * Math.sin(((R - r) / r) * t + phase);
      var x = a + c;
      var y = b - e;
      if (wobble) {
        // Деформація при перевищенні ліміту: радіус «дихає» нерівномірно.
        var w = 1 + wobble * 0.09 * Math.sin(t * (k + 2) + phase * 2.1);
        x *= w; y *= w;
      }
      if (i === 0) ctx.moveTo(cx + x, cy + y); else ctx.lineTo(cx + x, cy + y);
    }
    ctx.stroke();
  }

  var narrowNow = false;
  function draw(time) {
    var narrow = W < 768;
    narrowNow = narrow;
    var k = calm ? 1 : 0.055;
    cur.petals = lerp(cur.petals, tgt.petals, k);
    cur.amplitude = lerp(cur.amplitude, tgt.amplitude, k);
    cur.density = lerp(cur.density, tgt.density, k);
    cur.hue = lerp(cur.hue, tgt.hue, k);
    cur.over = lerp(cur.over, tgt.over, k);

    ctx.clearRect(0, 0, W, H);
    var cx = W / 2, cy = Math.min(H * 0.42, 420);
    var base = Math.min(W, H) * (narrow ? 0.52 : 0.42);

    var layers = Math.max(6, Math.round(cur.density / (narrow ? 9 : 3.2)));
    layers = Math.min(layers, narrow ? 10 : 34);

    ctx.lineWidth = narrow ? 0.7 : 0.55;
    ctx.strokeStyle = strokeColor();
    ctx.globalCompositeOperation = "source-over";

    var phase = reduce.matches || calm ? 0 : (time - t0) / 26000;

    var visible = intro >= 1 ? layers : Math.ceil(layers * intro);
    for (var i = 0; i < visible; i++) {
      var f = i / layers;
      var R = base * (0.30 + 0.70 * f);
      var d = R * (0.14 + cur.amplitude * 0.30);
      ctx.globalAlpha = 0.30 + 0.70 * (1 - f);
      rosette(cx, cy, R, cur.petals, d, phase * (1 + f * 0.35) + f * 0.5, cur.over);
    }

    // Тонка золота нитка по зовнішньому контуру — «у плюсі чи в мінусі».
    ctx.globalAlpha = cur.hue > 0.5 ? 0.30 : 0.12;
    ctx.strokeStyle = goldColor();
    ctx.lineWidth = narrow ? 0.9 : 0.8;
    rosette(cx, cy, base * 1.02, cur.petals, base * (0.14 + cur.amplitude * 0.30), phase * 0.7, cur.over);
    ctx.globalAlpha = 1;

    if (running && !reduce.matches && !calm) {
      // «Нижча частота перемальовування» на телефоні — кадр через один.
      if (narrow) {
        raf = -1;
        setTimeout(function () { raf = null; kick(); }, 33);
      } else {
        raf = requestAnimationFrame(draw);
      }
    } else raf = null;
  }

  function kick() {
    if (raf !== null) return;   // -1 = чекаємо на таймер throttling
    if (!t0) t0 = performance.now();
    raf = requestAnimationFrame(draw);
  }
  function start() {
    running = true;
    kick();
  }
  function stop() {
    running = false;
    if (raf !== null && raf !== -1) cancelAnimationFrame(raf);
    raf = null;
  }

  // Фон не крутиться, коли вкладку не видно.
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop(); else start();
  });
  window.addEventListener("resize", function () { resize(); kick(); });
  reduce.addEventListener("change", function () { kick(); });

  // Проявлення при завантаженні: лінії народжуються від центра назовні.
  var introStart = 0;
  function runIntro() {
    if (reduce.matches || calm) { intro = 1; return; }
    intro = 0; introStart = performance.now();
    (function tick(now) {
      intro = Math.min(1, (now - introStart) / 1100);
      kick();
      if (intro < 1) requestAnimationFrame(tick);
    })(performance.now());
    // Проявлення веде rAF, а він заморожений у прихованій вкладці. Без цієї
    // страховки фон лишився б порожнім, поки вкладку не відкриють — та сама
    // пастка, що й з числами: ефект не має бути умовою для картинки.
    setTimeout(function () { if (intro < 1) { intro = 1; kick(); } }, 1600);
  }
  window.__guillocheIntro = function () { return intro; };

  resize();
  start();
  runIntro();

  window.__guilloche = {
    intro: runIntro,
    update: function (p) {
      tgt.petals = Math.max(3, Math.min(13, p.petals || 6));
      tgt.amplitude = Math.max(0.05, Math.min(1.6, p.amplitude || 0.35));
      tgt.density = Math.max(20, Math.min(150, p.density || 40));
      tgt.hue = p.positive ? 1 : 0;
      tgt.over = p.over ? 1 : 0;
      kick();
    },
    setCalm: function (v) {
      calm = !!v;
      if (calm) { stop(); ctx.clearRect(0, 0, W, H); }
      else { start(); }
    },
    redraw: function () { kick(); },
    // Діагностика: синхронно малює N кадрів і повертає середню вартість
    // кадру в мс. Потрібно, щоб міряти продуктивність, а не вгадувати її.
    cost: function (n) {
      n = n || 30;
      var saved = intro;
      intro = 1;                       // міряємо повний кадр, не проявлення
      var t = performance.now();
      for (var i = 0; i < n; i++) draw(t + i * 16.7);
      intro = saved;
      var ms = (performance.now() - t) / n;
      return { msPerFrame: Math.round(ms * 100) / 100, maxFps: Math.round(1000 / Math.max(ms, 0.01)) };
    }
  };
})();

/* ===================================================================
   GSAP — вантажимо з cdnjs (єдиний хост скриптів, дозволений CSP
   артефакту). Якщо не завантажився, усе працює далі: кожна анімація
   тут — надбудова над уже намальованим станом, ніколи не умова для
   запису даних.
   =================================================================== */

(function () {
  "use strict";

  window.__motion = {
    ready: false,
    tweenNumber: null,
    flipCapture: null,
    flipPlay: null
  };

  function install() {
    var g = window.gsap;
    if (!g) return;
    try { if (window.Flip) g.registerPlugin(window.Flip); } catch (e) {}

    // Числа тягне GSAP по проміжному об'єкту зі snap — саме так, а не
    // власним лічильником: попередній саморобний лічильник уже давав
    // застряглі суми.
    var settleTimers = new WeakMap();
    window.__motion.tweenNumber = function (el, from, to, format, negClass) {
      function land() {
        el.textContent = format(to);
        if (negClass) el.classList.toggle("negative", to < 0);
      }
      // Нема сенсу рахувати цифри там, де тікер не йде: у прихованій вкладці
      // rAF заморожений, і твін застигає на випадковому проміжному числі —
      // рівно той баг, через який суми колись «не перераховувались».
      if (document.visibilityState !== "visible") { land(); return; }

      g.killTweensOf(el);
      var box = { v: isFinite(from) ? from : to };
      var tw = g.to(box, {
        v: to, duration: 0.65, ease: "power3.out",
        snap: { v: 0.01 },
        onUpdate: function () {
          el.textContent = format(box.v);
          if (negClass) el.classList.toggle("negative", box.v < 0);
        },
        onComplete: land
      });
      // Страховка таймером (він тікає і без rAF): хоч би що сталося з
      // анімацією, за 900 мс на екрані стоїть кінцеве число.
      var prev = settleTimers.get(el);
      if (prev) clearTimeout(prev);
      settleTimers.set(el, setTimeout(function () {
        try { tw.kill(); } catch (e) {}
        land();
      }, 900));
    };

    if (window.Flip) {
      var snapshot = null;
      window.__motion.flipCapture = function (root) {
        try { snapshot = window.Flip.getState(root.querySelectorAll("tr")); } catch (e) { snapshot = null; }
      };
      window.__motion.flipPlay = function () {
        if (!snapshot) return;
        try {
          window.Flip.from(snapshot, { duration: 0.45, ease: "power2.out", stagger: 0.012, absolute: true, onEnter: function (els) { return g.fromTo(els, { opacity: 0 }, { opacity: 1, duration: 0.3 }); }, onLeave: function (els) { return g.to(els, { opacity: 0, duration: 0.2 }); } });
        } catch (e) {}
        snapshot = null;
      };
    }

    // Розліт цифр по одній із фольговим відблиском. SplitText на cdnjs нема,
    // тож розбиваємо рядок самі — ефект той самий, без плагіна.
    window.__motion.splitReveal = function (el) {
      if (!el || el.dataset.split === "1") return;
      var text = el.textContent;
      if (!text.trim()) return;
      el.dataset.split = "1";
      // Фольга на елементі — це background-clip:text по ЙОГО власному тексту.
      // Щойно текст переїжджає в дочірні span-и, ті лишаються прозорими й
      // число зникає. Тому кожен span отримує ту саму заливку, зі спільним
      // розміром і зсувом по його позиції — градієнт лишається наскрізним.
      var cs = getComputedStyle(el);
      var foil = cs.backgroundImage;
      var clipped = foil && foil !== "none" && cs.webkitTextFillColor === "rgba(0, 0, 0, 0)";
      var totalW = el.offsetWidth || 1;
      el.textContent = "";
      var chars = text.split("").map(function (ch) {
        var s = document.createElement("span");
        s.textContent = ch;
        s.style.display = "inline-block";
        s.style.whiteSpace = "pre";
        el.appendChild(s);
        return s;
      });
      if (clipped) {
        chars.forEach(function (s) {
          s.style.backgroundImage = foil;
          s.style.backgroundSize = (totalW * 2.2) + "px 100%";
          s.style.backgroundPosition = (-s.offsetLeft) + "px center";
          s.style.webkitBackgroundClip = "text";
          s.style.backgroundClip = "text";
          s.style.webkitTextFillColor = "transparent";
          s.style.color = "transparent";
        });
      }
      g.from(chars, {
        opacity: 0, yPercent: 60, rotateX: -55, duration: 0.55,
        stagger: 0.035, ease: "power3.out",
        onComplete: function () { el.textContent = text; delete el.dataset.split; }
      });
      // Страховка на випадок, коли тікер не піде: текст повертається без
      // анімації, а не зникає.
      setTimeout(function () {
        if (el.dataset.split === "1") { el.textContent = text; delete el.dataset.split; }
      }, 1400);
      g.fromTo(el, { "--foil-x": "0%" }, { "--foil-x": "100%", duration: 1.1, ease: "power2.inOut" });
    };

    window.__motion.ready = true;
    document.dispatchEvent(new CustomEvent("kopiyka:motion"));

    // Поява карток сходинкою — один раз, після завантаження.
    //
    // `gsap.from` лишає елемент на opacity:0 доти, доки тікер не відпрацює.
    // У прихованій вкладці rAF заморожений, тож картки могли лишитись
    // невидимими назавжди. Тому: анімуємо лише коли вкладку видно, і в будь-
    // якому разі через setTimeout (він іде і без rAF) стираємо інлайнові
    // стилі. Контент ніколи не залежить від того, чи відпрацювала анімація.
    var entrance = ".bento .cell, .panel";
    function clearEntrance() {
      try { g.set(entrance, { clearProps: "opacity,transform" }); } catch (e) {}
      document.querySelectorAll(entrance).forEach(function (el) {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
      });
    }
    if (document.visibilityState === "visible" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !document.documentElement.classList.contains("calm")) {
      try {
        g.from(".bento .cell", { opacity: 0, y: 18, duration: 0.5, stagger: 0.07, ease: "power2.out", clearProps: "all" });
        g.from(".panel", { opacity: 0, y: 14, duration: 0.5, stagger: 0.04, delay: 0.15, ease: "power2.out", clearProps: "all" });
      } catch (e) { clearEntrance(); }
      setTimeout(clearEntrance, 1500);
    }
  }

  if (window.gsap) install();
  else document.addEventListener("kopiyka:gsap", install, { once: true });
})();

/* -------------------------------------------------------------------
   Фольговий відблиск на великих цифрах їде за курсором, а на телефоні
   за нахилом пристрою. Дозвіл на датчик питаємо лише по дотику і
   мовчки відступаємо, якщо відмовили.
   ------------------------------------------------------------------- */

(function () {
  "use strict";
  var root = document.documentElement;
  function setFoil(pct) { root.style.setProperty("--foil-x", Math.max(0, Math.min(100, pct)) + "%"); }

  window.addEventListener("pointermove", function (e) {
    if (root.classList.contains("calm")) return;
    setFoil((e.clientX / window.innerWidth) * 100);
  }, { passive: true });

  function onTilt(e) {
    if (root.classList.contains("calm")) return;
    var g = e.gamma;
    if (typeof g !== "number") return;
    setFoil(((g + 45) / 90) * 100);
  }
  if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === "function") {
      document.addEventListener("click", function once() {
        document.removeEventListener("click", once);
        try {
          DeviceOrientationEvent.requestPermission().then(function (r) {
            if (r === "granted") window.addEventListener("deviceorientation", onTilt);
          }).catch(function () {});
        } catch (e) {}
      });
    } else {
      window.addEventListener("deviceorientation", onTilt);
    }
  }
})();
