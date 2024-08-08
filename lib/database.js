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
    this.log = Logger.child({ module: "database" });

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
      /*
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
      */
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

  async upsertFeed(feed) {
    return this.knex("Feeds").insert(feed).onConflict(["url"]).merge();
  }

  async listFeeds() {
    const rows = await this.knex("Feeds").select();
    return rows.map((row) => this._mapRowToFeed(row));
  }

  _mapRowToFeed(row) {
    const { json: jsonRaw } = row;
    let json = {};
    if (jsonRaw) {
      try {
        json = JSON.parse(jsonRaw);
      } catch (err) {
        json = {};
      }
    }
    return { ...row, json };
  }

  async upsertFeedItem({
    feedId,
    guid,
    title,
    link,
    author,
    summary,
    date,
    pubdate,
  }) {
    return this.knex("FeedItems")
      .insert({ feedId, guid, title, link, author, summary, date, pubdate })
      .onConflict(["guid"])
      .merge();
  }
}
