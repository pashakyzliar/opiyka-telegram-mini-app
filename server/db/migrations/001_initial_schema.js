"use strict";

exports.up = (pgm) => {
  pgm.sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kopiyka_transaction_type') THEN
        CREATE TYPE kopiyka_transaction_type AS ENUM ('expense', 'income', 'transfer');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kopiyka_category_kind') THEN
        CREATE TYPE kopiyka_category_kind AS ENUM ('expense', 'income');
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'kopiyka_debt_direction') THEN
        CREATE TYPE kopiyka_debt_direction AS ENUM ('lent', 'borrowed');
      END IF;
    END $$;

    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      telegram_user_key text NOT NULL UNIQUE,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (char_length(telegram_user_key) = 64)
    );

    CREATE TABLE IF NOT EXISTS currencies (
      code text PRIMARY KEY,
      numeric_scale smallint NOT NULL DEFAULT 2,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (code ~ '^[A-Z]{3}$'),
      CHECK (numeric_scale BETWEEN 0 AND 6)
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name text NOT NULL,
      name_key text NOT NULL,
      currency_code text NOT NULL REFERENCES currencies(code),
      sort_order integer NOT NULL DEFAULT 0,
      is_default boolean NOT NULL DEFAULT false,
      archived_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, name_key)
    );

    ALTER TABLE wallets DROP CONSTRAINT IF EXISTS wallets_user_id_id_key;
    ALTER TABLE wallets ADD CONSTRAINT wallets_user_id_id_key UNIQUE (user_id, id);

    CREATE TABLE IF NOT EXISTS categories (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind kopiyka_category_kind NOT NULL,
      name text NOT NULL,
      name_key text NOT NULL,
      color text NULL,
      sort_order integer NOT NULL DEFAULT 0,
      archived_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (user_id, kind, name_key),
      CHECK (color IS NULL OR color ~ '^#[0-9a-f]{6}$')
    );

    ALTER TABLE categories DROP CONSTRAINT IF EXISTS categories_user_id_id_key;
    ALTER TABLE categories ADD CONSTRAINT categories_user_id_id_key UNIQUE (user_id, id);

    CREATE TABLE IF NOT EXISTS user_settings (
      user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      salary_amount numeric(18, 2) NOT NULL DEFAULT 0,
      salary_plan_enabled boolean NOT NULL DEFAULT false,
      allowance_enabled boolean NOT NULL DEFAULT false,
      week_budget numeric(18, 2) NOT NULL DEFAULT 0,
      week_reserve numeric(18, 2) NOT NULL DEFAULT 0,
      calm_mode boolean NOT NULL DEFAULT false,
      pin_hash text NOT NULL DEFAULT '',
      last_backup_at timestamptz NULL,
      streak_record integer NOT NULL DEFAULT 0,
      extra_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      CHECK (salary_amount >= 0),
      CHECK (week_budget >= 0),
      CHECK (week_reserve >= 0),
      CHECK (streak_record >= 0)
    );

    CREATE TABLE IF NOT EXISTS weekly_day_plans (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      weekday smallint NOT NULL,
      amount numeric(18, 2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, weekday),
      CHECK (weekday BETWEEN 0 AND 6),
      CHECK (amount >= 0)
    );

    CREATE TABLE IF NOT EXISTS salary_schedule_days (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      position smallint NOT NULL,
      day_of_month smallint NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, position),
      CHECK (position BETWEEN 0 AND 5),
      CHECK (day_of_month BETWEEN 1 AND 31)
    );

    CREATE TABLE IF NOT EXISTS salary_payments (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      payment_date date NOT NULL,
      expected_amount numeric(18, 2) NOT NULL DEFAULT 0,
      actual_amount numeric(18, 2) NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, payment_date),
      CHECK (expected_amount >= 0),
      CHECK (actual_amount >= 0)
    );

    CREATE TABLE IF NOT EXISTS category_budgets (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category_id uuid NOT NULL,
      amount numeric(18, 2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, category_id),
      CHECK (amount >= 0),
      FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS recurring_skips (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rec_key text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, rec_key)
    );

    CREATE TABLE IF NOT EXISTS navar_history (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      month_start date NOT NULL,
      amount numeric(18, 2) NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      UNIQUE (user_id, month_start),
      CHECK (amount >= 0),
      CHECK (date_part('day', month_start) = 1)
    );

    CREATE TABLE IF NOT EXISTS recurring_payments (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      name text NOT NULL,
      amount numeric(18, 2) NOT NULL,
      category_id uuid NOT NULL,
      wallet_id uuid NOT NULL,
      day_of_month smallint NOT NULL,
      active boolean NOT NULL DEFAULT true,
      start_from date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      CHECK (amount >= 0),
      CHECK (day_of_month BETWEEN 1 AND 31),
      FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id),
      FOREIGN KEY (user_id, wallet_id) REFERENCES wallets(user_id, id)
    );

    CREATE TABLE IF NOT EXISTS transactions (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      type kopiyka_transaction_type NOT NULL,
      category_id uuid NULL,
      wallet_id uuid NOT NULL,
      to_wallet_id uuid NULL,
      amount numeric(18, 2) NOT NULL,
      tx_date date NOT NULL,
      note text NOT NULL DEFAULT '',
      reserve boolean NOT NULL DEFAULT false,
      rec_key text NULL,
      recurring_payment_record_id text NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      UNIQUE (user_id, rec_key),
      CONSTRAINT fk_transactions_recurring FOREIGN KEY (user_id, recurring_payment_record_id)
        REFERENCES recurring_payments(user_id, record_id)
        ON DELETE SET NULL,
      FOREIGN KEY (user_id, category_id) REFERENCES categories(user_id, id),
      FOREIGN KEY (user_id, wallet_id) REFERENCES wallets(user_id, id),
      FOREIGN KEY (user_id, to_wallet_id) REFERENCES wallets(user_id, id),
      CHECK (amount >= 0),
      CHECK (char_length(note) <= 120)
    );

    CREATE TABLE IF NOT EXISTS goals (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      name text NOT NULL,
      target_amount numeric(18, 2) NOT NULL,
      current_amount numeric(18, 2) NOT NULL DEFAULT 0,
      deadline date NULL,
      closed_at date NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      CHECK (target_amount >= 0),
      CHECK (current_amount >= 0)
    );

    CREATE TABLE IF NOT EXISTS debts (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      direction kopiyka_debt_direction NOT NULL,
      person text NOT NULL,
      amount numeric(18, 2) NOT NULL,
      due_date date NULL,
      settled boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      CHECK (amount >= 0)
    );

    CREATE TABLE IF NOT EXISTS amortizations (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      record_id text NOT NULL,
      name text NOT NULL,
      amount numeric(18, 2) NOT NULL,
      months integer NOT NULL,
      start_date date NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      extra_data jsonb NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY (user_id, record_id),
      CHECK (amount >= 0),
      CHECK (months >= 1)
    );

    CREATE TABLE IF NOT EXISTS security_audit_events (
      id bigserial PRIMARY KEY,
      user_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
      event_type text NOT NULL,
      request_id text NULL,
      details jsonb NOT NULL DEFAULT '{}'::jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_wallets_user_sort ON wallets(user_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_categories_user_kind_sort ON categories(user_id, kind, sort_order);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, tx_date DESC, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_type_date ON transactions(user_id, type, tx_date DESC);
    CREATE INDEX IF NOT EXISTS idx_goals_user_closed ON goals(user_id, closed_at);
    CREATE INDEX IF NOT EXISTS idx_recurring_user_active ON recurring_payments(user_id, active, day_of_month);
    CREATE INDEX IF NOT EXISTS idx_debts_user_settled ON debts(user_id, settled, due_date);
    CREATE INDEX IF NOT EXISTS idx_navar_user_month ON navar_history(user_id, month_start DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_user_type ON security_audit_events(user_id, event_type, created_at DESC);

    INSERT INTO currencies (code, numeric_scale)
    VALUES ('UAH', 2)
    ON CONFLICT (code) DO NOTHING;

    CREATE OR REPLACE FUNCTION public.touch_updated_at()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION public.ensure_user_by_telegram_key(p_telegram_user_key text)
    RETURNS uuid
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public, pg_temp
    AS $$
    DECLARE
      v_user_id uuid;
    BEGIN
      IF p_telegram_user_key !~ '^[0-9a-f]{64}$' THEN
        RAISE EXCEPTION 'Invalid user key' USING ERRCODE = '22023';
      END IF;
      INSERT INTO users (telegram_user_key)
      VALUES (p_telegram_user_key)
      ON CONFLICT (telegram_user_key)
      DO UPDATE SET updated_at = now()
      RETURNING id INTO v_user_id;
      RETURN v_user_id;
    END;
    $$;

    REVOKE ALL ON FUNCTION public.ensure_user_by_telegram_key(text) FROM PUBLIC;

    DO $$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'users',
        'currencies',
        'wallets',
        'categories',
        'user_settings',
        'weekly_day_plans',
        'salary_schedule_days',
        'salary_payments',
        'category_budgets',
        'recurring_skips',
        'navar_history',
        'recurring_payments',
        'transactions',
        'goals',
        'debts',
        'amortizations'
      ]
      LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_touch_updated_at ON %I', table_name, table_name);
        EXECUTE format(
          'CREATE TRIGGER trg_%I_touch_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at()',
          table_name,
          table_name
        );
      END LOOP;
    END $$;

    ALTER TABLE users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
    ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
    ALTER TABLE weekly_day_plans ENABLE ROW LEVEL SECURITY;
    ALTER TABLE salary_schedule_days ENABLE ROW LEVEL SECURITY;
    ALTER TABLE salary_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE category_budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE recurring_skips ENABLE ROW LEVEL SECURITY;
    ALTER TABLE navar_history ENABLE ROW LEVEL SECURITY;
    ALTER TABLE recurring_payments ENABLE ROW LEVEL SECURITY;
    ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
    ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
    ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
    ALTER TABLE amortizations ENABLE ROW LEVEL SECURITY;
    ALTER TABLE security_audit_events ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS users_isolation ON users;
    CREATE POLICY users_isolation ON users
      USING (id = current_setting('app.current_user_id', true)::uuid)
      WITH CHECK (id = current_setting('app.current_user_id', true)::uuid);

    DO $$
    DECLARE
      table_name text;
    BEGIN
      FOREACH table_name IN ARRAY ARRAY[
        'wallets',
        'categories',
        'user_settings',
        'weekly_day_plans',
        'salary_schedule_days',
        'salary_payments',
        'category_budgets',
        'recurring_skips',
        'navar_history',
        'recurring_payments',
        'transactions',
        'goals',
        'debts',
        'amortizations',
        'security_audit_events'
      ]
      LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I_isolation ON %I', table_name, table_name);
        EXECUTE format(
          'CREATE POLICY %I_isolation ON %I USING (user_id = current_setting(''app.current_user_id'', true)::uuid) WITH CHECK (user_id = current_setting(''app.current_user_id'', true)::uuid)',
          table_name,
          table_name
        );
      END LOOP;
    END $$;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP TABLE IF EXISTS security_audit_events;
    DROP TABLE IF EXISTS amortizations;
    DROP TABLE IF EXISTS debts;
    DROP TABLE IF EXISTS goals;
    DROP TABLE IF EXISTS transactions;
    DROP TABLE IF EXISTS recurring_payments;
    DROP TABLE IF EXISTS navar_history;
    DROP TABLE IF EXISTS recurring_skips;
    DROP TABLE IF EXISTS category_budgets;
    DROP TABLE IF EXISTS salary_payments;
    DROP TABLE IF EXISTS salary_schedule_days;
    DROP TABLE IF EXISTS weekly_day_plans;
    DROP TABLE IF EXISTS user_settings;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS wallets;
    DROP TABLE IF EXISTS currencies;
    DROP TABLE IF EXISTS users;
    DROP FUNCTION IF EXISTS public.ensure_user_by_telegram_key(text);
    DROP FUNCTION IF EXISTS public.touch_updated_at();
    DROP TYPE IF EXISTS kopiyka_debt_direction;
    DROP TYPE IF EXISTS kopiyka_category_kind;
    DROP TYPE IF EXISTS kopiyka_transaction_type;
  `);
};
