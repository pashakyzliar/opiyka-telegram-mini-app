"use strict";

const { appError } = require("./errors");

const MAX_MONEY_CENTS = 9_000_000_000_000_00n;

function decimalToCents(value, fieldName) {
  let raw = value;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) throw appError(400, "invalid_amount", fieldName + " must be a finite amount");
    raw = String(raw);
  }
  if (typeof raw !== "string") raw = String(raw == null ? "" : raw);
  raw = raw.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(raw)) {
    throw appError(400, "invalid_amount", fieldName + " must be a decimal amount with up to 2 fraction digits");
  }
  const match = raw.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  const units = BigInt(match[1]);
  const fraction = BigInt((match[2] || "").padEnd(2, "0"));
  const cents = units * 100n + fraction;
  if (cents > MAX_MONEY_CENTS) {
    throw appError(400, "invalid_amount", fieldName + " is too large");
  }
  return cents;
}

function centsToNumber(cents) {
  return Number(cents) / 100;
}

function centsToNumeric(cents) {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  const units = abs / 100n;
  const fraction = String(abs % 100n).padStart(2, "0");
  return sign + units.toString() + "." + fraction;
}

// All database values are derived from an integer number of kopiykas first.
// This keeps a binary JavaScript number from reaching a NUMERIC column directly.
function amountToNumeric(value, fieldName) {
  return centsToNumeric(decimalToCents(value, fieldName));
}

function money(value, fieldName) {
  return centsToNumber(decimalToCents(value, fieldName));
}

module.exports = {
  decimalToCents,
  centsToNumber,
  centsToNumeric,
  amountToNumeric,
  money
};
