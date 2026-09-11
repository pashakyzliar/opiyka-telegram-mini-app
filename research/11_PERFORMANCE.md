# 11. Performance, стан на клієнті, надійність, error tracking

Дата: 11.09.2026.

## 1. Поточне навантаження фронтенду (розміри файлів без стиснення, ✓ з диска)

| Файл | Байти | Примітка |
|---|---:|---|
| `web/src/app.js` | 274,343 | моноліт: вся логіка всіх екранів |
| `web/src/style.css` | 124,670 | з семантичним шаром у кінці (UI-аудит) |
| `web/src/vendor/gsap.min.js` | 72,446 | GSAP 3.x |
| `web/src/markup.html` | 32,812 | розмітка всіх 6 екранів |
| `web/src/vendor/Flip.min.js` | 25,024 | GSAP Flip |
| `web/telegram-adapter.js` | 18,564 | |
| `web/src/anim.js` | 17,674 | |
| `web/index.html` | 3,360 | |
| **Разом** | **≈ 569 KB** | розмір після gzip не вимірювався — **UNVERIFIED** |

`app.js` і `style.css` віддаються з `Cache-Control: no-cache` (`server/app.js:57`), тобто з ревалідацією на кожен запуск. Вендор-файли й шрифти мають `immutable` на рік ✓. Чи віддає сервер gzip або brotli, треба перевірити: у `staticFile` видно лише `Cache-Control`.

## 2. Рекомендації для швидкого старту (за правилом ponytail)

| # | Рекомендація | Щабель ponytail | Ефект | Складність |
|---|---|---|---|---|
| 1 | **Виміряти базову лінію:** час до першого рендера й до інтерактивності на слабкому Android у Telegram. Режим налагодження Mini Apps на iOS є з 8.0 | — | без вимірювань усе інше лише здогадки | Low |
| 2 | Стиснення gzip / brotli статики (`zlib` з Node stdlib), якщо ще немає | 3 (stdlib) | зазвичай у кілька разів менше JS/CSS | Low |
| 3 | Контент-хешовані імена (`app.3f2a.js`) + `immutable` **або** ETag на статику | 4 (нативний HTTP) | повторний запуск без завантаження ~400 KB | Low |
| 4 | **Розбити `app.js` на нативні ES-модулі** (`<script type="module">`), екрани Аналітика / Roo / Кабінет підвантажувати через динамічний `import()` при першому відкритті | 4 (нативна платформа, **без збирача**) | менше JS на старті, простіше підтримувати | Medium |
| 5 | esbuild (★40,050, одна команда без конфігу) для мінімізації, **лише якщо** п.2–4 не дадуть потрібного результату | 5 | мінімізація й бандлінг | Low |
| 6 | **Кеш стану в `DeviceStorage`** (stale-while-revalidate): рендер з кешу за мілісекунди, потім фоновий `/api/state` | 4 (Telegram API) | миттєвий «Огляд» | Medium |
| 7 | Кастомний екран завантаження в BotFather (іконка й кольори) | 4 | сприйнята швидкість | Low |
| 8 | Шрифти Unbounded / Onest: `preload` woff2, сабсет кирилиця + латиниця, `font-display: swap` | 4 | менше блокування тексту | Low |
| 9 | Vite, Webpack, Next.js | — | IGNORE: заміна тулчейна не вирішує конкретної проблеми | — |

## 3. Runtime

| Питання | Зараз | Рекомендація |
|---|---|---|
| Опитування | 45 с, зупинка у фоні, негайний refresh при поверненні ✓ (`telegram-adapter.js:221-264`) | **ETag / 304 на `/api/state`** (09 §3 #2). SSE (`text/event-stream`, нативно) — лише якщо затримка змін з бота стане проблемою |
| Запис | `afterWrite()` чекає свіжого GET, лише потім оновлює UI (`telegram-adapter.js:266`) | **Optimistic UI:** рядок одразу в журналі, відкат при помилці + undo-тост |
| Офлайн | немає (fallback на `localStorage`, коли API недоступний) | черга записів у `DeviceStorage` з ключами ідемпотентності (для `/api/quick` ідемпотентність уже реалізовано, REPORT.md). Відправка при `activated` / `visibilitychange` |
| Service Worker / PWA | немає | IGNORE для TMA: підтримка SW у WebView Telegram на різних клієнтах **UNVERIFIED**, а виграш від DeviceStorage-кешу схожий |
| Сервер `/api/state` | повний стан на кожен запит | версія стану (max `updated_at`) → 304 без збирання JSON |

## 4. Керування станом (напрямок 21)

**Зараз:** власний адаптер з підписками та перевіркою сигнатури змін (`makeApiDb`, `telegram-adapter.js:178-359`) + глобальний `state` в `app.js`. Для vanilla-застосунку це прийнятно.

| Бібліотека | Розмір (gzip) | Vanilla? | Для нас |
|---|---:|---|---|
| Власний `store.js` (subscribe / get / set, ~40 рядків) | 0 | так | **✓ при модуляризації** (щабель 7: мінімальний код) |
| nanostores (★7,600, 6.6M/тиждень) | tiny (bundlephobia — UNVERIFIED) | так, фреймворк-незалежний | альтернатива, якщо потрібен протестований примітив |
| Zustand (★58,665) | 0.5 KB | так (`zustand/vanilla`) | альтернатива |
| Preact signals-core | UNVERIFIED | так | альтернатива (реактивність без React) |
| TanStack Query | `query-core` без адаптера незручний | частково | IGNORE: кешування запитів уже покриває адаптер |
| Redux Toolkit | — | так, але надлишковий | IGNORE |
| Jotai / Valtio | 3.2 / 2.5 KB | React-орієнтовані | IGNORE |
| TC39 Signals | — | ще не стандарт (репо оновлювалося 2025-08) | IGNORE |

## 5. Надійність

- ✓ `/health`, міграції в pre-deploy, Node 20.
- ⚠ Ліміти AI в пам'яті (10 §2 #2).
- ⚠ Одна репліка + майбутні регулярні задачі → pg-boss з singleton, щоб при деплої не було дублікатів (09 §4).
- Graceful shutdown (`SIGTERM` → завершити поточні запити й задачі) — перевірити в `server/server.js` (UNVERIFIED).

## 6. Error tracking (напрямок 25)

| Варіант | Модель | Ліцензія / статус | Для нас |
|---|---|---|---|
| **Мінімум: `window.onerror` + `unhandledrejection` → `POST /api/client-errors` → PG** | self | — | **✓ Phase 0**: 30 рядків, дані в нашій БД, без PII, stack обрізаний |
| Sentry (SaaS) + `@sentry/browser` / `@sentry/node` | SaaS (є безкоштовний tier, умови — UNVERIFIED) | SDK MIT, v10.74.0 від 09.09.2026 | **Phase 2**: source maps, групування, релізи |
| Sentry self-hosted | self | FSL (NOASSERTION на GitHub), важкий | IGNORE |
| **Bugsink** (★2,064, 2.5.1 від 31.08.2026) | self, сумісний з Sentry SDK | NOASSERTION — перевірити LICENSE | ✓ альтернатива, щоб дані лишалися в нашій інфраструктурі |
| GlitchTip | self, сумісний з Sentry | репо на GitLab, метрики **UNVERIFIED** | альтернатива |
| Highlight | SaaS / self | останній docker-реліз 2025-08-08 | IGNORE (ризик підтримки) |
| OpenTelemetry JS + SigNoz / HyperDX | трасування | Apache-2.0 / NOASSERTION / MIT | IGNORE, поки сервіс один |
