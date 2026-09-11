"use strict";

/**
 * Єдине джерело правди для «сьогодні».
 *
 * Було: бот рахував дату через `new Date()` — тобто за часовим поясом
 * ПРОЦЕСА. На Railway це UTC, тож запис о 00:30 за Києвом отримував учорашню
 * дату, а денний план у відповіді бота рахувався не за той день.
 *
 * Стало: дату визначає часовий пояс КОРИСТУВАЧА (`settings.timezone`, IANA).
 * Якщо поясу ще немає (акаунт не відкривав Mini App після оновлення), працює
 * запасний ланцюжок: зсув у хвилинах (його шле Roo з браузера) → час процесу.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_OFFSET_MINUTES = 14 * 60;

// Назви зон короткі й складаються з обмеженого набору символів. Перевірка
// потрібна до Intl: у вузол приходить рядок від клієнта, і тягнути його
// напряму в конструктор без обмеження довжини не варто.
function normalizeTimeZone(value) {
  const raw = String(value == null ? "" : value).trim();
  if (!raw || raw.length > 64 || !/^[A-Za-z0-9_+\-/]+$/.test(raw)) return "";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: raw });
    return raw;
  } catch (_error) {
    return "";
  }
}

function pad(value) {
  return value < 10 ? "0" + value : String(value);
}

// Дата за часом процесу — поведінка, яка була до появи часових поясів.
function localToday(now) {
  const at = now instanceof Date ? now : new Date();
  return at.getFullYear() + "-" + pad(at.getMonth() + 1) + "-" + pad(at.getDate());
}

function todayInZone(timeZone, offsetMinutes, now) {
  const at = now instanceof Date ? now : new Date();
  const zone = normalizeTimeZone(timeZone);
  if (zone) {
    // en-CA форматує саме як YYYY-MM-DD, тож зайвого розбору не потрібно.
    const formatted = new Intl.DateTimeFormat("en-CA", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(at);
    if (ISO_DATE.test(formatted)) return formatted;
  }
  const raw = Number(offsetMinutes);
  if (Number.isFinite(raw) && Math.abs(raw) <= MAX_OFFSET_MINUTES) {
    return new Date(at.getTime() + raw * 60000).toISOString().slice(0, 10);
  }
  return localToday(at);
}

// Часовий пояс живе в settings.timezone. Ключ невідомий нормалізатору
// налаштувань, тому зберігається в extra_settings — так само, як
// onboardingDone. Окрема колонка для одного рядка не потрібна.
function accountTimeZone(account) {
  return account && account.settings ? normalizeTimeZone(account.settings.timezone) : "";
}

module.exports = {
  ISO_DATE,
  normalizeTimeZone,
  todayInZone,
  localToday,
  accountTimeZone
};
