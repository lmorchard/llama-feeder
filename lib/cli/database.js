import { Migrator } from "../migrator.js";
import { Database } from "../database.js";
import { Logger } from "../logger.js";

export default async function (program) {

  const databaseProgram = program
    .command("db")
    .description("Database management commands");

  databaseProgram
    .command("migrate")
    .description("Migrate to latest database version")
    .action(commandDatabaseMigrate);

  databaseProgram
    .command("rollback")
    .description("Rollback one database version")
    .action(commandDatabaseRollback);
}

async function commandDatabaseMigrate() {
  const log = Logger.child({ module: "cli", name: "commandDatabaseMigrate" });
  const db = new Database();
  const migrator = new Migrator(db, "./migrations");
  try {
    const version = await migrator.migrateLatest();
    log.info({ msg: "Migration complete.", version });
  } catch (err) {
    log.error({ msg: "Migration failed.", err });
  }
}

async function commandDatabaseRollback() {
  const log = Logger.child({ module: "cli", name: "commandDatabaseRollback" });
  const db = new Database();
  const migrator = new Migrator(db, "./migrations");
  try {
    const version = await migrator.rollbackOnce();
    log.info({ msg: "Rollback complete.", version });
  } catch (err) {
    log.error({ msg: "Rollback failed.", err });
  }
}
