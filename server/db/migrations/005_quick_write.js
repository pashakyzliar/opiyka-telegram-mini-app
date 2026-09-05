"use strict";

exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS telegram_chat_id bigint NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS quick_token_hash text NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS quick_token_created_at timestamptz NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram_chat_id ON users (telegram_chat_id) WHERE telegram_chat_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_users_quick_token_hash ON users (quick_token_hash) WHERE quick_token_hash IS NOT NULL;
    CREATE TABLE IF NOT EXISTS quick_request_log (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      client_id text NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_quick_request_log_rate ON quick_request_log (user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_quick_request_log_client ON quick_request_log (user_id, client_id, created_at DESC);
    ALTER TABLE quick_request_log ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS quick_request_log_isolation ON quick_request_log;
    CREATE POLICY quick_request_log_isolation ON quick_request_log
      USING (user_id = current_setting('app.current_user_id', true)::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    CREATE OR REPLACE FUNCTION public.find_user_by_quick_token_hash(token_hash text)
    RETURNS TABLE(user_id uuid, telegram_chat_id bigint, stored_hash text)
    LANGUAGE sql SECURITY DEFINER SET search_path = public
    AS $$ SELECT id, telegram_chat_id, quick_token_hash FROM users WHERE quick_token_hash = token_hash $$;
  `);
};
