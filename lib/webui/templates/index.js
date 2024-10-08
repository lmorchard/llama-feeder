import { html } from "../html.js";
import { layout } from "./layout.js";

export default ({ feeds, maxage, limit, ...locals }) =>
  layout({
    ...locals,
    content: html`
      <feeder-feeds-list baseApiUrl="/api" maxage="${maxage}" limit="${limit}">
        ${feeds.map(
          (feed) => html`
            <feeder-feed
              feedId="${feed.id}"
              title="${feed.title}"
              link="${feed.link}"
              newestItemDate="${feed.newestItemDate}"
            ></feeder-feed>
          `
        )}
      </feeder-feeds-list>
    `,
  });
