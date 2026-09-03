# Копійка у Telegram Mini App

Це перенесення оригінальної «Копійки» з архіву `kopiyka.zip` у Telegram Mini App.
Інтерфейс, категорії, журнал, бюджети, цілі, регулярні платежі, амортизація,
борги, PIN, CSV та JSON backup збережені.

## Що змінилось

- `web/src/app.js` — оригінальна фінансова логіка.
- `web/telegram-adapter.js` — Telegram WebApp lifecycle, тема, safe-area і сумісний storage-адаптер.
- `server/server.js` — API, перевірка підпису Telegram `initData`, ізоляція даних по Telegram user ID і простий JSON storage.
- `server/data/users.json` — створюється автоматично. У production цей файл потрібно зберігати у backup і не комітити у відкритий репозиторій.

У Telegram дані користувача не зберігаються в `localStorage`: Mini App звертається до API з підписаним `initData`. Якщо відкрити `web/index.html` без Telegram і без API, працює локальний fallback.

## Запуск локально

Потрібен Node.js 18 або новіший.

1. Скопіюй `server/.env.example` у `server/.env`.
2. Для браузерного тесту постав `ALLOW_DEV_AUTH=1`.
3. Запусти `npm start` з кореня цього проєкту.
4. Відкрий `http://localhost:3000`.

Без Telegram-авторизації браузер автоматично працює на локальному сховищі. Для перевірки API локально відкрий Mini App через Telegram із HTTPS-домену або задай `KOPIYKA_DEV_USER_ID` у `web/config.js`.

## Підключення бота

1. Створи бота через [@BotFather](https://t.me/BotFather) і візьми token.
2. Розгорни цей проєкт на HTTPS-домені.
3. У `server/.env` задай `BOT_TOKEN` і `PUBLIC_URL`.
4. Перезапусти сервер і надішли боту `/start`.
5. За бажанням задай цей самий URL як Main Mini App у BotFather.

Кнопка `/start` відкриває Mini App, а сервер перевіряє Telegram-підпис перед кожним читанням або записом даних.

## Перенесення старих даних

У старій «Копійці» відкрий «Плани → Налаштування → Зберегти копію». У Telegram Mini App відкрий «Відновити з копії» і вибери JSON-файл. Дані потраплять до Telegram-акаунта, з якого відкрито Mini App.

## Що ще треба для production

Ця версія вже придатна для першого деплою, але перед великою кількістю користувачів варто замінити JSON storage на PostgreSQL/SQLite з резервними копіями й додати HTTPS reverse proxy. AI-кнопка прихована, оскільки для неї потрібен окремий серверний AI-провайдер і ключ.

Деталі Mini Apps та перевірки `initData`: [офіційна документація Telegram](https://core.telegram.org/bots/webapps).
