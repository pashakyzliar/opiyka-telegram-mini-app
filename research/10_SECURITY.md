# 10. Security: Telegram, API, AI, приватність фінансових даних

Дата: 11.09.2026.

## 1. Що вже зроблено добре (✓ перевірено в коді та README)

| Захід | Де |
|---|---|
| Валідація `initData` бібліотекою `@tma.js/init-data-node`: підпис, строк дії (`INIT_DATA_MAX_AGE=900`), future skew 60 с, дублікати параметрів | `server/auth/telegram.js` |
| `user_id` ніколи не береться з body, URL чи довільних заголовків | README, `server/app.js` |
| Telegram ID не зберігається: `HMAC-SHA-256(USER_ID_PEPPER, telegramId)` | `001_initial_schema.js` (`telegram_user_key` CHECK 64) |
| RLS (`app.current_user_id`) + composite FK з `user_id` + транзакції + advisory lock | `001_initial_schema.js`, `withUserContext` |
| `ensure_user_by_telegram_key` — `SECURITY DEFINER`, перевірка формату, `REVOKE ALL FROM PUBLIC` | `001_initial_schema.js:285-306` |
| У логи не потрапляють initData, суми, нотатки, Telegram ID. Мінімальний `security_audit_events` | README |
| `ALLOW_DEV_AUTH` лише поза production | README, `.env.example` |
| Екранування виводу AI в UI (`esc()`) | `web/src/app.js:1938-1946`, `3377-3383` |
| Числа рахує сервер, нотатки для моделі — дані (правило 3 промпту), ліміт циклу інструментів | `server/roo.js` |
| Видалення акаунта потребує двох підтверджень, експорт доступний | README |
| Швидкий запис: хеш токена, ліміт, ідемпотентність | `005_quick_write.js`, REPORT.md |
| Лише 3 runtime-залежності (`pg`, `node-pg-migrate`, `@tma.js/init-data-node`) | `package.json`. Мала поверхня атаки на ланцюжок постачання |

## 2. Знайдені прогалини

| # | Пріоритет | Проблема | Доказ | Що зробити |
|---|---|---|---|---|
| 1 | **P0** | **Немає security-заголовків** (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors`) | пошук `Content-Security-Policy|X-Frame-Options|Strict-Transport|frame-ancestors` у `server/` не дав збігів. `staticFile` ставить лише `Cache-Control` (`server/app.js:57`) | Додати заголовки вручну в `staticFile` і JSON-відповідях (helmet — middleware для Express, для `node:http` простіше перелічити заголовки самому, як радить ponytail). Див. §3 |
| 2 | **P0** | **Ліміти AI в пам'яті** обнуляються при рестарті й деплої | `server/ai.js:85-114` | Таблиця `ai_usage` в PG (09 §3 #4). Захищає від вичерпання квоти провайдера (OWASP LLM10 Unbounded Consumption) |
| 3 | **P0** | **Захист Mini App від викликів з чужих доменів** увімкнено автоматично 20.07.2026 (Bot API 10.2) | changelog | Перевірити, що `KOPIYKA_API_BASE` (`web/telegram-adapter.js:5`) не вказує на інший домен, і **не** вимикати захист у BotFather |
| 4 | **P0 (юридично)** | **Суперечність у політиці AI.** README: «Не надсилайте фінансові дані або аналітику стороннім сервісам… Залишайте AI вимкненим, якщо його немає у власній ізольованій інфраструктурі». Водночас `AI_BASE_URL` вказує на зовнішні шлюзи (приклади в `server/ai.js:4`: OmniRoute, OpenRouter, Groq), а `find_transactions` передає моделі до 50 рядків з нотатками | `server/roo.js:256-264` | Вирішити явно: (а) розкриття в політиці приватності + явна згода на AI; (б) мінімізація даних: передавати лише потрібні поля, нотатки обрізати; (в) провайдер без зберігання даних (zero data retention). Політики ретенції Groq і OpenRouter — **UNVERIFIED**, перевірити їхні умови |
| 5 | P1 | **Prompt injection у майбутніх write-інструментах** | — | Картку підтвердження рендерить **сервер** з провалідованого `payload`, а не текст моделі. Інакше нотатка з ін'єкцією змусить модель описати дію оманливо. Див. §4 |
| 6 | P1 | Rate limiting на рівні проксі рекомендований у README, але не описаний у коді | README «rate limiting на proxy» | Для write-ендпоінтів і `/api/quick` — ліміт на користувача в PG або token bucket у пам'яті. Чи є вбудований WAF у Railway — **UNVERIFIED** |
| 7 | P1 | Токен швидкого запису користувач копіює вручну | `/api/quick/token` | Показувати час останнього використання; на пристрої зберігати в `SecureStorage` (Bot API 9.0) |
| 8 | P2 | Stars-платежі (майбутнє) | — | Видавати доступ **лише** після `successful_payment`, ідемпотентність за `telegram_payment_charge_id`, повернення через `refundStarPayment`, відповідь на `pre_checkout_query` ≤ 10 с |
| 9 | P2 | Банківські токени monobank (майбутнє) | — | Шифрування AES-GCM з ключем поза БД, ротація, ніколи не логувати. Webhook без підпису (**UNVERIFIED**, чи підписує monobank) → секретний шлях + перевірка операції через statement |
| 10 | P3 | Контроль залежностей | — | `npm audit` у CI; зафіксувати версію вендореного GSAP |

## 3. Рекомендований набір заголовків

```text
Content-Security-Policy:
  default-src 'self';
  script-src 'self' https://telegram.org;
  connect-src 'self';
  img-src 'self' data: https:;
  style-src 'self' 'unsafe-inline';
  font-src 'self';
  frame-ancestors https://web.telegram.org https://*.telegram.org;
  base-uri 'none'; form-action 'self'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=31536000 (якщо HTTPS термінується не на проксі)
```

Застереження:
1. `style-src 'unsafe-inline'` потрібен, бо `app.js` рендерить інлайн-стилі (напр. `style="background:..."`, `app.js:1326`). Жорсткіший варіант можливий лише після рефакторингу.
2. Домени Telegram Web, які вбудовують Mini App у `iframe` (`frame-ancestors`), треба **перевірити на всіх клієнтах** (Web A/K, Desktop) — UNVERIFIED.
3. Джерело `telegram-web-app.js` звірити з `web/index.html`.
4. Вмикати спершу як `Content-Security-Policy-Report-Only`.

## 4. AI-безпека: OWASP Top 10 for LLM Applications 2025

| Ризик | Стан | Дія |
|---|---|---|
| **LLM01 Prompt Injection** | ✓ нотатки позначені як дані (`roo.js:35`); ✓ read-only | для write: підтвердження + картка з серверного `payload`; жодних інструментів, що ходять за URL |
| **LLM02 Sensitive Information Disclosure** | частково | мінімізація контексту (§2 #4); не передавати Telegram-ім'я чи username; `userNote` обрізати до 120 символів (у БД уже `CHECK <= 120`) |
| **LLM05 Improper Output Handling** | ✓ `esc()` | якщо з'явиться markdown — `marked` + **DOMPurify** (10.5 KB gzip) |
| **LLM06 Excessive Agency** | ✓ read-only | pending actions, TTL 10 хв, стелі сум і кількості, лише інструменти з allowlist |
| **LLM07 System Prompt Leakage** | ✓ у промпті немає секретів | — |
| **LLM10 Unbounded Consumption** | ⚠ ліміти в пам'яті | PG-ліміти; `max_tokens` ✓ (`ai.js:29`); таймаут ✓ 45 с; цикл ≤ 4 кроки ✓ |

Бібліотеки guardrails (NeMo Guardrails, guardrails-ai, PurpleLlama Prompt Guard) — **IGNORE зараз**: вони написані на Python і важкі. Наш захист архітектурний: модель не має повноважень, які можна було б «вкрасти» ін'єкцією. `protectai/rebuff` архівовано.

## 5. Приватність фінансових даних

1. **Мінімізація.** `product_events` без сум і нотаток (08 §3). Логи AI (`ai_usage`) — лише токени, латентність і назви інструментів, без текстів.
2. **Прозорість.** Політика приватності й умови: команди `/terms` і `/support` потрібні **і** для Stars-платежів (Telegram Live Checklist, [payments-stars](https://core.telegram.org/bots/payments-stars)).
3. **Права користувача.** Експорт ✓ і видалення ✓ вже є. Експорт має лишитися **безкоштовним** у будь-якому тарифі.
4. **Бекапи.** Шифрування `age` і політика retention (README) ✓. Лишається виконати.
5. **Юридичний аудит.** README сам вказує, що перед production потрібні GDPR-аудит, інфраструктурний аудит і пентест. Особливо перед банківським імпортом.
