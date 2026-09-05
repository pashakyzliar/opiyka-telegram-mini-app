"use strict";

exports.up = (pgm) => {
  pgm.sql("ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS login_lock_enabled boolean NOT NULL DEFAULT false;");
};
