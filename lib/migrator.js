import fs from "fs/promises";
import path from "path";
import { glob, Glob } from "glob";

import { Logger } from "./logger.js";

/** @typedef {{ version: string, direction: string, name: string, filename: string }} Migration */
/** @typedef {Migration & { sql: string }} MigrationWithSQL */

export class Migrator {
  /**
   * @param {import("better-sqlite3").Database} db
   * @param {string} migrationsPath
   */
  constructor(
    db,
    migrationsPath = "./migrations",
    versionPadding = "000",
    minVersion = "000",
    maxVersion = "999"
  ) {
    this.db = db;
    this.migrationsPath = migrationsPath;
    this.versionPadding = versionPadding;
    this.minVersion = minVersion;
    this.maxVersion = maxVersion;
    this.log = Logger.child({ module: "migrator" });
  }

  async migrateLatest() {
    let lastVersion;
    while (true) {
      try {
        lastVersion = await this.migrateOnce();
      } catch (err) {
        if (err.message === "No migrations to apply.") {
          break;
        }
        throw err;
      }
    }
    return lastVersion;
  }

  async migrateOnce() {
    const currentVersion = this.getVersion();
    this.log.trace({ msg: "migrateOnce", currentVersion });

    const migrations = await this.findMigrations(
      "up",
      currentVersion,
      this.maxVersion
    );

    if (migrations.length === 0) {
      throw new Error("No migrations to apply.");
    }

    const nextMigration = migrations[0];
    const nextVersion = nextMigration.version;

    this.applyMigration(await this.loadMigration(nextMigration));
    await this.setVersion(nextVersion);

    return nextVersion;
  }

  async rollbackOnce() {
    const currentVersion = this.getVersion();
    this.log.trace({ msg: "migrateOnce", currentVersion });

    const migrations = await this.findMigrations(
      "down",
      this.minVersion,
      this.getVersion()
    );

    if (migrations.length === 0) {
      throw new Error("No migrations to rollback.");
    }

    const latestMigration = migrations[migrations.length - 1];
    const previousMigration = migrations[migrations.length - 2];
    const previousVersion = previousMigration
      ? previousMigration.version
      : this.minVersion;

    this.applyMigration(await this.loadMigration(latestMigration));
    await this.setVersion(previousVersion);

    return previousVersion;
  }

  /**
   * @returns {Promise{string}}
   */
  getVersion() {
    const { connection } = this.db;
    const user_version = connection.pragma("user_version", {
      simple: true,
    });
    return user_version
      .toString()
      .padStart(this.versionPadding.length, this.versionPadding);
  }

  /**
   * @param {string} version
   * @returns {Promise<void>}
   */
  setVersion(version) {
    const { connection } = this.db;
    this.log.trace({ msg: "setVersion", version });

    const versionInt = parseInt(version, 10);
    // todo: need to further sanitize this?
    return connection.pragma(`user_version = ${versionInt}`, { simple: true });
  }

  /**
   * @param {string} afterVersion
   * @param {"up"|"down"} direction
   * @returns {Promise<Migration[]>}
   */
  async findMigrations(
    direction = "up",
    afterVersion = this.minVersion,
    beforeVersion = this.maxVersion
  ) {
    const migrationFiles = await glob(path.join(this.migrationsPath, "*.sql"));
    const migrations = migrationFiles
      .map((filename) => {
        try {
          return this.parseMigrationFilename(filename);
        } catch (err) {
          return;
        }
      })
      .filter((migration) => {
        if (!migration) return false;
        const { version, direction: fileDirection } = migration;
        return (
          version > afterVersion &&
          version <= beforeVersion &&
          fileDirection === direction
        );
      })
      .sort((a, b) => {
        return a.version - b.version;
      });

    this.log.trace({
      msg: "findMigrations",
      direction,
      afterVersion,
      beforeVersion,
      migrations,
    });
    return migrations;
  }

  /**
   * @param {Migration} migrations
   * @returns {Promise<MigrationWithSQL>}
   */
  async loadMigration(migration) {
    const sql = await fs.readFile(migration.filename, "utf-8");
    return { ...migration, sql };
  }

  /**
   * @param {string} filename
   * @returns {Migration}
   */
  parseMigrationFilename(filename) {
    const match = /(\d{3})-(up|down)-(\w+)\.sql/.exec(filename);
    if (!match) {
      throw new Error(`Invalid migration filename: ${filename}`);
    }
    const [, version, direction, name] = match;
    return { version, direction, name, filename };
  }

  /**
   * @param {MigrationWithSQL} migration
   */
  applyMigration(migration) {
    this.log.debug({
      msg: "Applying migration",
      migrationName: migration.name,
      version: migration.version,
      direction: migration.direction,
    });
    this.log.trace({ msg: "applyMigration", migration });
    this.db.connection.exec(migration.sql);
  }
}
