"use strict";

/**
 * Ліміти AI жили в пам'яті процесу (`Map` у server/ai.js), тож кожен рестарт і
 * кожен деплой обнуляли лічильник: зламаний провайдер на ретраях міг з'їсти
 * квоту, а обмеження «30 на добу» фактично не діяло.
 *
 * Таблиця свідомо мінімальна: лічильник запитів, час останнього (для паузи між
 * запитами) і токени для обліку вартості. Жодних промптів, відповідей чи сум —
 * у цій таблиці не має бути нічого, чого не можна показати в аудиті.
 *
 * Доба рахується в UTC: точка скидання має бути однаковою для всіх, незалежно
 * від часового поясу користувача.
 */

exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS ai_usage (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      day date NOT NULL,
      request_count integer NOT NULL DEFAULT 0,
      tokens_in bigint NOT NULL DEFAULT 0,
      tokens_out bigint NOT NULL DEFAULT 0,
      last_request_at timestamptz NOT NULL DEFAULT now(),
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, day),
      CHECK (request_count >= 0),
      CHECK (tokens_in >= 0),
      CHECK (tokens_out >= 0)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_usage_day ON ai_usage (day DESC);

    DROP TRIGGER IF EXISTS trg_ai_usage_touch_updated_at ON ai_usage;
    CREATE TRIGGER trg_ai_usage_touch_updated_at
      BEFORE UPDATE ON ai_usage
      FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

    ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ai_usage_isolation ON ai_usage;
    CREATE POLICY ai_usage_isolation ON ai_usage
      USING (user_id = current_setting('app.current_user_id', true)::uuid)
      WITH CHECK (user_id = current_setting('app.current_user_id', true)::uuid);
  `);
};

exports.down = (pgm) => {
  pgm.sql("DROP TABLE IF EXISTS ai_usage;");
};
