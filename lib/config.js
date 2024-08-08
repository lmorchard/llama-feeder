import * as dotenv from "dotenv";
import Convict from "convict";

dotenv.config();

export const Config = Convict({
  dataPath: {
    doc: "Data directory for application state",
    env: "DATA_PATH",
    format: String,
    default: "data",
  },
  databaseFilename: {
    doc: "Filename for the SQLite database",
    env: "DATABASE_FILENAME",
    format: String,
    default: "data.db",
  },
  logLevel: {
    doc: "Logging level",
    env: "LOG_LEVEL",
    format: ["trace", "debug", "info", "warn", "error"],
    default: "info",
  },
  logSingleLine: {
    doc: "Emit single-line log messages",
    env: "LOG_SINGLE_LINE",
    format: Boolean,
    default: true,
  },
  logPretty: {
    doc: "Pretty-print log messages",
    env: "LOG_PRETTY",
    format: Boolean,
    default: true,
  },
  feedPollConcurrency: {
    doc: "Number of concurrent feed fetches",
    env: "FEED_POLL_CONCURRENCY",
    format: Number,
    default: 64,
  },
  feedPollMaxAge: {
    doc: "Maximum age of feed items to import",
    env: "FEED_POLL_MAX_AGE",
    format: Number,
    default: 30 * 60 * 1000,
  },
  feedPollMaxItems: {
    doc: "Maximum number of feed items to import",
    env: "FEED_POLL_MAX_ITEMS",
    format: Number,
    default: 100,
  },
  feedPollDefaultCharset: {
    doc: "Default charset for feed fetches",
    env: "FEED_POLL_DEFAULT_CHARSET",
    format: String,
    default: "utf-8",
  },
  fetchTimeout: {
    doc: "Timeout for feed fetches",
    env: "FETCH_TIMEOUT",
    format: Number,
    default: 10000,
  },
  userAgent: {
    doc: "User-Agent header for feed fetches",
    env: "USER_AGENT",
    format: String,
    default: "llama-feeder/1.0",
  },
  llamafileEmbeddingUrl: {
    doc: "Port for llamafile embedding server",
    env: "LLAMAFILE_EMBEDDING_URL",
    format: String,
    default: "http://127.0.0.1:8887/embedding",
  },
  llamafileGenerationUrl: {
    doc: "Port for llamafile generation server",
    env: "LLAMAFILE_GENERATION_URL",
    format: String,
    default: "http://127.0.0.1:8886/completion",
  },
  llamafileEmbeddingDownloadURL: {
    doc: "URL for llamafile embedding",
    env: "LLAMAFILE_EMBEDDING_URL",
    format: String,
    default: "https://huggingface.co/Mozilla/mxbai-embed-large-v1-llamafile/resolve/main/mxbai-embed-large-v1-f16.llamafile",
  },
  llamafileGenerationDownloadURL: {
    doc: "URL for llamafile generation",
    env: "LLAMAFILE_GENERATION_URL",
    format: String,
    default: "https://huggingface.co/Mozilla/TinyLlama-1.1B-Chat-v1.0-llamafile/resolve/main/TinyLlama-1.1B-Chat-v1.0.Q4_0.llamafile",
  },
});
