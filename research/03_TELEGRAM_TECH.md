# 03. Telegram Mini Apps: технології та можливості

Дата: 11.09.2026. Першоджерела: [Bot API changelog](https://core.telegram.org/bots/api-changelog), [Mini Apps docs](https://core.telegram.org/bots/webapps), [Payments for digital goods](https://core.telegram.org/bots/payments-stars).

## 1. Що змінилося в платформі (релевантне для «Копійки»)

| Bot API | Дата | Що додано | Значення для нас |
|---|---|---|---|
| 6.9 | 22.09.2023 | `CloudStorage`, `requestWriteAccess` | є серверні налаштування, тому неактуально |
| 7.2 | 31.03.2024 | `BiometricManager` | **вже використовуємо** |
| 7.4 | 28.05.2024 | Платежі в Telegram Stars (`XTR`) | монетизація (див. 13) |
| 7.7 | 07.07.2024 | `disableVerticalSwipes` | свайпи в журналі не згортатимуть застосунок |
| 7.8 | 31.07.2024 | Main Mini App у профілі бота, `shareToStory` | вхід з профілю, шеринг |
| 7.10 | 06.09.2024 | `SecondaryButton`, `setBottomBarColor` | колір bottom bar уже синхронізуємо |
| **8.0** | 17.11.2024 | Fullscreen, `safeAreaInset`, **`addToHomeScreen` / `checkHomeScreenStatus`**, `shareMessage` + `savePreparedInlineMessage`, **`downloadFile`**, `LocationManager`, емодзі-статус, кастомний екран завантаження, валідація initData третьою стороною (Ed25519), **Star Subscriptions** (`subscription_period`, `editUserStarSubscription`) | **ключовий реліз**: іконка на головному екрані закриває задачу «швидкий запис із головного екрана» |
| **9.0** | 11.04.2025 | **`DeviceStorage`**, **`SecureStorage`**; максимальна ціна підписки зросла до 10 000 ⭐ | локальний кеш і безпечне сховище для токена |
| 9.1 | 03.07.2025 | `hideKeyboard`, `getMyStarBalance` | ховати клавіатуру після збереження |
| **9.3** | 31.12.2025 | **`sendMessageDraft`**: стрімінг часткових повідомлень під час генерації | Roo в боті може «друкувати» відповідь |
| 9.5 | 01.03.2026 | `sendMessageDraft` **доступний усім ботам**; `BottomButton.iconCustomEmojiId` | стрімінг без обмежень |
| 9.6 | 03.04.2026 | `requestChat` у WebApp | — |
| 10.0 | 08.05.2026 | Guest mode | — |
| **10.1** | 11.06.2026 | **Rich Messages**: `sendRichMessage`, **`sendRichMessageDraft`** («stream AI-generated replies with seamless rich formatting»), таблиці, списки, expandable-блоки | ранкові брифи й звіти таблицями, стрімінг Roo з форматуванням |
| **10.2** | 14.07.2026 | **Ephemeral messages** (у групі видно лише одному учаснику), Communities, **`BotSubscriptionUpdated`** (оновлення стану підписки), **захист Mini Apps від викликів методів з чужих доменів** («automatically enabled for all Mini Apps on July 20, 2026») | групові бюджети, життєвий цикл підписки, безпека |
| 10.3 | 24.08.2026 | `RichMessageButton`, `can_stop` / `keep_on_stop` у `sendMessageDraft`, update `MessageGenerationStopped`, `DisabledButton` | кнопка «Стоп» для відповіді Roo в боті |

## 2. Що з цього вже використовує «Копійка» (grep, 11.09.2026)

| API | Статус | Де |
|---|---|---|
| `ready()`, `expand()` | ✓ | `web/telegram-adapter.js:144-145` |
| `themeParams` → CSS-змінні (15 параметрів) | ✓ | `web/telegram-adapter.js:55-71, 101-112` |
| `setHeaderColor` / `setBackgroundColor` / `setBottomBarColor` | ✓ | `web/telegram-adapter.js:78-89` |
| `BackButton` | ✓ | `web/telegram-adapter.js:92-99, 155-159` |
| `viewportChanged` (live / stable) | ✓ | `web/telegram-adapter.js:120-126, 150` |
| `safeAreaChanged` / `contentSafeAreaChanged` | ✓ | `web/telegram-adapter.js:128-139` |
| Валідація `initData` на сервері | ✓ | `server/auth/telegram.js` (`@tma.js/init-data-node`), max age 900 с, future skew 60 с |
| `BiometricManager` | ✓ | `web/src/app.js:3230, 3238, 4130` |
| `HapticFeedback` | частково | лише `notificationOccurred`: `web/src/app.js:4392, 4408` |
| `MainButton` / `SecondaryButton` | ✗ | — |
| `CloudStorage` / `DeviceStorage` / `SecureStorage` | ✗ | натомість `localStorage` (напр. історія Roo, `app.js:1928`) |
| `addToHomeScreen` / `checkHomeScreenStatus` | ✗ | — |
| `start_param` (deep link `startapp`) | ✗ | — |
| `disableVerticalSwipes` / `enableClosingConfirmation` | ✗ | — |
| `shareMessage` / `shareToStory` | ✗ | — |
| `downloadFile` | ✗ | експорт робиться через `<a download>` (`telegram-adapter.js:42-53`) |
| Stars (`sendInvoice` / `createInvoiceLink`) | ✗ | — |
| `sendMessageDraft` / `sendRichMessage` у боті | ✗ | бот відповідає звичайними HTML-повідомленнями (`server/bot-ai.js:283`) |

**Висновок:** базова інтеграція (тема, viewport, safe areas, BackButton) зроблена якісно, бо UI/UX-аудит від 11.09.2026 уже її полагодив. Невикористаними лишаються **нативні механіки швидкості та утримання**: головний екран, нативні кнопки, haptics, локальні сховища, стрімінг у боті.

## 3. Рекомендації за можливостями

| # | Можливість | Що конкретно покращить | Як | Складність | Пріоритет |
|---|---|---|---|---|---|
| 1 | **`addToHomeScreen` + `checkHomeScreenStatus`** (8.0) | Прямо закриває ключову вимогу «швидке додавання з головного екрана»: іконка «Копійки» на робочому столі телефона. Доповнює наявний iPhone Shortcut (`/api/quick`), який працює без відкриття застосунку | Після 3-го запису показати картку «Додати іконку на головний екран» → `tg.addToHomeScreen()`. Подія `homeScreenAdded` → haptic success. Перед показом перевіряти статус `checkHomeScreenStatus` (`unsupported` / `added` / …) | Low | P1 |
| 2 | **Direct link `?startapp=add`** (7.x) | Кнопка в боті, закріплене повідомлення, будь-яке посилання відкривають одразу поле запису | Читати `tg.initDataUnsafe.start_param` при старті; `add` → відкрити аркуш додавання з фокусом. Чи зберігає ярлик з головного екрана `start_param` — **UNVERIFIED** (перевірити на пристрої) | Low | P1 |
| 3 | **`MainButton` / `SecondaryButton`** (7.10) | Нативна кнопка «Зберегти» над клавіатурою не перекривається й виглядає як частина Telegram. «Ще одна» для серійного введення | На аркуші додавання: `MainButton.setParams({text:'Зберегти'})`, на `onClick` викликати ту саму функцію, що й поточна кнопка. Колір кнопки брати з `button_color` | Low | P1 |
| 4 | **`HapticFeedback` повністю** | Відчуття «нативності». Сигнал з production-досвіду інших TMA: engagement зріс після додавання haptics ([dev.to, 03.03.2026](https://dev.to/haskelldev/5-things-that-surprised-me-building-a-telegram-mini-app-real-production-lessons-4bmk); одиничний кейс, не дослідження) | `impactOccurred('light')` на натискання чипа чи цифри, `selectionChanged` на перемикання категорії, `notificationOccurred('warning')` при перевищенні ліміту, `'error'` при помилці | Low | P1 |
| 5 | **`DeviceStorage`** (9.0) | Миттєвий перший рендер з кешу замість очікування `/api/state`, чернетки форм, офлайн-черга записів | Обгортка в `telegram-adapter.js`: `DeviceStorage.getItem('state')` → рендер → фоновий refresh. Fallback на `localStorage`. Чи переживає це сховище очищення WebView — **UNVERIFIED**, перевірити | Medium | P2 |
| 6 | **`SecureStorage`** (9.0) | Токен швидкого запису й чутливі прапорці в Keychain / Keystore, а не в `localStorage` | Для quick-токена й PIN-прапорця; `restoreItem` для відновлення на тому ж пристрої | Low | P2 |
| 7 | `CloudStorage` (6.9) | — | **IGNORE** (ponytail): налаштування вже зберігаються на сервері (`/api/settings`) | — | — |
| 8 | **`disableVerticalSwipes`** (7.7) | Свайп по рядку журналу (редагування або видалення) не згортатиме Mini App | Вмикати лише на екранах зі свайп-жестами; повертати при виході | Low | P2 |
| 9 | `enableClosingConfirmation` | Не втрачати недозбережений запис | Коли в полі запису є текст | Low | P2 |
| 10 | **`downloadFile`** (8.0) | Нативний діалог завантаження експорту. `<a download>` у WebView Telegram працює не на всіх клієнтах (**UNVERIFIED**, перевірити iOS / Android / Desktop) | Потрібен URL: одноразовий підписаний токен `GET /api/export?format=csv&t=…` (TTL 60 с), бо `downloadFile` не передає заголовок `X-Telegram-Init-Data` | Medium | P2 |
| 11 | **`shareMessage` + `savePreparedInlineMessage`** (8.0), `shareToStory` (7.8) | Віральність: картка «мій тиждень» (без сум за замовчуванням) → у чат або в сторіс | Сервер готує повідомлення через `savePreparedInlineMessage`, клієнт викликає `shareMessage(id)` | Medium | P3 |
| 12 | **Stars-платежі та підписки** | Монетизація, обов'язкова для цифрових товарів | Див. [13_MONETIZATION.md](13_MONETIZATION.md) | Medium | P2 |
| 13 | **`sendMessageDraft` / `sendRichMessageDraft`** (9.3 / 9.5 / 10.1) | Roo в боті «друкує» відповідь, як ChatGPT. З 10.3 є кнопка «Стоп» (`can_stop`, update `MessageGenerationStopped`) | Стрімити токени з `ai.js` (`stream: true`) і оновлювати draft кожні ~300–500 мс. Точну частоту оновлень, яку дозволяє Telegram, треба перевірити — **UNVERIFIED** | Medium | P3 |
| 14 | **Rich Messages** (10.1) | Ранковий бриф і тижневий звіт компактною таблицею (`RichBlockTable`, `is_compact` з 10.3) та expandable-блоком деталей | `sendRichMessage` з блоками | Medium | P3 |
| 15 | Ephemeral messages (10.2) | Майбутні спільні бюджети в групі: бот показує особисті суми лише одному учаснику | Після MVP спільних бюджетів | High | P4 |
| 16 | Кастомний екран завантаження (8.0) | Брендований старт замість білого екрана | BotFather → Bot Settings → Configure Mini App: іконка й кольори світлої та темної тем | Low | P1 |
| 17 | Main Mini App (7.8) | Кнопка «Відкрити» в профілі бота | Перевірити налаштування в BotFather | Low | P1 |
| 18 | **Захист від викликів з чужих доменів** (10.2, з 20.07.2026) | Безпека | Переконатися, що Mini App і API працюють з одного домену, **не вимикати** захист у BotFather. Перевірити, що `KOPIYKA_API_BASE` (`telegram-adapter.js:5`) не вказує на інший домен | Low | P0 |
| 19 | Валідація третьою стороною Ed25519 (8.0) | — | **IGNORE**: bot token і так на нашому сервері | — | — |
| 20 | `requestFullscreen`, `LocationManager`, акселерометр | — | **IGNORE** для фінансового трекера | — | — |

## 4. Бібліотеки

| Бібліотека | npm / тиждень | Статус | Вердикт |
|---|---:|---|---|
| Офіційний `telegram-web-app.js` + власний адаптер | — | ✓ зараз | **Лишити**: адаптер на ~420 рядків покриває все потрібне й не додає залежностей |
| `@tma.js/init-data-node` | 6,065 | ✓ зараз, репо активне (2026-07-14) | **Лишити** |
| `@tma.js/sdk` | 20,899 | фреймворк-незалежний, активний | INSPIRE: типізовані обгортки й сигнали, але не потрібні, поки адаптер невеликий |
| `@telegram-apps/sdk` | 44,033 | стара назва tma.js | IGNORE |
| `@twa-dev/sdk` | 15,677 | останній реліз 2025-02, відстає | IGNORE |
| TelegramUI | — | лише React, реліз 2025-10 | INSPIRE (вигляд нативних компонентів) |
| **grammY** | 4.9M | v1.46.0 від 26.08.2026 | ADAPT **лише** коли бот ускладниться (Stars-платежі, діалоги, middleware). Поки бот написаний напряму (`routeBotMessage` у `server/bot-ai.js:326`), ponytail каже: не додавати. Підтримка grammY для Bot API 10.x — **UNVERIFIED** |
| node-telegram-bot-api | 162k | v2.1.0 від 24.08.2026 | альтернатива grammY, IGNORE |
| Telegram Analytics SDK (`tganalytics`) | — | останній коміт 2026-01-22 | Лише якщо плануєте рейтинг у каталозі Telegram Apps. За документацією SDK дані анонімні й «used solely to rank applications in the catalog based on their performance and Streaks» |

## 5. Ризики платформи

1. **Відкриття в каталозі слабке.** Сигнал Reddit (r/Telegram, 11.11.2025): «No proper app store or ranking system, so even good mini apps stay invisible». Ріст має йти через бота, шеринг і рекомендації, а не через каталог.
2. **Політика магазинів застосунків.** Цифрові товари в Mini App — лише за Stars: «Telegram cannot display your bot or mini-app to mobile users if you attempt to sell digital goods and services via other currencies» ([payments-stars](https://core.telegram.org/bots/payments-stars)).
3. **Фрагментація WebView.** Тестувати на iOS, Android, Desktop і Web. З 8.0 режим налагодження підтримується й на iOS.
4. **Залежність від однієї платформи.** Дані користувачів уже в нашій PostgreSQL. Експорт є (`GET /api/export`), а веб-версію поза Telegram не варто будувати, поки немає тракції (правило ponytail: YAGNI).
