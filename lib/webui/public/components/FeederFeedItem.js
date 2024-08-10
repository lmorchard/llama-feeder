import { LitElement, html } from "../vendor/lit-core.min.js";

export default class FeederFeedItem extends LitElement {
  static properties = {
    item: { attribute: false, type: Object },
  };

  render() {
    const { title, link, text, thumbnail, date: dateRaw } = this.item;

    const date = new Date(parseInt(dateRaw, 10));
    const dateDisplay = date.toLocaleString();

    return html`
      <details open>
        <summary>
          <a href="${link}">${title} (<time>${dateDisplay}</time>)</a>
        </summary>
        ${thumbnail && html`<img src="${thumbnail}" style="width: 128px" />`}
        ${text && html`<blockquote>${text}</blockquote>`}
      </details>
    `;
  }
}

customElements.define("feeder-feed-item", FeederFeedItem);
