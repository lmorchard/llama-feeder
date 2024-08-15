import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeedItem extends LitElement {
  static properties = {
    title: { type: String },
    link: { type: String },
    text: { type: String },
    thumbnailUrl: { type: String },
    date: { type: String }
  };

  createRenderRoot() {
    return this;
  }

  render() {
    const { title, link, text, thumbnailUrl, date: dateRaw } = this;

    const date = new Date(parseInt(dateRaw, 10));
    const dateDisplay = date.toLocaleString();

    return html`
      <header>
        ${thumbnailUrl && html`
          <div class="thumbnail">
            <img src="${thumbnailUrl}" />
          </div>
        `}
        <a href="${link}" class="title">${title}</a>
      </header>
      ${text && html`<blockquote class="summary">${text.substring(0, 160)}</blockquote>`}
      <time>${dateDisplay}</time>
    `;
  }
}

customElements.define("feeder-feed-item", FeederFeedItem);
