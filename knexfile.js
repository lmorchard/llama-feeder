import path from "path";
import { mkdirp } from "mkdirp";
import { Config } from "./lib/config.js";

const dataPath = Config.get("dataPath");
const databaseFilename = Config.get("databaseFilename");

mkdirp.sync(dataPath);

export default {
  client: "better-sqlite3",
  useNullAsDefault: true,
  connection: {
    filename: path.join(dataPath, databaseFilename),
  }
};
