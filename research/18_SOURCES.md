# 18. Sources

Дата дослідження: **11.09.2026**. Усі джерела відкривались цього дня, якщо не зазначено інше.

## 1. Інструменти та доступність джерел (agent-reach)

| Канал | Бекенд | Статус | Примітка |
|---|---|---|---|
| GitHub | `gh` CLI (авторизований) | ✓ | GraphQL-метрики ~235 репозиторіїв, Git Trees API, читання файлів |
| Веб-пошук | Exa через `mcporter` | ✓, **під кінець вичерпано безкоштовний ліміт MCP** | останні 1–2 пошуки (Rocket Money pricing) не виконано |
| Читання сторінок | Jina Reader | ✓ | деякі сайти заблокували (див. §4) |
| YouTube | `yt-dlp` (`ytsearch`) | ✓ | переважно beginner-туторіали без унікальної інформації, як і попереджав промпт |
| Hacker News | Algolia API (`hn.algolia.com`) | ✓ | пошук історій з 2024, коментарі |
| **Reddit** | не налаштовано (потрібен вхід) | ⚠ **запасний шлях** | заголовки й уривки через Exa; пряме читання через Jina повертає **403** |
| **X / Twitter** | не налаштовано (потрібні cookies) | ✗ **не досліджено** | вхід не налаштовувався за правилами промпту. Напрям X/Twitter **UNVERIFIED / відсутній** |
| npm / bundlephobia | `api.npmjs.org`, `bundlephobia.com` | ✓ (частково) | для scoped-пакетів bundlephobia часто не повертала розмір (позначено «?» / UNVERIFIED) |
| Ціни LLM | OpenRouter `/api/v1/models` | ✓ | groq.com/pricing не рендериться без JS |

## 2. Першоджерела: Telegram

- Bot API changelog: https://core.telegram.org/bots/api-changelog (Bot API 6.4–10.3, до 24.08.2026)
- Telegram Mini Apps: https://core.telegram.org/bots/webapps
- Bot API (`createInvoiceLink.subscription_period`, `refundStarPayment`, `editUserStarSubscription`, `BotSubscriptionUpdated`, `sendMessageDraft`): https://core.telegram.org/bots/api
- Payments for digital goods (Stars): https://core.telegram.org/bots/payments-stars
- Telegram Stars (API): https://core.telegram.org/api/stars
- Mini Apps 2.0 (блог, 17.11.2024): https://telegram.org/blog/fullscreen-miniapps-and-more
- tma.js docs (init data): https://docs.telegram-mini-apps.com/platform/init-data
- Telegram Mini Apps Analytics SDK: https://docs.tganalytics.xyz/

## 3. Першоджерела: банки, дані, ціни

- monobank open API (v250818): https://api.monobank.ua/docs/index.html
- monobank API для провайдерів: https://api.monobank.ua/docs/corporate.html
- OpenRouter models API (ціни на 11.09.2026): https://openrouter.ai/api/v1/models
- YNAB pricing: https://www.ynab.com/pricing
- Monarch pricing (вторинне, перевірено джерелом 25.06.2026): https://www.fincomparelab.com/guides/monarch-money-pricing/ та https://www.monarch.com/pricing
- Copilot Money: https://www.copilot.money/ і https://www.copilot.money/dispatch/beta-introducing-your-money-assistant (16.04.2026)
- Cleo Pro (08.04.2026): https://web.meetcleo.com/faqs/en/articles/11870304-what-is-cleo-pro
- Cleo 3.0: https://web.meetcleo.com/blog/Introducing-cleo-3-0
- MoneyWiz pricing: https://www.wiz.money/pricing
- Wallet Premium: https://support.budgetbakers.com/hc/en-us/articles/7151349344018-Everything-about-Premium
- Revolut analytics: https://help.revolut.com/help/accounts/budget-and-analytics/how-can-i-see-my-spending-and-income-analytics/
- Monzo budgeting: https://monzo.com/help/budgeting-overdrafts-savings
- Rocket Money Rowan: https://fintech.global/2026/09/03/rocket-money-launches-ai-agent-to-manage-finances/ (03.09.2026), https://www.prnewswire.com/news-releases/rocket-moneys-rowan-rewrites-what-ai-can-do-in-personal-finance-302859522.html (25.08.2026)
- Monarch AI Assistant (вторинне, 06.05.2026): https://northvilletech.com/blog/how-to-use-monarch-ai-assistant/

## 4. Інженерні блоги та статті

- Plaid, Universal Transaction Categorization (27.05.2026): https://engineering.plaid.com/universal-transaction-categorization-how-plaid-unified-four-ml-systems-into-one-f08bf1eade54
- Ntropy, Recurrence: https://docs.ntropy.com/enrichment/recurrence.md
- Duolingo streaks teardown (15.05.2026): https://duolingo.deconstructoroffun.com/mechanics/streaks
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- Telegram Stars economics (14.06.2026, оцінки): https://dev.to/starsearn/telegram-stars-economics-for-bot-developers-what-your-stars-are-actually-worth-in-2026-2742
- TMA production lessons (03.03.2026): https://dev.to/haskelldev/5-things-that-surprised-me-building-a-telegram-mini-app-real-production-lessons-4bmk
- Mercado Libre, LLM categorization (ZenML LLMOps DB): https://www.zenml.io/llmops-database/financial-transaction-categorization-at-scale-using-llms-and-custom-embeddings (знайдено, **не прочитано**)

## 5. Community-сигнали

**Hacker News:**
- Show HN: Write It Down (06.10.2025, 271 pts): https://news.ycombinator.com/item?id=45490578
- Show HN: ExpenseOwl (07.02.2025, 227 pts): https://news.ycombinator.com/item?id=42977388
- Show HN: Bagels (26.01.2025, 283 pts): https://news.ycombinator.com/item?id=42828833

**Reddit** (через Exa, уривки):
- r/Telegram, «I regret creating a Telegram mini app» (11.11.2025): https://www.reddit.com/r/Telegram/comments/1ov5q1q/i_regret_creating_a_telegram_mini_app/
- r/SideProject, «150M people use Telegram Mini Apps…» (2026): https://www.reddit.com/r/SideProject/comments/1rxy2zi/150m_people_use_telegram_mini_apps_and_theres_not/
- r/vercel, «Is Vercel AI SDK actually good for building real AI agents?» (01.05.2026): https://www.reddit.com/r/vercel/comments/1t0ntas/is_vercel_ai_sdk_actually_good_for_building_real/
- r/mastraai, «why is it so hard to like Mastra» (29.08.2025): https://www.reddit.com/r/mastraai/comments/1n34fmh/rant_warning_why_is_it_so_hard_to_like_mastra/
- r/copilotmoney, «Copilot vs Monarch» (22.03.2026): https://www.reddit.com/r/copilotmoney/comments/1s10mcg/copilot_vs_monarch/
- r/actualbudgeting та r/selfhosted (Actual vs Firefly vs YNAB, 2024): лише заголовки

**YouTube** (переглянуто лише назви та метадані; змістовної унікальної інформації не знайдено):
- «The Easiest Way to Build a Telegram Mini App & Bot» (216k переглядів): https://www.youtube.com/watch?v=kaK_OsuhrSQ
- «React + Telegram Mini App: Proper Project Structure…» (UA Tech Mentor, 1:10:46): https://www.youtube.com/watch?v=mF1Y9966pvY
- «Building Effective Agents with LangGraph» (LangChain): https://www.youtube.com/watch?v=aHCDrAbH_go

## 6. GitHub

Повний перелік із метриками — у [02_GITHUB_RESEARCH.md](02_GITHUB_RESEARCH.md) і [15_REPOSITORY_SHORTLIST.md](15_REPOSITORY_SHORTLIST.md).

**Прочитані файли (code-level):**
- actualbudget/actual: `packages/loot-core/src/server/schedules/find-schedules.ts`, `packages/loot-core/src/server/budget/goal-template.ts`
- we-promise/sure: `app/models/recurring_transaction/identifier.rb`, `app/models/family/auto_categorizer.rb`, `app/models/assistant/function/update_transaction.rb`
- midday-ai/midday: `apps/api/src/chat/assistant-runtime.ts`, `packages/categories/src/embeddings.ts`, `apps/worker/src/utils/enrichment-schema.ts`
- sakowicz/actual-ai: `src/similarity-calculator.ts`, `src/transaction/category-suggester.ts`, `src/prompt-generator.ts`
- GiGurra/subscription-detector: `internal/detector.go`
- vas3k/TaxHacker: `ai/schema.ts`
- mayswind/ezbookkeeping: `pkg/api/large_language_models.go`

## 7. Продукт «Копійка» (локальний код)

`README.md`, `REPORT.md`, `UI-UX-AUDIT.md`, `design-system/kopiyka-telegram-mini-app/MASTER.md`, `package.json`, `.env.example`, `docker-compose.yml`, `server/{roo,ai,bot-ai,allowance}.js`, `server/db/migrations/001_initial_schema.js`, `server/app.js` (маршрути, заголовки), `web/telegram-adapter.js`, `web/src/app.js` (рядки 1300–1339, 1925–1967, 3368–3387 та grep), історія git (68 комітів, гілка `feat/postgres-storage`).

## 8. Позначки UNVERIFIED (зведення)

| Твердження | Чому не підтверджено |
|---|---|
| Railway працює в UTC для цього сервісу | не бачили конфігурацію Railway |
| Економіка Stars ($1.99 / $0.87–0.92 за 100 ⭐) | стороння оцінка, не офіційні дані Telegram |
| Нативний trial для Stars-підписок | у документації не знайдено |
| Чи зберігає ярлик головного екрана `start_param` | потрібна перевірка на пристрої |
| Поведінка `<a download>` у WebView Telegram | потрібна перевірка на клієнтах |
| Персистентність `DeviceStorage` при очищенні WebView | документація не деталізує |
| Підтримка `json_schema` (strict) для gpt-oss у конкретного шлюзу | залежить від провайдера |
| Політики зберігання даних Groq / OpenRouter | не читали умови |
| Строки й критерії схвалення корпоративного API monobank | не публікуються в документації |
| Підпис webhook monobank | у прочитаних розділах не описаний |
| Розміри `number-flow`, `nanostores`, `@sentry/browser`, `@tma.js/sdk` | bundlephobia не повернула дані |
| Ціни Rocket Money (крім Premium+ $15), Spendee, N26 | ліміт Exa або cookie-wall |
| GlitchTip (метрики) | основний репозиторій на GitLab |
| Ліцензії з NOASSERTION (vercel/ai, mastra, lucide, bugsink, posthog та ін.) | GitHub не визначив автоматично |
| Підтримка Bot API 10.x у grammY | не перевіряли changelog grammY |
| Ліміти розсилки Bot API (~30 msg/s) | не перевіряли актуальність |
| Ціна STT (Whisper) | не перевіряли |
| Будь-які дані з X / Twitter | канал не налаштований |
