import { Database } from "../database.js";
import { Logger } from "../logger.js";

let db, log;

export default async function (program) {
  const databaseProgram = program
    .command("db")
    .description("Database management commands");

  databaseProgram.hook("preAction", async (command, subcommand) => {
    log = Logger.child({ name: subcommand.name() });
    db = new Database();
  });

  databaseProgram.hook("postAction", async () => {
    await db.close();
  });

  databaseProgram
    .command("migrate")
    .description("Migrate to latest database version")
    .action(async () => {
      const result = await db.knex.migrate.latest();
      log.info({ result });
    });

  databaseProgram
    .command("version")
    .description("Query database migration version")
    .action(async () => {
      const result = await db.knex.migrate.currentVersion();
      log.info({ result });
    });

  databaseProgram
    .command("status")
    .description("Query database migration status")
    .action(async () => {
      const result = await db.knex.migrate.status();
      log.info({ result });
    });

  databaseProgram
    .command("up")
    .description("Migrate database version up")
    .action(async () => {
      const result = await db.knex.migrate.up();
      log.info({ msg: result });
    });

  databaseProgram
    .command("down")
    .description("Migrate database version down")
    .action(async () => {
      const result = await db.knex.migrate.down();
      log.info({ msg: result });
    });
}
