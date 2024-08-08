/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema.raw(`
      create virtual table FeedItemsVectors using vec0(
        feedItemId integer primary key,
        titleAndSummaryEmbedding float[384]
      );
    `);
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema.dropTable("FeedItemVectors");
};
