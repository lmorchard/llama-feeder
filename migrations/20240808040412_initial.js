/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const up = (knex) => {
  return knex.schema
    .createTable("Feeds", (t) => {
      commonFields(t);
      t.boolean("disabled");
      t.string("url").index().unique();
      t.string("title");
      t.string("description");
      t.string("link");
      t.string("status");
      t.string("statusText");
      t.string("lastError");
      t.bigInteger("lastValidated");
      t.bigInteger("lastParsed");
    })
    .createTable("FeedItems", (t) => {
      commonFields(t);
      t.string("feedId").references("Feeds.id");
      t.string("guid").index().unique();
      t.string("title");
      t.string("link");
      t.string("author");
      t.string("summary");
      t.string("date");
      t.string("pubdate");
    }).raw(`
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
  return knex.schema
    .dropTable("Feeds")
    .dropTable("FeedItems")
    .dropTable("FeedItemVectors");
};

const commonFields = (t) => {
  t.increments("id").primary();
  t.timestamps(true, true, true);
  t.json("json");
};
