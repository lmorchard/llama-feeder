import path from "path";
import SqliteDatabase from "better-sqlite3";
import * as sqliteVec from "sqlite-vec";
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
    const connection = new SqliteDatabase(databasePath); //(":memory:");
    sqliteVec.load(connection);
    this.log.trace({ msg: "database", databasePath });

    this.connection = connection;
  }

  async close() {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
  }

  upsertFeed({
    url,
    title,
    description,
    link,
    createdAt = Date.now(),
    modifiedAt = Date.now(),
  }) {
    this.log.trace({ msg: "upsertFeed", url, title, description, link });
    const stmt = this.connection.prepare(
      `
      INSERT INTO Feeds
        (url, title, description, link, createdAt, modifiedAt)
        VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(url) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        link = excluded.link,
        modifiedAt = ?
      `
    );
    return stmt.run(
      url,
      title,
      description,
      link,
      createdAt,
      modifiedAt,
      modifiedAt
    );
  }

  upsertFeedItem({
    feedId,
    guid,
    title = "",
    link = "",
    author = "",
    summary = "",
    content = "",
    json = "{}",
    pubDate = new Date(),
    createdAt = new Date(),
    modifiedAt = new Date(),
  }) {
    const stmt = this.connection.prepare(
      `
      INSERT INTO FeedItems
        (feedId, guid, title, link, summary, content, author, json, pubDate, createdAt, modifiedAt)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(feedId, guid) DO UPDATE SET
        title = excluded.title,
        link = excluded.link,
        summary = excluded.summary,
        content = excluded.content,
        author = excluded.author,
        pubDate = excluded.pubDate,
        modifiedAt = ?
      `
    );
    return stmt.run(
      feedId,
      guid,
      title,
      link,
      summary,
      content,
      author,
      JSON.stringify(json),
      pubDate.getTime(),
      createdAt.getTime(),
      modifiedAt.getTime(),
      modifiedAt.getTime()
    );
  }

  updateFetchedFeed({
    id,
    title,
    lastValidated,
    lastParsed,
    status,
    statusText,
    json = {},
  }) {
    this.log.trace({ msg: "updateFetchedFeed", id, title, status, statusText });
    const stmt = this.connection.prepare(
      `
      UPDATE Feeds
      SET
        title = ?,
        lastValidated = ?,
        lastParsed = ?,
        status = ?,
        statusText = ?,
        json = ?
      WHERE id = ?
      `
    );
    return stmt.run(
      title,
      lastValidated,
      lastParsed,
      status,
      statusText,
      JSON.stringify(json),
      id
    );
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

  listFeeds() {
    this.log.trace({ msg: "listFeeds" });
    const stmt = this.connection.prepare(`SELECT * FROM Feeds`);
    return stmt.all().map((row) => this._mapRowToFeed(row));
  }
}
