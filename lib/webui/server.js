import path from "path";

import Fastify from "fastify";
import FastifyStatic from "@fastify/static";
import FastifyAccepts from "@fastify/accepts";
import FastifyCompress from "@fastify/compress";
import FastifyFormbody from "@fastify/formbody";
import AjvErrors from "ajv-errors";

import * as cheerio from "cheerio";

import { TemplateRenderer } from "./templates.js";
import templateIndex from "./templates/index.js";
import templateRag from "./templates/rag.js";

export async function startServer(log, db, options = {}) {
  const { port = 3000, host = "127.0.0.1" } = options;

  const fastify = Fastify({
    logger: log,
    ajv: { customOptions: { allErrors: true }, plugins: [AjvErrors] },
  });

  // Defer resolution of this method until the server closes, which
  // defers postAction cleanup like closing database connections
  const closePromise = new Promise((resolve, reject) => {
    fastify.addHook("onClose", (instance, done) => {
      resolve();
      done();
    });
  });

  fastify.register(FastifyCompress);
  fastify.register(FastifyAccepts);
  fastify.register(FastifyFormbody);
  fastify.register(TemplateRenderer);
  fastify.register(IndexRouter, { log, db });
  fastify.register(RagRouter, { log, db });
  fastify.register(ApiRouter, { log, db });
  fastify.register(FastifyStatic, {
    root: path.resolve(import.meta.dirname, "public"),
    prefix: "/",
  });

  log.info({ msg: "Starting server", host, port });
  await fastify.listen({ host, port });

  return closePromise;
}

const IndexRouter = async function (fastify, { log, db }) {
  fastify.get("/", async (request, reply) => {
    const { limit = 100, maxage = 1000 * 60 * 60 * 24 * 3 } = request.query;
    const feeds = await db.listRecentlyUpdatedFeeds({ limit, maxage });

    return reply.renderTemplate(templateIndex, { feeds, maxage });
  });
};

import { generateEmbeddingsBatch } from "../llamafile.js";

const RagRouter = async function (fastify, { log, db }) {
  fastify.get("/rag", async (request, reply) => {
    return reply.renderTemplate(templateRag, {});
  });

  fastify.post("/rag", async (request, reply) => {
    const {
      limit = 50,
      maxage = 1000 * 60 * 60 * 24 * 3,
      prompt,
    } = request.body;

    const embeddings = await generateEmbeddingsBatch([prompt]);
    const embedding = embeddings[0];
    const ids = await db.findFeedItemIdsByEmbedding({
      embedding,
      limit,
      maxage,
    });
    const items = await db.fetchFeedItemsByIds(ids);

    for (const item of items) {
      try {
        const { content } = item;
        const $ = cheerio.load(content);
        item.text = $.text();
      } catch {
        log.warn({ msg: "Failed to parse content", item });
      }
    }

    return reply.renderTemplate(templateRag, { prompt, items });
  });
};

const ApiRouter = async function (fastify, { log, db }) {
  fastify.get("/api/feeds", async (request, reply) => {
    const { limit = 25, maxage = 1000 * 60 * 60 * 24 } = request.query;
    const feeds = await db.listRecentlyUpdatedFeeds({ limit, maxage });
    log.info({ msg: "Rendering index", count: feeds.length });
    return reply.renderTemplate(templateIndex, { feeds });
  });

  fastify.get("/api/feeds/:id", async (request, reply) => {
    const { limit = 25, maxage = 1000 * 60 * 60 * 24 } = request.query;
    const feedId = parseInt(request.params.id);

    const [feed, items] = await Promise.all([
      db.fetchFeedById(feedId),
      db.fetchFeedItemsByFeed({ feedId, limit, maxage }),
    ]);

    // TODO: move this into feed parsing and store it in the database?
    for (const item of items) {
      try {
        const { content } = item;
        const $ = cheerio.load(content);
        item.text = $.text();
      } catch {
        log.warn({ msg: "Failed to parse content", item });
      }
    }

    return reply.send({ feed, items });
  });
};
