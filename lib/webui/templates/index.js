import { html } from "../html.js";
import { layout } from "./layout.js";

export default ({ feeds, ...locals }) =>
  layout({
    ...locals,
    content: html`
      <feeder-feeds-list baseApiUrl="/api">
        ${feeds.map(
          (feed) => html`
            <feeder-feed
              feedId="${feed.id}"
              title="${feed.title}"
              link="${feed.link}"
            ></feeder-feed>
          `
        )}
      </feeder-feeds-list>
    `,
  });
