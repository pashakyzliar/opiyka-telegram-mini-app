"use strict";

function pad(n) {
  return n < 10 ? "0" + n : String(n);
}

function isoAdd(iso, days) {
  const parts = String(iso || "").split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + days);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1) + "-" + pad(date.getDate());
}

function monthKey(dateStr) {
  return String(dateStr || "").slice(0, 7);
}

function addMonths(key, delta) {
  const parts = String(key || "").split("-");
  const date = new Date(Number(parts[0]), Number(parts[1]) - 1 + delta, 1);
  return date.getFullYear() + "-" + pad(date.getMonth() + 1);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function weekdayIndex(iso) {
  const date = new Date(String(iso || "") + "T00:00:00");
  return (date.getDay() + 6) % 7;
}

function monthStart(mk) {
  return mk + "-01";
}

function dayDiff(a, b) {
  const pa = String(a || "").split("-");
  const pb = String(b || "").split("-");
  const da = Date.UTC(Number(pa[0]), Number(pa[1]) - 1, Number(pa[2]));
  const db = Date.UTC(Number(pb[0]), Number(pb[1]) - 1, Number(pb[2]));
  return Math.round((db - da) / 86400000);
}

function sameOrAfter(a, b) {
  return dayDiff(b, a) >= 0;
}

function sameOrBefore(a, b) {
  return dayDiff(a, b) >= 0;
}

function inRange(iso, from, to) {
  return sameOrAfter(iso, from) && sameOrBefore(iso, to);
}

function normalizeWeekDaily(list) {
  const out = [0, 0, 0, 0, 0, 0, 0];
  if (!Array.isArray(list)) return out;
  for (let i = 0; i < 7; i++) out[i] = Math.max(0, round2(list[i]));
  return out;
}

function weekStart(iso) {
  return isoAdd(iso, -weekdayIndex(iso));
}

function weekEnd(iso) {
  return isoAdd(iso, 6 - weekdayIndex(iso));
}

function sumWeekDaily(list) {
  return normalizeWeekDaily(list).reduce((sum, value) => sum + value, 0);
}

function accountSettings(account) {
  return account && account.settings && typeof account.settings === "object" ? account.settings : {};
}

function plannedForDay(account, iso) {
  return normalizeWeekDaily(accountSettings(account).weekDaily)[weekdayIndex(iso)] || 0;
}

function isExpense(row) {
  return !!row && row.type === "expense";
}

function dayAllowance(account, today) {
  const currentMk = monthKey(today);
  const currentMonthEnd = isoAdd(monthStart(addMonths(currentMk, 1)), -1);
  const settings = accountSettings(account);
  const enabled = !!settings.allowanceEnabled;
  const hasPlan = (Number(settings.weekBudget) || 0) > 0 || (Number(settings.weekReserve) || 0) > 0 || sumWeekDaily(settings.weekDaily) > 0;
  let spentToday = 0;
  let spentBeforeToday = 0;
  let monthSpent = 0;
  let weekSpent = 0;
  let reserveSpent = 0;
  const reserveFrom = weekStart(today);
  const reserveTo = weekEnd(today);
  const reserveStart = reserveFrom < monthStart(currentMk) ? monthStart(currentMk) : reserveFrom;
  const transactions = Array.isArray(account && account.transactions) ? account.transactions : [];

  transactions.forEach((row) => {
    if (!isExpense(row) || row.pending) return;
    if (monthKey(row.date) === currentMk) monthSpent += Number(row.amount) || 0;
    if (inRange(row.date, reserveFrom, reserveTo) && !row.reserve) weekSpent += Number(row.amount) || 0;
    if (monthKey(row.date) !== currentMk) return;
    if (row.reserve) {
      if (inRange(row.date, reserveStart, reserveTo)) reserveSpent += Number(row.amount) || 0;
      return;
    }
    if (row.date < today) spentBeforeToday += Number(row.amount) || 0;
    else if (row.date === today) spentToday += Number(row.amount) || 0;
  });

  let planThroughToday = 0;
  for (let date = monthStart(currentMk); date <= today; date = isoAdd(date, 1)) {
    planThroughToday += plannedForDay(account, date);
  }
  const todayLimit = round2(planThroughToday - spentBeforeToday);
  const todayAvailable = round2(todayLimit - spentToday);

  let weekPlanThroughToday = 0;
  for (let date = reserveFrom; date <= today; date = isoAdd(date, 1)) {
    weekPlanThroughToday += plannedForDay(account, date);
  }

  let monthPlan = 0;
  for (let date = monthStart(currentMk); date <= currentMonthEnd; date = isoAdd(date, 1)) {
    monthPlan += plannedForDay(account, date);
  }

  const tomorrow = isoAdd(today, 1);
  const tomorrowAvailable = monthKey(tomorrow) === currentMk ? round2(todayAvailable + plannedForDay(account, tomorrow)) : null;

  return {
    enabled,
    configured: enabled && hasPlan,
    todayLimit,
    spentToday: round2(spentToday),
    todayAvailable,
    overBy: Math.max(0, round2(-todayAvailable)),
    weekAvailable: round2(weekPlanThroughToday - weekSpent),
    weekPlanThroughToday: round2(weekPlanThroughToday),
    monthAvailable: round2(monthPlan - monthSpent),
    monthSpent: round2(monthSpent),
    monthPlan: round2(monthPlan),
    tomorrowAvailable,
    reserveSpent: round2(reserveSpent),
    reserveLeft: round2((Number(settings.weekReserve) || 0) - reserveSpent),
    weekPlan: round2(sumWeekDaily(settings.weekDaily)),
    weekBudget: round2(settings.weekBudget),
    weekReserve: round2(settings.weekReserve)
  };
}

module.exports = {
  dayAllowance,
  plannedForDay,
  normalizeWeekDaily,
  weekdayIndex,
  monthStart,
  monthKey,
  isoAdd,
  round2,
  isExpense
};
