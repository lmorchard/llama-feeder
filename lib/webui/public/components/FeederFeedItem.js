import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeedItem extends LitElement {
  static properties = {
    item: { attribute: false, type: Object },
  };

  createRenderRoot() {
    return this;
  }

  render() {
    const { title, link, text, thumbnailUrl, date: dateRaw } = this.item;

    const date = new Date(parseInt(dateRaw, 10));
    const dateDisplay = date.toLocaleString();

    return html`
      <header>
        ${thumbnailUrl && html`
          <div class="thumbnail">
            <img src="${thumbnailUrl}" />
          </div>
        `}
        <a href="${link}" class="title">${title} (<time>${dateDisplay}</time>)</a>
      </header>
      ${text && html`<blockquote class="summary">${text.substring(0, 255)}</blockquote>`}
    `;
  }
}

customElements.define("feeder-feed-item", FeederFeedItem);
