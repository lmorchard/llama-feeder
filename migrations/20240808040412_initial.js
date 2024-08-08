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
      t.timestamp("newestItemDate");
    })
    .createTable("FeedItems", (t) => {
      commonFields(t);
      t.string("feedId").references("Feeds.id");
      t.string("guid").index().unique();
      t.string("date");
      t.string("title");
      t.string("link");
      t.string("author");
      t.string("content");
      t.timestamp("lastSeenAt");
      t.timestamp("firstSeenAt");
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
export const down = (knex) => {
  return knex.schema
    .dropTable("Feeds")
    .dropTable("FeedItems");
};

const commonFields = (t) => {
  t.increments("id").primary();
  t.timestamps(true, true, true);
  t.json("metadata");
};
