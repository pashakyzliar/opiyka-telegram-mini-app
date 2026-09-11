# 02. GitHub Research

Дата збору метрик: **11.09.2026**. Джерело: GitHub GraphQL API через `gh` CLI (авторизований акаунт, ліміт 5000 запитів/год), власний скрипт пакетного збору.

Позначення в таблицях:
- **★** — stars на 11.09.2026.
- **Last commit** — дата останнього коміту в default branch.
- **~contrib** — `mentionableUsers` з GraphQL. Це наближення кількості контриб'юторів, а не точне число.
- **NOASSERTION** — GitHub не зміг автоматично визначити ліцензію. Перед використанням коду треба перевірити файл LICENSE вручну (UNVERIFIED).

## 1. Методика

1. **Широкий пошук:** ~235 репозиторіїв. Джерела: кандидати з промпту, 12 запитів `gh search repos` (telegram mini app finance, expense tracker, personal finance app, ai expense categorization, recurring transactions detection тощо), семантичний пошук Exa, Hacker News (Algolia API).
2. **Метрики:** stars, forks, останній коміт, останній реліз, мова, ліцензія, open issues, open PR, архівність.
3. **Фільтр за релевантністю до нашого стеку.** Стек «Копійки»: vanilla JS без фреймворку й збирача, Node.js `http` без фреймворку, PostgreSQL з RLS, Telegram Bot + Mini App, OpenAI-сумісний LLM-шлюз. React-бібліотеки автоматично втрачають у ваги: їх використання означає міграцію всього фронтенду.
4. **Code-level аналіз** 12 репозиторіїв (розділ 5): структура через Git Trees API, читання конкретних файлів.

Репозиторії **не оцінювались лише за stars**. Приклад: `GiGurra/subscription-detector` має ★1, але це найчистіша відкрита реалізація детектора підписок під MIT. А `maybe-finance/maybe` з ★54k архівований з 24.07.2025.

## 2. Ліцензійне попередження (критично для закритого SaaS)

| Ліцензія | Репозиторії | Що можна робити |
|---|---|---|
| **AGPL-3.0** | we-promise/sure, midday-ai/midday, firefly-iii/firefly-iii, ghostfolio, bigcapital, paisa, wealthfolio, kresus, frappe/books, rotki, Monekin, OpenBudgeteer, Openpanel, paradedb | **Лише ідеї та перереалізація.** Копіювання коду в сервіс, доступний користувачам по мережі, зобов'язує відкрити код усього сервісу |
| **GPL-3.0 / GPL-2.0** | Wallos, Cashew, MyExpenses, uhabits, Bagels, RecurringExpenseTracker, hledger, moneymanagerex, beancount | Лише ідеї (ми не поширюємо бінарники, але змішування коду небажане) |
| **MIT / Apache-2.0 / ISC / Unlicense** | actualbudget/actual, sakowicz/actual-ai, ezbookkeeping, TaxHacker, subscription-detector, pg-boss, promptfoo, uPlot, DOMPurify, simple-statistics, tma.js, grammY, MCC-датасети | Код можна брати зі збереженням копірайту й тексту ліцензії |

## 3. Архівовані та ризикові репозиторії (не брати як залежність)

| Репозиторій | Статус на 11.09.2026 | Замість нього |
|---|---|---|
| maybe-finance/maybe (★54,286) | ARCHIVED, останній коміт 2025-07-24 | we-promise/sure (форк, активний) |
| Ivy-Apps/ivy-wallet (★3,174) | ARCHIVED, 2025-07-17 | — (лише як UX-референс) |
| vkruglikov/react-telegram-web-app (★614) | ARCHIVED | Telegram-Mini-Apps/tma.js |
| Telegram-Mini-Apps/vanillajs-template (★15) | ARCHIVED | офіційний `telegram-web-app.js` |
| shoelace-style/shoelace (★13,843) | ARCHIVED | shoelace-style/webawesome |
| vanna-ai/vanna (★23,815) | ARCHIVED, 2026-02-02 | text-to-SQL не рекомендуємо взагалі (див. 06) |
| protectai/rebuff (★1,522) | ARCHIVED, 2024-01 | власні правила + OWASP LLM Top 10 |
| bahuma20/firefly-iii-ai-categorize (★220) | ARCHIVED | sakowicz/actual-ai |
| telegraf/telegraf (★9,182) | останній реліз 2024-02-29 | grammY або прямий `fetch` |
| frappe/charts (★15,078) | останній реліз 2022-04-27 | uPlot / власний SVG |
| mckaywrigley/chatbot-ui (★33,349) | останній коміт 2024-06-22 | — |
| budgetzero/budgetzero (★655) | останній коміт 2022-08-12 | actualbudget/actual |
| alexey-goloburdin/telegram-finance-bot (★440) | останній коміт 2020-01-09 | — |
| microsoft/autogen (★60,937) | останній реліз 2025-09-30, коміти до 2026-04-06; ліцензія репо CC-BY-4.0 | не підходить (Python, multi-agent) |
| highlight/highlight (★9,371) | останній docker-реліз 2025-08-08 | Sentry / Bugsink |

## 4. Метрики за категоріями

### 4.1 Telegram

| Repository | ★ | Forks | Last commit | Release | Lang | License | Issues | Примітка |
|---|---:|---:|---|---|---|---|---:|---|
| [Telegram-Mini-Apps/tma.js](https://github.com/Telegram-Mini-Apps/tma.js) | 1,200 | 392 | 2026-07-14 | @tma.js/sdk-react@3.0.23 (2026-07-14) | TS | MIT | 4 | Монорепо: `sdk`, `init-data-node` (**вже у нас**), `signals`, `bridge`, `sdk-react/vue/svelte/solid` |
| [telegram-mini-apps-dev/TelegramUI](https://github.com/telegram-mini-apps-dev/TelegramUI) | 855 | 88 | 2025-10-14 | v2.1.13 | TS | MIT | 39 | Лише React; оновлень майже рік |
| [Telegram-Mini-Apps/reactjs-template](https://github.com/Telegram-Mini-Apps/reactjs-template) | 427 | 162 | 2025-11-12 | — | TS | MIT | 2 | React-шаблон |
| [twa-dev/SDK](https://github.com/twa-dev/SDK) | 330 | 39 | 2025-02-05 | v8.0.2 | JS | MIT | 17 | Обгортка, відстає від Bot API 9–10 |
| [grammyjs/grammY](https://github.com/grammyjs/grammY) | 3,740 | 154 | 2026-08-26 | v1.46.0 (2026-08-26) | TS | MIT | 11 | Найактивніший bot-фреймворк |
| [yagop/node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) | 9,207 | 1,643 | 2026-09-07 | v2.1.0 (2026-08-24) | TS | MIT | 0 | Відродився у 2026 |
| [telegraf/telegraf](https://github.com/telegraf/telegraf) | 9,182 | 940 | 2025-01-10 | v4.16.3 (2024-02) | TS | MIT | 66 | Стагнація |
| [telegram-mini-apps-dev/analytics](https://github.com/telegram-mini-apps-dev/analytics) | 102 | 30 | 2026-01-22 | v1.4.4 | TS | — | 12 | SDK для рейтингу в каталозі Telegram apps |
| [nikandr-surkov/telegram-mini-app-stars-payments](https://github.com/nikandr-surkov/telegram-mini-app-stars-payments) | 24 | 18 | 2025-08-16 | — | TS | — | 0 | Приклад Stars-платежів |
| [ton-connect/sdk](https://github.com/ton-connect/sdk) | 545 | 259 | 2026-08-06 | — | TS | Apache-2.0 | 50 | TON-гаманці (для нас IGNORE) |

Відкриті Telegram-трекери фінансів із GitHub-пошуку (`Kaiukov/budgetbot_tg_mini_app`, `funfinance/fin-bot-miniapp`, `Andu-alem/fintrack-miniapp`, `nmime/fracti` тощо) мають ★0–2 і 1–4 контриб'ютори. **Сильного open-source Telegram Mini App для фінансів не існує.** Ніша порожня, тому готового коду для копіювання немає.

### 4.2 Open-source фінансові застосунки

| Repository | ★ | Last commit | Release | Lang | License | Issues | Статус |
|---|---:|---|---|---|---|---:|---|
| [actualbudget/actual](https://github.com/actualbudget/actual) | 28,691 | 2026-09-11 | v26.9.0 (2026-09-01) | TS | MIT | 180 | дуже активний, ~702 contrib |
| [firefly-iii/firefly-iii](https://github.com/firefly-iii/firefly-iii) | 24,579 | 2026-09-08 | v6.6.6 (2026-07-01) | PHP | AGPL-3.0 | 169 | активний |
| [maybe-finance/maybe](https://github.com/maybe-finance/maybe) | 54,286 | 2025-07-24 | v0.6.0 | Ruby | AGPL-3.0 | 0 | **ARCHIVED** |
| [we-promise/sure](https://github.com/we-promise/sure) | 9,835 | 2026-09-11 | v0.7.4 (2026-08-31) | Ruby | AGPL-3.0 | 323 | дуже активний форк Maybe |
| [ghostfolio/ghostfolio](https://github.com/ghostfolio/ghostfolio) | 9,275 | 2026-09-10 | 3.69.0 | TS | AGPL-3.0 | 180 | інвестиції |
| [midday-ai/midday](https://github.com/midday-ai/midday) | 14,979 | 2026-06-13 | midday-v0.5.0 (2026-02-15) | TS | AGPL-3.0 | 4 | бізнес-фінанси + AI |
| [mayswind/ezbookkeeping](https://github.com/mayswind/ezbookkeeping) | 5,559 | 2026-09-10 | v1.6.1 (2026-07-20) | Go | **MIT** | 10 | легкий, має AI-розпізнавання |
| [bigcapitalhq/bigcapital](https://github.com/bigcapitalhq/bigcapital) | 3,887 | 2026-09-11 | v0.25.38 | TS | AGPL-3.0 | 148 | бухоблік |
| [spliit-app/spliit](https://github.com/spliit-app/spliit) | 2,928 | 2026-09-07 | 1.24.0 (2026-09-08) | TS | MIT | 179 | спільні витрати |
| [spiral-project/ihatemoney](https://github.com/spiral-project/ihatemoney) | 1,390 | 2026-08-07 | 7.2.1 | Python | NOASSERTION | 60 | спільні витрати |
| [Tanq16/ExpenseOwl](https://github.com/Tanq16/ExpenseOwl) | 1,506 | 2025-10-02 | v4.1 | HTML/Go | MIT | 43 | **vanilla HTML/JS + Chart.js** |
| [jameskokoska/Cashew](https://github.com/jameskokoska/Cashew) | 4,614 | 2026-03-09 | 5.3.4 (2024-07) | Dart | GPL-3.0 | 11 | мобільний UX-референс |
| [ananthakumaran/paisa](https://github.com/ananthakumaran/paisa) | 3,209 | 2026-09-06 | v0.7.6 | TS | AGPL-3.0 | 82 | ledger-based |
| [wealthfolio/wealthfolio](https://github.com/wealthfolio/wealthfolio) | 8,857 | 2026-09-10 | v3.8.0 | Rust | AGPL-3.0 | 394 | інвестиції |
| [beancount/beancount](https://github.com/beancount/beancount) | 5,990 | 2026-08-23 | — | Python | GPL-2.0 | 207 | plain-text accounting |
| [beancount/fava](https://github.com/beancount/fava) | 2,572 | 2026-09-09 | — | Python | MIT | 83 | UI для beancount |
| [hledgerorg/hledger](https://github.com/hledgerorg/hledger) | 4,705 | 2026-09-11 | 1.52.4 | Haskell | GPL-3.0 | 321 | plain-text accounting |
| [Gnucash/gnucash](https://github.com/Gnucash/gnucash) | 4,345 | 2026-09-06 | 5.16 | C | NOASSERTION | 0 | desktop |
| [moneymanagerex/moneymanagerex](https://github.com/moneymanagerex/moneymanagerex) | 2,265 | 2026-09-11 | v1.9.4 | C++ | GPL-2.0 | 453 | desktop |
| [mtotschnig/MyExpenses](https://github.com/mtotschnig/MyExpenses) | 1,179 | 2026-09-05 | — | Kotlin | GPL-3.0 | 462 | Android |
| [enrique-lozano/Monekin](https://github.com/enrique-lozano/Monekin) | 253 | 2026-08-28 | v10.0.4 | Dart | AGPL-3.0 | 21 | Flutter |
| [TheAxelander/OpenBudgeteer](https://github.com/TheAxelander/OpenBudgeteer) | 973 | 2025-12-17 | 1.11 | C# | AGPL-3.0 | 15 | bucket budgeting |
| [ellite/Wallos](https://github.com/ellite/Wallos) | 8,484 | 2026-09-10 | v5.7.1 (2026-09-10) | PHP | GPL-3.0 | 57 | трекер підписок |
| [DennisBauer/RecurringExpenseTracker](https://github.com/DennisBauer/RecurringExpenseTracker) | 398 | 2026-09-10 | v0.21.3 | Kotlin | GPL-3.0 | 18 | регулярні платежі + нагадування |
| [econumo/econumo](https://github.com/econumo/econumo) | 102 | 2026-09-11 | v1.4.1 | Go | MIT | 5 | сімейний бюджет, мультивалюта |
| [EnhancedJax/Bagels](https://github.com/EnhancedJax/Bagels) | 2,903 | 2025-07-06 | 0.3.12 | Python | GPL-3.0 | 14 | TUI, HN 283 pts |
| [rafsoh/dimeApp](https://github.com/rafsoh/dimeApp) | 1,884 | 2025-03-29 | — | Swift | GPL-3.0 | 56 | iOS-дизайн |
| [frappe/books](https://github.com/frappe/books) | 4,948 | 2026-09-06 | v0.36.0 | TS | AGPL-3.0 | 108 | бухоблік |
| [akaunting/akaunting](https://github.com/akaunting/akaunting) | 10,119 | 2026-09-11 | 3.2.3 | PHP | NOASSERTION | 5 | бухоблік |

### 4.3 AI-категоризація, парсинг, регулярні платежі

| Repository | ★ | Last commit | Release | Lang | License | Що це |
|---|---:|---|---|---|---|---|
| [sakowicz/actual-ai](https://github.com/sakowicz/actual-ai) | 519 | 2026-09-07 | 3.0.1 (2026-09-05) | TS | MIT | LLM-категоризація для Actual: rules → existing category → new category |
| [vas3k/TaxHacker](https://github.com/vas3k/TaxHacker) | 6,693 | 2026-08-11 | v0.8.5 | TS | MIT | LLM-розбір чеків і рахунків у структуровані поля |
| [GiGurra/subscription-detector](https://github.com/GiGurra/subscription-detector) | 1 | 2026-07-01 | v0.0.35 | Go | MIT | Детектор щомісячних підписок з банківських виписок |
| [c2siorg/genie](https://github.com/c2siorg/genie) | 7 | 2026-06-29 | — | Go | — | Агенти, серед них `subscription_detector` |
| [spendifai/spendif-ai](https://github.com/spendifai/spendif-ai) | 4 | 2026-09-02 | v0.2.1 | Python | NOASSERTION | LLM-категоризація |
| [kangjul3854/hyufa](https://github.com/kangjul3854/hyufa) | 243 | 2025-12-07 | — | HTML | — | AI finance assistant для студентів |

### 4.4 AI-агенти та LLM-інфраструктура

| Repository | ★ | Last commit | Release | Lang | License | Issues |
|---|---:|---|---|---|---|---:|
| [vercel/ai](https://github.com/vercel/ai) | 26,689 | 2026-09-11 | ai v7.0.97 (npm) | TS | NOASSERTION | 579 |
| [mastra-ai/mastra](https://github.com/mastra-ai/mastra) | 27,935 | 2026-09-11 | @mastra/core@1.66.0 | TS | NOASSERTION | 276 |
| [langchain-ai/langgraphjs](https://github.com/langchain-ai/langgraphjs) | 3,273 | 2026-09-10 | — | TS | MIT | 84 |
| [langchain-ai/langgraph](https://github.com/langchain-ai/langgraph) | 41,458 | 2026-09-09 | sdk==0.4.4 | Python | MIT | 530 |
| [openai/openai-agents-js](https://github.com/openai/openai-agents-js) | 3,790 | 2026-09-10 | v0.18.0 | TS | MIT | 10 |
| [openai/openai-agents-python](https://github.com/openai/openai-agents-python) | 29,355 | 2026-09-10 | v0.22.2 | Python | MIT | 13 |
| [pydantic/pydantic-ai](https://github.com/pydantic/pydantic-ai) | 19,864 | 2026-09-11 | v2.42.0 | Python | MIT | 609 |
| [crewAIInc/crewAI](https://github.com/crewAIInc/crewAI) | 58,369 | 2026-09-11 | 1.15.21 | Python | MIT | 97 |
| [microsoft/autogen](https://github.com/microsoft/autogen) | 60,937 | 2026-04-06 | python-v0.7.5 (2025-09) | Python | CC-BY-4.0 | 550 |
| [VoltAgent/voltagent](https://github.com/VoltAgent/voltagent) | 10,594 | 2026-08-27 | — | TS | MIT | 35 |
| [TanStack/ai](https://github.com/TanStack/ai) | 3,097 | 2026-09-10 | — | TS | MIT | 50 |
| [cloudflare/agents](https://github.com/cloudflare/agents) | 5,544 | 2026-09-11 | — | TS | MIT | 122 |
| [inngest/agent-kit](https://github.com/inngest/agent-kit) | 927 | 2026-04-29 | 0.13.2 (2025-11) | TS | Apache-2.0 | 35 |
| [agno-agi/agno](https://github.com/agno-agi/agno) | 42,136 | 2026-09-11 | v3.0.9 | Python | Apache-2.0 | 688 |
| [huggingface/smolagents](https://github.com/huggingface/smolagents) | 29,286 | 2026-08-22 | v1.26.0 | Python | Apache-2.0 | 317 |
| [google/adk-python](https://github.com/google/adk-python) | 21,499 | 2026-09-11 | v2.9.0 | Python | Apache-2.0 | 276 |
| [BerriAI/litellm](https://github.com/BerriAI/litellm) | 58,509 | 2026-09-11 | v1.100.1 | Python | NOASSERTION | 1,696 |
| [BoundaryML/baml](https://github.com/BoundaryML/baml) | 9,167 | 2026-09-11 | nightly | Rust | Apache-2.0 | 222 |
| [567-labs/instructor-js](https://github.com/567-labs/instructor-js) | 803 | 2025-01-27 | v1.7.0 | TS | MIT | 12 |
| [colinhacks/zod](https://github.com/colinhacks/zod) | 43,927 | 2026-09-10 | v4.6.2 | TS | MIT | 33 |
| [modelcontextprotocol/typescript-sdk](https://github.com/modelcontextprotocol/typescript-sdk) | 13,371 | 2026-09-11 | — | TS | NOASSERTION | 293 |
| [promptfoo/promptfoo](https://github.com/promptfoo/promptfoo) | 25,021 | 2026-09-11 | 0.123.0 (2026-09-10) | TS | MIT | 128 |
| [langfuse/langfuse](https://github.com/langfuse/langfuse) | 34,475 | 2026-09-11 | v4.35.0 | TS | NOASSERTION | 304 |
| [Helicone/helicone](https://github.com/Helicone/helicone) | 6,147 | 2026-08-31 | v2025.08.21-1 | TS | Apache-2.0 | 57 |
| [Arize-ai/phoenix](https://github.com/Arize-ai/phoenix) | 11,417 | 2026-09-11 | — | Python | NOASSERTION | 842 |
| [Portkey-AI/gateway](https://github.com/Portkey-AI/gateway) | 12,963 | 2026-05-25 | v1.15.2 (2026-01) | TS | MIT | 112 |

### 4.5 Chat UI

| Repository | ★ | Last commit | Lang | License | Framework |
|---|---:|---|---|---|---|
| [OvidijusParsiunas/deep-chat](https://github.com/OvidijusParsiunas/deep-chat) | 3,713 | 2026-09-10 | TS | MIT | **Web Component, працює у vanilla** |
| [nlkitai/nlux](https://github.com/nlkitai/nlux) | 1,381 | 2025-11-25 | TS | NOASSERTION | React + vanilla |
| [assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui) | 12,109 | 2026-09-11 | TS | MIT | React |
| [vercel/ai-elements](https://github.com/vercel/ai-elements) | 2,427 | 2026-08-21 | TS | NOASSERTION | React/shadcn |
| [vercel/chatbot](https://github.com/vercel/chatbot) | 20,935 | 2026-07-08 | TS | NOASSERTION | Next.js |
| [vercel/streamdown](https://github.com/vercel/streamdown) | 5,613 | 2026-09-10 | TS | NOASSERTION | React |
| [CopilotKit/CopilotKit](https://github.com/CopilotKit/CopilotKit) | 37,295 | 2026-09-11 | TS | MIT | React |
| [open-webui/open-webui](https://github.com/open-webui/open-webui) | 151,620 | 2026-09-04 | Python/Svelte | NOASSERTION | застосунок |
| [lobehub/lobehub](https://github.com/lobehub/lobehub) | 82,392 | 2026-09-11 | TS | NOASSERTION | застосунок |
| [danny-avila/LibreChat](https://github.com/danny-avila/LibreChat) | 43,030 | 2026-09-10 | TS | MIT | застосунок |
| [huggingface/chat-ui](https://github.com/huggingface/chat-ui) | 10,941 | 2026-09-10 | TS | Apache-2.0 | Svelte |
| [markedjs/marked](https://github.com/markedjs/marked) | 37,135 | 2026-09-10 | JS | NOASSERTION | vanilla |
| [cure53/DOMPurify](https://github.com/cure53/DOMPurify) | 17,378 | 2026-09-09 | JS | Apache-2.0 | vanilla |

### 4.6 Аналітика, прогнозування, графіки

| Repository | ★ | Last commit | Release | License | min / gzip (bundlephobia) | npm/тиждень |
|---|---:|---|---|---|---|---:|
| [leeoniya/uPlot](https://github.com/leeoniya/uPlot) | 10,485 | 2026-09-09 | 1.6.32 | MIT | 49.6 / **21.3 KB** | 414k |
| [chartjs/Chart.js](https://github.com/chartjs/Chart.js) | 67,689 | 2026-09-11 | v4.5.1 | MIT | 196.1 / 66.8 KB | 9.1M |
| [apache/echarts](https://github.com/apache/echarts) | 67,297 | 2026-09-11 | 6.1.0 | Apache-2.0 | 1088.7 / 359.3 KB | 3.7M |
| [apexcharts/apexcharts.js](https://github.com/apexcharts/apexcharts.js) | 15,153 | 2026-09-10 | v7.1.0 | NOASSERTION | 898.8 / 254.4 KB | 1.5M |
| [tradingview/lightweight-charts](https://github.com/tradingview/lightweight-charts) | 17,238 | 2026-09-10 | v5.2.1 | Apache-2.0 | 189.7 / 60.1 KB | 780k |
| [observablehq/plot](https://github.com/observablehq/plot) | 5,374 | 2026-09-01 | v0.6.17 (2025-02) | ISC | 375.5 / 125 KB | 421k |
| [d3/d3](https://github.com/d3/d3) | 113,714 | 2026-05-28 | v7.9.0 (2024-03) | ISC | модульно | 15.4M |
| [recharts/recharts](https://github.com/recharts/recharts) | 27,552 | 2026-09-11 | v3.10.1 | MIT | 548.5 / 144.1 KB (React) | 40.3M |
| [plouc/nivo](https://github.com/plouc/nivo) | 14,093 | 2026-07-21 | v0.99.0 (2025-05) | MIT | React | — |
| [airbnb/visx](https://github.com/airbnb/visx) | 21,046 | 2026-06-22 | v4.0.0 | MIT | React | — |
| [frappe/charts](https://github.com/frappe/charts) | 15,078 | 2024-12-12 | v1.6.3 (2022) | MIT | 65.9 / 19.4 KB | 55k |
| [naver/billboard.js](https://github.com/naver/billboard.js) | 6,007 | 2026-09-11 | 4.0.3 | MIT | 396 / 132.5 KB | 31k |
| [f5/unovis](https://github.com/f5/unovis) | 2,848 | 2026-09-10 | 1.7.0 | Apache-2.0 | UNVERIFIED | 169k |
| [simple-statistics/simple-statistics](https://github.com/simple-statistics/simple-statistics) | 3,520 | 2026-09-08 | v7.12.0 | ISC | 26.6 / 9.9 KB | 924k |
| [facebook/prophet](https://github.com/facebook/prophet) | 20,395 | 2026-08-27 | v1.4.0 | MIT | Python | — |
| [Nixtla/statsforecast](https://github.com/Nixtla/statsforecast) | 4,905 | 2026-09-10 | v2.1.1 | Apache-2.0 | Python | — |
| [unit8co/darts](https://github.com/unit8co/darts) | 9,518 | 2026-09-07 | 0.47.0 | Apache-2.0 | Python | — |

### 4.7 UI, дизайн-системи, іконки

| Repository | ★ | Last commit | License | Сумісність з vanilla |
|---|---:|---|---|---|
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | 123,564 | 2026-09-08 | MIT | ні (React + Tailwind) |
| [radix-ui/primitives](https://github.com/radix-ui/primitives) | 19,260 | 2026-07-31 | MIT | ні (React) |
| [mui/base-ui](https://github.com/mui/base-ui) | 10,879 | 2026-09-11 | MIT | ні (React) |
| [adobe/react-spectrum](https://github.com/adobe/react-spectrum) (React Aria) | 15,864 | 2026-09-09 | Apache-2.0 | ні (React) |
| [mantinedev/mantine](https://github.com/mantinedev/mantine) | 31,697 | 2026-09-10 | MIT | ні |
| [chakra-ui/chakra-ui](https://github.com/chakra-ui/chakra-ui) | 40,641 | 2026-09-09 | MIT | ні |
| [mui/material-ui](https://github.com/mui/material-ui) | 99,027 | 2026-09-11 | MIT | ні |
| [saadeghi/daisyui](https://github.com/saadeghi/daisyui) | 42,360 | 2026-09-11 | MIT | так (CSS), але потребує Tailwind |
| [tailwindlabs/tailwindcss](https://github.com/tailwindlabs/tailwindcss) | 97,499 | 2026-09-08 | MIT | так, але потребує збирача |
| [konstaui/konsta](https://github.com/konstaui/konsta) | 4,250 | 2026-09-02 | MIT | ні (React/Vue/Svelte) |
| [framework7io/framework7](https://github.com/framework7io/framework7) | 18,754 | 2026-09-08 | MIT | так, але це заміна всього каркаса |
| [ionic-team/ionic-framework](https://github.com/ionic-team/ionic-framework) | 52,657 | 2026-09-10 | MIT | Web Components, важкий |
| [shoelace-style/webawesome](https://github.com/shoelace-style/webawesome) | 1,311 | 2026-09-10 | MIT | Web Components |
| [argyleink/open-props](https://github.com/argyleink/open-props) | 5,513 | 2026-08-11 | MIT | так (CSS-токени) |
| [lucide-icons/lucide](https://github.com/lucide-icons/lucide) | 24,462 | 2026-09-11 | NOASSERTION | так (статичні SVG) |
| [tabler/tabler-icons](https://github.com/tabler/tabler-icons) | 21,657 | 2026-09-03 | MIT | так |
| [phosphor-icons/core](https://github.com/phosphor-icons/core) | 378 | 2026-01-06 | MIT | так |
| [emilkowalski/vaul](https://github.com/emilkowalski/vaul) | 8,601 | 2025-10-03 | MIT | ні (React drawer) |
| [emilkowalski/sonner](https://github.com/emilkowalski/sonner) | 12,956 | 2026-08-10 | MIT | ні (React toasts) |
| [viliket/pure-web-bottom-sheet](https://github.com/viliket/pure-web-bottom-sheet) | 64 | 2026-08-12 | MIT | так (Web Component, CSS scroll-snap) |

### 4.8 Анімації та мікровзаємодії

| Repository | ★ | Last commit | License | gzip | Примітка |
|---|---:|---|---|---|---|
| [greensock/GSAP](https://github.com/greensock/GSAP) | 28,353 | 2026-04-13 | власна (—) | 26.7 KB (gsap 3.15.0) | **вже у проєкті** (`web/src/vendor/gsap.min.js`, `Flip.min.js`) |
| [motiondivision/motion](https://github.com/motiondivision/motion) | 33,557 | 2026-09-11 | MIT | 44.5 KB | є vanilla API; дублює GSAP |
| [formkit/auto-animate](https://github.com/formkit/auto-animate) | 13,915 | 2026-07-10 | MIT | 3.2 KB | дублює GSAP Flip |
| [juliangarnier/anime](https://github.com/juliangarnier/anime) | 72,781 | 2026-08-09 | MIT | 39.3 KB | дублює GSAP |
| [airbnb/lottie-web](https://github.com/airbnb/lottie-web) | 32,085 | 2024-11-19 | MIT | — | стагнує |
| [LottieFiles/dotlottie-web](https://github.com/LottieFiles/dotlottie-web) | 875 | 2026-08-28 | MIT | — | сучасний Lottie-плеєр |
| [rive-app/rive-wasm](https://github.com/rive-app/rive-wasm) | 967 | 2026-09-11 | MIT | WASM | інтерактивні анімації |
| [barvian/number-flow](https://github.com/barvian/number-flow) | 7,690 | 2026-07-18 | MIT | UNVERIFIED | анімація чисел, є vanilla web component |
| [inorganik/countUp.js](https://github.com/inorganik/countUp.js) | 8,162 | 2026-07-02 | MIT | 2.2 KB | анімація чисел |
| [nolimits4web/swiper](https://github.com/nolimits4web/swiper) | 41,904 | 2026-09-08 | MIT | 19.6 KB | свайпи й каруселі |
| [pmndrs/use-gesture](https://github.com/pmndrs/use-gesture) | 9,621 | 2024-03-21 | MIT | — | `@use-gesture/vanilla`, стагнує |

### 4.9 Бекенд, черги, синхронізація, стан

| Repository | ★ | Last commit | Release | License | Примітка |
|---|---:|---|---|---|---|
| [timgit/pg-boss](https://github.com/timgit/pg-boss) | 3,944 | 2026-09-10 | 12.31.0 | MIT | черга й cron **поверх PostgreSQL** |
| [graphile/worker](https://github.com/graphile/worker) | 2,385 | 2026-09-08 | v0.18.0 | MIT | черга поверх PostgreSQL |
| [kelektiv/node-cron](https://github.com/kelektiv/node-cron) | 8,948 | 2026-09-10 | v4.4.0 | MIT | cron у процесі |
| [taskforcesh/bullmq](https://github.com/taskforcesh/bullmq) | 9,390 | 2026-09-11 | — | MIT | потребує Redis |
| [brianc/node-postgres](https://github.com/brianc/node-postgres) | 13,203 | 2026-09-11 | — | MIT | **вже у проєкті** (`pg`) |
| [salsita/node-pg-migrate](https://github.com/salsita/node-pg-migrate) | 1,481 | 2026-09-09 | v9.0.0 | MIT | **вже у проєкті** |
| [pgvector/pgvector](https://github.com/pgvector/pgvector) | 22,984 | 2026-09-08 | — | NOASSERTION (PostgreSQL License) | вектори в PG |
| [paradedb/paradedb](https://github.com/paradedb/paradedb) | 9,253 | 2026-09-11 | v0.25.8 | AGPL-3.0 | BM25 у PG |
| [supabase/supabase](https://github.com/supabase/supabase) | 109,054 | 2026-09-11 | — | Apache-2.0 | платформа |
| [neondatabase/neon](https://github.com/neondatabase/neon) | 23,069 | 2026-08-31 | — | Apache-2.0 | serverless PG |
| [tursodatabase/turso](https://github.com/tursodatabase/turso) | 24,241 | 2026-09-11 | v0.7.2 | MIT | SQLite-сумісна |
| [drizzle-team/drizzle-orm](https://github.com/drizzle-team/drizzle-orm) | 35,744 | 2026-07-23 | 0.45.2 | Apache-2.0 | ORM (не потрібна, див. 09) |
| [kysely-org/kysely](https://github.com/kysely-org/kysely) | 14,216 | 2026-09-11 | v0.29.5 | MIT | query builder |
| [electric-sql/electric](https://github.com/electric-sql/electric) | 10,358 | 2026-09-09 | — | Apache-2.0 | PG → клієнт sync |
| [tinyplex/tinybase](https://github.com/tinyplex/tinybase) | 5,168 | 2026-09-11 | v9.7.0 | MIT | локальний стор |
| [pmndrs/zustand](https://github.com/pmndrs/zustand) | 58,665 | 2026-08-24 | v5.0.15 | MIT | 0.5 KB, є vanilla store |
| [nanostores/nanostores](https://github.com/nanostores/nanostores) | 7,600 | 2026-09-08 | 1.5.3 | MIT | tiny, framework-agnostic |
| [preactjs/signals](https://github.com/preactjs/signals) | 4,482 | 2026-09-04 | — | MIT | `signals-core` для vanilla |
| [TanStack/query](https://github.com/TanStack/query) | 50,278 | 2026-09-10 | — | MIT | `query-core` можливий, але розрахований на фреймворки |
| [reduxjs/redux-toolkit](https://github.com/reduxjs/redux-toolkit) | 11,223 | 2026-09-06 | v2.12.0 | MIT | надлишковий |
| [pmndrs/jotai](https://github.com/pmndrs/jotai) | 21,261 | 2026-09-08 | v3.0.0 | MIT | React |
| [pmndrs/valtio](https://github.com/pmndrs/valtio) | 10,230 | 2026-09-07 | v2.3.2 | MIT | React-орієнтований |
| [evanw/esbuild](https://github.com/evanw/esbuild) | 40,050 | 2026-08-09 | v0.28.2 | MIT | мінімальний збирач |
| [vitejs/vite](https://github.com/vitejs/vite) | 82,788 | 2026-09-10 | — | MIT | повноцінний тулчейн |
| [GoogleChrome/workbox](https://github.com/GoogleChrome/workbox) | 13,007 | 2026-09-02 | v7.4.1 | MIT | service worker |
| [jakearchibald/idb-keyval](https://github.com/jakearchibald/idb-keyval) | 3,239 | 2026-07-08 | — | NOASSERTION | 0.8 KB IndexedDB |

### 4.10 Безпека, продуктова аналітика, помилки

| Repository | ★ | Last commit | Release | License |
|---|---:|---|---|---|
| [helmetjs/helmet](https://github.com/helmetjs/helmet) | 10,734 | 2026-07-28 | — | MIT |
| [animir/node-rate-limiter-flexible](https://github.com/animir/node-rate-limiter-flexible) | 3,585 | 2026-06-08 | v11.2.0 | ISC |
| [NVIDIA-NeMo/Guardrails](https://github.com/NVIDIA-NeMo/Guardrails) | 7,102 | 2026-09-10 | v0.24.0 | NOASSERTION |
| [guardrails-ai/guardrails](https://github.com/guardrails-ai/guardrails) | 7,395 | 2026-08-26 | v0.11.0 | Apache-2.0 |
| [meta-llama/PurpleLlama](https://github.com/meta-llama/PurpleLlama) | 4,386 | 2026-08-18 | — | NOASSERTION |
| [PostHog/posthog](https://github.com/PostHog/posthog) | 39,743 | 2026-09-11 | — | NOASSERTION |
| [plausible/analytics](https://github.com/plausible/analytics) | 29,024 | 2026-09-11 | v3.2.1 | AGPL-3.0 |
| [umami-software/umami](https://github.com/umami-software/umami) | 38,740 | 2026-08-20 | v3.3.1 | MIT |
| [Openpanel-dev/openpanel](https://github.com/Openpanel-dev/openpanel) | 6,918 | 2026-09-04 | — | AGPL-3.0 |
| [growthbook/growthbook](https://github.com/growthbook/growthbook) | 8,341 | 2026-09-11 | v5.0.1 | NOASSERTION |
| [matomo-org/matomo](https://github.com/matomo-org/matomo) | 21,855 | 2026-09-11 | 5.13.0 | GPL-3.0 |
| [getsentry/sentry](https://github.com/getsentry/sentry) | 44,761 | 2026-09-11 | 26.8.0 | NOASSERTION (FSL) |
| [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript) | 8,745 | 2026-09-11 | 10.74.0 | MIT |
| [bugsink/bugsink](https://github.com/bugsink/bugsink) | 2,064 | 2026-09-11 | 2.5.1 | NOASSERTION |
| [open-telemetry/opentelemetry-js](https://github.com/open-telemetry/opentelemetry-js) | 3,465 | 2026-09-10 | v2.11.0 | Apache-2.0 |
| [SigNoz/signoz](https://github.com/SigNoz/signoz) | 32,079 | 2026-09-11 | v0.141.1 | NOASSERTION |
| [hyperdxio/hyperdx](https://github.com/hyperdxio/hyperdx) | 9,881 | 2026-09-11 | — | MIT |
| GlitchTip | — | — | — | основний репозиторій на GitLab; GitHub-дзеркало не знайдено — **UNVERIFIED** |

### 4.11 Україна: банківські API та MCC-довідники

| Repository | ★ | Last commit | License | Примітка |
|---|---:|---|---|---|
| [Oleksios/Merchant-Category-Codes](https://github.com/Oleksios/Merchant-Category-Codes) | 70 | 2023-08-21 | MIT | MCC з українськими описами |
| [greggles/mcc-codes](https://github.com/greggles/mcc-codes) | 536 | 2024-08-16 | Unlicense | загальний MCC-довідник (EN) |
| [Sominemo/MCC-Localize-Dataset](https://github.com/Sominemo/MCC-Localize-Dataset) | 18 | 2020-03-23 | MIT | один файл `mcc-loc.json` |
| [jleclanche/python-iso18245](https://github.com/jleclanche/python-iso18245) | 76 | 2025-09-03 | MIT | ISO 18245, Python |
| [OlexiyOdarchuk/go-monobank-sdk](https://github.com/OlexiyOdarchuk/go-monobank-sdk) | 7 | 2026-09-01 | MIT | Go SDK monobank |
| [andriyor/monobank-api](https://github.com/andriyor/monobank-api) | 1 | 2026-06-16 | — | TS, без ліцензії |

Висновок: для monobank SDK не потрібен. API складається з 4 REST-ендпоінтів, досить звичайного `fetch` (правило ponytail: спершу нативні засоби).

## 5. Code-level аналіз

Шляхи перевірені через Git Trees API 11.09.2026. «Прочитано» означає, що файл відкрито й проаналізовано.

### 5.1 actualbudget/actual (MIT): найцінніше джерело коду

| Файл | Що всередині | Як використати в «Копійці» |
|---|---|---|
| `packages/loot-core/src/server/schedules/find-schedules.ts` (**прочитано**) | Автопошук регулярних платежів. Для weekly / every 2 weeks / monthly будується RRULE-розклад на 3 останні входження. Для кожної транзакції шукаються збіги з тим самим `payee`, сумою в межах `getApproxNumberThreshold(amount)` і датою ±2 дні. Кандидати ранжуються за формулою `rank = Σ 1/(|Δdays|+1)`, окремо позначаються `exactDate` та `exactAmount` | Перенести алгоритм на Node: групувати за нормалізованою нотаткою/категорією, перевіряти 3 періоди, ранжувати за близькістю дат. Код MIT, адаптація дозволена |
| `packages/loot-core/src/server/rules/{rule.ts,condition.ts,action.ts,rule-indexer.ts}` | Rules engine: умови (payee, notes, amount, date…), дії (set category…), індексатор правил для швидкого матчингу | Наш «словник» (`user_glossary`) — це вироджений rules engine з одним полем. Наступний крок: умова «нотатка містить X **і** сума < Y → категорія Z» |
| `packages/loot-core/src/server/budget/{envelope.ts,tracking.ts}` | Дві моделі бюджету: envelope (zero-based, «кожна гривня має роботу») і tracking (прості ліміти) | Підтверджує вибір: у нас tracking-модель (ліміти категорій + денний план). Envelope варто пропонувати лише як опцію (див. 07) |
| `packages/loot-core/src/server/budget/goal-template.ts` (**прочитано**), `schedule-template.ts` | Бюджетні шаблони: `distributeRemainder()` вагово розподіляє залишок бюджету між категоріями | Ідея для «AI створює бюджет»: LLM не рахує, а сервер застосовує шаблони (ваги з історії) |
| `packages/cli/src/commands/{rules,schedules,categories}.ts` | CLI-команди | Готові контракти для інструментів Roo |

### 5.2 we-promise/sure (AGPL-3.0): лише ідеї, не код

| Файл | Що всередині | Ідея для нас |
|---|---|---|
| `app/models/assistant/function/*.rb` (40+ файлів) | Інструменти помічника: `get_transactions`, `update_transaction`, `create_goal`, `update_budget`, `create_category`, `get_recurring_transactions`, `get_insights`, `get_paycheck_plan` тощо | Готовий перелік інструментів для Roo |
| `app/models/assistant/function/update_transaction.rb` (**прочитано**) | Схема зі значенням «Omit to leave unchanged», `null` означає очистити поле. На кожному виклику перевіряються права (`permitted_to_update?`), належність тегів до сім'ї та наявність змін (`no_changes`). Помилки мають машинні коди (`not_found`, `split_child`, `not_authorized`) | Шаблон для write-інструментів Roo: сервер валідує **все**, модель отримує код помилки, а не stack trace |
| `app/models/assistant/{function_tool_caller.rb,history_trimmer.rb,token_budget.rb,token_estimator.rb}` | Виклик інструментів, обрізання історії, бюджет токенів | Нам вистачає `MAX_HISTORY = 12`. Бюджет токенів знадобиться з пам'яттю |
| `app/models/recurring_transaction/identifier.rb` (**прочитано**) | Кластеризація сум з допуском **7.5%**. Щоб **запропонувати** кандидата, досить 2 входжень; щоб діяти автоматично, потрібно **3**. Нові серії створюються зі статусом `suggested`. Відхилені користувачем серії лишаються «надгробками», тож ті самі не пропонуються знову. Дохід визначається за джерелом, а не за сумою | Точні параметри для нашого детектора (див. 09, 16) |
| `app/models/recurring_transaction/{price_change_detector.rb,paycheck_planner.rb,matcher.rb,pipeline.rb}` | Детекція подорожчання, планувальник зарплати | «Netflix подорожчав на 20%» і «до зарплати лишиться…» |
| `app/models/insight/generators/*.rb` (8 генераторів) | `budget_insight`, `cash_flow_warning`, `idle_cash`, `maintained_goal_depleted`, `net_worth_milestone`, `savings_rate_change`, `spending_anomaly`, `subscription_audit` | Каталог проактивних інсайтів без LLM (див. 08, 14) |
| `app/models/family/auto_categorizer.rb` (**прочитано**) | LLM-категоризація пакетом. Результат пишеться з `source: "ai"`, поле блокується (`lock_attr!`), тож ручне значення користувача не перезаписується. Є кеш і журнал `DebugLogEntry` | Зберігати джерело категорії (`user` / `glossary` / `history` / `ai`) і ніколи не перезаписувати ручне |
| `app/models/eval/runners/merchant_detection_runner.rb`, `.github/workflows/llm-evals.yml` | Автоматичні LLM-evals у CI | Обов'язково для нашого парсера (див. 05) |
| `app/models/budget/rollover_calculator.rb` | Перенос залишку бюджету | «Rolling budget» (див. 07) |

### 5.3 midday-ai/midday (AGPL-3.0): лише ідеї

| Файл | Що всередині |
|---|---|
| `apps/api/src/chat/assistant-runtime.ts` (**прочитано**) | Vercel AI SDK `ToolLoopAgent` на `gpt-4.1-mini`. Обмеження `stopWhen: stepCountIs(10)`, `prepareStep` з `maxTools: 12` (динамічний відбір інструментів), `smoothStream()` для стрімінгу, інструмент `search_tools` для пошуку серед десятків MCP-інструментів |
| `apps/api/src/mcp/tools/{transactions,reports,search,categories}.ts` | Інструменти як MCP-сервер: той самий набір доступний і вбудованому чату, і зовнішнім клієнтам |
| `packages/categories/src/embeddings.ts` (**прочитано**) | `gemini-embedding-001`, 768 вимірів, `taskType: SEMANTIC_SIMILARITY` для назв категорій |
| `apps/worker/src/utils/enrichment-schema.ts` (**прочитано**) | Zod-enum дозволених категорій з явними `uncategorized` і `other` як fallback |
| `apps/worker/src/processors/transactions/enrich-transaction.ts` | Фонове збагачення транзакцій |
| `apps/dashboard/src/components/charts/{burn-rate-chart,runway-chart,revenue-forecast-chart,category-expense-donut-chart}.tsx` | Burn rate / runway / прогноз — прямий аналог нашого «на скільки днів вистачить» |

Висновок: наш `roo.js` (обмеження 4 кроки, `READ_TOOLS`, сервер рахує суми) архітектурно ближчий до Midday, ніж здається. Бракує лише стрімінгу та write-інструментів.

### 5.4 sakowicz/actual-ai (MIT): пайплайн категоризації

- `src/transaction/processing-strategy/{rule-match-strategy.ts,existing-category-strategy.ts,new-category-strategy.ts}`. Послідовність: спершу чи збігається правило, потім чи підходить наявна категорія, лише потім пропозиція нової. У нас так само, лише без проміжного кроку: словник → LLM → `needsCategory`.
- `src/similarity-calculator.ts` (**прочитано**) дедуплікує схожі назви категорій формулою `0.6·Jaccard(стеми) + 0.4·Jaro-Winkler + 0.15 subset boost`. Для української потрібен свій стемер. У нас уже є найпростіший варіант `normalizeWord()` у `server/bot-ai.js:94`, який відрізає останню літеру.
- `src/transaction/category-suggester.ts` (**прочитано**). LLM регулярно пропонує категорії, які вже існують, і прапорцю `groupIsNew` від моделі не можна довіряти. Автор індексує наявні категорії та резолвить їх послідовно. Урок: **ніколи не довіряти прапорцям від LLM**, лише фактам з БД.
- `src/templates/prompt.hbs` — шаблон промпту в Handlebars.

### 5.5 GiGurra/subscription-detector (MIT): найпростіший детектор

`internal/detector.go` (**прочитано**):
1. Групує транзакції за нормалізованим `payee`, мінімум 2 входження, лише витрати.
2. `IsMonthlyPattern`: **рівно одна** оплата на календарний місяць.
3. `AmountsWithinTolerance`: сусідні суми відрізняються не більш як на `tolerance` (типово 35%). Так ураховуються зміни курсу.
4. Статистика: середня, мінімальна й максимальна сума, «типовий день» (середній день місяця).
5. `DetermineStatus`: активна чи припинена, залежно від пропущених місяців.

Близько 150 рядків, переноситься на JS майже дослівно.

### 5.6 vas3k/TaxHacker (MIT)

`ai/schema.ts` (**прочитано**) генерує JSON Schema з полів, які визначає користувач (`field.llm_prompt` стає `description`), плюс масив `items`, щоб «знайти всі позиції». Ідея для розбору чека: схема `{amount, category(enum з категорій користувача), note, date, items[]}` будується динамічно з категорій. `ai/prompt.ts`, `ai/analyze.ts` — промпт і виклик.

### 5.7 mayswind/ezbookkeeping (MIT)

- `pkg/api/large_language_models.go` (**прочитано**): `RecognizeTransactionTextHandler`, тобто текст → транзакція. Він бере **часовий пояс клієнта** (`GetClientTimezone`), а нашому боту саме цього бракує. Має перевірку feature-restriction для кожного користувача та окремі помилки для порожнього тексту.
- `pkg/converters/ai/ai_recognized_transaction_data_parser.go` — розбір відповіді LLM.
- `pkg/exchangerates/national_bank_of_ukraine_datasource.go` — **курси НБУ**, готове джерело для мультивалютності (у нас таблиця `currencies` уже є).
- `pkg/mcp/query_all_transaction_categories_tool_handler.go` — MCP-інструмент.
- `pkg/llm/provider/*` — адаптери OpenAI, Anthropic, Google, Ollama, LM Studio, OpenRouter.

### 5.8 Tanq16/ExpenseOwl (MIT): той самий «клас» стеку

`internal/web/templates/{index.html,functions.js,chart.min.js,sw.js}`: vanilla HTML/JS, Chart.js як один файл, service worker, без збирача. Доказ, що продукт з 1.5k★ і HN 227 pts живе без фреймворку. Наш підхід (vanilla) не є технічним боргом сам по собі.

### 5.9 Telegram-Mini-Apps/tma.js (MIT)

Пакети (`packages/*/package.json`): `sdk`, `init-data-node`, `signals`, `bridge`, `transformers`, `types`, `toolkit`, `create-mini-app`, `sdk-react/vue/svelte/solid`. У нас уже є `@tma.js/init-data-node` (6,065 завантажень/тиждень на npm). `@tma.js/sdk` фреймворк-незалежний, але нам достатньо офіційного `telegram-web-app.js`: адаптер `web/telegram-adapter.js` вже покриває потрібне.

### 5.10 DennisBauer/RecurringExpenseTracker (GPL-3.0): ідеї

`shared/src/commonMain/kotlin/de/dbauer/expensetracker/shared/model/UpcomingPaymentsExpander.kt` розгортає регулярні платежі в майбутні дати. `.../notification/ExpenseNotificationManager.kt` — нагадування за N днів. Ідея: «наступні платежі» на екрані «Кишені» та нагадування в боті.

## 6. Висновки GitHub-дослідження

1. **Готового open-source Telegram-трекера фінансів високої якості немає.** Ніша вільна, але й копіювати нема чого. Користь дають окремі модулі з інших продуктів.
2. **Три найцінніші джерела коду з дозвільною ліцензією:** Actual (MIT), actual-ai (MIT), ezbookkeeping (MIT). Sure й Midday найсильніші за ідеями, але під AGPL.
3. **React-екосистема (shadcn, Radix, Recharts, TelegramUI, assistant-ui) для нас IGNORE або INSPIRE.** Взяти будь-що з неї можна лише після переписування фронтенду, а це не виправдано (див. 16, 17).
4. Під правило ponytail «спершу вже встановлене й нативне» потрапляють: GSAP (вже є) замість Motion/AutoAnimate, PostgreSQL (вже є) замість Redis/BullMQ, `fetch` замість SDK monobank, Telegram API замість сторонніх UI-китів.
