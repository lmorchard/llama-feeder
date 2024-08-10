import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeedItem extends LitElement {
  static properties = {
    item: { attribute: false, type: Object },
  };

  render() {
    const { title, link, text, thumbnailUrl, date: dateRaw } = this.item;

    const date = new Date(parseInt(dateRaw, 10));
    const dateDisplay = date.toLocaleString();

    return html`
      <details open>
        <summary>
          <a href="${link}">${title} (<time>${dateDisplay}</time>)</a>
        </summary>
        ${thumbnailUrl && html`<img src="${thumbnailUrl}" style="width: 128px" />`}
        ${text && html`<blockquote>${text.substring(0, 255)}</blockquote>`}
      </details>
    `;
  }
}

customElements.define("feeder-feed-item", FeederFeedItem);
