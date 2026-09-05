"use strict";

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS user_glossary (
      id bigserial PRIMARY KEY,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      word text NOT NULL,
      word_raw text NOT NULL,
      category_id uuid NOT NULL,
      source text NOT NULL DEFAULT 'manual',
      hits integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, word),
      FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id) ON DELETE CASCADE,
      CHECK (source IN ('manual', 'learned')),
      CHECK (hits >= 0)
    );
    CREATE INDEX IF NOT EXISTS idx_glossary_lookup ON user_glossary (user_id, word);
    ALTER TABLE user_glossary ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS user_glossary_isolation ON user_glossary;
    CREATE POLICY user_glossary_isolation ON user_glossary
      USING (user_id = current_setting('app.current_user_id', true)::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
    DROP TRIGGER IF EXISTS trg_user_glossary_touch_updated_at ON user_glossary;
    CREATE TRIGGER trg_user_glossary_touch_updated_at BEFORE UPDATE ON user_glossary
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
  `);
};
