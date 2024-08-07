import pino from "pino";
import pretty from "pino-pretty";

import { Config } from "./config.js";

const options = {
  level: Config.get("logLevel"),
};

const usePrettyLogs = (process.stdout.isTTY && Config.get("logPretty"));

const destinations = pino.multistream([
  {
    level: "trace",
    stream: usePrettyLogs
      ? pretty({
          colorize: true,
          singleLine: Config.get("logSingleLine"),
        })
      : process.stdout,
  },
]);

export const Logger = pino(options, destinations);
