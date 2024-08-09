import { Command } from "commander";

import setupCommandDatabase from "./database.js";
import setupCommandImport from "./import.js";
import setupCommandFetch from "./fetch.js";
import setupCommandEmbed from "./embed.js";
import setupCommandServe from "./serve.js";

export default async function (argv = process.argv) {
  const program = new Command();

  await setupCommandDatabase(program);
  await setupCommandImport(program);
  await setupCommandFetch(program);
  await setupCommandEmbed(program);
  await setupCommandServe(program);

  return program.parseAsync(argv);
}
