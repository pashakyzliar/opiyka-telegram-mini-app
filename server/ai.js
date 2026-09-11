"use strict";

/**
 * Клієнт до будь-якого OpenAI-сумісного шлюзу (OmniRoute, OpenRouter, Groq,
 * офіційні API). Сервер ніколи не довіряє моделі рахувати гроші — вона лише
 * повертає JSON, а всі суми app.js рахує сам зі своїх же рядків.
 *
 * Змінні оточення:
 *   AI_BASE_URL           https://api.groq.com/openai/v1  (порожня = AI вимкнено)
 *   AI_MODEL              openai/gpt-oss-120b
 *   AI_KEY                Bearer-токен шлюзу
 *   AI_REASONING_EFFORT   low | medium | high | off  (тільки для gpt-oss)
 *   AI_DAILY_LIMIT        запитів на користувача на добу (30)
 *   AI_MIN_GAP_MS         мінімальний проміжок між запитами користувача (3000)
 *   AI_TIMEOUT_MS         таймаут запиту до провайдера (45000)
 *   AI_MAX_TOKENS         стеля відповіді (900)
 */

const AI_BASE_URL = String(process.env.AI_BASE_URL || "").replace(/\/+$/, "");
const AI_MODEL = String(process.env.AI_MODEL || "openai/gpt-oss-120b");
// Тільки для reasoning-моделей (gpt-oss). Для цієї задачі багато думати нема
// над чим, тож "low" — швидше й дешевше. Провайдери, які цього поля не знають,
// його ігнорують, але лишається можливість вимкнути: AI_REASONING_EFFORT=off.
const AI_REASONING_EFFORT = String(process.env.AI_REASONING_EFFORT || "low");
const AI_KEY = String(process.env.AI_KEY || "");
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 30);
const AI_MIN_GAP_MS = Number(process.env.AI_MIN_GAP_MS || 3000);
const AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 45000);
const AI_MAX_TOKENS = Number(process.env.AI_MAX_TOKENS || 900);

const MAX_PROMPT = 4000;

// app.js уже просить JSON у власних промптах, але моделі люблять додати
// пояснення або обгорнути все в потрійні лапки. Це прибирає спокусу.
//
// Блок про рітейл свідомо НЕ називає конкретних категорій «Копійки» — він
// пояснює лише призначення мереж, а розкласти це на категорії модель має за
// тим списком, який їй дає app.js. Тому міняти категорії в app.js можна, не
// чіпаючи цей файл.
const SYSTEM_PROMPT = [
  "Ти повертаєш ВИКЛЮЧНО валідний JSON: без пояснень, без коментарів,",
  "без markdown-огорожі, без тексту до або після JSON.",
  "Якщо запит незрозумілий — поверни порожній масив [].",
  "",
  "Якщо в запиті йдеться про розбір витрат, тримай два правила.",
  "",
  "1. Поле note заповнюй завжди — коротка назва того, що куплено, словами",
  "   самого користувача. Порожнім лишай тільки тоді, коли в тексті немає",
  "   нічого, крім суми.",
  "",
  "2. Українські мережі та сервіси розпізнавай за призначенням:",
  "   • заправки: WOG, ОККО, OKKO, SOCAR, Укрнафта, Shell, БРСМ, AMIC, Авіас",
  "   • продуктові: АТБ, Сільпо, Новус, Varus, Варус, Фора, Ашан, Метро, Космос",
  "   • їжа та доставка: Glovo, Глово, Bolt Food, Rocket, Ракета, McDonalds,",
  "     Мак, KFC, Пузата хата, Львівські круасани, Аромакава",
  "   • аптеки: Аптека АНЦ, Подорожник, Бажаємо здоровя",
  "   • підписки та звязок: Netflix, Spotify, YouTube, Megogo, Київстар,",
  "     Vodafone, lifecell, ChatGPT, iCloud",
  "   • маркетплейси: Rozetka, Розетка, Prom, OLX, Нова пошта",
  "   Далі поклади це на ті категорії, які перелічені в запиті користувача,",
  "   і бери назву категорії строго з його списку.",
  "",
  "3. Текст може бути надиктований голосом, а не набраний. Тоді в ньому",
  "   трапляється таке, і це не помилка запиту:",
  "   • числа словами: «сорок п'ять», «дві сотні», «півтори тисячі» —",
  "     переводь у число (45, 200, 1500);",
  "   • слова-паразити на початку: «записуй», «запиши», «додай», «витратив»,",
  "     «я витратив», «купив» — це не частина назви покупки, у note не клади;",
  "   • одиниці й валюта словами: «гривень», «грн», «гривні», «копійок» —",
  "     у суму не потрапляють;",
  "   • розділові знаки й велика літера від диктування — ігноруй їх;",
  "   • «п'ятдесят на каву» означає суму 50 і note «кава»."
].join("\n");

function configured() {
  return Boolean(AI_BASE_URL);
}

function fail(code, message) {
  return Object.assign(new Error(message), { code: code });
}

/* ------------------------------ ліміти ------------------------------ */

// Самі ліміти рахує server/ai-usage.js у PostgreSQL. Тут лишаються тільки
// значення: лічильник у пам'яті процесу обнулявся при кожному рестарті, тож
// обмеження фактично не діяло.
const LIMITS = {
  daily: AI_DAILY_LIMIT,
  minGapMs: AI_MIN_GAP_MS
};

/* --------------------------- розбір відповіді --------------------------- */

/**
 * Дістає перший цілий JSON-об'єкт або масив із тексту моделі.
 * Рядки й екрановані лапки враховуються, тому дужка всередині "..." не збиває лічильник.
 */
function extractJson(text) {
  const raw = String(text == null ? "" : text).trim();
  if (!raw) return undefined;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = (fenced ? fenced[1] : raw).trim();

  try { return JSON.parse(body); } catch (e) { /* пробуємо вирізати */ }

  const start = body.search(/[[{]/);
  if (start < 0) return undefined;

  const open = body[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < body.length; i++) {
    const ch = body[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') { inString = true; continue; }
    if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) {
        try { return JSON.parse(body.slice(start, i + 1)); }
        catch (e) { return undefined; }
      }
    }
  }
  return undefined;
}

/* ------------------------------ виклик ------------------------------ */

async function askJson(prompt) {
  if (!configured()) throw fail("not_granted", "AI не налаштовано на сервері.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const headers = { "Content-Type": "application/json" };
  if (AI_KEY) headers.Authorization = "Bearer " + AI_KEY;

  const requestBody = {
    model: AI_MODEL,
    stream: false,
    temperature: 0,
    response_format: { type: "json_object" },
    max_tokens: AI_MAX_TOKENS,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: String(prompt).slice(0, MAX_PROMPT) }
    ]
  };
  if (AI_REASONING_EFFORT && AI_REASONING_EFFORT !== "off") {
    requestBody.reasoning_effort = AI_REASONING_EFFORT;
  }

  let response;
  let text;
  try {
    response = await fetch(AI_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: headers,
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });
    text = await response.text();
  } catch (error) {
    if (error.name === "AbortError") throw fail("timeout", "Провайдер не відповів вчасно.");
    throw fail("provider_unreachable", "Не вдалось достукатись до провайдера: " + error.message);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 429) throw fail("rate_limited", "Провайдер обмежив запити.");
    if (response.status === 401 || response.status === 403) {
      throw fail("not_granted", "Провайдер відхилив авторизацію.");
    }
    throw fail("provider_error", "Провайдер відповів " + response.status + ".");
  }

  let payload;
  try { payload = JSON.parse(text); }
  catch (e) { throw fail("bad_response", "Відповідь провайдера не є JSON."); }

  const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const content = choice && choice.message ? choice.message.content : null;
  const parsed = extractJson(content);
  if (parsed === undefined) throw fail("bad_response", "Модель не повернула JSON.");

  return { result: parsed, usage: payload.usage || null, model: payload.model || AI_MODEL };
}

/* --------------------------- виклик з інструментами --------------------------- */

/**
 * Той самий шлюз, але з нативним tool-calling: модель формулює намір, а що
 * саме виконати — вирішує сервер. Ніяких «розберіть цей JSON руками»:
 * параметри приходять за оголошеною схемою й далі перевіряються ще раз.
 *
 * messages — уже зібрана історія (system + user + tool-відповіді).
 * tools — масив описів у форматі OpenAI.
 */
async function chatWithTools(messages, tools, options) {
  if (!configured()) throw fail("not_granted", "AI не налаштовано на сервері.");
  const opts = options || {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  const headers = { "Content-Type": "application/json" };
  if (AI_KEY) headers.Authorization = "Bearer " + AI_KEY;

  const requestBody = {
    model: AI_MODEL,
    stream: false,
    temperature: 0,
    max_tokens: opts.maxTokens || AI_MAX_TOKENS,
    messages: messages
  };
  if (tools && tools.length) {
    requestBody.tools = tools;
    requestBody.tool_choice = opts.toolChoice || "auto";
  }
  if (AI_REASONING_EFFORT && AI_REASONING_EFFORT !== "off") {
    requestBody.reasoning_effort = AI_REASONING_EFFORT;
  }

  let response;
  let text;
  try {
    response = await fetch(AI_BASE_URL + "/chat/completions", {
      method: "POST",
      headers: headers,
      signal: controller.signal,
      body: JSON.stringify(requestBody)
    });
    text = await response.text();
  } catch (error) {
    if (error.name === "AbortError") throw fail("timeout", "Провайдер не відповів вчасно.");
    throw fail("provider_unreachable", "Не вдалось достукатись до провайдера: " + error.message);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    if (response.status === 429) throw fail("rate_limited", "Провайдер обмежив запити.");
    if (response.status === 401 || response.status === 403) throw fail("not_granted", "Провайдер відхилив авторизацію.");
    // Модель без підтримки tools відповідає 400 саме на це поле. Кажемо
    // прямо, що робити, замість глухого «провайдер відповів 400».
    if (response.status === 400 && /tool|function/i.test(text || "")) {
      throw fail("tools_unsupported", "Обрана модель не підтримує виклик інструментів. Змініть AI_MODEL.");
    }
    throw fail("provider_error", "Провайдер відповів " + response.status + ".");
  }

  let payload;
  try { payload = JSON.parse(text); }
  catch (e) { throw fail("bad_response", "Відповідь провайдера не є JSON."); }

  const choice = payload && Array.isArray(payload.choices) ? payload.choices[0] : null;
  const message = (choice && choice.message) || {};
  return {
    message: message,
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    content: typeof message.content === "string" ? message.content : "",
    usage: payload.usage || null,
    model: payload.model || AI_MODEL
  };
}

module.exports = { configured, LIMITS, askJson, chatWithTools, extractJson, AI_MODEL };
