# Копійка у Telegram Mini App

«Копійка» зберігає дані в PostgreSQL. HTTP API зберігає сумісні контракти
`/api/state`, `/api/settings`, `/api/replace-all` і CRUD-маршрути, але більше
не читає та не записує `server/data/users.json` під час роботи застосунку.
JSON залишено лише як джерело одноразової міграції та як локальний fallback
інтерфейсу поза Telegram.

## Локальний запуск

Потрібні Node.js 18+, Docker Compose і Telegram bot token для реальної
авторизації. Скопіюй `.env.example` у `.env`, задай унікальні
`POSTGRES_PASSWORD`, `USER_ID_PEPPER` та `BOT_TOKEN`.

```sh
docker compose up -d postgres
npm install
npm run db:migrate
npm start
```

`ALLOW_DEV_AUTH=1` дозволений тільки поза production і потрібен лише для
локальної ручної перевірки. У production він має лишатися `0`.

Основні команди:

```sh
npm test
npm run db:migrate
npm run db:rollback
npm run db:import-json -- --dry-run
npm run db:import-json
```

Для тестів задай окрему базу в `TEST_DATABASE_URL`; вони не повинні запускатися
проти production-бази.

## Дані та схема

Усі зміни структури проходять через `server/db/migrations`; застосунок не має
DDL у HTTP-маршрутах. `pg` є драйвером PostgreSQL, `node-pg-migrate` -
версійним механізмом міграцій. Репозиторний шар розміщено в
`server/repositories`, а HTTP-обробники - у `server/app.js`.

| Таблиця | Призначення |
| --- | --- |
| `users`, `user_settings` | Псевдонімізований користувач і налаштування |
| `currencies`, `wallets` | Майбутня підтримка валют і кількох гаманців |
| `categories`, `category_budgets` | Категорії та ліміти |
| `transactions`, `recurring_payments` | Операції та регулярні платежі |
| `goals`, `debts`, `amortizations` | Фінансові цілі, борги й амортизація |
| `salary_*`, `weekly_day_plans`, `recurring_skips`, `navar_history` | Плани, винятки та історія «навару» |
| `security_audit_events` | Мінімальні події без сум, нотаток або Telegram ID |

Грошові значення зберігаються як `NUMERIC(18,2)`, дати - як `date`, а часові
позначки - як UTC `timestamptz`. Основні фінансові поля мають власні колонки;
`jsonb` використовується тільки для збереження сумісних невідомих полів старого
клієнта. Зовнішні ключі включають `user_id`, щоб не допустити посилання на
гаманець чи категорію іншого користувача.

Користувацькі дані видаляються каскадно під час видалення акаунта. М'яке
видалення застосовано лише до категорій і гаманців, де воно може знадобитися
після появи UI для архівації. Запит `DELETE /api/account` потребує двох полів
`confirm` і `confirmAgain` зі значенням `DELETE`; клієнт також показує два
підтвердження. Експорт доступний через `GET /api/export`.

## Telegram та ізоляція

Кожен `/api/*` запит перевіряє заголовок `X-Telegram-Init-Data` бібліотекою
`@tma.js/init-data-node`: підпис, строк дії, дублікати параметрів, некоректну
та надто майбутню `auth_date`. Дані `user_id` з body, URL або довільних
заголовків не використовуються для вибору облікового запису.

Telegram ID не записується до бази. Перед доступом він перетворюється на
`HMAC-SHA-256(USER_ID_PEPPER, telegramId)`; у БД зберігається тільки цей ключ.
Не логуються `initData`, токени, суми, нотатки, повні Telegram ID або вміст
backup. Запис виконується в транзакції та серіалізується advisory lock-ом на
користувача. PostgreSQL RLS додає другий бар'єр ізоляції через
`app.current_user_id`.

PIN у клієнті - лише візуальний замок, не шифрування й не серверний фактор
автентифікації. Не використовуйте його як захист даних.

## Перенесення JSON

Перед фактичним імпортом утиліта перевіряє кореневу структуру, нормалізує всі
записи та створює копію джерела поруч із файлом. Вона не видаляє JSON і не
виводить персональні або фінансові значення.

```sh
npm run db:import-json -- --source server/data/users.json --dry-run
npm run db:import-json -- --source server/data/users.json
```

Повторний запуск ідемпотентний: для кожного псевдонімізованого користувача
застосовується атомарний `replace-all`, а після нього звіряються кількості
користувачів, операцій, цілей, регулярних платежів, боргів і амортизацій.
Файли `*.backup-*` і `users.json` навмисно ігноруються Git.

## Production

Використовуйте окремі ролі: міграції виконуються власником схеми, а застосунок
підключається роллю без DDL та без `BYPASSRLS`. Після міграції надайте лише
необхідні права прикладній ролі (назви ролей адаптуйте до свого середовища):

```sql
GRANT CONNECT ON DATABASE kopiyka TO kopiyka_app;
GRANT USAGE ON SCHEMA public TO kopiyka_app;
GRANT SELECT ON currencies TO kopiyka_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON wallets, categories, user_settings,
  weekly_day_plans, salary_schedule_days, salary_payments, category_budgets,
  recurring_skips, navar_history, recurring_payments, transactions, goals,
  debts, amortizations TO kopiyka_app;
GRANT INSERT ON security_audit_events TO kopiyka_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO kopiyka_app;
GRANT EXECUTE ON FUNCTION public.ensure_user_by_telegram_key(text) TO kopiyka_app;
```

Надайте ті самі права через `ALTER DEFAULT PRIVILEGES` для майбутніх міграцій.
`DATABASE_URL` production-ролі має використовувати TLS, наприклад
`DATABASE_SSL_MODE=require`, CA-файл у `DATABASE_SSL_CA_FILE` і увімкнений
`DATABASE_SSL_REJECT_UNAUTHORIZED=1`. Секрети передаються тільки середовищем
або менеджером секретів, не `.env` у Git. Встановіть `CORS_ORIGIN` на точний
HTTPS-домен Mini App, увімкніть HTTPS reverse proxy, обмеження мережі БД та
rate limiting на proxy.

Залишайте AI вимкненим (`AI_BASE_URL=`), якщо його немає у власній ізольованій
інфраструктурі. Не надсилайте фінансові дані або аналітику стороннім сервісам.

## Backup, restore і retention

Бекап робить оператор із production-мережі за TLS та одразу шифрує ключем поза
БД. Приклад із `age`:

```sh
pg_dump "$DATABASE_URL" --format=custom | age -r "$BACKUP_AGE_RECIPIENT" > kopiyka-YYYY-MM-DD.dump.age
age -d -i "$BACKUP_AGE_IDENTITY" kopiyka-YYYY-MM-DD.dump.age | pg_restore --clean --if-exists --dbname "$RESTORE_DATABASE_URL"
```

Перевіряйте відновлення щонайменше щокварталу, зберігайте зашифровані backups
у доступі мінімально необхідних операторів і зафіксуйте власний строк retention.
Рекомендована стартова політика: щоденні backups 35 днів, щомісячні 12 місяців,
після чого криптографічно стирати копії. Видалення акаунта негайно видаляє живі
дані; залишаються лише анонімні мінімальні audit-події на строк, встановлений
внутрішньою політикою (рекомендовано до 90 днів). Backup, створений до
видалення, зникає природно після завершення retention; швидше вибірково
редагувати зашифровані backups небезпечно, тому це має бути пояснено в policy.

## Threat model і межі

Активи: фінансові записи, нотатки, налаштування, ключ псевдонімізації,
Telegram bot token, backups і audit-події. Межі довіри: браузер Mini App,
Telegram `initData`, HTTPS reverse proxy, API-процес, PostgreSQL та backup
сховище.

Захист від основних загроз:

- Підроблена чи прострочена Telegram-сесія: серверна криптографічна валідація,
  expiry і future-skew перевірки.
- Доступ між користувачами: HMAC-псевдонім, серверний user context,
  параметризований SQL, composite FK, транзакції й RLS.
- SQL injection і надвеликі payload: параметри SQL, whitelist collection,
  типова/довжинна валідація та ліміти тіла запиту.
- Втрата даних при одночасних записах: транзакції, FK, rollback і advisory lock.
- Витік через логи чи backup: мінімальні audit-події, заборона чутливих логів,
  TLS та зашифровані backups.

Реалізовані технічні заходи відповідають принципам privacy by design,
мінімізації даних, OWASP ASVS і рекомендаціям OWASP щодо криптографічного
зберігання. Це не є юридичною сертифікацією. Перед production потрібні окремі
юридичний GDPR-аудит (правова підстава, DPA, субпроцесори, DSAR), інфраструктурний
аудит (KMS/секрети, TLS, backup key management, моніторинг, patching) і
penetration test.
