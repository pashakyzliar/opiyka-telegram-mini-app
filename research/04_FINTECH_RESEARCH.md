# 04. Fintech Research: open-source проєкти та комерційні продукти

Дата: 11.09.2026. Метрики GitHub — у [02_GITHUB_RESEARCH.md](02_GITHUB_RESEARCH.md).

Позначення надійності:
- **✓ код** — перевірено читанням структури репозиторію або конкретних файлів.
- **README** — з опису проєкту.
- **UNVERIFIED** — не вдалося підтвердити першоджерелом.

## Частина A. Open-source фінансові застосунки (24 проєкти)

### A1. Зведена матриця

| # | Проєкт | Стек | Модель бюджету | Регулярні платежі | Правила / автокатегорії | AI | Імпорт | Що взяти | Надійність |
|---|---|---|---|---|---|---|---|---|---|
| 1 | **Actual Budget** | TS, local-first, SQLite + sync | envelope **і** tracking | автопошук розкладів (`find-schedules.ts`) | повний rules engine | немає вбудованого (є actual-ai) | CSV/OFX/QIF, bank sync | алгоритм розкладів, rules engine, шаблони бюджету | ✓ код |
| 2 | **Sure** (форк Maybe) | Ruby on Rails, Hotwire | бюджети категорій + rollover | пайплайн: identifier → matcher → price change | правила + LLM auto-categorizer | помічник з 40+ інструментами, 8 генераторів інсайтів, LLM-evals | CSV, PDF-виписки (LLM), Plaid/SimpleFIN (README) | набір інструментів помічника, детектор регулярних, інсайти | ✓ код |
| 3 | **Firefly III** | PHP/Laravel | бюджети + piggy banks | recurring transactions | rules engine (triggers/actions) | ні (зовнішній, архівований) | data-importer (CSV, GoCardless, SimpleFIN) | UX правил «якщо → то» | README |
| 4 | **Maybe** | Ruby | — | — | — | — | — | **архівовано 24.07.2025**, див. Sure | ✓ метрики |
| 5 | **Midday** | TS, Next.js, Supabase, AI SDK | бізнес: burn rate, runway | recurring invoices | embeddings-категоризація | чат-агент `ToolLoopAgent` + MCP-інструменти | bank sync, інбокс документів | архітектура агента, embeddings | ✓ код |
| 6 | **ezbookkeeping** | Go + Vue, MIT | бюджети | шаблони / розклад | категорії + теги | **текст → транзакція**, імпорт через AI, MCP | CSV, AI-імпорт | NL-розпізнавання з TZ клієнта, курси НБУ | ✓ код |
| 7 | **Ghostfolio** | TS, Angular/NestJS | — (інвестиції) | — | — | — | брокерські | UX графіків портфеля | README |
| 8 | **Spliit** | TS, Next.js | спільні витрати | — | — | — | — | «спільні бюджети» для пар | README |
| 9 | **ihatemoney** | Python/Flask | спільні витрати | — | — | — | — | те саме | README |
| 10 | **ExpenseOwl** | Go + **vanilla JS** + Chart.js | прості категорії | — | — | — | CSV | доказ життєздатності vanilla-стеку | ✓ код |
| 11 | **Cashew** | Flutter | бюджети, цілі | так | — | — | CSV | мобільний UX, «спільні бюджети» | README |
| 12 | **Paisa** | TS + Go, ledger | — | — | — | — | ledger | візуалізації cashflow | README |
| 13 | **Wealthfolio** | Rust/Tauri | — | — | — | — | CSV | інвестиції (IGNORE) | README |
| 14 | **Beancount / Fava** | Python | plain-text | — | правила імпорту | — | — | ідея «журнал як правда» | README |
| 15 | **hledger** | Haskell | plain-text | periodic txns | — | — | CSV-правила | CSV rules DSL | README |
| 16 | **GnuCash** | C | подвійний запис | scheduled | — | — | QIF/OFX | IGNORE (desktop) | README |
| 17 | **MoneyManagerEx** | C++ | бюджети | так | — | — | CSV/QIF | IGNORE | README |
| 18 | **MyExpenses** | Kotlin/Android | бюджети | plans | — | — | CSV/QIF | Android UX | README |
| 19 | **Ivy Wallet** | Kotlin | бюджети | planned payments | — | — | CSV | **архівовано**, лише UX | ✓ метрики |
| 20 | **Monekin** | Flutter | бюджети | так | — | — | CSV | мобільний UX | README |
| 21 | **OpenBudgeteer** | C# | bucket (envelope) | — | правила | — | CSV | bucket-модель | README |
| 22 | **Wallos** | PHP | — | **трекер підписок** + нагадування | — | — | — | UX «підписки» та сповіщення | README |
| 23 | **econumo** | Go, MIT | сімейний бюджет, мультивалюта | — | — | — | — | мультивалюта | README |
| 24 | **Bagels** | Python TUI | категорії must/need/want | recurring | — | — | — | таксономія must/need/want | README + HN |

Додатково переглянуто, лише як UX-референс: RecurringExpenseTracker (Kotlin), Dime (iOS), Frappe Books, Akaunting, Kresus, Seven23, TopHat.

### A2. Глибокий аналіз топ-6 за вимогами промпту

#### 1. Actual Budget (MIT, ★28,691, реліз v26.9.0 від 01.09.2026)
- **Архітектура:** монорепо `packages/loot-core` (серверна логіка, працює і в браузері, і на сервері), `desktop-client` (React), `cli`. Local-first з синхронізацією.
- **UX:** є окремі мобільні сторінки (`e2e/page-models/mobile-*`). Головний екран — бюджет по місяцях.
- **Категорії:** групи категорій → категорії (`CategoryGroupAutocomplete.tsx`).
- **Transactions model:** рахунок, payee, категорія, splits, `schedule`, transfer через `payee.transfer_acct`.
- **Analytics / charts:** звіти (React-компоненти).
- **Budgeting:** `budget/envelope.ts` (zero-based) і `budget/tracking.ts` (ліміти), carryover (`BalanceWithCarryover.tsx`), шаблони цілей (`goal-template.ts`, `distributeRemainder`).
- **Recurring:** `schedules/find-schedules.ts`, розбір у [02 §5.1](02_GITHUB_RESEARCH.md).
- **Rules engine:** `rules/condition.ts`, `action.ts`, `rule-indexer.ts`.
- **Search / filters:** AQL (власна мова запитів, `#server/aql`).
- **AI:** немає, зовнішній `sakowicz/actual-ai`.
- **Import:** CSV/OFX/QIF, bank sync (`accounts/sync.ts`).
- **Висновок: ADAPT.** Алгоритм розкладів і модель правил.

#### 2. Sure (AGPL-3.0, ★9,835, v0.7.4 від 31.08.2026)
- **Архітектура:** Rails-моноліт, API v1 (`app/controllers/api/v1/{budgets,recurring_transactions,rules,insights,merchants}_controller.rb`).
- **AI:** `app/models/assistant/*`. Має вбудований і зовнішній провайдери, обрізання історії, бюджет токенів, 40+ інструментів з **інструментами запису** (update_transaction, create_goal, update_budget, create_bill, record_bill_payment). Є evals у CI.
- **Recurring:** найзріліша відкрита реалізація. Кластер сум ±7.5%, `suggested` → confirmed, «надгробки» для відхилених, детекція зміни ціни, планувальник зарплати.
- **Insights:** 8 генераторів (див. 14).
- **Goals:** компоненти progress ring, funding accounts breakdown, lifecycle panel.
- **Categorization:** LLM-пакети (OpenAI/Anthropic), merchant detector, блокування ручних значень.
- **Висновок: INSPIRE** (через AGPL). Найкращий «дизайн-документ» для Roo.

#### 3. Firefly III (AGPL-3.0, ★24,579)
- **Rules engine (README):** тригери (опис, сума, рахунок) → дії (категорія, тег, бюджет). Групи правил, застосування до історії.
- **Budgets + piggy banks:** цілі-скарбнички. **Recurring transactions.** Окремий `data-importer` (★830).
- **Висновок: INSPIRE** для UX правил: «застосувати правило до минулих операцій» з попереднім переглядом.

#### 4. ezbookkeeping (MIT, ★5,559)
- **AI:** `RecognizeTransactionTextHandler`, текст → транзакція з TZ клієнта. Провайдери OpenAI/Anthropic/Google/Ollama/LM Studio/OpenRouter.
- **Україна:** `national_bank_of_ukraine_datasource.go`, курси НБУ.
- **Висновок: ADAPT** (MIT). Промпт і постобробку розпізнавання варто порівняти з нашим `buildWritePrompt` у `server/bot-ai.js:131`.

#### 5. Midday (AGPL-3.0, ★14,979)
- **AI-агент:** AI SDK `ToolLoopAgent`, ліміт 10 кроків, відбір до 12 інструментів на крок, `smoothStream`. Інструменти оформлені як MCP.
- **Категоризація:** embeddings назв категорій (`gemini-embedding-001`, 768d), zod-enum з `uncategorized`.
- **Charts:** burn rate, runway, revenue forecast.
- **Висновок: INSPIRE.** Runway для B2B = «на скільки днів вистачить» для B2C.

#### 6. ExpenseOwl (MIT, ★1,506, HN 227 pts)
- Vanilla JS + Chart.js + service worker, Go-бекенд, JSON або БД.
- Сигнал з HN-коментарів (07.02.2025): ✓ «predictive form filling… for the "Gas" category I always made the title "Gas"». Найцінніша функція ручних трекерів — **передбачуване автозаповнення**, а не кругові діаграми. Ще один коментар: «the "selling point" of having pie charts… does absolutely nothing for me».
- **Висновок: INSPIRE.** Швидкі чипи повтору (див. 16 #7).

## Частина B. Комерційні продукти

| Продукт | AI (станом на 2026) | Монетизація (джерело) | UX / навігація | Аналітика | Що взяти |
|---|---|---|---|---|---|
| **Monarch Money** | AI Assistant: іконка sparkle в сайдбарі, **read-only**, відповіді на основі реальних даних. Використовує «a combination of third-party LLMs and in-house modeling». Не категоризує в чаті, для цього окремий ML | Core $99.99/рік або $14.99/міс; Plus $199/рік ([fincomparelab, перевірено джерелом 25.06.2026](https://www.fincomparelab.com/guides/monarch-money-pricing/)) | web + mobile, «Needs Review» для сім'ї | Sankey, Goals 3.0, shared views | питання трьох типів: дані / навігація / пояснення «чому» |
| **Copilot Money** | Money assistant, публічна бета з 16.04.2026. **Проактивні щоденні брифінги** (незвичні списання, бюджети «гріються»), пропозиції перекатегоризації, refund matches, нові категорії «в один тап». Діє з бюджетами, категоріями, регулярними платежами, але «**checks for your approval before any edits**». Автономія «зароблюється поступово» | $95/рік ($7.92/міс) ([copilot.money](https://www.copilot.money/)) | лише Apple (Reddit-сигнал) | — | **головний референс для Roo**: пропонує → користувач підтверджує |
| **YNAB** | — (UNVERIFIED) | $14.99/міс або $109/рік, 34 дні безкоштовно ([ynab.com/pricing](https://www.ynab.com/pricing)) | zero-based | — | 34-денний trial; «кожна гривня має роботу» як опція |
| **Rocket Money** | **Rowan** (25.08.2026): AI-агент через SMS. Моніторить фінанси, попереджає про закінчення free trial, подорожчання й забуті підписки. Скасовує підписки, торгується за рахунки, створює бюджет з нуля, шукає дублікати підписок, повертає гроші. Зроблено спільно з Anthropic | Premium+ **$15/міс** (включає Rowan) ([fintech.global, 03.09.2026](https://fintech.global/2026/09/03/rocket-money-launches-ai-agent-to-manage-finances/)) | агент у месенджері (SMS), а не в застосунку | підписки | **«агент у месенджері»** — те саме, що Roo в Telegram-боті, тільки ми вже там |
| **Cleo** | 3.0: агентна архітектура, ~40 інструментів (retrieval + action). Smart Insights Agent на o3 аналізує 6 місяців у фоні. Пам'ять як підсумки розмов, голос. **81% точності** на бенчмарку з 129 транзакцій завдяки детермінованим інструментам для математики | Pro $8.99/міс, Builder $14.99/міс ([help center, 08.04.2026](https://web.meetcleo.com/faqs/en/articles/11870304-what-is-cleo-pro)) | чат як головний інтерфейс | інсайти | підтвердження нашої архітектури: «LLM інтерпретує, інструменти рахують» |
| **Revolut** | — | — | віджети «Spent» / «Income» з порівнянням з попереднім періодом, перемикання bar / pie / line ([help.revolut.com](https://help.revolut.com/help/accounts/budget-and-analytics/how-can-i-see-my-spending-and-income-analytics/)) | порівняння періодів | «порівняння з минулим періодом» як стандарт карток |
| **Monzo** | — | — | **Pots**, **Salary Sorter** (розкладає зарплату по «горщиках»), roundups, Trends з кастомними категоріями, кілька категорій на платіж ([monzo.com/help](https://monzo.com/help/budgeting-overdrafts-savings)) | Trends | Salary Sorter ≈ наш «план зарплати» + «кишені» |
| **N26** | UNVERIFIED | UNVERIFIED | UNVERIFIED (Spaces — UNVERIFIED) | — | — |
| **Wallet by BudgetBakers** | — | Premium: monthly / yearly / **lifetime**, однаковий набір функцій, trial ([support](https://support.budgetbakers.com/hc/en-us/articles/7151349344018-Everything-about-Premium)) | — | — | lifetime-план як варіант |
| **Spendee** | UNVERIFIED | 7-денний trial (заголовок сторінки); ціни за cookie-wall — UNVERIFIED | — | — | — |
| **MoneyWiz** | — | $29.99/рік Standard; $59.99/рік або $5.99/міс з bank sync ([wiz.money/pricing](https://www.wiz.money/pricing)) | — | — | **bank sync як платна функція** |
| **Ask Dolly** (Vivian Tu) | AI-фінансовий застосунок, запущено 09.09.2026 (Business Insider). Деталі UNVERIFIED | UNVERIFIED | — | — | тренд: AI-first особа-бренд |

### B1. Що це означає для «Копійки»

1. **Ринок сходиться до «агента, який пропонує, а людина підтверджує»**: Copilot (квітень 2026), Rocket Money (серпень 2026), Cleo 3.0. Roo з read-інструментами вже на цьому шляху. Наступний крок — write-інструменти з підтвердженням.
2. **Rocket Money продає агента за $15/міс**, і агент живе в **месенджері**. У нас месенджер — сама платформа. Це стратегічна перевага, яку треба використати: Roo у боті, стрімінг, ранкові брифи.
3. **Проактивність сильніша за чат.** Copilot і Cleo роблять фонові інсайти, Monarch лишається реактивним. HN-сигнал: «there really aren't any major secret insights… mistakes, hallucinations aren't acceptable». Значить, інсайти мають бути **алгоритмічні й перевірювані**, а LLM їх лише формулює.
4. **Bank sync — найсильніший платний драйвер** (MoneyWiz удвічі дорожчий з bank sync). Для України це monobank API (див. 09, 16).

## Частина C. Неочевидні джерела механік

| Джерело | Механіка | Адаптація для personal finance | Надійність |
|---|---|---|---|
| **Duolingo** | Streak як частина core loop: у першій сесії ще до реєстрації. Святкування **лише на віхах** (7/30/100/365): редизайн анімації фенікса дав **+1.7% D7 retention**. Streak freeze видається **автоматично й тихо**, з обмеженням 2 (до 5 для довгих серій). «Perfect Week» як престиж. Share-картки дали **5–10× органічних шерів** і 6M шерів на день | «Днів у плані» з авто-freeze, святкування лише на віхах, share-картка тижня (див. 12) | ✓ [deconstructoroffun, 15.05.2026](https://duolingo.deconstructoroffun.com/mechanics/streaks) |
| **Loop Habit Tracker** (uhabits, ★10,236) | «Habit strength» замість крихкого streak (README: експоненційна сила звички, пропуск не обнуляє) | «Сила звички обліку»: пропуск одного дня не руйнує прогрес | README |
| **Linear** | Клавіатурність, миттєвий optimistic UI | Optimistic UI для запису: транзакція видна до відповіді сервера | концепт |
| **Raycast** | Command palette: одна команда замість меню | Поле «що сталося?» як command bar: «кава 120», «ліміт на кафе 3000», «покажи бензин» | концепт |
| **ChatGPT / Claude** | Suggested prompts, видимий tool-use («дивився: …»), стрімінг | Roo вже показує «дивився: підсумки» (`app.js:1966`). Бракує стрімінгу й карток дій | ✓ код |
| **Monzo Salary Sorter** | Автоматичний розподіл зарплати по «горщиках» | Розподіл зарплати по «кишенях» у день виплати: `salary_schedule_days` уже є | ✓ help center |
| **Telegram-конкуренти** | Monesto (особисті + групові витрати), Cointry (AI Expense Tracker), FIN AI (BotLabs, кейс 2026) | Групові витрати й голос — очікувані функції в Telegram | лише факт існування, функції UNVERIFIED |

### C1. Community-сигнали

- **Reddit** (через Exa, бо напряму 403):
  - r/Telegram, 11.11.2025, «I regret creating a Telegram mini app». Слабке відкриття в каталозі, мала аудиторія поза Європою, «Telegram rewards crypto instead of useful miniapps».
  - r/SideProject, 2026, «150M people use Telegram Mini Apps and there's not a single polished focus app». Автор каже, що бюджет-трекер як TMA — **перший, яким він користувався понад 2 місяці**.
  - **Висновок:** ріст не прийде з каталогу. Його дають бот, шеринг і сарафан.
- **HN, «Write It Down» (06.10.2025, 271 pts):** «consumer personal finance is hard to disrupt with AI… mistakes, hallucinations aren't acceptable». Аргумент на користь нашої архітектури «сервер рахує».
- **HN, Bagels (283 pts):** запити на імпорт CSV із банку. Ручне введення без імпорту — межа утримання.
