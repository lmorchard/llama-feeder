import { render } from "./html.js";
import fp from "fastify-plugin";

export const TemplateRenderer = fp(async (fastify, options) => {
  fastify.decorateReply("renderTemplate", function (template, props = {}) {
    const reply = this;
    const request = this.request;

    const layoutProps = {};

    return reply
      .code(200)
      .headers({
        "Content-Type": "text/html",
        "Access-Control-Allow-Origin": "*",
      })
      .send(
        render(
          template({
            ...layoutProps,
            ...props,
          })
        )
      );
  });
});
