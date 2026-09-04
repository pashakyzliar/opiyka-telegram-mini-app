"use strict";

const { startServer } = require("./app");

startServer().catch((error) => {
  console.error("Server bootstrap failed:", error && error.message);
  process.exitCode = 1;
});
