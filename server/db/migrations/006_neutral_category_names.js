"use strict";

/**
 * Перейменування категорій витрат для НАЯВНИХ акаунтів.
 *
 * Покласти у server/db/migrations/006_neutral_category_names.js
 * і застосувати командою `npm run db:migrate`.
 *
 * Чому це безпечно для історії:
 *   transactions, category_budgets і user_glossary посилаються на
 *   categories.category_id (UUID), а не на назву. Тому перейменування
 *   не рве жодного зв'язку — усі минулі операції лишаються у своїй категорії,
 *   ліміти й вивчені словником слова теж.
 *
 * Що НЕ чіпається:
 *   - категорії, які користувач уже перейменував сам (збігу за name_key немає);
 *   - акаунти, де нова назва вже існує — інакше зламався б UNIQUE
 *     (user_id, kind, name_key);
 *   - категорії доходів, гаманці, будь-які суми.
 *
 * name_key у застосунку рахується як trim + lower (локаль uk-UA), тому тут
 * оновлюються обидва поля разом.
 */

const RENAMES = [
  { fromKey: "машина", toName: "Транспорт" },
  { fromKey: "пайка", toName: "Кафе і ресторани" },
  { fromKey: "хавка", toName: "Доставка їжі" },
  { fromKey: "дурка", toName: "Розваги" },
  { fromKey: "сіги", toName: "Тютюн і алкоголь" },
  { fromKey: "подпіски", toName: "Підписки" }
];

// Усі назви нижче — статичні літерали без апострофів, тож інтерполяція в SQL
// тут безпечна. Якщо колись додасте назву з апострофом — екрануйте її.
function renameSql(fromKey, toName) {
  const toKey = toName.toLowerCase();
  return `
    UPDATE categories AS c
       SET name = '${toName}',
           name_key = '${toKey}',
           updated_at = now()
     WHERE c.kind = 'expense'
       AND c.name_key = '${fromKey}'
       AND NOT EXISTS (
         SELECT 1
           FROM categories AS other
          WHERE other.user_id = c.user_id
            AND other.kind = c.kind
            AND other.name_key = '${toKey}'
       );
  `;
}

exports.up = (pgm) => {
  for (const row of RENAMES) {
    pgm.sql(renameSql(row.fromKey, row.toName));
  }
};

exports.down = (pgm) => {
  for (const row of RENAMES) {
    const currentKey = row.toName.toLowerCase();
    const backName = row.fromKey.charAt(0).toUpperCase() + row.fromKey.slice(1);
    pgm.sql(`
      UPDATE categories AS c
         SET name = '${backName}',
             name_key = '${row.fromKey}',
             updated_at = now()
       WHERE c.kind = 'expense'
         AND c.name_key = '${currentKey}'
         AND NOT EXISTS (
           SELECT 1
             FROM categories AS other
            WHERE other.user_id = c.user_id
              AND other.kind = c.kind
              AND other.name_key = '${row.fromKey}'
         );
    `);
  }
};
