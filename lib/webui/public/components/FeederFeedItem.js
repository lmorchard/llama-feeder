import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeedItem extends LitElement {
  static properties = {
    item: { attribute: false, type: Object },
  };

  render() {
    const { title, link, date: dateRaw } = this.item;

    const date = new Date(parseInt(dateRaw, 10));
    const dateDisplay = date.toLocaleString();

    return html`
      <article>
        <header>
          <h3>
            <a href="${link}">${title} (<time>${dateDisplay}</time>)</a>
          </h3>
        </header>
      </article>
    `;
  }
}

customElements.define("feeder-feed-item", FeederFeedItem);
