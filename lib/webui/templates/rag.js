import { html } from "../html.js";
import { layout } from "./layout.js";

export default ({ prompt = "", items = [], ...locals }) =>
  layout({
    ...locals,
    content: html`
      <form method="post" class="rag">
        <textarea name="prompt">${prompt}</textarea>
        <input type="submit" value="Submit" />
      </form>
      <section class="items">
        <ul>
          ${items.map(
            ({ title, link, text, thumbnailUrl, date }) => html`
              <li>
                <feeder-feed-item
                  title="${title}"
                  link="${link}"
                  text="${text}"
                  thumbnailUrl="${thumbnailUrl}"
                  date="${date}"
                ></feeder-feed-item>
              </li>
            `
          )}
        </ul>
      </section>
    `,
  });
