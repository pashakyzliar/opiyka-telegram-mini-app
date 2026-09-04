"use strict";

function appError(status, code, message, extras) {
  return Object.assign(new Error(message), { status, code }, extras || {});
}

function isAppError(error) {
  return !!(error && typeof error === "object" && "status" in error && "code" in error);
}

module.exports = {
  appError,
  isAppError
};
