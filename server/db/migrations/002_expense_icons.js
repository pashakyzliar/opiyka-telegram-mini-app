"use strict";

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.addColumn("categories", {
    icon: { type: "text", notNull: true, default: "" }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("categories", "icon");
};
