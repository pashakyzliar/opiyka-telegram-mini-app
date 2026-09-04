"use strict";

const fs = require("node:fs");

function parseEnvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match) return null;
  return {
    key: match[1],
    value: match[2].replace(/^['"]|['"]$/g, "")
  };
}

function loadEnvFiles(files) {
  files.forEach((file) => {
    if (!file || !fs.existsSync(file)) return;
    const text = fs.readFileSync(file, "utf8");
    text.split(/\r?\n/).forEach((line) => {
      if (!line || /^\s*#/.test(line)) return;
      const parsed = parseEnvLine(line);
      if (!parsed || process.env[parsed.key] !== undefined) return;
      process.env[parsed.key] = parsed.value;
    });
  });
}

module.exports = {
  loadEnvFiles
};
