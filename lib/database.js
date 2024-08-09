import path from "path";
import SqliteDatabase from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
import Knex from "knex";
import { mkdirp } from "mkdirp";

import { Config } from "./config.js";
import { Logger } from "./logger.js";

export class Database {
  constructor(
    dataPath = Config.get("dataPath"),
    databaseFilename = Config.get("databaseFilename")
  ) {
    this.log = Logger.child({ name: "database" });

    mkdirp.sync(dataPath);
    this.log.trace({ msg: "mkdirp", dataPath });

    const databasePath = path.join(dataPath, databaseFilename);
    this.log.trace({ msg: "database", databasePath });

    const connection = new SqliteDatabase(databasePath); //(":memory:");
    sqliteVec.load(connection);
    this.connection = connection;

    const knexLog = this.log.child({ module: "knex" });
    this.knex = Knex({
      client: "better-sqlite3",
      useNullAsDefault: true,
      connection: {
        filename: databasePath,
      },
      log: {
        warn(message) {
          knexLog.warn(message);
        },
        error(message) {
          knexLog.error(message);
        },
        deprecate(message) {
          knexLog.warn(message);
        },
        debug(message) {
          knexLog.debug(message);
        },
      },
      pool: {
        afterCreate: (conn, done) => {
          sqliteVec.load(conn);
          done();
        },
      },
    });
  }

  async close() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.knex) {
      this.knex.destroy();
      this.knex = null;
    }
  }

  _parseRowMetadata(row) {
    const { metadata: metadataRaw } = row;
    let metadata = {};
    if (metadataRaw) {
      try {
        metadata = JSON.parse(metadataRaw);
      } catch (err) {
        metadata = {};
      }
    }
    return { ...row, metadata };
  }

  async upsertFeed(feed) {
    return this.knex("Feeds").insert(feed).onConflict(["url"]).merge();
  }

  async listFeeds() {
    const rows = await this.knex("Feeds").select();
    return rows.map((row) => this._parseRowMetadata(row));
  }

  async listRecentlyUpdatedFeeds({ limit = 10, maxage = 1000 * 60 * 60 * 24 }) {
    const since = Date.now() - maxage;
    const rows = await this.knex("Feeds")
      .select()
      //.where("newestItemDate", ">", since)
      .orderBy("newestItemDate", "desc")
      .limit(limit);
    return rows.map((row) => this._parseRowMetadata(row));
  }

  async fetchFeedById(id) {
    const row = await this.knex("Feeds").select().where("id", id).first();
    return this._parseRowMetadata(row);
  }

  async fetchFeedItemsByFeed({
    feedId,
    limit = 10,
    maxage = 1000 * 60 * 60 * 24,
  }) {
    this.log.debug({ msg: "fetchFeedItemsByFeed", feedId, limit, maxage });
    const since = Date.now() - maxage;
    const rows = await this.knex("FeedItems")
      .select()
      .where("feedId", feedId)
      .where("date", ">", since)
      .orderBy("date", "desc")
      .limit(limit);
    return rows.map((row) => this._parseRowMetadata(row));
  }

  async fetchFeedItemsByIds(ids) {
    return await this.knex("FeedItems").select().whereIn("id", ids);
  }

  async fetchFeedItemGuids(feedId) {
    const rows = await this.knex("FeedItems")
      .select("guid")
      .where("feedId", feedId);
    return rows.map((row) => row.guid);
  }

  async upsertFeedItem(feedItem) {
    return this.knex("FeedItems").insert(feedItem).onConflict(["guid"]).merge();
  }

  async listFeedItemIdsWithoutEmbeddings() {
    // TODO: this seems like an awful and naive query
    const rows = await this.knex.raw(`
      SELECT id FROM FeedItems
      WHERE id NOT IN
        (SELECT feedItemId FROM FeedItemsVectors);
    `);
    return rows.map((row) => row.id);
  }

  async fetchFeedItems(ids) {
    return await this.knex("FeedItems").select().whereIn("id", ids);
  }

  async insertFeedItemEmbeddings(items) {
    this.log.trace({
      msg: "insertFeedItemEmbeddings",
      items: items.length,
    });

    // https://github.com/asg017/sqlite-vec/blob/main/examples/simple-node/demo.mjs
    const db = this.connection;
    const insertStmt = db.prepare(`
      INSERT INTO FeedItemsVectors
      (feedItemId, embedding)
      VALUES
      (?, ?)
    `);
    const insertVectors = db.transaction((items) => {
      for (const [id, vector] of items) {
        insertStmt.run(BigInt(id), new Float32Array(vector));
      }
    });
    insertVectors(items);
  }

  async findFeedItemIdsByEmbedding({
    embedding,
    limit = 10,
    maxage = 1000 * 60 * 60 * 24,
  }) {
    this.log.trace({ msg: "findFeedItemIdsByEmbedding" });

    const since = Date.now() - maxage;

    const db = this.connection;
    const insertStmt = db.prepare(`
      SELECT feedItemId
      FROM FeedItemsVectors
      WHERE
        feedItemId IN (
          SELECT id
          FROM FeedItems
          WHERE date > ?
        )
        AND embedding MATCH ?
      ORDER BY distance ASC
      LIMIT ?
    `);
    const rows = insertStmt.all(since, new Float32Array(embedding), limit);
    return rows.map((row) => row.feedItemId);
  }
}
