import path from "path";

import Fastify from "fastify";
import FastifyStatic from "@fastify/static";
import FastifyAccepts from "@fastify/accepts";
import FastifyCompress from "@fastify/compress";
import FastifySecureSession from "@fastify/secure-session";
import FastifyCsrfProtection from "@fastify/csrf-protection";
import AjvErrors from "ajv-errors";

import { TemplateRenderer } from "./templates.js";
import templateIndex from "./templates/index.js";

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
  fastify.register(TemplateRenderer);
  fastify.register(IndexRouter, { log, db });
  fastify.register(FeedsRouter, { log, db });
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
    const { limit = 25, maxage = 1000 * 60 * 60 * 24 * 7 } = request.query;
    const feeds = await db.listRecentlyUpdatedFeeds({ limit, maxage });
    log.info({ msg: "Rendering index", count: feeds.length });
    return reply.renderTemplate(templateIndex, { feeds });
  });
};

const FeedsRouter = async function (fastify, { log, db }) {
  fastify.get("/api/feeds", async (request, reply) => {
    const { limit = 25, maxage = 1000 * 60 * 60 * 24 * 7 } = request.query;
    const feeds = await db.listRecentlyUpdatedFeeds({ limit, maxage });
    log.info({ msg: "Rendering index", count: feeds.length });
    return reply.renderTemplate(templateIndex, { feeds });
  });

  fastify.get("/api/feeds/:id", async (request, reply) => {
    const { limit = 25, maxage = 1000 * 60 * 60 * 24 * 7 } = request.query;
    const feedId = parseInt(request.params.id);
    const [feed, items] = await Promise.all([
      db.fetchFeedById(feedId),
      db.fetchFeedItemsByFeed({ feedId, limit, maxage }),
    ]);
    return reply.send({ feed, items });
  });
};
