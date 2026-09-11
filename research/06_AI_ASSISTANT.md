# 06. Roo Assistant: інструменти, NL → транзакція, пошук, категорії

Дата: 11.09.2026. Поточну архітектуру описано в [05_AI_ARCHITECTURE.md](05_AI_ARCHITECTURE.md).

## 1. Принципи з досліджених продуктів

| Принцип | Хто так робить | Статус у «Копійці» |
|---|---|---|
| **Сервер рахує, LLM пояснює** | Cleo 3.0 (81% точності завдяки детермінованим інструментам), Midday (MCP-інструменти), Monarch («grounded in your actual data») | ✓ `server/roo.js:11`: «Жодна сума не приходить від моделі» |
| **Пропонуй, користувач підтверджує** | Copilot Money: «checks for your approval before any edits. Nothing happens without your say-so» (16.04.2026) | ✗: write-інструментів ще немає |
| **Автономія заробляється поступово** | Copilot: «asking more and acting less early on» | — |
| **Проактивність сильніша за чат** | Copilot (щоденні брифінги), Cleo (Smart Insights у фоні), Rocket Money Rowan (сам попереджає про trial і подорожчання) | ✗ |
| **Мінімальні повноваження агента** | [OWASP LLM06:2025 Excessive Agency](https://owasp.org/www-project-top-10-for-large-language-model-applications/): мінімізувати функції, дозволи й автономію, а для дій з високим впливом вимагати підтвердження людини | ✓ read-only; для write — див. §2 |

## 2. Інструменти Roo

### 2.1 Наявні read-інструменти (✓ `server/roo.js:48-146`)
`get_overview`, `get_daily_plan`, `find_transactions`, `get_limits`, `get_pockets`, `compare_periods`, `open_screen`.

### 2.2 Нові read-інструменти

| Інструмент | Що повертає | Алгоритм | Джерело ідеї |
|---|---|---|---|
| `get_payday_forecast` | залишок до наступної зарплати, діапазон P25–P75 | [08 §1](08_ANALYTICS_AND_CHARTS.md) | Sure `paycheck_planner.rb`, Midday runway |
| `get_recurring` | підтверджені та запропоновані регулярні платежі, наступні дати, зміна ціни | [09 §5](09_BACKEND_AND_DATABASE.md) | Sure `recurring_transaction/*`, Actual `find-schedules.ts` |
| `get_anomalies` | незвичні витрати за N днів | робастний z-score (медіана + MAD) | Sure `spending_anomaly_generator.rb` |
| `get_category_trend` | помісячні суми категорії за 3–12 місяців і відхилення | лінійний тренд або середнє | Revolut (порівняння з попереднім періодом) |
| `get_goal_progress` | прогрес цілей і дата досягнення за поточного темпу | арифметика | Monarch («When will I hit my goal at my current rate?») |

### 2.3 Write-інструменти через «пропозицію → підтвердження»

Модель ніколи не виконує дію сама. Інструмент створює **пропозицію**, UI показує картку, а виконання робить звичайний API-запит від користувача.

| Інструмент | Дія після підтвердження | Обмеження |
|---|---|---|
| `propose_transaction` | створити одну або кілька операцій | сума ≤ налаштовуваної стелі; категорія лише зі списку користувача |
| `propose_update_transaction` | змінити суму, категорію, нотатку чи дату | патерн Sure: «пропущене поле = без змін, `null` = очистити» |
| `propose_delete_transaction` | видалити | лише по `id` з попереднього `find_transactions` |
| `propose_recategorize` | масово змінити категорію за фільтром | попередній перегляд кількості й суми; стеля, напр. 200 рядків |
| `propose_set_limit` | ліміт категорії на місяць | ліміт ≥ 0 |
| `propose_create_goal` | ціль: сума й дедлайн | — |
| `propose_confirm_recurring` | підтвердити регулярний платіж, запропонований детектором | лише з `get_recurring` |
| `remember_fact` | зберегти факт для контексту (день зарплати, пріоритет) | до 20 фактів, лише текст |

**Таблиця `roo_pending_actions`** (нова міграція):

```sql
CREATE TABLE roo_pending_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind text NOT NULL,              -- 'create_transaction' | 'update_transaction' | ...
  payload jsonb NOT NULL,          -- вже провалідовані сервером аргументи
  summary text NOT NULL,           -- текст картки, згенерований СЕРВЕРОМ, не моделлю
  status text NOT NULL DEFAULT 'pending', -- pending | confirmed | cancelled | expired
  result jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  executed_at timestamptz
);
-- RLS: той самий шаблон *_isolation, що й у 001_initial_schema.js
```

**Потік:** модель викликає `propose_*` → сервер валідує (права, категорія існує, ліміти) → пише рядок → повертає моделі `{action_id, summary}` → модель коротко пояснює → UI показує картку **«Підтвердити / Скасувати»** → `POST /api/roo/actions/:id/confirm` → виконання через наявний `accountService` у `withUserContext` (RLS + advisory lock уже є) → статус `confirmed`.

**Чому не просто «виконати, а потім дати відмінити»:** для сум і видалень підтвердження до дії відповідає OWASP LLM06 і практиці Copilot. Для одиночного `propose_transaction` з тексту на кшталт «кава 120» можна пізніше перейти на **автовиконання з undo на 5 с**, коли evals покажуть точність ≥98%. Це і є «автономія, що заробляється».

**Файли:** `server/roo.js` (нові описи в `TOOLS`, `WRITE_TOOLS`), `server/app.js` (маршрут `/api/roo/actions/:id/confirm|cancel`), `server/db/migrations/007_roo_pending_actions.js`, `server/services/account-service.js` (повторне використання), `web/src/app.js` (картка дії в `rooRenderThread`, рядок 1931).

## 3. NL → транзакція (швидкий запис)

### 3.1 Поточний пайплайн (✓ `server/bot-ai.js`)
`routeBotMessage` (write / ask / help) → `resolveGlossaryWrite` (одне слово + одне число, збіг у словнику) → LLM `buildWritePrompt` → `normalizeDraft` (категорія `null` → `needsCategory` → питання кнопками → запис у словник).

### 3.2 Рекомендований пайплайн: кожен щабель дешевший за наступний (ponytail)

| Щабель | Що робить | Вартість | Статус |
|---|---|---|---|
| 1. Парсинг суми й нотатки | `parseAmount`, `noteFromUserText` | 0 | ✓ |
| 2. Словник (точний збіг) | `resolveGlossaryWrite` | 0 | ✓ |
| 3. **Історія користувача** | нормалізована нотатка (`normalizeWord`) → найчастіша категорія серед минулих операцій за 180 днів, якщо ≥2 входження і частка ≥70% | 0 (дані вже в `account.transactions`) | **новий** |
| 4. MCC-код | при банківському імпорті: MCC → канонічна категорія | 0 | майбутнє (monobank) |
| 5. LLM | enum категорій + `null` дозволено. **Додати few-shot з 10–20 пар зі словника самого користувача**, що персоналізує без fine-tuning | ≈ $0.00006 | ✓ (без few-shot) |
| 6. Питання користувачу | кнопки категорій → навчання словника | 0 | ✓ |

**Вимірювання:** писати `category_source` (`user` | `glossary` | `history` | `mcc` | `ai`) у `transactions.extra_data` (колонка `jsonb` уже є, міграція не потрібна). KPI — частка записів без LLM і частка виправлень після `ai`. Ідея з Sure `auto_categorizer.rb`: `source: "ai"` + `lock_attr!`, щоб ручне значення ніколи не перезаписувалося.

### 3.3 Розширення вводу
- **Голосове в боті** → STT → той самий пайплайн. Промпт уже вміє розбирати надиктоване (`ai.js:63-72`: числа словами, «слова-паразити»). **WOW + AI PRO.**
- **Фото чека** → vision-модель → `{items[], total, merchant, date}` → нормалізатор. Патерн схеми з полів — TaxHacker `ai/schema.ts`. **AI PRO.**
- **Кілька операцій в одному повідомленні** («50 хліб і 30 вода») ✓ уже підтримується (`operations[]`).

## 4. NL-пошук транзакцій

Приклад: «покажи всі витрати на ресторани більше 500 грн минулого місяця».

| Підхід | Плюси | Мінуси | Вердикт |
|---|---|---|---|
| **LLM → структурований фільтр → детермінований пошук** | безпечно, дешево, числа рахує код | обмежений виразністю схеми | **✓ поточний підхід, розширити** |
| LLM → SQL | виразно | ризик ін'єкцій, обходу RLS, помилок у сумах. vanna-ai/vanna **архівовано** 02.2026 | **IGNORE** |
| Векторний пошук (pgvector) | «схожі за змістом» | у користувача тисячі рядків, а семантика нотаток («кава») тривіальна; платимо за embeddings і складність | **IGNORE** |
| Full-text / pg_trgm | нечіткий пошук по нотатках, опечатки | потрібен індекс | ADD, коли пошук по нотатках стане частим |

**Конкретна прогалина:** веб-шлях (`buildAskPrompt`, `server/bot-ai.js:152`, і `runAiAsk` у `app.js`) повертає лише `{categories, type, from, to}`, без сум і тексту. Roo (`find_transactions`) уже має `minAmount`, `maxAmount`, `query`. Варто уніфікувати, щоб одна схема фільтра була і в бота, і у вебі, і в Roo.

## 5. Розумні категорії: оптимальний варіант

**Гібрид:** правила / словник → історія → MCC → LLM → людина. Кожен щабель записує `category_source`.

Що ми свідомо **не** робимо (правило ponytail):
- **Embeddings категорій** (Midday: `gemini-embedding-001`, 768d). Для B2B з довільними рядками мерчантів це виправдано, для коротких українських нотаток — ні. Повернутися до ідеї, лише якщо банківський імпорт покаже, що LLM + MCC дають <90% точності.
- **Fine-tuning** (Plaid CLERT). Має сенс лише на мільйонах транзакцій.

Що беремо з досвіду **Plaid UXC** (травень 2026):
1. Категорії однозначні, взаємовиключні й повні, з явним «Інше».
2. **Внутрішній канонічний ключ + «shim» до назви користувача.** Категорії в нас перейменовуються (міграція `006_neutral_category_names.js`). Словник, MCC-мапа й аналітика мають посилатися на стабільний ключ (`food.cafe`), а не на назву.
3. Розмітка через LLM + людська перевірка до згоди понад 90%. Для нас це evals-набір (див. 05 §6).

## 6. Проактивні інсайти (Roo сам пише першим)

Каталог генераторів Sure (`app/models/insight/generators/*.rb`), адаптований до даних «Копійки»:

| Генератор Sure | Аналог у «Копійці» | Дані, що вже є |
|---|---|---|
| `budget_insight` | «Кафе: 82% ліміту, до кінця місяця 12 днів» | `category_budgets`, `transactions` |
| `cash_flow_warning` | «За поточного темпу до зарплати 15-го не вистачить ~1 200 ₴» | `salary_schedule_days`, `recurring_payments`, `allowance.js` |
| `spending_anomaly` | «Витрата 2 400 ₴ у Продуктах у 3.1 раза більша за звичну» | `transactions` |
| `subscription_audit` | «Netflix подорожчав на 20%», «3 підписки не використовувались» (друге — **UNVERIFIED**, нема даних про використання) | детектор регулярних |
| `savings_rate_change` | «Цього місяця відкладено 18% доходу проти 11% у серпні» | `navar_history` |
| `maintained_goal_depleted` | «Кишеня "Відпустка" зменшилась на 3 000 ₴» | `goals` |
| `net_worth_milestone` | «Рекордний навар: 5 000 ₴» | `navar_history` |
| `idle_cash` | — | **IGNORE**: немає даних про рахунки та депозити |

**Реалізація:** кожен генератор — чиста функція `(account, today) → [{kind, severity, facts, dedupe_key}]` (як `allowance.js`). Числа рахує код, LLM за бажанням перетворює `facts` на одне речення. Дедуплікація за `dedupe_key` протягом тижня. Доставка: картка на «Огляді» + бот (opt-in, див. 09 §4).

## 7. Безпека Roo (деталі в [10_SECURITY.md](10_SECURITY.md))

| Загроза | Захист зараз | Додати |
|---|---|---|
| Prompt injection через нотатки | ✓ правило 3 системного промпту (`roo.js:35`) | підтвердження всіх write-дій; жодних URL чи дій поза списком інструментів |
| Надмірна агентність | ✓ лише read-інструменти | pending actions + TTL + стелі |
| Вихід моделі в UI (XSS) | ✓ `esc()` у `rooRenderThread` (`app.js:1938-1946`), `aiAnswer` (`app.js:3377`) | якщо з'явиться markdown — DOMPurify |
| Зациклення | ✓ максимум 4 кроки (`roo.js:403`) | — |
| Доступ до чужих даних | ✓ `withUserContext` + RLS | — |
| Зловживання квотою | ✓ ліміти (у пам'яті) | перенести в PG |

## 8. UX чату (деталі в [07_UX_UI_RESEARCH.md](07_UX_UI_RESEARCH.md))

- ✓ Індикатор інструментів («дивився: підсумки», `app.js:1966`). Зберегти, це прозорість на рівні ChatGPT і Claude.
- **Підказки-чипи** за контекстом: після зарплати — «Розкласти по кишенях?», при `todayAvailable = 0` — «Чому сьогодні нуль?».
- **Типи повідомлень:** текст | картка-число | картка-дія (підтвердження) | міні-графік.
- **Стрімінг** у Mini App і в боті (`sendMessageDraft`).
- Кнопка **«Відкрити в журналі»** для результатів `find_transactions` (✓ `open_screen` уже є).
