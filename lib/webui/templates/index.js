import { html } from "../html.js";
import { layout } from "./layout.js";

export default ({ feeds, ...locals }) =>
  layout({
    ...locals,
    content: html`
      <feeder-feeds-list baseApiUrl="/api">
        ${feeds.map(
          (feed) => html`
            <feeder-feed feedId="${feed.id}" title="${feed.title}">
              <header>
                <h2>${feed.title}</h2>
                <time>${new Date(feed.newestItemDate).toISOString()}</time>
              </header>
              <section class="items"></section>
            </feeder-feed>
          `
        )}
      </feeder-feeds-list>
    `,
  });
