/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema
    .alterTable("FeedItems", (t) => {
      t.string("thumbnailUrl");
      t.timestamp("thumbnailUpdatedAt");
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema
    .alterTable("FeedItems", (t) => {
      t.dropColumn("thumbnailUrl");
      t.dropColumn("thumbnailUpdatedAt");
    });
};
